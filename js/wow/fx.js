// Shared bits for the wow moments: glowing particles, a soft glow sprite, a few synthesized sounds,
// and a way to dim or brighten the stars on top of whatever the chapter sets.
import * as THREE from 'three';

export const D2R = Math.PI / 180;
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const ease = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

let glowTexCache = null;
export function glowTex() {
  if (glowTexCache) return glowTexCache;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowTexCache = new THREE.CanvasTexture(c); glowTexCache.colorSpace = THREE.SRGBColorSpace;
  return glowTexCache;
}
export function glowSprite(color = 0xffffff, size = 1, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size); return s;
}

// A cloud of glowing points you move yourself: set p.pos (Float32Array xyz), p.col (rgb), p.size,
// then call p.commit(). One draw call. sizeScale: how big a size-1 point looks 1 m away (pixels).
export function glowPoints(n, { sizeScale = 300, depthTest = true } = {}) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { scale: { value: sizeScale } },
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(size * scale / max(0.1, -mv.z), 1.5, 64.0); }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c);
      float a = smoothstep(0.5, 0.0, r); a = a * a; gl_FragColor = vec4(vC * a * 1.4, 1.0); }`,
    transparent: true, depthWrite: false, depthTest, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false;
  pts.userData = { pos, col, size, commit() { for (const k of ['position', 'color', 'size']) g.attributes[k].needsUpdate = true; } };
  return pts;
}

// Stars and Milky Way brightness on top of the chapter's sky: call every frame from update()
// (after the chapter has set its Sun). stars, milky: multipliers (1 = as the chapter has it).
export function skyLevel(G, stars = 1, milky = 1) {
  const sf = G.sky.starField, el = G.sky.sunEl;
  sf.opacity = clamp01((-el - 1.5) / 7) * stars;
  G.sky.uni.milky.value = milky;
}

// ---------- Sounds (synthesized, like the rest of the game's effects) ----------
// A rising, sparkling shimmer: many tiny bell notes climbing upward
export function shimmer(G, secs = 4, vol = 0.25) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(null, vol), notes = [523, 659, 784, 988, 1175, 1319, 1568, 1976, 2349, 2637];
  const n = Math.round(secs * 9);
  for (let i = 0; i < n; i++) A.tone(o, { f: notes[Math.min(notes.length - 1, Math.floor(i / n * notes.length + Math.random() * 2))] * (1 + (Math.random() - 0.5) * 0.01), peak: 0.12, a: 0.004, d: 0.9, t0: i * secs / n + Math.random() * 0.05 });
}
// A deep, soft whoosh (wind rushing past)
export function whoosh(G, secs = 3, vol = 0.5, pos = null) {
  const A = G.audio; if (!A.ctx) return;
  A.noise(A.out(pos, vol), { type: 'bandpass', f: 200, f2: 1400, q: 0.8, peak: 0.5, a: secs * 0.6, d: secs * 0.4 });
}
// A low warm drone chord that swells and fades (wonder)
export function awe(G, secs = 10, vol = 0.1, root = 110) {
  const A = G.audio; if (!A.ctx) return;
  const c = A.ctx, t = c.currentTime, o = A.out(null, vol);
  for (const r of [1, 1.5, 2, 2.5, 3]) {
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = root * r * (1 + (Math.random() - 0.5) * 0.004);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 / r, t + secs * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
    osc.connect(g); g.connect(o); osc.start(t); osc.stop(t + secs + 0.1);
  }
}
// A deep rumble (big things moving)
export function rumble(G, secs = 4, vol = 0.6, pos = null) {
  const A = G.audio; if (!A.ctx) return;
  A.noise(A.out(pos, vol), { type: 'lowpass', f: 90, f2: 50, q: 1, peak: 0.8, a: secs * 0.3, d: secs * 0.7 });
}
// Glass breaking, softly: a burst of high bright pings
export function shatter(G, vol = 0.35) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(null, vol);
  A.noise(o, { type: 'highpass', f: 3000, q: 0.5, peak: 0.6, a: 0.003, d: 0.6 });
  for (let i = 0; i < 26; i++) A.tone(o, { f: 2200 + Math.random() * 4200, peak: 0.08, a: 0.002, d: 0.3 + Math.random() * 0.9, t0: Math.random() * 1.2 });
}

// Things to do a few seconds from now, on the game's clock (so they wait while the game is paused)
export class Timeline {
  constructor() { this.q = []; this.t = 0; }
  after(secs, fn) { this.q.push({ t: this.t + secs, fn }); }
  clear() { this.q.length = 0; }
  update(dt) {
    this.t += dt;
    for (const e of [...this.q]) if (this.t >= e.t) { this.q.splice(this.q.indexOf(e), 1); try { e.fn(); } catch (err) { console.error(err); } }
  }
}

// A floating text label that always faces you (a sprite). height: world height of one line.
export function textSprite(text, height = 1, { color = '#fff3d6', font = 'Georgia, serif', glow = 'rgba(255,200,120,0.6)' } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), px = 64;
  g.font = `${px}px ${font}`; const w = Math.ceil(g.measureText(text).width) + 40;
  c.width = w; c.height = px + 36;
  g.font = `${px}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = glow; g.shadowBlur = 16; g.fillStyle = color; g.fillText(text, w / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(height * w / c.height, height, 1); s.renderOrder = 5;
  return s;
}

// Sputnik's famous radio "beep... beep...": n short beeps, a little more than half a second apart
export function beeps(G, n = 6, vol = 0.18) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(null, vol);
  for (let i = 0; i < n; i++) A.tone(o, { type: 'square', f: 1000, peak: 0.12, a: 0.005, d: 0.28, t0: i * 0.62 });
}
