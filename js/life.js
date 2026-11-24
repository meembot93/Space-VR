// Life in the background: animals, birds, fish and dolphins, rising smoke and flapping cloth, so no
// scene ever stands still. Most of it is built in code (small and stylized, seen from a distance) and
// drawn with instancing: a whole herd is 2 draw calls (bodies + legs), a flock is 1. Sheep, cows,
// horses, dogs and the moose are Meem's rigged Tripo models once loaded (one draw call per animal).
//
//   const herd = makeHerd('reindeer', { n: 14, area: { x, z, r }, height: groundHeight, mode: 'migrate', dir: [1, 0] });
//   root.add(herd.group);  ...  herd.update(dt, t)   (every frame)
//
// Kinds: reindeer, horse, goat, sheep, cow, donkey, ibis, dog, moose. Modes: 'graze' (wander about the
// area, stopping to eat), 'migrate' (walk steadily across it the way dir points, and loop round),
// 'follow' (keep near herd.lead, a Vector3 you move, e.g. a herder).
// Also: makeFlock (birds wheeling overhead), makeDolphins (leaping in an arc out at sea),
// makeFish (a school circling), makeSmoke (a column of soft puffs), makeCloth (a flag or banner).
import * as THREE from 'three';
import { Kit } from './kit.js';
import { rng } from './shapes.js';
import { canvasTex } from './util.js';
import { loadGLB } from './models.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const _lq = new THREE.Quaternion();
const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

