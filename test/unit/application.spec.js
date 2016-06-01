
let amqp = require('amqplib');
let sinon = require('sinon');
let chai = require('chai');
let expect = chai.expect;
let Application = require('../../src/application');

describe('Application', () => {
  let app;
  let channel;

  beforeEach(() => {
    app = new Application({ name: 'test' });
  });

  beforeEach(() => {
    channel = {
      ack: sinon.stub(),
      assertExchange: sinon.stub(),
      assertQueue: sinon.stub(),
      bindExchange: sinon.stub(),
      bindQueue: sinon.stub(),
      consume: sinon.stub(),
      nack: sinon.stub(),
      prefetch: sinon.stub(),
      publish: sinon.stub(),
      sendToQueue: sinon.stub()
    };
    channel.assertQueue.withArgs('', { exclusive: true }).returns({ queue: 'exclusive-queue' });
    sinon.stub(amqp, 'connect').returns({ createChannel: () => channel });
  });

  afterEach(() => {
    amqp.connect.restore();
  });

  describe('.start', () => {
    it('should assert the application exchange', (done) => {
      app
        .start({ brokerPath: 'broker' })
        .then(() => expect(channel.assertExchange.withArgs('app').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should assert the service exchange', (done) => {
      app
        .start({ brokerPath: 'broker' })
        .then(() => expect(channel.assertExchange.withArgs('test').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should bind the service exchange to the application exchange', (done) => {
      app
        .start({ brokerPath: 'broker' })
        .then(() => expect(channel.bindExchange.withArgs('test', 'app').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should assert the service queue', (done) => {
      app
        .start({ brokerPath: 'broker' })
        .then(() => expect(channel.assertQueue.withArgs('test').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should add a 1 hour TTL for the service queue', (done) => {
      app
        .start({ brokerPath: 'broker' })
        .then(() => expect(channel.assertQueue.withArgs('test', { expires: 3600000 }).called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should generate the exclusive queue', (done) => {
      app
        .start({ brokerPath: 'broker' })
        .then(() => expect(channel.assertQueue.withArgs('', { exclusive: true }).called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should set prefetch for the channel', (done) => {
      app
        .start({ brokerPath: 'broker' })
        .then(() => expect(channel.prefetch.withArgs(5).called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should start consuming on the service queue', (done) => {
      app
        .start({ brokerPath: 'broker' })
        .then(() => expect(channel.consume.withArgs('test').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should start consuming on the exclusive queue', (done) => {
      app
        .start({ brokerPath: 'broker' })
        .then(() => expect(channel.consume.withArgs('exclusive-queue').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
  });

});
