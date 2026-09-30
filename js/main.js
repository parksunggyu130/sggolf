'use strict';
/* 라우터 · 동작 · 입력 바인딩 · 시작 */

const route = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/');
const go = h => { if (location.hash === h) render(); else location.hash = h; };

function render() {
  destroyMap();
  if (state.levelIn !== 'sheet') levelStop();
  const [p, a, b, c] = route();
  let html;
  switch (p) {
    case 'home': html = vHome(); break;
    case 'find': html = vFind(); break;
    case 'osm': html = vOsmEntry(a); break;
    case 'courses': html = vCourses(); break;
    case 'course': html = vCourse(a); break;
    case 'hole': html = vHole(a, b, c); break;
    case 'edit': html = vEdit(a, b, c); break;
    case 'new': html = vNew(); break;
    case 'play': html = vPlay(a, b || 'hole'); break;
    case 'level': html = vLevel(); break;
    case 'history': html = vHistory(); break;
    case 'stats': html = vStats(); break;
    case 'clubs': html = vClubs(); break;
    case 'settings': html = vSettings(); break;
    case 'friends': html = vFriends(); break;
    case 'help': html = vHelp(a); break;
    default: html = vHome();
  }
  $('#app').innerHTML = html;
  renderTabs(p);
  afterRender(p, a, b, c);
}
function renderTabs(p) {
  const r = activeRound();
  const tabs = [
    ['home', '#/home', '홈', ICON.home],
    ['courses', '#/courses', '골프장', ICON.map],
    ['play', r ? `#/play/${r.id}/hole` : '#/new', r ? '진행 중' : '라운드', ICON.flag],
    ['history', '#/history', '기록', ICON.chart],
    ['settings', '#/settings', '설정', ICON.gear],
  ];
  const cur = { new: 'play', play: 'play', level: 'home', find: 'courses', osm: 'courses', course: 'courses', hole: 'courses', edit: 'courses', stats: 'history', clubs: 'history', friends: 'settings', help: 'settings' }[p] || p;
  $('#tabbar').innerHTML = `<div class="in">${tabs.map(([k, h, l, ic]) =>
    `<a href="${h}" class="${cur === k ? 'on' : ''} ${k === 'play' && r ? 'live' : ''}">${svg(ic)}<span>${l}</span></a>`).join('')}</div>`;
}
function afterRender(p, a, b, c) {
  gpsSync(); wakeSync();
  bindSwipe();
  if (p === 'play') {
    const r = rnd(a);
    if (r && b === 'gps') initRoundMap(r);
    renderGpsPanel();
    const cur = $('#holenav .cur'); if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  if (p === 'edit') { const co = course(a); if (co && co.subs[Number(b) || 0]) initEditMap(co, Number(b) || 0, Number(c) || 0); }
  if (p === 'find' && state.findView === 'map' && KR) {
    const q = state.findQ.trim().toLowerCase().replace(/\s+/g, '');
    initKRMap(KR.filter(e => !q || (e.n + (e.en || '') + (e.a || '')).toLowerCase().replace(/\s+/g, '').includes(q)));
  }
  if (p === 'osm' && KR) {
    const e = KR.find(x => x.i === a);
    if (e) makeMap('preview').then(m => { if (m) { m.setView([e.y, e.x], 15); L.circleMarker([e.y, e.x], { radius: 9, color: '#fff', weight: 2, fillColor: '#E2A516', fillOpacity: 1 }).addTo(m); } });
  }
  loadPhotos();
}

// 좌우로 밀어서 이전/다음 홀
function bindSwipe() {
  const el = $('#swipeArea'); if (!el) return;
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', e => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x0 == null) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
    if (Math.abs(dx) > 80 && Math.abs(dy) < 50) { const b = $(`[data-swipe="${dx < 0 ? 'next' : 'prev'}"]`); if (b && !b.disabled) b.click(); }
  }, { passive: true });
}

// 사진
const photoURL = {};
async function loadPhotos() {
  const imgs = $$('img[data-photo]'); if (!imgs.length) return;
  for (const img of imgs) {
    const id = img.dataset.photo;
    try {
      if (!photoURL[id]) { const b = await IDB.get(id); if (b) photoURL[id] = URL.createObjectURL(b); }
      if (photoURL[id]) img.src = photoURL[id];
    } catch (e) { /* 사진 없음 */ }
  }
}

// 화면 꺼짐 방지
let wl = null;
async function wakeSync() {
  const want = db.settings.wake && route()[0] === 'play' && !document.hidden && activeRound();
  try {
    if (want && !wl && 'wakeLock' in navigator) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); }
    else if (!want && wl) { await wl.release(); wl = null; }
  } catch (e) { wl = null; }
}

