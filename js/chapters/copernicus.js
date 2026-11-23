// Era 2, Chapter 1 (n 8): Copernicus moves the Sun. Frombork, Poland, an autumn night around 1540.
//
// You stand on top of a brick tower in the corner of the cathedral's walls, high on its hill: the
// great red-brick cathedral with its stepped gables and slender turrets behind you, the little town
// below, and beyond it the Vistula Lagoon, silver under a thin Moon. Nicolaus Copernicus works at his
// desk under a wooden lean-to, with his instruments (a triquetrum, a quadrant) beside him.
//
// The story: Aristarchus's old question; the sky as Ptolemy drew it, floating over the lagoon as a
// glowing model, circles on circles; you take the Sun and put it in the middle, and the tangle of
// loops unwinds, live, into neat circles (the very same motions, seen from the Sun instead of the
// Earth); Mars's backward loop turns out to be the Earth overtaking it; the whole sky turns because
// the Earth spins; thirty years of quiet work; the printed book arrives in 1543; and its famous
// diagram rises into the stars.
//
// The model is real geometry: each planet goes round the Sun on a circle with its true period. Seen
// from the Earth (subtract the Earth's position) those same circles become Ptolemy's loops. Radii
// are squeezed so Saturn fits (the loops still come out, just as they do in the real sky).
// World axes: -Z north, +X east, +Y up. The tower top is at y = TOP; the lagoon lies to the north.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, walkToward, holdProp, dropProp } from '../people.js';
import { makeHerd, makeFlock, makeSmoke, makeTorch, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2, roughStone } from '../shapes.js';
import { glowPoints } from '../wow/fx.js';
import { D2R, ease, clamp01, at, sunAt, house, windows, steppedGable, gableRoof, glow, label, Journal, INK, guideUpdate } from '../era2/common.js';

const LAT = 54.36, YEAR = 1540, SUNLON = 215;     // Frombork, early November
const TOP = 14;                                    // the tower's top floor, metres above the hilltop
const HALF = 3;                                    // the tower is 6 x 6 m
const ORR = new THREE.Vector3(0, TOP + 2.7, -8.5); // where the sky model floats, out over the hillside
const TILT = 30;                                   // ...tipped toward you so you see into it (degrees)
const N1 = noise2(81), N2 = noise2(83);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();

// ---------- The ground: the cathedral hill, the town below it, the lagoon ----------
const WATER = -19.6;
export function groundHeight(x, z) {
  // the hilltop (cathedral and tower) is flat at 0; north of it the slope drops to the town and shore
  const edge = -14 + Math.sin(x / 23) * 4;
  let h = 0;
  if (z < edge) h = -17 * (1 - Math.exp(-(edge - z) / 16));
  if (z < -150 + Math.sin(x / 70) * 15) h = lerp(h, -22, clamp((-150 + Math.sin(x / 70) * 15 - z) / 20, 0, 1));   // the shore
  if (x < -190) h = lerp(h, -22, clamp((-190 - x) / 25, 0, 1) * clamp((-30 - z) / 30, 0, 1));                      // lagoon to the west too
  // rolling fields and woods to the south, small bumps everywhere
  h += (N1(x / 90, z / 90) - 0.5) * 8 * clamp((z - 90) / 120, 0, 1);
  h += (N2(x / 9, z / 9) - 0.5) * 0.35 * clamp((Math.hypot(x, z) - 10) / 20, 0, 1);
  return h;
}

// The planets, round the Sun: real periods (years); radii squeezed to fit (metres in the model)
const BODIES = [
  { k: 'mercury', name: 'Mercury', T: 0.241, r: 0.42, size: 0.035, col: 0xd8c8b0, ph: 1.2, trail: 0.95 },
  { k: 'venus', name: 'Venus', T: 0.615, r: 0.66, size: 0.055, col: 0xfff0c8, ph: 3.4, trail: 1.6 },
  { k: 'earth', name: 'Earth', T: 1, r: 0.95, size: 0.06, col: 0x5aa0ff, ph: 0, trail: 1 },
  { k: 'mars', name: 'Mars', T: 1.881, r: 1.3, size: 0.048, col: 0xff6a42, ph: 0.35, trail: 2.6 },
  { k: 'jupiter', name: 'Jupiter', T: 11.86, r: 1.85, size: 0.1, col: 0xf0d2a8, ph: 2.3, trail: 4.5 },
  { k: 'saturn', name: 'Saturn', T: 29.46, r: 2.35, size: 0.085, col: 0xf0dc98, ph: 4.6, trail: 7 },
];
const EARTH = 2, MARS = 3;
const ZODIAC_R = 2.85;           // the band of stars the planets are seen against
const TRAIL_N = 150;
function helio(i, t, out) { const B = BODIES[i], a = 2 * Math.PI * t / B.T + B.ph; return out.set(Math.cos(a) * B.r, 0, -Math.sin(a) * B.r); }

