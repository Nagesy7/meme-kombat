// Touch input (pure, no DOM): virtual stick + jump + attack buttons -> the SAME pad object the keyboard produces
// ({u,d,l,r,lp,hp,lk,hk} truthy flags), so local play, CPU fights and online lockstep (netcode encode()) see one format.
export const PAD_KEYS = ['u', 'd', 'l', 'r', 'lp', 'hp', 'lk', 'hk'];
export const DEAD = 0.28;      // dead zone, fraction of the stick radius
export const AXIS = 0.38;      // sin(22.5deg): 8 equal 45deg sectors, so diagonals are as easy as cardinals
// stick offset (px from base centre, +y = down) -> directions
export function stickDir(dx, dy, radius) {
  const dist = Math.hypot(dx, dy), out = { u: 0, d: 0, l: 0, r: 0 };
  if (!(radius > 0) || dist < radius * DEAD) return out;
  const nx = dx / dist, ny = dy / dist;
  if (nx > AXIS) out.r = 1; else if (nx < -AXIS) out.l = 1;
  if (ny > AXIS) out.d = 1; else if (ny < -AXIS) out.u = 1;
  return out;
}
// knob position clamped to the base radius; when the thumb drifts further, the base follows it (direction is kept)
export function clampKnob(ox, oy, x, y, radius) {
  const dx = x - ox, dy = y - oy, d = Math.hypot(dx, dy);
  if (d <= radius) return { ox, oy, kx: dx, ky: dy };
  const k = radius / d, nox = x - dx * k, noy = y - dy * k; return { ox: nox, oy: noy, kx: dx * k, ky: dy * k };
}
// merge: stick dirs + jump (= up) + held buttons -> pad in the keyboard's format (only truthy keys, value 1)
export function mergePad(stick = {}, jump = false, buttons = {}) {
  const p = {}; if (stick.u || jump) p.u = 1; if (stick.d) p.d = 1; if (stick.l) p.l = 1; if (stick.r) p.r = 1;
  for (const k of ['lp', 'hp', 'lk', 'hk']) if (buttons[k]) p[k] = 1; return p;
}
// per-pointer tracker: each pointerId owns exactly one control; releasing one never touches another
export class PointerRoles {
  constructor() { this.m = new Map(); }
  claim(id, role) { this.m.set(id, role); }
  release(id) { const r = this.m.get(id); this.m.delete(id); return r; }
  role(id) { return this.m.get(id); }
  held(role) { for (const r of this.m.values()) if (r === role) return true; return false; }
  clear() { this.m.clear(); }
}
