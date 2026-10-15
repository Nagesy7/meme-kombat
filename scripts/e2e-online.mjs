// Online 1v1 e2e: two separate browser contexts play a REAL online match against each other through the kibble-pay
// /api/pvp matchmaking + signaling endpoint (local dev server by default, KIBBLE=<url> to point elsewhere).
// Scenarios: desktop private room over WebRTC, desktop ranked (both SIWS-signed) quick match, iPhone 13 landscape
// touch match over the forced server relay, and disconnect -> forfeit. Screenshots -> proof/${PFX}-*.png
import { chromium, devices } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const KP = process.env.KIBBLE_PAY_DIR || '/workspace/kibble-pay', kreq = createRequire(path.join(KP, 'package.json'));
const nacl = kreq('tweetnacl'), bs58m = kreq('bs58'), bs58 = bs58m.default || bs58m;
const root = path.resolve('.'), types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(0);
let KIBBLE = process.env.KIBBLE, dev = null;
if (!KIBBLE) { dev = spawn('node', ['scripts/dev-server.mjs', '8799'], { cwd: KP, env: { ...process.env, KIBBLE_NETWORK: 'devnet' }, stdio: 'ignore' }); KIBBLE = 'http://localhost:8799'; await new Promise((r) => setTimeout(r, 1500)); }
const URL = process.env.URL || `http://localhost:${srv.address().port}/`;
const PFX = process.env.PFX || 'online';
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
fs.mkdirSync('proof', { recursive: true });
const b = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
const G = (pg) => pg.evaluate(() => { const G = window.__mb, N = G.net, m = G.match; return { scr: G.scr, code: N?.s?.code, side: N?.s?.side, state: N?.s?.state, via: N?.s?.via, delay: N?.s?.delay, ended: N?.ended, post: N?.post, report: N?.report, desync: N?.ls?.desync, phase: m?.phase, hp: m?.f.map((f) => f.hp), wins: m?.wins, tick: m?.tick, lobby: G.lobbyMsg }; });
const waitScr = (pg, s, ms = 20000) => pg.waitForFunction((s) => window.__mb.scr === s, s, { timeout: ms });
async function siws(kpair) { // real Sign-In-With-Solana against the kibble-pay /api/auth endpoint (ed25519 keypair = test wallet)
  const addr = bs58.encode(kpair.publicKey), n = await (await fetch(KIBBLE + '/api/auth')).json(), host = new globalThis.URL(KIBBLE).host;
  const message = `${host} wants you to sign in with your Solana account:\n${addr}\n\nSign in to Meme Brawl ranked (e2e)\n\nURI: ${KIBBLE}\nVersion: 1\nNonce: ${n.nonce}\nIssued At: ${new Date().toISOString()}`;
  const r = await (await fetch(KIBBLE + '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, message, nonceToken: n.nonceToken, signature: bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kpair.secretKey)) }) })).json();
  if (!r.session) throw new Error('siws failed ' + JSON.stringify(r)); return { addr, session: r.session };
}
async function player(device, { relay, auth } = {}) {
  const ctx = await b.newContext(device ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: 1280, height: 720 } });
  if (auth) await ctx.addInitScript(([s, a]) => { sessionStorage.setItem('kibblePay.session', s); sessionStorage.setItem('kibblePay.address', a); }, [auth.session, auth.addr]);
  const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', (e) => { pg.errs.push(e.message); console.log('PAGEERR', e.stack); }); pg.touch = !!device; pg.extra = `kibble=${encodeURIComponent(KIBBLE)}${relay ? '&relay=1' : ''}`; return pg;
}
const press = async (pg, k) => { await pg.keyboard.press(k); await pg.waitForTimeout(90); };
async function tapCanvas(pg, x, y) { const r = await pg.locator('#game').boundingBox(); await pg.touchscreen.tap(r.x + (x * r.width) / 640, r.y + (y * r.height) / 360); await pg.waitForTimeout(150); }
// navigate title -> menu -> ONLINE 1V1 -> option -> lock in fighter (keyboard on desktop, taps on phone)
async function goOnline(pg, opt, fighter = 0) {
  await pg.goto(URL + '?' + pg.extra); await pg.waitForTimeout(800);
  if (pg.touch) { await tapCanvas(pg, 320, 200); await waitScr(pg, 'menu'); await tapCanvas(pg, 320, 168); await waitScr(pg, 'online'); await tapCanvas(pg, 320, 84 + opt * 40); await waitScr(pg, 'select');
    await tapCanvas(pg, 0, 0); const x0 = 320 - (5 * 76) / 2 + 3; await tapCanvas(pg, x0 + (fighter % 5) * 76 + 35, 38 + Math.floor(fighter / 5) * 68 + 30); await tapCanvas(pg, x0 + (fighter % 5) * 76 + 35, 38 + Math.floor(fighter / 5) * 68 + 30); }
  else { await press(pg, 'Enter'); await waitScr(pg, 'menu'); for (let i = 0; i < 2; i++) await press(pg, 'KeyS'); await press(pg, 'Enter'); await waitScr(pg, 'online');
    for (let i = 0; i < opt; i++) await press(pg, 'KeyS'); await press(pg, 'Enter'); await waitScr(pg, 'select'); await pg.waitForTimeout(300);
    for (let i = 0; i < fighter; i++) await press(pg, 'KeyD'); await press(pg, 'KeyF'); }
  await waitScr(pg, 'lobby');
}
async function joinByLink(pg, code, fighter = 3) {
  await pg.goto(URL + `?room=${code}&` + pg.extra); await pg.waitForTimeout(800); await waitScr(pg, 'select');
  if (pg.touch) { const x0 = 320 - (5 * 76) / 2 + 3; await tapCanvas(pg, x0 + (fighter % 5) * 76 + 35, 68); await pg.waitForTimeout(200); await tapCanvas(pg, x0 + (fighter % 5) * 76 + 35, 68); }
  else { for (let i = 0; i < fighter; i++) await press(pg, 'KeyD'); await press(pg, 'KeyF'); }
}
// attacker walks forward and lands real heavy punches until the online match is over; the defender just stands
async function fight(att, def, ms = 180000, shotName) {
  const t0 = Date.now(); let shot = false;
  let cdp, fwd, hpBtn;
  if (att.touch) { cdp = await att.context().newCDPSession(att); const d = await att.locator('#dpad').boundingBox(), side = (await G(att)).side, h = await att.locator('#btns button[data-k="hp"]').boundingBox();
    fwd = { x: d.x + d.width * (side ? 0.1 : 0.9), y: d.y + d.height / 2 }; hpBtn = { x: h.x + h.width / 2, y: h.y + h.height / 2 }; }
  // real touch input via the browser's touch pipeline (Input.dispatchTouchEvent -> pointer events)
  const touch = async (pt, ms) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] }); await att.waitForTimeout(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  if (!att.touch) await att.keyboard.down((await G(att)).side ? 'KeyA' : 'KeyD');
  while (Date.now() - t0 < ms) {
    const [a, d] = await Promise.all([G(att), G(def)]);
    if (a.scr === 'onlineres' && d.scr === 'onlineres') break;
    if (!shot && a.phase === 'fight' && a.hp && (a.hp[0] < 1000 || a.hp[1] < 1000) && a.hp.some((h) => h < 800)) { await Promise.all([att.screenshot({ path: `proof/${shotName}-a.png` }), def.screenshot({ path: `proof/${shotName}-b.png` })]); shot = true; }
    if (a.phase === 'finish' && !att.touch) { await att.keyboard.press('KeyS'); await att.keyboard.press('KeyS'); await att.keyboard.down('KeyS'); await att.keyboard.press('KeyB'); await att.keyboard.up('KeyS'); }
    if (att.touch) { if (a.hp && Math.abs((await att.evaluate(() => window.__mb.match.f[0].x - window.__mb.match.f[1].x))) > 70) await touch(fwd, 200); await touch(hpBtn, 70); }
    else await att.keyboard.press('KeyG');
    await att.waitForTimeout(140);
  }
  if (!att.touch) { await att.keyboard.up('KeyD'); await att.keyboard.up('KeyA'); }
}
const verdict = async (name, a, b2, { ranked } = {}) => {
  await a.waitForFunction(() => /Verified|differ|NOT/.test(window.__mb.net?.post || ''), null, { timeout: 25000 }).catch(() => {});
  await b2.waitForFunction(() => /Verified|differ|NOT/.test(window.__mb.net?.post || ''), null, { timeout: 25000 }).catch(() => {});
  const [x, y] = await Promise.all([G(a), G(b2)]);
  ok(`${name}: both clients finished the online match`, x.scr === 'onlineres' && y.scr === 'onlineres' && x.ended === 'done' && y.ended === 'done', `${x.ended}/${y.ended} via ${x.via}/${y.via} delay ${x.delay}`);
  ok(`${name}: no desync, identical result reports (winner, rounds, hp, ticks, checksum)`, !x.desync && !y.desync && JSON.stringify(x.report) === JSON.stringify(y.report), JSON.stringify(x.report));
  ok(`${name}: server verified the result (both clients agree)`, /Verified/.test(x.post) && /Verified/.test(y.post), `${x.post} | ${y.post}`);
  return [x, y];
};

