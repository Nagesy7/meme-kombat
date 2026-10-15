// Online 1v1 client: matchmaking + signaling via kibble-pay /api/pvp (Vercel + Upstash), WebRTC data channel for inputs,
// automatic fallback to the HTTP relay when a direct connection cannot be made. No wagering of any kind.
export const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
export const P2P_TIMEOUT_MS = 7000, DISCONNECT_MS = 10000;
const cid = (() => { try { let c = sessionStorage.getItem('mb.cid'); if (!c) { c = Math.random().toString(36).slice(2, 12); sessionStorage.setItem('mb.cid', c); } return c; } catch { return Math.random().toString(36).slice(2, 12); } })();

export class OnlineSession {
  constructor({ api, session, kind, ranked, char, skin, code, onState = () => {} }) {
    Object.assign(this, { api: api.replace(/\/$/, '') + '/api/pvp', session, kind, ranked: !!ranked, char, skin, joinCode: code, onState });
    this.state = 'matching'; this.msg = 'Connecting...'; this.after = 0; this.out = []; this.handlers = []; this.closed = false; this.inbox = [];
    this.via = null; this.dc = null; this.pc = null; this.lastSeen = performance.now(); this.pollMs = 400; this.peerGone = false;
    addEventListener('pagehide', () => this.leave());
  }
  set(state, msg) { this.state = state; if (msg != null) this.msg = msg; this.onState(this); }
  async req(action, body, method = 'POST') {
    const h = { 'content-type': 'application/json' }; if (this.session) h.authorization = 'Bearer ' + this.session;
    const url = `${this.api}?action=${action}` + (method === 'GET' ? '&' + new URLSearchParams(body) : '');
    const r = await fetch(url, method === 'GET' ? { headers: h } : { method, headers: h, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok && !j.reason) j.reason = j.error || `HTTP ${r.status}`; return { ...j, ok: r.ok && j.ok !== false };
  }
  get link() { return this.code ? `${location.origin}${location.pathname}?room=${this.code}` : ''; }
  async start() {
    const base = { char: this.char, skin: this.skin, cid, ranked: this.ranked };
    let r;
    if (this.kind === 'join') r = await this.req('join', { ...base, code: this.joinCode });
    else if (this.kind === 'create') r = await this.req('create', base);
    else r = await this.req('quick', base);
    if (!r.ok) return this.set('error', r.reason || 'matchmaking failed');
    Object.assign(this, { code: r.code, side: r.side, tok: r.tok, room: r.room });
    if (r.waiting || (r.room && !r.room.players[1])) { this.set('waiting', this.kind === 'create' ? 'Share the code or link with your friend' : 'Searching for an opponent...'); await this.waitForPeer(); }
    if (this.closed || this.state === 'error') return;
    this.set('connecting', 'Opponent found! Connecting...');
    this.pollLoop();
    await this.connect();
  }
  async waitForPeer() {
    let n = 0;
    while (!this.closed) {
      await sleep(1000); n++;
      if (this.kind === 'quick' && n % 4 === 0) { const r = await this.req('quick', { char: this.char, skin: this.skin, cid, ranked: this.ranked, code: this.code, tok: this.tok }).catch(() => null);
        if (r?.ok && r.code !== this.code) { Object.assign(this, { code: r.code, side: r.side, tok: r.tok, room: r.room }); } if (r?.ok && r.room?.players[1]) { this.room = r.room; return; } continue; }
      const r = await this.req('room', { code: this.code }, 'GET').catch(() => null); if (r?.ok && r.room.players[1]) { this.room = r.room; return; }
    }
  }
  // ---- transport ----
  onMessage(f) { this.handlers.push(f); }
  emit(m) { this.lastSeen = performance.now(); if (m.t === 'bye') this.peerGone = true; if (m.t === 'go') this.gotGo = m; else if (m.t === 'in' || m.t === 'ck') this.inbox.push(m); for (const f of this.handlers) f(m); }
  drain() { const a = this.inbox; this.inbox = []; return a; }
  send(m) { if (this.dc && this.dc.readyState === 'open') { try { this.dc.send(JSON.stringify(m)); return; } catch {} } this.out.push(m); }
  async flush() { if (!this.out.length || this.closed) return; const msgs = this.out.splice(0, 64); try { await this.req('signal', { code: this.code, side: this.side, tok: this.tok, msgs }); } catch { this.out.unshift(...msgs); } }
  async pollLoop() {
    while (!this.closed) {
      try {
        await this.flush();
        const r = await this.req('signal', { code: this.code, side: this.side, tok: this.tok, after: this.after }, 'GET');
        if (r.ok) { this.after = r.next; for (const m of r.msgs) this.onSignal(m); }
      } catch {}
      await sleep(this.via === 'p2p' ? 1000 : this.via === 'relay' ? 60 : 150);
    }
  }
  onSignal(m) { if (m.t === 'offer' || m.t === 'answer') this.onSdp(m); else this.emit(m); }
  async connect() {
    const deadline = sleep(P2P_TIMEOUT_MS).then(() => 'timeout');
    let ok = false, opened = null;
    if (typeof RTCPeerConnection !== 'undefined' && !new URLSearchParams(location.search).has('relay')) {
      try {
        const pc = this.pc = new RTCPeerConnection({ iceServers: ICE });
        opened = new Promise((res) => { const hook = (dc) => { this.dc = dc; dc.onopen = () => res('open'); dc.onmessage = (e) => { try { this.emit(JSON.parse(e.data)); } catch {} }; dc.onclose = () => { if (!this.closed) this.via = 'relay'; }; };
          if (this.side === 0) hook(pc.createDataChannel('mb', { ordered: true })); else pc.ondatachannel = (e) => hook(e.channel); });
        if (this.side === 0) { await pc.setLocalDescription(await pc.createOffer()); await iceDone(pc); this.out.push({ t: 'offer', sdp: pc.localDescription.sdp }); ok = (await Promise.race([opened, deadline])) === 'open'; }
      } catch (e) { console.warn('webrtc failed', e); }
    } else await sleep(300);
    // the host decides the transport + input delay (p2p: 4 ticks ~67ms, relay: 10 ticks) and tells the guest
    if (this.side === 0) { this.via = ok ? 'p2p' : 'relay'; this.delay = this.via === 'p2p' ? 4 : 10; this.send({ t: 'go', delay: this.delay, via: this.via }); }
    else { const go = await new Promise((res) => { if (this.gotGo) return res(this.gotGo); this.handlers.push((m) => { if (m.t === 'go') res(m); }); });
      if (go.via === 'p2p' && opened) await Promise.race([opened, sleep(2000)]);
      this.delay = go.delay; this.via = go.via; }
    this.set('ready', `Connected (${this.via === 'p2p' ? 'WebRTC peer-to-peer' : 'server relay'})`);
    this.lastSeen = performance.now();
  }
  async onSdp(m) {
    try {
      if (m.t === 'offer' && this.side === 1) { const pc = await waitFor(() => this.pc); await pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
        await this.pc.setLocalDescription(await this.pc.createAnswer()); await iceDone(this.pc); this.out.push({ t: 'answer', sdp: this.pc.localDescription.sdp }); }
      if (m.t === 'answer' && this.side === 0) await this.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
    } catch (e) { console.warn('sdp', e); }
  }
  silentFor() { return performance.now() - this.lastSeen; }
  async report(rep) { return this.req('result', { code: this.code, side: this.side, tok: this.tok, ...rep }); }
  leave() { if (this.closed || !this.code) { this.closed = true; return; } this.closed = true; try { const h = { type: 'application/json' }; navigator.sendBeacon?.(`${this.api}?action=leave`, new Blob([JSON.stringify({ code: this.code, side: this.side, tok: this.tok })], h)); } catch {} try { this.dc?.send(JSON.stringify({ t: 'bye' })); this.pc?.close(); } catch {} }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (f) => { for (let i = 0; i < 100; i++) { const v = f(); if (v) return v; await sleep(50); } throw new Error('timeout'); };
const iceDone = (pc) => new Promise((res) => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 2000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
