import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const temp=await mkdtemp(join(tmpdir(),'studio-test-'));
process.env.PULSE_DATA_DIR=temp;process.env.NODE_ENV='test';
const {server}=await import('../server.js');
await new Promise(resolve=>server.listen(0,resolve));
const url=`ws://127.0.0.1:${server.address().port}/ws`;
async function client(){
 const ws=new WebSocket(url);ws.buf=[];ws.wait=[];
 ws.addEventListener('message',e=>{const data=JSON.parse(e.data),idx=ws.wait.findIndex(x=>x.check(data));if(idx>=0){const w=ws.wait.splice(idx,1)[0];clearTimeout(w.timeout);w.resolve(data);}else ws.buf.push(data);});
 await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));return ws;
}
function next(ws,check,ms=3000){const idx=ws.buf.findIndex(check);if(idx>=0)return Promise.resolve(ws.buf.splice(idx,1)[0]);return new Promise((resolve,reject)=>{const w={check,resolve};w.timeout=setTimeout(()=>reject(Error('Timed out')),ms);ws.wait.push(w);});}
function send(ws,msg){ws.send(JSON.stringify(msg));}
test('studio lines, stamps, erase, undo redo and pet customization remain synchronized', async()=>{
 const a=await client(),b=await client();
 send(a,{type:'create-room',clientId:randomUUID(),name:'Один'});
 const code=(await next(a,x=>x.type==='joined')).room;
 send(b,{type:'join-room',room:code,clientId:randomUUID(),name:'Два'});
 await next(b,x=>x.type==='joined');
 send(a,{type:'duo-live',points:[[20,30],[22,34]],width:5,color:'#FFABBF'});
 assert.equal((await next(b,x=>x.type==='duo-live')).color,'#FFABBF');
 send(a,{type:'duo-sketch',points:[[20,30],[28,40]],width:6,color:'#FFABBF'});
 assert.equal((await next(b,x=>x.type==='state'&&x.data.duo?.drawings?.length===1)).data.duo.drawings[0].width,6);
 send(b,{type:'duo-stamp',stamp:'star',x:100,y:40});
 await next(a,x=>x.type==='state'&&x.data.duo?.drawings?.length===2);
 send(b,{type:'duo-undo'});
 const undone=await next(a,x=>x.type==='state'&&x.data.duo?.drawings?.length===1);
 assert.equal(undone.data.duo.drawings[0].kind,undefined);
 send(b,{type:'duo-redo'});
 await next(a,x=>x.type==='state'&&x.data.duo?.drawings?.length===2);
 send(a,{type:'duo-erase',x:24,y:34});
 const erased=await next(a,x=>x.type==='state'&&x.data.duo?.drawings?.length===1);
 assert.equal(erased.data.duo.drawings[0].kind,'stamp');
 send(a,{type:'duo-challenge',seconds:30});
 const challenge=await next(b,x=>x.type==='state'&&x.data.duo?.challenge?.endAt>Date.now());
 assert.ok(challenge.data.duo.challenge.prompt);
 send(a,{type:'pet-rename',name:'Плюш'});
 assert.equal((await next(b,x=>x.type==='state'&&x.data.pet?.name==='Плюш')).data.pet.name,'Плюш');
 send(b,{type:'pet-customize',field:'skin',value:'mint'});
 assert.equal((await next(a,x=>x.type==='state'&&x.data.pet?.skin==='mint')).data.pet.skin,'mint');
 send(b,{type:'pet-customize',field:'accessory',value:'crown'});
 send(a,{type:'pet-customize',field:'room',value:'garden'});
 const themed=await next(b,x=>x.type==='state'&&x.data.pet?.room==='garden');
 assert.equal(themed.data.pet.accessory,'none','locked accessory cannot be selected');
 send(a,{type:'duo-clear'});
 await next(b,x=>x.type==='state'&&x.data.duo?.drawings?.length===0);
 a.close();b.close();
});
test('stop studio test server',async()=>{await new Promise(resolve=>server.close(resolve));await rm(temp,{force:true,recursive:true});});
