
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
      expect(layer.handle).to.equal(func);
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
    describe('when lambda function', () => {

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
      let layer = new Layer('path', () => {});
      expect(layer.match('path')).to.be.true;
    });
    describe('when doesnt match regex', () => {
      let layer = new Layer('path', () => {});
      expect(layer.match('bad')).to.be.false;
    });
  });

  describe('.handle', () => {
    let handler, layer;
    beforeEach(() => {
      handler = sinon.stub().returns(Promise.resolve());
      layer = new Layer('path', handler);
    });
    it('should call the handler function', async (done) => {
      await layer.handle('event', 'next');
      expect(handler.called).to.be.true;
      done();
    });
    it('should pass the event as the first argument', async (done) => {
      await layer.handle('event', 'next');
      expect(handler.args[0][0]).to.equal('event');
      done();
    });
    it('should pass the next function as the second argument', async (done) => {
      await layer.handle('event', 'next');
      expect(handler.args[0][1]).to.equal('next');
      done();
    });
  });

});