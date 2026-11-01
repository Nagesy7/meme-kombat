// Combo update (rules 2): strings, cancels and the new specials are executable from real inputs, specials come from simple
// stick motions, the Move List is generated from the move data, and online/replay stay deterministic (old clips included).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeMatch, step, cpuInput, RULES } from '../src/logic.js';
import { NORMALS, KITS, kitFor, drills, moveList, specialMove, specialName, chainMove, comboDamage, motionTokens, SPECIAL_ORDER, CANCEL_BASE } from '../src/moves.js';
import { DrillDriver, ComboTracker, stepPads } from '../src/trainer.js';
import { encode, decode, Lockstep, stateHash, resultReport } from '../src/netcode.js';
import { InputRecorder, replayTo, clipRules } from '../src/replay.js';
import { stickDir, mergePad } from '../src/touchinput.js';
import { ROSTER, BOSS } from '../src/roster.js';

const ALL = [...ROSTER, BOSS];
const fresh = (p1, p2 = p1 === 'sealbert' ? 'boomer' : 'sealbert', gap = 56, rules) => { const m = makeMatch(p1, p2, { seed: 11, o2: { hp: 9999 }, rules }); m.phase = 'fight'; m.banner = null; m.f[0].x = 250; m.f[1].x = 250 + gap; return m; };
const moveObj = (ch, name) => { if (NORMALS[name]) return NORMALS[name]; const t = /^t(\d)\.(\d)$/.exec(name); if (t) return chainMove(ch, +t[1], +t[2]); return specialMove(ch, name); };
// every pad goes through the online wire format, exactly like lockstep
const wire = (p) => decode(encode(p));

function runDrill(ch, d, { delay = 0, gap = 56, rules } = {}) {
  const m = fresh(ch.id, undefined, gap, rules); if (d.superMeter) m.f[0].meter = 100;
  const dr = new DrillDriver(d, 0, delay), tr = new ComboTracker(d), pads = [];
  for (let t = 0; t < 300 && !tr.done && !dr.failed; t++) { const p = wire(dr.next(m)); pads.push(p); step(m, [p, {}]); tr.feed(m.events, m); m.events.length = 0; }
  return { m, tr, pads };
}

test('every drill (strings, cancels, new specials, string xx super) combos from inputs for every fighter, with the listed damage', () => {
  for (const ch of ALL) for (const d of drills(ch)) for (const delay of [0, 1, 2, 3, 4]) {
    const { tr } = runDrill(ch, d, { delay });
    assert.ok(tr.done, `${ch.id} ${d.name} (input delay ${delay}) did not combo: reached step ${tr.best}/${d.steps.length}`);
    assert.equal(tr.hits, d.steps.length, `${ch.id} ${d.name}: one hit per step`);
    assert.equal(tr.dmg, comboDamage(d.steps.map((s) => moveObj(ch, s.move))), `${ch.id} ${d.name}: damage = scaled sum of the moves`);
  }
});

test('drills also combo from a few spacings, and open-loop replay of the raw pads gives the identical combo', () => {
  for (const ch of ALL) for (const d of drills(ch)) {
    for (const gap of [44, 50, 56, 60]) assert.ok(runDrill(ch, d, { gap }).tr.done, `${ch.id} ${d.name} at gap ${gap}`);
    const a = runDrill(ch, d), m = fresh(ch.id); if (d.superMeter) m.f[0].meter = 100; const tr = new ComboTracker(d);
    for (const p of a.pads) { step(m, [decode(encode(p)), {}]); tr.feed(m.events, m); m.events.length = 0; }
    assert.ok(tr.done && tr.dmg === a.tr.dmg, `${ch.id} ${d.name}: raw pad replay`); assert.equal(stateHash(m), stateHash(a.m));
  }
});

test('string steps: each chain step comes out from its button and shows up as its own hit', () => {
  for (const ch of ALL) kitFor(ch).chains.forEach((c, ci) => {
    const m = fresh(ch.id), names = []; let k = 0, wait = 0; // press the next button 2 ticks after the previous hit lands
    for (let t = 0; t < 200; t++) { let p = {}; if (k < c.seq.length && names.length === k && wait-- <= 0) { p = { [c.seq[k]]: 1 }; k++; wait = 2; }
      step(m, [wire(p), {}]); for (const e of m.events) if (e.type === 'hit') names.push(e.mv); m.events.length = 0; }
    assert.deepEqual(names, c.seq.map((key, i) => (i ? `t${ci}.${i}` : key)), `${ch.id} ${c.name}`);
  });
});

