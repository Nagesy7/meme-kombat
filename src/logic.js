// Pure combat logic (no DOM). 60 ticks/sec. Units: px; y = height above ground.
import { byId } from './roster.js';

export const W = 640, LEFT = 28, RIGHT = 612, GRAV = 0.55, ROUND_FRAMES = 99 * 60, MAX_HP = 1000;
const STAND_H = 108, CROUCH_H = 68, HALF_W = 18;

// startup/active/recovery frames, hitbox [x0,x1] forward of centre, [y0,y1] above ground
export const NORMALS = {
  lp: { s: 3, a: 3, r: 7, dmg: 40, hs: 14, bs: 9, kb: 3, x: [8, 58], y: [72, 100], lvl: 'high', pose: 'jab' },
  hp: { s: 6, a: 4, r: 14, dmg: 80, hs: 20, bs: 13, kb: 5, x: [8, 66], y: [70, 104], lvl: 'high', pose: 'hook' },
  lk: { s: 5, a: 4, r: 10, dmg: 50, hs: 16, bs: 10, kb: 4, x: [8, 66], y: [34, 66], lvl: 'mid', pose: 'kick' },
  hk: { s: 8, a: 5, r: 17, dmg: 90, hs: 22, bs: 14, kb: 6, x: [8, 78], y: [62, 104], lvl: 'high', pose: 'hkick' },
  clp: { s: 3, a: 3, r: 7, dmg: 35, hs: 13, bs: 8, kb: 3, x: [8, 56], y: [30, 60], lvl: 'mid', pose: 'cjab' },
  chp: { s: 6, a: 5, r: 16, dmg: 85, hs: 24, bs: 14, kb: 2, x: [4, 52], y: [40, 112], lvl: 'mid', pose: 'upper', launch: 9.5 },
  clk: { s: 4, a: 4, r: 9, dmg: 40, hs: 14, bs: 9, kb: 3, x: [8, 66], y: [0, 24], lvl: 'low', pose: 'ckick' },
  chk: { s: 7, a: 5, r: 18, dmg: 80, hs: 0, bs: 14, kb: 3, x: [8, 80], y: [0, 22], lvl: 'low', pose: 'sweep', trip: true },
  jp: { s: 4, a: 8, r: 4, dmg: 65, hs: 18, bs: 11, kb: 3, x: [0, 56], y: [-10, 50], lvl: 'over', pose: 'jpunch', air: true },
  jk: { s: 5, a: 10, r: 4, dmg: 80, hs: 20, bs: 12, kb: 4, x: [0, 66], y: [-20, 40], lvl: 'over', pose: 'jkick', air: true },
};
export const THROW = { dmg: 120, range: 62 };

export function mkRng(seed = 1) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function mkFighter(id, side, opts = {}) {
  const ch = byId(id);
  const hp = opts.hp ?? ch.hp ?? MAX_HP;
  return { id, ch, side, x: side === 0 ? 200 : 440, y: 0, vx: 0, vy: 0, face: side === 0 ? 1 : -1, hp, maxHp: hp, meter: 0,
    st: 'idle', t: 0, move: null, hitDone: false, combo: 0, juggle: 0, buf: [], prev: {}, lastDir: 5, inv: 0, crouch: false, skin: opts.skin || 'base', hitFlash: 0, specialName: null };
}

export function mkMatch(p1, p2, opts = {}) {
  const m = { f: [mkFighter(p1, 0, opts.o1), mkFighter(p2, 1, opts.o2)], round: 1, wins: [0, 0], timer: ROUND_FRAMES, phase: 'intro', pt: 0,
    proj: [], events: [], banner: null, rng: mkRng(opts.seed || 7), tick: 0, winner: null, matchWinner: null, finisher: null, hitstop: 0, stage: opts.stage || byId(p2).stage, opts };
  say(m, 'ROUND 1', 70);
  return m;
}
function say(m, text, dur = 60, sub = '') { m.banner = { text, sub, t: dur, max: dur }; m.events.push({ type: 'banner', text }); }

