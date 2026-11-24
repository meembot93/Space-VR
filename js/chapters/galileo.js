// Era 2, Chapter 4 (n 11): Galileo's telescope. Two places.
//
// 1. Venice, an August evening in 1609, at the top of the bell tower of San Marco. You stand among
//    the great bells in the open belfry, the city golden below: the domes of the Basilica, the pink
//    Doge's Palace, the long arcades round the Piazza, gondolas and anchored ships in the basin,
//    San Giorgio across the water, the low line of the Lido and the open sea beyond. Galileo shows
//    the senators his new spyglass (two lenses floating together into a tube in front of you). You
//    look through it: a ship far out at sea, hours from port, close enough to count its sails. The
//    bells ring. Then Galileo tilts his telescope up, and the sky darkens into night...
// 2. Padua, the evening of 7 January 1610, on the little wooden roof terrace (an altana) on top of
//    Galileo's house: the roofs and lit windows of the city, the domes and minarets of the Basilica
//    of St Anthony, the long ship-keel roof of the Palazzo della Ragione, the Euganean Hills dark on
//    the horizon, bats flitting, his craftsmen still at work in the garden workshop. You look through
//    his telescope (a round view, magnified, black all around): the Moon's mountains and craters,
//    with the shadows moving at the line between day and night; the Milky Way breaking into
//    countless stars; Jupiter with three, then four "little stars" moving night by night. Galileo
//    says it: they are moons! The view tilts to show their orbits, the telescope's circle opens and
//    (wow) Jupiter's moons whirl round it, huge, across the real sky over Padua. A model of Venus
//    going round the Sun shows its phases; the Starry Messenger's pages fly out across the world
//    (and an echo of Kepler reads it, js/wow/ch11.js); the trouble (gently: the light cools, he
//    goes down, the hatch closes); then the warm light comes back, Galileo's echo smiles, the
//    Galileo spacecraft flies off toward the real Jupiter, and its four moons light up by name.
// World axes: -Z north, +X east, +Y up.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, walkToward, holdProp, dropProp } from '../people.js';
import { makeHerd, makeFlock, makeSmoke, makeTorch, makeCloth, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { cypress, poplar, conifer, orchardTree, grove } from '../trees.js';
import { rng, noise2 } from '../shapes.js';
import { moonFields } from '../moontex.js';
import { dirFromAzEl } from '../sky.js';
import { eqVec } from '../stars.js';
import { glowPoints, shatter, whoosh, awe, shimmer } from '../wow/fx.js';
import { D2R, ease, clamp01, at, sunAt, gableRoof, gableWall, glow, label, Journal, INK, guideUpdate } from '../era2/common.js';

const LAT = 45.42;
const TOPA = 48;                 // the belfry floor of the Campanile, Venice
const TOPB = 11;                 // Galileo's altana, Padua
const SUNA = 148, SUNB = 287;    // late August 1609; 7 January 1610
const JUP = [78.6, 23.0];        // Jupiter among the stars that night (J2000 RA, Dec)
const MILKY = [92, 24];          // a patch of the Milky Way near it (by the Twins' feet)
const MOON = { az: 140, el: 30 };
const SHIP = at(105, 4800, 0);   // the ship coming in from the Adriatic, beyond the Lido
const VEN = new THREE.Vector3(...at(118, 8.5, TOPB + 3.6).toArray());   // the Venus model
const N1 = noise2(111), N2 = noise2(113);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0), _col = new THREE.Color();

// Jupiter's four moons: real periods (days) and distances (Jupiter radii); phases fitted so the
// nights match Galileo's notes (7 Jan: two east one west; 8 Jan: three west; 10 Jan: two east; 13 Jan: four)
const GM = [
  { name: 'Io', T: 1.769, R: 5.9, ph: 5.0065, col: 0xf0d870, size: 0.16 },
  { name: 'Europa', T: 3.551, R: 9.4, ph: 5.8410, col: 0xeee6d8, size: 0.14 },
  { name: 'Ganymede', T: 7.155, R: 15.0, ph: 2.0946, col: 0xc8bca8, size: 0.2 },
  { name: 'Callisto', T: 16.69, R: 26.4, ph: 2.6415, col: 0x9a8a78, size: 0.18 },
];
const JK = 0.5, JR = 0.62;       // scope view: metres per Jupiter radius for the orbits; Jupiter's own size
const DAYS = [{ d: 0, t: '7 January 1610' }, { d: 1, t: '8 January' }, { d: 3, t: '10 January' }, { d: 6, t: '13 January' }];

