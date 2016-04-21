
import uuid from 'node-uuid';


export default class Event {

  constructor({ service, msg, data }) {
    this.service       = service;
    this.msg           = msg;
    this.data          = data;
    this.correlationId = msg.properties.correlationId;
    this.sendDataEvent = msg.properties.headers.sendDataEvent;
    this.routingKey    = msg.fields.routingKey;
  }


  /**
   * Scoped emit based on the current correlationId
   * @param  {[type]} event   [description]
   * @param  {[type]} data    [description]
   * @param  {[type]} options [description]
   * @return {[type]}         [description]
   */
  emit(event, data, options) {
    this.service.emit(event, data, Object.assign({ correlationId }, options));
  }

};