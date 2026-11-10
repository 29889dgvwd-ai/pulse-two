/* PULSE TWO — two original shared experiences */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function remaining(end){
  const seconds=Math.max(0,Math.ceil(((Number(end)||0)-Date.now())/1000));
  return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
export function renderExtraFeatures(state,me,safe,statusName,timeLabel){
  const moments=(state.moments||[]).slice().reverse();
  const timer=state.focus||{endAt:0,duration:0};
  const active=timer.endAt>Date.now();
  const entries=moments.map(m=>`<div class="moment-entry">
    <span class="moment-emoji">${esc(m.emoji)}</span>
    <div><small>${safe(statusName(m.by))} · ${timeLabel(m.at)}</small><strong>${safe(m.note)}</strong></div>
    ${m.by===me?`<button class="moment-delete" data-addon="moment-delete" data-id="${safe(m.id)}" aria-label="Удалить моё воспоминание">×</button>`:''}
  </div>`).join('')||'<div class="empty-state">Пока пусто. Сохраните первый момент ✦</div>';
  const actions=active?'<button class="btn outline" data-addon="focus-stop">Завершить ■</button>':
    [3,5,10].map(n=>`<button class="btn ${n===5?'primary':'outline'}" data-addon="focus-start" data-minutes="${n}">${n} мин</button>`).join('');
  return `<section class="duo-panel memory-panel">
    <div class="duo-panel-label">06 / ВАШ АЛЬБОМ</div>
    <h2>Банка моментов <span>🫙</span></h2>
    <p>Сохраняйте короткие воспоминания: смешные фразы, любимые дни, маленькие победы.</p>
    <form data-form="moment-add" class="moment-form">
      <select class="text-input" name="emoji" aria-label="Значок"><option>✨</option><option>🎮</option><option>🎬</option><option>🌿</option><option>💜</option></select>
      <input class="text-input" name="note" maxlength="160" required placeholder="Что запомним сегодня?" />
      <button class="btn primary sm">+ Сохранить</button>
    </form><div class="moment-list">${entries}</div>
  </section>
  <section class="duo-panel focus-panel">
    <div class="duo-panel-label">07 / ОДИН ТАЙМЕР НА ДВОИХ</div>
    <h2>Время вместе <span>⏳</span></h2>
    <p>Запустите общий таймер для разговора, рисования или игры без отвлечений.</p>
    <div class="focus-clock"><span>ОСТАЛОСЬ</span>
    <strong id="focusCountdown" data-end="${Number(timer.endAt)||0}">${remaining(timer.endAt)}</strong>
    <small>${active?`Запустил(а) ${safe(statusName(timer.by))} · ${timer.duration} мин`:'Выберите время для старта'}</small>
    </div><div class="focus-actions">${actions}</div>
  </section>`;
}
export function attachExtraFeatures(page,send){
  page.addEventListener('click',e=>{
    const el=e.target.closest?.('button[data-addon]');
    if(!el)return;
    const act=el.dataset.addon;
    if(act==='moment-delete')send({type:'moment-delete',id:el.dataset.id});
    if(act==='focus-start')send({type:'focus-start',minutes:Number(el.dataset.minutes)});
    if(act==='focus-stop')send({type:'focus-stop'});
  });
  page.addEventListener('submit',e=>{
    const form=e.target.closest?.('form[data-form="moment-add"]');
    if(!form)return;
    e.preventDefault();e.stopImmediatePropagation();
    const data=new FormData(form),note=String(data.get('note')||'').trim();
    if(note)send({type:'moment-add',note,emoji:String(data.get('emoji')||'✨')});
    form.reset();
  },true);
  setInterval(()=>{
    const node=page.querySelector('#focusCountdown');
    if(node)node.textContent=remaining(node.dataset.end);
  },1000);
}
