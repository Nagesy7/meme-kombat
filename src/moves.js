// Move data (pure, no DOM): normals, special/super frame data, input motions, and each fighter's combo kit
// (target-combo strings, cancel rules, extra specials). logic.js runs these exact objects and the Move List /
// Combo Trainer screens are generated from them, so what the menus show is what the game executes.
// Original names only. Directions are written for a fighter facing right (they mirror automatically).

// Ruleset version. 1 = launch rules (4 specials, no strings/cancels). 2 = combo update. Clips recorded under rules 1 keep
// replaying with rules 1 (replay.js detects it from the checksum); online peers refuse to start on a mismatch.
// 3 = Nov 2026 slide tune: Bonkus, Toot Lord and Boomer Bob's sliding low uses the roster's standard slide timing (r3 below)
// so LK xx slide connects at max LK range like everyone else's. Damage unchanged. Rules-2 clips replay with rules 2.
export const RULES = 3;
export const RULESETS = [3, 2, 1];

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
// combo damage scaling: hit n of a combo does this fraction of its damage
export const comboScale = (n) => Math.max(0.35, 1 - (n - 1) * 0.12);

// Stick motions. seq = numpad directions (2 down, 3 down-forward, 6 forward, 1 down-back, 4 back, 5 neutral) that must
// appear in order inside `win` ticks. Rules 2 makes rolls phone-friendly: the diagonal is optional, but passing through
// neutral (letting go of the stick) between the steps cancels the roll, so "crouch, stand, walk + punch" stays a punch.
export const MOTIONS = {
  qcf: { seq: [2, 6], win: 20, noNeutral: true, show: ['D', 'DF', 'F'], say: 'roll down to forward' },
  qcb: { seq: [2, 4], win: 20, noNeutral: true, show: ['D', 'DB', 'B'], say: 'roll down to back' },
  bf: { seq: [4, 6], win: 16, show: ['B', 'F'], say: 'back, then forward', stand: true },
  dd: { dd: true, win: 22, show: ['D', 'D'], say: 'tap down twice' },
};
// Rules-2 special detection, checked top to bottom (first match wins). btn P = either punch, K = either kick.
export const SPECIAL_ORDER = [
  { slot: 'super', motion: 'qcf', btn: 'K', meter: 100 },
  { slot: 'rise', motion: 'dd', btn: 'P' },
  { slot: 'low', motion: 'dd', btn: 'K' },
  { slot: 'rush', motion: 'bf', btn: 'K' },
  { slot: 'over', motion: 'qcb', btn: 'P' },
  { slot: 'proj', motion: 'qcf', btn: 'P', oneProj: true },
];
// Cancels: these normals (plus every string step and the fighter's own `hc` list) can be cancelled into any special or
// the super once they connect (hit or block), up to CANCEL_WIN frames after their active frames end.
export const CANCEL_BASE = ['lp', 'lk', 'clp', 'clk', 'chp'];
export const CANCEL_WIN = 8;

