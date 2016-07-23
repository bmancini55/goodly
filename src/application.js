
import amqplib from 'amqplib';
import uuid from 'node-uuid';
import Debug from 'debug';
import Router from './router';
import Event from './event';
import { convertToBuffer, convertFromBuffer } from './util';
const debug = Debug('goodly');

class Application {

  /**
   * [construtor description]
   * @param  {[type]} options.name        [description]
   * @param  {String} options.appExchange [description]
   * @return {[type]}                     [description]
   */
  constructor({ name, appExchange = 'app' }) {
    this.name = name;
    this.appExchange = appExchange;
    this._broker;
    this._channel;
    this._inRouter = new Router();
    this._outRouter = new Router();
    this._requests = [];
    this._bindings = {};
    this._deferredBindings = [];
    debug(this.name + ' created');
  }

  /**
   * Starts the service by connecting to the broker
   * binding the replyTo queue and attaching all listeners
   * @param  {[type]} brokerPath [description]
   * @return {[type]}            [description]
   */
  async start({ brokerPath, concurrent = 5, amqp = amqplib }) {
    this._broker = await amqp.connect('amqp://' + brokerPath);
    this._channel = await this._broker.createChannel();
    debug(this.name + ' connected to RabbitMQ %s', brokerPath);

    // setup service exchange and queue
    const channel = this._channel;
    const appExchange = this.appExchange;
    await channel.assertExchange(appExchange, 'fanout');
    await channel.assertExchange(this.name, 'topic');
    await channel.bindExchange(this.name, this.appExchange, '');
    await channel.assertQueue(this.name, { expires: 3600000 });

    // setup exclusive queue for requestion/response
    this.replyTo = (await channel.assertQueue('', { exclusive: true })).queue;

    // create middleware
    await this._createDefaultMiddleware();

    // attach deferred listeners
    let binding;
    while((binding = this._deferredBindings.shift())) {
      let method = binding.shift();
      await this[method].apply(this, binding);
    }

    // configure prefetch for the channel
    await channel.prefetch(concurrent);

    // start consuming service channel
    await this._consumeServiceQueue();

    // start consuming reply channel
    await this._consumeReplyQueue();
  }

  /**
   * Closes the service
   * @return {[type]} [description]
   */
  async stop() {
    if(this._broker) {
      await this._broker.close();
    }
  }

  /**
   * Gets the connected channel
   * @return {[type]} [description]
   */
  channel() {
    if(!this._channel) {
      throw new Error('Execute start before attempting to use framework');
    }
    return this._channel;
  }

  /**
   * API for emitting an event at the specified path with data.
   * @param  {[type]} path                  [description]
   * @param  {[type]} data                  [description]
   * @param  {[type]} options.correlationId [description]
   * @param  {Object} options.headers:      inputHeaders  [description]
   * @return {[type]}                       [description]
   */
  async emit(path, data, options) {
    const channel = this.channel();

    // rewrite options to include data
    let event = { data, ...options };

    // generate options through middleware
    await this._outRouter.handle(path, event);

    // parse results from options after middleware
    let {
      correlationId,
      replyTo,
      headers,
      sendToQueue
    } = { ...event };

    // create the buffer and modify the headers
    let { buffer, contentType } = convertToBuffer(event.data);
    headers.contentType         = contentType;

    // publish into the channel
    if(sendToQueue) {
      debug(this.name + ' reply to %s for %s', sendToQueue, correlationId);
      await channel.sendToQueue(sendToQueue, buffer, { correlationId, headers, noAck: true });
    }
    else {
      debug(this.name + ' emit %s %s', path, correlationId);
      await channel.publish(this.appExchange, path, buffer, { correlationId, replyTo, headers });
    }
  }


  /**
   * Binds the method to the event for listening
   * @private
   */
  async on(path, ...fns) {
    const channel  = this._channel;
    const router   = this._inRouter;
    const exchange = this.name;
    const queue    = this.name;

    // if not yet connected to the broker we need to defer
    if(!channel) {
      this._deferredBindings.push(['on', path, ...fns]);
      return;
    }

    // attach handler to the router
    router.add(path, ...fns);

    // bind the queue if we haven't already
    if(!this._bindings[path]) {
      await channel.bindQueue(queue, exchange, path);
      this._bindings[path] = true;
    }

    debug(this.name + ' listens to %s', path);
  }

  /**
   * Add middleware for
   * @param  {[type]}    path [description]
   * @param  {...[type]} fns  [description]
   * @return {[type]}         [description]
   */
  async onEmit(path, ...fns) {
    const channel = this._channel;
    const router  = this._outRouter;

    // if not yet connected to the broker we will defer
    if(!channel) {
      this._deferredBindings.push(['onEmit', path, ...fns]);
      return;
    }

    // attach handler to the router
    router.add(path, ...fns);

    debug(this.name + ' added emit middleware for ' + path);
  }

  /**
   * Performs a request in a request/response interaction. Similar
   * to the broadcast message.
   * @param  {[type]} path                  [description]
   * @param  {String} data                  [description]
   * @param  {[type]} options.correlationId [description]
   * @param  {Object} options.headers:      inputHeaders  [description]
   * @return {[type]}                       [description]
   */
  async request(path, data = '', { correlationId = uuid.v4() } = {}) {
    debug(this.name + ' request %s %s', path, correlationId);
    const replyTo = this.replyTo;

    // publish the event and include the correlationId and the replyTo queue
    return new Promise((resolve) => {
      this._requests[correlationId] = (receivedData) => resolve(receivedData);
      this.emit(path, data, { correlationId, replyTo });
    });

  }


  /**
   * Consume the service queue
   * @return {[type]} [description]
   */
  async _consumeServiceQueue() {
    const channel = this.channel();
    const handler = async (msg) => {
      let correlationId = msg.properties.correlationId;
      let contentType   = msg.properties.headers.contentType;
      let path          = msg.fields.routingKey;
      let router        = this._inRouter;
      let buffer        = msg.content;
      debug(this.name + ' on %s %s', path, correlationId);

      // convert from buffer into
      let data = convertFromBuffer(contentType, buffer);

      // construct event object
      let event = new Event({ service: this, msg: msg, data: data });

      // processing message
      let result = await router.handle(path, event);

      // perform replyTo by directly emitting into the reply to queue
      if(msg.properties.replyTo)
        await this.emit(path, result, { correlationId, sendToQueue: msg.properties.replyTo });

      // ack the message so that prefetch works
      await channel.ack(msg);
    };

    // start consuming the queue
    channel.consume(this.name, handler);
  }


  /**
   * Consumes the reply queue
   * @return {[type]} [description]
   */
  async _consumeReplyQueue() {
    const channel = this.channel();
    const handler = async (msg) => {
      let correlationId = msg.properties.correlationId;
      let contentType   = msg.properties.headers.contentType;
      debug(this.name + ' received response for %s', correlationId);

      if(this._requests[correlationId]) {
        let buffer = msg.content;
        let data   = convertFromBuffer(contentType, buffer);
        this._requests[correlationId](data);
      }
    };

    // start consuming the queue
    channel.consume(this.replyTo, handler, { noAck: true });
  }

  /**
   * Attaches default middleware
   * @return {[type]} [description]
   */
  async _createDefaultMiddleware() {
    this._outRouter.add((options, next) => {
      options.correlationId = options.correlationId || uuid.v4();
      options.headers       = options.headers || {};
      debug(this.name + ' applied default out middleware');
      next();
    });
  }
}

module.exports = Application;