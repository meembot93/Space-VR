// 3D soundscapes: steady sounds placed around you in each chapter, so every place sounds alive.
// A roaring campfire, a river flowing past, waves breaking, a town murmuring, a hall's hush.
// Each is a loop made here in WebAudio (no sound files, nothing to license), played through a
// 3D panner at its spot in the world, so turning your head moves it around you.
//
// The chapters' own one-off sounds (crackles, crickets, birds, bells) still play on top of these.
// This file only reads a chapter's state (which part you're in, where the fires are); it never
// changes the chapter, so the chapters stay as they are.
//
// Recipes are at the bottom: one per chapter, a list of beds:
//   { kind, at: Vector3 or (ch, listener) => Vector3, vol, ref, on: (ch) => bool }
// kind is one of the loops in LOOPS; `ref` is how far (m) it stays at full volume; a bed fades in
// and out with on(). A bed with `follow` (a function) moves with you, e.g. along a river bank.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _L = new THREE.Vector3();
const SR = 24000; // the loops are made at a lower rate: plenty for ambience, and quick to make

// ---------- Small DSP helpers for making the loops ----------
function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5 | 0) >>> 0) / 4294967296; }
// A 2-pole resonant band-pass, run over a buffer in place
function resonate(x, f, q) {
  const w = 2 * Math.PI * f / SR, r = Math.exp(-w / (2 * q)), a1 = 2 * r * Math.cos(w), a2 = -r * r, g = 1 - r;
  let y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const y = g * x[i] + a1 * y1 + a2 * y2; y2 = y1; y1 = y; x[i] = y; }
  return x;
}
function lowpass(x, f) { const k = 1 - Math.exp(-2 * Math.PI * f / SR); let y = 0; for (let i = 0; i < x.length; i++) { y += k * (x[i] - y); x[i] = y; } return x; }
function highpass(x, f) { const k = 1 - Math.exp(-2 * Math.PI * f / SR); let y = 0; for (let i = 0; i < x.length; i++) { y += k * (x[i] - y); x[i] -= y; } return x; }
function noise(n, r) { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = r() * 2 - 1; return x; }
// Slow random wobble (0..1), smooth, for gusts and swells
function wobble(n, r, rate) {
  const out = new Float32Array(n), step = Math.max(1, Math.floor(SR / rate)); let a = r(), b = r();
  for (let i = 0; i < n; i++) { const k = (i % step) / step; if (k === 0 && i) { a = b; b = r(); } out[i] = a + (b - a) * (k * k * (3 - 2 * k)); }
  return out;
}
function normalize(x, peak = 0.8) { let m = 1e-6; for (const v of x) m = Math.max(m, Math.abs(v)); const g = peak / m; for (let i = 0; i < x.length; i++) x[i] *= g; return x; }
// Make the end blend into the start, so the loop has no seam
function seamless(x, fade = 0.5) {
  const n = Math.floor(fade * SR), out = x.slice(0, x.length - n);
  for (let i = 0; i < n; i++) { const k = i / n; out[i] = x[i] * Math.sqrt(k) + x[x.length - n + i] * Math.sqrt(1 - k); }
  return out;
}

