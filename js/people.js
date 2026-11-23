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
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); g.userData.kind = 'characters';
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
  const P = { g, inner, arms, pose: 'idle', phase: rnd() * 6, pointAt: new THREE.Vector3(), placeholder: true, H, who: look.model };
  g.userData.person = P;   // lets tools/test/clip-test.js find everyone in the scene
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
const _arm = new THREE.Vector3(), _fore = new THREE.Vector3(), _hp = new THREE.Vector3(), _fq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _ax = new THREE.Vector3();
// Arm directions for each pose, in the figure's own space (x its right, y up, z forward):
// [left upper arm, right upper arm] and optionally [left forearm, right forearm] (else straight).
// w = the walk cycle, t = time, ph = this person's own phase.
function armDirs(pose, t, ph, w) {
  const sw = Math.sin(w), b = Math.sin(t * 2.6);
  switch (pose) {
    case 'pull': return [[[0.12, -0.3 - 0.15 * b, 1], [-0.12, -0.35 - 0.15 * b, 1]]];
    case 'cheer': return [[[-0.5, 1, 0.15], [0.5, 1, 0.15]]];
    case 'point': return [[[-0.18, -1, 0.05], null]];
    case 'walk': return [[[-0.15, -1, 0.35 * sw], [0.15, -1, -0.35 * sw]], [[-0.1, -1, 0.35 * sw + 0.25], [0.1, -1, -0.35 * sw + 0.25]]];
    case 'talk': { // explaining: hands open in front, moving with the words
      const a = Math.sin(ph * 2.3 + t * 2.1), c = Math.sin(ph + t * 1.6);
      return [[[-0.3, -0.75, 0.45 + 0.15 * c], [0.3, -0.7 + 0.1 * a, 0.5]], [[-0.35, -0.1 + 0.15 * c, 1], [0.3, 0.05 + 0.2 * a, 1]]];
    }
    case 'gasp': return [[[-0.3, -0.45, 0.9], [0.3, -0.45, 0.9]], [[0.35, 1, 0.35], [-0.35, 1, 0.35]]];   // hands up to the face
    case 'wave': return [[[-0.18, -1, 0.05], [0.75, 0.35, 0.25]], [null, [0.25 + 0.45 * Math.sin(t * 7 + ph), 1, 0.25]]];
    case 'work': { // hoeing, digging, scrubbing: both arms down in front, swinging together
      const k = Math.sin(t * 2.2 + ph);
      return [[[0.08, -0.55 + 0.35 * k, 1], [-0.08, -0.6 + 0.35 * k, 1]], [[0.15, -0.9 + 0.3 * k, 0.6], [-0.15, -0.9 + 0.3 * k, 0.6]]];
    }
    case 'carry': return [[[-0.6, 0.55, 0.1], [0.6, 0.55, 0.1]], [[0.3, 1, 0], [-0.3, 1, 0]]];   // a jar or a bundle on the head
    case 'hold': return [[[-0.2, -0.75, 0.6], [0.2, -0.75, 0.6]], [[0.35, -0.05, 1], [-0.35, -0.05, 1]]];   // holding something up in front
    case 'write': { const k = Math.sin(t * 5 + ph) * 0.08; return [[[-0.2, -0.75, 0.55], [0.25, -0.8, 0.5]], [[0.35, -0.2, 1], [-0.25 + k, -0.45, 1]]]; }
    case 'beckon': return [[[-0.18, -1, 0.05], [0.35, -0.4, 0.9]], [null, [0.1, 0.35 + 0.5 * Math.max(0, Math.sin(t * 5 + ph)), 1]]];
    default: return [[[-0.18, -1, 0.05], [0.18, -1, 0.05]]];
  }
}
function poseRig(P, t, dt) {
  const { bones: B, rest } = P.rig, ph = P.phase + t;
  for (const [b, q] of rest) if (b === B.Spine || b === B.Hips || b === B.Neck || b === B.Head) b.quaternion.copy(q);
  // A gentle lean (hauling leans back, working bends forward, gasping rocks back)
  if (B.Spine) B.Spine.rotateX(P.pose === 'pull' ? -0.25 - 0.1 * Math.sin(t * 2.6) : P.pose === 'work' ? 0.3 + 0.08 * Math.sin(t * 2.2 + P.phase) : P.pose === 'gasp' ? -0.12 : Math.sin(ph * 0.7) * 0.02);
  P.inner.updateWorldMatrix(true, false);
  const w = P.stride || 0;
  const [dirs, fores] = armDirs(P.pose, t, P.phase, w);
  ['Left', 'Right'].forEach((side, i) => {
    const up = B[side + 'Arm'], fore = B[side + 'ForeArm'], hand = B[side + 'Hand'];
    if (!up || !fore) return;
    up.quaternion.copy(rest.get(up)); fore.quaternion.copy(rest.get(fore));
    // (a rig's LeftArm is on the figure's own left, +x, the mirror of the stand-in's first arm)
    if (dirs[i]) _arm.set(-dirs[i][0], dirs[i][1], dirs[i][2]).normalize().transformDirection(P.inner.matrixWorld);
    else { up.getWorldPosition(_w0); _arm.subVectors(P.pointAt, _w0).normalize(); }
    if (P.pose === 'cheer') _arm.applyAxisAngle(_w0.set(0, 0, 1).transformDirection(P.inner.matrixWorld), Math.sin(ph * 7 + i) * 0.2 * (i ? 1 : -1));
    aimBone(up, fore, _arm, 1);
    const f = fores?.[i];
    if (f) _fore.set(-f[0], f[1], f[2]).normalize().transformDirection(P.inner.matrixWorld); else _fore.copy(_arm);
    if (hand) aimBone(fore, hand, _fore, 1);
  });
  // Legs: a walking stride (rest otherwise)
  ['Left', 'Right'].forEach((side, i) => {
    const up = B[side + 'UpLeg'], low = B[side + 'Leg'], foot = B[side + 'Foot'];
    if (!up || !low) return;
    up.quaternion.copy(rest.get(up)); low.quaternion.copy(rest.get(low));
    if (P.pose !== 'walk' || !foot) return;
    const s = Math.sin(w + i * Math.PI), lift = Math.max(0, Math.cos(w + i * Math.PI));
    _arm.set(0, -1, 0.42 * s).normalize().transformDirection(P.inner.matrixWorld);
    aimBone(up, low, _arm, 1);
    _fore.set(0, -1, 0.42 * s - 0.55 * lift).normalize().transformDirection(P.inner.matrixWorld);
    aimBone(low, foot, _fore, 1);
  });
  // Head: turn toward whatever they're looking at (P.look), within what a neck can do
  lookHead(P, dt);
  // the "bob" for cheering and walking
  P.inner.position.y = P.pose === 'cheer' ? Math.max(0, Math.sin(ph * 5)) * 0.12 : P.pose === 'walk' ? Math.abs(Math.sin(w)) * 0.035 : 0;
}

