// People of the Space Race: the real people come from Meem's Tripo models (people.js makePerson with
// the model's name), with helmets as separate props. Everyone else who needs a face (engineers,
// doctors, technicians, sailors, families) is built here in code, each dressed differently so no
// two in a scene look alike. Big crowds (Red Square, the beaches, Rice Stadium) are one instanced
// crowd: four draw calls for hundreds of people, who cheer, wave and turn to look.
import * as THREE from 'three';
import { Kit, FLAT, segs } from '../kit.js';
import { makePerson, animatePerson } from '../people.js';
import { loadModel } from '../models.js';
import { rng } from '../shapes.js';
import { clamp, damp } from '../util.js';

const _col = new THREE.Color(), _hl = new THREE.Vector3();
const SOFT = new THREE.MeshLambertMaterial({ vertexColors: true });

// A real person (Meem's model), standing at pos facing yaw. look: makePerson look (height etc.)
export function person(parent, model, pos, yaw = 0, look = {}) {
  const P = makePerson({ model, seed: 11 + (parent.children.length * 7) % 97, ...look });
  P.g.position.copy(pos); P.g.rotation.y = yaw; parent.add(P.g); P.name = model;
  return P;
}

// ---------- Everyday people, built in code ----------
// look: { kind: 'jacket'|'greatcoat'|'suit'|'shirt'|'labcoat'|'coverall'|'uniform'|'sailor'|'swimmer'|'dress'|'kid',
//   hat: 'ushanka'|'cap'|'fedora'|'peaked'|'beret'|'kerchief'|'sailor'|'hardhat'|'none', coat, trousers, hair,
//   skin, height, glasses, moustache, scarf, girl, headset, tie, seed }
const SKINS = [0xd8b49a, 0xc89e82, 0xe0c0a8, 0xb88a6c, 0xd0a88c, 0x8a5e44, 0x6a4632];
export function makeFolk(look = {}) {
  const R = rng(look.seed || 7), kind = look.kind || 'jacket', kid = kind === 'kid' || look.kid, girl = !!look.girl || kind === 'dress';
  const H = (look.height || (kid ? 1.25 : 1.74)) / 1.74, coat = look.coat ?? 0x3a3c40, trou = look.trousers ?? (kind === 'coverall' || kind === 'swimmer' ? coat : 0x2a2a2c);
  const skin = look.skin ?? SKINS[Math.floor(R() * 5)], hair = look.hair ?? [0x2a1e14, 0x4a3420, 0x6a5038, 0x1a1614, 0x8a8478, 0xa07840][Math.floor(R() * 6)];
  const shoe = kind === 'swimmer' ? 0x1a1a1e : 0x1e1a18, k = new Kit(), hk = new Kit(), long = kind === 'greatcoat' || kind === 'labcoat';
  const shirt = kind === 'shirt', sleeve = kind === 'labcoat' ? 0xe8e8e2 : shirt ? (look.coat ?? 0xeeeee8) : coat;
  // the legs, two ways: standing, and sitting (thighs forward, shins down: shown when P.sitting)
  const lk = new Kit(), sk = new Kit(), legCol = girl ? (look.legs ?? 0xc8a090) : trou;
  for (const s of [-1, 1]) {
    lk.ball(0.1, 1, shoe, [s * 0.1, 0.05, 0.04], 0, [0.6, 0.5, 1.3]);
    lk.cyl(0.07, 0.062, 0.82, 8, legCol, [s * 0.1, 0.49, 0]);
    if (kind === 'swimmer') lk.ball(0.11, 1, 0x1a1a1e, [s * 0.1, 0.04, 0.1], 0, [0.6, 0.3, 1.8]);   // flippers
    sk.cyl(0.075, 0.068, 0.5, 8, girl ? coat : trou, [s * 0.1, 0.9, 0.2], [Math.PI / 2, 0, 0]);
    sk.cyl(0.066, 0.06, 0.44, 8, legCol, [s * 0.1, 0.68, 0.44]);
    sk.ball(0.1, 1, shoe, [s * 0.1, 0.49, 0.48], 0, [0.6, 0.5, 1.3]);
  }
  if (girl) {
    lk.cyl(0.19, 0.29, 0.52, 14, coat, [0, 0.66, 0]);                     // the skirt (sitting: over the lap)
    sk.cyl(0.2, 0.2, 0.12, 12, coat, [0, 0.88, 0.02]); sk.box(0.34, 0.1, 0.42, coat, [0, 0.9, 0.24]);
    k.cyl(0.18, 0.2, 0.5, 12, coat, [0, 1.15, 0]);
    k.cyl(0.205, 0.205, 0.05, 12, look.belt ?? 0x3a2a1e, [0, 0.95, 0]);
    k.box(0.16, 0.2, 0.02, look.collar ?? 0xe8e0d0, [0, 1.36, 0.17], [-0.25, 0, 0]);
  } else if (long) {
    k.cyl(0.21, 0.3, 0.98, 14, coat, [0, 0.9, 0]);
    k.cyl(0.2, 0.21, 0.24, 12, coat, [0, 1.31, 0]);
    if (kind === 'greatcoat') { k.cyl(0.225, 0.225, 0.06, 12, look.belt ?? 0x2a1e16, [0, 1.0, 0]); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) k.ball(0.014, 0, 0xb8a060, [s * 0.07, 1.06 + i * 0.12, 0.215]); }
    else { k.box(0.02, 0.85, 0.02, 0xc8c8c0, [0, 0.95, 0.25]); k.box(0.14, 0.18, 0.02, 0x3a4a6a, [0.1, 1.12, 0.22], [0, 0.1, 0]); }
  } else {
    k.cyl(0.2, 0.215, 0.58, 12, shirt ? (look.coat ?? 0xeeeee8) : coat, [0, 1.15, 0]);
    if (kind === 'jacket') for (let i = 0; i < 6; i++) k.add(new THREE.TorusGeometry(0.212 - i * 0.003, 0.008, 3, segs(14)), _col.setHex(coat).multiplyScalar(0.7).getHex(), [0, 0.92 + i * 0.09, 0], [Math.PI / 2, 0, 0]);
    if (kind === 'suit' || shirt) { k.box(0.13, 0.2, 0.02, 0xe8e4dc, [0, 1.35, 0.19], [-0.2, 0, 0]); if (look.tie !== false) k.box(0.04, 0.3, 0.02, look.tie ?? 0x2a2a4a, [0, 1.25, 0.205]); }
    if (shirt) { k.box(0.08, 0.1, 0.015, 0xd8d8d0, [0.1, 1.24, 0.205]); k.box(0.012, 0.06, 0.01, 0x2a3a8a, [0.12, 1.27, 0.214]); }   // pocket protector and a pen
    if (kind === 'coverall') { k.box(0.02, 0.55, 0.02, 0x9a9a90, [0, 1.1, 0.215]); k.box(0.12, 0.1, 0.015, 0xc8c8c0, [-0.1, 1.28, 0.205]); }
    if (kind === 'uniform' || kind === 'sailor') { k.cyl(0.215, 0.215, 0.05, 12, 0x1a1a1a, [0, 0.9, 0]); for (let i = 0; i < 4; i++) k.ball(0.013, 0, 0xc8a040, [0, 0.98 + i * 0.1, 0.215]); }
    if (kind === 'sailor') k.box(0.3, 0.16, 0.02, 0x1a2a5a, [0, 1.38, -0.19], [0.3, 0, 0]);
    if (kind === 'swimmer') { k.box(0.16, 0.24, 0.12, 0x5a6a4a, [0, 1.12, 0.2]); }   // a life vest pack
    if (kid) k.cyl(0.21, 0.2, 0.08, 12, look.belt ?? 0x2a2a2a, [0, 0.9, 0]);
    if (kind !== 'swimmer') for (let i = 0; i < 4; i++) k.ball(0.013, 0, 0x2a2420, [0, 0.95 + i * 0.12, 0.215]);
  }
  k.add(new THREE.SphereGeometry(0.21, segs(12), 6), shirt ? (look.coat ?? 0xeeeee8) : coat, [0, 1.36, 0], 0, [1.08, 0.42, 0.78]);
  k.cyl(0.1, 0.14, 0.09, 10, look.scarf ?? (shirt ? 0xeeeee8 : coat), [0, 1.45, 0]);
  if (look.scarf) k.box(0.1, 0.3, 0.03, look.scarf, [0.08, 1.3, 0.2], [0, 0, 0.1]);
  k.cyl(0.05, 0.055, 0.08, 8, kind === 'swimmer' ? 0x1a1a1e : skin, [0, 1.5, 0]);
  // the head (its own piece, so it can turn)
  const hy = 1.6;
  hk.ball(0.112, 2, skin, [0, hy, 0], 0, [0.92, 1.1, 1.0]);
  hk.box(0.03, 0.05, 0.04, _col.setHex(skin).multiplyScalar(0.95).getHex(), [0, hy - 0.015, 0.11], [0.2, 0, 0]);
  for (const s of [-1, 1]) {
    hk.ball(0.026, 0, skin, [s * 0.105, hy, 0], 0, [0.6, 1, 0.9]);
    hk.box(0.024, 0.018, 0.01, 0x1a1412, [s * 0.04, hy + 0.025, 0.105]);
    hk.box(0.04, 0.01, 0.012, hair, [s * 0.042, hy + 0.05, 0.104], [0, 0, s * -0.12]);
  }
  hk.box(0.04, 0.01, 0.01, girl ? 0xa83a3a : 0x8a4a40, [0, hy - 0.06, 0.1]);
  if (look.moustache) hk.box(0.07, 0.016, 0.016, hair, [0, hy - 0.042, 0.108]);
  if (look.glasses) { for (const s of [-1, 1]) hk.add(new THREE.TorusGeometry(0.026, 0.006, 3, 10), look.glasses === 'thick' ? 0x0a0a0a : 0x1a1a1a, [s * 0.042, hy + 0.025, 0.112]); hk.box(0.025, 0.006, 0.006, 0x1a1a1a, [0, hy + 0.03, 0.115]); }
  const hat = look.hat || 'none';
  if (kind === 'swimmer') { hk.ball(0.12, 1, 0x1a1a1e, [0, hy + 0.03, -0.01], 0, [1, 1, 1.04]); hk.box(0.2, 0.07, 0.04, 0x3a4a5a, [0, hy + 0.03, 0.11]); }
  else if (hat !== 'kerchief') hk.ball(0.118, 1, hair, [0, hy + 0.04, -0.018], 0, [0.98, girl ? 0.95 : 0.8, 1.02]);
  if (girl && hat !== 'kerchief' && kind !== 'swimmer') { hk.ball(look.bouffant ? 0.1 : 0.06, 1, hair, [0, hy + (look.bouffant ? 0.08 : 0.02), -0.09]); if (kid) for (const s of [-1, 1]) hk.cyl(0.025, 0.018, 0.2, 6, hair, [s * 0.1, hy - 0.12, -0.04]); }
  const hc = look.hatCol ?? 0x3a3430;
  if (hat === 'ushanka') { hk.ball(0.13, 1, hc, [0, hy + 0.08, -0.01], 0, [1.02, 0.62, 1.02]); hk.cyl(0.132, 0.135, 0.08, 12, _col.setHex(hc).multiplyScalar(0.8).getHex(), [0, hy + 0.06, -0.01]); for (const s of [-1, 1]) hk.box(0.035, 0.1, 0.11, _col.setHex(hc).multiplyScalar(0.8).getHex(), [s * 0.125, hy + 0.1, -0.01], [0, 0, s * 0.5]); }
  if (hat === 'cap') { hk.cyl(0.125, 0.12, 0.06, 12, hc, [0, hy + 0.11, -0.005]); hk.ball(0.12, 1, hc, [0, hy + 0.13, 0.02], 0, [1.05, 0.35, 1.1]); hk.box(0.18, 0.014, 0.08, _col.setHex(hc).multiplyScalar(0.8).getHex(), [0, hy + 0.09, 0.13], [0.15, 0, 0]); }
  if (hat === 'fedora') { hk.cyl(0.1, 0.115, 0.12, 12, hc, [0, hy + 0.15, -0.01]); hk.cyl(0.118, 0.118, 0.03, 12, 0x1a1a1a, [0, hy + 0.11, -0.01]); hk.cyl(0.18, 0.18, 0.012, 16, hc, [0, hy + 0.095, -0.01]); }
  if (hat === 'peaked') { hk.cyl(0.15, 0.12, 0.05, 14, hc, [0, hy + 0.15, -0.01]); hk.cyl(0.12, 0.12, 0.05, 12, look.band ?? 0x8a2a2a, [0, hy + 0.11, -0.01]); hk.box(0.17, 0.012, 0.07, 0x1a1a1a, [0, hy + 0.085, 0.12], [0.25, 0, 0]); hk.ball(0.015, 0, 0xd8b040, [0, hy + 0.12, 0.122]); }
  if (hat === 'beret') hk.ball(0.13, 1, hc, [0.02, hy + 0.11, -0.01], [0, 0, 0.15], [1.05, 0.38, 1.05]);
  if (hat === 'kerchief') { hk.ball(0.125, 1, hc, [0, hy + 0.035, -0.035], 0, [1.02, 1.05, 0.98]); hk.box(0.06, 0.05, 0.04, hc, [0, hy - 0.13, 0.04]); }
  if (hat === 'sailor') { hk.cyl(0.14, 0.1, 0.07, 14, 0xf4f4f0, [0, hy + 0.14, -0.01]); hk.cyl(0.155, 0.155, 0.02, 14, 0xf4f4f0, [0, hy + 0.12, -0.01]); }
  if (hat === 'hardhat') { hk.ball(0.135, 1, hc ?? 0xe8e8e0, [0, hy + 0.08, -0.01], 0, [1, 0.7, 1.08]); hk.cyl(0.17, 0.17, 0.012, 16, hc ?? 0xe8e8e0, [0, hy + 0.06, 0.01]); }
  if (look.headset) { hk.add(new THREE.TorusGeometry(0.125, 0.01, 4, 14, Math.PI), 0x2a2a2a, [0, hy, 0], [0, 0, 0]); hk.cyl(0.035, 0.035, 0.03, 10, 0x1a1a1a, [0.12, hy, 0], [0, 0, Math.PI / 2]); hk.cyl(0.006, 0.006, 0.12, 4, 0x1a1a1a, [0.09, hy - 0.05, 0.07], [0.8, 0.6, 0]); }
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); g.userData.kind = 'characters';
  inner.add(k.mesh(FLAT));
  const legs = [lk.mesh(FLAT), sk.mesh(FLAT)]; legs[1].visible = false; inner.add(...legs);
  const head = new THREE.Group(); head.position.set(0, 1.5, 0); inner.add(head);
  const hm = hk.mesh(SOFT); hm.position.set(0, -1.5, 0); head.add(hm); if (kid) head.scale.setScalar(1.16);
  const arms = [];
  for (const sx of [-1, 1]) {
    const ak = new Kit();
    if (shirt) { ak.cyl(0.064, 0.058, 0.22, 8, sleeve, [0, -0.11, 0]); ak.cyl(0.048, 0.044, 0.36, 8, skin, [0, -0.38, 0]); }
    else { ak.cyl(0.062, 0.054, 0.56, 8, sleeve, [0, -0.28, 0]); ak.cyl(0.058, 0.058, 0.05, 8, _col.setHex(sleeve).multiplyScalar(0.75).getHex(), [0, -0.55, 0]); }
    ak.ball(0.046, 1, look.gloves ?? (kind === 'swimmer' ? 0x1a1a1e : skin), [0, -0.62, 0.01], 0, [0.8, 1.1, 0.7]);
    const arm = new THREE.Group(); arm.add(ak.mesh(FLAT)); arm.position.set(sx * 0.235, 1.38, 0); inner.add(arm); arms.push(arm);
  }
  inner.scale.setScalar(H);
  const P = { g, inner, arms, head, legs, pose: 'idle', phase: R() * 6, pointAt: new THREE.Vector3(), placeholder: true, H, folk: true };
  g.userData.person = P;
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

