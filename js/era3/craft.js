// Era 3 machines: the rockets, spacecraft and sets built in Blender (models/era3/craft/) and Meem's
// Tripo props (models/era3/props/), loaded once and copied cheaply, and a Rocket that stands on its
// pad and launches: engines lighting, the hold-down, the climb and pitch-over, stages falling away,
// a fire trail and a column of smoke, the glow lighting up the ground, and the roar arriving late
// when you watch from far away (sound takes about 3 seconds per kilometre).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { flameMesh, roar, envMap, setEnv } from './fx.js';
import { glowSprite, glowPoints } from '../wow/fx.js';
import { clamp, lerp } from '../util.js';

const DIR = new URL('../../models/era3/', import.meta.url).href;
const loader = new GLTFLoader();
const cache = new Map();
const D2R = Math.PI / 180;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// A GLB under models/era3/ (e.g. 'craft/saturn_s1c' or 'props/lm'). Resolves with a template:
// { make() a fresh copy (shares meshes and materials), size, box } or null if it isn't there.
export function loadE3(name) {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(DIR + name + '.glb').then((gltf) => {
    const scene = gltf.scene; scene.updateMatrixWorld(true);
    scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; const m = o.material; if (m && m.isMeshStandardMaterial) { m.transparent = false; m.alphaTest = m.alphaTest || 0; m.depthWrite = true; } } });
    const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3());
    return { scene, box, size, make: () => scene.clone(true) };
  }).catch((e) => { console.warn('Era 3 model failed', name, e); return null; }));
  return cache.get(name);
}
// Load several at once: resolves { name: template } (the key is the file's name without its folder)
export async function loadAll(names) {
  const out = {};
  await Promise.all(names.map(async (n) => { out[n.split('/').pop()] = await loadE3(n); }));
  return out;
}
// A copy of a loaded model, or a stand-in box if it's missing (so nothing breaks)
export function copy(M, env = null, k = 1) {
  if (!M) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xff40a0 })); m.position.y = 0.5; const g = new THREE.Group(); g.add(m); return g; }
  const o = M.make();
  if (env) { o.traverse((c) => { if (c.isMesh && c.material?.isMeshStandardMaterial) { c.material = c.material.clone(); } }); setEnv(o, env, k); }
  return o;
}
// Count triangles under an object (for the budget)
export function tris(o) { let n = 0; o.traverse((c) => { if (c.isMesh && c.geometry) n += (c.geometry.index ? c.geometry.index.count : c.geometry.attributes.position.count) / 3 * (c.isInstancedMesh ? c.count : 1); }); return Math.round(n); }

