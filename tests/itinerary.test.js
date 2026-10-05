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

test('untimed free day has no invented fixed appointments', () => {
  assert.ok(data.days[3].items.every(item => !item.time));
  assert.match(JSON.stringify(data.days[3]), /無.*(?:車|用車)|未安排.*車/);
});

test('known appointments preserve source times on the Japanese clock', () => {
  const times = data.days.map(day => day.items.filter(item => item.time).map(item => item.time));
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
