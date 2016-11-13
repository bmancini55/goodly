
import {expect} from 'chai';
import Router from '../../src/router';
import Event from '../../src/event';

describe('Router', () => {
  let router;
  let event;

  beforeEach(() => {
    router = new Router();
    event = new Event({
      msg: {
        properties: {
          headers: { },
        },
        fields: { },
      },
    });
  });

  describe('.add', () => {
    describe('when no path', () => {
      it('should create layer with empty path', () => {
        let func = () => {};
        router.add(func);
        let layer = router.stack[0];
        expect(layer.path).to.equal('#');
        expect(layer.regexp.matchAll).to.be.true;
        expect(layer.fn).to.equal(func);
      });
    });
    describe('when path', () => {
      it('should create layer with supplied path', () => {
        let func = () => {};
        router.add('path', func);
        let layer = router.stack[0];
        expect(layer.path).to.equal('path');
        expect(layer.regexp.matchAll).to.be.undefined;
        expect(layer.fn).to.equal(func);
      });
    });
    describe('when multiple fns', () => {
      it('should add each functions in order', () =>{
        let func1 = () => {};
        let func2 = () => {};
        router.add('path', func1, func2);
        expect(router.stack.length).to.equal(2);
        expect(router.stack[0].path).to.equal('path');
        expect(router.stack[0].name).to.equal('func1');
        expect(router.stack[1].path).to.equal('path');
        expect(router.stack[1].name).to.equal('func2');
      });
    });
  });

  describe('.handle', () => {
    it('should process each matching layer', (done) => {
      let calls = [ false, false, false, false, false ];
      let makeHandler = (index) => {
        return async () => {
          calls[index] = true;
        };
      };
      router.add('path', makeHandler(0));
      router.add('nope', makeHandler(1));
      router.add('path', makeHandler(2));
      router.add('nope', makeHandler(3));
      router
        .handle('path', {})
        .then(() => {
          expect(calls[0]).to.be.true;
          expect(calls[1]).to.be.false;
          expect(calls[2]).to.be.true;
          expect(calls[3]).to.be.false;
          done();
        })
        .catch(done);
    });
    it('should return the event.response', (done) => {
      router.add('responder', (event) => { event.response = 'hello'; });
      router
        .handle('responder', {})
        .then((result) => {
          expect(result).to.equal('hello');
          done();
        })
        .catch(done);
    });
    describe('when event is flagged as done', () => {
      it('should not execute additional layers', (done) => {
        let count = 0;
        router.add('responder', () => count += 1 );
        router.add('responder', (event) => { event.end(); });
        router.add('responder', () => count += 1 );
        router
          .handle('responder', event)
          .then(() => {
            expect(count).to.equal(1);
            done();
          })
          .catch(done);
      });
    });
    describe('when event is not flagged as done', () => {
      it('should execute matching layers', (done) => {
        let count = 0;
          router.add('responder', () => count += 1 );
          router.add('responder', () => count += 1 );
          router
            .handle('responder', event)
            .then(() => {
              expect(count).to.equal(2);
              done();
            })
            .catch(done);
      });
    });
    describe('when error ocurrs', () => {
      it('should call error handlers', (done) => {
        let called1, called2;
        router.add('responder', () => { throw new Error('boom'); });
        router.add('#', (err, event) => called1 = true); // eslint-disable-line no-unused-vars
        router.add('#', (err, event) => called2 = true); // eslint-disable-line no-unused-vars
        router
          .handle('responder', event)
          .then(() => {
            expect(called1).to.be.true;
            expect(called2).to.be.true;
            done();
          })
          .catch(done);
      });
      it('should return error', (done) => {
        router.add('responder', () => { throw new Error('boom'); });
        router.add('#', (err, event) => {}); // eslint-disable-line no-unused-vars
        router
          .handle('responder', event)
          .then((err) => {
            expect(err.message).to.equal('boom');
            done();
          })
          .catch(done);
      });
      it('should rethrow exception when no error handler', (done) => {
        router.add('responder', () => { throw new Error('boom'); });
        router
          .handle('responder', event)
          .catch((err) => {
            expect(err.message).to.equal('boom');
            done();
          })
          .catch(done);


      });
    });
  });

});