// Per-fighter combo kits. chains: target-combo strings (press the next button after the previous hit/block connects);
// end = extra property on the last hit. hc = heavy normals that also cancel. low = D,D + K sliding low (knockdown).
// over = D,DB,B + P hopping overhead (must be blocked standing).
export const KITS = {
  inu: { style: 'All-rounder', hc: ['hp'], chains: [{ name: 'Press Briefing', seq: ['lp', 'lp', 'hp'] }, { name: 'Campaign Trail', seq: ['lk', 'hk'], end: { kb: 9 } }],
    low: { name: 'Red Tape Slide', dmg: 72, s: 7, dash: 6.5 }, over: { name: 'Gavel Drop', dmg: 78, s: 10, hop: 5.6 } },
  croakley: { style: 'Hopper', hc: ['hk'], chains: [{ name: 'Lily Hop Kicks', seq: ['lk', 'lk', 'hk'] }, { name: 'Ribbit Jabs', seq: ['lp', 'lp', 'lk'] }],
    low: { name: 'Puddle Skid', dmg: 68, s: 6, dash: 7.5 }, over: { name: 'Leap Frog Splash', dmg: 76, s: 10, hop: 6.4 } },
  muchwow: { style: 'Zoner', hc: ['hk'], chains: [{ name: 'Such Jab Wow', seq: ['lp', 'hp'] }, { name: 'Very Kick Many', seq: ['lk', 'lk', 'hk'] }],
    low: { name: 'Wow Slide', dmg: 70, s: 7, dash: 6.5 }, over: { name: 'Moon Hop Slam', dmg: 80, s: 11, hop: 6.2 } },
  wiffy: { style: 'Speed', hc: [], chains: [{ name: 'Hat Flurry', seq: ['lp', 'lp', 'lk', 'hk'] }, { name: 'Beanie Bop', seq: ['lk', 'hp'] }],
    low: { name: 'Tail Spin Skid', dmg: 66, s: 5, dash: 8 }, over: { name: 'Hat Hop', dmg: 72, s: 9, hop: 5.2 } },
  bonkus: { style: 'Power', hc: ['hp', 'hk'], chains: [{ name: 'Double Bonk', seq: ['hp', 'hk'], end: { launch: 8 } }, { name: 'Batter Up', seq: ['lp', 'hp'] }],
    low: { name: 'Ground Ball', dmg: 70, s: 9, dash: 5.5, r3: { s: 7, dash: 6.5 } }, over: { name: 'Overhead Bonk', dmg: 76, s: 12, hop: 6 } },
  moneymew: { style: 'Rushdown', hc: [], chains: [{ name: 'Paw Swipes', seq: ['lp', 'lp', 'lp', 'hp'] }, { name: 'Tail Flick Kicks', seq: ['lk', 'hk'] }],
    low: { name: 'Under-Table Swipe', dmg: 68, s: 5, dash: 7.5 }, over: { name: 'Shelf Pounce', dmg: 74, s: 9, hop: 5.6 } },
  toot: { style: 'Space control', hc: ['hp'], chains: [{ name: 'Wind Section', seq: ['lp', 'hp', 'hk'] }, { name: 'Gust Kicks', seq: ['lk', 'hk'], end: { kb: 10 } }],
    low: { name: 'Low Rumble', dmg: 72, s: 8, dash: 5, r3: { s: 7, dash: 6.5 } }, over: { name: 'Cloud Hop Stomp', dmg: 78, s: 11, hop: 6.4 } },
  sealbert: { style: 'Grappler', hc: ['hp'], chains: [{ name: 'Flipper Slap', seq: ['lp', 'hp'] }, { name: 'Clap Clap Slap', seq: ['lk', 'lk', 'hp'] }],
    low: { name: 'Belly Slide', dmg: 74, s: 7, dash: 7 }, over: { name: 'Ball Bounce Drop', dmg: 76, s: 10, hop: 6 } },
  stampy: { style: 'Bruiser', hc: ['hp'], chains: [{ name: 'Horn Hooks', seq: ['hp', 'hp'], end: { launch: 8 } }, { name: 'Catwalk Kicks', seq: ['lk', 'hk'] }],
    low: { name: 'Runway Skid', dmg: 72, s: 8, dash: 6 }, over: { name: 'Stomp Step', dmg: 76, s: 11, hop: 5.6 } },
  boomer: { style: 'Footsies', hc: ['hk'], chains: [{ name: 'Firm Handshake', seq: ['lp', 'lk', 'hp'] }, { name: 'Tee Off Kicks', seq: ['lk', 'lk', 'hk'], end: { trip: true } }],
    low: { name: 'Lawn Mower Slide', dmg: 70, s: 8, dash: 5.5, r3: { s: 7, dash: 6.5 } }, over: { name: 'Briefcase Drop', dmg: 78, s: 11, hop: 5.6 } },
  rugsworth: { style: 'Boss', hc: ['hp', 'hk'], chains: [{ name: 'Market Maker', seq: ['lp', 'hp', 'hk'] }, { name: 'Whale Wake', seq: ['hk', 'hp'] }],
    low: { name: 'Rug Sweep', dmg: 70, s: 8, dash: 6 }, over: { name: 'Whale Breach', dmg: 74, s: 12, hop: 6 } },
};
export const kitFor = (ch) => KITS[ch.id] || KITS.inu;
// display name of every special slot for a fighter
export function specialName(ch, slot) { const k = kitFor(ch); return slot === 'low' || slot === 'over' ? k[slot].name : ch.specials[slot].name; }

