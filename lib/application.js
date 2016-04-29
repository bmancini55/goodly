
import http from 'http';
import amqp from 'amqplib';
import uuid from 'node-uuid';
import Debug from 'debug';
import { convertToBuffer, convertFromBuffer } from './util';
import Router from './router';
import Event from './event';
import memoryCache from './memory-cache';
import brokerTransport from './broker-transport';

const debug = Debug('goodly:core');

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
    this._settings = {};
    this._bindings = {};
    this._cache = undefined;
    this._transport = undefined;
    debug('created service %s', name);
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
  async start({ brokerPath, httpHost, httpPort }) {
    this._broker = await amqp.connect('amqp://' + brokerPath);
    this._channel = await this._broker.createChannel();
    debug('connected to RabbitMQ %s', brokerPath);

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

    // start consuming main channel
    const queue = this.name;
    channel.consume(queue, (msg) => this._onMsg(msg).catch(e => console.log(e.stack)));
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
  async emit(path, data, { correlationId = uuid.v4(), headers: inputHeaders = {} } = {}) {
    debug('emit %s %s', path, correlationId);
    const channel = this.channel();
    const transport = this._transport;

    // create the buffer and modify the headers
    let { buffer, headers } = await transport.prepEmission({ service: this, path, correlationId, data })

    // apply user overriden headers with transport generated headers
    headers = Object.assign(headers, inputHeaders);

    // publish into the channel
    await channel.publish(this.appExchange, path, buffer, { correlationId, headers });
  }


  /**
   * Binds the method to the event for listening
   * @private
   */
  async on(path, fn) {
    const channel  = this.channel();
    const exchange = this.name;
    const queue    = this.name;

    // attach handler to the router
    let router = this.lazyrouter();
    router.on(path, fn);

    // bind the queue if we haven't already
    if(!this._bindings[path]) {
      await channel.bindQueue(queue, exchange, path);
      this._bindings[path] = true;
    }

    debug('listens to %s', path);
  }

  /**
   * @private
   * @param  {[type]} msg        [description]
   * @return {[type]}            [description]
   */
  async _onMsg(msg) {
    let correlationId = msg.properties.correlationId;
    let sendDataEvent = msg.properties.headers.sendDataEvent;
    let path          = msg.fields.routingKey;
    let channel       = this.channel();
    let transport     = this._transport;
    debug('on %s %s', path, correlationId);

    try {

      // fetch the data from the transport
      let data = await transport.requestData({ service: this, msg });

      // construct event object
      let event = new Event({ service: this, msg: msg, data: data });

      // processing message
      await this.handle(path, event);

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
  async handle(path, event) {
    let router = this._router;

    // no routes
    if (!router) {
      debug('no routes defined on app');
      return;
    }

    // dispatch into router and return result
    let result = await router.handle(path, event);
    return result;
  }
}