// ---------- The animals: a body (with head) and one leg, both facing +z, hips at y = 0 ----------
// leg: [length, radius, colour]; hips: where the legs join [[x, z], ...] (y = 0 is the hip line)
const KINDS = {
  reindeer: { leg: [0.66, 0.076, 0x5a4a3a], hips: [[-0.16, 0.5], [0.16, 0.5], [-0.16, -0.5], [0.16, -0.5]], speed: 1.1, graze: 0.22, body(k) {
    k.ball(0.33, 1, 0x7a6650, [0, 0.12, 0], 0, [0.85, 0.8, 2.0]);            // body
    k.ball(0.22, 1, 0xd8d0c0, [0, -0.06, 0.05], 0, [0.9, 0.6, 1.9]);         // pale belly
    k.cyl(0.11, 0.15, 0.55, 6, 0x8a7660, [0, 0.42, 0.62], [-0.7, 0, 0]);     // neck
    k.ball(0.17, 0, 0xe2dccc, [0, 0.28, 0.55], 0, [1, 1, 1.2]);              // white ruff
    k.ball(0.11, 1, 0x6a5848, [0, 0.66, 0.86], 0, [0.9, 0.9, 1.7]);          // head
    k.ball(0.05, 0, 0x2a2420, [0, 0.62, 1.04]);                              // nose
    for (const sx of [-1, 1]) {                                              // antlers
      k.tube([[sx * 0.06, 0.74, 0.8], [sx * 0.2, 1.0, 0.72], [sx * 0.32, 1.2, 0.86], [sx * 0.3, 1.38, 1.02]], 0.022, 0xd8c8a8, 4);
      k.tube([[sx * 0.2, 1.0, 0.72], [sx * 0.24, 1.14, 0.98]], 0.018, 0xd8c8a8, 4);
    }
    k.ball(0.07, 0, 0xe2dccc, [0, 0.2, -0.66]);                              // tail
  } },
  horse: { leg: [0.70, 0.085, 0x3a2e24], hips: [[-0.15, 0.5], [0.15, 0.5], [-0.15, -0.52], [0.15, -0.52]], speed: 1.4, graze: 0.28, body(k) {
    k.ball(0.34, 1, 0xb08a5a, [0, 0.14, 0], 0, [0.8, 0.85, 2.05]);
    k.cyl(0.12, 0.18, 0.62, 6, 0xb08a5a, [0, 0.5, 0.66], [-0.55, 0, 0]);
    k.box(0.06, 0.46, 0.3, 0x2a2018, [0, 0.62, 0.62], [-0.55, 0, 0]);       // upright dark mane
    k.ball(0.12, 1, 0xa07a4a, [0, 0.78, 0.96], 0, [0.85, 0.9, 1.9]);
    k.ball(0.08, 0, 0xe0d0b0, [0, 0.72, 1.16], 0, [1, 0.8, 1]);             // pale muzzle
    k.tube([[0, 0.2, -0.64], [0, 0.0, -0.78], [0, -0.35, -0.8]], 0.05, 0x2a2018, 4);   // tail
  } },
  goat: { leg: [0.37, 0.051, 0x4a3c30], hips: [[-0.1, 0.27], [0.1, 0.27], [-0.1, -0.27], [0.1, -0.27]], speed: 0.8, graze: 0.25, body(k) {
    k.ball(0.2, 1, 0xd8cfc0, [0, 0.08, 0], 0, [0.85, 0.85, 1.7]);
    k.cyl(0.06, 0.09, 0.3, 6, 0xd8cfc0, [0, 0.26, 0.32], [-0.5, 0, 0]);
    k.ball(0.08, 1, 0xcfc4b0, [0, 0.4, 0.45], 0, [0.8, 0.9, 1.5]);
    k.box(0.03, 0.08, 0.03, 0x8a7a68, [0, 0.29, 0.5]);                      // beard
    for (const sx of [-1, 1]) k.tube([[sx * 0.03, 0.46, 0.42], [sx * 0.06, 0.58, 0.36], [sx * 0.08, 0.6, 0.26]], 0.015, 0x5a4a3a, 4);   // horns
    k.box(0.04, 0.1, 0.04, 0xd8cfc0, [0, 0.22, -0.32], [0.6, 0, 0]);
  } },
  sheep: { leg: [0.33, 0.051, 0x2a2420], hips: [[-0.11, 0.25], [0.11, 0.25], [-0.11, -0.25], [0.11, -0.25]], speed: 0.7, graze: 0.3, body(k) {
    k.ball(0.26, 1, 0xeae4d6, [0, 0.12, 0], 0, [0.9, 0.85, 1.4]);
    k.ball(0.09, 1, 0x2e2824, [0, 0.18, 0.4], 0, [0.8, 0.9, 1.4]);
  } },
  cow: { leg: [0.55, 0.102, 0x4a3426], hips: [[-0.2, 0.52], [0.2, 0.52], [-0.2, -0.52], [0.2, -0.52]], speed: 0.8, graze: 0.3, body(k) {
    k.ball(0.42, 1, 0x8a5a36, [0, 0.16, 0], 0, [0.85, 0.85, 1.7]);
    k.ball(0.18, 1, 0xe8dcc8, [0.2, 0.25, 0.1], 0, [0.6, 1, 1.4]);         // a pale patch
    k.ball(0.15, 1, 0x7a4e30, [0, 0.36, 0.82], 0, [0.9, 1, 1.4]);
    k.ball(0.09, 0, 0xc8a890, [0, 0.3, 1.0], 0, [1.2, 0.8, 0.8]);
    for (const sx of [-1, 1]) k.tube([[sx * 0.1, 0.5, 0.8], [sx * 0.3, 0.6, 0.78], [sx * 0.36, 0.8, 0.84]], 0.03, 0xe8dcc0, 4);
    k.tube([[0, 0.3, -0.7], [0, 0, -0.76], [0, -0.35, -0.74]], 0.025, 0x4a3426, 4);
  } },
  donkey: { leg: [0.51, 0.068, 0x6a6058], hips: [[-0.12, 0.38], [0.12, 0.38], [-0.12, -0.38], [0.12, -0.38]], speed: 0.9, graze: 0.25, body(k) {
    k.ball(0.27, 1, 0x8a8078, [0, 0.12, 0], 0, [0.8, 0.85, 1.8]);
    k.cyl(0.09, 0.13, 0.4, 6, 0x8a8078, [0, 0.36, 0.46], [-0.6, 0, 0]);
    k.ball(0.1, 1, 0x7a7068, [0, 0.52, 0.66], 0, [0.85, 0.9, 1.8]);
    k.ball(0.06, 0, 0xd8d0c8, [0, 0.47, 0.82]);
    for (const sx of [-1, 1]) k.box(0.04, 0.2, 0.06, 0x7a7068, [sx * 0.05, 0.7, 0.6], [-0.2, 0, sx * 0.25]);   // long ears
    k.box(0.28, 0.24, 0.5, 0x8a6a40, [0, 0.36, -0.05]);                     // a load of baskets
  } },
  dog: { leg: [0.28, 0.051, 0x5a4430], hips: [[-0.08, 0.22], [0.08, 0.22], [-0.08, -0.22], [0.08, -0.22]], speed: 1.6, graze: 0.05, body(k) {
    k.ball(0.15, 1, 0x7a5a3a, [0, 0.06, 0], 0, [0.85, 0.85, 1.9]);
    k.ball(0.1, 1, 0x6a4a2e, [0, 0.24, 0.32], 0, [0.9, 0.9, 1.4]);
    k.ball(0.05, 0, 0x2a2018, [0, 0.22, 0.46]);
    for (const sx of [-1, 1]) k.box(0.04, 0.09, 0.03, 0x4a3420, [sx * 0.06, 0.34, 0.3]);
    k.tube([[0, 0.1, -0.26], [0, 0.22, -0.36], [0, 0.3, -0.36]], 0.025, 0x7a5a3a, 4);
  } },
  moose: { leg: [0.95, 0.09, 0x3a2e26], hips: [[-0.19, 0.62], [0.19, 0.62], [-0.19, -0.6], [0.19, -0.6]], speed: 0.9, graze: 0.25, body(k) {   // (until Meem's moose model loads)
    k.ball(0.42, 1, 0x4a3a2e, [0, 0.14, 0], 0, [0.85, 0.95, 2.0]);
    k.ball(0.26, 1, 0x3e3026, [0, 0.42, 0.45], 0, [0.9, 0.8, 1.3]);          // shoulder hump
    k.cyl(0.14, 0.18, 0.5, 6, 0x4a3a2e, [0, 0.42, 0.8], [-1.0, 0, 0]);       // neck
    k.ball(0.14, 1, 0x3a2c22, [0, 0.52, 1.12], 0, [0.8, 0.9, 2.0]);          // long head
    for (const sx of [-1, 1]) k.box(0.42, 0.04, 0.24, 0xc8b898, [sx * 0.3, 0.8, 1.0], [0, 0, sx * 0.35]);   // palm antlers
  } },
  ibis: { leg: [0.36, 0.012, 0x2a2420], hips: [[-0.05, 0.02], [0.05, 0.02]], speed: 0.35, graze: 0.5, body(k) {   // the sacred ibis of the Nile
    k.ball(0.13, 1, 0xf2efe6, [0, 0.06, 0], 0, [0.8, 0.8, 1.6]);
    k.box(0.2, 0.06, 0.16, 0x1a1816, [0, 0.08, -0.24]);                     // black tail plumes
    k.tube([[0, 0.12, 0.16], [0, 0.3, 0.2], [0, 0.36, 0.26]], 0.022, 0x1e1c1a, 4);   // black neck
    k.ball(0.035, 0, 0x1e1c1a, [0, 0.37, 0.28]);
    k.tube([[0, 0.37, 0.3], [0, 0.33, 0.4], [0, 0.24, 0.46]], 0.01, 0x1e1c1a, 3);    // curved bill
  } },
};
const geoCache = {};
function animalGeo(kind) {
  if (geoCache[kind]) return geoCache[kind];
  const K = KINDS[kind], k = new Kit(); K.body(k);
  const body = k.geometry();
  const lk = new Kit(), [len, rad, col] = K.leg;
  lk.cyl(rad, rad * 0.75, len, 5, col, [0, -len / 2, 0]);
  lk.box(rad * 2.2, rad * 1.4, rad * 2.6, 0x1e1a16, [0, -len + rad * 0.5, rad * 0.4]);   // hoof / foot
  return (geoCache[kind] = { body, leg: lk.geometry() });
}

