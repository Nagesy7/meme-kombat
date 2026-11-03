// "Feel more alive" e2e: main menu daily challenge + verified-wins feed, mute persistence, reduced-effects mode, crowd reacting
// to a KO, layout at phone landscape sizes + desktop, and render frame time with ambient effects on vs off.
// Screenshots -> $OUT (default proof/alive). URL=... runs against a deployment (feed is then the live data, not a mock).
import { chromium, devices } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('.'), types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); });
await new Promise((res) => srv.listen(0, res));
const LIVE = !!process.env.URL, URL = process.env.URL || `http://localhost:${srv.address().port}/`, OUT = process.env.OUT || 'proof/alive'; fs.mkdirSync(OUT, { recursive: true });
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const b = await chromium.launch();
const waitScr = (pg, s, ms = 10000) => pg.waitForFunction((s) => window.__mb.scr === s, s, { timeout: ms });
const TEST = '4xoj…Pv2K';
const mockClips = (pg) => pg.route(/action=clips/, (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, clips: [
  { id: 'real', at: new Date(Date.now() - 7 * 60e3).toISOString(), verified: true, ranked: true, winner: 0, players: [{ short: 'Ab12…xY9z', char: 'inu' }, { short: 'Qq77…Lm3n', char: 'croakley' }] },
  { id: 'test', at: new Date(Date.now() - 2 * 60e3).toISOString(), verified: true, ranked: true, winner: 0, players: [{ short: TEST, char: 'toot' }, { short: 'Qq77…Lm3n', char: 'croakley' }] },
  { id: 'casual', at: new Date().toISOString(), verified: true, ranked: false, winner: 1, players: [{ short: 'Cc11…Dd22', char: 'toot' }, { short: 'Ee33…Ff44', char: 'inu' }] }] }) }));
