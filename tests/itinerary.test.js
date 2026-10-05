const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const raw = fs.readFileSync(path.join(root, 'data/itinerary.json'), 'utf8');
const data = JSON.parse(raw);

test('handbook contains exactly five Okinawa dates and Japanese timezone', () => {
  assert.match(data.meta.title, /沖繩/);
  assert.equal(data.meta.timezone, '+09:00');
  assert.deepEqual(data.days.map(d => d.date), ['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09']);
  assert.deepEqual(data.days.map(d => d.day), [1,2,3,4,5]);
  assert.equal(data.meta.people, undefined);
});

test('Okinawa itinerary excludes private details and Shanghai content', () => {
  for (const text of ['上海','亞朵','滴滴','分房表']) {
    assert.ok(!raw.includes(text), 'Unexpected content: '+text);
  }
  assert.doesNotMatch(raw, /\b09\d{2}[- ]?\d{6}\b|\b(?:070|080|090)[- ]\d{4}[- ]\d{4}\b/);
  for (const day of data.days) {
    for (const item of day.items) {
      if (item.image) assert.ok(!/shanghai|atour/i.test(item.image));
      if (item.time) assert.match(item.time, /^(?:[01]\d|2[0-3]):[0-5]\d$/);
    }
  }
});

test('all 15 previously untimed cards have explicitly labelled Japanese planning estimates', () => {
  const expected = [
    ['14:00', '15:00', '16:15'],
    ['10:15', '11:15', '12:00', '14:00'],
    ['10:00', '12:15', '17:00', '20:30'],
    ['08:00', '10:00', '13:30', '15:30'],
    []
  ];
  const estimated = data.days.flatMap(day => day.items.filter(item => item.timeEstimated === true));
  assert.equal(estimated.length, 15);
  assert.deepEqual(data.days.map(day => day.items.filter(item => item.timeEstimated === true).map(item => item.time)), expected);
  for (const item of estimated) {
    assert.equal(item.timeLabel, `預估${item.time}（時間僅供參考）`);
  }
  for (const day of data.days) {
    assert.ok(day.items.every(item => item.time));
    const times = day.items.map(item => item.time);
    assert.deepEqual(times, [...times].sort(), `Day ${day.day} stays chronological`);
  }
});

test('free-day estimates remain optional suggestions, not fixed appointments', () => {
  const freeDay = data.days[3];
  assert.ok(freeDay.items.every(item => item.timeEstimated === true && /時間僅供參考/.test(item.timeLabel)));
  assert.match(JSON.stringify(freeDay), /無.*(?:車|用車)|未安排.*車/);
  assert.match(freeDay.tips, /非固定路線/);
  assert.match(freeDay.tips, /時間僅供參考/);
  for (const item of freeDay.items.slice(1)) {
    assert.match(item.name, /建議選項/);
    assert.match(item.intro, /自選|可依興趣|可自行/);
    assert.match(item.intro, /非固定|不是.*必走|備選/);
  }
  assert.match(freeDay.items.at(-1).intro, /備選.*(?:替代|取代).*市區下午/);
  assert.match(freeDay.items.at(-1).intro, /不必全走/);
});

test('known appointments preserve source times on the Japanese clock', () => {
  const times = data.days.map(day => day.items.filter(item => item.time && !item.timeEstimated).map(item => item.time));
  assert.deepEqual(times, [
    ['08:00','11:00','12:40','13:30','18:30','20:00'],
    ['09:00','13:00','18:00','19:30'],
    ['08:30','09:00','14:00','16:30','18:00','18:30'],
    [],
    ['10:50','11:00','11:30','13:40','15:10']
  ]);
  assert.match(data.days[0].items[0].timeLabel, /台灣 07:00/);
  assert.match(data.days[0].items[1].timeLabel, /台灣 10:00/);
  assert.match(data.days[4].items.at(-1).timeLabel, /台灣 14:10/);
});

test('daily guide distinguishes planning estimates from confirmed source appointments', () => {
  const guide = JSON.parse(fs.readFileSync(path.join(root, 'data/travel-guide.json'), 'utf8'));
  for (const day of guide.days.slice(0, 4)) {
    assert.match(day.reminders.join(' '), /預估/);
    assert.match(day.reminders.join(' '), /日本時間/);
    assert.match(day.reminders.join(' '), /時間僅供參考/);
  }
  const day3 = guide.days[2].reminders.join(' ');
  assert.match(day3, /17:00.*預估|預估.*17:00/);
  assert.match(day3, /20:30.*預估|預估.*20:30/);
  assert.match(day3, /集合.*(?:領隊|導遊).*確認/);
  assert.match(day3, /自行.*回飯店/);
  const day4 = guide.days[3].reminders.join(' ');
  assert.match(day4, /無團體旅遊車/);
  assert.match(day4, /不是固定行程/);
  assert.match(day4, /10:00.*國際通.*13:30.*DFS/);
  assert.match(day4, /15:30.*(?:備選|替代)/);
  assert.match(day4, /不必全走/);
});

test('each day preserves the handbook principal stops', () => {
  const expected = [
    [/CI310/, /糸滿/, /瀨長島/, /PARCO CITY/, /福州園/],
    [/許田/, /古宇利/, /心形岩/, /蝦蝦飯/, /INO/, /美麗海/, /EBISU/],
    [/達磨寺/, /永旺/, /美國村/, /琉球工房/, /青洞/, /7/, /五苑/],
    [/自由活動/, /國際通/, /DFS/, /ASHIBINAA/],
    [/10:50/, /11:00/, /11:30/, /CI311/, /13:40/, /14:10/]
  ];
  expected.forEach((patterns, i) => patterns.forEach(pattern => assert.match(JSON.stringify(data.days[i]), pattern)));
});
