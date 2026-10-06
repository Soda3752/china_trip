/* Local schematic coordinates, not geographic coordinates or road navigation. */
(function(root){
 'use strict';
 function point(place){
  if(!place)return null;
  const bounded=(x,y,h)=>Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=400&&y>=0&&y<=h;
  if(bounded(place.insetX,place.insetY,240))return {x:place.insetX,y:place.insetY,inset:true};
  return bounded(place.x,place.y,520)?{x:place.x,y:place.y,inset:false}:null;
 }
 function model(data,day,id){
  const entry=data&&Array.isArray(data.days)&&data.days.find(d=>d.day===day);
  if(!entry||!Array.isArray(entry.variants)||!entry.variants.length)return null;
  const variant=entry.variants.find(v=>v.id===id)||entry.variants[0];
  return {variants:entry.variants,variant,stops:(variant.stops||[]).map(s=>({...s,label:s.label||(data.places&&data.places[s.place]||{}).label||'地點待確認',point:point(data.places&&data.places[s.place])}))};
 }
 function total(legs){return legs.reduce((sum,leg)=>{const m=leg.minutes;if(Array.isArray(m)&&m.length===2&&m.every(v=>Number.isFinite(v)&&v>=0)&&m[0]<=m[1]){sum.min+=m[0];sum.max+=m[1];}else sum.unknown++;return sum;},{min:0,max:0,unknown:0});}
 function groups(stops,inset){
  const result=[];
  stops.forEach((stop,i)=>{const p=stop.point;if(!p||p.inset!==inset)return;
   let group=result.find(g=>Math.abs(g.stop.point.x-p.x)<76&&Math.abs(g.stop.point.y-p.y)<76);
   if(!group){group={stop,steps:[]};result.push(group);}group.steps.push(i+1);
  });return result;
 }
 function formatMinutes(m){if(!Array.isArray(m)||m.length!==2||!m.every(v=>Number.isFinite(v)&&v>=0)||m[0]>m[1])return '時間待確認';return m[0]===m[1]?`約 ${m[0]} 分鐘`:`約 ${m[0]}–${m[1]} 分鐘`;}
 root.RouteMap={model,total,groups,formatMinutes};
})(typeof globalThis!=='undefined'?globalThis:this);

