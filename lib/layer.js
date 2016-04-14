

export default class Layer {

  constructor(path, fn) {

    this.handle = fn;
    this.name = fn.name || '<anonymous>';
    this.path = undefined;

    // mimic path-to-regexp for amqp events - https://github.com/pillarjs/path-to-regexp
    this.regexp = new RegExp('^' + path + '$', 'gi');

    // allow matching all
    if(path === '')
      this.regexp.matchAll = true;
  }

  match(path) {
    if (path == null) {
      this.path = undefined;
      return false;
    }

    if (this.regexp.matchAll) {
      this.path = path;
      return true;
    }

    let m = this.regexp.exec(path);
    if (!m) {
      this.path = undefined;
      return false;
    }

    this.path = m[0];
    return true;
  }

  async handle(data, options, next) {
    return this.handle(data, options, next);
  }
}
