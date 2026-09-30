'use strict';
/* 지도 · 도면 그림 · GPS · 기울기 센서 · 오프라인 타일 */

const TILE_SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TILE_STREET = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const COL = { rough: '#3E7D4A', fair: '#79B97B', green: '#9ADA9C', sand: '#EAD9A2', water: '#5B9BD5', tee: '#F4F7F2', flag: '#E2A516', ob: '#FFFFFF' };

// ---------- 홀 도면 (SVG, 야디지북) ----------
function rotator(origin, b) {
  const cb = Math.cos(b * RAD), sb = Math.sin(b * RAD);
  const f = p => { const v = toXY(p, origin); return { x: v.x * cb - v.y * sb, y: -(v.x * sb + v.y * cb) }; };
  f.inv = (x, y) => { const yy = -y; return fromXY({ x: x * cb + yy * sb, y: -x * sb + yy * cb }, origin); };
  return f;
}
function holeSVG(H, o = {}) {
  const g = holeGeo(H);
  if (!g.green) return `<div class="nomap">${svg(ICON.map, 34)}<p>이 홀은 아직 도면이 없어요.</p></div>`;
  const b = g.tee ? bearing(g.tee, g.green) : g.approach || 0;
  const R = rotator(g.green, b);
  const pts = [];
  const add = arr => arr.forEach(p => pts.push(R(p)));
  if (g.path) add(g.path); else add([g.green]);
  if (H.greenPoly) add(H.greenPoly);
  (H.hazards || []).forEach(z => { if (z.t !== 'water' || z.p.length < 60) add(z.p); else add(z.p.filter(q => g.path ? distToPath(q, g.path) < 60 : distM(q, g.green) < 80)); });
  ['me', 'pin', 'target'].forEach(k => { if (o[k] && distM(o[k], g.green) < 700) add([o[k]]); });
  let minX = Math.min(...pts.map(p => p.x)) - 22, maxX = Math.max(...pts.map(p => p.x)) + 22;
  const minY = Math.min(...pts.map(p => p.y)) - 26, maxY = Math.max(...pts.map(p => p.y)) + 26;
  let w = maxX - minX; const h = maxY - minY;
  if (w < h * 0.62) { const e = (h * 0.62 - w) / 2; minX -= e; maxX += e; w = maxX - minX; }
  const fs = clamp(h / 34, 7, 16), sw = fs / 7;
  const P = arr => arr.map(p => { const q = R(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ');
  let s = `<svg class="holesvg" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" role="img" aria-label="홀 도면" ${o.tap ? `data-act="${o.tap}" data-b="${b}" data-lat="${g.green.lat}" data-lng="${g.green.lng}"` : ''}>
    <rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${COL.rough}"/>`;
  const fair = (H.hazards || []).filter(z => z.t === 'fairway');
  if (fair.length) fair.forEach(z => { s += `<polygon points="${P(z.p)}" fill="${COL.fair}"/>`; });
  else if (g.path && H.par > 3) s += `<polyline points="${P(g.path)}" fill="none" stroke="${COL.fair}" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
  (H.hazards || []).forEach(z => {
    if (z.t === 'water') s += `<polygon points="${P(z.p)}" fill="${COL.water}"/>`;
    if (z.t === 'bunker') s += `<polygon points="${P(z.p)}" fill="${COL.sand}"/>`;
    if (z.t === 'ob') s += `<polyline points="${P(z.p)}" fill="none" stroke="#fff" stroke-width="${sw * 1.6}" stroke-dasharray="${sw * 4} ${sw * 3}"/>`;
  });
  if (H.greenPoly) s += `<polygon points="${P(H.greenPoly)}" fill="${COL.green}" stroke="#fff" stroke-opacity=".5" stroke-width="${sw * .6}"/>`;
  else s += `<circle cx="0" cy="0" r="14" fill="${COL.green}"/>`;
  if (g.tee) { const t = R(g.tee); s += `<rect x="${t.x - 6}" y="${t.y - 4}" width="12" height="8" rx="2" fill="${COL.tee}"/>`; }
  if (g.path) s += `<polyline points="${P(g.path)}" fill="none" stroke="#fff" stroke-width="${sw}" stroke-dasharray="${sw * 3} ${sw * 3}" opacity=".85"/>`;
  // 그린까지 남은 거리 표시 (100/150/200/250)
  if (g.path && g.len > 120) {
    [100, 150, 200, 250].forEach(m => {
      if (m >= g.len - 20) return;
      const p = pointAlong(g.path.slice().reverse(), m);
      if (distM(p, g.green) < m - 25) return;
      const q = R(p);
      s += `<circle cx="${q.x}" cy="${q.y}" r="${sw * 2}" fill="#fff"/><text x="${q.x + fs * .7}" y="${q.y + fs * .35}" font-size="${fs}" fill="#fff" class="lbl">${dfmt(m)}</text>`;
    });
  }
  // 티에서 본 해저드 거리
  if (g.tee && o.labels !== false) {
    const main = bearing(g.tee, g.green);
    (H.hazards || []).filter(z => (z.t === 'bunker' || z.t === 'water') && z.p.length > 2).slice(0, 8).forEach(z => {
      const ctr = centroidLL(z.p);
      if (z.p.length > 60 && g.path && distToPath(ctr, g.path) > 60) return;
      const nf = polyNearFar(g.tee, z.p), c = R(ctr), rel = angDiff(bearing(g.tee, ctr), main);
      const tx = c.x + (rel < 0 ? -1 : 1) * fs * 1.4;
      s += `<text x="${tx}" y="${c.y + fs * .3}" font-size="${fs * .85}" fill="#fff" text-anchor="${rel < 0 ? 'end' : 'start'}" class="lbl">${dfmt(nf.near)}–${dfmt(nf.far)}</text>`;
    });
  }
  // 핀 · 나 · 목표
  const pin = o.pin ? R(o.pin) : { x: 0, y: 0 };
  s += `<line x1="${pin.x}" y1="${pin.y}" x2="${pin.x}" y2="${pin.y - fs * 2.2}" stroke="#fff" stroke-width="${sw}"/><path d="M${pin.x} ${pin.y - fs * 2.2} l${fs * 1.3} ${fs * .45} l${-fs * 1.3} ${fs * .45}z" fill="${COL.flag}"/>`;
  if (o.shots) o.shots.forEach(sh => { if (!sh.s || !sh.e) return; const a = R(sh.s), e = R(sh.e); s += `<line x1="${a.x}" y1="${a.y}" x2="${e.x}" y2="${e.y}" stroke="${COL.flag}" stroke-width="${sw}" opacity=".7"/><circle cx="${e.x}" cy="${e.y}" r="${sw * 2.2}" fill="${COL.flag}"/>`; });
  if (o.target) { const t = R(o.target); s += `<circle cx="${t.x}" cy="${t.y}" r="${sw * 3}" fill="${COL.flag}" stroke="#fff" stroke-width="${sw}"/>`; }
  if (o.me && distM(o.me, g.green) < 700) { const m = R(o.me); s += `<circle cx="${m.x}" cy="${m.y}" r="${sw * 3.2}" fill="#2B7FFF" stroke="#fff" stroke-width="${sw * 1.2}"/>`; }
  if (g.len && o.labels !== false) s += `<text x="${minX + fs * .6}" y="${maxY - fs * .6}" font-size="${fs}" fill="#fff" class="lbl">${dfmt(holeLen(H, o.tee) || g.len)}${uLabel()}${elevDiff(H) != null ? ` · ${sgn(elevDiff(H))}m` : ''}</text>`;
  return s + '</svg>';
}

// ---------- 그린 도면 (SVG) ----------
function greenSVG(H, o = {}) {
  const g = holeGeo(H);
  if (!g.green) return '';
  const b = g.approach || 0, R = rotator(g.green, b);
  const poly = H.greenPoly && H.greenPoly.length > 2 ? H.greenPoly : Array.from({ length: 24 }, (_, i) => dest(g.green, i * 15, 14));
  const pts = poly.map(R);
  if (o.ball) pts.push(R(o.ball));
  if (o.pin) pts.push(R(o.pin));
  const minX = Math.min(...pts.map(p => p.x)) - 5, maxX = Math.max(...pts.map(p => p.x)) + 5;
  const minY = Math.min(...pts.map(p => p.y)) - 5, maxY = Math.max(...pts.map(p => p.y)) + 7;
  const w = maxX - minX, h = maxY - minY;
  let s = `<svg class="greensvg" viewBox="${minX} ${minY} ${w} ${h}" data-act="greenTap" data-b="${b}" data-lat="${g.green.lat}" data-lng="${g.green.lng}" role="img" aria-label="그린 도면. 탭해서 위치를 찍어요">
    <rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${COL.rough}"/>
    <polygon points="${pts.slice(0, poly.length).map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')}" fill="${COL.green}" stroke="#fff" stroke-opacity=".6" stroke-width=".25"/>`;
  for (let x = Math.ceil(minX / 5) * 5; x < maxX; x += 5) s += `<line x1="${x}" y1="${minY}" x2="${x}" y2="${maxY}" stroke="#fff" stroke-opacity=".12" stroke-width=".12"/>`;
  for (let y = Math.ceil(minY / 5) * 5; y < maxY; y += 5) s += `<line x1="${minX}" y1="${y}" x2="${maxX}" y2="${y}" stroke="#fff" stroke-opacity=".12" stroke-width=".12"/>`;
  (o.reads || []).forEach(rd => {
    if (!rd.ball) return;
    const p = R(rd.ball), a = (rd.dir - b) * RAD, L = clamp(rd.pct * 1.4, 1.2, 5);
    const ex = p.x + Math.sin(a) * L, ey = p.y - Math.cos(a) * L;
    s += `<line x1="${p.x}" y1="${p.y}" x2="${ex}" y2="${ey}" stroke="#fff" stroke-width=".3" opacity=".8"/><circle cx="${ex}" cy="${ey}" r=".45" fill="#fff" opacity=".8"/>`;
  });
  if (o.pin) {
    const p = R(o.pin);
    s += `<circle cx="${p.x}" cy="${p.y}" r=".6" fill="#13241B"/><line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y - 4.5}" stroke="#fff" stroke-width=".25"/><path d="M${p.x} ${p.y - 4.5} l2.4 .8 l-2.4 .8z" fill="${COL.flag}"/>`;
  }
  if (o.ball) {
    const p = R(o.ball);
    s += `<circle cx="${p.x}" cy="${p.y}" r=".9" fill="#fff" stroke="#13241B" stroke-width=".2"/>`;
    if (o.pin) { const q = R(o.pin); s += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${COL.flag}" stroke-width=".3" stroke-dasharray=".8 .6"/>`; }
    if (o.read) {
      const a = (o.read.dir - b) * RAD, L = clamp(o.read.pct * 1.6, 1.5, 6);
      s += `<line x1="${p.x}" y1="${p.y}" x2="${p.x + Math.sin(a) * L}" y2="${p.y - Math.cos(a) * L}" stroke="#C8412B" stroke-width=".55"/><circle cx="${p.x + Math.sin(a) * L}" cy="${p.y - Math.cos(a) * L}" r=".8" fill="#C8412B"/>`;
    }
  }
  s += `<text x="${minX + 1}" y="${maxY - 1.2}" font-size="1.8" fill="#fff" class="lbl">↑ 그린에 올라오는 방향 · 격자 5m</text>`;
  return s + '</svg>';
}
function svgPointLL(svgEl, ev) {
  const pt = svgEl.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const q = pt.matrixTransform(svgEl.getScreenCTM().inverse());
  return rotator({ lat: Number(svgEl.dataset.lat), lng: Number(svgEl.dataset.lng) }, Number(svgEl.dataset.b)).inv(q.x, q.y);
}

// ---------- Leaflet ----------
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => res(); s.onerror = () => { s.remove(); rej(new Error('지도를 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 열어주세요.')); };
    document.head.appendChild(s);
  });
}
const M = { map: null, kind: null, layers: null, me: null, ctx: null };
function destroyMap() {
  M.seq = (M.seq || 0) + 1;
  if (M.map) { try { M.map.off(); M.map.remove(); } catch (e) { /* 이미 떨어진 지도 */ } }
  M.map = null; M.me = null; M.kind = null; M.ctx = null;
}
async function makeMap(kind, street) {
  const el = $('#map'); if (!el) return null;
  const seq = M.seq;
  try { await loadLeaflet(); } catch (e) { el.innerHTML = `<p class="empty">${esc(e.message)}</p>`; return null; }
  if (!document.body.contains(el) || M.map || seq !== M.seq || el._leaflet_id) return null;
  el.innerHTML = '';
  const map = M.map = L.map(el, { zoomControl: false, maxZoom: 20, tap: true });
  L.tileLayer(street ? TILE_STREET : TILE_SAT, { maxNativeZoom: street ? 18 : 19, maxZoom: 20, attribution: 'Esri' }).addTo(map);
  M.kind = kind;
  M.layers = { base: L.layerGroup().addTo(map), draw: L.layerGroup().addTo(map), top: L.layerGroup().addTo(map) };
  return map;
}
const llA = p => [p.lat, p.lng];
function divLabel(t, cls = '') { return L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="maplbl ${cls}">${t}</div>` }); }
function flagIcon(label, cur) {
  return L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="mapflag ${cur ? 'cur' : ''}"><i></i><b>${label}</b></div>` });
}
function drawHoleOnMap(layer, H, strong) {
  const g = holeGeo(H), op = strong ? 1 : 0.45;
  (H.hazards || []).forEach(z => {
    if (z.t === 'ob') L.polyline(z.p.map(llA), { color: '#fff', weight: 2, dashArray: '6 5', opacity: op, interactive: false }).addTo(layer);
    else if (z.t !== 'fairway') L.polygon(z.p.map(llA), { color: z.t === 'water' ? COL.water : COL.sand, weight: 1.5, fillOpacity: strong ? 0.25 : 0.1, opacity: op, interactive: false }).addTo(layer);
  });
  if (H.greenPoly) L.polygon(H.greenPoly.map(llA), { color: '#b9f5c4', weight: 2, fillOpacity: 0.12, opacity: op, interactive: false }).addTo(layer);
  if (g.path) L.polyline(g.path.map(llA), { color: '#fff', weight: 2, dashArray: '3 7', opacity: op * .9, interactive: false }).addTo(layer);
  if (g.tee && strong) L.circleMarker(llA(g.tee), { radius: 6, color: '#fff', weight: 2, fillColor: '#1E5B3F', fillOpacity: 1, interactive: false }).addTo(layer);
}
function drawMe() {
  if (!M.map || !G.pos) return;
  if (!M.me) M.me = L.circleMarker(llA(G.pos), { radius: 8, color: '#fff', weight: 3, fillColor: '#2B7FFF', fillOpacity: 1, interactive: false }).addTo(M.map);
  else M.me.setLatLng(llA(G.pos));
}

