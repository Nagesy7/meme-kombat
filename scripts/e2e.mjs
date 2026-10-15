// Playwright e2e with REAL input (keyboard on desktop, touch on iPhone 13 landscape). Screenshots -> proof/
import { chromium, devices } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('.'), types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(0);
const URL = process.env.URL || `http://localhost:${srv.address().port}/`;
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
fs.mkdirSync('proof', { recursive: true });
const b = await chromium.launch();
const st = (pg) => pg.evaluate(() => { const G = window.__mb, m = G.match; return { scr: G.scr, phase: m?.phase, hp: m?.f.map((f) => f.hp), wins: m?.wins, st: m?.f.map((f) => f.st), meter: m?.f.map((f) => f.meter), proj: m?.proj.length, mv: m?.f[0].move?.name, specials: m?.f[0].specialsUsed }; });
const waitScr = (pg, s, ms = 8000) => pg.waitForFunction((s) => window.__mb.scr === s, s, { timeout: ms });
const waitPhase = (pg, s, ms = 15000) => pg.waitForFunction((s) => window.__mb.match?.phase === s, s, { timeout: ms });

// ---------- desktop ----------
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await pg.goto(URL + '?demo=1'); await pg.waitForTimeout(700); await pg.screenshot({ path: 'proof/01-title.png' });
  await pg.keyboard.press('Enter'); await waitScr(pg, 'menu'); await pg.waitForTimeout(200); await pg.screenshot({ path: 'proof/02-menu.png' });
  await pg.keyboard.press('Enter'); await waitScr(pg, 'select'); await pg.waitForTimeout(300); await pg.screenshot({ path: 'proof/03-select.png' }); ok('desktop: menu -> character select', true);
  await pg.keyboard.press('KeyF'); await waitScr(pg, 'ladder'); await pg.waitForTimeout(300); await pg.screenshot({ path: 'proof/04-ladder.png' });
  await pg.keyboard.press('Enter'); await waitScr(pg, 'versus'); await pg.waitForTimeout(900); await pg.screenshot({ path: 'proof/05-versus.png' });
  await waitScr(pg, 'fight', 6000); await pg.evaluate(() => (window.__mb.cpuLevel = -1)); await waitPhase(pg, 'fight');
  await pg.keyboard.down('KeyD'); await pg.waitForTimeout(1300); await pg.keyboard.up('KeyD');
  const h0 = (await st(pg)).hp[1];
  for (let i = 0; i < 6; i++) { await pg.keyboard.press('KeyF'); await pg.waitForTimeout(140); await pg.keyboard.press('KeyV'); await pg.waitForTimeout(160); }
  await pg.keyboard.press('KeyG'); await pg.waitForTimeout(80); await pg.screenshot({ path: 'proof/06-fight-hit.png' });
  const h1 = (await st(pg)).hp[1]; ok('desktop: real-key punches/kicks damage CPU', h1 < h0, `${h0} -> ${h1}`);
  // special: QCF + P (S, S+D, D, F)
  await pg.keyboard.down('KeyA'); await pg.waitForTimeout(700); await pg.keyboard.up('KeyA'); await pg.waitForTimeout(300);
  await pg.keyboard.down('KeyS'); await pg.waitForTimeout(40); await pg.keyboard.down('KeyD'); await pg.waitForTimeout(40); await pg.keyboard.up('KeyS'); await pg.waitForTimeout(40); await pg.keyboard.press('KeyF'); await pg.keyboard.up('KeyD');
  await pg.waitForTimeout(120); const s1 = await st(pg); await pg.screenshot({ path: 'proof/07-special-projectile.png' }); ok('desktop: QCF+P fires a projectile', s1.proj > 0 || s1.mv === 'proj' || s1.specials > 0, JSON.stringify(s1));
  // jump-in
  await pg.keyboard.down('KeyW'); await pg.keyboard.down('KeyD'); await pg.waitForTimeout(250); await pg.keyboard.up('KeyW'); await pg.keyboard.up('KeyD'); await pg.keyboard.press('KeyB'); await pg.waitForTimeout(150); await pg.screenshot({ path: 'proof/08-jump-kick.png' }); await pg.waitForTimeout(600);
  // crouch
  await pg.keyboard.down('KeyS'); await pg.waitForTimeout(200); await pg.screenshot({ path: 'proof/09-crouch.png' }); await pg.keyboard.press('KeyG'); await pg.waitForTimeout(120); await pg.screenshot({ path: 'proof/10-uppercut-launch.png' }); await pg.keyboard.up('KeyS');
  // finish the rounds fast: lower CPU hp and win with real hits
  for (let r = 0; r < 2; r++) {
    await waitPhase(pg, 'fight', 20000); await pg.evaluate(() => { const m = window.__mb.match; m.f[1].hp = 30; m.f[1].x = m.f[0].x + 50 * m.f[0].face; });
    for (let i = 0; i < 20 && (await st(pg)).phase === 'fight'; i++) { await pg.keyboard.press('KeyF'); await pg.waitForTimeout(150); }
    if (r === 0) { await pg.waitForTimeout(200); await pg.screenshot({ path: 'proof/11-ko.png' }); }
  }
  await waitPhase(pg, 'finish', 8000); await pg.waitForTimeout(400); await pg.screenshot({ path: 'proof/12-punchline-time.png' }); ok('desktop: best-of-3 reaches PUNCHLINE TIME', (await st(pg)).wins[0] === 2);
  await pg.keyboard.press('KeyS'); await pg.waitForTimeout(60); await pg.keyboard.press('KeyS'); await pg.waitForTimeout(40); await pg.keyboard.press('KeyB');
  await waitPhase(pg, 'finisher', 3000).then(() => ok('desktop: down-down+HK triggers the punchline finisher', true)).catch(() => ok('desktop: finisher', false));
  await pg.waitForTimeout(1300); await pg.screenshot({ path: 'proof/13-rug-pull-finisher.png' }); await pg.waitForTimeout(1600); await pg.screenshot({ path: 'proof/14-bag-secured.png' });
  await waitScr(pg, 'ladder', 8000).then(() => ok('desktop: ladder advances after win', true)).catch(() => ok('desktop: ladder advance', false));
  // shop
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(100);
  await pg.evaluate(() => { window.__mb.scr = 'menu'; window.__mb.menuI = 0; }); for (let i = 0; i < 4; i++) { await pg.keyboard.press('KeyS'); await pg.waitForTimeout(50); }
  await pg.keyboard.press('Enter'); await waitScr(pg, 'shop'); for (const k of ['KeyS', 'KeyS']) { await pg.keyboard.press(k); await pg.waitForTimeout(50); } await pg.keyboard.press('Enter'); await pg.waitForTimeout(200);
  for (const k of ['KeyW', 'KeyW']) { await pg.keyboard.press(k); await pg.waitForTimeout(50); } await pg.keyboard.press('Enter'); await pg.waitForTimeout(300); await pg.screenshot({ path: 'proof/15-shop.png' });
  const inv = await pg.evaluate(() => JSON.parse(localStorage.getItem('mb.inv') || '[]')); ok('desktop DEMO (?demo=1): wallet connect + buy skin (fake balance, fee-inclusive ledger)', inv.includes('gold'), JSON.stringify(inv));
  // versus 2P
  await pg.evaluate(() => { const G = window.__mb; G.mode = 'versus'; G.scr = 'select'; G.t = 0; });
  for (const k of ['KeyD', 'ArrowLeft', 'KeyB']) { await pg.keyboard.press(k); await pg.waitForTimeout(50); } await pg.waitForTimeout(150); await pg.screenshot({ path: 'proof/16-select-2p.png' });
  await pg.keyboard.press('KeyF'); await pg.waitForTimeout(50); await pg.keyboard.press('KeyK'); await waitScr(pg, 'fight', 8000); await waitPhase(pg, 'fight');
  await pg.keyboard.down('KeyD'); await pg.keyboard.down('ArrowLeft'); await pg.waitForTimeout(800); await pg.keyboard.up('KeyD'); await pg.keyboard.up('ArrowLeft');
  const v0 = await st(pg); for (let i = 0; i < 5; i++) { await pg.keyboard.press('KeyK'); await pg.waitForTimeout(160); } await pg.screenshot({ path: 'proof/17-versus-2p.png' });
  const v1 = await st(pg); ok('desktop: local 2P, P2 keys (arrows + K) hit P1', v1.hp[0] < v0.hp[0], `${v0.hp[0]} -> ${v1.hp[0]}`);
  ok('desktop: no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
// ---------- real mode (no ?demo): kibble-pay SDK, mint not set -> "launching soon", footer, no fake balance ----------
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(URL); await pg.waitForFunction(() => !!document.getElementById('inu-legal'), null, { timeout: 20000 }).catch(() => {});
  ok('real mode: Terms / Prize Rules footer mounted', await pg.evaluate(() => /Terms.*Prize Rules/.test(document.getElementById('inu-legal')?.textContent || '')));
  await pg.evaluate(() => { window.__mb.scr = 'shop'; window.__mb.shopI = 0; }); await pg.keyboard.press('Enter'); await pg.waitForTimeout(600);
  const msg = await pg.evaluate(() => window.__mb.msg || '');
  ok('real mode: buying shows "KIBBLE launching soon", no purchase', /launching soon/i.test(msg), msg);
  ok('real mode: no fake balance written', await pg.evaluate(() => localStorage.getItem('mb.bal') === null));
  await pg.screenshot({ path: 'proof/40-real-mode-shop-soon.png' });
  ok('real mode: no page errors', errs.length === 0, errs.join(' | ')); await ctx.close();
}
// ---------- new fighter sheet: Moneymew, 4 skins x key poses ----------
{
  const pg = await b.newPage({ viewport: { width: 900, height: 560 } }); await pg.goto(URL); await pg.waitForTimeout(500);
  const n = await pg.evaluate(async () => { const { byId } = await import('./src/roster.js'); const { sprite } = await import('./src/sprites.js'); const c = document.createElement('canvas'); c.width = 900; c.height = 560; c.style.cssText = 'position:fixed;inset:0;z-index:9;background:#2a2040'; document.body.append(c); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#2a2040'; x.fillRect(0, 0, 900, 560);
    const ch = byId('moneymew'); ['base', 'alt', 'gold', 'neon'].forEach((s, i) => ['idle', 'walk1', 'crouch', 'jump', 'hkick', 'special', 'win'].forEach((p, j) => x.drawImage(sprite(ch, p, s), j * 125, i * 138, 132, 124))); return ch.name; });
  await pg.screenshot({ path: 'proof/30-moneymew-skins.png' });
  const gap = await pg.evaluate(async () => { const { stageCanvas } = await import('./src/stages.js'); const out = {}; for (const id of ['mall', 'canyon', 'moon', 'pond', 'rugden']) { const d = stageCanvas(id).getContext('2d').getImageData(0, 0, 640, 360).data; let t = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 255) t++; out[id] = t; } const c = document.querySelector('canvas:last-of-type').getContext('2d'); c.drawImage(stageCanvas('canyon'), 0, 0, 900, 506); return out; });
  await pg.screenshot({ path: 'proof/31-canyon-fixed.png' }); ok('all stages fully opaque (no canyon gap line)', Object.values(gap).every((v) => v === 0), JSON.stringify(gap)); ok('Moneymew renders in 4 skins', n === 'Moneymew'); await pg.close();
}
// ---------- iPhone 13 landscape (touch) ----------
{
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await pg.goto(URL); await pg.waitForTimeout(700); await pg.screenshot({ path: 'proof/20-iphone-title.png' });
  const cdp = await ctx.newCDPSession(pg); const center = async (sel) => { const r = await pg.locator(sel).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, r }; };
  const touchHold = async (pts, ms) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) }); await pg.waitForTimeout(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const lp = await center('[data-k=lp]'), lk = await center('[data-k=lk]'), dp = await center('#dpad');
  await pg.touchscreen.tap(400, 200); await waitScr(pg, 'menu'); await pg.touchscreen.tap(lp.x, lp.y); await waitScr(pg, 'select'); await pg.waitForTimeout(300); await pg.screenshot({ path: 'proof/21-iphone-select.png' });
  await pg.waitForTimeout(300); await pg.touchscreen.tap(lp.x, lp.y); await waitScr(pg, 'ladder'); await pg.waitForTimeout(500); await pg.touchscreen.tap(lp.x, lp.y); await waitScr(pg, 'fight', 8000); await pg.evaluate(() => (window.__mb.cpuLevel = -1)); await waitPhase(pg, 'fight');
  await touchHold([{ x: dp.x + dp.r.width * 0.4, y: dp.y }], 1300);
  const h0 = (await st(pg)).hp[1]; for (let i = 0; i < 6; i++) { await pg.touchscreen.tap(lp.x, lp.y); await pg.waitForTimeout(150); await pg.touchscreen.tap(lk.x, lk.y); await pg.waitForTimeout(150); }
  await pg.screenshot({ path: 'proof/22-iphone-fight.png' }); ok('iPhone13 landscape: meter bars clear of touch buttons', await pg.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(), y = c.top + 72 * c.height / 360; return [...document.querySelectorAll('#btns button,#dpad')].every((e) => e.getBoundingClientRect().top > y); })); const h1 = (await st(pg)).hp[1]; ok('iPhone13 landscape: touch D-pad + buttons damage CPU', h1 < h0, `${h0} -> ${h1}`);
  const sc = await pg.evaluate(() => ({ sx: scrollX, sy: scrollY, sel: String(getSelection()), w: document.documentElement.scrollWidth, iw: innerWidth })); ok('iPhone13: no scroll / selection', sc.sx === 0 && sc.sy === 0 && sc.sel === '' && sc.w <= sc.iw, JSON.stringify(sc));
  ok('iPhone13: no page errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
  const c2 = await b.newContext({ ...devices['iPhone 13'] }), p2 = await c2.newPage(); await p2.goto(URL); await p2.waitForTimeout(700); await p2.screenshot({ path: 'proof/23-iphone-portrait.png' }); await c2.close();
}
await b.close(); srv.close();
fs.writeFileSync('proof/e2e-results.json', JSON.stringify(results, null, 2));
process.exit(results.every((r) => r.pass) ? 0 : 1);
