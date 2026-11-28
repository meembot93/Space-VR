// Era 3, Chapter 2 (n 16): "Let's go!" Yuri Gagarin, the first person in space, 12 April 1961.
//
// 1. Night at Baikonur: through the lit window of the little wooden cottage by the pad, Gagarin
//    and Titov asleep. Outside, under the stars, Korolev walks, too worried to sleep; far off, the
//    rocket stands in its floodlights.
// 2. Morning, the medical room: doctors fit the sensors, both men in their orange suits.
// 3. The top of the service tower: the bus far below, Gagarin turns and waves, and climbs into
//    Vostok.
// 4. Inside Vostok: the hatch light, the 32 bolts undone and done up again (clanks round you),
//    "how about some music?", the sealed envelope (Adults open it), "Cedar, this is Dawn", the
//    countdown, "Poyekhali!" The rocket shakes and roars round you (windows still covered).
// 5. Wow: the nose cover blows away and the Earth's curve fills the windows (music, to the end).
//    Siberia, the Pacific, night and city lights and stars, the first sunrise from space; the
//    little globe on the panel turning.
// 6. Outside: retrofire over Africa, the equipment section won't let go (Adults: it tumbles,
//    seen from a distance), then the ball glowing as it falls into the air.
// 7. A farm near Saratov: Gagarin floats down on his own parachute; Anna and Rita stare at the
//    orange figure: "I'm a friend, comrades, a friend!"
// 8. Red Square: the crowds. 9. Huntsville: von Braun hears the news. The journal page.
import * as THREE from 'three';
import { Kit, FLAT, segs } from '../kit.js';
import { Chapter3, D2R, yawTo, bearing, label, Journal } from '../era3/base.js';
import { person, makeFolk, animal, sit, wear, Crowd, rows } from '../era3/folk.js';
import { loadAll, copy, Rocket } from '../era3/craft.js';
import { cabin, panelLamp } from '../era3/cabin.js';
import { Puffs, envMap, roar, cabinRumble, clank, bang, hiss, staticBurst, breath } from '../era3/fx.js';
import { earthSpace, groundPlane, spaceSun } from '../era3/worlds.js';
import { room, surfMat, quad, desk, chair, table, shelf, rug, picture, wall, floodTower, lattice, bus, bed, shadeHex, rot } from '../era3/sets.js';
import { vbOffice } from '../era3/places.js';
import { glowSprite, glowPoints, shimmer, whoosh, awe, rumble } from '../wow/fx.js';
import { loadProps } from '../props.js';
import { holdProp } from '../people.js';
import { INK } from '../era2/common.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { grove } from '../trees.js';

