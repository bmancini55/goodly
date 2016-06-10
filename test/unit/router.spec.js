
let sinon  = require('sinon');
let chai   = require('chai');
let expect = chai.expect;
let Router = require('../../src/router');

describe('Router', () => {
  let router;

  beforeEach(() => {
    router = new Router();
  });

  describe('.add', () => {
    describe('when no path', () => {
      it('should create layer with empty path', () => {
        let func = () => {};
        router.add(func);
        let layer = router.stack[0];
        expect(layer.path).to.equal('');
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
      let calls = [ false, false, false, false ];
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
  });

});
