// Pixel arena backgrounds, painted at 320x180 then scaled 2x (matches fighter pixel size).
const cache = {};
const mk = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
function grad(c, y0, y1, stops) { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); c.fillStyle = g; c.fillRect(0, y0, 320, y1 - y0); }
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
function stars(c, n, seed, h = 120) { const r = rng(seed); for (let i = 0; i < n; i++) R(c, r() * 320, r() * h, 1, 1, r() < 0.2 ? '#fff6c0' : '#c8d0ff'); }
function floorTiles(c, y, a, b, line) { R(c, 0, y, 320, 180 - y, a); for (let j = 0; y + j * 6 < 180; j++) { const yy = y + j * 6 + j * j * 0.6; R(c, 0, yy, 320, 1, line); } for (let i = -20; i < 40; i++) { const x0 = 160 + (i * 16 - 160) * 0.5, x1 = 160 + (i * 16 - 160) * 1.6; c.strokeStyle = line; c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, 180); c.stroke(); } c.fillStyle = b; c.globalAlpha = 0.25; c.fillRect(0, y, 320, 3); c.globalAlpha = 1; }

const PAINT = {
  mall(c) {
    grad(c, 0, 136, ['#070b22', '#141a46', '#2a2060']); stars(c, 70, 3, 80);
    R(c, 262, 18, 14, 14, '#f6e7b8'); R(c, 264, 16, 10, 18, '#f6e7b8'); R(c, 268, 20, 3, 3, '#e0d0a0');
    // skyline
    const r = rng(9); for (let x = 0; x < 320; x += 14 + Math.floor(r() * 10)) { const h = 30 + r() * 40, w = 12 + r() * 10; R(c, x, 120 - h, w, h, '#161a3a'); for (let wy = 120 - h + 4; wy < 116; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r() < 0.35) R(c, wx, wy, 2, 2, '#e8c46a'); }
    // mall building
    R(c, 40, 60, 240, 72, '#2a2f5c'); R(c, 40, 60, 240, 4, '#4a4f8c'); R(c, 36, 56, 248, 5, '#1c2046');
    R(c, 110, 40, 100, 20, '#1c2046'); R(c, 112, 42, 96, 16, '#2a1036');
    c.font = '9px Silkscreen, monospace'; c.textAlign = 'center'; c.fillStyle = '#ff5aa8'; c.fillText('KIBBLE MALL', 160, 54); c.fillStyle = '#ffd25a'; c.fillRect(116, 56, 88, 1);
    for (let i = 0; i < 6; i++) { const x = 52 + i * 38; R(c, x, 74, 30, 40, '#f4d58a'); R(c, x + 2, 76, 26, 36, '#ffe8b0'); R(c, x, 74, 30, 6, ['#c8282e', '#3fb6a8', '#6c5ce7', '#f2b84b', '#e0567a', '#5fb36a'][i]); R(c, x + 14, 80, 2, 32, '#e8c46a'); for (let k = 0; k < 3; k++) R(c, x + 4 + k * 8, 100, 5, 12, '#8a6a4a'); }
    // lamps
    for (const x of [24, 296]) { R(c, x, 96, 2, 40, '#30304a'); R(c, x - 4, 92, 10, 5, '#ffe7a3'); c.fillStyle = 'rgba(255,230,160,0.12)'; c.beginPath(); c.arc(x + 1, 96, 30, 0, 7); c.fill(); }
    // crowd silhouettes (shibas)
    for (let x = 0; x < 320; x += 9) { const y = 124 + (x % 3); R(c, x, y, 8, 10, '#1a1838'); R(c, x + 1, y - 2, 2, 2, '#1a1838'); R(c, x + 5, y - 2, 2, 2, '#1a1838'); }
    floorTiles(c, 134, '#3a3466', '#8a7ac8', '#2c2852'); R(c, 120, 134, 80, 4, '#4a8ac8');
  },
  canyon(c) {
    grad(c, 0, 136, ['#2a0e3a', '#a83a4a', '#f2a04a']); R(c, 200, 30, 30, 30, '#ffd88a'); R(c, 196, 34, 38, 22, '#ffd88a');
    const r = rng(5); let v = 90;
    for (let x = 0; x < 320; x += 10) { const up = r() < 0.58; const d = (r() * 18) * (up ? -1 : 1); const o = v, cl = v + d; v = Math.max(30, Math.min(110, cl)); const top = Math.min(o, v), bot = Math.max(o, v); const col = up ? '#3ec46a' : '#e04a5a';
      R(c, x + 4, top - 6 - r() * 6, 1, bot - top + 14, col); R(c, x + 1, top, 7, Math.max(2, bot - top), col); R(c, x + 1, top, 2, Math.max(2, bot - top), 'rgba(255,255,255,.25)'); }
    // canyon walls
    c.fillStyle = '#6a2e2e'; c.beginPath(); c.moveTo(0, 180); c.lineTo(0, 70); c.lineTo(30, 80); c.lineTo(50, 100); c.lineTo(70, 110); c.lineTo(80, 140); c.lineTo(0, 180); c.fill();
    c.beginPath(); c.moveTo(320, 180); c.lineTo(320, 60); c.lineTo(290, 74); c.lineTo(270, 100); c.lineTo(250, 112); c.lineTo(240, 140); c.fill();
    c.fillStyle = '#8a3e34'; c.beginPath(); c.moveTo(0, 90); c.lineTo(24, 96); c.lineTo(46, 116); c.lineTo(0, 130); c.fill(); c.beginPath(); c.moveTo(320, 84); c.lineTo(294, 92); c.lineTo(272, 116); c.lineTo(320, 128); c.fill();
    c.font = '7px Silkscreen, monospace'; c.fillStyle = '#3ec46a'; c.fillText('+4200%', 120, 22);
    R(c, 0, 134, 320, 46, '#b8643a'); for (let i = 0; i < 80; i++) R(c, r() * 320, 134 + r() * 46, 2 + r() * 4, 1, i % 2 ? '#9a4e2a' : '#d07a46'); R(c, 0, 134, 320, 2, '#e08a50');
  },
  moon(c) {
    grad(c, 0, 140, ['#03030c', '#0a0a24', '#1a1640']); stars(c, 140, 11, 120);
    c.fillStyle = '#3a7ac8'; c.beginPath(); c.arc(60, 40, 18, 0, 7); c.fill(); c.fillStyle = '#5fb36a'; R(c, 50, 30, 10, 6, '#5fb36a'); R(c, 62, 42, 8, 8, '#5fb36a'); c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.arc(54, 34, 8, 0, 7); c.fill();
    // temple
    R(c, 80, 50, 160, 8, '#c8c4d8'); R(c, 90, 44, 140, 6, '#d8d4e8'); c.fillStyle = '#e0dcf0'; c.beginPath(); c.moveTo(96, 44); c.lineTo(160, 22); c.lineTo(224, 44); c.fill();
    R(c, 148, 28, 24, 12, '#ffd25a'); R(c, 152, 30, 16, 8, '#e3b341'); c.font = '6px Silkscreen'; c.fillStyle = '#7a5a1a'; c.textAlign = 'center'; c.fillText('HODL', 160, 37);
    for (let i = 0; i < 7; i++) { const x = 92 + i * 22; R(c, x, 58, 10, 72, '#b8b4c8'); R(c, x + 2, 58, 2, 72, '#d8d4e8'); R(c, x + 7, 58, 3, 72, '#8a86a0'); R(c, x - 2, 126, 14, 5, '#9a96b0'); }
    // rocket statue
    R(c, 26, 70, 8, 40, '#e8e8f0'); c.fillStyle = '#c8282e'; c.beginPath(); c.moveTo(26, 70); c.lineTo(30, 58); c.lineTo(34, 70); c.fill(); R(c, 22, 100, 4, 10, '#c8282e'); R(c, 34, 100, 4, 10, '#c8282e'); R(c, 28, 80, 4, 4, '#7ad3f0'); R(c, 18, 110, 24, 20, '#8a86a0');
    R(c, 0, 132, 320, 48, '#8a8698'); const r = rng(4); for (let i = 0; i < 26; i++) { const x = r() * 320, y = 136 + r() * 40, w = 4 + r() * 14; R(c, x, y, w, 2, '#6a667a'); R(c, x + 1, y - 1, w - 2, 1, '#a8a4b8'); } R(c, 0, 132, 320, 2, '#b8b4c8');
  },
  pond(c) {
    grad(c, 0, 120, ['#06141a', '#0e2a2a', '#1a4038']); stars(c, 40, 21, 50); R(c, 240, 18, 12, 12, '#e8f4c8');
    const r = rng(8); for (let x = -10; x < 330; x += 18) { const h = 40 + r() * 50; R(c, x + 6, 120 - h, 4, h, '#0a1e1a'); c.fillStyle = '#103028'; c.beginPath(); c.arc(x + 8, 120 - h, 14 + r() * 8, 0, 7); c.fill(); }
    R(c, 0, 112, 320, 22, '#0e3a44'); for (let i = 0; i < 30; i++) R(c, r() * 320, 114 + r() * 18, 6 + r() * 10, 1, '#2a6a74');
    for (let i = 0; i < 8; i++) { const x = 20 + i * 40 + r() * 10, y = 118 + r() * 10; c.fillStyle = '#3d7a32'; c.beginPath(); c.ellipse(x, y, 9, 3, 0, 0.3, 6.1); c.fill(); if (i % 3 === 0) R(c, x - 1, y - 3, 3, 3, '#f2a0b8'); }
    for (let x = 0; x < 320; x += 6) R(c, x, 104 + (x % 5), 2, 10 + (x % 7), '#2a5a2a');
    R(c, 0, 134, 320, 46, '#3a4a2a'); for (let i = 0; i < 90; i++) R(c, r() * 320, 134 + r() * 46, 2, 1 + r() * 3, i % 2 ? '#4a6a32' : '#2a3a1e'); R(c, 0, 134, 320, 2, '#5a7a3a');
  },
  rugden(c) {
    grad(c, 0, 140, ['#12060e', '#2a0e1a', '#3a1420']);
    R(c, 100, 20, 120, 100, '#2a2a34'); c.fillStyle = '#4a4a58'; c.beginPath(); c.arc(160, 70, 42, 0, 7); c.fill(); c.fillStyle = '#6a6a7a'; c.beginPath(); c.arc(160, 70, 34, 0, 7); c.fill(); c.fillStyle = '#3a3a48'; c.beginPath(); c.arc(160, 70, 12, 0, 7); c.fill();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; R(c, 160 + Math.cos(a) * 24 - 2, 70 + Math.sin(a) * 24 - 2, 4, 4, '#e3b341'); }
    const r = rng(13); for (const [cx, w] of [[40, 70], [280, 70]]) for (let i = 0; i < 220; i++) { const x = cx + (r() - 0.5) * w * (1 - i / 260), y = 132 - (i / 220) * 46 * r(); R(c, x, y, 3, 2, r() < 0.5 ? '#e3b341' : '#ffd25a'); }
    for (const x of [8, 304]) { R(c, x, 20, 8, 112, '#3a2a30'); R(c, x + 2, 10, 4, 8, '#c8282e'); c.fillStyle = 'rgba(255,60,60,0.15)'; c.beginPath(); c.arc(x + 4, 14, 22, 0, 7); c.fill(); }
    c.font = '6px Silkscreen'; c.textAlign = 'center'; c.fillStyle = '#c8282e'; c.fillText('94% OF SUPPLY', 160, 16);
    // giant rug floor
    R(c, 0, 132, 320, 48, '#5a1420'); R(c, 20, 136, 280, 40, '#8e1a2a'); R(c, 24, 140, 272, 32, '#5a1420'); for (let i = 0; i < 17; i++) { const x = 32 + i * 16; R(c, x, 148, 8, 8, '#e3b341'); R(c, x + 2, 150, 4, 4, '#8e1a2a'); } for (let x = 20; x < 300; x += 4) { R(c, x, 176, 2, 4, '#e8d8b0'); }
  },
};

