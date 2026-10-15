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
