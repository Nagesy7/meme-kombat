// Shop / For devs links: exact copy, URLs, banned words, wallet-free analytics, once-per-session nudge rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COPY, SHOP_URL, DEVS_URL, BANNED, NUDGE_KEY, NUDGE_SCREENS, NUDGE_MODES, paidLinkEvent, trackPaid, nudgeSeen, markNudge, shouldNudge, openLink, _resetNudgeMemory } from '../src/shoplinks.js';

const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('links exist with the exact spec copy and URLs, and the game wires them in', () => {
  assert.equal(COPY.shop, '🛍️ Shop');
  assert.equal(COPY.shopTitle, 'Optional cosmetics. $KIBBLE is never needed to play.');
  assert.equal(COPY.devs, '🛠️ For devs');
  assert.equal(COPY.nudge, 'Like your look? Outfits, pets and cars for every Inu game are in the Kibble Pay shop. Optional, and never needed to play.');
  assert.equal(COPY.visit, 'Visit the shop →'); assert.equal(COPY.notNow, 'Not now');
  assert.equal(SHOP_URL, 'https://kibbleinu.com/pay?utm_source=meme-brawl&utm_medium=menu#shop-h');
  assert.equal(DEVS_URL, 'https://kibbleinu.com/for-devs.html?utm_source=meme-brawl&utm_medium=menu');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const s of ['drawShopLinks()', "shopLink('shop', 'menu')", "shopLink('for-devs', 'menu')", "shopLink('shop', 'results')", 'drawNudge()', 'shouldNudge(']) assert.ok(main.includes(s), s);
});

test('copy has no banned words (urgency, prize, price promises)', () => {
  for (const [k, v] of Object.entries(COPY)) assert.ok(!BANNED.test(v), `${k}: ${v}`);
  for (const w of ['hurry', 'Limited', 'last chance', "don't miss", 'guarantee', 'MOON', 'profit', 'prize']) assert.ok(BANNED.test(`x ${w} y`), w);
  assert.match(COPY.shopTitle, /never needed to play/); assert.match(COPY.nudge, /never needed to play/);
});

test('paid_link_click events carry product, from and site only: no wallet, mint, name or score', () => {
  const calls = [], va = (...a) => calls.push(a);
  for (const [p, w] of [['shop', 'menu'], ['for-devs', 'menu'], ['shop', 'results']]) trackPaid(va, p, w);
  assert.deepEqual(calls.map((c) => c[1]), [
    { name: 'paid_link_click', data: { product: 'shop', from: 'meme-brawl-menu', site: 'meme-brawl' } },
    { name: 'paid_link_click', data: { product: 'for-devs', from: 'meme-brawl-menu', site: 'meme-brawl' } },
    { name: 'paid_link_click', data: { product: 'shop', from: 'meme-brawl-results', site: 'meme-brawl' } }]);
  for (const [kind, ev] of calls) { assert.equal(kind, 'event'); assert.deepEqual(Object.keys(ev.data).sort(), ['from', 'product', 'site']);
    const flat = JSON.stringify(ev); assert.ok(!/wallet|mint|score|address|pubkey|elo|rating|player/i.test(flat), flat); assert.ok(!/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(flat), 'no base58 address'); }
  assert.throws(() => paidLinkEvent('shop', 'Ab12wallet')); assert.throws(() => paidLinkEvent('mint', 'menu'));
  assert.doesNotThrow(() => trackPaid(undefined, 'shop', 'menu')); assert.doesNotThrow(() => trackPaid(() => { throw new Error('blocked'); }, 'shop', 'menu'));
});

test('results nudge: casual/CPU results only, never online, trainer or mid-fight, at most once per session', () => {
  _resetNudgeMemory(); const ss = store();
  assert.deepEqual(NUDGE_SCREENS, ['gameover', 'ladder', 'ending', 'rankres']); assert.ok(!NUDGE_MODES.includes('online') && !NUDGE_MODES.includes('trainer'));
  assert.equal(shouldNudge({ from: 'fight', to: 'onlineres', mode: 'online', ss }), false);
  assert.equal(shouldNudge({ from: 'fight', to: 'menu', mode: 'trainer', ss }), false);
  assert.equal(shouldNudge({ from: 'select', to: 'ladder', mode: 'arcade', ss }), false, 'the pre-fight ladder screen is not a result');
  assert.equal(shouldNudge({ from: 'versus', to: 'fight', mode: 'arcade', ss }), false, 'never mid-fight');
  for (const [to, mode] of [['gameover', 'arcade'], ['ladder', 'arcade'], ['ending', 'arcade'], ['rankres', 'ranked'], ['gameover', 'versus']]) assert.equal(shouldNudge({ from: 'fight', to, mode, ss }), true, `${mode}/${to}`);
  markNudge(ss); assert.equal(ss.getItem(NUDGE_KEY), '1'); assert.equal(NUDGE_KEY, 'inu.shopNudge');
  assert.equal(shouldNudge({ from: 'fight', to: 'gameover', mode: 'arcade', ss }), false, 'once per session');
  _resetNudgeMemory(); assert.equal(nudgeSeen(ss), true, 'sessionStorage remembers it');
  _resetNudgeMemory(); const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(shouldNudge({ from: 'fight', to: 'gameover', mode: 'arcade', ss: bad }), true); markNudge(bad);
  assert.equal(shouldNudge({ from: 'fight', to: 'gameover', mode: 'arcade', ss: bad }), false, 'blocked storage still once per page session');
  _resetNudgeMemory();
});

test('openLink opens a new tab without opener, or navigates if the popup is blocked', () => {
  const tab = {}, w1 = { open: (u, t) => { w1.args = [u, t]; return tab; } }; assert.equal(openLink(w1, SHOP_URL), 'tab'); assert.deepEqual(w1.args, [SHOP_URL, '_blank']); assert.equal(tab.opener, null);
  const w2 = { open: () => null, location: { assign: (u) => (w2.went = u) } }; assert.equal(openLink(w2, DEVS_URL), 'same-tab'); assert.equal(w2.went, DEVS_URL);
});
