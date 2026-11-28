// Era 3, Apollo 11 part 2 (n 23): Liftoff. 16 July 1969, 9:32 a.m.
//
// 1. Firing Room 1 of the Launch Control Center: rows of consoles, the countdown clock, and at the
//    big windows, with his binoculars, Wernher von Braun. Five kilometres away, the Saturn V.
// 2. T-30 s: Rice Stadium, 1962 ("God's blessing").
// 3. The count: ignition (the flash far off through the windows), "All engines running", "Liftoff!"
//    (the music starts) - everyone on their feet.
// 4. The beach, among a million people: the fire climbing, in silence... and then the sound arrives.
// 5. Inside the capsule: shaking, four g; the first stage cuts off (a lurch), the second lights;
//    the escape tower flies off with the window cover: sunlight and the curve of the Earth;
//    orbit, and a pen floats up off the panel.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo, bearing } from '../era3/base.js';
import { person, makeFolk, sit, wear, Crowd, rows } from '../era3/folk.js';
import { loadAll, copy, Rocket } from '../era3/craft.js';
import { cabin, panelLamp, dressCabin } from '../era3/cabin.js';
import { Puffs, envMap, cabinRumble, roar, bang, clank, applause, beep } from '../era3/fx.js';
import { earthSpace, groundPlane, sea } from '../era3/worlds.js';
import { room, surfMat, quad, picture, floodTower } from '../era3/sets.js';
import { riceStadium } from '../era3/places.js';
import { SATURN, saturnRocket, PAD_Y } from '../era3/saturn.js';
import { holdProp } from '../people.js';
import { glowSprite, rumble } from '../wow/fx.js';
import { canvasTex, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';

const M = await loadAll([...SATURN, 'craft/launch_tower', 'props/helmet_apollo']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const EYE = V(0, 1.6, 0);
const SUN = [88, 34];                    // 9:32 a.m. in July: the Sun high in the east
const PAD_LCC = V(-120, 0, -1250);       // the pad seen from the Launch Control Center (5.6 km, brought in)
const PAD_BEACH = V(-300, 0, -2150);     // and from the beach

function tilt(dir, deg) { const ax = V(0, 1, 0).cross(dir).normalize(); return dir.clone().applyAxisAngle(ax, deg * D2R); }

export default class A11Liftoff extends Chapter3 {
  constructor(G) {
    super(G, 23);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { count: 0, stand: 0, cheer: 0, launch: 0, space: 0, cover: 1, jolt: 0, pen: 0, g4: 0 });
    this.buildLCC(); riceStadium(this, 'stadium'); this.buildBeach(); this.buildCabin();
    Object.assign(G.narration.radio, { ch23_05: 'nasa', ch23_06: 'nasa', ch23_07: 'nasa', ch23_10: 'nasa' });
  }

  // the view outside: flat scrub and lagoons running out to the pad, the tower and the rocket
  outdoors(g, pad, { lagoon = true, ground = true } = {}) {
    const N = noise2(23), k = new Kit();
    if (ground) g.add(groundPlane({ size: 5000, seg: 120, h: () => 0, color: (x, z, c) => { const m = N(x / 30, z / 30); if (lagoon && z < -300 && z > -1500 && N(x / 400, z / 300) > 0.45) c.setRGB(0.2, 0.34, 0.44); else c.setRGB(0.3 + m * 0.1, 0.38 + m * 0.08, 0.2); } }));
    const S = sea({ size: 9000, col: 0x2a5a7a, sky: 0xa8c8e8, sun: V(0.9, 0.5, 0) }); S.position.set(5200, -0.6, 0); g.add(S);
    k.box(80, 6, 70, 0x9a968c, [pad.x, 3, pad.z]);   // the pad's mound
    for (const [x, z, r] of [[-120, -70, 10], [120, -70, 12]]) k.cyl(r, r, r * 1.6, 20, 0xe8e8e4, [pad.x + x, r * 0.8 + 6, pad.z + z]);
    g.add(k.mesh(FLAT));
    const T = copy(M.launch_tower, envMap('day'), 0.9); T.position.set(pad.x, 6, pad.z); g.add(T);
    const R = new Rocket(g, { ...saturnRocket(M), env: envMap('day'), az: 72 }); R.place(pad.x, 6 + PAD_Y, pad.z);
    return { sea: S, rocket: R };
  }

  // ---------- 1 & 3. Firing Room 1 ----------
  buildLCC() {
    const W = 34, Dp = 24, H = 7;
    const wins = [-13.5, -8.1, -2.7, 2.7, 8.1, 13.5].map((at) => ({ side: 'n', at, y: 0.95, w: 5.0, h: 3.9 }));
    const R = room(W, Dp, H, { floor: surfMat('lino', '#5a5a52'), wall: surfMat('plaster', '#d8d4c8'), ceil: surfMat('acoustic'), windows: wins, frame: 0x3a3a3a });
    const g = R.group, k = new Kit(), sk = new Kit();
    // tiers of consoles, all facing the windows; each a desk with a sloping top and rows of lit screens and buttons
    const tiers = [-6.5, -3.5, -0.5, 2.5, 5.5, 8.5];
    tiers.forEach((z, j) => {
      const y = j * 0.25;
      if (j) k.box(W - 2, y, 3, 0x6a6a62, [0, y / 2, z + 0.6]);
      for (let x = -15; x <= 15; x += 2.2) {
        if (Math.abs(x) < 1.2) continue;
        k.box(2.1, 0.75, 0.7, 0x5a6068, [x, y + 0.375, z]); k.box(2.1, 0.6, 0.12, 0x4a5058, [x, y + 1.05, z - 0.28], [-0.35, 0, 0]);
        for (let i = 0; i < 3; i++) sk.box(0.42, 0.3, 0.02, (i + j + Math.round(x)) % 4 === 0 ? 0xd8f0d0 : 0x9adca8, [x - 0.6 + i * 0.6, y + 1.1, z - 0.24], [-0.35, 0, 0]);
        for (let i = 0; i < 8; i++) sk.box(0.05, 0.03, 0.02, [0xff4030, 0xffd040, 0x40d060, 0xffffff][(i + j) % 4], [x - 0.8 + i * 0.22, y + 0.82, z - 0.36], [-0.35, 0, 0]);
      }
    });
    // the countdown clock and the big status boards on the back wall (seen as you turn round)
    g.add(k.mesh(FLAT)); g.add(sk.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })));
    this.clockTex = canvasTex(512, 128, (c, w, h) => this.drawClock(c, w, h, 'T-00:01:00'));
    const clock = quad(3.2, 0.8, new THREE.MeshBasicMaterial({ map: this.clockTex })); clock.position.set(-1.2, 5.6, -11.9); g.add(clock);
    const ck2 = quad(1.6, 0.4, new THREE.MeshBasicMaterial({ map: this.clockTex })); ck2.position.set(-1.6, 1.42, -10.36); g.add(ck2);
    const pk = new Kit(); pk.box(1.7, 0.5, 0.12, 0x2a2a2a, [-1.6, 1.42, -10.43]); pk.box(0.08, 1.2, 0.08, 0x3a3a3a, [-1.6, 0.6, -10.45]); pk.box(0.5, 0.04, 0.4, 0x3a3a3a, [-1.6, 0.02, -10.45]); g.add(pk.mesh(FLAT));
    const banner = picture(4.6, 0.6, (c, w, h) => { c.fillStyle = '#1a2a5a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0ece0'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.fillText('APOLLO 11  ·  FIRING ROOM 1', w / 2, h * 0.72); }, { px: 1024, frame: 0x3a3a3a });
    banner.position.set(0, 5.95, 11.9); banner.rotation.y = Math.PI; g.add(banner);
    // outside the windows: the Cape, five kilometres of flat scrub, and Pad 39A
    const O = this.lccOut = this.outdoors(g, PAD_LCC);
    // the people: rows of engineers at the consoles (one crowd, few draw calls), and the named few
    const spots = [];
    tiers.forEach((z, j) => { for (let x = -15; x <= 15; x += 1.1) { if (Math.abs(x) < 1.2 || (j === 0 && Math.abs(x - 3) < 1.5)) continue; spots.push({ x: x + (Math.random() - 0.5) * 0.2, y: j * 0.25, z: z + 0.7, yaw: Math.PI }); } });
    this.engineers = new Crowd(spots, { sit: true, seed: 2301, coats: [0xf0f0ea, 0xe8ecf0, 0xd8e0e8, 0xf4f0e4, 0xe0e4e8, 0x4a4a52] }); g.add(this.engineers.group);
    // Wernher von Braun at the window with binoculars; Rocco Petrone, launch director, behind him
    this.vb = person(g, 'von_braun', V(3.0, 0, -10.6), Math.PI + 0.15); this.vb.look = V(PAD_LCC.x, 60, PAD_LCC.z);
    const bk = new Kit(); for (const s of [-1, 1]) bk.cyl(0.03, 0.035, 0.12, 10, 0x1a1a1a, [s * 0.04, 0, 0], [Math.PI / 2, 0, 0]); bk.box(0.06, 0.03, 0.04, 0x2a2a2a, [0, 0, 0]);
    holdProp(this.vb, bk.mesh(FLAT), 'Right', [0, 0.08, 0.05]);
    this.petrone = makeFolk({ kind: 'suit', coat: 0x3a3e48, tie: 0x2a2a4a, glasses: true, headset: true, seed: 2311 }); this.petrone.g.position.set(4.6, 0, -9.6); this.petrone.g.rotation.y = Math.PI; g.add(this.petrone.g); this.petrone.look = V(0, 2, -14);
    this.people.push(this.vb, this.petrone);
    this.addScene('lcc', { group: g, bounds: 0.8, indoors: true, place: { lat: 28.6, year: 1969, sunLon: 114 }, amb: 0.05, fogFar: 4000,
      sky: () => { this.G.sky.set(...SUN); this.lamp.position.set(0, 6, 0); this.lamp.intensity = 6; this.lamp.distance = 30; this.lamp.color.setHex(0xf4f4ff); this.lamp2.position.set(0, 5, -8); this.lamp2.intensity = 3; this.lamp2.distance = 18; this.lamp2.color.setHex(0xfff8f0);
        this.key.position.set(200, 300, -100); this.key.target.position.set(0, 0, -1000); this.key.intensity = 1.6; },
      update: (dt, t) => {
        const s = this.s;
        O.sea.userData.update?.(t);
        O.rocket.update(dt, t, this.F);
        this.engineers.update(t, dt, s.cheer ? 'cheer' : 'idle');
        this.vb.pose = s.cheer ? 'cheer' : 'hold'; this.petrone.pose = s.cheer ? 'cheer' : 'idle';
        // the clock counts down once it's going
        if (s.count) { this.clockT = (this.clockT ?? 60) - dt * this.F; } const ct = Math.max(0, this.clockT ?? 60);
        if ((this.clkAcc = (this.clkAcc || 0) + dt) > 0.2) { this.clkAcc = 0; const txt = s.launch ? 'T+00:00:' + String(Math.min(59, Math.floor(this.launchT || 0))).padStart(2, '0') : 'T-00:00:' + String(Math.ceil(ct)).padStart(2, '0'); this.drawClock(this.clockTex.image.getContext('2d'), 512, 128, ct >= 60 && !s.launch ? 'T-00:01:00' : txt); this.clockTex.needsUpdate = true; }
        if (s.launch) this.launchT = (this.launchT || 0) + dt * this.F;
      } });
  }
  drawClock(c, w, h, txt) { c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff5020'; c.font = 'bold 84px monospace'; c.textAlign = 'center'; c.fillText(txt, w / 2, h * 0.74); }

  // ---------- 4. The beach ----------
  buildBeach() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(31);
    g.add(groundPlane({ size: 5000, seg: 120, h: (x, z) => (z < -12 ? -1.5 : 0), color: (x, z, c) => { const m = N(x / 4, z / 4); if (z < -10) c.setRGB(0.66 + m * 0.05, 0.6 + m * 0.05, 0.46); else c.setRGB(0.82 + m * 0.06, 0.76 + m * 0.06, 0.6); } }));
    const water = sea({ size: 3000, col: 0x2a5a7a, sky: 0xa8c8e8, sun: V(0.9, 0.5, 0) }); water.position.set(0, -0.4, -1500); g.add(water);
    const far = this.outdoors(g, PAD_BEACH, { lagoon: false, ground: false });
    const shore = groundPlane({ size: 4000, seg: 80, h: () => -0.2, color: (x, z, c) => { const m = N(x / 30, z / 30); c.setRGB(0.3 + m * 0.1, 0.38 + m * 0.08, 0.2); } }); shore.position.z = -2150 - 1900; g.add(shore); this.beachRocket = far.rocket; this.beachFar = far;
    // cars parked along the road behind, umbrellas, a camper, flags
    const r = rng(33);
    for (let i = 0; i < 60; i++) { const x = -60 + i * 2.2 + r() * 0.4, z = 14 + (i % 3) * 5.5; const col = [0xc83030, 0x2a5a9a, 0xe8e4d8, 0x3a7a4a, 0xd8b040, 0x6a3a8a, 0x1a1a1a][Math.floor(r() * 7)];
      k.box(1.9, 0.75, 4.4, col, [x, 0.6, z], [0, Math.PI / 2 + (r() - 0.5) * 0.2, 0]); k.box(1.7, 0.5, 2.2, col, [x, 1.2, z], [0, Math.PI / 2, 0]); }
    for (let i = 0; i < 10; i++) { const x = -40 + i * 9 + r() * 3, z = 2 + r() * 4; k.cyl(0.03, 0.03, 2.0, 5, 0xe8e8e8, [x, 1.0, z]); k.cyl(1.0, 0.0, 0.5, 10, [0xd83030, 0x3060c0, 0xf0d040, 0xe8e8e8][i % 4], [x, 2.1, z]); }
    k.box(2.4, 2.8, 6.5, 0xe8e0c8, [24, 1.4, 9]);
    g.add(k.mesh(FLAT));
    // the crowd: hundreds of people along the shore, watching (cheering when it goes)
    const spots = [...rows({ x0: -45, x1: 45, z0: 1.2, rows: 6, gap: 1.0, depth: 1.1, yaw: Math.PI, jit: 0.5, seed: 2321 }), ...rows({ x0: -40, x1: -4, z0: -7, rows: 6, gap: 1.0, depth: 1.0, yaw: Math.PI, jit: 0.5, seed: 2323 }), ...rows({ x0: 4, x1: 40, z0: -7, rows: 6, gap: 1.0, depth: 1.0, yaw: Math.PI, jit: 0.5, seed: 2324 })];
    spots.forEach((p) => { p.yaw = Math.PI + (Math.random() - 0.5) * 0.3; });
    this.beachCrowd = new Crowd(spots, { seed: 2322 }); g.add(this.beachCrowd.group);
    this.kids = [0, 1].map((i) => { const P = makeFolk({ kind: 'kid', coat: [0xd84040, 0x4080d0][i], girl: i === 1, seed: 2330 + i }); P.g.position.set(-1.2 + i * 2.6, 0, -2.2); P.g.rotation.y = Math.PI; P.look = V(PAD_BEACH.x, 120, PAD_BEACH.z); g.add(P.g); return P; });
    this.people.push(...this.kids);
    this.puffs = new Puffs(900, { floor: 6 }); g.add(this.puffs.mesh);
    this.addScene('beach', { group: g, bounds: 1.0, place: { lat: 28.5, year: 1969, sunLon: 114 }, amb: 0.5, fogFar: 4000,
      sky: () => { this.G.sky.set(...SUN); this.key.position.set(300, 250, 0); this.key.target.position.set(0, 0, 0); this.key.intensity = 1.8; },
      update: (dt, t) => {
        const s = this.s;
        far.sea.userData.update?.(t); water.userData.update?.(t);
        this.beachRocket.update(dt, t, this.F); this.puffs.update(this.G, dt * this.F, [2, 0], this.beachRocket.flash || 0);
        this.beachCrowd.update(t, dt, s.heard ? 'cheer' : 'idle');
        this.kids.forEach((P) => { P.pose = s.heard ? 'cheer' : 'point'; P.look = this.beachRocket.pos.clone().add(V(0, 0, 0)); });
      } });
  }

  // ---------- 5. Inside the capsule ----------
  buildCabin() {
    const g = new THREE.Group();
    const C = this.C = cabin('apollo', { seat: 'center' }); g.add(C.group);
    dressCabin(C);
    this.clock = panelLamp(0.08, 0.026, { text: '000:00:00', col: '#200800', mono: true }); C.overlay('timer', this.clock);
    // Neil on the left, Mike on the right (Buzz's middle couch is where you are)
    this.neil = person(C.group, 'armstrong', C.crew[0].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.neil);
    this.mike = person(C.group, 'collins', C.crew[1].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.mike);
    for (const P of [this.neil, this.mike]) wear(P, copy(M.helmet_apollo), { lift: -0.05, size: 1 });
    this.people.push(this.neil, this.mike);
    // the boost cover over the windows until the escape tower pulls it away
    this.covers = C.windows.map((w) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshLambertMaterial({ color: 0x2a2826 })); q.position.copy(w.local).multiplyScalar(1.04).add(EYE); q.lookAt(EYE); g.add(q); return q; });
    // the felt pen, floating up off the panel in orbit
    const pk = new Kit(); pk.cyl(0.006, 0.006, 0.13, 8, 0x1a1a1a, [0, 0, 0]); pk.cyl(0.0065, 0.0065, 0.035, 8, 0xe8e8e8, [0, 0.05, 0]);
    this.pen = pk.mesh(FLAT); this.pen.position.set(0.12, 1.25, -0.6); this.pen.rotation.z = Math.PI / 2; g.add(this.pen);
    this.winDir = C.dirOf('rdvL');
    const SP = this.SPc = earthSpace(this.G, { earthR: 400 });
    this.flash = glowSprite(0xfff0d0, 3, 0); this.flash.position.copy(this.winDir).multiplyScalar(1.4).add(EYE); g.add(this.flash);
    this.addScene('cabin', { group: g, bounds: 0.2, indoors: true, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); },
      exit: () => { this.SPc.exit(); },
      sky: () => { if (!this.s.space) { this.G.sky.set(...SUN); } },
      update: (dt, t) => {
        const s = this.s;
        if (s.space && !SP.on) { SP.enter(null); SP.earth.rotation.y = 2.4; } if (!s.space && SP.on) SP.exit();
        if (SP.on) {
          SP.update(dt);
          SP.earth.position.copy(tilt(this.winDir, this.earthTilt ?? 27)).multiplyScalar(460).add(EYE); SP.sunDir.set(-0.3, 0.6, -0.7).normalize();
          SP.earth.rotation.y += dt * 0.01; SP.atmoU.sun.value.copy(SP.sunDir); this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = 1.6;
        }
        this.covers.forEach((q) => { q.visible = !!s.cover; });
        if (s.launch) this.mt = (this.mt || 0) + dt * this.F; const T = (this.mt || 0) + (s.space ? 700 : 0), mm = Math.floor(T / 60) % 60, ss = Math.floor(T % 60);
        this.clock.userData.set(`000:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, '#200800', true);
        C.lights(true, s.launch && !s.space ? 0.85 + 0.15 * Math.sin(t * 29) : 1);
        s.rumble = s.launch && !s.space ? (s.g4 ? 0.006 : 0.004) : 0;
        this.flash.material.opacity = damp(this.flash.material.opacity, 0, 3, dt);
        if (s.pen) { this.penK = (this.penK || 0) + dt * this.F; this.pen.position.set(0.12 + Math.sin(this.penK * 0.4) * 0.03, 1.25 + Math.min(0.32, this.penK * 0.05), -0.6 + this.penK * 0.012); this.pen.rotation.set(this.penK * 0.3, this.penK * 0.5, Math.PI / 2 + this.penK * 0.2); }
        this.neil.look = s.pen ? this.pen.getWorldPosition(_b) : V(-0.6, 1.8, -2);
        this.mike.look = s.pen ? this.pen.getWorldPosition(_a) : V(0.6, 1.8, -2);
      } });
  }
  jolt(big = false) { this.flash.material.opacity = 1; this.shake(big ? 0.02 : 0.014, 0.8); clank(this.G, null, 0.3); bang(this.G, null, 0.3); cabinRumble(this.G, 2, 0.5); }

  beds() { return [
    { kind: 'room', vol: 0.09, on: (ch) => ch.cur === 'lcc' },
    { kind: 'surf', at: V(0, 0, 40), vol: 0.25, ref: 30, wide: true, on: (ch) => ch.cur === 'beach' },
    { kind: 'vent', at: V(0, 1.6, 0), vol: 0.06, ref: 3, on: (ch) => ch.cur === 'cabin' },
  ]; }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. Firing Room 1
    this.lccOut.rocket.reset?.(); this.clockT = 60; s.count = 0;
    await this.go(D, 'lcc', yawTo(5), 0.1, { x: 1.6, z: -8.6 });
    s.guide = [-4.2, 2.3, -9.4];
    const l1 = D.sayAsync('ch23_01');
    await D.cue('von Braun'); this.guideTo(this.vb.g.position.clone().add(V(0, 1.6, 0)), 0.6, 0.6);
    await l1;
    await D.say('ch23_02');
    s.count = 1; this.clockT = 32;
    await D.say('ch23_03');
    // 2. Rice Stadium, 1962
    s.film = 1;
    await this.go(D, 'stadium', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-6, 4.5, -4]; s.kennedy = 1;
    await D.say('ch23_04');
    s.kennedy = 0; s.applause = 1; await D.wait(fast ? 0.3 : 1.2); s.applause = 0;
    s.film = 0;
    // 3. The count
    this.clockT = 13;
    await this.go(D, 'lcc', yawTo(5), 0.8, { x: 1.6, z: -8.6 });
    s.guide = [-4.2, 2.3, -9.4];
    const l5 = D.sayAsync('ch23_05');
    await D.cue('ignition'); this.lccOut.rocket.ignite(G, { mute: true });
    await l5;
    await D.say('ch23_06');
    const l7 = D.sayAsync('ch23_07');       // the music begins here
    s.launch = 1; s.cheer = 1; applause(G, null, 6, 0.4);
    await l7;
    await D.wait(fast ? 0.5 : 3);
    // 4. The beach: the fire, in silence, then the sound
    s.heard = 0; this.beachRocket.reset?.(); this.puffs.clear();
    this.beachRocket.ignite(G, { mute: true, puffs: this.puffs }); this.beachRocket.T = this.beachRocket.o.hold + 3;
    await this.go(D, 'beach', yawTo(bearing(PAD_BEACH.x, PAD_BEACH.z) ), 0.6, { x: 0, z: 0 });
    s.guide = [-2.4, 2.2, -2.0];
    await D.say('ch23_08');
    await D.wait(fast ? 0.2 : 0.6);
    s.heard = 1; roar(G, null, 30, 2.8, 2.5); rumble(G, 14, 0.7, null); this.shake(0.012, 6); s.rumble = 0.004;
    await D.say('ch23_09');
    await D.wait(fast ? 0.3 : 3);
    await D.say('ch23_10');
    await D.wait(fast ? 0.3 : 3);
    s.rumble = 0;
    // 5. Inside the capsule
    s.cover = 1; s.space = 0; s.pen = 0; s.launch = 1; s.g4 = 1; this.mt = 40;
    await this.go(D, 'cabin', 0, 0.6, { x: 0, z: 0 });
    cabinRumble(G, 14, 0.8);
    s.guide = [0.5, 2.2, -1.0];
    await D.say('ch23_11');
    await D.wait(fast ? 0.3 : 2);
    const l12 = D.sayAsync('ch23_12');
    await D.cue('shuts off'); s.g4 = 0; this.jolt(true);
    await D.cue('second stage'); this.jolt(); cabinRumble(G, 10, 0.5);
    await l12;
    const l13 = D.sayAsync('ch23_13');
    await D.cue('flies away'); bang(G, null, 0.5); this.shake(0.012, 0.6);
    await D.cue('Sunlight'); s.cover = 0; s.space = 1; this.flash.material.opacity = 1;
    await l13;
    await D.wait(fast ? 0.3 : 2);
    s.launch = 0;
    const l14 = D.sayAsync('ch23_14');
    await D.cue('pen'); s.pen = 1;
    await l14;
    await D.wait(fast ? 0.5 : 4);
  }
}
