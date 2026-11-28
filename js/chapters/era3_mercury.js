// Era 3, Chapter 3 (n 17): The Mercury Seven. Shepard, Kennedy's challenge, Katherine Johnson,
// John Glenn round the world, and Rice Stadium.
//
// 1. Washington, April 1959: the seven test pilots at a long table, the flashbulbs popping.
// 2. Cape Canaveral, 5 May 1961, dawn: the Mercury-Redstone in its lights; Shepard has been
//    lying in the capsule for hours. 3. Inside Freedom 7: "light this candle", the launch, the
//    sky going dark, the periscope (Adults look through it).
// 4. A diner, 25 May 1961: everyone watches the President on the TV over the counter. The Moon,
//    in less than nine years. The diner goes quiet.
// 5. Langley: Katherine Johnson checks the big computer's numbers by hand (Adults slide the last
//    figure into place); behind the glass the IBM's tape reels spin, Glenn waiting.
// 6. The blockhouse, 20 February 1962: the Atlas through the thick window; "Godspeed, John Glenn."
// 7. Friendship 7: night, then sunrise over the Pacific and the fireflies (music, the wow);
//    the heat shield warning, the fireball, pieces flying past the window.
// 8. New York: the ticker-tape parade, paper raining from every window.
// 9. Rice Stadium, 12 September 1962, in the faded look of old film: the heat, the fanning crowd,
//    Glenn and von Braun on the stage, the pale Moon over the stands. "Why does Rice play Texas?"
//    Cut to black (the answer comes later in the series).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo, bearing, tvSet } from '../era3/base.js';
import { person, makeFolk, sit, wear, Crowd, rows } from '../era3/folk.js';
import { loadAll, copy, Rocket } from '../era3/craft.js';
import { cabin, panelLamp } from '../era3/cabin.js';
import { Puffs, envMap, cabinRumble, bang, staticBurst, flashPop, applause, beep, clank } from '../era3/fx.js';
import { earthSpace, groundPlane, sea, spaceSun } from '../era3/worlds.js';
import { room, surfMat, quad, desk, chair, table, shelf, floodTower, lattice } from '../era3/sets.js';
import { glowSprite, glowPoints, whoosh, rumble } from '../wow/fx.js';
import { loadProps } from '../props.js';
import { holdProp } from '../people.js';
import { canvasTex, lerp, damp } from '../util.js';
import { riceStadium } from '../era3/places.js';
import { rng, noise2 } from '../shapes.js';
import { grove } from '../trees.js';

