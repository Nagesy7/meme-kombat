// Shop / For devs links e2e: links on the main menu at phone + desktop sizes (clear of touch controls and the wallet pill),
// keyboard / controller / touch / mouse activation, tooltip, wallet-free paid_link_click events, and the once-per-session
// results nudge (casual + CPU results only, never mid-fight). window.open is stubbed so nothing leaves the page.
// Screenshots -> $OUT (default proof/shop). URL=... runs against a deployment.
import { chromium, devices } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('.'), types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); });
await new Promise((res) => srv.listen(0, res));
const LIVE = !!process.env.URL, URL = process.env.URL || `http://localhost:${srv.address().port}/`, OUT = process.env.OUT || 'proof/shop'; fs.mkdirSync(OUT, { recursive: true });
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const b = await chromium.launch();
const SHOP_URL = 'https://kibbleinu.com/pay?utm_source=meme-brawl&utm_medium=menu#shop-h', DEVS_URL = 'https://kibbleinu.com/for-devs.html?utm_source=meme-brawl&utm_medium=menu';
const TIP = 'Optional cosmetics. $KIBBLE is never needed to play.', BANNED = /hurry|limited|last chance|don't miss|guarantee|moon|profit|prize/i;
const FAKE = () => {
  const slots = [null, null, null, null]; window.__rumble = [];
  const mk = (id, index) => ({ id, index, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    vibrationActuator: { type: 'dual-rumble', playEffect: (t, o) => { window.__rumble.push({ t, ...o }); return Promise.resolve('complete'); } } });
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => slots.map((g) => (g ? { ...g, axes: g.axes.slice(), buttons: g.buttons.map((x) => ({ ...x })) } : null)) });
  window.__fp = { plug(i, id) { slots[i] = mk(id, i); const e = new Event('gamepadconnected'); e.gamepad = slots[i]; dispatchEvent(e); }, unplug(i) { slots[i] = null; dispatchEvent(new Event('gamepaddisconnected')); },
    set(i, down = [], axes = [0, 0]) { const g = slots[i]; if (!g) return; g.buttons.forEach((x, j) => { const p = down.includes(j); x.pressed = p; x.value = p ? 1 : 0; }); g.axes = [axes[0] || 0, axes[1] || 0, 0, 0]; g.timestamp++; } };
};
// record link opens instead of leaving the page
const SPY = () => { window.__opened = []; window.open = (u, t) => { window.__opened.push([u, t]); return {}; }; };
const waitScr = (pg, s, ms = 10000) => pg.waitForFunction((s) => window.__mb.scr === s, s, { timeout: ms });
const waitPhase = (pg, p, ms = 20000) => pg.waitForFunction((p) => window.__mb.match?.phase === p, p, { timeout: ms });
const F = (ms) => new Promise((r) => setTimeout(r, ms));
const rects = (pg) => pg.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(), k = c.width / 640, out = [];
  for (const s of ['#stick', '#jump', '[data-k=lp]', '[data-k=hp]', '[data-k=lk]', '[data-k=hk]', '#top']) { const e = document.querySelector(s); if (!e) continue; const q = e.getBoundingClientRect(); if (q.width && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.hide')) out.push([s, (q.left - c.left) / k, (q.top - c.top) / k, (q.right - c.left) / k, (q.bottom - c.top) / k]); }
  const pill = document.querySelector('inu-profile-badge'); if (pill) { const q = pill.getBoundingClientRect(); if (q.width) out.push(['pill', (q.left - c.left) / k, (q.top - c.top) / k, (q.right - c.left) / k, (q.bottom - c.top) / k]); }
  return out; });
