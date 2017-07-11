
let Layer = require('./layer');

class Router {
  constructor() {
    this.stack = [];
  }

  add(path, ...fns) {
    let layer;

    if(typeof(path) === 'function') {
      layer = new Layer('#', path);
      this.stack.push(layer);
    }
    else {
      for(let fn of fns) {
        layer = new Layer(path, fn);
        this.stack.push(layer);
      }
    }
  }

  async handle(path, event) {
    try {
      return await this._handle(path, event);
    }
    catch(err) {
      return await this._handleError(err, path, event);
    }
  }

  async _handle(path, event) {
    let stack = this.stack;
    let idx   = 0;

    async function next() {
      let match;
      while(!match && idx < stack.length) {
        let layer = stack[idx++];
        match = layer.match(path);
        if(match) {
          await layer.handle(event, next);
        }
      }
    }

    await next();
    return event.response;
  }

  async _handleError(err, path, event) {
    let stack   = this.stack;
    let idx     = 0;
    let handled = false;

    async function next() {
      let match;
      while(!match && idx < stack.length) {
        let layer = stack[idx++];
        match = layer.match(path, err);
        if(match) {
          await layer.handleError(err, event, next);
          handled = true;
        }
      }
    }

    await next();

    if(!handled) {
      throw err;
    }

    return err;
  }
}

module.exports = Router;