// Era 3, Apollo 13 part 3 (n 32): The Lifeboat. 14-15 April 1970.
//
// 1. Outside: the two ships, Aquarius in front, and the Moon ahead. They're off the path home
//    (problem 5): Aquarius's landing engine fires for thirty seconds. Tick.
// 2. In Aquarius: glittering bits of wreckage all round look just like stars (problem 6). Houston:
//    "Give them the Sun." The Sun slides onto the crosshair (Adults line it up). Tick.
// 3. The far side of the Moon, close below: the farthest people have ever been (the music starts).
//    Lovell at the window: "The Moon I was supposed to walk on."
// 4. A longer burn to get home sooner (problem 7). Tick.
// 5. The cold: everything switched off, frost and drops on the windows, breath in the air
//    (problem 8). "Hey, Jim. I can see my breath in here." Tick.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { yawTo } from '../era3/base.js';
import { person } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { cabin, dressCabin } from '../era3/cabin.js';
import { envMap, flameMesh, cabinRumble, click } from '../era3/fx.js';
import { earthSpace, spaceSun, moonGlobe } from '../era3/worlds.js';
import { Apollo13, mcc13, MCC_SPOT, drawData, cueNth, docked, coldCabin, orbitGround } from '../era3/a13.js';
import { glowSprite, glowPoints } from '../wow/fx.js';
import { canvasTex, lerp } from '../util.js';
import { rng } from '../shapes.js';

const M = await loadAll(['craft/apollo_csm', 'craft/lm_ascent', 'craft/lm_descent', 'craft/mission_control']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);

// the docked ships with Aquarius's landing engine ready to fire (its bell faces forward, up the stack)
function shipWithEngine(env) {
  const D = docked(M, env, { damaged: true });
  const f = flameMesh(9, 1.6, 'hyper'); f.position.y = -0.4; D.lm.add(f); f.userData.set(0, 0); D.dps = f;
  return D;
}

