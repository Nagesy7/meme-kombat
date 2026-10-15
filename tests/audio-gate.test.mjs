import test from 'node:test'; import assert from 'node:assert/strict';
import { gate, MAX_VOICES } from '../src/audio.js';
test('hit spam rate limited', () => { let n = 0; for (let f = 0; f < 60; f++) if (gate('hit', 100 + f / 60)) n++; assert.ok(n <= 25, `played ${n}`); });
test('concurrent voices capped', () => { let n = 0; for (let i = 0; i < 30; i++) if (gate('x' + i, 200, 0, 5)) n++; assert.equal(n, MAX_VOICES); });
