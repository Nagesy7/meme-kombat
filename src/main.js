import { ROSTER, BOSS, byId, STAGES } from './roster.js';
import { mkMatch, step, cpuInput, W, ROUND_FRAMES } from './logic.js';
import { sprite, poseFor, SKINS } from './sprites.js';
import { stageCanvas, stageFx } from './stages.js';
import { unlock, sfx, music, setMuted, isMuted } from './audio.js';
import * as K from './kibble.js';

const cv = document.getElementById('game'), ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
const TOUCH = () => document.body.classList.contains('touch') && innerWidth > innerHeight;
const H = 360, GY = 318, FONT = '"Press Start 2P", monospace', SMALL = 'Silkscreen, monospace';
const G = { scr: 'title', t: 0, mode: 'arcade', sel: [0, 1], skinIdx: [0, 0], ready: [false, false], match: null, ladder: [], li: 0, fx: [], shake: 0, menuI: 0, msg: '', owned: ['base'], holder: false, cpuLevel: 0.5, rankOpp: null, lastRank: null, shopI: 0, paused: false };
window.__mb = G;

// ---------------- input ----------------
const pads = [{}, {}], prevPads = [{}, {}], touchPad = {};
const KEY1 = { KeyW: 'u', KeyS: 'd', KeyA: 'l', KeyD: 'r', KeyF: 'lp', KeyG: 'hp', KeyV: 'lk', KeyB: 'hk' };
const KEY2 = { ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r', KeyK: 'lp', KeyL: 'hp', Comma: 'lk', Period: 'hk' };
const held = new Set(), tapped = new Set(), touchTap = {};
addEventListener('keydown', (e) => { unlock(); if (KEY1[e.code] || KEY2[e.code] || e.code === 'Space') e.preventDefault(); if (e.repeat) return; held.add(e.code); tapped.add(e.code);
  if (e.code === 'Enter' || e.code === 'Space') menuKey('ok'); if (e.code === 'Escape' || e.code === 'Backspace') menuKey('back'); if (e.code === 'KeyM') setMuted(!isMuted()); if (e.code === 'KeyP' && G.scr === 'fight') G.paused = !G.paused; });
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());
function readPads() {
  const two = G.scr === 'fight' ? G.mode === 'versus' : G.scr === 'select' && G.mode === 'versus';
  for (let i = 0; i < 2; i++) { prevPads[i] = pads[i]; pads[i] = {}; }
  for (const c of new Set([...held, ...tapped])) { if (KEY1[c]) pads[0][KEY1[c]] = 1; if (KEY2[c]) pads[two ? 1 : 0][KEY2[c]] = 1; }
  for (const k in touchPad) if (touchPad[k] || touchTap[k]) pads[0][k] = 1;
  tapped.clear(); for (const k in touchTap) touchTap[k] = 0;
}
const edge = (i, k) => pads[i][k] && !prevPads[i][k];

// touch controls
const touch = document.getElementById('touch');
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
const dpad = document.getElementById('dpad');
function dpadSet(e) { const r = dpad.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2, dead = r.width * 0.14;
  touchPad.l = x < -dead ? 1 : 0; touchPad.r = x > dead ? 1 : 0; touchPad.u = y < -dead * 1.3 ? 1 : 0; touchPad.d = y > dead ? 1 : 0;
  dpad.dataset.dir = (touchPad.u ? 'u' : '') + (touchPad.d ? 'd' : '') + (touchPad.l ? 'l' : '') + (touchPad.r ? 'r' : ''); }
