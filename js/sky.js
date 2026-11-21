// One sky for every chapter: a gradient dome that runs from deep night through dawn to day,
// thousands of stars and the Milky Way, the Sun and the Moon. Chapters only set the Sun's
// position (and the Moon's), and everything else (sky colours, light, fog, stars fading)
// follows from it. World axes: -Z is north, +X is east, +Y is up.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

const D2R = Math.PI / 180;
// A direction from compass bearing (degrees clockwise from north) and height above the horizon
export function dirFromAzEl(az, el, out = new THREE.Vector3()) {
  const a = az * D2R, e = el * D2R;
  return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

// Sky colours by the Sun's height (degrees): [el, zenith, horizon, sunward glow, fog]
const KEYS = [
  [-30, 0x03060f, 0x070d1c, 0x070d1c, 0x05080f],
  [-14, 0x050b1c, 0x0d1730, 0x152040, 0x0b1222],
  [-8, 0x0c1838, 0x253660, 0x5a4a6e, 0x26304a],
  [-4, 0x16295a, 0x5a5c84, 0xc0705a, 0x4a4a62],
  [-1, 0x24427c, 0x9a8292, 0xf2985a, 0x80747e],
  [1.5, 0x34609c, 0xd8a684, 0xffc070, 0xb09a90],
  [6, 0x4a7cbc, 0xe8c8a8, 0xffe0a0, 0xc8bcb0],
  [20, 0x5a8fd0, 0xbcd4ea, 0xfff0d0, 0xb8c8d8],
];
const _ca = new THREE.Color(), _cb = new THREE.Color();
function keyColor(el, idx, out) {
  if (el <= KEYS[0][0]) return out.setHex(KEYS[0][idx]);
  for (let i = 1; i < KEYS.length; i++) {
    if (el <= KEYS[i][0]) {
      const k = (el - KEYS[i - 1][0]) / (KEYS[i][0] - KEYS[i - 1][0]);
      return out.copy(_ca.setHex(KEYS[i - 1][idx])).lerp(_cb.setHex(KEYS[i][idx]), k);
    }
  }
  return out.setHex(KEYS[KEYS.length - 1][idx]);
}

const SKY_VS = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane
}`;
const SKY_FS = `
uniform vec3 zenith, horizon, glow, sunDir;
uniform float glowAmt, night, milky;
varying vec3 vDir;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  float up = pow(max(h, 0.0), 0.45);
  vec3 col = mix(horizon, zenith, up);
  // Warm glow around where the Sun is (or is about to be), strongest near the horizon
  float s = max(dot(d, sunDir), 0.0);
  float band = 1.0 - smoothstep(0.0, 0.55, abs(h - 0.03));
  col = mix(col, glow, clamp(pow(s, 6.0) * glowAmt * (0.35 + 0.65 * band) + pow(s, 60.0) * glowAmt * 0.6, 0.0, 1.0));
  // The Milky Way: a soft, patchy band across the night sky
  vec3 gp = normalize(vec3(0.62, 0.48, -0.62));
  float g = 1.0 - abs(dot(d, gp));
  float mw = smoothstep(0.82, 1.0, g) * (0.55 + 0.45 * noise(d * 9.0)) * (0.6 + 0.4 * noise(d * 23.0));
  col += vec3(0.55, 0.6, 0.8) * mw * milky * night * 0.18 * smoothstep(-0.05, 0.25, d.y);
  // Below the horizon: fade into the ground haze
  col = mix(col, horizon * 0.85, smoothstep(0.0, -0.12, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

function makeStars(n, seed = 1) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  const gp = new THREE.Vector3(0.62, 0.48, -0.62).normalize(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    // Pick a random direction; about a third crowd toward the Milky Way's band
    for (;;) {
      v.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) continue;
      v.normalize();
      if (i % 3 === 0 && Math.abs(v.dot(gp)) > 0.18 + rnd() * 0.2) continue;
      if (v.y < -0.05) continue;
      break;
    }
    pos.set([v.x * 900, v.y * 900, v.z * 900], i * 3);
    const b = Math.pow(rnd(), 4.5); // a few bright stars, many faint ones
    const tint = rnd();
    const c = tint < 0.15 ? [1, 0.82, 0.65] : tint < 0.3 ? [0.75, 0.85, 1] : [1, 1, 1];
    const k = 0.35 + b * 0.65;
    col.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    size[i] = 1.2 + b * 3.2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 1 }, scale: { value: 1 } },
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale;
      void main(){ vC = color; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; gl_PointSize = size * scale; }`,
    fragmentShader: `varying vec3 vC; uniform float opacity;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(c)); gl_FragColor = vec4(vC * opacity * a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -9;
  return p;
}

