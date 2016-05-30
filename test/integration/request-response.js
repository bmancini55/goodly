/**
 * Tests that request/response work as expected
 */

const sinon  = require('sinon');
const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src').default;
const RABBITMQ = process.env.RABBITMQ || '192.168.99.100';

describe('request/response', () => {

  it('should wait for reply', async (done) => {
    const service1 = await goodly({ name: 'test1', brokerPath: RABBITMQ });
    const service2 = await goodly({ name: 'test2', brokerPath: RABBITMQ });

    await service2.on('request', async ({ data, reply }) => {
      await reply(data + ' world');
    });

    let result = await service1.request('request', 'hello');
    expect(result).to.equal('hello world');
    done();
  });

});

