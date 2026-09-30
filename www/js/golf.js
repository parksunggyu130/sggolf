'use strict';
/* 골프 계산: 스코어 · 내기 · 통계 · 클럽 · 홀 도면 · 자동 공략 · 퍼트 */

// ---------- 스코어 ----------
const E = (r, pid, h) => (r.scores[pid] || [])[h] || null;
const S = (r, pid, h) => { const e = E(r, pid, h); return e && e.s != null ? e.s : null; };
function tot(r, pid, from = 0, to = r.holes.length) {
  let s = 0, n = 0, par = 0, p = 0, pn = 0;
  for (let h = from; h < to; h++) {
    const e = E(r, pid, h);
    if (e && e.s != null) { s += e.s; n++; par += r.holes[h].par; if (e.p != null) { p += e.p; pn++; } }
  }
  return { s, n, par, tp: s - par, putts: p, pn };
}
const parSum = (r, from = 0, to = r.holes.length) => sum(r.holes.slice(from, to).map(h => h.par));
const cls = d => d <= -2 ? 'eg' : d === -1 ? 'bd' : d === 0 ? '' : d === 1 ? 'bg' : 'db';
function scoreName(s, par) {
  const d = s - par;
  if (s === 1) return '홀인원';
  if (d <= -3) return '알바트로스';
  if (d === -2) return '이글';
  if (d === -1) return '버디';
  if (d === 0) return '파';
  if (d === 1) return '보기';
  if (s >= par * 2) return '양파';
  if (d === 2) return '더블';
  if (d === 3) return '트리플';
  return '+' + d;
}
function hcpRanks(r) {
  const idx = r.holes.map((_, i) => i);
  idx.sort((a, b) => ((r.holes[a].hdcp ?? 99) - (r.holes[b].hdcp ?? 99)) || a - b);
  const rank = []; idx.forEach((h, k) => { rank[h] = k + 1; });
  return rank;
}
const playingHcp = (r, p) => Math.round((p.hcp || 0) * r.holes.length / 18);
function hcpStrokes(r, p, h, ranks) {
  const N = r.holes.length, ph = playingHcp(r, p);
  if (ph <= 0) return 0;
  return Math.floor(ph / N) + (ranks[h] <= ph % N ? 1 : 0);
}
const isGIR = (e, par) => e && e.s != null && e.p != null && (e.s - e.p) <= par - 2;

