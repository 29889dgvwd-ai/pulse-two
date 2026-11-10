/* Compact 12-game catalog: only four tiles at once, all games preserved. */
const categories=[
 ['quick','⚡ Быстрые',['ttt','rps','reaction','number']],
 ['brain','🧠 Загадки',['quiz','emoji','cipher','memory']],
 ['together','✳ Вдвоём',['match','story','words','connect']],
 ['all','Все 12',null]
];
let selected='quick';
function drawButtons(){
 return '<div class="game-type-tabs">'+categories.map(c=>'<button type="button" data-game-category="'+c[0]+'" class="'+(selected===c[0]?'selected':'')+'">'+c[1]+'</button>').join('')+'</div>';
}
function filter(page){
 const tiles=page.querySelectorAll('.game-grid .game-card');
 const category=categories.find(x=>x[0]===selected);
 for(const tile of tiles)tile.classList.toggle('hidden',Boolean(category?.[2]&&!category[2].includes(tile.dataset.game)));
}
export function compactifyGames(page){
 const grid=page.querySelector('.game-grid');if(!grid)return;
 grid.insertAdjacentHTML('beforebegin',drawButtons());filter(page);
}
export function installGameFilter(page){
 page.addEventListener('click',e=>{
  const btn=e.target.closest?.('button[data-game-category]');if(!btn)return;
  selected=btn.dataset.gameCategory;
  page.querySelector('.game-type-tabs')?.replaceWith(Object.assign(document.createElement('div'),{innerHTML:drawButtons()} ).firstElementChild);
  filter(page);
 });
}
