// Era 2, Chapter 3 (n 10): Kepler's ellipses. Prague, 1600 to 1609.
//
// Kepler's attic study high above Prague's Old Town at night: a plank floor, beamed ceiling, a
// bookcase, a green tiled stove, a globe, a chart of his nested planets on the wall, a brass
// quadrant, and three stone arches in the north wall looking out over the red roofs: the street
// below running up to the Old Town Square, the Town Hall's clock tower, the twin spired towers of the
// Týn church, the Vltava with its stone bridge, and Prague Castle on its hill. Kepler sits at his desk
// (on his chair, knees under the desk); Tycho comes to work with him, guarding his logbooks; then
// he's gone and the books fly to Kepler's desk.
//
// Over the roofs floats Mars's orbit as Kepler saw it: Tycho's measurements as red dots. Kepler
// tries circle after circle; one comes oh so close but misses, and the circle shatters. Then the
// ellipse: it fits every dot, with the Sun off to one side. Then you draw one yourself, on a
// drawing board at the near end of Kepler's desk: two pins, a loop of string and a glowing pencil
// (Adults: grab it and go round, the string stays tight; Kids: it draws itself). The finished
// drawing lifts off the paper and flies out of the window onto Mars's path, which lights up again.
// Mars speeds up near the Sun and slows far away: equal slices of time sweep equal areas. And then
// (wow) Kepler's Dream: the Moon swells huge in the arches as if you're flying there. At the end a
// brand new brass telescope gleams on the windowsill: the next chapter.
// The orbit is drawn with its stretch exaggerated (Mars's real ellipse looks almost like a circle).
// World axes: -Z north, +X east, +Y up. The study floor is at y = TOP.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, walkToward, holdProp, dropProp } from '../people.js';
import { makeHerd, makeSmoke, makeTorch, Life } from '../life.js';
import { dress } from '../dress.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { grove, deciduousTree, conifer, bush } from '../trees.js';
import { glowPoints, shatter, awe, shimmer } from '../wow/fx.js';
import { loadProps } from '../props.js';
// Meem's brick town house with its stepped gable (models/props), waited for before the chapter builds
const PROPS = await loadProps(['house_north', 'house_north_lo', 'book_set', 'lantern']);
import { ease, clamp01, sunAt, house, gableRoof, gableWall, glow, label, Journal, INK, guideUpdate } from '../era2/common.js';

const TOP = 13, LAT = 50.09, SUNLON = 205;
const RX = 2.6, RZ = 2.2;                               // the study is 5.2 x 4.4 m
const ORR = new THREE.Vector3(0, TOP + 2.4, -9);          // Mars's orbit, floating over the roofs (framed by the middle arch)
const A = 1.9, E = 0.42, B = A * Math.sqrt(1 - E * E), C = A * E;   // the ellipse (Sun at the origin)
// the north wall's arches: [centre x, width, springing height]; the sill is SILL above the floor
const SILL = 0.78, OPEN = [[-1.85, 0.8, 2.0], [0, 2.0, 1.95], [1.85, 0.8, 2.0]];
// Kepler's desk (centre, size, height), his seat, and the drawing board on the desk's near end
const DX = 1.5, DZ = -0.8, DW = 1.6, DD = 0.75, DH = 0.8;
const KX = 1.85, KZ = -0.05, SEAT = 0.46;
const BX = 1.02, BZ = -0.72, BY = TOP + DH + 0.035;     // the paper's height
const BA = 0.155, BB = BA * Math.sqrt(1 - E * E), BC = BA * E, PW = 0.44, PH = 0.34;
const BINS = 120;
const N1 = noise2(101), N2 = noise2(103);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _w0 = new THREE.Vector3(), _w1 = new THREE.Vector3(), _dq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _bq = new THREE.Quaternion();
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// Prague Castle sits on its own hill across the river (to the north-west), facing us
const CAS = { x: -600, z: -800, yaw: Math.atan2(600, 800), h: 50 };
const casLocal = (x, z) => { const dx = x - CAS.x, dz = z - CAS.z, c = Math.cos(CAS.yaw), s = Math.sin(CAS.yaw); return [dx * c - dz * s, dx * s + dz * c]; };
function castleHill(x, z) {
  const [lx, lz] = casLocal(x, z), d = Math.hypot(lx * (lx > 0 ? 1.1 : 0.5), lz * 1.3);
  return CAS.h * sstep(1.3 - d / 220);
}
export function groundHeight(x, z) { return (N2(x / 9, z / 9) - 0.5) * 0.2 + (z < -450 ? castleHill(x, z) : 0); }
const RIVER = (z) => -330 + Math.sin(z / 260) * 50;      // the Vltava's middle (x), running north-south
const SQ = { x: 18, z: -128, r: 34 };                    // the Old Town Square
const GD = { x: 30, z: -34 };                            // a walled garden behind the houses, below the east arch

// Town windows as flat panes (2 triangles each, and only the ones facing our way): a share glow
// warm with a cross of glazing bars, the rest are dark glass. Like era2/common.js windows(), lighter.
function winQuads(list, { lit = 0.4, w = 0.55, h = 0.8, seed = 3, warm = 0xffb45a, dark = 0x1a1a22 } = {}) {
  const k = new Kit(), r = rng(seed), c = new THREE.Color();
  for (const it of list) {
    const on = r() < lit, sh = 0.7 + r() * 0.5, nx = Math.sin(it.yaw), nz = Math.cos(it.yaw);
    if (nx * -it.p.x + nz * -it.p.z < 0) continue;
    c.setHex(on ? warm : dark); if (on) c.multiplyScalar(sh);
    k.add(new THREE.PlaneGeometry(w, h), c.getHex(), [it.p.x, it.p.y, it.p.z], [0, it.yaw, 0]);
    if (on) { const p = [it.p.x + nx * 0.015, it.p.y, it.p.z + nz * 0.015]; k.add(new THREE.PlaneGeometry(w, 0.05), 0x2a1a10, p, [0, it.yaw, 0]); k.add(new THREE.PlaneGeometry(0.05, h), 0x2a1a10, p, [0, it.yaw, 0]); }
  }
  return k.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
}

// Mars on the ellipse at mean anomaly M (radians): solve Kepler's equation, return local position
function marsAt(M, out) {
  let Ea = M; for (let i = 0; i < 6; i++) Ea -= (Ea - E * Math.sin(Ea) - M) / (1 - E * Math.cos(Ea));
  return out.set(A * Math.cos(Ea) - C, 0, -B * Math.sin(Ea));
}

// Turn a bone so it points (toward its child) along a world direction
function aimBone(bone, child, want, k = 1) {
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(false, false);
  bone.getWorldPosition(_w0); child.getWorldPosition(_w1);
  _w1.sub(_w0).normalize(); _dq.setFromUnitVectors(_w1, want);
  bone.getWorldQuaternion(_bq); _bq.premultiply(_dq);
  bone.parent.getWorldQuaternion(_pq).invert(); _bq.premultiply(_pq);
  bone.quaternion.slerp(_bq, k);
}

