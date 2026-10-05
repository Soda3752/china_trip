const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function load({ search = '', instant = '2026-10-04T15:30:00Z' } = {}) {
  class Clock extends Date { static now() { return Date.parse(instant); } }
  const elements = new Map();
  const context = vm.createContext({ Date: Clock, URL, URLSearchParams, location: { search },
    document: { addEventListener() {}, getElementById(id) { if (!elements.has(id)) elements.set(id, {}); return elements.get(id); } }, window: {} });
  for (const file of ['now.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context);
  return context;
}
const fixture = { days: [
  { date: '2026-10-05', items: [
    { type: 'spot', time: '08:00' }, { type: 'spot', time: null, timeLabel: '上午' },
    { type: 'spot', time: '18:00' }, { type: 'spot', time: '20:00' }
  ] },
  { date: '2026-10-08', items: [{ type: 'spot', time: null, timeLabel: '全日自由活動' }] },
  { date: '2026-10-09', items: [{ type: 'spot', time: '10:50' }] }
] };
test('only valid HH:mm values participate in timed highlights', () => {
  const ctx = load();
  for (const value of [null, '', '午後', '午後 18:00', '24:00', '12:60', '9:00', 123]) {
    assert.equal(ctx.timeToMinutes(value), null, String(value));
  }
  assert.equal(ctx.timeToMinutes('00:00'), 0);
  assert.equal(ctx.timeToMinutes('23:59'), 1439);
});
test('null-image cards deliberately show trip notes rather than missing-image TODO', () => {
  const ctx = load();
  const html = ctx.mediaHTML({ image: null, name: '<沖繩 & 旅程>' });
  assert.match(html, /旅程筆記 · 2026/);
  assert.match(html, /&lt;沖繩 &amp; 旅程&gt;/);
  assert.ok(!html.includes('待補圖'));
});
test('active scripts contain no legacy map schemes, handlers, or coordinate enrichment', () => {
  assert.equal(fs.existsSync(path.join(root, 'js/amap.js')), false);
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.ok(!/amap|高德|attachMapHandler|enrichCoords/.test(app));
});
test('spot cards display textual and Taiwan time labels with safe Google links', () => {
  const ctx = load();
  for (const file of ['maps.js', ...(fs.existsSync(path.join(root, 'js/amap.js')) ? ['amap.js'] : [])])
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx);
  const html = ctx.spotRow({ name: '散步', time: null, timeLabel: '午後・依現場通知', map: { keyword: 'A&B "市場"' } }, '');
  assert.match(html, /午後・依現場通知/);
  assert.match(html, /https:\/\/www.google.com\/maps\/search\//);
  assert.ok(!html.includes('data-coord'));
  assert.match(ctx.spotRow({ name: '起飛', time: '11:00', timeLabel: '台灣 10:00（日本 11:00）' }, ''), /台灣 10:00（日本 11:00）/);
});
test('Google HTTPS search and directions encode keywords and ignore legacy coordinates', () => {
  const ctx = load();
  const file = fs.existsSync(path.join(root, 'js/maps.js')) ? 'maps.js' : 'amap.js';
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx);
  const keyword = '沖繩 A&B / "市場" #1';
  const place = { keyword, coord: '1,2' };
  const search = new URL(ctx.googleSearchUrl(place));
  assert.equal(search.origin, 'https://www.google.com');
  assert.equal(search.pathname, '/maps/search/');
  assert.equal(search.searchParams.get('api'), '1');
  assert.equal(search.searchParams.get('query'), keyword);
  for (const [mode, expected] of [['walk', 'walking'], ['taxi', 'driving'], ['bus', 'transit'], ['metro', 'transit']]) {
    const url = new URL(ctx.googleDirectionsUrl(place, mode));
    assert.equal(url.pathname, '/maps/dir/');
    assert.equal(url.searchParams.get('destination'), keyword);
    assert.equal(url.searchParams.get('travelmode'), expected);
    assert.equal(url.searchParams.get('api'), '1');
  }
  assert.equal(ctx.googleSearchUrl(null), null);
  assert.equal(ctx.googleSearchUrl({ coord: '1,2' }), null);
});
test('untimed stops never become next/current and interrupt assumed current location', () => {
  const ctx = load();
  const state = ctx.resolveState(fixture, { dateStr: '2026-10-05', minutes: 12 * 60 });
  assert.equal(state.currentItemIndex, -1);
  assert.equal(state.nextItemIndex, 2);
  const free = ctx.resolveState(fixture, { dateStr: '2026-10-08', minutes: 12 * 60 });
  assert.equal(free.currentItemIndex, -1);
  assert.equal(free.nextItemIndex, -1);
});
test('before, during boundaries, after and gap dates resolve correctly', () => {
  const ctx = load();
  assert.equal(ctx.resolveState(fixture, { dateStr: '2026-10-04', minutes: 0 }).mode, 'before');
  assert.equal(ctx.resolveState(fixture, { dateStr: '2026-10-10', minutes: 0 }).mode, 'after');
  assert.equal(ctx.resolveState(fixture, { dateStr: '2026-10-06', minutes: 0 }).mode, 'none');
  const early = ctx.resolveState(fixture, { dateStr: '2026-10-05', minutes: 7 * 60 });
  assert.equal(early.currentItemIndex, -1);
  assert.equal(early.nextItemIndex, 0);
  const dinner = ctx.resolveState(fixture, { dateStr: '2026-10-05', minutes: 18 * 60 });
  assert.equal(dinner.currentItemIndex, 2);
  assert.equal(dinner.nextItemIndex, 3);
  const late = ctx.resolveState(fixture, { dateStr: '2026-10-05', minutes: 23 * 60 });
  assert.equal(late.currentItemIndex, 3);
  assert.equal(late.nextItemIndex, -1);
});
test('invalid overrides fall back to the real Japan clock; valid leap dates stay local', () => {
  for (const value of ['junk2026-10-05T12:00', '2026-10-05T12:00junk', '2026-02-30T12:00', '2026-13-05', '2026-10-05T24:00', '2026-10-05T12:60', '2026-10-05T1:30']) {
    const now = load({ search: '?now=' + encodeURIComponent(value) }).tripNow();
    assert.equal(now.isOverride, false, value);
    assert.equal(now.label, '00:30');
  }
  const now = load({ search: '?now=2028-02-29T07:00' }).tripNow();
  assert.equal(now.dateStr, '2028-02-29');
  assert.equal(now.label, '07:00');
  assert.equal(now.isOverride, true);
  assert.equal(load({ search: '?now=2026-10-05' }).tripNow().label, '00:00');
});
test('trip clock crosses Japan midnight independent of host timezone and accepts configuration', () => {
  const ctx = load();
  const japan = ctx.tripNow('+09:00');
  assert.equal(japan.dateStr, '2026-10-05');
  assert.equal(japan.label, '00:30');
  assert.equal(ctx.tripNow('+08:00').dateStr, '2026-10-04');
  assert.equal(ctx.tripNow('+08:00').label, '23:30');
});
