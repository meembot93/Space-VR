// Era 3, Apollo 11 part 7 (n 28): Leaving the Moon. 21 July 1969.
//
// 1. Back inside Eagle: the suits grey with dust ("like spent gunpowder"). A broken-off switch on the
//    floor: the one that arms the engine. Buzz pushes a felt-tip pen into the hole. It works.
// 2. Liftoff from the Moon, seen from out on the ground: the top half rises on its pale flame; the
//    blast blows the flag over.
// 3. Michael Collins, alone in Columbia behind the Moon (the music starts). "Not lonely. Just alone."
// 4. Far off, the Soviet robot Luna 15 comes down too fast and hits a mountain: a flash in the dark.
// 5. Eagle rising to meet Columbia, the Earth behind it: Collins's photograph of everyone alive.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo } from '../era3/base.js';
import { person, sit, wear } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { cabin, dressCabin } from '../era3/cabin.js';
import { envMap, flameMesh, cabinRumble, clank, click, beep, roar } from '../era3/fx.js';
import { earthSpace, moonGround, spaceSun } from '../era3/worlds.js';
import { holdProp } from '../people.js';
import { glowSprite, rumble, skyLevel } from '../wow/fx.js';
import { canvasTex, damp, lerp } from '../util.js';
import { rng } from '../shapes.js';

const M = await loadAll(['craft/apollo_csm', 'craft/lm_ascent', 'craft/lm_descent', 'craft/flag_1969', 'craft/laser_reflector', 'craft/seismometer', 'props/helmet_apollo']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);
const LM_DECK = 2.62, LM_Y = 0.35;
const SUN = V(1, 0.3, 0.2).normalize();
const FLAG = V(-3.5, 0, 9.5);

// the Moon seen from orbit: a cratered plain on a small sphere (as in Apollo 11 part 4)
function orbitGround(seed, R = 3000, H = 190) {
  const r = rng(seed), craters = [];
  for (let i = 0; i < 90; i++) { const rad = 15 + Math.pow(r(), 2.2) * 190; craters.push([(r() - 0.5) * 2900, (r() - 0.5) * 2900, rad, rad * (0.16 + r() * 0.08)]); }
  const MG = moonGround({ size: 3000, seg: 230, seed, craters, rocks: 0 });
  const p = MG.ground.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) * 1.6 - (x * x + z * z) / (2 * R)); }
  MG.ground.geometry.computeVertexNormals(); MG.ground.frustumCulled = false;
  const pivot = new THREE.Group(); pivot.position.y = 1.6 - H - R; MG.group.position.y = R; pivot.add(MG.group); pivot.rotation.x = -500 / R;
  pivot.userData.slide = (dt, speed = 14) => { pivot.rotation.x = Math.min(pivot.rotation.x + dt * speed / R, 0); };
  return pivot;
}

