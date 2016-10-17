/**
 * Integration test to validate listen middlware is wired
 * up as expected.
 */

const chai   = require('chai');
const expect = chai.expect;

const goodly   = require('../../src');
const RABBITMQ = process.env.RABBITMQ || '127.0.0.1';

describe('Acceptance: listen middleware', () => {
  it('should allow multiple middleware functions', async (done) => {
    let service;
    let hit = 0;

    Promise
      .resolve()
      .then(() => service = goodly({ name: 'test' }))
      .then(() => service.start({ brokerPath: RABBITMQ }))
      .then(() => service.on('listen-middleware',
        () => {
          hit += 1;
        }
      ))
      .then(() => service.on('listen-middleware',
        () => {
          hit += 1;
          try {
            expect(hit).to.equal(2);
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
        }
      ))
      .then(() => service.emit('listen-middleware'))
      .catch(done);
  });

});


