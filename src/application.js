
import amqp from 'amqplib';
import uuid from 'node-uuid';
import Debug from 'debug';
import Router from './router';
import Event from './event';
import brokerTransport from './transport-broker';
import { convertToBuffer, convertFromBuffer } from './util';
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
  async start({ brokerPath, concurrent = 5 }) {
    this._broker = await amqp.connect('amqp://' + brokerPath);
    this._channel = await this._broker.createChannel();
    debug(this.name + ' connected to RabbitMQ %s', brokerPath);

    // start the transport mechanism
    let transport = await this.lazyTransport();
    transport.start();

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

    if(this._cache)
      this._cache.close();
  }

  /**
   * Lazy creation of the default router if one is not specified
   * @return {[type]} [description]
   */
  layzRouter() {
    if (!this._router) {
      this._router = new Router();
    }
    return this._router;
  }

  /**
   * Lazy createion of the default transport
   * @return {[type]} [description]
   */
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
  async emit(path, data = '', { correlationId = uuid.v4(), replyTo, headers: inputHeaders = {} } = {}, sendToQueue) {
    debug(this.name + ' emit %s %s', path, correlationId);
    const channel = this.channel();
    const transport = this._transport;

    // create the buffer and modify the headers
    let { send, headers } = await transport.prepEmission({ service: this, path, correlationId, data, replyTo });
    let { buffer, contentType } = convertToBuffer(send);

    // apply user overriden headers with transport generated headers
    headers = Object.assign(headers, inputHeaders, { contentType });

    // publish into the channel
    if(sendToQueue)
      await channel.sendToQueue(replyTo, buffer, { correlationId, headers, noAck: true });
    else
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
    let router = this.layzRouter();
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
    let contentType   = msg.properties.headers.contentType;
    let path          = msg.fields.routingKey;
    let channel       = this.channel();
    let transport     = this._transport;
    let router        = this._router;
    debug(this.name + ' on %s %s', path, correlationId);

    // fetch the data from the transport
    let buffer = await transport.requestData({ service: this, msg });

    // convert from buffer into
    let data = convertFromBuffer(contentType, buffer);

    // construct event object
    let event = new Event({ service: this, msg: msg, data: data });

    // processing message
    let result = await router.handle(path, event);

    // perform replyTo by directly emitting into the reply to queue
    if(msg.properties.replyTo)
      await this.emit(msg, result, { correlationId }, msg.properties.replyTo);

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
    const transport = this._transport;
    const handler = async (msg) => {
      let correlationId = msg.properties.correlationId;
      let contentType   = msg.properties.headers.contentType;
      debug(this.name + ' received response for %s', correlationId);

      if(this._requests[correlationId]) {
        let buffer = await transport.requestData({ service: this, msg });
        let data   = convertFromBuffer(contentType, buffer);
        this._requests[correlationId](data);
      }
    };
    channel.consume(this.replyTo, handler, { noAck: true });
  }
}