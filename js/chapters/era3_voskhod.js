// Era 3, Chapter 4 (n 18): Seagull and the first spacewalk. Valentina Tereshkova (1963) and
// Alexei Leonov (1965).
//
// 1. The textile mill in Yaroslavl: rows of looms clattering, Valentina at hers. 2. A summer
//    afternoon, high over the fields: her parachute opens, the club's biplane droning away.
// 3. Inside Vostok 6: "Ya Chaika!", the blue band of the horizon through the porthole.
// 4. Korolev's office: the pressure, his health; "Next, a man will step outside."
// 5. Outside Voskhod 2 (the wow, music from "pushes off"): Leonov comes out of the airlock tube
//    and floats on his tether over the turning Earth; his suit balloons; Adults turn the valve
//    to let air out; he squeezes back in head first.
// 6. The snowy forest in the Urals: the capsule in the snow, the fire, two cold nights, wolves'
//    eyes and howls in the trees, stars through the pines. 7. Leonov's own drawing of the sunrise.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo, bearing } from '../era3/base.js';
import { person, makeFolk, animal, sit, wear } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { cabin, panelLamp } from '../era3/cabin.js';
import { envMap, hiss, staticBurst, breath, heartbeat, howl, clank } from '../era3/fx.js';
import { earthSpace, groundPlane, spaceSun } from '../era3/worlds.js';
import { room, surfMat, quad, desk, chair, table, shelf, rug, picture } from '../era3/sets.js';
import { glowSprite, glowPoints, whoosh } from '../wow/fx.js';
import { canvasTex, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { grove } from '../trees.js';

const M = await loadAll(['craft/voskhod2', 'craft/vostok', 'props/helmet_berkut', 'craft/r7_vostok']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const SKY_Y = 650;                  // how high you float over the fields while she jumps
const SHIP = V(1.2, 0.2, -6.5);     // Voskhod 2, out in space in front of you
const HATCH = V(0, 4.15, 3.5);      // the end of the airlock tube (in the ship's own space)
const FIRE = V(0, 0, -3.2);         // the campfire in the forest

export default class Voskhod extends Chapter3 {
  constructor(G) {
    super(G, 18);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { chute: 0, space: 0, korolev: 0, out: 0, puff: 0, valve: 0, back: 0, wolves: 0, drawing: 0 });
    this.buildMill(); this.buildJump(); this.buildCabin(); this.buildOffice(); this.buildWalk(); this.buildForest(); this.buildEasel();
    Object.assign(G.narration.radio, { ch18_04: 'ussr', ch18_06: 'ussr', ch18_12: 'ussr', ch18_15: 'ussr' });
  }
  dim(sun, hemi) { this.G.sky.sunLight.intensity *= sun; this.G.sky.hemi.intensity *= hemi; }

  // ---------- 1. The mill ----------
  buildMill() {
    const R = room(18, 12, 5.2, { floor: surfMat('concrete', '#8a847a'), wall: surfMat('brick', '#9a6a52'), ceil: surfMat('plaster', '#d8d4cc'), windows: [-6, -2, 2, 6].flatMap((at) => [{ side: 'e', at: at * 0.7, y: 1.4, w: 1.8, h: 2.8 }, { side: 'w', at: at * 0.7, y: 1.4, w: 1.8, h: 2.8 }]), skirt: 0x4a3a2a, frame: 0x6a7a6a });
    const g = R.group, k = new Kit();
    // rows of looms: an iron frame, the warp threads (a pale sheet), the cloth roll, the beam
    this.shuttles = [];
    const shK = new Kit(); shK.box(0.26, 0.05, 0.06, 0xc8a050, [0, 0, 0]);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) {
      const x = -6.4 + i * 3.2, z = -3.6 + r * 2.4;
      if (r === 3 && i === 2) continue;                 // the aisle where you stand
      for (const sx of [-1, 1]) { k.box(0.1, 1.2, 1.3, 0x3a4a44, [x + sx * 1.05, 0.6, z]); k.box(0.1, 0.3, 0.3, 0x3a4a44, [x + sx * 1.05, 1.3, z - 0.4]); }
      k.box(2.2, 0.1, 0.1, 0x3a4a44, [x, 1.15, z - 0.5]); k.box(2.2, 0.1, 0.1, 0x3a4a44, [x, 0.35, z + 0.5]);
      k.cyl(0.14, 0.14, 2.0, 10, 0x6a5a44, [x, 0.95, z + 0.55], [0, 0, Math.PI / 2]);      // the cloth roll
      k.cyl(0.16, 0.16, 2.0, 10, 0xd8d0c0, [x, 0.75, z - 0.6], [0, 0, Math.PI / 2]);      // the warp beam
      k.box(2.0, 0.02, 1.0, 0xe8e0d0, [x, 0.92, z], [0.12, 0, 0]);                         // the warp
      k.box(2.0, 0.24, 0.06, 0x2a3430, [x, 1.05, z - 0.1]);                                // the reed and its frame
      const sh = new THREE.Group(); sh.position.set(x, 0.98, z - 0.02); g.add(sh); this.shuttles.push({ g: sh, x, ph: (r * 5 + i) * 0.7 });
    }
    // drive shafts along the ceiling, with belts down to each row
    for (let r = 0; r < 4; r++) { k.cyl(0.05, 0.05, 17, 6, 0x4a4a48, [0, 4.4, -3.6 + r * 2.4], [0, 0, Math.PI / 2]); for (let i = 0; i < 5; i++) k.box(0.06, 3.2, 0.02, 0x2a2420, [-6.4 + i * 3.2 + 1.2, 2.75, -3.6 + r * 2.4 - 0.1]); }
    for (let i = 0; i < 4; i++) k.box(1.2, 0.08, 0.08, 0xe8d8a0, [-6 + i * 4, 4.9, 0]);
    g.add(k.mesh(FLAT));
    this.shMesh = new THREE.InstancedMesh(shK.geometry(), FLAT, this.shuttles.length); g.add(this.shMesh);
    // the banner over the far wall
    const banner = quad(7, 0.7, new THREE.MeshLambertMaterial({ map: canvasTex(700, 70, (c, w, h) => { c.fillStyle = '#a02020'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0e0a0'; c.font = 'bold 36px sans-serif'; c.textAlign = 'center'; c.fillText('КРАСНЫЙ ПЕРЕКОП — ЯРОСЛАВЛЬ', w / 2, 48); }) }));
    banner.position.set(0, 4.0, -5.97); g.add(banner);
    // the weavers, and Valentina at the loom nearest you
    this.weavers = [];
    const spots = [[-6.4, -3.6], [0, -3.6], [6.4, -3.6], [-3.2, -1.2], [3.2, -1.2], [-6.4, 1.2], [6.4, 1.2], [-3.2, 3.6]];
    spots.forEach(([x, z], i) => { const P = makeFolk({ kind: 'dress', hat: 'kerchief', hatCol: [0xe8e0d0, 0xc84a3a, 0x5a7aa0, 0xe8c050][i % 4], coat: [0x5a6a7a, 0x7a5a4a, 0x6a7a5a, 0x8a7a6a][i % 4], seed: 500 + i }); P.g.position.set(x + 0.4, 0, z + 1.05); P.g.rotation.y = Math.PI; P.pose = 'work'; g.add(P.g); this.weavers.push(P); });
    this.val = person(g, 'tereshkova', V(0.0 - 0.4, 0, 1.2 + 1.05), Math.PI); this.val.pose = 'work'; this.val.look = V(0, 0.95, 1.2);
    this.people.push(...this.weavers, this.val);
    this.addScene('mill', { group: g, bounds: 1.0, indoors: true, place: { lat: 57.6, year: 1960, sunLon: 60 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(150, 35); this.dim(0.8, 0.9); this.lamp.position.set(0, 4.6, 0); this.lamp.intensity = 2.0; this.lamp.distance = 16; },
      update: (dt, t) => {
        const m = new THREE.Matrix4(), q = new THREE.Quaternion();
        this.shuttles.forEach((S, i) => { const u = Math.sin(t * 3.2 + S.ph); this.shMesh.setMatrixAt(i, m.compose(_a.set(S.x + Math.sign(u) * Math.pow(Math.abs(u), 0.3) * 0.9, 0.98, S.g.position.z), q, V(1, 1, 1))); });
        this.shMesh.instanceMatrix.needsUpdate = true;
        if (Math.random() < dt * 9) clank(this.G, this.root.localToWorld(V((Math.random() - 0.5) * 14, 1, (Math.random() - 0.5) * 8)), 0.05);
      } });
  }

  // ---------- 2. The parachute jump ----------
  buildJump() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(91), N2 = noise2(92);
    // the fields far below: patchwork strips, a river, birch woods
    g.add(groundPlane({ size: 9000, seg: 160, h: () => 0, dense: 1, color: (x, z, c) => { const strip = Math.floor((x * 0.7 + z * 0.3) / 140 + N(x / 900, z / 900) * 3); const m = N2(x / 60, z / 60); const river = Math.abs(z + 400 + Math.sin(x / 300) * 160) < 18; if (river) c.setRGB(0.25, 0.4, 0.5); else if (N(x / 260, z / 260) > 0.68) c.setRGB(0.2 + m * 0.05, 0.32 + m * 0.06, 0.18); else c.setRGB([0.62, 0.5, 0.42, 0.56][strip & 3] + m * 0.06, [0.6, 0.55, 0.5, 0.42][strip & 3] + m * 0.06, [0.3, 0.26, 0.22, 0.24][strip & 3]); } }));
    // a soft cloud or two below you
    for (let i = 0; i < 8; i++) { const c = glowSprite(0xffffff, 120 + i * 20, 0.35); c.position.set(-500 + i * 160, 320 + (i % 3) * 40, -300 - (i % 4) * 200); c.material.blending = THREE.NormalBlending; g.add(c); }
    // Valentina under her canopy, and two more jumpers lower down
    const canopy = (col1, col2) => { const tex = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? col1 : col2; c.fillRect(i * w / 16, 0, w / 16 + 1, h); } }); const cg = new THREE.Group(); const m = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); m.scale.y = 0.6; m.position.y = 7; cg.add(m); const lk = new Kit(); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; lk.tube([[Math.cos(a) * 3.2, 7 + 3.4 * Math.cos(Math.PI * 0.42) * 0.6, Math.sin(a) * 3.2], [0, 1.6, 0]], 0.012, 0xd8d0c0, 3); } cg.add(lk.mesh(FLAT)); return cg; };
    this.valChute = new THREE.Group(); g.add(this.valChute);
    this.valChute.add(canopy('#f0ece0', '#e8a030'));
    this.val2 = person(this.valChute, 'tereshkova', V(0, 0, 0), 0.3); this.val2.pose = 'hold';
    this.others = [V(-30, -50, -40), V(22, -90, -70)].map((p, i) => { const c = canopy(i ? '#d84a3a' : '#5a8ac8', '#f0ece0'); c.position.copy(p); c.scale.setScalar(1.0); const P = makeFolk({ kind: 'coverall', coat: 0x5a6a4a, seed: 520 + i }); P.pose = 'hold'; c.add(P.g); g.add(c); return c; });
    // the club's biplane, droning away
    const pk = new Kit();
    pk.box(1.3, 1.4, 8.5, 0x5a6a4a, [0, 0, 0]); pk.box(14, 0.12, 1.8, 0x5a6a4a, [0, 0.9, -1.2]); pk.box(12, 0.12, 1.6, 0x5a6a4a, [0, -0.5, -1.2]);
    for (const sx of [-4, 4]) pk.box(0.08, 1.4, 0.08, 0x3a3a3a, [sx, 0.2, -1.2]);
    pk.box(4, 0.1, 1.0, 0x5a6a4a, [0, 0.3, 3.8]); pk.box(0.1, 1.4, 1.2, 0x5a6a4a, [0, 0.9, 3.9]); pk.cyl(0.6, 0.6, 0.5, 12, 0x2a2a2a, [0, 0, -4.4], [Math.PI / 2, 0, 0]);
    for (const sx of [-0.8, 0.8]) { pk.cyl(0.05, 0.05, 1.2, 5, 0x2a2a2a, [sx, -1.2, -2.0]); pk.cyl(0.35, 0.35, 0.15, 10, 0x1a1a1a, [sx, -1.8, -2.0], [0, 0, Math.PI / 2]); }
    pk.box(1.36, 0.25, 0.25, 0xc83a2a, [0, 0.5, 1.5]);
    this.plane = pk.mesh(FLAT); this.plane.position.set(40, 30, -60); g.add(this.plane);
    this.prop = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), new THREE.MeshBasicMaterial({ color: 0x3a3a3a, transparent: true, opacity: 0.25, side: THREE.DoubleSide })); this.prop.position.set(0, 0, -4.75); this.plane.add(this.prop);
    this.people.push(this.val2);
    this.addScene('jump', { group: g, bounds: 0.6, height: () => SKY_Y, place: { lat: 57.6, year: 1961, sunLon: 100 }, amb: 0.7, fogFar: 9000, mist: 0.04,
      sky: () => { this.G.sky.set(210, 48); },
      update: (dt, t) => {
        this.jumpT = (this.jumpT || 0) + dt * this.F;
        const T = this.jumpT;
        this.valChute.position.set(-2.0 + Math.sin(T * 0.2) * 0.6, SKY_Y - 4.5 - T * 0.7, -7.5 - T * 0.1); this.valChute.rotation.y = T * 0.05; this.valChute.rotation.z = Math.sin(T * 0.7) * 0.05;
        this.val2.look = this.G.camera.getWorldPosition(_b);
        this.others.forEach((c, i) => { c.position.y = SKY_Y - (i ? 90 : 50) - T * 1.0; c.rotation.y = T * 0.04 * (i ? -1 : 1); });
        this.plane.position.set(40 - T * 22, SKY_Y + 30 + T * 0.4, -60 - T * 30); this.plane.rotation.y = Math.atan2(-22, -30) + Math.PI; this.prop.rotation.z += dt * 40;
      } });
  }

  // ---------- 3. Vostok 6 ----------
  buildCabin() {
    const g = new THREE.Group();
    const C = this.C = cabin('vostok', { russian: true }); g.add(C.group);
    C.group.updateMatrixWorld(true);
    this.clock = panelLamp(0.12, 0.04, { text: '00:00', col: '#200800', mono: true }); C.overlay('timer', this.clock);
    // the little globe, turning
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load(new URL('../../data/earth.jpg', import.meta.url).href), roughness: 0.6 }));
    gl.material.map.colorSpace = THREE.SRGBColorSpace; const sp = C.spots.globe; if (sp) { gl.position.copy(sp).add(V(0, 0, 0.03)); C.panel.add(gl); } this.globe = gl;
    // a seagull drawn on a card taped by the window (her call sign)
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.07), new THREE.MeshLambertMaterial({ map: canvasTex(120, 84, (c, w, h) => { c.fillStyle = '#f4f0e4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a3a5a'; c.lineWidth = 4; c.beginPath(); c.moveTo(16, 50); c.quadraticCurveTo(38, 22, 60, 46); c.quadraticCurveTo(82, 22, 104, 50); c.stroke(); c.fillStyle = '#2a3a5a'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.fillText('ЧАЙКА', w / 2, 76); }) }));
    card.position.set(-0.3, 0.12, 0.02); C.panel.add(card);
    // the Earth under the porthole, the horizon a blue band across it
    const wd = C.dirOf('vzor');
    const SP = this.SP = earthSpace(this.G, { earthR: 400 });
    const ax = V(0, 1, 0).cross(wd).normalize(); if (ax.lengthSq() < 0.01) ax.set(1, 0, 0);
    SP.earth.position.copy(wd).applyAxisAngle(ax, -54 * D2R).multiplyScalar(460).add(V(0, 1.5, 0)); SP.earth.rotation.set(0.7, 1.2, 0.3);
    SP.sunDir.copy(wd).applyAxisAngle(ax, 30 * D2R).add(V(0.6, 0, 0)).normalize();
    this.addScene('cabin', { group: g, bounds: 0.25, space: SP, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); },
      update: (dt, t) => {
        SP.earth.rotation.y += dt * 0.012; SP.atmoU.sun.value.copy(SP.sunDir);
        this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = 1.4;
        this.globe.rotation.y += dt * 0.12;
        this.vClock = (this.vClock || 0) + dt * 30 * this.F; const mm = Math.floor(this.vClock / 60) % 100, ss = Math.floor(this.vClock % 60); this.clock.userData.set(`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, '#200800', true);
      } });
  }

  // ---------- 4. Korolev's office ----------
  buildOffice() {
    const R = room(7, 6, 3.2, { floor: surfMat('parquet'), wall: { n: surfMat('panelwood', '#6a4a2a'), s: surfMat('wallpaper', '#c8c0a0'), e: surfMat('wallpaper', '#c8c0a0'), w: surfMat('wallpaper', '#c8c0a0') }, ceil: surfMat('plaster', '#ece8dc'), windows: [{ side: 'e', at: 0.2, y: 0.9, w: 1.6, h: 1.8 }], skirt: 0x3a2a1a });
    const g = R.group, k = new Kit();
    desk(k, 0, -1.7, 0, { w: 1.9, d: 0.9 }); chair(k, 0, -2.35, 0, { seat: 0x3a2a1e }); table(k, 0, 0.3, 0, { w: 0.8, d: 2.0, cloth: 0x3a5a3a }); for (const sz of [-0.5, 0.5]) for (const sx of [-0.6, 0.6]) chair(k, sx, 0.3 + sz, sx > 0 ? -Math.PI / 2 : Math.PI / 2, { seat: 0x3a3a3a });
    shelf(k, -3.2, -1.2, Math.PI / 2, { w: 1.8, h: 2.1 }); shelf(k, -3.2, 1.2, Math.PI / 2, { w: 1.8, h: 2.1, seed: 5 });
    for (let i = 0; i < 3; i++) { k.box(0.24, 0.1, 0.2, [0x1a1a1a, 0xe8e4dc, 0x8a2a20][i], [-0.75 + i * 0.27, 0.81, -1.95]); k.box(0.2, 0.04, 0.05, 0x1a1a1a, [-0.75 + i * 0.27, 0.89, -1.95]); }   // the telephones
    k.box(0.4, 0.02, 0.3, 0xf0ece0, [0.4, 0.77, -1.6]);
    // the snowy view
    g.add(k.mesh(FLAT));
    const snow = quad(30, 12, new THREE.MeshBasicMaterial({ map: canvasTex(512, 200, (c, w, h) => { c.fillStyle = '#c8d0d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8ecf0'; c.fillRect(0, h * 0.55, w, h); const r = rng(3); for (let i = 0; i < 40; i++) { c.fillStyle = '#3a4a3a'; const x = r() * w, s = 10 + r() * 20; c.beginPath(); c.moveTo(x, h * 0.55 - s * 2.4); c.lineTo(x - s / 2, h * 0.58); c.lineTo(x + s / 2, h * 0.58); c.fill(); } }) }));
    snow.position.set(9, 2, 0.2); snow.rotation.y = -Math.PI / 2; g.add(snow);
    // little models of his rockets on the desk and the shelf
    const r7 = copy(M.r7_vostok, envMap('room'), 0.8); r7.scale.multiplyScalar(0.012); r7.position.set(0.75, 0.76, -1.85); g.add(r7);
    const vs = copy(M.vostok, envMap('room'), 0.8); vs.scale.multiplyScalar(0.06); vs.position.set(-3.1, 1.12, 1.4); vs.rotation.y = 1; g.add(vs);
    const vk = copy(M.voskhod2, envMap('room'), 0.8); vk.scale.multiplyScalar(0.06); vk.position.set(-0.75, 0.76, -1.65); vk.rotation.y = -0.6; g.add(vk); this.vkModel = vk;
    // Gagarin's photo, and a drawing of the Moon pinned up
    const ph = picture(0.5, 0.65, (c, w, h) => { c.fillStyle = '#8a8478'; c.fillRect(0, 0, w, h); c.fillStyle = '#d86a2a'; c.beginPath(); c.ellipse(w / 2, h * 0.9, w * 0.4, h * 0.3, 0, 0, 7); c.fill(); c.fillStyle = '#e8e4dc'; c.beginPath(); c.ellipse(w / 2, h * 0.45, w * 0.22, h * 0.2, 0, 0, 7); c.fill(); c.fillStyle = '#c8a888'; c.beginPath(); c.ellipse(w / 2, h * 0.47, w * 0.13, h * 0.13, 0, 0, 7); c.fill(); });
    ph.position.set(-0.9, 2.0, -2.98); g.add(ph);
    const mn = picture(0.8, 0.6, (c, w, h) => { c.fillStyle = '#f0ece0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a2a2a'; c.lineWidth = 2; c.beginPath(); c.arc(w / 2, h / 2, h * 0.38, 0, 7); c.stroke(); c.setLineDash([4, 3]); c.beginPath(); c.moveTo(10, h - 10); c.quadraticCurveTo(w * 0.3, h * 0.1, w / 2, h * 0.3); c.stroke(); }, { frame: 0x8a7a5a });
    mn.position.set(0.9, 2.0, -2.98); g.add(mn);
    this.korolev = person(g, 'korolev', V(-1.4, 0, -0.9), 0.6); this.korolev.look = V(0, 1.6, 2);
    this.people.push(this.korolev);
    this.addScene('office', { group: g, bounds: 1.0, indoors: true, place: { lat: 55.9, year: 1964, sunLon: 290 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(200, 10); this.dim(0.5, 0.8); this.lamp.position.set(0.2, 1.3, -1.6); this.lamp.intensity = 1.6; this.lamp.distance = 6; this.lamp2.position.set(0, 3, 0.5); this.lamp2.intensity = 0.8; this.lamp2.distance = 8; },
      update: (dt, t) => {
        const K = this.korolev, s = this.s;
        if (s.korolev === 1) { const to = V(1.9, 0, -0.6), d = _a.subVectors(to, K.g.position).setY(0), L = d.length(); if (L > 0.1) { K.pose = 'walk'; K.g.position.addScaledVector(d.normalize(), Math.min(L, 0.5 * dt)); K.g.rotation.y = Math.atan2(d.x, d.z); } else { s.korolev = 2; } }
        if (s.korolev === 2) { K.pose = 'idle'; K.g.rotation.y = damp(K.g.rotation.y, Math.PI / 2, 1.5, dt); K.look = V(9, 2, 0.2); }
        if (s.korolev === 3) { K.pose = 'talk'; K.g.rotation.y = damp(K.g.rotation.y, -2.4, 2, dt); K.look = this.G.camera.getWorldPosition(_b); }
      } });
  }

  // ---------- 5. The first spacewalk ----------
  buildWalk() {
    const g = new THREE.Group();
    const ship = this.ship = new THREE.Group(); ship.position.copy(SHIP); ship.rotation.set(0, -2.2, 0.25); g.add(ship);
    const v = copy(M.voskhod2, envMap('space'), 1.1); ship.add(v);
    // the airlock's open outer hatch (a lid swinging on its hinge)
    this.lid = new THREE.Group(); this.lid.position.copy(HATCH).add(V(0, 0.55, 0.02)); ship.add(this.lid);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0xb8b8b0, metalness: 0.4, roughness: 0.5 })); lid.rotation.x = Math.PI / 2; lid.position.y = -0.5; this.lid.add(lid);
    // Leonov: his helmet on, a tether back to the hatch
    this.leo = person(ship, 'leonov', HATCH.clone().add(V(0, -0.9, -0.6)), 0); this.leo.pose = 'idle';
    wear(this.leo, copy(M.helmet_berkut), { lift: -0.06, size: 1 }); this.people.push(this.leo);
    this.tether = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0, 1)]), 20, 0.02, 5), new THREE.MeshLambertMaterial({ color: 0xe8e0c0 })); ship.add(this.tether);
    // the valve (Adults turn it): a little knob on his suit, glowing to show you where
    this.valveSpot = glowSprite(0xffd080, 0.35, 0); ship.add(this.valveSpot);
    this.valveIt = this.touchable('valve', () => this.valveSpot.getWorldPosition(_a), { hint: 'Let some air out of his suit: reach out and turn the valve on his suit (TRIGGER)', deskHint: 'Click the glowing valve on Leonov\'s suit', r: 0.5 });
    const SP = this.SP2 = earthSpace(this.G, { earthR: 400 }); SP.earth.position.set(-60, -520, -220); SP.earth.rotation.set(0.3, 2.0, 0.1);
    SP.sunDir.set(0.7, 0.35, 0.5).normalize();
    this.sun2 = spaceSun(60); SP.group.add(this.sun2);
    this.addScene('walk', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => this.walkUpdate(dt, t) });
  }
  walkUpdate(dt, t) {
    const s = this.s, L = this.leo, SP = this.SP2;
    SP.earth.rotation.y += dt * 0.01; SP.atmoU.sun.value.copy(SP.sunDir);
    this.sun2.position.copy(SP.sunDir).multiplyScalar(2600).add(V(0, 1.6, 0));
    this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = 2.2;
    this.lid.rotation.x = damp(this.lid.rotation.x, s.out ? -1.9 : 0, 1.2, dt);
    // out he comes: up out of the tube, then drifting out on the tether, turning slowly
    this.outK = damp(this.outK || 0, s.out ? 1 : 0, 0.35 * this.F, dt);
    this.backK = damp(this.backK || 0, s.back ? 1 : 0, 0.4 * this.F, dt);
    const k = ease(this.outK) * (1 - ease(this.backK));
    this.ship.updateMatrixWorld(); const far = this.ship.worldToLocal(this.root.localToWorld(V(0.1 + Math.sin(t * 0.23) * 0.3, 0.9 + Math.sin(t * 0.3) * 0.25, -3.2)));
    const p = HATCH.clone().add(V(0, -0.9 + 1.4 * clamp01(k * 3), 0)).lerp(far, clamp01((k - 0.3) / 0.7));
    L.g.position.copy(p);
    L.g.rotation.set(Math.sin(t * 0.21) * 0.25 * k, 0.6 + t * 0.05 * k, Math.sin(t * 0.17) * 0.3 * k - (s.back ? 1.2 * this.backK : 0));
    L.pose = s.out && k > 0.5 ? (s.puff && !s.valve ? 'gasp' : 'wave') : 'idle';
    // the suit puffs up (a little bigger and rounder), and goes soft again after the valve
    this.puffK = damp(this.puffK || 0, s.puff && !s.valve ? 1 : 0, 0.6, dt);
    L.inner.scale.set(1 + this.puffK * 0.09, 1 + this.puffK * 0.03, 1 + this.puffK * 0.12);
    L.g.visible = !(s.back && this.backK > 0.97);
    // the tether: a slack curve from the hatch to his waist
    const w = L.g.position.clone().add(V(0, 1.0, 0)), h0 = HATCH.clone().add(V(0, 0.3, 0)), mid = h0.clone().lerp(w, 0.5).add(V(0.4, -0.6 - 0.3 * Math.sin(t * 0.4), 0.3));
    this.tether.geometry.dispose(); this.tether.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([h0, mid, w]), 20, 0.02, 5);
    // the valve's glow (Adults only, while he's puffed up)
    this.valveSpot.position.copy(L.g.position).add(V(0, 1.15, 0.25).applyEuler(L.g.rotation));
    this.valveSpot.material.opacity = damp(this.valveSpot.material.opacity, s.asking ? 0.8 + 0.2 * Math.sin(t * 5) : 0, 4, dt);
  }

  // ---------- 6. The snowy forest ----------
  buildForest() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(101);
    g.add(groundPlane({ size: 3000, seg: 120, h: (x, z) => (N(x / 40, z / 40) - 0.5) * 2 * clamp01((Math.hypot(x, z) - 8) / 30), color: (x, z, c) => { const m = N(x / 4, z / 4); c.setRGB(0.86 + m * 0.08, 0.88 + m * 0.08, 0.92 + m * 0.06); } }));
    const r = rng(41), spots = [];
    for (let i = 0; i < 220; i++) { const a = r() * 6.28, d = 7 + r() * 70; spots.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.7 + r() * 0.6, yaw: r() * 6 }); }
    g.add(grove('conifer', spots, { type: 'spruce', snow: true, detail: 'low', variants: 4, height: 13 }).group);
    // the capsule in the snow, its scorched skin, the parachute draped over the branches
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 18), new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#4a3a2e'; c.fillRect(0, 0, w, h); const rr = rng(2); for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${20 + rr() * 60},${15 + rr() * 40},${10 + rr() * 30},0.6)`; c.fillRect(rr() * w, rr() * h, 4, 2 + rr() * 8); } }), roughness: 0.9 }));
    cap.position.set(-3.6, 0.7, -6.4); g.add(cap);
    const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.4, 18), new THREE.MeshBasicMaterial({ color: 0x0a0806 })); hatch.position.set(-3.0, 0.9, -5.5); hatch.lookAt(V(0, 0.9, 0)); g.add(hatch);
    const chuteTex = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#f0e8d8' : '#e86a2a'; c.fillRect(i * w / 12, 0, w / 12 + 1, h); } });
    const drape = new THREE.Mesh(new THREE.PlaneGeometry(9, 6, 12, 8), new THREE.MeshLambertMaterial({ map: chuteTex, side: THREE.DoubleSide })); { const P = drape.geometry.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, Math.sin(P.getX(i) * 0.9) * 0.6 + Math.cos(P.getY(i) * 1.3) * 0.5); } drape.geometry.computeVertexNormals(); drape.position.set(-7, 4.5, -9); drape.rotation.set(-0.8, 0.5, 0.2); g.add(drape);
    // the fire: logs and flames, its light on the snow
    for (let i = 0; i < 5; i++) { const a = i * 1.26; k.cyl(0.07, 0.08, 1.1, 6, 0x3a2a1e, [FIRE.x + Math.cos(a) * 0.25, 0.15, FIRE.z + Math.sin(a) * 0.25], [Math.PI / 2 - 0.35, a, 0]); }
    k.cyl(0.18, 0.18, 1.6, 7, 0x4a3a2a, [FIRE.x - 1.1, 0.18, FIRE.z - 0.6], [0, 0.5, Math.PI / 2]);   // a log to sit on
    k.cyl(0.18, 0.18, 1.6, 7, 0x4a3a2a, [FIRE.x + 1.1, 0.18, FIRE.z - 0.5], [0, -0.4, Math.PI / 2]);
    g.add(k.mesh(FLAT));
    this.flames = glowPoints(40, { sizeScale: 80 }); g.add(this.flames);
    this.fireGlow = glowSprite(0xff9040, 3.5, 0.6); this.fireGlow.position.copy(FIRE).setY(0.7); g.add(this.fireGlow);
    // Leonov and Belyayev, sitting by the fire wrapped in the parachute's cloth
    this.leo2 = person(g, 'leonov', V(FIRE.x - 1.1, 0.0, FIRE.z - 0.75), 0.5); sit(this.leo2); this.leo2.look = FIRE.clone().setY(0.4);
    this.bel = person(g, 'belyayev', V(FIRE.x + 1.1, 0.0, FIRE.z - 0.7), -0.4); sit(this.bel); this.bel.look = FIRE.clone().setY(0.4);
    this.people.push(this.leo2, this.bel);
    // the wolves: a pair of eyes here and there between the trees, and one wolf you can just make out
    this.eyes = glowPoints(12, { sizeScale: 26 }); g.add(this.eyes);
    this.eyeSpots = [V(-14, 0.6, -18), V(-11, 0.6, -20), V(12, 0.55, -16), V(16, 0.6, -22), V(4, 0.6, -26), V(-20, 0.6, -10)];
    { const U = this.eyes.userData; this.eyeSpots.forEach((p, i) => { for (const s of [-1, 1]) { const j = i * 2 + (s > 0); U.pos.set([p.x + s * 0.08, p.y, p.z], j * 3); U.size[j] = 1.8; } }); U.commit(); }
    this.wolf = animal(g, 'wolf', V(9, 0, -14), -2.5, { scale: 1.0 }); this.wolf.mode = 'idle';
    this.people.push(this.wolf);
    this.addScene('forest', { group: g, bounds: 1.5, place: { lat: 59.6, year: 1965, sunLon: 358 }, amb: 0.25, fogFar: 260,
      sky: () => { this.G.sky.set(340, -30); this.G.sky.setMoon(120, 30, 1, 0.3); this.lamp.position.copy(FIRE).setY(1.0); this.lamp.color.setHex(0xff9a50); this.lamp.intensity = 2.6 + Math.sin(this.G.t * 13) * 0.3 + Math.sin(this.G.t * 7.3) * 0.2; this.lamp.distance = 14; },
      exit: () => { this.lamp.color.setHex(0xfff0dc); },
      update: (dt, t) => {
        const U = this.flames.userData;
        for (let i = 0; i < 40; i++) { const ph = (t * 1.3 + i * 0.137) % 1; U.pos.set([FIRE.x + Math.sin(i * 7.1 + t * 2) * 0.15 * (1 - ph), 0.15 + ph * 0.9, FIRE.z + Math.cos(i * 5.3 + t * 2) * 0.15 * (1 - ph)], i * 3); const k = (1 - ph); U.col.set([k, k * 0.5, k * 0.12], i * 3); U.size[i] = 1.6 * (1 - ph * 0.7); }
        U.commit();
        this.fireGlow.material.opacity = 0.5 + Math.sin(t * 11) * 0.06;
        const E = this.eyes.userData, on = this.s.wolves ? 1 : 0;
        this.eyeSpots.forEach((p, i) => { const blink = Math.sin(t * 0.7 + i * 2.1) > -0.85 ? 1 : 0, k = on * blink * (0.5 + 0.5 * Math.sin(t * 0.3 + i)); for (const s of [0, 1]) E.col.set([k * 0.9, k * 0.8, k * 0.3], (i * 2 + s) * 3); });
        E.commit();
        this.wolf.g.visible = !!this.s.wolves;
        if (this.s.wolves && Math.random() < dt * 0.08) howl(this.G, this.root.localToWorld(V((Math.random() - 0.5) * 60, 2, -30 - Math.random() * 20)), 0.08, 380 + Math.random() * 80);
      } });
  }

  // ---------- 7. Leonov's drawing ----------
  buildEasel() {
    const R = room(5, 5, 3, { floor: surfMat('boards', '#8a6a48'), wall: surfMat('wallpaper', '#d8d0b8'), ceil: surfMat('plaster', '#ece8dc'), windows: [{ side: 'w', at: 0, y: 0.9, w: 1.4, h: 1.6 }], skirt: 0x4a3a2a });
    const g = R.group, k = new Kit();
    for (const [x, z] of [[-0.35, 0.2], [0.35, 0.2], [0, -0.25]]) k.cyl(0.02, 0.025, 1.9, 5, 0x6a4a2a, [x, 0.9, z - 1.0], [z < 0 ? -0.2 : 0.1, 0, x * 0.3]);
    k.box(0.9, 0.04, 0.08, 0x6a4a2a, [0, 0.82, -0.75]);
    table(k, 1.4, -1.2, 0, { w: 0.9, d: 0.6 }); for (let i = 0; i < 12; i++) k.cyl(0.006, 0.006, 0.17, 5, [0xc83a2a, 0xe8a030, 0x3a6ac8, 0x2a8a4a, 0x1a1a1a, 0xe8d040][i % 6], [1.2 + (i % 6) * 0.06, 0.765, -1.25 + Math.floor(i / 6) * 0.1], [0, 0, Math.PI / 2]);
    chair(k, 0.6, -0.4, Math.PI * 0.85, {});
    g.add(k.mesh(FLAT));
    this.drawTex = canvasTex(1024, 768, (c, w, h) => drawSunrise(c, w, h, 0));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.72), new THREE.MeshLambertMaterial({ map: this.drawTex })); pic.position.set(0, 1.25, -0.82); pic.rotation.x = -0.12; g.add(pic);
    this.addScene('easel', { group: g, bounds: 0.8, indoors: true, place: { lat: 55.8, year: 1966, sunLon: 120 }, amb: 0.05, fogFar: 200,
      sky: () => { this.G.sky.set(260, 20); this.dim(0.9, 0.9); this.lamp.position.set(0, 2.6, 0); this.lamp.intensity = 1.2; this.lamp.distance = 7; },
      update: (dt, t) => {
        if (this.s.drawing) { this.drawK = Math.min(1, (this.drawK || 0) + dt * 0.12 * this.F); this.drawAcc = (this.drawAcc || 0) + dt; if (this.drawAcc > 0.15) { this.drawAcc = 0; drawSunrise(this.drawTex.image.getContext('2d'), 1024, 768, this.drawK); this.drawTex.needsUpdate = true; } }
      } });
  }

  beds() { return [
    { kind: 'room', vol: 0.12, on: (ch) => ch.cur === 'mill' },
    { kind: 'leaves', at: V(0, 600, 0), vol: 0.1, ref: 40, wide: true, on: (ch) => ch.cur === 'jump' },
    { kind: 'vent', at: V(0, 1.6, 0), vol: 0.06, ref: 3, on: (ch) => ch.cur === 'cabin' },
    { kind: 'room', vol: 0.07, on: (ch) => ch.cur === 'office' || ch.cur === 'easel' },
    { kind: 'fire', at: FIRE, vol: 0.2, ref: 3, on: (ch) => ch.cur === 'forest' },
    { kind: 'leaves', at: V(0, 4, -20), vol: 0.06, ref: 30, wide: true, on: (ch) => ch.cur === 'forest' },
  ]; }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. The mill, then the jump
    await this.go(D, 'mill', yawTo(282), 0.1, { x: 1.7, z: 2.6 });
    s.guide = [-1.6, 2.7, 4.2];
    const l1 = D.sayAsync('ch18_01');
    await D.cue('And on weekends');
    this.jumpT = 0;
    await this.go(D, 'jump', yawTo(330), 0.8, { x: 0, z: 0 });
    s.guide = [3, SKY_Y + 1.5, -6]; whoosh(G, 2, 0.15);
    await l1;
    await D.say('ch18_02');
    // 2. Vostok 6
    await this.go(D, 'cabin', 0, 1.0, { x: 0, z: 0 });
    s.guide = this.C.group.localToWorld(V(-1.0, 1.9, -1.4)).toArray(); this.vClock = 0;
    await D.say('ch18_03');
    staticBurst(G, 0.3, 0.12);
    await D.say('ch18_04');
    await D.say('ch18_05');
    await D.say('ch18_06');
    await D.say('ch18_07');
    // 3. Korolev's office
    await this.go(D, 'office', 0, 1.0, { x: 0.5, z: 1.8 });
    s.guide = [-2.0, 2.2, 0.4]; s.korolev = 1;
    await D.say('ch18_08');
    s.korolev = 3;
    await D.say('ch18_09');
    // 4. The spacewalk
    s.out = 0; s.puff = 0; s.valve = 0; s.back = 0; this.outK = 0; this.backK = 0;
    await this.go(D, 'walk', 0, 1.2, { x: 0, z: 0 });
    s.guide = [-3.5, 2.6, -4];
    await D.say('ch18_10');
    const l11 = D.sayAsync('ch18_11');   // the music begins here
    await D.cue('The outer hatch'); clank(G, this.root.localToWorld(SHIP.clone()), 0.15);
    await D.cue('pushes off'); s.out = 1;
    await l11;
    breath(G, 0.06, 3.6);
    heartbeat(G, 0.18);
    await D.say('ch18_12');
    await D.say('ch18_13');
    s.puff = 1;
    await D.say('ch18_14');
    breath(G, 0.08, 3.2);
    await D.say('ch18_15');
    if (!D.kids) {
      await D.say('ch18_16');
      s.asking = 1;
      await this.ask(D, 'valve', { hint: this.valveIt.hint, deskHint: this.valveIt.deskHint, after: 1, timeout: 18 });
      s.asking = 0;
    }
    s.valve = 1; hiss(G, this.root.localToWorld(this.leo.g.position.clone()), 0.2, 2.5);
    const l17 = D.sayAsync('ch18_17');
    await D.wait(fast ? 0.5 : 3); s.back = 1;
    await l17;
    // 5. The snowy forest
    await this.go(D, 'forest', 0, 1.2, { x: 0, z: 0 });
    s.guide = [3, 2.4, -2.5];
    await D.say('ch18_18');
    s.wolves = 1; howl(G, this.root.localToWorld(V(-20, 2, -30)), 0.1);
    await D.say('ch18_19');
    await D.wait(fast ? 0.3 : 3);
    // 6. The drawing
    await this.go(D, 'easel', 0, 1.0, { x: -0.3, z: 0.9 });
    s.guide = [-1.6, 2.0, -0.6]; s.drawing = 1;
    await D.say('ch18_20');
    await D.until(() => (this.drawK || 0) >= 1, fast ? 1 : 6);
    await D.wait(fast ? 0.3 : 2.5);
  }

  dispose() { this.SP?.dispose(); this.SP2?.dispose(); super.dispose(); }
}

