
import Layer from './layer';

class Router {
  stack = []

  add(path, ...fns) {
    let layer;

    if(typeof(path) === 'function') {
      layer = new Layer('', path);
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
    for(let layer of this.stack) {
      if(layer.match(path)) {
        await layer.handle(event);
        if(event.done) {
          break;
        }
      }
    }
    return event.response;
  }

  async _handleError(err, path, event) {
    let handled = false;
    for(let layer of this.stack) {
      if(layer.match(path, err)) {
        await layer.handleError(err, event);
        handled = true;
      }
    }

    if(!handled) {
      throw err;
    }

    return err;
  }
}

module.exports = Router;