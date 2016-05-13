
import Debug from 'debug';
const debug = Debug('goodly:memory-cache');

export default async () => {
  let _cache;

  return {
    start: async () => {
      _cache = {};
    },

    stop: async () => {
      _cache = undefined;
    },

    readFromCache: async (key) => {
      debug('reading %s', key);
      return _cache[key];
    },

    writeToCache: async (key, data) => {
      debug('writing %s', key);
      _cache[key] = data;
    }
  };

};