const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
function worker(assets=['index.html','data/travel-guide.json'],failed=null,redirect=null){
 const listeners={},stores=new Map();let offline=false,claimed=false;
 const base='https://example.test/okinawa_trip/';
 const normal=k=>new URL(typeof k==='string'?k:k.url,base).href;
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());const entries=stores.get(name);return {async put(k,v){entries.set(normal(k),v.clone());},async match(k,opts){const url=new URL(normal(k));for(const [key,v]of entries){const other=new URL(key);if(opts&&opts.ignoreSearch){url.search='';other.search='';}if(url.href===other.href)return v.clone();}},async keys(){return [...entries.keys()].map(url=>({url}));}};},async keys(){return [...stores.keys()];},async delete(k){return stores.delete(k);}};
 const fetch=async req=>{const url=normal(req);if(offline||url.endsWith(failed||'NEVER'))throw Error('offline');const response=new Response(url.endsWith('offline-assets.json')?JSON.stringify({assets}):redirect&&url.endsWith(redirect)?'REDIRECT':'PUBLIC '+url,{status:200});if(redirect&&url.endsWith(redirect))Object.defineProperty(response,'url',{value:'https://external.test/redirected'});return response;};
 const self={location:{origin:new URL(base).origin},registration:{scope:base},clients:{claim:async()=>{claimed=true;}},addEventListener:(type,fn)=>listeners[type]=fn};
 assert.ok(fs.existsSync(path.join(__dirname,'../sw.js')),'service worker must exist');
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{self,caches,fetch,URL,Response,Request,console});
 return {stores,caches,listeners,setRedirect(value){redirect=value;},setOffline(){offline=true;},get claimed(){return claimed;},async lifecycle(type){let job;listeners[type]({waitUntil:p=>job=p});await job;},async status(){let job,result;listeners.message({data:{type:'STATUS'},source:{postMessage:x=>result=x},waitUntil:p=>job=p});await job;return result;},async request(url,mode){let job;listeners.fetch({request:{url,method:'GET',mode},respondWith:p=>job=p});return job?await job:null;}};
}
test('precache validates whole manifest, STATUS is exact, own-cache activation, network fallback only same origin',async()=>{
 const w=worker();assert.equal((await w.status()).ready,false);
 await w.lifecycle('install');assert.equal((await w.status()).ready,true);
 await w.caches.open('unrelated-cache');await w.caches.open('okinawa-trip-old');
 await w.lifecycle('activate');assert.ok(w.claimed);assert.ok(w.stores.has('unrelated-cache'));assert.ok(!w.stores.has('okinawa-trip-old'));
 w.setOffline();assert.match(await (await w.request('https://example.test/okinawa_trip/data/travel-guide.json?v=123')).text(),/PUBLIC/);
 assert.match(await (await w.request('https://example.test/okinawa_trip/day-five','navigate')).text(),/index.html/);
 assert.equal(await w.request('https://maps.google.com/','navigate'),null);
 const cache=await w.caches.open([...w.stores.keys()].find(k=>k.startsWith('okinawa-trip-')));const entry=w.stores.get([...w.stores.keys()].find(k=>k.startsWith('okinawa-trip-')));entry.delete('https://example.test/okinawa_trip/data/travel-guide.json');assert.equal((await w.status()).ready,false);
});

test('failed precache never declares ready; external and traversal entries reject install',async()=>{
 const broken=worker(['index.html','image.jpg'],'image.jpg');await assert.rejects(broken.lifecycle('install'));assert.equal((await broken.status()).ready,false);
 for(const entry of ['https://other.test/a.jpg','../secret','/outside','index.html?v=1']){const w=worker(['index.html',entry]);await assert.rejects(w.lifecycle('install'));assert.equal((await w.status()).ready,false);}
 const noIndex=worker(['data/travel-guide.json']);await assert.rejects(noIndex.lifecycle('install'));assert.equal((await noIndex.status()).ready,false);
});
test('unknown files return honest offline response; POST and external fonts bypass worker',async()=>{
 const w=worker();await w.lifecycle('install');w.setOffline();
 const res=await w.request('https://example.test/okinawa_trip/not-cached.json');assert.equal(res.status,503);
 assert.equal(await w.request('https://fonts.googleapis.com/css'),null);
 let intercepted=false;w.listeners.fetch({request:{method:'POST',url:'https://example.test/okinawa_trip/index.html'},respondWith(){intercepted=true;}});assert.equal(intercepted,false);
});

test('cross-origin redirected manifest is never cached',async()=>{const w=worker(['index.html'],null,'offline-assets.json');await assert.rejects(w.lifecycle('install'));assert.equal((await w.status()).ready,false);});

test('network redirects are not stored as same-origin public assets',async()=>{
 const w=worker();await w.lifecycle('install');w.setRedirect('index.html');await w.request('https://example.test/okinawa_trip/index.html');w.setOffline();
 const cached=await w.request('https://example.test/okinawa_trip/index.html');assert.match(await cached.text(),/PUBLIC/);
});
