
let chai   = require('chai');
let expect = chai.expect;
let util   = require('../../src/util');

describe('util', () => {

  describe('#convertToBuffer', () => {
    let input;

    describe('when input is undefined', () => {
      beforeEach(() => {
        input = undefined;
      });
      it('should return an empty buffer', () => {
        let { buffer: actual } = util.convertToBuffer(input);
        expect(actual).to.deep.equal(new Buffer(''));
      });
      it('should have contentType of undefined', () => {
        let { contentType: actual } = util.convertToBuffer(input);
        expect(actual).to.equal('undefined');
      });
    });

    describe('when input is buffer', () => {
      beforeEach(() => {
        input = new Buffer('hello');
      });
      it('should return the buffer', () => {
        let { buffer: actual } = util.convertToBuffer(input);
        expect(actual).to.equal(input);
      });
      it('should have contentType of buffer', () => {
        let { contentType: actual } = util.convertToBuffer(input);
        expect(actual).to.equal('buffer');
      });
    });

    describe('when input is object', () => {
      beforeEach(() => {
        input = { for: 'bar' };
      });
      it('should return buffer with a JSON representation of the object', () => {
        let { buffer: actual } = util.convertToBuffer(input);
        expect(actual).to.deep.equal(new Buffer(JSON.stringify(input)));
      });
      it('should have contentType of object', () => {
        let { contentType: actual } = util.convertToBuffer(input);
        expect(actual).to.equal('object');
      });
    });

    describe('when input is string', () => {
      beforeEach(() => {
        input = 'test';
      });
      it('should return a buffer with the string', () => {
        let { buffer: actual } = util.convertToBuffer(input);
        expect(actual).to.deep.equal(new Buffer(input));
      });
      it('should return contentType of string', () => {
        let { contentType: actual } = util.convertToBuffer(input);
        expect(actual).to.equal('string');
      });
    });

  });

  describe('#convertFromBuffer', () => {
    describe('when contentType is buffer', () => {
      it('should return the buffer', () => {
        let input = new Buffer('test');
        let actual = util.convertFromBuffer('buffer', input);
        expect(actual).to.equal(input);
      });
    });
    describe('when contentType is object', () => {
      it('should return the deserialized object', () => {
        let input = new Buffer(JSON.stringify({ foo: 'bar' }));
        let actual = util.convertFromBuffer('object', input);
        expect(actual).to.deep.equal({ foo: 'bar' });
      });
    });
    describe('when contentType is string', () => {
      it('shoudl return the string', () => {
        let input = new Buffer('test');
        let actual = util.convertFromBuffer('string', input);
        expect(actual).to.equal('test');
      });
    });
  });

});
