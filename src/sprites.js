// Original procedural pixel-art fighters. Skeleton poses + per-mascot heads, outlined and cached.
// President Inu's head/palette are ported from Inu Verse sprite.js (side view, Classic Tan coat).
export const GW = 64, GH = 60, OX = 26, FOOT = 58, SCALE = 2;
const INK = '#1a1420', MOUTH = '#5a3a32', TONGUE = '#e0707e';
const cache = new Map();
const rad = (d) => (d * Math.PI) / 180;

function grid() {
  const g = Array.from({ length: GH }, () => new Array(GW).fill(null));
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (c && x >= 0 && y >= 0 && x < GW && y < GH) g[y][x] = c; };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c); };
  const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) set(cx + x, cy + y, c); };
  const seg = (x0, y0, x1, y1, th, c) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2)); for (let i = 0; i <= n; i++) { const t = i / n; rect(Math.round(x0 + (x1 - x0) * t - th / 2), Math.round(y0 + (y1 - y0) * t - th / 2), th, th, c); } };
  return { g, set, rect, disc, seg };
}

// angles: 0 = straight down, 90 = forward, 180 = up. [upper, lower(relative)]
const P = {
  idle: { aF: [40, 95], aB: [25, 110], lF: [16, -6], lB: [-14, 4] },
  idle2: { aF: [38, 100], aB: [22, 112], lF: [16, -6], lB: [-14, 4], drop: 1 },
  walk0: { aF: [45, 90], aB: [15, 110], lF: [28, -14], lB: [-22, 6] },
  walk1: { aF: [40, 95], aB: [25, 105], lF: [8, 0], lB: [-6, 10], drop: 1 },
  walk2: { aF: [35, 100], aB: [30, 100], lF: [-18, 6], lB: [24, -10] },
  walk3: { aF: [40, 95], aB: [25, 105], lF: [4, 8], lB: [-4, 0], drop: 1 },
  crouch: { aF: [50, 90], aB: [35, 100], lF: [80, -120], lB: [40, -100], drop: 13 },
  jump: { aF: [110, 40], aB: [80, 60], lF: [85, -130], lB: [50, -110], tuck: 1 },
  jab: { aF: [92, 0], aB: [30, 120], lF: [22, -8], lB: [-18, 4], lean: 6 },
  hook: { aF: [96, -4], aB: [10, 120], lF: [28, -12], lB: [-24, 6], lean: 14 },
  kick: { aF: [50, 90], aB: [-20, 60], lF: [85, 6], lB: [-8, 2], lean: -10 },
  hkick: { aF: [60, 80], aB: [-30, 50], lF: [118, 4], lB: [-12, 2], lean: -20 },
  cjab: { aF: [90, 0], aB: [35, 100], lF: [80, -120], lB: [40, -100], drop: 13, lean: 6 },
  upper: { aF: [168, 6], aB: [10, 100], lF: [20, -10], lB: [-20, 4], lean: 4 },
  ckick: { aF: [55, 90], aB: [30, 100], lF: [90, 0], lB: [40, -110], drop: 15, lean: -6 },
  sweep: { aF: [70, 40], aB: [-30, 60], lF: [96, 0], lB: [50, -120], drop: 18, lean: 18 },
  jpunch: { aF: [120, 0], aB: [60, 80], lF: [85, -130], lB: [50, -110], tuck: 1, lean: 10 },
  jkick: { aF: [130, 30], aB: [100, 40], lF: [60, 0], lB: [40, -110], tuck: 1, lean: -8 },
  block: { aF: [70, 120], aB: [60, 125], lF: [14, -4], lB: [-18, 4], lean: -6 },
  cblock: { aF: [70, 120], aB: [60, 125], lF: [80, -120], lB: [40, -100], drop: 13, lean: -6 },
  hit: { aF: [-30, 40], aB: [-50, 30], lF: [20, -4], lB: [-24, 4], lean: -22, hurt: 1 },
  air: { aF: [150, 20], aB: [170, 20], lF: [40, 10], lB: [10, 20], lean: -30, hurt: 1 },
  down: { aF: [160, 0], aB: [175, 0], lF: [4, 0], lB: [-4, 0], hurt: 1, ko: 1 },
  win: { aF: [175, -10], aB: [165, 10], lF: [16, -6], lB: [-14, 4], happy: 1 },
  win2: { aF: [150, 30], aB: [175, -10], lF: [16, -6], lB: [-14, 4], happy: 1, drop: 1 },
  special: { aF: [92, 0], aB: [88, 6], lF: [30, -14], lB: [-26, 6], lean: 10, glow: 1 },
  rush: { aF: [94, 0], aB: [-40, 30], lF: [40, -30], lB: [-40, 10], lean: 26, glow: 1 },
  rise: { aF: [178, 0], aB: [40, 80], lF: [60, -90], lB: [0, 10], glow: 1 },
  super: { aF: [95, 0], aB: [92, 0], lF: [34, -16], lB: [-30, 6], lean: 12, glow: 2 },
  throw: { aF: [85, 40], aB: [75, 50], lF: [22, -8], lB: [-20, 6], lean: 8 },
  dizzy: { aF: [10, 30], aB: [-10, 20], lF: [12, -2], lB: [-12, 2], lean: -8, hurt: 1, dizzy: 1 },
};
export const POSES = Object.keys(P);