// ---------- input helpers ----------
const relDir = (inp, face) => { const f = face > 0 ? inp.r : inp.l, b = face > 0 ? inp.l : inp.r; return inp.d ? (f ? 3 : b ? 1 : 2) : inp.u ? (f ? 9 : b ? 7 : 8) : f ? 6 : b ? 4 : 5; };
function motion(buf, seq, win, now) {
  // seq matched in order within the window, allowing extra dirs between
  let i = seq.length - 1;
  for (let k = buf.length - 1; k >= 0 && i >= 0; k--) { if (now - buf[k].t > win) break; if (buf[k].d === seq[i]) i--; }
  return i < 0;
}
function ddMotion(buf, now) { // down, not-down, down
  let st = 0;
  for (let k = buf.length - 1; k >= 0; k--) { const b = buf[k]; if (now - b.t > 22) break; const dn = b.d === 2 || b.d === 1 || b.d === 3;
    if (st === 0 && dn) st = 1; else if (st === 1 && !dn) st = 2; else if (st === 2 && dn) return true; }
  return false;
}

const neutral = (f) => f.st === 'idle' || f.st === 'walk' || f.st === 'crouch' || f.st === 'block' || f.st === 'cblock';

function startMove(m, f, mv, name) { f.st = 'attack'; f.t = 0; f.move = { ...mv, name }; f.hitDone = false; m.events.push({ type: 'whiff', who: f.side, mv: name }); }

function specialMove(f, kind) {
  const S = f.ch.specials, pw = f.ch.pow || 1;
  if (kind === 'proj') return { s: 12, a: 1, r: 22, proj: true, dmg: Math.round(S.proj.dmg * pw), pose: 'special', special: S.proj.name, x: [0, 0], y: [0, 0] };
  if (kind === 'rush') return { s: 8, a: 14, r: 18, dmg: Math.round(S.rush.dmg * pw), hs: 22, bs: 16, kb: 8, x: [0, 60], y: [20, 100], lvl: 'mid', pose: 'rush', dash: 7.5 * (f.ch.spd || 1), special: S.rush.name, chip: true };
  if (kind === 'rise') return { s: 3, a: 12, r: 24, dmg: Math.round(S.rise.dmg * pw), hs: 26, bs: 18, kb: 3, x: [0, 54], y: [30, 150], lvl: 'mid', pose: 'rise', rise: 11, launch: 11, special: S.rise.name, chip: true, invS: 6 };
  if (kind === 'super') return { s: 10, a: 22, r: 26, dmg: Math.round(S.super.dmg * pw), hs: 40, bs: 24, kb: 10, x: [-10, 120], y: [0, 140], lvl: 'mid', pose: 'super', dash: 6, special: S.super.name, chip: true, launch: 12, super: true, invS: 12 };
}

