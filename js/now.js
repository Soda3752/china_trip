// 當前時間與「目前該在哪個景點」判斷
// 依 meta.timezone 計算旅程牆上時間，預設日本 UTC+9，與裝置時區無關。
// 測試/Demo：用 ?now=2026-10-05T10:30 覆寫旅程當地時間。

// { dateStr:'YYYY-MM-DD', minutes:當日分鐘數, h, mi, label }
function tripNow(timezone = '+09:00') {
  const override = new URLSearchParams(location.search).get('now');
  if (override) {
    const m = override.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
    if (m) {
      const h = +(m[4] || 0);
      const mi = +(m[5] || 0);
      const date = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
      if (h < 24 && mi < 60 && !Number.isNaN(date.getTime()) &&
          date.getUTCFullYear() === +m[1] && date.getUTCMonth() + 1 === +m[2] && date.getUTCDate() === +m[3]) {
        return makeNowParts(m[1], +m[2], +m[3], h, mi, true);
      }
    }
  }
  // 位移 UTC 瞬間後只讀 UTC 欄位，不使用宿主的 local time。
  const offset = /^([+-])(\d{2}):(\d{2})$/.exec(timezone);
  const offsetMinutes = offset
    ? (offset[1] === '-' ? -1 : 1) * (+offset[2] * 60 + +offset[3])
    : 9 * 60;
  const sh = new Date(Date.now() + offsetMinutes * 60 * 1000);
  return makeNowParts(
    sh.getUTCFullYear(),
    sh.getUTCMonth() + 1,
    sh.getUTCDate(),
    sh.getUTCHours(),
    sh.getUTCMinutes(),
    false
  );
}

function makeNowParts(y, mo, d, h, mi, isOverride) {
  const pad = (n) => String(n).padStart(2, '0');
  return {
    dateStr: `${y}-${pad(mo)}-${pad(d)}`,
    minutes: h * 60 + mi,
    h,
    mi,
    label: `${pad(h)}:${pad(mi)}`,
    isOverride: !!isOverride,
  };
}

function timeToMinutes(t) {
  if (typeof t !== 'string') return null;
  const m = t.match(/^(\d{2}):(\d{2})$/);
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
}

// 解析整體狀態
// 回傳 { mode, dayIndex, currentItemIndex, nextItemIndex, today }
//   mode: 'before' | 'after' | 'during' | 'none'
function resolveState(data, now) {
  const days = data.days;
  const dates = days.map((d) => d.date);
  const todayIndex = dates.indexOf(now.dateStr);

  if (todayIndex === -1) {
    if (now.dateStr < dates[0]) return { mode: 'before', dayIndex: 0 };
    if (now.dateStr > dates[dates.length - 1]) return { mode: 'after', dayIndex: days.length - 1 };
    return { mode: 'none', dayIndex: 0 };
  }

  // 行程期間內：在當天 spot 中找最後一個 time ≤ 現在
  const items = days[todayIndex].items;
  let currentItemIndex = -1;
  items.forEach((it, i) => {
    if (it.type !== 'spot') return;
    const mins = timeToMinutes(it.time);
    if (mins !== null && mins <= now.minutes) currentItemIndex = i;
  });

  // 下一筆有明確時間的安排；未定時的活動不作精確高亮。
  let nextItemIndex = -1;
  let uncertainCurrent = false;
  for (let i = currentItemIndex + 1; i < items.length; i++) {
    if (items[i].type !== 'spot') continue;
    const mins = timeToMinutes(items[i].time);
    if (mins === null) { uncertainCurrent = true; continue; }
    if (mins > now.minutes) { nextItemIndex = i; break; }
  }
  // 明確時間後接未定時活動，不能推定旅客仍在上一站。
  if (uncertainCurrent) currentItemIndex = -1;

  return { mode: 'during', dayIndex: todayIndex, currentItemIndex, nextItemIndex, today: now };
}