// ---------- Venice: land and water ----------
const GC = [[-215, 110], [-300, 30], [-420, -60], [-520, -200], [-490, -380], [-600, -560], [-760, -640], [-900, -600]];
function segD(x, z, P) {
  let best = 1e9;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
const RII = [[[108, 90], [108, -260]], [[-195, -60], [-195, -420]], [[-420, -300], [620, -300]], [[300, 80], [280, -500]], [[-700, 120], [-700, 330]], [[-1200, -150], [600, -150]]];
function veniceLand(x, z) {
  if (segD(x, z, GC) < 24) return false;
  const main = z < 92 && z > -1300 && x > -1300 && x < 1150 && !(x < -230 && z > 60);
  const dorso = x > -1350 && x < -255 && z > 105 && z < 335;
  const giud = x > -1500 && x < -150 && z > 395 && z < 470;
  const sgio = x > 250 && x < 420 && z > 360 && z < 470;
  return main || dorso || giud || sgio;
}
function canalAt(x, z) { for (const R of RII) if (segD(x, z, R) < 4.5) return true; return false; }
const LIDO = (z) => 3000 + z * 0.2;

// ---------- Padua ----------
function paduaHeight(x, z) { return (N2(x / 9, z / 9) - 0.5) * 0.15; }

export default class Galileo {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.A = new THREE.Group(); this.B = new THREE.Group(); this.B.visible = false; this.root.add(this.A, this.B);
    this.start = { pos: new THREE.Vector3(-0.4, 0, 0.6), yaw: -105 * D2R };
    this.s = {
      scene: 'venice', phase: 'arrive', guide: null, hour: 18.25,
      lens: 0,        // ch11_01: 1 two lenses float up, 2 they slide into a tube, 3 it flies to Galileo
      gal: 'look',    // what Galileo is doing
      cheer: 0,       // the senators see the ship
      dusk: 0,        // the sky darkens into night
      look: 0,        // Padua: 1 the telescope is yours to look through, 2 looking
      scope: 0,       // the round telescope view is open
      aim: 'moon',    // where it's pointed: ship, moon, milky, jup, free
      found: 0,       // Adults: you found Jupiter yourself
      tag: '',        // ch11_04: which part of the Moon is labelled
      sweep: 0,       // the line between day and night moves across the Moon
      resolve: 0,     // ch11_05: the Milky Way breaks into stars (1), countless (2)
      day: -1,        // ch11_06: which of Galileo's nights
      orbits: 0,      // ch11_07: the moons' paths, seen from above
      open: 0,        // the wow: the telescope's circle opens and Jupiter fills the sky
      earth: 0,       // ch11_08: the Earth and its old circles
      venus: 0,       // the Venus model
      book: 0,        // ch11_09: 1 the Starry Messenger, 2 its pages fly out
      gloom: 0,       // trouble
      hatch: 0,       // the hatch closes behind him
      right: 0,       // ch11_10: he was right
      craft: 0,       // the Galileo spacecraft
      gmoons: 0,      // the Galilean moons named in the real sky
      journal: 0,
    };
    this.t = 0; this.jt = 0; this.aimDir = new THREE.Vector3(0, 0.3, -1).normalize();
    this.dirs = { ship: new THREE.Vector3(), moon: new THREE.Vector3(), milky: new THREE.Vector3(), jup: new THREE.Vector3(), sun: new THREE.Vector3() };
    this.life = new Life(this.root);
    this.buildVenice();
    this.buildBelfry();
    this.buildPadua();
    this.buildAltana();
    this.buildPeople();
    this.buildScope();
    this.buildVenus();
    this.buildBook();
    this.journal = new Journal(this, drawJournal);
    this.registerInteractables();
    this.setScene('venice');
    this.bellT = 5; this.gullT = 6; this.owlT = 20; this.dogT = 14; this.tapT = 2;
  }

  setScene(name) {
    const G = this.G; this.cur = name;
    this.A.visible = name === 'venice'; this.B.visible = name === 'padua';
    for (const it of this.life.items) if (it.scene) it.group.visible = it.scene === name;
    if (name === 'venice') {
      G.world.height = (x, z) => (Math.abs(x) < 5.4 && Math.abs(z) < 5.4 ? TOPA : 1.2);
      G.world.bounds = 4.4; G.world.blockers = [];
      G.sky.fogFar = 6000; G.sky.mist = 0;
      G.sky.setPlace({ lat: LAT, year: 1609, sunLon: SUNA });
    } else {
      G.world.height = (x, z) => (Math.abs(x) < 2.1 && Math.abs(z) < 2.1 ? TOPB : paduaHeight(x, z));
      G.world.bounds = 1.85; G.world.blockers = [{ x: -1.45, z: 1.3, r: 0.4 }, { x: -1.225, z: -1.4, r: 0.45 }];
      G.sky.fogFar = 22000; G.sky.mist = 0;
      G.sky.setPlace({ lat: LAT, year: 1610, sunLon: SUNB });
    }
    G.sky.hideMoon();
  }

  // ======================= 1. VENICE =======================
  buildVenice() {
    const A = this.A, k = new Kit(), far = new Kit(), r = rng(7), wins = [], lido = [];
    // the lagoon and the sea
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshPhongMaterial({ color: 0x1c3a4a, specular: 0xffd8a0, shininess: 40, emissive: 0x030a10 }));
    sea.rotation.x = -Math.PI / 2; A.add(sea);
    // the glitter path toward the low Sun
    this.glitTex = canvasTex(64, 512, (g, W, H) => { for (let i = 0; i < 1200; i++) { const y = Math.random() * H, x = W / 2 + (Math.random() - 0.5) * W * (0.1 + 0.9 * y / H); g.fillStyle = `rgba(255,${200 + Math.random() * 50},${120 + Math.random() * 80},${0.2 + Math.random() * 0.8})`; g.fillRect(x, y, 1 + Math.random() * 2, 1); } });
    this.glitTex.wrapT = THREE.RepeatWrapping;
    this.glitter = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ map: this.glitTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.glitter.rotation.x = -Math.PI / 2; this.glitter.position.y = 0.05; A.add(this.glitter);
    // the islands: a stretched height field, land at 1.2 m, water under it
    const SIZE = 5000, SEG = 220, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const stone = new THREE.Color(0x9a8c78), paving = new THREE.Color(0xc8bba2), canal = new THREE.Color(0x24404c);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.9) * (SIZE / 2) / r0 : 0; x *= kk; z *= kk;
      const land = veniceLand(x, z);
      p.setXYZ(i, x, land ? 1.2 : -1.5, z);
      c.copy(stone).lerp(paving, N1(x / 30, z / 30) * 0.5);
      if (x > -185 && x < 110 && z > -60 && z < 95) c.copy(paving);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); A.add(new THREE.Mesh(g, FLAT));
    // the canals (rii) through the city
    for (const [[ax, az], [bx, bz]] of RII) { const L = Math.hypot(bx - ax, bz - az); k.box(9, 0.05, L, canal.getHex(), [(ax + bx) / 2, 1.23, (az + bz) / 2], [0, Math.atan2(bx - ax, bz - az), 0]); }
    // the Piazza's white stone stripes
    for (let x = -170; x < 25; x += 12) k.box(0.4, 0.04, 80, 0xe8e0d0, [x, 1.23, -15]);
    for (let z = -40; z < 14; z += 12) k.box(195, 0.04, 0.4, 0xe8e0d0, [-72, 1.23, z]);
    // the Lido: a long low sandbar with pines, the open Adriatic beyond
    for (let z = -4000; z < 5000; z += 250) { k.box(380, 3, 255, 0x8a8a62, [LIDO(z) + 190, 0.5, z], [0, 0.2, 0]); for (let j = 0; j < 4; j++) { const tz = z + r() * 250, tx = LIDO(tz) + 60 + r() * 260, h = 8 + r() * 6; r(); if (j < 2) lido.push({ x: tx, y: 2, z: tz, s: h / 11 }); } }
    { const g = grove(conifer, lido, { type: 'pine', height: 11, detail: 'low', variants: 3, seed: 5 }); A.add(g.group); }   // the Lido's umbrella pines
    // ---- the Piazza's buildings ----
    const W = 0xe8dcc4;
    const facade = (tex, w, h, pos, yaw, rep) => { const t = tex(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: t })); m.position.set(...pos); m.rotation.y = yaw; A.add(m); };
    // Procuratie Vecchie (north side) and Nuove (south side), the Library on the Piazzetta
    k.box(185, 17, 12, W, [-80, 9.7, -49]); k.add(gableRoof(185, 12, 3, 0.3), 0x9a4a30, [-80, 18.2, -49]);
    facade(procTex, 185, 17, [-80, 9.7, -42.95], 0, 46);
    k.box(165, 19, 12, W, [-95, 10.7, 20]); k.add(gableRoof(165, 12, 3, 0.3), 0x9a4a30, [-95, 20.2, 20]);
    facade(procTex, 165, 19, [-95, 10.7, 13.95], Math.PI, 41);
    k.box(14, 16, 68, 0xefe6d2, [-22, 9.2, 54]); k.add(gableRoof(68, 14, 3, 0.3).rotateY(Math.PI / 2), 0x9a4a30, [-22, 17.2, 54]);
    facade(libTex, 68, 16, [-14.95, 9.2, 54], Math.PI / 2, 21);
    for (let i = 0; i < 22; i++) k.box(0.6, 2, 0.6, 0xf0e8d8, [-15.3, 18.2, 21 + i * 3.1]);   // statues along the top
    // San Geminiano at the far end
    k.box(14, 18, 20, 0xe8e0d0, [-185, 10, -15]); k.cyl(0.001, 4, 8, 4, 0x6a6a6a, [-185, 23, -15], [0, Math.PI / 4, 0]);
    // the Clock Tower, blue and gold, with its two bronze Moors on top
    k.box(10, 30, 10, 0xe8dcc4, [16, 16.2, -48]); k.box(10.4, 1, 10.4, 0xd8ccb0, [16, 31.5, -48]);
    k.box(1.2, 3, 1.2, 0x3a2a1a, [13.5, 33.5, -48]); k.box(1.2, 3, 1.2, 0x3a2a1a, [18.5, 33.5, -48]); k.ball(1.6, 1, 0x5a4a2a, [16, 34.5, -48]);
    const clock = canvasTex(256, 256, (cg) => { cg.fillStyle = '#1a2a6a'; cg.beginPath(); cg.arc(128, 128, 122, 0, 6.28); cg.fill(); cg.strokeStyle = '#e0b040'; cg.lineWidth = 10; cg.beginPath(); cg.arc(128, 128, 118, 0, 6.28); cg.stroke(); cg.fillStyle = '#e0b040'; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.28; cg.fillRect(128 + Math.cos(a) * 96 - 4, 128 + Math.sin(a) * 96 - 4, 8, 8); } for (let i = 0; i < 30; i++) { cg.fillRect(40 + Math.random() * 176, 40 + Math.random() * 176, 3, 3); } cg.beginPath(); cg.arc(128, 128, 24, 0, 6.28); cg.fill(); });
    const cm = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32), new THREE.MeshLambertMaterial({ map: clock, emissive: 0x111122 })); cm.position.set(16, 22, -42.9); A.add(cm);
    // the Basilica of San Marco: five great domes with lanterns, golden mosaics on the front
    const bx0 = 30, bx1 = 105, bz0 = -50, bz1 = 6, bcx = (bx0 + bx1) / 2, bcz = (bz0 + bz1) / 2;
    k.box(bx1 - bx0, 24, bz1 - bz0, 0xc8a888, [bcx, 13.2, bcz]);
    facade(basTex, 56, 26, [bx0 - 0.05, 14.2, bcz], -Math.PI / 2, 1);
    for (let i = 0; i < 5; i++) { const zz = bz0 + 5.6 + i * 11.2; k.cyl(0.001, 1.2, 4, 6, 0xe8dcc4, [bx0 - 0.4, 29.5, zz]); k.ball(0.4, 0, 0xe0b040, [bx0 - 0.4, 31.7, zz]); }
    for (const [dx, dz, R, H] of [[bcx, bcz, 11, 32], [bcx - 22, bcz, 9, 29], [bcx + 22, bcz, 9, 29], [bcx, bcz - 20, 8.5, 28], [bcx, bcz + 20, 8.5, 28]]) {
      k.cyl(R * 0.82, R * 0.82, 4, 16, 0xb8a080, [dx, H - 3, dz]);
      k.add(new THREE.SphereGeometry(R * 0.86, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a9098, [dx, H - 1, dz], 0, [1, 1.35, 1]);
      k.cyl(1.1, 1.1, 2.4, 8, 0x8a9098, [dx, H + R * 1.16, dz]); k.ball(1.3, 1, 0xa0a6ae, [dx, H + R * 1.16 + 2, dz], 0, [1, 1.4, 1]); k.box(0.2, 2.4, 0.2, 0xe0b040, [dx, H + R * 1.16 + 4.2, dz]); k.box(1.1, 0.2, 0.2, 0xe0b040, [dx, H + R * 1.16 + 4.6, dz]);
    }
    // the Doge's Palace: white arcades below, pink diamond-patterned walls above
    k.box(70, 24, 70, 0xe8c4b4, [70, 13.2, 50]);
    facade(dogeTex, 70, 24, [34.95, 13.2, 50], -Math.PI / 2, 18);
    facade(dogeTex, 70, 24, [70, 13.2, 85.05], 0, 18);
    for (let i = 0; i < 34; i++) { k.box(0.8, 1.6, 0.4, 0xf4ece0, [35.5 + i * 2.05, 26, 85.3]); k.box(0.4, 1.6, 0.8, 0xf4ece0, [34.7, 26, 15.5 + i * 2.05]); }
    k.add(gableRoof(70, 70, 5, 0.2), 0x8a5a48, [70, 25.2, 50]);
    // the two columns on the waterfront: the winged lion and St Theodore
    for (const [x, top] of [[-2, 0x6a7a5a], [24, 0xd8d0c0]]) { k.cyl(1, 1.1, 14, 10, 0xd8d0c8, [x, 8.2, 90]); k.box(2.6, 1.2, 2.6, 0xc8c0b0, [x, 15.8, 90]); k.box(1.4, 2.2, 3, top, [x, 17.5, 90]); }
    // the waterfront: mooring posts all along
    for (let x = -150; x < 600; x += 7) { if (x > -20 && x < 40) continue; k.cyl(0.18, 0.18, 3.4, 5, [0x3a5a8a, 0xe8e0d0, 0x8a3a2a][Math.floor(r() * 3)], [x, 1.2, 97 + r() * 2]); }
    // San Giorgio Maggiore across the basin: Palladio's white church, its dome, its bell tower
    const sgx = 330, sgz = 420;
    k.box(26, 20, 60, 0xe8e0d0, [sgx, 11, sgz]); k.add(gableRoof(60, 26, 7, 0.3).rotateY(Math.PI / 2), 0x9a5a40, [sgx, 21, sgz]);
    k.cyl(8, 8, 6, 14, 0xe0d8c8, [sgx, 24, sgz + 4]); k.add(new THREE.SphereGeometry(8.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x9a9aa0, [sgx, 27, sgz + 4]); k.cyl(1, 1, 4, 8, 0xe0d8c8, [sgx, 37, sgz + 4]);
    k.box(30, 26, 3, 0xf0ece0, [sgx, 14, sgz - 31]); k.add(gableWall(30, 7, 3), 0xf0ece0, [sgx, 27, sgz - 31]);
    k.box(8, 60, 8, 0xc8907a, [sgx + 22, 31, sgz + 30]); k.cyl(0.001, 4, 12, 8, 0x6a8a7a, [sgx + 22, 67, sgz + 30]);
    for (let i = 0; i < 10; i++) house(k, { x: sgx - 40 + (i % 5) * 16, y: 1.2, z: sgz + 40 + Math.floor(i / 5) * 14, w: 14, d: 10, h: 9, yaw: 0, wall: 0xd8c8a8, roofCol: 0x9a4a30 }, wins, r, true);
    // Il Redentore on the Giudecca: a dome and two little towers
    const rx = -520, rz = 410;
    k.box(20, 18, 46, 0xf0ece0, [rx, 10, rz]); k.cyl(7, 7, 5, 14, 0xf0ece0, [rx, 21, rz + 6]); k.add(new THREE.SphereGeometry(7.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x9a9aa0, [rx, 23.5, rz + 6]);
    for (const s of [-1, 1]) k.cyl(1.2, 1.2, 12, 8, 0xf0ece0, [rx + s * 8, 22, rz + 14]);
    // ---- the town: tall stuccoed houses, red tiled roofs, funnel chimneys ----
    const WALLS = [0xe0c8a0, 0xd89a78, 0xc8705a, 0xe8dcc8, 0xd8b880, 0xb85a48, 0xe0b0a0, 0xd8c0a8];
    const ROOFS = [0xa84a30, 0x9a4028, 0xb85a3a, 0x8a3a28];
    const free = (x, z, h) => veniceLand(x, z) && veniceLand(x + h, z + h) && veniceLand(x - h, z - h) && veniceLand(x + h, z - h) && veniceLand(x - h, z + h) && !canalAt(x, z) && !(x > -190 && x < 112 && z > -62 && z < 100) && Math.hypot(x, z) > 9;
    for (let gx = -900; gx <= 900; gx += 13) for (let gz = -900; gz <= 470; gz += 13) {
      const d = Math.hypot(gx, gz); if (d > 1000) continue;
      if (Math.abs(gx % 39) < 1 || r() < 0.08) continue;   // lanes
      const near = d < 300; if (!near && (Math.abs(gx) % 26 > 1 || Math.abs(gz) % 26 > 1)) continue;
      const x = gx + (r() - 0.5) * 2, z = gz + (r() - 0.5) * 2, w = near ? 10 + r() * 3 : 22, dd = near ? 10 + r() * 2 : 22;
      if (!free(x, z, w / 2)) continue;
      house(near ? k : far, { x, y: 1.2, z, w, d: dd, shut: d < 170, h: 9 + r() * 9, yaw: Math.floor(r() * 4) * Math.PI / 2, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: ROOFS[Math.floor(r() * ROOFS.length)] }, wins, r, near);
    }
    // bell towers rising out of the roofs here and there
    for (const [x, z, h] of [[-330, -260, 50], [160, -220, 46], [-620, 200, 40], [480, -60, 44], [-120, -520, 48], [700, -400, 42]]) { k.box(6, h, 6, 0xb86a50, [x, 1.2 + h / 2, z]); k.box(6.6, 4, 6.6, 0xe8e0d0, [x, h - 1, z]); k.cyl(0.001, 3.6, 9, 4, 0x6a8a7a, [x, h + 5.5, z], [0, Math.PI / 4, 0]); }
    A.add(k.mesh()); if (far.parts.length) A.add(far.mesh());
    A.add(panes(wins, { lit: 0.12, seed: 4, glint: true }));
    // ---- boats: anchored ships in the basin, the ship far out at sea, gondolas ----
    this.boats = [];
    for (const [x, z, yaw, s] of [[160, 220, 0.4, 1], [60, 300, -0.2, 0.9], [-80, 240, 1.3, 1.1], [420, 180, 0.9, 0.8], [600, 300, -0.5, 1], [-300, 250, 0.2, 0.7]]) { const b = ship(s); b.position.set(x, 0, z); b.rotation.y = yaw; b.userData.ph = r() * 6; A.add(b); this.boats.push(b); }
    this.farShip = ship(1.1); this.farShip.position.copy(SHIP); this.farShip.rotation.y = 0.9; this.farShip.userData.ph = 1; A.add(this.farShip); this.boats.push(this.farShip);
    this.gondolas = [];
    for (let i = 0; i < 9; i++) {
      const gk = new Kit(); gk.box(1.3, 0.45, 10, 0x0a0a0c, [0, 0.35, 0]); gk.box(1.0, 0.5, 2, 0x0a0a0c, [0, 0.75, 4.8], [-0.5, 0, 0]); gk.box(1.0, 0.5, 2, 0x0a0a0c, [0, 0.7, -4.8], [0.4, 0, 0]); gk.box(0.08, 0.7, 0.5, 0xd8d8d8, [0, 1.2, 5.6]);
      gk.box(0.9, 0.5, 1.4, 0x6a1a1a, [0, 0.75, 0.5]);   // a little cabin seat
      const gm = gk.mesh(); const P = makePerson({ seed: 40 + i, tunic: [0x1a1a1a, 0xe8e0d0, 0x2a3a5a][i % 3], hair: 0x2a1a10 }); P.g.position.set(0, 0.55, -3.6); P.pose = 'pull'; gm.add(P.g); gm.userData.P = P;
      const path = i < 5 ? { cx: 120 + i * 90, cz: 180, rx: 160 + i * 30, rz: 60 + i * 15 } : { cx: -260 - (i - 5) * 30, cz: 40 - (i - 5) * 80, rx: 30, rz: 70 };
      gm.userData.path = path; gm.userData.a = r() * 6.28; gm.userData.v = (0.02 + r() * 0.02) * (i % 2 ? 1 : -1);
      A.add(gm); this.gondolas.push(gm);
    }
    // flags on the Piazza's three tall masts
    this.flags = [];
    for (let i = 0; i < 3; i++) { const fx = 22, fz = -38 + i * 12; const mk = new Kit(); mk.cyl(0.15, 0.25, 22, 6, 0x6a4a2a, [fx, 12.2, fz]); A.add(mk.mesh()); const f = this.life.add(makeCloth(7, 4, { color: 0xb02a20, wind: 1.4 })); f.scene = 'venice'; f.group.position.set(fx, 19, fz); f.group.rotation.y = -Math.PI / 2 + 0.3; this.flags.push(f); }
    // pigeons over the Piazza, gulls over the water, people in the square
    const pg = this.life.add(makeFlock({ n: 24, center: new THREE.Vector3(-60, 12, -15), r: 50, height: 8, color: 0x8a8a92, size: 0.5, seed: 4, speed: 8 })); pg.scene = 'venice'; this.pigeons = pg;
    const gl = this.life.add(makeFlock({ n: 12, center: new THREE.Vector3(80, 30, 200), r: 120, height: 14, color: 0xe8ecef, size: 1.2, seed: 9, speed: 7 })); gl.scene = 'venice';
    const gl2 = this.life.add(makeFlock({ n: 6, center: new THREE.Vector3(30, TOPA + 8, 30), r: 30, height: 6, color: 0xe8ecef, size: 1.1, seed: 12, speed: 6 })); gl2.scene = 'venice';
    for (const sm of [[-300, 24, -200], [150, 22, -150], [-500, 20, 220], [400, 20, -300]]) { const s = this.life.add(makeSmoke(new THREE.Vector3(...sm), { n: 6, rise: 12, size: 2, opacity: 0.12, color: 0xc0b8b0 })); s.scene = 'venice'; }
    this.crowd = [];
    for (let i = 0; i < 16; i++) {
      const x = -150 + r() * 160, z = -35 + r() * 45, P = makePerson({ seed: 60 + i, tunic: [0x5a2a2a, 0x2a2a3a, 0x6a5a3a, 0x1a1a1a, 0xa82a20, 0x3a4a2a][i % 6], hair: 0x2a1a10, height: 1.6 + r() * 0.2 });
      P.g.position.set(x, 1.2, z); A.add(P.g);
      P.routine = [{ x: x + (r() - 0.5) * 40, z: clamp(z + (r() - 0.5) * 30, -38, 8), pose: r() < 0.5 ? 'talk' : 'idle', secs: 4 + r() * 6 }, { x: x + (r() - 0.5) * 40, z: clamp(z + (r() - 0.5) * 30, -38, 8), pose: 'idle', secs: 3 + r() * 5 }];
      this.crowd.push(P);
    }
  }

  // The belfry: four corner piers, white arches with balustrades, the bells hanging overhead,
  // the brick shaft below, the attic and the green pyramid spire above
  buildBelfry() {
    const k = new Kit(), B = 0xa85a40, M = 0xf0ece4, Y = TOPA;
    // the brick shaft, its pilaster strips joined at the top by round arches (as on the real tower)
    k.box(12, Y - 0.6, 12, B, [0, (Y - 0.6) / 2, 0]);
    const ST = [-4.5, -1.5, 1.5, 4.5];
    for (const s of [-1, 1]) for (const x of ST) { k.box(0.8, Y - 3.2, 0.4, 0x9a4a32, [x, (Y - 3.2) / 2, s * 6.2]); k.box(0.4, Y - 3.2, 0.8, 0x9a4a32, [s * 6.2, (Y - 3.2) / 2, x]); }
    for (let side = 0; side < 4; side++) {
      const yaw = side * Math.PI / 2, c = Math.cos(yaw), s = Math.sin(yaw);
      const P = (lx, ly, lz) => [lx * c + lz * s, ly, -lx * s + lz * c];
      for (let i = 0; i < 3; i++) k.add(new THREE.TorusGeometry(1.1, 0.2, 4, 12, Math.PI), 0x9a4a32, P((ST[i] + ST[i + 1]) / 2, Y - 3.2, 6.2), [0, yaw, 0], [1, 1, 1]);
      k.box(12.2, 0.5, 0.3, 0x9a4a32, P(0, Y - 1.35, 6.15), [0, yaw, 0]);            // a brick band under the cornice
      for (let i = 0; i < 30; i++) k.box(0.16, 0.16, 0.2, 0xe8e0d0, P(-5.8 + i * 0.4, Y - 0.95, 6.3), [0, yaw, 0]);   // dentils
    }
    // the white stone cornice the belfry stands on (its top a few cm under the floor: nothing flickers)
    k.box(12.6, 0.5, 12.6, M, [0, Y - 0.35, 0]);
    k.box(12.9, 0.12, 12.9, M, [0, Y - 0.16, 0]);
    // ONE wooden plank floor: boards of slightly different shades, staggered butt joints, thin dark
    // seams between them over a dark underlay; every board's top is at the floor, nothing overlaps
    k.box(11.6, 0.03, 11.6, 0x2a1e14, [0, Y - 0.065, 0]);
    { const fr = rng(31), PW = 0.235, GAP = 0.012, X0 = -5.8, X1 = 5.8;
      for (let z = -5.8; z < 5.8 - 0.05; z += PW) {
        const w = Math.min(PW - GAP, 5.8 - z - GAP); let x = X0 + fr() * 0.2;
        if (x > X0) { const L0 = x - X0 - GAP; if (L0 > 0.05) k.box(L0, 0.05, w, 0x7a5a3a, [X0 + L0 / 2, Y - 0.025, z + w / 2 + GAP / 2]); }
        while (x < X1 - 0.05) {
          const L = Math.min(1.6 + fr() * 2.4, X1 - x), sh = 0.82 + fr() * 0.3, tone = [0x8a6a48, 0x7e6040, 0x947250, 0x86664a][Math.floor(fr() * 4)];
          k.add(new THREE.BoxGeometry(L - GAP, 0.05, w), tone, [x + L / 2, Y - 0.025, z + w / 2 + GAP / 2], 0, 1, sh);
          x += L;
        }
      }
    }
    // the corner piers: stone, with a moulded base and an impost where the arches spring
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.box(1.3, 6.4, 1.3, 0xcfc8b8, [sx * 5.35, Y + 3.2, sz * 5.35]);
      k.box(1.5, 0.3, 1.5, 0xe0dace, [sx * 5.35, Y + 0.15, sz * 5.35]); k.box(1.42, 0.1, 1.42, M, [sx * 5.35, Y + 0.35, sz * 5.35]);
      k.box(1.46, 0.14, 1.46, M, [sx * 5.35, Y + 4.58, sz * 5.35]); k.box(1.38, 0.08, 1.38, 0xe0dace, [sx * 5.35, Y + 4.47, sz * 5.35]);
    }
    // a baluster: a turned stone vase (a lathe shape)
    const balG = new THREE.LatheGeometry([[0, 0], [0.085, 0], [0.085, 0.06], [0.06, 0.1], [0.1, 0.3], [0.09, 0.42], [0.05, 0.58], [0.045, 0.62], [0.075, 0.66], [0.075, 0.72], [0, 0.72]].map(([x, y]) => new THREE.Vector2(x, y)), 7);
    const COLX = [-2.475, 0, 2.475], ARCX = [-3.5875, -1.2375, 1.2375, 3.5875];
    for (let side = 0; side < 4; side++) {
      const yaw = side * Math.PI / 2, c = Math.cos(yaw), s = Math.sin(yaw);
      const P = (lx, ly, lz) => [lx * c + lz * s, ly, -lx * s + lz * c];
      // columns with a moulded base and a capital
      for (const x of COLX) {
        k.cyl(0.23, 0.27, 4.1, 12, M, P(x, Y + 2.25, 5.6));
        k.box(0.62, 0.14, 0.62, 0xe0dace, P(x, Y + 0.07, 5.6), [0, yaw, 0]); k.cyl(0.3, 0.33, 0.12, 12, M, P(x, Y + 0.2, 5.6)); k.cyl(0.27, 0.3, 0.06, 12, M, P(x, Y + 0.29, 5.6));
        k.cyl(0.34, 0.24, 0.24, 12, M, P(x, Y + 4.24, 5.6)); k.cyl(0.26, 0.26, 0.05, 12, 0xe0dace, P(x, Y + 4.1, 5.6));
        k.box(0.66, 0.18, 0.66, M, P(x, Y + 4.45, 5.6), [0, yaw, 0]); k.box(0.72, 0.06, 0.72, 0xe0dace, P(x, Y + 4.57, 5.6), [0, yaw, 0]);
      }
      // the arches, and the stone between them (spandrels) filled in up to the cornice
      for (const x0 of ARCX) { k.add(new THREE.TorusGeometry(0.98, 0.17, 6, 14, Math.PI), M, P(x0, Y + 4.65, 5.6), [0, yaw, 0], [1, 0.95, 2]); k.box(0.22, 0.3, 0.42, 0xe0dace, P(x0, Y + 5.62, 5.6), [0, yaw, 0]); }
      const sp = new THREE.Shape(), R0 = 0.86; sp.moveTo(-4.72, 0);
      for (const x0 of ARCX) { sp.lineTo(x0 - R0, 0); sp.absarc(x0, 0, R0, Math.PI, 0, true); }
      sp.lineTo(4.72, 0); sp.lineTo(4.72, 0.95); sp.lineTo(-4.72, 0.95); sp.closePath();
      const sg = new THREE.ExtrudeGeometry(sp, { depth: 0.3, bevelEnabled: false, curveSegments: 8 }); sg.translate(0, 0, -0.15);
      k.add(sg, 0xe6e0d4, P(0, Y + 4.65, 5.6), [0, yaw, 0]);
      // the balustrade: a plinth, turned balusters, a moulded handrail, between the columns
      k.box(9.4, 0.12, 0.42, 0xe0dace, P(0, Y + 0.06, 5.6), [0, yaw, 0]);
      k.box(9.4, 0.12, 0.5, M, P(0, Y + 0.97, 5.6), [0, yaw, 0]); k.box(9.4, 0.07, 0.4, 0xe0dace, P(0, Y + 0.88, 5.6), [0, yaw, 0]);
      for (let x = -4.5; x <= 4.51; x += 0.3) { if (COLX.some((cx) => Math.abs(x - cx) < 0.36)) continue; k.add(balG.clone(), M, P(x, Y + 0.12, 5.6)); }
      k.box(side % 2 ? 10.8 : 12.4, 1.2, 0.8, M, P(0, Y + 6.1, 5.8), [0, yaw, 0]);
      k.box(side % 2 ? 10.8 : 12.4, 0.16, 0.95, 0xe0dace, P(0, Y + 5.55, 5.8), [0, yaw, 0]);
      k.box(11, 6.5, 0.6, 0xc87a5a, P(0, Y + 9.9, 5.4), [0, yaw, 0]);
      // the attic: a stone frame, a round window, pilasters at the corners
      k.box(5.2, 0.3, 0.2, M, P(0, Y + 12.1, 5.75), [0, yaw, 0]); k.box(5.2, 0.3, 0.2, M, P(0, Y + 7.6, 5.75), [0, yaw, 0]);
      for (const sx of [-1, 1]) k.box(0.3, 4.8, 0.2, M, P(sx * 2.45, Y + 9.85, 5.75), [0, yaw, 0]);
      k.add(new THREE.TorusGeometry(0.75, 0.13, 6, 16), M, P(0, Y + 9.85, 5.8), [0, yaw, 0]);
      k.cyl(0.7, 0.7, 0.1, 16, 0x2a2420, P(0, Y + 9.85, 5.72), [Math.PI / 2, yaw, 0]);
      for (const sx of [-1, 1]) k.box(0.7, 6.5, 0.2, 0xb86a4a, P(sx * 5.2, Y + 9.9, 5.75), [0, yaw, 0]);
    }
    // the ceiling: joists under the attic floor
    k.box(11.6, 0.3, 11.6, 0x5a4232, [0, Y + 5.8, 0]);
    for (let i = 0; i < 9; i++) k.box(0.2, 0.26, 11.4, 0x4a3426, [-4.8 + i * 1.2, Y + 5.52, 0]);
    k.box(12.4, 1, 12.4, M, [0, Y + 13.4, 0]); k.box(12.8, 0.25, 12.8, 0xe0dace, [0, Y + 13.95, 0]);
    k.cyl(0.001, 8.4, 24, 4, 0x6a9a84, [0, Y + 25.9, 0], [0, Math.PI / 4, 0]);
    // the golden angel on the tip: a robe, wings, a head
    k.cyl(0.25, 0.6, 1.8, 6, 0xe0b040, [0, Y + 38.8, 0]); k.ball(0.28, 0, 0xe0b040, [0, Y + 40, 0]);
    for (const sx of [-1, 1]) k.box(0.1, 1.6, 0.7, 0xe8c050, [sx * 0.45, Y + 39.6, -0.2], [0.3, 0, sx * 0.35]);
    // the bells' oak frame: two beams hung from the ceiling joists by iron straps, so nothing stands
    // in the way of the view through the arches
    k.box(9, 0.5, 0.5, 0x4a3422, [0, Y + 4.8, -1.2]); k.box(9, 0.5, 0.5, 0x4a3422, [0, Y + 4.8, 1.2]);
    for (let i = 0; i < 9; i++) for (const sz of [-1, 1]) { const x = -4.8 + i * 1.2; if (Math.abs(x) > 4.5) continue; k.box(0.22, 0.36, 0.56, 0x2a2a2e, [x, Y + 5.2, sz * 1.2]); }
    this.A.add(k.mesh());
    const prof = [[0.02, 0], [0.32, 0], [0.42, -0.15], [0.48, -0.6], [0.62, -1.05], [0.78, -1.2], [0.8, -1.28], [0.02, -1.28]].map(([x, y]) => new THREE.Vector2(x, y));
    const bellGeo = new THREE.LatheGeometry(prof, 20), bellMat = new THREE.MeshStandardMaterial({ color: 0x9a7a40, metalness: 0.7, roughness: 0.4, side: THREE.DoubleSide });
    this.bells = [];
    for (const [x, z, s] of [[-2.6, -1.2, 1.15], [0.2, -1.2, 1.0], [2.8, -1.2, 0.85], [-1.6, 1.2, 0.75], [1.4, 1.2, 0.65]]) {
      const b = new THREE.Group(); b.position.set(x, Y + 4.55, z); const m = new THREE.Mesh(bellGeo, bellMat); m.scale.setScalar(s); b.add(m);
      const cl = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 8, 6), bellMat); cl.position.y = -1.15 * s; b.add(cl);
      // its wooden headstock (yoke) with iron straps, up to the frame
      const yk = new Kit(); yk.box(0.6 * s + 0.3, 0.26, 0.36, 0x3e2c1c, [0, 0.12, 0]); for (const sx of [-1, 1]) yk.box(0.06, 0.32, 0.4, 0x2a2a2e, [sx * 0.2 * s, 0.06, 0]);
      b.add(yk.mesh());
      this.A.add(b); this.bells.push({ g: b, s, a: 0, v: 0 });
    }
    // the floating lens demo (ch11_01): two lenses come together in a tube
    const D = this.lensDemo = new THREE.Group(); D.visible = false; this.root.add(D);
    const glass = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.lenses = [0, 1].map((i) => { const l = new THREE.Group(); const m = new THREE.Mesh(new THREE.SphereGeometry(0.09 - i * 0.03, 20, 10), glass.clone()); m.scale.z = 0.25; l.add(m, glow(0xbfe0ff, 0.3, 0.7)); D.add(l); return l; });
    const tk = new Kit(); tk.cyl(0.05, 0.065, 0.8, 14, 0x6a3a22, [0, 0, 0], [Math.PI / 2, 0, 0]); tk.cyl(0.07, 0.07, 0.04, 14, 0xc09a50, [0, 0, -0.38], [Math.PI / 2, 0, 0]); tk.cyl(0.055, 0.055, 0.04, 14, 0xc09a50, [0, 0, 0.38], [Math.PI / 2, 0, 0]);
    this.demoTube = tk.mesh(); this.demoTube.material = FLAT.clone(); this.demoTube.material.transparent = true; D.add(this.demoTube);
    this.demoRays = glowPoints(80, { sizeScale: 200 }); D.add(this.demoRays);
    this.demoLab = label('two lenses, one tube', 0.07); this.demoLab.position.y = 0.2; D.add(this.demoLab);
  }

  // ======================= 2. PADUA =======================
  buildPadua() {
    const Bg = this.B, k = new Kit(), far = new Kit(), r = rng(19), wins = [];
    // ground: streets and gardens near, fields and the plain far away (stretched)
    const SIZE = 44000, SEG = 200, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color(), street = new THREE.Color(0x5a564e), field = new THREE.Color(0x2e3a26), garden = new THREE.Color(0x34462a);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 2.6) * (SIZE / 2) / r0 : 0; x *= kk; z *= kk;
      p.setXYZ(i, x, paduaHeight(x, z), z);
      c.copy(Math.hypot(x, z) < 950 ? street : field).lerp(garden, N1(x / 40, z / 40) * (Math.hypot(x, z) < 950 ? 0.35 : 0.8));
      if (x > -16 && x < 16 && z > -44 && z < -6) c.copy(garden);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); Bg.add(new THREE.Mesh(g, FLAT));
    // the canal (the Naviglio) north of the garden, with a stone bridge
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1800, 14), new THREE.MeshPhongMaterial({ color: 0x0a1620, specular: 0x8899bb, shininess: 70 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -0.3, -62); Bg.add(water);
    for (const s of [-1, 1]) k.box(1800, 1.2, 1.5, 0x6a6458, [0, -0.2, -62 + s * 7.6]);
    k.box(6, 0.8, 18, 0x8a8070, [24, 0.9, -62]); for (const s of [-1, 1]) k.box(0.4, 0.8, 18, 0x8a8070, [24 + s * 2.8, 1.6, -62]);
    // ---- the city: houses with porticoes on the streets, lit windows ----
    const WALLS = [0xd8c0a0, 0xc89a78, 0xb8705a, 0xe0d4bc, 0xc8a878, 0xa86a50, 0xd8b0a0];
    const ROOFS = [0x8a3a28, 0x9a4028, 0x7a3424, 0x8a4a34];
    // our street (Borgo dei Vignali) south of the house: rows of houses both sides
    for (const side of [-1, 1]) for (let x = -70; x < 80;) {
      const w = 7 + r() * 5;
      if (side < 0 && x + w > -9 && x < 9) { x = 9; continue; }
      const zz = side < 0 ? 1 - 4.5 : 22 + 5;
      house(k, { x: x + w / 2, y: 0, z: zz, w, d: 9, h: 8 + r() * 5, yaw: side < 0 ? 0 : Math.PI, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: ROOFS[Math.floor(r() * ROOFS.length)], portico: side > 0, shut: true, tiles: true }, wins, r, true);
      x += w + 0.2;
    }
    for (let gx = -900; gx <= 900; gx += 15) for (let gz = -900; gz <= 900; gz += 15) {
      const d = Math.hypot(gx, gz); if (d > 880 || d < 30) continue;
      if (gz > -14 && gz < 36 && Math.abs(gx) < 90) continue;
      if (gz > -75 && gz < -48) continue;                                   // the canal
      if (Math.hypot(gx - 262, gz - 183) < 85 || Math.hypot(gx + 520, gz + 340) < 55 || Math.hypot(gx + 610, gz + 500) < 50) continue;   // the Santo, the Palazzo, the Duomo
      if (gx > -24 && gx < 24 && gz > -54 && gz < -4) continue;            // Galileo's garden (houses used to poke through its walls)
      if (Math.abs(gx % 60) < 2 || Math.abs(gz % 75) < 2 || r() < 0.1) continue;
      const near = d < 280; if (!near && r() < 0.6) continue;
      const x = gx + (r() - 0.5) * 2, z = gz + (r() - 0.5) * 2;
      house(near ? k : far, { x, y: 0, z, shut: d < 150, tiles: d < 70, w: 10 + r() * 4, d: 10 + r() * 3, h: 7 + r() * 8, yaw: Math.floor(r() * 4) * Math.PI / 2, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: ROOFS[Math.floor(r() * ROOFS.length)] }, wins, r, near);
    }
    // the Basilica of St Anthony (Il Santo): a brick church crowned with domes, a cone and minarets
    const sx = 262, sz = 183, B = 0x9a5a40;
    k.box(110, 26, 50, B, [sx, 13, sz]); k.add(gableWall(50, 14, 1), B, [sx - 55.5, 26, sz], [0, Math.PI / 2, 0]);
    k.box(1.2, 16, 30, 0x8a4a34, [sx - 55.6, 9, sz]);
    for (let i = 0; i < 5; i++) k.box(1, 9, 3.2, 0x3a2018, [sx - 55.8, 7, sz - 12 + i * 6]);
    for (const [dx, dz, R] of [[-35, 0, 10], [-12, 0, 10], [20, 0, 10], [20, -22, 8], [20, 22, 8], [42, 0, 9]]) {
      k.cyl(R * 0.9, R * 0.9, 4, 14, 0x9a6a50, [sx + dx, 28, sz + dz]);
      k.add(new THREE.SphereGeometry(R, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a8e94, [sx + dx, 30, sz + dz]);
      k.cyl(1.2, 1.2, 3, 8, 0x8a8e94, [sx + dx, 30 + R + 1.4, sz + dz]); k.ball(1.4, 1, 0x9aa0a6, [sx + dx, 30 + R + 3.4, sz + dz], 0, [1, 1.4, 1]);
    }
    k.cyl(10, 11, 6, 16, 0x9a6a50, [sx + 4, 30, sz]); k.cyl(0.001, 10.5, 26, 16, 0x8a8e94, [sx + 4, 46, sz]); k.ball(1.4, 1, 0xd8b040, [sx + 4, 60, sz]);
    for (const s of [-1, 1]) { const tx = sx + 48, tz = sz + s * 19; k.cyl(2, 2.3, 50, 10, 0xb06a50, [tx, 25, tz]); for (let j = 0; j < 3; j++) k.cyl(2.6, 2.6, 1, 10, 0xd8ccb8, [tx, 18 + j * 14, tz]); k.cyl(1.8, 1.8, 6, 10, 0xd8ccb8, [tx, 53, tz]); k.cyl(0.001, 2.2, 10, 10, 0x8a8e94, [tx, 61, tz]); }
    for (let i = 0; i < 8; i++) k.cyl(0.001, 1.1, 6, 6, 0xb06a50, [sx - 55 + (i % 2) * 2, 29 + Math.floor(i / 2) * 0.5, sz - 21 + i * 6]);
    for (let i = 0; i < 14; i++) wins.push({ p: new THREE.Vector3(sx - 40 + i * 7, 14, sz - 25.05), yaw: Math.PI, big: true });
    // the Palazzo della Ragione: the great hall with its ship-keel roof
    const px = -520, pz = -340;
    k.box(80, 20, 28, 0xd8c8a8, [px, 10, pz]);
    k.add(new THREE.CylinderGeometry(14.5, 14.5, 82, 20, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(0), 0x5a5e66, [px, 20, pz], 0, [1, 0.9, 1]);
    for (let i = 0; i < 18; i++) for (const s of [-1, 1]) k.box(2.2, 4.4, 0.3, 0x2a2018, [px - 38 + i * 4.4, 4 + (i % 2) * 0, pz + s * 14.1]);
    // the Duomo and its baptistery, a castle tower, the city walls
    k.box(30, 22, 70, 0xc8b090, [-610, 11, -500]); k.cyl(9, 9, 6, 14, 0xc8b090, [-610, 25, -490]); k.add(new THREE.SphereGeometry(9, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a8e94, [-610, 28, -490]);
    k.box(12, 40, 12, 0x9a6a50, [-380, 20, 600]); for (let i = 0; i < 8; i++) k.box(2, 2, 2, 0x9a6a50, [-385 + (i % 4) * 3.3, 41, 594 + Math.floor(i / 4) * 12]);
    for (let a = 0; a < 64; a++) { const an = a / 64 * Math.PI * 2, R = 1000; if (a % 9 === 0) { k.box(16, 22, 16, 0x8a5a44, [Math.cos(an) * R, 11, Math.sin(an) * R], [0, -an, 0]); continue; } far.box(100, 12, 6, 0x8a5a44, [Math.cos(an) * R, 6, Math.sin(an) * R], [0, -an + Math.PI / 2, 0]); }
    // the Euganean Hills on the south-west horizon
    for (let i = 0; i < 12; i++) { const a = 200 + i * 6 + r() * 4, d = 11000 + r() * 6000; const q = at(a, d); far.ball(1400 + r() * 1400, 2, 0x10161a, [q.x, -200, q.z], 0, [1, 0.3 + r() * 0.15, 1]); }
    // a few bell towers among the roofs
    for (const [x, z, h] of [[-180, 140, 38], [120, -260, 34], [-300, -120, 36], [400, -200, 32], [-60, 380, 34]]) { k.box(5, h, 5, 0xa8604a, [x, h / 2, z]); k.box(5.6, 3, 5.6, 0xd8ccb8, [x, h - 1.5, z]); k.cyl(0.001, 3.2, 8, 4, 0x6a4a3a, [x, h + 4, z], [0, Math.PI / 4, 0]); }
    Bg.add(k.mesh()); Bg.add(far.mesh());
    this.paduaWins = panes(wins, { lit: 0.42, seed: 11 }); Bg.add(this.paduaWins);
    // smoke from chimneys, bats round the roofs, a dog in the garden, horses in a stable yard
    for (const sm of [[30, 16, 30], [-40, 15, -30], [70, 15, -10], [-80, 17, 40], [10, 14, -90]]) { const s = this.life.add(makeSmoke(new THREE.Vector3(...sm), { n: 6, rise: 9, size: 1.4, opacity: 0.1, color: 0x8a90a0 })); s.scene = 'padua'; }
    const bats = this.life.add(makeFlock({ n: 9, center: new THREE.Vector3(-4, TOPB + 7, -10), r: 16, height: 6, color: 0x0a0a0c, size: 0.35, seed: 3, speed: 9 })); bats.scene = 'padua';
    this.dog = this.life.add(makeHerd('dog', { n: 1, area: { x: 3, z: -22, r: 5 }, height: paduaHeight, seed: 6 })); this.dog.scene = 'padua';
    const hs = this.life.add(makeHerd('horse', { n: 2, area: { x: 40, z: -30, r: 6 }, height: paduaHeight, seed: 8 })); hs.scene = 'padua';
  }

  // Galileo's house and garden, and the altana on its roof where we stand
  buildAltana() {
    const k = new Kit(), Bg = this.B, WOOD = 0x6a4a30, DARK = 0x3a2818, Y = TOPB, wins = [], lemons = [];
    // the house: three floors, a low tiled roof just under the altana
    k.box(14, Y - 2.6, 11, 0xd8b890, [0, (Y - 2.6) / 2, 0]);
    k.add(gableRoof(14, 11, 2.0, 0.4), 0x8a3a28, [0, Y - 2.6, 0]);
    coppi(k, (x, y, z) => [x, Y - 2.6 + y, z], 14, 11, 2.0, 0.4, 0, 0x8a3a28, 0.32);
    // the house front: a stone cornice under the eaves, a string course, the door in a stone frame, shutters
    k.box(14.3, 0.3, 11.3, 0xe8dcc0, [0, Y - 2.75, 0]); for (const f of [1, 2]) k.box(14.1, 0.12, 11.1, 0xe0d0b0, [0, f * 3 + 0.25, 0]);
    k.box(1.8, 3.0, 0.12, 0xd8ccb0, [-3, 1.5, 5.52]); k.box(2.0, 0.25, 0.2, 0xe0d4b8, [-3, 3.1, 5.56]);
    for (let f = 0; f < 3; f++) for (let i = 0; i < 5; i++) for (const sz of [-1, 1]) { if (f === 0 && i === 1 && sz > 0) continue; for (const sx of [-1, 1]) k.box(0.36, 1.15, 0.05, 0x3a5a40, [-5.6 + i * 2.8 + sx * 0.56, 1.8 + f * 3, sz * 5.56]); k.box(0.9, 0.08, 0.14, 0xe0d4b8, [-5.6 + i * 2.8, 1.8 + f * 3 - 0.62, sz * 5.55]); }
    for (const sx of [-1, 1]) k.add(gableWall(11, 2.0, 0.2), 0xd8b890, [sx * 6.9, Y - 2.6, 0], [0, Math.PI / 2, 0]);
    for (let f = 0; f < 3; f++) for (let i = 0; i < 5; i++) { wins.push({ p: new THREE.Vector3(-5.6 + i * 2.8, 1.8 + f * 3, 5.53), yaw: 0 }); wins.push({ p: new THREE.Vector3(-5.6 + i * 2.8, 1.8 + f * 3, -5.53), yaw: Math.PI }); }
    k.box(1.4, 2.6, 0.1, 0x3a2416, [-3, 1.3, 5.55]);
    for (const [x, z] of [[4, 3], [-5, -3]]) { k.cyl(0.25, 0.25, 3, 6, 0xb09080, [x, Y, z]); k.cyl(0.6, 0.22, 0.8, 8, 0x8a5a48, [x, Y + 1.8, z]); }
    // the altana: posts and joists down to the roof, ONE plank floor (with a real opening for the
    // stair hatch), a fascia round the edge, a turned railing with corner posts and finials
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.16, 2.6, 0.16, DARK, [sx * 2.05, Y - 1.3, sz * 2.05]);
    for (const x of [-1.2, 0, 1.2]) k.box(0.12, 0.16, 4.2, DARK, [x, Y - 0.16, 0]);
    for (const sz of [-1, 1]) { k.box(4.42, 0.16, 0.05, 0x5a3e28, [0, Y - 0.1, sz * 2.19]); k.box(0.05, 0.16, 4.42, 0x5a3e28, [sz * 2.19, Y - 0.1, 0]); }
    { const fr = rng(41); const HZ0 = -1.9, HZ1 = -0.9;
      for (let i = 0; i < 9; i++) {
        const x = -1.96 + i * 0.49, tone = [0x7a5a3a, 0x6e5034, 0x765638, 0x6a4c30][Math.floor(fr() * 4)];
        // two boards end to end in each row (a butt joint somewhere along), or around the hatch opening
        const segs = (i === 1 || i === 2) ? [[-2.16, HZ0], [HZ1, 2.16]] : (() => { const j = -1.2 + fr() * 2.4; return [[-2.16, j - 0.006], [j + 0.006, 2.16]]; })();
        for (const [z0, z1] of segs) k.add(new THREE.BoxGeometry(0.46, 0.06, z1 - z0), tone, [x, Y - 0.03, (z0 + z1) / 2], 0, 1, 0.9 + fr() * 0.2);
        for (const [z0, z1] of segs) for (const zz of [z0 + 0.1, z1 - 0.1]) for (const sx of [-1, 1]) k.box(0.018, 0.006, 0.018, 0x1a1a1a, [x + sx * 0.15, Y + 0.002, zz]);   // nail heads
      }
    }
    // the stairwell under the hatch: a trimmed opening, two steps going down into the dark
    k.box(1.05, 0.03, 0.06, 0x4a3220, [-1.225, Y + 0.015, -1.93]); k.box(1.05, 0.03, 0.06, 0x4a3220, [-1.225, Y + 0.015, -0.87]);
    for (const sx of [-1, 1]) k.box(0.06, 0.03, 1.0, 0x4a3220, [-1.225 + sx * 0.5, Y + 0.015, -1.4]);
    for (const sx of [-1, 1]) k.box(0.02, 0.5, 1.0, 0x1a120c, [-1.225 + sx * 0.475, Y - 0.25, -1.4]);
    k.box(0.95, 0.5, 0.02, 0x1a120c, [-1.225, Y - 0.25, -1.89]); k.box(0.95, 0.5, 0.02, 0x1a120c, [-1.225, Y - 0.25, -0.91]);
    k.box(0.9, 0.04, 0.26, 0x4a3422, [-1.225, Y - 0.2, -1.03]); k.box(0.9, 0.04, 0.26, 0x3a2818, [-1.225, Y - 0.4, -1.27]);
    k.box(0.95, 0.02, 1.0, 0x050403, [-1.225, Y - 0.48, -1.4]);
    // railing: handrail, mid rail, square balusters, stout corner posts with ball finials
    for (const [ax, az, bx, bz] of [[-2.1, -2.1, 2.1, -2.1], [2.1, -2.1, 2.1, 2.1], [2.1, 2.1, -2.1, 2.1], [-2.1, 2.1, -2.1, -2.1]]) {
      const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(-(bz - az), bx - ax);
      k.box(len - 0.12, 0.06, 0.12, WOOD, [(ax + bx) / 2, Y + 1.0, (az + bz) / 2], [0, yaw, 0]);
      k.box(len - 0.12, 0.03, 0.08, 0x5a3e28, [(ax + bx) / 2, Y + 0.955, (az + bz) / 2], [0, yaw, 0]);
      k.box(len - 0.12, 0.05, 0.06, WOOD, [(ax + bx) / 2, Y + 0.12, (az + bz) / 2], [0, yaw, 0]);
      for (let d = 0.3; d < len - 0.2; d += 0.3) k.box(0.045, 0.82, 0.045, DARK, [ax + (bx - ax) * d / len, Y + 0.55, az + (bz - az) * d / len], [0, yaw, 0]);
      k.box(0.13, 1.12, 0.13, DARK, [ax, Y + 0.56, az]); k.box(0.17, 0.04, 0.17, WOOD, [ax, Y + 1.13, az]); k.ball(0.06, 0, WOOD, [ax, Y + 1.19, az]);
    }
    // a little table with his notebook, ink, a candle lantern; a stool
    k.box(0.7, 0.05, 0.5, WOOD, [-1.45, Y + 0.78, 1.3]); for (const [ox, oz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) k.box(0.05, 0.78, 0.05, DARK, [-1.45 + ox, Y + 0.39, 1.3 + oz]);
    k.box(0.3, 0.02, 0.22, 0xece0c0, [-1.4, Y + 0.815, 1.32], [0, 0.2, 0]); k.box(0.3, 0.025, 0.22, 0x5a3a22, [-1.62, Y + 0.815, 1.2], [0, -0.3, 0]);
    k.cyl(0.03, 0.035, 0.05, 8, 0x1a1a1a, [-1.25, Y + 0.83, 1.15]); k.box(0.004, 0.2, 0.015, 0xf0f0e8, [-1.24, Y + 0.92, 1.14], [0.2, 0, 0.35]);
    k.box(0.4, 0.04, 0.4, WOOD, [-1.0, Y + 0.45, 1.75]); for (const [ox, oz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) k.box(0.04, 0.45, 0.04, DARK, [-1.0 + ox, Y + 0.22, 1.75 + oz]);
    // more of his things: a box of lenses, a spare tube, a sheet of Moon drawings, a quill in the ink
    k.box(0.14, 0.05, 0.1, 0x5a3a22, [-1.7, Y + 0.83, 1.45]); for (let i = 0; i < 3; i++) k.cyl(0.018, 0.018, 0.006, 8, 0xbfe0ff, [-1.74 + i * 0.04, Y + 0.858, 1.45]);
    k.cyl(0.022, 0.026, 0.5, 8, 0x7a2a1a, [-1.42, Y + 0.83, 1.5], [0, 0.4, Math.PI / 2]);
    k.box(0.21, 0.004, 0.28, 0xe8dcc0, [-1.25, Y + 0.807, 1.38], [0, -0.3, 0]); k.cyl(0.035, 0.035, 0.002, 10, 0x6a5a48, [-1.26, Y + 0.81, 1.34]);
    // the garden behind: walls, a vine pergola, lemon trees in pots, fruit trees, a well, the workshop
    for (const [ax, az, bx, bz] of [[-15, -6, -15, -44], [15, -6, 15, -44], [-15, -44, 15, -44]]) { const len = Math.hypot(bx - ax, bz - az); k.box(len, 2.4, 0.4, 0xb8a080, [(ax + bx) / 2, 1.2, (az + bz) / 2], [0, Math.atan2(-(bz - az), bx - ax), 0]); }
    for (let i = 0; i < 7; i++) { for (const sx of [-1, 1]) k.box(0.12, 2.4, 0.12, DARK, [sx * 1.4, 1.2, -9 - i * 3]); k.box(3, 0.08, 0.1, DARK, [0, 2.4, -9 - i * 3]); k.ball(0.9, 1, 0x2a3a1e, [(i % 2 - 0.5) * 1.6, 2.6, -9 - i * 3], 0, [1.4, 0.5, 1.6]); }
    const r = rng(23);
    for (let i = 0; i < 8; i++) { const x = (i % 2 ? 1 : -1) * (4 + r() * 2), z = -9 - Math.floor(i / 2) * 6; k.cyl(0.35, 0.28, 0.5, 8, 0xa85a3a, [x, 0.25, z]); k.cyl(0.36, 0.36, 0.04, 8, 0x3a2a1c, [x, 0.49, z]); lemons.push({ x, y: 0.5, z }); for (let j = 0; j < 4; j++) k.ball(0.07, 0, 0xe8d040, [x + (r() - 0.5) * 0.8, 1.1 + r() * 0.5, z + (r() - 0.5) * 0.8]); }
    for (let i = 0; i < 6; i++) { r(); r(); r(); }   // (keeps the rest of the garden where it was)
    // trees from the shared library: lemon trees in the pots, fruit trees at the back of the garden
    // (clear of the workshop, the well and the dog's patch), cypresses along the walls, poplars by the canal
    const gr = (kind, spots, o) => { const g = grove(kind, spots, o); Bg.add(g.group); return g; };
    gr(orchardTree, lemons, { height: 1.6, detail: 'low', apples: 0, variants: 3, seed: 3 });
    gr(orchardTree, [[4.5, -31.5], [10, -34], [4, -39.5], [10.5, -41], [-2, -40.5]].map(([x, z], i) => ({ x, y: paduaHeight(x, z), z, s: 0.85 + i * 0.06 })), { height: 4.2, detail: 'mid', apples: 12, variants: 3, seed: 7 });
    gr(cypress, [[-13.6, -10], [13.6, -10], [-13.6, -20], [13.6, -20], [13.6, -30], [-13.6, -42.6], [13.6, -42.6], [-3.5, -42.8]].map(([x, z], i) => ({ x, y: paduaHeight(x, z), z, s: 0.8 + (i % 3) * 0.1 })), { height: 10, detail: 'mid', variants: 3, seed: 11 });
    { const pts = []; for (let x = -66; x <= 66; x += 11) if (Math.abs(x - 24) > 6) pts.push({ x, y: 0, z: -71.5, s: 0.85 + Math.abs(Math.sin(x)) * 0.25 }); gr(poplar, pts, { height: 16, detail: 'low', variants: 3, seed: 13 }); }
    k.cyl(0.8, 0.8, 0.9, 12, 0x8a8070, [6, 0.45, -18]); k.box(0.1, 2, 0.1, DARK, [5.3, 1, -18]); k.box(0.1, 2, 0.1, DARK, [6.7, 1, -18]); k.box(1.6, 0.1, 0.1, DARK, [6, 2, -18]);
    // the workshop: lens grinding and tube making, its door glowing
    k.box(8, 4, 6, 0xc8a880, [-9, 2, -36]); k.add(gableRoof(8, 6, 1.6, 0.3), 0x8a3a28, [-9, 4, -36]);
    k.box(1.6, 2.4, 0.1, 0xffa860, [-9, 1.2, -32.95]); wins.push({ p: new THREE.Vector3(-6.5, 2.2, -32.95), yaw: 0, on: true });
    k.box(1.2, 0.9, 0.6, 0x5a3a22, [-10.5, 0.45, -31.6]);
    // ...a lean-to over the workbench: posts, a tiled slope, the lens-grinding wheel, tube staves, a lamp
    for (const x of [-12.6, -5.4]) k.box(0.14, 2.6, 0.14, 0x3a2818, [x, 1.3, -31.2]);
    k.box(7.6, 0.08, 2.2, 0x8a3a28, [-9, 2.75, -32.0], [0.35, 0, 0]); k.box(7.6, 0.14, 0.14, 0x3a2818, [-9, 2.55, -31.2]);
    k.box(2.4, 0.08, 0.7, 0x6a4a30, [-7.2, 0.9, -31.9]); for (const x of [-8.3, -6.1]) for (const z of [-31.6, -32.2]) k.box(0.08, 0.9, 0.08, 0x3a2818, [x, 0.45, z]);
    k.cyl(0.35, 0.35, 0.08, 14, 0x8a8478, [-6.6, 1.3, -31.9], [0, 0, Math.PI / 2]); k.box(0.06, 0.5, 0.06, 0x3a2818, [-6.6, 1.05, -31.9]);
    for (let i = 0; i < 5; i++) k.cyl(0.03, 0.04, 1.0, 6, 0x7a2a1a, [-7.9 + i * 0.12, 0.98, -32.0], [0, 0, Math.PI / 2]);
    k.cyl(0.25, 0.3, 0.6, 8, 0x6a4a30, [-11.8, 0.3, -31.7]); k.box(0.9, 0.5, 0.5, 0x5a3a22, [-12.0, 0.25, -32.6]);
    Bg.add(k.mesh());
    Bg.add(panes(wins, { lit: 0.6, seed: 2 }));
    this.workLight = new THREE.PointLight(0xffa050, 2.5, 14, 1.6); this.workLight.position.set(-9, 2, -31.5); Bg.add(this.workLight);
    // the hatch lid
    // (boards, two battens, an iron ring; hinged at its north edge, it swings down over the opening)
    const hk = new Kit(); for (let i = 0; i < 4; i++) hk.box(0.255, 0.04, 1.06, i % 2 ? 0x6e5034 : 0x765638, [-0.39 + i * 0.26, 0.02, 0.53]);
    for (const z of [0.2, 0.86]) hk.box(0.98, 0.03, 0.08, 0x4a3220, [0, -0.015, z]);
    hk.add(new THREE.TorusGeometry(0.05, 0.008, 4, 10), 0x2a2a2a, [0, 0.045, 0.85], [Math.PI / 2, 0, 0]);
    this.hatch = hk.mesh(); this.hatch.position.set(-1.225, Y + 0.03, -1.96); this.hatch.rotation.x = -1.4; Bg.add(this.hatch);
    // the candle lantern on the table and its light
    this.candle = new THREE.PointLight(0xffa860, 2.6, 8, 1.6); this.candle.position.set(-1.55, Y + 1.1, 1.45); Bg.add(this.candle);
    const lk = new Kit(); lk.box(0.14, 0.2, 0.14, 0x2a2018, [0, 0.1, 0]); lk.cyl(0.001, 0.1, 0.08, 4, 0x2a2018, [0, 0.24, 0], [0, Math.PI / 4, 0]);
    const lm = lk.mesh(); lm.position.set(-1.6, Y + 0.8, 1.45); Bg.add(lm);
    this.flame = glow(0xffb050, 0.12); this.flame.position.set(-1.6, Y + 0.92, 1.45); Bg.add(this.flame);
    // the telescope on its stand: a leather-covered tube on a wooden pole with a fork
    this.TP = new THREE.Vector3(0.55, Y + 1.38, 0.15);
    // (a turned pole on three splayed legs that stand on the planks, an iron collar, a brass fork)
    const sk = new Kit(); sk.cyl(0.028, 0.038, 0.85, 8, DARK, [0, -0.45, 0]); sk.cyl(0.05, 0.05, 0.06, 8, 0x2a2a2a, [0, -0.86, 0]);
    for (const a of [0.4, 2.5, 4.6]) { beam(sk, [0, -0.86, 0], [Math.sin(a) * 0.42, -1.38, Math.cos(a) * 0.42], 0.035, DARK); sk.box(0.07, 0.02, 0.07, 0x2a2a2a, [Math.sin(a) * 0.42, -1.37, Math.cos(a) * 0.42], [0, a, 0]); }
    sk.box(0.16, 0.04, 0.04, 0xb08a40, [0, 0, 0]); for (const s of [-1, 1]) sk.box(0.025, 0.14, 0.04, 0xb08a40, [s * 0.07, 0.05, 0]);
    const stand = sk.mesh(); stand.position.copy(this.TP); Bg.add(stand);
    this.tube = new THREE.Group(); this.tube.position.copy(this.TP); Bg.add(this.tube);
    const tk = new Kit(); tk.cyl(0.032, 0.042, 1.0, 14, 0x7a2a1a, [0, 0.12, 0]); for (const y of [-0.38, 0.0, 0.4]) tk.cyl(0.046, 0.046, 0.03, 14, 0xd0a050, [0, y + 0.12, 0]); tk.cyl(0.05, 0.05, 0.05, 14, 0xd0a050, [0, 0.64, 0]); tk.cyl(0.025, 0.03, 0.08, 10, 0x3a2418, [0, -0.42, 0]);
    this.tube.add(tk.mesh());
    this.tubeGlow = glow(0xffe0a0, 0.6, 0); this.tubeGlow.position.y = 0.1; this.tube.add(this.tubeGlow);
    this.tubeDir = dirFromAzEl(MOON.az, MOON.el, new THREE.Vector3());
  }

  buildPeople() {
    const add = (parent, model, pos, look = {}) => { const P = makePerson({ model, seed: 17 + parent.children.length, ...look }); P.g.position.copy(pos); parent.add(P.g); return P; };
    // Venice: Galileo and the senators in the belfry
    this.galA = add(this.A, 'galileo', new THREE.Vector3(3.3, TOPA, -0.5), { tunic: 0x1a1a1a, hair: 0x6a3a1a, beard: true, height: 1.7 });
    this.galA.g.rotation.y = 1.75;
    const tk = new Kit(); tk.cyl(0.03, 0.04, 0.9, 12, 0x7a2a1a, [0, 0.45, 0]); tk.cyl(0.045, 0.045, 0.03, 12, 0xd0a050, [0, 0.88, 0]); tk.cyl(0.036, 0.036, 0.03, 12, 0xd0a050, [0, 0.02, 0]);
    this.spyTube = tk.mesh(); this.spyglass = new THREE.Group(); this.spyglass.add(this.spyTube); this.spyLen = 0.55; this.spyTube.scale.set(1, this.spyLen, 1);
    holdProp(this.galA, this.spyglass, 'Right', [0, 0.05, 0.03]);
    // (every senator a different person: one model each, none of them Galileo's own face)
    const SEN = ['canon', 'ptolemy', 'instrument_maker', 'rheticus'];
    this.senators = [[3.3, 3.0, 2.3], [2.0, -2.3, 1.2], [4.1, -2.0, 1.4], [-2.6, 3.4, 2.4]].map(([x, z, yaw], i) => { const P = add(this.A, SEN[i], new THREE.Vector3(x, TOPA, z), { tunic: 0x8a1a1a, hair: 0x5a5a5a, height: 1.7 + i * 0.03 }); P.g.rotation.y = yaw; P.glance = true; return P; });
    // Padua: Galileo at his telescope; two craftsmen in the garden workshop; people in the street
    this.galB = add(this.B, 'galileo', new THREE.Vector3(1.35, TOPB, -0.55), { tunic: 0x1a1a1a, hair: 0x6a3a1a, beard: true, height: 1.7 });
    this.galB.g.rotation.y = 2.3;
    this.workers = [[-9.6, -31.8, Math.PI], [-7.3, -31.25, Math.PI]].map(([x, z, yaw], i) => { const P = add(this.B, i ? 'builder' : 'instrument_maker', new THREE.Vector3(x, 0, z), { height: 1.65 }); P.g.rotation.y = yaw; P.pose = 'work'; P.phase = i * 2; return P; });
    this.walkers = [];
    for (let i = 0; i < 5; i++) {
      const x = -50 + i * 22, z = 12 + (i % 2) * 3, P = add(this.B, ['rheticus', 'eratosthenes'][i] ?? null, new THREE.Vector3(x, 0, z), { tunic: [0x3a2a2a, 0x2a2a3a, 0x4a3a2a, 0x1a1a1a, 0x5a2a2a][i], hair: 0x2a1a10, height: 1.62 + (i % 3) * 0.06 });
      P.routine = [{ x: x + 30, z: 12 + (i % 2) * 3, pose: 'idle', secs: 3 + i }, { x: x - 20, z: 13, pose: i % 2 ? 'talk' : 'idle', secs: 4 }];
      if (i % 2 === 0) { const L = makeTorch({ len: 0.35, color: 0xffc070, size: 0.6 }); holdProp(P, L, 'Right', [0, 0.02, 0.02]); P.lamp = L; }
      this.walkers.push(P);
    }
    // ch11_10: an echo of Galileo, warm and golden, back by his telescope
  }

  // ======================= The telescope view =======================
  // A dark shell all round your head with one round hole: everything outside the telescope's
  // circle is black. Behind the hole float the magnified things (the ship, the Moon, star clouds,
  // Jupiter and its moons), always the same distance from your eyes, like real sky objects.
  buildScope() {
    const S = this.scopeG = new THREE.Group(); this.root.add(S);
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(3.2, 48, 32), new THREE.ShaderMaterial({
      uniforms: { dir: { value: new THREE.Vector3(0, 0, -1) }, cosR: { value: 0.95 }, cosE: { value: 0.96 }, op: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 dir; uniform float cosR, cosE, op; varying vec3 vD;
        void main(){ float c = dot(normalize(vD), dir); float t = smoothstep(cosR, cosE, c);
          float rim = exp(-pow((c - mix(cosR, cosE, 0.25)) / max(0.0004, (cosE - cosR) * 0.35), 2.0));
          vec3 col = vec3(0.55, 0.4, 0.2) * rim * 0.5;
          gl_FragColor = vec4(col, op * (1.0 - t * 0.98)); }`,
      side: THREE.BackSide, transparent: true, depthTest: false, depthWrite: false, fog: false,
    }));
    this.shell.renderOrder = 60; this.shell.frustumCulled = false; this.shell.visible = false; S.add(this.shell);
    // --- the ship far out at sea, as the telescope shows it ---
    // (drawn small and close, inside the eyepiece, so the belfry's own columns can't get in front of it)
    const SV = this.shipView = new THREE.Group(); SV.visible = false; SV.scale.setScalar(2.6 / 60); S.add(SV);
    const backTex = canvasTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6f86b0'); gr.addColorStop(0.38, '#d9b9a4'); gr.addColorStop(0.5, '#f3cfa0'); gr.addColorStop(0.5, '#3d6274'); gr.addColorStop(1, '#16303e'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    this.shipBack = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), new THREE.MeshBasicMaterial({ map: backTex, fog: false })); SV.add(this.shipBack);
    const sh = this.scopeShip = new THREE.Group(); SV.add(sh);
    const big = ship(1.3); big.scale.setScalar(0.36); sh.add(big); this.bigShip = big;
    const seaTex = canvasTex(256, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(70,110,130,0)'); gr.addColorStop(0.3, 'rgba(50,90,110,0.9)'); gr.addColorStop(1, 'rgba(30,60,80,0.95)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,230,190,0.5)'; for (let i = 0; i < 120; i++) g.fillRect(Math.random() * w, 16 + Math.random() * 48, 4 + Math.random() * 10, 1); });
    this.seaP = new THREE.Mesh(new THREE.PlaneGeometry(44, 7), new THREE.MeshBasicMaterial({ map: seaTex, transparent: true, depthWrite: false, fog: false })); SV.add(this.seaP);
    // --- the Moon ---
    this.moon = makeMoon(); this.moon.visible = false; this.moon.renderOrder = 40; S.add(this.moon);
    this.moonLabs = { mountains: label('mountains', 1.6), craters: label('craters', 1.6), shadows: label('long shadows', 1.6), height: label('how tall? measure the shadow', 1.5) };
    for (const l of Object.values(this.moonLabs)) { l.material.opacity = 0; l.renderOrder = 45; S.add(l); }
    // points on the Moon (its own frame, radius 1) for the labels and the shadow measuring
    const ll = (lat, lon) => new THREE.Vector3(Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.cos(lon * D2R));
    this.moonPts = { mountains: ll(22, -6), craters: ll(-40, -12), shadows: ll(8, -2), height: ll(19, -9) };
    this.measure = glowPoints(120, { sizeScale: 900 }); this.measure.renderOrder = 44; this.measure.visible = false; S.add(this.measure);
    // --- the Milky Way: first a soft glow, then countless stars ---
    const mw = this.milky = new THREE.Group(); mw.visible = false; S.add(mw);
    this.mwGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(220,225,255,0.9)'); gr.addColorStop(0.5, 'rgba(160,170,210,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.mwGlow.scale.set(30, 12, 1); this.mwGlow.material.rotation = 0.5; mw.add(this.mwGlow);
    const NS = 5000, sr = rng(55); this.mwStars = glowPoints(NS, { sizeScale: 300 }); mw.add(this.mwStars);
    this.mwD = [];
    for (let i = 0; i < NS; i++) {
      const along = (sr() - 0.5) * 34, across = (sr() + sr() + sr() - 1.5) * 6 * (0.6 + 0.4 * Math.sin(along * 0.3 + 1)), ca = Math.cos(0.5), sa = Math.sin(0.5);
      const x = along * ca - across * sa, y = along * sa + across * ca, b = Math.pow(sr(), 3.2), t = sr();
      this.mwD.push({ x, y, b: 0.25 + 1.4 * b, size: 0.05 + 0.14 * b, at: i / NS, c: t < 0.2 ? [0.75, 0.85, 1] : t < 0.75 ? [1, 0.97, 0.9] : [1, 0.82, 0.6] });
    }
    // a few bright stars, and a cluster of them (Galileo drew the Pleiades and Praesepe this way)
    for (let i = 0; i < 24; i++) { const a = sr() * 6.28, d = 3 + sr() * 3; this.mwD[i] = { x: 7 + Math.cos(a) * d * 0.5, y: 5 + Math.sin(a) * d * 0.4, b: 1.3 + sr(), size: 0.18 + sr() * 0.1, at: 0.05, c: [0.85, 0.9, 1] }; }
    // --- Jupiter and its four moons ---
    const J = this.jupG = new THREE.Group(); J.visible = false; S.add(J);
    this.jupPlane = new THREE.Group(); J.add(this.jupPlane);
    const jtex = canvasTex(256, 128, (g, w, h) => {
      const bands = ['#e8dcc4', '#d8c0a0', '#b88a64', '#e8dcc0', '#c89a70', '#f0e4cc', '#a87a58', '#e0d0b4', '#c8a880', '#ece0c8'];
      for (let i = 0; i < h; i++) { const b = bands[Math.floor((i / h) * bands.length + Math.sin(i * 0.7) * 0.3) % bands.length]; g.fillStyle = b; g.fillRect(0, i, w, 1); }
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${150 + Math.random() * 80},${110 + Math.random() * 60},${80 + Math.random() * 40},0.25)`; g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 20, 1 + Math.random()); }
      g.fillStyle = 'rgba(190,90,60,0.85)'; g.beginPath(); g.ellipse(170, 80, 14, 7, 0, 0, 6.28); g.fill();
    });
    this.jupBall = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), ballMat({ map: jtex })); this.jupBall.scale.set(JR, JR * 0.94, JR); this.jupBall.renderOrder = 41; J.add(this.jupBall);
    this.jupHalo = glow(0xfff0d0, JR * 5, 0.5); J.add(this.jupHalo);
    this.gm = GM.map((m) => {
      const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), ballMat({ color: m.col })); b.renderOrder = 42; g.add(b);
      const h = glow(m.col, 1, 0.9); g.add(h); const lab = label(m.name, 0.9); lab.material.opacity = 0; lab.renderOrder = 45; g.add(lab);
      this.jupPlane.add(g); return { m, g, b, h, lab, c: new THREE.Color(m.col) };
    });
    this.orbitPts = glowPoints(4 * 160, { sizeScale: 300 }); this.orbitPts.renderOrder = 43; this.jupPlane.add(this.orbitPts);
    this.dayLabs = DAYS.map((d) => { const l = label(d.t, 1.3); l.material.opacity = 0; l.renderOrder = 45; J.add(l); l.position.y = -4.2; return l; });
    this.moonsLab = label('Moons!', 2.2, { color: '#ffe8b0' }); this.moonsLab.material.opacity = 0; this.moonsLab.renderOrder = 45; J.add(this.moonsLab); this.moonsLab.position.y = 5;
    // ch11_08: the Earth, ringed by the old circles that should carry everything round it
    const E = this.earthG = new THREE.Group(); E.visible = false; S.add(E);
    const eb = new THREE.Mesh(new THREE.SphereGeometry(1.6, 32, 20), ballMat({ color: 0xffffff })); eb.renderOrder = 41; E.add(eb); this.earthBall = eb;
    new THREE.TextureLoader().load(new URL('../../data/earth.jpg', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; eb.material.uniforms.map.value = t; eb.material.uniforms.useMap.value = 1; });
    this.earthRings = glowPoints(3 * 120 + 300, { sizeScale: 300 }); this.earthRings.renderOrder = 43; E.add(this.earthRings);
    this.earthLab = label('Earth', 1.2); this.earthLab.position.y = 2.6; this.earthLab.renderOrder = 45; E.add(this.earthLab);
    // Jupiter in the real sky: a bright, steady, creamy light
    this.jupSky = glow(0xfff0d8, 22, 1); this.jupSky.visible = false; this.root.add(this.jupSky);
    this.gmSky = glowPoints(4, { sizeScale: 300 }); this.gmSky.visible = false; this.root.add(this.gmSky);
    this.gmSkyLabs = GM.map((m) => { const l = label(m.name, 9); l.material.opacity = 0; this.root.add(l); return l; });
  }

  // ch11_08: Venus going round the Sun, and its shape as seen from the Earth
  buildVenus() {
    const V = this.venusG = new THREE.Group(); V.position.copy(VEN); V.scale.setScalar(1.55); V.visible = false; this.root.add(V);
    this.vTilt = new THREE.Group(); V.add(this.vTilt);
    this.vSun = new THREE.Group(); this.vSun.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, fog: false })), glow(0xffb040, 1.8, 0.9)); this.vTilt.add(this.vSun);
    this.vBall = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 16), ballMat({ color: 0xfff2d0 })); this.vTilt.add(this.vBall);
    this.vEarth = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), ballMat({ color: 0x5a9aff })); this.vEarth.position.set(0, 0, 1.75); this.vTilt.add(this.vEarth);
    this.vPts = glowPoints(160 + 60 + 200, { sizeScale: 300 }); this.vTilt.add(this.vPts);
    // the inset: Venus as the telescope shows it from the Earth
    this.vInset = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), ballMat({ color: 0xfff6e0 })); this.vInset.position.set(1.9, 0.9, 0); V.add(this.vInset);
    this.vRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.76, 48), new THREE.MeshBasicMaterial({ color: 0xc8a060, transparent: true, fog: false, side: THREE.DoubleSide })); this.vRing.position.copy(this.vInset.position); V.add(this.vRing);
    this.vLabs = { sun: label('Sun', 0.2), venus: label('Venus', 0.16), earth: label('Earth', 0.16), seen: label('Venus, seen from the Earth', 0.16) };
    this.vLabs.sun.position.set(0, 0.45, 0); this.vLabs.seen.position.set(1.9, 1.85, 0); this.vLabs.earth.position.set(0, 0.25, 1.75);
    this.vTilt.add(this.vLabs.sun, this.vLabs.earth, this.vLabs.venus); V.add(this.vLabs.seen);
    for (const l of Object.values(this.vLabs)) l.material.opacity = 0;
  }

  // ch11_09-10: the Starry Messenger and its flying pages; the Galileo spacecraft
  buildBook() {
    const k = new Kit(); k.box(0.17, 0.03, 0.24, 0x8a6a3a, [0, 0, 0]); k.box(0.16, 0.025, 0.23, 0xf0e4c8, [0.006, 0, 0]);
    this.book = k.mesh(); this.book.visible = false; this.B.add(this.book);
    this.bookGlow = glow(0xffd890, 0.8, 0); this.book.add(this.bookGlow);
    this.bookLab = label('Sidereus Nuncius: The Starry Messenger, 1610', 0.11); this.bookLab.material.opacity = 0; this.B.add(this.bookLab);
    const pageTex = [0, 1, 2].map((v) => canvasTex(128, 160, (g, w, h) => {
      g.fillStyle = '#f0e2c0'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2a18'; g.fillStyle = '#3a2a18'; g.lineWidth = 2;
      if (v === 0) { g.beginPath(); g.arc(64, 70, 40, 0, 6.28); g.stroke(); g.fillStyle = '#7a6a58'; g.beginPath(); g.arc(64, 70, 40, Math.PI / 2, Math.PI * 1.5); g.fill(); g.fillStyle = '#3a2a18'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(70 + Math.random() * 24, 45 + Math.random() * 50, 3 + Math.random() * 4, 0, 6.28); g.stroke(); } }
      else if (v === 1) { for (let r0 = 0; r0 < 4; r0++) { const y = 30 + r0 * 34; g.beginPath(); g.arc(64, y, 6, 0, 6.28); g.stroke(); for (let i = 0; i < 2 + (r0 % 3); i++) { g.font = '18px serif'; g.fillText('*', 20 + Math.random() * 88, y + 6); } } }
      else { for (let i = 0; i < 60; i++) g.fillRect(10 + Math.random() * 108, 15 + Math.random() * 130, 2, 2); }
      g.font = 'italic 11px Georgia'; g.fillStyle = '#3a2a18'; for (let i = 0; i < 3; i++) g.fillRect(14, 132 + i * 8, 100 - i * 20, 1.5);
    }));
    this.pages = Array.from({ length: 16 }, (_, i) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: pageTex[i % 3], transparent: true, opacity: 0, fog: false })); s.scale.set(0.26, 0.32, 1); s.visible = false; this.B.add(s); return { s, a: i / 16 * 6.28 + Math.random() * 0.3, v: 0.8 + Math.random() * 0.6, up: 0.4 + Math.random() * 0.5 }; });
    // the spacecraft (Galileo, 1989): a white dish on a body, booms, a magnetometer arm
    const ck = new Kit(); ck.cyl(0.45, 0.1, 0.25, 16, 0xf0f0f0, [0, 0.35, 0]); ck.cyl(0.2, 0.25, 0.5, 8, 0xb0a890, [0, 0, 0]); ck.box(1.6, 0.04, 0.04, 0x8a8a8a, [0.8, -0.1, 0]); ck.box(0.04, 0.04, 1.2, 0x8a8a8a, [0, -0.15, -0.6]); ck.cyl(0.06, 0.06, 0.4, 6, 0x5a5a5a, [1.6, -0.1, 0]); ck.cyl(0.08, 0.08, 0.3, 6, 0xd0a050, [0, -0.3, 0]);
    this.craft = new THREE.Group(); this.craft.add(ck.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })), glow(0xcfe0ff, 2, 0.8)); this.craft.visible = false; this.root.add(this.craft);
    this.craftTrail = glowPoints(160, { sizeScale: 300 }); this.craftTrail.visible = false; this.root.add(this.craftTrail); this.trail = [];
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.scopeIt = {
      hint: 'Grab the telescope with GRIP to look through it', deskHint: 'Click the telescope to look through it',
      get disabled() { return self.s.look !== 1; },
      reach(pos) { self.tube.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.35); },
      aim(o, d) { self.tube.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.35 ? t : Infinity; },
      onGrab() { G.act({ type: 'look' }); }, onTouch() { G.act({ type: 'look' }); },
    };
    G.interactables.push(this.scopeIt);
  }
  act(a) {
    if (a.type === 'look' && this.s.look === 1) { this.s.look = 2; this.G.events.emit('sfx', { k: 'swell' }); return true; }
    return this.journal.act(a);
  }
  getState() { return this.s; }
  setState(st) { const was = this.s.scene; Object.assign(this.s, st); if (st.scene && st.scene !== was) this.setScene(st.scene); }

  // ======================= The story =======================
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    G.events.emit('placePlayers', { x: this.start.pos.x, z: this.start.pos.z, yaw: this.start.yaw });
    await G.ui.fadeIn(3);
    // Venice: the spyglass
    s.phase = 'intro';
    const l1 = D.sayAsync('ch11_01');
    await D.cue('spectacle makers'); s.lens = 1;
    await D.cue('two glass lenses'); s.lens = 2;
    await D.cue('Galileo Galilei'); s.lens = 3; s.gal = 'turn';
    await D.cue('builds a better one'); s.gal = 'build';
    await l1;
    s.lens = 0;
    // ships far out at sea
    s.phase = 'ships'; s.gal = 'show';
    const l2 = D.sayAsync('ch11_02');
    await D.cue('telescopes'); s.aim = 'ship'; s.scope = 1;
    await D.cue('hours early'); s.cheer = 1;
    await D.cue('something new'); s.scope = 0;
    await D.cue('pointed his up'); s.gal = 'up'; s.dusk = 1;
    await l2;
    await D.until(() => s.hour > 19.7, fast ? 1 : 6);
    await G.ui.fadeOut(1.5);
    s.scene = 'padua'; this.setScene('padua'); s.hour = 18.05; s.dusk = 0; s.aim = 'moon'; s.gal = 'scope';
    G.events.emit('placePlayers', { x: -0.55, z: 0.85, yaw: -128 * D2R });
    await G.ui.fadeIn(2.5);
    // the Moon
    s.phase = 'moon'; s.guide = [this.TP.x + 0.3, this.TP.y + 0.45, this.TP.z + 0.35];
    await D.say('ch11_03');
    s.look = 1; s.gal = 'aside';
    D.hint(G.mode === 'desktop' ? this.scopeIt.deskHint : this.scopeIt.hint, 9);
    await D.auto(() => s.look >= 2, () => { s.look = 2; }, { after: fast ? 0.3 : 1.2, timeout: fast ? 2 : 25 });
    if (s.look < 2) s.look = 2;
    G.ui.showHint('');
    s.guide = null; s.aim = 'moon'; s.scope = 1;
    await D.until(() => this.scopeK > 0.9, fast ? 1 : 3);
    const l4 = D.sayAsync('ch11_04');
    await D.cue('mountains'); s.tag = 'mountains';
    await D.cue('craters'); s.tag = 'craters';
    await D.cue('long dark shadows'); s.tag = 'shadows'; s.sweep = 1;
    await D.cue('how tall'); s.tag = 'height';
    await D.cue('The Moon is a world'); s.tag = '';
    await l4;
    // the Milky Way
    s.phase = 'milky'; s.aim = 'milky';
    const l5 = D.sayAsync('ch11_05');
    await D.cue('breaks apart'); s.resolve = 1;
    await D.cue('Countless'); s.resolve = 2;
    await l5;
    // find Jupiter (Adults look round for it; Kids: the telescope swings there)
    s.phase = 'jupiter'; s.day = 0;
    if (!D.kids) { s.aim = 'free'; D.hint(G.mode === 'desktop' ? 'Look around through the telescope for Jupiter, the brightest light low in the east (drag the mouse)' : 'Look around through the telescope for Jupiter, the brightest light low in the east', 10); }
    await D.auto(() => s.found || s.aim === 'jup', () => { s.aim = 'jup'; }, { after: fast ? 0.2 : 0.8, timeout: fast ? 2 : 30 });
    s.aim = 'jup'; G.ui.showHint('');
    await D.until(() => this.jupK > 0.9, fast ? 1 : 4);
    const l6 = D.sayAsync('ch11_06');
    await D.cue('The next night'); s.day = 1;
    await D.cue('A few nights later'); s.day = 2;
    await D.cue('there were four'); s.day = 3;
    await l6;
    // Galileo himself: moons!
    s.phase = 'moons'; s.gal = 'aside';
    const l7 = D.sayAsync('ch11_07');
    await D.cue('going around'); s.orbits = 1;
    await D.cue('Moons!'); s.open = 1; s.gal = 'cheer';
    await l7;
    await D.until(() => this.wowT > 9, fast ? 1 : 10);
    // not everything goes round the Earth; Venus
    s.phase = 'venus';
    const l8 = D.sayAsync('ch11_08');
    await D.cue('not everything'); s.earth = 1;
    await D.cue('Venus'); s.venus = 1; s.scope = 0; s.open = 0; s.earth = 0; s.gal = 'aside';
    await D.cue('thin crescent'); s.venus = 2;
    await D.cue('goes around the Sun'); s.venus = 3;
    await l8;
    await D.wait(fast ? 0.3 : 2);
    s.venus = 0;
    // the Starry Messenger, fame, trouble
    s.phase = 'book'; s.gal = 'desk';
    const l9 = D.sayAsync('ch11_09');
    await D.cue('Starry Messenger'); s.book = 1;
    await D.cue('made him famous'); s.book = 2;
    await D.cue('big trouble'); s.gloom = 1; s.gal = 'sad';
    await D.cue('shut up'); s.gal = 'leave';
    await l9;
    await D.until(() => s.hatch, fast ? 1 : 5);
    // centuries later
    s.phase = 'later';
    const l10 = D.sayAsync('ch11_10');
    await D.cue('had been right'); s.gloom = 0; s.right = 1;
    await D.cue('spacecraft'); s.craft = 1;
    await D.cue('Galilean moons'); s.gmoons = 1;
    await l10;
    await D.wait(fast ? 0.5 : 3);
    s.phase = 'journal';
    await this.journal.present(D);
    s.phase = 'done';
  }

  // ======================= Every frame =======================
  update(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1;
    this.t += dt;
    if (s.scene !== this.cur) this.setScene(s.scene);
    // the sky
    if (s.scene === 'venice') { if (s.dusk) s.hour = Math.min(19.9, s.hour + dt * 0.32 * fast); else s.hour += dt / 600; }
    else s.hour = Math.min(18.6, s.hour + dt / 900);
    const sun = sunAt(LAT, s.scene === 'venice' ? SUNA : SUNB, s.hour);
    G.sky.set(sun.az, sun.el);
    dirFromAzEl(sun.az, sun.el, this.dirs.sun);
    // the gloom (trouble) and the warm light coming back
    this.gloomV = damp(this.gloomV || 0, s.gloom ? 1 : 0, 0.8, dt);
    this.rightV = damp(this.rightV || 0, s.right ? 1 : 0, 0.7, dt);
    if (this.cur === 'padua') { G.sky.hemi.intensity *= 1 - 0.5 * this.gloomV + 0.3 * this.rightV; G.sky.hemi.color.lerp(_col.setRGB(0.4, 0.5, 0.9), 0.5 * this.gloomV).lerp(_col.setRGB(1, 0.85, 0.6), 0.25 * this.rightV); }
    this.life.update(dt, t);
    this.sounds(dt);
    if (this.A.visible) this.updateVenice(dt, t);
    if (this.B.visible) this.updatePadua(dt, t);
    this.updateScope(dt, t);
    this.updateVenus(dt, t);
    this.updateLater(dt, t);
    const busy = this.journal.update();
    guideUpdate(this, busy);
  }

  sounds(dt) {
    const G = this.G, A = G.audio, s = this.s; if (!A.ctx) return;
    if (this.cur === 'venice') {
      if ((this.gullT -= dt) <= 0) { this.gullT = 6 + Math.random() * 10; const o = A.out(_b.set(60 + Math.random() * 100, 25, 120 + Math.random() * 100), 0.25, 40); A.tone(o, { type: 'triangle', f: 1400, f2: 900, peak: 0.12, a: 0.02, d: 0.35 }); A.tone(o, { type: 'triangle', f: 1300, f2: 850, peak: 0.1, a: 0.02, d: 0.3, t0: 0.4 }); }
      if ((this.bellT -= dt) <= 0) { this.bellT = 40 + Math.random() * 30; for (let i = 0; i < 4; i++) setTimeout(() => A.bell(_b.set(352, 60, 450), 0.4), i * 2200); }
      // a gondolier's call now and then
      if ((this.owlT -= dt) <= 0) { this.owlT = 18 + Math.random() * 20; const o = A.out(_b.set(-150, 2, 80), 0.25, 30); A.tone(o, { type: 'triangle', f: 330, f2: 392, peak: 0.18, a: 0.08, d: 0.7 }); A.tone(o, { type: 'triangle', f: 392, f2: 294, peak: 0.16, a: 0.1, d: 1.1, t0: 0.8 }); }
    } else {
      if ((this.bellT -= dt) <= 0) { this.bellT = 60 + Math.random() * 40; for (let i = 0; i < 3; i++) setTimeout(() => A.bell(_b.set(310, 55, 164), 0.45 * (1 - 0.4 * this.gloomV)), i * 2600); }
      if ((this.owlT -= dt) <= 0) { this.owlT = 25 + Math.random() * 25; const o = A.out(_b.set(-8, 5, -38), 0.25, 10); A.tone(o, { f: 380, f2: 340, peak: 0.25, a: 0.05, d: 0.5 }); A.tone(o, { f: 360, f2: 320, peak: 0.2, a: 0.1, d: 0.9, t0: 0.7 }); }
      if ((this.dogT -= dt) <= 0) { this.dogT = 30 + Math.random() * 30; const p = this.dog.group.position; const o = A.out(_b.set(3, 0.5, -22), 0.3, 8); for (let i = 0; i < 2; i++) { A.noise(o, { type: 'bandpass', f: 700, q: 2, peak: 0.4, a: 0.01, d: 0.12, t0: i * 0.3 }); A.tone(o, { type: 'sawtooth', f: 320, f2: 220, peak: 0.08, a: 0.01, d: 0.12, t0: i * 0.3 }); } }
      if ((this.tapT -= dt) <= 0 && !s.gloom) { this.tapT = 0.7 + Math.random() * 1.2; A.tick?.(_b.set(-9.5, 1, -31.5)); }
    }
  }

  // ---------- Venice ----------
  updateVenice(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1;
    // the glitter path on the water toward the Sun
    G.camera.getWorldPosition(_a);
    const gl = this.glitter; gl.position.x = _a.x; gl.position.z = _a.z; gl.rotation.z = -G.sky.sunAz * D2R + Math.PI; gl.scale.set(90, 4000, 1);
    gl.material.opacity = 0.55 * clamp01((G.sky.sunEl + 2) / 6); this.glitTex.offset.y = -t * 0.02;
    for (const b of this.boats) { b.position.y = Math.sin(t * 0.8 + b.userData.ph) * 0.12; b.rotation.z = Math.sin(t * 0.6 + b.userData.ph) * 0.03; }
    for (const g of this.gondolas) { const u = g.userData, P = u.path; u.a += u.v * dt; g.position.set(P.cx + Math.cos(u.a) * P.rx, 0.1 + Math.sin(t + u.a) * 0.04, P.cz + Math.sin(u.a) * P.rz); g.rotation.y = Math.atan2(-Math.sin(u.a) * P.rx * Math.sign(u.v), Math.cos(u.a) * P.rz * Math.sign(u.v)); animatePerson(u.P, t, dt); }
    for (const P of this.crowd) { runRoutine(P, dt, { height: () => 1.2, speed: 0.9 }); animatePerson(P, t, dt); }
    // the lens demo
    const L = this.lensDemo; this.lensV = damp(this.lensV || 0, s.lens && s.lens < 3 ? 1 : 0, 2.5, dt);
    L.visible = this.lensV > 0.01 || (s.lens === 3 && this.flyK < 1);
    if (s.lens && !this.demoSet) { this.demoSet = true; G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize(); L.position.copy(_a).addScaledVector(_b, 1.1).add(_c.set(0, -0.1, 0)); L.lookAt(_a.x, L.position.y, _a.z); L.rotateY(Math.PI / 2); this.flyK = 0; }
    if (L.visible) {
      const k2 = s.lens >= 2 ? (this.asm = Math.min(1, (this.asm || 0) + dt * 0.6 * fast)) : 0;
      this.lenses[0].position.set(0, 0.25 * (1 - ease(k2)) + Math.sin(t * 2) * 0.01, lerp(-0.5, -0.36, ease(k2)));
      this.lenses[1].position.set(0, -0.2 * (1 - ease(k2)) + Math.sin(t * 2 + 1) * 0.01, lerp(0.55, 0.36, ease(k2)));
      for (const l of this.lenses) { l.rotation.y = (1 - k2) * t; l.children[0].material.opacity = 0.55 * this.lensV; l.children[1].material.opacity = 0.7 * this.lensV; }
      this.demoTube.material.opacity = ease(k2) * this.lensV; this.demoTube.visible = k2 > 0.01;
      this.demoLab.material.opacity = this.lensV * (s.lens === 2 ? 1 : 0);
      const R = this.demoRays.userData;
      for (let i = 0; i < 80; i++) { const f = i / 80, z = -0.9 + f * 1.8, sp = 0.12 * (1 - Math.min(1, Math.abs(z) * 1.4)) * ((i % 2) ? 1 : -1); R.pos.set([0, sp * ease(k2), z], i * 3); const v = 0.6 * ease(k2) * this.lensV * (0.5 + 0.5 * Math.sin(t * 6 - f * 12)); R.col.set([v, v * 0.95, v * 0.7], i * 3); R.size[i] = 0.015; }
      R.commit();
      if (s.lens === 3) { this.flyK = Math.min(1, this.flyK + dt * 0.8 * fast); this.spyglass.getWorldPosition(_a); L.position.lerp(_a, ease(this.flyK) * 0.25); L.scale.setScalar(1 - this.flyK * 0.9); }
    }
    // Galileo and the senators
    const Gl = this.galA, cam = G.camera.getWorldPosition(_d).clone();
    _a.copy(SHIP).setY(15);
    if (s.gal === 'turn') { Gl.pose = 'wave'; Gl.look = cam; }
    else if (s.gal === 'build') { Gl.pose = 'work'; Gl.look = null; this.spyLen = Math.min(1, this.spyLen + dt * 0.25 * fast); }
    else if (s.gal === 'show') { Gl.pose = 'point'; Gl.pointAt.copy(_a); Gl.look = s.cheer ? cam : _a.clone(); }
    else if (s.gal === 'up') { Gl.pose = 'hold'; Gl.look = _b.set(Gl.g.position.x + 10, TOPA + 30, Gl.g.position.z + 5).clone(); this.spyUp = Math.min(1, (this.spyUp || 0) + dt * 0.5 * fast); }
    else { Gl.pose = 'hold'; Gl.look = _a.clone(); Gl.glance = true; }
    this.spyTube.scale.set(1, this.spyLen, 1);
    animatePerson(Gl, t, dt);
    this.senators.forEach((P, i) => {
      if (s.cheer && s.scope) { P.pose = i % 2 ? 'gasp' : 'point'; P.pointAt.copy(_a); P.look = _a.clone(); }
      else if (s.gal === 'up') { P.pose = i === 1 ? 'point' : 'idle'; P.pointAt.set(20, TOPA + 60, 10); P.look = _b.set(10, TOPA + 40, 5).clone(); }
      else if (s.phase === 'ships') { P.pose = 'idle'; P.look = _a.clone(); }
      else { P.pose = i === 2 ? 'talk' : 'idle'; P.look = s.lens ? Gl.g.position.clone().setY(TOPA + 1.6) : null; }
      animatePerson(P, t, dt);
    });
    // the bells ring when the ship is seen
    if (s.cheer && !this.rang) { this.rang = true; this.bells.forEach((b, i) => { b.v = 1.6 - i * 0.15; setTimeout(() => G.audio.ctx && G.audio.bell(b.g.position, 0.9 - i * 0.1), i * 350); setTimeout(() => G.audio.ctx && G.audio.bell(b.g.position, 0.7 - i * 0.1), 1500 + i * 350); }); }
    for (const b of this.bells) { b.v -= b.a * 6 * dt; b.v *= 1 - dt * 0.25; b.a += b.v * dt; b.g.rotation.x = b.a * 0.6; }
  }

  // ---------- Padua ----------
  updatePadua(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1;
    // the Moon in the sky (hidden while its magnified twin fills the telescope)
    if ((this.moonK || 0) < 0.4) G.sky.setMoon(MOON.az, MOON.el, 1.2, 0.3); else G.sky.hideMoon();
    this.moonLight ||= (() => { const Lt = new THREE.DirectionalLight(0xa8b8e8, 0.45); this.B.add(Lt, Lt.target); Lt.position.copy(at(MOON.az, 200, 120)); return Lt; })();
    const fl = 0.8 + 0.2 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1);
    this.candle.intensity = 2.6 * fl * (1 - 0.6 * this.gloomV); this.flame.scale.set(0.09 + 0.02 * fl, 0.14 * fl, 1);
    this.workLight.intensity = (2.2 + 0.6 * fl) * (1 - 0.7 * this.gloomV);
    // the telescope points where the view is
    this.tubeDir.lerp(this.aimDir, 1 - Math.exp(-dt * 3)).normalize();
    if (s.gal === 'scope' && !s.look) this.tubeDir.copy(dirFromAzEl(MOON.az, MOON.el - 3, _a));
    this.tube.quaternion.setFromUnitVectors(UP, this.tubeDir);
    this.tubeGlow.material.opacity = damp(this.tubeGlow.material.opacity, s.look === 1 ? 0.5 + 0.3 * Math.sin(t * 4) : this.rightV * 0.8, 3, dt);
    // Galileo
    const Gl = this.galB, cam = G.camera.getWorldPosition(_d).clone();
    const sky = (d) => _b.copy(Gl.g.position).setY(TOPB + 1.6).addScaledVector(d, 30).clone();
    let want = [1.35, -0.55];
    if (s.gal === 'scope') want = [this.TP.x - 0.45, this.TP.z - 0.35];
    if (s.gal === 'desk') want = [-1.25, 0.75];
    if (s.gal === 'leave' || this.galGone) want = [-1.225, -0.86];   // the top of the stairs
    if (!this.galGone && Gl.g.visible) {
      const arrived = walkToward(Gl, want[0], want[1], dt, { speed: 0.7, height: () => TOPB, stop: 0.08 });
      if (arrived) {
        if (s.gal === 'scope') { Gl.g.rotation.y = damp(Gl.g.rotation.y, Math.atan2(this.tubeDir.x, this.tubeDir.z), 3, dt); Gl.pose = 'hold'; Gl.look = sky(this.tubeDir); }
        else if (s.gal === 'cheer') { Gl.pose = 'cheer'; Gl.look = sky(this.dirs.jup); }
        else if (s.gal === 'desk') { Gl.g.rotation.y = damp(Gl.g.rotation.y, Math.PI * 0.75, 3, dt); Gl.pose = s.book ? 'hold' : 'write'; Gl.look = s.book === 2 ? _b.set(-1, TOPB + 4, 3).clone() : null; }
        else if (s.gal === 'sad') { Gl.pose = 'idle'; Gl.look = _b.set(Gl.g.position.x, TOPB + 0.2, Gl.g.position.z + 2).clone(); }
        else if (s.gal === 'leave') { this.galGone = true; }
        else { Gl.pose = s.venus ? 'point' : s.scope ? 'idle' : 'talk'; Gl.pointAt.copy(VEN); Gl.look = s.venus ? VEN.clone() : s.scope ? sky(this.aimDir) : cam; Gl.glance = !s.scope; Gl.g.rotation.y = damp(Gl.g.rotation.y, 2.5, 2, dt); }
      }
      animatePerson(Gl, t, dt);
    }
    // down the stairs; the hatch closes
    if (this.galGone && Gl.g.visible) {
      // down the steep stairs: facing north, a step down for every step forward, into the dark stairwell
      Gl.g.rotation.y = Math.PI; Gl.pose = 'walk'; Gl.stride = (Gl.stride || 0) + dt * 5;
      const v = dt * 0.75 * fast; Gl.g.position.y -= v; Gl.g.position.z = Math.max(-1.7, Gl.g.position.z - v * 1.2);
      animatePerson(Gl, t, dt); if (Gl.g.position.y < TOPB - 2.2) Gl.g.visible = false;
    }
    if (!Gl.g.visible && this.galGone) { this.hatch.rotation.x = Math.min(0, this.hatch.rotation.x + dt * 1.2 * fast); if (this.hatch.rotation.x >= 0 && !s.hatch) { if (G.isHost) s.hatch = 1; G.audio.ctx && G.audio.boom?.(this.hatch.position); } }
    // the book in his hands
    if (s.book && !this.bookHeld) { this.bookHeld = true; this.book.visible = true; holdProp(Gl, this.book, 'Right', [0, 0.06, 0.06]); }
    if (this.galGone && this.bookHeld && !this.bookDown) { this.bookDown = true; dropProp(Gl, 'Right'); this.B.add(this.book); this.book.position.set(-1.45, TOPB + 0.84, 1.3); this.book.rotation.set(0, 0.3, 0); this.book.scale.setScalar(1); }
    this.bookGlow.material.opacity = damp(this.bookGlow.material.opacity, s.book ? (0.8 + 0.2 * Math.sin(t * 2)) * (1 - 0.7 * this.gloomV) : 0, 2, dt);
    if (this.book.visible) { this.book.getWorldPosition(_a); this.bookLab.position.copy(_a).add(_b.set(0, 0.32, 0)); }
    this.bookLab.material.opacity = damp(this.bookLab.material.opacity, s.book === 1 ? 1 : 0, 3, dt);
    // the pages fly out over the city, to all the world
    const pv = this.pageV = damp(this.pageV || 0, s.book === 2 && !s.gloom ? 1 : 0, s.book === 2 && !s.gloom ? 2 : 0.7, dt);
    if (s.book === 2) this.pageT = (this.pageT || 0) + dt * fast;
    this.pages.forEach((q, i) => {
      q.s.visible = pv > 0.01; if (!q.s.visible) return;
      const k = ((this.pageT || 0) * 0.12 + i / 16) % 1, rr = 0.5 + k * 40;
      q.s.position.set(-1.4 + Math.cos(q.a + k) * rr, TOPB + 1.2 + k * 18 * q.up + Math.sin(t * 2 + i) * 0.2, 1.3 + Math.sin(q.a + k) * rr);
      q.s.material.opacity = pv * Math.sin(Math.PI * k) * 1.2; q.s.material.rotation = Math.sin(t * 1.5 + i) * 0.4; q.s.scale.set(0.26 * (1 + k * 6), 0.32 * (1 + k * 6), 1);
    });
    if (s.book === 2 && !this.pageSnd) { this.pageSnd = true; G.audio.ctx && (whoosh(G, 3, 0.3), shimmer(G, 3, 0.15)); }
    // the craftsmen, the street, the echo
    this.workers.forEach((P, i) => { const up = s.open && this.wowT < 6; P.pose = up ? (i ? 'point' : 'gasp') : s.gloom ? 'idle' : 'work'; P.pointAt.copy(_a.copy(cam).addScaledVector(this.dirs.jup, 40)); P.look = up ? P.pointAt.clone() : null; animatePerson(P, t, dt); });
    for (const P of this.walkers) { runRoutine(P, dt, { height: paduaHeight, speed: 0.9 }); if (s.open && this.wowT < 8) { P.pose = 'point'; P.pointAt.copy(cam).addScaledVector(this.dirs.jup, 60); P.look = P.pointAt.clone(); } animatePerson(P, t, dt); P.lamp?.userData.flicker(t); }
    if (s.right && !this.rightSnd) { this.rightSnd = true; G.audio.ctx && (awe(G, 10, 0.08, 110), shimmer(G, 4, 0.15)); }
  }

  // ---------- the telescope view ----------
  updateScope(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1, sf = G.sky.starField;
    const cam = G.camera.getWorldPosition(_d);
    this.scopeG.position.copy(cam);
    // where things are
    this.dirs.ship.copy(SHIP).setY(10).sub(cam).normalize();
    dirFromAzEl(MOON.az, MOON.el, this.dirs.moon);
    if (sf?.toWorld) { _m.copy(sf.toWorld).setPosition(0, 0, 0); eqVec(JUP[0], JUP[1], this.dirs.jup).applyMatrix4(_m).normalize(); eqVec(MILKY[0], MILKY[1], this.dirs.milky).applyMatrix4(_m).normalize(); }
    // where the telescope points
    let target = this.dirs[s.aim] || this.dirs.moon;
    if (s.aim === 'free') {
      target = G.camera.getWorldDirection(_c);
      if (G.isHost && target.angleTo(this.dirs.jup) < 7 * D2R) { this.foundT = (this.foundT || 0) + dt; if (this.foundT > 0.5) { s.found = 1; s.aim = 'jup'; G.audio.ctx && G.audio.chime(cam, 0.4); } } else this.foundT = 0;
    }
    const ang = this.aimDir.angleTo(target);
    if (ang > 1e-4) { const k = Math.min(1, (s.aim === 'free' ? 4 : 1.3 * fast) * dt / ang * Math.max(0.15, Math.min(1, ang * 2))); this.aimDir.lerp(target, Math.min(1, k)).normalize(); }
    if ((this.scopeK || 0) < 0.05 && !s.scope) this.aimDir.copy(target);
    // open / close; the wow opens the circle right up
    this.scopeK = damp(this.scopeK || 0, s.scope ? 1 : 0, 2.2, dt);
    this.openK = damp(this.openK || 0, s.open ? 1 : 0, 0.7, dt);
    const U = this.shell.material.uniforms, R = (17 + 70 * ease(this.openK)) * D2R;
    U.dir.value.copy(this.aimDir); U.cosR.value = Math.cos(R); U.cosE.value = Math.cos(R - 2.2 * D2R); U.op.value = this.scopeK * (1 - this.openK);
    this.shell.visible = U.op.value > 0.005;
    const inView = (d, extra = 4) => { const c0 = Math.cos(R + extra * D2R); return this.scopeK * ease(clamp01((this.aimDir.dot(d) - c0) / (Math.cos(R * 0.4) - c0))); };
    // --- the ship ---
    const shK = this.cur === 'venice' ? inView(this.dirs.ship) : 0;
    this.shipView.visible = shK > 0.01;
    if (this.shipView.visible) { this.shipBack.position.copy(this.dirs.ship).multiplyScalar(68); this.shipBack.lookAt(cam); this.scopeShip.position.copy(this.dirs.ship).multiplyScalar(60); this.shipView.updateMatrixWorld(true); _a.copy(this.dirs.ship).setY(0).normalize(); this.scopeShip.lookAt(this.scopeShip.getWorldPosition(_b).add(_a)); this.scopeShip.rotateY(-1.2); this.scopeShip.position.y -= 0.6; this.bigShip.position.y = Math.sin(t * 0.9) * 0.08; this.bigShip.rotation.z = Math.sin(t * 0.7) * 0.03; this.seaP.position.copy(this.scopeShip.position).addScaledVector(this.dirs.ship, -6).add(_a.set(0, -3.2, 0)); this.seaP.lookAt(cam); }
    // --- the Moon ---
    const free = s.aim === 'free';
    this.gMoon = damp(this.gMoon ?? 1, (s.aim === 'moon' || free) && !s.open ? 1 : 0, 1.5, dt);
    this.gMilky = damp(this.gMilky ?? 0, (s.aim === 'milky' || free) && !s.open ? 1 : 0, 1.5, dt);
    const mK = this.moonK = this.cur === 'padua' ? inView(this.dirs.moon, 14) * this.gMoon : 0;
    this.moon.visible = mK > 0.01;
    if (this.moon.visible) {
      const M = this.moon; M.position.copy(this.dirs.moon).multiplyScalar(60); M.scale.setScalar(12.2); M.lookAt(cam); this.scopeG.updateMatrixWorld(true);
      // light from the Sun's side: a half Moon, the line between day and night sweeping across it
      if (s.sweep) this.sweepT = Math.min(1, (this.sweepT || 0) + dt * 0.06 * fast);
      const th = (96 - 22 * ease(this.sweepT || 0)) * D2R, m = this.dirs.moon;
      _b.copy(this.dirs.sun).addScaledVector(m, -m.dot(this.dirs.sun)).normalize();
      M.material.uniforms.L.value.copy(m).multiplyScalar(-Math.cos(th)).addScaledVector(_b, Math.sin(th)).normalize();
      M.material.uniforms.op.value = mK;
      for (const [k2, l] of Object.entries(this.moonLabs)) {
        l.material.opacity = damp(l.material.opacity, s.tag === k2 ? mK : 0, 3, dt);
        if (l.material.opacity > 0.01) { M.localToWorld(_a.copy(this.moonPts[k2])); l.position.copy(_a).sub(this.scopeG.position).addScaledVector(m, -8).add(_c.set(0, 2.2, 0)); }
      }
      // measuring a mountain's height from its shadow: the shadow, the sunbeam grazing the peak
      const hv = this.hV = damp(this.hV || 0, s.tag === 'height' ? mK : 0, 3, dt);
      this.measure.visible = hv > 0.01;
      if (this.measure.visible) {
        const P = this.measure.userData, peak = M.localToWorld(_a.copy(this.moonPts.height).multiplyScalar(1.015)).sub(this.scopeG.position);
        const Ld = M.material.uniforms.L.value, sh = _c.copy(Ld).negate().addScaledVector(m, Ld.dot(m)).normalize();
        for (let i = 0; i < 120; i++) {
          let q, col;
          if (i < 50) { q = _b.copy(peak).addScaledVector(sh, i / 50 * 3.2); col = [0.4, 0.6, 1]; }
          else if (i < 100) { q = _b.copy(peak).addScaledVector(Ld, (i - 50) / 50 * 9); col = [1, 0.85, 0.4]; }
          else { q = _b.copy(peak).addScaledVector(m, -0.6).add(_d.set(0, (i - 100) / 20 * 0.6, 0)); col = [1, 1, 1]; }
          const v = hv * (0.6 + 0.4 * Math.sin(t * 6 - i * 0.3));
          P.pos.set([q.x, q.y, q.z], i * 3); P.col.set([col[0] * v, col[1] * v, col[2] * v], i * 3); P.size[i] = 0.12;
        }
        P.commit();
      }
    }
    if (!this.moon.visible) { for (const l of Object.values(this.moonLabs)) l.material.opacity = 0; this.measure.visible = false; }
    // --- the Milky Way ---
    const wK = this.cur === 'padua' ? inView(this.dirs.milky, 10) * this.gMilky : 0;
    this.milky.visible = wK > 0.01;
    if (this.milky.visible) {
      this.milky.position.copy(this.dirs.milky).multiplyScalar(45); this.milky.lookAt(cam);
      this.resV = damp(this.resV || 0, s.resolve ? 1 : 0, 0.8, dt); this.res2 = damp(this.res2 || 0, s.resolve >= 2 ? 1 : 0, 0.5, dt);
      this.mwGlow.material.opacity = wK * (0.55 - 0.4 * this.resV);
      const P = this.mwStars.userData, show = 0.25 + 0.45 * this.resV + 0.3 * this.res2;
      this.mwD.forEach((q, i) => { const on = q.at < show ? 1 : 0, tw = 0.85 + 0.15 * Math.sin(t * 3 + i * 7.1), v = q.b * on * wK * tw * (0.3 + 0.7 * this.resV); P.pos.set([q.x, q.y, 0], i * 3); P.col.set([q.c[0] * v, q.c[1] * v, q.c[2] * v], i * 3); P.size[i] = q.size; });
      P.commit();
      if (s.resolve && !this.mwSnd) { this.mwSnd = true; G.audio.ctx && shimmer(G, 5, 0.18); }
    }
    // --- Jupiter: three, then four little stars in a row; then moons, going round ---
    const fadeV = this.jupFade = damp(this.jupFade ?? 1, s.venus ? 0 : 1, 1.5, dt);
    const jK = this.jupK = this.cur === 'padua' ? Math.max(inView(this.dirs.jup, 8), this.openK) * fadeV : 0;
    this.jupG.visible = jK > 0.01;
    if (s.open) this.wowT = (this.wowT || 0) + dt * fast;
    if (s.open && !this.wowSnd) { this.wowSnd = true; G.audio.ctx && (awe(G, 14, 0.12, 98), whoosh(G, 3, 0.3), shimmer(G, 5, 0.2)); }
    if (this.jupG.visible) {
      const J = this.jupG, grow = ease(this.openK);
      J.position.copy(this.dirs.jup).multiplyScalar(50); J.lookAt(cam); J.scale.setScalar(1.25 + 1.6 * grow);
      J.position.addScaledVector(_a.set(0, 1, 0), 4 * grow);
      this.jupBall.scale.set(JR * (1 + 2.2 * grow), JR * 0.94 * (1 + 2.2 * grow), JR * (1 + 2.2 * grow)); this.jupBall.rotation.y += dt * 0.4;
      this.jupBall.material.uniforms.op.value = jK; this.jupBall.material.uniforms.L.value.copy(this.dirs.jup).negate().lerp(this.dirs.sun, 0.15).normalize();
      this.jupHalo.material.opacity = 0.35 * jK; this.jupHalo.scale.setScalar(JR * (5 + 6 * grow));
      // the nights: time steps from one of Galileo's nights to the next; then runs on
      const want = s.day >= 0 ? DAYS[Math.min(3, s.day)].d : 0;
      if (s.orbits) this.jt += dt * 0.6 * fast; else this.jt = damp(this.jt, want, 1.2, dt);
      this.tiltV = damp(this.tiltV || 0, s.orbits ? 1 : 0, 0.9, dt);
      this.jupPlane.rotation.x = 1.15 * ease(this.tiltV);
      const sizeK = 1 + 3.2 * grow;
      this.gm.forEach((o, i) => {
        const th = o.m.ph + 2 * Math.PI * this.jt / o.m.T, x = -o.m.R * JK * Math.sin(th), z = o.m.R * JK * Math.cos(th) * (0.25 + 0.75 * ease(this.tiltV));
        o.g.position.set(x, 0, z);
        const hidden = !this.tiltV && Math.abs(x) < JR * 1.1 && Math.cos(th) < 0.1 ? 1 : 0;
        const v = jK * (1 - hidden);
        o.b.scale.setScalar(o.m.size * 0.35 * sizeK); o.b.material.uniforms.op.value = v; o.b.material.uniforms.L.value.copy(this.jupBall.material.uniforms.L.value);
        o.h.material.opacity = 0.9 * v; o.h.scale.setScalar(o.m.size * 5 * (1 + 0.6 * grow));
        o.lab.material.opacity = damp(o.lab.material.opacity, s.open && this.wowT > 3 && !s.venus ? jK : 0, 2, dt); o.lab.position.y = 0.7 + grow * 0.4;
      });
      const O = this.orbitPts.userData, ov = ease(this.tiltV) * jK;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 160; j++) {
        const a = j / 160 * Math.PI * 2, o = this.gm[i], th = o.m.ph + 2 * Math.PI * this.jt / o.m.T, lag = ((th - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2), tail = Math.exp(-lag * 0.7);
        O.pos.set([-o.m.R * JK * Math.sin(a), 0, o.m.R * JK * Math.cos(a)], (i * 160 + j) * 3); const v = ov * (0.5 + 1.2 * tail);
        const c = o.c; O.col.set([c.r * v, c.g * v, c.b * v], (i * 160 + j) * 3); O.size[i * 160 + j] = 0.14 * (1 + grow);
      }
      O.commit();
      this.dayLabs.forEach((l, i) => { l.material.opacity = damp(l.material.opacity, !s.orbits && s.day === i ? jK : 0, 3, dt); });
      this.moonsLab.material.opacity = damp(this.moonsLab.material.opacity, s.open && this.wowT < 5 ? jK : 0, 2, dt);
      if (s.day > (this.lastDay ?? -1)) { this.lastDay = s.day; if (s.day > 0) G.audio.ctx && G.audio.chime(cam, 0.25); }
    }
    // --- ch11_08: the Earth with its old circles, which shatter ---
    const eV = this.earthV = damp(this.earthV || 0, s.earth ? 1 : 0, 1.5, dt);
    this.earthG.visible = eV > 0.01 && this.cur === 'padua';
    if (s.earth && !this.ringsBroke) { this.ringsBroke = true; this.breakT = 0; }
    if (this.earthG.visible) {
      const E = this.earthG; _a.copy(this.dirs.jup).cross(UP).normalize(); E.position.copy(this.dirs.jup).multiplyScalar(48).addScaledVector(_a, 16).add(_b.set(0, -9, 0)); E.lookAt(cam);
      this.earthBall.material.uniforms.op.value = eV; this.earthBall.material.uniforms.L.value.copy(this.dirs.sun).lerp(_c.copy(E.position).normalize().negate(), 0.6).normalize(); this.earthBall.rotation.y += dt * 0.3;
      this.earthLab.material.opacity = eV;
      this.breakT += dt * fast;
      if (this.breakT > 1.6 && !this.shatterSnd) { this.shatterSnd = true; G.audio.ctx && shatter(G, 0.3); }
      const P = this.earthRings.userData, bk = clamp01((this.breakT - 1.6) / 2.5);
      for (let r0 = 0; r0 < 3; r0++) for (let j = 0; j < 120; j++) {
        const a = j / 120 * Math.PI * 2 + t * 0.2 * (r0 + 1), R0 = 3 + r0 * 2.2, fly = bk * (2 + (j * 7 % 11) * 0.6);
        const x = Math.cos(a) * (R0 + fly), y = Math.sin(a) * (R0 + fly) * 0.35 - bk * bk * 3 * ((j * 13) % 5) / 5;
        P.pos.set([x, y, 0], (r0 * 120 + j) * 3); const v = eV * (1 - bk) * 0.8; P.col.set([v * 0.6, v * 0.75, v], (r0 * 120 + j) * 3); P.size[r0 * 120 + j] = 0.12;
      }
      for (let j = 0; j < 300; j++) P.size[360 + j] = 0;
      P.commit();
    }
  }

  // ---------- ch11_08: Venus going round the Sun ----------
  updateVenus(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1;
    const vv = this.venusV = damp(this.venusV || 0, s.venus ? 1 : 0, 1.5, dt);
    this.venusG.visible = vv > 0.01 && this.cur === 'padua';
    if (!this.venusG.visible) return;
    const cam = G.camera.getWorldPosition(_d);
    this.venusG.lookAt(cam); this.vTilt.rotation.x = 0.9;
    // Venus on its circle round the Sun (0.72 of the Earth's distance)
    this.vA = (this.vA ?? 1.2) + dt * (s.venus >= 2 ? 0.5 : 0.2) * fast;
    const vr = 1.26, vx = Math.sin(this.vA) * vr, vz = Math.cos(this.vA) * vr;
    this.vBall.position.set(vx, 0, vz);
    this.vTilt.updateMatrixWorld();
    const sunW = this.vSun.getWorldPosition(new THREE.Vector3()), venW = this.vBall.getWorldPosition(new THREE.Vector3()), earW = this.vEarth.getWorldPosition(new THREE.Vector3());
    this.vBall.material.uniforms.L.value.copy(sunW).sub(venW).normalize(); this.vBall.material.uniforms.op.value = vv;
    this.vEarth.material.uniforms.L.value.copy(sunW).sub(earW).normalize(); this.vEarth.material.uniforms.op.value = vv;
    this.vSun.children[0].material.opacity = vv; this.vSun.children[1].material.opacity = 0.9 * vv;
    // the inset: Venus as seen from the Earth: lit the way the Sun lights it, bigger when it's near
    const toV = _a.copy(venW).sub(earW), dist = toV.length() / vr; toV.normalize(); const toS = _b.copy(sunW).sub(venW).normalize();
    const phaseAng = Math.acos(clamp(-toV.dot(toS), -1, 1));      // 0: full, PI: new
    const ins = this.vInset; ins.scale.setScalar(0.17 / Math.max(0.35, dist) * (0.6 + 0.4 * vv));
    ins.getWorldPosition(_c); const view = _c.clone().sub(cam).normalize(); _c.copy(cam).sub(ins.getWorldPosition(new THREE.Vector3())).normalize();
    const side = _b.crossVectors(UP, view).normalize().multiplyScalar(Math.sign(Math.sin(this.vA)) || 1);
    ins.material.uniforms.L.value.copy(_c).multiplyScalar(Math.cos(phaseAng)).addScaledVector(side, Math.sin(phaseAng)).normalize(); ins.material.uniforms.op.value = vv;
    this.vRing.material.opacity = 0.6 * vv; this.vRing.lookAt(cam);
    for (const l of Object.values(this.vLabs)) l.material.opacity = vv;
    this.vLabs.venus.position.set(vx, 0.22, vz);
    // the orbit (glows on "goes round the Sun"), the Earth's, the sight line Earth to Venus
    const P = this.vPts.userData; let n = 0; const ring = s.venus >= 3 ? 1 : 0.35;
    const dot = (x, y, z, r, g, b, sz) => { P.pos.set([x, y, z], n * 3); P.col.set([r * vv, g * vv, b * vv], n * 3); P.size[n] = sz; n++; };
    for (let j = 0; j < 160; j++) { const a = j / 160 * Math.PI * 2; const b = ring * (0.6 + 0.4 * Math.sin(t * 3 - j * 0.2) * (s.venus >= 3 ? 1 : 0)); dot(Math.sin(a) * vr, 0, Math.cos(a) * vr, b, b * 0.85, b * 0.5, 0.02); }
    for (let j = 0; j < 60; j++) { const a = j / 60 * Math.PI * 2; dot(Math.sin(a) * 1.75, 0, Math.cos(a) * 1.75, 0.15, 0.25, 0.5, 0.012); }
    for (let j = 0; j < 200; j++) { const f = j / 200; dot(lerp(0, vx, f), 0, lerp(1.75, vz, f), 0.5, 0.6, 0.8, (j + Math.floor(t * 20)) % 6 === 0 ? 0.02 : 0.008); }
    P.commit();
    if (s.venus >= 3 && !this.venSnd) { this.venSnd = true; G.audio.ctx && G.audio.chime(VEN, 0.4); }
  }

  // ---------- ch11_10: the spacecraft and the Galilean moons in the real sky ----------
  updateLater(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1, cam = G.camera.getWorldPosition(_d).clone();
    // Jupiter in the real sky (not while the magnified one is in view)
    this.jupSky.visible = this.cur === 'padua' && G.sky.starField.opacity > 0.1;
    this.jupSky.position.copy(cam).addScaledVector(this.dirs.jup, 800);
    this.jupSky.material.opacity = (0.9 + 0.1 * Math.sin(t * 1.3)) * (1 - (this.jupK || 0)) * (1 + 0.4 * (this.gmV || 0));
    this.jupSky.scale.setScalar(20 + 10 * (this.gmV || 0));
    // the four moons beside it, named
    this.gmV = damp(this.gmV || 0, s.gmoons && !s.journal ? 1 : 0, 1.2, dt);
    this.gmSky.visible = this.gmV > 0.01;
    _a.crossVectors(this.dirs.jup, UP).normalize(); _b.crossVectors(_a, this.dirs.jup).normalize();
    if (this.gmSky.visible) {
      const P = this.gmSky.userData;
      GM.forEach((m, i) => { const th = m.ph + 2 * Math.PI * (6 + this.t * 0.02) / m.T, off = -m.R * Math.sin(th) * 0.0028 * (1 + (i * 0.4)); _c.copy(cam).addScaledVector(this.dirs.jup, 800).addScaledVector(_a, off * 800 * 1.8 + (off >= 0 ? 10 : -10)); P.pos.set([_c.x, _c.y, _c.z], i * 3); const c = new THREE.Color(m.col); P.col.set([c.r * this.gmV, c.g * this.gmV, c.b * this.gmV], i * 3); P.size[i] = 14; this.gmSkyLabs[i].position.copy(_c).addScaledVector(_b, (i % 2 ? 1 : -1) * 18 + 4); this.gmSkyLabs[i].material.opacity = this.gmV; });
      P.commit();
    } else this.gmSkyLabs.forEach((l) => { l.material.opacity = 0; });
    // the spacecraft: up from over the roofs, off toward Jupiter, a sparkling trail behind
    if (s.craft && this.craftT == null) { this.craftT = 0; G.audio.ctx && (whoosh(G, 4, 0.3), shimmer(G, 3, 0.15)); }
    if (this.craftT != null && this.craftT < 16) {
      this.craftT += dt * fast; const k = this.craftT / 14;
      const from = _a.copy(cam).add(at(200, 14, 3)), to = _b.copy(cam).addScaledVector(this.dirs.jup, 700);
      this.craft.visible = this.cur === 'padua' && k < 1; this.craft.position.lerpVectors(from, to, ease(k)); this.craft.position.y += Math.sin(Math.PI * Math.min(1, k)) * 20;
      this.craft.scale.setScalar(1 + k * 20); this.craft.rotation.y += dt * 0.6; this.craft.lookAt(to);
      if (this.craft.visible) { this.trail.push(this.craft.position.clone()); if (this.trail.length > 160) this.trail.shift(); }
      const T = this.craftTrail.userData; this.craftTrail.visible = this.craft.visible || k < 1.15;
      for (let i = 0; i < 160; i++) { const q = this.trail[i] || this.craft.position; T.pos.set([q.x, q.y, q.z], i * 3); const v = (i / 160) * clamp01(1.15 - k) * 0.8; T.col.set([v * 0.7, v * 0.85, v], i * 3); T.size[i] = 0.4 + q.distanceTo(cam) * 0.01; }
      T.commit();
    } else { this.craft.visible = false; this.craftTrail.visible = false; }
  }

  dispose() {
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.sky.hideMoon();
  }
}