// ---------- A big crowd in four draw calls ----------
// spots: [{ x, y, z, yaw }]. Each person: a body (coloured per person), a head (skin and hair), two arms.
// update(t, mood): 'idle' (shifting, glancing), 'cheer' (arms up, bouncing), 'wave' (one arm waving),
// 'fan' (fanning themselves with a programme: Rice Stadium's heat), 'look' (everyone looks at P.look).
const CROWD_COATS = [0x2a3a5a, 0x5a2a2a, 0x3a4a3a, 0x6a5a40, 0xc8c0a8, 0x4a4a52, 0x8a3a5a, 0xd8d0c0, 0x3a6a8a, 0xb88a3a, 0xe8e4dc, 0x5a7a4a];
export class Crowd {
  constructor(spots, { seed = 5, coats = CROWD_COATS, scale = 1, sit = false, skins = SKINS } = {}) {
    const r = rng(seed); this.spots = spots; this.n = spots.length; this.sit = sit;
    const bk = new Kit();
    if (!sit) { for (const s of [-1, 1]) bk.cyl(0.07, 0.06, 0.82, 5, 0x8a8a8a, [s * 0.1, 0.42, 0]); }
    else { for (const s of [-1, 1]) { bk.cyl(0.07, 0.065, 0.42, 5, 0x8a8a8a, [s * 0.1, 0.42, 0.2], [Math.PI / 2, 0, 0]); bk.cyl(0.065, 0.06, 0.42, 5, 0x8a8a8a, [s * 0.1, 0.21, 0.4]); } }
    bk.cyl(0.2, sit ? 0.22 : 0.24, 0.62, 7, 0xffffff, [0, sit ? 0.74 : 1.13, 0]);
    bk.ball(0.2, 0, 0xffffff, [0, sit ? 0.97 : 1.36, 0], 0, [1.1, 0.4, 0.8]);
    this.body = new THREE.InstancedMesh(bk.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), this.n);
    const hk = new Kit(); hk.ball(0.115, 1, 0xffffff, [0, 0, 0], 0, [0.92, 1.1, 1]); hk.cyl(0.05, 0.05, 0.1, 5, 0xffffff, [0, -0.12, 0]);
    this.head = new THREE.InstancedMesh(hk.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), this.n);
    const hairK = new Kit(); hairK.ball(0.122, 1, 0xffffff, [0, 0.04, -0.02], 0, [1, 0.8, 1.04]);
    this.hair = new THREE.InstancedMesh(hairK.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), this.n);
    const ak = new Kit(); ak.cyl(0.055, 0.048, 0.6, 5, 0xffffff, [0, -0.3, 0]);
    this.arm = new THREE.InstancedMesh(ak.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), this.n * 2);
    this.who = spots.map((p, i) => ({ coat: coats[Math.floor(r() * coats.length)], skin: skins[Math.floor(r() * skins.length)], hair: [0x2a1e14, 0x4a3420, 0x6a5038, 0x1a1614, 0x8a8478, 0xb89050][Math.floor(r() * 6)], ph: r() * 6.28, h: (0.92 + r() * 0.16) * scale, sp: 0.7 + r() * 0.6 }));
    this.who.forEach((w, i) => {
      this.body.setColorAt(i, _col.setHex(w.coat)); this.head.setColorAt(i, _col.setHex(w.skin)); this.hair.setColorAt(i, _col.setHex(w.hair));
      this.arm.setColorAt(i * 2, _col.setHex(w.coat)); this.arm.setColorAt(i * 2 + 1, _col.setHex(w.coat));
    });
    this.group = new THREE.Group(); this.group.add(this.body, this.head, this.hair, this.arm);
    for (const m of [this.body, this.head, this.hair, this.arm]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    this.mood = 'idle'; this.look = null; this.k = 0;
    this.update(0, 0);
  }
  update(t, dt, mood = this.mood) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3();
    this.k = damp(this.k, mood === 'cheer' ? 1 : mood === 'wave' ? 0.5 : mood === 'fan' ? 0.3 : 0, 3, dt || 0.016);
    const sit = this.sit;
    for (let i = 0; i < this.n; i++) {
      const S = this.spots[i], w = this.who[i], ph = w.ph + t * w.sp;
      const hop = mood === 'cheer' ? Math.max(0, Math.sin(ph * 4)) * 0.1 * this.k * (sit ? 0.5 : 1) : 0;
      let yaw = S.yaw + Math.sin(ph * 0.4) * 0.08;
      if (this.look) yaw = Math.atan2(this.look.x - S.x, this.look.z - S.z);
      q.setFromEuler(e.set(0, yaw, Math.sin(ph * 0.6) * 0.02)); s.setScalar(w.h);
      this.body.setMatrixAt(i, m.compose(p.set(S.x, S.y + hop, S.z), q, s));
      const hy = (sit ? 1.18 : 1.6) * w.h + hop;
      const hq = new THREE.Quaternion().setFromEuler(e.set(this.look ? -0.15 : Math.sin(ph * 0.3) * 0.05, yaw + Math.sin(ph * 0.5) * 0.25 * (this.look ? 0.2 : 1), 0));
      this.head.setMatrixAt(i, m.compose(p.set(S.x, S.y + hy, S.z), hq, s));
      this.hair.setMatrixAt(i, m);
      for (const sd of [0, 1]) {
        const sx = sd ? 1 : -1, sh = (sit ? 0.98 : 1.37) * w.h + hop;
        let ax = Math.sin(ph * 0.9 + sd) * 0.05, az = sx * 0.08;
        if (mood === 'cheer') { ax = -0.2; az = sx * (2.6 + Math.sin(ph * 6 + sd) * 0.25) * this.k + sx * 0.08 * (1 - this.k); }
        else if (mood === 'wave' && sd === 1 && (i % 2 === 0)) { az = (2.4 + Math.sin(t * 7 + w.ph) * 0.4) * this.k; }
        else if (mood === 'fan' && sd === 1 && (i % 3 !== 2)) { ax = -1.9 + Math.sin(t * 9 + w.ph) * 0.25; az = 0.5; }
        q.setFromEuler(e.set(ax, yaw, az, 'YXZ'));
        up.set(sx * 0.235 * w.h, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        this.arm.setMatrixAt(i * 2 + sd, m.compose(p.set(S.x + up.x, S.y + sh, S.z + up.z), q, s));
      }
    }
    for (const mm of [this.body, this.head, this.hair, this.arm]) mm.instanceMatrix.needsUpdate = true;
  }
  dispose() { for (const mm of [this.body, this.head, this.hair, this.arm]) { mm.geometry.dispose(); mm.material.dispose(); } }
}
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
