import 'source-map-support/register';
import Application from './application';
import memoryCache from './memory-cache';
import redisCache from './redis-cache';
import httpTransport from './http-transport';

const app = (options) => {
  return new Application(options);
};

app.memoryCache   = memoryCache;
app.redisCache    = redisCache;
app.httpTransport = httpTransport;

export default app;
