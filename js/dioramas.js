// Little glowing dioramas of each chapter's place, shown at the end of the star-bridge flight
// (js/flight.js): when you reach the next chapter's star, a jewel-box miniature of where it happens
// grows out of the star's light in front of you, turning slowly on a round base, with its name and
// year underneath ("Hven, Denmark, 1590"). Purely something to watch.
//
// Each one is built only when it's needed, with js/kit.js, into ONE mesh (one draw call), about
// 2-15k triangles. Everything is authored on a base of radius 1 (top of the ground at y = 0, nothing
// taller than about 1.35), and flight.js scales it down to about 0.9 m across.
// Windows, fires and lamps glow by themselves: parts marked with `emit` (0..1) skip the lighting.
// Axes inside a diorama: -Z north, +X east, +Y up (like the chapters). You first see it from +Z.
import * as THREE from 'three';
import { Kit } from './kit.js';
import { rng, noise2, roughStone } from './shapes.js';
import { gableRoof, gableWall } from './era2/common.js';

const TAU = Math.PI * 2, PI = Math.PI;
const Y = new THREE.Vector3(0, 1, 0);
const _M = new THREE.Matrix4(), _L = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _V = new THREE.Vector3(), _S = new THREE.Vector3();

// A place to build from: a position, a turn (yaw) and a size, inside a parent. Shapes given to it
// are placed in its own frame, so a house or a person can be built once and set down anywhere.
class At {
  constructor(k, x = 0, y = 0, z = 0, yaw = 0, s = 1, parent = null) {
    this.k = k;
    this.m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, yaw), new THREE.Vector3(s, s, s));
    if (parent) this.m.premultiply(parent.m);
  }
  at(x, y, z, yaw = 0, s = 1) { return new At(this.k, x, y, z, yaw, s, this); }
  add(geo, color, p, r, s, emit = 0) {
    _E.set(r?.[0] || 0, r?.[1] || 0, r?.[2] || 0, r?.[3] || 'XYZ');
    _L.compose(_V.set(...(p || [0, 0, 0])), _Q.setFromEuler(_E), Array.isArray(s) ? _S.set(...s) : _S.setScalar(s ?? 1));
    geo.applyMatrix4(_M.multiplyMatrices(this.m, _L));
    const g = this.k.add(geo, color);
    if (emit) g.userData.emit = emit;
    return g;
  }
  box(w, h, d, c, p, r, s, e) { return this.add(new THREE.BoxGeometry(w, h, d), c, p, r, s, e); }
  cyl(rt, rb, h, seg, c, p, r, s, e) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), c, p, r, s, e); }
  ball(rad, det, c, p, r, s, e) { return this.add(new THREE.IcosahedronGeometry(rad, det), c, p, r, s, e); }
  cone(rad, h, seg, c, p, r, s, e) { return this.add(new THREE.ConeGeometry(rad, h, seg), c, p, r, s, e); }
  torus(R, r, rs, ts, c, p, rot, s, e, arc = TAU) { return this.add(new THREE.TorusGeometry(R, r, rs, ts, arc), c, p, rot, s, e); }
  // a bent rod through points (in this frame)
  tube(pts, rad, c, sides = 4, segs = 0, e = 0) {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), false, 'catmullrom', 0.3);
    return this.add(new THREE.TubeGeometry(curve, segs || Math.max(2, pts.length * 2 - 2), rad, sides, false), c, null, null, null, e);
  }
  // a straight rod from a to b
  rod(a, b, rad, c, sides = 4, e = 0) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
    const g = new THREE.CylinderGeometry(rad, rad, L, sides, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()));
    g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
    return this.add(g, c, null, null, null, e);
  }
  geo(g, c, p, r, s, e) { return this.add(g, c, p, r, s, e); }
}

// A geometry with its own per-triangle colours (the ground), straight into the kit
function pushColored(k, pos, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  k.parts.push(g);
  return g;
}

// The ground: a round, gently shaped disc. h(x, z) gives its height, col(x, z, y) its colour (per
// facet, so fields, paths and water show crisply). The outer edge tucks down into the base.
function terrain(k, h, col, { rings = 18, seg = 72 } = {}) {
  const pos = [], cols = [], c = new THREE.Color();
  const pt = (i, j) => {
    const r = i / rings, a = (j % seg) / seg * TAU, x = r * Math.cos(a), z = r * Math.sin(a);
    return [x, i === rings ? -0.012 : h(x, z), z];
  };
  const tri = (A, B, C) => {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    if (uz * vx - ux * vz < 0) [B, C] = [C, B];   // keep it facing up
    const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3, cz = (A[2] + B[2] + C[2]) / 3;
    c.setHex(col(cx, cz, cy));
    for (const P of [A, B, C]) { pos.push(...P); cols.push(c.r, c.g, c.b); }
  };
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = pt(i, j), b = pt(i + 1, j), cc = pt(i + 1, j + 1), d = pt(i, j + 1);
    tri(a, b, cc);
    if (i > 0) tri(a, cc, d);
  }
  return pushColored(k, pos, cols);
}

// The jewel-box base: dark polished wood, gold bands, a soft felt edge
function plinth(A) {
  A.cyl(1.035, 1.035, 0.03, 56, 0xc9a24a, [0, -0.03, 0], null, null, 0.35);          // gold rim round the top
  A.cyl(1.04, 1.08, 0.12, 56, 0x3a2414, [0, -0.105, 0]);                              // the wooden drum
  A.cyl(1.085, 1.085, 0.022, 56, 0xc9a24a, [0, -0.17, 0], null, null, 0.3);           // gold band
  A.cyl(1.1, 1.14, 0.05, 56, 0x2a180c, [0, -0.205, 0]);                               // foot
}

// roughStone is made for stones metres across (its dents are in metres): build it full size and
// shrink it, u = diorama units per metre
function stone(w, h, d, seed, segs = [1, 1, 1], u = 0.03) { return roughStone(w / u, h / u, d / u, seed, segs).scale(u, u, u); }

// Colour helpers
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
const mix = (a, b, t) => _c1.setHex(a).lerp(_c2.setHex(b), Math.max(0, Math.min(1, t))).getHex();
const vary = (hex, amt, r) => { _c1.setHex(hex); const f = 1 + (r() * 2 - 1) * amt; return _c1.setRGB(Math.min(1, _c1.r * f), Math.min(1, _c1.g * f), Math.min(1, _c1.b * f)).getHex(); };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- Shared little things ----------

// A small person, h tall, facing +z of the frame (yaw turns them). pose: 'stand', 'sit' (on the
// ground, legs forward), 'pull' (leaning back on a rope). robe: a long garment instead of legs.
function person(A, x, y, z, yaw, h, { cloth = 0x6a4a30, skin = 0xc89a74, hair = 0x3a2616, robe = false, pose = 'stand', legs = 0x3a3028, armUp = false, hat = null } = {}) {
  const P = A.at(x, y, z, yaw, h);   // a person 1 unit tall
  const lean = pose === 'pull' ? -0.35 : 0;
  if (pose === 'sit') {
    P.cyl(0.05, 0.055, 0.42, 6, legs, [-0.06, 0.06, 0.2], [PI / 2, 0, 0]);
    P.cyl(0.05, 0.055, 0.42, 6, legs, [0.06, 0.06, 0.2], [PI / 2, 0, 0]);
    P.cyl(0.13, 0.15, 0.38, 7, cloth, [0, 0.27, 0]);
    P.ball(0.085, 1, skin, [0, 0.55, 0.01]);
    P.ball(0.088, 1, hair, [0, 0.575, -0.015], null, [1, 0.75, 1]);
    P.cyl(0.035, 0.035, 0.3, 5, cloth, [-0.15, 0.3, 0.08], [0.9, 0, 0.15]);
    P.cyl(0.035, 0.035, 0.3, 5, cloth, [0.15, 0.3, 0.08], [0.9, 0, -0.15]);
    if (hat) P.cyl(0.07, 0.1, 0.06, 7, hat, [0, 0.64, 0]);
    return;
  }
  if (robe) P.cyl(0.13, 0.2, 0.55, 8, cloth, [0, 0.275, 0]);
  else {
    P.cyl(0.05, 0.045, 0.48, 6, legs, [-0.065, 0.24, 0], [lean * 0.5, 0, 0]);
    P.cyl(0.05, 0.045, 0.48, 6, legs, [0.065, 0.24, 0], [lean * 0.5, 0, 0]);
  }
  const B = P.at(0, 0.47, 0); const lx = (v) => [v[0], v[1], v[2]];
  B.cyl(0.12, 0.14, 0.34, 8, cloth, lx([0, 0.17 * Math.cos(lean), 0.17 * Math.sin(lean)]), [lean, 0, 0]);
  const hy = 0.43 * Math.cos(lean), hz = 0.43 * Math.sin(lean);
  B.ball(0.085, 1, skin, [0, hy, hz]);
  B.ball(0.089, 1, hair, [0, hy + 0.025, hz - 0.015], null, [1, 0.75, 1]);
  if (hat) { B.cyl(0.075, 0.08, 0.08, 8, hat, [0, hy + 0.09, hz]); B.cyl(0.15, 0.15, 0.012, 10, hat, [0, hy + 0.055, hz]); }
  if (pose === 'pull') {
    B.cyl(0.035, 0.035, 0.32, 5, cloth, [-0.1, 0.18, 0.14], [1.4, 0, 0]);
    B.cyl(0.035, 0.035, 0.32, 5, cloth, [0.1, 0.18, 0.14], [1.4, 0, 0]);
  } else {
    B.cyl(0.035, 0.03, 0.32, 5, cloth, [-0.16, 0.15, 0], [0, 0, -0.12]);
    if (armUp) B.cyl(0.03, 0.035, 0.32, 5, cloth, [0.2, 0.44, 0], [0, 0, -0.45]);
    else B.cyl(0.035, 0.03, 0.32, 5, cloth, [0.16, 0.15, 0], [0, 0, 0.12]);
  }
}

// A leafy broadleaf tree with a real trunk, branches and clumps of leaves (and fruit, if asked)
function leafyTree(A, x, y, z, h, seed, { leaf = 0x4f7a2e, trunk = 0x5a4030, fruit = null, nFruit = 0, wide = 1, clumps = 16 } = {}) {
  const r = rng(seed), T = A.at(x, y, z, r() * TAU, h);
  // trunk with a flared foot, then a few main limbs
  T.cyl(0.05, 0.085, 0.12, 7, trunk, [0, 0.06, 0]);
  T.tube([[0, 0.05, 0], [0.015, 0.25, 0.01], [-0.01, 0.42, 0]], 0.045, trunk, 6);
  const tips = [];
  const limbs = 5;
  for (let i = 0; i < limbs; i++) {
    const a = i / limbs * TAU + r() * 0.6, out = (0.22 + r() * 0.12) * wide, up = 0.62 + r() * 0.2;
    const m = [Math.cos(a) * out * 0.5, 0.52 + r() * 0.05, Math.sin(a) * out * 0.5], e = [Math.cos(a) * out, up, Math.sin(a) * out];
    T.tube([[0, 0.38, 0], m, e], 0.022, trunk, 5);
    tips.push(e);
    // a twig off each limb
    const a2 = a + (r() - 0.5) * 1.4, t2 = [m[0] + Math.cos(a2) * 0.12 * wide, m[1] + 0.14, m[2] + Math.sin(a2) * 0.12 * wide];
    T.tube([m, t2], 0.012, trunk, 4); tips.push(t2);
  }
  // leaf clumps round the limb ends and over the crown
  const cl = [];
  for (let i = 0; i < clumps; i++) {
    const tp = tips[i % tips.length], s = 0.11 + r() * 0.08;
    const p = i < tips.length ? tp : [(r() - 0.5) * 0.5 * wide, 0.62 + r() * 0.3, (r() - 0.5) * 0.5 * wide];
    T.ball(s, 1, vary(leaf, 0.16, r), p, [r(), r(), r()], [1.15, 0.85, 1.15]);
    cl.push([p, s]);
  }
  for (let i = 0; i < nFruit; i++) {
    const [p, s] = cl[i % cl.length], a = r() * TAU, b = (r() - 0.3) * 1.2;
    T.ball(0.022, 0, vary(fruit, 0.12, r), [p[0] + Math.cos(a) * Math.cos(b) * s * 1.08, p[1] + Math.sin(b) * s * 0.85, p[2] + Math.sin(a) * Math.cos(b) * s * 1.08]);
  }
}

// An olive: a twisted grey trunk and silvery, airy clumps
function olive(A, x, y, z, h, seed) {
  const r = rng(seed), T = A.at(x, y, z, r() * TAU, h);
  T.tube([[0, 0, 0], [0.04, 0.15, 0.02], [-0.02, 0.3, -0.03], [0.02, 0.42, 0]], 0.05, 0x6a6258, 6);
  T.tube([[0.02, 0.3, 0], [0.2, 0.5, 0.05]], 0.025, 0x6a6258, 4);
  T.tube([[0, 0.32, 0], [-0.18, 0.52, -0.06]], 0.025, 0x6a6258, 4);
  for (let i = 0; i < 7; i++) T.ball(0.12 + r() * 0.06, 1, vary(0x7a8a5a, 0.12, r), [(r() - 0.5) * 0.45, 0.5 + r() * 0.2, (r() - 0.5) * 0.45], [r(), r(), 0], [1.2, 0.7, 1.2]);
}

// A bare winter tree: a trunk that forks and forks again into fine twigs
function bareTree(A, x, y, z, h, seed, { col = 0x4a3a30, snow = false } = {}) {
  const r = rng(seed), T = A.at(x, y, z, r() * TAU, h);
  const grow = (p, dir, len, rad, depth) => {
    const e = [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len];
    const m = [(p[0] + e[0]) / 2 + (r() - 0.5) * len * 0.15, (p[1] + e[1]) / 2, (p[2] + e[2]) / 2 + (r() - 0.5) * len * 0.15];
    T.tube([p, m, e], rad, col, depth > 1 ? 5 : 3, depth > 1 ? 4 : 2);
    if (snow && depth >= 2 && dir[1] < 0.8) T.box(len * 0.5, rad * 0.6, rad * 1.6, 0xf4f8ff, m, [0, Math.atan2(-dir[2], dir[0]), 0]);
    if (depth === 0) return;
    const n = depth >= 3 ? 3 : 2 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, sp = 0.45 + r() * 0.35;
      const d = [dir[0] * 0.6 + Math.cos(a) * sp, dir[1] * 0.75 + 0.25, dir[2] * 0.6 + Math.sin(a) * sp];
      const L = Math.hypot(...d);
      grow(e, d.map((v) => v / L), len * (0.62 + r() * 0.12), rad * 0.62, depth - 1);
    }
  };
  grow([0, 0, 0], [0, 1, 0], 0.36, 0.035, 4);
}

// A conifer: stacked cones, with snow on them if asked
function pine(A, x, y, z, h, seed, snow = false) {
  const r = rng(seed), T = A.at(x, y, z, r() * TAU, h);
  T.cyl(0.025, 0.035, 0.2, 5, 0x4a3426, [0, 0.1, 0]);
  for (let i = 0; i < 4; i++) {
    const w = 0.24 - i * 0.05, y0 = 0.15 + i * 0.19;
    T.cone(w, 0.34, 8, vary(0x2f4a32, 0.12, r), [0, y0 + 0.17, 0], [0, r(), 0]);
    if (snow) T.cone(w * 0.7, 0.16, 8, 0xeef4fc, [0, y0 + 0.28, 0], [0, r(), 0]);
  }
}

// A date palm: a slightly bent ringed trunk and drooping fronds
function palm(A, x, y, z, h, seed) {
  const r = rng(seed), T = A.at(x, y, z, r() * TAU, h);
  const lean = (r() - 0.5) * 0.15;
  T.tube([[0, 0, 0], [lean, 0.45, 0], [lean * 2.5, 0.92, 0.02]], 0.03, 0x7a6040, 5);
  const top = [lean * 2.5, 0.92, 0.02];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + r() * 0.3;
    const m = [top[0] + Math.cos(a) * 0.14, top[1] + 0.06, top[2] + Math.sin(a) * 0.14], e = [top[0] + Math.cos(a) * 0.3, top[1] - 0.08, top[2] + Math.sin(a) * 0.3];
    T.tube([top, m, e], 0.022, vary(0x4f7a32, 0.12, r), 3, 4);
  }
  T.ball(0.035, 0, 0xb07a30, [top[0], top[1] - 0.04, top[2]]);  // dates
}

// A sheep: woolly body, dark face and legs
function sheep(A, x, y, z, yaw, s) {
  const S = A.at(x, y, z, yaw, s);
  S.ball(0.5, 1, 0xf0ece0, [0, 0.55, 0], null, [1, 0.8, 1.35]);
  S.ball(0.2, 1, 0x2a2420, [0, 0.72, 0.68], null, [0.9, 1, 1.2]);
  for (const [lx, lz] of [[-0.25, -0.4], [0.25, -0.4], [-0.25, 0.4], [0.25, 0.4]]) S.cyl(0.06, 0.06, 0.35, 4, 0x2a2420, [lx, 0.17, lz]);
}