test('cancels: only on hit/block, only from cancellable normals (base list + the fighter hc list)', () => {
  for (const ch of ROSTER) {
    // LP whiff (dummy far away) + qcf+P right after: no cancel, LP plays out
    const m = fresh(ch.id, undefined, 200); step(m, [{ lp: 1 }, {}]); for (const p of stepPads({ motion: 'qcf', btn: 'lp' }, 1)) step(m, [wire(p), {}]);
    assert.equal(m.f[0].move?.name, 'lp', `${ch.id}: whiffed LP must not cancel`);
    // standing HP xx D,D+K: cancels only for fighters whose kit lists hp
    const n = fresh(ch.id); step(n, [{ hp: 1 }, {}]); let hit = false;
    for (let t = 0; t < 30 && !hit; t++) { step(n, [{}, {}]); hit = n.events.some((e) => e.type === 'hit'); n.events.length = 0; }
    assert.ok(hit, `${ch.id}: HP connects`); for (const p of stepPads({ motion: 'dd', btn: 'lk' }, 1)) { step(n, [wire(p), {}]); n.events.length = 0; }
    for (let t = 0; t < 12 && n.hitstop > 0; t++) step(n, [{}, {}]); step(n, [{}, {}]); step(n, [{}, {}]);
    const cancelled = n.f[0].move?.name === 'low';
    assert.equal(cancelled, kitFor(ch).hc.includes('hp'), `${ch.id}: HP cancel ${kitFor(ch).hc.includes('hp') ? 'expected' : 'not allowed'}`);
  }
  assert.deepEqual(CANCEL_BASE, ['lp', 'lk', 'clp', 'clk', 'chp']);
});

// thumb positions on a phone stick: angle in degrees (0 = right, 90 = down), or null = released to centre
const R = 40, knob = (a) => (a == null ? stickDir(0, 0, R) : stickDir(Math.cos((a * Math.PI) / 180) * R * 0.8, Math.sin((a * Math.PI) / 180) * R * 0.8, R));
const ROLLS = { // forward = 0deg for a fighter facing right
  qcf: [90, 90, 75, 60, 45, 30, 15, 0, 0], qcfNoDiag: [90, 90, 90, 0, 0], qcb: [90, 90, 105, 120, 135, 150, 165, 180, 180],
  dd: [90, 90, null, null, 90, 90], bf: [180, 180, 180, null, 0, 0] };
function stickSpecial(id, roll, btn, { face = 1, meter = 0 } = {}) {
  const m = face > 0 ? fresh(id, undefined, 120) : (() => { const x = fresh(id, undefined, 120); x.f[0].x = 420; x.f[1].x = 300; x.f[0].face = -1; x.f[1].face = 1; return x; })();
  m.f[0].meter = meter; const seq = ROLLS[roll].map((a) => (a == null ? null : face > 0 ? a : 180 - a));
  seq.forEach((a, i) => step(m, [wire(mergePad(knob(a), false, i === seq.length - 1 ? { [btn]: 1 } : {})), {}]));
  for (let t = 0; t < 2 && m.f[0].st !== 'attack'; t++) step(m, [wire(mergePad(knob(seq.at(-1)), false, {})), {}]);
  return m.f[0].move?.name;
}
test('specials trigger from simple phone-stick motions (both facings), via stickDir -> mergePad -> wire encoding', () => {
  for (const ch of ROSTER) for (const face of [1, -1]) {
    assert.equal(stickSpecial(ch.id, 'qcf', 'lp', { face }), 'proj', `${ch.id} qcf+P`);
    assert.equal(stickSpecial(ch.id, 'qcfNoDiag', 'hp', { face }), 'proj', `${ch.id} down,forward+P (diagonal skipped)`);
    assert.equal(stickSpecial(ch.id, 'bf', 'hk', { face }), 'rush', `${ch.id} back,forward+K`);
    assert.equal(stickSpecial(ch.id, 'dd', 'lp', { face }), 'rise', `${ch.id} D,D+P`);
    assert.equal(stickSpecial(ch.id, 'dd', 'lk', { face }), 'low', `${ch.id} D,D+K (new)`);
    assert.equal(stickSpecial(ch.id, 'qcb', 'lp', { face }), 'over', `${ch.id} qcb+P (new)`);
    assert.equal(stickSpecial(ch.id, 'qcf', 'hk', { face, meter: 100 }), 'super', `${ch.id} qcf+K with full meter`);
    assert.notEqual(stickSpecial(ch.id, 'qcf', 'hk', { face, meter: 0 }), 'super', `${ch.id} no super without meter`);
  }
});

