

export default class Layer {

  constructor(path, fn) {

    this.handle = fn;
    this.name = fn.name || '<anonymous>';

    // mimic path-to-regexp for amqp events - https://github.com/pillarjs/path-to-regexp
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

  async handle(data, options, next) {
    return this.handle(data, options, next);
  }
}