// Leonov's drawing of the sunrise from orbit, in coloured pencil: it fills in as he draws (k 0..1)
function drawSunrise(c, w, h, k) {
  c.fillStyle = '#f4f0e4'; c.fillRect(0, 0, w, h);
  const r = rng(8);
  const strokes = (n, col, fn) => { c.strokeStyle = col; c.lineWidth = 3; c.globalAlpha = 0.5; for (let i = 0; i < n; i++) { const [x0, y0, x1, y1] = fn(r()); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); } c.globalAlpha = 1; };
  // the black sky (hatched), the curve of the Earth, the bands of the dawn, the Sun's star
  const cy = h * 1.55, R = h * 1.1;
  if (k > 0) strokes(Math.floor(900 * clamp01(k * 2.2)), '#1a1a2a', (u) => { const x = u * w, y = r() * h * 0.6; return [x, y, x + 30, y - 18]; });
  if (k > 0.25) { for (let b = 0; b < 5; b++) { const kk = clamp01((k - 0.25 - b * 0.06) * 4); if (kk <= 0) continue; c.strokeStyle = ['#c83a2a', '#e86a2a', '#e8b030', '#5ab0d8', '#2a6ac8'][b]; c.lineWidth = 16; c.globalAlpha = 0.6; c.beginPath(); c.arc(w / 2, cy, R + 40 - b * 14, Math.PI * 1.18, Math.PI * (1.18 + 0.64 * kk)); c.stroke(); c.globalAlpha = 1; } }
  if (k > 0.55) { c.globalAlpha = clamp01((k - 0.55) * 3); c.fillStyle = '#2a5a9a'; c.beginPath(); c.arc(w / 2, cy, R - 30, 0, 7); c.fill(); c.fillStyle = 'rgba(240,240,240,0.5)'; for (let i = 0; i < 18; i++) { c.beginPath(); c.ellipse(w * (0.1 + r() * 0.8), h * (0.72 + r() * 0.25), 50 + r() * 60, 10, 0, 0, 7); c.fill(); } c.globalAlpha = 1; }
  if (k > 0.75) { const a = clamp01((k - 0.75) * 4); c.globalAlpha = a; const sx = w * 0.62, sy = h * 0.47; c.fillStyle = '#fff8d0'; c.beginPath(); c.arc(sx, sy, 22, 0, 7); c.fill(); c.strokeStyle = '#e8c040'; c.lineWidth = 4; for (let i = 0; i < 12; i++) { const an = i / 12 * 6.28; c.beginPath(); c.moveTo(sx + Math.cos(an) * 30, sy + Math.sin(an) * 30); c.lineTo(sx + Math.cos(an) * (60 + (i % 2) * 40), sy + Math.sin(an) * (60 + (i % 2) * 40)); c.stroke(); } c.globalAlpha = 1; }
  if (k >= 1) { c.fillStyle = '#3a3a5a'; c.font = 'italic 28px Georgia, serif'; c.fillText('А. Леонов', w - 200, h - 30); }
}