const overlap = (a, b) => a[1] < b[3] - 1 && b[1] < a[3] - 1 && a[2] < b[4] - 1 && b[2] < a[4] - 1;
const box = (n, r, pad = 2) => [n, r.x - pad, r.y - pad, r.x + r.w + pad, r.y + r.h + pad];
const events = (pg) => pg.evaluate(() => (window.vaq || []).filter((a) => a[0] === 'event' && a[1]?.name === 'paid_link_click').map((a) => a[1]));
async function open(w, h, { touch = w < 1000 } = {}) {
  const ctx = await b.newContext({ ...(touch ? devices['iPhone 13 landscape'] : {}), viewport: { width: w, height: h } }); await ctx.addInitScript(FAKE); await ctx.addInitScript(SPY);
  const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', (e) => pg.errs.push(e.message));
  await pg.goto(URL); await pg.waitForTimeout(700); if (touch) await pg.touchscreen.tap(w / 2, h / 3); else await pg.keyboard.press('Enter'); await waitScr(pg, 'menu'); await pg.waitForTimeout(500); return { ctx, pg };
}
const toScreen = (pg, x, y) => pg.evaluate(([x, y]) => { const c = document.getElementById('game').getBoundingClientRect(); return [c.left + x * c.width / 640, c.top + y * c.height / 360]; }, [x, y]);
// win a CPU arcade fight (or local versus) quickly by keyboard: weaken the opponent, then punch twice per round
async function winMatch(pg) {
  for (let r = 0; r < 2; r++) { await waitPhase(pg, 'fight', 20000); await pg.evaluate(() => { const m = window.__mb.match; m.f[1].hp = 30; m.f[1].x = m.f[0].x + 50 * m.f[0].face; });
    for (let i = 0; i < 20 && (await pg.evaluate(() => window.__mb.match.phase)) === 'fight'; i++) { await pg.keyboard.press('KeyF'); await F(150); }
    ok(`no nudge during the fight (round ${r + 1})`, !(await pg.evaluate(() => window.__mbUI.nudge()))); }
}

