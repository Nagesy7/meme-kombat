import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch, step, cpuInput } from '../src/logic.js';
import { Lockstep, encode, decode, stateHash, resultReport, CHECK_EVERY } from '../src/netcode.js';

const scripted = (seed) => { let s = seed; return () => { s = (s * 1103515245 + 12345) >>> 0; return s; }; };
// two peers exchange packets through a laggy, reordering "network"; their simulations must stay bit-identical
function playOnline({ delay = 4, lag = 3, jitter = 3, frames = 4000, seed = 99 } = {}) {
  const peers = [0, 1].map((me) => ({ me, ls: new Lockstep({ me, delay }), m: makeMatch('inu', 'bonkus', { seed }), hashes: [] }));
  const net = []; let now = 0; const rnd = scripted(seed);
  const brains = [0, 1].map((i) => { const ghost = makeMatch('inu', 'bonkus', { seed: seed + i }); return () => { for (let k = 0; k < 2; k++) step(ghost, [{}, {}]); return cpuInput(ghost, i, 0.8); }; });
  for (; now < frames; now++) {
    for (const p of peers) {
      const pkt = p.ls.pushLocal(rnd() % 3 ? brains[p.me]() : encode({ r: p.me === 0, l: p.me === 1, hp: rnd() % 2 }));
      if (pkt) net.push({ to: 1 - p.me, at: now + lag + (rnd() % (jitter + 1)), pkt });
      let n = 0; while (p.ls.ready() && n++ < 3 && p.m.phase !== 'matchEnd') { step(p.m, p.ls.take()); p.m.events.length = 0; const ck = p.ls.checkpoint(stateHash(p.m)); if (ck) { p.hashes.push(ck.h); net.push({ to: 1 - p.me, at: now + lag, pkt: ck }); } }
    }
    for (let i = net.length - 1; i >= 0; i--) if (net[i].at <= now) { peers[net[i].to].ls.receive(net[i].pkt); net.splice(i, 1); }
    if (peers.every((p) => p.m.phase === 'matchEnd')) break;
  }
  return peers;
}

test('input bit encoding round-trips', () => { const i = { u: 1, r: 1, hk: 1 }; assert.deepEqual(decode(encode(i)), i); assert.equal(encode({}), 0); });

test('lockstep: two peers over a laggy jittery link stay in sync (hashes identical, no desync)', () => {
  const [a, b] = playOnline({ frames: 30000 });
  assert.ok(a.hashes.length > 10); assert.deepEqual(a.hashes.slice(0, b.hashes.length), b.hashes.slice(0, a.hashes.length));
  assert.equal(a.ls.desync, null); assert.equal(b.ls.desync, null);
  assert.equal(stateHash(a.m), stateHash(b.m));
  if (a.m.phase === 'matchEnd') assert.deepEqual(resultReport(a.m), resultReport(b.m));
});

test('lockstep never runs ahead without remote input (stalls instead of guessing)', () => {
  const ls = new Lockstep({ me: 0, delay: 3 }); let sent = 0; for (let i = 0; i < 10; i++) if (ls.pushLocal({})) sent++;
  assert.equal(sent, 1, 'local input capped at delay ahead');
  let steps = 0; while (ls.ready()) { ls.take(); steps++; } assert.equal(steps, 3); // only the pre-filled frames
  ls.receive({ t: 'in', k: 3, b: encode({ lp: 1 }) }); assert.ok(ls.ready()); assert.deepEqual(ls.take()[1], { lp: 1 });
});

test('desync is detected from mismatching checksums', () => {
  const ls = new Lockstep({ me: 1, delay: 2 }); ls.tick = CHECK_EVERY; ls.checkpoint('aaaaaaaa'); ls.receive({ t: 'ck', k: CHECK_EVERY, h: 'bbbbbbbb' });
  assert.ok(ls.desync && ls.desync.tick === CHECK_EVERY);
});

test('same seed + same inputs => identical state; different input => different hash', () => {
  const run = (extra) => { const m = makeMatch('wiffy', 'toot', { seed: 5 }); for (let i = 0; i < 320; i++) step(m, [i >= 100 && i < 140 && extra ? { l: 1, u: 1 } : { r: 1, lp: i % 7 === 0 }, { l: 1, lk: i % 11 === 0 }]); return stateHash(m); };
  assert.equal(run(false), run(false)); assert.notEqual(run(false), run(true));
});
