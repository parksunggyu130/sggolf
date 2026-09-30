'use strict';
/* 외부 무료 데이터: OpenStreetMap(코스 도면) · Open-Meteo(고도 · 날씨) · 전국 골프장 목록 */

let KR = null;
async function loadKR() {
  if (KR) return KR;
  const r = await fetch('data/kr-courses.json');
  KR = await r.json();
  return KR;
}
const krStatus = e => (e.h >= 9 ? 'full' : e.g >= 9 ? 'green' : 'sat');
const KR_BADGE = { full: ['도면 있음', 'on'], green: ['그린만', 'flag'], sat: ['위성만', ''] };

async function overpass(q) {
  const eps = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
  for (const ep of eps) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 40000);
      const r = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) return await r.json();
    } catch (e) { /* 다음 서버 */ }
  }
  throw new Error('지도 데이터 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 잠시 뒤 다시 시도해주세요.');
}
const GOLF_Q = '["golf"~"^(hole|green|bunker|tee|fairway|water_hazard|lateral_water_hazard|out_of_bounds)$"]';
async function fetchCourseOsm(entry) {
  const id = entry.i.slice(1), sel = entry.i[0] === 'w' ? `way(${id})` : `relation(${id})`;
  let data = await overpass(`[out:json][timeout:60];${sel};map_to_area->.a;(way${GOLF_Q}(area.a);way["natural"="water"](area.a););out geom tags;`);
  if (!(data.elements || []).length) data = await overpass(`[out:json][timeout:60];(way${GOLF_Q}(around:1300,${entry.y},${entry.x});way["natural"="water"](around:1300,${entry.y},${entry.x}););out geom tags;`);
  return data;
}
const geomLL = el => el.geometry.map(p => ({ lat: p.lat, lng: p.lon }));
function openPoly(pts) { return pts.length > 2 && pts[0].lat === pts[pts.length - 1].lat && pts[0].lng === pts[pts.length - 1].lng ? pts.slice(0, -1) : pts; }

// OSM 데이터로 골프장 만들기. 홀 번호가 있으면 도면을 채우고, 없으면 그린·해저드를 "미배정"으로 두고 편집기에서 쓰게 해요
function buildCourseFromOsm(entry, data) {
  const els = (data.elements || []).filter(e => e.geometry && e.geometry.length);
  const byGolf = k => els.filter(e => (e.tags || {}).golf === k);
  const holes = byGolf('hole').filter(e => /^\d+$/.test(e.tags.ref || ''));
  const greens = byGolf('green').map(e => openPoly(geomLL(e)));
  const feats = [];
  byGolf('bunker').forEach(e => feats.push({ t: 'bunker', p: openPoly(geomLL(e)) }));
  [...byGolf('water_hazard'), ...byGolf('lateral_water_hazard'), ...els.filter(e => (e.tags || {}).natural === 'water')].forEach(e => feats.push({ t: 'water', p: openPoly(geomLL(e)) }));
  const seenF = new Set();
  for (let i = feats.length - 1; i >= 0; i--) { const c = centroidLL(feats[i].p), k = feats[i].t + (feats[i].t === 'bunker' ? '' : 'W') + c.lat.toFixed(4) + c.lng.toFixed(4); if (seenF.has(k)) feats.splice(i, 1); else seenF.add(k); }
  byGolf('out_of_bounds').forEach(e => feats.push({ t: 'ob', p: geomLL(e) }));
  byGolf('fairway').forEach(e => feats.push({ t: 'fairway', p: openPoly(geomLL(e)) }));

  // 코스(9홀 묶음) 나누기
  const groups = {};
  const named = holes.some(e => e.tags['golf:course:name'] || e.tags['golf:course']);
  if (named) holes.forEach(e => { const k = e.tags['golf:course:name'] || e.tags['golf:course'] || '기타'; (groups[k] ||= []).push(e); });
  else {
    const seen = {};
    holes.slice().sort((a, b) => a.id - b.id).forEach(e => {
      const ref = Number(e.tags.ref);
      let gi; if (ref > 9) gi = Math.floor((ref - 1) / 9); else { seen[ref] = (seen[ref] || 0) + 1; gi = seen[ref] - 1; }
      (groups[gi] ||= []).push(e);
    });
  }
  const keys = Object.keys(groups);
  const subNames = named ? keys : keys.length <= 2 ? ['OUT', 'IN'].slice(0, Math.max(1, keys.length)) : keys.map((_, i) => 'ABCDE'[i] || String(i + 1));
  const c = { id: uid(), name: entry.n, osm: entry.i, addr: entry.a || '', loc: { lat: entry.y, lng: entry.x }, subs: [], created: Date.now(), source: 'osm', spare: { greens: [], feats: [] } };
  const usedGreens = new Set();
  if (keys.length) {
    keys.forEach((k, si) => {
      const sub = newSub(subNames[si] || k);
      groups[k].forEach(e => {
        const idx = (Number(e.tags.ref) - 1) % 9;
        const H = sub.holes[idx];
        H.path = geomLL(e); H.tee = H.path[0];
        const end = H.path[H.path.length - 1];
        let best = -1, bd = 70;
        greens.forEach((g, gi) => { const d = pointInPoly(end, g) ? 0 : distM(centroidLL(g), end); if (d < bd) { bd = d; best = gi; } });
        if (best >= 0) { H.greenPoly = greens[best]; H.green = centroidLL(greens[best]); usedGreens.add(best); } else H.green = end;
        H.path[H.path.length - 1] = H.green;
        const par = Number(e.tags.par); if (par >= 3 && par <= 6) H.par = par;
        if (/^\d+$/.test(e.tags.handicap || '')) H.hdcp = Number(e.tags.handicap);
        const dist = Number(e.tags.dist); if (dist > 50) H.dist.white = Math.round(dist);
      });
      c.subs.push(sub);
    });
  } else c.subs = [newSub('OUT'), newSub('IN')];
  // 해저드를 가까운 홀에 붙이기
  const allHoles = c.subs.flatMap(s => s.holes).filter(h => h.path);
  feats.forEach(f => {
    const ctr = centroidLL(f.p);
    if (f.t === 'bunker' || f.t === 'fairway') {
      let best = null, bd = f.t === 'fairway' ? 40 : 60;
      allHoles.forEach(h => { const d = distToPath(ctr, h.path); if (d < bd) { bd = d; best = h; } });
      if (best) best.hazards.push(f); else c.spare.feats.push(f);
    } else {
      const near = allHoles.filter(h => f.p.some(q => distToPath(q, h.path) < 35));
      if (near.length) near.forEach(h => h.hazards.push(f)); else c.spare.feats.push(f);
    }
  });
  greens.forEach((g, i) => { if (!usedGreens.has(i)) c.spare.greens.push(g); });
  return c;
}
// 편집기에서 티·그린을 찍은 뒤 가까운 미배정 해저드를 그 홀에 붙여요
function attachSpare(c, H) {
  if (!c.spare || !hasMap(H)) return 0;
  const path = holeGeo(H).path; let n = 0;
  c.spare.feats = c.spare.feats.filter(f => {
    const ctr = centroidLL(f.p);
    const close = f.t === 'water' ? f.p.some(q => distToPath(q, path) < 35) : distToPath(ctr, path) < (f.t === 'fairway' ? 40 : 45);
    if (close) { H.hazards.push(f); n++; return f.t === 'water'; }
    return true;
  });
  return n;
}

