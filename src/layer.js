

class Layer {

  constructor(path, fn) {
    this._validatePath(path);

    this.path         = path;
    this.fn           = fn;
    this.name         = fn.name || '<anonymous>';
    this.handlesError = fn.length === 3;

    this.regexp = this._createRegex(path);

    if(path === '#')
      this.regexp.matchAll = true;
  }

  _validatePath(path) {
    if(Buffer.byteLength(path, 'utf8') > 255) {
      throw new Error('Invalid path, path must be less than 255 bytes');
    }

    if(path.search(/^[a-z0-9#\*\.\-]+$/i) < 0) {
      throw new Error('Invalid character in path');
    }
  }

  _createRegex(path) {
    let regex = path;
    let starReplace = '[a-z0-9]*';
    let hashReplace = '[a-z0-9]*(\\.[a-z0-9]+)*';
    let dotReplace  = '\\.{0,1}';
    regex = regex.replace('.*.', dotReplace + starReplace + dotReplace);
    regex = regex.replace('.*', dotReplace + starReplace);
    regex = regex.replace('*.', starReplace + dotReplace);
    regex = regex.replace('.#.', dotReplace + hashReplace + dotReplace);
    regex = regex.replace('.#',  dotReplace + hashReplace);
    regex = regex.replace('#.', hashReplace + dotReplace);
    return new RegExp('^' + regex + '$', 'i');
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

  async handle(event, next) {
    await this.fn(event, next);
  }

  async handleError(err, event, next) {
    await this.fn(err, event, next);
  }
}

module.exports = Layer;