dpad.addEventListener('pointerdown', (e) => { unlock(); dpad.setPointerCapture(e.pointerId); dpadSet(e); for (const k of ['u', 'd', 'l', 'r']) if (touchPad[k]) touchTap[k] = 1; e.preventDefault(); });
dpad.addEventListener('pointermove', (e) => { if (e.buttons || e.pressure) dpadSet(e); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) dpad.addEventListener(ev, () => { touchPad.u = touchPad.d = touchPad.l = touchPad.r = 0; dpad.dataset.dir = ''; });
for (const b of document.querySelectorAll('#btns button')) { const k = b.dataset.k;
  b.addEventListener('pointerdown', (e) => { unlock(); touchPad[k] = 1; touchTap[k] = 1; b.classList.add('on'); e.preventDefault(); if (k === 'lk' && G.scr !== 'fight' && G.scr !== 'select') menuKey('back'); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { touchPad[k] = 0; b.classList.remove('on'); }); }
document.getElementById('pauseBtn').addEventListener('click', () => { unlock(); if (G.scr === 'fight') G.paused = !G.paused; else menuKey('back'); });
document.getElementById('muteBtn').addEventListener('click', (e) => { unlock(); setMuted(!isMuted()); e.target.textContent = isMuted() ? '🔇' : '🔊'; });
for (const ev of ['gesturestart', 'dblclick', 'contextmenu', 'selectstart']) document.addEventListener(ev, (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// clickable regions on canvas
let regions = [];
const btn = (x, y, w, h, fn, hover) => regions.push({ x, y, w, h, fn, hover });
cv.addEventListener('pointerdown', (e) => { unlock(); const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
  for (const g of [...regions].reverse()) if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h) { sfx('select'); g.fn(); return; } if (G.scr === 'title') go('menu'); });

// ---------------- screens ----------------
const MENU = [['ARCADE', () => { G.mode = 'arcade'; go('select'); }], ['VERSUS 2P', () => { G.mode = 'versus'; go('select'); }], ['RANKED LADDER', () => { G.mode = 'ranked'; go('select'); }], ['SKIN SHOP + WALLET', () => go('shop')], ['HOW TO PLAY', () => go('help')]];
function go(s) { G.scr = s; G.t = 0; regions = []; G.ready = [false, false]; if (s === 'menu' || s === 'title' || s === 'select' || s === 'shop' || s === 'help') music('menu'); if (s === 'select') refreshOwned(); }
async function refreshOwned() { const inv = K.wallet.address ? await K.wallet.inventory() : []; G.holder = await K.isHolder(); G.owned = ['base', ...(G.holder ? ['alt'] : []), ...inv.filter((x) => SKINS[x])]; G.bal = K.wallet.address ? (await K.wallet.balance()).ui : null; }
function menuKey(k) {
  if (G.scr === 'title') { sfx('confirm'); return go('menu'); }
  if (G.scr === 'menu') { if (k === 'up') G.menuI = (G.menuI + MENU.length - 1) % MENU.length; if (k === 'down') G.menuI = (G.menuI + 1) % MENU.length; if (k === 'ok') { sfx('confirm'); MENU[G.menuI][1](); } if (k === 'back') go('title'); if (k === 'up' || k === 'down') sfx('select'); return; }
  if (G.scr === 'select') { if (k === 'back') { if (G.ready[0]) G.ready[0] = false; else go('menu'); } return; }
  if (G.scr === 'fight') { if (k === 'back') { if (G.paused) { G.paused = false; go('menu'); } else G.paused = true; } return; }
  if (G.scr === 'gameover' || G.scr === 'rankres' || G.scr === 'ending') { if (k === 'ok') { sfx('confirm'); go(G.scr === 'rankres' ? 'select' : 'menu'); } return; }
  if (G.scr === 'ladder') { if (k === 'ok') startFight(); return; }
  if (G.scr === 'shop') { if (k === 'up') G.shopI = Math.max(0, G.shopI - 1); if (k === 'down') G.shopI = Math.min(K.SHOP.length + 1, G.shopI + 1); if (k === 'ok') shopAct(G.shopI); if (k === 'back') go('menu'); return; }
  if (G.scr === 'help' && (k === 'back' || k === 'ok')) go('menu');
}

// selection
const COLS = 5;
function selectStep() {
  const n = ROSTER.length;
  for (let p = 0; p < (G.mode === 'versus' ? 2 : 1); p++) {
    if (G.ready[p]) { if (edge(p, 'lk')) G.ready[p] = false; continue; }
    if (p === 0 && edge(0, 'lk') && G.t > 10) { go('menu'); return; }
    let s = G.sel[p]; if (edge(p, 'l')) s = (s + n - 1) % n; if (edge(p, 'r')) s = (s + 1) % n; if (edge(p, 'u') || edge(p, 'd')) s = (s + COLS) % n;
    if (s !== G.sel[p]) { G.sel[p] = s; G.skinIdx[p] = 0; sfx('select'); }
    if (edge(p, 'hk')) { G.skinIdx[p] = (G.skinIdx[p] + 1) % G.owned.length; sfx('select'); }
    if (edge(p, 'lp') || edge(p, 'hp') || (p === 0 && held.has('Enter') && G.t > 10 && !G.enterLatch)) { G.ready[p] = true; sfx('confirm'); }
  }
  G.enterLatch = held.has('Enter');
  const need = G.mode === 'versus' ? G.ready[0] && G.ready[1] : G.ready[0];
  if (need) { G.p1 = ROSTER[G.sel[0]].id; G.skin = [G.owned[G.skinIdx[0]] || 'base', G.owned[G.skinIdx[1]] || 'base'];
    if (G.mode === 'versus') { G.p2 = ROSTER[G.sel[1]].id; G.vsT = 0; go('versus'); }
    else if (G.mode === 'arcade') { const others = ROSTER.filter((c) => c.id !== G.p1).map((c) => c.id); for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; } G.ladder = [...others.slice(0, 6), BOSS.id]; G.li = 0; go('ladder'); }
    else { const lb = K.leaderboard(), me = lb.findIndex((e) => e.you), opp = lb[Math.max(0, me - 1)].you ? lb[me + 1] : lb[Math.max(0, me - 1)]; G.rankOpp = opp; G.p2 = ROSTER[opp.char % ROSTER.length].id; if (G.p2 === G.p1) G.p2 = ROSTER[(opp.char + 1) % ROSTER.length].id; G.cpuLevel = Math.max(0.3, Math.min(0.95, (opp.rating - 1000) / 900)); go('versus'); } }
}
function startFight() { if (G.mode === 'arcade') { G.p2 = G.ladder[G.li]; G.cpuLevel = 0.35 + G.li * 0.09; } go('versus'); }
function beginMatch() {
  const o2 = { skin: G.mode === 'versus' ? G.skin[1] : 'base' }; if (G.p1 === G.p2) o2.skin = o2.skin === 'base' ? 'alt' : 'base';
  G.match = mkMatch(G.p1, G.p2, { o1: { skin: G.skin[0] }, o2, seed: Date.now() & 0xffff }); G.fx = []; go('fight'); music(G.match.stage);
}
function matchOver() {
  const m = G.match, won = m.matchWinner === 0;
  if (G.mode === 'versus') return go('gameover');
  if (G.mode === 'ranked') { const before = K.profile().rating, p = K.recordRanked(G.rankOpp.rating, won); G.lastRank = { won, before, after: p.rating, opp: G.rankOpp }; return go('rankres'); }
  if (won) { G.li++; if (G.li >= G.ladder.length) return go('ending'); go('ladder'); } else go('gameover');
}

// ---------------- drawing helpers ----------------
function text(s, x, y, size = 16, col = '#fff6e0', align = 'center', font = FONT, shadow = '#1a1420') { ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; if (shadow) { ctx.fillStyle = shadow; ctx.fillText(s, x + Math.max(1, size / 8), y + Math.max(1, size / 8)); } ctx.fillStyle = col; ctx.fillText(s, x, y); }
function panel(x, y, w, h, col = '#121a36', edge = '#d4a640') { ctx.fillStyle = edge; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); ctx.fillStyle = col; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(x, y, w, 3); }
function drawSprite(ch, pose, skin, x, y, s = 2, face = 1, opts = {}) {
  const sp = sprite(ch, pose, skin); ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (opts.rot) ctx.rotate(opts.rot); ctx.scale(s * face, s * (opts.sy || 1)); if (opts.alpha != null) ctx.globalAlpha = opts.alpha; if (opts.filter) ctx.filter = opts.filter; ctx.drawImage(sp, -27, -59); ctx.restore();
}
function portrait(ch, x, y, s, skin = 'base', face = 1) { // head-and-shoulders crop
  const sp = sprite(ch, 'idle', skin); ctx.save(); ctx.beginPath(); ctx.rect(x, y, 30 * s, 26 * s); ctx.clip(); ctx.translate(x + (face < 0 ? 30 * s : 0), y); ctx.scale(s * face, s); ctx.drawImage(sp, -8, ch.boss ? -0 : 1); ctx.restore();
}

// ---------------- fight render ----------------
function fighterDraw(f, m) {
  let rot = 0, sy = 1, dy = 0, dx = 0, alpha = 1, filter = null, s = 2;
  const pose = poseFor(f, m.tick);
  if (pose === 'down') { rot = -Math.PI / 2 * f.face; dy = -4; dx = -24 * f.face; }
  if (f.st === 'air') rot = -Math.min(1.3, f.t * 0.06) * f.face;
  if (f.st === 'getup') sy = 0.9;
  if (f.hitFlash > 0 && f.hitFlash % 2) filter = 'brightness(2.2)';
  if (f.inv > 0 && f.st !== 'getup' && m.tick % 4 < 2) alpha = 0.6;
  if (m.finisher && m.f[1 - m.finisher.who] === f) { const r = finisherLoser(m, f); if (r.hide) return; ({ rot = rot, sy = sy, dx = dx, dy = dy, alpha = alpha, filter = filter } = { rot, sy, dx, dy, alpha, filter, ...r }); s = 2 * (r.scale ?? 1); }
  ctx.fillStyle = 'rgba(10,8,20,.35)'; ctx.beginPath(); ctx.ellipse(f.x, GY + 1, 26 * Math.max(0.3, 1 - f.y / 200), 5, 0, 0, 7); ctx.fill();
  if (f.move?.special && f.st === 'attack') { ctx.fillStyle = f.ch.specials.proj.color; ctx.globalAlpha = 0.25 + 0.15 * Math.sin(m.tick / 2); ctx.beginPath(); ctx.arc(f.x, GY - f.y - 56, 50, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  drawSprite(f.ch, pose, f.skin, f.x + dx, GY - f.y + dy, s, f.face, { rot, sy, alpha, filter });
  if (f.st === 'dizzy') for (let i = 0; i < 3; i++) { const a = m.tick / 10 + i * 2.1; text('*', f.x + Math.cos(a) * 22, GY - 118 + Math.sin(a) * 6, 10, '#ffd25a'); }
}
function drawProj(p, t) {
  const x = p.x, y = GY - p.y; ctx.save(); ctx.translate(x, y); ctx.scale(Math.sign(p.vx) || 1, 1); const c = p.color, R = (a, b, w, h, col = c) => { ctx.fillStyle = col; ctx.fillRect(a, b, w, h); };
  ctx.fillStyle = c; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(t / 3) * 3, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  switch (p.kind) {
    case 'scroll': R(-12, -8, 24, 16, '#f6e7b8'); R(-14, -10, 4, 20, c); R(10, -10, 4, 20, c); R(-6, -3, 12, 2, '#5a3a22'); R(-6, 2, 8, 2, '#5a3a22'); break;
    case 'bubble': ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.stroke(); R(-6, -7, 4, 4, '#fff'); break;
    case 'wow': ctx.rotate(t / 4); for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); R(0, -2, 16, 4); } R(-6, -6, 12, 12, '#fff6c0'); break;
    case 'hat': ctx.rotate(t / 3); R(-12, -4, 24, 10, '#f2a0b8'); R(-10, -8, 20, 4, '#d0708e'); R(-2, -12, 4, 4, '#d0708e'); break;
    case 'bat': ctx.rotate(t / 2.5); R(-16, -3, 32, 6, '#8a5a34'); R(4, -4, 12, 8, '#a8743e'); break;
    case 'coin': { const w = Math.abs(Math.cos(t / 4)) * 11 + 2; ctx.fillStyle = '#a8801e'; ctx.fillRect(-w, -12, w * 2, 24); ctx.fillStyle = '#ffd25a'; ctx.fillRect(-w + 2, -10, w * 2 - 4, 20); if (w > 6) { ctx.fillStyle = '#a8801e'; ctx.fillRect(-2, -6, 4, 12); } break; }
    case 'gas': for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#9cc46a' : '#b8dc8a'; ctx.beginPath(); ctx.arc(Math.cos(t / 6 + i) * 8, Math.sin(t / 5 + i * 2) * 8, 9, 0, 7); ctx.fill(); } break;
    case 'fish': R(-12, -5, 20, 10); R(8, -8, 6, 16); R(-8, -2, 3, 3, '#141418'); break;
    case 'snort': for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(240,240,240,.8)'; ctx.beginPath(); ctx.arc(-i * 7, Math.sin(t / 3 + i) * 3, 8 - i, 0, 7); ctx.fill(); } break;
    case 'paper': ctx.rotate(Math.sin(t / 4) * 0.3); R(-14, -9, 28, 18, '#f4f4f4'); for (let i = 0; i < 4; i++) R(-11, -6 + i * 4, i ? 22 : 10, 2, '#8a8a90'); break;
    case 'rug': ctx.rotate(t / 5); R(-16, -10, 32, 20, '#8e1a2a'); R(-12, -6, 24, 12, '#e3b341'); R(-8, -3, 16, 6, '#8e1a2a'); break;
  }
  ctx.restore();
}
function spawnFx(ev) {
  if (ev.type === 'hit' || ev.type === 'block') { const n = ev.type === 'hit' ? (ev.heavy ? 14 : 8) : 6, col = ev.type === 'hit' ? ['#fff6c0', '#ffd25a', '#ff7a4a'] : ['#bfe8ff', '#7ad3f0', '#fff'];
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.3, v = 1 + Math.random() * 4; G.fx.push({ x: ev.x, y: GY - ev.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 14 + Math.random() * 10, col: col[i % 3], s: 3 + (Math.random() * 3 | 0) }); }
    if (ev.type === 'hit') { G.fx.push({ ring: 1, x: ev.x, y: GY - ev.y, life: 10, r: 6 }); G.shake = ev.heavy ? 8 : 3; } }
  if (ev.type === 'land' && ev.heavy) { for (let i = 0; i < 10; i++) G.fx.push({ x: G.match.f[ev.who].x + (Math.random() - 0.5) * 50, y: GY, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, life: 20, col: '#c8b89a', s: 4 }); G.shake = 5; }
  if (ev.type === 'ko') G.shake = 14;
  sfx(ev.type === 'banner' ? 'banner' : ev.type, ev);
}
function drawFx() { for (const p of G.fx) { if (p.ring) { ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r += 3, 0, 7); ctx.stroke(); } else { p.x += p.vx; p.y += p.vy; p.vy += 0.2; ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } p.life--; } G.fx = G.fx.filter((p) => p.life > 0); }
function bar(x, y, w, h, frac, col, back = '#3a1420', flip = false) { ctx.fillStyle = '#1a1420'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); ctx.fillStyle = back; ctx.fillRect(x, y, w, h); const fw = Math.round(w * Math.max(0, frac)); ctx.fillStyle = col; ctx.fillRect(flip ? x + w - fw : x, y, fw, h); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(flip ? x + w - fw : x, y, fw, 3); }
function hud(m) {
  const [a, b] = m.f;
  for (const [f, i] of [[a, 0], [b, 1]]) { const flip = i === 1, bx = flip ? 360 : 60;
    if (f.ghostHp == null || f.ghostHp < f.hp) f.ghostHp = f.hp; else f.ghostHp = Math.max(f.hp, f.ghostHp - 4);
    panel(flip ? 584 : 8, 8, 48, 42, '#121a36'); portrait(f.ch, flip ? 584 : 8, 9, 1.6, f.skin, flip ? -1 : 1);
    bar(bx, 14, 220, 16, f.ghostHp / f.maxHp, '#c8282e', '#3a1420', flip); ctx.fillStyle = f.hp / f.maxHp > 0.3 ? '#ffd25a' : '#ff7a4a'; const fw = Math.round(220 * f.hp / f.maxHp); ctx.fillRect(flip ? bx + 220 - fw : bx, 14, fw, 16); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(flip ? bx + 220 - fw : bx, 14, fw, 3);
    text(f.ch.name.toUpperCase(), flip ? 580 : 60, 40, 8, '#fff6e0', flip ? 'right' : 'left');
    for (let w = 0; w < 2; w++) { const wx = flip ? 368 + w * 14 : 270 - w * 14; ctx.fillStyle = '#1a1420'; ctx.fillRect(wx - 1, 35, 12, 12); ctx.fillStyle = m.wins[i] > w ? '#ffd25a' : '#3a3450'; ctx.fillRect(wx, 36, 10, 10); }
    const full = f.meter >= 100, my = TOUCH() ? 62 : 338; bar(TOUCH() ? (flip ? 420 : 60) : (flip ? 420 : 20), my, TOUCH() ? 160 : 200, TOUCH() ? 7 : 10, f.meter / 100, full ? (m.tick % 10 < 5 ? '#ff5aa8' : '#7ad3f0') : '#3fb6a8', '#142030', flip);
    text(full ? 'SUPER READY' : 'BAG METER', TOUCH() ? (flip ? 416 : 224) : (flip ? 620 : 20), TOUCH() ? 65 : 326, TOUCH() ? 6 : 7, full ? '#ff5aa8' : '#9ab0d4', TOUCH() ? (flip ? 'right' : 'left') : (flip ? 'right' : 'left'), FONT);
    if (f.combo >= 2) text(`${f.combo} HITS`, flip ? 560 : 80, 90, 12, '#ffd25a'); }
  panel(296, 8, 48, 34, '#121a36'); text(String(Math.max(0, Math.ceil(m.timer / 60))).padStart(2, '0'), 320, 26, 16, m.timer < 600 ? '#ff7a4a' : '#fff6e0');
  text(STAGES[m.stage] || '', 320, TOUCH() ? 76 : 52, 7, '#9ab0d4', 'center', SMALL);
  if (m.banner) { const k = m.banner.t / m.banner.max, sc = 1 + Math.max(0, (k - 0.85)) * 3; ctx.save(); ctx.translate(320, 150); ctx.scale(sc, sc); const len = m.banner.text.length, size = len > 16 ? 18 : len > 10 ? 24 : 34;
    ctx.fillStyle = 'rgba(18,10,30,.55)'; ctx.fillRect(-320, -size, 640, size * 2 + (m.banner.sub ? 22 : 0)); text(m.banner.text, 0, 0, size, m.banner.text.includes('RUG') || m.banner.text.includes('FINISH') ? '#ff5a5a' : '#ffd25a'); if (m.banner.sub) text(m.banner.sub, 0, size + 6, 9, '#fff6e0'); ctx.restore(); }
  if (m.phase === 'finish') { const w = m.f[m.matchWinner], left = Math.ceil((180 - m.pt) / 60); text(`${left}`, 320, 230, 20, '#ff5a5a'); if (G.mode !== 'versus' && m.matchWinner === 1) {} }
}
// ---- finishers (cartoony, not gory) ----
function finisherLoser(m, f) {
  const t = m.pt, k = m.finisher.kind;
  switch (k) {
    case 'rug': return t < 50 ? {} : { rot: (t - 50) * 0.25, dy: -Math.min(400, (t - 50) * (t - 50) * 0.08), dx: (t - 50) * 2 * -f.face };
    case 'shrink': return { scale: Math.max(0.15, 1 - t / 80), dy: t > 90 ? -Math.abs(Math.sin(t / 6)) * 20 : 0, dx: t > 90 ? (t - 90) * 4 * -f.face : 0, hide: t > 190 };
    case 'moon': return t < 40 ? {} : { dy: -Math.pow(t - 40, 1.8) * 0.4, rot: 0, scale: Math.max(0.2, 1 - (t - 40) / 160) };
    case 'hat': return { sy: t > 40 ? Math.max(0.15, 1 - (t - 40) / 40) : 1, hide: t > 130 };
    case 'bonk': return { dy: t > 46 ? Math.min(90, (t - 46) * 3) : 0, filter: t > 46 ? 'brightness(.8)' : null };
    case 'litter': return { dy: t > 50 ? Math.min(110, (t - 50) * 2.5) : 0, hide: t > 110 };
    case 'freeze': return { filter: t > 20 ? 'hue-rotate(180deg) saturate(.5) brightness(1.4)' : null, dx: t > 90 ? (t - 90) * (t - 90) * 0.06 * -f.face : 0 };
    case 'gas': return { filter: t > 30 ? 'hue-rotate(70deg) saturate(1.6)' : null, dy: t > 80 ? -(t - 80) * 2 : 0, rot: t > 80 ? Math.sin(t / 8) * 0.4 : 0 };
    case 'seal': return { hide: t > 70 };
    case 'stampede': return t < 60 ? {} : { sy: 0.12, dy: 0, rot: 0, alpha: t > 120 ? Math.max(0, 1 - (t - 120) / 60) : 1 };
    case 'golf': return t < 50 ? {} : { scale: Math.max(0.12, 1 - (t - 50) / 30), dy: -Math.sin(Math.min(Math.PI, (t - 50) / 50)) * 160, dx: (t - 50) * 5 * -f.face, rot: t * 0.4 };
  }
  return {};
}
function finisherOverlay(m) {
  const t = m.pt, wi = m.finisher.who, w = m.f[wi], l = m.f[1 - wi], k = m.finisher.kind, x = l.x;
  if (k === 'rug') { const pull = Math.min(1, t / 50); ctx.fillStyle = '#8e1a2a'; const rx = x - 70 - pull * 400 * l.face * 0; ctx.fillRect(x - 70 + (t > 40 ? (t - 40) * 18 * w.face : 0), GY - 4, 140, 8); ctx.fillStyle = '#e3b341'; ctx.fillRect(x - 60 + (t > 40 ? (t - 40) * 18 * w.face : 0), GY - 2, 120, 3); if (t > 60) for (let i = 0; i < 20; i++) { const cx = (i * 37 + t * 3) % 640, cy = ((t - 60) * 4 + i * 23) % 360; ctx.fillStyle = '#ffd25a'; ctx.fillRect(cx, cy, 6, 6); ctx.fillStyle = '#c09a2a'; ctx.fillRect(cx + 2, cy + 2, 2, 2); } }
  if (k === 'moon') { if (t > 30) { ctx.fillStyle = '#ff7a4a'; for (let i = 0; i < 6; i++) ctx.fillRect(x - 6 + Math.random() * 12, GY + Math.pow(Math.max(0, t - 40), 1.8) * -0.4 + i * 8, 6, 8); } ctx.fillStyle = '#f6e7b8'; ctx.beginPath(); ctx.arc(520, 50, 26, 0, 7); ctx.fill(); if (t > 150) text('WOW', 520, 50, 10, '#c8282e', 'center', FONT, null); }
  if (k === 'hat') { const hy = Math.min(GY - 60, -100 + t * 6); ctx.fillStyle = '#f2a0b8'; ctx.fillRect(x - 44, hy - 30, 88, 60); ctx.fillStyle = '#d0708e'; for (let i = 0; i < 6; i++) ctx.fillRect(x - 40 + i * 14, hy - 26, 6, 52); ctx.fillRect(x - 10, hy - 44, 20, 14); if (t > 120) { ctx.translate(0, 0); } }
  if (k === 'bonk') { const a = t < 46 ? -2 + t / 23 : 0; ctx.save(); ctx.translate(x, GY - 220); ctx.rotate(a); ctx.fillStyle = '#8a5a34'; ctx.fillRect(-14, 0, 28, 180); ctx.fillStyle = '#a8743e'; ctx.fillRect(-20, 100, 40, 90); ctx.restore(); if (t > 46 && t < 120) text('BONK!', x, GY - 150, 26, '#ffd25a'); }
  if (k === 'litter') { const s = Math.min(1, t / 30); ctx.fillStyle = '#3fb68a'; ctx.fillRect(x - 70 * s, GY - 30 * s, 140 * s, 34 * s); ctx.fillStyle = '#d8c89a'; ctx.fillRect(x - 64 * s, GY - 26 * s, 128 * s, 8 * s); ctx.fillStyle = '#2a8462'; ctx.fillRect(x - 70 * s, GY - 4, 140 * s, 6); if (t > 110) { for (let i = 0; i < 12; i++) { ctx.fillStyle = '#d8c89a'; ctx.fillRect(x - 50 + ((i * 29 + t) % 100), GY - 30 - Math.abs(Math.sin((t + i * 9) / 7)) * 30, 4, 4); } text('SCOOPED', x, GY - 70, 14, '#3fb68a'); } }
  if (k === 'freeze' && t > 20) { ctx.fillStyle = 'rgba(180,230,255,.5)'; const dx = t > 90 ? (t - 90) * (t - 90) * 0.06 * -l.face : 0; ctx.fillRect(x - 40 + dx, GY - 130, 80, 132); ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 3; ctx.strokeRect(x - 40 + dx, GY - 130, 80, 132); }
  if (k === 'gas') for (let i = 0; i < 14; i++) { const r = Math.min(70, t * 1.2); ctx.fillStyle = `rgba(156,196,106,${0.5})`; ctx.beginPath(); ctx.arc(x + Math.cos(i + t / 20) * r, GY - 60 + Math.sin(i * 2 + t / 15) * r * 0.6 - (t > 80 ? (t - 80) * 2 : 0), 20, 0, 7); ctx.fill(); }
  if (k === 'seal') { const s = Math.min(1, t / 40); ctx.fillStyle = '#f4ead0'; ctx.fillRect(x - 60 * s, GY - 110 * s, 120 * s, 110 * s); ctx.strokeStyle = '#c8b48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 60 * s, GY - 110 * s); ctx.lineTo(x, GY - 50 * s); ctx.lineTo(x + 60 * s, GY - 110 * s); ctx.stroke(); if (t > 70) { ctx.fillStyle = '#c8282e'; ctx.beginPath(); ctx.arc(x, GY - 50, 16, 0, 7); ctx.fill(); text('SEALED', x, GY - 140, 14, '#c8282e'); } if (t > 120) ctx.globalAlpha = 1; }
  if (k === 'stampede' && t > 20 && t < 120) for (let i = 0; i < 6; i++) { const bx = ((t - 20) * 12 - i * 70) * w.face + (w.face > 0 ? -100 : 740); drawSprite(w.ch, 'rush', w.skin, bx, GY - (i % 2) * 6, 1.6, w.face, { alpha: 0.85 }); }
  if (k === 'golf' && t > 40 && t < 100) text('FORE!', 320, 110, 24, '#fff6e0');
  if (t > 150) { text(m.finisher.name.toUpperCase(), 320, 250, 14, '#ffd25a'); }
}

// ---------------- screen renderers ----------------
function drawTitle() {
  ctx.drawImage(stageCanvas('mall'), 0, 0); ctx.fillStyle = 'rgba(6,4,20,.55)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(10,6,24,.92)'; ctx.fillRect(0, 26, W, 146); ctx.fillStyle = '#d4a640'; ctx.fillRect(0, 26, W, 2); ctx.fillRect(0, 170, W, 2);
  const b = Math.sin(G.t / 20) * 3; text('MEME', 320, 70 + b, 44, '#ffd25a'); text('BRAWL', 320, 120 + b, 44, '#ff5a5a'); text('BAG  BRAWLERS  OF  THE  KIBBLE  VERSE', 320, 158, 8, '#fff6e0');
  ROSTER.forEach((c, i) => drawSprite(c, Math.floor(G.t / 24 + i) % 2 ? 'idle' : 'idle2', 'base', 40 + i * 62, 306, 1.4, i < 5 ? 1 : -1));
  if (Math.floor(G.t / 30) % 2) text('PRESS START / TAP', 320, 330, 12, '#fff6e0');
  text('Parody homage. Not affiliated with any token or game.', 320, 352, 6, '#9ab0d4', 'center', SMALL, null);
}
function drawMenu() {
  ctx.drawImage(stageCanvas('moon'), 0, 0); ctx.fillStyle = 'rgba(6,4,20,.6)'; ctx.fillRect(0, 0, W, H); text('MEME BRAWL', 320, 46, 24, '#ffd25a');
  MENU.forEach(([n, fn], i) => { const y = 100 + i * 44, on = i === G.menuI; panel(170, y - 16, 300, 32, on ? '#3a2060' : '#121a36', on ? '#ffd25a' : '#4a4f8c'); text(n, 320, y, 12, on ? '#ffd25a' : '#fff6e0'); btn(170, y - 16, 300, 32, () => { G.menuI = i; fn(); }); });
  drawSprite(byId('inu'), 'win', 'base', 90, 330, 2.2, 1); drawSprite(BOSS, 'idle', 'base', 560, 330, 2.2, -1);
  const p = K.profile(); text(`RANK ${p.rating} ELO  ${K.wallet.address ? 'WALLET ' + K.wallet.address.slice(0, 4) + '..' + K.wallet.address.slice(-4) : 'NO WALLET'}${K.wallet.simulated ? ' (SIM)' : ''}`, 320, 340, 7, '#9ab0d4');
}
function drawSelect() {
  ctx.drawImage(stageCanvas('canyon'), 0, 0); ctx.fillStyle = 'rgba(6,4,20,.7)'; ctx.fillRect(0, 0, W, H);
  text(G.mode === 'versus' ? 'VERSUS: CHOOSE YOUR BAG' : G.mode === 'ranked' ? 'RANKED: CHOOSE YOUR BAG' : 'ARCADE: CHOOSE YOUR BAG', 320, 20, 12, '#ffd25a');
  const tw = 70, th = 62, x0 = 320 - (COLS * (tw + 6)) / 2 + 3, y0 = 38;
  ROSTER.forEach((c, i) => { const x = x0 + (i % COLS) * (tw + 6), y = y0 + Math.floor(i / COLS) * (th + 6); const on0 = G.sel[0] === i, on1 = G.mode === 'versus' && G.sel[1] === i;
    panel(x, y, tw, th, '#1c2046', on0 && on1 ? '#ff5aa8' : on0 ? '#3ec46a' : on1 ? '#3a7ac8' : '#4a4f8c'); portrait(c, x + 2, y + 2, 2.2, 'base');
    ctx.fillStyle = 'rgba(18,10,30,.8)'; ctx.fillRect(x, y + th - 12, tw, 12); text(c.name.split(' ')[0].toUpperCase(), x + tw / 2, y + th - 6, 6, '#fff6e0', 'center', FONT, null);
    if (on0) text('1P', x + 10, y + 8, 7, '#3ec46a'); if (on1) text('2P', x + tw - 10, y + 8, 7, '#3a7ac8');
    btn(x, y, tw, th, () => { if (G.sel[0] === i && G.t > 5) { G.ready[0] = true; sfx('confirm'); } else { G.sel[0] = i; G.skinIdx[0] = 0; } }); });
  const show = (p, x, face) => { const c = ROSTER[G.sel[p]], skin = G.owned[G.skinIdx[p]] || 'base';
    drawSprite(c, G.ready[p] ? 'win' : Math.floor(G.t / 24) % 2 ? 'idle' : 'idle2', skin, x, 330, 2.4, face);
    const tx = face > 0 ? x + 60 : x - 60, al = face > 0 ? 'left' : 'right';
    text(c.name.toUpperCase(), tx, 196, 10, '#ffd25a', al); text(`${c.ticker} (${c.src})`, tx, 212, 6, '#9ab0d4', al, SMALL, null);
    text(c.bio, tx, 226, 7, '#fff6e0', al, SMALL, null);
    const S = c.specials; [[`D,DF,F + P`, S.proj.name], [`B,F + K`, S.rush.name], [`D,D + P`, S.rise.name], [`SUPER D,DF,F + K`, S.super.name]].forEach(([a, n], j) => text(`${a}  ${n}`, tx, 244 + j * 13, 7, j === 3 ? '#ff5aa8' : '#fff6e0', al, SMALL, null));
    text(`SKIN: ${SKINS[skin]}  (HK to cycle; ${G.owned.length} owned)`, tx, 302, 6, '#3fb6a8', al, SMALL, null);
    if (G.ready[p]) text('READY!', x, 180, 12, '#3ec46a'); };
  show(0, 60, 1); if (G.mode === 'versus') show(1, 580, -1);
  else { panel(400, 190, 220, 120, '#121a36', '#4a4f8c'); text(G.mode === 'ranked' ? `YOUR ELO ${K.profile().rating}` : 'LADDER: 6 RIVALS + BOSS', 510, 206, 8, '#ffd25a'); text('Keys: WASD move, F/G punch', 510, 228, 7, '#fff6e0', 'center', SMALL, null); text('V/B kick (or arrows + K L , .)', 510, 242, 7, '#fff6e0', 'center', SMALL, null); text('LP/Enter to lock in', 510, 262, 7, '#fff6e0', 'center', SMALL, null); text(G.holder ? 'HOLDER: alt costumes unlocked' : 'Hold 1000 KIBBLE: alt costumes', 510, 282, 7, '#3fb6a8', 'center', SMALL, null); text('cosmetic only, no stat boosts', 510, 296, 6, '#9ab0d4', 'center', SMALL, null); }
  btn(560, 330, 72, 24, () => go('menu')); text('BACK', 596, 342, 8, '#9ab0d4');
}
function drawVersus() {
  const a = byId(G.p1), b = byId(G.p2), t = G.t, slide = Math.max(0, 1 - t / 30);
  ctx.fillStyle = '#120a1e'; ctx.fillRect(0, 0, W, H); for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#2a1036' : '#1c0a28'; ctx.beginPath(); ctx.moveTo(320, 180); ctx.arc(320, 180, 600, i * Math.PI / 8 + t / 100, (i + 1) * Math.PI / 8 + t / 100); ctx.fill(); }
  ctx.fillStyle = '#c8282e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(300 - slide * 300, 0); ctx.lineTo(260 - slide * 300, 360); ctx.lineTo(0, 360); ctx.fill();
  ctx.fillStyle = '#26335e'; ctx.beginPath(); ctx.moveTo(640, 0); ctx.lineTo(380 + slide * 300, 0); ctx.lineTo(340 + slide * 300, 360); ctx.lineTo(640, 360); ctx.fill();
  drawSprite(a, 'idle', G.skin?.[0] || 'base', 150 - slide * 300, 330, 3.6, 1); drawSprite(b, 'idle', G.mode === 'versus' ? G.skin[1] : 'base', 490 + slide * 300, 330, 3.6, -1);
  text(a.name.toUpperCase(), 140, 40, 14, '#fff6e0'); text(b.name.toUpperCase(), 500, 40, 14, '#fff6e0');
  const s = 1 + Math.max(0, (40 - t) / 20); ctx.save(); ctx.translate(320, 170); ctx.scale(s, s); text('VS', 0, 0, 48, '#ffd25a'); ctx.restore();
  text(STAGES[b.stage], 320, 330, 10, '#fff6e0'); if (G.mode === 'arcade') text(G.ladder[G.li] === BOSS.id ? 'BOSS BATTLE' : `LADDER ${G.li + 1}/${G.ladder.length}`, 320, 230, 10, '#ff5aa8'); if (G.mode === 'ranked') text(`RANKED vs ${G.rankOpp.name} (${G.rankOpp.rating})`, 320, 230, 9, '#3fb6a8');
  if (t > 150 || (t > 40 && (edge(0, 'lp') || held.has('Enter')))) beginMatch();
}
function drawLadder() {
  ctx.drawImage(stageCanvas('rugden'), 0, 0); ctx.fillStyle = 'rgba(6,4,20,.7)'; ctx.fillRect(0, 0, W, H); text('THE LADDER', 320, 24, 16, '#ffd25a');
  G.ladder.forEach((id, i) => { const c = byId(id), y = 300 - i * 40, done = i < G.li, cur = i === G.li; panel(230, y - 16, 180, 32, cur ? '#3a2060' : '#121a36', cur ? '#ffd25a' : done ? '#3ec46a' : '#4a4f8c'); portrait(c, 232, y - 15, 1.15, 'base'); text(c.name.toUpperCase(), 330, y, 7, done ? '#3ec46a' : '#fff6e0'); if (done) text('REKT', 400, y, 6, '#3ec46a', 'right'); });
  drawSprite(byId(G.p1), 'idle', G.skin[0], 120, 320, 2.4, 1); if (Math.floor(G.t / 30) % 2) text('PRESS START / TAP', 520, 320, 9, '#fff6e0'); btn(0, 0, W, H, startFight);
}
function drawEnd(title, sub, col) { ctx.fillStyle = '#120a1e'; ctx.fillRect(0, 0, W, H); text(title, 320, 120, 26, col); sub.forEach((s, i) => text(s, 320, 170 + i * 20, 9, '#fff6e0')); if (Math.floor(G.t / 30) % 2) text('PRESS START / TAP', 320, 320, 10, '#9ab0d4'); btn(0, 0, W, H, () => menuKey('ok')); }
function drawHelp() {
  ctx.fillStyle = '#120a1e'; ctx.fillRect(0, 0, W, H); text('HOW TO PLAY', 320, 22, 14, '#ffd25a');
  const L = ['P1 KEYS: WASD move/jump/crouch   F light punch  G heavy punch   V light kick  B heavy kick', 'P2 KEYS: arrows   K LP   L HP   , LK   . HK     (1P can use either set)', 'HOLD BACK to block. Crouch-block lows; stand-block jump attacks.', 'THROW: forward + HP when close (unblockable)', 'SPECIALS (facing right):  D,DF,F+P projectile   B,F+K rush   D,D+P rising launcher', 'SUPER: fill the BAG METER, then D,DF,F+K', 'JUGGLES: crouch HP and D,D+P launch; keep hitting while they are airborne (4 max)', 'Best of 3 rounds, 99 sec. Win the match, then FINISH THE BAG:', '   D, D + HK within 3 sec for a RUG PULL finisher (cartoon, no gore)', 'TOUCH: D-pad + 4 buttons. Menus: LP = OK, LK = back, HK = cycle skin', 'P = pause, M = mute, Esc = back'];
  L.forEach((s, i) => text(s, 30, 56 + i * 24, 8, '#fff6e0', 'left', SMALL, null)); btn(0, 0, W, H, () => go('menu'));
}
async function shopAct(i) {
  if (i < K.SHOP.length) { const it = K.SHOP[i]; if (!K.wallet.address) { G.msg = 'Connect a wallet first'; return; } const r = await K.wallet.buy({ itemId: it.id, price: it.price }); G.msg = r.ok ? `Bought ${it.name}! sig ${String(r.signature).slice(0, 14)}` : `Failed: ${r.error}`; if (r.ok) sfx('coin'); }
  else if (i === K.SHOP.length) { if (K.wallet.address) await K.wallet.disconnect(); else await K.wallet.connect(); G.msg = K.wallet.address ? 'Connected (simulated wallet, 2,500 test KIBBLE)' : 'Disconnected'; }
  else { const r = await K.wallet.burn(10); G.msg = r.ok ? 'Burned 10 KIBBLE. Respect.' : `Burn failed: ${r.error}`; }
  refreshOwned();
}
function drawShop() {
  ctx.drawImage(stageCanvas('mall'), 0, 0); ctx.fillStyle = 'rgba(6,4,20,.78)'; ctx.fillRect(0, 0, W, H); text('SKIN SHOP', 320, 20, 16, '#ffd25a');
  text(K.wallet.simulated ? 'SIMULATED $KIBBLE: no real tokens move' : 'LIVE kibblePay wallet', 320, 40, 7, '#ff5aa8');
  const items = [...K.SHOP.map((s) => [`${s.name}  ${s.price} KIBBLE${G.owned.includes(s.id) ? '  (OWNED)' : ''}`, s]), [K.wallet.address ? `DISCONNECT ${K.wallet.address.slice(0, 4)}..${K.wallet.address.slice(-4)}` : 'CONNECT WALLET'], ['BURN 10 KIBBLE']];
  items.forEach(([n], i) => { const y = 70 + i * 34, on = G.shopI === i; panel(30, y - 13, 290, 26, on ? '#3a2060' : '#121a36', on ? '#ffd25a' : '#4a4f8c'); text(n, 40, y, 7, '#fff6e0', 'left'); btn(30, y - 13, 290, 26, () => { G.shopI = i; shopAct(i); }); });
  const it = K.SHOP[Math.min(G.shopI, K.SHOP.length - 1)], f = K.computeFees(K.toBase(it.price));
  panel(340, 58, 270, 150, '#121a36'); text(`FEES on ${it.price} KIBBLE (2%)`, 350, 72, 7, '#ffd25a', 'left');
  [['Treasury 1%', f.treasury, 'BzLY..TNGJ'], ['Daily pool 0.25%', f.daily, ''], ['Weekly pool 0.5%', f.weekly, ''], ['Monthly pool 0.25%', f.monthly, '']].forEach(([n, v, a], j) => text(`${n}: ${K.fromBase(v)} ${a}`, 350, 92 + j * 16, 7, '#fff6e0', 'left', SMALL, null));
  text(`Treasury: ${K.TREASURY.slice(0, 22)}`, 350, 160, 6, '#9ab0d4', 'left', SMALL, null); text(`          ${K.TREASURY.slice(22)}`, 350, 172, 6, '#9ab0d4', 'left', SMALL, null);
  const P = K.poolsUi(); text(`Pools: D ${P.daily.toFixed(2)}  W ${P.weekly.toFixed(2)}  M ${P.monthly.toFixed(2)}`, 350, 194, 6, '#3fb6a8', 'left', SMALL, null);
  drawSprite(byId('inu'), 'idle', it.id, 400, 340, 1.6, 1); drawSprite(byId('peepo'), 'idle', it.id, 460, 340, 1.6, 1); drawSprite(byId('moneymew'), 'idle', it.id, 520, 340, 1.6, -1);
  text(`BALANCE: ${G.bal ?? '-'} KIBBLE   HOLDER: ${G.holder ? 'YES (alts unlocked)' : 'no (needs 1000)'}`, 30, 250, 7, '#fff6e0', 'left', SMALL, null);
  // ranked board
  panel(30, 266, 290, 84, '#121a36', '#4a4f8c'); const lb = K.leaderboard(), me = lb.find((e) => e.you), pool = P.weekly;
  text(`RANKED (weekly pool by final rank; no draws, free entry)`, 36, 276, 6, '#ffd25a', 'left', SMALL, null);
  lb.slice(0, 4).concat(me.rank > 4 ? [me] : []).forEach((e, j) => text(`#${e.rank} ${e.name.padEnd(13)} ${e.rating}  prize ${K.prizeFor(e.rank, pool)}`, 36, 290 + j * 12, 6, e.you ? '#3ec46a' : '#fff6e0', 'left', SMALL, null));
  if (G.msg) text(G.msg, 320, 230, 7, '#3ec46a', 'center', SMALL, null); btn(560, 332, 72, 24, () => go('menu')); text('BACK', 596, 344, 8, '#9ab0d4');
}

// ---------------- loop ----------------
function update() {
  readPads(); G.t++; const scr = G.scr;
  if (scr !== 'fight') { updateMenus(scr); return; }
  updateFight();
}
function updateMenus(scr) {
  const G2 = { scr }; if (G2.scr !== G.scr) return;
  if (G.scr === 'menu') { if (edge(0, 'u')) menuKey('up'); if (edge(0, 'd')) menuKey('down'); if (edge(0, 'lp') || edge(0, 'hp')) menuKey('ok'); }
  else if (G.scr === 'shop') { if (edge(0, 'u')) menuKey('up'); if (edge(0, 'd')) menuKey('down'); if (edge(0, 'lp')) menuKey('ok'); }
  else if ((G.scr === 'ladder' || G.scr === 'gameover' || G.scr === 'ending' || G.scr === 'rankres') && G.t > 20 && (edge(0, 'lp') || edge(0, 'hp'))) menuKey('ok');
  else if (G.scr === 'title' && G.t > 10 && (edge(0, 'lp') || edge(0, 'hp'))) menuKey('ok');
  else if (G.scr === 'select') selectStep();
}
function updateFight() {
  if (G.scr === 'fight' && !G.paused) {
    const m = G.match, i0 = pads[0], i1 = G.mode === 'versus' ? pads[1] : cpuInput(m, 1, G.cpuLevel); step(m, [i0, i1]);
    for (const ev of m.events) spawnFx(ev); m.events.length = 0;
    if (m.phase === 'matchEnd' && m.pt === 1) music('win');
    if (m.phase === 'matchEnd' && m.pt > 170) matchOver();
  }
}
function render() {
  regions = []; ctx.save(); if (G.shake > 0) { ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake); G.shake *= 0.85; if (G.shake < 0.5) G.shake = 0; }
  switch (G.scr) {
    case 'title': drawTitle(); break; case 'menu': drawMenu(); break; case 'select': drawSelect(); break; case 'versus': drawVersus(); break; case 'ladder': drawLadder(); break; case 'shop': drawShop(); break; case 'help': drawHelp(); break;
    case 'gameover': drawEnd(G.mode === 'versus' ? `${G.match.f[G.match.matchWinner].ch.name.toUpperCase()} WINS` : 'GOT RUGGED', G.mode === 'versus' ? ['GG. Rematch from the menu.'] : ['The ladder humbled you.', 'Diamond paws. Try again.'], '#ff5a5a'); break;
    case 'ending': drawEnd('LADDER CLEARED', [`${byId(G.p1).name} rugged Lord Rugsworth.`, 'The Kibble Verse is safe. Wen sequel.'], '#ffd25a'); drawSprite(byId(G.p1), Math.floor(G.t / 20) % 2 ? 'win' : 'win2', G.skin[0], 320, 300, 2.4, 1); break;
    case 'rankres': { const r = G.lastRank; drawEnd(r.won ? 'RANKED WIN' : 'RANKED LOSS', [`vs ${r.opp.name}`, `ELO ${r.before} -> ${r.after} (${r.after - r.before >= 0 ? '+' : ''}${r.after - r.before})`, `Current rank #${K.leaderboard().find((e) => e.you).rank}`], r.won ? '#3ec46a' : '#ff5a5a'); break; }
    case 'fight': {
      const m = G.match; ctx.drawImage(stageCanvas(m.stage), 0, 0); stageFx(ctx, m.stage, m.tick);
      if (m.phase === 'finisher' || m.phase === 'finish') { ctx.fillStyle = `rgba(20,0,10,${Math.min(0.5, m.pt / 60)})`; ctx.fillRect(0, 0, W, H); }
      const order = [...m.f].sort((a, b) => (a.st === 'attack' ? 1 : 0) - (b.st === 'attack' ? 1 : 0)); for (const f of order) fighterDraw(f, m);
      for (const p of m.proj) drawProj(p, m.tick); if (m.finisher) finisherOverlay(m); drawFx(); hud(m);
      if (G.paused) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H); text('PAUSED', 320, 150, 24, '#ffd25a'); text('P / pause to resume   Esc / back to quit', 320, 190, 8, '#fff6e0'); btn(0, 0, W, H, () => (G.paused = false)); }
      break; }
  }
  ctx.restore();
}
let acc = 0, last = performance.now();
function frame(now) { acc += Math.min(100, now - last); last = now; let n = 0; while (acc >= 1000 / 60 && n < 5) { update(); acc -= 1000 / 60; n++; } render(); requestAnimationFrame(frame); }
document.fonts?.load(`16px ${FONT}`).finally(() => requestAnimationFrame(frame));
if (!document.fonts) requestAnimationFrame(frame);
const kp = new URLSearchParams(location.search).get('kibble'); if (kp) K.useKibblePay(kp).catch((e) => console.warn('kibblePay unavailable, staying simulated', e));
// fit canvas
function fit() { const vw = innerWidth, vh = innerHeight, s = Math.min(vw / W, vh / H); cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px'; }
addEventListener('resize', fit); fit();
