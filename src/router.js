
import Layer from './layer';

export default class Router {
  stack = []

  on(path, fn) {
    let layer = new Layer(path, fn);
    this.stack.push(layer);
  }

  use(path, fn) {
    let layer;

    if(typeof(path) === 'function')
      layer = new Layer('', path);
    else
      layer = new Layer(path, fn);

    this.stack.push(layer);
  }

  async handle(path, event) {
    let stack = this.stack;
    let idx = 0;

    const next = async () => {
      let layer;
      let match;

      // find next matching layer
      while (!match && idx < stack.length) {
        layer = stack[idx];
        match = layer.match(path);
        idx += 1;

        if(!match)
          continue;
      }

      // no match found
      if(!match) {
        return;
      }

      // otherwise... process
      await layer.handle(event, next);
    };
    await next();
    return event.response;
  }
}