

let proto = function(opts = {}) {

  let _cache = {}

  let middleware = (event, next) => {
    event.readFromCache = _readFromCache;
    event.writeFromCache = _writeToCache;
    next();
  };

  async _readFromCache(key) {
    return _cache[key];
  }

  async _writeToCache(key, data) {
    _cache[key] = data;
  }

  return middleware;
}

