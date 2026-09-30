'use strict';
/* 라운드 화면: 준비 · 입력 · 거리(GPS) · 그린 · 스코어카드 · 정산 · 경사 측정 */

function betForm(b, root, players) {
  const four = players.length === 4;
  return `<div class="stack" data-root="${root}">
    ${toggleRow('스트로크', '홀마다 타수 차이 × 타당 금액', 'bets.stroke.on', b.stroke.on)}
    ${b.stroke.on ? numRow('타당 금액 (원)', 'bets.stroke.rate', b.stroke.rate, 500) : ''}
    <div class="sep"></div>
    ${toggleRow('스킨스', '홀 단독 1등이 스킨을 가져가요', 'bets.skins.on', b.skins.on)}
    ${b.skins.on ? numRow('홀당 금액 (원)', 'bets.skins.rate', b.skins.rate) + toggleRow('<span class="small">동타면 다음 홀로 이월</span>', '', 'bets.skins.carry', b.skins.carry) : ''}
    <div class="sep"></div>
    ${toggleRow('라스베가스 (2:2)', four ? '팀 두 명의 타수를 붙인 숫자로 겨뤄요' : '4명일 때만 할 수 있어요', 'bets.vegas.on', b.vegas.on)}
    ${b.vegas.on ? numRow('점당 금액 (원)', 'bets.vegas.rate', b.vegas.rate, 100) + toggleRow('<span class="small">버디 뒤집기</span>', '상대 팀이 버디면 우리 팀 숫자를 뒤집어요', 'bets.vegas.flip', b.vegas.flip) : ''}
    <div class="sep"></div>
    ${toggleRow('버디 보너스', '버디는 1배, 이글 이상은 2배를 각자에게 받아요', 'bets.birdie.on', b.birdie.on)}
    ${b.birdie.on ? numRow('버디 금액 (원)', 'bets.birdie.amt', b.birdie.amt) : ''}
    ${toggleRow('니어 (파3)', '파3에서 핀에 가장 가까운 사람', 'bets.near.on', b.near.on)}
    ${b.near.on ? numRow('니어 금액 (원)', 'bets.near.amt', b.near.amt) : ''}
    ${toggleRow('롱기 (파5)', '파5에서 티샷을 가장 멀리 친 사람', 'bets.long.on', b.long.on)}
    ${b.long.on ? numRow('롱기 금액 (원)', 'bets.long.amt', b.long.amt) : ''}
    <div class="sep"></div>
    ${toggleRow('배판 (다음 홀 ×2)', '아래 조건이 나오면 다음 홀 금액이 2배', 'bets.dbl.on', b.dbl.on)}
    ${b.dbl.on ? `<div class="stack" style="padding-left:10px">
      ${toggleRow('<span class="small">누군가 버디 이상</span>', '', 'bets.dbl.birdie', b.dbl.birdie)}
      ${toggleRow('<span class="small">3명 이상 동타</span>', '', 'bets.dbl.tie', b.dbl.tie)}
      ${toggleRow('<span class="small">누군가 트리플 이상</span>', '', 'bets.dbl.triple', b.dbl.triple)}</div>` : ''}
    <div class="sep"></div>
    ${toggleRow('양파 상한', '내기 계산 때 타수를 파의 2배까지만 쳐요', 'bets.cap', b.cap)}
    ${toggleRow('핸디캡 적용', '핸디캡 홀 순서대로 타수를 빼고 계산해요', 'bets.hcp', b.hcp)}
  </div>`;
}
function vegasPicker(players, partnerId, root) {
  if (players.length !== 4) return '';
  return `<div class="stack"><span class="small muted">라스베가스 팀: ${esc(players[0].name)}의 파트너</span>
    <div class="chips">${players.slice(1).map(p => `<button class="chip ${partnerId === p.id ? 'on' : ''}" data-act="vegasPartner" data-root="${root}" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div></div>`;
}

// ---------- 라운드 준비 ----------
function newDraft(courseId) {
  const last = db.rounds.slice().sort((a, b) => b.startedAt - a.startedAt)[0];
  const cid = courseId || (last && course(last.courseId) ? last.courseId : (db.favs.find(course) || (db.courses[0] && db.courses[0].id) || null));
  const c = course(cid);
  const others = last ? last.players.map(p => p.id).filter(id => id !== db.settings.meId && friend(id)).slice(0, 3) : [];
  return { date: today(), courseId: cid, front: 0, back: c && c.subs.length > 1 ? 1 : -1, tee: last ? last.tee : 'white', players: [db.settings.meId, ...others], bets: clone({ ...defaultBets(), ...(db.lastBets || {}) }), partner: null };
}
function vNew() {
  if (!me()) return vOnboard();
  const d = state.draft ||= newDraft();
  if (d.courseId && !course(d.courseId)) d.courseId = null;
  const c = course(d.courseId);
  const players = d.players.map(friend).filter(Boolean);
  const avail = db.friends.filter(f => !d.players.includes(f.id));
  if (players.length === 4 && !players.slice(1).some(p => p.id === d.partner)) d.partner = players[1].id;
  return bar('라운드 준비', '골프장 · 동반자 · 내기', '', '#/home', 'score') + `<div class="page" data-root="draft">
    <div class="card stack"><label class="field"><span>날짜</span><input class="inp" type="date" data-bind="date" value="${d.date}"></label></div>
    <div class="card stack">
      <h3>골프장</h3>
      ${db.courses.length ? `<div class="chips">${db.courses.slice().sort((a, b) => db.favs.includes(b.id) - db.favs.includes(a.id)).map(x => `<button class="chip ${x.id === d.courseId ? 'on' : ''}" data-act="draftCourse" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>` : ''}
      <a class="chip add" href="#/find">+ 골프장 찾기</a>
      ${c ? `
        <div class="stack"><span class="small muted">${c.subs.length > 1 ? '전반 코스' : '코스'}</span><div class="chips">
          ${c.subs.map((s, i) => `<button class="chip ${d.front === i ? 'on' : ''}" data-act="draftSet" data-k="front" data-v="${i}">${esc(s.name)}</button>`).join('')}</div></div>
        <div class="stack"><span class="small muted">후반 코스</span><div class="chips">
          ${c.subs.map((s, i) => `<button class="chip ${d.back === i ? 'on' : ''}" data-act="draftSet" data-k="back" data-v="${i}">${esc(s.name)}</button>`).join('')}
          <button class="chip ${d.back === -1 ? 'on' : ''}" data-act="draftSet" data-k="back" data-v="-1">없음 (9홀만)</button></div></div>
        <div class="stack"><span class="small muted">티</span><div class="chips">${TEES.map(([k, l]) => `<button class="chip ${d.tee === k ? 'on' : ''}" data-act="draftSet" data-k="tee" data-v="${k}">${l}</button>`).join('')}</div></div>
        ${courseStatus(c).full < courseStatus(c).n ? `<p class="small muted">도면이 없는 홀은 GPS 거리와 자동 공략이 안 나와요. <a href="#/edit/${c.id}/0/0">편집기에서 그리기 ›</a></p>` : ''}` : ''}
    </div>
    <div class="card stack">
      <div class="row"><h3>플레이어 <span class="muted num">${players.length}/4</span></h3><small class="muted">HCP</small></div>
      ${players.map((p, i) => `<div class="row" data-root="friend:${p.id}"><b>${esc(p.name)}${p.id === db.settings.meId ? ' <span class="tag">나</span>' : ''}</b>
        <span class="row" style="gap:6px"><input class="inp sm num" style="width:70px;text-align:right" type="number" inputmode="decimal" data-bind="hcp" data-type="num" value="${p.hcp ?? ''}" aria-label="${esc(p.name)} 핸디캡">
        ${i > 0 ? `<button class="btn ghost sm" data-act="draftRemove" data-id="${p.id}" aria-label="빼기">✕</button>` : ''}</span></div>`).join('')}
      ${players.length < 4 ? `<div class="chips">${avail.map(f => `<button class="chip" data-act="draftAdd" data-id="${f.id}">+ ${esc(f.name)}</button>`).join('')}
        <button class="chip add" data-act="friendSheet" data-from="draft">+ 새 동반자</button></div>` : ''}
    </div>
    <details class="card" ${anyBet(d.bets) ? 'open' : ''}><summary><b>내기 설정</b> <small class="muted">${anyBet(d.bets) ? '켜짐' : '없음'}</small></summary>
      <div class="stack" style="margin-top:10px">${betForm(d.bets, 'draft', players)}${d.bets.vegas.on ? vegasPicker(players, d.partner, 'draft') : ''}</div></details>
    <button class="btn block big-btn" data-act="startRound" ${c ? '' : 'disabled'}>라운드 시작</button>
    ${c ? '' : '<p class="small muted" style="text-align:center">먼저 골프장을 골라주세요.</p>'}
  </div>`;
}
function makeRound(d) {
  const c = course(d.courseId);
  const subs = [c.subs[d.front]];
  if (d.back >= 0 && c.subs[d.back]) subs.push(c.subs[d.back]);
  const holes = [];
  subs.forEach((s, si) => s.holes.forEach((h, i) => holes.push({ no: si * 9 + i + 1, sub: s.name, subId: s.id, idx: i, par: h.par, hdcp: h.hdcp ?? null, dist: holeLen(h, d.tee) })));
  const players = d.players.map(friend).filter(Boolean).map(f => ({ id: f.id, name: f.name, hcp: f.hcp || 0 }));
  const scores = {}; players.forEach(p => { scores[p.id] = Array(holes.length).fill(null); });
  const r = { id: uid(), date: d.date, courseId: c.id, courseName: c.name, subNames: subs.map(s => s.name), tee: d.tee, holes, players, scores, bets: clone(d.bets), vegas: null, special: {}, mults: {}, pins: {}, cur: 0, finished: false, startedAt: Date.now() };
  if (players.length === 4) {
    const partner = d.partner && players.some(p => p.id === d.partner) ? d.partner : players[1].id;
    const a = [players[0].id, partner];
    r.vegas = { a, b: players.map(p => p.id).filter(id => !a.includes(id)) };
  }
  return r;
}

// ---------- 라운드 ----------
function vPlay(id, sub) {
  const r = rnd(id);
  if (!r) return bar('라운드를 찾을 수 없어요', '', '', '#/home') + `<div class="page"><p class="empty">삭제됐거나 없는 라운드예요.</p></div>`;
  if (r.cur >= r.holes.length) r.cur = 0;
  const tabs = [['hole', '입력'], ['gps', '거리'], ['green', '그린'], ['card', '카드'], ['settle', '정산']];
  const helpFor = { hole: 'score', gps: 'gps', green: 'green', card: 'score', settle: 'bets' }[sub];
  const head = bar(r.courseName, `${fmtDate(r.date)} · ${r.subNames.join(' → ')}${r.finished ? ' · 완료' : ''}`,
    `<button class="btn ghost sm icon" data-act="roundMenu" data-id="${r.id}" aria-label="라운드 메뉴">${svg(ICON.menu, 18)}</button>`, r.finished ? '#/history' : '#/home', helpFor);
  const seg = `<div class="seg">${tabs.map(([k, l]) => `<button class="${sub === k ? 'on' : ''}" data-act="go" data-h="#/play/${r.id}/${k}">${l}</button>`).join('')}</div>`;
  const body = sub === 'card' ? vCard(r) : sub === 'settle' ? vSettle(r) : sub === 'gps' ? vGps(r) : sub === 'green' ? vGreenPane(r) : vInput(r);
  return head + `<div class="page">${seg}${['hole', 'gps', 'green'].includes(sub) ? holeNav(r) : ''}${body}</div>`;
}
function holeNav(r) {
  const bets = computeBets(r);
  return `<div class="holenav" id="holenav">${r.holes.map((x, i) => {
    const done = r.players.every(p => S(r, p.id, i) != null);
    return `<button class="${i === r.cur ? 'cur' : done ? 'done' : ''} ${bets.mult[i] > 1 ? 'x2' : ''}" data-act="hole" data-i="${i}" aria-label="${x.no}번 홀">${x.no}</button>`; }).join('')}</div>`;
}
function entry(r, pid, h) {
  const a = r.scores[pid] ||= Array(r.holes.length).fill(null);
  return a[h] ||= { s: null, p: null, fw: null, bk: false, pen: 0 };
}
function holeHead(r) {
  const X = r.holes[r.cur], ref = roundHoleRef(r, r.cur);
  const len = ref ? holeLen(ref.H, r.tee) : X.dist;
  const el = ref ? elevDiff(ref.H) : null;
  return `<div class="holehead">
    <div><div class="sub">${esc(X.sub)}</div><div class="hn">${X.no}<small>번 홀</small></div></div>
    <button data-act="holeEdit" aria-label="홀 정보 수정"><div class="par">PAR ${X.par}</div>
      <div class="sub num">${len ? dfmt(len) + uLabel() : '거리 없음'}${el != null ? ' · ' + sgn(el) + 'm' : ''}${X.hdcp ? ' · HDCP ' + X.hdcp : ''}</div></button>
  </div>`;
}
function vInput(r) {
  const h = r.cur, X = r.holes[h], N = r.holes.length, ref = roundHoleRef(r, h);
  const bets = computeBets(r), m = bets.mult[h];
  const B = { ...defaultBets(), ...(r.bets || {}) };
  const detail = db.settings.detail;
  const note = ref && db.notes[ref.key];
  const strat = ref && hasMap(ref.H) ? holeStrategy(ref.H, { tee: r.tee }).lines : null;
  const players = r.players.map(p => {
    const e = E(r, p.id, h) || {}, s = e.s, t = tot(r, p.id), d = s != null ? s - X.par : null;
    const showDetail = detail === 'all' || (detail === 'me' && p.id === db.settings.meId);
    const vDisp = s == null ? `<span class="v unset">${db.settings.inputMode === 'topar' ? '0' : X.par}</span>`
      : db.settings.inputMode === 'topar' ? `<span class="v">${d === 0 ? '0' : tp(d)}<small>${s}타</small></span>` : `<span class="v">${s}</span>`;
    return `<div class="pl">
      <div class="top">
        <div class="nm">${esc(p.name)} ${d != null ? `<span class="tag ${cls(d)}">${scoreName(s, X.par)}</span>` : ''}<span class="tot num">${t.n ? `${t.s} (${tp(t.tp)})` : ''}</span></div>
        <div class="stepper">
          <button data-act="st" data-pid="${p.id}" data-d="-1" aria-label="${esc(p.name)} 한 타 빼기">−</button>
          <button class="vbtn" data-act="st" data-pid="${p.id}" data-d="0" aria-label="${esc(p.name)} 파로 입력">${vDisp}</button>
          <button data-act="st" data-pid="${p.id}" data-d="1" aria-label="${esc(p.name)} 한 타 더하기">+</button>
        </div>
      </div>
      ${showDetail ? `<div class="detail">
        <div class="grp"><span>퍼트</span>${[0, 1, 2, 3, 4].map(v => `<button class="mini ${e.p === v ? 'on' : ''}" data-act="pt" data-pid="${p.id}" data-v="${v}">${v === 4 ? '4+' : v}</button>`).join('')}</div>
        ${X.par > 3 ? `<div class="grp"><span>티샷</span>${[['L', '좌'], ['C', 'FW'], ['R', '우']].map(([k, l]) => `<button class="mini ${e.fw === k ? 'on' : ''}" data-act="fw" data-pid="${p.id}" data-v="${k}">${l}</button>`).join('')}</div>` : ''}
        <div class="grp"><button class="mini ${e.bk ? 'on' : ''}" data-act="bk" data-pid="${p.id}">벙커</button>
          <button class="mini warn ${e.pen ? 'on' : ''}" data-act="pen" data-pid="${p.id}">벌타${e.pen ? ' ' + e.pen : ''}</button>
          ${e.pen ? `<button class="mini" data-act="penDown" data-pid="${p.id}" aria-label="벌타 하나 빼기">−</button>` : ''}
          ${s != null ? `<button class="mini" data-act="clearScore" data-pid="${p.id}">지우기</button>` : ''}</div>
      </div>` : ''}
    </div>`;
  }).join('');
  const sp = (r.special || {})[h] || {}, specials = [];
  if (B.near.on && X.par === 3) specials.push(['near', '니어']);
  if (B.long.on && X.par === 5) specials.push(['long', '롱기']);
  const last = h === N - 1;
  return `<div id="swipeArea" class="stack">
    ${holeHead(r)}
    ${db.settings.gps && ref && hasMap(ref.H) ? `<div class="card" id="gpsPanel" data-mini="1"></div>` : !db.settings.gps ? `<button class="card row" data-act="gpsOn" style="text-align:left;width:100%">${svg(ICON.pin, 20)}<span style="flex:1"><b>GPS 거리 켜기</b><br><small class="muted">그린·해저드까지 거리를 보여줘요</small></span></button>` : ''}
    ${strat || (note && note.text) ? `<details class="card"><summary><b>공략 · 내 노트</b></summary><div class="stack" style="margin-top:8px">
      ${note && note.text ? `<p class="notebox">${esc(note.text)}</p>` : ''}${strat ? strat.slice(0, 4).map(l => `<p class="small">• ${esc(l)}</p>`).join('') : ''}
      <a class="small" href="#/hole/${r.courseId}/${course(r.courseId).subs.findIndex(s => s.id === X.subId)}/${X.idx}">홀 공략 전체 보기 ›</a></div></details>` : ''}
    ${anyBet(B) ? `<div class="row card" style="padding:8px 12px"><span>${m > 1 ? `<span class="tag x2">배판 ×2</span> <small class="muted">${esc(bets.why[h].join(', '))}</small>` : '<small class="muted">이번 홀 기본 금액</small>'}</span>
      <button class="btn ghost sm" data-act="toggleMult">${m > 1 ? '배판 해제' : '배판으로'}</button></div>` : ''}
    ${players}
    ${specials.length ? `<div class="card stack">${specials.map(([k, l]) => `<span class="small muted">${l}</span><div class="chips">${r.players.map(p => `<button class="chip ${sp[k] === p.id ? 'on' : ''}" data-act="special" data-k="${k}" data-pid="${p.id}">${esc(p.name)}</button>`).join('')}</div>`).join('')}</div>` : ''}
  </div>
  <div class="grid2">
    <button class="btn ghost" data-act="hole" data-i="${h - 1}" data-swipe="prev" ${h === 0 ? 'disabled' : ''}>← ${h > 0 ? r.holes[h - 1].no + '번' : ''}</button>
    ${last ? (r.finished ? `<button class="btn" data-act="go" data-h="#/play/${r.id}/settle">정산 보기</button>` : `<button class="btn flag" data-act="finish" data-id="${r.id}">라운드 종료</button>`)
      : `<button class="btn" data-act="hole" data-i="${h + 1}" data-swipe="next">${r.holes[h + 1].no}번 홀 →</button>`}
  </div>`;
}

// ---------- 거리 (GPS) ----------
function vGps(r) {
  const ref = roundHoleRef(r, r.cur);
  if (!db.settings.gps) return `${holeHead(r)}<div class="card stack"><p>GPS 거리가 꺼져 있어요.</p><button class="btn" data-act="gpsOn">GPS 켜기</button></div>`;
  const noMap = !ref || !holeGeo(ref.H).green;
  return `${holeHead(r)}
    ${noMap ? `<div class="card stack"><p>이 홀은 그린 위치가 없어서 거리를 계산할 수 없어요.</p>
      <div class="grid2"><button class="btn ghost sm" data-act="greenHere">지금 여기가 그린</button><a class="btn sm" href="#/edit/${r.courseId}/${course(r.courseId).subs.findIndex(s => s.id === r.holes[r.cur].subId)}/${r.holes[r.cur].idx}">편집기에서 찍기</a></div></div>` : ''}
    <div class="card" id="gpsPanel"></div>
    <div id="map" class="map" style="height:44vh"></div>
    <div class="grid3">
      <button class="btn ghost sm ${state.mapMode === 'pin' ? 'flag' : ''}" data-act="mapPin">${state.mapMode === 'pin' ? '핀 탭하세요' : '오늘 핀 찍기'}</button>
      <button class="btn ghost sm" data-act="mapClear">측정 지우기</button>
      <button class="btn ghost sm" data-act="mapMe">내 위치</button>
    </div>
    ${state.shot ? `<button class="btn flag block" data-act="shotEnd">샷 도착 · <span id="shotDist" class="num">0</span>${uLabel()} <small>(${esc(state.shot.club || '클럽 나중에')})</small></button>`
      : `<button class="btn block" data-act="shotStart">샷 측정 시작 (친 자리에서 누르기)</button>`}
    <p class="small muted">지도를 탭하면 그 지점까지와 그 지점에서 핀까지 거리가 나와요. 위성 사진 © Esri.</p>`;
}
function renderGpsPanel() {
  const el = $('#gpsPanel'); if (!el) return;
  const [, rid] = route(); const r = rnd(rid); if (!r) return;
  const ref = roundHoleRef(r, r.cur); if (!ref) { el.innerHTML = ''; return; }
  const H = ref.H, g = holeGeo(H); if (!g.green) { el.innerHTML = '<small class="muted">그린 위치가 없어요</small>'; return; }
  const P = G.pos, mini = el.dataset.mini;
  const pin = (r.pins || {})[r.cur];
  const accTxt = G.err ? G.err : G.acc != null ? `GPS ±${G.acc}m` : 'GPS 찾는 중';
  if (!P) { el.innerHTML = `<div class="row"><span class="muted">그린까지 거리</span><small class="muted" id="gpsAcc">${esc(accTxt)}</small></div><p class="small muted">위치를 찾고 있어요. 처음에는 10~20초 걸릴 수 있어요.</p>`; return; }
  const dC = distM(P, g.green), dF = distM(P, g.front), dB = distM(P, g.back), dP = pin ? distM(P, pin) : null;
  const main = dP ?? dC;
  if (dC > 1500) { el.innerHTML = `<div class="row"><span class="muted">그린까지</span><small class="muted">${esc(accTxt)}</small></div><p class="small">골프장에서 멀리 있어요 (${(dC / 1000).toFixed(1)}km). 코스에 도착하면 거리가 나와요.</p>`; return; }
  // 고저차: 내 위치 고도는 비동기로 받아와요
  let el2 = null;
  if (state.meElev && distM(state.meElev.at, P) < 20 && H.elev) el2 = H.elev.green - state.meElev.v;
  else if (H.elev && g.tee && distM(P, g.tee) < 25) el2 = elevDiff(H);
  if (H.elev && (!state.meElev || distM(state.meElev.at, P) >= 20) && !state.elevBusy) {
    state.elevBusy = true;
    elevAt(P).then(v => { state.meElev = { at: { ...P }, v }; }).catch(() => {}).finally(() => { state.elevBusy = false; });
  }
  const c = course(r.courseId);
  if (!state.wx && !state.wxBusy && (c.loc || P)) {
    state.wxBusy = true;
    weatherAt(c.loc || P).then(w => { state.wx = w; renderGpsPanel(); }).catch(() => {}).finally(() => { state.wxBusy = false; });
  }
  const wind = windEffect(state.wx, bearing(P, pin || g.green), main);
  const pl = playsLike(main, el2, wind);
  const rec = recommendClub(pl, !!(g.tee && distM(P, g.tee) < 30));
  const say = `${pin ? '핀' : '그린 중앙'}까지 ${dfmt(main)}${unit() === 'yd' ? '야드' : '미터'}. 앞 ${dfmt(dF)}, 뒤 ${dfmt(dB)}. ${Math.abs(pl - main) >= 3 ? `플레이 거리 ${dfmt(pl)}. ` : ''}${rec ? '추천 ' + rec.club : ''}`;
  state.say = say;
  if (mini) {
    el.innerHTML = `<div class="gpsmini"><div><small class="muted">${pin ? '핀' : '그린 중앙'}</small><div class="d">${dfmt(main)}<small>${uLabel()}</small></div></div>
      <div class="num fb"><span>앞 <b>${dfmt(dF)}</b></span><span>뒤 <b>${dfmt(dB)}</b></span></div>
      <div style="text-align:right"><small class="muted" id="gpsAcc">${esc(accTxt)}</small><br><small>${Math.abs(pl - main) >= 3 ? `플레이 ${dfmt(pl)} · ` : ''}${rec ? esc(rec.club) : ''}</small></div></div>
      ${state.shot ? `<button class="btn flag sm block" data-act="shotEnd" style="margin-top:8px">샷 도착 · <span id="shotDist" class="num">${dfmt(distM(state.shot.start, P))}</span>${uLabel()}</button>` : ''}`;
    return;
  }
  const hz = hazardsFrom(H, P, g).slice(0, 6);
  el.innerHTML = `<div class="row"><small class="muted">${pin ? '오늘 핀' : '그린 중앙'}</small><small class="muted" id="gpsAcc">${esc(accTxt)}</small></div>
    <div class="row"><span class="d big-d num">${dfmt(main)}<small>${uLabel()}</small></span>
      <span style="text-align:right"><small class="muted">플레이 거리</small><br><b class="num" style="font-size:1.8em;color:var(--flag)">${dfmt(pl)}</b></span></div>
    <div class="row num fb"><span>앞 <b>${dfmt(dF)}</b></span><span>중앙 <b>${dfmt(dC)}</b></span><span>뒤 <b>${dfmt(dB)}</b></span></div>
    <div class="sep"></div>
    <div class="row small"><span class="muted">고저차</span><span>${el2 != null ? `${sgn(el2)}m ${el2 > 0 ? '오르막' : el2 < 0 ? '내리막' : ''}` : '–'}</span></div>
    <div class="row small"><span class="muted">바람</span><span>${state.wx ? `${compass(state.wx.dir)}풍 ${state.wx.speed.toFixed(1)}m/s${wind ? ` · ${wind.head > 0.5 ? '맞바람' : wind.head < -0.5 ? '뒷바람' : '옆바람'} ${sgn(wind.adj)}m` : ''}` : '받는 중'}</span></div>
    ${state.wx ? `<div class="row small"><span class="muted">날씨</span><span>${wxText(state.wx.code)} ${Math.round(state.wx.temp)}°C</span></div>` : ''}
    <div class="row small"><span class="muted">추천 클럽</span><b>${rec ? `${esc(rec.club)} (${rec.est ? '추정 ' : ''}${dfmt(rec.avg)}${uLabel()})` : '–'}</b></div>
    ${state.mapTarget ? `<div class="row small"><span class="muted">탭한 지점</span><span class="num">나 → ${dfmt(distM(P, state.mapTarget))} · → 핀 ${dfmt(distM(state.mapTarget, pin || g.green))}</span></div>` : ''}
    ${hz.length ? `<div class="sep"></div><div class="tbl-wrap"><table class="bd num"><tr><th>앞의 위험</th><th>방향</th><th>닿는</th><th>넘기는</th></tr>${hz.map(z => `<tr><td>${z.name}</td><td>${z.side}</td><td>${dfmt(z.reach)}</td><td>${z.carry != null ? dfmt(z.carry) : '–'}</td></tr>`).join('')}</table></div>` : ''}
    ${db.settings.voice ? `<button class="btn ghost sm block" data-act="speak" style="margin-top:8px">${svg(ICON.sound, 16)} 읽어주기</button>` : ''}`;
}

// ---------- 그린 ----------
function vGreenPane(r) {
  const ref = roundHoleRef(r, r.cur);
  const key = ref ? ref.key : 'free';
  const gs = state.green[key] ||= { mode: 'ball', steps: null, ball: null, read: null };
  const H = ref && ref.H;
  const pin = (r.pins || {})[r.cur] || (H && holeGeo(H).green) || null;
  const hasGreen = H && holeGeo(H).green;
  return `${holeHead(r)}${greenBody(gs, H, pin, key, hasGreen, r)}`;
}
function greenBody(gs, H, pin, key, hasGreen, r) {
  const dDiagram = gs.ball && pin ? distM(gs.ball, pin) : null;
  const d = gs.steps ? gs.steps * db.settings.stride : dDiagram;
  const reads = db.reads[key] || [];
  const rd = gs.read;
  const res = rd ? puttRead(rd.b, rd.g, d, db.settings.stimp) : null;
  return `
    ${hasGreen ? `<div class="card stack">
      <div class="row"><span class="small muted">그린을 탭해서 찍기</span><div class="seg" style="width:180px">
        <button class="${gs.mode === 'ball' ? 'on' : ''}" data-act="greenMode" data-v="ball">내 공</button><button class="${gs.mode === 'pin' ? 'on' : ''}" data-act="greenMode" data-v="pin">핀</button></div></div>
      <div class="greenwrap">${greenSVG(H, { pin, ball: gs.ball, reads, read: rd && rd.dir != null ? rd : null })}</div>
      <p class="small muted">흰 화살표는 전에 잰 경사(내려가는 방향), 빨간 화살표는 방금 잰 경사예요.</p></div>` : ''}
    <div class="card stack">
      <div class="row"><h3>홀까지 거리</h3><b class="num" style="font-size:1.5em">${d != null ? `${round1(d)}m` : '–'}</b></div>
      <div class="row"><span class="small">걸음 수 <small class="muted">(보폭 ${db.settings.stride}m)</small></span>
        <div class="stepper sm"><button data-act="steps" data-d="-1" aria-label="한 걸음 빼기">−</button><span class="v num">${gs.steps || 0}</span><button data-act="steps" data-d="1" aria-label="한 걸음 더하기">+</button></div></div>
      <p class="small muted">${gs.steps ? '걸음 수로 계산했어요.' : dDiagram != null ? '그린 도면에서 찍은 위치로 계산했어요(오차 1~3m). 걸음 수를 넣으면 더 정확해요.' : '공에서 홀까지 걸으며 걸음 수를 세어 넣으세요.'} GPS는 오차가 커서 그린 위에서는 쓰지 않아요.</p>
    </div>
    <div class="card stack">
      <div class="row"><h3>경사 측정</h3><a class="small" href="#/help/green">방법 ›</a></div>
      <p class="small">공 바로 옆에 폰을 <b>화면이 위로, 윗부분이 홀을 향하게</b> 내려놓고 측정을 누르세요.</p>
      <button class="btn block" data-act="levelOpen" data-key="${key}">경사 측정하기</button>
      ${res ? `<div class="readres">
        <div class="row"><span class="muted">높은 쪽</span><b style="color:var(--red)">${res.high}</b></div>
        <div class="row"><span class="muted">경사</span><b class="num">${res.total.toFixed(1)}% <small class="muted">(${res.along >= 0 ? '오르막' : '내리막'} ${Math.abs(res.along).toFixed(1)}%, 좌우 ${Math.abs(res.side).toFixed(1)}%)</small></b></div>
        ${res.aim ? `<div class="row"><span class="muted">겨냥</span><b>${res.aim}</b></div><div class="row"><span class="muted">세기</span><b>${res.speed}</b></div>` : '<p class="small muted">홀까지 거리를 넣으면 겨냥점과 세기도 알려줘요.</p>'}
        <p class="small muted">스팀프 ${db.settings.stimp} 기준 참고값이에요. 정식 대회에서는 규칙 4.3에 따라 쓸 수 없어요.</p></div>` : ''}
    </div>
    ${r && db.settings.meId && r.scores[db.settings.meId] ? `<div class="card row"><span>내 퍼트 수 기록</span><div class="chips">${[1, 2, 3, 4].map(v => `<button class="mini ${E(r, db.settings.meId, r.cur)?.p === v ? 'on' : ''}" data-act="pt" data-pid="${db.settings.meId}" data-v="${v}">${v}</button>`).join('')}</div></div>` : ''}`;
}
function vLevel() {
  const gs = state.green.free ||= { mode: 'ball', steps: null, ball: null, read: null };
  return bar('그린 경사 측정', '연습 그린 · 라운드 밖에서', '', '#/home', 'green') + `<div class="page">${greenBody(gs, null, null, 'free', false, null)}
    <button class="btn ghost" data-act="calibrate">기울기 센서 보정</button></div>`;
}
function levelSheet(key, calib) {
  state.levelIn = 'sheet'; state.levelRaw = !!calib;
  openSheet(`<h2>${calib ? `센서 보정 ${calib}/2` : '경사 측정'}</h2>
    <p class="small">${calib === 1 ? '평평하고 단단한 바닥(책상, 방바닥)에 폰을 화면이 위로 오게 내려놓으세요.' : calib === 2 ? '같은 자리에서 폰을 <b>180도 돌려</b> 다시 내려놓으세요.' : '공 옆에 폰을 화면이 위로, 윗부분이 홀을 향하게 내려놓고 손을 떼세요. 값이 "안정"이 되면 읽으세요.'}</p>
    <div id="level" class="level"><div class="ring"></div><div class="ring r2"></div><div id="bubble" class="bubble"></div><span class="lvl-top">홀 쪽 ↑</span></div>
    <p id="levelTxt" class="small" style="text-align:center">센서를 켜는 중…</p>
    <div class="grid2"><button class="btn ghost" data-act="closeSheet">취소</button><button class="btn" data-act="${calib ? 'calibStep' : 'levelRead'}" data-key="${key || ''}" data-step="${calib || ''}">${calib ? '이 값 저장' : '이 값으로 읽기'}</button></div>`);
  levelStart().catch(e => { const t = $('#levelTxt'); if (t) t.textContent = e.message; });
}

// ---------- 스코어카드 ----------
function vCard(r) {
  const N = r.holes.length, halves = N > 9 ? [[0, 9, 'OUT'], [9, N, 'IN']] : [[0, N, 'OUT']];
  const ranks = hcpRanks(r), net = state.cardMode === 'net';
  const tables = halves.map(([a, b, lab]) => `<div class="tbl-wrap"><table class="sc">
    <tr><th>${esc(r.holes[a].sub)}</th>${r.holes.slice(a, b).map(H => `<th>${H.no}</th>`).join('')}<th class="tot">${lab}</th></tr>
    <tr><th>파</th>${r.holes.slice(a, b).map(H => `<th>${H.par}</th>`).join('')}<th class="tot">${parSum(r, a, b)}</th></tr>
    ${r.players.map(p => { const t = tot(r, p.id, a, b);
      return `<tr><td>${esc(p.name)}</td>${r.holes.slice(a, b).map((H, k) => {
        const h = a + k, s = S(r, p.id, h), hs = net ? hcpStrokes(r, p, h, ranks) : 0;
        return `<td><button data-act="cardCell" data-i="${h}" aria-label="${esc(p.name)} ${H.no}번 홀">${s == null ? '<span class="s none">·</span>' : `<span class="s ${cls(s - H.par)}">${s}</span>`}${hs ? `<div class="dots">${'•'.repeat(hs)}</div>` : ''}</button></td>`;
      }).join('')}<td class="tot">${t.n ? t.s : ''}</td></tr>`; }).join('')}
  </table></div>`).join('<div class="sep"></div>');
  const board = r.players.map(p => { const t = tot(r, p.id), ph = playingHcp(r, p); return { p, t, net: t.s - (t.n === N ? ph : Math.round(ph * t.n / N)) }; })
    .sort((x, y) => (x.t.n === 0) - (y.t.n === 0) || (net ? x.net - y.net : x.t.tp - y.t.tp));
  return `<div class="seg"><button class="${!net ? 'on' : ''}" data-act="cardMode" data-v="gross">그로스</button><button class="${net ? 'on' : ''}" data-act="cardMode" data-v="net">네트 (핸디캡)</button></div>
    <div class="card" style="padding:8px 10px">${tables}<p class="small muted" style="margin-top:6px">칸을 누르면 그 홀로 가요.${net ? ' 점(•)은 핸디캡으로 받는 타수예요.' : ''}</p></div>
    <div class="card"><div class="row"><h3>순위</h3><small class="muted">${net ? '네트' : '그로스'}</small></div>
      ${board.map((x, i) => `<div class="rank"><span class="r">${i + 1}</span><span><b>${esc(x.p.name)}</b> <small class="muted">HCP ${x.p.hcp || 0}</small></span>
        <span class="num muted">${x.t.n ? tp(x.t.tp) : ''}</span><b class="num" style="font-size:1.3em">${x.t.n ? (net ? x.net : x.t.s) : '–'}</b></div>`).join('')}</div>
    <div class="card"><h3>이번 라운드 기록</h3><div class="tbl-wrap"><table class="bd num"><tr><th>이름</th><th>퍼트</th><th>FW</th><th>GIR</th><th>버디+</th><th>벌타</th></tr>
      ${r.players.map(p => { const st = computeStats([r], p.id), f = v => v == null ? '–' : Math.round(v) + '%';
        return `<tr><td>${esc(p.name)}</td><td>${st.puttHoles ? st.putts : '–'}</td><td>${f(st.fwPct)}</td><td>${f(st.girPct)}</td><td>${st.dist.bd + st.dist.eg}</td><td>${st.pen}</td></tr>`; }).join('')}</table></div></div>
    <div class="grid2"><button class="btn ghost" data-act="shareImg" data-id="${r.id}">이미지로 공유</button><button class="btn ghost" data-act="shareText" data-id="${r.id}">텍스트 공유</button></div>`;
}

// ---------- 정산 ----------
function vSettle(r) {
  const B = { ...defaultBets(), ...(r.bets || {}) };
  if (r.players.length < 2) return `<div class="card empty">혼자 치는 라운드라 정산할 내기가 없어요.</div>`;
  if (!anyBet(B)) return `<div class="card empty stack"><p>이 라운드에 설정한 내기가 없어요.</p><button class="btn" data-act="betSheet" data-id="${r.id}">내기 설정하기</button></div>`;
  const res = computeBets(r), tr = transfers(res.net);
  const name = id => esc(r.players.find(p => p.id === id)?.name || '?');
  const cols = [['stroke', '스트로크'], ['skins', '스킨스'], ['vegas', '베가스'], ['bonus', '버디'], ['near', '니어'], ['long', '롱기']].filter(([k]) => (k === 'bonus' ? B.birdie.on : B[k].on));
  const multHoles = r.holes.filter((_, i) => res.mult[i] > 1).map(H => H.no);
  return `<div class="card stack">
      <div class="row"><h3>결과</h3><small class="muted">${res.done}/${r.holes.length}홀 반영${r.finished ? '' : ' · 진행 중'}</small></div>
      ${r.players.slice().sort((a, b) => res.net[b.id] - res.net[a.id]).map(p => `<div class="row"><b>${esc(p.name)}</b><span class="money ${res.net[p.id] > 0 ? 'pos' : res.net[p.id] < 0 ? 'neg' : ''}">${won(res.net[p.id])}</span></div>`).join('')}
    </div>
    <div class="card"><div class="row"><h3>송금 안내</h3><small class="muted">${tr.length ? tr.length + '번이면 끝나요' : ''}</small></div>
      ${tr.length ? tr.map(t => `<div class="transfer"><span>${name(t.from)} → <b>${name(t.to)}</b></span><span class="money">${wonAbs(t.amt)}</span></div>`).join('') : '<p class="small muted" style="padding:8px 0">주고받을 돈이 없어요.</p>'}</div>
    <div class="card stack"><h3>게임별 상세</h3>
      <div class="tbl-wrap"><table class="bd num"><tr><th>이름</th>${cols.map(([, l]) => `<th>${l}</th>`).join('')}<th>합계</th></tr>
      ${r.players.map(p => `<tr><td>${esc(p.name)}</td>${cols.map(([k]) => `<td>${won(res.parts[k][p.id])}</td>`).join('')}<td><b>${won(res.net[p.id])}</b></td></tr>`).join('')}</table></div>
      ${B.skins.on ? `<div class="row small"><span class="muted">스킨 획득</span><span>${r.players.map(p => `${esc(p.name)} ${res.skins[p.id]}`).join(' · ')}</span></div>${res.carryHoles ? `<div class="row small"><span class="muted">이월 중</span><span>${res.carryHoles}홀 (${wonAbs(res.carryPot)})</span></div>` : ''}` : ''}
      ${B.dbl.on || multHoles.length ? `<div class="row small"><span class="muted">배판 적용 홀</span><span class="num">${multHoles.length ? multHoles.join(' · ') : '없음'}</span></div>` : ''}
      ${B.vegas.on && r.vegas ? `<div class="row small"><span class="muted">베가스 팀</span><span>${r.vegas.a.map(name).join('·')} vs ${r.vegas.b.map(name).join('·')}</span></div>` : ''}
    </div>
    <div class="grid2"><button class="btn ghost" data-act="betSheet" data-id="${r.id}">내기 규칙 수정</button><button class="btn" data-act="copySettle" data-id="${r.id}">정산 결과 복사</button></div>`;
}
function settleText(r) {
  const res = computeBets(r), tr = transfers(res.net);
  const name = id => r.players.find(p => p.id === id)?.name || '?';
  const lines = [`[SG골프] ${fmtDate(r.date)} ${r.courseName} (${r.subNames.join('→')})`];
  r.players.map(p => ({ p, t: tot(r, p.id) })).sort((a, b) => a.t.s - b.t.s).forEach((x, i) => lines.push(`${i + 1}. ${x.p.name} ${x.t.s}타 (${tp(x.t.tp)})`));
  if (anyBet(r.bets)) {
    lines.push('', '정산');
    r.players.slice().sort((a, b) => res.net[b.id] - res.net[a.id]).forEach(p => lines.push(`${p.name} ${won(res.net[p.id])}원`));
    if (tr.length) { lines.push('', '송금'); tr.forEach(t => lines.push(`${name(t.from)} → ${name(t.to)} ${wonAbs(t.amt)}`)); }
  }
  return lines.join('\n');
}
function cardCanvas(r) {
  const P = r.players, N = r.holes.length, halves = N > 9 ? [[0, 9, 'OUT'], [9, N, 'IN']] : [[0, N, 'OUT']];
  const W = 1080, pad = 36, nameW = 150, totW = 90, rowH = 58, colW = (W - pad * 2 - nameW - totW) / 9;
  const H = 170 + halves.length * ((P.length + 2) * rowH + 24) + 60 + P.length * 56 + 60;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const num = s => `600 ${s}px "Barlow Condensed","Arial Narrow",sans-serif`, kr = (s, w = 600) => `${w} ${s}px "IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
  g.fillStyle = '#F6F8F4'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1E5B3F'; g.fillRect(0, 0, W, 140);
  g.fillStyle = '#fff'; g.font = kr(44, 700); g.textBaseline = 'middle'; g.fillText(r.courseName, pad, 55);
  g.font = kr(24, 500); g.globalAlpha = .85; g.fillText(`${fmtDateLong(r.date)} · ${r.subNames.join(' → ')}`, pad, 105); g.globalAlpha = 1;
  g.font = num(28); g.textAlign = 'right'; g.fillStyle = '#E2A516'; g.fillText('SG GOLF', W - pad, 55); g.textAlign = 'left';
  let y = 170; const cx = i => pad + nameW + colW * i + colW / 2;
  halves.forEach(([a, b, lab]) => {
    [['홀', r.holes.slice(a, b).map(h => h.no), lab], ['파', r.holes.slice(a, b).map(h => h.par), parSum(r, a, b)]].forEach(([l, vals, t], ri) => {
      g.fillStyle = ri === 0 ? '#E3EBE4' : '#F6F8F4'; g.fillRect(pad, y, W - pad * 2, rowH);
      g.fillStyle = '#5B6B61'; g.font = kr(22); g.textAlign = 'left'; g.fillText(l, pad + 12, y + rowH / 2);
      g.textAlign = 'center'; g.font = num(28); vals.forEach((v, i) => g.fillText(String(v), cx(i), y + rowH / 2));
      g.fillText(String(t), W - pad - totW / 2, y + rowH / 2); y += rowH;
    });
    P.forEach(p => {
      g.strokeStyle = '#D5DDD6'; g.lineWidth = 1; g.beginPath(); g.moveTo(pad, y + rowH); g.lineTo(W - pad, y + rowH); g.stroke();
      g.fillStyle = '#13241B'; g.font = kr(24, 700); g.textAlign = 'left'; g.fillText(p.name.slice(0, 5), pad + 12, y + rowH / 2);
      g.textAlign = 'center';
      for (let h = a; h < b; h++) {
        const s = S(r, p.id, h); if (s == null) continue;
        const x = cx(h - a), yy = y + rowH / 2, d = s - r.holes[h].par, col = d < 0 ? '#C8412B' : d > 0 ? '#2B63B8' : '#13241B';
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.5;
        if (d < 0) { g.beginPath(); g.arc(x, yy, 20, 0, Math.PI * 2); g.stroke(); if (d <= -2) { g.beginPath(); g.arc(x, yy, 25, 0, Math.PI * 2); g.stroke(); } }
        if (d > 0) { g.strokeRect(x - 19, yy - 19, 38, 38); if (d >= 2) g.strokeRect(x - 24, yy - 24, 48, 48); }
        g.font = num(30); g.fillText(String(s), x, yy + 1);
      }
      const t = tot(r, p.id, a, b);
      g.fillStyle = '#13241B'; g.font = num(32); g.fillText(t.n ? String(t.s) : '', W - pad - totW / 2, y + rowH / 2);
      y += rowH;
    });
    y += 24;
  });
  y += 20; g.textAlign = 'left'; g.fillStyle = '#13241B'; g.font = kr(28, 700); g.fillText('순위', pad, y); y += 46;
  P.map(p => ({ p, t: tot(r, p.id) })).sort((a, b) => a.t.s - b.t.s).forEach((x, i) => {
    g.font = num(34); g.fillStyle = i === 0 ? '#E2A516' : '#5B6B61'; g.fillText(String(i + 1), pad, y);
    g.fillStyle = '#13241B'; g.font = kr(26, 600); g.fillText(x.p.name, pad + 50, y);
    g.textAlign = 'right'; g.font = num(36); g.fillText(`${x.t.s}  (${tp(x.t.tp)})`, W - pad, y); g.textAlign = 'left'; y += 56;
  });
  return c;
}