// Read input and start actions. inp: {u,d,l,r,lp,hp,lk,hk} held booleans.
function control(m, f, o, inp) {
  const pr = {}; for (const k of ['lp', 'hp', 'lk', 'hk']) pr[k] = inp[k] && !f.prev[k];
  f.prev = { ...inp };
  // face the opponent when grounded and neutral
  if (f.y === 0 && neutral(f)) f.face = o.x >= f.x ? 1 : -1;
  const d = relDir(inp, f.face);
  if (d !== f.lastDir) { f.buf.push({ d, t: m.tick }); if (f.buf.length > 24) f.buf.shift(); f.lastDir = d; }
  f.holdBack = d === 4 || d === 1 || d === 7; f.crouchHeld = d === 1 || d === 2 || d === 3;
  const anyP = pr.lp || pr.hp, anyK = pr.lk || pr.hk;
  if (f.st === 'jump' && !f.move && (anyP || anyK)) { f.move = { ...(anyK ? NORMALS.jk : NORMALS.jp), name: anyK ? 'jk' : 'jp' }; f.mt = 0; f.hitDone = false; m.events.push({ type: 'whiff', who: f.side }); return; }
  if (!neutral(f)) return;
  if (f.y > 0) return;
  // specials (priority: super > rise > rush > proj)
  if ((pr.lk || pr.hk) && f.meter >= 100 && motion(f.buf, [2, 3, 6], 24, m.tick)) { f.meter = 0; m.events.push({ type: 'super', who: f.side }); say(m, f.ch.specials.super.name.toUpperCase(), 50, 'SUPER'); m.hitstop = 24; return startMove(m, f, specialMove(f, 'super'), 'super'); }
  if (anyP && ddMotion(f.buf, m.tick)) return startMove(m, f, specialMove(f, 'rise'), 'rise');
  if (anyK && motion(f.buf, [4, 6], 16, m.tick) && !f.crouchHeld) return startMove(m, f, specialMove(f, 'rush'), 'rush');
  if (anyP && motion(f.buf, [2, 3, 6], 20, m.tick) && !m.proj.some((p) => p.owner === f.side)) return startMove(m, f, specialMove(f, 'proj'), 'proj');
  // throw: forward + HP close
  if (pr.hp && (d === 6) && Math.abs(o.x - f.x) < THROW.range && o.y === 0 && neutral(o) && o.st !== 'down' && o.inv <= 0) {
    f.st = 'throw'; f.t = 0; o.st = 'thrown'; o.t = 0; o.vx = 0; m.events.push({ type: 'throw', who: f.side }); return;
  }
  const c = f.crouchHeld;
  for (const k of ['hp', 'hk', 'lp', 'lk']) if (pr[k]) return startMove(m, f, NORMALS[c ? 'c' + k : k], c ? 'c' + k : k);
  const spd = 2.6 * (f.ch.spd || 1);
  if (d >= 7) { f.st = 'jump'; f.t = 0; f.vy = 10.5; f.vx = d === 9 ? 3.2 * f.face : d === 7 ? -3.2 * f.face : 0; f.move = null; m.events.push({ type: 'jump', who: f.side }); return; }
  const oppAttacking = o.st === 'attack' || m.proj.some((p) => p.owner === o.side);
  if (c) { f.st = f.holdBack && oppAttacking ? 'cblock' : 'crouch'; f.vx = 0; return; }
  if (f.holdBack && oppAttacking && Math.abs(o.x - f.x) < 200) { f.st = 'block'; f.vx = 0; return; }
  if (d === 6) { f.st = 'walk'; f.vx = spd * f.face; } else if (d === 4) { f.st = 'walk'; f.vx = -spd * 0.85 * f.face; } else { f.st = 'idle'; f.vx = 0; }
}

function hurt(f) { const h = f.st === 'crouch' || f.st === 'cblock' || (f.st === 'attack' && f.move?.name?.[0] === 'c' && f.move.name !== 'chp') ? CROUCH_H : STAND_H; return { x0: f.x - HALF_W, x1: f.x + HALF_W, y0: f.y, y1: f.y + h }; }
function hitbox(f, mv) { const a = f.x + mv.x[0] * f.face, b = f.x + mv.x[1] * f.face; return { x0: Math.min(a, b), x1: Math.max(a, b), y0: f.y + mv.y[0], y1: f.y + mv.y[1] }; }
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

export function canBlock(def, lvl) {
  if (def.y > 0 || !(neutral(def) || def.st === 'blockstun') || !def.holdBack) return false;
  const crouching = def.crouchHeld;
  if (lvl === 'low') return crouching;
  if (lvl === 'over') return !crouching;
  return true;
}

