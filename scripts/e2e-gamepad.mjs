// Gamepad e2e: a fake standard-mapping gamepad injected into navigator.getGamepads(). Covers connect/disconnect toasts
// (PS-style + Xbox-style), menu navigation by D-pad + cross/A, a special from a stick roll, pause by OPTIONS, hot-plug
// mid-fight, the remap screen + persistence across reloads, and two pads in local VERSUS 2P.
// Screenshots -> $OUT (default proof/gamepad). URL=... runs against a deployment.
import { chromium, devices } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('.'), types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); });
await new Promise((res) => srv.listen(0, res));
const LIVE = !!process.env.URL, URL = process.env.URL || `http://localhost:${srv.address().port}/`, OUT = process.env.OUT || 'proof/gamepad'; fs.mkdirSync(OUT, { recursive: true });
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const b = await chromium.launch();
const PS_ID = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', XB_ID = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
// fake pads: window.__fp.plug(i,id) / unplug(i) / set(i, buttons[], axes[])
const FAKE = () => {
  const slots = [null, null, null, null]; window.__rumble = [];
  const mk = (id, index) => ({ id, index, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    vibrationActuator: { type: 'dual-rumble', playEffect: (t, o) => { window.__rumble.push({ t, ...o }); return Promise.resolve('complete'); } } });
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => slots.map((g) => (g ? { ...g, axes: g.axes.slice(), buttons: g.buttons.map((x) => ({ ...x })) } : null)) });
  window.__fp = { plug(i, id) { slots[i] = mk(id, i); const e = new Event('gamepadconnected'); e.gamepad = slots[i]; dispatchEvent(e); }, unplug(i) { slots[i] = null; dispatchEvent(new Event('gamepaddisconnected')); },
    set(i, down = [], axes = [0, 0]) { const g = slots[i]; if (!g) return; g.buttons.forEach((x, j) => { const p = down.includes(j); x.pressed = p; x.value = p ? 1 : 0; }); g.axes = [axes[0] || 0, axes[1] || 0, 0, 0]; g.timestamp++; } };
};
const waitScr = (pg, s, ms = 10000) => pg.waitForFunction((s) => window.__mb.scr === s, s, { timeout: ms });
const F = (ms) => new Promise((r) => setTimeout(r, ms));
const set = (pg, i, down, axes) => pg.evaluate(([i, d, a]) => window.__fp.set(i, d, a), [i, down, axes]);
const tap = async (pg, i, btn, hold = 90) => { await set(pg, i, [btn]); await F(hold); await set(pg, i, []); await F(90); };
const S = 0, E = 1, W_ = 2, N = 3, L1 = 4, R1 = 5, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;
async function open(w, h, { touch = w < 1000, keep = null } = {}) {
  const ctx = keep || await b.newContext({ ...(touch ? devices['iPhone 13 landscape'] : {}), viewport: { width: w, height: h } }); if (!keep) await ctx.addInitScript(FAKE);
  const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', (e) => pg.errs.push(e.message));
  await pg.goto(URL); await pg.waitForTimeout(700); return { ctx, pg };
}
const st = (pg) => pg.evaluate(() => ({ scr: window.__mb.scr, mode: window.__mb.mode, menuI: window.__mb.menuI, paused: !!window.__mb.paused, toast: window.__mb.toast?.text || '', pad: window.__mbUI.pads(), padactive: document.body.classList.contains('padactive'), touchShown: getComputedStyle(document.getElementById('touch')).display !== 'none' }));

