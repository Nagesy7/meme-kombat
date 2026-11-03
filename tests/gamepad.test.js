// Gamepad layer: standard mapping, deadzone, stick motions, PS/Xbox detection, hot-plug, remap persistence, two-pad 1v1,
// and proof that pad input reaches the sim as the exact same bits (and checksums) as the equivalent keyboard input.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch, step } from '../src/logic.js';
import { encode, stateHash, resultReport } from '../src/netcode.js';
import { DEADZONE, B, padFamily, label, DEFAULT_MAP, ACTIONS, normMap, remap, loadMap, saveMap, resetMap, MAP_KEY, stickDirs, readGamepad, PadPlayer, PadManager, hintLine } from '../src/gamepad.js';

const gp = ({ id = 'Generic pad', index = 0, axes = [0, 0, 0, 0], down = [], connected = true } = {}) =>
  ({ id, index, connected, mapping: 'standard', axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i), value: down.includes(i) ? 1 : 0 })) });
const nav = (list) => ({ getGamepads: () => list.slice() });
const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const fight = (a = 'inu', b = 'croakley') => { const m = makeMatch(a, b, { seed: 3 }); for (let i = 0; i < 90; i++) step(m, [{}, {}]); assert.equal(m.phase, 'fight'); return m; };

test('PS vs Xbox vs generic detection from the gamepad id', () => {
  assert.equal(padFamily('DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)'), 'ps');
  assert.equal(padFamily('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'), 'ps'); // DualShock 4 over Bluetooth
  assert.equal(padFamily('054c-05c4-Wireless Controller'), 'ps'); // Firefox style id
  assert.equal(padFamily('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
  assert.equal(padFamily('xinput'), 'xbox');
  assert.equal(padFamily('8BitDo Pro 2 (Vendor: 2dc8 Product: 6006)'), 'generic');
  assert.equal(padFamily(''), 'generic');
  assert.deepEqual([0, 1, 2, 3].map((b) => label('ps', b)), ['✕', '○', '□', '△']);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((b) => label('xbox', b)), ['A', 'B', 'X', 'Y', 'LB', 'RB']);
  assert.deepEqual([4, 5].map((b) => label('ps', b)), ['L1', 'R1']);
  assert.match(hintLine('ps'), /□ LP {2}△ HP {2}✕ LK {2}○ HK {2}L1 SPECIAL {2}R1 SUPER {2}L2 BLOCK/);
  assert.match(hintLine('xbox'), /X LP {2}Y HP {2}A LK {2}B HK {2}LB SPECIAL {2}RB SUPER {2}LT BLOCK/);
});

test('standard mapping: face buttons are LP/HP/LK/HK, shoulders and triggers are special/super/block/launcher', () => {
  assert.deepEqual(DEFAULT_MAP, { lp: B.W, hp: B.N, lk: B.S, hk: B.E, special: B.L1, super: B.R1, block: B.L2, launch: B.R2 });
  assert.deepEqual([B.S, B.E, B.W, B.N, B.L1, B.R1, B.L2, B.R2, B.SELECT, B.START, B.UP, B.DOWN, B.LEFT, B.RIGHT], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 13, 14, 15]);
  const r = readGamepad(gp({ down: [B.W, B.E, B.UP] }));
  assert.deepEqual(r.act, { lp: 1, hp: 0, lk: 0, hk: 1, special: 0, super: 0, block: 0, launch: 0 }); assert.deepEqual(r.dirs, { u: 1, d: 0, l: 0, r: 0 });
  const P = new PadPlayer(); assert.deepEqual(P.fightBits(r), { u: 1, lp: 1, hk: 1 });
  // D-pad and stick both move; opposite directions cancel (same as keyboard intent)
  assert.deepEqual(readGamepad(gp({ axes: [-1, 0] })).dirs, { u: 0, d: 0, l: 1, r: 0 });
  assert.deepEqual(readGamepad(gp({ axes: [-1, 0], down: [B.RIGHT] })).dirs, { u: 0, d: 0, l: 0, r: 0 });
  // analog trigger with value only (some browsers report pressed=false under a threshold)
  const t = gp(); t.buttons[B.L2] = { pressed: false, value: 0.9 }; assert.equal(readGamepad(t).act.block, 1);
  // block holds back relative to facing
  assert.deepEqual(new PadPlayer().fightBits(readGamepad(gp({ down: [B.L2] })), 1), { l: 1 });
  assert.deepEqual(new PadPlayer().fightBits(readGamepad(gp({ down: [B.L2] })), -1), { r: 1 });
});

