// Placeholder people: simple stylized figures built in code, in a plain "clay" look on purpose
// so it's obvious they are stand-ins. Each one is replaced by Meem's Tripo character as soon
// as that model is listed in models/index.json (see docs/ASSETS.md).
//
// A figure has a body (one merged mesh) and two arms that can move, so it can pose:
//   'idle', 'point' (at figure.pointAt), 'pull' (hauling a rope), 'cheer'.
// Add ?labels to the address to see a "PLACEHOLDER" tag over every stand-in.
import * as THREE from 'three';
import { Kit, vary } from './kit.js';
import { loadModel } from './models.js';
import { canvasTex } from './util.js';

const CLAY = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const _a = new THREE.Vector3(), _q = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);

function tag() {
  const tex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = 'rgba(255,60,160,0.85)'; g.beginPath(); g.roundRect(2, 2, w - 4, h - 4, 12); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PLACEHOLDER', w / 2, h / 2 + 1);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  s.scale.set(0.6, 0.15, 1); return s;
}

// look: { tunic, skin, hair, beard, height, seed }
export function makePerson(look = {}) {
  let s = look.seed || 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const H = (look.height || 1.75) / 1.75;
  const tunic = vary(look.tunic ?? 0x9a8a72, 0.08, rnd), skin = vary(look.skin ?? 0xc8a68a, 0.06, rnd), hair = look.hair ?? 0x5a4030;
  const k = new Kit();
  // legs, tunic to the knee, belt, chest, head, hair
  k.cyl(0.06, 0.05, 0.5, 6, skin, [-0.09, 0.25, 0]); k.cyl(0.06, 0.05, 0.5, 6, skin, [0.09, 0.25, 0]);
  k.box(0.12, 0.06, 0.2, 0x4a3a2a, [-0.09, 0.03, 0.03]); k.box(0.12, 0.06, 0.2, 0x4a3a2a, [0.09, 0.03, 0.03]);
  k.cyl(0.2, 0.28, 0.55, 8, tunic, [0, 0.72, 0]);
  k.cyl(0.21, 0.21, 0.06, 8, 0x5a3e24, [0, 0.98, 0]);
  k.cyl(0.17, 0.21, 0.42, 8, tunic, [0, 1.2, 0]);
  k.cyl(0.07, 0.08, 0.1, 6, skin, [0, 1.44, 0]);
  k.ball(0.13, 1, skin, [0, 1.6, 0], 0, [1, 1.12, 1.05]);
  k.ball(0.135, 1, hair, [0, 1.65, -0.02], 0, [1.02, 0.9, 1.05]);
  if (look.beard) k.ball(0.1, 1, hair, [0, 1.52, 0.06], 0, [1, 0.8, 0.8]);
  k.box(0.03, 0.03, 0.02, 0x000000, [-0.045, 1.62, 0.12]); k.box(0.03, 0.03, 0.02, 0x000000, [0.045, 1.62, 0.12]);
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const body = k.mesh(CLAY); inner.add(body);
  const arms = [];
  for (const sx of [-1, 1]) {
    const ak = new Kit();
    ak.cyl(0.055, 0.05, 0.62, 6, tunic, [0, -0.28, 0]);
    ak.ball(0.055, 0, skin, [0, -0.62, 0]);
    const arm = new THREE.Group(); arm.add(ak.mesh(CLAY));
    arm.position.set(sx * 0.24, 1.36, 0); inner.add(arm); arms.push(arm);
  }
  inner.scale.setScalar(H);
  const P = { g, inner, arms, pose: 'idle', phase: rnd() * 6, pointAt: new THREE.Vector3(), placeholder: true, H };
  if (new URLSearchParams(location.search).has('labels')) { const t = tag(); t.position.y = 2.05 * H; g.add(t); }
  // Meem's Tripo model, when there is one for this kind of person (look.model, e.g. 'builder')
  if (look.model) loadModel(look.model).then((m) => {
    if (!m) return;
    inner.remove(body); for (const a of arms) a.visible = false;
    inner.add(m.scene); P.placeholder = false; P.model = m;
    P.rig = findRig(m.scene);
  });
  return P;
}