export function applyHit(m, att, def, mv) {
  if (def.inv > 0 || def.st === 'down' || def.st === 'getup' || def.st === 'thrown' || def.st === 'ko') return 'miss';
  if (def.st === 'air' && def.juggle >= 4) return 'miss';
  if (canBlock(def, mv.lvl)) {
    const chip = mv.chip ? Math.round(mv.dmg * 0.15) : 0;
    def.hp = Math.max(chip >= def.hp ? 1 : 0, def.hp - chip);
    def.st = 'blockstun'; def.t = 0; def.stun = mv.bs || 12; def.vx = -(mv.kb || 4) * 0.9 * att.face * -1 * -1; def.vx = (mv.kb || 4) * att.face;
    att.meter = Math.min(100, att.meter + mv.dmg / 25); def.meter = Math.min(100, def.meter + mv.dmg / 30);
    m.events.push({ type: 'block', who: def.side, x: (att.x + def.x) / 2, y: def.y + 80 }); m.hitstop = 4; return 'block';
  }
  const inCombo = def.st === 'hitstun' || def.st === 'air';
  att.combo = inCombo ? att.combo + 1 : 1;
  const scale = Math.max(0.35, 1 - (att.combo - 1) * 0.12);
  const dmg = Math.max(1, Math.round(mv.dmg * scale));
  def.hp = Math.max(0, def.hp - dmg); def.hitFlash = 8;
  att.meter = Math.min(100, att.meter + mv.dmg / 10); def.meter = Math.min(100, def.meter + mv.dmg / 20);
  m.events.push({ type: 'hit', who: def.side, dmg, heavy: mv.dmg >= 80, x: (att.x + def.x) / 2 + def.face * -10, y: def.y + (mv.y[0] + mv.y[1]) / 2, combo: att.combo });
  m.hitstop = mv.dmg >= 80 ? 8 : 5;
  if (att.combo >= 3 && (att.combo === 3 || att.combo % 2 === 1)) say(m, `${att.combo} HIT COMBO`, 40);
  if (def.y > 0 || def.st === 'air' || mv.launch || def.hp <= 0) {
    def.st = 'air'; def.t = 0; def.vy = mv.launch || Math.max(def.vy, 5.5); def.vx = (mv.kb || 4) * 0.6 * att.face; def.juggle = (def.juggle || 0) + 1; if (def.y === 0) def.y = 1;
  } else if (mv.trip) { def.st = 'air'; def.t = 0; def.vy = 3.5; def.y = 1; def.vx = 1.5 * att.face; def.juggle = 3; }
  else { def.st = 'hitstun'; def.t = 0; def.stun = mv.hs; def.vx = (mv.kb || 4) * att.face; }
  def.move = null;
  return 'hit';
}

function stepFighter(m, f, o) {
  f.t++; if (f.inv > 0) f.inv--; if (f.hitFlash > 0) f.hitFlash--;
  const mv = f.move;
  switch (f.st) {
    case 'attack': {
      const T = f.t;
      if (mv.dash && T > mv.s && T <= mv.s + mv.a) f.vx = mv.dash * f.face; else if (!mv.dash) f.vx *= 0.6; else f.vx *= 0.7;
      if (mv.rise && T === mv.s) { f.vy = mv.rise; f.y = 1; f.vx = 1.2 * f.face; }
      if (mv.proj && T === mv.s) { const S = f.ch.specials.proj; m.proj.push({ owner: f.side, x: f.x + 40 * f.face, y: 70, vx: S.speed * f.face, dmg: mv.dmg, kind: S.kind, color: S.color, life: 160, w: 22, h: 22, name: S.name }); m.events.push({ type: 'proj', who: f.side }); }
      if (!mv.proj && T > mv.s && T <= mv.s + mv.a && !f.hitDone) { if (overlap(hitbox(f, mv), hurt(o))) { const r = applyHit(m, f, o, mv); if (r !== 'miss') f.hitDone = true; } }
      if (T >= mv.s + mv.a + mv.r && f.y === 0) { f.st = 'idle'; f.move = null; f.t = 0; }
      break;
    }
    case 'jump': if (f.move) { f.mt++; const jm = f.move; if (f.mt > jm.s && f.mt <= jm.s + jm.a && !f.hitDone && overlap(hitbox(f, jm), hurt(o))) { if (applyHit(m, f, o, jm) !== 'miss') f.hitDone = true; } } break;
    case 'hitstun': case 'blockstun': f.vx *= 0.82; if (f.t >= f.stun) { f.st = 'idle'; f.t = 0; } break;
    case 'air': break;
    case 'down': f.vx *= 0.8; if (f.t >= 38) { if (f.hp <= 0) { f.st = 'ko'; } else { f.st = 'getup'; f.t = 0; f.inv = 22; } } break;
    case 'getup': if (f.t >= 18) { f.st = 'idle'; f.t = 0; } break;
    case 'throw': if (f.t === 14) { o.hp = Math.max(0, o.hp - Math.round(THROW.dmg * (f.ch.pow || 1))); o.st = 'air'; o.vy = 7; o.y = 1; o.vx = 4.5 * f.face; o.juggle = 4; o.hitFlash = 8; f.meter = Math.min(100, f.meter + 12); m.events.push({ type: 'hit', who: o.side, dmg: THROW.dmg, heavy: true, x: o.x, y: 60 }); m.hitstop = 8; } if (f.t >= 28) { f.st = 'idle'; f.t = 0; } break;
    case 'thrown': o.st !== 'throw' && f.t > 30 && (f.st = 'idle'); f.x = o.x + 20 * o.face; break;
  }
  // physics
  if (f.y > 0 || f.vy > 0) {
    f.y += f.vy; f.vy -= GRAV; f.x += f.vx;
    if (f.y <= 0) {
      f.y = 0; f.vy = 0;
      if (f.st === 'air') { f.st = 'down'; f.t = 0; f.juggle = 0; m.events.push({ type: 'land', who: f.side, heavy: true }); }
      else if (f.st === 'jump' || f.st === 'attack') { f.st = 'idle'; f.t = 0; f.move = null; f.vx = 0; m.events.push({ type: 'land', who: f.side }); }
    }
  } else { f.x += f.vx; if (f.st === 'idle' || f.st === 'crouch') f.vx = 0; }
  f.x = Math.max(LEFT, Math.min(RIGHT, f.x));
  if (!(o.st === 'hitstun' || o.st === 'air') && f === m.f[0]) { /* combo resets handled below */ }
}

