// Era 3, chapter 10 (n 35): The Handshake. December 1972 - July 1975.
//
// 1. Apollo 17, the last Moon landing: the rover bounces across the valley of Taurus-Littrow; Gene
//    Cernan climbs the ladder for the last time. "We leave as we came..."
// 2. The old rivals agree to meet. 15 July 1975: from Korolev's pad at Baikonur, the Soyuz lifts off
//    with Leonov and Kubasov; hours later in Florida the last Apollo, with Stafford, Brand and Deke
//    Slayton, who waited thirteen years. "Worth every day."
// 3. 17 July: the two ships dock above the Earth (the music starts and plays to the end). Inside,
//    the hatch opens: "Tovarishch!" Stafford and Leonov shake hands, floating, the Earth turning in
//    the window behind them. Gifts, flags, tree seeds; soup in tubes labelled vodka; Leonov sketching.
// 4. Night in a garden near Washington: Wernher von Braun and his family under the stars; a bright
//    moving star crosses the sky. From orbit, Leonov speaks to Korolev. Two chief designers who never
//    met; their two ships now one. "Era 4" forms from the stars.
// (The garden is an imagined moment that fits the facts; Astra doesn't claim he saw it.)
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo } from '../era3/base.js';
import { person, sit, wear } from '../era3/folk.js';
import { loadAll, copy, Rocket } from '../era3/craft.js';
import { cabin, dressCabin } from '../era3/cabin.js';
import { Puffs, envMap, cabinRumble, clank, hiss, click, roar } from '../era3/fx.js';
import { earthSpace, spaceSun, moonGround, groundPlane, sea } from '../era3/worlds.js';
import { picture, surfMat } from '../era3/sets.js';
import { SAT_Y } from '../era3/saturn.js';
import { holdProp } from '../people.js';
import { loadProps } from '../props.js';
import { glowSprite, glowPoints, skyLevel, rumble } from '../wow/fx.js';
import { canvasTex, lerp } from '../util.js';
import { rng, noise2 } from '../shapes.js';

const M = await loadAll(['craft/lm_descent', 'craft/lm_ascent', 'craft/lunar_rover', 'craft/flag_1969', 'craft/r7_vostok', 'craft/soyuz19',
  'craft/saturn_ib_s1', 'craft/saturn_s4b', 'craft/saturn_sla', 'craft/apollo_csm', 'craft/apollo_les', 'craft/launch_tower', 'props/helmet_apollo']);
const PROPS = await loadProps(['house_english']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);
const LM_DECK = 2.62, LM_Y = 0.35;

// the Docking Module: the short white tube that joined the two ships (each end fitted to one of them)
function dockingModule() {
  const k = new Kit(); k.cyl(0.75, 0.75, 3.15, 20, 0xe8e6e0, [0, 1.575, 0]); k.cyl(0.6, 0.75, 0.3, 20, 0xc8c8c4, [0, 3.3, 0]); k.cyl(0.55, 0.55, 0.2, 20, 0x8a8a88, [0, 3.5, 0]);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; k.box(0.08, 2.6, 0.05, 0x3a3a3a, [Math.cos(a) * 0.76, 1.6, Math.sin(a) * 0.76], [0, -a, 0]); }
  return k.mesh(FLAT);
}
// two little flags on a stand, and the vodka tube
function gifts() {
  const g = new THREE.Group();
  const fl = (draw, x) => { const p = picture(0.16, 0.1, draw, { frame: 0xc8c8c8, px: 128 }); p.position.set(x, 0, 0); g.add(p); };
  fl((c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f4f0e8' : '#b22234'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, w * 0.4, h * 7 / 13); }, -0.09);
  fl((c, w, h) => { c.fillStyle = '#cc2020'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0d040'; c.font = `${h * 0.3 | 0}px sans-serif`; c.fillText('☭', w * 0.06, h * 0.32); }, 0.09);
  return g;
}
function vodkaTube() {
  const tex = canvasTex(64, 128, (c, w, h) => { c.fillStyle = '#e8e8e4'; c.fillRect(0, 0, w, h); c.fillStyle = '#c82020'; c.fillRect(0, h * 0.35, w, h * 0.3); c.fillStyle = '#fff'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.save(); c.translate(w / 2, h / 2); c.rotate(-Math.PI / 2); c.fillText('ВОДКА', 0, 5); c.restore(); });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.15, 12), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.4 }));
  return m;
}
function sketchPad() {
  const tex = canvasTex(128, 160, (c, w, h) => { c.fillStyle = '#f4f0e4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#333'; c.lineWidth = 2; c.beginPath(); c.ellipse(w / 2, h * 0.4, 30, 38, 0, 0, 7); c.stroke(); c.beginPath(); c.moveTo(w * 0.3, h * 0.9); c.quadraticCurveTo(w / 2, h * 0.6, w * 0.7, h * 0.9); c.stroke(); c.beginPath(); c.arc(w * 0.42, h * 0.37, 3, 0, 7); c.arc(w * 0.58, h * 0.37, 3, 0, 7); c.fill(); c.beginPath(); c.arc(w / 2, h * 0.47, 10, 0.3, 2.8); c.stroke(); });
  return new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.01), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
}
// "ERA 4" spelled in stars: points sampled from text drawn on a canvas
function starText(text, w = 60) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 34);
  const d = x.getImageData(0, 0, 256, 64).data, pts = [], r = rng(5);
  for (let y = 0; y < 64; y += 3) for (let i = 0; i < 256; i += 3) if (d[(y * 256 + i) * 4] > 128 && r() < 0.85) pts.push([(i / 256 - 0.5) * w + (r() - 0.5) * 0.6, (0.5 - y / 64) * w * 0.25 + (r() - 0.5) * 0.6]);
  const P = glowPoints(pts.length, { sizeScale: 300, depthTest: false });
  P.userData.pts = pts; P.userData.ph = pts.map(() => r() * 6);
  return P;
}

