// Clip contract (inu-shared/tournaments.md): a recorded lockstep input stream replays to the exact same verified result.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch, step, cpuInput } from '../src/logic.js';
import { encode, decode, resultReport } from '../src/netcode.js';
import { InputRecorder, onlineSkins, replayTo, clipPads } from '../src/replay.js';

function playRecorded(c0, c1, s0, s1, seed) {
  const [k0, k1] = onlineSkins(c0, c1, s0, s1), m = makeMatch(c0, c1, { o1: { skin: k0 }, o2: { skin: k1 }, seed }), rec = new InputRecorder();
  while (m.phase !== 'matchEnd' && m.tick < 60 * 60 * 10) { const t = m.tick, i0 = cpuInput(m, 0, 0.8), i1 = cpuInput(m, 1, 0.6), b0 = encode(i0), b1 = encode(i1);
    rec.add(t, b0, b1); step(m, [decode(b0), decode(b1)]); m.events.length = 0; }
  return { report: resultReport(m), inputs: rec.inputs };
}

test('recorded inputs replay to the identical result + checksum (deterministic clips)', () => {
  for (const [c0, c1, s0, s1, seed] of [['inu', 'croakley', 'base', 'gold', 4242], ['toot', 'toot', 'base', 'base', 7]]) {
    const { report, inputs } = playRecorded(c0, c1, s0, s1, seed);
    assert.ok(inputs.length < report.ticks / 2, 'change points are compact');
    const clip = { seed, ticks: report.ticks, inputs, players: [{ char: c0, skin: s0 }, { char: c1, skin: s1 }] };
    assert.deepEqual(replayTo(clip, { makeMatch, step }).report, report);
    const mid = inputs.filter((e) => e[0] > report.ticks / 3 && e[0] < (2 * report.ticks) / 3), tampered = { ...clip, inputs: inputs.map((e) => (mid.includes(e) ? [e[0], e[1] ^ (32 | 4), e[2]] : e)) };
    assert.notDeepEqual(replayTo(tampered, { makeMatch, step }).report, report, 'any input change shows up in the checksum');
  }
});

test('clipPads expands change points per tick; onlineSkins swaps the mirror-match palette', () => {
  assert.deepEqual([...clipPads({ ticks: 5, inputs: [[0, 1, 2], [3, 8, 0]] })], [[1, 2], [1, 2], [1, 2], [8, 0], [8, 0]]);
  assert.deepEqual(onlineSkins('inu', 'inu', 'base', 'base'), ['base', 'alt']); assert.deepEqual(onlineSkins('inu', 'toot', 'base', 'base'), ['base', 'base']);
});