// frame data of a special for this fighter (damage includes the fighter's power multiplier)
export function specialMove(ch, kind, rules = RULES) {
  const S = ch.specials, pw = ch.pow || 1, K = kitFor(ch), LO = rules >= 3 && K.low.r3 ? { ...K.low, ...K.low.r3 } : K.low;
  if (kind === 'proj') return { s: 12, a: 1, r: 22, proj: true, dmg: Math.round(S.proj.dmg * pw), pose: 'special', special: S.proj.name, x: [0, 0], y: [0, 0] };
  if (kind === 'rush') return { s: 8, a: 14, r: 18, dmg: Math.round(S.rush.dmg * pw), hs: 22, bs: 16, kb: 8, x: [0, 60], y: [20, 100], lvl: 'mid', pose: 'rush', dash: 7.5 * (ch.spd || 1), special: S.rush.name, chip: true };
  if (kind === 'rise') return { s: 3, a: 12, r: 24, dmg: Math.round(S.rise.dmg * pw), hs: 26, bs: 18, kb: 3, x: [0, 54], y: [30, 150], lvl: 'mid', pose: 'rise', rise: 11, launch: 11, special: S.rise.name, chip: true, invS: 6 };
  if (kind === 'super') return { s: 10, a: 22, r: 26, dmg: Math.round(S.super.dmg * pw), hs: 40, bs: 24, kb: 10, x: [-10, 120], y: [0, 140], lvl: 'mid', pose: 'super', dash: 6, special: S.super.name, chip: true, launch: 12, super: true, invS: 12 };
  // rules 2: sliding low (knocks down, low hurtbox so it slips under high attacks; punishable on block)
  if (kind === 'low') return { s: LO.s, a: 10, r: 20, dmg: Math.round(K.low.dmg * pw), hs: 0, bs: 12, kb: 3, x: [0, 62], y: [0, 26], lvl: 'low', pose: 'sweep', dash: LO.dash, trip: true, lowHurt: true, special: K.low.name, chip: true };
  // rules 2: hopping overhead (stand-block it; lands on its own, so it can't be chained into)
  if (kind === 'over') return { s: K.over.s, a: 6, r: 14, dmg: Math.round(K.over.dmg * pw), hs: 18, bs: 10, kb: 4, x: [0, 58], y: [-14, 70], lvl: 'over', pose: 'jpunch', hop: K.over.hop, special: K.over.name, chip: true };
}
// a string step (2nd hit onwards): the normal with 2 frames less startup and a small step forward so it connects
export function chainMove(ch, ci, i) {
  const c = kitFor(ch).chains[ci], k = c.seq[i], N = NORMALS[k];
  const mv = i === 0 ? { ...N } : { ...N, s: Math.max(2, N.s - 2), r: N.r + 2, adv: 3, x: [N.x[0], N.x[1] + 8] };
  if (i === c.seq.length - 1 && c.end) Object.assign(mv, c.end);
  return { ...mv, chain: ci, step: i };
}
export const chainName = (ci, i) => (i === 0 ? null : `t${ci}.${i}`);

// ---------- display (Move List + Combo Trainer) ----------
const BTN = { lp: 'LP', hp: 'HP', lk: 'LK', hk: 'HK' };
export const btnLabel = (k) => BTN[k] || k;
export const motionTokens = (motion, btn) => [...MOTIONS[motion].show, '+', btn];
// total damage of a sequence of move objects that all hit as one combo
export const comboDamage = (moves) => moves.reduce((s, mv, i) => s + Math.max(1, Math.round(mv.dmg * comboScale(i + 1))), 0);
const SLOT_NOTE = { proj: 'projectile', rush: 'dashing strike', rise: 'rising launcher, juggles', low: 'low slide, knockdown', over: 'overhead hop, block standing', super: 'needs full BAG METER' };

