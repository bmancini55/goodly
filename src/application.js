
import amqp from 'amqplib';
import uuid from 'node-uuid';
import Debug from 'debug';
import Router from './router';
import Event from './event';
import memoryCache from './memory-cache';
import brokerTransport from './broker-transport';
const debug = Debug('goodly');

export default class {


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
    this._router;
    this._requests = [];
    this._settings = {};
    this._bindings = {};
    this._cache = undefined;
    this._transport = undefined;
    this._deferredBindings = [];
    debug(this.name + ' created');
  }

  /**
   * Store configuration data for the app
   * @param {[type]} key    [description]
   * @param {[type]} object [description]
   */
  async set(key, object) {
    let value = object;
    if(object.then)
      value = await object;

    if(this.hasOwnProperty(key))
      this[key] = value;
    else if (this.hasOwnProperty('_' + key))
      this['_' + key] = value;
    else
      this._settings[key] = value;
  }

  /**
   * Gets configuration values from the app
   * @param  {[type]} key [description]
   * @return {[type]}     [description]
   */
  async get(key) {
    return this[key] || this['_' + key] || this._settings[key];
  }

  /**
   * Starts the service by connecting to the broker
   * binding the replyTo queue and attaching all listeners
   * @param  {[type]} brokerPath [description]
   * @return {[type]}            [description]
   */
  async start({ brokerPath }) {
    this._broker = await amqp.connect('amqp://' + brokerPath);
    this._channel = await this._broker.createChannel();
    debug(this.name + ' connected to RabbitMQ %s', brokerPath);

    // start the cache
    let cache = await this.lazyCache();
    cache.start();

    // start the transport mechanism
    let transport = await this.lazyTransport();
    transport.start();

    // setup service exchange and queue
    const channel = this._channel;
    const appExchange = this.appExchange;
    await channel.assertExchange(appExchange, 'fanout');
    await channel.assertExchange(this.name, 'topic');
    await channel.bindExchange(this.name, this.appExchange, '');
    await channel.assertQueue(this.name, { durable: true });

    // setup exclusive queue for requestion/response
    this.replyTo = (await channel.assertQueue('', { exclusive: true })).queue;

    // attach deferred listeners
    for(let binding of this._deferredBindings) {
      await this.on.apply(this, binding);
    }

    // start consuming service channel
    await channel.consume(this.name, (msg) => this._onMsg(msg).catch(e => console.log(e.stack)));

    // start consuming reply channel
    await this._consumeReplyQueue();
  }

  /**
   * Stops the service
   * @return {[type]} [description]
   */
  async stop() {
    this._broker.close();
    this._transport.close();
    this._cache.close();
  }

  /**
   * Lazy creation of the default router if one is not specified
   * @return {[type]} [description]
   */
  lazyrouter() {
    if (!this._router) {
      this._router = new Router();
    }
    return this._router;
  }

  /**
   * Configure the cache
   * @return {[type]} [description]
   */
  async lazyCache() {
    if(!this._cache) {
      this._cache = await memoryCache();
    }
    return this._cache;
  }

  async lazyTransport() {
    if(!this._transport) {
      this._transport = await brokerTransport();
    }
    return this._transport;
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
   * API for emitting an event at the specified path with data. The transport
   * will intercept the emission and mutate the data and headers to allow the
   * to be transmissed via the configured method.
   * @param  {[type]} path                  [description]
   * @param  {[type]} data                  [description]
   * @param  {[type]} options.correlationId [description]
   * @param  {Object} options.headers:      inputHeaders  [description]
   * @return {[type]}                       [description]
   */
  async emit(path, data = '', { correlationId = uuid.v4(), replyTo, headers: inputHeaders = {} } = {}) {
    debug(this.name + ' emit %s %s', path, correlationId);
    const channel = this.channel();
    const transport = this._transport;

    // create the buffer and modify the headers
    let { buffer, headers } = await transport.prepEmission({ service: this, path, correlationId, data, replyTo });

    // apply user overriden headers with transport generated headers
    headers = Object.assign(headers, inputHeaders);

    // publish into the channel
    await channel.publish(this.appExchange, path, buffer, { correlationId, replyTo, headers });
  }


  /**
   * Binds the method to the event for listening
   * @private
   */
  async on(path, fn) {
    const channel  = this._channel;
    const exchange = this.name;
    const queue    = this.name;

    // if not yet connected to the broker we need to defer
    if(!channel) {
      this._deferredBindings.push([path, fn]);
      return;
    }

    // attach handler to the router
    let router = this.lazyrouter();
    router.on(path, fn);

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
    let path          = msg.fields.routingKey;
    let channel       = this.channel();
    let transport     = this._transport;
    debug(this.name + ' on %s %s', path, correlationId);

    try {

      // fetch the data from the transport
      let data = await transport.requestData({ service: this, msg });

      // construct event object
      let event = new Event({ service: this, msg: msg, data: data });

      // processing message
      let result = await this._handle(path, event);

      // perform replyTo
      if(msg.properties.replyTo)
        await this._respond(msg, result, { correlationId });

      // ack the message so that prefetch works
      await channel.ack(msg);
    }
    catch(ex) {
      console.log('Listen failure: %s', ex.stack);

      // ack the message as complete
      channel.nack(msg, false, false);
    }
  }


  /**
   * [dispatch description]
   * @param  {[type]} path [description]
   * @param  {[type]} msg  [description]
   * @return {[type]}      [description]
   */
  async _handle(path, event) {
    let router = this._router;

    // no routes
    if (!router) {
      debug(this.name + ' no routes defined on app');
      return;
    }

    // dispatch into router and return result
    let result = await router.handle(path, event);
    return result;
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
   * Responds to a request by replying directly to the queue. This is similar
   * to emit and can probably be rolled into it with some conditional logic
   * to prevent duplication.
   * @param  {[type]} msg                   [description]
   * @param  {String} data                  [description]
   * @param  {[type]} options.correlationId [description]
   * @param  {Object} options.header:       inputHeaders  [description]
   * @return {[type]}                       [description]
   */
  async _respond(msg, data = '', { correlationId, header: inputHeaders = {} }) {
    debug(this.name + ' respond to %s', correlationId);
    const channel = this.channel();
    const transport = this._transport;
    const path    = msg.fields.routingKey;
    const replyTo = msg.properties.replyTo;

    // create the buffer and modify the headers
    let { buffer, headers } = await transport.prepEmission({ service: this, path, correlationId, data });

    // apply user overriden headers with transport generated headers
    headers = Object.assign(headers, inputHeaders);

    // publish to the queue
    await channel.sendToQueue(replyTo, buffer, { correlationId, headers, noAck: true });
  }

  /**
   * Consumes the reply queue
   * @return {[type]} [description]
   */
  async _consumeReplyQueue() {
    const channel = this.channel();
    const transport = this._transport;
    const handler = async (msg) => {
      let correlationId = msg.properties.correlationId;
      debug(this.name + ' received response for %s', correlationId);

      if(this._requests[correlationId]) {
        let data = await transport.requestData({ service: this, msg });
        this._requests[correlationId](data);
      }
    };
    channel.consume(this.replyTo, handler, { noAck: true });
  }
}