const M = await loadAll(['craft/mercury_redstone', 'craft/mercury_atlas', 'craft/mercury']);
const PROPS = await loadProps(['film_camera_tripod']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const REDSTONE_AT = V(0, 0, -58);    // Freedom 7 on its pad, from the beach road at dawn
const ATLAS_AT = V(-8, 0, -125);      // Friendship 7, through the blockhouse window

export default class Mercury extends Chapter3 {
  constructor(G) {
    super(G, 17);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { flashes: 0, flight: 'shepard', space: 0, scope: 0, quiet: 0, slid: 0, matched: 0, fire: 0, dawn: 0, flies: 0, heat: 0, car: 0, tape: 0, kennedy: 0 });
    this.buildPress(); this.buildPad(); this.buildCabin(); this.buildDiner(); this.buildLangley(); this.buildBlockhouse(); this.buildParade(); this.buildStadium();
    // the voices on the radio and the TV
    Object.assign(G.narration.radio, { ch17_04: 'nasa', ch17_08: 'tv', ch17_18: 'nasa', ch17_21: 'nasa' });
  }

  // ---------- 1. The press conference, April 1959 ----------
  buildPress() {
    const R = room(13, 10, 4.6, { floor: surfMat('parquet'), wall: { n: surfMat('wallpaper', '#c8c0a0'), s: surfMat('plaster', '#d8d0c0'), e: surfMat('wallpaper', '#c8c0a0'), w: surfMat('wallpaper', '#c8c0a0') }, ceil: surfMat('plaster', '#ece8de'), windows: [{ side: 'e', at: -2, y: 1.0, w: 1.4, h: 2.2 }, { side: 'e', at: 2, y: 1.0, w: 1.4, h: 2.2 }], skirt: 0x4a3a2a });
    const g = R.group, k = new Kit();
    // the long table on a low stage, a cloth, name cards and microphones; the flag and a model capsule
    k.box(9, 0.3, 2.6, 0x5a4a3a, [0, 0.15, -3.6]);
    table(k, 0, -3.25, 0, { w: 6.4, d: 0.8, h: 0.75, cloth: 0x2a3a5a });
    k.box(6.4, 0.55, 0.02, 0x2a3a5a, [0, 0.62, -2.84]);   // the cloth's front drop
    for (let i = 0; i < 7; i++) { const x = -2.7 + i * 0.9; chair(k, x, -3.85, 0, { seat: 0x2a2a2a, col: 0x3a2a1e }); k.box(0.22, 0.08, 0.02, 0xf0ece0, [x, 1.1, -2.9], [-0.3, 0, 0]); k.cyl(0.012, 0.02, 0.22, 6, 0x2a2a2a, [x + 0.15, 1.16, -3.0]); k.ball(0.028, 0, 0x6a6a6a, [x + 0.15, 1.28, -3.0]); }
    k.cyl(0.02, 0.02, 2.4, 6, 0xc8a040, [3.8, 1.5, -4.4]);
    g.add(k.mesh(FLAT));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8, 8, 4), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, map: canvasTex(152, 80, (c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f0ece4' : '#b02030'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#2a3a6a'; c.fillRect(0, 0, w * 0.4, h * 7 / 13); c.fillStyle = '#fff'; for (let i = 0; i < 30; i++) c.fillRect(4 + (i % 6) * 10, 3 + Math.floor(i / 6) * 8, 2, 2); }) }));
    flag.position.set(3.2, 2.2, -4.4); g.add(flag); this.flag = flag;
    const cap = copy(M.mercury, envMap('room'), 0.8); cap.scale.multiplyScalar(0.12); cap.position.set(-3.5, 1.32, -3.3); g.add(cap);
    const banner = quad(4.2, 0.6, new THREE.MeshLambertMaterial({ map: canvasTex(560, 80, (c, w, h) => { c.fillStyle = '#1a2a4a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0e8d0'; c.font = 'bold 44px Georgia, serif'; c.textAlign = 'center'; c.fillText('PROJECT MERCURY', w / 2, 56); }) }));
    banner.position.set(0, 3.3, -4.97); g.add(banner);
    // the seven, sitting at the table: four of Meem's models, three more in their suits
    this.seven = [];
    const who = ['slayton', 'shepard', null, 'glenn', 'schirra', null, null];
    const folkLook = [null, null, { coat: 0x4a4a52, hair: 0x2a1e14, seed: 301 }, null, null, { coat: 0x5a5a5e, hair: 0x6a5038, seed: 302 }, { coat: 0x3a3a42, hair: 0x4a3420, seed: 303 }];
    who.forEach((m, i) => {
      const x = -2.7 + i * 0.9;
      let P;
      if (m) { P = person(g, m, V(x, 0.3, -3.85), 0); sit(P); }
      else { P = makeFolk({ kind: 'suit', tie: 0x2a2a3a, ...folkLook[i] }); P.g.position.set(x, 0.3, -3.85); g.add(P.g); sit(P); }
      P.look = V(x * 0.3, 1.5, 2); this.seven.push(P); this.people.push(P);
    });
    // the reporters in rows, the photographers at the front with their flashbulbs
    this.pressCrowd = new Crowd(rows({ x0: -4.2, x1: 4.2, z0: 0.6, rows: 5, gap: 0.8, depth: 1.0, yaw: Math.PI, seed: 7, skip: (x, z) => Math.abs(x) < 0.9 }), { seed: 11, sit: true, coats: [0x3a3a3e, 0x4a4a52, 0x2a2a30, 0x5a5048, 0x3a3a48, 0x6a6a66] });
    g.add(this.pressCrowd.group);
    const ck = new Kit(); for (const s of this.pressCrowd.spots) chair(ck, s.x, s.z + 0.05, Math.PI, { seat: 0x5a1e1e, col: 0x3a2a1e }); g.add(ck.mesh(FLAT));
    this.snappers = [];
    for (let i = 0; i < 5; i++) {
      const P = makeFolk({ kind: i % 2 ? 'suit' : 'jacket', hat: i % 3 ? 'fedora' : 'none', coat: [0x3a3a3e, 0x5a4a3a, 0x2a3a4a, 0x4a4a42, 0x3a2a2a][i], seed: 320 + i });
      const x = [-3.6, -2.2, -0.9, 1.6, 3.2][i], z = [-1.3, -1.7, -1.5, -1.6, -1.2][i];
      P.g.position.set(x, 0, z); P.g.rotation.y = Math.PI + Math.atan2(x * 0.3, 2.5); P.pose = 'hold'; P.look = V(x * 0.4, 1.4, -3.8); g.add(P.g); this.snappers.push(P); this.people.push(P);
    }
    for (const P of this.snappers) { const ck = new Kit(); ck.box(0.12, 0.1, 0.09, 0x1a1a1a, [0, 0, 0]); ck.cyl(0.03, 0.03, 0.06, 10, 0x2a2a2a, [0, 0, 0.07], [Math.PI / 2, 0, 0]); ck.cyl(0.07, 0.02, 0.05, 12, 0xd8d8d8, [0.1, 0.06, 0.02], [Math.PI / 2, 0, 0]); const cam = ck.mesh(FLAT); const w = new THREE.Group(); cam.rotation.x = Math.PI / 2; w.add(cam); holdProp(P, w, 'Right'); }
    this.flashes = this.snappers.map((P) => { const f = glowSprite(0xffffff, 0.9, 0); f.position.copy(P.g.position).add(V(0, 1.7, -0.35)); g.add(f); return f; });
    if (PROPS.has('film_camera_tripod')) { const P = PROPS.fresh(); P.add('film_camera_tripod', -4.8, 0, 2.6, Math.PI - 0.5, { h: 1.6 }); P.add('film_camera_tripod', 4.8, 0, 2.8, Math.PI + 0.5, { h: 1.6 }); g.add(P.build()); }
    this.addScene('press', { group: g, bounds: 1.0, indoors: true, place: { lat: 38.9, year: 1959, sunLon: 19 }, amb: 0.04, fogFar: 300,
      sky: () => { this.G.sky.set(140, 40); this.dim(0.5, 0.6); this.lamp.position.set(0, 4.2, -2.2); this.lamp.intensity = 3.2; this.lamp.distance = 14; this.lamp2.position.set(0, 3.6, 2.5); this.lamp2.intensity = 1.4; this.lamp2.distance = 12; },
      update: (dt, t) => {
        this.pressCrowd.update(t, dt, 'idle');
        const pos = this.flag.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + 0.6; pos.setZ(i, Math.sin(x * 4 - t * 1.6) * 0.03 * x); } pos.needsUpdate = true;
        // the flashbulbs
        this.flashes.forEach((f, i) => {
          f.material.opacity = Math.max(0, f.material.opacity - dt * 6);
          if (this.s.flashes && Math.random() < dt * 0.6) { f.material.opacity = 1; flashPop(this.G, this.root.localToWorld(f.position.clone()), 0.12); this.lamp2.intensity = 3; }
        });
        this.lamp2.intensity = damp(this.lamp2.intensity, 1.4, 6, dt);
      } });
  }
  // the light from outside (the Sun) and the sky's fill, scaled
  dim(sun, hemi) { this.G.sky.sunLight.intensity *= sun; this.G.sky.hemi.intensity *= hemi; }

  // ---------- 2. Freedom 7 at dawn ----------
  buildPad() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(71);
    g.add(groundPlane({ size: 4000, seg: 140, h: (x, z) => (x > 500 ? -2 : (N(x / 60, z / 60) - 0.5) * 0.7 * clamp01((Math.hypot(x, z) - 20) / 60)), color: (x, z, c) => { const m = N(x / 8, z / 8); if (x > 470) c.setRGB(0.72, 0.66, 0.52); else c.setRGB(0.3 + m * 0.1, 0.34 + m * 0.1, 0.22); } }));
    const S = sea({ size: 8000, col: 0x1a2a3a, sky: 0x6a7a9a, sun: V(0.9, 0.05, 0.1) }); S.position.set(4500, -1.2, 0); g.add(S); this.padSea = S;
    // the pad: concrete apron, the launch stand, the gantry rolled back, floodlights
    k.box(60, 0.3, 50, 0xa8a49c, [REDSTONE_AT.x, 0.15, REDSTONE_AT.z]);
    k.box(3.2, 1.0, 3.2, 0x6a6e70, [REDSTONE_AT.x, 0.8, REDSTONE_AT.z]);
    lattice(k, REDSTONE_AT.x - 22, REDSTONE_AT.z - 2, 6, 6, 26, { step: 3.2, floors: true });
    for (const sz of [-1, 1]) k.box(60, 0.2, 0.3, 0x5a5a5a, [REDSTONE_AT.x - 10, 0.35, REDSTONE_AT.z - 2 + sz * 3]);
    for (const [x, z] of [[-40, -40], [40, -40], [0, 40]]) floodTower(k, REDSTONE_AT.x + x, REDSTONE_AT.z + z, Math.atan2(-x, -z), 20);
    // the beach road and its fence, where you stand with a few early watchers
    k.box(600, 0.06, 6, 0x4a4a48, [0, 0.03, 4]);
    for (let i = 0; i < 40; i++) k.box(0.1, 1.0, 0.1, 0x8a8478, [-60 + i * 3, 0.5, -0.5]);
    for (const y of [0.45, 0.9]) k.box(120, 0.04, 0.04, 0x9a948a, [0, y, -0.5]);
    g.add(k.mesh(FLAT));
    const r = rng(12);
    g.add(grove('palm', Array.from({ length: 10 }, () => ({ x: -60 + r() * 120, z: 10 + r() * 60, s: 0.8 + r() * 0.4 })), { seed: 4, detail: 'mid' }).group);
    g.add(grove('bush', Array.from({ length: 30 }, () => ({ x: -90 + r() * 180, z: 8 + r() * 70, s: 0.7 + r() * 0.6 })), { seed: 6 }).group);
    for (const [x, z] of [[-40, -40], [40, -40], [0, 40]]) { const s = glowSprite(0xfff4d8, 6, 0.8); s.position.set(REDSTONE_AT.x + x, 21, REDSTONE_AT.z + z); g.add(s); }
    this.padFolk = [];
    for (const [x, z, look] of [[-2.4, 1.2, { kind: 'shirt', coat: 0xe8e8e0, tie: 0x2a2a5a, hat: 'none' }], [2.2, 1.5, { kind: 'jacket', coat: 0x5a4a3a, hat: 'fedora' }], [3.4, 2.4, { kind: 'dress', coat: 0x8a5a6a, hair: 0x3a2a1e }]]) { const P = makeFolk({ ...look, seed: 340 + this.padFolk.length }); P.g.position.set(x, 0, z); P.g.rotation.y = Math.atan2(REDSTONE_AT.x - x, REDSTONE_AT.z - z); P.look = REDSTONE_AT.clone().setY(15); g.add(P.g); this.padFolk.push(P); this.people.push(P); }
    this.wendt = person(g, 'wendt', V(REDSTONE_AT.x - 14, 0.3, REDSTONE_AT.z + 8), 2.6); this.people.push(this.wendt); this.wendt.look = REDSTONE_AT.clone().setY(18);
    this.puffs = new Puffs(1000); g.add(this.puffs.mesh);
    this.redstone = new Rocket(g, { parts: [{ M: M.mercury_redstone, y: 1.17 }], engines: [{ x: 0, z: 0, y: 0.1, len: 6, width: 1.1, kind: 'kero' }], size: 0.6, hold: 1.0, accel: 7, az: 100, tilt: 25, tiltAt: 900, env: envMap('dawn'), trench: 0, glowEnd: 40, trailEnd: 35 });
    this.redstone.place(REDSTONE_AT.x, 1.3, REDSTONE_AT.z);
    this.addScene('pad', { group: g, bounds: 2.5, place: { lat: 28.5, year: 1961, sunLon: 45 }, amb: 0.4, fogFar: 3500, mist: 0.03,
      sky: () => { this.G.sky.set(75, -2 + (this.padT || 0) * 0.05); this.key.position.copy(REDSTONE_AT).add(V(60, 30, 60)); this.key.target.position.copy(REDSTONE_AT); this.key.intensity = 0.9; },
      update: (dt, t) => { this.padT = (this.padT || 0) + dt; this.padSea.userData.update?.(t); this.redstone.update(dt, t, this.F); this.puffs.update(this.G, dt * this.F, [2, 0, 1], this.redstone.flash || 0); } });
  }

  // ---------- 3 and 7. Inside the Mercury capsule (Freedom 7, then Friendship 7) ----------
  buildCabin() {
    const g = new THREE.Group();
    const C = this.C = cabin('mercury'); g.add(C.group);
    C.group.updateMatrixWorld(true);
    // the periscope screen: dark until you look, then the Earth from 187 km up
    this.scope = panelLamp(0.12, 0.12, { text: '', col: '#101418' });
    this.scopeTex = canvasTex(256, 256, (c, w, h) => drawScope(c, w, h, 0));
    this.scopeImg = new THREE.Mesh(new THREE.CircleGeometry(0.058, 32), new THREE.MeshBasicMaterial({ map: this.scopeTex, transparent: true, opacity: 0, toneMapped: false }));
    C.overlay('periscope', this.scopeImg);
    this.scopeIt = this.touchable('scope', () => this.C.spot('periscope'), { hint: 'Look through the periscope: touch its round screen in the middle of the panel (TRIGGER)', deskHint: 'Click the round periscope screen', r: 0.12 });
    this.clock = panelLamp(0.1, 0.035, { text: '00:00:00', col: '#200800', mono: true }); C.overlay('timer', this.clock);
    // the Earth through the window: placed so the horizon runs across it
    const wd = C.dirOf('front');
    const SP = this.SP = earthSpace(this.G, { earthR: 400 });
    const down = V(0, 1, 0).cross(wd).normalize();   // the axis to tip the look direction down by
    const toC = wd.clone().applyAxisAngle(down, -58 * D2R);
    SP.earth.position.copy(toC).multiplyScalar(460).add(V(0, 1.6, 0)); SP.earth.rotation.set(0.5, 2.4, 0.2);
    this.winDir = wd; this.horizonAxis = down;
    // the Sun, rising over the horizon (Glenn), and the fireflies
    this.sunG = spaceSun(70); SP.group.add(this.sunG);
    this.flies = glowPoints(160, { sizeScale: 60 }); this.flies.visible = false; g.add(this.flies);
    const r = rng(5); this.fly = Array.from({ length: 160 }, () => ({ p: V((r() - 0.5) * 6, (r() - 0.5) * 4, -2 - r() * 7), v: V((r() - 0.5) * 0.08, (r() - 0.5) * 0.06, 0.15 + r() * 0.2), s: 0.5 + r() * 1.2, ph: r() * 6.28 }));
    // the fireball: an orange glow round the window, and burning pieces streaming past
    this.fireGlow = glowSprite(0xff7a20, 5, 0); this.fireGlow.position.copy(wd).multiplyScalar(2.2).add(V(0, 1.6, 0)); g.add(this.fireGlow);
    this.sparks = glowPoints(90, { sizeScale: 120 }); this.sparks.visible = false; g.add(this.sparks);
    this.spark = Array.from({ length: 90 }, () => ({ p: V(0, -100, 0), v: V(), life: 0 }));
    this.addScene('cabin', { group: g, bounds: 0.25, space: null, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); },
      exit: () => { this.SP.exit(); },
      sky: () => { if (!this.s.space) { this.G.sky.set(80, 6 + (this.cabT || 0) * 0.02); } },
      update: (dt, t) => this.cabinUpdate(dt, t) });
  }
  cabinUpdate(dt, t) {
    const s = this.s, C = this.C, SP = this.SP;
    this.cabT = (this.cabT || 0) + dt;
    if (s.space && !SP.on) SP.enter(null);
    if (!s.space && SP.on) SP.exit();
    if (SP.on) {
      SP.update(dt); SP.earth.rotation.y += dt * 0.01 * (s.flight === 'glenn' ? 2 : 1);
      // the Sun: under the horizon (night) at dawn 0, up over it at dawn 1
      this.dawnK = damp(this.dawnK ?? s.dawn, s.dawn, 0.3 * this.F, dt);
      const a = lerp(-14, 9, this.dawnK) * D2R;
      _a.copy(this.winDir).applyAxisAngle(this.horizonAxis, a).add(V(0.35, 0, 0)).normalize();
      SP.sunDir.copy(_a); SP.atmoU.sun.value.copy(_a);
      this.sunG.position.copy(_a).multiplyScalar(2400).add(V(0, 1.6, 0)); this.sunG.visible = this.dawnK > 0.05 || s.flight === 'shepard';
      this.key.position.copy(_a).multiplyScalar(50); this.key.intensity = 1.6 * clamp01(this.dawnK * 2 + (s.flight === 'shepard' ? 1 : 0));
    }
    // the fireflies drift slowly past, twinkling in the new sunlight
    this.flies.visible = !!s.flies;
    if (s.flies) {
      const U = this.flies.userData, sun = clamp01(this.dawnK * 1.4);
      this.fly.forEach((f, i) => {
        f.p.addScaledVector(f.v, dt); if (f.p.z > 0.5) f.p.z = -9;
        _b.copy(f.p).applyAxisAngle(V(1, 0, 0), Math.asin(clamp(this.winDir.y, -1, 1))).add(this.winDir.clone().multiplyScalar(1.2)).add(V(0, 1.6, 0));
        U.pos.set([_b.x, _b.y, _b.z], i * 3); const tw = (0.6 + 0.4 * Math.sin(t * 3 + f.ph)) * sun; U.col.set([tw, tw * 0.95, tw * 0.6], i * 3); U.size[i] = f.s;
      });
      U.commit();
    }
    // the fireball
    this.fireGlow.material.opacity = damp(this.fireGlow.material.opacity, s.heat ? 0.75 + 0.25 * Math.sin(t * 23) : 0, 2, dt);
    this.sparks.visible = !!s.heat;
    if (s.heat) {
      const U = this.sparks.userData;
      this.spark.forEach((p, i) => {
        p.life -= dt;
        if (p.life <= 0 && Math.random() < dt * 4) { p.life = 0.8 + Math.random(); p.p.copy(this.winDir).multiplyScalar(6 + Math.random() * 4).add(V((Math.random() - 0.5) * 3, 1.6 + (Math.random() - 0.5) * 2, 0)); p.v.copy(this.winDir).multiplyScalar(-6 - Math.random() * 4).add(V((Math.random() - 0.5) * 2, (Math.random() - 0.5), 0)); }
        if (p.life > 0) p.p.addScaledVector(p.v, dt);
        const k = clamp01(p.life); U.pos.set([p.p.x, p.p.y, p.p.z], i * 3); U.col.set([k, k * 0.55, k * 0.15], i * 3); U.size[i] = 0.8 + k;
      });
      U.commit();
    }
    // the mission clock
    if (this.missionClock != null) { this.missionClock += dt * (s.space ? 12 : 1) * this.F; const T = this.missionClock, hh = Math.floor(T / 3600), mm = Math.floor(T / 60) % 60, ss = Math.floor(T % 60); this.clock.userData.set(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, '#200800', true); }
    // the periscope picture
    this.scopeK = damp(this.scopeK || 0, s.scope ? 1 : 0, 2, dt); this.scopeImg.material.opacity = this.scopeK;
    if (s.scope) { this.scopeAcc = (this.scopeAcc || 0) + dt; if (this.scopeAcc > 0.2) { this.scopeAcc = 0; const c = this.scopeTex.image.getContext('2d'); drawScope(c, 256, 256, t); this.scopeTex.needsUpdate = true; } }
    C.lights(true, s.shaking ? 0.85 + 0.15 * Math.sin(t * 29) : 1);
  }

  // ---------- 4. The diner, 25 May 1961 ----------
  buildDiner() {
    const R = room(11, 7, 3.0, { floor: surfMat('tiles', '#e8e4dc'), wall: { n: surfMat('tiles', '#e8d8b8'), s: surfMat('plaster', '#e8dcc0'), e: surfMat('plaster', '#e8dcc0'), w: surfMat('plaster', '#e8dcc0') }, ceil: surfMat('plaster', '#f0ece0'), windows: [{ side: 's', at: -2.8, y: 0.9, w: 2.6, h: 1.6 }, { side: 's', at: 2.6, y: 0.9, w: 2.6, h: 1.6 }], doors: [{ side: 's', at: 0, w: 1.0, h: 2.1 }], skirt: 0xb02a2a, frame: 0xc8c8c0 });
    const g = R.group, k = new Kit();
    // the counter with its chrome stools, the back bar with pies, coffee urns and the milkshake mixer
    k.box(7.2, 1.0, 0.7, 0xc83a2a, [-0.6, 0.5, -1.9]); k.box(7.4, 0.06, 0.85, 0xe8e4dc, [-0.6, 1.03, -1.9]); k.box(7.2, 0.08, 0.02, 0xd8d8d8, [-0.6, 0.9, -1.54]);
    for (let i = 0; i < 8; i++) { const x = -4 + i * 0.95; k.cyl(0.035, 0.12, 0.7, 8, 0xd0d0d0, [x, 0.35, -1.2]); k.cyl(0.19, 0.19, 0.08, 14, 0xc02a2a, [x, 0.72, -1.2]); }
    k.box(7.4, 0.9, 0.5, 0xd8c8a8, [-0.6, 0.45, -3.25]); k.box(7.4, 0.04, 0.55, 0xe8e4dc, [-0.6, 0.92, -3.25]);
    for (let i = 0; i < 3; i++) { k.cyl(0.14, 0.14, 0.5, 12, 0xc8c8c8, [-3.6 + i * 0.4, 1.2, -3.3]); k.cyl(0.03, 0.03, 0.08, 6, 0x2a2a2a, [-3.6 + i * 0.4, 1.0, -3.12], [Math.PI / 2, 0, 0]); }
    for (let i = 0; i < 4; i++) { k.cyl(0.12, 0.12, 0.05, 12, 0xd8a050, [0.2 + i * 0.4, 1.0, -3.28]); k.cyl(0.13, 0.13, 0.25, 12, 0xe8e8f0, [0.2 + i * 0.4, 1.12, -3.28]); }
    k.box(0.25, 0.45, 0.22, 0x5ab0a0, [2.4, 1.16, -3.3]);
    k.box(7.4, 0.05, 0.3, 0x8a6a42, [-0.6, 1.9, -3.38]);   // the shelf with the menu boards
    // booths along the window side
    for (const x of [-3.6, -1.8, 1.8, 3.6]) { k.box(1.2, 0.06, 0.75, 0xe8e4dc, [x, 0.76, 2.9]); k.cyl(0.04, 0.04, 0.74, 6, 0xc8c8c8, [x, 0.37, 2.9]); for (const sz of [-0.62, 0.62]) { k.box(1.2, 0.45, 0.45, 0xc02a2a, [x, 0.22, 2.9 + sz]); k.box(1.2, 0.7, 0.12, 0xc02a2a, [x, 0.8, 2.9 + sz + Math.sign(sz) * 0.2]); } }
    // a jukebox, a pendant lamp row
    k.box(0.8, 1.4, 0.55, 0x8a4a2a, [4.9, 0.7, -0.6]); k.cyl(0.4, 0.4, 0.55, 16, 0xd8a040, [4.9, 1.4, -0.6], [Math.PI / 2, 0, 0], [1, 1, 1]);
    for (let i = 0; i < 5; i++) { k.cyl(0.005, 0.005, 0.5, 4, 0x2a2a2a, [-3.8 + i * 1.6, 2.75, -1.6]); k.cyl(0.08, 0.2, 0.18, 10, 0x2a6a5a, [-3.8 + i * 1.6, 2.45, -1.6]); }
    g.add(k.mesh(FLAT));
    const menu = quad(4.6, 0.6, new THREE.MeshLambertMaterial({ map: canvasTex(1000, 130, (c, w, h) => { c.fillStyle = '#1a1a1a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0ece0'; c.font = 'bold 32px sans-serif'; const items = ['COFFEE 10¢', 'PIE 25¢', 'BURGER 35¢', 'MALTED 25¢', 'BLUE PLATE 65¢'], ws = items.map((t) => c.measureText(t).width), gap = (w - ws.reduce((a, b) => a + b, 0)) / items.length; let x = gap / 2; items.forEach((t, i) => { c.fillText(t, x, 76); x += ws[i] + gap; }); }) }));
    menu.position.set(-1.4, 2.25, -3.49); g.add(menu);
    // the TV, up on a bracket over the end of the counter
    const tv = this.tv = tvSet((c, w, h, t) => drawKennedy(c, w, h, t, this.s.kennedy), { w: 0.62, legs: false });
    tv.g.position.set(3.4, 1.95, -3.1); tv.g.rotation.y = -0.35; g.add(tv.g);
    const br = new Kit(); br.box(0.9, 0.05, 0.6, 0x3a3a3a, [3.4, 1.93, -3.1]); br.box(0.05, 0.6, 0.05, 0x3a3a3a, [3.4, 1.65, -3.4]); g.add(br.mesh(FLAT));
    // the people: customers on the stools and in a booth, the cook, the waitress with the coffee pot
    this.diners = [];
    const look = (P) => { P.look = V(3.4, 2.2, -3.0); };
    for (const [x, sd] of [[-3.05, 1], [-2.1, 2], [-0.2, 3], [0.75, 4], [2.65, 5]]) { const P = makeFolk({ kind: sd % 2 ? 'jacket' : 'shirt', hat: sd === 3 ? 'fedora' : 'none', coat: [0, 0x4a5a6a, 0xe8e4dc, 0x5a4a3a, 0xd8d0c0, 0x3a4a3a][sd], seed: 360 + sd }); P.g.position.set(x, 0.3, -1.2); P.g.rotation.y = Math.atan2(3.4 - x, -3.0 + 1.2) * 0.6 + Math.PI * 0.4; sit(P); g.add(P.g); look(P); this.diners.push(P); }
    for (const [x, z, yaw, o] of [[-1.8, 2.28, 0, { kind: 'dress', coat: 0x5a7aa0, hair: 0x8a5a2a, seed: 370 }], [-1.8, 3.52, Math.PI, { kind: 'jacket', coat: 0x6a5a40, seed: 371 }], [1.8, 2.28, 0, { kind: 'kid', coat: 0xc04a3a, seed: 372 }]]) { const P = makeFolk(o); P.g.position.set(x, 0, z); P.g.rotation.y = yaw; sit(P); g.add(P.g); look(P); this.diners.push(P); }
    this.cook = makeFolk({ kind: 'shirt', coat: 0xf0f0ea, tie: false, hat: 'cap', seed: 380 }); this.cook.g.position.set(-2.2, 0, -2.75); this.cook.g.rotation.y = 0.5; this.cook.pose = 'work'; g.add(this.cook.g);
    this.waitress = makeFolk({ kind: 'dress', coat: 0x7ab0a0, hair: 0x3a2a1e, seed: 381 }); this.waitress.g.position.set(1.0, 0, -2.6); this.waitress.g.rotation.y = 0.3; this.waitress.pose = 'hold'; g.add(this.waitress.g);
    this.people.push(...this.diners, this.cook, this.waitress);
    this.addScene('diner', { group: g, bounds: 1.0, indoors: true, place: { lat: 39.5, year: 1961, sunLon: 64 }, amb: 0.06, fogFar: 400,
      sky: () => { this.G.sky.set(250, 25); this.dim(0.7, 0.8); this.lamp.position.set(-0.6, 2.6, -1.4); this.lamp.intensity = 2.0; this.lamp.distance = 10; this.lamp2.position.set(0, 2.6, 2.0); this.lamp2.intensity = 1.0; this.lamp2.distance = 8; },
      update: (dt, t) => {
        this.tv.pic.update(dt, t);
        const q = this.s.quiet;
        this.cook.pose = q ? 'idle' : 'work'; this.cook.look = q ? V(3.4, 2.2, -3.0) : null;
        this.waitress.pose = q ? 'idle' : 'hold'; this.waitress.look = V(3.4, 2.2, -3.0);
      } });
  }

  // ---------- 5. Langley: Katherine Johnson checks the numbers ----------
  buildLangley() {
    const R = room(12, 9, 3.2, { open: ['n'], floor: surfMat('lino', '#8a8a7a'), wall: { n: surfMat('plaster', '#c8d0c8'), s: surfMat('plaster', '#d8dcd4'), e: surfMat('plaster', '#d8dcd4'), w: surfMat('plaster', '#d8dcd4') }, ceil: surfMat('acoustic', '#eceae4'), windows: [{ side: 'w', at: -1.5, y: 1.0, w: 1.6, h: 1.4 }, { side: 'w', at: 1.8, y: 1.0, w: 1.6, h: 1.4 }], skirt: 0x5a5a52 });
    const g = R.group, k = new Kit();
    // a glass partition at the north: beyond it the IBM 7090 room (one more step down the building)
    k.box(12, 0.9, 0.12, 0xb8bcb4, [0, 0.45, -4.5]); k.box(12, 0.2, 0.12, 0xb8bcb4, [0, 3.1, -4.5]);
    for (let i = 0; i <= 8; i++) k.box(0.06, 2.2, 0.08, 0x6a6e6a, [-6 + i * 1.5, 2.0, -4.5]);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), new THREE.MeshBasicMaterial({ color: 0xc8dce0, transparent: true, opacity: 0.08, depthWrite: false })); glass.position.set(0, 2.0, -4.5); g.add(glass);
    // the computer room: floor, walls, rows of cabinets, tape drives, the console
    k.box(12, 0.05, 7, 0xd8d8d0, [0, 0.0, -8.0]); k.box(12, 3.2, 0.1, 0xd0d4cc, [0, 1.6, -11.5]); for (const sx of [-6, 6]) k.box(0.1, 3.2, 7, 0xd0d4cc, [sx, 1.6, -8.0]); k.box(12, 0.08, 7, 0xe8e8e4, [0, 3.2, -8.0]);
    this.reels = [];
    for (let i = 0; i < 6; i++) {
      const x = -4.6 + i * 1.3;
      k.box(0.95, 1.85, 0.7, 0x6a7a8a, [x, 0.93, -10.6]); k.box(0.8, 0.9, 0.02, 0x2a2e34, [x, 1.35, -10.24]);
      for (const dy of [0.2, -0.2]) { const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 20).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#3a3a3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a6a3a'; c.beginPath(); c.arc(32, 32, 28, 0, 7); c.fill(); c.fillStyle = '#c8c8c8'; c.beginPath(); c.arc(32, 32, 10, 0, 7); c.fill(); c.fillStyle = '#2a2a2a'; for (let a = 0; a < 3; a++) { c.beginPath(); c.arc(32 + Math.cos(a * 2.1) * 18, 32 + Math.sin(a * 2.1) * 18, 5, 0, 7); c.fill(); } }) })); reel.position.set(x, 1.35 + dy, -10.22); g.add(reel); this.reels.push(reel); }
    }
    for (let i = 0; i < 4; i++) { k.box(1.4, 1.75, 0.75, 0x7a8898, [-5.3 + i * 0.0, 0.88, -6.0 - i * 1.3], [0, Math.PI / 2, 0]); }
    k.box(2.6, 0.8, 0.8, 0x6a7a8a, [2.4, 0.4, -7.4]); k.box(2.6, 0.55, 0.06, 0x2a2e34, [2.4, 1.05, -7.1], [-0.4, 0, 0]);   // the operator's console
    g.add(k.mesh(FLAT));
    this.consoleLights = glowPoints(48, { sizeScale: 30 }); g.add(this.consoleLights);
    { const U = this.consoleLights.userData; for (let i = 0; i < 48; i++) { U.pos.set([1.4 + (i % 16) * 0.13, 1.0 + Math.floor(i / 16) * 0.06, -7.08 + Math.floor(i / 16) * 0.02], i * 3); U.size[i] = 0.5; } U.commit(); }
    // the mathematicians' room: desks in rows, each with a Friden calculator and papers
    const dk = new Kit();
    const fridens = [];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { const x = -3.9 + i * 2.6, z = -2.6 + r * 1.9; if (i === 2 && r > 0) continue; desk(dk, x, z, Math.PI, { w: 1.4, d: 0.75, col: 0x8a8a84, drawers: true }); chair(dk, x, z - 0.65, 0, { seat: 0x3a4a3a, col: 0x6a6a62 }); fridens.push([x + 0.4, z + 0.05]); if (i !== 2) dk.box(0.3, 0.005, 0.4, 0xf0ece0, [x - 0.25, 0.765, z]); }
    for (const [x, z] of fridens) { dk.box(0.34, 0.14, 0.34, 0x9a9a88, [x, 0.83, z]); dk.box(0.3, 0.03, 0.2, 0x3a3a34, [x, 0.91, z + 0.06], [-0.3, 0, 0]); dk.box(0.36, 0.06, 0.08, 0x8a8a7a, [x, 0.95, z - 0.13]); }   // (the carriage at the back, keys toward the sitter)
    g.add(dk.mesh(FLAT));
    // Katherine Johnson at the front desk, her sheet of figures under the lamp
    const kx = 1.3, kz = -2.6;
    this.kj = person(g, 'katherine_johnson', V(kx, 0, kz - 0.62), 0); sit(this.kj); this.kj.pose = 'write'; this.kj.look = V(kx, 0.78, kz);
    this.sheetTex = canvasTex(512, 384, (c, w, h) => drawSheet(c, w, h, 0, 0));
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshLambertMaterial({ map: this.sheetTex })); sheet.rotation.x = -Math.PI / 2; sheet.position.set(kx - 0.25, 0.77, kz); g.add(sheet); this.sheet = sheet;
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.035), new THREE.MeshLambertMaterial({ map: canvasTex(96, 48, (c, w, h) => { c.fillStyle = '#fffbe8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a7a5a'; c.strokeRect(1, 1, w - 2, h - 2); c.fillStyle = '#1a2a6a'; c.font = 'italic bold 30px Georgia, serif'; c.textAlign = 'center'; c.fillText('9', w / 2, 36); }) }));
    this.card.rotation.x = -Math.PI / 2; this.cardFrom = V(kx + 0.05, 0.776, kz + 0.25); this.cardTo = V(kx - 0.25 + 0.153, 0.776, kz + 0.083); this.card.position.copy(this.cardFrom); g.add(this.card);
    this.cardIt = this.touchable('card', () => this.card.getWorldPosition(_a), { hint: 'Slide the last figure into its box on her sheet: touch the little card (TRIGGER)', deskHint: 'Click the little card with the last figure', r: 0.12 });
    // the others at their desks
    this.computers = [];
    [[-3.9, -2.6], [-1.3, -0.7], [3.9, -0.7], [-3.9, 1.2], [3.9, 1.2]].forEach(([x, z], i) => { const P = makeFolk({ kind: 'dress', coat: [0x6a7a9a, 0x9a6a5a, 0x5a7a5a, 0xa08a6a, 0x7a5a7a][i], hair: [0x1a1614, 0x2a1e14, 0x4a3420, 0x1a1614, 0x6a5038][i], skin: i % 2 ? 0x8a5a3a : undefined, glasses: i === 2, seed: 390 + i }); P.g.position.set(x, 0, z - 0.62); P.g.rotation.y = 0; sit(P); P.pose = 'write'; g.add(P.g); this.computers.push(P); });
    // Glenn in the computer room, by the console, waiting for her answer
    this.glennL = person(g, 'glenn', V(1.6, 0, -6.6), 0.2); this.glennL.look = V(kx, 1.2, kz);
    this.engineer = makeFolk({ kind: 'shirt', coat: 0xeeeee8, tie: 0x2a2a5a, glasses: true, seed: 399 }); this.engineer.g.position.set(2.6, 0, -6.4); this.engineer.g.rotation.y = -0.6; g.add(this.engineer.g); this.engineer.look = V(1.6, 1.6, -6.6);
    this.people.push(this.kj, ...this.computers, this.glennL, this.engineer);
    this.addScene('langley', { group: g, bounds: 1.0, indoors: true, place: { lat: 37.1, year: 1962, sunLon: 300 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(220, 22); this.dim(0.6, 0.8); this.lamp.position.set(0, 3.0, -1.5); this.lamp.intensity = 2.2; this.lamp.distance = 12; this.lamp2.position.set(0, 3.0, -8); this.lamp2.intensity = 1.6; this.lamp2.distance = 10; },
      update: (dt, t) => {
        const s = this.s;
        this.reels.forEach((r, i) => { r.rotation.z += dt * (i % 2 ? 2.2 : -2.2) * (0.6 + 0.4 * Math.sin(t * 0.7 + i)); });
        const U = this.consoleLights.userData; for (let i = 0; i < 48; i++) { const on = Math.sin(t * (2 + (i % 7)) + i * 1.7) > 0.3 ? 1 : 0.15; U.col.set([on, on * 0.85, on * 0.4], i * 3); } U.commit();
        // the card slides into its box; then the green tick
        this.slideK = damp(this.slideK || 0, s.slid ? 1 : 0, 3, dt); this.card.position.lerpVectors(this.cardFrom, this.cardTo, ease(this.slideK));
        if (s.matched && !this.ticked) { this.ticked = true; const c = this.sheetTex.image.getContext('2d'); drawSheet(c, 512, 384, 1, 1); this.sheetTex.needsUpdate = true; }
        this.kj.pose = s.matched ? 'idle' : 'write'; this.kj.look = s.matched ? this.G.camera.getWorldPosition(_b) : V(1.1, 0.78, -2.6);
        this.glennL.pose = s.matched === 2 ? 'wave' : 'idle';
      } });
  }

  // ---------- 6. The blockhouse, 20 February 1962 ----------
  buildBlockhouse() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(81);
    g.add(groundPlane({ size: 4000, seg: 140, h: (x, z) => (x > 600 ? -2 : (N(x / 60, z / 60) - 0.5) * 0.6 * clamp01((Math.hypot(x, z) - 20) / 60)), color: (x, z, c) => { const m = N(x / 8, z / 8); if (x > 560) c.setRGB(0.72, 0.66, 0.52); else c.setRGB(0.36 + m * 0.1, 0.38 + m * 0.1, 0.25); } }));
    const S = sea({ size: 8000, col: 0x2a5a7a, sky: 0x9ab8d8, sun: V(0.3, 0.6, 0.6) }); S.position.set(4600, -1.2, 0); g.add(S); this.bhSea = S;
    // the room: thick concrete, a long armoured window looking at the pad
    const R = room(9, 6, 2.8, { floor: surfMat('concrete', '#8a8a84'), wall: surfMat('concrete', '#a8a8a0'), ceil: surfMat('concrete', '#9a9a94'), windows: [{ side: 'n', at: 0, y: 1.25, w: 5.5, h: 0.75 }], skirt: 0x5a5a5a, frame: 0x4a4e4a, outside: surfMat('concrete', '#b8b4a8'), thick: 0.6 });
    R.group.position.set(0, 0, 0); g.add(R.group);
    k.box(10.4, 0.6, 7.4, 0xb8b4a8, [0, 3.1, 0]);   // the roof slab
    // consoles along the window, with their dials; periscope eyepieces from the ceiling
    for (let i = 0; i < 4; i++) { const x = -3.0 + i * 2.0; k.box(1.8, 0.85, 0.6, 0x6a7468, [x, 0.43, -2.4]); k.box(1.8, 0.5, 0.06, 0x3a4038, [x, 1.0, -2.65], [0.35, 0, 0]); }
    for (const x of [-2.6, 2.6]) { k.cyl(0.07, 0.07, 1.3, 8, 0x3a3e3a, [x, 2.15, -1.4]); k.box(0.3, 0.16, 0.22, 0x2a2e2a, [x, 1.5, -1.4]); }
    // outside: the pad, the gantry rolled back, the umbilical tower
    k.box(60, 0.3, 46, 0xa8a49c, [ATLAS_AT.x, 0.15, ATLAS_AT.z]);
    k.box(6, 3, 6, 0x7a7e80, [ATLAS_AT.x, 1.5, ATLAS_AT.z]);
    lattice(k, ATLAS_AT.x + 3.6, ATLAS_AT.z, 2.2, 2.2, 22, { step: 2.8, col: 0xb8b4a8 });
    lattice(k, ATLAS_AT.x - 46, ATLAS_AT.z + 4, 9, 8, 36, { step: 3.6, floors: true });
    for (const sz of [-1, 1]) k.box(90, 0.2, 0.3, 0x5a5a5a, [ATLAS_AT.x - 30, 0.35, ATLAS_AT.z + 4 + sz * 4]);
    g.add(k.mesh(FLAT));
    this.carpenter = makeFolk({ kind: 'shirt', coat: 0xeeeee8, tie: 0x2a2a3a, hair: 0x6a5038, seed: 410 }); this.carpenter.g.position.set(-1.6, 0, -1.75); this.carpenter.g.rotation.y = Math.PI + 0.25; g.add(this.carpenter.g); this.carpenter.look = ATLAS_AT.clone().setY(20);
    const hs = new Kit(); hs.add(new THREE.TorusGeometry(0.13, 0.012, 4, 12, Math.PI), 0x2a2a2a, [0, 0.06, 0]); hs.ball(0.035, 0, 0x2a2a2a, [0.13, -0.02, 0]); hs.box(0.008, 0.008, 0.12, 0x2a2a2a, [0.13, -0.05, 0.06]);
    this.carpenter.head?.add(Object.assign(hs.mesh(FLAT), { name: 'headset' }));
    this.bhCrew = [];
    for (const [x, z, o] of [[-3.4, -1.75, { kind: 'shirt', coat: 0xe8e8e0, tie: 0x5a2a2a, seed: 411 }], [2.0, -1.75, { kind: 'shirt', coat: 0xd8e0e8, tie: 0x2a3a5a, glasses: true, seed: 412 }], [3.5, -1.6, { kind: 'shirt', coat: 0xe8e4dc, tie: 0x3a3a2a, seed: 413 }]]) { const P = makeFolk(o); P.g.position.set(x, 0, z); P.g.rotation.y = Math.PI - x * 0.06; P.look = ATLAS_AT.clone().setY(15); g.add(P.g); this.bhCrew.push(P); }
    this.people.push(this.carpenter, ...this.bhCrew);
    this.puffs2 = new Puffs(1200); g.add(this.puffs2.mesh);
    this.atlas = new Rocket(g, { parts: [{ M: M.mercury_atlas, y: 1.45 }], engines: [{ x: -1.2, z: 0, y: 0.1, len: 6, width: 1.0 }, { x: 1.2, z: 0, y: 0.1, len: 6, width: 1.0 }, { x: 0, z: 0, y: 0.3, len: 7, width: 0.8 }], size: 0.75, hold: 2.0, accel: 7, az: 72, tilt: 30, tiltAt: 900, env: envMap('day'), trench: 0, glowEnd: 50, trailEnd: 40 });
    this.atlas.place(ATLAS_AT.x, 3.0, ATLAS_AT.z);
    this.addScene('blockhouse', { group: g, bounds: 0.8, indoors: true, place: { lat: 28.5, year: 1962, sunLon: 331 }, amb: 0.1, fogFar: 3000, mist: 0.02,
      blockers: [{ x: 0, z: -2.4, r: 0.5 }],
      sky: () => { this.G.sky.set(110, 25); this.key.position.copy(ATLAS_AT).add(V(40, 60, 60)); this.key.target.position.copy(ATLAS_AT); this.key.intensity = 1.0; this.lamp.position.set(0, 2.5, 0); this.lamp.intensity = 1.0; this.lamp.distance = 7; },
      update: (dt, t) => { this.bhSea.userData.update?.(t); this.atlas.update(dt, t, this.F); this.puffs2.update(this.G, dt * this.F, [2, 0, 1], this.atlas.flash || 0); for (const P of this.bhCrew) P.pose = this.atlas.rising ? 'gasp' : 'idle'; if (this.atlas.light === null) this.atlas.light = this.flameLight; } });
  }

  // ---------- 8. The ticker-tape parade, New York, 1 March 1962 ----------
  buildParade() {
    const g = new THREE.Group(), k = new Kit();
    const road = quad(40, 400, surfMat('concrete', '#5a5a58'), 3); road.rotation.x = -Math.PI / 2; road.position.z = -120; g.add(road);
    for (const sx of [-1, 1]) k.box(4, 0.18, 400, 0x9a968e, [sx * 9, 0.09, -120]);
    for (let i = 0; i < 40; i++) k.box(0.15, 0.02, 3, 0xe8e4c8, [0, 0.01, 20 - i * 8]);
    // the canyon of office towers, their window grids from one shared texture
    const fac = surfMat('plaster', '#b8b0a0'); fac.map = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#b8ae9a'; c.fillRect(0, 0, w, h); for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) { c.fillStyle = (x + y) % 3 ? '#3a4450' : '#5a6470'; c.fillRect(14 + x * 82, 20 + y * 62, 56, 38); c.fillStyle = '#d8d0c0'; c.fillRect(14 + x * 82, 58 + y * 62, 56, 4); } }); fac.map.wrapS = fac.map.wrapT = THREE.RepeatWrapping;
    const planes = [], r = rng(21); this.windows = [];
    for (const sx of [-1, 1]) { let z = 30; while (z > -320) { const w = 14 + r() * 22, h = 30 + r() * 110, x = sx * 11; const p = new THREE.PlaneGeometry(w, h); const uv = p.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 7.5, uv.getY(i) * h / 7.5); p.rotateY(-sx * Math.PI / 2); p.translate(x, h / 2, z - w / 2); planes.push(p); for (let n = 0; n < 6; n++) this.windows.push(V(x - sx * 0.3, 6 + r() * Math.min(60, h - 8), z - r() * w)); z -= w + 0.2; } }
    const facade = new THREE.Mesh(mergeGeometries(planes), fac); g.add(facade);
    g.add(k.mesh(FLAT));
    // the crowds on both pavements, cheering
    const crowdSpots = [];
    for (const sx of [-1, 1]) for (let z = 14; z > -110; z -= 0.65) for (let j = 0; j < 4; j++) { const x = sx * (7.6 + j * 0.6) + (r() - 0.5) * 0.2; if (Math.abs(z - 4) < 2 && sx > 0 && j === 0) continue; crowdSpots.push({ x, y: 0.18, z: z + (r() - 0.5) * 0.3, yaw: sx > 0 ? -Math.PI / 2 : Math.PI / 2 }); }
    this.streetCrowd = new Crowd(crowdSpots, { seed: 23 }); g.add(this.streetCrowd.group);
    // the open car with Glenn sitting up on the back, waving
    const car = this.car = new THREE.Group(); g.add(car);
    const ck = new Kit();
    ck.box(2.0, 0.6, 5.4, 0x1a2a4a, [0, 0.62, 0]); ck.box(1.9, 0.35, 1.6, 0x1a2a4a, [0, 1.05, 1.6]); ck.box(1.9, 0.08, 2.6, 0x6a4a3a, [0, 0.95, -0.7]);
    ck.box(1.8, 0.5, 0.25, 0x6a4a3a, [0, 1.15, -0.2]); ck.box(1.8, 0.5, 0.25, 0x6a4a3a, [0, 1.15, -1.5]);
    ck.box(1.7, 0.4, 0.05, 0xa8c0d0, [0, 1.3, 0.75], [-0.3, 0, 0]);
    for (const [x, z] of [[-0.95, 1.7], [0.95, 1.7], [-0.95, -1.7], [0.95, -1.7]]) ck.cyl(0.36, 0.36, 0.26, 14, 0x1a1a1a, [x, 0.36, z], [0, 0, Math.PI / 2]);
    ck.box(2.04, 0.08, 5.44, 0xc8c8c8, [0, 0.36, 0]);
    car.add(ck.mesh(FLAT));
    this.glennP = person(car, 'glenn', V(0.3, 1.0, -1.6), 0); sit(this.glennP); this.glennP.pose = 'wave';
    this.annie = makeFolk({ kind: 'dress', coat: 0x5a6a8a, hair: 0x6a4a2a, seed: 420 }); this.annie.g.position.set(-0.4, 0.95, -1.5); sit(this.annie); car.add(this.annie.g); this.annie.pose = 'wave';
    this.driver = makeFolk({ kind: 'suit', hat: 'fedora', seed: 421 }); this.driver.g.position.set(-0.45, 0.55, 0.5); sit(this.driver); car.add(this.driver.g);
    car.position.set(-2.2, 0, -90);
    this.people.push(this.glennP, this.annie, this.driver);
    // the ticker tape: thousands of little paper strips fluttering down
    const N = 2200; this.tapeN = N;
    this.tape = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.07), new THREE.MeshBasicMaterial({ color: 0xe8e4d8, side: THREE.DoubleSide }), N); this.tape.frustumCulled = false; g.add(this.tape);
    this.tapeP = Array.from({ length: N }, () => ({ p: V((r() - 0.5) * 19, 1 + r() * 40, 14 - r() * 80), v: 0.5 + r() * 0.7, ph: r() * 6.28, sp: 1 + r() * 3, rest: r() < 0.35 }));
    for (let i = 0; i < N; i++) this.tape.setColorAt(i, new THREE.Color().setHSL(0.12, 0.2 + r() * 0.3, 0.82 + r() * 0.15));
    this.addScene('parade', { group: g, bounds: 1.0, place: { lat: 40.7, year: 1962, sunLon: 340 }, amb: 0.5, fogFar: 1200, mist: 0.03,
      sky: () => { this.G.sky.set(170, 32); },
      update: (dt, t) => {
        const s = this.s;
        this.streetCrowd.update(t, dt, s.car ? 'cheer' : 'wave');
        if (s.car) { this.car.position.z = Math.min(2, this.car.position.z + dt * 3.2 * this.F); }
        this.glennP.look = this.G.camera.getWorldPosition(_b);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = V(1, 1, 1);
        this.tapeP.forEach((p, i) => {
          if (!s.tape) { m.makeTranslation(0, -50, 0); this.tape.setMatrixAt(i, m); return; }
          p.p.y -= p.v * dt; p.p.x += Math.sin(t * 0.7 + p.ph) * dt * 0.5; p.p.z += Math.cos(t * 0.5 + p.ph) * dt * 0.3;
          if (p.p.y < 0.03) { if (p.rest) p.p.y = 0.03; else p.p.set((Math.random() - 0.5) * 19, 30 + Math.random() * 15, 14 - Math.random() * 80); }
          q.setFromEuler(e.set(t * p.sp + p.ph, t * p.sp * 0.7, p.ph));
          if (p.p.y <= 0.03) q.setFromEuler(e.set(-Math.PI / 2, p.ph, 0));
          this.tape.setMatrixAt(i, m.compose(p.p, q, one));
        });
        this.tape.instanceMatrix.needsUpdate = true;
      } });
  }

  // ---------- 9. Rice Stadium, 12 September 1962 (js/era3/places.js) ----------
  buildStadium() { riceStadium(this, 'stadium'); this.jfk = this.rice.jfk; }

  beds() { return [
    { kind: 'room', vol: 0.08, on: (ch) => ch.cur === 'press' || ch.cur === 'langley' || ch.cur === 'blockhouse' },
    { kind: 'room', vol: 0.12, on: (ch) => ch.cur === 'diner' },
    { kind: 'surf', at: V(400, 0, 0), vol: 0.08, ref: 60, wide: true, on: (ch) => ch.cur === 'pad' },
    { kind: 'vent', at: V(0, 1.6, 0), vol: 0.06, ref: 3, on: (ch) => ch.cur === 'cabin' },
    { kind: 'leaves', at: V(0, 4, -30), vol: 0.05, ref: 40, wide: true, on: (ch) => ch.cur === 'stadium' },
  ]; }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. The press conference
    await this.go(D, 'press', 0, 0.1, { x: 0, z: 1.6 });
    s.guide = [-3.4, 2.6, -1.4]; s.flashes = 1;
    await D.say('ch17_01');
    s.flashes = 0; this.seven[1].look = V(0, 1.6, 1.6);
    await D.say('ch17_02');
    // 2. Freedom 7 at dawn
    await this.go(D, 'pad', yawTo(bearing(REDSTONE_AT.x, REDSTONE_AT.z) - 6), 1.0, { x: 0, z: 2.5 });
    s.guide = [7, 3.2, -9];
    await D.say('ch17_03');
    // 3. Inside the capsule
    s.flight = 'shepard'; s.space = 0; this.cabT = 0;
    await this.go(D, 'cabin', 0, 1.0, { x: 0, z: 0 });
    s.guide = this.C.group.localToWorld(V(-1.0, 1.9, -1.4)).toArray();
    this.missionClock = 0;
    await D.say('ch17_04');
    beep(G, null, 0.1, 900, 0.3);
    s.shaking = 1; s.rumble = 0.005; cabinRumble(G, 16, 0.8); this.shake(0.01, 3);
    const l5 = D.sayAsync('ch17_05');
    await D.wait(fast ? 1 : 7);
    s.shaking = 0; s.rumble = 0; s.space = 1; s.dawn = 1; whoosh(G, 1.5, 0.15);
    await l5;
    if (!D.kids) {
      await D.say('ch17_06');
      await this.ask(D, 'scope', { hint: this.scopeIt.hint, deskHint: this.scopeIt.deskHint, after: 1, timeout: 18 });
      s.scope = 1; G.audio.chime?.(null, 0.2);
      await D.wait(fast ? 0.3 : 4);
    }
    s.scope = 0;
    // 4. The diner
    await this.go(D, 'diner', 0, 1.0, { x: 0.6, z: 0.6 });
    s.guide = [-3.0, 2.2, -0.2];
    await D.say('ch17_07');
    s.kennedy = 1; s.quiet = 1;
    await D.say('ch17_08');
    s.kennedy = 2;
    await D.say('ch17_09');
    // 5. Langley
    await this.go(D, 'langley', 0, 1.0, { x: 1.3, z: -1.0 });
    s.guide = [-1.2, 2.2, -2.2];
    await D.say('ch17_10');
    this.glennL.pose = 'talk'; await D.say('ch17_11'); this.glennL.pose = 'idle';
    await D.say('ch17_12');
    if (!D.kids) {
      await D.say('ch17_13');
      await this.ask(D, 'card', { hint: this.cardIt.hint, deskHint: this.cardIt.deskHint, after: 1, timeout: 18 });
    } else await D.wait(fast ? 0.3 : 1.5);
    s.slid = 1; G.audio.chime?.(null, 0.2);
    await D.wait(fast ? 0.3 : 1.2);
    s.matched = 1;
    const l14 = D.sayAsync('ch17_14');
    await D.wait(fast ? 0.3 : 1.2); s.matched = 2;
    await l14;
    // 6. The blockhouse: the Atlas
    await this.go(D, 'blockhouse', yawTo(bearing(ATLAS_AT.x, ATLAS_AT.z)), 1.0, { x: 0.3, z: -0.9 });
    s.guide = [3.4, 2.2, 0.4];
    const l15 = D.sayAsync('ch17_15');
    await D.wait(fast ? 0.5 : 4);
    this.atlas.ignite(G, { listener: V(0, 1.6, 0), puffs: this.puffs2, roarVol: 2.0, secs: 28 });
    await l15;
    this.carpenter.pose = 'talk';
    await D.say('ch17_16');
    this.carpenter.pose = 'idle';
    await D.until(() => this.atlas.T > 14, fast ? 3 : 20);
    // 7. Friendship 7: night, then the sunrise and the fireflies
    s.flight = 'glenn'; s.space = 1; s.dawn = 0; this.dawnK = 0; this.cabT = 0;
    await this.go(D, 'cabin', 0, 1.0, { x: 0, z: 0 });
    s.guide = this.C.group.localToWorld(V(-1.4, 1.6, -1.6)).toArray();
    this.missionClock = 4 * 3600 + 120;
    const l17 = D.sayAsync('ch17_17');   // the music begins here
    s.dawn = 1;
    await l17;
    s.flies = 1;
    await D.wait(fast ? 0.3 : 2.5);
    await D.say('ch17_18');
    await D.say('ch17_19');
    await D.say('ch17_20');
    s.flies = 0;
    // the fireball
    s.heat = 1; s.shaking = 1; s.rumble = 0.004; cabinRumble(G, 18, 0.7); this.shake(0.008, 4);
    await D.wait(fast ? 0.5 : 4);
    await D.say('ch17_21');
    const l22 = D.sayAsync('ch17_22');
    await D.cue('Splashdown'); s.heat = 0; s.shaking = 0; s.rumble = 0; bang(G, null, 0.4);
    await D.cue('in New York');
    // 8. The parade
    s.tape = 1;
    await this.go(D, 'parade', yawTo(345), 0.8, { x: 4.2, z: 6 });
    s.car = 1; s.guide = [6.5, 3.6, -2]; applause(G, null, 8, 0.4);
    await l22;
    await D.until(() => this.car.position.z > -1, fast ? 2 : 22);
    await D.wait(fast ? 0.3 : 2);
    // 9. Rice Stadium, in the look of old film
    s.film = 1;
    await this.go(D, 'stadium', yawTo(0), 1.2, { x: 0, z: 0 });
    s.guide = [-6, 4.5, -4];
    await D.say('ch17_23');
    s.kennedy = 1;
    await D.say('ch17_24');
    s.applause = 1; applause(G, null, 3, 0.25); await D.wait(fast ? 0.3 : 2.5); s.applause = 0;
    s.guide = [5, 6, -4];
    await D.say('ch17_25');
    await D.say('ch17_26');
    // cut to black, before the answer: it comes later in the story
    s.kennedy = 0;
    await G.ui.fadeOut(0.15);
    await D.wait(fast ? 0.5 : 3);
  }

  dispose() { this.SP?.dispose(); super.dispose(); }
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// The periscope: a round view straight down at the Earth from 187 km: sea, Florida's coast, clouds
function drawScope(c, w, h, t) {
  c.fillStyle = '#05080c'; c.fillRect(0, 0, w, h);
  c.save(); c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, 7); c.clip();
  c.fillStyle = '#1a4a7a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#5a7a4a'; c.beginPath(); c.moveTo(-10, 40 + t * 2 % 30); c.bezierCurveTo(70, 60, 110, 130, 90, 270); c.lineTo(-10, 270); c.fill();
  c.fillStyle = '#d8c8a0'; c.beginPath(); c.moveTo(70, 60); c.bezierCurveTo(112, 128, 96, 200, 92, 270); c.lineTo(86, 270); c.bezierCurveTo(90, 200, 104, 130, 64, 62); c.fill();
  for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(255,255,255,0.75)'; c.beginPath(); c.ellipse((i * 47 + t * 6) % (w + 40) - 20, (i * 71) % h, 18 + (i % 4) * 8, 10, i, 0, 7); c.fill(); }
  // the curve of the horizon at the top, the black of space
  c.fillStyle = '#000'; c.beginPath(); c.arc(w / 2, -460, 520, 0, 7); c.fill();
  c.strokeStyle = 'rgba(140,190,255,0.8)'; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, -460, 522, 0, 7); c.stroke();
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(w / 2, 10); c.lineTo(w / 2, h - 10); c.moveTo(10, h / 2); c.lineTo(w - 10, h / 2); c.stroke();
  c.strokeStyle = '#2a2a2a'; c.lineWidth = 8; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 4, 0, 7); c.stroke();
}