export default class Handshake extends Chapter3 {
  constructor(G) {
    super(G, 35);
    G.renderer.localClippingEnabled = true;
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { rove: 0, climb: 0, soyuz: 0, apollo: 0, dock: 0, hatch: 0, shake: 0, gifts: 0, pass: 0, era: 0 });
    this.buildMoon(); this.buildBaikonur(); this.buildKennedy(); this.buildCabin(); this.buildDock(); this.buildHatch(); this.buildGarden();
    Object.assign(G.narration.radio, { ch35_02: 'nasa', ch35_15: 'nasa' });
  }

  // ---------- 1. Taurus-Littrow, December 1972 ----------
  buildMoon() {
    const g = new THREE.Group();
    // a valley between great rounded mountains (the North and South Massifs)
    const MG = this.MG = moonGround({ size: 900, seed: 72, craters: [[-40, -60, 10, 2], [30, -30, 6, 1.2], [70, 40, 14, 2.5], [-80, 30, 8, 1.6]], flatten: [[0, 0, 10], [-12, 6, 8]], rocks: 1000, boulders: [[-20, -25, 1.2], [25, 18, 0.9], [-35, 40, 1.6]], clear: [[0, 0, 22, 0.15]] });
    g.add(MG.group); const H = this.H = MG.height;
    const env = envMap('moon'), k = new Kit(), N = noise2(17);
    for (const [x, z, r, h] of [[-300, -330, 260, 120], [260, -380, 240, 140], [420, 120, 200, 90], [-420, 180, 220, 100]]) {
      const geo = new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2); const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) / r; p.setY(i, y * h * (0.85 + N(p.getX(i) / 60, p.getZ(i) / 60) * 0.3)); }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a8884, roughness: 1 })); m.position.set(x, -4, z); g.add(m);
    }
    // Challenger, the flag, the rover's tracks
    const lm = this.lm17 = new THREE.Group(); lm.add(copy(M.lm_descent, env, 1.0)); const as = copy(M.lm_ascent, env, 1.0); as.position.y = LM_DECK; lm.add(as);
    lm.position.set(0, H(0, 0) + LM_Y, 0); g.add(lm);
    const flag = copy(M.flag_1969, env, 1.0); flag.position.set(-6, H(-6, 3), 3); flag.rotation.y = 0.8; g.add(flag);
    // the rover: driving in a loop toward the LM, Cernan at the wheel
    const rv = this.rover = new THREE.Group(); rv.add(copy(M.lunar_rover, env, 1.0)); g.add(rv);
    this.cernan = person(g, 'armstrong', V(0, 0, 0), Math.PI); // Cernan: suit + helmet, reuses the Apollo suit model
    wear(this.cernan, copy(M.helmet_apollo), { lift: -0.05, size: 1 }); this.people.push(this.cernan);
    this.dust = new Puffs(300, { floor: null }); g.add(this.dust.mesh);
    const SP = this.SPm = earthSpace(this.G, { earthR: 30 }); SP.earth.position.set(-200, 700, -900); SP.sunDir.set(0.6, 0.35, 0.5).normalize();
    this.addScene('moon', { group: g, height: H, bounds: 1.0, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s;
        SP.atmoU.sun.value.copy(SP.sunDir);
        this.key.position.copy(SP.sunDir).multiplyScalar(80); this.key.target.position.set(0, 0, 0); this.key.intensity = 2.8;
        // the drive: from far off, bouncing toward the LM, stopping by it
        this.rK = s.rove ? clamp01((this.rK || 0) + dt * this.F / 16) : 0;
        const k = ease(this.rK), x = lerp(-34, 3.5, k) + Math.sin(k * 7) * 2.5 * (1 - k), z = lerp(-18, 7, k), a = Math.atan2(37.5, 25);
        const bump = this.rK < 1 ? Math.abs(Math.sin(t * 5.5)) * 0.18 : 0;
        rv.position.set(x, H(x, z) + bump, z); rv.rotation.set(Math.sin(t * 4) * 0.04 * (this.rK < 1), a, 0);
        if (s.rove && this.rK < 1) for (let i = 0; i < 2; i++) this.dust.emit(x + (Math.random() - 0.5), H(x, z) + 0.3, z, (Math.random() - 0.5) * 2, 1.5 + Math.random(), (Math.random() - 0.5) * 2, 0.3, 1.2, 1.5, 0xa8a49c, 0.4, 0.1, 0, -1.6);
        this.dust.update(this.G, dt, [0, 0]);
        // Cernan: at the wheel, then up the ladder
        this.cK = s.climb ? clamp01((this.cK || 0) + dt * this.F / 7) : 0;
        if (!s.climb) { this.cernan.g.position.copy(rv.position).add(V(-0.35, 0.55, 0).applyEuler(rv.rotation)); this.cernan.g.rotation.y = a; sit(this.cernan, true); this.cernan.pose = 'hold'; }
        else { sit(this.cernan, false); const foot = V(0, H(0, 4.6), 4.6), top = V(0, H(0, 0) + LM_DECK + 0.1, 3.6), pos = this.cK < 0.25 ? V(3.0, H(3.0, 6.8), 6.8).lerp(foot, this.cK / 0.25) : foot.clone().lerp(top, (this.cK - 0.25) / 0.75);
          this.cernan.g.position.copy(pos); this.cernan.g.rotation.y = Math.PI; this.cernan.pose = this.cK < 0.25 ? 'walk' : 'work'; }
      } });
  }

  // ---------- 2. Baikonur: the Soyuz ----------
  buildBaikonur() {
    const g = new THREE.Group(), N = noise2(51), k = new Kit();
    g.add(groundPlane({ size: 5000, seg: 100, h: () => 0, color: (x, z, c) => { const m = N(x / 40, z / 40); c.setRGB(0.62 + m * 0.08, 0.56 + m * 0.07, 0.4 + m * 0.05); } }));
    const pad = V(25, 0, -160);
    k.box(60, 2, 60, 0x8a867a, [pad.x, 1, pad.z]); for (const sx of [-1, 1]) k.box(4, 48, 4, 0xa84a2a, [pad.x + sx * 9, 24, pad.z - 2], [0, 0, sx * 0.08]);
    k.box(30, 3, 4, 0x6a6a6a, [pad.x - 40, 1.5, pad.z + 20]);
    g.add(k.mesh(FLAT));
    this.soyuzR = new Rocket(g, { parts: [{ M: M.r7_vostok, y: 1.3 }], engines: [[0, 0], [2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]].map(([x, z]) => ({ x, z, y: -1.2, len: 10, width: 1.4, kind: 'kero' })), size: 1.1, hold: 2.6, accel: 9, az: 63, tilt: 40, tiltAt: 1400, env: envMap('day'), trench: 0, glowEnd: 60, trailEnd: 50 });
    this.soyuzR.place(pad.x, 2, pad.z);
    this.bkPuffs = new Puffs(600, { floor: 2 }); g.add(this.bkPuffs.mesh);
    this.bkFolk = [['soviet_engineer', -2, -1, Math.PI], ['soviet_woman', 1.2, -1.6, Math.PI + 0.2], ['soviet_engineer', 3, -0.5, Math.PI - 0.2]].map(([w, x, z, yaw]) => person(g, w, V(x, 0, z), yaw));
    this.people.push(...this.bkFolk);
    this.addScene('baikonur', { group: g, bounds: 1.2, place: { lat: 45.9, year: 1975, sunLon: 113 }, amb: 0.6, fogFar: 5000, mist: 0.05,
      sky: () => { this.G.sky.set(230, 45); this.key.position.set(-200, 260, 160); this.key.target.position.set(0, 0, -300); this.key.intensity = 2.4; },
      update: (dt, t) => { this.soyuzR.update(dt, t, this.F); this.bkPuffs.update(this.G, dt * this.F, [3, 0], this.soyuzR.flash || 0);
        this.bkFolk.forEach((P, i) => { P.look = this.soyuzR.pos.clone(); P.pose = this.soyuzR.rising ? (i % 2 ? 'wave' : 'point') : 'idle'; }); } });
  }

  // ---------- 2. Florida: the last Apollo, on its Saturn IB ----------
  buildKennedy() {
    const g = new THREE.Group(), N = noise2(52), k = new Kit();
    g.add(groundPlane({ size: 5000, seg: 100, h: () => 0, color: (x, z, c) => { const m = N(x / 30, z / 30); c.setRGB(0.32 + m * 0.1, 0.4 + m * 0.08, 0.2); } }));
    const S = this.ksea = sea({ size: 9000, col: 0x2a5a7a, sky: 0xa8c8e8, sun: V(0.9, 0.5, 0) }); S.position.set(4800, -0.6, 0); g.add(S);
    const pad = V(-30, 0, -230);
    k.box(80, 6, 70, 0x9a968c, [pad.x, 3, pad.z]);
    // the "milkstool": a tall pedestal that lifted the smaller rocket so it lined up with the tower's arms
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) k.box(0.8, 39, 0.8, 0xd8d8d4, [pad.x + x, 6 + 19.5, pad.z + z], [0, 0, x * 0.006]);
    k.box(10, 1, 10, 0xd8d8d4, [pad.x, 6 + 39, pad.z]);
    g.add(k.mesh(FLAT));
    const T = copy(M.launch_tower, envMap('day'), 0.9); T.position.set(pad.x, 6, pad.z); g.add(T);
    const S4 = 26.3, parts = [{ M: M.saturn_ib_s1, y: 0 }, { M: M.saturn_s4b, y: S4 }, { M: M.saturn_sla, y: S4 + SAT_Y.sla - SAT_Y.s4b }, { M: M.apollo_csm, y: S4 + SAT_Y.csm - SAT_Y.s4b }, { M: M.apollo_les, y: S4 + SAT_Y.les - SAT_Y.s4b }];
    const h1 = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = i * Math.PI / 4, r = i % 2 ? 2.6 : 1.4; return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: -1.8, len: 18, width: 1.8, kind: 'kero' }; });
    this.ibR = new Rocket(g, { parts, engines: h1, size: 1.4, hold: 3.0, accel: 6, az: 50, tilt: 35, tiltAt: 1800, env: envMap('day'), trench: 0, glowEnd: 80, trailEnd: 70, lightI: 500 });
    this.ibR.place(pad.x, 6 + 39.5 + 1.9, pad.z);
    this.kPuffs = new Puffs(700, { floor: 6 }); g.add(this.kPuffs.mesh);
    this.kFolk = [['reporter', -3, -0.8, Math.PI], ['man_suit', -1.2, -1.2, Math.PI + 0.15], ['woman_dress', 2.0, -0.9, Math.PI - 0.1]].map(([w, x, z, yaw]) => person(g, w, V(x, 0, z), yaw));
    this.people.push(...this.kFolk);
    this.addScene('kennedy', { group: g, bounds: 1.2, place: { lat: 28.6, year: 1975, sunLon: 113 }, amb: 0.5, fogFar: 4000,
      sky: () => { this.G.sky.set(270, 40); this.key.position.set(-250, 220, 0); this.key.target.position.set(0, 0, -300); this.key.intensity = 2.2; },
      update: (dt, t) => { S.userData.update?.(t); this.ibR.update(dt, t, this.F); this.kPuffs.update(this.G, dt * this.F, [2, 0], this.ibR.flash || 0);
        this.kFolk.forEach((P, i) => { P.look = this.ibR.pos.clone(); P.pose = this.ibR.rising ? (i % 2 ? 'cheer' : 'point') : 'idle'; }); } });
  }

  // ---------- 2. Inside the last Apollo, climbing ----------
  buildCabin() {
    const g = new THREE.Group();
    const C = this.Cc = cabin('apollo', { seat: 'center' }); g.add(C.group);
    dressCabin(C);
    this.staC = person(C.group, 'stafford', C.crew[0].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.staC);
    this.slaC = person(C.group, 'slayton', C.crew[1].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.slaC);
    for (const P of [this.staC, this.slaC]) wear(P, copy(M.helmet_apollo), { lift: -0.05, size: 1 });
    this.people.push(this.staC, this.slaC);
    this.addScene('cabin', { group: g, bounds: 0.2, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); this.G.sky.set(270, 40); },
      update: (dt, t) => {
        this.key.position.set(3, 6, -3); this.key.target.position.set(0, 1.4, 0); this.key.intensity = 1.6;
        this.slaC.pose = this.s.dekeTalk ? 'talk' : 'idle'; this.slaC.look = V(0, 1.6, 0);
        C.group.position.set((Math.random() - 0.5) * 0.004 * this.s.shakeC, (Math.random() - 0.5) * 0.004 * this.s.shakeC, 0);
      } });
  }

  // ---------- 3. The docking, outside ----------
  buildDock() {
    const g = new THREE.Group();
    const SP = this.SPd = earthSpace(this.G, { earthR: 1500 });
    SP.earth.position.set(0, -1500 - 220, -300); SP.sunDir.set(0.5, 0.6, 0.4).normalize();
    this.sunD = spaceSun(50); SP.group.add(this.sunD);
    const env = envMap('space');
    // Apollo with the docking module on its nose (from the right), Soyuz (from the left)
    const ap = this.apD = new THREE.Group(); const csm = copy(M.apollo_csm, env, 1.1); ap.add(csm);
    const dm = dockingModule(); dm.position.y = 3.6; ap.add(dm); ap.rotation.z = Math.PI / 2; g.add(ap);
    const sy = this.syD = new THREE.Group(); const so = copy(M.soyuz19, env, 1.0); so.rotation.x = Math.PI; sy.add(so); sy.rotation.z = Math.PI / 2; g.add(sy);
    this.addScene('dock', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s;
        SP.earth.rotation.y += dt * 0.01; SP.atmoU.sun.value.copy(SP.sunDir); this.sunD.position.copy(SP.sunDir).multiplyScalar(1400).add(EYE);
        this.key.position.copy(SP.sunDir).multiplyScalar(80); this.key.target.position.set(0, 0, -24); this.key.intensity = 2.4;
        this.dK = s.dock ? clamp01((this.dK || 0) + dt * this.F / 14) : 0;
        const gap = lerp(12, 0, ease(this.dK));
        // the docking module's tip meets the Soyuz's nose at x = 0
        ap.position.set(gap / 2 + 7.2, 0.8, -24); sy.position.set(-gap / 2 - 7.19, 0.8, -24);
      } });
  }

  // ---------- 3. Inside: the hatch ----------
  buildHatch() {
    const g = new THREE.Group();
    // our side: the docking module, a white quilted tube you float in, looking along it (-z)
    const quilt = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#d8d6cc'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { c.strokeStyle = 'rgba(80,80,70,0.35)'; c.strokeRect(x + 1, y + 1, 30, 30); } });
    quilt.wrapS = quilt.wrapT = THREE.RepeatWrapping; quilt.repeat.set(6, 2);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 3.2, 28, 1, true), new THREE.MeshStandardMaterial({ map: quilt, side: THREE.BackSide, roughness: 0.9 }));
    tube.rotation.x = Math.PI / 2; tube.position.set(0, 1.6, 0.1); g.add(tube);
    const k = new Kit();
    k.cyl(0.85, 0.85, 0.05, 28, 0x8a8a86, [0, 1.6, 1.7], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) k.box(0.05, 0.05, 2.8, 0x3a3a3a, [Math.cos(i) * 0.8, 1.6 + Math.sin(i) * 0.8, 0.1]);
    g.add(k.mesh(FLAT));
    // the round opening, and the hatch door that swings open
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.85, 32), new THREE.MeshStandardMaterial({ color: 0x7a7a76, roughness: 0.6, side: THREE.DoubleSide })); ring.position.set(0, 1.6, -1.55); g.add(ring);
    const hinge = this.hinge = new THREE.Group(); hinge.position.set(-0.56, 1.6, -1.52); g.add(hinge);
    const door = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.06, 28), new THREE.MeshStandardMaterial({ color: 0x9a9a94, roughness: 0.5, metalness: 0.3 })); door.rotation.x = Math.PI / 2; door.position.x = 0.56; hinge.add(door);
    // their side: the Soyuz orbital module, a green-walled ball beyond, with a porthole full of Earth
    const ballT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#7a9a7a'; c.fillRect(0, 0, w, h); const r = rng(3); for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(40,60,40,${r() * 0.2})`; c.fillRect(r() * w, r() * h, 4, 4); } });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 20), new THREE.MeshStandardMaterial({ map: ballT, side: THREE.BackSide, roughness: 0.9, emissive: 0xffffff, emissiveMap: ballT, emissiveIntensity: 0.25 })); ball.position.set(0, 1.6, -2.75); g.add(ball);
    const pk = new Kit(); pk.cyl(0.24, 0.24, 0.06, 24, 0x2a2a2a, [0.75, 2.2, -3.45], [Math.PI / 2 + 0.4, 0.5, 0]); pk.box(0.5, 0.3, 0.3, 0x5a6a5a, [-0.7, 0.8, -3.1]); pk.box(0.3, 0.5, 0.2, 0x6a7a6a, [0.8, 1.0, -2.2]);
    g.add(pk.mesh(FLAT));
    // the Earth turning in a window behind them (a disc of blue, cloud and land)
    const eT = canvasTex(256, 256, (c, w, h) => { const gr = c.createRadialGradient(w * 0.45, h * 0.45, 5, w / 2, h / 2, w / 2); gr.addColorStop(0, '#5a9ae0'); gr.addColorStop(1, '#1a3a7a'); c.fillStyle = gr; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill(); const r = rng(4); c.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 30; i++) { c.beginPath(); c.ellipse(r() * w, r() * h, 8 + r() * 20, 3 + r() * 6, r() * 3, 0, 7); c.fill(); } });
    this.earthW = new THREE.Mesh(new THREE.CircleGeometry(0.22, 32), new THREE.MeshBasicMaterial({ map: eT })); this.earthW.position.set(0.0, 2.15, -3.83); g.add(this.earthW);
    const wk = new Kit(); wk.cyl(0.26, 0.26, 0.05, 28, 0x2a2a2a, [0, 2.15, -3.86], [Math.PI / 2, 0, 0]); g.add(wk.mesh(FLAT));
    // the people: Stafford floating on our side, Slayton and Brand behind you; Leonov and Kubasov beyond the hatch
    this.sta = person(g, 'stafford', V(0.45, 0.2, -0.8), Math.PI + 0.5);
    this.leo = person(g, 'leonov', V(-0.2, 0.1, -2.1), 0.3);
    this.kub = person(g, 'valeri_kubasov', V(0.7, 0.45, -3.1), -0.4);
    this.sla = person(g, 'slayton', V(-0.55, 0.45, 0.9), Math.PI - 0.5);
    this.bra = person(g, 'vance_brand', V(0.55, 0.5, 1.1), Math.PI + 0.5);
    this.crewH = [this.sta, this.leo, this.kub, this.sla, this.bra]; this.people.push(...this.crewH);
    this.giftsG = gifts(); this.giftsG.position.set(0.45, 1.75, -1.0); this.giftsG.visible = false; g.add(this.giftsG);
    holdProp(this.leo, vodkaTube(), 'Right', [0, 0.06, 0.04]);
    holdProp(this.kub, sketchPad(), 'Left', [0, 0.06, 0.05]);
    this.seeds = picture(0.1, 0.13, (c, w, h) => { c.fillStyle = '#e8dcb8'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a6a2a'; c.beginPath(); c.ellipse(w / 2, h * 0.45, w * 0.25, h * 0.2, 0, 0, 7); c.fill(); c.fillStyle = '#333'; c.font = `bold ${h * 0.12 | 0}px sans-serif`; c.textAlign = 'center'; c.fillText('SEEDS', w / 2, h * 0.85); }, { frame: 0xb8a888, px: 128 });
    holdProp(this.sta, this.seeds, 'Left', [0, 0.08, 0.04]);
    this.addScene('hatch', { group: g, bounds: 0.25, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { this.G.sky.set(200, -40); },
      update: (dt, t) => {
        const s = this.s;
        this.hK = s.hatch ? clamp01((this.hK || 0) + dt * this.F / 3) : 0; hinge.rotation.y = -ease(this.hK) * 1.9;
        this.lamp.position.set(0, 2.2, 0.2); this.lamp.intensity = 2.0; this.lamp.distance = 5; this.lamp2.position.set(0, 2.2, -2.8); this.lamp2.color.setHex(0xe8f0d8); this.lamp2.intensity = s.hatch ? 1.6 : 0; this.lamp2.distance = 4;
        this.key.intensity = 0;
        this.earthW.rotation.z = t * 0.05;
        // floating, and the handshake through the hatch
        const reach = ease(clamp01((this.hK - 0.6) / 0.4)) * (s.shake ? 1 : 0.4);
        this.sta.g.position.set(0.45, 0.2 + Math.sin(t * 0.5) * 0.03, lerp(-0.8, -1.1, reach)); this.leo.g.position.set(-0.2, 0.1 + Math.sin(t * 0.45 + 1) * 0.03, lerp(-2.1, -1.85, reach));
        this.sta.pose = s.shake ? 'point' : s.staTalk ? 'talk' : 'idle'; this.leo.pose = s.shake ? 'point' : s.leoTalk ? 'talk' : 'idle';
        this.sta.look = this.leo.g.position.clone().add(V(0, 1.6, 0)); this.leo.look = this.sta.g.position.clone().add(V(0, 1.6, 0));
        this.kub.pose = s.gifts ? 'work' : 'idle'; this.kub.look = this.sta.g.position.clone().add(V(0, 1.6, 0));
        for (const P of [this.sla, this.bra]) { P.pose = s.shake ? 'cheer' : 'idle'; P.look = V(0, 1.6, -2); }
        this.sla.g.position.y = 0.45 + Math.sin(t * 0.4) * 0.03; this.bra.g.position.y = 0.5 + Math.sin(t * 0.42 + 2) * 0.03; this.kub.g.position.y = 0.45 + Math.sin(t * 0.38 + 1) * 0.03;
        this.giftsG.visible = !!s.gifts; this.giftsG.rotation.y = Math.sin(t * 0.3) * 0.3;
      },
      exit: () => { this.lamp2.color.setHex(0xfff0dc); } });
  }

  // ---------- 4. The garden, near Washington ----------
  buildGarden() {
    const g = new THREE.Group(), N = noise2(61), k = new Kit();
    g.add(groundPlane({ size: 600, seg: 80, h: (x, z) => (Math.hypot(x, z) > 40 ? N(x / 40, z / 40) * 3 : 0), color: (x, z, c) => { const m = N(x / 3, z / 3); c.setRGB(0.16 + m * 0.05, 0.26 + m * 0.06, 0.12); } }));
    // the house behind (warm windows), a patio, garden chairs, a low wall, trees
    const PS = PROPS.fresh(); PS.add('house_english', 0, 0, 14, Math.PI); g.add(PS.build({ glow: 0x1a1410 }));
    k.box(7, 0.08, 4, 0x8a8478, [0, 0.04, 7.5]);
    for (const [x, z, yaw] of [[-1.2, 4.6, 0.3], [0.2, 4.2, 0], [1.6, 4.6, -0.3]]) { k.box(0.6, 0.08, 0.55, 0xe8e4d8, [x, 0.42, z], [0, yaw, 0]); k.box(0.6, 0.6, 0.06, 0xe8e4d8, [x - Math.sin(yaw) * 0.27, 0.72, z + Math.cos(yaw) * 0.27], [-0.15, yaw, 0]); for (const sx of [-1, 1]) k.cyl(0.02, 0.02, 0.42, 4, 0xd8d4c8, [x + sx * 0.27, 0.21, z]); }
    k.cyl(0.4, 0.4, 0.04, 16, 0xe8e4d8, [0.3, 0.6, 3.4]); k.cyl(0.03, 0.03, 0.6, 6, 0xd8d4c8, [0.3, 0.3, 3.4]);
    k.box(30, 0.6, 0.3, 0x6a6458, [0, 0.3, -12]);
    for (let i = 0; i < 10; i++) { const r = rng(i + 4), x = -20 + i * 4.5 + r() * 2, z = -16 - r() * 10; k.cyl(0.22, 0.3, 4, 6, 0x3a2a1e, [x, 2, z]); k.ball(2.8 + r(), 1, 0x1e3a1e, [x, 5.5 + r(), z], 0, [1, 1.15, 1]); }
    g.add(k.mesh(FLAT));
    const win = new THREE.MeshBasicMaterial({ color: 0xffd890 });
    for (const x of [-1.8, 1.8]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), win); w.position.set(x, 1.6, 11.1); w.rotation.y = Math.PI; g.add(w); }
    // the family: Wernher von Braun in a garden chair, Maria beside him, their son
    this.wvb = person(g, 'von_braun', V(0.2, 0.0, 4.2), Math.PI); sit(this.wvb);
    this.maria = person(g, 'maria_von_braun', V(-1.2, 0.0, 4.6), Math.PI + 0.3); sit(this.maria);
    this.peter = person(g, 'boy', V(1.5, 0, 3.0), Math.PI - 0.3);
    this.fam = [this.wvb, this.maria, this.peter]; this.people.push(...this.fam);
    // the bright moving star: the two ships, joined, crossing from west to east
    this.passStar = glowSprite(0xfff8e8, 9, 0); g.add(this.passStar);
    this.era = starText('ERA 4', 220); g.add(this.era); this.era.visible = false;
    this.addScene('garden', { group: g, bounds: 1.5, place: { lat: 38.8, year: 1975, sunLon: 115 }, amb: 0.15, fogFar: 2500,
      sky: () => { this.G.sky.set(300, -28); skyLevel(this.G, 1, 1); this.G.sky.hideMoon?.(); this.lamp.position.set(0, 2.2, 9); this.lamp.color.setHex(0xffd8a0); this.lamp.intensity = 1.2; this.lamp.distance = 10; },
      exit: () => { this.lamp.color.setHex(0xffe8c8); },
      update: (dt, t) => {
        const s = this.s;
        this.pK = s.pass ? (this.pK || 0) + dt * this.F / 70 : 0;
        const a = lerp(-1.25, 1.25, this.pK), el = 0.35 + Math.cos(a) * 0.6;
        this.passStar.position.set(Math.sin(a) * 400, Math.sin(el) * 400, -Math.cos(el) * 260 - 60);
        this.passStar.material.opacity = s.pass && this.pK < 1 ? 0.9 * clamp01(this.pK * 10) * clamp01((1 - this.pK) * 10) : 0;
        const look = this.passStar.position.clone();
        this.fam.forEach((P, i) => { P.look = s.pass ? look : V(0, 1.4, 0); P.pose = s.wvbTalk && P === this.wvb ? 'talk' : s.pass && i === 2 ? 'point' : 'idle'; });
        // ERA 4, formed by stars gathering
        this.eK = s.era ? clamp01((this.eK || 0) + dt * this.F / 6) : 0;
        this.era.visible = this.eK > 0;
        if (this.era.visible) {
          const U = this.era.userData, r = rng(8);
          U.pts.forEach(([x, y], i) => { const k = ease(clamp01(this.eK * 1.6 - (i % 17) / 40)); const sx = (r() - 0.5) * 400, sy = 80 + r() * 200;
            U.pos.set([lerp(sx, x, k), lerp(sy, 175 + y, k), -300], i * 3); const tw = (0.7 + 0.3 * Math.sin(t * 3 + U.ph[i])) * k; U.col.set([tw, tw * 0.95, tw * 0.8], i * 3); U.size[i] = 5; });
          U.commit();
        }
      } });
  }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    Object.assign(s, { rove: 0, climb: 0, dock: 0, hatch: 0, shake: 0, gifts: 0, pass: 0, era: 0, shakeC: 0, dekeTalk: 0, staTalk: 0, leoTalk: 0, wvbTalk: 0 });
    this.rK = this.cK = this.dK = this.hK = this.pK = this.eK = 0;
    this.soyuzR.reset(); this.ibR.reset();
    // 1. The last Moon landing
    await this.go(D, 'moon', yawTo(340), 0.1, { x: 6, z: 14 });
    s.guide = [7, 2.6, 11];
    s.rove = 1;
    await D.say('ch35_01');
    await D.until(() => this.rK >= 1, 6);
    s.climb = 1;
    await D.wait(fast ? 0.5 : 3);
    await D.say('ch35_02');
    await D.wait(fast ? 0.5 : 2);
    // 2. Two launches
    await this.go(D, 'baikonur', yawTo(5), 0.8, { x: 0, z: 0 });
    s.guide = [-1.5, 2.6, -2];
    await D.say('ch35_03');
    const l4 = D.sayAsync('ch35_04');
    await D.cue('lifts off'); this.soyuzR.ignite(G, { listener: V(0, 1.6, 0), puffs: this.bkPuffs });
    await l4;
    await D.wait(fast ? 1 : 5);
    await this.go(D, 'kennedy', yawTo(355), 0.8, { x: 0, z: 0 });
    s.guide = [-1.5, 2.6, -2];
    const l5 = D.sayAsync('ch35_05');
    await D.cue('the very last Apollo'); this.ibR.ignite(G, { listener: V(0, 1.6, 0), puffs: this.kPuffs });
    await l5;
    await D.wait(fast ? 1 : 3);
    await this.go(D, 'cabin', 0, 0.8, { x: 0, z: 0 });
    s.guide = [0.3, 2.2, -1.0]; s.shakeC = 1; cabinRumble(G, 14, 0.25);
    await D.say('ch35_06');
    s.dekeTalk = 1; await D.say('ch35_07'); s.dekeTalk = 0; s.shakeC = 0.3;
    // 3. The docking (the music starts), the hatch, the handshake
    await this.go(D, 'dock', 0, 1.0, { x: 0, z: 0 });
    s.guide = [-2, 2.4, -10];
    s.dock = 1;
    await D.say('ch35_08');
    await D.until(() => this.dK >= 1, 10);
    clank(G, null, 0.3);
    await this.go(D, 'hatch', 0, 1.0, { x: 0, z: 0.6 });
    s.guide = [0.5, 2.2, -0.4];
    hiss(G, null, 0.12, 1.5); s.hatch = 1;
    await D.until(() => this.hK >= 1);
    s.staTalk = 1; await D.say('ch35_09'); s.staTalk = 0;
    s.shake = 1;
    s.leoTalk = 1; await D.say('ch35_10'); s.leoTalk = 0;
    await D.say('ch35_11');
    s.gifts = 1;
    await D.say('ch35_12');
    await D.wait(fast ? 0.5 : 2);
    // 4. The garden
    await this.go(D, 'garden', yawTo(180), 1.2, { x: 0.5, z: 1.2 });
    s.guide = [-0.8, 2.4, 2.6];
    await D.say('ch35_13');
    s.pass = 1;
    const l14 = D.sayAsync('ch35_14');
    this.guideTo(this.passStar.position.clone().setLength(18).add(V(0.5, 0, 1.2)), 0, 1);
    await l14;
    await D.say('ch35_15');
    s.wvbTalk = 1; await D.say('ch35_16'); s.wvbTalk = 0;
    await D.say('ch35_17');
    await D.say('ch35_18');
    s.era = 1; this.guideTo(V(0.8, 14, -8), 0, 2);
    await D.say('ch35_19');
    await D.wait(fast ? 1 : 8);
  }
}
