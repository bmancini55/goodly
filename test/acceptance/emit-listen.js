/**
 * Integration test for validating emit + listen works
 * as expected for a simple use case.
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: listen and emit', () => {
  it('should listen to emitted events', async (done) => {
    let service;

    // start service and emit test event
    Promise
      .resolve()
      .then(() => service = goodly({ name: 'test' }))
      .then(() =>
        service.on('emit-listen', async ({ data }) => {
          try {
            expect(data).to.equal('hello world');
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
      .then(() => service.start({ brokerPath: RABBITMQ }))
      .then(() => service.emit('emit-listen', 'hello world'))
      .catch(done);
  });
});


