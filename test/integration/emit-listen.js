/**
 * Integration test for validation emit + listen works
 * as expected for a simple use case.
 */

import goodly from './src';

(async () => {

  let service = goodly({ name: 'test1' });
  await service.start({ brokerPath: '192.168.99.100' });

  await service.on('message', async ({ data }) => {
    console.log(data);
  });

  await service.emit('message', 'hello world');

})().catch(e => console.log(e.stack));