// Every row the Move List shows for a fighter, straight from the data above.
export function moveList(ch) {
  const K = kitFor(ch), rows = [];
  for (const sp of [...SPECIAL_ORDER].filter((s) => s.slot !== 'super').sort((a, b) => ['proj', 'rush', 'rise', 'low', 'over'].indexOf(a.slot) - ['proj', 'rush', 'rise', 'low', 'over'].indexOf(b.slot))) {
    const mv = specialMove(ch, sp.slot); rows.push({ group: 'SPECIALS', slot: sp.slot, name: specialName(ch, sp.slot), input: motionTokens(sp.motion, sp.btn), dmg: mv.dmg, startup: mv.s + 1, note: SLOT_NOTE[sp.slot], isNew: sp.slot === 'low' || sp.slot === 'over' });
  }
  const sup = SPECIAL_ORDER.find((s) => s.slot === 'super'), smv = specialMove(ch, 'super');
  rows.push({ group: 'SUPER', slot: 'super', name: ch.specials.super.name, input: motionTokens(sup.motion, sup.btn), dmg: smv.dmg, startup: smv.s + 1, note: SLOT_NOTE.super });
  K.chains.forEach((c, ci) => { const moves = c.seq.map((_, i) => chainMove(ch, ci, i));
    rows.push({ group: 'STRINGS', slot: `chain${ci}`, name: c.name, input: c.seq.flatMap((k, i) => (i ? ['>', BTN[k]] : [BTN[k]])), dmg: comboDamage(moves), hits: c.seq.length, note: c.end?.launch ? 'last hit launches' : c.end?.trip ? 'last hit knocks down' : c.end?.kb ? 'last hit pushes far' : `${c.seq.length}-hit string`, isNew: true });
  });
  const canc = [...CANCEL_BASE, ...K.hc].map((k) => (k[0] === 'c' ? 'cr.' + BTN[k.slice(1)] : BTN[k]));
  rows.push({ group: 'CANCELS', slot: 'cancel', name: 'Special cancel', input: ['xx', 'SP'], note: `${canc.join(' ')} and every string hit cancel into any special or the super on hit/block`, isNew: true });
  rows.push({ group: 'BASICS', slot: 'throw', name: 'Throw', input: ['F', '+', 'HP'], dmg: Math.round(THROW.dmg * (ch.pow || 1)), note: 'close, unblockable' });
  return rows;
}

// Combo Trainer drills for a fighter, all built from the kit. step: { label tokens, move = the move name that must hit,
// pad = how to input it (dir: held direction, motion + btn, or btn alone) }.
export function drills(ch) {
  const K = kitFor(ch), out = [];
  K.chains.forEach((c, ci) => out.push({ id: `chain${ci}`, name: c.name, steps: c.seq.map((k, i) => ({ tokens: [BTN[k]], move: i === 0 ? k : chainName(ci, i), btn: k })) }));
  out.push({ id: 'lk-low', name: `LK xx ${K.low.name}`, steps: [{ tokens: ['LK'], move: 'lk', btn: 'lk' }, { tokens: motionTokens('dd', 'LK'), move: 'low', motion: 'dd', btn: 'lk' }] });
  out.push({ id: 'launch-rise', name: `Launcher xx ${ch.specials.rise.name}`, steps: [{ tokens: ['D', '+', 'HP'], move: 'chp', dir: 'd', btn: 'hp' }, { tokens: motionTokens('dd', 'LP'), move: 'rise', motion: 'dd', btn: 'lp' }] });
  const c0 = K.chains[0];
  out.push({ id: 'string-super', name: `${c0.name} xx Super`, superMeter: true, steps: [...c0.seq.map((k, i) => ({ tokens: [BTN[k]], move: i === 0 ? k : chainName(0, i), btn: k })), { tokens: motionTokens('qcf', 'HK'), move: 'super', motion: 'qcf', btn: 'hk' }] });
  return out;
}