// ---------- 내기 ----------
function defaultBets() {
  return {
    hcp: false, cap: true,
    stroke: { on: false, rate: 1000 },
    skins: { on: false, rate: 5000, carry: true },
    vegas: { on: false, rate: 1000, flip: true },
    birdie: { on: false, amt: 5000 },
    near: { on: false, amt: 10000 },
    long: { on: false, amt: 10000 },
    dbl: { on: false, birdie: true, tie: true, triple: false },
  };
}
const anyBet = b => !!b && ['stroke', 'skins', 'vegas', 'birdie', 'near', 'long'].some(k => b[k] && b[k].on);
function computeBets(r) {
  const B = { ...defaultBets(), ...(r.bets || {}) };
  const P = r.players, n = P.length, N = r.holes.length, ids = P.map(p => p.id);
  const z = () => Object.fromEntries(ids.map(i => [i, 0]));
  const parts = { stroke: z(), skins: z(), vegas: z(), bonus: z(), near: z(), long: z() };
  const res = { parts, mult: [], why: [], skins: z(), carryHoles: 0, carryPot: 0, done: 0, net: z() };
  const ranks = hcpRanks(r);
  const vegasOk = B.vegas.on && n === 4 && r.vegas && r.vegas.a?.length === 2 && r.vegas.b?.length === 2;
  let pot = 0, potHoles = 0, prev = [];
  for (let h = 0; h < N; h++) {
    const par = r.holes[h].par;
    const auto = B.dbl.on && prev.length > 0;
    const ov = r.mults ? r.mults[h] : undefined;
    const m = (ov === undefined || ov === null ? auto : ov) ? 2 : 1;
    res.mult[h] = m;
    res.why[h] = ov === true ? ['수동'] : ov === false ? [] : (auto ? prev : []);
    const gross = ids.map(id => S(r, id, h));
    if (n < 2 || gross.some(v => v == null)) { prev = []; continue; }
    res.done++;
    const bs = P.map((p, i) => {
      let v = gross[i];
      if (B.cap) v = Math.min(v, par * 2);
      if (B.hcp) v -= hcpStrokes(r, p, h, ranks);
      return v;
    });
    if (B.stroke.on) { const all = sum(bs); ids.forEach((id, i) => { parts.stroke[id] += (all - n * bs[i]) * B.stroke.rate * m; }); }
    if (B.skins.on) {
      pot += B.skins.rate * m; potHoles++;
      const mn = Math.min(...bs);
      if (bs.filter(v => v === mn).length === 1) {
        const wi = bs.indexOf(mn);
        ids.forEach((id, i) => { parts.skins[id] += i === wi ? pot * (n - 1) : -pot; });
        res.skins[ids[wi]] += potHoles; pot = 0; potHoles = 0;
      } else if (!B.skins.carry) { pot = 0; potHoles = 0; }
    }
    if (vegasOk) {
      const ix = id => ids.indexOf(id);
      const A = r.vegas.a.map(ix), Bt = r.vegas.b.map(ix);
      if (A.every(i => i >= 0) && Bt.every(i => i >= 0)) {
        const birdie = team => team.some(i => gross[i] < par);
        const num = (team, flip) => {
          let [lo, hi] = team.map(i => bs[i]).sort((x, y) => x - y);
          const big = hi >= 10;
          if (flip) [lo, hi] = [hi, lo];
          return big ? lo * 100 + hi : lo * 10 + hi;
        };
        const d = (num(Bt, B.vegas.flip && birdie(A)) - num(A, B.vegas.flip && birdie(Bt))) * B.vegas.rate * m;
        A.forEach(i => { parts.vegas[ids[i]] += d; }); Bt.forEach(i => { parts.vegas[ids[i]] -= d; });
      }
    }
    if (B.birdie.on) gross.forEach((g, i) => {
      const d = g - par;
      if (d <= -1) { const amt = B.birdie.amt * (d <= -2 ? 2 : 1); ids.forEach((id, j) => { parts.bonus[id] += j === i ? amt * (n - 1) : -amt; }); }
    });
    const sp = (r.special || {})[h] || {};
    ['near', 'long'].forEach(k => {
      if (B[k].on && sp[k] && ids.includes(sp[k])) ids.forEach(id => { parts[k][id] += id === sp[k] ? B[k].amt * (n - 1) : -B[k].amt; });
    });
    prev = [];
    if (B.dbl.on) {
      if (B.dbl.birdie && gross.some(g => g < par)) prev.push('버디');
      if (B.dbl.tie && n >= 3) { const c = {}; bs.forEach(v => { c[v] = (c[v] || 0) + 1; }); if (Math.max(...Object.values(c)) >= 3) prev.push('3인 동타'); }
      if (B.dbl.triple && gross.some(g => g - par >= 3)) prev.push('트리플');
    }
  }
  res.carryPot = pot; res.carryHoles = potHoles;
  Object.values(parts).forEach(pt => ids.forEach(id => { res.net[id] += pt[id]; }));
  return res;
}
function transfers(net) {
  const cr = [], dr = [];
  Object.entries(net).forEach(([id, v]) => { v = Math.round(v); if (v > 0) cr.push({ id, v }); else if (v < 0) dr.push({ id, v: -v }); });
  cr.sort((a, b) => b.v - a.v); dr.sort((a, b) => b.v - a.v);
  const out = [];
  while (cr.length && dr.length) {
    const c = cr[0], d = dr[0], x = Math.min(c.v, d.v);
    out.push({ from: d.id, to: c.id, amt: x });
    c.v -= x; d.v -= x;
    if (c.v <= 0) cr.shift();
    if (d.v <= 0) dr.shift();
  }
  return out;
}

