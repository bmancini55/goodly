
module.exports = {
  convertToBuffer,
  convertFromBuffer,
  generateId,
};

function convertFromBuffer(contentType, buffer) {
  switch(contentType) {
    case 'undefined':
      return undefined;
    case 'null':
      return null;
    case 'buffer':
      return buffer;
    case 'string':
      return buffer.toString();
    case 'integer':
      return parseInt(buffer.toString());
    case 'float':
      return parseFloat(buffer.toString());
    case 'boolean':
      return buffer[0] === 1;
    case 'array':
      return JSON.parse(buffer.toString());
    case 'object':
      return JSON.parse(buffer.toString());
    case 'error':
      let temp = JSON.parse(buffer.toString());
      let err = new Error(temp.message);
      err.stack = temp.stack;
      return err;
  };
};

function convertToBuffer(data) {
  let contentType, buffer;

  /* istanbul ignore else */
  if(data === undefined) {
    contentType = 'undefined';
    buffer = Buffer.from('');
  }
  else if (data === null) {
    contentType = 'null';
    buffer = Buffer.from('');
  }
  else if(data instanceof Buffer) {
    contentType = 'buffer';
    buffer = data;
  }
  else if (typeof data === 'string') {
    contentType = 'string';
    buffer = Buffer.from(data);
  }
  else if(typeof data === 'number') {
    contentType = Number.isInteger(data) ? 'integer': 'float';
    buffer = Buffer.from(data.toString());
  }
  else if (typeof data === 'boolean') {
    contentType = 'boolean';
    buffer = Buffer.from([ data ? 1 : 0 ]);
  }
  else if(Array.isArray(data)) {
    contentType = 'array';
    buffer = Buffer.from(JSON.stringify(data));
  }
  else if (data instanceof Error) {
    contentType = 'error';
    buffer = Buffer.from(JSON.stringify({ message: data.message, stack: data.stack }));
  }
  else if(typeof data === 'object') {
    contentType = 'object';
    buffer = Buffer.from(JSON.stringify(data));
  }
  return {
    contentType,
    buffer
  };
}

function generateId(length = 10) {
  let chars = 'BCDFGHJKLMNPQRSTVWXYZ';
  let max = chars.length - 1;
  let output = '';

  for(let i = 0; i < length; i ++) {
    let index = Math.floor(Math.random() * (max));
    output += chars[index];
  }

  return output;
}