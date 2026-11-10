/* PULSE TWO — client. Plain JavaScript, no build step. */
import {renderExtraFeatures,attachExtraFeatures} from './extra-features.js';
import {renderHype,attachHype} from './hype-features.js';
const $ = (s, root = document) => root.querySelector(s);
const page = $('#page');
const setup = $('#setup');
const shell = $('#appShell');
const toastBox = $('#toast');
const localKey = 'pulsetwo.session.v1';
const gameInfo = [
  {id:'ttt',name:'Крестики-нолики',sub:'Классика на скорость мысли',icon:'✕ ○',tag:'СТРАТЕГИЯ'},
  {id:'connect',name:'Четыре в ряд',sub:'Собери линию раньше другого',icon:'🔴',tag:'ДУЭЛЬ'},
  {id:'rps',name:'Камень, ножницы…',sub:'Выберите тайно и одновременно',icon:'✊',tag:'БЫСТРАЯ'},
  {id:'match',name:'Один вайб?',sub:'Узнайте, как совпадают ответы',icon:'⚡',tag:'ДЛЯ ДВОИХ'},
  {id:'memory',name:'Мемори',sub:'Находите пары карточек',icon:'🍒',tag:'ПАМЯТЬ'},
  {id:'reaction',name:'Рефлекс',sub:'Кто первым поймает сигнал?',icon:'⏱',tag:'РЕАКЦИЯ'},
  {id:'words',name:'Цепочка слов',sub:'Продолжай слово с последней буквы',icon:'💬',tag:'СЛОВА'},
  {id:'number',name:'Число-секрет',sub:'Угадай задуманное число',icon:'#',tag:'УГАДАЙКА'},
  {id:'emoji',name:'Эмодзи-загадки',sub:'Расшифруйте историю из знаков',icon:'🪐',tag:'ЗАГАДКИ'},
  {id:'quiz',name:'Блиц-квиз',sub:'Проверьте эрудицию вместе',icon:'🧠',tag:'ВИКТОРИНА'},
  {id:'story',name:'История на двоих',sub:'Пишите сюжет по очереди',icon:'✎',tag:'ТВОРЧЕСТВО'},
  {id:'cipher',name:'Расшифруй слово',sub:'Из букв соберите правильное слово',icon:'🔐',tag:'ГОНКА'},
];
const moodKinds = [
  {id:'sunny',emoji:'☀️',label:'Отлично'},
  {id:'chill',emoji:'🌿',label:'Спокойно'},
  {id:'sleepy',emoji:'🌙',label:'Устал(а)'},
  {id:'busy',emoji:'🌧️',label:'Занят(а)'},
  {id:'spark',emoji:'✨',label:'На драйве'}
];
const polls = [
  ['Горы или море?', 'Горы', 'Море'],['Кино дома или прогулка?', 'Кино дома', 'Прогулка'],
  ['Сладкое или солёное?', 'Сладкое', 'Солёное'],['Рассвет или закат?', 'Рассвет', 'Закат'],
  ['Спонтанная поездка или план?', 'Спонтанно', 'По плану'],['Кошки или собаки?', 'Кошки', 'Собаки'],
  ['Настолки или видеоигры?', 'Настолки', 'Видеоигры'],['Пицца или суши?', 'Пицца', 'Суши'],
  ['Парк или музей?', 'Парк', 'Музей'],['Комедия или детектив?', 'Комедия', 'Детектив'],
  ['Чай или какао?', 'Чай', 'Какао'],['Готовить или заказать?', 'Готовить', 'Заказать'],
  ['Уехать за город или остаться в городе?', 'За город', 'В городе'],['Танцы или караоке?', 'Танцы', 'Караоке']
];
const safe = (s) => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (globalThis.crypto?.randomUUID?.() || `uid-${Date.now()}-${Math.random().toString(36).slice(2)}-pair`);
const fmt = n => n===1?'1 дело':`${n} дел`;
let selfId = localStorage.getItem('pulsetwo.uid') || uid();
localStorage.setItem('pulsetwo.uid', selfId);
let session = null;
try {session = JSON.parse(localStorage.getItem(localKey)||'null');}catch{}
let roomState = null, ws = null, currentTab='home', reconnectTimer=null, toastTimer=null;
let calling=false, callPending=false, peerConnection=null, localStream=null, muted=false, callTimer=null;
let queuedIceCandidates=[];
let socketConnected=false, nextJoin=null;
const initialRoom = new URL(location.href).searchParams.get('room');
if(initialRoom && /^[A-Z2-9]{8}$/i.test(initialRoom)) $('#joinCode').value = initialRoom.toUpperCase();
if(session?.name) $('#setupName').value=session.name;

