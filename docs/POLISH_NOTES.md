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
