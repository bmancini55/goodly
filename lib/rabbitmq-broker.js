
import amqp from 'amqplib';
import uuid from 'node-uuid';
import Debug from 'debug';
const debug = Debug('goodly:rabbitmq-broker');

/**
 * Broker middleware function
 * @param  {[type]} options.serviceName [description]
 * @param  {[type]} options.appExchange [description]
 * @return {[type]}                     [description]
 */
export default async ({ serviceName, appExchange, brokerPath }) => {
  let broker = new RabbitBroker({ serviceName, appExchange, brokerPath });
  await broker.start();

  return (event, next) => {
    // attach local references to the cache and transport
    // NOTE: this may cause issues with nested mounts
    // and we may have to do a scoped operation
    broker.cache     = event.cache;
    broker.transport = event.transport;
    event.broker     = broker;
    next();
  };

}

/**
 * Implementation of broker class
 */
class RabbitBroker {

  cache;
  transport;
  appExchange;
  serviceName;
  broker;
  channel;

  constructor({ serviceName, appExchange, brokerPath }) {
    this.serviceName = serviceName;
    this.appExchange = appExchange;
    this.brokerPath  = brokerPath;
  }

  /**
   * Starts the service by connecting to the broker
   * binding the replyTo queue and attaching all listeners
   * @param  {[type]} brokerPath [description]
   * @return {[type]}            [description]
   */
  async start() {
    const brokerPath  = this.brokerPath;
    const appExchange = this.appExchange;
    const serviceName = this.serviceName;
    const broker      = this.broker = await amqp.connect('amqp://' + brokerPath);
    const channel     = this.channel = await this.broker.createChannel();
    debug('connected to RabbitMQ %s', brokerPath);

    // setup service exchange and queue
    await channel.assertExchange(appExchange, 'fanout');
    await channel.assertExchange(serviceName, 'topic');
    await channel.bindExchange(serviceName, appExchange, '');
    await channel.assertQueue(serviceName, { durable: true });
  }

  /**
   * Emits an event
   * @param  {[type]} event                 [description]
   * @param  {[type]} data                  [description]
   * @param  {[type]} options.correlationId [description]
   * @return {[type]}                       [description]
   */
  async emit(eventName, data, { correlationId = uuid.v4() } = {}) {
    debug('emitting %s', eventName);
    const channel         = this.channel;
    const cache           = this.cache;
    const transport       = this.transport;
    const appExchange     = this.appExchange;
    const serviceExchange = this.serviceName;
    const serviceQueue    = this.serviceName;
    const sendDataEvent   = eventName + '.senddata';

    // TODO cache this binding so we don't do it a million times
    channel.bindQueue(serviceQueue, serviceExchange, sendDataEvent);
    channel.consume(sendDataQueue, (msg) => transport.sendData(msg));

    // cache using application cache
    cache.writeToCache(correlationId, data);

    // publish the message to the broker
    const headers = { sendDataEvent };
    channel.publish(appExchange, event, new Buffer(''), { correlationId, headers });
    debug('emitted %s', event);
  }

  /**
   * Binds the method to the event for listening
   * @private
   */
  async on(event, processMsg, { concurrent = 0 } = {}) {
    const channel  = this.channel;
    const exchange = this.serviceName;
    const queue    = event;

    // bind queue to event
    await channel.bindQueue(queue, exchange, event);

    if(concurrent > 0)
      await channel.prefetch(concurrent);

    // TODO bubble exceptions
    channel.consume(event, (msg) => this._onMsg(event, msg, processMsg).catch(err => console.log(err.stack)));
    debug('listens to %s', event);
  }

  /**
   * @private
   * @param  {[type]} event      [description]
   * @param  {[type]} msg        [description]
   * @param  {[type]} processMsg [description]
   * @return {[type]}            [description]
   */
  async _onMsg(event, msg, processMsg) {
    const correlationId = msg.properties.correlationId;
    const sendDataEvent = msg.properties.headers.sendDataEvent;
    const channel       = this.channel;
    const transport     = this.transport;
    debug('listened to %s %s', event, correlationId);

    try {

      // emit the data request event and await for direct response
      let input = await transport.requestData(event);

      // generate scoped emit
      let emit = (event, data) => this.emit(event, data, { correlationId });

      // processing message
      debug('processing message');
      await processMsg(input, { ctx: this, emit: emit, event: event, msg: msg });

      // ack the message so that prefetch works
      await channel.ack(msg);
    }
    catch(ex) {
      console.log('Listen failure: %s', ex.stack);

      // ack the message as complete
      channel.nack(msg, false, false);
    }
  }

};