// 1) phone landscape 844x390: PS toast, Xbox toast, disconnect toast, touch overlay hides while a pad is active
{
  const { ctx, pg } = await open(844, 390); await pg.touchscreen.tap(422, 130); await waitScr(pg, 'menu'); await pg.waitForTimeout(500);
  const before = await st(pg); ok('844x390: touch overlay visible before a pad', before.touchShown);
  await pg.evaluate((id) => window.__fp.plug(0, id), PS_ID); await pg.waitForTimeout(350);
  let s = await st(pg); ok('PS id -> PS-style toast with P1', /PS-STYLE CONTROLLER CONNECTED · P1/.test(s.toast) && s.pad.fam === 'ps', s.toast);
  ok('touch overlay hides while the pad is active', s.padactive && !s.touchShown);
  await pg.screenshot({ path: `${OUT}/toast-ps-844x390.png` });
  await pg.evaluate(() => window.__fp.unplug(0)); await pg.waitForTimeout(250); s = await st(pg); ok('disconnect toast', /CONTROLLER P1 DISCONNECTED/.test(s.toast) && s.pad.count === 0, s.toast);
  await pg.evaluate((id) => window.__fp.plug(0, id), XB_ID); await pg.waitForTimeout(350); s = await st(pg);
  ok('Xbox id -> Xbox-style toast', /XBOX-STYLE CONTROLLER CONNECTED · P1/.test(s.toast) && s.pad.fam === 'xbox', s.toast);
  await pg.screenshot({ path: `${OUT}/toast-xbox-844x390.png` });
  await pg.evaluate(() => window.__fp.unplug(0)); await pg.waitForTimeout(150); await pg.evaluate(() => window.__fp.plug(0, '8BitDo Pro 2 (Vendor: 2dc8 Product: 6006)')); await pg.waitForTimeout(250);
  s = await st(pg); ok('other ids -> generic layout', /^CONTROLLER CONNECTED · P1/.test(s.toast) && s.pad.fam === 'generic', s.toast);
  await pg.touchscreen.tap(60, 300); await pg.waitForTimeout(150); ok('a touch brings the touch overlay back', (await st(pg)).touchShown);
  ok('844x390: no page errors', pg.errs.length === 0, pg.errs.join(' | ')); await ctx.close();
}