export default class A11Leaving extends Chapter3 {
  constructor(G) {
    super(G, 28);
    G.renderer.localClippingEnabled = true;
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { pen: 0, lift: 0, luna: 0, rise: 0 });
    this.buildCabin(); this.buildSite(); this.buildAlone(); this.buildLuna(); this.buildMeet();
  }

  // ---------- 1. Inside Eagle: dust, the broken switch, the pen ----------
  buildCabin() {
    const g = new THREE.Group();
    const C = this.C = cabin('lm'); g.add(C.group);
    dressCabin(C);
    // the crew, helmets off, suits streaked grey with dust
    this.neil = person(C.group, 'armstrong', C.crew[0].pos.clone(), 0.35); this.buzz = person(C.group, 'aldrin', C.crew[1].pos.clone(), -0.6);
    this.people.push(this.neil, this.buzz);
    const dust = canvasTex(256, 256, (c, w, h) => { c.clearRect(0, 0, w, h); const r = rng(3); for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(90,88,82,${0.15 + r() * 0.35})`; c.fillRect(r() * w, h * 0.45 + r() * h * 0.55, 1 + r() * 4, 1 + r() * 3); } });
    for (const P of [this.neil, this.buzz]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.95, 12, 1, true), new THREE.MeshLambertMaterial({ map: dust, transparent: true, depthWrite: false })); m.position.y = 0.48; P.g.add(m); }
    // the broken switch on the floor (glowing for you to spot), and the circuit breaker's empty hole
    const sk = new Kit(); sk.box(0.02, 0.012, 0.045, 0x1a1a1a, [0, 0.006, 0]); sk.cyl(0.004, 0.004, 0.02, 6, 0xd8d8d0, [0, 0.016, 0.02], [Math.PI / 2, 0, 0]);
    this.switchM = sk.mesh(FLAT); this.switchM.position.set(0.28, 0.01, -0.35); this.switchM.rotation.y = 0.6; C.group.add(this.switchM);
    this.swGlow = glowSprite(0xffe0a0, 0.18, 0); this.swGlow.position.set(0.28, 0.06, -0.35); C.group.add(this.swGlow);
    this.hole = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), new THREE.MeshBasicMaterial({ color: 0x000000 })); this.hole.position.set(0.72, 1.98, -0.62); this.hole.rotation.set(0.3, -0.5, 0); C.group.add(this.hole);
    // the felt-tip pen in Buzz's hand
    const pk = new Kit(); pk.cyl(0.006, 0.006, 0.13, 8, 0x1a1a1a, [0, 0.065, 0]); pk.cyl(0.0065, 0.0065, 0.035, 8, 0xe8e8e0, [0, 0.11, 0]); this.pen = pk.mesh(FLAT);
    holdProp(this.buzz, this.pen, 'Right', [0, 0.06, 0.03]);
    // outside the windows: the grey ground, still
    const MG = this.MGc = moonGround({ size: 500, seed: 19, flatten: [[0, 0, 8]], rocks: 600 }); MG.group.position.y = 1.6 - 3.6 - MG.height(0, 0); g.add(MG.group);
    this.addScene('cabin', { group: g, bounds: 0.15, amb: 0, fogFar: 9000, airless: true,
      enter: () => { C.lights(true, 0.8); this.G.sky.set(90, -60); },
      update: (dt, t) => {
        const s = this.s;
        this.key.position.copy(SUN).multiplyScalar(80); this.key.target.position.set(0, -2, -20); this.key.intensity = 2.4;
        this.swGlow.material.opacity = s.pen === 1 ? 0.5 + 0.3 * Math.sin(t * 5) : 0;
        this.buzz.look = s.pen ? C.group.localToWorld(this.hole.position.clone()) : C.group.localToWorld(V(0.3, 0.05, -0.35));
        this.buzz.pose = s.pen === 2 ? 'hold' : 'idle';
        this.neil.look = s.pen ? this.buzz.g.position.clone().add(V(0, 1.5, 0)) : null;
      } });
  }

  // ---------- 2. Liftoff from the Moon ----------
  buildSite() {
    const g = new THREE.Group();
    const MG = this.MG = moonGround({ size: 700, seed: 19, craters: [[60, -4, 12, 3.5], [-28, 30, 6, 1.2]], flatten: [[0, 0, 8], [2, 10, 7]], rocks: 1100, clear: [[0, 8, 16, 0.12]] });
    g.add(MG.group); const H = this.H = MG.height;
    const env = envMap('moon');
    const desc = copy(M.lm_descent, env, 1.0); desc.position.set(0, H(0, 0) + LM_Y, 0); g.add(desc);
    const asc = this.asc = new THREE.Group(); asc.add(copy(M.lm_ascent, env, 1.0)); asc.position.set(0, H(0, 0) + LM_Y + LM_DECK, 0); g.add(asc);
    this.ascY0 = asc.position.y;
    this.aps = flameMesh(6, 1.2, 'hyper'); this.aps.position.y = -0.2; this.aps.rotation.x = Math.PI; asc.add(this.aps); this.aps.userData.set(0, 0);
    // the flag (it blows over), the experiments left behind, footprints everywhere
    this.flag = new THREE.Group(); const f = copy(M.flag_1969, env, 1.0); this.flag.add(f); this.flag.position.copy(FLAG).setY(H(FLAG.x, FLAG.z)); this.flag.rotation.y = 0.6; g.add(this.flag);
    const seis = copy(M.seismometer, env, 1.0); seis.position.set(5.5, H(5.5, 12.5), 12.5); seis.rotation.y = 0.3; g.add(seis);
    const lr = copy(M.laser_reflector, env, 1.0); lr.position.set(3.0, H(3, 13), 13); g.add(lr);
    // sparks of foil and dust thrown out by the blast
    this.debris = Array.from({ length: 40 }, () => { const s = glowSprite(0xffe8b0, 0.25, 0); g.add(s); return { s, v: V(), life: 0 }; });
    const SP = this.SPs = earthSpace(this.G, { earthR: 36, cities: false }); SP.earth.position.copy(V(-0.41, 0.57, -0.71).normalize().multiplyScalar(1300)); SP.sunDir.copy(SUN);
    this.addScene('site', { group: g, bounds: 4, height: (x, z) => H(x, z), space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s; this.G.sky.set(90, -60); skyLevel(this.G, 0.35, 0.3);
        SP.atmoU.sun.value.copy(SUN); SP.earth.rotation.y += dt * 0.01;
        this.key.position.copy(SUN).multiplyScalar(80); this.key.target.position.set(0, 2, 4); this.key.intensity = 3.0;
        this.liftT = s.lift ? (this.liftT || 0) + dt * this.F : 0;
        const k = this.liftT;
        asc.position.y = this.ascY0 + (k > 0.3 ? 0.5 * 1.6 * (k - 0.3) ** 2 : 0);
        this.aps.userData.set(s.lift ? 0.9 + 0.1 * Math.sin(t * 30) : 0, t);
        this.flameLight.position.copy(asc.position).add(V(0, -1, 0)); this.flameLight.intensity = s.lift ? 14 : 0; this.flameLight.distance = 25; this.flameLight.color.setHex(0xffd8a0);
        // the flag goes over a moment after the blast reaches it
        if (k > 0.6) { this.flag.rotation.x = damp(this.flag.rotation.x, -1.45, 2.5, dt); }
        for (const d of this.debris) {
          d.life -= dt; if (d.life <= 0 && s.lift && k < 4) { d.life = 0.6 + Math.random() * 0.8; const a = Math.random() * 6.28; d.s.position.set(0, H(0, 0) + LM_DECK, 0); d.v.set(Math.cos(a) * (6 + Math.random() * 10), Math.random() * 3, Math.sin(a) * (6 + Math.random() * 10)); }
          d.s.position.addScaledVector(d.v, dt); d.s.material.opacity = d.life > 0 ? 0.9 * clamp01(d.life) : 0;
        }
      } });
  }

  // ---------- 3. Collins, alone ----------
  buildAlone() {
    const g = new THREE.Group();
    const C = this.Ca = cabin('apollo', { seat: 'center' }); g.add(C.group);
    dressCabin(C);
    this.mike = person(C.group, 'collins', V(-1.0, 0.4, -0.3), 0.9); this.mike.look = C.group.localToWorld(EYE.clone().addScaledVector(C.dirOf('rdvL'), 2));
    this.people.push(this.mike);
    this.winA = C.dirOf('rdvL');
    this.addScene('alone', { group: g, bounds: 0.2, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true, 0.5); this.G.sky.set(200, -70); },
      update: (dt, t) => {
        this.key.position.set(-4, 3, 2); this.key.target.position.set(0, 1.4, 0); this.key.intensity = 0.25;
        this.mike.g.position.y = 0.4 + Math.sin(t * 0.4) * 0.03; this.mike.g.rotation.z = Math.sin(t * 0.25) * 0.05;
      } });
  }

  // ---------- 4. Luna 15 ----------
  buildLuna() {
    const g = new THREE.Group();
    const moon = this.moonL = orbitGround(83, 3000, 260); g.add(moon);
    // the probe: a ball of tanks on four legs with a long antenna, falling at a slant
    const k = new Kit();
    for (const [x, z] of [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]]) k.ball(0.38, 1, 0xb8b8b0, [x, 0.6, z]);
    k.cyl(0.45, 0.55, 0.5, 12, 0x6a6a64, [0, 1.2, 0]); k.ball(0.32, 1, 0x9aa098, [0, 1.65, 0]); k.cyl(0.02, 0.02, 1.8, 4, 0xd8d8d0, [0.3, 2.3, 0], [0, 0, -0.3]);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.cyl(0.03, 0.03, 1.1, 4, 0x5a5a54, [x * 0.55, 0.25, z * 0.55], [z * 0.5, 0, -x * 0.5]);
    this.luna = new THREE.Group(); this.luna.add(k.mesh(FLAT)); g.add(this.luna);
    this.lunaJet = glowSprite(0xffd090, 3, 0.9); this.lunaJet.position.set(0, -0.2, 0); this.luna.add(this.lunaJet);
    this.lunaFlash = glowSprite(0xfff0d0, 60, 0); g.add(this.lunaFlash);
    this.lunaLabel = null;
    this.sunL = spaceSun(60); g.add(this.sunL);
    this.addScene('luna', { group: g, bounds: 0.4, amb: 0, fogFar: 9000, airless: true,
      enter: () => { this.G.sky.set(200, -60); },
      update: (dt, t) => {
        const s = this.s, sd = V(-0.9, 0.2, 0.4).normalize();
        this.sunL.position.copy(sd).multiplyScalar(1400); this.key.position.copy(sd).multiplyScalar(60); this.key.target.position.set(0, -200, -400); this.key.intensity = 2.2;
        moon.userData.slide(dt * this.F, 6);
        // falling from up and to the right toward a mountain 600 m ahead
        this.lT = s.luna ? (this.lT || 0) + dt * this.F : 0;
        const k = clamp01(this.lT / 6), hit = V(-60, -255, -620);
        this.luna.position.copy(V(120, -40, -500)).lerp(hit, k); this.luna.rotation.set(0.4 + k, 0.3, 0.6); this.luna.scale.setScalar(10); this.lunaJet.material.opacity = 0.6 + 0.4 * Math.sin(t * 20);
        this.luna.visible = s.luna && k < 1;
        this.lunaFlash.position.copy(hit).add(V(0, 8, 0)); this.lunaFlash.material.opacity = k >= 1 ? Math.max(0, 1 - (this.lT - 6) * 0.4) : 0;
        if (k >= 1 && !this.boomed) { this.boomed = true; rumble(this.G, 2, 0.25); }
      } });
  }

  // ---------- 5. Eagle comes up to meet Columbia ----------
  buildMeet() {
    const g = new THREE.Group();
    const moon = this.moonM = orbitGround(91); g.add(moon);
    const csm = this.csmM = copy(M.apollo_csm, envMap('moon'), 1.1); csm.rotation.set(0, 0.4, -Math.PI / 2 - 0.15); csm.position.set(-4.5, 0.6, -5); g.add(csm);
    const asc = this.ascM = copy(M.lm_ascent, envMap('moon'), 1.0); g.add(asc);
    const SP = this.SPm = earthSpace(this.G, { earthR: 42, cities: false });
    this.sunM = spaceSun(60); g.add(this.sunM);
    this.camFlash = glowSprite(0xffffff, 8, 0); g.add(this.camFlash);
    this.addScene('meet', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s, sd = V(0.7, 0.35, 0.6).normalize();
        SP.sunDir.copy(sd); SP.atmoU.sun.value.copy(sd); SP.earth.rotation.y += dt * 0.01;
        // the Earth just over the horizon ahead, Eagle rising in front of it
        SP.earth.position.copy(V(0.12, 0.08, -1).normalize().multiplyScalar(1300));
        this.sunM.position.copy(sd).multiplyScalar(1400); this.key.position.copy(sd).multiplyScalar(60); this.key.target.position.set(0, 0, -15); this.key.intensity = 2.4;
        moon.userData.slide(dt * this.F, 5);
        this.mK = clamp01((this.mK || 0) + (s.rise ? dt * this.F / 22 : 0));
        asc.position.set(lerp(6, 1.2, ease(this.mK)), lerp(-30, 1.2, ease(this.mK)), lerp(-60, -18, ease(this.mK))); asc.rotation.set(0.1, -0.6 + this.mK * 0.3, 0.05);
        this.camFlash.position.copy(csm.position).add(V(1.5, 0.6, 0)); this.camFlash.material.opacity = this.snapT != null && (this.snapT += dt) < 0.25 ? 1 - this.snapT * 4 : 0;
      } });
  }

  beds() { return [
    { kind: 'vent', at: V(0, 1.6, 0), vol: 0.05, ref: 3, on: (ch) => ch.cur === 'cabin' || ch.cur === 'alone' },
  ]; }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    Object.assign(s, { pen: 0, lift: 0, luna: 0, rise: 0 }); this.mK = 0; this.lT = 0; this.boomed = false; this.snapT = null;
    // 1. Inside Eagle
    await this.go(D, 'cabin', 0, 0.1, { x: 0, z: 0 });
    s.guide = [0, 2.2, -0.45];
    await D.say('ch28_01');
    s.pen = 1;
    this.guideTo(this.C.group.localToWorld(this.switchM.position.clone()), 0.4, 0.3);
    await D.say('ch28_02');
    s.pen = 2; this.guideTo(this.C.group.localToWorld(this.hole.position.clone()), 0.2, -0.4);
    await D.say('ch28_03');
    click(G, null, 0.3); beep(G, null, 0.08, 1100, 0.2);
    // 2. Liftoff, from out on the ground
    s.lift = 0; this.liftT = 0; this.flag.rotation.x = 0;
    await this.go(D, 'site', yawTo(330), 0.8, { x: 9, z: 18 });
    s.guide = [10.5, 2.4, 16.8];
    const l4 = D.sayAsync('ch28_04');
    await D.cue('Liftoff'); s.lift = 1; roar(G, null, 5, 0.3, 0.4); this.shake(0.006, 1.2);
    await l4;
    await D.wait(fast ? 0.5 : 4);
    // 3. Collins, alone (the music begins here)
    await this.go(D, 'alone', 0, 1.2, { x: 0, z: 0 });
    s.guide = [0.4, 2.2, -0.9];
    await D.say('ch28_05');
    await D.say('ch28_06');
    // 4. Luna 15
    await this.go(D, 'luna', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-2.5, 2.6, -6]; s.luna = 1; this.lT = 0;
    await D.say('ch28_07');
    await D.until(() => this.lT > 7 || fast, 6);
    // 5. Eagle rises to meet Columbia, the Earth behind
    await this.go(D, 'meet', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-2.5, 2.6, -6]; s.rise = 1;
    const l8 = D.sayAsync('ch28_08');
    await D.cue('photograph'); this.snapT = 0; click(G, null, 0.25);
    await l8;
    await D.until(() => this.mK >= 1 || fast, 10);
    await D.wait(fast ? 0.5 : 3);
  }
}