// The President on the TV (May 1961, Congress): the wood-panelled rostrum, the flag, him at the lectern
function drawKennedy(g, w, h, t, on) {
  g.fillStyle = '#6a5a4a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#5a4a3a' : '#7a6a58'; g.fillRect(i * w / 6, 0, w / 6, h * 0.55); }
  g.fillStyle = '#9a9488'; g.fillRect(0, h * 0.55, w, h * 0.45);
  // the flag behind
  for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#e8e4dc' : '#8a8a8a'; g.fillRect(w * 0.06, h * 0.08 + i * 12, 70, 12); }
  g.fillStyle = '#4a4a4a'; g.fillRect(w * 0.06, h * 0.08, 32, 48);
  // him: shoulders, head, hair; he sways a little and nods as he speaks
  const sway = Math.sin(t * 0.8) * 3 + (on === 1 ? Math.sin(t * 2.3) * 2 : 0), nod = on === 1 ? Math.sin(t * 3.1) * 2 : 0;
  const cx = w * 0.55 + sway, cy = h * 0.42;
  g.fillStyle = '#1e1e22'; g.beginPath(); g.moveTo(cx - 80, h); g.lineTo(cx - 70, cy + 40); g.quadraticCurveTo(cx, cy + 22, cx + 70, cy + 40); g.lineTo(cx + 80, h); g.fill();
  g.fillStyle = '#e8e4dc'; g.beginPath(); g.moveTo(cx - 16, cy + 30); g.lineTo(cx, cy + 62); g.lineTo(cx + 16, cy + 30); g.fill();
  g.fillStyle = '#2a2a2e'; g.fillRect(cx - 5, cy + 34, 10, 34);
  g.fillStyle = '#c8b8a8'; g.beginPath(); g.ellipse(cx, cy + nod, 26, 33, 0, 0, 7); g.fill();
  g.fillStyle = '#5a4a3a'; g.beginPath(); g.ellipse(cx - 2, cy - 22 + nod, 28, 15, -0.2, Math.PI, 2 * Math.PI); g.fill();
  g.fillStyle = '#3a3030'; g.fillRect(cx - 12, cy - 4 + nod, 8, 3); g.fillRect(cx + 4, cy - 4 + nod, 8, 3);
  if (on === 1) { g.fillRect(cx - 8, cy + 16 + nod, 16, 2 + Math.abs(Math.sin(t * 9)) * 4); } else g.fillRect(cx - 8, cy + 17 + nod, 16, 2);
  // the lectern and its microphones
  g.fillStyle = '#4a3a2a'; g.fillRect(cx - 70, h * 0.78, 140, h * 0.22);
  g.fillStyle = '#2a2a2a'; for (const dx of [-30, -10, 14]) { g.fillRect(cx + dx, h * 0.62, 4, 40); g.beginPath(); g.ellipse(cx + dx + 2, h * 0.61, 7, 10, 0, 0, 7); g.fill(); }
}

