
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
    let stack = this.stack;

    // loop through each layer
    for(let layer of stack) {

      // handle matches
      if(layer.match(path)) {
        await layer.handle(event);
      }
    }

    return event.response;
  }
}

module.exports = Router;