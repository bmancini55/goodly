/**
 * Integration test to ensure that request/response
 * functionality has not regressed
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: request & response', () => {
  let service1;
  let service2;

  before(async () => {
    service1 = await goodly({ name: 'test1', brokerPath: RABBITMQ });
    service2 = await goodly({ name: 'test2', brokerPath: RABBITMQ });
  });

  after(async () => {
    await service1.stop();
    await service2.stop();
  });

  it('should wait for reply', async (done) => {
    try {
      await service2.on('request', async ({ data, reply }) => {
        await reply(data + ' world');
      });

      let result = await service1.request('request', 'hello');
      expect(result).to.equal('hello world');
      done();
    }
    catch(ex) {
      done(ex);
    }
  });

});