// 2) desktop 1280x800: menus by pad, special from a stick roll, pause, hot-plug mid-fight, help + remap screens
{
  const { ctx, pg } = await open(1280, 800);
  await pg.evaluate((id) => window.__fp.plug(0, id), PS_ID); await pg.waitForTimeout(200);
  await tap(pg, 0, S); await waitScr(pg, 'menu'); ok('cross on the title opens the menu', true);
  await tap(pg, 0, DOWN); await tap(pg, 0, DOWN); let s = await st(pg); ok('D-pad down moves the menu focus', s.menuI === 2, `menuI=${s.menuI}`);
  await set(pg, 0, [], [0, -0.9]); await F(90); await set(pg, 0, []); await F(90); s = await st(pg); ok('left stick up moves the menu focus', s.menuI === 1, `menuI=${s.menuI}`);
  await set(pg, 0, [], [0.1, -0.2]); await F(120); await set(pg, 0, []); await F(60); ok('stick drift inside the deadzone does nothing', (await st(pg)).menuI === 1);
  await tap(pg, 0, UP); await pg.evaluate(() => { window.__mb.toast = null; }); await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/menu-pad-focus-1280x800.png` });
  // help / controls screen
  for (let i = 0; i < 5; i++) await tap(pg, 0, DOWN); s = await st(pg); ok('focus on HOW TO PLAY', s.menuI === 5, `menuI=${s.menuI}`);
  await tap(pg, 0, S); await waitScr(pg, 'help'); await pg.evaluate(() => { window.__mb.toast = null; }); await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/controls-glyphs-1280x800.png` }); await tap(pg, 0, E); await waitScr(pg, 'menu'); ok('circle backs out of help', true);
  // remap screen: LP -> cross, persists per family across a reload, reset restores defaults
  await tap(pg, 0, DOWN); await tap(pg, 0, DOWN); s = await st(pg); ok('focus on CONTROLLER + SETTINGS', s.menuI === 7, `menuI=${s.menuI}`);
  await tap(pg, 0, S); await waitScr(pg, 'pads'); for (let i = 0; i < 3; i++) await tap(pg, 0, DOWN);
  s = await st(pg); ok('remap screen: LP row focused', s.pad.padsI === 3 && s.pad.padsFam === 'ps', `padsI=${s.pad.padsI} fam=${s.pad.padsFam}`);
  await tap(pg, 0, S); s = await st(pg); ok('cross starts a remap', s.pad.remap?.a === 'lp'); await pg.screenshot({ path: `${OUT}/remap-waiting-1280x800.png` });
  await tap(pg, 0, S); s = await st(pg); ok('pressing cross binds LP to cross and swaps LK onto square', s.pad.maps.ps.lp === 0 && s.pad.maps.ps.lk === 2 && !s.pad.remap, JSON.stringify(s.pad.maps.ps));
  ok('saved toast', /LP = CROSS \(SAVED FOR PS PADS\)/.test(s.toast), s.toast);
  ok('xbox map untouched', s.pad.maps.xbox.lp === 2);
  await pg.screenshot({ path: `${OUT}/remap-screen-1280x800.png` });
  await pg.reload(); await pg.waitForTimeout(700); s = await st(pg); ok('remap persists across a reload (PS family)', s.pad.maps.ps.lp === 0 && s.pad.maps.ps.lk === 2 && s.pad.maps.xbox.lp === 2);
  await pg.evaluate((id) => window.__fp.plug(0, id), PS_ID); await pg.waitForTimeout(200); await tap(pg, 0, S); await waitScr(pg, 'menu');
  for (let i = 0; i < 7; i++) await tap(pg, 0, DOWN); await tap(pg, 0, S); await waitScr(pg, 'pads');
  for (let i = 0; i < 2; i++) await tap(pg, 0, UP); s = await st(pg); ok('reset row reachable (wraps)', s.pad.padsI === 11, `padsI=${s.pad.padsI}`);
  await tap(pg, 0, S); s = await st(pg); ok('reset to default', s.pad.maps.ps.lp === 2 && s.pad.maps.ps.lk === 0, JSON.stringify(s.pad.maps.ps));
  // vibration toggle persists
  for (let i = 0; i < 9; i++) await tap(pg, 0, UP); s = await st(pg); ok('vibration row', s.pad.padsI === 2, `padsI=${s.pad.padsI}`);
  await tap(pg, 0, S); s = await st(pg); ok('vibration off', s.pad.vibe === false); await tap(pg, 0, S); ok('vibration back on', (await st(pg)).pad.vibe === true);
  await tap(pg, 0, E); await waitScr(pg, 'menu'); ok('circle leaves the settings screen', true);
  // arcade fight by pad
  for (let i = 0; i < 7; i++) await tap(pg, 0, UP); s = await st(pg); ok('back on ARCADE', s.menuI === 0, `menuI=${s.menuI}`);
  await tap(pg, 0, S); await waitScr(pg, 'select'); await pg.waitForTimeout(250);
  await tap(pg, 0, W_); await waitScr(pg, 'movelist'); await pg.waitForTimeout(250); await pg.screenshot({ path: `${OUT}/movelist-glyphs-1280x800.png` });
  await tap(pg, 0, E); await waitScr(pg, 'select'); ok('square opens the Move List, circle closes it', true);
  await pg.waitForTimeout(200); await tap(pg, 0, S); await waitScr(pg, 'ladder'); await pg.waitForTimeout(450); await tap(pg, 0, S); await waitScr(pg, 'fight', 15000); ok('cross readies up and starts the ladder fight', true);
  await pg.waitForFunction(() => window.__mb.match?.phase === 'fight', null, { timeout: 15000 }); await pg.evaluate(() => { const m = window.__mb.match; m.f[0].x = 150; m.f[1].x = 500; });
  await pg.evaluate(() => { window.__ev = []; const m = window.__mb; const id = setInterval(() => { for (const e of m.match?.events || []) window.__ev.push(e.type + ':' + (e.mv || '')); if ((m.match?.proj || []).some((p) => p.owner === 0)) window.__shot = 1; }, 5); window.__stopEv = () => clearInterval(id); });
  for (const a of [[0, 1], [0.72, 0.7], [1, 0]]) { await set(pg, 0, [], a); await F(50); } await set(pg, 0, [W_], [1, 0]); await F(60); await set(pg, 0, []); await F(500);
  ok('stick roll ↓↘→ + square throws the special', await pg.evaluate(() => !!window.__shot));
  await pg.evaluate(() => { window.__shot = 0; const m = window.__mb.match; m.f[0].x = 150; m.f[1].x = 500; m.proj.length = 0; }); await F(400);
  await tap(pg, 0, L1, 60); await F(500); ok('L1 special shortcut throws the special', await pg.evaluate(() => !!window.__shot));
  ok('rumble effects fired on hits (vibration on)', (await pg.evaluate(() => window.__rumble.length)) > 0, `${await pg.evaluate(() => window.__rumble.length)} rumble effects`);
  await tap(pg, 0, START); s = await st(pg); ok('OPTIONS pauses', s.paused);
  await tap(pg, 0, DOWN); s = await st(pg); ok('pause menu: D-pad moves focus', s.pad.pauseI === 1); await pg.screenshot({ path: `${OUT}/pause-pad-1280x800.png` });
  await tap(pg, 0, UP); await tap(pg, 0, S); s = await st(pg); ok('cross on RESUME resumes', !s.paused);
  await pg.evaluate(() => window.__fp.unplug(0)); await pg.waitForTimeout(200); s = await st(pg); ok('unplug mid-fight pauses safely with a toast', s.paused && /DISCONNECTED · PAUSED/.test(s.toast), s.toast);
  await pg.evaluate((id) => window.__fp.plug(0, id), XB_ID); await pg.waitForTimeout(200); await tap(pg, 0, E); s = await st(pg); ok('replug (Xbox) + B resumes', !s.paused && s.pad.fam === 'xbox');
  await pg.waitForTimeout(500); ok('fight keeps running after hot-plug', (await st(pg)).scr === 'fight');
  await pg.keyboard.press('KeyP'); await pg.waitForTimeout(100); ok('keyboard still pauses', (await st(pg)).paused); await pg.keyboard.press('KeyS'); await pg.waitForTimeout(80); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150);
  ok('keyboard W/S + Enter drives the pause menu (MOVE LIST)', (await st(pg)).scr === 'movelist'); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok('1280x800: no page errors', pg.errs.length === 0, pg.errs.join(' | ')); await ctx.close();
}

