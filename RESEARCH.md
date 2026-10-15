# Meme Brawl: roster research, 14 Oct 2026 (AEDT)

All data pulled live on 2026-10-14 ~23:55 AEDT (12:55 UTC). Trending lists churn hourly; this is a snapshot.

## Sources queried
| Source | Endpoint | Memecoin hits |
|---|---|---|
| CoinGecko trending | api.coingecko.com/api/v3/search/trending | a penguin NFT-brand coin was the only meme in the top 15 (the rest were L1/infra coins) |
| CoinGecko meme category by 24h volume | /coins/markets?category=meme-token&order=volume_desc | Boomer, Dogecoin, Pepe, Little John, (penguin NFT coin), Pump.fun, Official Trump, Shiba Inu, dogwifhat, Bonk, Fartcoin, Mubarak (-19%), Niu Lai, Artificial Inu (+22.6%), BOOK OF MEME |
| GeckoTerminal trending pools | api.geckoterminal.com/api/v2/networks/trending_pools | SEALS/SOL, CASHCAT, STONK/SOL, CRAWLER, (penguin)/USDC, DOGEBALL (eth), lots of Robinhood-chain tickers |
| DexScreener top boosts | api.dexscreener.com/token-boosts/top/v1 | "Humphrey" reserve meme, Halloween meme, Bumo-chan, Gomo, a Santa token (all small and boosted, so paid placement) |
| pump.fun currently live | frontend-api-v3.pump.fun/coins/currently-live | GIVEBACK (~$8.4M mcap), a fashion-bull parody coin (~$442k), cat wif rocket, Pump Guys |
| X trends | the X tool namespace was available, but I didn't spend a query; there's no X-verified signal here | n/a |

## Roster (parody names, original pixel art, no logos)
| Fighter | Parody of | Why it's in | Source(s) |
|---|---|---|---|
| President Inu | Zachary's own character (Inu Verse Shiba base) | house character | /workspace/inu-verse/src/sprite.js palette |
| Croakley (was Peepo the Frog) | PEPE | #3 meme by 24h volume | CoinGecko meme volume |
| Muchwow | DOGE (the Shiba photo meme) | #2 meme by volume | CoinGecko meme volume |
| Wiffy | dogwifhat (WIF) | top-10 meme by volume | CoinGecko meme volume |
| Bonkus | BONK | top-10 meme by volume | CoinGecko meme volume |
| Moneymew | CASHCAT (a generic cash cat meme on Robinhood chain) | GeckoTerminal trending pool #7 on 14 Oct, still #7 when re-checked 15 Oct 00:20 AEDT | GeckoTerminal |
| Toot Lord | Fartcoin | top-11 meme by volume | CoinGecko meme volume |
| Sealbert | SEALS (Solana) | GeckoTerminal trending pool #4 | GeckoTerminal |
| Stampy (was Bullencia) | a pump.fun fashion-bull coin | top-2 live pump.fun coin by mcap | pump.fun |
| Boomer Bob | Boomer (BOOMER) | #1 meme by 24h volume | CoinGecko meme volume |
| BOSS: Lord Rugsworth | original villain (a rug-pull whale) | arcade boss, not a coin | original |

Left out: the penguin NFT-brand coin (enforced NFT IP, swapped out for Moneymew), Official Trump (a real-person likeness, so a right-of-publicity risk), Mubarak (a real-person/region reference), and the DexScreener boosted coins (paid placement, not organic trend).

## IP sensitivity notes
- **Pepe the Frog**: Matt Furie holds the copyright and has enforced it (for example in 2018-2019 actions). Peepo is a different frog design (round head, no Pepe lip shape, a different green), with no copied artwork. Medium risk. Keep it parody and never use the original comic art.
- **Doge**: the Kabosu photo is copyrighted by Atsuko Sato. Muchwow is our own pixel Shiba (golden coat, side-eye brows). No photo is used. Low-to-medium risk.
- **dogwifhat**: the original photo of Achi in a pink beanie belongs to its owners. We draw an original dog with a knit hat. Low risk.
- **Penguin NFT-brand coin**: its owner actively licenses and enforces this IP, so our penguin parody was **removed** on 15 Oct 2026 (approved by Zachary).
- **Moneymew (replacement)**: parodies CASHCAT, a small anonymous community coin with no known brand owner, no real person and no enforcement history. The art is an original lilac-grey tabby with a mint jacket, a gold chain and green eyes, and it doesn't copy the token's logo. Low risk.
- **BONK, Fartcoin, SEALS, the fashion-bull coin, Boomer, CASHCAT**: community memes with no known enforcement. Stampy (renamed from Bullencia on 15 Oct 2026) avoids any fashion-house name, mark or logo.
- **Classic arcade fighting franchises**: no names, logos, characters, move names, announcer lines or sounds are used. Our own terms: "PUNCHLINE TIME" (finisher window), cartoon punchlines, "BAG SECURED", "PERFECT HODL".

## Rename + IP audit (15 Oct 2026)
- Product renamed from the working title to **Meme Brawl** everywhere (UI, package name, page title, share card, docs). Code helpers `mkMatch/mkFighter/mkRng` became `makeMatch/makeFighter/makeRng`.
- On-screen tickers and source lines (e.g. "PEPE-ish (CoinGecko ...)") were replaced with original parody tags ("Feels frog", "Side-eye pup", ...). Peepo the Frog became Croakley (Peepo is an existing Pepe-derived meme name), Bullencia became Stampy (a fashion-house pun), and Wif Storm became Beanie Blizzard. Sprite head keys `doge`/`wif` became `wowdog`/`hatdog`.
- `tests/rename-audit.test.js` fails the build on any banned franchise term or real-token brand string in shipped files.