// ---------- 라운드 지도 ----------
async function initRoundMap(r) {
  const map = await makeMap('round'); if (!map) return;
  M.ctx = { r };
  map.on('click', e => {
    const ll = { lat: e.latlng.lat, lng: e.latlng.lng };
    if (state.mapMode === 'pin') { (r.pins ||= {})[r.cur] = ll; state.mapMode = 'measure'; save(); toast('오늘 핀 위치를 찍었어요'); }
    else state.mapTarget = ll;
    drawRoundMap(); renderGpsPanel();
  });
  drawRoundMap(true);
}
function drawRoundMap(fit) {
  if (!M.map || M.kind !== 'round') return;
  const r = M.ctx.r, ref = roundHoleRef(r, r.cur);
  const { base, draw } = M.layers; base.clearLayers(); draw.clearLayers();
  r.holes.forEach((X, i) => {
    const hr = roundHoleRef(r, i); if (!hr) return;
    if (i !== r.cur) { const gg = holeGeo(hr.H).green; if (gg) L.marker(llA(gg), { icon: flagIcon(X.no, false), interactive: false }).addTo(base); }
  });
  if (!ref) return;
  const H = ref.H, g = holeGeo(H);
  drawHoleOnMap(base, H, true);
  const pin = (r.pins || {})[r.cur] || g.green;
  if (pin) L.marker(llA(pin), { icon: flagIcon(r.holes[r.cur].no, true), interactive: false, zIndexOffset: 1000 }).addTo(base);
  const line = (a, b, color) => {
    L.polyline([llA(a), llA(b)], { color, weight: 3, dashArray: '6 6', interactive: false }).addTo(draw);
    L.marker([(a.lat + b.lat) / 2, (a.lng + b.lng) / 2], { icon: divLabel(dfmt(distM(a, b)) + uLabel()), interactive: false }).addTo(draw);
  };
  const T = state.mapTarget;
  if (T) {
    L.circleMarker(llA(T), { radius: 7, color: '#fff', weight: 2, fillColor: COL.flag, fillOpacity: 1, interactive: false }).addTo(draw);
    if (G.pos) line(G.pos, T, '#ffffff');
    if (pin) line(T, pin, COL.flag);
  } else if (G.pos && pin && distM(G.pos, pin) < 800) line(G.pos, pin, '#ffffff');
  drawMe();
  if (fit) {
    const b = [];
    if (g.tee) b.push(llA(g.tee)); if (g.green) b.push(llA(g.green));
    if (G.pos && g.green && distM(G.pos, g.green) < 700) b.push(llA(G.pos));
    (H.greenPoly || []).forEach(p => b.push(llA(p)));
    if (b.length >= 2) M.map.fitBounds(b, { padding: [30, 30], maxZoom: 18 });
    else if (g.green) M.map.setView(llA(g.green), 17);
    else { const c = course(r.courseId); const p = G.pos || (c && c.loc); M.map.setView(p ? llA(p) : [36.4, 127.9], p ? 16 : 7); }
  }
}

