const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/itinerary.json'),'utf8'));
const cards=data.days.flatMap(day=>day.items.filter(item=>item.type==='spot'));
test('all 36 cards have verified local photos with attribution',()=>{
 assert.equal(cards.length,36);
 for(const card of cards){
  assert.equal(typeof card.image,'string',card.name+' missing photo');
  assert.match(card.image,/^images\/okinawa\/[a-z0-9_-]+\.(?:jpe?g|png|webp)$/i);
  const file=path.resolve(root,card.image);
  assert.ok(fs.existsSync(file),card.name+' absent file');
  assert.ok(fs.statSync(file).size>1000,card.name+' invalid photo file');
  assert.match(card.imageSourceUrl,/^https:\/\//);
  assert.ok(card.imageCredit && card.imageLicense && card.imageCaption && card.imageAlt,card.name+' missing image provenance');
 }
 assert.equal(new Set(cards.map(card=>card.map.keyword)).size,23);
});
test('photo licensing is consolidated behind one footer link and remains available offline',()=>{
 const file=path.join(root,'photo-credits.html');assert.ok(fs.existsSync(file),'missing consolidated credits page');
 const html=fs.readFileSync(file,'utf8'), index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(index,/<a[^>]*href="photo-credits\.html"[^>]*>圖片授權<\/a>/);
 assert.equal((index.match(/href="photo-credits\.html"/g)||[]).length,1);
 for(const r of JSON.parse(fs.readFileSync(path.join(root,'data/photo-sources.json'),'utf8'))){assert.ok(html.includes(r.pageUrl.replace(/&/g,'&amp;')));assert.ok(html.includes(r.licenseUrl));}
 assert.ok(JSON.parse(fs.readFileSync(path.join(root,'offline-assets.json'),'utf8')).assets.includes('photo-credits.html'));
});
test('representative photos are truthfully captioned rather than claimed as venue photos',()=>{
 for(const card of cards.filter(card=>card.imageRepresentative)){
  assert.match(card.imageCaption,/示意|周邊|園區|非.*(?:照片|分店|餐廳|內部)/,card.name+' misleading photo caption');
 }
});
