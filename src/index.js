import 'babel-regenerator-runtime';
import 'source-map-support/register';
import Application from './application';
import memoryCache from './memory-cache';
import redisCache from './redis-cache';
import httpTransport from './http-transport';

export { memoryCache, redisCache, httpTransport };

/**
 * Factory function that automatically starts the service
 * @param  {[type]}   options.name       [description]
 * @param  {[type]}   options.brokerPath [description]
 * @param  {[type]}   options.transport  [description]
 * @param  {[type]}   options.cache      [description]
 * @param  {Function} callback           [description]
 * @return {[type]}                      [description]
 */
export function connect({ name, brokerPath, transport, cache }, callback) {

  if(! (typeof arguments[0] == 'string' && typeof arguments[1] == 'string' && typeof arguments[2] !== 'function')) {

  }

  let service = new Application({ name });
  let wait = [];

  if(transport)
    wait.push(service.set('transport', transport));

  if(cache)
    wait.push(service.set('cache', cache));

  return Promise
    .all(wait)
    .then(() => service.start({ brokerPath }))
    .then(() => callback(service))
    .catch(e => {
      return service
        .stop()
        .then(() => console.log(e.stack))
        .catch(() => console.log(e.stack));
    });
};

/**
 * Default export of the application factory
 * @param  {[type]} options [description]
 * @return {[type]}         [description]
 */
export default function app(options) {
  return new Application(options);
};

app.memoryCache   = memoryCache;
app.redisCache    = redisCache;
app.httpTransport = httpTransport;




