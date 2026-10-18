import test from 'node:test'; import assert from 'node:assert/strict';
import { stickDir, clampKnob, mergePad, PointerRoles, PAD_KEYS } from '../src/touchinput.js';
import { encode, decode, BITS } from '../src/netcode.js';
const R = 40;
test('stick: dead zone, 4 cardinals and 4 diagonals', () => {
  assert.deepEqual(stickDir(5, 5, R), { u: 0, d: 0, l: 0, r: 0 });
  const dirs = (dx, dy) => Object.entries(stickDir(dx, dy, R)).filter(([, v]) => v).map(([k]) => k).sort().join('');
  assert.equal(dirs(30, 0), 'r'); assert.equal(dirs(-30, 0), 'l'); assert.equal(dirs(0, -30), 'u'); assert.equal(dirs(0, 30), 'd');
  assert.equal(dirs(25, -25), 'ru'); assert.equal(dirs(-25, -25), 'lu'); assert.equal(dirs(25, 25), 'dr'); assert.equal(dirs(-25, 25), 'dl');
  assert.equal(dirs(30, -8), 'r', 'slightly off-axis stays cardinal');
});
test('stick: finger sliding past the rim keeps direction (base follows)', () => {
  const k = clampKnob(100, 100, 300, 100, R); assert.equal(k.kx, R); assert.equal(k.ox, 260); assert.equal(stickDir(k.kx, k.ky, R).r, 1);
});
test('per-pointer roles: releasing one pointer never cancels another', () => {
  const p = new PointerRoles(); p.claim(1, 'stick'); p.claim(2, 'jump');
  assert.ok(p.held('stick') && p.held('jump')); p.release(2); assert.ok(p.held('stick') && !p.held('jump'));
  p.release(99); assert.ok(p.held('stick'));
});
test('touch pad is the exact keyboard pad format and encodes identically for online lockstep', () => {
  // keyboard D + W held + G tapped  ==  stick right + jump + HP button
  const keyboard = { r: 1, u: 1, hp: 1 };
  const touch = mergePad(stickDir(30, 0, R), true, { hp: true });
  assert.deepEqual(touch, keyboard); assert.equal(encode(touch), encode(keyboard)); assert.deepEqual(decode(encode(touch)), keyboard);
  assert.deepEqual(Object.keys(BITS), PAD_KEYS, 'touch keys == netcode bit layout');
  for (let dx = -40; dx <= 40; dx += 10) for (let dy = -40; dy <= 40; dy += 10) for (const j of [false, true]) {
    const p = mergePad(stickDir(dx, dy, R), j, { lp: dx > 0, lk: dy > 0 }); assert.ok(Object.keys(p).every((k) => PAD_KEYS.includes(k) && p[k] === 1)); assert.deepEqual(decode(encode(p)), p); }
  assert.deepEqual(mergePad(stickDir(0, -30, R), true), { u: 1 }, 'stick up + jump = one up, no new key');
});