// ======================= Helpers =======================
// Italian roof tiles (coppi): rounded ridges running down both slopes of a gableRoof(w, d, rh, over)
// placed at P(0, 0, 0) with yaw, plus a ridge cap. P maps the roof's own coordinates to the world.
function coppi(k, P, w, d, rh, over, yaw, col, step = 0.42) {
  const D = d / 2 + over, yb = -over * rh / (d / 2), L = Math.hypot(D, rh - yb), a = Math.atan2(rh, d / 2);
  const dark = new THREE.Color(col).multiplyScalar(0.8).getHex();
  for (const sz of [-1, 1]) for (let x = -w / 2 - over + step / 2; x < w / 2 + over; x += step) {
    const g = new THREE.CylinderGeometry(0.07, 0.07, L, 4, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).rotateX(sz * a);
    k.add(g, (Math.round(x / step) % 3) ? col : dark, P(x, (rh + yb) / 2 + 0.02, sz * D / 2), [0, yaw, 0]);
  }
  k.add(new THREE.CylinderGeometry(0.11, 0.11, w + 2 * over, 5).rotateZ(Math.PI / 2), dark, P(0, rh + 0.02, 0), [0, yaw, 0]);
}
// A square beam of thickness t from point a to point b (legs, braces)
function beam(k, a, b, t, col) {
  const A = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(A), L = d.length();
  const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  k.box(t, L, t, col, A.addScaledVector(d, L / 2).toArray(), [e.x, e.y, e.z]);
}
// An Italian town house: stucco walls, a low tiled roof, a funnel chimney, green shutters;
// pushes its windows into `wins`. Far houses are just a block and a roof.
function house(k, o, wins, r, near = true) {
  const { x, y, z, w, d, h, yaw = 0, wall, roofCol } = o, c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const rh = Math.min(w, d) * 0.2;
  k.box(w, h, d, wall, P(0, h / 2, 0), [0, yaw, 0]);
  k.add(gableRoof(w, d, rh, 0.35), roofCol, P(0, h, 0), [0, yaw, 0]);
  if (!near) return;
  if (o.tiles) coppi(k, P, w, d, rh, 0.35, yaw, roofCol, 0.7);
  for (const sx of [-1, 1]) k.add(gableWall(d, rh, 0.2), wall, P(sx * (w / 2 - 0.1), h, 0), [0, yaw + Math.PI / 2, 0]);
  k.box(w + 0.3, 0.28, d + 0.3, 0xd8d0c0, P(0, h - 0.14, 0), [0, yaw, 0]);
  if (r() < 0.75) { const cx = (r() - 0.5) * w * 0.6, cz = (r() - 0.5) * d * 0.4; k.cyl(0.24, 0.24, rh + 1.6, 6, 0xb09080, P(cx, h + (rh + 1.6) / 2, cz)); k.cyl(0.6, 0.22, 0.8, 8, 0x8a5a48, P(cx, h + rh + 1.9, cz)); }
  const fz = d / 2 + 0.03;
  if (o.portico) { for (let i = 0; i <= Math.round(w / 3); i++) k.box(0.4, 3.2, 0.4, 0xd8ccb8, P(-w / 2 + i * w / Math.round(w / 3), 1.6, fz + 2.2), [0, yaw, 0]); k.box(w, 0.5, 2.5, wall, P(0, 3.4, fz + 1.2), [0, yaw, 0]); }
  k.box(1.2, 2.3, 0.08, 0x3a2a1e, P(-w * 0.2, 1.15, fz), [0, yaw, 0]);
  const floors = Math.max(1, Math.floor((h - 1) / 3.2)), cols = Math.max(1, Math.floor(w / 2.4));
  for (let f = 0; f < floors; f++) for (let i = 0; i < cols; i++) {
    const lx = -w / 2 + (i + 0.5) * w / cols, ly = 2.1 + f * 3.2;
    if (f === 0 && Math.abs(lx + w * 0.2) < 1) continue;
    wins.push({ p: new THREE.Vector3(...P(lx, ly, fz + 0.01)), yaw });
    if (o.shut && r() < 0.5) for (const sx of [-1, 1]) k.box(0.38, 1.2, 0.05, 0x3a5a40, P(lx + sx * 0.6, ly, fz + 0.02), [0, yaw, 0]);
  }
}

