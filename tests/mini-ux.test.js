import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {renderMini} from '../public/mini-experiences.js';
import {compactHome} from '../public/compact-home.js';
import {groups,selectFeature} from '../public/compact-hub.js';

test('new UI remains short, safe and contains all features',()=>{
 const state={members:[{id:'a',name:'Тест'},{id:'b',name:'Второй'}],self:'a',tasks:[],bucket:[],countdowns:[],doodleReactions:[],daily:{day:'2026-11-10',prompt:'Весёлый вопрос?',answers:{},answerSet:{},reveal:false}};
 const html=renderMini(state,'a',id=>id==='a'?'Тест':'Второй');
 assert.match(html,/data-mini-form="daily"/);
 assert.match(html,/data-mini-form="countdown"/);
 assert.match(html,/data-mini-form="bucket"/);
 assert.match(html,/data-mini="reaction"/);
 const home=compactHome(state,{name:'<img src=x onerror=alert(1)>',online:false});
 assert.doesNotMatch(home,/<img src/);
 assert.ok(groups.flatMap(x=>x.features).length>=14,'each feature remains reachable');
 assert.equal(selectFeature('pet'),true);
 assert.equal(selectFeature('countdown'),true);
 assert.equal(selectFeature('nonexistent'),false);
});

test('daily answers, countdowns, bucket items and emoji reactions sync without leaking secrets',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pulse-mini-'));
 process.env.PULSE_DATA_DIR=dir;process.env.NODE_ENV='test';
 const {server}=await import('../server.js');
 await new Promise(resolve=>server.listen(0,resolve));
 const url='ws://127.0.0.1:'+server.address().port+'/ws';
 async function client(){
  const ws=new WebSocket(url);ws.messages=[];ws.waiters=[];
  ws.addEventListener('message',event=>{
   const m=JSON.parse(event.data),n=ws.waiters.findIndex(x=>x.check(m));
   if(n<0)ws.messages.push(m);else{const w=ws.waiters.splice(n,1)[0];clearTimeout(w.timer);w.resolve(m);}
  });
  await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));return ws;
 }
 function take(ws,check,timeout=4000){
  const idx=ws.messages.findIndex(check);if(idx>=0)return Promise.resolve(ws.messages.splice(idx,1)[0]);
  return new Promise((resolve,reject)=>{
   const w={check,resolve};w.timer=setTimeout(()=>reject(Error('message timeout')),timeout);ws.waiters.push(w);
  });
 }
 function emit(ws,msg){ws.send(JSON.stringify(msg));}
 let a,b;
 try{
  a=await client();b=await client();
  const idA=randomUUID(),idB=randomUUID();
  emit(a,{type:'create-room',clientId:idA,name:'Анна'});
  const room=(await take(a,m=>m.type==='joined')).room;
  emit(b,{type:'join-room',clientId:idB,name:'Борис',room});
  await take(b,m=>m.type==='joined');
  emit(a,{type:'daily-answer',answer:'Новый вид картофеля'});
  const sealed=await take(b,m=>m.type==='state'&&m.data.daily?.answerSet?.[idA]===true);
  assert.deepEqual(sealed.data.daily.answers,{});
  emit(b,{type:'daily-answer',answer:'Космический кот'});
  const revealed=await take(a,m=>m.type==='state'&&m.data.daily?.reveal===true);
  assert.equal(revealed.data.daily.answers[idB],'Космический кот');
  const at=Date.now()+4*86400000;
  emit(a,{type:'countdown-add',title:'Пикник ✨',at});
  const event=await take(b,m=>m.type==='state'&&m.data.countdowns?.length===1);
  assert.equal(event.data.countdowns[0].title,'Пикник ✨');
  const eventId=event.data.countdowns[0].id;
  emit(b,{type:'countdown-delete',id:eventId});
  emit(a,{type:'bucket-add',title:'Устроить вечер мемов',category:'random'});
  const dream=await take(b,m=>m.type==='state'&&m.data.bucket?.length===1);
  assert.equal(dream.data.countdowns.length,1,'partner cannot remove authors countdown');
  const dreamId=dream.data.bucket[0].id;
  emit(b,{type:'bucket-toggle',id:dreamId});
  const marked=await take(a,m=>m.type==='state'&&m.data.bucket?.[0]?.done===true);
  assert.equal(marked.data.bucket[0].changedBy,idB);
  emit(b,{type:'doodle-react',emoji:'😂'});
  const reaction=await take(a,m=>m.type==='state'&&m.data.doodleReactions?.length===1);
  assert.equal(reaction.data.doodleReactions[0].emoji,'😂');
  emit(a,{type:'countdown-delete',id:eventId});
  await take(b,m=>m.type==='state'&&m.data.countdowns?.length===0);
 }finally{
  a?.close();b?.close();
  await new Promise(resolve=>server.close(resolve));
  await rm(dir,{recursive:true,force:true});
 }
});
