
let sinon  = require('sinon');
let chai   = require('chai');
let expect = chai.expect;
let Event  = require('../../src/event');

describe('Event', () => {
  let fakeMessage;
  let fakeService;
  let event;

  beforeEach(() => {
    fakeMessage = {
      properties: {
        correlationId: '1234',
        headers: { },
      },
      fields: {
        routingKey: 'test.message'
      }
    };
  });

  beforeEach(() => {
    fakeService = {
      emit: sinon.stub()
    };
  });

  beforeEach(() => {
    event = new Event({
      service: fakeService,
      msg:fakeMessage,
      data: new Buffer('test data')
    });
  });

  describe('#constructor', () => {
    it('should add a property for the service', () => {
      expect(event.service).to.equal(fakeService);
    });
    it('should add a property for the AMQP message', () => {
      expect(event.msg).to.equal(fakeMessage);
    });
    it('should add a property for the data', () => {
      expect(event.data).to.deep.equal(new Buffer('test data'));
    });
    it('should add a property for the correlationId', () => {
      expect(event.correlationId).to.equal('1234');
    });
    it('should add a property for the routingKey', () => {
      expect(event.routingKey).to.equal('test.message');
    });
  });

  describe('.emit', () => {
    it('should call service.emit with the path as the first argument', () => {
      event.emit('test.path');
      expect(fakeService.emit.args[0][0]).to.equal('test.path');
    });
    it('should call service.emit with the data as the second argument', () => {
      event.emit(null, 'test data');
      expect(fakeService.emit.args[0][1]).to.equal('test data');
    });
    it('should call service.emit with the options as the third argument', () => {
      event.emit(null, null, { foo: 'bar' });
      expect(fakeService.emit.args[0][2].foo).to.equal('bar');
    });
    describe('when no correlationId option supplied', () => {
      it('should call service.emit with the current correlationId', () => {
        event.emit();
        expect(fakeService.emit.args[0][2].correlationId).to.equal('1234');
      });
    });
    describe('when correlationId option is supplied', () => {
      it('should call service.emit with the supplied correlationId option', () => {
        event.emit(null, null, { correlationId: '5678' });
        expect(fakeService.emit.args[0][2].correlationId).to.equal('5678');
      });
    });
  });

  describe('.reply', () => {
    describe('when called once', () => {
      it('should set the response property on the event', () => {
        event.reply('reply data');
        expect(event.response).to.equal('reply data');
      });
    });
    describe('when called more than once', () => {
      it('should throw an exception', () => {
        try {
          event.reply('reply data');
          event.reply('reply data');
        }
        catch(ex) {
          expect(ex).to.not.be.undefined;
          return;
        }
        throw new Error('should not have reached here');
      });
    });
  });

  describe('.end()', () => {
    it('should mark the event as done', () => {
      event.end();
      expect(event.done).to.be.true;
    });
  });

});