// ---------- 통계 ----------
function computeStats(rounds, pid) {
  const st = {
    rounds: 0, full: [], holes: 0, byPar: { 3: [], 4: [], 5: [] }, dist: { eg: 0, bd: 0, par: 0, bg: 0, db: 0, tr: 0 },
    puttHoles: 0, putts: 0, three: 0, girN: 0, gir: 0, fwN: 0, fw: 0, fwL: 0, fwR: 0, scrN: 0, scr: 0, bkN: 0, bkSave: 0, pen: 0,
  };
  rounds.forEach(r => {
    const arr = r.scores[pid]; if (!arr) return;
    st.rounds++;
    const t = tot(r, pid);
    if (r.holes.length === 18 && t.n === 18) st.full.push({ date: r.date, score: t.s, tp: t.tp, par: t.par, putts: t.pn === 18 ? t.putts : null, id: r.id });
    r.holes.forEach((H, h) => {
      const e = arr[h]; if (!e || e.s == null) return;
      st.holes++; const d = e.s - H.par;
      if (st.byPar[H.par]) st.byPar[H.par].push(e.s);
      if (d <= -2) st.dist.eg++; else if (d === -1) st.dist.bd++; else if (d === 0) st.dist.par++; else if (d === 1) st.dist.bg++; else if (d === 2) st.dist.db++; else st.dist.tr++;
      if (e.p != null) {
        st.puttHoles++; st.putts += e.p; if (e.p >= 3) st.three++;
        st.girN++; const g = isGIR(e, H.par); if (g) st.gir++; else { st.scrN++; if (d <= 0) st.scr++; }
      }
      if (H.par > 3 && e.fw) { st.fwN++; if (e.fw === 'C') st.fw++; if (e.fw === 'L') st.fwL++; if (e.fw === 'R') st.fwR++; }
      if (e.bk) { st.bkN++; if (d <= 0) st.bkSave++; }
      st.pen += e.pen || 0;
    });
  });
  st.full.sort((a, b) => a.date < b.date ? -1 : 1);
  const sc = st.full.map(x => x.score);
  st.avg = avg(sc); st.best = sc.length ? Math.min(...sc) : null;
  const pr = st.full.filter(x => x.putts != null).map(x => x.putts);
  st.avgPutts = pr.length ? avg(pr) : (st.puttHoles ? st.putts / st.puttHoles * 18 : null);
  const pct = (a, b) => b ? a / b * 100 : null;
  st.girPct = pct(st.gir, st.girN); st.fwPct = pct(st.fw, st.fwN); st.scrPct = pct(st.scr, st.scrN);
  st.threePct = pct(st.three, st.puttHoles); st.bkPct = pct(st.bkSave, st.bkN);
  st.fwLPct = pct(st.fwL, st.fwN); st.fwRPct = pct(st.fwR, st.fwN);
  st.penAvg = st.rounds ? st.pen / st.rounds : null;
  st.parAvg = {}; [3, 4, 5].forEach(p => { st.parAvg[p] = avg(st.byPar[p]); });
  // 간이 핸디캡: 코스레이팅=파, 슬로프 113으로 보고 WHS 표대로 최근 20라운드 중 좋은 기록 평균
  const recent = st.full.slice(-20).map(x => x.score - x.par).sort((a, b) => a - b);
  const table = { 3: [1, -2], 4: [1, -1], 5: [1, 0], 6: [2, -1], 7: [2, 0], 8: [2, 0], 9: [3, 0], 10: [3, 0], 11: [3, 0], 12: [4, 0], 13: [4, 0], 14: [4, 0], 15: [5, 0], 16: [5, 0], 17: [6, 0], 18: [6, 0], 19: [7, 0], 20: [8, 0] };
  const t = table[recent.length];
  st.hcp = t ? Math.max(0, sum(recent.slice(0, t[0])) / t[0] + t[1]) : null;
  return st;
}
function myRounds(n) {
  const id = db.settings.meId;
  const rs = db.rounds.filter(r => r.finished && r.scores[id]).sort((a, b) => (b.date + b.startedAt) > (a.date + a.startedAt) ? 1 : -1);
  return n ? rs.slice(0, n) : rs;
}
// 같은 홀(골프장·코스·번호)을 친 내 기록
function holeHistory(key) {
  const id = db.settings.meId, out = [];
  db.rounds.forEach(r => {
    r.holes.forEach((H, h) => {
      if (hk(r.courseId, H.subId, H.idx) !== key) return;
      const e = E(r, id, h); if (!e || e.s == null) return;
      out.push({ date: r.date, rid: r.id, par: H.par, ...e });
    });
  });
  out.sort((a, b) => a.date < b.date ? 1 : -1);
  const s = out.map(x => x.s);
  const fw = out.filter(x => x.par > 3 && x.fw);
  return {
    list: out, n: out.length, avg: avg(s), best: s.length ? Math.min(...s) : null,
    fwPct: fw.length ? fw.filter(x => x.fw === 'C').length / fw.length * 100 : null,
    putts: avg(out.filter(x => x.p != null).map(x => x.p)),
    mistakes: {
      left: fw.filter(x => x.fw === 'L').length, right: fw.filter(x => x.fw === 'R').length,
      bunker: out.filter(x => x.bk).length, pen: sum(out.map(x => x.pen || 0)), three: out.filter(x => x.p >= 3).length,
    },
  };
}

