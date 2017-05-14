
let sinon = require('sinon');
let chai = require('chai');
let expect = chai.expect;
let Application = require('../../src/application');

describe('Application', () => {
  let app;
  let amqp;
  let broker;
  let channel;

  before(() => {
    sinon.stub(console, 'error');
  });

  after(() => {
    console.error.restore();
  });

  beforeEach(() => {
    app = new Application({ name: 'test' });
  });

  beforeEach(() => {
    amqp = {
      connect: () => broker
    };
  });

  beforeEach(() => {
    broker = {
      createChannel: () => channel,
      close: sinon.stub(),
      on: sinon.stub(),
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


  const start = async () => {
    await app.start({ brokerPath: 'broker', amqp, retryMultiplier: 1 });
    return app;
  };


  describe('.start', () => {
    it('should assert the application exchange', (done) => {
      start()
        .then(() => expect(channel.assertExchange.withArgs('app').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should assert the service exchange', (done) => {
      start()
        .then(() => expect(channel.assertExchange.withArgs('test').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should bind the service exchange to the application exchange', (done) => {
      start()
        .then(() => expect(channel.bindExchange.withArgs('test', 'app').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should assert the service queue', (done) => {
      start()
        .then(() => expect(channel.assertQueue.withArgs('test').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should add a 1 hour TTL for the service queue', (done) => {
      start()
        .then(() => expect(channel.assertQueue.withArgs('test', { expires: 3600000 }).called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should generate the exclusive queue', (done) => {
      start()
        .then(() => expect(channel.assertQueue.withArgs('', { exclusive: true }).called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should set prefetch for the channel', (done) => {
      start()
        .then(() => expect(channel.prefetch.withArgs(5).called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should start consuming on the service queue', (done) => {
      start()
        .then(() => expect(channel.consume.withArgs('test').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should start consuming on the exclusive queue', (done) => {
      start()
        .then(() => expect(channel.consume.withArgs('exclusive-queue').called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should attach a handler for broker errors', (done) => {
      start()
        .then(() => expect(broker.on.getCall(0).args[0]).be.equal('error'))
        .then(() => done())
        .catch(done);
    });
    it('should return the service', (done) => {
      start()
        .then((service) => expect(service).to.equal(app))
        .then(() => done())
        .catch(done);
    });

    describe('when connection error', () =>{
      beforeEach(() => {
        amqp.connect = sinon.stub();
        amqp.connect.onCall(0).rejects(new Error('Boom'));
        amqp.connect.onCall(1).rejects(new Error('Boom 2'));
        amqp.connect.onCall(2).resolves(broker);
      });
      it('should retry connection', (done) => {
        start({ retryMultiplier: 1})
          .then(() => expect(amqp.connect.callCount).to.equal(3))
          .then(() => done())
          .catch(done);
      });
    });

    describe('when broker error', () => {
      beforeEach(() => {
        amqp.connect = sinon.stub().resolves(broker);
      });
      it('should reestablish connection', (done) => {
        start({ retryMultiplier: 1})
          .then(() => broker.on.getCall(0).args[1](new Error('Boom')))
          .then(() => expect(amqp.connect.callCount).to.equal(2))
          .then(() => done())
          .catch(done);
      });
    });
  });

  describe('.stop', () => {
    describe('when broker is connected', () => {
      it('should close the broker', (done) => {
        start()
          .then(() => app.stop())
          .then(() => expect(broker.close.called).to.be.true)
          .then(() => done())
          .catch(done);
      });
    });
    describe('when broker not connected', () => {
      it('should do nothing', (done) => {
        app
          .stop()
          .then(() => expect(broker.close.called).to.be.false)
          .then(() => done())
          .catch(done);
      });
    });
  });

  describe('.channel', () => {
    describe('when connected', () => {
      it('should return the channel', (done) => {
        start()
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
          .then(() => app.emit('test', 'data', { sendToQueue: 'direct-queue' }))
          .then(() => expect(channel.sendToQueue.withArgs('direct-queue').called).to.be.true)
          .then(() => done())
          .catch(done);
      });
      it('should convert the data to a buffer', (done) => {
        start()
          .then(() => app.emit('test', 'data', { sendToQueue: 'direct-queue' }))
          .then(() => expect(channel.sendToQueue.args[0][1]).to.deep.equal(Buffer.from('data')))
          .then(() => done())
          .catch(done);
      });
      it('should include the correlationId', (done) => {
        start()
          .then(() => app.emit('test', 'data', { sendToQueue: 'direct-queue' }))
          .then(() => expect(channel.sendToQueue.args[0][2].correlationId).is.not.undefined)
          .then(() => done())
          .catch(done);
      });
      it('should merge user supplied headers', (done) => {
        start()
          .then(() => app.emit('test', 'data', { headers: { test: 'header' }, sendToQueue: 'direct-queue' }))
          .then(() => expect(channel.sendToQueue.args[0][2].headers.test).to.equal('header'))
          .then(() => done())
          .catch(done);
      });
      it('should apply content-type header based on the buffer', (done) => {
        start()
          .then(() => app.emit('test', 'data', { sendToQueue: 'direct-queue' }))
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
      describe('with single fn', () => {
        it('should add to deferred bindings', (done) => {
          app
            .on('path', 'func')
            .then(() => expect(app._deferredBindings[0]).to.deep.equal(['on', 'path', 'func']))
            .then(() => done())
            .catch(done);
        });
      });
      describe('with multiple fns', () => {
        it('should add all fns to deferred bindings', (done) => {
          app
            .on('path', 'fn1', 'fn2')
            .then(() => expect(app._deferredBindings[0]).to.deep.equal(['on', 'path', 'fn1', 'fn2']))
            .then(() => done())
            .catch(done);
        });
      });
    });
    describe('when connected to broker', () => {
      describe('with single fn', () => {
        it('should add listener to the router', (done) => {
          start()
            .then(() => app.on('path', function func() { }))
            .then(() => expect(app._inRouter.stack[1].path).to.equal('path'))
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
      describe('with multple fns', () => {
        it('should add listeners to the router', (done) => {
          start()
            .then(() => app.on('path', function fn1() { }, function fn2() { }))
            .then(() => expect(app._inRouter.stack[1].path).to.equal('path'))
            .then(() => expect(app._inRouter.stack[1].name).to.equal('fn1'))
            .then(() => expect(app._inRouter.stack[2].path).to.equal('path'))
            .then(() => expect(app._inRouter.stack[2].name).to.equal('fn2'))
            .then(() => done())
            .catch(done);
        });
        it('should bind the queue', (done) => {
          start()
            .then(() => app.on('path', function fn1() { }, function fn2() { }))
            .then(() => expect(channel.bindQueue.args[0]).to.deep.equal(['test', 'test', 'path']))
            .then(() => done())
            .catch(done);
        });
      });
    });
    describe('when called multiple times', () => {
      it('should add listener to the router', (done) => {
        start()
          .then(() => app.on('path', function one() { }))
          .then(() => app.on('path', function two() { }))
          .then(() => {
            expect(app._inRouter.stack[1].name).to.equal('one');
            expect(app._inRouter.stack[2].name).to.equal('two');
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

  describe('.onEmit', () => {
    describe('when not connected to broker', () => {
      describe('with single fn', () => {
        it('should add to deferred bindings', (done) => {
          app
            .onEmit('path', 'func')
            .then(() => expect(app._deferredBindings[0]).to.deep.equal(['onEmit', 'path', 'func']))
            .then(() => done())
            .catch(done);
        });
      });
      describe('with multiple fns', () => {
        it('should add all fns to deferred bindings', (done) => {
          app
            .onEmit('path', 'fn1', 'fn2')
            .then(() => expect(app._deferredBindings[0]).to.deep.equal(['onEmit', 'path', 'fn1', 'fn2']))
            .then(() => done())
            .catch(done);
        });
      });
    });
    describe('when connected to broker', () => {
      describe('with single fn', () => {
        it('should add listener to the router', (done) => {
          start()
            .then(() => app.onEmit('path', function func() { }))
            .then(() => expect(app._outRouter.stack[1].path).to.equal('path'))
            .then(() => done())
            .catch(done);
        });
      });
      describe('with multple fns', () => {
        it('should add listeners to the router', (done) => {
          start()
            .then(() => app.onEmit('path', function fn1() { }, function fn2() { }))
            .then(() => expect(app._outRouter.stack[1].path).to.equal('path'))
            .then(() => expect(app._outRouter.stack[1].name).to.equal('fn1'))
            .then(() => expect(app._outRouter.stack[2].path).to.equal('path'))
            .then(() => expect(app._outRouter.stack[2].name).to.equal('fn2'))
            .then(() => done())
            .catch(done);
        });
      });
    });
  });

  describe('.request', () => {
    it('should emit an event with the exclusive queue', (done) => {
      sinon.stub(app, 'emit');
      start()
        .then(() => {
          process.nextTick(() => app._requests['1'](null, 'response_data'));
          return app.request('path', 'request_data', { correlationId: '1' });
        })
        .then(() => expect(app.emit.args[0]).to.deep.equal(['path', 'request_data', { correlationId: '1', replyTo: 'exclusive-queue' }]))
        .then(() => done())
        .catch(done);
    });
    it('should return a promise resolve with the value when successful', (done) => {
      start()
        .then(() => {
          process.nextTick(() => app._requests['1'](null, 'response_data'));
          return app.request('path', 'request_data', { correlationId: '1' });
        })
        .then((response) => expect(response).to.equal('response_data'))
        .then(() => done())
        .catch(done);
    });
    it('should return a promise rejection when there is an error', (done) => {
      start()
        .then(() => {
          process.nextTick(() => app._requests['1']('error'));
          return app.request('path', 'request_data', { correlationId: '1' });
        })
        .catch((err) => expect(err).to.equal('error'))
        .then(() => done())
        .catch(done);
    });
  });

});
