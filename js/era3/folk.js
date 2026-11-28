// People of the Space Race: the real people come from Meem's Tripo models (people.js makePerson with
// the model's name), with helmets as separate props. Everyone else who needs a face (engineers,
// doctors, technicians, sailors, families) is built here in code, each dressed differently so no
// two in a scene look alike. Big crowds (Red Square, the beaches, Rice Stadium) are one instanced
// crowd: four draw calls for hundreds of people, who cheer, wave and turn to look.
import * as THREE from 'three';
import { makePerson, animatePerson, findRig } from '../people.js';
import { loadModel, modelList } from '../models.js';
import { rng } from '../shapes.js';
import { clamp, damp } from '../util.js';

const _col = new THREE.Color(), _hl = new THREE.Vector3();

// A real person (Meem's model), standing at pos facing yaw. look: makePerson look (height etc.)
export function person(parent, model, pos, yaw = 0, look = {}) {
  // pick: which recoloured copy, for everyday people (engineers, families); named people have one
  const P = makePerson({ model, seed: 11 + (parent.children.length * 7) % 97, pick: parent.children.length + Math.round(pos.x * 3 + pos.z * 5), ...look });
  P.g.position.copy(pos); P.g.rotation.y = yaw; parent.add(P.g); P.name = model;
  return P;
}

// ---------- Everyday people ----------
// Engineers, doctors, technicians, sailors, families: Meem's Tripo models of everyday 1960s people
// (models/era3/folk/), each with recoloured copies so no two in a scene look alike. makeFolk picks
// the model that fits a description, so older scenes written with a description still work.
// look: { kind: 'jacket'|'greatcoat'|'suit'|'shirt'|'labcoat'|'coverall'|'uniform'|'sailor'|'swimmer'|'dress'|'kid',
//   hat: 'ushanka'|'cap'|'fedora'|'peaked'|'kerchief'|'sailor'|'hardhat'|'none', coat (colour), girl, height, seed }
const SKINS = [0xd8b49a, 0xc89e82, 0xe0c0a8, 0xb88a6c, 0xd0a88c, 0x8a5e44, 0x6a4632];
export function folkModel(look = {}) {
  const kind = look.kind || 'jacket', hat = look.hat || 'none', seed = look.seed || 7, c = look.coat ?? 0x3a3c40;
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, light = r + g + b > 560, pick = (...a) => a[seed % a.length];
  if (kind === 'kid' || (look.height && look.height < 1.35)) return look.girl || kind === 'dress' ? 'girl' : 'boy';
  if (kind === 'swimmer') return 'frogman';
  if (kind === 'sailor') return 'sailor_us';
  if (hat === 'ushanka') return 'soviet_worker';
  if (hat === 'kerchief') return 'soviet_babushka';
  if (kind === 'greatcoat' || (kind === 'uniform' && g >= b)) return 'soviet_officer';
  if (kind === 'uniform') return 'navy_officer';
  if (kind === 'labcoat') return look.girl ? 'doctor_woman' : 'doctor_man';
  if (hat === 'hardhat') return 'pad_worker';
  if (kind === 'coverall') return light ? 'tech_white' : 'soviet_worker';
  if (kind === 'dress' || look.girl) return pick('woman_dress', 'woman_office', 'woman_summer', 'woman_dress', 'woman_older');
  if (kind === 'shirt') return hat === 'cap' ? 'tech_white' : b > r + 8 ? 'eng_blue_shirt' : pick('eng_white_shirt', 'eng_black', 'eng_white_shirt', 'eng_blue_shirt');
  if (kind === 'suit') return 'man_suit';
  if (hat === 'cap') return 'soviet_citizen';
  return pick('reporter', 'man_casual', 'man_suit');
}
export function makeFolk(look = {}) {
  const P = makePerson({ model: folkModel(look), seed: look.seed || 7, pick: look.seed || 0 });
  P.folk = true;
  return P;
}
// Move a person this frame; folk also turn their head toward P.look (within what a neck can do)
export function animate(P, t, dt) {
  if (P.animal) { animateAnimal(P, t, dt); return; }
  animatePerson(P, t, dt);
  if (P.legs) { P.legs[0].visible = !P.sitting; P.legs[1].visible = !!P.sitting; }
  if (P.sitting) {
    if (P.rig && !P._sat) { P._sat = true; sit(P, true); }
    P.inner.position.y = -(P.sitDrop ?? 0.44) * (P.H || 1);   // hips down onto the seat
  }
  if (!P.head) return;
  let yaw = Math.sin(t * 0.3 + P.phase) * 0.15, pitch = 0;
  if (P.look) { _hl.copy(P.look); P.g.worldToLocal(_hl); _hl.y -= 1.6 * P.H; yaw = clamp(Math.atan2(_hl.x, _hl.z), -1.1, 1.1); pitch = clamp(-Math.atan2(_hl.y, Math.hypot(_hl.x, _hl.z)), -0.6, 0.45); }
  P.head.rotation.y = damp(P.head.rotation.y, yaw, 4, dt); P.head.rotation.x = damp(P.head.rotation.x, pitch + (P.nod || 0), 4, dt);
}
// Seat a person: hips at the chair's height, knees forward (works on the code-built folk; Meem's
// rigged models bend their legs with the 'sit' trick below)
export function sit(P, on = true) {
  P.sitting = on;
  const B = P.rig?.bones;
  if (B) {
    for (const side of ['Left', 'Right']) {
      const up = B[side + 'UpLeg'], low = B[side + 'Leg'];
      if (up) { up.quaternion.copy(P.rig.rest.get(up)); if (on) up.rotateX(-1.45); }
      if (low) { low.quaternion.copy(P.rig.rest.get(low)); if (on) low.rotateX(1.45); }
    }
  }
}

