// Living constellations: glowing figures drawn around the real stars (the Hunter, the Bull, the
// Scorpion...) that draw themselves in, act out their story for a few seconds, then fade away.
// The drawings are in js/skyart.js. They ride on the star sphere, so they sit exactly on their stars
// for whatever place, era and time of night a chapter has set, and they set and rise with them.
//
//   G.skyFigures.play('hunter', { secs: 14 })   draw it in, act for 14 s, fade out (returns a handle)
//   G.skyFigures.stop('hunter')                  fade it out now
//   G.skyFigures.height('hunter')                its centre's height above the horizon (degrees)
//   G.skyFigures.define(name, fig)               add a figure made in code (frame 'horizon' = fixed to
//                                                the land, x = compass bearing, y = height; day: true
//                                                to show in daylight; strokes may carry their own alpha a)
// One draw call per figure on screen; they only show while the stars are out.
import * as THREE from 'three';
import { FIGURES, layout } from './skyart.js';
import { eqVec } from './stars.js';
import { dirFromAzEl } from './sky.js';

const D2R = Math.PI / 180, RF = 860, HALF = 0.3; // distance out on the sky (m), half line width (degrees)
const COS_E = Math.cos(23.4393 * D2R), SIN_E = Math.sin(23.4393 * D2R);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4();

