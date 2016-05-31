
let chai      = require('chai');
let expect    = chai.expect;
let transport = require('../../src/transport-broker');


describe('transport-broker', () => {
  let sut;

  beforeEach(() => {
    sut = transport();
  });

  describe('#start', () => {
    it('is defined', () => {
      expect(sut.start).to.be.a('function');
    });
    it('should execute', (done) => {
      sut
        .start()
        .then(() => done())
        .catch(done);
    });
  });

  describe('#stop', () => {
    it('is defined', () => {
      expect(sut.stop).to.be.a('function');
    });
    it('should execute', (done) => {
      sut.stop()
      .then(() => done())
      .catch(done);
    });
  });

  describe('#requestData', () => {
    it('should return the message content', (done) => {
      let msg = { content: 'hello' };
      sut
        .requestData({ msg })
        .then(result => expect(result).to.equal('hello'))
        .then(() => done())
        .catch(done);
    });
  });

  describe('#prepEmission', () => {
    it('should return empty headers', (done) => {
      sut
        .prepEmission({ data: 'hello' })
        .then(({ headers }) => expect(headers).to.deep.equal({}))
        .then(() => done())
        .catch(done);
    });
    it('should return send as supplied data', (done) => {
      sut
        .prepEmission({ data: 'hello' })
        .then(({ send }) => expect(send).to.equal('hello'))
        .then(() => done())
        .catch(done);
    });
  });

});