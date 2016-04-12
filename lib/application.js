
///////////////////
//
// TODO
//
//  - failed req/res requeue
//  - deadlettering
//  - correlationId collisions in callback hash
//  - pipe senddata requests directly to exchange
//  - remove express
//  - add middleware
//  - add configuration for caching

import http from 'http';
import amqp from 'amqplib';
import redis from 'redis';
import uuid from 'node-uuid';
import express from 'express';
import bodyParser from 'body-parser';
import Debug from 'debug';
const debug = Debug('goodly:app');

export default class Application {

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
    this._router;
    debug('created service %s', name);
  }

  /**
   * Starts the service by connecting to the broker
   * binding the replyTo queue and attaching all listeners
   * @param  {[type]} brokerPath [description]
   * @return {[type]}            [description]
   */
  async start({ brokerPath }) {

    // TODO abstract this into a broker object that
    // gets attached to the application
    this._broker = await amqp.connect('amqp://' + brokerPath);
    this._channel = await this._broker.createChannel();
    debug('connected to RabbitMQ %s', brokerPath);

    // setup service exchange and queue
    const channel = this._channel;
    const appExchange = this.appExchange;
    await channel.assertExchange(appExchange, 'fanout');
    await channel.assertExchange(this.name, 'topic');
    await channel.bindExchange(this.name, this.appExchange, '');
    await channel.assertQueue(this.name, { durable: true });
  }

  /**
   * Stops the service
   * @return {[type]} [description]
   */
  async stop() {
    this._broker.close();
    // Todo propogate this to the router
    // to shut down caching and transport
  }

  /**
   * Gets the connected channel
   * @return {[type]} [description]
   */
  channel() {
    if(!this._channel) {
      throw new Error('Must start the service before fetching the channel');
    }
    return this._channel;
  }

  /**
   * Lazy creation of the default router if one is not specified
   * @return {[type]} [description]
   */
  lazyrouter() {
    if (!this._router) {
      this._router = new Router();
      // apply default middleware here
    }
  }


  use(path, fn) {
    let actPath = '/';
    let actFn;

    // default path to /
    // disambiguate app.use([fn])
    if(typeof(path) === 'function') {
      actFn = path;
    }
    else {
      actPath = path;
      actFn = fn;
    }

    if (!actFn) {
      throw new TypeError('app.use() requires middleware functions');
    }

    // setup router
    this.lazyrouter();
    let router = this._router;

    // handle non-goodly app
    if (!actFn || !actFn.handle) {
      return router.use(actPath, actFn);
    }

    debug('.use app under %s', actPath);
    fn.mountpath = actPath;
    fn.parent = this;

    // mount path
    router.use(path, fn);

    return this;
  }

  handle() {

  }
}