// ---------- 코스 편집기 ----------
async function initEditMap(c, si, hi) {
  const map = await makeMap('edit'); if (!map) return;
  M.ctx = { c, si, hi };
  map.on('click', e => editTap({ lat: e.latlng.lat, lng: e.latlng.lng }));
  drawEditMap(true);
}
function editHole() { const { c, si, hi } = M.ctx; return c.subs[si].holes[hi]; }
function drawEditMap(fit) {
  if (!M.map || M.kind !== 'edit') return;
  const { c, si, hi } = M.ctx, H = editHole();
  const { base, draw, top } = M.layers; base.clearLayers(); draw.clearLayers(); top.clearLayers();
  // 미배정 도면(OSM) — 탭해서 쓸 수 있게 보여줘요
  (c.spare?.greens || []).forEach((gp, gi) => {
    L.polygon(gp.map(llA), { color: '#b9f5c4', weight: 1.5, dashArray: '4 4', fillOpacity: 0.08, interactive: false }).addTo(base);
  });
  (c.spare?.feats || []).forEach(f => {
    if (f.t === 'ob') return;
    L.polygon(f.p.map(llA), { color: f.t === 'water' ? COL.water : f.t === 'bunker' ? COL.sand : '#9fd49f', weight: 1, dashArray: '3 4', fillOpacity: 0.05, interactive: false }).addTo(base);
  });
  c.subs.forEach((s, sj) => s.holes.forEach((X, j) => {
    if (sj === si && j === hi) return;
    const gg = holeGeo(X);
    if (gg.path) L.polyline(gg.path.map(llA), { color: '#fff', weight: 1, opacity: .35, interactive: false }).addTo(base);
    if (gg.green) L.marker(llA(gg.green), { icon: flagIcon(`${s.name}${j + 1}`, false), interactive: false }).addTo(base);
  }));
  drawHoleOnMap(top, H, true);
  const g = holeGeo(H);
  if (g.green) L.marker(llA(g.green), { icon: flagIcon(hi + 1, true), interactive: false }).addTo(top);
  if (g.path && g.len) {
    const mid = pointAlong(g.path, g.len / 2);
    L.marker(llA(mid), { icon: divLabel(`${dfmt(g.len)}${uLabel()}`), interactive: false }).addTo(top);
  }
  // 그리는 중인 도형
  const d = state.editDraft;
  if (d && d.pts.length) {
    const opt = { color: COL.flag, weight: 2.5, interactive: false };
    if (d.t === 'ob' || d.pts.length < 3) L.polyline(d.pts.map(llA), opt).addTo(draw); else L.polygon(d.pts.map(llA), { ...opt, fillOpacity: .2 }).addTo(draw);
    d.pts.forEach(p => L.circleMarker(llA(p), { radius: 4, color: '#fff', weight: 1.5, fillColor: COL.flag, fillOpacity: 1, interactive: false }).addTo(draw));
  }
  drawMe();
  if (fit) {
    const b = [];
    if (g.tee) b.push(llA(g.tee)); if (g.green) b.push(llA(g.green));
    if (b.length === 2) M.map.fitBounds(b, { padding: [60, 60], maxZoom: 18 });
    else if (b.length === 1) M.map.setView(b[0], 17);
    else {
      const prev = c.subs[si].holes[hi - 1] ? holeGeo(c.subs[si].holes[hi - 1]).green : null;
      const p = prev || c.loc || G.pos;
      M.map.setView(p ? llA(p) : [36.4, 127.9], p ? 17 : 7);
    }
  }
  renderEditPanel();
}
function editSnapshot() { const H = editHole(); (state.editUndo ||= []).push(JSON.stringify(H)); if (state.editUndo.length > 40) state.editUndo.shift(); }
function editTap(ll) {
  const { c } = M.ctx, H = editHole(), t = state.editTool;
  if (['bunker', 'water', 'ob', 'greenPoly', 'fairway'].includes(t)) {
    if (!state.editDraft || state.editDraft.t !== t) state.editDraft = { t, pts: [] };
    state.editDraft.pts.push(ll); drawEditMap(); return;
  }
  editSnapshot();
  if (t === 'tee') { H.tee = ll; if (H.path) H.path[0] = ll; }
  if (t === 'green') {
    const gi = (c.spare?.greens || []).findIndex(gp => pointInPoly(ll, gp));
    if (gi >= 0) { H.greenPoly = c.spare.greens[gi]; H.green = centroidLL(H.greenPoly); c.spare.greens.splice(gi, 1); toast('지도에 있던 그린 윤곽을 이 홀에 붙였어요'); }
    else { H.green = ll; if (H.greenPoly && !pointInPoly(ll, H.greenPoly)) H.greenPoly = null; }
  }
  if (t === 'dogleg') { const g = holeGeo(H); if (!g.tee || !g.green) { toast('티와 그린을 먼저 찍어주세요'); state.editUndo.pop(); return; } const mid = H.path && H.path.length > 2 ? H.path.slice(1, -1) : []; mid.push(ll); H.path = [g.tee, ...mid, g.green]; }
  if (t === 'erase') {
    const i = (H.hazards || []).findIndex(z => z.t === 'ob' ? distToPath(ll, z.p) < 6 : pointInPoly(ll, z.p));
    if (i >= 0) { const [z] = H.hazards.splice(i, 1); (c.spare ||= { greens: [], feats: [] }).feats.push(z); toast(`${HZ[z.t]}를 이 홀에서 뺐어요`); }
    else if (H.path && H.path.length > 2) { const k = H.path.slice(1, -1).findIndex(p => distM(p, ll) < 15); if (k >= 0) { H.path.splice(k + 1, 1); toast('꺾이는 지점을 지웠어요'); } else state.editUndo.pop(); }
    else state.editUndo.pop();
  }
  if (H.tee && H.green && H.path) { H.path[0] = H.tee; H.path[H.path.length - 1] = H.green; }
  if (H.tee && H.green && !H.path) H.path = [H.tee, H.green];
  const n = attachSpare(c, H); if (n) toast(`근처 벙커·해저드 ${n}개를 이 홀에 붙였어요`);
  H.elev = null; save(); drawEditMap(); scheduleElev(c);
}
function editFinishShape() {
  const d = state.editDraft, H = editHole();
  if (!d || (d.t !== 'ob' && d.pts.length < 3) || d.pts.length < 2) { toast(d && d.t === 'ob' ? '두 점 이상 찍어주세요' : '세 점 이상 찍어주세요'); return; }
  editSnapshot();
  if (d.t === 'greenPoly') { H.greenPoly = d.pts; H.green = centroidLL(d.pts); if (H.path) H.path[H.path.length - 1] = H.green; }
  else H.hazards.push({ t: d.t, p: d.pts });
  state.editDraft = null; save(); drawEditMap(); scheduleElev(M.ctx.c);
}
let elevT = null;
function scheduleElev(c) { clearTimeout(elevT); elevT = setTimeout(() => fillElevations(c).then(n => { if (n && M.kind === 'edit') renderEditPanel(); }).catch(() => {}), 1500); }