// Lit windows (glow) on the face of a building, in its frame: rows x cols across w, starting at y0
function winRow(B, w, y0, rowH, rows, cols, z, { ww = 0.05, wh = 0.08, lit = 0.6, seed = 1, warm = 0xffc070, dark = 0x2a2630, side = 0 } = {}) {
  const r = rng(seed);
  for (let f = 0; f < rows; f++) for (let i = 0; i < cols; i++) {
    const x = -w / 2 + (i + 0.5) * w / cols, on = r() < lit;
    B.box(ww, wh, 0.012, on ? vary(warm, 0.15, r) : dark, side ? [z, y0 + f * rowH, x] : [x, y0 + f * rowH, z], side ? [0, PI / 2, 0] : null, null, on ? 1 : 0);
  }
}

// A stepped brick gable in the x-y plane of B, w wide, h high
function steppedGable(B, w, h, steps, color, z, y0, t = 0.03, pin = 0x8a3020) {
  for (let i = 0; i < steps; i++) {
    const f0 = i / steps, ww = w * (1 - f0) + w * 0.08, sh = h / steps;
    B.box(ww, sh, t, color, [0, y0 + f0 * h + sh / 2, z]);
    for (const sx of [-1, 1]) B.cone(w * 0.03, sh * 0.7, 4, pin, [sx * (ww / 2 - w * 0.025), y0 + f0 * h + sh + sh * 0.35, z], [0, PI / 4, 0]);
    if (i < steps - 1) B.box(Math.min(w * 0.08, ww * 0.12), sh * 0.6, t * 0.4, 0x4a1c12, [0, y0 + f0 * h + sh * 0.5, z + t / 2]);
  }
}

// A gabled house: walls, roof, gable ends, chimney, door, lit windows. In A's frame at x,z, yaw.
function house(A, x, y, z, yaw, w, d, h, { wall = 0xd8c8a8, roof = 0x9a4a30, roofH = null, seed = 1, lit = 0.5, chimney = true, rows = 0 } = {}) {
  const B = A.at(x, y, z, yaw), rh = roofH ?? d * 0.7;
  B.box(w, h + 0.02, d, wall, [0, (h - 0.02) / 2, 0]);
  B.geo(gableRoof(w, d, rh, d * 0.08), roof, [0, h, 0]);
  for (const sx of [-1, 1]) B.geo(gableWall(d, rh, w * 0.02), wall, [sx * (w / 2 - w * 0.01), h, 0], [0, PI / 2, 0]);
  if (chimney) B.box(w * 0.1, rh * 0.8, w * 0.1, 0x7a4a38, [w * 0.28, h + rh * 0.55, -d * 0.12]);
  B.box(w * 0.14, h * 0.45, 0.012, 0x3a2416, [-w * 0.25, h * 0.22, d / 2 + 0.004]);
  const nr = rows || Math.max(1, Math.round(h / (d * 0.7)));
  winRow(B, w, h * 0.3, h * 0.42, Math.min(nr, 2), Math.max(1, Math.round(w / (d * 0.45))), d / 2 + 0.004, { ww: d * 0.12, wh: d * 0.17, seed, lit });
}

// ---------- The dioramas ----------
const BUILD = {};

// Era 1, Chapter 1: an Ice Age camp under a limestone cliff, a winter night
BUILD[1] = (k, A) => {
  const n = noise2(11), r = rng(5);
  const H = (x, z) => 0.03 * n(x * 4 + 3, z * 4) + sstep(-0.2, -0.75, z) * 0.12 * (1 - Math.abs(x) * 0.3);
  terrain(k, H, (x, z, y) => {
    const d = Math.hypot(x - 0.05, z - 0.18);
    if (d < 0.3) return mix(0x6a5a4c, 0xd8dee8, sstep(0.18, 0.3, d));             // trodden earth round the fire
    return vary(mix(0xe4ecf6, 0xcad6e6, n(x * 6, z * 6)), 0.04, r);
  });
  // the cliff: big weathered limestone blocks in an arc behind, with an overhang and snow on top
  for (let i = 0; i < 9; i++) {
    const a = PI * (1.12 + i * 0.095), rr = 0.78 + r() * 0.06, x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const hh = 0.75 + r() * 0.35 - Math.abs(i - 4) * 0.06;
    A.geo(stone(0.3, hh, 0.32, 40 + i, [2, 3, 2], 0.07), vary(i % 2 ? 0xcfc2a2 : 0xbcae8e, 0.06, r), [x, H(x, z) - 0.04, z], [0, -a - PI / 2, 0]);
    // the overhang juts toward the camp
    A.geo(stone(0.3, 0.14, 0.38, 60 + i, [2, 1, 2], 0.07), vary(0xc4b696, 0.06, r), [x * 0.88, hh - 0.1, z * 0.88], [0.08, -a - PI / 2, 0]);
    A.geo(stone(0.28, 0.05, 0.34, 80 + i, [2, 1, 2], 0.07), 0xf2f6fc, [x * 0.9, hh + 0.03, z * 0.9], [0.06, -a - PI / 2, 0]);
  }
  // dark streaks down the cliff face
  for (let i = 0; i < 6; i++) { const a = PI * (1.2 + i * 0.12), x = Math.cos(a) * 0.62, z = Math.sin(a) * 0.62; A.box(0.03, 0.4, 0.01, 0x8a7a60, [x, 0.45, z], [0, -a - PI / 2, 0]); }
  // the fire: a ring of stones, crossed logs, flames and embers
  const F = A.at(0.05, H(0.05, 0.18), 0.18);
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; F.geo(stone(0.05, 0.035, 0.045, 100 + i, [1, 1, 1]), vary(0x8a8478, 0.1, r), [Math.cos(a) * 0.1, -0.005, Math.sin(a) * 0.1], [0, a, 0]); }
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; F.cyl(0.011, 0.013, 0.16, 5, 0x4a3020, [Math.cos(a) * 0.035, 0.04, Math.sin(a) * 0.035], [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]); }
  F.cyl(0.07, 0.075, 0.012, 9, 0xff6a20, [0, 0.008, 0], null, null, 1);
  F.cone(0.05, 0.14, 6, 0xff8a28, [0, 0.08, 0], null, null, 1);
  F.cone(0.03, 0.17, 5, 0xffc050, [0.012, 0.1, 0.008], [0, 0.6, 0.08], null, 1);
  F.cone(0.025, 0.11, 5, 0xffd890, [-0.02, 0.07, -0.01], [0.1, 0, -0.15], null, 1);
  // hide tents with their poles poking out of the top, and a skin drying on a rack
  for (const [x, z, s] of [[-0.48, -0.12, 1], [0.5, -0.2, 0.88]]) {
    const y = H(x, z), T = A.at(x, y, z, Math.atan2(-x, 0.4 - z), s);
    T.cyl(0.012, 0.21, 0.34, 10, 0x9a7450, [0, 0.17, 0]);
    T.cyl(0.0, 0.205, 0.02, 10, 0xe8eef6, [0, 0.33, 0]);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; T.rod([Math.cos(a) * 0.02, 0.32, Math.sin(a) * 0.02], [Math.cos(a) * 0.05, 0.42, Math.sin(a) * 0.05], 0.005, 0x5a4030, 3); }
    T.box(0.09, 0.15, 0.01, 0x2a1a10, [0, 0.07, 0.165], [-0.42, 0, 0]);
    T.box(0.11, 0.16, 0.012, 0x7a5a3a, [0.05, 0.08, 0.17], [-0.42, -0.5, 0]);   // flap folded back
  }
  const R = A.at(-0.3, H(-0.3, 0.42), 0.42, 0.5);
  R.rod([-0.12, 0, 0], [-0.12, 0.2, 0], 0.007, 0x5a4030); R.rod([0.12, 0, 0], [0.12, 0.2, 0], 0.007, 0x5a4030); R.rod([-0.14, 0.2, 0], [0.14, 0.2, 0], 0.006, 0x5a4030);
  R.box(0.2, 0.14, 0.008, 0xb08860, [0, 0.12, 0.004], [0.08, 0, 0]);
  // woodpile and a mammoth tusk by the tent
  for (let i = 0; i < 6; i++) A.cyl(0.012, 0.012, 0.15, 5, vary(0x5a3e28, 0.1, r), [0.32 + (i % 3) * 0.024, H(0.32, 0.3) + 0.012 + Math.floor(i / 3) * 0.022, 0.3], [PI / 2, 0, 0.1]);
  A.tube([[-0.65, H(-0.65, 0.1), 0.1], [-0.6, 0.12, 0.17], [-0.5, 0.18, 0.15]], 0.016, 0xeee6d0, 5);
  // the people: a storyteller standing, three listening round the fire
  const fur = [0x7a5a3c, 0x8a6a48, 0x6a4e34, 0x5e4a38];
  person(A, -0.12, H(-0.12, 0.02), 0.02, 0.6, 0.2, { cloth: fur[0], legs: 0x4a3a2a, armUp: true, hair: 0x2a1c12 });
  person(A, 0.24, H(0.24, 0.12), 0.12, -1.6, 0.18, { cloth: fur[1], pose: 'sit', legs: 0x4a3a2a });
  person(A, 0.12, H(0.12, 0.38), 0.38, PI + 0.3, 0.18, { cloth: fur[2], pose: 'sit', legs: 0x4a3a2a, hair: 0x5a3a20 });
  person(A, -0.14, H(-0.14, 0.32), 0.32, PI - 0.9, 0.15, { cloth: fur[3], pose: 'sit', legs: 0x4a3a2a });
  // snowy pines at the sides
  pine(A, -0.78, H(-0.78, 0.3), 0.3, 0.5, 3, true); pine(A, -0.62, H(-0.62, 0.62), 0.62, 0.36, 4, true);
  pine(A, 0.8, H(0.8, 0.12), 0.12, 0.46, 5, true); pine(A, 0.66, H(0.66, 0.55), 0.55, 0.34, 6, true);
  return { glow: [[0.05, 0.12, 0.18, 0xff9a40, 0.6]] };
};

// Era 1, Chapter 2: Stonehenge, almost finished, the last sarsen on its sledge
BUILD[2] = (k, A) => {
  const n = noise2(7), r = rng(9), ne = -PI / 4;    // the axis opens to the north-east
  const H = (x, z) => 0.012 + 0.012 * n(x * 5, z * 5);
  terrain(k, H, () => vary(mix(0x6a9446, 0x84a656, r()), 0.05, r), { rings: 12, seg: 56 });
  // the round chalk bank and, outside it, the ditch (a darker, lower ring)
  A.torus(0.8, 0.03, 5, 80, 0xd8d4bc, [0, 0.012, 0], [PI / 2, 0, 0], [1, 1, 0.6]);
  A.torus(0.875, 0.028, 5, 80, 0x7a8a58, [0, 0.008, 0], [PI / 2, 0, 0], [1, 1, 0.25]);
  const upright = (w, h, d, x, z, yaw, seed, lean = 0) => A.geo(stone(w, h, d, seed, [1, 1, 1], 0.027), vary(0xb3ac9c, 0.07, r), [x, H(x, z) - 0.008, z], [lean, yaw, 0]);
  // the sarsen circle: 30 uprights and the ring of lintels (one upright and its lintels still missing)
  const RC = 0.44, step = TAU / 30, gap = 18;
  for (let i = 0; i < 30; i++) {
    if (i === gap) continue;
    const a = i * step, x = Math.cos(a) * RC, z = Math.sin(a) * RC;
    upright(0.058, 0.12, 0.034, x, z, -a - PI / 2, 200 + i);
  }
  for (let i = 0; i < 30; i++) {
    if (i === gap || i === gap - 1) continue;
    const a = (i + 0.5) * step, x = Math.cos(a) * RC, z = Math.sin(a) * RC;
    A.geo(stone(0.09, 0.024, 0.036, 300 + i, [1, 1, 1], 0.027), vary(0xa9a292, 0.06, r), [x, 0.119 + H(x, z), z], [0, -a - PI / 2, 0]);
  }
  // the horseshoe of five great trilithons, tallest at the back, opening to the midsummer sunrise
  const tri = [[0, 0.21, 0.22], [0.9, 0.2, 0.18], [-0.9, 0.2, 0.18], [1.75, 0.18, 0.16], [-1.75, 0.18, 0.16]];
  tri.forEach(([da, rad, hh], i) => {
    const a = ne + PI + da, x = Math.cos(a) * rad, z = Math.sin(a) * rad, yaw = -a - PI / 2;
    const T = A.at(x, H(x, z) - 0.008, z, yaw);
    T.geo(stone(0.05, hh, 0.04, 400 + i, [1, 1, 1], 0.027), vary(0xb8b1a1, 0.06, r), [-0.034, 0, 0]);
    T.geo(stone(0.05, hh, 0.04, 410 + i, [1, 1, 1], 0.027), vary(0xb8b1a1, 0.06, r), [0.034, 0, 0]);
    T.geo(stone(0.13, 0.03, 0.042, 420 + i, [1, 1, 1], 0.027), vary(0xa9a292, 0.06, r), [0, hh - 0.004, 0]);
  });
  // bluestones: a ring and a horseshoe of smaller, darker stones
  for (let i = 0; i < 34; i++) { const a = i / 34 * TAU, x = Math.cos(a) * 0.36, z = Math.sin(a) * 0.36; A.box(0.02, 0.05 + r() * 0.012, 0.014, vary(0x6a7078, 0.1, r), [x, H(x, z) + 0.022, z], [r() * 0.08, -a - PI / 2, 0]); }
  for (let i = 0; i < 12; i++) { const a = ne + PI + (i / 11 - 0.5) * 3.6, x = Math.cos(a) * 0.12, z = Math.sin(a) * 0.12; A.box(0.018, 0.065, 0.014, vary(0x6a7078, 0.1, r), [x, H(x, z) + 0.03, z], [0, -a - PI / 2, 0]); }
  A.box(0.1, 0.018, 0.04, 0x7a6a64, [0.02, H(0, 0) + 0.008, 0.03], [0, 0.6, 0]);              // the Altar Stone
  // the Heel Stone outside, on the line of the sunrise, and the Avenue's banks running off
  upright(0.07, 0.15, 0.06, Math.cos(ne) * 0.72, Math.sin(ne) * 0.72, -ne, 500, 0.12);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const d = 0.84 + i * 0.045, px = Math.cos(ne) * d + Math.cos(ne + PI / 2) * s * 0.1, pz = Math.sin(ne) * d + Math.sin(ne + PI / 2) * s * 0.1;
    A.box(0.05, 0.02, 0.025, 0xa4b480, [px, H(px, pz) + 0.006, pz], [0, -ne, 0]);
  }
  // the last sarsen arriving on a wooden sledge over log rollers, hauled by a team on a rope
  const S = A.at(-0.05, H(-0.05, 0.64), 0.64, -0.1);
  S.box(0.08, 0.012, 0.2, 0x7a5a38, [0, 0.025, 0]);
  for (let i = 0; i < 5; i++) S.cyl(0.011, 0.011, 0.12, 6, 0x6a4a2c, [0, 0.011, -0.09 + i * 0.045], [0, 0, PI / 2]);
  S.geo(stone(0.058, 0.12, 0.034, 600, [1, 1, 1], 0.027), vary(0xb3ac9c, 0.06, r), [0, 0.05, 0.02], [-PI / 2, 0, 0]);
  S.tube([[0, 0.03, -0.1], [0.02, 0.035, -0.2], [0.05, 0.04, -0.34]], 0.004, 0xc8a870, 3, 6);
  const cloth = [0x8a6a4a, 0x6a5a3a, 0x9a7a52, 0x7a6046, 0x5e5040, 0xa08060];
  for (let i = 0; i < 6; i++) person(S, (i % 2 ? 0.035 : -0.012) + i * 0.008, 0, -0.14 - i * 0.04, PI, 0.07, { cloth: cloth[i], pose: 'pull', legs: 0x4a3a2a });
  person(A, 0.2, H(0.2, 0.58), 0.58, -0.8, 0.075, { cloth: 0xe0d8c0, robe: true, armUp: true });   // the foreman
  return {};
};

