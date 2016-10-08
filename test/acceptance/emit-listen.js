/**
 * Integration test for validating emit + listen works
 * as expected for a simple use case.
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: listen and emit', () => {
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

  it('should listen to emitted events', async (done) => {

    await service2.on('message', async ({ data }) => {
      expect(data).to.equal('hello world');
      done();
    });

    await service1.emit('message', 'hello world');
  });

});


