// In-page half of clip-test.js: finds every person (makePerson sets g.userData.person) and checks
// their body against the chapter's solid set geometry. Loaded into the game page as a module;
// window.__clip.check() runs one pass and returns the problems it saw (each one only once).
//
// How a body is tested: points along the bones (rigged Tripo models) or along a stand-in's body,
// each with a radius (how thick that part is). A point is a problem when it is inside a solid
// (nearest surface faces away from it, and rays from it leave the solid through back faces), or
// when a surface comes closer than the part's radius. Hands and feet only count when they are
// more than 3 cm inside something, so a hand resting on a table is fine. Triangles that lie on
// the walkable ground (G.world.height) are left to the separate sinking / floating check.
import * as THREE from '../../lib/three.module.js';

const G = window.G;
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();

// ---------- a plain triangle BVH, in the mesh's own space ----------
function buildBVH(geo) {
  const pos = geo.attributes.position, idx = geo.index;
  const n = idx ? idx.count / 3 | 0 : pos.count / 3 | 0;
  const T = new Float32Array(n * 9), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
  const col = geo.attributes.color, colors = col ? new Uint32Array(n) : null;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 3; j++) {
      const v = idx ? idx.getX(i * 3 + j) : i * 3 + j;
      T[i * 9 + j * 3] = pos.getX(v); T[i * 9 + j * 3 + 1] = pos.getY(v); T[i * 9 + j * 3 + 2] = pos.getZ(v);
      if (j === 0 && colors) colors[i] = (Math.round(col.getX(v) * 255) << 16) | (Math.round(col.getY(v) * 255) << 8) | Math.round(col.getZ(v) * 255);
    }
    const o = i * 9, ax = T[o + 3] - T[o], ay = T[o + 4] - T[o + 1], az = T[o + 5] - T[o + 2], bx = T[o + 6] - T[o], by = T[o + 7] - T[o + 1], bz = T[o + 8] - T[o + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const l = Math.hypot(nx, ny, nz) || 1;
    N[i * 3] = nx / l; N[i * 3 + 1] = ny / l; N[i * 3 + 2] = nz / l;
    C[i * 3] = (T[o] + T[o + 3] + T[o + 6]) / 3; C[i * 3 + 1] = (T[o + 1] + T[o + 4] + T[o + 7]) / 3; C[i * 3 + 2] = (T[o + 2] + T[o + 5] + T[o + 8]) / 3;
  }
  const order = new Uint32Array(n); for (let i = 0; i < n; i++) order[i] = i;
  const nodes = [];
  const box = (s, e) => {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let k = s; k < e; k++) { const o = order[k] * 9; for (let j = 0; j < 9; j++) { const a = j % 3, v = T[o + j]; if (v < b[a]) b[a] = v; if (v > b[a + 3]) b[a + 3] = v; } }
    return b;
  };
  const make = (s, e) => {
    const b = box(s, e), node = { b, s, e, l: null, r: null }; nodes.push(node);
    if (e - s <= 8) return node;
    const ax = [b[3] - b[0], b[4] - b[1], b[5] - b[2]]; const a = ax[0] > ax[1] ? (ax[0] > ax[2] ? 0 : 2) : (ax[1] > ax[2] ? 1 : 2);
    const sub = Array.from(order.subarray(s, e)).sort((p, q) => C[p * 3 + a] - C[q * 3 + a]); order.set(sub, s);
    const m = (s + e) >> 1; node.l = make(s, m); node.r = make(m, e); return node;
  };
  const root = n ? make(0, n) : null;
  return { T, N, colors, order, root, n };
}
const bvhs = new WeakMap();
const bvhOf = (geo) => { let b = bvhs.get(geo); if (!b) { b = buildBVH(geo); bvhs.set(geo, b); } return b; };

