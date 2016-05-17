
import http from 'http';
import Debug from 'debug';
import express from 'express';
import bodyParser from 'body-parser';
import { convertToBuffer, convertFromBuffer } from './util';

const debug = Debug('goodly:http-transport');


export default async (options) => {
  return new HttpTransport(options);
}


export class HttpTransport {

  constructor({ httpHost = 'localhost', httpPort } = {}) {
    this._app;
    this._callbacks = {};
    this.httpHost = httpHost;
    this.httpPort = httpPort || (Math.floor(Math.random() * 50000) + 10000);
  }

  /**
   * Starts the http service and binds an http listener for receiving data
   * @return {[type]} [description]
   */
  async start() {
    const app = this._app = express();
    app.use(bodyParser.json({}));
    app.post('/receive', (req, res, next) => this._postReceiveData(req, res).catch(next));
    app.listen(this.httpPort, () => debug('express listening on port %d', this.httpPort));
  }

  /**
   * Stops the http transport server
   * @return {[type]} [description]
   */
  async stop() {
    const app = this._app;
    app.close();
  }


  /**
   * Requests the data via the message bus by constructing
   * a .senddata event
   * @param  {[type]} options.app           [description]
   * @param  {[type]} options.sendDataEvent [description]
   * @param  {[type]} options.correlationId [description]
   * @return {[type]}                       [description]
   */
  async requestData({ service, msg }) {
    let correlationId = msg.properties.correlationId;
    let sendDataEvent = msg.properties.headers.sendDataEvent;

    if(sendDataEvent) {
      let headers = {
        replyHost: this.httpHost,
        replyPort: this.httpPort
      };
      return new Promise((resolve) => {
        this._callbacks[correlationId] = (data) => resolve(data);
        service.emit(sendDataEvent, null, { correlationId, headers });
      });
    }
  }

  /**
   * [emit description]
   * @param  {[type]} options.service [description]
   * @param  {[type]} options.path   [description]
   * @param  {[type]} options.headers [description]
   * @return {[type]}                 [description]
   */
  async prepEmission({ service, path, correlationId, data, replyTo }) {
    const sendDataEvent = (replyTo ? 'request.' : '') + path + '.senddata';
    const cache         = await service.get('cache');
    let headers         = {};
    let buffer          = new Buffer('');

    // only do this if there is actually data
    if(data) {

      // attach listener for the senddata event
      await service.on(sendDataEvent, async (event) => {
        const data = await cache.readFromCache(event.correlationId);
        const msg  = event.msg;
        return this._sendData({ service, data, msg });
      });

      // write the data to the cache so any service can respond
      // to the senddata event
      await cache.writeToCache(correlationId, data);

      // adjust headers to include senddata event
      headers.sendDataEvent = sendDataEvent;

    }

    return {
      headers,
      buffer
    };
  }

  /**
   * Fired when a .senddata event is received.
   * This method will use an HTTP POST method to
   * transfer data to the host:port supplied in the
   * header of the .senddata event.
   */
  async _sendData({ service, msg, data }) {
    const correlationId = msg.properties.correlationId;
    const replyHost     = msg.properties.headers.replyHost;
    const replyPort     = msg.properties.headers.replyPort;
    debug('sending data to %s:%s for %s', replyHost, replyPort, correlationId);
    try
    {
      const buffer = JSON.stringify({ data: convertToBuffer(data), correlationId });
      const req = http.request({
        host: replyHost,
        port: replyPort,
        path: '/receive',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': buffer.length
        }
      }, (res) => {
        // TODO requeue original on failure
      });
      req.write(buffer);
      req.end();
    }
    catch(ex) {
      // TODO requeue original on failure
      console.log(ex.stack);
    }
  }


  /**
   * POST /receive
   * Handler for data received via HTTP
   * @param  {[type]} req [description]
   * @param  {[type]} res [description]
   * @return {[type]}     [description]
   */
  async _postReceiveData(req, res) {
    const data = convertFromBuffer(new Buffer(req.body.data.data));
    const {correlationId} = req.body;
    debug('http data received for %s', correlationId);

    if(this._callbacks[correlationId]) {
      res.end();

      // allow response to end before executing callback
      setImmediate(() => {
        this._callbacks[correlationId](data);
        delete this._callbacks[correlationId];
      });
    } else {
      res.status(404).end();
    }
  }

}