// $KIBBLE hooks: real kibble-pay adapter by default ($KIBBLE is live);
// SimWallet + local ledger ONLY with ?demo=1. Elo ladder vs AI rivals is local; ranked wins post a wallet-signed score.
export const TREASURY = 'BzLYTFAfUsjzQ5x8bx5BbPK4DFtaHrLCuferkvkxTNGJ';
export const DECIMALS = 6;
export const FEE_BPS = { treasury: 100, daily: 25, weekly: 50, monthly: 25 }; // 2% total: 1% treasury, 0.25/0.5/0.25% pools
export const HOLDER_MIN = 1000n * 10n ** 6n; // hold >= 1000 KIBBLE -> alt costumes (cosmetic only)

export function computeFees(price, bps = FEE_BPS) { // identical maths to kibble-pay/public/lib/split.js
  const p = BigInt(price); if (p <= 0n) throw new Error('price must be > 0 base units');
  const out = {}; for (const k of ['treasury', 'daily', 'weekly', 'monthly']) out[k] = (p * BigInt(bps[k])) / 10000n;
  out.fee = out.treasury + out.daily + out.weekly + out.monthly; out.retained = p - out.daily - out.weekly - out.monthly; return out;
}
export const toBase = (ui) => BigInt(Math.round(Number(ui) * 1e6));
export const fromBase = (u) => Number(BigInt(u)) / 1e6;

// ---- Elo ----
export const expected = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));
export function elo(ra, rb, scoreA, k = 32) { const ea = expected(ra, rb); return [Math.round(ra + k * (scoreA - ea)), Math.round(rb + k * ((1 - scoreA) - (1 - ea)))]; }
// Prize pools paid by final rank: fixed shares, no random draws, no paid entry.
export const PRIZE_SHARES = [0.40, 0.25, 0.15, 0.05, 0.05, 0.04, 0.03, 0.01, 0.01, 0.01];
export function prizeFor(rank, pool) { return rank >= 1 && rank <= PRIZE_SHARES.length ? Math.floor(pool * PRIZE_SHARES[rank - 1]) : 0; }

export const SHOP = [
  { id: 'gold', name: 'Gold Bag skin', price: 2500000, desc: 'Gold suit for any fighter' },
  { id: 'neon', name: 'Neon Degen skin', price: 1500000, desc: 'Hot-pink + cyan fit' },
];
const RIVALS = ['DiamondPaws', 'RugSniffer', 'ApeLord', 'MoonBoi', 'WenLambo', 'GasGuzzler', 'HODLmom', 'SatoshiPup', 'ExitLiq', 'BagHolder', 'PumpPrincess', 'CandleChad', 'FloorSweeper', 'NGMIbro', 'DegenDave'];
export function rivals() { return RIVALS.map((n, i) => ({ name: n, rating: 1720 - i * 42, char: i })); }

// ---- wallet adapters ----
const LS = typeof localStorage !== 'undefined' ? localStorage : { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); } };
const load = (k, d) => { try { return JSON.parse(LS.getItem('mb.' + k)) ?? d; } catch { return d; } };
const save = (k, v) => LS.setItem('mb.' + k, JSON.stringify(v));

