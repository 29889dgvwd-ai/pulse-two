/* PULSE TWO — original shared "Swipe Match" and Time Capsule. */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function when(t){try{return new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return '';}}
export function renderHype(state,me,statusName){
  const vibe=state.hype||{};
  const voted=Boolean(vibe.answerSet?.[me]);
  const count=Number(vibe.matches||0);
  const people=Array.isArray(state.members)?state.members:[];
  const result=vibe.reveal
    ?'<div class="hype-result '+(vibe.match?'hype-success':'')+'"><strong>'+(vibe.match?'💫 МЭТЧ! Оба за этот план':'✨ В этот раз вкусы разные')+'</strong><div class="hype-votes">'+people.map(m=>'<span>'+esc(m.name)+': '+(vibe.votes?.[m.id]?'💜 За':'🌙 Не сейчас')+'</span>').join('')+'</div></div><button class="btn primary" data-hype="next">Ещё карточку →</button>'
    :'<div class="hype-vote-actions">'+(voted?'<div class="hype-wait">✓ Твой выбор записан. Ждём второго человека.</div>':'<button class="btn primary" data-hype="vote" data-answer="yes">💜 Хочу!</button><button class="btn outline" data-hype="vote" data-answer="no">🌙 Не сейчас</button>')+'</div>';
  const cards=(state.capsules||[]).slice().reverse().map(c=>{
    const revealed=Boolean(c.opened);
    return '<div class="hype-capsule '+(revealed?'unlocked':'locked')+'"><div class="hype-capsule-mark">'+(revealed?'💌':'🔒')+'</div><div class="hype-capsule-info"><small>'+esc(statusName(c.by))+' · '+(revealed?'Открыто':'Откроется '+when(c.unlockAt))+'</small><strong>'+(revealed?esc(c.note):'Секретная записка')+'</strong></div>'+(c.by===me?'<button data-hype="delete" data-id="'+esc(c.id)+'" aria-label="Удалить капсулу" class="hype-delete">×</button>':'')+'</div>';
  }).join('')||'<div class="empty-state">Пока капсул нет. Оставьте первый сюрприз ✦</div>';
  const done=(state.tasks||[]).filter(t=>(t.doneBy||[]).length===2).length;
  const badges=[
    ['✋','Первый сигнал',(state.stats?.pulses||0)>0],
    ['☑','Общий план',done>0],
    ['🫙','Коллекционеры',(state.moments||[]).length>0],
    ['💫','Один вайб',count>0],
    ['💌','Письмо в будущее',(state.capsules||[]).length>0]
  ];
  return '<section class="duo-panel hype-match"><div class="duo-panel-label">08 / НАШИ СОВПАДЕНИЯ</div><h2>Свайп-мэтч <span>💫</span></h2><p>Оба выбирают втайне. Узнайте, на какой план совпали желания. Выбор откроется только после двух ответов.</p><div class="hype-story"><span class="hype-kicker">КАРТОЧКА '+(Number(vibe.round||0)+1)+'</span><strong>'+esc(vibe.prompt||'Как насчёт совместного приключения?')+'</strong><span>Совпадений: '+count+'</span></div>'+result+'</section>'+
  '<section class="duo-panel hype-time"><div class="duo-panel-label">09 / ПИСЬМО В БУДУЩЕЕ</div><h2>Капсула времени <span>💌</span></h2><p>Напишите короткую записку: она будет запечатана и откроется обоим в назначенное время.</p><form data-form="hype-capsule" class="hype-capsule-form"><textarea class="text-input" name="note" maxlength="180" required rows="2" placeholder="Что хочется сохранить для нас?"></textarea><div class="hype-submit"><select class="text-input" name="minutes" aria-label="Открыть через"><option value="10">Через 10 минут</option><option value="1440" selected>Через день</option><option value="10080">Через неделю</option></select><button class="btn primary">Запечатать ↗</button></div></form><div class="hype-list">'+cards+'</div><small class="hype-privacy">Заметки сохраняются на сервере. Пока нет защищённых аккаунтов, не добавляйте личные секреты.</small></section>'+
  '<section class="duo-panel hype-badges"><div class="duo-panel-label">10 / МАЛЕНЬКИЕ ПОБЕДЫ</div><h2>Ваши ачивки <span>🏅</span></h2><p>Открываются автоматически, когда вы делаете что-то вместе — без ежедневных обязательств.</p><div class="hype-badge-grid">'+badges.map(b=>'<div class="hype-badge '+(b[2]?'earned':'')+'"><span>'+b[0]+'</span><strong>'+esc(b[1])+'</strong><small>'+(b[2]?'Открыто ✓':'Пока закрыто')+'</small></div>').join('')+'</div></section>';
}
export function attachHype(page,send,getState){
  page.addEventListener('click',e=>{
    const el=e.target.closest?.('button[data-hype]');
    if(!el)return;
    if(el.dataset.hype==='vote')send({type:'hype-vote',answer:el.dataset.answer==='yes'});
    if(el.dataset.hype==='next')send({type:'hype-next'});
    if(el.dataset.hype==='delete')send({type:'capsule-delete',id:el.dataset.id});
  });
  page.addEventListener('submit',e=>{
    const form=e.target.closest?.('form[data-form="hype-capsule"]');
    if(!form)return;
    e.preventDefault();e.stopImmediatePropagation();
    const data=new FormData(form),note=String(data.get('note')||'').trim(),minutes=Number(data.get('minutes'));
    if(note && [10,1440,10080].includes(minutes) && send({type:'capsule-add',note,minutes}))form.reset();
  },true);
  let lastRefresh=0;
  setInterval(()=>{
    const now=Date.now(),state=getState?.();
    if(!state || !page.querySelector('.hype-time'))return;
    if((state.capsules||[]).some(c=>!c.opened&&c.unlockAt<=now) && now-lastRefresh>10000){
      lastRefresh=now;send({type:'capsule-refresh'});
    }
  },2000);
}
