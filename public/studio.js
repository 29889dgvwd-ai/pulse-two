/* PULSE TWO / Studio 3.0: freeform live drawing on a large, touch-safe surface. */
const palette=['#C9A7FF','#96E9D2','#FFABBF','#FDD57D','#F4F5FB','#8DB6FC','#FF8E6D','#34324D'];
const emotes={star:'⭐',heart:'💜',flower:'🌼',smile:'😊'};
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function paintStroke(s){
  if(s?.kind==='stamp')return '<text class="studio-stamp" x="'+Number(s.x)+'" y="'+Number(s.y)+'" font-size="20" text-anchor="middle" dominant-baseline="central">'+(emotes[s.stamp]||'⭐')+'</text>';
  if(!Array.isArray(s?.points))return '';
  return '<polyline points="'+s.points.map(p=>p.join(',')).join(' ')+'" stroke="'+(palette.includes(s.color)?s.color:palette[0])+'" stroke-width="'+Math.max(2,Math.min(12,Number(s.width)||4))+'" stroke-linecap="round" stroke-linejoin="round" fill="none" />';
}
export function studioPreview(state){
  const strokes=(state.duo?.drawings||[]).slice(-220).map(paintStroke).join('');
  const count=state.duo?.drawings?.length||0;
  return '<section class="duo-panel studio-card"><div class="duo-panel-label">03 / СОВМЕСТНАЯ СТУДИЯ</div><div class="studio-card-head"><div><h2>Рисуем вдвоём <span>🎨</span></h2><p>Большой холст, 8 красок, ластик, стикеры и испытания на время.</p></div><span class="studio-live-dot">● LIVE</span></div><button type="button" class="studio-preview" data-studio="open" aria-label="Открыть большую студию рисования"><svg viewBox="0 0 300 180" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><g>'+strokes+'</g></svg><span class="studio-preview-action">Развернуть холст ↗</span></button><div class="studio-card-footer"><span>✦ '+count+' элементов на вашем холсте</span><button type="button" class="btn primary sm" data-studio="open">Открыть студию →</button></div></section>';
}
export function installStudio(page,send,getState,toast){
  let open=false,tool='pen',color=palette[0],width=4,points=null,pointerId=null,lastLive=0,lastErase=0,sticker='heart';
  const overlay=document.createElement('section');
  overlay.id='studioOverlay';overlay.className='studio-overlay hidden';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Совместная студия рисования');
  overlay.innerHTML='<div class="studio-shell"><header class="studio-header"><div><span class="studio-kicker">PULSE TWO / ART LAB</span><h2>Наш холст <span>✳</span></h2></div><div class="studio-header-actions"><span id="studioPresence">● Соединяем вас двоих</span><button type="button" class="studio-exit" data-sact="close" aria-label="Закрыть рисовалку">✕</button></div></header>'+
    '<div class="studio-challenge"><span class="studio-challenge-symbol">✦</span><div><small>ЧЕЛЛЕНДЖ ДЛЯ ДВОИХ</small><b id="studioPrompt">Рисуйте что захочется</b></div><strong id="studioCountdown">∞</strong></div>'+
    '<div class="studio-canvas-frame"><svg id="studioCanvas" viewBox="0 0 300 180" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Рисовать пальцем или курсором"><g id="studioSaved"></g><polyline id="studioRemote" stroke="#FFABBF" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/><polyline id="studioLive" stroke="#C9A7FF" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="studio-canvas-tag">ТВОЯ СТУДИЯ · 2 ИГРОКА</div></div>'+
    '<div class="studio-toolbar"><div class="studio-tools"><button type="button" data-sact="tool" data-tool="pen" class="active">✏️ <span>Кисть</span></button><button type="button" data-sact="tool" data-tool="eraser">◌ <span>Ластик</span></button><button type="button" data-sact="tool" data-tool="stamp">✨ <span>Штампы</span></button><label class="studio-size">Толщина <input id="studioWidth" aria-label="Толщина кисти" type="range" min="2" max="12" value="4" /></label></div><div class="studio-palette" id="studioColors"></div>'+
    '<div class="studio-stamps hidden" id="studioStamps">'+Object.entries(emotes).map(([k,e])=>'<button type="button" data-sact="stamp" data-stamp="'+k+'" class="'+(k==='heart'?'active':'')+'">'+e+'</button>').join('')+'</div>'+
    '<div class="studio-lower"><div class="studio-history"><button type="button" data-sact="undo">↶ Отмена</button><button type="button" data-sact="redo" id="studioRedo">↷ Повтор</button><button type="button" class="studio-danger" data-sact="clear">Очистить</button></div><div class="studio-timers"><button type="button" data-sact="timer" data-seconds="30">⏱ 30 сек</button><button type="button" data-sact="timer" data-seconds="60">60 сек</button><button type="button" data-sact="timer" data-seconds="0">Стоп</button></div></div></div></div>';
  document.body.appendChild(overlay);
  const svg=overlay.querySelector('#studioCanvas'),live=overlay.querySelector('#studioLive'),remote=overlay.querySelector('#studioRemote'),saved=overlay.querySelector('#studioSaved');
  const colorBar=overlay.querySelector('#studioColors');
  colorBar.innerHTML=palette.map(c=>'<button type="button" data-sact="color" data-color="'+c+'" style="--swatch:'+c+'" aria-label="Цвет '+c+'" class="'+(color===c?'active':'')+'"></button>').join('');
  function setTool(next){
    tool=next;overlay.querySelectorAll('[data-sact="tool"]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
    overlay.querySelector('#studioStamps').classList.toggle('hidden',tool!=='stamp');
    svg.classList.toggle('erasing',tool==='eraser');svg.classList.toggle('stamping',tool==='stamp');
  }
  function update(state){
    if(!open||!state)return;
    saved.innerHTML=(state.duo?.drawings||[]).map(paintStroke).join('');
    overlay.querySelector('#studioRedo').disabled=!state.duo?.canRedo;
    overlay.querySelector('#studioPresence').textContent=(state.members||[]).length===2?'● Рисуйте одновременно':'○ Пригласите второго художника';
    tick(state);
  }
  function tick(state){
    if(!open||!state)return;
    const c=state.duo?.challenge||{},remain=Math.max(0,Math.ceil(((c.endAt||0)-Date.now())/1000));
    overlay.querySelector('#studioPrompt').textContent=remain?c.prompt:'Свободный режим — рисуйте что угодно';
    overlay.querySelector('#studioCountdown').textContent=remain?('0:'+String(remain).padStart(2,'0')):'∞';
  }
  function close(){open=false;overlay.classList.add('hidden');document.body.classList.remove('studio-active');points=null;pointerId=null;live.setAttribute('points','');remote.setAttribute('points','');}
  function show(){if(!getState())return;open=true;overlay.classList.remove('hidden');document.body.classList.add('studio-active');update(getState());overlay.querySelector('.studio-exit').focus({preventScroll:true});}
  page.addEventListener('click',e=>{if(e.target.closest?.('[data-studio="open"]'))show();});
  overlay.addEventListener('click',e=>{
    const btn=e.target.closest?.('button[data-sact]');if(!btn)return;
    const a=btn.dataset.sact;
    if(a==='close')close();
    if(a==='tool')setTool(btn.dataset.tool);
    if(a==='color'){color=btn.dataset.color;setTool('pen');colorBar.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.color===color));}
    if(a==='stamp'){sticker=btn.dataset.stamp;overlay.querySelectorAll('[data-sact="stamp"]').forEach(b=>b.classList.toggle('active',b.dataset.stamp===sticker));}
    if(a==='undo')send({type:'duo-undo'});
    if(a==='redo')send({type:'duo-redo'});
    if(a==='clear'&&window.confirm('Очистить общий холст? Рисунки обоих участников будут удалены.')){send({type:'duo-clear'});remote.setAttribute('points','');}
    if(a==='timer')send({type:'duo-challenge',seconds:Number(btn.dataset.seconds)});
  });
  overlay.querySelector('#studioWidth').addEventListener('input',e=>{width=Number(e.target.value);live.setAttribute('stroke-width',width);});
  document.addEventListener('keydown',e=>{if(!open)return;if(e.key==='Escape')close();else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();send({type:e.shiftKey?'duo-redo':'duo-undo'});}});
  function pos(e){
    // SVG matrices correctly handle aspect ratio and screen scaling, unlike width-only mapping.
    const matrix=svg.getScreenCTM();
    if(matrix){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());return [Math.max(0,Math.min(300,Math.round(p.x*10)/10)),Math.max(0,Math.min(180,Math.round(p.y*10)/10))];}
    const r=svg.getBoundingClientRect();
    return [Math.round(Math.max(0,Math.min(300,(e.clientX-r.left)*300/r.width))*10)/10,Math.round(Math.max(0,Math.min(180,(e.clientY-r.top)*180/r.height))*10)/10];
  }
  function drawLive(){live.setAttribute('stroke',color);live.setAttribute('stroke-width',width);live.setAttribute('points',(points||[]).map(p=>p.join(',')).join(' '));}
  function finish(){
    if(!points?.length){points=null;pointerId=null;return;}
    if(points.length===1)points.push([Math.min(300,points[0][0]+.15),points[0][1]]);
    send({type:'duo-sketch',points,color,width});
    points=null;pointerId=null;live.setAttribute('points','');
  }
  svg.addEventListener('pointerdown',e=>{
    if(!e.isPrimary)return;
    e.preventDefault();const p=pos(e);pointerId=e.pointerId;svg.setPointerCapture(e.pointerId);
    if(tool==='stamp'){send({type:'duo-stamp',stamp:sticker,x:p[0],y:p[1]});pointerId=null;return;}
    if(tool==='eraser'){send({type:'duo-erase',x:p[0],y:p[1]});lastErase=Date.now();return;}
    points=[p];drawLive();
  });
  svg.addEventListener('pointermove',e=>{
    if(e.pointerId!==pointerId)return;
    e.preventDefault();const p=pos(e);
    if(tool==='eraser'){if(Date.now()-lastErase>100){lastErase=Date.now();send({type:'duo-erase',x:p[0],y:p[1]});}return;}
    if(!points)return;
    const prev=points[points.length-1];
    if(Math.hypot(p[0]-prev[0],p[1]-prev[1])<.5)return;
    points.push(p);drawLive();
    if(Date.now()-lastLive>55){lastLive=Date.now();send({type:'duo-live',points:points.slice(-10),color,width});}
    if(points.length>=98){const tail=points[points.length-1];finish();points=[tail];pointerId=e.pointerId;}
  });
  for(const evt of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(evt,e=>{if(e.pointerId!==pointerId)return;if(tool==='pen')finish();else pointerId=null;});
  setInterval(()=>{if(open)tick(getState());},500);
  return {update, onLive(packet){if(!open||packet.from===getState()?.self)return;remote.setAttribute('stroke',palette.includes(packet.color)?packet.color:'#FFABBF');remote.setAttribute('stroke-width',Number(packet.width)||4);remote.setAttribute('points',(packet.points||[]).map(p=>p.join(',')).join(' '));clearTimeout(this.remoteTimer);this.remoteTimer=setTimeout(()=>remote.setAttribute('points',''),800);}};
}
