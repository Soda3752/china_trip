// 上海自由行 — 主程式：載入資料、tab 切換、時間軸渲染、當前景點高亮

const APP = { data: null, state: null, activeDay: 0, refreshTimer: null };

const MODE_ICON = { walk: '🚶', taxi: '🚕', metro: '🚇', maglev: '🚄' };
const MODE_LABEL = { walk: '步行', taxi: '打車', metro: '地鐵', maglev: '磁浮' };

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const res = await fetch('data/itinerary.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    APP.data = await res.json();
    enrichCoords(APP.data);
  } catch (e) {
    document.getElementById('content').innerHTML =
      `<p class="load-error">行程資料載入失敗：${e.message}<br>請確認 data/itinerary.json 存在且為合法 JSON。</p>`;
    return;
  }
  recompute();
  renderHeader();
  renderUpdatedAt();
  renderTabs();
  APP.activeDay = APP.state.dayIndex; // 預設開「今天」
  selectTab(APP.activeDay, { scroll: false });
  bindNowButton();
  attachMapHandler();
  bindHeaderCollapse();
  scrollToCurrent();
  // 每分鐘更新一次高亮（覆寫模式下不自動跳動）
  APP.refreshTimer = setInterval(() => {
    if (APP.state && APP.state.today && APP.state.today.isOverride) return;
    recompute();
    if (typeof APP.activeDay === 'number') selectTab(APP.activeDay, { scroll: false, keep: true });
  }, 60 * 1000);
}

// 由 data.coords 為各 map/to 補上座標（已自帶 coord 者不覆蓋）→ 啟用精準標點與真實路線規劃
function enrichCoords(data) {
  const dict = data.coords || {};
  const fill = (place) => {
    if (place && place.keyword && !place.coord && dict[place.keyword]) {
      place.coord = dict[place.keyword];
    }
  };
  data.days.forEach((d) => d.items.forEach((it) => {
    if (it.type === 'spot') fill(it.map);
    else if (it.type === 'transit') fill(it.to);
  }));
}

function recompute() {
  const now = shanghaiNow();
  APP.state = resolveState(APP.data, now);
  APP.state.today = now;
}

function renderHeader() {
  const m = APP.data.meta;
  document.getElementById('app-title').textContent = m.title;
  document.getElementById('app-sub').textContent =
    `${m.dateRange} · ${m.people}人 · ${m.hotel}`;
}

// 最後更新時間（由 CI 部署時產生的 build-info.json，台北 UTC+8）
async function renderUpdatedAt() {
  const el = document.getElementById('app-updated');
  if (!el) return;
  try {
    const res = await fetch('build-info.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { builtAt } = await res.json();
    if (!builtAt) return;
    el.textContent = `最後更新：${builtAt}`;
    el.hidden = false;
  } catch (_) {
    /* 本地預覽無此檔 → 不顯示 */
  }
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
    btn.innerHTML = `<span class="tab-day">D${d.day}</span><span class="tab-date">${d.date.slice(5).replace('-', '/')}</span>${isToday ? '<span class="tab-dot" title="今天"></span>' : ''}`;
    btn.addEventListener('click', () => selectTab(i, { scroll: true }));
    nav.appendChild(btn);
  });
  const info = document.createElement('button');
  info.className = 'tab tab--info';
  info.dataset.idx = 'info';
  info.innerHTML = `<span class="tab-day">ℹ️</span><span class="tab-date">資訊</span>`;
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
  if (opts.scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
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
      ? spotRow(it, itemState(i, 'spot'))
      : transitRow(it, itemState(i, 'transit'));
  }).join('');

  const html = `
    ${bannerHTML()}
    <header class="day-head">
      <div class="day-kicker">Day ${day.day} · ${day.date.slice(5).replace('-', '/')}（${day.weekday}）</div>
      <h2 class="day-title">${esc(day.title)}</h2>
    </header>
    <ol class="timeline">${rows}</ol>
    ${notesHTML(day)}
  `;
  document.getElementById('content').innerHTML = html;
}

function spotRow(it, state) {
  const time = it.time ? `<time class="spot-time">${esc(it.time)}</time>` : '';
  const nav = it.map
    ? `<a class="btn-nav" data-map href="${amapSearchUrl(it.map)}" target="_blank" rel="noopener"
         data-coord="${esc(it.map.coord || '')}" data-name="${esc(it.map.keyword || '')}" data-mode="">導航 ↗</a>`
    : '';
  const badge = state === 'state-current'
    ? '<span class="now-badge">現在</span>'
    : state === 'state-next' ? '<span class="next-badge">即將</span>' : '';
  return `
    <li class="tl-item tl-spot ${state}">
      <div class="tl-rail"><span class="tl-node"></span></div>
      <article class="card">
        <div class="card-media">${mediaHTML(it)}${time}</div>
        <div class="card-body">
          <div class="card-head">
            <h3 class="card-title">${esc(it.name)} ${badge}</h3>
            ${nav}
          </div>
          ${it.intro ? `<p class="card-intro">${esc(it.intro)}</p>` : ''}
        </div>
      </article>
    </li>`;
}

