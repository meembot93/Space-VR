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
import { texGround } from '../surfaces.js';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, holdProp } from '../people.js';
import { dress } from '../dress.js';
import { makeHerd, makeFlock, Life } from '../life.js';
import { dirFromAzEl } from '../sky.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { makeJournalPage } from '../journal.js';
import { rng, noise2, roughStone } from '../shapes.js';
import { grove, deciduousTree, grassTuft } from '../trees.js';
import { loadProps } from '../props.js';

// Meem's stones, houses and sledge. The circle's ~110 stones use the simplified (_lo, ~600 triangle)
// stones; the one the builders raise uses the full one. Missing models fall back to the code stones.
const PROPS = await loadProps(['sarsen_stone', 'sarsen_stone_lo', 'sarsen_lintel', 'sarsen_lintel_lo', 'bluestone_lo', 'roundhouse', 'stone_sledge'],
  { stone_sledge: { z: 4 } });
// Meem's stone textures are dark under the pre-dawn sky: lift them to the pale grey of the old stones,
// with a little light of their own so the circle still reads before sunrise
for (const [n, k, e] of [['sarsen_stone', 1.55, 0x262420], ['sarsen_stone_lo', 1.55, 0x262420], ['sarsen_lintel', 1.55, 0x262420],
  ['sarsen_lintel_lo', 1.55, 0x262420], ['bluestone_lo', 1.3, 0x1a1c20]]) {
  const m = PROPS.models[n]?.material; if (!m) continue;
  m.color.setScalar(k); m.emissive.setHex(e); m.emissiveMap = m.map;
}
// A single (not instanced) mesh of one of the models, stretched to w x h x d (for the moving stone,
// the waiting lintels and the sledge, which the story moves)
function propMesh(name, w, h, d) {
  const M = PROPS.models[name]; if (!M) return null;
  const g = M.geometry.clone(); g.scale(w / M.size.x, h / M.size.y, d / M.size.z);
  return new THREE.Mesh(g, M.material);
}

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

let _glowTex = null;
function glowTex() { return (_glowTex ||= canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); })); }
function glowSprite(color = 'rgba(255,220,140,1)') {
  const t = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
}