// Where a person looks: P.look (a world point), or, if P.glance is on, now and then at you
// when you're close (people glance at the visitor). Turns the neck smoothly.
export const VIEW = { cam: null };
function lookHead(P, dt) {
  const B = P.rig.bones, neck = B.Neck || B.Head;
  if (!neck) return;
  let tgt = P.look;
  if (!tgt && P.glance && VIEW.cam) {
    P.watchT = (P.watchT ?? P.phase * 2) - dt;
    if (P.watchT < 0) P.watchT += 9 + (P.phase % 5);
    VIEW.cam.getWorldPosition(_hp);
    if (P.watchT < 4 && P.g.position.distanceTo(_hp) < 10) tgt = _hp;
  }
  let yaw = 0, pitch = 0;
  if (tgt) {
    neck.getWorldPosition(_w0);
    _d.subVectors(tgt, _w0).transformDirection(_m4.copy(P.inner.matrixWorld).invert());
    yaw = Math.max(-1.1, Math.min(1.1, Math.atan2(_d.x, _d.z)));
    pitch = Math.max(-0.5, Math.min(0.75, Math.atan2(_d.y, Math.hypot(_d.x, _d.z))));
    if (Math.abs(Math.atan2(_d.x, _d.z)) > 2.2) yaw = pitch = 0;   // right behind them: don't twist
  }
  const k = 1 - Math.exp(-dt * 4);
  P.hYaw = (P.hYaw || 0) + (yaw - (P.hYaw || 0)) * k;
  P.hPitch = (P.hPitch || 0) + (pitch - (P.hPitch || 0)) * k;
  if (Math.abs(P.hYaw) + Math.abs(P.hPitch) < 1e-3) return;
  // rotate the neck in the world about the figure's own up and right axes
  P.inner.getWorldQuaternion(_fq);
  _rq.setFromAxisAngle(_ax.set(0, 1, 0), P.hYaw).multiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), -P.hPitch));
  _rq.premultiply(_fq).multiply(_q.copy(_fq).invert());
  neck.getWorldQuaternion(_bq); _bq.premultiply(_rq);
  neck.parent.getWorldQuaternion(_pq).invert();
  neck.quaternion.copy(_bq.premultiply(_pq));
}
const _m4 = new THREE.Matrix4();

