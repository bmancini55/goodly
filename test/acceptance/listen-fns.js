/**
 * Integration test to validate multiple middleware functions
 * can be applied in same call. This is similar functionality
 * to the listen-middleware acceptance test
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '192.168.99.100';

describe('Acceptance: listen multi fns', () => {
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

    // apply multiple fns to the listen middlware
    await service2.on(
      // path
      'message',

      // fn1
      async (event, next) => {
        hit += 1;
        await next();
        try {
          expect(hit).to.equal(2);
          done();
        } catch (ex) {
          done(ex);
        }

      },

      // fn2
      async () => {
        hit += 1;
      }
    );

    await service1.emit('message', 'world');
  });

});


