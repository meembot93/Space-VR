// Era 3 effects shared by every Space Race chapter: soft puffs (steam, smoke, dust, vapour) in one
// draw call, rocket flames, environment maps for shiny metal, and the sounds of the era made in
// WebAudio (no sound files): rocket roar, sirens, radio beeps and the Apollo "quindar" tones, the
// master alarm, suit breathing, a heartbeat, clanks and hisses.
import * as THREE from 'three';
import { canvasTex, lerp } from '../util.js';

const _col = new THREE.Color();

// ---------- Soft puffs: vapour, steam, dust and smoke, all in one draw call ----------
const PUFF_VS = `attribute float size; attribute vec4 tint; varying vec4 vT; uniform float scale;
  void main(){ vT = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
    gl_PointSize = size <= 0.0 ? 0.0 : clamp(size * scale / max(0.1, -mv.z), 1.0, 480.0); }`;
const PUFF_FS = `varying vec4 vT; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
    float a = (1.0 - smoothstep(0.25, 1.0, r)) * (0.85 + 0.15 * sin((c.x * 9.0 + c.y * 7.0) + vT.a * 31.0));
    gl_FragColor = vec4(vT.rgb, vT.a * a); }`;
export class Puffs {
  constructor(n, { floor = 0.3 } = {}) {
    this.n = n; this.i = 0; this.floor = floor;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.tint = new Float32Array(n * 4); this.size = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tint', new THREE.BufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ uniforms: { scale: { value: 420 } }, vertexShader: PUFF_VS, fragmentShader: PUFF_FS, transparent: true, depthWrite: false });
    this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    this.p = Array.from({ length: n }, () => ({ age: 1, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, a: 0, r: 1, g: 1, b: 1, drag: 0.5, hot: 0, rise: 0 }));
    this.live = 0;
  }
  emit(x, y, z, vx, vy, vz, s0, s1, life, col, a, drag = 0.5, hot = 0, rise = 0) {
    const q = this.p[this.i]; this.i = (this.i + 1) % this.n;
    Object.assign(q, { age: 0, life, x, y, z, vx, vy, vz, s0, s1, a, drag, hot, rise }); _col.setHex(col); q.r = _col.r; q.g = _col.g; q.b = _col.b;
  }
  clear() { for (const q of this.p) q.age = q.life = 1; }
  // G: for the point size in the headset; wind: [x, z] m/s; light(q): firelight on a puff (0..)
  update(G, dt, wind = [0, 0], light = null) {
    this.mat.uniforms.scale.value = G.mode === 'vr' ? 760 : innerHeight / (2 * Math.tan(G.camera.fov * Math.PI / 360));
    let live = 0;
    for (let i = 0; i < this.n; i++) {
      const q = this.p[i];
      if (q.age >= q.life) { this.size[i] = 0; continue; }
      live++;
      q.age += dt; const k = Math.min(1, q.age / q.life), dr = Math.exp(-q.drag * dt);
      q.vx = q.vx * dr + wind[0] * (1 - dr); q.vz = q.vz * dr + wind[1] * (1 - dr); q.vy = q.vy * dr + q.rise * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (this.floor != null && q.y < this.floor && q.vy < 0) { q.y = this.floor; q.vy = 0; }
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.size[i] = lerp(q.s0, q.s1, 1 - (1 - k) * (1 - k));
      const L = typeof light === 'function' ? light(q) : (light || 0) * Math.max(0, 1 - q.age / 4) * 0.6, hot = q.hot * (1 - k) * (1 - k);
      this.tint[i * 4] = Math.min(1.4, q.r + L * 1.0 + hot); this.tint[i * 4 + 1] = Math.min(1.2, q.g + L * 0.5 + hot * 0.75); this.tint[i * 4 + 2] = q.b + L * 0.15 + hot * 0.3;
      this.tint[i * 4 + 3] = q.a * Math.min(1, q.age * 3) * Math.pow(1 - k, 1.3);
    }
    this.live = live;
    const g = this.mesh.geometry; for (const n of ['position', 'tint', 'size']) g.attributes[n].needsUpdate = true;
  }
}

// ---------- Rocket flame: an additive teardrop of fire, brightest at the nozzle, flickering ----------
const FLAME_VS = `varying float vY; varying float vF; uniform float len;
  void main(){ vY = -position.y / len; vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`;
const FLAME_FS = `varying float vY; varying float vF; uniform float t; uniform float amt; uniform vec3 hot; uniform vec3 mid; uniform vec3 cool;
  void main(){ float k = clamp(vY, 0.0, 1.0);
    float fl = 0.85 + 0.15 * sin(t * 37.0 + k * 21.0) * sin(t * 23.0 - k * 9.0);
    vec3 c = mix(hot, mid, smoothstep(0.05, 0.4, k)); c = mix(c, cool, smoothstep(0.4, 1.0, k));
    float a = pow(vF, 1.4) * (1.0 - smoothstep(0.55, 1.0, k)) * fl * amt;
    gl_FragColor = vec4(c * a * 1.6, 1.0); }`;
