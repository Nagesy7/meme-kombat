// Gamepad API support (W3C "standard" mapping). Pure + testable: no DOM, navigator is injected.
// Pads only ever produce the SAME pad bits as keyboard/touch ({u,d,l,r,lp,hp,lk,hk}), polled once per sim frame by
// main.js readPads(). Shoulder "macros" (special / super / block) are just short sequences of those same bits, so the
// sim, input encoding, rules version, lockstep and replays are untouched.
export const DEADZONE = 0.35; // radial, on the left stick
export const B = { S: 0, E: 1, W: 2, N: 3, L1: 4, R1: 5, L2: 6, R2: 7, SELECT: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, HOME: 16 };
export const REMAPPABLE = [0, 1, 2, 3, 4, 5, 6, 7]; // face buttons + shoulders + triggers

// Which glyph family to show. Ids are browser strings like "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c ...)"
// or "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e ...)". Vendor 054c = Sony, 045e = Microsoft.
export function padFamily(id = '') {
  const s = String(id).toLowerCase();
  if (/dualsense|dualshock|playstation|ps[345]\b|vendor: 054c|054c-|^054c/.test(s)) return 'ps';
  if (/xbox|xinput|x-box|vendor: 045e|045e-|^045e/.test(s)) return 'xbox';
  return 'generic';
}
// Plain text labels (original drawings in main.js draw the PS shapes; no logos).
export const LABELS = {
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'CREATE', 'OPTIONS', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'PS'],
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'HOME'],
  generic: ['1', '2', '3', '4', 'L1', 'R1', 'L2', 'R2', 'SELECT', 'START', 'L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'HOME'],
};
export const FAMILY_NAME = { ps: 'PS-style controller', xbox: 'Xbox-style controller', generic: 'Controller' };
// words for toasts/text (the pixel fonts have no ✕○□△ glyphs; on canvas those are drawn as shapes)
export const btnWord = (fam, b) => (fam === 'ps' && b >= 0 && b <= 3 ? ['CROSS', 'CIRCLE', 'SQUARE', 'TRIANGLE'][b] : label(fam, b));
export const label = (fam, b) => (LABELS[fam] || LABELS.generic)[b] ?? `B${b}`;

// Actions a button can be mapped to. Face buttons follow the keyboard layout (F G / V B = punches on top, kicks below):
// left/top face = LP/HP, bottom/right face = LK/HK. Shoulders: L1 special (D,DF,F+P), R1 super (D,DF,F+K),
// L2 block (hold back), R2 launcher (D,D+P).
export const ACTIONS = ['lp', 'hp', 'lk', 'hk', 'special', 'super', 'block', 'launch'];
export const ACTION_NAME = { lp: 'LIGHT PUNCH', hp: 'HEAVY PUNCH', lk: 'LIGHT KICK', hk: 'HEAVY KICK', special: 'SPECIAL (D,DF,F+P)', super: 'SUPER (D,DF,F+K)', block: 'BLOCK (HOLD BACK)', launch: 'LAUNCHER (D,D+P)' };
export const ACTION_SHORT = { lp: 'LP', hp: 'HP', lk: 'LK', hk: 'HK', special: 'SPECIAL', super: 'SUPER', block: 'BLOCK', launch: 'LAUNCH' };
export const DEFAULT_MAP = Object.freeze({ lp: B.W, hp: B.N, lk: B.S, hk: B.E, special: B.L1, super: B.R1, block: B.L2, launch: B.R2 });

