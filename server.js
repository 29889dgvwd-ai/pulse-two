import http from 'node:http';
import {readFile, stat, mkdir, writeFile, rename} from 'node:fs/promises';
import {join, extname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket, WebSocketServer} from './ws-lite.js';
import {randomInt, randomUUID} from 'node:crypto';

const DIR = resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const PORT = Number(process.env.PORT || 3000);
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const games = ['ttt','connect','rps','match','memory','reaction','words','number','emoji','quiz','story','cipher'];
const wordTopics = ['Любые слова','Еда и напитки','Города','Животные'];
const emojiBank = [
  {q:'🍿🌙🎬',choices:['Киновечер','Космонавт','Фотосессия'],answer:0},
  {q:'🚀🌕👨‍🚀',choices:['Поездка к морю','Полёт на Луну','Зимняя прогулка'],answer:1},
  {q:'🌧️☕📖',choices:['Утро в школе','Дождливый вечер с книгой','Спортзал'],answer:1},
  {q:'🐱👑🏰',choices:['Король котов','Сонный дракон','Торт'],answer:0},
  {q:'🎂🕯️🎉',choices:['Новый год','День рождения','Отпуск'],answer:1},
  {q:'🏖️🕶️🍉',choices:['Летний отдых','Снежная буря','Концерт'],answer:0},
  {q:'🧩🕵️🔎',choices:['Тайна и расследование','Урок музыки','Пикник'],answer:0},
  {q:'🎤⭐🎶',choices:['Караоке','Библиотека','Теннис'],answer:0}
];
const quizBank = [
  {q:'У какого животного три сердца?',choices:['Осьминог','Панда','Дельфин'],answer:0},
  {q:'Какая планета известна как Красная?',choices:['Венера','Марс','Сатурн'],answer:1},
  {q:'Сколько цветов в радуге?',choices:['5','7','9'],answer:1},
  {q:'Как называется самый большой океан?',choices:['Атлантический','Индийский','Тихий'],answer:2},
  {q:'Какая птица умеет летать назад?',choices:['Колибри','Страус','Чайка'],answer:0},
  {q:'Какой металл обозначают символом Au?',choices:['Серебро','Золото','Алюминий'],answer:1},
  {q:'Сколько сторон у шестиугольника?',choices:['5','6','8'],answer:1},
  {q:'Кто написал «Маленького принца»?',choices:['Толстой','Сент-Экзюпери','Верн'],answer:1}
];
const cipherBank = [
  {word:'КОМЕТА',hint:'Космос'},{word:'МАЛИНА',hint:'Ягоды'},{word:'ПЛАНЕТА',hint:'Космос'},
  {word:'СЛОНЁНОК',hint:'Животные'},{word:'СЕКРЕТ',hint:'Тайны'},{word:'КАРНАВАЛ',hint:'Праздники'},
  {word:'ВОДОПАД',hint:'Природа'},{word:'БИНОКЛЬ',hint:'Предметы'}
];
function puzzleAt(index){const base=cipherBank[index%cipherBank.length], arr=[...base.word];for(let i=arr.length-1;i>0;i--){const j=randomInt(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];}const scrambled=arr.join('');return {...base,scrambled:scrambled===base.word?[...base.word].reverse().join(''):scrambled};} 
const polls = [
  ['Горы или море?', 'Горы', 'Море'],
  ['Кино дома или прогулка?', 'Кино дома', 'Прогулка'],
  ['Сладкое или солёное?', 'Сладкое', 'Солёное'],
  ['Рассвет или закат?', 'Рассвет', 'Закат'],
  ['Спонтанная поездка или план?', 'Спонтанно', 'По плану'],
  ['Кошки или собаки?', 'Кошки', 'Собаки'],
  ['Настолки или видеоигры?', 'Настолки', 'Видеоигры'],
  ['Пицца или суши?', 'Пицца', 'Суши'],
  ['Парк или музей?', 'Парк', 'Музей'],
  ['Комедия или детектив?', 'Комедия', 'Детектив'],
  ['Чай или какао?', 'Чай', 'Какао'],
  ['Готовить или заказать?', 'Готовить', 'Заказать'],
  ['Уехать за город или остаться в городе?', 'За город', 'В городе'],
  ['Танцы или караоке?', 'Танцы', 'Караоке']
];
const defaultTasks = [
  {id:'t1', text:'Сыграть одну игру вместе', doneBy: []},
  {id:'t2', text:'Рассказать друг другу смешную историю', doneBy: []},
  {id:'t3', text:'Придумать план на выходные', doneBy: []},
  {id:'t4', text:'Созвониться на 5 минут', doneBy: []}
];
const duoPrompts = [
  'Если бы у вас был свободный день без дел, как бы вы его провели?',
  'Какую совместную мини-традицию хочется придумать?',
  'Какой фильм можно пересмотреть хоть десять раз?',
  'Что бы вы положили в коробку воспоминаний?',
  'Где бы вы устроили уютный вечер без телефонов?',
  'Каким был бы ваш идеальный выходной?',
  'Какая суперспособность полезнее в обычный день?',
  'Что бы вы приготовили вдвоём на кухне?',
  'Какое новое место хотите открыть для себя?',
  'Какая песня точно поднимет вам настроение?',
  'Какой абсурдный праздник вы могли бы придумать?',
  'Что сделало бы эту неделю интереснее?'
];
const ideaDeck = [
  ['🎨','Нарисуйте друг друга за 60 секунд'], ['🧩','Сыграйте в три раунда мемори'],
  ['🍿','Выберите фильм монеткой'], ['📷','Покажите друг другу случайное фото'],
  ['🧠','Придумайте по три вопроса'], ['🎵','Обменяйтесь треками дня'],
  ['🌆','Спланируйте прогулку в новом месте'], ['🍪','Придумайте необычное печенье'],
  ['✨','Назовите по одной приятной мелочи дня'], ['🛸','Придумайте название своей планеты'],
  ['🕹','Устройте реванш в крестики-нолики'], ['🎭','Изобразите эмоцию без слов'],
  ['💌','Оставьте друг другу короткую записку'], ['🌿','Придумайте цель на выходные']
];
function ensureDuo(room){
  room.duo ||= {round:0,answers:{},reveal:false,idea:null,drawings:[]};
  room.duo.answers ||= {};
  room.duo.drawings ||= [];
  return room.duo;
}
function ensurePet(room){
  const previous=room.pet&&typeof room.pet==='object'?room.pet:{};
  const bound=(n,fallback)=>Number.isFinite(n)?Math.max(0,Math.min(100,n)):fallback;
  room.pet={energy:bound(previous.energy,72),joy:bound(previous.joy,68),xp:Number.isInteger(previous.xp)&&previous.xp>=0?Math.min(100000,previous.xp):0,
    lastCare:previous.lastCare&&typeof previous.lastCare==='object'?previous.lastCare:{},lastAction:previous.lastAction||null};
  return room.pet;
}
function ensureExperiences(room){
  if(!Array.isArray(room.moments))room.moments=[];
  if(!room.focus || typeof room.focus!=='object')room.focus={endAt:0,duration:0,by:null};
}
const hypeDeck=[
  '🎬 Киновечер с неожиданным фильмом?','🌆 Вечерняя прогулка по красивым улицам?',
  '🍕 Приготовить необычную пиццу вместе?','🎮 Устроить турнир из трёх игр?',
  '📸 Сделать по 5 смешных фото?','🎧 Собрать общий плейлист?',
  '🎨 Нарисовать друг друга за 2 минуты?','🌿 Выбрать маршрут через парк?',
  '🍪 Придумать собственный десерт?','🧩 Разгадать головоломку вдвоём?',
  '🌅 Посмотреть на закат вместе?','🎲 Доверить вечер случайной идее?'
];
function ensureHype(room){
  if(!room.hype || typeof room.hype!=='object')room.hype={round:0,votes:{},matches:0};
  room.hype.round=Number.isInteger(room.hype.round)&&room.hype.round>=0?room.hype.round:0;
  room.hype.votes ||= {};
  room.hype.matches=Number.isInteger(room.hype.matches)?Math.min(Math.max(0,room.hype.matches),100000):0;
  if(!Array.isArray(room.capsules))room.capsules=[];
  return room.hype;
}
const rooms = new Map();
// Local persistence. Use a persistent disk in production; some free hosting tiers erase files.
const DATA_DIR = resolve(process.env.PULSE_DATA_DIR || fileURLToPath(new URL('./data/', import.meta.url)));
const DATA_FILE = join(DATA_DIR, 'rooms.json');
let saveTimeout;
function queueSave(){
  clearTimeout(saveTimeout);
  saveTimeout=setTimeout(async()=>{
    try {
      await mkdir(DATA_DIR,{recursive:true});
      const rows=Array.from(rooms.values()).map(r=>({
        code:r.code,members:r.members.map(({id,name})=>({id,name})),
        createdAt:r.createdAt,updatedAt:r.updatedAt,tasks:r.tasks,messages:r.messages,game:r.game,stats:r.stats,lastPulse:r.lastPulse,duo:r.duo,pet:r.pet,moods:r.moods,moments:r.moments,focus:r.focus,hype:r.hype,capsules:r.capsules
      }));
      const temp=DATA_FILE+'.tmp';await writeFile(temp,JSON.stringify(rows));await rename(temp,DATA_FILE);
    }catch(err){console.error('Save failed:',err.message);}
  },400);
  saveTimeout.unref?.();
}
try {
  const rows=JSON.parse(await readFile(DATA_FILE,'utf8'));
  for(const r of rows){
    if(!r?.code || Date.now()-(r.updatedAt||r.createdAt)>30*86400000)continue;
    r.members=(r.members||[]).map(m=>({...m,ws:null}));r.emptyAt=Date.now();
    r.lastPulse=r.lastPulse||{};ensureDuo(r);ensurePet(r);r.moods ||= {};ensureExperiences(r);ensureHype(r);
    rooms.set(r.code,r);
  }
}catch(err){if(err.code!=='ENOENT')console.error('Restore failed:',err.message);}

