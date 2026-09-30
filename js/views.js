'use strict';
/* 화면: 홈 · 골프장 찾기 · 골프장 · 홀 공략 · 편집기 · 기록 · 통계 · 클럽 · 설정 · 사용법 */

const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  flag: '<path d="M6 21V3"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/>',
  chart: '<path d="M3 21h18"/><path d="M6 17v-6M11 17V5M16 17v-9M21 17v-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  menu: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  pin: '<path d="M12 22s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><circle cx="12" cy="17" r=".6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  level: '<rect x="3" y="8" width="18" height="8" rx="4"/><circle cx="12" cy="12" r="2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
};
const svg = (p, s = 22) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const helpBtn = id => `<a class="btn ghost sm icon" href="#/help/${id}" aria-label="사용법">${svg(ICON.help, 18)}</a>`;
const bar = (title, sub = '', right = '', back = '', help = '') => `<header class="appbar">
  ${back ? `<a href="${back}" class="btn ghost sm icon" aria-label="뒤로">${svg(ICON.back, 18)}</a>` : ''}
  <div class="ttl"><h1>${esc(title)}</h1>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${right}${help ? helpBtn(help) : ''}</header>`;
const sw = (path, on, rerender = true) => `<span class="switch"><input type="checkbox" data-bind="${path}" ${rerender ? 'data-rerender' : ''} ${on ? 'checked' : ''}><i></i></span>`;
const toggleRow = (label, desc, path, on) => `<label class="row"><span>${label}${desc ? `<br><small class="muted">${desc}</small>` : ''}</span>${sw(path, on)}</label>`;
const numRow = (label, path, v, step = 1000, w = 130, desc = '') => `<label class="row"><span class="small">${label}${desc ? `<br><small class="muted">${desc}</small>` : ''}</span><input class="inp sm num" style="width:${w}px;text-align:right" type="number" inputmode="decimal" min="0" step="${step}" data-bind="${path}" data-type="num" value="${v ?? ''}"></label>`;
const roundHoleRef = (r, h) => { const X = r.holes[h]; return X ? holeRef(r.courseId, X.subId, X.idx) : null; };
function courseHoleList(c) { const out = []; c.subs.forEach((s, si) => s.holes.forEach((H, i) => out.push({ si, i, s, H }))); return out; }

