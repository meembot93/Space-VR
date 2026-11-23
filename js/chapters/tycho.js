// Era 2, Chapter 2 (n 9): Tycho's new star. Two places.
//
// 1. Herrevad Abbey, Denmark (now Sweden), the evening of 11 November 1572. Frosty fields, bare
//    trees, the old brick abbey where Tycho has his laboratory. He walks home along the lane, looks
//    up... and there's a new star in Cassiopeia, brighter than any other. He calls the farm folk over
//    to check he isn't dreaming. A floating model shows why it matters: seen from two places, the
//    Moon shifts against the stars, the new star doesn't, so it's far out among the stars. Then
//    (wow) the star blooms into what it really was: an exploding star, a shell of glowing gas.
// 2. Uraniborg on the island of Hven, about 1590: Tycho's "castle for the sky", with its domes and
//    towers, the square walled garden, the sea all round. You stand by his great mural quadrant (a
//    brass quarter circle on a wall, with Tycho painted inside it). Helpers sight stars and call out
//    times; his elk wanders the garden; twenty years of nights fly by as measurements pile up on a
//    giant star chart, and the Great Comet of 1577 smashes through a crystal sphere. At the end the
//    measurements of Mars glow red, and an echo of Kepler (next chapter) looks them over.
// World axes: -Z north, +X east, +Y up.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, walkToward, holdProp } from '../people.js';
import { makeHerd, makeFlock, makeSmoke, makeTorch, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { glowPoints, textSprite, shatter, rumble, whoosh, awe, shimmer } from '../wow/fx.js';
import { Echo } from '../wow/echo.js';
import { D2R, ease, clamp01, at, sunAt, house, windows, gableRoof, glow, label, Journal, INK, guideUpdate } from '../era2/common.js';

const N1 = noise2(91), N2 = noise2(93);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const SEA = -26;
const CASTLE = new THREE.Vector3(0, 0, -34);   // Uraniborg's middle
const QUAD = new THREE.Vector3(-2.6, 0, -1.2); // the mural quadrant's corner (its arc faces east)

// ---------- the ground in each place ----------
function fieldsHeight(x, z) {
  return (N1(x / 120, z / 120) - 0.5) * 6 * clamp((Math.hypot(x, z) - 30) / 80, 0, 1) + (N2(x / 8, z / 8) - 0.5) * 0.25;
}
function hvenHeight(x, z) {
  const r = Math.hypot(x, z * 1.25), edge = 260 + Math.sin(Math.atan2(z, x) * 5) * 25;
  let h = (N1(x / 90, z / 90) - 0.5) * 3 * clamp((r - 60) / 60, 0, 1) + (N2(x / 7, z / 7) - 0.5) * 0.18;
  if (r > edge) h = lerp(h, SEA - 4, clamp((r - edge) / 18, 0, 1));
  return h;
}

export default class Tycho {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.A = new THREE.Group(); this.B = new THREE.Group(); this.B.visible = false; this.root.add(this.A, this.B);
    this.start = { pos: new THREE.Vector3(0, 0, 1.2), yaw: -0.5 };
    this.s = {
      scene: 'abbey', phase: 'arrive', guide: null, hour: 18.2,
      nova: 0,        // the new star's brightness (0..1)
      folk: 0,        // the farm folk come to look
      cas: 0,         // Cassiopeia's outline and name
      parallax: 0,    // 1 = the floating Moon-and-star model
      boom: 0,        // 1 = the star blooms into an explosion
      sight: 0,       // ch9_07: 1 = slide the sight up to the star, 2 = lined up
      years: 0,       // ch9_09: twenty years of nights
      comet: 0,
      mars: 0,        // ch9_10: Mars's measurements glow red
      journal: 0,
    };
    this.t = 0;
    this.setScene('abbey');
    this.buildAbbey();
    this.buildHven();
    this.buildPeople();
    this.buildNova();
    this.buildParallax();
    this.buildChart();
    this.buildComet();
    this.journal = new Journal(this, drawJournal);
    this.registerInteractables();
  }

  setScene(name) {
    const G = this.G; this.cur = name;
    this.A.visible = name === 'abbey'; this.B.visible = name === 'hven';
    if (name === 'abbey') {
      G.world.height = fieldsHeight; G.world.bounds = 6; G.world.blockers = [];
      G.sky.fogFar = 1800; G.sky.mist = 0.1;
      G.sky.setPlace({ lat: 56.0, year: 1572, sunLon: 229 });
      this.lat = 56.0;
    } else {
      G.world.height = hvenHeight; G.world.bounds = 4.5; G.world.blockers = [{ x: QUAD.x - 0.2, z: QUAD.z, r: 0.6 }];
      G.sky.fogFar = 3000; G.sky.mist = 0;
      G.sky.setPlace({ lat: 55.9, year: 1590, sunLon: 200 });
      this.lat = 55.9;
    }
    G.sky.hideMoon();
  }

  // ---------- 1. Herrevad: frosty fields, bare trees, the abbey ----------
  buildAbbey() {
    const k = new Kit(), r = rng(3), A = this.A;
    // ground: frost-silvered grass, dark ploughed strips, the lane
    const SIZE = 2000, SEG = 150, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const frost = new THREE.Color(0x8a948e), grass = new THREE.Color(0x4a5440), plough = new THREE.Color(0x3e342a), lane = new THREE.Color(0x6a6052);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.7) * (SIZE / 2) / r0 : 0; x *= kk; z *= kk;
      p.setXYZ(i, x, fieldsHeight(x, z), z);
      c.copy(grass).lerp(frost, 0.35 + 0.4 * N2(x / 14, z / 14));
      if (Math.sin(x / 9) > 0.55 && z < -40) c.lerp(plough, 0.7);
      if (Math.abs(z - 4 + Math.sin(x / 30) * 3) < 1.6 && x > -10) c.lerp(lane, 0.8);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); A.add(new THREE.Mesh(g, FLAT));
    // Herrevad Abbey: a long brick church with a squat tower, the cloister range, the farm buildings
    const B = 0x8a4030, B2 = 0x7a3626, ROOF = 0x6a2a20, wins = [];
    const ax = 60, az = 10;
    k.box(40, 11, 12, B, [ax, 5.5, az]); k.add(gableRoof(40, 12, 9, 0.3), ROOF, [ax, 11, az]);
    k.box(10, 24, 10, B2, [ax - 24, 12, az]); k.add(gableRoof(10, 10, 6, 0.3), ROOF, [ax - 24, 24, az]);
    for (let i = 0; i < 7; i++) { k.box(1.4, 10, 1.6, B2, [ax - 17 + i * 5.6, 5, az - 6.6]); wins.push({ p: new THREE.Vector3(ax - 14.2 + i * 5.6, 6, az - 6.05), yaw: Math.PI }); }
    k.box(30, 7, 9, B, [ax + 4, 3.5, az + 16]); k.add(gableRoof(30, 9, 6, 0.3), ROOF, [ax + 4, 7, az + 16]);
    // Tycho's laboratory (the old brewery), with its chimney smoking
    house(k, { x: 28, y: 0, z: -8, w: 12, d: 8, h: 5, yaw: -Math.PI / 2, wall: 0xb07050, roofCol: 0x5a3a2a }, wins);
    house(k, { x: 38, y: 0, z: 30, w: 16, d: 8, h: 4, yaw: Math.PI, wall: 0xd0c0a0, roofCol: 0x6a5a3a, timber: 0x3a2a1c }, wins);
    house(k, { x: 16, y: 0, z: 26, w: 10, d: 7, h: 3.6, yaw: Math.PI, wall: 0xc8b898, roofCol: 0x7a6a3a, timber: 0x3a2a1c }, wins);
    this.labSmoke = makeSmoke(new THREE.Vector3(31, 10, -8), { n: 7, rise: 8, size: 1.2, opacity: 0.18, color: 0x9a9aa8 }); A.add(this.labSmoke.group);
    // a fence along the lane, bare trees, haystacks
    for (let x = -12; x < 50; x += 2.4) { const z = 4 + Math.sin(x / 30) * 3 - 2.4; k.box(0.1, 1.1, 0.1, 0x4a3a2a, [x, fieldsHeight(x, z) + 0.55, z]); k.box(2.4, 0.08, 0.05, 0x5a4a3a, [x + 1.2, fieldsHeight(x, z) + 0.85, z]); }
    for (let i = 0; i < 90; i++) {
      const a = r() * 6.28, d = 18 + r() * 300, x = Math.cos(a) * d, z = Math.sin(a) * d; if (x > 10 && x < 90 && z > -20 && z < 40) continue;
      const y = fieldsHeight(x, z), s = 0.8 + r() * 0.7;
      k.cyl(0.12 * s, 0.25 * s, 5 * s, 5, 0x2a221c, [x, y + 2.5 * s, z]);
      for (let j = 0; j < 5; j++) { const b = r() * 6.28; k.cyl(0.03 * s, 0.08 * s, 3 * s, 4, 0x2a221c, [x + Math.cos(b) * 0.9 * s, y + (4.5 + r() * 1.5) * s, z + Math.sin(b) * 0.9 * s], [Math.sin(b) * 0.7, 0, -Math.cos(b) * 0.7]); }
    }
    for (let i = 0; i < 8; i++) { const x = -30 - r() * 60, z = -20 - r() * 60; k.cyl(0.4, 2.2, 3, 8, 0x8a7a4a, [x, fieldsHeight(x, z) + 1.5, z]); }
    A.add(k.mesh());
    A.add(windows(wins, { lit: 0.55, seed: 2 }));
    this.life = new Life(this.root);
    this.cowsA = this.life.add(makeHerd('cow', { n: 5, area: { x: -40, z: 40, r: 18 }, height: fieldsHeight, seed: 4 }));
    this.A.add(this.cowsA.group);
    this.dogA = this.life.add(makeHerd('dog', { n: 1, area: { x: 20, z: 14, r: 6 }, height: fieldsHeight, seed: 8 }));
    this.A.add(this.dogA.group);
  }

  // ---------- 2. Hven: Uraniborg, its garden, the sea ----------
  buildHven() {
    const k = new Kit(), r = rng(9), Bg = this.B;
    const SIZE = 2400, SEG = 170, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const grass = new THREE.Color(0x4e6038), field = new THREE.Color(0x7a7040), cliff = new THREE.Color(0x8a7a5a), path = new THREE.Color(0x9a8e72), bed = new THREE.Color(0x3a4a2a);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.7) * (SIZE / 2) / r0 : 0; x *= kk; z *= kk;
      const y = hvenHeight(x, z); p.setXYZ(i, x, y, z);
      c.copy(grass).lerp(field, clamp(N1(x / 40, z / 40) * 1.5 - 0.5, 0, 1) * clamp((Math.hypot(x, z) - 60) / 30, 0, 1));
      if (y < -2) c.copy(cliff);
      // the garden: paths in a cross and a circle, flower beds between
      const gx = x - CASTLE.x, gz = z - CASTLE.z;
      if (Math.abs(gx) < 37 && Math.abs(gz) < 37) { const onPath = Math.abs(gx) < 2 || Math.abs(gz) < 2 || Math.abs(Math.hypot(gx, gz) - 24) < 1.5 || Math.hypot(gx, gz) < 14; c.copy(onPath ? path : bed).lerp(grass, onPath ? 0 : 0.3 * N2(x, z)); }
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); Bg.add(new THREE.Mesh(g, FLAT));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshPhongMaterial({ color: 0x0e1c2a, specular: 0x667799, shininess: 50 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = SEA; Bg.add(sea);
    // the far coasts of Denmark and Sweden, low and dark
    for (const [az, d, w] of [[270, 3500, 5000], [90, 4200, 6000]]) { const q = at(az, d); k.box(w, 30, 200, 0x1a2420, [q.x, SEA + 10, q.z], [0, -az * D2R, 0]); }
    // Uraniborg: red brick with pale sandstone corners, a square main house, round towers north and
    // south with observing platforms and conical roofs, a tall middle tower with an onion-ish spire
    const RB = 0xa0482e, SS = 0xd8c8a0, CU = 0x4a8070, wins = [], X = CASTLE.x, Z = CASTLE.z;
    k.box(16, 10, 16, RB, [X, 5, Z]);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.9, 10.2, 0.9, SS, [X + sx * 8, 5.1, Z + sz * 8]);
    k.box(16.4, 0.5, 16.4, SS, [X, 10.2, Z]);
    k.add(gableRoof(16, 16, 6, 0.4), 0x6a3426, [X, 10.4, Z]); k.add(gableRoof(16, 16, 6, 0.4).rotateY(Math.PI / 2), 0x6a3426, [X, 10.4, Z]);
    for (const s of [-1, 1]) { // east and west wings with gables and a lantern, and the north/south towers
      k.box(6, 8, 10, RB, [X + s * 11, 4, Z]); k.add(gableRoof(6, 10, 4, 0.3).rotateY(Math.PI / 2), 0x6a3426, [X + s * 11, 8, Z]);
      k.cyl(4, 4, 11, 16, RB, [X, 5.5, Z + s * 11]); k.cyl(4.3, 4.3, 0.4, 16, SS, [X, 11.2, Z + s * 11]);
      for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; k.box(0.15, 1, 0.15, SS, [X + Math.cos(a) * 4.1, 11.9, Z + s * 11 + Math.sin(a) * 4.1]); }
      k.cyl(0.001, 4.2, 5, 16, CU, [X, 14.5, Z + s * 11]);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 8; j++) { const a = j / 8 * 6.28; wins.push({ p: new THREE.Vector3(X + Math.cos(a) * 4.02, 2.5 + i * 3, Z + s * 11 + Math.sin(a) * 4.02), yaw: Math.PI / 2 - a }); }
    }
    k.cyl(2.4, 2.6, 8, 12, RB, [X, 18, Z]); k.cyl(2.8, 2.8, 0.4, 12, SS, [X, 22.2, Z]);
    k.ball(2.4, 1, CU, [X, 23.6, Z], 0, [1, 1.1, 1]); k.cyl(0.001, 0.7, 6, 8, CU, [X, 27.5, Z]); k.ball(0.35, 0, 0xe0b040, [X, 30.6, Z]);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { wins.push({ p: new THREE.Vector3(X - 6 + i * 4, 3, Z + s * 8.03), yaw: s > 0 ? 0 : Math.PI }); wins.push({ p: new THREE.Vector3(X - 6 + i * 4, 7, Z + s * 8.03), yaw: s > 0 ? 0 : Math.PI }); }
    // the square garden wall with its semicircular bulges and gatehouses east and west
    const W = 37;
    for (const [ax, az, bx, bz] of [[-W, -W, W, -W], [W, -W, W, W], [W, W, -W, W], [-W, W, -W, -W]]) {
      const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax);
      for (const f of [0.25, 0.75]) k.box(len / 2 - 6, 3, 1, 0x9a8a6a, [X + ax + (bx - ax) * f, 1.5, Z + az + (bz - az) * f], [0, yaw, 0]);
      const mx = X + (ax + bx) / 2, mz = Z + (az + bz) / 2, ox = -(bz - az) / len, oz = (bx - ax) / len;
      for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI, px = mx + ((bx - ax) / len) * Math.cos(a) * 6 + ox * Math.sin(a) * -6, pz = mz + ((bz - az) / len) * Math.cos(a) * 6 + oz * Math.sin(a) * -6; k.box(2, 3, 1, 0x9a8a6a, [px, 1.5, pz], [0, yaw + a, 0]); }
    }
    for (const s of [-1, 1]) { k.box(6, 7, 6, RB, [X + s * W, 3.5, Z]); k.add(gableRoof(6, 6, 4, 0.3), 0x6a3426, [X + s * W, 7, Z]); }
    // garden trees (fruit trees in rows) and hedges
    for (let i = 0; i < 64; i++) { const a = i / 64 * 6.28, d = i % 2 ? 30 : 18, x = X + Math.cos(a) * d, z = Z + Math.sin(a) * d; if (Math.abs(x - X) < 3 || Math.abs(z - Z) < 3 || Math.hypot(x, z) < 8) continue; k.cyl(0.08, 0.12, 1.6, 5, 0x3a2a1c, [x, 0.8, z]); k.ball(1.1, 1, i % 3 ? 0x4a6a2a : 0x5a6a30, [x, 2.2, z]); }
    // Stjerneborg: the half-underground observatory nearby, its little domes just above the ground
    for (const [dx, dz] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]]) k.ball(dx || dz ? 1.8 : 2.4, 1, 0x7a5a3a, [70 + dx, -0.5, -80 + dz], 0, [1, 0.7, 1]);
    // fields, farms and the village of Tuna
    for (let i = 0; i < 14; i++) { const q = at(120 + r() * 120, 120 + r() * 100); house(k, { x: q.x, y: hvenHeight(q.x, q.z), z: q.z, w: 9, d: 6, h: 3.2, yaw: r() * 6, wall: 0xd8c8a8, roofCol: 0x8a7a40, timber: 0x3a2a1c }, wins); }
    // The terrace where you stand, and the great mural quadrant on its wall
    k.box(12, 0.25, 9, 0x8a8478, [0, 0.12, 0]);
    k.box(0.6, 3.4, 4.2, RB, [QUAD.x - 0.35, 1.7, QUAD.z - 0.4]); k.box(0.7, 0.3, 4.4, SS, [QUAD.x - 0.35, 3.5, QUAD.z - 0.4]);
    Bg.add(k.mesh());
    Bg.add(windows(wins, { lit: 0.6, seed: 6 }));
    // the quadrant: a brass quarter circle (radius 1.9 m) on the wall, centred at its top corner
    const q = new Kit(), BR = 0xc89a40, R = 1.9;
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI / 2, a2 = (i + 1) / 24 * Math.PI / 2, ca = (a + a2) / 2; q.box(0.06, R * 0.07, 0.08, BR, [0, -Math.sin(ca) * R, Math.cos(ca) * R], [ca, 0, 0]); }
    for (let i = 0; i <= 90; i += 2) { const a = i * D2R; q.box(0.065, 0.004, i % 10 ? 0.03 : 0.06, 0x2a1a0a, [0.005, -Math.sin(a) * R, Math.cos(a) * R], [a, 0, 0]); }
    q.box(0.05, R, 0.05, BR, [0, -R / 2, 0]); q.box(0.05, 0.05, R, BR, [0, 0, R / 2]);
    this.quad = q.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.35 }));
    this.quad.position.set(QUAD.x, 2.9, QUAD.z - 2.2); Bg.add(this.quad);
    // the painting of Tycho and his rooms inside the arc
    const paint = canvasTex(512, 512, (g2) => {
      g2.fillStyle = '#5a4630'; g2.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 3; i++) { g2.fillStyle = ['#7a6a4a', '#6a5a3a', '#8a7a5a'][i]; g2.fillRect(40 + i * 150, 60, 120, 200); }
      g2.fillStyle = '#1a1a1a'; g2.beginPath(); g2.ellipse(300, 330, 70, 120, 0, 0, 6.28); g2.fill();
      g2.fillStyle = '#e8d8c0'; g2.beginPath(); g2.arc(300, 210, 34, 0, 6.28); g2.fill(); g2.fillStyle = '#f4f0e8'; g2.fillRect(262, 240, 76, 18);
      g2.fillStyle = '#c08a3a'; g2.fillRect(296, 206, 8, 10); g2.fillStyle = '#b06a30'; g2.fillRect(282, 222, 36, 6);
      g2.strokeStyle = '#b08a4a'; g2.lineWidth = 6; g2.beginPath(); g2.moveTo(380, 250); g2.lineTo(430, 160); g2.stroke();
    });
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.95, R * 0.95), new THREE.MeshLambertMaterial({ map: paint }));
    pm.rotation.y = Math.PI / 2; pm.position.set(QUAD.x - 0.04, 2.9 - R * 0.48, QUAD.z - 2.2 + R * 0.48); Bg.add(pm);
    // the sight that slides along the arc (ch9_07)
    const sk = new Kit(); sk.box(0.12, 0.12, 0.08, 0x8a6a2a, [0, 0, 0]); sk.box(0.02, 0.18, 0.02, 0x1a1a1a, [0.07, 0, 0]);
    this.sightM = sk.mesh(); Bg.add(this.sightM); this.sightA = 12;   // degrees up the arc
    this.sightGlow = glow(0xffe0a0, 0.25, 0); this.sightM.add(this.sightGlow);
    this.beam = glowPoints(80, { sizeScale: 250 }); this.beam.visible = false; Bg.add(this.beam);
    // lanterns and a table of logbooks on the terrace
    const tk = new Kit(); tk.box(1.4, 0.05, 0.8, 0x5a3a22, [1.6, 0.85, -0.6]); for (const [ox, oz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) tk.box(0.05, 0.85, 0.05, 0x2a1a10, [1.6 + ox, 0.42, -0.6 + oz]);
    for (let i = 0; i < 4; i++) tk.box(0.24, 0.07, 0.32, [0x5a2a1a, 0x2a3a2a, 0x4a3a1a, 0x3a2a3a][i], [1.3 + (i % 2) * 0.05, 0.91 + i * 0.07, -0.6]);
    tk.box(0.36, 0.02, 0.28, 0xece0c0, [1.85, 0.885, -0.55]);
    Bg.add(tk.mesh());
    this.lampB = new THREE.PointLight(0xffa860, 3, 10, 1.6); this.lampB.position.set(1.6, 1.4, -0.6); Bg.add(this.lampB);
    this.lampFlame = glow(0xffb050, 0.15); this.lampFlame.position.set(1.95, 1.0, -0.7); Bg.add(this.lampFlame);
    this.books = tk; // (kept for clarity)
    this.elk = this.life.add(makeHerd('reindeer', { n: 1, area: { x: 6, z: -12, r: 5 }, height: hvenHeight, seed: 12, scale: 1.45 }));
    this.B.add(this.elk.group);
    this.sheep = this.life.add(makeHerd('sheep', { n: 8, area: { x: -70, z: 40, r: 14 }, height: hvenHeight, seed: 3 })); this.B.add(this.sheep.group);
    this.gulls = this.life.add(makeFlock({ n: 8, center: new THREE.Vector3(-150, 20, 120), r: 70, height: 8, color: 0xd8dce0, size: 1.2, seed: 2, speed: 6 })); this.B.add(this.gulls.group);
  }

  buildPeople() {
    const add = (parent, model, pos, look = {}) => { const P = makePerson({ model, seed: 7 + parent.children.length * 3, ...look }); P.g.position.copy(pos); parent.add(P.g); return P; };
    // Herrevad: Tycho walks home; two farm folk come out with a lantern
    this.tycho = add(this.A, 'tycho', new THREE.Vector3(26, 0, 3), { tunic: 0x1a1a1a, hair: 0x9a5a2a, height: 1.78 });
    this.folk = [add(this.A, 'townsman', new THREE.Vector3(36, 0, 26), { height: 1.68 }), add(this.A, 'townsman', new THREE.Vector3(39, 0, 27), { height: 1.6, tunic: 0x6a4a3a })];
    this.folkLamp = makeTorch({ len: 0.35, color: 0xffc070, size: 0.6 }); holdProp(this.folk[0], this.folkLamp, 'Right', [0, 0.02, 0.02]);
    this.folkLight = new THREE.PointLight(0xffb060, 1.4, 8, 1.8); this.folk[0].g.add(this.folkLight); this.folkLight.position.set(0.3, 1.2, 0.2);
    // Hven: Tycho, a helper at the sight, a timekeeper with the clock, a scribe at the book table
    this.tychoB = add(this.B, 'tycho', new THREE.Vector3(0.6, 0, -2.4), { tunic: 0x1a1a1a, hair: 0x9a5a2a, height: 1.78 });
    this.observer = add(this.B, 'rheticus', new THREE.Vector3(QUAD.x + 0.7, 0, QUAD.z + 0.3), {});
    this.timer = add(this.B, 'townsman', new THREE.Vector3(2.6, 0, -1.4), { tunic: 0x3a4a5a });
    this.scribe = add(this.B, 'canon', new THREE.Vector3(1.6, 0, 0.1), {});
    this.helpers = [];
    for (let i = 0; i < 4; i++) { const P = add(this.B, 'townsman', new THREE.Vector3(-6 + i * 4, 0, -20), { height: 1.65 + (i % 2) * 0.06, tunic: [0x5a4a32, 0x3a3a4a, 0x6a3a2a, 0x4a4a3a][i] }); P.routine = [{ x: -10 + i * 6, z: -20, pose: 'idle', secs: 6 + i }, { x: -8 + i * 5, z: -48, pose: 'talk', secs: 5 }, { x: 18 - i * 3, z: -14, pose: 'work', secs: 6 }]; const L = makeTorch({ len: 0.35, color: 0xffc070, size: 0.6 }); holdProp(P, L, 'Right', [0, 0.02, 0.02]); P.lamp = L; this.helpers.push(P); }
    this.keplerEcho = new Echo(this.G, this.B, { model: 'kepler', tint: 0xa8c8ff, pos: new THREE.Vector3(2.6, 0, 0.4), face: -1.2, seed: 9 });
  }

  // ---------- The new star (and what it really was) ----------
  buildNova() {
    this.novaS = glow(0xfff6e0, 1, 0); this.novaS.material.depthTest = true; this.root.add(this.novaS);
    this.novaCore = glow(0xffffff, 0.35, 1); this.novaS.add(this.novaCore);
    this.novaRays = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 256, (g) => { g.translate(128, 128); for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4); const gr = g.createLinearGradient(-128, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-128, -2, 256, 4); } }), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.root.add(this.novaRays);
    this.casLab = textSprite('Cassiopeia', 30); this.casLab.material.opacity = 0; this.root.add(this.casLab);
    // the explosion: a shell of glowing gas, blue-white then red, with wisps
    this.shell = glowPoints(1400, { sizeScale: 300, depthTest: false }); this.shell.visible = false; this.root.add(this.shell);
    this.shD = Array.from({ length: 1400 }, () => { const v = new THREE.Vector3().randomDirection(); return { v, s: 0.8 + Math.random() * 0.4 + (Math.random() < 0.15 ? 0.3 : 0), hue: Math.random() }; });
    this.boomT = -1;
  }
  novaDir(out) {
    const sf = this.G.sky.starField, i = sf?.find?.('Caph') ?? -1, j = sf?.find?.('Schedar') ?? -1, p = sf?.find?.('Polaris') ?? -1;
    if (i < 0 || j < 0 || p < 0) return out.set(0.4, 0.8, -0.4).normalize();
    sf.dirOf(i, _c); sf.dirOf(j, _d); out.copy(_c).add(_d).normalize(); sf.dirOf(p, _c);
    return out.lerp(_c, 0.2).normalize();
  }

  // ch9_04: the Moon shifts against the stars when seen from two places; the new star doesn't
  buildParallax() {
    const M = this.par = new THREE.Group(); M.position.set(-1.3, 1.75, -2.6); M.rotation.y = 0.45; M.visible = false; this.A.add(M);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshBasicMaterial({ color: 0x4a80d0, transparent: true, fog: false }));
    new THREE.TextureLoader().load(new URL('../../data/earth.jpg', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; earth.material.map = t; earth.material.color.setHex(0xffffff); earth.material.needsUpdate = true; });
    earth.position.set(0, -0.55, 0);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0xd8dce8, transparent: true, fog: false })); moon.position.set(0.05, -0.1, 0);
    this.parPts = glowPoints(420, { sizeScale: 260 }); M.add(earth, moon, this.parPts);
    this.parEarth = earth; this.parMoon = moon;
    this.parLabs = [label('Moon: jumps', 0.06), label('New star: stays put', 0.06)];
    this.parLabs[0].position.set(0.35, -0.05, 0); this.parLabs[1].position.set(0.15, 0.95, 0); M.add(...this.parLabs);
    const ST = this.parStars = []; const r = rng(4); for (let i = 0; i < 60; i++) { const a = (r() - 0.5) * 1.6; ST.push([Math.sin(a) * 1.4, -0.55 + Math.cos(a) * 1.4]); }
  }

  // ch9_09: the giant star chart that fills with twenty years of measurements
  buildChart() {
    const C = this.chart = new THREE.Group(); C.position.set(0, 9, -24); C.visible = false; this.B.add(C);
    const fr = new THREE.Mesh(new THREE.RingGeometry(5.8, 6, 96), new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.5, fog: false, side: THREE.DoubleSide })); C.add(fr);
    this.chartPts = glowPoints(1000, { sizeScale: 400 }); C.add(this.chartPts);
    const r = rng(17); this.chartD = Array.from({ length: 1000 }, (_, i) => {
      if (i < 760) { const a = r() * 6.28, d = Math.sqrt(r()) * 5.6; return { x: Math.cos(a) * d, y: Math.sin(a) * d, at: r(), mars: false }; }
      // Mars's path: a long arc with a backward loop in it, measured again and again
      const f = (i - 760) / 240, x = -5 + f * 10, y = 2.2 * Math.sin(f * Math.PI) - 1.2 + (f > 0.45 && f < 0.62 ? 0.9 * Math.sin((f - 0.45) / 0.17 * Math.PI) : 0);
      return { x: f > 0.45 && f < 0.62 ? x - 1.6 * Math.sin((f - 0.45) / 0.17 * Math.PI) : x, y, at: f, mars: true };
    });
    this.chartLab = label('20 years of measurements', 0.5); this.chartLab.position.y = 6.6; C.add(this.chartLab);
    this.marsLab = label('Mars', 0.5, { color: '#ffb090' }); this.marsLab.position.set(4.2, -0.4, 0); this.marsLab.material.opacity = 0; C.add(this.marsLab);
  }

  // ch9_09: the Great Comet of 1577, and the crystal sphere it smashes through
  buildComet() {
    this.comet = new THREE.Group(); this.comet.visible = false; this.root.add(this.comet);
    this.cometHead = glow(0xe8f4ff, 14, 1); this.comet.add(this.cometHead);
    this.cometTail = glowPoints(300, { sizeScale: 300, depthTest: false }); this.comet.add(this.cometTail);
    const sph = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), new THREE.ShaderMaterial({
      uniforms: { a: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float a; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.0); gl_FragColor = vec4(vec3(0.5,0.75,1.0) * (0.06 + f * 0.5) * a, 1.0); }',
    }));
    this.crystal = sph; sph.visible = false; this.root.add(sph);
    this.shards = glowPoints(600, { sizeScale: 300, depthTest: false }); this.shards.visible = false; this.root.add(this.shards);
    this.shD2 = [];
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.sightIt = {
      hint: 'Grab the sight with GRIP and slide it up to the star', deskHint: 'Click the sight to line it up with the star',
      get disabled() { return self.s.sight !== 1; },
      reach(pos) { self.sightM.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.15); },
      aim(o, d) { self.sightM.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.2 ? t : Infinity; },
      onGrab() { G.act({ type: 'sight' }); }, onTouch() { G.act({ type: 'sight' }); },
    };
    G.interactables.push(this.sightIt);
  }
  act(a) {
    if (a.type === 'sight' && this.s.sight === 1) { this.s.sight = 2; this.G.events.emit('sfx', { k: 'swell' }); return true; }
    return this.journal.act(a);
  }
  getState() { return this.s; }
  setState(st) { const was = this.s.scene; Object.assign(this.s, st); if (st.scene && st.scene !== was) this.setScene(st.scene); }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    G.events.emit('placePlayers', { x: this.start.pos.x, z: this.start.pos.z, yaw: this.start.yaw });
    await G.ui.fadeIn(3);
    s.phase = 'walk';
    const l1 = D.sayAsync('ch9_01');
    await D.cue('and stops'); s.phase = 'stop'; s.nova = 1;
    await l1;
    // Tycho's own words
    s.phase = 'gasp';
    const l2 = D.sayAsync('ch9_02');
    await D.cue('Somebody'); s.folk = 1;
    await l2;
    s.phase = 'cas'; s.cas = 1;
    s.guide = this.novaDir(_a).multiplyScalar(9).add(_b.set(2.5, -2, 2.5)).toArray();
    await D.say('ch9_03');
    s.guide = null; s.cas = 0;
    s.phase = 'measure'; s.parallax = 1;
    await D.say('ch9_04');
    s.parallax = 0;
    // what it really was
    s.phase = 'boom'; s.boom = 1;
    await D.say('ch9_05');
    await D.until(() => this.boomT > 9 || this.boomT < 0, fast ? 2 : 6);
    // Hven
    await G.ui.fadeOut(1.5);
    s.scene = 'hven'; this.setScene('hven'); s.nova = 0; s.boom = 0; s.hour = 21;
    G.events.emit('placePlayers', { x: 0.4, z: 1.6, yaw: 0.35 });
    await G.ui.fadeIn(2);
    s.phase = 'castle';
    s.guide = [CASTLE.x + 6, 16, CASTLE.z + 14];
    await D.say('ch9_06');
    s.guide = null;
    // the mural quadrant
    s.phase = 'quadrant';
    const l7 = D.sayAsync('ch9_07');
    await D.cue('Line up'); s.sight = 1;
    await l7;
    D.hint(G.mode === 'desktop' ? this.sightIt.deskHint : this.sightIt.hint, 9);
    await D.auto(() => s.sight >= 2, () => { s.sight = 2; }, { after: fast ? 0.3 : 1.5, timeout: fast ? 2 : 25 });
    if (s.sight < 2) s.sight = 2;
    G.ui.showHint('');
    await D.until(() => this.sightDone, fast ? 2 : 6);
    // the nose, the helpers, the elk
    s.phase = 'nose';
    await D.say('ch9_08');
    // twenty years of nights, and the comet
    s.phase = 'years'; s.years = 1;
    const l9 = D.sayAsync('ch9_09');
    await D.cue('comets'); s.comet = 1;
    await l9;
    await D.until(() => this.cometDone, fast ? 2 : 12);
    // Mars
    s.phase = 'mars'; s.mars = 1;
    await D.say('ch9_10');
    await D.wait(fast ? 0.5 : 2.5);
    s.phase = 'journal';
    await this.journal.present(D);
    s.years = 0; s.mars = 0;
    s.phase = 'done';
  }

  // ---------- Every frame ----------
  update(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1;
    this.t += dt;
    if (s.scene !== this.cur) this.setScene(s.scene);
    // twenty years of nights: the sky wheels round fast
    if (s.years && !s.mars) s.hour = 21 + ((this.yearsT = (this.yearsT || 0) + dt * fast) * 1.2) % 10;
    else s.hour = damp(s.hour, s.scene === 'abbey' ? 18.6 : 21, 0.5, dt);
    const sun = sunAt(this.lat, s.scene === 'abbey' ? 229 : 200, s.hour);
    G.sky.set(sun.az, sun.el);
    this.life.update(dt, t);
    if (this.A.visible) this.labSmoke.update(dt, t);
    this.updatePeople(dt, t);
    this.updateNova(dt, t);
    this.updateParallax(dt, t);
    this.updateQuadrant(dt, t);
    this.updateYears(dt, t);
    const busy = this.journal.update();
    guideUpdate(this, busy);
    this.lampB.intensity = 2.6 + 0.6 * Math.sin(t * 9) * Math.sin(t * 5.3);
  }

  updatePeople(dt, t) {
    const s = this.s, T = this.tycho;
    if (this.A.visible) {
      this.novaDir(_a); const look = _b.copy(T.g.position).addScaledVector(_a, 30).setY(T.g.position.y + 1.6 + _a.y * 30);
      if (s.phase === 'arrive' || s.phase === 'walk') { if (walkToward(T, 3.5, -1.6, dt, { speed: 0.85, height: fieldsHeight })) T.pose = 'idle'; }
      else if (s.phase === 'stop') { T.pose = 'gasp'; T.look = look.clone(); }
      else if (s.phase === 'gasp' || s.phase === 'cas') { T.pose = 'point'; T.pointAt.copy(look); T.look = look.clone(); }
      else if (s.phase === 'measure') { T.pose = 'hold'; T.look = look.clone(); }
      else { T.pose = 'idle'; T.look = look.clone(); }
      animatePerson(T, t, dt);
      this.folk.forEach((P, i) => {
        if (s.folk) { if (walkToward(P, 5.5 + i * 1.2, 0.6 - i * 0.8, dt, { speed: 1.2, height: fieldsHeight })) { P.pose = i ? 'gasp' : 'point'; P.pointAt.copy(look); P.look = look.clone(); } }
        else { P.pose = 'idle'; }
        animatePerson(P, t, dt);
      });
      this.folkLamp.userData.flicker(t);
    }
    if (this.B.visible) {
      const TB = this.tychoB, O = this.observer, Tm = this.timer, Sc = this.scribe;
      if (s.phase === 'nose') { TB.pose = 'talk'; TB.look = this.G.camera.getWorldPosition(_a).clone(); }
      else if (s.phase === 'quadrant') { TB.pose = 'point'; TB.pointAt.copy(this.sightM.getWorldPosition(_a)); TB.look = TB.pointAt.clone(); }
      else { TB.pose = 'idle'; TB.look = null; TB.glance = true; }
      O.pose = s.sight ? 'hold' : 'idle'; O.look = this.sightM.getWorldPosition(_a).clone();
      Tm.pose = this.sightDone && !this.called ? 'cheer' : 'hold'; Sc.pose = 'write';
      if (this.sightDone && !this.called) { this.called = true; this.G.audio.ctx && this.G.audio.chime(Tm.g.position, 0.4); }
      for (const P of [TB, O, Tm, Sc]) animatePerson(P, t, dt);
      for (const P of this.helpers) { runRoutine(P, dt, { height: hvenHeight, speed: 0.9 }); animatePerson(P, t, dt); P.lamp.userData.flicker(t); }
      this.keplerEcho.update(dt, t);
      this.keplerEcho.show(s.mars === 1);
    }
  }

  updateNova(dt, t) {
    const G = this.G, s = this.s;
    G.camera.getWorldPosition(_a); this.novaDir(_b);
    this.novaV = damp(this.novaV || 0, s.nova ? 1 : 0, s.nova ? 0.8 : 3, dt);
    const fl = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 4.3);
    const vis = this.novaV * (1 - clamp01((this.boomT || 0) / 2.5) * (this.boomT >= 0 ? 1 : 0));
    this.novaS.position.copy(_a).addScaledVector(_b, 800); this.novaS.scale.setScalar((40 + 10 * fl) * (1 + (s.cas ? 0.3 : 0))); this.novaS.material.opacity = vis; this.novaCore.material.opacity = vis;
    this.novaRays.position.copy(this.novaS.position); this.novaRays.scale.setScalar(150 * fl); this.novaRays.material.opacity = vis * 0.8;
    this.novaS.visible = this.novaRays.visible = this.A.visible;
    // Cassiopeia's W, and its name
    this.casV = damp(this.casV || 0, s.cas ? 1 : 0, 2, dt);
    G.sky.starField?.highlight?.(this.casV > 0.01 ? 'Cas' : null, this.casV);
    this.casLab.position.copy(_a).addScaledVector(_b, 800).add(_c.set(0, -55, 0)); this.casLab.material.opacity = this.casV;
    // the explosion
    if (s.boom && this.boomT < 0) { this.boomT = 0; G.audio.ctx && (rumble(G, 4, 0.4), awe(G, 14, 0.1, 92)); }
    if (this.boomT >= 0) {
      this.boomT += dt * (G.params.has('fast') ? 3 : 1);
      const k = this.boomT, S = this.shell.userData, R = 6 + ease(Math.min(1, k / 8)) * 110, fade = s.boom ? 1 : clamp01(1 - (k - 12) / 3);
      this.shell.visible = this.A.visible && fade > 0;
      const c0 = this.novaS.position;
      this.shD.forEach((d, i) => {
        const r = R * d.s * (1 + 0.06 * Math.sin(t + i));
        S.pos.set([c0.x + d.v.x * r, c0.y + d.v.y * r, c0.z + d.v.z * r], i * 3);
        const hot = clamp01(1 - k / 6), b = (0.35 + 0.65 * Math.abs(d.v.dot(_b) < 0.4 ? 1 : 0.4)) * fade * clamp01(k * 2);
        S.col.set([b * (0.9 - 0.1 * hot + 0.1 * d.hue), b * (0.35 + 0.55 * hot), b * (0.25 + 0.75 * hot) * (0.6 + 0.4 * d.hue)], i * 3); S.size[i] = 2.2 + 3 * hot;
      });
      S.commit();
      if (!s.boom && fade <= 0) this.boomT = -1;
      if (k < 0.6) { this.novaS.scale.setScalar(160 * (1 - k)); this.novaS.material.opacity = 1; }
    }
  }

  updateParallax(dt, t) {
    const s = this.s, M = this.par;
    this.parV = damp(this.parV || 0, s.parallax ? 1 : 0, 2, dt); M.visible = this.parV > 0.01 && this.A.visible;
    if (!M.visible) return;
    this.parEarth.material.opacity = this.parMoon.material.opacity = this.parV;
    this.parLabs.forEach((l) => { l.material.opacity = this.parV; });
    // two watchers on the Earth's surface, looking up: lines through the Moon land on different stars;
    // lines to the new star (far away among the stars) stay together
    const side = Math.floor(t / 1.6) % 2 ? 1 : -1, P = this.parPts.userData; let n = 0;
    const dot = (x, y, r, g, b, sz) => { P.pos.set([x, y, 0], n * 3); P.col.set([r * this.parV, g * this.parV, b * this.parV], n * 3); P.size[n] = sz; n++; };
    for (const [x, y] of this.parStars) dot(x, y, 0.6, 0.65, 0.8, 0.012);
    const ox = side * 0.12, oy = -0.55 + 0.12;
    dot(ox, oy, 1, 0.9, 0.4, 0.04);
    const mx = 0.05, my = -0.1, dx = mx - ox, dy = my - oy, L = Math.hypot(dx, dy);
    for (let i = 0; i < 160; i++) { const f = i / 160 * 3.2; dot(ox + dx / L * f * 0.6, oy + dy / L * f * 0.6, 0.9, 0.9, 1, 0.008); }
    dot(ox + dx / L * 1.92, oy + dy / L * 1.92, 1, 0.6, 0.4, 0.05);
    const nx = 0.15, ny = 0.82;
    for (let i = 0; i < 120; i++) { const f = i / 120; dot(ox + (nx - ox) * f, oy + (ny - oy) * f, 1, 0.85, 0.5, 0.008); }
    dot(nx, ny, 1, 1, 0.85, 0.07);
    while (n < 420) dot(0, 0, 0, 0, 0, 0);
    P.commit();
  }

  updateQuadrant(dt, t) {
    const s = this.s;
    if (!this.B.visible) return;
    // the target star, due south along the wall's line of sight (the arc faces east, sighting south)
    const target = 38;
    if (s.sight >= 2) { this.sightA = damp(this.sightA, target, 1.5, dt); if (Math.abs(this.sightA - target) < 0.5 && !this.sightDone) { this.sightDone = true; this.G.audio.ctx && this.G.audio.chime(this.sightM.position, 0.5); } }
    const a = this.sightA * D2R, R = 1.9;
    this.sightM.position.set(QUAD.x + 0.08, 2.9 - Math.sin(a) * R, QUAD.z - 2.2 + Math.cos(a) * R);
    this.sightGlow.material.opacity = s.sight === 1 ? 0.6 + 0.4 * Math.sin(t * 5) : this.sightDone ? 0.5 : 0;
    // the sight line from the arc's corner through the sight, out to the star
    this.beam.visible = !!this.sightDone && s.phase === 'quadrant';
    if (this.beam.visible) {
      const B = this.beam.userData; _a.set(QUAD.x + 0.08, 2.9, QUAD.z - 2.2); _b.copy(this.sightM.position).sub(_a).normalize().negate();
      for (let i = 0; i < 80; i++) { const f = i * i * 0.05; B.pos.set([_a.x + _b.x * f, _a.y + _b.y * f, _a.z + _b.z * f], i * 3); const v = 0.8 * (1 - i / 80); B.col.set([v, v * 0.85, v * 0.5], i * 3); B.size[i] = 0.03 + i * 0.01; }
      B.commit();
    }
  }

  updateYears(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1;
    this.chartV = damp(this.chartV || 0, s.years ? 1 : 0, 1.2, dt);
    this.chart.visible = this.chartV > 0.01 && this.B.visible;
    if (this.chart.visible) {
      this.chartT = (this.chartT || 0) + dt * fast;
      const fill = clamp01(this.chartT / 14), C = this.chartPts.userData, mOn = this.marsV = damp(this.marsV || 0, s.mars ? 1 : 0, 2, dt);
      this.chartD.forEach((d, i) => {
        const on = d.at < fill ? 1 : 0;
        C.pos.set([d.x, d.y, 0], i * 3);
        const v = on * this.chartV * (d.mars ? 0.5 + mOn : 0.6 * (1 - 0.6 * mOn));
        C.col.set(d.mars ? [v, v * (0.5 - 0.3 * mOn), v * (0.4 - 0.3 * mOn)] : [v * 0.8, v * 0.85, v], i * 3); C.size[i] = d.mars ? 0.06 + 0.05 * mOn : 0.05;
      });
      C.commit();
      this.chartLab.material.opacity = this.chartV; this.marsLab.material.opacity = mOn;
      G.camera.getWorldPosition(_a); this.chart.lookAt(_a);
    }
    // the comet: across the sky, through the crystal sphere, which bursts into shards
    if (s.comet && this.cometT == null) { this.cometT = 0; whoosh(G, 6, 0.3); }
    if (this.cometT != null && !this.cometDone) {
      this.cometT += dt * fast; const k = this.cometT / 16;
      this.comet.visible = this.B.visible; this.crystal.visible = this.B.visible;
      G.camera.getWorldPosition(_a);
      const from = at(250, 700, 380), to = at(110, 700, 120);
      this.comet.position.copy(_a).add(_b.lerpVectors(from, to, ease(k)));
      this.crystal.position.copy(_a);
      this.crystal.material.uniforms.a.value = k < 0.45 ? clamp01(k / 0.15) : 0;
      // the tail points away from the Sun (below the western horizon)
      const T = this.cometTail.userData; _c.set(-0.6, -0.15, 0.3).normalize();
      for (let i = 0; i < 300; i++) { const f = i / 300, sp = (Math.sin(i * 12.9) * 0.5) * f * 40; T.pos.set([-_c.x * f * 260 + sp, -_c.y * f * 260 + sp * 0.3, -_c.z * f * 260], i * 3); const v = (1 - f) * 0.9; T.col.set([v * 0.8, v * 0.9, v], i * 3); T.size[i] = 4 + f * 14; }
      T.commit();
      if (k > 0.45 && !this.broke) {
        this.broke = true; shatter(G, 0.4); rumble(G, 2, 0.3); this.shards.visible = this.B.visible;
        for (let i = 0; i < 600; i++) { const d = _b.lerpVectors(from, to, 0.45).normalize(); const v = new THREE.Vector3().randomDirection(); this.shD2[i] = { p: d.multiplyScalar(500).add(v.clone().multiplyScalar(Math.random() * 120)), v: v.multiplyScalar(30 + Math.random() * 90) }; }
      }
      if (this.broke) {
        const S = this.shards.userData, kk = clamp01((k - 0.45) / 0.4);
        this.shD2.forEach((q, i) => { q.p.addScaledVector(q.v, dt * fast); S.pos.set([_a.x + q.p.x, _a.y + q.p.y, _a.z + q.p.z], i * 3); const v = (1 - kk) * 0.9; S.col.set([v * 0.6, v * 0.85, v], i * 3); S.size[i] = 3; });
        S.commit();
      }
      if (k >= 1) { this.cometDone = true; this.comet.visible = this.crystal.visible = this.shards.visible = false; }
    }
  }

  dispose() {
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.sky.starField?.highlight?.(null);
  }
}

