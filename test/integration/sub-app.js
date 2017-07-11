/**
 * Integration tests
 */

const sinon  = require('sinon');
const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Integration', () => {
  let serviceA;
  let serviceB;

  beforeEach(async () => {
    sinon.stub(console, 'error');
    serviceA = goodly({ name: 'serviceA' });
    serviceB = goodly({ name: 'serviceB' });
  });

  afterEach(async () => {
    return new Promise(resolve => {
      setTimeout(() => {
        serviceA.stop();
        serviceB.stop();
        console.error.restore();
        resolve();
      }, 50);
    });
  });

  describe('with sub-app', () => {

    it('should mount in middleware', () => {
      return new Promise(async (resolve, reject) => {

        // create sub-service
        let sub = goodly();

        // create in middleware in sub
        sub.use(async (event, next) => { event.data += ' world'; await next(); });

        // attach sub-service to primary service
        serviceA.use(sub);

        // attach listen for event
        serviceA.on('sub-in-test', ({ data }) => {
          try {
            expect(data).to.equal('hello world');
            resolve();
          }
          catch(ex) {
            reject(ex);
          }
        });

        // start the services
        await serviceA.start({ brokerPath: RABBITMQ });
        await serviceB.start({ brokerPath: RABBITMQ });

        // emit test event
        await serviceB.emit('sub-in-test', 'hello');

      });
    });

    it('should mount out middleware', () => {
      return new Promise(async (resolve, reject) => {

        // create sub-service
        let sub = goodly();

        // create out middleware in sub
        sub.use({ out: async (event, next) => { event.data += ' world'; await next(); }});

        // attach sub-service to primary service
        serviceB.use(sub);

        // attach listener for event
        serviceA.on('sub-out-test', ({ data }) => {
          try {
            expect(data).to.equal('hello world');
            resolve();
          }
          catch(ex) {
            reject(ex);
          }
        });

        // start the services
        await serviceA.start({ brokerPath: RABBITMQ });
        await serviceB.start({ brokerPath: RABBITMQ });

        // emit test event
        await serviceB.emit('sub-out-test', 'hello');

      });
    });

    it('should mount listeners', () => {
      return new Promise(async (resolve, reject) => {

        // create sub-service
        let sub = goodly();

        // attach listen for event
        sub.on('sub-listener-test', ({ data }) => {
          try {
            expect(data).to.equal('hello world');
            resolve();
          }
          catch(ex) {
            reject(ex);
          }
        });

        // attach sub-service to primary service
        serviceA.use(sub);

        // start the services
        await serviceA.start({ brokerPath: RABBITMQ });
        await serviceB.start({ brokerPath: RABBITMQ });

        // emit test event
        await serviceB.emit('sub-listener-test', 'hello world');

      });
    });

  });
});