// ---------- A rocket on its pad, and its launch ----------
// opts: {
//   parts: [{ M, y, name, drop }]   the pieces stacked from the bottom: M a loaded template, y its base
//                                   height in the rocket; drop: the second (T) it falls away
//   engines: [{ x, z, y, len, width, kind, stage }]  flames under the engines; stage = the part index
//                                   they belong to (they go out when it drops)
//   size: 1 (R-7) .. 2.5 (Saturn V): roar depth, smoke, how far the glow reaches
//   hold: seconds between ignition and release; accel: m/s^2 on the climb
//   az: compass bearing it heads toward; tilt: how far it leans over (deg) by `tiltAt` metres
//   env: environment map for the metal
// }
export class Rocket {
  constructor(parent, opts) {
    this.o = { size: 1, hold: 2.4, accel: 9.4, az: 90, tilt: 45, tiltAt: 1500, ...opts };
    this.parent = parent;
    this.group = new THREE.Group(); parent.add(this.group);
    this.env = opts.env || envMap('day');
    this.parts = this.o.parts.map((p, i) => {
      const g = new THREE.Group(); g.position.y = p.y; this.group.add(g);
      const m = copy(p.M, this.env, p.envK ?? 0.9); g.add(m);
      if (p.turn) m.rotation.y = p.turn * D2R;
      return { ...p, g, i, v: new THREE.Vector3(), spin: new THREE.Vector3(), gone: false };
    });
    this.flames = (this.o.engines || []).map((e) => {
      const f = flameMesh(e.len, e.width, e.kind || 'kero'); f.position.set(e.x || 0, e.y, e.z || 0);
      (this.parts[e.stage ?? 0]?.g || this.group).add(f); return { ...e, f };
    });
    this.T = -1;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.dir = new THREE.Vector3(0, 1, 0);
    this.tail = new THREE.Vector3();
    // the fire trail and a big glow at the tail
    this.glow = glowSprite(0xffc070, 1, 0); this.glow.renderOrder = 6; parent.add(this.glow);
    this.fire = glowPoints(140, { sizeScale: 420, depthTest: true }); this.fire.visible = false; parent.add(this.fire);
    this.light = null;
  }
  // where it stands (the bottom of the rocket) in the parent's space
  place(x, y, z, yaw = 0) { this.base = new THREE.Vector3(x, y, z); this.group.position.copy(this.base); this.group.rotation.y = yaw; this.pos.copy(this.base); this.yaw0 = yaw; }
  height() { let h = 0; for (const p of this.parts) h = Math.max(h, p.y + (p.M?.size.y || 0)); return h; }
  // light it. listener: where you are in the parent's space (for the sound delay); puffs: a Puffs to fill
  ignite(G, { listener = null, puffs = null, light = null, delay = null, roarVol = 3, secs = 24, mute = false } = {}) {
    this.T = 0; this.G = G; this.puffs = puffs; this.light = light;
    const d = delay ?? (listener ? listener.distanceTo(this.base) / 343 : 0);
    this.soundDelay = d;
    if (!mute) setTimeout(() => { if (this.T < 0) return; roar(G, this.parent.localToWorld(this.base.clone().setY(this.base.y + 6)), secs, roarVol, this.o.size); G.audio.boom?.(null); }, d * 1000 / (G.params?.has('fast') ? 4 : 1));
  }
  // engines lit but not let go yet (the hold-down: thrust building)
  get rising() { return this.T > this.o.hold; }
  update(dt, t, F = 1) {
    if (this.T < 0) return;
    const o = this.o, dtt = dt * F; this.T += dtt; const T = this.T;
    const thrust = clamp01(T / 1.8);
    const amt = (0.78 + 0.22 * Math.sin(t * 40)) * thrust;
    const grow = clamp01((T - 4) / 10);
    for (const fl of this.flames) {
      const part = this.parts[fl.stage ?? 0], lit = !part?.gone && (fl.on == null || T >= fl.on) && (fl.off == null || T < fl.off);
      fl.f.userData.set(lit ? amt : 0, t + (fl.x || 0));
      fl.f.scale.set(1 + 0.5 * grow, 1 + 1.4 * grow + 0.08 * Math.sin(t * 31 + (fl.z || 0)), 1 + 0.5 * grow);
    }
    // the climb: slow at first, faster and faster, leaning over toward its heading
    if (T > o.hold) {
      const tt = T - o.hold, h = this.pos.y - this.base.y;
      const th = o.tilt * D2R * Math.pow(clamp01((h - 120) / o.tiltAt), 0.8);
      this.dir.set(Math.sin(o.az * D2R) * Math.sin(th), Math.cos(th), -Math.cos(o.az * D2R) * Math.sin(th));
      const v = o.accel * tt;
      this.vel.copy(this.dir).multiplyScalar(v);
      this.pos.addScaledVector(this.vel, dtt);
      this.group.position.copy(this.pos);
      this.group.quaternion.setFromUnitVectors(Y, this.dir);
      if (this.yaw0) this.group.quaternion.multiply(_q.setFromAxisAngle(Y, this.yaw0));
    }
    this.tail.copy(this.dir).multiplyScalar(-(o.tailDrop ?? 3)).add(this.pos);
    // stages falling away
    for (const p of this.parts) if (p.drop != null && !p.gone && T >= p.drop) this.dropPart(p);
    for (const p of this.parts) if (p.gone) {
      p.v.y -= 9.8 * dtt * 0.4; p.g.position.addScaledVector(p.v, dtt);
      _q.setFromAxisAngle(_a.copy(p.spin).normalize(), p.spin.length() * dtt); p.g.quaternion.premultiply(_q);
    }
    // the glow at the tail and the trail of fire behind
    const fade = clamp01(1 - (T - (o.glowEnd ?? 40)) / 8);
    this.glow.position.copy(this.tail).addScaledVector(this.dir, -2 * o.size);
    this.glow.material.opacity = Math.min(1, thrust * 1.2) * (0.85 + 0.15 * Math.sin(t * 27)) * fade;
    const cam = this.G?.camera.getWorldPosition(_b); const dist = cam ? this.parent.localToWorld(_a.copy(this.pos)).distanceTo(cam) : 100;
    this.glow.scale.setScalar(clamp(10 * o.size + dist * 0.05, 12 * o.size, 120) * (1 + 0.3 * grow));
    const FP = this.fire.userData; this.fire.visible = fade > 0;
    for (let i = 0; i < 140; i++) {
      const f = i / 140, l = f * (18 + 26 * grow) * o.size;
      const w = (Math.sin(i * 12.9898) * 0.5) * (1 + f * 3) * o.size, w2 = Math.cos(i * 4.1414) * 0.5 * (1 + f * 3) * o.size;
      FP.pos.set([this.tail.x - this.dir.x * l + w, this.tail.y - this.dir.y * l, this.tail.z - this.dir.z * l + w2], i * 3);
      const v = (1 - f) * thrust * (0.75 + 0.25 * Math.sin(t * 20 + i)) * fade;
      FP.col.set([v, v * (0.75 - f * 0.4), v * (0.4 - f * 0.3)], i * 3); FP.size[i] = (1.6 + f * 5) * o.size;
    }
    FP.commit();
    if (this.light) { this.parent.localToWorld(this.light.position.copy(this.tail)); this.light.position.y = Math.max(this.light.position.y, 3); this.light.intensity = (o.lightI ?? 700) * o.size * thrust * (0.85 + 0.15 * Math.sin(t * 33)) * clamp01(1 - (T - 8) / 16); }
    this.flash = Math.min(1.2, thrust * (1.2 - 0.85 * clamp01((T - 2) / 8)) * fade);
    // smoke: a wall of steam rolling out from the pad, then the trail behind the rocket
    const P = this.puffs;
    if (P) {
      this.smokeT = (this.smokeT || 0) - dtt;
      const b = this.base, S = o.size;
      if (this.smokeT <= 0 && T < 12) {
        this.smokeT = 0.05;
        for (let i = 0; i < 3 + S * 2; i++) {
          const a = (o.trench != null && Math.random() < 0.6) ? (o.trench + (Math.random() - 0.5) * 40) * D2R : Math.random() * 6.28, sp = (16 + Math.random() * 30) * Math.sqrt(S);
          P.emit(b.x + Math.cos(a) * 5 * S, b.y + 2 + Math.random() * 3, b.z + Math.sin(a) * 5 * S, Math.cos(a) * sp, 2 + Math.random() * 6, Math.sin(a) * sp, 6 * S, (34 + Math.random() * 30) * S, 18 + Math.random() * 10, Math.random() < 0.5 ? 0xd8d4cc : 0xb8b4ac, 0.6, 0.32, 1.2, 0.6);
        }
      }
      if (T > o.hold + 0.3 && T < (o.trailEnd ?? 36)) {
        const last = this.trailLast || (this.trailLast = this.tail.clone()), L = last.distanceTo(this.tail), step = clamp(4 + (this.pos.y - b.y) / 120, 4, 16) * Math.sqrt(S);
        const n = Math.min(14, Math.floor(L / step));
        for (let i = 1; i <= n; i++) {
          const f = i / n, jit = () => (Math.random() - 0.5) * 2.5 * S, hi = clamp01((this.pos.y - b.y) / 1500);
          P.emit(lerp(last.x, this.tail.x, f) + jit(), lerp(last.y, this.tail.y, f) + jit(), lerp(last.z, this.tail.z, f) + jit(), -this.vel.x * 0.08, -this.vel.y * 0.08, -this.vel.z * 0.08,
            (9 + hi * 10) * S, (26 + hi * 30 + Math.random() * 12) * S, 30, 0xc8c8cc, 0.62, 0.6, 1.6);
        }
        if (n > 0) last.copy(this.tail);
      }
    }
  }
  dropPart(p) {
    p.gone = true;
    p.g.getWorldPosition(_a); p.g.getWorldQuaternion(_q);
    this.parent.add(p.g); this.parent.worldToLocal(_a); p.g.position.copy(_a); p.g.quaternion.copy(_q);
    p.v.copy(this.vel).multiplyScalar(0.85);
    if (p.side) p.v.addScaledVector(_b.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), p.side);
    p.spin.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize().multiplyScalar(p.tumble ?? 0.3);
  }
  // put it back on the pad (for a second look)
  reset() {
    this.T = -1; this.pos.copy(this.base); this.group.position.copy(this.base); this.group.quaternion.identity(); if (this.yaw0) this.group.rotation.y = this.yaw0;
    this.dir.set(0, 1, 0); this.vel.set(0, 0, 0); this.trailLast = null; this.flash = 0;
    for (const p of this.parts) if (p.gone) { p.gone = false; this.group.add(p.g); p.g.position.set(0, p.y, 0); p.g.quaternion.identity(); }
    for (const fl of this.flames) fl.f.userData.set(0, 0);
    this.glow.material.opacity = 0; this.fire.visible = false;
  }
  dispose() { this.parent.remove(this.group, this.glow, this.fire); }
}

// A loaded template resized so it stands `height` metres tall (for models made at another scale,
// like Era 2's R-7 at 1 unit tall)
export function scaled(M, height) {
  if (!M) return null;
  const k = height / M.size.y;
  return { ...M, size: M.size.clone().multiplyScalar(k), make: () => { const g = new THREE.Group(), o = M.make(); o.scale.multiplyScalar(k); g.add(o); return g; } };
}
