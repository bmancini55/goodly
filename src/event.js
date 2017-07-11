
class Event {

  constructor({ service, msg, data }) {
    this.service       = service;
    this.msg           = msg;
    this.data          = data;
    this.correlationId = msg.properties.correlationId;
    this.sendDataEvent = msg.properties.headers.sendDataEvent;
    this.routingKey    = msg.fields.routingKey;
    this.done          = false;

    // enforce bindings so that methods can be used
    // in handlers by directly passing the function to the handler
    // and still retaining the binding
    this.emit  = this.emit.bind(this);
    this.reply = this.reply.bind(this);
  }

  /**
   * Scoped emit based on the current correlationId. Created as
   * an arrow function so that is automatically bound to the current
   * scope.
   * @param  {[type]} event   [description]
   * @param  {[type]} data    [description]
   * @param  {[type]} options [description]
   * @return {[type]}         [description]
   */
  async emit(path, data, options) {
    this.service.emit(path, data, Object.assign({ correlationId: this.correlationId }, options));
  }

  /**
   * Reply to a request.
   * scope.
   * @param  {[type]} data    [description]
   * @param  {[type]} options [description]
   * @return {[type]}         [description]
   */
  reply(data) {
    if(this.response) {
      throw new Error('Response has already been set');
    }
    this.response = data;
  }

}


module.exports = Event;