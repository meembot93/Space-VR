// Chapter 1: Campfire, 30,000 years ago. An Ice Age camp under a limestone cliff (think of the
// Dordogne in France), deep in a winter night.
//
// Astra introduces herself by the fire, you look up at a sky with no lights anywhere, then the
// storyteller hands you a piece of bone and a flint. Night after night you carve a mark while the
// Moon grows from a sliver to full and back again: about 29 marks, the first calendar.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, holdProp, dropProp } from '../people.js';
import { dress } from '../dress.js';
import { makeHerd, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { makeJournalPage } from '../journal.js';
import { rng, noise2, roughStone } from '../shapes.js';
import { grove, conifer, bareTree } from '../trees.js';
import { loadModel } from '../models.js';
import { loadProps } from '../props.js';

// Meem's camp models (each falls back to the old code shapes if it is missing)
const PROPS = await loadProps(['hide_tent', 'fire_pit', 'sitting_log', 'drying_rack', 'mammoth_tusks']);

const D2R = Math.PI / 180;
const MARKS = 29;                // nights in one round of the Moon's phases (29.5)
const N1 = noise2(41), N2 = noise2(57);
const at = (az, r, y = 0, out = new THREE.Vector3()) => out.set(Math.sin(az * D2R) * r, y, -Math.cos(az * D2R) * r);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

// Ground: a snowy valley floor, a steep cliff behind the camp (north), hills far off
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = (N1(x / 60, z / 60) - 0.5) * 6 * clamp((r - 25) / 80, 0, 1) + (N2(x / 14, z / 14) - 0.5) * 0.5 * clamp((r - 6) / 10, 0, 1);
  // the valley falls gently away to the south, toward a frozen river
  h -= clamp((z - 20) / 160, 0, 1) * 9;
  // far hills all around
  h += clamp((r - 220) / 200, 0, 1) * (N1(x / 120 + 3, z / 120) * 45 + 10);
  // the cliff behind the camp rises sharply
  const cz = -9 - Math.sin(x / 9) * 1.5;
  if (z < cz) h += Math.min(22, (cz - z) * 3.2) + N2(x / 5, z / 5) * 3;
  return h;
}

// Moon in the sky for a given night (0 = new Moon): it walks from the west to the east across the
// southern sky over the month (seen at the same time each evening), getting fuller then thinner
function moonFor(night) {
  const k = ((night % 29.5) + 29.5) % 29.5 / 29.5;
  return { phase: k, az: 236 - 112 * k, el: 16 + 24 * Math.sin(Math.PI * Math.min(1, k * 1.15)) };
}

// The tally bone's shape: a flat, slightly curved strip of rib bone with uneven, broken-off ends
// (like the real Lebombo and Ishango bones), not a round rod. 34 cm long, about 4 cm wide.
function boneGeo() {
  const L = 0.34, sh = new THREE.Shape(), top = [], bot = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, x = (t - 0.5) * L, w = 0.021 * (0.78 + 0.22 * Math.sin(t * Math.PI)) * (1 + 0.06 * Math.sin(t * 23));
    top.push([x, w]); bot.push([x, -w * (0.9 + 0.1 * Math.cos(t * 17))]);
  }
  // broken, slanted ends
  sh.moveTo(top[0][0] + 0.006, top[0][1]);
  for (const [x, y] of top.slice(1, -1)) sh.lineTo(x, y);
  sh.lineTo(top[16][0] - 0.004, top[16][1]); sh.lineTo(top[16][0] + 0.003, 0.004); sh.lineTo(bot[16][0] - 0.006, bot[16][1]);
  for (const [x, y] of bot.slice(1, -1).reverse()) sh.lineTo(x, y);
  sh.lineTo(bot[0][0] - 0.002, bot[0][1]); sh.lineTo(top[0][0] - 0.004, -0.003); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -0.004);
  // a gentle bow along its length, like a rib
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getX(i) / L + 0.5; p.setY(i, p.getY(i) + Math.sin(t * Math.PI) * 0.025); }
  geo.computeVertexNormals();
  return geo;
}