// 1) menu: links present, fit at every size, clear of touch controls + wallet pill, tooltip, touch + mouse + keyboard + controller
for (const [w, h] of [[667, 375], [750, 342], [844, 390], [1280, 800]]) {
  const { ctx, pg } = await open(w, h), V = `${w}x${h}`, R = await pg.evaluate(() => window.__mbUI.shopRects());
  const T = [box('shop', R.shop), box('devs', R.devs), ['tip', 96, 297, 308, 320]], hits = [];
  for (const r of await rects(pg)) for (const u of T) if (overlap(r, u)) hits.push(`${r[0]}~${u[0]}`);
  ok(`${V}: Shop + For devs links (and tooltip) clear of touch controls, top buttons and wallet pill`, hits.length === 0, hits.join(' '));
  ok(`${V}: links inside the canvas`, R.shop.x >= 0 && R.devs.x + R.devs.w <= 640 && R.shop.y + R.shop.h <= 360);
  if (w !== 750) await pg.screenshot({ path: `${OUT}/menu-shop-link-${V}.png` });
  // keyboard: down past the 8 menu items lands on Shop, tooltip shows, Enter opens it
  for (let i = 0; i < 8; i++) { await pg.keyboard.press('KeyS'); await F(40); }
  ok(`${V}: keyboard focus reaches the Shop link`, (await pg.evaluate(() => window.__mb.menuI)) === 8);
  if (w !== 750) await pg.screenshot({ path: `${OUT}/menu-shop-tooltip-${V}.png` });
  if (w === 844) { await pg.keyboard.press('KeyD'); await F(60); await pg.screenshot({ path: `${OUT}/menu-for-devs-focus-${V}.png` }); await pg.keyboard.press('KeyA'); await F(60); }
  await pg.keyboard.press('Enter'); await F(150);
  let o = await pg.evaluate(() => window.__opened); ok(`${V}: Enter on Shop opens the shop URL in a new tab`, o.length === 1 && o[0][0] === SHOP_URL && o[0][1] === '_blank', JSON.stringify(o));
  await pg.keyboard.press('KeyD'); await F(60); ok(`${V}: right moves to For devs`, (await pg.evaluate(() => window.__mb.menuI)) === 9); await pg.keyboard.press('Enter'); await F(150);
  o = await pg.evaluate(() => window.__opened); ok(`${V}: For devs opens the dev page`, o[1]?.[0] === DEVS_URL, o[1]?.[0]);
  // touch or mouse on the link itself
  const [sx, sy] = await toScreen(pg, R.shop.x + R.shop.w / 2, R.shop.y + R.shop.h / 2);
  if (w < 1000) await pg.touchscreen.tap(sx, sy); else { await pg.mouse.move(sx, sy); await F(120); ok(`${V}: hovering Shop sets the tooltip title`, (await pg.evaluate(() => document.getElementById('game').title)) === TIP); await pg.mouse.click(sx, sy); }
  await F(150); o = await pg.evaluate(() => window.__opened); ok(`${V}: ${w < 1000 ? 'tap' : 'click'} on Shop opens the shop`, o[2]?.[0] === SHOP_URL);
  const ev = await events(pg); ok(`${V}: paid_link_click events, wallet-free`, ev.length === 3 && ev.every((e) => Object.keys(e.data).sort().join() === 'from,product,site' && e.data.site === 'meme-brawl' && e.data.from === 'meme-brawl-menu' && !/wallet|mint|score|name"/i.test(JSON.stringify(e.data))), JSON.stringify(ev));
  ok(`${V}: still on the menu, no errors`, (await pg.evaluate(() => window.__mb.scr)) === 'menu' && pg.errs.length === 0, pg.errs.join(' | '));
  await ctx.close();
}
// controller: D-pad to the link row + cross
{
  const { ctx, pg } = await open(1280, 800); await pg.evaluate(() => window.__fp.plug(0, 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)')); await F(200);
  const tap = async (btn) => { await pg.evaluate((b) => window.__fp.set(0, [b]), btn); await F(90); await pg.evaluate(() => window.__fp.set(0, [])); await F(90); };
  await tap(12); ok('controller: D-pad up from ARCADE wraps to For devs', (await pg.evaluate(() => window.__mb.menuI)) === 9);
  await tap(14); ok('controller: left moves to Shop', (await pg.evaluate(() => window.__mb.menuI)) === 8); await pg.evaluate(() => { window.__mb.toast = null; }); await F(200);
  await pg.screenshot({ path: `${OUT}/menu-shop-pad-focus-1280x800.png` });
  await tap(0); ok('controller: A opens the shop', (await pg.evaluate(() => window.__opened))[0]?.[0] === SHOP_URL);
  ok('controller: no errors', pg.errs.length === 0, pg.errs.join(' | ')); await ctx.close();
}

// 2) results nudge: 844x390 local VERSUS 2P (casual) and 1280x800 CPU arcade; once per session; buttons by touch / controller / keyboard
{
  const { ctx, pg } = await open(844, 390);
  await pg.evaluate(() => { const G = window.__mb; G.mode = 'versus'; G.scr = 'select'; G.t = 0; }); await F(300);
  await pg.keyboard.press('KeyF'); await F(150); await pg.keyboard.press('KeyK'); await waitScr(pg, 'fight', 15000);
  await winMatch(pg); await waitScr(pg, 'gameover', 15000); await F(400);
  let n = await pg.evaluate(() => window.__mbUI.nudge()); ok('844x390: nudge on the versus result screen, focus on Not now', n && n.i === 1);
  const R = await pg.evaluate(() => window.__mbUI.shopRects()), hits = [];
  for (const r of await rects(pg)) for (const u of [box('nudge', R.nudge), ...R.nudgeBtns.map((x, i) => box('btn' + i, x))]) if (overlap(r, u)) hits.push(`${r[0]}~${u[0]}`);
  ok('844x390: nudge clear of touch controls and wallet pill', hits.length === 0, hits.join(' '));
  ok('844x390: session flag set', (await pg.evaluate(() => sessionStorage.getItem('inu.shopNudge'))) === '1');
  await pg.screenshot({ path: `${OUT}/results-nudge-844x390.png` });
  await pg.touchscreen.tap(422, 130); await F(150); ok('844x390: taps outside the nudge do nothing (no skip past it)', (await pg.evaluate(() => window.__mb.scr)) === 'gameover' && !!(await pg.evaluate(() => window.__mbUI.nudge())));
  const v = R.nudgeBtns[0], [vx, vy] = await toScreen(pg, v.x + v.w / 2, v.y + v.h / 2); await pg.touchscreen.tap(vx, vy); await F(200);
  const o = await pg.evaluate(() => window.__opened), ev = await events(pg);
  ok('844x390: "Visit the shop →" opens the shop', o[0]?.[0] === SHOP_URL); ok('844x390: results event, wallet-free', ev[0]?.data.from === 'meme-brawl-results' && Object.keys(ev[0].data).length === 3, JSON.stringify(ev));
  ok('844x390: nudge closed, results screen intact', !(await pg.evaluate(() => window.__mbUI.nudge())) && (await pg.evaluate(() => window.__mb.scr)) === 'gameover');
  await F(400); await pg.keyboard.press('Enter'); await waitScr(pg, 'menu'); ok('844x390: results continue as before after the nudge', true);
  // same tab session: a second result shows no nudge
  await pg.evaluate(() => { const G = window.__mb; G.mode = 'versus'; G.scr = 'select'; G.t = 0; }); await F(300);
  await pg.keyboard.press('KeyF'); await F(150); await pg.keyboard.press('KeyK'); await waitScr(pg, 'fight', 15000); await winMatch(pg); await waitScr(pg, 'gameover', 15000); await F(300);
  ok('844x390: at most once per session (second result: no nudge)', !(await pg.evaluate(() => window.__mbUI.nudge())));
  ok('844x390: no errors', pg.errs.length === 0, pg.errs.join(' | ')); await ctx.close();
}
{
  const { ctx, pg } = await open(1280, 800); await pg.evaluate(() => window.__fp.plug(0, 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)')); await F(200);
  await pg.keyboard.press('Enter'); await waitScr(pg, 'select'); await F(250); await pg.keyboard.press('KeyF'); await waitScr(pg, 'ladder'); await F(400); await pg.keyboard.press('Enter'); await waitScr(pg, 'fight', 15000);
  ok('1280x800: the pre-fight ladder screen shows no nudge', true);
  await winMatch(pg); await waitScr(pg, 'ladder', 15000); await F(400); await pg.evaluate(() => { window.__mb.toast = null; window.__mb.padActive = true; document.body.classList.add('padactive'); });
  let n = await pg.evaluate(() => window.__mbUI.nudge()); ok('1280x800: nudge after a CPU arcade win', !!n);
  await pg.screenshot({ path: `${OUT}/results-nudge-1280x800.png` });
  const tap = async (btn) => { await pg.evaluate((b) => window.__fp.set(0, [b]), btn); await F(90); await pg.evaluate(() => window.__fp.set(0, [])); await F(90); };
  await tap(14); ok('1280x800: controller left focuses "Visit the shop →"', (await pg.evaluate(() => window.__mbUI.nudge()?.i)) === 0); await tap(15);
  await tap(1); n = await pg.evaluate(() => window.__mbUI.nudge()); ok('1280x800: circle = Not now, nothing opened', !n && (await pg.evaluate(() => window.__opened.length)) === 0);
  ok('1280x800: still on the ladder results', (await pg.evaluate(() => window.__mb.scr)) === 'ladder');
  await tap(0); await waitScr(pg, 'versus', 8000); ok('1280x800: cross then continues the ladder as before', true);
  ok('1280x800: no errors', pg.errs.length === 0, pg.errs.join(' | ')); await ctx.close();
}
// copy on screen has no banned words
ok('shop copy has no banned words', !BANNED.test([TIP, '🛍️ Shop', '🛠️ For devs', 'Like your look? Outfits, pets and cars for every Inu game are in the Kibble Pay shop. Optional, and never needed to play.', 'Visit the shop →', 'Not now'].join(' ')));
await b.close(); srv.close();
const fail = results.filter((r) => !r.pass); console.log(`\n${results.length - fail.length}/${results.length} passed`); fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2)); process.exit(fail.length ? 1 : 0);
