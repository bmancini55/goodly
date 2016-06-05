
import amqp from 'amqplib';
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
    this._router = new Router();
    this._requests = [];
    this._settings = {};
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
  async start({ brokerPath, concurrent = 5 }) {
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

    // attach deferred listeners
    for(let binding of this._deferredBindings) {
      await this.on.apply(this, binding);
    }

    // configure prefetch for the channel
    await channel.prefetch(concurrent);

    // start consuming service channel
    await channel.consume(this.name, (msg) => this._onMsg(msg));

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
  async emit(path, data = '', { correlationId = uuid.v4(), replyTo, headers: inputHeaders = {} } = {}, sendToQueue) {
    const channel = this.channel();

    // create the buffer and modify the headers
    let { buffer, contentType } = convertToBuffer(data);

    // construct the headers
    let headers = Object.assign({}, { contentType }, inputHeaders);

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
  async on(path, fn) {
    const channel  = this._channel;
    const router   = this._router;
    const exchange = this.name;
    const queue    = this.name;

    // if not yet connected to the broker we need to defer
    if(!channel) {
      this._deferredBindings.push([path, fn]);
      return;
    }

    // attach handler to the router
    router.add(path, fn);

    // bind the queue if we haven't already
    if(!this._bindings[path]) {
      await channel.bindQueue(queue, exchange, path);
      this._bindings[path] = true;
    }

    debug(this.name + ' listens to %s', path);
  }

  /**
   * @private
   * @param  {[type]} msg        [description]
   * @return {[type]}            [description]
   */
  async _onMsg(msg) {
    let correlationId = msg.properties.correlationId;
    let contentType   = msg.properties.headers.contentType;
    let path          = msg.fields.routingKey;
    let channel       = this.channel();
    let router        = this._router;
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
      await this.emit(path, result, { correlationId }, msg.properties.replyTo);

    // ack the message so that prefetch works
    await channel.ack(msg);
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
      this._requests[correlationId] = (msg) => resolve(msg);
      this.emit(path, data, { correlationId, replyTo });
    });

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
    channel.consume(this.replyTo, handler, { noAck: true });
  }
}

module.exports = Application;