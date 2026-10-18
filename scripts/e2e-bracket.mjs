// Bracket e2e (LOCAL ONLY: in-memory kibble-pay dev server, throwaway keypairs; never production): a 4-player single-
// elimination bracket played to completion with real browsers. The bracket driver here is a test harness standing in for
// the shared bracket service (inu-shared/tournaments.md); it only uses the Meme Brawl hooks: admin action=pair (two-wallet
// ranked room), the normal verified-result path, and the GET action=bracket outbox. Also checks the public clip endpoint
// and plays a clip back. Screenshots -> /workspace/meme-brawl-shots/tournament/
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const KP = process.env.KIBBLE_PAY_DIR || '/workspace/kibble-pay', kreq = createRequire(path.join(KP, 'package.json'));
const nacl = kreq('tweetnacl'), bs58m = kreq('bs58'), bs58 = bs58m.default || bs58m;
const { seedBracket } = await import(path.join(KP, 'test/helpers/bracket-sim.js'));
const SHOTS = process.env.SHOTS || '/workspace/meme-brawl-shots/tournament'; fs.mkdirSync(SHOTS, { recursive: true });
const root = path.resolve('.'), types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); } }); }).listen(0);
const ADMIN = crypto.randomBytes(16).toString('hex'); // throwaway local admin token for the local dev server only
const dev = spawn('node', ['scripts/dev-server.mjs', '8798'], { cwd: KP, env: { ...process.env, KIBBLE_NETWORK: 'devnet', ADMIN_TOKEN: ADMIN, KIBBLE_STORE_FILE: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '' }, stdio: 'ignore' });
const KIBBLE = 'http://localhost:8798';
for (let i = 0; i < 60; i++) { try { if ((await fetch(KIBBLE + '/api/pvp?action=room&code=X')).status) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
const URL = `http://localhost:${srv.address().port}/`;
const results = []; const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const b = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns', '--autoplay-policy=no-user-gesture-required'] });
const G = (pg) => pg.evaluate(() => { const G = window.__mb, N = G.net, m = G.match; return { scr: G.scr, code: N?.s?.code, side: N?.s?.side, state: N?.s?.state, ended: N?.ended, post: N?.post, report: N?.report, desync: N?.ls?.desync, phase: m?.phase, hp: m?.f.map((f) => f.hp), lobby: G.lobbyMsg, pair: N?.s?.room?.pair }; });
const waitScr = (pg, s, ms = 30000) => pg.waitForFunction((s) => window.__mb.scr === s, s, { timeout: ms });
const api = async (q, body) => (await fetch(`${KIBBLE}/api/pvp?${q}`, body ? { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ADMIN }, body: JSON.stringify(body) } : {})).json();
async function siws(kpair) {
  const addr = bs58.encode(kpair.publicKey), n = await (await fetch(KIBBLE + '/api/auth')).json(), host = new globalThis.URL(KIBBLE).host;
  const message = `${host} wants you to sign in with your Solana account:\n${addr}\n\nSign in to Meme Brawl ranked (e2e)\n\nURI: ${KIBBLE}\nVersion: 1\nNonce: ${n.nonce}\nIssued At: ${new Date().toISOString()}`;
  const r = await (await fetch(KIBBLE + '/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: addr, message, nonceToken: n.nonceToken, signature: bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kpair.secretKey)) }) })).json();
  if (!r.session) throw new Error('siws failed'); return { addr, session: r.session };
}
async function player(w, vp) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
  await ctx.addInitScript(([s, a]) => { sessionStorage.setItem('kibblePay.session', s); sessionStorage.setItem('kibblePay.address', a); }, [w.session, w.addr]);
  const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', (e) => pg.errs.push(e.message)); pg.w = w; pg.vp = vp; return pg;
}
const press = async (pg, k) => { await pg.keyboard.press(k); await pg.waitForTimeout(90); };
async function joinRoom(pg, code, fighter) {
  await pg.goto(URL + `?room=${code}&kibble=${encodeURIComponent(KIBBLE)}`); await pg.waitForTimeout(800); await waitScr(pg, 'select');
  for (let i = 0; i < fighter; i++) await press(pg, 'KeyD'); await press(pg, 'KeyF'); await waitScr(pg, 'lobby');
}
async function fight(att, def, shot) {
  const t0 = Date.now(); let took = false; await att.keyboard.down((await G(att)).side ? 'KeyA' : 'KeyD');
  while (Date.now() - t0 < 240000) {
    const [a, d] = await Promise.all([G(att), G(def)]); if (a.scr === 'onlineres' && d.scr === 'onlineres') break;
    if (shot && !took && a.phase === 'fight' && a.hp?.some((h) => h < 800)) { await Promise.all([att.screenshot({ path: `${SHOTS}/${shot}-${att.vp.width}x${att.vp.height}.png` }), def.screenshot({ path: `${SHOTS}/${shot}-${def.vp.width}x${def.vp.height}-opponent.png` })]); took = true; }
    if (Math.abs(await att.evaluate(() => window.__mb.match.f[0].x - window.__mb.match.f[1].x)) < 80) await att.keyboard.press('KeyG');
    await att.waitForTimeout(140);
  }
  await att.keyboard.up('KeyD'); await att.keyboard.up('KeyA');
}
const verdict = async (pg) => { await pg.waitForFunction(() => /Verified|differ|NOT/.test(window.__mb.net?.post || ''), null, { timeout: 30000 }).catch(() => {}); return G(pg); };
async function playMatch(mid, round, pa, pb, fa, fb, label) {
  const pr = await api('action=pair', { allow: [pa.w.addr, pb.w.addr], ctx: { tid: 'local-e2e', mid, round }, deadlineMs: 15 * 60000 });
  ok(`${mid}: pairing hook made a two-wallet ranked room`, pr.ok && /^[A-Z2-9]{6}$/.test(pr.code), pr.code || pr.reason);
  await joinRoom(pa, pr.code, fa); await pa.waitForTimeout(1200);
  const lob = await G(pa); ok(`${mid}: first player waits in the BRACKET MATCH lobby`, lob.scr === 'lobby' && !!lob.pair, lob.lobby);
  if (label) await pa.screenshot({ path: `${SHOTS}/${label}-lobby-${pa.vp.width}x${pa.vp.height}.png` });
  await joinRoom(pb, pr.code, fb); await Promise.all([waitScr(pa, 'fight', 45000), waitScr(pb, 'fight', 45000)]);
  const [sa] = await Promise.all([G(pa), G(pb)]); const att = sa.side === 0 ? pa : pb, def = att === pa ? pb : pa;
  await fight(att, def, label && `${label}-match`);
  const [x, y] = await Promise.all([verdict(pa), verdict(pb)]);
  ok(`${mid}: both clients finished with identical reports`, x.ended === 'done' && y.ended === 'done' && JSON.stringify(x.report) === JSON.stringify(y.report), JSON.stringify(x.report));
  ok(`${mid}: server verified the bracket result`, /Verified/.test(x.post) && /Verified/.test(y.post), `${x.post} | ${y.post}`);
  if (label) { await pa.waitForTimeout(600); await pa.screenshot({ path: `${SHOTS}/${label}-result-${pa.vp.width}x${pa.vp.height}.png` }); }
  const winner = x.report.winner === x.side ? pa : pb;
  return { code: pr.code, winner, loser: winner === pa ? pb : pa };
}
const out = { at: new Date().toISOString(), kibble: KIBBLE, note: 'local in-memory store, throwaway wallets' };
try {
  const ws = await Promise.all([0, 1, 2, 3].map(() => siws(nacl.sign.keyPair())));
  const V844 = { width: 844, height: 390 }, V667 = { width: 667, height: 375 };
  const seeded = seedBracket(ws.map((w) => w.addr)); ok('seeding: 4 entrants -> 4-slot bracket, no byes, 1v4 and 2v3', seeded.size === 4 && seeded.r1.every((m) => !m.bye) && seeded.r1[0].b === ws[3].addr);
  const P = await Promise.all(ws.map((w, i) => player(w, i < 2 ? V844 : V667))), byAddr = (a) => P.find((p) => p.w.addr === a);
  const [m1, m2] = seeded.r1;
  // semis in parallel (one at 844x390, one at 667x375)
  const [s1, s2] = await Promise.all([playMatch('r1m1', 1, byAddr(m1.a), byAddr(m1.b), 1, 4, 'semi1'), playMatch('r1m2', 1, byAddr(m2.b), byAddr(m2.a), 6, 8, 'semi2')]);
  let br = await api('action=bracket&tid=local-e2e');
  ok('semis: both verified outcomes in the bracket outbox', br.results?.r1m1?.winnerWallet === s1.winner.w.addr && br.results?.r1m2?.winnerWallet === s2.winner.w.addr);
  // final: winners re-pair (fresh room, possibly different viewport sizes)
  const fin = await playMatch('r2m1', 2, s1.winner, s2.winner, 2, 5, 'final');
  br = await api('action=bracket&tid=local-e2e');
  ok('final: champion recorded from the verified result only', br.results?.r2m1?.winnerWallet === fin.winner.w.addr && Object.keys(br.flags || {}).length === 0, fin.winner.w.addr.slice(0, 6));
  const board = await (await fetch(`${KIBBLE}/api/game?action=scores&game=meme-brawl&pool=weekly`)).json();
  ok('bracket matches did NOT post to the weekly ranked prize board', (board.entries || []).length === 0, JSON.stringify(board.entries || board));
  const inu = await (await fetch(`${KIBBLE}/api/game?action=inu-score&wallet=${fin.winner.w.addr}`)).json();
  ok('champion\'s lifetime Inu Score best raised (max, not a sum)', (inu.parts?.games?.['meme-brawl']?.best || 0) > 0, String(inu.score));
  // client-reported result for a match never played is refused (no seat token -> 403)
  const forged = await fetch(`${KIBBLE}/api/pvp?action=result`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: fin.code, side: 0, tok: 'x'.repeat(32), winner: 0, wins: [2, 0], hp: 1000, ticks: 3600, checksum: 'deadbeef' }) });
  ok('a forged client report is refused', forged.status === 403, String(forged.status));
  const nonAdmin = await fetch(`${KIBBLE}/api/pvp?action=pair`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ws[0].session }, body: JSON.stringify({ allow: [ws[0].addr, ws[1].addr], ctx: { tid: 'x', mid: 'y' } }) });
  ok('only admin / the bracket service can create pairings', nonAdmin.status === 401, String(nonAdmin.status));
  // clips: public list + one full replayable clip
  const clips = await api('action=clips'), clip = await api(`action=clip&id=${fin.code}`);
  ok('clip wall endpoint lists the 3 bracket clips (no inputs, short addresses only)', clips.clips?.length === 3 && clips.clips.every((c) => c.inputs === undefined && /…/.test(c.players[0].short)) && !JSON.stringify(clips).includes(ws[0].addr), `${clips.clips?.length}`);
  ok('full clip has the replay stream', clip.ok && clip.clip.inputs.length > 3 && clip.clip.bracket?.mid === 'r2m1', `${clip.clip?.inputs?.length} change points`);
  out.clipSample = { ...clip.clip, inputs: clip.clip.inputs.slice(0, 6).concat([['…', `${clip.clip.inputs.length} change points total`]]) }; out.clipList = clips;
  // play the clip back in a fresh browser and confirm it reproduces the verified checksum
  const viewer = await (await b.newContext({ viewport: V844, deviceScaleFactor: 2 })).newPage();
  await viewer.goto(URL + `?clip=${fin.code}&kibble=${encodeURIComponent(KIBBLE)}`); await viewer.waitForFunction(() => window.__mb.scr === 'fight' && window.__mb.mode === 'replay', null, { timeout: 15000 });
  await viewer.waitForTimeout(2500); await viewer.screenshot({ path: `${SHOTS}/clip-replay-844x390.png` });
  const rep = await viewer.evaluate(async () => { const m = window.__mb.match; for (let i = 0; i < 1200 && m.phase !== 'matchEnd'; i++) await new Promise((r) => setTimeout(r, 50)); return { tick: m.tick, phase: m.phase, winner: m.matchWinner }; });
  ok('clip replay in the browser reaches the same KO and winner', rep.phase === 'matchEnd' && rep.winner === clip.clip.winner && rep.tick === clip.clip.ticks, JSON.stringify(rep));
  // finished bracket (harness view rendered from the bracket outbox; the real bracket page is the shared one)
  out.bracket = br;
  const s = (a) => `${a.slice(0, 4)}…${a.slice(-4)}`, r = br.results, row = (m, x) => `<div class="m ${x || ''}"><div class="${r[m].winnerWallet === r[m].winnerWallet ? 'w' : ''}">🏆 ${s(r[m].winnerWallet)} <b>${Math.max(...r[m].wins)}</b></div><div class="l">${s(r[m].loserWallet)} <b>${Math.min(...r[m].wins)}</b></div><small>${m} · verified · clip ${r[m].code}</small></div>`;
  const html = `<!doctype html><meta charset=utf-8><style>@font-face{font-family:S;src:url(${URL}fonts/Silkscreen.ttf)}body{margin:0;background:#140c2e;color:#fff6e0;font:12px S,ui-monospace,monospace;display:grid;place-items:center;height:100vh}h1{color:#ffd25a;font-size:18px;margin:0 0 4px;text-align:center}p{margin:0 0 10px;text-align:center;color:#3fb6a8;font-size:10px}.g{display:grid;grid-template-columns:1fr 1fr;gap:10px 28px;align-items:center}.m{background:#121a36;border:2px solid #4a4f8c;border-radius:6px;padding:6px 10px;min-width:210px}.m.f{grid-row:1/3;grid-column:2;border-color:#ffd25a}.m div{display:flex;justify-content:space-between}.l{opacity:.55}small{color:#9ab0d4;font-size:8px}</style><div><h1>MEME BRAWL BRACKET · LOCAL E2E</h1><p>free entry · 4 players · verified ranked 1v1 · cosmetic/Bones rewards only</p><div class=g>${row('r1m1')}${row('r2m1', 'f')}${row('r1m2')}</div><p style="margin-top:10px">harness view of the bracket outbox (shared page: inu-arcade /tournaments)</p></div>`;
  for (const vp of [V844, V667]) { const pg = await (await b.newContext({ viewport: vp, deviceScaleFactor: 2 })).newPage(); await pg.setContent(html); await pg.waitForTimeout(400); await pg.screenshot({ path: `${SHOTS}/finished-bracket-${vp.width}x${vp.height}.png` }); }
  ok('no page errors', P.every((p) => !p.errs.length), P.flatMap((p) => p.errs).join('; '));
} catch (e) { ok('e2e-bracket crashed', false, e.stack); }
out.results = results; fs.writeFileSync(`${SHOTS}/e2e-bracket-results.json`, JSON.stringify(out, null, 1));
await b.close(); srv.close(); dev.kill();
const fails = results.filter((r) => !r.pass).length; console.log(`\n${results.length - fails}/${results.length} passed`); process.exit(fails ? 1 : 0);
