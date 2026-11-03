// Original chiptune + SFX via WebAudio (square/triangle/noise). No samples.
let ac = null, master = null, musicGain = null, seqTimer = null, muted = false, noiseBuf = null, volume = 1;
// Sound settings persist on this device (mb.audio = {muted, vol}); vol 0..1 scales music, ambience and SFX together.
const PREF_KEY = 'mb.audio', LSa = typeof localStorage !== 'undefined' ? localStorage : null;
try { const p = JSON.parse(LSa?.getItem(PREF_KEY) || 'null'); if (p) { muted = !!p.muted; volume = Math.max(0, Math.min(1, Number(p.vol ?? 1))); } } catch {}
const savePrefs = () => { try { LSa?.setItem(PREF_KEY, JSON.stringify({ muted, vol: volume })); } catch {} };
export const masterLevel = () => (muted ? 0 : 0.5 * volume);
export const VOLUME_STEPS = [1, 0.75, 0.5, 0.25];
export function setVolume(v) { volume = Math.max(0, Math.min(1, Number(v) || 0)); if (master) master.gain.value = masterLevel(); savePrefs(); }
export const getVolume = () => volume;
export function cycleVolume() { const i = VOLUME_STEPS.findIndex((x) => Math.abs(x - volume) < 0.01); setVolume(VOLUME_STEPS[(i + 1) % VOLUME_STEPS.length]); if (muted) setMuted(false); return volume; }
export const audioStarted = () => !!ac;
export function unlock() {
  if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; ac = new A(); master = ac.createGain(); master.gain.value = masterLevel(); master.connect(ac.destination); musicGain = ac.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const c = current; current = null; if (c) music(c); const a = ambWant; ambWant = null; if (a) ambience(a); } // first gesture: start what the screen asked for
  if (ac.state === 'suspended' && !document.hidden) ac.resume();
}
export function setMuted(v) { muted = !!v; if (master) master.gain.value = masterLevel(); savePrefs(); }
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
  { const old = musicGain; old.gain.setTargetAtTime(0, ac.currentTime, 0.03); setTimeout(() => old.disconnect(), 400); musicGain = ac.createGain(); musicGain.gain.value = SONGS[name] && name !== 'menu' && name !== 'win' ? 0.24 : 0.32; musicGain.connect(master); } // stage songs a little lighter under the ambience. One track at a time: queued notes of the old song fade out
  if (!name) return;
  const S = SONGS[name] || SONGS.menu, spb = 60 / S.bpm / 2; let step = 0, next = ac.currentTime + 0.05;
  seqTimer = setInterval(() => { if (next < ac.currentTime - 0.05) next = ac.currentTime + 0.05; /* throttled timer: skip, don't burst */ while (next < ac.currentTime + 0.15) { const b = S.bass[Math.floor(step / 2) % S.bass.length], l = S.lead[step % S.lead.length], d = S.drum[step % S.drum.length];
      if (step % 2 === 0) tone(N(S.key - 12 + b), next, spb * 1.8, 'triangle', 0.35, musicGain);
      if (l) tone(N(S.key + l), next, spb * 0.9, 'square', 0.09, musicGain);
      if (d === 'k') tone(120, next, 0.1, 'sine', 0.5, musicGain, 0.3); else if (d === 's') noise(next, 0.08, 0.18, 1200, musicGain); else if (d === 'h') noise(next, 0.03, 0.06, 6000, musicGain);
      step++; next += spb; } }, 40);
}
export function stopMusic() { music(null); }

