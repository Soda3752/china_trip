const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function app() {
  const ctx = vm.createContext({ document: { addEventListener() {} }, URL, URLSearchParams });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/maps.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), ctx);
  return ctx;
}
test('missing imagery renders intentional coastal texture, not invented location photography', () => {
  const ctx = app();
  const html = ctx.mediaHTML({ name: '海邊 <散步> & 小店', image: null });
  assert.match(html, /class="media-ph coastal-texture"/);
  assert.match(html, /class="coastal-wave"[^>]*aria-hidden="true"/);
  assert.match(html, /海邊 &lt;散步&gt; &amp; 小店/);
  assert.match(html, /旅程筆記 · 2026/);
  assert.doesNotMatch(html, /style=|hsl\(|<img/);
});
test('timeline ornament is hidden from assistive technology', () => {
  const ctx = app();
  ctx.googleSearchUrl = () => '';
  ctx.fmt12 = value => value;
  const html = ctx.spotRow({ name: '海邊', timeLabel: '午後（時間待確認）', image: null }, '');
  assert.match(html, /class="tl-rail" aria-hidden="true"/);
  assert.match(html, /午後（時間待確認）/);
});
test('intro is only made visible after successful initialization', () => {
  const ctx = app();
  const classes = [];
  ctx.document.getElementById = () => ({ classList: { add: value => classes.push(value) } });
  ctx.document.querySelector = () => null;
  ctx.window = { matchMedia: () => ({ matches: false }) };
  ctx.setTimeout = fn => fn();
  ctx.playIntro();
  assert.deepEqual(classes, ['is-ready', 'is-hidden']);
});
test('island shell uses two font families and hides loader without JavaScript', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
  assert.match(html, /family=DM\+Sans/);
  assert.match(html, /family=Noto\+Sans\+TC/);
  assert.doesNotMatch(html + css, /Cinzel|Noto Serif|--gold|--jade/);
  assert.match(html, /<noscript>/);
  assert.match(css, /\.deco-loader\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.deco-loader\.is-ready:not\(\.is-hidden\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /white-space:\s*normal/);
});
test('photo cards omit source and photo notes while retaining accessible alternatives and brief representative label', () => {
  const ctx = app();
  ctx.googleSearchUrl = () => '';
  const item = { name: '海邊', image: 'images/coast.jpg', imageAlt: '海岸 <示意>', imageRepresentative: true,
    imageCaption: 'photo-caption-to-hide', imageCredit: 'author-to-hide', imageLicense: 'CC BY-SA 4.0',
    imageChanges: 'processing-to-hide', imageSourceUrl: 'https://commons.wikimedia.org/wiki/File:Coast.jpg', intro: '集合請依領隊通知。' };
  const html = ctx.spotRow(item, '');
  assert.match(html, /alt="海岸 &lt;示意&gt;"/);
  assert.doesNotMatch(html, /image-attribution|image-caption|image-source|photo-caption-to-hide|author-to-hide|processing-to-hide|CC BY-SA|圖片處理|照片來源/);
  assert.match(html, /class="image-kind">示意／周邊<\/span>/);
  assert.match(html, /集合請依領隊通知。/);
  assert.doesNotMatch(ctx.spotRow({...item, imageRepresentative:false}, ''), /class="image-kind"/);
});
test('failed photographs become coastal trip notes without an inline script handler', () => {
  const handlers = {};
  const ctx = vm.createContext({ document: { addEventListener: (name, fn) => { handlers[name] = fn; } } });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), ctx);
  assert.equal(typeof handlers.error, 'function');
  const image = { matches: selector => selector === '.media-img', dataset: { spotName: '沖繩海岸' }, alt: '海岸示意', outerHTML: '' };
  handlers.error({ target: image });
  assert.match(image.outerHTML, /coastal-texture/);
  assert.match(image.outerHTML, /沖繩海岸/);
  assert.doesNotMatch(ctx.mediaHTML({ name: '海岸', image: 'coast.jpg' }), /onerror=/);
});
test('information pill exposes the same tab role as daily pills', () => {
  const ctx = app();
  const children = [];
  ctx.document.getElementById = () => ({ set innerHTML(_) {}, appendChild: el => children.push(el) });
  ctx.document.createElement = () => ({ dataset: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener() {} });
  vm.runInContext("APP.data = { days: [] }; APP.state = { mode: 'before' };", ctx);
  ctx.renderTabs();
  assert.equal(children[0].attrs.role, 'tab');
});
test('reduced motion suppresses programmatic smooth scrolling', () => {
  const ctx = app();
  const behaviors = [];
  ctx.window = { matchMedia: () => ({ matches: true }), scrollTo: options => behaviors.push(options.behavior) };
  ctx.document.querySelectorAll = () => [];
  ctx.document.getElementById = () => ({ hidden: false });
  ctx.renderInfo = () => {};
  vm.runInContext("APP.state = { mode: 'before' };", ctx);
  ctx.selectTab('info', { scroll: true });
  vm.runInContext("APP.state = { mode: 'during', dayIndex: 0 }; APP.activeDay = 0;", ctx);
  ctx.requestAnimationFrame = fn => fn();
  ctx.document.querySelector = () => ({ scrollIntoView: options => behaviors.push(options.behavior) });
  ctx.scrollToCurrent();
  assert.deepEqual(behaviors, ['auto', 'auto']);
});
