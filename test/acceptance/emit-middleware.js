/**
 * Emit middleware testing
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '192.168.99.100';

describe('Acceptance: emit middleware', () => {
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
    try {
      await service2.on('message', async ({ data }) => {
        try {
          expect(data).to.equal('hello world');
          done();
        }
        catch(ex) {
          done(ex);
        }
      });

      await service1.onEmit('message', (event) => {
        event.data = 'hello ' + event.data;
      });

      await service1.emit('message', 'world');
    }
    catch(ex) {
      done(ex);
    }
  });

});