// ---------- 전국 지도 ----------
async function initKRMap(list) {
  const map = await makeMap('kr', true); if (!map) return;
  map.setView(G.pos ? llA(G.pos) : [36.4, 127.9], G.pos ? 10 : 7);
  list.forEach(e => {
    const st = krStatus(e);
    L.circleMarker([e.y, e.x], { radius: 7, color: '#fff', weight: 1.5, fillColor: st === 'full' ? '#2F7A55' : st === 'green' ? '#E2A516' : '#7E8C84', fillOpacity: 1 })
      .bindPopup(`<b>${esc(e.n)}</b><br>${esc(e.a || '')}<br><a href="#/osm/${e.i}">자세히 보기 ›</a>`).addTo(M.layers.base);
  });
  drawMe();
}

// ---------- GPS ----------
const G = { id: null, pos: null, acc: null, err: null, t: 0 };
function gpsWanted() {
  const [p, , b] = route();
  if (!db.settings.gps) return false;
  return (p === 'play' && ['hole', 'gps', 'green', undefined].includes(b)) || p === 'edit' || p === 'find' || p === 'kr';
}
function gpsSync() { if (gpsWanted()) gpsStart(); else gpsStop(); }
function gpsStart() {
  if (G.id != null) return;
  if (!('geolocation' in navigator)) { G.err = '이 기기에서는 위치를 쓸 수 없어요'; return; }
  G.id = navigator.geolocation.watchPosition(p => {
    G.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; G.acc = Math.round(p.coords.accuracy); G.err = null; G.t = Date.now();
    onGps();
  }, e => {
    G.err = e.code === 1 ? '위치 권한이 꺼져 있어요. 설정에서 허용해주세요.' : '위치를 찾는 중이에요';
    onGps();
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
}
function gpsStop() { if (G.id != null) { navigator.geolocation.clearWatch(G.id); G.id = null; } }
function gpsOnce() {
  return new Promise((res, rej) => {
    if (G.pos && G.acc != null && G.acc < 50 && Date.now() - G.t < 5000) return res(G.pos);
    if (!('geolocation' in navigator)) return rej(new Error('이 기기에서는 위치를 쓸 수 없어요'));
    navigator.geolocation.getCurrentPosition(p => { G.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; G.acc = Math.round(p.coords.accuracy); G.t = Date.now(); res(G.pos); },
      e => rej(new Error(e.code === 1 ? '위치 권한이 꺼져 있어요. 휴대폰 설정에서 이 앱(브라우저)의 위치 권한을 허용해주세요.' : '위치를 찾지 못했어요. 하늘이 트인 곳에서 다시 시도해주세요.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 3000 });
  });
}
function onGps() {
  const [p, a, b] = route();
  if (p === 'play') {
    const r = rnd(a);
    if (r && !r.finished) autoHole(r);
    renderGpsPanel();
    const sd = $('#shotDist'); if (sd && state.shot && G.pos) sd.textContent = dfmt(distM(state.shot.start, G.pos));
    if (b === 'gps') drawRoundMap();
  }
  if (M.map) drawMe();
  // 골프장 찾기: 첫 위치가 잡히면 가까운 순으로 한 번 다시 그려요
  if (p === 'find' && G.pos && !state.findSorted) { state.findSorted = true; if (!document.activeElement || document.activeElement.id !== 'findQ') render(); }
  const acc = $('#gpsAcc'); if (acc) acc.textContent = G.err ? G.err : G.acc != null ? `GPS ±${G.acc}m` : 'GPS 찾는 중';
}
// 다음 홀 티에 20m 안으로 들어가면 자동으로 홀을 넘겨요
function autoHole(r) {
  if (!db.settings.autoHole || !G.pos || G.acc > 25) return;
  const nx = r.cur + 1; if (nx >= r.holes.length) return;
  const ref = roundHoleRef(r, nx); if (!ref) return;
  const t = holeGeo(ref.H).tee; if (!t) return;
  if (distM(G.pos, t) < 20 && state.autoFrom !== r.cur) {
    state.autoFrom = r.cur; r.cur = nx; state.mapTarget = null; save();
    toast(`${r.holes[nx].no}번 홀 티잉 구역이에요. 홀을 넘겼어요.`);
    render();
  }
}

// ---------- 기울기 센서 ----------
const LV = { on: false, samples: [], h: null };
async function levelStart() {
  if (typeof DeviceOrientationEvent === 'undefined') throw new Error('이 기기에는 기울기 센서가 없어요');
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    const p = await DeviceOrientationEvent.requestPermission();
    if (p !== 'granted') throw new Error('기울기 센서 권한이 필요해요. 다시 눌러 "허용"을 선택해주세요.');
  }
  levelStop();
  LV.samples = [];
  LV.h = e => {
    if (e.beta == null || e.gamma == null) return;
    LV.samples.push({ b: e.beta, g: e.gamma, t: Date.now() });
    if (LV.samples.length > 90) LV.samples.shift();
    levelUI();
  };
  window.addEventListener('deviceorientation', LV.h);
  LV.on = true;
  setTimeout(() => { if (LV.on && !LV.samples.length) toast('센서 값이 들어오지 않아요. 휴대폰이 기울기 센서를 지원하는지 확인해주세요.', 4000); }, 2500);
}
function levelStop() { if (LV.h) window.removeEventListener('deviceorientation', LV.h); LV.h = null; LV.on = false; }
function levelNow(raw) {
  const s = LV.samples.filter(x => Date.now() - x.t < 1200);
  if (!s.length) return null;
  const c = raw ? { b: 0, g: 0 } : db.settings.lvl;
  const b = avg(s.map(x => x.b)) - c.b, g = avg(s.map(x => x.g)) - c.g;
  const spread = Math.max(...s.map(x => x.b)) - Math.min(...s.map(x => x.b)) + Math.max(...s.map(x => x.g)) - Math.min(...s.map(x => x.g));
  return { b, g, steady: spread < 0.6 && s.length >= 5 };
}
function levelUI() {
  const box = $('#level'); if (!box) return;
  const v = levelNow(state.levelRaw); if (!v) return;
  const bub = $('#bubble'), K = 14;
  if (bub) bub.style.transform = `translate(${clamp(-v.g * K, -60, 60)}px, ${clamp(-v.b * K, -60, 60)}px)`;
  const t = $('#levelTxt');
  if (t) {
    const pr = puttRead(v.b, v.g);
    t.innerHTML = `<b class="num">${pr.total.toFixed(1)}%</b> · ${pr.high} ${v.steady ? '<span class="tag on">안정</span>' : '<span class="tag">흔들림</span>'}`;
  }
}

// ---------- 오프라인 지도 저장 ----------
function lon2tile(lon, z) { return Math.floor((lon + 180) / 360 * 2 ** z); }
function lat2tile(lat, z) { return Math.floor((1 - Math.log(Math.tan(lat * RAD) + 1 / Math.cos(lat * RAD)) / Math.PI) / 2 * 2 ** z); }
function courseBounds(c) {
  const pts = [];
  c.subs.forEach(s => s.holes.forEach(H => { const g = holeGeo(H); if (g.tee) pts.push(g.tee); if (g.green) pts.push(g.green); }));
  if (pts.length < 2 && c.loc) { pts.push(dest(c.loc, 45, 900), dest(c.loc, 225, 900)); }
  if (!pts.length) return null;
  const pad = 0.002;
  return { s: Math.min(...pts.map(p => p.lat)) - pad, n: Math.max(...pts.map(p => p.lat)) + pad, w: Math.min(...pts.map(p => p.lng)) - pad, e: Math.max(...pts.map(p => p.lng)) + pad };
}
async function saveOffline(c, onProg) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) throw new Error('오프라인 저장은 URL로 연 웹앱(홈 화면에 추가한 앱 포함)에서만 돼요. 한 번 새로고침한 뒤 다시 시도해주세요.');
  const b = courseBounds(c); if (!b) throw new Error('골프장 위치가 없어요. 먼저 위치를 설정하거나 도면을 그려주세요.');
  const urls = [];
  for (let z = 14; z <= 18; z++) {
    for (let x = lon2tile(b.w, z); x <= lon2tile(b.e, z); x++) for (let y = lat2tile(b.n, z); y <= lat2tile(b.s, z); y++) urls.push(TILE_SAT.replace('{z}', z).replace('{x}', x).replace('{y}', y));
  }
  if (urls.length > 1500) throw new Error('범위가 너무 넓어요. 도면을 먼저 그린 뒤 다시 시도해주세요.');
  urls.push('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
  let done = 0;
  const q = urls.slice();
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (q.length) { const u = q.shift(); try { await fetch(u, { mode: 'no-cors' }); } catch (e) { /* 건너뜀 */ } done++; if (onProg) onProg(done, urls.length); }
  }));
  db.offline[c.id] = { date: today(), tiles: urls.length }; save();
  return urls.length;
}
