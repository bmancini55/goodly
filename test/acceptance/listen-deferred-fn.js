/**
 * Integration test for validating deferred listening
 * works with simple emit + listen
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: deferred listener with single function', () => {
  let service1;
  let service2;

  before(async () => {
    service1 = await goodly({ name: 'test1' });
    service2 = await goodly({ name: 'test2' });
  });

  after(async () => {
    await service1.stop();
    await service2.stop();
  });

  it('should listen to emitted events', async (done) => {

    await service2.on('message', async ({ data }) => {
      expect(data).to.equal('hello world');
      done();
    });

    await service1.start({ brokerPath: RABBITMQ });
    await service2.start({ brokerPath: RABBITMQ });

    await service1.emit('message', 'hello world');
  });

});