function transitRow(it, state) {
  const url = amapNavUrl(it.to, it.mode);
  const icon = MODE_ICON[it.mode] || '➡️';
  const dest = it.to && it.to.keyword
    ? `<span class="transit-dest">▸ 即將前往 ${esc(it.to.keyword)}</span>` : '';
  const inner = `
      <span class="transit-icon">${icon}</span>
      <span class="transit-text">
        <span class="transit-desc">${esc(it.desc || MODE_LABEL[it.mode] || '移動')}</span>
        ${dest}
      </span>
      ${url ? '<span class="transit-go">開地圖 ↗</span>' : ''}`;
  const body = url
    ? `<a class="transit-chip" data-map href="${url}" target="_blank" rel="noopener"
         data-coord="${esc((it.to && it.to.coord) || '')}" data-name="${esc((it.to && it.to.keyword) || '')}" data-mode="${esc(it.mode || '')}">${inner}</a>`
    : `<div class="transit-chip transit-chip--static">${inner}</div>`;
  return `
    <li class="tl-item tl-transit ${state}">
      <div class="tl-rail tl-rail--dashed"></div>
      ${body}
    </li>`;
}

function mediaHTML(it) {
  if (it.image) {
    return `<img class="media-img" src="${esc(it.image)}" alt="${esc(it.name)}" loading="lazy">`;
  }
  // 漸層佔位圖：依名稱取色相，固定落在藍～靛範圍以維持藍白主調
  const hue = 200 + (hashStr(it.name) % 60);
  const style = `background:linear-gradient(135deg,hsl(${hue} 55% 42%),hsl(${hue + 25} 60% 30%))`;
  return `<div class="media-ph" style="${style}">
      <span class="media-ph-name">${esc(it.name)}</span>
      <span class="media-ph-hint">📷 待補圖</span>
    </div>`;
}

function notesHTML(day) {
  const parts = [];
  if (day.tips) parts.push(`<div class="note note--tip"><span class="note-ico">💡</span><div><strong>小提醒</strong><p>${esc(day.tips)}</p></div></div>`);
  if (day.transport) parts.push(`<div class="note note--car"><span class="note-ico">🚗</span><div><strong>交通</strong><p>${esc(day.transport)}</p></div></div>`);
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
      <h3 class="info-h">💰 預估費用（台幣・每人參考）</h3>
      <div class="table-wrap"><table class="info-table">
        <thead><tr><th>項目</th><th>每人</th><th>備註</th></tr></thead>
        <tbody>${budgetRows}</tbody>
      </table></div>
    </section>
    <section class="info-block">
      <h3 class="info-h">🧳 行李清單</h3>
      <ul class="checklist">${checklist}</ul>
    </section>
    <section class="info-block">
      <h3 class="info-h">🚕 滴滴叫車・使用指南</h3>
      <ul class="bullet">${didi}</ul>
    </section>
    <section class="info-block">
      <h3 class="info-h">☀️ 7 月上海注意事項</h3>
      <ul class="bullet">${notes}</ul>
    </section>
    <section class="info-block">
      <h3 class="info-h">📱 實用 App</h3>
      <ul class="bullet">${apps}</ul>
    </section>`;
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

// 上滑捲過門檻 → 收合頂部標題（藍色 Day 分頁維持至頂）；捲回頂端再展開。
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
  update();
}

// 手機點擊「導航」/交通串接 → 先試喚起高德 App，開不起來才退回網頁
function attachMapHandler() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-map]');
    if (!a) return;
    const coord = a.getAttribute('data-coord');
    if (!coord) return; // 無座標 → 直接走 href（網頁搜尋）
    const web = a.getAttribute('href');
    const native = amapNativeUrl(
      { coord, keyword: a.getAttribute('data-name') || '' },
      a.getAttribute('data-mode') || '',
      web
    );
    if (!native) return; // 桌機 → 正常開網頁
    e.preventDefault();
    if (amapPlatform() === 'android') {
      window.location.href = native; // intent 自帶網頁 fallback
      return;
    }
    // iOS：嘗試喚起 App，1.5 秒內若頁面仍可見（App 沒開）→ 退回網頁
    const timer = setTimeout(() => {
      if (!document.hidden) window.location.href = web;
    }, 1500);
    const cancel = () => clearTimeout(timer);
    document.addEventListener('visibilitychange', cancel, { once: true });
    window.addEventListener('pagehide', cancel, { once: true });
    window.location.href = native;
  });
}

function scrollToCurrent() {
  if (APP.state.mode !== 'during' || APP.activeDay !== APP.state.dayIndex) return;
  requestAnimationFrame(() => {
    const el = document.querySelector('.state-current') || document.querySelector('.state-next');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

// ---- utils ----
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