export function stageCanvas(id) {
  if (cache[id]) return cache[id];
  const lo = mk(320, 180), c = lo.getContext('2d'); c.imageSmoothingEnabled = false; c.fillStyle = '#120a1e'; c.fillRect(0, 0, 320, 180); (PAINT[id] || PAINT.mall)(c);
  const hi = mk(640, 360), h = hi.getContext('2d'); h.imageSmoothingEnabled = false; h.drawImage(lo, 0, 0, 640, 360);
  return (cache[id] = hi);
}
// animated overlay
export function stageFx(ctx, id, t) {
  if (id === 'pond') for (let i = 0; i < 10; i++) { const x = (i * 71 + Math.sin(t / 50 + i) * 30 + 640) % 640, y = 140 + Math.sin(t / 37 + i * 2) * 50; ctx.fillStyle = `rgba(230,255,140,${0.4 + 0.4 * Math.sin(t / 9 + i)})`; ctx.fillRect(x, y, 3, 3); }
  if (id === 'mall' && Math.floor(t / 30) % 2) { ctx.fillStyle = 'rgba(255,90,168,0.08)'; ctx.fillRect(220, 80, 200, 40); }
  if (id === 'moon') for (let i = 0; i < 5; i++) { if ((t + i * 40) % 200 < 2) continue; const k = ((t * 0.6 + i * 130) % 700); ctx.fillStyle = '#fff'; ctx.fillRect(700 - k, 20 + i * 18, 2, 2); }
  if (id === 'canyon') { const k = (t * 0.3) % 680; ctx.fillStyle = 'rgba(255,240,200,.5)'; for (let i = 0; i < 3; i++) ctx.fillRect((k + i * 220) % 680 - 20, 60 + i * 12, 14, 2); }
  if (id === 'rugden') { ctx.fillStyle = `rgba(255,30,30,${0.05 + 0.05 * Math.sin(t / 20)})`; ctx.fillRect(0, 0, 640, 360); }
}
