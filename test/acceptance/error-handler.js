/**
 * Integration test for validating error
 */

const sinon  = require('sinon');
const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: handles incoming  error', () => {
  beforeEach(() => {
    sinon.stub(console, 'log');
  });
  it('handles errors', (done) => {
    let service;

    Promise
      .resolve()
      .then(() => service = goodly({ name: 'test' }))
      .then(() => service.on('handles-error', () => {
        throw new Error('boom');
      }))
      .then(() =>
        service.use((err, event) => { // eslint-disable-line no-unused-vars
          try {
            expect(err.message).to.equal('boom');
            setTimeout(() => {
              sinon.restore(console.log);
              service.stop();
              done();
            }, 500);
          }
          catch(ex) {
            setTimeout(() => {
              sinon.restore(console.log);
              service.stop();
              done(ex);
            }, 500);
          }
        })
      )
      .then(() => service.start({ brokerPath: RABBITMQ }))
      .then(() => service.emit('handles-error'))
      .catch(done);
  });
});


