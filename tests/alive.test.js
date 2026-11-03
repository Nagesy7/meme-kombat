// "Feel more alive" layer: daily rotation, verified-wins feed, sound prefs, and proof that ambient effects never touch the sim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { makeMatch, step, cpuInput } from '../src/logic.js';
import { encode, decode, stateHash, resultReport } from '../src/netcode.js';
import { createAmbient, ambientEvent, ambientTick, drawAmbientBack, drawAmbientCrowd, drawAmbientFront, fxLevel, fxMonitor, CROWDS, DETAILS } from '../src/ambient.js';
import { sydneyDate, dailyFor, CHALLENGES, forToday, newSave, dailyEvent, dailyMatchEnd, badgeTier, normSave } from '../src/daily.js';
import { feedRows, TEST_WALLET_SHORTS, EMPTY_TEXT, timeAgo, fetchClips } from '../src/feed.js';
import { STAGES, ROSTER } from '../src/roster.js';

// ---- daily rotation ----
test('daily challenge is stable for a Sydney date and rotates day to day', () => {
  assert.deepEqual(dailyFor('2026-11-03'), dailyFor('2026-11-03'));
  assert.equal(dailyFor('2026-11-03').title, 'NO SCRATCHES');
  const week = Array.from({ length: 7 }, (_, i) => dailyFor(`2026-11-${String(10 + i).padStart(2, '0')}`).type);
  assert.equal(new Set(week).size, CHALLENGES.length, 'every challenge type shows up once a week');
  for (let i = 0; i < 60; i++) { const d = new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString().slice(0, 10), c = dailyFor(d);
    assert.ok(c.title && c.desc && c.target >= 1); if (c.type === 'win-with') assert.ok(ROSTER.some((f) => f.id === c.fighter)); }
});
test('sydneyDate rolls over at Sydney midnight, not UTC midnight', () => {
  assert.equal(sydneyDate(new Date('2026-11-02T12:59:00Z')), '2026-11-02'); // 11:59 pm AEDT
  assert.equal(sydneyDate(new Date('2026-11-02T13:00:00Z')), '2026-11-03'); // midnight AEDT
  assert.equal(sydneyDate(new Date('2026-06-30T14:00:00Z')), '2026-07-01'); // AEST (UTC+10) in winter
});
test('daily progress counts only single-player CPU modes and awards a cosmetic badge once', () => {
  const ch = { ...dailyFor('2026-11-02') }; assert.equal(ch.type, 'combo');
  let s = forToday(newSave(), ch.date);
  for (const mode of ['versus', 'online', 'trainer', 'replay']) assert.equal(dailyEvent(s, ch, { type: 'hit', who: 1, combo: 9 }, mode), false);
  assert.equal(s.prog, 0);
  assert.equal(dailyEvent(s, ch, { type: 'hit', who: 0, combo: 9 }, 'arcade'), false, 'combos taken by the player do not count');
  assert.equal(dailyEvent(s, ch, { type: 'hit', who: 1, combo: 3 }, 'arcade'), false); assert.equal(s.prog, 3);
  assert.equal(dailyEvent(s, ch, { type: 'hit', who: 1, combo: 4 }, 'ranked'), true); assert.deepEqual(s.badges, ['2026-11-02']);
  assert.equal(dailyEvent(s, ch, { type: 'hit', who: 1, combo: 5 }, 'arcade'), false, 'completes once');
  s = forToday(s, '2026-11-03'); assert.equal(s.prog, 0); assert.equal(s.done, false); assert.deepEqual(s.badges, ['2026-11-02'], 'badges kept across days');
  const perfect = dailyFor('2026-11-03'); assert.equal(dailyEvent(s, perfect, { type: 'ko', winner: 0, perfect: false }, 'arcade'), false);
  assert.equal(dailyEvent(s, perfect, { type: 'ko', winner: 0, perfect: true }, 'arcade'), true);
  const streak = CHALLENGES.find((c) => c.type === 'streak'), sc = { type: 'streak', target: streak.target }, t = forToday(newSave(), '2026-11-05');
  dailyMatchEnd(t, sc, { won: true, mode: 'arcade' }); dailyMatchEnd(t, sc, { won: false, mode: 'arcade' }); assert.equal(t.streak, 0);
  for (let i = 0; i < 3; i++) dailyMatchEnd(t, sc, { won: true, mode: 'ranked' }); assert.equal(t.done, true);
  assert.equal(dailyMatchEnd(forToday(newSave(), 'x'), { type: 'win-with', target: 1, fighter: 'inu' }, { won: true, p1: 'inu', mode: 'versus' }), false);
  assert.equal(badgeTier(0), ''); assert.equal(badgeTier(1), 'BRONZE PAW'); assert.equal(badgeTier(7), 'SILVER PAW'); assert.equal(badgeTier(30), 'GOLD PAW');
  assert.deepEqual(normSave({ badges: ['2026-01-01', 'junk', '2026-01-01'] }).badges, ['2026-01-01']);
});

