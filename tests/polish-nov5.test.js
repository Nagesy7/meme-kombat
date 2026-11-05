// Nov 2026 polish: rules 3 slide tune (Bonkus, Toot Lord, Boomer Bob), rules-2 clips still verify, clean version-mismatch
// handshake on both sides, guest pill / BACK button layout wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeMatch, step, cpuInput, RULES } from '../src/logic.js';
import { KITS, drills, specialMove, RULESETS } from '../src/moves.js';
import { DrillDriver, ComboTracker } from '../src/trainer.js';
import { encode, decode, resultReport } from '../src/netcode.js';
import { InputRecorder, replayTo, clipRules } from '../src/replay.js';
import { ROSTER, BOSS, byId } from '../src/roster.js';

const ALL = [...ROSTER, BOSS], TUNED = ['bonkus', 'toot', 'boomer'];
function lkSlide(id, gap, delay, rules) {
  const ch = byId(id), d = drills(ch).find((x) => x.id === 'lk-low'), opp = id === 'sealbert' ? 'boomer' : 'sealbert';
  const m = makeMatch(id, opp, { seed: 11, o2: { hp: 9999 }, rules }); m.phase = 'fight'; m.banner = null; m.f[0].x = 250; m.f[1].x = 250 + gap;
  const dr = new DrillDriver(d, 0, delay), tr = new ComboTracker(d);
  for (let t = 0; t < 300 && !tr.done && !dr.failed; t++) { step(m, [decode(encode(dr.next(m))), {}]); tr.feed(m.events, m); m.events.length = 0; }
  return tr;
}
const maxLk = (id) => { const ch = byId(id), d = drills(ch).find((x) => x.id === 'lk-low'), one = { ...d, steps: [d.steps[0]] }; let g = 0;
  for (let gap = 30; gap < 140; gap++) { const m = makeMatch(id, 'sealbert', { seed: 11, o2: { hp: 9999 } }); m.phase = 'fight'; m.banner = null; m.f[0].x = 250; m.f[1].x = 250 + gap;
    const dr = new DrillDriver(one, 0, 0), tr = new ComboTracker(one); for (let t = 0; t < 120 && !tr.done && !dr.failed; t++) { step(m, [decode(encode(dr.next(m))), {}]); tr.feed(m.events, m); m.events.length = 0; } if (tr.hits) g = gap; } return g; };

test('rules 3 is current; the three tuned slides use the standard slide timing and keep their damage', () => {
  assert.equal(RULES, 3); assert.deepEqual(RULESETS, [3, 2, 1]);
  const std = specialMove(byId('inu'), 'low');
  for (const id of TUNED) { const ch = byId(id), now = specialMove(ch, 'low'), old = specialMove(ch, 'low', 2);
    assert.equal(now.s, std.s, `${id} startup = standard`); assert.equal(now.dash, std.dash, `${id} dash = standard`);
    assert.equal(now.dmg, old.dmg, `${id} damage unchanged`); assert.ok(old.s > now.s || old.dash < now.dash, `${id} rules 2 kept its old timing`); }
  for (const ch of ALL) if (!TUNED.includes(ch.id)) assert.deepEqual(specialMove(ch, 'low'), specialMove(ch, 'low', 2), `${ch.id} slide unchanged`);
});

test('LK xx slide connects at max LK range for the tuned fighters (it missed under rules 2)', () => {
  for (const id of TUNED) { const g = maxLk(id);
    for (const delay of [0, 1, 2]) assert.ok(lkSlide(id, g, delay).done, `${id} at max range ${g}, cancel delay ${delay}`);
    assert.ok(!lkSlide(id, g, 2, 2).done, `${id}: rules 2 really missed here (the bug)`); }
});

test('replays: a rules-2 clip with a tuned slide still verifies under rules 2; new clips verify under rules 3', () => {
  const play = (rules) => { const m = makeMatch('bonkus', 'toot', { seed: 77, rules }), rec = new InputRecorder(); let lows = 0;
    while (m.phase !== 'matchEnd' && m.tick < 60 * 60 * 10) { const b0 = encode(cpuInput(m, 0, 0.9)), b1 = encode(cpuInput(m, 1, 0.85)); rec.add(m.tick, b0, b1); step(m, [decode(b0), decode(b1)]); for (const e of m.events) if (e.mv === 'low') lows++; m.events.length = 0; }
    const r = resultReport(m); return { lows, clip: { seed: 77, ticks: r.ticks, inputs: rec.inputs, players: [{ char: 'bonkus', skin: 'base' }, { char: 'toot', skin: 'base' }], checksum: r.checksum } }; };
  const old = play(2), now = play(3), fns = { makeMatch, step };
  assert.equal(clipRules(old.clip, fns), 2, 'old clip detected as rules 2');
  assert.equal(replayTo(old.clip, fns, old.clip.ticks, 2).report.checksum, old.clip.checksum);
  assert.equal(clipRules(now.clip, fns), 3);
  const legacy = JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-clips.json', import.meta.url))).clips;
  for (const c of legacy) assert.equal(clipRules(c, fns), 1, 'rules-1 clips still detected');
});

test('online handshake: a guest refuses a host on another ruleset with a clear message, and tells the host why', async () => {
  globalThis.addEventListener ??= () => {};
  const { OnlineSession } = await import('../src/online.js');
  for (const hostRules of [undefined, 2, 4]) {
    const states = [], s = new OnlineSession({ api: 'http://x', kind: 'quick', char: 'inu', skin: 'base', onState: (x) => states.push(x.state) });
    s.side = 1; s.code = null; s.gotGo = { t: 'go', delay: 6, via: 'relay', ...(hostRules ? { rules: hostRules } : {}) };
    await s.connect();
    assert.equal(s.state, 'error'); assert.match(s.msg, /Version mismatch/); assert.ok(!states.includes('ready'));
    assert.deepEqual(s.out.find((m) => m.t === 'bye'), { t: 'bye', why: 'rules', rules: RULES });
    s.closed = true; }
  const ok = new OnlineSession({ api: 'http://x', kind: 'quick', char: 'inu', skin: 'base' }); ok.side = 1; ok.gotGo = { t: 'go', delay: 6, via: 'relay', rules: RULES };
  await ok.connect(); assert.equal(ok.state, 'ready'); ok.closed = true;
  const host = new OnlineSession({ api: 'http://x', kind: 'quick', char: 'inu', skin: 'base' }); host.emit({ t: 'bye', why: 'rules', rules: 2 });
  assert.ok(host.peerGone && host.peerMismatch, 'host learns it was a version mismatch'); host.closed = true;
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /N\.s\.peerMismatch\) onlineEnd\('mismatch'\)/); assert.match(main, /why === 'mismatch' \? 'NO CONTEST'|why === 'desync' \|\| why === 'mismatch' \? 'NO CONTEST'/);
});

test('layout wiring: guest pill avoids the footer and docks on phones; BACK moves off the touch buttons', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.ok(html.indexOf('InuProfileConfig') > 0 && html.indexOf('InuProfileConfig') < html.indexOf('inu-profile.js'), 'config set before the pill script loads');
  assert.match(main, /function fitPill\(\)/); assert.equal((main.match(/backBtn\(\(\) => go\(/g) || []).length, 3);
  assert.ok(!/btn\(560, 33\d, 72, 24, \(\) => go\(/.test(main), 'no BACK left under the touch buttons');
});