export default class Copernicus {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.start = { pos: new THREE.Vector3(-0.4, 0, 1.0), yaw: 0 };   // facing north, over the lagoon
    this.s = {
      phase: 'arrive',
      guide: null,
      hour: 20.5,        // local time (the sky follows it)
      model: 0,          // the sky model showing (0..1)
      k: 1,              // 1 = seen from the Earth (Ptolemy), 0 = from the Sun (Copernicus)
      epi: 0,            // Ptolemy's circles on circles drawn in
      sunHand: 0,        // 1 = the Sun is floating by your hand to grab; 2 = flying to the middle; 3 = in the middle
      names: 0,          // how many planet names are lit
      mars: 0,           // 1 = following Mars from the Earth (the sight line and its path on the stars)
      spin: 0,           // the Earth spinning, then the sky turning
      years: 0,          // ch8_08: the pile of pages grows
      friend: 0,         // Rheticus comes to visit
      book: 0,           // 1 the messenger brings it, 2 in Copernicus's hands, 3 he's gone, the book glows on the desk
      diagram: 0,        // the famous drawing rising into the stars
      journal: 0,
      cop: 'desk',       // what Copernicus is doing: desk, sight, look, talk, point, hold
    };
    this.t = 0; this.tm = 3.2;   // model time (years)
    G.world.height = (x, z) => (Math.abs(x) < HALF && Math.abs(z) < HALF ? TOP : groundHeight(x, z));
    G.world.bounds = 2.25;
    G.world.blockers = [];
    G.sky.fogFar = 2600; G.sky.mist = 0;
    G.sky.setPlace({ lat: LAT, year: YEAR, sunLon: SUNLON });
    G.audio.amb = 0.6;
    this.buildGround();
    this.buildLagoon();
    this.buildCathedral();
    this.buildTown();
    this.buildTower();
    this.buildTrees();
    this.buildPeople();
    this.buildLife();
    this.buildModel();
    this.buildBook();
    this.journal = new Journal(this, drawJournal);
    this.registerInteractables();
    this.bellT = 4; this.owlT = 25; this.gullT = 8;
  }

  // ---------- Building the place ----------
  buildGround() {
    const SIZE = 2400, SEG = 190;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const grass = new THREE.Color(0x4a5a34), grass2 = new THREE.Color(0x6a6a3a), field = new THREE.Color(0x7a6a44), mud = new THREE.Color(0x4a3e30), sand = new THREE.Color(0x8a7e62), yard = new THREE.Color(0x7a7266);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i);
      // more detail near the tower, stretched out far away
      const r0 = Math.hypot(x, z), k = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.8) * (SIZE / 2) / r0 : 0;
      x = x * k + 40; z = z * k - 20;
      const y = groundHeight(x, z); p.setXYZ(i, x, y, z);
      c.copy(grass).lerp(grass2, N2(x / 18, z / 18));
      if (z > 90) c.lerp(field, clamp(N1(x / 40 + 3, z / 40) * 1.6 - 0.4, 0, 1));                  // ploughed fields
      if (y < -20.5) c.copy(sand);
      if (x > -6 && x < 112 && z > -8 && z < 58) c.lerp(yard, 0.7);                                   // the cathedral close
      if (z < -55 && z > -150 && x > -130 && x < 60) c.lerp(mud, 0.45);                              // the town's lanes
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    this.root.add(new THREE.Mesh(g, FLAT));
  }

  buildLagoon() {
    // the water: dark, with the Moon's light glancing off it
    const w = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshPhongMaterial({ color: 0x0c1a28, specular: 0x8899bb, shininess: 60, emissive: 0x02060c }));
    w.rotation.x = -Math.PI / 2; w.position.set(0, WATER, -1500); this.root.add(w);
    // a path of glitter on the water toward the Moon, shimmering (one long strip, additive)
    this.glitTex = canvasTex(64, 512, (g, W, H) => {
      for (let i = 0; i < 900; i++) { const y = Math.random() * H, x = W / 2 + (Math.random() - 0.5) * W * (0.15 + 0.85 * y / H); g.fillStyle = `rgba(220,230,255,${0.2 + Math.random() * 0.8})`; g.fillRect(x, y, 1 + Math.random() * 2, 1); }
    });
    this.glitTex.wrapT = THREE.RepeatWrapping;
    this.glitter = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ map: this.glitTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.glitter.rotation.x = -Math.PI / 2; this.glitter.position.y = WATER + 0.05; this.root.add(this.glitter);
    // the Vistula Spit on the far side: a long low line of dark pine forest and dunes
    const k = new Kit(), r = rng(31);
    k.box(9000, 3, 60, 0x6a6650, [0, WATER + 1, -2100]);
    for (let i = 0; i < 260; i++) { const x = -4000 + i * 31 + r() * 20, h = 10 + r() * 8; k.cyl(0.1, 4 + r() * 3, h, 5, 0x1a2a20, [x, WATER + 2 + h / 2, -2100 + (r() - 0.5) * 40]); }
    this.root.add(k.mesh());
  }

  // Frombork Cathedral: a long brick hall church, steep tiled roof, stepped gables east and west,
  // slender octagonal turrets at the corners of the west front, buttresses and tall pointed windows.
  // Round it the cathedral close's wall with its towers (you're on top of the north-west one).
  buildCathedral() {
    const k = new Kit(), B = 0x9a4630, B2 = 0x8a3c28, ROOF = 0x7a2e22, STONE = 0xb8a890;
    const x0 = 30, x1 = 98, z0 = 14, z1 = 32, H = 17;   // the nave (west end at x0)
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = x1 - x0, W = z1 - z0;
    k.box(L, H, W, B, [cx, H / 2, cz]);
    k.box(L + 0.6, 0.8, W + 0.6, STONE, [cx, 0.4, cz]);
    // the roof, very steep and high
    k.add(gableRoof(L, W, 15, 0.5), ROOF, [cx, H, cz]);
    steppedGable(k, W, 15, 6, B, [x0 - 0.25, H, cz], Math.PI / 2, 0.8, B2);
    steppedGable(k, W, 15, 6, B, [x1 + 0.25, H, cz], Math.PI / 2, 0.8, B2);
    // buttresses and tall pointed windows down both sides
    this.cathWins = [];
    for (let i = 0; i <= 9; i++) {
      const x = x0 + 2 + i * (L - 4) / 9;
      for (const sz of [-1, 1]) {
        const z = sz < 0 ? z0 : z1;
        k.box(1.4, H - 1, 2.2, B2, [x, (H - 1) / 2, z + sz * 1.1]);
        k.cyl(0.001, 1.0, 1.6, 4, ROOF, [x, H - 0.2, z + sz * 1.6], [0, Math.PI / 4, 0]);
        if (i < 9) { const wx = x + (L - 4) / 18; this.cathWins.push({ p: new THREE.Vector3(wx, 8.5, z + sz * 0.05), yaw: sz < 0 ? Math.PI : 0 }); k.box(2.2, 11, 0.4, STONE, [wx, 8.5, z + sz * 0.02]); k.cyl(0.001, 1.1, 1.5, 4, STONE, [wx, 14.6, z + sz * 0.02], [0, Math.PI / 4, 0], [1, 1, 0.3]); }
      }
    }
    // the four slender octagonal turrets at the west front, with tall pointed spires
    for (const [tz, tall] of [[z0 - 0.4, 1], [z1 + 0.4, 1]]) {
      k.cyl(1.4, 1.5, 32, 8, B2, [x0 - 0.4, 16, tz]);
      for (let j = 1; j < 6; j++) k.cyl(1.55, 1.55, 0.35, 8, STONE, [x0 - 0.4, j * 5.5, tz]);
      k.cyl(0.001, 1.6, 9 * tall, 8, ROOF, [x0 - 0.4, 36.5, tz]);
    }
    for (const tz of [z0 + 4, z1 - 4]) { k.cyl(0.7, 0.75, 8, 8, B2, [x0 - 0.5, H + 12, tz]); k.cyl(0.001, 0.85, 5, 8, ROOF, [x0 - 0.5, H + 18.5, tz]); }
    // the porch at the west door, with its own little stepped gable, and the great door
    k.box(7, 9, 6, B, [x0 - 3.5, 4.5, cz]); k.add(gableRoof(6, 7, 4, 0.2).rotateY(Math.PI / 2), ROOF, [x0 - 3.5, 9, cz]);
    steppedGable(k, 7, 4, 3, B, [x0 - 6.5, 9, cz], Math.PI / 2, 0.5, B2);
    k.box(0.3, 4.5, 3, 0x3a2414, [x0 - 6.6, 2.25, cz]); k.box(0.4, 5.4, 3.8, STONE, [x0 - 6.55, 2.7, cz]);
    // a little ridge turret (the signal bell) in the middle of the roof
    k.cyl(0.9, 0.9, 3, 6, 0x5a4a38, [cx, H + 15.5, cz]); k.cyl(0.001, 1.1, 5, 6, 0x4a6a5a, [cx, H + 19.5, cz]);
    // The close's wall, with towers at its corners and a gate tower to the south
    const wall = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax);
      k.box(len, 6.5, 1.4, B, [(ax + bx) / 2, 3.25, (az + bz) / 2], [0, yaw, 0]);
      for (let d = 1; d < len; d += 2.2) { const f = d / len; k.box(1.1, 1, 1.4, B2, [ax + (bx - ax) * f, 7, az + (bz - az) * f], [0, yaw, 0]); }   // crenellations
      k.box(len, 0.25, 1.8, 0x5a4232, [(ax + bx) / 2, 5.9, (az + bz) / 2 + 0.1], [0, yaw, 0]);                                                      // the wall walk
    };
    wall(HALF, 0, 112, 0); wall(112, 0, 112, 56); wall(112, 56, 0, 56); wall(0, 56, 0, HALF);
    const tower = (x, z, h, w) => { k.box(w, h, w, B2, [x, h / 2, z]); k.add(gableRoof(w, w, 5, 0.3), ROOF, [x, h, z]); };
    tower(112, 0, 12, 6); tower(112, 56, 11, 6); tower(0, 56, 11, 6);
    // the south gate tower, its arch, and the great bell tower near the gate
    k.box(9, 15, 8, B, [56, 7.5, 56]); k.add(gableRoof(9, 8, 6, 0.4), ROOF, [56, 15, 56]); k.box(4, 5, 8.4, 0x2a1a10, [56, 2.5, 56]);
    // the canons' houses (curias) inside and just outside the close
    this.closeWins = [];
    const hr = rng(5);
    for (const [x, z, yaw] of [[14, 44, 0], [24, 46, 0], [70, 46, 0], [82, 45, 0], [94, 46, 0], [10, 10, Math.PI / 2], [104, 12, -Math.PI / 2], [104, 30, -Math.PI / 2], [30, 70, Math.PI], [46, 72, Math.PI], [66, 70, Math.PI], [86, 71, Math.PI]]) {
      house(k, { x, y: groundHeight(x, z), z, w: 8 + hr() * 3, d: 7, h: 6 + hr() * 2, yaw, wall: [0xd6c4a2, 0xc8b08a, 0x9a4a32][Math.floor(hr() * 3)], roofCol: ROOF, gableFront: hr() < 0.4 }, this.closeWins);
    }
    this.root.add(k.mesh());
    const wl = windows(this.cathWins.map((w) => ({ p: w.p, yaw: w.yaw })), { lit: 0.35, w: 1.5, h: 9, warm: 0xc0803a, seed: 9 });
    this.root.add(wl);
    this.root.add(windows(this.closeWins, { lit: 0.5, seed: 4 }));
  }

  // The town of Frombork down the hill: lanes of tall narrow houses with their gables to the street,
  // a market square with the town hall, St Nicholas's church, the harbour and its fishing boats.
  buildTown() {
    const k = new Kit(), r = rng(12), wins = [];
    const ROOFS = [0x8a3424, 0x9a4028, 0x7a3020, 0x5a4a44], WALLS = [0xe0d2b0, 0xd4c094, 0xc8a878, 0xb8b0a0, 0x9a4a32, 0xd8c8b8];
    this.chimneys = [];
    const street = (x0, z0, x1, z1, side) => {
      const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len, yaw = Math.atan2(dx, dz) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      for (let d = 2; d < len - 3;) {
        const w = 5 + r() * 3, x = x0 + dx * (d + w / 2) + side * -dz * 6.5, z = z0 + dz * (d + w / 2) + side * dx * 6.5;
        const y = groundHeight(x, z);
        house(k, { x, y: y - 0.3, z, w, d: 9, h: 6 + r() * 4, yaw, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: ROOFS[Math.floor(r() * ROOFS.length)], gableFront: r() < 0.75, stepped: r() < 0.2, timber: r() < 0.3 ? 0x3a2a1c : null }, wins);
        if (r() < 0.25) this.chimneys.push(new THREE.Vector3(x, y + 13, z));
        d += w + 0.3;
      }
    };
    // lanes running down to the harbour, and two along the shore
    for (const x of [-95, -65, -35, -5, 25]) { street(x, -60, x - 6, -140, 1); street(x, -60, x - 6, -140, -1); }
    street(-110, -145, 40, -145, 1);
    // the market square, the town hall in the middle
    const mx = -50, mz = -100;
    k.box(14, 10, 10, 0xb84a30, [mx, groundHeight(mx, mz) + 5, mz]); k.add(gableRoof(14, 10, 8, 0.3), 0x7a2e22, [mx, groundHeight(mx, mz) + 10, mz]);
    k.cyl(1.2, 1.4, 12, 8, 0xa84a30, [mx + 5, groundHeight(mx, mz) + 16, mz]); k.cyl(0.001, 1.6, 6, 8, 0x3a5a4a, [mx + 5, groundHeight(mx, mz) + 25, mz]);
    // St Nicholas's, the town church, with its tower
    const sx = 10, sz = -112, sy = groundHeight(sx, sz);
    k.box(24, 11, 12, 0x9a4630, [sx, sy + 5.5, sz]); k.add(gableRoof(24, 12, 9, 0.3), 0x7a2e22, [sx, sy + 11, sz]);
    k.box(7, 26, 7, 0x8a3c28, [sx - 14, sy + 13, sz]); k.cyl(0.001, 4.6, 14, 4, 0x7a2e22, [sx - 14, sy + 33, sz], [0, Math.PI / 4, 0]);
    // the harbour: a wooden pier and its boats
    const py = WATER + 0.6;
    k.box(4, 0.4, 60, 0x5a4632, [-40, py, -185]);
    for (let i = 0; i < 12; i++) k.cyl(0.18, 0.18, 3, 5, 0x3a2a1c, [-42 + (i % 2) * 4, WATER - 0.6, -158 - Math.floor(i / 2) * 10]);
    this.boats = [];
    for (let i = 0; i < 6; i++) {
      const bk = new Kit(), L = 7 + r() * 4;
      bk.cyl(0.9, 0.7, L, 8, 0x4a3420, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.45]);
      bk.box(1.4, 0.15, L * 0.8, 0x6a5038, [0, 0.38, 0]);
      bk.cyl(0.06, 0.08, 7, 5, 0x3a2a1c, [0, 3.6, L * 0.1]);
      bk.box(0.05, 3.5, 2.4, 0xb8a888, [0, 3.8, L * 0.1 - 1.2]);   // a furled sail
      const b = bk.mesh(); b.position.set(-48 + (i % 2) * 16 + r() * 2, WATER + 0.25, -170 - i * 9); b.rotation.y = (r() - 0.5) * 0.3; b.userData.ph = r() * 6;
      this.root.add(b); this.boats.push(b);
    }
    this.root.add(k.mesh());
    this.root.add(windows(wins, { lit: 0.33, seed: 8 }));
  }

  // The tower you stand on: brick walls, a crenellated parapet, a wooden floor, and Copernicus's
  // corner: a desk under a little lean-to roof, with books, papers, ink, a candle; his instruments.
  buildTower() {
    const k = new Kit(), r = rng(21), B = 0x9a4630, B2 = 0x8a3c28, WOOD = 0x6a4a30, DARK = 0x3a2818;
    const h0 = 0;
    k.box(HALF * 2, TOP - h0, HALF * 2, B, [0, (TOP + h0) / 2, 0]);
    for (let y = 2; y < TOP; y += 2.8) k.box(HALF * 2 + 0.08, 0.15, HALF * 2 + 0.08, B2, [0, y, 0]);   // brick courses that catch the light
    // floor planks
    for (let i = 0; i < 12; i++) k.box(0.48, 0.06, HALF * 2 - 0.8, i % 2 ? 0x7a5a3a : 0x6e5034, [-HALF + 0.4 + 0.25 + i * 0.47, TOP + 0.03, 0]);
    // the parapet with merlons (gaps to look through)
    for (const [ax, az, bx, bz] of [[-HALF, -HALF, HALF, -HALF], [HALF, -HALF, HALF, HALF], [HALF, HALF, -HALF, HALF], [-HALF, HALF, -HALF, -HALF]]) {
      const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax);
      k.box(len + 0.4, 0.7, 0.4, B, [(ax + bx) / 2, TOP + 0.35, (az + bz) / 2], [0, yaw, 0]);
      k.box(len + 0.5, 0.08, 0.5, 0xa89a88, [(ax + bx) / 2, TOP + 0.74, (az + bz) / 2], [0, yaw, 0]);
      for (let d = 0.3; d < len; d += 1.5) { const f = d / len; k.box(0.5, 0.36, 0.4, B2, [ax + (bx - ax) * f, TOP + 0.96, az + (bz - az) * f], [0, yaw, 0]); }
    }
    // the lean-to over the desk (east side): two posts and a sloping plank roof
    const ex = HALF - 0.45;
    for (const z of [-1.4, 1.4]) k.box(0.14, 2.6, 0.14, DARK, [ex - 1.2, TOP + 1.3, z]);
    k.box(1.8, 0.08, 3.4, 0x5a3e28, [ex - 0.5, TOP + 2.55, 0], [0, 0, -0.32]);
    for (let i = 0; i < 6; i++) k.box(1.85, 0.05, 0.08, DARK, [ex - 0.5, TOP + 2.6, -1.5 + i * 0.6], [0, 0, -0.32]);
    // the desk, a stool, a chest
    const dx = HALF - 0.85, dz = 0.15;
    k.box(0.7, 0.06, 1.5, WOOD, [dx, TOP + 0.82, dz]);
    for (const [ox, oz] of [[-0.3, -0.68], [0.3, -0.68], [-0.3, 0.68], [0.3, 0.68]]) k.box(0.06, 0.8, 0.06, DARK, [dx + ox, TOP + 0.4, dz + oz]);
    k.box(0.4, 0.04, 0.4, WOOD, [dx - 0.65, TOP + 0.5, dz + 0.35]); for (const [ox, oz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) k.box(0.04, 0.5, 0.04, DARK, [dx - 0.65 + ox, TOP + 0.25, dz + 0.35 + oz]);
    k.box(0.6, 0.45, 1.0, 0x5a3a22, [dx + 0.05, TOP + 0.23, dz + 1.45]); k.box(0.62, 0.06, 1.02, 0x8a6a3a, [dx + 0.05, TOP + 0.47, dz + 1.45]);
    // books (a stack, and a big open one), papers, an inkwell and quill, a brass astrolabe
    const bookCols = [0x6a2a1a, 0x3a3020, 0x5a4a2a, 0x2a3a4a, 0x7a5a2a];
    for (let i = 0; i < 5; i++) k.box(0.28 - i * 0.02, 0.06, 0.36 - i * 0.02, bookCols[i], [dx + 0.12, TOP + 0.88 + i * 0.065, dz - 0.5], [0, r() * 0.4, 0]);
    k.box(0.46, 0.03, 0.34, 0xe8dcb8, [dx - 0.05, TOP + 0.87, dz + 0.1], [0, 0.1, 0]);
    k.box(0.02, 0.03, 0.34, 0x8a6a3a, [dx - 0.05, TOP + 0.885, dz + 0.1], [0, 0.1, 0]);
    k.cyl(0.03, 0.035, 0.05, 8, 0x1a1a1a, [dx + 0.18, TOP + 0.875, dz + 0.45]);
    k.box(0.004, 0.25, 0.02, 0xf0f0e8, [dx + 0.19, TOP + 0.98, dz + 0.44], [0.2, 0, 0.35]);
    k.cyl(0.09, 0.09, 0.012, 16, 0xc09a40, [dx + 0.2, TOP + 0.86, dz + 0.75]);
    // the triquetrum (Ptolemy's rulers) in the north-west corner, pointed up at the sky
    const tx = -HALF + 0.75, tz = -0.2;   // against the west parapet
    k.box(0.12, 2.6, 0.12, WOOD, [tx, TOP + 1.3, tz]); k.box(0.5, 0.08, 0.5, DARK, [tx, TOP + 0.04, tz]);
    k.box(0.08, 2.2, 0.06, 0x8a6a42, [tx + 0.45, TOP + 2.1, tz + 0.1], [0, 0, -0.5]);       // the sighting arm, with its two sights
    k.box(0.1, 0.1, 0.1, DARK, [tx + 0.04, TOP + 2.55, tz + 0.1]); k.box(0.06, 0.08, 0.08, DARK, [tx + 0.92, TOP + 1.2, tz + 0.1]);
    k.box(0.06, 1.9, 0.05, 0xb08a52, [tx + 0.5, TOP + 0.95, tz + 0.1], [0, 0, 0.62]);       // the graduated ruler
    for (let i = 0; i < 16; i++) k.box(0.07, 0.008, 0.055, 0x2a1a10, [tx + 0.5 - Math.sin(0.62) * (-0.9 + i * 0.12), TOP + 0.95 + Math.cos(0.62) * (-0.9 + i * 0.12), tz + 0.1], [0, 0, 0.62]);
    // a quadrant on the south wall, and a brazier for warmth
    k.cyl(0.9, 0.9, 0.05, 12, 0xb08a52, [-1.6, TOP + 1.3, HALF - 0.3], [Math.PI / 2, 0, 0], [1, 1, 1]);
    k.box(0.06, 1.0, 0.06, DARK, [-1.6, TOP + 1.3, HALF - 0.25], [0, 0, 0.7]);
    k.cyl(0.32, 0.22, 0.3, 10, 0x2a2a2a, [-1.9, TOP + 0.55, 1.9]); for (const a of [0, 2.1, 4.2]) k.box(0.04, 0.45, 0.04, 0x1a1a1a, [-1.9 + Math.cos(a) * 0.2, TOP + 0.22, 1.9 + Math.sin(a) * 0.2]);
    this.root.add(k.mesh());
    // the stair hatch (a dark square, the trap door open against the parapet)
    const hk = new Kit(); hk.box(0.9, 0.02, 0.9, 0x0a0806, [-1.5, TOP + 0.065, 1.9]); hk.box(0.9, 0.06, 0.9, WOOD, [-1.5, TOP + 0.5, 2.38], [Math.PI / 2 - 0.15, 0, 0]);
    this.root.add(hk.mesh());
    // the candle on the desk and its light; the brazier's coals and glow
    this.candle = new THREE.PointLight(0xffa860, 3.2, 9, 1.6); this.candle.position.set(dx + 0.1, TOP + 1.1, dz - 0.15); this.root.add(this.candle);
    const ck = new Kit(); ck.cyl(0.025, 0.025, 0.16, 8, 0xf0e8d0, [0, 0.08, 0]); ck.cyl(0.05, 0.06, 0.02, 10, 0x8a6a3a, [0, 0.01, 0]);
    this.candleStick = ck.mesh(); this.candleStick.position.set(dx + 0.1, TOP + 0.85, dz - 0.15); this.root.add(this.candleStick);
    this.flame = glow(0xffb050, 0.12); this.flame.position.set(dx + 0.1, TOP + 1.04, dz - 0.15); this.root.add(this.flame);
    this.coals = glow(0xff6a20, 0.7, 0.8); this.coals.position.set(-1.9, TOP + 0.75, 1.9); this.root.add(this.coals);
    this.brazierLight = new THREE.PointLight(0xff7a30, 1.5, 5, 1.8); this.brazierLight.position.set(-1.9, TOP + 1, 1.9); this.root.add(this.brazierLight);
    this.smoke = makeSmoke(new THREE.Vector3(-1.9, TOP + 0.8, 1.9), { n: 6, rise: 3, size: 0.4, opacity: 0.15, color: 0x8a8a8a });
    this.root.add(this.smoke.group);
    // where people can't walk through
    this.G.world.blockers.push({ x: dx, z: dz, r: 0.75 }, { x: dx, z: dz + 1.3, r: 0.5 }, { x: tx, z: tz, r: 0.5 }, { x: -1.9, z: 1.9, r: 0.45 });
    // the pile of manuscript pages (grows through ch8_08)
    const pk = new Kit(); for (let i = 0; i < 60; i++) pk.box(0.3, 0.006, 0.4, i % 7 ? 0xece0c0 : 0xd8c8a0, [((i * 37) % 7 - 3) * 0.003, i * 0.007, ((i * 11) % 5 - 2) * 0.004], [0, ((i * 13) % 9 - 4) * 0.02, 0]);
    this.pages = pk.mesh(); this.pages.position.set(dx - 0.15, TOP + 0.85, dz + 0.55); this.root.add(this.pages);
    this.pageN = 20; this.pages.geometry.setDrawRange(0, 20 * 36);
  }

  buildTrees() {
    const k = new Kit(), r = rng(44);
    // autumn trees on the hillside and round the close: oaks and limes going gold and brown
    const COLS = [0x8a6a2a, 0x7a5a24, 0x6a6a2a, 0x9a6a2a, 0x4a5a2a];
    for (let i = 0; i < 150; i++) {
      const x = -200 + r() * 420, z = -150 + r() * 330;
      if (x > -8 && x < 116 && z > -6 && z < 60) continue;            // not in the close
      if (z < -55 && z > -150 && x > -130 && x < 60 && r() < 0.8) continue; // few in the town
      if (Math.hypot(x, z) < 12) continue;
      const y = groundHeight(x, z), s = 0.7 + r() * 0.8, c = COLS[Math.floor(r() * COLS.length)];
      k.cyl(0.15 * s, 0.25 * s, 4 * s, 6, 0x3a2a1c, [x, y + 2 * s, z]);
      k.ball(2.4 * s, 1, c, [x, y + 5 * s, z], [r(), r(), 0], [1, 0.85, 1]);
      k.ball(1.7 * s, 1, c, [x + 1.2 * s, y + 4.2 * s, z + 0.6 * s], [r(), r(), 0]);
    }
    // dark forest on the far hills to the south and east
    for (let i = 0; i < 220; i++) {
      const a = 60 + r() * 160, d = 420 + r() * 500, p = at(a, d); const y = groundHeight(p.x, p.z), h = 12 + r() * 10;
      k.cyl(0.1, 3 + r() * 2, h, 5, 0x1e2a1c, [p.x, y + h / 2, p.z]);
    }
    this.root.add(k.mesh());
  }

  buildPeople() {
    const G = this.G;
    this.people = [];
    const add = (model, pos, look = {}, role = '') => {
      const P = makePerson({ model, seed: 11 + this.people.length * 7, ...look });
      P.g.position.copy(pos); P.role = role; this.root.add(P.g); this.people.push(P); return P;
    };
    // Copernicus at his desk, and (later) his young friend Rheticus
    this.cop = add('copernicus', new THREE.Vector3(HALF - 1.5, TOP, 0.15), { tunic: 0x7a1a1a, hair: 0x2a1a10, height: 1.74 }, 'cop');
    this.cop.g.rotation.y = -Math.PI / 2; this.cop.glance = true;
    this.friend = add('rheticus', new THREE.Vector3(-1.5, TOP - 2.5, 1.9), { tunic: 0x2a3a5a, hair: 0x6a4a2a, height: 1.72 }, 'friend');
    this.friend.g.visible = false;
    this.messenger = add('townsman', new THREE.Vector3(-1.5, TOP - 2.5, 1.9), { tunic: 0x5a4a32, hair: 0x3a2a1a, height: 1.7 }, 'messenger');
    this.messenger.g.visible = false;
    // a night watchman walking the close's wall with his lantern
    const wy = 6;
    this.watch = add('townsman', new THREE.Vector3(20, wy, 0.1), { tunic: 0x4a4038, hair: 0x2a1a10, beard: true }, 'watch');
    this.watch.routine = [{ x: 60, z: 0.1, pose: 'idle', secs: 6, look: new THREE.Vector3(60, 0, -200) }, { x: 104, z: 0.1, pose: 'idle', secs: 4 }, { x: 10, z: 0.1, pose: 'idle', secs: 8, look: new THREE.Vector3(0, TOP + 1.5, 0) }];
    this.watchLamp = makeTorch({ len: 0.4, color: 0xffc070, size: 0.7 }); holdProp(this.watch, this.watchLamp, 'Right', [0, 0.02, 0.02]);
    // canons crossing the close with lanterns, to and from the cathedral
    this.walkers = [];
    for (let i = 0; i < 3; i++) {
      const P = add('canon', new THREE.Vector3(20 + i * 20, 0, 40), { tunic: 0x1a1a1e, hair: 0x6a6a6a, height: 1.72 }, 'canon');
      P.routine = [{ x: 28 - i * 2, z: 23, pose: 'idle', secs: 5 + i * 3 }, { x: 22 + i * 26, z: 42, pose: 'talk', secs: 6 + i * 2, look: new THREE.Vector3(30 + i * 20, 1.6, 44) }];
      P.ri = i; const L = makeTorch({ len: 0.35, color: 0xffc070, size: 0.6 }); holdProp(P, L, 'Right', [0, 0.02, 0.02]); P.lamp = L;
      this.walkers.push(P);
    }
    // townsfolk in the market square and a fisherman on the pier
    for (let i = 0; i < 5; i++) {
      const x = -58 + i * 4, z = -92 - (i % 2) * 6, P = add('townsman', new THREE.Vector3(x, groundHeight(x, z), z), { tunic: [0x5a4a32, 0x4a3a2a, 0x6a2a2a, 0x3a4a5a, 0x5a5a3a][i], hair: 0x3a2a1a, height: 1.6 + (i % 3) * 0.08 }, 'town');
      P.routine = [{ x: x + 6, z: z - 4, pose: i % 2 ? 'talk' : 'idle', secs: 6 + i }, { x: x - 4, z: z + 6, pose: 'work', secs: 5 }];
      this.walkers.push(P);
    }
    const f = add('townsman', new THREE.Vector3(-40, WATER + 0.8, -200), { tunic: 0x3a3a3a, hair: 0x5a4a3a, beard: true }, 'fisher');
    f.routine = [{ x: -40, z: -206, pose: 'pull', secs: 8, face: -Math.PI / 2 }, { x: -40, z: -175, pose: 'idle', secs: 6 }];
    this.walkers.push(f);
    this.G.world.blockers.push(this.copBlk = { x: this.cop.g.position.x, z: this.cop.g.position.z, r: 0.3 });
  }

  buildLife() {
    this.life = new Life(this.root);
    this.horses = this.life.add(makeHerd('horse', { n: 5, area: { x: 70, z: 85, r: 12 }, height: groundHeight, seed: 4 }));
    this.dog = this.life.add(makeHerd('dog', { n: 1, area: { x: 40, z: 40, r: 10 }, height: groundHeight, seed: 7 }));
    this.cows = this.life.add(makeHerd('cow', { n: 6, area: { x: -60, z: 120, r: 25 }, height: groundHeight, seed: 9 }));
    this.gulls = this.life.add(makeFlock({ n: 10, center: new THREE.Vector3(-30, WATER + 25, -260), r: 60, height: 10, color: 0xd8dce0, size: 1.3, seed: 6, speed: 7 }));
    this.smokes = (this.chimneys || []).slice(0, 7).map((p) => this.life.add(makeSmoke(p, { n: 6, rise: 9, size: 1.4, opacity: 0.12, color: 0x9098a8 })));
  }

  // ---------- The sky model: the planets, the Sun, the trails, the circles ----------
  buildModel() {
    const M = this.model = new THREE.Group(); M.position.copy(ORR); M.rotation.x = TILT * D2R; M.scale.setScalar(1.6); M.visible = false; this.root.add(M);
    this.bodies = BODIES.map((B) => {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(B.size, 20, 14), new THREE.MeshBasicMaterial({ color: B.col, transparent: true, fog: false }));
      const halo = glow(B.col, B.size * 7, 0.7);
      const lab = label(B.name, 0.11); lab.position.y = B.size + 0.12; lab.material.opacity = 0;
      g.add(ball, halo, lab); M.add(g);
      return { B, g, ball, halo, lab };
    });
    // the Earth gets its oceans and land, and a tiny Moon going round it
    new THREE.TextureLoader().load(new URL('../../data/earth.jpg', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; const b = this.bodies[EARTH].ball; b.material.map = t; b.material.color.setHex(0xffffff); b.material.needsUpdate = true; });
    this.moonBall = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd8dce8, fog: false }));
    this.bodies[EARTH].g.add(this.moonBall);
    // the Sun
    this.sun = new THREE.Group(); M.add(this.sun);
    this.sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe28a, fog: false }));
    this.sunGlow = glow(0xffb040, 1.4, 0.9); this.sunGlow2 = glow(0xfff0c0, 0.5, 1);
    this.sunLab = label('Sun', 0.13); this.sunLab.position.y = 0.3; this.sunLab.material.opacity = 0;
    this.sun.add(this.sunBall, this.sunGlow, this.sunGlow2, this.sunLab);
    // the trails (each planet's recent path) and the circles, as glowing dots
    this.trails = glowPoints(BODIES.length * TRAIL_N + 8, { sizeScale: 340 }); M.add(this.trails);
    const RINGS = 6 * 90 + 5 * 60 + 5 * 90 + 140 + 60;
    this.rings = glowPoints(RINGS, { sizeScale: 340 }); M.add(this.rings);
    // the band of stars round the outside (the zodiac), and Mars's path on it
    this.zodiac = glowPoints(240 + 160, { sizeScale: 340 }); M.add(this.zodiac);
    const Z = this.zodiac.userData, zr = rng(77);
    for (let i = 0; i < 240; i++) { const a = zr() * Math.PI * 2, rr = ZODIAC_R + (zr() - 0.5) * 0.18; Z.pos.set([Math.cos(a) * rr, (zr() - 0.5) * 0.25, -Math.sin(a) * rr], i * 3); const b = 0.3 + zr() * 0.7; Z.col.set([b * 0.8, b * 0.85, b], i * 3); Z.size[i] = 0.004 + zr() * zr() * 0.012; }
    this.zBase = Z.col.slice(0, 240 * 3);
    this.marsHits = [];
    // a faint glassy disc under it all, so it reads as one object floating there
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(ZODIAC_R + 0.15, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a5a9a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.disc.position.y = -0.02; M.add(this.disc);
    // the Sun you can grab (ch8_04): it floats out to your hand, then you send it into the middle
    this.handSun = new THREE.Group(); this.handSun.visible = false; this.root.add(this.handSun);
    this.handSun.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe28a, fog: false })), glow(0xffb040, 0.6, 0.9));
    // ch8_07: a big Earth, spinning on its axis
    this.bigEarth = new THREE.Group(); this.bigEarth.visible = false; this.bigEarth.position.copy(ORR); this.root.add(this.bigEarth);
    const eb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 32), new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true, opacity: 0, fog: false }));
    new THREE.TextureLoader().load(new URL('../../data/earth.jpg', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; eb.material.map = t; eb.material.needsUpdate = true; });
    this.bigEarthBall = eb; this.bigEarthTilt = new THREE.Group(); this.bigEarthTilt.rotation.z = -23.4 * D2R; this.bigEarthTilt.add(eb); this.bigEarth.add(this.bigEarthTilt);
    const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.6, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, fog: false })); this.bigEarthTilt.add(axis); this.axis = axis;
    this.bigEarthLight = new THREE.DirectionalLight(0xfff4e0, 0); this.bigEarthLight.position.set(ORR.x + 5, ORR.y + 2, ORR.z + 4); this.bigEarthLight.target = this.bigEarth; this.root.add(this.bigEarthLight);
  }

  // The book (ch8_09-10): De revolutionibus, printed in Nuremberg, and its diagram of the circles
  buildBook() {
    const k = new Kit();
    k.box(0.24, 0.05, 0.32, 0x6a3a1e, [0, 0, 0]); k.box(0.22, 0.045, 0.31, 0xece0c0, [0.008, 0, 0]);
    this.book = k.mesh(); this.book.visible = false; this.root.add(this.book);
    this.bookGlow = glow(0xffd890, 0.7, 0); this.book.add(this.bookGlow);
    // the diagram: Sol in the middle, the planets' circles round it, the stars outside, all labelled
    const tex = canvasTex(1024, 1024, (g, w) => {
      const c = w / 2; g.strokeStyle = '#ffe2a8'; g.fillStyle = '#ffe2a8'; g.lineWidth = 5; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,190,90,0.9)'; g.shadowBlur = 14;
      const names = ['Mercurius', 'Venus', 'Tellus', 'Mars', 'Iupiter', 'Saturnus', 'Stellarum fixarum sphaera'];
      names.forEach((n, i) => { const R = 90 + i * 60; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.stroke(); g.font = `italic ${i === 6 ? 26 : 30}px Georgia, serif`; g.fillText(n, c, c - R - 2 + 24); });
      g.beginPath(); g.arc(c, c, 34, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3a2a10'; g.font = 'bold 30px Georgia, serif'; g.fillText('Sol', c, c + 2);
    });
    this.diagram = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.diagram.visible = false; this.root.add(this.diagram);
    // ch8_09: Copernicus's light rising away as sparks
    this.sparks = glowPoints(60, { sizeScale: 260 }); this.sparks.visible = false; this.root.add(this.sparks);
    this.sp = Array.from({ length: 60 }, () => ({ a: Math.random() * 6.28, y: Math.random() * 2, r: 0.2 + Math.random() * 0.4, v: 0.3 + Math.random() * 0.7 }));
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.sunIt = {
      hint: 'Grab the Sun with GRIP and push it into the middle', deskHint: 'Click the Sun to put it in the middle',
      get disabled() { return self.s.sunHand !== 1; },
      reach(pos) { self.handSun.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.15); },
      aim(o, d) { self.handSun.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.2 ? t : Infinity; },
      onGrab() { G.act({ type: 'sun' }); }, onTouch() { G.act({ type: 'sun' }); },
    };
    G.interactables.push(this.sunIt);
  }

  act(a) {
    if (a.type === 'sun' && this.s.sunHand === 1) { this.s.sunHand = 2; this.G.events.emit('sfx', { k: 'swell' }); return true; }
    return this.journal.act(a);
  }
  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    G.events.emit('placePlayers', { x: this.start.pos.x, z: this.start.pos.z, yaw: this.start.yaw });
    await G.ui.fadeIn(3);
    // Aristarchus's question (his echo appears on the tower: js/wow/ch8.js)
    s.guide = at(345, 30, TOP + 9).toArray();
    await D.say('ch8_01');
    // Copernicus, by day a busy canon; at night, the planets
    s.guide = [HALF - 1.4, TOP + 2.3, -0.9];
    const l2 = D.sayAsync('ch8_02');
    await D.cue("That's Nicolaus"); s.cop = 'look';
    await D.cue('But at night'); s.cop = 'sight';
    await l2;
    // Ptolemy's sky, floating over the lagoon: circles on circles on circles
    s.guide = [ORR.x + 4.2, ORR.y + 1.2, ORR.z + 2]; s.phase = 'model'; s.cop = 'look'; s.model = 1; s.k = 1;
    const l3 = D.sayAsync('ch8_03');
    await D.cue('spinning circles'); s.epi = 1;
    await D.cue('Circles on circles'); s.epi = 2;
    await l3;
    // Take the Sun... and put it in the middle
    s.phase = 'sun'; s.cop = 'talk';
    const l4 = D.sayAsync('ch8_04');
    await D.cue('Take the Sun'); s.sunHand = 1;
    await l4;
    D.hint(G.mode === 'desktop' ? this.sunIt.deskHint : this.sunIt.hint, 9);
    await D.auto(() => s.sunHand >= 2, () => { s.sunHand = 2; }, { after: fast ? 0.3 : 1.5, timeout: fast ? 2 : 25 });
    if (s.sunHand < 2) s.sunHand = 2;
    G.ui.showHint('');
    await D.until(() => s.sunHand >= 3, fast ? 3 : 8);
    s.sunHand = 3;
    await D.until(() => s.k < 0.02, fast ? 3 : 10);
    // Each planet in its own circle, round the Sun
    s.phase = 'planets'; s.cop = 'point';
    const l5 = D.sayAsync('ch8_05');
    for (const [w, n] of [['Mercury', 1], ['Venus', 2], ['Earth', 3], ['Mars', 4], ['Jupiter', 5], ['Saturn', 6]]) { await D.cue(w); s.names = n; }
    await l5;
    // Mars from the Earth: overtaking on the inside lane
    s.phase = 'mars'; s.mars = 1; this.marsHits.length = 0;
    await D.say('ch8_06');
    await D.until(() => this.passDone, fast ? 2 : 14);
    // The Earth spins; the whole sky turns
    s.phase = 'spin'; s.mars = 0; s.names = 0;
    const l7 = D.sayAsync('ch8_07');
    await D.cue('Because the Earth'); s.spin = 1; s.model = 0;
    await l7;
    await D.until(() => this.spinDone, fast ? 2 : 14);
    s.spin = 0;
    // Thirty years of quiet work (and a few friends)
    s.phase = 'years'; s.cop = 'desk'; s.guide = null;
    const l8 = D.sayAsync('ch8_08');
    s.years = 1;
    await D.cue('a few friends'); s.friend = 1;
    await l8;
    // 1543: the book arrives
    s.phase = 'book'; s.book = 1;
    const l9 = D.sayAsync('ch8_09');
    await D.until(() => this.bookDelivered, fast ? 2 : 12);
    s.book = 2;
    await D.cue('on the day he died'); s.book = 3;
    await l9;
    // The revolution begins: the drawing rises into the sky
    s.phase = 'diagram'; s.diagram = 1;
    s.guide = [3.5, TOP + 3, -6];
    await D.say('ch8_10');
    await D.wait(fast ? 0.5 : 3);
    s.diagram = 0; s.guide = null;
    s.phase = 'journal';
    await this.journal.present(D);
    s.phase = 'done';
  }

  // ---------- Every frame ----------
  update(dt, t) {
    const G = this.G, s = this.s;
    this.t += dt;
    // the sky: night over the Baltic; ch8_07 turns it quickly through the hours
    if (s.spin && this.spinT >= 3) s.hour = 20.5 + Math.min(1, (this.spinT - 3) / 9) * 7 - Math.max(0, (this.spinT - 12)) * 2.4;
    else if (!s.spin) s.hour = damp(s.hour, 20.5 + this.t / 600, 1, dt);
    s.hour = Math.max(20.5, s.hour);
    const sun = sunAt(LAT, SUNLON, s.hour);
    G.sky.set(sun.az, sun.el);
    // a thin crescent Moon low in the west-south-west, setting over the water
    const mAz = 248 + (s.hour - 20.5) * 9, mEl = 13 - (s.hour - 20.5) * 6;
    G.sky.setMoon(mAz, mEl, 1, 0.16);
    this.moonLight ||= (() => { const L = new THREE.DirectionalLight(0xa8b8e8, 0.55); this.root.add(L, L.target); return L; })();
    this.moonLight.position.copy(at(mAz, 200, 60)); this.moonLight.intensity = 0.55 * clamp01((mEl + 2) / 8);
    // the glitter path runs across the lagoon toward the Moon
    G.camera.getWorldPosition(_a);
    const gl = this.glitter; gl.position.x = _a.x; gl.position.z = _a.z; gl.rotation.z = -mAz * D2R + Math.PI; gl.scale.set(60, 2600, 1);
    gl.material.opacity = 0.5 * clamp01((mEl + 1) / 6); this.glitTex.offset.y = -t * 0.02;
    for (const b of this.boats) { b.position.y = WATER + 0.25 + Math.sin(t * 0.8 + b.userData.ph) * 0.06; b.rotation.z = Math.sin(t * 0.6 + b.userData.ph) * 0.03; }
    // fire and candle
    const fl = 0.8 + 0.2 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1);
    this.candle.intensity = 3 * fl * (s.book === 3 ? 0.5 : 1); this.flame.scale.set(0.1 + 0.02 * fl, 0.16 * fl, 1);
    this.brazierLight.intensity = 1.2 + 0.5 * fl; this.coals.material.opacity = 0.6 + 0.3 * fl;
    this.smoke.update(dt, t);
    // pages pile up over the years
    if (s.years) this.pageN = Math.min(60, this.pageN + dt * 3);
    this.pages.geometry.setDrawRange(0, Math.floor(this.pageN) * 36);
    this.life.update(dt, t);
    this.sounds(dt);
    this.updatePeople(dt, t);
    this.updateModel(dt, t);
    this.updateBook(dt, t);
    const busy = this.journal.update();
    if (!busy && s.sunHand === 1 && this.handSet) { if (!this.guideAtSun) { this.guideAtSun = true; G.guide.flyTo(this.handSun.position.clone().add(_d.set(0.35, 0.25, 0))); } }
    else { if (this.guideAtSun) { this.guideAtSun = false; this.guideAt = null; G.guide.follow(); } guideUpdate(this, busy); }
  }

  sounds(dt) {
    const G = this.G, A = G.audio; if (!A.ctx) return;
    // the cathedral bell tolls the hour now and then; an owl in the trees; gulls over the water
    if ((this.bellT -= dt) <= 0) { this.bellT = 70 + Math.random() * 40; for (let i = 0; i < 3; i++) setTimeout(() => A.bell(_b.set(64, 30, 23), 0.5), i * 2600); }
    if ((this.owlT -= dt) <= 0) { this.owlT = 30 + Math.random() * 30; const o = A.out(at(120 + Math.random() * 100, 60, -5), 0.25, 10); A.tone(o, { f: 380, f2: 340, peak: 0.25, a: 0.05, d: 0.5 }); A.tone(o, { f: 360, f2: 320, peak: 0.2, a: 0.1, d: 0.9, t0: 0.7 }); }
    if ((this.gullT -= dt) <= 0) { this.gullT = 9 + Math.random() * 14; const p = this.gulls.group?.children?.[0]?.position || at(350, 200, -10); const o = A.out(_b.set(-30 + (Math.random() - 0.5) * 80, WATER + 20, -240), 0.2, 30); A.tone(o, { type: 'triangle', f: 1400, f2: 900, peak: 0.12, a: 0.02, d: 0.35 }); A.tone(o, { type: 'triangle', f: 1300, f2: 850, peak: 0.1, a: 0.02, d: 0.3, t0: 0.4 }); }
  }

  updatePeople(dt, t) {
    const G = this.G, s = this.s, C = this.cop;
    // Copernicus: at his desk writing, looking up, at the triquetrum, or talking with you
    const deskSpot = [HALF - 1.5, 0.15], sightSpot = [-HALF + 1.6, -0.6];
    const want = s.cop === 'sight' ? sightSpot : s.book >= 1 && s.book < 3 ? [0.8, 0.9] : deskSpot;
    const arrived = walkToward(C, want[0], want[1], dt, { speed: 0.9, height: () => TOP });
    this.copBlk.x = C.g.position.x; this.copBlk.z = C.g.position.z;
    if (arrived) {
      C.look = null;
      if (s.cop === 'sight') { C.g.rotation.y = damp(C.g.rotation.y, Math.PI * 0.75, 3, dt); C.pose = 'point'; C.pointAt.set(-20, TOP + 30, -30); C.look = _a.set(-30, TOP + 30, -40).clone(); }
      else if (s.book === 1) { C.pose = 'idle'; C.look = this.messenger.g.position.clone().setY(TOP + 1.5); }
      else if (s.book === 2) { C.pose = 'hold'; C.look = this.book.position.clone(); }
      else if (s.phase === 'model' || s.phase === 'sun' || s.phase === 'planets' || s.phase === 'mars') { C.g.rotation.y = damp(C.g.rotation.y, Math.PI, 2, dt); C.pose = s.cop === 'point' ? 'point' : s.cop === 'talk' ? 'talk' : 'idle'; C.pointAt.copy(ORR); C.look = ORR.clone(); }
      else if (s.phase === 'spin') { C.pose = 'idle'; C.look = _a.set(C.g.position.x, TOP + 30, C.g.position.z - 20).clone(); }
      else if (s.cop === 'look') { C.pose = 'idle'; C.look = null; }
      else { C.g.rotation.y = damp(C.g.rotation.y, -Math.PI / 2, 3, dt); C.pose = s.friend && this.friendHere ? 'talk' : 'write'; }
    }
    C.glance = s.phase === 'arrive' || s.cop === 'look';
    // ch8_09: he holds the book, then his light rises away as sparks
    this.copFade = damp(this.copFade ?? 1, s.book === 3 ? 0 : 1, 0.6, dt);
    C.g.visible = this.copFade > 0.03;
    if (this.copFade < 0.999) C.g.traverse((o) => { if (o.isMesh) { if (!o.userData.fadeMat) { o.material = o.material.clone(); o.material.transparent = true; o.userData.fadeMat = true; } o.material.opacity = this.copFade; } });
    animatePerson(C, t, dt);
    // Rheticus: up the stairs, to the desk, talking over the work
    const F = this.friend;
    if (s.friend) {
      F.g.visible = true;
      if (F.g.position.y < TOP) { F.g.position.y = Math.min(TOP, F.g.position.y + dt * 1.2); F.pose = 'walk'; F.stride = (F.stride || 0) + dt * 5; }
      else if (walkToward(F, 0.6, 0.6, dt, { speed: 0.8, height: () => TOP })) { this.friendHere = true; F.pose = s.book ? 'idle' : 'talk'; F.look = C.g.position.clone().setY(TOP + 1.6); F.g.rotation.y = damp(F.g.rotation.y, Math.atan2(C.g.position.x - F.g.position.x, C.g.position.z - F.g.position.z), 3, dt); }
      if (s.book === 3) { F.pose = 'idle'; F.look = this.book.position.clone(); }
      animatePerson(F, t, dt);
    }
    // the messenger with the printed book
    const Ms = this.messenger;
    if (s.book === 1 && !this.bookDelivered) {
      Ms.g.visible = true;
      if (!this.msgBook) { this.msgBook = true; this.book.visible = true; holdProp(Ms, this.book, 'Right', [0, 0.06, 0.05]); }
      if (Ms.g.position.y < TOP) { Ms.g.position.y = Math.min(TOP, Ms.g.position.y + dt * 1.2); Ms.pose = 'walk'; Ms.stride = (Ms.stride || 0) + dt * 5; }
      else if (walkToward(Ms, 0.1, 0.9, dt, { speed: 0.9, height: () => TOP })) { Ms.pose = 'hold'; Ms.look = C.g.position.clone().setY(TOP + 1.6); this.holdT = (this.holdT || 0) + dt; if (this.holdT > 1.5) this.bookDelivered = true; }
    }
    if (this.bookDelivered && !this.bookPassed) { this.bookPassed = true; dropProp(Ms, 'Right'); holdProp(C, this.book, 'Right', [0, 0.06, 0.05]); }
    if (this.bookDelivered) { walkToward(Ms, -1.5, 1.9, dt, { speed: 0.9, height: () => TOP }); if (Math.hypot(Ms.g.position.x + 1.5, Ms.g.position.z - 1.9) < 0.3) { Ms.g.position.y -= dt * 1.2; if (Ms.g.position.y < TOP - 2.5) Ms.g.visible = false; } }
    if (Ms.g.visible) animatePerson(Ms, t, dt);
    if (s.book === 3 && this.bookPassed && !this.bookOnDesk && this.copFade < 0.5) { this.bookOnDesk = true; dropProp(C, 'Right'); this.root.add(this.book); this.book.position.set(HALF - 0.9, TOP + 0.9, 0.0); this.book.rotation.set(0, 0.2, 0); this.book.scale.setScalar(1); }
    // the town and the close
    runRoutine(this.watch, dt, { height: () => 6, speed: 0.8 }); animatePerson(this.watch, t, dt); this.watchLamp.userData.flicker(t);
    for (const P of this.walkers) { runRoutine(P, dt, { height: groundHeight, speed: 0.9 }); animatePerson(P, t, dt); P.lamp?.userData.flicker(t); }
  }

  updateModel(dt, t) {
    const G = this.G, s = this.s, M = this.model, fast = G.params.has('fast') ? 3 : 1;
    this.modelV = damp(this.modelV || 0, s.model ? 1 : 0, 1.2, dt);
    M.visible = this.modelV > 0.01;
    // the Sun flying from your hand into the middle
    if (s.sunHand === 1) {
      if (!this.handSet) { this.handSet = true; G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize(); this.handSun.position.copy(_a).addScaledVector(_b, 0.5).add(_c.set(0, -0.25, 0)); this.sunFrom = null; }
      this.handSun.visible = true; this.handSun.position.y += Math.sin(t * 2) * 0.0006;
      this.handSun.scale.setScalar(1 + 0.08 * Math.sin(t * 4));
    }
    if (s.sunHand === 2) {
      if (!this.sunFrom) { this.sunFrom = this.handSun.position.clone(); this.sunFly = 0; }
      this.sunFly += dt / 2.2 * fast;
      M.localToWorld(_a.set(0, 0, 0));
      this.handSun.position.lerpVectors(this.sunFrom, _a, ease(this.sunFly)); this.handSun.position.y += Math.sin(Math.PI * Math.min(1, this.sunFly)) * 0.8;
      if (this.sunFly >= 1) { this.handSun.visible = false; if (G.isHost) s.sunHand = 3; this.G.audio.ctx && this.G.audio.chime(this.handSun.position, 0.5); }
    }
    if (s.sunHand >= 3) this.handSun.visible = false;
    // seen from the Earth (k = 1) or from the Sun (k = 0): once the Sun is in, the view slides over
    if (s.sunHand >= 3 && G.isHost) s.k = Math.max(0, s.k - dt / 6 * fast);
    if (!M.visible) return;
    // model time: brisk while the loops are on show, slow for Mars, held still while the Earth spins
    const rate = s.phase === 'mars' ? this.marsRate(dt) : s.sunHand === 1 || s.sunHand === 2 ? 0.08 : 0.35;
    this.tm += dt * rate * fast;
    const k = s.k, E = helio(EARTH, this.tm, _d).clone();
    const pos = (i, tt, out) => { helio(i, tt, out); const e = helio(EARTH, tt, _c); return out.addScaledVector(e, -k); };
    // bodies
    const show = this.modelV;
    this.bodies.forEach((b, i) => {
      pos(i, this.tm, b.g.position);
      const dim = s.phase === 'mars' && i !== EARTH && i !== MARS ? 0.25 : 1;
      b.ball.material.opacity = show * dim; b.halo.material.opacity = 0.7 * show * dim;
      const named = s.names > i;
      b.lab.material.opacity = damp(b.lab.material.opacity, named ? show : 0, 3, dt);
    });
    this.sun.position.copy(E).multiplyScalar(-k);
    this.sun.visible = s.sunHand >= 3 || k > 0.99;
    this.sunBall.scale.setScalar(s.sunHand >= 3 ? 1 : 0.7);
    this.sunGlow.material.opacity = 0.9 * show; this.sunGlow.scale.setScalar(1.4 + 0.1 * Math.sin(t * 3));
    this.sunLab.material.opacity = damp(this.sunLab.material.opacity, s.phase === 'planets' && s.names === 0 ? show : 0, 3, dt);
    const mp = this.tm / 0.0748 * Math.PI * 2; this.moonBall.position.set(Math.cos(mp) * 0.11, 0, -Math.sin(mp) * 0.11);
    this.disc.material.opacity = 0.06 * show;
    // trails: each body's recent path, fading toward its tail
    const T = this.trails.userData;
    BODIES.forEach((B, i) => {
      const len = B.trail * (0.35 + 0.65 * k), c = new THREE.Color(B.col);
      for (let j = 0; j < TRAIL_N; j++) {
        const f = j / TRAIL_N, tt = this.tm - f * len;
        pos(i, tt, _a);
        const o = (i * TRAIL_N + j) * 3, a = (1 - f) * show * (s.phase === 'mars' && i !== MARS && i !== EARTH ? 0.15 : 0.75);
        T.pos.set([_a.x, _a.y, _a.z], o); T.col.set([c.r * a, c.g * a, c.b * a], o); T.size[i * TRAIL_N + j] = 0.022;
      }
    });
    // the Sun's own trail while it's still going round the Earth
    for (let j = 0; j < 8; j++) { const o = (BODIES.length * TRAIL_N + j) * 3; helio(EARTH, this.tm - j * 0.03, _a).multiplyScalar(-k); T.pos.set([_a.x, _a.y, _a.z], o); const a = k * show * (1 - j / 8) * 0.8; T.col.set([a, a * 0.8, a * 0.4], o); T.size[BODIES.length * TRAIL_N + j] = 0.05; }
    T.commit();
    // circles: the planets' orbits (bright once the Sun is in the middle); Ptolemy's big circles
    // (deferents) and the small circles riding on them (epicycles) while seen from the Earth
    const R = this.rings.userData; let n = 0;
    const epiOn = Math.min(1, s.epi) * k * show, orbOn = (1 - k) * show;
    const dot = (x, y, z, r, g, b, sz) => { R.pos.set([x, y, z], n * 3); R.col.set([r, g, b], n * 3); R.size[n] = sz; n++; };
    BODIES.forEach((B, i) => { const c = new THREE.Color(B.col); for (let j = 0; j < 90; j++) { const a = j / 90 * Math.PI * 2; dot(Math.cos(a) * B.r, 0, -Math.sin(a) * B.r, c.r * orbOn * 0.35, c.g * orbOn * 0.35, c.b * orbOn * 0.35, 0.012); } });
    const epiK = s.epi >= 2 ? 1 : 0.45;
    BODIES.forEach((B, i) => {
      if (i === EARTH) return;
      const inner = B.r < BODIES[EARTH].r;
      // outer planet: deferent radius r_p round the Earth, epicycle radius r_e round the deferent point
      // inner planet: deferent = the Sun's circle (r_e), epicycle radius r_p round the Sun
      const defR = inner ? BODIES[EARTH].r : B.r, epiR = inner ? B.r : BODIES[EARTH].r;
      const c = new THREE.Color(B.col);
      helio(inner ? EARTH : i, this.tm, _a); if (inner) _a.multiplyScalar(-1);
      for (let j = 0; j < 90; j++) { const a = j / 90 * Math.PI * 2; const v = epiOn * 0.28; dot(Math.cos(a) * defR, 0, -Math.sin(a) * defR, c.r * v, c.g * v, c.b * v, 0.01); }
      for (let j = 0; j < 60; j++) { const a = j / 60 * Math.PI * 2; const v = epiOn * epiK * 0.7; dot(_a.x + Math.cos(a) * epiR, 0, _a.z - Math.sin(a) * epiR, c.r * v, c.g * v, c.b * v, 0.014); }
    });
    // ch8_06: the sight line from the Earth through Mars, out to the stars; where it lands, a red mark
    const mOn = this.marsV = damp(this.marsV || 0, s.mars ? 1 : 0, 2, dt);
    const e = this.bodies[EARTH].g.position, m = this.bodies[MARS].g.position;
    _b.subVectors(m, e).normalize();
    // where the line meets the star band (a circle of radius ZODIAC_R round the Sun)
    const bq = e.dot(_b), cq = e.lengthSq() - ZODIAC_R * ZODIAC_R, tHit = -bq + Math.sqrt(Math.max(0, bq * bq - cq));
    _c.copy(e).addScaledVector(_b, tHit);
    for (let j = 0; j < 140; j++) { const f = j / 139; _a.copy(e).addScaledVector(_b, f * tHit); const v = mOn * 0.55 * (0.4 + 0.6 * ((j + Math.floor(t * 12)) % 4 === 0 ? 1 : 0.3)); dot(_a.x, _a.y, _a.z, v, v * 0.45, v * 0.3, 0.012); }
    if (mOn > 0.5 && (this.lastHit == null || this.lastHit.distanceTo(_c) > 0.025)) { this.lastHit = _c.clone(); this.marsHits.push(_c.clone()); if (this.marsHits.length > 60) this.marsHits.shift(); }
    for (let j = 0; j < 60; j++) { const h = this.marsHits[j]; if (h) dot(h.x, h.y + 0.02, h.z, mOn, mOn * 0.35, mOn * 0.2, 0.03 + 0.02 * (j === this.marsHits.length - 1)); else dot(0, 0, 0, 0, 0, 0, 0); }
    while (n < R.size.length) dot(0, 0, 0, 0, 0, 0, 0);
    R.commit();
    // the stars of the band, brighter while we watch Mars against them
    const Z = this.zodiac.userData; for (let i = 0; i < 240 * 3; i++) Z.col[i] = this.zBase[i] * show * (0.4 + 0.6 * mOn); Z.commit();
    // the big spinning Earth (ch8_07)
    this.spinV = damp(this.spinV || 0, s.spin ? 1 : 0, 1.5, dt);
    if (s.spin) { this.spinT = (this.spinT || 0) + dt * fast; if (this.spinT > 15) this.spinDone = true; }
    this.bigEarth.visible = this.spinV > 0.01;
    const fadeE = this.spinV * clamp01(1 - ((this.spinT || 0) - 4) / 2);
    this.bigEarthBall.material.opacity = fadeE; this.axis.material.opacity = fadeE * 0.9; this.bigEarthLight.intensity = fadeE * 2.5;
    this.bigEarthBall.rotation.y += dt * 1.6;
  }

  // Mars time: slow while Earth catches up and passes it (the loop), so you can watch it
  marsRate(dt) {
    const e = helio(EARTH, this.tm, _a).clone(), m = helio(MARS, this.tm, _b);
    const ang = Math.abs(Math.atan2(e.x * m.z - e.z * m.x, e.x * m.x + e.z * m.z));   // angle between them, seen from the Sun
    if (ang < 0.25) this.passing = true;
    if (this.passing && ang > 0.9) this.passDone = true;
    return ang < 1.2 ? 0.06 + 0.12 * ang : 0.35;
  }

  updateBook(dt, t) {
    const s = this.s, G = this.G;
    this.bookGlow.material.opacity = damp(this.bookGlow.material.opacity, s.book >= 2 ? 0.8 + 0.2 * Math.sin(t * 2) : 0, 2, dt);
    // Copernicus's light, rising away
    const rising = s.book === 3 && this.copFade > 0.02 && this.copFade < 0.98;
    this.sparks.visible = rising || (this.sparkT || 0) > 0;
    if (rising) this.sparkT = 3;
    if (this.sparks.visible) {
      this.sparkT -= dt; const S = this.sparks.userData, c = this.cop.g.position;
      this.sp.forEach((q, i) => {
        q.a += dt * q.v * 1.5; q.y += dt * q.v * 0.8; if (q.y > 6) q.y = 0;
        S.pos.set([c.x + Math.cos(q.a) * q.r * (1 + q.y * 0.2), c.y + q.y, c.z + Math.sin(q.a) * q.r * (1 + q.y * 0.2)], i * 3);
        const v = Math.max(0, Math.min(1, this.sparkT / 3)) * (1 - q.y / 6); S.col.set([v, v * 0.85, v * 0.5], i * 3); S.size[i] = 0.03;
      });
      S.commit();
    }
    // the diagram: lifts off the book, grows, and rises out over the lagoon into the stars
    this.diagV = damp(this.diagV || 0, s.diagram ? 1 : 0, s.diagram ? 0.5 : 1.2, dt);
    if (s.diagram) this.diagT = (this.diagT || 0) + dt * (G.params.has('fast') ? 3 : 1);
    const D = this.diagram; D.visible = this.diagV > 0.01;
    if (D.visible) {
      const k = ease(Math.min(1, (this.diagT || 0) / 14));
      this.book.getWorldPosition(_a); _b.copy(at(350, 60, TOP + 38));
      D.position.lerpVectors(_a.setY(_a.y + 0.3), _b, k); D.scale.setScalar(0.4 + k * 60);
      G.camera.getWorldPosition(_c); D.lookAt(_c);
      D.material.opacity = this.diagV * (0.9 - 0.3 * k);
    }
  }

  dispose() {
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.sky.hideMoon();
  }
}

