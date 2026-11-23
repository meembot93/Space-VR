// Era 2, Chapter 6 (n 13): the rocket dreamers. Four places.
//
// 1. Kaluga, Russia, a winter night in 1903. Konstantin Tsiolkovsky's glazed veranda study in his
//    wooden house: log walls, a white tiled stove, a kerosene lamp, the schoolteacher's chalkboard,
//    his tin model airship hanging from the beams, a bicycle, a samovar, a cat on the windowsill.
//    Snow falls on the yard, the street, the log houses with carved white window frames, the golden
//    domes, the frozen Oka. His ideas come alive as glowing chalk drawings in the air: Newton's
//    cannon and Jules Verne's Moon cannon out over the roofs (crossed out: it would never work), his
//    liquid-fuel rocket, a balloon zooming round the room, the rocket train dropping its stages, and
//    "the Earth is the cradle of humanity": the chalk rocket flies out of the window to the stars.
// 2. Auburn, Massachusetts, 16 March 1926: the snowy field on Aunt Effie's farm. Goddard's spindly
//    rocket in its launch frame (motor on top, tanks below), Esther filming, Henry Sachs with the
//    blowtorch on a pole. "All right, Henry. Light it." (Adults: you are Henry.) Roar, a 2.5 second
//    hop, 12.5 m up, and it lands in the cabbage patch; the dog bolts, the crows scatter. Then (wow)
//    the rockets that came after rise as giant chalk outlines across the field: the V-2, the Saturn V,
//    the rockets of today. Newspapers mock him, and a glowing bubble of empty space shows that a
//    rocket pushes on its own gas (with an echo of Newton). The 1969 correction.
// 3. Peenemünde on the Baltic, 1944, at dusk in the misty pines: the V-2 alone on its firing table
//    under floodlights. Sombre: no violence, a row of small remembrance lights for the prisoners who
//    were forced to build it. Then it climbs through the clouds, lighting them from inside...
// 4. ...out to the edge of space (the Earth's curve below), and the map of where the rocket
//    builders went after the war: America and the Soviet Union, and a faint beep. Back in Kaluga
//    at night for the journal page.
// World axes: -Z north, +X east, +Y up.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, walkToward, holdProp, dropProp } from '../people.js';
import { makeHerd, makeFlock, makeSmoke, makeTorch, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { glowPoints, rumble, whoosh, awe, shimmer, beeps } from '../wow/fx.js';
import { Space, lonLat } from '../wow/space.js';
import { D2R, ease, clamp01, at, sunAt, house, windows, gableRoof, glow, label, Journal, INK, guideUpdate } from '../era2/common.js';

const N1 = noise2(131), N2 = noise2(133), N3 = noise2(137);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _col = new THREE.Color();
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const RX = 2.6, RZ = 2.2, RH = 2.9;                 // Tsiolkovsky's veranda study
const LAT_K = 54.5, SL_K = 275, LAT_A = 42.2, SL_A = 355, LAT_P = 54.1, SL_P = 89;
const EYE_K = V3(0.6, 1.6, 1.0);                     // where you stand in Kaluga (eyes)
const FRAME = V3(0, 0, -2.2);                        // Goddard's launch frame
const LAND = V3(-38, 0, -42);                        // the cabbage patch, 56 m away
const PAD = V3(0, 0, -55);                           // the V-2's firing table
const CLOUD = 200;                                   // the cloud deck over Peenemünde
const PEEN = [54.15, 13.8], WSANDS = [32.4, -106.5], MOSCOW = [55.75, 37.6];

// ---------- the ground in each place ----------
function valley(z) { // Kaluga: the high bank, the slope down to the frozen Oka, the far bank
  if (z > -30) return -0.55;
  if (z > -250) return -0.55 - 28 * ease((-30 - z) / 220);
  if (z > -330) return -28.6;
  return -28.6 + Math.min(30, (-330 - z) * 0.12);
}
export function kalugaHeight(x, z) {
  if (Math.abs(x) < RX + 0.05 && Math.abs(z) < RZ + 0.05) return 0;
  return valley(z) + (N1(x / 40, z / 40) - 0.5) * 1.6 * clamp((Math.hypot(x, z) - 15) / 30, 0, 1) + (N2(x / 6, z / 6) - 0.5) * 0.12;
}
function auburnHeight(x, z) { return (N1(x / 90 + 7, z / 90) - 0.5) * 5 * clamp((Math.hypot(x, z) - 30) / 80, 0, 1) + (N2(x / 9, z / 9) - 0.5) * 0.25; }
function balticHeight(x, z) { return (N3(x / 60, z / 60) - 0.5) * 2 * clamp((Math.hypot(x, z - PAD.z) - 45) / 60, 0, 1) + (N2(x / 7, z / 7) - 0.5) * 0.1; }

function groundMesh(size, seg, hf, colf) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (size / 2), 1.7) * (size / 2) / r0 : 0; x *= kk; z *= kk;
    const y = hf(x, z); p.setXYZ(i, x, y, z); colf(x, z, y, c); cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, FLAT);
}
// a cylinder between two points (pipes, struts, branches)
function pipe(k, a, b, r, col, seg = 5) {
  const d = _d.subVectors(b, a), L = d.length(); if (L < 1e-4) return;
  const g = new THREE.CylinderGeometry(r, r, L, seg); g.translate(0, L / 2, 0);
  g.applyQuaternion(_q.setFromUnitVectors(UP, d.normalize())); g.translate(a.x, a.y, a.z); k.add(g, col);
}

// ---------- Chalk drawings in the air ----------
// Dots along strokes (lists of [x, y] in metres, in the drawing's own flat plane, which faces you).
// They draw themselves in stroke order (drawRange), so a drawing appears line by line. One draw call each.
function chalkMat(color, additive) {
  return new THREE.ShaderMaterial({
    uniforms: { scale: { value: 300 }, color: { value: new THREE.Color(color) }, opacity: { value: 0 } },
    vertexShader: `attribute float size; attribute float b; varying float vB; uniform float scale;
      void main(){ vB = b; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float sc = length(modelMatrix[0].xyz); gl_PointSize = clamp(size * sc * scale / max(0.1, -mv.z), 1.5, 40.0); }`,
    fragmentShader: additive
      ? `uniform vec3 color; uniform float opacity; varying float vB; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, r); gl_FragColor = vec4(color * vB * a * opacity * 1.3, 1.0); }`
      : `uniform vec3 color; uniform float opacity; varying float vB; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.2, r); gl_FragColor = vec4(color * (0.75 + 0.25 * vB), a * opacity); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
  });
}
class Sketch {
  constructor(parent, strokes, { spacing = 0.02, dot = 0.02, color = 0xdfeaff, additive = true, secs = 2, seed = 1 } = {}) {
    const r = rng(seed * 7 + 3), P = [], S = [], Bv = [];
    for (const st of strokes) for (let i = 1; i < st.length; i++) {
      const [x0, y0] = st[i - 1], [x1, y1] = st[i], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / spacing));
      for (let j = 0; j < n; j++) { const f = j / n; P.push(x0 + (x1 - x0) * f + (r() - 0.5) * spacing * 0.6, y0 + (y1 - y0) * f + (r() - 0.5) * spacing * 0.6, 0); S.push(dot * (0.7 + 0.6 * r())); Bv.push(0.65 + 0.35 * r()); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('size', new THREE.Float32BufferAttribute(S, 1)); g.setAttribute('b', new THREE.Float32BufferAttribute(Bv, 1));
    this.n = S.length; this.pts = new THREE.Points(g, chalkMat(color, additive)); this.pts.frustumCulled = false;
    this.g = new THREE.Group(); this.g.add(this.pts); this.g.visible = false; parent.add(this.g);
    this.k = 0; this.op = 0; this.secs = secs; this.labels = [];
  }
  addLabel(text, x, y, h, opts) { const l = label(text, h, opts); l.position.set(x, y, 0.01); l.material.opacity = 0; this.g.add(l); this.labels.push(l); return l; }
  place(pos, eye) { this.g.position.copy(pos); this.g.lookAt(eye); return this; }
  update(dt, on, fast = 1, fadeSpeed = 2) {
    if (on) this.k = Math.min(1, this.k + dt * fast / this.secs);
    this.op = damp(this.op, on ? 1 : 0, fadeSpeed, dt);
    this.g.visible = this.op > 0.01;
    if (!this.g.visible) { if (!on) this.k = 0; return; }
    this.pts.geometry.setDrawRange(0, Math.floor(this.n * this.k));
    this.pts.material.uniforms.opacity.value = this.op;
    for (const l of this.labels) l.material.opacity = this.op * clamp01(this.k * 3 - 2);
  }
}
const circ = (cx, cy, r, a0 = 0, a1 = Math.PI * 2, n = 48, sy = 1) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy]; });
const quad = (p0, c, p1, n = 30) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; });
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
// a rocket outline from a profile of [height, radius] pairs, with fins and a few flame flicks
function outline(prof, fins = [], flame = 0) {
  const L = prof.map(([y, r]) => [-r, y]), R = prof.map(([y, r]) => [r, y]);
  const st = [L, R, [[-prof[0][1], prof[0][0]], [prof[0][1], prof[0][0]]]];
  for (let i = 1; i < prof.length - 1; i++) if (prof[i][2]) st.push([[-prof[i][1], prof[i][0]], [prof[i][1], prof[i][0]]]);   // stage joints
  for (const f of fins) { st.push(f); st.push(f.map(([x, y]) => [-x, y])); }
  if (flame) { const w = prof[0][1]; for (let i = -2; i <= 2; i++) st.push(quad([i * w * 0.3, 0], [i * w * 0.5, -flame * 0.5], [i * w * 0.15, -flame * (0.8 + 0.2 * Math.cos(i))], 10)); }
  return st;
}

// ---------- Soft puffs (smoke, vapour, snow bursts, flame glow): one draw call per kind ----------
class Puffs {
  constructor(parent, n, { color = 0xffffff, additive = false, scale = 300 } = {}) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: scale }, color: { value: new THREE.Color(color) } },
      vertexShader: `attribute float size; attribute float alpha; varying float vA; uniform float scale;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(size * scale / max(0.1, -mv.z), 1.0, 500.0); }`,
      fragmentShader: additive
        ? `uniform vec3 color; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(color * a * a * vA, 1.0); }`
        : `uniform vec3 color; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float a = smoothstep(0.5, 0.1, r) * (0.8 + 0.2 * sin(c.x * 17.0 + c.y * 11.0)); gl_FragColor = vec4(color * (0.85 + 0.3 * (0.5 - c.y)), a * vA); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 3; parent.add(this.pts);
    this.p = Array.from({ length: n }, () => ({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, age: 1, life: 1, s0: 1, s1: 1, a: 0, drag: 1, up: 0 }));
    this.i = 0; this.n = n; this.live = 0;
  }
  emit(pos, vel, s0, s1, life, a = 1, drag = 1, up = 0) {
    const q = this.p[this.i]; this.i = (this.i + 1) % this.n;
    q.x = pos.x; q.y = pos.y; q.z = pos.z; q.vx = vel.x; q.vy = vel.y; q.vz = vel.z; q.age = 0; q.life = life; q.s0 = s0; q.s1 = s1; q.a = a; q.drag = drag; q.up = up;
    this.live = 3;
  }
  update(dt) {
    if (this.live <= 0) { this.pts.visible = false; return; }
    this.pts.visible = true; let any = false;
    this.p.forEach((q, i) => {
      if (q.age < q.life) {
        q.age += dt; any = true; const k = Math.exp(-q.drag * dt);
        q.vx *= k; q.vz *= k; q.vy = q.vy * k + q.up * dt;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      }
      const f = clamp01(q.age / q.life);
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.size[i] = q.s0 + (q.s1 - q.s0) * Math.sqrt(f);
      this.alpha[i] = q.age < q.life ? q.a * Math.min(1, f * 8) * (1 - f) : 0;
    });
    if (!any) this.live -= 1;
    for (const k of ['position', 'size', 'alpha']) this.pts.geometry.attributes[k].needsUpdate = true;
  }
}