test('rules 2 motions: rolling through neutral breaks a quarter circle (no accidental fireballs from walk-ups)', () => {
  const seq = [{ d: 1 }, { d: 1, r: 1 }, {}, {}, { r: 1 }, { r: 1, lp: 1 }];
  const m = fresh('inu', undefined, 150); for (const p of seq) step(m, [p, {}]); step(m, [{ r: 1 }, {}]);
  assert.notEqual(m.f[0].move?.name, 'proj');
  const l = fresh('inu', undefined, 150, 1); for (const p of seq) step(l, [p, {}]); step(l, [{ r: 1 }, {}]);
  assert.equal(l.f[0].move?.name, 'proj', 'rules 1 (old clips) keeps the old lenient motion');
});

test('new specials behave as listed: low slide must be crouch-blocked, overhead must be stand-blocked', () => {
  for (const ch of ROSTER) {
    const lo = specialMove(ch, 'low'), ov = specialMove(ch, 'over');
    assert.equal(lo.lvl, 'low'); assert.equal(ov.lvl, 'over'); assert.ok(lo.trip, 'slide knocks down');
    const hit = (slot, block) => { const m = fresh(ch.id, undefined, slot === 'low' ? 90 : 70); m.f[1].x = 600; m.f[0].x = 600 - (slot === 'low' ? 90 : 70); const seq = slot === 'low' ? stepPads({ motion: 'dd', btn: 'lk' }, 1) : stepPads({ motion: 'qcb', btn: 'lp' }, 1);
      let res = null; for (let t = 0; t < 60 && !res; t++) { step(m, [wire(seq[t] || {}), m.f[0].st === 'attack' ? block : block.d ? { d: 1 } : {}]); for (const e of m.events) if (e.mv === slot && (e.type === 'hit' || e.type === 'block')) res = e.type; m.events.length = 0; } return res; };
    assert.equal(hit('low', { r: 1 }), 'hit', `${ch.id} slide beats standing block`); assert.equal(hit('low', { r: 1, d: 1 }), 'block', `${ch.id} slide crouch-blocked`);
    assert.equal(hit('over', { r: 1, d: 1 }), 'hit', `${ch.id} overhead beats crouch block`); assert.equal(hit('over', { r: 1 }), 'block', `${ch.id} overhead stand-blocked`);
  }
});

test('Move List rows are generated from the move data (names, inputs, damage, startup, strings, cancels)', () => {
  for (const ch of ALL) {
    const rows = moveList(ch), K = kitFor(ch), by = (s) => rows.find((r) => r.slot === s);
    assert.equal(K, KITS[ch.id]);
    for (const sp of SPECIAL_ORDER) { const r = by(sp.slot), mv = specialMove(ch, sp.slot);
      assert.equal(r.name, sp.slot === 'super' ? ch.specials.super.name : specialName(ch, sp.slot)); assert.deepEqual(r.input, motionTokens(sp.motion, sp.btn)); assert.equal(r.dmg, mv.dmg); assert.equal(r.startup, mv.s + 1); }
    K.chains.forEach((c, ci) => { const r = by(`chain${ci}`); assert.equal(r.name, c.name); assert.equal(r.hits, c.seq.length);
      assert.deepEqual(r.input.filter((t) => t !== '>'), c.seq.map((k) => k.toUpperCase())); assert.equal(r.dmg, comboDamage(c.seq.map((_, i) => chainMove(ch, ci, i)))); });
    for (const k of K.hc) assert.ok(by('cancel').note.includes(k.toUpperCase()));
    const names = rows.map((r) => r.name); assert.equal(new Set(names).size, names.length, `${ch.id}: unique move names`);
    // every drill the trainer offers only uses moves the list shows
    for (const d of drills(ch)) for (const s of d.steps) assert.ok(NORMALS[s.move] || /^t\d\.\d$/.test(s.move) || by(s.move), `${ch.id} drill ${d.name}: ${s.move}`);
  }
});

