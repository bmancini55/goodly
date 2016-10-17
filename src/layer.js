

class Layer {

  constructor(path, fn) {
    this.path         = path;
    this.fn           = fn;
    this.name         = fn.name || '<anonymous>';
    this.handlesError = fn.length === 2;
    this.regexp       = new RegExp('^' + path + '$', 'i');

    // allow matching all
    if(path === '')
      this.regexp.matchAll = true;
  }

  match(path, err) {
    if (path == null) {
      return false;
    }

    if(err && !this.handlesError)  {
      return false;
    }

    if(!err && this.handlesError) {
      return false;
    }

    if (this.regexp.matchAll) {
      return true;
    }

    if (!this.regexp.test(path)) {
      return false;
    }

    return true;
  }

  async handle(event) {
    await this.fn(event);
  }

  async handleError(err, event) {
    await this.fn(err, event);
  }
}

module.exports = Layer;