// ---------- Meem's Tripo animals: rigged models, walked and posed here by turning their bones ----------
// Lighter copies of models/<kind>.glb for herds live in models/herd/ (made with gltf-transform weld +
// simplify, see README). Each model's head points along -x in the file; it is turned to face +z.
// size: how tall the whole model stands in metres, set so the shoulder is life size (the number in
// brackets). legs: [top bone, lower joint] for left front, right front, left hind, right hind (Tripo's
// names are a muddle, so they are picked by hand from where the bones sit). knee: which way the lower
// joint folds as the foot lifts (+1 foot forward, -1 foot back) for [front, hind]. head: neck bones that
// bow to graze (graze: radians for each, then how far the whole body tips forward, front legs
// splayed) and turn to look. tail: root first. wag: 'side' swings a hanging tail (cows, horses),
// 'wag' a dog's raised tail. gait: 'walk' (four beats) or 'trot' (diagonal pairs, dogs).
const MODELS = {
  sheep: { file: 'herd/sheep.glb', size: 0.87 /* 0.75 m */, legs: [['Spine_3', '0_Left_Limb_0'], ['bone_20', '0_Right_Limb_0'], ['bone_1', '1_Left_Limb_1'], ['bone_5', '1_Right_Limb_1']], knee: [-1, 1], head: ['Head_0', 'Head_1'], graze: [0.95, 0.45, 0.06], tail: ['bone_25', 'bone_26'], wag: 'side', gait: 'walk' },
  cow: { file: 'herd/cow.glb', size: 1.52 /* 1.35 m */, legs: [['0_Left_Limb_0', '0_Left_Limb_1'], ['0_Right_Limb_0', '0_Right_Limb_1'], ['1_Left_Limb_0', '1_Left_Limb_2'], ['1_Right_Limb_0', '1_Right_Limb_2']], knee: [-1, 1], head: ['Head_0', 'Head_1'], graze: [0.85, 0.35, 0.05], tail: ['bone_21', 'bone_22', 'bone_23'], wag: 'side', gait: 'walk' },
  horse: { file: 'herd/horse.glb', size: 1.92 /* 1.55 m */, legs: [['0_Left_Limb_0', '0_Left_Limb_1'], ['0_Right_Limb_0', '0_Right_Limb_1'], ['1_Left_Limb_0', '1_Left_Limb_1'], ['1_Right_Limb_0', '1_Right_Limb_1']], knee: [-1, 1], head: ['Head_0', 'Head_1'], graze: [1.55, 0.1, 0.05], tail: ['Tail_0', 'Tail_1', 'bone_22'], wag: 'side', gait: 'walk' },
  dog: { file: 'herd/dog.glb', size: 0.75 /* 0.55 m */, legs: [['0_Left_Limb_0', '0_Left_Limb_2'], ['0_Right_Limb_0', '0_Right_Limb_2'], ['1_Left_Limb_0', '1_Left_Limb_2'], ['1_Right_Limb_0', '1_Right_Limb_2']], knee: [-1, 1], head: ['Head_0', 'Head_1'], graze: [0.6, 0.35], tail: ['Tail_0', 'bone_35'], wag: 'wag', gait: 'trot' },
  moose: { file: 'herd/moose.glb', size: 2.32 /* 1.9 m */, legs: [['0_Left_Limb_1', '0_Left_Limb_3'], ['0_Right_Limb_0', '0_Right_Limb_2'], ['1_Left_Limb_0', '1_Left_Limb_2'], ['bone_30', '1_Right_Limb_1']], knee: [-1, 1], head: ['Head_0', 'bone_15'], graze: [0.75, 0.35, 0.045], tail: ['bone_34'], wag: 'side', gait: 'walk' },
};
const boneKey = (o) => o.name.replace(/^tripo[:_]*/, '');
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const rigCache = {};
// Load a kind once: the model turned and sized (feet on y = 0, facing +z), and for each bone it moves,
// its rest pose and the axes (side to side, up, forward) in its parent's space.
function animalRig(kind) {
  const M = MODELS[kind];
  return (rigCache[kind] ||= loadGLB(M.file).then((gltf) => {
    if (!gltf) return null;
    const inner = gltf.scene; inner.rotation.y = Math.PI / 2;
    const proto = new THREE.Group(); proto.add(inner);
    proto.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(proto);
    const k = M.size / (box.max.y - box.min.y);
    inner.scale.setScalar(k); proto.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(proto);
    const c = box.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, -box.min.y, -c.z); proto.updateMatrixWorld(true);
    const bones = {};
    let mesh = null;
    proto.traverse((o) => { if (o.name && !o.isMesh) bones[boneKey(o)] = o; if (o.isSkinnedMesh) mesh = o; });
    untangleLegs(mesh, M.legs.map(([hip]) => bones[hip]));
    mesh.computeBoundingSphere(); mesh.boundingSphere.radius *= 1.15;
    const used = [...M.legs.flat(), ...M.head, ...M.tail];
    const info = {}, pq = new THREE.Quaternion(), wp = new THREE.Vector3();
    for (const name of used) {
      const b = bones[name]; if (!b) { console.warn('Animal bone missing', kind, name); continue; }
      b.parent.getWorldQuaternion(pq); pq.invert();
      info[name] = { rest: b.quaternion.clone(), x: X.clone().applyQuaternion(pq), y: Y.clone().applyQuaternion(pq), z: Z.clone().applyQuaternion(pq), h: b.getWorldPosition(wp).y, zp: wp.z };
    }
    // the legs' hip heights (for matching stride to speed), how long and wide the animal stands
    const legH = M.legs.map(([hip]) => info[hip]?.h ?? box.max.y * 0.6);
    const zf = info[M.legs[0][0]]?.zp ?? 0.3, zh = -(info[M.legs[2][0]]?.zp ?? -0.3);
    return { proto, info, legH, zf, zh, hipH: (legH[0] + legH[2]) / 2, len: box.max.z - box.min.z, wid: box.max.x - box.min.x };
  }));
}
// Tripo's auto-rig sometimes ties vertices of one leg to a bone of another leg (a front hoof that
// partly follows a hind foot), which tears the mesh as soon as the legs move apart. A vertex weighted
// to more than one leg is given wholly to the leg whose bones it sits nearest.
function untangleLegs(mesh, hips) {
  const geo = mesh.geometry, bonesArr = mesh.skeleton.bones;
  const group = bonesArr.map((b) => { for (let o = b; o; o = o.parent) { const j = hips.indexOf(o); if (j >= 0) return j; } return -1; });
  // points along each leg (its joints and the middles of its bones), in the mesh's own space
  const inv = mesh.matrixWorld.clone().invert(), pts = [[], [], [], []];
  bonesArr.forEach((b, i) => {
    if (group[i] < 0) return;
    const p = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv); pts[group[i]].push(p);
    if (b.parent?.isBone && group[bonesArr.indexOf(b.parent)] === group[i]) pts[group[i]].push(b.parent.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).add(p).multiplyScalar(0.5));
  });
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, v3 = new THREE.Vector3();
  for (let v = 0; v < si.count; v++) {
    let legsHere = 0;
    for (let k = 0; k < 4; k++) { const g = group[si.getComponent(v, k)]; if (g >= 0 && sw.getComponent(v, k) > 0) legsHere |= 1 << g; }
    if (!(legsHere & (legsHere - 1))) continue;                            // one leg (or none): fine
    v3.fromBufferAttribute(geo.attributes.position, v);
    let own = -1, od = 1e9;
    for (let g = 0; g < 4; g++) if (legsHere & (1 << g)) for (const p of pts[g]) { const dd = p.distanceToSquared(v3); if (dd < od) { od = dd; own = g; } }
    let best = -1, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (group[si.getComponent(v, k)] === own && w > bw) { bw = w; best = k; } }
    for (let k = 0; k < 4; k++) {
      const g = group[si.getComponent(v, k)], w = sw.getComponent(v, k);
      if (g >= 0 && g !== own && w > 0) { sw.setComponent(v, best, sw.getComponent(v, best) + w); sw.setComponent(v, k, 0); }
    }
  }
  sw.needsUpdate = true;
}
// A ready-to-pose copy: shares geometry and material with every other copy, has its own skeleton.
function animalCopy(rig) {
  const g = cloneSkinned(rig.proto), b = {};
  g.traverse((o) => { if (o.name && !o.isMesh) b[boneKey(o)] = o; });   // (some joints are plain nodes, not in the skin)
  return { g, b };
}
const _dq = new THREE.Quaternion(), _dq2 = new THREE.Quaternion();
function turnBone(copy, rig, name, axis, ang, axis2, ang2) {
  const bone = copy.b[name], I = rig.info[name]; if (!bone || !I) return;
  _dq.setFromAxisAngle(I[axis], ang);
  if (axis2) _dq.multiply(_dq2.setFromAxisAngle(I[axis2], ang2));
  bone.quaternion.copy(_dq).multiply(I.rest);
}
const smooth = (u) => u * u * (3 - 2 * u);
// Which part of its stride each leg is at (0..1) [LF, RF, LH, RH]: a walk puts the feet down
// left hind, left front, right hind, right front; a trot moves diagonal pairs together.
const GAITS = { walk: { off: [0.25, 0.75, 0, 0.5], duty: 0.65, maxA: 0.3 }, trot: { off: [0, 0.5, 0.5, 0], duty: 0.5, maxA: 0.42 } };