test('kits stay distinct and balanced: unique string sets per fighter, string damage within a band', () => {
  const sig = ROSTER.map((ch) => JSON.stringify(kitFor(ch).chains.map((c) => c.seq))); assert.equal(new Set(sig).size, ROSTER.length, 'no two fighters share both strings');
  for (const ch of ROSTER) { for (const r of moveList(ch).filter((x) => x.group === 'STRINGS')) assert.ok(r.dmg >= 100 && r.dmg <= 190, `${ch.id} ${r.name} ${r.dmg}`);
    for (const s of ['low', 'over']) { const mv = specialMove(ch, s); assert.ok(mv.dmg >= 55 && mv.dmg <= 100 && mv.s + 1 >= 6, `${ch.id} ${s}`); } }
});

test('online: lockstep peers using strings, cancels and new specials stay bit-identical', () => {
  const script = drills(ROSTER[0]).flatMap((d) => [...d.steps.flatMap((s) => [...stepPads(s, 1), {}, {}, {}, {}]), ...Array(20).fill({})]);
  const seen = new Set();
  for (const delay of [2, 4]) {
    const peers = [0, 1].map((me) => ({ me, ls: new Lockstep({ me, delay }), m: makeMatch('inu', 'bonkus', { seed: 5 + delay }), hashes: [] })); const net = []; let k = 0;
    for (let now = 0; now < 9000; now++) {
      for (const p of peers) { const local = p.me === 0 ? (Math.floor(now / script.length) % 3 === 2 ? cpuInput(p.m, 0, 0.8) : script[now % script.length]) : cpuInput(p.m, 1, 0.7);
        // each peer only knows its own input; the CPU brain reads that peer's own copy of the match (identical by lockstep)
        const pkt = p.ls.pushLocal(encode(local)); if (pkt) net.push({ to: 1 - p.me, at: now + 3 + (k++ % 3), pkt });
        let n = 0; while (p.ls.ready() && n++ < 3 && p.m.phase !== 'matchEnd') { step(p.m, p.ls.take()); for (const e of p.m.events) if (e.mv && (e.type === 'hit' || e.type === 'block')) seen.add(e.mv); p.m.events.length = 0; const ck = p.ls.checkpoint(stateHash(p.m)); if (ck) { p.hashes.push(ck.h); net.push({ to: 1 - p.me, at: now + 3, pkt: ck }); } } }
      for (let i = net.length - 1; i >= 0; i--) if (net[i].at <= now) { peers[net[i].to].ls.receive(net[i].pkt); net.splice(i, 1); }
      if (peers.every((p) => p.m.phase === 'matchEnd')) break;
    }
    const [a, b] = peers; assert.equal(a.ls.desync, null); assert.equal(b.ls.desync, null); assert.ok(a.hashes.length > 10);
    assert.deepEqual(a.hashes.slice(0, b.hashes.length), b.hashes.slice(0, a.hashes.length)); assert.equal(stateHash(a.m), stateHash(b.m));
  }
  assert.ok([...seen].some((n) => /^t\d\.\d$/.test(n)), 'strings were used online'); assert.ok(seen.has('low') || seen.has('over'), 'new specials were used online');
});

test('replay: rules-2 clips with new moves replay to the same checksum; old rules-1 clips still verify (auto-detected)', () => {
  const m = makeMatch('wiffy', 'stampy', { seed: 321 }), rec = new InputRecorder(), names = new Set();
  while (m.phase !== 'matchEnd' && m.tick < 60 * 60 * 10) { const b0 = encode(cpuInput(m, 0, 0.9)), b1 = encode(cpuInput(m, 1, 0.8)); rec.add(m.tick, b0, b1); step(m, [decode(b0), decode(b1)]); for (const e of m.events) if (e.mv) names.add(e.mv); m.events.length = 0; }
  const report = resultReport(m), clip = { seed: 321, ticks: report.ticks, inputs: rec.inputs, players: [{ char: 'wiffy', skin: 'base' }, { char: 'stampy', skin: 'base' }], checksum: report.checksum };
  assert.ok([...names].some((n) => /^t\d\.\d$|^low$|^over$/.test(n)), 'the CPU match used new moves');
  assert.deepEqual(replayTo(clip, { makeMatch, step }).report, report); assert.equal(clipRules(clip, { makeMatch, step }), RULES);
  const legacy = JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-clips.json', import.meta.url))).clips;
  assert.ok(legacy.length >= 3);
  for (const c of legacy) { assert.equal(clipRules(c, { makeMatch, step }), 1, 'pre-update clip detected as rules 1');
    assert.equal(replayTo(c, { makeMatch, step }, c.ticks, 1).report.checksum, c.checksum, 'pre-update clip still replays to its stored checksum'); }
});
