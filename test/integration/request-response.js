/**
 * Integration test to ensure that request/response
 * functionality has not regressed
 */

const sinon  = require('sinon');
const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src').default;
const RABBITMQ = process.env.RABBITMQ || '192.168.99.100';

describe('Integration request & response', () => {
  let service1;
  let service2;

  before(async () => {
    service1 = await goodly({ name: 'test1', brokerPath: RABBITMQ });
    service2 = await goodly({ name: 'test2', brokerPath: RABBITMQ });
  })

  after(async () => {
    await service1.stop();
    await service2.stop();
  });

  it('should wait for reply', async (done) => {
    await service2.on('request', async ({ data, reply }) => {
      await reply(data + ' world');
    });

    let result = await service1.request('request', 'hello');
    expect(result).to.equal('hello world');
    done();
  });

});