// closest point on triangle (Ericson, Real-Time Collision Detection 5.1.5)
function closestOnTri(px, py, pz, T, o, out) {
  const ax = T[o], ay = T[o + 1], az = T[o + 2], bx = T[o + 3], by = T[o + 4], bz = T[o + 5], cx = T[o + 6], cy = T[o + 7], cz = T[o + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return; }
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out[0] = bx; out[1] = by; out[2] = bz; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); out[0] = ax + v * abx; out[1] = ay + v * aby; out[2] = az + v * abz; return; }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out[0] = cx; out[1] = cy; out[2] = cz; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); out[0] = ax + w * acx; out[1] = ay + w * acy; out[2] = az + w * acz; return; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); out[0] = bx + w * (cx - bx); out[1] = by + w * (cy - by); out[2] = bz + w * (cz - bz); return; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  out[0] = ax + abx * v + acx * w; out[1] = ay + aby * v + acy * w; out[2] = az + abz * v + acz * w;
}
const boxD2 = (b, x, y, z) => { const dx = Math.max(b[0] - x, 0, x - b[3]), dy = Math.max(b[1] - y, 0, y - b[4]), dz = Math.max(b[2] - z, 0, z - b[5]); return dx * dx + dy * dy + dz * dz; };
const _c = [0, 0, 0];
// nearest non-ground triangle within sqrt(max2): { d2, tri, x, y, z } or null
function closest(B, skip, x, y, z, max2) {
  let best = null, bd = max2;
  const stack = [B.root];
  while (stack.length) {
    const nd = stack.pop(); if (!nd || boxD2(nd.b, x, y, z) >= bd) continue;
    if (!nd.l) {
      for (let k = nd.s; k < nd.e; k++) {
        const t = B.order[k]; if (skip && skip[t]) continue;
        closestOnTri(x, y, z, B.T, t * 9, _c);
        const d2 = (x - _c[0]) ** 2 + (y - _c[1]) ** 2 + (z - _c[2]) ** 2;
        // ties (a shared edge or corner): keep the face that faces the point most squarely
        if (d2 < bd - 1e-10 || (best && Math.abs(d2 - bd) <= 1e-10 && Math.abs(faceDot(B, t, x, y, z)) > Math.abs(faceDot(B, best.tri, x, y, z)))) { bd = d2; best = { d2, tri: t, x: _c[0], y: _c[1], z: _c[2] }; }
      }
      continue;
    }
    const dl = boxD2(nd.l.b, x, y, z), dr = boxD2(nd.r.b, x, y, z);
    if (dl < dr) { stack.push(nd.r, nd.l); } else { stack.push(nd.l, nd.r); }
  }
  return best;
}
function faceDot(B, t, x, y, z) { const o = t * 9, n = t * 3; return (x - B.T[o]) * B.N[n] + (y - B.T[o + 1]) * B.N[n + 1] + (z - B.T[o + 2]) * B.N[n + 2]; }
// first triangle a ray hits (either side): { t, tri } or null
function raycast(B, skip, ox, oy, oz, dx, dy, dz, maxT) {
  let best = null, bt = maxT;
  const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz, stack = [B.root];
  while (stack.length) {
    const nd = stack.pop(); if (!nd) continue;
    const b = nd.b;
    let t0 = (b[0] - ox) * ix, t1 = (b[3] - ox) * ix; if (t0 > t1) [t0, t1] = [t1, t0];
    let u0 = (b[1] - oy) * iy, u1 = (b[4] - oy) * iy; if (u0 > u1) [u0, u1] = [u1, u0];
    let w0 = (b[2] - oz) * iz, w1 = (b[5] - oz) * iz; if (w0 > w1) [w0, w1] = [w1, w0];
    const tn = Math.max(t0, u0, w0, 0), tf = Math.min(t1, u1, w1, bt);
    if (!(tn <= tf)) continue;
    if (nd.l) { stack.push(nd.l, nd.r); continue; }
    for (let k = nd.s; k < nd.e; k++) {
      const t = B.order[k]; if (skip && skip[t]) continue;
      const o = t * 9, T = B.T;
      const e1x = T[o + 3] - T[o], e1y = T[o + 4] - T[o + 1], e1z = T[o + 5] - T[o + 2], e2x = T[o + 6] - T[o], e2y = T[o + 7] - T[o + 1], e2z = T[o + 8] - T[o + 2];
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det, sx = ox - T[o], sy = oy - T[o + 1], sz = oz - T[o + 2], u = (sx * px + sy * py + sz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (tt > 1e-5 && tt < bt) { bt = tt; best = { t: tt, tri: t }; }
    }
  }
  return best;
}

// ---------- the solid set: meshes of the chapter, not people / effects / see-through things ----------
const isPersonish = (o) => { for (let p = o; p; p = p.parent) if (p.userData?.kind === 'characters' || p.userData?.person || p.userData?.echo) return true; return false; };
const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
function solidMaterial(m) {
  const ms = Array.isArray(m) ? m : [m];
  return ms.some((x) => x && x.visible !== false && x.depthWrite !== false && (!x.transparent || x.opacity > 0.85) && x.blending === THREE.NormalBlending && !x.wireframe && x.colorWrite !== false);
}
// one entry per mesh (per instance for an InstancedMesh)
const entries = new Map();
function entriesFor(root) {
  const list = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isSprite || !o.geometry?.attributes?.position) return;
    if (o.geometry.attributes.position.count < 3 || o.morphTargetInfluences?.length) return;
    if (!solidMaterial(o.material) || !shown(o) || isPersonish(o)) return;
    const count = o.isInstancedMesh ? Math.min(o.count, 4000) : 1;
    for (let i = 0; i < count; i++) {
      const key = o.isInstancedMesh ? o.uuid + ':' + i : o.uuid;
      let e = entries.get(key);
      if (!e) { e = { key, mesh: o, inst: o.isInstancedMesh ? i : -1, mat: new THREE.Matrix4(), inv: new THREE.Matrix4(), sig: '', box: new THREE.Box3(), scale: 1, skip: null, hfn: null }; entries.set(key, e); }
      // world matrix of this mesh (and instance); refresh the inverse, the box and the ground marks when it moves
      _m.copy(o.matrixWorld); if (e.inst >= 0) { const im = new THREE.Matrix4(); o.getMatrixAt(e.inst, im); _m.multiply(im); }
      const sig = _m.elements.map((v) => v.toFixed(4)).join(',');
      if (sig !== e.sig || e.hfn !== G.world.height) {
        e.sig = sig; e.mat.copy(_m); e.inv.copy(_m).invert(); e.hfn = G.world.height;
        _m.decompose(_v, _q, _s); e.scale = (Math.abs(_s.x) + Math.abs(_s.y) + Math.abs(_s.z)) / 3;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        e.box.copy(o.geometry.boundingBox).applyMatrix4(_m);
        e.skip = null; e.groundDone = false;
      }
      if (e.animal === undefined) e.animal = !!animalOf(o, G.director.chapter);
      list.push(e);
    }
  });
  return list;
}
// mark triangles that lie on the walkable ground: those are judged by the sinking check instead
function groundMarks(e) {
  if (e.groundDone) return e.skip;
  e.groundDone = true;
  const B = bvhOf(e.mesh.geometry), skip = new Uint8Array(B.n); let any = false;
  const nm = new THREE.Matrix3().getNormalMatrix(e.mat);
  for (let t = 0; t < B.n; t++) {
    _w.set(B.N[t * 3], B.N[t * 3 + 1], B.N[t * 3 + 2]).applyMatrix3(nm).normalize();
    if (_w.y < 0.8) continue;
    // on the ground if its middle is, or all three corners are (a coarse terrain grid follows the height only at its corners)
    const o = t * 9; _v.set((B.T[o] + B.T[o + 3] + B.T[o + 6]) / 3, (B.T[o + 1] + B.T[o + 4] + B.T[o + 7]) / 3, (B.T[o + 2] + B.T[o + 5] + B.T[o + 8]) / 3).applyMatrix4(e.mat);
    let on = Math.abs(_v.y - G.world.height(_v.x, _v.z)) < 0.04;
    if (!on) { on = true; for (let j = 0; j < 3 && on; j++) { _v.set(B.T[o + j * 3], B.T[o + j * 3 + 1], B.T[o + j * 3 + 2]).applyMatrix4(e.mat); on = Math.abs(_v.y - G.world.height(_v.x, _v.z)) < 0.04; } }
    if (on) { skip[t] = 1; any = true; }
  }
  e.skip = any ? skip : null; return e.skip;
}

