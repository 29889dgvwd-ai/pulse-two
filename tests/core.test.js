import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';
const {server,win3,winConnect,wordEnd}=await import('../server.js');

test('winning sequences and word rule',()=>{
  assert.equal(win3(['a','a','a',null,null,null,null,null,null]),'a');
  assert.equal(win3(['a','b','a','a','b','b','b','a','a']),'draw');
  const c=Array(42).fill(null);for(let col=0;col<4;col++)c[5*7+col]='player';
  assert.equal(winConnect(c),'player');
  assert.equal(wordEnd('конь'),'н');
  assert.equal(wordEnd('плащ'),'щ');
});

const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function client(port){
  const ws=new WebSocket(`ws://localhost:${port}/ws`);
  const queue=[],waiters=[];
  ws.addEventListener('message',e=>{
    const msg=JSON.parse(e.data);
    const idx=waiters.findIndex(w=>w.filter(msg));
    if(idx>=0){const [w]=waiters.splice(idx,1);clearTimeout(w.timer);w.resolve(msg);}
    else queue.push(msg);
  });
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  return {
    send(payload){ws.send(JSON.stringify(payload));},
    wait(filter,timeout=2000){
      if(typeof filter==='string'){const type=filter;filter=x=>x.type===type;}
      const idx=queue.findIndex(filter);if(idx>=0)return Promise.resolve(queue.splice(idx,1)[0]);
      return new Promise((resolve,reject)=>{
        const waiter={filter,resolve,timer:setTimeout(()=>{const pos=waiters.indexOf(waiter);if(pos>=0)waiters.splice(pos,1);reject(Error('Timeout waiting for message'));},timeout)};
        waiters.push(waiter);
      });
    },
    close(){ws.close();}
  };
}

test('two people, realtime tasks, impulses and games',async()=>{
  await new Promise(resolve=>server.listen(0,resolve));
  const port=server.address().port;
  const a=await client(port),b=await client(port),c=await client(port);
  try{
    a.send({type:'create-room',name:'Alice',clientId:'aaaa-1111-aaaa-1111'});
    const joined=await a.wait('joined');
    assert.equal(joined.room.length,8);
    await a.wait('state');
    b.send({type:'join-room',room:joined.room,name:'Bob',clientId:'bbbb-2222-bbbb-2222'});
    await b.wait('joined');
    const state=await b.wait('state');
    assert.equal(state.data.members.length,2);
    assert.equal(state.data.members.filter(m=>m.online).length,2);
    await a.wait('state');
    c.send({type:'join-room',room:joined.room,name:'Chris',clientId:'cccc-3333-cccc-3333'});
    assert.match((await c.wait('error')).message,/два человека/);

    a.send({type:'add-task',text:'Test todo'});
    const update=await a.wait(msg=>msg.type==='state'&&msg.data.tasks.some(t=>t.text==='Test todo'));
    const task=update.data.tasks.find(t=>t.text==='Test todo');
    await b.wait(msg=>msg.type==='state'&&msg.data.tasks.some(t=>t.id===task.id));
    a.send({type:'toggle-task',id:task.id});
    assert.equal((await b.wait(msg=>msg.type==='state'&&msg.data.tasks.find(t=>t.id===task.id)?.doneBy.length===1)).data.tasks.find(t=>t.id===task.id).doneBy[0],'aaaa-1111-aaaa-1111');
    await a.wait('state');
    b.send({type:'toggle-task',id:task.id});
    assert.equal((await a.wait(msg=>msg.type==='state'&&msg.data.tasks.find(t=>t.id===task.id)?.doneBy.length===2)).data.tasks.find(t=>t.id===task.id).doneBy.length,2);
    await b.wait('state');
    a.send({type:'pulse',kind:'highfive'});
    assert.equal((await b.wait('pulse')).kind,'highfive');
    await a.wait('pulse-sent');await a.wait('state');await b.wait('state');

    a.send({type:'start-game',game:'quiz'});
    const quiz=(await a.wait(msg=>msg.type==='state'&&msg.data.game?.type==='quiz')).data.game;
    assert.equal(quiz.answer,undefined,'correct choice stays server-side');
    await b.wait(msg=>msg.type==='state'&&msg.data.game?.type==='quiz');
    a.send({type:'game-action',kind:'answer',answer:0});
    const pending=(await b.wait(msg=>msg.type==='state'&&msg.data.game?.answerSet?.['aaaa-1111-aaaa-1111'])).data.game;
    assert.equal(pending.last,null,'one answer does not reveal solution');
    await a.wait('state');
    b.send({type:'game-action',kind:'answer',answer:1});
    assert.equal(typeof (await a.wait(msg=>msg.type==='state'&&msg.data.game?.last)).data.game.last.correct,'number');
    await b.wait(msg=>msg.type==='state'&&msg.data.game?.last);

    a.send({type:'start-game',game:'cipher'});
    const cipher=(await a.wait(msg=>msg.type==='state'&&msg.data.game?.type==='cipher')).data.game;
    assert.equal(cipher.word,undefined,'hidden solution stays server-side');
  } finally{
    a.close();b.close();c.close();
    await delay(80);
    await new Promise(resolve=>server.close(resolve));
  }
});
