// Background music. Each chapter asks for a mood by name (e.g. 'ch2'); if sounds/music/index.json
// lists a file for it, that file loops, e.g. { "ch2": "stonehenge.mp3" }. Drop in any track you
// like (your own, or free music whose license allows any use) and list it there.
// With no file listed, a soft generated score plays instead: slow warm chords and a few
// twinkling notes, made in WebAudio (no samples, nothing to license).
// The music dips while Astra is talking.
const DIR = new URL('../sounds/music/', import.meta.url).href;

// Each chapter has its own mood: chords (semitones from A3), how many seconds each chord lasts,
// high twinkling notes, a low drone, and a lead voice that plays a few slow notes from `scale`:
//   flute (breathy, Ch1), reed (Egypt and Babylon), lyre (plucked, Greece), none.
const N = (semi) => 220 * Math.pow(2, semi / 12); // semitones from A3
const MOODS = {
  dawn: { chords: [[-9, -2, 3, 7], [-7, 0, 5, 9], [-12, -5, 0, 4], [-10, -3, 2, 5]], tempo: 9, twinkle: [12, 14, 16, 19, 21, 24], drone: -21 },
  // Ch1: a cold, starry Ice Age night by the fire; a bone flute far off
  ch1: { chords: [[-7, 0, 3, 7], [-9, -2, 3, 8], [-12, -5, 0, 3], [-10, -3, 2, 5]], tempo: 11, twinkle: [15, 17, 19, 22, 24, 27], drone: -19, lead: 'flute', scale: [3, 5, 7, 10, 12, 15] },
  // Ch2: Stonehenge before sunrise, warm and hopeful
  ch2: { chords: [[-9, -2, 3, 7], [-7, 0, 5, 9], [-12, -5, 0, 4], [-10, -3, 2, 5]], tempo: 9, twinkle: [12, 14, 16, 19, 21, 24], drone: -21 },
  // Ch3: Egypt, an old desert scale (with a step and a half in it), a reed pipe
  ch3: { chords: [[-5, 2, 7], [-4, 3, 7], [-5, 0, 4, 7], [-7, 0, 3]], tempo: 10, twinkle: [12, 13, 16, 17, 19, 24], drone: -17, lead: 'reed', scale: [7, 8, 11, 12, 14, 15, 19] },
  // Ch4: Babylon at night, deep and patient
  ch4: { chords: [[-12, -5, 0, 3], [-10, -3, 2, 5], [-14, -7, -2, 3], [-12, -5, 0, 5]], tempo: 12, twinkle: [12, 15, 17, 19, 24], drone: -24, lead: 'reed', scale: [0, 2, 3, 5, 7, 8, 12] },
  // Ch5: Greece, a plucked lyre over soft chords
  ch5: { chords: [[-7, 0, 3, 7], [-5, 2, 5, 9], [-9, -2, 3, 7], [-10, -3, 2, 5]], tempo: 9, twinkle: [12, 14, 15, 19, 21], drone: -19, lead: 'lyre', scale: [0, 2, 3, 5, 7, 9, 10, 12] },
  // Ch6: the sea and the bronze machine, glinting
  ch6: { chords: [[-12, -5, 0, 4, 6], [-10, -3, 2, 6], [-8, -1, 4, 7], [-12, -5, 2, 7]], tempo: 9, twinkle: [16, 18, 19, 23, 24, 28], drone: -24, lead: 'lyre', scale: [4, 6, 7, 11, 12, 14, 16] },
  // Ch7: Ptolemy's great spinning sky, the finale
  ch10: { chords: [[-12, -5, 0, 3, 7], [-9, -2, 3, 7], [-7, 0, 3, 8], [-5, 2, 7, 10]], tempo: 9, twinkle: [12, 15, 19, 22, 24], drone: -24, lead: 'lyre', scale: [0, 2, 3, 5, 7, 8, 10, 12] },
  ch9: { chords: [[-12, -5, 0, 4, 7], [-10, -3, 2, 5, 9], [-7, 0, 4, 7, 12], [-5, 2, 5, 9, 11]], tempo: 12, twinkle: [12, 16, 19, 23, 24, 28], drone: -24, lead: 'flute', scale: [0, 2, 4, 5, 7, 9, 11, 12] },
  ch8: { chords: [[-12, -5, 0, 3, 7], [-8, -1, 3, 8], [-10, -3, 2, 5], [-7, 0, 5, 10]], tempo: 11, twinkle: [12, 15, 19, 22, 24, 27], drone: -24, lead: 'reed', scale: [0, 2, 3, 5, 7, 8, 10, 12] },
  ch7: { chords: [[-12, -5, 0, 4, 7], [-7, 0, 4, 9], [-9, -2, 3, 7], [-5, 2, 7, 11]], tempo: 10, twinkle: [12, 16, 19, 23, 24, 28], drone: -24, lead: 'lyre', scale: [0, 4, 7, 9, 11, 12, 16] },
  // Era 2, Ch7: Sputnik, a cold desert night at the launch pad, then space (Meem's track plays if it's listed)
  ch14: { chords: [[-12, -5, 0, 3, 7], [-10, -3, 2, 5, 9], [-8, -1, 3, 7], [-5, 2, 7, 10, 14]], tempo: 10, twinkle: [12, 15, 19, 22, 24, 27], drone: -24, lead: 'flute', scale: [0, 3, 5, 7, 10, 12, 15] },
};