// Who's who. Every person near you is a different one of Meem's models, dressed in undyed wool, hide
// and plant-dyed browns, greys and ochres; where a model has to come back (the haul team is big), the
// copy wears other clothes and stands well away from the first.
const HAULERS = [
  ['builder', {}], ['sailor', { hue: 0.55, sat: 0.45, val: 0.8, build: 1.05 }], ['instrument_maker', { mul: 0x9a8264, sat: 0.8 }], ['skywatcher', { hue: 0.08, sat: 0.4, val: 0.85, hair: 0x4a3828 }],
  ['storyteller', { hue: 0.97, sat: 0.9, val: 0.95 }], ['priest', { mul: 0xa48a6c, hair: 0x2a1c12 }], ['villager', { mul: 0x8a7458, build: 1.08 }], ['architect', { mul: 0xb0a080, sat: 0.6 }],
  ['builder', { hue: 0.12, sat: 0.55, val: 1.25, hair: 0x7a6a5a, build: 0.95 }], ['sailor', { hue: 0.6, sat: 0.3, val: 0.6, hair: 0x2a2018 }],
];
const PIT = [['aristotle', { mul: 0x8a7a64, sat: 0.6, hair: 0x3a2a1a }], ['instrument_maker', { mul: 0x6e6050, hair: 0x4a3a2a, build: 1.07 }], ['skywatcher', { hue: 0.5, sat: 0.3, val: 0.7, hair: 0x9a948c }]];
const CROWD = [
  ['builder_far', { hue: 0.05, sat: 0.6, val: 1.15 }], ['storyteller', { hue: 0.06, sat: 0.5, val: 0.7 }], ['builder_far', { hue: 0.58, sat: 0.35, val: 0.75, build: 1.06 }], ['villager', { mul: 0x7a6a54 }],
  ['builder_far', { hue: 0.93, sat: 0.8, val: 0.85, build: 0.95 }], ['architect', { mul: 0x8a7050, sat: 1.1 }], ['priest', { mul: 0x9a9080, val: 0.85 }],
];
// (the families gather a little beyond the crowd, so nobody stands near their double)
const FAMILIES = [
  ['sailor', { hue: 0.06, sat: 0.55, val: 0.8 }], ['instrument_maker', { mul: 0x7a6c5a, sat: 0.7, build: 1.05 }], ['aristotle', { mul: 0x9a8a72, sat: 0.5 }],
  ['builder', { hue: 0.65, sat: 0.3, val: 0.95, hair: 0x5a4a3a }], ['architect', { mul: 0x9a8064, val: 0.95 }], ['priest', { mul: 0x8a7c6a, hair: 0x1a1410, build: 1.04 }],
];

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
      sunTo: null,     // ch2_04: where the little "sun marker" walks along the horizon (bearing)
      gasp: 0,         // the crowd gasps at the first light
      home: 0,         // the end: people head home to the village
    };
    this.view = { p: 0 };
    G.world.height = groundHeight;
    G.world.bounds = 190;
    G.world.blockers = [];
    G.sky.fogFar = 900;
    G.sky.setPlace({ lat: 51.18, year: -2500, sunLon: 90 }); // Salisbury Plain, midsummer, 2500 BC
    G.audio.amb = 1;

    this.buildGround();
    this.buildStones();
    this.buildVillage();
    this.buildMovingStone();
    this.buildPeople();
    this.buildEffects();
    this.buildLife();
    this.journal = makeJournalPage('stonehenge');
    this.journal.visible = false; this.root.add(this.journal);
    this.registerInteractables();
    this.drumT = 0; this.birdT = 3; this.creakT = 0; this.scrapeAcc = 0;
  }

  // ---------- Building the place ----------
  buildGround() {
    const SIZE = 900, SEG = 130;   // (5-7 m squares: thinned in v14 to spend triangles on the night sky)
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
    const m = texGround(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })), { pale: 'sand' });
    this.root.add(m);

    // Grass clumps: thin leaning blades, thickest where you walk, plus a scatter of wild flowers
    const blade = grassTuft({ blades: 6, height: 0.32, seed: 3, root: 0x34461e, tip: 0xc4d488 });   // curved blades (js/trees.js)
    const N = 4600, tufts = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), N);
    const r = rng(5), mm = new THREE.Matrix4(), cc = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < N; i++) {
      const az = r() * 360, rad = 4.5 + Math.pow(r(), 1.6) * 85, pos = at(az, rad);   // (far grass is too small to see)
      pos.y = groundHeight(pos.x, pos.z);
      _q.setFromAxisAngle(up, r() * 6.28);
      const sc = 0.7 + r() * 0.8;
      mm.compose(pos, _q, _a.set(sc, sc * (0.7 + r() * 0.7), sc)); tufts.setMatrixAt(i, mm);
      tufts.setColorAt(i, cc.setHex(0xd8f0c0).lerp(new THREE.Color(0xfff4d0), r() * 0.8));
    }
    this.root.add(tufts);
    const NF = 1400, flowers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.035, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x222222 }), NF);
    const fc = [0xf4f0e0, 0xf2d24a, 0xb48ad8, 0xf0f0ff];
    for (let i = 0; i < NF; i++) {
      // little patches of the same colour together
      const patch = i / 20 | 0, pr = rng(900 + patch), paz = pr() * 360, prad = 8 + pr() * 90;
      const pos = at(paz, prad).add(_b.set((r() - 0.5) * 6, 0, (r() - 0.5) * 6));
      pos.y = groundHeight(pos.x, pos.z) + 0.18 + r() * 0.12;
      mm.compose(pos, _q.identity(), _a.setScalar(0.7 + r() * 0.6)); flowers.setMatrixAt(i, mm);
      flowers.setColorAt(i, cc.setHex(fc[patch % 4]));
    }
    this.root.add(flowers);
  }

  buildStones() {
    const k = new Kit(), G = this.G, r = rng(7), P = PROPS.fresh();
    const SARSEN = 0xa59f90, BLUE = 0x7c8590;
    // Each stone keeps its exact place and size: Meem's model (name) stretched to it if it loaded,
    // else the code stone. (geo is the code stone: a roughStone(w, h, d), standing on y = 0.)
    const place = (geo, color, pos, yaw, block, name) => {
      geo.computeBoundingBox(); const b = geo.boundingBox, y = pos.y + groundHeight(pos.x, pos.z) - 0.05;
      if (name && P.add(name, pos.x, y, pos.z, yaw, { w: b.max.x - b.min.x, h: b.max.y - b.min.y, d: b.max.z - b.min.z, tilt: geo.userData.tilt })) geo.dispose();
      else { geo.rotateY(yaw); geo.translate(pos.x, y, pos.z); k.add(geo, color); }
      if (block) G.world.blockers.push({ x: pos.x, z: pos.z, r: block });
    };
    // The sarsen circle: 30 uprights (one missing: the last one, still on its sledge) and lintels
    this.sarsenAz = [];
    for (let i = 0; i < 30; i++) {
      const az = SLOT + i * (360 - 12.8) / 29; this.sarsenAz.push(az);
      if (i === 0) continue; // the missing one
      const pos = at(az, R_SARSEN);
      place(roughStone(2.1 + r() * 0.3, 4.1 + r() * 0.3, 1.05, 100 + i), SARSEN, pos, -az * D2R, 0.9, 'sarsen_stone_lo');
    }
    // Lintels: a ring on top, each spanning two uprights (the two that rest on the missing stone wait)
    for (let i = 0; i < 30; i++) {
      if (i === 0 || i === 29) continue;
      const a1 = this.sarsenAz[i], a2 = this.sarsenAz[(i + 1) % 30];
      if (i === 29) continue;
      const mid = (a1 + a2) / 2, pos = at(mid, R_SARSEN, 4.3);
      const len = 2 * R_SARSEN * Math.sin((a2 - a1) / 2 * D2R) + 0.4;
      const geo = roughStone(len, 0.8, 1.0, 300 + i, [4, 1, 1]);
      place(geo, SARSEN, pos, -mid * D2R, 0, 'sarsen_lintel_lo');
    }
    // The two lintels that will sit on the last stone, ready to be lowered in when it stands
    this.waitingLintels = [];
    for (const [i, j] of [[29, 0], [0, 1]]) {
      const a1 = this.sarsenAz[i], a2 = this.sarsenAz[j] + (j < i ? 360 : 0), mid = (a1 + a2) / 2;
      const len = 2 * R_SARSEN * Math.sin((a2 - a1) / 2 * D2R) + 0.4;
      let m = propMesh('sarsen_lintel', len, 0.8, 1.0);
      if (!m) {
        const lk = new Kit(); lk.add(roughStone(len, 0.8, 1.0, 400 + i, [4, 1, 1]), SARSEN);
        const geo = lk.geometry(); tintStones(geo, SARSEN, 9);
        m = new THREE.Mesh(geo, FLAT);
      }
      m.rotation.y = -mid * D2R;
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
        place(roughStone(2.2, ht, 1.3, 500 + n * 2 + s, [3, 7, 2]), SARSEN, pos, -az * D2R, 1.05, 'sarsen_stone_lo');
      }
      place(roughStone(5.0, 1.0, 1.2, 520 + n, [4, 1, 1]), SARSEN, c.clone().setY(ht), -az * D2R, 0, 'sarsen_lintel_lo');
    });
    // Bluestones: smaller, darker stones in a circle inside the sarsens (with gaps to walk through)
    for (let i = 0; i < 44; i++) {
      const az = AXIS + 6 + i * 360 / 44 + (r() - 0.5) * 2;
      const rel = ((az - AXIS + 540) % 360) - 180;
      if (Math.abs(rel) < 9 || i % 6 === 3) continue; // keep the entrance and a few walkways clear
      place(roughStone(0.8 + r() * 0.4, 1.6 + r() * 0.7, 0.6, 700 + i, [2, 4, 2]), BLUE, at(az, 12.2), -az * D2R, 0.45, 'bluestone_lo');
    }
    // The Altar Stone, lying in the middle of the horseshoe
    place(roughStone(4.8, 0.5, 1.0, 800, [4, 1, 2]), 0x8a7a70, at(AXIS + 180, 4.2), -(AXIS + 90) * D2R, 0, 'sarsen_lintel_lo');
    // The Heel Stone out on the axis, and the Station Stones
    const heel = roughStone(2.4, 4.7, 2.0, 801, [3, 6, 3]); heel.userData.tilt = [0, -0.12];
    place(heel, SARSEN, at(AXIS + 1.6, 77), -AXIS * D2R, 1.3, 'sarsen_stone_lo');
    for (const az of [AXIS + 90 + 28, AXIS - 90 - 28, AXIS + 90 - 28 + 180, AXIS - 90 + 28 + 180]) place(roughStone(1.0, 2.0, 0.8, 810 + az, [2, 3, 2]), SARSEN, at(az, 41), -az * D2R, 0.6, 'sarsen_stone_lo');
    if (k.parts.length) { const geo = k.geometry(); tintStones(geo, SARSEN, 3); this.stones = new THREE.Mesh(geo, FLAT); this.root.add(this.stones); }
    this.root.add(P.build());
  }

  buildVillage() {
    const k = new Kit(), r = rng(13), center = at(150, 165), G = this.G, P = PROPS.fresh();
    // Round houses: wattle-and-daub walls, tall thatched cone roofs, a dark doorway (toward the stones)
    // (each house reaches rad + 0.6 out at the eaves: a new one keeps clear of those already placed)
    const placed = [];
    for (let i = 0, tries = 0; i < 9 && tries < 200; tries++) {
      const a = r() * 6.28, d = 8 + r() * 30, x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d, y = groundHeight(x, z);
      const rad = 3.2 + r() * 1.6, wall = 1.5 + r() * 0.3;
      if (placed.some((h) => Math.hypot(h.x - x, h.z - z) < h.rad + rad + 2.4)) continue;
      placed.push({ x, z, rad }); i++;
      const toC = Math.atan2(-x, -z);
      if (!P.add('roundhouse', x, y - 0.1, z, toC, { w: (rad + 0.6) * 2, d: (rad + 0.6) * 2, h: wall + rad * 1.15 + 0.1 })) {
        k.cyl(rad, rad, wall, 22, 0xb8a07a, [x, y + wall / 2, z]);
        k.cyl(0.05, rad + 0.6, rad * 1.15, 22, 0xc2a35a, [x, y + wall + rad * 0.55, z]);
        k.box(0.9, 1.2, 0.3, 0x3a2a1a, [x + Math.sin(toC) * rad, y + 0.6, z + Math.cos(toC) * rad], [0, toC, 0]);
      }
      G.world.blockers.push({ x, z, r: rad + 0.3 });
      (this.chimneys ||= []).push(new THREE.Vector3(x, y + wall + rad * 1.1, z));
    }
    // Trees (built below, after the village's own mesh)
    // Wooden sledges, spare rollers and rope coils left near the circle
    for (let i = 0; i < 5; i++) {
      const p = at(AXIS + 30 + i * 9, 27 + r() * 4); p.y = groundHeight(p.x, p.z);
      const yaw = r() * 3;
      // two spare sledges among the rollers
      if (i % 2 === 0 && P.add('stone_sledge', p.x, p.y, p.z, yaw + 1.2, { w: 1.9, d: 5.0, h: 0.42 })) continue;
      k.cyl(0.14, 0.14, 2.8, 6, 0x7a5a38, [p.x, p.y + 0.14, p.z], [Math.PI / 2, 0, yaw]);
    }
    this.root.add(k.mesh(), P.build());
    this.buildTrees();
    // Smoke rising from the roofs (a handful of soft sprites per house)
    this.smoke = [];
    const sm = new THREE.SpriteMaterial({ map: canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(200,200,205,0.55)'); gr.addColorStop(1, 'rgba(200,200,205,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false });
    for (const c of this.chimneys) for (let j = 0; j < 4; j++) {
      const s = new THREE.Sprite(sm); s.userData = { base: c, t: j / 4 }; this.root.add(s); this.smoke.push(s);
    }
  }

  // Full-size trees, 9 to 16 m tall like real oaks and ash: a few copses and lone trees on the
  // slopes away from the sunrise, and a dark belt of woodland along the far horizon.
  buildTrees() {
    const r = rng(31), G = this.G;
    const leaves = [], near = [], far = [];
    const dark = new THREE.Color(0x2c4320), mid = new THREE.Color(0x456a2e), light = new THREE.Color(0x7a9a48), tmp = new THREE.Color();
    const okAz = (az) => { const a = ((az % 360) + 360) % 360; return a > 165 || a < 15; }; // keep the sunrise side open
    const village = at(150, 165);
    // real branching oaks (js/trees.js), more detailed nearer the circle
    const tree = (x, z, s) => {
      // (use up the random numbers the old blob trees drew, so the woods stand where they always did)
      const isFar = Math.hypot(x, z) > 150; r(); r();
      const nb = isFar ? 3 : 3 + (r() * 2 | 0); for (let i = 0; i < nb; i++) r();
      const nBlob = isFar ? 6 + (r() * 2 | 0) : 7 + (r() * 4 | 0); for (let i = 0; i < nBlob; i++) { r(); r(); if (i) { r(); r(); } }
      (isFar ? far : near).push({ x, y: groundHeight(x, z) - 0.15, z, s });
      if (Math.hypot(x, z) < G.world.bounds + 5) G.world.blockers.push({ x, z, r: 0.6 * s });
    };
    // copses of trees, and some lone trees standing out in the grass
    for (let c = 0; c < 9; c++) {
      let az, d, p; do { az = 165 + r() * 210; d = 85 + r() * 230; p = at(az, d); } while (Math.hypot(p.x - village.x, p.z - village.z) < 50);
      const n = 4 + (r() * 9 | 0);
      for (let i = 0; i < n; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * (8 + n * 1.6); tree(p.x + Math.cos(a) * rr, p.z + Math.sin(a) * rr, 0.85 + r() * 0.45); }
    }
    for (let i = 0; i < 16; i++) {
      const az = 160 + r() * 220, d = 70 + r() * 150, p = at(az, d);
      if (!okAz(az) || Math.hypot(p.x - village.x, p.z - village.z) < 45) continue;
      tree(p.x, p.z, 0.9 + r() * 0.5);
    }
    // a few trees around the village, for shade
    for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = 42 + r() * 18; tree(village.x + Math.cos(a) * d, village.z + Math.sin(a) * d, 0.9 + r() * 0.3); }
    // far woodland: long low dark humps along the horizon (cheap: big rough blobs)
    for (let az = 172; az < 372; az += 2.6) {
      if (r() < 0.25) continue;
      const d = 400 + r() * 40, p = at(az, d), rad = 10 + r() * 9;
      const g = new THREE.IcosahedronGeometry(rad, 0); g.scale(1.3, 0.55 + r() * 0.2, 1.3);
      g.translate(p.x, groundHeight(p.x, p.z) + rad * 0.35, p.z); leaves.push(g);
    }
    this.root.add(grove(deciduousTree, near, { detail: 'mid', height: 12, seed: 31, variants: 5 }).group);
    this.root.add(grove(deciduousTree, far, { detail: 'low', height: 12, seed: 37, variants: 4 }).group);
    // colour the far woodland vertex by vertex (shade and sun), then merge into one mesh
    const lk = new Kit();
    for (const g of leaves) {
      g.computeBoundingBox(); const bb = g.boundingBox, h = bb.max.y - bb.min.y;
      const out = lk.add(g, 0xffffff), p = out.attributes.position, c = out.attributes.color;
      const tone = r();
      for (let j = 0; j < p.count; j++) {
        const t = (p.getY(j) - bb.min.y) / h;
        tmp.copy(dark).lerp(mid, clamp(t * 1.4, 0, 1)).lerp(light, clamp((t - 0.6) * 1.6, 0, 1) * (0.5 + tone * 0.5));
        c.setXYZ(j, tmp.r, tmp.g, tmp.b);
      }
    }
    this.root.add(lk.mesh());
  }

  buildMovingStone() {
    const u = at(SLOT, 1); this.u = u;              // outward along the slot's radius
    // The stone, built standing with its foot at the origin
    this.big = propMesh('sarsen_stone', 2.15, STONE_LEN, 1.05);
    if (!this.big) {
      const k = new Kit(); k.add(roughStone(2.15, STONE_LEN, 1.05, 999), 0xa59f90);
      const geo = k.geometry(); tintStones(geo, 0xa59f90, 4);
      this.big = new THREE.Mesh(geo, FLAT);
    }
    this.pivot = new THREE.Group(); this.pivot.add(this.big); this.root.add(this.pivot);
    this.qLying = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), u);
    this.qStanding = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -SLOT * D2R);
    this.qLying.multiply(this.qStanding);
    // Its wooden sledge, and the rollers laid along the ground in front of it
    this.sledge = propMesh('stone_sledge', 1.9, 0.44, 5.6);
    if (!this.sledge) {
      const sk = new Kit();
      for (const s of [-1, 1]) sk.box(0.22, 0.25, 5.6, 0x6e4e2e, [s * 0.75, 0.12, 0]);
      for (let i = 0; i < 6; i++) sk.box(1.9, 0.12, 0.2, 0x7e5a36, [0, 0.3, -2.5 + i]);
      this.sledge = sk.mesh();
    }
    this.root.add(this.sledge);
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
      const [model, look] = HAULERS[i];
      const H = dress(add(p, faceOut, { model }, 'haul'), look);
      // after the stone is up they step aside, either side of the axis, to watch the gap
      const side2 = i % 2 ? 1 : -1, w = at(AXIS + side2 * (40 + Math.floor(i / 2) * 11), 9 + (i % 4) * 0.8);
      H.watch = w; H.watchFace = Math.atan2(at(AXIS, 40).x - w.x, at(AXIS, 40).z - w.z);
    }
    // A team by the pit with levers, and a crowd waiting near the Heel Stone
    for (let i = 0; i < 3; i++) dress(add(at(SLOT + 5 + i * 5, R_SARSEN + 3.5), Math.atan2(-this.u.x, -this.u.z), { model: PIT[i][0] }, 'pit'), PIT[i][1]);
    for (let i = 0; i < 7; i++) {
      // standing either side of the sunrise line, so nobody blocks the view through the gap
      const p = at(AXIS + (i < 4 ? -16 - i * 5 : 16 + (i - 4) * 5) + (r() - 0.5) * 2, 30 + r() * 6);
      dress(add(p, Math.atan2(-p.x, -p.z), { model: CROWD[i][0] }, 'crowd'), CROWD[i][1]);   // ~30 m away: light models where there are some
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
    // (small, even dots: a big one at either end looked like a second Sun)
    for (let az = AXIS + 4; az <= WINTER - 4; az += 4) {
      const s = new THREE.Sprite(dot); dirFromAzEl(az, -0.2, s.position).multiplyScalar(300); s.scale.setScalar(3.2); this.path.add(s);
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

  // ---------- Life on the plain ----------
  // Cattle and sheep in the fields between you and the village, a shepherd and his dog, families
  // walking out from the village with torches to watch the sunrise, and birds once it's light.
  buildLife() {
    this.life = new Life(this.root);
    // (directions from where you start toward the village)
    const S = this.start.pos, V = at(150, 165), dir = _a.subVectors(V, S).setY(0).normalize().clone(), side = new THREE.Vector3(dir.z, 0, -dir.x);
    const along = (d, sd = 0) => S.clone().addScaledVector(dir, d).addScaledVector(side, sd);
    const c = along(17, 7);   // (life-size cattle: a few, with room to graze)
    this.cattle = this.life.add(makeHerd('cow', { n: 4, area: { x: c.x, z: c.z, r: 8 }, height: groundHeight, seed: 31, far: 14 }));
    const sh = along(20, -8);
    this.sheep = this.life.add(makeHerd('sheep', { n: 6, area: { x: sh.x, z: sh.z, r: 5 }, height: groundHeight, mode: 'follow', seed: 32, far: 14 }));   // (far: light copies beyond 14 m keep the scene in its triangle budget)
    this.dog = this.life.add(makeHerd('dog', { n: 1, area: { x: sh.x, z: sh.z, r: 3 }, height: groundHeight, mode: 'follow', seed: 33 }));
    this.flock = this.life.add(makeFlock({ n: 16, center: new THREE.Vector3(0, 28, 0), r: 30, height: 8, color: 0x1a1a1c, seed: 34 }));
    this.flock.group.visible = false;
    this.walkers = [];
    const torch = () => {
      const g = new THREE.Group(), k = new Kit(); k.cyl(0.025, 0.03, 0.8, 5, 0x4a3420, [0, 0.4, 0]); k.cyl(0.05, 0.04, 0.12, 6, 0x2a1a10, [0, 0.82, 0]); g.add(k.mesh());
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      f.position.y = 0.98; f.scale.set(0.35, 0.5, 1); g.add(f); g.userData.flame = f; return g;
    };
    // the shepherd, walking his flock slowly about the field
    const shep = dress(makePerson({ model: 'skywatcher', seed: 301, tunic: 0x6a5a40, beard: true }), { hue: 0.06, sat: 0.35, val: 0.75, hair: 0x8a8278 });
    shep.g.position.copy(sh).setY(groundHeight(sh.x, sh.z)); this.root.add(shep.g); shep.glance = true;
    shep.routine = [0, 1, 2, 3].map((i) => { const p = along(17 + (i % 2) * 8, -6 - (i > 1 ? 6 : 0)); return { x: p.x, z: p.z, pose: i === 2 ? 'beckon' : 'idle', secs: 5 + i }; });
    const crook = new Kit(); crook.tube([[0, 0, 0], [0, 1.5, 0], [0.08, 1.65, 0], [0.16, 1.55, 0]], 0.02, 0x6a5038, 4);
    holdProp(shep, crook.mesh(), 'Right', [0, 0.05, 0.03]);
    this.shepherd = shep; this.walkers.push(shep);
    // families with torches, coming out from the village to the stones before dawn
    const route = [along(130, 4), along(95, 2), along(60, -2), along(25, -16), at(AXIS - 48, 42), at(AXIS - 45, 34)];
    for (let i = 0; i < 6; i++) {
      const P = makePerson({ model: FAMILIES[i][0], seed: 320 + i * 9,   // seen from far off, so light models where there are some
        tunic: [0x8a7a64, 0x7a6a50, 0x9a8466][i % 3], height: i === 4 ? 1.3 : 1.7 + (i % 2) * 0.08 });
      dress(P, FAMILIES[i][1]);
      const k = 1 + Math.floor(i / 2), p = route[k];
      const off = (i % 2 ? 1 : -1) * 0.7, back = (i % 2) * 1.4;
      P.g.position.set(p.x + off, groundHeight(p.x, p.z), p.z + back); this.root.add(P.g);
      P.routine = route.slice(k + 1).map((q, j, a) => ({ x: q.x + off + (j === a.length - 1 ? i * 1.1 : 0), z: q.z + back, pose: 'idle', secs: j === a.length - 1 ? 1e9 : 0.01, look: j === a.length - 1 ? at(AXIS, 60, 2) : null }));
      if (i !== 4) { const tc = torch(); holdProp(P, tc, i % 2 ? 'Right' : 'Left', [0, 0.04, 0.03]); (this.torches ||= []).push(tc); }
      P.glance = true; P.walker = true; this.walkers.push(P);
    }
    // ch2_04: a little glowing sun that walks along the dotted line on the horizon
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.marker.scale.setScalar(26); this.root.add(this.marker); this.markerAz = WINTER;
    this.sunLook = at(AXIS, 80, 3);
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
    s.phase = 'walk'; s.ring = D.kids ? 0 : 1;
    D.hint('Walk to the glowing ring in the circle (left stick)', 8);
    const there = () => G.players.every((p) => { p.headPos?.(_a) ?? _a.copy(p.view?.head || this.ringSpot); return _a.distanceTo(this.ringSpot) < 2.2 || Math.hypot(_a.x, _a.z) < 12; });
    if (D.kids) { await D.wait(fast ? 0.2 : 1); await D.goTo(this.ringSpot, this.faceToward(this.ringSpot, at(SLOT, 20))); }
    else if (!(await D.until(there, fast ? 3 : 35))) {
      await G.ui.fadeOut(0.8); placeAll(this.ringSpot, this.faceToward(this.ringSpot, at(SLOT, 20))); await G.ui.fadeIn(1);
    }
    s.ring = 0; G.ui.showHint('');
    s.phase = 'explain';
    s.path = 1; s.guide = at(AXIS + 40, 7, 2.6).toArray();
    // the little sun walks the horizon as Astra tells it: winter, creeping along, summer, stop, back
    const l4 = D.sayAsync('ch2_04');
    await D.cue('In winter'); s.sunTo = WINTER;
    await D.cue('day by day'); s.sunTo = AXIS;
    await D.cue('turns around'); s.sunTo = AXIS + 22;
    await l4;
    s.point = 1; s.guide = at(SLOT, R_SARSEN - 1, 2.4).toArray(); s.sunTo = AXIS;
    await D.say('ch2_05');
    s.path = 0; s.sunTo = null;
    // Haul the stone in
    s.point = 0; s.phase = 'pull'; s.ring = D.kids ? 0 : 1; this.ringSpot.copy(this.pullSpot());
    s.guide = at(SLOT, 5.5, 1.8).toArray();
    await D.say('ch2_06');
    D.hint(G.mode === 'desktop' ? this.ropeIt.deskHint : this.ropeIt.hint, 7);
    this.pullStart = G.t;
    // Kids mode: the builders haul it in by themselves while you watch
    await D.auto(() => s.pulled >= PULL_NEEDED, (dt) => { s.pulled = Math.min(PULL_NEEDED, s.pulled + dt * (fast ? 3 : 0.6)); }, { after: fast ? 0.2 : 1.5 });
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
    s.guide = at(AXIS - 24, 8, 2.3).toArray();   // Astra waits beside the gap, not in front of it
    await G.ui.fadeIn(1.2);
    await D.say('ch2_07');
    s.phase = 'sunrise'; G.events.emit('sfx', { k: 'swell' });
    await D.until(() => s.sunEl >= 0.6);
    s.gasp = 1;                                         // everyone gasps at the first light...
    const l8 = D.sayAsync('ch2_08');
    await D.cue('Just like'); s.gasp = 0; s.cheer = 1;  // ...and cheers: just like they planned it
    await l8;
    s.cheer = 1; G.events.emit('sfx', { k: 'cheer' });
    await D.wait(fast ? 0.5 : 3);
    s.cheer = 0;
    // A year in a few seconds: the sunrise point walks to winter and back
    s.phase = 'lapse'; s.path = 1;
    await D.say('ch2_09');
    await D.until(() => s.lapse >= 1);
    s.path = 0; s.phase = 'closing';
    s.guide = null;
    const l10 = D.sayAsync('ch2_10');
    await D.cue('We still'); s.home = 1;                // the day begins: people head back to the village
    await l10;
    // The journal page
    s.journal = 1; s.phase = 'journal';
    G.events.emit('sfx', { k: 'page' });
    D.hint(G.mode === 'desktop' ? this.pageIt.deskHint : this.pageIt.hint, 8);
    await D.auto(() => s.journal === 2, () => this.act({ type: 'touchPage' }), { after: fast ? 0.5 : 4 });
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
    for (const m of this.pathMats) m.opacity = this.pathV * (m === this.pathMats[0] ? 0.6 : 1);
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
          const d0 = P.g.position.distanceTo(_a.copy(P.watch).setY(groundHeight(P.watch.x, P.watch.z)));
          P.g.position.lerp(_a, G.ui.fade > 0.9 ? 1 : Math.min(1, dt * 1.1 / Math.max(d0, 1e-3)));
          P.g.rotation.y = P.watchFace;
          if (d0 > 0.25 && G.ui.fade <= 0.9) { P.pose = 'walk'; P.stride = (P.stride || 0) + dt * 1.1 / 0.62 * Math.PI; P.g.rotation.y = Math.atan2(_a.x - P.g.position.x, _a.z - P.g.position.z); }
        } else P.g.position.copy(P.home).addScaledVector(this.u, -back * (s.phase === 'pull' ? 1 : 0));
      } else if (P.role === 'pit') P.pose = s.phase === 'raise' ? 'pull' : s.cheer ? 'cheer' : s.point ? 'point' : 'idle';
      else if (!P.walker) P.pose = s.cheer ? 'cheer' : s.point ? 'point' : 'idle';
      // Reactions: everyone gasps at the first light and watches the sunrise; otherwise they glance at you
      if (s.gasp && !P.walker) P.pose = 'gasp';
      P.glance = true;
      P.look = s.phase === 'sunrise' || s.gasp ? this.sunLook : null;
      at(SLOT, R_SARSEN, 1.5, P.pointAt);
      animatePerson(P, t, dt);
      P.blk.x = P.g.position.x; P.blk.z = P.g.position.z;
    }

    // Life: herds, the shepherd, the torch walkers, birds once the Sun is up
    if (s.home && !this.homeSet) {
      this.homeSet = true;
      const V = at(150, 120);
      [...this.people.filter((p) => p.role === 'crowd'), ...this.walkers.slice(1)].forEach((P, j) => { P.routine = [{ x: V.x + (j % 5) * 2.6, z: V.z + Math.floor(j / 5) * 2.6, pose: 'idle', secs: 1e9 }]; P.ri = 0; P.rt = 0; P.walker = true; });
      for (const P of this.people) if (P.role === 'crowd') this.walkers.push(P);
    }
    for (const P of this.walkers) {
      runRoutine(P, dt, { height: groundHeight, speed: P === this.shepherd ? 0.6 : 1.05 });
      if (P.walker && P.pose === 'idle' && s.gasp) P.pose = 'gasp'; else if (P.walker && P.pose === 'idle' && s.cheer) P.pose = 'cheer';
      if (P.blk) { P.blk.x = P.g.position.x; P.blk.z = P.g.position.z; }
      if (P.role === 'crowd') continue;   // (animated with the rest of the people above)
      animatePerson(P, t, dt);
    }
    this.sheep.lead.copy(this.shepherd.g.position); this.dog.lead.copy(this.shepherd.g.position);
    for (const tc of this.torches) { const f = tc.userData.flame; f.scale.set(0.3 + 0.06 * Math.sin(t * 13 + tc.id), 0.45 + 0.1 * Math.sin(t * 9 + tc.id * 2), 1); f.material.opacity = clamp(1 - (s.sunEl + 2) / 6, 0.15, 1); }
    this.flock.group.visible = s.sunEl > -1;
    this.life.update(dt, t);
    // ch2_04: the little sun on the horizon
    const mOn = s.sunTo != null && this.pathV > 0.3 ? 1 : 0;
    this.marker.material.opacity = damp(this.marker.material.opacity, mOn * 0.95, 2, dt);
    this.marker.visible = this.marker.material.opacity > 0.01;
    if (s.sunTo != null) this.markerAz += clamp(s.sunTo - this.markerAz, -dt * 9, dt * 9);
    else this.markerAz = WINTER;
    dirFromAzEl(this.markerAz, 1.2, this.marker.position).multiplyScalar(300);

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
