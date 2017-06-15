const Application = require('./application');
const { generateId } = require('./util');

/**
 * Con
 * @param  {[type]}   options  [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
module.exports = function goodly(options) {
  if(!options) {
    options = { name: generateId() };
  }
  if(typeof options === 'string') {
    options = { name: options };
  }
  return new Application(options);
};




