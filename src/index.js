require('babel-regenerator-runtime');
require('source-map-support/register');
const Application = require('./application');

/**
 * Factory function that automatically starts the service if the brokerPath
 * is supplied. Otherwise it will simply return the service
 * @param  {[type]}   options.name       [description]
 * @param  {[type]}   options.brokerPath [description]
 * @param  {[type]}   options.transport  [description]
 * @param  {[type]}   options.cache      [description]
 * @param  {Function} callback           [description]
 * @return {[type]}                      [description]
 */
module.exports = function goodly(options, callback) {
  let service = new Application(options);
  let wait = [];

  if(!options.brokerPath)
    return service;

  return Promise
    .all(wait)
    .then(() => callback && callback(service))
    .then(() => service.start(options))
    .then(() => service)
    .catch(e => {
      return service
        .stop()
        .then(() => { throw e; })
        .catch(() => { throw e; });
    });
};




