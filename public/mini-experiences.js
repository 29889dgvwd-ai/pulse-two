/* Shared mini experiences: daily prompts, countdowns, dream boards, doodle reactions. */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const boards={travel:['🌍','Места'],food:['🍜','Еда'],media:['🎬','Смотреть'],random:['🎲','Безумные идеи']};
const fmt=t=>new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
let filter='all';
function remaining(t){
 const ms=t-Date.now();if(ms<=0)return 'Уже наступило ✨';
 const d=Math.floor(ms/86400000),h=Math.floor(ms/3600000)%24,m=Math.floor(ms/60000)%60;
 return d>0?d+' дн. '+h+' ч.':h>0?h+' ч. '+m+' мин.':Math.max(1,m)+' мин.';
}
function dream(x,me){
 return '<article class="mini-dream '+(x.done?'completed':'')+'"><button data-mini="bucket-toggle" data-id="'+esc(x.id)+'">'+(x.done?'✓':'○')+'</button><div><strong>'+esc(x.title)+'</strong><small>'+esc(boards[x.category]?.[0]||'🎲')+' '+esc(boards[x.category]?.[1]||'Идея')+'</small></div>'+(x.by===me?'<button class="mini-delete" data-mini="bucket-delete" data-id="'+esc(x.id)+'" aria-label="Удалить">×</button>':'')+'</article>';
}
export function renderMini(state,me,personName){
 const daily=state.daily||{},sent=daily.answerSet?.[me];
 const answers=daily.reveal?'<div class="daily-reveal">'+state.members.map(m=>'<article><small>'+esc(m.name)+'</small><strong>'+esc(daily.answers?.[m.id]||'—')+'</strong></article>').join('')+'</div>':state.members.length!==2?'<div class="mini-tip">Пригласи второго человека — и каждый сможет ответить на вопрос дня.</div>':sent?'<div class="mini-tip">✓ Ответ записан. Ждём второго участника.</div>':'<form data-mini-form="daily" class="mini-form"><textarea class="text-input" name="answer" maxlength="180" rows="3" placeholder="Твой неожиданный ответ..." required></textarea><button class="btn primary">Ответить →</button></form>';
 const events=(state.countdowns||[]).slice().sort((a,b)=>a.at-b.at).map(x=>'<article class="mini-event"><span>✦</span><div class="mini-event-copy"><strong>'+esc(x.title)+'</strong><small>'+fmt(x.at)+'</small></div><b data-countdown="'+x.at+'">'+remaining(x.at)+'</b>'+(x.by===me?'<button class="mini-delete" data-mini="event-delete" data-id="'+esc(x.id)+'" aria-label="Удалить">×</button>':'')+'</article>').join('')||'<p class="mini-empty">Добавьте событие, которого ждёте ✨</p>';
 const bucket=(state.bucket||[]),done=bucket.filter(x=>x.done).length,items=bucket.filter(x=>filter==='all'||x.category===filter).slice().reverse().map(x=>dream(x,me)).join('')||'<p class="mini-empty">Здесь пока пусто. Добавьте первую мечту.</p>';
 const tabs='<button data-mini="board" data-value="all" class="'+(filter==='all'?'selected':'')+'">Все</button>'+Object.entries(boards).map(([id,v])=>'<button data-mini="board" data-value="'+id+'" class="'+(filter===id?'selected':'')+'">'+v[0]+' '+v[1]+'</button>').join('');
 const reactions=(state.doodleReactions||[]).slice(-8).reverse().map(x=>'<span class="mini-reaction">'+esc(x.emoji)+' <small>'+esc(personName(x.by))+'</small></span>').join('')||'<p class="mini-empty">Реакций пока нет. Пора оценить шедевр!</p>';
 return '<section class="duo-panel mini-daily-panel"><div class="duo-panel-label">⚡ ВОПРОС НА СЕГОДНЯ</div><h2>Разговор дня</h2><div class="mini-question"><small>'+esc(daily.day||'')+'</small><strong>'+esc(daily.prompt||'Какая у вас сегодня идея?')+'</strong></div><p class="mini-description">Ответы появятся одновременно, когда ответите оба.</p>'+answers+'</section>'+
 '<section class="duo-panel mini-events-panel"><div class="duo-panel-label">⏳ НАШИ ДАТЫ</div><h2>Ждём вместе <small>'+(state.countdowns||[]).length+'/8</small></h2><p class="mini-description">Ваши встречи, поездки и поводы улыбнуться.</p><div class="mini-events">'+events+'</div><form class="mini-form mini-event-form" data-mini-form="countdown"><input class="text-input" name="title" maxlength="60" required placeholder="Название события"><input class="text-input" name="when" type="datetime-local" required aria-label="Дата и время"><button class="btn primary" '+((state.countdowns||[]).length>=8?'disabled':'')+'>+ Добавить</button></form></section>'+
 '<section class="duo-panel mini-bucket-panel"><div class="duo-panel-label">✦ НАШИ МЕЧТЫ</div><h2>Однажды сделаем <small>'+done+'/'+bucket.length+'</small></h2><p class="mini-description">Отмечайте идеи, которые превратились в историю.</p><div class="mini-board-tabs">'+tabs+'</div><div class="mini-dreams">'+items+'</div><form class="mini-form mini-bucket-form" data-mini-form="bucket"><input class="text-input" name="title" maxlength="100" required placeholder="Что обязательно попробовать?"><select class="text-input" name="category" aria-label="Категория">'+Object.entries(boards).map(([id,v])=>'<option value="'+id+'">'+v[0]+' '+v[1]+'</option>').join('')+'</select><button class="btn primary">+ Добавить</button></form></section>'+
 '<section class="duo-panel mini-react-panel"><div class="duo-panel-label">🎨 РЕАКЦИИ НА ХОЛСТ</div><h2>Оцените шедевр</h2><p class="mini-description">Смешная реакция на рисунок другого человека — один тап.</p><div class="mini-reaction-actions">'+['💜','😂','🔥','👏','✨'].map(e=>'<button data-mini="reaction" data-value="'+e+'">'+e+'</button>').join('')+'</div><div class="mini-reactions">'+reactions+'</div><button class="btn outline" data-studio="open">🎨 Рисовать вдвоём ↗</button></section>';
}
export function attachMini(page,send,getState){
 page.addEventListener('click',e=>{
  const b=e.target.closest?.('button[data-mini]');if(!b)return;
  const action=b.dataset.mini,id=b.dataset.id;
  if(action==='event-delete')send({type:'countdown-delete',id});
  if(action==='bucket-toggle')send({type:'bucket-toggle',id});
  if(action==='bucket-delete')send({type:'bucket-delete',id});
  if(action==='reaction')send({type:'doodle-react',emoji:b.dataset.value});
  if(action==='board'){
   filter=b.dataset.value;
   page.querySelectorAll('.mini-board-tabs button').forEach(n=>n.classList.toggle('selected',n.dataset.value===filter));
   const area=page.querySelector('.mini-dreams'),state=getState();
   if(area&&state){const items=state.bucket.filter(x=>filter==='all'||x.category===filter).slice().reverse();area.innerHTML=items.map(x=>dream(x,state.self)).join('')||'<p class="mini-empty">Здесь пока пусто.</p>';}
  }
 });
 page.addEventListener('submit',e=>{
  const form=e.target.closest?.('form[data-mini-form]');if(!form)return;
  e.preventDefault();e.stopImmediatePropagation();
  const v=new FormData(form);
  if(form.dataset.miniForm==='daily'){const answer=String(v.get('answer')||'').trim();if(answer)send({type:'daily-answer',answer});}
  if(form.dataset.miniForm==='countdown'){const title=String(v.get('title')||'').trim(),at=new Date(String(v.get('when')||'')).getTime();if(title&&Number.isFinite(at)){send({type:'countdown-add',title,at});form.reset();}}
  if(form.dataset.miniForm==='bucket'){const title=String(v.get('title')||'').trim(),category=String(v.get('category')||'random');if(title){send({type:'bucket-add',title,category});form.reset();}}
 },true);
 setInterval(()=>page.querySelectorAll('[data-countdown]').forEach(n=>n.textContent=remaining(Number(n.dataset.countdown))),15000);
}
