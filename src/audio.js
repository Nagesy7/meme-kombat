// Original chiptune + SFX via WebAudio (square/triangle/noise). No samples.
let ac = null, master = null, musicGain = null, seqTimer = null, muted = false, noiseBuf = null;
export function unlock() {
  if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; ac = new A(); master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination); musicGain = ac.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  if (ac.state === 'suspended' && !document.hidden) ac.resume();
}
export function setMuted(v) { muted = v; if (master) master.gain.value = v ? 0 : 0.5; }
export const isMuted = () => muted;
function tone(f, t0, dur, type = 'square', vol = 0.2, dest = master, slide = 0) {
  if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur); o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, vol = 0.3, hp = 800, dest = master) {
  if (!ac) return; const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t0); s.stop(t0 + dur + 0.02);
}
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
// one-shot limiter: per-SFX cooldown + max concurrent voices
const CD = { hit: 0.04, block: 0.05, whiff: 0.06, land: 0.08, select: 0.03, jump: 0.08 }, lastAt = {}; let ends = [];
export const MAX_VOICES = 10;
export function gate(name, now, cd = CD[name] ?? 0.05, dur = 0.3) { ends = ends.filter((t) => t > now); if (ends.length >= MAX_VOICES || now - (lastAt[name] ?? -1e9) < cd) return false; lastAt[name] = now; ends.push(now + dur); return true; }
if (typeof document !== 'undefined') { document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) ac.suspend?.(); else ac.resume?.(); }); addEventListener('pagehide', () => ac?.suspend?.()); }
export function sfx(type, o = {}) {
  if (!ac || !gate(type, ac.currentTime)) return; const t = ac.currentTime;
  switch (type) {
    case 'hit': noise(t, o.heavy ? 0.18 : 0.09, o.heavy ? 0.45 : 0.3, o.heavy ? 300 : 900); tone(o.heavy ? 140 : 220, t, 0.12, 'square', 0.18, master, 0.4); break;
    case 'block': tone(1200, t, 0.05, 'square', 0.1); tone(900, t + 0.03, 0.05, 'square', 0.08); break;
    case 'whiff': noise(t, 0.06, 0.08, 2500); break;
    case 'jump': tone(300, t, 0.12, 'square', 0.07, master, 2); break;
    case 'land': noise(t, 0.1, o.heavy ? 0.3 : 0.1, 150); break;
    case 'proj': tone(600, t, 0.25, 'sawtooth', 0.1, master, 0.3); tone(900, t, 0.2, 'square', 0.06, master, 0.5); break;
    case 'super': for (let i = 0; i < 6; i++) tone(N(60 + i * 4), t + i * 0.05, 0.15, 'square', 0.12); break;
    case 'ko': for (let i = 0; i < 8; i++) tone(N(76 - i * 3), t + i * 0.07, 0.2, 'square', 0.14); noise(t, 0.5, 0.2, 100); break;
    case 'banner': tone(N(72), t, 0.12, 'square', 0.1); tone(N(79), t + 0.08, 0.2, 'square', 0.1); break;
    case 'select': tone(N(84), t, 0.06, 'square', 0.1); break;
    case 'confirm': tone(N(72), t, 0.08, 'square', 0.12); tone(N(84), t + 0.07, 0.14, 'square', 0.12); break;
    case 'finisher': for (let i = 0; i < 16; i++) tone(N(48 + (i % 4) * 7 + Math.floor(i / 4) * 5), t + i * 0.06, 0.12, i % 2 ? 'square' : 'triangle', 0.13); noise(t + 1, 0.8, 0.25, 200); break;
    case 'coin': tone(N(88), t, 0.06, 'square', 0.1); tone(N(95), t + 0.06, 0.2, 'square', 0.1); break;
    case 'clash': noise(t, 0.2, 0.3, 1500); tone(1800, t, 0.1, 'triangle', 0.1); break;
  }
}
// Music: tiny step sequencer. Each song: bpm, bass pattern, lead pattern (MIDI or 0), drums string.
const SONGS = {
  menu: { bpm: 112, key: 57, bass: [0, 0, 7, 0, 5, 0, 3, 5], lead: [12, 0, 15, 12, 19, 0, 17, 15, 12, 0, 10, 12, 7, 0, 0, 0], drum: 'k.h.s.h.k.k.s.h.' },
  mall: { bpm: 140, key: 52, bass: [0, 0, 12, 0, 10, 0, 7, 10], lead: [12, 15, 19, 15, 22, 19, 15, 12, 10, 12, 15, 0, 17, 15, 12, 10], drum: 'k.hsk.hsk.hsk.ss' },
  canyon: { bpm: 150, key: 50, bass: [0, 12, 0, 10, 0, 7, 5, 7], lead: [24, 0, 22, 19, 0, 17, 19, 22, 24, 27, 24, 22, 19, 0, 17, 0], drum: 'k.h.skh.k.h.sksh' },
  moon: { bpm: 128, key: 55, bass: [0, 7, 12, 7, 3, 10, 15, 10], lead: [19, 0, 0, 22, 24, 0, 22, 0, 19, 0, 15, 0, 17, 19, 0, 0], drum: 'k..hs..hk.k.s..h' },
  pond: { bpm: 132, key: 53, bass: [0, 0, 3, 5, 7, 7, 5, 3], lead: [12, 0, 12, 15, 0, 17, 15, 12, 19, 0, 17, 0, 15, 12, 10, 0], drum: 'k.h.s.h.k.hks.h.' },
  rugden: { bpm: 158, key: 45, bass: [0, 1, 0, 6, 0, 1, 7, 6], lead: [12, 13, 12, 0, 18, 0, 17, 13, 12, 0, 13, 15, 18, 19, 18, 0], drum: 'kkhskkhskkhsksss' },
  win: { bpm: 150, key: 60, bass: [0, 7, 5, 7], lead: [12, 16, 19, 24, 19, 24, 28, 0], drum: 'k.s.k.s.' },
};
let current = null;
export function music(name) {
  if (current === name) return; current = name; if (seqTimer) clearInterval(seqTimer); seqTimer = null; if (!ac) return;
  { const old = musicGain; old.gain.setTargetAtTime(0, ac.currentTime, 0.03); setTimeout(() => old.disconnect(), 400); musicGain = ac.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master); } // one track at a time: queued notes of the old song fade out
  if (!name) return;
  const S = SONGS[name] || SONGS.menu, spb = 60 / S.bpm / 2; let step = 0, next = ac.currentTime + 0.05;
  seqTimer = setInterval(() => { if (next < ac.currentTime - 0.05) next = ac.currentTime + 0.05; /* throttled timer: skip, don't burst */ while (next < ac.currentTime + 0.15) { const b = S.bass[Math.floor(step / 2) % S.bass.length], l = S.lead[step % S.lead.length], d = S.drum[step % S.drum.length];
      if (step % 2 === 0) tone(N(S.key - 12 + b), next, spb * 1.8, 'triangle', 0.35, musicGain);
      if (l) tone(N(S.key + l), next, spb * 0.9, 'square', 0.09, musicGain);
      if (d === 'k') tone(120, next, 0.1, 'sine', 0.5, musicGain, 0.3); else if (d === 's') noise(next, 0.08, 0.18, 1200, musicGain); else if (d === 'h') noise(next, 0.03, 0.06, 6000, musicGain);
      step++; next += spb; } }, 40);
}
export function stopMusic() { music(null); }