function headShiba(G, C, hx, hy, look = {}) {
  const { set, rect } = G, R = (x, y, w, h, c) => rect(hx + x, hy + y, w, h, c), S = (x, y, c) => set(hx + x, hy + y, c);
  R(6, 1, 2, 4, C.dark); S(7, 0, C.dark);
  if (!look.beanie) { R(10, 0, 2, 1, C.base); R(9, 1, 4, 1, C.base); R(9, 2, 5, 1, C.base); R(8, 3, 6, 2, C.base); R(10, 2, 2, 1, C.ear); R(10, 3, 3, 1, C.ear); }
  R(5, 4, 12, 1, C.base); R(4, 5, 13, 8, C.base); S(3, 9, C.base); S(3, 11, C.base); R(5, 13, 11, 1, C.base); R(7, 14, 7, 1, C.base);
  R(4, 6, 1, 6, C.dark); R(5, 13, 2, 1, C.dark);
  R(16, 8, 4, 1, C.base); R(16, 9, 5, 3, C.light); R(15, 12, 4, 1, C.light);
  R(20, 8, 2, 2, INK); S(19, 11, MOUTH); S(18, 11, MOUTH); S(17, 12, look.hurt ? MOUTH : TONGUE);
  R(10, 10, 6, 3, C.light); R(9, 13, 6, 1, C.light); R(9, 14, 5, 1, C.light); S(3, 11, C.light);
  if (look.hurt) { S(14, 6, INK); S(13, 7, INK); S(15, 7, INK); } else { R(14, 6, 1, 2, INK); if (look.sideeye) { S(13, 6, '#fff'); S(13, 7, '#fff'); } }
  S(15, 5, C.light); S(14, 5, C.light); S(12, 11, '#f0a8a8');
  if (look.sideeye) { R(12, 4, 4, 1, C.dark); }
  if (look.shades) { R(11, 6, 7, 1, '#141418'); R(13, 6, 4, 2, '#141418'); S(14, 6, '#5a6070'); }
  if (look.beanie) { R(6, -1, 10, 1, look.beanie); R(5, 0, 12, 5, look.beanie); R(5, 4, 12, 1, look.beanieD); for (let i = 0; i < 6; i++) S(6 + i * 2, 2, look.beanieD); S(10, -2, look.beanieD); }
}

