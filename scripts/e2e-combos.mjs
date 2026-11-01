// Move List + Combo Trainer e2e with REAL input. Desktop keyboard 1280x800 + phone landscape touch 844x390 / 750x342 / 667x375.
// Screenshots -> $OUT (default proof/combos). URL=... to run against a deployment.
import { chromium, devices } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('.'), types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(0);
const URL = process.env.URL || `http://localhost:${srv.address().port}/`, OUT = process.env.OUT || 'proof/combos'; fs.mkdirSync(OUT, { recursive: true });
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const b = await chromium.launch();
const scr = (pg) => pg.evaluate(() => window.__mb.scr);
const tr = (pg) => pg.evaluate(() => { const T = window.__mb.tr; return T && { i: T.i, prog: T.tracker.prog, done: T.tracker.done, clears: T.tracker.clears, dmg: T.tracker.dmg, hits: T.tracker.hits, demo: !!T.demo, n: T.list[T.i].steps.length, name: T.list[T.i].name }; });
const waitScr = (pg, s, ms = 8000) => pg.waitForFunction((s) => window.__mb.scr === s, s, { timeout: ms });
// tap a canvas point given in 640x360 game coordinates
const tapGame = async (pg, x, y) => { const r = await pg.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(); return { l: c.left, t: c.top, s: c.width / 640 }; }); await pg.touchscreen.tap(r.l + x * r.s, r.t + y * r.s); };

