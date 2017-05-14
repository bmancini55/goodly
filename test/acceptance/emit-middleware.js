/**
 * Emit middleware testing to ensure that the emit
 * middleware works as expected and allows events
 */

const sinon  = require('sinon');
const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: emit middleware', () => {
  beforeEach(() => {
    sinon.stub(console, 'error');
  });
  afterEach(() => {
    console.error.restore();
  });
  it('should allow emit middleware to mutate the outbound event', (done) => {
    let service;

    Promise
      .resolve()
      .then(() => service = goodly({ name: 'test' }))
      .then(() => service.start({ brokerPath: RABBITMQ }))
      .then(() =>
        service.onEmit('emit-middleware', async (event) => {
          event.data = 'hello ' + event.data;
        })
      )
      .then(() =>
        service.onEmit('emit-middleware', async (event) => {
          event.data = event.data + '!';
        })
      )
      .then(() =>
        service.on('emit-middleware', async ({ data }) => {
          try {
            expect(data).to.equal('hello world!');
            setTimeout(() => {
              service.stop();
              done();
            }, 500);
          }
          catch(ex) {
            setTimeout(() => {
              service.stop();
              done(ex);
            }, 500);
          }
        })
      )
      .then(() => service.emit('emit-middleware', 'world'))
      .catch(done);
  });
});