// The big moments: when Astra starts one of these lines, the music swells up under her
// instead of dipping (and a bright chord blooms).
const SWELLS = new Set(['ch1_04', 'ch2_08', 'ch3_06', 'ch4_09', 'ch5_06', 'ch5_12', 'ch6_05', 'ch7_04', 'ch7_12', 'ch8_04', 'ch8_10', 'ch9_02', 'ch9_05', 'ch9_09', 'ch10_05', 'ch10_09', 'ch14_08', 'ch14_11', 'ch14_12', 'br3_01']);

export class Music {
  constructor(G) {
    this.G = G; this.files = {}; this.cur = null; this.duck = 1;
    this.ready = fetch(DIR + 'index.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((j) => { this.files = j || {}; }).catch(() => {});
  }

  async play(name, mood = null, vol = 0.5) {
    const A = this.G.audio; if (!A.ctx) return;
    this.stop(3);
    await this.ready;
    const ctx = A.ctx, out = ctx.createGain(); out.gain.value = 0.0001; out.connect(A.master);
    out.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 4);
    const cur = this.cur = { out, vol, nodes: [], name };
    if (this.files[name]) {
      try {
        const ab = await (await fetch(DIR + this.files[name])).arrayBuffer();
        const buf = await new Promise((ok, fail) => ctx.decodeAudioData(ab, ok, fail));
        if (this.cur !== cur) return;
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(out); src.start();
        cur.nodes.push(src); return;
      } catch (e) { console.warn('Music file failed, using the generated score', e); }
    }
    this.score(cur, MOODS[mood || name] || MOODS.dawn);
  }

