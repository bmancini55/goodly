/**
 * Integration test to validate multiple middleware functions
 * can be applied in same call. This is similar functionality
 * to the listen-middleware acceptance test
 */

const sinon  = require('sinon');
const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: listen multi fns', () => {
  beforeEach(() => {
    sinon.stub(console, 'error');
  });
  afterEach(() => {
    console.error.restore();
  });
  it('should allow multiple middleware functions', (done) => {
    let service;
    let hit = 0;

    Promise
      .resolve()
      .then(() => service = goodly({ name: 'test' }))
      .then(() => service.start({ brokerPath: RABBITMQ }))
      .then(() => service.on('listen-multi-fns',
        async () => {
          hit += 1;
        },
        async () => {
          hit += 1;
          try {
            expect(hit).to.equal(2);
            setTimeout(() => {
              service.stop();
              done();
            }, 500);
          } catch (ex) {
            setTimeout(() => {
              service.stop();
              done(ex);
            }, 500);
          }
        }
      ))
      .then(() => service.emit('listen-multi-fns', 'world'))
      .catch(done);
  });

});