// ---------- desktop keyboard ----------
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', (e) => { errs.push(e.message); console.log('PAGEERR', e.message); });
  await pg.goto(URL + '?demo=1'); await pg.waitForTimeout(800);
  await pg.keyboard.press('Enter'); await waitScr(pg, 'menu');
  const idx = 6; // COMBO TRAINER is the last main-menu item
  for (let i = 0; i < idx; i++) { await pg.keyboard.press('KeyS'); await pg.waitForTimeout(60); }
  await pg.keyboard.press('Enter'); await waitScr(pg, 'select'); ok('desktop: menu COMBO TRAINER -> select', (await pg.evaluate(() => window.__mb.mode)) === 'trainer');
  await pg.keyboard.press('KeyI'); await waitScr(pg, 'movelist'); await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/movelist-1280x800.png` }); ok('desktop: I opens the Move List from select', true);
  await pg.keyboard.press('KeyD'); await pg.waitForTimeout(100); const i1 = await pg.evaluate(() => window.__mbUI.ML.i); ok('desktop: D pages to the next fighter', i1 === 1, `i=${i1}`);
  await pg.keyboard.press('KeyA'); await pg.waitForTimeout(100);
  await pg.keyboard.press('KeyT'); await waitScr(pg, 'fight'); await pg.waitForTimeout(300);
  ok('desktop: T starts the Combo Trainer (frozen timer, dummy)', await pg.evaluate(() => { const m = window.__mb.match; return window.__mb.mode === 'trainer' && m.phase === 'fight' && m.f[1].hp >= 9000; }));
  // drill 1 by real keys (Inu: LP > LP > HP); a human-ish rhythm, a couple of tries
  let done = false; for (let k = 0; k < 4 && !done; k++) { await pg.keyboard.press('KeyR'); await pg.waitForTimeout(250);
    const keys = await pg.evaluate(() => window.__mb.tr.list[0].steps.map((s) => s.btn)); const map = { lp: 'KeyF', hp: 'KeyG', lk: 'KeyV', hk: 'KeyB' };
    for (const key of keys) { await pg.keyboard.down(map[key]); await pg.waitForTimeout(40); await pg.keyboard.up(map[key]); await pg.waitForTimeout(110); }
    await pg.waitForTimeout(300); done = (await tr(pg)).clears > 0; }
  const t1 = await tr(pg); ok('desktop: string drill completed with real key presses, steps all checked', done, JSON.stringify(t1));
  await pg.screenshot({ path: `${OUT}/trainer-done-1280x800.png` });
  // pause menu -> move list -> back to the paused fight
  await pg.keyboard.press('KeyP'); await pg.waitForTimeout(150); await pg.screenshot({ path: `${OUT}/pause-menu-1280x800.png` });
  await pg.keyboard.press('KeyI'); await waitScr(pg, 'movelist'); await pg.keyboard.press('Escape'); await waitScr(pg, 'fight');
  ok('desktop: pause -> MOVE LIST -> back returns to the paused fight', await pg.evaluate(() => window.__mb.paused && window.__mb.mode === 'trainer'));
  await pg.keyboard.press('KeyP'); await pg.waitForTimeout(100);
  // every drill completes in SHOW ME (the demo feeds real pad inputs through the same logic)
  const nd = await pg.evaluate(() => window.__mb.tr.list.length); let all = true, info = [];
  for (let d = 0; d < nd; d++) { await pg.keyboard.press(`Digit${d + 1}`); await pg.waitForTimeout(100); await pg.keyboard.press('KeyT');
    try { await pg.waitForFunction(() => window.__mb.tr.tracker.done, null, { timeout: 6000 }); } catch {} const t = await tr(pg); info.push(`${t.name}:${t.done ? t.hits + 'h/' + t.dmg : 'X'}`); all &&= t.done; }
  ok('desktop: SHOW ME completes every drill', all, info.join(' '));
  ok('desktop: no page errors', errs.length === 0, errs.join(' | ')); await ctx.close();
}
// ---------- phone landscape (touch) ----------
for (const [w, h] of [[844, 390], [750, 342], [667, 375]]) {
  const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: w, height: h } }), pg = await ctx.newPage(), errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.goto(URL + '?demo=1'); await pg.waitForTimeout(800);
  await tapGame(pg, 320, 200); await waitScr(pg, 'menu'); await pg.waitForTimeout(150);
  await tapGame(pg, 320, 84 + 6 * 35); await waitScr(pg, 'select'); await pg.waitForTimeout(150);
  await tapGame(pg, 56, 16); await waitScr(pg, 'movelist'); await pg.waitForTimeout(300);
  ok(`${w}x${h}: MOVE LIST button opens the move list, touch pad hidden`, await pg.evaluate(() => getComputedStyle(document.getElementById('touch')).display === 'none'));
  await pg.screenshot({ path: `${OUT}/movelist-${w}x${h}.png` });
  await tapGame(pg, 120, 333); await pg.waitForTimeout(100); ok(`${w}x${h}: NEXT > pages fighter`, (await pg.evaluate(() => window.__mbUI.ML.i)) === 1);
  await tapGame(pg, 484, 333); await waitScr(pg, 'fight'); await pg.waitForTimeout(300);
  const ttl = await pg.evaluate(() => window.__mb.p1); ok(`${w}x${h}: COMBO TRAINER button starts the trainer`, ttl === 'croakley' && (await pg.evaluate(() => window.__mb.mode)) === 'trainer', ttl);
  await pg.evaluate(() => window.__mbUI.trainerPick(4 - window.__mb.tr.i)); await tapGame(pg, 596, 50); // SHOW ME on the long string-into-super drill
  try { await pg.waitForFunction(() => { const t = window.__mb.tr.tracker; return t.prog >= 3 && !t.done; }, null, { timeout: 5000, polling: 'raf' }); } catch {}
  const mid = await tr(pg); await pg.screenshot({ path: `${OUT}/trainer-midcombo-${w}x${h}.png` }); ok(`${w}x${h}: trainer mid-combo shows step progress`, mid.prog >= 3 && !mid.done, JSON.stringify(mid));
  await pg.waitForFunction(() => window.__mb.tr.tracker.done, null, { timeout: 6000 }).catch(() => {}); ok(`${w}x${h}: drill completes`, (await tr(pg)).done);
  // the trainer HUD stays clear of the touch controls and of the pause/mute buttons
  const clear = await pg.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(), s = c.width / 640, R = (x, y, w, h) => ({ l: c.left + x * s, t: c.top + y * s, r: c.left + (x + w) * s, b: c.top + (y + h) * s }), hud = [R(8, 6, 540, 66), R(558, 40, 76, 72), R(8, 82, 66, 144)];
    const ctl = [...document.querySelectorAll('#btns button, #stick, #top button')].map((e) => e.getBoundingClientRect()); const bad = []; hud.forEach((a, i) => ctl.forEach((q, j) => { if (!(a.r <= q.left || a.l >= q.right || a.b <= q.top || a.t >= q.bottom)) bad.push([i, j]); })); return { ok: !bad.length, bad }; });
  ok(`${w}x${h}: trainer panels do not overlap touch or top buttons`, clear.ok, JSON.stringify(clear.bad));
  ok(`${w}x${h}: no page errors`, errs.length === 0, errs.join(' | ')); await ctx.close();
}
await b.close(); srv.close();
fs.writeFileSync(`${OUT}/e2e-combos-results.json`, JSON.stringify(results, null, 2));
process.exit(results.every((r) => r.pass) ? 0 : 1);