// Era 1, Chapter 3: a priest's flat roof by the Nile, the new pyramids on the desert edge
BUILD[3] = (k, A) => {
  const n = noise2(3), r = rng(13);
  const river = (x, z) => x - 0.58 - 0.06 * Math.sin(z * 3);
  const H = (x, z) => { const rv = river(x, z); if (rv > 0) return 0.002; return 0.012 * n(x * 5, z * 5) + sstep(0.1, -0.6, x) * 0.05 * sstep(0.3, -0.3, z) + 0.008 * sstep(0, -0.05, rv); };
  terrain(k, H, (x, z) => {
    const rv = river(x, z);
    if (rv > 0) return vary(mix(0x3a7090, 0x2e5c7a, n(x * 8, z * 8)), 0.04, r);
    if (rv > -0.04) return 0x6a7a3a;
    if (rv > -0.34) return (Math.floor((z + 2) * 14) % 2) ? vary(0x6a8a34, 0.08, r) : vary(0x8a9a40, 0.08, r);   // strips of fields
    return vary(mix(0xd8bc88, 0xe6cc98, n(x * 6, z * 6)), 0.04, r);
  }, { rings: 22 });
  // the pyramids, cased in white limestone with gilded tops
  for (const [x, z, b, yaw] of [[-0.42, -0.46, 0.42, 0.08], [-0.1, -0.74, 0.28, 0.08], [-0.72, -0.08, 0.14, 0.08]]) {
    const y = H(x, z), h = b * 0.636;
    A.cyl(0, b / Math.SQRT2, h, 4, 0xeee2c4, [x, y + h / 2 - 0.004, z], [0, PI / 4 + yaw, 0]);
    A.cyl(0, b * 0.05, b * 0.032, 4, 0xe8b840, [x, y + h - 0.008, z], [0, PI / 4 + yaw, 0], null, 0.6);
  }
  // mud-brick houses, flat roofs with low walls, palm-log beam ends
  const mud = 0xb08a60, hut = (x, z, w, d, h, yaw, seed) => {
    const B = A.at(x, H(x, z) - 0.01, z, yaw), rr = rng(seed);
    B.box(w, h, d, vary(mud, 0.08, rr), [0, h / 2, 0]);
    B.box(w, 0.012, d, vary(0x9a7650, 0.06, rr), [0, h + 0.004, 0]);
    for (const s of [-1, 1]) { B.box(w, 0.025, 0.012, vary(mud, 0.06, rr), [0, h + 0.012, s * (d / 2 - 0.006)]); B.box(0.012, 0.025, d, vary(mud, 0.06, rr), [s * (w / 2 - 0.006), h + 0.012, 0]); }
    for (let i = 0; i < Math.round(w / 0.035); i++) B.cyl(0.004, 0.004, d + 0.03, 4, 0x6a4a2a, [-w / 2 + 0.02 + i * 0.035, h - 0.012, 0], [PI / 2, 0, 0]);
    B.box(w * 0.18, h * 0.55, 0.006, 0x2a1a10, [w * 0.2, h * 0.27, d / 2 + 0.002]);
    B.box(0.02, 0.014, 0.006, rr() < 0.5 ? 0xffb050 : 0x2a1a10, [-w * 0.25, h * 0.7, d / 2 + 0.002], null, null, 0.8);
    return B;
  };
  // the priest's house, bigger, with stairs up to the roof, his sighting post and a bell
  const P = hut(-0.02, 0.12, 0.36, 0.28, 0.17, -0.1, 1);
  for (let i = 0; i < 7; i++) P.box(0.05, 0.024 * (i + 1), 0.024, 0xa88458, [0.21, 0.012 * (i + 1), 0.13 - i * 0.024]);
  P.cyl(0.004, 0.005, 0.12, 5, 0x6a4a2a, [0.06, 0.24, -0.04]);
  P.box(0.07, 0.006, 0.006, 0x6a4a2a, [0.06, 0.29, -0.04]);
  P.rod([0.09, 0.29, -0.04], [0.09, 0.22, -0.04], 0.0012, 0xd8d0c0, 3);
  P.cone(0.012, 0.018, 7, 0xc89a3a, [0.03, 0.2, 0.06], null, null, 0.3);
  person(P, -0.04, 0.18, 0.0, 0.6, 0.075, { cloth: 0xf2ecdc, robe: true, skin: 0xa06a44, hair: 0x1a1410, armUp: true });
  person(P, -0.1, 0.18, 0.08, 0.2, 0.068, { cloth: 0xe8e0cc, robe: true, skin: 0xa06a44, hair: 0x1a1410 });
  hut(0.3, 0.25, 0.18, 0.16, 0.12, 0.2, 2); hut(-0.38, 0.3, 0.2, 0.18, 0.13, -0.3, 3); hut(0.12, 0.52, 0.22, 0.15, 0.11, 0.05, 4);
  hut(-0.2, 0.6, 0.16, 0.16, 0.1, 0.4, 5); hut(0.28, -0.12, 0.14, 0.14, 0.1, -0.2, 6);
  // beehive granaries
  for (const [x, z] of [[-0.42, 0.06], [-0.48, 0.13], [0.42, 0.06]]) A.ball(0.05, 1, 0xa8845a, [x, H(x, z) + 0.02, z], null, [1, 1.5, 1]);
  // palms along the river and in the village
  for (const [x, z, h] of [[0.5, -0.3, 0.22], [0.47, -0.12, 0.26], [0.52, 0.1, 0.2], [0.46, 0.38, 0.24], [0.4, 0.6, 0.2], [-0.25, 0.38, 0.2], [0.2, 0.05, 0.18]]) palm(A, x, H(x, z), z, h, Math.round(x * 100 + z * 37));
  // a papyrus boat on the river
  const Bt = A.at(0.72, 0.004, 0.0, 0.25);
  Bt.tube([[0, 0.03, -0.16], [0, 0.01, -0.1], [0, 0.008, 0], [0, 0.01, 0.1], [0, 0.035, 0.16]], 0.022, 0xc8b060, 5, 12);
  Bt.cyl(0.003, 0.003, 0.16, 4, 0x6a4a2a, [0, 0.09, 0]); Bt.box(0.004, 0.09, 0.08, 0xf0e8d0, [0, 0.11, 0.01]);
  person(Bt, 0, 0.012, -0.08, 0, 0.06, { cloth: 0xe8e0cc, robe: true, skin: 0xa06a44, hair: 0x1a1410 });
  return { glow: [[-0.25, 0.08, 0.32, 0xffb060, 0.25]] };
};

// Era 1, Chapter 4: the ziggurat of Babylon above the flat-roofed city, the Euphrates behind
BUILD[4] = (k, A) => {
  const n = noise2(4), r = rng(17);
  const river = (x, z) => -z - 0.66 - 0.05 * Math.sin(x * 4);
  const H = (x, z) => (river(x, z) > 0 ? 0.002 : 0.008 * n(x * 6, z * 6) + 0.006);
  terrain(k, H, (x, z) => {
    const rv = river(x, z);
    if (rv > 0) return vary(0x3a6a88, 0.05, r);
    if (rv > -0.05) return 0x5a7a3a;
    return vary(0xa88a62, 0.05, r);
  }, { rings: 20 });
  // the ziggurat: four stepped terraces with buttress ribs, a triple stair, the blue shrine on top
  const Z = A.at(0, 0.006, -0.06);
  const tiers = [[0.6, 0.15, 0x9a7650], [0.44, 0.13, 0xa47e56], [0.31, 0.11, 0xae885c], [0.2, 0.09, 0xb89262]];
  let y = 0;
  tiers.forEach(([w, h, c], ti) => {
    Z.box(w, h, w, c, [0, y + h / 2, 0]);
    Z.box(w + 0.012, 0.01, w + 0.012, mix(c, 0x000000, 0.2), [0, y + h - 0.005, 0]);
    const nb = Math.round(w / 0.05);
    for (let f = 0; f < 4; f++) { const F = Z.at(0, y, 0, f * PI / 2); for (let i = 0; i <= nb; i++) { const bx = -w / 2 + i * w / nb; if (ti < 2 && f === 0 && Math.abs(bx) < 0.05) continue; F.box(0.014, h - 0.012, 0.008, mix(c, 0xffffff, 0.12), [bx, h / 2 - 0.004, w / 2 + 0.003]); } }
    y += h;
  });
  // the main stair straight up the front to the second terrace, and two side stairs that meet it
  for (let i = 0; i < 16; i++) Z.box(0.07, 0.0175, 0.022, 0xc8a070, [0, i * 0.0175 + 0.009, 0.52 - i * 0.022]);
  Z.box(0.07, 0.03, 0.44, 0x8a6a48, [0, 0.125, 0.36], [0.69, 0, 0]);
  for (const s of [-1, 1]) for (let i = 0; i < 8; i++) Z.box(0.05, 0.018, 0.024, 0xc8a070, [s * (0.28 - i * 0.022), i * 0.018 + 0.009, 0.33], [0, 0, 0]);
  Z.box(0.1, 0.08, 0.06, 0x8a6a48, [0, 0.32, 0.17]);   // the gatehouse at the top of the stairs
  Z.box(0.03, 0.05, 0.004, 0x1a120a, [0, 0.305, 0.201]);
  // the shrine: blue glazed brick, gold trim and horns, a lamp in the door
  Z.box(0.13, 0.09, 0.11, 0x2a5aa8, [0, y + 0.045, 0]);
  Z.box(0.14, 0.012, 0.12, 0xd8a838, [0, y + 0.095, 0], null, null, 0.4);
  Z.box(0.03, 0.045, 0.004, 0xffb050, [0, y + 0.025, 0.056], null, null, 1);
  for (const s of [-1, 1]) Z.cone(0.008, 0.035, 5, 0xd8a838, [s * 0.055, y + 0.118, 0.05], [0, 0, -s * 0.3], null, 0.4);
  // the city: flat roofs in streets, lamps in some doorways, a temple wall round the tower
  for (let gx = -8; gx <= 8; gx++) for (let gz = -6; gz <= 8; gz++) {
    const x = gx * 0.105 + (r() - 0.5) * 0.02, z = gz * 0.105 + (r() - 0.5) * 0.02;
    if (Math.hypot(x, z) > 0.92 || Math.abs(x) < 0.44 && z > -0.5 && z < 0.62 || river(x, z) > -0.08 || (gx % 4 === 0) || r() < 0.12) continue;
    const w = 0.07 + r() * 0.025, d = 0.07 + r() * 0.025, h = 0.035 + r() * 0.04, c = vary(0xb89468, 0.1, r);
    A.box(w, h, d, c, [x, H(x, z) + h / 2 - 0.004, z]);
    A.box(w, 0.008, d * 0.25, mix(c, 0x000000, 0.25), [x, H(x, z) + h + 0.003, z - d * 0.375]);
    A.box(0.014, 0.022, 0.004, r() < 0.35 ? 0xffa848 : 0x2a1a10, [x, H(x, z) + 0.011, z + d / 2 + 0.002], null, null, 1);
  }
  for (const [w, d, x, z, yaw] of [[0.9, 0.012, 0, -0.5, 0], [0.9, 0.012, 0, 0.62, 0], [0.012, 1.12, -0.45, 0.06, 0], [0.012, 1.12, 0.45, 0.06, 0]]) A.box(w, 0.05, d, 0xa07e56, [x, 0.025, z], [0, yaw, 0]);
  // the blue Ishtar Gate in the front of the city wall, with its gold beasts
  const G = A.at(-0.56, 0.004, 0.6, 0.45);
  for (const s of [-1, 1]) {
    G.box(0.09, 0.2, 0.1, 0x2a58a0, [s * 0.075, 0.1, 0]);
    for (let i = 0; i < 4; i++) G.box(0.018, 0.022, 0.1, 0x2a58a0, [s * 0.075 - 0.036 + i * 0.024, 0.211, 0]);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 2; i++) G.box(0.025, 0.012, 0.004, 0xe8c050, [s * 0.075 + (i - 0.5) * 0.04, 0.05 + row * 0.05, 0.052], null, null, 0.5);
  }
  G.box(0.06, 0.06, 0.1, 0x2a58a0, [0, 0.14, 0]); G.box(0.06, 0.1, 0.012, 0x120c08, [0, 0.05, 0.046]);
  for (const s of [-1, 1]) G.box(0.14, 0.11, 0.05, 0x9a7650, [s * 0.19, 0.055, -0.01]);
  // palms along the river
  for (let i = 0; i < 9; i++) { const x = -0.7 + i * 0.17, z = -0.6 + 0.05 * Math.sin(x * 4) + (r() - 0.5) * 0.04; if (Math.hypot(x, z) < 0.93) palm(A, x, H(x, z), z, 0.15 + r() * 0.05, 30 + i); }
  return { glow: [[0, 0.62, -0.01, 0xffb060, 0.3]] };
};

// Era 1, Chapter 5: Athens, the Parthenon on the Acropolis, olive groves, the sea
BUILD[5] = (k, A) => {
  const n = noise2(21), r = rng(23);
  const sea = (x, z) => x * 0.55 + z * 0.85 - 0.72;
  const rock = (x, z) => { const ex = (x - 0.02) / 0.6, ez = (z + 0.14) / 0.36; return Math.hypot(ex, ez); };
  const H = (x, z) => {
    if (sea(x, z) > 0) return 0.001;
    const e = rock(x, z), top = 0.24;
    return top * (1 - sstep(0.88, 1.08, e)) + 0.05 * (1 - sstep(1.0, 1.7, e)) + 0.015 * n(x * 6, z * 6);
  };
  terrain(k, H, (x, z, y) => {
    if (sea(x, z) > 0) return vary(mix(0x3a80a8, 0x2c6890, n(x * 8, z * 8)), 0.04, r);
    const e = rock(x, z);
    if (e < 0.9) return vary(0xd4c8aa, 0.04, r);           // the paved top
    if (e < 1.1) return vary(0xa89878, 0.08, r);           // the cliffs
    return vary(mix(0x8a8a4c, 0x9a9458, n(x * 5, z * 5)), 0.06, r);
  }, { rings: 16, seg: 56 });
  const top = 0.24, marble = 0xece6d6;
  // the Parthenon: three steps, 8 x 17 columns, the inner temple, entablature, pediments, roof
  const P = A.at(0.12, top - 0.006, -0.2, 0.1), L = 0.5, W = 0.22, ch = 0.085;
  for (let i = 0; i < 3; i++) P.box(L + 0.04 - i * 0.014, 0.01, W + 0.04 - i * 0.014, mix(marble, 0x9a9080, 0.1 * (2 - i)), [0, 0.005 + i * 0.01, 0]);
  const y0 = 0.03;
  for (let i = 0; i < 17; i++) for (let j = 0; j < 8; j++) {
    if (i > 0 && i < 16 && j > 0 && j < 7) continue;
    const x = -L / 2 + 0.015 + i * (L - 0.03) / 16, z = -W / 2 + 0.015 + j * (W - 0.03) / 7;
    P.cyl(0.0075, 0.0095, ch, 8, marble, [x, y0 + ch / 2, z]);
    P.box(0.022, 0.006, 0.022, marble, [x, y0 + ch + 0.003, z]);
  }
  P.box(L - 0.09, ch - 0.004, W - 0.08, mix(marble, 0xb8a888, 0.35), [0, y0 + ch / 2, 0]);    // the cella walls behind
  P.box(0.03, 0.05, 0.004, 0xffc070, [L / 2 - 0.045, y0 + 0.025, 0], [0, PI / 2, 0], null, 0.8);   // lamplit door
  P.box(L, 0.014, W, marble, [0, y0 + ch + 0.013, 0]);                                     // architrave
  P.box(L + 0.004, 0.012, W + 0.004, 0xd8ceb8, [0, y0 + ch + 0.026, 0]);                   // frieze
  for (let i = 0; i < 34; i++) P.box(0.004, 0.011, W + 0.008, 0x7a8aa0, [-L / 2 + 0.008 + i * (L - 0.016) / 33, y0 + ch + 0.026, 0]);  // painted triglyphs
  const ry = y0 + ch + 0.032;
  P.geo(gableRoof(L, W, 0.04, 0.008), 0xc8a07a, [0, ry, 0], [0, 0, 0]);
  for (const s of [-1, 1]) { P.geo(gableWall(W, 0.04, 0.006), marble, [s * (L / 2 - 0.003), ry, 0], [0, PI / 2, 0]); P.box(0.006, 0.02, 0.05, 0x9aa8c0, [s * (L / 2 + 0.001), ry + 0.012, 0]); }
  // the Erechtheion with its porch of maidens, and the gateway (Propylaea) at the west end
  const E = A.at(-0.14, top - 0.006, -0.32, 0.1);
  E.box(0.16, 0.07, 0.08, marble, [0, 0.035, 0]); E.geo(gableRoof(0.16, 0.08, 0.025, 0.005), 0xc8a07a, [0, 0.07, 0]);
  for (let i = 0; i < 6; i++) E.cyl(0.006, 0.006, 0.07, 6, marble, [0.1, 0.035, -0.03 + i * 0.012]);
  for (let i = 0; i < 4; i++) E.cyl(0.007, 0.007, 0.045, 6, 0xf4eee0, [-0.04 + i * 0.025, 0.022, 0.055]);
  E.box(0.09, 0.008, 0.03, marble, [-0.005, 0.048, 0.055]);
  const Pr = A.at(-0.5, top - 0.03, -0.08, PI / 2 + 0.1);
  Pr.box(0.2, 0.012, 0.1, marble, [0, 0.025, 0]);
  for (let i = 0; i < 6; i++) Pr.cyl(0.0075, 0.009, 0.07, 8, marble, [-0.07 + i * 0.028, 0.065, 0.04]);
  Pr.box(0.2, 0.016, 0.1, marble, [0, 0.108, 0]); Pr.geo(gableRoof(0.2, 0.1, 0.025, 0.004), 0xc8a07a, [0, 0.116, 0]);
  for (let i = 0; i < 8; i++) Pr.box(0.12, 0.012, 0.02, mix(marble, 0x9a9080, 0.2), [0, 0.02 - i * 0.012, 0.06 + i * 0.022]);
  // Athena's bronze statue with her gleaming spear
  A.cyl(0.012, 0.016, 0.02, 6, marble, [-0.24, top + 0.01, -0.1]);
  person(A, -0.24, top + 0.02, -0.1, 0.5, 0.12, { cloth: 0x9a7a3a, robe: true, skin: 0x9a7a3a, hair: 0x7a5a2a, armUp: true });
  A.rod([-0.215, top + 0.06, -0.1], [-0.215, top + 0.2, -0.1], 0.0025, 0xffd870, 3, 0.6);
  // olive groves on the slopes, the white town below with its tiled roofs, a ship on the sea
  const olives = [[-0.66, 0.3], [-0.5, 0.44], [-0.72, -0.1], [-0.36, 0.52], [0.66, -0.2], [0.55, -0.48], [-0.25, -0.75], [0.15, -0.78], [0.42, -0.7], [-0.6, -0.5], [-0.14, 0.62], [0.72, 0.0]];
  olives.forEach(([x, z], i) => { if (sea(x, z) < -0.05) olive(A, x, H(x, z), z, 0.13 + r() * 0.04, 50 + i); });
  for (let i = 0; i < 14; i++) {
    const x = -0.3 + (i % 5) * 0.12 + (r() - 0.5) * 0.04, z = 0.32 + Math.floor(i / 5) * 0.12 + (r() - 0.5) * 0.03;
    if (sea(x, z) > -0.06 || Math.hypot(x, z) > 0.9) continue;
    const yaw = r() * 0.5, B = A.at(x, H(x, z) - 0.006, z, yaw);
    B.box(0.07, 0.045, 0.055, vary(0xf0e8d8, 0.04, r), [0, 0.022, 0]); B.geo(gableRoof(0.07, 0.055, 0.02, 0.004), vary(0xb86a48, 0.08, r), [0, 0.045, 0]);
    B.box(0.012, 0.022, 0.003, r() < 0.4 ? 0xffb050 : 0x3a2a1a, [0.015, 0.011, 0.029], null, null, 1);
  }
  const S = A.at(0.6, 0.002, 0.5, -0.9);
  S.tube([[0, 0.02, -0.12], [0, 0.008, -0.05], [0, 0.006, 0.05], [0, 0.03, 0.13]], 0.022, 0x5a3a24, 5, 10);
  S.rod([0, 0.01, 0], [0, 0.17, 0], 0.003, 0x4a3020); S.box(0.004, 0.09, 0.1, 0xf0e6cc, [0, 0.11, 0.004]);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) S.rod([s * 0.02, 0.015, -0.06 + i * 0.024], [s * 0.06, -0.005, -0.06 + i * 0.024], 0.0015, 0x6a4a2a, 3);
  return {};
};