// Walk a person toward (x, z) for this frame: turns to face the way they go, strides, and stands
// on the ground (height(x, z), optional). Returns true once they've arrived.
export function walkToward(P, x, z, dt, { speed = 1.1, height = null, stop = 0.15 } = {}) {
  const g = P.g.position, dx = x - g.x, dz = z - g.z, d = Math.hypot(dx, dz);
  if (d < stop) { if (P.pose === 'walk') P.pose = 'idle'; return true; }
  const want = Math.atan2(dx, dz);
  let dy = want - P.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  P.g.rotation.y += dy * Math.min(1, dt * 5);
  const step = Math.min(d, speed * dt * (Math.abs(dy) > 1.2 ? 0.3 : 1));
  g.x += dx / d * step; g.z += dz / d * step;
  if (height) g.y = height(g.x, g.z);
  P.pose = 'walk'; P.stride = (P.stride || 0) + step / (0.62 * (P.H || 1)) * Math.PI;
  if (P.blk) { P.blk.x = g.x; P.blk.z = g.z; }
  return false;
}

// A daily round for a background person: walk from stop to stop and do something at each one.
// P.routine = [{ x, z, pose: 'work', secs: 6, face: yaw (optional), look: Vector3 (optional) }, ...]
// Call every frame. (Chapters can override P.pose afterwards for story moments.)
export function runRoutine(P, dt, opts) {
  const R = P.routine; if (!R?.length) return;
  P.ri ??= 0; P.rt ??= 0;
  const st = R[P.ri % R.length];
  if (P.rt <= 0) {
    if (walkToward(P, st.x, st.z, dt, { speed: st.speed || 1.0, ...opts })) { P.rt = st.secs ?? 4; }
    P.look = null;
    return;
  }
  P.rt -= dt; P.pose = st.pose || 'idle'; P.look = st.look || null;
  if (st.face != null) { let dy = st.face - P.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.g.rotation.y += dy * Math.min(1, dt * 3); }
  if (P.rt <= 0) { P.ri++; P.rt = 0; }
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
    case 'walk': {
      const sw = Math.sin(P.stride || 0);
      P.inner.position.y = Math.abs(sw) * 0.035;
      set(L, 0.4 * sw, -0.08); set(R, -0.4 * sw, 0.08);
      break;
    }
    case 'talk': case 'hold': case 'write': case 'beckon': set(L, -0.9 + 0.15 * Math.sin(ph * 2.1), -0.15); set(R, -1.0 + 0.2 * Math.sin(ph * 2.7), 0.15); break;
    case 'work': { const k = Math.sin(t * 2.2 + P.phase); P.inner.rotation.x = 0.3; set(L, -0.8 + 0.4 * k, 0.1); set(R, -0.8 + 0.4 * k, -0.1); break; }
    case 'gasp': P.inner.rotation.x = -0.1; set(L, -2.4, -0.3); set(R, -2.4, 0.3); break;
    case 'carry': set(L, -0.3, -2.7); set(R, -0.3, 2.7); break;
    case 'wave': set(L, 0, -0.08); set(R, -0.2, 2.4 + Math.sin(t * 7) * 0.4); break;
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

// Put a prop (a bone, a reed, a jar, a torch) in someone's hand. It follows the hand as they move.
// side: 'Right' or 'Left'. Works on Meem's rigged models and on the stand-ins (end of the arm).
// The prop's own +y points out along the fingers; offset nudges it in the hand's space (metres).
export function holdProp(P, obj, side = 'Right', offset = [0, 0.08, 0.03]) {
  P.props ||= {};
  P.props[side] = { obj, side, offset };
  const put = () => {
    const hand = P.rig?.bones[side + 'Hand'];
    if (hand) {
      // bones are scaled with the model: undo that so the prop keeps its real size
      hand.add(obj); hand.updateWorldMatrix(true, false);
      const ws = new THREE.Vector3(); hand.getWorldScale(ws); const gs = new THREE.Vector3(); P.g.getWorldScale(gs);
      obj.scale.setScalar(gs.x / ws.x); obj.position.set(...offset).multiplyScalar(gs.x / ws.x);
    } else {
      const arm = P.arms[side === 'Right' ? 1 : 0]; arm.add(obj); obj.position.set(0, -0.66, 0.03); obj.scale.setScalar(1 / P.H);
      obj.rotation.set(Math.PI, 0, 0);
    }
  };
  put();
  // when Meem's model finishes loading, move the prop over to its hand
  if (!P.rig) { const iv = setInterval(() => { if (P.rig) { clearInterval(iv); put(); } else if (!P.g.parent) clearInterval(iv); }, 300); }
  return obj;
}
export function dropProp(P, side = 'Right') { const p = P.props?.[side]; if (p) { p.obj.parent?.remove(p.obj); delete P.props[side]; } }