export default class Rockets {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.A = new THREE.Group(); this.B = new THREE.Group(); this.C = new THREE.Group();
    this.B.visible = this.C.visible = false; this.root.add(this.A, this.B, this.C);
    this.start = { pos: V3(EYE_K.x, 0, EYE_K.z), yaw: 0.8 };
    this.s = {
      scene: 'kaluga', phase: 'arrive', guide: null, hour: 21,
      newton: 0, verne: 0, capsule: 0, nogo: 0,   // ch13_01, ch13_03: the cannons over the roofs
      trumpet: 0, books: 0,                       // ch13_02
      rocket: 0,      // ch13_03: 1 drawn, 2 blasting gas, 3 flying out to the stars
      balloon: 0,     // 1 let go
      eq: 0, train: 0, cradle: 0, station: 0,     // ch13_04
      labels: 0, lox: 0, henry: 0, torch: 0, lit: 0,   // Auburn
      arc: 0, descend: 0, papers: 0, vacuum: 0, correction: 0,
      v2: 0, lights: 0,                           // Peenemünde: 1 erector down, 2 ignition, 3 lift-off
      space: 0, race: 0,                          // 1 the edge of space, 2 the map
      journal: 0,
    };
    this.t = 0;
    this.life = new Life(this.root);
    this.buildKaluga();
    this.buildStudy();
    this.buildSketches();
    this.buildAuburn();
    this.buildGoddardRocket();
    this.buildAuburnExtras();
    this.buildBaltic();
    this.buildV2();
    this.buildSpace();
    this.buildPeople();
    this.journal = new Journal(this, drawJournal);
    this.registerInteractables();
    this.setScene('kaluga');
  }

  setScene(name) {
    const G = this.G; this.cur = name;
    this.A.visible = name === 'kaluga'; this.B.visible = name === 'auburn'; this.C.visible = name === 'baltic';
    if (name === 'kaluga') {
      G.world.height = kalugaHeight; G.world.bounds = 2.1; G.world.blockers = this.blockK;
      G.sky.fogFar = 1400; G.sky.mist = 0.12; this.lat = LAT_K; this.sl = SL_K;
      G.sky.setPlace({ lat: LAT_K, year: 1903, sunLon: SL_K });
    } else if (name === 'auburn') {
      G.world.height = auburnHeight; G.world.bounds = 7; G.world.blockers = [{ x: FRAME.x, z: FRAME.z, r: 0.7 }, { x: 4.3, z: 2.9, r: 1.0 }, { x: 4.3, z: -1.5, r: 0.4 }];
      G.sky.fogFar = 2600; G.sky.mist = 0; this.lat = LAT_A; this.sl = SL_A;
      G.sky.setPlace({ lat: LAT_A, year: 1926, sunLon: SL_A });
      G.sky.hideMoon();
    } else {
      G.world.height = balticHeight; G.world.bounds = 3; G.world.blockers = [];
      G.sky.fogFar = 700; G.sky.mist = 0.45; this.lat = LAT_P; this.sl = SL_P;
      G.sky.setPlace({ lat: LAT_P, year: 1944, sunLon: SL_P });
      G.sky.hideMoon();
    }
  }

  // ---------- 1. Kaluga: the yard, the street, the town on the high bank of the Oka ----------
  buildKaluga() {
    const k = new Kit(), r = rng(5), A = this.A, wins = [];
    A.add(groundMesh(3000, 160, kalugaHeight, (x, z, y, c) => {
      c.setHex(0xb8c4d6).lerp(_col.setHex(0xe4eaf2), N2(x / 12, z / 12));
      if (z < -250 && z > -330) c.setHex(0x98a8ba).lerp(_col.setHex(0xb8c6d4), N1(x / 30, z / 8));   // the frozen Oka
      if (Math.abs(z + 32) < 3.5 && Math.abs(x) < 220) c.lerp(_col.setHex(0x8a8a96), 0.35 + 0.2 * Math.sin(x * 2.1));   // sledge tracks
    }));
    // our yard: a picket fence, birches, a woodpile, a well, a sledge
    const fence = (x0, z0, x1, z1, gap) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.28), yaw = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i <= n; i++) { const f = i / n, x = lerp(x0, x1, f), z = lerp(z0, z1, f); if (gap && Math.abs(x - gap) < 1.3) continue; const y = kalugaHeight(x, z); k.box(0.1, 1.25, 0.03, 0x7a6a58, [x, y + 0.62, z], [0, yaw, 0]); k.box(0.12, 0.06, 0.06, 0xeef2f8, [x, y + 1.27, z], [0, yaw, 0]); }
      for (const h of [0.35, 0.95]) for (let s = 0; s < 4; s++) { const f0 = s / 4, f1 = (s + 1) / 4, xa = lerp(x0, x1, f0), za = lerp(z0, z1, f0), xb = lerp(x0, x1, f1), zb = lerp(z0, z1, f1); pipe(k, V3(xa, kalugaHeight(xa, za) + h, za), V3(xb, kalugaHeight(xb, zb) + h, zb), 0.035, 0x5a4a3a, 4); }
    };
    fence(-16, -20, 16, -20, 3); fence(-16, -20, -16, 12); fence(16, -20, 16, -6);
    const birch = (x, z, s) => {
      const y = kalugaHeight(x, z);
      k.cyl(0.11 * s, 0.17 * s, 9 * s, 6, 0xe8e6e0, [x, y + 4.5 * s, z]);
      for (let i = 0; i < 7; i++) k.box(0.2 * s, 0.05, 0.04, 0x2a2622, [x + 0.12 * s, y + 0.6 + r() * 7 * s, z + (r() - 0.5) * 0.1], [0, r() * 3, 0]);
      for (let i = 0; i < 9; i++) { const b = r() * 6.28, h0 = (3.5 + r() * 5) * s; pipe(k, V3(x, y + h0, z), V3(x + Math.cos(b) * 2.2 * s, y + h0 + 1.8 * s, z + Math.sin(b) * 2.2 * s), 0.03 * s, 0x4a3a34, 4); }
    };
    birch(-8, -12, 1.1); birch(-11, -4, 0.95); birch(9, -15, 1.2); birch(-6, -26, 1);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 12; i++) k.cyl(0.11, 0.11, 1.1, 6, i % 3 ? 0x8a6a48 : 0x9a7a52, [-15.3, kalugaHeight(-15, -10) + 0.12 + j * 0.21, -14 + i * 0.23 + (j % 2) * 0.1], [0, 0, Math.PI / 2]);
    k.box(0.9, 0.05, 2.9, 0xeef2f8, [-15.3, kalugaHeight(-15, -10) + 0.98, -11.5]);
    const wy = kalugaHeight(-6, -7); k.cyl(0.6, 0.6, 0.8, 8, 0x6a5a48, [-6, wy + 0.4, -7]); k.box(0.08, 1.6, 0.08, 0x4a3a2a, [-6.6, wy + 0.8, -7]); k.box(0.08, 1.6, 0.08, 0x4a3a2a, [-5.4, wy + 0.8, -7]); k.add(gableRoof(1.6, 1.2, 0.5, 0.1), 0xeef2f8, [-6, wy + 1.6, -7]);
    k.box(0.5, 0.25, 1.4, 0x6a4a2a, [-3.5, kalugaHeight(-3.5, -4) + 0.2, -4], [0, 0.4, 0]);
    // the street of log houses (gables to the street, snow on the roofs), and more down the slope
    const WALLS = [0x6a4a30, 0x5a3e28, 0x4a6a8a, 0x5a7a5a, 0x7a5a3a, 0x8a7a5a];
    for (let x = -200; x <= 200; x += 15 + r() * 4) {
      if (Math.abs(x) < 3) continue;
      house(k, { x, y: kalugaHeight(x, -46), z: -46, w: 7 + r() * 2, d: 9, h: 3.4 + r() * 0.8, yaw: 0, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: 0xdfe6ee, gableFront: true }, wins);
      if (Math.abs(x) > 22) house(k, { x, y: kalugaHeight(x, -18), z: -18, w: 7 + r() * 2, d: 9, h: 3.4, yaw: Math.PI, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: 0xdfe6ee, gableFront: true }, wins);
    }
    for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 520, z = -70 - r() * 170; if (Math.hypot(x - 90, z + 130) < 30) continue; house(k, { x, y: kalugaHeight(x, z), z, w: 6 + r() * 3, d: 8, h: 3.2, yaw: Math.round(r() * 4) * Math.PI / 2, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: 0xdfe6ee, gableFront: r() < 0.7 }, wins);
    }
    // carved white window frames round every window
    for (const w of wins) { const n = _a.set(Math.sin(w.yaw), 0, Math.cos(w.yaw)); k.box(0.8, 1.05, 0.03, 0xe8e2d6, w.p.clone().addScaledVector(n, -0.01).toArray(), [0, w.yaw, 0]); k.box(0.95, 0.12, 0.05, 0xe8e2d6, w.p.clone().addScaledVector(n, 0.01).add(_b.set(0, 0.6, 0)).toArray(), [0, w.yaw, 0]); }
    // the cathedral on the hill: white walls, a great drum and gold onion domes, a bell tower
    const cx = 90, cz = -130, cy = kalugaHeight(cx, cz), GOLD = 0xd8b040, WH = 0xe8e4dc;
    k.box(22, 14, 22, WH, [cx, cy + 7, cz]); k.cyl(6, 6, 7, 16, WH, [cx, cy + 17.5, cz]);
    k.ball(6.4, 1, 0x4a7a6a, [cx, cy + 22.5, cz], 0, [1, 0.8, 1]); k.ball(1.3, 1, GOLD, [cx, cy + 28, cz], 0, [1, 1.4, 1]); k.cyl(0.08, 0.08, 4, 4, GOLD, [cx, cy + 31, cz]);
    for (const [ox, oz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { k.cyl(1.8, 1.8, 4, 10, WH, [cx + ox, cy + 16, cz + oz]); k.ball(2, 1, GOLD, [cx + ox, cy + 19.5, cz + oz], 0, [1, 1.3, 1]); k.cyl(0.001, 0.4, 2.2, 6, GOLD, [cx + ox, cy + 22, cz + oz]); }
    k.box(8, 30, 8, WH, [cx - 28, cy + 15, cz + 10]); k.cyl(3, 3, 6, 8, WH, [cx - 28, cy + 33, cz + 10]); k.ball(2.6, 1, GOLD, [cx - 28, cy + 38, cz + 10], 0, [1, 1.5, 1]); k.cyl(0.001, 0.6, 5, 6, GOLD, [cx - 28, cy + 43, cz + 10]);
    for (let i = 0; i < 5; i++) wins.push({ p: V3(cx - 8 + i * 4, cy + 6, cz + 11.03), yaw: 0 });
    // pines on the far bank, and along the slope
    for (let i = 0; i < 420; i++) {
      const x = (r() - 0.5) * 1600, z = -340 - r() * 500, y = kalugaHeight(x, z), s = 0.8 + r() * 0.8;
      k.cyl(0.001, 2.6 * s, 9 * s, 6, 0x1c2a22, [x, y + 6 * s, z]); k.cyl(0.001, 2.0 * s, 4 * s, 6, 0xd8e0ea, [x, y + 9.6 * s, z]);
    }
    A.add(k.mesh());
    A.add(windows(wins, { lit: 0.6, seed: 4, warm: 0xffb85a }));
    this.smokesK = [[-30, 9, -48], [24, 9, -48], [60, 9, -48], [-75, 9, -48], [-45, 2, -120], [30, -5, -170]].map(([x, y, z]) => { const sm = makeSmoke(V3(x, kalugaHeight(x, z) + y, z), { n: 6, rise: 9, size: 1.3, opacity: 0.13, color: 0x9aa0b0, wind: [0.5, 0.1] }); A.add(sm.group); return sm; });
    // snow falling outside (not in the room)
    const SN = 900, sp = new Float32Array(SN * 3); this.snowV = [];
    for (let i = 0; i < SN; i++) { let x, z; do { x = (Math.random() - 0.5) * 50; z = (Math.random() - 0.5) * 50; } while (Math.abs(x) < RX + 0.3 && Math.abs(z) < RZ + 0.3); sp.set([x, -1 + Math.random() * 13, z], i * 3); this.snowV.push(0.5 + Math.random() * 0.6); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3).setUsage(THREE.DynamicDrawUsage));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, map: glowTexture(), transparent: true, opacity: 0.85, depthWrite: false })); this.snow.frustumCulled = false; A.add(this.snow);
    // a horse pulling along the street, a dog in the yard
    this.horsesK = this.life.add(makeHerd('horse', { n: 2, area: { x: 0, z: -32, r: 70 }, mode: 'migrate', dir: [1, 0], height: kalugaHeight, seed: 6 })); A.add(this.horsesK.group);
    this.dogK = this.life.add(makeHerd('dog', { n: 1, area: { x: -4, z: -10, r: 3 }, height: kalugaHeight, seed: 3 })); A.add(this.dogK.group);
  }

  // ---------- Tsiolkovsky's veranda study ----------
  buildStudy() {
    const k = new Kit(), r = rng(13), A = this.A, LOG = 0x7a5232, LOG2 = 0x6c4a2c, FR = 0xe8e2d4;
    for (let i = 0; i < 11; i++) k.box(0.47, 0.06, RZ * 2, i % 2 ? 0x8a6a46 : 0x7e603e, [-RX + 0.24 + i * 0.47, -0.03, 0]);
    k.box(2.2, 0.01, 1.4, 0x8a2a24, [0.2, 0.005, 0.2]); k.box(1.9, 0.012, 1.1, 0xc89a40, [0.2, 0.006, 0.2]); k.box(1.5, 0.014, 0.7, 0x3a4a6a, [0.2, 0.007, 0.2]);
    // log walls (south and east), with the corner ends sticking out
    for (let i = 0; i < 12; i++) {
      const y = 0.12 + i * 0.235, c = i % 2 ? LOG : LOG2;
      k.cyl(0.13, 0.13, RX * 2 + 0.5, 7, c, [0, y, RZ + 0.05], [0, 0, Math.PI / 2]);
      k.cyl(0.13, 0.13, RZ * 2 + 0.5, 7, c, [RX + 0.05, y + 0.11, 0], [Math.PI / 2, 0, 0]);
    }
    // the glazed walls (north and west): a log sill, white frames, many small panes
    for (let i = 0; i < 3; i++) { const y = 0.12 + i * 0.235; k.cyl(0.13, 0.13, RX * 2 + 0.5, 7, LOG2, [0, y, -RZ - 0.05], [0, 0, Math.PI / 2]); k.cyl(0.13, 0.13, RZ * 2 + 0.5, 7, LOG, [-RX - 0.05, y + 0.11, 0], [Math.PI / 2, 0, 0]); }
    k.box(RX * 2, 0.05, 0.34, FR, [0, 0.82, -RZ + 0.06]); k.box(0.34, 0.05, RZ * 2, FR, [-RX + 0.06, 0.82, 0]);
    for (let i = 0; i <= 8; i++) k.box(0.07, RH - 0.8, 0.09, FR, [-RX + i * RX * 2 / 8, 0.8 + (RH - 0.8) / 2, -RZ]);
    for (let i = 0; i <= 7; i++) k.box(0.09, RH - 0.8, 0.07, FR, [-RX, 0.8 + (RH - 0.8) / 2, -RZ + i * RZ * 2 / 7]);
    for (const y of [1.55, 2.3]) { k.box(RX * 2, 0.04, 0.05, FR, [0, y, -RZ]); k.box(0.05, 0.04, RZ * 2, FR, [-RX, y, 0]); }
    k.box(RX * 2 + 0.3, 0.12, 0.2, FR, [0, RH, -RZ]); k.box(0.2, 0.12, RZ * 2 + 0.3, FR, [-RX, RH, 0]);
    // the ceiling: boards and beams
    k.box(RX * 2 + 0.5, 0.1, RZ * 2 + 0.5, 0x5a4230, [0, RH + 0.1, 0]);
    for (let i = 0; i < 5; i++) k.box(RX * 2, 0.16, 0.16, 0x4a3420, [0, RH - 0.02, -RZ + 0.4 + i * 0.9]);
    // a geranium pot on the sill
    for (const x of [1.4, 2.0]) { k.cyl(0.07, 0.05, 0.12, 8, 0xa0502a, [x, 0.9, -RZ + 0.08]); k.ball(0.09, 0, 0x2a5a2a, [x, 1.02, -RZ + 0.08]); for (let j = 0; j < 4; j++) k.ball(0.03, 0, 0xd02a2a, [x + (r() - 0.5) * 0.1, 1.08 + r() * 0.05, -RZ + 0.08 + (r() - 0.5) * 0.08]); }
    // the desk against the north windows, piled with papers and books; a chair
    const dx = -0.9, dz = -1.62, WOOD = 0x5a3a22;
    k.box(1.5, 0.05, 0.72, WOOD, [dx, 0.78, dz]); for (const [ox, oz] of [[-0.68, -0.3], [0.68, -0.3], [-0.68, 0.3], [0.68, 0.3]]) k.box(0.05, 0.78, 0.05, 0x3a2416, [dx + ox, 0.39, dz + oz]);
    k.box(0.4, 0.6, 0.65, WOOD, [dx + 0.5, 0.45, dz]);
    for (let i = 0; i < 16; i++) k.box(0.21, 0.003, 0.29, i % 3 ? 0xece0c0 : 0xd8c8a0, [dx - 0.55 + r() * 0.8, 0.807 + i * 0.002, dz - 0.15 + r() * 0.35], [0, r() * 1.2 - 0.6, 0]);
    for (let i = 0; i < 6; i++) k.box(0.26, 0.05, 0.19, [0x5a2a1a, 0x2a3a4a, 0x4a3a1a, 0x3a2a3a, 0x6a4a2a, 0x2a4a2a][i], [dx + 0.6, 0.83 + i * 0.05, dz - 0.15], [0, r() * 0.3, 0]);
    k.cyl(0.03, 0.035, 0.05, 8, 0x1a1a2a, [dx - 0.1, 0.83, dz - 0.25]); k.cyl(0.003, 0.003, 0.2, 3, 0xe8e0d0, [dx - 0.08, 0.9, dz - 0.24], [0.3, 0, 0.3]);
    k.box(0.45, 0.04, 0.45, WOOD, [dx + 0.1, 0.46, dz + 0.85]); k.box(0.45, 0.5, 0.04, WOOD, [dx + 0.1, 0.72, dz + 1.06]); for (const [ox, oz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) k.box(0.04, 0.46, 0.04, 0x3a2416, [dx + 0.1 + ox, 0.23, dz + 0.85 + oz]);
    // the kerosene lamp (its light is the room's light)
    const lx = dx + 0.45, lz = dz - 0.22;
    k.cyl(0.07, 0.09, 0.03, 10, 0x8a6a2a, [lx, 0.82, lz]); k.cyl(0.02, 0.03, 0.12, 8, 0x8a6a2a, [lx, 0.89, lz]); k.ball(0.07, 1, 0x6a8a6a, [lx, 0.99, lz], 0, [1, 0.8, 1]);
    const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.22, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe0a8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    chim.position.set(lx, 1.15, lz); A.add(chim);
    this.lampFlame = glow(0xffc060, 0.16); this.lampFlame.position.set(lx, 1.1, lz); A.add(this.lampFlame);
    this.lamp = new THREE.PointLight(0xffb060, 3.2, 9, 1.5); this.lamp.position.set(lx, 1.25, lz); A.add(this.lamp);
    // the bookshelf on the east wall
    const bx = RX - 0.22;
    for (let j = 0; j < 5; j++) { k.box(0.3, 0.03, 1.3, WOOD, [bx, 0.3 + j * 0.42, -1.2]); for (let i = 0; i < 12; i++) { const h = 0.24 + r() * 0.1; k.box(0.22, h, 0.05 + r() * 0.04, [0x6a2a1a, 0x2a3a2a, 0x4a3a1a, 0x3a2a3a, 0x5a4a2a, 0x7a6a4a][Math.floor(r() * 6)], [bx, 0.32 + j * 0.42 + h / 2, -1.78 + i * 0.1]); } }
    for (const z of [-1.85, -0.55]) k.box(0.3, 2.0, 0.03, WOOD, [bx, 1.0, z]);
    // the white tiled stove in the south-east corner, a bench beside it
    const sx = RX - 0.65, sz = RZ - 0.75;
    k.box(1.1, 2.1, 1.3, 0xe8e2d6, [sx, 1.05, sz]); k.box(1.2, 0.1, 1.4, 0xd8d0c0, [sx, 2.12, sz]); k.box(1.16, 0.08, 1.36, 0xd8d0c0, [sx, 0.55, sz]);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) k.box(0.005, 0.12, 0.12, j % 2 ? 0x4a6a9a : 0xd8d0c0, [sx - 0.555, 0.8 + i * 0.22, sz - 0.45 + j * 0.3]);
    k.box(0.02, 0.36, 0.42, 0x1a0e08, [sx - 0.555, 0.45, sz]);
    this.stoveGlow = glow(0xff7a30, 0.5, 0.8); this.stoveGlow.position.set(sx - 0.6, 0.45, sz); A.add(this.stoveGlow);
    this.stoveLight = new THREE.PointLight(0xff7030, 1.2, 4, 1.8); this.stoveLight.position.set(sx - 0.8, 0.5, sz); A.add(this.stoveLight);
    // the chalkboard on the south wall (he was a teacher)
    const board = canvasTex(512, 320, (g, w, h) => {
      g.fillStyle = '#1e2a22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6a4a2a'; g.lineWidth = 16; g.strokeRect(0, 0, w, h);
      g.fillStyle = 'rgba(235,240,230,0.85)'; g.strokeStyle = 'rgba(235,240,230,0.7)'; g.lineWidth = 3; g.font = 'italic 34px Georgia, serif';
      g.fillText('V = c · ln (M₀ / M₁)', 30, 70); g.font = 'italic 22px Georgia, serif'; g.fillText('Исследование мировых пространств', 30, 115); g.fillText('реактивными приборами, 1903', 30, 145);
      g.beginPath(); g.moveTo(330, 280); g.lineTo(420, 170); g.lineTo(440, 190); g.lineTo(350, 300); g.closePath(); g.stroke();
      g.beginPath(); g.arc(150, 240, 50, 0, 6.28); g.stroke(); g.beginPath(); g.ellipse(150, 240, 80, 20, -0.3, 0, 6.28); g.stroke();
    });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshLambertMaterial({ map: board })); bm.rotation.y = Math.PI; bm.position.set(-0.5, 1.55, RZ - 0.1); A.add(bm);
    // a bicycle against the wall (he rode about Kaluga on one)
    for (const ox of [-0.5, 0.5]) k.add(new THREE.TorusGeometry(0.33, 0.02, 5, 20), 0x1a1a1a, [-1.75 + ox, 0.35, RZ - 0.3]);
    pipe(k, V3(-2.25, 0.35, RZ - 0.3), V3(-1.75, 0.75, RZ - 0.3), 0.015, 0x2a3a2a); pipe(k, V3(-1.75, 0.75, RZ - 0.3), V3(-1.25, 0.35, RZ - 0.3), 0.015, 0x2a3a2a); pipe(k, V3(-1.75, 0.35, RZ - 0.3), V3(-1.75, 0.75, RZ - 0.3), 0.015, 0x2a3a2a); pipe(k, V3(-1.35, 0.85, RZ - 0.3), V3(-1.25, 0.35, RZ - 0.3), 0.015, 0x2a3a2a);
    k.box(0.06, 0.02, 0.5, 0x2a2a2a, [-1.35, 0.88, RZ - 0.3]); k.box(0.18, 0.04, 0.08, 0x3a2a1a, [-1.8, 0.8, RZ - 0.3]);
    // a samovar on a little table by the stove
    k.box(0.6, 0.04, 0.5, WOOD, [1.95, 0.7, 0.15]); for (const [ox, oz] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) k.box(0.04, 0.7, 0.04, 0x3a2416, [1.95 + ox, 0.35, 0.15 + oz]);
    k.cyl(0.1, 0.13, 0.05, 10, 0xc8902a, [1.95, 0.75, 0.15]); k.ball(0.15, 1, 0xd8a03a, [1.95, 0.93, 0.15], 0, [1, 1.2, 1]); k.cyl(0.04, 0.06, 0.12, 8, 0xc8902a, [1.95, 1.14, 0.15]); k.ball(0.06, 0, 0xf0f0f0, [1.95, 1.24, 0.15]);
    k.box(0.1, 0.02, 0.02, 0xc8902a, [1.8, 0.86, 0.15]); for (const ox of [-0.18, 0.18]) k.cyl(0.035, 0.03, 0.07, 8, 0xe8e8f0, [1.95 + ox, 0.76, 0.0]);
    A.add(k.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    // his tin model airship, hanging from the beams
    const ak = new Kit(); ak.ball(0.5, 2, 0xb8c0c8, [0, 0, 0], 0, [1, 0.24, 0.24]);
    for (let i = -4; i <= 4; i++) { const rr = 0.12 * Math.sqrt(1 - (i / 4.5) ** 2); ak.add(new THREE.TorusGeometry(rr, 0.004, 4, 16), 0x8a9098, [i * 0.1, 0, 0], [0, Math.PI / 2, 0]); }
    ak.box(0.16, 0.04, 0.05, 0x8a7a5a, [0, -0.15, 0]); for (const sx2 of [-1, 1]) pipe(ak, V3(sx2 * 0.2, 0, 0), V3(sx2 * 0.1, 0.55, 0), 0.002, 0x2a2a2a, 3);
    this.airship = ak.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.4 })); this.airship.position.set(-0.2, RH - 0.45, -1.0); this.airship.scale.setScalar(0.6); A.add(this.airship);
    // the cat on the windowsill
    const ck = new Kit(), CAT = 0x5a5a5e;
    ck.ball(0.09, 1, CAT, [0, 0.08, 0], 0, [1, 0.9, 1.5]); ck.ball(0.06, 1, CAT, [0, 0.18, 0.13]);
    for (const s2 of [-1, 1]) { ck.cyl(0.001, 0.025, 0.05, 4, CAT, [s2 * 0.035, 0.24, 0.13]); ck.box(0.012, 0.012, 0.005, 0xd8c040, [s2 * 0.022, 0.19, 0.185]); }
    this.cat = new THREE.Group(); this.catBody = ck.mesh(); this.cat.add(this.catBody);
    const tk = new Kit(); tk.cyl(0.012, 0.016, 0.22, 5, CAT, [0, 0.11, 0]); this.catTail = tk.mesh(); this.catTail.position.set(0, 0.06, -0.12); this.catTail.rotation.x = -1.9; this.cat.add(this.catTail);
    this.catHome = V3(0.7, 0.845, -RZ + 0.12); this.cat.position.copy(this.catHome); this.cat.rotation.y = 0.6; A.add(this.cat);
    // his ear trumpet, and a red balloon
    const et = new Kit(); et.cyl(0.07, 0.012, 0.3, 12, 0xb0a070, [0, 0.15, 0]); et.cyl(0.012, 0.012, 0.15, 6, 0x8a7a50, [0, -0.06, 0]);
    this.trumpetM = et.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.35 }));
    this.balloonM = new THREE.Group();
    const bl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshLambertMaterial({ color: 0xd02a2a, emissive: 0x3a0505 })); bl.scale.set(1, 1.18, 1); bl.position.y = 0.16; this.balloonM.add(bl);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 6), bl.material); knot.position.y = 0.02; this.balloonM.add(knot);
    // books that fly off the shelf (ch13_02)
    this.flyBooks = [];
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.04), new THREE.MeshLambertMaterial({ color: [0x6a2a1a, 0x2a3a5a, 0x4a3a1a, 0x3a2a4a, 0x5a4a2a, 0x2a4a2a][i], emissive: 0x221a08 })); const home = V3(RX - 0.22, 0.48 + (i % 4) * 0.42, -1.65 + i * 0.16); m.position.copy(home); m.rotation.y = Math.PI / 2; m.userData.home = home; A.add(m); this.flyBooks.push(m); }
    this.bookGlow = glow(0xffe0a0, 1.2, 0); A.add(this.bookGlow);
    this.blockK = [{ x: dx, z: dz, r: 0.85 }, { x: sx, z: sz, r: 0.8 }, { x: 1.95, z: 0.15, r: 0.4 }, { x: bx, z: -1.2, r: 0.3 }, { x: dx + 0.1, z: dz + 0.85, r: 0.3 }];
  }

  // ---------- the chalk drawings ----------
  buildSketches() {
    const A = this.A, sk = this.sk = {}, eye = EYE_K;
    // where the Moon hangs (first quarter, over the west)
    this.moonAz = 255; this.moonEl = 17;
    // Newton's cannon on a mountain on the round Earth (last chapter), out over the roofs
    const nS = [circ(0, 0, 4, 0, 6.29, 80), [[-0.9, 3.9], [0, 5], [0.9, 3.9]], [[0.1, 5.05], [0.9, 5.25]], quad([0.9, 5.2], [1.8, 5.3], [1.7, 3.66]), quad([0.9, 5.2], [3.6, 5.4], [3.46, 2.0]), quad([0.9, 5.2], [5.8, 4.8], [3.76, -1.37]), circ(0, 0, 5.2, Math.PI / 2, Math.PI / 2 - 6.28, 90)];
    sk.newton = new Sketch(A, nS, { spacing: 0.08, dot: 0.3, secs: 4.5, seed: 1 }).place(at(332, 34, 9).add(eye), eye);
    sk.newton.addLabel('Newton: fast enough, and it never comes down', 0, -5.2, 0.7);
    // Jules Verne's Moon cannon (1865): a giant barrel aimed at the Moon
    const vpos = at(318, 30, 8).add(eye), vg = new THREE.Object3D(); vg.position.copy(vpos); vg.lookAt(eye); vg.updateMatrixWorld();
    const moonW = at(this.moonAz, 900, 900 * Math.tan(this.moonEl * D2R)).add(eye), ml = vg.worldToLocal(moonW.clone()); const dl = V3(ml.x, ml.y, 0).normalize();
    const px = -dl.y, py = dl.x, bL = 11, bw = 0.9, bx0 = 2, by0 = -3;
    const bar = (s, t) => [bx0 + dl.x * s + px * t, by0 + dl.y * s + py * t];
    const vS = [[bar(0, -bw), bar(bL, -bw * 0.8)], [bar(0, bw), bar(bL, bw * 0.8)], circ(...bar(bL, 0), bw * 0.85, 0, 6.29, 24, 0.5).map(([x, y]) => [x, y]), [bar(0, -bw), bar(-0.6, 0), bar(0, bw)], quad([bx0 - 6, by0 - 1.5], [bx0, by0 + 1.5], [bx0 + 6, by0 - 1.5]), circ(bx0 - 1.4, by0 - 0.6, 1.1), circ(bx0 + 1.6, by0 - 0.6, 1.1)];
    for (let i = 1; i < 6; i++) vS.push([bar(i * 1.8, -bw * 0.95), bar(i * 1.8, bw * 0.95)]);
    sk.verne = new Sketch(A, vS, { spacing: 0.08, dot: 0.3, secs: 3, seed: 2 }); sk.verne.g.position.copy(vpos); sk.verne.g.quaternion.copy(vg.quaternion);
    sk.verne.addLabel('Jules Verne, 1865: From the Earth to the Moon', bx0, by0 - 2.8, 0.7);
    // an open book beside it
    sk.verne.book = new Sketch(sk.verne.g, [quad([-9, 4], [-7.5, 4.8], [-6, 4]), quad([-6, 4], [-4.5, 4.8], [-3, 4]), [[-9, 4], [-9, 1.6]], [[-3, 4], [-3, 1.6]], quad([-9, 1.6], [-7.5, 2.4], [-6, 1.6]), quad([-6, 1.6], [-4.5, 2.4], [-3, 1.6]), [[-6, 4], [-6, 1.6]], [[-8.4, 3.4], [-6.6, 3.5]], [[-8.4, 2.9], [-6.6, 3.0]], [[-5.4, 3.5], [-3.6, 3.4]], [[-5.4, 3.0], [-3.6, 2.9]]], { spacing: 0.07, dot: 0.18, secs: 1.5, seed: 9 });
    // the travellers' capsule, shot out at the Moon
    sk.capsule = new Sketch(A, [[[-0.35, -0.6], [-0.35, 0.3], [0, 0.85], [0.35, 0.3], [0.35, -0.6], [-0.35, -0.6]], circ(0, 0, 0.14, 0, 6.29, 12)], { spacing: 0.05, dot: 0.16, secs: 0.4, seed: 3 });
    this.capFrom = vg.localToWorld(V3(...bar(bL, 0), 0)); this.capDir = moonW.clone().sub(this.capFrom).normalize(); this.capQ = new THREE.Quaternion();
    // a red cross over the cannon: it would never work
    sk.nogo = new Sketch(sk.verne.g, [[[bx0 - 4, by0 - 3], [bx0 + 10, by0 + 9]], [[bx0 - 4, by0 + 9], [bx0 + 10, by0 - 3]]], { spacing: 0.08, dot: 0.3, color: 0xff6050, secs: 0.8, seed: 4 });
    // Tsiolkovsky's rocket (1903): a long body, liquid hydrogen and oxygen tanks, the pilot up front, the nozzle behind
    const rS = [[[-0.11, 0.3], [-0.11, 1.35], [-0.06, 1.62], [0, 1.72], [0.06, 1.62], [0.11, 1.35], [0.11, 0.3]], [[-0.11, 0.3], [-0.05, 0.22], [-0.16, 0.0], [0.16, 0.0], [0.05, 0.22], [0.11, 0.3]],
      rect(-0.08, 0.95, 0.08, 1.3), rect(-0.08, 0.55, 0.08, 0.9), circ(0, 1.45, 0.04, 0, 6.29, 14), [[0, 1.37], [0, 1.31]], [[-0.03, 1.33], [0.03, 1.33]], [[0, 0.55], [0, 0.32]], [[-0.03, 0.9], [-0.03, 0.4], [0, 0.32]]];
    sk.rocket = new Sketch(A, rS, { spacing: 0.006, dot: 0.012, secs: 3, seed: 5 }).place(V3(-1.8, 1.2, 0.5), eye.clone().setY(1.2));
    sk.rocket.addLabel('liquid hydrogen', 0.36, 1.12, 0.075); sk.rocket.addLabel('liquid oxygen', 0.33, 0.72, 0.075);
    this.rocketHome = { pos: sk.rocket.g.position.clone(), q: sk.rocket.g.quaternion.clone() };
    this.rocketSky = at(318, 60, 40).add(eye);
    // the rocket equation
    sk.eq = new Sketch(A, [], { secs: 0.1 }); sk.eq.g.position.set(-0.9, 2.3, -1.45); sk.eq.g.lookAt(eye);
    sk.eq.addLabel('V = c · ln (M₀ / M₁)', 0, 0, 0.12, { color: '#eef4ff', glowCol: 'rgba(150,190,255,0.8)' }); sk.eq.addLabel('how fast it can go: more fuel, faster', 0, -0.13, 0.05);
    // the rocket train: four rockets end to end, each dropping off when its fuel is gone
    this.stages = [0, 1, 2, 3].map((i) => {
      const s = new Sketch(A, [rect(-0.07, i * 0.36, 0.07, i * 0.36 + 0.3), i === 3 ? [[-0.07, 1.38], [0, 1.5], [0.07, 1.38]] : [[-0.07, i * 0.36 + 0.3], [-0.03, i * 0.36 + 0.36]], [[0.07, i * 0.36 + 0.3], [0.03, i * 0.36 + 0.36]], [[-0.05, i * 0.36], [-0.09, i * 0.36 - 0.05]], [[0.05, i * 0.36], [0.09, i * 0.36 - 0.05]]], { spacing: 0.006, dot: 0.011, secs: 0.6, seed: 10 + i });
      s.place(V3(-2.1, 1.05, -1.25), eye.clone().setY(1.6)); s.home = s.g.position.clone(); return s;
    });
    this.stages[0].addLabel('a "rocket train"', 0, -0.12, 0.05);
    // the cradle, with the Earth in it
    const cS = [quad([-0.42, 0.05], [0, -0.22], [0.42, 0.05]), quad([-0.36, 0.0], [0, -0.16], [0.36, 0.0]), [[-0.33, 0.0], [-0.3, 0.3]], [[0.33, 0.0], [0.3, 0.3]], [[-0.3, 0.3], [0.3, 0.3]], circ(0, 0.2, 0.15, 0, 6.29, 40), quad([-0.08, 0.27], [-0.02, 0.3], [0.02, 0.22]), quad([0.03, 0.15], [0.1, 0.12], [0.07, 0.08]), quad([-0.1, 0.12], [-0.04, 0.1], [-0.06, 0.06])];
    sk.cradle = new Sketch(A, cS, { spacing: 0.006, dot: 0.012, secs: 2, seed: 6 }).place(V3(-0.2, 1.65, -1.65), eye);
    sk.cradle.addLabel('"The Earth is the cradle of humanity,', 0, 0.66, 0.1); sk.cradle.addLabel('but we cannot stay in the cradle forever."', 0, 0.54, 0.1);
    sk.cradle.addLabel('Земля — колыбель человечества, но нельзя вечно жить в колыбели.', 0, -0.32, 0.055, { color: '#cfe0ff' });
    // a station in space, far out in the stars: a turning wheel
    sk.station = new Sketch(A, [circ(0, 0, 5, 0, 6.29, 60, 0.4), circ(0, 0, 4.3, 0, 6.29, 60, 0.4), circ(0, 0, 0.8, 0, 6.29, 20, 0.4), [[-4.6, 0], [4.6, 0]], [[0, -1.85], [0, 1.85]], [[-3.3, -1.3], [3.3, 1.3]], [[-3.3, 1.3], [3.3, -1.3]]], { spacing: 0.1, dot: 0.25, secs: 2.5, seed: 7 }).place(at(338, 60, 44).add(eye), eye);
    sk.station.addLabel('a home in space', 0, -3, 0.9);
    // dots of gas blasting out of the chalk rocket
    this.exhK = new Puffs(A, 160, { color: 0xbfd6ff, additive: true });
  }

  // ---------- 2. Auburn: Aunt Effie's farm, the field, the cabbage patch ----------
  buildAuburn() {
    const k = new Kit(), r = rng(21), B = this.B, wins = [];
    B.add(groundMesh(2600, 160, auburnHeight, (x, z, y, c) => {
      c.setHex(0xe4e8ee).lerp(_col.setHex(0xd0d6e0), N2(x / 5, z / 5));
      const bare = N1(x / 14 + 3, z / 14) + (N2(x / 3, z / 3) - 0.5) * 0.3; if (bare > 0.62) c.lerp(_col.setHex(0x8a7a58), clamp((bare - 0.62) * 6, 0, 0.85));
      if (Math.abs(z - 34 - Math.sin(x / 40) * 4) < 2.2) c.lerp(_col.setHex(0x7a6a52), 0.6);   // the road
      if (Math.abs(x - LAND.x) < 11 && Math.abs(z - LAND.z) < 9 && Math.sin((x - LAND.x) * 2.2) > 0.2) c.lerp(_col.setHex(0x5a4a3a), 0.7);   // the furrows
    }));
    // stone walls round the fields
    const wall = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.7); for (let i = 0; i < n; i++) { const x = lerp(x0, x1, i / n), z = lerp(z0, z1, i / n), s = 0.35 + r() * 0.25; k.ball(s, 0, [0x8a8a86, 0x7a7670, 0x9a968e][i % 3], [x + (r() - 0.5) * 0.3, auburnHeight(x, z) + s * 0.5, z + (r() - 0.5) * 0.3], [r(), r(), r()], [1.3, 0.8, 1]); if (r() < 0.5) k.ball(s * 0.7, 0, 0x8a8680, [x, auburnHeight(x, z) + s * 1.1, z], [r(), r(), r()]); } };
    wall(-90, -75, 70, -75); wall(-90, -75, -90, 28); wall(70, -75, 70, 28); wall(-90, 28, -10, 28); wall(10, 28, 70, 28);
    // the cabbage patch: rows of frost-bitten cabbages, a few posts
    for (let i = 0; i < 9; i++) for (let j = 0; j < 12; j++) { const x = LAND.x - 9.5 + i * 2.3 + (r() - 0.5) * 0.3, z = LAND.z - 8 + j * 1.35, y = auburnHeight(x, z); k.ball(0.28, 1, [0x6a8a6a, 0x5a7a62, 0x7a9a7a][(i + j) % 3], [x, y + 0.16, z], [r(), r(), r()], [1, 0.7, 1]); k.ball(0.18, 0, 0xe8ecf0, [x + 0.05, y + 0.3, z], 0, [1, 0.4, 1]); }
    for (const [x, z] of [[-12, -8], [12, -8], [-12, 8], [12, 8]]) k.box(0.12, 1.3, 0.12, 0x5a4a3a, [LAND.x + x, auburnHeight(LAND.x + x, LAND.z + z) + 0.65, LAND.z + z]);
    // Aunt Effie's farmhouse (white clapboard), the red barn and silo, a shed
    const fx = 52, fz = -40, fy = auburnHeight(fx, fz);
    house(k, { x: fx, y: fy, z: fz, w: 10, d: 8, h: 5.6, yaw: -Math.PI / 2, wall: 0xeeeae0, roofCol: 0x3a3a3e }, wins);
    k.box(3, 0.2, 8, 0xeeeae0, [fx - 5.5, fy + 2.6, fz]); for (const z of [-3.5, 0, 3.5]) k.box(0.15, 2.6, 0.15, 0xeeeae0, [fx - 6.8, fy + 1.3, fz + z]);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) k.box(0.05, 1.2, 0.8, 0x2a3a2a, [fx - 5.03, fy + 1.6 + (i > 1 ? 3 : 0), fz + s * (1.5 + i)]);
    const gx = 68, gz = -12, gy = auburnHeight(gx, gz);
    k.box(16, 7, 11, 0x9a2a20, [gx, gy + 3.5, gz]); k.add(gableRoof(16, 11, 5, 0.4), 0x4a4a4e, [gx, gy + 7, gz]); for (const s of [-1, 1]) k.add(gableWallGeo(11, 5), 0x9a2a20, [gx + s * 7.95, gy + 7, gz], [0, Math.PI / 2, 0]);
    k.box(0.1, 4, 4, 0xe8e4dc, [gx - 8.05, gy + 2, gz]); k.box(0.05, 3.6, 0.15, 0xe8e4dc, [gx - 8.08, gy + 2, gz], [Math.PI / 4, 0, 0]); k.box(0.05, 3.6, 0.15, 0xe8e4dc, [gx - 8.08, gy + 2, gz], [-Math.PI / 4, 0, 0]);
    k.cyl(2.6, 2.6, 12, 14, 0x8a8a8a, [gx + 4, gy + 6, gz - 8]); k.ball(2.6, 1, 0x6a6a70, [gx + 4, gy + 12, gz - 8], 0, [1, 0.6, 1]);
    // a Model T by the house
    const tx = 44, tz = -26, ty = auburnHeight(tx, tz);
    k.box(1.4, 0.6, 2.6, 0x1a1a1e, [tx, ty + 0.9, tz]); k.box(1.3, 0.7, 1.2, 0x1a1a1e, [tx, ty + 1.5, tz + 0.3]); k.box(1.4, 0.06, 1.4, 0x2a2a2e, [tx, ty + 1.88, tz + 0.3]); k.box(0.9, 0.5, 0.9, 0x1a1a1e, [tx, ty + 0.95, tz - 1.6]);
    for (const [ox, oz] of [[-0.75, -1.1], [0.75, -1.1], [-0.75, 1.0], [0.75, 1.0]]) k.add(new THREE.TorusGeometry(0.34, 0.06, 5, 14), 0x2a2a2a, [tx + ox, ty + 0.38, tz + oz], [0, Math.PI / 2, 0]);
    // telegraph poles along the road
    for (let x = -300; x <= 300; x += 40) { const z = 31 + Math.sin(x / 40) * 4, y = auburnHeight(x, z); k.cyl(0.12, 0.15, 8, 5, 0x4a3a2a, [x, y + 4, z]); k.box(1.4, 0.1, 0.1, 0x4a3a2a, [x, y + 7.6, z]); }
    // bare maples and elms, a stand of pines to the west
    for (let i = 0; i < 140; i++) {
      const a = r() * 6.28, d = 40 + r() * 340, x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.hypot(x - LAND.x, z - LAND.z) < 22 || Math.hypot(x - 60, z + 25) < 28) continue;
      const y = auburnHeight(x, z), s = 0.8 + r() * 0.8;
      if (x < -120 && r() < 0.7) { k.cyl(0.2 * s, 0.3 * s, 3 * s, 5, 0x3a2a1c, [x, y + 1.5 * s, z]); k.cyl(0.001, 3 * s, 10 * s, 7, 0x2a3a2a, [x, y + 8 * s, z]); continue; }
      k.cyl(0.15 * s, 0.3 * s, 6 * s, 5, 0x4a3e34, [x, y + 3 * s, z]);
      for (let j = 0; j < 6; j++) { const b = r() * 6.28; pipe(k, V3(x, y + (3.5 + r() * 2) * s, z), V3(x + Math.cos(b) * 3 * s, y + (7 + r() * 2) * s, z + Math.sin(b) * 3 * s), 0.07 * s, 0x4a3e34, 4); }
    }
    // the shelter: a lean-to of boards with a table of instruments, a lantern
    const shx = 4.3, shz = 2.9;
    for (const [ox, oz, h] of [[-1, -0.8, 2.2], [1, -0.8, 2.2], [-1, 0.8, 1.7], [1, 0.8, 1.7]]) k.box(0.1, h, 0.1, 0x6a5038, [shx + ox, h / 2, shz + oz]);
    k.box(2.3, 0.06, 1.9, 0x7a6048, [shx, 2.0, shz], [-0.27, 0, 0]); k.box(2.3, 0.1, 1.95, 0xeef2f6, [shx, 2.07, shz], [-0.27, 0, 0]);
    for (let i = 0; i < 7; i++) k.box(0.3, 1.7, 0.04, i % 2 ? 0x8a6a4a : 0x7a5e40, [shx - 0.95 + i * 0.32, 0.85, shz + 0.85]);
    k.box(1.4, 0.05, 0.6, 0x7a6048, [shx, 0.8, shz + 0.4]); for (const [ox, oz] of [[-0.6, 0.15], [0.6, 0.15], [-0.6, 0.65], [0.6, 0.65]]) k.box(0.05, 0.8, 0.05, 0x4a3a2a, [shx + ox, 0.4, shz + oz]);
    k.box(0.25, 0.18, 0.18, 0x2a2a2a, [shx - 0.4, 0.92, shz + 0.4]); k.box(0.2, 0.12, 0.15, 0x6a3a2a, [shx + 0.1, 0.89, shz + 0.4]); k.cyl(0.02, 0.02, 0.3, 5, 0x8a6a2a, [shx + 0.4, 0.98, shz + 0.4], [0, 0, 1.2]);
    // a sawhorse by you (the torch rests on it)
    for (const s of [-1, 1]) { pipe(k, V3(-0.9 + s * 0.2, 0, 0.0), V3(-0.9, 0.75, 0.2), 0.03, 0x7a6048); pipe(k, V3(-0.9 + s * 0.2, 0, 0.4), V3(-0.9, 0.75, 0.2), 0.03, 0x7a6048); }
    pipe(k, V3(-0.9, 0.75, -0.3), V3(-0.9, 0.75, 0.7), 0.04, 0x8a6a4a);
    // Esther's movie camera on its tripod
    const cxm = 4.3, czm = -1.5;
    for (let i = 0; i < 3; i++) { const a = i / 3 * 6.28; pipe(k, V3(cxm + Math.cos(a) * 0.35, 0, czm + Math.sin(a) * 0.35), V3(cxm, 1.25, czm), 0.015, 0x4a3a2a, 4); }
    k.box(0.22, 0.28, 0.32, 0x1e1e22, [cxm, 1.42, czm]); k.cyl(0.04, 0.05, 0.12, 8, 0x2a2a2e, [cxm - 0.12, 1.42, czm + 0.05], [0, 0, Math.PI / 2]);
    for (const oz of [-0.1, 0.1]) k.cyl(0.11, 0.11, 0.04, 14, 0x2a2a2e, [cxm, 1.67, czm + oz], [Math.PI / 2, 0, 0]);
    B.add(k.mesh());
    B.add(windows(wins, { lit: 0.1, seed: 9, dark: 0x2a3442 }));
    this.crank = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), new THREE.MeshLambertMaterial({ color: 0x8a8a8a })); this.crank.position.set(cxm + 0.12, 1.42, czm); B.add(this.crank);
    this.chimneyA = makeSmoke(V3(fx, fy + 10, fz + 2.5), { n: 6, rise: 8, size: 1.2, opacity: 0.18, color: 0xd8dce4 }); B.add(this.chimneyA.group);
    // cows by the barn, the farm dog, crows
    this.cowsA = this.life.add(makeHerd('cow', { n: 5, area: { x: 78, z: -28, r: 9 }, height: auburnHeight, seed: 3 })); B.add(this.cowsA.group);
    this.horseA = this.life.add(makeHerd('horse', { n: 1, area: { x: 60, z: 2, r: 5 }, height: auburnHeight, seed: 8 })); B.add(this.horseA.group);
    this.dogA = this.life.add(makeHerd('dog', { n: 1, area: { x: 5.5, z: 1.0, r: 1.5 }, height: auburnHeight, seed: 5, mode: 'follow' })); this.dogA.lead.set(5.5, 0, 1.0); B.add(this.dogA.group);
    this.crowsUp = this.life.add(makeFlock({ n: 9, center: V3(-14, 9, -20), r: 14, height: 5, color: 0x1a1a1e, size: 0.55, seed: 4, speed: 7 })); B.add(this.crowsUp.group); this.crowsUp.group.visible = false;
    const crk = new Kit(); for (let i = 0; i < 7; i++) { const x = -10 - r() * 8, z = -14 - r() * 10, y = auburnHeight(x, z), yw = r() * 6; crk.ball(0.1, 0, 0x1a1a1e, [x, y + 0.13, z], 0, [0.8, 0.8, 1.4]); crk.ball(0.06, 0, 0x1a1a1e, [x + Math.sin(yw) * 0.12, y + 0.2, z + Math.cos(yw) * 0.12]); crk.box(0.02, 0.02, 0.06, 0x3a3a2a, [x + Math.sin(yw) * 0.18, y + 0.2, z + Math.cos(yw) * 0.18], [0, yw, 0]); }
    this.crowsDown = crk.mesh(); B.add(this.crowsDown);
  }

  // Goddard's rocket and its launch frame
  buildGoddardRocket() {
    const B = this.B, fk = new Kit(), FRM = 0x5a5e62, H = 3.7;
    const fy = auburnHeight(FRAME.x, FRAME.z);
    const corner = (sx, sz, y) => V3(sx * lerp(0.6, 0.2, y / H), y, sz * lerp(0.6, 0.2, y / H));
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pipe(fk, corner(sx, sz, 0), corner(sx, sz, H), 0.022, FRM); fk.box(0.18, 0.03, 0.18, 0x3a3a3a, corner(sx, sz, 0).toArray()); }
    for (const y of [0.25, 1.4, 2.5, H]) for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) pipe(fk, corner(...a, y), corner(...b, y), 0.015, FRM, 4);
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, 1], [-1, 1]]]) { pipe(fk, corner(...a, 0.25), corner(...b, 1.4), 0.01, FRM, 4); pipe(fk, corner(...b, 1.4), corner(...a, 2.5), 0.01, FRM, 4); }
    pipe(fk, V3(0.6, 0.02, 0.6), V3(1.6, 0.02, 1.8), 0.012, 0x2a2a2a, 4); // a cable to the shelter
    this.frame = fk.mesh(); this.frame.position.set(FRAME.x, fy, FRAME.z); B.add(this.frame);
    // the rocket: motor on top, two thin pipes down to the tanks, a cone shield over them
    const rk = new Kit(), MET = 0xb8bcc0;
    rk.cyl(0.055, 0.055, 0.17, 10, 0x8a8e92, [0, 2.6, 0]); rk.ball(0.055, 1, 0x8a8e92, [0, 2.69, 0], 0, [1, 0.5, 1]);
    rk.cyl(0.055, 0.028, 0.06, 10, 0x7a7e82, [0, 2.49, 0]); rk.cyl(0.028, 0.075, 0.2, 10, 0x6a6e72, [0, 2.36, 0]);
    for (const s of [-1, 1]) { pipe(rk, V3(s * 0.085, 2.62, 0), V3(s * 0.085, 1.2, 0), 0.011, MET, 6); rk.box(0.05, 0.02, 0.02, MET, [s * 0.06, 2.62, 0]); }
    rk.cyl(0.012, 0.13, 0.22, 12, 0xd0d2d4, [0, 1.1, 0]);
    rk.cyl(0.075, 0.075, 0.38, 12, 0xd8dcdf, [0, 0.78, 0]); rk.ball(0.075, 1, 0xd8dcdf, [0, 0.97, 0], 0, [1, 0.4, 1]);
    rk.cyl(0.075, 0.075, 0.38, 12, 0xa89a7a, [0, 0.38, 0]); rk.ball(0.075, 1, 0xa89a7a, [0, 0.19, 0], 0, [1, 0.4, 1]);
    rk.box(0.03, 0.06, 0.03, 0x4a4a4a, [0.08, 0.9, 0]); rk.box(0.03, 0.06, 0.03, 0x4a4a4a, [-0.08, 0.5, 0]); rk.cyl(0.01, 0.01, 0.15, 5, 0x3a3a3a, [0, 0.07, 0]);
    this.rk = new THREE.Group(); this.rk.add(rk.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.45 })));
    this.rkBase = V3(FRAME.x, fy + 0.3, FRAME.z); this.rk.position.copy(this.rkBase); B.add(this.rk);
    // its flame (shooting down from the nozzle onto the cone shield)
    const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const cone = (r, L, m) => { const g = new THREE.CylinderGeometry(r, 0.0, L, 12, 1, true); g.translate(0, -L / 2, 0); return new THREE.Mesh(g, m); };
    this.flameA = new THREE.Group(); this.flameA.position.y = 2.26; this.flameA.add(cone(0.075, 0.9, fm(0xff9a40, 0.7)), cone(0.045, 0.6, fm(0xfff0c0, 0.9)), glow(0xffb060, 1.2, 0.9)); this.flameA.visible = false; this.rk.add(this.flameA);
    this.rkLight = new THREE.PointLight(0xffa050, 0, 12, 1.5); this.rkLight.position.y = 1.8; this.rk.add(this.rkLight);
    // labels for the parts
    this.rkLabs = [label('liquid-fuel rocket', 0.22), label('gasoline', 0.16), label('liquid oxygen', 0.16), label('motor', 0.16)];
    this.rkLabs[0].position.set(0, 3.25, 0); this.rkLabs[1].position.set(-0.65, 0.38, 0); this.rkLabs[2].position.set(-0.8, 0.85, 0); this.rkLabs[3].position.set(-0.55, 2.55, 0);
    for (const l of this.rkLabs) { l.material.opacity = 0; this.rk.add(l); }
    // smoke, vapour, snow bursts
    this.puffA = new Puffs(B, 220, { color: 0xeef0f4 });
    this.fireA = new Puffs(B, 120, { color: 0xffa050, additive: true });
    // the torch you can take (Adults), and Henry's own
    const tk = new Kit(); tk.cyl(0.02, 0.025, 1.9, 5, 0x5a4028, [0, 0.95, 0]); tk.cyl(0.04, 0.035, 0.18, 8, 0x8a6a2a, [0, 1.95, 0]);
    this.torchP = new THREE.Group(); this.torchP.add(tk.mesh()); this.torchFlame = glow(0x9ab8ff, 0.25, 0.9); this.torchFlame.position.y = 2.1; this.torchP.add(this.torchFlame);
    this.torchHome = { pos: V3(-0.9, 0.0, 0.2), rot: new THREE.Euler(0.0, 0, 1.18) }; this.torchP.position.copy(this.torchHome.pos); this.torchP.rotation.copy(this.torchHome.rot); B.add(this.torchP);
    this.torchGlow = glow(0xffe0a0, 0.6, 0); this.torchP.add(this.torchGlow); this.torchGlow.position.y = 1.2;
  }

  // the flight's path, the rockets that came after, the newspapers, the bubble of empty space
  buildAuburnExtras() {
    const B = this.B, eye = V3(1.2, 1.6, 1.6);
    const P = [], S = [], Bv = [];
    for (let i = 0; i <= 200; i++) { const p = this.flightPos(i / 200, _a); P.push(p.x, p.y, p.z); S.push(0.12); Bv.push(1); }
    for (let i = 0; i <= 50; i++) { const p = this.flightPos(0.5, _a); P.push(p.x, auburnHeight(p.x, p.z) + (p.y - auburnHeight(p.x, p.z)) * i / 50, p.z); S.push(0.07); Bv.push(0.8); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tg.setAttribute('size', new THREE.Float32BufferAttribute(S, 1)); tg.setAttribute('b', new THREE.Float32BufferAttribute(Bv, 1));
    this.trail = new THREE.Points(tg, chalkMat(0xff7a30, false)); this.trail.frustumCulled = false; this.trail.visible = false; B.add(this.trail);
    const apex = this.flightPos(0.5, V3());
    this.arcLabs = [label('2.5 seconds', 1.6, { color: '#fff0d0', glowCol: 'rgba(120,60,20,0.9)' }), label('12.5 m high', 1.6, { color: '#fff0d0', glowCol: 'rgba(120,60,20,0.9)' }), label('the cabbage patch', 1.8, { color: '#fff0d0', glowCol: 'rgba(20,60,20,0.9)' })];
    this.arcLabs[0].position.copy(this.flightPos(0.28, V3())).add(V3(0, 2.2, 0)); this.arcLabs[1].position.copy(apex).add(V3(-2, 1.6, 0)); this.arcLabs[2].position.copy(LAND).setY(auburnHeight(LAND.x, LAND.z) + 3.2);
    for (const l of this.arcLabs) { l.material.opacity = 0; B.add(l); }
    // the rockets that came after, rising as giant chalk outlines across the field
    const far = 150, mk = (prof, fins, flame, x, name, h) => { const s = new Sketch(B, outline(prof, fins, flame), { spacing: h / 380, dot: h / 140, color: 0xffffff, additive: false, secs: 2.5, seed: Math.round(x) }); s.place(V3(x, auburnHeight(x, -far) - 4, -far), eye.clone().setY(auburnHeight(x, -far))); s.addLabel(name, 0, -flame - 4, 5, { color: '#ffffff', glowCol: 'rgba(20,40,80,0.9)' }); s.y0 = s.g.position.y; return s; };
    this.descend = [
      mk([[0, 0.8], [1.5, 0.82], [6.5, 0.83], [8.5, 0.8], [10.5, 0.66], [12.5, 0.32], [13.6, 0.1], [14, 0]], [[[0.62, 3.4], [1.78, 0.6], [1.78, -0.1], [0.62, 0.2]]], 5, -48, 'V-2, 1944', 14),
      mk([[0, 5.0], [42, 5.0, 1], [67, 5.0, 1], [70, 3.3], [88, 3.3, 1], [97, 1.95], [103, 1.0], [104, 0.5], [111, 0.15], [112, 0]], [[[5, 6], [6.5, 1], [6.5, -1], [5, -1]]], 18, 4, 'Saturn V, 1969: to the Moon', 112),
      mk([[0, 4.5], [70, 4.5, 1], [110, 4.5], [116, 3.6], [120, 1.8], [122, 0]], [[[4.5, 100], [6.5, 98], [6.5, 92], [4.5, 92]], [[4.5, 8], [6.3, 6], [6.3, 1], [4.5, 1]]], 18, 52, 'rockets today', 122),
    ];
    this.descendExh = new Puffs(B, 200, { color: 0xffffff });
    // the newspapers
    const papers = [
      ['JANUARY 13, 1920', 'BELIEVES ROCKET', 'CAN REACH MOON', 'Professor Goddard plans to fire a rocket at the Moon'],
      ['JANUARY 13, 1920', 'A SEVERE STRAIN', 'ON CREDULITY', '"...needs something better than a vacuum to push against"'],
      ['JULY 18, 1929', 'MOON ROCKET MAN\'S TEST', 'ALARMS WHOLE TOWN', 'Police and ambulances rush to Aunt Effie\'s farm'],
    ];
    this.papers = papers.map((p, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.66), new THREE.MeshLambertMaterial({ map: paperTex(...p), side: THREE.DoubleSide, transparent: true, opacity: 0, emissive: 0x2a2a28 })); m.userData = { a: i / 3 * 6.28 + 0.8, h: 1.45 + i * 0.18, v: 0.25 + i * 0.05 }; m.visible = false; B.add(m); return m; });
    this.correction = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.74), new THREE.MeshLambertMaterial({ map: paperTex('JULY 17, 1969', 'A CORRECTION', '', '"...a rocket can function in a vacuum as well as in an atmosphere. The Times regrets the error."', true), side: THREE.DoubleSide, transparent: true, opacity: 0, emissive: 0x3a3020 }));
    this.correction.visible = false; this.corrGlow = glow(0xffd890, 1.4, 0); this.correction.add(this.corrGlow); this.corrGlow.position.z = -0.05; B.add(this.correction);
    // a bubble of empty space with a little rocket in it: it pushes on its own gas
    const vb = this.vac = new THREE.Group(); vb.position.set(0.0, 1.55, -0.3); vb.visible = false; B.add(vb);
    this.vacShell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), new THREE.ShaderMaterial({ uniforms: { a: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float a; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(vec3(0.5,0.7,1.0) * (0.05 + f) * a, 1.0); }' }));
    vb.add(this.vacShell);
    this.vacInner = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), new THREE.MeshBasicMaterial({ color: 0x050812, transparent: true, opacity: 0, depthWrite: false })); vb.add(this.vacInner);
    const mr = new Kit(); mr.cyl(0.025, 0.025, 0.12, 8, 0xe8e8f0, [0, 0, 0], [0, 0, -Math.PI / 2]); mr.cyl(0.001, 0.025, 0.05, 8, 0xd04030, [0.085, 0, 0], [0, 0, -Math.PI / 2]);
    this.vacRocket = mr.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })); vb.add(this.vacRocket);
    this.vacGas = glowPoints(60, { sizeScale: 200 }); vb.add(this.vacGas); this.vacGasD = Array.from({ length: 60 }, () => ({ x: 0, v: 0.3 + Math.random() * 0.4, y: (Math.random() - 0.5) * 0.04, z: (Math.random() - 0.5) * 0.04, t: Math.random() }));
    this.vacLabs = [label('empty space: nothing to push against', 0.05), label('the gas is pushed back...', 0.045), label('...so the rocket is pushed forward', 0.045)];
    this.vacLabs[0].position.set(0, 0.52, 0); this.vacLabs[1].position.set(-0.2, -0.5, 0); this.vacLabs[2].position.set(0.2, -0.58, 0);
    for (const l of this.vacLabs) { l.material.opacity = 0; vb.add(l); }
  }
  // Goddard's flight: 0..1 over 2.5 s, up 12.5 m, over to the cabbage patch
  flightPos(u, out) {
    const x = lerp(FRAME.x, LAND.x, u), z = lerp(FRAME.z, LAND.z, u);
    const g0 = auburnHeight(FRAME.x, FRAME.z) + 0.3, g1 = auburnHeight(LAND.x, LAND.z) + 0.2;
    return out.set(x, lerp(g0, g1, u) + 12.5 * 4 * u * (1 - u) * (1 - 0.15 * u), z);
  }

  // ---------- 3. Peenemünde: misty pines, the firing table, the V-2 ----------
  buildBaltic() {
    const k = new Kit(), r = rng(41), C = this.C;
    C.add(groundMesh(2400, 150, balticHeight, (x, z, y, c) => {
      c.setHex(0x3a3a2c).lerp(_col.setHex(0x5a5440), N2(x / 8, z / 8) * 0.8);
      if (Math.hypot(x, z - PAD.z) < 30) c.lerp(_col.setHex(0x8a8070), 0.6);
      if (Math.abs(x - 6) < 3 && z > PAD.z && z < 40) c.lerp(_col.setHex(0x6a6a66), 0.75);   // the concrete road
    }));
    // pines all round, thick beyond the clearing
    for (let i = 0; i < 620; i++) {
      const a = r() * 6.28, d = 45 + Math.sqrt(r()) * 420, x = Math.cos(a) * d, z = PAD.z + Math.sin(a) * d;
      if (Math.abs(x - 6) < 6 && z > PAD.z) continue; if (Math.hypot(x, z) < 14) continue;
      const y = balticHeight(x, z), s = 0.8 + r() * 0.7;
      k.cyl(0.2 * s, 0.3 * s, 14 * s, 5, 0x4a3426, [x, y + 7 * s, z]);
      for (let j = 0; j < 3; j++) k.cyl(0.001, (2.6 - j * 0.6) * s, 4.5 * s, 7, j % 2 ? 0x1c2a20 : 0x22301e, [x, y + (11 + j * 2.6) * s, z]);
    }
    // the sand wall round the test stand (an arc of earth to the north)
    for (let i = 0; i <= 24; i++) { const a = Math.PI * (0.15 + i / 24 * 0.7), x = Math.cos(a) * 34, z = PAD.z - Math.sin(a) * 34; k.box(9, 8, 6, 0x6a6048, [x, 3, z], [0, -a + Math.PI / 2, 0]); k.ball(3.5, 0, 0x4a5a3a, [x, 7, z], 0, [1.6, 0.4, 1]); }
    // the firing table: a ring on four legs, a blast cone underneath
    k.cyl(1.4, 1.4, 0.2, 16, 0x3a3e3a, [PAD.x, 1.5, PAD.z]); for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.box(0.3, 1.5, 0.3, 0x2e322e, [PAD.x + ox, 0.75, PAD.z + oz]);
    k.cyl(0.1, 1.1, 1.0, 4, 0x4a4e4a, [PAD.x, 0.55, PAD.z], [Math.PI, Math.PI / 4, 0]); k.box(5, 0.1, 5, 0x5a5a56, [PAD.x, 0.05, PAD.z]);
    // trucks: a fuel bowser and a cable truck; floodlight poles
    for (const [x, z, yaw] of [[-12, PAD.z + 9, 0.4], [14, PAD.z + 14, -0.3]]) {
      const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, ly, lz) => [x + lx * c + lz * s, balticHeight(x, z) + ly, z - lx * s + lz * c];
      k.box(2.3, 1.6, 2.2, 0x3a4032, P(0, 1.5, 3.2), [0, yaw, 0]); k.box(2.4, 0.4, 7, 0x2a2a26, P(0, 0.75, 0), [0, yaw, 0]);
      k.cyl(1.0, 1.0, 4.4, 12, 0x5a6050, P(0, 1.95, -1), [Math.PI / 2, yaw, 0]);
      for (const [ox, oz] of [[-1.2, 3], [1.2, 3], [-1.2, -1.8], [1.2, -1.8], [-1.2, -3], [1.2, -3]]) k.add(new THREE.TorusGeometry(0.42, 0.16, 5, 12), 0x1a1a1a, P(ox, 0.5, oz), [0, yaw + Math.PI / 2, 0]);
    }
    for (const [x, z] of [[-16, PAD.z + 18], [17, PAD.z + 20]]) { const y = balticHeight(x, z); k.box(0.3, 10, 0.3, 0x3a3a36, [x, y + 5, z]); k.box(1.6, 0.8, 0.6, 0x2a2a28, [x, y + 10.2, z]); }
    // your observation post: a concrete wall with sandbags, the bunker roof behind you
    k.box(7, 1.15, 0.6, 0x7a7a74, [0, 0.58, -1.4]); for (let i = 0; i < 14; i++) k.ball(0.28, 0, 0x8a8060, [-3.2 + i * 0.5, 1.3, -1.35], 0, [1.2, 0.5, 0.8]);
    k.box(7, 2.6, 0.6, 0x6a6a64, [0, 1.3, 3.2]); k.box(7.4, 0.5, 5.4, 0x6a6a64, [0, 2.85, 0.8]); for (const s of [-1, 1]) k.box(0.6, 2.6, 5, 0x707068, [s * 3.5, 1.3, 0.8]);
    k.box(0.1, 0.3, 0.1, 0x2a2a2a, [1.2, 1.3, -1.4]); k.cyl(0.04, 0.04, 0.5, 6, 0x3a3a3a, [1.2, 1.6, -1.4]); k.box(0.12, 0.08, 0.2, 0x2a2a2a, [1.2, 1.88, -1.45]);
    C.add(k.mesh());
    // the erector beside the rocket: a lattice tower that lowers away before launch
    const ek = new Kit(), EC = 0x4a5048;
    for (const sx of [-0.6, 0.6]) for (const sz of [-0.6, 0.6]) ek.box(0.14, 15, 0.14, EC, [sx, 7.5, sz]);
    for (let i = 0; i < 14; i++) { ek.box(1.3, 0.08, 0.08, EC, [0, i * 1.1 + 0.5, -0.6], [0, 0, i % 2 ? 0.7 : -0.7]); ek.box(1.3, 0.08, 0.08, EC, [0, i * 1.1 + 0.5, 0.6], [0, 0, i % 2 ? -0.7 : 0.7]); ek.box(0.08, 0.08, 1.2, EC, [-0.6, i * 1.1, 0]); }
    for (const y of [4, 9, 13.5]) ek.box(1.8, 0.1, 1.2, 0x5a5a50, [-1.2, y, 0]);
    this.erector = new THREE.Group(); const em = ek.mesh(); em.position.x = 0; this.erector.add(em); this.erector.position.set(PAD.x + 2.6, 0, PAD.z); C.add(this.erector);
    // the cloud deck, lit from inside by the rocket's flame
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000, 1, 1), new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, glowP: { value: new THREE.Vector3() }, glowA: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float t, glowA; uniform vec3 glowP; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
        void main(){ vec2 q = vW.xz * 0.006 + vec2(t * 0.01, t * 0.004);
          float d = n(q) * 0.5 + n(q * 2.1 + 3.0) * 0.3 + n(q * 4.3 - 1.0) * 0.2;
          float a = clamp(0.55 + (d - 0.45) * 1.6, 0.0, 0.97) * smoothstep(2400.0, 900.0, length(vW.xz));
          vec3 c = mix(vec3(0.07, 0.08, 0.11), vec3(0.2, 0.22, 0.28), d);
          float g = glowA * exp(-length(vW - glowP) / 90.0); c += vec3(1.0, 0.55, 0.2) * g * 1.6;
          gl_FragColor = vec4(c, max(a, min(1.0, g))); }`,
    }));
    this.clouds.rotation.x = Math.PI / 2; this.clouds.position.y = CLOUD; this.clouds.renderOrder = 4; C.add(this.clouds);
    // the floodlight on the rocket, and the flame's light
    this.flood = new THREE.SpotLight(0xdde4ff, 60, 120, 0.32, 0.6, 1.3); this.flood.position.set(-16, 10, PAD.z + 18); this.flood.target.position.set(PAD.x, 8, PAD.z); C.add(this.flood, this.flood.target);
    this.floodGlow = glow(0xe8eeff, 3, 0.9); this.floodGlow.position.set(-16, 10.2, PAD.z + 17.6); C.add(this.floodGlow);
    this.flood2Glow = glow(0xe8eeff, 3, 0.9); this.flood2Glow.position.set(17, 10.2, PAD.z + 19.6); C.add(this.flood2Glow);
    // remembrance: small lights in the grass, one for each of the many who were forced to build it
    this.memorial = glowPoints(70, { sizeScale: 260 }); this.memorial.visible = false; C.add(this.memorial);
    this.memD = Array.from({ length: 70 }, (_, i) => { const a = Math.PI * (0.2 + 0.6 * i / 70) + (r() - 0.5) * 0.03, d = 16 + r() * 3; const x = Math.cos(a) * d * 1.6, z = -Math.sin(a) * d * 0.7 - 8; return { x, y: balticHeight(x, z) + 0.12, z, ph: r() * 6, at: r() }; });
    // smoke, steam, deer at the forest edge
    this.puffC = new Puffs(C, 360, { color: 0xc8ccd4, scale: 300 });
    this.fireC = new Puffs(C, 160, { color: 0xffa050, additive: true });
    this.deer = this.life.add(makeHerd('reindeer', { n: 3, area: { x: -34, z: -22, r: 5 }, height: balticHeight, seed: 7, scale: 0.8, mode: 'follow' })); this.deer.lead.set(-34, 0, -22); C.add(this.deer.group);
  }

  // the V-2: 14 m tall, painted in black and white quarters like the test rockets
  buildV2() {
    const prof = [[0, 0.6], [0.4, 0.66], [1.5, 0.78], [3, 0.83], [6.5, 0.83], [8.5, 0.8], [10, 0.68], [11.5, 0.5], [12.8, 0.28], [13.6, 0.1], [14, 0.0]];
    let g = new THREE.LatheGeometry(prof.map(([y, rr]) => new THREE.Vector2(rr, y)), 24).toNonIndexed();
    const p = g.attributes.position, cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const qd = Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 2)), band = y < 2.6 ? 0 : y < 10.2 ? 1 : 2, black = (qd + band) % 2;
      const v = black ? 0.08 : 0.82; for (let j = 0; j < 3; j++) cols.set([v, v, v * 0.97], (i + j) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    g.deleteAttribute('uv'); const k = new Kit(); k.parts.push(g);
    const fin = new THREE.Shape(); fin.moveTo(0.6, 3.4); fin.lineTo(1.78, 0.6); fin.lineTo(1.78, -0.1); fin.lineTo(0.55, 0.25); fin.closePath();
    for (let i = 0; i < 4; i++) { const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.06, bevelEnabled: false }); fg.translate(0, 0, -0.03); k.add(fg, i % 2 ? 0x141414 : 0xd8d8d4, [0, 0, 0], [0, i * Math.PI / 2 + Math.PI / 4, 0]); }
    k.cyl(0.45, 0.55, 0.3, 12, 0x2a2a2a, [0, -0.1, 0]);
    this.v2 = new THREE.Group(); this.v2.add(k.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
    this.v2Base = V3(PAD.x, 1.62, PAD.z); this.v2.position.copy(this.v2Base); this.C.add(this.v2);
    const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const cone = (rr, L, m) => { const cg = new THREE.CylinderGeometry(rr, 0.0, L, 14, 1, true); cg.translate(0, -L / 2, 0); return new THREE.Mesh(cg, m); };
    this.flameC = new THREE.Group(); this.flameC.position.y = -0.25; this.flameC.add(cone(0.75, 11, fm(0xff8a30, 0.55)), cone(0.45, 7, fm(0xffe8b0, 0.85)), glow(0xffa040, 14, 0.9)); this.flameC.visible = false; this.v2.add(this.flameC);
    this.v2Light = new THREE.PointLight(0xffa050, 0, 260, 1.1); this.v2Light.position.y = -2; this.v2.add(this.v2Light);
    this.v2Lab = label('V-2', 1.2, { color: '#e8e8e8', glowCol: 'rgba(0,0,0,0.8)' }); this.v2Lab.position.set(0, 16.5, 0); this.v2Lab.material.opacity = 0; this.v2.add(this.v2Lab);
  }

  // ---------- 4. Space: the edge of space, and the map ----------
  buildSpace() {
    const G = this.G, sp = this.space = new Space(G, { earthR: 16 }), R = 16;
    sp.ball.geometry.dispose(); sp.ball.geometry = new THREE.SphereGeometry(R, 144, 96);
    const ag = new THREE.SphereGeometry(R * 1.035, 96, 64); sp.atmo.geometry.dispose(); sp.atmo.geometry = ag; sp.atmo2.geometry = ag;
    this.spTrail = glowPoints(240, { sizeScale: 300 }); sp.earth.add(this.spTrail);
    this.spDot = glow(0xffd090, 0.8, 0); sp.earth.add(this.spDot);
    this.spArcs = glowPoints(700, { sizeScale: 300 }); sp.earth.add(this.spArcs);
    this.spPins = [PEEN, WSANDS, MOSCOW].map(() => { const s = glow(0xffe0a0, 0.9, 0); sp.earth.add(s); return s; });
    this.spLabs = { v2: label('V-2, 1944: 176 km up', 0.9), first: label('the first thing ever made by people to reach space', 0.6), peen: label('Peenemünde', 0.7), usa: label('America', 1.1), ussr: label('Soviet Union', 1.1), race: label('the race to space', 1.0) };
    for (const l of Object.values(this.spLabs)) { l.material.opacity = 0; l.material.depthTest = false; sp.group.add(l); }
    this.spOrbit = glowPoints(260, { sizeScale: 300 }); sp.earth.add(this.spOrbit);
  }

  buildPeople() {
    const add = (parent, model, pos, look = {}) => { const P = makePerson({ model, seed: 11 + parent.children.length * 3, ...look }); P.g.position.copy(pos); parent.add(P.g); return P; };
    // Kaluga
    this.tsi = add(this.A, 'tsiolkovsky', V3(-0.9, 0, -0.98), { tunic: 0x2a2a2a, hair: 0x8a8a8a, beard: true, height: 1.72 }); this.tsi.g.rotation.y = Math.PI;
    holdProp(this.tsi, this.trumpetM, 'Left', [0, 0.08, 0.03]); this.trumpetM.visible = false;
    holdProp(this.tsi, this.balloonM, 'Right', [0, 0.12, 0.03]); this.balloonM.visible = false;
    this.walkersK = [];
    for (let i = 0; i < 3; i++) {
      const x = -40 + i * 35, P = add(this.A, 'townsman', V3(x, kalugaHeight(x, -32), -32), { height: 1.65 + (i % 2) * 0.06 });
      P.routine = [{ x: x + 30, z: -31, pose: 'idle', secs: 3 + i }, { x: x - 25, z: -33, pose: i % 2 ? 'talk' : 'idle', secs: 4 }];
      if (i !== 1) { const L = makeTorch({ len: 0.35, color: 0xffc070, size: 0.6 }); holdProp(P, L, 'Right', [0, 0.02, 0.02]); P.lamp = L; }
      this.walkersK.push(P);
    }
    // Auburn
    const ah = (x, z) => V3(x, auburnHeight(x, z), z);
    this.god = add(this.B, 'goddard', ah(1.1, -2.9), { tunic: 0x2a2a30, height: 1.78 });
    this.henry = add(this.B, 'townsman', ah(3.6, 2.0), { height: 1.72 });
    this.henryTorch = makeTorch({ len: 1.8, color: 0x9ab8ff, size: 0.5 }); holdProp(this.henry, this.henryTorch, 'Right', [0, 0.02, 0.02]);
    this.roope = add(this.B, 'townsman', ah(5.0, 1.6), { height: 1.68 });
    this.esther = add(this.B, null, ah(4.65, -1.15), { tunic: 0x2a4a3a, hair: 0x4a3020, height: 1.62, seed: 31 });
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, 6.29, 0, 1.6), new THREE.MeshLambertMaterial({ color: 0x5a2a3a })); hat.position.y = 1.66; hat.scale.set(1.05, 0.8, 1.05); this.esther.inner.add(hat);
    this.esther.g.rotation.y = -2.3;
    // Peenemünde: two engineers walk back to the bunker before the launch
    this.eng = [0, 1].map((i) => { const x = PAD.x + 3 + i * 1.2, z = PAD.z + 5; return add(this.C, 'townsman', V3(x, balticHeight(x, z), z), { height: 1.7 }); });
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.torchIt = {
      hint: 'Grab the torch with GRIP and hold its flame to the rocket\'s motor', deskHint: 'Click the torch to light the rocket',
      get disabled() { return self.s.torch !== 1 || self.s.lit || self.cur !== 'auburn'; },
      reach(pos) { self.torchP.localToWorld(_a.set(0, 1.0, 0)); return Math.max(0, pos.distanceTo(_a) - 0.95); },
      aim(o, d) { self.torchP.localToWorld(_a.set(0, 1.0, 0)); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.4 ? t : Infinity; },
      onGrab(h) { if (G.mode === 'desktop') G.act({ type: 'light' }); else self.held = h; },
      onHold(h) {
        if (!h?.grip) return;
        h.grip.getWorldQuaternion(_q); _b.set(0, 0, -1).applyQuaternion(_q).add(_c.set(0, 0.6, 0)).normalize();
        self.torchP.position.copy(h.pos).addScaledVector(_b, -0.3); self.torchP.quaternion.setFromUnitVectors(UP, _b);
        self.torchP.localToWorld(_a.set(0, 2.05, 0)); self.rk.localToWorld(_c.set(0, 2.3, 0));
        if (_a.distanceTo(_c) < 0.45) G.act({ type: 'light' });
      },
      onRelease() { self.held = null; },
      onTouch() { G.act({ type: 'light' }); },
    };
    G.interactables.push(this.torchIt);
  }
  act(a) {
    if (a.type === 'light' && this.s.torch === 1 && !this.s.lit) { this.s.lit = 1; this.s.byYou = 1; return true; }
    return this.journal.act(a);
  }
  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast'), w = (x) => (fast ? Math.min(x, 0.5) : x);
    G.events.emit('placePlayers', { x: this.start.pos.x, z: this.start.pos.z, yaw: this.start.yaw });
    await G.ui.fadeIn(3);
    // Newton's cannon, Verne's cannon
    s.phase = 'verne';
    const l1 = D.sayAsync('ch13_01');
    await D.cue('stay up in space'); s.newton = 1;
    await D.cue('dream'); s.newton = 0;
    await D.cue('Jules Verne'); s.verne = 1;
    await D.cue('giant cannon'); s.capsule = 1;
    await l1;
    // Tsiolkovsky
    s.phase = 'tsiol'; s.guide = [-0.5, 2.0, -0.6];
    const l2 = D.sayAsync('ch13_02');
    await D.cue('hearing'); s.trumpet = 1;
    await D.cue('library books'); s.books = 1;
    await l2;
    s.guide = null; s.books = 0;
    // a cannon would never work: you need a rocket
    s.phase = 'rocket';
    const l3 = D.sayAsync('ch13_03');
    await D.cue('never work'); s.nogo = 1;
    await D.cue('You need a rocket'); s.rocket = 1; s.trumpet = 0;
    await D.cue('blasting gas'); s.rocket = 2;
    await D.cue('balloon'); s.balloon = 1;
    await l3;
    await D.until(() => this.balloonT > 3.2, w(4));
    s.verne = 0; s.nogo = 0; s.capsule = 0;
    // the math, the rocket train, the cradle
    s.phase = 'math';
    const l4 = D.sayAsync('ch13_04');
    await D.cue('math'); s.eq = 1; s.train = 1; s.rocket = 1;
    await D.cue('reach space'); s.train = 2;
    await D.cue('he wrote'); s.cradle = 1; s.eq = 0;
    await D.cue('cannot stay'); s.rocket = 3; s.station = 1; s.phase = 'cradle';
    await l4;
    await D.wait(w(5));
    // to America
    await G.ui.fadeOut(1.5);
    s.cradle = 0; s.train = 0; s.rocket = 0;
    s.scene = 'auburn'; this.setScene('auburn');
    G.events.emit('placePlayers', { x: 1.2, z: 1.6, yaw: 0.3 });
    await G.ui.fadeIn(2);
    s.phase = 'field';
    const l5 = D.sayAsync('ch13_05');
    await D.cue('Robert Goddard'); s.labels = 1; s.guide = [FRAME.x - 1.2, 3.4, FRAME.z + 0.6];
    await D.cue('gasoline'); s.labels = 2;
    await D.cue('liquid oxygen'); s.labels = 3; s.lox = 1;
    await l5;
    s.guide = null; s.phase = 'ready'; if (G.kids) s.henry = 1;
    await D.until(() => !G.kids || this.henryReady, w(6));
    await D.say('ch13_06');
    s.labels = 0;
    // light it (Adults: you're Henry)
    s.torch = 1;
    D.hint(G.mode === 'desktop' ? this.torchIt.deskHint : this.torchIt.hint, 10);
    await D.auto(() => s.lit, () => { s.henry = 1; if (this.henryReady) { s.henry = 2; s.lit = 1; } }, { after: fast ? 0.2 : 0.8, timeout: fast ? 3 : 30 });
    if (!s.lit) { s.henry = 1; await D.until(() => this.henryReady, w(8)); s.henry = 2; s.lit = 1; }
    s.torch = 0; G.ui.showHint('');
    s.phase = 'launch';
    await D.until(() => this.fT > 6.5, fast ? 6 : 14);
    // two and a half seconds, twelve meters, the cabbage patch... and every big rocket since
    s.phase = 'landed';
    const l7 = D.sayAsync('ch13_07'); s.arc = 1;
    await D.cue('Twelve meters'); s.arc = 2;
    await D.cue('cabbage patch'); s.arc = 3;
    await D.cue('every big rocket'); s.descend = 1; s.phase = 'descend';
    await l7;
    await D.wait(w(4));
    s.descend = 0; s.arc = 0;
    // the newspapers, empty space, and the apology
    s.phase = 'papers'; s.papers = 1;
    const l8 = D.sayAsync('ch13_08');
    await D.cue('never work in empty space'); s.vacuum = 1;
    await D.cue('They were wrong'); s.vacuum = 2; s.papers = 2;
    await D.cue('Almost fifty'); s.correction = 1;
    await l8;
    await D.wait(w(3));
    // the war: Peenemünde
    await G.ui.fadeOut(1.8);
    s.correction = 0; s.vacuum = 0; s.papers = 0;
    s.scene = 'baltic'; this.setScene('baltic');
    G.events.emit('placePlayers', { x: 0, z: 0, yaw: 0 });
    await G.ui.fadeIn(2.5);
    s.phase = 'v2';
    const l9 = D.sayAsync('ch13_09');
    await D.cue('V-2'); s.v2 = 1;
    await D.cue('prisoners'); s.lights = 1;
    await D.cue('But in 1944'); s.v2 = 2;
    await D.cue('did something'); s.v2 = 3;
    await l9;
    await D.until(() => this.v2Y > CLOUD + 40, fast ? 5 : 14);
    // the edge of space
    await G.ui.fadeOut(1);
    s.lights = 0; s.space = 1;
    await D.until(() => this.space.on, 2);
    await G.ui.fadeIn(1.5);
    await D.until(() => this.spT > 9, fast ? 3 : 12);
    // where the rocket builders went
    s.space = 2;
    const l10 = D.sayAsync('ch13_10');
    await D.cue('race'); s.race = 1;
    await l10;
    await D.until(() => this.mapT > 14, w(5));
    // home to Kaluga for the journal
    await G.ui.fadeOut(1.5);
    s.space = 0; s.race = 0; s.v2 = 0;
    s.scene = 'kaluga'; this.setScene('kaluga'); s.phase = 'night';
    G.events.emit('placePlayers', { x: this.start.pos.x, z: this.start.pos.z, yaw: this.start.yaw });
    await D.until(() => !this.space.on, 2);
    await G.ui.fadeIn(2);
    await D.wait(w(2.5));
    s.phase = 'journal';
    await this.journal.present(D);
    s.phase = 'done';
  }

  // ---------- Every frame ----------
  update(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1;
    this.t += dt;
    if (s.scene !== this.cur) this.setScene(s.scene);
    const hour = this.cur === 'kaluga' ? (s.phase === 'night' || s.phase === 'journal' || s.phase === 'done' ? 22.5 : 21) + this.t / 900 : this.cur === 'auburn' ? 14.5 : 21.4;
    const sun = sunAt(this.lat, this.sl, hour); G.sky.set(sun.az, sun.el);
    if (this.cur === 'kaluga') G.sky.setMoon(this.moonAz, this.moonEl, 1.2, 0.3);
    this.life.update(dt, t);
    if (this.A.visible) this.updateKaluga(dt, t, fast);
    if (this.B.visible) this.updateAuburn(dt, t, fast);
    else if (this.wasB) this.resetAuburnHeld();
    this.wasB = this.B.visible;
    if (this.C.visible || this.space.on || s.space) this.updateBaltic(dt, t, fast);
    this.updateSpace(dt, t, fast);
    const busy = this.journal.update();
    guideUpdate(this, busy || this.space.on);
    this.space.update(dt);
  }
  resetAuburnHeld() { this.held = null; }

  updateKaluga(dt, t, fast) {
    const G = this.G, s = this.s, sk = this.sk;
    // the lamp and the stove flicker
    const fl = 0.85 + 0.15 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1);
    this.lamp.intensity = 3.2 * fl; this.lampFlame.scale.set(0.1 + 0.02 * fl, 0.17 * fl, 1);
    this.stoveLight.intensity = 1.1 + 0.4 * Math.sin(t * 7.3) * Math.sin(t * 3.1); this.stoveGlow.material.opacity = 0.6 + 0.2 * Math.sin(t * 6.1);
    this.airship.rotation.y = Math.sin(t * 0.2) * 0.3;
    for (const sm of this.smokesK) sm.update(dt, t);
    // snow
    const sp = this.snow.geometry.attributes.position, a = sp.array;
    for (let i = 0; i < this.snowV.length; i++) { a[i * 3 + 1] -= this.snowV[i] * dt; a[i * 3] += Math.sin(t * 0.7 + i) * 0.004; if (a[i * 3 + 1] < -1.5) a[i * 3 + 1] += 13; }
    sp.needsUpdate = true;
    // the sketches
    sk.newton.update(dt, s.newton === 1, fast);
    sk.verne.update(dt, s.verne === 1, fast); sk.verne.book.update(dt, s.verne === 1 && !s.nogo, fast);
    sk.nogo.update(dt, s.nogo === 1, fast);
    // the capsule flies out of the cannon toward the Moon
    if (s.capsule && this.capT == null) { this.capT = 0; G.audio.ctx && (G.audio.boom(this.capFrom), whoosh(G, 3, 0.25)); }
    if (!s.capsule) this.capT = null;
    if (this.capT != null) {
      this.capT += dt * fast; const k = clamp01(this.capT / 5);
      sk.capsule.g.position.copy(this.capFrom).addScaledVector(this.capDir, 4 + ease(k) * 120);
      G.camera.getWorldPosition(_a); sk.capsule.g.lookAt(_a); sk.capsule.g.rotateZ(Math.atan2(-this.capDir.x, this.capDir.y) * 0 + 0.6);
      sk.capsule.g.scale.setScalar(1 + k * 1.5);
    }
    sk.capsule.update(dt, this.capT != null && this.capT < 5, fast, 1.5);
    // Tsiolkovsky's rocket: drawn, blasting gas, then off out of the window to the stars
    const R = sk.rocket;
    R.update(dt, s.rocket >= 1, fast, 1.2);
    if (s.rocket === 3) {
      this.flyOutT = (this.flyOutT || 0) + dt * fast; const k = ease(this.flyOutT / 6);
      R.g.position.lerpVectors(this.rocketHome.pos, this.rocketSky, k); R.g.position.x += Math.sin(k * Math.PI) * -3; R.g.scale.setScalar(1 + k * 22);
    } else if (s.rocket) { this.flyOutT = 0; R.g.position.copy(this.rocketHome.pos); R.g.quaternion.copy(this.rocketHome.q); R.g.scale.setScalar(1); if (s.rocket === 2) R.g.position.addScaledVector(R.g.localToWorld(_a.set(0, 1, 0)).sub(R.g.position).normalize(), 0.05 + 0.04 * Math.sin(t * 9)); }
    if ((s.rocket === 2 || s.rocket === 3) && R.op > 0.5) {
      this.exT = (this.exT || 0) - dt;
      if (this.exT <= 0) {
        this.exT = 0.025; const sc = R.g.scale.x; R.g.localToWorld(_a.set((Math.random() - 0.5) * 0.08, -0.02, 0)); R.g.localToWorld(_b.set((Math.random() - 0.5) * 0.5, -1.2 - Math.random(), 0)).sub(R.g.position).multiplyScalar(0.6);
        this.exhK.emit(_a, _b, 0.03 * sc, 0.09 * sc, 1.0, 0.9, 0.5);
      }
    }
    this.exhK.update(dt);
    if (s.rocket === 3 && !this.flySnd) { this.flySnd = true; G.audio.ctx && (whoosh(G, 4, 0.35), shimmer(G, 4, 0.18)); }
    // the equation, the rocket train dropping its stages, the cradle, the station
    sk.eq.update(dt, s.eq === 1, fast);
    if (s.train === 2) this.trainT = (this.trainT || 0) + dt * fast; else if (!s.train) this.trainT = 0;
    this.stages.forEach((st, i) => {
      const drop = i < 3 && this.trainT > 0.8 + i * 1.3, dk = drop ? clamp01((this.trainT - 0.8 - i * 1.3) / 1.6) : 0;
      st.update(dt, s.train >= 1 && dk < 1, fast, drop ? 3 : 2);
      const up = Math.max(0, this.trainT - 0.8) * 0.06;
      st.g.position.copy(st.home).add(_a.set(dk * 0.15 * (i % 2 ? 1 : -1), up - dk * 0.5, 0));
      if (drop && !st.snd) { st.snd = true; G.audio.ctx && G.audio.tick(st.g.position); }
      if (!s.train) st.snd = false;
    });
    sk.cradle.update(dt, s.cradle === 1, fast);
    if (sk.cradle.op > 0.01) sk.cradle.g.rotation.z = Math.sin(t * 1.6) * 0.06;
    sk.station.update(dt, s.station === 1, fast, 0.8);
    if (sk.station.op > 0.01) { G.camera.getWorldPosition(_a); sk.station.g.lookAt(_a); sk.station.g.rotateZ(t * 0.1); }
    // the books fly round him (ch13_02)
    this.bookV = damp(this.bookV || 0, s.books ? 1 : 0, 1.5, dt);
    this.flyBooks.forEach((b, i) => {
      const a2 = t * 0.9 + i / 6 * 6.28, c0 = _a.set(-0.9 + Math.cos(a2) * 0.6, 1.75 + Math.sin(t * 1.3 + i) * 0.12, -0.98 + Math.sin(a2) * 0.6);
      b.position.lerpVectors(b.userData.home, c0, ease(this.bookV)); b.rotation.set(this.bookV * Math.sin(t * 2 + i) * 0.4, Math.PI / 2 + this.bookV * a2, this.bookV * 0.3);
    });
    this.bookGlow.position.set(-0.9, 1.75, -0.98); this.bookGlow.material.opacity = 0.6 * this.bookV;
    // the balloon, let go: zooms round the room, then flops onto the floor; the cat pounces
    if (s.balloon && this.balloonT == null) {
      this.balloonT = 0; dropProp(this.tsi, 'Right'); this.A.add(this.balloonM); this.balloonM.visible = true;
      this.tsi.inner.updateMatrixWorld(true); this.balloonFrom = this.tsi.g.position.clone().add(_a.set(0.25, 1.5, 0.2));
      if (G.audio.ctx) { const o = G.audio.out(this.balloonFrom, 0.5); for (let i = 0; i < 34; i++) G.audio.tone(o, { type: 'sawtooth', f: 95 + Math.random() * 70 + i * 2, peak: 0.18, a: 0.004, d: 0.07, t0: i * 0.075 }); G.audio.noise(o, { type: 'bandpass', f: 600, f2: 300, q: 2, peak: 0.25, a: 0.05, d: 2.4 }); }
    }
    if (this.balloonT != null && s.balloon) {
      this.balloonT += dt * fast; const k = this.balloonT;
      if (k < 2.6) { const a3 = k * 4.2; this.balloonM.position.set(-0.2 + Math.cos(a3) * 1.5 * (1 - k * 0.2), 1.6 + Math.sin(k * 6) * 0.5 + k * 0.2, -0.3 + Math.sin(a3) * 1.3); this.balloonM.rotation.set(Math.sin(k * 20) * 0.8, a3, Math.cos(k * 17) * 0.8); this.balloonM.scale.setScalar(1 - k * 0.22); }
      else { const f = clamp01((k - 2.6) / 0.7); this.balloonM.position.lerp(_a.set(0.5, 0.06, -1.4), f * 0.3); this.balloonM.scale.setScalar(0.42); this.balloonM.rotation.set(1.4, 0, 0); }
    }
    if (!s.balloon && s.phase !== 'rocket') { if (this.balloonM.parent === this.A) this.balloonM.visible = false; }
    this.updateCat(dt, t);
    this.updateTsio(dt, t);
    for (const P of this.walkersK) { runRoutine(P, dt, { height: kalugaHeight, speed: 0.9 }); animatePerson(P, t, dt); P.lamp?.userData.flicker(t); }
  }

  updateCat(dt, t) {
    const C = this.cat, s = this.s;
    this.catTail.rotation.z = Math.sin(t * 2.3) * 0.5;
    let look = null;
    if (this.balloonT != null && this.balloonT < 3.5 && s.balloon) look = this.balloonM.position;
    else if (this.s.rocket === 2) look = this.sk.rocket.g.position;
    if (s.balloon && this.balloonT > 2.6) { // pounce on it
      const f = clamp01((this.balloonT - 2.6) / 0.6); C.position.lerpVectors(this.catHome, _a.set(0.65, 0, -1.25), f); C.position.y = lerp(this.catHome.y, 0, f) + Math.sin(f * Math.PI) * 0.3;
    } else if (!s.balloon) C.position.copy(this.catHome);
    if (look) { const yaw = Math.atan2(look.x - C.position.x, look.z - C.position.z); C.rotation.y = damp(C.rotation.y, yaw, 4, dt); }
    this.catBody.position.y = Math.sin(t * 1.4) * 0.004;
  }

  updateTsio(dt, t) {
    const T = this.tsi, s = this.s, ph = s.phase;
    G_cam(this.G, _c);
    const face = (yaw) => { let d = yaw - T.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); T.g.rotation.y += d * Math.min(1, dt * 2.5); };
    this.trumpetM.visible = !!s.trumpet;
    if (ph === 'arrive' || ph === 'verne') { face(Math.PI); T.pose = 'write'; T.look = this.sk.verne.op > 0.3 && Math.sin(t * 0.5) > 0 ? this.sk.verne.g.position : null; }
    else if (ph === 'tsiol') { face(Math.atan2(_c.x - T.g.position.x, _c.z - T.g.position.z)); T.pose = s.trumpet ? 'hold' : 'talk'; T.look = _c.clone(); }
    else if (ph === 'rocket') {
      if (!s.balloon) { this.balloonM.visible = s.rocket >= 1; }
      face(Math.atan2(-1.8 - T.g.position.x, 0.5 - T.g.position.z)); T.pose = s.balloon ? (this.balloonT > 2.6 ? 'cheer' : 'gasp') : 'point'; T.pointAt.copy(this.sk.rocket.g.position); T.look = s.balloon ? this.balloonM.position.clone() : this.sk.rocket.g.position.clone();
    }
    else if (ph === 'math') { face(Math.PI * 0.85); T.pose = s.cradle ? 'write' : 'point'; T.pointAt.copy(this.stages[1].g.position); T.look = s.cradle ? null : T.pointAt.clone(); }
    else { face(Math.PI * 1.15); T.pose = 'idle'; T.look = this.sk.station.g.position; }
    animatePerson(T, t, dt);
  }

  updateAuburn(dt, t, fast) {
    const G = this.G, s = this.s, fd = dt * fast;
    this.chimneyA.update(dt, t);
    // part labels and the rocket's glow
    this.rkLabs.forEach((l, i) => { const on = s.labels >= 1 && (i === 0 || (i === 1 && s.labels >= 2) || (i === 2 && s.labels >= 3) || (i === 3 && s.labels >= 1)); l.material.opacity = damp(l.material.opacity, on ? 1 : 0, 3, dt); });
    // liquid oxygen boiling off: white vapour from the tank
    if ((s.lox || s.labels >= 3) && !s.lit && Math.random() < dt * 8) { this.rk.localToWorld(_a.set(0.08, 0.95, 0)); this.puffA.emit(_a, _b.set(0.15 + Math.random() * 0.1, -0.05, (Math.random() - 0.5) * 0.1), 0.08, 0.5, 2.2, 0.55, 0.6, 0.1); }
    // the torch on the sawhorse glows when it's yours to take
    const yours = s.torch === 1 && !G.kids && !s.lit;
    this.torchGlow.material.opacity = yours ? 0.35 + 0.25 * Math.sin(t * 5) : 0;
    this.torchP.visible = !G.kids || false;
    if (!this.held) { this.torchP.position.copy(this.torchHome.pos); this.torchP.rotation.copy(this.torchHome.rot); }
    this.torchFlame.material.opacity = yours || this.held ? 0.9 : 0;
    // the launch
    if (s.lit && this.fT == null) { this.fT = 0; this.heldDrop = true; this.held = null; }
    if (this.fT != null) this.updateLaunch(dt, t, fd);
    this.puffA.update(dt); this.fireA.update(dt);
    // the flight path, labels
    this.trail.visible = s.arc >= 1;
    if (this.trail.visible) { this.trailK = Math.min(1, (this.trailK || 0) + fd / 1.5); this.trail.geometry.setDrawRange(0, Math.floor(201 * this.trailK) + (s.arc >= 2 ? 51 : 0)); this.trail.material.uniforms.opacity.value = 0.9; } else this.trailK = 0;
    this.arcLabs.forEach((l, i) => { l.material.opacity = damp(l.material.opacity, s.arc >= i + 1 ? 1 : 0, 3, dt); });
    // the rockets that came after
    this.descend.forEach((d, i) => {
      if (s.descend) d.riseT = (d.riseT || 0) + fd; else d.riseT = 0;
      const delay = i * 0.9, k = clamp01((d.riseT - delay) / 6);
      d.update(dt, s.descend === 1 && d.riseT > delay, fast, 1.2);
      d.g.position.y = d.y0 + ease(k) * 4 + Math.max(0, d.riseT - delay - 6) * 0.6;
      if (d.op > 0.4 && s.descend && Math.random() < dt * 30) { d.g.localToWorld(_a.set((Math.random() - 0.5) * 6, -4, 0)); this.descendExh.emit(_a, _b.set((Math.random() - 0.5) * 6, -1, (Math.random() - 0.5) * 3), 3, 12, 3, 0.35, 0.3); }
    });
    if (s.descend && !this.descSnd) { this.descSnd = true; G.audio.ctx && (rumble(G, 8, 0.25, null), awe(G, 14, 0.09, 87)); }
    this.descendExh.update(dt);
    this.updatePapers(dt, t, fd);
    this.updatePeopleA(dt, t);
  }

  updateLaunch(dt, t, fd) {
    const G = this.G, s = this.s;
    const T0 = this.fT; this.fT += fd; const T = this.fT, A = G.audio;
    if (T0 === 0) { if (A.ctx) { const o = A.out(this.rkBase, 1.4, 6); A.noise(o, { type: 'highpass', f: 1500, peak: 0.6, a: 0.003, d: 0.25 }); A.noise(o, { type: 'lowpass', f: 1600, f2: 500, q: 0.6, peak: 0.85, a: 0.15, d: 5.2 }); rumble(G, 4, 0.35, this.rkBase); } this.dogA.mode = 'follow'; this.dogA.lead.set(30, 0, 24); this.dogA.animals.forEach((o) => { o.wait = 0; }); }
    // on the stand: roaring, shaking; then 2.5 s of flight; then lying in the cabbages
    const u = clamp01((T - 2.2) / 2.5);
    if (T < 2.2) { this.rk.position.copy(this.rkBase); this.rk.position.x += (Math.random() - 0.5) * 0.008; this.rk.position.z += (Math.random() - 0.5) * 0.008; this.rk.rotation.set(0, 0, 0); }
    else if (u < 1) {
      this.flightPos(u, this.rk.position);
      this.flightPos(Math.min(1, u + 0.02), _a); _b.copy(_a).sub(this.rk.position).normalize();
      _c.copy(UP).lerp(_b, clamp01((u - 0.1) * 1.4)).normalize(); this.rk.quaternion.setFromUnitVectors(UP, _c);
      if (!this.liftSnd) { this.liftSnd = true; A.ctx && whoosh(G, 2.5, 0.4, this.rkBase); this.crowsDown.visible = false; this.crowsUp.group.visible = true; this.crowsUp.center.set(-14, 3, -20); }
    } else {
      this.flightPos(1, this.rk.position); this.rk.position.y -= 0.15;
      this.rk.quaternion.setFromAxisAngle(_a.set(1, 0, -1).normalize(), 1.25);
      if (!this.landed) {
        this.landed = true;
        if (A.ctx) { A.noise(A.out(this.rk.position, 1, 10), { type: 'lowpass', f: 300, peak: 0.7, a: 0.005, d: 0.5 }); setTimeout(() => A.cheer(V3(3, 1, 1)), 700); }
        for (let i = 0; i < 26; i++) this.puffA.emit(this.rk.position, _a.set((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4), 0.4, 2.2, 2.5, 0.8, 1.2, -0.5);
      }
    }
    this.lastRk = (this.lastRk || new THREE.Vector3()); 
    this.crowsUp.center.y = damp(this.crowsUp.center.y, 14, 0.8, fd);
    const burning = T < 4.6;
    this.flameA.visible = burning;
    if (burning) {
      const fl = 0.8 + 0.3 * Math.random(); this.flameA.scale.set(fl, (T < 0.3 ? T / 0.3 : 1) * (0.8 + 0.3 * Math.random()), fl);
      this.rkLight.intensity = 6 * fl;
      // the flame hits the cone shield and the smoke spills out (a trail of it while it flies)
      this.puffAcc = (this.puffAcc || 0) + dt * 50;
      while (this.puffAcc >= 1) {
        this.puffAcc -= 1; const k = Math.random();
        this.rk.localToWorld(_a.set(0, 1.25, 0)); _a.addScaledVector(_c.subVectors(this.rk.position, this.lastRk || this.rk.position), -k); const ang = Math.random() * 6.28;
        this.fireA.emit(_a, _b.set(Math.cos(ang) * 1.5, -0.6, Math.sin(ang) * 1.5), 0.2, 0.6, 0.4, 0.8, 2);
        this.puffA.emit(_a, _b.set(Math.cos(ang) * 1.2, -0.3 + Math.random() * 0.4, Math.sin(ang) * 1.2), 0.35, 2.2, 3.5, 0.6, 0.8, 0.2);
      }
    } else this.rkLight.intensity = damp(this.rkLight.intensity, 0, 4, fd);
    this.lastRk.copy(this.rk.position);
  }

  updatePapers(dt, t, fd) {
    const G = this.G, s = this.s; G_cam(G, _c);
    this.papers.forEach((m, i) => {
      const d = m.userData;
      if (s.papers === 1) { m.visible = true; d.out = 0; m.material.opacity = damp(m.material.opacity, 1, 2, dt); d.a += dt * d.v; m.position.set(_c.x + Math.cos(d.a) * 1.3, d.h + Math.sin(t * 1.3 + i) * 0.12, _c.z + Math.sin(d.a) * 1.3 - 0.2); m.lookAt(_c); m.rotateZ(Math.sin(t * 1.1 + i) * 0.2); }
      else if (s.papers === 2) { d.out = (d.out || 0) + fd; m.position.add(_a.set(-1.5 - i * 0.3, 1.6, -2.5).multiplyScalar(dt * fd / dt * d.out)); m.rotation.x += dt * 3; m.rotation.z += dt * 2; m.material.opacity = clamp01(1 - d.out / 3); m.visible = m.material.opacity > 0.01; if (!this.blowSnd) { this.blowSnd = true; whoosh(G, 2, 0.3); } }
      else { m.material.opacity = damp(m.material.opacity, 0, 3, dt); m.visible = m.material.opacity > 0.01; }
    });
    // the correction, glowing
    const cv = this.corrV = damp(this.corrV || 0, s.correction ? 1 : 0, 1.5, dt);
    this.correction.visible = cv > 0.01;
    if (this.correction.visible) { G.camera.getWorldDirection(_a).setY(0).normalize(); if (!this.corrPlaced) { this.corrPlaced = true; this.correction.position.copy(_c).addScaledVector(_a, 0.75).setY(_c.y - 0.05); } this.correction.lookAt(_c); this.correction.material.opacity = cv; this.corrGlow.material.opacity = 0.5 * cv; if (!this.corrSnd) { this.corrSnd = true; shimmer(G, 3, 0.15); } }
    // the bubble of empty space
    const vv = this.vacV = damp(this.vacV || 0, s.vacuum ? 1 : 0, 2, dt);
    this.vac.visible = vv > 0.01;
    if (this.vac.visible) {
      this.vac.lookAt(_c);   // the little rocket flies across your view (its nose is +x)
      this.vacShell.material.uniforms.a.value = vv; this.vacInner.material.opacity = 0.55 * vv;
      this.vacLabs[0].material.opacity = vv; this.vacLabs[1].material.opacity = this.vacLabs[2].material.opacity = s.vacuum === 2 ? vv : 0;
      if (s.vacuum === 2) this.vacX = (this.vacX ?? -0.22) + fd * 0.12; else this.vacX = -0.22;
      if (this.vacX > 0.26) this.vacX = -0.22;
      this.vacRocket.position.set(this.vacX, 0, 0);
      const S = this.vacGas.userData;
      this.vacGasD.forEach((q, i) => { q.t += dt * q.v * 2; if (q.t > 1) q.t -= 1; const on = s.vacuum === 2 ? 1 : 0, x = this.vacX - 0.08 - q.t * 0.3; S.pos.set([x, q.y * (1 + q.t * 3), q.z * (1 + q.t * 3)], i * 3); const b = on * vv * (1 - q.t) * (x > -0.4 ? 1 : 0); S.col.set([b * 0.6, b * 0.8, b], i * 3); S.size[i] = 0.01; });
      S.commit();
    }
  }

  updatePeopleA(dt, t) {
    const s = this.s, G = this.G, ph = s.phase, Gd = this.god, H = this.henry, E = this.esther, Rp = this.roope;
    const rkp = this.rk.getWorldPosition(_d).clone(); rkp.y += 1.5;
    const flying = this.fT != null && this.fT > 2.2 && !this.landed, launched = this.fT != null;
    // Goddard: checking his rocket, then back by the shelter; "All right, Henry. Light it."
    if (ph === 'field' || ph === 'arrive' || ph === 'verne') { if (walkToward(Gd, 1.1, -2.9, dt, { height: auburnHeight })) { Gd.g.rotation.y = damp(Gd.g.rotation.y, Math.atan2(FRAME.x - 1.1, FRAME.z + 2.9), 3, dt); Gd.pose = s.labels ? 'point' : 'work'; Gd.pointAt.copy(this.rk.localToWorld(_a.set(0, s.labels >= 3 ? 0.8 : s.labels >= 2 ? 0.4 : 2.5, 0))); Gd.look = Gd.pointAt.clone(); } }
    else if (ph === 'ready') { if (walkToward(Gd, 3.2, 1.6, dt, { height: auburnHeight, speed: 1.2 })) { Gd.pose = 'talk'; Gd.look = H.g.position.clone().setY(1.6); G_cam(G, _a); Gd.g.rotation.y = damp(Gd.g.rotation.y, Math.atan2(_a.x - 3.2, _a.z - 1.6), 3, dt); if (G.kids) Gd.look = rkp.clone(); } }
    else if (ph === 'launch' && !this.landed) { walkToward(Gd, 3.2, 1.6, dt, { height: auburnHeight }); Gd.pose = flying ? 'point' : 'gasp'; Gd.pointAt.copy(rkp); Gd.look = rkp.clone(); }
    else if (ph === 'launch' || ph === 'landed' || ph === 'descend') { if (walkToward(Gd, -14, -16, dt, { height: auburnHeight, speed: 1.4 })) { Gd.pose = s.descend ? 'point' : 'cheer'; Gd.pointAt.set(0, 60, -150); Gd.look = s.descend ? Gd.pointAt.clone() : rkp.clone(); } }
    else { if (walkToward(Gd, -1.6, 0.3, dt, { height: auburnHeight, speed: 1.2 })) { Gd.pose = s.correction ? 'idle' : 'talk'; G_cam(G, _a); Gd.look = _a.clone(); Gd.g.rotation.y = damp(Gd.g.rotation.y, Math.atan2(_a.x + 1.6, _a.z - 0.3), 3, dt); } }
    animatePerson(Gd, t, dt);
    // Henry: walks up with the blowtorch on its pole, lights it, hurries back
    this.henryTorch.userData.flicker(t, 0.8);
    this.henryTorch.visible = !(!G.kids && s.torch === 1) && !(s.byYou);
    if (s.henry >= 1 && !launched) { if (walkToward(H, 1.1, -1.0, dt, { height: auburnHeight })) { this.henryReady = true; H.g.rotation.y = damp(H.g.rotation.y, Math.atan2(FRAME.x - 1.1, FRAME.z + 1.0), 4, dt); H.pose = s.henry >= 2 ? 'point' : 'hold'; H.pointAt.copy(this.rk.localToWorld(_a.set(0, 2.3, 0))); H.look = H.pointAt.clone(); } }
    else if (launched && !this.landed) { if (walkToward(H, 4.0, 2.4, dt, { height: auburnHeight, speed: 2.6 })) { H.pose = flying ? 'point' : 'gasp'; H.pointAt.copy(rkp); H.look = rkp.clone(); } }
    else if (this.landed && (ph === 'launch' || ph === 'landed' || ph === 'descend')) { if (walkToward(H, -16, -17.5, dt, { height: auburnHeight, speed: 1.6 })) { H.pose = 'cheer'; H.look = rkp.clone(); } }
    else if (!launched) { H.pose = 'idle'; H.look = null; H.glance = true; }
    else { H.pose = 'idle'; H.look = null; H.glance = true; }
    animatePerson(H, t, dt);
    // Esther films; Roope times it with his stopwatch
    E.pose = 'work'; E.look = rkp.clone(); this.crank.rotation.x = launched || s.labels ? t * 8 : 0; animatePerson(E, t, dt);
    Rp.g.rotation.y = damp(Rp.g.rotation.y, Math.atan2(rkp.x - Rp.g.position.x, rkp.z - Rp.g.position.z), 3, dt);
    Rp.pose = this.landed && ph !== 'papers' ? 'cheer' : flying ? 'point' : 'hold'; Rp.pointAt.copy(rkp); Rp.look = rkp.clone(); animatePerson(Rp, t, dt);
  }

  updateBaltic(dt, t, fast) {
    const G = this.G, s = this.s, fd = dt * fast, A = G.audio;
    this.clouds.material.uniforms.t.value = t;
    this.floodGlow.material.opacity = this.flood2Glow.material.opacity = 0.8 + 0.1 * Math.sin(t * 50);
    // the erector lowers away
    this.erector.rotation.z = damp(this.erector.rotation.z, s.v2 >= 1 ? -0.5 : 0, 0.5, dt);
    this.v2Lab.material.opacity = damp(this.v2Lab.material.opacity, s.v2 === 1 && !s.lights ? 1 : 0, 2, dt);
    // vapour from the liquid oxygen, before launch
    if (s.v2 < 3 && Math.random() < dt * 10) { this.v2.localToWorld(_a.set(0.8, 6 + Math.random() * 2, 0)); this.puffC.emit(_a, _b.set(0.8, -0.4, (Math.random() - 0.5) * 0.4), 0.5, 3.5, 4, 0.5, 0.4, -0.1); }
    // the engineers walk back to the bunker
    this.eng.forEach((P, i) => {
      if (s.v2 >= 1) { if (walkToward(P, 4.5 + i * 1.3, -3.5, dt, { height: balticHeight, speed: 1.6 })) { P.pose = s.v2 === 3 ? 'point' : 'idle'; P.pointAt.copy(this.v2.position).setY(this.v2.position.y + 10); P.look = P.pointAt.clone(); P.g.rotation.y = damp(P.g.rotation.y, Math.PI, 2, dt); } }
      else { P.pose = 'work'; P.look = null; }
      animatePerson(P, t, dt);
    });
    // remembrance lights
    const mv = this.memV = damp(this.memV || 0, s.lights ? 1 : 0, 0.6, dt);
    this.memorial.visible = mv > 0.01 && this.C.visible;
    if (this.memorial.visible) { const M = this.memorial.userData; this.memD.forEach((q, i) => { const on = clamp01(mv * 2 - q.at), b = on * (0.7 + 0.3 * Math.sin(t * 3 + q.ph)); M.pos.set([q.x, q.y, q.z], i * 3); M.col.set([b, b * 0.75, b * 0.4], i * 3); M.size[i] = 0.12; }); M.commit(); }
    // ignition, then lift-off: up through the clouds, leaning away toward the sea
    if (s.v2 >= 2 && this.ignT == null) { this.ignT = 0; if (A.ctx) { rumble(G, 10, 0.7, this.v2Base); A.noise(A.out(this.v2Base, 1.2, 20), { type: 'lowpass', f: 900, f2: 300, q: 0.7, peak: 0.8, a: 1.5, d: 12 }); } this.deer.lead.set(-140, 0, 60); this.deer.animals.forEach((o) => { o.wait = 0; }); }
    if (this.ignT != null) this.ignT += fd;
    if (s.v2 === 3 && this.liftT == null) { this.liftT = 0; if (A.ctx) { A.noise(A.out(null, 0.6), { type: 'lowpass', f: 1400, f2: 200, q: 0.6, peak: 0.9, a: 2, d: 14 }); awe(G, 16, 0.06, 55); } }
    let y = 0;
    if (this.liftT != null) { this.liftT += fd; const tt = this.liftT; y = 3 * tt * tt + 0.6 * tt * tt * tt; }
    this.v2Y = y;
    const lean = clamp01((y - 40) / 260) * 0.4;
    this.v2.position.set(PAD.x, this.v2Base.y + y, PAD.z - y * lean * 0.6);
    this.v2.rotation.x = -lean;
    const burning = this.ignT != null;
    this.flameC.visible = burning;
    if (burning) {
      const g = this.liftT != null ? 1 : clamp01(this.ignT / 2) * 0.5, fl = 0.85 + 0.25 * Math.random();
      this.flameC.scale.set(fl * (0.6 + 0.4 * g), g * (0.85 + 0.3 * Math.random()), fl * (0.6 + 0.4 * g));
      this.v2Light.intensity = 140 * g * fl;
      // smoke billowing out along the ground, flame glow below
      if (y < 60) for (let i = 0; i < 3; i++) { const ang = Math.random() * 6.28, sp2 = 6 + Math.random() * 8; this.puffC.emit(_a.set(PAD.x, 1.2 + y * 0.3, PAD.z), _b.set(Math.cos(ang) * sp2, 1 + Math.random() * 2, Math.sin(ang) * sp2 * 0.7), 3, 16, 7, 0.6 * g + 0.2, 0.35, 0.4); }
      this.v2.localToWorld(_a.set(0, -1.5, 0)); this.fireC.emit(_a, _b.set((Math.random() - 0.5) * 3, -12, (Math.random() - 0.5) * 3), 2.5, 6, 0.5, 0.8 * g, 1);
      if (y > 0 && Math.random() < 0.6) this.puffC.emit(_a.set(this.v2.position.x, this.v2.position.y - 6, this.v2.position.z), _b.set((Math.random() - 0.5) * 2, -3, (Math.random() - 0.5) * 2), 3, 10, 9, 0.45, 0.2, 0.0);
    } else this.v2Light.intensity = 0;
    const U = this.clouds.material.uniforms; U.glowP.value.copy(this.v2.position).setY(CLOUD); U.glowA.value = burning ? clamp01(1 - Math.abs(this.v2.position.y - CLOUD) / 120) * 1.2 + 0.15 * clamp01(y / 100) : 0;
    this.puffC.update(dt); this.fireC.update(dt);
  }

  // ---------- out in space ----------
  updateSpace(dt, t, fast) {
    const G = this.G, s = this.s, sp = this.space, R = sp.R;
    if (s.space && !sp.on) this.enterSpace();
    if (!s.space && sp.on) { sp.exit(); this.spT = 0; this.mapT = 0; }
    if (!sp.on) return;
    const E = sp.earth;
    this.spT = (this.spT || 0) + dt * fast;
    if (s.space === 2) this.mapT = (this.mapT || 0) + dt * fast;
    const mk = ease((this.mapT || 0) / 5);
    E.position.lerpVectors(this.E0, this.E1, mk); E.quaternion.slerpQuaternions(this.q0, this.q1, mk); E.updateMatrixWorld(true);
    const nP = lonLat(...PEEN, _a).clone();
    // the V-2 climbing to the edge of space (its height drawn three times bigger, so you can see it)
    const climb = ease(clamp01(this.spT / 6)), h = 0.085 * R * climb, T = this.spTrail.userData;
    for (let i = 0; i < 240; i++) { const f = i / 239 * climb, p = _b.copy(nP).multiplyScalar(R * 1.002 + 0.085 * R * ease(f)); T.pos.set([p.x, p.y, p.z], i * 3); const b = (0.3 + 0.7 * (i / 239)) * (1 - mk); T.col.set([b, b * 0.7, b * 0.35], i * 3); T.size[i] = 0.06; }
    T.commit();
    this.spDot.position.copy(nP).multiplyScalar(R * 1.002 + h); this.spDot.material.opacity = (1 - mk) * (0.7 + 0.3 * Math.sin(t * 9)); this.spDot.scale.setScalar(0.8 + 0.3 * Math.sin(t * 7));
    const lab = (l, v, p, off) => { l.material.opacity = damp(l.material.opacity, v, 2.5, dt); if (p) l.position.copy(p).add(off); };
    const wDot = this.spDot.getWorldPosition(_c);
    lab(this.spLabs.v2, this.spT > 4 && !s.race && mk < 0.5 ? 1 : 0, wDot, _d.set(0, 0.9, 0));
    G_cam(G, _b); lab(this.spLabs.first, this.spT > 5.5 && s.space === 1 ? 1 : 0, _b.clone().add(this.spF.clone().multiplyScalar(14)), _d.set(0, 3.2, 0));
    // the map: where the rocket builders went
    const A = this.spArcs.userData; let n = 0;
    const dot = (p, r, g, b, sz) => { if (n >= 700) return; A.pos.set([p.x, p.y, p.z], n * 3); A.col.set([r, g, b], n * 3); A.size[n] = sz; n++; };
    const arc = (to, k0, col) => {
      const k = clamp01(((this.mapT || 0) - k0) / 4), m = lonLat(...to, _d).clone(), N = 300;
      for (let i = 0; i < N; i++) { const f = i / N; if (f > k) break; const p = _b.copy(nP).lerp(m, f).normalize().multiplyScalar(R * (1.01 + 0.18 * Math.sin(Math.PI * f))); const head = k < 1 && f > k - 0.03; dot(p, col[0] * (head ? 2 : 1), col[1] * (head ? 2 : 1), col[2] * (head ? 2 : 1), head ? 0.3 : 0.1); }
      return k;
    };
    const kU = s.space === 2 ? arc(WSANDS, 3, [1, 0.75, 0.4]) : 0, kS = s.space === 2 ? arc(MOSCOW, 4.5, [1, 0.45, 0.35]) : 0;
    // the race: from both, little lights go round the world
    if (s.race) {
      this.raceT = (this.raceT || 0) + dt * fast;
      for (const [o, ph, col] of [[WSANDS, 0, [1, 0.8, 0.5]], [MOSCOW, 0.5, [1, 0.5, 0.4]]]) {
        const st = lonLat(...o, _b).clone(), ax = _d.copy(st).cross(UP).normalize();
        for (let i = 0; i < 40; i++) { const a = this.raceT * 0.9 - i * 0.02 + ph * 0; const rr = R * (1.02 + Math.min(0.12, this.raceT * 0.05)); const p = st.clone().applyAxisAngle(ax, a).multiplyScalar(rr); dot(p, col[0] * (1 - i / 40), col[1] * (1 - i / 40), col[2] * (1 - i / 40), 0.14); }
      }
      if (this.raceT > 4 && !this.beeped) { this.beeped = true; beeps(G, 5, 0.12); }
    }
    while (n < 700) dot(_b.set(0, 0, 0), 0, 0, 0, 0);
    A.commit();
    [PEEN, WSANDS, MOSCOW].forEach((p, i) => { const pin = this.spPins[i]; pin.position.copy(lonLat(...p, _b)).multiplyScalar(R * 1.01); pin.material.opacity = s.space === 2 ? (i === 0 ? 1 : i === 1 ? kU : kS) * (0.7 + 0.3 * Math.sin(t * 5 + i)) : 0; });
    const wp = (ll) => E.localToWorld(lonLat(...ll, _b).multiplyScalar(R * 1.05)).clone();
    lab(this.spLabs.peen, s.space === 2 && mk > 0.6 ? 1 : 0, wp(PEEN), _d.set(0, 1.4, 0));
    lab(this.spLabs.usa, kU >= 1 ? 1 : 0, wp(WSANDS), _d.set(-1, 1.6, 0));
    lab(this.spLabs.ussr, kS >= 1 ? 1 : 0, wp(MOSCOW), _d.set(2, 1.6, 0));
    lab(this.spLabs.race, s.race && this.raceT > 2 ? 1 : 0, E.position, _d.set(0, R * 1.25, 0));
  }

  enterSpace() {
    const G = this.G, sp = this.space, R = sp.R;
    const cam = G.camera.getWorldPosition(V3()), f = G.camera.getWorldDirection(V3()).setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const right = V3().crossVectors(f, UP).normalize();
    this.spF = f; this.spT = 0; this.mapT = 0; this.raceT = 0; this.beeped = false;
    const basis = (c, t1, out) => { const z = c.clone().normalize(), y = t1.clone().addScaledVector(z, -t1.dot(z)).normalize(), x = V3().crossVectors(y, z); return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); };
    const north = (c) => V3(0, 1, 0);
    const frame = (llLocal, wC, wUp) => { const c = lonLat(...llLocal); const qL = basis(c, north(c), new THREE.Quaternion()), qW = basis(wC, wUp, new THREE.Quaternion()); return qW.multiply(qL.invert()); };
    // near: the Earth below you, Peenemünde ahead on the curve, near the edge of the disc
    const th = 0.36, n0 = UP.clone().multiplyScalar(Math.cos(th)).addScaledVector(f, Math.sin(th));
    this.E0 = cam.clone().addScaledVector(UP, -1.18 * R); this.q0 = frame(PEEN, n0, f);
    // far: the whole Earth ahead of you, the Atlantic in the middle
    this.E1 = cam.clone().addScaledVector(f, 2.9 * R).addScaledVector(UP, -0.12 * R); this.q1 = frame([46, -38], f.clone().negate(), UP);
    sp.sunDir.copy(UP).multiplyScalar(0.7).addScaledVector(f, -0.35).addScaledVector(right, 0.6).normalize();
    sp.earth.position.copy(this.E0); sp.earth.quaternion.copy(this.q0);
    sp.enter(this.root);
    if (G.audio.ctx) { awe(G, 16, 0.08, 98); shimmer(G, 4, 0.15); }
  }

  dispose() {
    this.space.dispose();
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.sky.hideMoon();
  }
}

function G_cam(G, out) { return G.camera.getWorldPosition(out); }
function gableWallGeo(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }); g.translate(0, 0, -0.1); return g; }
let _gt = null;
function glowTexture() { return (_gt ||= canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); })); }

// A newspaper page (date, headline, a line of story, columns of grey text)
function paperTex(date, h1, h2, sub, gold = false) {
  return canvasTex(512, 680, (g, w, h) => {
    g.fillStyle = gold ? '#f4ead0' : '#e8e2d2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1a1a'; g.textAlign = 'center';
    g.font = 'bold 54px Georgia, serif'; g.fillText('THE NEWS', w / 2, 70);
    g.fillRect(24, 88, w - 48, 3); g.font = '20px Georgia, serif'; g.fillText(date, w / 2, 114); g.fillRect(24, 124, w - 48, 2);
    g.font = 'bold 44px Georgia, serif'; g.fillText(h1, w / 2, 190); if (h2) g.fillText(h2, w / 2, 240);
    g.font = 'italic 22px Georgia, serif';
    const words = sub.split(' '); let line = '', y = h2 ? 290 : 250;
    for (const wd of words) { if (g.measureText(line + wd).width > w - 70) { g.fillText(line, w / 2, y); y += 30; line = ''; } line += wd + ' '; }
    g.fillText(line, w / 2, y);
    g.fillStyle = 'rgba(40,40,40,0.35)';
    for (let c = 0; c < 3; c++) for (let i = 0; i < 18; i++) g.fillRect(30 + c * 155, y + 40 + i * 16, 140 - (i % 5 === 4 ? 50 : 0), 7);
    if (gold) { g.strokeStyle = '#c0901a'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); }
  });
}

// The journal page: Tsiolkovsky's rocket and his words, Goddard's first flight, and why a rocket works in space
function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 42px Georgia, serif'; g.textAlign = 'left';
  g.fillText('The rocket dreamers, 1903 to 1944', 40, 66);
  g.strokeStyle = INK; g.lineWidth = 3;
  // Tsiolkovsky's rocket
  const rx = 120;
  g.beginPath(); g.moveTo(rx - 22, 470); g.lineTo(rx - 22, 230); g.quadraticCurveTo(rx - 22, 150, rx, 130); g.quadraticCurveTo(rx + 22, 150, rx + 22, 230); g.lineTo(rx + 22, 470); g.stroke();
  g.beginPath(); g.moveTo(rx - 22, 470); g.lineTo(rx - 36, 515); g.lineTo(rx + 36, 515); g.lineTo(rx + 22, 470); g.stroke();
  g.strokeRect(rx - 15, 260, 30, 80); g.strokeRect(rx - 15, 350, 30, 80);
  g.font = 'italic 20px Georgia, serif'; g.fillStyle = INK; g.fillText('hydrogen', rx + 30, 300); g.fillText('oxygen', rx + 30, 395);
  g.fillStyle = 'rgba(224,120,42,0.5)'; g.beginPath(); g.moveTo(rx - 30, 520); g.lineTo(rx, 600); g.lineTo(rx + 30, 520); g.fill();
  g.fillStyle = INK; g.font = 'italic 24px Georgia, serif'; g.fillText('Tsiolkovsky, 1903', 40, 640);
  g.font = 'italic 26px Georgia, serif'; g.fillText('V = c · ln (M₀ / M₁)', 240, 150);
  g.font = 'italic 22px Georgia, serif'; g.fillText('"The Earth is the cradle of humanity,', 240, 200); g.fillText('but we cannot stay in the cradle forever."', 250, 230);
  // Goddard's flight
  const gx = 640, gy = 500;
  g.beginPath(); g.moveTo(gx, gy); g.quadraticCurveTo(gx + 150, gy - 300, gx + 300, gy); g.setLineDash([8, 8]); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#5a7a4a'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(gx + 270 + i * 16, gy + 6, 8, 0, 6.28); g.fill(); }
  g.fillStyle = INK; g.fillRect(gx - 3, gy - 60, 6, 60); g.fillRect(gx - 8, gy - 70, 16, 12);
  g.font = 'italic 22px Georgia, serif'; g.fillText('12.5 m', gx + 120, gy - 165); g.fillText('2.5 s', gx + 40, gy - 90); g.fillText('cabbages!', gx + 250, gy + 40);
  g.fillText('Goddard, 16 March 1926:', 560, 300); g.fillText('the first liquid-fuel rocket', 570, 330);
  // action and reaction
  g.font = 'italic 24px Georgia, serif';
  g.fillText('A rocket pushes on its own gas, so it works even in empty space.', 40, h - 72);
  g.fillText('1944: the V-2 was the first thing made by people to reach space.', 40, h - 34);
}