export class SimWallet { // same surface as kibblePay: connect / balance / buy / burn / inventory
  constructor() { this.simulated = true; this.address = load('addr', null); }
  async connect() { if (!this.address) { const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; this.address = 'SiM' + Array.from({ length: 41 }, () => A[Math.floor(Math.random() * 58)]).join(''); save('addr', this.address); save('bal', '25000000000000'); } return this.address; }
  async disconnect() { this.address = null; save('addr', null); }
  async balance() { const u = BigInt(load('bal', '0')); return { units: u, ui: (Number(u) / 1e6).toString(), symbol: 'KIBBLE' }; }
  async buy({ itemId }) {
    if (!this.address) return { ok: false, error: 'Connect wallet first' };
    const p = toBase(SHOP.find((x) => x.id === itemId)?.price ?? 0), bal = BigInt(load('bal', '0')); if (bal < p) return { ok: false, error: 'Not enough KIBBLE' };
    save('bal', (bal - p).toString()); const f = computeFees(p); const L = load('ledger', { treasury: '0', daily: '0', weekly: '0', monthly: '0' });
    for (const k of ['treasury', 'daily', 'weekly', 'monthly']) L[k] = (BigInt(L[k]) + f[k]).toString(); save('ledger', L);
    const inv = load('inv', []); if (!inv.includes(itemId)) inv.push(itemId); save('inv', inv);
    return { ok: true, signature: 'sim_' + Date.now().toString(36), orderId: 'ord_' + itemId, fees: f, to: TREASURY };
  }
  async burn(amount) { const p = toBase(amount), bal = BigInt(load('bal', '0')); if (bal < p) return { ok: false, error: 'Not enough KIBBLE' }; save('bal', (bal - p).toString()); save('burned', (BigInt(load('burned', '0')) + p).toString()); return { ok: true, signature: 'simburn_' + Date.now().toString(36) }; }
  async inventory() { return load('inv', []); }
}
export const GAME = 'meme-brawl';
export const SOON_MSG = 'KIBBLE is live, but the wallet service is unreachable right now. Try again shortly.';
export class KibblePayAdapter { // wraps the shared SDK (https://kibble-pay.vercel.app/kibble-pay.js). Catalog ids: meme-brawl:<id>, fee-inclusive.
  constructor(sdk) { this.k = sdk; this.simulated = false; }
  get live() { return !!this.k.cfg?.provisioned; }
  get address() { return this.k.address; }
  async connect() { await this.k.connect(); await this.k.signIn(); return this.k.address; }
  async disconnect() { await this.k.disconnect(); }
  async balance() { return this.live ? this.k.balance() : { units: 0n, ui: '0', symbol: 'KIBBLE', soon: true }; }
  async buy({ itemId }) { if (!this.live) return { ok: false, error: SOON_MSG }; return this.k.buy({ itemId: GAME + ':' + itemId, game: GAME }); }
  async burn(amount, itemId) { if (!this.live) return { ok: false, error: SOON_MSG }; return this.k.burn(String(amount), { itemId, game: GAME }); }
  async inventory() { const inv = (await this.k.inventory(GAME))?.[GAME] || {}; return Object.keys(inv).filter((k) => inv[k] > 0 && k.startsWith(GAME + ':')).map((k) => k.slice(GAME.length + 1)); }
  async submitScore(score, durationMs) { return this.k.submitScore(GAME, score, durationMs); }
}
export const DEMO = typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1';
// Demo (fake balance) ONLY with ?demo=1. Otherwise the real kibblePay adapter; if kibble-pay is unreachable, buys show SOON_MSG.
export let wallet = DEMO ? new SimWallet() : { simulated: false, address: null, live: false, async connect() { throw new Error('Wallet still loading, try again'); }, async balance() { return { units: 0n, ui: '0', soon: true }; }, async buy() { return { ok: false, error: SOON_MSG }; }, async burn() { return { ok: false, error: SOON_MSG }; }, async inventory() { return []; } };
export let mode = DEMO ? 'demo' : 'loading';
export let serverPools = null, serverBoard = null;
export let walletUi = null;
export async function initKibble(apiBase = 'https://kibble-pay.vercel.app') {
  const glue = glueMod = await import(apiBase + '/inu-games.js');
  const K = await glue.initKibble({ game: GAME, apiBase }); mode = K.mode; glue.mountFooter(K.mode);
  // Connect Wallet (title + in-game): practice ladder rating saved to the wallet; holder alts read the real on-chain balance.
  if (K.kp) walletUi = glue.mountWallet(K, { game: GAME, keys: ['mb.rank'], position: 'top-right',
    progress: (g) => { try { const r = JSON.parse(g('mb.rank') || 'null'); return r ? (r.w || 0) * 10 + (r.l || 0) : 0; } catch { return 0; } },
    label: (g) => { try { const r = JSON.parse(g('mb.rank') || 'null'); return r ? `Elo ${r.rating} · ${r.w}W ${r.l}L` : ''; } catch { return ''; } },
    onWallet: (w) => { try { dispatchEvent(new CustomEvent('mb:wallet', { detail: w })); } catch {} } });
  if (K.kp) { wallet = new KibblePayAdapter(K.kp); refreshServer(K.kp).catch(() => {}); }
  return K;
}
export let shiba = null; // shared Inu Verse Shiba (profile) for the signed-in wallet
let glueMod = null;
export async function loadShiba() { if (!glueMod || !wallet.address || wallet.simulated) return null; shiba = await glueMod.loadShiba(wallet.address); return shiba; }
export async function refreshServer(kp = wallet.k) { if (!kp) return; serverPools = (await kp.pools()).pools; serverBoard = (await kp.scores(GAME, 'weekly')).entries; }
export async function useKibblePay(apiBase) { const mod = await import(apiBase.replace(/\/$/, '') + '/kibble-pay.js'); await mod.kibblePay.init({ apiBase, game: GAME }); wallet = new KibblePayAdapter(mod.kibblePay); mode = mod.kibblePay.cfg.provisioned ? 'live' : 'soon'; return wallet; }
// ranked-win score (single match performance): 1000 + HP left (0..1000) + 500 for a flawless 2-0
export const matchScore = (m) => { const f = m.f[0]; return 1000 + Math.round(1000 * Math.max(0, f.hp) / f.maxHp) + (m.wins[1] === 0 ? 500 : 0); };
export async function isHolder() { if (!wallet.address) return false; try { return BigInt((await wallet.balance()).units) >= HOLDER_MIN; } catch { return false; } }
export const ledger = () => load('ledger', { treasury: '0', daily: '0', weekly: '0', monthly: '0' });

// ---- ranked profile ----
export function profile() { return load('rank', { rating: 1200, w: 0, l: 0 }); }
export function recordRanked(oppRating, won) { const p = profile(); const [r] = elo(p.rating, oppRating, won ? 1 : 0); p.rating = r; won ? p.w++ : p.l++; save('rank', p); return p; }
export function leaderboard() { const p = profile(); return [...rivals(), { name: 'YOU', rating: p.rating, you: true }].sort((a, b) => b.rating - a.rating).map((e, i) => ({ ...e, rank: i + 1 })); }
// Pools: demo = local sim ledger; otherwise the real server ledger (/api/game?action=pools). No invented seed amounts.
export function poolsUi() { if (mode === 'demo') { const L = ledger(); return Object.fromEntries(['daily', 'weekly', 'monthly'].map((k) => [k, fromBase(L[k])])); } return Object.fromEntries(['daily', 'weekly', 'monthly'].map((k) => [k, serverPools ? fromBase(serverPools[k].accruedBaseUnits) : 0])); }