export function normMap(m) {
  const out = { ...DEFAULT_MAP }; if (!m || typeof m !== 'object') return out;
  const used = new Set();
  for (const a of ACTIONS) { const b = m[a]; if (Number.isInteger(b) && REMAPPABLE.includes(b) && !used.has(b)) { out[a] = b; used.add(b); } else out[a] = null; }
  for (const a of ACTIONS) if (out[a] == null) { const b = [DEFAULT_MAP[a], ...REMAPPABLE].find((x) => !used.has(x)); out[a] = b; used.add(b); } // fill gaps, keep 1:1
  return out;
}
// Assign `btn` to `action`; whichever action had that button takes the old one (swap), so the map stays 1:1.
export function remap(map, action, btn) {
  const m = normMap(map); if (!ACTIONS.includes(action) || !REMAPPABLE.includes(btn)) return m;
  const other = ACTIONS.find((a) => m[a] === btn); if (other && other !== action) m[other] = m[action]; m[action] = btn; return m;
}
export const MAP_KEY = (fam) => `mb.padmap.${fam}`;
export function loadMap(store, fam) { try { return normMap(JSON.parse(store?.getItem(MAP_KEY(fam)) || 'null')); } catch { return normMap(null); } }
export function saveMap(store, fam, map) { const m = normMap(map); try { store?.setItem(MAP_KEY(fam), JSON.stringify(m)); } catch {} return m; }
export function resetMap(store, fam) { try { store?.removeItem(MAP_KEY(fam)); } catch {} return normMap(null); }

// Left stick -> 8-way directions. Radial deadzone; 45-degree sectors so diagonals (DF, DB) are easy for rolls.
export function stickDirs(x = 0, y = 0, dz = DEADZONE) {
  const o = { u: 0, d: 0, l: 0, r: 0 }; if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < dz) return o;
  const a = Math.atan2(y, x), s = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; // 0 right, 1 down-right, 2 down ...
  if (s === 7 || s === 0 || s === 1) o.r = 1; if (s >= 3 && s <= 5) o.l = 1; if (s >= 1 && s <= 3) o.d = 1; if (s >= 5 && s <= 7) o.u = 1;
  return o;
}
const pressed = (gp, i) => { const b = gp?.buttons?.[i]; return !!b && (typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5); };
// Raw snapshot of one pad: held directions (D-pad OR stick), held mapped actions, and UI buttons.
export function readGamepad(gp, map = DEFAULT_MAP, dz = DEADZONE) {
  const s = stickDirs(gp?.axes?.[0], gp?.axes?.[1], dz), m = normMap(map);
  const dirs = { u: +(s.u || pressed(gp, B.UP)), d: +(s.d || pressed(gp, B.DOWN)), l: +(s.l || pressed(gp, B.LEFT)), r: +(s.r || pressed(gp, B.RIGHT)) };
  if (dirs.u && dirs.d) dirs.u = dirs.d = 0; if (dirs.l && dirs.r) dirs.l = dirs.r = 0; // SOCD: opposite = neutral (same as keyboard intent)
  const act = {}; for (const a of ACTIONS) act[a] = +pressed(gp, m[a]);
  const btn = []; for (let i = 0; i < 17; i++) btn[i] = +pressed(gp, i);
  return { dirs, act, btn, any: btn.some(Boolean) || dirs.u || dirs.d || dirs.l || dirs.r };
}

// Macro sequences in numpad notation relative to facing (2 down, 3 down-forward, 6 forward, 5 neutral), 2 ticks per step,
// button on the last step. These satisfy the rules-2 motions in moves.js (qcf: 2 then 6 without neutral; dd: down, up, down).
export const MACROS = { special: { seq: [2, 2, 3, 3, 6], btn: 'lp' }, super: { seq: [2, 2, 3, 3, 6], btn: 'lk' }, launch: { seq: [2, 2, 5, 5, 2], btn: 'lp' } };
const NUM = { 1: { d: 1, b: 1 }, 2: { d: 1 }, 3: { d: 1, f: 1 }, 4: { b: 1 }, 5: {}, 6: { f: 1 } };
function numBits(n, face) { const v = NUM[n] || {}, o = {}; if (v.d) o.d = 1; if (v.f) o[face > 0 ? 'r' : 'l'] = 1; if (v.b) o[face > 0 ? 'l' : 'r'] = 1; return o; }