const M = await loadAll(['craft/r7_vostok', 'craft/vostok', 'props/helmet_sk1']);
const PROPS = await loadProps(['house_log', 'tiled_stove']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const ROCKET_FAR = V(520, 0, -900);   // the rocket from the cottage
const DECK = 31.2;                    // the top platform of the service tower, by Vostok's hatch
const LAND = V(10, 0, -34);           // where Gagarin comes down in the farm field

export default class Gagarin extends Chapter3 {
  constructor(G) {
    super(G, 16);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { korolev: 0, wave: 0, fairing: 0, orbitT: 0, bolts: 0, envelope: 0, chute: 0, walk: 0, tumble: 0, glow: 0 });
    this.buildNight(); this.buildPrep(); this.buildTower(); this.buildCabin(); this.buildOutside(); this.buildFarm(); this.buildSquare();
    vbOffice(this, 'office', { year: 1961, sunLon: 22, boardLine: 'Mercury-Redstone: 23 days' });
    this.journal = new Journal(this, drawJournal);
    // the radio voices
    Object.assign(G.narration.radio, { ch16_07: 'ussr', ch16_09: 'ussr', ch16_10: 'ussr', ch16_14: 'ussr' });
  }

  // ---------- 1. The cottage at night ----------
  buildNight() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(5);
    g.add(groundPlane({ size: 5000, seg: 120, h: (x, z) => (N(x / 300, z / 300) - 0.5) * 8 * clamp01((Math.hypot(x, z) - 60) / 300), color: (x, z, c) => { const m = N(x / 20, z / 20); c.setRGB(0.42 + m * 0.1, 0.4 + m * 0.08, 0.3); } }));
    // the cottage: a one-storey wooden house, a porch, a lit window on this side
    const cx = 0, cz = -7, W = 7, Dp = 5, H = 2.8;
    const planks = surfMat('boards', '#7a5a3a');
    const R = room(W, Dp, H, { floor: surfMat('boards'), wall: planks, ceil: surfMat('plaster', '#d8d0c0'), windows: [{ side: 's', at: 1.0, y: 0.9, w: 1.1, h: 1.1 }], doors: [{ side: 's', at: -2.2, w: 0.9, h: 2.0 }], skirt: 0x3a2a1a, frame: 0xe8e0c8, outside: surfMat('boards', '#6a4a2e') });
    R.group.position.set(cx, 0, cz); g.add(R.group);
    // the roof (a gable) and the outside walls' planks
    const roofG = new THREE.ConeGeometry(Math.hypot(W, Dp) / 2 + 0.6, 1.6, 4, 1); roofG.rotateY(Math.PI / 4); roofG.scale(W / Math.hypot(W, Dp) * 1.15, 1, Dp / Math.hypot(W, Dp) * 1.3);
    const roof = new THREE.Mesh(roofG, new THREE.MeshLambertMaterial({ color: 0x5a4a3e })); roof.position.set(cx, H + 0.8, cz); g.add(roof);
    // inside: two iron beds, a table, a chair, a lamp
    bed(k, cx - 1.9, cz + 0.7, Math.PI / 2, { blanket: 0x5a6a4a }); bed(k, cx - 1.9, cz - 1.2, Math.PI / 2, { blanket: 0x5a6a4a });
    table(k, cx + 1.6, cz - 1.4, 0, { w: 0.9, d: 0.6 }); chair(k, cx + 1.6, cz - 0.8, Math.PI, {});
    k.box(0.4, 0.5, 0.4, 0x5a3a22, [cx - 2.9, 0.25, cz - 0.25]);   // a bedside table between them
    // the porch: steps and a little roof on posts
    k.box(2.0, 0.2, 1.4, 0x6a4a2a, [cx + 2.2, 0.1, cz + Dp / 2 + 0.7]); for (const sx of [-1, 1]) k.box(0.1, 2.4, 0.1, 0x5a3a22, [cx + 2.2 + sx * 0.9, 1.2, cz + Dp / 2 + 1.3]);
    k.box(2.2, 0.08, 1.6, 0x4a3a2e, [cx + 2.2, 2.4, cz + Dp / 2 + 0.75], [-0.2, 0, 0]);
    k.box(1.4, 0.06, 0.4, 0x6a4a2a, [cx - 2.5, 0.45, cz + Dp / 2 + 0.5]); for (const sx of [-0.6, 0.6]) k.box(0.06, 0.45, 0.3, 0x4a3a2a, [cx - 2.5 + sx, 0.22, cz + Dp / 2 + 0.5]);   // a bench
    // a path of boards toward the pad, a lamp post
    for (let i = 0; i < 14; i++) k.box(1.0, 0.04, 0.4, 0x6a5a42, [cx + 2.2 + i * 0.9, 0.02, cz + Dp / 2 + 2.0 + i * 0.4], [0, -0.42, 0]);
    k.cyl(0.05, 0.06, 3.6, 6, 0x3a3a3a, [6, 1.8, -1]); k.box(0.4, 0.2, 0.3, 0x2a2a2a, [6, 3.6, -1]);
    // far off: the rocket's floodlights
    for (const [x, z] of [[-60, 40], [60, 40], [0, -70]]) floodTower(k, ROCKET_FAR.x + x, ROCKET_FAR.z + z, Math.atan2(-x, -z), 24);
    lattice(k, ROCKET_FAR.x + 9, ROCKET_FAR.z, 5, 5, 34, { step: 3.4 });
    g.add(k.mesh(FLAT));
    this.lampGlow = glowSprite(0xffd8a0, 1.4, 0.8); this.lampGlow.position.set(6, 3.5, -1); g.add(this.lampGlow);
    this.winGlow = glowSprite(0xffc890, 2.2, 0.35); this.winGlow.position.set(cx - 1.0, 1.45, cz + Dp / 2 + 0.3); g.add(this.winGlow);
    // the rocket, far off in its lights
    this.rocketFar = copy(M.r7_vostok, envMap('night'), 0.8); this.rocketFar.position.copy(ROCKET_FAR).setY(1.3); g.add(this.rocketFar);
    for (const [x, z] of [[-60, 40], [60, 40], [0, -70]]) { const s = glowSprite(0xfff4d8, 14, 0.9); s.position.set(ROCKET_FAR.x + x, 25, ROCKET_FAR.z + z); g.add(s); }
    // Gagarin and Titov asleep (lying on their backs under the blankets)
    const sleeper = (model, z) => { const piv = new THREE.Group(); piv.position.set(cx - 0.95, 0.6, z); piv.rotation.y = Math.PI / 2; g.add(piv); const P = person(piv, model, V(0, 0, 0), 0); P.g.rotation.x = -Math.PI / 2; const bl = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.14, 1.3), new THREE.MeshLambertMaterial({ color: 0x5a6a4a })); bl.position.set(cx - 1.55, 0.72, z); g.add(bl); return P; };
    this.yuri0 = sleeper('gagarin', cz + 0.7); this.gherman0 = sleeper('titov', cz - 1.2);
    this.korolev = person(g, 'korolev', V(9, 0, 3), -Math.PI / 2);
    this.people.push(this.yuri0, this.gherman0, this.korolev);
    this.addScene('night', { group: g, bounds: 2.5, place: { lat: 45.9, year: 1961, sunLon: 22 }, amb: 0.35, fogFar: 3500,
      sky: () => { this.G.sky.set(330, -32); this.G.sky.setMoon(250, 22, 1, 0.12); this.lamp2.position.set(cx - 0.6, 2.2, cz + 0.4); this.lamp2.intensity = 1.6; this.lamp2.distance = 7; this.lamp.position.set(6, 3.3, -1); this.lamp.intensity = 1.0; this.lamp.distance = 10; },
      update: (dt, t) => {
        const K = this.korolev, s = this.s;
        if (s.korolev === 1) { const to = V(1.6, 0, 1.2), d = _a.subVectors(to, K.g.position).setY(0), L = d.length(); if (L > 0.1) { K.pose = 'walk'; K.g.position.addScaledVector(d.normalize(), Math.min(L, 0.7 * dt)); K.g.rotation.y = Math.atan2(d.x, d.z); } else { s.korolev = 2; K.pose = 'idle'; } }
        if (s.korolev >= 2) { K.g.rotation.y = damp(K.g.rotation.y, Math.atan2(ROCKET_FAR.x - K.g.position.x, ROCKET_FAR.z - K.g.position.z), 1.5, dt); K.look = ROCKET_FAR.clone().setY(30); }
        if (s.korolev === 3) K.pose = 'talk';
      } });
  }

  // ---------- 2. The medical room, morning ----------
  buildPrep() {
    const R = room(6, 5, 3, { floor: surfMat('lino', '#9a9a90'), wall: surfMat('tiles', '#e8ece8'), ceil: surfMat('plaster', '#f0f0ec'), windows: [{ side: 'e', at: -0.6, y: 1.0, w: 1.4, h: 1.4 }], skirt: 0x6a6a6a, frame: 0xf0f0f0 });
    const g = R.group, k = new Kit();
    chair(k, -0.7, -1.4, 0, { seat: 0x3a3a3a, col: 0xc8c8c8 }); chair(k, 1.3, -1.6, -0.4, { seat: 0x3a3a3a, col: 0xc8c8c8 });
    table(k, -1.9, -1.7, 0, { w: 1.2, d: 0.6, col: 0xd8d8d0 });
    // the instruments: a cabinet with dials, the heart trace on a little screen, cables to the chair
    k.box(0.7, 1.4, 0.45, 0xc8ccc8, [-2.4, 0.7, -2.1]); for (let i = 0; i < 6; i++) k.cyl(0.05, 0.05, 0.02, 10, 0x2a2a2a, [-2.6 + (i % 3) * 0.2, 1.1 + Math.floor(i / 3) * 0.18, -1.87], [Math.PI / 2, 0, 0]);
    k.tube([[-2.2, 0.9, -1.9], [-1.6, 0.3, -1.6], [-0.9, 0.7, -1.4]], 0.01, 0x2a2a2a);
    k.box(0.4, 1.9, 0.35, 0xe8e8e4, [2.6, 0.95, -2.2]);   // a locker
    k.box(1.6, 0.04, 0.5, 0xd8d8d0, [2.4, 0.9, 1.6]);     // a bench along the wall with the white helmets
    g.add(k.mesh(FLAT));
    this.heart = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshBasicMaterial({ toneMapped: false })); this.heart.position.set(-2.4, 1.45, -1.87); g.add(this.heart);
    this.hc = document.createElement('canvas'); this.hc.width = 128; this.hc.height = 64; this.heart.material.map = new THREE.CanvasTexture(this.hc);
    for (const [x, z] of [[1.9, 1.6], [2.8, 1.6]]) { const h = copy(M.helmet_sk1); h.scale.setScalar(0.33 / Math.max(M.helmet_sk1?.size.y || 0.33, 0.01)); h.position.set(x, 0.92, z); h.rotation.y = Math.PI; g.add(h); }
    this.yuri1 = person(g, 'gagarin', V(-0.7, 0, -1.4), 0); sit(this.yuri1);
    this.gherman1 = person(g, 'titov', V(1.3, 0, -1.6), -0.4); sit(this.gherman1);
    this.doc1 = makeFolk({ kind: 'labcoat', seed: 201, coat: 0xf0f0ea, hat: 'none', glasses: true, height: 1.72 }); this.doc1.g.position.set(-1.3, 0, -0.85); this.doc1.g.rotation.y = 2.3; this.doc1.pose = 'work'; g.add(this.doc1.g);
    this.doc2 = makeFolk({ kind: 'labcoat', seed: 202, girl: true, coat: 0xf0f0ea, hair: 0x5a3a22, height: 1.64 }); this.doc2.g.position.set(1.9, 0, -0.9); this.doc2.g.rotation.y = -2.6; this.doc2.pose = 'write'; g.add(this.doc2.g);
    { const cb = new Kit(); cb.box(0.23, 0.32, 0.015, 0x8a6a42, [0, 0, 0]); cb.box(0.2, 0.27, 0.004, 0xf4f0e4, [0, -0.01, 0.01]); cb.box(0.06, 0.03, 0.02, 0xa8a8a8, [0, 0.15, 0.01]); const o = cb.mesh(FLAT); const w = new THREE.Group(); o.rotation.x = -1.2; w.add(o); holdProp(this.doc2, w, 'Left'); }
    this.people.push(this.yuri1, this.gherman1, this.doc1, this.doc2);
    this.addScene('prep', { group: g, bounds: 1.2, indoors: true, place: { lat: 45.9, year: 1961, sunLon: 22 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(95, 14); this.G.sky.sunLight.intensity *= 0.4; this.lamp.position.set(0, 2.8, -0.5); this.lamp.intensity = 2.0; this.lamp.distance = 9; },
      update: (dt, t) => {
        this.doc1.look = V(-0.7, 1.15, -1.4); this.yuri1.look = V(0, 1.5, 1); this.gherman1.look = V(-0.7, 1.2, -1.4); this.doc2.look = V(1.3, 1.2, -1.6);
        const c = this.hc.getContext('2d'); c.fillStyle = '#081208'; c.fillRect(0, 0, 128, 64); c.strokeStyle = '#60ff80'; c.lineWidth = 2; c.beginPath();
        for (let x = 0; x < 128; x++) { const ph = (x / 128 * 3 + t * 1.2) % 1, y = 32 - (ph > 0.3 && ph < 0.34 ? 22 : ph > 0.34 && ph < 0.37 ? -10 : Math.sin(ph * 20) * 2); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); this.heart.material.map.needsUpdate = true;
      } });
  }

  // ---------- 3. The top of the service tower ----------
  buildTower() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(7);
    g.add(groundPlane({ size: 5000, seg: 120, h: (x, z) => (N(x / 300, z / 300) - 0.5) * 8 * clamp01((Math.hypot(x, z) - 150) / 400), color: (x, z, c) => { const m = N(x / 30, z / 30); c.setRGB(0.6 + m * 0.1, 0.55 + m * 0.08, 0.4); } }));
    k.box(70, 0.5, 70, 0xa09c92, [0, 0.25, 0]);
    // the rocket stands at the middle; the tower beside it with its platforms, and a walkway to the hatch
    lattice(k, 7, 0, 5, 5, DECK + 3, { step: 3.12, floors: true });
    k.box(6.2, 0.12, 3.2, 0x5a5a58, [4.0, DECK, 0]);                  // the walkway to the hatch
    for (const sz of [-1.55, 1.55]) { k.box(6.2, 0.05, 0.05, 0xc8c8c0, [4.0, DECK + 1.05, sz]); for (let i = 0; i < 6; i++) k.box(0.05, 1.05, 0.05, 0xc8c8c0, [1.4 + i * 1.1, DECK + 0.52, sz]); }
    k.box(1.6, 2.4, 1.6, 0x6a6e70, [7, DECK + 1.2, 0]);               // the lift cage
    // the bus at the bottom, people waving
    bus(k, 12, 22, -0.4, { col: 0x3a6a9a });
    g.add(k.mesh(FLAT));
    this.rocket = copy(M.r7_vostok, envMap('day'), 0.9); this.rocket.position.y = 1.8; g.add(this.rocket);
    // the hatch, opened in the nose cover beside the walkway
    const hatch = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.9), new THREE.MeshBasicMaterial({ color: 0x101010 })); hatch.position.set(1.33, DECK + 1.0, 0); hatch.rotation.y = Math.PI / 2; g.add(hatch);
    this.crowd = new Crowd(rows({ x0: 4, x1: 16, z0: 14, rows: 3, yaw: Math.PI, seed: 3 }), { seed: 9, who: ['soviet_citizen', 'soviet_worker', 'soviet_babushka', 'soviet_officer', 'soviet_citizen', 'woman_older'] }); g.add(this.crowd.group); this.crowd.look = V(2, DECK, 0);
    this.yuri2 = person(g, 'gagarin', V(7.2, DECK, 0.3), -Math.PI / 2);
    this.tech = makeFolk({ kind: 'coverall', hat: 'cap', coat: 0x3a4a5a, seed: 210 }); this.tech.g.position.set(2.2, DECK, -1.0); this.tech.g.rotation.y = 0.4; g.add(this.tech.g);
    this.people.push(this.yuri2, this.tech);
    this.addScene('tower', { group: g, bounds: 1.2, height: () => DECK, place: { lat: 45.9, year: 1961, sunLon: 22 }, amb: 0.7, fogFar: 5000, mist: 0.02,
      sky: () => { this.G.sky.set(110, 18); },
      update: (dt, t) => {
        const s = this.s, Y = this.yuri2;
        this.crowd.update(t, dt, s.wave >= 2 ? 'wave' : 'idle');
        if (s.wave === 1) { const d = _a.set(2.0 - Y.g.position.x, 0, 0.2 - Y.g.position.z), L = d.length(); if (L > 0.1) { Y.pose = 'walk'; Y.g.position.addScaledVector(d.normalize(), Math.min(L, 1.0 * dt)); Y.g.rotation.y = Math.atan2(d.x, d.z); } else { s.wave = 2; } }
        if (s.wave === 2) { Y.pose = 'wave'; Y.g.rotation.y = damp(Y.g.rotation.y, 0.6, 3, dt); Y.look = V(12, 0, 22); }
        if (s.wave === 3) { Y.pose = 'walk'; Y.g.rotation.y = -Math.PI / 2; Y.g.position.x = Math.max(1.3, Y.g.position.x - dt * 0.6); if (Y.g.position.x <= 1.35) Y.g.visible = false; }
        this.tech.look = Y.g.getWorldPosition(_b).setY(DECK + 1.6);
      } });
  }

  // ---------- 4-5. Inside Vostok ----------
  buildCabin() {
    const g = new THREE.Group();
    const C = this.C = cabin('vostok', { russian: true }); g.add(C.group);
    // the nose cover round the ship: the windows see only its dark inside until it blows away
    this.fairing = new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 16), new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.8, side: THREE.BackSide })); this.fairing.position.y = 1.5; g.add(this.fairing);
    // the little globe on the panel (it turns as he goes round)
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load(new URL('../../data/earth.jpg', import.meta.url).href), roughness: 0.6 }));
    const sp = C.spots.globe; if (sp) { gl.position.copy(sp).add(V(0, 0, 0.03)); C.panel.add(gl); } this.globe = gl;
    gl.material.map.colorSpace = THREE.SRGBColorSpace;
    this.timer = panelLamp(0.12, 0.04, { text: '00:00', col: '#200800', mono: true }); C.overlay('timer', this.timer);
    // the sealed envelope with the code, taped to the panel
    const env = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.006), new THREE.MeshLambertMaterial({ map: canvasTex(128, 80, (c, w, h) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a6a3a'; c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, h * 0.55); c.lineTo(w, 0); c.stroke(); c.fillStyle = '#a02020'; c.beginPath(); c.arc(w / 2, h * 0.55, 9, 0, 7); c.fill(); }) }));
    env.position.set(0.24, 0.12, 0.02); C.panel.add(env); this.envelope = env;
    this.code = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.07), new THREE.MeshBasicMaterial({ map: canvasTex(128, 72, (c, w, h) => { c.fillStyle = '#f4f0e4'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2a2a'; c.font = 'bold 30px monospace'; c.textAlign = 'center'; c.fillText('1 2 5', w / 2, 46); }), transparent: true, opacity: 0 }));
    this.code.position.set(0.24, 0.22, 0.03); C.panel.add(this.code);
    this.envIt = this.touchable('envelope', () => env.getWorldPosition(_a), { hint: 'Open the sealed envelope on the panel (TRIGGER)', deskHint: 'Click the envelope to open it', r: 0.12 });
    this.SP = earthSpace(this.G, { earthR: 400 }); this.SP.earth.position.set(-260, -260, -330); this.SP.earth.rotation.set(0.9, 0, 0.3);
    this.SP.sunDir.set(-0.3, 0.5, 0.8).normalize();
    this.addScene('cabin', { group: g, bounds: 0.25, space: null, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); },
      exit: () => { this.SP.exit(); },
      sky: () => { if (!this.s.fairing) { this.G.sky.set(110, 25); this.G.sky.sunLight.intensity = 0; this.G.sky.hemi.intensity = 0.1; } },
      update: (dt, t) => this.cabinUpdate(dt, t) });
  }
  cabinUpdate(dt, t) {
    const s = this.s, C = this.C, SP = this.SP;
    // the nose cover goes: space all round
    if (s.fairing && this.fairing.visible) { this.fairing.visible = false; SP.enter(null); }
    if (!s.fairing && SP.on) SP.exit();
    if (SP.on) {
      s.orbitT += dt * this.F;
      SP.update(dt);
      SP.earth.rotation.y += dt * 0.012 * (s.fast ? 6 : 1);
      // day turns to night and back: the Sun swings round behind the Earth
      const a = s.dayPhase ?? 0; SP.sunDir.set(Math.sin(a) * 0.6, 0.35 * Math.cos(a), Math.cos(a)).normalize();
      SP.atmoU.sun.value.copy(SP.sunDir);
      this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = 1.8 * clamp01(Math.cos(a) + 0.3);
    }
    this.globe.rotation.y += dt * (SP.on ? 0.12 : 0) * this.F;
    // the panel's clock counts the minutes from launch
    const mins = Math.floor((this.launchClock || 0) / 60), secs = Math.floor((this.launchClock || 0) % 60);
    if (this.launchClock != null) { this.launchClock += dt * (SP.on ? 40 : 1) * this.F; this.timer.userData.set(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, '#200800', true); }
    // the envelope opens
    if (s.envelope === 2) { this.codeK = Math.min(1, (this.codeK || 0) + dt); this.code.material.opacity = this.codeK; this.envelope.rotation.x = -this.codeK * 0.6; }
    // launch: the cabin shakes, the lights flicker
    C.lights(true, s.shaking ? 0.8 + 0.2 * Math.sin(t * 31) : 1);
  }

  // ---------- 6. Outside: retrofire, the tumble, the fall into the air ----------
  buildOutside() {
    const g = new THREE.Group();
    const SP = this.SP2 = earthSpace(this.G, { earthR: 400 }); SP.earth.position.set(0, -430, -200); SP.earth.rotation.set(0.4, 3.6, 0);
    SP.sunDir.set(-0.5, 0.4, 0.6).normalize();
    this.ship = new THREE.Group(); this.ship.position.set(0, 1.2, -14); g.add(this.ship);
    const v = copy(M.vostok, envMap('space'), 1.1); v.position.y = -2.7; this.ship.add(v); this.vostokOut = v;
    this.retro = glowSprite(0xffb060, 3, 0); this.retro.position.set(0, -3.2, 0); this.ship.add(this.retro);
    this.heat = glowSprite(0xff7a30, 7, 0); this.heat.position.set(0, 0.4, 0); this.ship.add(this.heat);
    this.puffs = new Puffs(400, { floor: null }); g.add(this.puffs.mesh);
    this.addScene('outside', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s;
        this.key.position.set(-40, 30, 40); this.key.intensity = 2.4;
        this.retro.material.opacity = s.retro ? 0.8 + 0.2 * Math.sin(t * 30) : 0;
        if (s.tumble) { this.ship.rotation.x += dt * 0.35; this.ship.rotation.z += dt * 0.22; }
        else { this.ship.rotation.x = damp(this.ship.rotation.x, 0, 1, dt); this.ship.rotation.z = damp(this.ship.rotation.z, 0, 1, dt); }
        this.heat.material.opacity = damp(this.heat.material.opacity, s.glow ? 0.95 : 0, 1.2, dt);
        if (s.glow) { this.ship.position.y -= dt * 0.8; for (let i = 0; i < 3; i++) this.puffs.emit(this.ship.position.x + (Math.random() - 0.5), this.ship.position.y + 1.2, this.ship.position.z + (Math.random() - 0.5), (Math.random() - 0.5), 1.8 + Math.random(), (Math.random() - 0.5), 0.8, 3, 2, 0xff8a40, 0.7, 0.2, 1.5); }
        this.puffs.update(this.G, dt, [0, 0], 0);
      } });
  }

  // ---------- 7. The farm near Saratov ----------
  buildFarm() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(31), N2 = noise2(32);
    // ploughed spring fields in stripes, last snow in the hollows, green coming through
    g.add(groundPlane({ size: 5000, seg: 150, h: (x, z) => (N(x / 400, z / 400) - 0.5) * 24 * clamp01((Math.hypot(x, z) - 100) / 500), color: (x, z, c) => { const row = Math.sin((x * 0.8 + z * 0.3) * 1.6) * 0.5 + 0.5, m = N2(x / 15, z / 15); if (x + z * 0.4 > 30) c.setRGB(0.36 + m * 0.1, 0.42 + m * 0.12, 0.24); else c.setRGB(0.32 + row * 0.08 + m * 0.05, 0.25 + row * 0.05, 0.18); if (N(x / 9, z / 9) > 0.72) c.lerp(new THREE.Color(0xe8ecf0), 0.8); } }));
    // a village beyond: log houses and a few birches
    if (PROPS.has('house_log')) { const P = PROPS.fresh(); const r = rng(4); for (let i = 0; i < 7; i++) P.add('house_log', -140 + i * 26 + r() * 8, 0, -230 - r() * 30, r() * 0.4 - 0.2, { h: 6 }); g.add(P.build()); }
    const r = rng(6);
    g.add(grove('bareTree', Array.from({ length: 16 }, () => ({ x: -200 + r() * 400, z: -200 - r() * 80, s: 0.8 + r() * 0.5 })), { seed: 2 }).group);
    // a fence and a cart track
    for (let i = 0; i < 30; i++) k.box(0.08, 1.1, 0.08, 0x5a4a3a, [-30 + i * 2.2, 0.55, -12]);
    for (const y of [0.5, 0.95]) k.box(66, 0.05, 0.05, 0x6a5a42, [3, y, -12]);
    g.add(k.mesh(FLAT));
    // Anna and Rita, and their calf
    this.anna = person(g, 'takhtarova', V(-1.3, 0, -4.2), 0.5);
    this.rita = person(g, 'takhtarova_rita', V(-0.4, 0, -3.8), 0.4);
    this.calf = animal(g, 'animal_cow', V(-3.2, 0, -5.0), 1.2, { scale: 0.6 });
    // Gagarin under his own parachute, coming down
    this.yuri3 = person(g, 'gagarin', LAND.clone().setY(260), -2.6);
    this.helmet = wear(this.yuri3, copy(M.helmet_sk1), { lift: -0.05, size: 1 });
    const chute = new THREE.Group(); g.add(chute); this.pchute = chute;
    const tex = canvasTex(256, 32, (c, w, h) => { for (let i = 0; i < 12; i++) { c.fillStyle = i % 2 ? '#f0e8d8' : '#e86a2a'; c.fillRect(i * w / 12, 0, w / 12 + 1, h); } });
    const can = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); can.scale.y = 0.55; can.position.y = 9; chute.add(can);
    const lk = new Kit(); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; lk.tube([[Math.cos(a) * 3.8, 9 + 4 * Math.cos(Math.PI * 0.4) * 0.55, Math.sin(a) * 3.8], [0, 1.7, 0]], 0.015, 0xd8d0c0, 3); }
    chute.add(lk.mesh(FLAT));
    this.people.push(this.anna, this.rita, this.calf, this.yuri3);
    this.addScene('farm', { group: g, bounds: 2.5, place: { lat: 51.3, year: 1961, sunLon: 22 }, amb: 0.5, fogFar: 3000, mist: 0.04,
      sky: () => { this.G.sky.set(165, 38); },
      update: (dt, t) => {
        const s = this.s, Y = this.yuri3;
        if (s.chute === 1) {
          this.farmT = (this.farmT || 0) + dt * this.F; const k = clamp01(this.farmT / 26);
          Y.g.position.y = lerp(260, 0, ease(Math.min(1, k * 1.05))); Y.pose = 'hold'; Y.g.rotation.z = Math.sin(t * 0.8) * 0.06 * (1 - k);
          if (k >= 1) { s.chute = 2; this.G.audio.boom?.(this.root.localToWorld(LAND.clone())); }
        }
        chute.visible = s.chute >= 1; chute.position.copy(s.chute >= 2 ? LAND : Y.g.position);   // once down, the chute stays where it fell
        if (s.chute >= 2) { this.sagF = damp(this.sagF || 0, 1, 0.8, dt); chute.rotation.z = this.sagF * 1.35; chute.position.x += this.sagF * 4.5; chute.position.y -= this.sagF * 2.5; chute.scale.y = 1 - this.sagF * 0.5; }
        if (s.walk === 1) { const to = V(0.6, 0, -6.4), d = _a.subVectors(to, Y.g.position).setY(0), L = d.length(); if (L > 0.15) { Y.pose = 'walk'; Y.g.position.addScaledVector(d.normalize(), Math.min(L, 1.2 * dt)); Y.g.rotation.y = Math.atan2(d.x, d.z); } else { s.walk = 2; } }
        if (s.walk === 2) { Y.pose = s.friend ? 'wave' : 'idle'; Y.look = V(-0.9, 1.3, -4); Y.g.rotation.y = damp(Y.g.rotation.y, Math.atan2(-1.6, 2.4), 3, dt); }
        this.anna.look = Y.g.getWorldPosition(_b).setY(Y.g.position.y + 1.6); this.rita.look = this.anna.look;
        this.anna.pose = s.walk === 2 && !s.friend ? 'gasp' : 'idle'; this.rita.pose = s.friend ? 'wave' : 'idle';
        this.calf.mode = 'eat';
      } });
  }

  // ---------- 8. Red Square ----------
  buildSquare() {
    const g = new THREE.Group(), k = new Kit();
    const cob = quad(220, 160, surfMat('concrete', '#7a7670'), 1.2); cob.rotation.x = -Math.PI / 2; g.add(cob);
    // the Kremlin wall on the west side, swallowtail battlements, the Spasskaya tower
    const wallM = surfMat('brick', '#8a2a20');
    const kw = new THREE.Mesh(new THREE.BoxGeometry(4, 16, 200), wallM); kw.position.set(-34, 8, -20); g.add(kw);
    for (let i = 0; i < 70; i++) { const z = -118 + i * 2.85; k.box(3.6, 1.6, 1.4, 0x8a2a20, [-34, 16.8, z]); k.box(3.6, 0.6, 0.6, 0x8a2a20, [-34, 17.9, z - 0.4], [0, 0, 0]); }
    const tx = -32, tz = -70;
    k.box(14, 30, 14, 0x9a3024, [tx, 15, tz]); k.box(11, 12, 11, 0x9a3024, [tx, 36, tz]); k.box(11.4, 1, 11.4, 0xe8e4d8, [tx, 30.5, tz]);
    for (const [dx, dz, ry] of [[0, 5.6, 0], [5.6, 0, Math.PI / 2]]) k.cyl(2.6, 2.6, 0.3, 24, 0xe8e0c8, [tx + dx, 37, tz + dz], [Math.PI / 2, ry, 0]);   // clock faces
    k.add(new THREE.ConeGeometry(5.6, 18, 8), 0x3a6a4a, [tx, 51, tz]); k.add(new THREE.OctahedronGeometry(1.4, 0), 0xc03020, [tx, 61, tz]);
    // GUM on the east side: a long arcaded front
    k.box(10, 20, 200, 0xd8ccb0, [44, 10, -20]); for (let i = 0; i < 30; i++) { k.box(0.6, 18, 0.6, 0xe8e0d0, [38.7, 9, -110 + i * 6.6]); k.box(0.3, 3, 2.6, 0x3a3a40, [38.9, 6 + (i % 3) * 5, -107 + i * 6.6]); }
    // St Basil's at the far end: onion domes in bright colours
    const bx = 8, bz = -112;
    for (const [dx, dz, h, r, col, col2] of [[0, 0, 30, 5, 0xc8b0a0, 0xd8a030], [-8, 6, 18, 3, 0xb83a2a, 0x2a8a4a], [8, 6, 18, 3, 0xb83a2a, 0x2a6aba], [-8, -6, 18, 3, 0xc8a060, 0xd84a2a], [8, -6, 18, 3, 0xc8a060, 0xe8c040], [0, 10, 16, 3, 0xb83a2a, 0x4aaa6a]]) {
      k.cyl(r, r * 1.1, h, 12, col, [bx + dx, h / 2, bz + dz]);
      const prof = []; for (let i = 0; i <= 10; i++) { const y = i / 10; prof.push(new THREE.Vector2(r * 1.25 * Math.sin(Math.PI * Math.min(1, y * 1.15)) * (1 - y * 0.6) + 0.05, y * r * 2.2)); }
      k.add(new THREE.LatheGeometry(prof, segs(14)), col2, [bx + dx, h, bz + dz]);
      k.cyl(0.08, 0.08, 3, 4, 0xd8b040, [bx + dx, h + r * 2.2 + 1.2, bz + dz]);
    }
    // red banners with Gagarin's name, flags
    g.add(k.mesh(FLAT));
    for (const [x, z, ry] of [[37, -10, -Math.PI / 2], [37, 30, -Math.PI / 2], [-31.8, 10, Math.PI / 2]]) {
      const b = picture(8, 4, (c, w, h) => { c.fillStyle = '#c0281e'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffe080'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('СЛАВА', w / 2, h * 0.42); c.fillText('ГАГАРИНУ!', w / 2, h * 0.75); }, { frame: 0x8a1a14 });
      b.position.set(x, 11, z); b.rotation.y = ry; g.add(b);
    }
    // the crowd: thousands filling the square, cheering, waving
    const spots = [];
    const r = rng(3);
    for (let i = 0; i < 900; i++) { const x = -28 + r() * 62, z = -90 + r() * 110; if (Math.hypot(x, z) < 3.5) continue; spots.push({ x, y: 0, z, yaw: Math.PI + (r() - 0.5) * 1.6 }); }
    this.crowd2 = new Crowd(spots, { seed: 13, who: ['soviet_citizen', 'soviet_worker', 'soviet_babushka', 'soviet_officer', 'soviet_citizen', 'woman_older'] }); g.add(this.crowd2.group); this.crowd2.look = V(-32, 20, -70);
    // flags waving above the crowd (little red rectangles on sticks)
    const fk = new Kit(); for (let i = 0; i < 60; i++) { const x = -20 + r() * 50, z = -70 + r() * 80; fk.cyl(0.015, 0.015, 1.2, 4, 0x6a4a2a, [x, 2.2, z]); fk.box(0.5, 0.32, 0.01, 0xd02a1e, [x + 0.25, 2.65, z], [0, r() * 3, 0]); }
    g.add(fk.mesh(FLAT));
    this.addScene('square', { group: g, bounds: 2.5, place: { lat: 55.75, year: 1961, sunLon: 24 }, amb: 0.4, fogFar: 1500,
      sky: () => { this.G.sky.set(200, 40); },
      update: (dt, t) => { this.crowd2.update(t, dt, 'cheer'); } });
  }

  beds() { return [
    { kind: 'leaves', at: V(30, 2, -30), vol: 0.07, ref: 40, wide: true, on: (ch) => ch.cur === 'night' || ch.cur === 'tower' || ch.cur === 'farm' },
    { kind: 'room', vol: 0.08, on: (ch) => ch.cur === 'prep' || ch.cur === 'office' },
    { kind: 'vent', at: V(0, 1.6, 0), vol: 0.06, ref: 3, on: (ch) => ch.cur === 'cabin' },
  ]; }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. Night, the cottage
    await this.go(D, 'night', 0, 0.1, { x: -0.6, z: -0.6 });
    s.guide = [-3.6, 2.6, -3.0];
    await D.say('ch16_01');
    s.korolev = 1; s.guide = [3.5, 2.4, -0.6];
    await D.say('ch16_02');
    await D.until(() => s.korolev >= 2, fast ? 1 : 12);
    s.korolev = 3; await D.say('ch16_03'); s.korolev = 2;
    // 2. Morning: the doctors, the orange suits
    await this.go(D, 'prep', 0, 1.0, { x: 0, z: 1.2 });
    s.guide = [-1.6, 2.0, -0.4];
    await D.say('ch16_04');
    // 3. The top of the tower
    await this.go(D, 'tower', yawTo(270), 1.0, { x: 4.6, z: 1.0 });
    s.wave = 1; s.guide = [3.4, DECK + 2.6, -1.4];
    const l5 = D.sayAsync('ch16_05');
    await D.cue('Then he climbs'); s.wave = 3;
    await l5; await D.until(() => !this.yuri2.g.visible, fast ? 1 : 6);
    // 4. Inside Vostok
    await this.go(D, 'cabin', 0, 1.0, { x: 0, z: 0 });
    s.guide = this.C.group.localToWorld(V(-1.2, 1.6, -1.6)).toArray();
    const l6 = D.sayAsync('ch16_06');
    await D.cue('undo'); this.boltTimer = setInterval(() => clank(G, this.root.localToWorld(V(0.6 + Math.random() * 0.4, 1.8, 0.8)), 0.18), fast ? 80 : 320);
    await l6;
    await D.say('ch16_07');
    if (!D.kids) {
      await D.say('ch16_08');
      await this.ask(D, 'envelope', { hint: this.envIt.hint, deskHint: this.envIt.deskHint, after: 1, timeout: 18 });
      s.envelope = 2; G.audio.chime?.(null, 0.25);
      await D.wait(fast ? 0.3 : 2.5);
    }
    clearInterval(this.boltTimer);
    await D.say('ch16_09');
    staticBurst(G, 0.3, 0.12);
    await D.say('ch16_10');
    // liftoff: the shaking and the roar, a little shake under you (comfort: a centimetre)
    s.shaking = 1; this.launchClock = 0; cabinRumble(G, 40, 0.8); s.rumble = 0.006; this.shake(0.012, 3);
    await D.say('ch16_11');
    await D.say('ch16_12');
    await D.wait(fast ? 0.5 : 4);
    s.rumble = 0.003;
    // 5. The nose cover blows away: the Earth
    const l13 = D.sayAsync('ch16_13');   // the music begins here, to the end (js/music.js)
    await D.cue('the nose cover'); bang(G, null, 0.5); s.fairing = 1; s.rumble = 0; s.shaking = 0; whoosh(G, 2, 0.25); this.shake(0.006, 0.6);
    s.guide = this.C.group.localToWorld(V(-2.4, 1.0, -2.6)).toArray();
    await l13;
    await D.say('ch16_14');
    // round the world: Siberia, the Pacific, night, sunrise
    const l15 = D.sayAsync('ch16_15');
    s.fast = 1;
    await D.cue('Then night'); this.toPhase = Math.PI;
    await D.cue('And then'); this.toPhase = 2 * Math.PI;
    await l15;
    await D.say('ch16_16');
    s.fast = 0;
    // 6. Outside: retrofire and the fall
    await this.go(D, 'outside', 0, 1.0, { x: 0, z: 0 });
    s.guide = [-3, 2.2, -10];
    s.retro = 1;
    const l17 = D.sayAsync(this.pick(D, 'ch16_17', 'ch16_18'));
    await D.wait(fast ? 0.3 : 3); s.retro = 0;
    if (!D.kids) s.tumble = 1;
    await l17;
    s.tumble = 0; s.glow = 1; rumble(G, 4, 0.25);
    await D.wait(fast ? 0.3 : 4);
    // 7. The farm field
    await this.go(D, 'farm', yawTo(bearing(LAND.x, LAND.z) - 8), 1.2, { x: 0, z: 0 });
    s.chute = 1; s.guide = [-2.6, 2.4, -6];
    await D.say('ch16_19');
    await D.until(() => s.chute >= 2, fast ? 3 : 30);
    s.walk = 1;
    const l20 = D.sayAsync('ch16_20');
    await D.until(() => s.walk === 2, fast ? 3 : 40);
    await l20;
    s.friend = 1;
    await D.say('ch16_21');
    await D.wait(fast ? 0.3 : 1.5);
    // 8. Red Square
    await this.go(D, 'square', yawTo(250), 1.0, { x: 0, z: 0 });
    s.guide = [-4, 4, -8];
    await D.say('ch16_22');
    // 9. Huntsville
    await this.go(D, 'office', 0, 1.0, { x: 0, z: 1.2 });
    s.guide = [-1.3, 2.0, -1.2];
    await D.say('ch16_23');
    s.vbTurn = 1; await D.wait(fast ? 0.2 : 1);
    await D.say('ch16_24');
    await this.journal.present(D);
  }

  update(dt, t) {
    // the day turning round the Earth, eased toward where the story wants it
    if (this.toPhase != null) this.s.dayPhase = damp(this.s.dayPhase || 0, this.toPhase, 0.25 * this.F, dt);
    super.update(dt, t);
  }
  dispose() { clearInterval(this.boltTimer); this.SP?.dispose(); super.dispose(); }
}

