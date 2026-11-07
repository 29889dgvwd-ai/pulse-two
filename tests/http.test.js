import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';
const {server}=await import('../server.js');

test('health, site served, private source not exposed', async()=>{
  await new Promise(resolve=>server.listen(0,resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const health=await fetch(base+'/health');
    assert.equal(health.status,200);
    assert.deepEqual(await health.json(),{status:'ok'});
    const html=await fetch(base+'/');
    assert.equal(html.status,200);
    assert.match(await html.text(),/PULSE TWO/);
    const script=await fetch(base+'/app.js');
    assert.equal(script.status,200);
    assert.match(script.headers.get('content-type'),/javascript/);
    const serverSource=await fetch(base+'/server.js');
    assert.equal(serverSource.status,404);
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});
