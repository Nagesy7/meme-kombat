// Meme Brawl clips: compact deterministic input replays (contract: inu-shared/tournaments.md "Meme Brawl clips").
// inputs = change points [[tick, pad0, pad1], ...] in the 8-bit lockstep encoding (netcode.js BITS), each held until the
// next change. With the room seed, characters and skins, logic.js replays the match exactly (same final checksum).
import { decode, resultReport } from './netcode.js';

export class InputRecorder {
  constructor() { this.inputs = []; this.last = -1; }
  add(tick, b0, b1) { const l = this.inputs[this.inputs.length - 1]; if (!l || l[1] !== b0 || l[2] !== b1) this.inputs.push([tick, b0, b1]); this.last = tick; }
}
// online skins: the guest gets the alt palette when both picked the same fighter and skin (must match beginMatch exactly)
export function onlineSkins(c0, c1, s0, s1) { return [s0, c0 === c1 && s0 === s1 ? (s0 === 'base' ? 'alt' : 'base') : s1]; }
export function clipMatch(clip, makeMatch) {
  const [a, b] = clip.players, [s0, s1] = onlineSkins(a.char, b.char, a.skin, b.skin);
  return makeMatch(a.char, b.char, { o1: { skin: s0 }, o2: { skin: s1 }, seed: clip.seed });
}
// pad bytes for every tick of the clip
export function* clipPads(clip) { const ins = clip.inputs; let i = 0; for (let t = 0; t < clip.ticks; t++) { while (i + 1 < ins.length && ins[i + 1][0] <= t) i++; yield [ins[i][1], ins[i][2]]; } }
// step a match until `toTick` (or matchEnd); returns { m, report } where report is the resultReport at matchEnd
export function replayTo(clip, { makeMatch, step }, toTick = clip.ticks) {
  const m = clipMatch(clip, makeMatch); let report = null;
  for (const [b0, b1] of clipPads(clip)) { if (m.tick >= toTick) break; step(m, [decode(b0), decode(b1)]); m.events.length = 0; if (m.phase === 'matchEnd') { report = resultReport(m); break; } }
  return { m, report };
}