function head(G, ch, pal, hx, hy, pose) {
  const { set, rect, disc } = G, R = (x, y, w, h, c) => rect(hx + x, hy + y, w, h, c), S = (x, y, c) => set(hx + x, hy + y, c), D = (x, y, r, c) => disc(hx + x, hy + y, r, c);
  const hurt = !!(pose.hurt), C = pal;
  switch (ch.head) {
    case 'shiba': headShiba(G, C, hx, hy, { hurt, shades: !hurt }); break;
    case 'doge': headShiba(G, C, hx, hy, { hurt, sideeye: true }); break;
    case 'wif': headShiba(G, C, hx, hy, { hurt, beanie: '#f2a0b8', beanieD: '#d0708e' }); break;
    case 'bonk': headShiba(G, C, hx, hy, { hurt }); R(8, 13, 7, 1, '#c8282e'); break;
    case 'frog': {
      D(11, 9, 7, C.base); R(4, 9, 17, 6, C.base); R(5, 14, 15, 2, C.light); D(9, 3, 3, C.base); D(15, 3, 3, C.base);
      D(9, 3, 2, '#fff'); D(15, 3, 2, '#fff'); R(hurt ? 9 : 10, 3, 1, 1, INK); R(hurt ? 15 : 16, 3, 1, 1, INK); if (!hurt) { S(10, 2, INK); S(16, 2, INK); }
      R(8, 2, 3, 1, C.dark); R(14, 2, 3, 1, C.dark);
      R(9, 11, 12, 1, '#7a2e2e'); R(12, 12, 8, 1, hurt ? '#7a2e2e' : C.light); S(20, 10, '#7a2e2e'); R(4, 8, 1, 6, C.dark); S(19, 8, C.dark); break;
    }
    case 'cat': {
      R(5, 4, 13, 10, C.base); R(4, 6, 1, 7, C.base); R(17, 6, 2, 7, C.base); R(6, 14, 11, 1, C.base);
      R(5, 0, 3, 4, C.base); S(6, -1, C.base); S(6, 1, C.ear); S(6, 2, C.ear); R(13, 0, 3, 4, C.base); S(14, -1, C.base); S(14, 1, C.ear); S(14, 2, C.ear);
      for (const x of [8, 10, 12]) R(x, 4, 1, 3, C.dark); R(5, 8, 2, 1, C.dark); R(5, 11, 2, 1, C.dark);
      R(13, 9, 6, 5, C.light); R(9, 12, 5, 3, C.light); S(19, 10, '#e8a0b4'); S(18, 12, MOUTH); S(17, 13, MOUTH);
      if (hurt) { S(14, 7, INK); S(15, 6, INK); S(15, 8, INK); } else { R(14, 6, 2, 3, '#7ad36a'); R(15, 6, 1, 3, INK); }
      for (const y of [11, 13]) { S(20, y, '#f4f0e8'); S(21, y, '#f4f0e8'); } R(4, 7, 1, 5, C.dark); break;
    }
    case 'toot': {
      D(11, 9, 7, C.base); R(6, 13, 12, 3, C.base); R(14, 7, 2, 2, INK); S(15, 7, '#fff'); R(13, 6, 4, 1, C.dark);
      R(13, 12, 6, 1, MOUTH); S(18, 11, MOUTH); R(4, 7, 1, 6, C.dark);
      R(5, 0, 12, 3, '#f2d24b'); S(5, -1, '#f2d24b'); S(9, -1, '#f2d24b'); S(13, -1, '#f2d24b'); S(16, -1, '#f2d24b'); S(9, 1, '#c8282e'); S(13, 1, '#3a7ac8'); R(5, 2, 12, 1, '#c09a2a');
      D(1, 12, 2, '#b8dc8a'); D(-1, 9, 1, '#b8dc8a'); break;
    }
    case 'seal': {
      D(11, 8, 7, C.base); R(14, 7, 8, 6, C.base); R(15, 11, 7, 2, C.light); R(20, 8, 2, 2, INK); R(13, 6, 2, 2, INK); S(13, 6, '#fff');
      for (const y of [10, 12]) { S(22, y, '#e8e8e8'); S(23, y, '#e8e8e8'); } R(4, 6, 1, 6, C.dark); R(16, 13, 3, 1, MOUTH); if (hurt) R(12, 5, 4, 1, C.dark); break;
    }
    case 'bull': {
      R(6, 3, 12, 11, C.base); R(14, 7, 7, 7, C.base); R(16, 10, 6, 4, C.light); R(18, 11, 1, 1, INK); R(20, 11, 1, 1, INK); R(17, 14, 4, 1, '#e3b341'); S(16, 13, '#e3b341'); S(21, 13, '#e3b341');
      R(4, 1, 5, 2, '#efe6d0'); S(3, 0, '#efe6d0'); S(2, -1, '#efe6d0'); R(12, 0, 3, 3, '#efe6d0'); S(15, -1, '#efe6d0');
      R(11, 6, 8, 2, '#141414'); R(12, 6, 3, 1, '#4a5060'); R(5, 4, 3, 2, C.dark); R(6, 5, 1, 8, C.dark); break;
    }
    case 'boomer': {
      R(6, 3, 12, 11, C.base); R(17, 7, 2, 3, C.base); S(19, 8, C.base); R(8, 13, 9, 2, C.base); R(5, 5, 4, 7, '#c8c8d0'); R(6, 3, 10, 2, '#c8c8d0');
      R(4, 1, 14, 3, C.acc); R(13, 3, 9, 1, '#2a5a9c'); R(14, 6, 2, 2, INK); S(14, 5, '#8a8a90'); S(15, 5, '#8a8a90');
      R(14, 10, 5, 2, '#d8d8e0'); R(14, 12, 4, 1, MOUTH); R(8, 7, 2, 2, C.dark); if (hurt) R(13, 6, 4, 1, INK); break;
    }
    case 'whale': {
      R(2, 2, 22, 13, C.base); R(1, 4, 1, 9, C.base); R(24, 5, 1, 9, C.base); R(6, 11, 19, 4, C.light); for (let i = 0; i < 5; i++) R(8 + i * 3, 12, 1, 3, '#9ab0d4');
      R(16, 6, 3, 3, '#fff'); R(17, 7, 2, 2, INK); R(15, 5, 5, 1, '#e3b341'); S(19, 9, '#e3b341'); S(19, 10, '#e3b341');
      R(5, -6, 12, 7, '#141414'); R(3, 1, 16, 1, '#141414'); R(5, -2, 12, 2, '#c8282e'); R(2, 3, 1, 9, C.dark);
      if (!hurt) R(14, 4, 6, 1, INK); break;
    }
  }
}