// ---------- probing one point against one mesh ----------
const _l = new THREE.Vector3(), _n = new THREE.Vector3();
const DIRS = [[0.12, 0.97, 0.21], [-0.31, -0.92, 0.24], [0.95, 0.13, -0.28], [-0.2, 0.18, -0.96]].map((d) => { const l = Math.hypot(...d); return d.map((x) => x / l); });
// returns { inside, d (metres), tri, cx, cy, cz (world) } or null when nothing is within `reach` metres
function probe(e, p, reach) {
  const B = bvhOf(e.mesh.geometry); if (!B.root) return null;
  const skip = groundMarks(e);
  _l.copy(p).applyMatrix4(e.inv);
  const r = reach / e.scale, c = closest(B, skip, _l.x, _l.y, _l.z, r * r);
  if (!c) return null;
  const dot = faceDot(B, c.tri, _l.x, _l.y, _l.z);
  let inside = false;
  if (dot < 0) {
    // behind the nearest face: check rays leave through back faces (a closed solid), not open planes
    const n = c.tri * 3, dirs = [[-B.N[n], -B.N[n + 1], -B.N[n + 2]], ...DIRS];
    let votes = 0;
    for (const d of dirs) {
      const h = raycast(B, null, _l.x, _l.y, _l.z, d[0] || 1e-9, d[1] || 1e-9, d[2] || 1e-9, 50 / e.scale);
      if (h && d[0] * B.N[h.tri * 3] + d[1] * B.N[h.tri * 3 + 1] + d[2] * B.N[h.tri * 3 + 2] > 0) votes++;
    }
    inside = votes >= dirs.length - 1;
  }
  _w.set(c.x, c.y, c.z).applyMatrix4(e.mat);
  return { inside, d: Math.sqrt(c.d2) * e.scale, tri: c.tri, cx: _w.x, cy: _w.y, cz: _w.z };
}
// how far down from `p` the first upward-facing surface is (any solid, ground included), or null
function surfaceBelow(list, p, maxDown) {
  let best = null;
  for (const e of list) {
    if (e.animal) continue;
    if (e.box.min.y > p.y || e.box.max.y < p.y - maxDown || p.x < e.box.min.x - 0.01 || p.x > e.box.max.x + 0.01 || p.z < e.box.min.z - 0.01 || p.z > e.box.max.z + 0.01) continue;
    const B = bvhOf(e.mesh.geometry); if (!B.root) continue;
    _l.copy(p).applyMatrix4(e.inv); _n.set(0, -1, 0).transformDirection(e.inv);
    const h = raycast(B, null, _l.x, _l.y, _l.z, _n.x || 1e-9, _n.y || 1e-9, _n.z || 1e-9, maxDown / e.scale);
    if (!h) continue;
    _w.copy(_n).multiplyScalar(h.t).add(_l).applyMatrix4(e.mat);
    if (best == null || _w.y > best) best = _w.y;
  }
  return best;
}