// ---------- 백업 ----------
async function backupJSON() {
  const photos = {};
  try { for (const k of await IDB.keys()) { const b = await IDB.get(k); if (b) photos[k] = await blobToB64(b); } } catch (e) { /* 사진 없음 */ }
  return JSON.stringify({ app: 'sggolf', ver: 2, exported: new Date().toISOString(), data: db, photos });
}
async function restoreFrom(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error('백업 파일 형식이 아니에요. SG골프에서 받은 파일인지 확인해주세요.'); }
  if (o && o.app === 'sggolf-course') { importCourseObj(o.course); return 'course'; }
  const d = o && o.app === 'sggolf' ? o.data : o;
  if (!d || !Array.isArray(d.rounds) || !Array.isArray(d.friends)) throw new Error('기록을 찾지 못했어요. SG골프 백업 파일인지 확인해주세요.');
  const base = defaults();
  db = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
  save();
  if (o.photos) { try { await IDB.clear(); for (const [k, v] of Object.entries(o.photos)) await IDB.put(k, await b64ToBlob(v, 'image/jpeg')); } catch (e) { toast('사진 일부를 복원하지 못했어요'); } }
  return 'all';
}
function importCourseObj(c) {
  if (!c || !Array.isArray(c.subs)) throw new Error('골프장 파일이 아니에요');
  const n = clone(c); n.id = uid(); n.created = Date.now();
  n.subs.forEach(s => { s.id = uid(); });
  db.courses.push(n); save();
  return n;
}