// ---------- 클럽 비거리 ----------
function clubTable() {
  const m = {};
  db.shots.forEach(s => { if (s.club && s.d > 0) (m[s.club] ||= []).push(s.d); });
  const drvMeasured = m['드라이버'];
  return CLUBS.map(c => {
    const a = (m[c] || []).slice().sort((x, y) => x - y);
    if (a.length) {
      // 5개 이상이면 뒤땅·탑볼 같은 미스샷을 줄이려고 짧은 쪽 20%를 빼고 평균
      const use = a.length >= 5 ? a.slice(Math.floor(a.length * 0.2)) : a;
      return { club: c, avg: avg(use), max: a[a.length - 1], n: a.length, est: false };
    }
    const drv = drvMeasured ? avg(drvMeasured) : db.settings.driver;
    return { club: c, avg: drv * CLUB_RATIO[c], max: null, n: 0, est: true };
  });
}
const clubAvg = name => clubTable().find(c => c.club === name).avg;
// 받침 유무로 조사 고르기 (벙커가 / 해저드가 / OB가)
function josa(w, a, b) { const c = String(w).charCodeAt(String(w).length - 1); if (c < 0xAC00 || c > 0xD7A3) return w + b; return w + ((c - 0xAC00) % 28 ? a : b); }
function recommendClub(dist, fromTee) {
  if (dist == null || dist <= 0) return null;
  const asc = clubTable().filter(c => fromTee || c.club !== '드라이버').sort((a, b) => a.avg - b.avg);
  if (dist < asc[0].avg - 15) return { club: '어프로치', avg: dist, est: true };
  return asc.find(c => c.avg >= dist - 4) || asc[asc.length - 1];
}
function clubUnder(d) { // d보다 확실히 짧은 가장 긴 클럽
  const asc = clubTable().slice().sort((a, b) => a.avg - b.avg);
  let best = null; asc.forEach(c => { if (c.avg <= d) best = c; });
  return best;
}