const VS = `attribute float side; attribute float alpha; varying float vS; varying float vA; varying float vUp;
  void main(){ vS = side; vA = alpha;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vUp = normalize(wp.xyz - cameraPosition).y;
    gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FS = `uniform vec3 color; uniform float opacity; varying float vS; varying float vA; varying float vUp;
  void main(){
    float core = exp(-vS * vS * 14.0), glow = exp(-vS * vS * 2.2) * 0.45;
    float a = vA * opacity * smoothstep(-0.02, 0.05, vUp);
    gl_FragColor = vec4((color * (core * 0.9 + glow) + vec3(core * 0.35)) * a, 1.0); }`;

class Figure {
  constructor(name, fig, parent) {
    this.name = name; this.fig = fig;
    // the patch of sky it's drawn on: centre, and right (west) / up (north) directions there
    const c = this.c = eqVec(...(fig.center || [0, 89]));
    const e = new THREE.Vector3(0, 0, 1).cross(c).normalize();
    this.r = e.clone().negate(); this.n = c.clone().cross(e).normalize();
    this.strokes = [];
    const probe = layout(fig, 0, []);
    let verts = 0, idx = 0;
    for (const s of probe) { const k = s.pts.length / 2; verts += k * 2; idx += (k - 1) * 6; }
    this.pos = new Float32Array(verts * 3); this.side = new Float32Array(verts); this.alpha = new Float32Array(verts);
    const index = new Uint16Array(idx); let v = 0, ii = 0;
    for (const s of probe) {
      const k = s.pts.length / 2;
      for (let i = 0; i < k; i++) { this.side[(v + i) * 2] = -1; this.side[(v + i) * 2 + 1] = 1; }
      for (let i = 0; i < k - 1; i++) { const a = (v + i) * 2; index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], ii); ii += 6; }
      v += k;
    }
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('side', new THREE.BufferAttribute(this.side, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color().fromArray(fig.color || [1, 0.85, 0.6]) }, opacity: { value: 0 } },
      vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = -7;
    parent.add(this.mesh);
    this.t = 0; this.draw = 0; this.fade = 0; this.life = Infinity; this.on = false; this.out = [];
  }

  // A point on this patch of sky (x, y in degrees) as a position on the star sphere
  at(x, y, out) {
    if (this.fig.frame === 'horizon') return dirFromAzEl(x, y, out).multiplyScalar(RF); // x = compass bearing, y = height
    if (this.fig.frame === 'ecliptic') {
      // x = minus ecliptic longitude, y = ecliptic latitude (J2000)
      const l = -x * D2R, b = y * D2R, cb = Math.cos(b);
      return out.set(cb * Math.cos(l), COS_E * cb * Math.sin(l) - SIN_E * Math.sin(b), SIN_E * cb * Math.sin(l) + COS_E * Math.sin(b)).multiplyScalar(RF);
    }
    return out.copy(this.c).addScaledVector(this.r, x * D2R).addScaledVector(this.n, y * D2R).normalize().multiplyScalar(RF);
  }

  update(dt, sky) {
    this.t += dt;
    if (this.on && this.t > this.life) this.on = false;
    this.fade = Math.max(0, Math.min(1, this.fade + dt * (this.on ? 0.8 : -0.5)));
    this.draw = Math.min(1, this.draw + dt / (this.drawSecs || 2.5));
    if (this.fig.day) sky = 1;   // drawn in daylight too (e.g. the Sun's paths)
    this.mesh.visible = this.fade > 0.001 && sky > 0.05;
    if (!this.mesh.visible) return;
    this.mat.uniforms.opacity.value = this.fade * Math.min(1, sky * 1.3) * (this.bright || 1) * (0.92 + 0.08 * Math.sin(this.t * 2.3));
    // act from when it has finished drawing itself in
    const strokes = layout(this.fig, Math.max(0, this.t - (this.drawSecs || 2.5) * 0.7), this.out);
    let v = 0; const N = strokes.length;
    strokes.forEach((s, si) => {
      const p = s.pts, k = p.length / 2;
      // draw-on: strokes appear one after another, each from its start to its end
      const start = (si / N) * 0.6, local = (this.draw - start) / 0.4;
      for (let i = 0; i < k; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(k - 1, i + 1);
        // (on the horizon frame a degree of bearing shrinks toward the zenith: measure in true degrees)
        const kx = this.fig.frame === 'horizon' ? Math.max(0.05, Math.cos(p[i * 2 + 1] * D2R)) : 1;
        let tx = (p[i1 * 2] - p[i0 * 2]) * kx, ty = p[i1 * 2 + 1] - p[i0 * 2 + 1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const u = i / (k - 1);
        const tw = s.taper === 'start' ? 0.25 + 0.75 * u : s.taper ? 1 - 0.8 * u : 1;
        const hw = HALF * s.w * tw;
        this.at(p[i * 2] - ty * hw / kx, p[i * 2 + 1] + tx * hw, _v); this.pos.set([_v.x, _v.y, _v.z], (v + i) * 6);
        this.at(p[i * 2] + ty * hw / kx, p[i * 2 + 1] - tx * hw, _v); this.pos.set([_v.x, _v.y, _v.z], (v + i) * 6 + 3);
        const a = Math.max(0, Math.min(1, (local - u) * 6 + 1)) * (s.a ?? 1);
        this.alpha[(v + i) * 2] = this.alpha[(v + i) * 2 + 1] = a;
      }
      v += k;
    });
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true;
  }

  dispose() { this.mesh.parent?.remove(this.mesh); this.geo.dispose(); this.mat.dispose(); }
}

export class SkyFigures {
  constructor(G) {
    this.G = G; this.figs = new Map();
    G.events.on('chapterStart', () => this.clear());
  }

  // Draw a figure in and let it act. opts: { secs (how long before it fades; default 14),
  // drawSecs (how long drawing itself in takes; 2.5), bright (1) }
  play(name, opts = {}) {
    const fig = FIGURES[name]; if (!fig) { console.warn('No sky figure', name); return null; }
    let F = this.figs.get(name);
    if (!F) { F = new Figure(name, fig, fig.frame === 'horizon' ? this.G.sky.group : this.G.sky.starField.group); this.figs.set(name, F); }
    if (!F.on || F.fade < 0.05) { F.t = 0; F.draw = 0; }
    F.on = true; F.life = F.t + (opts.secs ?? 14); F.drawSecs = opts.drawSecs || 2.5; F.bright = opts.bright || 1;
    return F;
  }
  // Add a figure made in code (same shape as the ones in js/skyart.js), e.g. by a chapter's extras
  define(name, fig) { FIGURES[name] = fig; const F = this.figs.get(name); if (F) { F.dispose(); this.figs.delete(name); } }
  stop(name) { const F = this.figs.get(name); if (F) F.on = false; }
  stopAll() { for (const F of this.figs.values()) F.on = false; }
  clear() { for (const F of this.figs.values()) F.dispose(); this.figs.clear(); }
  playing(name) { const F = this.figs.get(name); return !!F && (F.on || F.fade > 0); }

  // How high a figure's centre is in the sky right now (degrees; below 0 = under the horizon)
  height(name) {
    const fig = FIGURES[name]; if (!fig) return -90;
    const sf = this.G.sky.starField;
    eqVec(fig.center[0], fig.center[1], _w).applyMatrix4(_m.copy(sf.toWorld).setPosition(0, 0, 0));
    return Math.asin(Math.max(-1, Math.min(1, _w.y))) / D2R;
  }
  // ...and which way to look for it (compass bearing, degrees)
  bearing(name) {
    const fig = FIGURES[name]; if (!fig) return 0;
    eqVec(fig.center[0], fig.center[1], _w).applyMatrix4(_m.copy(this.G.sky.starField.toWorld).setPosition(0, 0, 0));
    return (Math.atan2(_w.x, -_w.z) / D2R + 360) % 360;
  }

  update(dt) {
    const sky = this.G.sky.starField.opacity;
    for (const F of this.figs.values()) F.update(dt, sky);
  }
}