test('radial deadzone: small drift is neutral, past the deadzone gives 8-way directions', () => {
  assert.ok(DEADZONE >= 0.25 && DEADZONE <= 0.5);
  for (const [x, y] of [[0, 0], [0.2, 0.1], [0.24, -0.24], [-0.3, 0.1], [0.1, 0.33]]) assert.deepEqual(stickDirs(x, y), { u: 0, d: 0, l: 0, r: 0 }, `${x},${y} neutral`);
  const want = { '1,0': 'r', '-1,0': 'l', '0,1': 'd', '0,-1': 'u', '0.7,0.7': 'dr', '-0.7,0.7': 'dl', '0.7,-0.7': 'ur', '-0.7,-0.7': 'ul', '0.9,0.3': 'r', '0.3,0.9': 'd', '0.5,0.0': 'r' };
  for (const [k, v] of Object.entries(want)) { const [x, y] = k.split(',').map(Number), s = stickDirs(x, y); assert.equal(['u', 'd', 'l', 'r'].filter((d) => s[d]).join('').split('').sort().join(''), v.split('').sort().join(''), k); }
  assert.deepEqual(stickDirs(NaN, undefined), { u: 0, d: 0, l: 0, r: 0 });
});

test('stick quarter-circle rolls (↓↘→ and ↓↙←) drive real specials in the sim', () => {
  const roll = (pts, btn) => [...pts.map((a) => gp({ axes: a })), gp({ axes: pts[pts.length - 1], down: [btn] })];
  // facing right: ↓ ↘ → + □(LP) = projectile
  let m = fight(), P = new PadPlayer(); m.f[0].x = 150; m.f[1].x = 500;
  for (const g of roll([[0, 1], [0, 1], [0.72, 0.7], [0.72, 0.7], [1, 0]], B.W)) step(m, [P.fightBits(readGamepad(g), m.f[0].face), {}]);
  for (let i = 0; i < 14; i++) step(m, [{}, {}]); assert.equal(m.proj.length, 1, 'qcf+P from the stick'); assert.equal(m.proj[0].owner, 0);
  // P2 facing left: ↓ ↙ ← is that fighter's forward roll
  m = fight(); P = new PadPlayer(); m.f[0].x = 150; m.f[1].x = 500; assert.equal(m.f[1].face, -1);
  for (const g of roll([[0, 1], [0, 1], [-0.7, 0.72], [-0.7, 0.72], [-1, 0]], B.W)) step(m, [{}, P.fightBits(readGamepad(g), m.f[1].face)]);
  for (let i = 0; i < 14; i++) step(m, [{}, {}]); assert.equal(m.proj.length, 1); assert.equal(m.proj[0].owner, 1);
  // L1 = special macro (the same input sequence, button on the last step), relative to facing
  m = fight(); P = new PadPlayer(); m.f[0].x = 150; m.f[1].x = 500;
  for (let i = 0; i < 8; i++) step(m, [P.fightBits(readGamepad(gp({ down: i < 2 ? [B.L1] : [] })), m.f[0].face), {}]);
  for (let i = 0; i < 14; i++) step(m, [{}, {}]); assert.equal(m.proj.length, 1, 'L1 macro fires the shot');
  // R1 = super macro needs a full meter, like the keyboard motion
  m = fight(); P = new PadPlayer(); m.f[0].x = 300; m.f[1].x = 340; m.f[0].meter = 100;
  for (let i = 0; i < 6; i++) step(m, [P.fightBits(readGamepad(gp({ down: i < 1 ? [B.R1] : [] })), m.f[0].face), {}]);
  assert.equal(m.f[0].move?.name, 'super'); assert.equal(m.f[0].meter, 0);
});