// The journal page: the new star in Cassiopeia (from Tycho's own little book), and why it's far away
function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
  g.fillText('Tycho, 1572: a new star', 40, 70);
  // Cassiopeia's W with the new star above it
  const W = [[90, 300], [160, 240], [230, 320], [300, 250], [370, 300]];
  g.strokeStyle = 'rgba(58,42,24,0.5)'; g.lineWidth = 2; g.beginPath(); W.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  g.fillStyle = INK; for (const [x, y] of W) { g.beginPath(); g.arc(x, y, 7, 0, 6.28); g.fill(); }
  g.fillStyle = '#c0801a'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28 - Math.PI / 2, r = i % 2 ? 9 : 22; g.lineTo(200 + Math.cos(a) * r, 150 + Math.sin(a) * r); } g.fill();
  g.fillStyle = INK; g.font = 'italic 26px Georgia, serif'; g.fillText('the new star', 232, 156); g.fillText('Cassiopeia', 160, 370);
  // the Moon jumps between two watchers; the new star doesn't
  g.font = 'italic 28px Georgia, serif'; g.fillText('Seen from two places:', 540, 150);
  g.fillText('the Moon jumps,', 560, 200); g.fillText('the new star stays put.', 560, 240); g.fillText('So it is far, far away,', 560, 300); g.fillText('among the stars.', 560, 340);
  g.fillText('The heavens CAN change.', 40, h - 90);
  g.fillText('Uraniborg, Hven: 20 years of the best measurements ever made.', 40, h - 40);
}
