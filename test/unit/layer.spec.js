
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
    it('should throw exception when path is longer than 255 bytes', () => {
      expect(() => new Layer('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',() => {}))
      .to.throw(Error);
    });
    it('should throw execption when path contains invalid characters', () => {
      expect(() => new Layer('$')).to.throw(Error);
    });
    describe('when layer regex is constructred', () => {
      it('should note match star at start with multiple words', () => {
        let layer = new Layer('*.derp.turkey', () => {});
        let path = 'hello.world.derp.turkey';
        expect(layer.regexp.test(path)).to.be.false;
      });
      it('should match star at start with single word', () => {
        let layer = new Layer('*.derp.turkey', () => {});
        let path = 'hello.derp.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match star at start with no word', () => {
        let layer = new Layer('*.derp.turkey', () => {});
        let path = 'derp.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should not match star in middle with multiple words', () => {
        let layer = new Layer('derp.*.turkey', () => {});
        let path = 'derp.hello.world.turkey';
        expect(layer.regexp.test(path)).to.be.false;
      });
      it('should match star in middle with single word', () => {
        let layer = new Layer('derp.*.turkey', () => {});
        let path = 'derp.hello.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match star in middle with no word', () => {
        let layer = new Layer('derp.*.turkey', () => {});
        let path = 'derp.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should not match star at end with multiple words', () => {
        let layer = new Layer('derp.turkey.*', () => {});
        let path = 'derp.turkey.hello.world';
        expect(layer.regexp.test(path)).to.be.false;
      });
      it('should match star at end with single word', () => {
        let layer = new Layer('derp.turkey.*', () => {});
        let path = 'derp.turkey.hello';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match star at end with no word', () => {
        let layer = new Layer('derp.turkey.*', () => {});
        let path = 'derp.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });

      it('should match hash at start with multiple words', () => {
        let layer = new Layer('#.derp.turkey', () => {});
        let path = 'hello.world.derp.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match hash at start with single word', () => {
        let layer = new Layer('#.derp.turkey', () => {});
        let path = 'hello.derp.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match hash at start with no word', () => {
        let layer = new Layer('#.derp.turkey', () => {});
        let path = 'derp.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match hash in middle with multiple words', () => {
        let layer = new Layer('derp.#.turkey', () => {});
        let path = 'derp.hello.world.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match hash in middle with single word', () => {
        let layer = new Layer('derp.#.turkey', () => {});
        let path = 'derp.hello.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match hash in middle with no word', () => {
        let layer = new Layer('derp.#.turkey', () => {});
        let path = 'derp.turkey';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match hash at end with multiple words', () => {
        let layer = new Layer('derp.turkey.#', () => {});
        let path = 'derp.turkey.hello.world';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match hash at end with single word', () => {
        let layer = new Layer('derp.turkey.#', () => {});
        let path = 'derp.turkey.hello';
        expect(layer.regexp.test(path)).to.be.true;
      });
      it('should match hash at end with no word', () => {
        let layer = new Layer('derp.turkey.#', () => {});
        let path = 'derp.turkey';
        expect(layer.regexp.test(path)).to.be.true;
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
    describe('when function accepts 1 argument', () => {
      it('should not flag the layer as an errorHandler', () => {
        // eslint-disable-next-line no-unused-vars
        let layer = new Layer('path', (event) => { });
        expect(layer.handlesError).to.be.false;
      });
    });
    describe('when function accepts 2 arguments', () => {
      it('should not flag the layer as an errorHandler', () => {
        // eslint-disable-next-line no-unused-vars
        let layer = new Layer('path', (event, next) => { });
        expect(layer.handlesError).to.be.false;
      });
    });
    describe('when function accepts 3 arguments', () => {
      it('should flag the layer as an errorHandler', () => {
        // eslint-disable-next-line no-unused-vars
        let layer = new Layer('path', (err, event, next) => { });
        expect(layer.handlesError).to.be.true;
      });
    });
    describe('when hash is defined', () => {
      it('should flag the regex with matchAll', () => {
        let layer = new Layer('#', () => {});
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
        let layer = new Layer('#', () => {});
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
        let layer = new Layer('path', (err, event, next) => {});
        expect(layer.match('path', new Error())).to.be.true;
      });
    });
    describe('when not error', () => {
      it('should ignore errorHandlers', () => {
        // eslint-disable-next-line no-unused-vars
        let layer = new Layer('path', (err, event, next) => {});
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