// Per-player pad state across frames: press edges for macros + the running macro. Lives in the UI layer, not the sim.
export class PadPlayer {
  constructor() { this.prev = { act: {}, btn: [] }; this.macro = null; }
  reset() { this.prev = { act: {}, btn: [] }; this.macro = null; }
  // Fight bits for this frame. face = this player's facing (+1 right, -1 left), read from the last sim state.
  fightBits(raw, face = 1) {
    const out = { ...raw.dirs }, pa = this.prev.act;
    for (const k of ['lp', 'hp', 'lk', 'hk']) if (raw.act[k]) out[k] = 1;
    if (raw.act.block) { out.l = out.r = 0; out[face > 0 ? 'l' : 'r'] = 1; }
    for (const k of ['special', 'super', 'launch']) if (raw.act[k] && !pa[k] && !this.macro) this.macro = { ...MACROS[k], i: 0, face };
    if (this.macro) { const M = this.macro, n = M.seq[M.i], last = M.i === M.seq.length - 1; delete out.u; delete out.d; delete out.l; delete out.r; Object.assign(out, numBits(n, M.face)); if (last) out[M.btn] = 1; if (++M.i >= M.seq.length) this.macro = null; }
    this.prev = { act: { ...raw.act }, btn: raw.btn.slice() }; return clean(out);
  }
  // Menu edges for this frame (press only).
  uiEdges(raw) { const p = this.prev.btn, e = {}; for (let i = 0; i < raw.btn.length; i++) if (raw.btn[i] && !p[i]) e[i] = 1; this.prev = { act: { ...raw.act }, btn: raw.btn.slice() }; return e; }
}
const clean = (o) => { const r = {}; for (const k of ['u', 'd', 'l', 'r', 'lp', 'hp', 'lk', 'hk']) if (o[k]) r[k] = 1; return r; };

// Hot-plug tracking. Slots are assigned in connect order: slot 0 = P1, slot 1 = P2 (local versus). poll() returns events.
export class PadManager {
  constructor(nav = typeof navigator !== 'undefined' ? navigator : null) { this.nav = nav; this.slots = [null, null]; this.known = new Map(); }
  list() { try { return [...(this.nav?.getGamepads?.() || [])].filter((g) => g && g.connected !== false); } catch { return []; } }
  poll() {
    const ev = [], now = new Map(); for (const g of this.list()) now.set(g.index, g);
    for (const [i, k] of this.known) if (!now.has(i) || now.get(i).id !== k.id) { const slot = this.slots.indexOf(i); if (slot >= 0) this.slots[slot] = null; this.known.delete(i); ev.push({ type: 'disconnect', index: i, id: k.id, family: k.family, slot }); }
    for (const [i, g] of now) if (!this.known.has(i)) {
      const family = padFamily(g.id); this.known.set(i, { id: g.id, family }); let slot = this.slots.indexOf(null); if (slot >= 0) this.slots[slot] = i;
      ev.push({ type: 'connect', index: i, id: g.id, family, slot, mapping: g.mapping || '' });
    }
    this.pads = now; return ev;
  }
  pad(slot) { const i = this.slots[slot]; return i == null ? null : this.pads?.get(i) || null; }
  family(slot) { const i = this.slots[slot]; return i == null ? null : this.known.get(i)?.family || 'generic'; }
  count() { return this.slots.filter((s) => s != null).length; }
}

// Short button hints for the connect toast, in the pad's own glyphs.
export function hintLine(fam, map = DEFAULT_MAP) {
  const m = normMap(map), L = (b) => label(fam, b);
  return `${L(m.lp)} LP  ${L(m.hp)} HP  ${L(m.lk)} LK  ${L(m.hk)} HK  ${L(m.special)} SPECIAL  ${L(m.super)} SUPER  ${L(m.block)} BLOCK`;
}