function separate(m) {
  const [a, b] = m.f; if (a.st === 'thrown' || b.st === 'thrown') return;
  const dx = b.x - a.x, min = 34;
  if (Math.abs(dx) < min && Math.abs(a.y - b.y) < 90) { const push = (min - Math.abs(dx)) / 2, s = dx >= 0 ? 1 : -1; a.x -= push * s; b.x += push * s;
    for (const f of m.f) f.x = Math.max(LEFT, Math.min(RIGHT, f.x)); if (Math.abs(b.x - a.x) < min) { if (a.x <= LEFT + 1) b.x = a.x + min; else if (b.x <= LEFT + 1) a.x = b.x + min; else if (a.x >= RIGHT - 1) b.x = a.x - min; else if (b.x >= RIGHT - 1) a.x = b.x - min; } }
}

function stepProj(m) {
  for (const p of m.proj) { p.x += p.vx; p.life--; const o = m.f[1 - p.owner], att = m.f[p.owner];
    if (overlap({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.h / 2, y1: p.y + p.h / 2 }, hurt(o))) { const r = applyHit(m, att, o, { dmg: p.dmg, hs: 20, bs: 14, kb: 5, lvl: 'mid', chip: true, x: [0, 0], y: [p.y - 10, p.y + 10] }); if (r !== 'miss') p.life = 0; }
    if (p.x < 0 || p.x > W) p.life = 0; }
  if (m.proj.length === 2 && m.proj[0].owner !== m.proj[1].owner && Math.abs(m.proj[0].x - m.proj[1].x) < 24) { m.proj.forEach((p) => (p.life = 0)); m.events.push({ type: 'clash' }); }
  m.proj = m.proj.filter((p) => p.life > 0);
}

export function resetRound(m) {
  m.f.forEach((f, i) => { Object.assign(f, { x: i === 0 ? 200 : 440, y: 0, vx: 0, vy: 0, face: i === 0 ? 1 : -1, hp: f.maxHp, st: 'idle', t: 0, move: null, combo: 0, juggle: 0, inv: 0, buf: [], prev: {} }); });
  m.proj = []; m.timer = ROUND_FRAMES; m.phase = 'intro'; m.pt = 0; m.winner = null; m.finisher = null;
  say(m, m.round >= 3 && m.wins[0] === 1 && m.wins[1] === 1 ? 'FINAL ROUND' : `ROUND ${m.round}`, 70);
}

