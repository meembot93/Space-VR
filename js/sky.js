// One sky for every chapter: a gradient dome that runs from deep night through dawn to day,
// the real stars and Milky Way (stars.js), the Sun and the Moon. Chapters only set the Sun's
// position (and the Moon's), and everything else (sky colours, light, fog, stars fading)
// follows from it. World axes: -Z is north, +X is east, +Y is up.
import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { StarField, DUST_MAX } from './stars.js';

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
const _mv = new THREE.Vector3(), _mt = new THREE.Vector3(), _my = new THREE.Vector3(), _mz = new THREE.Vector3(), _ms = new THREE.Vector3();
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
uniform sampler2D mwTex;
uniform mat3 toStar;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  float up = pow(max(h, 0.0), 0.45);
  vec3 col = mix(horizon, zenith, up);
  // Warm glow around where the Sun is (or is about to be), strongest near the horizon
  float s = max(dot(d, sunDir), 0.0);
  float band = 1.0 - smoothstep(0.0, 0.55, abs(h - 0.03));
  col = mix(col, glow, clamp(pow(s, 6.0) * glowAmt * (0.35 + 0.65 * band) + pow(s, 60.0) * glowAmt * 0.6, 0.0, 1.0));
  // The Milky Way in colour (star clouds, dust lanes, nebulae), turned with the stars
  vec3 e = toStar * d;
  vec2 uv = vec2(atan(e.y, e.x) / 6.2831853 + 0.5, asin(clamp(e.z, -1.0, 1.0)) / 3.14159265 + 0.5);
  uv.x = fract(uv.x + 0.5);
  vec3 mw = texture2D(mwTex, uv).rgb;
  float above = smoothstep(-0.02, 0.3, d.y);
  col += (mw * mw * 0.55 + mw * 0.06) * milky * night * above;
  // Airglow: the faint green-gold glow of the high air, a band just above the horizon on dark nights
  float ag = exp(-pow((d.y - 0.1) / 0.09, 2.0));
  col += vec3(0.05, 0.075, 0.04) * ag * night * 0.35;
  // Below the horizon: fade into the ground haze
  col = mix(col, horizon * 0.85, smoothstep(0.0, -0.12, d.y));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