// ---- Stage ambience: synthesized loops (no samples). One bed per stage + a crowd murmur that swells with the hype. ----
let amb = null, ambWant = null;
const AMB = {
  mall: { bed: ['bandpass', 600, 0.8, 0.05], lfo: [0.12, 0.02], blips: { every: 3.2, fn: (t, g) => { tone(N(84), t, 0.5, 'sine', 0.03, g); tone(N(88), t + 0.18, 0.6, 'sine', 0.025, g); } } },
  canyon: { bed: ['lowpass', 420, 1.2, 0.09], lfo: [0.08, 0.06], sweep: [260, 640], blips: { every: 6, fn: (t, g) => tone(1400, t, 0.5, 'triangle', 0.02, g, 0.6) } },
  moon: { bed: ['lowpass', 160, 2, 0.06], drone: [55, 82.5], lfo: [0.05, 0.02], blips: { every: 2.6, fn: (t, g) => tone(N(96), t, 0.07, 'square', 0.015, g) } },
  pond: { bed: ['highpass', 4200, 6, 0.018], lfo: [7, 0.016], blips: { every: 1.7, fn: (t, g) => { tone(110, t, 0.12, 'square', 0.035, g, 0.6); tone(95, t + 0.16, 0.12, 'square', 0.03, g, 0.6); } } },
  rugden: { bed: ['lowpass', 110, 1.5, 0.12], drone: [41, 61.5], lfo: [0.2, 0.05], blips: { every: 2.2, fn: (t, g) => { tone(N(100), t, 0.08, 'square', 0.02, g); tone(N(103), t + 0.06, 0.1, 'square', 0.018, g); } } },
};
export const AMBIENCE_STAGES = Object.keys(AMB);
function loopNoise() { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }
export function ambience(name) {
  ambWant = name || null; if (!ac) return; // no AudioContext before the first user gesture: unlock() starts it later
  if (amb) { const old = amb; amb = null; old.out.gain.setTargetAtTime(0, ac.currentTime, 0.2); clearInterval(old.timer); setTimeout(() => { for (const n of old.nodes) { try { n.stop?.(); } catch {} try { n.disconnect(); } catch {} } }, 900); }
  ambWant = null; const S = AMB[name]; if (!S) return;
  const out = ac.createGain(), nodes = [out]; out.gain.value = 0; out.gain.setTargetAtTime(1, ac.currentTime, 0.6); out.connect(master);
  const [ft, fq, q, vol] = S.bed, src = loopNoise(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = ft; f.frequency.value = fq; f.Q.value = q; g.gain.value = vol; src.connect(f); f.connect(g); g.connect(out); src.start(); nodes.push(src, f, g);
  const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = S.lfo[0]; lg.gain.value = S.lfo[1]; lfo.connect(lg); lg.connect(g.gain); lfo.start(); nodes.push(lfo, lg);
  if (S.sweep) { const l2 = ac.createOscillator(), g2 = ac.createGain(); l2.frequency.value = 0.07; g2.gain.value = (S.sweep[1] - S.sweep[0]) / 2; l2.connect(g2); g2.connect(f.frequency); l2.start(); nodes.push(l2, g2); }
  if (S.drone) for (const hz of S.drone) { const o = ac.createOscillator(), dg = ac.createGain(); o.type = 'sine'; o.frequency.value = hz; dg.gain.value = 0.025; o.connect(dg); dg.connect(out); o.start(); nodes.push(o, dg); }
  const crowd = loopNoise(), cf = ac.createBiquadFilter(), cg = ac.createGain(); cf.type = 'bandpass'; cf.frequency.value = 900; cf.Q.value = 0.9; cg.gain.value = 0.012; crowd.connect(cf); cf.connect(cg); cg.connect(out); crowd.start(); nodes.push(crowd, cf, cg);
  let nextBlip = ac.currentTime + 1;
  const timer = setInterval(() => { if (!ac || ac.state !== 'running') return; const t = ac.currentTime; if (t >= nextBlip) { S.blips.fn(t + 0.02, out); nextBlip = t + S.blips.every * (0.7 + 0.6 * Math.random()); } }, 250);
  amb = { name, out, nodes, timer, crowdGain: cg };
}
export const ambienceName = () => amb?.name || ambWant || null;
// Crowd level follows the hype (0..1); cheer() is a one-shot roar for big hits and KOs.
export function setHype(h) { if (amb && ac) amb.crowdGain.gain.setTargetAtTime(0.012 + 0.05 * Math.max(0, Math.min(1, h)), ac.currentTime, 0.4); }
export function cheer(big = false) {
  if (!ac || !amb || !gate('cheer', ac.currentTime, big ? 0.6 : 0.35, 1.2)) return; const t = ac.currentTime;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = big ? 1100 : 900; f.Q.value = 0.7;
  const v = big ? 0.16 : 0.07, d = big ? 1.8 : 0.8; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.12); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(f); f.connect(g); g.connect(amb.out); s.start(t); s.stop(t + d + 0.05);
  if (big) for (let i = 0; i < 4; i++) tone(N(70 + i * 3 + Math.floor(Math.random() * 3)), t + 0.1 + i * 0.12, 0.35, 'triangle', 0.03, amb.out, 1.3);
}