// ---------- 동작 ----------
const curRound = () => rnd(route()[1]);
const ACT = {
  go: d => go(d.h),
  closeSheet,
  closeRerender: () => { closeSheet(); render(); },
  confirmOk: () => { const f = state.confirmFn; closeSheet(); if (f) f(); },
  onboard: () => {
    const name = $('#onbName').value.trim(); if (!name) { toast('이름을 입력해주세요'); return; }
    const h = $('#onbHcp').value, dv = Number($('#onbDrv').value);
    const f = { id: uid(), name, hcp: h === '' ? 0 : Number(h), isMe: true };
    db.friends.unshift(f); db.settings.meId = f.id;
    if (dv > 80 && dv < 400) db.settings.driver = dv;
    save(); render();
  },
  // 골프장 찾기
  findView: d => { state.findView = d.v; render(); },
  importOsm: async (d, el) => {
    const e = (await loadKR()).find(x => x.i === d.id); if (!e) return;
    el.disabled = true; el.textContent = 'OpenStreetMap에서 도면을 받는 중…';
    try {
      const data = await fetchCourseOsm(e);
      const c = buildCourseFromOsm(e, data);
      db.courses.push(c); save();
      el.textContent = '고저차 계산 중…';
      try { await fillElevations(c); } catch (err) { /* 고도는 나중에 다시 받을 수 있어요 */ }
      const st = courseStatus(c);
      toast(st.full ? `${st.full}개 홀 도면을 채웠어요` : '골프장을 추가했어요. 편집기에서 홀을 그려주세요.', 3500);
      go(`#/course/${c.id}`);
    } catch (err) {
      el.disabled = false; el.textContent = '내 골프장에 추가하기';
      confirmSheet(`${esc(err.message)}<br><br>도면 없이 이름과 위치만으로 먼저 추가할까요? 나중에 "도면 다시 불러오기"를 누르면 돼요.`, '도면 없이 추가', () => {
        const c = { id: uid(), name: e.n, osm: e.i, addr: e.a || '', loc: { lat: e.y, lng: e.x }, subs: [newSub('OUT'), newSub('IN')], created: Date.now(), source: 'osm', spare: { greens: [], feats: [] } };
        db.courses.push(c); save(); go(`#/course/${c.id}`);
      });
    }
  },
  newCourseSheet: () => openSheet(`<h2>골프장 직접 만들기</h2>
    <label class="field"><span>골프장 이름</span><input class="inp" id="ncName" placeholder="예: 선셋힐 CC"></label>
    <div class="stack"><span class="small muted">9홀 코스 개수</span><div class="seg" id="ncN">${[1, 2, 3, 4].map(n => `<button class="${n === 2 ? 'on' : ''}" data-act="segPick" data-v="${n}">${n * 9}홀</button>`).join('')}</div></div>
    <label class="row"><span class="small">지금 내 위치를 골프장 위치로 쓰기<br><small class="muted">골프장에 있거나 가까이 있을 때</small></span><span class="switch"><input type="checkbox" id="ncHere"><i></i></span></label>
    <p class="small muted">파는 기본값(9홀 파36)으로 만들어요. 다음 화면의 편집기에서 위성 사진을 보며 티와 그린을 찍어주세요. 위치를 모르면 편집기에서 지도를 움직여 찾으면 돼요.</p>
    <div class="grid2"><button class="btn ghost" data-act="closeSheet">취소</button><button class="btn" data-act="ncSave">만들기</button></div>`),
  segPick: (d, el) => { [...el.parentNode.children].forEach(b => b.classList.toggle('on', b === el)); },
  ncSave: async () => {
    const name = $('#ncName').value.trim(); if (!name) { toast('골프장 이름을 입력해주세요'); return; }
    const n = Number($('#ncN .on')?.dataset.v || 2), here = $('#ncHere').checked;
    const names = n === 1 ? ['9홀'] : n === 2 ? ['OUT', 'IN'] : ['A', 'B', 'C', 'D'].slice(0, n);
    const c = { id: uid(), name, osm: null, addr: '', loc: null, subs: names.map(newSub), created: Date.now(), source: 'user', spare: { greens: [], feats: [] } };
    if (here) { try { c.loc = { ...(await gpsOnce()) }; } catch (e) { toast(e.message); } }
    db.courses.push(c); save(); closeSheet(); go(`#/edit/${c.id}/0/0`);
  },
  fav: d => { const i = db.favs.indexOf(d.id); if (i >= 0) db.favs.splice(i, 1); else db.favs.push(d.id); save(); render(); },
  roundFromCourse: d => { state.draft = newDraft(d.id); go('#/new'); },
  courseTee: d => { state.courseTee = d.v; render(); },
  subAdd: d => { const c = course(d.id); c.subs.push(newSub(['A', 'B', 'C', 'D', 'E'][c.subs.length] || '코스')); save(); render(); },
  subDel: d => confirmSheet('이 9홀 코스를 지울까요? 도면과 노트 연결도 사라져요.', '삭제', () => { course(d.id).subs.splice(Number(d.si), 1); save(); render(); }, true),
  courseDel: d => confirmSheet('이 골프장을 지울까요? 지난 라운드 기록은 남아요.', '삭제', () => { db.courses = db.courses.filter(c => c.id !== d.id); db.favs = db.favs.filter(x => x !== d.id); save(); go('#/courses'); }, true),
  offline: async (d, el) => {
    const c = course(d.id); el.disabled = true;
    try { const n = await saveOffline(c, (a, b) => { el.textContent = `저장 중… ${Math.round(a / b * 100)}%`; }); toast(`지도 ${n}장을 저장했어요. 신호가 약해도 보여요.`); render(); }
    catch (e) { el.disabled = false; el.textContent = '오프라인 지도 저장'; toast(e.message, 4500); }
  },
  elevRefresh: async d => { toast('고저차를 받는 중이에요…'); try { const n = await fillElevations(course(d.id), true); toast(n ? `${n}개 홀 고저차를 받았어요` : '도면이 있는 홀이 없어요'); render(); } catch (e) { toast(e.message); } },
  osmReload: d => confirmSheet('OpenStreetMap 도면으로 다시 채울까요? 편집기에서 직접 고친 홀 도면은 덮어써져요. 노트와 기록은 그대로예요.', '다시 불러오기', async () => {
    const c = course(d.id), e = (await loadKR()).find(x => x.i === c.osm); if (!e) { toast('목록에서 이 골프장을 찾지 못했어요'); return; }
    toast('도면을 받는 중이에요…');
    try {
      const n = buildCourseFromOsm(e, await fetchCourseOsm(e));
      n.subs.forEach((s, i) => { if (c.subs[i]) s.id = c.subs[i].id; });
      c.subs = n.subs; c.spare = n.spare; save();
      try { await fillElevations(c, true); } catch (err) { /* 무시 */ }
      toast(`도면 ${courseStatus(c).full}홀을 채웠어요`); render();
    } catch (err) { toast(err.message); }
  }),
  exportCourse: async d => {
    const c = course(d.id);
    const blob = new Blob([JSON.stringify({ app: 'sggolf-course', ver: 2, course: c })], { type: 'application/json' });
    try { await shareFile(`${c.name}_도면.json`, blob, `${c.name} 코스 도면 (SG골프)`); } catch (e) { if (!e || e.name !== 'AbortError') toast('내보내지 못했어요'); }
  },
  // 편집기
  editTool: d => { state.editTool = d.v; state.editDraft = null; $$('.tools .chip').forEach(b => b.classList.toggle('on', b.dataset.v === d.v)); drawEditMap(); },
  editDone: () => editFinishShape(),
  editCancel: () => { state.editDraft = null; drawEditMap(); },
  editUndo: () => {
    if (state.editDraft && state.editDraft.pts.length) { state.editDraft.pts.pop(); drawEditMap(); return; }
    const u = (state.editUndo || []).pop(); if (!u || !M.ctx) { toast('되돌릴 게 없어요'); return; }
    const { c, si, hi } = M.ctx; c.subs[si].holes[hi] = JSON.parse(u); save(); drawEditMap();
  },
  editPar: d => { const [, cid, si, hi] = route(); const c = course(cid); c.subs[Number(si)].holes[Number(hi)].par = Number(d.v); save(); $$('[data-act="editPar"]').forEach(b => b.classList.toggle('on', b.dataset.v === d.v)); },
  mapMe: async () => {
    if (!db.settings.gps) { db.settings.gps = true; save(); gpsSync(); }
    try { const p = await gpsOnce(); if (M.map) M.map.setView(llA(p), 17); drawMe(); } catch (e) { toast(e.message); }
  },
  // 동반자
  friendSheet: d => {
    state.friendFrom = d.from || null;
    openSheet(`<h2>동반자 추가</h2>
      <label class="field"><span>이름</span><input class="inp" id="frName"></label>
      <label class="field"><span>핸디캡 (선택)</span><input class="inp num" id="frHcp" type="number" inputmode="decimal"></label>
      <div class="grid2"><button class="btn ghost" data-act="closeSheet">취소</button><button class="btn" data-act="friendSave">추가</button></div>`);
  },
  friendSave: () => {
    const name = $('#frName').value.trim(); if (!name) { toast('이름을 입력해주세요'); return; }
    const h = $('#frHcp').value, f = { id: uid(), name, hcp: h === '' ? 0 : Number(h) };
    db.friends.push(f);
    if (state.friendFrom === 'draft' && state.draft && state.draft.players.length < 4) state.draft.players.push(f.id);
    save(); closeSheet(); render();
  },
  friendDel: d => confirmSheet('이 동반자를 목록에서 지울까요? 지난 라운드 기록은 남아요.', '지우기', () => { db.friends = db.friends.filter(f => f.id !== d.id); save(); render(); }, true),
  // 라운드 준비
  draftCourse: d => { const s = state.draft, c = course(d.id); s.courseId = d.id; s.front = 0; s.back = c.subs.length > 1 ? 1 : -1; render(); },
  draftSet: d => { const s = state.draft; s[d.k] = d.k === 'tee' ? d.v : Number(d.v); const n = course(s.courseId).subs.length; if (d.k === 'front' && s.back === s.front && n > 1) s.back = (s.front + 1) % n; render(); },
  draftAdd: d => { if (state.draft.players.length < 4) state.draft.players.push(d.id); render(); },
  draftRemove: d => { state.draft.players = state.draft.players.filter(x => x !== d.id); render(); },
  vegasPartner: d => {
    if (d.root === 'draft') { state.draft.partner = d.id; render(); return; }
    const r = rnd(d.root.split(':')[1]); const a = [r.players[0].id, d.id];
    r.vegas = { a, b: r.players.map(p => p.id).filter(x => !a.includes(x)) }; save(); ACT.betSheet({ id: r.id });
  },
  startRound: () => {
    const d = state.draft; if (!course(d.courseId)) { toast('골프장을 골라주세요'); return; }
    const start = () => {
      db.rounds.filter(r => !r.finished).forEach(r => { r.finished = true; r.endedAt = Date.now(); });
      const r = makeRound(d); db.rounds.push(r); db.lastBets = clone(d.bets); state.draft = null; state.wx = null; save();
      go(`#/play/${r.id}/hole`);
    };
    if (activeRound()) confirmSheet(`진행 중인 라운드(${esc(activeRound().courseName)})가 있어요. 새로 시작하면 그 라운드는 지금 상태로 완료 처리돼요.`, '새로 시작', start);
    else start();
  },
  // 홀 입력
  hole: d => { const r = curRound(), i = Number(d.i); if (i < 0 || i >= r.holes.length) return; r.cur = i; state.mapTarget = null; state.autoFrom = null; save(); render(); window.scrollTo(0, 0); },
  st: d => {
    const r = curRound(), h = r.cur, par = r.holes[h].par, e = entry(r, d.pid, h), k = Number(d.d);
    if (e.s == null) e.s = clamp(par + k, 1, 20); else if (k === 0) return; else e.s = clamp(e.s + k, 1, 20);
    if (e.p != null && e.p > e.s) e.p = e.s;
    buzz(); save(); render();
  },
  pt: d => { const r = curRound(), e = entry(r, d.pid, r.cur), v = Number(d.v); e.p = e.p === v ? null : v; buzz(); save(); render(); },
  fw: d => { const r = curRound(), e = entry(r, d.pid, r.cur); e.fw = e.fw === d.v ? null : d.v; buzz(); save(); render(); },
  bk: d => { const r = curRound(), e = entry(r, d.pid, r.cur); e.bk = !e.bk; buzz(); save(); render(); },
  pen: d => { const r = curRound(), e = entry(r, d.pid, r.cur); e.pen = (e.pen || 0) + 1; buzz(); save(); render(); },
  penDown: d => { const r = curRound(), e = entry(r, d.pid, r.cur); e.pen = Math.max(0, (e.pen || 0) - 1); save(); render(); },
  clearScore: d => { const r = curRound(); r.scores[d.pid][r.cur] = null; save(); render(); },
  special: d => { const r = curRound(); const sp = (r.special ||= {})[r.cur] ||= {}; sp[d.k] = sp[d.k] === d.pid ? null : d.pid; save(); render(); },
  toggleMult: () => {
    const r = curRound(), h = r.cur, res = computeBets(r);
    const t = clone(r); t.mults = {}; const autoOn = computeBets(t).mult[h] > 1;
    const want = res.mult[h] <= 1; r.mults ||= {};
    if (want === autoOn) delete r.mults[h]; else r.mults[h] = want;
    save(); render();
  },
  holeEdit: () => {
    const r = curRound(), X = r.holes[r.cur];
    openSheet(`<h2>${esc(X.sub)} ${X.no}번 홀 정보</h2>
      <div class="stack"><span class="small muted">파</span><div class="seg" id="hePar">${[3, 4, 5, 6].map(p => `<button class="${X.par === p ? 'on' : ''}" data-act="segPick" data-v="${p}">${p}</button>`).join('')}</div></div>
      <div class="grid2"><label class="field"><span>핸디캡 (1~18)</span><input class="inp num" id="heHdcp" type="number" inputmode="numeric" value="${X.hdcp ?? ''}"></label>
      <label class="field"><span>거리 (${uLabel()})</span><input class="inp num" id="heDist" type="number" inputmode="numeric" value="${X.dist != null ? dfmt(X.dist) : ''}"></label></div>
      <p class="small muted">저장하면 골프장 정보에도 반영돼요.</p>
      <div class="grid2"><button class="btn ghost" data-act="closeSheet">취소</button><button class="btn" data-act="holeEditSave">저장</button></div>`);
  },
  holeEditSave: () => {
    const r = curRound(), X = r.holes[r.cur];
    X.par = Number($('#hePar .on').dataset.v);
    const hd = $('#heHdcp').value; X.hdcp = hd === '' ? null : clamp(Number(hd), 1, 18);
    X.dist = toMeters($('#heDist').value);
    const ref = roundHoleRef(r, r.cur);
    if (ref) { ref.H.par = X.par; ref.H.hdcp = X.hdcp; if (X.dist) (ref.H.dist ||= {})[r.tee] = X.dist; }
    save(); closeSheet(); render();
  },
  finish: d => {
    const r = rnd(d.id);
    const missing = r.holes.filter((_, h) => r.players.some(p => S(r, p.id, h) == null)).map(X => X.no);
    confirmSheet(missing.length ? `아직 입력 안 된 홀이 있어요: ${missing.join(', ')}번. 그래도 끝낼까요? 나중에 기록에서 고칠 수 있어요.` : '라운드를 끝내고 정산을 볼까요?', '라운드 종료', () => {
      r.finished = true; r.endedAt = Date.now(); state.shot = null; save(); go(`#/play/${r.id}/settle`);
    });
  },
  roundMenu: d => {
    const r = rnd(d.id);
    openSheet(`<h2>${esc(r.courseName)}</h2><div class="stack">
      <button class="btn ghost" data-act="betSheet" data-id="${r.id}">내기 규칙 수정</button>
      <button class="btn ghost" data-act="playersSheet" data-id="${r.id}">플레이어 핸디캡 수정</button>
      ${r.finished ? `<button class="btn ghost" data-act="reopen" data-id="${r.id}">라운드 다시 열기</button>` : `<button class="btn flag" data-act="finish" data-id="${r.id}">라운드 종료</button>`}
      <button class="btn danger" data-act="roundDel" data-id="${r.id}">라운드 삭제</button>
      <button class="btn line" data-act="closeSheet">닫기</button></div>`);
  },
  playersSheet: d => {
    const r = rnd(d.id);
    openSheet(`<h2>핸디캡 수정</h2><div class="stack" data-root="round:${r.id}">${r.players.map((p, i) => `<label class="row"><span>${esc(p.name)}</span>
      <input class="inp sm num" style="width:80px;text-align:right" type="number" inputmode="decimal" data-bind="players.${i}.hcp" data-type="num" value="${p.hcp ?? 0}"></label>`).join('')}</div>
      <p class="small muted">이 라운드에만 적용돼요.</p><button class="btn" data-act="closeRerender">완료</button>`);
  },
  betSheet: d => {
    const r = rnd(d.id); r.bets = { ...defaultBets(), ...(r.bets || {}) };
    openSheet(`<h2>내기 규칙</h2><div data-root="round:${r.id}" data-sheet="bet">${betForm(r.bets, `round:${r.id}`, r.players)}</div>
      ${r.bets.vegas.on ? vegasPicker(r.players, r.vegas ? r.vegas.a[1] : null, `round:${r.id}`) : ''}
      <button class="btn" data-act="closeRerender">완료</button>`);
  },
  reopen: d => { const r = rnd(d.id); db.rounds.filter(x => !x.finished && x.id !== r.id).forEach(x => { x.finished = true; }); r.finished = false; save(); closeSheet(); go(`#/play/${r.id}/hole`); },
  roundDel: d => confirmSheet('이 라운드를 완전히 지울까요? 되돌릴 수 없어요.', '삭제', () => { db.rounds = db.rounds.filter(r => r.id !== d.id); save(); go('#/history'); }, true),
  cardMode: d => { state.cardMode = d.v; render(); },
  cardCell: d => { const r = curRound(); r.cur = Number(d.i); save(); go(`#/play/${r.id}/hole`); },
  shareImg: d => {
    const r = rnd(d.id), c = cardCanvas(r);
    c.toBlob(b => {
      state.img = b;
      openSheet(`<h2>스코어카드 이미지</h2><img class="shareimg" alt="스코어카드" src="${c.toDataURL('image/png')}">
        <div class="grid2"><button class="btn ghost" data-act="closeSheet">닫기</button><button class="btn" data-act="shareImgGo" data-id="${r.id}">공유 · 저장</button></div>`);
    }, 'image/png');
  },
  shareImgGo: async d => {
    const r = rnd(d.id);
    try { await shareFile(`스코어카드_${r.date}.png`, state.img, `${r.courseName} ${fmtDate(r.date)}`); }
    catch (e) { if (e && e.name !== 'AbortError') toast('공유하지 못했어요. 이미지를 길게 눌러 저장해주세요.'); }
  },
  shareText: d => shareTextOut(settleText(rnd(d.id))),
  copySettle: d => copyText(settleText(rnd(d.id))),
  // GPS · 샷
  gpsOn: () => { db.settings.gps = true; save(); render(); },
  greenHere: async () => {
    const r = curRound(), ref = roundHoleRef(r, r.cur); if (!ref) return;
    try { const p = await gpsOnce(); ref.H.green = { ...p }; if (ref.H.greenPoly && !pointInPoly(p, ref.H.greenPoly)) ref.H.greenPoly = null; if (!ref.c.loc) ref.c.loc = { ...p }; save(); toast(`그린 위치를 저장했어요 (±${G.acc}m)`); render(); }
    catch (e) { toast(e.message); }
  },
  shotStart: () => openSheet(`<h2>어떤 클럽으로 치나요?</h2><p class="small muted">친 자리에서 고르세요. 공 있는 곳에 가서 "샷 도착"을 누르면 거리가 저장돼요.</p>
    <div class="chips">${CLUBS.map(c => `<button class="chip" data-act="shotGo" data-club="${c}">${c}</button>`).join('')}</div>
    <button class="btn ghost" data-act="shotGo" data-club="">클럽은 나중에 고르기</button>`),
  shotGo: async d => {
    closeSheet();
    try {
      const p = await gpsOnce(), r = curRound();
      state.shot = { start: { ...p }, club: d.club || null, h: r ? r.cur : null, acc: G.acc };
      toast(`친 자리를 기록했어요 (±${G.acc}m). 공 앞에서 "샷 도착"을 누르세요.`); render();
    } catch (e) { toast(e.message); }
  },
  shotEnd: async () => {
    if (!state.shot) return;
    let p; try { p = await gpsOnce(); } catch (e) { toast(e.message); return; }
    const sh = state.shot, dist = Math.round(distM(sh.start, p));
    const r = curRound(), ref = r && sh.h != null ? roundHoleRef(r, sh.h) : null;
    let lat = null, res = null;
    if (ref) {
      const g = holeGeo(ref.H);
      const aim = g.path && g.tee && distM(sh.start, g.tee) < 40 ? g.path[1] : g.green;
      if (aim) {
        lat = dist * Math.sin(angDiff(bearing(sh.start, p), bearing(sh.start, aim)) * RAD);
        const fair = (ref.H.hazards || []).filter(z => z.t === 'fairway');
        if (g.tee && distM(sh.start, g.tee) < 40 && ref.H.par > 3) res = fair.some(z => pointInPoly(p, z.p)) ? 'C' : Math.abs(lat) < 12 && !fair.length ? 'C' : lat < 0 ? 'L' : 'R';
      }
    }
    state.shotEnd = { e: { ...p }, d: dist, lat, res };
    openSheet(`<h2>샷 거리 <span class="num" style="color:var(--green-2)">${dfmt(dist)}${uLabel()}</span></h2>
      <p class="small muted">오차는 약 ±${Math.round(((sh.acc || 5) + (G.acc || 5)) / 1.5)}m예요.${lat != null ? ` 목표선에서 ${Math.abs(lat) < 2 ? '거의 정면' : `${lat > 0 ? '오른쪽' : '왼쪽'}으로 ${Math.round(Math.abs(lat))}m`}.` : ''}</p>
      ${res ? `<div class="stack"><span class="small muted">티샷 결과 (자동 판정, 바꿀 수 있어요)</span><div class="seg" id="shotRes">${[['L', '왼쪽'], ['C', '페어웨이'], ['R', '오른쪽']].map(([k, l]) => `<button class="${res === k ? 'on' : ''}" data-act="segPick" data-v="${k}">${l}</button>`).join('')}</div></div>` : ''}
      <span class="small muted">클럽</span>
      <div class="chips">${CLUBS.map(c => `<button class="chip ${sh.club === c ? 'on' : ''}" data-act="shotSave" data-club="${c}">${c}</button>`).join('')}</div>
      <button class="btn ghost" data-act="shotCancel">저장 안 함</button>`);
  },
  shotSave: d => {
    const sh = state.shot, en = state.shotEnd, r = curRound();
    const res = $('#shotRes .on') ? $('#shotRes .on').dataset.v : en.res;
    const ref = r && sh.h != null ? roundHoleRef(r, sh.h) : null;
    db.shots.push({ id: uid(), club: d.club, d: en.d, s: sh.start, e: en.e, lat: en.lat, res, date: today(), rid: r ? r.id : null, key: ref ? ref.key : null });
    if (r && res && db.settings.meId && r.scores[db.settings.meId] && sh.h != null) entry(r, db.settings.meId, sh.h).fw = res;
    state.shot = null; state.shotEnd = null; save(); closeSheet();
    toast(`${d.club} ${dfmt(en.d)}${uLabel()} 저장했어요`); render();
  },
  shotCancel: () => { state.shot = null; state.shotEnd = null; closeSheet(); render(); },
  shotAdd: () => { const v = toMeters($('#shotD').value); if (!v || v <= 0) { toast('거리를 입력해주세요'); return; } db.shots.push({ id: uid(), club: $('#shotClub').value, d: v, date: today() }); save(); render(); },
  shotDel: d => { db.shots = db.shots.filter(s => s.id !== d.id); save(); render(); },
  clubSel: d => { state.clubSel = d.v; render(); },
  mapPin: () => { state.mapMode = state.mapMode === 'pin' ? 'measure' : 'pin'; render(); },
  mapClear: () => { state.mapTarget = null; drawRoundMap(); renderGpsPanel(); },
  speak: () => { if (state.say) speak(state.say); },
  // 그린
  greenMode: d => { const [, rid] = route(); const r = rnd(rid), ref = r && roundHoleRef(r, r.cur); const gs = state.green[ref ? ref.key : 'free']; gs.mode = d.v; render(); },
  greenTap: (d, el, ev) => {
    const ll = svgPointLL(el, ev);
    const [p, rid] = route(), r = p === 'play' ? rnd(rid) : null, ref = r && roundHoleRef(r, r.cur);
    const gs = state.green[ref ? ref.key : 'free'];
    if (gs.mode === 'pin' && r) { (r.pins ||= {})[r.cur] = ll; save(); } else { gs.ball = ll; gs.read = null; }
    render();
  },
  steps: d => { const [p, rid] = route(), r = p === 'play' ? rnd(rid) : null, ref = r && roundHoleRef(r, r.cur); const gs = state.green[ref ? ref.key : 'free']; gs.steps = Math.max(0, (gs.steps || 0) + Number(d.d)) || null; render(); },
  levelOpen: d => levelSheet(d.key),
  levelRead: d => {
    const v = levelNow(); if (!v) { toast('센서 값이 아직 없어요. 잠시 기다려주세요.'); return; }
    levelStop(); state.levelIn = null;
    const key = d.key, gs = state.green[key];
    const [, rid] = route(), r = rnd(rid), ref = r && roundHoleRef(r, r.cur);
    const pin = r ? ((r.pins || {})[r.cur] || (ref && holeGeo(ref.H).green)) : null;
    const pr = puttRead(v.b, v.g);
    let dir = null;
    if (gs.ball && pin) dir = (bearing(gs.ball, pin) + Math.atan2(pr.side, -pr.along) / RAD + 360) % 360;
    gs.read = { b: v.b, g: v.g, pct: pr.total, dir };
    if (key !== 'free' && gs.ball && dir != null) (db.reads[key] ||= []).push({ ball: gs.ball, dir, pct: round1(pr.total), date: today() });
    save(); closeSheet(); render();
  },
  calibrate: () => levelSheet(null, 1),
  calibStep: d => {
    const v = levelNow(true); if (!v) { toast('센서 값이 아직 없어요'); return; }
    if (d.step === '1') { state.calA = v; levelSheet(null, 2); return; }
    const A = state.calA;
    db.settings.lvl = { b: (A.b + v.b) / 2, g: (A.g + v.g) / 2 }; save();
    levelStop(); state.levelIn = null; closeSheet();
    toast(`보정했어요 (앞뒤 ${db.settings.lvl.b.toFixed(2)}°, 좌우 ${db.settings.lvl.g.toFixed(2)}°)`);
  },
  // 사진
  photoView: d => openSheet(`<img class="shareimg" alt="홀 사진" src="${photoURL[d.id] || ''}"><div class="grid2"><button class="btn ghost" data-act="closeSheet">닫기</button><button class="btn danger" data-act="photoDel" data-id="${d.id}" data-key="${d.key}">사진 삭제</button></div>`),
  photoDel: async d => { const n = db.notes[d.key]; if (n) n.photos = (n.photos || []).filter(x => x !== d.id); save(); try { await IDB.del(d.id); } catch (e) { /* 무시 */ } closeSheet(); render(); },
  // 통계 · 설정
  statsN: d => { state.statsN = Number(d.v); render(); },
  setSetting: d => { db.settings[d.k] = d.v; save(); applySettings(); render(); },
  exportData: async () => {
    toast('백업 파일을 만드는 중이에요…');
    const json = await backupJSON(), name = `sggolf-backup-${today()}.json`;
    try { await shareFile(name, new Blob([json], { type: 'application/json' }), 'SG골프 백업'); toast('백업 파일을 만들었어요'); }
    catch (e) { if (!e || e.name !== 'AbortError') copyText(json); }
  },
  importSheet: () => openSheet(`<h2>복원 · 불러오기</h2><p class="small muted">전체 백업 파일은 지금 기록을 백업 내용으로 바꿔요. 골프장 도면 파일은 내 골프장에 추가만 해요.</p>
    <label class="btn ghost" style="position:relative">파일 고르기<input type="file" id="impFile" accept=".json,application/json" style="position:absolute;inset:0;opacity:0"></label>
    <textarea class="inp" id="impText" placeholder="또는 내용을 여기에 붙여넣으세요"></textarea>
    <div class="grid2"><button class="btn ghost" data-act="closeSheet">취소</button><button class="btn" data-act="importGo">불러오기</button></div>`),
  importGo: async () => {
    const t = $('#impText').value.trim(); if (!t) { toast('파일을 고르거나 내용을 붙여넣어주세요'); return; }
    try { const k = await restoreFrom(t); closeSheet(); applySettings(); toast(k === 'course' ? '골프장 도면을 추가했어요' : '복원했어요'); go(k === 'course' ? '#/courses' : '#/home'); }
    catch (e) { toast(e.message); }
  },
  wipe: () => confirmSheet('모든 라운드, 골프장, 노트, 사진을 지울까요? 되돌릴 수 없어요. 먼저 백업을 받아두세요.', '모두 삭제', async () => {
    db = defaults(); save(); state.draft = null; try { await IDB.clear(); } catch (e) { /* 무시 */ } applySettings(); go('#/home');
  }, true),
};

