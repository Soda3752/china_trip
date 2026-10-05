const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('all nine hotel itinerary cards navigate to address only, including D3 dinner return',()=>{
 const data=JSON.parse(fs.readFileSync(path.join(root,'data/itinerary.json'),'utf8'));
 const address=JSON.parse(fs.readFileSync(path.join(root,'data/travel-guide.json'),'utf8')).hotel.address;
 const cards=data.days.flatMap(d=>d.items).filter(i=>i.image&&i.image.includes('a-daiwa-naha-omoromachi.jpg'));
 assert.equal(cards.length,9);
 const ctx={URLSearchParams};vm.runInNewContext(fs.readFileSync(path.join(root,'js/maps.js'),'utf8'),ctx);
 for(const card of cards){
  assert.equal(card.map.keyword,address,card.name);
  const url=new URL(ctx.googleDirectionsUrl(card.map,'taxi'));
  assert.equal(url.searchParams.get('destination'),address);
  const launch=require('../js/maps-launch.js').buildLaunch(url.href,{userAgent:'iPhone'});
  assert.equal(new URL(launch.appUrl).searchParams.get('daddr'),address);
 }
 assert.ok(data.days[2].items.some(i=>i.name==='餐後自行返回飯店'&&i.map.keyword===address));
});