// ---------- The loops ----------
const LOOPS = {
  // A campfire: a low breathy roar that swells, plus crackles and the odd pop
  fire(r) {
    const n = SR * 7, x = lowpass(noise(n, r), 380), w = wobble(n, r, 1.5);
    for (let i = 0; i < n; i++) x[i] *= 0.5 + 0.8 * w[i];
    normalize(x, 0.35);
    for (let t = 0; t < n;) {
      t += Math.floor(SR * (0.015 + r() * r() * 0.25));
      const len = Math.floor(SR * (0.002 + r() * 0.012)), amp = 0.15 + r() * r() * 0.85, big = r() < 0.06;
      for (let j = 0; j < len * (big ? 6 : 1) && t + j < n; j++) x[t + j] += (r() * 2 - 1) * amp * Math.exp(-j / (len * (big ? 2 : 0.4)));
    }
    return seamless(highpass(x, 40));
  },
  // A big river: a broad rush, with bubbles and gurgles near the bank
  river(r) {
    const n = SR * 8, x = noise(n, r), y = resonate(x.slice(), 520, 0.6), z = resonate(noise(n, r), 1500, 0.8), w = wobble(n, r, 0.7);
    for (let i = 0; i < n; i++) x[i] = y[i] * (0.8 + 0.3 * w[i]) + z[i] * 0.35;
    normalize(x, 0.4);
    for (let k = 0; k < n / SR * 26; k++) {
      // a bubble: a short sine that rises in pitch as it dies away
      const t0 = Math.floor(r() * n), f0 = 350 + r() * 900, len = Math.floor(SR * (0.02 + r() * 0.05)), amp = 0.06 + r() * 0.12;
      let ph = 0;
      for (let j = 0; j < len && t0 + j < n; j++) { const f = f0 * (1 + 1.4 * j / len); ph += 2 * Math.PI * f / SR; x[t0 + j] += Math.sin(ph) * amp * Math.exp(-4 * j / len); }
    }
    return seamless(highpass(x, 60), 1);
  },
  // Waves on a shore or against a hull: two slow swells per loop, each with a hiss as it breaks
  surf(r) {
    const n = SR * 15, lo = lowpass(noise(n, r), 300), hi = highpass(noise(n, r), 2500), out = new Float32Array(n);
    const waves = [[0.3, 1], [7.6, 0.75]];
    for (let i = 0; i < n; i++) {
      const t = i / SR; let e = 0.12, f = 0.02;
      for (const [w0, a] of waves) {
        for (const off of [0, 15]) {      // wrap round the loop
          const u = t - w0 + off; if (u < -3 || u > 9) continue;
          e += a * (u < 0 ? Math.exp(u * 1.2) : Math.exp(-u / 2.2));            // rises, then rolls back
          f += a * (u < 0 ? 0 : (u < 0.6 ? u / 0.6 : Math.exp(-(u - 0.6) / 1.4))) * 0.6; // the fizz as it breaks
        }
      }
      out[i] = lo[i] * e * 1.6 + hi[i] * f * 0.25;
    }
    return normalize(out, 0.5);
  },
  // A crowd far off: lots of people talking at once, no words you could make out.
  // Each "voice" is a buzzing throat sound through two moving vowel shapes, in syllables.
  crowd(r) {
    const n = SR * 8, out = new Float32Array(n);
    const VOWELS = [[730, 1090], [270, 2290], [530, 1840], [570, 840], [440, 1020], [300, 870], [660, 1720]];
    for (let v = 0; v < 10; v++) {
      const f0 = 95 + r() * 140, src = new Float32Array(n), env = new Float32Array(n);
      let ph = 0, t = Math.floor(r() * SR), f = f0;
      while (t < n) {
        const syl = Math.floor(SR * (0.12 + r() * 0.16)), gap = r() < 0.15 ? Math.floor(SR * (0.3 + r() * 1.2)) : Math.floor(SR * 0.03);
        for (let j = 0; j < syl && t + j < n; j++) env[t + j] = Math.sin(Math.PI * j / syl);
        t += syl + gap;
      }
      for (let i = 0; i < n; i++) {
        f = f0 * (1 + 0.12 * Math.sin(i / SR * (1.3 + v * 0.17)));
        ph += f / SR; if (ph >= 1) ph -= 1;
        src[i] = (ph * 2 - 1) * env[i];
      }
      // the vowel changes every syllable or so; run two formant filters in short blocks
      const blk = Math.floor(SR * 0.18);
      for (let s = 0; s < n; s += blk) {
        const [F1, F2] = VOWELS[Math.floor(r() * VOWELS.length)], seg = src.subarray(s, Math.min(n, s + blk));
        const a = resonate(seg.slice(), F1, 6), b = resonate(seg.slice(), F2, 9);
        for (let i = 0; i < seg.length; i++) out[s + i] += a[i] + b[i] * 0.5;
      }
    }
    const w = wobble(n, r, 0.5); for (let i = 0; i < n; i++) out[i] *= 0.75 + 0.35 * w[i];
    return seamless(normalize(lowpass(highpass(out, 150), 2600), 0.5), 0.8);
  },
  // Wind through leaves and palm fronds: a soft hiss that comes and goes in gusts
  leaves(r) {
    const n = SR * 10, x = highpass(noise(n, r), 1800), w = wobble(n, r, 0.4), w2 = wobble(n, r, 6);
    for (let i = 0; i < n; i++) x[i] *= Math.pow(w[i], 2) * (0.7 + 0.3 * w2[i]);
    return seamless(normalize(lowpass(x, 6000), 0.4), 1);
  },
  // Gas venting from a cold rocket: a steady hiss that sighs louder now and then
  vent(r) {
    const n = SR * 6, x = highpass(noise(n, r), 2200), w = wobble(n, r, 0.7);
    for (let i = 0; i < n; i++) x[i] *= 0.45 + 0.55 * w[i] * w[i];
    return seamless(normalize(lowpass(x, 7000), 0.35), 0.8);
  },
  // The hush of a big stone room: a very low, soft air sound
  room(r) {
    const n = SR * 6, x = lowpass(noise(n, r), 220);
    return seamless(normalize(highpass(x, 50), 0.4), 1);
  },
};

