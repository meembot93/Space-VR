// Era 3, Chapter 7 (n 21): Earthrise. Apollo 8, December 1968.
//
// 1. Houston, August 1968: the planners' room. The lander is late (its model sits unfinished on the
//    table), the papers say the Soviets are aiming at the Moon. On the board the free-return path
//    round the Moon draws itself: Apollo 8 will go, without a lander.
// 2. The top of the launch tower at dawn, 110 m up: Borman, Lovell and Anders walk out along the
//    access arm to the white room and the hatch. "Strap in."
// 3. Inside the capsule: the launch, each stage falling away with a jolt and a flash; Earth orbit;
//    "You are go for TLI"; the engine pushes them toward the Moon.
// 4. Outside: the capsule heading away, the whole Earth behind it, smaller and smaller.
// 5. Christmas Eve in Mission Control: radio silence while they're behind the Moon. Everyone waits.
// 6. In lunar orbit: the grey Moon sliding by below. "Plaster of Paris." On the fourth orbit the ship
//    turns, and the Earth rises over the grey horizon (music, the wow). Adults take the picture
//    with the Hasselblad at the window; then the photograph itself.
// 7. A living room on Christmas Eve, a family round the TV, the tree's lights blinking: the reading.
// 8. Christmas Day: the engine fires behind the Moon; Houston hears "there is a Santa Claus".
// 9. A flashback to Rice Stadium (Kennedy describes the fiery return), then the capsule plunging
//    through the air in its fireball, and splashdown in the dark Pacific. The telegram.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo, bearing, tvSet } from '../era3/base.js';
import { person, makeFolk, sit, wear } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { cabin, panelLamp, dressCabin } from '../era3/cabin.js';
import { Puffs, envMap, cabinRumble, staticBurst, beep, click, clank, applause, quindar } from '../era3/fx.js';
import { earthSpace, groundPlane, sea, spaceSun, moonGlobe } from '../era3/worlds.js';
import { room, surfMat, quad, desk, chair, table, sofa, armchair, rug, lampStand, picture, curtains, floodTower } from '../era3/sets.js';
import { riceStadium } from '../era3/places.js';
import { SATURN, saturnStack, PAD_Y, CREW_ARM_Y } from '../era3/saturn.js';
import { holdProp } from '../people.js';
import { glowSprite, glowPoints, whoosh, rumble } from '../wow/fx.js';
import { flameMesh } from '../era3/fx.js';
import { canvasTex, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';

const M = await loadAll([...SATURN, 'craft/launch_tower', 'craft/mission_control', 'craft/lm_ascent', 'craft/lm_descent', 'props/helmet_apollo', 'props/hasselblad']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);

const ARM_Y = PAD_Y + CREW_ARM_Y;        // the access arm's floor, with the rocket standing at the origin
const MOON_R = 1000, MOON_D = 1075;      // the Moon below you in orbit (scaled: the horizon dips ~19 degrees)
const EARTH_D = 1400, EARTH_R = 32;      // the Earth seen from the Moon: about 2 degrees across

// A direction rotated down (toward the ground) by deg, about the horizontal axis across it
function tilt(dir, deg) { const ax = V(0, 1, 0).cross(dir).normalize(); return dir.clone().applyAxisAngle(ax, deg * D2R); }

// Keep only the Command Module of the CSM model (cut away the Service Module below it): returns an
// updater to call when it moves
function cmOnly(o) {
  const plane = new THREE.Plane(V(0, 1, 0), 0);
  o.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); c.material.clippingPlanes = [plane]; } });
  return () => { o.updateWorldMatrix(true, false); const up = V(0, 1, 0).transformDirection(o.matrixWorld), p = o.getWorldPosition(_a); plane.setFromNormalAndCoplanarPoint(up, p.addScaledVector(up, -0.02)); };
}