export function makeHerd(kind, { n = 8, area = { x: 0, z: 0, r: 20 }, height = null, mode = 'graze', dir = [1, 0], seed = 5, scale = 1, speed = null, y = null } = {}) {
  const K = KINDS[kind], geo = animalGeo(kind), r = rng(seed);
  const legs = K.hips.length, legLen = K.leg[0];
  const body = new THREE.InstancedMesh(geo.body, MAT, n), legM = new THREE.InstancedMesh(geo.leg, MAT, n * legs);
  body.frustumCulled = legM.frustumCulled = false;
  const group = new THREE.Group(); group.add(body, legM);
  const H = (x, z) => (y != null ? y : height ? height(x, z) : 0);
  const d = new THREE.Vector2(...dir).normalize();
  const A = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * area.r;
    const x = area.x + Math.cos(a) * rr, z = area.z + Math.sin(a) * rr;
    A.push({ x, z, yaw: mode === 'migrate' ? Math.atan2(d.x, d.y) : r() * 6.28, tx: x, tz: z, wait: r() * 6, stride: r() * 6, s: scale * (0.85 + r() * 0.3), v: 0, sp: (speed ?? K.speed) * (0.85 + r() * 0.3), off: (r() - 0.5) * area.r * 0.8, eat: 0 });
  }
  const herd = { group, kind, animals: A, lead: new THREE.Vector3(area.x, 0, area.z), mode, area, visible: true, ground: H };
  // Meem's model, once it has loaded: one skinned copy per animal replaces the code-built herd
  let rig = null, copies = null;
  const M = MODELS[kind];
  if (M) animalRig(kind).then((R) => {
    if (!R) return;
    rig = R; herd.copies = copies = A.map((o, i) => {
      const c = animalCopy(R); c.ms = scale * (1 + (o.s / scale - 1) * 0.5);   // models vary less in size
      c.g.scale.setScalar(c.ms); c.ph = (i * 0.37) % 1; c.gx = NaN; group.add(c.g); return c;
    });
    body.visible = legM.visible = false;
    herd.update(0, 0);
  });
  const poseModel = (o, c, i, dt, t) => {
    const R = rig, G = GAITS[M.gait];
    // ground: height under the animal, and its slope front to back and side to side (re-measured once it has moved)
    if (!(Math.abs(o.x - c.gx) < 0.04 && Math.abs(o.z - c.gz) < 0.04 && Math.abs(o.yaw - c.gyaw) < 0.03)) {
      const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), hl = R.len * c.ms * 0.33, hw = R.wid * c.ms * 0.3;
      const hf = H(o.x + fx * hl, o.z + fz * hl), hb = H(o.x - fx * hl, o.z - fz * hl);
      const hL = H(o.x + fz * hw, o.z - fx * hw), hR = H(o.x - fz * hw, o.z + fx * hw);
      c.gy = Math.min((hf + hb) / 2, (hL + hR) / 2 + 0.02); c.pitch = -Math.atan2(hf - hb, hl * 2); c.roll = Math.atan2(hL - hR, hw * 2) * 0.7;
      c.gx = o.x; c.gz = o.z; c.gyaw = o.yaw;
    }
    // stride: a natural step rate for its leg length, longer steps the faster it goes, quicker steps once they're as long as they get
    const hip = R.hipH * c.ms, v = Math.max(0, o.v);
    const f0 = 0.35 * Math.sqrt(9.8 / hip) * (M.gait === 'trot' ? 1.25 : 1);
    let amp = v * G.duty / (2 * hip * f0), f = f0;
    if (amp > G.maxA) { amp = G.maxA; f = v * G.duty / (2 * hip * amp); }
    if (v < 0.03) amp = 0;
    c.amp = (c.amp ?? 0) + (amp - (c.amp ?? 0)) * Math.min(1, dt * 4);
    c.ph = (c.ph + f * dt * (c.amp > 0.002 ? 1 : 0)) % 1;
    const run = Math.min(1, c.amp / 0.12);
    // grazing: the body tips forward over the hind feet and the front legs splay to keep the feet down
    const bow = o.eat * (M.graze[2] || 0), drop = (R.zf + R.zh) * Math.sin(bow) / R.legH[0];
    const splay = Math.acos(Math.max(0.5, 1 - drop));
    for (let j = 0; j < 4; j++) {
      const [hipB, kneeB] = M.legs[j], p = (c.ph + G.off[j]) % 1, a = c.amp * (hip / (R.legH[j] * c.ms));
      let th, lift = 0;
      if (p < G.duty) th = a * (1 - 2 * p / G.duty);                       // foot on the ground, sliding back under the body as fast as the body moves
      else { const u = (p - G.duty) / (1 - G.duty); th = -a + 2 * a * smooth(u); lift = Math.sin(Math.PI * u); }   // foot lifted and swung forward
      turnBone(c, R, hipB, 'x', -th - bow - (j < 2 ? splay : 0));
      turnBone(c, R, kneeB, 'x', -M.knee[j < 2 ? 0 : 1] * lift * Math.min(0.9, 0.25 + a * 2.2) * run);
    }
    // head: bows to graze, looks about when standing, nods a little with each step
    const look = (1 - o.eat) * (1 - run) * Math.sin(t * 0.23 + i * 2.1) * Math.sin(t * 0.11 + i) * 0.9;
    const nod = Math.sin(c.ph * Math.PI * 4) * 0.05 * run;
    turnBone(c, R, M.head[0], 'y', look * 0.7, 'x', o.eat * M.graze[0] + nod);
    turnBone(c, R, M.head[1], 'y', look * 0.4, 'x', o.eat * M.graze[1] - nod * 0.5);
    // tail: a lazy swish now and then (a dog wags quickly)
    const wag = M.wag === 'wag' ? Math.sin(t * 9 + i) * (0.35 + 0.25 * run) : Math.sin(t * 2.3 + i * 1.3) * 0.35 * Math.max(0, Math.sin(t * 0.37 + i * 3.1));
    M.tail.forEach((tb, j) => turnBone(c, R, tb, M.wag === 'wag' ? 'y' : 'z', wag * (j ? 0.5 : 1)));
    // the whole animal: on the ground, tilted with the slope, dipping a touch as the legs reach out
    const dip = hip * (1 - Math.cos(c.amp)) * 0.3, bob = Math.sin(c.ph * Math.PI * 4) * hip * 0.012 * run;
    c.g.position.set(o.x, c.gy - dip + bob - R.zh * c.ms * Math.sin(bow), o.z);
    _e.set(c.pitch + bow, o.yaw, c.roll, 'YXZ'); c.g.quaternion.setFromEuler(_e);
  };
  herd.update = (dt, t) => {
    if (!group.visible) return;
    // life-size models take room: nudge apart any two standing in each other
    if (copies && n > 1) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = A[i], b = A[j], dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz) || 1e-3;
      const need = rig.len * 0.5 * (copies[i].ms + copies[j].ms) * 0.5;
      if (dd < need) { const k = Math.min(1, dt * 2) * (need - dd) / dd * 0.5; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; }
    }
    for (let i = 0; i < n; i++) {
      const o = A[i];
      // where to go next
      let want = 0;
      if (herd.mode === 'migrate') {
        // walk across the area along dir, each at its own offset; loop back once past the far side
        const along = (o.x - area.x) * d.x + (o.z - area.z) * d.y;
        if (along > area.r) { o.x -= d.x * area.r * 2; o.z -= d.y * area.r * 2; }
        o.tx = o.x + d.x * 5 + -d.y * (o.off - ((o.x - area.x) * -d.y + (o.z - area.z) * d.x)) * 0.3;
        o.tz = o.z + d.y * 5 + d.x * (o.off - ((o.x - area.x) * -d.y + (o.z - area.z) * d.x)) * 0.3;
        want = o.sp;
      } else {
        const cx = herd.mode === 'follow' ? herd.lead.x : area.x, cz = herd.mode === 'follow' ? herd.lead.z : area.z;
        const dd = Math.hypot(o.tx - o.x, o.tz - o.z);
        if (dd < 0.3 || Math.hypot(o.tx - cx, o.tz - cz) > area.r * 1.3) {
          if ((o.wait -= dt) < 0) {
            const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * area.r;
            o.tx = cx + Math.cos(a) * rr; o.tz = cz + Math.sin(a) * rr; o.wait = 3 + Math.random() * 8;
          }
        } else want = o.sp * (herd.mode === 'follow' && dd > area.r ? 1.6 : 0.6);
      }
      o.v += (want - o.v) * Math.min(1, dt * 2);
      if (o.v > 0.02) {
        const dx = o.tx - o.x, dz = o.tz - o.z, dl = Math.hypot(dx, dz) || 1;
        let dy = Math.atan2(dx, dz) - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        o.yaw += dy * Math.min(1, dt * 2.5);
        o.x += Math.sin(o.yaw) * o.v * dt; o.z += Math.cos(o.yaw) * o.v * dt;
        o.stride += o.v * dt / (legLen * o.s * 0.9) * Math.PI;
        if (dl < 0.05) o.v = 0;
      }
      // grazing: when standing still, now and then the head goes down to eat
      o.eat += ((o.v < 0.1 && Math.sin(t * 0.4 + i * 1.7) > 0.1 ? 1 : 0) - o.eat) * Math.min(1, dt * 1.5);
      if (copies) { poseModel(o, copies[i], i, dt, t); continue; }
      const gy = H(o.x, o.z), hipY = legLen * o.s;
      const bob = Math.abs(Math.sin(o.stride)) * 0.04 * Math.min(1, o.v) * o.s;
      _e.set(o.eat * K.graze, o.yaw, 0, 'YXZ'); _q.setFromEuler(_e);
      _p.set(o.x, gy + hipY + bob, o.z); _s.setScalar(o.s);
      body.setMatrixAt(i, _m.compose(_p, _q, _s));
      // legs: swing in pairs (diagonal pairs for four legs)
      for (let j = 0; j < legs; j++) {
        const [hx, hz] = K.hips[j];
        const ph = legs === 4 ? (j === 0 || j === 3 ? 0 : Math.PI) : j * Math.PI;
        const swing = Math.sin(o.stride + ph) * 0.45 * Math.min(1, o.v / (o.sp * 0.5 + 1e-3));
        _p.set(hx * o.s, 0, hz * o.s).applyQuaternion(_q); _p.x += o.x; _p.y += gy + hipY + bob; _p.z += o.z;
        _e.set(swing, o.yaw, 0, 'YXZ'); _lq.setFromEuler(_e);
        legM.setMatrixAt(i * legs + j, _m.compose(_p, _lq, _s));
      }
    }
    if (!copies) { body.instanceMatrix.needsUpdate = true; legM.instanceMatrix.needsUpdate = true; }
  };
  herd.update(0, 0);
  return herd;
}

