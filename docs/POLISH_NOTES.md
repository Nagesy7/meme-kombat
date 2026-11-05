# Combat polish notes: phone landscape vs CPU (2026-10-15)

Played with headless Playwright, iPhone 13 landscape emulation (844x390, touch, CDP multi-touch).
Screenshots: /workspace/meme-brawl-shots/ (`before-*` = pre-fix, `after-*` = post-fix).

## Findings
| Area | Finding | Status |
|---|---|---|
| Combo timing | **No input buffer.** A press only counted on the exact frame the fighter was actionable; taps in recovery or hitstop were dropped (step() returned before reading input). Touch taps are short, so LP→LP never linked at any tap gap from 60 to 160 ms (always 40 dmg). | **Fixed**: an 8-tick press buffer that also latches presses during hitstop. After the fix, LP→LP lands at 90/120/160 ms gaps (75 dmg). Test: `tests/input-buffer.test.js` |
| CPU fairness | The CPU rolled "block?" **every frame** while you were attacking, with zero reaction time. At high levels it blocked on frame 1 of your startup almost every time (about 98% at lvl 0.8 over 3 startup frames). It reads as input-reading. | **Fixed**: one roll per incoming action, plus a reaction delay of 10-7·level ticks (≈4-7f). Fast jabs can now beat a high-level CPU; heavies still get blocked. |
| Hit feedback | Hitstop (5f light/8f heavy/4f block), white flash, particle ring, screen shake (3/8/14) and WebAudio hit SFX are all present and read well. There was no haptic feedback on phones. | **Fixed**: `navigator.vibrate` on hit/block/KO when touch controls are active (Android; iOS ignores it) |
| Touch controls size | D-pad is 137 px and buttons are 62 px at 390 px tall, so both are fine. The buttons overlap the right edge of the stage a little, and the D-pad covers the bottom-left corner; fighters still stay visible. | OK |
| Multi-touch | Holding the D-pad while tapping LP works (CDP 2-point touch: walked and attacked). | OK |
| Scroll/zoom | `touch-action:none`, a `touchmove` preventDefault, and preventDefault on gesturestart/dblclick are in place. scrollX/Y stayed at 0 and visualViewport.scale stayed at 1 after play. | OK |
| Buttons release on `pointerleave` | If a thumb slides off a button it releases, which can drop a held input. That's minor because attacks are edge-triggered. | Left |
| Input latency | 60 Hz fixed step and input sampled per tick, so latency is about 1-2 frames plus display. No issue was measurable headless. | OK |
| CPU difficulty curve | Arcade is 0.35 + 0.09·stage. Stage 1 CPU avoided 2/10 point-blank jabs, which is fair. The CPU does nothing while executing a queued sequence (can't block mid-seq), so it can be exploited by baiting. | Left |
| HUD | A small pale square renders below the P2 health bar next to the portrait (see `before-04-hit.png`), source unclear. | Left (needs investigation; may be rename/online work in progress) |
| Combo scaling | It drops 12% per hit (floor 35%), and juggles are capped at 4. That seems reasonable. | OK |

# Touch layout v2: stick + jump (branch `feat/stick-controls`, preview only, 2026-10-18)

Zachary's call: once adopted this is the **only** touch layout (no toggle, no URL param, no localStorage). The old D-pad and 2x2 buttons are removed on this branch. Production keeps the old layout until it's approved and merged.

- **Left thumb: compact floating stick.** Base `clamp(84px, 24vmin, 104px)`, semi-transparent (55%, 90% while held), anchored bottom-left. A touch anywhere in the bottom-left zone (44vw x 76vh, fights only, so menu taps on the canvas still work) floats the base under the thumb. The knob travel is 62% of the base radius, the dead zone is 28% of that, and there are 8 equal 45° sectors (sin 22.5° = 0.38), so diagonals are as easy as cardinals. When the thumb slides past the rim the base follows, so direction is kept, never dropped.
- **Right thumb: JUMP** `clamp(72px, 21vmin, 88px)`, in the bottom-right corner. Its hit area extends 40px into the screen corner, so it's hittable without looking. LP/HP/LK/HK (`clamp(46px, 13vmin, 58px)`) sit on an arc around it (0°, 33°, 66°, 99°, from left of JUMP to above it), with at least 8px gaps. Specials stay stick motions plus an attack button.
- **True multi-touch.** Each pointerId owns one control (`PointerRoles`). Moves and ends are matched by id on `window`, buttons use pointer capture, and `pointercancel`, blur and hidden tabs release everything. Stick held right plus JUMP gives a diagonal jump, and lifting either finger leaves the other untouched.
- **One input format.** `src/touchinput.js` `mergePad()` outputs exactly the keyboard pad (`{u,d,l,r,lp,hp,lk,hk}` = 1). JUMP is just `u`, so CPU, local and online lockstep (`netcode.encode`, 8 bits) are unchanged. Tests: `tests/touchinput.test.js` (format + encode round-trip, sectors, dead zone, per-pointer roles) and `scripts/e2e-stick.mjs` (two real simultaneous CDP touch pointers at 667x375, 750x342 and 844x390; now part of `npm run e2e`).
- **Arena coverage.** At rest the stick is an 84-94px faint circle in the bottom-left corner, below the HUD, over the floor and stage edge. It's smaller than the old 120-137px D-pad. The right cluster is larger than the old 2x2 grid (about 150px square at 750x342) but mostly empty corner space. Neither can avoid overlapping the canvas entirely, because the canvas fills the phone screen.
- **Screenshots:** `/workspace/meme-brawl-shots/stick/` holds `old-buttons-<size>.png` (production), `stick-<size>.png` (preview), `compare-<size>.png` (side by side) and `stick-diagonal-jump.gif`.

## Right-wall fade (shipped in ff4553f, 2026-10-18)
- **What:** while a fighter stands behind a touch control (`dimControls()` in `src/main.js`, checked every frame), that control fades to **28% opacity** (`.under`).
- **What fades with the opponent at the right wall:**
  - 667x375: JUMP, LK, HK
  - 750x342: JUMP, LP, HP, LK
  - 844x390: LP, HP, LK (JUMP sits outside the arena there)
- **Why fade instead of moving the controls:** fighters stand on a ground line about 88% of the way down the screen. Tucking the cluster lower or further into the corner still overlaps an opponent at the wall. Squeezing the arc tighter makes the attack buttons overlap and shrinks JUMP below 72px. Fading keeps every control where the thumb expects it.
- **Tap areas unchanged:** sizes, positions and hit areas don't change (JUMP stays 79/72/82px at the three sizes), and faded controls still register. `scripts/e2e-stick.mjs` asserts this at all three sizes.
- **Screenshots:** `/workspace/meme-brawl-shots/stick/rightwall-{before,after,compare}-<size>.png`.

## Verification status
- **Live checks on ff4553f:** stick multi-touch test 42/42, e2e 19/19, and the casual online iPhone match over the relay (played with the stick) 4/4, verified with no desync.
- **Live ranked check skipped on purpose.** Ranked uses the same input encoding (`netcode.encode` of the same pad format) and the same lockstep path as the verified casual match, so it would add no touch-input coverage. Also, the two `TEST_WALLETS` were made on the fly and their keys weren't kept, so they can't sign in for ranked.
- **Pending:** a test on a real phone (iOS Safari and Android) with Zachary. All touch testing so far uses Chromium's emulated touch.

## Combos, Move List and Combo Trainer (step 1 of the story-mode plan)
- **Data:** `src/moves.js` holds every fighter's kit. Each fighter has 2 target-combo strings, extra special-cancel normals (`hc`), and 2 new specials: a low slide (`↓ ↓ + K`, hits low, knocks down) and an overhead hop (`↓ ↙ ← + P`, must be blocked standing). The Move List (`moveList()`) and the trainer drills (`drills()`) are both generated from this data, so nothing is hand-typed.
- **Cancels:** LP, LK, cr.LP, cr.LK, cr.HP, every string hit, plus the kit's `hc` normals cancel into any special or the super on hit or block, within 8 frames after active.
- **Motions (rules 2):** quarter-circle forward needs ↓ then → (the diagonal is optional), and passing through neutral breaks it. Same for quarter-circle back. ←→ (back, forward) is standing only. ↓↓ means down, release, down.
- **Rules version:** `RULES = 2` is stored on every match. Rules-1 matches keep the old behaviour byte-for-byte. Replays auto-detect their ruleset by checksum (`clipRules`), so old clips still verify. The online `go` handshake carries `rules`, and a mismatched guest is refused with "Version mismatch… refresh".
- **Move List:** press `I` or tap MOVE LIST on character select, or open it from the pause menu (not online or in replays). Navigate with A/D or ←/→, or PREV/NEXT. `T` or TRAINER opens the Combo Trainer.
- **Combo Trainer:** main menu → COMBO TRAINER. It runs a dummy with infinite HP, a frozen timer, and an input display. Each drill has per-step checkmarks; SHOW ME plays the drill as input; RESET; Q/E or 1–5 to switch drills. It pays no $KIBBLE and records no scores.
- **Tests:** `tests/combos.test.js` runs every drill from raw pads for all fighters and checks the damage against `comboDamage`. It also covers stick motions on both facings, the cancel rules, low/overhead blocking, Move List vs data, lockstep determinism, and replay ruleset detection. `scripts/e2e-combos.mjs` (part of `npm run e2e`) checks the keyboard path at 1280x800 and the touch path at 844x390, 750x342 and 667x375.
- **Known:** at max range, LK xx low slide can whiff for Bonkus, Toot Lord and Boomer Bob (the drills start close enough). The pre-existing kibble-pay guest pill sits over the bottom-centre hint text.

## Feel more alive: stage life, ambience, daily challenge, verified-wins feed
- **Render-only by design.** `src/ambient.js` reads the sim's `m.events` after `step()` (hit, super, finisher, ko), uses its own LCG (never `Math.random` or the match RNG) and draws in the frame loop. It never writes sim state, inputs, `RULES` or replay data. `tests/alive.test.js` plays CPU matches on all 5 stages with the crowd, details and daily tracking on (events deep-frozen) and off. The per-tick `stateHash` and `resultReport` checksums match exactly.
- **Per stage (original pixel art):**
  - **Kibble Mall:** shiba crowd with glow sticks; a blimp with a blinking banner; shoppers strolling; the sign flickers.
  - **Pump Chart Canyon:** pup crowd waving flags; vultures circling; a tumbleweed; the live candle wiggles.
  - **Moon Temple:** astro crowd in low-gravity hops; a rocket launches with a trail; a satellite.
  - **Liquidity Pond:** frog crowd; ripples; dragonflies; a fish jumps.
  - **Rug Den:** whale crowd holding cash; sweeping spotlights; gold glints; coins rain on big hits.
  - **On every stage:** the crowd bobs on idle and cheers near hits (more on heavies and 3+ hit combos). On a KO or finisher, everyone jumps and 70 confetti particles fall.
- **Effects levels:** EFFECTS chip on the menu (AUTO / FULL / LOW), saved in `mb.fx`. AUTO drops to LOW on `prefers-reduced-motion` or when a 180-frame average frame time goes over 24 ms in a fight, and shows a toast when it does. LOW draws half the crowd with no bobbing, no confetti, slower details, and caps screen shake at 3 px. `?fx=off|low|full` forces a level for testing.
- **Sound:** `mb.audio = {muted, vol}` persists. The 🔊 button or `M` toggles mute; the SOUND chip or `-` / `=` steps volume through 100/75/50/25%. Each stage has a synthesized ambience bed plus a crowd murmur that swells with hype, and cheers on big hits and KOs. Music is mixed lower under ambience. Everything is WebAudio synthesis (no audio files) and nothing starts before the first key, tap or click.
- **Daily challenge (`src/daily.js`):** picked by Sydney date (`Intl`, Australia/Sydney): `CHALLENGES[dayIndex mod 7]`, plus a fighter for WIN AS X. The challenges are WIN AS X, LOW SLIDE PARTY (3 low slides), SURVIVAL RUN (3 CPU wins back-to-back), OVERHEAD DROP (2), COMBO CHEF (4-hit combo), NO SCRATCHES (perfect round) and BAG METER DUMP (2 supers).
  - Only Arcade and Practice Ladder (CPU) count.
  - The reward is a cosmetic Daily Paw badge: Bronze from 1, Silver from 7, Gold from 30. It is stored in `mb.daily` and synced with the wallet cloud save (game `meme-brawl`). No $KIBBLE, no server grant, no fees.
- **Activity feed (`src/feed.js`):** reads kibble-pay's public `GET /api/pvp?action=clips`. Clips exist only for server-verified ranked matches between two distinct non-test wallets with matching input uploads. The client also drops unverified or unranked clips, clips with a TEST_WALLETS player, and anything older than 7 days.
  - Each row shows the winner's short wallet, the fighter and how long ago.
  - With no data it says "No ranked wins yet today. Be the first!", and it shows an offline state on errors. It never shows placeholder rows.
  - No new endpoint was needed.
- **Menu layout:** two columns placed clear of the phone touch controls, the wallet pill and the top-right buttons. `scripts/e2e-alive.mjs` measures this at 667x375, 750x342, 844x390 and 1280x800.

## Controllers: Bluetooth / USB gamepads (PS-style, Xbox-style, generic)
- **Same input path.** `src/gamepad.js` reads `navigator.getGamepads()` (W3C standard mapping) once per sim tick inside `readPads()` and only ORs the usual `{u,d,l,r,lp,hp,lk,hk}` bits into `pads[slot]`, exactly like keyboard and touch. No new sim state, no encoding change, no rules bump. Online sends the same encoded bits and replays are unchanged. `tests/gamepad.test.js` plays a full match from keyboard bits and from pad input and gets identical per-tick encodings, `stateHash` and `resultReport`.
- **Movement:** D-pad or left stick, radial deadzone 0.35, 8-way 45° sectors so diagonals work for ↓↘→ / ↓↙← rolls. Opposite directions cancel to neutral.
- **Default mapping (remappable):**

| Action | PS-style | Xbox-style | Generic |
|---|---|---|---|
| Light punch (LP) | □ | X | 3 |
| Heavy punch (HP) | △ | Y | 4 |
| Light kick (LK) | ✕ | A | 1 |
| Heavy kick (HK) | ○ | B | 2 |
| Special: shot (D,DF,F+P shortcut) | L1 | LB | L1 |
| Super (D,DF,F+K shortcut, needs full meter) | R1 | RB | R1 |
| Block (holds back) | L2 | LT | L2 |
| Launcher (D,D+P shortcut) | R2 | RT | R2 |
| Menus: confirm / back | ✕ / ○ | A / B | 1 / 2 |
| Pause | OPTIONS | MENU | START |
| Trainer reset | CREATE | VIEW | SELECT |

  The shortcuts are input macros: they feed the same motion inputs (2 ticks per step, facing taken at the press) through the normal bits, so they are not a new move or sim path.
- **Menus:** every screen works by pad: title, main menu, fighter select (✕ ready, ○ back/unready, △ skin, □ Move List), online lobby and results, shop, ladder, help, CONTROLLER + SETTINGS, the pause menu (new focus index, also W/S + Enter on keyboard), Move List (L1/R1 or D-pad fighter, △ trainer, ○ back) and the Trainer pause items (NEXT DRILL, SHOW ME, RESET). A pulsing outline plus a confirm glyph marks the focused menu item while a pad is in use. There is no separate stage-select screen; stages follow the fighter.
- **CONTROLLER + SETTINGS (menu item 8):** sound, effects, VIBRATION (`mb.vibe`, gates pad rumble and phone vibration), connected pads, and the remap list. Pick an action, then press the new button; actions swap so the map stays 1:1. Maps are saved per glyph family on the device (`mb.padmap.ps`, `.xbox`, `.generic`). There is a reset-to-default row for each family.
- **Hot-plug:**
  - Connect toast: family, player slot, and short button hints drawn as glyphs.
  - Disconnect toast. A local fight pauses safely; an online fight carries on with the toast.
  - Pad 2 becomes P2 in VERSUS 2P (local 1v1, casual: no prizes, no $KIBBLE, no rank).
  - The touch overlay hides while a pad is active (`body.padactive`) and returns on the next touch.
- **Rumble:** `vibrationActuator.playEffect('dual-rumble')` on hit, block and KO when VIBRATION is on. Errors are swallowed.
- **Art:** all glyphs are plain shapes and letters drawn on the canvas. No console logos or artwork.
- **Tests:** `tests/gamepad.test.js` (unit) and `scripts/e2e-gamepad.mjs` (fake pads injected into `navigator.getGamepads`). Neither has been tried on real Bluetooth hardware yet.

## Polish pass, Nov 5 2026 (rules 3)
- LK xx slide at max LK range now connects for Bonkus (Ground Ball), Toot Lord (Low Rumble) and Boomer Bob (Lawn Mower Slide): their slide uses the roster's standard slide timing (7f startup, 6.5 dash, same as President Inu / Muchwow). Damage unchanged; all other fighters unchanged. RULES 2 -> 3; rules-2 and rules-1 clips replay under their own rules (clipRules tries 3, 2, 1); online peers on different rules refuse to start.
- Version mismatch is now clean on both sides: the guest's bye carries why:'rules', so the host shows NO CONTEST / version mismatch instead of "opponent left, win by forfeit".
- Guest pill: on phone landscape the small guest icon docks bottom-left and the KIBBLE live footer starts right after it, so it no longer covers the footer or the bottom-centre hint lines; index.html passes InuProfileConfig.avoid='#inu-legal' for the expanded (wallet) pill.
- BACK on character select, skin shop and online lobby sat under the LP/JUMP touch buttons; with touch controls it is a small top-left button now (desktop unchanged).
- Combo Trainer bottom hint drops the keyboard-only keys on touch and shifts right so it clears the footer.
