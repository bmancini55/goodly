
let sinon = require('sinon');
let chai = require('chai');
let expect = chai.expect;
let Router = require('../../src/router');
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
    it('should bind queus for handled events', (done) => {
      app.on('path', function func() { });
      start()
        .then(() => expect(channel.bindQueue.args[0]).to.deep.equal(['test', 'test', 'path']))
        .then(() => done())
        .catch(done);
    });
    it('should not duplicate binding queues for handles events', (done) => {
      app.on('path', function func1() { });
      app.on('path', function func2() { });
      start()
        .then(() => app.on('path', function one() { }))
        .then(() => app.on('path', function two() { }))
        .then(() => expect(channel.bindQueue.callCount).to.equal(1))
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
    describe('with single fn', () => {
      it('should add to deferred bindings', () => {
        app.on('path', 'func');
        expect(app._deferredBindings[0]).to.equal('path');
      });
      it('should add listener to the router', () => {
        app.on('path', function func() { });
        expect(app._inRouter.stack[0].path).to.equal('path');
      });
    });
    describe('with multiple fns', () => {
      it('should add all fns to deferred bindings', () => {
        app.on('path', 'fn1', 'fn2');
        expect(app._deferredBindings[0]).to.equal('path');
      });
      it('should add listeners to the router', () => {
        app.on('path', function fn1() { }, function fn2() { });
        expect(app._inRouter.stack[0].path).to.equal('path');
        expect(app._inRouter.stack[0].name).to.equal('fn1');
        expect(app._inRouter.stack[1].path).to.equal('path');
        expect(app._inRouter.stack[1].name).to.equal('fn2');
      });
    });
    describe('when called multiple times', () => {
      it('should add listener to the router', () => {
        app.on('path', function one() { });
        app.on('path', function two() { });
        expect(app._inRouter.stack[0].name).to.equal('one');
        expect(app._inRouter.stack[1].name).to.equal('two');
      });
    });
  });

  describe('.use', () => {
    describe('with path', () => {
      describe('when no function', () => {
        it('should throw exception when no function', () => {
          expect(() => app.use('test')).to.throw(TypeError);
        });
      });
      describe('when param object with \'in\' middleware', () => {
        it('should add to inRouter when \'in\' is function', () => {
          app.use('test', { in: function fn1() { } });
          expect(app._inRouter.stack[0].path).to.equal('test');
          expect(app._inRouter.stack[0].name).to.equal('fn1');
        });
        it('should add each to inRouter when \'in\' is array', () => {
          app.use('test', { in: [ function fn1() { }, function fn2() { } ] });
          expect(app._inRouter.stack[0].path).to.equal('test');
          expect(app._inRouter.stack[0].name).to.equal('fn1');
          expect(app._inRouter.stack[1].path).to.equal('test');
          expect(app._inRouter.stack[1].name).to.equal('fn2');
        });
        it('should throw TypeError when \'in\' is array with non function', () => {
          expect(() => app.use('test', { in: [ 1 ] })).to.throw(TypeError);
        });
        it('should throw TypeError when \'in\' is not a function or array', () => {
          expect(() => app.use('test', { in: 1 })).to.throw(TypeError);
        });
      });
      describe('when param object with out middleware', () => {
        it('should add to outRouter when \'out\' is function', () => {
          app.use('test', { out: function fn1() { } });
          expect(app._outRouter.stack[0].path).to.equal('test');
          expect(app._outRouter.stack[0].name).to.equal('fn1');
        });
        it('should add each to outRouter when \'out\' is array', () => {
          app.use('test', { out: [ function fn1() { }, function fn2() { } ] });
          expect(app._outRouter.stack[0].path).to.equal('test');
          expect(app._outRouter.stack[0].name).to.equal('fn1');
          expect(app._outRouter.stack[1].path).to.equal('test');
          expect(app._outRouter.stack[1].name).to.equal('fn2');
        });
        it('should throw TypeError when \'in\' is array with non function', () => {
          expect(() => app.use('test', { in: [ 1 ] })).to.throw(TypeError);
        });
        it('should throw TypeError when \'in\' is not a function or array', () => {
          expect(() => app.use('test', { in: 1 })).to.throw(TypeError);
        });
      });
      describe('when single function', () => {
        it('should add to inRouter', () => {
          app.use('test', function fn1() { });
          expect(app._inRouter.stack[0].path).to.equal('test');
          expect(app._inRouter.stack[0].name).to.equal('fn1');
        });
        it('should throw TypeError when not a function', () => {
          expect(() => app.use('test', 1)).to.throw(TypeError);
        });
      });
      describe('when multiple functions', () => {
        it('should add each function to inRouter', () => {
          app.use('test', function fn1() { }, function fn2() { });
          expect(app._inRouter.stack[0].path).to.equal('test');
          expect(app._inRouter.stack[0].name).to.equal('fn1');
          expect(app._inRouter.stack[1].path).to.equal('test');
          expect(app._inRouter.stack[1].name).to.equal('fn2');
        });
        it('should throw TypeError when not a function', () => {
          expect(() => app.use('test', function fn1() { }, 1)).to.throw(TypeError);
        });
      });
      describe('when sub-application', () => {
        it('should throw execption', () => {
          let sub = new Application({ name: 'sub' });
          expect(() => app.use('test', sub)).to.throw(TypeError);
        });
      });
    });
    describe('without path', () => {
      describe('when no function', () => {
        it('should throw exception when no function', () => {
          expect(() => app.use()).to.throw(TypeError);
        });
      });
      describe('when param object with \'in\' middleware', () => {
        it('should add to inRouter when \'in\' is function', () => {
          app.use({ in: function fn1() { } });
          expect(app._inRouter.stack[0].path).to.equal('#');
          expect(app._inRouter.stack[0].name).to.equal('fn1');
        });
        it('should add each to inRouter when \'in\' is array', () => {
          app.use({ in: [ function fn1() { }, function fn2() { } ] });
          expect(app._inRouter.stack[0].path).to.equal('#');
          expect(app._inRouter.stack[0].name).to.equal('fn1');
          expect(app._inRouter.stack[1].path).to.equal('#');
          expect(app._inRouter.stack[1].name).to.equal('fn2');
        });
        it('should throw TypeError when \'in\' is array with non function', () => {
          expect(() => app.use({ in: [ 1 ] })).to.throw(TypeError);
        });
        it('should throw TypeError when \'in\' is not a function or array', () => {
          expect(() => app.use({ in: 1 })).to.throw(TypeError);
        });
      });
      describe('when param object with out middleware', () => {
        it('should add to outRouter when \'out\' is function', () => {
          app.use({ out: function fn1() { } });
          expect(app._outRouter.stack[0].path).to.equal('#');
          expect(app._outRouter.stack[0].name).to.equal('fn1');
        });
        it('should add each to outRouter when \'out\' is array', () => {
          app.use({ out: [ function fn1() { }, function fn2() { } ] });
          expect(app._outRouter.stack[0].path).to.equal('#');
          expect(app._outRouter.stack[0].name).to.equal('fn1');
          expect(app._outRouter.stack[1].path).to.equal('#');
          expect(app._outRouter.stack[1].name).to.equal('fn2');
        });
        it('should throw TypeError when \'in\' is array with non function', () => {
          expect(() => app.use({ in: [ 1 ] })).to.throw(TypeError);
        });
        it('should throw TypeError when \'in\' is not a function or array', () => {
          expect(() => app.use({ in: 1 })).to.throw(TypeError);
        });
      });
      describe('when single function', () => {
        it('should add to inRouter', () => {
          app.use(function fn1() { });
          expect(app._inRouter.stack[0].path).to.equal('#');
          expect(app._inRouter.stack[0].name).to.equal('fn1');
        });
        it('should throw TypeError when not a function', () => {
          expect(() => app.use('#', 1)).to.throw(TypeError);
        });
      });
      describe('when multiple functions', () => {
        it('should add each function to inRouter', () => {
          app.use(function fn1() { }, function fn2() { });
          expect(app._inRouter.stack[0].path).to.equal('#');
          expect(app._inRouter.stack[0].name).to.equal('fn1');
          expect(app._inRouter.stack[1].path).to.equal('#');
          expect(app._inRouter.stack[1].name).to.equal('fn2');
        });
        it('should throw TypeError when not a function', () => {
          expect(() => app.use(function fn1() { }, 1)).to.throw(TypeError);
        });
      });
      describe('when application', () => {
        let sub;
        beforeEach(() => {
          sub = new Application({ name: 'sub' });
        });
        it('should attach listener to router', () => {
          sub.on('test', function fn() { });
          app.use(sub);
          expect(app._inRouter.stack[0].path).to.equal('test');
          expect(app._inRouter.stack[0].name).to.equal('fn');
        });
        it('should attach listenered to bindings', () => {
          sub.on('test', function fn() { });
          app.use(sub);
          expect(app._deferredBindings[0]).to.equal('test');
        });
        it('should attach include in middleware', () => {
          sub.use(function fn1() { });
          sub.use('test', function fn2() { });
          app.use(sub);
          expect(app._inRouter.stack[0].path).to.equal('#');
          expect(app._inRouter.stack[0].name).to.equal('fn1');
          expect(app._inRouter.stack[1].path).to.equal('test');
          expect(app._inRouter.stack[1].name).to.equal('fn2');
        });
        it('should attach include out middleware', () => {
          sub.use({ out: function fn1() { } });
          sub.use('test', { out: function fn2() { } });
          app.use(sub);
          expect(app._outRouter.stack[0].path).to.equal('#');
          expect(app._outRouter.stack[0].name).to.equal('fn1');
          expect(app._outRouter.stack[1].path).to.equal('test');
          expect(app._outRouter.stack[1].name).to.equal('fn2');
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