// One simulation tick. inputs = [inp0, inp1]
export function step(m, inputs) {
  m.tick++; m.pt++;
  if (m.banner && --m.banner.t <= 0) m.banner = null;
  if (m.hitstop > 0) { m.hitstop--; return; }
  const [a, b] = m.f;
  if (m.phase === 'intro') { if (m.pt === 70) say(m, 'FIGHT!', 40); if (m.pt >= 80) { m.phase = 'fight'; m.pt = 0; } return; }
  if (m.phase === 'fight') {
    control(m, a, b, inputs[0] || {}); control(m, b, a, inputs[1] || {});
    stepFighter(m, a, b); stepFighter(m, b, a); separate(m); stepProj(m);
    for (const [f, o] of [[a, b], [b, a]]) if (!(o.st === 'hitstun' || o.st === 'air' || o.st === 'thrown')) f.combo = 0;
    m.timer--;
    if (a.hp <= 0 || b.hp <= 0 || m.timer <= 0) endRound(m);
    return;
  }
  // non-fight phases: keep physics settling
  stepFighter(m, a, b); stepFighter(m, b, a); separate(m);
  if (m.phase === 'ko') {
    if (m.pt === 90) {
      if (m.matchWinner != null) { const w = m.f[m.matchWinner], l = m.f[1 - m.matchWinner]; if (l.hp <= 0) { l.hp = 0; l.st = 'dizzy'; l.y = 0; l.vx = 0; } else l.st = 'dizzy'; w.st = 'idle'; w.buf = []; m.phase = 'finish'; m.pt = 0; say(m, 'FINISH THE BAG', 150, `${w.ch.fin.name}: tap \u2193 \u2193 + HK`); }
      else { m.f[m.winner ?? 0] && m.winner != null && (m.f[m.winner].st = 'win'); m.phase = 'roundEnd'; m.pt = 0; }
    }
  } else if (m.phase === 'finish') {
    const wi = m.matchWinner, w = m.f[wi], inp = inputs[wi] || {}; w.prevF = w.prevF || {};
    const d = relDir(inp, w.face); if (d !== w.lastDir) { w.buf.push({ d, t: m.tick }); w.lastDir = d; }
    const pressed = inp.hk && !w.prevF.hk; w.prevF = { ...inp };
    m.f[1 - wi].st = 'dizzy';
    if (pressed && ddMotion(w.buf, m.tick)) { m.phase = 'finisher'; m.pt = 0; m.finisher = { who: wi, kind: w.ch.fin.kind, name: w.ch.fin.name }; w.st = 'special'; m.events.push({ type: 'finisher', kind: w.ch.fin.kind }); say(m, 'RUG PULL!', 90, w.ch.fin.name.toUpperCase()); }
    else if (m.pt >= 180) { m.f[1 - wi].st = 'down'; m.f[1 - wi].t = 0; m.f[1 - wi].hp = 0; w.st = 'win'; m.phase = 'matchEnd'; m.pt = 0; say(m, `${w.ch.name.toUpperCase()} WINS`, 140); }
  } else if (m.phase === 'finisher') {
    if (m.pt >= 200) { const w = m.f[m.matchWinner]; w.st = 'win'; m.phase = 'matchEnd'; m.pt = 0; say(m, 'BAG SECURED', 140, `${w.ch.name} wins`); }
  } else if (m.phase === 'roundEnd') {
    if (m.pt >= 100) { m.round++; resetRound(m); }
  }
}

