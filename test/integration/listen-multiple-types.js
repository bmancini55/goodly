// basic listening and emitting with multiple response types

import goodly from './src';

(async () => {

  let service = goodly({ name: 'test1' });
  await service.start({ brokerPath: '192.168.99.100' });

  await service.on('message', async ({ data }) => {
    console.log(data);
  });

  await service.emit('message', 'string');
  //await service.emit('message', 1);
  //await service.emit('message', true);
  await service.emit('message', { message: 'object' });
  await service.emit('message', new Buffer('buffered text'));

})().catch(e => console.log(e.stack));

