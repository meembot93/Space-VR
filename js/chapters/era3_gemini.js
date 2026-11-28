// Era 3, Chapter 5 (n 19): Gemini. Learning to walk, meet and dock in space, 1965-66.
//
// 1. Flashback, in the look of old film: Rice Stadium, "We set sail on this new sea". Then the
//    stadium at dusk, empty, the flags lowered: Kennedy didn't live to see it.
// 2. Houston, the new Mission Control: glowing consoles, the world map, Gene Kranz in his vest.
// 3. Ed White outside Gemini 4 with his gas gun, over the Earth: "the saddest moment of my life".
// 4. Gemini 6 on the pad: the engines light and shut down after one second; inside, Schirra keeps
//    his hand off the ejection handle.
// 5. In Gemini 6, chasing Gemini 7: Adults nudge the hand controller the last few metres.
// 6. Outside: the two ships side by side over the blue Earth (music, the wow), the BEAT ARMY sign,
//    "an object... going north to south", and Jingle Bells on a harmonica and little bells.
// 7. Gemini 8 docked to the Agena, then the stuck thruster: the ships tumbling (you watch from
//    outside: you stay still), Armstrong stops the spin. Inside: "Remember his calm."
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo, bearing } from '../era3/base.js';
import { person, makeFolk, sit, wear } from '../era3/folk.js';
import { loadAll, copy, Rocket } from '../era3/craft.js';
import { cabin, panelLamp, dressCabin } from '../era3/cabin.js';
import { Puffs, envMap, staticBurst, breath, beep, tune, JINGLE, hiss, bang, masterAlarm } from '../era3/fx.js';
import { earthSpace, groundPlane, sea, spaceSun } from '../era3/worlds.js';
import { surfMat, quad, chair, lattice, floodTower } from '../era3/sets.js';
import { riceStadium } from '../era3/places.js';
import { holdProp } from '../people.js';
import { glowSprite, glowPoints, whoosh } from '../wow/fx.js';
import { canvasTex, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { grove } from '../trees.js';

const M = await loadAll(['craft/gemini', 'craft/titan2_glv', 'craft/agena', 'craft/mission_control', 'props/helmet_gemini']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const TITAN_AT = V(0, 0, -75);   // Gemini 6's Titan on its pad

export default class Gemini extends Chapter3 {
  constructor(G) {
    super(G, 19);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { kennedy: 0, riceDusk: 0, gun: 0, inside: 0, abort: 0, chase: 0, nudge: 0, sign: 0, docked: 1, spin: 0, undock: 0, calm: 0 });
    riceStadium(this, 'stadium');
    this.buildMCC(); this.buildEVA(); this.buildPad(); this.buildCabin(); this.buildFormation(); this.buildG8();
    Object.assign(G.narration.radio, { ch19_07: 'nasa', ch19_13: 'nasa', ch19_17: 'nasa' });
  }

  // ---------- 2. Mission Control, Houston ----------
  buildMCC() {
    const g = new THREE.Group();
    const mc = copy(M.mission_control, envMap('room'), 0.6); g.add(mc);
    // the controllers at their consoles (headsets on), and Gene Kranz in his white vest
    this.ctl = [];
    const seats = [[-4.5, 3.8], [-1.5, 3.8], [1.5, 3.8], [4.5, 3.8], [-3.0, 1.8], [0.0, 1.8], [3.0, 1.8]];   // in the console rows' chairs
    seats.forEach(([x, z], i) => { const P = makeFolk({ kind: 'shirt', coat: [0xeeeee8, 0xd8e0e8, 0xe8e4dc][i % 3], tie: [0x2a2a4a, 0x5a2a2a, 0x2a4a2a][i % 3], glasses: i % 3 === 1, headset: true, seed: 600 + i }); P.g.position.set(x, 0, z); P.g.rotation.y = Math.PI; sit(P); P.look = V(x * 0.3, 2.2, -9); g.add(P.g); this.ctl.push(P); });
    this.kranz = person(g, 'kranz', V(0.9, 0, 5.6), Math.PI); this.kranz.look = V(0, 3, -9);
    this.people.push(...this.ctl, this.kranz);
    // the big world map at the front, with the ship's track crawling across it
    const mapTex = canvasTex(1024, 384, (c, w, h) => drawMap(c, w, h, 0));
    this.map = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: mapTex, toneMapped: false })); this.map.position.set(0, 3.2, -9.9); g.add(this.map); this.mapTex = mapTex;
    this.addScene('mcc', { group: g, bounds: 1.2, indoors: true, place: { lat: 29.6, year: 1965, sunLon: 80 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(200, -20); this.G.sky.hemi.intensity = 0.9; this.lamp.position.set(0, 5, 4); this.lamp.intensity = 4.0; this.lamp.distance = 22; this.lamp2.position.set(0, 3.5, -8); this.lamp2.color.setHex(0x9ac8ff); this.lamp2.intensity = 1.2; this.lamp2.distance = 12; },
      exit: () => { this.lamp2.color.setHex(0xfff0dc); },
      update: (dt, t) => { this.mapAcc = (this.mapAcc || 0) + dt; if (this.mapAcc > 0.25) { this.mapAcc = 0; drawMap(this.mapTex.image.getContext('2d'), 1024, 384, t); this.mapTex.needsUpdate = true; } } });
  }

  // ---------- 3. Ed White's spacewalk ----------
  buildEVA() {
    const g = new THREE.Group();
    const ship = new THREE.Group(); ship.position.set(1.4, 0.4, -6.5); ship.rotation.set(0.2, 0.5, Math.PI / 2 - 0.15); g.add(ship); this.g4 = ship;
    ship.add(copy(M.gemini, envMap('space'), 1.1));
    this.white = person(g, 'ed_white', V(-0.8, 0.6, -4.4), 0.4); wear(this.white, copy(M.helmet_gemini), { lift: -0.05, size: 1 }); this.people.push(this.white);
    // the gas gun in his right hand: a little two-pronged pistol, puffing
    const gk = new Kit(); gk.box(0.05, 0.12, 0.05, 0xc8c8c0, [0, 0, 0]); gk.box(0.24, 0.03, 0.03, 0xd8a040, [0, 0.05, 0.08], [0, Math.PI / 2, 0]); for (const s of [-1, 1]) gk.cyl(0.008, 0.008, 0.08, 4, 0x8a8a8a, [s * 0.11, 0.05, 0.12], [Math.PI / 2, 0, 0]);
    const gun = new THREE.Group(); gun.add(gk.mesh(FLAT)); this.gun = gun;
    holdProp(this.white, gun, 'Right');
    this.puff = glowSprite(0xffffff, 0.5, 0); gun.add(this.puff); this.puff.position.set(0, 0.06, 0.25);
    this.umb = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0, 1)]), 20, 0.03, 5), new THREE.MeshLambertMaterial({ color: 0xd8c060 })); g.add(this.umb);
    const SP = this.SP = earthSpace(this.G, { earthR: 400 }); SP.earth.position.set(40, -500, -260); SP.earth.rotation.set(0.4, 0.8, 0.2);
    SP.sunDir.set(-0.5, 0.5, 0.5).normalize();
    this.sun = spaceSun(60); SP.group.add(this.sun);
    this.addScene('eva', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s, W = this.white;
        SP.earth.rotation.y += dt * 0.01; SP.atmoU.sun.value.copy(SP.sunDir); this.sun.position.copy(SP.sunDir).multiplyScalar(2600).add(V(0, 1.6, 0));
        this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = 2.2;
        // he drifts and turns, a slow somersault; with the gun he scoots, then drifts back toward the hatch
        const back = s.inside ? clamp01((this.backT = (this.backT || 0) + dt * 0.25 * this.F)) : 0;
        W.g.position.set(-1.7 + Math.sin(t * 0.2) * 0.6 + (s.gun ? 0.6 : 0), 1.5 + Math.sin(t * 0.27) * 0.3, -3.6 + Math.cos(t * 0.17) * 0.4).lerp(V(0.6, 0.9, -5.6), back);
        W.g.rotation.set(Math.sin(t * 0.15) * 0.5, 0.4 + t * 0.06, Math.sin(t * 0.12) * 0.35);
        W.pose = s.gun ? 'point' : 'wave';
        this.puff.material.opacity = s.gun && Math.sin(t * 2.2) > 0.7 ? 0.8 : damp(this.puff.material.opacity, 0, 6, dt);
        const hatch = V(1.0, 1.3, -6.1), w = W.g.position.clone().add(V(0, 1.0, 0)), mid = hatch.clone().lerp(w, 0.5).add(V(0.5, -0.8, 0.4));
        this.umb.geometry.dispose(); this.umb.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([hatch, mid, w]), 24, 0.03, 5);
      } });
  }

  // ---------- 4. Gemini 6 on the pad: the one-second shutdown ----------
  buildPad() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(111);
    g.add(groundPlane({ size: 4000, seg: 140, h: (x, z) => (x > 600 ? -2 : (N(x / 60, z / 60) - 0.5) * 0.6 * clamp01((Math.hypot(x, z) - 20) / 60)), color: (x, z, c) => { const m = N(x / 8, z / 8); if (x > 560) c.setRGB(0.72, 0.66, 0.52); else c.setRGB(0.36 + m * 0.1, 0.38 + m * 0.1, 0.25); } }));
    const S = sea({ size: 8000, col: 0x2a5a7a, sky: 0x9ab8d8, sun: V(0.3, 0.4, 0.8) }); S.position.set(4600, -1.2, 0); g.add(S); this.padSea = S;
    k.box(50, 0.3, 40, 0xa8a49c, [TITAN_AT.x, 0.15, TITAN_AT.z]);
    k.box(8, 3.5, 8, 0x7a7e80, [TITAN_AT.x, 1.75, TITAN_AT.z]); k.box(5, 1.0, 5, 0x3a3a3a, [TITAN_AT.x, 3.0, TITAN_AT.z]);
    // the erector, lowered flat beside the pad, and the umbilical tower
    lattice(k, TITAN_AT.x + 14, TITAN_AT.z, 26, 3.2, 3.2, { step: 3.2, col: 0xc8c4b8 });
    lattice(k, TITAN_AT.x - 6, TITAN_AT.z, 2.2, 2.2, 30, { step: 3, col: 0xb84a2a });
    for (const [x, z] of [[-40, -30], [40, -30], [0, 40]]) floodTower(k, TITAN_AT.x + x, TITAN_AT.z + z, Math.atan2(-x, -z), 20);
    g.add(k.mesh(FLAT));
    this.puffs = new Puffs(800); g.add(this.puffs.mesh);
    this.titan = new Rocket(g, { parts: [{ M: M.titan2_glv, y: 2.5 }], engines: [{ x: -0.7, z: 0, y: 0.2, len: 6, width: 1.0, kind: 'hyper' }, { x: 0.7, z: 0, y: 0.2, len: 6, width: 1.0, kind: 'hyper' }], size: 0.7, hold: 99, accel: 8, env: envMap('day'), trench: 0, glowEnd: 30, trailEnd: 30 });
    this.titan.place(TITAN_AT.x, 3.5, TITAN_AT.z);
    this.addScene('pad', { group: g, bounds: 1.2, place: { lat: 28.5, year: 1965, sunLon: 260 }, amb: 0.4, fogFar: 3000, mist: 0.03,
      sky: () => { this.G.sky.set(150, 32); this.key.position.copy(TITAN_AT).add(V(40, 60, 60)); this.key.target.position.copy(TITAN_AT); this.key.intensity = 1.0; },
      update: (dt, t) => { this.padSea.userData.update?.(t); this.titan.update(dt, t, this.F); this.puffs.update(this.G, dt * this.F, [2, 0, 1], this.titan.flash || 0); } });
  }

  // ---------- 4-5, 7. Inside a Gemini ----------
  buildCabin() {
    const g = new THREE.Group();
    const C = this.C = cabin('gemini'); g.add(C.group);
    dressCabin(C);
    this.clock = panelLamp(0.09, 0.03, { text: '000:00:00', col: '#200800', mono: true }); C.overlay('timer', this.clock);
    // your crewmate in the right seat (Schirra, then Armstrong), sitting so his head is level with yours
    const sp = C.crew[0];
    this.schirra = person(C.group, 'schirra', sp.pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.schirra); wear(this.schirra, copy(M.helmet_gemini), { lift: -0.05, size: 1 });
    this.armstrong = person(C.group, 'armstrong', sp.pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.armstrong); wear(this.armstrong, copy(M.helmet_gemini), { lift: -0.05, size: 1 }); this.armstrong.g.visible = false;
    this.people.push(this.schirra, this.armstrong);
    // the ejection D-ring between your knees: yellow and black
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), new THREE.MeshLambertMaterial({ map: canvasTex(64, 8, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#1a1a1a' : '#e8c020'; c.fillRect(i * 8, 0, 8, h); } }) })); ring.position.set(0, 1.0, -0.42); ring.rotation.x = 0.6; C.group.add(ring);
    // Gemini 7, out of your window as you close in on it (and the Earth below)
    this.g7 = copy(M.gemini, envMap('space'), 1.1); C.group.add(this.g7); this.g7.visible = false;
    this.winDir = C.dirOf('left');
    const SP = this.SPc = earthSpace(this.G, { earthR: 400 });
    const ax = V(0, 1, 0).cross(this.winDir).normalize();
    SP.earth.position.copy(this.winDir).applyAxisAngle(ax, -60 * D2R).multiplyScalar(470).add(V(0, 1.6, 0)); SP.earth.rotation.set(0.4, 2.2, 0.1);
    SP.sunDir.set(0.4, 0.6, 0.4).normalize();
    this.hcIt = this.touchable('nudge', () => (C.handController ? C.handController.getWorldPosition(_a) : C.group.localToWorld(V(0.32, 0.98, -0.32))), { hint: 'Nudge the hand controller by your right knee, gently (TRIGGER)', deskHint: 'Click the hand controller by your right knee', r: 0.15 });
    this.addScene('cabin', { group: g, bounds: 0.25, space: null, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); },
      exit: () => { this.SPc.exit(); },
      sky: () => { if (!this.s.orbit) this.G.sky.set(140, 30); },
      update: (dt, t) => {
        const s = this.s;
        if (s.orbit && !SP.on) SP.enter(null); if (!s.orbit && SP.on) SP.exit();
        if (SP.on) { SP.update(dt); SP.earth.rotation.y += dt * 0.008; SP.atmoU.sun.value.copy(SP.sunDir); this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = 1.5; }
        // Gemini 7 slides closer: from 40 m to 2 m out of the left window; the nudge closes the last bit
        this.g7.visible = !!s.chase;
        if (s.chase) { this.chaseK = damp(this.chaseK || 0, s.nudge ? 1 : 0.75, 0.3 * this.F, dt); const d = lerp(40, 2.4, ease(this.chaseK)); this.g7.position.copy(this.winDir).multiplyScalar(d).add(V(0, 1.6, 0)).add(V(-0.6, 0, 0)); this.g7.rotation.set(Math.PI / 2, 0.3, 0.2); }
        this.missionClock = (this.missionClock || 0) + dt * this.F; const T = this.missionClock + (s.orbit ? 5 * 3600 + 18 * 60 : 0), hh = Math.floor(T / 3600), mm = Math.floor(T / 60) % 60, ss = Math.floor(T % 60);
        this.clock.userData.set(`${String(hh).padStart(3, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, '#200800', true);
        C.lights(true, s.shaking ? 0.85 + 0.15 * Math.sin(t * 29) : 1);
        if (C.handController) C.handController.rotation.x = damp(C.handController.rotation.x, s.nudge && this.chaseK < 0.98 ? 0.25 : 0, 8, dt);
      } });
  }

  // ---------- 6. Side by side: Gemini 6 and 7 ----------
  buildFormation() {
    const g = new THREE.Group();
    const a = copy(M.gemini, envMap('space'), 1.1), b = copy(M.gemini, envMap('space'), 1.1);
    const g6 = new THREE.Group(), g7 = new THREE.Group(); g6.add(a); g7.add(b); g.add(g6, g7);
    g6.position.set(-2.2, 0.4, -8.5); g6.rotation.set(Math.PI / 2, 0, 0.12);    // noses toward you, lying along z
    g7.position.set(1.6, 0.8, -9.0); g7.rotation.set(Math.PI / 2, 0, -0.1);
    this.g6f = g6; this.g7f = g7;
    // the BEAT ARMY sign held up in Gemini 6's window
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.18), new THREE.MeshBasicMaterial({ map: canvasTex(256, 110, (c, w, h) => { c.fillStyle = '#f4f0e4'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a2a6a'; c.font = 'bold 48px sans-serif'; c.textAlign = 'center'; c.fillText('BEAT', w / 2, 48); c.fillText('ARMY', w / 2, 98); }), transparent: true, opacity: 0, toneMapped: false }));
    this.sign.position.set(-1.6, 1.05, -5.2); this.sign.rotation.y = 0.35; g.add(this.sign);
    const SP = this.SP2 = earthSpace(this.G, { earthR: 400 }); SP.earth.position.set(-30, -480, -320); SP.earth.rotation.set(0.5, 3.0, 0.2);
    SP.sunDir.set(0.4, 0.45, 0.6).normalize(); this.sun2 = spaceSun(60); SP.group.add(this.sun2);
    // little thruster puffs as they keep station
    this.jets = [glowSprite(0xffffff, 0.4, 0), glowSprite(0xffffff, 0.4, 0)]; g6.add(this.jets[0]); g7.add(this.jets[1]); this.jets.forEach((j) => j.position.set(1.1, 2.0, 0));
    this.addScene('formation', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        SP.earth.rotation.y += dt * 0.01; SP.atmoU.sun.value.copy(SP.sunDir); this.sun2.position.copy(SP.sunDir).multiplyScalar(2600).add(V(0, 1.6, 0));
        this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = 2.2;
        g6.position.y = 0.6 + Math.sin(t * 0.3) * 0.08; g7.position.y = 0.9 + Math.sin(t * 0.27 + 1) * 0.08;
        this.jets.forEach((j, i) => { j.material.opacity = Math.sin(t * 1.3 + i * 2) > 0.95 ? 0.7 : damp(j.material.opacity, 0, 8, dt); });
        this.sign.material.opacity = damp(this.sign.material.opacity, this.s.sign ? 1 : 0, 2, dt);
      } });
  }

  // ---------- 7. Gemini 8 and the Agena ----------
  buildG8() {
    const g = new THREE.Group();
    const stack = this.stack = new THREE.Group(); stack.position.set(0, 1.0, -9); g.add(stack);
    const gm = new THREE.Group(); gm.add(copy(M.gemini, envMap('space'), 1.1)); gm.rotation.z = -Math.PI / 2; gm.position.x = -6.8; stack.add(gm); this.g8 = gm;
    const ag = new THREE.Group(); ag.add(copy(M.agena, envMap('space'), 1.1)); ag.rotation.z = Math.PI / 2; ag.position.x = -6.8 + 5.62 + 7.98; stack.add(ag); this.agena = ag;
    this.stuck = glowSprite(0xffffff, 0.8, 0); this.stuck.position.set(0.9, 1.6, 1.0); gm.add(this.stuck);
    const SP = this.SP3 = earthSpace(this.G, { earthR: 400 }); SP.earth.position.set(60, -470, -300); SP.earth.rotation.set(0.3, 1.4, 0.2);
    SP.sunDir.set(-0.3, 0.5, 0.6).normalize(); this.sun3 = spaceSun(60); SP.group.add(this.sun3);
    this.addScene('g8', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s;
        SP.earth.rotation.y += dt * 0.01; SP.atmoU.sun.value.copy(SP.sunDir); this.sun3.position.copy(SP.sunDir).multiplyScalar(2600).add(V(0, 1.6, 0));
        this.key.position.copy(SP.sunDir).multiplyScalar(50); this.key.intensity = 2.2;
        // the spin: slow and growing while docked; after they let go, the Gemini alone spins up fast
        this.spinW = damp(this.spinW || 0, s.spin === 1 ? 0.8 : s.spin === 2 ? 5.0 : 0, s.spin === 3 ? 0.6 : 0.35, dt);
        if (!s.undock) { stack.rotateOnAxis(V(0.3, 1, 0.5).normalize(), this.spinW * dt * 0.5); }
        else {
          this.agena.position.x += dt * 0.25;   // the Agena drifts off
          if (!this.g8f) { this.g8f = true; stack.updateMatrixWorld(); const wp = gm.getWorldPosition(new THREE.Vector3()), wq = gm.getWorldQuaternion(new THREE.Quaternion()); g.add(gm); gm.position.copy(g.worldToLocal(wp)); gm.quaternion.copy(wq).premultiply(g.getWorldQuaternion(_q).invert()); gm.position.set(-2.6, 1.3, -6.5); }
          gm.rotateOnAxis(V(1, 0.35, 0.2).normalize(), this.spinW * dt);
        }
        this.stuck.material.opacity = s.spin && s.spin < 3 ? (Math.sin(t * 30) > 0 ? 0.9 : 0.4) : damp(this.stuck.material.opacity, 0, 4, dt);
      } });
  }

  beds() { return [
    { kind: 'leaves', at: V(0, 4, -30), vol: 0.05, ref: 40, wide: true, on: (ch) => ch.cur === 'stadium' },
    { kind: 'room', vol: 0.1, on: (ch) => ch.cur === 'mcc' },
    { kind: 'surf', at: V(500, 0, 0), vol: 0.07, ref: 60, wide: true, on: (ch) => ch.cur === 'pad' },
    { kind: 'vent', at: V(0, 1.6, 0), vol: 0.06, ref: 3, on: (ch) => ch.cur === 'cabin' },
  ]; }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. The flashback: Rice Stadium
    s.film = 1;
    await this.go(D, 'stadium', 0, 0.1, { x: 0, z: 0 });
    s.guide = [-6, 4.5, -4]; s.kennedy = 1;
    await D.say('ch19_01');
    s.kennedy = 0; s.applause = 1; await D.wait(fast ? 0.3 : 1.5); s.applause = 0;
    s.film = 0; s.riceDusk = 1;
    await D.wait(fast ? 0.3 : 2);
    await D.say(this.pick(D, 'ch19_02', 'ch19_03'));
    await D.wait(fast ? 0.3 : 1.5);
    // 2. Mission Control
    await this.go(D, 'mcc', 0, 1.2, { x: -1.0, z: 7.4 });
    s.guide = [-4.5, 3.4, 2]; this.kranz.look = this.G.camera.getWorldPosition(_b);
    await D.say('ch19_04');
    this.kranz.look = V(0, 3, -9);
    await D.say('ch19_05');
    // 3. Ed White
    await this.go(D, 'eva', 0, 1.2, { x: 0, z: 0 });
    s.guide = [-3.4, 2.4, -3];
    const l6 = D.sayAsync('ch19_06');
    await D.cue('steering'); s.gun = 1;
    await l6;
    s.gun = 0;
    breath(G, 0.06, 3.4);
    await D.say('ch19_07');
    s.inside = 1;
    await D.wait(fast ? 0.3 : 3);
    // 4. Gemini 6: the shutdown
    await this.go(D, 'pad', yawTo(bearing(TITAN_AT.x, TITAN_AT.z)), 1.2, { x: 0, z: 0 });
    s.guide = [-7, 3.5, -10];
    const l8 = D.sayAsync('ch19_08');
    await D.cue('The engines light'); this.titan.ignite(G, { listener: V(0, 1.6, 0), puffs: this.puffs, roarVol: 1.6, secs: 1.6 });
    await D.wait(fast ? 0.3 : 1.2); this.titan.reset();
    for (let i = 0; i < 40; i++) this.puffs.emit(TITAN_AT.x + (Math.random() - 0.5) * 6, 3, TITAN_AT.z + (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 2, 8, 6, 0xd8d4cc, 0.6, 0.4, 0);
    await l8;
    s.orbit = 0; s.chase = 0; this.schirra.g.visible = true; this.armstrong.g.visible = false;
    await this.go(D, 'cabin', 0, 1.0, { x: 0, z: 0 });
    s.guide = this.C.group.localToWorld(V(-1.3, 1.9, -1.2)).toArray(); this.missionClock = 0;
    masterAlarm(G, 1.2, 0.06);
    await D.say('ch19_09');
    // 5. The chase
    s.orbit = 1; s.chase = 1; this.chaseK = 0;
    await D.say('ch19_10');
    if (!D.kids) {
      await D.say('ch19_11');
      await this.ask(D, 'nudge', { hint: this.hcIt.hint, deskHint: this.hcIt.deskHint, after: 1, timeout: 18 });
    }
    s.nudge = 1; hiss(G, null, 0.08, 0.5);
    await D.wait(fast ? 0.5 : 4);
    // 6. Side by side: the wow
    await this.go(D, 'formation', 0, 1.2, { x: 0, z: 0 });
    s.guide = [3.6, 2.6, -3.6];
    const l12 = D.sayAsync('ch19_12');   // the music begins here
    await D.cue('a little sign'); s.sign = 1;
    await l12;
    staticBurst(G, 0.3, 0.1);
    await D.say('ch19_13');
    const l14 = D.sayAsync('ch19_14');
    await D.cue('a harmonica'); tune(G, JINGLE, { reed: true, vol: 0.1, step: 0.3, root: 523 });
    setTimeout(() => { for (let i = 0; i < 10; i++) setTimeout(() => beep(G, null, 0.03, 2600 + Math.random() * 400, 0.12), i * 300); }, 300);
    await l14;
    await D.wait(fast ? 0.3 : 5);
    // 7. Gemini 8
    s.spin = 0; s.undock = 0; this.spinW = 0;
    await this.go(D, 'g8', 0, 1.2, { x: 0, z: 0 });
    s.guide = [-4.0, 2.8, -4];
    await D.say('ch19_15');
    s.spin = 1;
    await D.say('ch19_16');
    s.spin = 2; s.undock = 1;
    staticBurst(G, 0.3, 0.12);
    await D.say('ch19_17');
    const l18 = D.sayAsync('ch19_18');
    await D.cue('used the landing'); s.spin = 3;
    await l18;
    // inside, with Armstrong: calm
    s.orbit = 1; s.chase = 0; this.schirra.g.visible = false; this.armstrong.g.visible = true;
    await this.go(D, 'cabin', 0, 1.0, { x: 0, z: 0 });
    this.armstrong.look = this.G.camera.getWorldPosition(new THREE.Vector3());
    s.guide = this.C.group.localToWorld(V(-1.3, 1.9, -1.2)).toArray();
    await D.say('ch19_19');
    await D.wait(fast ? 0.3 : 2.5);
  }

  dispose() { for (const S of [this.SP, this.SPc, this.SP2, this.SP3]) S?.dispose(); super.dispose(); }
}

// The big world map at the front of Mission Control: green continents on blue, the orbit's wavy
// track, and the little ship marker crawling along it
function drawMap(c, w, h, t) {
  c.fillStyle = '#0a2a4a'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(120,170,220,0.3)'; c.lineWidth = 1; for (let x = 0; x < w; x += w / 24) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += h / 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.fillStyle = '#2a6a4a';
  const blob = (pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h))); c.closePath(); c.fill(); };
  blob([[0.14, 0.2], [0.3, 0.16], [0.32, 0.3], [0.26, 0.46], [0.22, 0.52], [0.18, 0.4], [0.1, 0.3]]);          // North America
  blob([[0.26, 0.55], [0.32, 0.56], [0.34, 0.68], [0.3, 0.86], [0.27, 0.8], [0.25, 0.64]]);                    // South America
  blob([[0.46, 0.2], [0.56, 0.18], [0.56, 0.3], [0.5, 0.34], [0.46, 0.3]]);                                     // Europe
  blob([[0.46, 0.38], [0.58, 0.38], [0.6, 0.55], [0.55, 0.75], [0.5, 0.72], [0.45, 0.5]]);                      // Africa
  blob([[0.56, 0.16], [0.86, 0.14], [0.9, 0.3], [0.8, 0.44], [0.7, 0.46], [0.62, 0.36]]);                       // Asia
  blob([[0.8, 0.64], [0.9, 0.62], [0.92, 0.74], [0.84, 0.78]]);                                                 // Australia
  c.strokeStyle = '#f0e060'; c.lineWidth = 3; c.beginPath();
  for (let x = 0; x <= w; x += 4) { const y = h * (0.5 - 0.22 * Math.sin(x / w * Math.PI * 2 + 0.6)); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  const px = ((t * 8) % w), py = h * (0.5 - 0.22 * Math.sin(px / w * Math.PI * 2 + 0.6));
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(px, py, 7, 0, 7); c.fill();
  c.fillStyle = '#f0e060'; c.font = 'bold 18px monospace'; c.fillText('GEMINI', 12, 24);
}
