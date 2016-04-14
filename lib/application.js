
import http from 'http';
import amqp from 'amqplib';
import uuid from 'node-uuid';
import express from 'express';
import bodyParser from 'body-parser';
import Debug from 'debug';
import { convertToBuffer, convertFromBuffer } from './util';
import Router from './router';
import memoryCache from './memory-cache';

const traceCore = Debug('goodly:core');
const traceListener = Debug('goodly:trace-list');
const traceEmitter = Debug('goodly:trace-emit');


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
    this._callbacks = {};
    this._broker;
    this._channel;
    this._app;
    this._router;
    this._settings = {};
    this._bindings = {};
    this.cache = undefined;
    traceCore('created service %s', name);
  }

  /**
   * Store configuration data for the app
   * @param {[type]} key    [description]
   * @param {[type]} object [description]
   */
  set(key, object) {
    if(this.hasOwnProperty(key))
      this[key] = object;
    else
      this._settings[key] = object;
  }

  /**
   * Gets configuration values from the app
   * @param  {[type]} key [description]
   * @return {[type]}     [description]
   */
  get(key) {
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
    traceCore('connected to RabbitMQ %s', brokerPath);

    // start the cache
    let cache = this.lazyCache();
    cache.start();

    // setup express
    const app = this._app = express();
    this.httpHost = httpHost;
    this.httpPort = httpPort || (Math.floor(Math.random() * 50000) + 10000);
    app.use(bodyParser.json({}));
    app.post('/receive', (req, res, next) => this._onReceiveData(req, res).catch(next));
    app.listen(this.httpPort, () => traceCore('express listening on port %d', this.httpPort));


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
    this._app.close();
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

  async _onReceiveData(req, res) {
    const data = convertFromBuffer(new Buffer(req.body.data.data));
    const {correlationId} = req.body;
    traceListener('http data received for %s', correlationId);

    if(this._callbacks[correlationId]) {
      res.end();

      // allow response to end before executing callback
      setImmediate(() => {
        this._callbacks[correlationId](data);
        delete this._callbacks[correlationId];
      });
    } else {
      res.status(404).end();
    }
  }

  async emit(event, data, { correlationId = uuid.v4() } = {}) {
    traceEmitter('emit %s', event);
    const channel = this.channel();
    const cache = this.cache;
    const sendDataEvent = event + '.senddata';

    if(!this._bindings[sendDataEvent]) {
      // TODO make catch work better
      this.on(sendDataEvent, (data, opts) => this._onSendDataEvent(data, opts).catch(e => console.log(e.stack)));
      this._bindings[sendDataEvent] = true;
    }

    cache.writeToCache(correlationId, data);
    const headers = { sendDataEvent };
    channel.publish(this.appExchange, event, new Buffer(''), { correlationId, headers });
  }

  /**
   * [_onSendDataEvent description]
   * @param  {[type]} data        [description]
   * @param  {[type]} options.msg [description]
   * @return {[type]}             [description]
   */
  async _onSendDataEvent(data, { msg }) {
    traceEmitter('received %s event for %s', msg.fields.routingKey, msg.properties.correlationId);
    const cache = this.cache;
    const correlationId = msg.properties.correlationId;
    const replyHost = msg.properties.headers.replyHost;
    const replyPort = msg.properties.headers.replyPort;
    traceEmitter('sending data to %s:%s', replyHost, replyPort);
    try
    {
      const cacheValue = await cache.readFromCache(correlationId);
      const buffer = JSON.stringify({ data: convertToBuffer(cacheValue), correlationId });
      const req = http.request({
        host: replyHost,
        port: replyPort,
        path: '/receive',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': buffer.length
        }
      }, (res) => {
        // TODO requeue original on failure
        traceEmitter('sent data with statusCode %s', res.statusCode);
      });
      req.write(buffer);
      req.end();
    }
    catch(ex) {
      // TODO requeue original on failure
      console.log(ex.stack);
    }
  }

  /**
   * Binds the method to the event for listening
   * @private
   */
  async on(event, fn) {
    const channel  = this.channel();
    const exchange = this.name;
    const queue    = this.name;

    // attach handler to the router
    this.lazyrouter();
    let router = this._router;
    router.on(event, fn);

    // bind the queue
    await channel.bindQueue(queue, exchange, event);
    traceCore('listens to %s', event);
  }

  /**
   * @private
   * @param  {[type]} msg        [description]
   * @return {[type]}            [description]
   */
  async _onMsg(msg) {
    let correlationId = msg.properties.correlationId;
    let sendDataEvent = msg.properties.headers.sendDataEvent;
    let event = msg.fields.routingKey;
    let channel = this.channel();
    traceListener('on %s %s', event, correlationId);

    try {

      // emit the data request event and await for direct response
      let input;
      if(sendDataEvent)
        input = await this._requestData({ sendDataEvent, correlationId });

      // generate scoped emit
      let emit = (event, data) => this.emit(event, data, { correlationId });

      // processing message
      await this.handle(event, input, { ctx: this, emit: emit, event: event, msg: msg });

      // ack the message so that prefetch works
      await channel.ack(msg);
    }
    catch(ex) {
      console.log('Listen failure: %s', ex.stack);

      // ack the message as complete
      channel.nack(msg, false, false);
    }
  }

  async _requestData({ sendDataEvent, correlationId }) {
    traceListener('emit %s for %s', sendDataEvent, correlationId);
    let channel = this.channel();
    let appExchange = this.appExchange;
    let headers = {
      replyHost: this.httpHost,
      replyPort: this.httpPort
    };
    return new Promise((resolve) => {
      this._callbacks[correlationId] = (data) => resolve(data);
      channel.publish(appExchange, sendDataEvent, new Buffer(''), { correlationId, headers });
    });
  }

  /**
   * [dispatch description]
   * @param  {[type]} path [description]
   * @param  {[type]} msg  [description]
   * @return {[type]}      [description]
   */
  async handle(event, data, options) {
    let router = this._router;

    // no routes
    if (!router) {
      traceCore('no routes defined on app');
      return;
    }

    // dispatch into router and return result
    let result = await router.handle(event, data, options);
    return result;
  }
}