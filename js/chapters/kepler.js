// Era 2, Chapter 3 (n 10): Kepler's ellipses. Prague, 1600 to 1609.
//
// Kepler's attic study high above Prague's Old Town at night: beams, shelves of books, a stove, a
// globe, candles, and three open arches looking north over the red roofs, the twin spires of the
// Týn church, the Vltava and its stone bridge, and the Castle on its hill. Tycho comes to work with
// him, guarding his logbooks; then he's gone (an echo fading into sparks) and the books fly to
// Kepler's desk.
//
// Over the roofs floats Mars's orbit as Kepler saw it: Tycho's measurements as red dots. Kepler
// tries circle after circle; one comes oh so close but misses, and the circle shatters. Then the
// ellipse: it fits every dot, with the Sun off to one side. You draw one yourself with two pins and
// a loop of string (Adults: hold the pencil and go round). Mars speeds up near the Sun and slows far
// away: equal slices of time sweep equal areas, lit up one by one. And then (wow) Kepler's Dream:
// the Moon swells huge in the arches as if you're flying there, and drifts back. At the end an echo
// of Galileo raises his telescope on the balcony: the next chapter.
// The orbit is drawn with its stretch exaggerated (Mars's real ellipse looks almost like a circle).
// World axes: -Z north, +X east, +Y up. The study floor is at y = TOP.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, walkToward, holdProp, dropProp } from '../people.js';
import { makeHerd, makeSmoke, makeTorch, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { glowPoints, shatter, whoosh, awe, shimmer } from '../wow/fx.js';
import { Echo } from '../wow/echo.js';
import { D2R, ease, clamp01, at, sunAt, house, windows, gableRoof, steppedGable, glow, label, Journal, INK, guideUpdate } from '../era2/common.js';

const TOP = 13, LAT = 50.09, SUNLON = 205;
const RX = 2.6, RZ = 2.2;                               // the study is 5.2 x 4.4 m
const ORR = new THREE.Vector3(0, TOP + 3.4, -10);         // Mars's orbit, floating over the roofs
const A = 1.9, E = 0.32, B = A * Math.sqrt(1 - E * E), C = A * E;   // the ellipse (Sun at the origin)
const N1 = noise2(101), N2 = noise2(103);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export function groundHeight(x, z) { return (N2(x / 9, z / 9) - 0.5) * 0.2 + (z < -650 ? Math.min(60, (-650 - z) * 0.35) * clamp((x + 600) / 300, 0, 1) * clamp((200 - x) / 300, 0, 1) : 0); }
const RIVER = (z) => -330 + Math.sin(z / 260) * 50;      // the Vltava's middle (x), running north-south

// Mars on the ellipse at mean anomaly M (radians): solve Kepler's equation, return local position
function marsAt(M, out) {
  let Ea = M; for (let i = 0; i < 6; i++) Ea -= (Ea - E * Math.sin(Ea) - M) / (1 - E * Math.cos(Ea));
  return out.set(A * Math.cos(Ea) - C, 0, -B * Math.sin(Ea));
}

export default class Kepler {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.start = { pos: new THREE.Vector3(-0.3, 0, 0.9), yaw: 0 };
    this.s = {
      phase: 'arrive', guide: null, hour: 21,
      tycho: 1,       // 1 here, 2 fading away, 0 gone
      books: 0,       // 1 = the logbooks fly to Kepler's desk
      orbit: 0,       // the orbit model showing
      dots: 0,        // Tycho's measurements shown
      circ: 0,        // circles tried (1..4); 5 = the last one shatters
      ell: 0,         // the ellipse
      pen: 0,         // ch10_06: 1 = the pencil is yours to take round, 2 = going, 3 = done
      sweep: 0,       // ch10_07: equal areas
      tables: 0,      // ch10_08
      dream: 0,       // ch10_09
      galileo: 0,
      journal: 0,
    };
    this.t = 0; this.penA = 0; this.drawn = 0;
    G.world.height = (x, z) => (Math.abs(x) < RX && Math.abs(z) < RZ ? TOP : groundHeight(x, z));
    G.world.bounds = 2.1; G.world.blockers = [];
    G.sky.fogFar = 2200; G.sky.mist = 0.05;
    G.sky.setPlace({ lat: LAT, year: 1605, sunLon: SUNLON });
    this.life = new Life(this.root);
    this.buildCity();
    this.buildStudy();
    this.buildPeople();
    this.buildOrbit();
    this.journal = new Journal(this, drawJournal);
    this.registerInteractables();
    this.bellT = 6;
  }

  // ---------- Prague by night ----------
  buildCity() {
    const k = new Kit(), r = rng(8), wins = [];
    const SIZE = 3000, SEG = 160, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color(), cob = new THREE.Color(0x5a544c), grass = new THREE.Color(0x3a4a2e);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.7) * (SIZE / 2) / r0 : 0; x *= kk; z *= kk;
      p.setXYZ(i, x, Math.abs(x - RIVER(z)) < 70 ? -4 : groundHeight(x, z), z);
      c.copy(Math.abs(x) < 420 && z > -600 && z < 400 ? cob : grass).lerp(grass, N1(x / 50, z / 50) * 0.3);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); this.root.add(new THREE.Mesh(g, FLAT));
    const river = new THREE.Mesh(new THREE.PlaneGeometry(150, 6000), new THREE.MeshPhongMaterial({ color: 0x0c1824, specular: 0x8899bb, shininess: 70 }));
    river.rotation.x = -Math.PI / 2; river.position.set(RIVER(0), -2.5, 0); this.root.add(river);
    // the stone bridge (Charles Bridge) with its towers
    const bz = -120;
    k.box(150, 1.6, 9, 0x8a8070, [RIVER(bz), 6, bz]);
    for (let i = 0; i < 8; i++) k.cyl(2, 2.5, 8, 6, 0x7a7060, [RIVER(bz) - 66 + i * 19, 1, bz]);
    for (const s of [-1, 1]) { k.box(10, 24, 10, 0x6a6052, [RIVER(bz) + s * 80, 12, bz]); k.cyl(0.001, 7, 12, 4, 0x2a2a2a, [RIVER(bz) + s * 80, 30, bz], [0, Math.PI / 4, 0]); }
    // Old Town: streets of tall houses all round (not where the square and the Týn church stand)
    const ROOFS = [0x8a3424, 0x9a4028, 0x7a3020, 0x6a3a2a], WALLS = [0xe0d2b0, 0xd4c094, 0xc8a878, 0xb8b0a0, 0xd8c8b8, 0xe0c8a0];
    for (let gx = -280; gx <= 260; gx += 16) for (let gz = -520; gz <= 320; gz += 15) {
      const x = gx + (r() - 0.5) * 4, z = gz + (r() - 0.5) * 4;
      if (Math.abs(x) < 9 && Math.abs(z) < 9) continue;                 // our house
      if (Math.hypot(x - 60, z + 110) < 45) continue;                    // the square
      if (r() < 0.12) continue;
      house(k, { x, y: groundHeight(x, z), z, w: 8 + r() * 4, d: 9, h: 9 + r() * 7, yaw: Math.round(r() * 4) * Math.PI / 2, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: ROOFS[Math.floor(r() * ROOFS.length)], gableFront: r() < 0.6, stepped: r() < 0.1 }, wins);
    }
    // the house we're in: tall, with its walls under the study
    k.box(RX * 2 + 0.6, TOP, RZ * 2 + 0.6, 0xd8c8a8, [0, TOP / 2, 0]);
    // the Týn church across the square: tall nave and two great towers with clusters of little spires
    const tx = 70, tz = -140;
    k.box(18, 26, 40, 0x7a7266, [tx, 13, tz - 22]); k.add(gableRoof(18, 40, 14, 0.3).rotateY(Math.PI / 2), 0x4a4440, [tx, 26, tz - 22]);
    for (const s of [-1, 1]) {
      const sx = tx + s * 6.5;
      k.box(8, 44, 8, 0x8a8274, [sx, 22, tz]); k.cyl(0.001, 5.5, 26, 4, 0x2a2a2e, [sx, 57, tz], [0, Math.PI / 4, 0]);
      for (const [ox, oz] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]]) { k.cyl(0.6, 0.6, 3, 6, 0x8a8274, [sx + ox, 45.5, tz + oz]); k.cyl(0.001, 0.9, 7, 6, 0x2a2a2e, [sx + ox, 50.5, tz + oz]); k.ball(0.25, 0, 0xd8b040, [sx + ox, 54.2, tz + oz]); }
      k.ball(0.5, 0, 0xd8b040, [sx, 70.5, tz]);
    }
    // the Old Town Hall's tower with its clock, on the square
    k.box(7, 60, 7, 0x8a8070, [30, 30, -100]); k.cyl(0.001, 5.5, 12, 4, 0x2a2a2e, [30, 66, -100], [0, Math.PI / 4, 0]);
    const clock = canvasTex(256, 256, (cg) => { cg.fillStyle = '#1a2a5a'; cg.beginPath(); cg.arc(128, 128, 120, 0, 6.28); cg.fill(); cg.strokeStyle = '#d8b040'; cg.lineWidth = 8; for (const R of [118, 80, 40]) { cg.beginPath(); cg.arc(128, 128, R, 0, 6.28); cg.stroke(); } cg.fillStyle = '#d8b040'; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; cg.fillRect(128 + Math.cos(a) * 100 - 3, 128 + Math.sin(a) * 100 - 3, 6, 6); } });
    const cm = new THREE.Mesh(new THREE.CircleGeometry(3, 32), new THREE.MeshBasicMaterial({ map: clock })); cm.position.set(30, 18, -96.4); this.root.add(cm);
    // Prague Castle on its hill across the river: the long palace and St Vitus's spires
    const cx = -560, cz = -760, cy = 58;
    k.box(380, 22, 30, 0xd8d0c0, [cx, cy + 11, cz]); k.add(gableRoof(380, 30, 8, 0.3), 0x5a4a3a, [cx, cy + 22, cz]);
    k.box(30, 22, 160, 0xd8d0c0, [cx + 190, cy + 11, cz - 70]);
    k.box(70, 34, 24, 0x7a7266, [cx + 40, cy + 17, cz - 50]); k.add(gableRoof(70, 24, 16, 0.3), 0x3a4a44, [cx + 40, cy + 34, cz - 50]);
    k.box(12, 60, 12, 0x7a7266, [cx + 10, cy + 30, cz - 50]); k.cyl(0.001, 8, 24, 8, 0x3a5a4a, [cx + 10, cy + 72, cz - 50]);
    for (let i = 0; i < 8; i++) k.cyl(0.001, 1.6, 10, 4, 0x6a6258, [cx + 18 + i * 8, cy + 38, cz - 50]);
    for (let i = 0; i < 6; i++) wins.push({ p: new THREE.Vector3(cx - 150 + i * 60, cy + 12, cz + 15.1), yaw: 0 });
    // trees on the castle hill and along the river
    for (let i = 0; i < 120; i++) { const x = -700 + r() * 500, z = -900 + r() * 250, y = groundHeight(x, z); if (z > -720 && z < -700) continue; k.ball(3 + r() * 3, 1, 0x24301e, [x, y + 4, z]); }
    this.root.add(k.mesh());
    this.root.add(windows(wins, { lit: 0.35, seed: 3 }));
    // smoke from chimneys, bells, a few horses in the square
    this.smokes = [[40, 18, -40], [-60, 20, -80], [20, 22, 60], [-120, 18, -200]].map((q) => { const sm = this.life.add(makeSmoke(new THREE.Vector3(...q), { n: 6, rise: 9, size: 1.4, opacity: 0.12, color: 0x8a90a0 })); return sm; });
    this.horses = this.life.add(makeHerd('horse', { n: 3, area: { x: 60, z: -110, r: 14 }, height: groundHeight, seed: 5 }));
  }

  // ---------- Kepler's study ----------
  buildStudy() {
    const k = new Kit(), r = rng(31), WOOD = 0x6a4a30, DARK = 0x3a2818, PL = 0xd8ccb0;
    // floor, walls (south, east, west) and the beamed ceiling; the north side opens in three arches
    for (let i = 0; i < 11; i++) k.box(0.46, 0.06, RZ * 2, i % 2 ? 0x7a5a3a : 0x6e5034, [-RX + 0.25 + i * 0.47, TOP + 0.03, 0]);
    k.box(RX * 2, 3.2, 0.25, PL, [0, TOP + 1.6, RZ]);
    for (const s of [-1, 1]) k.box(0.25, 3.2, RZ * 2, PL, [s * RX, TOP + 1.6, 0]);
    k.box(RX * 2 + 0.4, 0.2, RZ * 2 + 0.4, 0x5a4232, [0, TOP + 3.3, 0]);
    for (let i = 0; i < 6; i++) k.box(RX * 2, 0.18, 0.2, DARK, [0, TOP + 3.1, -RZ + 0.4 + i * 0.75]);
    // the north wall: three tall arches (pillars and a low parapet you can lean on)
    k.box(RX * 2, 0.55, 0.3, PL, [0, TOP + 3.0, -RZ]);
    for (const x of [-RX + 0.15, -0.85, 0.85, RX - 0.15]) k.box(0.32, 3.2, 0.32, 0xc8bca0, [x, TOP + 1.6, -RZ]);
    for (const x of [-1.75, 0, 1.75]) for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI; k.box(0.14, 0.14, 0.3, 0xc8bca0, [x + Math.cos(a) * 0.72, TOP + 2.55 + Math.sin(a) * 0.4, -RZ]); }
    k.box(RX * 2, 0.7, 0.3, PL, [0, TOP + 0.35, -RZ]); k.box(RX * 2 + 0.1, 0.06, 0.4, 0xb8ac90, [0, TOP + 0.73, -RZ]);
    // bookshelves on the west wall, a tiled stove in the south-east corner, a bed in the corner
    for (let j = 0; j < 4; j++) { k.box(0.35, 0.04, 2.6, WOOD, [-RX + 0.3, TOP + 0.5 + j * 0.6, 0.4]); for (let i = 0; i < 16; i++) { const h = 0.32 + r() * 0.16; k.box(0.24, h, 0.06 + r() * 0.05, [0x6a2a1a, 0x2a3a2a, 0x4a3a1a, 0x3a2a3a, 0x5a4a2a][Math.floor(r() * 5)], [-RX + 0.3, TOP + 0.52 + j * 0.6 + h / 2, -0.8 + i * 0.16]); } }
    k.box(0.9, 1.9, 0.8, 0x3a6a5a, [RX - 0.6, TOP + 0.95, RZ - 0.55]); for (let i = 0; i < 4; i++) k.box(0.92, 0.04, 0.82, 0x2a4a3a, [RX - 0.6, TOP + 0.3 + i * 0.45, RZ - 0.55]);
    // the desk by the east arch, a chair, papers everywhere, a big globe
    const dx = 1.5, dz = -0.6;
    k.box(1.4, 0.06, 0.8, WOOD, [dx, TOP + 0.8, dz]); for (const [ox, oz] of [[-0.6, -0.33], [0.6, -0.33], [-0.6, 0.33], [0.6, 0.33]]) k.box(0.06, 0.8, 0.06, DARK, [dx + ox, TOP + 0.4, dz + oz]);
    k.box(0.5, 0.05, 0.5, WOOD, [dx, TOP + 0.48, dz + 0.7]); k.box(0.5, 0.6, 0.05, WOOD, [dx, TOP + 0.8, dz + 0.95]);
    for (let i = 0; i < 18; i++) k.box(0.3, 0.004, 0.38, i % 3 ? 0xece0c0 : 0xd8c8a0, [dx - 0.5 + r() * 1.0, TOP + 0.835 + i * 0.002, dz - 0.25 + r() * 0.5], [0, r() * 1.2, 0]);
    for (let i = 0; i < 30; i++) { const a = r() * 6.28, d = 0.3 + r() * 1.2; k.box(0.22, 0.004, 0.28, 0xe8dcbc, [dx - 0.6 + Math.cos(a) * d, TOP + 0.065, dz + 0.6 + Math.sin(a) * d * 0.6], [0, r() * 3, 0]); }   // crumpled pages on the floor
    k.cyl(0.04, 0.12, 0.6, 8, DARK, [-1.2, TOP + 0.3, 1.2]); k.cyl(0.4, 0.4, 0.04, 24, 0xb08a52, [-1.2, TOP + 1.0, 1.2], [Math.PI / 2, 0, 0.3]);
    this.root.add(k.mesh());
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), new THREE.MeshLambertMaterial({ color: 0xc8b088 })); this.globe.position.set(-1.2, TOP + 1.0, 1.2); this.root.add(this.globe);
    // candles and the stove's glow
    this.candle = new THREE.PointLight(0xffa860, 3.2, 9, 1.6); this.candle.position.set(dx - 0.3, TOP + 1.2, dz - 0.2); this.root.add(this.candle);
    this.flames = [];
    for (const [x, z] of [[dx - 0.3, dz - 0.2], [dx + 0.4, dz - 0.25]]) { const ck = new Kit(); ck.cyl(0.02, 0.02, 0.16, 8, 0xf0e8d0, [0, 0.08, 0]); const m = ck.mesh(); m.position.set(x, TOP + 0.83, z); this.root.add(m); const f = glow(0xffb050, 0.12); f.position.set(x, TOP + 1.02, z); this.root.add(f); this.flames.push(f); }
    this.stove = new THREE.PointLight(0xff7a30, 1.2, 5, 1.8); this.stove.position.set(RX - 0.6, TOP + 0.6, RZ - 1.1); this.root.add(this.stove);
    this.G.world.blockers.push({ x: dx, z: dz, r: 0.75 }, { x: -RX + 0.3, z: 0.4, r: 0.4 }, { x: RX - 0.6, z: RZ - 0.55, r: 0.6 }, { x: -1.2, z: 1.2, r: 0.45 });
    // Tycho's logbooks (a stack he holds, later flying to the desk)
    const bk = new Kit(); for (let i = 0; i < 5; i++) bk.box(0.3, 0.07, 0.4, [0x5a2a1a, 0x2a3a2a, 0x4a3a1a, 0x3a2a3a, 0x6a4a2a][i], [0, i * 0.075, 0], [0, i * 0.05, 0]);
    this.logs = bk.mesh(); this.root.add(this.logs);
    this.logGlow = glow(0xffd890, 0.9, 0); this.logs.add(this.logGlow);
    // a dog asleep by the stove
    this.dog = this.life.add(makeHerd('dog', { n: 1, area: { x: RX - 1.4, z: RZ - 0.9, r: 0.3 }, height: () => TOP, seed: 2 }));
  }

  buildPeople() {
    const add = (model, pos, look = {}) => { const P = makePerson({ model, seed: 13 + this.root.children.length, ...look }); P.g.position.copy(pos); this.root.add(P.g); return P; };
    this.kep = add('kepler', new THREE.Vector3(1.5, TOP, 0.25), { tunic: 0x1a1a1a, hair: 0x2a1a10, height: 1.7 });
    this.kep.g.rotation.y = Math.PI;
    this.tyc = add('tycho', new THREE.Vector3(-0.9, TOP, -0.3), { tunic: 0x1a1a1a, hair: 0x9a5a2a, height: 1.78 });
    holdProp(this.tyc, this.logs, 'Right', [0, 0.05, 0.12]);
    // in the streets below: people with lanterns, a night watchman calling the hour
    this.walkers = [];
    for (let i = 0; i < 7; i++) {
      const x = -30 + i * 14, z = -40 - (i % 3) * 30, P = add('townsman', new THREE.Vector3(x, 0, z), { height: 1.6 + (i % 3) * 0.06 });
      P.routine = [{ x: x + 10, z: z - 20, pose: 'idle', secs: 4 + i }, { x: x - 6, z: z + 12, pose: i % 2 ? 'talk' : 'idle', secs: 5 }, { x: 60 + (i - 3) * 6, z: -100, pose: 'talk', secs: 6 }];
      if (i % 2 === 0) { const L = makeTorch({ len: 0.35, color: 0xffc070, size: 0.6 }); holdProp(P, L, 'Right', [0, 0.02, 0.02]); P.lamp = L; }
      this.walkers.push(P);
    }
    this.galEcho = new Echo(this.G, this.root, { model: 'galileo', tint: 0xa8d0ff, pos: new THREE.Vector3(-1.2, TOP, -1.4), face: 0.3, seed: 6 });
    const tube = new Kit(); tube.cyl(0.035, 0.045, 1.0, 10, 0x6a4a2a, [0, 0.5, 0]); this.scope = tube.mesh(); this.galEcho.P.g.add(this.scope); this.scope.position.set(0.25, 1.45, 0.2); this.scope.rotation.set(-0.9, 0, -0.3);
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
    // the pencil (two pins and a loop of string)
    this.pencil = new THREE.Group(); this.pencil.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8).translate(0, 0.125, 0), new THREE.MeshBasicMaterial({ color: 0xf0c060, fog: false })), glow(0xffe0a0, 0.3, 0.8)); this.pencil.visible = false; M.add(this.pencil);
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
    // ch10_08: the Rudolphine Tables, a big glowing book on the desk
    this.tablesGlow = glow(0xffd890, 1.4, 0); this.tablesGlow.position.set(1.5, TOP + 1.0, -0.6); this.root.add(this.tablesGlow);
    // ch10_09: dream sparks drifting out through the arches
    this.dreamPts = glowPoints(200, { sizeScale: 260 }); this.dreamPts.visible = false; this.root.add(this.dreamPts);
    this.dp = Array.from({ length: 200 }, () => ({ x: (Math.random() - 0.5) * 5, y: TOP + Math.random() * 3, z: Math.random() * 3 - 2, v: 0.5 + Math.random() }));
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.penIt = {
      hint: 'Grab the pencil with GRIP and draw all the way round', deskHint: 'Click the pencil to draw the ellipse',
      get disabled() { return self.s.pen !== 1 && self.s.pen !== 2; },
      reach(pos) { self.pencil.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.3); },
      aim(o, d) { self.pencil.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.3 ? t : Infinity; },
      onGrab() { G.act({ type: 'pen' }); }, onTouch() { G.act({ type: 'pen' }); },
      // held in VR: the pencil follows your hand round (by its angle about the ellipse's middle)
      onHold(h) { if (!h?.pos) return; self.orbit.worldToLocal(_a.copy(h.pos)); const ang = Math.atan2(-_a.z / B, (_a.x + C) / A); let d = ang - (self.penA % (Math.PI * 2)); d = Math.atan2(Math.sin(d), Math.cos(d)); if (d > 0) self.handPush = Math.min(0.2, d); },
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
    // the circles
    s.phase = 'circles'; s.orbit = 1; s.dots = 1; s.guide = [ORR.x + 3.5, ORR.y + 0.8, ORR.z + 2.5];
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
    // draw one yourself
    s.phase = 'draw'; s.ell = 0; s.pen = 1;
    await D.say('ch10_06');
    D.hint(G.mode === 'desktop' ? this.penIt.deskHint : this.penIt.hint, 9);
    await D.auto(() => s.pen >= 2, () => { s.pen = 2; }, { after: fast ? 0.3 : 1.5, timeout: fast ? 2 : 25 });
    if (s.pen < 2) s.pen = 2;
    G.ui.showHint('');
    await D.until(() => s.pen === 3, fast ? 4 : 30);
    s.pen = 3; s.ell = 2;
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
    // and in Italy...
    s.phase = 'italy'; s.galileo = 1;
    await D.say('ch10_10');
    await D.wait(fast ? 0.5 : 2.5);
    s.galileo = 0;
    s.phase = 'journal';
    await this.journal.present(D);
    s.phase = 'done';
  }

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
    this.stove.intensity = (1 + 0.4 * fl) * dim;
    this.globe.rotation.y += dt * 0.1;
    this.life.update(dt, t);
    this.updatePeople(dt, t);
    this.updateOrbit(dt, t);
    this.updateDream(dt, t);
    const busy = this.journal.update();
    guideUpdate(this, busy);
    if ((this.bellT -= dt) <= 0 && G.audio.ctx) { this.bellT = 80 + Math.random() * 40; for (let i = 0; i < 3; i++) setTimeout(() => G.audio.bell(_b.set(70, 50, -140), 0.45), i * 2400); }
  }

  updatePeople(dt, t) {
    const s = this.s, K = this.kep, T = this.tyc;
    // Kepler: at his desk writing, up to look at the orbit and point, or watching the Moon dream
    if (s.phase === 'meet' || s.phase === 'tycho') { K.pose = s.phase === 'meet' ? 'talk' : 'idle'; K.look = T.g.position.clone().setY(TOP + 1.6); }
    else if (s.orbit && s.phase !== 'tables') { K.g.rotation.y = damp(K.g.rotation.y, Math.PI * 0.85, 2, dt); K.pose = s.circ === 5 ? 'gasp' : s.ell ? 'cheer' : 'point'; K.pointAt.copy(ORR); K.look = ORR.clone(); }
    else if (s.dream) { K.pose = 'idle'; K.look = _a.set(30, TOP + 40, -40).clone(); }
    else { K.g.rotation.y = damp(K.g.rotation.y, Math.PI, 2, dt); K.pose = 'write'; K.look = null; }
    animatePerson(K, t, dt);
    // Tycho: guarding his books, then fading away
    this.tycFade = damp(this.tycFade ?? 1, s.tycho === 1 ? 1 : 0, 0.9, dt);
    T.g.visible = this.tycFade > 0.03;
    if (this.tycFade < 0.999) T.g.traverse((o) => { if (o.isMesh) { if (!o.userData.fadeMat) { o.material = o.material.clone(); o.material.transparent = true; o.userData.fadeMat = true; } o.material.opacity = this.tycFade; } });
    T.pose = 'hold'; T.look = K.g.position.clone().setY(TOP + 1.6); animatePerson(T, t, dt);
    // the books fly from Tycho's arms to Kepler's desk
    if (s.books && !this.booksFlying) { this.booksFlying = true; dropProp(T, 'Right'); this.root.add(this.logs); this.logs.getWorldPosition(_a); this.bookFrom = this.logs.position.clone(); this.bookF = 0; }
    if (this.booksFlying && this.bookF < 1) { this.bookF = Math.min(1, this.bookF + dt / 2.5); _a.set(1.1, TOP + 0.86, -0.75); this.logs.position.lerpVectors(this.bookFrom, _a, ease(this.bookF)); this.logs.position.y += Math.sin(this.bookF * Math.PI) * 0.6; this.logs.rotation.set(0, this.bookF * 6.28, 0); }
    this.logGlow.material.opacity = this.booksFlying ? 0.6 * (1 - Math.abs(this.bookF - 0.5) * 2) + (s.tables ? 0.5 : 0) : 0;
    for (const P of this.walkers) { runRoutine(P, dt, { height: groundHeight, speed: 0.9 }); animatePerson(P, t, dt); P.lamp?.userData.flicker(t); }
    this.galEcho.show(!!s.galileo); this.galEcho.update(dt, t);
  }

  updateOrbit(dt, t) {
    const G = this.G, s = this.s, M = this.orbit, fast = G.params.has('fast') ? 3 : 1;
    this.orbV = damp(this.orbV || 0, s.orbit ? 1 : 0, 1.5, dt); M.visible = this.orbV > 0.01;
    if (!M.visible) return;
    G.camera.getWorldPosition(_a); M.lookAt(_a); M.rotateX(Math.PI / 2 - 0.35);
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
      if (s.ell && i < 3) continue;
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
    // the ellipse, the Sun at one focus, the other focus empty
    const ev = this.ellV = damp(this.ellV || 0, s.ell || s.pen ? 1 : 0, 1.2, dt);
    const drawTo = s.pen ? this.drawn : 1;
    for (let j = 0; j < 360; j++) { const f = j / 360; if (f > drawTo) break; const a = f * Math.PI * 2; dot(A * Math.cos(a) - C, -B * Math.sin(a), ev, 0.85 * ev, 0.45 * ev, 0.03); }
    const fv = s.ell >= 2 || s.pen ? ev : 0;
    dot(-2 * C, 0, 0.7 * fv, 0.7 * fv, 0.9 * fv, 0.06);
    this.labs.ell.material.opacity = damp(this.labs.ell.material.opacity, s.ell >= 1 && !s.pen && !s.sweep && !s.tables ? 1 : 0, 3, dt);
    this.labs.sun.material.opacity = this.labs.focus.material.opacity = damp(this.labs.focus.material.opacity, s.ell >= 2 && !s.sweep && !s.tables ? 1 : 0, 3, dt);
    // ch10_06: pins and string, the pencil going round
    this.pencil.visible = s.pen === 1 || s.pen === 2;
    if (s.pen === 2) { this.penA += (this.handPush ? this.handPush : dt * 0.9 * fast); this.handPush = 0; this.drawn = Math.min(1, this.penA / (Math.PI * 2)); if (this.drawn >= 1 && G.isHost) { s.pen = 3; G.audio.ctx && G.audio.chime(_a.copy(ORR), 0.5); } }
    const pa = s.pen === 3 ? 0 : this.penA; this.pencil.position.set(A * Math.cos(pa) - C, 0, -B * Math.sin(pa));
    if (this.pencil.visible) {
      const pin = 0.95;
      for (const fx of [0, -2 * C]) { dot(fx, 0, pin, pin * 0.85, 0.4, 0.07); for (let j = 0; j < 40; j++) { const f = j / 40; dot(lerp(fx, this.pencil.position.x, f), lerp(0, this.pencil.position.z, f), 0.6, 0.6, 0.6, 0.012); } }
    }
    // Mars going round, brighter during the sweep; the Sun
    this.mars.visible = s.sweep || s.tables || s.ell >= 2; this.sun.visible = true;
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

  dispose() {
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.sky.hideMoon();
  }
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
