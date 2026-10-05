// 沖繩悠遊 — 主程式：載入資料、tab 切換、時間軸渲染、參考行程高亮

const APP = { data: null, state: null, activeDay: 0, refreshTimer: null };

const MODE_ICON = { walk: '🚶', taxi: '🚕', metro: '🚇', maglev: '🚄' };
const MODE_LABEL = { walk: '步行', taxi: '打車', metro: '地鐵', maglev: '磁浮' };

document.addEventListener('DOMContentLoaded', init);
// Capture lazy-image failures too; no inline handlers or broken-image icons.
document.addEventListener('error', (event) => {
  const image = event.target;
  if (image && image.matches && image.matches('.media-img')) {
    image.outerHTML = mediaHTML({ name: image.dataset.spotName || image.alt, image: null });
  }
}, true);

async function init() {
  fillIntroClock(); // 資料尚未載入時預設日本 UTC+9
  if (await checkFreshVersion()) return; // 偵測到新版 → 已觸發強制重載，停止後續初始化
  try {
    const res = await fetch('data/itinerary.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    APP.data = await res.json();
    fillIntroClock(); // 讀取 meta.timezone 後重新同步入場時鐘
  } catch (e) {
    document.getElementById('content').innerHTML =
      `<p class="load-error">行程資料載入失敗：${e.message}<br>請確認 data/itinerary.json 存在且為合法 JSON。</p>`;
    hideIntro();
    return;
  }
  recompute();
  renderHeader();
  renderUpdatedAt();
  syncTopbarHeight();
  renderTabs();
  APP.activeDay = APP.state.dayIndex; // 預設開「今天」
  selectTab(APP.activeDay, { scroll: false });
  bindNowButton();

  bindHeaderCollapse();
  scrollToCurrent();
  playIntro(); // 一次性：時間軸依序浮現 → 翻牌時鐘淡出
  // 每分鐘更新一次高亮（覆寫模式下不自動跳動）
  APP.refreshTimer = setInterval(() => {
    if (APP.state && APP.state.today && APP.state.today.isOverride) return;
    recompute();
    if (typeof APP.activeDay === 'number') selectTab(APP.activeDay, { scroll: false, keep: true });
  }, 60 * 1000);
}

// ---- 入場：翻牌時鐘 ----
const PREFERS_REDUCED = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 依旅程當地時間填入翻牌四位數（HH:mm）
function fillIntroClock() {
  const loader = document.getElementById('deco-loader');
  if (!loader) return;
  const now = tripNow(APP.data ? APP.data.meta.timezone : undefined);
  const [h10, h1, , m10, m1] = now.label; // "HH:mm" → 取四位數字（跳過冒號）
  const set = (sel, ch) => { const el = loader.querySelector(sel); if (el) el.textContent = ch; };
  set('[data-h10]', h10);
  set('[data-h1]', h1);
  set('[data-m10]', m10);
  set('[data-m1]', m1);
}

// 一次性入場：時間軸卡片依序浮現，再淡出翻牌時鐘
function playIntro() {
  if (APP.introDone) return;
  APP.introDone = true;
  if (PREFERS_REDUCED()) { hideIntro(); return; }
  const loader = document.getElementById('deco-loader');
  if (loader) loader.classList.add('is-ready');
  const tl = document.querySelector('.timeline');
  if (tl) {
    tl.classList.add('is-entering');
    tl.querySelectorAll('.tl-item').forEach((el, i) => { el.style.animationDelay = (i * 0.07) + 's'; });
  }
  setTimeout(hideIntro, 1900);
}

function hideIntro() {
  const loader = document.getElementById('deco-loader');
  if (loader) loader.classList.add('is-hidden');
}

function recompute() {
  const now = tripNow(APP.data.meta.timezone);
  APP.state = resolveState(APP.data, now);
  APP.state.today = now;
}

function renderHeader() {
  const m = APP.data.meta;
  document.getElementById('app-title').textContent = m.title;
  document.title = m.title;
  document.getElementById('app-sub').textContent =
    [m.dateRange, m.people ? `${m.people}人` : '', m.hotel].filter(Boolean).join(' · ');
}

// sessionStorage 安全存取（隱私模式下存取可能 throw）
function ssGet(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } }
function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }

