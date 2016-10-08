/**
 * Emit middleware testing to ensure that the emit
 * middleware works as expected and allows events
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: deferred emit middleware', () => {
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

  it('should allow deferred emit middleware', async (done) => {
    try {

      // add emit middleware before connection
      await service1.onEmit('message', async (event) => {
        event.data = 'hello ' + event.data;
      });

      await service1.onEmit('message', async (event) => {
        event.data = event.data + '!';
      });

      // start the services
      await service1.start({ brokerPath: RABBITMQ });
      await service2.start({ brokerPath: RABBITMQ });

      // attach a handler
      await service2.on('message', async ({ data }) => {
        try {
          expect(data).to.equal('hello world!');
          done();
        }
        catch(ex) {
          done(ex);
        }
      });

      // emit a message to
      await service1.emit('message', 'world');
    }
    catch(ex) {
      done(ex);
    }
  });

});