// kind: 'kero' (orange-yellow, kerosene: R-7, Redstone, Atlas, Saturn first stage),
//       'hydro' (pale blue-violet, nearly clear: Saturn upper stages), 'hyper' (Titan: clear orange-pink)
export function flameMesh(len, width, kind = 'kero') {
  const prof = [[0.001, 0.35], [0.5, 0], [0.8, -0.12], [0.78, -0.35], [0.62, -0.6], [0.38, -0.85], [0.001, -1]].map(([r, y]) => new THREE.Vector2(r * width, y * len));
  const C = { kero: [[1, 0.97, 0.85], [1, 0.62, 0.2], [0.9, 0.25, 0.08]], hydro: [[0.85, 0.9, 1], [0.55, 0.55, 0.95], [0.3, 0.25, 0.6]], hyper: [[1, 0.9, 0.8], [1, 0.55, 0.4], [0.7, 0.25, 0.25]] }[kind];
  const mat = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, amt: { value: 0 }, len: { value: len }, hot: { value: new THREE.Vector3(...C[0]) }, mid: { value: new THREE.Vector3(...C[1]) }, cool: { value: new THREE.Vector3(...C[2]) } },
    vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), mat); m.frustumCulled = false; m.renderOrder = 3; m.visible = false;
  m.userData.set = (amt, t) => { mat.uniforms.amt.value = amt; mat.uniforms.t.value = t; m.visible = amt > 0.003; };
  return m;
}

// ---------- Environment maps for shiny metal ----------
const envCache = {};
export function envMap(kind = 'day') {
  if (envCache[kind]) return envCache[kind];
  const t = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    const S = {
      day: ['#4a78b8', '#9ec0e8', '#d8e4ee', '#8a8878', '#5a564c'],
      dawn: ['#2a3a6a', '#d89a78', '#f8c890', '#6a5a4a', '#3a342c'],
      night: ['#05070f', '#1a2440', '#4a4040', '#2a241e', '#100e0c'],
      space: ['#000006', '#000008', '#5a8ad0', '#1a3a70', '#0a1428'],
      room: ['#3a3a36', '#8a8a80', '#c8c8b8', '#5a5a52', '#2a2a26'],
      moon: ['#000004', '#000006', '#8a8a86', '#6a6a66', '#4a4a48'],
    }[kind];
    S.forEach((c, i) => gr.addColorStop([0, 0.4, 0.5, 0.56, 1][i], c));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (kind === 'night' || kind === 'space' || kind === 'moon') { g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 160; i++) g.fillRect((i * 97) % w, (i * 53) % (h * 0.45), 1.5, 1.5); }
    if (kind === 'space' || kind === 'moon' || kind === 'day') { const rg = g.createRadialGradient(128, 70, 0, 128, 70, 40); rg.addColorStop(0, 'rgba(255,255,250,1)'); rg.addColorStop(1, 'rgba(255,250,230,0)'); g.fillStyle = rg; g.fillRect(80, 30, 100, 100); }
    if (kind === 'room') { g.fillStyle = 'rgba(255,255,240,0.9)'; for (let i = 0; i < 6; i++) g.fillRect(40 + i * 80, 20, 40, 8); }
  });
  t.mapping = THREE.EquirectangularReflectionMapping;
  return (envCache[kind] = t);
}
// Give every standard material under obj this environment (and keep metal shiny)
export function setEnv(obj, env, k = 1) {
  obj.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) if (m.isMeshStandardMaterial) { m.envMap = env; m.envMapIntensity = k; m.needsUpdate = true; } });
}

