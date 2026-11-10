/* Compact feature-first navigation. No content or previous abilities removed. */
export const groups=[
 {id:'today',name:'Сегодня',icon:'☀',subtitle:'Один простой повод зайти',
  features:[['daily','⚡','Вопрос дня','.mini-daily-panel'],['idea','🎲','Сюрприз','.idea-panel'],['question','💌','Тайный вопрос','.question-panel'],['mood','🌤','Настроение','.mood-panel'],['match','💫','Совпадения','.hype-match'],['focus','⏱','Таймер','.focus-panel']]},
 {id:'play',name:'Творчество',icon:'✳',subtitle:'Играем и придумываем',
  features:[['studio','🎨','Рисование','.studio-card'],['pet','🐾','Питомец','.pet-studio-card'],['reactions','😂','Реакции','.mini-react-panel']]},
 {id:'plans',name:'Планы',icon:'◷',subtitle:'От мечты до события',
  features:[['countdown','⏳','События','.mini-events-panel'],['bucket','🧭','Мечты','.mini-bucket-panel']]},
 {id:'history',name:'Архив',icon:'♡',subtitle:'Моменты, которые остаются',
  features:[['moments','🫙','Моменты','.memory-panel'],['capsules','💌','Капсулы','.hype-time'],['badges','🏅','Ачивки','.hype-badges']]}
];
let activeGroup='today',activeFeature='daily';
export function selectFeature(feature){
 for(const group of groups){
  if(group.features.some(row=>row[0]===feature)){activeGroup=group.id;activeFeature=feature;return true;}
 }
 return false;
}
function nav(){
 const current=groups.find(x=>x.id===activeGroup)||groups[0];
 return '<div class="hub-nav"><div class="hub-categories">'+groups.map(g=>'<button data-hub-category="'+g.id+'" class="hub-category '+(activeGroup===g.id?'selected':'')+'"><b>'+g.icon+'</b><span>'+g.name+'</span></button>').join('')+'</div><div class="hub-subhead"><strong>'+current.subtitle+'</strong><small>Выбери раздел ниже</small></div><div class="hub-features">'+current.features.map(f=>'<button data-hub-feature="'+f[0]+'" class="hub-feature '+(activeFeature===f[0]?'selected':'')+'"><span>'+f[1]+'</span>'+f[2]+'</button>').join('')+'</div></div>';
}
export function compactify(page){
 const stack=page.querySelector('.together-stack');if(!stack)return;
 stack.classList.add('hub-stage');
 const entries=groups.flatMap(g=>g.features.map(f=>[f[3],f[0]]));
 for(const s of stack.children){
  const found=entries.find(row=>s.matches(row[0]));if(found)s.dataset.hubPanel=found[1];
  s.classList.toggle('hidden',s.dataset.hubPanel!==activeFeature);
 }
 stack.insertAdjacentHTML('beforebegin',nav());
}
function update(page){
 const stack=page.querySelector('.hub-stage'),navigation=page.querySelector('.hub-nav');if(!stack||!navigation)return;
 navigation.outerHTML=nav();
 for(const s of stack.children)s.classList.toggle('hidden',s.dataset.hubPanel!==activeFeature);
}
export function installHub(page){
 page.addEventListener('click',e=>{
  const cat=e.target.closest?.('button[data-hub-category]');
  const btn=e.target.closest?.('button[data-hub-feature]');
  if(cat){
   const g=groups.find(x=>x.id===cat.dataset.hubCategory);
   if(g){activeGroup=g.id;activeFeature=g.features[0][0];update(page);}
  }else if(btn&&selectFeature(btn.dataset.hubFeature))update(page);
 });
}
export function installPalette(){
 let theme='dark';try{theme=localStorage.getItem('pulsetwo.palette')||'dark';}catch{}
 const apply=()=>{
  document.documentElement.classList.toggle('palette-light',theme==='light');
  const b=document.getElementById('themeToggle');
  if(b){b.textContent=theme==='light'?'☾':'☀';b.title=theme==='light'?'Тёмная тема':'Светлая тема';b.setAttribute('aria-label',b.title);}
 };
 apply();
 document.getElementById('themeToggle')?.addEventListener('click',()=>{theme=theme==='light'?'dark':'light';try{localStorage.setItem('pulsetwo.palette',theme);}catch{}apply();});
}
