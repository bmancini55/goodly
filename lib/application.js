

import Debug from 'debug';
import Router from './router';
const debug = Debug('goodly:app');

export default class Application {

    /**
   * [construtor description]
   * @param  {[type]} options.name        [description]
   * @param  {String} options.appExchange [description]
   * @return {[type]}                     [description]
   */
  constructor({ name }) {
    this.name = name;
    this._router;
    debug('created service %s', name);
  }

  /**
   * Lazy creation of the default router if one is not specified
   * @return {[type]} [description]
   */
  lazyrouter() {
    if (!this._router) {
      this._router = new Router();
      // apply default middleware here
    }
  }

  /**
   * [use description]
   * @param  {[type]}   path [description]
   * @param  {Function} fn   [description]
   * @return {[type]}        [description]
   */
  use(path, fn) {
    this.lazyrouter();
    let router = this._router;
    router.use(path, fn);
    return this;
  }

  /**
   * [on description]
   * @param  {[type]}   path [description]
   * @param  {Function} fn   [description]
   * @return {[type]}        [description]
   */
  on(path, fn) {
    this.lazyrouter();
    let router = this._router;
    router.use(path, fn);
    return this;
  }

  /**
   * [dispatch description]
   * @param  {[type]} path [description]
   * @param  {[type]} msg  [description]
   * @return {[type]}      [description]
   */
  async handle(path, msg) {
    let router = this._router;

    // no routes
    if (!router) {
      debug('no routes defined on app');
      return;
    }

    // dispatch into router and return result
    let result = await router.handle(path, msg);
    return result;
  }

  /**
   * [emit description]
   * @param  {[type]} path [description]
   * @param  {[type]} data [description]
   * @return {[type]}      [description]
   */
  async emit(path, data) {
    let router = this._router;

    await router.emit(path, data);
  }

  async requestData(event) {
    let transport = this._transport;
    transport.requestData()
  }

}