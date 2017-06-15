
let amqplib = require('amqplib');
let uuid    = require('uuid');
let Debug   = require('debug');
let Router  = require('./router');
let Event   = require('./event');

let { convertToBuffer, convertFromBuffer } = require('./util');
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
    this._startOpts;
    this._connectionAttempt = 0;
    debug(this.name + ' created');
  }

  /**
   * Starts the goodly service including retry and failure logic
   * @param  {[type]} options.brokerPath [description]
   * @param  {[type]} options.concurrent [description]
   * @param  {[type]} options.amqp       [description]
   * @return {[type]}                    [description]
   */
  async start({ brokerPath, concurrent = 5, amqp = amqplib, retryMultiplier = 1000 }) {
    this._startOpts = { brokerPath, concurrent, amqp, retryMultiplier };
    try {
      await this._connect();
    }
    catch(ex) {
      await this._retryConnect(ex.message);
    }
    return this;
  }

  /**
   * Performs recursive retries with exponential backoff.
   * Promise will resolve when a successful connection is achieved
   * @param  {[type]} errMsg [description]
   * @return {[type]}        [description]
   */
  _retryConnect(errMsg) {
    return new Promise((resolve) => {
      let { brokerPath, retryMultiplier } = this._startOpts;
      let backoff = Math.min(Math.ceil(Math.pow(1.73, ++this._connectionAttempt) - 1), 120);
      console.error(`Failed to connect to RabbitMQ ${brokerPath} (${errMsg}), retrying in ${backoff}s`);
      setTimeout(() => {
        this._connect()
          .catch((err) => this._retryConnect(err.message))
          .then(resolve);
      }, backoff * retryMultiplier);
    });
  }

  /**
   * Handles broker error and performs automatic retry
   * @param  {[type]} e [description]
   * @return {[type]}   [description]
   */
  _onBrokerError(e) {
    console.error(`RabbitMQ connection error: ${e.message}`);
    return this._retryConnect(e.message);
  }

  /**
   * Starts the service by connecting to the broker
   * binding the replyTo queue and attaching all listeners
   * @param  {[type]} brokerPath [description]
   * @return {[type]}            [description]
   */
  async _connect() {
    let {
      brokerPath,
      concurrent,
      amqp
    } = this._startOpts;

    this._broker = await amqp.connect('amqp://' + brokerPath);
    this._channel = await this._broker.createChannel();
    console.error('Connected to RabbitMQ %s', brokerPath);

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
      await this._bindQueue.call(this, binding);
    }

    // configure prefetch for the channel
    await channel.prefetch(concurrent);

    // start consuming service channel
    await this._consumeServiceQueue();

    // start consuming reply channel
    await this._consumeReplyQueue();

    // attach error handler to broker
    this._broker.on('error', this._onBrokerError.bind(this));

    // reset connection attempts
    this._connectionAttempt = 0;

    // return the service for proper chaining
    return this;
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
    let event = Object.assign({ data }, options);

    // generate options through middleware
    await this._outRouter.handle(path, event);

    // parse results from options after middleware
    let {
      correlationId,
      replyTo,
      headers,
      sendToQueue
    } = Object.assign({}, event);

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
  on(path, ...fns) {

    // attach handler to the router
    this._inRouter.add(path, ...fns);

    // add to the deferred bindings once the service starts
    this._deferredBindings.push(path);
  }

  /**
   * Attach middleware to the service
   * path   -> exist            (bind to routers using path)
   *        -> not-exist        (bind to routers without path)
   * fns    -> 1 func           (bind to in-router)
   *        -> N func           (bind to in-router)
   *        -> obj.in           (bind to in-router)
   *        -> obj.out          (bind to out-router)
   * @param  {[type]}    path [description]
   * @param  {...[type]} fns  [description]
   * @return {[type]}         [description]
   */
  use() {

    let inRouter = this._inRouter;
    let outRouter = this._outRouter;
    let path = '#';
    let fns = Array.prototype.slice.call(arguments);

    if(typeof fns[0] === 'string') {
      path = fns[0];
      fns.splice(0, 1);
    }

    if (fns.length === 0) {
      throw new TypeError('.use requires middleware functions');
    }

    function addFns(fns, router) {

      // ensure we're working iterable
      // incase addFns is called with single fn
      if(typeof fns === 'function') {
        fns = [ fns ];
      }

      // ensure array
      if(!Array.isArray(fns)) {
        throw new TypeError('\'fns\' must be a function or array of functions');
      }


      for(let fn of fns) {

        // handle object
        if (fn && (fn.in || fn.out)) {

          if(fn.in) {
            addFns(fn.in, inRouter);
          }

          if(fn.out) {
            addFns(fn.out, outRouter);
          }
        }

        // handle function
        else if(typeof fn === 'function') {
          router.add(path, fn);
        }

        else {
          throw new TypeError('.use requires middleware functions');
        }
      }
    }

    // add them
    addFns(fns, inRouter);
  }

  /**
   * Add middleware for to mutate outbound events
   * @param  {[type]}    path [description]
   * @param  {...[type]} fns  [description]
   * @return {[type]}         [description]
   */
  // async mutateEventOut(path, ...fns) {
    // debug(this.name + ' added out middleware for ' + path);

    // // attach handler to the router
    // this._outRouter.add(path, ...fns);
  // }

  /**
   * Performs a request in a request/response interaction. Similar
   * to the broadcast message.
   * @param  {[type]} path                  [description]
   * @param  {String} data                  [description]
   * @param  {[type]} options.correlationId [description]
   * @param  {Object} options.headers:      inputHeaders  [description]
   * @return {[type]}                       [description]
   */
  async request(path, data, { /* istanbul ignore next */ correlationId = uuid.v4() } = {}) {
    debug(this.name + ' request %s %s', path, correlationId);
    const replyTo = this.replyTo;

    // create a promise to be returned that will act as the callback from the reply queue
    let result = new Promise((resolve, reject) => {
      this._requests[correlationId] = (err, data) => {
        if(err) reject(err);
        else    resolve(data);
      };
    });

    // publish the event and include the correlationId and the replyTo queue
    await this.emit(path, data, { correlationId, replyTo });

    // return promise
    return result;
  }

  /**
   * Binds the servie queue to the service exchange
   * based on the specified path. This method ensures
   * that the _inRouter handlers will receive messages
   * for the path specified in the handler.
   *
   * If the exchange has already been bound, this method
   * is a no-op.
   *
   * @private
   * @param  {string} path - the path of the message
   */
  async _bindQueue(path) {
    const channel  = this._channel;
    const exchange = this.name;
    const queue    = this.name;

    // bind the queue if we haven't already
    if(!this._bindings[path]) {
      await channel.bindQueue(queue, exchange, path);
      this._bindings[path] = true;
      debug(this.name + ' listening to %s', path);
    }
  }

  /**
   * Consume the service queue
   * @return {[type]} [description]
   */
  async _consumeServiceQueue() {
    const channel = this.channel();
    const handler = async (msg) => {
      try {
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
      }
      catch(ex) {
        /* istanbul ignore next */
        console.error(ex.stack);
        /* istanbul ignore next */
        process.exit(1);
      }
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

      /* istanbul ignore else */
      if(this._requests[correlationId]) {
        let buffer = msg.content;
        let data   = convertFromBuffer(contentType, buffer);
        if(contentType === 'error') {
          this._requests[correlationId](data);
        }
        else {
          this._requests[correlationId](null, data);
        }
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
    this._outRouter.add((options) => {
      options.correlationId = options.correlationId || uuid.v4();
      options.headers       = options.headers || {};
      debug(this.name + ' applied default out middleware');
    });
    // eslint-disable-next-line no-unused-vars
    this._inRouter.add((err, event) => {
      console.error(err.stack);
      event.end();
    });
  }
}

module.exports = Application;