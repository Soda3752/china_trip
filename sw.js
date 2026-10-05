/* Public site files only. CI stamps this token; no forced reload or skipWaiting. */
'use strict';
const CACHE='okinawa-trip-__BUILD_VERSION__';
const BASE=self.registration.scope;
const MANIFEST=new URL('offline-assets.json',BASE).href;
function assetURLs(manifest){
 if(!manifest||!Array.isArray(manifest.assets)||!manifest.assets.length)throw Error('Invalid offline manifest');
 return [...new Set(manifest.assets.map(path=>{
  if(typeof path!=='string'||!path||/^(?:[a-z]+:|\/|\\)/i.test(path)||path.includes('..')||path.includes('?')||path.includes('#'))throw Error('Only relative public asset paths are allowed');
  const url=new URL(path,BASE);if(url.origin!==self.location.origin||!url.href.startsWith(BASE))throw Error('Asset outside scope');return url.href;
 }))];
}
async function ready(){
 try{const cache=await caches.open(CACHE),response=await cache.match(MANIFEST);if(!response)return false;
 const urls=assetURLs(await response.json());if(!urls.includes(new URL('index.html',BASE).href))return false;
 for(const url of urls)if(!await cache.match(url,{ignoreSearch:true}))return false;return true;
 }catch(_){return false;}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const response=await fetch(MANIFEST,{cache:'no-store'});if(!response.ok||response.type==='opaque'||(response.url&&new URL(response.url).origin!==self.location.origin))throw Error('Offline manifest unavailable');
 const urls=assetURLs(await response.clone().json());if(!urls.includes(new URL('index.html',BASE).href))throw Error('Manifest must include index.html');
 const cache=await caches.open(CACHE);
 for(const url of urls){const asset=await fetch(url,{cache:'reload'});if(!asset.ok||asset.type==='opaque'||(asset.url&&new URL(asset.url).origin!==self.location.origin))throw Error('Asset unavailable');await cache.put(url,asset);}
 await cache.put(MANIFEST,response);
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const name of await caches.keys())if(name.startsWith('okinawa-trip-')&&name!==CACHE)await caches.delete(name);
 await self.clients.claim();
})()));
self.addEventListener('message',event=>{if(event.data&&event.data.type==='STATUS')event.waitUntil((async()=>{const complete=await ready();if(event.source)event.source.postMessage({type:'STATUS',ready:complete,version:'__BUILD_VERSION__'});})());});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{const response=await fetch(request);if(!response.ok)throw Error('HTTP failure');
   // Cache only public files listed by the manifest; never arbitrary personal URLs.
   const manifest=await cache.match(MANIFEST);if(manifest&&response.type!=='opaque'&&(!response.url||new URL(response.url).origin===self.location.origin)){
    const canonical=new URL(url.href);canonical.search='';canonical.hash='';
    try{if(assetURLs(await manifest.json()).includes(canonical.href))await cache.put(canonical.href,response.clone());}catch(_){}
   }return response;
  }catch(_){
   const cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;
   if(request.mode==='navigate'&&url.href.startsWith(BASE)){const index=await cache.match(new URL('index.html',BASE).href,{ignoreSearch:true});if(index)return index;}
   return new Response('此內容尚未離線儲存，請恢復網路連線。',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
 })());
});
