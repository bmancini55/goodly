
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
        let { buffer } = util.convertToBuffer(input);
        expect(buffer).to.deep.equal(Buffer.from(''));
      });
      it('should have contentType of undefined', () => {
        let { contentType } = util.convertToBuffer(input);
        expect(contentType).to.equal('undefined');
      });
    });

    describe('when input is null', () => {
      beforeEach(() => {
        input = null;
      });
      it('should return empty buffer', () => {
        let { buffer } = util.convertToBuffer(input);
        expect(buffer).to.deep.equal(Buffer.from(''));
      });
      it('should have contentType of null', () => {
        let { contentType } = util.convertToBuffer(input);
        expect(contentType).to.equal('null');
      });
    });

    describe('when input is buffer', () => {
      beforeEach(() => {
        input = new Buffer('hello');
      });
      it('should return the buffer', () => {
        let { buffer } = util.convertToBuffer(input);
        expect(buffer).to.equal(input);
      });
      it('should have contentType of buffer', () => {
        let { contentType } = util.convertToBuffer(input);
        expect(contentType).to.equal('buffer');
      });
    });

    describe('when input is string', () => {
      beforeEach(() => {
        input = 'test';
      });
      it('should return a buffer with the string', () => {
        let { buffer } = util.convertToBuffer(input);
        expect(buffer).to.deep.equal(Buffer.from(input));
      });
      it('should return contentType of string', () => {
        let { contentType } = util.convertToBuffer(input);
        expect(contentType).to.equal('string');
      });
    });

    describe('when input is object', () => {
      beforeEach(() => {
        input = { for: 'bar' };
      });
      it('should return buffer with a JSON representation of the object', () => {
        let { buffer } = util.convertToBuffer(input);
        expect(buffer).to.deep.equal(Buffer.from(JSON.stringify(input)));
      });
      it('should have contentType of object', () => {
        let { contentType } = util.convertToBuffer(input);
        expect(contentType).to.equal('object');
      });
    });

    describe('when input is array', () => {
      beforeEach(() => {
        input = [ { foo: 'bar' }];
      });
      it('should return buffer with JSON representation of the array', () => {
        let { buffer } = util.convertToBuffer(input);
        expect(buffer).to.deep.equal(Buffer.from(JSON.stringify(input)));
      });
      it('should have contentType of array', () => {
        let { contentType } = util.convertToBuffer(input);
        expect(contentType).to.equal('array');
      });
    });

    describe('when input is integer', () => {
      beforeEach(() => {
        input = 55;
      });
      it('should return a buffer with the number', () => {
        let { buffer } = util.convertToBuffer(input);
        expect(buffer).to.deep.equal(Buffer.from(input.toString()));
      });;
      it('should return contentType of integer', () => {
        let { contentType } = util.convertToBuffer(input);
        expect(contentType).to.equal('integer');
      });
    });

    describe('when input is float', () => {
      beforeEach(() => {
        input = 55.5;
      });
      it('should return a buffer with the number', () => {
        let { buffer } = util.convertToBuffer(input);
        expect(buffer).to.deep.equal(Buffer.from(input.toString()));
      });
      it('should return contentType of float', () => {
        let { contentType } = util.convertToBuffer(input);
        expect(contentType).to.equal('float');
      });
    });

    describe('when input is boolean', () => {
      it('should return a buffer with 1', () => {
        let { buffer } = util.convertToBuffer(true);
        expect(buffer).to.deep.equal(Buffer.from([1]));
      });
      it('should return a buffer with 0', () => {
        let { buffer } = util.convertToBuffer(false);
        expect(buffer).to.deep.equal(Buffer.from([0]));
      });
      it('should return contentType of boolean', () => {
        let { contentType } = util.convertToBuffer(true);
        expect(contentType).to.equal('boolean');
      });
    });

  });

  describe('#convertFromBuffer', () => {
    describe('when contentType is undefined', () => {

      let input = Buffer.from('');
      let actual = util.convertFromBuffer('undefined', input);
      expect(actual).to.be.undefined;
    });
    describe('when contentType is null', () => {
      let input = Buffer.from('');
      let actual = util.convertFromBuffer('null', input);
      expect(actual).to.be.null;
    });
    describe('when contentType is buffer', () => {
      it('should return the buffer', () => {
        let input = Buffer.from('test');
        let actual = util.convertFromBuffer('buffer', input);
        expect(actual).to.equal(input);
      });
    });
    describe('when contentType is string', () => {
      it('shoudl return the string', () => {
        let input = Buffer.from('test');
        let actual = util.convertFromBuffer('string', input);
        expect(actual).to.equal('test');
      });
    });
    describe('when contentType is integer', () => {
      it('should return the integer', () => {
        let input = Buffer.from((55).toString());
        let actual = util.convertFromBuffer('integer', input);
        expect(actual).to.equal(55);
      });
    });
    describe('when contentType is float', () => {
      it('should return the float', () => {
        let input = Buffer.from((55.5).toString());
        let actual = util.convertFromBuffer('float', input);
        expect(actual).to.equal(55.5);
      });
    });
    describe('when contentType is boolean', () => {
      it('should return the boolean', () => {
        let input = Buffer.from([1]);
        let actual = util.convertFromBuffer('boolean', input);
        expect(actual).to.equal(true);
      });
    });
    describe('when contentType is array', () => {
      it('should return the deserialized array', () => {
        let input = Buffer.from(JSON.stringify([ { foo: 'bar' }]));
        let actual = util.convertFromBuffer('array', input);
        expect(actual).to.deep.equal([{ foo: 'bar' }]);
      });
    });
    describe('when contentType is object', () => {
      it('should return the deserialized object', () => {
        let input = Buffer.from(JSON.stringify({ foo: 'bar' }));
        let actual = util.convertFromBuffer('object', input);
        expect(actual).to.deep.equal({ foo: 'bar' });
      });
    });
  });

});
