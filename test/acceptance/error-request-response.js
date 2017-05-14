/**
 * Integration test for validating error
 */

const sinon  = require('sinon');
const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: handles request/response error', () => {
  beforeEach(() => {
    sinon.stub(console, 'log');
    sinon.stub(console, 'error');
  });
  afterEach(() => {
    console.error.restore();
  });
  it('handles errors', (done) => {
    let service;

    Promise
      .resolve()
      .then(() => service = goodly({ name: 'test' }))
      .then(() => service.on('request', () => {
        throw new Error('boom');
      }))
      .then(() => service.start({ brokerPath: RABBITMQ }))
      .then(async () => {
        let assertError;
        try {
          await service.request('request', 'hello');
          throw new Error('should not get here');
        }
        catch(err) {
          // error will either be 'boom' as expected or it will
          // 'should not get here' or some other unexpected error
          // in either case, we will pass that error to done
          if(err.message !== 'boom') {
            assertError = err;
          }
        }
        finally {
          setTimeout(() => {
            console.log.restore();
            service.stop();
            done(assertError);
          }, 500);
        }
      })
      .catch(done);
  });
});


