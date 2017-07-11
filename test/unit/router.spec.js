
let {expect} = require('chai');
let Router   = require('../../src/router');
let Event    = require('../../src/event');

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
        return async (event, next) => {
          calls[index] = true;
          await next();
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
    it('should await for next middleware', (done) => {
      let calls = [];
      router.add('path', async (event, next) => {
        calls.push(1);
        await next();
        calls.push(3);
      });
      router.add('path', async () => {
        calls.push(2);
      });
      router.handle('path', {})
        .then(() => {
          expect(calls).to.deep.equal([1,2,3]);
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
    describe('when next is not called', () => {
      it('should not execute additional layers', (done) => {
        let count = 0;
        router.add('responder', async (event, next) => { count += 1; await next(); });
        router.add('responder', async (event, next) => { count += 1; }); // eslint-disable-line no-unused-vars
        router.add('responder', async (event, next) => { count += 1; }); // eslint-disable-line no-unused-vars
        router
          .handle('responder', event)
          .then(() => {
            expect(count).to.equal(2);
            done();
          })
          .catch(done);
      });
    });
    describe('when error occurs', () => {
      it('should call error handlers', (done) => {
        let called1, called2;
        router.add('responder', () => { throw new Error('boom'); });
        router.add('#', async (err, event, next) => { called1 = true; await next(); }); // eslint-disable-line no-unused-vars
        router.add('#', async (err, event, next) => { called2 = true; }); // eslint-disable-line no-unused-vars
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
        router.add('#', (err, event, next) => {}); // eslint-disable-line no-unused-vars
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
