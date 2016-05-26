
module.exports = {
  convertToBuffer,
  convertFromBuffer
};

function convertFromBuffer(contentType, buffer) {
  switch(contentType) {
    case 'buffer':
      return buffer;
    case 'object':
      return JSON.parse(buffer.toString());
    default:
      return buffer.toString();
  };
};

function convertToBuffer(data) {
  let contentType, buffer;
  if(data instanceof Buffer) {
    contentType = 'buffer';
    buffer      = data;
  }
  else if(typeof data === 'object') {
    contentType = 'object';
    buffer = new Buffer(JSON.stringify(data));
  }
  else {
    contentType = typeof data;
    buffer = new Buffer(data);
  }
  return {
    contentType,
    buffer
  };
}