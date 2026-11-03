// Daily challenge: one challenge per Australia/Sydney calendar day, picked deterministically from the date (same for
// everyone, no server, no randomness). Counts only in single-player CPU modes (Arcade, Practice Ladder).
// Reward: a dated Daily Paw badge in the save (local + the Inu Verse wallet cloud save for game meme-brawl). Cosmetic
// only: no $KIBBLE, no Bones, no wagers, no fees, and nothing is claimed from a server.
import { ROSTER } from './roster.js';

export const DAILY_TZ = 'Australia/Sydney', DAILY_KEY = 'mb.daily', COUNT_MODES = ['arcade', 'ranked'];
export function sydneyDate(now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: DAILY_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const EPOCH = Date.UTC(2026, 0, 1);
export const dayIndex = (key) => Math.round((Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) - EPOCH) / 864e5);
const mod = (a, n) => ((a % n) + n) % n;

export const CHALLENGES = [
  { type: 'win-with', target: 1, title: (f) => `WIN AS ${f.name.toUpperCase()}`, desc: (f) => `Win a CPU fight playing ${f.name}.` },
  { type: 'slides', target: 3, title: () => 'LOW SLIDE PARTY', desc: () => 'Land 3 low slides (down, down + K) on CPUs.' },
  { type: 'streak', target: 3, title: () => 'SURVIVAL RUN', desc: () => 'Beat 3 CPUs back-to-back without losing.' },
  { type: 'overheads', target: 2, title: () => 'OVERHEAD DROP', desc: () => 'Land 2 overhead hops (down, down-back, back + P).' },
  { type: 'combo', target: 4, title: () => 'COMBO CHEF', desc: () => 'Land a 4-hit combo on a CPU.' },
  { type: 'perfect', target: 1, title: () => 'NO SCRATCHES', desc: () => 'Win a round without taking damage.' },
  { type: 'supers', target: 2, title: () => 'BAG METER DUMP', desc: () => 'Land 2 supers (quarter-circle forward + K).' },
];

export function dailyFor(key) {
  const d = dayIndex(key), C = CHALLENGES[mod(d, CHALLENGES.length)], f = ROSTER[mod(d * 3 + 1, ROSTER.length)];
  return { date: key, id: `${key}:${C.type}`, type: C.type, target: C.target, fighter: C.type === 'win-with' ? f.id : null, title: C.title(f), desc: C.desc(f) };
}

export const newSave = () => ({ v: 1, date: null, prog: 0, streak: 0, done: false, badges: [] });
export function normSave(s) { const n = newSave(); if (!s || typeof s !== 'object') return n; return { ...n, ...s, badges: Array.isArray(s.badges) ? [...new Set(s.badges.filter((b) => /^\d{4}-\d{2}-\d{2}$/.test(b)))].sort().slice(-400) : [] }; }
// Roll the save over to today's challenge (badges are kept forever).
export function forToday(save, key) { const s = normSave(save); if (s.date !== key) Object.assign(s, { date: key, prog: 0, streak: 0, done: false }); return s; }
function finish(s, ch) { if (!s.done && s.prog >= ch.target) { s.done = true; if (!s.badges.includes(s.date)) s.badges.push(s.date); return true; } return false; }

// One sim event from a single-player fight (read-only). Side 0 is the human. Returns true when the challenge just completed.
export function dailyEvent(s, ch, ev, mode) {
  if (!COUNT_MODES.includes(mode) || s.done || !ev) return false;
  const mine = ev.type === 'hit' && ev.who === 1; // defender 1 = the CPU got hit by the player
  if (ch.type === 'slides' && mine && ev.mv === 'low') s.prog++;
  else if (ch.type === 'overheads' && mine && ev.mv === 'over') s.prog++;
  else if (ch.type === 'supers' && mine && ev.mv === 'super') s.prog++;
  else if (ch.type === 'combo' && mine) s.prog = Math.max(s.prog, Math.min(ch.target, ev.combo || 0));
  else if (ch.type === 'perfect' && ev.type === 'ko' && ev.winner === 0 && ev.perfect) s.prog = 1;
  else return false;
  return finish(s, ch);
}
// End of a single-player match.
export function dailyMatchEnd(s, ch, { won, p1, mode }) {
  if (!COUNT_MODES.includes(mode)) return false;
  if (ch.type === 'streak') { s.streak = won ? s.streak + 1 : 0; if (!s.done) s.prog = Math.max(s.prog, Math.min(ch.target, s.streak)); }
  if (ch.type === 'win-with' && won && p1 === ch.fighter) s.prog = 1;
  return finish(s, ch);
}
export const badgeTier = (n) => (n >= 30 ? 'GOLD PAW' : n >= 7 ? 'SILVER PAW' : n >= 1 ? 'BRONZE PAW' : '');
