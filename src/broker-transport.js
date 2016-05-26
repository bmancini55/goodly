
export default async (options) => {
  return new BrokerTransport(options);
};


export class BrokerTransport {

  constructor() {
  }

  /**
   * Starts the transport mechanism
   * @return {[type]} [description]
   */
  async start() {
  }

  /**
   * Stops the transport mechanism
   * @return {[type]} [description]
   */
  async stop() {
  }


  /**
   * Fetches the data directly from the message
   */
  async requestData({ msg }) {
    return msg.content;
  }

  /**
   * Prepares emission
   * @param  {[type]} options.service       [description]
   * @param  {[type]} options.path          [description]
   * @param  {[type]} options.correlationId [description]
   * @param  {[type]} options.data          [description]
   * @return {[type]}                       [description]
   */
  async prepEmission({ data }) {
    return {
      headers: { },
      send: data
    };
  }

}