export default class Kepler {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    // you stand in the middle of the study, the drawing board an arm's length ahead on your right
    this.start = { pos: new THREE.Vector3(0.45, 0, -0.15), yaw: 0 };
    this.s = {
      phase: 'arrive', guide: null, hour: 21,
      tycho: 1,       // 1 here, 2 walking out of the door, 0 gone
      books: 0,       // 1 = the logbooks fly to Kepler's desk
      orbit: 0,       // the orbit model showing
      dots: 0,        // Tycho's measurements shown
      circ: 0,        // circles tried (1..4); 5 = the last one shatters
      ell: 0,         // the ellipse
      pen: 0,         // ch10_06: 1 = the pencil is yours to take, 2 = drawing, 3 = the drawing flies out, 4 = landed
      sweep: 0,       // ch10_07: equal areas
      tables: 0,      // ch10_08
      dream: 0,       // ch10_09
      galileo: 0,     // ch10_10: the new telescope on the windowsill
      journal: 0,
    };
    this.t = 0; this.penA = 0; this.bins = new Uint8Array(BINS); this.binN = 0; this.flyT = 0;
    G.world.height = (x, z) => (Math.abs(x) < RX && Math.abs(z) < RZ ? TOP + 0.05 : groundHeight(x, z));   // (the planks are 5 cm thick)
    G.world.bounds = 2.1; G.world.blockers = [];
    G.sky.fogFar = 2200; G.sky.mist = 0.05;
    G.sky.setPlace({ lat: LAT, year: 1605, sunLon: SUNLON });
    this.life = new Life(this.root);
    this.buildCity();
    this.buildStudy();
    this.buildBoard();
    this.buildPeople();
    this.buildOrbit();
    this.journal = new Journal(this, drawJournal);
    this.registerInteractables();
    this.bellT = 6;
  }

  // ---------- Prague by night ----------
  buildCity() {
    const k = new Kit(), r = rng(8), wins = [], TP = PROPS.fresh();
    const SIZE = 3000, SEG = 140, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color(), cob = new THREE.Color(0x5a544c), grass = new THREE.Color(0x3a4a2e), sq = new THREE.Color(0x6a6258);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.7) * (SIZE / 2) / r0 : 0; x *= kk; z *= kk;
      p.setXYZ(i, x, Math.abs(x - RIVER(z)) < 70 ? -4 : groundHeight(x, z), z);
      c.copy(Math.hypot(x - SQ.x, z - SQ.z) < SQ.r + 4 ? sq : Math.abs(x) < 420 && z > -600 && z < 400 ? cob : grass).lerp(grass, N1(x / 50, z / 50) * 0.3);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); this.root.add(new THREE.Mesh(g, FLAT));
    const river = new THREE.Mesh(new THREE.PlaneGeometry(150, 6000), new THREE.MeshPhongMaterial({ color: 0x0c1824, specular: 0x8899bb, shininess: 70 }));
    river.rotation.x = -Math.PI / 2; river.position.set(RIVER(0), -2.5, 0); this.root.add(river);
    this.buildBridge(k);
    // Old Town: streets of tall houses all round. Near us they're a storey or two lower than our
    // attic (so you see over them), with a street running north to the square; further out, taller.
    const ROOFS = [0x8a3424, 0x9a4028, 0x7a3020, 0x6a3a2a, 0x8a4a30], WALLS = [0xe0d2b0, 0xd4c094, 0xc8a878, 0xb8b0a0, 0xd8c8b8, 0xe0c8a0, 0xc8b8a0, 0xd8b890];
    for (let gx = -280; gx <= 260; gx += 16) for (let gz = -520; gz <= 320; gz += 15) {
      let x = gx + (r() - 0.5) * 4; const z = gz + (r() - 0.5) * 4;
      const roll = r(), wr = r(), hr = r(), rr = r(), wall = r(), roofC = r(), gf = r(), st = r(), tb = r();
      if (z > -6) continue;                                                   // behind the study's walls: never seen
      if (Math.abs(x) < 12 && z > -14) continue;                              // right under our windows
      if (Math.abs(x) < 5 && z < 0 && z > -100) continue;                     // the street north to the square
      if (Math.hypot(x - SQ.x, z - SQ.z) < SQ.r) continue;                    // the square
      if (Math.abs(x - GD.x) < 15 && Math.abs(z - GD.z) < 13) continue;     // a walled garden
      if ((Math.abs(x - 32) < 22 && z < -150 && z > -222) || (x > -48 && x < -10 && z > -120 && z < -100)) continue;   // the Týn church, the Town Hall
      if (Math.abs(x - RIVER(z)) < 80) continue;
      if (roll < 0.08) continue;
      const near = Math.hypot(x, z) < 95, street = Math.abs(x) < 22 && z < 0 && z > -100;
      const w = 8 + wr * 4, h = near ? 6 + hr * 2.4 : 8 + hr * 6;
      if (street && Math.abs(x) < 16) x = Math.sign(x) * 8.6;                // line the street up: fronts 4 m from its middle
      const yaw = street ? (x > 0 ? -Math.PI / 2 : Math.PI / 2) : Math.round(rr * 4) * Math.PI / 2;
      // Meem's house model within 150 m (simplified past 50 m); the plain shapes further out
      const dist = Math.hypot(x, z), model = dist < 50 ? 'house_north' : dist < 150 ? 'house_north_lo' : null;
      house(k, { x, y: groundHeight(x, z), z, w, d: 9, h, roof: near ? 3.4 + hr * 1.2 : undefined, yaw, wall: WALLS[Math.floor(wall * WALLS.length)], roofCol: ROOFS[Math.floor(roofC * ROOFS.length)], gableFront: gf < 0.6, stepped: st < 0.08, timber: tb < 0.15 ? 0x3a2a1c : null, props: model && TP, model }, wins);
    }
    // lanterns on iron brackets along the street, so you can see the people walking below
    for (let i = 0; i < 6; i++) {
      const z = -20 - i * 14, sx = i % 2 ? 1 : -1, x = sx * 3.3;
      k.box(0.7, 0.05, 0.05, 0x1a1a1a, [x - sx * 0.35, 3.6, z]); if (!TP.add('lantern', x - sx * 0.6, 3.6 - PROPS.size('lantern').y * 1.4, z, 0, { s: 1.4 })) k.box(0.22, 0.3, 0.22, 0x2a2418, [x - sx * 0.6, 3.4, z]);
      const gl = glow(0xffc070, 2.2, 0.9); gl.position.set(x - sx * 0.6, 3.35, z); this.root.add(gl);
    }
    // the house we're in: tall plastered walls under the study, with a cornice
    k.box(RX * 2 + 0.6, TOP, RZ * 2 + 0.6, 0xd8c8a8, [0, TOP / 2, 0]);
    k.box(RX * 2 + 0.9, 0.3, RZ * 2 + 0.9, 0xb8a888, [0, TOP - 0.2, 0]);
    k.add(gableRoof(RX * 2 + 0.6, RZ * 2 + 0.6, 3.2, 0.35), 0x7a3020, [0, TOP + 3.4, 0]);
    this.buildSquare(k, wins);
    // the walled garden: a low stone wall with a gate, two old trees turning gold, bushes, a bench
    for (const [w, d, ox, oz] of [[22, 0.5, 0, -9], [22, 0.5, 0, 9], [0.5, 18, -11, 0], [0.5, 18, 11, 0]]) {
      if (oz === 9) { for (const sx of [-1, 1]) k.box(9.5, 1.6, 0.5, 0x8a8070, [GD.x + sx * 6.25, 0.8, GD.z + oz]); k.box(0.6, 2.2, 0.6, 0x7a7060, [GD.x - 1.5, 1.1, GD.z + oz]); k.box(0.6, 2.2, 0.6, 0x7a7060, [GD.x + 1.5, 1.1, GD.z + oz]); continue; }
      k.box(w, 1.6, d, 0x8a8070, [GD.x + ox, 0.8, GD.z + oz]); k.box(w + 0.2, 0.15, d + 0.2, 0x9a9080, [GD.x + ox, 1.67, GD.z + oz]);
    }
    k.box(1.8, 0.08, 0.45, 0x5a3a22, [GD.x + 4, 0.45, GD.z + 6]); for (const sx of [-0.8, 0.8]) k.box(0.1, 0.45, 0.4, 0x3a2a1a, [GD.x + 4 + sx, 0.22, GD.z + 6]);
    k.box(8, 0.04, 1.4, 0x6a6052, [GD.x, 0.02, GD.z + 4.5]);
    const gt = [[-4, -3, 9.5, 2], [5, -4, 8.5, 5]].map(([ox, oz, h, sd]) => { const t = deciduousTree({ seed: sd, height: h, detail: 'mid', leafColors: [0xffd27a, 0xf2b25a, 0xe8c878, 0xffe0a0] }); t.group.position.set(GD.x + ox, groundHeight(GD.x + ox, GD.z + oz) - 0.1, GD.z + oz); t.group.rotation.y = sd; this.root.add(t.group); return t.tris; });
    const gb = grove(bush, [[-9, -7], [-8.5, 6], [8.5, 7], [9, -1], [0, -7.5]].map(([ox, oz], i) => ({ x: GD.x + ox, y: 0, z: GD.z + oz, s: 0.9 + (i % 3) * 0.2 })), { detail: 'mid', variants: 2, seed: 6, leafColors: [0xd8e0a0, 0xe8c878] });
    this.root.add(gb.group); this.gardenTris = gt[0] + gt[1] + gb.tris;
    this.buildCastle(k, wins);
    this.root.add(k.mesh(), TP.build({ glow: 0x231c16 }));
    this.root.add(winQuads(wins, { lit: 0.35, seed: 3 }));
    // smoke from chimneys, bells, a few horses in the square
    this.smokes = [[40, 14, -40], [-60, 20, -80], [20, 22, 60], [-120, 18, -200]].map((q) => this.life.add(makeSmoke(new THREE.Vector3(...q), { n: 6, rise: 9, size: 1.4, opacity: 0.12, color: 0x8a90a0 })));
    this.horses = this.life.add(makeHerd('horse', { n: 3, area: { x: SQ.x + 8, z: SQ.z - 6, r: 12 }, height: groundHeight, seed: 5 }));
  }

  // The stone bridge (Charles Bridge): arches on piers with cutwaters, statues, a gate tower at each end
  buildBridge(k) {
    const bz = -120, bx = RIVER(bz), L = 170, STONE = 0x8a8070, DK = 0x5a5248, ROOF = 0x2a2a30;
    const sh = new THREE.Shape(); sh.moveTo(-L / 2, -5); sh.lineTo(L / 2, -5); sh.lineTo(L / 2, 7); sh.lineTo(-L / 2, 7); sh.closePath();
    const span = 13, pier = (L - 8 * span) / 9;
    for (let i = 0; i < 8; i++) {
      const x0 = -L / 2 + pier + i * (span + pier), h = new THREE.Path();
      h.moveTo(x0, -5); h.lineTo(x0 + span, -5); h.lineTo(x0 + span, -0.5); h.absarc(x0 + span / 2, -0.5, span / 2, 0, Math.PI, false); h.lineTo(x0, -5);
      sh.holes.push(h);
      // a cutwater (pointed pier nose) on both sides of each pier
      if (i > 0) for (const s of [-1, 1]) k.cyl(0.001, pier * 0.7, 8, 3, DK, [bx + x0 - pier / 2, 0, bz + s * 5.4], [0, s > 0 ? 0 : Math.PI, 0]);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 9.5, bevelEnabled: false, curveSegments: 10 }); g.translate(0, 0, -4.75);
    k.add(g, STONE, [bx, 0, bz]);
    for (const s of [-1, 1]) {
      k.box(L, 1.1, 0.5, DK, [bx, 7.55, bz + s * 4.5]);                                // parapets
      for (let i = 0; i < 15; i++) {                                                   // the statues along the parapets
        const x = bx - L / 2 + 8 + i * ((L - 16) / 14);
        k.box(1.2, 1.4, 1.2, DK, [x, 8.8, bz + s * 4.5]); k.cyl(0.35, 0.5, 2.2, 6, 0x3a3630, [x, 10.6, bz + s * 4.5]); k.ball(0.32, 0, 0x3a3630, [x, 12, bz + s * 4.5]);
      }
    }
    // gate towers: the Old Town tower (east) and the two Lesser Town towers (west)
    const tower = (x, h, w) => {
      k.box(w, h, w, 0x7a7060, [x, h / 2, bz]);
      k.box(w + 0.2, 7, 4.5, 0x1a1612, [x, 3.5 + 7, bz]);                             // the gate arch through it
      for (const y of [h * 0.45, h * 0.75]) k.box(w + 0.4, 0.5, w + 0.4, STONE, [x, y, bz]);
      for (const s of [-1, 1]) k.box(0.2, 3, 1.4, 0x1a1a22, [x + s * (w / 2 + 0.05), h * 0.62, bz]);
      k.cyl(0.001, w * 0.78, h * 0.55, 4, ROOF, [x, h + h * 0.275, bz], [0, Math.PI / 4, 0]);
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { k.cyl(0.6, 0.6, 3, 6, 0x7a7060, [x + ox * w / 2, h + 1, bz + oz * w / 2]); k.cyl(0.001, 0.8, 4.5, 6, ROOF, [x + ox * w / 2, h + 4.7, bz + oz * w / 2]); }
    };
    tower(bx + L / 2 + 6, 30, 11); tower(bx - L / 2 - 6, 26, 9); tower(bx - L / 2 - 20, 18, 8);
  }

  // The Old Town Square: the Týn church's twin towers, the Town Hall's clock tower, market stalls
  buildSquare(k, wins) {
    const TS = 0x8a8478, TS2 = 0x9a9488, SL = 0x2e2e36, GOLD = 0xd8b040, DK = 0x1a1a22;
    const tx = 32, tz = -166;
    // the nave behind the towers: buttresses, tall pointed windows, a steep slate roof
    k.box(20, 30, 44, TS, [tx, 15, tz - 26]); k.add(gableRoof(44, 20, 20, 0.3).rotateY(Math.PI / 2), SL, [tx, 30, tz - 26]);
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      const z = tz - 8 - i * 7.2;
      k.box(1.6, 24, 2.2, TS2, [tx + s * 10.8, 12, z]); k.cyl(0.001, 0.9, 5, 4, SL, [tx + s * 10.8, 26.5, z]);
      if (i < 5) k.box(0.2, 11, 2.6, DK, [tx + s * 10.05, 15, z - 3.6]);
    }
    // the front gable between the towers, with the gold Madonna
    k.add(gableWall(13, 15, 0.6), TS, [tx, 30, tz - 3.4]); k.cyl(1.5, 1.5, 0.3, 16, GOLD, [tx, 35, tz - 3], [Math.PI / 2, 0, 0]);
    k.box(3, 9, 0.3, DK, [tx, 20, tz - 3.9]);
    for (const s of [-1, 1]) {
      const sx = tx + s * 8.5;
      k.box(9, 48, 9, TS, [sx, 24, tz]);
      for (const y of [12, 24, 36, 46]) k.box(9.6, 0.6, 9.6, TS2, [sx, y, tz]);
      for (const y of [30, 41]) { k.box(1.4, 5.5, 0.3, DK, [sx, y, tz + 4.6]); k.box(0.3, 5.5, 1.4, DK, [sx + s * 4.6, y, tz]); }
      k.box(10.2, 1.4, 10.2, TS2, [sx, 48.7, tz]);
      k.cyl(0.001, 4.6, 26, 8, SL, [sx, 49.4 + 13, tz]); k.ball(0.75, 0, GOLD, [sx, 75.8, tz]);
      for (const [ox, oz] of [[-4.2, -4.2], [4.2, -4.2], [-4.2, 4.2], [4.2, 4.2]]) { k.cyl(0.9, 0.9, 4, 8, TS2, [sx + ox, 51.4, tz + oz]); k.cyl(0.001, 1.1, 9, 8, SL, [sx + ox, 57.9, tz + oz]); k.ball(0.3, 0, GOLD, [sx + ox, 62.6, tz + oz]); }
      for (const [ox, oz] of [[0, -4.4], [0, 4.4], [-4.4, 0], [4.4, 0]]) { k.cyl(0.001, 0.7, 7, 6, SL, [sx + ox, 53, tz + oz]); k.ball(0.22, 0, GOLD, [sx + ox, 56.7, tz + oz]); }
    }
    // the Old Town Hall: the hall itself and its tall tower, with the astronomical clock facing the square
    const hx = -18, hz = -110;
    k.box(7, 58, 7, 0x8a8070, [hx, 29, hz]);
    for (const y of [14, 30, 44]) k.box(7.5, 0.5, 7.5, 0x9a9080, [hx, y, hz]);
    k.box(8.6, 1.4, 8.6, 0x9a9080, [hx, 50.5, hz]);
    for (let i = 0; i < 6; i++) for (const [ox, oz, rot] of [[-3.9 + i * 1.56, 3.9, 0], [-3.9 + i * 1.56, -3.9, 0], [3.9, -3.9 + i * 1.56, 0], [-3.9, -3.9 + i * 1.56, 0]]) k.box(0.7, 1, 0.7, 0x9a9080, [hx + ox, 51.7, hz + oz], [0, rot, 0]);
    k.cyl(0.001, 4.4, 11, 4, SL, [hx, 64, hz], [0, Math.PI / 4, 0]); k.ball(0.5, 0, GOLD, [hx, 69.7, hz]);
    for (const [ox, oz] of [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]]) { k.cyl(0.5, 0.5, 2.4, 6, 0x9a9080, [hx + ox, 53.4, hz + oz]); k.cyl(0.001, 0.7, 4.5, 6, SL, [hx + ox, 56.8, hz + oz]); }
    for (const y of [22, 36]) k.box(1.2, 3, 0.3, DK, [hx, y, hz + 3.6]);
    k.box(24, 14, 12, 0xd0c4a8, [hx - 15, 7, hz - 1]); k.add(gableRoof(24, 12, 6, 0.3), 0x8a3424, [hx - 15, 14, hz - 1]);
    for (let i = 0; i < 6; i++) for (const y of [5, 10]) wins.push({ p: new THREE.Vector3(hx - 25 + i * 3.6, y, hz + 5.05), yaw: 0 });
    const clock = canvasTex(256, 256, (cg) => { cg.fillStyle = '#1a2a5a'; cg.beginPath(); cg.arc(128, 128, 120, 0, 6.28); cg.fill(); cg.fillStyle = '#3a6a9a'; cg.beginPath(); cg.arc(128, 128, 80, 0, 6.28); cg.fill(); cg.fillStyle = '#7a4a2a'; cg.beginPath(); cg.arc(128, 128, 80, 0.4, 2.74); cg.fill(); cg.strokeStyle = '#d8b040'; cg.lineWidth = 8; for (const R of [118, 80, 40]) { cg.beginPath(); cg.arc(128, 128, R, 0, 6.28); cg.stroke(); } cg.fillStyle = '#d8b040'; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; cg.fillRect(128 + Math.cos(a) * 100 - 3, 128 + Math.sin(a) * 100 - 3, 6, 6); } cg.lineWidth = 6; cg.beginPath(); cg.moveTo(128, 128); cg.lineTo(128 + 70, 128 - 40); cg.stroke(); });
    const cm = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), new THREE.MeshBasicMaterial({ map: clock, color: 0x9a9aa0 })); cm.position.set(hx, 10, hz + 3.8); this.root.add(cm);
    k.box(5.6, 6, 0.3, 0x5a5048, [hx, 10, hz + 3.6]); k.cyl(0.001, 3.2, 2, 4, SL, [hx, 13.9, hz + 3.6], [0, Math.PI / 4, 0]);
    // market stalls with striped awnings, a well
    const STR = [0xa83a2a, 0x2a5a8a, 0xc8a040, 0x3a6a3a];
    for (let i = 0; i < 6; i++) {
      const a = 0.5 + i * 0.9, x = SQ.x + Math.cos(a) * 20, z = SQ.z + Math.sin(a) * 20, yaw = -a + Math.PI / 2;
      k.box(2.6, 0.9, 1.4, 0x5a3a22, [x, 0.45, z], [0, yaw, 0]);
      for (const ox of [-1.2, 1.2]) k.box(0.1, 2.3, 0.1, 0x3a2a1a, [x + Math.cos(yaw) * ox, 1.15, z - Math.sin(yaw) * ox], [0, yaw, 0]);
      k.box(3, 0.08, 1.9, STR[i % 4], [x, 2.35, z], [0.25, yaw, 0]);
    }
    k.cyl(1.4, 1.5, 0.9, 12, 0x6a6258, [SQ.x, 0.45, SQ.z]); k.cyl(0.08, 0.08, 2.4, 4, 0x2a2a2a, [SQ.x, 2, SQ.z]);
  }

  // Prague Castle on its hill: curtain walls and round towers, the long palace with rows of windows,
  // St Vitus cathedral (buttresses and the great tower with its green helm), St George's twin towers
  buildCastle(k, wins) {
    const { x: cx, z: cz, yaw } = CAS, cy = groundHeight(cx, cz), cw = [];
    const c = Math.cos(yaw), s = Math.sin(yaw), P = (lx, ly, lz) => [cx + lx * c + lz * s, cy + ly, cz - lx * s + lz * c];
    const box = (w, h, d, col, lx, ly, lz) => k.box(w, h, d, col, P(lx, ly, lz), [0, yaw, 0]);
    const WALL = 0xd8d0c0, ST = 0xa8a090, RF = 0x5a3a2e, GR = 0x5a8a6a, SLT = 0x3a4a44;
    // curtain wall down the slope in front, with round towers and battlements
    box(300, 30, 3, ST, 0, -8, 42);
    for (let i = 0; i < 60; i++) box(2, 1.6, 3.2, ST, -148 + i * 5, 7.8, 42);
    for (const lx of [-150, -75, 0, 75, 150]) { k.cyl(6, 6.5, 32, 10, ST, P(lx, -5, 43)); k.cyl(0.001, 7.5, 12, 10, RF, P(lx, 17, 43)); }
    // the palace: a long wing facing us, three rows of windows, and a side wing
    box(250, 24, 24, WALL, -20, 12, 18); k.add(gableRoof(250, 24, 9, 0.4), RF, P(-20, 24, 18), [0, yaw, 0]);
    box(252, 0.8, 24.6, ST, -20, 8, 18);
    for (let i = 0; i < 46; i++) for (const ly of [5, 12, 19]) cw.push({ p: new THREE.Vector3(...P(-140 + i * 5.3, ly, 30.1)), yaw });
    box(24, 22, 90, WALL, 110, 11, -30); k.add(gableRoof(90, 24, 9, 0.4).rotateY(Math.PI / 2), RF, P(110, 22, -30), [0, yaw, 0]);
    // St Vitus behind: the long choir with buttresses and pinnacles, the great tower with a green helm
    box(100, 34, 30, 0x9a9488, -10, 17, -25); k.add(gableRoof(100, 30, 16, 0.4), SLT, P(-10, 34, -25), [0, yaw, 0]);
    for (let i = 0; i < 11; i++) { const lx = -58 + i * 10; box(2.4, 28, 5, 0x8a8478, lx, 14, -8); k.cyl(0.001, 1.1, 7, 4, 0x6a665e, P(lx, 31.5, -8)); }
    const tx = -40;
    box(18, 66, 18, 0x8a8478, tx, 33, -4);
    for (const ly of [22, 44, 60]) box(18.8, 1, 18.8, 0x9a9488, tx, ly, -4);
    box(3, 12, 0.4, 0x1a1a22, tx, 50, 5.1);
    k.cyl(7, 9.5, 8, 8, GR, P(tx, 70, -4)); k.cyl(4, 6.5, 8, 8, GR, P(tx, 78, -4)); k.cyl(1.6, 1.6, 5, 8, GR, P(tx, 84.5, -4)); k.cyl(0.001, 2.2, 9, 8, GR, P(tx, 91.5, -4)); k.ball(1, 0, 0xd8b040, P(tx, 96.5, -4));
    k.cyl(0.001, 2.6, 26, 8, SLT, P(15, 47, -25));                                   // the little spire over the crossing
    // St George's basilica: two slim white towers
    for (const lx of [55, 63]) { box(6, 30, 6, 0xe8dcc8, lx, 15, -55); k.cyl(0.001, 4.4, 9, 4, RF, P(lx, 34.5, -55), [0, Math.PI / 4, 0]); }
    // trees in their autumn colours (late October), with pines among them: a fringe on the slope just
    // below the curtain wall, and the wooded hill rising to the west of the palace (from the study the
    // rest of the hill, and the river banks, are hidden behind the Old Town's roofs)
    const r = rng(77), leafy = [], pines = [];
    const plant = (lx, lz, sc) => { const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c; if (Math.abs(x - RIVER(z)) < 80) return; (r() < 0.25 ? pines : leafy).push({ x, y: groundHeight(x, z) - 0.3, z, s: sc }); };
    for (let i = 0; i < 46; i++) plant(-150 + i * 6.6 + (r() - 0.5) * 4, 47 + r() * 14, 0.9 + r() * 0.4);
    for (let i = 0; i < 30; i++) plant(-158 - r() * 160, -100 + r() * 150, 0.9 + r() * 0.5);
    const autumn = grove(deciduousTree, leafy, { height: 17, detail: 'low', variants: 5, seed: 3, leafColors: [0xffd27a, 0xf2b25a, 0xe8c878, 0xd8d890, 0xffe0a0] });
    const pine = grove(conifer, pines, { height: 16, type: 'pine', detail: 'low', variants: 3, seed: 4 });
    this.root.add(autumn.group, pine.group); this.treeTris = autumn.tris + pine.tris;
    this.root.add(winQuads(cw, { lit: 0.5, w: 1.4, h: 2.4, seed: 9 }));
  }

  // ---------- Kepler's study ----------
  buildStudy() {
    const k = new Kit(), r = rng(31), WOOD = 0x6a4a30, DARK = 0x3a2818, PL = 0xd8ccb0, STONE = 0xc8bca0, BEAM = 0x3a2a1c;
    // the floor: one layer of planks, each a slightly different brown, with staggered joints, on a
    // dark sub-floor that shows in the seams (raised 1 cm clear of the house below)
    k.box(RX * 2, 0.02, RZ * 2, 0x1e140c, [0, TOP + 0.01, 0]);
    for (let i = 0; i < 26; i++) {
      const x = -RX + 0.1 + i * 0.2; let z = -RZ, j = 0;
      while (z < RZ - 0.01) {
        const len = Math.min(RZ - z, 0.9 + r() * 1.6), sh = 0.85 + r() * 0.3, cc = [0x7a5a3a, 0x6e5034, 0x74563a, 0x684a30][(i + j++) % 4];
        const pg = k.box(0.192, 0.03, len - 0.008, cc, [x, TOP + 0.035, z + len / 2]), ca = pg.attributes.color.array;
        for (let n = 0; n < ca.length; n++) ca[n] *= sh;
        z += len;
      }
    }
    // south, east and west walls (plaster), skirting boards, posts and a wall plate (dark oak)
    k.box(RX * 2, 3.2, 0.25, PL, [0, TOP + 1.6, RZ]);
    for (const s of [-1, 1]) k.box(0.25, 3.2, RZ * 2, PL, [s * RX, TOP + 1.6, 0]);
    k.box(RX * 2, 0.14, 0.04, BEAM, [0, TOP + 0.12, RZ - 0.14]);
    for (const s of [-1, 1]) k.box(0.04, 0.14, RZ * 2, BEAM, [s * (RX - 0.14), TOP + 0.12, 0]);
    for (const x of [-1.7, 1.2]) k.box(0.18, 3.2, 0.06, BEAM, [x, TOP + 1.6, RZ - 0.15]);
    for (const z of [-1.0, 1.0]) k.box(0.06, 3.2, 0.18, BEAM, [RX - 0.15, TOP + 1.6, z]);
    k.box(RX * 2, 0.2, 0.12, BEAM, [0, TOP + 3.1, RZ - 0.18]);
    for (const s of [-1, 1]) k.box(0.12, 0.2, RZ * 2, BEAM, [s * (RX - 0.18), TOP + 3.1, 0]);
    // the ceiling: boards on joists, a big girder down the middle
    k.box(RX * 2 + 0.4, 0.2, RZ * 2 + 0.4, 0x4a3426, [0, TOP + 3.3, 0]);
    for (let i = 0; i < 7; i++) k.box(RX * 2, 0.16, 0.16, BEAM, [0, TOP + 3.12, -RZ + 0.3 + i * 0.63]);
    k.box(0.26, 0.24, RZ * 2, 0x30221a, [0.9, TOP + 2.92, 0]);
    // the north wall: three stone arches (one big one in the middle) over a sill you can lean on
    const wall = new THREE.Shape(); wall.moveTo(-RX, 0); wall.lineTo(RX, 0); wall.lineTo(RX, 3.2); wall.lineTo(-RX, 3.2); wall.closePath();
    for (const [cx, w, sp] of OPEN) { const h = new THREE.Path(); h.moveTo(cx - w / 2, SILL); h.lineTo(cx + w / 2, SILL); h.lineTo(cx + w / 2, sp); h.absarc(cx, sp, w / 2, 0, Math.PI, false); h.lineTo(cx - w / 2, SILL); wall.holes.push(h); }
    const wg = new THREE.ExtrudeGeometry(wall, { depth: 0.36, bevelEnabled: false, curveSegments: 20 }); wg.translate(0, 0, -0.18);
    k.add(wg, PL, [0, TOP, -RZ]);
    const fz = -RZ + 0.2;    // the inside face of the wall, plus a little: the stone trim stands proud of it
    for (const [cx, w, sp] of OPEN) {
      const R = w / 2 + 0.08, n = Math.round(w * 9) + 5;
      for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI; k.box(0.16, Math.PI * R / n * 0.9, 0.05, i === (n - 1) / 2 ? 0xd8ccb0 : STONE, [cx + Math.cos(a) * R, TOP + sp + Math.sin(a) * R, fz], [0, 0, a]); const r0 = w / 2 - 0.015; k.box(0.03, Math.PI * r0 / n * 1.02, 0.37, 0xb8ac90, [cx + Math.cos(a) * r0, TOP + sp + Math.sin(a) * r0, -RZ], [0, 0, a]); }
      if (n % 2 === 0) k.box(0.2, 0.24, 0.07, 0xd8ccb0, [cx, TOP + sp + R + 0.02, fz + 0.01]);          // the keystone
      for (const sx of [-1, 1]) {
        for (let y = SILL + 0.06, j = 0; y < sp - 0.05; y += 0.3, j++) k.box(j % 2 ? 0.18 : 0.26, Math.min(0.285, sp - y), 0.04, j % 2 ? 0xbcb094 : STONE, [cx + sx * (w / 2 + (j % 2 ? 0.09 : 0.13)), TOP + y + Math.min(0.285, sp - y) / 2, fz - 0.005]);
        k.box(0.03, sp - SILL, 0.37, 0xb8ac90, [cx + sx * (w / 2 - 0.015), TOP + (sp + SILL) / 2, -RZ]);        // stone lining the jamb
        k.box(0.3, 0.1, 0.42, STONE, [cx + sx * (w / 2 + 0.1), TOP + sp, -RZ]);                       // the impost (where the arch springs)
      }
      k.box(w + 0.14, 0.06, 0.46, 0xb8ac90, [cx, TOP + SILL + 0.035, -RZ + 0.02]);                   // the sill stone
    }
    k.box(RX * 2 - 0.25, 0.12, 0.06, BEAM, [0, TOP + 0.12, -RZ + 0.21]);
    // the bookcase on the west wall: sides, back, cornice, books upright and lying flat
    const bx0 = -RX + 0.32;
    for (const z of [-0.92, 1.72]) k.box(0.34, 2.6, 0.05, WOOD, [bx0, TOP + 1.3, z]);
    k.box(0.02, 2.6, 2.64, DARK, [-RX + 0.15, TOP + 1.3, 0.4]);
    k.box(0.42, 0.1, 2.76, WOOD, [bx0 + 0.02, TOP + 2.65, 0.4]); k.box(0.36, 0.08, 2.66, WOOD, [bx0, TOP + 0.08, 0.4]);
    for (let j = 0; j < 4; j++) {
      const y0 = TOP + 0.5 + j * 0.6;
      k.box(0.32, 0.04, 2.6, WOOD, [bx0, y0, 0.4]);
      let z = -0.87;
      while (z < 1.6) {
        const col = [0x6a2a1a, 0x2a3a2a, 0x4a3a1a, 0x3a2a3a, 0x5a4a2a, 0x7a5a2a, 0x2a2a3a][Math.floor(r() * 7)];
        if (r() < 0.08) { for (let q = 0; q < 3; q++) k.box(0.24, 0.05, 0.3, col, [bx0, y0 + 0.045 + q * 0.052, z + 0.16], [0, (r() - 0.5) * 0.2, 0]); z += 0.36; continue; }
        const h = 0.26 + r() * 0.22, t = 0.04 + r() * 0.05, lean = r() < 0.06 ? 0.18 : 0;
        k.box(0.22 + r() * 0.04, h, t, col, [bx0, y0 + 0.02 + h / 2, z + t / 2], [lean, 0, 0]);
        k.box(0.005, 0.03, t * 0.8, 0xc8a040, [bx0 + 0.13, y0 + 0.02 + h * 0.75, z + t / 2]);   // gilt band on the spine
        z += t + 0.004 + (lean ? 0.06 : 0);
      }
    }
    // the tiled stove in the south-east corner: plinth, green tiles in a grid, cornice, a glowing door
    const sx = RX - 0.6, sz = RZ - 0.55;
    k.box(1.0, 0.18, 0.9, 0x5a5048, [sx, TOP + 0.09, sz]);
    k.box(0.9, 1.7, 0.8, 0x2a4a3a, [sx, TOP + 1.03, sz]);
    for (let y = 0; y < 10; y++) for (let i = 0; i < 6; i++) {
      const cc = [0x3a6a5a, 0x346252, 0x407260][(y + i) % 3];
      k.box(0.13, 0.15, 0.02, cc, [sx - 0.375 + i * 0.15, TOP + 0.28 + y * 0.165, sz - 0.41]);
      if (i < 5) k.box(0.02, 0.15, 0.13, cc, [sx - 0.46, TOP + 0.28 + y * 0.165, sz - 0.32 + i * 0.15]);
    }
    for (const y of [0.18, 1.9]) k.box(1.0, 0.1, 0.9, 0x2a4a3a, [sx, TOP + y + 0.05, sz]);
    k.box(0.7, 0.6, 0.6, 0x3a6a5a, [sx, TOP + 2.25, sz]); k.box(0.8, 0.06, 0.7, 0x2a4a3a, [sx, TOP + 2.58, sz]);
    k.box(0.3, 0.24, 0.03, 0x2a2a2a, [sx, TOP + 0.4, sz - 0.43]);
    k.cyl(0.07, 0.07, 0.7, 8, 0x2a2a2a, [sx + 0.2, TOP + 2.9, sz + 0.1]);
    this.fireDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshBasicMaterial({ color: 0xff7a30 })); this.fireDoor.position.set(sx, TOP + 0.4, sz - 0.453); this.fireDoor.rotation.y = Math.PI; this.root.add(this.fireDoor);
    // the door in the south wall: planks, iron straps, a ring
    // (the leaf swings open on its hinge, so it's its own little mesh; behind it, the dark stairwell)
    const dk = new Kit();
    dk.box(0.9, 2.0, 0.06, 0x4a3220, [0.45, 1.0, 0]);
    for (let i = 0; i < 6; i++) dk.box(0.005, 1.98, 0.065, 0x2a1a10, [0.03 + i * 0.15, 1.0, 0]);
    for (const y of [0.35, 1.6]) dk.box(0.7, 0.05, 0.08, 0x2a2a2a, [0.4, y, 0]);
    dk.add(new THREE.TorusGeometry(0.05, 0.008, 4, 10), 0x2a2a2a, [0.12, 1.0, -0.05]);
    this.door = dk.mesh(); this.door.position.set(-0.2, TOP, RZ - 0.15); this.root.add(this.door);
    k.box(0.9, 2.0, 0.01, 0x050403, [0.25, TOP + 1.0, RZ - 0.128]);
    k.box(1.06, 0.1, 0.1, BEAM, [0.25, TOP + 2.05, RZ - 0.16]); for (const s of [-1, 1]) k.box(0.08, 2.05, 0.1, BEAM, [0.25 + s * 0.5, TOP + 1.02, RZ - 0.16]);
    // the desk by the east arch: a thick top with a lip, turned legs, side stretchers, a drawer at the
    // near end; papers, an inkwell and quill, an hourglass, dividers, candles in brass dishes
    const dt = TOP + DH;
    k.box(DW, 0.05, DD, WOOD, [DX, dt - 0.025, DZ]); k.box(DW + 0.04, 0.02, DD + 0.04, DARK, [DX, dt - 0.06, DZ]);
    k.box(DW - 0.12, 0.1, 0.03, DARK, [DX, dt - 0.12, DZ - DD / 2 + 0.07]);                          // back apron
    for (const sx2 of [-1, 1]) k.box(0.03, 0.1, DD - 0.12, DARK, [DX + sx2 * (DW / 2 - 0.07), dt - 0.12, DZ]);
    k.box(0.5, 0.12, 0.03, DARK, [DX - 0.45, dt - 0.13, DZ + DD / 2 - 0.07]); k.box(0.06, 0.03, 0.03, 0xb08a42, [DX - 0.45, dt - 0.13, DZ + DD / 2 - 0.05]);   // the drawer
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lx = DX + ox * (DW / 2 - 0.07), lz = DZ + oz * (DD / 2 - 0.07);
      k.cyl(0.03, 0.035, DH - 0.07, 8, DARK, [lx, TOP + (DH - 0.07) / 2, lz]); k.ball(0.05, 0, DARK, [lx, TOP + 0.45, lz]); k.box(0.07, 0.06, 0.07, DARK, [lx, TOP + DH - 0.1, lz]);
    }
    for (const sx2 of [-1, 1]) k.box(0.03, 0.04, DD - 0.14, DARK, [DX + sx2 * (DW / 2 - 0.07), TOP + 0.15, DZ]);
    k.box(DW - 0.14, 0.04, 0.03, DARK, [DX, TOP + 0.15, DZ - DD / 2 + 0.07]);
    for (let i = 0; i < 10; i++) k.box(0.21, 0.003, 0.28, i % 3 ? 0xece0c0 : 0xd8c8a0, [KX - 0.3 + r() * 0.55, dt + 0.003 + i * 0.005, DZ - 0.15 + r() * 0.2], [0, r() * 1.2 - 0.6, 0]);
    k.cyl(0.03, 0.035, 0.05, 10, 0x1a1a1a, [KX + 0.32, dt + 0.025, DZ + 0.1]); k.box(0.004, 0.22, 0.03, 0xf0ece0, [KX + 0.34, dt + 0.12, DZ + 0.1], [0.3, 0, -0.35]);   // inkwell and quill
    k.cyl(0.05, 0.05, 0.015, 8, DARK, [DX - 0.35, dt + 0.008, DZ - 0.25]); k.cyl(0.05, 0.05, 0.015, 8, DARK, [DX - 0.35, dt + 0.17, DZ - 0.25]);   // hourglass
    k.cyl(0.04, 0.005, 0.075, 8, 0xe8e4d8, [DX - 0.35, dt + 0.05, DZ - 0.25]); k.cyl(0.005, 0.04, 0.075, 8, 0xe8e4d8, [DX - 0.35, dt + 0.125, DZ - 0.25]);
    for (const a of [-1, 1]) k.box(0.006, 0.003, 0.16, 0xb08a42, [KX - 0.1 + a * 0.02, dt + 0.06, DZ - 0.28], [0, a * 0.15, 0]);   // dividers on the papers
    // crumpled pages on the floor round his chair
    for (let i = 0; i < 26; i++) { const a = r() * 6.28, d = 0.4 + r() * 1.0; const x = KX - 0.3 + Math.cos(a) * d * 0.6, z = KZ + 0.4 + Math.sin(a) * d * 0.5; if (Math.abs(x) > RX - 0.3 || Math.abs(z) > RZ - 0.3) continue; if (r() < 0.4) k.ball(0.045, 0, 0xe8dcbc, [x, TOP + 0.08, z]); else k.box(0.21, 0.003, 0.28, 0xe8dcbc, [x, TOP + 0.058, z], [0, r() * 3, 0]); }
    // Kepler's chair: square legs, a seat at the height of his knees, a tall back with a carved rail
    const cz0 = KZ - 0.04, sw = 0.48, sd = 0.46;
    k.box(sw, 0.05, sd, WOOD, [KX, TOP + SEAT - 0.025, cz0]);
    k.box(sw - 0.06, 0.02, sd - 0.06, 0x6a2a22, [KX, TOP + SEAT + 0.005, cz0]);        // a red cushion
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.045, SEAT - 0.05, 0.045, DARK, [KX + ox * (sw / 2 - 0.03), TOP + (SEAT - 0.05) / 2, cz0 + oz * (sd / 2 - 0.03)]);
    for (const sx2 of [-1, 1]) k.box(0.05, 0.62, 0.05, DARK, [KX + sx2 * (sw / 2 - 0.03), TOP + SEAT + 0.31, cz0 + sd / 2 - 0.03]);
    k.box(sw, 0.12, 0.04, WOOD, [KX, TOP + SEAT + 0.56, cz0 + sd / 2 - 0.03]); k.box(sw - 0.06, 0.06, 0.03, WOOD, [KX, TOP + SEAT + 0.28, cz0 + sd / 2 - 0.03]);
    for (const sx2 of [-1, 1]) k.box(0.03, 0.03, sd - 0.06, DARK, [KX + sx2 * (sw / 2 - 0.03), TOP + 0.12, cz0]);
    // the globe on its stand, and the chest by the south wall
    k.cyl(0.04, 0.12, 0.6, 8, DARK, [-1.25, TOP + 0.3, 1.0]); k.cyl(0.18, 0.2, 0.04, 12, DARK, [-1.25, TOP + 0.02, 1.0]);
    k.add(new THREE.TorusGeometry(0.4, 0.018, 4, 32), 0xb08a52, [-1.25, TOP + 1.0, 1.0], [Math.PI / 2, 0, 0.3]);
    k.add(new THREE.TorusGeometry(0.39, 0.012, 4, 32), 0xb08a52, [-1.25, TOP + 1.0, 1.0], [0, 0.4, 0.4]);
    k.box(0.9, 0.48, 0.46, 0x5a3a22, [-1.75, TOP + 0.24, RZ - 0.4]); k.box(0.92, 0.06, 0.48, 0x4a2e1a, [-1.75, TOP + 0.5, RZ - 0.4]);
    for (const x of [-2.05, -1.45]) k.box(0.05, 0.5, 0.48, 0x2a2a2a, [x, TOP + 0.26, RZ - 0.4]);
    // a brass quadrant on the east wall, above the desk
    const qk = (g, col, p, rot) => k.add(g, col, p, rot);
    qk(new THREE.RingGeometry(0.38, 0.44, 16, 1, 0, Math.PI / 2), 0xb08a42, [RX - 0.21, TOP + 1.4, -1.25], [0, -Math.PI / 2, 0]);
    for (const a of [0, Math.PI / 4, Math.PI / 2]) k.box(0.01, 0.44, 0.02, 0x9a7a3a, [RX - 0.215, TOP + 1.4 + Math.sin(a) * 0.22, -1.25 + Math.cos(a) * 0.22], [a - Math.PI / 2, 0, 0]);
    this.root.add(k.mesh());
    // the chart on the wall: Kepler's planets nested inside the five perfect solids (his first book, 1596)
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshLambertMaterial({ map: canvasTex(512, 512, drawChart) }));
    chart.position.set(-0.9, TOP + 1.65, RZ - 0.13); chart.rotation.y = Math.PI; this.root.add(chart);
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), new THREE.MeshLambertMaterial({ map: canvasTex(256, 128, drawGlobe) })); this.globe.position.set(-1.25, TOP + 1.0, 1.0); this.globe.rotation.z = 0.4; this.root.add(this.globe);
    // candles in brass dishes, and the stove's glow
    this.candle = new THREE.PointLight(0xffa860, 3.2, 9, 1.6); this.candle.position.set(DX + 0.1, TOP + 1.25, DZ - 0.15); this.root.add(this.candle);
    this.flames = [];
    for (const [x, z] of [[DX - 0.05, DZ - 0.25], [DX + 0.74, DZ - 0.3]]) {
      const ck = new Kit(); ck.cyl(0.06, 0.07, 0.015, 12, 0xb08a42, [0, 0.008, 0]); ck.cyl(0.018, 0.02, 0.17, 8, 0xf0e8d0, [0, 0.1, 0]); ck.add(new THREE.TorusGeometry(0.025, 0.005, 4, 8), 0xb08a42, [0.07, 0.02, 0], [0, 0, Math.PI / 2]);
      const m = ck.mesh(); m.position.set(x, TOP + DH, z); this.root.add(m);
      const f = glow(0xffb050, 0.12); f.position.set(x, TOP + DH + 0.22, z); this.root.add(f); this.flames.push(f);
    }
    this.stove = new THREE.PointLight(0xff7a30, 1.2, 5, 1.8); this.stove.position.set(RX - 0.6, TOP + 0.6, RZ - 1.1); this.root.add(this.stove);
    this.G.world.blockers.push({ x: 1.12, z: DZ, r: 0.32 }, { x: 1.9, z: DZ, r: 0.32 }, { x: KX, z: KZ, r: 0.28 }, { x: -RX + 0.3, z: 0.4, r: 0.35 }, { x: RX - 0.6, z: RZ - 0.55, r: 0.55 }, { x: -1.25, z: 1.0, r: 0.4 }, { x: -1.75, z: RZ - 0.4, r: 0.35 });
    // Tycho's logbooks (a stack he holds, later flying to the desk)
    const bk = new Kit(); for (let i = 0; i < 5; i++) { bk.box(0.3, 0.07, 0.4, [0x5a2a1a, 0x2a3a2a, 0x4a3a1a, 0x3a2a3a, 0x6a4a2a][i], [0, i * 0.075, 0], [0, i * 0.05, 0]); bk.box(0.29, 0.055, 0.005, 0xe8dcbc, [0, i * 0.075, 0.2], [0, i * 0.05, 0]); }
    this.logs = bk.mesh(); this.logs.position.set(-1.78, TOP + 0.566, RZ - 0.4); this.logs.rotation.y = 0.2; this.root.add(this.logs);   // on Tycho's chest
    this.logGlow = glow(0xffd890, 0.9, 0); this.logs.add(this.logGlow);
    // the telescope (ch10_10): a brass tube on a wooden cradle on the middle windowsill, pointing up at the sky
    const tk = new Kit();
    tk.box(0.3, 0.04, 0.12, DARK, [0, 0.02, 0]); for (const s of [-1, 1]) tk.box(0.03, 0.16, 0.08, DARK, [s * 0.1, 0.11, 0]);
    const tube = new THREE.Group(); tube.position.set(0, 0.17, 0); tube.rotation.x = 0.55;
    const tt = new Kit();
    tt.cyl(0.032, 0.026, 0.62, 12, 0xc8a048, [0, 0, -0.1], [Math.PI / 2, 0, 0]); tt.cyl(0.024, 0.024, 0.22, 12, 0xa88838, [0, 0, 0.3], [Math.PI / 2, 0, 0]);
    for (const z of [-0.4, -0.16, 0.18]) tt.cyl(0.037, 0.037, 0.03, 12, 0x8a6a28, [0, 0, z], [Math.PI / 2, 0, 0]);
    tt.cyl(0.014, 0.018, 0.05, 8, 0x2a2a2a, [0, 0, 0.43], [Math.PI / 2, 0, 0]);
    tube.add(tt.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3a2a08 })));
    this.scopeGleam = [glow(0xfff0c0, 0.25, 0), glow(0xffe0a0, 0.6, 0)]; this.scopeGleam[0].position.set(0, 0, -0.42); this.scopeGleam[1].position.set(0, 0, -0.1); tube.add(...this.scopeGleam);
    this.scope = new THREE.Group(); this.scope.add(tk.mesh(), tube); this.scope.position.set(-0.62, TOP + SILL + 0.065, -RZ + 0.06); this.scope.rotation.y = 0.35; this.scope.visible = false; this.root.add(this.scope);
    this.scopeLab = label('A new invention: the telescope', 0.09); this.scopeLab.position.set(-0.55, TOP + SILL + 0.6, -RZ + 0.3); this.scopeLab.material.opacity = 0; this.root.add(this.scopeLab);
    this.scopeSparks = glowPoints(30, { sizeScale: 200 }); this.scopeSparks.visible = false; this.root.add(this.scopeSparks);
    // a dog asleep by the stove
    this.dog = this.life.add(makeHerd('dog', { n: 1, area: { x: RX - 1.35, z: RZ - 0.6, r: 0.2 }, height: () => TOP + 0.05, seed: 2, lie: true }));
  }

  // ---------- The drawing board (ch10_06): paper, two pins, a loop of string, a pencil ----------
  buildBoard() {
    const B0 = this.board = new THREE.Group(); B0.position.set(BX, BY, BZ); this.root.add(B0);
    const k = new Kit();
    k.box(PW + 0.06, 0.032, PH + 0.06, 0x8a6a42, [0, -0.019, 0]);                       // the board, under the paper
    for (const s of [-1, 1]) k.box(PW + 0.06, 0.01, 0.015, 0x5a3e24, [0, -0.0025, s * (PH / 2 + 0.03)]);
    B0.add(k.mesh());
    this.paperTex = canvasTex(512, 400, (g, w, h) => this.paintPaper(g, w, h, false));
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: this.paperTex }));
    paper.position.y = 0.0015; B0.add(paper);
    // the pins at the two foci (brass heads)
    const pk = new Kit(); for (const x of [-BC, BC]) { pk.cyl(0.002, 0.002, 0.03, 6, 0xc8c8c8, [x, 0.015, 0]); pk.ball(0.007, 0, 0xd8b040, [x, 0.032, 0]); }
    B0.add(pk.mesh());
    this.pinGlow = [-BC, BC].map((x) => { const gl = glow(0xffe0a0, 0.05, 0); gl.position.set(x, 0.035, 0); B0.add(gl); return gl; });
    // the string: a loop round both pins and the pencil, always tight
    this.stringGeo = new THREE.BufferGeometry(); this.stringGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    this.string = new THREE.Line(this.stringGeo, new THREE.LineBasicMaterial({ color: 0xfff4dc })); B0.add(this.string);
    // the pencil: stands on the paper with its tip on the line, a glow so you see it's yours to take
    this.pencil = new THREE.Group();
    const pc = new Kit(); pc.cyl(0.006, 0.006, 0.13, 6, 0xe0a030, [0, 0.075, 0]); pc.cyl(0.006, 0.0015, 0.018, 6, 0xe8d0a0, [0, 0.009, 0]); pc.cyl(0.0062, 0.0062, 0.012, 6, 0xd06a6a, [0, 0.145, 0]);
    this.pencil.add(pc.mesh()); this.penGlow = glow(0xffe0a0, 0.14, 0); this.penGlow.position.y = 0.09; this.pencil.add(this.penGlow);
    B0.add(this.pencil);
    this.setPencil(0);
    // the drawing flying out of the window (ch10_06 end)
    this.flyPts = glowPoints(BINS, { sizeScale: 300 }); this.flyPts.visible = false; this.root.add(this.flyPts);
  }
  // paint the paper: a faint dotted guide (while it's yours to draw), and the line drawn so far
  paintPaper(g, w, h, guide) {
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,90,50,0.25)'; g.lineWidth = 2; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = 'rgba(58,42,24,0.55)'; g.font = 'italic 20px Georgia, serif'; g.fillText('Mars', 24, 40);
    const X = (x) => (x / PW + 0.5) * w, Y = (z) => (z / PH + 0.5) * h;
    if (guide) { g.strokeStyle = 'rgba(180,120,40,0.55)'; g.lineWidth = 3; g.setLineDash([6, 10]); g.beginPath(); g.ellipse(X(0), Y(0), BA / PW * w, BB / PH * h, 0, 0, 6.29); g.stroke(); g.setLineDash([]); }
    g.fillStyle = 'rgba(200,120,30,0.9)'; g.beginPath(); g.arc(X(BC), Y(0), 6, 0, 6.28); g.fill();     // the Sun's pin
    g.fillStyle = INK; g.font = 'italic 16px Georgia, serif'; g.fillText('Sun', X(BC) - 12, Y(0) + 24);
  }
  // put the pencil at angle a round the ellipse, and pull the string tight round it
  setPencil(a) {
    const x = BA * Math.cos(a), z = -BB * Math.sin(a);
    this.pencil.position.set(x, 0, z); this.pencil.rotation.set(z * 1.2, 0, -x * 1.2);
    const p = this.stringGeo.attributes.position.array, y = 0.012;
    p.set([-BC, y, 0, x, y + 0.004, z, BC, y, 0, -BC, y, 0]); this.stringGeo.attributes.position.needsUpdate = true;
  }
  // mark the bins between two angles as drawn, and ink them on the paper
  inkTo(a0, a1) {
    const g = this.paperTex.userData.ctx, w = 512, h = 400, X = (x) => (x / PW + 0.5) * w, Y = (z) => (z / PH + 0.5) * h;
    const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI * 2 / BINS / 2)));
    g.strokeStyle = '#3a2a18'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n), x = X(BA * Math.cos(a)), y = Y(-BB * Math.sin(a));
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      const b = ((Math.floor(a / (Math.PI * 2) * BINS) % BINS) + BINS) % BINS;
      if (!this.bins[b]) { this.bins[b] = 1; this.binN++; }
    }
    g.stroke(); this.paperTex.needsUpdate = true;
  }

  buildPeople() {
    const add = (model, pos, look = {}) => { const P = makePerson({ model, seed: 13 + this.root.children.length, ...look }); P.g.position.copy(pos); this.root.add(P.g); return P; };
    this.kep = add('kepler', new THREE.Vector3(KX, TOP, KZ), { tunic: 0x1a1a1a, hair: 0x2a1a10, height: 1.7 });
    this.kep.g.rotation.y = Math.PI;
    this.tyc = add('tycho', new THREE.Vector3(-0.55, TOP + 0.05, -1.05), { tunic: 0x1a1a1a, hair: 0x9a5a2a, height: 1.78 });
    this.tyc.g.rotation.y = 1.25;
    // Tycho holds his big observing ledger close (the whole stack of logbooks flies to Kepler later)
    const lk = new Kit(); lk.box(0.3, 0.07, 0.4, 0x5a2a1a, [0, 0, 0]); lk.box(0.28, 0.055, 0.005, 0xe8dcbc, [0, 0, 0.2]); lk.box(0.31, 0.074, 0.03, 0x3a1a10, [0, 0, -0.19]);
    this.ledger = lk.mesh(); holdProp(this.tyc, this.ledger, 'Right', [0, 0.06, 0.1]);
    this.G.world.blockers.push(this.tycBlk = { x: -0.55, z: -1.05, r: 0.3 });
    // in the street below, walking up to the square and back: each one a different person (two with
    // lanterns): a townsman in his long coat, a man and a woman of 1600 Prague, an old burgher in a black gown
    this.walkers = [];
    const who = [['townsman', 1.7, -12], ['townsman_1600', 1.75, -60], ['townswoman_1600', 1.75, -35], ['venetian_senator', 1.75, -82]];
    who.forEach(([model, height, z0], i) => {
      const x = (i % 2 ? 1.6 : -1.6), P = add(model, new THREE.Vector3(x, groundHeight(x, z0), z0), { height, seed: 40 + i });
      if (model === 'venetian_senator') dress(P, { sat: 0.06, val: 0.36, build: 1.05 });   // the senator's red robe dyed a burgher's black
      P.routine = [{ x, z: -92, pose: 'idle', secs: 3 + i }, { x: SQ.x - 14 + i * 6, z: SQ.z + 14, pose: i % 2 ? 'talk' : 'idle', secs: 6 }, { x: -x, z: -24 - i * 6, pose: 'idle', secs: 4 }];
      if (i % 2 === 0) { const L = makeTorch({ len: 0.35, color: 0xffc070, size: 0.6 }); holdProp(P, L, 'Right', [0, 0.02, 0.02]); P.lamp = L; }
      this.walkers.push(P);
    });
  }

  // ---------- Mars's orbit over the roofs ----------
  buildOrbit() {
    const M = this.orbit = new THREE.Group(); M.position.copy(ORR); M.rotation.x = 1.1; M.visible = false; this.root.add(M);
    this.sun = new THREE.Group(); this.sun.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe28a, fog: false })), glow(0xffb040, 1.3, 0.9)); M.add(this.sun);
    this.mars = new THREE.Group(); this.mars.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff6a42, fog: false })), glow(0xff6a42, 0.5, 0.8)); M.add(this.mars);
    this.pts = glowPoints(2600, { sizeScale: 1000 }); M.add(this.pts);
    // Tycho's measurements: Mars's place on many nights (a little scatter, like real measuring)
    const r = rng(21); this.obs = Array.from({ length: 48 }, (_, i) => marsAt(i / 48 * Math.PI * 2 + r() * 0.05, new THREE.Vector3()));
    // the circles Kepler tried: centre (x, z) and radius
    this.circles = [[0, 0, A * 0.95], [-C * 0.5, 0, A * 1.02], [-C * 0.9, 0.05, (A + B) / 2 + 0.06], [-C, 0, (A + B) / 2]];
    this.labs = { close: label('So close... but it misses!', 0.14), ell: label('An ellipse!', 0.18), sun: label('Sun', 0.12), focus: label('empty focus', 0.1) };
    this.labs.close.position.set(-C, 0.25, -B - 0.05); this.labs.ell.position.set(-C, 0.35, B + 0.3); this.labs.sun.position.set(0, 0.32, 0); this.labs.focus.position.set(-2 * C, 0.22, 0);
    for (const l of Object.values(this.labs)) { l.material.opacity = 0; M.add(l); }
    // equal slices of time: twelve wedges from the Sun
    this.wedges = [];
    for (let w = 0; w < 12; w++) {
      const pos = [0, 0, 0], idx = [], N = 16;
      for (let j = 0; j <= N; j++) { const q = marsAt((w + j / N) / 12 * Math.PI * 2, _a); pos.push(q.x, 0, q.z); if (j) idx.push(0, j, j + 1); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: w % 2 ? 0x5aa0ff : 0xffb050, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
      m.visible = false; M.add(m); this.wedges.push(m);
    }
    // the shards of the last circle
    this.shards = glowPoints(300, { sizeScale: 330 }); this.shards.visible = false; M.add(this.shards); this.shD = [];
    // ch10_08: the Rudolphine Tables, Tycho's logbooks glowing on the desk
    this.tablesGlow = glow(0xffd890, 1.4, 0); this.tablesGlow.position.set(2.12, TOP + 1.05, -1.0); this.root.add(this.tablesGlow);
    // ch10_09: dream sparks drifting out through the arches
    this.dreamPts = glowPoints(200, { sizeScale: 260 }); this.dreamPts.visible = false; this.root.add(this.dreamPts);
    this.dp = Array.from({ length: 200 }, () => ({ x: (Math.random() - 0.5) * 5, y: TOP + Math.random() * 3, z: Math.random() * 3 - 2, v: 0.5 + Math.random() }));
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.penIt = {
      hint: 'Grab the glowing pencil with GRIP and draw all the way round', deskHint: 'Hold the mouse button on the glowing pencil and circle round, or just click it',
      get disabled() { return self.s.pen !== 1 && self.s.pen !== 2; },
      reach(pos) { self.pencil.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.4); },
      aim(o, d) { self.board.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.3 ? t : Infinity; },
      onGrab() { self.penHeld = true; G.act({ type: 'pen' }); }, onTouch() { G.act({ type: 'pen' }); },
      // held: the pencil follows your hand round the pins (its angle about the ellipse's middle on the board)
      onHold(h) { if (!h?.pos) return; self.penHeld = true; self.board.worldToLocal(_a.copy(h.pos)); self.penWant = Math.atan2(-_a.z / BB, _a.x / BA); },
      onRelease() { self.penHeld = false; },
    };
    G.interactables.push(this.penIt);
  }
  act(a) {
    if (a.type === 'pen' && this.s.pen === 1) { this.s.pen = 2; return true; }
    return this.journal.act(a);
  }
  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    G.events.emit('placePlayers', { x: this.start.pos.x, z: this.start.pos.z, yaw: this.start.yaw });
    await G.ui.fadeIn(3);
    s.phase = 'meet';
    await D.say('ch10_01');
    s.phase = 'tycho';
    const l2 = D.sayAsync('ch10_02');
    await D.cue('Tycho fell ill'); s.tycho = 2;
    await D.cue('Kepler got everything'); s.books = 1;
    await l2;
    // (the logbooks fly to the desk once Tycho has gone out of the door)
    await D.until(() => s.tycho === 0, fast ? 8 : 6);
    if (s.tycho) { this.tyc.g.visible = false; s.tycho = 0; }
    // the circles
    s.phase = 'circles'; s.orbit = 1; s.dots = 1; s.guide = [ORR.x + 3.2, ORR.y + 0.8, ORR.z + 2.2];
    const l3 = D.sayAsync('ch10_03');
    await D.cue('circle after circle'); s.circ = 1;
    await D.wait(fast ? 0.2 : 1.6); s.circ = 2;
    await D.wait(fast ? 0.2 : 1.6); s.circ = 3;
    await D.cue('One came so close'); s.circ = 4;
    await l3;
    const l4 = D.sayAsync('ch10_04');
    await D.cue('the circle had to go'); s.circ = 5;
    await l4;
    // the ellipse
    s.phase = 'ellipse';
    const l5 = D.sayAsync('ch10_05');
    await D.cue('ellipse'); s.ell = 1;
    await D.cue('off to one side'); s.ell = 2;
    await l5;
    // draw one yourself, on the drawing board on Kepler's desk; then it flies up onto Mars's path
    s.phase = 'draw'; s.ell = 0; s.pen = 1; s.guide = [BX - 0.05, TOP + 1.35, BZ - 0.35];
    this.paintBoard(true);
    await D.say('ch10_06');
    D.hint(G.mode === 'desktop' ? this.penIt.deskHint : this.penIt.hint, 12);
    await D.auto(() => s.pen >= 2, () => { s.pen = 2; }, { after: fast ? 0.3 : 1.5, timeout: fast ? 2 : 25 });
    if (s.pen < 2) s.pen = 2;
    await D.until(() => s.pen >= 3, fast ? 6 : 40);
    G.ui.showHint('');
    if (s.pen < 3) s.pen = 3;
    s.guide = [ORR.x + 3.2, ORR.y + 0.8, ORR.z + 2.2];
    await D.until(() => s.pen === 4, fast ? 6 : 10);
    s.pen = 4; s.ell = 2;
    // equal areas
    s.phase = 'sweep'; s.sweep = 1;
    await D.say('ch10_07');
    await D.wait(fast ? 0.5 : 3);
    s.sweep = 0;
    // the tables
    s.phase = 'tables'; s.tables = 1; s.guide = null;
    await D.say('ch10_08');
    s.orbit = 0; s.dots = 0; s.ell = 0;
    // Kepler's Dream
    s.phase = 'dream'; s.dream = 1; s.tables = 0;
    await D.say('ch10_09');
    await D.until(() => this.dreamT > 12, fast ? 2 : 10);
    s.dream = 0;
    // and in Italy... a brand new telescope gleams on the windowsill
    s.phase = 'italy'; s.galileo = 1; s.guide = [-1.1, TOP + 1.75, -RZ + 0.7];
    await D.say('ch10_10');
    await D.wait(fast ? 0.5 : 2.5);
    s.guide = null;
    s.phase = 'journal';
    await this.journal.present(D);
    s.phase = 'done';
  }
  paintBoard(guide) { this.paintPaper(this.paperTex.userData.ctx, 512, 400, guide); this.paperTex.needsUpdate = true; }

  // ---------- Every frame ----------
  update(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1;
    this.t += dt;
    s.hour = 21 + this.t / 500;
    const sun = sunAt(LAT, SUNLON, s.hour); G.sky.set(sun.az, sun.el);
    // the Moon: rising in the north-east; in Kepler's Dream it swells as if you're flying to it
    this.dreamV = damp(this.dreamV || 0, s.dream ? 1 : 0, s.dream ? 0.35 : 0.8, dt);
    if (s.dream) this.dreamT = (this.dreamT || 0) + dt * fast;
    G.sky.setMoon(48, 22 + this.dreamV * 6, 1.4 + 30 * ease(this.dreamV), 0.55);
    const fl = 0.8 + 0.2 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1), dim = 1 - 0.75 * this.dreamV;
    this.candle.intensity = 3 * fl * dim; for (const f of this.flames) f.scale.set(0.09 + 0.02 * fl, 0.15 * fl, 1);
    this.stove.intensity = (1 + 0.4 * fl) * dim; this.fireDoor.material.color.setRGB(fl, 0.45 * fl, 0.15 * fl);
    this.globe.rotation.y += dt * 0.1;
    this.life.update(dt, t);
    this.updatePeople(dt, t);
    this.updateBoard(dt, t);
    this.updateOrbit(dt, t);
    this.updateDream(dt, t);
    this.updateScope(dt, t);
    const busy = this.journal.update();
    guideUpdate(this, busy);
    if ((this.bellT -= dt) <= 0 && G.audio.ctx) { this.bellT = 80 + Math.random() * 40; for (let i = 0; i < 3; i++) setTimeout(() => G.audio.bell(_b.set(32, 50, -166), 0.45), i * 2400); }
  }

  // Kepler sits on his chair: hips on the seat, thighs forward under the desk, shins down to the floor
  seat(K) {
    const Bn = K.rig?.bones;
    if (!Bn?.LeftUpLeg || !Bn.LeftLeg || !Bn.LeftFoot) { K.g.position.y = TOP; return; }
    if (!K.sit) {   // measured once, standing (animatePerson has just put the legs back at rest)
      K.g.position.y = TOP; K.g.updateWorldMatrix(true, true);
      const gy = K.g.getWorldPosition(_a).y;
      Bn.LeftUpLeg.getWorldPosition(_b); Bn.LeftLeg.getWorldPosition(_c); Bn.LeftFoot.getWorldPosition(_d);
      K.sit = { up: _b.y - gy, thigh: _b.distanceTo(_c), shin: _c.distanceTo(_d), ankle: _d.y - gy };
    }
    const S = K.sit, hipH = SEAT + 0.1;
    K.g.position.y = TOP + hipH - S.up;
    K.inner.position.y = 0;
    K.inner.updateWorldMatrix(true, false);
    const tilt = 0.12, kneeH = hipH - S.thigh * Math.sin(tilt), drop = kneeH - S.ankle - 0.05;
    const fwd = drop >= S.shin ? 0 : Math.sqrt(S.shin * S.shin - drop * drop);
    for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
      const up = Bn[side + 'UpLeg'], low = Bn[side + 'Leg'], foot = Bn[side + 'Foot'], toe = Bn[side + 'ToeBase'];
      aimBone(up, low, _a.set(sx * 0.1, -Math.sin(tilt), Math.cos(tilt)).normalize().transformDirection(K.inner.matrixWorld));
      aimBone(low, foot, _a.set(sx * 0.03, -Math.min(drop, S.shin), fwd).normalize().transformDirection(K.inner.matrixWorld));
      if (toe) aimBone(foot, toe, _a.set(0, -0.25, 1).normalize().transformDirection(K.inner.matrixWorld));
    }
  }

  updatePeople(dt, t) {
    const s = this.s, K = this.kep, T = this.tyc;
    // Kepler, in his chair: talking with Tycho, pointing out at the orbit, writing, gazing at the Moon
    K.g.rotation.y = Math.PI;
    if (s.phase === 'meet' || s.phase === 'tycho') { K.pose = s.phase === 'meet' ? 'talk' : 'idle'; K.look = T.g.position.clone().setY(TOP + 1.6); }
    else if (s.phase === 'draw') { K.pose = 'idle'; K.look = this.pencil.getWorldPosition(new THREE.Vector3()); }
    else if (s.orbit && s.phase !== 'tables') { K.pose = s.circ === 5 && !s.ell && s.phase !== 'sweep' ? 'gasp' : s.ell && s.phase === 'ellipse' ? 'cheer' : 'point'; K.pointAt.copy(ORR); K.look = ORR.clone(); }
    else if (s.dream) { K.pose = 'idle'; K.look = _a.set(30, TOP + 40, -40).clone(); }
    else if (s.galileo) { K.pose = 'idle'; K.look = this.scope.position.clone(); }
    else { K.pose = 'write'; K.look = null; }
    animatePerson(K, t, dt); this.seat(K);
    // Tycho: guarding his ledger; then (he fell ill) he walks out through the door, and it shuts behind him
    if (s.tycho === 2 && T.g.visible) {
      const tgt = T.g.position.z < 1.15 ? [0.3, 1.2] : [0.3, 2.0];
      walkToward(T, tgt[0], tgt[1], dt, { speed: 1.2, stop: 0.08 }); T.g.position.y = TOP + 0.05; T.look = null;
      if (T.g.position.z > 1.68) { T.g.visible = false; s.tycho = 0; }
      this.tycBlk.x = T.g.position.x; this.tycBlk.z = T.g.position.z;
    } else if (T.g.visible) { T.pose = 'hold'; T.look = K.g.position.clone().setY(TOP + 1.2); }
    this.tycBlk.r = T.g.visible ? 0.3 : 0;
    if (T.g.visible) animatePerson(T, t, dt);
    const near = T.g.visible && s.tycho === 2;    // open wide before he gets there, so the leaf never sweeps through him
    this.doorA = damp(this.doorA || 0, near ? 1.55 : 0, near ? 4 : 2, dt); this.door.rotation.y = this.doorA;
    // the books fly from Tycho's arms to Kepler's desk
    if (s.books && !T.g.visible && !this.booksFlying) { this.booksFlying = true; this.bookFrom = this.logs.position.clone(); this.bookF = 0; }
    if (this.booksFlying && this.bookF < 1) { this.bookF = Math.min(1, this.bookF + dt / 2.5); _a.set(2.12, TOP + DH + 0.06, -1.0); this.logs.position.lerpVectors(this.bookFrom, _a, ease(this.bookF)); this.logs.position.y += Math.sin(this.bookF * Math.PI) * 0.6; this.logs.rotation.set(0, this.bookF * 6.28 + 0.3, 0); }
    this.logGlow.material.opacity = this.booksFlying ? 0.6 * (1 - Math.abs(this.bookF - 0.5) * 2) + (s.tables ? 0.5 : 0) : 0;
    for (const P of this.walkers) { runRoutine(P, dt, { height: groundHeight, speed: 0.9 }); animatePerson(P, t, dt); P.lamp?.userData.flicker(t); }
  }

  // ch10_06: the drawing board. The pencil glows until you take it; then the line follows it round;
  // when it's all the way round, the drawing lifts off and flies out to Mars's path in the sky.
  updateBoard(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1;
    const on = s.pen === 1 || s.pen === 2;
    this.penGlow.material.opacity = on ? (s.pen === 1 ? 0.6 + 0.35 * Math.sin(t * 4) : 0.5) : 0;
    for (const p of this.pinGlow) p.material.opacity = on ? 0.5 : 0;
    if (s.pen === 2) {
      const prev = this.penA;
      if (this.penWant != null) { let d = this.penWant - this.penA; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 1.2) this.penA += d; this.penWant = null; }
      this.penIdle = Math.abs(this.penA - prev) > 1e-3 ? 0 : (this.penIdle || 0) + dt;
      // nobody steering it (Kids, a click on desktop, or you let go for a moment): it goes round by itself
      if (!this.penHeld || this.penIdle > 2) this.penA += dt * 0.9 * fast;
      if (this.penA !== prev) this.inkTo(prev, this.penA);
      this.setPencil(this.penA);
      if (this.binN >= BINS && G.isHost !== false) { s.pen = 3; G.audio.ctx && G.audio.chime(_a.copy(this.board.position), 0.5); }
    }
    // the drawing lifts off the paper and flies out of the middle arch onto Mars's path
    if (s.pen === 3 && !this.flying) { this.flying = true; this.flyT = 0; this.flyPts.visible = true; this.paintBoard(false); this.setPencil(0); this.orbit.updateMatrixWorld(true); }
    if (this.flying) {
      this.flyT = Math.min(1, this.flyT + dt * fast / 2.6);
      const S = this.flyPts.userData, f = ease(this.flyT), lift = Math.sin(this.flyT * Math.PI);
      this.board.updateMatrixWorld(true); this.orbit.updateMatrixWorld(true);
      for (let j = 0; j < BINS; j++) {
        const a = j / BINS * Math.PI * 2;
        this.board.localToWorld(_a.set(BA * Math.cos(a), 0.01 + Math.min(1, this.flyT * 6) * 0.08, -BB * Math.sin(a)));
        this.orbit.localToWorld(_b.set(A * Math.cos(a) - C, 0, -B * Math.sin(a)));
        _c.lerpVectors(_a, _b, f); _c.y += lift * 1.2;
        S.pos.set([_c.x, _c.y, _c.z], j * 3);
        const b = 0.7 + 0.3 * Math.sin(t * 8 + j);
        S.col.set([b, 0.85 * b, 0.45 * b], j * 3); S.size[j] = lerp(0.006, 0.035, f);
      }
      S.commit();
      if (this.flyT >= 1) { this.flying = false; this.flyPts.visible = false; if (s.pen === 3) s.pen = 4; this.ellFlash = 1; this.ellV = 1; shimmer(G, 2, 0.15); }
    }
  }

  updateOrbit(dt, t) {
    const G = this.G, s = this.s, M = this.orbit, fast = G.params.has('fast') ? 3 : 1;
    this.orbV = damp(this.orbV || 0, s.orbit ? 1 : 0, 1.5, dt); M.visible = this.orbV > 0.01;
    if (!M.visible) return;
    if (!this.flying) { G.camera.getWorldPosition(_a); M.lookAt(_a); M.rotateX(Math.PI / 2 - 0.35); }
    const v = this.orbV, P = this.pts.userData; let n = 0;
    const dot = (x, z, r, g, b, sz) => { if (n >= 2600) return; P.pos.set([x, 0, z], n * 3); P.col.set([r * v, g * v, b * v], n * 3); P.size[n] = sz; n++; };
    // Mars itself, going round (slowly; fast near the Sun, slow far away)
    this.mM = (this.mM || 0) + dt * (s.sweep ? 0.35 : 0.45) * fast;
    marsAt(this.mM, this.mars.position);
    // Tycho's measurements
    const dv = this.dotV = damp(this.dotV || 0, s.dots ? 1 : 0, 2, dt);
    for (const o of this.obs) dot(o.x, o.z, dv, 0.35 * dv, 0.25 * dv, 0.05);
    // the circles Kepler tried (the newest bright, the older ones faint)
    if (s.circ >= 1 && s.circ <= 4) this.circK = s.circ;
    const tried = Math.min(4, this.circK || 0);
    for (let i = 0; i < tried; i++) {
      const [cx, cz, R] = this.circles[i], b = i === tried - 1 ? 0.85 : 0.18;
      if (s.circ === 5 && i === 3) continue;
      if ((s.ell || s.pen) && i < 3) continue;
      for (let j = 0; j < 180; j++) { const a = j / 180 * Math.PI * 2; dot(cx + Math.cos(a) * R, cz + Math.sin(a) * R, b * 0.6, b * 0.8, b, 0.02); }
    }
    this.labs.close.material.opacity = damp(this.labs.close.material.opacity, s.circ === 4 ? 1 : 0, 3, dt);
    // the circle shatters
    if (s.circ === 5 && !this.broke) {
      this.broke = true; shatter(G, 0.35); this.shards.visible = true;
      const [cx, cz, R] = this.circles[3];
      for (let i = 0; i < 300; i++) { const a = i / 300 * Math.PI * 2; this.shD[i] = { p: new THREE.Vector3(cx + Math.cos(a) * R, 0, cz + Math.sin(a) * R), v: new THREE.Vector3(Math.cos(a), (Math.random() - 0.5) * 2, Math.sin(a)).multiplyScalar(0.4 + Math.random() * 0.8), life: 1 }; }
    }
    if (this.broke && this.shards.visible) {
      const S = this.shards.userData; let alive = false;
      this.shD.forEach((q, i) => { q.life -= dt * 0.5; q.p.addScaledVector(q.v, dt); q.v.y -= dt * 0.6; const b = Math.max(0, q.life); if (b > 0) alive = true; S.pos.set([q.p.x, q.p.y, q.p.z], i * 3); S.col.set([b * 0.6, b * 0.8, b], i * 3); S.size[i] = 0.03; });
      S.commit(); if (!alive) this.shards.visible = false;
    }
    // the ellipse, the Sun at one focus, the other focus empty (hidden while you draw yours on the
    // desk; it comes back, flashing, when your drawing lands on it)
    const drawing = s.pen >= 1 && s.pen <= 3;
    const ev = this.ellV = damp(this.ellV || 0, s.ell && !drawing ? 1 : 0, 1.2, dt);
    this.ellFlash = Math.max(0, (this.ellFlash || 0) - dt * 0.6);
    const fb = ev * (1 + 1.5 * this.ellFlash), fs = 0.03 * (1 + this.ellFlash);
    for (let j = 0; j < 360; j++) { const a = j / 360 * Math.PI * 2; dot(A * Math.cos(a) - C, -B * Math.sin(a), fb, 0.85 * fb, 0.45 * fb, fs); }
    const fv = s.ell >= 2 && !drawing ? ev : 0;
    dot(-2 * C, 0, 0.7 * fv, 0.7 * fv, 0.9 * fv, 0.06);
    this.labs.ell.material.opacity = damp(this.labs.ell.material.opacity, s.ell >= 1 && !s.pen && !s.sweep && !s.tables ? 1 : 0, 3, dt);
    this.labs.sun.material.opacity = this.labs.focus.material.opacity = damp(this.labs.focus.material.opacity, s.ell >= 2 && !drawing && !s.sweep && !s.tables ? 1 : 0, 3, dt);
    // Mars going round, brighter during the sweep; the Sun
    this.mars.visible = s.sweep || s.tables || (s.ell >= 2 && !drawing); this.sun.visible = true;
    // ch10_07: equal slices of time, lit as Mars passes through each
    this.wedges.forEach((w, i) => {
      const cur = Math.floor(((this.mM % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) * 12);
      w.visible = !!s.sweep; w.material.opacity = damp(w.material.opacity, s.sweep ? (i === cur ? 0.45 : i === (cur + 11) % 12 ? 0.22 : 0.06) : 0, 4, dt);
    });
    // ch10_08: the tables' predictions (golden dots ahead of Mars) land right on Tycho's red ones
    if (s.tables) for (let j = 0; j < 48; j++) { marsAt(j / 48 * Math.PI * 2, _c); dot(_c.x, _c.z, 0.9, 0.8, 0.3, 0.035 + 0.02 * Math.sin(t * 4 + j)); }
    while (n < 2600) dot(0, 0, 0, 0, 0, 0);
    P.commit();
    this.tablesGlow.material.opacity = damp(this.tablesGlow.material.opacity, s.tables ? 0.7 + 0.2 * Math.sin(t * 2) : 0, 2, dt);
  }

  // Kepler's Dream: sparks drift out through the arches toward the swelling Moon
  updateDream(dt, t) {
    const v = this.dreamV; this.dreamPts.visible = v > 0.02;
    if (!this.dreamPts.visible) return;
    const S = this.dreamPts.userData;
    this.dp.forEach((q, i) => { q.z -= dt * q.v * 2; q.y += dt * q.v * 0.6; if (q.z < -40) { q.z = 2; q.y = TOP + Math.random() * 3; } S.pos.set([q.x + Math.sin(t + i) * 0.3, q.y, q.z], i * 3); const b = v * clamp01(1 + q.z / 40); S.col.set([b * 0.8, b * 0.85, b], i * 3); S.size[i] = 0.05; });
    S.commit();
    if (!this.dreamSnd && this.s.dream) { this.dreamSnd = true; awe(this.G, 14, 0.1, 104); shimmer(this.G, 6, 0.2); }
  }

  // ch10_10: the telescope appears on the windowsill in a little burst of gold, and gleams
  updateScope(dt, t) {
    const s = this.s;
    this.scopeV = damp(this.scopeV || 0, s.galileo || s.phase === 'journal' || s.phase === 'done' ? 1 : 0, 2.5, dt);
    this.scope.visible = this.scopeV > 0.01;
    if (!this.scope.visible) return;
    this.scope.scale.setScalar(0.6 + 0.4 * ease(this.scopeV));
    const gl = s.galileo ? 1 : 0.25;
    this.scopeGleam[0].material.opacity = this.scopeV * gl * (0.7 + 0.3 * Math.sin(t * 3));
    this.scopeGleam[1].material.opacity = this.scopeV * gl * 0.35 * (0.6 + 0.4 * Math.sin(t * 1.7 + 1));
    this.scopeLab.material.opacity = damp(this.scopeLab.material.opacity, s.galileo ? 1 : 0, 2, dt);
    // a little burst of gold sparks as it appears
    if (!this.scopeT) { this.scopeT = 0.001; this.sparkD = Array.from({ length: 30 }, () => ({ a: Math.random() * 6.28, r: 0.05 + Math.random() * 0.1, y: Math.random() * 0.2, v: 0.4 + Math.random() * 0.6 })); }
    this.scopeT += dt;
    const S = this.scopeSparks.userData, k = clamp01(1 - this.scopeT / 2.5); this.scopeSparks.visible = k > 0;
    if (k > 0) {
      const o = this.scope.position;
      this.sparkD.forEach((q, i) => { q.a += dt * 2; q.r += dt * q.v * 0.3; q.y += dt * q.v * 0.4; S.pos.set([o.x + Math.cos(q.a) * q.r, o.y + q.y, o.z + 0.1 + Math.sin(q.a) * q.r], i * 3); S.col.set([k, 0.8 * k, 0.4 * k], i * 3); S.size[i] = 0.02; });
      S.commit();
    }
  }

  dispose() {
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.sky.hideMoon();
  }
}