export default class Apollo8 extends Chapter3 {
  constructor(G) {
    super(G, 21);
    G.renderer.localClippingEnabled = true;
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { traj: 0, walk: 0, space: 0, lunar: 0, launch: 0, jolt: 0, burn: 0, out: 0, turn: 0, rise: 0, card: 0, tv: 0, tei: 0, cheer: 0, heat: 0, telegram: 0, wait: 0 });
    this.buildPlan(); this.buildArm(); this.buildCabin(); this.buildOutbound(); this.buildMCC(); this.buildOrbit(); this.buildHome();
    riceStadium(this, 'stadium'); this.buildReentry(); this.buildSplash();
    Object.assign(G.narration.radio, { ch21_05: 'nasa', ch21_09: 'nasa', ch21_11: 'nasa', ch21_12: 'nasa', ch21_16: 'tv', ch21_17: 'tv', ch21_19: 'nasa' });
  }

  // ---------- 1. The planners' room, August 1968 ----------
  buildPlan() {
    const R = room(9, 7, 3.2, { floor: surfMat('lino', '#6a6458'), wall: { n: surfMat('plaster', '#d8d4c4'), s: surfMat('panelwood'), e: surfMat('plaster', '#d8d4c4'), w: surfMat('plaster', '#d8d4c4') }, ceil: surfMat('acoustic'), windows: [{ side: 'e', at: -1.2, y: 0.9, w: 1.6, h: 1.6 }, { side: 'e', at: 1.4, y: 0.9, w: 1.6, h: 1.6 }], skirt: 0x2a2a2a });
    const g = R.group, k = new Kit();
    table(k, 0, 0.2, 0, { w: 1.4, d: 3.6, col: 0x5a3a22 });
    for (const z of [-1.0, 0.2, 1.4]) for (const sx of [-1, 1]) chair(k, sx * 1.05, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, { seat: 0x3a3a4a });
    k.box(4.6, 1.5, 0.06, 0x2a3a2e, [0, 1.75, -3.44]); k.box(4.7, 0.05, 0.12, 0x6a4a2a, [0, 0.98, -3.4]);   // the blackboard
    for (let i = 0; i < 5; i++) { k.box(0.3, 0.05, 0.24, [0x2a4a8a, 0xe8e4d8, 0x8a2a2a][i % 3], [-0.4 + (i % 2) * 0.02, 0.785 + i * 0.05, 1.6 + (i % 2) * 0.03], [0, i * 0.1, 0]); }   // a stack of binders
    k.cyl(0.04, 0.035, 0.1, 8, 0xe8e8e0, [0.45, 0.81, -0.6]); k.cyl(0.04, 0.035, 0.1, 8, 0xe8e8e0, [-0.4, 0.81, 1.1]);
    g.add(k.mesh(FLAT));
    // the board: Earth, the Moon, and the figure-of-eight path drawing itself in chalk
    const bTex = canvasTex(920, 300, (c, w, h) => drawBoard(c, w, h, 0));
    const board = quad(4.5, 1.47, new THREE.MeshLambertMaterial({ map: bTex })); board.position.set(0, 1.75, -3.405); g.add(board); this.bTex = bTex;
    // the lander's model on the table, not finished (bare frame, a part missing), with a note: LATE
    const lm = new THREE.Group(); const de = copy(M.lm_descent, envMap('room'), 0.8); lm.add(de); const as = copy(M.lm_ascent, envMap('room'), 0.8); as.position.set(0.25, 3.2, 0); as.rotation.z = 0.0; as.visible = false; lm.add(as);
    const ls = 0.3 / Math.max(1, M.lm_descent?.size.y || 3); lm.scale.setScalar(ls); lm.position.set(0.2, 0.76, -0.9); g.add(lm);
    const as2 = copy(M.lm_ascent, envMap('room'), 0.8); as2.scale.setScalar(ls); as2.position.set(0.48, 0.76, -1.05); as2.rotation.set(0, 0.6, Math.PI / 2); g.add(as2);   // the top half, lying beside it
    const tag = quad(0.14, 0.08, new THREE.MeshLambertMaterial({ map: canvasTex(140, 80, (c, w, h) => { c.fillStyle = '#f0e8a0'; c.fillRect(0, 0, w, h); c.fillStyle = '#b02020'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('LATE', w / 2, 54); }) })); tag.rotation.x = -Math.PI / 2 + 0.3; tag.position.set(0.05, 0.79, -0.7); g.add(tag);
    const paper = quad(0.5, 0.36, new THREE.MeshLambertMaterial({ map: canvasTex(400, 288, (c, w, h) => { c.fillStyle = '#e8e2d0'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center'; c.fillText('The Houston Post', w / 2, 36); c.fillRect(10, 46, w - 20, 2); c.font = 'bold 40px Georgia, serif'; c.fillText('SOVIETS AIM', w / 2, 98); c.fillText('AT THE MOON', w / 2, 142); c.fillStyle = 'rgba(30,30,30,0.45)'; for (let y = 160; y < h - 10; y += 9) { c.fillRect(14, y, w / 2 - 24, 3); c.fillRect(w / 2 + 10, y, w / 2 - 24, 3); } }) }));
    paper.rotation.set(-Math.PI / 2, 0, 0.25); paper.position.set(-0.3, 0.77, 0.6); g.add(paper);
    const cal = picture(0.36, 0.5, (c, w, h) => { c.fillStyle = '#f0ece0'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a4a8a'; c.fillRect(0, 0, w, h * 0.22); c.fillStyle = '#fff'; c.font = 'bold 34px serif'; c.textAlign = 'center'; c.fillText('1968', w / 2, h * 0.16); c.fillStyle = '#2a2a2a'; c.font = 'bold 28px serif'; c.fillText('AUGUST', w / 2, h * 0.32); c.font = '20px serif'; for (let d = 1; d <= 31; d++) { const i = d + 3, x = (i % 7) * w / 7 + w / 14, y = h * 0.42 + Math.floor(i / 7) * h * 0.1; c.fillText(String(d), x, y); } }, { frame: 0xe8e4d8 });
    cal.position.set(-4.47, 1.8, -1.6); cal.rotation.y = Math.PI / 2; g.add(cal);
    // Deke Slayton at the board; Gene Kranz and two planners at the table
    this.deke = person(g, 'slayton', V(1.7, 0, -2.8), -0.4); this.deke.look = V(0, 1.7, 1);
    this.kranzP = person(g, 'kranz', V(-1.05, 0, -1.0), Math.PI / 2); sit(this.kranzP); this.kranzP.look = V(0, 1.6, -3.4);
    this.planners = [makeFolk({ kind: 'shirt', coat: 0xeeeee8, tie: 0x2a2a4a, glasses: true, seed: 801 }), makeFolk({ kind: 'suit', coat: 0x4a4a52, seed: 802 })];
    [[1.05, 0.2, -Math.PI / 2], [-1.05, 1.4, Math.PI / 2]].forEach(([x, z, y], i) => { const P = this.planners[i]; P.g.position.set(x, 0, z); P.g.rotation.y = y; sit(P); P.look = V(0, 1.7, -3.4); g.add(P.g); });
    this.people.push(this.deke, this.kranzP, ...this.planners);
    this.addScene('plan', { group: g, bounds: 1.0, indoors: true, place: { lat: 29.6, year: 1968, sunLon: 140 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(200, 50); this.G.sky.sunLight.intensity *= 0.4; this.lamp.position.set(0, 3, 0); this.lamp.intensity = 2.0; this.lamp.distance = 9; },
      update: (dt) => {
        const s = this.s; this.trajK = clamp01((this.trajK || 0) + (s.traj ? dt * this.F / 8 : 0));
        if ((this.bAcc = (this.bAcc || 0) + dt) > 0.08 && s.traj && this.trajK < 1.01) { this.bAcc = 0; drawBoard(this.bTex.image.getContext('2d'), 920, 300, this.trajK); this.bTex.needsUpdate = true; }
        this.deke.pose = s.traj && this.trajK < 1 ? 'point' : 'talk';
      } });
  }

  // ---------- 2. On the access arm at dawn ----------
  buildArm() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(68);
    g.add(groundPlane({ size: 6000, seg: 150, h: (x, z) => { const d = Math.hypot(x, z); return x > 500 ? -2 : d < 110 ? 0 : (N(x / 60, z / 60) - 0.5) * 0.8; }, color: (x, z, c) => { const m = N(x / 8, z / 8), d = Math.hypot(x, z); if (d < 110) c.setRGB(0.66, 0.64, 0.58); else if (x > 470) c.setRGB(0.74, 0.68, 0.54); else c.setRGB(0.36 + m * 0.1, 0.4 + m * 0.1, 0.25); } }));
    const S = sea({ size: 9000, col: 0x2a4a6a, sky: 0xe8c8a8, sun: V(0.95, 0.12, 0.1) }); S.position.set(4800, -1.2, 0); g.add(S); this.armSea = S;
    for (const [x, z] of [[-80, -60], [80, -60], [0, 90], [-60, 70]]) floodTower(k, x, z, Math.atan2(-x, -z), 30);
    k.box(70, 1.5, 60, 0x9a968c, [0, 0.75, -6]); k.box(40, 6, 30, 0xb8b4a8, [-140, 3, -120]); k.box(6, 18, 6, 0xd8d8d0, [180, 9, 60]);
    g.add(k.mesh(FLAT));
    const T = copy(M.launch_tower, envMap('dawn'), 0.8); g.add(T);
    const SV = saturnStack(M, envMap('dawn'), 1.0); SV.position.y = PAD_Y; g.add(SV);
    // the crew, suited, walking out along the arm to the white room
    this.crewA = ['borman', 'lovell', 'anders'].map((m, i) => { const P = person(g, m, V(0.1 * (i - 1), ARM_Y, -13.5 - i * 1.5), 0); wear(P, copy(M.helmet_apollo), { lift: -0.05, size: 1 }); P.look = V(0, ARM_Y + 1.6, 0); return P; });
    this.people.push(...this.crewA);
    this.addScene('arm', { group: g, bounds: 0.5, height: () => ARM_Y, place: { lat: 28.6, year: 1968, sunLon: 270 }, amb: 0.5, fogFar: 6000, mist: 0.04,
      sky: () => { this.G.sky.set(112, 9); this.key.position.set(300, ARM_Y + 60, 40); this.key.target.position.set(0, ARM_Y, 0); this.key.intensity = 1.0; this.key.color.setHex(0xffd8b0); },
      exit: () => { this.key.color.setHex(0xffffff); },
      update: (dt, t) => {
        this.armSea.userData.update?.(t);
        this.crewA.forEach((P, i) => { const to = -3.2 - i * 0.9; if (this.s.walk && P.g.position.z < to) { P.pose = 'walk'; P.g.position.z = Math.min(to, P.g.position.z + dt * 0.7 * this.F); P.g.rotation.y = 0; } else P.pose = 'idle'; });
      } });
  }

  // ---------- 3. Inside the capsule (the launch, Earth orbit, and the window at the Moon) ----------
  buildCabin() {
    const g = new THREE.Group();
    const C = this.C = cabin('apollo', { seat: 'left' }); g.add(C.group);
    dressCabin(C);
    this.clock = panelLamp(0.08, 0.026, { text: '000:00:00', col: '#200800', mono: true }); C.overlay('timer', this.clock);
    // Lovell in the middle couch, Anders on the right (helmets on for the launch)
    this.lovell = person(C.group, 'lovell', C.crew[0].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.lovell);
    this.anders = person(C.group, 'anders', C.crew[1].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.anders);
    this.helmets = [wear(this.lovell, copy(M.helmet_apollo), { lift: -0.05, size: 1 }), wear(this.anders, copy(M.helmet_apollo), { lift: -0.05, size: 1 })];
    this.people.push(this.lovell, this.anders);
    // the Hasselblad (Adults take the picture with it)
    const cam = copy(M.hasselblad, envMap('room'), 0.8); const cs = 0.16 / Math.max(0.01, M.hasselblad?.size.y || 0.3); cam.scale.setScalar(cs);
    this.camG = new THREE.Group(); this.camG.add(cam); g.add(this.camG); this.camG.visible = false;
    this.camIt = this.touchable('photo', () => this.camG.getWorldPosition(new THREE.Vector3()).add(V(0, 0.08, 0)), { hint: 'Take the picture: touch the camera floating by the window (TRIGGER)', deskHint: 'Click the camera by the window', r: 0.16 });
    // the views out of the window: the Earth below in orbit (and the sky on the way up), or the Moon
    this.winDir = C.dirOf('rdvL');
    const SP = this.SPc = earthSpace(this.G, { earthR: 400 });
    this.cabMoon = moonGlobe(MOON_R, { relief: 0.3 }); this.cabMoon.visible = false; g.add(this.cabMoon);
    this.flash = glowSprite(0xfff0d0, 3, 0); this.flash.position.copy(this.winDir).multiplyScalar(1.4).add(EYE); g.add(this.flash);
    this.addScene('cabin', { group: g, bounds: 0.25, space: null, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); },
      exit: () => { this.SPc.exit(); },
      sky: () => { if (!this.s.space) { const k = clamp01((this.cabT || 0) / 70); this.G.sky.set(112, 9 + k * 30); this.G.sky.sunLight.intensity *= 1 - k * 0.8; } },
      update: (dt, t) => {
        const s = this.s;
        this.cabT = s.launch ? (this.cabT || 0) + dt * this.F : 0;
        if (s.space && !SP.on) SP.enter(null); if (!s.space && SP.on) SP.exit();
        if (SP.on) {
          SP.update(dt);
          if (s.lunar) {   // around the Moon: the grey horizon in the window, the little Earth rising over it
            const h = tilt(this.winDir, 4);
            this.cabMoon.visible = true; this.cabMoon.position.copy(tilt(h, Math.asin(MOON_R / MOON_D) / D2R)).multiplyScalar(MOON_D).add(EYE);
            SP.earth.scale.setScalar(EARTH_R / 400); SP.cities.visible = false;
            SP.earth.position.copy(tilt(h, -4)).multiplyScalar(EARTH_D).add(EYE);
            SP.sunDir.copy(this.winDir).negate().setY(0).normalize().add(V(-0.5, 0.7, 0)).normalize(); this.cabMoon.userData.setSun(SP.sunDir);
          } else {
            this.cabMoon.visible = false; SP.earth.scale.setScalar(1); SP.cities.visible = true;
            SP.earth.position.copy(tilt(this.winDir, 58)).multiplyScalar(460).add(EYE); SP.sunDir.set(0.4, 0.6, 0.4).normalize();
            SP.earth.rotation.y += dt * 0.01;
          }
          SP.atmoU.sun.value.copy(SP.sunDir); this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = 1.4;
        }
        this.missionClock = (this.missionClock || 0) + dt * this.F; const T = this.missionClock + (s.lunar ? 75 * 3600 + 48 * 60 : s.space ? 2 * 3600 + 27 * 60 : 0), hh = Math.floor(T / 3600), mm = Math.floor(T / 60) % 60, ss = Math.floor(T % 60);
        this.clock.userData.set(`${String(hh).padStart(3, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, '#200800', true);
        C.lights(true, s.launch && !s.space ? 0.85 + 0.15 * Math.sin(t * 29) : 1);
        this.flash.material.opacity = damp(this.flash.material.opacity, 0, 3, dt);
        for (const H of this.helmets) H.visible = !s.lunar;
        this.camG.visible = !!s.lunar && !s.card;
        if (this.camG.visible) { this.camG.position.copy(this.winDir).multiplyScalar(0.55).add(EYE).add(V(0.18, -0.2 + Math.sin(t * 0.8) * 0.01, 0)); this.camG.lookAt(this.camG.position.clone().add(this.winDir)); this.camG.rotateY(Math.PI); }
        this.anders.look = s.lunar ? this.camG.position : this.G.camera.getWorldPosition(_b);
        this.lovell.look = s.lunar ? EYE.clone().addScaledVector(this.winDir, 3) : V(0, 1.6, -2);
      } });
  }
  // a jolt: the stage falls away (a flash at the window, a bump)
  jolt() { this.flash.material.opacity = 1; this.shake(0.02, 0.8); clank(this.G, null, 0.25); cabinRumble(this.G, 2, 0.5); }

  // ---------- 4. Leaving Earth: the capsule ahead, the Earth shrinking behind it ----------
  buildOutbound() {
    const g = new THREE.Group();
    const csm = new THREE.Group(); csm.add(copy(M.apollo_csm, envMap('space'), 1.1)); csm.rotation.set(-Math.PI / 2 + 0.2, 0, 0.3); csm.position.set(3.2, 2.2, 8); g.add(csm); this.csmO = csm;
    const SP = this.SPo = earthSpace(this.G, { earthR: 400 }); SP.earth.position.set(-200, -260, 1100); SP.sunDir.set(0.3, 0.45, -0.85).normalize();
    this.sunO = spaceSun(60); SP.group.add(this.sunO);
    this.addScene('outbound', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        this.outK = clamp01((this.outK || 0) + (this.s.out ? dt * this.F / 26 : 0));
        SP.earth.scale.setScalar(lerp(1, 0.07, Math.pow(ease(this.outK), 0.7))); SP.earth.rotation.y += dt * 0.01;
        SP.atmoU.sun.value.copy(SP.sunDir); this.sunO.position.copy(SP.sunDir).multiplyScalar(2400).add(EYE);
        this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = 2.2;
        csm.position.z = 9 + this.outK * 2; csm.rotation.z = 0.3 + t * 0.01;
      } });
  }

  // ---------- 5, 8. Mission Control at Christmas ----------
  buildMCC() {
    const g = new THREE.Group();
    g.add(copy(M.mission_control, envMap('room'), 0.6));
    this.ctl = [];
    const seats = [[-4.5, 3.8], [1.5, 3.8], [4.5, 3.8], [-3.0, 1.8], [0.0, 1.8], [3.0, 1.8]];
    seats.forEach(([x, z], i) => { const P = makeFolk({ kind: 'shirt', coat: [0xeeeee8, 0xd8e0e8, 0xe8e4dc][i % 3], tie: [0x2a2a4a, 0x5a2a2a, 0x2a4a2a][i % 3], glasses: i % 3 === 1, headset: true, seed: 820 + i }); P.g.position.set(x, 0, z); P.g.rotation.y = Math.PI; sit(P); P.look = V(x * 0.3, 2.2, -9); g.add(P.g); this.ctl.push(P); });
    this.collins = person(g, 'collins', V(-1.5, 0, 3.8), Math.PI); sit(this.collins); this.collins.look = V(-0.5, 2.2, -9);
    this.kranzM = person(g, 'kranz', V(0.9, 0, 5.6), Math.PI); this.kranzM.look = V(0, 3, -9);
    this.people.push(...this.ctl, this.collins, this.kranzM);
    // a little Christmas tree on a console, and the big screen showing the Moon and the ship's path
    const k = new Kit();
    for (let i = 0; i < 4; i++) k.cyl(0, 0.32 - i * 0.06, 0.32, 10, 0x2a5a2a, [6.2, 1.25 + i * 0.16, 2.6]); k.cyl(0.05, 0.05, 0.15, 6, 0x5a3a2a, [6.2, 1.05, 2.6]);
    g.add(k.mesh(FLAT));
    this.mccTree = glowPoints(24, { sizeScale: 60 }); g.add(this.mccTree); const r = rng(8);
    for (let i = 0; i < 24; i++) { const y = r(), a = r() * 6.28, rr = 0.3 * (1 - y) + 0.03; this.mccTree.userData.pos.set([6.2 + Math.cos(a) * rr, 1.2 + y * 0.6, 2.6 + Math.sin(a) * rr], i * 3); this.mccTree.userData.size[i] = 0.6; }
    const mTex = canvasTex(1024, 384, (c, w, h) => drawLunarMap(c, w, h, 0, false));
    const map = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: mTex, toneMapped: false })); map.position.set(0, 3.2, -9.9); g.add(map); this.mTex = mTex;
    this.addScene('mcc', { group: g, bounds: 1.2, indoors: true, place: { lat: 29.6, year: 1968, sunLon: 272 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(200, -20); this.G.sky.hemi.intensity = 0.9; this.lamp.position.set(0, 5, 4); this.lamp.intensity = 4.0; this.lamp.distance = 22; this.lamp2.position.set(0, 3.5, -8); this.lamp2.color.setHex(0x9ac8ff); this.lamp2.intensity = 1.2; this.lamp2.distance = 12; },
      exit: () => { this.lamp2.color.setHex(0xfff0dc); },
      update: (dt, t) => {
        const s = this.s;
        if ((this.mAcc = (this.mAcc || 0) + dt) > 0.25) { this.mAcc = 0; drawLunarMap(this.mTex.image.getContext('2d'), 1024, 384, t, !!s.wait); this.mTex.needsUpdate = true; }
        const U = this.mccTree.userData; for (let i = 0; i < 24; i++) { const on = Math.sin(t * 2 + i * 1.7) > 0; const c = [[1, 0.2, 0.2], [0.2, 1, 0.3], [0.3, 0.5, 1], [1, 0.8, 0.2]][i % 4]; U.col.set(c.map((v) => v * (on ? 1 : 0.25)), i * 3); } U.commit();
        for (const P of [...this.ctl, this.kranzM]) P.pose = s.cheer ? 'cheer' : s.wait ? 'idle' : 'idle';
        this.collins.pose = s.cheer ? 'cheer' : 'talk';
      } });
  }

  // ---------- 6, 8. In orbit round the Moon ----------
  buildOrbit() {
    const g = new THREE.Group();
    const moon = this.moonO = moonGlobe(MOON_R, { relief: 0.3 }); moon.position.set(0, 1.6 - MOON_D, 0); g.add(moon);
    const csm = new THREE.Group(); csm.add(copy(M.apollo_csm, envMap('moon'), 1.1)); csm.position.set(-2.2, 0.8, -8); csm.rotation.set(0, 0, -Math.PI / 2); g.add(csm); this.csmM = csm;
    this.sps = flameMesh(3.5, 1.4, 'hyper'); this.sps.position.set(0, -9.6, 0); csm.children[0].add(this.sps); this.sps.userData.set(0, 0);
    const SP = this.SPm = earthSpace(this.G, { earthR: EARTH_R, cities: false });
    this.sunM = spaceSun(60); SP.group.add(this.sunM);
    // where the Earth rises: straight ahead over the horizon, a little to the right of the ship
    this.riseDir = V(0.25, 0, -1).normalize();
    // the photograph: a print that floats up in front of you
    this.card = picture(1.2, 1.2, drawEarthrise, { frame: 0xf0ece4 }); this.card.visible = false; this.root.add(this.card);
    this.addScene('orbit', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s;
        // the Moon slides by beneath you
        moon.rotation.x += dt * 0.004 * this.F;
        // the Earth: below the horizon until the ship turns and it rises (hidden behind the Moon on the far side)
        this.riseK = clamp01((this.riseK || 0) + (s.rise ? dt * this.F / 16 : 0));
        const horizon = -Math.asin(Math.sqrt(1 - (MOON_R / MOON_D) ** 2)) / D2R;   // the horizon's dip
        const el = horizon + lerp(-4, 6, ease(this.riseK));
        SP.earth.position.copy(this.riseDir).applyAxisAngle(V(1, 0, 0), el * D2R).multiplyScalar(EARTH_D).add(EYE);
        SP.earth.visible = !s.tei; SP.earth.rotation.y += dt * 0.01;
        SP.sunDir.set(s.tei ? 0.2 : -0.75, s.tei ? -0.3 : 0.25, s.tei ? -0.9 : 0.4).normalize(); SP.atmoU.sun.value.copy(SP.sunDir);
        moon.userData.setSun(SP.sunDir); this.sunM.position.copy(SP.sunDir).multiplyScalar(2400).add(EYE); this.sunM.visible = SP.sunDir.y > -0.1;
        this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = s.tei ? 0.3 : 2.0;
        // the ship turns to face the horizon (window toward the Earth); the engine burn on Christmas Day
        this.turnK = damp(this.turnK || 0, s.turn ? 1 : 0, 0.5 * this.F, dt);
        csm.rotation.set(0, this.turnK * 0.5, -Math.PI / 2 + this.turnK * 0.25);
        this.burnK = s.burn ? (this.burnK || 0) + dt * this.F : 0;
        this.sps.userData.set(s.burn ? 0.9 + 0.1 * Math.sin(t * 30) : 0, t);
        csm.position.set(-2.2 + this.burnK * this.burnK * 0.25, 0.8, -8);
        this.flameLight.position.copy(csm.position).add(V(-12, 0, 0)); this.flameLight.intensity = s.burn ? 6 : 0; this.flameLight.distance = 20;
      } });
  }
  showCard(on) {
    const c = this.card; c.visible = !!on; if (!on) return;
    const cam = this.G.camera.getWorldPosition(new THREE.Vector3()), d = this.G.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    c.position.copy(cam).addScaledVector(d, 1.6).add(V(0, -0.1, 0)); c.lookAt(cam.x, c.position.y, cam.z); c.scale.setScalar(0.2); this.cardK = 0;
  }

  // ---------- 7. Christmas Eve at home: the reading on TV ----------
  buildHome() {
    const R = room(6, 5, 2.7, { floor: surfMat('boards'), wall: surfMat('wallpaper', '#b8a878'), ceil: surfMat('plaster', '#ece4d4'), windows: [{ side: 'n', at: 1.6, y: 0.9, w: 1.3, h: 1.3 }], doors: [{ side: 'w', at: 1.3, w: 0.9, h: 2.1 }], skirt: 0x3a2a1e, outside: surfMat('brick'), thick: 0.2 });
    const g = R.group, k = new Kit();
    rug(k, 0, 0.3, 0, { w: 2.8, d: 2.0, col: 0x6a2a20 });
    sofa(k, 0, 1.6, Math.PI, { col: 0x5a6a4a, w: 2.0 }); armchair(k, -1.9, 0.6, -Math.PI / 2 - 0.4, { col: 0x8a5a3a });
    k.box(0.9, 0.35, 0.5, 0x7a5a3a, [0.5, 0.18, 0.4]);   // a footstool the kids sit on
    lampStand(k, 1.4, 2.0, { h: 1.5 }); curtains(k, R.windows[0], { col: 0x8a3a2a });
    // the tree in the corner with presents under it
    for (let i = 0; i < 5; i++) k.cyl(0, 0.62 - i * 0.1, 0.55, 12, 0x2a5a2a, [-2.2, 0.5 + i * 0.34, -1.8]); k.cyl(0.06, 0.06, 0.4, 6, 0x5a3a2a, [-2.2, 0.2, -1.8]); k.ball(0.07, 0, 0xf0d040, [-2.2, 2.25, -1.8]);
    for (const [x, z, c, s] of [[-1.9, -1.4, 0xb02020, 0.3], [-2.5, -1.4, 0x2a5aa0, 0.24], [-2.1, -1.2, 0xe8c040, 0.2], [-1.7, -1.7, 0x2a8a3a, 0.26]]) { k.box(s, s * 0.8, s, c, [x, s * 0.4, z]); k.box(s + 0.01, 0.03, 0.04, 0xf0f0e8, [x, s * 0.8, z]); }
    g.add(k.mesh(FLAT));
    this.treeL = glowPoints(40, { sizeScale: 80 }); g.add(this.treeL); const r = rng(12);
    for (let i = 0; i < 40; i++) { const y = r(), a = r() * 6.28, rr = 0.6 * (1 - y) + 0.06; this.treeL.userData.pos.set([-2.2 + Math.cos(a) * rr, 0.35 + y * 1.8, -1.8 + Math.sin(a) * rr], i * 3); this.treeL.userData.size[i] = 0.7; }
    // the TV against the north wall, showing the grey Moon going by
    const tv = this.homeTV = tvSet((c, w, h, t) => drawMoonTV(c, w, h, t), { w: 0.62, legs: true }); tv.g.position.set(0, 0, -2.1); g.add(tv.g);
    // the family: dad, mum, grandma, two children
    this.family = [];
    for (const [x, y, z, o, yaw, seated] of [[-0.6, 0, 1.6, { kind: 'jacket', coat: 0x6a5a4a, seed: 841 }, Math.PI, true], [0.1, 0, 1.6, { kind: 'dress', coat: 0x8a3a4a, seed: 842 }, Math.PI, true], [-1.9, 0, 0.6, { kind: 'dress', coat: 0x4a4a6a, hair: 0xc8c8c0, glasses: true, seed: 843 }, -Math.PI / 2 - 0.4, true], [0.3, 0, 0.45, { kind: 'kid', coat: 0x3a6aa0, seed: 844 }, Math.PI, true], [0.75, 0, 0.45, { kind: 'kid', girl: true, coat: 0xd8a040, seed: 845 }, Math.PI, true]]) {
      const P = makeFolk(o); P.g.position.set(x, y, z); P.g.rotation.y = yaw; if (seated) sit(P); P.look = V(0, 0.75, -2.1); g.add(P.g); this.family.push(P);
    }
    for (const P of this.family.slice(3)) P.g.position.y = 0.35 - 0.44 * (1.25 / 1.74);
    this.people.push(...this.family);
    // snow falling outside the window
    const view = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ fog: false, map: canvasTex(512, 220, (c, w, h) => { c.fillStyle = '#1a2234'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8ccd8'; c.fillRect(0, h * 0.6, w, h); const rr = rng(4); for (let i = 0; i < 5; i++) { const x = 20 + i * 110; c.fillStyle = '#2a2a3a'; c.fillRect(x, h * 0.38, 70, h * 0.22); c.fillStyle = '#f8d890'; c.fillRect(x + 10, h * 0.44, 10, 10); c.fillRect(x + 45, h * 0.44, 10, 10); for (let j = 0; j < 8; j++) { c.fillStyle = ['#ff4040', '#40ff60', '#4080ff', '#ffd040'][j % 4]; c.fillRect(x + j * 9, h * 0.37, 3, 3); } } }) }));
    view.position.set(1.6, 1.4, -6.5); g.add(view);
    this.addScene('home', { group: g, bounds: 0.8, indoors: true, place: { lat: 41.5, year: 1968, sunLon: 273 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(300, -30); this.lamp.position.set(1.4, 1.7, 2.0); this.lamp.intensity = 1.0; this.lamp.distance = 6; this.lamp2.position.set(0, 0.9, -1.6); this.lamp2.color.setHex(0xb8c8ff); this.lamp2.intensity = 0.8 + 0.2 * Math.sin(this.t * 7); this.lamp2.distance = 4; },
      exit: () => { this.lamp2.color.setHex(0xfff0dc); },
      update: (dt, t) => {
        this.homeTV.pic.update(dt, t);
        const U = this.treeL.userData; for (let i = 0; i < 40; i++) { const on = Math.sin(t * 1.5 + i * 2.3) > -0.2; const c = [[1, 0.2, 0.2], [0.2, 1, 0.3], [0.3, 0.5, 1], [1, 0.8, 0.2]][i % 4]; U.col.set(c.map((v) => v * (on ? 1 : 0.2)), i * 3); } U.commit();
      } });
  }

  // ---------- 9. Coming home: the fireball ----------
  buildReentry() {
    const g = new THREE.Group();
    const cm = new THREE.Group(); const o = copy(M.apollo_csm, envMap('space'), 0.6); cm.add(o); cm.position.set(0.4, 1.2, -6); cm.rotation.set(0.25, 0.5, -Math.PI / 2 + 0.35); g.add(cm); this.cmR = cm;
    this.cmRclip = cmOnly(o);
    // the glow round the heat shield, the trail of fire, the sparks streaming back past you
    this.plasma = [glowSprite(0xff7a20, 9, 0), glowSprite(0xffd090, 4, 0)]; for (const p of this.plasma) { p.position.set(-1.6, 0.5, -6.3); g.add(p); }
    this.trail = glowPoints(160, { sizeScale: 140 }); g.add(this.trail);
    this.trailP = Array.from({ length: 160 }, () => ({ p: V(0, -99, 0), v: V(), life: 0 }));
    const SP = this.SPr = earthSpace(this.G, { earthR: 400 }); SP.earth.position.set(0, -460, -120); SP.earth.rotation.set(0.3, 4.2, 0.1); SP.sunDir.set(0.2, -0.4, -1).normalize();
    this.addScene('reentry', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        this.cmRclip();
        SP.earth.rotation.x += dt * 0.03; SP.atmoU.sun.value.copy(SP.sunDir);
        this.key.position.set(0.6, -3, -8); this.key.target.position.copy(cm.position); this.key.intensity = 1.5;
        this.flameLight.position.set(-1.2, 1.2, -5.2); this.flameLight.intensity = 30 * (0.8 + 0.2 * Math.sin(t * 25)); this.flameLight.distance = 14;
        this.plasma[0].material.opacity = 0.75 + 0.25 * Math.sin(t * 19); this.plasma[1].material.opacity = 0.9;
        cm.position.x = 0.4 + Math.sin(t * 13) * 0.01;
        const U = this.trail.userData;
        this.trailP.forEach((p, i) => {
          p.life -= dt;
          if (p.life <= 0) { p.life = 0.5 + Math.random() * 1.2; const a = Math.random() * 6.28, rr = 1.6 + Math.random() * 0.6; p.p.set(-1.5, 0.6 + Math.sin(a) * rr, -6.2 + Math.cos(a) * rr); p.v.set(8 + Math.random() * 12, 1 + Math.random() * 2, (Math.random() - 0.5) * 2); }
          p.p.addScaledVector(p.v, dt); const k = clamp01(p.life);
          U.pos.set([p.p.x, p.p.y, p.p.z], i * 3); U.col.set([k, k * 0.5, k * 0.12], i * 3); U.size[i] = 1.2 + k * 2.5;
        });
        U.commit();
      } });
  }

  // ---------- 9. Splashdown in the dark Pacific ----------
  buildSplash() {
    const g = new THREE.Group();
    const S = sea({ size: 6000, col: 0x1e3450, sky: 0x4a5a7a, sun: V(-0.5, 0.5, -0.3) }); S.position.y = -0.3; g.add(S); this.spSea = S;
    const cm = new THREE.Group(); const o = copy(M.apollo_csm, envMap('dawn'), 0.6); cm.add(o); cm.position.set(-1.4, -0.9, -8); g.add(cm); this.cmS = cm;
    this.cmSclip = cmOnly(o);
    const k = new Kit(); for (const x of [-0.42, 0.42]) k.ball(0.32, 1, 0xe86a20, [x, 3.25, 0.15], 0, [1, 0.8, 1]); cm.add(Object.assign(k.mesh(FLAT), {}));   // the orange flotation balls
    this.beacon = glowSprite(0xffffff, 1.2, 0); this.beacon.position.set(-1.4, 3.6, -8); g.add(this.beacon);
    // the recovery helicopter's searchlight sweeping toward you, high up
    this.heli = glowSprite(0xfff4d0, 3, 0.9); this.heli.position.set(40, 30, -90); g.add(this.heli);
    this.heliBlink = glowSprite(0xff2020, 0.8, 1); g.add(this.heliBlink);
    // the telegram
    this.telegram = picture(0.9, 0.55, (c, w, h) => { c.fillStyle = '#f0e8c8'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8c040'; c.fillRect(0, 0, w, 62); c.fillStyle = '#1a1a1a'; c.font = 'bold 40px sans-serif'; c.fillText('WESTERN UNION', 24, 45); c.font = 'bold 22px sans-serif'; c.textAlign = 'right'; c.fillText('TELEGRAM', w - 24, 42); c.textAlign = 'left'; c.font = 'bold 34px monospace'; c.fillText('COL FRANK BORMAN', 30, 118); c.fillText('HOUSTON TEX', 30, 158); c.font = 'bold 40px monospace'; c.fillText('THANK YOU APOLLO 8.', 30, 228); c.fillText('YOU SAVED 1968.', 30, 278); }, { frame: 0xd8d0b0, px: 512, basic: true });
    this.telegram.visible = false; this.root.add(this.telegram);
    this.addScene('splash', { group: g, bounds: 0.6, place: { lat: 8.1, year: 1968, sunLon: 274 }, amb: 0.4, fogFar: 3000, mist: 0.1,
      height: () => 0.3,
      sky: () => { this.G.sky.set(100, -6); this.G.sky.setMoon(250, 35, 1.0, 0.45); this.key.position.set(-40, 50, -20); this.key.target.position.set(-1.4, 0, -8); this.key.color.setHex(0xa8b8e0); this.key.intensity = 0.9; },
      exit: () => { this.key.color.setHex(0xffffff); this.lamp2.color.setHex(0xfff0dc); },
      update: (dt, t) => {
        this.spSea.userData.update?.(t);
        cm.position.y = -0.9 + Math.sin(t * 0.9) * 0.25; cm.rotation.set(Math.sin(t * 0.7) * 0.08, 0.4, Math.cos(t * 0.8) * 0.08); this.cmSclip();
        this.beacon.position.set(-1.4, cm.position.y + 4.0, -8); this.beacon.material.opacity = (t % 1.2) < 0.12 ? 1 : 0;
        this.heli.position.set(40 - (t % 60) * 0.4, 30, -90 + (t % 60) * 0.6); this.heliBlink.position.copy(this.heli.position).add(V(0, 1, 0)); this.heliBlink.material.opacity = Math.sin(t * 5) > 0.6 ? 1 : 0;
        this.lamp.position.set(-1.4, cm.position.y + 4.0, -7.5); this.lamp.intensity = this.beacon.material.opacity * 3; this.lamp.distance = 8;
        this.lamp2.position.set(3, 7, -3); this.lamp2.color.setHex(0xd8e0ff); this.lamp2.intensity = 7; this.lamp2.distance = 18;
      } });
  }

  beds() { return [
    { kind: 'room', vol: 0.06, on: (ch) => ch.cur === 'plan' || ch.cur === 'home' },
    { kind: 'room', vol: 0.1, on: (ch) => ch.cur === 'mcc' },
    { kind: 'leaves', at: V(0, 120, 0), vol: 0.08, ref: 40, wide: true, on: (ch) => ch.cur === 'arm' || ch.cur === 'stadium' },
    { kind: 'vent', at: V(0, 1.6, 0), vol: 0.06, ref: 3, on: (ch) => ch.cur === 'cabin' },
    { kind: 'surf', at: V(0, 0, -10), vol: 0.2, ref: 10, wide: true, on: (ch) => ch.cur === 'splash' },
  ]; }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. Houston, August 1968
    await this.go(D, 'plan', 0, 0.1, { x: 0, z: 2.6 });
    s.guide = [-2.6, 2.2, 0.6];
    await D.say('ch21_01');
    const l2 = D.sayAsync('ch21_02');
    await D.cue('bold'); s.traj = 1;
    await l2;
    await D.wait(fast ? 0.3 : 2.5);
    // 2. On the access arm
    s.walk = 0; this.inT = 0;
    await this.go(D, 'arm', yawTo(180), 1.2, { x: 0.9, z: -10.5 });
    s.guide = [3.2, ARM_Y + 2.2, -12];
    s.walk = 1;
    await D.say('ch21_03');
    await D.wait(fast ? 0.3 : 1.5);
    // 3. The launch, from inside
    s.space = 0; s.lunar = 0; s.launch = 0; this.missionClock = 0;
    await this.go(D, 'cabin', 0, 1.0, { x: 0, z: 0 });
    s.guide = this.C.group.localToWorld(V(-1.2, 1.9, -1.3)).toArray();
    s.launch = 1; cabinRumble(G, fast ? 8 : 26, 0.9); s.rumble = 0.008;
    await D.wait(fast ? 0.5 : 4);
    const l4 = D.sayAsync('ch21_04');
    await D.cue('jolt'); this.jolt();
    await D.cue('flash'); this.jolt();
    await l4;
    await D.wait(fast ? 0.3 : 3); this.jolt(); s.rumble = 0.003;
    await D.wait(fast ? 0.3 : 3);
    s.rumble = 0; s.space = 1; whoosh(G, 2, 0.1);
    await D.wait(fast ? 0.3 : 2.5);
    quindar(G); await D.say('ch21_05'); quindar(G, false);
    const l6 = D.sayAsync('ch21_06');
    await D.cue('engine fires'); cabinRumble(G, fast ? 3 : 8, 0.5); s.rumble = 0.004;
    await l6; s.rumble = 0;
    // 4. Leaving Earth
    s.out = 0; this.outK = 0;
    await this.go(D, 'outbound', yawTo(180), 1.2, { x: 0, z: 0 });
    s.guide = [-2.5, 2.4, 3.5]; s.out = 1;
    await D.say('ch21_07');
    await D.wait(fast ? 0.5 : 5);
    // 5. Christmas Eve: radio silence
    s.wait = 1; s.cheer = 0;
    await this.go(D, 'mcc', 0, 1.2, { x: -1.0, z: 7.4 });
    s.guide = [-4.5, 3.4, 2];
    await D.say('ch21_08');
    await D.wait(fast ? 0.5 : 4);
    staticBurst(G, 0.5, 0.12); s.wait = 0;
    // 6. In orbit round the Moon
    s.turn = 0; s.rise = 0; s.tei = 0; s.burn = 0; this.riseK = 0;
    await this.go(D, 'orbit', 0, 1.4, { x: 0, z: 0 });
    s.guide = [-3.6, 2.6, -4.6];
    await D.say('ch21_09');
    const l10 = D.sayAsync('ch21_10');   // the music begins here
    await D.cue('turns'); s.turn = 1;
    await D.cue('something rises'); s.rise = 1;
    await l10;
    await D.wait(fast ? 0.5 : 3);
    await D.say('ch21_11');
    await D.say('ch21_12');
    if (!D.kids) {
      s.lunar = 1; s.space = 1; s.launch = 0; this.missionClock = 0;
      await this.go(D, 'cabin', 0, 1.0, { x: 0, z: 0 });
      s.guide = this.C.group.localToWorld(V(-1.2, 1.9, -1.3)).toArray();
      await D.say('ch21_13');
      await this.ask(D, 'photo', { hint: this.camIt.hint, deskHint: this.camIt.deskHint, after: 1, timeout: 18 });
    } else await D.wait(fast ? 0.3 : 2);
    click(G, null, 0.4); this.flash.material.opacity = 0.6;
    await D.wait(fast ? 0.3 : 1);
    this.showCard(true);
    await D.say('ch21_14');
    await D.wait(fast ? 0.3 : 2);
    this.showCard(false);
    // 7. Christmas Eve at home
    await this.go(D, 'home', yawTo(310), 1.2, { x: 2.0, z: 0.6 });
    s.guide = [-1.4, 2.0, 1.6];
    await D.say('ch21_15');
    await D.say('ch21_16');
    await D.say('ch21_17');
    await D.wait(fast ? 0.3 : 2.5);
    // 8. Christmas Day: the burn home
    s.tei = 1; s.burn = 0; this.burnK = 0; s.turn = 0;
    await this.go(D, 'orbit', 0, 1.2, { x: 0, z: 0 });
    s.guide = [-3.6, 2.6, -4.6];
    const l18 = D.sayAsync('ch21_18');
    await D.cue('engine fires'); s.burn = 1; rumble(G, 6, 0.3);
    await l18;
    s.burn = 0;
    s.cheer = 0; s.wait = 0;
    await this.go(D, 'mcc', 0, 1.0, { x: -1.0, z: 7.4 });
    s.guide = [-4.5, 3.4, 2];
    staticBurst(G, 0.3, 0.1);
    await D.say('ch21_19');
    s.cheer = 1; applause(G, null, 3, 0.25);
    await D.wait(fast ? 0.3 : 2.5); s.cheer = 0;
    // 9. Kennedy's words, the fireball, splashdown
    s.film = 1;
    await this.go(D, 'stadium', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-6, 4.5, -4]; s.kennedy = 1;
    await D.say('ch21_20');
    s.kennedy = 0; s.film = 0;
    await this.go(D, 'reentry', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-3, 2.2, -3]; whoosh(G, 6, 0.4); rumble(G, 6, 0.4); s.rumble = 0.006;
    await D.wait(fast ? 0.8 : 6);
    s.rumble = 0;
    await this.go(D, 'splash', yawTo(345), 1.4, { x: 0, z: 0 });
    s.guide = [2.6, 2.0, -5];
    const l21 = D.sayAsync('ch21_21');
    await D.cue('telegram'); this.showTelegram();
    await l21;
    await D.wait(fast ? 0.5 : 5);
    this.telegram.visible = false;
  }
  showTelegram() {
    const c = this.telegram, cam = this.G.camera.getWorldPosition(new THREE.Vector3()), d = this.G.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    c.position.copy(cam).addScaledVector(d, 1.3).add(V(0.25, -0.25, 0)); c.lookAt(cam.x, c.position.y, cam.z); c.visible = true;
  }
  update(dt, t) {
    super.update(dt, t);
    // the photograph grows to full size in front of you
    if (this.card.visible) { this.cardK = Math.min(1, (this.cardK || 0) + dt * 1.2); this.card.scale.setScalar(0.2 + 0.8 * ease(this.cardK)); }
    if (this.cur === 'arm' && this.s.walk) this.inT = (this.inT || 0) + dt;
  }
  dispose() { for (const S of [this.SPc, this.SPo, this.SPm, this.SPr]) S?.dispose(); this.card?.parent?.remove(this.card); super.dispose(); }
}

// ---------- Pictures ----------
// The blackboard: the Earth, the Moon, and the free-return path round the Moon in chalk (k = how much is drawn)
function drawBoard(c, w, h, k) {
  c.fillStyle = '#2a3a2e'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(240,240,230,0.9)'; c.fillStyle = 'rgba(240,240,230,0.9)'; c.lineWidth = 3;
  c.beginPath(); c.arc(160, 160, 50, 0, 7); c.stroke(); c.beginPath(); c.arc(740, 150, 26, 0, 7); c.stroke();
  c.font = '22px serif'; c.fillText('EARTH', 120, 240); c.fillText('MOON', 712, 210); c.fillText('APOLLO 8  C PRIME', 330, 40); c.fillText('NO LM', 420, 280);
  const pts = []; for (let i = 0; i <= 200; i++) { const u = i / 200, a = u * Math.PI * 2; pts.push([450 + Math.sin(a) * 330, 155 + Math.sin(2 * a) * 70]); }
  const n = Math.floor(200 * k); if (n > 1) { c.setLineDash([10, 6]); c.beginPath(); pts.slice(0, n).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.setLineDash([]); const [x, y] = pts[n - 1]; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); }
}
// Mission Control's big screen: the Moon with the ship's orbit (hidden behind it during the silence)
function drawLunarMap(c, w, h, t, silent) {
  c.fillStyle = '#0a1a2e'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#6a6a70'; c.beginPath(); c.arc(w / 2, h / 2, 120, 0, 7); c.fill(); c.fillStyle = '#4a4a52'; for (const [x, y, r] of [[-30, -30, 30], [40, 10, 24], [-50, 40, 18], [20, -60, 14]]) { c.beginPath(); c.arc(w / 2 + x, h / 2 + y, r, 0, 7); c.fill(); }
  c.strokeStyle = '#f0e060'; c.lineWidth = 2; c.setLineDash([8, 6]); c.beginPath(); c.ellipse(w / 2, h / 2, 160, 150, 0, 0, 7); c.stroke(); c.setLineDash([]);
  const a = (t * 0.25) % (Math.PI * 2), px = w / 2 + Math.cos(a) * 160, py = h / 2 + Math.sin(a) * 150, behind = Math.sin(a) < -0.3;
  if (!(silent && behind) && !silent) { c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill(); }
  c.fillStyle = '#f0e060'; c.font = 'bold 26px monospace'; c.fillText('APOLLO 8', 20, 34);
  if (silent) { c.fillStyle = '#ff6040'; c.fillText('LOSS OF SIGNAL', w - 290, 34); }
}
// The TV picture of the Moon's grey surface sliding by
function drawMoonTV(c, w, h, t) {
  c.fillStyle = '#8a8a8a'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.beginPath(); c.ellipse(w / 2, -h * 1.6, w * 1.6, h * 2.2, 0, 0, 7); c.fill();
  const r = rng(3); for (let i = 0; i < 60; i++) { const x = ((r() * w * 2 - t * 18) % (w * 2) + w * 2) % (w * 2) - w * 0.5, y = h * 0.62 + r() * h * 0.38, rad = 3 + r() * 16; c.fillStyle = 'rgba(40,40,40,0.5)'; c.beginPath(); c.ellipse(x, y, rad, rad * 0.4, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(220,220,220,0.4)'; c.beginPath(); c.ellipse(x + rad * 0.3, y - rad * 0.12, rad * 0.8, rad * 0.25, 0, 3.4, 6); c.fill(); }
}
// The Earthrise photograph: the black sky, the half-lit blue Earth, the grey horizon below
function drawEarthrise(c, w, h) {
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  const ex = w * 0.48, ey = h * 0.32, er = w * 0.12;
  const gr = c.createLinearGradient(ex - er, ey, ex + er, ey); gr.addColorStop(0, '#2a5aa8'); gr.addColorStop(0.55, '#4a7ac0'); gr.addColorStop(0.62, '#0a1428'); gr.addColorStop(1, '#000');
  c.save(); c.beginPath(); c.arc(ex, ey, er, 0, 7); c.clip(); c.fillStyle = gr; c.fillRect(ex - er, ey - er, er * 2, er * 2);
  const r = rng(21); for (let i = 0; i < 26; i++) { const x = ex - er + r() * er * 1.2, y = ey - er + r() * er * 2; c.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.5})`; c.beginPath(); c.ellipse(x, y, er * (0.08 + r() * 0.18), er * 0.04, r() * 3, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(150,120,80,0.5)'; c.beginPath(); c.ellipse(ex - er * 0.3, ey + er * 0.2, er * 0.2, er * 0.3, 0.3, 0, 7); c.fill(); c.restore();
  const mg = c.createLinearGradient(0, h * 0.62, 0, h); mg.addColorStop(0, '#8a8478'); mg.addColorStop(1, '#3a3630');
  c.fillStyle = mg; c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.72); c.quadraticCurveTo(w * 0.5, h * 0.58, w, h * 0.7); c.lineTo(w, h); c.fill();
  for (let i = 0; i < 70; i++) { const x = r() * w, y = h * 0.7 + r() * h * 0.3, rad = 2 + r() * 14; c.fillStyle = 'rgba(30,28,24,0.45)'; c.beginPath(); c.ellipse(x, y, rad, rad * 0.35, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(220,214,200,0.35)'; c.beginPath(); c.ellipse(x - rad * 0.3, y - rad * 0.1, rad * 0.7, rad * 0.2, 0, 0, 3.2); c.fill(); }
}
