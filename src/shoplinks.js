// Shop / For devs links (Inu games shared pattern). Pure + testable: no DOM; storage, va and window are injected.
// Copy is word for word from the spec. $KIBBLE is never needed to play. Analytics carry no wallet, mint, name or score.
export const SITE = 'meme-brawl';
export const SHOP_URL = 'https://kibbleinu.com/pay?utm_source=meme-brawl&utm_medium=menu#shop-h';
export const DEVS_URL = 'https://kibbleinu.com/for-devs.html?utm_source=meme-brawl&utm_medium=menu';
export const COPY = Object.freeze({
  shop: '🛍️ Shop',
  shopTitle: 'Optional cosmetics. $KIBBLE is never needed to play.',
  devs: '🛠️ For devs',
  nudge: 'Like your look? Outfits, pets and cars for every Inu game are in the Kibble Pay shop. Optional, and never needed to play.',
  visit: 'Visit the shop →',
  notNow: 'Not now',
});
export const BANNED = /hurry|limited|last chance|don't miss|guarantee|moon|profit|prize/i;
export const NUDGE_KEY = 'inu.shopNudge';
// Post-fight result screens that may show the nudge: CPU arcade (ladder / game over / ending), practice ladder vs CPU,
// and local VERSUS 2P. Never online (rematch / ranked prize flow), never the trainer, never mid-fight.
export const NUDGE_SCREENS = ['gameover', 'ladder', 'ending', 'rankres'];
export const NUDGE_MODES = ['arcade', 'ranked', 'versus'];

export function paidLinkEvent(product, where) {
  if (product !== 'shop' && product !== 'for-devs') throw new Error('bad product');
  if (where !== 'menu' && where !== 'results') throw new Error('bad source');
  return { name: 'paid_link_click', data: { product, from: `${SITE}-${where}`, site: SITE } };
}
export function trackPaid(va, product, where) { const ev = paidLinkEvent(product, where); try { if (typeof va === 'function') va('event', ev); } catch {} return ev; }

let memSeen = false; // fallback when sessionStorage is blocked: still at most once per page session
export function nudgeSeen(ss) { if (memSeen) return true; try { return !!ss?.getItem(NUDGE_KEY); } catch { return false; } }
export function markNudge(ss) { memSeen = true; try { ss?.setItem(NUDGE_KEY, '1'); } catch {} }
export function _resetNudgeMemory() { memSeen = false; }
export function shouldNudge({ from, to, mode, ss }) { return from === 'fight' && NUDGE_SCREENS.includes(to) && NUDGE_MODES.includes(mode) && !nudgeSeen(ss); }

// Opens in a new tab; if the browser blocks the popup (e.g. a controller press is not a user gesture), navigate instead.
export function openLink(win, url) { let w = null; try { w = win.open(url, '_blank'); } catch {} if (w) { try { w.opener = null; } catch {} return 'tab'; } try { win.location.assign(url); } catch {} return 'same-tab'; }
