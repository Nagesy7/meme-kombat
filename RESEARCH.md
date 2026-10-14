# Meme Kombat (working title): roster research, 14 Oct 2026 (AEDT)

All data pulled live on 2026-10-14 ~23:55 AEDT (12:55 UTC). Trending lists churn hourly; this is a snapshot.

## Sources queried
| Source | Endpoint | Memecoin hits |
|---|---|---|
| CoinGecko trending | api.coingecko.com/api/v3/search/trending | Pudgy Penguins (PENGU) was the only meme in the top 15 (the rest were L1/infra coins) |
| CoinGecko meme category by 24h volume | /coins/markets?category=meme-token&order=volume_desc | Boomer, Dogecoin, Pepe, Little John, PENGU, Pump.fun, Official Trump, Shiba Inu, dogwifhat, Bonk, Fartcoin, Mubarak (-19%), Niu Lai, Artificial Inu (+22.6%), BOOK OF MEME |
| GeckoTerminal trending pools | api.geckoterminal.com/api/v2/networks/trending_pools | SEALS/SOL, CASHCAT, STONK/SOL, CRAWLER, PENGU/USDC, DOGEBALL (eth), lots of Robinhood-chain tickers |
| DexScreener top boosts | api.dexscreener.com/token-boosts/top/v1 | "Humphrey" reserve meme, Halloween meme, Bumo-chan, Gomo, a Santa token (all small and boosted, so paid placement) |
| pump.fun currently live | frontend-api-v3.pump.fun/coins/currently-live | GIVEBACK (~$8.4M mcap), BULLENCIAGA (~$442k), cat wif rocket, Pump Guys |
| X trends | the X tool namespace was available, but I didn't spend a query; there's no X-verified signal here | n/a |

## Roster (parody names, original pixel art, no logos)
| Fighter | Parody of | Why it's in | Source(s) |
|---|---|---|---|
| President Inu | Zachary's own character (Inu Verse Shiba base) | house character | /workspace/inu-verse/src/sprite.js palette |
| Peepo the Frog | PEPE | #3 meme by 24h volume | CoinGecko meme volume |
| Muchwow | DOGE (the Shiba photo meme) | #2 meme by volume | CoinGecko meme volume |
| Wiffy | dogwifhat (WIF) | top-10 meme by volume | CoinGecko meme volume |
| Bonkus | BONK | top-10 meme by volume | CoinGecko meme volume |
| Pengo | Pudgy Penguins (PENGU) | on CoinGecko trending and GeckoTerminal trending | CG trending + GT trending |
| Toot Lord | Fartcoin | top-11 meme by volume | CoinGecko meme volume |
| Sealbert | SEALS (Solana) | GeckoTerminal trending pool #4 | GeckoTerminal |
| Bullencia | BULLENCIAGA (pump.fun) | top-2 live pump.fun coin by mcap | pump.fun |
| Boomer Bob | Boomer (BOOMER) | #1 meme by 24h volume | CoinGecko meme volume |
| BOSS: Lord Rugsworth | original villain (a rug-pull whale) | arcade boss, not a coin | original |

Left out: Official Trump (a real-person likeness, so a right-of-publicity risk), Mubarak (a real-person/region reference), and the DexScreener boosted coins (paid placement, not organic trend).

## IP sensitivity notes
- **Pepe the Frog**: Matt Furie holds the copyright and has enforced it (for example in 2018-2019 actions). Peepo is a different frog design (round head, no Pepe lip shape, a different green), with no copied artwork. Medium risk. Keep it parody and never use the original comic art.
- **Doge**: the Kabosu photo is copyrighted by Atsuko Sato. Muchwow is our own pixel Shiba (golden coat, side-eye brows). No photo is used. Low-to-medium risk.
- **dogwifhat**: the original photo of Achi in a pink beanie belongs to its owners. We draw an original dog with a knit hat. Low risk.
- **Pudgy Penguins**: an NFT IP owned by Igloo Inc. that is actively licensed and enforced. **Highest commercial risk.** Pengo is a generic penguin; avoid Pudgy's exact proportions and colourways. Consider swapping it out before any commercial launch.
- **BONK, Fartcoin, SEALS, BULLENCIAGA, Boomer**: community memes with no known enforcement. Bullencia avoids any Balenciaga mark or logo; the name is a parody (trademark is a parody-name risk, low).
- **Mortal Kombat**: none of its names, logos, characters or sounds are used. The terms we use are "Rug Pull", "FINISH THE BAG" and "BAG SECURED".
