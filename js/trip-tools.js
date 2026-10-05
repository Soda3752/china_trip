/* Public-only packing state. No traveller details are collected. */
(function(root){
 'use strict';
 const KEY='okinawa-trip-checklist-v1';
 function clean(value){const out={}; if(value&&typeof value==='object') Object.keys(value).forEach(k=>{if(/^packing-\d+$/.test(k)&&typeof value[k]==='boolean') out[k]=value[k];}); return out;}
 function readChecks(store){try{return clean(JSON.parse(store.getItem(KEY)||'{}'));}catch(_){return {};}}
 function writeChecks(store,value){try{store.setItem(KEY,JSON.stringify(clean(value)));return true;}catch(_){return false;}}
 function clearChecks(store){try{store.removeItem(KEY);return true;}catch(_){return false;}}
 function offlineMessage(message,version){if(message.version!==version)return '新版離線資料待更新，關閉本站分頁後重新開啟。外部服務仍需網路。';return message.ready===true?'本站離線內容已完整儲存；外部服務仍需網路。':'本站離線內容尚未完整儲存；請保持網路連線。';}
 root.TripTools={KEY,readChecks,writeChecks,clearChecks,offlineMessage};
})(typeof globalThis!=='undefined'?globalThis:this);

(function(){
 'use strict';
 if(typeof document==='undefined')return;
 const api=globalThis.TripTools;
 let guide=null,checks={},offline='尚未確認離線準備狀態。';
 function storage(){try{return localStorage;}catch(_){return null;}}
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const link=(url,label)=>`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`;
 function app(){return typeof APP!=='undefined'?APP:null;}
 function restore(){document.querySelectorAll('.checklist input[type="checkbox"]').forEach((el,i)=>{el.dataset.packingId='packing-'+i; el.checked=checks[el.dataset.packingId]===true;});}
 function render(){
  const content=document.getElementById('content'),state=app();
  if(!content)return;
  restore();
  if(!guide||!state||!state.data)return;
  if(!document.getElementById('trip-hotel')){
   const h=guide.hotel,box=document.createElement('details');box.id='trip-hotel';box.className='trip-tools trip-hotel';
   box.innerHTML=`<summary>返飯店・電話・地址</summary><p>${escape(h.name)}</p><p>${escape(h.address)}</p><div class="trip-actions">${link('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(h.name+' '+h.address),'開啟飯店地圖')}<a href="tel:+81988624555">${escape(h.phone)}</a><button type="button" data-copy-address>複製地址</button></div><p data-copy-status role="status"></p><p lang="ja">${escape(h.taxi)}</p><p class="trip-source">${link(h.source,'飯店官方地址／電話來源')} · ${link(h.homepage,'飯店官網')}</p><p data-offline-status role="status">${escape(offline)}</p><p>離線只提供已儲存的本站內容；外部地圖導航、天氣、颱風、航班動態及入境申報需網路。電話需電信訊號。</p>`;
   box.addEventListener('toggle',()=>{if(typeof syncTopbarHeight==='function')syncTopbarHeight();});
   const header=document.querySelector('.topbar');if(header){header.append(box);if(typeof syncTopbarHeight==='function')syncTopbarHeight();}else content.before(box);
  }
  if(content.querySelector('[data-trip-panel]'))return;
  const panel=document.createElement('section');panel.className='trip-tools trip-day';panel.dataset.tripPanel='';
  if(state.activeDay==='info'){
   panel.innerHTML=`<h3>官方資訊與緊急協助</h3><p>${escape(guide.emergency)}</p><div class="trip-links">${guide.official.map(x=>link(x.url,x.label)).join('')}</div><h3>行李清單保存</h3><p>僅在這台裝置保存勾選狀態，不蒐集姓名、證件或任何個資。可跨分頁同步；若瀏覽器拒絕儲存，僅本頁暫存。</p><button type="button" data-clear-checks>清除行李勾選狀態</button><p data-storage-status role="status"></p>`;
  }else{
   const day=state.data.days[state.activeDay],details=day&&guide.days.find(d=>d.day===day.day);if(!details)return;
   panel.innerHTML=`<h3>今日餐食與提醒</h3><p>${escape(details.meals)}</p><details><summary>重要提醒／集合與分流</summary><ul>${details.reminders.map(x=>`<li>${escape(x)}</li>`).join('')}</ul></details><p class="trip-source">${escape(guide.mealSource)} ${link('data/itinerary.json','公開行程資料')}</p>`;
  }
  const timeline=content.querySelector('.timeline'),heading=content.querySelector('.day-head');
  if(timeline)timeline.before(panel);else if(heading)heading.after(panel);else content.prepend(panel);
 }
 function status(text){offline=text;document.querySelectorAll('[data-offline-status]').forEach(el=>el.textContent=text);if(typeof syncTopbarHeight==='function')syncTopbarHeight();}
 async function worker(){
  if(!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol)){status('此環境無法準備離線內容；請保持網路連線。');return;}
  navigator.serviceWorker.addEventListener('message',event=>{
   if(event.data&&event.data.type==='STATUS')status(api.offlineMessage(event.data,window.__BUILD__||'__BUILD_VERSION__'));
  });
  const ask=()=>{if(navigator.serviceWorker.controller)navigator.serviceWorker.controller.postMessage({type:'STATUS'});};
  navigator.serviceWorker.addEventListener('controllerchange',ask);
  try{const registration=await navigator.serviceWorker.register('sw.js');ask();if(registration.active)registration.active.postMessage({type:'STATUS'});}
  catch(_){status('離線準備失敗；不影響線上行程，請保持網路連線。');}
 }
 function start(){
  checks=api.readChecks(storage());
  const content=document.getElementById('content');if(content)new MutationObserver(render).observe(content,{childList:true,subtree:true});
  document.addEventListener('change',event=>{
   const el=event.target;if(!el.matches('.checklist input[type="checkbox"]'))return;
   checks[el.dataset.packingId]=el.checked;
   const ok=api.writeChecks(storage(),checks),notice=document.querySelector('[data-storage-status]');if(notice)notice.textContent=ok?'勾選狀態已保存在本裝置。':'瀏覽器無法儲存，目前僅本頁暫存。';
  });
  window.addEventListener('storage',event=>{if(event.key===api.KEY||event.key===null){checks=api.readChecks(storage());restore();}});
  document.addEventListener('click',async event=>{
   const el=event.target.closest('button');if(!el)return;
   if(el.hasAttribute('data-clear-checks')){checks={};const ok=api.clearChecks(storage());restore();const notice=document.querySelector('[data-storage-status]');if(notice)notice.textContent=ok?'已清除本裝置勾選狀態。':'已清除本頁勾選；瀏覽器拒絕修改儲存空間。';}
   if(el.hasAttribute('data-copy-address')&&guide){const notice=document.querySelector('[data-copy-status]');try{await navigator.clipboard.writeText(guide.hotel.address);notice.textContent='地址已複製。';}catch(_){notice.textContent='無法自動複製，請手動選取上方地址。';}if(typeof syncTopbarHeight==='function')syncTopbarHeight();}
  });
  render();worker();
  fetch('data/travel-guide.json').then(res=>{if(!res.ok)throw Error('guide');return res.json();}).then(data=>{guide=data;render();}).catch(()=>{/* add-on unavailable must never replace itinerary */});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