const run = (n) => !process.env.ONLY || process.env.ONLY.includes(n);
try {
  // 1) desktop: private room code + share link, WebRTC data channel
  if (run('1')) { const A = await player(), B = await player();
    await goOnline(A, 2, 0); await A.waitForFunction(() => window.__mb.net?.s?.code, null, { timeout: 15000 }); const { code } = await G(A); await A.waitForTimeout(400); await A.screenshot({ path: `proof/${PFX}-01-room-code.png` });
    ok('desktop: private room created with a share code', /^[A-Z0-9]{6}$/.test(code), code);
    await joinByLink(B, code, 3); await Promise.all([waitScr(A, 'fight', 30000), waitScr(B, 'fight', 30000)]);
    const s = await G(A); ok('desktop: two browser contexts matched and connected', s.state === 'ready', `via ${s.via}`);
    await A.screenshot({ path: `proof/${PFX}-02-versus-start-a.png` });
    await fight(A, B, 180000, `${PFX}-03-desktop-fight`); const [x] = await verdict('desktop private room (WebRTC)', A, B);
    ok('desktop: WebRTC peer-to-peer data channel used', x.via === 'p2p', x.via);
    await A.screenshot({ path: `proof/${PFX}-04-result-a.png` }); await B.screenshot({ path: `proof/${PFX}-04-result-b.png` });
    ok('desktop: no page errors', !A.errs.length && !B.errs.length, [...A.errs, ...B.errs].join('; '));
    await A.context().close(); await B.context().close(); }
  // 2) desktop ranked quick match: both wallets SIWS-signed; verified win posted server-side to the prize board
  if (run('2')) { const w1 = await siws(nacl.sign.keyPair()), w2 = await siws(nacl.sign.keyPair()); const A = await player(false, { auth: w1 }), B = await player(false, { auth: w2 });
    await goOnline(A, 1, 1); await A.waitForTimeout(600); await A.screenshot({ path: `proof/${PFX}-05-ranked-searching.png` }); await goOnline(B, 1, 4);
    await Promise.all([waitScr(A, 'fight', 40000), waitScr(B, 'fight', 40000)]);
    const [sa, sb] = await Promise.all([G(A), G(B)]); const att = sa.side === 0 ? A : B, def = att === A ? B : A;
    await fight(att, def, 180000, `${PFX}-06-ranked-fight`); const [x] = await verdict('desktop ranked quick match', A, B, { ranked: true });
    const winnerAddr = (x.report.winner === sa.side ? w1 : w2).addr;
    const board = await (await fetch(`${KIBBLE}/api/game?action=scores&game=meme-brawl&pool=weekly`)).json();
    ok('ranked: verified PvP win posted to /api/game prize board for the winner wallet', board.entries.some((e) => e.wallet === winnerAddr), JSON.stringify(board.entries.slice(0, 3)));
    const direct = await fetch(`${KIBBLE}/api/game?action=score`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + w1.session }, body: JSON.stringify({ game: 'meme-brawl', score: 2500, durationMs: 60000 }) });
    ok('ranked: client-submitted (e.g. vs CPU) meme-brawl scores are refused', direct.status === 403, String(direct.status));
    await A.screenshot({ path: `proof/${PFX}-07-ranked-result-a.png` }); await B.screenshot({ path: `proof/${PFX}-07-ranked-result-b.png` });
    await A.context().close(); await B.context().close(); }
  // 3) iPhone 13 landscape, touch controls, forced server relay (fallback transport)
  if (run('3')) { const A = await player(true, { relay: true }), B = await player(true, { relay: true });
    await goOnline(A, 2, 2); await A.waitForFunction(() => window.__mb.net?.s?.code, null, { timeout: 15000 }); const { code } = await G(A); await A.screenshot({ path: `proof/${PFX}-08-iphone-room.png` });
    await joinByLink(B, code, 5); await Promise.all([waitScr(A, 'fight', 40000), waitScr(B, 'fight', 40000)]);
    await fight(A, B, 240000, `${PFX}-09-iphone-fight`); const [x] = await verdict('iPhone landscape (relay fallback)', A, B);
    ok('iPhone: server relay fallback used when WebRTC is unavailable', x.via === 'relay', x.via);
    await A.screenshot({ path: `proof/${PFX}-10-iphone-result-a.png` }); await B.screenshot({ path: `proof/${PFX}-10-iphone-result-b.png` });
    await A.context().close(); await B.context().close(); }
  // 4) disconnect mid-fight -> remaining player wins by forfeit after the timeout (not ranked)
  if (run('4')) { const A = await player(), B = await player();
    await goOnline(A, 2, 0); await A.waitForFunction(() => window.__mb.net?.s?.code, null, { timeout: 15000 }); const { code } = await G(A);
    await joinByLink(B, code, 1); await Promise.all([waitScr(A, 'fight', 30000), waitScr(B, 'fight', 30000)]); await A.waitForTimeout(2500);
    await B.context().close(); const t0 = Date.now();
    await A.waitForTimeout(3000); await A.screenshot({ path: `proof/${PFX}-11-waiting-opponent.png` });
    await waitScr(A, 'onlineres', 20000); const x = await G(A); await A.screenshot({ path: `proof/${PFX}-12-forfeit.png` });
    ok('disconnect: opponent leaving ends the match as a forfeit', x.ended === 'forfeit', `${x.ended} after ${Date.now() - t0}ms`);
    await A.context().close(); }
} catch (e) { ok('e2e-online crashed', false, e.stack); }
fs.writeFileSync(`proof/e2e-${PFX}-results.json`, JSON.stringify({ at: new Date().toISOString(), url: URL, kibble: KIBBLE, results }, null, 1));
await b.close(); srv.close(); dev?.kill();
const fails = results.filter((r) => !r.pass).length; console.log(`\n${results.length - fails}/${results.length} passed`); process.exit(fails ? 1 : 0);