// ---------- Sounds ----------
function noiseSrc(A, loop = true) { const s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf; s.loop = loop; return s; }
// A long noise with an envelope: rise a, hold h, fall d (seconds), through a filter
export function longNoise(A, out, { type = 'lowpass', f = 200, q = 0.7, peak = 1, a = 0.1, h = 1, d = 2, t0 = 0, f2 = null }) {
  const c = A.ctx, t = c.currentTime + t0, src = noiseSrc(A), fl = c.createBiquadFilter(), g = c.createGain();
  fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + h + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + h); g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + d);
  src.connect(fl); fl.connect(g); g.connect(out); src.start(t, Math.random()); src.stop(t + a + h + d + 0.1);
  return g;
}
// A rocket's roar: a deep rumble, a ragged mid roar, and the crackle big rockets make.
// size: 1 an R-7, 2.5 a Saturn V (deeper and longer crackle)
export function roar(G, pos, secs, vol = 1, size = 1) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 300, 0.6);
  longNoise(A, o, { type: 'lowpass', f: 70 / Math.sqrt(size), peak: 1.0, a: 1.2, h: secs * 0.45, d: secs * 0.55 });
  longNoise(A, o, { type: 'bandpass', f: 260 / Math.sqrt(size), f2: 140, q: 0.6, peak: 0.55, a: 0.8, h: secs * 0.35, d: secs * 0.6 });
  longNoise(A, o, { type: 'highpass', f: 2500, q: 0.5, peak: 0.12, a: 0.5, h: secs * 0.25, d: secs * 0.5 });
  const n = secs * 7 * size;
  for (let i = 0; i < n; i++) A.noise(o, { type: 'bandpass', f: 400 + Math.random() * 2400 / size, q: 1.5, peak: 0.3 * (1 - i / n), a: 0.003, d: 0.05 + Math.random() * 0.1 * size, t0: 0.6 + Math.random() * secs * 0.8 });
}
// The muffled rumble inside a cabin riding a rocket (no crackle, felt more than heard)
export function cabinRumble(G, secs, vol = 0.7) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(null, vol);
  longNoise(A, o, { type: 'lowpass', f: 55, peak: 1, a: 1.5, h: secs * 0.6, d: secs * 0.4 });
  longNoise(A, o, { type: 'bandpass', f: 140, q: 0.8, peak: 0.35, a: 1, h: secs * 0.5, d: secs * 0.5 });
  for (let i = 0; i < secs * 3; i++) A.noise(o, { type: 'bandpass', f: 300 + Math.random() * 500, q: 3, peak: 0.12, a: 0.004, d: 0.06, t0: Math.random() * secs * 0.8 });
}
// An air-raid style siren, rising and falling
export function siren(G, pos, secs = 6, vol = 0.5) {
  const A = G.audio; if (!A.ctx) return;
  const c = A.ctx, t = c.currentTime, o = A.out(pos, vol, 120, 0.5);
  for (const det of [0, 7]) {
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.detune.value = det;
    osc.frequency.setValueAtTime(220, t);
    for (let k = 0; k < secs / 3; k++) { osc.frequency.linearRampToValueAtTime(720, t + k * 3 + 1.6); osc.frequency.linearRampToValueAtTime(380, t + k * 3 + 3); }
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.8); g.gain.setValueAtTime(0.12, t + secs - 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
    osc.connect(lp); lp.connect(g); g.connect(o); osc.start(t); osc.stop(t + secs + 0.1);
  }
}
// A short radio beep (a satellite's signal), optionally from a place
export function beep(G, pos = null, vol = 0.14, f = 1000, d = 0.26) {
  const A = G.audio; if (!A.ctx) return;
  A.tone(A.out(pos, vol, 2), { type: 'square', f, peak: 0.12, a: 0.005, d });
}
// The Apollo "quindar" tones: a short high beep when Houston keys the radio, a lower one when they let go
export function quindar(G, out = true, vol = 0.12) {
  const A = G.audio; if (!A.ctx) return;
  A.tone(A.out(null, vol), { type: 'sine', f: out ? 2525 : 2475, peak: 0.3, a: 0.004, d: 0.25 });
}
// A burst of radio static (a crackle as a voice comes in, or drops out)
export function staticBurst(G, secs = 0.4, vol = 0.18) {
  const A = G.audio; if (!A.ctx) return;
  longNoise(A, A.out(null, vol), { type: 'bandpass', f: 1800, q: 0.6, peak: 0.6, a: 0.01, h: secs * 0.5, d: secs * 0.5 });
}
// The master alarm in a cabin: a two-tone warble
export function masterAlarm(G, secs = 2.5, vol = 0.12, pos = null) {
  const A = G.audio; if (!A.ctx) return;
  const c = A.ctx, t = c.currentTime, o = A.out(pos, vol, 2);
  const osc = c.createOscillator(); osc.type = 'square';
  for (let k = 0; k < secs / 0.25; k++) osc.frequency.setValueAtTime(k % 2 ? 750 : 2000, t + k * 0.25);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.setValueAtTime(0.25, t + secs - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
  osc.connect(lp); lp.connect(g); g.connect(o); osc.start(t); osc.stop(t + secs + 0.05);
}
// One breath inside a spacesuit helmet (in, a pause, out): call every few seconds
export function breath(G, vol = 0.09, secs = 3.6) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(null, vol);
  longNoise(A, o, { type: 'bandpass', f: 900, f2: 1400, q: 0.7, peak: 0.5, a: secs * 0.25, h: 0.05, d: secs * 0.12 });
  longNoise(A, o, { type: 'bandpass', f: 600, f2: 380, q: 0.7, peak: 0.6, a: 0.08, h: secs * 0.1, d: secs * 0.35, t0: secs * 0.5 });
}
// A heartbeat: lub-dub
export function heartbeat(G, vol = 0.25) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(null, vol);
  A.tone(o, { type: 'sine', f: 55, f2: 40, peak: 0.6, a: 0.01, d: 0.16 });
  A.tone(o, { type: 'sine', f: 48, f2: 36, peak: 0.45, a: 0.01, d: 0.14, t0: 0.22 });
}
export function clank(G, pos, vol = 0.3) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 6);
  for (const f of [310, 523, 830]) A.tone(o, { type: 'triangle', f: f * (0.9 + Math.random() * 0.2), peak: 0.1, a: 0.002, d: 0.4 + Math.random() * 0.4 });
  A.noise(o, { type: 'bandpass', f: 1400, q: 2, peak: 0.2, a: 0.002, d: 0.08 });
}
export function hiss(G, pos, vol = 0.25, secs = 1.6) {
  const A = G.audio; if (!A.ctx) return;
  longNoise(A, A.out(pos, vol, 5), { type: 'highpass', f: 3000, q: 0.5, peak: 0.4, a: 0.15, h: secs * 0.4, d: secs * 0.6 });
}
// A sharp bang (pyrotechnics firing: stage separation, a hatch blowing, the tank in Apollo 13)
export function bang(G, pos = null, vol = 0.6, big = false) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 8);
  A.noise(o, { type: 'lowpass', f: big ? 400 : 1200, f2: 60, q: 0.7, peak: 1, a: 0.002, d: big ? 1.6 : 0.5 });
  A.tone(o, { type: 'sine', f: big ? 70 : 110, f2: 35, peak: 0.8, a: 0.003, d: big ? 1.2 : 0.4 });
  if (big) for (let i = 0; i < 8; i++) A.tone(o, { type: 'triangle', f: 200 + Math.random() * 900, peak: 0.06, a: 0.002, d: 0.6 + Math.random(), t0: 0.05 + Math.random() * 0.3 });
}
// A click of a switch, or a camera shutter
export function click(G, pos = null, vol = 0.2) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 2);
  A.noise(o, { type: 'highpass', f: 2500, q: 1, peak: 0.6, a: 0.001, d: 0.025 });
  A.tone(o, { type: 'square', f: 1800, peak: 0.08, a: 0.001, d: 0.02 });
}
// Camera flashbulbs popping, a little hiss each
export function flashPop(G, pos = null, vol = 0.15) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 4);
  A.noise(o, { type: 'bandpass', f: 4200, q: 1, peak: 0.5, a: 0.001, d: 0.12 });
  A.tone(o, { type: 'sine', f: 2600, f2: 900, peak: 0.05, a: 0.001, d: 0.15 });
}
// Applause and a cheer for big moments (short, then gone: not a crowd murmur)
export function applause(G, pos = null, secs = 4, vol = 0.35) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 30);
  const n = Math.round(secs * 70);
  for (let i = 0; i < n; i++) { const t0 = Math.random() * secs, f = 1 - t0 / secs; A.noise(o, { type: 'bandpass', f: 900 + Math.random() * 2200, q: 2.5, peak: 0.25 * f + 0.05, a: 0.001, d: 0.03 + Math.random() * 0.03, t0 }); }
  longNoise(A, o, { type: 'bandpass', f: 1400, q: 0.5, peak: 0.18, a: 0.3, h: secs * 0.5, d: secs * 0.5 });
}
// The sea (a single wave rolling in and washing out)
export function wave(G, pos, vol = 0.3) {
  const A = G.audio; if (!A.ctx) return;
  longNoise(A, A.out(pos, vol, 20), { type: 'lowpass', f: 400, f2: 1200, peak: 0.7, a: 1.6, h: 0.4, d: 2.8 });
}
// A gentle music-box tune from notes (semitones from A4): Jingle Bells on a harmonica, the radio song
export function tune(G, notes, { vol = 0.12, step = 0.32, type = 'triangle', root = 440, pos = null, reed = false } = {}) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 3); let t = 0;
  for (const n of notes) {
    if (n == null) { t += step; continue; }
    const [semi, len = 1] = Array.isArray(n) ? n : [n, 1], f = root * Math.pow(2, semi / 12);
    A.tone(o, { type, f, peak: 0.25, a: reed ? 0.03 : 0.005, d: step * len * 0.95, t0: t });
    if (reed) A.tone(o, { type: 'sawtooth', f: f * 2.003, peak: 0.04, a: 0.03, d: step * len * 0.9, t0: t });
    t += step * len;
  }
  return t;
}
// Jingle Bells (the first music in space, on a harmonica)
export const JINGLE = [7, 7, [7, 2], 7, 7, [7, 2], 7, 10, 3, 5, [7, 4], 8, 8, 8, 8, 8, 7, 7, 7, 7, 5, 5, 7, [5, 2], [10, 2]];