function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
  g.fillText('Vostok 1, 12 April 1961', 40, 70);
  g.font = 'italic 26px Georgia, serif';
  // the Earth and one loop round it
  g.fillStyle = '#4a80c0'; g.beginPath(); g.arc(250, 330, 120, 0, 7); g.fill();
  g.strokeStyle = INK; g.lineWidth = 3; g.setLineDash([10, 8]); g.beginPath(); g.ellipse(250, 330, 190, 150, -0.4, 0, 7); g.stroke(); g.setLineDash([]);
  g.fillStyle = INK; g.fillText('once round: 108 minutes', 120, 520);
  // the Vostok ball
  g.fillStyle = '#c8c4bc'; g.beginPath(); g.arc(680, 220, 70, 0, 7); g.fill(); g.strokeStyle = INK; g.stroke();
  g.fillStyle = '#2a3a4a'; g.beginPath(); g.arc(660, 200, 16, 0, 7); g.fill();
  g.fillStyle = INK; g.fillText('Vostok: a ball 2.3 m across', 560, 330);
  g.font = 'bold 54px Georgia, serif'; g.fillText('Поехали!', 600, 430);
  g.font = 'italic 26px Georgia, serif'; g.fillText('"Let\'s go!"', 640, 470);
  g.font = 'italic bold 30px Georgia, serif';
  g.fillText('Yuri Gagarin: the first person in space.', 40, h - 40);
}