// Era 1, Chapter 6: the sponge divers' boat off Antikythera, 1901, and the bronze gears they found
BUILD[6] = (k, A) => {
  const n = noise2(5), r = rng(19);
  const isl = (x, z) => 1 - Math.hypot((x + 0.25) / 0.55, (z + 0.72) / 0.36) + 0.15 * (n(x * 4, z * 4) - 0.5);
  const H = (x, z) => { const i = isl(x, z); return i > 0 ? 0.004 + 0.42 * sstep(0, 0.6, i) * (0.7 + 0.3 * n(x * 7, z * 7)) : 0.004 + 0.006 * n(x * 12, z * 12); };
  terrain(k, H, (x, z, y) => {
    const i = isl(x, z);
    if (i <= 0) return vary(mix(0x2a6a92, 0x3a86a8, n(x * 9, z * 9)), 0.05, r);
    if (y < 0.03) return 0xe8dcb8;
    if (y > 0.12 && n(x * 20, z * 20) > 0.55) return vary(0x5e6a3a, 0.1, r);   // scrub
    return vary(mix(0x9a8a70, 0xb8a888, n(x * 10, z * 10)), 0.06, r);
  }, { rings: 24 });
  // a white chapel on the island
  const C = A.at(-0.12, H(-0.12, -0.55) - 0.01, -0.55, 0.3);
  C.box(0.07, 0.05, 0.05, 0xf4f0e8, [0, 0.025, 0]); C.cyl(0.0, 0.03, 0.025, 8, 0x3a6ab0, [0.0, 0.0625, 0]); C.cyl(0.022, 0.022, 0.012, 8, 0xf4f0e8, [0, 0.055, 0]);
  // the caique: a curved wooden hull, white with a blue band, deck, mast and lateen sail
  const B = A.at(0.1, 0.004, 0.16, -0.25), LEN = 0.7;
  const hull = new THREE.LatheGeometry([[0, -0.05], [0.07, -0.04], [0.1, -0.01], [0.105, 0.04]].map(([a, b]) => new THREE.Vector2(a, b)), 14);
  B.geo(hull, 0xf0ece2, [0, 0.03, 0], null, [1, 1, LEN / 0.21]);
  B.geo(new THREE.CylinderGeometry(0.111, 0.111, 0.014, 14, 1, true), 0x2a5a9a, [0, 0.065, 0], null, [1, 1, LEN / 0.21]);
  B.geo(new THREE.CylinderGeometry(0.098, 0.098, 0.004, 14), 0x9a7048, [0, 0.07, 0], null, [1, 1, LEN / 0.21]);
  B.tube([[0, 0.07, LEN / 2 - 0.03], [0, 0.11, LEN / 2 + 0.02], [0, 0.14, LEN / 2 + 0.03]], 0.008, 0x8a5a34, 4);   // stem post
  B.rod([0, 0.07, 0.08], [0, 0.48, 0.06], 0.006, 0x6a4a2a, 5);
  B.rod([0, 0.47, 0.32], [0, 0.18, -0.24], 0.0035, 0x6a4a2a, 4);
  const sail = new THREE.BufferGeometry(); sail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.465, 0.3, 0, 0.19, -0.22, 0, 0.11, 0.08, 0, 0.465, 0.3, 0, 0.11, 0.08, 0, 0.19, -0.22], 3)); sail.computeVertexNormals();
  B.geo(sail, 0xf0e2c0, [0.004, 0, 0]);
  // the air pump (a big wheel two men turn) and the diver on the ladder in his brass helmet
  const Pm = B.at(0.0, 0.072, -0.12);
  Pm.box(0.05, 0.04, 0.05, 0x6a4a2a, [0, 0.02, 0]);
  Pm.torus(0.035, 0.004, 4, 16, 0xa08040, [0.03, 0.05, 0], [0, PI / 2, 0], null, 0.2);
  person(Pm, 0.07, 0, 0.04, -PI / 2, 0.08, { cloth: 0xe8e4d8, legs: 0x3a4a6a });
  person(Pm, -0.07, 0, -0.03, PI / 2, 0.08, { cloth: 0x6a7a8a, legs: 0x3a3a3a, hat: 0x2a2a2a });
  person(B, 0.03, 0.072, -0.26, 0.4, 0.08, { cloth: 0x5a6a5a, legs: 0x3a3a3a, hat: 0x1a1a1a, armUp: true });   // the captain
  const L = B.at(0.105, 0.0, 0.05);
  L.rod([0, 0.075, -0.02], [0.03, -0.02, -0.02], 0.002, 0x6a4a2a, 3); L.rod([0, 0.075, 0.02], [0.03, -0.02, 0.02], 0.002, 0x6a4a2a, 3);
  for (let i = 0; i < 4; i++) L.rod([0.006 * i, 0.06 - i * 0.022, -0.02], [0.006 * i, 0.06 - i * 0.022, 0.02], 0.0015, 0x6a4a2a, 3);
  L.cyl(0.018, 0.02, 0.06, 7, 0xc8c0a8, [0.03, 0.012, 0]);
  L.ball(0.022, 1, 0xd8a040, [0.032, 0.058, 0], null, null, 0.25);
  L.cyl(0.008, 0.008, 0.004, 8, 0x2a3a4a, [0.054, 0.06, 0], [0, 0, PI / 2]);
  L.tube([[0.02, 0.07, 0], [0.0, 0.11, -0.05], [-0.06, 0.09, -0.14]], 0.0025, 0x3a3a2a, 3, 8);
  // amphorae and sponges brought up, piled on deck
  for (let i = 0; i < 4; i++) { const am = B.at(-0.05 + (i % 2) * 0.03, 0.074, 0.16 + Math.floor(i / 2) * 0.05, 0); am.ball(0.016, 1, 0xb8784a, [0, 0.008, 0], [PI / 2 - 0.2, 0, 0], [1, 1.7, 1]); }
  for (let i = 0; i < 6; i++) B.ball(0.012, 0, 0xc8a050, [-0.05 + r() * 0.03, 0.08, -0.04 + r() * 0.05]);
  // the treasure: a green-bronze gear wheel and its smaller partner, on a rock by the shore
  const R0 = A.at(-0.55, 0.004, 0.42, 0.7);
  R0.geo(stone(0.22, 0.08, 0.16, 7, [2, 1, 2]), 0x8a7a64, [0, -0.01, 0]);
  const Gr = R0.at(0.0, 0.2, 0.0);
  const gear = (G, rad, teeth, z, c) => {
    G.cyl(rad, rad, 0.012, 32, c, [0, 0, z], [PI / 2, 0, 0], null, 0.25);
    for (let i = 0; i < teeth; i++) { const a = i / teeth * TAU; G.box(0.012, rad * 0.12, 0.012, c, [Math.cos(a) * (rad + rad * 0.05), Math.sin(a) * (rad + rad * 0.05), z], [0, 0, a - PI / 2], null, 0.25); }
    G.cyl(rad * 0.15, rad * 0.15, 0.02, 10, 0xc89a50, [0, 0, z], [PI / 2, 0, 0], null, 0.4);
    for (let i = 0; i < 4; i++) G.box(rad * 1.7, 0.012, 0.016, mix(c, 0xd8b060, 0.4), [0, 0, z + 0.004], [0, 0, i * PI / 4 + PI / 8], null, 0.3);
  };
  gear(Gr, 0.13, 36, 0, 0x4a8a6a);
  const g2 = Gr.at(0.16, -0.08, 0.0); gear(g2, 0.055, 16, 0.002, 0x5a9a72);
  Gr.rod([0, -0.13, 0], [0, -0.22, 0], 0.01, 0x3a6a54, 6);
  return { glow: [[-0.55, 0.22, 0.42, 0x6ad0a0, 0.25]] };
};

// Era 1, Chapter 7: Alexandria, about 150 AD: the lighthouse on its island, the library on the shore
BUILD[7] = (k, A) => {
  const n = noise2(8), r = rng(29);
  const shore = (x, z) => z - (-0.12 + 0.06 * Math.sin(x * 5));
  const isl = (x, z) => 1 - Math.hypot((x - 0.38) / 0.28, (z + 0.6) / 0.2);
  const cause = (x, z) => Math.abs(x - (0.25 - (z + 0.12) * 0.25)) < 0.035 && z < -0.08 && z > -0.5;
  const land = (x, z) => shore(x, z) > 0 || isl(x, z) > 0 || cause(x, z);
  const H = (x, z) => (land(x, z) ? 0.022 + 0.006 * n(x * 9, z * 9) : 0.002 + 0.004 * n(x * 12, z * 12));
  terrain(k, H, (x, z, y) => {
    if (!land(x, z)) return vary(mix(0x2e7aa0, 0x3a90b0, n(x * 9, z * 9)), 0.05, r);
    if (isl(x, z) > 0 && isl(x, z) < 0.25) return vary(0xa89878, 0.06, r);
    if (shore(x, z) > 0 && shore(x, z) < 0.04) return 0xe6d6a8;
    return vary(0xd8c8a0, 0.05, r);
  }, { rings: 24 });
  // the Pharos: a square tower, an octagon, a round lantern with its fire, a statue on top
  const P = A.at(0.38, 0.02, -0.6, 0.2), stone = 0xece4d0;
  P.box(0.3, 0.05, 0.22, 0xd8ccb0, [0, 0.02, 0]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.cyl(0.02, 0.022, 0.07, 8, 0xd8ccb0, [sx * 0.15, 0.035, sz * 0.11]);
  P.cyl(0.085, 0.11, 0.5, 4, stone, [0, 0.3, 0], [0, PI / 4, 0]);
  for (let i = 0; i < 5; i++) for (let f = 0; f < 4; f++) { const a = f * PI / 2, y = 0.12 + i * 0.08, rr = (0.11 - 0.025 * (y - 0.05) / 0.5) * Math.SQRT1_2 + 0.002; P.box(0.012, 0.03, 0.004, 0x2a2a30, [Math.sin(a) * rr, y, Math.cos(a) * rr], [0, a, 0]); }
  P.box(0.15, 0.015, 0.15, 0xd8ccb0, [0, 0.555, 0]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.cyl(0.006, 0.008, 0.03, 5, 0xb89a48, [sx * 0.065, 0.575, sz * 0.065], null, null, 0.2);
  P.cyl(0.05, 0.058, 0.24, 8, stone, [0, 0.68, 0]);
  P.cyl(0.062, 0.062, 0.012, 8, 0xd8ccb0, [0, 0.8, 0]);
  P.cyl(0.035, 0.04, 0.09, 10, stone, [0, 0.85, 0]);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; P.cyl(0.004, 0.004, 0.06, 4, stone, [Math.cos(a) * 0.04, 0.92, Math.sin(a) * 0.04]); }
  P.ball(0.03, 1, 0xffa040, [0, 0.925, 0], null, [1, 1.2, 1], 1);
  P.cyl(0.045, 0.045, 0.01, 10, stone, [0, 0.955, 0]); P.cone(0.04, 0.04, 10, stone, [0, 0.98, 0]);
  person(P, 0, 1.0, 0, 0.3, 0.09, { cloth: 0xc8a050, robe: true, skin: 0xc8a050, hair: 0xb89040, armUp: true });
  // the library: a great hall behind a colonnade, steps, pediment, and Ptolemy's brass sky model in the court
  const Lb = A.at(-0.32, 0.018, 0.28, 0.25);
  for (let i = 0; i < 3; i++) Lb.box(0.5 - i * 0.02, 0.012, 0.3 - i * 0.02, 0xe0d6bc, [0, 0.006 + i * 0.012, 0]);
  Lb.box(0.4, 0.12, 0.2, 0xe8dcc0, [0, 0.096, -0.02]);
  for (let i = 0; i < 10; i++) { Lb.cyl(0.008, 0.01, 0.12, 8, 0xf4ecd8, [-0.21 + i * 0.0467, 0.096, 0.12]); }
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) Lb.cyl(0.008, 0.01, 0.12, 8, 0xf4ecd8, [s * 0.21, 0.096, 0.08 - i * 0.05]);
  Lb.box(0.46, 0.022, 0.27, 0xf4ecd8, [0, 0.167, 0]);
  Lb.geo(gableRoof(0.46, 0.27, 0.06, 0.006), 0xb87a50, [0, 0.178, 0]);
  Lb.geo(gableWall(0.27, 0.06, 0.006), 0xf0e6d0, [0.228, 0.178, 0], [0, PI / 2, 0]); Lb.geo(gableWall(0.27, 0.06, 0.006), 0xf0e6d0, [-0.228, 0.178, 0], [0, PI / 2, 0]);
  for (let i = 0; i < 5; i++) Lb.box(0.025, 0.05, 0.004, 0xffc070, [-0.12 + i * 0.06, 0.07, 0.082], null, null, 1);
  // the armillary sphere in front, gleaming brass rings
  const S = A.at(0.12, 0.022, 0.5, 0);
  S.cyl(0.02, 0.03, 0.06, 8, 0xd8ccb0, [0, 0.03, 0]);
  for (let i = 0; i < 3; i++) S.torus(0.08, 0.004, 4, 28, 0xd8a840, [0, 0.15, 0], [i === 0 ? PI / 2 : 0.4, i * PI / 3, i === 2 ? 0.4 : 0], null, 0.45);
  S.ball(0.02, 1, 0x4a7ab0, [0, 0.15, 0], null, null, 0.2);
  person(A, 0.24, 0.022, 0.48, -1.4, 0.1, { cloth: 0xe8e0c8, robe: true, hair: 0xb0aaa0, skin: 0xc09070, armUp: true });
  // obelisk, palms, houses, ships in the harbour
  A.cyl(0.006, 0.018, 0.26, 4, 0xc87858, [0.55, 0.15, 0.25], [0, PI / 4, 0]); A.cone(0.0085, 0.02, 4, 0xe8c050, [0.55, 0.29, 0.25], [0, PI / 4, 0], null, 0.5);
  for (const [x, z] of [[-0.7, 0.2], [0.35, 0.65], [0.62, 0.48], [-0.05, 0.78], [-0.55, 0.62]]) palm(A, x, H(x, z), z, 0.2, Math.round(x * 50 + z * 90));
  for (let i = 0; i < 10; i++) { const x = 0.05 + (i % 4) * 0.12 + (r() - 0.5) * 0.03, z = 0.05 + Math.floor(i / 4) * 0.11; if (Math.hypot(x, z) > 0.88 || shore(x, z) < 0.04) continue; const h = 0.04 + r() * 0.03; A.box(0.08, h, 0.07, vary(0xe8dcc4, 0.05, r), [x, 0.02 + h / 2, z], [0, r() * 0.4, 0]); A.box(0.014, 0.018, 0.004, 0xffb050, [x, 0.035, z + 0.036], null, null, 1); }
  for (const [x, z, yaw] of [[-0.3, -0.35, 0.4], [-0.6, -0.4, -0.3], [0.0, -0.7, 0.9]]) {
    const Sh = A.at(x, 0.003, z, yaw);
    Sh.tube([[0, 0.02, -0.1], [0, 0.006, -0.04], [0, 0.006, 0.04], [0, 0.025, 0.1]], 0.018, 0x6a4628, 5, 10);
    Sh.rod([0, 0.01, 0], [0, 0.15, 0], 0.003, 0x4a3020); Sh.box(0.003, 0.07, 0.09, 0xf2e4c8, [0, 0.1, 0.003]);
  }
  return { glow: [[0.38, 0.95, -0.6, 0xffa040, 0.4]] };
};

