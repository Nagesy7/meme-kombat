// Activity feed: recent server-VERIFIED ranked wins, read from kibble-pay's public clips list (/api/pvp?action=clips).
// A clip exists only for a ranked match whose two reports agreed, finished in real time, between two distinct signed-in
// wallets, with matching input uploads (kibble-pay api/_lib/clips.js). Test wallets are never saved as clips there, and are
// filtered again here. No placeholder rows: no data = an honest empty state.
// Short forms (first 4 + last 4) of kibble-pay's built-in TEST_WALLETS (api/_lib/testwallets.js; public addresses).
export const TEST_WALLET_SHORTS = Object.freeze(['4xoj…Pv2K', 'EuJn…4EVe']);
export const FEED_MAX_AGE_MS = 7 * 864e5;
export function timeAgo(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)); if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`;
}
export function feedRows(clips, now = Date.now(), { limit = 4, maxAgeMs = FEED_MAX_AGE_MS, testShorts = TEST_WALLET_SHORTS } = {}) {
  const T = new Set(testShorts), out = [];
  for (const c of Array.isArray(clips) ? clips : []) {
    if (!c || c.verified !== true || c.ranked !== true || ![0, 1].includes(c.winner) || !Array.isArray(c.players) || c.players.length !== 2) continue;
    const w = c.players[c.winner], l = c.players[1 - c.winner], at = typeof c.at === 'number' ? c.at : Date.parse(c.at);
    if (!w?.short || !/^.{4}….{4}$/.test(w.short) || c.players.some((p) => p?.short && T.has(p.short))) continue;
    if (!Number.isFinite(at) || at > now + 60e3 || now - at > maxAgeMs) continue;
    out.push({ id: String(c.id || ''), short: w.short, char: w.char, opp: l?.char || null, oppShort: l?.short || null, at, ago: timeAgo(now - at), bracket: !!c.bracket, wins: c.wins });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}
export const EMPTY_TEXT = 'No ranked wins yet today. Be the first!';
export async function fetchClips(api, fetchFn = fetch) {
  const r = await fetchFn(`${api}/api/pvp?action=clips&limit=30`); if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json(); if (!j?.ok || !Array.isArray(j.clips)) throw new Error('bad response'); return j.clips;
}