(function(){
 'use strict';
 if(typeof document==='undefined')return;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const disclaimer='非精確比例；連線僅代表行程順序。車程為靜態參考，不含即時路況、停車及停留時間。';
 let data=null,failed=false;
 const island='M310 26 L330 34 321 56 339 68 328 88 313 97 314 118 294 138 283 161 291 182 274 198 265 216 247 227 239 252 229 270 234 286 218 300 210 321 190 333 194 351 174 365 168 388 147 399 143 419 126 430 127 452 108 464 94 490 72 485 60 467 74 449 64 435 82 418 83 400 105 393 108 375 130 369 143 347 155 326 170 307 177 289 192 275 197 255 220 244 225 224 236 211 245 190 250 166 263 153 260 136 244 125 226 129 213 121 220 105 240 103 251 116 269 114 277 94 283 77 296 64 294 47 Z';
 function button(stop,n,marker){
  const p=stop.point;
  return `<button type="button" data-route-stop="${Number.isInteger(stop.itemIndex)?stop.itemIndex:-1}" data-item-index="${Number.isInteger(stop.itemIndex)?stop.itemIndex:-1}" class="${marker?'route-marker':'route-stop'}" ${marker?`style="left:${p.x/4}%;top:${p.y/(p.inset?2.4:5.2)}%"`:''} aria-label="${n} · ${esc(stop.label)}，跳至行程卡片">${marker?n:`<b>${n}</b> ${esc(stop.label)}${p?'':'（位置待確認）'}`}</button>`;
 }
 function diagram(m,inset){
  const height=inset?240:520;
  const lines=(m.variant.legs||[]).map(l=>{const a=m.stops[l.from]?.point,b=m.stops[l.to]?.point;return a&&b&&a.inset===inset&&b.inset===inset?`<path class="route-line" d="M${a.x} ${a.y} L${b.x} ${b.y}"/>`:'';}).join('');
  return `${inset?'<h4 class="route-inset-label">那霸市區放大示意</h4>':''}<div class="route-diagram ${inset?'route-inset':'route-island'}"><svg viewBox="0 0 400 ${height}" aria-hidden="true" focusable="false"><path class="route-land" d="${inset?'M24 208 L50 174 72 164 82 135 102 118 112 76 134 63 145 24 374 24 374 216 Z':island}"/>${lines}${inset?'':'<text x="18" y="30">北 ↑</text>'}${inset?'':'<text x="26" y="65">沖繩本島</text><text x="258" y="480">太平洋</text>'}</svg>${RouteMap.groups(m.stops,inset).map(g=>button({...g.stop,label:g.steps.map(n=>`${n} ${m.stops[n-1].label}`).join('、')+(g.steps.length>1?'；跳至第一站，其餘各站請用下方清單':'')},g.steps[0]+(g.steps.length>1?'+':''),true)).join('')}</div>`;
 }
 function fill(box,m){
  const legs=(m.variant.legs||[]).map(l=>{
   const a=m.stops[l.from],b=m.stops[l.to];if(!a||!b)return '';
   const range=RouteMap.formatMinutes(l.minutes);
   const pending=l.minutes===null||/待確認|未確認|未指定|分店/.test(l.note||'');
   return `<li><strong>${Number(l.from)+1} ${esc(a.label)} → ${Number(l.to)+1} ${esc(b.label)}</strong><span class="route-leg-time">${range}</span>${pending?`<span>${esc(l.note)}</span>`:''}</li>`;
  }).join('');
  const totals=RouteMap.total(m.variant.legs||[]);
  const sources=(m.variant.legs||[]).map((leg,i)=>{let link='';try{const url=new URL(leg.source);if(url.protocol==='https:'&&!url.username&&!url.password)link=` <a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">來源 ${i+1}</a>`;}catch(_){}return `<li>路段 ${i+1}：${esc(leg.note)}${link}</li>`;}).join('');
  const evidence=`<details data-route-sources><summary>車程來源與計算說明</summary><p>${esc(data.disclaimer||disclaimer)}</p><ul>${sources}</ul></details>`;
  const attribution='<p class="route-key">地理示意，非 GPS 定位。資料：<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>；道路估算為靜態參考，非即時導航。</p>';
  box.innerHTML=`<summary>今日路線示意圖 · ${m.stops.length} 站</summary><div class="route-body"><p class="route-disclaimer">${esc(disclaimer)}</p>${m.variants.length>1?`<div class="route-variants" role="group" aria-label="選擇今日路線">${m.variants.map(v=>`<button type="button" data-route-variant="${esc(v.id)}" aria-pressed="${v.id===m.variant.id}">${esc(v.label)}</button>`).join('')}</div>`:''}<h3>${esc(m.variant.label)}</h3><p class="route-note">${esc(m.variant.note)}</p>${m.stops.some(s=>s.point&&!s.point.inset)?diagram(m,false):''}${m.stops.some(s=>s.point?.inset)?diagram(m,true):''}<p class="route-key">虛線是行程順序，不是道路。市區點位另見放大示意；點選編號跳至原行程。</p><ol class="route-stops">${m.stops.map((s,i)=>`<li>${button(s,i+1,false)}</li>`).join('')}</ol><h4>路段時間參考</h4><p class="route-note" data-route-total>此選項已知路段合計 ${RouteMap.formatMinutes([totals.min,totals.max])}${totals.unknown?`；另有 ${totals.unknown} 段時間待確認`:''}，不是全日總耗時。</p>${legs?`<ul class="route-legs">${legs}</ul>`:'<p class="route-note">此選項沒有已確認路段時間。</p>'}${evidence}${attribution}</div>`;
  box.querySelectorAll('[data-route-variant]').forEach(b=>b.addEventListener('click',()=>fill(box,RouteMap.model(data,Number(box.dataset.day),b.dataset.routeVariant))));
  box.querySelectorAll('[data-route-stop]').forEach(b=>b.addEventListener('click',()=>{
   const target=document.querySelector(`.timeline > [data-route-item="${b.dataset.routeStop}"]`);if(!target)return;
   target.tabIndex=-1;target.focus({preventScroll:true});
   const topbar=document.querySelector('.topbar'),tabs=document.querySelector('.tabbar');
   const offset=(topbar?topbar.getBoundingClientRect().height:0)+(tabs?tabs.getBoundingClientRect().height:0)+16;
   window.scrollTo({top:Math.max(0,target.getBoundingClientRect().top+window.scrollY-offset),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }));
 }
 function render(){
  const content=document.getElementById('content'),state=typeof APP!=='undefined'?APP:null;
  if(!content||!state||!state.data||state.activeDay==='info')return;
  const timeline=content.querySelector('.timeline');if(!timeline)return;
  const panel=content.querySelector('[data-trip-panel]');
  const existing=content.querySelector('[data-route-map]');
  if(existing){if(panel&&existing.previousElementSibling!==panel)panel.after(existing);return;}
  if(!data&&!failed)return;
  const day=state.data.days[state.activeDay]?.day;
  const box=document.createElement('details');box.dataset.routeMap='';box.dataset.day=day;box.className='route-map';
  Array.from(timeline.children).forEach((el,i)=>el.dataset.routeItem=i);
  try{const m=RouteMap.model(data,day);if(m)fill(box,m);else box.innerHTML='<summary>今日路線示意圖 · 暫時無法載入</summary><p class="route-unavailable" role="status">路線示意圖暫時無法載入；原行程與導航仍可使用。</p>';}catch(_){box.innerHTML='<summary>今日路線示意圖 · 暫時無法載入</summary><p class="route-unavailable" role="status">路線示意圖暫時無法載入；原行程與導航仍可使用。</p>';}
  if(panel)panel.after(box);else timeline.before(box);
 }
 function start(){
  const content=document.getElementById('content');if(!content)return;
  new MutationObserver(render).observe(content,{childList:true,subtree:true});
  fetch('data/route-map.json').then(r=>{if(!r.ok)throw Error('route map');return r.json();}).then(value=>{data=value;render();}).catch(()=>{failed=true;render();});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