// Era 2, Chapter 1: Frombork, the cathedral on its walled hill above the town and the lagoon
BUILD[8] = (k, A) => {
  const n = noise2(31), r = rng(37);
  const lagoon = (x, z) => -z - 0.68 - 0.04 * Math.sin(x * 5);
  const hill = (x, z) => Math.hypot(x / 0.66, (z + 0.12) / 0.42);
  const H = (x, z) => (lagoon(x, z) > 0 ? 0.002 : 0.012 + 0.16 * (1 - sstep(0.85, 1.25, hill(x, z))) + 0.012 * n(x * 6, z * 6));
  terrain(k, H, (x, z, y) => {
    const lg = lagoon(x, z);
    if (lg > 0) return vary(mix(0x8aa0b8, 0x9ab0c4, n(x * 9, z * 9)), 0.03, r);
    if (lg > -0.035) return 0xc8c0a0;
    const h = hill(x, z);
    if (h < 0.86) return vary(0x7a8a50, 0.06, r);
    if (h < 1.2) return vary(0x5e7a40, 0.07, r);
    return vary(mix(0x6a8a48, 0x7a9450, n(x * 5, z * 5)), 0.06, r);
  }, { rings: 24 });
  const top = 0.172, brick = 0xa8442c, roofc = 0x7e3626;
  // the cathedral: nave with buttresses, tall windows, a steep roof, the west front with stepped
  // gable and four slender turrets, a smaller stepped gable at the east end, a porch on the south
  const C = A.at(0.02, top - 0.005, -0.14, 0), L = 0.6, W = 0.17, Hh = 0.19;
  C.box(L, Hh, W, brick, [0, Hh / 2, 0]);
  C.geo(gableRoof(L, W, 0.17, 0.012), roofc, [0, Hh, 0]);
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) {
    const x = -L / 2 + 0.04 + i * (L - 0.08) / 8;
    C.box(0.022, Hh * 0.92, 0.03, mix(brick, 0x000000, 0.12), [x, Hh * 0.46, s * (W / 2 + 0.012)]);
    C.cone(0.012, 0.035, 4, mix(brick, 0x000000, 0.1), [x, Hh * 0.92 + 0.017, s * (W / 2 + 0.012)], [0, PI / 4, 0]);
    if (i < 8) {
      const wx = x + (L - 0.08) / 16;
      C.box(0.026, 0.11, 0.006, (i + s) % 3 ? 0x2a2030 : 0xffb860, [wx, 0.1, s * (W / 2 + 0.002)], null, null, (i + s) % 3 ? 0 : 0.85);
      C.cone(0.013, 0.02, 4, (i + s) % 3 ? 0x2a2030 : 0xffb860, [wx, 0.165, s * (W / 2 + 0.002)], [0, PI / 4, 0], [1, 1, 0.3], (i + s) % 3 ? 0 : 0.85);
    }
  }
  const WF = C.at(-L / 2, 0, 0, -PI / 2);
  steppedGable(WF, W + 0.02, 0.2, 5, brick, 0.0, Hh, 0.025);
  for (let i = 0; i < 3; i++) WF.box(0.022, 0.13, 0.006, 0x3a1a14, [-0.05 + i * 0.05, 0.08, 0.015]);
  WF.box(0.045, 0.07, 0.006, 0x2a1a10, [0, 0.035, 0.016]);
  for (const s of [-1, 1]) {
    WF.cyl(0.016, 0.018, 0.34, 8, brick, [s * (W / 2 + 0.01), 0.17, 0.0]);
    WF.cone(0.02, 0.12, 8, 0x5a5a5a, [s * (W / 2 + 0.01), 0.4, 0.0]);
    WF.ball(0.006, 0, 0xe8c050, [s * (W / 2 + 0.01), 0.465, 0], null, null, 0.6);
    WF.cyl(0.009, 0.01, 0.28, 6, brick, [s * 0.035, 0.3, 0.004]);
    WF.cone(0.012, 0.07, 6, 0x5a5a5a, [s * 0.035, 0.475, 0.004]);
  }
  const EF = C.at(L / 2, 0, 0, PI / 2);
  steppedGable(EF, W, 0.16, 4, brick, 0.0, Hh, 0.025);
  C.box(0.08, 0.1, 0.05, brick, [-0.05, 0.05, W / 2 + 0.025]); C.geo(gableRoof(0.05, 0.08, 0.04, 0.005), roofc, [-0.05, 0.1, W / 2 + 0.025], [0, PI / 2, 0]);
  C.box(0.03, 0.05, 0.004, 0x2a1a10, [-0.05, 0.025, W / 2 + 0.051]);
  // the walls round the hilltop, with crenellations, towers at the corners and a gate tower
  const wall = [[-0.46, -0.38], [0.44, -0.38], [0.48, 0.1], [0.3, 0.22], [-0.3, 0.22], [-0.5, 0.06]];
  for (let i = 0; i < wall.length; i++) {
    const [x0, z0] = wall[i], [x1, z1] = wall[(i + 1) % wall.length], len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(-(z1 - z0), x1 - x0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, WL = A.at(cx, H(cx, cz) - 0.02, cz, a);
    WL.box(len, 0.085, 0.022, mix(brick, 0x6a5040, 0.25), [0, 0.042, 0]);
    for (let j = 0; j < Math.floor(len / 0.035); j++) WL.box(0.018, 0.016, 0.024, mix(brick, 0x6a5040, 0.25), [-len / 2 + 0.018 + j * 0.035, 0.093, 0]);
  }
  // corner towers; the tall one at the north-west corner is Copernicus's tower
  wall.forEach(([x, z], i) => {
    const big = i === 0, y = H(x, z) - 0.02, hh = big ? 0.3 : 0.14, w = big ? 0.08 : 0.06;
    A.box(w, hh, w, mix(brick, 0x6a5040, 0.15), [x, y + hh / 2, z]);
    A.cyl(0, w * 0.78, big ? 0.1 : 0.07, 4, roofc, [x, y + hh + (big ? 0.05 : 0.035), z], [0, PI / 4, 0]);
    if (big) { winRow(A.at(x, y, z), w * 0.6, hh - 0.05, 0.05, 2, 2, w / 2 + 0.002, { ww: 0.014, wh: 0.025, lit: 0.8, seed: 3 }); A.ball(0.006, 0, 0xe8c050, [x, y + hh + 0.105, z], null, null, 0.6); }
  });
  const gx = 0.0, gz = 0.22, gy = H(gx, gz) - 0.02;
  A.box(0.08, 0.16, 0.06, mix(brick, 0x6a5040, 0.15), [gx, gy + 0.08, gz]); A.geo(gableRoof(0.08, 0.06, 0.05, 0.005), roofc, [gx, gy + 0.16, gz]);
  A.box(0.035, 0.06, 0.004, 0x1a120a, [gx, gy + 0.03, gz + 0.031]);
  // the little town on the slope below: gabled houses, a lane, lit windows
  for (let i = 0; i < 16; i++) {
    const row = Math.floor(i / 6), x = -0.56 + (i % 6) * 0.21 + (r() - 0.5) * 0.04 + row * 0.08, z = 0.46 + row * 0.15 + (r() - 0.5) * 0.03;
    if (Math.hypot(x, z) > 0.86) continue;
    house(A, x, H(x, z) - 0.01, z, (r() - 0.5) * 0.3, 0.1 + r() * 0.03, 0.08, 0.07 + r() * 0.03, { wall: vary([0xe0d0b0, 0xd8b890, 0xe8dcc0, 0xc8a888][i % 4], 0.05, r), roof: vary(roofc, 0.1, r), seed: i, lit: 0.55 });
  }
  // fishing boats on the lagoon
  for (const [x, z, yaw] of [[-0.3, -0.82, 0.3], [0.25, -0.8, -0.2]]) {
    const Sh = A.at(x, 0.003, z, yaw);
    Sh.tube([[0, 0.015, -0.06], [0, 0.005, 0], [0, 0.015, 0.06]], 0.014, 0x4a3420, 4, 6);
    Sh.rod([0, 0.01, 0], [0, 0.1, 0], 0.002, 0x3a2a1a); Sh.box(0.002, 0.06, 0.05, 0xd8c8a0, [0, 0.07, 0.003]);
  }
  return { glow: [[-0.46, 0.4, -0.38, 0xffb060, 0.3]] };
};

// Era 2, Chapter 2: Uraniborg on Hven, Tycho's castle in its square walled garden
BUILD[9] = (k, A) => {
  const n = noise2(41), r = rng(43);
  const D = 0.9;   // centre to corner of the garden square (its corners point N, S, E and W)
  const inside = (x, z) => Math.abs(x) + Math.abs(z) < D - 0.03;
  const H = (x, z) => 0.012 + 0.008 * n(x * 6, z * 6) * (inside(x, z) ? 0.3 : 1);
  terrain(k, H, (x, z, y) => {
    const m = Math.abs(x) + Math.abs(z);
    if (!inside(x, z)) return vary(mix(0x6a8a44, 0x7a9a4c, n(x * 6, z * 6)), 0.06, r);
    return vary(0x5f8a3e, 0.05, r);
  }, { rings: 20, seg: 80 });
  // gravel avenues gate to gate and north to south, the round forecourt, and four round flower beds
  A.box(2 * D - 0.1, 0.006, 0.045, 0xd8c8a0, [0, 0.015, 0]); A.box(0.045, 0.006, 2 * D - 0.1, 0xd8c8a0, [0, 0.015, 0]);
  A.cyl(0.24, 0.24, 0.01, 32, 0xd0c09a, [0, 0.019, 0]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    A.cyl(0.1, 0.1, 0.008, 24, 0xd8c8a0, [sx * 0.3, 0.015, sz * 0.3]);
    A.cyl(0.085, 0.085, 0.014, 24, 0x4f7a32, [sx * 0.3, 0.016, sz * 0.3]);
    A.cyl(0.05, 0.05, 0.02, 20, 0xb84a5a, [sx * 0.3, 0.017, sz * 0.3]);
    A.cyl(0.02, 0.02, 0.026, 12, 0xe8d070, [sx * 0.3, 0.018, sz * 0.3]);
  }
  // the garden wall: a rampart of brick with stone coping and buttresses, half-round bays mid-side
  const wallCol = 0xb8684a, cope = 0xd8ccb0;
  const corners = [[0, -D], [D, 0], [0, D], [-D, 0]];      // N, E, S, W
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 4], a = Math.atan2(-(z1 - z0), x1 - x0), len = Math.hypot(x1 - x0, z1 - z0);
    for (const half of [0, 1]) {
      const f0 = half ? 0.58 : 0.06, f1 = half ? 0.94 : 0.42, cx = x0 + (x1 - x0) * (f0 + f1) / 2, cz = z0 + (z1 - z0) * (f0 + f1) / 2, l = len * (f1 - f0);
      const W = A.at(cx, 0.004, cz, a);
      W.box(l, 0.07, 0.03, wallCol, [0, 0.035, 0]);
      W.box(l + 0.004, 0.012, 0.038, cope, [0, 0.074, 0]);
      for (let j = 0; j <= Math.floor(l / 0.08); j++) W.box(0.02, 0.06, 0.012, mix(wallCol, 0x000000, 0.1), [-l / 2 + 0.01 + j * 0.08, 0.03, 0.02]);
      for (let j = 0; j < 3; j++) W.box(l, 0.004, 0.032, mix(wallCol, 0xffffff, 0.15), [0, 0.018 + j * 0.016, 0.001]);
    }
    // the half-round bay in the middle of the side, bulging outward, with a little arbour
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, Bb = A.at(mx, 0.004, mz, a);
    for (let j = 0; j <= 8; j++) {
      const t = PI * j / 8, bx = Math.cos(t) * 0.11, bz = -Math.sin(t) * 0.11;
      Bb.box(0.045, 0.07, 0.03, wallCol, [bx, 0.035, bz], [0, t + PI / 2, 0]);
      Bb.box(0.048, 0.012, 0.038, cope, [bx, 0.074, bz], [0, t + PI / 2, 0]);
    }
    Bb.cyl(0.035, 0.035, 0.06, 8, 0xe8dcc0, [0, 0.03, -0.05]); Bb.cone(0.05, 0.05, 8, 0x5a7a8a, [0, 0.085, -0.05]);
  }
  // gatehouses at the east and west corners; small lodges at the north and south corners
  for (const [x, z, gate] of [[D, 0, true], [-D, 0, true], [0, -D, false], [0, D, false]]) {
    const G = A.at(x * 0.97, 0.004, z * 0.97, Math.atan2(x, z) + PI);
    G.box(0.12, 0.12, 0.1, 0xb8684a, [0, 0.06, 0]);
    G.geo(gableRoof(0.12, 0.1, 0.07, 0.006), 0x8a4a34, [0, 0.12, 0]);
    for (const s of [-1, 1]) G.geo(gableWall(0.1, 0.07, 0.006), 0xb8684a, [s * 0.057, 0.12, 0], [0, PI / 2, 0]);
    if (gate) { G.box(0.045, 0.07, 0.004, 0x1a120a, [0, 0.035, 0.051]); G.cyl(0.02, 0.02, 0.004, 10, 0x1a120a, [0, 0.07, 0.051], [PI / 2, 0, 0]); G.box(0.016, 0.016, 0.004, 0xffc070, [0.04, 0.09, 0.051], null, null, 1); G.cyl(0.004, 0.004, 0.05, 4, 0x6a4a2a, [0, 0.215, 0]); G.ball(0.008, 0, 0xe8c050, [0, 0.24, 0], null, null, 0.6); }
    else for (const z of [0.051, -0.051]) { G.box(0.02, 0.025, 0.004, 0xffc070, [-0.03, 0.06, z], null, null, 1); G.box(0.02, 0.025, 0.004, 0xffc070, [0.03, 0.06, z], null, null, 1); G.box(0.022, 0.045, 0.004, 0x3a2416, [0, 0.022, z]); }
  }
  // Uraniborg itself: the square main house, north and south observatory towers, a central dome
  const U = A.at(0, 0.008, 0, 0), red = 0xa8503a, sand = 0xdccca8;
  U.box(0.22, 0.16, 0.2, red, [0, 0.08, 0]);
  for (let i = 0; i < 3; i++) U.box(0.226, 0.008, 0.206, sand, [0, 0.005 + i * 0.075, 0]);
  U.geo(gableRoof(0.2, 0.22, 0.09, 0.006), 0x5a6a7a, [0, 0.16, 0], [0, PI / 2, 0]); U.geo(gableRoof(0.22, 0.2, 0.09, 0.006), 0x5a6a7a, [0, 0.16, 0]);
  // ornate gables on each face (stepped, sandstone trim)
  for (let f = 0; f < 4; f++) { const F = U.at(0, 0, 0, f * PI / 2); steppedGable(F, 0.08, 0.07, 3, red, 0.1, 0.16, 0.012, sand); winRow(F, 0.18, 0.05, 0.075, 2, 4, 0.101, { ww: 0.018, wh: 0.03, lit: 0.6, seed: 5 + f }); }
  // the octagonal central tower and its dome, lantern and gilded Pegasus vane
  U.cyl(0.045, 0.05, 0.1, 8, red, [0, 0.27, 0]); U.cyl(0.052, 0.052, 0.008, 8, sand, [0, 0.32, 0]);
  U.add(new THREE.SphereGeometry(0.05, 10, 5, 0, TAU, 0, PI / 2), 0x6a8a7a, [0, 0.322, 0]);
  U.cyl(0.012, 0.014, 0.04, 8, sand, [0, 0.39, 0]); U.cone(0.014, 0.05, 8, 0x6a8a7a, [0, 0.43, 0]);
  U.cyl(0.002, 0.002, 0.04, 3, 0xe8c050, [0, 0.47, 0], null, null, 0.6); U.box(0.02, 0.012, 0.003, 0xe8c050, [0.008, 0.49, 0], null, null, 0.6);
  // the two round observatory towers (north and south), with conical roofs that opened to the sky
  for (const s of [-1, 1]) {
    U.cyl(0.065, 0.068, 0.2, 14, red, [0, 0.1, s * 0.15]);
    U.cyl(0.07, 0.07, 0.008, 14, sand, [0, 0.2, s * 0.15]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; U.box(0.016, 0.03, 0.004, i % 2 ? 0xffc070 : 0x2a2630, [Math.cos(a) * 0.067, 0.14, s * 0.15 + Math.sin(a) * 0.067], [0, -a + PI / 2, 0], null, i % 2 ? 1 : 0); }
    U.cone(0.075, 0.09, 14, 0x5a6a7a, [0, 0.25, s * 0.15]);
    U.box(0.03, 0.05, 0.004, 0xffd890, [0, 0.235, s * (0.15 + 0.05)], [s * 0.6, 0, 0], null, 1);   // the roof flap open, light inside
    U.ball(0.008, 0, 0xe8c050, [0, 0.3, s * 0.15], null, null, 0.6);
  }
  // little bay pavilions east and west
  for (const s of [-1, 1]) { U.box(0.05, 0.1, 0.08, red, [s * 0.135, 0.05, 0]); U.cone(0.055, 0.05, 4, 0x5a6a7a, [s * 0.135, 0.125, 0], [0, PI / 4, 0]); }
  // garden trees in rows and the orchard, and Tycho's tame elk
  for (let q = 0; q < 4; q++) for (let i = 0; i < 5; i++) {
    const a = q * PI / 2 + PI / 4, t = 0.38 + i * 0.07, side = (i % 2 ? 1 : -1) * 0.12;
    const x = Math.cos(a) * t - Math.sin(a) * side, z = Math.sin(a) * t + Math.cos(a) * side;
    if (Math.abs(x) + Math.abs(z) > D - 0.1) continue;
    A.cyl(0.005, 0.006, 0.05, 4, 0x5a4030, [x, 0.035, z]); A.ball(0.035, 1, vary(0x4a7a30, 0.12, r), [x, 0.08, z], null, [1, 0.9, 1]);
  }
  const El = A.at(-0.3, 0.012, 0.18, 0.9, 0.07);
  El.box(0.35, 0.3, 0.8, 0x6a4a30, [0, 0.75, 0]); El.box(0.18, 0.3, 0.18, 0x6a4a30, [0, 0.95, 0.45], [-0.6, 0, 0]); El.box(0.14, 0.14, 0.3, 0x5a3a24, [0, 1.0, 0.65]);
  for (const [lx, lz] of [[-0.12, -0.3], [0.12, -0.3], [-0.12, 0.3], [0.12, 0.3]]) El.cyl(0.04, 0.035, 0.6, 4, 0x4a3020, [lx, 0.3, lz]);
  for (const s of [-1, 1]) El.tube([[s * 0.06, 1.2, 0.55], [s * 0.25, 1.35, 0.5], [s * 0.35, 1.45, 0.45]], 0.03, 0xd8c8a0, 3);
  return { glow: [[0, 0.3, 0, 0xffc070, 0.3]] };
};