// Window panes, two triangles each, in one mesh: some glow with candlelight, the rest dark glass.
// glint: panes facing west catch the low Sun (a Venice evening).
function panes(list, { lit = 0.4, seed = 3, glint = false } = {}) {
  const k = new Kit(), r = rng(seed), c = new THREE.Color();
  for (const it of list) {
    const on = it.on || r() < lit, w = it.big ? 1.6 : 0.7, h = it.big ? 5 : 1.1;
    const west = glint && Math.sin(it.yaw) < -0.7;
    c.setHex(west && r() < 0.8 ? 0xffc070 : on ? 0xffb45a : 0x1a1a22); if (on) c.multiplyScalar(0.7 + r() * 0.5);
    k.add(new THREE.PlaneGeometry(w, h), c.getHex(), it.p.toArray(), [0, it.yaw, 0]);
  }
  return k.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
}

// A Venetian merchant ship (a carrack): a round hull, castles fore and aft, three masts, square sails
function ship(s = 1) {
  const k = new Kit(), H = 0x4a3020, SAIL = 0xe8dcc0;
  k.box(7, 3, 24, H, [0, 1.2, 0]); k.box(5, 1.5, 22, H, [0, -0.6, 0]); k.box(6.6, 0.4, 24.2, 0x8a2a1a, [0, 2.4, 0]);
  k.box(6.4, 2.6, 6, 0x5a3a24, [0, 3.8, -9]); k.box(6, 2.2, 4, 0x5a3a24, [0, 3.6, 10]); k.box(3, 1.4, 4, H, [0, 2.4, 13.5], [0.3, 0, 0]);
  k.box(0.3, 0.3, 8, 0x3a2a1a, [0, 4.2, 16.5], [-0.35, 0, 0]);   // bowsprit
  for (const [z, h, w] of [[3, 24, 11], [-4, 18, 8], [10, 16, 7]]) {
    k.cyl(0.25, 0.35, h, 6, 0x3a2a1a, [0, 2.5 + h / 2, z]);
    k.box(w, h * 0.32, 0.15, SAIL, [0, 2.5 + h * 0.48, z + 0.3], [0.08, 0, 0]); k.box(w * 0.75, h * 0.22, 0.15, SAIL, [0, 2.5 + h * 0.82, z + 0.3], [0.06, 0, 0]);
    k.box(w + 0.6, 0.18, 0.18, 0x3a2a1a, [0, 2.5 + h * 0.66, z]);
  }
  k.box(0.1, 6, 5, SAIL, [0, 10, -10], [0, 0, 0.0]);   // the lateen sail at the stern
  k.box(0.05, 1.2, 2.4, 0xb02a20, [0, 28, 3.6]);         // the flag of St Mark
  const m = k.mesh(); const g = new THREE.Group(); g.add(m); g.scale.setScalar(s); return g;
}

