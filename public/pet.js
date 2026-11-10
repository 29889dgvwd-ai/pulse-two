/* PULSE TWO / original animated mascot */
const skins={lavender:['#d6b3ff','#a77de2'],peach:['#ffc7ae','#f19a99'],mint:['#a6eedc','#6dcbbe'],blue:['#b7dafa','#7caff1']};
const looks={none:'Без аксессуара',bow:'Бант',glasses:'Очки',star:'Звёздочка',crown:'Корона'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
export function mascotArt(pet={},small=false){
 const [base,shade]=skins[pet.skin]||skins.lavender;
 const sleeping=pet.energy<18;
 const accessory=pet.accessory||'none';
 const headwear=accessory==='bow'?'<path d="M151 58c-32-26-37 12-7 13l19 4c-2-16-15-27-12-17Zm26 0c32-26 37 12 7 13l-19 4c2-16 15-27 12-17Z" fill="#ff7d9e" stroke="#b34f75" stroke-width="2"/><circle cx="165" cy="70" r="9" fill="#e95c91"/>':accessory==='crown'?'<path d="M135 73l-7-39 25 13 15-25 15 26 26-16-7 41z" fill="#ffe28b" stroke="#b68f48" stroke-width="3"/><circle cx="167" cy="54" r="4" fill="#f59eaf"/>':accessory==='star'?'<path d="M167 32l8 15 18 3-13 11 2 18-15-8-16 8 3-18-13-11 18-3z" fill="#ffda88" stroke="#e2a94b" stroke-width="3"/>':'';
 const glasses=accessory==='glasses'?'<g fill="none" stroke="#55446f" stroke-width="5"><rect x="101" y="118" width="42" height="33" rx="13"/><rect x="171" y="118" width="42" height="33" rx="13"/><path d="M143 132h28M100 131l-15-5M213 131l15-5"/></g>':'';
 const eyes=sleeping?'<path d="M116 140q17 15 29 0M175 140q17 15 29 0" stroke="#58456f" stroke-width="5" fill="none" stroke-linecap="round"/>':'<g class="mascot-eyes"><ellipse cx="130" cy="136" rx="8" ry="13" fill="#403452"/><ellipse cx="190" cy="136" rx="8" ry="13" fill="#403452"/><circle cx="133" cy="131" r="2.5" fill="#fff"/><circle cx="193" cy="131" r="2.5" fill="#fff"/></g>';
 return '<svg class="mascot-svg '+(small?'compact':'')+'" viewBox="0 0 320 280" aria-label="Ваш дружелюбный питомец" role="img" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mascotFur" x2="1" y2="1"><stop stop-color="'+base+'"/><stop offset="1" stop-color="'+shade+'"/></linearGradient></defs><g class="mascot-float"><ellipse cx="158" cy="244" rx="85" ry="13" fill="#241b3e" opacity=".14"/><path d="M98 108Q64 45 96 38Q117 36 143 86M219 107Q252 42 221 38Q199 33 181 85" fill="url(#mascotFur)" stroke="'+shade+'" stroke-width="5"/><path d="M106 84Q93 57 101 53l22 28M206 81l14-27q11 14-7 31" fill="#fae0f5"/><ellipse cx="160" cy="165" rx="100" ry="89" fill="url(#mascotFur)" stroke="'+shade+'" stroke-width="4"/><ellipse cx="160" cy="188" rx="52" ry="39" fill="#fff3fa" opacity=".76"/><ellipse cx="82" cy="185" rx="17" ry="13" fill="'+base+'"/><ellipse cx="240" cy="185" rx="17" ry="13" fill="'+base+'"/><ellipse cx="128" cy="240" rx="25" ry="14" fill="'+shade+'"/><ellipse cx="192" cy="240" rx="25" ry="14" fill="'+shade+'"/>'+eyes+'<ellipse cx="103" cy="162" rx="15" ry="8" fill="#f48fa4" opacity=".65"/><ellipse cx="218" cy="162" rx="15" ry="8" fill="#f48fa4" opacity=".65"/><path d="M152 159q8 9 16 0" stroke="#6a4d6a" fill="none" stroke-width="4" stroke-linecap="round"/><path d="M158 158l4 0" stroke="#6a4d6a" stroke-width="3" stroke-linecap="round"/>'+headwear+glasses+'</g><g class="mascot-sparkle" fill="#ffe5ac"><path d="M45 83l6 10 10 6-10 6-6 10-6-10-10-6 10-6z"/><path d="M258 98l5 9 9 4-9 4-5 9-5-9-9-4 9-4z"/></g></svg>';
}
export function petCard(pet={},selfId,statusName){
 const level=1+Math.floor((pet.xp||0)/6);
 const theme=pet.room||'night',energy=Number(pet.energy)||0,joy=Number(pet.joy)||0;
 const spots=Object.keys(skins).map(s=>'<button class="pet-swatch '+(pet.skin===s?'selected':'')+'" data-pet="skin" data-value="'+s+'" style="--swatch:'+skins[s][0]+'" aria-label="Окрас '+s+'"></button>').join('');
 const accessories=Object.entries(looks).map(([key,label])=>{const need={none:1,bow:1,glasses:2,star:3,crown:4}[key];const icon={none:'◌',bow:'🎀',glasses:'🕶️',star:'⭐',crown:'👑'}[key];return '<button class="pet-accessory '+(pet.accessory===key?'selected':'')+'" data-pet="accessory" data-value="'+key+'" '+(level<need?'disabled title="Откроется на уровне '+need+'"':'')+'>'+icon+'<small>'+esc(label)+(level<need?' · ур. '+need:'')+'</small></button>';}).join('');
 return '<section class="duo-panel pet-studio-card"><div class="duo-panel-label">04 / ВАШ МАЛЕНЬКИЙ МИР</div><div class="pet-card-header"><div><h2>'+esc(pet.name||'Искра')+' <span>✦</span></h2><p>Ваш общий персонаж. Кормите, украшайте комнату и придумывайте ему имя.</p></div><span class="pet-lvl">LEVEL '+level+'</span></div>'+
 '<div class="pet-world theme-'+theme+'"><div class="pet-world-top"><span>✧ Логово '+(theme==='garden'?'в саду':theme==='sunset'?'на закате':'под звёздами')+'</span><span>Малыш сегодня '+(joy>=65?'доволен ✨':'спокоен 🌙')+'</span></div><div class="pet-stars">✦ <span>✳</span> ✦</div>'+mascotArt(pet)+'<div class="pet-world-base"></div></div>'+
 '<div class="pet-stats"><div><label>ЭНЕРГИЯ <b>'+energy+'%</b></label><div class="pet-bar"><i style="width:'+energy+'%"></i></div></div><div><label>РАДОСТЬ <b>'+joy+'%</b></label><div class="pet-bar pink"><i style="width:'+joy+'%"></i></div></div></div>'+
 '<div class="pet-activity"><button data-pet="care" data-kind="feed">🍓 <b>Покормить</b></button><button data-pet="care" data-kind="play">🪁 <b>Играть</b></button><button data-pet="care" data-kind="rest">🌙 <b>Отдохнуть</b></button></div>'+
 '<div class="pet-progress"><strong>Уровень '+level+'</strong><div class="pet-progress-track"><i style="width:'+(((pet.xp||0)%6)/6*100)+'%"></i></div><small>'+((pet.xp||0)%6)+'/6 действий</small></div>'+
 '<div class="pet-custom"><div class="pet-custom-heading"><h3>Сделайте его своим</h3><span>ВСЁ ОБЩЕЕ</span></div><form class="pet-name-form" data-form="pet-rename"><input type="text" name="name" maxlength="16" class="text-input" value="'+esc(pet.name||'Искра')+'" aria-label="Имя питомца" /><button class="btn outline sm">Сохранить имя</button></form><div class="pet-option-row"><label>Цвет шерсти</label><div class="pet-swatches">'+spots+'</div></div><div class="pet-option-row"><label>Мир питомца</label><div class="pet-themes">'+[['night','🌙 Ночь'],['garden','🌿 Сад'],['sunset','🌅 Закат']].map(([k,t])=>'<button data-pet="room" data-value="'+k+'" class="'+(theme===k?'selected':'')+'">'+t+'</button>').join('')+'</div></div><div class="pet-option-row"><label>Наряды и аксессуары</label><div class="pet-accessories">'+accessories+'</div></div></div>'+
 '<div class="pet-footer">'+(pet.lastAction?'Последнее действие: '+esc(statusName(pet.lastAction.by)):'Растёт, когда вы играете вместе. Перерывов он не боится.')+'</div></section>';
}
export function installPet(page,send){
 page.addEventListener('click',e=>{
   const el=e.target.closest?.('button[data-pet]');if(!el||el.disabled)return;
   const a=el.dataset.pet;
   if(a==='care'){send({type:'pet-care',kind:el.dataset.kind});return;}
   if(['skin','accessory','room'].includes(a))send({type:'pet-customize',field:a,value:el.dataset.value});
 });
 page.addEventListener('submit',e=>{
   const form=e.target.closest?.('form[data-form="pet-rename"]');
   if(!form)return;
   e.preventDefault();e.stopImmediatePropagation();
   const data=new FormData(form),name=String(data.get('name')||'').trim();
   if(name)send({type:'pet-rename',name});
 },true);
}
