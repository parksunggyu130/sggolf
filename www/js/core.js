'use strict';
/* SG골프 공략북 — 공통 유틸 · 저장소 · 좌표 계산 */
const APP_VER = '1.0.0';
const KEY = 'sggolf.v2';

// ---------- 유틸 ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sum = a => a.reduce((x, y) => x + y, 0);
const avg = a => a.length ? sum(a) / a.length : null;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clone = o => JSON.parse(JSON.stringify(o));
const round1 = v => Math.round(v * 10) / 10;
const won = n => (Math.round(n) > 0 ? '+' : Math.round(n) < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR');
const wonAbs = n => Math.abs(Math.round(n)).toLocaleString('ko-KR') + '원';
const tp = n => n === 0 ? 'E' : (n > 0 ? '+' + n : String(n));
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(Math.round(n));
const pad2 = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const fmtDate = s => { const d = new Date(s + 'T00:00'); return `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`; };
const fmtDateLong = s => { const d = new Date(s + 'T00:00'); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`; };
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const hk = (cid, sid, i) => `${cid}:${sid}:${i}`;

const TEES = [['black', '블랙'], ['blue', '블루'], ['white', '화이트'], ['red', '레드']];
const CLUBS = ['드라이버', '3번 우드', '5번 우드', '유틸리티', '4번 아이언', '5번 아이언', '6번 아이언', '7번 아이언', '8번 아이언', '9번 아이언', 'PW', 'AW', 'SW', 'LW'];
// 측정 기록이 없는 클럽은 드라이버 거리에 이 비율을 곱해 추정해요 (아마추어 평균 비율)
const CLUB_RATIO = { '드라이버': 1, '3번 우드': .9, '5번 우드': .85, '유틸리티': .8, '4번 아이언': .76, '5번 아이언': .72, '6번 아이언': .68, '7번 아이언': .64, '8번 아이언': .59, '9번 아이언': .54, 'PW': .49, 'AW': .43, 'SW': .37, 'LW': .31 };
const DEFAULT_PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5];
const HZ = { bunker: '벙커', water: '해저드', ob: 'OB', fairway: '페어웨이' };

// ---------- 저장소 ----------
function defaults() {
  return {
    ver: 2,
    settings: {
      unit: 'm', inputMode: 'strokes', wake: true, big: false, theme: 'auto', haptic: true, detail: 'all',
      gps: true, meId: null, driver: 200, stride: 0.75, stimp: 10, voice: false, autoHole: true, lvl: { b: 0, g: 0 },
    },
    friends: [], courses: [], rounds: [], shots: [], notes: {}, reads: {}, favs: [], offline: {}, lastBets: null,
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const d = JSON.parse(raw), base = defaults(); return { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } }; }
  } catch (e) { /* 저장소 없음 */ }
  return defaults();
}
let db = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('저장하지 못했어요. 설정에서 백업한 뒤 오래된 라운드를 지워주세요.'); }
}
const friend = id => db.friends.find(f => f.id === id);
const course = id => db.courses.find(c => c.id === id);
const rnd = id => db.rounds.find(r => r.id === id);
const activeRound = () => db.rounds.find(r => !r.finished);
const me = () => friend(db.settings.meId);
function holeRef(cid, sid, i) {
  const c = course(cid); if (!c) return null;
  const s = c.subs.find(x => x.id === sid); if (!s || !s.holes[i]) return null;
  return { c, s, H: s.holes[i], i, key: hk(cid, sid, i) };
}
function newHole(par) { return { par, hdcp: null, dist: {}, tee: null, path: null, green: null, greenPoly: null, hazards: [], elev: null }; }
function newSub(name) { return { id: uid(), name, holes: DEFAULT_PARS.map(newHole) }; }

// ---------- 사진 (IndexedDB) ----------
const IDB = {
  p: null,
  open() {
    if (this.p) return this.p;
    this.p = new Promise((res, rej) => {
      if (!('indexedDB' in window)) { rej(new Error('사진 저장을 지원하지 않는 브라우저예요')); return; }
      const q = indexedDB.open('sggolf', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('photos');
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
    return this.p;
  },
  async tx(mode, fn) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction('photos', mode), st = t.objectStore('photos');
      const r = fn(st); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error);
    });
  },
  put(id, blob) { return this.tx('readwrite', st => st.put(blob, id)); },
  get(id) { return this.tx('readonly', st => st.get(id)); },
  del(id) { return this.tx('readwrite', st => st.delete(id)); },
  keys() { return this.tx('readonly', st => st.getAllKeys()); },
  clear() { return this.tx('readwrite', st => st.clear()); },
};
async function compressImage(file, max = 1280) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('사진을 읽지 못했어요')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
  } finally { URL.revokeObjectURL(url); }
}

// ---------- 거리 단위 ----------
const unit = () => db.settings.unit;
const uLabel = () => unit() === 'yd' ? 'yd' : 'm';
const dfmt = m => m == null || isNaN(m) ? '–' : String(Math.round(unit() === 'yd' ? m * 1.09361 : m));
const toMeters = v => v == null || v === '' ? null : Math.round(unit() === 'yd' ? Number(v) / 1.09361 : Number(v));

// ---------- 좌표 계산 ----------
const RAD = Math.PI / 180;
function distM(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLng = (b.lng - a.lng) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
}
function bearing(a, b) {
  const y = Math.sin((b.lng - a.lng) * RAD) * Math.cos(b.lat * RAD);
  const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lng - a.lng) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
const angDiff = (a, b) => ((a - b + 540) % 360) - 180; // a가 b보다 오른쪽이면 +
function toXY(p, o) { return { x: (p.lng - o.lng) * 111320 * Math.cos(o.lat * RAD), y: (p.lat - o.lat) * 110574 }; }
function fromXY(v, o) { return { lat: o.lat + v.y / 110574, lng: o.lng + v.x / (111320 * Math.cos(o.lat * RAD)) }; }
function dest(a, brg, m) { return fromXY({ x: m * Math.sin(brg * RAD), y: m * Math.cos(brg * RAD) }, a); }
function centroidLL(pts) { return { lat: avg(pts.map(p => p.lat)), lng: avg(pts.map(p => p.lng)) }; }
function pathLen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += distM(p[i - 1], p[i]); return s; }
function pointAlong(path, d) {
  for (let i = 1; i < path.length; i++) {
    const seg = distM(path[i - 1], path[i]);
    if (d <= seg) return dest(path[i - 1], bearing(path[i - 1], path[i]), d);
    d -= seg;
  }
  const n = path.length;
  return dest(path[n - 1], bearing(path[n - 2], path[n - 1]), d);
}
function pointInPoly(pt, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (((a.lat > pt.lat) !== (b.lat > pt.lat)) && (pt.lng < (b.lng - a.lng) * (pt.lat - a.lat) / (b.lat - a.lat) + a.lng)) ins = !ins;
  }
  return ins;
}
function distToSeg(p, a, b) {
  const P = toXY(p, a), B = toXY(b, a);
  const L2 = B.x * B.x + B.y * B.y;
  const t = L2 ? clamp((P.x * B.x + P.y * B.y) / L2, 0, 1) : 0;
  return Math.hypot(P.x - t * B.x, P.y - t * B.y);
}
function distToPath(p, path) { let m = Infinity; for (let i = 1; i < path.length; i++) m = Math.min(m, distToSeg(p, path[i - 1], path[i])); return m; }
// 선분 위 가장 가까운 점까지 거리 (폴리곤 가장자리 포함)
function polyNearFar(P, poly) {
  let near = Infinity, far = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    near = Math.min(near, distToSeg(P, a, b));
    far = Math.max(far, distM(P, a));
  }
  if (n > 2 && pointInPoly(P, poly)) near = 0;
  return { near, far };
}

// ---------- 시트 · 토스트 · 공유 ----------
function openSheet(html) { const s = $('#sheet'); $('.sheet-panel', s).innerHTML = html; s.hidden = false; }
function closeSheet() { const s = $('#sheet'); if (s) s.hidden = true; state.confirmFn = null; if (typeof levelStop === 'function' && state.levelIn === 'sheet') levelStop(); }
function confirmSheet(msg, ok, fn, danger) {
  state.confirmFn = fn;
  openSheet(`<p>${msg}</p><div class="grid2"><button class="btn ghost" data-act="closeSheet">취소</button><button class="btn ${danger ? 'danger' : ''}" data-act="confirmOk">${ok}</button></div>`);
}
let toastT = null;
function toast(msg, ms = 2800) { const t = $('#toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }
function buzz() { if (db.settings.haptic && navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* 무시 */ } }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('복사했어요. 단톡방에 붙여넣으세요.'); return true; }
  catch (e) {
    openSheet(`<h2>아래 내용을 길게 눌러 복사하세요</h2><textarea class="inp" readonly style="min-height:220px">${esc(text)}</textarea><button class="btn" data-act="closeSheet">닫기</button>`);
    return false;
  }
}
function download(name, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
const blobToB64 = blob => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
async function b64ToBlob(b64, type) { const r = await fetch(`data:${type};base64,${b64}`); return r.blob(); }
async function shareFile(name, blob, text) {
  if (isNative()) {
    const P = window.Capacitor.Plugins || {};
    if (P.Filesystem && P.Share) {
      const w = await P.Filesystem.writeFile({ path: name, data: await blobToB64(blob), directory: 'CACHE' });
      await P.Share.share({ title: name, text, files: [w.uri] });
      return;
    }
  }
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name, text }); return; }
  download(name, blob);
}
async function shareTextOut(text) {
  try {
    const P = isNative() ? (window.Capacitor.Plugins || {}) : {};
    if (P.Share) { await P.Share.share({ text }); return; }
    if (navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  copyText(text);
}
function speak(text) {
  if (!('speechSynthesis' in window)) { toast('이 기기에서는 음성 안내를 쓸 수 없어요'); return; }
  const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = 1.02;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}

// ---------- 앱 상태 (저장하지 않는 화면 상태) ----------
const state = {
  draft: null, cardMode: 'gross', statsN: 10, shot: null, confirmFn: null, img: null,
  findQ: '', findView: 'list', courseTee: null, levelIn: null, green: {}, editTool: 'tee', editDraft: null,
  mapTarget: null, mapMode: 'measure', briefing: null,
};