// ---------- 홀 도면 계산 ----------
function holeGeo(H) {
  if (!H) return { tee: null, green: null };
  const tee = H.tee || (H.path && H.path[0]) || null;
  const green = H.green || (H.greenPoly && H.greenPoly.length > 2 ? centroidLL(H.greenPoly) : null) || (H.path && H.path.length > 1 ? H.path[H.path.length - 1] : null);
  if (!green) return { tee, green: null };
  let path = null;
  if (tee) {
    const mid = H.path && H.path.length > 2 ? H.path.slice(1, -1) : [];
    path = [tee, ...mid, green];
  }
  const from = path ? path[path.length - 2] : null;
  const approach = from ? bearing(from, green) : 0;
  let front, back, depth = 26;
  if (H.greenPoly && H.greenPoly.length > 2) {
    const ux = Math.sin(approach * RAD), uy = Math.cos(approach * RAD);
    const pts = []; const n = H.greenPoly.length;
    for (let i = 0; i < n; i++) {
      const a = toXY(H.greenPoly[i], green), b = toXY(H.greenPoly[(i + 1) % n], green);
      for (let k = 0; k < 6; k++) pts.push({ x: a.x + (b.x - a.x) * k / 6, y: a.y + (b.y - a.y) * k / 6 });
    }
    let mn = Infinity, mx = -Infinity;
    pts.forEach(p => { const al = p.x * ux + p.y * uy, lat = -p.x * uy + p.y * ux; if (Math.abs(lat) < 4) { mn = Math.min(mn, al); mx = Math.max(mx, al); } });
    if (mn === Infinity) pts.forEach(p => { const al = p.x * ux + p.y * uy; mn = Math.min(mn, al); mx = Math.max(mx, al); });
    front = dest(green, approach, mn); back = dest(green, approach, mx); depth = mx - mn;
  } else { front = dest(green, approach, -12); back = dest(green, approach, 12); }
  return { tee, green, path, front, back, depth, approach, len: path ? pathLen(path) : null };
}
function holeLen(H, tee) {
  const d = H.dist && tee && H.dist[tee];
  if (d) return d;
  const g = holeGeo(H);
  return g.len ? Math.round(g.len) : null;
}
function hasMap(H) { const g = holeGeo(H); return !!(g.tee && g.green); }
function courseStatus(c) {
  const holes = c.subs.flatMap(s => s.holes);
  const full = holes.filter(hasMap).length, greens = holes.filter(h => holeGeo(h).green).length;
  return { full, greens, n: holes.length };
}
// P에서 본 위험 요소 (앞쪽에 있는 것만)
function hazardsFrom(H, P, geo) {
  const g = geo.green; if (!g || !P) return [];
  const dPG = distM(P, g), brg = bearing(P, g);
  return (H.hazards || []).filter(z => z.t !== 'fairway' && z.p && z.p.length).map(z => {
    const nf = z.t === 'ob' ? { near: distToPath(P, z.p), far: null } : polyNearFar(P, z.p);
    const c = centroidLL(z.p);
    const rel = angDiff(bearing(P, c), brg);
    const side = Math.abs(rel) < 7 ? '정면' : rel < 0 ? '왼쪽' : '오른쪽';
    return { t: z.t, name: HZ[z.t] || z.t, reach: nf.near, carry: nf.far, side, rel, nearGreen: distM(c, g) < 40, ahead: distM(c, g) < dPG + 10 };
  }).filter(x => x.ahead && x.reach < dPG + 25 && x.reach < 400).sort((a, b) => a.reach - b.reach)
    .filter((x, i, a) => !a.slice(0, i).some(y => y.t === x.t && Math.abs(y.reach - x.reach) < 2 && Math.abs((y.carry || 0) - (x.carry || 0)) < 2));
}
function elevDiff(H) { return H.elev && H.elev.tee != null && H.elev.green != null ? H.elev.green - H.elev.tee : null; }
// 바람: from=바람이 불어오는 방위. 맞바람이면 +
function windEffect(w, shotBrg, d) {
  if (!w || w.speed == null || d == null) return null;
  const head = w.speed * Math.cos((w.dir - shotBrg) * RAD);
  const cross = w.speed * Math.sin((w.dir - shotBrg) * RAD); // +면 오른쪽에서 불어와 왼쪽으로 밀어요
  const pct = head > 0 ? 0.022 * head : 0.011 * head;
  return { head, cross, adj: d * pct };
}
function playsLike(d, elev, wind) { return d == null ? null : d + (elev || 0) + (wind ? wind.adj : 0); }