// 版本檢查：build-info.json 一律 no-store 抓最新版本號，與本頁載入時的 window.__BUILD__ 比對；
// 不同代表使用者拿到的是被快取的舊頁 → 帶 cache-bust 參數強制重載一次（繞過 GitHub Pages 的 max-age=600）。
// 重載發生在入場 loader 仍覆蓋畫面時，使用者不會看到舊內容閃現。
async function checkFreshVersion() {
  const built = window.__BUILD__;
  if (!built || built === '__BUILD_VERSION__') return false; // 本機預覽／未經 CI 注入 → 略過
  try {
    const res = await fetch('build-info.json', { cache: 'no-store' });
    if (!res.ok) return false;
    const info = await res.json();
    APP.buildInfo = info; // 供 renderUpdatedAt 重用，免重複請求
    if (info.version && info.version !== built) {
      if (ssGet('cb-version') === info.version) return false; // 本 session 已為此版本重載過 → 防迴圈
      ssSet('cb-version', info.version);
      const url = new URL(location.href);
      url.searchParams.set('_', info.version); // 唯一 query → CDN/瀏覽器快取 miss → 抓回最新 HTML
      location.replace(url.toString());
      return true;
    }
  } catch (_) {
    /* 無此檔（本機預覽）或網路問題 → 不處理 */
  }
  return false;
}

// 最後更新時間（由 CI 部署時產生的 build-info.json，日本 UTC+9）
async function renderUpdatedAt() {
  const el = document.getElementById('app-updated');
  if (!el) return;
  try {
    let info = APP.buildInfo;
    if (!info) {
      const res = await fetch('build-info.json', { cache: 'no-store' });
      if (!res.ok) return;
      info = await res.json();
    }
    if (!info.builtAt) return;
    el.textContent = `最後更新：${info.builtAt}`;
    el.hidden = false;
    syncTopbarHeight(); // 此行非同步出現會墊高標題 → 重新量測
  } catch (_) {
    /* 本地預覽無此檔 → 不顯示 */
  }
}

// 量測標題列實際高度寫回 --topbar-h，讓 tabbar 的 sticky top 與收合位移永遠對齊
// （標題字數／「最後更新」行／螢幕寬度都會改變高度，不能寫死）
function syncTopbarHeight() {
  const tb = document.querySelector('.topbar');
  if (!tb) return;
  const h = Math.round(tb.getBoundingClientRect().height);
  if (h > 0) document.documentElement.style.setProperty('--topbar-h', h + 'px');
}

// ---- Tabs ----
function renderTabs() {
  const nav = document.getElementById('tabs');
  nav.innerHTML = '';
  APP.data.days.forEach((d, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.setAttribute('role', 'tab');
    btn.dataset.idx = i;
    const isToday = APP.state.mode === 'during' && APP.state.dayIndex === i;
    btn.innerHTML = `<span class="tab-day">D${d.day}</span><span class="tab-date">${d.date.slice(5).replace('-', '/')}</span>${isToday ? '<span class="tab-dot" title="今天" aria-hidden="true"></span>' : ''}`;
    btn.addEventListener('click', () => selectTab(i, { scroll: true }));
    nav.appendChild(btn);
  });
  const info = document.createElement('button');
  info.className = 'tab tab--info';
  info.setAttribute('role', 'tab');
  info.dataset.idx = 'info';
  info.innerHTML = `<span class="tab-day" aria-hidden="true">ℹ️</span><span class="tab-date">資訊</span>`;
  info.addEventListener('click', () => selectTab('info', { scroll: true }));
  nav.appendChild(info);
}

