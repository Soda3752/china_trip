const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const modulePath = path.join(__dirname, '../js/maps-launch.js');
function api() {
  assert.ok(fs.existsSync(modulePath), 'mobile launch module exists');
  return require(modulePath);
}
const search = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('那覇 & 日本 #Intent;package=evil;end');
const directions = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('首里城 日本') + '&travelmode=walking';
function fixture(userAgent = 'iPhone', options = {}) {
  function events() {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(type, fn, capture) { if (!listeners.has(type)) listeners.set(type, new Map()); listeners.get(type).set(fn, capture); },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
      emit(type, event = {}) { for (const fn of [...(listeners.get(type)?.keys() || [])]) fn(event); },
      count(type) { return listeners.get(type)?.size || 0; }
    };
  }
  const doc = Object.assign(events(), { visibilityState: 'visible' });
  const timers = new Map();
  const assigned = [];
  let nextTimer = 0;
  const win = Object.assign(events(), {
    document: doc, navigator: { userAgent },
    location: { assign(url) { if (options.throwNative && !url.startsWith('https:')) throw Error('scheme blocked'); assigned.push(url); } },
    setTimeout(fn, delay) { timers.set(++nextTimer, { fn, delay }); return nextTimer; },
    clearTimeout(id) { timers.delete(id); }
  });
  const stop = api().install(win);
  function click(href = search, overrides = {}) {
    const anchor = { href, hasAttribute(name) { return name === 'download' && !!overrides.download; } };
    const event = Object.assign({ button: 0, defaultPrevented: false, target: { closest: () => anchor }, preventDefault() { this.defaultPrevented = true; } }, overrides);
    doc.emit('click', event);
    return event;
  }
  function tick() { const batch = [...timers.values()]; timers.clear(); for (const timer of batch) timer.fn(); }
  return { win, doc, timers, assigned, stop, click, tick };
}
test('delegated capture handles newly inserted nested links in same tab then visible iOS HTTPS fallback', () => {
  const f = fixture();
  assert.equal(f.doc.count('click'), 1);
  assert.equal([...f.doc.listeners.get('click').values()][0], true);
  assert.equal(f.click().defaultPrevented, true);
  assert.match(f.assigned[0], /^comgooglemaps:/);
  assert.equal([...f.timers.values()][0].delay, 1800);
  f.tick();
  assert.deepEqual(f.assigned, [api().buildLaunch(search, { userAgent: 'iPhone' }).appUrl, search]);
  assert.equal(f.doc.count('visibilitychange'), 0);
  assert.equal(f.win.count('pagehide'), 0);
});
test('iOS hidden/pagehide cancels fallback and cleans lifecycle listeners', () => {
  for (const signal of ['hidden', 'pagehide']) {
    const f = fixture(); f.click();
    if (signal === 'hidden') { f.doc.visibilityState = 'hidden'; f.doc.emit('visibilitychange'); }
    else f.win.emit('pagehide');
    assert.equal(f.timers.size, 0);
    f.doc.visibilityState = 'visible'; f.tick();
    assert.equal(f.assigned.length, 1);
    assert.equal(f.doc.count('visibilitychange'), 0);
    assert.equal(f.win.count('pagehide'), 0);
  }
});
test('second map click supersedes old fallback and disposal removes handlers', () => {
  const f = fixture(); f.click(search); f.click(directions);
  assert.equal(f.timers.size, 1);
  assert.equal(f.doc.count('visibilitychange'), 1);
  f.tick(); assert.equal(f.assigned.at(-1), directions);
  assert.equal(f.assigned.filter(url => url === search).length, 0);
  f.click(); f.stop(); f.tick();
  assert.equal(f.doc.count('click'), 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.doc.count('visibilitychange'), 0);
});
test('modified/nonleft/download/prevented/foreign clicks are untouched', () => {
  const f = fixture();
  for (const override of [{ctrlKey:true}, {metaKey:true}, {shiftKey:true}, {altKey:true}, {button:1}, {button:2}, {download:true}, {defaultPrevented:true}, {target:{}}, {target:null}]) {
    const e = f.click(search, override);
    assert.equal(e.defaultPrevented, !!override.defaultPrevented);
  }
  assert.equal(f.click('https://example.com/').defaultPrevented, false);
  assert.equal(f.assigned.length, 0); assert.equal(f.timers.size, 0);
});
test('desktop click retains browser behavior and Android relies only on built-in intent fallback', () => {
  const desktop = fixture('Windows NT');
  assert.equal(desktop.click().defaultPrevented, false); assert.equal(desktop.assigned.length, 0);
  const android = fixture('Android'); assert.equal(android.click().defaultPrevented, true);
  assert.match(android.assigned[0], /^intent:/);
  assert.equal(android.timers.size, 0); android.tick(); assert.equal(android.assigned.length, 1);
});
test('synchronously blocked scheme falls back to original HTTPS without pending timer', () => {
  for (const ua of ['iPhone', 'Android']) {
    const f = fixture(ua, { throwNative: true });
    assert.equal(f.click().defaultPrevented, true);
    assert.deepEqual(f.assigned, [search]); assert.equal(f.timers.size, 0);
    assert.equal(f.doc.count('visibilitychange'), 0);
  }
});
test('browser script auto-installs, whereas missing document is safe', () => {
  const f = fixture(); f.stop();
  const context = { window: f.win, URL, URLSearchParams };
  vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), context);
  assert.equal(f.doc.count('click'), 1); assert.equal(f.click().defaultPrevented, true);
  assert.doesNotThrow(() => vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), { URL, URLSearchParams }));
  assert.doesNotThrow(() => api().install({}));
});
test('iPhone search launches encoded Google Maps scheme while preserving HTTPS fallback', () => {
  const plan = api().buildLaunch(search, { userAgent: 'Mozilla/5.0 (iPhone)' });
  assert.equal(plan.platform, 'ios');
  assert.equal(plan.fallbackUrl, search);
  const url = new URL(plan.appUrl);
  assert.equal(url.protocol, 'comgooglemaps:');
  assert.equal(url.searchParams.get('q'), '那覇 & 日本 #Intent;package=evil;end');
  assert.equal(url.searchParams.size, 1);
});
test('iPadOS directions map destination and supported travel modes', () => {
  const nav = { userAgent: 'Mozilla/5.0 Macintosh', platform: 'MacIntel', maxTouchPoints: 5 };
  for (const mode of ['walking', 'driving', 'transit', 'bicycling']) {
    const plan = api().buildLaunch(directions.replace('walking', mode), nav);
    assert.equal(plan.platform, 'ios');
    const params = new URL(plan.appUrl).searchParams;
    assert.equal(params.get('daddr'), '首里城 日本');
    assert.equal(params.get('directionsmode'), mode);
    assert.equal(params.has('q'), false);
  }
});
test('Android intent explicitly targets Maps and has encoded Google HTTPS fallback', () => {
  const plan = api().buildLaunch(search, { userAgent: 'Mozilla/5.0 Android' });
  assert.equal(plan.platform, 'android');
  assert.equal(plan.appUrl, 'intent://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('那覇 & 日本 #Intent;package=evil;end') + '#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=' + encodeURIComponent(search) + ';end');
});
test('desktop leaves HTTPS untouched', () => {
  for (const nav of [{}, { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 }, { userAgent: 'Windows NT' }]) {
    assert.equal(api().buildLaunch(search, nav), null);
  }
});
test('only credential-free Google HTTPS api=1 search and directions URLs are accepted', () => {
  const nav = { userAgent: 'iPhone' };
  const invalid = [
    'javascript:alert(1)', 'data:text/html,x', 'not a URL',
    search.replace('https:', 'http:'), search.replace('www.google.com', 'evil.test'),
    search.replace('www.google.com', 'www.google.com.evil.test'),
    search.replace('www.google.com', 'user:password@www.google.com'),
    search.replace('www.google.com', 'www.google.com:444'),
    search.replace('/maps/search/', '/maps/search/extra'),
    search.replace('api=1', 'api=2'), search.replace('api=1', 'api=1&api=2'),
    search.replace('query=', 'q='), search.replace(/query=.*/, 'query='),
    directions.replace('travelmode=walking', 'travelmode=evil'),
    directions.replace('destination=', 'query=')
  ];
  for (const href of invalid) assert.equal(api().buildLaunch(href, nav), null, href);
  assert.ok(api().buildLaunch(search.replace('www.google.com', 'maps.google.com'), nav));
  assert.ok(api().buildLaunch(search.replace('/search/', '/search'), nav));
});