// ---------- Birds: a flock wheeling in loose circles, wings flapping (in the shader) ----------
function flapMaterial(color, speed = 11) {
  const m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true });
  const u = { time: { value: 0 } }; m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.23;
      float wing = abs(position.x);
      transformed.y += sin(uTime * ${speed.toFixed(1)} + ph) * wing * 0.9;`);
  };
  return m;
}
export function makeFlock({ n = 12, center = new THREE.Vector3(0, 30, 0), r = 25, height = 6, color = 0x2a2624, size = 1, seed = 3, speed = 6 } = {}) {
  const g = new THREE.BufferGeometry();
  // body + two wings (a flat V), facing +z, wingspan about 0.9 m
  const v = [0, 0, 0.18, -0.45, 0.02, -0.05, 0, 0, -0.12,   0, 0, 0.18, 0, 0, -0.12, 0.45, 0.02, -0.05,   0, 0, -0.12, -0.08, 0, -0.26, 0.08, 0, -0.26];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  const mat = flapMaterial(color, speed * 1.8);
  const mesh = new THREE.InstancedMesh(g, mat, n); mesh.frustumCulled = false;
  const rr = rng(seed), B = [];
  for (let i = 0; i < n; i++) B.push({ a: rr() * 6.28, rad: r * (0.5 + rr() * 0.5), h: (rr() - 0.5) * height, w: (speed / r) * (0.8 + rr() * 0.4) * (rr() < 0.15 ? -1 : 1), s: size * (0.8 + rr() * 0.4) });
  const flock = { group: mesh, center: center.clone(), visible: true };
  flock.update = (dt, t) => {
    mat.userData.u.time.value = t;
    for (let i = 0; i < n; i++) {
      const b = B[i]; b.a += b.w * dt;
      const wob = Math.sin(t * 0.3 + i) * 0.15;
      _p.set(flock.center.x + Math.cos(b.a) * b.rad * (1 + wob), flock.center.y + b.h + Math.sin(t * 0.5 + i * 2) * 1.5, flock.center.z + Math.sin(b.a) * b.rad * (1 + wob));
      // face along the circle (tangent), banking into the turn
      const yaw = Math.atan2(-Math.sin(b.a) * Math.sign(b.w), Math.cos(b.a) * Math.sign(b.w));
      _e.set(0, yaw, -0.35 * Math.sign(b.w), 'YXZ'); _q.setFromEuler(_e); _s.setScalar(b.s);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  flock.update(0, 0);
  return flock;
}

// ---------- Dolphins: a little pod leaping out of the sea in arcs as they swim past ----------
export function makeDolphins({ n = 4, center = new THREE.Vector3(0, 0, -80), r = 60, sea = 0, seed = 9, speed = 5 } = {}) {
  const k = new Kit();
  k.ball(0.32, 1, 0x6a7a88, [0, 0, 0], 0, [0.75, 0.8, 3.4]);
  k.ball(0.24, 1, 0xd8dde0, [0, -0.1, 0.1], 0, [0.7, 0.5, 2.8]);
  k.cyl(0.05, 0.07, 0.3, 4, 0x6a7a88, [0, 0, 1.15], [Math.PI / 2, 0, 0]);   // beak
  k.box(0.04, 0.32, 0.3, 0x5a6a78, [0, 0.3, -0.15], [-0.5, 0, 0]);          // dorsal fin
  k.box(0.6, 0.04, 0.22, 0x5a6a78, [0, 0, -1.1]);                           // tail flukes
  const mesh = new THREE.InstancedMesh(k.geometry(), MAT, n); mesh.frustumCulled = false;
  const rr = rng(seed), P = [];
  for (let i = 0; i < n; i++) P.push({ a: rr() * 0.5 + i * 0.12, lane: (rr() - 0.5) * 6, ph: rr() * 6, hop: 2.6 + rr() * 0.8 });
  const pod = { group: mesh, visible: true };
  pod.update = (dt, t) => {
    for (let i = 0; i < n; i++) {
      const d = P[i]; d.a += speed / r * dt;
      const rad = r + d.lane, x = center.x + Math.cos(d.a) * rad, z = center.z + Math.sin(d.a) * rad;
      // a leap every few seconds: up out of the water and back down nose first
      const c = ((t + d.ph) % d.hop) / d.hop, up = c < 0.4 ? Math.sin(c / 0.4 * Math.PI) : -0.4 * Math.sin((c - 0.4) / 0.6 * Math.PI);
      const slope = c < 0.4 ? Math.cos(c / 0.4 * Math.PI) : 0;
      _p.set(x, sea + up * 1.3 - 0.25, z);
      _e.set(-slope * 0.7, Math.atan2(-Math.sin(d.a), Math.cos(d.a)), 0, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(1);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  pod.update(0, 0);
  return pod;
}

// ---------- A school of fish circling (underwater) ----------
export function makeFish({ n = 30, center = new THREE.Vector3(), r = 4, height = 2, color = 0x8aa0b0, seed = 4, size = 0.18 } = {}) {
  const g = new THREE.BufferGeometry();
  const v = [0, 0, 1, 0, 0.35, 0, 0, -0.3, 0,   0, 0.35, 0, 0, 0, -0.9, 0, -0.3, 0,   0, 0, -0.9, 0, 0.35, -1.4, 0, -0.35, -1.4];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.15 });
  const mesh = new THREE.InstancedMesh(g, mat, n); mesh.frustumCulled = false;
  const rr = rng(seed), F = [];
  for (let i = 0; i < n; i++) F.push({ a: rr() * 6.28, rad: r * (0.6 + rr() * 0.5), h: (rr() - 0.5) * height, w: 0.35 + rr() * 0.15, s: size * (0.7 + rr() * 0.6) });
  const school = { group: mesh, center: center.clone(), visible: true };
  school.update = (dt, t) => {
    for (let i = 0; i < n; i++) {
      const f = F[i]; f.a += f.w * dt;
      _p.set(school.center.x + Math.cos(f.a) * f.rad, school.center.y + f.h + Math.sin(t + i) * 0.2, school.center.z + Math.sin(f.a) * f.rad);
      _e.set(0, Math.atan2(-Math.sin(f.a), Math.cos(f.a)) + Math.sin(t * 8 + i) * 0.15, 0, 'YXZ'); _q.setFromEuler(_e); _s.setScalar(f.s);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  school.update(0, 0);
  return school;
}

// ---------- Smoke: soft puffs rising and drifting from a chimney, a fire or an oven ----------
let smokeTex = null;
export function makeSmoke(pos, { n = 8, rise = 6, spread = 1.2, color = 0xb8b0a8, size = 1.2, opacity = 0.35, wind = [0.4, 0.15] } = {}) {
  smokeTex ||= canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const group = new THREE.Group(), puffs = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.k = i / n; group.add(s); puffs.push(s);
  }
  const smoke = { group, pos: pos.clone(), visible: true };
  smoke.update = (dt) => {
    for (const s of puffs) {
      const u = s.userData; u.k += dt / (rise / 0.6); if (u.k > 1) u.k -= 1;
      const k = u.k;
      s.position.set(smoke.pos.x + wind[0] * k * rise + Math.sin(k * 7 + u.k) * 0.1, smoke.pos.y + k * rise, smoke.pos.z + wind[1] * k * rise);
      s.scale.setScalar(size * (0.4 + k * spread * 2));
      s.material.opacity = opacity * Math.sin(Math.PI * Math.min(1, k * 1.3));
    }
  };
  smoke.update(0);
  return smoke;
}

// ---------- Cloth: a flag, banner or awning that ripples in the wind (vertex shader) ----------
export function makeCloth(w, h, { color = 0xc04030, map = null, wind = 1, hang = false } = {}) {
  const g = new THREE.PlaneGeometry(w, h, 8, 4);
  g.translate(hang ? 0 : w / 2, hang ? -h / 2 : 0, 0);   // flag: fixed edge at x = 0. banner: hangs down from y = 0
  const m = new THREE.MeshLambertMaterial({ color, map, side: THREE.DoubleSide });
  const u = { time: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float f = ${hang ? `clamp(-position.y / ${h.toFixed(2)}, 0.0, 1.0)` : `clamp(position.x / ${w.toFixed(2)}, 0.0, 1.0)`};
      transformed.z += sin(uTime * 3.1 + position.x * 2.5 + position.y * 1.3) * f * ${(0.12 * wind).toFixed(3)} + sin(uTime * 5.3 + position.x * 4.0) * f * ${(0.04 * wind).toFixed(3)};`);
  };
  const mesh = new THREE.Mesh(g, m);
  const cloth = { group: mesh, visible: true, update: (dt, t) => { u.time.value = t; } };
  return cloth;
}