async function open(w, h, { touch = w < 1000, query = '', mock = !LIVE, reduce = false } = {}) {
  const ctx = await b.newContext({ ...(touch ? devices['iPhone 13 landscape'] : {}), viewport: { width: w, height: h }, reducedMotion: reduce ? 'reduce' : 'no-preference' }), pg = await ctx.newPage();
  pg.errs = []; pg.on('pageerror', (e) => pg.errs.push(e.message)); if (mock) await mockClips(pg);
  await pg.goto(URL + (query ? '?' + query : '')); await pg.waitForTimeout(600);
  if (touch) await pg.touchscreen.tap(w / 2, h / 3); else await pg.keyboard.press('Enter');
  await waitScr(pg, 'menu'); await pg.waitForFunction(() => ['ok', 'error'].includes(window.__mb.feed.state), null, { timeout: 15000 }); await pg.waitForTimeout(400);
  return { ctx, pg };
}
const rects = (pg) => pg.evaluate(() => { const c = document.getElementById('game').getBoundingClientRect(), k = c.width / 640, out = [];
  for (const s of ['#stick', '#jump', '[data-k=lp]', '[data-k=hp]', '[data-k=lk]', '[data-k=hk]', '#top']) { const e = document.querySelector(s); if (!e) continue; const q = e.getBoundingClientRect(); if (q.width && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.hide')) out.push([s, (q.left - c.left) / k, (q.top - c.top) / k, (q.right - c.left) / k, (q.bottom - c.top) / k]); }
  const pill = document.querySelector('inu-profile-badge'); if (pill) { const q = pill.getBoundingClientRect(); if (q.width) out.push(['pill', (q.left - c.left) / k, (q.top - c.top) / k, (q.right - c.left) / k, (q.bottom - c.top) / k]); }
  return out; });
// menu UI boxes in canvas units: 8 items, settings chips, daily, feed, badges
const UI = [...Array.from({ length: 8 }, (_, i) => ['item' + i, 14, 36 + i * 27, 304, 60 + i * 27]), ['chips', 100, 256, 304, 276], ['daily', 312, 36, 626, 102], ['feed', 312, 108, 626, 184], ['badges', 312, 190, 468, 248]];
const overlap = (a, b) => a[1] < b[3] - 1 && b[1] < a[3] - 1 && a[2] < b[4] - 1 && b[2] < a[4] - 1;

// 1) menu layout + daily + feed at every size
for (const [w, h] of [[667, 375], [750, 342], [844, 390], [1280, 800]]) {
  const { ctx, pg } = await open(w, h), V = `${w}x${h}`;
  const st = await pg.evaluate(() => ({ daily: window.__mb.daily, feed: window.__mb.feed, ch: window.__mbUI.dailyNow() }));
  ok(`${V}: daily challenge for today's Sydney date`, st.ch.date === new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date()) && st.ch.title, `${st.ch.date} ${st.ch.title}`);
  if (!LIVE) ok(`${V}: feed shows the real verified ranked win only (test wallet + casual excluded)`, st.feed.state === 'ok' && st.feed.rows.length === 1 && st.feed.rows[0].short === 'Ab12…xY9z' && !st.feed.rows.some((r) => r.short === TEST));
  else ok(`${V}: live feed loaded (rows come only from verified clips)`, st.feed.state === 'ok' && st.feed.rows.every((r) => r.short !== TEST), `${st.feed.rows.length} rows`);
  const hits = []; for (const r of await rects(pg)) for (const u of UI) if (overlap(r, u)) hits.push(`${r[0]}~${u[0]}`);
  ok(`${V}: menu panels stay clear of touch controls, wallet pill and top buttons`, !hits.length, hits.join(' '));
  await pg.screenshot({ path: `${OUT}/menu-${V}.png` }); ok(`${V}: no page errors`, !pg.errs.length, pg.errs.join('; ')); await ctx.close();
}
// 2) honest empty state when there is no data
{ const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), pg = await ctx.newPage();
  await pg.route(/action=clips/, (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true,"clips":[]}' }));
  await pg.goto(URL); await pg.waitForTimeout(500); await pg.keyboard.press('Enter'); await waitScr(pg, 'menu'); await pg.waitForFunction(() => window.__mb.feed.state === 'ok');
  ok('empty clips -> empty state, no rows', (await pg.evaluate(() => window.__mb.feed.rows.length)) === 0); await pg.screenshot({ path: `${OUT}/menu-empty.png` });
  await pg.unroute(/action=clips/); await pg.route(/action=clips/, (r) => r.fulfill({ status: 503, body: 'down' })); await pg.evaluate(() => window.__mbUI.refreshFeed(true)); await pg.waitForFunction(() => window.__mb.feed.state === 'error');
  ok('server down -> offline state, still no rows', (await pg.evaluate(() => window.__mb.feed.rows.length)) === 0); await ctx.close(); }
// 3) mute + volume persist across reload; audio waits for a gesture
{ const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), pg = await ctx.newPage(); await pg.goto(URL); await pg.waitForTimeout(500);
  const before = await pg.evaluate(() => !!window.__mbUI.audioStarted());
  await pg.keyboard.press('Enter'); await waitScr(pg, 'menu'); await pg.keyboard.press('KeyM'); await pg.keyboard.press('Minus');
  const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('mb.audio'))); await pg.reload(); await pg.waitForTimeout(500);
  const btn = await pg.evaluate(() => { const e = document.getElementById('muteBtn'); return e ? e.getAttribute('aria-pressed') : null; });
  ok('mute + volume saved to mb.audio', saved?.muted === true && saved.vol === 0.75, JSON.stringify(saved));
  ok('mute survives a reload (button shows muted)', btn === 'true', `aria-pressed=${btn}`); ok('no audio before a user gesture', before === false);
  await ctx.close(); }
