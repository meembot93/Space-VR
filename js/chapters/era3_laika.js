// Era 3, Chapter 1 (n 15): First Travellers, 1957 to 1961.
//
// 1. A walled training yard in Moscow, autumn 1957: birches dropping yellow leaves, kennels, the
//    institute behind. Laika sits by the little cabin she trains in; Oleg Gazenko praises her.
//    Korolev strides in through the gate: four weeks to build Sputnik 2.
// 2. Doctor Yazdovsky's flat, the evening before: lamplight, a rug, his two children playing with
//    Laika. (Adults: pat her and she wriggles happily.)
// 3. Baikonur at dawn, 3 November 1957: the R-7 lifts off with its first passenger, seen from a
//    kilometre away. Then quiet: Sputnik 2 above the Earth at sunrise while Astra says, gently,
//    what happened (Kids and Adults each have their own line: no suffering on screen).
// 4. Von Braun's office in Huntsville, Alabama: "Ninety days, they gave us."
// 5. Cape Canaveral, night of 31 January 1958: the Juno I in its searchlights, the tub of little
//    rockets on top spinning up; liftoff; Explorer 1 in orbit and the radiation belts it found,
//    glowing round the Earth.
// 6. The press room in Washington, after midnight: Pickering, Van Allen and von Braun lift a
//    full-size Explorer over their heads in the flashbulbs. (Adults: lift it up with them.)
// 7. August 1960: Belka and Strelka circle the Earth for a day. Wow: their capsule drifts down
//    under a striped parachute into the sunrise over the steppe (music), and out they come.
// 8. January 1961, the Atlantic: Ham the chimpanzee on the deck of the recovery ship beside his
//    Mercury capsule. (Adults: hand him an apple.) "Next, a person." The journal page.
import * as THREE from 'three';
import { Kit, FLAT, segs } from '../kit.js';
import { Chapter3, D2R, yawTo, bearing, label, Journal } from '../era3/base.js';
import { person, makeFolk, animal, sit, Crowd, rows } from '../era3/folk.js';
import { loadAll, loadE3, copy, scaled, Rocket } from '../era3/craft.js';
import { Puffs, envMap, setEnv, roar, flashPop, applause, wave, siren, beep, click } from '../era3/fx.js';
import { earthSpace, groundPlane, sea } from '../era3/worlds.js';
import { room, surfMat, quad, desk, chair, armchair, sofa, table, shelf, rug, lampStand, deskLamp, curtains, picture, wall, floodTower, birch, shadeHex, rot } from '../era3/sets.js';
import { glowSprite, glowPoints, textSprite, shimmer, whoosh, awe } from '../wow/fx.js';
import { loadProps } from '../props.js';
import { vbOffice } from '../era3/places.js';
import { INK } from '../era2/common.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { grove } from '../trees.js';

