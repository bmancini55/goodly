/**
 * Integration test to ensure that request/response
 * functionality has not regressed
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: request & response', () => {
  it('should wait for reply', async (done) => {
    let service;

    Promise
      .resolve()
      .then(() => service = goodly({ name: 'test' }))
      .then(() => service.start({ brokerPath: RABBITMQ }))
      .then(() => service.on('request',
        async ({ data, reply }) => {
          await reply(data + ' world');
        }))
      .then(async () => {
        try {
          let result = await service.request('request', 'hello');
          expect(result).to.equal('hello world');
          setTimeout(() => {
            service.stop();
            done();
          }, 500);
        }
        catch(ex) {
          setTimeout(() => {
            service.stop();
            done(ex);
          }, 500);
        }
      })
      .catch(done);
  });

});

