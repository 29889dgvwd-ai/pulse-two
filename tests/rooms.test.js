import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

const temp=await mkdtemp(join(tmpdir(),'pulse2-test-'));
process.env.PULSE_DATA_DIR=temp;
process.env.NODE_ENV='test';
const {server}=await import('../server.js');
await new Promise(resolve=>server.listen(0,resolve));
const address=`ws://127.0.0.1:${server.address().port}/ws`;

function client(){
 return new Promise((resolve,reject)=>{
  const ws=new WebSocket(address);
  ws.queue=[];ws.waiters=[];
  ws.addEventListener('message',event=>{
   const msg=JSON.parse(event.data);
   const index=ws.waiters.findIndex(x=>x.predicate(msg));
   if(index<0)ws.queue.push(msg);
   else{const waiter=ws.waiters.splice(index,1)[0];clearTimeout(waiter.timer);waiter.resolve(msg);}
  });
  ws.addEventListener('open',()=>resolve(ws),{once:true});ws.addEventListener('error',reject,{once:true});
 });
}
function received(ws,predicate,timeout=3000){
 const idx=ws.queue.findIndex(predicate);
 if(idx>=0)return Promise.resolve(ws.queue.splice(idx,1)[0]);
 return new Promise((resolve,reject)=>{
  const waiter={predicate,resolve,timer:setTimeout(()=>reject(Error('timeout awaiting message')),timeout)};
  ws.waiters.push(waiter);
 });
}
function send(ws,data){ws.send(JSON.stringify(data));}
const ids=[randomUUID(),randomUUID(),randomUUID()];

