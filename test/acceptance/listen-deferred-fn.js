/**
 * Integration test for validating deferred listening
 * works with simple emit + listen
 */

const sinon  = require('sinon');
const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: deferred listener with single function', () => {
  beforeEach(() => {
    sinon.stub(console, 'error');
  });
  afterEach(() => {
    console.error.restore();
  });
  it('should listen to emitted events', (done) => {
    let service;

    Promise
      .resolve()
      .then(() => service = goodly({ name: 'test' }))
      .then(() =>
        service.on('listener-deferred-fn', ({ data }) => {
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
      .then(() => service.emit('listener-deferred-fn', 'hello world'))
      .catch(done);

  });

});