function statusName(id){return roomState?.members?.find(m=>m.id===id)?.name || 'Второй игрок';}
function self(){return roomState?.members?.find(m=>m.id===selfId);}
function partner(){return roomState?.members?.find(m=>m.id!==selfId);}
function partnerHere(){return !!partner()?.online;}
function send(payload){if(ws?.readyState!==WebSocket.OPEN){toast('Нет связи с сервером. Повтори чуть позже.');return false;}ws.send(JSON.stringify(payload));return true;}
function toast(msg){toastBox.textContent=msg;toastBox.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastBox.classList.remove('visible'),3100);}
function showInterface(){
  const entered=!!roomState;setup.classList.toggle('hidden',entered);shell.classList.toggle('hidden',!entered);
  if(entered){
    $('#copyRoom').innerHTML=`Код: <b>${safe(roomState.room)}</b> ⧉`;
    $('#peerStatus').textContent=partnerHere()?`● ${partner().name} в сети`:'○ Ждём второго игрока';
    $('#peerStatus').classList.toggle('online',partnerHere());
    render();
  }
}
function connect(){
  if(ws && (ws.readyState===WebSocket.OPEN || ws.readyState===WebSocket.CONNECTING))return;
  const url=`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`;
  try{ws=new WebSocket(url);}catch{toast('Не удалось установить соединение');return;}
  ws.addEventListener('open',()=>{
    socketConnected=true;
    if(nextJoin){send(nextJoin);nextJoin=null;}
    else if(session?.room)send({type:'join-room',room:session.room,name:session.name,clientId:selfId});
  });
  ws.addEventListener('message', async event=>{
    let payload;try{payload=JSON.parse(event.data);}catch{return;}
    if(payload.type==='error'){toast(payload.message);if(!roomState && session?.room){session=null;localStorage.removeItem(localKey);}return;}
    if(payload.type==='joined'){
      const name=$('#setupName').value.trim() || session?.name || 'Игрок';
      session={room:payload.room,name};localStorage.setItem(localKey,JSON.stringify(session));
      if(initialRoom)history.replaceState(null,'',location.pathname);
      return;
    }
    if(payload.type==='state'){
      const oldPartner=partner()?.online;
      roomState=payload.data;showInterface();
      if(oldPartner===false && partnerHere())toast('Второй игрок подключился! ✨');
      return;
    }
    if(payload.type==='left'){roomState=null;showInterface();return;}
    if(payload.type==='pulse'){feelPulse(payload.kind);toast(`${payload.from} отправил(а) сигнал!`);return;}
    if(payload.type==='pulse-sent'){toast('Сигнал отправлен 💫');return;}
    if(payload.type==='replaced'){toast('Эта комната открылась в другом окне.');return;}
    if(payload.type==='peer-left'){if(calling || callPending)endCall(false);toast('Второй игрок отключился');return;}
    if(payload.type==='call-request'){if(calling||callPending){send({type:'call-response',accepted:false});return;}callPending=true;$('#incomingCall').classList.remove('hidden');$('#callTitle').textContent=`${statusName(payload.from)} зовёт на голосовой разговор`;return;}
    if(payload.type==='call-response'){
      if(!payload.accepted){endCall(false);toast('Звонок отклонён');return;}
      try {await initializePeer();await makeOffer();calling=true;render();toast('Устанавливаем связь…');}
      catch(e){endCall(true);toast(`Не удалось начать звонок: ${e.message}`);}
      return;
    }
    if(payload.type==='signal'){await handleSignal(payload.data);return;}
    if(payload.type==='hangup'){endCall(false);toast('Звонок завершён');return;}
  });
  ws.addEventListener('close',()=>{
    socketConnected=false;
    if(calling||callPending)endCall(false);
    if(roomState){roomState.members.forEach(m=>m.online=false);showInterface();}
    clearTimeout(reconnectTimer);reconnectTimer=setTimeout(connect,1500);
  });
  ws.addEventListener('error',()=>{});
}
function enter(create){
  const name=$('#setupName').value.trim().slice(0,24)||'Игрок';
  const room=$('#joinCode').value.trim().toUpperCase();
  if(!create && !/^[A-HJ-NP-Z2-9]{8}$/.test(room)){toast('Введи код из 8 символов');return;}
  const msg={type:create?'create-room':'join-room',name,clientId:selfId};if(!create)msg.room=room;
  if(ws?.readyState===WebSocket.OPEN)send(msg);
  else{nextJoin=msg;connect();toast('Подключаемся…');}
}
$('#createRoom').addEventListener('click',()=>enter(true));
$('#joinForm').addEventListener('submit',e=>{e.preventDefault();enter(false);});
$('#copyRoom').addEventListener('click',()=>copyInvite());
$('#leaveRoom').addEventListener('click',()=>{
  if(calling||callPending)endCall(true);
  send({type:'leave-room'});session=null;roomState=null;localStorage.removeItem(localKey);showInterface();
});
function copyInvite(){
  if(!roomState)return;
  const url=new URL(location.origin+location.pathname);url.searchParams.set('room',roomState.room);
  if(!navigator.clipboard?.writeText){toast('Код комнаты: '+roomState.room);return;}
  navigator.clipboard.writeText(url.toString()).then(()=>toast('Ссылка-приглашение скопирована ✓'))
    .catch(()=>toast('Код комнаты: '+roomState.room));
}
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>openTab(btn.dataset.tab)));
function openTab(tab){currentTab=tab;render();window.scrollTo({top:0,behavior:'smooth'});}
function render(){
  if(!roomState)return;
  const editing=document.activeElement?.matches?.('input[name], textarea[name]')?document.activeElement:null;
  const editingForm=editing?.closest('form[data-form]')?.dataset.form;
  const editingName=editing?.name;
  const editingValue=editing?.value;
  document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===currentTab));
  $('#pageCrumb').textContent={home:'Главная',games:'Игротека',tasks:'Наши планы',connection:'Связь',together:'Вместе'}[currentTab];
  page.innerHTML={home:renderHome,games:renderGames,tasks:renderTasks,connection:renderConnection,together:renderTogether}[currentTab]();
  if(editingForm && editingName){
    const fresh=page.querySelector(`form[data-form="${editingForm}"] [name="${editingName}"]`);
    if(fresh){fresh.value=editingValue;fresh.focus({preventScroll:true});}
  }
  if(currentTab==='connection'){
    const list=$('.chat-list');if(list)list.scrollTop=list.scrollHeight;
  }
}
function heading(title,description='',extra=''){return `<div class="page-heading"><div><p class="eyebrow">PULSE TWO / ДЛЯ ДВОИХ</p><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;}
function widgetProgress(){
  const tasks=roomState.tasks||[],done=tasks.filter(t=>t.doneBy?.length===2).length;
  return {tasks,done,total:tasks.length,percent:tasks.length?Math.round(done/tasks.length*100):0};
}
function progressBars(percent,n=12){const filled=Math.round(percent*n/100);return `<div class="bars" aria-label="Выполнено ${percent}%">${Array.from({length:n},(_,i)=>`<span class="bar ${i<filled?'filled':''}"></span>`).join('')}</div>`;}
function inviteCard(){return partnerHere()?'':`<div class="room-join-banner"><div><h3>Пригласи второго игрока ↗</h3><p>Отправь код <b>${safe(roomState.room)}</b> или ссылку. В комнате могут быть только двое.</p></div><button class="btn sm primary" data-action="invite">Поделиться</button></div>`;}
function taskMini(t){const done=t.doneBy?.includes(selfId),both=t.doneBy?.length===2;return `<div class="task-mini ${both?'is-done':''}"><button class="check ${done?'checked':''}" data-action="toggle-task" data-id="${safe(t.id)}" title="Моя отметка">${done?'✓':''}</button><span>${safe(t.text)}</span>${both?'<span>✨</span>':''}</div>`;}
function renderHome(){
  const p=widgetProgress();const people=roomState.members||[];
  return `${heading('Привет, '+safe(self()?.name||'игрок')+' ✳','Маленькие приключения начинаются с одного касания.')}
  ${inviteCard()}
  <div class="grid home-grid">
    <section class="home-hero"><div class="hero-overline">ВАШЕ ПРОСТРАНСТВО</div><h2>Моменты,<br>которые <i>ваши.</i></h2><p>Игры, неожиданные сигналы и списки дел, которые здорово закрывать вместе.</p><div class="hero-art" aria-hidden="true"></div><div class="hero-actions"><button class="hero-action" data-action="nav" data-tab="games">Выбрать игру ↗</button><button class="hero-action alt" data-action="nav" data-tab="connection">Позвонить ↗</button></div></section>
    <section class="card heart-card"><div class="eyebrow">МИНИ-СИГНАЛЫ</div><h3>Тук-тук.<br>Я здесь! ♡</h3><p>Нажми кнопку — у другого человека появится сигнал. На поддерживаемых телефонах включится вибрация.</p><div class="pulse-row"><button data-action="pulse" data-kind="hello" class="pulse-btn"><b>💜</b> Привет</button><button data-action="pulse" data-kind="highfive" class="pulse-btn"><b>✋</b> Дай пять</button><button data-action="pulse" data-kind="support" class="pulse-btn"><b>✨</b> Поддержка</button></div><div class="stat-line">Отправлено сигналов вместе: ${roomState.stats?.pulses||0}</div></section>
  </div>
  <div class="section-head"><h3>Новые фишки для двоих</h3><button class="mini-link" data-action="nav" data-tab="together">Попробовать все ↗</button></div>
  <div class="grid duo-home-grid"><button class="duo-preview idea" data-action="nav" data-tab="together"><span>🎲</span><small>КОЛЕСО МОМЕНТОВ</small><b>Что будем делать сегодня?</b><i>Крутить ↗</i></button><button class="duo-preview secret" data-action="nav" data-tab="together"><span>💌</span><small>ТАЙНЫЙ ВОПРОС</small><b>Ответы откроются вместе</b><i>Ответить ↗</i></button><button class="duo-preview sketch" data-action="nav" data-tab="together"><span>✏️</span><small>ЖИВОЙ ХОЛСТ</small><b>Нарисуйте что-то вдвоём</b><i>Рисовать ↗</i></button></div>
  <div class="section-head"><h3>Ваши живые виджеты</h3><button class="mini-link" data-action="nav" data-tab="tasks">Все планы ↗</button></div>
  <div class="grid widget-grid"><section class="card soft-lav"><div class="widget-top"><div><div class="eyebrow">НАШИ МАЛЕНЬКИЕ ЦЕЛИ</div><h3>Прогресс на двоих</h3></div><span class="widget-icon">☑</span></div><div class="progress-meta"><b>${p.percent}%</b><small>${p.done} из ${p.total} выполнено вместе</small></div>${progressBars(p.percent)}<div class="task-snippet">${p.tasks.slice(0,4).map(taskMini).join('')||'<span class="muted">Добавьте первый пункт!</span>'}</div></section>
  <section class="card feature-tile"><div><div class="eyebrow">ВАШ СЕГОДНЯШНИЙ НАСТРОЙ</div><div class="big-symbol">${partnerHere()?'✳':'◌'}</div><h3>${partnerHere()?'Вы оба здесь!':'Ждём подключения…'}</h3><p>${partnerHere()?`Сейчас на связи ${safe(people.map(x=>x.name).join(' и '))}. Самое время сыграть.`:'Отправь приглашение — тогда вы сможете играть в реальном времени и общаться голосом.'}</p></div><div class="chips"><span class="chip mint">12 мини-игр</span><span class="chip pink">голосовой чат</span><span class="chip">общие задачи</span></div></section></div>
  <div class="section-head"><h3>Выбирайте настроение</h3><button class="mini-link" data-action="nav" data-tab="games">Вся игротека →</button></div>
  <div class="grid game-grid">${gameInfo.slice(0,4).map(gameTile).join('')}</div>`;
}
function gameTile(g){return `<button class="game-card" data-action="start-game" data-game="${g.id}"><span class="eyebrow">${g.tag}</span><span class="game-glyph">${g.icon}</span><b class="game-title">${g.name}</b><span class="game-sub">${g.sub}</span><span class="game-arrow">↗</span></button>`;}
function renderGames(){
  const current=roomState.game;
  return `${heading('Игротека.','12 игр для двоих — на расстоянии или сидя рядом.',`<span class="chip pink">12 ИГР</span>`)}${inviteCard()}
  ${current?`<section class="game-arena"><div class="arena-header"><div><span class="eyebrow">СЕЙЧАС ИГРАЕТЕ</span><h3>${safe(gameInfo.find(g=>g.id===current.type)?.name||'Игра')}</h3><p>Раунд ${current.round||1} · Игрок 1: ${safe(roomState.members[0]?.name||'—')} · Игрок 2: ${safe(roomState.members[1]?.name||'—')}</p></div><button class="btn sm outline" data-action="close-arena">Свернуть ↑</button></div><div class="arena-center">${gameView(current)}</div></section>`:''}
  <div class="section-head"><h3>Выбери, во что сыграть</h3><span class="label">Оба участника должны быть онлайн</span></div>
  <div class="grid game-grid">${gameInfo.map(gameTile).join('')}</div>`;
}
function whoseTurn(g){return g.turn===selfId?'Твой ход!':`Ходит ${safe(statusName(g.turn))}`;}
function winnerText(id){return id==='draw'?'Ничья! 🤝':id===selfId?'Ты победил(а)! 🏆':`${safe(statusName(id))} победил(а)!` ;}
function turnPill(g){return `<span class="status-pill ${g.turn===selfId?'positive':''}">${whoseTurn(g)}</span>`;}
function scoreView(g){if(!g.scores)return '';return `<div class="score-line">${safe(self()?.name)} <strong>${g.scores[selfId]||0} : ${g.scores[partner()?.id]||0}</strong> ${safe(partner()?.name||'Партнёр')}</div>`;}
function actionBtn(label,kind,extra=''){return `<button class="btn primary" data-action="game-action" data-kind="${kind}" ${extra}>${label}</button>`;}
function gameView(g){
  if(g.type==='ttt')return `<p class="arena-help">Собери три символа в ряд. Крестики начинают не обязательно первыми.</p><div class="flex" style="justify-content:center;margin:14px">${g.winner?`<span class="status-pill positive">${winnerText(g.winner)}</span>`:turnPill(g)}</div><div class="board-ttt">${g.board.map((v,i)=>`<button class="square ${v===roomState.members[1]?.id?'is-o':''}" ${v||g.turn!==selfId||g.winner?'disabled':''} data-action="game-action" data-kind="cell" data-index="${i}">${v?(v===roomState.members[0]?.id?'✕':'○'):''}</button>`).join('')}</div><p class="arena-help">Чтобы начать заново, выберите игру ещё раз в списке ниже.</p>`;
  if(g.type==='connect')return `<p class="arena-help">Собери четыре фишки по горизонтали, вертикали или диагонали.</p><div class="flex" style="justify-content:center;margin:14px">${g.winner?`<span class="status-pill positive">${winnerText(g.winner)}</span>`:turnPill(g)}</div><div class="connect-board">${g.board.map((v,i)=>`<button class="connect-cell" data-action="game-action" data-kind="column" data-col="${i%7}" ${g.winner||g.turn!==selfId?'disabled':''}><span class="disc ${v===roomState.members[0]?.id?'p1':v?'p2':''}"></span></button>`).join('')}</div><p class="arena-help">Нажми на столбец, чтобы опустить фишку.</p>`;
  if(g.type==='rps'){
    const chosen=g.choiceSet?.[selfId],last=g.last;return `${scoreView(g)}<p class="arena-help">Не подглядывай! Вы оба выбираете одновременно, ответы раскроются после второго хода.</p><div class="choices-row">${[['rock','✊','Камень'],['paper','✋','Бумага'],['scissors','✌️','Ножницы']].map(([id,emoji,label])=>`<button class="choice-btn" data-action="game-action" data-kind="choose" data-choice="${id}" ${chosen?'disabled':''}><span>${emoji}</span>${label}</button>`).join('')}</div>${last?`<div class="result-strip">${winnerText(last.winner)} · Раунд ${last.round}</div>`:''}${chosen?'<p class="arena-help">Твой ответ отправлен. Ждём другого игрока.</p>':''}`;
  }
  if(g.type==='match'){
    const poll=polls[g.questionIndex%polls.length],chosen=!!g.answerSet?.[selfId],last=g.last;
    return `<div class="score-line">Совпадений: <strong>${g.matches||0}</strong></div><div class="poll-card"><span class="eyebrow">ДИЛЕММА № ${g.round}</span><h3>${poll[0]}</h3><div class="poll-options">${[1,2].map((n,i)=>`<button class="poll-option" data-action="game-action" data-kind="answer" data-answer="${i}" ${chosen?'disabled':''}>${poll[n]}</button>`).join('')}</div></div>${last?`<div class="result-strip">${last.match?'Одинаковый выбор! ✨':'Вы выбрали разное — это интересно!'}<br><small>${safe(self()?.name)}: ${poll[last.answers[selfId]+1]}, ${safe(partner()?.name)}: ${poll[last.answers[partner()?.id]+1]}</small></div>${actionBtn('Следующий вопрос →','next')}`:`<p class="arena-help">${chosen?'Ответ принят! Ждём выбор другого игрока.':'Ответы скрыты, пока вы оба не выберете.'}</p>`}`;
  }
  if(g.type==='memory'){
    return `${scoreView(g)}<div class="flex" style="justify-content:center;margin:12px">${g.winner?`<span class="status-pill positive">${winnerText(g.winner)}</span>`:turnPill(g)}</div><div class="memory-board">${g.cards.map((emoji,i)=>{const matched=g.matched.includes(i),open=matched||g.opened.includes(i);return `<button class="memory-card ${matched?'matched':open?'revealed':''}" data-action="game-action" data-kind="flip" data-index="${i}" ${matched||open||g.turn!==selfId||g.busy||g.winner?'disabled':''}>${open?emoji:'✳'}</button>`;}).join('')}</div><p class="arena-help">Найди одинаковые пары. Если угадал — ходишь снова.</p>`;
  }
  if(g.type==='reaction'){
    const ready=Date.now()>=g.readyAt;
    return `${scoreView(g)}<div class="reaction-field ${ready?'ready':''}"><div class="reaction-signal">${g.winner?'🏁':ready?'🟢':'🔴'}</div><h3>${g.winner?winnerText(g.winner):ready?'ЖМИ!':'Ожидайте зелёный сигнал…'}</h3><p class="arena-help">Первое правильное нажатие выигрывает раунд.</p><button class="reaction-button" data-action="game-action" data-kind="tap" ${!ready||g.winner?'disabled':''}>НАЖАТЬ ⚡</button></div>${g.winner?`<div style="text-align:center;margin-top:18px">${actionBtn('Ещё раунд ↗','next')}</div>`:''}`;
  }
  if(g.type==='words')return `<div class="flex" style="justify-content:center">${turnPill(g)}<span class="status-pill">${safe(g.topic)}</span></div><p class="arena-help">Начинай с последней буквы предыдущего слова${g.lastLetter?`: <b>${safe(g.lastLetter.toUpperCase())}</b>`:'.'}</p><div class="words-history">${g.history.map(x=>`<span class="word-chip ${x.id===selfId?'self':''}">${safe(x.word)}</span>`).join('')||'<div class="empty-state">Первое слово за тобой или партнёром</div>'}</div><form class="word-input-row" data-form="words"><input name="word" class="text-input" minlength="2" maxlength="28" autocomplete="off" placeholder="Твоё слово…" ${g.turn!==selfId?'disabled':''} required/><button class="btn primary" ${g.turn!==selfId?'disabled':''}>Отправить →</button></form>`;
  if(g.type==='number')return `${scoreView(g)}<div class="poll-card"><span class="eyebrow">ЗАГАДАНО ЧИСЛО ОТ 1 ДО 30</span><h3>${g.winner?winnerText(g.winner):'Какое число спрятано?'}</h3><p class="arena-help">Можно угадывать в любом порядке — подсказка появится сразу.</p><form data-form="number" class="guess-grid"><input class="text-input" name="guess" type="number" min="1" max="30" required ${g.winner?'disabled':''}><button class="btn primary" ${g.winner?'disabled':''}>Угадать</button></form></div><div class="guess-history">${g.history.slice(-12).map(x=>`<span class="guess-chip">${safe(statusName(x.id))}: <b>${x.guess}</b> ${x.hint==='higher'?'↑ больше':x.hint==='lower'?'↓ меньше':'✓ верно'}</span>`).join('')}</div>${g.winner?`<p class="arena-help">${actionBtn('Новое число','next')}</p>`:''}`;
  if(['emoji','quiz'].includes(g.type)){
    const chosen=!!g.answerSet?.[selfId],last=g.last;
    return `${scoreView(g)}<div class="poll-card"><span class="eyebrow">ВОПРОС ${g.round}</span><h3 style="font-size:${g.type==='emoji'?'34px':'23px'}">${safe(g.q)}</h3><div style="display:grid;gap:9px;margin-top:21px">${g.choices.map((t,i)=>`<button class="poll-option ${last?.correct===i?'chosen':''}" data-action="game-action" data-kind="answer" data-answer="${i}" ${chosen?'disabled':''}>${safe(t)}</button>`).join('')}</div></div>${last?`<div class="result-strip">Правильный ответ: ${safe(g.choices[last.correct])} ✓<br><small>Вы оба ответили!</small></div>${actionBtn('Следующий вопрос →','next')}`:`<p class="arena-help">${chosen?'Ждём ответ второго игрока…':'Выберите ответ. Результат откроется, когда ответят оба.'}</p>`}`;
  }
  if(g.type==='story')return `<div class="flex" style="justify-content:center">${turnPill(g)}<span class="status-pill">${g.lines.length}/40 реплик</span></div><p class="arena-help">Придумайте историю вместе: по одному предложению за ход.</p><div class="story-lines">${g.lines.map(x=>`<div class="story-line ${x.id===selfId?'self':''}"><span>${safe(statusName(x.id))}</span><p>${safe(x.line)}</p></div>`).join('')||'<div class="empty-state"><span>✎</span>Начните сюжет с любого предложения.</div>'}</div><form class="word-input-row" data-form="story"><input name="line" class="text-input" maxlength="160" placeholder="Что было дальше?.." ${g.turn!==selfId||g.lines.length>=40?'disabled':''} required/><button class="btn primary" ${g.turn!==selfId||g.lines.length>=40?'disabled':''}>Добавить ↗</button></form>`;
  if(g.type==='cipher')return `${scoreView(g)}<div class="poll-card"><span class="eyebrow">ПЕРЕМЕШАННЫЕ БУКВЫ</span><h3 style="font-size:36px;letter-spacing:.15em;overflow-wrap:anywhere">${safe(g.scrambled)}</h3><p class="muted">Тема: ${safe(g.hint)}</p><form data-form="cipher" class="guess-grid"><input name="guess" class="text-input" style="width:min(220px,60vw);font-size:16px" autocomplete="off" placeholder="Слово…" maxlength="40" ${g.winner?'disabled':''} required><button class="btn primary" ${g.winner?'disabled':''}>Проверить</button></form></div>${g.winner?`<div class="result-strip">${winnerText(g.winner)}</div>${actionBtn('Новое слово →','next')}`:'<p class="arena-help">Кто первым разгадает слово — тому балл. Ошибаться можно!</p>'}<div class="guess-history">${(g.guesses||[]).slice(-6).map(x=>`<span class="guess-chip">${safe(statusName(x.id))}: ${safe(x.guess)} ${x.correct?'✓':'✕'}</span>`).join('')}</div>`;
  return '<div class="empty-view">Игра недоступна</div>';
}
function renderTogether(){
 const d=roomState.duo||{},other=partner(),myAnswer=d.answerSet?.[selfId],answerText=d.answers||{};
 const strokes=(d.drawings||[]).map(x=>`<polyline points="${x.points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${safe(x.color)}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" />`).join('');
  const pet=roomState.pet||{energy:72,joy:68,xp:0};
  const petLevel=1+Math.floor(pet.xp/6);
  const petEmoji=pet.energy<18?'😴':pet.joy>85?'🦊':'🐾';
  const myMood=roomState.moods?.[selfId];
  return `${heading('Наше «вместе».','Десять совместных активностей, синхронизированных на двух телефонах.',`<span class="chip pink">NEW · 10 ФИШЕК</span>`)}${inviteCard()}
 <div class="together-stack">
 <section class="duo-panel idea-panel"><div class="duo-panel-label">01 / СПОНТАННЫЙ ПЛАН</div><h2>Колесо моментов <span>🎲</span></h2><p>Не знаете, чем заняться? Пусть приложение придумает небольшой план для вас.</p><div class="idea-reveal">${d.idea?`<span>${safe(d.idea.emoji)}</span><strong>${safe(d.idea.text)}</strong>`:`<span>✨</span><strong>Нажми кнопку и получи идею</strong>`}</div><button data-action="duo-idea" class="btn primary">${d.idea?'Ещё идея ↻':'Удиви нас ↗'}</button></section>
 <section class="duo-panel question-panel"><div class="duo-panel-label">02 / УЗНАЙТЕ ДРУГ ДРУГА</div><h2>Тайный вопрос <span>💌</span></h2><p>Вы оба отвечаете. Чужой ответ останется тайной, пока не ответят двое.</p><div class="question-prompt"><small>ВОПРОС ${1+(d.round||0)}</small><h3>${safe(d.prompt||'Какой самый приятный момент дня?')}</h3></div>
 ${d.reveal?`<div class="duo-answers">${roomState.members.map(m=>`<div><small>${safe(m.name)}</small><strong>${safe(answerText[m.id]||'—')}</strong></div>`).join('')}</div><button data-action="duo-next" class="btn primary">Следующий вопрос →</button>`:myAnswer?`<div class="duo-wait">✓ Твой ответ сохранён. ${other?.id&&d.answerSet?.[other.id]?'Ответы готовы…':'Ждём второго человека.'}</div>`:`<form data-form="duo-answer" class="duo-answer-form"><textarea name="answer" maxlength="180" rows="2" required class="text-input" placeholder="Твой ответ (до 180 символов)…"></textarea><button class="btn primary">Запечатать ответ ↗</button></form>`}
 </section>
 <section class="duo-panel canvas-panel"><div class="duo-panel-label">03 / СОВМЕСТНОЕ ТВОРЧЕСТВО</div><h2>Рисуем вдвоём <span>✏️</span></h2><p>Рисуй пальцем. Линии появятся на экране второго человека.</p><div class="sketch-colors"><button type="button" class="color-dot picked" style="--ink:#C9A7FF" data-action="sketch-color" data-color="#C9A7FF" aria-label="Фиолетовый"></button><button type="button" class="color-dot" style="--ink:#96E9D2" data-action="sketch-color" data-color="#96E9D2" aria-label="Мятный"></button><button type="button" class="color-dot" style="--ink:#FFABBF" data-action="sketch-color" data-color="#FFABBF" aria-label="Розовый"></button><button type="button" class="color-dot" style="--ink:#FDD57D" data-action="sketch-color" data-color="#FDD57D" aria-label="Жёлтый"></button></div>
 <div class="sketch-wrap"><svg id="duoCanvas" aria-label="Общий холст для рисования" role="img" viewBox="0 0 300 180" preserveAspectRatio="none">${strokes}<polyline id="liveStroke" fill="none" stroke="#C9A7FF" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" /></svg></div>
 <div class="sketch-bottom"><span>✦ Линии сохраняются в комнате</span><button type="button" data-action="sketch-undo" class="btn outline sm">Отменить мою линию ↶</button></div>
 </section>
 <section class="duo-panel pet-panel"><div class="duo-panel-label">04 / ВАШ МАЛЕНЬКИЙ ДРУГ</div><h2>Питомец Искра <span>🐾</span></h2><p>Новый сосед комнаты: кормите, играйте и отдыхайте вместе. Каждые шесть действий — новый уровень!</p>
 <div class="pet-stage"><div class="pet-face" role="img" aria-label="Виртуальный питомец">${petEmoji}</div><div class="pet-caption"><small>УРОВЕНЬ ${petLevel}</small><strong>${pet.energy<18?'Пора отдыхать':pet.joy>85?'Искра в восторге!':'Искра ждёт вас двоих'}</strong><span>${pet.xp%6}/6 до следующего уровня</span></div></div>
 <div class="pet-meter"><span>⚡ Силы</span><div><i style="width:${pet.energy}%"></i></div><b>${pet.energy}%</b></div>
 <div class="pet-meter"><span>💗 Радость</span><div><i class="joy" style="width:${pet.joy}%"></i></div><b>${pet.joy}%</b></div>
 <div class="pet-actions"><button data-action="pet-care" data-kind="feed" class="btn soft sm">🍓 Покормить</button><button data-action="pet-care" data-kind="play" class="btn primary sm">🪁 Поиграть</button><button data-action="pet-care" data-kind="rest" class="btn outline sm">💤 Отдых</button></div>
 <div class="pet-foot">${pet.lastAction?`Последнее действие: ${safe(statusName(pet.lastAction.by))} · ${timeLabel(pet.lastAction.at)}`:'Уход синхронизируется у обоих'}</div></section>
 <section class="duo-panel mood-panel"><div class="duo-panel-label">05 / НАСТРОЕНИЕ В ПРЯМОМ ЭФИРЕ</div><h2>Как твой день? <span>💭</span></h2><p>Выбери настроение и добавь небольшую подпись. Второй человек сразу увидит обновление.</p>
 <form data-form="mood-note" class="mood-note-form"><label for="moodNote" class="field-label">Подпись (необязательно)</label><input class="text-input" name="note" id="moodNote" maxlength="80" placeholder="Например, хочу кино и какао" value="${safe(myMood?.note||'')}" /></form>
 <div class="mood-choices">${moodKinds.map(m=>`<button type="button" data-action="mood-set" data-mood="${m.id}" class="mood-choice ${myMood?.mood===m.id?'chosen':''}" aria-label="${m.label}"><span>${m.emoji}</span><small>${m.label}</small></button>`).join('')}</div>
 <div class="mood-feed">${roomState.members.map(member=>{const entry=roomState.moods?.[member.id];const opt=moodKinds.find(m=>m.id===entry?.mood);return `<div class="mood-person"><span>${opt?.emoji||'◌'}</span><div><strong>${safe(member.name)}</strong><small>${entry?`${safe(opt?.label||'')} · ${timeLabel(entry.at)}`:'Ещё не выбрал(а)'}</small>${entry?.note?`<em>${safe(entry.note)}</em>`:''}</div></div>`;}).join('')}</div>
 </section>
 ${renderExtraFeatures(roomState,selfId,safe,statusName,timeLabel)}
 ${renderHype(roomState,selfId,statusName)}
 </div>`;
}
let sketchInk='#C9A7FF',sketchPoints=null,sketchPointer=null;
function sketchPoint(e, svg){
 const rect=svg.getBoundingClientRect();return [Math.min(300,Math.max(0,Math.round((e.clientX-rect.left)/rect.width*300*10)/10)),Math.min(180,Math.max(0,Math.round((e.clientY-rect.top)/rect.height*180*10)/10))];
}
page.addEventListener('pointerdown',e=>{
 const svg=e.target.closest?.('#duoCanvas');if(!svg||!e.isPrimary)return;
 e.preventDefault();sketchPoints=[sketchPoint(e,svg)];sketchPointer=e.pointerId;svg.setPointerCapture(e.pointerId);
});
page.addEventListener('pointermove',e=>{
 const svg=e.target.closest?.('#duoCanvas');if(!svg||sketchPoints===null||e.pointerId!==sketchPointer)return;
 e.preventDefault();if(sketchPoints.length<105){sketchPoints.push(sketchPoint(e,svg));$('#liveStroke',svg).setAttribute('points',sketchPoints.map(p=>p.join(',')).join(' '));$('#liveStroke',svg).setAttribute('stroke',sketchInk);}
});
function finishSketch(e){
 if(sketchPoints===null||e.pointerId!==sketchPointer)return;
 const points=sketchPoints;sketchPoints=null;sketchPointer=null;
 if(points.length===1)points.push([Math.min(300,points[0][0]+.1),points[0][1]]);
 send({type:'duo-sketch',points,color:sketchInk});
}
page.addEventListener('pointerup',finishSketch);page.addEventListener('pointercancel',finishSketch);

function renderTasks(){
  const p=widgetProgress(),both=roomState.members.length===2;
  return `${heading('Наши планы.','Вы оба можете добавлять задачи и отмечать свою часть.')}${inviteCard()}<div class="grid task-section-grid"><section class="card"><div class="eyebrow">ОБЩИЙ ЧЕК-ЛИСТ</div><h3 style="margin:9px 0 10px">Наш маленький маршрут</h3><p class="muted">Пункт становится полностью выполненным, когда галочку поставили оба.</p>
  <div class="legend"><span>🟢 Слева — ты: ${safe(self()?.name)}</span><span>🟣 Справа — ${safe(partner()?.name||'второй игрок')}</span></div>
  ${p.tasks.map(t=>{const done=t.doneBy.length===2;return `<div class="task-row"><button class="owner-check mine ${t.doneBy.includes(selfId)?'done':''}" aria-label="Отметить свою задачу" data-action="toggle-task" data-id="${safe(t.id)}">${t.doneBy.includes(selfId)?'✓':'○'}</button><div class="task-row-name ${done?'complete':''}">${safe(t.text)}</div><div class="owner-checks"><button class="owner-check other ${partner()&&t.doneBy.includes(partner().id)?'done':''}" disabled title="Отметка партнёра">${partner()&&t.doneBy.includes(partner().id)?'✓':'○'}</button></div><button class="delete-task" data-action="remove-task" data-id="${safe(t.id)}" aria-label="Удалить задачу" title="Удалить">×</button></div>`;}).join('')||'<div class="empty-view">Пока нет дел. Добавьте идею!</div>'}
  <form class="task-add" data-form="add-task"><input name="text" maxlength="100" class="text-input" placeholder="Например: приготовить пиццу вместе" required><button class="btn primary">+ Добавить</button></form></section>
  <div><section class="card soft-purple"><div class="eyebrow">ПРОГРЕСС</div><div class="progress-meta"><b>${p.percent}%</b><small>${p.done} из ${p.total}</small></div>${progressBars(p.percent,10)}<div class="mini-progress-rows"><div><label><span>Твои отметки</span><span>${p.tasks.filter(t=>t.doneBy.includes(selfId)).length}/${p.total}</span></label><div class="barline"><div style="width:${p.total?p.tasks.filter(t=>t.doneBy.includes(selfId)).length/p.total*100:0}%"></div></div></div><div><label><span>Отметки второго игрока</span><span>${p.tasks.filter(t=>partner()&&t.doneBy.includes(partner().id)).length}/${p.total}</span></label><div class="barline mint"><div style="width:${p.total?p.tasks.filter(t=>partner()&&t.doneBy.includes(partner().id)).length/p.total*100:0}%"></div></div></div></div></section>
  <section class="card" style="margin-top:16px"><div class="eyebrow">МИКРОИДЕИ</div><h3 style="margin-top:10px">Что можно добавить?</h3><ul class="tips-list"><li>Найти новый плейлист</li><li>Устроить игровой вечер</li><li>Попробовать новое блюдо</li><li>Посмотреть на закат</li><li>Пройти 5 вопросов квиза</li></ul></section></div></div>`;
}
function timeLabel(ts){try{return new Date(ts).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});}catch{return '';}}
function renderConnection(){
  const other=partner();
  return `${heading('На связи.','Голос, сообщения и маленькие знаки внимания.')}${inviteCard()}
  <div class="connection-guide"><span class="icon">◉</span><div><b>Разговор наедине</b><p>Голос работает через WebRTC. Для доступа к микрофону сайт должен быть открыт по HTTPS или на localhost.</p></div></div>
  <div class="grid connection-grid"><section class="card call-panel"><div class="eyebrow">ГОЛОСОВОЙ ЧАТ</div><div class="call-icon">🎙</div><h3>${calling?'Вы на связи!':callPending?'Ожидаем ответа…':other?.online?`${safe(other.name)} в сети`:'Ожидаем второго игрока'}</h3><p class="muted">${calling?'Можно общаться, параллельно играя. Выключи микрофон при необходимости.':'Можно играть вместе и разговаривать голосом без отдельного приложения.'}</p><div class="call-actions">${calling?`<button class="btn primary" data-action="mute">${muted?'🎤 Включить микрофон':'🔇 Выключить микрофон'}</button><button class="btn ghost" data-action="hangup">Завершить</button>`:`<button class="btn primary" data-action="call" ${!other?.online||callPending?'disabled':''}>🎙 Позвонить</button>`}</div><p class="hint" style="margin:14px 0 0">Для звонков через разные мобильные сети может понадобиться TURN-сервер.</p></section>
  <section class="card chat-panel"><div class="flex" style="justify-content:space-between"><div><div class="eyebrow">МИНИ-ЧАТ</div><h3 style="margin-top:8px">Ваши сообщения</h3></div><span class="chip mint">только для комнаты</span></div>
  <div class="chat-list">${(roomState.messages||[]).length?roomState.messages.map(m=>`<div class="bubble ${m.from===selfId?'self':''}"><div class="bubble-sender">${safe(statusName(m.from))}</div><div class="bubble-content">${safe(m.text)}</div><div class="bubble-time">${timeLabel(m.at)}</div></div>`).join(''):'<div class="empty-state"><span>💌</span>Напишите первое сообщение.</div>'}</div><form class="chat-form" data-form="chat"><input class="text-input" name="text" maxlength="600" placeholder="Написать сообщение…" autocomplete="off" required><button class="btn primary">↗</button></form></section></div>
  <div class="section-head"><h3>Сигнал одним касанием</h3></div>
  <div class="grid game-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))"><button class="pulse-btn big" data-action="pulse" data-kind="hello"><b>💜</b> Привет</button><button class="pulse-btn big" data-action="pulse" data-kind="highfive"><b>✋</b> Дай пять</button><button class="pulse-btn big" data-action="pulse" data-kind="support"><b>✨</b> Поддержка</button></div><p class="hint" style="margin-top:14px">Вибрация зависит от устройства и браузера. В Safari на iPhone обычная веб-страница не может включать вибромотор; там показывается визуальный сигнал и можно использовать звук.</p>`;
}
page.addEventListener('click',e=>{
  const button=e.target.closest('button[data-action]');if(!button)return;
  const d=button.dataset;
  if(d.action==='nav'){openTab(d.tab);return;}
  if(d.action==='invite'){copyInvite();return;}
  if(d.action==='pet-care'){send({type:'pet-care',kind:d.kind});return;}
  if(d.action==='mood-set'){
    const note=page.querySelector('input[name="note"]')?.value||'';
    send({type:'mood-set',mood:d.mood,note});return;
  }
  if(d.action==='duo-idea'){send({type:'duo-idea'});return;}
  if(d.action==='duo-next'){send({type:'duo-next'});return;}
  if(d.action==='sketch-undo'){send({type:'duo-undo'});return;}
  if(d.action==='sketch-color'){
    sketchInk=d.color;
    page.querySelectorAll('.color-dot').forEach(dot=>dot.classList.toggle('picked',dot.dataset.color===sketchInk));return;
  }
  if(d.action==='toggle-task'){send({type:'toggle-task',id:d.id});return;}
  if(d.action==='remove-task'){send({type:'remove-task',id:d.id});return;}
  if(d.action==='pulse'){
    if(!partnerHere()){toast('Сначала пригласи второго игрока');return;}
    send({type:'pulse',kind:d.kind});button.classList.add('pulse-sent');return;
  }
  if(d.action==='start-game'){
    if(!partnerHere()){toast('Чтобы начать игру, оба игрока должны быть онлайн');return;}
    if(send({type:'start-game',game:d.game})){currentTab='games';window.scrollTo({top:0,behavior:'smooth'});}return;
  }
  if(d.action==='close-arena'){button.closest('.game-arena')?.classList.add('hidden');return;}
  if(d.action==='game-action'){
    const msg={type:'game-action',kind:d.kind};
    for(const key of ['index','col','choice','answer'])if(d[key]!==undefined)msg[key]=d[key];
    send(msg);return;
  }
  if(d.action==='call'){startCall();return;}
  if(d.action==='hangup'){endCall(true);return;}
  if(d.action==='mute'){muted=!muted;if(localStream)localStream.getAudioTracks().forEach(t=>t.enabled=!muted);render();return;}
});
page.addEventListener('submit',e=>{
  const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();
  const d=new FormData(form),type=form.dataset.form;
  if(type==='add-task'){const text=String(d.get('text')||'').trim();if(text)send({type:'add-task',text});}
  if(type==='duo-answer'){const answer=String(d.get('answer')||'').trim();if(answer)send({type:'duo-answer',answer});}
  if(type==='chat'){const text=String(d.get('text')||'').trim();if(text)send({type:'chat',text});}
  if(type==='words'){const word=String(d.get('word')||'').trim();if(word)send({type:'game-action',kind:'word',word});}
  if(type==='number'){send({type:'game-action',kind:'guess',guess:Number(d.get('guess'))});}
  if(type==='cipher'){send({type:'game-action',kind:'guess',guess:String(d.get('guess')||'').trim()});}
  if(type==='story'){send({type:'game-action',kind:'line',line:String(d.get('line')||'').trim()});}
  form.reset();
});
function feelPulse(kind){
  // Нативная обёртка Expo получает сообщение и включает тактильную отдачу на iOS.
  try{window.ReactNativeWebView?.postMessage(JSON.stringify({type:'pulse',kind}));}catch{}
  const pulses={hello:[90,45,90],highfive:[200],support:[70,50,70,50,150]};
  try{navigator.vibrate?.(pulses[kind]||[100,60,100]);}catch{}
  try {
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    if(ctx.state==='suspended')ctx.resume();
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';osc.frequency.value=650;gain.gain.setValueAtTime(.001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.045,ctx.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.18);
    osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.2);setTimeout(()=>ctx.close().catch(()=>{}),550);
  }catch{}
  const status=$('#peerStatus');status?.classList.add('pulse-sent');setTimeout(()=>status?.classList.remove('pulse-sent'),900);
}
// Voice chat — WebRTC media is end-to-end between peers when a direct connection succeeds.
const rtcConfig={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]};
async function getMicrophone(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('Микрофон доступен только по HTTPS или localhost');
  if(!localStream)localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
  return localStream;
}
async function initializePeer(){
  await getMicrophone();
  if(peerConnection)return peerConnection;
  const pc=new RTCPeerConnection(rtcConfig);peerConnection=pc;
  for(const track of localStream.getTracks())pc.addTrack(track,localStream);
  pc.onicecandidate=e=>{if(e.candidate)send({type:'signal',data:{kind:'ice',candidate:e.candidate.toJSON()}});};
  pc.ontrack=e=>{const audio=$('#remoteAudio');audio.srcObject=e.streams[0];audio.play().catch(()=>toast('Нажми на экран, чтобы включить звук'));};
  pc.onconnectionstatechange=()=>{if(['failed','closed','disconnected'].includes(pc.connectionState)){if(calling){toast('Связь прервана');endCall(true);}}};
  return pc;
}
async function makeOffer(){const pc=await initializePeer();await pc.setLocalDescription(await pc.createOffer());send({type:'signal',data:{kind:'offer',sdp:pc.localDescription.toJSON()}});}
async function startCall(){
  if(!partnerHere()||calling||callPending)return;
  try{await getMicrophone();callPending=true;send({type:'call-request'});toast('Звоним…');render();}
  catch(e){toast('Не удалось получить доступ к микрофону: '+e.message);}
}
async function handleSignal(data){
  if(!data||typeof data!=='object')return;
  try{
    if(data.kind==='offer'){
      const pc=await initializePeer();await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      await flushQueuedIce();
      await pc.setLocalDescription(await pc.createAnswer());send({type:'signal',data:{kind:'answer',sdp:pc.localDescription.toJSON()}});
      calling=true;callPending=false;render();
    } else if(data.kind==='answer' && peerConnection){await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));await flushQueuedIce();calling=true;callPending=false;render();}
    else if(data.kind==='ice'){if(peerConnection?.remoteDescription){try{await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));}catch{}}else{queuedIceCandidates.push(data.candidate);}}
  }catch(e){toast('Ошибка голосовой связи: '+e.message);endCall(true);}
}
async function flushQueuedIce(){
  while(queuedIceCandidates.length && peerConnection?.remoteDescription){
    const candidate=queuedIceCandidates.shift();try{await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));}catch{}
  }
}
function endCall(notify){
  if(notify)send({type:'hangup'});
  $('#incomingCall').classList.add('hidden');
  if(peerConnection){const pc=peerConnection;peerConnection=null;pc.onconnectionstatechange=null;pc.close();}
  if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
  const audio=$('#remoteAudio');audio.pause();audio.srcObject=null;
  calling=false;callPending=false;muted=false;queuedIceCandidates=[];
  if(roomState)render();
}
$('#acceptCall').addEventListener('click',async()=>{
  $('#incomingCall').classList.add('hidden');
  try{await initializePeer();send({type:'call-response',accepted:true});callPending=false;calling=true;render();}
  catch(e){send({type:'call-response',accepted:false});endCall(false);toast('Для звонка нужен доступ к микрофону');}
});
$('#declineCall').addEventListener('click',()=>{send({type:'call-response',accepted:false});$('#incomingCall').classList.add('hidden');callPending=false;});
setInterval(()=>{
  if(currentTab==='games' && roomState?.game?.type==='reaction' && !roomState.game.winner){
    const field=$('.reaction-field');if(!field)return;
    const ready=Date.now()>=roomState.game.readyAt;
    field.classList.toggle('ready',ready);
    const signal=$('.reaction-signal',field),title=$('h3',field),button=$('.reaction-button',field);
    if(signal)signal.textContent=ready?'🟢':'🔴';if(title)title.textContent=ready?'ЖМИ!':'Ожидайте зелёный сигнал…';
    if(button)button.disabled=!ready;
  }
},200);
if('serviceWorker' in navigator && location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
attachExtraFeatures(page,send);
attachHype(page,send,()=>roomState);
connect();