function glowTexture(inner = 'rgba(255,250,230,1)', mid = 'rgba(255,200,120,0.35)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.18, inner); gr.addColorStop(0.32, mid); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.uni = {
      zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, -1, 0) }, glowAmt: { value: 1 }, night: { value: 1 }, milky: { value: 1 },
    };
    const dome = this.dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false }));
    dome.frustumCulled = false; dome.renderOrder = -10;
    this.stars = makeStars(3200);
    // Sun: a bright disk plus a soft halo, drawn as sprites on the sky
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.sun.scale.setScalar(170); this.sun.renderOrder = -8;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(240,244,255,1)', 'rgba(160,180,220,0.18)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.moon.scale.setScalar(70); this.moon.visible = false; this.moon.renderOrder = -8;
    this.group = new THREE.Group(); this.group.add(dome, this.stars, this.sun, this.moon);
    scene.add(this.group);

    // Lights: soft sky/ground fill plus the Sun
    this.hemi = new THREE.HemisphereLight(0x8090b0, 0x302a20, 0.6);
    this.sunLight = new THREE.DirectionalLight(0xffe0b0, 0);
    this.sunLight.target.position.set(0, 0, 0);
    scene.add(this.hemi, this.sunLight, this.sunLight.target);
    scene.fog = new THREE.Fog(0x05080f, 40, 700);
    this.mist = 0;        // 0..1: extra morning mist (pulls the fog in)
    this.fogFar = 700;
    this.sunAz = 50; this.sunEl = -20;
    this.sunSize = 1;     // the Sun can be drawn a bit bigger than life for drama
    this.set(50, -20);
  }

  // Put the Sun at compass bearing az (degrees from north), height el (degrees)
  set(az, el) {
    this.sunAz = az; this.sunEl = el;
    const d = dirFromAzEl(az, el, this.uni.sunDir.value);
    const U = this.uni;
    keyColor(el, 1, U.zenith.value); keyColor(el, 2, U.horizon.value); keyColor(el, 3, U.glow.value);
    U.glowAmt.value = clamp((el + 16) / 14, 0, 1);
    const night = U.night.value = clamp((-el - 4) / 10, 0, 1);
    this.stars.material.uniforms.opacity.value = clamp((-el - 2) / 10, 0, 1);
    this.sun.position.copy(d).multiplyScalar(900);
    this.sun.visible = el > -3;
    this.sun.scale.setScalar(120 * this.sunSize);
    const warm = clamp(1 - el / 12, 0, 1);
    this.sun.material.color.setRGB(1, lerp(0.95, 0.7, warm), lerp(0.85, 0.45, warm));
    // Light: the Sun only lights things once it's up; the sky fill grows with dawn
    const up = clamp((el + 0.5) / 6, 0, 1);
    this.sunLight.intensity = up * lerp(1.6, 2.6, clamp(el / 25, 0, 1));
    this.sunLight.color.setRGB(1, lerp(0.95, 0.68, warm), lerp(0.85, 0.42, warm));
    this.sunLight.position.copy(d).multiplyScalar(100);
    if (this.sunLight.position.y < 4) this.sunLight.position.y = 4; // keep the light from skimming under the ground
    const fill = 0.32 + clamp((el + 12) / 24, 0, 1) * 0.9;
    this.hemi.intensity = fill;
    this.hemi.color.copy(U.zenith.value).lerp(_ca.setHex(0xffffff), 0.35);
    this.hemi.groundColor.setHex(0x3a3424).multiplyScalar(0.5 + 0.5 * clamp((el + 10) / 20, 0, 1));
    keyColor(el, 4, this.scene.fog.color);
    this.night = night;
  }

  update(dt, camPos) {
    // The sky is always centred on you
    this.group.position.copy(camPos);
    const F = this.scene.fog;
    F.far = lerp(this.fogFar, 140, this.mist);
    F.near = lerp(40, 4, this.mist);
  }

  setMoon(az, el, size = 1) {
    this.moon.visible = el > -2;
    dirFromAzEl(az, el, this.moon.position).multiplyScalar(900);
    this.moon.scale.setScalar(70 * size);
  }
}
