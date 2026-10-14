// Simulated $KIBBLE hooks (matches /workspace/kibble-pay): fee split, wallet adapter, holder perks, Elo ranked ladder.
// Everything here is SIMULATED unless a real kibblePay SDK is attached via useKibblePay().
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
  { id: 'gold', name: 'Gold Bag skin', price: 250, desc: 'Gold suit for any fighter' },
  { id: 'neon', name: 'Neon Degen skin', price: 150, desc: 'Hot-pink + cyan fit' },
];
const RIVALS = ['DiamondPaws', 'RugSniffer', 'ApeLord', 'MoonBoi', 'WenLambo', 'GasGuzzler', 'HODLmom', 'SatoshiPup', 'ExitLiq', 'BagHolder', 'PumpPrincess', 'CandleChad', 'FloorSweeper', 'NGMIbro', 'DegenDave'];
export function rivals() { return RIVALS.map((n, i) => ({ name: n, rating: 1720 - i * 42, char: i })); }

// ---- wallet adapters ----
const LS = typeof localStorage !== 'undefined' ? localStorage : { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); } };
const load = (k, d) => { try { return JSON.parse(LS.getItem('mb.' + k)) ?? d; } catch { return d; } };
const save = (k, v) => LS.setItem('mb.' + k, JSON.stringify(v));

export class SimWallet { // same surface as kibblePay: connect / balance / buy / burn / inventory
  constructor() { this.simulated = true; this.address = load('addr', null); }
  async connect() { if (!this.address) { const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; this.address = 'SiM' + Array.from({ length: 41 }, () => A[Math.floor(Math.random() * 58)]).join(''); save('addr', this.address); save('bal', '2500000000'); } return this.address; }
  async disconnect() { this.address = null; save('addr', null); }
  async balance() { const u = BigInt(load('bal', '0')); return { units: u, ui: (Number(u) / 1e6).toString(), symbol: 'KIBBLE' }; }
  async buy({ itemId, price }) {
    if (!this.address) return { ok: false, error: 'Connect wallet first' };
    const p = toBase(price), bal = BigInt(load('bal', '0')); if (bal < p) return { ok: false, error: 'Not enough KIBBLE' };
    save('bal', (bal - p).toString()); const f = computeFees(p); const L = load('ledger', { treasury: '0', daily: '0', weekly: '0', monthly: '0' });
    for (const k of ['treasury', 'daily', 'weekly', 'monthly']) L[k] = (BigInt(L[k]) + f[k]).toString(); save('ledger', L);
    const inv = load('inv', []); if (!inv.includes(itemId)) inv.push(itemId); save('inv', inv);
    return { ok: true, signature: 'sim_' + Date.now().toString(36), orderId: 'ord_' + itemId, fees: f, to: TREASURY };
  }
  async burn(amount) { const p = toBase(amount), bal = BigInt(load('bal', '0')); if (bal < p) return { ok: false, error: 'Not enough KIBBLE' }; save('bal', (bal - p).toString()); save('burned', (BigInt(load('burned', '0')) + p).toString()); return { ok: true, signature: 'simburn_' + Date.now().toString(36) }; }
  async inventory() { return load('inv', []); }
}
export class KibblePayAdapter { // wraps the shared SDK from /workspace/kibble-pay/public/kibble-pay.js
  constructor(sdk) { this.k = sdk; this.simulated = false; }
  get address() { return this.k.address; }
  async connect() { await this.k.connect(); await this.k.signIn(); return this.k.address; }
  async balance() { return this.k.balance(); }
  async buy({ itemId, price }) { return this.k.buy({ itemId: 'meme-brawl-' + itemId, price: String(price), game: 'meme-brawl' }); }
  async burn(amount) { return this.k.burn(String(amount)); }
  async inventory() { return (await this.k.inventory('meme-brawl')).map((i) => String(i.itemId || i).replace('meme-brawl-', '')); }
}
export let wallet = new SimWallet();
export async function useKibblePay(apiBase) { const mod = await import(apiBase.replace(/\/$/, '') + '/kibble-pay.js'); await mod.kibblePay.init({ apiBase, game: 'meme-brawl' }); wallet = new KibblePayAdapter(mod.kibblePay); return wallet; }
export async function isHolder() { if (!wallet.address) return false; return (await wallet.balance()).units >= HOLDER_MIN; }
export const ledger = () => load('ledger', { treasury: '0', daily: '0', weekly: '0', monthly: '0' });

// ---- ranked profile ----
export function profile() { return load('rank', { rating: 1200, w: 0, l: 0 }); }
export function recordRanked(oppRating, won) { const p = profile(); const [r] = elo(p.rating, oppRating, won ? 1 : 0); p.rating = r; won ? p.w++ : p.l++; save('rank', p); return p; }
export function leaderboard() { const p = profile(); return [...rivals(), { name: 'YOU', rating: p.rating, you: true }].sort((a, b) => b.rating - a.rating).map((e, i) => ({ ...e, rank: i + 1 })); }
export function poolsUi() { const L = ledger(), seed = { daily: 5000, weekly: 20000, monthly: 60000 }; return Object.fromEntries(Object.entries(seed).map(([k, v]) => [k, v + fromBase(L[k])])); }
