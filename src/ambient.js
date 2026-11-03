// Stage ambient life: animated crowds and moving background details for every stage (original pixel art, drawn with
// rects on the 640x360 canvas, 2px = one stage pixel). RENDER-ONLY: the ambient state reads sim events and the match
// tick, never writes the match, and uses its own seeded PRNG (never Math.random), so it cannot affect lockstep or replays.
// Effect levels: 'full', 'low' (reduced: static crowd, no bobbing or confetti, half the extras) and 'off' (baseline).

const U = 2; // one stage pixel
function lcg(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// Per-stage crowd: who stands on the horizon line, their palettes, and how they hop. y = feet line in canvas pixels.
export const CROWDS = {
  mall: { y: 268, gap: 17, kind: 'shiba', fur: ['#d9893a', '#f0c27a', '#3a2a22', '#e8e0d0'], shirt: ['#c8282e', '#3fb6a8', '#6c5ce7', '#f2b84b', '#e0567a', '#2a6ac8'], prop: 'glow', hop: 1 },
  canyon: { y: 268, gap: 19, kind: 'pup', fur: ['#a8643a', '#c8884a', '#6a3e26'], shirt: ['#3ec46a', '#e04a5a', '#ffd25a', '#4a8ac8'], prop: 'flag', hop: 1 },
  moon: { y: 264, gap: 21, kind: 'astro', fur: ['#d9893a', '#f0c27a', '#e8e0d0'], shirt: ['#e8e8f0', '#d8d4e8', '#c8c4d8'], prop: 'none', hop: 1.8 },
  pond: { y: 262, gap: 18, kind: 'frog', fur: ['#5fb36a', '#3d9a4a', '#7ac85a', '#4a8a3a'], shirt: ['#2a6a3a', '#f2a0b8', '#e3b341'], prop: 'none', hop: 1.3 },
  rugden: { y: 264, gap: 22, kind: 'whale', fur: ['#3a6ac8', '#2a4a9a', '#5a7ad8'], shirt: ['#2a1a3a', '#1a1a2a', '#3a1a2a'], prop: 'cash', hop: 0.8 },
};
// What moves in the background of each stage (used by the report + tests).
export const DETAILS = {
  mall: ['shiba crowd with glow sticks', 'drifting blimp with a blinking banner', 'shoppers strolling past the storefronts', 'KIBBLE MALL sign flicker'],
  canyon: ['prairie-pup crowd waving chart flags', 'two vultures circling', 'tumbleweed rolling across', 'live candle pumping and dumping'],
  moon: ['astro-pup crowd doing low-gravity hops', 'rocket launch with exhaust trail', 'blinking satellite crossing the sky'],
  pond: ['frog crowd on the bank with throat puffs', 'ripples on the water', 'dragonflies darting', 'fish jumping'],
  rugden: ['whale goons in suits waving cash', 'sweeping red spotlights', 'gold glints on the coin piles', 'falling gold coins on big hits'],
};

export function createAmbient(stage, seed = 1) {
  const C = CROWDS[stage] || CROWDS.mall, r = lcg(hashStr(stage) ^ seed), members = [];
  for (let x = 6 + Math.floor(r() * 8); x < 640; x += C.gap + Math.floor(r() * 5)) {
    members.push({ x, y: C.y + Math.floor(r() * 3) * U * (stage === 'pond' ? 1 : 0), fur: C.fur[Math.floor(r() * C.fur.length)], shirt: C.shirt[Math.floor(r() * C.shirt.length)],
      ph: r() * 6.28, sp: 0.05 + r() * 0.05, jy: 0, jv: 0, cheer: 0, face: r() < 0.5 ? -1 : 1, glow: ['#7ad3f0', '#ff5aa8', '#ffd25a', '#3ec46a'][Math.floor(r() * 4)] });
  }
  return { stage, C, members, t: 0, hype: 0, ko: 0, parts: [], coins: [], rng: lcg(hashStr(stage) * 31 + seed), events: 0, last: null };
}

// Feed one sim event (read-only). Returns nothing; only the ambient state changes.
export function ambientEvent(A, ev) {
  if (!A || !ev) return; const r = A.rng; A.events++;
  if (ev.type === 'hit') {
    const big = ev.heavy || (ev.combo || 0) >= 3, reach = big ? 220 : 120;
    A.hype = Math.min(1, A.hype + (big ? 0.25 : 0.1));
    for (const p of A.members) if (Math.abs(p.x - (ev.x ?? 320)) < reach && r() < (big ? 0.8 : 0.45)) cheer(p, big ? 3.2 : 2.2, big ? 40 : 24);
    if (A.stage === 'rugden' && big) for (let i = 0; i < 6; i++) A.coins.push({ x: 40 + r() * 560, y: -10 - r() * 40, vy: 1 + r() * 1.5, life: 140 });
    A.last = 'hit';
  } else if (ev.type === 'ko' || ev.type === 'finisher') {
    A.hype = 1; A.ko = 150; A.last = ev.type;
    for (const p of A.members) cheer(p, 3 + r() * 1.5, 120);
    const cols = ['#ffd25a', '#ff5aa8', '#7ad3f0', '#3ec46a', '#fff6e0'];
    for (let i = 0; i < 70; i++) A.parts.push({ x: r() * 640, y: 150 + r() * 110, vx: (r() - 0.5) * 3, vy: -3 - r() * 4, life: 90 + r() * 60, col: cols[i % 5], s: 2 + Math.floor(r() * 2) * 2 });
  } else if (ev.type === 'super') { A.hype = Math.min(1, A.hype + 0.4); for (const p of A.members) if (r() < 0.6) cheer(p, 2.6, 40); A.last = 'super'; }
}
function cheer(p, v, t) { if (p.jy === 0) p.jv = v; p.cheer = Math.max(p.cheer, t); }

// Advance one 60 Hz step (called from the frame loop, never from step()).
export function ambientTick(A, level = 'full') {
  if (!A || level === 'off') return; A.t++; const hop = A.C.hop;
  A.hype = Math.max(0, A.hype - 0.004); if (A.ko > 0) A.ko--;
  for (const p of A.members) {
    if (p.cheer > 0) { p.cheer--; if (p.jy === 0 && p.cheer > 10 && A.ko > 0 && (A.t + Math.floor(p.ph * 10)) % 26 === 0) p.jv = 2.6; }
    if (p.jv || p.jy) { p.jy += p.jv; p.jv -= 0.32 / hop; if (p.jy <= 0) { p.jy = 0; p.jv = 0; } }
  }
  for (const q of A.parts) { q.x += q.vx; q.y += q.vy; q.vy += 0.12; q.vx *= 0.99; q.life--; }
  A.parts = A.parts.filter((q) => q.life > 0 && q.y < 370);
  for (const c of A.coins) { c.y += c.vy; c.vy += 0.08; c.life--; } A.coins = A.coins.filter((c) => c.life > 0 && c.y < 300);
}

const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };

