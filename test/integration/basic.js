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
    serviceA = goodly({ name: 'serviceA' });
    serviceB = goodly({ name: 'serviceB' });
  });

  afterEach(async () => {
    return new Promise(resolve => {
      setTimeout(() => {
        serviceA.stop();
        serviceB.stop();
        resolve();
      }, 50);
    });
  });

  describe('when listening', () => {

    it('should handle events in cascade order', () => {
      return new Promise(async (resolve, reject) => {

        // attach middleware
        serviceA.use('listen-middleware', async (event, next) => {
          event.data += 1;
          await next();
        });

        // attach handler
        serviceA.on('listen-middleware', async (event) => {
          try {
            expect(event.data).to.equal(2);
            resolve();
          }
          catch(ex) {
            reject(ex);
          }
        });

        // start the services
        await serviceA.start({ brokerPath: RABBITMQ });
        await serviceB.start({ brokerPath: RABBITMQ });

        // emit event
        await serviceB.emit('listen-middleware', 1);

      });
    });

    it('should handle events in cascade order with multiple functions', () => {
      return new Promise(async (resolve, reject) => {

        // attach mulitple middleware
        serviceA.use('listen-multi-middleware',
          async (event, next) => { event.data += 1; await next(); },
          async (event, next) => { event.data += 1; await next(); }
        );

        // attach final listener
        serviceA.on('listen-multi-middleware', (event) => {
          try {
            expect(event.data).to.equal(3);
            resolve();
          }
          catch(ex) {
            reject(ex);
          }
        });

        // start the services
        await serviceA.start({ brokerPath: RABBITMQ });
        await serviceB.start({ brokerPath: RABBITMQ });

        // emit event
        await serviceB.emit('listen-multi-middleware', 1);

      });
    });

    it('should allow error handling middleware to trap exceptions', () => {
      return new Promise(async (resolve, reject) => {

        // add error middleware
        serviceA.use((err, event, next) => { // eslint-disable-line no-unused-vars
          try {
            expect(err.message).to.equal('boom');
            resolve();
          }
          catch(ex) {
            reject(ex);
          }
        });

        // handler throws an error
        serviceA.on('throws-error', () => {
          throw new Error('boom');
        });

        // start the services
        await serviceA.start({ brokerPath: RABBITMQ });
        await serviceB.start({ brokerPath: RABBITMQ });

        // emit message
        await serviceB.emit('throws-error');

      });
    });

  });

  describe('when emitting', () => {

    it('should allow emit middleware to mutate the outbound event', () => {
      return new Promise(async (resolve, reject) => {

        // listen for emitted event and validate
        serviceA.on('emit-middleware', ({ data }) => {
          try {
            expect(data).to.equal('hello world!');
            resolve();
          }
          catch(ex) {
            reject(ex);
          }
        });

        // attach first emit middleware
        serviceB.use('emit-middleware', { out: async (event, next) => {
          event.data = 'hello ' + event.data;
          await next();
        }});

        // attach second emit middlware
        serviceB.use('emit-middleware', { out: async (event, next) => {
          event.data = event.data + '!';
          await next();
        }});

        // start the services
        await serviceA.start({ brokerPath: RABBITMQ });
        await serviceB.start({ brokerPath: RABBITMQ });

        // emit message that will go through emit middleware
        await serviceB.emit('emit-middleware', 'world');

      });
    });

  });

  describe('when request is made ', () => {

    it('should wait for the response', async () => {

      // add request handler
      serviceA.on('please-reply', async ({ data, reply }) => {
        await reply(data + ' world');
      });

      // start the services
      await serviceA.start({ brokerPath: RABBITMQ });
      await serviceB.start({ brokerPath: RABBITMQ });

      // make request and wait for response
      let response = await serviceB.request('please-reply', 'hello');

      // verify response
      expect(response).to.equal('hello world');

    });

    it('should handle errors in response', async () => {

      // request handler throws exception
      serviceA.on('reply-error', () => {
        throw new Error('boom');
      });

      // start the services
      await serviceA.start({ brokerPath: RABBITMQ });
      await serviceB.start({ brokerPath: RABBITMQ });

      // emit request and trap error
      try {
        await serviceB.request('reply-error', 'hello');
        throw new Error('should not get here');
      }
      catch(ex) {
        expect(ex.message).to.equal('boom');
      }

    });

  });

});