// The journal page: the Sun in the middle with the planets' circles, and Mars's backward loop
// explained as the Earth overtaking it
function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
  g.fillText('Copernicus, 1543: the Sun in the middle', 40, 70);
  const cx = 270, cy = 380;
  g.strokeStyle = INK; g.lineWidth = 2;
  [40, 70, 100, 140, 190, 235].forEach((r) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); });
  g.fillStyle = '#e0952a'; g.beginPath(); g.arc(cx, cy, 18, 0, Math.PI * 2); g.fill();
  const dots = [[40, 1.2, '#8a7a6a'], [70, 3, '#d8c890'], [100, 0.6, '#3a6aaa'], [140, 0.4, '#b5431d'], [190, 2.3, '#a08a6a'], [235, 4.4, '#b09a60']];
  for (const [r, a, c] of dots) { g.fillStyle = c; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy - Math.sin(a) * r, 8, 0, Math.PI * 2); g.fill(); }
  // Earth overtaking Mars: lines of sight, and the backward loop on the stars
  const ox = 640, oy = 560;
  g.fillStyle = INK; g.font = 'italic 28px Georgia, serif';
  g.fillText('Earth (inside lane) passes Mars:', 560, 150);
  g.strokeStyle = 'rgba(58,42,24,0.5)'; g.setLineDash([6, 6]);
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const ex = ox + (i - 3) * 50, mx = ox + (i - 3) * 30, ex2 = mx + (mx - ex) * 3.6;
    g.beginPath(); g.moveTo(ex, oy); g.lineTo(ex2, 230); g.stroke(); pts.push(ex2);
    g.fillStyle = '#3a6aaa'; g.beginPath(); g.arc(ex, oy, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b5431d'; g.beginPath(); g.arc(mx, 440, 6, 0, Math.PI * 2); g.fill();
  }
  g.setLineDash([]);
  g.strokeStyle = '#b5431d'; g.lineWidth = 4; g.beginPath();
  pts.forEach((x, i) => g.lineTo(x, 230 - Math.sin(i / 6 * Math.PI) * 30)); g.stroke();
  g.fillStyle = INK; g.font = 'italic 30px Georgia, serif';
  g.fillText('Mars seems to go backward. No little circles needed.', 40, h - 40);
}