const mimetypes = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};

const server = http.createServer(async (req, res) => {
  const uri = new URL(req.url, 'http://localhost');
  if (uri.pathname === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(JSON.stringify({status:'ok'}));
    return;
  }
  let path;
  try {path = decodeURIComponent(uri.pathname);} catch {res.writeHead(400).end('Bad request');return;}
  if (path === '/') path='/index.html';
  const target=resolve(DIR, '.'+path);
  if (!(target===DIR || target.startsWith(DIR+'/'))) {res.writeHead(403).end('Forbidden');return;}
  try {
    const fsStat=await stat(target);
    if (!fsStat.isFile()) throw Error('not file');
    const body=await readFile(target);
    res.writeHead(200, {'Content-Type':mimetypes[extname(target)]||'application/octet-stream','Cache-Control': 'no-cache','X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin'});
    res.end(body);
  } catch {res.writeHead(404).end('Not found');}
});
const wss=new WebSocketServer({server, path:'/ws', maxPayload:16000});

function send(ws, data){ if(ws && ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function code(){let candidate;do{candidate=Array.from({length:8},()=>ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join('');}while(rooms.has(candidate));return candidate;}
function text(value, max=100){return String(value??'').trim().slice(0,max);}
function fail(ws, message){send(ws,{type:'error',message});}
function membership(room,id){return room.members.find(m=>m.id===id);}
function peerSockets(room,exceptId){return room.members.filter(m=>m.id!==exceptId && m.ws?.readyState===WebSocket.OPEN).map(m=>m.ws);}
function relay(room,exceptId,obj){for(const ws of peerSockets(room,exceptId))send(ws,obj);}
function membersView(room){return room.members.map((m,i)=>({id:m.id,name:m.name,online:!!(m.ws?.readyState===WebSocket.OPEN),symbol:i?'O':'X'}));}
function viewFor(room,id){
  let game=room.game ? structuredClone(room.game) : null;
  if(game?.type==='number') delete game.secret;
  if(['quiz','emoji'].includes(game?.type)) { delete game.answer; delete game.answers; }
  if(game?.type==='cipher') delete game.word;
  if(game?.type==='memory') game.cards=game.cards.map((v,i)=>game.matched.includes(i)||game.opened.includes(i)?v:null);
  if(game?.type==='rps') {
    game.choiceSet={};for(const m of room.members)game.choiceSet[m.id]=!!game.choices[m.id];
    delete game.choices;
  }
  if(game?.type==='match'){
    game.answerSet={};for(const m of room.members)game.answerSet[m.id]=game.answers[m.id]!==undefined;
    if(!game.reveal)delete game.answers;
  }
  const duo=ensureDuo(room);
  const answerSet=Object.fromEntries(room.members.map(m=>[m.id,Boolean(duo.answers[m.id])]));
  const duoView={prompt:duoPrompts[duo.round%duoPrompts.length],round:duo.round,
    answerSet,answers:duo.reveal?duo.answers:{},reveal:duo.reveal,
    idea:duo.idea,drawings:duo.drawings};
  const hype=ensureHype(room);
  const hypeReveal=room.members.length===2&&room.members.every(m=>Object.hasOwn(hype.votes,m.id));
  const hypeView={round:hype.round,prompt:hypeDeck[hype.round%hypeDeck.length],answerSet:Object.fromEntries(room.members.map(m=>[m.id,Object.hasOwn(hype.votes,m.id)])),reveal:hypeReveal,votes:hypeReveal?hype.votes:{},match:hypeReveal&&room.members.every(m=>hype.votes[m.id]===true),matches:hype.matches};
  const capsulesView=room.capsules.map(c=>({id:c.id,by:c.by,unlockAt:c.unlockAt,at:c.at,opened:Date.now()>=c.unlockAt,...(Date.now()>=c.unlockAt?{note:c.note}:{})}));
  return {hype:hypeView,capsules:capsulesView,duo:duoView,pet:room.pet,moods:room.moods||{},moments:room.moments||[],focus:room.focus||{endAt:0,duration:0},room:room.code, members:membersView(room), self:id, tasks:room.tasks, messages:room.messages, game, stats:room.stats, createdAt:room.createdAt};
}
function broadcast(room){room.updatedAt=Date.now();for(const m of room.members)send(m.ws,{type:'state',data:viewFor(room,m.id)});queueSave();}
function initiateGame(type, ids){
  const common={type,round:1};
  if(type==='ttt')return {...common,board:Array(9).fill(null),turn:ids[randomInt(ids.length)],winner:null};
  if(type==='connect')return {...common,board:Array(42).fill(null),turn:ids[randomInt(ids.length)],winner:null};
  if(type==='rps')return {...common,choices:{},last:null,scores:Object.fromEntries(ids.map(id=>[id,0]))};
  if(type==='match')return {...common,questionIndex:randomInt(polls.length),prompt:null,answers:{},reveal:false,last:null,matches:0};
  if(type==='memory'){
    const symbols=['🌙','🍓','🪐','🐸','🍀','🦋','☕','🎧','🍕','✨'];
    const cards=[...symbols,...symbols].sort(()=>Math.random()-.5);
    return {...common,cards,matched:[],opened:[],turn:ids[randomInt(ids.length)],scores:Object.fromEntries(ids.map(id=>[id,0])),busy:false,winner:null};
  }
  if(type==='reaction')return {...common,readyAt:Date.now()+randomInt(1800,3900),winner:null,scores:Object.fromEntries(ids.map(id=>[id,0]))};
  if(type==='words')return {...common,topic:wordTopics[randomInt(wordTopics.length)],turn:ids[randomInt(ids.length)],history:[],used:[],lastLetter:null};
  if(type==='number')return {...common,secret:randomInt(1,31),winner:null,history:[],scores:Object.fromEntries(ids.map(id=>[id,0]))};
  if(type==='emoji'||type==='quiz'){
    const items=type==='emoji'?emojiBank:quizBank,item=items[randomInt(items.length)];
    return {...common,questionIndex:items.indexOf(item),q:item.q,choices:item.choices,answer:item.answer,answers:{},answerSet:{},last:null,scores:Object.fromEntries(ids.map(id=>[id,0]))};
  }
  if(type==='story')return {...common,lines:[],turn:ids[randomInt(ids.length)]};
  if(type==='cipher'){
    const index=randomInt(cipherBank.length),p=puzzleAt(index);
    return {...common,index,scrambled:p.scrambled,hint:p.hint,word:p.word,winner:null,guesses:[],scores:Object.fromEntries(ids.map(id=>[id,0]))};
  }
  return null;
}
function nextPlayer(ids,id){return ids.find(x=>x!==id) || id;}
function win3(board){const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const [a,b,c] of lines)if(board[a] && board[a]===board[b] && board[b]===board[c])return board[a];return board.every(Boolean)?'draw':null;}
function winConnect(board){
  for(let row=0;row<6;row++)for(let col=0;col<7;col++){
    const a=board[row*7+col];if(!a)continue;
    for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){
      let okay=true;
      for(let i=1;i<4;i++){const r=row+dr*i,c=col+dc*i;if(r<0||r>5||c<0||c>6||board[r*7+c]!==a){okay=false;break;}}
      if(okay)return a;
    }
  }
  return board.every(Boolean)?'draw':null;
}
function wordEnd(word){const stripped=word.toLowerCase().replace(/[ьъы]+$/g,'');return Array.from(stripped).at(-1)||null;}
function changeGame(room, member, action){
  const g=room.game;if(!g)return;
  const ids=room.members.map(m=>m.id), id=member.id, kind=text(action.kind,30);
  if(g.type==='ttt' && kind==='cell'){
    const index=Number(action.index);
    if(g.winner||g.turn!==id||!Number.isInteger(index)||index<0||index>=9||g.board[index])return;
    g.board[index]=id;g.winner=win3(g.board);if(!g.winner)g.turn=nextPlayer(ids,id);
  }
  if(g.type==='connect' && kind==='column'){
    const col=Number(action.col);
    if(g.winner||g.turn!==id||!Number.isInteger(col)||col<0||col>6)return;
    let row=-1;for(let r=5;r>=0;r--)if(!g.board[r*7+col]){row=r;break;}
    if(row<0)return;
    g.board[row*7+col]=id;g.winner=winConnect(g.board);if(!g.winner)g.turn=nextPlayer(ids,id);
  }
  if(g.type==='rps' && kind==='choose'){
    if(!['rock','paper','scissors'].includes(action.choice)||g.choices[id])return;
    g.choices[id]=action.choice;
    if(ids.every(i=>g.choices[i])){
      const a=g.choices[ids[0]],b=g.choices[ids[1]],beats={rock:'scissors',scissors:'paper',paper:'rock'};
      const winner=a===b?'draw':(beats[a]===b?ids[0]:ids[1]);
      if(winner!=='draw')g.scores[winner]++;
      g.last={choices:{...g.choices},winner,round:g.round};g.round++;g.choices={};
    }
  }
  if(g.type==='match' && kind==='answer'){
    if(g.reveal||g.answers[id]!==undefined||![0,1].includes(Number(action.answer)))return;
    g.answers[id]=Number(action.answer);
    if(ids.every(i=>g.answers[i]!==undefined)){
      g.reveal=true;
      g.last={answers:{...g.answers},match:g.answers[ids[0]]===g.answers[ids[1]]};
      if(g.last.match)g.matches++;
    }
  }
  if(g.type==='match' && kind==='next'){
    if(!g.reveal)return;
    g.questionIndex=(g.questionIndex+1)%polls.length;g.round++;g.answers={};g.reveal=false;g.last=null;
  }
  if(g.type==='memory' && kind==='flip'){
    const idx=Number(action.index);
    if(g.winner||g.busy||g.turn!==id||!Number.isInteger(idx)||idx<0||idx>=g.cards.length||g.matched.includes(idx)||g.opened.includes(idx))return;
    g.opened.push(idx);
    if(g.opened.length===2){
      const [a,b]=g.opened;
      if(g.cards[a]===g.cards[b]){
        g.matched.push(a,b);g.scores[id]++;
        g.opened=[];
        if(g.matched.length===g.cards.length)g.winner=g.scores[ids[0]]===g.scores[ids[1]]?'draw':(g.scores[ids[0]]>g.scores[ids[1]]?ids[0]:ids[1]);
      }else{
        g.busy=true;
        const original=g;
        setTimeout(()=>{
          if(room.game!==original)return;
          g.opened=[];g.busy=false;g.turn=nextPlayer(ids,id);broadcast(room);
        },1000);
      }
    }
  }
  if(g.type==='reaction' && kind==='tap'){
    if(g.winner||Date.now()<g.readyAt)return;
    g.winner=id;g.scores[id]++;
  }
  if(g.type==='reaction' && kind==='next'){
    if(!g.winner)return;g.round++;g.winner=null;g.readyAt=Date.now()+randomInt(1800,3900);
  }
  if(g.type==='words' && kind==='word'){
    const word=text(action.word,28).toLocaleLowerCase('ru-RU');
    if(g.turn!==id||!(/^[а-яёa-z-]{2,28}$/i.test(word))||g.used.includes(word))return;
    if(g.lastLetter && !word.startsWith(g.lastLetter))return;
    g.used.push(word);g.history.push({id,word});g.lastLetter=wordEnd(word);g.turn=nextPlayer(ids,id);
  }
  if(['quiz','emoji'].includes(g.type) && kind==='answer'){
    const a=Number(action.answer);
    if(g.answers[id]!==undefined||!Number.isInteger(a)||a<0||a>=g.choices.length)return;
    g.answers[id]=a;g.answerSet[id]=true;
    if(ids.every(i=>g.answers[i]!==undefined)){
      for(const i of ids)if(g.answers[i]===g.answer)g.scores[i]++;
      g.last={answers:{...g.answers},correct:g.answer};
    }
  }
  if(['quiz','emoji'].includes(g.type) && kind==='next'){
    if(!g.last)return;
    const items=g.type==='emoji'?emojiBank:quizBank;
    g.questionIndex=(g.questionIndex+1)%items.length;
    const item=items[g.questionIndex];g.q=item.q;g.choices=item.choices;g.answer=item.answer;
    g.round++;g.answers={};g.answerSet={};g.last=null;
  }
  if(g.type==='story' && kind==='line'){
    const line=text(action.line,160);
    if(!line||g.turn!==id||g.lines.length>=40)return;
    g.lines.push({id,line});g.turn=nextPlayer(ids,id);
  }
  if(g.type==='cipher' && kind==='guess'){
    const guess=text(action.guess,40).toLocaleUpperCase('ru-RU');
    if(g.winner||!guess)return;
    g.guesses.push({id,guess,correct:guess===g.word});g.guesses=g.guesses.slice(-12);
    if(guess===g.word){g.winner=id;g.scores[id]++;}
  }
  if(g.type==='cipher' && kind==='next'){
    if(!g.winner)return;
    g.index=(g.index+1)%cipherBank.length;
    const p=puzzleAt(g.index);g.word=p.word;g.scrambled=p.scrambled;g.hint=p.hint;
    g.round++;g.winner=null;g.guesses=[];
  }
  if(g.type==='number' && kind==='guess'){
    const guess=Number(action.guess);
    if(g.winner||!Number.isInteger(guess)||guess<1||guess>30)return;
    g.history.push({id,guess,hint:guess===g.secret?'correct':guess>g.secret?'lower':'higher'});
    if(g.history.length>40)g.history.shift();
    if(guess===g.secret){g.winner=id;g.scores[id]++;}
  }
  if(g.type==='number' && kind==='next'){
    if(!g.winner)return;g.round++;g.secret=randomInt(1,31);g.winner=null;g.history=[];
  }
  broadcast(room);
}
function enterRoom(ws, payload, create=false){
  if(ws.room) {fail(ws,'Вы уже в комнате.');return;}
  let room;
  const clientId=text(payload.clientId,80);
  const name=text(payload.name,24)||'Игрок';
  if(!/^[a-zA-Z0-9-]{12,80}$/.test(clientId)){fail(ws,'Неверный идентификатор устройства.');return;}
  if(create){
    room={code:code(),members:[],createdAt:Date.now(),updatedAt:Date.now(),tasks:structuredClone(defaultTasks),messages:[],game:null,stats:{pulses:0},lastPulse:{},duo:{round:0,answers:{},reveal:false,idea:null,drawings:[]},pet:{energy:72,joy:68,xp:0,lastCare:{},lastAction:null},moods:{},moments:[],focus:{endAt:0,duration:0,by:null},hype:{round:0,votes:{},matches:0},capsules:[],emptyAt:null};
    rooms.set(room.code,room);
  } else {
    room=rooms.get(text(payload.room,12).toUpperCase());
    if(!room){fail(ws,'Комната не найдена. Проверьте код.');return;}
  }
  let m=membership(room,clientId);
  if(!m && room.members.length>=2){fail(ws,'В комнате уже два человека.');return;}
  if(!m){m={id:clientId,name,ws};room.members.push(m);}else{
    if(m.ws && m.ws!==ws){send(m.ws,{type:'replaced'});m.ws.close();}
    m.ws=ws;m.name=name;
  }
  ws.room=room;ws.clientId=clientId;room.emptyAt=null;
  send(ws,{type:'joined',room:room.code});broadcast(room);
}
function disconnect(ws){
  const room=ws.room;if(!room)return;
  const member=membership(room,ws.clientId);
  if(member?.ws===ws){member.ws=null;relay(room,ws.clientId,{type:'peer-left'});broadcast(room);}
  if(room.members.every(m=>!m.ws || m.ws.readyState!==WebSocket.OPEN))room.emptyAt=Date.now();
  ws.room=null;
}
wss.on('connection',ws=>{
  ws.alive=true;
  ws.on('pong',()=>{ws.alive=true;});
  ws.on('message',raw=>{
    let msg;try{msg=JSON.parse(raw.toString());}catch{return;}
    if(!msg || typeof msg!=='object')return;
    if(msg.type==='create-room')return enterRoom(ws,msg,true);
    if(msg.type==='join-room')return enterRoom(ws,msg,false);
    const room=ws.room,id=ws.clientId;
    if(!room || membership(room,id)?.ws!==ws)return;
    if(msg.type==='leave-room'){disconnect(ws);send(ws,{type:'left'});return;}
    if(msg.type==='add-task'){
      const label=text(msg.text,100);
      if(!label||room.tasks.length>=30)return;
      room.tasks.push({id:randomUUID(),text:label,doneBy:[]});broadcast(room);return;
    }
    if(msg.type==='toggle-task'){
      const task=room.tasks.find(t=>t.id===text(msg.id,90));if(!task)return;
      const ix=task.doneBy.indexOf(id);if(ix===-1)task.doneBy.push(id);else task.doneBy.splice(ix,1);
      broadcast(room);return;
    }
    if(msg.type==='remove-task'){
      room.tasks=room.tasks.filter(t=>t.id!==text(msg.id,90));broadcast(room);return;
    }
    if(msg.type==='duo-answer'){
      const duo=ensureDuo(room),answer=text(msg.answer,180);
      if(!answer || duo.reveal || duo.answers[id] || room.members.length!==2)return;
      duo.answers[id]=answer;
      if(room.members.every(m=>duo.answers[m.id]))duo.reveal=true;
      broadcast(room);return;
    }
    if(msg.type==='duo-next'){
      const duo=ensureDuo(room);
      if(!duo.reveal)return;
      duo.round++;duo.answers={};duo.reveal=false;
      broadcast(room);return;
    }
    if(msg.type==='duo-idea'){
      const duo=ensureDuo(room);
      let idx=randomInt(ideaDeck.length);
      if(duo.idea && ideaDeck.length>1){while(idx===duo.idea.index)idx=randomInt(ideaDeck.length);}
      duo.idea={index:idx,emoji:ideaDeck[idx][0],text:ideaDeck[idx][1],at:Date.now()};
      broadcast(room);return;
    }
    if(msg.type==='duo-sketch'){
      const duo=ensureDuo(room);
      const pts=Array.isArray(msg.points)?msg.points:[];
      if(pts.length<2 || pts.length>110)return;
      const points=pts.map(p=>Array.isArray(p)&&p.length===2?[Number(p[0]),Number(p[1])]:null);
      if(points.some(p=>!p || p.some(n=>!Number.isFinite(n)||n<0||n>300)))return;
      const clean=points.map(p=>p.map(n=>Math.round(n*10)/10));
      const color=['#C9A7FF','#96E9D2','#FFABBF','#FDD57D'].includes(msg.color)?msg.color:'#C9A7FF';
      duo.drawings.push({id,points:clean,color});duo.drawings=duo.drawings.slice(-100);
      broadcast(room);return;
    }
    if(msg.type==='duo-undo'){
      const duo=ensureDuo(room),idx=duo.drawings.findLastIndex(d=>d.id===id);
      if(idx>=0){duo.drawings.splice(idx,1);broadcast(room);}return;
    }
    if(msg.type==='hype-vote'){
      const hype=ensureHype(room);
      if(room.members.length!==2 || typeof msg.answer!=='boolean' || Object.hasOwn(hype.votes,id))return;
      hype.votes[id]=msg.answer;
      if(room.members.every(m=>Object.hasOwn(hype.votes,m.id)) && room.members.every(m=>hype.votes[m.id]===true))hype.matches++;
      broadcast(room);return;
    }
    if(msg.type==='hype-next'){
      const hype=ensureHype(room);
      if(room.members.length!==2 || !room.members.every(m=>Object.hasOwn(hype.votes,m.id)))return;
      hype.round++;hype.votes={};broadcast(room);return;
    }
    if(msg.type==='capsule-add'){
      ensureHype(room);
      const note=text(msg.note,180),minutes=Number(msg.minutes);
      if(!note||![10,1440,10080].includes(minutes)||room.capsules.length>=20)return;
      room.capsules.push({id:randomUUID(),by:id,note,at:Date.now(),unlockAt:Date.now()+minutes*60000});
      broadcast(room);return;
    }
    if(msg.type==='capsule-delete'){
      ensureHype(room);
      const capId=text(msg.id,90),size=room.capsules.length;
      room.capsules=room.capsules.filter(c=>!(c.id===capId && c.by===id));
      if(room.capsules.length!==size)broadcast(room);
      return;
    }
    if(msg.type==='capsule-refresh'){
      ensureHype(room);
      if(room.capsules.some(c=>c.unlockAt<=Date.now()))broadcast(room);
      return;
    }
    if(msg.type==='moment-add'){
      ensureExperiences(room);
      const note=text(msg.note,160), emoji=text(msg.emoji,8);
      if(!note || !['✨','🎮','🎬','🌿','💜'].includes(emoji))return;
      room.moments.push({id:randomUUID(),by:id,note,emoji,at:Date.now()});
      room.moments=room.moments.slice(-30);
      broadcast(room);return;
    }
    if(msg.type==='moment-delete'){
      ensureExperiences(room);
      const target=text(msg.id,80),count=room.moments.length;
      room.moments=room.moments.filter(item=>!(item.id===target&&item.by===id));
      if(room.moments.length!==count)broadcast(room);
      return;
    }
    if(msg.type==='focus-start'){
      ensureExperiences(room);
      const minutes=Number(msg.minutes),now=Date.now();
      if(![3,5,10].includes(minutes) || room.focus.endAt>now)return;
      room.focus={endAt:now+minutes*60000,duration:minutes,by:id};
      broadcast(room);return;
    }
    if(msg.type==='focus-stop'){
      ensureExperiences(room);
      if(room.focus.endAt>Date.now()){
        room.focus={endAt:0,duration:0,by:id};broadcast(room);
      }
      return;
    }
    if(msg.type==='pet-care'){
      const kind=text(msg.kind,10),pet=ensurePet(room),now=Date.now();
      if(!['feed','play','rest'].includes(kind))return;
      if(now-(pet.lastCare[id]||0)<5000)return;
      if(kind==='play'&&pet.energy<12){fail(ws,'Питомцу нужен отдых или еда.');return;}
      pet.lastCare[id]=now;
      if(kind==='feed'){pet.energy=Math.min(100,pet.energy+17);pet.joy=Math.min(100,pet.joy+4);}
      if(kind==='play'){pet.energy=Math.max(0,pet.energy-12);pet.joy=Math.min(100,pet.joy+22);}
      if(kind==='rest'){pet.energy=Math.min(100,pet.energy+22);pet.joy=Math.min(100,pet.joy+2);}
      pet.xp=Math.min(100000,pet.xp+1);pet.lastAction={kind,by:id,at:now};
      broadcast(room);return;
    }
    if(msg.type==='mood-set'){
      const mood=text(msg.mood,16);
      if(!['sunny','chill','sleepy','busy','spark'].includes(mood))return;
      room.moods ||= {};
      room.moods[id]={mood,note:text(msg.note,80),at:Date.now()};
      broadcast(room);return;
    }
    if(msg.type==='chat'){
      const body=text(msg.text,600);if(!body)return;
      room.messages.push({id:randomUUID(),from:id,text:body,at:Date.now()});
      room.messages=room.messages.slice(-80);broadcast(room);return;
    }
    if(msg.type==='pulse'){
      if(!peerSockets(room,id).length){fail(ws,'Партнёр пока не в сети.');return;}
      if(Date.now()-(room.lastPulse[id]||0)<3000){fail(ws,'Маленькая пауза между сигналами.');return;}
      room.lastPulse[id]=Date.now();room.stats.pulses++;
      const value=['hello','highfive','support'].includes(msg.kind)?msg.kind:'hello';
      relay(room,id,{type:'pulse',kind:value,from:membership(room,id).name});
      send(ws,{type:'pulse-sent',kind:value});broadcast(room);return;
    }
    if(msg.type==='start-game'){
      if(!games.includes(msg.game)||room.members.length!==2||peerSockets(room,id).length!==1){fail(ws,'Для игры нужно, чтобы оба были онлайн.');return;}
      room.game=initiateGame(msg.game,room.members.map(m=>m.id));broadcast(room);return;
    }
    if(msg.type==='game-action'){if(room.members.length===2 && room.game)changeGame(room,membership(room,id),msg);return;}
    if(['call-request','call-response','signal','hangup'].includes(msg.type)){
      if(msg.type==='signal' && JSON.stringify(msg.data||{}).length>10000)return;
      relay(room,id,{type:msg.type,from:id,accepted:msg.accepted===true,data:msg.data});return;
    }
  });
  ws.on('close',()=>disconnect(ws));ws.on('error',()=>{});
});
setInterval(()=>{
  for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}
  for(const [code,r] of rooms)if(r.emptyAt && Date.now()-(r.updatedAt||r.createdAt)>30*24*60*60*1000){rooms.delete(code);queueSave();}
},30000).unref();

if(process.env.NODE_ENV!=='test')server.listen(PORT,()=>console.log(`PULSE TWO работает: http://localhost:${PORT}`));
export {server,rooms,initiateGame,win3,winConnect,wordEnd,changeGame};