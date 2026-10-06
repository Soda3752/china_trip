const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = () => JSON.parse(fs.readFileSync(path.join(root, 'data/route-map.json'), 'utf8'));
test('five-day route data has valid sourced legs and real itinerary links', () => {
  assert.ok(fs.existsSync(path.join(root, 'data/route-map.json')), 'route-map data must exist');
  const data = read();
  const itinerary = JSON.parse(fs.readFileSync(path.join(root, 'data/itinerary.json'), 'utf8'));
  assert.match(data.disclaimer, /示意/);
  assert.match(data.disclaimer, /非即時/);
  assert.deepEqual(data.days.map(d => d.day), [1, 2, 3, 4, 5]);
  for (const p of Object.values(data.places)) {
    assert.ok(p.x >= 0 && p.x <= 400 && p.y >= 0 && p.y <= 520);
    assert.ok(p.label);
  }
  for (const day of data.days) for (const v of day.variants) {
    assert.ok(v.stops.length >= 2);
    assert.equal(v.legs.length, v.stops.length - 1);
    for (const s of v.stops) {
      assert.ok(s.place === null || data.places[s.place]);
      assert.ok(s.itemIndex === null || (Number.isInteger(s.itemIndex) && itinerary.days[day.day - 1].items[s.itemIndex]));
    }
    v.legs.forEach((leg, i) => {
      assert.equal(leg.from, i); assert.equal(leg.to, i + 1);
      assert.ok(leg.note);
      if (leg.minutes !== null) {
        assert.equal(leg.minutes.length, 2);
        assert.ok(leg.minutes[0] > 0 && leg.minutes[1] >= leg.minutes[0]);
        assert.match(leg.source, /^https:\/\//);
      } else assert.match(leg.note, /待確認/);
      if (v.stops[i].place === null || v.stops[i + 1].place === null) {
        assert.equal(leg.minutes, null); assert.match(leg.note, /分店／路段待確認/);
      }
    });
  }
  assert.equal(data.days[2].variants.length, 2);
  assert.equal(data.days[3].variants.length, 2);
  assert.deepEqual(data.days[3].variants.map(v => v.stops.map(s => s.place)), [['hotel','kokusai','dfs','hotel'], ['hotel','outlet','hotel']]);
  assert.deepEqual(data.days[0].variants[0].stops.map(s => s.itemIndex), [2,4,5,6,7,8]);
  assert.deepEqual(data.days[4].variants[0].stops.map(s => s.itemIndex), [0,2]);
  assert.ok(data.days[2].variants[0].stops.some(s => s.place === 'maeda'));
  assert.ok(!data.days[2].variants[1].stops.some(s => s.place === 'maeda'));
  assert.ok(data.places.kouri.y < data.places.aquarium.y);
  assert.ok(data.places.kouri.x > data.places.aquarium.x);
  assert.ok(data.places.hotel.y > data.places.aquarium.y);
  assert.ok(data.days.flatMap(d => d.variants.flatMap(v => v.legs)).filter(l => l.minutes !== null).length >= 3, 'useful sourced coverage');
});