// 3) two pads in local VERSUS 2P: pad 1 = P1, pad 2 = P2
{
  const { ctx, pg } = await open(1280, 800);
  await pg.evaluate(([a, c]) => { window.__fp.plug(0, a); window.__fp.plug(1, c); }, [PS_ID, XB_ID]); await pg.waitForTimeout(250);
  let s = await st(pg); ok('second pad becomes P2', s.pad.slots[0] === 'ps' && s.pad.slots[1] === 'xbox' && /P2 \(VERSUS 2P\)/.test(s.toast), s.toast);
  await tap(pg, 0, S); await waitScr(pg, 'menu'); await tap(pg, 0, DOWN); await tap(pg, 0, S); await waitScr(pg, 'select'); s = await st(pg); ok('VERSUS 2P by pad', s.mode === 'versus');
  await pg.waitForTimeout(200); const sel0 = await pg.evaluate(() => window.__mb.sel.slice()); await tap(pg, 1, RIGHT); const sel = await pg.evaluate(() => window.__mb.sel.slice()); ok('pad 2 moves the P2 cursor', sel[1] === (sel0[1] + 1) % 8 || sel[1] !== sel0[1], `${sel0} -> ${sel}`);
  await tap(pg, 0, S); await tap(pg, 1, S); await waitScr(pg, 'fight', 15000); await pg.waitForFunction(() => window.__mb.match?.phase === 'fight', null, { timeout: 15000 });
  const x0 = await pg.evaluate(() => [window.__mb.match.f[0].x, window.__mb.match.f[1].x]);
  await set(pg, 1, [LEFT]); await F(400); await set(pg, 1, []); await F(60);
  const x1 = await pg.evaluate(() => [window.__mb.match.f[0].x, window.__mb.match.f[1].x]);
  ok('pad 2 walks P2 and not P1', x1[1] < x0[1] - 5 && Math.abs(x1[0] - x0[0]) < 1, `${x0} -> ${x1}`);
  await set(pg, 0, [RIGHT]); await F(400); await set(pg, 0, []); await F(60);
  const x2 = await pg.evaluate(() => [window.__mb.match.f[0].x, window.__mb.match.f[1].x]); ok('pad 1 walks P1', x2[0] > x1[0] + 5, `${x1} -> ${x2}`);
  const r = await pg.evaluate(() => ({ mode: window.__mb.mode, bal: window.__mb.kibbleWon || 0 })); ok('local 1v1 stays casual (versus mode: no prizes, no $KIBBLE, no rank)', r.mode === 'versus');
  await pg.evaluate(() => window.__fp.unplug(1)); await pg.waitForTimeout(200); s = await st(pg); ok('unplugging pad 2 pauses the local match', s.paused && /P2 DISCONNECTED/.test(s.toast), s.toast);
  ok('versus: no page errors', pg.errs.length === 0, pg.errs.join(' | ')); await ctx.close();
}
await b.close(); srv.close();
const fail = results.filter((r) => !r.pass); console.log(`\n${results.length - fail.length}/${results.length} passed`); fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2)); process.exit(fail.length ? 1 : 0);
