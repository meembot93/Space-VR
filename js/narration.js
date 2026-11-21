// Plays the guide's narration: Meem's recorded clip for a line if there is one, otherwise a
// subtitle on its own for about as long as the line would take to say (a placeholder).
//
// Which clips exist is listed in sounds/narration/index.json, e.g. { "ch2_01": "ch2_01.mp3" }.
// tools/narration/import.py writes that file when it adds Meem's recordings.
import { LINES, GUIDE_NAME } from './script.js';

const DIR = new URL('../sounds/narration/', import.meta.url).href;

export class Narration {
  constructor(G) {
    this.G = G;
    this.files = {};
    this.buffers = new Map();
    this.cur = null;      // { id, src, endT }
    this.level = 0;       // how loud the voice is right now, 0..1 (the guide star glows with it)
    this.speed = G.params.has('fast') ? 6 : 1; // ?fast: placeholder lines go by quickly (testing)
    this.ready = fetch(DIR + 'index.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).then((j) => { this.files = j || {}; }).catch(() => {});
  }

  has(id) { return !!this.files[id]; }

  // Start fetching a chapter's clips so they play without a pause
  preload(prefix) {
    this.ready.then(() => { for (const id of Object.keys(this.files)) if (id.startsWith(prefix)) this.load(id).catch(() => {}); });
  }

  load(id) {
    if (!this.buffers.has(id)) {
      const ctx = this.G.audio.ctx;
      const p = fetch(DIR + this.files[id]).then((r) => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
        .then((ab) => new Promise((ok, fail) => (ctx || new OfflineAudioContext(1, 1, 44100)).decodeAudioData(ab, ok, fail)));
      this.buffers.set(id, p);
      p.catch(() => this.buffers.delete(id));
    }
    return this.buffers.get(id);
  }

  // Say a line. Resolves when it's finished (or cut off by stop()).
  async say(id) {
    this.stop();
    const text = LINES[id] || `[missing line ${id}]`;
    const token = this.cur = { id, src: null, done: null };
    await this.ready;
    let buf = null;
    if (this.has(id) && this.G.audio.ctx) { try { buf = await this.load(id); } catch (e) { buf = null; } }
    if (this.cur !== token) return;
    this.G.ui.subtitle(text, buf ? '' : this.G.debug ? `(placeholder: recording ${id} not added yet)` : '', GUIDE_NAME);
    this.G.events.emit('narrating', { id, on: true });
    await new Promise((ok) => {
      token.done = ok;
      if (buf) {
        const ctx = this.G.audio.ctx, src = ctx.createBufferSource(); src.buffer = buf;
        const an = ctx.createAnalyser(); an.fftSize = 256; token.an = an; token.data = new Float32Array(256);
        src.connect(an); an.connect(this.G.audio.voiceBus);
        src.onended = () => ok();
        src.start(); token.src = src;
      } else {
        // No recording yet: read time at about 2.6 words a second, plus a breath
        const words = text.split(/\s+/).length;
        token.fake = true; token.left = (Math.max(2.2, words / 2.6) + 0.4) / this.speed;
      }
    });
    if (this.cur === token) { this.cur = null; this.G.ui.subtitle(''); this.level = 0; this.G.events.emit('narrating', { id, on: false }); }
    await new Promise((ok) => setTimeout(ok, 350 / this.speed)); // a little pause between lines
  }

  stop() {
    const c = this.cur; if (!c) return;
    this.cur = null;
    try { c.src?.stop(); } catch (e) { /* already stopped */ }
    this.G.ui.subtitle(''); this.level = 0;
    c.done?.();
  }

  // Testing: skip the line being said (N key on desktop with ?debug)
  skip() { const c = this.cur; if (!c) return; if (c.fake) c.left = 0; else try { c.src?.stop(); } catch (e) { /* ignore */ } }

  update(dt) {
    const c = this.cur;
    if (!c) { this.level *= Math.exp(-dt * 8); return; }
    if (c.fake && c.done) {
      c.left -= dt;
      // A gentle made-up "talking" rhythm so the guide still pulses with placeholder lines
      this.level = 0.35 + 0.25 * Math.sin(this.G.t * 9) * Math.sin(this.G.t * 3.3);
      if (c.left <= 0) c.done();
    } else if (c.an) {
      c.an.getFloatTimeDomainData(c.data);
      let e = 0; for (let i = 0; i < c.data.length; i += 2) e += c.data[i] * c.data[i];
      const lv = Math.min(1, Math.sqrt(e / (c.data.length / 2)) * 6);
      this.level = Math.max(lv, this.level * Math.exp(-dt * 10));
    }
  }
}