// ---- feed ----
const NOW = Date.parse('2026-11-03T02:00:00Z');
const clip = (o) => ({ id: 'r', at: new Date(NOW - 600e3).toISOString(), verified: true, ranked: true, winner: 0, players: [{ short: 'Ab12…xY9z', char: 'inu' }, { short: 'Qq77…Lm3n', char: 'croakley' }], ...o });
test('feed shows only verified ranked wins, newest first, and never test wallets', () => {
  const rows = feedRows([
    clip({ id: 'a' }), clip({ id: 'old', at: new Date(NOW - 8 * 864e5).toISOString() }), clip({ id: 'unv', verified: false }), clip({ id: 'casual', ranked: false }),
    clip({ id: 'test', players: [{ short: TEST_WALLET_SHORTS[0], char: 'inu' }, { short: 'Qq77…Lm3n', char: 'toot' }] }),
    clip({ id: 'test2', winner: 0, players: [{ short: 'Zz55…Kk88', char: 'inu' }, { short: TEST_WALLET_SHORTS[1], char: 'toot' }] }),
    clip({ id: 'b', winner: 1, at: new Date(NOW - 60e3).toISOString() }), clip({ id: 'bad', winner: 2 }), null, { junk: 1 }], NOW);
  assert.deepEqual(rows.map((r) => r.id), ['b', 'a']);
  assert.deepEqual(rows[0], { id: 'b', short: 'Qq77…Lm3n', char: 'croakley', opp: 'inu', oppShort: 'Ab12…xY9z', at: NOW - 60e3, ago: '1m ago', bracket: false, wins: undefined });
  assert.deepEqual(feedRows([], NOW), []); assert.deepEqual(feedRows(undefined, NOW), []);
  assert.match(EMPTY_TEXT, /No ranked wins yet today/);
  assert.equal(timeAgo(5e3), 'just now'); assert.equal(timeAgo(3 * 3600e3), '3h ago'); assert.equal(timeAgo(2 * 864e5), '2d ago');
});
test('feed test-wallet list matches kibble-pay TEST_WALLETS', async () => {
  const p = new URL('../../kibble-pay/api/_lib/testwallets.js', import.meta.url);
  if (!existsSync(p)) return; const { TEST_WALLETS } = await import(p.href);
  assert.deepEqual([...TEST_WALLET_SHORTS].sort(), TEST_WALLETS.map((a) => `${a.slice(0, 4)}…${a.slice(-4)}`).sort());
});
test('fetchClips reads the public clips list and rejects bad responses (no fallback rows)', async () => {
  let url = ''; const ok = await fetchClips('https://x', async (u) => { url = u; return { ok: true, json: async () => ({ ok: true, clips: [1] }) }; });
  assert.deepEqual(ok, [1]); assert.equal(url, 'https://x/api/pvp?action=clips&limit=30');
  await assert.rejects(fetchClips('https://x', async () => ({ ok: false, status: 500 })));
  await assert.rejects(fetchClips('https://x', async () => ({ ok: true, json: async () => ({ ok: false }) })));
});

