import test from 'node:test'; import assert from 'node:assert/strict';
import { makeMatch, step, BUFFER } from '../src/logic.js';
const fight = () => { const m = makeMatch('inu', 'inu', { seed: 3 }); while (m.phase !== 'fight') step(m, [{}, {}]); m.f[1].x = m.f[0].x + 50; return m; };
test('a tap during recovery/hitstop is buffered and links LP into LP', () => {
  const m = fight(), hp0 = m.f[1].hp; step(m, [{ lp: 1 }, {}]);
  for (let i = 0; i < 11; i++) step(m, [{}, {}]);
  step(m, [{ lp: 1 }, {}]); // 1-frame tap while still recovering / in hitstop
  for (let i = 0; i < 30; i++) step(m, [{}, {}]);
  assert.ok(hp0 - m.f[1].hp >= 70, `both jabs should land, dmg=${hp0 - m.f[1].hp}`);
});
test('stale presses expire after BUFFER ticks', () => {
  const m = fight(); m.f[0].st = 'hitstun'; m.f[0].stun = BUFFER + 10; m.f[0].t = 0;
  step(m, [{ lp: 1 }, {}]); for (let i = 0; i < BUFFER + 12; i++) step(m, [{}, {}]);
  assert.notEqual(m.f[0].st, 'attack');
});
