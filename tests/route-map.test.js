const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function api(){const context=vm.createContext({}); const file=path.join(root,'js/route-map.js'); if(fs.existsSync(file))vm.runInContext(fs.readFileSync(file,'utf8'),context); return context.RouteMap;}
test('route model keeps selected variant stops, unresolved destinations and bounded schematic points',()=>{
 const map=api(); assert.ok(map,'RouteMap API exists');
 const data={places:{a:{label:'A',x:100,y:200},b:{label:'B',x:999,y:0}},days:[{day:3,variants:[{id:'snorkel',label:'浮潛',stops:[{place:'a',itemIndex:1},{place:null,itemIndex:2,label:'待確認'},{place:'b',itemIndex:3}],legs:[]},{id:'rest',label:'不參加',stops:[{place:'a',itemIndex:4}],legs:[]}]}]};
 const model=map.model(data,3,'snorkel');assert.equal(model.stops.length,3);assert.equal(model.stops[0].point.x,100);assert.equal(model.stops[1].point,null);assert.equal(model.stops[2].point,null);assert.equal(map.model(data,3,'rest').stops.length,1);assert.equal(map.model(data,8),null);
});
test('nearby schematic stops share one numbered marker without losing individual card links',()=>{
 const map=api();assert.equal(typeof map.groups,'function');
 const stops=[{point:{x:100,y:100,inset:true}},{point:{x:100,y:100,inset:true}},{point:{x:130,y:120,inset:true}},{point:{x:290,y:180,inset:true}},{point:null}];
 const groups=map.groups(stops,true);assert.equal(groups.length,2);assert.equal(groups[0].steps.join(','),'1,2,3');assert.equal(groups[1].steps.join(','),'4');
});
test('only selected variant contributes confirmed time ranges; missing legs remain explicitly unknown',()=>{
 const map=api();assert.equal(typeof map.total,'function');
 assert.deepEqual(JSON.parse(JSON.stringify(map.total([{minutes:[20,30]},{minutes:[40,60]},{minutes:null}]))),{min:60,max:90,unknown:1});
 assert.deepEqual(JSON.parse(JSON.stringify(map.total([]))),{min:0,max:0,unknown:0});
});
test('reference durations use one approximate number for equal bounds and honest ranges otherwise',()=>{
 const map=api();assert.equal(typeof map.formatMinutes,'function');
 assert.equal(map.formatMinutes([19,19]),'約 19 分鐘');
 assert.equal(map.formatMinutes([20,25]),'約 20–25 分鐘');
 assert.equal(map.formatMinutes(null),'時間待確認');
 assert.equal(map.formatMinutes([25,20]),'時間待確認');
});