export default class Campfire {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    // you sit on a log on the cliff side of the fire, facing out over the valley (south)
    this.start = { pos: new THREE.Vector3(0, 0, -2.3), yaw: Math.PI };
    this.s = {
      phase: 'arrive',  // arrive, sky, bone, carve, full, wane, count, closing, journal, done
      marks: 0,         // marks carved on the bone
      night: 1.2,       // which night of the Moon's month it is (shown)
      bone: 0,          // 1 = the bone is in front of you
      guide: null,
      journal: 0,
      glowMarks: 0,     // counting: how many marks light up
      moonlit: 0, echo: 0, future: 0,   // ch1_08 moonlight, ch1_11 the other bones and the telescope and rocket
      tell: 0,          // the storyteller holding up the bone
    };
    G.world.height = groundHeight;
    G.world.bounds = 60;
    G.world.blockers = [];
    G.sky.fogFar = 600;
    G.sky.mist = 0;
    G.sky.setPlace({ lat: 45, year: -28000, sunLon: 290 }); // a long winter night, 30,000 years ago
    G.audio.amb = 0.8;
    this.buildGround();
    this.buildCamp();
    this.buildTrees();
    this.buildPeople();
    this.buildBone();
    this.buildLife();
    this.buildEchoes();
    this.journal = makeJournalPage('campfire');
    this.journal.visible = false; this.root.add(this.journal);
    this.registerInteractables();
    this.crackleT = 0; this.wolfT = 20;
  }

  buildGround() {
    const SIZE = 900, SEG = 170;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const snow = new THREE.Color(0xdfe6f0), snow2 = new THREE.Color(0xc6d0e0), grass = new THREE.Color(0x6a6a48), rock = new THREE.Color(0x8a8478), earth = new THREE.Color(0x4a3a2c);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i);
      const r0 = Math.hypot(x, z), k = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.7) * (SIZE / 2) / r0 : 0;
      x *= k; z *= k;
      const y = groundHeight(x, z);
      p.setXYZ(i, x, y, z);
      const r = Math.hypot(x, z);
      c.copy(snow).lerp(snow2, N2(x / 8, z / 8));
      // dry grass poking through where the wind blows the snow thin
      const bare = N1(x / 11 + 9, z / 11);
      if (bare > 0.58) c.lerp(grass, clamp((bare - 0.58) * 3, 0, 0.8));
      // the cliff face: bare grey limestone
      const steep = clamp((y - 1.5) / 3, 0, 1) * (z < -8 ? 1 : 0);
      c.lerp(rock, steep * 0.9);
      // trodden earth around the fire
      if (r < 6) c.lerp(earth, (1 - r / 6) * 0.85);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    this.root.add(new THREE.Mesh(g, FLAT));
    // Boulders and the rough face of the cliff
    const k = new Kit(), r = rng(3);
    for (let i = 0; i < 40; i++) {
      const x = -60 + r() * 120, z = -10 - r() * 6, y = groundHeight(x, z) - 1 - r() * 2;
      const geo = roughStone(4 + r() * 5, 5 + r() * 7, 3 + r() * 3, 50 + i, [3, 4, 2]);
      geo.rotateY(r() * 6); geo.rotateZ((r() - 0.5) * 0.3); geo.translate(x, y, z); k.add(geo, 0x9a948a);
    }
    for (let i = 0; i < 18; i++) {
      const a = r() * 360, d = 8 + r() * 50, pt = at(a, d); if (pt.z < -6) continue;
      const geo = roughStone(0.6 + r() * 1.6, 0.4 + r() * 1, 0.6 + r() * 1.2, 120 + i, [2, 2, 2]);
      geo.rotateY(r() * 6); geo.translate(pt.x, groundHeight(pt.x, pt.z) - 0.15, pt.z); k.add(geo, 0x8c877c);
      this.G.world.blockers.push({ x: pt.x, z: pt.z, r: 0.6 });
    }
    const m = k.mesh(); this.root.add(m);
    // a thin layer of snow on top of the rocks: tint the upward-facing faces white
    const geo = m.geometry, n = geo.attributes.normal, col = geo.attributes.color;
    for (let i = 0; i < n.count; i++) if (n.getY(i) > 0.55) col.setXYZ(i, 0.88, 0.91, 0.96);
  }

  buildCamp() {
    const k = new Kit(), r = rng(9), G = this.G;
    const P = PROPS.fresh();
    // Fire pit: a ring of stones, logs, a bed of glowing embers
    if (!P.add('fire_pit', 0, -0.02, 0, 0.3, { w: 1.85, d: 1.85, h: 0.5 })) {
      for (let i = 0; i < 12; i++) { const a = i / 12 * 360; const geo = roughStone(0.32, 0.22, 0.25, 200 + i, [2, 2, 2]); geo.rotateY(-a * D2R); const p = at(a, 0.75); geo.translate(p.x, -0.05, p.z); k.add(geo, 0x6e6860); }
      for (let i = 0; i < 5; i++) k.cyl(0.07, 0.08, 1.1, 7, 0x3a2a1c, [0, 0.12, 0], [Math.PI / 2 - 0.35, i * 1.25, 0]);
    }
    // logs to sit on, hides on the ground, two hide tents on poles, a drying rack with a skin
    const logAt = (x, z, yaw) => {
      if (!P.add('sitting_log', x, -0.02, z, yaw, { w: 2.2, d: 0.48, h: 0.44 })) k.cyl(0.18, 0.2, 2.2, 10, 0x5a4430, [x, 0.18, z], [0, yaw, Math.PI / 2]);
      G.world.blockers.push({ x, z, r: 0.35 });
    };
    logAt(0, -3.0, 0); logAt(2.6, 1.4, 1.0); logAt(-2.6, 1.4, -1.0);
    for (const [x, z, s] of [[-1.4, -2.5, 1], [1.7, 2.8, 0.9], [-2.2, 2.9, 1.1]]) k.cyl(0.9 * s, 0.95 * s, 0.03, 12, 0x8a6a48, [x, 0.02, z]);
    const tent = (x, z, rad, h, col) => {
      // door toward the fire
      if (!P.add('hide_tent', x, 0, z, Math.atan2(-x, -z), { w: rad * 2, d: rad * 2, h: h + 0.6 })) {
        k.cyl(0.05, rad, h, 14, col, [x, h / 2, z]);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.cyl(0.03, 0.035, h + 0.8, 5, 0x4a3828, [x + Math.cos(a) * rad * 0.42, h / 2 + 0.2, z + Math.sin(a) * rad * 0.42], [Math.sin(a) * 0.38, 0, -Math.cos(a) * 0.38]); }
        k.box(0.7, 1.1, 0.05, 0x1a120c, [x, 0.55, z + rad * 0.98]);
      }
      G.world.blockers.push({ x, z, r: rad + 0.2 });
    };
    tent(-6.5, -5.2, 2.2, 3.2, 0x9a7a58); tent(6.8, -4.8, 2.0, 3.0, 0x8a6c4c);
    if (!P.add('drying_rack', 5.0, 0, 2.6, Math.atan2(-5.0, -2.6), { w: 1.9, h: 2.0 })) {
      k.cyl(0.04, 0.04, 2.2, 5, 0x4a3828, [4.2, 1.1, 2.6]); k.cyl(0.04, 0.04, 2.2, 5, 0x4a3828, [5.8, 1.1, 2.6]);
      k.cyl(0.035, 0.035, 1.8, 5, 0x4a3828, [5.0, 2.0, 2.6], [0, 0, Math.PI / 2]);
      k.box(1.4, 1.2, 0.04, 0xb09070, [5.0, 1.35, 2.6]);
    }
    G.world.blockers.push({ x: 5.0, z: 2.6, r: 1.0 });
    // mammoth tusks propped by the tents, and a pile of firewood
    for (const [x, z, a] of [[-4.2, -4.3, 0.5], [4.4, -4.0, -0.5]]) {
      if (!P.add('mammoth_tusks', x + Math.sin(a) * 0.6, 0, z + 0.6, a, { w: 2.4 })) k.tube([[x, 0, z], [x + Math.sin(a) * 0.6, 1.2, z + 0.4], [x + Math.sin(a) * 1.2, 2.0, z + 1.3]], 0.09, 0xe8dcc0, 8);
    }
    for (let i = 0; i < 9; i++) k.cyl(0.06, 0.07, 1.3, 6, 0x4a3420, [-3.6 + (i % 3) * 0.14, 0.08 + Math.floor(i / 3) * 0.13, -1.0 + r() * 0.1], [0, 0.3, Math.PI / 2]);
    this.root.add(P.build({ glow: 0x231c16 }));
    this.root.add(k.mesh());

    // The fire itself: flickering flame shapes, a glow, embers, smoke, and warm light
    const flameTex = canvasTex(64, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.62, h * 0.55);
      gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.25, 'rgba(255,190,70,0.95)'); gr.addColorStop(0.6, 'rgba(240,90,20,0.55)'); gr.addColorStop(1, 'rgba(120,20,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(w / 2, 0); g.quadraticCurveTo(w, h * 0.6, w / 2, h); g.quadraticCurveTo(0, h * 0.6, w / 2, 0); g.fill();
    });
    this.flames = [];
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      f.userData = { a: i / 7 * 6.28, r: i ? 0.18 + (i % 3) * 0.06 : 0, ph: Math.random() * 6, s: i ? 0.5 + Math.random() * 0.3 : 0.95 };
      this.root.add(f); this.flames.push(f);
    }
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,170,80,0.7)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.glow.position.set(0, 0.5, 0); this.glow.scale.setScalar(3.2); this.root.add(this.glow);
    const em = new THREE.SpriteMaterial({ color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.embers = [];
    for (let i = 0; i < 30; i++) { const e = new THREE.Sprite(em); e.scale.setScalar(0.025); e.userData = { t: Math.random() * 3, v: new THREE.Vector3() }; this.root.add(e); this.embers.push(e); }
    this.light = new THREE.PointLight(0xff9a4a, 14, 30, 1.6); this.light.position.set(0, 1.0, 0); this.root.add(this.light);
    G.world.blockers.push({ x: 0, z: 0, r: 0.9 });
  }

  // Snowy spruces dotted along the valley and up its sides, a few bare trees among them (not in
  // front of the Moon's path). Near ones in more detail; each group is one grove (2 draw calls).
  buildTrees() {
    const r = rng(17), G = this.G, near = [], far = [], bare = [];
    for (let i = 0; i < 120; i++) {
      const az = 60 + r() * 240, d = 22 + Math.pow(r(), 0.8) * 180, p = at(az, d);
      if (p.z < -10) continue;
      const s = 0.75 + r() * 0.6, spot = { x: p.x, y: groundHeight(p.x, p.z) - 0.15, z: p.z, s };
      if (d < 75 && r() < 0.14) bare.push({ ...spot, s: s * 0.9 }); else (d < 70 ? near : far).push(spot);
      if (d < 55) G.world.blockers.push({ x: p.x, z: p.z, r: 0.5 * s });
    }
    if (near.length) this.root.add(grove(conifer, near, { detail: 'mid', height: 10, snow: true, seed: 3, variants: 5 }).group);
    if (far.length) this.root.add(grove(conifer, far, { detail: 'low', height: 10, snow: true, seed: 5, variants: 4 }).group);
    if (bare.length) this.root.add(grove(bareTree, bare, { detail: 'mid', height: 8, snow: true, seed: 7, variants: 3 }).group);
  }

  buildPeople() {
    this.people = [];
    const add = (pos, look, role) => {
      const P = makePerson({ model: 'storyteller', seed: 7 + this.people.length * 11, tunic: 0x7a5e44, hair: 0x2a1c12, beard: this.people.length === 0, ...look });
      P.g.position.copy(pos); P.g.position.y = groundHeight(pos.x, pos.z);
      P.g.rotation.y = Math.atan2(-pos.x, -pos.z); P.role = role;
      this.root.add(P.g); this.people.push(P);
      P.blk = { x: pos.x, z: pos.z, r: 0.3 }; this.G.world.blockers.push(P.blk);
      return P;
    };
    // the storyteller stands across the fire from you; the others listen
    // (each one a different person: Meem's other models, their clothes dyed the browns of hide and fur)
    this.teller = add(new THREE.Vector3(0, 0, 2.2), {}, 'teller');
    dress(add(new THREE.Vector3(2.4, 0, 1.0), { height: 1.68, model: 'builder' }, 'listen'), { hue: 0.02, sat: 0.75, val: 0.8, hair: 0x2a1c12, build: 1.06 });
    dress(add(new THREE.Vector3(-2.3, 0, 0.9), { height: 1.6, model: 'instrument_maker' }, 'listen'), { mul: 0x8a6a4c, sat: 0.9 });
    dress(add(new THREE.Vector3(-1.9, 0, 2.9), { height: 1.25, model: 'villager' }, 'listen'), { mul: 0x9a7a58, val: 0.9 });
  }

  // Life out on the frozen plain: reindeer crossing the valley, wild horses, and two hunters coming
  // and going across the snow with their spears (ch1_02: "following herds of reindeer and wild horses")
  buildLife() {
    this.life = new Life(this.root);
    const c = at(192, 24), h = at(148, 30);
    this.reindeer = this.life.add(makeHerd('reindeer', { n: 18, area: { x: c.x, z: c.z, r: 16 }, height: groundHeight, mode: 'migrate', dir: [1, 0.08], seed: 11 }));
    this.horses = this.life.add(makeHerd('horse', { n: 5, area: { x: h.x, z: h.z, r: 11 }, height: groundHeight, seed: 12 }));
    this.hunters = [];
    const spear = () => { const k = new Kit(); k.cyl(0.015, 0.018, 2.1, 5, 0x6a5038, [0, 0, 0]); k.add(roughStone(0.04, 0.14, 0.015, 9, [1, 2, 1]), 0x4a4440, [0, 1.1, 0]); return k.mesh(); };
    [[160, 46, 0], [166, 50, 1]].forEach(([az, d, i]) => {
      const P = makePerson({ model: i ? 'architect' : 'sailor', seed: 90 + i * 13, tunic: 0x6a503a, hair: 0x2a1c12, beard: !i });
      dress(P, i ? { mul: 0x7a5a3c, sat: 0.9, build: 1.04 } : { hue: 0.52, sat: 0.45, val: 0.7, build: 1.05 });   // hunters in hide
      const p = at(az, d); P.g.position.set(p.x, groundHeight(p.x, p.z), p.z); this.root.add(P.g);
      holdProp(P, spear(), 'Right', [0, 0.05, 0.02]);
      // out to look over the herd, then home to the edge of the camp, and out again
      const far = at(200 + i * 8, 30 + i * 4), near = at(150 + i * 8, 9.5 + i), herd = at(192, 24);
      P.routine = [
        { x: near.x, z: near.z, pose: 'talk', secs: 7 + i * 2, look: new THREE.Vector3(0, 1.2, 0) },
        { x: far.x, z: far.z, pose: 'point', secs: 6, look: herd },
      ];
      P.pointAt.copy(herd).setY(1);
      P.ri = i; this.hunters.push(P);
    });
  }

  // ch1_11: other bones like this one (real finds), and a glimpse of what comes after: a telescope
  // and a rocket drawn in starlight
  buildEchoes() {
    this.echoes = new THREE.Group(); this.echoes.visible = false; this.root.add(this.echoes);
    const finds = [['Border Cave, South Africa', -0.5, 0], ['Ishango, Congo', 0, 0.2], ['Abri Blanchard, France', 0.5, 0]];
    this.echoMats = [];
    for (const [name, x, y] of finds) {
      const k = new Kit();
      k.add(boneGeo(), 0xfff0c8);
      for (let i = 0; i < 14; i++) k.box(0.004, 0.026, 0.004, 0x6a4a20, [(-0.12 + i * 0.018), 0.004 + Math.sin((0.1 + i / 16) * Math.PI) * 0.025, 0.008]);
      const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, fog: false });
      const b = k.mesh(m); this.echoMats.push(m);
      const tex = canvasTex(512, 72, (g, w, h) => { g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,236,200,1)'; g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 8; g.fillText(name, w / 2, h / 2); });
      const lm = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false }); this.echoMats.push(lm);
      const lab = new THREE.Sprite(lm); lab.scale.set(0.5, 0.07, 1); lab.position.set(0, 0.09, 0);
      const g = new THREE.Group(); g.add(b, lab); g.position.set(x, y, 0); g.userData.base = g.position.clone(); this.echoes.add(g);
    }
    // the future, drawn like a constellation over the valley (south, where you're facing)
    const lines = (segs, cx, cy, s) => {
      const pos = [];
      for (const [a, b] of segs) { pos.push(cx + a[0] * s, cy + a[1] * s, 0, cx + b[0] * s, cy + b[1] * s, 0); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const m = new THREE.LineBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      return new THREE.LineSegments(g, m);
    };
    // a telescope on its tripod, and a rocket lifting off
    const scope = lines([[[-1, 0.2], [1.1, 1.3]], [[-0.9, -0.05], [1.2, 1.05]], [[-1, 0.2], [-0.9, -0.05]], [[1.1, 1.3], [1.2, 1.05]], [[1.1, 1.3], [1.35, 1.45]], [[1.2, 1.05], [1.45, 1.2]], [[1.35, 1.45], [1.45, 1.2]],
      [[0, 0.6], [-0.6, -1.4]], [[0, 0.6], [0.6, -1.4]], [[0, 0.6], [0, -1.4]]], 0, 0, 1);
    const rocket = lines([[[0, 2], [-0.35, 1.3]], [[0, 2], [0.35, 1.3]], [[-0.35, 1.3], [-0.35, -0.6]], [[0.35, 1.3], [0.35, -0.6]], [[-0.35, -0.6], [0.35, -0.6]],
      [[-0.35, -0.1], [-0.75, -0.8]], [[-0.75, -0.8], [-0.35, -0.6]], [[0.35, -0.1], [0.75, -0.8]], [[0.75, -0.8], [0.35, -0.6]], [[-0.2, -0.6], [0, -1.5]], [[0.2, -0.6], [0, -1.5]], [[0, -1.5], [0, -2.1]]], 0, 0, 1);
    this.future = [scope, rocket];
    const place = (o, az, el, size) => { const d = 120; o.position.set(Math.sin(az * D2R) * Math.cos(el * D2R) * d, Math.sin(el * D2R) * d, -Math.cos(az * D2R) * Math.cos(el * D2R) * d); o.scale.setScalar(size); o.lookAt(0, 1.5, 0); o.rotateY(Math.PI); o.visible = false; this.root.add(o); };
    place(scope, 162, 26, 9); place(rocket, 200, 30, 9);
  }

  // The tally bone: a long, slightly curved piece of bone. Marks are carved along it.
  buildBone() {
    const g = new THREE.Group();
    const k = new Kit();
    k.add(boneGeo(), 0xe6dcc2);
    const stand = k.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x4a3c28 }));
    g.add(stand);   // the simple shape, until Meem's model (tally_bone) has loaded
    // the flint, resting beside it
    const fk = new Kit(); fk.add(roughStone(0.05, 0.09, 0.025, 77, [2, 2, 1]), 0x5a5048); const flint = fk.mesh(); fk.add(roughStone(0.05, 0.09, 0.025, 77, [2, 2, 1]), 0x5a5048); flint.position.set(0.24, -0.06, 0.02); flint.rotation.z = 0.6; g.add(flint);
    // marks: small dark notches, made visible one at a time (they can glow when counted)
    this.notches = [];
    const nm = new THREE.MeshBasicMaterial({ color: 0x3a2a1a });
    for (let i = 0; i < MARKS + 1; i++) {
      const t = 0.08 + i / MARKS * 0.84, x = (t - 0.5) * 0.34, y = Math.sin(t * Math.PI) * 0.025;
      const n = new THREE.Mesh(new THREE.BoxGeometry(0.0035, 0.03, 0.006), nm.clone());
      n.position.set(x, y + 0.004, 0.008); n.rotation.z = (Math.random() - 0.5) * 0.2; n.visible = false;
      g.add(n); this.notches.push(n);
    }
    // a warm outline so it's easy to find
    this.boneGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 32, (c) => { const gr = c.createRadialGradient(32, 16, 0, 32, 16, 32); gr.addColorStop(0, 'rgba(255,220,150,0.35)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 32); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.boneGlow.scale.set(0.6, 0.2, 1); g.add(this.boneGlow);
    g.visible = false;
    this.bone = g; this.root.add(g);
    // the storyteller's own bone and flint, to hold up while ch1_05 is told
    const tk = new Kit(); tk.add(boneGeo(), 0xe6dcc2); const tb = tk.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x4a3c28 }));
    tb.rotation.z = Math.PI / 2; tb.scale.setScalar(1.5); this.tellerBone = new THREE.Group(); this.tellerBone.add(tb);
    this.tellerFlint = new THREE.Group(); const ff = fk.mesh(); ff.rotation.z = 0.4; this.tellerFlint.add(ff);
    this.useBoneModel(stand, tb);
  }

  // Swap in Meem's bone model: laid flat facing you (long along x, its curve bowing up), 34 cm long,
  // with each notch moved onto the bone's front surface.
  async useBoneModel(stand, tellerStand) {
    const m = await loadModel('tally_bone');
    if (!m) return;
    let src = null; m.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
    if (!src) return;
    m.scene.updateMatrixWorld(true);
    const geo = src.geometry.clone(); geo.applyMatrix4(src.matrixWorld);
    geo.rotateX(Math.PI / 2);                 // thin side (its y) now faces you (+z)
    geo.computeBoundingBox(); const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -c.y, -c.z);
    const k = 0.34 / Math.max(1e-3, b.max.x - b.min.x); geo.scale(k, k, k);
    // bow up in the middle, like the old shape (flip it if the model curves the other way)
    geo.computeBoundingBox();
    const mid = this.surfaceAt(geo, 0), end = this.surfaceAt(geo, 0.13);
    if (mid && end && mid.y < end.y) geo.rotateZ(Math.PI);
    const mat = new THREE.MeshLambertMaterial({ map: src.material.map, emissiveMap: src.material.map, emissive: 0x6a5a48 });   // glows a little so it reads by firelight
    const mesh = new THREE.Mesh(geo, mat);
    stand.parent.add(mesh); stand.removeFromParent();
    // notches onto the surface
    for (const n of this.notches) {
      const hit = this.surfaceAt(geo, n.position.x);
      if (hit) n.position.set(n.position.x, hit.y, hit.z + 0.001);
    }
    const tm = new THREE.Mesh(geo, mat); tm.rotation.copy(tellerStand.rotation); tm.scale.copy(tellerStand.scale);
    tellerStand.parent.add(tm); tellerStand.removeFromParent();
  }
  // Where the bone's front surface is at a point along it: casts a ray from in front, along the bone's middle line
  surfaceAt(geo, x) {
    const mesh = this._ray || (this._ray = new THREE.Mesh()); mesh.geometry = geo; mesh.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const rc = new THREE.Raycaster(); geo.computeBoundingBox(); const bb = geo.boundingBox;
    let best = null;
    for (let y = bb.min.y; y <= bb.max.y; y += 0.002) {   // find the column's span, then use its middle
      rc.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
      const h = rc.intersectObject(mesh)[0];
      if (h) { if (!best) best = { lo: y, hi: y, z: h.point.z }; best.hi = y; }
    }
    if (!best) return null;
    const y = (best.lo + best.hi) / 2; rc.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
    const h = rc.intersectObject(mesh)[0];
    return h ? { y, z: h.point.z } : null;
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.boneIt = {
      hint: 'Touch the bone with TRIGGER to carve a mark',
      deskHint: 'Click the bone to carve a mark (or press E)',
      get disabled() { return !['carve', 'wane'].includes(self.s.phase); },
      reach(pos) { self.bone.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.2); },
      aim(o, d) { self.bone.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.22 ? t : Infinity; },
      onTouch() { G.act({ type: 'mark' }); },
      onGrab() { G.act({ type: 'mark' }); },
      onKey() { G.act({ type: 'mark' }); },
      onMouse() {},
    };
    this.pageIt = {
      hint: 'Touch the journal page (TRIGGER or GRIP)', deskHint: 'Click the journal page',
      get disabled() { return self.s.journal !== 1; },
      reach(pos) { self.journal.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.22); },
      aim(o, d) { self.journal.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.3 ? t : Infinity; },
      onTouch() { G.act({ type: 'touchPage' }); }, onGrab() { G.act({ type: 'touchPage' }); },
    };
    G.interactables.push(this.boneIt, this.pageIt);
  }

  act(a) {
    const s = this.s;
    if (a.type === 'mark' && ['carve', 'wane'].includes(s.phase) && G_now() - (this.lastMark || 0) > 0.35) {
      this.lastMark = G_now(); this.mark(); return true;
    }
    if (a.type === 'touchPage' && s.journal === 1) { s.journal = 2; return true; }
    return false;
  }
  mark() {
    const s = this.s;
    if (s.marks >= MARKS) return;
    s.marks++; s.night = s.marks + 0.2;
    this.G.events.emit('sfx', { k: 'carve' });
    this.idleT = 0;
  }

  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    const placeAll = (pos, yaw) => G.events.emit('placePlayers', { x: pos.x, z: pos.z, yaw });
    placeAll(this.start.pos, this.start.yaw);
    await G.ui.fadeIn(3);
    await D.say('ch1_01');
    s.guide = at(170, 30, 6).toArray();          // out over the frozen valley
    await D.say('ch1_02');
    s.guide = at(185, 9, 4.5).toArray();
    const l3 = D.sayAsync('ch1_03');
    await D.cue('Look up'); s.up = 1;          // everyone tips their head back
    await l3;
    s.phase = 'sky';
    D.hint(G.mode === 'vr' ? 'Point a controller at a star to see its name' : 'Look at a star to see its name', 7);
    await D.say('ch1_04');
    await D.wait(fast ? 1 : 12);                // time to look around the sky
    // The storyteller holds up a bone; then it floats over to you, with a flint
    s.up = 0; s.guide = null; s.tell = 1;       // ...holding up a bone, then scratching at it with a flint
    const l5 = D.sayAsync('ch1_05');
    await D.cue('And they started'); s.tell = 2;
    await l5;
    s.tell = 0; s.bone = 1;
    s.phase = 'carve'; s.night = 1.2;
    G.events.emit('sfx', { k: 'page' });
    await D.say('ch1_06');
    D.hint(G.mode === 'desktop' ? this.boneIt.deskHint : this.boneIt.hint, 8);
    this.idleT = 0;
    // (Kids mode: the flint carves the first mark by itself, then keeps going)
    await D.auto(() => s.marks >= 1, () => this.mark(), { after: fast ? 0.3 : 2.5, timeout: fast ? 2 : 30 });
    if (s.marks < 1) this.mark();
    // The Moon grows night by night (the builders of time help if you stop)
    this.autoFrom = 1; this.autoTo = 15;
    await D.say('ch1_07');
    await D.until(() => s.marks >= 15);
    s.phase = 'full';
    const l8 = D.sayAsync('ch1_08');
    await D.cue('walk by'); s.moonlit = 1;      // the whole valley lights up silver: you could walk, or hunt, by it
    await l8;
    s.phase = 'wane'; this.autoTo = MARKS;
    await D.say('ch1_09');
    await D.until(() => s.marks >= MARKS);
    // a few dark nights, then the sliver again
    await D.wait(fast ? 0.5 : 1.5);
    s.night = MARKS + 1.4;
    s.phase = 'count';
    await D.say('ch1_10');
    s.phase = 'closing';
    const l11 = D.sayAsync('ch1_11');
    s.echo = 1;                                 // bones like this one, found in caves in Africa and France
    await D.cue('We can'); s.echo = 0.6;
    await D.cue('every telescope'); s.future = 1;   // ...and a glimpse of everything that comes after
    await D.cue('every rocket'); s.future = 2;
    await l11;
    s.echo = 0; s.future = 0;
    s.bone = 0;
    s.journal = 1; s.phase = 'journal';
    G.events.emit('sfx', { k: 'page' });
    D.hint(G.mode === 'desktop' ? this.pageIt.deskHint : this.pageIt.hint, 8);
    await D.auto(() => s.journal === 2, () => this.act({ type: 'touchPage' }), { after: fast ? 0.5 : 4 });
    G.ui.showHint('');
    G.events.emit('sfx', { k: 'page' });
    await D.wait(1.2);
    s.phase = 'done';
  }

  update(dt, t) {
    const G = this.G, s = this.s, host = G.isHost, fast = G.params.has('fast') ? 4 : 1;
    // Sky: deep night. The Moon shows the night we're on.
    G.sky.sunSize = 1;
    G.sky.set(330, -42);
    G.sky.mist = damp(G.sky.mist, 0, 1, dt);
    this.nightV = damp(this.nightV ?? s.night, s.night, 3, dt);
    const m = moonFor(this.nightV);
    if (s.phase === 'arrive' || s.phase === 'sky' || this.nightV < 0.8) G.sky.hideMoon();
    else G.sky.setMoon(m.az, m.el, 1, m.phase);
    // Host: the people help carve if you stop for a while
    if (host && (s.phase === 'carve' || s.phase === 'wane') && this.autoTo) {
      this.idleT = (this.idleT || 0) + dt * fast;
      if (s.marks >= this.autoFrom && s.marks < this.autoTo && this.idleT > 2.2) { this.mark(); this.idleT = 1.4; }
    }
    // Counting: the marks light up one by one
    if (s.phase === 'count' || s.phase === 'closing') s.glowMarks = Math.min(MARKS, s.glowMarks + dt * 6 * fast);
    for (let i = 0; i < this.notches.length; i++) {
      const n = this.notches[i]; n.visible = i < s.marks;
      n.material.color.setHex(i < s.glowMarks ? 0xffc860 : 0x3a2a1a);
    }

    // The fire
    const fl = 0.75 + 0.25 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1) + 0.1 * Math.sin(t * 23);
    this.light.intensity = 12 + fl * 6;
    for (const f of this.flames) {
      const u = f.userData, k = 0.75 + 0.25 * Math.sin(t * (6 + u.a) + u.ph);
      f.position.set(Math.cos(u.a) * u.r, 0.35 * u.s * k + 0.05, Math.sin(u.a) * u.r);
      f.scale.set(0.42 * u.s * (0.9 + 0.1 * Math.sin(t * 7 + u.ph)), 0.85 * u.s * k, 1);
    }
    this.glow.material.opacity = 0.6 + fl * 0.3;
    for (const e of this.embers) {
      const u = e.userData; u.t += dt;
      if (u.t > 2.5) { u.t = 0; e.position.set((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4); u.v.set((Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3); }
      e.position.addScaledVector(u.v, dt); u.v.x += Math.sin(t * 3 + u.t * 5) * dt * 0.3;
      e.material.opacity = 1 - u.t / 2.5;
    }
    this.crackleT -= dt;
    if (this.crackleT <= 0) { this.crackleT = 0.08 + Math.random() * 0.5; G.audio.crackle?.(_a.set(0, 0.4, 0)); }
    this.wolfT -= dt;
    if (this.wolfT <= 0) { this.wolfT = 35 + Math.random() * 40; G.audio.howl?.(at(120 + Math.random() * 120, 200, 10)); }

    // People: they look up at the sky with you, the storyteller holds up a bone and carves it, and
    // everyone points at the full Moon. Now and then they glance over at you.
    const lookUp = !!s.up;
    for (const P of this.people) {
      P.pose = P.role === 'teller' ? (s.tell === 2 ? 'write' : s.tell ? 'hold' : s.phase === 'sky' ? 'point' : s.phase === 'carve' || s.phase === 'wane' ? 'point' : 'idle') : (s.phase === 'full' ? 'point' : s.phase === 'count' ? 'cheer' : 'idle');
      if (P.pose === 'cheer' && P.H > 0.8) P.pose = 'idle';   // (only the child jumps up and down at the count)
      if (P.pose === 'point') { const mm = moonFor(this.nightV); _c.set(Math.sin(mm.az * D2R) * Math.cos(mm.el * D2R), Math.sin(mm.el * D2R), -Math.cos(mm.az * D2R) * Math.cos(mm.el * D2R)); P.pointAt.copy(P.g.position).addScaledVector(_c, 50); }
      if (P.role === 'teller' && s.phase === 'sky') P.pointAt.set(P.g.position.x - 10, 40, P.g.position.z - 30);   // the Milky Way, overhead
      P.glance = true;
      P.look = lookUp ? _c.set(Math.sin(P.g.rotation.y) * 12, 22, Math.cos(P.g.rotation.y) * 12).add(P.g.position).clone() : s.tell && P.role !== 'teller' ? this.teller.g.position.clone().setY(1.5) : null;
      animatePerson(P, t, dt);
    }
    // the storyteller's bone and flint, in hand while ch1_05 is told
    if (s.tell && !this.tellerBone.parent) { holdProp(this.teller, this.tellerBone, 'Right', [0, 0.06, 0.03]); holdProp(this.teller, this.tellerFlint, 'Left', [0, 0.05, 0.03]); }
    if (!s.tell && this.tellerBone.parent) { dropProp(this.teller, 'Right'); dropProp(this.teller, 'Left'); }
    // Hunters and herds out on the plain
    for (const P of this.hunters) { runRoutine(P, dt, { height: groundHeight, speed: 1.1 }); animatePerson(P, t, dt); }
    this.life.update(dt, t);
    // Moonlight: the valley glows silver around the full Moon
    this.moonlitV = damp(this.moonlitV || 0, s.moonlit && ['full', 'wane'].includes(s.phase) ? 1 : 0, 0.8, dt);
    if (!this.moonLight) { this.moonLight = new THREE.DirectionalLight(0xb8c8ff, 0); this.root.add(this.moonLight, this.moonLight.target); }
    this.moonLight.intensity = this.moonlitV * 1.1; this.moonLight.position.set(Math.sin(m.az * D2R) * 60, 40, -Math.cos(m.az * D2R) * 60);
    // ch1_11: the other bones, and the telescope and rocket drawn in starlight
    this.echoV = damp(this.echoV || 0, s.echo || 0, 1.5, dt);
    this.echoes.visible = this.echoV > 0.01;
    if (this.echoes.visible) {
      if (!this.echoSet) { this.echoSet = true; G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize(); this.echoes.position.copy(this.bone.position).addScaledVector(_b, 0.9).add(_a.set(0, 0.45, 0)); this.echoes.quaternion.copy(this.bone.quaternion); }
      for (const mtl of this.echoMats) mtl.opacity = this.echoV * (mtl.isSpriteMaterial ? 1 : 0.9);
      this.echoes.children.forEach((g, i) => { g.position.copy(g.userData.base); g.position.y += Math.sin(t * 1.2 + i * 2) * 0.02 + (1 - Math.min(1, this.echoV)) * -0.2; g.rotation.y = Math.sin(t * 0.5 + i) * 0.4; });
    }
    this.future.forEach((o, i) => { const want = (s.future || 0) > i ? 1 : 0; o.material.opacity = damp(o.material.opacity, want * (0.75 + 0.25 * Math.sin(t * 2 + i)), 1.2, dt); o.visible = o.material.opacity > 0.01; });

    // Guide
    if (s.guide) { _a.fromArray(s.guide); if (!this.guideAt || !this.guideAt.equals(_a)) { this.guideAt = _a.clone(); G.guide.flyTo(this.guideAt); G.guide.chime(); } }
    else if (this.guideAt && !s.bone && s.journal !== 1) { this.guideAt = null; G.guide.follow(); }

    // The bone floats in front of you, at chest height (set once, then it stays put)
    this.bone.visible = !!s.bone;
    if (s.bone) {
      if (!this.boneSet) {
        this.boneSet = true;
        G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize();
        this.bone.position.copy(_a).addScaledVector(_b, 0.5); this.bone.position.y -= 0.3;
        this.bone.lookAt(_a.x, this.bone.position.y, _a.z);
      }
      this.bone.position.y += Math.sin(t * 1.5) * 0.0004;
      this.boneGlow.material.opacity = 0.6 + 0.4 * Math.sin(t * 3);
      // Astra hovers just beyond the bone, so you can see both it and the Moon
      G.guide.flyTo(_c.copy(this.bone.position).add(_a.set(0, 0.45, 0)).addScaledVector(G.camera.getWorldDirection(_b).setY(0).normalize(), 0.9));
      this.guideAt = this.guideAt || _c.clone();
    } else this.boneSet = false;

    // Journal page
    this.journal.visible = s.journal === 1;
    if (s.journal === 1) {
      G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize();
      if (!this.pageSet) { this.pageSet = true; this.journal.position.copy(_a).addScaledVector(_b, 0.62); this.journal.position.y -= 0.2; }
      this.journal.lookAt(_a);
      G.guide.flyTo(_c.copy(this.journal.position).add(_b.set(-_b.z * 0.4, 0.12, _b.x * 0.4)), _a);
      this.guideAt = this.guideAt || _c.clone();
    }
  }

  dispose() {
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.sky.hideMoon();
  }
}
const G_now = () => performance.now() / 1000;