// ---------- A big crowd of real people ----------
// spots: [{ x, y, z, yaw }]. Everyone is one of Meem's everyday people (their light crowd copy, about
// 1,500 triangles), baked once into a few still poses (standing, cheering, waving; or seated) and drawn
// as one instanced mesh per model and pose, so 150 people cost a dozen draw calls.
// update(t, dt, mood): 'idle' (shifting, glancing), 'cheer' (arms up, bouncing), 'wave' (every other one
// waving), 'fan' (Rice Stadium's heat: some waving their programmes), 'look' (everyone faces P.look).
// who: the models to mix (recoloured copies are added automatically).
const CROWD_WHO = ['man_casual', 'woman_dress', 'man_suit', 'woman_summer', 'reporter', 'woman_office', 'woman_older', 'eng_white_shirt', 'girl', 'boy'];
const CROWD_POSES = ['idle', 'cheer', 'wave'];
const baked = new Map();   // model name + seated -> Promise<{ geo: {pose: BufferGeometry}, mat }>
function bakePoses(name, seated) {
  const key = name + (seated ? ':sit' : '');
  if (!baked.has(key)) baked.set(key, loadModel(name, { far: true }).then((m) => {
    if (!m) return null;
    const root = new THREE.Group(), inner = new THREE.Group(); root.add(inner); inner.add(m.scene);
    const rig = findRig(m.scene); let skin = null; m.scene.traverse((o) => { if (o.isSkinnedMesh && !skin) skin = o; });
    if (!rig || !skin) return null;
    const P = { g: root, inner, rig, phase: 0, pointAt: new THREE.Vector3(), H: 1 }, geo = {}, v = new THREE.Vector3();
    const inv = new THREE.Matrix4();
    for (const pose of CROWD_POSES) {
      P.pose = pose; animatePerson(P, 0.9, 1); inner.position.y = 0;
      if (seated) { P.rig = rig; sit(P, true); }
      root.updateMatrixWorld(true); skin.skeleton.update();
      inv.copy(root.matrixWorld).invert();
      const src = skin.geometry, n = src.attributes.position.count, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        skin.getVertexPosition(i, v); v.applyMatrix4(skin.matrixWorld).applyMatrix4(inv);
        pos[i * 3] = v.x; pos[i * 3 + 1] = v.y - (seated ? 0.44 * (m.info.height || 1.75) / 1.75 : 0); pos[i * 3 + 2] = v.z;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      if (src.attributes.uv) g.setAttribute('uv', src.attributes.uv);
      if (src.index) g.setIndex(src.index);
      g.computeVertexNormals(); g.computeBoundingSphere(); geo[pose] = g;
    }
    return { geo, mat: skin.material };
  }));
  return baked.get(key);
}
export class Crowd {
  constructor(spots, { seed = 5, scale = 1, sit = false, who = CROWD_WHO } = {}) {
    const r = rng(seed); this.spots = spots; this.n = spots.length; this.sit = sit;
    this.who = spots.map(() => ({ ph: r() * 6.28, h: (0.95 + r() * 0.1) * scale, sp: 0.7 + r() * 0.6, kind: Math.floor(r() * 1e6) }));
    this.group = new THREE.Group(); this.kinds = []; this.mood = 'idle'; this.look = null; this.k = 0;
    this.ready = modelList().then(async (list) => {
      // every model plus its recoloured copies, then each person gets one of them
      const names = [...new Set(who.flatMap((w) => list[w] ? [w, ...(list[w].variants || [])] : []))];
      const got = await Promise.all(names.map((nm) => bakePoses(nm, sit)));
      const ok = got.map((b, i) => b && { name: names[i], ...b }).filter(Boolean);
      if (!ok.length) return;
      this.who.forEach((w) => { w.kind = w.kind % ok.length; });
      this.kinds = ok.map((b, ki) => {
        const count = this.who.filter((w) => w.kind === ki).length, meshes = {};
        for (const pose of CROWD_POSES) {
          const im = new THREE.InstancedMesh(b.geo[pose], b.mat, Math.max(1, count));
          im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0;
          im.userData.kind = 'characters'; this.group.add(im); meshes[pose] = im;
        }
        return meshes;
      });
      this.update(0, 0);
    });
  }
  update(t, dt, mood = this.mood) {
    if (!this.kinds.length) return;
    const m = _m, q = _q, e = _e, p = _p, s = _s;
    this.k = damp(this.k, mood === 'cheer' ? 1 : mood === 'wave' ? 0.5 : mood === 'fan' ? 0.3 : 0, 3, dt || 0.016);
    for (const K of this.kinds) for (const pose of CROWD_POSES) K[pose].count = 0;
    for (let i = 0; i < this.n; i++) {
      const S = this.spots[i], w = this.who[i], ph = w.ph + t * w.sp;
      const pose = mood === 'cheer' && this.k > 0.4 ? (i % 5 === 3 ? 'wave' : 'cheer') : (mood === 'wave' || mood === 'fan') && this.k > 0.2 && i % 2 === 0 ? 'wave' : 'idle';
      const hop = pose === 'cheer' ? Math.max(0, Math.sin(ph * 4)) * 0.1 * this.k * (this.sit ? 0.5 : 1) : 0;
      let yaw = S.yaw + Math.sin(ph * 0.4) * 0.12;
      if (this.look) yaw = Math.atan2(this.look.x - S.x, this.look.z - S.z) + Math.sin(ph * 0.4) * 0.05;
      q.setFromEuler(e.set(0, yaw, pose === 'cheer' ? Math.sin(ph * 6) * 0.05 : Math.sin(ph * 0.6) * 0.02)); s.setScalar(w.h);
      const im = this.kinds[w.kind][pose];
      im.setMatrixAt(im.count++, m.compose(p.set(S.x, S.y + hop, S.z), q, s));
    }
    for (const K of this.kinds) for (const pose of CROWD_POSES) { K[pose].instanceMatrix.needsUpdate = true; K[pose].visible = K[pose].count > 0; }
  }
  dispose() { for (const K of this.kinds) for (const pose of CROWD_POSES) K[pose].dispose(); }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
// Rows of spots for a crowd: n per row, rows deep, `gap` apart, from x0..x1 at z, facing yaw, with jitter
export function rows({ x0, x1, z0, rows: nr = 3, gap = 0.75, depth = 0.8, yaw = 0, y = 0, jit = 0.2, seed = 3, height = null, every = 1, skip = null }) {
  const r = rng(seed), out = [];
  for (let j = 0; j < nr; j++) for (let x = x0; x <= x1; x += gap * every) {
    const px = x + (r() - 0.5) * jit, pz = z0 + j * depth * (yaw === 0 ? -1 : 1) + (r() - 0.5) * jit;
    if (skip?.(px, pz)) continue;
    out.push({ x: px, y: height ? height(px, pz) : y + j * (height === null ? 0 : 0), z: pz, yaw: yaw + (r() - 0.5) * 0.3 });
  }
  return out;
}

// ---------- Animals (Meem's models: Laika, Belka, Ham... no rig, so they move as a whole) ----------
// mode: 'idle' (breathing, a look round now and then), 'wag' (a happy wriggle and little hops),
// 'walk' (a trot with a bob; set A.to = Vector3 and it trots there), 'sit', 'eat' (a nibbling bob)
export function animal(parent, model, pos, yaw = 0, { tint = null, scale = 1 } = {}) {
  const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = yaw; parent.add(g);
  const body = new THREE.Group(); g.add(body);
  const A = { g, body, animal: true, mode: 'idle', phase: Math.random() * 6, name: model, to: null, speed: 1.2 };
  g.userData.person = A;
  loadModel(model, { sd: true }).then((m) => {
    if (!m) return;
    if (tint) m.scene.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color = new THREE.Color(tint); } });
    m.scene.scale.multiplyScalar(scale); body.add(m.scene);
  });
  return A;
}
export function animateAnimal(A, t, dt) {
  const ph = t + A.phase, b = A.body;
  if (A.to) {
    const dx = A.to.x - A.g.position.x, dz = A.to.z - A.g.position.z, d = Math.hypot(dx, dz);
    if (d > 0.05) { const want = Math.atan2(dx, dz); let dy = want - A.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); A.g.rotation.y += dy * Math.min(1, dt * 6); const st = Math.min(d, A.speed * dt); A.g.position.x += dx / d * st; A.g.position.z += dz / d * st; A.mode = 'walk'; }
    else { A.to = null; if (A.mode === 'walk') A.mode = 'idle'; }
  }
  let y = 0, rz = 0, rx = 0, ry = 0, sy = 1 + Math.sin(ph * 2.4) * 0.012;
  if (A.mode === 'wag') { y = Math.max(0, Math.sin(ph * 9)) * 0.04; rz = Math.sin(ph * 14) * 0.06; ry = Math.sin(ph * 7) * 0.12; }
  else if (A.mode === 'walk') { y = Math.abs(Math.sin(ph * 9)) * 0.03; rx = Math.sin(ph * 18) * 0.02; }
  else if (A.mode === 'eat') { rx = 0.05 + Math.max(0, Math.sin(ph * 6)) * 0.06; }
  else { ry = Math.sin(ph * 0.4) * Math.sin(ph * 0.13) * 0.25; }
  b.position.y = damp(b.position.y, y, 12, dt); b.rotation.z = damp(b.rotation.z, rz, 10, dt); b.rotation.x = damp(b.rotation.x, rx, 8, dt); b.rotation.y = damp(b.rotation.y, ry, 4, dt);
  b.scale.y = sy;
}

// Put a prop on a person's head bone (a helmet), keeping its real size: obj is centred on the head,
// lift (m) raises it. Waits for Meem's model to load if it hasn't yet.
export function wear(P, obj, { lift = 0.06, fwd = 0.0, size = null } = {}) {
  const put = () => {
    const head = P.rig?.bones.Head; if (!head) return false;
    head.add(obj); head.updateWorldMatrix(true, false);
    const ws = new THREE.Vector3(); head.getWorldScale(ws); const gs = new THREE.Vector3(); P.g.getWorldScale(gs);
    const k = gs.x / ws.x; obj.scale.setScalar(k * (size || 1)); obj.position.set(0, lift, fwd).multiplyScalar(k);
    return true;
  };
  if (!put()) { const iv = setInterval(() => { if (put() || !P.g.parent) clearInterval(iv); }, 300); }
  return obj;
}