export default class A13Lifeboat extends Apollo13 {
  constructor(G) {
    super(G, 32);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { burn: 0, sun: 0, moonOut: 0, cold: 0 });
    this.buildOutside(); this.buildAquarius(); this.buildMCC(); this.buildFarSide();
  }

  // ---------- Outside, the Moon ahead ----------
  buildOutside() {
    const g = new THREE.Group();
    const SP = this.SPo = earthSpace(this.G, { earthR: 9 });
    SP.earth.position.set(-200, 30, 320); SP.sunDir.set(0.6, 0.3, 0.5).normalize();
    this.sunO = spaceSun(50); SP.group.add(this.sunO);
    this.moonO = moonGlobe(150, { relief: 1.0 }); this.moonO.position.set(160, 40, -900); g.add(this.moonO);
    const D = this.dk = shipWithEngine(envMap('space'));
    D.group.rotation.set(0, 0.5, -Math.PI / 2 + 0.05); D.group.position.set(-6, 0.2, -28); g.add(D.group);
    this.addScene('outside', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s;
        SP.atmoU.sun.value.copy(SP.sunDir); this.sunO.position.copy(SP.sunDir).multiplyScalar(1400).add(EYE); this.moonO.userData.setSun(SP.sunDir);
        this.key.position.copy(SP.sunDir).multiplyScalar(80); this.key.target.position.copy(D.group.position); this.key.intensity = 2.3;
        D.dps.userData.set(s.burn ? 0.85 + 0.15 * Math.sin(t * 31) : 0, t);
        this.flameLight.position.copy(D.lm.getWorldPosition(new THREE.Vector3())).add(V(4, 0, 2)); this.flameLight.intensity = s.burn ? 8 : 0; this.flameLight.distance = 30; this.flameLight.color.setHex(0xffc890);
        this.bK = (this.bK || 0) + (s.burn ? dt * this.F : 0);
        D.group.position.x = -6 - this.bK * this.bK * 0.01; D.group.rotation.x = Math.sin(t * 0.2) * 0.04;
      } });
  }

  // ---------- In Aquarius ----------
  buildAquarius() {
    const g = new THREE.Group();
    const C = this.Ca = cabin('lm'); g.add(C.group);
    dressCabin(C);
    this.lovA = person(C.group, 'lovell', C.crew[0].pos.clone(), 0.25);
    this.haiA = person(C.group, 'haise', C.crew[1].pos.clone(), -0.25);
    this.swiA = person(C.group, 'swigert', V(0.1, 0.7, 0.5), Math.PI);
    this.people.push(this.lovA, this.haiA, this.swiA);
    // the view out: wreckage glittering like stars, the Sun, the crosshair in Lovell's window
    const wl = C.windows.find((w) => w.name === 'left'), wdir = wl.local.clone().normalize();
    this.wdir = wdir;
    this.debris = glowPoints(160, { sizeScale: 300 }); g.add(this.debris);
    const r = rng(7); this.deb = Array.from({ length: 160 }, () => ({ p: V((r() - 0.5) * 30, (r() - 0.3) * 20, -6 - r() * 30), v: V((r() - 0.5) * 0.2, (r() - 0.5) * 0.2, (r() - 0.5) * 0.1), s: 0.7 + r() * 1.4, ph: r() * 6 }));
    this.sunA = spaceSun(40); g.add(this.sunA);
    this.reticle = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(128, 128, (c, w, h) => { c.strokeStyle = 'rgba(255,170,60,0.95)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 6); c.lineTo(w / 2, h - 6); c.moveTo(6, h / 2); c.lineTo(w - 6, h / 2); c.stroke(); c.beginPath(); c.arc(w / 2, h / 2, 30, 0, 7); c.stroke(); }) }));
    this.reticle.position.copy(wdir).multiplyScalar(wl.local.length() - 0.05).add(EYE); this.reticle.lookAt(EYE); C.group.add(this.reticle);
    this.sunIt = this.touchable('sun', () => (C.handController ? C.handController.getWorldPosition(new THREE.Vector3()) : C.group.localToWorld(V(0.32, 0.98, -0.32))), { hint: 'Grip the hand controller by your right hand to steer the Sun onto the crosshair', deskHint: 'Click the hand controller by your right hand', r: 0.2 });
    this.hcGlow = glowSprite(0x80c0ff, 0.25, 0); C.group.add(this.hcGlow);
    // the far side below, out of the windows
    this.fsA = moonGlobe(900, { relief: 1.0 }); this.fsA.position.set(0, -700, -1300); this.fsA.userData.setSun(V(0.8, 0.35, 0.3)); g.add(this.fsA);
    this.coldFn = coldCabin(C, g, () => [this.lovA, this.haiA, this.swiA].map((P) => P.g.localToWorld(V(0, 1.62, 0.12))));
    this.addScene('aquarius', { group: g, bounds: 0.25, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { this.G.sky.set(200, -40); },
      update: (dt, t) => {
        const s = this.s;
        const lit = lerp(0.85, 0.12, ease(s.cold));
        C.lights(true, lit);
        // the Sun: off to one side, sliding onto the crosshair
        this.sK = s.sun ? clamp01((this.sK || 0) + dt * this.F / 6) : this.sK || 0;
        const off = V(0.35, 0.22, 0).multiplyScalar(1 - ease(this.sK));
        this.sunA.position.copy(wdir).add(off).normalize().multiplyScalar(1300).add(C.group.localToWorld(EYE.clone()));
        this.sunA.visible = !s.moonOut && !s.cold;
        this.key.position.copy(this.sunA.position).sub(EYE).normalize().multiplyScalar(30); this.key.target.position.set(0, 1.4, 0); this.key.intensity = this.sunA.visible ? 0.8 : 0.15;
        // the glittering wreckage
        const U = this.debris.userData; this.debris.visible = s.debris;
        this.deb.forEach((d, i) => { d.p.addScaledVector(d.v, dt); const tw = 0.5 + 0.5 * Math.sin(t * 3 + d.ph); U.pos.set([d.p.x, d.p.y, d.p.z], i * 3); U.col.set([tw, tw, tw * 0.95], i * 3); U.size[i] = d.s; });
        U.commit();
        if (C.handController) { this.hcGlow.position.copy(C.handController.position).add(V(0, 0.08, 0)); this.hcGlow.material.opacity = s.want === 'sun' ? 0.5 + 0.4 * Math.sin(t * 6) : 0; }
        this.fsA.visible = s.moonOut; this.fsA.rotation.x += dt * this.F * 0.004;
        this.coldFn(dt, t, s.cold);
        this.lovA.look = s.moonOut ? C.group.localToWorld(wl.local.clone().add(EYE).multiplyScalar(1)) : V(-0.3, 1.5, -0.8);
        this.lovA.pose = s.lovTalk ? 'talk' : 'idle'; this.haiA.pose = s.haiTalk ? 'talk' : s.cold ? 'hold' : 'idle'; this.swiA.pose = s.cold ? 'hold' : 'idle';
        this.swiA.g.position.y = 0.7 + Math.sin(t * 0.5) * 0.03;
      } });
  }

  // ---------- Mission Control ----------
  buildMCC() {
    const R = this.R = mcc13(this, M, 'mcc', { screen: (c, w, h, t) => drawData(c, w, h, t, { title: 'GUIDANCE   LM', rows: ['SUN CHECK', 'PITCH', 'YAW', 'ROLL', 'DPS BURN', 'DELTA V', 'PERICYNTHION', 'ENTRY ANGLE'], seed: 11 }) });
    this.scenes.mcc.update = ((up) => (dt, t) => { up(dt, t); R.kranz.pose = this.s.kranzTalk ? 'talk' : 'idle'; R.kranz.look = V(-2, 1.4, 3); })(this.scenes.mcc.update);
  }

  // ---------- The far side ----------
  buildFarSide() {
    const g = new THREE.Group();
    const fs = this.fs = orbitGround(83, 3000, 230); g.add(fs);
    const D = this.dkF = shipWithEngine(envMap('space'));
    D.group.rotation.set(0.15, 0.3, -Math.PI / 2 + 0.25); D.group.position.set(-3, 0.4, -20); g.add(D.group);
    this.addScene('farside', { group: g, bounds: 0.4, amb: 0, fogFar: 9000, airless: true,
      enter: () => { this.G.sky.set(200, -70); },
      update: (dt, t) => {
        fs.userData.slide(dt * this.F, 16);
        this.key.position.set(-60, 25, -30); this.key.target.position.set(0, -200, -400); this.key.intensity = 2.4;   // a low Sun: long shadows across the craters
        D.group.position.x = -3 + Math.sin(t * 0.1) * 0.5;
      } });
  }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast, B = this.board;
    Object.assign(s, { burn: 0, sun: 0, moonOut: 0, cold: 0, debris: 0, lovTalk: 0, haiTalk: 0, kranzTalk: 0 }); this.sK = 0; this.bK = 0;
    // 1. Off the path home: the landing engine fires
    await this.go(D, 'outside', 0, 0.1, { x: 0, z: 0 });
    s.guide = [-3, 2.4, -6];
    const l1 = D.sayAsync('ch32_01');
    await D.cue('Problem five'); B.card(4);
    await l1;
    const l2 = D.sayAsync('ch32_02');
    await D.cue('Thirty seconds'); s.burn = 1; cabinRumble(G, 6, 0.12);
    await cueNth(D, 'ch32_02', 'Tick'); s.burn = 0; B.tick(4);
    await l2;
    // 2. Fake stars; aim at the Sun
    s.debris = 1;
    await this.go(D, 'aquarius', 0, 0.8, { x: 0, z: 0 });
    s.guide = [0.4, 2.1, -0.4];
    const l3 = D.sayAsync('ch32_03');
    await D.cue('Problem six'); B.card(5);
    await l3;
    await this.go(D, 'mcc', yawTo(MCC_SPOT.bearing), 0.6, { x: MCC_SPOT.x, z: MCC_SPOT.z });
    s.guide = [3.5, 2.6, 2.6];
    s.kranzTalk = 1; await D.say('ch32_04'); s.kranzTalk = 0;
    await this.go(D, 'aquarius', 0, 0.6, { x: 0, z: 0 });
    if (!D.kids) {
      await D.say('ch32_05');
      await this.ask(D, 'sun', { hint: this.sunIt.hint, deskHint: this.sunIt.deskHint, after: 1, timeout: 20 });
    }
    s.sun = 1;
    await D.until(() => this.sK >= 1);
    click(G, null, 0.2);
    const l6 = D.sayAsync('ch32_06');
    await cueNth(D, 'ch32_06', 'Tick'); B.tick(5);
    await l6;
    s.debris = 0;
    // 3. The far side (the music starts)
    await this.go(D, 'farside', 0, 1.0, { x: 0, z: 0 });
    s.guide = [-2, 2.2, -5];
    await D.say('ch32_07');
    await D.wait(fast ? 0.5 : 3);
    s.moonOut = 1;
    await this.go(D, 'aquarius', 0, 0.8, { x: 0, z: 0 });
    s.guide = [0.5, 2.2, -0.3];
    s.lovTalk = 1; await D.say('ch32_08'); s.lovTalk = 0;
    await D.wait(fast ? 0.5 : 2.5);
    // 4. Home sooner
    s.moonOut = 0;
    await this.go(D, 'outside', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-3, 2.4, -6]; this.bK = 0;
    const l9 = D.sayAsync('ch32_09');
    await D.cue('Problem seven'); B.card(6);
    await D.cue('a longer burn'); s.burn = 1; cabinRumble(G, 8, 0.12);
    await cueNth(D, 'ch32_09', 'Tick'); s.burn = 0; B.tick(6);
    await l9;
    // 5. The cold
    await this.go(D, 'aquarius', 0, 0.8, { x: 0, z: 0 });
    s.guide = [0, 2.1, -0.3];
    const l10 = D.sayAsync('ch32_10');
    await D.cue('Problem eight'); B.card(7);
    await l10;
    const t0 = this.t;
    const l11 = D.sayAsync('ch32_11');
    await D.until(() => { s.cold = clamp01((this.t - t0) / (fast ? 1 : 8)); return s.cold >= 1; });
    await l11;
    s.haiTalk = 1; await D.say('ch32_12'); s.haiTalk = 0;
    const l13 = D.sayAsync('ch32_13');
    await cueNth(D, 'ch32_13', 'Tick'); B.tick(7);
    await l13;
    await D.wait(fast ? 0.5 : 3);
  }
}