// ---------- 자동 공략 ----------
function holeStrategy(H, opts = {}) {
  const geo = holeGeo(H), out = [];
  if (!geo.green) return { lines: ['이 홀은 아직 도면이 없어요. 코스 편집기에서 티와 그린을 찍으면 자동 공략이 만들어져요.'], geo };
  const elev = elevDiff(H);
  const drv = clubAvg('드라이버');
  const L = holeLen(H, opts.tee) || (geo.len ? Math.round(geo.len) : null);
  const clubTxt = c => c ? `${c.club}(${c.est ? '추정 ' : '평균 '}${dfmt(c.avg)}${uLabel()})` : '';
  const greenSide = geo.tee ? hazardsFrom(H, geo.tee, geo).filter(z => z.nearGreen) : (H.hazards || []).filter(z => z.t !== 'fairway').map(z => ({ name: HZ[z.t], side: '주변' }));
  if (!geo.tee) out.push('티 위치가 없어서 그린 정보만 보여줘요.');
  if (geo.tee && H.par === 3) {
    const pl = playsLike(L, elev, null);
    out.push(`티에서 그린 중앙까지 ${dfmt(L)}${uLabel()}${elev != null && Math.abs(elev) >= 2 ? `, 고저차 ${sgn(elev)}m라 ${dfmt(pl)}${uLabel()}로 보세요` : ''}. 추천 ${clubTxt(recommendClub(pl, true))}.`);
    if (geo.depth) out.push(`그린 깊이는 약 ${Math.round(geo.depth)}m예요. 핀이 앞이면 한 클럽 짧게, 뒤면 한 클럽 길게 잡으세요.`);
  } else if (geo.tee) {
    const hz = hazardsFrom(H, geo.tee, geo).filter(z => !z.nearGreen);
    const land = pointAlong(geo.path, drv);
    if (geo.path.length > 2) {
      const corner = geo.path[1], turn = angDiff(bearing(corner, geo.path[2]), bearing(geo.tee, corner));
      if (Math.abs(turn) > 12) out.push(`${turn > 0 ? '오른쪽' : '왼쪽'} 도그레그예요. 코너까지 ${dfmt(distM(geo.tee, corner))}${uLabel()}.`);
    }
    const risky = hz.filter(z => z.t === 'ob' ? (H.hazards.find(x => x.t === 'ob') && distToPath(land, H.hazards.find(x => x.t === 'ob').p) < 25) : (z.reach <= drv + 12 && z.carry >= drv - 12));
    const carried = hz.filter(z => z.t !== 'ob' && z.carry < drv - 12 && !risky.includes(z));
    if (risky.length) {
      risky.forEach(z => out.push(z.t === 'ob' ? `${z.side} OB가 드라이버 낙하지점 가까이 있어요.` :
        `${z.side} ${z.name}: ${dfmt(z.reach)}${uLabel()}부터 시작해서 ${dfmt(z.carry)}${uLabel()}를 날려야 넘어가요. 드라이버 ${drv ? dfmt(drv) + uLabel() : ''}가 딱 걸리는 거리예요.`));
      const first = risky.filter(z => z.t !== 'ob').sort((a, b) => a.reach - b.reach)[0];
      const safe = first ? clubUnder(first.reach - 10) : null;
      const sides = [...new Set(risky.map(z => z.side))];
      if (safe && first.reach > 150) out.push(`${clubTxt(safe)}로 ${first.name} 앞에 끊어가거나, ${sides.length === 1 && sides[0] !== '정면' ? (sides[0] === '왼쪽' ? '오른쪽' : '왼쪽') + ' 페어웨이를 겨냥' : '정확도 위주로 치'}하세요.`);
      else if (sides.length === 1 && sides[0] !== '정면') out.push(`티샷은 ${sides[0] === '왼쪽' ? '오른쪽' : '왼쪽'} 페어웨이를 겨냥하세요.`);
    } else out.push(`드라이버 ${dfmt(drv)}${uLabel()} 기준으로 낙하지점 주변에 위험 요소가 없어요. 편하게 치세요.`);
    carried.forEach(z => out.push(`${z.side} ${josa(z.name, '은', '는')} ${dfmt(z.carry)}${uLabel()}면 넘어가요.`));
    if (L) {
      const rem = Math.max(0, L - drv), plRem = playsLike(rem, elev, null);
      if (H.par === 4) out.push(`티샷이 평소대로 가면 그린까지 약 ${dfmt(rem)}${uLabel()} 남아요${elev != null && Math.abs(elev) >= 2 ? ` (고저차 반영 ${dfmt(plRem)}${uLabel()})` : ''}. 추천 ${clubTxt(recommendClub(plRem))}.`);
      if (H.par >= 5) {
        const w3 = clubAvg('3번 우드');
        if (rem <= w3 + 10) out.push(`티샷 뒤 ${dfmt(rem)}${uLabel()}가 남아서 3번 우드로 2온을 노려볼 만해요. 그린 주변 위험 요소를 먼저 확인하세요.`);
        else { const lay = rem - 100; const c = recommendClub(lay); out.push(`티샷 뒤 ${dfmt(rem)}${uLabel()}가 남아요. 세컨드는 ${dfmt(lay)}${uLabel()}만 보내서 100${uLabel()}를 남기면 편해요 (${clubTxt(c)}).`); }
      }
    }
  }
  if (greenSide.length) {
    const sides = [...new Set(greenSide.map(z => z.side))];
    const kinds = [...new Set(greenSide.map(z => z.name))].join('·');
    const safe = sides.includes('왼쪽') && !sides.includes('오른쪽') ? '오른쪽' : sides.includes('오른쪽') && !sides.includes('왼쪽') ? '왼쪽' : '그린 중앙';
    out.push(`그린 ${sides.join('·')}에 ${josa(kinds, '이', '가')} 있어요. ${safe === '그린 중앙' ? '핀보다 그린 중앙' : safe + ' 쪽'}을 보고 치는 게 안전해요.`);
  }
  if (elev != null && Math.abs(elev) >= 3) out.push(`그린이 티보다 ${Math.abs(Math.round(elev))}m ${elev > 0 ? '높아요(오르막). 거리를 더 보세요' : '낮아요(내리막). 거리를 덜 보세요'}.`);
  return { lines: out, geo, elev, len: L };
}

