// Chapter 2: Stonehenge at dawn. Salisbury Plain, about 2500 BC, the longest day of the year.
//
// You arrive on the misty plain before sunrise, walk into the almost-finished circle, help the
// builders haul the last great stone into place with a rope, then watch the midsummer Sun rise
// exactly through the gap and send a beam of light to where you stand.
//
// Geography (real Stonehenge, simplified): the sarsen circle is about 33 m across with 30
// uprights capped by a ring of lintels; inside, a horseshoe of five huge trilithons opens to the
// north-east, toward the midsummer sunrise (compass bearing about 50°). The Heel Stone stands
// outside on that line, and the Avenue runs away from the entrance between two banks.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson } from '../people.js';
import { dirFromAzEl } from '../sky.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { makeJournalPage } from '../journal.js';

const AXIS = 50;                 // midsummer sunrise bearing, degrees from north
const WINTER = 130;              // midwinter sunrise bearing
const R_SARSEN = 16.5;           // radius of the sarsen circle (to the middle of the stones)
const SLOT = AXIS + 6.4;         // bearing of the last missing upright (east side of the entrance)
const STONE_LEN = 5.1;           // the missing stone, 4.1 m standing plus 1 m in its hole
const PULL_FROM = 23.5, PULL_TO = R_SARSEN; // where the stone's foot starts and ends (radius)
const PULL_NEEDED = 7;           // metres of hand-pulling (all players together) to bring it home
const D2R = Math.PI / 180;

// Position on the ground at bearing az (degrees) and radius r from the centre
const at = (az, r, y = 0, out = new THREE.Vector3()) => out.set(Math.sin(az * D2R) * r, y, -Math.cos(az * D2R) * r);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion();

// A tiny repeatable random number generator, so every headset builds the same landscape
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// Smooth value noise for the rolling chalk downland
function noise2(seed) {
  const r = rng(seed), P = new Float32Array(256); for (let i = 0; i < 256; i++) P[i] = r();
  const h = (x, z) => P[((x * 73856093) ^ (z * 19349663)) & 255];
  return (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v);
  };
}
const N1 = noise2(11), N2 = noise2(29);

// Ground height: flat around the monument, a low bank and ditch ring, the Avenue's banks, and
// gentle rolling hills further out (kept low toward the sunrise so the horizon is clear)
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = 0;
  // Rolling downland beyond the monument
  const far = clamp((r - 70) / 220, 0, 1);
  let az = Math.atan2(x, -z) / D2R; if (az < 0) az += 360;
  const sunSide = az > 25 && az < 150 ? clamp(1 - Math.min(az - 25, 150 - az) / 25, 0.15, 1) : 1;
  h += far * sunSide * (N1(x / 90, z / 90) * 14 + N2(x / 35, z / 35) * 4 - 6);
  h += (N2(x / 12, z / 12) - 0.5) * 0.25 * clamp((r - 20) / 20, 0, 1);
  // Bank (inside) and ditch (outside) around the whole site, broken at the entrance
  const gate = Math.abs(((az - AXIS + 540) % 360) - 180) < 7;
  if (!gate) { h += 0.7 * Math.exp(-((r - 50) ** 2) / 6); h -= 0.9 * Math.exp(-((r - 54.5) ** 2) / 4); }
  // The Avenue: two parallel banks running out from the entrance toward the sunrise
  const ax = Math.sin(AXIS * D2R), az2 = -Math.cos(AXIS * D2R);
  const along = x * ax + z * az2, across = x * az2 * -1 + z * ax; // across = sideways from the axis
  if (along > 54 && along < 420) for (const off of [-11, 11]) h += 0.45 * Math.exp(-((across - off) ** 2) / 3);
  return h;
}

// A rough, chunky stone: a subdivided box rounded off and dented with noise (flat-shaded)
function roughStone(w, h, d, seed, segs = [3, 6, 2]) {
  const g = new THREE.BoxGeometry(w, h, d, ...segs);
  const p = g.attributes.position, r = rng(seed), n = noise2(seed);
  const off = r() * 100;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // round the edges: pull corners in
    const nx = x / (w / 2), ny = y / (h / 2), nz = z / (d / 2);
    const k = 1 - 0.18 * (Math.abs(nx * nz)) - 0.08 * Math.abs(nx * ny * nz);
    x *= k; z *= k;
    // taper toward the top a little, and dent
    const top = (ny + 1) / 2;
    x *= 1 - top * 0.12; z *= 1 - top * 0.08;
    const dn = (n(x * 1.3 + off, y * 1.3 + z) - 0.5) * 0.22;
    x += Math.sign(x) * dn; z += Math.sign(z) * dn * 0.8;
    if (ny > 0.99) y += (n(x * 2 + off, z * 2) - 0.5) * 0.25;
    p.setXYZ(i, x, y + h / 2, z);
  }
  g.computeVertexNormals();
  return g;
}

// Colour a merged stone geometry: weathered grey-tan, darker at the foot, yellow-green lichen
function tintStones(geo, base, seed) {
  const n = noise2(seed), p = geo.attributes.position, c = geo.attributes.color, col = new THREE.Color(), lich = new THREE.Color(0x9aa860);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    col.setRGB(c.getX(i), c.getY(i), c.getZ(i));
    const v = 0.85 + n(x * 0.7 + z * 0.3, y * 0.9) * 0.3;
    col.multiplyScalar(v * (0.75 + 0.25 * clamp(y / 1.2, 0, 1)));
    const l = n(x * 1.9 + 50, z * 1.9 + y * 1.7);
    if (l > 0.68) col.lerp(lich, (l - 0.68) * 2.2);
    c.setXYZ(i, col.r, col.g, col.b);
  }
}

