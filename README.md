# Meme Brawl
An original browser 2D versus fighter in vanilla JS canvas, set in the Inu Verse. It stars original parody mascots (our own names and pixel art, with no real token names, tickers or logos) plus President Inu. See RESEARCH.md for the roster sources and IP notes.

- Play: https://meme-brawl.vercel.app (the legacy URL https://meme-kombat-mu.vercel.app still serves the same build)
- Modes: Arcade (6 rivals + boss Lord Rugsworth), Versus 2P on one keyboard, **Online 1v1** (quick match, ranked quick match, private room code/link), Practice Ladder vs CPU (local Elo, never counts for prizes), Skin Shop + Wallet.
- Keys: P1 uses WASD to move, F/G to punch (light/heavy), V/B to kick (light/heavy). P2 uses the arrows with K/L/,/. for the same. P pauses (offline only), M mutes, Esc goes back. Phones: on-screen D-pad + LP/HP/LK/HK in landscape.
- Specials (facing right): D,DF,F+P fires a projectile. B,F+K is a rush. D,D+P is a rising launcher. Super is D,DF,F+K with a full meter. Throw is F+HP up close.
- After winning the match: PUNCHLINE TIME. Enter D,D+HK within 3 s for the fighter's cartoon punchline (no gore).

## Online 1v1
- Matchmaking + signaling: kibble-pay `/api/pvp` (Vercel function + Upstash Redis). Quick match pairs the next two players in the casual or ranked queue; a private room gives a 6-character code and a share link `https://meme-brawl.vercel.app/?room=CODE`.
- Transport: WebRTC data channel (STUN only). If a direct connection is not up within 7 s, both sides fall back to the HTTP relay through the same endpoint. `?relay=1` forces the relay.
- Netcode: deterministic fixed-tick (60 Hz) lockstep (`src/netcode.js`). Input delay is 4 ticks on WebRTC and 10 on the relay. Each player's inputs are scheduled ahead and the simulation only advances when both inputs for a tick are known. An FNV state checksum is exchanged every 60 ticks, and a mismatch voids the match ("NO CONTEST").
- Disconnects: if the opponent goes silent for 10 s (or closes the tab), the remaining player wins by forfeit. Forfeits are not ranked.
- Ranked: both players must be signed in with their wallet (kibble-pay SIWS). Each client reports the deterministic result (winner, rounds, HP, ticks, final checksum). The server records the win only when both reports agree. It also checks that the match was not faster than real time, that the two wallets are distinct, and it allows at most 3 ranked results per wallet pair per day, plus the per-wallet score limits. Verified ranked PvP wins post server-side to the `meme-brawl` prize board (`/api/game`). Wins against the computer never count: the API refuses client-submitted `meme-brawl` scores.
- **No wagering of any kind.** There is no betting, no stakes, no entry fees and no spectator betting. Prize pools are funded from shop revenue and paid by rank (see Prize Rules).

## $KIBBLE
The game uses the real kibble-pay SDK by default (loaded from https://kibble-pay.vercel.app via `inu-games.js`). Until the $KIBBLE mint is set, the shop shows "KIBBLE launching soon" and nothing is charged. Catalog ids are `meme-brawl:gold` (250) and `meme-brawl:neon` (150). **Demo mode (fake balance) only runs with `?demo=1`**, clearly labelled. The footer links Terms and Prize Rules.

## Tests
- `npm test`: combat logic, netcode determinism (two simulated peers over a laggy, jittery link), and the rename audit (fails on any banned franchise term or real-token brand string).
- `npm run e2e`: single-player Playwright run (desktop + iPhone 13 landscape).
- `npm run e2e:online`: two browser contexts play real online matches. Scenarios: a desktop private room over WebRTC, a desktop ranked quick match with two SIWS-signed wallets (verified win reaches the prize board), an iPhone 13 landscape touch match over the relay, and disconnect to forfeit. It runs the kibble-pay dev server (`/workspace/kibble-pay/scripts/dev-server.mjs`, in-memory store) unless `KIBBLE=<url>` is set. Screenshots go to `proof/online-*.png` and results to `proof/e2e-online-results.json`.

The GitHub repo (`Nagesy7/meme-kombat`) and the box folder keep the legacy working slug so the Vercel project link and other tooling keep working; the product name is Meme Brawl everywhere.
