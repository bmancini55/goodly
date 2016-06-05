/**
 * Integration test for validating emit + listen works
 * as expected for a simple use case.
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '192.168.99.100';

describe('Acceptance: deferred listeners', () => {
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
    });

    await service1.start({ brokerPath: RABBITMQ });
    await service2.start({ brokerPath: RABBITMQ });

    await service1.emit('message', 'hello world');
    done();
  });

});


