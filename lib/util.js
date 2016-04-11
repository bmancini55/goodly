
export convertToBuffer = (result) => {
  let type;
  let data;

  if(result instanceof Buffer) {
    type = 'buffer';
    data = result;
  }
  else if(typeof result === 'object') {
    type = 'object';
    data = new Buffer(JSON.stringify(result));
  }
  else {
    type = typeof result;
    data = new Buffer(result);
  }
  return Buffer.concat([ new Buffer(type), data ]);
};

export convertFromBuffer = (buffer) => {
  let text = buffer.toString();
  let result;

  if(text.startsWith('buffer')) {
    result = new Buffer(text.substring('buffer'.length));
  }
  else if(text.startsWith('object')) {
    result = text.substring('object'.length);
    result = JSON.parse(result);
  }
  else {
    result = text.substring('string'.length);
  }
  return result;
};