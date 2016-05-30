import 'babel-regenerator-runtime';
import 'source-map-support/register';
import Application from './application';

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
export default function goodly({ name, brokerPath, transport, cache }, callback) {
  let service = new Application({ name });
  let wait = [];

  if(!brokerPath)
    return service;

  if(transport)
    wait.push(service.set('transport', transport));

  if(cache)
    wait.push(service.set('cache', cache));

  return Promise
    .all(wait)
    .then(() => callback && callback(service))
    .then(() => service.start({ brokerPath }))
    .then(() => service)
    .catch(e => {
      return service
        .stop()
        .then(() => console.log(e.stack))
        .catch(() => console.log(e.stack));
    });
};




