// double response -> should throw execption

import goodly from './src';

(async () => {

  let service1 = goodly({ name: 'test1' });
  await service1.start({ brokerPath: '192.168.99.100' });

  let service2 = goodly({ name: 'test2' });
  await service2.start({ brokerPath: '192.168.99.100' });

  await service2.on('echo', async ({ data }, next) => {
    console.log('before');
    await next();
    console.log('after');
  });

  await service2.on('echo', async ({ data, reply }, next) => {
    console.log('replying');
    await reply('derp ' + data);
    await next();
  });

  await service2.on('echo', async ({ data, reply }) => {
    await reply('bad');
  });


  let result = await service1.request('echo', 'hello world');
  console.log(result);


})().catch(e => console.log(e.stack));