function endRound(m) {
  const [a, b] = m.f; let w = null;
  if (a.hp <= 0 && b.hp <= 0) w = null; else if (a.hp <= 0) w = 1; else if (b.hp <= 0) w = 0; else w = a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1;
  const timeout = a.hp > 0 && b.hp > 0;
  m.winner = w; m.phase = 'ko'; m.pt = 0; m.proj = [];
  if (w != null) m.wins[w]++;
  else if (m.round >= 5) { m.wins[0]++; w = m.winner = 0; } // sudden-death cap
  const perfect = w != null && m.f[w].hp === m.f[w].maxHp;
  say(m, timeout ? 'TIME' : w == null ? 'DOUBLE K.O.' : 'K.O.', 80, perfect ? 'PERFECT HODL' : '');
  m.events.push({ type: 'ko', winner: w, perfect });
  for (const f of m.f) if (f.hp <= 0 && f.st !== 'air' && f.st !== 'down') { f.st = 'air'; f.vy = 6; f.y = 1; f.vx = -2 * f.face; }
  if (w != null && m.wins[w] >= 2) m.matchWinner = w;
}

// ---------- CPU ----------
export function cpuInput(m, idx, level = 0.5) {
  const f = m.f[idx], o = m.f[1 - idx], r = m.rng, inp = { u: 0, d: 0, l: 0, r: 0, lp: 0, hp: 0, lk: 0, hk: 0 };
  const fwd = o.x > f.x ? 'r' : 'l', back = fwd === 'r' ? 'l' : 'r', dist = Math.abs(o.x - f.x);
  if (m.phase === 'finish' && m.matchWinner === idx) { const s = f.aiFin = (f.aiFin || 0) + 1; if (s > 30) { if (s < 34) inp.d = 1; else if (s < 37) {} else if (s < 40) inp.d = 1; else if (s < 42) { inp.d = 1; inp.hk = 1; } } return inp; }
  if (m.phase !== 'fight') return inp;
  const ai = f.ai || (f.ai = { plan: null, t: 0, seq: [] });
  if (ai.seq.length) { Object.assign(inp, ai.seq.shift()); return inp; }
  const incoming = o.st === 'attack' || m.proj.some((p) => p.owner === o.side && Math.abs(p.x - f.x) < 160);
  if (incoming && r() < level * 0.9) { inp[back] = 1; if (o.move && (o.move.lvl === 'low')) inp.d = 1; return inp; }
  if (o.st === 'jump' && dist < 110 && r() < level * 0.5) { ai.seq = [{ d: 1 }, {}, { d: 1 }, { d: 1, hp: 1 }]; return inp; }
  if (o.st === 'air' && dist < 90 && f.st === 'idle' && r() < level) { ai.seq = [{ hk: 1 }]; return inp; }
  if (++ai.t < 4 + (1 - level) * 10) { if (ai.plan) inp[ai.plan] = 1; return inp; }
  ai.t = 0; const x = r();
  const mk = (seq) => { ai.seq = seq.map((s) => { const o2 = {}; for (const k in s) o2[k === 'F' ? fwd : k === 'B' ? back : k] = s[k]; return o2; }); };
  if (f.meter >= 100 && dist < 160 && x < 0.5) { mk([{ d: 1 }, { d: 1, F: 1 }, { F: 1 }, { F: 1, hk: 1 }]); return inp; }
  if (dist > 220) { ai.plan = x < 0.35 ? null : fwd; if (x < 0.3) mk([{ d: 1 }, { d: 1, F: 1 }, { F: 1 }, { F: 1, lp: 1 }]); else if (x < 0.4) { mk([{ u: 1, F: 1 }]); } return inp; }
  if (dist > 85) { ai.plan = fwd; if (x < 0.15) mk([{ B: 1 }, { F: 1 }, { F: 1, lk: 1 }]); else if (x < 0.25) mk([{ u: 1, F: 1 }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { hk: 1 }]); return inp; }
  ai.plan = null;
  const opts = [[{ lp: 1 }, {}, {}, {}, {}, {}, {}, { lp: 1 }, {}, {}, {}, {}, {}, {}, {}, {}, { d: 1, hp: 1 }], [{ hk: 1 }], [{ d: 1, hk: 1 }], [{ d: 1, lk: 1 }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { hp: 1 }], [{ F: 1, hp: 1 }], [{ B: 1 }, { B: 1 }, { B: 1 }, { B: 1 }, { B: 1 }, { B: 1 }]];
  mk(opts[Math.floor(r() * opts.length)]);
  return inp;
}
