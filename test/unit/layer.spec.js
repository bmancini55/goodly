
let sinon  = require('sinon');
let chai   = require('chai');
let expect = chai.expect;
let Layer  = require('../../src/layer');

describe('Layer', () => {

  describe('#constructor', () => {
    it('should use the first argument as the path', () => {
      let layer = new Layer('path', () => {});
      expect(layer.path).to.equal('path');
    });
    it('should use the second argument as the handler', () => {
      let func  = () => { };
      let layer = new Layer('path', func);
      expect(layer.fn).to.equal(func);
    });
    describe('when layer regex is constructred', () => {
      it('should allow an exact match of the path', () => {
        let layer = new Layer('path', () => {});
        let match = layer.regexp.test('path');
        expect(match).to.be.true;
      });
    });
    describe('when named function', () => {
      it('should store the function name', () => {
        let layer = new Layer('path', function named() {});
        expect(layer.name).to.equal('named');
      });
    });
    describe('when anonymous function', () => {
      it('should use an anonymous name', () => {
        let layer = new Layer('path', () => {});
        expect(layer.name).to.equal('<anonymous>');
      });
    });
    describe('when function accespts 1 argument', () => {
      it('should flag the layer as an errorHandler', () => {
        // eslint-disable-next-line no-unused-vars
        let layer = new Layer('path', (event) => { });
        expect(layer.handlesError).to.be.false;
      });
    });
    describe('when function accepts 2 arguments', () => {
      it('should not flag the layer as an errorHandler', () => {
        // eslint-disable-next-line no-unused-vars
        let layer = new Layer('path', (err, event) => { });
        expect(layer.handlesError).to.be.true;
      });
    });
    describe('when an empty path is defined', () => {
      it('should flag the regex with matchAll', () => {
        let layer = new Layer('', () => {});
        expect(layer.regexp.matchAll).to.be.true;
      });
    });
  });

  describe('.match', () => {
    describe('when path is null', () => {
      it('should return false', () => {
        let layer = new Layer('path', () => {});
        expect(layer.match()).to.be.false;
      });
    });
    describe('when matchAll is true', () => {
      it('should return true', () => {
        let layer = new Layer('', () => {});
        expect(layer.match('test')).to.be.true;
      });
    });
    describe('when matches regex', () => {
      it('should return true', () => {
        let layer = new Layer('path', () => {});
        expect(layer.match('path')).to.be.true;
      });
    });
    describe('when doesnt match regex', () => {
      it('should return false', () => {
        let layer = new Layer('path', () => {});
        expect(layer.match('bad')).to.be.false;
      });
    });
    describe('when error', () => {
      it('should return false when not error handler', () => {
        let layer = new Layer('path', () => {});
        expect(layer.match('path', new Error())).to.be.false;
      });
      it('should return true when error handler', () => {
        // eslint-disable-next-line no-unused-vars
        let layer = new Layer('path', (err, event) => {});
        expect(layer.match('path', new Error())).to.be.true;
      });
    });
    describe('when not error', () => {
      it('should ignore errorHandlers', () => {
        // eslint-disable-next-line no-unused-vars
        let layer = new Layer('path', (err, event) => {});
        expect(layer.match('path')).to.be.false;
      });
    });
  });

  describe('.handle', () => {
    let handler, layer;
    beforeEach(() => {
      handler = sinon.stub().returns(Promise.resolve());
      layer = new Layer('path', handler);
    });
    it('should call the handler function', (done) => {
      layer
        .handle('event')
        .then(() => expect(handler.called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should pass the event as the first argument', (done) => {
      layer
        .handle('event')
        .then(() => expect(handler.args[0][0]).to.equal('event'))
        .then(() => done())
        .catch(done);
    });
  });

  describe('.handleError', () => {
    let fn, layer;
    beforeEach(() => {
      try {
      // eslint-disable-next-line no-unused-vars
      fn = sinon.spy((err, event) => {});
      layer = new Layer('path', fn);
    } catch(ex)
    { console.log(ex.stack); }
    });
    it('should call the handler function', (done) => {
      layer
        .handleError('err', 'event')
        .then(() => expect(fn.called).to.be.true)
        .then(() => done())
        .catch(done);
    });
    it('should pass the err as the first argument', (done) => {
      layer
        .handleError('err', 'event')
        .then(() => expect(fn.args[0][0]).to.equal('err'))
        .then(() => done())
        .catch(done);
    });
    it('should pass the event as the second argument', (done) => {
      layer
        .handleError('err', 'event')
        .then(() => expect(fn.args[0][1]).to.equal('event'))
        .then(() => done())
        .catch(done);
    });
  });

});