// 4) fight: crowd reacts to a KO; reduced effects via ?fx=low and via prefers-reduced-motion
async function fight(pg, w) {
  if (w < 1000) { await pg.evaluate(() => window.__mbUI.menuRect(0)); } await pg.keyboard.press('Enter'); await waitScr(pg, 'select'); await pg.waitForTimeout(250); await pg.keyboard.press('KeyF'); await pg.waitForTimeout(250); await pg.keyboard.press('Enter');
  await pg.waitForFunction(() => window.__mb.scr === 'fight' && window.__mb.match.phase === 'fight', null, { timeout: 15000 }); await pg.evaluate(() => (window.__mb.cpuLevel = -1));
}
for (const [w, h] of [[844, 390], [1280, 800]]) {
  const { ctx, pg } = await open(w, h, { touch: false }); await fight(pg, 1280);
  await pg.keyboard.down('KeyD'); await pg.waitForTimeout(700); await pg.keyboard.up('KeyD'); for (let i = 0; i < 3; i++) { await pg.keyboard.press('KeyG'); await pg.waitForTimeout(260); }
  await pg.screenshot({ path: `${OUT}/fight-${w}x${h}.png` });
  const a0 = await pg.evaluate(() => ({ ev: window.__mb.amb?.events, lvl: window.__mbUI.fxLevel(), st: window.__mb.match.stage }));
  ok(`${w}x${h}: crowd + details live in the fight (full effects)`, a0.ev > 0 && a0.lvl === 'full', JSON.stringify(a0));
  await pg.evaluate(() => { const m = window.__mb.match; m.f[1].hp = 1; m.f[0].x = m.f[1].x - 60; });
  for (let i = 0; i < 6 && (await pg.evaluate(() => !window.__mb.amb.ko)); i++) { await pg.keyboard.press('KeyG'); await pg.waitForTimeout(300); }
  await pg.waitForTimeout(350); const k = await pg.evaluate(() => { const A = window.__mb.amb; return { ko: A.ko, parts: A.parts.length, jumping: A.members.filter((p) => p.jy > 0 || p.cheer > 0).length, n: A.members.length }; });
  ok(`${w}x${h}: crowd cheers + confetti on KO`, k.ko > 0 && k.parts > 0 && k.jumping > k.n / 2, JSON.stringify(k)); await pg.screenshot({ path: `${OUT}/ko-${w}x${h}.png` });
  ok(`${w}x${h}: no page errors in fight`, !pg.errs.length, pg.errs.join('; ')); await ctx.close();
}
for (const [label, opts] of [['?fx=low', { query: 'fx=low' }], ['prefers-reduced-motion', { reduce: true }]]) {
  const { ctx, pg } = await open(844, 390, { touch: false, ...opts }); await fight(pg, 1280); await pg.waitForTimeout(500);
  const lvl = await pg.evaluate(() => window.__mbUI.fxLevel()); ok(`${label}: reduced effects`, lvl === 'low', lvl);
  await pg.screenshot({ path: `${OUT}/reduced-${label.replace(/[^a-z]+/g, '')}.png` }); await ctx.close();
}
// 5) frame time at 844x390: ambient full vs off, normal and 4x CPU throttle
const frameStats = async (query, throttle) => {
  const { ctx, pg } = await open(844, 390, { touch: false, query }); await fight(pg, 1280);
  const cdp = await ctx.newCDPSession(pg); if (throttle) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await pg.evaluate(() => (window.__perf = { n: 0, ms: 0, max: 0 }));
  const raf = await pg.evaluate(() => new Promise((res) => { const d = []; let t0 = performance.now(); const f = (t) => { d.push(t - t0); t0 = t; if (d.length < 240) requestAnimationFrame(f); else res(d); }; requestAnimationFrame(f); }));
  const P = await pg.evaluate(() => window.__perf); raf.sort((a, b) => a - b); await ctx.close();
  return { render: +(P.ms / P.n).toFixed(2), renderMax: +P.max.toFixed(1), frameMedian: +raf[120].toFixed(1), frameP95: +raf[228].toFixed(1) };
};
const perf = {}; for (const t of [0, 4]) for (const [k, q] of [['on', 'fx=full'], ['off', 'fx=off']]) perf[`${k}${t ? '-cpu4x' : ''}`] = await frameStats(q, t);
console.log('frame time 844x390 (ms):', JSON.stringify(perf)); fs.writeFileSync(`${OUT}/frametime.json`, JSON.stringify(perf, null, 1));
ok('render cost with full ambient stays small (< +2 ms vs off, 4x CPU throttle)', perf['on-cpu4x'].render - perf['off-cpu4x'].render < 2, `${perf['on-cpu4x'].render} vs ${perf['off-cpu4x'].render}`);
await b.close(); srv.close();
const fails = results.filter((r) => !r.pass); console.log(`\n${results.length - fails.length}/${results.length} passed`); process.exit(fails.length ? 1 : 0);