test('pairing, tasks, chat, 12 games and privacy',async()=>{
 const a=await client(),b=await client(),c=await client();
 send(a,{type:'create-room',clientId:ids[0],name:'Аня'});
 const created=await received(a,m=>m.type==='joined');
 assert.match(created.room,/^[A-Z2-9]{8}$/);
 const aState=await received(a,m=>m.type==='state');
 assert.equal(aState.data.members.length,1);
 send(b,{type:'join-room',clientId:ids[1],room:created.room,name:'Саша'});
 await received(b,m=>m.type==='joined');
 const state=await received(a,m=>m.type==='state'&&m.data.members.length===2);
 assert.equal(state.data.members.length,2);
 send(c,{type:'join-room',clientId:ids[2],room:created.room,name:'Третий'});
 assert.match((await received(c,m=>m.type==='error')).message,/двa|два/i);
 send(a,{type:'add-task',text:'Вместе покататься на велосипеде'});
 const taskState=await received(b,m=>m.type==='state'&&m.data.tasks.length===5);
 const id=taskState.data.tasks.at(-1).id;
 send(a,{type:'toggle-task',id});
 await received(b,m=>m.type==='state'&&m.data.tasks.at(-1)?.doneBy.length===1);
 send(b,{type:'toggle-task',id});
 assert.equal((await received(a,m=>m.type==='state'&&m.data.tasks.at(-1)?.doneBy.length===2)).data.tasks.at(-1).doneBy.length,2);
 send(a,{type:'chat',text:'Привет!'});
 assert.equal((await received(b,m=>m.type==='state'&&m.data.messages.at(-1)?.text==='Привет!')).data.messages.at(-1).text,'Привет!');
 send(a,{type:'pulse',kind:'highfive'});
 assert.equal((await received(b,m=>m.type==='pulse')).kind,'highfive');
 send(a,{type:'signal',data:{kind:'offer',sdp:{type:'offer',sdp:'test'}}});
 assert.equal((await received(b,m=>m.type==='signal')).data.kind,'offer');
 send(a,{type:'call-request'});
 assert.equal((await received(b,m=>m.type==='call-request')).from,ids[0]);
 send(b,{type:'call-response',accepted:true});
 assert.equal((await received(a,m=>m.type==='call-response')).accepted,true);
 send(b,{type:'signal',data:{kind:'answer',sdp:{type:'answer',sdp:'test'}}});
 assert.equal((await received(a,m=>m.type==='signal'&&m.data.kind==='answer')).data.kind,'answer');
 send(a,{type:'hangup'});
 assert.equal((await received(b,m=>m.type==='hangup')).from,ids[0]);
 // New shared experiences: hidden answers, random idea, synchronized canvas and validation.
 send(a,{type:'duo-answer',answer:'Побродить по красивому парку'});
 const sealed=await received(b,m=>m.type==='state'&&m.data.duo?.answerSet?.[ids[0]]===true);
 assert.deepEqual(sealed.data.duo.answers,{});
 assert.equal(sealed.data.duo.reveal,false);
 send(b,{type:'duo-answer',answer:'Приготовить вафли'});
 const revealed=await received(a,m=>m.type==='state'&&m.data.duo?.reveal===true);
 assert.equal(revealed.data.duo.answers[ids[1]],'Приготовить вафли');
 send(b,{type:'duo-next'});
 const next=await received(a,m=>m.type==='state'&&m.data.duo?.round===1);
 assert.deepEqual(next.data.duo.answers,{});
 send(a,{type:'duo-idea'});
 const idea=await received(b,m=>m.type==='state'&&Boolean(m.data.duo?.idea));
 assert.ok(idea.data.duo.idea.text.length>5);
 send(a,{type:'duo-sketch',color:'#C9A7FF',points:[[15,25],[20,30],[35,50]]});
 const drawn=await received(b,m=>m.type==='state'&&m.data.duo?.drawings?.length===1);
 assert.equal(drawn.data.duo.drawings[0].id,ids[0]);
 send(b,{type:'duo-undo'});
 // A user must not be allowed to remove somebody else's line.
 send(a,{type:'duo-sketch',points:[[-99,20],[2,2]],color:'#C9A7FF'});
 send(a,{type:'duo-undo'});
 const undone=await received(b,m=>m.type==='state'&&m.data.duo?.drawings?.length===0);
 assert.equal(undone.data.duo.drawings.length,0);
 // New two-person pet and mood widgets are validated and synchronized.
 send(a,{type:'pet-care',kind:'feed'});
 const fed=await received(b,m=>m.type==='state'&&m.data.pet?.xp===1);
 assert.equal(fed.data.pet.energy,89);
 send(a,{type:'pet-care',kind:'feed'});
 send(b,{type:'pet-care',kind:'play'});
 const played=await received(a,m=>m.type==='state'&&m.data.pet?.xp===2);
 assert.equal(played.data.pet.energy,77);
 send(a,{type:'mood-set',mood:'spark',note:'Пойдем на квиз?'});
 const mood=await received(b,m=>m.type==='state'&&m.data.moods?.[ids[0]]?.mood==='spark');
 assert.equal(mood.data.moods[ids[0]].note,'Пойдем на квиз?');
 send(b,{type:'mood-set',mood:'invalid',note:'bad'});
 await new Promise(r=>setTimeout(r,25));
 assert.equal(mood.data.moods[ids[1]],undefined);
 for(const type of ['ttt','connect','rps','match','memory','reaction','words','number','emoji','quiz','story','cipher']){
   send(a,{type:'start-game',game:type});
   const current=await received(b,m=>m.type==='state'&&m.data.game?.type===type);
   assert.equal(current.data.game.type,type);
   if(type==='number')assert.equal(current.data.game.secret,undefined);
   if(type==='memory')assert.ok(current.data.game.cards.every(x=>x===null));
   if(type==='cipher')assert.equal(current.data.game.word,undefined);
   if(type==='quiz'||type==='emoji')assert.equal(current.data.game.answer,undefined);
   if(type==='rps')assert.equal(current.data.game.choices,undefined);
 }
 a.close();b.close();c.close();
});

test('cleanup',async()=>{await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});});