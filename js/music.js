// Background music. Each chapter asks for a mood by name (e.g. 'ch2'); if sounds/music/index.json
// lists a file for it, that file loops, e.g. { "ch2": "stonehenge.mp3" }. Drop in any track you
// like (your own, or free music whose license allows any use) and list it there.
// With no file listed, a soft generated score plays instead: slow warm chords and a few
// twinkling notes, made in WebAudio (no samples, nothing to license).
// The music dips while Astra is talking.
const DIR = new URL('../sounds/music/', import.meta.url).href;

// Chord progressions per mood: each chord is a list of note frequencies (Hz)
const N = (semi) => 220 * Math.pow(2, semi / 12); // semitones from A3
const MOODS = {
  dawn: { chords: [[-9, -2, 3, 7], [-7, 0, 5, 9], [-12, -5, 0, 4], [-10, -3, 2, 5]], tempo: 9, twinkle: [12, 14, 16, 19, 21, 24] },
};

export class Music {
  constructor(G) {
    this.G = G; this.files = {}; this.cur = null; this.duck = 1;
    this.ready = fetch(DIR + 'index.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((j) => { this.files = j || {}; }).catch(() => {});
  }

  async play(name, mood = 'dawn', vol = 0.5) {
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
    this.score(cur, MOODS[mood] || MOODS.dawn);
  }

  // The generated score: one chord every `tempo` seconds, gently overlapping, plus sparkles
  score(cur, m) {
    const ctx = this.G.audio.ctx, lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(cur.out);
    let i = 0;
    const chord = () => {
      if (this.cur !== cur) return;
      const t = ctx.currentTime, notes = m.chords[i++ % m.chords.length], len = m.tempo * 1.6;
      for (const n of notes) for (const det of [-3, 3]) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = N(n); o.detune.value = det;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + m.tempo * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        o.connect(g); g.connect(lp); o.start(t); o.stop(t + len + 0.1);
      }
      // two or three soft bell-like notes high above
      for (let k = 0; k < 2 + (i % 2); k++) {
        const tt = t + 1 + Math.random() * (m.tempo - 2), f = N(m.twinkle[Math.floor(Math.random() * m.twinkle.length)]);
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.035, tt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, tt + 2.5);
        o.connect(g); g.connect(cur.out); o.start(tt); o.stop(tt + 2.6);
      }
      cur.timer = setTimeout(chord, m.tempo * 1000);
    };
    chord();
  }

  stop(fade = 2) {
    const c = this.cur; if (!c) return; this.cur = null;
    clearTimeout(c.timer);
    const ctx = this.G.audio.ctx, t = ctx.currentTime;
    c.out.gain.cancelScheduledValues(t); c.out.gain.setValueAtTime(Math.max(0.0001, c.out.gain.value), t); c.out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { for (const n of c.nodes) try { n.stop(); } catch (e) { /* done */ } c.out.disconnect(); }, fade * 1000 + 200);
  }

  // Duck under Astra's voice
  update(dt) {
    const c = this.cur; if (!c || !this.G.audio.ctx) return;
    const talking = this.G.narration.cur ? 0.45 : 1;
    this.duck += (talking - this.duck) * Math.min(1, dt * 2);
    if (c.out.gain.value > 0.01 && this.G.t > (c.t0 ??= this.G.t + 4)) c.out.gain.setTargetAtTime(c.vol * this.duck * (this.G.paused ? 0.35 : 1), this.G.audio.ctx.currentTime, 0.3);
  }
}