// ---------- Playing them ----------
export class Soundscape {
  constructor(G) { this.G = G; this.bufs = {}; this.beds = []; this.ch = null; this.level = 1; }

  buffer(kind) {
    if (this.bufs[kind]) return this.bufs[kind];
    const ctx = this.G.audio.ctx, data = LOOPS[kind](rnd(kind.length * 7919 + 13));
    const b = ctx.createBuffer(1, data.length, SR); b.copyToChannel(data, 0);
    return (this.bufs[kind] = b);
  }

  // Fade the whole soundscape (the chapter flights turn it down)
  setLevel(v) { this.level = v; }

  clear() {
    for (const b of this.beds) {
      const t = this.G.audio.ctx.currentTime; b.g.gain.setTargetAtTime(0, t, 0.4);
      setTimeout(() => { try { b.src.stop(); } catch (e) { /* done */ } b.g.disconnect(); b.p?.disconnect(); }, 2500);
    }
    this.beds = [];
  }

  build(n, ch) {
    this.clear();
    const A = this.G.audio, ctx = A.ctx, recipe = RECIPES[n]?.(ch) || [];
    for (const d of recipe) {
      const src = ctx.createBufferSource(); src.buffer = this.buffer(d.kind); src.loop = true;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(g);
      let p = null;
      if (d.at || d.follow) {
        p = ctx.createPanner(); p.panningModel = d.wide ? 'equalpower' : 'HRTF'; p.distanceModel = 'inverse';
        p.refDistance = d.ref ?? 4; p.rolloffFactor = d.rolloff ?? 1; p.maxDistance = 3000;
        g.connect(p); p.connect(A.master);
      } else g.connect(A.master);
      src.start(0, Math.random() * src.buffer.duration);
      this.beds.push({ ...d, src, g, p, v: 0 });
    }
  }

  update(dt) {
    const G = this.G, A = G.audio;
    if (!A.ctx) return;
    // make every loop once, at the start while the screen is still dark, so nothing stutters later
    if (!this.warm) { this.warm = true; for (const k of Object.keys(LOOPS)) this.buffer(k); }
    const ch = G.director.chapter;
    if (ch !== this.ch) { this.ch = ch; if (ch) this.build(G.director.n, ch); else this.clear(); }
    if (!ch) return;
    const L = G.camera.getWorldPosition(_L), now = A.ctx.currentTime;
    const all = this.level * (G.paused ? 0.4 : 1);
    for (const b of this.beds) {
      let on = true; try { on = b.on ? !!b.on(ch) : true; } catch (e) { on = false; }
      const want = on ? b.vol * all : 0;
      if (Math.abs(want - b.v) > 0.001) { b.v = want; b.g.gain.setTargetAtTime(want, now, b.fade ?? 1.2); }
      // a bed that's been silent a while is unplugged, so the headset doesn't spend time on it
      b.off = want > 0 ? 0 : (b.off || 0) + dt;
      const plug = b.off < 6;
      if (plug !== (b.plugged ?? true)) { b.plugged = plug; const last = b.p || b.g; if (plug) last.connect(A.master); else last.disconnect(); }
      if (b.p && on) {
        let pos = b.at;
        if (b.follow) { try { pos = b.follow(ch, L); } catch (e) { pos = null; } }
        if (pos && !(pos instanceof THREE.Vector3)) pos = _v.set(pos[0], pos[1], pos[2]);
        if (pos) {
          if (b.p.positionX) { b.p.positionX.setTargetAtTime(pos.x, now, 0.1); b.p.positionY.setTargetAtTime(pos.y, now, 0.1); b.p.positionZ.setTargetAtTime(pos.z, now, 0.1); }
          else b.p.setPosition(pos.x, pos.y, pos.z);
        }
      }
    }
  }
}

