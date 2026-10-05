const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
// Minimal DOM fixture exercises real init, tab click handlers, and renderers.
// It is not a browser/layout engine and cannot verify pixels or overflow.
function harness(data, search = '?now=2026-10-08T12:00') {
  class Element {
    constructor() { this.dataset = {}; this.children = []; this.listeners = {}; this.style = {}; this.attributes = {}; this.textContent = ''; this._html = ''; this.hidden = false;
      this.classList = { add() {}, toggle() {} }; }
    set innerHTML(value) { this._html = value; this.children = []; }
    get innerHTML() { return this._html; }
    appendChild(child) { this.children.push(child); }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getBoundingClientRect() { return { height: 90 }; }
    querySelector(selector) { return digits[selector] || null; }
  }
  const digits = Object.fromEntries(['[data-h10]', '[data-h1]', '[data-m10]', '[data-m1]'].map(key => [key, new Element()]));
  const nodes = Object.fromEntries(['content', 'tabs', 'app-title', 'app-sub', 'app-updated', 'now-btn', 'deco-loader', 'topbar'].map(id => [id, new Element()]));
  const document = { body: new Element(), documentElement: { style: { setProperty() {} } },
    addEventListener() {}, createElement() { return new Element(); },
    getElementById(id) { return nodes[id]; },
    querySelector(sel) { return sel === '.topbar' ? nodes.topbar : null; },
    querySelectorAll(sel) { return sel === '.tab' ? nodes.tabs.children : []; } };
  class Clock extends Date { static now() { return Date.parse('2026-10-04T15:30:00Z'); } }
  const ctx = vm.createContext({ document, Date: Clock, URL, URLSearchParams,
    location: { search, href: 'https://example.test/' + search },
    window: { matchMedia() { return { matches: true }; }, addEventListener() {}, scrollTo() {} },
    fetch: async url => url === 'data/itinerary.json' ? { ok: true, json: async () => data } : { ok: false },
    setInterval() {}, setTimeout(fn) { fn(); }, requestAnimationFrame(fn) { fn(); } });
  const maps = fs.existsSync(path.join(root, 'js/maps.js')) ? 'maps.js' : 'amap.js';
  for (const file of [maps, 'now.js', 'app.js']) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx);
  return { ctx, nodes, digits };
}
test('Okinawa init and all six tab handlers render without errors or old destination copy', async () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/itinerary.json'), 'utf8'));
  const { ctx, nodes } = harness(data);
  await ctx.init();
  assert.equal(nodes['app-title'].textContent, data.meta.title);
  assert.ok(!/undefined|null|4人/.test(nodes['app-sub'].textContent));
  assert.equal(nodes.tabs.children.length, 6);
  for (let i = 0; i < 6; i++) {
    nodes.tabs.children[i].listeners.click();
    const html = nodes.content.innerHTML;
    assert.ok(html.length > 100);
    assert.ok(!/上海|滴滴|高德|amap|intent:\/\//i.test(html));
    if (i < 5) {
      assert.match(html, new RegExp(data.days[i].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(html, /高亮.*參考/);
    } else {
      assert.match(html, /實用資訊/);
      assert.match(html, /沖繩/);
      assert.match(html, /京王/);
    }
    if (i === 3) {
      assert.match(html, /預估/);
      assert.match(html, /時間僅供參考/);
      assert.match(html, /自由日景點可自行取捨/);
      assert.doesNotMatch(html, />現在<|已確認行程/);
    }
  }
  assert.equal(nodes['deco-loader'].hidden, false); // hide uses existing CSS class contract
});
test('loader starts with Japan default then recompute and loader honor configured offset', async () => {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/itinerary.json'), 'utf8'));
  data.meta.timezone = '+08:00';
  const { ctx, digits } = harness(data, '');
  ctx.fillIntroClock();
  assert.equal(Object.values(digits).map(d => d.textContent).join(''), '0030');
  await ctx.init();
  assert.equal(Object.values(digits).map(d => d.textContent).join(''), '2330');
  assert.equal(vm.runInContext('APP.state.today.dateStr', ctx), '2026-10-04');
});
test('static title and loader copy identify Okinawa and load Google helper', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<title>沖繩/);
  assert.match(html, /Okinawa/);
  assert.match(html, /js\/maps.js/);
  assert.ok(!/上海|Shanghai|amap/i.test(html));
});
