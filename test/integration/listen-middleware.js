/**
 * Integration test to validate listen middlware is wired
 * up as expected.
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src').default;
const RABBITMQ = process.env.RABBITMQ || '192.168.99.100';

describe('Integration listen middleware', () => {
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

  it('should allow multiple middleware functions', async (done) => {
    let hit = 0;

    await service2.on('message', async (event, next) => {
      hit += 1;
      await next();
      hit += 1;
      expect(hit).to.equal(3);
    });

    await service2.on('message', async () => {
      hit += 1;
    });

    await service1.emit('message', 'world');
    done();
  });

});