// ---------- 고도 (Open-Meteo, Copernicus DEM 90m) ----------
async function fetchElev(points) {
  const out = [];
  for (let i = 0; i < points.length; i += 90) {
    const ch = points.slice(i, i + 90);
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${ch.map(p => p.lat.toFixed(6)).join(',')}&longitude=${ch.map(p => p.lng.toFixed(6)).join(',')}`);
    if (!r.ok) throw new Error('고도 정보를 받지 못했어요');
    const j = await r.json(); out.push(...j.elevation);
  }
  return out;
}
async function fillElevations(c, force) {
  const targets = [];
  c.subs.forEach(s => s.holes.forEach(H => { const g = holeGeo(H); if (g.tee && g.green && (force || !H.elev)) targets.push({ H, g }); }));
  if (!targets.length) return 0;
  const els = await fetchElev(targets.flatMap(t => [t.g.tee, t.g.green]));
  targets.forEach((t, i) => { t.H.elev = { tee: els[i * 2], green: els[i * 2 + 1] }; });
  save();
  return targets.length;
}
const elevCache = { at: null, v: null };
async function elevAt(p) {
  if (elevCache.at && distM(elevCache.at, p) < 15) return elevCache.v;
  const [v] = await fetchElev([p]); elevCache.at = p; elevCache.v = v; return v;
}

// ---------- 날씨 (Open-Meteo) ----------
const WX = {};
async function weatherAt(p) {
  const k = p.lat.toFixed(2) + ',' + p.lng.toFixed(2);
  if (WX[k] && Date.now() - WX[k].t < 15 * 60000) return WX[k].v;
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lng}&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,weather_code&wind_speed_unit=ms&timezone=Asia%2FSeoul`);
  if (!r.ok) throw new Error('날씨 정보를 받지 못했어요');
  const j = await r.json(), cur = j.current;
  const v = { temp: cur.temperature_2m, speed: cur.wind_speed_10m, dir: cur.wind_direction_10m, gust: cur.wind_gusts_10m, rain: cur.precipitation, code: cur.weather_code };
  WX[k] = { t: Date.now(), v };
  return v;
}
const compass = d => ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][Math.round(((d % 360) + 360) % 360 / 45) % 8];
const wxText = code => code == null ? '' : code === 0 ? '맑음' : code <= 3 ? '구름' : code <= 48 ? '안개' : code <= 67 ? '비' : code <= 77 ? '눈' : code <= 82 ? '소나기' : '뇌우';