// Background details: behind the crowd, in front of the painted stage.
export function drawAmbientBack(c, A, level = 'full') {
  if (!A || level === 'off') return; const t = A.t, low = level === 'low';
  switch (A.stage) {
    case 'mall': {
      const bx = ((t * 0.25) % 840) - 100, by = 34 + Math.round(Math.sin(t / 90) * 3); // blimp
      R(c, bx, by, 60, 16, '#c8c4d8'); R(c, bx + 4, by - 2, 52, 2, '#c8c4d8'); R(c, bx + 4, by + 16, 52, 2, '#9a96b0'); R(c, bx - 6, by + 4, 6, 8, '#9a96b0'); R(c, bx + 22, by + 18, 14, 4, '#4a4f8c');
      R(c, bx + 8, by + 5, 44, 6, Math.floor(t / 30) % 2 ? '#ff5aa8' : '#2a1036'); if (Math.floor(t / 30) % 2) { R(c, bx + 12, by + 7, 4, 2, '#fff6e0'); R(c, bx + 20, by + 7, 4, 2, '#fff6e0'); R(c, bx + 28, by + 7, 4, 2, '#fff6e0'); R(c, bx + 36, by + 7, 4, 2, '#fff6e0'); R(c, bx + 44, by + 7, 4, 2, '#fff6e0'); }
      if (!low) for (let i = 0; i < 3; i++) { const sx = ((t * (0.4 + i * 0.15) + i * 260) % 760) - 60, dir = i % 2 ? -1 : 1, x = dir > 0 ? sx : 640 - sx, y = 226, step = Math.floor(t / 8 + i) % 2; // shoppers
        R(c, x, y - 18, 8, 10, ['#e0567a', '#3fb6a8', '#f2b84b'][i]); R(c, x + 1, y - 24, 6, 6, '#d9893a'); R(c, x + 1, y - 26, 2, 2, '#d9893a'); R(c, x + 5, y - 26, 2, 2, '#d9893a'); R(c, x + (step ? 0 : 2), y - 8, 2, 8, '#2a2f5c'); R(c, x + (step ? 6 : 4), y - 8, 2, 8, '#2a2f5c'); R(c, x + (dir > 0 ? 8 : -4), y - 14, 4, 6, '#fff6e0'); }
      if ((t % 240) < 6 || (t % 240 > 14 && t % 240 < 18)) { c.fillStyle = 'rgba(0,0,10,.35)'; c.fillRect(220, 80, 200, 40); } // sign flicker
      break; }
    case 'canyon': {
      for (let i = 0; i < 2; i++) { const a = t / (140 + i * 40) + i * 3, x = 420 + i * 90 + Math.cos(a) * (70 - i * 20), y = 70 + i * 16 + Math.sin(a) * 18, flap = Math.floor(t / (10 + i * 3)) % 2; // vultures
        R(c, x - 2, y, 6, 3, '#2a0e1a'); R(c, x - 10, y - (flap ? 4 : -1), 8, 2, '#2a0e1a'); R(c, x + 4, y - (flap ? 4 : -1), 8, 2, '#2a0e1a'); R(c, x + 4, y - 2, 2, 2, '#2a0e1a'); }
      { const k = (t * 1.1) % 900, x = 680 - k, y = 258 - Math.abs(Math.sin(t / 14)) * 12, rot = Math.floor(t / 6) % 4; // tumbleweed
        R(c, x - 6, y - 6, 12, 12, '#9a6a3a'); R(c, x - 4, y - 8, 8, 2, '#b8844a'); R(c, x - 8, y - 4, 2, 8, '#b8844a'); R(c, x + 6, y - 4, 2, 8, '#7a4a26'); R(c, x - 4, y + 6, 8, 2, '#7a4a26'); R(c, x - 2 + (rot % 2) * 2, y - 2 + (rot > 1 ? 2 : 0), 2, 2, '#e0b070'); }
      { const v = Math.sin(t / 50) * 18 + Math.sin(t / 13) * 4, top = Math.round(Math.min(150, 150 - v)), h = Math.max(4, Math.round(Math.abs(v))); // live candle (right edge)
        R(c, 603, top - 10, 2, h + 20, v > 0 ? '#3ec46a' : '#e04a5a'); R(c, 598, top, 12, h, v > 0 ? '#3ec46a' : '#e04a5a'); R(c, 598, top, 4, h, 'rgba(255,255,255,.25)'); }
      break; }
    case 'moon': {
      const sx = ((t * 0.5) % 820) - 90, sy = 96 + Math.round(Math.sin(t / 70) * 4); // satellite
      R(c, sx, sy, 8, 6, '#c8c4d8'); R(c, sx - 12, sy + 1, 10, 4, '#3a6ac8'); R(c, sx + 10, sy + 1, 10, 4, '#3a6ac8'); if (Math.floor(t / 20) % 2) R(c, sx + 3, sy - 3, 2, 2, '#ff5a5a');
      const L = t % 720; if (L < 260) { const ry = 250 - L * L * 0.004 - L * 0.3, rx = 520; // rocket launch
        if (ry > -40) { R(c, rx, ry, 8, 22, '#e8e8f0'); R(c, rx + 2, ry - 6, 4, 6, '#c8282e'); R(c, rx - 4, ry + 14, 4, 8, '#c8282e'); R(c, rx + 8, ry + 14, 4, 8, '#c8282e'); R(c, rx + 2, ry + 6, 4, 4, '#7ad3f0');
          const fl = 6 + (Math.floor(t / 3) % 3) * 3; R(c, rx + 1, ry + 22, 6, fl, '#ffd25a'); R(c, rx + 2, ry + 22, 4, fl - 3, '#ff7a4a');
          if (!low) for (let i = 1; i < 8; i++) { const yy = ry + 30 + i * 10; if (yy < 262) { c.fillStyle = `rgba(220,220,240,${0.35 - i * 0.04})`; c.fillRect(rx - i, Math.round(yy), 8 + i * 2, 6); } } } }
      break; }
    case 'pond': {
      for (let i = 0; i < 4; i++) { const ph = (t + i * 47) % 120, x = 80 + i * 150 + (i % 2) * 20, y = 240 + (i % 3) * 6, w = 6 + ph * 0.3; // ripples
        c.fillStyle = `rgba(160,220,230,${Math.max(0, 0.5 - ph / 240)})`; c.fillRect(Math.round(x - w), y, Math.round(w * 2), 2); }
      if (!low) for (let i = 0; i < 2; i++) { const a = t / (40 + i * 13) + i * 2, x = 320 + Math.sin(a * 1.3) * 250 + Math.sin(a * 3.1) * 30, y = 190 + Math.cos(a * 2) * 26; // dragonflies
        R(c, x, y, 8, 2, '#3fb6a8'); if (Math.floor(t / 2) % 2) { R(c, x + 2, y - 3, 2, 3, 'rgba(220,255,255,.7)'); R(c, x + 4, y - 3, 2, 3, 'rgba(220,255,255,.7)'); } }
      { const J = t % 400; if (J < 40) { const x = 190 + J * 2, y = 238 - Math.sin((J / 40) * Math.PI) * 30; R(c, x, Math.round(y), 8, 4, '#f2a04a'); R(c, x - 3, Math.round(y), 3, 4, '#c8743a'); } }
      break; }
    case 'rugden': {
      for (let i = 0; i < 2; i++) { const a = Math.sin(t / 80 + i * 2.2) * 0.6, x0 = i ? 520 : 120; c.fillStyle = 'rgba(255,60,60,0.09)'; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + Math.sin(a) * 300 - 40, 268); c.lineTo(x0 + Math.sin(a) * 300 + 40, 268); c.fill(); }
      const r = lcg(Math.floor(t / 12) + 7); for (let i = 0; i < (low ? 3 : 7); i++) { const left = r() < 0.5, x = (left ? 20 : 490) + r() * 130, y = 180 + r() * 80; R(c, x, y - 2, 2, 6, '#fff6c0'); R(c, x - 2, y, 6, 2, '#fff6c0'); }
      for (const k of A.coins) { R(c, k.x, k.y, 6, 6, '#ffd25a'); R(c, k.x + 2, k.y + 2, 2, 2, '#e3b341'); }
      break; }
  }
}