// The chart on the wall: the planets' spheres nested round the five perfect solids (Kepler, 1596)
function drawChart(g, w, h) {
  g.fillStyle = '#e8d8b0'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(110,80,40,0.6)'; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24);
  g.fillStyle = INK; g.font = 'italic bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('Mysterium Cosmographicum', w / 2, 52);
  const cx = w / 2, cy = h / 2 + 24;
  g.strokeStyle = INK; g.lineWidth = 2;
  let R = 200;
  for (const sides of [4, 3, 6, 4, 5]) {
    g.beginPath(); g.arc(cx, cy, R, 0, 6.28); g.stroke();
    g.beginPath(); for (let i = 0; i <= sides; i++) { const a = -Math.PI / 2 + i / sides * 6.28; const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
    R *= Math.cos(Math.PI / sides) * 0.97;
  }
  g.beginPath(); g.arc(cx, cy, R, 0, 6.28); g.stroke();
  g.fillStyle = '#d8902a'; g.beginPath(); g.arc(cx, cy, 10, 0, 6.28); g.fill();
}
// The globe's map: brown lands on a pale sea, with lines of latitude and longitude
function drawGlobe(g, w, h) {
  g.fillStyle = '#c8b88a'; g.fillRect(0, 0, w, h);
  const r = rng(5); g.fillStyle = '#8a6a3a';
  for (let i = 0; i < 14; i++) { g.beginPath(); g.ellipse(r() * w, 20 + r() * (h - 40), 10 + r() * 30, 6 + r() * 20, r() * 3, 0, 6.28); g.fill(); }
  g.strokeStyle = 'rgba(90,60,30,0.5)'; g.lineWidth = 1;
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, i * h / 6); g.lineTo(w, i * h / 6); g.stroke(); }
  for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(i * w / 12, 0); g.lineTo(i * w / 12, h); g.stroke(); }
}