// A sphere lit by one light (for the Moon's neighbours: Jupiter, its moons, Venus, the Earth)
function ballMat({ map = null, color = 0xffffff } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, useMap: { value: map ? 1 : 0 }, color: { value: new THREE.Color(color) }, L: { value: new THREE.Vector3(0, 0, 1) }, op: { value: 1 } },
    vertexShader: 'varying vec3 vN; varying vec2 vUv; varying vec3 vV; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D map; uniform float useMap, op; uniform vec3 color, L; varying vec3 vN; varying vec2 vUv; varying vec3 vV;
      void main(){ vec3 base = color; if (useMap > 0.5) base *= texture2D(map, vUv).rgb;
        vec3 n = normalize(vN); float d = max(dot(n, normalize(L)), 0.0); float limb = 0.55 + 0.45 * max(dot(n, vV), 0.0);
        gl_FragColor = vec4(base * (0.04 + 1.1 * d) * limb, op); }`,
    transparent: true, fog: false,
  });
}

// The Moon as Galileo's telescope showed it: maria, craters with rims and central peaks, mountain
// ranges, bright rays round the young craters. Made once into a height-and-brightness map; the
// sphere is pushed out by the big shapes, and every crater's walls are shaded by the light in the
// shader, so the line between day and night shows long shadows and bright peaks.
function makeMoon() {
  const W = 1024, H = 512, hr = new Float32Array(W * H), al = new Float32Array(W * H);
  // the real near side: maria, craters, rays, mountain ranges (shared with the sky's Moon, js/moontex.js)
  { const F = moonFields('map', W, H); hr.set(F.h); al.set(F.alb); }
  const data = new Uint8Array(W * H * 4);
  for (let p = 0; p < W * H; p++) { data[p * 4] = clamp(Math.round((0.5 + hr[p] / 0.06) * 255), 0, 255); data[p * 4 + 1] = clamp(Math.round(al[p] * 255), 0, 255);
    // the slopes, so the shading is smooth (an 8-bit height alone shades in steps)
    const x = p % W, y = (p / W) | 0, gu = (hr[y * W + (x + 1) % W] - hr[y * W + (x + W - 1) % W]) / 2, gv = (hr[Math.min(H - 1, y + 1) * W + x] - hr[Math.max(0, y - 1) * W + x]) / 2;
    data[p * 4 + 2] = clamp(Math.round((0.5 + gu / 0.008) * 255), 0, 255); data[p * 4 + 3] = clamp(Math.round((0.5 + gv / 0.008) * 255), 0, 255); }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
  // the sphere, pushed out by the big shapes
  const geo = new THREE.SphereGeometry(1, 200, 130); geo.rotateY(-Math.PI / 2);
  const P = geo.attributes.position, UV = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const u = UV.getX(i), w = UV.getY(i), x = ((Math.floor(u * W) % W) + W) % W, y = Math.max(0, Math.min(H - 1, Math.floor(w * H))), k = 1 + hr[y * W + x] * 1.4;
    P.setXYZ(i, P.getX(i) * k, P.getY(i) * k, P.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms: { hm: { value: tex }, L: { value: new THREE.Vector3(1, 0, 0) }, op: { value: 1 }, bump: { value: 0.06 * 12.2 * 2.2 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D hm; uniform vec3 L; uniform float op, bump; varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){ vec4 t = texture2D(hm, vUv); float h = t.r; float alb = t.g;
        vec3 n = normalize(vN); vec3 sx = dFdx(vP), sy = dFdy(vP); vec2 g = (t.ba - 0.5) * (0.008 / 0.06) * vec2(${W}.0, ${H}.0); vec2 ux = dFdx(vUv), uy = dFdy(vUv); if (abs(ux.x) > 0.5) ux.x = 0.0; if (abs(uy.x) > 0.5) uy.x = 0.0;
        vec2 dh = vec2(dot(g, ux), dot(g, uy)) * bump;
        vec3 r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1); vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
        vec3 bn = normalize(abs(det) * n - grad);
        float d = max(dot(bn, L), 0.0); float term = smoothstep(-0.07, 0.05, dot(n, L));
        float peaks = smoothstep(0.62, 0.7, h) * smoothstep(-0.12, -0.02, dot(n, L)) * (1.0 - term);
        vec3 col = vec3(1.0, 0.97, 0.9) * alb * (1.35 * pow(d, 0.85) * term + 0.9 * peaks) + vec3(0.035, 0.04, 0.055) * alb;
        gl_FragColor = vec4(col, op); }`,
    transparent: true, fog: false,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------- the facades (painted once onto canvases, repeated along the buildings) ----------