// ---------- body points ----------
// [from bone, to bone, radius (m, outside), inside tolerance (m), part]
const RIG = [
  ['Hips', 'Spine', 0.09, 0.005, 'hips'], ['Spine', 'Spine1', 0.09, 0.005, 'torso'], ['Spine1', 'Spine2', 0.09, 0.005, 'torso'], ['Spine2', 'Neck', 0.07, 0.005, 'chest'],
  ['Neck', 'Head', 0.05, 0.005, 'neck'], ['Head', 'HeadTop_End', 0.08, 0.005, 'head'],
  ...['Left', 'Right'].flatMap((s) => [
    ['Hips', s + 'UpLeg', 0.06, 0.005, 'hips'], [s + 'UpLeg', s + 'Leg', 0.06, 0.005, s.toLowerCase() + ' thigh'], [s + 'Leg', s + 'Foot', 0.045, 0.005, s.toLowerCase() + ' shin'],
    [s + 'Foot', s + 'ToeBase', 0, 0.03, s.toLowerCase() + ' foot'],
    [s + 'Arm', s + 'ForeArm', 0.04, 0.005, s.toLowerCase() + ' upper arm'], [s + 'ForeArm', s + 'Hand', 0.02, 0.01, s.toLowerCase() + ' forearm'],
    [s + 'Hand', s + 'HandMiddle1', 0, 0.03, s.toLowerCase() + ' hand'],
  ]),
];
// stand-ins (people.js): in the figure's own space, before its height scale
const STAND = [
  [[-0.09, 0.08, 0], [-0.09, 0.5, 0], 0.05, 0.005, 'right leg'], [[0.09, 0.08, 0], [0.09, 0.5, 0], 0.05, 0.005, 'left leg'],
  [[-0.09, 0.03, 0.03], [-0.09, 0.03, 0.1], 0, 0.03, 'right foot'], [[0.09, 0.03, 0.03], [0.09, 0.03, 0.1], 0, 0.03, 'left foot'],
  [[0, 0.55, 0], [0, 1.4, 0], 0.15, 0.005, 'body'], [[0, 1.5, 0], [0, 1.72, 0], 0.1, 0.005, 'head'], [[0, 1.6, 0], [0, 1.6, 0.1], 0.03, 0.005, 'face'],
];
const STAND_ARM = [[0, -0.05, 0], [0, -0.55, 0], 0.04, 0.01, 'arm'];
function bindInfo(P) {
  if (P._clipBind !== undefined) return P._clipBind;
  let sk = null; P.g.traverse((o) => { if (o.isSkinnedMesh && !sk) sk = o; });
  if (!sk) return (P._clipBind = null);
  sk.geometry.computeBoundingBox();
  const minY = sk.geometry.boundingBox.clone().applyMatrix4(sk.bindMatrix).min.y;
  const at = (name) => { const i = sk.skeleton.bones.findIndex((b) => b.name.replace(/^mixamorig[:_]?/, '') === name); if (i < 0) return null; const m = sk.skeleton.boneInverses[i].clone().invert(); return { y: _v.setFromMatrixPosition(m).y, s: _s.setFromMatrixScale(m).x }; };
  const r = {};
  for (const n of ['Hips', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) { const a = at(n); if (a) r[n] = { up: a.y - minY, s: a.s }; }
  return (P._clipBind = r);
}
function samples(P) {
  const out = [];
  const seg = (a, b, r, tin, part) => {
    const len = a.distanceTo(b), n = Math.max(1, Math.ceil(len / 0.03));
    for (let i = 0; i <= n; i++) out.push({ p: a.clone().lerp(b, i / n), r, tin, part });
  };
  if (P.rig) {
    const B = P.rig.bones, wp = (n) => B[n]?.getWorldPosition(new THREE.Vector3());
    for (const [a, b, r, tin, part] of RIG) {
      let pa = wp(a), pb = wp(b);
      if (!pa) continue;
      if (!pb) { if (b === 'HeadTop_End') pb = pa.clone().add(new THREE.Vector3(0, 0.18 * P.H, 0)); else pb = pa; }
      seg(pa, pb, r * P.H, tin, part);
    }
  } else {
    P.inner.updateWorldMatrix(true, false);
    // the points are written for a 1.75 m figure; inner's scale takes them to this one's height
    for (const [a, b, r, tin, part] of STAND) seg(new THREE.Vector3(...a).applyMatrix4(P.inner.matrixWorld), new THREE.Vector3(...b).applyMatrix4(P.inner.matrixWorld), r * P.H, tin, part);
    P.arms.forEach((arm, i) => { if (!arm.visible) return; arm.updateWorldMatrix(true, false); seg(new THREE.Vector3(...STAND_ARM[0]).applyMatrix4(arm.matrixWorld), new THREE.Vector3(...STAND_ARM[1]).applyMatrix4(arm.matrixWorld), STAND_ARM[2] * P.H, STAND_ARM[3], (i ? 'left ' : 'right ') + STAND_ARM[4]); });
  }
  return out;
}
// lowest point of the feet (soles) and whether the person is standing up
function feet(P) {
  if (P.rig) {
    const B = P.rig.bones, bi = bindInfo(P); if (!bi) return null;
    let sole = Infinity;
    for (const n of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) {
      const b = B[n], k = bi[n]; if (!b || !k) continue;
      b.getWorldPosition(_v); const sc = _s.setFromMatrixScale(b.matrixWorld).x / k.s;
      sole = Math.min(sole, _v.y - k.up * sc);
    }
    let standing = true;
    if (B.Hips && bi.Hips) { B.Hips.getWorldPosition(_w); const sc = _s.setFromMatrixScale(B.Hips.matrixWorld).x / bi.Hips.s; standing = _w.y - sole > 0.75 * bi.Hips.up * sc; }
    return isFinite(sole) ? { sole, standing, x: B.Hips?.getWorldPosition(_w).x ?? P.g.position.x, z: _w.z } : null;
  }
  P.inner.updateWorldMatrix(true, false); _v.setFromMatrixPosition(P.inner.matrixWorld);
  const up = _w.set(0, 1, 0).transformDirection(P.inner.matrixWorld).y;
  return { sole: _v.y, standing: up > 0.9, x: _v.x, z: _v.z };
}

// ---------- naming things for the report ----------
// animals and birds (js/life.js): chapter Life bags hold them; returns e.g. 'dog' for a mesh inside one
function animalOf(o, ch) {
  const lifes = Object.values(ch).filter((v) => v && Array.isArray(v.items) && v.parent?.isObject3D);
  for (let p = o; p && p !== ch.root; p = p.parent) for (const L of lifes) for (const it of L.items) if (it.group === p) return it.kind || 'animal';
  return null;
}
function ownerName(o, ch) {
  const names = [];
  for (let p = o; p && p !== ch.root; p = p.parent) {
    const k = Object.keys(ch).find((k) => ch[k] === p) || (p.name ? `"${p.name}"` : null);
    if (k) names.unshift(k);
  }
  return names.length ? 'chapter.' + names.join(' > ') : 'chapter.root';
}
function meshName(e, ch, tri) {
  const m = e.mesh, B = bvhOf(m.geometry), tris = B.n;
  const own = ownerName(m, ch), col = B.colors ? '#' + B.colors[tri].toString(16).padStart(6, '0') : m.material?.color ? '#' + m.material.color.getHexString() : '';
  const kind = m.geometry.type !== 'BufferGeometry' ? m.geometry.type : tris > 50 ? 'merged Kit mesh' : 'mesh';
  const an = animalOf(m, ch); if (an) return `an animal: ${an} (${own}, js/life.js herd)`;
  return `${own}${m.name ? ` "${m.name}"` : ''}${e.inst >= 0 ? ` instance ${e.inst}` : ''} (${kind}, ${tris} tris${col ? ', colour ' + col : ''})`;
}
const personName = (P) => {
  let echo = false; P.g.traverse((o) => { if (o.userData.echo) echo = true; });   // js/wow/echo.js ghosts
  return (P.who || 'stand-in') + (P.rig ? '' : P.who ? ' (still a stand-in)' : '') + (echo ? ' [echo ghost]' : '');
};
const f2 = (v) => v.toFixed(2);

// ---------- one pass ----------
const seen = new Set(), problems = [];
let line = null;
G.events.on('narrating', (d) => { if (d.on) line = d.id; });
G.events.on('say', (d) => { line = d.id; });
const firstSeen = new WeakMap();
let LINES = {};
import('../../js/script.js').then((m) => { LINES = m.LINES || {}; }).catch(() => {});

// one problem per person and thing hit (or per person for sinking / floating); the body parts
// that went in are collected on it, and `worst` keeps how deep it got
const byKey = new Map();
function report(kind, P, part, where, mesh, extra = '', key2 = mesh, depth = 0) {
  const n = G.director.n, who = personName(P), id = G.narration.cur?.id || line;
  const key = [n, P.g.uuid, kind === 'inside' || kind === 'touching' ? 'clip' : kind, key2 || ''].join('|');
  let p = byKey.get(key);
  if (!p) {
    p = { chapter: n, line: id, text: LINES[id] || '', person: who, pose: P.pose, at: `x ${f2(P.g.position.x)} z ${f2(P.g.position.z)}`, kind, parts: [], where: `${f2(where.x)}, ${f2(where.y)}, ${f2(where.z)}`, mesh: mesh || '', extra, worst: depth };
    byKey.set(key, p); problems.push(p);
  }
  if (!p.parts.includes(part)) p.parts.push(part);
  if (kind === 'inside' && p.kind !== 'inside') { p.kind = 'inside'; p.extra = extra; p.where = `${f2(where.x)}, ${f2(where.y)}, ${f2(where.z)}`; }
  if (depth > p.worst) { p.worst = depth; if (kind === p.kind) p.extra = extra; }
}

function check() {
  const ch = G.director.chapter; if (!ch?.root) return { checked: 0 };
  const people = [];
  G.scene.traverse((o) => { const P = o.userData?.person; if (P && shown(o)) people.push(P); });
  if (!people.length) return { checked: 0 };
  const list = entriesFor(ch.root);
  const now = performance.now();
  let checked = 0;
  for (const P of people) {
    if (!firstSeen.has(P)) firstSeen.set(P, now);
    if (P.who && P.placeholder && now - firstSeen.get(P) < 6000) continue;   // the model is still loading
    if (P.g.parent && !P.g.parent.visible) continue;
    checked++;
    P.g.updateWorldMatrix(true, true);
    const pts = samples(P);
    const pb = new THREE.Box3(); for (const s of pts) pb.expandByPoint(s.p); pb.expandByScalar(0.25);
    const near = list.filter((e) => e.box.intersectsBox(pb));
    // 1. body inside a solid, or a solid poking into the body
    const worst = new Map();   // part|mesh -> worst sample
    for (const s of pts) {
      if (s.p.y < G.world.height(s.p.x, s.p.z) - 0.05) continue;   // under the ground: the sinking check reports it
      for (const e of near) {
        const reach = Math.max(s.r, s.tin) + 0.02;
        if (e.box.distanceToPoint(s.p) > reach) continue;
        const h = probe(e, s.p, 1.0);   // far enough to find the way out of a thick solid
        if (!h) continue;
        const bad = h.inside ? h.d > s.tin : s.r > 0 && h.d < s.r - 0.01;
        if (!bad) continue;
        const pen = h.inside ? h.d + s.r : s.r - h.d;
        const k = s.part + '|' + e.key, w = worst.get(k);
        if (!w || pen > w.pen) worst.set(k, { s, e, h, pen });
      }
    }
    for (const { s, e, h, pen } of worst.values()) report(h.inside ? 'inside' : 'touching', P, s.part, s.p, meshName(e, ch, h.tri), h.inside ? `${s.part} centre ${Math.round(h.d * 100)} cm inside it` : `its surface ${Math.round(pen * 100)} cm into the ${s.part}`, e.key, Math.round(pen * 100));
    // 2. feet: sinking into the ground or floor, or floating above it
    const F = feet(P);
    if (F) {
      const gh = G.world.height(F.x, F.z);
      const surf = surfaceBelow(list, new THREE.Vector3(F.x, F.sole + 0.4, F.z), 3);
      const support = Math.max(gh, surf ?? -Infinity);
      const pt = new THREE.Vector3(F.x, F.sole, F.z);
      const what = surf != null && Math.abs(surf - gh) > 0.01 ? `a surface at y ${f2(surf)} (G.world.height says ${f2(gh)})` : `the ground (y ${f2(gh)})`;
      const lift = F.sole - P.inner.position.y;   // leave out the walking / cheering bob
      if (F.sole < support - 0.05) report('sinking', P, 'feet', pt, what, `soles ${Math.round((support - F.sole) * 100)} cm under it`, '', Math.round((support - F.sole) * 100));
      else if (F.standing && P.pose !== 'cheer' && !(P.sitK > 0.3) && lift > support + 0.05) report('floating', P, 'feet', pt, what, `soles ${Math.round((lift - support) * 100)} cm above it (pose ${P.pose})`, '', Math.round((lift - support) * 100));
    }
  }
  return { checked, problems: problems.length };
}

window.__clip = { check, problems, entriesFor, probe, samples, feet };
