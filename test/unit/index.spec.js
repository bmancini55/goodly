

let sinon       = require('sinon');
let chai        = require('chai');
let expect      = chai.expect;
let factory     = require('../../src/index');
let Application = require('../../src/application');

describe('Goodly factory', () => {

  describe('with object params', () => {
    it('should return service', () => {
      let app = factory({ name: 'test' });
      expect(app instanceof Application);
    });
    it('should assign the name', () => {
      let app = factory({ name: 'test' });
      expect(app.name).to.equal('test');
    });
    it('should not start service', () => {
      let app = factory({ name: 'test' });
      expect(app._channel).to.be.undefined;
    });
  });

  describe('with string', () => {
    it('should return service', () => {
      let app = factory('test');
      expect(app instanceof Application);
    });
    it('should assign the name', () => {
      let app = factory('test');
      expect(app.name).to.equal('test');
    });
    it('should not start service', () => {
      let app = factory('test');
      expect(app._channel).to.be.undefined;
    });
  });

  describe('with no param', () => {
    it('should return service', () => {
      let app = factory();
      expect(app instanceof Application);
    });
    it('should not assign name', () => {
      let app = factory();
      expect(app.name).to.not.be.undefined;
    });
    it('should not start service', () => {
      let app = factory();
      expect(app._channel).to.be.undefined;
    });
  });

});