// A canvas texture: a soft glow line (for the beam and the light on the ground)
function beamTex() {
  return canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,200,120,0)'); gr.addColorStop(0.15, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.85, 'rgba(255,226,170,0.9)'); gr.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const side = g.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(0,0,0,1)'); side.addColorStop(0.3, 'rgba(0,0,0,0)'); side.addColorStop(0.7, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = side; g.fillRect(0, 0, w, h);
  });
}

function ropeTex() {
  const t = canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#a8865a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6e5232'; g.lineWidth = 9;
    for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 24); g.lineTo(w, i * 24 + 40); g.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function glowSprite(color = 'rgba(255,220,140,1)') {
  const t = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
}

export default class Stonehenge {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.start = { pos: at(96, 34), yaw: 0 }; // east of the circle, clear of the crowd
    // Shared progress (sent to friends' headsets)
    this.s = {
      phase: 'arrive', // arrive, walk, explain, pull, raise, gap, sunrise, lapse, journal, done
      pulled: 0,       // metres of rope hauled so far
      raise: 0,        // 0 lying on the sledge .. 1 standing in its hole
      sunEl: -7.5, sunAz: AXIS - 1,
      beam: 0, lapse: 0, path: 0, mist: 0.85,
      guide: null,     // [x, y, z] where the guide hovers, or null = beside you
      point: 0,        // builders pointing at the gap
      cheer: 0,
      journal: 0,      // 1 = the page is out, 2 = you touched it
      ring: 0,         // the glowing ring that shows where to stand
    };
    this.view = { p: 0 };
    G.world.height = groundHeight;
    G.world.bounds = 190;
    G.world.blockers = [];
    G.sky.fogFar = 900;
    G.audio.amb = 1;