// ---------- Rigged models (Tripo auto-rig, Mixamo bone names) ----------
// Tripo's rigs have no animation clips, so poses are made here by turning the arm and spine
// bones. Each arm is aimed at a direction in the figure's own space (x right, y up, z forward),
// which works whatever way the bones' own axes happen to point.
export function findRig(root) {
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name.replace(/^mixamorig[:_]?/, '')] = o; });
  if (!bones.LeftArm || !bones.RightArm) return null;
  const rest = new Map(); for (const b of Object.values(bones)) rest.set(b, b.quaternion.clone());
  return { bones, rest };
}
const _w0 = new THREE.Vector3(), _w1 = new THREE.Vector3(), _dq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _d = new THREE.Vector3();
// Point bone's direction (toward its child) at world direction `want`, blending by k
function aimBone(bone, child, want, k) {
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(false, false);
  bone.getWorldPosition(_w0); child.getWorldPosition(_w1);
  _d.subVectors(_w1, _w0).normalize();
  _dq.setFromUnitVectors(_d, want);
  bone.getWorldQuaternion(_bq); _bq.premultiply(_dq);
  bone.parent.getWorldQuaternion(_pq).invert();
  _bq.premultiply(_pq);
  bone.quaternion.slerp(_bq, k);
}
const _arm = new THREE.Vector3();
function poseRig(P, t, dt) {
  const { bones: B, rest } = P.rig, ph = P.phase + t, k = Math.min(1, dt * 6);
  for (const [b, q] of rest) if (b === B.Spine || b === B.Hips) b.quaternion.copy(q);
  // A gentle lean (hauling leans back)
  if (B.Spine) B.Spine.rotateX(P.pose === 'pull' ? -0.25 - 0.1 * Math.sin(t * 2.6) : Math.sin(ph * 0.7) * 0.02);
  P.inner.updateWorldMatrix(true, false);
  const dirs = { // [left, right] in the figure's own space
    idle: [[-0.18, -1, 0.05], [0.18, -1, 0.05]],
    pull: [[0.12, -0.3 - 0.15 * Math.sin(t * 2.6), 1], [-0.12, -0.35 - 0.15 * Math.sin(t * 2.6), 1]],
    cheer: [[-0.5, 1, 0.15], [0.5, 1, 0.15]],
    point: [[-0.18, -1, 0.05], null],
  }[P.pose] || [[-0.18, -1, 0.05], [0.18, -1, 0.05]];
  ['Left', 'Right'].forEach((side, i) => {
    const up = B[side + 'Arm'], fore = B[side + 'ForeArm'], hand = B[side + 'Hand'];
    if (!up || !fore) return;
    up.quaternion.copy(rest.get(up)); fore.quaternion.copy(rest.get(fore));
    // (a rig's LeftArm is on the figure's own left, +x, the mirror of the stand-in's first arm)
    if (dirs[i]) _arm.set(-dirs[i][0], dirs[i][1], dirs[i][2]).normalize().transformDirection(P.inner.matrixWorld);
    else { up.getWorldPosition(_w0); _arm.subVectors(P.pointAt, _w0).normalize(); }
    if (P.pose === 'cheer') _arm.applyAxisAngle(_w0.set(0, 0, 1).transformDirection(P.inner.matrixWorld), Math.sin(ph * 7 + i) * 0.2 * (i ? 1 : -1));
    aimBone(up, fore, _arm, 1);
    if (hand) aimBone(fore, hand, _arm, 1);
  });
  // the "bob" for cheering
  P.inner.position.y = P.pose === 'cheer' ? Math.max(0, Math.sin(ph * 5)) * 0.12 : 0;
}

// Move a figure for this frame: t = game time
export function animatePerson(P, t, dt) {
  if (P.rig) { poseRig(P, t, dt); return; }
  const [L, R] = P.arms, ph = P.phase + t;
  P.inner.position.y = 0; P.inner.rotation.set(0, 0, 0);
  const set = (arm, x, z) => { arm.rotation.x += (x - arm.rotation.x) * Math.min(1, dt * 6); arm.rotation.z += (z - arm.rotation.z) * Math.min(1, dt * 6); };
  switch (P.pose) {
    case 'point': {
      // Right arm points at P.pointAt (worked out in the figure's own space)
      _a.copy(P.pointAt); P.g.worldToLocal(_a); _a.y -= 1.36 * P.H; _a.x -= 0.24 * P.H; _a.normalize();
      _q.setFromUnitVectors(DOWN, _a); R.quaternion.slerp(_q, Math.min(1, dt * 5));
      set(L, 0.05, -0.08);
      break;
    }
    case 'pull': {
      // Leaning back and hauling, both hands forward on the rope, in time with the others
      const beat = Math.sin(t * 2.6);
      P.inner.rotation.x = -0.25 - 0.12 * beat;
      set(L, -1.25 - 0.25 * beat, 0.12); set(R, -1.15 - 0.25 * beat, -0.12);
      break;
    }
    case 'cheer': {
      const j = Math.max(0, Math.sin(ph * 5));
      P.inner.position.y = j * 0.12;
      set(L, -0.2, -2.6 - Math.sin(ph * 7) * 0.2); set(R, -0.2, 2.6 + Math.sin(ph * 7 + 1) * 0.2);
      break;
    }
    default: {
      P.inner.rotation.z = Math.sin(ph * 0.7) * 0.02;
      set(L, Math.sin(ph * 0.9) * 0.05, -0.08); set(R, -Math.sin(ph * 0.9) * 0.05, 0.08);
    }
  }
}