  // The generated score: a low drone, one chord every `tempo` seconds gently overlapping, a few
  // sparkles high above, and now and then a short phrase on the chapter's lead voice
  score(cur, m) {
    const ctx = this.G.audio.ctx, lp = cur.lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(cur.out);
    cur.m = m;
    // the drone: two soft sines a fifth apart, breathing slowly
    for (const [semi, g0] of [[m.drone ?? -21, 0.05], [(m.drone ?? -21) + 7, 0.025]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = N(semi);
      const g = ctx.createGain(); g.gain.value = g0;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.05; const lg = ctx.createGain(); lg.gain.value = g0 * 0.5;
      lfo.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(lp); o.start(); lfo.start(); cur.nodes.push(o, lfo);
    }
    let i = 0;
    const chord = () => {
      if (this.cur !== cur) return;
      this.chord(cur, m.chords[i++ % m.chords.length], 0.05, m.tempo);
      // two or three soft bell-like notes high above
      const t = ctx.currentTime;
      for (let k = 0; k < 2 + (i % 2); k++) this.bellNote(cur, t + 1 + Math.random() * (m.tempo - 2), N(m.twinkle[Math.floor(Math.random() * m.twinkle.length)]), 0.035);
      // every other chord, a short phrase on the lead voice
      if (m.lead && i % 2 === 0) {
        let tt = t + 1.5 + Math.random() * 2, k = Math.floor(Math.random() * m.scale.length);
        for (let j = 0, n = 3 + Math.floor(Math.random() * 3); j < n; j++) {
          k = Math.max(0, Math.min(m.scale.length - 1, k + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))));
          const len = m.lead === 'lyre' ? 0.6 + Math.random() * 0.5 : 0.9 + Math.random() * 1.1;
          this.lead(cur, m.lead, tt, N(m.scale[k]), len); tt += len * (m.lead === 'lyre' ? 0.8 : 1);
        }
      }
      cur.timer = setTimeout(chord, m.tempo * 1000);
    };
    chord();
  }

  chord(cur, notes, peak, tempo) {
    const ctx = this.G.audio.ctx, t = ctx.currentTime, len = tempo * 1.6;
    for (const n of notes) for (const det of [-3, 3]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = N(n); o.detune.value = det;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + tempo * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g); g.connect(cur.lp); o.start(t); o.stop(t + len + 0.1);
    }
  }

  bellNote(cur, tt, f, peak) {
    const ctx = this.G.audio.ctx, o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(peak, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 2.5);
    o.connect(g); g.connect(cur.out); o.start(tt); o.stop(tt + 2.6);
  }

  // One note on the lead voice
  lead(cur, kind, t, f, len) {
    const ctx = this.G.audio.ctx, A = this.G.audio, g = ctx.createGain(); g.connect(cur.lp);
    if (kind === 'lyre') {
      // plucked: bright at first, fading fast, with an octave shimmer
      for (const [mul, p] of [[1, 0.06], [2, 0.02], [3, 0.008]]) {
        const o = ctx.createOscillator(); o.type = mul === 1 ? 'triangle' : 'sine'; o.frequency.value = f * mul;
        const gg = ctx.createGain(); gg.gain.setValueAtTime(0.0001, t); gg.gain.exponentialRampToValueAtTime(p, t + 0.005); gg.gain.exponentialRampToValueAtTime(0.0001, t + len * 2.2);
        o.connect(gg); gg.connect(g); o.start(t); o.stop(t + len * 2.3);
      }
      return;
    }
    // flute or reed: a held note that swells and fades, with a little vibrato
    const o = ctx.createOscillator(); o.type = kind === 'reed' ? 'sawtooth' : 'sine'; o.frequency.value = f;
    const vib = ctx.createOscillator(); vib.frequency.value = 5; const vg = ctx.createGain(); vg.gain.value = f * 0.006; vib.connect(vg); vg.connect(o.frequency);
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = kind === 'reed' ? f * 3 : f * 2; fl.Q.value = kind === 'reed' ? 4 : 0.7;
    const peak = kind === 'reed' ? 0.03 : 0.045;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + len * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(fl); fl.connect(g); o.start(t); vib.start(t); o.stop(t + len + 0.05); vib.stop(t + len + 0.05);
    if (kind === 'flute' && A.noiseBuf) {
      // the breath in a bone flute
      const nz = ctx.createBufferSource(); nz.buffer = A.noiseBuf; const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f * 2; nf.Q.value = 3;
      const ng = ctx.createGain(); ng.gain.value = 0.25; nz.connect(nf); nf.connect(ng); ng.connect(g); nz.start(t, Math.random()); nz.stop(t + len);
    }
  }

  // A big moment: the music rises for `secs` and a bright chord blooms
  swell(secs = 14) {
    const c = this.cur; if (!c || !this.G.audio.ctx) return;
    this.swellUntil = this.G.t + secs;
    if (c.m) {
      const top = c.m.chords[0].map((n) => n + 12);
      this.chord(c, [...c.m.chords[0], ...top], 0.04, secs * 0.45);
      for (let k = 0; k < 5; k++) this.bellNote(c, this.G.audio.ctx.currentTime + 0.5 + k * 0.35, N(c.m.twinkle[k % c.m.twinkle.length] + 12), 0.03);
    }
    if (c.lp) { const t = this.G.audio.ctx.currentTime; c.lp.frequency.setTargetAtTime(3200, t, 2); c.lp.frequency.setTargetAtTime(1400, t + secs * 0.7, 3); }
  }

  // A one-off piece of music over the top (a launch, a fanfare): the loop fades right down, `file`
  // (in sounds/music/) plays once at `vol`, then the loop comes back. Call preload(file) earlier so it
  // starts exactly on time. Resolves when it starts playing (false if it couldn't).
  async preload(file) {
    const A = this.G.audio; if (!A.ctx) return null;
    this.bufs ||= {};
    this.bufs[file] ||= fetch(DIR + file).then((r) => r.arrayBuffer()).then((ab) => new Promise((ok, fail) => A.ctx.decodeAudioData(ab, ok, fail))).catch((e) => { console.warn('Music file failed', file, e); return null; });
    return this.bufs[file];
  }
  async sting(file, vol = 0.8, { duck = 0.08, fade = 1.5 } = {}) {
    const A = this.G.audio; if (!A.ctx) return false;
    const buf = await this.preload(file); if (!buf) return false;
    this.stopSting(0.3);
    const ctx = A.ctx, out = ctx.createGain(), t = ctx.currentTime;
    out.gain.setValueAtTime(vol, t); out.connect(A.master);
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(out); src.start(t);
    const S = this.stingCur = { src, out, duck, fade, until: this.G.t + buf.duration };
    src.onended = () => { if (this.stingCur === S) this.stingCur = null; out.disconnect(); };
    return true;
  }
  stopSting(fade = 1.5) {
    const S = this.stingCur; if (!S) return; this.stingCur = null;
    const t = this.G.audio.ctx.currentTime;
    S.out.gain.cancelScheduledValues(t); S.out.gain.setValueAtTime(Math.max(0.0001, S.out.gain.value), t); S.out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    try { S.src.stop(t + fade + 0.05); } catch (e) { /* done */ }
  }

  stop(fade = 2) {
    if (this.stingCur) this.stopSting(fade);
    const c = this.cur; if (!c) return; this.cur = null;
    clearTimeout(c.timer);
    const ctx = this.G.audio.ctx, t = ctx.currentTime;
    c.out.gain.cancelScheduledValues(t); c.out.gain.setValueAtTime(Math.max(0.0001, c.out.gain.value), t); c.out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { for (const n of c.nodes) try { n.stop(); } catch (e) { /* done */ } c.out.disconnect(); }, fade * 1000 + 200);
  }

  // Duck under Astra's voice (but rise for the big moments); quieter during the flights between chapters
  update(dt) {
    const c = this.cur; if (!c || !this.G.audio.ctx) return;
    const id = this.G.narration.cur?.id;
    if (id !== this.lastLine) { this.lastLine = id; if (SWELLS.has(id)) this.swell(16); }
    const swelling = this.G.t < (this.swellUntil || 0);
    const S = this.stingCur, talking = S ? S.duck : swelling ? 1.5 : this.G.narration.cur ? 0.45 : 1;
    this.duck += (talking - this.duck) * Math.min(1, dt * (S ? 1.5 / S.fade : swelling ? 0.6 : 2));
    if (c.out.gain.value > 0.01 && this.G.t > (c.t0 ??= this.G.t + 4)) c.out.gain.setTargetAtTime(c.vol * this.duck * (this.G.paused ? 0.35 : 1), this.G.audio.ctx.currentTime, 0.3);
  }
}