function procTex() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#e8dcc4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4ece0'; g.fillRect(0, h * 0.36, w, 5); g.fillRect(0, h * 0.64, w, 5); g.fillRect(0, h * 0.9, w, 8);
    // the arcade below: a round arch, shadowy, a shop lamp inside
    g.fillStyle = '#3a2c22'; g.beginPath(); g.moveTo(20, h); g.lineTo(20, h * 0.83); g.arc(64, h * 0.83, 44, Math.PI, 0); g.lineTo(108, h); g.fill();
    g.fillStyle = 'rgba(255,170,80,0.35)'; g.fillRect(30, h * 0.92, 68, h * 0.08);
    // two floors of arched windows between little columns
    for (const y of [0.5, 0.76]) { g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(42, h * (y + 0.1)); g.lineTo(42, h * (y - 0.03)); g.arc(64, h * (y - 0.03), 22, Math.PI, 0); g.lineTo(86, h * (y + 0.1)); g.fill(); g.fillStyle = '#f8f2e8'; g.fillRect(16, h * (y - 0.12), 8, h * 0.24); g.fillRect(104, h * (y - 0.12), 8, h * 0.24); }
    // merlons along the top
    g.fillStyle = '#f4ece0'; for (let x = 4; x < w; x += 32) { g.fillRect(x, 0, 18, h * 0.05); }
  });
}
function libTex() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8ccb4'; g.fillRect(0, h * 0.48, w, 10); g.fillRect(0, h * 0.08, w, 14);
    g.fillStyle = '#3a2c22'; g.beginPath(); g.moveTo(26, h); g.lineTo(26, h * 0.75); g.arc(64, h * 0.75, 38, Math.PI, 0); g.lineTo(102, h); g.fill();
    g.fillStyle = '#2a2a30'; g.beginPath(); g.moveTo(34, h * 0.42); g.lineTo(34, h * 0.26); g.arc(64, h * 0.26, 30, Math.PI, 0); g.lineTo(94, h * 0.42); g.fill();
    g.fillStyle = '#f8f2e8'; for (const x of [6, 112]) { g.fillRect(x, h * 0.55, 10, h * 0.45); g.fillRect(x, h * 0.13, 10, h * 0.33); }
    g.fillStyle = '#c8bca4'; for (let x = 0; x < w; x += 12) g.fillRect(x, h * 0.02, 6, h * 0.06);
  });
}
function dogeTex() {
  return canvasTex(128, 256, (g, w, h) => {
    // the pink wall with a lattice of white and rose diamonds
    g.fillStyle = '#e8b8a8'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h * 0.52; y += 12) for (let x = (y / 12) % 2 ? 0 : 8; x < w; x += 16) { g.fillStyle = (x + y) % 3 ? '#f4e4dc' : '#d89a8a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 6); g.lineTo(x, y + 12); g.lineTo(x - 6, y + 6); g.fill(); }
    // a tall pointed window
    g.fillStyle = '#2a2228'; g.beginPath(); g.moveTo(48, h * 0.45); g.lineTo(48, h * 0.25); g.quadraticCurveTo(64, h * 0.12, 80, h * 0.25); g.lineTo(80, h * 0.45); g.fill();
    g.fillStyle = '#f8f0e8'; g.fillRect(0, h * 0.52, w, 6);
    // the loggia: small pointed arches with round holes above
    g.fillStyle = '#f4ece4'; g.fillRect(0, h * 0.54, w, h * 0.22);
    for (const x of [0, 64]) { g.fillStyle = '#3a3030'; g.beginPath(); g.moveTo(x + 12, h * 0.76); g.lineTo(x + 12, h * 0.64); g.quadraticCurveTo(x + 32, h * 0.54, x + 52, h * 0.64); g.lineTo(x + 52, h * 0.76); g.fill(); g.beginPath(); g.arc(x + 64, h * 0.6, 7, 0, 6.28); g.fill(); }
    // the big arcade at the bottom
    g.fillStyle = '#ece4d8'; g.fillRect(0, h * 0.77, w, h * 0.23);
    g.fillStyle = '#2e2622'; g.beginPath(); g.moveTo(18, h); g.lineTo(18, h * 0.88); g.quadraticCurveTo(64, h * 0.74, 110, h * 0.88); g.lineTo(110, h); g.fill();
  });
}
function basTex() {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#d8c0a0'; g.fillRect(0, 0, w, h);
    const gold = (x, y, r0, hh) => { const gr = g.createLinearGradient(0, y - r0, 0, y + hh); gr.addColorStop(0, '#f0c860'); gr.addColorStop(1, '#a8782a'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - r0, y + hh); g.lineTo(x - r0, y); g.arc(x, y, r0, Math.PI, 0); g.lineTo(x + r0, y + hh); g.fill(); };
    // five portals below, the middle one biggest
    [[100, 70], [300, 80], [512, 110], [724, 80], [924, 70]].forEach(([x, r0]) => { g.fillStyle = '#e8dccc'; g.fillRect(x - r0 - 14, h * 0.5, r0 * 2 + 28, h * 0.5); gold(x, h * 0.62, r0, h * 0.1); g.fillStyle = '#3a2a20'; g.fillRect(x - r0 * 0.55, h * 0.78, r0 * 1.1, h * 0.22); for (let i = 0; i < 6; i++) { g.fillStyle = ['#a89880', '#8a6a5a', '#c8b8a8'][i % 3]; g.fillRect(x - r0 - 12 + i * 4, h * 0.6, 3, h * 0.4); g.fillRect(x + r0 + 8 - i * 4, h * 0.6, 3, h * 0.4); } });
    // the terrace and the four bronze horses
    g.fillStyle = '#f0e8dc'; g.fillRect(0, h * 0.48, w, 12);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#6a5030'; g.fillRect(430 + i * 44, h * 0.4, 30, 22); g.fillRect(432 + i * 44, h * 0.36, 10, 14); }
    // five ogee arches above with golden mosaics and little spires
    [[100, 80], [300, 80], [512, 120], [724, 80], [924, 80]].forEach(([x, r0]) => { gold(x, h * 0.3, r0 * 0.9, h * 0.16); g.strokeStyle = '#f8f0e4'; g.lineWidth = 10; g.beginPath(); g.moveTo(x - r0, h * 0.47); g.lineTo(x - r0, h * 0.3); g.quadraticCurveTo(x - r0, h * 0.06, x, h * 0.02); g.quadraticCurveTo(x + r0, h * 0.06, x + r0, h * 0.3); g.lineTo(x + r0, h * 0.47); g.stroke(); });
    g.fillStyle = '#1a2a6a'; g.beginPath(); g.arc(512, h * 0.3, 60, Math.PI, 0); g.fill(); g.fillStyle = '#f0c860'; for (let i = 0; i < 40; i++) g.fillRect(470 + Math.random() * 84, h * 0.2 + Math.random() * 30, 3, 3);
  });
}