export const SKINS = { base: 'Classic', alt: 'Holder Alt', gold: 'Gold Bag', neon: 'Neon Degen' };
const SKIN_PAL = { gold: { top: '#e3b341', topD: '#a8801e', bot: '#c9962a', botD: '#8e6a18', acc: '#fff1b0', shoe: '#5a3a12' }, neon: { top: '#ff3ea5', topD: '#b0207a', bot: '#2ee6d6', botD: '#1a9a90', acc: '#f6ff3e', shoe: '#141418' } };
function paint(ch, poseName, skin) {
  const alt = skin && skin !== 'base';
  const pal = !alt ? ch.pal : skin === 'alt' ? { ...ch.pal, ...ch.alt } : { ...ch.pal, ...SKIN_PAL[skin] }, p = P[poseName] || P.idle, G = grid(), { set, rect, seg, disc } = G;
  const big = ch.boss ? 1 : 0;
  const drop = (p.drop || 0) + (p.tuck ? 8 : 0), lean = rad(p.lean || 0);
  const hipX = OX, hipY = FOOT - 22 + drop - (p.tuck ? 0 : 0), torsoL = 16 + big * 2;
  const shX = hipX + Math.sin(lean) * torsoL, shY = hipY - Math.cos(lean) * torsoL;
  const limb = (x, y, a1, a2, l1, l2) => { const e = [x + Math.sin(rad(a1)) * l1, y + Math.cos(rad(a1)) * l1]; const h = [e[0] + Math.sin(rad(a1 + a2)) * l2, e[1] + Math.cos(rad(a1 + a2)) * l2]; return [e, h]; };
  const leg = (ang, col, colD, shoe) => { const [k, f] = limb(hipX + (ang[0] > 0 ? 1 : -1), hipY, ang[0], ang[1], 11, 11); seg(hipX, hipY, k[0], k[1], 6 + big, col); seg(k[0], k[1], f[0], f[1], 5 + big, col); seg(k[0] + 1, k[1], f[0] + 1, f[1], 1, colD);
    const fx = Math.round(f[0]), fy = Math.min(FOOT - 1, Math.round(f[1])); rect(fx - 2, fy - 1, 7, 3, shoe); rect(fx - 2, fy + 1, 7, 1, '#000a'); };
  const arm = (ang, col, colD, paw, front) => { const sx = shX + (front ? 2 : -2), sy = shY + 2; const [e, h] = limb(sx, sy, ang[0], ang[1], 8, 8); seg(sx, sy, e[0], e[1], 5 + big, col); seg(e[0], e[1], h[0], h[1], 4 + big, col); seg(e[0], e[1] + 1, h[0], h[1] + 1, 1, colD); disc(h[0], h[1], 2 + big, paw); return h; };
  const ghost = '#00000000';
  // back limbs (darker)
  const hB = arm(p.aB, pal.topD, '#0006', pal.dark, false);
  leg(p.lB, pal.botD, '#0006', pal.shoe);
  if (ch.head === 'shiba' || ch.head === 'doge' || ch.head === 'wif' || ch.head === 'bonk') { // curled tail
    const tx = hipX - 8 - Math.sin(lean) * 2, ty = hipY - 6; rect(tx - 2, ty, 4, 3, pal.base); set(tx - 3, ty + 1, pal.base); set(tx - 1, ty - 1, pal.base); set(tx, ty - 1, pal.base); set(tx - 1, ty + 1, pal.light); set(tx, ty + 1, pal.light);
  }
  if (ch.head === 'cat') { const tx = hipX - 7, ty = hipY - 2; for (let i = 0; i < 9; i++) set(tx - Math.round(Math.sin(i / 3) * 3), ty - i, i % 3 === 2 ? pal.dark : pal.base), set(tx - Math.round(Math.sin(i / 3) * 3) - 1, ty - i, pal.base); }
  if (ch.head === 'whale') { rect(hipX - 10, hipY - 2, 5, 4, pal.base); rect(hipX - 14, hipY - 5, 5, 3, pal.base); rect(hipX - 14, hipY + 2, 5, 3, pal.base); }
  // torso
  const tw = 13 + big * 4;
  for (let i = 0; i <= torsoL; i++) { const t = i / torsoL, cx = hipX + (shX - hipX) * t, cy = hipY - (hipY - shY) * t, w = Math.round(tw - 2 + t * 2);
    rect(Math.round(cx - w / 2), Math.round(cy), w, 1, pal.top); set(Math.round(cx - w / 2), Math.round(cy), pal.topD); }
  const at = (t, dx) => [hipX + (shX - hipX) * t + dx, hipY - (hipY - shY) * t];
  // belt / waist
  for (let dx = -5; dx <= 5; dx++) { const [x, y] = at(0.05, dx); set(x, y, pal.botD); }
  // costume details
  if (ch.id === 'inu' && skin !== 'alt') { for (let i = 0; i < 10; i++) { const [x, y] = at(0.95 - i * 0.07, 3); set(x, y, '#f7e6c8'); } for (let i = 0; i < 9; i++) { const [x, y] = at(0.92 - i * 0.07, 3); set(x + (i < 2 ? 0 : 0), y, i === 0 ? '#f7e6c8' : pal.acc); }
    for (let i = 0; i < 13; i++) { const [x, y] = at(0.9 - i * 0.065, -4 + i * 0.75); set(x, y, i % 4 === 0 ? '#c8282e' : '#e8d8b0'); } }
  else if (ch.id === 'inu') { for (let i = 0; i < 9; i++) { const [x, y] = at(0.92 - i * 0.07, 3); set(x, y, pal.acc); } }
  if (ch.head === 'seal') for (let i = 1; i < torsoL - 1; i++) { const [x, y] = at(i / torsoL, 2); rect(x - 1, y, 5, 1, pal.light); }
  if (ch.head === 'frog' || ch.head === 'boomer') for (let i = 2; i < torsoL; i += 4) { const [x, y] = at(i / torsoL, 3); set(x, y, '#ffffff'); }
  if (ch.id === 'moneymew') { const [x, y] = at(0.92, 0); for (let d = -3; d <= 3; d++) set(x + d, y + Math.abs(d) * 0.5, pal.acc); rect(x - 1, y + 2, 3, 3, pal.acc); set(x, y + 3, '#fff1b0'); }
  if (ch.id === 'bullencia') { const [x, y] = at(0.6, 0); rect(x - 3, y, 7, 2, pal.acc); }
  if (ch.id === 'muchwow' || ch.id === 'sealbert') { const [x, y] = at(0.95, 2); rect(x - 3, y, 6, 1, pal.acc); }
  if (ch.head === 'whale') { const [x, y] = at(0.9, 3); rect(x - 1, y, 2, 8, pal.acc); for (let i = 0; i < 3; i++) set(at(0.6 - i * 0.2, 1)[0], at(0.6 - i * 0.2, 1)[1], '#e3b341'); }
  if (ch.id === 'toot') for (let i = 0; i < torsoL; i += 3) { const [x, y] = at(i / torsoL, -4); set(x, y, pal.acc); }
  // front leg + head + front arm
  leg(p.lF, pal.bot, pal.botD, pal.shoe);
  const hx = Math.round(shX - 10 + (p.hurt ? -2 : 0)), hy = Math.round(shY - 15 + (big ? -2 : 0) + (p.happy ? -1 : 0));
  head(G, ch, pal, hx - (big ? 2 : 0), hy, p);
  const hF = arm(p.aF, pal.top, pal.topD, pal.light, true);
  // props
  if (ch.id === 'bonkus') { const [x, y] = hF, a = rad(p.aF[0] + p.aF[1] + 180); seg(x, y, x + Math.sin(a) * 14, y + Math.cos(a) * 14, 3, '#8a5a34'); seg(x + Math.sin(a) * 6, y + Math.cos(a) * 6, x + Math.sin(a) * 14, y + Math.cos(a) * 14, 4, '#a8743e'); }
  if (ch.id === 'boomer' && (poseName === 'idle' || poseName === 'idle2' || poseName.startsWith('walk'))) { const [x, y] = hB; seg(x, y, x - 2, y + 12, 1, '#c0c0c8'); rect(x - 4, y + 12, 4, 2, '#c0c0c8'); }
  if (p.dizzy) { set(hx + 4, hy - 3, '#ffd25a'); set(hx + 12, hy - 5, '#ffd25a'); set(hx + 19, hy - 2, '#ffd25a'); }
  return G.g;
}

