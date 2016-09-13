/**
 * Emit middleware testing to ensure that the emit
 * middleware works as expected and allows events
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

  it('should allow emit middleware to mutate the outbound event', async (done) => {
    try {

      await service1.onEmit('message', async (event, next) => {
        event.data = 'hello ' + event.data;
        await next();
      });

      await service1.onEmit('message', async (event, next) => {
        event.data = event.data + '!';
        await next();
      });

      await service2.on('message', async ({ data }) => {
        try {
          expect(data).to.equal('hello world!');
          done();
        }
        catch(ex) {
          done(ex);
        }
      });

      await service1.emit('message', 'world');
    }
    catch(ex) {
      done(ex);
    }
  });

});


