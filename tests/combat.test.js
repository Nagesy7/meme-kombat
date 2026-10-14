import test from 'node:test'; import assert from 'node:assert/strict';
import { mkMatch, step, applyHit, NORMALS, cpuInput, canBlock } from '../src/logic.js';
import { computeFees, elo, prizeFor, PRIZE_SHARES, FEE_BPS, TREASURY } from '../src/kibble.js';
import { ROSTER, BOSS } from '../src/roster.js';

const fight = (a = 'inu', b = 'peepo') => { const m = mkMatch(a, b, { seed: 3 }); for (let i = 0; i < 90; i++) step(m, [{}, {}]); assert.equal(m.phase, 'fight'); return m; };
const close = (m, d = 50) => { m.f[0].x = 300; m.f[1].x = 300 + d; };
const run = (m, n, i0 = {}, i1 = {}) => { for (let i = 0; i < n; i++) step(m, [typeof i0 === 'function' ? i0(i) : i0, typeof i1 === 'function' ? i1(i) : i1]); };

test('roster: 10 fighters + boss, each with 3 specials + super + finisher', () => {
  assert.equal(ROSTER.length, 10); assert.ok(BOSS.boss);
  for (const c of [...ROSTER, BOSS]) { for (const k of ['proj', 'rush', 'rise', 'super']) assert.ok(c.specials[k].name); assert.ok(c.fin.name); }
  assert.ok(!JSON.stringify([...ROSTER, BOSS]).match(/kombat|fatality|mortal|finish him|get over here/i));
  assert.ok(!JSON.stringify([...ROSTER, BOSS]).match(/peng/i), 'PENGU parody removed');
  const mm = ROSTER.find((c) => c.id === 'moneymew'); assert.ok(mm && mm.head === 'cat' && mm.fin.kind === 'litter' && mm.alt);
});
test('light punch damages and puts defender in hitstun', () => {
  const m = fight(); close(m); run(m, 1, { lp: 1 }); run(m, 6);
  assert.equal(m.f[1].hp, 1000 - NORMALS.lp.dmg); assert.equal(m.f[1].st, 'hitstun');
});
test('holding back blocks high attacks: no damage, blockstun', () => {
  const m = fight(); close(m); m.f[1].face = -1;
  run(m, 1, { lp: 1 }, { r: 1 }); run(m, 6, {}, { r: 1 });
  assert.equal(m.f[1].hp, 1000); assert.ok(['blockstun', 'block', 'idle'].includes(m.f[1].st));
});
test('low attacks beat standing block, crouch block stops them', () => {
  const d = { holdBack: true, crouchHeld: false, y: 0, st: 'block' };
  assert.equal(canBlock(d, 'low'), false); assert.equal(canBlock({ ...d, crouchHeld: true }, 'low'), true);
  assert.equal(canBlock({ ...d, crouchHeld: true }, 'over'), false); assert.equal(canBlock(d, 'over'), true);
});
test('specials do chip damage through block', () => {
  const m = fight(); const [a, b] = m.f; b.holdBack = true; b.st = 'block';
  const r = applyHit(m, a, b, { dmg: 100, bs: 10, kb: 4, lvl: 'mid', chip: true, x: [0, 0], y: [0, 0] });
  assert.equal(r, 'block'); assert.equal(b.hp, 985);
});
test('combo: chained hits increase counter with damage scaling', () => {
  const m = fight(); const [a, b] = m.f; const mv = { ...NORMALS.lp };
  applyHit(m, a, b, mv); applyHit(m, a, b, mv); applyHit(m, a, b, mv);
  assert.equal(a.combo, 3); assert.equal(b.hp, 1000 - 40 - 35 - 30);
});
test('juggle: launcher sends opponent airborne, juggle hits connect up to the cap', () => {
  const m = fight(); const [a, b] = m.f;
  applyHit(m, a, b, NORMALS.chp); assert.equal(b.st, 'air'); assert.ok(b.vy > 5);
  for (let i = 0; i < 3; i++) assert.equal(applyHit(m, a, b, NORMALS.lp), 'hit');
  assert.equal(applyHit(m, a, b, NORMALS.lp), 'miss', 'juggle cap reached');
});
test('QCF + P input motion spawns a projectile', () => {
  const m = fight(); m.f[0].x = 150; m.f[1].x = 500;
  const seq = [{ d: 1 }, { d: 1 }, { d: 1, r: 1 }, { d: 1, r: 1 }, { r: 1 }, { r: 1, lp: 1 }];
  run(m, seq.length, (i) => seq[i]); run(m, 14);
  assert.equal(m.proj.length, 1); assert.equal(m.proj[0].owner, 0);
});
test('super needs a full meter and spends it', () => {
  const m = fight(); close(m, 60); const seq = [{ d: 1 }, { d: 1, r: 1 }, { r: 1 }, { r: 1, hk: 1 }];
  run(m, 4, (i) => seq[i]); assert.notEqual(m.f[0].move?.name, 'super');
  run(m, 40); m.f[0].meter = 100; m.f[0].prev = {}; run(m, 4, (i) => seq[i]);
  assert.equal(m.f[0].move?.name, 'super'); assert.equal(m.f[0].meter, 0);
});
test('throw is unblockable when close', () => {
  const m = fight(); close(m, 40); run(m, 1, { r: 1, hp: 1 }, { r: 1 }); run(m, 20);
  assert.ok(m.f[1].hp < 1000);
});
test('round flow: KO -> round 2 -> best of 3 -> finish window -> finisher -> match end', () => {
  const m = fight(); m.f[1].hp = 1; close(m); run(m, 1, { lp: 1 }); run(m, 10);
  assert.equal(m.phase, 'ko'); assert.deepEqual(m.wins, [1, 0]);
  run(m, 300); assert.equal(m.round, 2); assert.equal(m.phase, 'fight'); assert.equal(m.f[1].hp, 1000);
  m.f[1].hp = 1; close(m); run(m, 1, { lp: 1 }); run(m, 100);
  assert.equal(m.matchWinner, 0); assert.equal(m.phase, 'finish');
  const fin = [{ d: 1 }, {}, { d: 1 }, { d: 1, hk: 1 }]; run(m, 4, (i) => fin[i]);
  assert.equal(m.phase, 'finisher'); assert.equal(m.finisher.kind, 'rug');
  run(m, 210); assert.equal(m.phase, 'matchEnd');
});
test('time over: higher HP wins the round', () => {
  const m = fight(); m.f[0].hp = 500; m.timer = 1; run(m, 2); assert.deepEqual(m.wins, [0, 1]);
});
test('CPU vs CPU completes a match deterministically without errors', () => {
  const m = mkMatch('bonkus', 'rugsworth', { seed: 11 }); let n = 0;
  while (m.phase !== 'matchEnd' && n++ < 60 * 60 * 8) step(m, [cpuInput(m, 0, 0.7), cpuInput(m, 1, 0.7)]);
  assert.equal(m.phase, 'matchEnd'); assert.ok(m.matchWinner === 0 || m.matchWinner === 1);
});
test('kibble fee split: 2% total = 1% treasury + 0.25/0.5/0.25 pools', () => {
  const f = computeFees(250_000_000n); assert.equal(f.treasury, 2_500_000n); assert.equal(f.daily, 625_000n); assert.equal(f.weekly, 1_250_000n); assert.equal(f.monthly, 625_000n); assert.equal(f.fee, 5_000_000n);
  assert.equal(FEE_BPS.treasury + FEE_BPS.daily + FEE_BPS.weekly + FEE_BPS.monthly, 200); assert.equal(TREASURY, 'BzLYTFAfUsjzQ5x8bx5BbPK4DFtaHrLCuferkvkxTNGJ');
});
test('Elo + rank prizes: deterministic, zero-sum, no draws', () => {
  const [a, b] = elo(1200, 1200, 1); assert.equal(a, 1216); assert.equal(b, 1184);
  assert.ok(Math.abs(PRIZE_SHARES.reduce((s, x) => s + x, 0) - 1) < 1e-9); assert.equal(prizeFor(1, 1000), 400); assert.equal(prizeFor(11, 1000), 0);
});
test('Moneymew finisher runs through to match end', () => {
  const m = mkMatch('moneymew', 'boomer', { seed: 5 }); for (let i = 0; i < 90; i++) step(m, [{}, {}]);
  for (let r = 0; r < 2; r++) { while (m.phase !== 'fight') step(m, [{}, {}]); m.f[1].hp = 1; m.f[0].x = 300; m.f[1].x = 350; step(m, [{ lp: 1 }, {}]); for (let i = 0; i < 12; i++) step(m, [{}, {}]); }
  for (let i = 0; i < 100; i++) step(m, [{}, {}]); assert.equal(m.phase, 'finish');
  const fin = [{ d: 1 }, {}, { d: 1 }, { d: 1, hk: 1 }]; for (const f of fin) step(m, [f, {}]);
  assert.equal(m.finisher.kind, 'litter'); for (let i = 0; i < 210; i++) step(m, [{}, {}]); assert.equal(m.phase, 'matchEnd');
});