// The crowd: idle bob, cheer jumps on hits/KOs (props up while cheering).
export function drawAmbientCrowd(c, A, level = 'full') {
  if (!A || level === 'off') return; const low = level === 'low', t = A.t, C = A.C;
  for (let i = 0; i < A.members.length; i++) {
    const p = A.members[i]; if (low && i % 2) continue;
    const bob = low ? 0 : (Math.sin(t * p.sp + p.ph) > 0.4 ? U : 0), lift = low ? 0 : Math.round(p.jy), up = p.cheer > 0, x = p.x, y = p.y - bob - lift;
    member(c, C.kind, x, y, p, up, C.prop, t);
  }
}
function member(c, kind, x, y, p, up, prop, t) {
  const f = p.fur, s = p.shirt;
  if (kind === 'frog') { // wide body, eyes on top, throat puff
    R(c, x - 7, y - 10, 14, 10, f); R(c, x - 6, y - 15, 4, 5, f); R(c, x + 2, y - 15, 4, 5, f); R(c, x - 5, y - 14, 2, 2, '#10101a'); R(c, x + 3, y - 14, 2, 2, '#10101a');
    R(c, x - 3, y - 4, 6, (Math.floor(t / 20 + p.ph) % 3 === 0 || up) ? 4 : 2, '#e8f0b0'); if (up) { R(c, x - 10, y - 14, 3, 6, f); R(c, x + 7, y - 14, 3, 6, f); } return; }
  if (kind === 'whale') { // big blue head in a suit, top hat
    R(c, x - 6, y - 8, 12, 8, s); R(c, x - 1, y - 8, 2, 6, '#e8e0d0'); R(c, x - 7, y - 17, 14, 9, f); R(c, x - 7, y - 10, 14, 2, '#c8d0ff'); R(c, x + (p.face > 0 ? 2 : -4), y - 15, 2, 2, '#10101a');
    R(c, x - 4, y - 21, 8, 4, '#10101a'); R(c, x - 6, y - 18, 12, 1, '#10101a');
    if (up) { R(c, x - 10, y - 18, 3, 8, s); R(c, x + 7, y - 18, 3, 8, s); R(c, x - 12, y - 22, 6, 4, '#3ec46a'); R(c, x + 6, y - 22, 6, 4, '#3ec46a'); } return; }
  // shiba / pup / astro: body + head + ears
  R(c, x - 5, y - 9, 10, 9, s); R(c, x - 5, y - 17, 10, 8, f); R(c, x - 3, y - 12, 6, 3, '#f6e7c8');
  if (kind === 'pup') { R(c, x - 7, y - 17, 3, 4, f); R(c, x + 4, y - 17, 3, 4, f); R(c, x - 5, y - 9, 10, 2, '#c8282e'); }
  else { R(c, x - 5, y - 19, 3, 2, f); R(c, x + 2, y - 19, 3, 2, f); }
  R(c, x - 3, y - 14, 2, 2, '#10101a'); R(c, x + 1, y - 14, 2, 2, '#10101a');
  if (kind === 'astro') { c.fillStyle = 'rgba(200,230,255,.35)'; c.fillRect(x - 7, y - 21, 14, 13); R(c, x - 7, y - 21, 14, 1, '#e8f4ff'); R(c, x - 7, y - 21, 1, 13, '#e8f4ff'); R(c, x + 6, y - 21, 1, 13, '#e8f4ff'); R(c, x + 3, y - 19, 2, 2, '#ffffff'); }
  if (up) { R(c, x - 8, y - 18, 3, 9, s); R(c, x + 5, y - 18, 3, 9, s);
    if (prop === 'glow') { R(c, x - 8, y - 24, 3, 6, p.glow); R(c, x + 5, y - 24, 3, 6, p.glow); }
    if (prop === 'flag') { R(c, x + 6, y - 30, 1, 12, '#e8e0d0'); R(c, x + 7, y - 30, 7, 5, Math.floor(t / 8) % 2 ? '#3ec46a' : '#2fae5a'); } }
  else if (prop === 'glow') R(c, x + 5, y - 10, 2, 4, p.glow);
}

// Front layer: KO confetti (skipped on low).
export function drawAmbientFront(c, A, level = 'full') {
  if (!A || level !== 'full') return;
  for (const q of A.parts) { c.fillStyle = q.col; c.fillRect(Math.round(q.x), Math.round(q.y), q.s, q.s); }
}

// ---- effect level: auto = full unless the device asks for reduced motion or frames are slow ----
export const FX_PREFS = ['auto', 'full', 'low'];
export function fxMonitor() {
  return { ema: 16.7, slow: 0, autoLow: false, reason: '',
    frame(dt, active) { if (!active || !(dt > 0) || dt > 250) return false; this.ema += (dt - this.ema) * 0.05; this.slow = this.ema > 24 ? this.slow + 1 : Math.max(0, this.slow - 2);
      if (!this.autoLow && this.slow > 180) { this.autoLow = true; this.reason = 'low frame rate'; return true; } return false; } };
}
export function fxLevel(pref, { reducedMotion = false, autoLow = false, forced = null } = {}) {
  if (forced === 'off' || forced === 'low' || forced === 'full') return forced;
  if (pref === 'full') return 'full'; if (pref === 'low') return 'low';
  return reducedMotion || autoLow ? 'low' : 'full';
}