function selectTab(idx, opts = {}) {
  document.querySelectorAll('.tab').forEach((t) => {
    const active = t.dataset.idx === String(idx);
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (idx === 'info') {
    APP.activeDay = 'info';
    renderInfo();
  } else {
    APP.activeDay = idx;
    renderDay(idx);
  }
  if (opts.scroll) window.scrollTo({ top: 0, behavior: PREFERS_REDUCED() ? 'auto' : 'smooth' });
  // 顯示/隱藏「回到現在」
  const nowBtn = document.getElementById('now-btn');
  nowBtn.hidden = !(APP.state.mode === 'during');
}

// ---- 狀態橫幅（旅程前/後）----
function bannerHTML() {
  const s = APP.state;
  if (s.mode === 'before') {
    const start = APP.data.days[0].date;
    return `<div class="banner banner--before">🧳 旅程尚未開始（${start} 出發）。先看看每天的安排吧！</div>`;
  }
  if (s.mode === 'after') {
    return `<div class="banner banner--after">✈️ 旅程已結束，感謝這趟美好的回憶 ♥</div>`;
  }
  return '';
}

// ---- 單日時間軸 ----
function renderDay(dayIndex) {
  const day = APP.data.days[dayIndex];
  const isToday = APP.state.mode === 'during' && APP.state.dayIndex === dayIndex;
  const curIdx = isToday ? APP.state.currentItemIndex : -1;
  const nextIdx = isToday ? APP.state.nextItemIndex : -1;

  const itemState = (i, type) => {
    if (!isToday) return '';
    if (type === 'spot') {
      if (i === curIdx) return 'state-current';
      if (i === nextIdx) return 'state-next';
      return i < curIdx ? 'state-past' : 'state-upcoming';
    }
    // transit：依位置歸屬
    if (curIdx === -1) return 'state-upcoming';
    return i <= curIdx ? 'state-past' : 'state-upcoming';
  };

  const rows = day.items.map((it, i) => {
    return it.type === 'spot'
      ? spotRow(it, timeToMinutes(it.time) === null ? '' : itemState(i, 'spot'))
      : transitRow(it, itemState(i, 'transit'));
  }).join('');

  const html = `
    ${bannerHTML()}
    <header class="day-head">
      <div class="day-kicker">Day ${day.day} · ${day.date.slice(5).replace('-', '/')}（${day.weekday}）</div>
      <h2 class="day-title">${esc(day.title)}</h2>
    </header>
    <p class="note">日本時間 · 時間僅供參考；「預估」為概略安排，實際依領隊、交通與天候調整。高亮只代表參考時段，不是實際位置；自由日景點可自行取捨。</p>
    <ol class="timeline">${rows}</ol>
    ${notesHTML(day)}
  `;
  document.getElementById('content').innerHTML = html;
}

function spotRow(it, state) {
  const label = it.timeLabel || (it.time ? `日本 ${fmt12(it.time)}` : '時間依現場通知');
  const time = `<span class="spot-time">${esc(label)}</span>`;
  const mapUrl = googleDirectionsUrl(it.map, 'taxi');
  const nav = mapUrl
    ? `<a class="btn-nav" href="${esc(mapUrl)}" target="_blank" rel="noopener">導航 ↗</a>`
    : '';
  const badge = state === 'state-current'
    ? '<span class="now-badge">時刻參考</span>'
    : state === 'state-next' ? '<span class="next-badge">下個定時</span>' : '';
  const imageKind = it.image && it.imageRepresentative
    ? '<span class="image-kind">示意／周邊</span>' : '';
  return `
    <li class="tl-item tl-spot ${state}">
      <div class="tl-rail" aria-hidden="true"><span class="tl-node"></span></div>
      <article class="card">
        <div class="card-media">${mediaHTML(it)}${time}${imageKind}</div>
        <div class="card-body">
          <div class="card-head">
            <h3 class="card-title">${esc(it.name)} ${badge}</h3>
            ${nav}
          </div>
          ${it.stay ? `<p class="spot-stay">⏱ 預計停留 <b>${esc(it.stay)}</b></p>` : ''}
          ${it.intro ? `<p class="card-intro">${esc(it.intro)}</p>` : ''}
        </div>
      </article>
    </li>`;
}

function transitRow(it, state) {
  const url = googleDirectionsUrl(it.to, it.mode);
  const icon = MODE_ICON[it.mode] || '➡️';
  const dest = it.to && it.to.keyword
    ? `<span class="transit-dest">▸ 即將前往 ${esc(it.to.keyword)}</span>` : '';
  const inner = `
      <span class="transit-icon" aria-hidden="true">${icon}</span>
      <span class="transit-text">
        <span class="transit-desc">${esc(it.desc || MODE_LABEL[it.mode] || '移動')}</span>
        ${dest}
      </span>
      ${url ? '<span class="transit-go">開地圖 ↗</span>' : ''}`;
  const body = url
    ? `<a class="transit-chip" href="${esc(url)}" target="_blank" rel="noopener">${inner}</a>`
    : `<div class="transit-chip transit-chip--static">${inner}</div>`;
  return `
    <li class="tl-item tl-transit ${state}">
      <div class="tl-rail tl-rail--dashed" aria-hidden="true"></div>
      ${body}
    </li>`;
}

function mediaHTML(it) {
  if (it.image) {
    return `<img class="media-img" src="${esc(it.image)}" alt="${esc(it.imageAlt || it.name)}" data-spot-name="${esc(it.name)}" loading="lazy">`;
  }
  // 抽象海岸紋理不是景點照片；配色由 CSS 統一管理。
  return `<div class="media-ph coastal-texture">
      <span class="media-ph-hint">旅程筆記 · 2026</span>
      <span class="media-ph-name">${esc(it.name)}</span>
      <svg class="coastal-wave" viewBox="0 0 400 32" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 16 Q50 0 100 16 T200 16 T300 16 T400 16" /></svg>
    </div>`;
}

function notesHTML(day) {
  const parts = [];
  if (day.tips) parts.push(`<div class="note note--tip"><span class="note-ico" aria-hidden="true">💡</span><div><strong>小提醒</strong><p>${esc(day.tips)}</p></div></div>`);
  if (day.transport) parts.push(`<div class="note note--car"><span class="note-ico" aria-hidden="true">🚗</span><div><strong>交通</strong><p>${esc(day.transport)}</p></div></div>`);
  return parts.length ? `<section class="notes">${parts.join('')}</section>` : '';
}

// ---- 資訊分頁 ----
function renderInfo() {
  const info = APP.data.info;
  const tableRows = info.transportTable.map(
    (r) => `<tr><td>${esc(r.from)}</td><td>${esc(r.method)}</td><td>${esc(r.cost)}</td><td>${esc(r.note)}</td></tr>`
  ).join('');
  const budgetRows = info.budget.map(
    (r) => `<tr><td>${esc(r.item)}</td><td class="num">${esc(r.perPerson)}</td><td>${esc(r.note)}</td></tr>`
  ).join('');
  const checklist = info.checklist.map((c) => `<li><label><input type="checkbox"> ${esc(c)}</label></li>`).join('');
  const didi = info.didiGuide.map((c) => `<li>${esc(c)}</li>`).join('');
  const notes = info.notes.map((c) => `<li>${esc(c)}</li>`).join('');
  const apps = info.apps.map((a) => `<li><strong>${esc(a.name)}</strong> — ${esc(a.use)}</li>`).join('');

  document.getElementById('content').innerHTML = `
    <header class="day-head"><h2 class="day-title">實用資訊</h2></header>
    <section class="info-block">
      <h3 class="info-h">🚌 交通總覽・每天怎麼移動</h3>
      <div class="table-wrap"><table class="info-table">
        <thead><tr><th>路段</th><th>方式</th><th>費用</th><th>備註</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>
    </section>
    <section class="info-block">
      <h3 class="info-h">🍽️ ${esc(info.budgetTitle || '餐食安排・自理項目')}</h3>
      <div class="table-wrap"><table class="info-table">
        <thead><tr><th>項目</th><th>安排</th><th>備註</th></tr></thead>
        <tbody>${budgetRows}</tbody>
      </table></div>
    </section>
    <section class="info-block">
      <h3 class="info-h">🧳 行李清單</h3>
      <ul class="checklist">${checklist}</ul>
    </section>
    <section class="info-block">
      <h3 class="info-h">🚕 ${esc(info.transportGuideTitle || '自由活動・返店交通提醒')}</h3>
      <ul class="bullet">${didi}</ul>
    </section>
    <section class="info-block">
      <h3 class="info-h">☀️ ${esc(info.notesTitle || '沖繩旅遊注意事項')}</h3>
      <ul class="bullet">${notes}</ul>
    </section>
    <section class="info-block">
      <h3 class="info-h">📱 實用 App</h3>
      <ul class="bullet">${apps}</ul>
    </section>
    ${info.source ? `<p class="note">資料來源：${esc(info.source)}</p>` : ''}`;
}

// ---- 回到現在 ----
function bindNowButton() {
  const btn = document.getElementById('now-btn');
  btn.addEventListener('click', () => {
    recompute();
    if (APP.state.mode === 'during') {
      selectTab(APP.state.dayIndex, { scroll: false });
      scrollToCurrent();
    }
  });
}

// 上滑捲過門檻 → 收合海水標頭（Day 分頁維持至頂）；捲回頂端再展開。
// 用 transform 收合（不觸發 reflow，門檻不會抖動）；加 hysteresis 防臨界閃動。
function bindHeaderCollapse() {
  const COLLAPSE_AT = 72; // 捲過此距離（px）收合
  const EXPAND_AT = 16;   // 捲回此距離內展開
  let collapsed = false;
  let ticking = false;
  const update = () => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    if (!collapsed && y > COLLAPSE_AT) {
      collapsed = true;
      document.body.classList.add('head-collapsed');
    } else if (collapsed && y < EXPAND_AT) {
      collapsed = false;
      document.body.classList.remove('head-collapsed');
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  // 轉向／改變視窗寬度會改變標題列高度 → 重新量測對齊
  window.addEventListener('resize', () => requestAnimationFrame(syncTopbarHeight), { passive: true });
  update();
}

function scrollToCurrent() {
  if (APP.state.mode !== 'during' || APP.activeDay !== APP.state.dayIndex) return;
  requestAnimationFrame(() => {
    const el = document.querySelector('.state-current') || document.querySelector('.state-next');
    if (el) el.scrollIntoView({ behavior: PREFERS_REDUCED() ? 'auto' : 'smooth', block: 'center' });
  });
}

// "HH:mm"(24h) → 中文時段 12 小時制，如 13:00→「下午 1:00」、20:30→「晚上 8:30」、04:30→「凌晨 4:30」
// 內部判斷一律用原始 24h 字串，這裡只負責顯示轉換；非 HH:mm 格式原樣回傳。
function fmt12(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
  if (!m) return t;
  const h = +m[1];
  const period = h < 6 ? '凌晨' : h < 12 ? '上午' : h === 12 ? '中午' : h < 18 ? '下午' : '晚上';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${period} ${h12}:${m[2]}`;
}

// ---- utils ----
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