// Era 2, Chapter 3: Prague's Old Town, the twin-spired Týn church, Kepler's lit attic window
BUILD[10] = (k, A) => {
  const n = noise2(51), r = rng(53);
  const river = (x, z) => -z - 0.72 + 0.05 * Math.sin(x * 4);
  const H = (x, z) => (river(x, z) > 0 ? 0.002 : 0.012 + 0.006 * n(x * 8, z * 8));
  terrain(k, H, (x, z) => {
    if (river(x, z) > 0) return vary(mix(0x4a6a88, 0x5a7a98, n(x * 9, z * 9)), 0.04, r);
    if (river(x, z) > -0.035) return 0x8a8a7a;
    return vary(mix(0x9a8e7c, 0x8a8070, n(x * 14, z * 14)), 0.04, r);   // cobbles
  }, { rings: 22 });
  const stone = 0x5a524a, slate = 0x2e3036;
  // the Týn church: a tall nave and steep roof, the gable between its two towers, and on each tower
  // a tall dark spire ringed by four corner spirelets and four more halfway, all tipped in gold
  const T = A.at(-0.02, 0.008, -0.3, 0);
  T.box(0.2, 0.3, 0.42, 0x7a6e62, [0, 0.15, -0.08]);
  T.geo(gableRoof(0.42, 0.2, 0.2, 0.008), 0x6a3a2c, [0, 0.3, -0.08], [0, PI / 2, 0]);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) { T.box(0.02, 0.26, 0.03, mix(stone, 0x7a6e62, 0.5), [s * 0.11, 0.13, -0.26 + i * 0.08]); T.box(0.006, 0.16, 0.035, 0x2a2030, [s * 0.101, 0.16, -0.22 + i * 0.08], null, null, 0); }
  steppedGable(T.at(0, 0, 0.13), 0.14, 0.16, 4, 0x7a6e62, 0, 0.3, 0.02, stone);
  for (const s of [-1, 1]) {
    const tx = s * 0.1, tz = 0.12;
    T.box(0.08, 0.5, 0.08, stone, [tx, 0.25, tz]);
    for (let i = 0; i < 4; i++) T.box(0.084, 0.008, 0.084, mix(stone, 0xffffff, 0.15), [tx, 0.1 + i * 0.11, tz]);
    T.box(0.014, 0.05, 0.004, 0x2a2030, [tx, 0.38, tz + 0.041]); T.box(0.014, 0.05, 0.004, 0x2a2030, [tx, 0.25, tz + 0.041]);
    // gallery and the spire cluster
    T.box(0.096, 0.012, 0.096, stone, [tx, 0.505, tz]);
    T.cone(0.052, 0.36, 8, slate, [tx, 0.69, tz], [0, PI / 8, 0]);
    T.ball(0.01, 0, 0xe8c050, [tx, 0.875, tz], null, null, 0.7);
    for (let i = 0; i < 4; i++) {
      const a = PI / 4 + i * PI / 2, cx = tx + Math.cos(a) * 0.05, cz = tz + Math.sin(a) * 0.05;
      T.cyl(0.011, 0.011, 0.05, 6, slate, [cx, 0.535, cz]); T.cone(0.013, 0.13, 6, slate, [cx, 0.625, cz]); T.ball(0.005, 0, 0xe8c050, [cx, 0.695, cz], null, null, 0.7);
      const b = i * PI / 2, mx = tx + Math.cos(b) * 0.034, mz = tz + Math.sin(b) * 0.034;
      T.cone(0.01, 0.1, 6, slate, [mx, 0.66, mz]); T.ball(0.004, 0, 0xe8c050, [mx, 0.715, mz], null, null, 0.7);
    }
  }
  // the gabled Týn school in front of the church, its arcade lit
  const S = A.at(-0.02, 0.008, -0.05, 0);
  S.box(0.3, 0.12, 0.08, 0xe0d0b0, [0, 0.06, 0]);
  for (let i = 0; i < 4; i++) { S.box(0.04, 0.045, 0.004, 0x3a2a1a, [-0.105 + i * 0.07, 0.022, 0.041]); S.cyl(0.02, 0.02, 0.004, 8, 0xffb860, [-0.105 + i * 0.07, 0.045, 0.041], [PI / 2, 0, 0], null, 0.9); }
  for (const x of [-0.08, 0.08]) steppedGable(S.at(x, 0, 0.03), 0.13, 0.07, 3, 0xe0d0b0, 0, 0.12, 0.012, 0x8a3a28);
  S.geo(gableRoof(0.3, 0.08, 0.06, 0.004), 0x9a4a30, [0, 0.12, 0]);
  winRow(S, 0.28, 0.09, 0.03, 1, 6, 0.041, { ww: 0.014, wh: 0.024, lit: 0.6, seed: 8 });
  // the Old Town: colourful houses round the square, red roofs
  const walls = [0xe6d2a0, 0xd8b0a0, 0xc8d0b0, 0xe8dcc0, 0xd8c090, 0xb8c8d0];
  for (let i = 0; i < 18; i++) {
    const a = PI * (0.12 + i * 0.105), rr = 0.62 + (i % 2) * 0.13, x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.9 + 0.05;
    if (river(x, z) > -0.08 || Math.hypot(x, z) > 0.86 || (x > 0.3 && z > 0.2 && z < 0.6)) continue;
    house(A, x, H(x, z) - 0.008, z, -a + PI / 2, 0.13, 0.1, 0.1 + r() * 0.04, { wall: walls[i % 6], roof: vary(0xa04a30, 0.1, r), seed: i, lit: 0.5, rows: 2 });
  }
  // the Old Town Hall tower with its astronomical clock, gold dials glowing
  const OT = A.at(-0.32, 0.008, 0.12, 0.5);
  OT.box(0.075, 0.4, 0.075, 0x8a7e6e, [0, 0.2, 0]);
  for (let i = 0; i < 3; i++) OT.box(0.079, 0.006, 0.079, 0xa89a88, [0, 0.12 + i * 0.1, 0]);
  OT.cyl(0.022, 0.022, 0.006, 16, 0xe8c050, [0, 0.12, 0.039], [PI / 2, 0, 0], null, 0.8);
  OT.cyl(0.014, 0.014, 0.008, 16, 0x2a3a6a, [0, 0.12, 0.04], [PI / 2, 0, 0], null, 0.3);
  OT.cyl(0.018, 0.018, 0.006, 16, 0xe8c050, [0, 0.06, 0.039], [PI / 2, 0, 0], null, 0.6);
  OT.box(0.012, 0.03, 0.004, 0x2a2030, [0, 0.3, 0.039]);
  OT.box(0.09, 0.012, 0.09, 0x8a7e6e, [0, 0.405, 0]);
  OT.cone(0.05, 0.1, 8, slate, [0, 0.46, 0], [0, PI / 8, 0]);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { OT.cyl(0.008, 0.008, 0.03, 6, 0x8a7e6e, [sx * 0.04, 0.425, sz * 0.04]); OT.cone(0.01, 0.05, 6, slate, [sx * 0.04, 0.465, sz * 0.04]); OT.ball(0.004, 0, 0xe8c050, [sx * 0.04, 0.492, sz * 0.04], null, null, 0.7); }
  OT.ball(0.006, 0, 0xe8c050, [0, 0.515, 0], null, null, 0.7);
  house(A, -0.3, 0.004, 0.3, 0.5, 0.16, 0.1, 0.13, { wall: 0xe8d8b8, roof: 0xa04a30, seed: 31, lit: 0.6, rows: 2 });
  house(A, 0.1, 0.004, 0.46, 0.0, 0.14, 0.1, 0.12, { wall: 0xd8b8a0, roof: 0x9a4430, seed: 32, lit: 0.5, rows: 2 });
  house(A, 0.3, 0.004, 0.0, -1.2, 0.14, 0.1, 0.12, { wall: 0xe6d2a0, roof: 0x9a4430, seed: 34, lit: 0.5, rows: 2 });
  // a little Marian column in the square
  A.cyl(0.008, 0.01, 0.16, 8, 0xc8c0b0, [0.0, 0.088, 0.22]); A.box(0.03, 0.02, 0.03, 0xc8c0b0, [0, 0.016, 0.22]); A.ball(0.008, 0, 0xe8c050, [0, 0.175, 0.22], null, null, 0.6);
  // Kepler's house: tall and narrow, its attic with three open arches lit by candles
  const Kh = A.at(0.44, 0.008, 0.36, -0.45);
  Kh.box(0.14, 0.24, 0.12, 0xe8d8b0, [0, 0.12, 0]);
  winRow(Kh, 0.12, 0.06, 0.07, 2, 3, 0.061, { ww: 0.018, wh: 0.03, lit: 0.3, seed: 2 });
  Kh.box(0.14, 0.008, 0.12, 0xb8a888, [0, 0.24, 0]);
  Kh.box(0.14, 0.07, 0.12, 0xe8d8b0, [0, 0.278, 0]);
  for (let i = 0; i < 3; i++) { const x = -0.045 + i * 0.045; Kh.box(0.028, 0.035, 0.006, 0xffc070, [x, 0.27, 0.061], null, null, 1); Kh.cyl(0.014, 0.014, 0.006, 8, 0xffc070, [x, 0.287, 0.061], [PI / 2, 0, 0], null, 1); }
  Kh.geo(gableRoof(0.14, 0.12, 0.1, 0.008), 0xa04a30, [0, 0.313, 0]);
  for (const s of [-1, 1]) Kh.geo(gableWall(0.12, 0.1, 0.004), 0xe8d8b0, [s * 0.068, 0.313, 0], [0, PI / 2, 0]);
  Kh.box(0.014, 0.06, 0.014, 0x7a4a38, [0.03, 0.39, -0.02]);
  // the river and the stone bridge with its tower
  const Br = A.at(-0.45, 0.002, -0.78, 0.25);
  Br.box(0.04, 0.03, 0.4, 0x8a8070, [0, 0.03, 0]);
  for (let i = 0; i < 4; i++) Br.box(0.044, 0.03, 0.03, 0x7a7060, [0, 0.012, -0.15 + i * 0.1]);
  Br.box(0.07, 0.16, 0.07, 0x6a6258, [0, 0.08, 0.2]); Br.cone(0.06, 0.08, 4, slate, [0, 0.2, 0.2], [0, PI / 4, 0]);
  return { glow: [[0.47, 0.28, 0.42, 0xffb060, 0.14]] };
};

