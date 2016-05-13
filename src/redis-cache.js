
import redis from 'redis';
import Debug from 'debug';

const debug = Debug('goodly:redis-cache');

export default ({ redisUrl }) => {
  let _redis;

  return {

    start: () => {
      _redis = redis.createClient('redis://' + redisUrl);
      debug('connected to Redis %s', redisUrl);
    },

    stop: () => {
      _redis.stop();
      debug('disconnected from Redis %s', redisUrl);
    },

    readFromCache: (key) => {
      return new Promise((resolve, reject) => {
        debug('reading %s', key);
        _redis.get(key, (err, reply) => {
          if(err) reject(err);
          else {
            let strJson = reply;
            let json = JSON.parse(strJson);
            let data = json.data;
            resolve(data);
          }
        });
      });
    },

    writeToCache: (key, data) => {
      return new Promise((resolve, reject) => {
        debug('writing %s', key);
        let json = { data: data };
        let strJson = JSON.stringify(json);
        _redis.set(key, strJson, (err, reply) => {
          if(err) reject(err);
          else _redis.expire(key, 60, (err2) => {
              if(err2) reject(err2);
              else resolve(reply);
            });
        });
      });
    }

  }
}

