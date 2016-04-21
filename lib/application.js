
import http from 'http';
import amqp from 'amqplib';
import uuid from 'node-uuid';
import Debug from 'debug';
import { convertToBuffer, convertFromBuffer } from './util';
import Router from './router';
import Event from './event';
import memoryCache from './memory-cache';

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
    this.cache = undefined;
    this.transport = undefined;
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
    else
      this._settings[key] = value;
  }

  /**
   * Gets configuration values from the app
   * @param  {[type]} key [description]
   * @return {[type]}     [description]
   */
  async get(key) {
    return this[key] || this._settings[key];
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
    let cache = this.lazyCache();
    cache.start();

    // start the transport mechanism
    this.transport.start();

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
    this.transport.close();
    this.cache.close();
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
  lazyCache() {
    if(!this.cache) {
      this.cache = memoryCache();
    }
    return this.cache;
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

  async emit(event, data, { correlationId = uuid.v4(), headers = {} } = {}) {
    debug('emit %s %s', event, correlationId);
    const channel = this.channel();
    const cache = this.cache;
    const transport = this.transport;
    const sendDataEvent = event + '.senddata';
    let appliedHeaders = Object.assign({ }, headers);

    if(data) {

      // listen for the senddata event
      await this.on(sendDataEvent, async (event) => {
        const data = await cache.readFromCache(event.correlationId);
        const msg  = event.msg;
        return transport.sendData({ service: this, data, msg });
      });

      // write the data to the cache so any service can respond
      // to the senddata event
      await cache.writeToCache(correlationId, data);

      // adjust headers to include senddata event
      appliedHeaders.sendDataEvent = sendDataEvent

    }

    // publish into the channel
    channel.publish(this.appExchange, event, new Buffer(''), { correlationId, headers: appliedHeaders });
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
    this.lazyrouter();
    let router = this._router;
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
    let transport     = this.transport;
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