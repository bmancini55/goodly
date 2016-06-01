
let amqp = require('amqplib');
let sinon = require('sinon');
let chai = require('chai');
let expect = chai.expect;
let Application = require('../../src/application');

describe('Application', () => {
  let app;
  let broker;
  let channel;
  let transport;

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

  beforeEach(() => {
    transport = {
      start: sinon.stub(),
      stop: sinon.stub(),
      prepEmission: sinon.stub().returns({ send: 'send', headers: { }}),
      requestData: sinon.stub()
    }
  })

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

  describe('.emit', () => {
    const start = async () => {
      await app.start({ brokerPath: 'broker' });
      await app.set('transport', transport);
      return start;
    };
    describe('if transport is called', () => {
      it('should pass the service', (done) => {
        start()
          .then(() => app.emit('test', 'data'))
          .then(() => expect(transport.prepEmission.args[0][0].service).to.deep.equal(app))
          .then(() => done())
          .catch(done);
      });
      it('should pass the path', (done) => {
        start()
          .then(() => app.emit('test', 'data'))
          .then(() => expect(transport.prepEmission.args[0][0].path).to.equal('test'))
          .then(() => done())
          .catch(done);
      });
      it('should pass the correlationId', (done) => {
        start()
          .then(() => app.emit('test', 'data'))
          .then(() => expect(transport.prepEmission.args[0][0].correlationId).is.not.undefined)
          .then(() => done())
          .catch(done);
      });
      it('should pass the raw data', (done) => {
        start()
          .then(() => app.emit('test', 'data'))
          .then(() => expect(transport.prepEmission.args[0][0].data).to.equal('data'))
          .then(() => done())
          .catch(done);
      });
      it('should pass the reply queue', (done) => {
        start()
          .then(() => app.emit('test', 'data', { replyTo: 'replyHere' }))
          .then(() => expect(transport.prepEmission.args[0][0].replyTo).to.equal('replyHere'))
          .then(() => done())
          .catch(done);
      });
    });
    // describe('when sending to a queue directly', () => {
    //   it('should include the correlationId', (done) => {

    //   });
    //   it('should convert the data to a buffer', (done) => {

    //   });
    //   it('should merge user supplied headers', (done) => {

    //   });
    //   it('should apply content-type header based on the buffer', (done) => {

    //   });
    //   it('should apply transport headers', (done) => {

    //   });
    // });
    // describe('when broadcasting message', () => {
    //   it('should include the correlationId', (done) => {

    //   });
    //   it('should convert the data to a buffer', (done) => {

    //   });
    //   it('should merge user supplied headers', (done) => {

    //   });
    //   it('should apply content-type header based on the buffer', (done) => {

    //   });
    //   it('should apply transport headers', (done) => {

    //   });
    // });
  });

});
