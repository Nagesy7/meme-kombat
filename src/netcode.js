// Deterministic fixed-tick lockstep for online 1v1 (pure: no DOM, no timers). Both peers run the same
// simulation (logic.js step) and advance tick T only when both players' inputs for T are known.
// Each side schedules its local input `delay` ticks ahead, so with a round-trip below delay*16.7ms play never stalls.
export const BITS = { u: 1, d: 2, l: 4, r: 8, lp: 16, hp: 32, lk: 64, hk: 128 };
export const encode = (inp = {}) => { let b = 0; for (const k in BITS) if (inp[k]) b |= BITS[k]; return b; };
export const decode = (b) => { const o = {}; for (const k in BITS) if (b & BITS[k]) o[k] = 1; return o; };
export const CHECK_EVERY = 60; // ticks between desync checksums

export class Lockstep {
  constructor({ me, delay = 4 }) {
    this.me = me; this.delay = delay; this.tick = 0; this.localNext = delay; this.q = [new Map(), new Map()];
    for (let t = 0; t < delay; t++) { this.q[0].set(t, 0); this.q[1].set(t, 0); } // both sides start with `delay` empty frames
    this.local = new Map(); this.remote = new Map(); this.desync = null;
  }
  // schedule this frame's local input; returns the packet to send, or null if we are already `delay` ahead
  pushLocal(inp) {
    if (this.localNext > this.tick + this.delay) return null;
    const t = this.localNext++, b = typeof inp === 'number' ? inp : encode(inp); this.q[this.me].set(t, b); return { t: 'in', k: t, b };
  }
  receive(msg) {
    if (msg.t === 'in') { const side = 1 - this.me; if (!this.q[side].has(msg.k) && msg.k >= this.tick) this.q[side].set(msg.k, msg.b & 255); }
    else if (msg.t === 'ck') { this.remote.set(msg.k, msg.h); this.compare(msg.k); }
  }
  ready() { return this.q[0].has(this.tick) && this.q[1].has(this.tick); }
  // inputs for the current tick, consumed
  take() { const t = this.tick, b0 = this.q[0].get(t), b1 = this.q[1].get(t); this.q[0].delete(t); this.q[1].delete(t); this.tick++; return [decode(b0), decode(b1)]; }
  // after stepping: record checksum every CHECK_EVERY ticks; returns packet to send or null
  checkpoint(hash) { const k = this.tick; if (k % CHECK_EVERY) return null; this.local.set(k, hash); this.compare(k); return { t: 'ck', k, h: hash }; }
  compare(k) { if (this.local.has(k) && this.remote.has(k)) { if (this.local.get(k) !== this.remote.get(k) && !this.desync) this.desync = { tick: k, mine: this.local.get(k), theirs: this.remote.get(k) }; this.local.delete(k); this.remote.delete(k); } }
}

// FNV-1a 32-bit over the gameplay-relevant state. Doubles are serialized exactly (String(n) round-trips IEEE-754).
export function stateHash(m) {
  let h = 0x811c9dc5;
  const add = (v) => { const s = String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } h ^= 124; h = Math.imul(h, 0x01000193) >>> 0; };
  add(m.tick); add(m.phase); add(m.pt); add(m.round); add(m.wins[0]); add(m.wins[1]); add(m.timer); add(m.hitstop); add(m.matchWinner);
  for (const f of m.f) { add(f.id); add(f.x); add(f.y); add(f.vx); add(f.vy); add(f.hp); add(f.meter); add(f.st); add(f.t); add(f.face); add(f.combo); add(f.inv); add(f.move?.name); }
  for (const p of m.proj) { add(p.x); add(p.y); add(p.owner ?? p.who); }
  add(m.finisher?.kind);
  return h.toString(16).padStart(8, '0');
}
// The deterministic outcome both clients report to the server (must match exactly).
export function resultReport(m) {
  const w = m.matchWinner, f = m.f[w];
  return { winner: w, wins: [m.wins[0], m.wins[1]], hp: Math.round((1000 * Math.max(0, f.hp)) / f.maxHp), ticks: m.tick, checksum: stateHash(m) };
}
