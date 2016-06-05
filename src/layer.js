

class Layer {

  constructor(path, fn) {
    this.path   = path;
    this.fn     = fn;
    this.name   = fn.name || '<anonymous>';

    this.regexp = new RegExp('^' + path + '$', 'i');

    // allow matching all
    if(path === '')
      this.regexp.matchAll = true;
  }

  match(path) {
    if (path == null) {
      return false;
    }

    if (this.regexp.matchAll) {
      return true;
    }

    let m = this.regexp.test(path);
    if (!m) {
      return false;
    }

    return true;
  }

  async handle(event, next) {
    await this.fn(event, next);
  }
}

module.exports = Layer;