// Katherine Johnson's sheet: columns of figures in pencil; the last box empty until the card goes in
function drawSheet(c, w, h, filled, tick) {
  c.fillStyle = '#f6f2e4'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(80,120,160,0.35)'; c.lineWidth = 1; for (let y = 40; y < h; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.fillStyle = '#2a2a3a'; c.font = 'italic 20px Georgia, serif';
  c.fillText('ORBIT 3 — RETROFIRE / SPLASH POINT', 16, 28);
  const r = rng(4);
  for (let row = 0; row < 11; row++) for (let col = 0; col < 4; col++) {
    const x = 18 + col * 124, y = 58 + row * 24;
    if (row === 10 && col === 3) continue;
    c.fillText(String(Math.floor(r() * 9000 + 1000)) + '.' + String(Math.floor(r() * 90 + 10)), x, y);
  }
  // the last figure's box
  c.strokeStyle = '#a02020'; c.lineWidth = 2; c.strokeRect(388, 58 + 10 * 24 - 20, 110, 26);
  c.fillStyle = '#2a2a3a'; c.fillText('6 4 . 1 2', 300, 58 + 10 * 24);
  if (filled) { c.fillStyle = '#1a2a6a'; c.font = 'italic bold 22px Georgia, serif'; c.fillText('5 2 7 . 9', 396, 58 + 10 * 24); }
  if (tick) { c.strokeStyle = '#2a8a3a'; c.lineWidth = 7; c.beginPath(); c.moveTo(330, 360); c.lineTo(360, 378); c.lineTo(420, 320); c.stroke(); c.fillStyle = '#2a8a3a'; c.font = 'bold 22px Georgia, serif'; c.fillText('MATCH', 430, 370); }
}