test('hot-plug: connect/disconnect events, slots in connect order, slot reuse, no crash on odd navigators', () => {
  const list = [], M = new PadManager(nav(list)); assert.deepEqual(M.poll(), []); assert.equal(M.count(), 0); assert.equal(M.pad(0), null);
  list[0] = gp({ id: 'DualSense Wireless Controller (Vendor: 054c)', index: 0 });
  let ev = M.poll(); assert.equal(ev.length, 1); assert.deepEqual([ev[0].type, ev[0].family, ev[0].slot], ['connect', 'ps', 0]);
  list[1] = gp({ id: 'Xbox Wireless Controller (Vendor: 045e)', index: 1 });
  ev = M.poll(); assert.deepEqual([ev[0].type, ev[0].family, ev[0].slot], ['connect', 'xbox', 1]); assert.equal(M.count(), 2);
  assert.deepEqual(M.poll(), [], 'no repeat events'); assert.equal(M.family(1), 'xbox');
  list[0] = null; ev = M.poll(); assert.deepEqual([ev[0].type, ev[0].slot], ['disconnect', 0]); assert.equal(M.pad(0), null); assert.equal(M.family(1), 'xbox', 'P2 keeps its slot');
  list[2] = gp({ id: 'Generic USB Joystick', index: 2 }); ev = M.poll(); assert.deepEqual([ev[0].family, ev[0].slot], ['generic', 0], 'free slot is reused');
  list[3] = gp({ id: 'Third pad', index: 3 }); ev = M.poll(); assert.equal(ev[0].slot, -1, 'a third pad gets no player slot');
  list[1] = gp({ id: 'Some other pad', index: 1 }); ev = M.poll(); assert.deepEqual(ev.map((e) => e.type), ['disconnect', 'connect'], 'id change at the same index = replug');
  // a pad reported with connected=false counts as gone
  list[2] = { ...list[2], connected: false }; ev = M.poll(); assert.equal(ev[0].type, 'disconnect');
  for (const n of [null, {}, { getGamepads: () => null }, { getGamepads: () => { throw new Error('denied'); } }]) { const X = new PadManager(n); assert.deepEqual(X.poll(), []); assert.equal(X.count(), 0); }
  // PadPlayer reset clears a running macro so a mid-macro unplug can't leak inputs
  const P = new PadPlayer(); P.fightBits(readGamepad(gp({ down: [B.L1] })), 1); assert.ok(P.macro); P.reset(); assert.equal(P.macro, null); assert.deepEqual(P.fightBits(readGamepad(gp()), 1), {});
});

test('remap: 1:1 swaps, saved per glyph family on the device, reset to default', () => {
  const S = store();
  assert.deepEqual(loadMap(S, 'ps'), DEFAULT_MAP);
  const m = remap(DEFAULT_MAP, 'lp', B.S); assert.equal(m.lp, B.S); assert.equal(m.lk, B.W, 'the action that had ✕ takes the old button');
  assert.equal(new Set(ACTIONS.map((a) => m[a])).size, ACTIONS.length);
  saveMap(S, 'ps', m); assert.ok(S.m.has(MAP_KEY('ps')));
  assert.deepEqual(loadMap(S, 'ps'), m, 'PS map persisted'); assert.deepEqual(loadMap(S, 'xbox'), DEFAULT_MAP, 'Xbox map untouched');
  saveMap(S, 'xbox', remap(DEFAULT_MAP, 'block', B.R2)); assert.equal(loadMap(S, 'xbox').block, B.R2); assert.equal(loadMap(S, 'xbox').launch, B.L2); assert.deepEqual(loadMap(S, 'ps'), m);
  // the remapped button drives the action
  assert.equal(new PadPlayer().fightBits(readGamepad(gp({ down: [B.S] }), loadMap(S, 'ps'))).lp, 1);
  // corrupt / partial / duplicate storage falls back safely
  S.setItem(MAP_KEY('generic'), '{"lp":2,"hp":2,"lk":99}'); const g = loadMap(S, 'generic'); assert.equal(new Set(ACTIONS.map((a) => g[a])).size, ACTIONS.length); assert.ok(ACTIONS.every((a) => g[a] >= 0 && g[a] <= 7));
  S.setItem(MAP_KEY('generic'), 'nope'); assert.deepEqual(loadMap(S, 'generic'), DEFAULT_MAP);
  assert.deepEqual(normMap(null), DEFAULT_MAP); assert.deepEqual(loadMap(null, 'ps'), DEFAULT_MAP, 'no storage = defaults');
  assert.deepEqual(resetMap(S, 'ps'), DEFAULT_MAP); assert.deepEqual(loadMap(S, 'ps'), DEFAULT_MAP); assert.equal(loadMap(S, 'xbox').block, B.R2, 'reset is per family');
});