// ---------- 입력 바인딩 ----------
function bindRoot(el) {
  const r = el.closest('[data-root]'); if (!r) return null;
  const [k, id] = r.dataset.root.split(':');
  return { draft: state.draft, round: rnd(id), settings: db.settings, course: course(id), friend: friend(id) }[k] || null;
}
function setPath(o, path, v) { const ks = path.split('.'); let t = o; for (let i = 0; i < ks.length - 1; i++) t = t[ks[i]] ??= {}; t[ks[ks.length - 1]] = v; }
function onBind(el, final) {
  const root = bindRoot(el); if (!root) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.type === 'num') v = v === '' ? null : Number(v);
  setPath(root, el.dataset.bind, v);
  save();
  if (root === db.settings) applySettings();
  if (final && el.hasAttribute('data-rerender')) {
    const sheet = el.closest('[data-sheet="bet"]');
    if (sheet) ACT.betSheet({ id: sheet.dataset.root.split(':')[1] });
    else { const y = window.scrollY; render(); window.scrollTo(0, y); }
  }
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
  const fn = ACT[t.dataset.act]; if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(t.dataset, t, e)).catch(err => { console.error(err); toast('문제가 생겼어요: ' + (err.message || err)); });
});
let findT = null;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'findQ') {
    state.findQ = el.value; clearTimeout(findT);
    findT = setTimeout(() => { const pos = el.selectionStart; render(); const n = $('#findQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250);
    return;
  }
  if (el.dataset && el.dataset.note) {
    const n = db.notes[el.dataset.note] ||= { text: '', photos: [] };
    n.text = el.value; n.updated = today(); save(); return;
  }
  if (el.dataset && el.dataset.bind && el.type !== 'checkbox') onBind(el, false);
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset && el.dataset.bind) { onBind(el, true); return; }
  if (el.dataset && el.dataset.dist) {
    const c = course(route()[1]); const [si, i] = el.dataset.dist.split('.').map(Number);
    (c.subs[si].holes[i].dist ||= {})[state.courseTee || 'white'] = toMeters(el.value); save(); return;
  }
  if (el.dataset && el.dataset.photoAdd && el.files[0]) {
    const key = el.dataset.photoAdd;
    try {
      toast('사진을 저장하는 중이에요…');
      const blob = await compressImage(el.files[0]), id = uid();
      await IDB.put(id, blob);
      const n = db.notes[key] ||= { text: '', photos: [] }; (n.photos ||= []).push(id); n.updated = today(); save(); render();
    } catch (err) { toast(err.message || '사진을 저장하지 못했어요'); }
    return;
  }
  if (el.id === 'impFile' && el.files[0]) {
    const fr = new FileReader(); fr.onload = () => { $('#impText').value = fr.result; toast('파일을 읽었어요. "불러오기"를 누르세요.'); }; fr.readAsText(el.files[0]);
  }
});

// ---------- 시작 ----------
function applySettings() {
  const root = document.documentElement, s = db.settings;
  if (s.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', s.theme);
  root.classList.toggle('big', !!s.big);
  gpsSync(); wakeSync();
}
function boot() {
  applySettings();
  window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });
  document.addEventListener('visibilitychange', () => { wakeSync(); if (document.hidden) gpsStop(); else gpsSync(); });
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol === 'https:' && !isNative()) navigator.serviceWorker.register('sw.js').catch(() => {});
  loadKR().catch(() => {});
  render();
}
boot();
