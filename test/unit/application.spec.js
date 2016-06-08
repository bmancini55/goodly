
let amqp = require('amqplib');
let sinon = require('sinon');
let chai = require('chai');
let expect = chai.expect;
let Application = require('../../src/application');

describe('Application', () => {
  let app;
  let broker;
  let channel;

  const start = async () => {
    await app.start({ brokerPath: 'broker' });
    return app;
  };

  beforeEach(() => {
    app = new Application({ name: 'test' });
  });

  beforeEach(() => {
    broker = {
      createChannel: () => channel,
      close: sinon.stub()
    };
  });

  beforeEach(() => {
    channel = {
      ack: sinon.stub(),
      assertExchange: sinon.stub(),
      assertQueue: sinon.stub(),
      bindExchange: sinon.stub(),
      bindQueue: sinon.stub(),
      close: sinon.stub(),
      consume: sinon.stub(),
      nack: sinon.stub(),
      prefetch: sinon.stub(),
      publish: sinon.stub(),
      sendToQueue: sinon.stub()
    };
    // we need to return the queue so that star works correctly
    channel.assertQueue.withArgs('', { exclusive: true }).returns({ queue: 'exclusive-queue' });
  });

  beforeEach(() => {
    // stub connect so that it returns our fake broker
    sinon.stub(amqp, 'connect').returns(broker);
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

  describe('.stop', () => {
    describe('when broker is connected', () => {
      it('should close the broker', (done) => {
        app
          .start({ brokerPath: 'broker' })
          .then(() => app.stop())
          .then(() => expect(broker.close.called).to.be.true)
          .then(() => done())
          .catch(done);
      });
    });
  });

  describe('.channel', () => {
    describe('when connected', () => {
      it('should return the channel', (done) => {
        app
          .start({ brokerPath: 'broker' })
          .then(() => app.channel())
          .then((channel) => expect(channel).to.not.be.undefined)
          .then(() => done())
          .catch(done);
      });
    });
    describe('when not connected', () => {
      it('should throw an exception', () => {
        expect(() => app.channel()).to.throw('Execute start before attempting to use framework');
      });
    });
  });

  describe('.emit', () => {
    describe('when sending to a queue directly', () => {
      it('should call sendToQueue', (done) => {
        start()
          .then(() => app.emit('test', 'data', { }, 'direct-queue'))
          .then(() => expect(channel.sendToQueue.withArgs('direct-queue').called).to.be.true)
          .then(() => done())
          .catch(done);
      });
      it('should convert the data to a buffer', (done) => {
        start()
          .then(() => app.emit('test', 'data', { }, 'direct-queue'))
          .then(() => expect(channel.sendToQueue.args[0][1]).to.deep.equal(Buffer.from('data')))
          .then(() => done())
          .catch(done);
      });
      it('should include the correlationId', (done) => {
        start()
          .then(() => app.emit('test', 'data', { }, 'direct-queue'))
          .then(() => expect(channel.sendToQueue.args[0][2].correlationId).is.not.undefined)
          .then(() => done())
          .catch(done);
      });
      it('should merge user supplied headers', (done) => {
        start()
          .then(() => app.emit('test', 'data', { headers: { test: 'header' } }, 'direct-queue'))
          .then(() => expect(channel.sendToQueue.args[0][2].headers.test).to.equal('header'))
          .then(() => done())
          .catch(done);
      });
      it('should apply content-type header based on the buffer', (done) => {
        start()
          .then(() => app.emit('test', 'data', { }, 'direct-queue'))
          .then(() => expect(channel.sendToQueue.args[0][2].headers.contentType).to.equal('string'))
          .then(() => done())
          .catch(done);
      });
    });
    describe('when broadcasting message', () => {
      it('should call publish', (done) => {
        start()
          .then(() => app.emit('test', 'data', { }))
          .then(() => expect(channel.publish.withArgs('app', 'test').called).to.be.true)
          .then(() => done())
          .catch(done);
      });
      it('should convert the data to a buffer', (done) => {
        start()
          .then(() => app.emit('test', 'data', { }))
          .then(() => expect(channel.publish.args[0][2]).to.deep.equal(Buffer.from('data')))
          .then(() => done())
          .catch(done);
      });
      it('should include the correlationId', (done) => {
        start()
          .then(() => app.emit('test', 'data', { }))
          .then(() => expect(channel.publish.args[0][3].correlationId).is.not.undefined)
          .then(() => done())
          .catch(done);
      });
      it('should merge user supplied headers', (done) => {
        start()
          .then(() => app.emit('test', 'data', { headers: { test: 'header' } }))
          .then(() => expect(channel.publish.args[0][3].headers.test).to.equal('header'))
          .then(() => done())
          .catch(done);
      });
      it('should apply content-type header based on the buffer', (done) => {
        start()
          .then(() => app.emit('test', 'data', { }))
          .then(() => expect(channel.publish.args[0][3].headers.contentType).to.equal('string'))
          .then(() => done())
          .catch(done);
      });
    });
  });

  describe('.on', () => {
    describe('when not connected to broker', () => {
      it('should add to deferred bindings', (done) => {
        app
          .on('path', 'func')
          .then(() => expect(app._deferredBindings[0]).to.deep.equal(['path', 'func']))
          .then(() => done())
          .catch(done);
      });
    });
    describe('when connected to broker', () => {
      it('should add listener to the router', (done) => {
        start()
          .then(() => app.on('path', function func() { }))
          .then(() => expect(app._router.stack[0].path).to.equal('path'))
          .then(() => done())
          .catch(done);
      });
      it('should bind the queue', (done) => {
        start()
          .then(() => app.on('path', function func() { }))
          .then(() => expect(channel.bindQueue.args[0]).to.deep.equal(['test', 'test', 'path']))
          .then(() => done())
          .catch(done);
      });
    });
    describe('when called multiple times', () => {
      it('should add listener to the router', (done) => {
        start()
          .then(() => app.on('path', function one() { }))
          .then(() => app.on('path', function two() { }))
          .then(() => {
            expect(app._router.stack.length).to.equal(2);
            expect(app._router.stack[0].name).to.equal('one');
            expect(app._router.stack[1].name).to.equal('two');
          })
          .then(() => done())
          .catch(done);
      });
      it('should only bind to the queue once', (done) => {
        start()
          .then(() => app.on('path', function one() { }))
          .then(() => app.on('path', function two() { }))
          .then(() => expect(channel.bindQueue.callCount).to.equal(1))
          .then(() => done())
          .catch(done);
      });
    });
  });

});
