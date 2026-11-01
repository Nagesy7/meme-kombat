// Combo Trainer helpers (pure, no DOM): turn a drill from moves.js into stick/button pads, and track which steps of
// the drill have landed as one combo. Used by the trainer screen ("SHOW ME" demo + step checkmarks) and by the tests,
// so a drill that is listed is a drill that is proven executable from inputs.
import { MOTIONS } from './moves.js';

// pads (keyboard/touch pad format) for one drill step, for a fighter facing `face`
export function stepPads(st, face) {
  const F = face > 0 ? 'r' : 'l', B = face > 0 ? 'l' : 'r', p = (o) => { const r = {}; for (const k in o) r[k === 'F' ? F : k === 'B' ? B : k] = 1; return r; };
  const b = st.btn;
  if (st.motion === 'qcf') return [{ d: 1 }, { d: 1 }, { d: 1, F: 1 }, { d: 1, F: 1 }, { F: 1 }, { F: 1, [b]: 1 }].map(p);
  if (st.motion === 'qcb') return [{ d: 1 }, { d: 1 }, { d: 1, B: 1 }, { d: 1, B: 1 }, { B: 1 }, { B: 1, [b]: 1 }].map(p);
  if (st.motion === 'bf') return [{ B: 1 }, { B: 1 }, { F: 1 }, { F: 1, [b]: 1 }].map(p);
  if (st.motion === 'dd') return [{ d: 1 }, { d: 1 }, {}, {}, { d: 1 }, { d: 1, [b]: 1 }].map(p);
  if (st.dir) return [{ [st.dir]: 1 }, { [st.dir]: 1 }, { [st.dir]: 1, [b]: 1 }].map(p);
  return [{ [b]: 1 }];
}
export const MOTION_KEYS = Object.keys(MOTIONS);

// Plays a drill like a player would: inputs step 1, waits until that move connects, waits `delay` ticks, inputs the next.
export class DrillDriver {
  constructor(drill, side = 0, delay = 0) { Object.assign(this, { drill, side, delay, i: 0, q: null, wait: 0, done: false, failed: false, t: 0 }); }
  next(m) {
    const f = m.f[this.side];
    if (this.done) return {};
    if (!this.q) { this.q = stepPads(this.drill.steps[this.i], f.face); this.t = 0; }
    if (this.q.length) return this.q.shift();
    const st = this.drill.steps[this.i];
    if (this.wait > 0) { if (--this.wait === 0) { this.i++; this.q = null; } return {}; }
    if ((f.move?.name === st.move && f.hitDone) || m.proj.some((p) => p.owner === this.side && st.move === 'proj')) {
      if (this.i === this.drill.steps.length - 1) this.done = true; else if (this.delay > 0) this.wait = this.delay; else { this.i++; this.q = null; }
      return {};
    }
    if (++this.t > 60) { this.done = this.failed = true; }
    return {};
  }
}

// Marks drill steps done from the match's hit events (attacker = `side`); a step only counts when it continues the combo.
export class ComboTracker {
  constructor(drill, side = 0) { Object.assign(this, { drill, side, prog: 0, dmg: 0, hits: 0, done: false, dropped: false, best: 0, clears: 0, doneAt: -1 }); }
  feed(events, m) {
    const S = this.drill.steps;
    for (const ev of events) {
      if (ev.type !== 'hit' || ev.who !== 1 - this.side) continue;
      if (this.done) { this.reset(); }
      const first = ev.combo === 1; if (first) { this.dmg = 0; this.hits = 0; }
      this.dmg += ev.dmg; this.hits = ev.combo;
      if (this.prog < S.length && ev.mv === S[this.prog].move && (this.prog === 0 ? first : ev.combo === this.prog + 1)) this.prog++;
      else if (ev.mv === S[0].move && first) this.prog = 1; else this.prog = 0;
      this.dropped = false; this.best = Math.max(this.best, this.prog);
      if (this.prog === S.length) { this.done = true; this.clears++; this.doneAt = m.tick; }
    }
    if (!this.done && this.prog > 0 && m.f[this.side].combo === 0 && m.hitstop === 0) { this.prog = 0; this.dropped = true; }
  }
  reset() { this.prog = 0; this.done = false; this.dropped = false; this.dmg = 0; this.hits = 0; }
}
