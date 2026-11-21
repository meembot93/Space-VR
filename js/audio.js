// Sound effects and ambience, synthesized with WebAudio (no files needed). Narration is
// Meem's own recorded clips, played by narration.js through the same AudioContext.
export class Sound {
  constructor() { this.ctx = null; }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.voiceBus = ctx.createGain(); this.voiceBus.gain.value = 1; this.voiceBus.connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const mk = (type, f, g) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
      const gn = ctx.createGain(); gn.gain.value = g;
      src.connect(fl); fl.connect(gn); gn.connect(this.master); src.start(0, Math.random() * 2);
      return gn;
    };
    // Open-plain ambience: a soft low wind and a higher breeze that breathe slowly
    this.windLo = mk('lowpass', 300, 0.0);
    this.windHi = mk('bandpass', 1200, 0.0);
    this.amb = 0; // 0 = silent, 1 = full ambience (chapters set it)
  }

  get ok() { return !!this.ctx; }

  setListener(pos, fwd, up, t) {
    if (!this.ctx) return;
    const L = this.ctx.listener, now = this.ctx.currentTime;
    if (L.positionX) {
      L.positionX.setTargetAtTime(pos.x, now, 0.02); L.positionY.setTargetAtTime(pos.y, now, 0.02); L.positionZ.setTargetAtTime(pos.z, now, 0.02);
      L.forwardX.setTargetAtTime(fwd.x, now, 0.02); L.forwardY.setTargetAtTime(fwd.y, now, 0.02); L.forwardZ.setTargetAtTime(fwd.z, now, 0.02);
      L.upX.setTargetAtTime(up.x, now, 0.02); L.upY.setTargetAtTime(up.y, now, 0.02); L.upZ.setTargetAtTime(up.z, now, 0.02);
    } else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, up.x, up.y, up.z); }
    const gust = 0.6 + 0.4 * Math.sin(t * 0.31) * Math.sin(t * 0.17 + 1);
    this.windLo.gain.setTargetAtTime(this.amb * 0.07 * gust, now, 0.6);
    this.windHi.gain.setTargetAtTime(this.amb * 0.012 * gust * gust, now, 0.6);
  }

  out(pos, vol = 1, ref = 4, rolloff = 0.8) {
    const g = this.ctx.createGain(); g.gain.value = vol;
    if (pos) {
      const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
      p.refDistance = ref; p.maxDistance = 2000; p.rolloffFactor = rolloff;
      if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
      g.connect(p); p.connect(this.master);
    } else g.connect(this.master);
    return g;
  }

  noise(out, { type = 'lowpass', f = 1000, q = 0.7, peak = 1, a = 0.005, d = 0.5, f2 = null, t0 = 0 }) {
    const c = this.ctx, t = c.currentTime + t0;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    src.connect(fl); fl.connect(g); g.connect(out); src.start(t, Math.random() * 1.5); src.stop(t + a + d + 0.05);
  }

  tone(out, { type = 'sine', f = 440, f2 = null, peak = 0.5, a = 0.005, d = 0.3, t0 = 0 }) {
    const c = this.ctx, t = c.currentTime + t0;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + a + d + 0.05);
  }

  // The guide star: a soft, sparkly chime
  chime(pos, vol = 0.35) {
    if (!this.ctx) return; const o = this.out(pos, vol, 2);
    [1318, 1760, 2637].forEach((f, i) => this.tone(o, { f, peak: 0.25, a: 0.004, d: 1.4 - i * 0.3, t0: i * 0.06 }));
  }
  // Something you can use lit up / you grabbed it
  tick(pos) {
    if (!this.ctx) return; const o = this.out(pos, 0.25, 2);
    this.tone(o, { type: 'triangle', f: 1100, peak: 0.3, a: 0.001, d: 0.06 });
  }
  // Heavy stone grinding over wooden rollers
  scrape(pos, vol = 1) {
    if (!this.ctx) return; const o = this.out(pos, vol, 6);
    this.noise(o, { type: 'bandpass', f: 220, f2: 160, q: 1.2, peak: 0.7, a: 0.05, d: 0.5 });
    this.tone(o, { type: 'sawtooth', f: 52, f2: 44, peak: 0.12, a: 0.05, d: 0.45 });
  }
  // Rope creaking under load
  creak(pos) {
    if (!this.ctx) return; const o = this.out(pos, 0.3, 2);
    this.tone(o, { type: 'sawtooth', f: 180 + Math.random() * 60, f2: 130, peak: 0.08, a: 0.1, d: 0.35 });
  }
  // A big stone dropping into its hole
  boom(pos) {
    if (!this.ctx) return; const o = this.out(pos, 1.6, 8);
    this.tone(o, { f: 70, f2: 30, peak: 0.9, a: 0.004, d: 1.2 });
    this.noise(o, { f: 500, f2: 80, peak: 0.8, a: 0.004, d: 1.0 });
  }
  // A crowd far off cheering: layered formant-ish noise swells (no voices)
  cheer(pos) {
    if (!this.ctx) return; const o = this.out(pos, 0.7, 10);
    for (let i = 0; i < 10; i++) this.noise(o, { type: 'bandpass', f: 450 + Math.random() * 900, f2: 600 + Math.random() * 900, q: 5, peak: 0.25, a: 0.15 + Math.random() * 0.2, d: 1.2 + Math.random(), t0: Math.random() * 0.5 });
  }
  // A low drumbeat the builders keep time to while hauling
  drum(pos) {
    if (!this.ctx) return; const o = this.out(pos, 0.9, 6);
    this.tone(o, { f: 95, f2: 50, peak: 0.8, a: 0.003, d: 0.35 });
    this.noise(o, { f: 300, peak: 0.3, a: 0.002, d: 0.12 });
  }
  // A bird waking up at dawn (a few quick whistles)
  chirp(pos) {
    if (!this.ctx) return; const o = this.out(pos, 0.12, 6);
    const base = 2600 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.tone(o, { f: base * (1 + Math.random() * 0.15), f2: base * (0.75 + Math.random() * 0.5), peak: 0.3, a: 0.01, d: 0.07 + Math.random() * 0.06, t0: i * (0.11 + Math.random() * 0.05) });
  }
  // A page turning (journal)
  page() {
    if (!this.ctx) return; const o = this.out(null, 0.5);
    this.noise(o, { type: 'highpass', f: 1800, f2: 4000, peak: 0.4, a: 0.03, d: 0.25 });
    this.noise(o, { type: 'bandpass', f: 900, peak: 0.25, a: 0.05, d: 0.2, t0: 0.12 });
  }
  // A swelling warm pad for the sunrise moment (synth, no voice)
  swell(dur = 12) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = this.out(null, 0.12);
    for (const f of [130.8, 196, 261.6, 329.6, 392]) {
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(o); osc.start(t); osc.stop(t + dur + 0.1);
    }
  }
}