const M = await loadAll(['../r7', 'craft/sputnik2', 'craft/juno1', 'craft/explorer1', 'craft/vostok', 'craft/mercury', 'craft/mercury_redstone']);
const R7 = scaled(M.r7, 30.5);
const PROPS = await loadProps(['samovar', 'soviet_truck', 'film_camera_tripod', 'bookcase', 'tiled_stove']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const R7_AT = V(0, 0, -280);     // the R-7 on its pad, from where you watch at dawn
const JUNO_AT = V(-20, 0, -150); // the Juno I at Launch Complex 26, from the blockhouse
const CHUTE0 = V(40, 420, -140); // where Belka and Strelka's capsule comes into view
const LAND = V(14, 0, -42);      // and where it lands

export default class Laika extends Chapter3 {
  constructor(G) {
    super(G, 15);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    this.s.chute = 0; this.s.lift = 0; this.s.pat = 0; this.s.apple = 0; this.s.belts = 0; this.s.gate = 0;
    this.buildYard(); this.buildHome(); this.buildPad(); this.buildOrbit(); this.buildOffice();
    this.buildCape(); this.buildBelts(); this.buildPress(); this.buildField(); this.buildShip();
    this.journal = new Journal(this, drawJournal);
  }

  // ---------- 1. The training yard, Moscow ----------
  buildYard() {
    const g = new THREE.Group(), k = new Kit();
    // packed earth and tired grass, wet in places, yellow leaves everywhere
    const N = noise2(15), N2 = noise2(16);
    g.add(groundPlane({ size: 400, seg: 90, h: (x, z) => (Math.abs(x) < 10 && z > -11 && z < 7 ? 0 : (N(x / 30, z / 30) - 0.5) * 0.6), color: (x, z, c) => { const m = N2(x / 3, z / 3); c.setRGB(0.36 + m * 0.1, 0.32 + m * 0.08, 0.2); if (Math.abs(x) < 9 && z > -10 && z < 6) c.lerp(new THREE.Color(0x5a4a38), 0.6 * N(x / 4, z / 4)); } }));
    // the walls of the yard: brick, with a gate on the east side
    for (const [a, b] of [[[-9, 6], [9, 6]], [[-9, -10], [-9, 6]], [[9, 6], [9, -2.6]], [[9, -5.4], [9, -10]]]) g.add(wall(a, b, 2.6, { kind: 'brick' }));
    // the gate: two iron leaves standing open
    for (const s of [-1, 1]) { const z0 = -4 + s * 1.4; for (let i = 0; i < 9; i++) k.box(0.03, 2.1, 0.03, 0x2a2c2e, [9 + s * 0 + 0.1 + i * 0.15 * 0.7, 1.05, z0 - s * (i * 0.15 * 0.7)], [0, 0, 0]); k.box(1.0, 0.05, 0.04, 0x2a2c2e, [9.45, 2.05, z0 - s * 0.45], [0, -s * Math.PI / 4, 0]); k.box(0.3, 2.9, 0.3, 0x7a3a2a, [9, 1.45, -4 + s * 1.55]); }
    // the institute: three floors of ochre stucco with white window frames, behind the north wall
    const fac = canvasTex(1024, 512, (c, w, h) => {
      c.fillStyle = '#c8a46a'; c.fillRect(0, 0, w, h); const r = rng(4);
      for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(80,60,30,${r() * 0.05})`; c.fillRect(r() * w, r() * h, 4, 4); }
      c.fillStyle = '#e8e0cc'; c.fillRect(0, h - 40, w, 10); c.fillRect(0, h * 0.34, w, 8); c.fillRect(0, h * 0.67, w, 8); c.fillRect(0, 0, w, 24);
      for (let f = 0; f < 3; f++) for (let i = 0; i < 12; i++) { const x = 30 + i * 82, y = 40 + f * 158; c.fillStyle = '#f0ece0'; c.fillRect(x - 6, y - 6, 52, 102); c.fillStyle = r() < 0.2 ? '#d8c090' : '#3a4a58'; c.fillRect(x, y, 40, 90); c.fillStyle = '#f0ece0'; c.fillRect(x + 18, y, 4, 90); c.fillRect(x, y + 30, 40, 4); }
    });
    const inst = new THREE.Mesh(new THREE.BoxGeometry(40, 13, 12), [new THREE.MeshLambertMaterial({ color: 0xc8a46a }), new THREE.MeshLambertMaterial({ color: 0xc8a46a }), new THREE.MeshLambertMaterial({ color: 0x6a5a4a }), new THREE.MeshLambertMaterial({ color: 0xc8a46a }), new THREE.MeshLambertMaterial({ map: fac }), new THREE.MeshLambertMaterial({ color: 0xc8a46a })]);
    inst.position.set(0, 6.5, -17); g.add(inst);
    k.box(41, 0.6, 13, 0x6a6a68, [0, 13.2, -17]);   // a tin roof edge
    // kennels along the west wall: little wooden houses with pitched roofs and name boards
    for (let i = 0; i < 5; i++) {
      const z = -8 + i * 2.6, x = -7.8;
      k.box(1.1, 0.9, 1.2, 0x8a6a42, [x, 0.45, z]); k.box(0.9, 0.06, 1.4, 0x5a3a22, [x - 0.28, 1.0, z], [0, 0, 0.55]); k.box(0.9, 0.06, 1.4, 0x5a3a22, [x + 0.28, 1.0, z], [0, 0, -0.55]);
      k.box(0.02, 0.5, 0.42, 0x1a1410, [x + 0.56, 0.32, z]); k.box(0.02, 0.12, 0.4, 0xd8d0b8, [x + 0.57, 0.8, z]);
      k.cyl(0.14, 0.12, 0.08, 10, 0x8a8e92, [x + 0.9, 0.04, z + 0.3]);   // a water bowl
    }
    // the training table, with the little pressurised cabin she trains in (its round door open)
    k.box(1.6, 0.05, 0.9, 0x6a5a48, [0, 0.8, -2.4]); for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) k.box(0.06, 0.78, 0.06, 0x3a3a3a, [sx * 0.72, 0.39, -2.4 + sz * 0.38]);
    k.add(new THREE.CylinderGeometry(0.32, 0.32, 0.8, segs(20), 1, true), 0xb8bcc0, [0.35, 1.16, -2.4], [0, 0, Math.PI / 2]);
    k.add(new THREE.CircleGeometry(0.32, segs(20)), 0x9a9ea2, [-0.05, 1.16, -2.4], [0, -Math.PI / 2, 0]);
    k.add(new THREE.TorusGeometry(0.32, 0.025, 4, segs(20)), 0x6a6e72, [0.75, 1.16, -2.4], [0, Math.PI / 2, 0]);
    k.add(new THREE.CircleGeometry(0.3, segs(20)), 0x8a8e92, [0.95, 1.16, -2.15], [0, Math.PI / 2 + 0.9, 0]);   // the door, swung open
    k.box(0.5, 0.18, 0.3, 0x5a5e62, [0.35, 0.92, -2.4]);                                                         // the tray she sits on inside
    k.cyl(0.05, 0.05, 0.2, 8, 0x2a2a2a, [0.2, 1.48, -2.4]);
    // a clipboard and a stopwatch on the table, a stool, a bucket
    k.box(0.24, 0.01, 0.32, 0xc8b890, [-0.5, 0.83, -2.2]); k.cyl(0.03, 0.03, 0.015, 10, 0xd8d8d0, [-0.3, 0.83, -2.05]);
    k.cyl(0.18, 0.18, 0.04, 12, 0x5a3a22, [1.3, 0.5, -2.8]); for (let i = 0; i < 3; i++) { const a = i * 2.1; k.cyl(0.02, 0.02, 0.5, 4, 0x3a2a1a, [1.3 + Math.cos(a) * 0.12, 0.25, -2.8 + Math.sin(a) * 0.12]); }
    k.cyl(0.14, 0.11, 0.3, 10, 0x6a7a7a, [-1.2, 0.15, -3.0]);
    // birches round about, yellow with autumn
    const r = rng(41);
    for (let i = 0; i < 14; i++) { let x, z; do { x = (r() - 0.5) * 60; z = -8 + (r() - 0.5) * 40; } while (Math.abs(x) < 11 && z > -12 && z < 8); birch(k, x, z, { h: 8 + r() * 5, seed: i + 3 }); }
    birch(k, 6.5, 3.8, { h: 10, seed: 91 }); birch(k, -5.5, -8.6, { h: 9, seed: 92, bare: 0 });
    g.add(k.mesh(FLAT));
    // puddles that reflect the grey sky
    const pud = new THREE.MeshStandardMaterial({ color: 0x6a7480, roughness: 0.08, metalness: 0.6, envMap: envMap('day'), envMapIntensity: 0.5 });
    for (const [x, z, s] of [[2.6, 1.5, 1.2], [-3.4, -0.6, 0.8], [5.5, -6, 1.6]]) { const p = new THREE.Mesh(new THREE.CircleGeometry(s, 16).rotateX(-Math.PI / 2), pud); p.position.set(x, 0.012, z); p.scale.z = 0.6; g.add(p); }
    // fallen leaves (one instanced mesh) and leaves drifting down
    const lg = new THREE.PlaneGeometry(0.07, 0.05).rotateX(-Math.PI / 2);
    const leaves = new THREE.InstancedMesh(lg, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), 900);
    const c = new THREE.Color();
    for (let i = 0; i < 900; i++) { const x = (r() - 0.5) * 18, z = -10 + r() * 16; _m.compose(V(x, 0.006 + r() * 0.004, z), _q.setFromEuler(_e.set(0, r() * 6, 0)), V(1, 1, 1)); leaves.setMatrixAt(i, _m); leaves.setColorAt(i, c.setHSL(0.1 + r() * 0.04, 0.7, 0.35 + r() * 0.2)); }
    g.add(leaves);
    this.falling = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.07, 0.05), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xd8a030 }), 60);
    this.fallSeeds = Array.from({ length: 60 }, () => ({ x: (r() - 0.5) * 16, z: -9 + r() * 14, y: r() * 9, sp: 0.4 + r() * 0.5, ph: r() * 6 }));
    g.add(this.falling);
    // the people
    this.laika = animal(g, 'laika', V(-0.45, 0.82, -2.45), 0.5);
    this.gazenko = person(g, 'gazenko', V(0.9, 0, -3.25), -0.35);
    this.korolev = person(g, 'korolev', V(13, 0, -4), -Math.PI / 2);
    // a lab assistant with a clipboard by the kennels
    this.assistant = makeFolk({ kind: 'labcoat', seed: 23, girl: true, coat: 0xe8e8e2, hair: 0x3a2a1a, height: 1.62 }); this.assistant.g.position.set(-6.2, 0, -3.5); this.assistant.g.rotation.y = Math.PI / 2 + 0.4; this.assistant.pose = 'write'; g.add(this.assistant.g);
    this.people.push(this.laika, this.gazenko, this.korolev, this.assistant);
    this.addScene('yard', { group: g, bounds: 3, place: { lat: 55.7, year: 1957, sunLon: 218 }, amb: 0.4, fogFar: 700, mist: 0.12,
      sky: () => { this.G.sky.set(200, 11); this.dim(0.75, 1.1); },
      update: (dt, t) => this.yardUpdate(dt, t) });
  }
  yardUpdate(dt, t) {
    const s = this.s;
    // leaves drifting down, rocking as they fall
    this.fallSeeds.forEach((f, i) => {
      f.y -= f.sp * dt; if (f.y < 0.02) { f.y = 8 + Math.random() * 3; }
      const x = f.x + Math.sin(t * 0.8 + f.ph) * 0.6, z = f.z + Math.cos(t * 0.6 + f.ph) * 0.4;
      _m.compose(_a.set(x, f.y, z), _q.setFromEuler(_e.set(Math.sin(t * 3 + f.ph) * 0.9, t + f.ph, Math.cos(t * 2.3 + f.ph) * 0.7)), _b.set(1, 1, 1)); this.falling.setMatrixAt(i, _m);
    });
    this.falling.instanceMatrix.needsUpdate = true;
    // Korolev comes in through the gate and over to the table
    const K = this.korolev;
    if (s.gate === 1) { K.pose = 'walk'; const d = _a.set(2.3 - K.g.position.x, 0, -1.6 - K.g.position.z); const L = d.length(); if (L > 0.1) { K.g.position.addScaledVector(d.normalize(), Math.min(L, 1.25 * dt)); K.g.rotation.y = Math.atan2(d.x, d.z); } else { s.gate = 2; K.pose = 'idle'; } }
    if (s.gate >= 2) K.g.rotation.y = damp(K.g.rotation.y, -2.3, 3, dt);
    K.look = s.gate ? V(0, 1.5, 0) : null;
    this.gazenko.look = s.gaz ? this.laika.g.getWorldPosition(new THREE.Vector3()) : V(0, 1.6, 0);
    this.laika.mode = s.gaz === 2 ? 'wag' : 'idle';
  }

  // ---------- 2. Yazdovsky's flat, the evening before ----------
  buildHome() {
    const R = room(5.2, 4.4, 2.9, { floor: surfMat('parquet'), wall: surfMat('wallpaper', '#b8a878'), windows: [{ side: 'w', at: -0.6, y: 0.85, w: 1.3, h: 1.5 }], doors: [{ side: 's', at: 1.8, w: 0.9, h: 2.1 }], skirt: 0x4a3020 });
    const g = R.group, k = new Kit();
    rug(k, 0, -0.5, 0, { w: 2.6, d: 1.8, col: 0x7a2420, border: 0xc89a50 });
    sofa(k, -0.2, -1.85, 0, { col: 0x4a5a42, w: 1.9 });
    armchair(k, 1.75, -1.0, -2.2, { col: 0x6a3a2a });
    table(k, 1.6, 1.3, 0.2, { w: 1.0, d: 0.7, cloth: 0xe8dcc8 });
    for (const [x, z, y] of [[1.15, 1.6, 0.1], [2.1, 1.1, -2.9]]) chair(k, x, z, y, {});
    shelf(k, -2.3, 1.2, Math.PI / 2, { w: 1.1, h: 1.9, seed: 7 });
    const lp = lampStand(k, -2.1, -1.7, { h: 1.55, shade: 0xe8b870 });
    curtains(k, R.windows[0], { col: 0x8a5a3a });
    // a clock and a picture on the wall, a radio set on a side table
    k.box(0.5, 0.6, 0.3, 0x5a3a22, [-2.35, 0.3, -0.2]);
    g.add(k.mesh(FLAT));
    const clock = picture(0.32, 0.32, (c, w, h) => { c.fillStyle = '#f0e8d0'; c.beginPath(); c.arc(w / 2, h / 2, w * 0.46, 0, 7); c.fill(); c.strokeStyle = '#2a2a2a'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2, h * 0.2); c.moveTo(w / 2, h / 2); c.lineTo(w * 0.72, h * 0.55); c.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; c.fillRect(w / 2 + Math.cos(a) * w * 0.4 - 2, h / 2 + Math.sin(a) * h * 0.4 - 2, 4, 4); } }, { frame: 0x5a3a22 });
    clock.position.set(0.6, 2.1, -2.18); g.add(clock);
    const pic = picture(0.7, 0.5, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9ab8d0'); gr.addColorStop(0.6, '#e8d8b0'); gr.addColorStop(0.62, '#6a8a4a'); gr.addColorStop(1, '#4a6a3a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#e8e4dc'; for (let i = 0; i < 6; i++) c.fillRect(30 + i * 36, h * 0.3, 5, h * 0.35); c.fillStyle = '#c8a030'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(32 + i * 36, h * 0.3, 16, 0, 7); c.fill(); } });
    pic.position.set(-0.4, 1.75, -2.18); g.add(pic);
    if (PROPS.has('samovar')) { const P = PROPS.fresh(); P.add('samovar', 1.55, 0.77, 1.35, 0.4, { h: 0.45 }); g.add(P.build()); }
    // outside the window: Moscow at dusk, rows of flats with lit windows, the sky going violet
    const out = new THREE.Group(); g.add(out);
    const fac = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#3a3a42'; c.fillRect(0, 0, w, h); const r = rng(8); for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) { c.fillStyle = r() < 0.45 ? `rgb(255,${190 + r() * 40 | 0},${110 + r() * 40 | 0})` : '#1a1c22'; c.fillRect(10 + x * 41, 14 + y * 49, 22, 30); } });
    const facM = new THREE.MeshBasicMaterial({ map: fac, color: 0xb8b0a8 });
    for (const [x, z, w, h] of [[-26, -8, 20, 24], [-34, 14, 26, 30], [-22, 30, 16, 20], [-48, -20, 30, 36]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(6, h, w), facM); b.position.set(x, h / 2 - 6, z); out.add(b); }
    this.addScene('home', { group: g, bounds: 1.2, indoors: true, place: { lat: 55.7, year: 1957, sunLon: 220 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(235, -6); this.dim(0.15, 0.3); this.lamp.position.copy(lp); this.lamp.intensity = 2.2; this.lamp.distance = 9; this.lamp2.position.set(0.6, 2.6, 0); this.lamp2.intensity = 0.9; this.lamp2.distance = 8; },
      update: (dt, t) => this.homeUpdate(dt, t) });
    this.dog2 = animal(g, 'laika', V(0.1, 0, -0.5), Math.PI * 0.85);
    this.yaz = person(g, 'yazdovsky', V(1.72, 0, -0.98), -2.2); sit(this.yaz);
    this.yaz.g.position.y = 0.05;
    this.kid1 = makeFolk({ kind: 'kid', seed: 31, coat: 0x3a5a8a, height: 1.22, hair: 0x6a4a2a }); this.kid1.g.position.set(-0.75, 0, -0.85); this.kid1.g.rotation.y = 0.9; g.add(this.kid1.g);
    this.kid2 = makeFolk({ kind: 'dress', girl: true, seed: 33, coat: 0xb83a3a, height: 1.1, hair: 0xb88a4a }); this.kid2.g.position.set(0.85, 0, 0.0); this.kid2.g.rotation.y = -2.1; g.add(this.kid2.g);
    this.people.push(this.dog2, this.yaz, this.kid1, this.kid2);
    this.patIt = this.touchable('pat', () => this.dog2.g.getWorldPosition(_a).setY(0.4), { hint: 'Reach down and pat Laika (TRIGGER)', deskHint: 'Click Laika to pat her', r: 0.45 });
  }
  homeUpdate(dt, t) {
    const s = this.s, D = this.dog2;
    // Laika plays between the two children; a pat makes her wriggle
    if (s.pat === 2) { D.mode = 'wag'; D.to = null; }
    else if (!D.to && Math.sin(t * 0.5) > 0.6) D.to = (D.g.position.x < 0 ? V(0.45, 0, -0.45) : V(-0.35, 0, -0.7));
    else if (!D.to) D.mode = Math.sin(t * 1.3) > 0 ? 'wag' : 'idle';
    for (const K of [this.kid1, this.kid2]) { K.look = D.g.getWorldPosition(new THREE.Vector3()).setY(0.3); K.pose = Math.sin(t * 0.7 + K.phase) > 0.5 ? 'beckon' : 'idle'; }
    this.yaz.look = D.g.getWorldPosition(new THREE.Vector3());
  }

  // ---------- 3. Baikonur at dawn ----------
  buildPad() {
    const g = new THREE.Group(), k = new Kit();
    const N = noise2(51);
    g.add(groundPlane({ size: 6000, seg: 150, h: (x, z) => (N(x / 300, z / 300) - 0.5) * 6 * clamp01((Math.hypot(x, z - R7_AT.z) - 200) / 400) * clamp01((Math.hypot(x, z) - 40) / 200), color: (x, z, c) => { const m = N(x / 40, z / 40); c.setRGB(0.55 + m * 0.12, 0.48 + m * 0.1, 0.34); } }));
    // the pad: a concrete apron over the flame pit, the four arms that hold the rocket
    k.box(80, 0.4, 60, 0x9a968c, [R7_AT.x, 0.2, R7_AT.z]);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; k.box(0.8, 9, 0.8, 0x6a6e66, [R7_AT.x + Math.cos(a) * 4.2, 4.5, R7_AT.z + Math.sin(a) * 4.2], [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3]); }
    // the service tower, already lowered, lying off to one side; buildings; floodlight towers
    k.box(4, 3, 50, 0x7a3a2a, [R7_AT.x + 30, 1.5, R7_AT.z + 10]);
    for (const [x, z, w, d, h] of [[-120, -600, 30, 14, 6], [140, -700, 20, 20, 9], [-60, -400, 12, 8, 4], [90, -350, 16, 10, 5]]) k.box(w, h, d, 0x9a9488, [x, h / 2, z]);
    for (const [x, z] of [[-60, -780], [60, -780], [0, -880]]) floodTower(k, R7_AT.x + x * 0.8, z, Math.atan2(R7_AT.x - x, R7_AT.z - z), 24);
    // your viewing spot: a low earth bank with a rail, a few engineers and a truck
    k.box(10, 0.5, 3, 0x8a7a5a, [0, 0.0, -3.2]); for (let i = 0; i < 6; i++) k.box(0.06, 0.95, 0.06, 0x4a4a48, [-4 + i * 1.6, 0.48, -1.8]); k.box(9.6, 0.06, 0.06, 0x4a4a48, [0, 0.95, -1.8]);
    g.add(k.mesh(FLAT));
    if (PROPS.has('soviet_truck')) { const P = PROPS.fresh(); P.add('soviet_truck', 7.5, 0, 3, -0.6, {}); g.add(P.build()); }
    this.watchers = [];
    for (const [x, z, y, look] of [[-2.6, -0.4, 0.1, { kind: 'greatcoat', hat: 'ushanka', coat: 0x3a3a3c }], [3.0, -0.2, -0.2, { kind: 'jacket', hat: 'cap', coat: 0x4a4a3a }], [4.2, 0.6, -0.4, { kind: 'coverall', hat: 'none', coat: 0x3a4a5a }]]) {
      const P = makeFolk({ ...look, seed: 60 + this.watchers.length }); P.g.position.set(x, 0, z); P.g.rotation.y = Math.PI + y; g.add(P.g); P.look = R7_AT.clone().setY(15); this.watchers.push(P); this.people.push(P);
    }
    this.puffs = new Puffs(1400); g.add(this.puffs.mesh);
    this.r7 = new Rocket(g, { parts: [{ M: R7, y: 0 }], engines: [[0, 0], [2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]].map(([x, z]) => ({ x, z, y: 0.2, len: 9, width: 1.3, kind: 'kero' })), size: 1, hold: 2.6, accel: 9, az: 50, tilt: 40, tiltAt: 1400, env: envMap('dawn'), trench: 0, glowEnd: 60, trailEnd: 50 });
    this.r7.place(R7_AT.x, 0.4, R7_AT.z);
    this.addScene('pad', { group: g, bounds: 3, place: { lat: 45.9, year: 1957, sunLon: 221 }, amb: 0.5, fogFar: 4200, mist: 0.02,
      sky: (dt, t) => { this.G.sky.set(118, -3 + (this.padT || 0) * 0.06); this.key.position.copy(R7_AT).add(V(-70, 50, 90)); this.key.target.position.copy(R7_AT); this.key.color.setHex(0xfff0d8); this.key.intensity = this.r7.T > 5 ? 0 : 1.3; },
      update: (dt, t) => { this.padT = (this.padT || 0) + dt; this.r7.update(dt, t, this.F); this.puffs.update(this.G, dt * this.F, [3, 0, 1], this.r7.flash || 0); for (const P of this.watchers) P.pose = this.r7.rising ? 'gasp' : 'idle'; if (this.r7.light === null) this.r7.light = this.flameLight; } });
  }

  // ---------- Orbit: Sputnik 2 (and later Belka and Strelka's ship) above the Earth ----------
  buildOrbit() {
    const SP = earthSpace(this.G, { earthR: 400 }); SP.earth.position.set(0, -470, -180); SP.earth.rotation.set(0.3, 2.2, 0);
    SP.sunDir.set(-0.8, 0.12, -0.6).normalize();
    this.orbitSP = SP;
    const g = new THREE.Group();
    this.sp2 = copy(M.sputnik2, envMap('space'), 1.2); this.sp2.position.set(2.2, 0.6, -10); this.sp2.rotation.z = 0.5; g.add(this.sp2);
    this.ks2 = copy(M.vostok, envMap('space'), 1.2); this.ks2.position.set(-1.6, 0.8, -11); this.ks2.rotation.set(0.4, 0, 1.2); this.ks2.visible = false; g.add(this.ks2);
    this.sunGlow = glowSprite(0xfff4e0, 60, 0.9); this.sunGlow.position.set(-160, 24, -120); g.add(this.sunGlow);
    this.addScene('orbit', { group: g, bounds: 0.6, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => { this.sp2.rotation.y += dt * 0.05; this.ks2.rotation.y += dt * 0.07; SP.earth.rotation.y += dt * 0.004; this.key.position.set(-80, 20, -60); this.key.intensity = 2.6; } });
  }

  // ---------- 4. Von Braun's office, Huntsville ----------
  buildOffice() { vbOffice(this, 'office', { year: 1958 }); }

  // ---------- 5. Cape Canaveral, the night of 31 January 1958 ----------
  buildCape() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(61);
    // sand and scrub, the sea to the east, a road, the blockhouse you stand beside
    g.add(groundPlane({ size: 4000, seg: 140, h: (x, z) => (x > 600 ? -2 : (N(x / 60, z / 60) - 0.5) * 0.8 * clamp01((Math.hypot(x, z) - 20) / 60)), color: (x, z, c) => { const m = N(x / 8, z / 8); if (x > 560) c.setRGB(0.72, 0.66, 0.52); else c.setRGB(0.3 + m * 0.12, 0.32 + m * 0.1, 0.2); } }));
    const S = sea({ size: 8000, col: 0x0a1a28, sky: 0x1a2438, sun: V(-0.2, -0.3, -0.8) }); S.position.set(4600, -1.2, 0); g.add(S); this.capeSea = S;
    k.box(70, 0.3, 50, 0xa8a49c, [JUNO_AT.x, 0.15, JUNO_AT.z]);
    k.box(9, 3.2, 7, 0xb8b4a8, [4, 1.6, 6]); k.box(9.6, 0.4, 7.6, 0x8a8680, [4, 3.4, 6]);   // the blockhouse
    for (let i = 0; i < 3; i++) k.box(0.5, 0.25, 0.08, 0x1a2a3a, [1.0 + i * 2, 2.4, 2.48]);
    // the launch stand and the service tower, rolled back on its rails
    k.box(4.5, 1.2, 4.5, 0x6a6e70, [JUNO_AT.x, 0.6, JUNO_AT.z]);
    const tx = JUNO_AT.x + 34, tz = JUNO_AT.z - 4;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.4, 32, 0.4, 0xb84a2a, [tx + sx * 3.5, 16, tz + sz * 3.5]);
    for (let y = 2; y < 32; y += 3) { k.box(7.4, 0.25, 0.25, 0xb84a2a, [tx, y, tz - 3.5]); k.box(7.4, 0.25, 0.25, 0xb84a2a, [tx, y, tz + 3.5]); k.box(0.25, 0.25, 7.4, 0xb84a2a, [tx - 3.5, y, tz]); k.box(0.25, 0.25, 7.4, 0xb84a2a, [tx + 3.5, y, tz]); k.box(7, 0.08, 7, 0x6a3a2a, [tx, y, tz]); }
    for (const sz of [-1, 1]) k.box(80, 0.2, 0.3, 0x5a5a5a, [tx + 10, 0.2, tz + sz * 3.5]);
    for (const [x, z] of [[-60, -200], [10, -200], [-30, -330]]) floodTower(k, JUNO_AT.x + x * 0.5, JUNO_AT.z + (z + 260) * 0.5, Math.atan2(JUNO_AT.x - (JUNO_AT.x + x * 0.5), JUNO_AT.z - (JUNO_AT.z + (z + 260) * 0.5)), 18);
    g.add(k.mesh(FLAT));
    // palms and scrub round the blockhouse
    const r = rng(9);
    g.add(grove('palm', Array.from({ length: 9 }, () => ({ x: -40 + r() * 120, z: 30 + r() * 70, s: 0.8 + r() * 0.4 })), { seed: 3, detail: 'mid' }).group);
    g.add(grove('bush', Array.from({ length: 24 }, () => ({ x: -80 + r() * 160, z: 12 + r() * 60, s: 0.7 + r() * 0.6 })), { seed: 5 }).group);
    // the people at the blockhouse, looking at the rocket
    this.capeFolk = [];
    for (const [x, z, look] of [[-2.2, 0.8, { kind: 'shirt', coat: 0xe8e8e0, tie: 0x2a2a5a, hat: 'none' }], [2.0, 1.3, { kind: 'suit', coat: 0x4a4a4e, hat: 'fedora' }], [-0.6, 2.4, { kind: 'coverall', coat: 0x8a8a7a, hat: 'hardhat' }]]) { const P = makeFolk({ ...look, seed: 80 + x * 10 }); P.g.position.set(x, 0, z); P.g.rotation.y = Math.PI + bearing(JUNO_AT.x - x, JUNO_AT.z - z) * -D2R; g.add(P.g); P.look = JUNO_AT.clone().setY(15); this.capeFolk.push(P); this.people.push(P); }
    this.puffs2 = new Puffs(900); g.add(this.puffs2.mesh);
    const juno = { ...M.juno1 };
    this.juno = new Rocket(g, { parts: [{ M: juno, y: 1.2 }], engines: [{ x: 0, z: 0, y: 1.2, len: 7, width: 1.2, kind: 'kero' }], size: 0.7, hold: 1.0, accel: 11, az: 120, tilt: 30, tiltAt: 900, env: envMap('night'), trench: 200, glowEnd: 40, trailEnd: 40, lightI: 300 });
    this.juno.place(JUNO_AT.x, 0.3, JUNO_AT.z);
    // the tub: eleven little rockets in a ring near the top that spin up before launch
    const tub = new THREE.Group(), tk = new Kit();
    tk.add(new THREE.CylinderGeometry(0.5, 0.5, 1.5, segs(16), 1, true), 0x7a7e82, [0, 0, 0]);
    for (let i = 0; i < 11; i++) { const a = i / 11 * 6.28; tk.cyl(0.075, 0.075, 1.4, 6, 0xc8ccd0, [Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4]); }
    for (let i = 0; i < 4; i++) tk.box(0.04, 1.5, 0.12, 0x1a1a1a, [Math.cos(i * 1.57) * 0.51, 0, Math.sin(i * 1.57) * 0.51], [0, -i * 1.57, 0]);
    tub.add(tk.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.35, envMap: envMap('night') })));
    this.tub = tub; tub.position.y = 1.2 + 16.7; this.juno.group.add(tub);
    this.addScene('cape', { group: g, bounds: 3, place: { lat: 28.5, year: 1958, sunLon: 311 }, amb: 0.4, fogFar: 4000, mist: 0.02,
      sky: () => { this.G.sky.set(250, -48); this.G.sky.setMoon(250, -20, 1, 0.02); this.key.position.set(JUNO_AT.x - 30, 40, JUNO_AT.z + 60); this.key.target.position.copy(JUNO_AT); this.key.color.setHex(0xe8f0ff); this.key.intensity = this.juno.T > 6 ? 0 : 1.6; this.lamp.position.set(4, 4.5, 3); this.lamp.intensity = 1.2; this.lamp.distance = 14; },
      update: (dt, t) => {
        this.tubSpin = damp(this.tubSpin || 0, this.s.spin ? 12 : 0, 0.5, dt); this.tub.rotation.y += this.tubSpin * dt;
        this.juno.update(dt, t, this.F); this.puffs2.update(this.G, dt * this.F, [1.5, 0, 0.5], this.juno.flash || 0);
        if (this.juno.light === null) this.juno.light = this.flameLight;
        this.capeSea.userData.update(t);
        for (const P of this.capeFolk) P.pose = this.juno.rising && this.juno.T < 14 ? 'cheer' : 'idle';
      },
      beds: [{ kind: 'surf', at: V(600, 0, -100), vol: 0.12, ref: 200, wide: true }] });
  }

  // ---------- Explorer 1 in orbit, and the belts it found ----------
  buildBelts() {
    const SP = earthSpace(this.G, { earthR: 150 }); SP.earth.position.set(0, -40, -900); SP.earth.rotation.set(0.25, 1.2, 0.41);
    SP.sunDir.set(-0.6, 0.3, 0.7).normalize();
    this.beltSP = SP;
    const g = new THREE.Group();
    this.exp = copy(M.explorer1, envMap('space'), 1.1); this.exp.position.set(-2.4, 1.0, -8); this.exp.rotation.set(0, 0, 1.3); g.add(this.exp);
    // the Van Allen belts: two glowing doughnuts of trapped particles round the Earth
    const beltMat = (col) => new THREE.ShaderMaterial({ uniforms: { amt: { value: 0 }, col: { value: new THREE.Color(col) }, t: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vP = position; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform float amt, t; uniform vec3 col; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = 1.0 - abs(dot(vN, vV)); float sh = 0.75 + 0.25 * sin(atan(vP.z, vP.x) * 9.0 + t * 1.5); gl_FragColor = vec4(col * pow(f, 1.6) * amt * sh, 1.0); }' });
    this.belts = [];
    for (const [rad, tube, col] of [[1.75, 0.42, 0x50a0ff], [3.6, 1.0, 0xb060ff]]) {
      const geo = new THREE.TorusGeometry(150 * rad, 150 * tube, 24, 96); geo.scale(1, 1, 0.62);
      const m = new THREE.Mesh(geo, beltMat(col)); m.rotation.x = Math.PI / 2; SP.earth.add(m); this.belts.push(m);
    }
    this.beltLabel = label('Van Allen belts', 26); this.beltLabel.position.set(300, 170, -760); this.beltLabel.material.opacity = 0; g.add(this.beltLabel);
    this.addScene('belts', { group: g, bounds: 0.6, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => { this.exp.rotation.y += dt * 4; this.exp.position.x += dt * 0.04; SP.earth.rotation.y += dt * 0.01; this.beltK = damp(this.beltK || 0, this.s.belts ? 1 : 0, 0.8, dt); for (const b of this.belts) { b.material.uniforms.amt.value = this.beltK * 0.6; b.material.uniforms.t.value = t; } this.beltLabel.material.opacity = this.beltK; this.key.position.set(-60, 30, 70); this.key.intensity = 2.4; } });
  }

  // ---------- 6. The press room in Washington, after midnight ----------
  buildPress() {
    const R = room(14, 11, 5.5, { floor: surfMat('parquet'), wall: { n: surfMat('panelwood', '#5a3a22'), s: surfMat('plaster', '#d8d0c0'), e: surfMat('plaster', '#d8d0c0'), w: surfMat('plaster', '#d8d0c0') }, ceil: surfMat('plaster', '#e8e4d8'), skirt: 0x3a2a1a });
    const g = R.group, k = new Kit();
    // a low stage at the front with a table and a curtain behind
    k.box(8, 0.35, 3.2, 0x5a3a22, [0, 0.175, -3.9]);
    for (let i = 0; i < 18; i++) k.box(0.45, 5.2, 0.12, i % 2 ? 0x5a1a1e : 0x6a2226, [-4 + i * 0.47, 2.6, -5.35]);
    table(k, 0, -4.6, 0, { w: 3.0, d: 0.8, cloth: 0x2a3a5a });
    for (let i = 0; i < 6; i++) k.cyl(0.02, 0.03, 0.25, 6, 0x2a2a2a, [-1.2 + i * 0.48, 0.91, -4.4]);   // microphones
    // rows of chairs for the reporters, and the reporters with their flash cameras
    for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) if (!(r < 1 && Math.abs(i - 4) < 2)) chair(k, -4 + i, 0.4 + r * 1.2, Math.PI, { seat: 0x3a3a4a });
    // chandeliers
    for (const x of [-3.5, 3.5]) { k.cyl(0.01, 0.01, 1.2, 4, 0x8a7a5a, [x, 4.9, -0.5]); k.cyl(0.5, 0.3, 0.3, 10, 0xd8c090, [x, 4.2, -0.5]); }
    g.add(k.mesh(FLAT));
    if (PROPS.has('film_camera_tripod')) { const P = PROPS.fresh(); P.add('film_camera_tripod', -3.2, 0, 1.2, Math.PI - 0.4, { h: 1.6 }); P.add('film_camera_tripod', 3.4, 0, 1.6, Math.PI + 0.3, { h: 1.6 }); g.add(P.build()); }
    // the three men and the satellite
    this.pickering = person(g, 'pickering', V(-1.1, 0.35, -3.35), 0.12);
    this.vanAllen = person(g, 'van_allen', V(0.05, 0.35, -3.5), 0);
    this.vb2 = person(g, 'von_braun', V(1.15, 0.35, -3.35), -0.12);
    this.people.push(this.pickering, this.vanAllen, this.vb2);
    this.expHeld = copy(M.explorer1, envMap('room'), 1); this.expHeld.rotation.z = Math.PI / 2; this.expHeld.position.set(1.0, 1.55, -3.15); g.add(this.expHeld);
    // the reporters: a row standing at the front with cameras raised
    this.reporters = [];
    for (let i = 0; i < 6; i++) { const P = makeFolk({ kind: i % 3 ? 'suit' : 'jacket', hat: i % 2 ? 'fedora' : 'none', coat: [0x3a3a3e, 0x5a4a3a, 0x2a3a4a, 0x4a4a42, 0x3a2a2a, 0x5a5a5a][i], seed: 100 + i, glasses: i === 2 }); const side = i < 3 ? -1 : 1, j = i % 3; P.g.position.set(side * (1.9 + j * 0.8), 0, -1.5 + j * 0.7 - (j === 1 ? 0.3 : 0)); P.g.rotation.y = Math.atan2(-P.g.position.x, -3.4 - P.g.position.z); P.look = V(0, 1.8, -3.4); P.pose = 'hold'; g.add(P.g); this.reporters.push(P); this.people.push(P); }
    // the flashbulbs
    this.flashes = this.reporters.map((P) => { const f = glowSprite(0xffffff, 0.6, 0); f.position.copy(P.g.position).add(V(0, 1.65, -0.35)); g.add(f); return f; });
    this.liftIt = this.touchable('lift', () => this.expHeld.getWorldPosition(_a), { hint: 'Lift it up high! Reach out and touch the satellite (TRIGGER)', deskHint: 'Click the satellite to lift it up high', r: 0.7 });
    this.addScene('press', { group: g, bounds: 4.5, indoors: true, place: { lat: 38.9, year: 1958, sunLon: 312 }, amb: 0.04, fogFar: 300,
      sky: () => { this.G.sky.set(0, -40); this.dim(0, 0.35); this.lamp.position.set(0, 4.5, -2); this.lamp.intensity = 4; this.lamp.distance = 16; this.lamp2.position.set(0, 3, 2); this.lamp2.intensity = 1.5; this.lamp2.distance = 14; },
      update: (dt, t) => this.pressUpdate(dt, t) });
  }
  pressUpdate(dt, t) {
    const s = this.s;
    this.liftK = damp(this.liftK || 0, s.lift ? 1 : 0, 2.2, dt);
    const y = lerp(1.38, 2.25, ease(this.liftK));
    this.expHeld.position.set(0.05, y, -3.25);
    for (const P of [this.pickering, this.vanAllen, this.vb2]) { P.pose = this.liftK > 0.5 ? 'cheer' : 'hold'; P.look = V(0, 1.6, 0.5); }
    // flashbulbs pop, faster when it goes up
    this.flashes.forEach((f, i) => {
      f.userData.t = (f.userData.t ?? Math.random() * 3) - dt;
      if (f.userData.t <= 0 && this.cur === 'press') { f.userData.t = (s.lift ? 0.6 : 2.2) + Math.random() * (s.lift ? 1.2 : 3); f.material.opacity = 1; this.lamp2.intensity = 6; flashPop(this.G, f.getWorldPosition(_a), 0.1); }
      f.material.opacity = Math.max(0, f.material.opacity - dt * 6);
    });
    this.lamp2.intensity = damp(this.lamp2.intensity, 1.5, 10, dt);
  }

  // ---------- 7. The steppe at sunrise: Belka and Strelka come home ----------
  buildField() {
    const g = new THREE.Group(), N = noise2(71), N2 = noise2(72);
    g.add(groundPlane({ size: 5000, seg: 150, h: (x, z) => (N(x / 400, z / 400) - 0.5) * 30 * clamp01((Math.hypot(x, z) - 120) / 500), color: (x, z, c) => { const m = N2(x / 12, z / 12); c.setRGB(0.62 + m * 0.12, 0.52 + m * 0.1, 0.28 + m * 0.05); } }));
    // tall dry grass in clumps round you
    const gk = new Kit(), r = rng(73);
    for (let i = 0; i < 600; i++) { const a = r() * 6.28, d = 2 + Math.pow(r(), 0.6) * 60, x = Math.cos(a) * d, z = Math.sin(a) * d - 10; for (let j = 0; j < 3; j++) gk.box(0.015, 0.4 + r() * 0.4, 0.004, [0xc8a860, 0xb89850, 0xd8b870][j], [x + (r() - 0.5) * 0.2, 0.25, z + (r() - 0.5) * 0.2], [(r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5]); }
    g.add(gk.mesh(FLAT));
    // the capsule under its striped parachute
    this.capsule = new THREE.Group(); g.add(this.capsule);
    const cap = copy(M.vostok, envMap('dawn'), 0.9); this.capsule.add(cap); this.capsuleModel = cap;
    const chute = new THREE.Group(); this.capsule.add(chute); this.chute = chute;
    const canopyTex = canvasTex(512, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#f0ece0' : '#e8642a'; c.fillRect(i * w / 16, 0, w / 16 + 1, h); } });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshLambertMaterial({ map: canopyTex, side: THREE.DoubleSide })); canopy.scale.y = 0.6; canopy.position.y = 26; chute.add(canopy);
    const lk = new Kit(); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; lk.tube([[Math.cos(a) * 6.3, 26 + 0.6 * 9 * Math.cos(Math.PI * 0.42) * 0.6, Math.sin(a) * 6.3], [0, 6, 0]], 0.02, 0xd8d0c0, 3); }
    chute.add(lk.mesh(FLAT));
    this.capsule.position.copy(CHUTE0); this.capsule.visible = false;
    // the recovery team and their truck, out in the grass
    if (PROPS.has('soviet_truck')) { const P = PROPS.fresh(); P.add('soviet_truck', -26, 0, -40, 0.8, {}); g.add(P.build()); }
    this.team = [];
    for (const [x, z, look] of [[-22, -36, { kind: 'jacket', hat: 'cap', coat: 0x5a5a4a }], [-20.5, -38, { kind: 'labcoat', coat: 0xe8e8e0 }], [-23, -34.5, { kind: 'uniform', hat: 'peaked', coat: 0x4a5a3a }]]) { const P = makeFolk({ ...look, seed: 130 + x }); P.g.position.set(x, 0, z); g.add(P.g); P.home = P.g.position.clone(); this.team.push(P); this.people.push(P); }
    // the two dogs (and, later, Strelka's puppies)
    this.belka = animal(g, 'belka', LAND.clone().add(V(-1.2, 0, 1.4)), 2.4); this.belka.g.visible = false;
    this.strelka = animal(g, 'laika', LAND.clone().add(V(-0.3, 0, 1.8)), 2.8, { tint: 0xfff4ec, scale: 0.92 }); this.strelka.g.visible = false;
    this.pups = [0, 1, 2].map((i) => { const P = animal(g, 'belka', LAND.clone().add(V(-1.8 + i * 0.45, 0, 2.6 + (i % 2) * 0.3)), 2.6 + i * 0.4, { scale: 0.42, tint: [0xfff8f0, 0xf0e0d0, 0xffffff][i] }); P.g.visible = false; return P; });
    this.people.push(this.belka, this.strelka, ...this.pups);
    this.puffs3 = new Puffs(200); g.add(this.puffs3.mesh);
    this.addScene('field', { group: g, bounds: 3, place: { lat: 51.5, year: 1960, sunLon: 147 }, amb: 0.6, fogFar: 3500, mist: 0.03,
      sky: () => { this.G.sky.set(68, -1.5 + (this.fieldT || 0) * 0.06); },
      update: (dt, t) => this.fieldUpdate(dt, t) });
  }
  fieldUpdate(dt, t) {
    const s = this.s; this.fieldT = (this.fieldT || 0) + dt * this.F;
    // the capsule drifts down, swaying under its canopy, and lands with a thump and a puff of dust
    if (s.chute === 1) {
      this.capsule.visible = true; this.chuteT = (this.chuteT || 0) + dt * this.F;
      const k = clamp01(this.chuteT / 34), p = CHUTE0.clone().lerp(LAND, k);
      p.y = lerp(CHUTE0.y, 0, ease(Math.min(1, k * 1.02)));
      this.capsule.position.copy(p); this.capsule.rotation.z = Math.sin(t * 0.7) * 0.06 * (1 - k); this.capsule.rotation.x = Math.cos(t * 0.5) * 0.05 * (1 - k);
      if (k >= 1) { s.chute = 2; this.G.audio.boom?.(this.root.localToWorld(LAND.clone())); for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28; this.puffs3.emit(LAND.x + Math.cos(a), 0.3, LAND.z + Math.sin(a), Math.cos(a) * 3, 0.6, Math.sin(a) * 3, 1, 4, 5, 0xc8b890, 0.5, 0.8); } }
    }
    if (s.chute >= 2) {
      // the canopy sags down onto the grass beside it
      this.sag = damp(this.sag || 0, 1, 0.7, dt); this.chute.rotation.z = -this.sag * 1.3; this.chute.position.set(this.sag * 7, -this.sag * 4, 0); this.chute.scale.y = 1 - this.sag * 0.6;
      // the team runs over; the dogs come out
      this.team.forEach((P, i) => { const to = LAND.clone().add(V(-2.4 + i * 1.6, 0, 2.2 + (i % 2))); const d = _a.subVectors(to, P.g.position).setY(0), L = d.length(); if (L > 0.2) { P.pose = 'walk'; P.g.position.addScaledVector(d.normalize(), Math.min(L, 2.6 * dt)); P.g.rotation.y = Math.atan2(d.x, d.z); } else { P.pose = s.chute >= 3 ? 'cheer' : 'idle'; P.look = LAND.clone().setY(0.6); } });
    }
    for (const A of [this.belka, this.strelka]) { A.g.visible = s.chute >= 3; if (s.chute >= 3) A.mode = 'wag'; }
    for (const P of this.pups) { P.g.visible = s.pups; P.mode = 'wag'; }
    this.puffs3.update(this.G, dt, [1, 0, 0], 0);
  }

  // ---------- 8. The recovery ship, the Atlantic: Ham ----------
  buildShip() {
    const g = new THREE.Group(), k = new Kit();
    const S = sea({ size: 9000, col: 0x1a4a6a, sky: 0x8ab0d0, sun: V(0.4, 0.6, -0.7) }); S.position.y = -5; g.add(S); this.shipSea = S;
    // the deck: grey steel planking, railings, a deckhouse with portholes, a crane
    const deck = quad(18, 34, surfMat('deck', '#8a8e88'), 2); deck.rotation.x = -Math.PI / 2; deck.position.set(0, 0, -6); g.add(deck);
    k.box(18, 5, 34, 0x5a6068, [0, -2.55, -6]);
    for (const sx of [-1, 1]) { for (let i = 0; i < 18; i++) k.cyl(0.03, 0.03, 1.0, 4, 0x8a8e92, [sx * 8.9, 0.5, -22 + i * 2]); for (const y of [0.5, 1.0]) k.box(0.05, 0.05, 34, 0x8a8e92, [sx * 8.9, y, -6]); }
    k.box(12, 6, 7, 0x9a9ea0, [0, 3, -19]); k.box(8, 3, 5, 0x9a9ea0, [0, 7.5, -19.5]);
    for (let i = 0; i < 5; i++) k.cyl(0.25, 0.25, 0.1, 12, 0x2a3a4a, [-4 + i * 2, 4, -15.45], [Math.PI / 2, 0, 0]);
    k.cyl(0.4, 0.5, 9, 8, 0xc8a040, [-5.5, 4.5, -14]); k.box(0.4, 0.4, 12, 0xc8a040, [-5.5, 9.2, -9], [0.55, 0, 0]);   // the crane
    k.tube([[-5.5, 12.4, -3.6], [-5.5, 6, -4.2], [-4.2, 2.6, -4.2]], 0.02, 0x2a2a2a);
    // crates, coiled ropes, a life ring
    for (const [x, z] of [[1.2, -2.0], [5, -8], [-6, -10]]) k.box(0.9, 0.7, 0.7, 0x6a5a3a, [x, 0.35, z]);
    for (const [x, z] of [[6.5, -2], [-7, 0]]) k.add(new THREE.TorusGeometry(0.35, 0.08, 4, 12), 0xc8b890, [x, 0.08, z], [Math.PI / 2, 0, 0]);
    k.add(new THREE.TorusGeometry(0.35, 0.09, 6, 14), 0xe8642a, [8.7, 1.2, -6], [0, Math.PI / 2, 0]);
    g.add(k.mesh(FLAT));
    // the Mercury capsule, wet, on a cradle; Ham beside it
    this.merc = copy(M.mercury, envMap('day'), 0.8); this.merc.position.set(-3.8, 0.45, -4.6); this.merc.rotation.y = 0.6; g.add(this.merc);
    this.ham = animal(g, 'ham', V(-1.6, 0.7, -2.2), 0.5);
    this.sailors = [];
    for (const [x, z, y, look] of [[-2.6, -1.4, 0.6, { kind: 'sailor', hat: 'sailor', coat: 0xe8e8e0 }], [-0.6, -3.2, -0.8, { kind: 'uniform', hat: 'peaked', coat: 0x2a2a3a }], [2.6, -4.6, -1.6, { kind: 'sailor', hat: 'sailor', coat: 0x2a3a5a }], [-5.8, -2.0, 1.2, { kind: 'coverall', hat: 'hardhat', coat: 0x4a5a6a }]]) { const P = makeFolk({ ...look, seed: 150 + x * 3 }); P.g.position.set(x, 0, z); P.g.rotation.y = y; P.look = V(-1.6, 1.0, -2.2); g.add(P.g); this.sailors.push(P); this.people.push(P); }
    this.people.push(this.ham);
    // the apple on the crate beside you
    const ak = new Kit(); ak.ball(0.045, 1, 0xc0281a, [0, 0, 0], 0, [1, 0.9, 1]); ak.cyl(0.004, 0.004, 0.03, 4, 0x4a3a1a, [0, 0.045, 0]); ak.box(0.03, 0.002, 0.015, 0x4a8a2a, [0.012, 0.05, 0], [0, 0, 0.5]);
    this.apple = ak.mesh(FLAT); this.appleHome = V(1.0, 0.75, -1.85); this.apple.position.copy(this.appleHome); g.add(this.apple);
    this.appleIt = this.touchable('apple', () => this.apple.getWorldPosition(_a), { hint: 'Pick up the apple and hand it to Ham (TRIGGER)', deskHint: 'Click the apple to give it to Ham', r: 0.3 });
    this.addScene('ship', { group: g, bounds: 1.5, place: { lat: 28, year: 1961, sunLon: 311 }, amb: 0.5, fogFar: 6000, mist: 0.02,
      sky: () => { this.G.sky.set(200, 34); },
      update: (dt, t) => {
        this.shipSea.userData.update(t);
        g.rotation.z = Math.sin(t * 0.4) * 0.008; g.rotation.x = Math.sin(t * 0.31) * 0.006;   // a gentle roll (tiny: comfort)
        const s = this.s;
        if (s.apple === 1) { this.appleK = Math.min(1, (this.appleK || 0) + dt * 0.9); const to = V(-1.45, 1.05, -2.0); this.apple.position.lerpVectors(this.appleHome, to, ease(this.appleK)); this.apple.position.y += Math.sin(this.appleK * Math.PI) * 0.4; if (this.appleK >= 1) s.apple = 2; }
        this.ham.mode = s.apple === 2 ? 'eat' : 'idle';
        for (const P of this.sailors) P.pose = s.apple === 2 && P !== this.sailors[3] ? 'cheer' : 'idle';
      },
      beds: [{ kind: 'surf', at: V(10, -4, -6), vol: 0.25, ref: 8 }] });
  }

  // indoors and under grey skies: turn the Sun down (sun) and the sky's fill (fill)
  dim(sun, fill) { const S = this.G.sky; S.sunLight.intensity *= sun; S.hemi.intensity *= fill; }

  beds() { return [
    { kind: 'leaves', at: V(6, 6, -6), vol: 0.1, ref: 10, wide: true, on: (ch) => ch.cur === 'yard' },
    { kind: 'room', vol: 0.08, on: (ch) => ch.cur === 'home' || ch.cur === 'office' || ch.cur === 'press' },
    { kind: 'leaves', at: V(30, 2, -30), vol: 0.08, ref: 40, wide: true, on: (ch) => ch.cur === 'pad' || ch.cur === 'field' },
    { kind: 'surf', at: V(400, 0, -100), vol: 0.14, ref: 150, wide: true, on: (ch) => ch.cur === 'cape' },
    { kind: 'surf', at: V(10, -4, -6), vol: 0.3, ref: 8, on: (ch) => ch.cur === 'ship' },
  ]; }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. Moscow, autumn 1957
    await this.go(D, 'yard', 0, 0.1, { x: 0, z: 0.6 });
    s.guide = [-1.6, 1.9, -2.6];
    const l1 = D.sayAsync('ch15_01');
    await D.cue('a little stray dog'); s.gaz = 1; s.guide = [-1.2, 1.6, -2.4];
    await l1;
    await D.say('ch15_02');
    s.gaz = 2;
    await D.say('ch15_03');
    // Korolev comes in through the gate
    s.gate = 1; s.guide = [4, 2.4, -3];
    const l4 = D.sayAsync('ch15_04');
    await l4; await D.until(() => s.gate >= 2, fast ? 1 : 8);
    this.korolev.pose = 'talk';
    await D.say('ch15_05');
    this.korolev.pose = 'idle';
    // 2. The night before: Yazdovsky's flat
    await this.go(D, 'home', 0, 0.9, { x: 0, z: 1.1 });
    s.guide = [-1.0, 1.7, -1.4];
    await D.say('ch15_06');
    await this.ask(D, 'pat', { hint: this.patIt.hint, deskHint: this.patIt.deskHint, after: 1.2, timeout: 18 });
    s.pat = 2; await D.wait(fast ? 0.3 : 3);
    // 3. Baikonur, dawn on the 3rd of November
    await this.go(D, 'pad', 0, 1.0, { x: 0, z: 0 });
    s.guide = [-5, 3, -12];
    await D.say('ch15_07');
    await D.wait(fast ? 0.2 : 1);
    this.r7.ignite(G, { listener: V(0, 1.6, 0), puffs: this.puffs, roarVol: 2.2, secs: 30 });
    await D.until(() => this.r7.T > 22, fast ? 6 : 40);
    // quietly, Sputnik 2 above the Earth at sunrise
    await this.go(D, 'orbit', 0, 1.4, { x: 0, z: 0 });
    s.guide = [-1.6, 1.8, -4];
    await D.say(this.pick(D, 'ch15_08', 'ch15_09'));
    await D.wait(fast ? 0.3 : 2.5);
    // 4. Huntsville, Alabama
    await this.go(D, 'office', 0, 1.0, { x: 0, z: 1.2 });
    s.guide = [-1.3, 2.0, -1.2];
    await D.say('ch15_10');
    s.vbTurn = 1;
    await D.wait(fast ? 0.2 : 1.2);
    await D.say('ch15_11');
    // 5. Cape Canaveral, 31 January 1958
    await this.go(D, 'cape', yawTo(bearing(JUNO_AT.x, JUNO_AT.z)), 1.0, { x: 0, z: 0 });
    s.guide = [9, 6, -50];
    const l12 = D.sayAsync('ch15_12');
    await D.cue('a tub'); s.spin = 1; s.guide = [-26, 20, -240];
    await l12;
    await D.wait(fast ? 0.2 : 2);
    beep(G, null, 0.1, 880, 0.3);
    this.juno.ignite(G, { listener: V(0, 1.6, 0), puffs: this.puffs2, roarVol: 1.8, secs: 26 });
    await D.until(() => this.juno.T > 16, fast ? 5 : 30);
    // Explorer 1 in orbit, and what it found
    await this.go(D, 'belts', 0, 1.2, { x: 0, z: 0 });
    s.guide = [1.6, 1.6, -3.5];
    const l13 = D.sayAsync('ch15_13');
    await D.cue('belts of invisible'); s.belts = 1; shimmer(G, 3, 0.12); s.guide = [6, 4, -40];
    await l13;
    await D.wait(fast ? 0.3 : 2);
    // 6. The press room
    await this.go(D, 'press', 0, 1.0, { x: 0, z: -0.4 });
    s.guide = [-2.4, 2.4, -2.6];
    await D.say('ch15_14');
    await this.ask(D, 'lift', { hint: this.liftIt.hint, deskHint: this.liftIt.deskHint, after: 1.0, timeout: 20 });
    s.lift = 1; applause(G, null, 4, 0.25);
    await D.wait(fast ? 0.4 : 4);
    // 7. Belka and Strelka
    this.ks2.visible = true; this.sp2.visible = false;
    await this.go(D, 'orbit', 0, 1.0, { x: 0, z: 0 });
    s.guide = [1.8, 1.8, -5];
    await D.say('ch15_15');
    await this.go(D, 'field', yawTo(bearing(LAND.x, LAND.z) - 10), 1.2, { x: 0, z: 0 });
    s.chute = 1; s.guide = [4, 4, -18];
    await D.wait(fast ? 0.5 : 3);
    const l16 = D.sayAsync('ch15_16');   // the music comes in here (js/music.js)
    await l16;
    await D.until(() => s.chute >= 2, fast ? 4 : 40);
    await D.wait(fast ? 0.3 : 2.5);
    s.chute = 3; s.guide = LAND.clone().add(V(-1.5, 1.8, 2.5)).toArray();
    await D.wait(fast ? 0.3 : 3);
    const l17 = D.sayAsync('ch15_17');
    await D.cue('puppies'); s.pups = true; shimmer(G, 2, 0.1);
    await l17;
    await D.wait(fast ? 0.3 : 2);
    // 8. Ham, on the deck of the recovery ship
    await this.go(D, 'ship', yawTo(330), 1.0, { x: 0.4, z: 0 });
    s.guide = [-2.2, 2.0, -3.6];
    await D.say('ch15_18');
    await this.ask(D, 'apple', { hint: this.appleIt.hint, deskHint: this.appleIt.deskHint, after: 1.0, timeout: 18 });
    s.apple = 1; await D.until(() => s.apple === 2, fast ? 1 : 4);
    await D.wait(fast ? 0.3 : 2);
    await D.say('ch15_19');
    await this.journal.present(D);
  }
}

function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
  g.fillText('The first travellers, 1957 to 1961', 40, 70);
  g.font = 'italic 26px Georgia, serif';
  // a little dog in a cabin
  g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.ellipse(150, 220, 90, 60, 0, 0, 7); g.stroke();
  g.fillStyle = 'rgba(58,42,24,0.12)'; g.beginPath(); g.ellipse(150, 220, 70, 44, 0, 0, 7); g.fill();
  g.fillStyle = INK; g.beginPath(); g.ellipse(150, 232, 34, 18, 0, 0, 7); g.fill(); g.beginPath(); g.arc(186, 212, 15, 0, 7); g.fill(); g.beginPath(); g.moveTo(180, 198); g.lineTo(186, 184); g.lineTo(192, 198); g.fill();
  g.fillText('Laika, Sputnik 2', 70, 320); g.fillText('3 November 1957', 70, 352);
  // Explorer 1 and the belts
  g.strokeStyle = '#4a70b0'; g.lineWidth = 4; g.beginPath(); g.ellipse(520, 230, 150, 60, 0, 0, 7); g.stroke(); g.beginPath(); g.ellipse(520, 230, 220, 100, 0, 0, 7); g.stroke();
  g.fillStyle = '#4a80c0'; g.beginPath(); g.arc(520, 230, 40, 0, 7); g.fill();
  g.fillStyle = INK; g.fillText('Explorer 1 finds the Van Allen belts', 360, 360);
  // the striped parachute
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f0ece0' : '#d8642a'; g.beginPath(); g.moveTo(830, 220); g.arc(830, 220, 80, Math.PI + i * Math.PI / 8, Math.PI + (i + 1) * Math.PI / 8); g.fill(); }
  g.strokeStyle = INK; g.lineWidth = 1.5; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(830 + Math.cos(Math.PI + i * Math.PI / 8) * 80, 220 + Math.sin(Math.PI + i * Math.PI / 8) * 80); g.lineTo(830, 320); g.stroke(); }
  g.fillStyle = INK; g.beginPath(); g.arc(830, 330, 14, 0, 7); g.fill();
  g.fillText('Belka and Strelka', 730, 390); g.fillText('home safe, 1960', 740, 422);
  g.fillText('Ham the chimpanzee, 1961: an apple', 60, 470); g.fillText('for his trouble', 60, 502);
  g.font = 'italic bold 30px Georgia, serif';
  g.fillText('They showed the way. Next: a person.', 40, h - 40);
}
