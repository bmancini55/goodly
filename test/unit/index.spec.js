

let sinon       = require('sinon');
let chai        = require('chai');
let expect      = chai.expect;
let factory     = require('../../src/index');
let Application = require('../../src/application');

describe('Goodly factory', () => {

  describe('when no auto-start', () => {
    it('should return unstarted service immediately', () => {
      let svc = factory({ name: 'test' });
      expect(svc._channel).to.be.undefined;
    });
  });

  describe('when auto-start', () => {
    let stubStart, stubStop;
    beforeEach(() => {
      stubStart = sinon.stub(Application.prototype, 'start');
      stubStop  = sinon.stub(Application.prototype, 'stop');
    });

    afterEach(() => {
      stubStart.restore();
      stubStop.restore();
    });

    it('should execute the callback prior to starting', (done) => {
      let callback = sinon.stub();
      factory({ name: 'test', brokerPath: 'test'}, callback)
        .then(() => expect(callback.called).to.be.true)
        .then(() => done())
        .catch(done);
    });

    it('should start the service', (done) => {
      factory({ name: 'test', brokerPath: 'broker' })
        .then(() => expect(stubStart.called).to.be.true)
        .then(() => expect(stubStart.args[0][0].brokerPath).to.equal('broker'))
        .then(() => done())
        .catch(done);
    });

    it('should resolve with the service', (done) => {
      factory({ name: 'test', brokerPath: 'broker' })
        .then((svc) => expect(svc).to.be.instanceOf(Application))
        .then(() => done())
        .catch(done);
    });

    describe('when there is an error', () => {
      it('should stop the service', (done) => {
        stubStart.throws('Boom');
        factory({ name: 'test', brokerPath: 'broker' })
          .catch(() => {
            expect(stubStop.called).to.be.true;
            done();
          })
          .catch(done);
      });
    });

  });

});

