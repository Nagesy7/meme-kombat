// Multi-touch e2e for the stick + jump layout: two simultaneous touch pointers (CDP Input.dispatchTouchEvent -> real
// pointer events with distinct pointerIds) at 667x375, 750x342 and 844x390. Stick held right + JUMP = diagonal jump;
// releasing either pointer leaves the other intact; pointercancel clears; sliding off the stick keeps the direction;
// the pad fed to the game is byte-identical (netcode encode) to the keyboard's. URL=<base> to test a deployment.
// SHOTS=<dir> also saves layout screenshots + GIF frames.
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { encode } from '../src/netcode.js';
const root = path.resolve('.'), types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(0);
const URL = process.env.URL || `http://localhost:${srv.address().port}/`, SHOTS = process.env.SHOTS, TAG = process.env.TAG || 'stick';
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const b = await chromium.launch(); const sizes = (process.env.SIZES || '667x375,750x342,844x390').split(',').map((s) => s.split('x').map(Number));
for (const [w, h] of sizes) {
  const V = `${w}x${h}`, ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...(process.env.STATE ? { storageState: process.env.STATE } : {}) }), pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(URL); await pg.waitForTimeout(900);
  const box = async (s) => pg.locator(s).boundingBox(), C = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  const S = await box('#stick'), J = await box('#jump'), lp = C(await box('[data-k=lp]')), cv = await box('canvas');
  console.log(`${V}: stick ${S.width}px at (${Math.round(S.x)},${Math.round(S.y)}), jump ${J.width}px at (${Math.round(J.x)},${Math.round(J.y)}), canvas ${Math.round(cv.width)}x${Math.round(cv.height)}`);
  ok(`${V}: jump button >= 72px`, J.width >= 72 && J.height >= 72, `${J.width}px`);
  ok(`${V}: stick is compact (<= 28% of the short side) and inside the bottom-left corner`, S.width <= h * 0.28 + 1 && S.x < w * 0.1 && S.y + S.height <= h, `${S.width}px`);
  ok(`${V}: stick stays below the HUD (meter bars)`, S.y > cv.y + (72 * cv.height) / 360);
  // into a fight vs a training dummy via real taps
  const tap = async (p) => pg.touchscreen.tap(p.x, p.y), wait = (f, a) => pg.waitForFunction(f, a, { timeout: 15000 });
  await pg.touchscreen.tap(w / 2, h / 3); await wait(() => window.__mb.scr === 'menu'); await tap(lp); await wait(() => window.__mb.scr === 'select'); await pg.waitForTimeout(300);
  await tap(lp); await wait(() => window.__mb.scr === 'ladder'); await pg.waitForTimeout(500); await tap(lp); await wait(() => window.__mb.scr === 'fight');
  await pg.evaluate(() => (window.__mb.cpuLevel = -1)); await wait(() => window.__mb.match.phase === 'fight');
  await pg.evaluate(() => { const m = window.__mb.match; m.f[0].x = 120; m.f[1].x = 560; });
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${TAG}-${V}.png` });
  const cdp = await ctx.newCDPSession(pg), pts = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y, radiusX: 8, radiusY: 8, force: 1 })) });
  // lift ONE finger: CDP's touchEnd lists the point(s) being released (verified: the other pointer gets no pointerup)
  const end = async (id) => { const p = pts.get(id); pts.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ id, x: p.x, y: p.y }] }); };
  const st = () => pg.evaluate(() => { const f = window.__mb.match.f[0]; return { x: f.x, y: f.y, vx: f.vx, st: f.st, pad: window.__mbPad() }; });
  const sc = C(S); pts.set(1, { x: sc.x, y: sc.y }); await send('touchStart');
  pts.set(1, { x: sc.x + S.width * 0.45, y: sc.y }); await send('touchMove'); await pg.waitForTimeout(350);
  const a0 = await st(); await pg.waitForTimeout(200); const a1 = await st();
  ok(`${V}: stick right alone walks forward on the ground`, a1.x > a0.x && a1.y === 0 && JSON.stringify(a1.pad) === '{"r":1}', JSON.stringify(a1.pad));
  // second pointer: JUMP while the stick stays held -> diagonal jump
  const jc = C(J); pts.set(2, { x: jc.x, y: jc.y }); await send('touchStart');
  const samples = []; for (let i = 0; i < 14; i++) { samples.push(await st()); if (SHOTS && w === 844) await pg.screenshot({ path: `${SHOTS}/frames/${String(i).padStart(3, '0')}.png` }); else await pg.waitForTimeout(25); }
  const air = samples.filter((s) => s.y > 0), pad2 = samples[1].pad;
  ok(`${V}: stick + jump pads merge to {u,r} == keyboard W+D (same netcode bits)`, JSON.stringify(pad2) === JSON.stringify({ u: 1, r: 1 }) && encode(pad2) === encode({ r: 1, u: 1 }), JSON.stringify(pad2));
  ok(`${V}: fighter jumps AND moves horizontally at the same time (diagonal jump)`, air.length >= 2 && air.at(-1).x > air[0].x && air.some((s) => s.vx > 0), `air samples ${air.length}, x ${air[0]?.x?.toFixed(1)} -> ${air.at(-1)?.x?.toFixed(1)}, max y ${Math.max(...samples.map((s) => s.y)).toFixed(1)}`);
  // release ONLY the jump pointer: the stick must keep walking
  await end(2); await pg.waitForTimeout(80); const r1 = await st();
  ok(`${V}: releasing jump keeps the stick held`, JSON.stringify(r1.pad) === '{"r":1}', JSON.stringify(r1.pad));
  await pg.waitForFunction(() => window.__mb.match.f[0].y === 0, null, { timeout: 4000 }); await pg.waitForTimeout(150); const r2 = await st(); await pg.waitForTimeout(250); const r3 = await st();
  ok(`${V}: after landing the fighter keeps walking with the stick still held`, r3.x > r2.x && r3.y === 0, `${r2.x.toFixed(1)} -> ${r3.x.toFixed(1)}`);
  // finger slides far off the stick (into the arena): direction is kept, not dropped
  pts.set(1, { x: w * 0.6, y: sc.y - 10 }); await send('touchMove'); await pg.waitForTimeout(60);
  ok(`${V}: sliding off the stick keeps movement`, (await st()).pad.r === 1, JSON.stringify((await st()).pad));
  // the other way round: hold jump, release the stick -> jump stays held
  pts.set(2, { x: jc.x, y: jc.y }); await send('touchStart'); await end(1); await pg.waitForTimeout(60);
  ok(`${V}: releasing the stick keeps jump held`, JSON.stringify((await st()).pad) === '{"u":1}', JSON.stringify((await st()).pad));
  // pointercancel (e.g. OS gesture) clears everything
  pts.set(1, { x: sc.x + S.width * 0.45, y: sc.y }); await send('touchStart'); await pg.waitForTimeout(40);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); pts.clear(); await pg.waitForTimeout(60);
  ok(`${V}: touchcancel/pointercancel releases every control`, JSON.stringify((await st()).pad) === '{}', JSON.stringify((await st()).pad));
  const v = await pg.evaluate(() => ({ sx: scrollX, sy: scrollY, scale: visualViewport.scale }));
  ok(`${V}: no scroll or zoom`, v.sx === 0 && v.sy === 0 && v.scale === 1, JSON.stringify(v));
  ok(`${V}: no page errors`, !errs.length, errs.join(' | '));
  await ctx.close();
}
await b.close(); srv.close();
const pass = results.filter((r) => r.pass).length; console.log(`\n${pass}/${results.length} passed`);
fs.mkdirSync('proof', { recursive: true }); fs.writeFileSync('proof/e2e-stick-results.json', JSON.stringify(results, null, 1));
process.exit(pass === results.length ? 0 : 1);