function toCanvas(g) {
  const W = GW + 2, H = GH + 2, cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const c = cv.getContext('2d'), at = (x, y) => (y >= 0 && y < GH && x >= 0 && x < GW ? g[y][x] : null);
  for (let y = -1; y <= GH; y++) for (let x = -1; x <= GW; x++) { const col = at(x, y);
    if (col) { c.fillStyle = col; c.fillRect(x + 1, y + 1, 1, 1); } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) { c.fillStyle = INK; c.fillRect(x + 1, y + 1, 1, 1); } }
  return cv;
}

export function sprite(ch, pose, skin = 'base') {
  if (skin === true) skin = 'alt'; if (!skin) skin = 'base';
  const key = ch.id + '|' + pose + '|' + skin;
  let cv = cache.get(key); if (!cv) { cv = toCanvas(paint(ch, pose, skin)); cache.set(key, cv); }
  return cv;
}

// state -> pose name
export function poseFor(f, tick) {
  const mv = f.move;
  switch (f.st) {
    case 'idle': return Math.floor(tick / 24) % 2 ? 'idle2' : 'idle';
    case 'walk': return 'walk' + (Math.floor(tick / 7) % 4);
    case 'crouch': return 'crouch';
    case 'block': case 'blockstun': return f.crouchHeld ? 'cblock' : 'block';
    case 'cblock': return 'cblock';
    case 'jump': return mv ? mv.pose : 'jump';
    case 'attack': { if (mv.proj || mv.super) return f.t < mv.s ? 'throw' : mv.super ? 'super' : 'special'; if (mv.dash || mv.rise) return mv.pose; return f.t < mv.s ? (mv.name[0] === 'c' ? 'crouch' : 'idle') : f.t <= mv.s + mv.a + 3 ? mv.pose : (mv.name[0] === 'c' ? 'crouch' : 'idle'); }
    case 'hitstun': return 'hit';
    case 'air': return 'air';
    case 'down': case 'ko': return 'down';
    case 'getup': return 'crouch';
    case 'throw': return 'throw';
    case 'thrown': return 'hit';
    case 'win': return Math.floor(tick / 20) % 2 ? 'win2' : 'win';
    case 'dizzy': return 'dizzy';
    case 'special': return 'super';
  }
  return 'idle';
}