// ---------- One recipe per chapter ----------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (az, r, y = 0) => V(Math.sin(az * Math.PI / 180) * r, y, -Math.cos(az * Math.PI / 180) * r);
const RECIPES = {
  // Ch1: the fire you sit by
  1: () => [
    { kind: 'fire', at: V(0, 0.5, 0), vol: 0.55, ref: 1.6, rolloff: 1.2 },
  ],
  // Ch2: the builders' crowd by the stones, the village far off, a breeze in the trees
  2: () => [
    { kind: 'crowd', at: V(0, 1.5, 0), vol: 0.22, ref: 10, rolloff: 1 },
    { kind: 'crowd', at: at(150, 165, 2), vol: 0.12, ref: 30, rolloff: 1 },
    { kind: 'leaves', at: at(230, 120, 6), vol: 0.1, ref: 40, wide: true },
  ],
  // Ch3: the Nile flowing past below the village, palms rustling, the village waking after the bell.
  // Then the windy hilltop in Germany (wind is the shared ambience, so nothing extra there).
  3: () => [
    { kind: 'river', follow: (ch, L) => V(410 + Math.sin(L.z / 420) * 40 - 225, 0, L.z), vol: 0.5, ref: 60, rolloff: 1, wide: true, on: (ch) => ch.s?.scene !== 'nebra' },
    { kind: 'leaves', at: V(150, 6, -40), vol: 0.1, ref: 40, wide: true, on: (ch) => ch.s?.scene !== 'nebra' },
    { kind: 'crowd', at: V(-125, 4, 0), vol: 0.18, ref: 40, on: (ch) => ch.s?.scene !== 'nebra' && (ch.s?.lights ?? 0) > 0.3 },
  ],
  // Ch4: the city of Babylon murmuring below the ziggurat, the Euphrates to the west
  4: () => [
    { kind: 'crowd', at: V(-50, -22, 60), vol: 0.16, ref: 30 },
    { kind: 'crowd', at: V(70, -22, -40), vol: 0.12, ref: 30 },
    { kind: 'river', follow: (ch, L) => V(-150 + 34, -24, L.z), vol: 0.35, ref: 60, wide: true },
  ],
  // Ch5: five places. The temple fires and the sea in Athens; the Nile at Syene; the harbour and
  // the busy square in Alexandria; palms in China's courtyard; wind on Rhodes (shared ambience).
  5: (ch) => {
    const set = (name) => (c) => c.cur === name;
    const altar = ch.fires?.[2] || V(9, 1.5, 0);
    return [
      { kind: 'fire', at: altar, vol: 0.4, ref: 2, rolloff: 1.2, on: set('grove') },
      { kind: 'surf', follow: (c, L) => V(L.x, -29, 260), vol: 0.35, ref: 90, wide: true, on: set('grove') },
      { kind: 'leaves', at: V(-30, 5, -20), vol: 0.12, ref: 25, wide: true, on: set('grove') },
      { kind: 'river', follow: (c, L) => V(52 - 13, 0, L.z), vol: 0.3, ref: 25, wide: true, on: set('syene') },
      { kind: 'leaves', at: V(40, 6, 0), vol: 0.1, ref: 30, wide: true, on: set('syene') },
      { kind: 'surf', follow: (c, L) => V(L.x, 0, -150), vol: 0.3, ref: 60, wide: true, on: set('alex') },
      { kind: 'crowd', at: V(-20, 2, 30), vol: 0.18, ref: 18, on: set('alex') },
      { kind: 'crowd', at: V(25, 2, -10), vol: 0.12, ref: 18, on: set('alex') },
      { kind: 'leaves', at: V(6, 5, -10), vol: 0.1, ref: 15, wide: true, on: set('china') },
    ];
  },
  // Ch6: waves slapping the boat all round you (not underwater: the chapter has its own hush there)
  6: () => [
    { kind: 'surf', at: V(-7, 0, 1), vol: 0.3, ref: 5, on: (ch) => ch.sceneNow !== 'sea' },
    { kind: 'surf', at: V(7, 0, -2), vol: 0.25, ref: 5, on: (ch) => ch.sceneNow !== 'sea' },
  ],
  // Ch7: the hush of the great hall, and the city outside its windows (gone in Ptolemy's cosmos)
  7: () => [
    { kind: 'room', vol: 0.1, on: (ch) => ch.hall?.visible !== false },
    { kind: 'crowd', at: V(-14, 4, 0), vol: 0.07, ref: 10, on: (ch) => ch.hall?.visible !== false },
    { kind: 'crowd', at: V(14, 4, -6), vol: 0.06, ref: 10, on: (ch) => ch.hall?.visible !== false },
  ],
  // Era 2, Ch1 (Frombork): the brazier on the tower, the lagoon lapping below, the town murmuring, leaves
  8: () => [
    { kind: 'fire', at: V(-1.9, 14.6, 1.9), vol: 0.3, ref: 1.5, rolloff: 1.2 },
    { kind: 'surf', follow: (ch, L) => V(L.x, -19.6, -165), vol: 0.18, ref: 80, wide: true },
    { kind: 'crowd', at: V(-45, -14, -100), vol: 0.05, ref: 40 },
    { kind: 'leaves', at: V(-30, -6, -30), vol: 0.07, ref: 40, wide: true },
  ],
  // Era 2, Ch3: Prague at night below the study window, the stove crackling
  10: () => [
    { kind: 'fire', at: V(2, 13.6, 1.6), vol: 0.18, ref: 1.5, rolloff: 1.2 },
    { kind: 'crowd', at: V(50, 2, -100), vol: 0.06, ref: 40 },
    { kind: 'river', follow: (ch, L) => V(-330, -2, L.z), vol: 0.12, ref: 120, wide: true },
  ],
  // Era 2, Ch5 (Woolsthorpe): leaves in the orchard round you, the stream down in the valley
  12: () => [
    { kind: 'leaves', at: V(5, 3, -1), vol: 0.1, ref: 8, wide: true },
    { kind: 'leaves', at: V(-12, 4, 10), vol: 0.06, ref: 15, wide: true },
    { kind: 'river', at: V(235, -14, 0), vol: 0.08, ref: 60, wide: true },
  ],
  // Era 2, Ch4: Venice (the lagoon lapping, the Piazza's crowd far below); Padua (the canal, the garden's leaves)
  11: () => [
    { kind: 'surf', follow: (ch, L) => V(L.x, 0, 110), vol: 0.18, ref: 80, wide: true, on: (ch) => ch.cur === 'venice' },
    { kind: 'crowd', at: V(-70, 2, -15), vol: 0.1, ref: 50, on: (ch) => ch.cur === 'venice' },
    { kind: 'river', follow: (ch, L) => V(L.x, 0, -62), vol: 0.1, ref: 40, wide: true, on: (ch) => ch.cur === 'padua' },
    { kind: 'leaves', at: V(0, 4, -28), vol: 0.06, ref: 20, wide: true, on: (ch) => ch.cur === 'padua' },
    { kind: 'crowd', at: V(0, 2, 16), vol: 0.035, ref: 20, on: (ch) => ch.cur === 'padua' },
  ],
  // Era 2, Ch2: the bare trees round Herrevad's fields; then on Hven the sea at the cliffs, the helpers
  9: () => [
    { kind: 'leaves', at: V(-20, 5, -30), vol: 0.06, ref: 30, wide: true, on: (ch) => ch.cur === 'abbey' },
    { kind: 'crowd', at: V(50, 2, 20), vol: 0.04, ref: 20, on: (ch) => ch.cur === 'abbey' },
    { kind: 'surf', follow: (ch, L) => L.clone().setLength(270).setY(-26), vol: 0.22, ref: 120, wide: true, on: (ch) => ch.cur === 'hven' },
    { kind: 'crowd', at: V(0, 2, -20), vol: 0.05, ref: 15, on: (ch) => ch.cur === 'hven' },
  ],
  // Era 2, Ch7 (Sputnik): oxygen hissing off the rocket, engineers by the bunker; a town at dusk; grass on the hill
  14: () => [
    { kind: 'vent', follow: (ch) => ch.W(0, 15, 0), vol: 0.3, ref: 10, on: (ch) => (ch.cur === 'pad' || ch.cur === 'lift') && ch.launchT < 0 },
    { kind: 'crowd', follow: (ch) => ch.W(-14, 1.5, 18), vol: 0.06, ref: 8, on: (ch) => ch.cur === 'pad' },
    { kind: 'crowd', at: V(0, 4, -60), vol: 0.1, ref: 40, on: (ch) => ch.cur === 'roofs' },
    { kind: 'leaves', at: V(30, 2, -20), vol: 0.06, ref: 30, wide: true, on: (ch) => ch.cur === 'hill' },
  ],
};
