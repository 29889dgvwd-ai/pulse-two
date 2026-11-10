/* PULSE TWO — compact first screen: no feature wall, only useful shortcuts. */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const quick=[
 ['🎨','Рисовать','Студия для двоих','studio'],
 ['🐾','Питомец','Наш маленький друг','pet'],
 ['🎲','Рулетка','Случайное занятие','idea'],
 ['⏳','Отсчёт','Важное событие','countdown'],
 ['🧭','Мечты','Когда-нибудь сделаем','bucket'],
 ['😂','Реакции','Оцените шедевр','reactions']
];
export function compactHome(state,{name='Игрок',online=false,invitation='' }={}){
 const count=(state.tasks||[]).length,complete=(state.tasks||[]).filter(t=>(t.doneBy||[]).length===2).length;
 const pct=count?Math.round(complete/count*100):0;
 const next=(state.countdowns||[]).filter(x=>x.at>Date.now()).sort((a,b)=>a.at-b.at)[0];
 return '<div class="home-compact">'+(invitation||'')+
 '<div class="home-welcome"><div><small>PULSE TWO · НА ДВОИХ</small><h1>Привет, '+esc(name)+' ✳</h1><p>Ваш маленький мир — без лишней суеты.</p></div><div class="home-online '+(online?'yes':'')+'">'+(online?'● Вы оба здесь':'○ Ждём второго')+'</div></div>'+
 '<div class="home-bento"><section class="home-primary"><span>СЕГОДНЯ ДЛЯ ВАС</span><h2>Маленькие моменты.<br><em>Большие истории.</em></h2><p>'+esc(state.daily?.prompt||'Каждый день — новый вопрос для двоих.')+'</p><button class="btn primary" data-action="go-feature" data-feature="daily">⚡ Вопрос дня ↗</button></section>'+
 '<section class="home-signals"><span>БЫСТРЫЙ СИГНАЛ</span><h3>Тук-тук! <i>✦</i></h3><p>Отправь другу один знак без лишних слов.</p><div class="home-pulse-actions"><button data-action="pulse" data-kind="hello" aria-label="Привет">💜</button><button data-action="pulse" data-kind="highfive" aria-label="Дай пять">✋</button><button data-action="pulse" data-kind="support" aria-label="Поддержка">✨</button></div></section></div>'+
 '<div class="home-section-title"><h2>Что делаем?</h2><span>В одно касание</span></div><div class="home-shortcuts">'+quick.map(x=>'<button class="home-shortcut" data-action="go-feature" data-feature="'+x[3]+'"><span>'+x[0]+'</span><strong>'+x[1]+'</strong><small>'+x[2]+'</small><b>↗</b></button>').join('')+'</div>'+
 '<div class="home-summaries"><button data-action="nav" data-tab="games"><span>🎮 ИГРОТЕКА</span><strong>12 игр</strong><small>Играть вдвоём ↗</small></button><button data-action="nav" data-tab="tasks"><span>☑ НАШИ ДЕЛА</span><strong>'+pct+'% выполнено</strong><small>'+complete+' из '+count+' общих задач ↗</small></button><button data-action="go-feature" data-feature="countdown"><span>✦ БЛИЖАЙШЕЕ СОБЫТИЕ</span><strong>'+esc(next?.title||'Впереди что-то хорошее')+'</strong><small>'+(next?new Date(next.at).toLocaleDateString('ru-RU',{day:'numeric',month:'long'}):'Добавить событие ↗')+'</small></button></div></div>';
}