function glowTexture(inner = 'rgba(255,250,230,1)', mid = 'rgba(255,200,120,0.35)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.18, inner); gr.addColorStop(0.32, mid); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Draw the Moon's face with the right part lit (northern-hemisphere view: waxing = lit on the right)
function drawMoon(c, phase) {
  const g = c.getContext('2d'), W = c.width, r = W * 0.36, cx = W / 2;
  g.clearRect(0, 0, W, W);
  // a faint halo
  const hal = g.createRadialGradient(cx, cx, r, cx, cx, W / 2); hal.addColorStop(0, `rgba(200,215,255,${0.25 * Math.sin(Math.PI * phase)})`); hal.addColorStop(1, 'rgba(200,215,255,0)');
  g.fillStyle = hal; g.fillRect(0, 0, W, W);
  // the dark side, just visible (earthshine)
  g.fillStyle = 'rgba(70,78,96,0.55)'; g.beginPath(); g.arc(cx, cx, r, 0, 7); g.fill();
  // the lit part: half a disc plus/minus an ellipse for the terminator
  const k = Math.cos(phase * 2 * Math.PI);           // 1 new .. -1 full
  const waxing = phase < 0.5;
  g.save(); g.beginPath(); g.arc(cx, cx, r, 0, 7); g.clip();
  // lit between the bright limb and the terminator (an ellipse edge that sweeps across over the month)
  g.fillStyle = '#f2f0e6'; g.beginPath();
  const side = waxing ? 1 : -1, N = 48;
  for (let i = 0; i <= N; i++) { const a = -Math.PI / 2 + Math.PI * i / N; g.lineTo(cx + side * Math.cos(a) * r, cx + Math.sin(a) * r); }
  for (let i = N; i >= 0; i--) { const a = -Math.PI / 2 + Math.PI * i / N; g.lineTo(cx + side * k * Math.cos(a) * r, cx + Math.sin(a) * r); }
  g.fill();
  // seas: a few soft grey patches
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(120,120,128,0.35)';
  for (const [x, y, s] of [[-0.25, -0.3, 0.22], [0.15, -0.15, 0.26], [0.25, 0.25, 0.18], [-0.1, 0.2, 0.14], [-0.35, 0.1, 0.12]]) { g.beginPath(); g.arc(cx + x * r, cx + y * r, s * r, 0, 7); g.fill(); }
  g.restore();
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.uni = {
      zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, -1, 0) }, glowAmt: { value: 1 }, night: { value: 1 }, milky: { value: 1 },
      mwTex: { value: null }, toStar: { value: new THREE.Matrix3() },
    };
    // The real stars (see stars.js); chapters set the place and era with sky.setPlace()
    this.starField = new StarField();
    this.uni.mwTex.value = this.starField.mwColor;
    this.uni.toStar.value = this.starField.toStar;
    const dome = this.dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.uni, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false }));
    dome.frustumCulled = false; dome.renderOrder = -10;

    // Sun: a bright disk plus a soft halo, drawn as sprites on the sky
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.sun.scale.setScalar(170); this.sun.renderOrder = -8;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(240,244,255,1)', 'rgba(160,180,220,0.18)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.moon.scale.setScalar(70); this.moon.visible = false; this.moon.renderOrder = -8;
    // Shooting stars: now and then on a dark night, a quick bright streak
    const mc = document.createElement('canvas'); mc.width = 256; mc.height = 8;
    const mg = mc.getContext('2d'), mgr = mg.createLinearGradient(0, 0, 256, 0);
    mgr.addColorStop(0, 'rgba(160,200,255,0)'); mgr.addColorStop(0.85, 'rgba(220,235,255,0.7)'); mgr.addColorStop(1, 'rgba(255,255,255,1)');
    mg.fillStyle = mgr; mg.fillRect(0, 2, 256, 4);
    this.meteor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(-0.5, 0, 0),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
    this.meteor.visible = false; this.meteor.renderOrder = -8; this.meteor.frustumCulled = false;
    this.meteorT = 4; this.meteorLife = 0;
    this.group = new THREE.Group(); this.group.add(dome, this.starField.group, this.sun, this.moon, this.meteor);
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
    this.showLines = true; // faint constellation figures at night
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
    this.starField.opacity = clamp((-el - 1.5) / 7, 0, 1);
    this.starField.lineOpacity = this.showLines ? 0.13 : 0;
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

  // Spend what's left of the triangle budget on the Milky Way's star dust: the chapter's own
  // triangles (what's showing, re-checked every 2 s) plus the stars come to about BUDGET.
  budget(scene, BUDGET = 520000) {
    let tris = 0;
    scene.traverseVisible((o) => {
      if (o === this.group || !o.isMesh || !o.geometry) return;
      let p = o.parent; while (p) { if (p === this.group) return; p = p.parent; }
      const g = o.geometry, n = g.index ? g.index.count : g.attributes.position?.count || 0;
      tris += Math.min(n, g.drawRange.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    });
    const core = this.starField.coreTris || 83000;
    this.starField.dustBudget = Math.max(20000, Math.min(DUST_MAX, Math.floor((BUDGET - tris - core) / 2)));
    this.sceneTris = Math.round(tris);
    return this.starField.dustBudget;
  }

  // Where and when on Earth (see stars.js): { lat, year, sunLon }
  setPlace(p) { this.starField.setPlace(p); }

  update(dt, camPos, t = 0) {
    // The sky is always centred on you
    this.group.position.copy(camPos);
    this.starField.update(this.sunAz, this.sunEl, t);
    this.updateMeteor(dt);
    // re-check the budget now and then (models finish loading, chapters swap scenes)
    if ((this.budgetT = (this.budgetT || 0) - dt) <= 0) { this.budgetT = 2; this.budget(this.scene); }
    const F = this.scene.fog;
    F.far = lerp(this.fogFar, 140, this.mist);
    F.near = lerp(40, 4, this.mist);
  }

  // The Moon at bearing az, height el. phase: 0 new, 0.25 first quarter (right half lit),
  // 0.5 full, 0.75 last quarter. Pass phase = null for just a soft glow.
  setMoon(az, el, size = 1, phase = null) {
    this.moon.visible = el > -2 && (phase == null || Math.abs(phase - Math.round(phase)) > 0.02);
    dirFromAzEl(az, el, this.moon.position).multiplyScalar(900);
    if (phase != null) {
      if (!this.moonDisc) {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        this.moonCanvas = c; this.moonDisc = new THREE.CanvasTexture(c); this.moonDisc.colorSpace = THREE.SRGBColorSpace;
        this.moon.material.map = this.moonDisc; this.moon.material.blending = THREE.NormalBlending; this.moon.material.needsUpdate = true;
      }
      if (this.moonPhase == null || Math.abs(this.moonPhase - phase) > 0.004) { this.moonPhase = phase; drawMoon(this.moonCanvas, phase); this.moonDisc.needsUpdate = true; }
      this.moon.scale.setScalar(64 * size); // about 4 degrees: bigger than life, so its shape is easy to see
    } else this.moon.scale.setScalar(70 * size);
  }
  hideMoon() { this.moon.visible = false; }

  updateMeteor(dt) {
    const m = this.meteor, night = this.starField.opacity * this.uni.milky.value;
    if (this.meteorLife > 0) {
      this.meteorLife -= dt;
      const k = 1 - this.meteorLife / this.meteorDur;       // 0..1 along its path
      const ang = this.meteorAng0 + this.meteorSpan * k;    // it slides along a great circle
      _mv.copy(this.meteorA).multiplyScalar(Math.cos(ang)).addScaledVector(this.meteorB, Math.sin(ang));
      m.position.copy(_mv).multiplyScalar(820);
      // the streak points back along its path, facing the middle of the sky
      _mt.copy(this.meteorB).multiplyScalar(Math.cos(ang)).addScaledVector(this.meteorA, -Math.sin(ang));
      _mz.copy(_mv).negate(); _my.crossVectors(_mz, _mt);
      m.matrix.makeBasis(_mt, _my, _mz).setPosition(m.position); m.matrixAutoUpdate = false;
      const len = 30 + 70 * Math.sin(Math.PI * Math.min(1, k * 1.3));
      m.matrix.scale(_ms.set(len, 1.3, 1));
      m.material.opacity = Math.sin(Math.PI * k) * night;
      m.visible = this.meteorLife > 0 && night > 0.05 && _mv.y > 0.05;
      return;
    }
    m.visible = false;
    if (night < 0.6) return;
    this.meteorT -= dt;
    if (this.meteorT > 0) return;
    this.meteorT = 7 + Math.random() * 16;
    // a random start high in the sky, heading off (mostly downward) on a great circle
    const az = Math.random() * 360, el = 30 + Math.random() * 45;
    this.meteorA = dirFromAzEl(az, el, new THREE.Vector3());
    const dirAz = az + 60 + Math.random() * 240;
    this.meteorB = dirFromAzEl(dirAz, el - 10 - Math.random() * 20, new THREE.Vector3());
    this.meteorB.addScaledVector(this.meteorA, -this.meteorB.dot(this.meteorA)).normalize();
    this.meteorAng0 = 0; this.meteorSpan = (8 + Math.random() * 14) * D2R;
    this.meteorDur = this.meteorLife = 0.45 + Math.random() * 0.6;
  }
}