// The journal page: Galileo's own way of drawing what he saw
function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
  g.fillText('Galileo, 1610: The Starry Messenger', 40, 70);
  // the Moon at half, with craters along the terminator
  const cx = 190, cy = 300, r = 130;
  g.fillStyle = '#e8d8b0'; g.beginPath(); g.arc(cx, cy, r, 0, 6.28); g.fill();
  g.fillStyle = '#5a4a38'; g.beginPath(); g.arc(cx, cy, r, Math.PI / 2, Math.PI * 1.5); g.fill();
  g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, 6.28); g.stroke();
  g.lineWidth = 2; for (const [x, y, rr] of [[18, -40, 16], [30, 10, 22], [10, 60, 12], [60, -70, 10], [70, 40, 14], [20, 95, 9]]) { g.beginPath(); g.arc(cx + x, cy + y, rr, 0, 6.28); g.stroke(); g.fillStyle = '#5a4a38'; g.beginPath(); g.arc(cx + x + rr * 0.3, cy + y, rr * 0.7, -Math.PI / 2, Math.PI / 2); g.fill(); }
  g.fillStyle = '#f0e2c0'; for (const [x, y] of [[-12, -60], [-8, 30], [-16, 70]]) { g.beginPath(); g.arc(cx + x, cy + y, 4, 0, 6.28); g.fill(); }
  g.fillStyle = INK; g.font = 'italic 24px Georgia, serif'; g.fillText('mountains, craters, shadows', 60, 470);
  // Jupiter's little stars, night by night, as he wrote them: Ori. * * O * Occ.
  g.font = 'italic 26px Georgia, serif'; g.fillText('East', 430, 140); g.fillText('West', 900, 140);
  const rows = [['7 Jan', [-1, -0.6, 0.5]], ['8 Jan', [0.35, 0.6, 0.85]], ['10 Jan', [-0.8, -0.45]], ['13 Jan', [-0.5, 0.3, 0.55, 0.8]]];
  rows.forEach(([d, xs], i) => {
    const y = 190 + i * 58, mx = 690; g.fillStyle = INK; g.font = 'italic 24px Georgia, serif'; g.fillText(d, 410, y + 8);
    g.beginPath(); g.arc(mx, y, 11, 0, 6.28); g.stroke();
    g.font = 'bold 30px Georgia, serif'; for (const x of xs) g.fillText('*', mx + x * 200 - 8, y + 14);
  });
  g.font = 'italic 26px Georgia, serif'; g.fillText('Four moons going round Jupiter.', 430, 440);
  // Venus's phases
  for (let i = 0; i < 5; i++) { const x = 460 + i * 100, y = 540, rr = 40 - i * 7, k = i / 4; g.fillStyle = '#e8d8b0'; g.beginPath(); g.arc(x, y, rr, 0, 6.28); g.fill(); g.fillStyle = '#5a4a38'; g.beginPath(); g.arc(x, y, rr, Math.PI / 2, Math.PI * 1.5); g.ellipse(x, y, rr * (1 - 2 * k) * (k < 0.5 ? 1 : -1), rr, 0, Math.PI * 1.5, Math.PI / 2, k >= 0.5); g.fill(); g.strokeStyle = INK; g.beginPath(); g.arc(x, y, rr, 0, 6.28); g.stroke(); }
  g.fillStyle = INK; g.fillText('Venus: crescent to almost full.', 450, 615);
  g.font = 'italic 30px Georgia, serif'; g.fillText('Look closer, and the sky is full of new worlds.', 40, h - 40);
}