// ---------- 퍼트 ----------
// b: 폰 윗변(홀 쪽)이 올라가면 +, g: 오른쪽이 내려가면 +
function puttRead(b, g, d, stimp = 10) {
  const along = Math.tan(b * RAD) * 100;      // + 오르막
  const side = Math.tan(g * RAD) * 100;       // + 오른쪽이 낮음 → 공이 오른쪽으로 휘어요
  const total = Math.hypot(along, side);
  const hi = [];
  if (Math.abs(along) >= 0.3) hi.push(along > 0 ? '홀 쪽(앞)' : '내 쪽(뒤)');
  if (Math.abs(side) >= 0.3) hi.push(side > 0 ? '왼쪽' : '오른쪽');
  const res = { along, side, total, high: hi.length ? hi.join(' ') + '이 높아요' : '거의 평평해요' };
  if (d != null && d > 0) {
    const k = 1.2 * (stimp / 10) * clamp(1 - along * 0.08, 0.6, 1.5);
    res.breakCm = Math.min(300, Math.abs(side) * d * d * k);
    res.cups = res.breakCm / 10.8;
    res.aim = Math.abs(side) < 0.3 || res.breakCm < 4 ? '홀 가운데를 보고 치세요'
      : `홀 ${side > 0 ? '왼쪽' : '오른쪽'} ${res.cups < 0.8 ? '가장자리' : `약 ${round1(res.cups)}컵(${Math.round(res.breakCm)}cm)`}을 보고 치세요`;
    res.plays = d * (1 + along * 0.06);
    res.speed = Math.abs(along) < 0.5 ? '평소 세기' : along > 0 ? `오르막이라 ${dfmt(res.plays)}${uLabel()}처럼 조금 세게` : `내리막이라 ${dfmt(res.plays)}${uLabel()}처럼 살살`;
  }
  return res;
}

if (typeof module !== 'undefined') module.exports = { computeBets, transfers, computeStats, puttRead, holeGeo, holeStrategy, defaultBets };
