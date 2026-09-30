// OSM 원본에서 앱에 넣을 전국 골프장 목록(kr-courses.json)을 만든다
const fs = require('fs');
const c = JSON.parse(fs.readFileSync('courses_raw.json', 'utf8')).elements;
const h = JSON.parse(fs.readFileSync('holes_raw.json', 'utf8')).elements;
const R = 111320;
const out = [];
for (const e of c) {
  const t = e.tags || {}, b = e.bounds;
  if (!t.name || !b) continue;
  const ctr = e.center || { lat: (b.minlat + b.maxlat) / 2, lon: (b.minlon + b.maxlon) / 2 };
  const w = (b.maxlon - b.minlon) * R * Math.cos(b.minlat * Math.PI / 180), hh = (b.maxlat - b.minlat) * R;
  const area = w * hh;
  if (area < 150000) continue; // 연습장·파3 소규모 제외 (bbox 0.15km² 미만)
  const inb = x => x.center && x.center.lat >= b.minlat && x.center.lat <= b.maxlat && x.center.lon >= b.minlon && x.center.lon <= b.maxlon;
  const holes = h.filter(x => x.tags.golf === 'hole' && inb(x)).length;
  const greens = h.filter(x => x.tags.golf === 'green' && inb(x)).length;
  out.push({
    i: (e.type === 'way' ? 'w' : 'r') + e.id, n: t.name, en: t['name:en'] || undefined,
    a: t['addr:province'] || t['addr:city'] || undefined,
    y: +ctr.lat.toFixed(5), x: +ctr.lon.toFixed(5),
    h: holes || undefined, g: greens || undefined,
  });
}
out.sort((a, b) => a.n.localeCompare(b.n, 'ko'));
fs.mkdirSync('../www/data', { recursive: true });
fs.writeFileSync('../www/data/kr-courses.json', JSON.stringify(out));
console.log('courses', out.length, 'withHoles', out.filter(x => x.h >= 9).length, 'withGreens', out.filter(x => x.g >= 9).length, 'bytes', JSON.stringify(out).length);