// Era 2, Chapter 4: Venice, the bell tower of San Marco, the Basilica's domes, and Galileo's spyglass
BUILD[11] = (k, A) => {
  const n = noise2(61), r = rng(67);
  const water = (x, z) => z - 0.5 - 0.03 * Math.sin(x * 6);
  const H = (x, z) => (water(x, z) > 0 ? 0.002 : 0.016);
  terrain(k, H, (x, z) => {
    if (water(x, z) > 0) return vary(mix(0x3a7a8a, 0x4a8a98, n(x * 9, z * 9)), 0.05, r);
    return vary(0xa89c8c, 0.03, r);
  }, { rings: 22 });
  // the piazza's pattern of white stone lines over the grey paving
  for (let i = -8; i <= 8; i++) {
    const x = i * 0.1, half = Math.sqrt(Math.max(0, 0.9 - x * x));
    if (half < 0.1) continue;
    const z0 = -half, z1 = Math.min(half, 0.44);
    if (z1 > z0) A.box(0.008, 0.006, z1 - z0, 0xf0ece0, [x, 0.017, (z0 + z1) / 2]);
  }
  for (let j = -8; j <= 4; j++) {
    const z = j * 0.1, half = Math.sqrt(Math.max(0, 0.9 - z * z)) - 0.02;
    if (half > 0.1) A.box(half * 2, 0.006, 0.008, 0xf0ece0, [0, 0.019, z]);
  }
  const brick = 0xb05a40, istria = 0xf0ece0;
  // the campanile: brick shaft with pilaster strips, white belfry with arches, the room above,
  // the green pyramid spire and the golden angel on top
  const C = A.at(0.18, 0.014, -0.05, 0.15), w = 0.12;
  C.box(w + 0.01, 0.03, w + 0.01, istria, [0, 0.015, 0]);
  C.box(w, 0.6, w, brick, [0, 0.33, 0]);
  for (let f = 0; f < 4; f++) { const F = C.at(0, 0, 0, f * PI / 2); for (let i = 0; i < 5; i++) F.box(0.012, 0.58, 0.006, mix(brick, 0xffffff, 0.1), [-w / 2 + 0.006 + i * (w - 0.012) / 4, 0.33, w / 2 + 0.002]); F.box(0.008, 0.02, 0.004, 0x2a2020, [0, 0.42, w / 2 + 0.005]); }
  C.box(w + 0.012, 0.012, w + 0.012, istria, [0, 0.636, 0]);
  for (let f = 0; f < 4; f++) {
    const F = C.at(0, 0.642, 0, f * PI / 2);
    for (let i = 0; i < 5; i++) F.cyl(0.004, 0.004, 0.07, 5, istria, [-w / 2 + 0.006 + i * (w - 0.012) / 4, 0.035, w / 2 - 0.006]);
    for (let i = 0; i < 4; i++) F.cyl(0.0135, 0.0135, 0.004, 8, istria, [-w / 2 + 0.006 + (i + 0.5) * (w - 0.012) / 4, 0.07, w / 2 - 0.006], [PI / 2, 0, 0], [1, 1, 1]);
  }
  C.box(w - 0.02, 0.07, w - 0.02, 0x2a2420, [0, 0.677, 0]);
  C.cone(0.022, 0.03, 8, 0xc8a050, [0, 0.67, 0], null, null, 0.3);                          // a bell inside
  C.box(w + 0.012, 0.014, w + 0.012, istria, [0, 0.72, 0]);
  C.box(w - 0.006, 0.07, w - 0.006, istria, [0, 0.762, 0]);
  for (let f = 0; f < 4; f++) { const F = C.at(0, 0.762, 0, f * PI / 2); F.box(0.03, 0.036, 0.004, 0xc89a60, [0, 0, (w - 0.006) / 2 + 0.002], null, null, 0.2); }
  C.box(w + 0.006, 0.01, w + 0.006, istria, [0, 0.802, 0]);
  C.cyl(0, (w - 0.01) / Math.SQRT2, 0.26, 4, 0x5a9a80, [0, 0.937, 0], [0, PI / 4, 0]);
  C.cyl(0.004, 0.004, 0.02, 4, 0xe8c050, [0, 1.075, 0], null, null, 0.7);
  person(C, 0, 1.08, 0, 0, 0.04, { cloth: 0xe8c050, robe: true, skin: 0xe8c050, hair: 0xe8c050, armUp: true });
  // the loggetta at its foot
  C.box(0.11, 0.05, 0.04, istria, [0, 0.04, 0.09]);
  for (let i = 0; i < 3; i++) C.box(0.022, 0.03, 0.004, 0x3a2a24, [-0.035 + i * 0.035, 0.03, 0.111]);
  // the Basilica: five arched portals with gold mosaics, and its five domes with lanterns
  const B = A.at(-0.32, 0.014, -0.42, 0.15);
  B.box(0.4, 0.14, 0.2, 0xe8d8c4, [0, 0.07, 0]);
  for (let i = 0; i < 5; i++) {
    const x = -0.16 + i * 0.08, big = i === 2;
    B.box(big ? 0.06 : 0.05, big ? 0.1 : 0.08, 0.006, 0x3a2a24, [x, big ? 0.05 : 0.04, 0.101]);
    B.cyl(big ? 0.03 : 0.025, big ? 0.03 : 0.025, 0.006, 10, 0xe0b040, [x, big ? 0.1 : 0.08, 0.101], [PI / 2, 0, 0], null, 0.5);
    B.cyl(0.026, 0.026, 0.008, 10, 0xe8d8c4, [x, 0.15, 0.1], [PI / 2, 0, 0]);
    B.cone(0.008, 0.03, 5, istria, [x, 0.17, 0.1]);
  }
  for (const [x, z, s] of [[0, 0, 1.2], [-0.13, 0, 0.9], [0.13, 0, 0.9], [0, -0.08, 0.9], [0, 0.07, 0.85]]) {
    B.cyl(0.04 * s, 0.04 * s, 0.03, 10, 0xe8d8c4, [x, 0.155, z]);
    B.add(new THREE.SphereGeometry(0.045 * s, 10, 5, 0, TAU, 0, PI / 2), 0x7a8a8a, [x, 0.17, z], null, [1, 1.3, 1]);
    B.cyl(0.008, 0.01, 0.025, 6, 0x7a8a8a, [x, 0.17 + 0.058 * s + 0.01, z]); B.ball(0.006, 0, 0xe8c050, [x, 0.17 + 0.058 * s + 0.03, z], null, null, 0.6);
  }
  // the Doge's Palace: white arcades below, the pink-and-white wall above
  const Dp = A.at(-0.5, 0.014, 0.3, 0.05);
  Dp.box(0.48, 0.2, 0.15, 0xe8c4b8, [0, 0.1, 0]);
  for (let i = 0; i < 9; i++) { const x = -0.21 + i * 0.0525; Dp.box(0.034, 0.05, 0.006, 0x3a2a24, [x, 0.03, 0.076]); Dp.cyl(0.017, 0.017, 0.006, 8, 0x3a2a24, [x, 0.055, 0.076], [PI / 2, 0, 0]); }
  for (let i = 0; i < 17; i++) Dp.box(0.012, 0.035, 0.006, 0x4a3a34, [-0.22 + i * 0.0275, 0.095, 0.076]);
  Dp.box(0.482, 0.008, 0.152, istria, [0, 0.07, 0]);
  winRow(Dp, 0.42, 0.155, 0.04, 1, 6, 0.076, { ww: 0.022, wh: 0.04, lit: 0.6, seed: 4 });
  for (let i = 0; i < 24; i++) Dp.box(0.008, 0.012, 0.008, istria, [-0.235 + i * 0.0205, 0.206, 0.07]);
  Dp.geo(gableRoof(0.48, 0.15, 0.03, 0.004), 0x9a5a40, [0, 0.2, 0]);
  // the two columns by the water, with the lion and St Theodore
  for (const [x, z, gold] of [[-0.22, 0.4, true], [0.0, 0.42, false]]) { A.cyl(0.012, 0.014, 0.26, 8, 0xc8c0b0, [x, 0.146, z]); A.box(0.03, 0.02, 0.03, istria, [x, 0.285, z]); A.ball(0.016, 1, gold ? 0xc8a040 : 0xe8e0d0, [x, 0.31, z], null, [1.4, 1, 0.9], gold ? 0.3 : 0); }
  // Galileo's spyglass on its stand, tilted to the sky, and Galileo beside it
  const Tl = A.at(0.42, 0.016, 0.3, -0.6);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; Tl.rod([0, 0.16, 0], [Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06], 0.003, 0x6a4a2a, 4); }
  Tl.cyl(0.011, 0.014, 0.24, 10, 0xb08a40, [0, 0.2, 0.01], [-1.0, 0, 0], null, 0.3);
  Tl.cyl(0.015, 0.015, 0.02, 10, 0xd8b050, [0, 0.27, -0.09], [-1.0, 0, 0], null, 0.5);
  Tl.cyl(0.006, 0.007, 0.03, 8, 0x2a2a2a, [0, 0.14, 0.1], [-1.0, 0, 0]);
  person(A, 0.48, 0.016, 0.43, -0.4, 0.12, { cloth: 0x2a2228, robe: true, hair: 0xa08868, skin: 0xd0a080 });
  // gondolas and a ship in the basin
  for (const [x, z, yaw] of [[-0.1, 0.62, 0.2], [0.25, 0.7, -0.3], [-0.42, 0.66, 0.5]]) {
    const G = A.at(x, 0.003, z, yaw);
    G.tube([[0, 0.025, -0.1], [0, 0.006, -0.05], [0, 0.005, 0.04], [0, 0.03, 0.1]], 0.012, 0x15151a, 4, 10);
    G.box(0.004, 0.02, 0.004, 0xc8c0b0, [0, 0.035, 0.1]);
    person(G, 0, 0.006, -0.06, 0, 0.06, { cloth: 0xe8e0d0, legs: 0x2a2a2a });
  }
  const Sh = A.at(0.55, 0.003, 0.65, 1.2);
  Sh.tube([[0, 0.04, -0.16], [0, 0.012, -0.08], [0, 0.01, 0.06], [0, 0.05, 0.16]], 0.035, 0x5a3a24, 5, 10);
  Sh.rod([0, 0.02, 0.02], [0, 0.3, 0.02], 0.004, 0x4a3020); Sh.rod([0, 0.02, -0.08], [0, 0.22, -0.08], 0.0035, 0x4a3020);
  Sh.box(0.003, 0.1, 0.12, 0xf0e4c8, [0, 0.19, 0.02]); Sh.box(0.003, 0.07, 0.08, 0xf0e4c8, [0, 0.15, -0.08]);
  return { glow: [[0.18, 0.7, -0.05, 0xffc070, 0.25]] };
};

// Era 2, Chapter 5: Woolsthorpe Manor, its orchard and the famous apple tree, sheep, an evening glow
BUILD[12] = (k, A) => {
  const n = noise2(71), r = rng(73);
  const H = (x, z) => 0.015 + 0.03 * n(x * 2.5 + 1, z * 2.5) + 0.04 * sstep(0, -0.8, z) * (0.5 + 0.5 * x);
  terrain(k, H, (x, z) => {
    if (Math.abs(z - 0.02 - x * 0.1) < 0.03 && x < 0.1) return 0xb8a888;    // the cart track to the door
    if (x < -0.28 && z > 0.05) return vary(mix(0x7a9a48, 0x8aa458, n(x * 8, z * 8)), 0.05, r);   // pasture
    if (x > 0.25 && z < -0.2) return (Math.floor((x + z) * 30) % 2) ? 0xd8b860 : 0xc8a850;      // stubble
    return vary(mix(0x6a9040, 0x7a9a48, n(x * 8, z * 8)), 0.05, r);
  }, { rings: 16, seg: 60 });
  // the manor: grey limestone, steep stone-slate roof, chimneys at the gable ends, mullioned windows
  const M = A.at(-0.12, H(-0.12, -0.36) - 0.012, -0.36, 0.12), lime = 0xd8ccb0, slate = 0x6a645a;
  M.box(0.47, 0.06, 0.21, 0xb0a488, [0, -0.02, 0]);
  M.box(0.46, 0.2, 0.2, lime, [0, 0.1, 0]);
  M.box(0.47, 0.012, 0.21, 0xc8bc9c, [0, 0.105, 0]);
  M.geo(gableRoof(0.46, 0.2, 0.17, 0.012), slate, [0, 0.2, 0]);
  for (const s of [-1, 1]) {
    M.geo(gableWall(0.2, 0.17, 0.012), lime, [s * 0.224, 0.2, 0], [0, PI / 2, 0]);
    M.box(0.05, 0.3, 0.06, 0xc8bc9c, [s * 0.215, 0.29, 0]); M.box(0.06, 0.016, 0.07, 0xb8ac8c, [s * 0.215, 0.44, 0]);
    for (const c of [-1, 1]) M.cyl(0.008, 0.008, 0.02, 6, 0x9a5a3a, [s * 0.215 + c * 0.012, 0.455, 0]);
  }
  for (let fl = 0; fl < 2; fl++) for (let i = 0; i < 5; i++) {
    if (fl === 0 && i === 2) continue;
    const x = -0.18 + i * 0.09, y = 0.05 + fl * 0.09, lit = (i + fl) % 3 !== 1;
    M.box(0.05, 0.04, 0.006, 0xb8ac8c, [x, y, 0.101]);
    for (let j = 0; j < 2; j++) M.box(0.018, 0.03, 0.006, lit ? 0xffc070 : 0x2a2a30, [x - 0.011 + j * 0.022, y, 0.103], null, null, lit ? 1 : 0);
  }
  for (const x of [-0.12, 0.12]) { M.box(0.05, 0.05, 0.06, lime, [x, 0.27, 0.07]); M.geo(gableRoof(0.06, 0.05, 0.035, 0.005), slate, [x, 0.295, 0.07], [0, PI / 2, 0]); M.box(0.022, 0.025, 0.004, 0xffc070, [x, 0.27, 0.101], null, null, 1); }
  M.box(0.05, 0.08, 0.006, 0x4a3020, [0, 0.04, 0.101]); M.geo(gableRoof(0.07, 0.035, 0.025, 0.004), slate, [0, 0.09, 0.115], [0, PI / 2, 0]);
  // the barn and the round dovecote
  const Bn = A.at(-0.6, H(-0.6, -0.2) - 0.012, -0.2, PI / 2 + 0.2);
  Bn.box(0.35, 0.06, 0.15, 0xa89c80, [0, -0.02, 0]); Bn.box(0.34, 0.12, 0.14, 0xc8b890, [0, 0.06, 0]); Bn.geo(gableRoof(0.34, 0.14, 0.1, 0.01), 0x8a7a5a, [0, 0.12, 0]);
  Bn.box(0.07, 0.09, 0.006, 0x5a3a20, [0, 0.045, 0.071]);
  const dx = 0.5, dz = -0.45; A.cyl(0.05, 0.055, 0.12, 12, lime, [dx, H(dx, dz) + 0.05, dz]); A.cone(0.065, 0.07, 12, slate, [dx, H(dx, dz) + 0.145, dz]); A.cyl(0.012, 0.012, 0.02, 6, lime, [dx, H(dx, dz) + 0.185, dz]);
  // the dry-stone orchard wall: rough stones with a coping of stones on edge
  const wall = [[-0.1, 0.0], [0.62, 0.0], [0.8, 0.35]];
  for (let i = 0; i < wall.length - 1; i++) {
    const [x0, z0] = wall[i], [x1, z1] = wall[i + 1], len = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(-(z1 - z0), x1 - x0), m = Math.ceil(len / 0.035);
    for (let j = 0; j < m; j++) {
      const t = (j + 0.5) / m, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = H(x, z);
      A.box(0.034, 0.05, 0.03, vary(0xb8b098, 0.1, r), [x, y + 0.02, z], [0, a, (r() - 0.5) * 0.1]);
      A.box(0.012, 0.022, 0.034, vary(0xa8a088, 0.1, r), [x, y + 0.055, z], [0, a, (r() - 0.5) * 0.2]);
    }
  }
  // THE apple tree, big and full of apples, with young Isaac reading under it; one apple falling
  const ax = 0.3, az = 0.36, ay = H(ax, az);
  leafyTree(A, ax, ay - 0.005, az, 0.6, 7, { leaf: 0x4a7a2c, trunk: 0x5a4030, fruit: 0xc8282a, nFruit: 46, clumps: 18, wide: 1.1 });
  person(A, ax + 0.02, ay, az + 0.09, 0.2, 0.13, { cloth: 0x3a3a48, pose: 'sit', hair: 0x5a4030, legs: 0x2a2a30 });
  A.box(0.025, 0.004, 0.018, 0xf0e8d0, [ax + 0.025, ay + 0.04, az + 0.13], [-0.6, 0.2, 0]);
  A.ball(0.014, 0, 0xc8282a, [ax + 0.04, ay + 0.2, az + 0.12], null, null, 0.15);
  // the rest of the orchard: younger apple trees
  for (const [x, z, s] of [[0.05, 0.28, 0.36], [0.58, 0.2, 0.34], [0.2, 0.68, 0.3], [0.62, 0.52, 0.32], [-0.05, 0.6, 0.28]]) leafyTree(A, x, H(x, z) - 0.004, z, s, Math.round(x * 100 + z * 13), { fruit: 0xc83a2a, nFruit: 8, clumps: 8 });
  // sheep in the pasture, the shepherd and corn stooks in the stubble
  for (const [x, z, yaw] of [[-0.5, 0.3, 0.4], [-0.6, 0.45, 1.8], [-0.4, 0.5, -0.6], [-0.7, 0.2, 2.6], [-0.32, 0.65, 0.9], [-0.55, 0.62, -1.4]]) sheep(A, x, H(x, z), z, yaw, 0.06);
  person(A, -0.36, H(-0.36, 0.28), 0.28, -0.8, 0.12, { cloth: 0x7a6a48, legs: 0x4a3a2a, hat: 0x5a4a30 });
  for (const [x, z] of [[0.3, -0.35], [0.42, -0.25], [0.2, -0.5], [0.55, -0.3]]) { A.cone(0.025, 0.07, 6, 0xd8b050, [x, H(x, z) + 0.03, z]); }
  return { glow: [[-0.12, 0.15, -0.2, 0xffb060, 0.3]] };
};