test('two pads in local 1v1: pad 1 drives P1, pad 2 drives P2, independently', () => {
  const list = [gp({ id: 'DualSense (054c)', index: 0 }), gp({ id: 'Xbox Wireless Controller (045e)', index: 1 })], M = new PadManager(nav(list)), PP = [new PadPlayer(), new PadPlayer()];
  M.poll(); const m = fight(); m.f[0].x = 150; m.f[1].x = 500; const x1 = m.f[1].x; let shot = false;
  // pad 1 rolls a fireball on the stick, pad 2 holds left (walks forward) at the same time
  const s1 = [[0, 1], [0, 1], [0.7, 0.7], [0.7, 0.7], [1, 0], [1, 0]];
  for (let t = 0; t < 30; t++) {
    list[0] = gp({ id: list[0].id, index: 0, axes: s1[Math.min(t, 5)] || [0, 0], down: t === 5 ? [B.W] : [] }); if (t > 6) list[0] = gp({ id: list[0].id, index: 0 });
    list[1] = gp({ id: list[1].id, index: 1, down: [B.LEFT] }); M.poll();
    const two = [0, 1].map((s) => PP[s].fightBits(readGamepad(M.pad(s), DEFAULT_MAP), m.f[s].face));
    assert.ok(!two[0].l, 'pad 2 never feeds P1'); assert.ok(!two[1].lp && !two[1].d, 'pad 1 never feeds P2');
    step(m, two); if (m.proj.some((p) => p.owner === 0)) shot = true;
  }
  assert.ok(shot, 'P1 shot from pad 1');
  assert.ok(m.f[1].x < x1, 'P2 walked from pad 2');
  // unplugging pad 2 frees only P2
  list[1] = null; M.poll(); assert.equal(M.pad(1), null); assert.ok(M.pad(0));
});

test('pad input encodes to the same bits as the keyboard and gives identical match checksums', () => {
  // deterministic pseudo-random "intent" script: which directions + buttons a player holds each tick
  let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const N = 60 * 40, script = [];
  for (let t = 0, cur = {}; t < N; t++) { if (t % 5 === 0) { cur = {}; const dx = Math.floor(rnd() * 3) - 1, dy = Math.floor(rnd() * 3) - 1; if (dx < 0) cur.l = 1; if (dx > 0) cur.r = 1; if (dy < 0) cur.u = 1; if (dy > 0) cur.d = 1; for (const k of ['lp', 'hp', 'lk', 'hk']) if (rnd() < 0.15) cur[k] = 1; } script.push(cur); }
  const S = store(); saveMap(S, 'ps', remap(DEFAULT_MAP, 'lp', B.S)); const maps = [DEFAULT_MAP, loadMap(S, 'ps')];
  for (const map of maps) {
    const pad = (c, t) => { const down = []; for (const k of ['lp', 'hp', 'lk', 'hk']) if (c[k]) down.push(map[k]);
      // alternate D-pad and stick every 100 ticks; stick uses full-tilt diagonals
      if (Math.floor(t / 100) % 2) return gp({ axes: [c.l ? -1 : c.r ? 1 : 0, c.u ? -1 : c.d ? 1 : 0].map((v, i, a) => (a[0] && a[1] ? v * 0.72 : v)), down });
      if (c.u) down.push(B.UP); if (c.d) down.push(B.DOWN); if (c.l) down.push(B.LEFT); if (c.r) down.push(B.RIGHT); return gp({ down }); };
    const mk = makeMatch('moneymew', 'boomer', { seed: 9 }), mp = makeMatch('moneymew', 'boomer', { seed: 9 }), P = new PadPlayer();
    const cpu = (t) => script[(t * 7 + 13) % N];
    let t = 0;
    for (; t < 60 * 60 * 10 && mk.phase !== 'matchEnd'; t++) {
      const kb = script[t % N], pb = P.fightBits(readGamepad(pad(kb, t), map), mp.f[0].face);
      assert.equal(encode(pb), encode(kb), `tick ${t} bits`);
      step(mk, [kb, cpu(t)]); step(mp, [pb, cpu(t)]);
      if (t % 60 === 0) assert.equal(stateHash(mp), stateHash(mk), `tick ${t} checksum`);
    }
    assert.equal(mk.phase, 'matchEnd', 'played to a result'); assert.equal(mp.phase, 'matchEnd');
    assert.equal(stateHash(mp), stateHash(mk)); assert.deepEqual(resultReport(mp), resultReport(mk));
  }
});