// ---- sound prefs ----
test('mute and volume persist to mb.audio and scale the master level', async () => {
  const store = new Map([['mb.audio', JSON.stringify({ muted: true, vol: 0.5 })]]);
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  const A = await import('../src/audio.js?prefs-test');
  assert.equal(A.isMuted(), true); assert.equal(A.getVolume(), 0.5); assert.equal(A.masterLevel(), 0);
  A.setMuted(false); assert.equal(A.masterLevel(), 0.25); assert.deepEqual(JSON.parse(store.get('mb.audio')), { muted: false, vol: 0.5 });
  A.setVolume(2); assert.equal(A.getVolume(), 1); A.cycleVolume(); assert.equal(A.getVolume(), 0.75);
  A.setMuted(true); assert.deepEqual(JSON.parse(store.get('mb.audio')), { muted: true, vol: 0.75 }); assert.equal(A.audioStarted(), false, 'no AudioContext without a gesture');
  A.ambience('mall'); assert.equal(A.audioStarted(), false, 'asking for ambience does not start audio');
  delete globalThis.localStorage;
});

// ---- effects level ----
test('effects level: auto drops to low on reduced motion or a slow device; off only when forced', () => {
  assert.equal(fxLevel('auto', {}), 'full'); assert.equal(fxLevel('auto', { reducedMotion: true }), 'low'); assert.equal(fxLevel('auto', { autoLow: true }), 'low');
  assert.equal(fxLevel('full', { reducedMotion: true }), 'full'); assert.equal(fxLevel('low', {}), 'low'); assert.equal(fxLevel('full', { forced: 'off' }), 'off');
  const M = fxMonitor(); let fired = 0; for (let i = 0; i < 400; i++) if (M.frame(16.7, true)) fired++; assert.equal(fired, 0);
  for (let i = 0; i < 400; i++) if (M.frame(40, true)) fired++; assert.equal(fired, 1); assert.equal(M.autoLow, true);
  for (const st of Object.keys(STAGES)) { assert.ok(CROWDS[st], `crowd for ${st}`); assert.ok(DETAILS[st]?.length, `details for ${st}`); }
});

// ---- determinism ----
const stub = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => stub()), set: (t, k, v) => ((t[k] = v), true) });
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); } return o; };
function run(c0, c1, stage, seed, alive) {
  const m = makeMatch(c0, c1, { seed, stage }), hashes = [], c = stub(), A = alive ? createAmbient(stage, seed) : null, ch = dailyFor('2026-11-02'), s = forToday(newSave(), ch.date);
  while (m.phase !== 'matchEnd' && m.tick < 60 * 60 * 6) {
    const b0 = encode(cpuInput(m, 0, 0.8)), b1 = encode(cpuInput(m, 1, 0.6)); step(m, [decode(b0), decode(b1)]);
    if (alive) for (const ev of m.events) { deepFreeze(ev); ambientEvent(A, ev); dailyEvent(s, ch, ev, 'arcade'); }
    m.events.length = 0;
    if (alive) for (const lvl of ['full', 'low']) { ambientTick(A, lvl); drawAmbientBack(c, A, lvl); drawAmbientCrowd(c, A, lvl); drawAmbientFront(c, A, lvl); }
    if (m.tick % 30 === 0) hashes.push(stateHash(m));
  }
  return { hashes, report: m.phase === 'matchEnd' ? resultReport(m) : { ticks: m.tick, checksum: stateHash(m) }, events: A?.events ?? 0 };
}
test('ambient crowd + daily tracking leave sim state, hashes and result checksums identical (all stages)', () => {
  const pairs = [['inu', 'croakley', 'mall', 11], ['toot', 'boomer', 'canyon', 22], ['inu', 'inu', 'moon', 33], ['croakley', 'toot', 'pond', 44], ['wiffy', 'rugsworth', 'rugden', 55]];
  for (const [c0, c1, st, seed] of pairs) {
    const off = run(c0, c1, st, seed, false), on = run(c0, c1, st, seed, true);
    assert.ok(on.events > 5, `ambient saw sim events on ${st}`);
    assert.deepEqual(on.hashes, off.hashes, `per-tick hashes on ${st}`); assert.deepEqual(on.report, off.report, `result report on ${st}`);
  }
});