// Era 2, Chapter 6: Auburn, Massachusetts, 1926: Goddard's spindly rocket in its frame in the snow
BUILD[13] = (k, A) => {
  const n = noise2(81), r = rng(83);
  const H = (x, z) => 0.012 + 0.03 * n(x * 2.2 + 3, z * 2.2) * sstep(0.2, 0.7, Math.hypot(x, z));
  terrain(k, H, (x, z) => vary(mix(0xeef2f8, 0xdce4f0, n(x * 7, z * 7)), 0.03, r), { rings: 20 });
  // the cabbage patch: rows of old stalks poking through the snow
  for (let row = 0; row < 5; row++) for (let i = 0; i < 7; i++) {
    const x = 0.36 + i * 0.055 - row * 0.03, z = 0.2 + row * 0.07 + i * 0.02;
    if (Math.hypot(x, z) > 0.88) continue;
    A.ball(0.014, 0, vary(0x6a6a48, 0.15, r), [x, H(x, z) + 0.006, z], [r(), r(), 0], [1, 0.7, 1]);
  }
  // the launch frame: two tall pipe uprights, braces and legs; the rocket hangs inside it with
  // its motor at the TOP, two thin pipes running down to the fuel and oxygen tanks behind a cone
  const F = A.at(0, H(0, 0) - 0.004, 0, -0.35), iron = 0x5a5e66, pipe = 0x8a9098;
  const fx = 0.11, top = 0.72;
  for (const s of [-1, 1]) {
    F.rod([s * fx, 0, 0], [s * fx, top, 0], 0.0055, iron, 6);
    F.rod([s * fx, 0.0, 0.11], [s * fx, 0.42, 0], 0.004, iron, 5); F.rod([s * fx, 0.0, -0.11], [s * fx, 0.42, 0], 0.004, iron, 5);
  }
  for (const y of [0.06, 0.24, 0.5, top]) F.rod([-fx, y, 0], [fx, y, 0], 0.0035, iron, 5);
  F.rod([-fx, 0.06, 0], [fx, 0.24, 0], 0.0025, iron, 4); F.rod([fx, 0.5, 0], [-fx, top, 0], 0.0025, iron, 4);
  // the rocket: motor and nozzle near the top, pipes down, the cone shield and the two tanks
  const Rk = F.at(0, 0, 0);
  Rk.cyl(0.016, 0.016, 0.06, 10, 0xb8bcc4, [0, 0.6, 0]);
  Rk.cone(0.014, 0.05, 10, 0x8a8e96, [0, 0.545, 0], [PI, 0, 0]);
  Rk.cyl(0.006, 0.006, 0.02, 6, 0xb8bcc4, [0, 0.64, 0]);
  for (const s of [-1, 1]) Rk.rod([s * 0.028, 0.62, 0], [s * 0.028, 0.34, 0], 0.003, pipe, 5);
  for (const s of [-1, 1]) Rk.rod([s * 0.028, 0.62, 0], [s * 0.012, 0.6, 0], 0.003, pipe, 5);
  Rk.cone(0.04, 0.06, 12, 0xc8ccd4, [0, 0.31, 0]);
  Rk.cyl(0.018, 0.018, 0.1, 10, 0xd8dce4, [0, 0.23, 0]);
  Rk.cyl(0.015, 0.015, 0.06, 10, 0xc8a080, [0, 0.15, 0]);
  Rk.cone(0.01, 0.02, 8, 0x8a8e96, [0, 0.11, 0], [PI, 0, 0]);
  F.box(0.03, 0.012, 0.03, iron, [0, 0.006, 0]);  // the alcohol stove on the ground beneath
  // Goddard in his coat and hat, standing BESIDE the frame; Henry with the torch on its pole
  person(A, 0.26, H(0.26, 0.12), 0.12, -2.0, 0.16, { cloth: 0x2a2a30, legs: 0x2a2a30, hat: 0x3a3a3a, skin: 0xe0b090 });
  person(F, -0.2, 0.0, 0.31, 2.49, 0.16, { cloth: 0x4a3a2a, legs: 0x3a3a4a, hat: 0x5a4a3a, skin: 0xe0b090 });
  F.rod([-0.185, 0.1, 0.29], [-0.05, 0.05, 0.135], 0.0025, 0x6a4a2a, 3);
  F.ball(0.006, 0, 0xffa040, [-0.05, 0.05, 0.135], null, null, 1);
  // Esther with the movie camera on its tripod: she stands BEHIND it, the camera at her eye height
  const ex = 0.12, ez = 0.48, E = A.at(ex, H(ex, ez), ez, 0.25);
  person(E, 0, 0, 0.045, PI, 0.15, { cloth: 0x6a3a3a, robe: true, skin: 0xe0b090, hair: 0x4a3020, hat: 0x3a2a2a });
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; E.rod([0, 0.11, -0.02], [Math.cos(a) * 0.035, 0, -0.02 + Math.sin(a) * 0.035], 0.0018, 0x6a4a2a, 3); }
  E.box(0.024, 0.03, 0.035, 0x1a1a1e, [0, 0.128, -0.02]);
  E.cyl(0.007, 0.007, 0.02, 8, 0x2a2a2a, [0, 0.13, -0.045], [PI / 2, 0, 0]);
  for (const s of [-1, 1]) E.cyl(0.012, 0.012, 0.004, 10, 0x2a2a2a, [0, 0.155, -0.02 + s * 0.012], [0, 0, PI / 2]);
  // Aunt Effie's farmhouse and barn at the back, a stone wall, and bare winter trees
  house(A, -0.35, H(-0.35, -0.62) - 0.01, -0.62, 0.2, 0.26, 0.14, 0.14, { wall: 0xe8e4d8, roof: 0x5a5a62, seed: 9, lit: 0.7 });
  A.geo(gableRoof(0.27, 0.15, 0.1, 0.008), 0xf4f8ff, [-0.35, H(-0.35, -0.62) + 0.136, -0.62], [0, 0.2, 0], [1, 1.02, 1]);
  const Bn = A.at(0.25, H(0.25, -0.68) - 0.01, -0.68, -0.15);
  Bn.box(0.24, 0.13, 0.15, 0x8a3a2a, [0, 0.065, 0]); Bn.geo(gableRoof(0.24, 0.15, 0.1, 0.01), 0x4a4a50, [0, 0.13, 0]); Bn.geo(gableRoof(0.25, 0.16, 0.1, 0.008), 0xf4f8ff, [0, 0.135, 0]);
  for (const s of [-1, 1]) Bn.geo(gableWall(0.15, 0.1, 0.006), 0x8a3a2a, [s * 0.117, 0.13, 0], [0, PI / 2, 0]);
  Bn.box(0.07, 0.09, 0.006, 0x5a2a1a, [0, 0.045, 0.076]);
  for (let i = 0; i < 22; i++) { const x = -0.75 + i * 0.07, z = -0.35 + Math.sin(i) * 0.02; if (Math.hypot(x, z) > 0.9) continue; A.box(0.05, 0.035, 0.03, vary(0x8a8478, 0.12, r), [x, H(x, z) + 0.012, z], [0, r() * 0.3, 0]); A.box(0.045, 0.008, 0.028, 0xf4f8ff, [x, H(x, z) + 0.033, z]); }
  bareTree(A, -0.62, H(-0.62, 0.3), 0.3, 0.55, 11, { snow: true }); bareTree(A, 0.62, H(0.62, -0.25), -0.25, 0.62, 12, { snow: true });
  bareTree(A, -0.58, H(-0.58, -0.3), -0.3, 0.48, 13, { snow: true }); bareTree(A, 0.55, H(0.55, 0.45), 0.45, 0.4, 14, { snow: true });
  pine(A, -0.12, H(-0.12, -0.82), -0.82, 0.3, 15, true);
  return { glow: [[-0.35, 0.1, -0.5, 0xffc070, 0.25]] };
};

// Era 2, Chapter 7: Tyuratam, 1957: the R-7 on its pad, held by four arms, the service tower beside
BUILD[14] = (k, A) => {
  const n = noise2(91), r = rng(97);
  const H = (x, z) => 0.012 + 0.012 * n(x * 4, z * 4) * sstep(0.35, 0.6, Math.hypot(x, z));
  terrain(k, H, (x, z) => vary(mix(0xb8a478, 0xa8946a, n(x * 7, z * 7)), 0.05, r), { rings: 22 });
  // the concrete pad, and the flame trench running out from under it between its concrete walls
  A.box(0.6, 0.02, 0.6, 0xa8a8a0, [0, 0.008, 0]);
  for (let i = 1; i < 6; i++) { A.box(0.6, 0.002, 0.004, 0x8a8a84, [0, 0.019, -0.3 + i * 0.1]); A.box(0.004, 0.002, 0.6, 0x8a8a84, [-0.3 + i * 0.1, 0.019, 0]); }
  A.box(0.16, 0.012, 0.5, 0x2a2420, [0, 0.016, 0.52]);
  A.box(0.1, 0.02, 0.1, 0x1a1614, [0, 0.01, 0]);
  for (const sx of [-1, 1]) A.box(0.03, 0.05, 0.5, 0x9a9a94, [sx * 0.095, 0.022, 0.52]);
  for (let i = 0; i < 6; i++) A.box(0.012, 0.004, 0.1, 0x7a7670, [-0.006 + (i % 2) * 0.012, 0.012, -0.36 - i * 0.09]);
  A.box(0.06, 0.006, 0.5, 0x8a8478, [0, 0.008, -0.6]);       // the rail line the rocket came out on
  const grey = 0xc4cac4, dark = 0x3a3e44, steel = 0x7a8088;
  // the launch table and its four arms reaching up to hold the rocket at the booster tops
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + i * PI / 2, c = Math.cos(a), s = Math.sin(a);
    const base = [c * 0.24, 0.012, s * 0.24], tip = [c * 0.048, 0.42, s * 0.048];
    A.rod(base, tip, 0.008, steel, 5);
    A.rod([c * 0.26, 0.012, s * 0.2], [c * 0.06, 0.4, s * 0.06], 0.005, steel, 4);
    A.rod([c * 0.2, 0.012, s * 0.26], [c * 0.06, 0.4, s * 0.06], 0.005, steel, 4);
    for (let j = 1; j < 4; j++) { const t = j / 4; A.rod([base[0] + (tip[0] - base[0]) * t - s * 0.025, base[1] + (tip[1] - base[1]) * t, base[2] + (tip[2] - base[2]) * t + c * 0.025], [base[0] + (tip[0] - base[0]) * t + s * 0.025, base[1] + (tip[1] - base[1]) * t, base[2] + (tip[2] - base[2]) * t - c * 0.025], 0.003, steel, 4); }
    A.box(0.04, 0.06, 0.04, 0x8a8a84, [c * 0.25, 0.03, s * 0.25]);
  }
  A.box(0.5, 0.02, 0.05, 0x9a9a94, [0, 0.026, -0.14]); A.box(0.05, 0.02, 0.5, 0x9a9a94, [-0.14, 0.026, 0]);
  // the R-7: the core stage with its waist, the nose fairing, and four tapered strap-on boosters
  const R = A.at(0, 0, 0);
  R.cyl(0.04, 0.034, 0.36, 16, grey, [0, 0.3, 0]);
  R.cyl(0.04, 0.04, 0.3, 16, grey, [0, 0.63, 0]);
  R.cyl(0.042, 0.042, 0.012, 16, dark, [0, 0.48, 0]);
  R.cyl(0.03, 0.04, 0.06, 16, grey, [0, 0.81, 0]);
  R.cyl(0.03, 0.03, 0.08, 14, 0xd8dcd4, [0, 0.88, 0]);
  R.cone(0.03, 0.1, 14, 0xd8dcd4, [0, 0.97, 0]);
  R.cyl(0.031, 0.031, 0.008, 14, dark, [0, 0.84, 0]);
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2, c = Math.cos(a), s = Math.sin(a), d = 0.065;
    const B = R.at(c * d, 0, s * d, -a);
    B.cyl(0.006, 0.036, 0.26, 12, grey, [-0.01, 0.34, 0], [0, 0, 0.08]);
    B.cyl(0.036, 0.034, 0.1, 12, grey, [0, 0.16, 0]);
    B.cyl(0.037, 0.037, 0.01, 12, dark, [0, 0.21, 0]);
    B.cone(0.008, 0.035, 6, dark, [-0.025, 0.11, 0], [0, 0, -0.3]);   // the steering fin's stub
    for (const [ox, oz] of [[-0.013, -0.013], [0.013, -0.013], [-0.013, 0.013], [0.013, 0.013]]) B.cyl(0.006, 0.01, 0.025, 8, dark, [ox, 0.1, oz]);
  }
  for (const [ox, oz] of [[-0.015, -0.015], [0.015, -0.015], [-0.015, 0.015], [0.015, 0.015]]) R.cyl(0.007, 0.011, 0.025, 8, dark, [ox, 0.11, oz]);
  // the service tower: a lattice of girders, platforms reaching to the rocket, a lamp at the top
  const T = A.at(0.3, 0.012, -0.05, 0), tw = 0.09, th = 1.0;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) T.rod([sx * tw / 2, 0, sz * tw / 2], [sx * tw / 2, th, sz * tw / 2], 0.004, 0xb04a30, 4);
  for (let i = 0; i <= 12; i++) {
    const y = i * th / 12;
    for (let f = 0; f < 4; f++) {
      const F = T.at(0, 0, 0, f * PI / 2);
      F.rod([-tw / 2, y, tw / 2], [tw / 2, y, tw / 2], 0.0025, 0xb04a30, 3);
      if (i < 12) F.rod([-tw / 2, y, tw / 2], [tw / 2, y + th / 12, tw / 2], 0.0018, 0xc85a3a, 3);
    }
  }
  for (const y of [0.42, 0.66, 0.86]) { T.box(0.16, 0.008, 0.05, 0x9a9a94, [-0.12, y, 0]); T.rod([-0.2, y, -0.02], [-0.2, y + 0.04, -0.02], 0.0015, 0xe0d040, 3); }
  T.box(0.04, 0.02, 0.02, 0xfff0c0, [0, th + 0.012, 0], null, null, 1);
  // floodlight masts, the cable mast, trucks and the low bunker
  for (const [x, z] of [[-0.55, -0.4], [0.5, 0.5], [-0.5, 0.55]]) {
    A.rod([x, H(x, z), z], [x, 0.5, z], 0.005, steel, 4);
    A.box(0.06, 0.04, 0.012, dark, [x, 0.5, z], [0, Math.atan2(x, z), 0]);
    for (let i = 0; i < 3; i++) A.box(0.014, 0.014, 0.004, 0xfff4d0, [x - Math.sign(x) * 0.006, 0.5 + (i - 1) * 0.012 * 0, z - Math.sign(z) * 0.008], [0, Math.atan2(x, z), 0], null, 1);
  }
  for (const [x, z, yaw, c] of [[-0.45, 0.15, 0.3, 0x5a6a4a], [0.42, 0.28, -0.5, 0x6a6a5a], [-0.3, -0.55, 1.4, 0x4a5a4a]]) {
    const Tr = A.at(x, H(x, z), z, yaw);
    Tr.box(0.05, 0.04, 0.05, c, [0, 0.035, 0.07]); Tr.box(0.055, 0.045, 0.12, c, [0, 0.04, -0.02]);
    Tr.box(0.044, 0.018, 0.006, 0x8ab0c8, [0, 0.045, 0.096]);
    for (const [wx, wz] of [[-0.028, 0.06], [0.028, 0.06], [-0.028, -0.05], [0.028, -0.05]]) Tr.cyl(0.012, 0.012, 0.01, 8, 0x1a1a1a, [wx, 0.012, wz], [0, 0, PI / 2]);
  }
  A.box(0.2, 0.05, 0.12, 0x9a9488, [-0.62, H(-0.62, -0.1) + 0.02, -0.1], [0, 0.3, 0]); A.box(0.03, 0.02, 0.004, 0xfff0c0, [-0.58, H(-0.62, -0.1) + 0.03, -0.04], [0, 0.3, 0], null, 1);
  // Korolev looking up at his rocket, and two engineers
  person(A, -0.22, 0.018, 0.25, 2.6, 0.12, { cloth: 0x2a2a30, legs: 0x2a2a30, hat: 0x3a3a3a, skin: 0xe0b090 });
  person(A, 0.2, 0.018, 0.24, -2.4, 0.12, { cloth: 0x5a6a7a, legs: 0x3a3a4a, skin: 0xe0b090, hat: 0x5a6a7a });
  person(A, 0.38, H(0.38, 0.12), 0.12, -1.4, 0.12, { cloth: 0x6a7a5a, legs: 0x3a3a3a, skin: 0xe0b090 });
  return { glow: [[0.3, 1.0, -0.05, 0xfff0c0, 0.25], [-0.55, 0.5, -0.4, 0xfff0d0, 0.2]] };
};

// Where, and when, each diorama shows (the little plaque under it)
export const DIORAMA_LABELS = {
  1: 'Ice Age France, 30,000 years ago',
  2: 'Stonehenge, England, about 2500 BC',
  3: 'The Nile, Egypt, about 2500 BC',
  4: 'Babylon, about 700 BC',
  5: 'Athens, Greece, about 350 BC',
  6: 'Antikythera, Greece, 1900',
  7: 'Alexandria, Egypt, about 150 AD',
  8: 'Frombork, Poland, 1543',
  9: 'Uraniborg, Hven, Denmark',
  10: 'Prague, 1600',
  11: 'Venice, 1609',
  12: 'Woolsthorpe, England, 1666',
  13: 'Auburn, Massachusetts, 1926',
  14: 'Tyuratam, Kazakhstan, 1957',
};

// The material: flat-shaded vertex colours, warmed a little, with self-lit parts (emit) for windows
// and fires. Its opacity fades the whole diorama.
let MAT = null;
export function dioramaMaterial() {
  if (MAT) return MAT;
  MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x0c0806 });
  MAT.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float emit;\nvarying float vEmit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmit = emit;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vEmit;')
      .replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, diffuseColor.rgb * 1.35, clamp(vEmit, 0.0, 1.0));\n#include <opaque_fragment>');
  };
  MAT.customProgramCacheKey = () => 'diorama-emit';
  return MAT;
}

export const hasDiorama = (n) => !!BUILD[n];

// Build chapter n's diorama: { mesh, label, tris, glows: [[x, y, z, color, size]] } in base units
// (radius 1; flight.js scales it). Returns null if there isn't one.
export function buildDiorama(n) {
  const fn = BUILD[n]; if (!fn) return null;
  const k = new Kit(), A = new At(k);
  plinth(A);
  const extra = fn(k, A) || {};
  for (const g of k.parts) {
    const e = g.userData.emit || 0, cnt = g.attributes.position.count;
    g.setAttribute('emit', new THREE.BufferAttribute(new Float32Array(cnt).fill(e), 1));
    if (!g.attributes.normal) g.computeVertexNormals();
  }
  const geo = k.geometry();
  const mesh = new THREE.Mesh(geo, dioramaMaterial());
  mesh.frustumCulled = false;
  return { mesh, label: DIORAMA_LABELS[n] || '', tris: geo.attributes.position.count / 3, glows: extra.glow || [] };
}