// A little bag of living things: add() any of the above, and update them all in one call.
export class Life {
  constructor(parent) { this.parent = parent; this.items = []; }
  add(item) { this.parent.add(item.group); this.items.push(item); return item; }
  update(dt, t) { for (const it of this.items) if (it.group.visible) it.update(dt, t); }
}

// ---------- A burning torch (or lamp) to put in someone's hand: a stick and a flickering flame ----------
let flameTex = null;
export function makeTorch({ len = 0.8, color = 0xffa040, size = 1 } = {}) {
  flameTex ||= canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const g = new THREE.Group(), k = new Kit();
  k.cyl(0.025, 0.03, len, 5, 0x4a3420, [0, len / 2, 0]); k.cyl(0.05, 0.04, 0.12, 6, 0x2a1a10, [0, len + 0.02, 0]); g.add(k.mesh(MAT));
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  f.position.y = len + 0.18; f.scale.set(0.35 * size, 0.5 * size, 1); g.add(f);
  const ph = Math.random() * 6;
  g.userData.flicker = (t, bright = 1) => { f.scale.set((0.3 + 0.06 * Math.sin(t * 13 + ph)) * size, (0.45 + 0.1 * Math.sin(t * 9 + ph * 2)) * size, 1); f.material.opacity = bright; };
  return g;
}