// ---------- 홈 ----------
function vHome() {
  if (!me()) return vOnboard();
  const r = activeRound();
  const st = computeStats(myRounds(), me().id);
  const favs = db.favs.map(course).filter(Boolean);
  const list = myRounds(3);
  const mine = db.courses.filter(c => !db.favs.includes(c.id)).slice(0, 4);
  return bar(`${me().name}님의 공략북`, fmtDateLong(today()), '', '', 'start') + `<div class="page">
    ${r ? `<div class="card hero stack">
      <div class="row"><small class="muted">진행 중 · ${esc(r.courseName)}</small><small class="muted">${r.holes[r.cur].no}번 홀</small></div>
      <div class="row"><span class="big">${(() => { const t = tot(r, r.scores[me().id] ? me().id : r.players[0].id); return t.n ? tp(t.tp) : '-'; })()}</span><span>${r.holes.length}홀 라운드</span></div>
      <a class="btn flag block" href="#/play/${r.id}/hole">이어서 기록</a></div>` : ''}
    <div class="grid2">
      <a class="tile" href="#/find">${svg(ICON.search, 26)}<b>골프장 찾기</b><small>전국 ${KR ? KR.length : '480여'}곳</small></a>
      <a class="tile" href="${r ? `#/play/${r.id}/hole` : '#/new'}">${svg(ICON.flag, 26)}<b>${r ? '라운드 계속' : '라운드 시작'}</b><small>스코어 · GPS · 정산</small></a>
      <a class="tile" href="#/level">${svg(ICON.level, 26)}<b>그린 경사 측정</b><small>폰을 그린에 내려놓기</small></a>
      <a class="tile" href="#/help">${svg(ICON.help, 26)}<b>사용법</b><small>기능별 자세한 안내</small></a>
    </div>
    ${favs.length || mine.length ? `<div class="card"><div class="row"><h3>내 골프장</h3><a class="small muted" href="#/courses">전체 ›</a></div>
      <div class="list">${[...favs, ...mine].slice(0, 6).map(courseLi).join('')}</div></div>` : `<div class="card stack">
      <h3>먼저 자주 가는 골프장을 추가해보세요</h3><p class="small muted">골프장을 추가하면 홀 도면, 자동 공략, GPS 거리를 쓸 수 있어요.</p>
      <a class="btn" href="#/find">골프장 찾기</a></div>`}
    <div class="grid3">
      <div class="stat"><small>평균 (18홀)</small><div class="big num">${st.avg != null ? st.avg.toFixed(1) : '–'}</div></div>
      <div class="stat"><small>베스트</small><div class="big num">${st.best ?? '–'}</div></div>
      <div class="stat"><small>드라이버</small><div class="big num">${dfmt(clubAvg('드라이버'))}</div></div>
    </div>
    ${list.length ? `<div class="card"><div class="row"><h3>최근 라운드</h3><a href="#/history" class="small muted">전체 ›</a></div><div class="list">${list.map(roundLi).join('')}</div></div>` : ''}
  </div>`;
}
function courseLi(c) {
  const st = courseStatus(c), fav = db.favs.includes(c.id);
  return `<a class="li" href="#/course/${c.id}"><span><b>${fav ? '★ ' : ''}${esc(c.name)}</b><br><small class="muted">${c.subs.map(s => esc(s.name)).join(' · ')} · ${st.n}홀${c.addr ? ' · ' + esc(c.addr) : ''}</small></span>
    <span class="small ${st.full === st.n ? 'pos' : 'muted'}">도면 ${st.full}/${st.n} ›</span></a>`;
}
function roundLi(r) {
  const id = r.scores[db.settings.meId] ? db.settings.meId : r.players[0].id;
  const t = tot(r, id);
  return `<a class="li" href="#/play/${r.id}/card"><span><b>${esc(r.courseName)}</b><br><small class="muted">${fmtDate(r.date)} · ${r.holes.length}홀 · ${r.players.map(p => esc(p.name)).join(', ')}</small></span>
    <span style="text-align:right">${r.finished ? '' : '<span class="tag x2">진행 중</span><br>'}<b class="num" style="font-size:1.4em">${t.n ? t.s : '–'}</b> <small class="muted num">${t.n ? tp(t.tp) : ''}</small></span></a>`;
}
function vOnboard() {
  return bar('SG골프 공략북', '전국 골프장 공략 · 기록 · GPS') + `<div class="page">
    <div class="card hero stack"><h2>반가워요!</h2><p>세 가지만 알려주시면 공략과 통계가 내 기준으로 맞춰져요. 나중에 설정에서 바꿀 수 있어요.</p></div>
    <div class="card stack">
      <label class="field"><span>이름</span><input class="inp" id="onbName" autocomplete="name" placeholder="예: 박성규"></label>
      <div class="grid2">
        <label class="field"><span>핸디캡 (모르면 비워두기)</span><input class="inp num" id="onbHcp" type="number" inputmode="decimal" placeholder="예: 18"></label>
        <label class="field"><span>드라이버 평균 거리 (m)</span><input class="inp num" id="onbDrv" type="number" inputmode="numeric" placeholder="예: 200"></label>
      </div>
      <p class="small muted">드라이버 거리는 자동 공략 계산에 써요. 라운드 중 샷을 측정하면 실제 기록으로 바뀌어요.</p>
      <button class="btn block" data-act="onboard">시작하기</button>
    </div>
    <a class="btn ghost block" href="#/help/start">사용법 먼저 보기</a>
  </div>`;
}

// ---------- 골프장 찾기 ----------
function vFind() {
  if (!KR) { loadKR().then(() => { if (route()[0] === 'find') render(); }).catch(() => toast('골프장 목록을 불러오지 못했어요')); return bar('골프장 찾기', '', '', '#/home', 'find') + '<p class="empty">목록을 불러오는 중…</p>'; }
  const q = state.findQ.trim().toLowerCase().replace(/\s+/g, '');
  let list = KR.filter(e => !q || (e.n + (e.en || '') + (e.a || '')).toLowerCase().replace(/\s+/g, '').includes(q));
  if (G.pos) list = list.map(e => ({ ...e, d: distM(G.pos, { lat: e.y, lng: e.x }) })).sort((a, b) => a.d - b.d);
  const mine = new Set(db.courses.map(c => c.osm).filter(Boolean));
  const shown = list.slice(0, 80);
  return bar('골프장 찾기', `전국 ${KR.length}곳 · OpenStreetMap`, '', '#/home', 'find') + `<div class="page">
    <div class="row"><input class="inp" id="findQ" type="search" placeholder="골프장 이름이나 지역" value="${esc(state.findQ)}" autocomplete="off"></div>
    <div class="seg"><button class="${state.findView === 'list' ? 'on' : ''}" data-act="findView" data-v="list">목록</button><button class="${state.findView === 'map' ? 'on' : ''}" data-act="findView" data-v="map">지도</button></div>
    <div class="legend"><span><i style="background:var(--green-2)"></i>도면 있음</span><span><i style="background:var(--flag)"></i>그린만</span><span><i style="background:var(--muted)"></i>위성만 (직접 그리기)</span></div>
    ${state.findView === 'map' ? `<div id="map" class="map" style="height:62vh"></div>` : `
    <div class="card list">${shown.map(e => { const [l, c] = KR_BADGE[krStatus(e)]; return `<a class="li" href="#/osm/${e.i}">
      <span><b>${esc(e.n)}</b><br><small class="muted">${[esc(e.a || ''), e.d != null ? `${e.d < 10000 ? (e.d / 1000).toFixed(1) : Math.round(e.d / 1000)}km` : ''].filter(Boolean).join(' · ')}</small></span>
      <span class="row" style="gap:6px">${mine.has(e.i) ? '<span class="tag">추가됨</span>' : ''}<span class="chip sm ${c}">${l}</span></span></a>`; }).join('') || '<p class="empty">찾는 골프장이 없어요.</p>'}</div>
    ${list.length > shown.length ? `<p class="small muted" style="text-align:center">${list.length - shown.length}곳 더 있어요. 이름으로 검색해보세요.</p>` : ''}`}
    <div class="card stack"><h3>목록에 없나요?</h3><p class="small muted">OpenStreetMap에 없는 골프장도 이름만 넣고 만든 뒤, 위성 사진 위에 홀을 그려서 쓸 수 있어요.</p>
      <button class="btn ghost" data-act="newCourseSheet">직접 만들기</button></div>
  </div>`;
}
function vOsmEntry(id) {
  if (!KR) { loadKR().then(render); return bar('불러오는 중', '', '', '#/find'); }
  const e = KR.find(x => x.i === id);
  if (!e) return bar('골프장을 찾을 수 없어요', '', '', '#/find');
  const have = db.courses.find(c => c.osm === id);
  const st = krStatus(e);
  const desc = {
    full: `홀 도면이 ${e.h}개 등록돼 있어요. 추가하면 티·그린·벙커·해저드가 자동으로 채워지고 바로 공략을 볼 수 있어요.`,
    green: `그린 ${e.g}개의 윤곽은 있지만 몇 번 홀인지 정보가 없어요. 추가한 뒤 편집기에서 홀마다 티를 찍고 그린을 탭하면 돼요 (18홀 5~10분).`,
    sat: 'OpenStreetMap에 홀 도면이 없어요. 추가한 뒤 편집기에서 위성 사진을 보며 티와 그린을 찍어주세요 (18홀 10~15분).',
  }[st];
  return bar(e.n, e.a || '', '', '#/find', 'find') + `<div class="page">
    <div class="card stack">
      <div class="row"><span class="chip ${KR_BADGE[st][1]}">${KR_BADGE[st][0]}</span><small class="muted num">${e.y.toFixed(4)}, ${e.x.toFixed(4)}</small></div>
      <p>${desc}</p>
      ${have ? `<a class="btn block" href="#/course/${have.id}">내 골프장 열기</a>` : `<button class="btn block" data-act="importOsm" data-id="${e.i}">내 골프장에 추가하기</button>`}
    </div>
    <div id="map" class="map" style="height:46vh"></div>
    <p class="small muted">지도 © Esri · 도면 © OpenStreetMap 기여자 (ODbL)</p>
  </div>`;
}

// ---------- 내 골프장 ----------
function vCourses() {
  return bar('내 골프장', `${db.courses.length}곳`, '', '#/home', 'find') + `<div class="page">
    ${db.courses.length ? `<div class="card list">${db.courses.slice().sort((a, b) => db.favs.includes(b.id) - db.favs.includes(a.id)).map(courseLi).join('')}</div>` : '<div class="card empty">추가한 골프장이 없어요.</div>'}
    <div class="grid2"><a class="btn" href="#/find">골프장 찾기</a><button class="btn ghost" data-act="newCourseSheet">직접 만들기</button></div>
  </div>`;
}
function vCourse(id) {
  const c = course(id);
  if (!c) return bar('골프장을 찾을 수 없어요', '', '', '#/courses');
  const st = courseStatus(c), fav = db.favs.includes(c.id), tee = state.courseTee ||= 'white';
  const off = db.offline[c.id];
  return bar(c.name, `${c.addr ? c.addr + ' · ' : ''}도면 ${st.full}/${st.n}홀`, `<button class="btn ghost sm icon ${fav ? 'fav' : ''}" data-act="fav" data-id="${c.id}" aria-label="즐겨찾기">${svg(ICON.star, 18)}</button>`, '#/courses', 'course') + `<div class="page">
    <div class="grid2">
      <button class="btn" data-act="roundFromCourse" data-id="${c.id}">라운드 시작</button>
      <a class="btn flag" href="#/hole/${c.id}/0/0">코스 브리핑</a>
    </div>
    ${st.full < st.n ? `<div class="card stack"><div class="row"><b>도면이 ${st.n - st.full}홀 비어 있어요</b></div>
      <p class="small muted">편집기에서 홀마다 티와 그린을 찍으면 자동 공략과 GPS 거리가 켜져요.</p>
      <a class="btn ghost" href="#/edit/${c.id}/${(() => { const f = courseHoleList(c).find(x => !hasMap(x.H)); return f ? `${f.si}/${f.i}` : '0/0'; })()}">코스 편집기 열기</a></div>` : ''}
    ${c.subs.map((s, si) => `<div class="card">
      <div class="row"><h3>${esc(s.name)} <small class="muted num">PAR ${sum(s.holes.map(h => h.par))}</small></h3><small class="muted num">${dfmt(sum(s.holes.map(h => holeLen(h, tee) || 0)))}${uLabel()}</small></div>
      <div class="list">${s.holes.map((H, i) => { const key = hk(c.id, s.id, i), note = db.notes[key]; const hh = holeHistory(key);
        return `<a class="li" href="#/hole/${c.id}/${si}/${i}"><span><b class="num">${i + 1}</b> <span class="small">PAR ${H.par}${H.hdcp ? ' · HDCP ' + H.hdcp : ''}</span>
          ${note && (note.text || (note.photos || []).length) ? ' <span class="tag">노트</span>' : ''}${hh.n ? ` <span class="tag">평균 ${hh.avg.toFixed(1)}</span>` : ''}</span>
          <span class="small ${hasMap(H) ? '' : 'muted'} num">${hasMap(H) ? `${dfmt(holeLen(H, tee))}${uLabel()}${elevDiff(H) != null ? ` · ${sgn(elevDiff(H))}m` : ''}` : '도면 없음'} ›</span></a>`; }).join('')}</div>
    </div>`).join('')}
    <details class="card"><summary><b>홀 정보 표로 수정 (파 · 핸디캡 · 거리)</b></summary>
      <div class="stack" style="margin-top:10px" data-root="course:${c.id}">
      <label class="field"><span>골프장 이름</span><input class="inp" data-bind="name" value="${esc(c.name)}"></label>
      <div class="row"><span class="small muted">거리 입력 티</span><div class="chips">${TEES.map(([k, l]) => `<button class="chip sm ${tee === k ? 'on' : ''}" data-act="courseTee" data-v="${k}">${l}</button>`).join('')}</div></div>
      ${c.subs.map((s, si) => `<div class="stack"><input class="inp sm" style="max-width:160px;font-weight:700" data-bind="subs.${si}.name" value="${esc(s.name)}" aria-label="코스 이름">
        <div class="tbl-wrap"><table class="bd num"><tr><th>홀</th><th>파</th><th>핸디캡</th><th>거리(${uLabel()})</th></tr>
        ${s.holes.map((H, i) => `<tr><td>${i + 1}</td>
          <td><select class="inp sm" style="width:58px" data-bind="subs.${si}.holes.${i}.par" data-type="num">${[3, 4, 5, 6].map(p => `<option ${H.par === p ? 'selected' : ''}>${p}</option>`).join('')}</select></td>
          <td><input class="inp sm num" style="width:58px;text-align:right" type="number" inputmode="numeric" min="1" max="18" data-bind="subs.${si}.holes.${i}.hdcp" data-type="num" value="${H.hdcp ?? ''}"></td>
          <td><input class="inp sm num" style="width:76px;text-align:right" type="number" inputmode="numeric" data-dist="${si}.${i}" placeholder="${hasMap(H) ? dfmt(holeGeo(H).len) : ''}" value="${H.dist && H.dist[tee] != null ? dfmt(H.dist[tee]) : ''}"></td></tr>`).join('')}
        </table></div>
        <button class="btn danger sm" data-act="subDel" data-id="${c.id}" data-si="${si}" ${c.subs.length < 2 ? 'disabled' : ''}>${esc(s.name)} 코스 삭제</button></div>`).join('')}
      <p class="small muted">거리를 비워두면 도면으로 계산한 거리(흐린 숫자)를 써요.</p>
      <button class="btn ghost sm" data-act="subAdd" data-id="${c.id}">+ 9홀 코스 추가</button></div>
    </details>
    <div class="card stack"><h3>데이터 관리</h3>
      <a class="btn ghost" href="#/edit/${c.id}/0/0">코스 편집기</a>
      <button class="btn ghost" data-act="offline" data-id="${c.id}">${off ? `오프라인 지도 다시 저장 (${off.date})` : '오프라인 지도 저장 (산속 대비)'}</button>
      <button class="btn ghost" data-act="elevRefresh" data-id="${c.id}">고저차 다시 받기</button>
      ${c.osm ? `<button class="btn ghost" data-act="osmReload" data-id="${c.id}">OpenStreetMap 도면 다시 불러오기</button>` : ''}
      <button class="btn ghost" data-act="exportCourse" data-id="${c.id}">이 골프장 도면 파일로 내보내기</button>
      <button class="btn danger" data-act="courseDel" data-id="${c.id}">골프장 삭제</button>
    </div>
  </div>`;
}

// ---------- 홀 공략 (야디지북) ----------
function vHole(cid, si, hi) {
  const c = course(cid); si = Number(si) || 0; hi = Number(hi) || 0;
  if (!c || !c.subs[si]) return bar('홀을 찾을 수 없어요', '', '', '#/courses');
  const s = c.subs[si], H = s.holes[hi], key = hk(c.id, s.id, hi);
  const all = courseHoleList(c), pos = all.findIndex(x => x.si === si && x.i === hi);
  const prev = all[pos - 1], next = all[pos + 1];
  const strat = holeStrategy(H, { tee: state.courseTee || 'white' });
  const geo = strat.geo;
  const hz = geo.tee ? hazardsFrom(H, geo.tee, geo) : [];
  const hist = holeHistory(key);
  const note = db.notes[key] || {};
  const reads = db.reads[key] || [];
  const measured = db.shots.filter(x => x.club === '드라이버').length;
  return bar(`${s.name} ${hi + 1}번 홀`, `${c.name} · PAR ${H.par}${H.hdcp ? ' · HDCP ' + H.hdcp : ''}`, `<a class="btn ghost sm icon" href="#/edit/${c.id}/${si}/${hi}" aria-label="편집">${svg(ICON.edit, 18)}</a>`, `#/course/${c.id}`, 'hole') + `<div class="page" id="swipeArea">
    <div class="holewrap">${holeSVG(H, { tee: state.courseTee })}</div>
    ${geo.green ? `<div class="grid3">
      <div class="stat"><small>길이</small><div class="big num">${dfmt(strat.len)}<small>${uLabel()}</small></div></div>
      <div class="stat"><small>고저차</small><div class="big num">${strat.elev != null ? sgn(strat.elev) : '–'}<small>m</small></div></div>
      <div class="stat"><small>그린 깊이</small><div class="big num">${geo.depth ? Math.round(geo.depth) : '–'}<small>m</small></div></div>
    </div>` : `<a class="btn" href="#/edit/${c.id}/${si}/${hi}">편집기에서 이 홀 그리기</a>`}
    <div class="card stack"><div class="row"><h3>자동 공략</h3><span class="chip sm ${measured ? 'on' : ''}">${measured ? `내 드라이버 ${measured}샷 기준` : `드라이버 ${dfmt(db.settings.driver)}${uLabel()} 가정`}</span></div>
      ${strat.lines.map(l => `<p>• ${esc(l)}</p>`).join('')}
      <p class="small muted">도면과 내 비거리로 계산한 참고값이에요. 계산 방법은 사용법 › 홀 공략에 있어요.</p></div>
    ${hz.length ? `<div class="card"><h3>티에서 본 위험 요소</h3><div class="tbl-wrap"><table class="bd num"><tr><th>종류</th><th>방향</th><th>닿는 거리</th><th>넘기는 거리</th></tr>
      ${hz.map(z => `<tr><td>${z.name}${z.nearGreen ? ' (그린 옆)' : ''}</td><td>${z.side}</td><td>${dfmt(z.reach)}</td><td>${z.carry != null ? dfmt(z.carry) : '–'}</td></tr>`).join('')}</table></div></div>` : ''}
    <div class="card stack"><div class="row"><h3>내 노트</h3><small class="muted">${note.updated ? fmtDate(note.updated) : ''}</small></div>
      <textarea class="inp note" id="noteText" data-note="${key}" placeholder="예: 드라이버 잡지 말 것. 3번 우드로 왼쪽 페어웨이 → 7번 아이언. 그린 뒤는 내리막.">${esc(note.text || '')}</textarea>
      <div class="photos" id="photos" data-key="${key}">${(note.photos || []).map(p => `<button class="ph" data-act="photoView" data-id="${p}" data-key="${key}"><img alt="홀 사진" data-photo="${p}"></button>`).join('')}
        <label class="ph add" aria-label="사진 추가">＋<input type="file" accept="image/*" capture="environment" data-photo-add="${key}" hidden></label></div>
    </div>
    <div class="card stack"><div class="row"><h3>이 홀 내 기록</h3><small class="muted">${hist.n}번 쳤어요</small></div>
      ${hist.n ? `<div class="grid3" style="text-align:center">
        <div><small class="muted">평균</small><div class="num big" style="font-size:1.6em">${hist.avg.toFixed(1)}</div></div>
        <div><small class="muted">베스트</small><div class="num big" style="font-size:1.6em">${hist.best}</div></div>
        <div><small class="muted">퍼트</small><div class="num big" style="font-size:1.6em">${hist.putts != null ? hist.putts.toFixed(1) : '–'}</div></div></div>
        ${(() => { const m = hist.mistakes, parts = []; if (m.right) parts.push(`티샷 오른쪽 ${m.right}번`); if (m.left) parts.push(`티샷 왼쪽 ${m.left}번`); if (m.bunker) parts.push(`벙커 ${m.bunker}번`); if (m.pen) parts.push(`벌타 ${m.pen}개`); if (m.three) parts.push(`3퍼트 ${m.three}번`); return parts.length ? `<p class="small">자주 한 실수: ${parts.join(' · ')}</p>` : ''; })()}
        <div class="list">${hist.list.slice(0, 5).map(x => `<a class="li" href="#/play/${x.rid}/card"><span>${fmtDate(x.date)}</span><span class="num">${x.s} (${scoreName(x.s, x.par)})${x.p != null ? ' · 퍼트 ' + x.p : ''}</span></a>`).join('')}</div>`
        : '<p class="small muted">이 홀을 라운드에서 기록하면 여기에 쌓여요.</p>'}
    </div>
    ${geo.green ? `<div class="card stack"><div class="row"><h3>그린 경사 기록</h3><small class="muted">${reads.length}번 측정</small></div>
      ${reads.length ? `<div class="greenwrap">${greenSVG(H, { reads })}</div><p class="small muted">화살표는 공이 굴러 내려가는 방향이에요. 길수록 가팔라요.</p>` : '<p class="small muted">라운드 중 그린 탭에서 경사를 재면 여기에 경사 지도가 쌓여요.</p>'}</div>` : ''}
    <div class="grid2">
      ${prev ? `<a class="btn ghost" data-swipe="prev" href="#/hole/${c.id}/${prev.si}/${prev.i}">← ${esc(prev.s.name)} ${prev.i + 1}</a>` : '<span></span>'}
      ${next ? `<a class="btn" data-swipe="next" href="#/hole/${c.id}/${next.si}/${next.i}">${esc(next.s.name)} ${next.i + 1} →</a>` : `<a class="btn" href="#/course/${c.id}">브리핑 끝</a>`}
    </div>
  </div>`;
}

// ---------- 코스 편집기 ----------
const EDIT_TOOLS = [['tee', '티'], ['green', '그린 중앙'], ['greenPoly', '그린 윤곽'], ['dogleg', '꺾이는 지점'], ['bunker', '벙커'], ['water', '해저드'], ['fairway', '페어웨이'], ['ob', 'OB 선'], ['erase', '지우기']];
function vEdit(cid, si, hi) {
  const c = course(cid); si = Number(si) || 0; hi = Number(hi) || 0;
  if (!c || !c.subs[si]) return bar('코스를 찾을 수 없어요', '', '', '#/courses');
  const all = courseHoleList(c), pos = all.findIndex(x => x.si === si && x.i === hi);
  const prev = all[pos - 1], next = all[pos + 1];
  return bar(`${c.subs[si].name} ${hi + 1}번 홀 그리기`, c.name, '', `#/course/${c.id}`, 'editor') + `<div class="page">
    <div class="chips tools">${EDIT_TOOLS.map(([k, l]) => `<button class="chip ${state.editTool === k ? 'on' : ''}" data-act="editTool" data-v="${k}">${l}</button>`).join('')}</div>
    <div id="editPanel" class="card small" style="padding:8px 12px"></div>
    <div id="map" class="map" style="height:56vh"></div>
    <div class="grid3">
      ${prev ? `<a class="btn ghost sm" href="#/edit/${c.id}/${prev.si}/${prev.i}">← ${esc(prev.s.name)}${prev.i + 1}</a>` : '<span></span>'}
      <button class="btn ghost sm" data-act="editUndo">되돌리기</button>
      ${next ? `<a class="btn sm" href="#/edit/${c.id}/${next.si}/${next.i}">${esc(next.s.name)}${next.i + 1} →</a>` : `<a class="btn sm" href="#/course/${c.id}">완료</a>`}
    </div>
    <div class="row"><span class="small muted">파</span><div class="seg" style="flex:1">${[3, 4, 5, 6].map(p => `<button class="${c.subs[si].holes[hi].par === p ? 'on' : ''}" data-act="editPar" data-v="${p}">${p}</button>`).join('')}</div>
      <button class="btn ghost sm" data-act="mapMe">내 위치</button></div>
  </div>`;
}
function renderEditPanel() {
  const el = $('#editPanel'); if (!el || !M.ctx || M.kind !== 'edit') return;
  const H = editHole(), g = holeGeo(H), t = state.editTool, d = state.editDraft;
  const guide = {
    tee: '티잉 구역 가운데를 탭하세요. 다시 탭하면 옮겨져요.',
    green: '그린 가운데를 탭하세요. 점선 윤곽이 있는 그린을 탭하면 윤곽째 붙어요.',
    greenPoly: '그린 가장자리를 따라 돌아가며 탭한 뒤 "도형 완료"를 누르세요.',
    dogleg: '도그레그 홀이면 페어웨이가 꺾이는 곳을 탭하세요. 여러 번 찍을 수 있어요.',
    bunker: '벙커 가장자리를 돌아가며 탭한 뒤 "도형 완료"를 누르세요.',
    water: '해저드(연못·개울) 가장자리를 돌아가며 탭한 뒤 "도형 완료"를 누르세요.',
    fairway: '페어웨이 가장자리를 돌아가며 탭하세요. 티샷 페어웨이 판정에 써요.',
    ob: 'OB 말뚝 선을 따라 탭한 뒤 "도형 완료"를 누르세요.',
    erase: '지울 벙커·해저드 안쪽이나 꺾이는 지점을 탭하세요.',
  }[t];
  el.innerHTML = `<div class="row"><span>${guide}</span>${d && d.pts.length ? `<span class="row" style="gap:6px;flex:none"><button class="btn ghost sm" data-act="editCancel">취소</button><button class="btn sm" data-act="editDone">도형 완료 (${d.pts.length})</button></span>` : ''}</div>
    <div class="row muted"><span>티 ${g.tee ? '✓' : '–'} · 그린 ${g.green ? '✓' : '–'} · 윤곽 ${H.greenPoly ? '✓' : '–'} · 위험 요소 ${(H.hazards || []).filter(z => z.t !== 'fairway').length}</span>
    <span class="num">${g.len ? dfmt(g.len) + uLabel() : ''}${elevDiff(H) != null ? ' · ' + sgn(elevDiff(H)) + 'm' : ''}</span></div>`;
}

// ---------- 기록 ----------
function vHistory() {
  const rs = db.rounds.slice().sort((a, b) => (b.date + b.startedAt) > (a.date + a.startedAt) ? 1 : -1);
  const groups = {};
  rs.forEach(r => { (groups[r.date.slice(0, 7)] ||= []).push(r); });
  return bar('라운드 기록', `${rs.length}라운드`, '', '', 'score') + `<div class="page">
    ${rs.length ? Object.entries(groups).map(([m, list]) => `<div class="card"><div class="label">${m.replace('-', '년 ')}월</div><div class="list">${list.map(roundLi).join('')}</div></div>`).join('')
      : `<div class="card empty stack"><p>아직 기록이 없어요.</p><a class="btn" href="#/new">라운드 시작</a></div>`}
    <a class="btn ghost block" href="#/stats">내 통계 보기</a>
  </div>`;
}

// ---------- 통계 ----------
function vStats() {
  if (!me()) return vOnboard();
  const all = myRounds(), rs = state.statsN ? all.slice(0, state.statsN) : all;
  const st = computeStats(rs, me().id);
  const f1 = v => v == null ? '–' : v.toFixed(1), pc = v => v == null ? '–' : Math.round(v) + '%';
  const meter = (label, v, bad) => `<div><div class="row"><span>${label}</span><b class="num ${bad ? 'neg' : ''}">${pc(v)}</b></div><div class="meter"><i style="width:${v || 0}%;${bad ? 'background:var(--red)' : ''}"></i></div></div>`;
  const D = st.dist, dn = st.holes || 1;
  const distItems = [['eg', '이글+', 'var(--flag)'], ['bd', '버디', 'var(--red)'], ['par', '파', 'var(--green-2)'], ['bg', '보기', 'var(--blue)'], ['db', '더블', 'var(--muted)'], ['tr', '트리플+', 'var(--ink)']];
  const worst = [3, 4, 5].filter(p => st.parAvg[p] != null).map(p => ({ p, over: st.parAvg[p] - p })).sort((a, b) => b.over - a.over)[0];
  const tips = [];
  if (st.threePct != null && st.threePct > 12) tips.push(`3퍼트가 ${Math.round(st.threePct)}%예요. 라운드당 ${(st.three / Math.max(st.rounds, 1)).toFixed(1)}번꼴이라 롱퍼트 거리감 연습이 가장 효과가 커요.`);
  if (st.fwLPct != null && st.fwRPct != null && Math.abs(st.fwLPct - st.fwRPct) > 12) tips.push(`티샷 미스가 ${st.fwRPct > st.fwLPct ? '오른쪽' : '왼쪽'}으로 많이 가요 (${Math.round(Math.max(st.fwLPct, st.fwRPct))}%).`);
  if (worst && worst.over > 1.2) tips.push(`파${worst.p} 홀에서 평균 +${worst.over.toFixed(1)}타로 가장 많이 잃어요.`);
  if (st.penAvg != null && st.penAvg >= 2) tips.push(`라운드당 벌타가 ${st.penAvg.toFixed(1)}개예요. 티샷 클럽을 보수적으로 골라보세요.`);
  return bar('내 통계', `${me().name} · ${rs.length}라운드`, '', '', 'stats') + `<div class="page">
    <div class="seg">${[[5, '최근 5'], [10, '최근 10'], [20, '최근 20'], [0, '전체']].map(([n, l]) => `<button class="${state.statsN === n ? 'on' : ''}" data-act="statsN" data-v="${n}">${l}</button>`).join('')}</div>
    ${!rs.length ? `<div class="card empty">끝낸 라운드가 생기면 여기에 통계가 쌓여요.</div>` : `
    <div class="grid3">
      <div class="stat"><small>평균 타수</small><div class="big num">${f1(st.avg)}</div></div>
      <div class="stat"><small>평균 퍼트</small><div class="big num">${f1(st.avgPutts)}</div></div>
      <div class="stat"><small>간이 핸디캡</small><div class="big num">${f1(st.hcp)}</div></div>
    </div>
    ${trendChart(st.full.slice(-20))}
    <div class="card stack">
      ${meter('페어웨이 안착 (FIR)', st.fwPct)}${meter('그린 적중 (GIR)', st.girPct)}${meter('스크램블', st.scrPct)}${meter('샌드 세이브', st.bkPct)}${meter('3퍼트 비율', st.threePct, true)}
      <div class="row small muted"><span>티샷 미스 방향</span><span>왼쪽 ${pc(st.fwLPct)} · 오른쪽 ${pc(st.fwRPct)}</span></div>
      <div class="row small muted"><span>라운드당 벌타</span><span>${f1(st.penAvg)}</span></div>
    </div>
    <div class="card"><h3>파별 평균 타수</h3><div class="grid3" style="text-align:center;margin-top:8px">${[3, 4, 5].map(p => `<div><small class="muted">파${p}</small>
      <div class="num ${worst && worst.p === p ? 'neg' : ''}" style="font-size:1.8em;font-weight:700">${st.parAvg[p] != null ? st.parAvg[p].toFixed(2) : '–'}</div></div>`).join('')}</div></div>
    <div class="card stack"><div class="row"><h3>스코어 분포</h3><small class="muted">${st.holes}홀</small></div>
      <div class="distbar">${distItems.map(([k, , c]) => D[k] ? `<i style="width:${D[k] / dn * 100}%;background:${c}"></i>` : '').join('')}</div>
      <div class="legend">${distItems.map(([k, l, c]) => `<span><i style="background:${c}"></i>${l} ${Math.round(D[k] / dn * 100)}%</span>`).join('')}</div></div>
    ${tips.length ? `<div class="card stack"><h3>개선 포인트</h3>${tips.map(t => `<p class="small">• ${t}</p>`).join('')}</div>` : ''}`}
    <a class="btn ghost block" href="#/clubs">내 클럽 비거리 · 탄착군</a>
  </div>`;
}
function trendChart(pts) {
  if (pts.length < 2) return '';
  const W = 340, H = 150, L = 30, R = 10, T = 14, Bm = 22;
  const ys = pts.map(p => p.score), lo = Math.floor((Math.min(...ys) - 2) / 5) * 5, hi = Math.ceil((Math.max(...ys) + 2) / 5) * 5;
  const x = i => L + (W - L - R) * i / (pts.length - 1), y = v => T + (H - T - Bm) * (hi - v) / (hi - lo);
  const ticks = []; for (let v = lo; v <= hi; v += (hi - lo > 20 ? 10 : 5)) ticks.push(v);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return `<div class="card"><div class="row"><h3>타수 추이</h3><small class="muted">최근 ${pts.length}라운드</small></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="타수 추이">
      ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
      <path d="${path}L${x(pts.length - 1)},${H - Bm}L${x(0)},${H - Bm}Z" fill="var(--green-2)" opacity=".15"/>
      <path d="${path}" fill="none" stroke="var(--green-2)" stroke-width="2.5" stroke-linejoin="round"/>
      ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.score)}" r="${i === pts.length - 1 ? 5 : 3}" fill="${i === pts.length - 1 ? 'var(--flag)' : 'var(--green-2)'}"/>`).join('')}
      <text x="${x(pts.length - 1)}" y="${y(last.score) - 9}" text-anchor="end" style="fill:var(--ink);font-weight:700">${last.score}</text>
    </svg></div>`;
}

// ---------- 클럽 ----------
function vClubs() {
  const t = clubTable();
  const sel = state.clubSel || '드라이버';
  const shots = db.shots.filter(s => s.club === sel && s.lat != null && s.d > 0);
  return bar('내 클럽 비거리', `측정한 샷 ${db.shots.length}개`, '', '#/stats', 'shot') + `<div class="page">
    <div class="card"><div class="tbl-wrap"><table class="bd num"><tr><th>클럽</th><th>평균</th><th>최대</th><th>샷</th></tr>
      ${t.map(c => `<tr class="${c.est ? 'muted' : ''}"><td><button class="linkbtn" data-act="clubSel" data-v="${c.club}">${c.club}</button></td><td><b>${dfmt(c.avg)}${uLabel()}</b>${c.est ? ' <small>추정</small>' : ''}</td><td>${c.max ? dfmt(c.max) : '–'}</td><td>${c.n || '–'}</td></tr>`).join('')}</table></div>
      <p class="small muted" style="margin-top:6px">흐린 줄은 측정 기록이 없어서 드라이버 거리로 추정한 값이에요. 5샷 이상인 클럽은 짧은 쪽 20%를 미스샷으로 보고 빼요.</p></div>
    <div class="card stack"><div class="row"><h3>${sel} 탄착군</h3><small class="muted">${shots.length}샷</small></div>
      ${shots.length ? dispersion(shots) : '<p class="small muted">라운드 중 "샷 측정"으로 잰 샷이 여기에 점으로 찍혀요.</p>'}</div>
    <div class="card stack"><h3>직접 입력</h3>
      <div class="grid2"><select class="inp" id="shotClub">${CLUBS.map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('')}</select>
        <input class="inp num" id="shotD" type="number" inputmode="numeric" placeholder="거리 (${uLabel()})"></div>
      <button class="btn" data-act="shotAdd">추가</button></div>
    ${db.shots.length ? `<div class="card"><h3>최근 샷</h3><div class="list">${db.shots.slice(-20).reverse().map(s => `<div class="li"><span>${s.club} <small class="muted">${s.date ? fmtDate(s.date) : ''}${s.res ? ' · ' + { L: '왼쪽', C: '페어웨이', R: '오른쪽' }[s.res] : ''}</small></span>
      <span class="row" style="gap:8px"><b class="num">${dfmt(s.d)}${uLabel()}</b><button class="btn ghost sm" data-act="shotDel" data-id="${s.id}" aria-label="삭제">✕</button></span></div>`).join('')}</div></div>` : ''}
  </div>`;
}
function dispersion(shots) {
  const W = 320, H = 220, maxD = Math.max(...shots.map(s => s.d)) * 1.08, maxL = Math.max(20, ...shots.map(s => Math.abs(s.lat))) * 1.2;
  const x = l => W / 2 + l / maxL * (W / 2 - 20), y = d => H - 20 - d / maxD * (H - 40);
  const ad = avg(shots.map(s => s.d)), al = avg(shots.map(s => s.lat));
  const ticks = [50, 100, 150, 200, 250, 300].filter(v => v < maxD);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="탄착군">
    <line x1="${W / 2}" x2="${W / 2}" y1="10" y2="${H - 20}" stroke="var(--line)" stroke-dasharray="4 4"/>
    ${ticks.map(v => `<line x1="20" x2="${W - 20}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="22" y="${y(v) - 3}">${dfmt(v)}</text>`).join('')}
    ${shots.map(s => `<circle cx="${x(s.lat)}" cy="${y(s.d)}" r="4.5" fill="var(--green-2)" opacity=".8"/>`).join('')}
    <circle cx="${x(al)}" cy="${y(ad)}" r="7" fill="none" stroke="var(--flag)" stroke-width="2.5"/>
    <text x="${W / 2}" y="${H - 5}" text-anchor="middle">목표 방향 · 평균 ${Math.abs(al) < 1 ? '정면' : `${al > 0 ? '오른쪽' : '왼쪽'} ${Math.round(Math.abs(al))}m`}</text>
  </svg>`;
}

// ---------- 설정 ----------
function vSettings() {
  const s = db.settings;
  const segBtn = (k, v, l) => `<button class="${s[k] === v ? 'on' : ''}" data-act="setSetting" data-k="${k}" data-v="${v}">${l}</button>`;
  return bar('설정', `SG골프 공략북 v${APP_VER}`, '', '', 'settings') + `<div class="page">
    <div class="card list">
      <a class="li" href="#/help"><span><b>사용법</b></span><span class="muted">›</span></a>
      <a class="li" href="#/friends"><span>나와 동반자</span><span class="muted">${db.friends.length}명 ›</span></a>
      <a class="li" href="#/courses"><span>내 골프장</span><span class="muted">${db.courses.length}곳 ›</span></a>
      <a class="li" href="#/clubs"><span>내 클럽 비거리</span><span class="muted">›</span></a>
    </div>
    <div class="card stack" data-root="settings">
      <h3>내 기준값</h3>
      ${numRow('드라이버 평균 거리 (m)', 'driver', s.driver, 5, 90, '측정한 샷이 없을 때 공략 계산에 써요')}
      ${numRow('내 보폭 (m)', 'stride', s.stride, 0.01, 90, '퍼트 거리 = 걸음 수 × 보폭')}
      ${numRow('그린 빠르기 (스팀프)', 'stimp', s.stimp, 0.5, 90, '보통 8~11. 브레이크 계산에 써요')}
      <button class="btn ghost sm" data-act="calibrate">기울기 센서 보정</button>
    </div>
    <div class="card stack" data-root="settings">
      <h3>라운드</h3>
      ${toggleRow('GPS 거리', '그린·해저드까지 거리를 보여줘요', 'gps', s.gps)}
      ${toggleRow('자동 홀 넘김', '다음 홀 티에 가면 알아서 넘겨요', 'autoHole', s.autoHole)}
      ${toggleRow('음성 안내', '거리 화면에 "읽어주기" 버튼을 보여줘요', 'voice', s.voice)}
      ${toggleRow('화면 꺼짐 방지', '라운드 중 화면이 꺼지지 않게 해요', 'wake', s.wake)}
      <div class="stack"><span>상세 기록 (퍼트 · 티샷 · 벙커 · 벌타)</span><div class="seg">${segBtn('detail', 'all', '모두')}${segBtn('detail', 'me', '나만')}${segBtn('detail', 'none', '끄기')}</div></div>
      <div class="row"><span>타수 표시</span><div class="seg" style="width:170px">${segBtn('inputMode', 'strokes', '타수')}${segBtn('inputMode', 'topar', '파 대비')}</div></div>
    </div>
    <div class="card stack" data-root="settings">
      <h3>화면</h3>
      <div class="row"><span>거리 단위</span><div class="seg" style="width:140px">${segBtn('unit', 'm', '미터')}${segBtn('unit', 'yd', '야드')}</div></div>
      <div class="stack"><span>테마</span><div class="seg">${segBtn('theme', 'auto', '자동')}${segBtn('theme', 'light', '라이트')}${segBtn('theme', 'dark', '다크')}</div></div>
      ${toggleRow('큰 글씨', '햇빛 아래에서 잘 보이게 키워요', 'big', s.big)}
      ${toggleRow('버튼 진동', '입력할 때 짧게 진동해요 (안드로이드)', 'haptic', s.haptic)}
    </div>
    <div class="card stack"><h3>데이터</h3>
      <p class="small muted">모든 기록은 이 기기에만 저장돼요. 폰을 바꾸거나 앱을 지우기 전에 백업 파일을 받아두세요.</p>
      <div class="grid2"><button class="btn ghost" data-act="exportData">백업하기</button><button class="btn ghost" data-act="importSheet">복원하기</button></div>
      <button class="btn danger" data-act="wipe">모든 데이터 삭제</button>
    </div>
    <p class="small muted">지도 © Esri · 도면 © OpenStreetMap 기여자(ODbL) · 고도·날씨 © Open-Meteo(CC BY 4.0, Copernicus DEM)</p>
  </div>`;
}
function vFriends() {
  return bar('나와 동반자', '', '', '#/settings') + `<div class="page">
    <div class="card list">${db.friends.map(f => `<div class="li" data-root="friend:${f.id}">
      <span style="flex:1"><input class="inp sm" data-bind="name" value="${esc(f.name)}" aria-label="이름"></span>
      <span class="row" style="gap:6px"><small class="muted">HCP</small><input class="inp sm num" style="width:64px;text-align:right" type="number" inputmode="decimal" data-bind="hcp" data-type="num" value="${f.hcp ?? ''}" aria-label="핸디캡">
      ${f.id === db.settings.meId ? '<span class="tag">나</span>' : `<button class="btn ghost sm" data-act="friendDel" data-id="${f.id}" aria-label="삭제">✕</button>`}</span></div>`).join('')}</div>
    <button class="btn ghost" data-act="friendSheet">+ 동반자 추가</button>
    <p class="small muted">이름을 바꿔도 지난 라운드 기록에는 그때 이름이 남아요.</p>
  </div>`;
}

// ---------- 사용법 ----------
function vHelp(id) {
  if (id) {
    const i = HELP.findIndex(h => h.id === id), h = HELP[i];
    if (!h) return vHelp();
    const prev = HELP[i - 1], next = HELP[i + 1];
    return bar(h.title, '사용법', '', '#/help') + `<div class="page"><article class="card help">${h.body}</article>
      <div class="grid2">${prev ? `<a class="btn ghost" href="#/help/${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="btn" href="#/help/${next.id}">${esc(next.title)} →</a>` : '<a class="btn" href="#/home">홈으로</a>'}</div></div>`;
  }
  return bar('사용법', '기능별 자세한 안내', '', '#/home') + `<div class="page">
    <div class="card hero stack"><h2>처음이라면</h2><p>"시작하기" → "골프장 찾기" → "코스 편집기" → "라운드 입력" 순서로 읽으면 첫 라운드까지 준비돼요.</p></div>
    <div class="card list">${HELP.map((h, i) => `<a class="li" href="#/help/${h.id}"><span><b class="num muted">${pad2(i + 1)}</b> ${esc(h.title)}<br><small class="muted">${esc(h.sum)}</small></span><span class="muted">›</span></a>`).join('')}</div>
  </div>`;
}
