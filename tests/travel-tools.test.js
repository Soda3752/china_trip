const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
function api(){const context={}; vm.runInNewContext(fs.readFileSync(path.join(root,'js/trip-tools.js'),'utf8'),context); return context.TripTools;}
test('public storage API persists only checkbox IDs and survives denied storage',()=>{
 assert.ok(fs.existsSync(path.join(root,'js/trip-tools.js')),'travel add-on must exist');
 const tool=api(); let saved=null;
 const store={getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem:()=>saved=null};
 tool.writeChecks(store,{'packing-0':true,'packing-1':false,name:'private'});
 assert.deepEqual(JSON.parse(saved),{'packing-0':true,'packing-1':false});
 assert.equal(tool.readChecks(store)['packing-0'],true);
 assert.deepEqual(JSON.parse(JSON.stringify(tool.readChecks({getItem(){throw Error('denied');}}))),{});
 assert.doesNotThrow(()=>tool.writeChecks({setItem(){throw Error('denied');}},{}));
 assert.doesNotThrow(()=>tool.clearChecks({removeItem(){throw Error('denied');}}));
});

test('hotel navigation targets its full address in directions rather than booking/search',()=>{
 const guide=JSON.parse(fs.readFileSync(path.join(root,'data/travel-guide.json'),'utf8'));
 const tool=api(); assert.equal(typeof tool.hotelNavigationUrl,'function');
 const url=new URL(tool.hotelNavigationUrl(guide.hotel));
 assert.equal(url.pathname,'/maps/dir/');assert.equal(url.searchParams.get('api'),'1');
 assert.equal(url.searchParams.get('destination'),guide.hotel.name+' '+guide.hotel.address);
 assert.equal(url.searchParams.get('travelmode'),'driving');assert.equal(url.searchParams.has('query'),false);
 const launch=require('../js/maps-launch.js').buildLaunch(url.href,{userAgent:'iPhone'});
 assert.equal(new URL(launch.appUrl).searchParams.get('daddr'),guide.hotel.name+' '+guide.hotel.address);
 assert.equal(new URL(launch.appUrl).searchParams.get('q'),null);
});
let chromium,browserPath;
if(process.env.PLAYWRIGHT_BROWSERS_PATH){try{({chromium}=require('/opt/data/home/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'));const full=chromium.executablePath();const shell=full.replace('/chromium-','/chromium_headless_shell-').replace('/chrome-linux64/chrome','/chrome-headless-shell-linux64/chrome-headless-shell');browserPath=[process.env.CHROMIUM_PATH,full,shell].find(p=>p&&fs.existsSync(p));if(!browserPath)chromium=null;}catch(_){}}
test('standalone public fixture integrates hotel, five days, info and reload/cross-tab packing',{skip:!chromium?'Portable Playwright requires available package and PLAYWRIGHT_BROWSERS_PATH':false},async()=>{
 const browser=await chromium.launch({args:['--no-sandbox'],executablePath:browserPath});
 try {
 const context=await browser.newContext({viewport:{width:320,height:800}});
 const fixture=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/css/trip-tools.css"><header class="topbar"></header><main id="content"></main><script>const APP={data:{days:[1,2,3,4,5].map(day=>({day}))},activeDay:0};function syncTopbarHeight(){window.synced=(window.synced||0)+1;} function display(day){APP.activeDay=day;document.querySelector('#content').innerHTML=day==='info'?'<ul class="checklist"><li><label><input type="checkbox">護照</label></li></ul>':'<div class="timeline">行程</div>';}</script><script src="/js/trip-tools.js"></script><script>display(0)</script>`;
 await context.route('http://travel.test/**',async route=>{
 const url=new URL(route.request().url());
 const file=path.join(root,url.pathname.slice(1));
 if(url.pathname==='/') return route.fulfill({contentType:'text/html',body:fixture});
 if(fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/javascript'});
 return route.fulfill({status:404,body:''});
 });
 const page=await context.newPage(); await page.goto('http://travel.test/');
 await page.waitForSelector('#trip-hotel');
 const beforeToggle=await page.evaluate(()=>window.synced);
 await page.locator('#trip-hotel summary').click();
 await page.waitForFunction(before=>window.synced>before,beforeToggle);
 assert.match(await page.locator('#trip-hotel').innerText(),/098-862-4555/);
 assert.ok(await page.evaluate(()=>window.synced>=2));
 for(let day=0;day<5;day++){
 await page.evaluate(day=>display(day),day); await page.waitForSelector('[data-trip-panel]');
 assert.equal(await page.locator('[data-trip-panel]').count(),1);
 assert.match(await page.locator('[data-trip-panel]').innerText(),/早餐/);
 assert.equal(await page.evaluate(()=>document.querySelector('[data-trip-panel]').nextElementSibling.classList.contains('timeline')),true);
 assert.equal(await page.locator('[data-trip-panel] details').evaluate(el=>el.open),false);
 await page.locator('[data-trip-panel] summary').click();
 }
 assert.match(await page.locator('[data-trip-panel]').innerText(),/10:50.*11:00.*11:30/s);
 await page.evaluate(()=>display(2));await page.waitForSelector('[data-trip-panel]');await page.locator('[data-trip-panel] summary').click();
 assert.match(await page.locator('[data-trip-panel]').innerText(),/7.*14:00.*16:30.*需向領隊確認.*18:30.*自行/s);
 await page.evaluate(()=>display(3));await page.waitForSelector('[data-trip-panel]');await page.locator('[data-trip-panel] summary').click();
 assert.match(await page.locator('[data-trip-panel]').innerText(),/無.*旅遊車.*DFS.*Outlet/s);
 await page.evaluate(()=>display('info'));await page.waitForSelector('[data-trip-panel]');
 assert.match(await page.locator('[data-trip-panel]').innerText(),/110.*119.*050-3816-2787/s);
 await page.locator('.checklist input').check();
 const second=await context.newPage();await second.goto('http://travel.test/');
 await second.evaluate(()=>display('info'));await second.waitForSelector('[data-trip-panel]');
 assert.equal(await second.locator('.checklist input').isChecked(),true);
 await second.reload();await second.evaluate(()=>display('info'));await second.waitForSelector('[data-trip-panel]');
 assert.equal(await second.locator('.checklist input').isChecked(),true);
 await second.locator('[data-clear-checks]').click();
 await page.waitForFunction(()=>!document.querySelector('.checklist input').checked);
 const beforeCopy=await page.evaluate(()=>window.synced);
 await page.locator('[data-copy-address]').click();
 await page.waitForFunction(before=>window.synced>before,beforeCopy);
 assert.match(await page.locator('[data-copy-status]').innerText(),/複製|手動/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 for(const el of await page.locator('.trip-tools button,.trip-tools a,.trip-tools summary').all()){
 const box=await el.boundingBox();if(box) assert.ok(box.height>=44);
 }
 // Browser-denied storage and clipboard must not stop itinerary or in-page state.
 await context.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw Error('denied');}}));
 const denied=await context.newPage();await denied.goto('http://travel.test/');await denied.waitForSelector('#trip-hotel');
 await denied.evaluate(()=>display('info'));await denied.waitForSelector('[data-trip-panel]');
 await denied.locator('.checklist input').check();
 assert.match(await denied.locator('[data-storage-status]').innerText(),/僅本頁/);
 await denied.evaluate(()=>display(0));await denied.evaluate(()=>display('info'));await denied.waitForSelector('[data-trip-panel]');
 assert.equal(await denied.locator('.checklist input').isChecked(),true);
 await context.route('**/data/travel-guide.json',route=>route.fulfill({status:503,body:'unavailable'}));
 const failed=await context.newPage();await failed.goto('http://travel.test/');
 await failed.waitForTimeout(150);assert.match(await failed.locator('#content').innerText(),/行程/);assert.equal(await failed.locator('[data-trip-panel]').count(),0);
 await context.close();
 }finally{await browser.close();}
});

test('offline readiness is never claimed for an old active worker serving a new page',()=>{
 const tool=api();assert.equal(typeof tool.offlineMessage,'function');
 assert.match(tool.offlineMessage({ready:true,version:'old'},'new'),/新版離線資料待更新，關閉本站分頁後重新開啟/);
 assert.doesNotMatch(tool.offlineMessage({ready:true,version:'old'},'new'),/已完整儲存/);
 assert.match(tool.offlineMessage({ready:true,version:'new'},'new'),/已完整儲存/);
 assert.match(tool.offlineMessage({ready:false,version:'new'},'new'),/尚未完整儲存/);
});
