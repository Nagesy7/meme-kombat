# Meme Brawl (repo working title: meme-kombat)
An original browser 2D versus fighter in vanilla JS canvas. It stars parody homages of the memecoin mascots trending in Oct 2026, plus President Inu. See RESEARCH.md for the roster sources and IP notes.

The in-game title is **Meme Brawl** because the brief bans the word "Kombat". The repo and folder keep the working name.

- Play: https://meme-kombat-mu.vercel.app
- Modes: Arcade (6 rivals + boss Lord Rugsworth), Versus 2P on one keyboard, Ranked (Elo), Skin Shop + Wallet
- Keys: P1 uses WASD to move, F/G to punch (light/heavy), V/B to kick (light/heavy). P2 uses the arrows with K/L/,/. for the same. P pauses, M mutes, Esc goes back.
- Specials (facing right): D,DF,F+P fires a projectile. B,F+K is a rush. D,D+P is a rising launcher. Super is D,DF,F+K with a full meter. Throw is F+HP up close.
- After winning the match: FINISH THE BAG. Enter D,D+HK within 3 s for the fighter's Rug Pull finisher (cartoon, no gore).
- $KIBBLE: real kibble-pay SDK by default (loaded from https://kibble-pay.vercel.app via `inu-games.js`). Until the $KIBBLE mint is set, the shop shows "KIBBLE launching soon" and nothing is charged. Prices are fee-inclusive catalog prices (`meme-brawl:gold` 250, `meme-brawl:neon` 150). Signing in posts ranked wins (wallet-signed, `/api/game?action=score`) to the weekly prize board; your Inu Verse Shiba shows in the shop. **Demo mode (fake balance) only with `?demo=1`**, clearly labelled. Footer links Terms / Prize Rules.
- Tests: `npm test` runs the headless combat logic tests. `npm run e2e` runs Playwright on desktop and iPhone 13 landscape, and screenshots go to proof/.