// The journal page: how to draw an ellipse, and equal areas in equal times
function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
  g.fillText('Kepler, 1609: the ellipse', 40, 70);
  const cx = 300, cy = 380, a = 220, b = 160, c = Math.sqrt(a * a - b * b);
  g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, a, b, 0, 0, 6.28); g.stroke();
  g.fillStyle = '#e0952a'; g.beginPath(); g.arc(cx + c, cy, 16, 0, 6.28); g.fill();
  g.fillStyle = INK; g.beginPath(); g.arc(cx - c, cy, 6, 0, 6.28); g.fill();
  const px = cx + a * Math.cos(2.2), py = cy - b * Math.sin(2.2);
  g.strokeStyle = 'rgba(58,42,24,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - c, cy); g.lineTo(px, py); g.lineTo(cx + c, cy); g.stroke();
  g.font = 'italic 26px Georgia, serif'; g.fillText('two pins, a loop of string', cx - 150, cy + b + 50); g.fillText('Sun', cx + c - 20, cy + 46);
  // equal areas
  const ox = 760, oy = 380;
  g.fillStyle = 'rgba(224,149,42,0.35)'; g.beginPath(); g.moveTo(ox + 40, oy); g.arc(ox, oy, 170, -0.5, 0.5); g.fill();
  g.fillStyle = 'rgba(58,106,170,0.35)'; g.beginPath(); g.moveTo(ox + 40, oy); g.arc(ox, oy, 170, 2.85, 3.43); g.fill();
  g.fillStyle = INK; g.font = 'italic 28px Georgia, serif';
  g.fillText('Near the Sun: fast.', 620, 160); g.fillText('Far away: slow.', 620, 200); g.fillText('Equal times, equal areas.', 600, 610);
  g.fillText('If the circle does not fit the measurements, the circle has to go.', 40, h - 40);
}