    this.buildGround();
    this.buildStones();
    this.buildVillage();
    this.buildMovingStone();
    this.buildPeople();
    this.buildEffects();
    this.journal = makeJournalPage('stonehenge');
    this.journal.visible = false; this.root.add(this.journal);
    this.registerInteractables();
    this.drumT = 0; this.birdT = 3; this.creakT = 0; this.scrapeAcc = 0;
  }

  // ---------- Building the place ----------
  buildGround() {
    const SIZE = 900, SEG = 150;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const grass = new THREE.Color(0x5f7d3a), grass2 = new THREE.Color(0x7a8f44), chalk = new THREE.Color(0xd8d4c0), wheat = new THREE.Color(0xb59a52), dirt = new THREE.Color(0x7a6448);
    const village = at(150, 165);
    for (let i = 0; i < p.count; i++) {
      // Finer near the middle: squeeze the grid toward the centre
      let x = p.getX(i), z = p.getZ(i);
      const r0 = Math.hypot(x, z), k = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.6) * (SIZE / 2) / r0 : 0;
      x *= k; z *= k;
      const y = groundHeight(x, z);
      p.setXYZ(i, x, y, z);
      const r = Math.hypot(x, z);
      c.copy(grass).lerp(grass2, N2(x / 18, z / 18));
      // fresh white chalk where the bank and ditch were dug
      const bank = Math.exp(-((r - 50) ** 2) / 5) + Math.exp(-((r - 54.5) ** 2) / 3);
      c.lerp(chalk, clamp(bank * 0.8, 0, 0.75) * (y !== 0 ? 1 : 0));
      // fields of wheat and barley around the village
      const dv = Math.hypot(x - village.x, z - village.z);
      if (dv > 30 && dv < 120 && N1(x / 25 + 7, z / 25) > 0.45) c.lerp(wheat, 0.75);
      // trampled earth inside the circle and along the haul path
      if (r < 20) c.lerp(dirt, 0.25 * (1 - r / 20) + 0.1);
      p.setXYZ(i, x, y, z);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    this.root.add(m);

    // Grass tufts scattered around (one instanced mesh)
    const blade = new THREE.BufferGeometry();
    const v = []; for (let i = 0; i < 3; i++) { const a = i * 2.1, s = Math.sin(a) * 0.08, cz = Math.cos(a) * 0.08; v.push(-s, 0, -cz, s, 0, cz, s * 0.3, 0.2, cz * 0.3); }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); blade.computeVertexNormals();
    const N = 4000, tufts = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ color: 0x8aa850, side: THREE.DoubleSide }), N);
    const r = rng(5), mm = new THREE.Matrix4(), cc = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const az = r() * 360, rad = 6 + Math.pow(r(), 0.7) * 110, pos = at(az, rad);
      pos.y = groundHeight(pos.x, pos.z);
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      const s = 0.5 + r() * 0.8;
      mm.compose(pos, _q, _a.set(s, s * (0.7 + r() * 0.8), s)); tufts.setMatrixAt(i, mm);
      tufts.setColorAt(i, cc.setHex(0x6f8f3e).lerp(new THREE.Color(0xa0a058), r() * 0.5));
    }
    this.root.add(tufts);
  }

  buildStones() {
    const k = new Kit(), G = this.G, r = rng(7);
    const SARSEN = 0xa59f90, BLUE = 0x7c8590;
    const place = (geo, color, pos, yaw, block) => {
      geo.rotateY(yaw); geo.translate(pos.x, pos.y + groundHeight(pos.x, pos.z) - 0.05, pos.z);
      k.add(geo, color);
      if (block) G.world.blockers.push({ x: pos.x, z: pos.z, r: block });
    };
    // The sarsen circle: 30 uprights (one missing: the last one, still on its sledge) and lintels
    this.sarsenAz = [];
    for (let i = 0; i < 30; i++) {
      const az = SLOT + i * (360 - 12.8) / 29; this.sarsenAz.push(az);
      if (i === 0) continue; // the missing one
      const pos = at(az, R_SARSEN);
      place(roughStone(2.1 + r() * 0.3, 4.1 + r() * 0.3, 1.05, 100 + i), SARSEN, pos, -az * D2R, 0.9);
    }
    // Lintels: a ring on top, each spanning two uprights (the two that rest on the missing stone wait)
    for (let i = 0; i < 30; i++) {
      if (i === 0 || i === 29) continue;
      const a1 = this.sarsenAz[i], a2 = this.sarsenAz[(i + 1) % 30];
      if (i === 29) continue;
      const mid = (a1 + a2) / 2, pos = at(mid, R_SARSEN, 4.3);
      const len = 2 * R_SARSEN * Math.sin((a2 - a1) / 2 * D2R) + 0.4;
      const geo = roughStone(len, 0.8, 1.0, 300 + i, [4, 1, 1]);
      place(geo, SARSEN, pos, -mid * D2R, 0);
    }
    // The two lintels that will sit on the last stone, ready to be lowered in when it stands
    this.waitingLintels = [];
    for (const [i, j] of [[29, 0], [0, 1]]) {
      const a1 = this.sarsenAz[i], a2 = this.sarsenAz[j] + (j < i ? 360 : 0), mid = (a1 + a2) / 2;
      const len = 2 * R_SARSEN * Math.sin((a2 - a1) / 2 * D2R) + 0.4;
      const lk = new Kit(); lk.add(roughStone(len, 0.8, 1.0, 400 + i, [4, 1, 1]), SARSEN);
      const geo = lk.geometry(); tintStones(geo, SARSEN, 9);
      const m = new THREE.Mesh(geo, FLAT); m.rotation.y = -mid * D2R;
      const pos = at(mid, R_SARSEN, 4.3); m.position.copy(pos);
      m.userData.home = pos.clone(); m.visible = false;
      this.root.add(m); this.waitingLintels.push(m);
    }
    // The horseshoe of five trilithons, opening toward the sunrise
    const tri = [[180, 7.6, 7.2], [180 - 52, 8.5, 6.5], [180 + 52, 8.5, 6.5], [180 - 98, 9.4, 6.0], [180 + 98, 9.4, 6.0]];
    tri.forEach(([rel, rad, ht], n) => {
      const az = AXIS + rel, c = at(az, rad), tan = new THREE.Vector3(Math.cos(az * D2R), 0, Math.sin(az * D2R));
      for (const s of [-1, 1]) {
        const pos = c.clone().addScaledVector(tan, s * 1.35);
        place(roughStone(2.2, ht, 1.3, 500 + n * 2 + s, [3, 7, 2]), SARSEN, pos, -az * D2R, 1.05);
      }
      place(roughStone(5.0, 1.0, 1.2, 520 + n, [4, 1, 1]), SARSEN, c.clone().setY(ht), -az * D2R, 0);
    });
    // Bluestones: smaller, darker stones in a circle inside the sarsens (with gaps to walk through)
    for (let i = 0; i < 44; i++) {
      const az = AXIS + 6 + i * 360 / 44 + (r() - 0.5) * 2;
      const rel = ((az - AXIS + 540) % 360) - 180;
      if (Math.abs(rel) < 9 || i % 6 === 3) continue; // keep the entrance and a few walkways clear
      place(roughStone(0.8 + r() * 0.4, 1.6 + r() * 0.7, 0.6, 700 + i, [2, 4, 2]), BLUE, at(az, 12.2), -az * D2R, 0.45);
    }
    // The Altar Stone, lying in the middle of the horseshoe
    place(roughStone(4.8, 0.5, 1.0, 800, [4, 1, 2]), 0x8a7a70, at(AXIS + 180, 4.2), -(AXIS + 90) * D2R, 0);
    // The Heel Stone out on the axis, and the Station Stones
    place(roughStone(2.4, 4.7, 2.0, 801, [3, 6, 3]).rotateZ(-0.12), SARSEN, at(AXIS + 1.6, 77), -AXIS * D2R, 1.3);
    for (const az of [AXIS + 90 + 28, AXIS - 90 - 28, AXIS + 90 - 28 + 180, AXIS - 90 + 28 + 180]) place(roughStone(1.0, 2.0, 0.8, 810 + az, [2, 3, 2]), SARSEN, at(az, 41), -az * D2R, 0.6);
    const geo = k.geometry(); tintStones(geo, SARSEN, 3);
    this.stones = new THREE.Mesh(geo, FLAT); this.root.add(this.stones);
  }

  buildVillage() {
    const k = new Kit(), r = rng(13), center = at(150, 165), G = this.G;
    // Round houses: wattle-and-daub walls, tall thatched cone roofs, a dark doorway
    for (let i = 0; i < 9; i++) {
      const a = r() * 6.28, d = 8 + r() * 26, x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d, y = groundHeight(x, z);
      const rad = 3.2 + r() * 1.6, wall = 1.5 + r() * 0.3;
      k.cyl(rad, rad, wall, 12, 0xb8a07a, [x, y + wall / 2, z]);
      k.cyl(0.05, rad + 0.6, rad * 1.15, 12, 0xc2a35a, [x, y + wall + rad * 0.55, z]);
      const toC = Math.atan2(-x, -z);
      k.box(0.9, 1.2, 0.3, 0x3a2a1a, [x + Math.sin(toC) * rad, y + 0.6, z + Math.cos(toC) * rad], [0, toC, 0]);
      G.world.blockers.push({ x, z, r: rad + 0.3 });
      (this.chimneys ||= []).push(new THREE.Vector3(x, y + wall + rad * 1.1, z));
    }
    // A few clumps of trees on the far slopes (not toward the sunrise)
    for (let i = 0; i < 26; i++) {
      const az = 170 + r() * 200, d = 140 + r() * 200, p = at(az, d); p.y = groundHeight(p.x, p.z);
      const s = 0.8 + r() * 0.8;
      k.cyl(0.25 * s, 0.35 * s, 3 * s, 5, 0x5a4430, [p.x, p.y + 1.5 * s, p.z]);
      for (let j = 0; j < 3; j++) k.ball(2.2 * s, 0, 0x3f5a2c, [p.x + (r() - 0.5) * 2 * s, p.y + (3.5 + r() * 1.5) * s, p.z + (r() - 0.5) * 2 * s]);
    }
    // Wooden sledges, spare rollers and rope coils left near the circle
    for (let i = 0; i < 5; i++) {
      const p = at(AXIS + 30 + i * 9, 27 + r() * 4); p.y = groundHeight(p.x, p.z);
      k.cyl(0.14, 0.14, 2.8, 6, 0x7a5a38, [p.x, p.y + 0.14, p.z], [Math.PI / 2, 0, r() * 3]);
    }
    this.root.add(k.mesh());
    // Smoke rising from the roofs (a handful of soft sprites per house)
    this.smoke = [];
    const sm = new THREE.SpriteMaterial({ map: canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(200,200,205,0.55)'); gr.addColorStop(1, 'rgba(200,200,205,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false });
    for (const c of this.chimneys) for (let j = 0; j < 4; j++) {
      const s = new THREE.Sprite(sm); s.userData = { base: c, t: j / 4 }; this.root.add(s); this.smoke.push(s);
    }
  }

  buildMovingStone() {
    const u = at(SLOT, 1); this.u = u;              // outward along the slot's radius
    // The stone, built standing with its foot at the origin
    const k = new Kit(); k.add(roughStone(2.15, STONE_LEN, 1.05, 999), 0xa59f90);
    const geo = k.geometry(); tintStones(geo, 0xa59f90, 4); geo.translate(0, 0, 0);
    this.big = new THREE.Mesh(geo, FLAT);
    this.pivot = new THREE.Group(); this.pivot.add(this.big); this.root.add(this.pivot);
    this.qLying = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
    this.qStanding = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -SLOT * D2R);
    this.qLying.multiply(this.qStanding);
    // Its wooden sledge, and the rollers laid along the ground in front of it
    const sk = new Kit();
    for (const s of [-1, 1]) sk.box(0.22, 0.25, 5.6, 0x6e4e2e, [s * 0.75, 0.12, 0]);
    for (let i = 0; i < 6; i++) sk.box(1.9, 0.12, 0.2, 0x7e5a36, [0, 0.3, -2.5 + i]);
    this.sledge = sk.mesh(); this.root.add(this.sledge);
    const rk = new Kit();
    for (let d = PULL_TO - 0.5; d < PULL_FROM + 6; d += 1.1) {
      const p = at(SLOT, d); p.y = groundHeight(p.x, p.z);
      rk.cyl(0.11, 0.11, 2.2, 6, 0x8a6a44, [p.x, p.y + 0.1, p.z], [0, -SLOT * D2R, Math.PI / 2]);
    }
    this.rollers = rk.mesh(); this.root.add(this.rollers);
    // The rope: from the stone's foot, in through the circle and across the middle
    this.ropeTex = ropeTex();
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: this.ropeTex }));
    this.root.add(this.rope);
    this.ropeEnd = at(SLOT, -4, 0.95);
    this.ropeStart = new THREE.Vector3();
    this.blk = [{ x: 0, z: 0, r: 1.1 }, { x: 0, z: 0, r: 1.1 }, { x: 0, z: 0, r: 1.1 }];
    this.G.world.blockers.push(...this.blk);
    // A big pit waiting for it
    const pit = new THREE.Mesh(new THREE.CircleGeometry(1.2, 10), new THREE.MeshBasicMaterial({ color: 0x2a2016 }));
    pit.rotation.x = -Math.PI / 2; at(SLOT, R_SARSEN, 0.03, pit.position); this.root.add(pit); this.pit = pit;
  }

  buildPeople() {
    this.people = [];
    const r = rng(21), G = this.G;
    const add = (pos, face, look, role) => {
      const P = makePerson({ model: 'builder', seed: 40 + this.people.length * 7, tunic: [0x8a7458, 0x7a6a50, 0x9a8466, 0x6e6450][this.people.length % 4], beard: r() > 0.4, hair: [0x4a3020, 0x2a2018, 0x6a4a2a][this.people.length % 3], ...look });
      P.g.position.copy(pos); P.g.position.y = groundHeight(pos.x, pos.z);
      P.g.rotation.y = face; P.role = role; P.home = P.g.position.clone(); P.face = face;
      this.root.add(P.g); this.people.push(P);
      return P;
    };
    // Rope haulers on both sides of the rope, facing the stone (they pull walking backward)
    const faceOut = Math.atan2(this.u.x, this.u.z);
    for (let i = 0; i < 10; i++) {
      const d = 6.5 + i * 1.15, side = i % 2 ? 1 : -1;
      const tan = new THREE.Vector3(-this.u.z, 0, this.u.x);
      const p = at(SLOT, d).addScaledVector(tan, side * 0.55);
      const H = add(p, faceOut, {}, 'haul');
      // after the stone is up they step aside, either side of the axis, to watch the gap
      const side2 = i % 2 ? 1 : -1, w = at(AXIS + side2 * (40 + Math.floor(i / 2) * 11), 9 + (i % 4) * 0.8);
      H.watch = w; H.watchFace = Math.atan2(at(AXIS, 40).x - w.x, at(AXIS, 40).z - w.z);
    }
    // A team by the pit with levers, and a crowd waiting near the Heel Stone
    for (let i = 0; i < 3; i++) add(at(SLOT + 5 + i * 5, R_SARSEN + 3.5), Math.atan2(-this.u.x, -this.u.z), {}, 'pit');
    for (let i = 0; i < 7; i++) {
      // standing either side of the sunrise line, so nobody blocks the view through the gap
      const p = at(AXIS + (i < 4 ? -16 - i * 5 : 16 + (i - 4) * 5) + (r() - 0.5) * 2, 30 + r() * 6);
      add(p, Math.atan2(-p.x, -p.z), { tunic: 0x8a7a64 }, 'crowd');
    }
    // each person is a small round obstacle that moves with them (updated every frame)
    for (const P of this.people) { P.blk = { x: 0, z: 0, r: 0.3 }; G.world.blockers.push(P.blk); }
  }

  buildEffects() {
    const G = this.G;
    // The sunbeam: a long soft shaft of light coming in through the gap to the middle
    const sunDir = dirFromAzEl(AXIS, 1.2);
    const len = 90, beam = new THREE.Mesh(new THREE.PlaneGeometry(1.5, len), new THREE.MeshBasicMaterial({ map: beamTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    // Two crossed planes so it looks solid from any side
    const b2 = beam.clone(); b2.rotation.y = Math.PI / 2;
    const shaft = new THREE.Group(); shaft.add(beam, b2);
    beam.rotation.x = Math.PI / 2; b2.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    shaft.position.copy(sunDir).multiplyScalar(len / 2 - 6).setY(1.6 + len / 2 * Math.tan(1.2 * D2R) - 0.3);
    shaft.lookAt(0, 1.4, 0);
    this.beam = shaft; this.beamMats = [beam.material, b2.material];
    beam.material = b2.material = beam.material; this.beamMats = [beam.material];
    this.root.add(shaft);
    // Warm light painted on the ground along the axis
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 40), new THREE.MeshBasicMaterial({ map: beamTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    floor.rotation.x = -Math.PI / 2; floor.rotation.z = -AXIS * D2R + Math.PI; at(AXIS, 18, 0.06, floor.position);
    this.floorLight = floor; this.root.add(floor);
    // Where the Sun rises through the year: a dotted line along the horizon, winter to summer
    this.path = new THREE.Group();
    const dot = glowSprite('rgba(255,210,140,1)');
    for (let az = AXIS; az <= WINTER; az += 4) {
      const s = new THREE.Sprite(dot); dirFromAzEl(az, 0.6, s.position).multiplyScalar(300); s.scale.setScalar(az === AXIS || az > WINTER - 4 ? 16 : 7); this.path.add(s);
    }
    const label = (text, az) => {
      const t = canvasTex(256, 80, (g, w, h) => { g.font = 'bold 44px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,240,210,0.95)'; g.fillText(text, w / 2, h / 2); });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
      dirFromAzEl(az, 4.5, s.position).multiplyScalar(300); s.scale.set(48, 15, 1); this.path.add(s);
    };
    label('Summer', AXIS); label('Winter', WINTER);
    this.path.visible = false; this.pathMats = [dot, ...this.path.children.slice(-2).map((s) => s.material)];
    this.root.add(this.path);
    // Glowing ring on the ground: "stand here"
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; this.ringSpot = this.pullSpot(); ring.position.copy(this.ringSpot).setY(0.05);
    this.ring = ring; this.root.add(ring);
    // Dust when the stone drops in
    this.dust = [];
    const dm = new THREE.SpriteMaterial({ map: canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(210,200,180,0.6)'); gr.addColorStop(1, 'rgba(210,200,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false });
    for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(dm.clone()); s.visible = false; this.root.add(s); this.dust.push(s); }
  }

  // Where you stand to haul: beside the rope, near the middle of the circle
  pullSpot() {
    const tan = new THREE.Vector3(-this.u.z, 0, this.u.x);
    return at(SLOT, 3.2).addScaledVector(tan, 0.75);
  }

  registerInteractables() {
    const G = this.G, self = this;
    // The rope: grip it and pull your hand toward the middle of the circle
    this.ropeIt = {
      hint: 'Squeeze GRIP on the rope, then pull it toward you',
      deskHint: 'Hold the mouse button on the rope and drag down to pull (or tap E)',
      get disabled() { return self.s.phase !== 'pull'; },
      reach(pos) { return self.ropeDist(pos); },
      aim(o, d) {
        // how close the view ray passes to the rope's nearby part
        for (let t = 0.3; t < 4.5; t += 0.15) { _c.copy(o).addScaledVector(d, t); if (self.ropeDist(_c) < 0.35) return t; }
        return Infinity;
      },
      onGrab(h) { h.grabFrom = h.pos.clone(); },
      onHold(h) {
        // Hand moving toward the centre (against the outward direction u) hauls the rope in
        const d = -((h.pos.x - h.grabFrom.x) * self.u.x + (h.pos.z - h.grabFrom.z) * self.u.z);
        if (d > 0.02) { G.act({ type: 'pull', amount: Math.min(d, 0.4) }); G.player.haptic(h, 0.35, 25); }
        if (d > 0.02 || d < -0.5) h.grabFrom.copy(h.pos);
      },
      onMouse(h, dx, dy) { if (dy > 0) G.act({ type: 'pull', amount: Math.min(0.4, dy * 0.004) }); },
      onKey() { G.act({ type: 'pull', amount: 0.35 }); },
    };
    // The journal page Astra hands you at the end: touch it to finish the chapter
    this.pageIt = {
      hint: 'Touch the journal page (TRIGGER or GRIP)',
      deskHint: 'Click the journal page',
      get disabled() { return self.s.journal !== 1; },
      reach(pos) { self.journal.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.22); },
      aim(o, d) { self.journal.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.3 ? t : Infinity; },
      onTouch() { G.act({ type: 'touchPage' }); },
      onGrab() { G.act({ type: 'touchPage' }); },
    };
    G.interactables.push(this.ropeIt, this.pageIt);
  }

  // Distance from a point to the rope's straight line (only the part inside the circle)
  ropeDist(p) {
    const a = this.ropeEnd, b = this.ropeStart;
    _a.subVectors(b, a); const len2 = _a.lengthSq();
    const t = clamp(_b.subVectors(p, a).dot(_a) / len2, 0, 1);
    _c.copy(a).addScaledVector(_a, t);
    return p.distanceTo(_c);
  }

  // ---------- Actions from any player (run on the host) ----------
  act(a) {
    const s = this.s;
    if (a.type === 'pull' && s.phase === 'pull') { s.pulled = Math.min(PULL_NEEDED, s.pulled + a.amount); return true; }
    if (a.type === 'touchPage' && s.journal === 1) { s.journal = 2; return true; }
    return false;
  }

  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story (host only) ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    const placeAll = (pos, yaw) => G.events.emit('placePlayers', { x: pos.x, z: pos.z, yaw });
    // Start: on the misty plain, east of the circle, looking toward the village and fields
    placeAll(this.start.pos, Math.atan2(-(at(150, 165).x - this.start.pos.x), -(at(150, 165).z - this.start.pos.z)));
    await G.ui.fadeIn(2.5);
    await D.say('ch2_01');
    s.guide = at(140, 40, 3).toArray();       // the guide drifts out toward the village
    await D.say('ch2_02');
    s.guide = at(80, 24, 2.2).toArray();      // ...then over to the stone circle
    await D.say('ch2_03');
    s.guide = null;
    // Walk into the circle (or after a while, a gentle fade takes you there)
    s.phase = 'walk'; s.ring = 1;
    G.ui.showHint('Walk to the glowing ring in the circle (left stick)', 8);
    const there = () => G.players.every((p) => { p.headPos?.(_a) ?? _a.copy(p.view?.head || this.ringSpot); return _a.distanceTo(this.ringSpot) < 2.2 || Math.hypot(_a.x, _a.z) < 12; });
    if (!(await D.until(there, fast ? 3 : 35))) {
      await G.ui.fadeOut(0.8); placeAll(this.ringSpot, this.faceToward(this.ringSpot, at(SLOT, 20))); await G.ui.fadeIn(1);
    }
    s.ring = 0; G.ui.showHint('');
    s.phase = 'explain';
    s.path = 1; s.guide = at(AXIS + 40, 7, 2.6).toArray();
    await D.say('ch2_04');
    s.point = 1; s.guide = at(SLOT, R_SARSEN - 1, 2.4).toArray();
    await D.say('ch2_05');
    s.path = 0;
    // Haul the stone in
    s.point = 0; s.phase = 'pull'; s.ring = 1; this.ringSpot.copy(this.pullSpot());
    s.guide = at(SLOT, 5.5, 1.8).toArray();
    await D.say('ch2_06');
    G.ui.showHint(G.mode === 'desktop' ? this.ropeIt.deskHint : this.ropeIt.hint, 7);
    this.pullStart = G.t;
    await D.until(() => s.pulled >= PULL_NEEDED);
    s.ring = 0; s.guide = null; G.ui.showHint('');
    // Up it goes
    s.phase = 'raise';
    await D.until(() => s.raise >= 1);
    G.events.emit('sfx', { k: 'boom' });
    await D.wait(fast ? 0.5 : 2.5);
    // Stand in the middle, facing the gap
    await G.ui.fadeOut(0.8);
    const mid = at(AXIS + 180, 1.5);
    placeAll(mid, this.faceToward(mid, at(AXIS, 50)));
    s.phase = 'gap'; s.mist = 0.5;
    await G.ui.fadeIn(1.2);
    await D.say('ch2_07');
    s.phase = 'sunrise'; G.events.emit('sfx', { k: 'swell' });
    await D.until(() => s.sunEl >= 0.6);
    await D.say('ch2_08');
    s.cheer = 1; G.events.emit('sfx', { k: 'cheer' });
    await D.wait(fast ? 0.5 : 3);
    s.cheer = 0;
    // A year in a few seconds: the sunrise point walks to winter and back
    s.phase = 'lapse'; s.path = 1;
    await D.say('ch2_09');
    await D.until(() => s.lapse >= 1);
    s.path = 0; s.phase = 'closing';
    s.guide = null;
    await D.say('ch2_10');
    // The journal page
    s.journal = 1; s.phase = 'journal';
    G.events.emit('sfx', { k: 'page' });
    G.ui.showHint(G.mode === 'desktop' ? this.pageIt.deskHint : this.pageIt.hint, 8);
    await D.until(() => s.journal === 2);
    G.ui.showHint('');
    G.events.emit('sfx', { k: 'page' });
    await D.wait(1.2);
    s.phase = 'done';
  }

  faceToward(from, to) { return Math.atan2(-(to.x - from.x), -(to.z - from.z)); }

  // ---------- Every frame, every headset ----------
  update(dt, t) {
    const G = this.G, s = this.s, host = G.isHost, fast = G.params.has('fast') ? 4 : 1;
    // Host-side timelines
    if (host) {
      if (s.phase === 'arrive' || s.phase === 'walk' || s.phase === 'explain' || s.phase === 'pull') s.sunEl = Math.min(-3.2, s.sunEl + dt * 0.02 * fast);
      if (s.phase === 'pull' && this.pullStart != null && G.t - this.pullStart > 45) s.pulled = Math.min(PULL_NEEDED, s.pulled + dt * 0.12); // the builders finish it if you need help
      if (s.phase === 'raise') s.raise = Math.min(1, s.raise + dt / 4.5 * fast);
      if (s.phase === 'sunrise') s.sunEl = Math.min(2.6, s.sunEl + dt * 0.22 * fast);
      if (s.phase === 'lapse') s.lapse = Math.min(1, s.lapse + dt / 14 * fast);
      if (s.phase === 'gap' || s.phase === 'sunrise') s.mist = Math.max(0.2, s.mist - dt * 0.02);
      if (s.phase === 'lapse' || s.phase === 'closing' || s.phase === 'journal' || s.phase === 'done') s.sunEl = Math.min(4, s.sunEl + dt * 0.08);
    }
    // Sky
    const lapAz = s.phase === 'lapse' ? AXIS + (WINTER - AXIS) * Math.sin(Math.PI * ease(s.lapse)) : AXIS - 1;
    s.sunAz = lapAz;
    G.sky.sunSize = 1.4;
    G.sky.set(s.sunAz, s.sunEl);
    G.sky.mist = damp(G.sky.mist, s.mist, 0.8, dt);
    // Season name during the time-lapse
    if (s.phase === 'lapse') {
      const k = s.lapse, name = k < 0.12 ? 'Summer' : k < 0.38 ? 'Autumn' : k < 0.62 ? 'Winter' : k < 0.88 ? 'Spring' : 'Summer again';
      if (name !== this.season) { this.season = name; G.ui.showHint(name, 3.5); }
    }

    // The moving stone: slide in on the sledge, then tip up into its pit
    const want = s.pulled / PULL_NEEDED;
    const prev = this.view.p;
    this.view.p = damp(this.view.p, want, 3, dt);
    const moved = (this.view.p - prev) * (PULL_FROM - PULL_TO);
    const foot = lerp(PULL_FROM, PULL_TO, this.view.p);
    const rz = ease(s.raise);
    at(SLOT, foot, lerp(0.52, -1.0, rz), this.pivot.position);
    this.pivot.position.y += groundHeight(this.pivot.position.x, this.pivot.position.z);
    this.pivot.quaternion.slerpQuaternions(this.qLying, this.qStanding, rz);
    // Sledge sits under the lying stone; once the stone is up the builders drag it away
    const sl = at(SLOT, foot + 2.6 + s.raise * 3);
    this.sledge.position.set(sl.x, groundHeight(sl.x, sl.z), sl.z);
    this.sledge.rotation.y = -SLOT * D2R;
    for (let i = 0; i < 3; i++) { const p = at(SLOT, foot + 0.9 + i * 1.7); this.blk[i].x = p.x; this.blk[i].z = p.z; this.blk[i].r = s.raise > 0.5 && i ? 0 : 1.0; }
    // The rope, from the stone's foot to the far end across the middle (slack once it's up)
    at(SLOT, foot - 0.2, 0.55, this.ropeStart);
    this.rope.position.copy(this.ropeStart);
    this.rope.lookAt(this.ropeEnd);
    this.rope.scale.set(1, 1, this.ropeStart.distanceTo(this.ropeEnd));
    this.rope.visible = s.raise < 0.05;
    this.ropeTex.repeat.set(1, this.rope.scale.z * 4);
    this.ropeTex.offset.y = -this.view.p * (PULL_FROM - PULL_TO) * 4;
    // Lintels lowered onto the new stone once it stands
    for (const L of this.waitingLintels) {
      const k = clamp((s.raise - 0.85) / 0.15, 0, 1);
      L.visible = s.raise >= 1 || k > 0;
      L.position.copy(L.userData.home); L.position.y += (1 - ease(k)) * 3;
    }
    // Sounds of the haul
    if (s.phase === 'pull') {
      this.drumT -= dt; if (this.drumT <= 0) { this.drumT = 1.2; G.audio.drum(at(SLOT, 26, 1)); }
      this.scrapeAcc += Math.abs(moved);
      if (this.scrapeAcc > 0.3) { this.scrapeAcc = 0; G.audio.scrape(this.pivot.position); }
      this.creakT -= dt; if (this.creakT <= 0 && moved > 0.001) { this.creakT = 0.8 + Math.random(); G.audio.creak(this.ropeStart); }
    }
    if (s.phase === 'raise' && !this.raisedSfx && s.raise > 0.97) { this.raisedSfx = true; G.audio.boom(this.pivot.position); this.puff(); }

    // The beam: only when the Sun is up and right on the axis
    const onAxis = clamp(1.5 - Math.abs(s.sunAz - AXIS) / 3, 0, 1), up = clamp((s.sunEl - 0.2) / 1.2, 0, 1);
    const beam = up * onAxis * (s.raise >= 1 ? 1 : 0);
    this.beamV = damp(this.beamV || 0, beam, 2, dt);
    for (const m of this.beamMats) m.opacity = this.beamV * 0.35;
    this.floorLight.material.opacity = this.beamV * 0.5;
    this.beam.visible = this.floorLight.visible = this.beamV > 0.01;
    // Sun path along the horizon
    this.pathV = damp(this.pathV || 0, s.path, 2, dt);
    this.path.visible = this.pathV > 0.01;
    for (const m of this.pathMats) m.opacity = this.pathV;
    // Stand-here ring
    this.ringV = damp(this.ringV || 0, s.ring, 3, dt);
    this.ring.position.copy(s.phase === 'pull' ? this.pullSpot() : this.ringSpot).setY(groundHeight(this.ring.position.x, this.ring.position.z) + 0.05);
    this.ring.material.opacity = this.ringV * (0.55 + 0.25 * Math.sin(t * 3));
    this.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
    this.ring.visible = this.ringV > 0.01;

    // People
    for (const P of this.people) {
      if (P.role === 'haul') {
        P.pose = s.phase === 'pull' && (this.view.p < want - 0.002 || G.t - (this.pullStart ?? 0) > 45) ? 'pull' : s.cheer ? 'cheer' : s.point ? 'point' : 'idle';
        // they walk backward a little as they haul, then return between pulls
        const back = (this.view.p * (PULL_FROM - PULL_TO)) % 1.2;
        if (s.raise >= 1) {
          // walk over to their watching spot (instantly when it's dark: the fade hides it)
          P.g.position.lerp(_a.copy(P.watch).setY(groundHeight(P.watch.x, P.watch.z)), G.ui.fade > 0.9 ? 1 : 1 - Math.exp(-dt * 0.8));
          P.g.rotation.y = P.watchFace;
        } else P.g.position.copy(P.home).addScaledVector(this.u, -back * (s.phase === 'pull' ? 1 : 0));
      } else if (P.role === 'pit') P.pose = s.phase === 'raise' ? 'pull' : s.cheer ? 'cheer' : s.point ? 'point' : 'idle';
      else P.pose = s.cheer ? 'cheer' : s.point ? 'point' : 'idle';
      at(SLOT, R_SARSEN, 1.5, P.pointAt);
      animatePerson(P, t, dt);
      P.blk.x = P.g.position.x; P.blk.z = P.g.position.z;
    }

    // Guide: hover where the story wants it, or beside you
    if (s.guide) { _a.fromArray(s.guide); if (!this.guideAt || !this.guideAt.equals(_a)) { this.guideAt = _a.clone(); G.guide.flyTo(this.guideAt); G.guide.chime(); } }
    else if (this.guideAt) { this.guideAt = null; G.guide.follow(); }
    // The journal page floats in front of you, held up by the guide
    this.journal.visible = s.journal === 1;
    if (s.journal === 1) {
      G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize();
      if (!this.pageSet) { this.pageSet = true; this.journal.position.copy(_a).addScaledVector(_b, 0.62); this.journal.position.y -= 0.2; }
      this.journal.lookAt(_a);
      this.journal.position.y += Math.sin(t * 1.6) * 0.0006;
      G.guide.flyTo(_c.copy(this.journal.position).add(_b.set(-_b.z * 0.4, 0.12, _b.x * 0.4)), _a);
      this.guideAt = this.guideAt || _c.clone();
    }

    // Smoke from the village roofs
    for (const sp of this.smoke) {
      const u = sp.userData; u.t = (u.t + dt * 0.04) % 1;
      sp.position.copy(u.base); sp.position.y += u.t * 14; sp.position.x += u.t * u.t * 6;
      sp.scale.setScalar(1.5 + u.t * 6); sp.material.opacity = (1 - u.t) * 0.7;
    }
    // Dust
    for (const d of this.dust) if (d.visible) {
      d.userData.t += dt; const k = d.userData.t / 2.5;
      d.position.addScaledVector(d.userData.v, dt); d.scale.setScalar(0.5 + k * 3);
      d.material.opacity = (1 - k) * 0.6; if (k >= 1) d.visible = false;
    }
    // Birds wake up as it gets light
    if (s.sunEl > -6) { this.birdT -= dt; if (this.birdT <= 0) { this.birdT = 1 + Math.random() * 4; G.audio.chirp(at(Math.random() * 360, 30 + Math.random() * 40, 4)); } }
  }

  puff() {
    for (const d of this.dust) {
      d.visible = true; d.userData.t = Math.random() * 0.4;
      d.position.copy(at(SLOT, R_SARSEN, 0.3)).add(_a.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2));
      d.userData.v = new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.3 + Math.random() * 0.4, (Math.random() - 0.5) * 1.6);
    }
  }

  dispose() {
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
  }
}
