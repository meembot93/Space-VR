// Era 3, Apollo 13 part 2 (n 31): "We've Had a Problem". 13 April 1970, 55 hours in.
//
// 1. Inside Odyssey: Jack Swigert flips the switch to stir the oxygen tanks. A bang; the ship
//    shudders; the master alarm. "Okay, Houston, we've had a problem here."
// 2. Mission Control: the numbers make no sense (problem 2). Kranz: "Let's not make it any worse by
//    guessing." Lovell at the window; outside, a cloud of gas sprays from the side of the ship.
//    Sy Liebergot: one oxygen tank empty, the other falling. Now they know. Tick (the music starts).
// 3. Odyssey has about fifteen minutes of power (problem 3). In the dark lunar module, Aquarius,
//    Fred Haise brings the lights and panels back to life, one by one.
// 4. Aquarius doesn't know which way it's pointing (problem 4): Lovell copies the angles by hand,
//    Houston checks them. Odyssey goes dark. Tick, tick.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { yawTo } from '../era3/base.js';
import { person, sit } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { cabin, panelLamp, dressCabin } from '../era3/cabin.js';
import { Puffs, envMap, cabinRumble, bang, masterAlarm, click, hiss } from '../era3/fx.js';
import { earthSpace, spaceSun } from '../era3/worlds.js';
import { Apollo13, mcc13, MCC_SPOT, drawData, cueNth, docked } from '../era3/a13.js';
import { holdProp } from '../people.js';
import { glowSprite } from '../wow/fx.js';
import { canvasTex, lerp } from '../util.js';
import { rng } from '../shapes.js';

const M = await loadAll(['craft/apollo_csm', 'craft/lm_ascent', 'craft/lm_descent', 'craft/mission_control']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);

// a notepad with Lovell's columns of angles in pencil
function notepad() {
  const tex = canvasTex(128, 160, (c, w, h) => { c.fillStyle = '#f4f0dc'; c.fillRect(0, 0, w, h); c.strokeStyle = '#9ab0d0'; for (let y = 20; y < h; y += 12) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.fillStyle = '#333'; c.font = '11px monospace'; const r = rng(4); for (let i = 0; i < 10; i++) c.fillText(`${(r() * 360).toFixed(1)}  ${(r() * 360).toFixed(1)}`, 8, 30 + i * 12); });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.006), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  return m;
}

export default class A13Problem extends Apollo13 {
  constructor(G) {
    super(G, 31);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { bang: 0, alarm: 0, wild: 0, vent: 0, power: 1, lmPower: 0, write: 0 });
    this.buildOdyssey(); this.buildMCC(); this.buildOutside(); this.buildAquarius();
    Object.assign(G.narration.radio, { ch31_08: 'nasa' });
  }

  // ---------- Inside Odyssey ----------
  buildOdyssey() {
    const g = new THREE.Group();
    const C = this.Co = cabin('apollo', { seat: 'center' }); g.add(C.group);
    dressCabin(C);
    this.swiO = person(C.group, 'swigert', C.crew[0].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.swiO);
    this.lovO = person(C.group, 'lovell', V(0.95, 0.35, -0.3), -1.1); this.lovO.g.rotation.set(0.1, -1.1, -0.1);
    this.haiO = person(C.group, 'haise', V(-0.2, 0.9, 0.75), Math.PI - 0.3);
    this.people.push(this.swiO, this.lovO, this.haiO);
    this.master = panelLamp(0.1, 0.035, { text: 'MASTER ALARM', col: '#c02818', font: 'bold 28px sans-serif' }); C.overlay('master', this.master);
    this.uv = panelLamp(0.12, 0.035, { text: 'MAIN B UNDERVOLT', col: '#c88010', font: 'bold 22px sans-serif' }); C.overlay('master', this.uv); this.uv.position.x += 0.14;
    this.o2 = panelLamp(0.08, 0.035, { text: 'O2 PRESS', col: '#c88010', font: 'bold 26px sans-serif' }); C.overlay('master', this.o2); this.o2.position.x -= 0.12;
    this.addScene('odyssey', { group: g, bounds: 0.25, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { this.G.sky.set(200, -40); },
      update: (dt, t) => {
        const s = this.s;
        // the lights: steady, then a flicker after the bang, then dimming as the power goes
        const flick = s.bang && (this.t - this.bangT) < 3 ? (Math.random() < 0.3 ? 0.3 : 1) : 1;
        C.lights(s.power > 0.02, Math.max(0.02, s.power) * flick);
        this.key.position.set(4, 6, -2); this.key.target.position.set(0, 1.4, 0); this.key.intensity = 0.6 * s.power + 0.1;
        const blink = Math.sin(t * 9) > 0;
        this.master.userData.set('MASTER ALARM', '#c02818', s.alarm && blink && s.power > 0.1);
        this.uv.userData.set('MAIN B UNDERVOLT', '#c88010', s.bang && s.power > 0.1);
        this.o2.userData.set('O2 PRESS', '#c88010', s.bang && s.power > 0.1);
        this.lovO.g.position.y = 0.35 + Math.sin(t * 0.5) * 0.03; this.haiO.g.position.y = 0.9 + Math.sin(t * 0.45 + 1) * 0.04;
        this.swiO.look = s.bang ? V(0, 1.7, -0.8) : V(-0.4, 1.4, -0.8);
        this.swiO.pose = s.swiTalk ? 'talk' : s.bang ? 'gasp' : 'work';
        this.lovO.pose = s.lovTalk ? 'talk' : s.bang ? 'gasp' : 'idle'; this.haiO.pose = s.bang ? 'gasp' : 'idle';
        this.lovO.look = s.window ? C.group.localToWorld(C.windows.find((w) => w.name === 'sideR').local.clone().add(EYE)) : V(0, 1.6, 0);
      } });
  }

  // ---------- Mission Control ----------
  buildMCC() {
    const rows = [
      { n: 'O2 TK1 QTY', v: (t, r) => (this.s.wild ? (r() * 100).toFixed(1) : '68.4'), bad: true },
      { n: 'O2 TK2 QTY', v: (t, r) => (this.s.wild ? (r() < 0.5 ? '0.0' : (r() * 100).toFixed(1)) : '72.1'), bad: true },
      { n: 'O2 TK1 PRESS', v: (t, r) => (this.s.wild ? (900 - (this.t % 60) * 8).toFixed(0) : '911'), bad: true },
      { n: 'O2 TK2 PRESS', v: (t, r) => (this.s.wild ? (r() < 0.6 ? '19' : '1008') : '903') },
      { n: 'FC1 FLOW', v: (t, r) => (this.s.wild ? '0.00' : '0.68'), bad: true },
      { n: 'FC2 FLOW', v: () => '0.71' },
      { n: 'FC3 FLOW', v: (t, r) => (this.s.wild ? '0.00' : '0.70'), bad: true },
      { n: 'MAIN BUS A', v: () => '28.6' },
      { n: 'MAIN BUS B', v: (t, r) => (this.s.wild ? (r() * 4 + 22).toFixed(1) : '28.4'), bad: true },
    ];
    const R = this.R = mcc13(this, M, 'mcc', { screen: (c, w, h, t) => drawData(c, w, h, t, { title: 'EECOM   CSM ELECTRICAL', rows, seed: 7, wild: this.s.wild }) });
    this.scenes.mcc.update = ((up) => (dt, t) => {
      up(dt, t);
      const s = this.s;
      R.kranz.pose = s.kranzTalk ? 'talk' : 'idle'; R.lieb.pose = s.liebTalk ? 'talk' : s.wild ? 'work' : 'idle';
      R.ctl.forEach((P, i) => { P.pose = s.wild && i % 2 ? 'work' : 'idle'; });
      if (s.kranzTalk) R.kranz.look = V(0, 1.4, 3.8);
    })(this.scenes.mcc.update);
  }

  // ---------- Outside: the cloud of gas ----------
  buildOutside() {
    const g = new THREE.Group();
    const SP = this.SPo = earthSpace(this.G, { earthR: 16 });
    SP.earth.position.set(240, 50, -330); SP.sunDir.set(-0.5, 0.35, 0.6).normalize();
    this.sunO = spaceSun(50); SP.group.add(this.sunO);
    const D = this.dk = docked(M, envMap('space'), { damaged: true });
    D.group.rotation.set(0.1, -0.5, -Math.PI / 2 - 0.15); D.group.position.set(2, 0.4, -24); g.add(D.group);
    // the vent: glittering gas and bits pouring out of the side of the Service Module
    this.vent = new Puffs(500, { floor: null }); g.add(this.vent.mesh);
    this.ventAt = new THREE.Object3D(); this.ventAt.position.set(0, -3.6, 2.2); D.csm.add(this.ventAt);
    this.sparks = glowSprite(0xffffff, 3, 0); g.add(this.sparks);
    this.addScene('outside', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s;
        SP.atmoU.sun.value.copy(SP.sunDir); this.sunO.position.copy(SP.sunDir).multiplyScalar(1400).add(EYE);
        this.key.position.copy(SP.sunDir).multiplyScalar(80); this.key.target.position.copy(D.group.position); this.key.intensity = 2.4;
        D.group.rotation.x = 0.1 + Math.sin(t * 0.3) * 0.05; D.group.rotation.y = -0.5 + t * 0.01;
        const p = this.ventAt.getWorldPosition(new THREE.Vector3()), n = V(0, 0, 1).transformDirection(D.csm.matrixWorld);
        if (s.vent) for (let i = 0; i < 6; i++) {
          const sp = 3 + Math.random() * 4, jx = (Math.random() - 0.5) * 1.4, jy = (Math.random() - 0.5) * 1.4;
          this.vent.emit(p.x, p.y, p.z, n.x * sp + jx, n.y * sp + jy, n.z * sp + (Math.random() - 0.5), 0.4, 2.5 + Math.random() * 3, 3 + Math.random() * 2, Math.random() < 0.3 ? 0xfff8e8 : 0xd8e0e8, 0.55, 0.05);
        }
        this.vent.update(this.G, dt, [0, 0], 0.4);
        this.sparks.position.copy(p).addScaledVector(n, 1.5); this.sparks.material.opacity = s.vent ? 0.5 + 0.3 * Math.sin(t * 13) : 0;
      } });
  }

  // ---------- Aquarius, waking up ----------
  buildAquarius() {
    const g = new THREE.Group();
    const C = this.Ca = cabin('lm'); g.add(C.group);
    dressCabin(C);
    this.lovA = person(C.group, 'lovell', C.crew[0].pos.clone(), 0.25);
    this.haiA = person(C.group, 'haise', C.crew[1].pos.clone(), -0.25);
    this.swiA = person(C.group, 'swigert', V(0.05, 0.75, 0.55), Math.PI); this.swiA.g.visible = false;
    holdProp(this.lovA, notepad(), 'Left', [0, 0.08, 0.06]);
    this.people.push(this.lovA, this.haiA, this.swiA);
    // the panels' lamps and screens: dark, then lit one patch at a time as Haise brings them up
    this.lmGlow = []; const r = rng(31);
    C.group.traverse((o) => { if (o.isMesh && o.material?.map && o !== C.shell) { /* panels keep their paint */ } });
    for (let i = 0; i < 22; i++) { const s = glowSprite([0xffa040, 0x80ff90, 0xffe080][i % 3], 0.05 + r() * 0.04, 0); s.position.set((r() - 0.5) * 1.9, 0.6 + r() * 1.5, -0.74 + (r() < 0.3 ? r() * 0.4 : 0)); if (Math.abs(s.position.x) > 1.05) s.position.x = Math.sign(s.position.x) * 1.08; C.group.add(s); this.lmGlow.push({ s, at: r() }); }
    this.flash = glowSprite(0xfff0d8, 0.4, 0); C.group.add(this.flash);
    this.addScene('aquarius', { group: g, bounds: 0.25, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { this.G.sky.set(200, -40); },
      update: (dt, t) => {
        const s = this.s;
        this.pK = s.lmPower ? clamp01((this.pK || 0) + dt * this.F / 22) : 0;
        C.lights(this.pK > 0.05, 0.08 + this.pK * 0.9);
        this.lmGlow.forEach((q) => { q.s.material.opacity = this.pK > q.at ? 0.7 + 0.2 * Math.sin(t * 3 + q.at * 9) : 0; });
        // Haise's flashlight while it's still dark
        const hand = this.haiA.g.localToWorld(V(0.2, 1.2, 0.4)); C.group.worldToLocal(hand);
        this.flash.position.copy(hand); this.flash.material.opacity = this.pK < 0.6 ? 0.5 * (1 - this.pK) : 0;
        this.lamp.position.copy(C.group.localToWorld(V(0.3, 1.4, -0.4))); this.lamp.intensity = this.pK < 0.6 ? 0.6 * (1 - this.pK) : 0; this.lamp.distance = 2.5;
        this.haiA.pose = s.lmPower && this.pK < 1 ? 'work' : 'idle'; this.haiA.look = V(0.5, 1.3, -0.8);
        this.lovA.pose = s.write ? 'work' : 'idle'; this.lovA.look = s.write ? this.lovA.g.position.clone().add(V(0.1, 1.2, 0.3)) : V(-0.3, 1.5, -0.8);
        this.swiA.g.position.y = 0.75 + Math.sin(t * 0.5) * 0.03;
      } });
  }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast, B = this.board;
    Object.assign(s, { bang: 0, alarm: 0, wild: 0, vent: 0, power: 1, lmPower: 0, write: 0, window: 0, swiTalk: 0, lovTalk: 0, kranzTalk: 0, liebTalk: 0 });
    this.pK = 0; this.swiA.g.visible = false;
    // 1. The switch, and the bang
    await this.go(D, 'odyssey', 0, 0.1, { x: 0, z: 0 });
    s.guide = [-0.3, 2.2, -1.0];
    await D.say('ch31_01');
    click(G, null, 0.25);
    await D.wait(fast ? 0.3 : 1.2);
    s.bang = 1; this.bangT = this.t; bang(G, null, 0.9, true); this.shake(0.02, 2.0); cabinRumble(G, 2, 0.4);
    await D.wait(0.4); s.alarm = 1; masterAlarm(G, 4, 0.12);
    await D.say('ch31_02');
    s.swiTalk = 1; await D.say('ch31_03'); s.swiTalk = 0;
    s.lovTalk = 1; await D.say('ch31_04'); s.lovTalk = 0; s.alarm = 0;
    // 2. Houston: what broke?
    s.wild = 1;
    await this.go(D, 'mcc', yawTo(MCC_SPOT.bearing), 0.6, { x: MCC_SPOT.x, z: MCC_SPOT.z });
    s.guide = [3.5, 2.6, 2.6];
    const l5 = D.sayAsync('ch31_05');
    await D.cue('Problem two'); B.card(1);
    await l5;
    s.kranzTalk = 1; await D.say('ch31_06'); s.kranzTalk = 0;
    await this.go(D, 'odyssey', 0, 0.6, { x: 0, z: 0 });
    s.window = 1;
    const l7 = D.sayAsync('ch31_07');
    await D.cue('sees a cloud');
    s.vent = 1; this.vent.clear();
    await this.go(D, 'outside', 0, 0.6, { x: 0, z: 0 });
    s.guide = [-2, 2.4, -6]; hiss(G, null, 0.08, 4);
    await l7;
    await D.say('ch31_08');
    await D.wait(fast ? 0.3 : 2);
    await this.go(D, 'mcc', yawTo(MCC_SPOT.bearing), 0.6, { x: MCC_SPOT.x, z: MCC_SPOT.z });
    s.guide = [3.5, 2.6, 2.6];
    s.liebTalk = 1; await D.say('ch31_09'); s.liebTalk = 0;
    const l10 = D.sayAsync('ch31_10');          // the music starts here, and plays on to the end
    await cueNth(D, 'ch31_10', 'Tick'); B.tick(1);
    await l10;
    // 3. Fifteen minutes of power; the lifeboat
    await this.go(D, 'odyssey', 0, 0.6, { x: 0, z: 0 });
    s.window = 0; s.power = 0.5;
    const l11 = D.sayAsync('ch31_11');
    await D.cue('Problem three'); B.card(2);
    await l11;
    await this.go(D, 'aquarius', 0, 0.8, { x: 0, z: 0 });
    s.guide = [0, 2.1, -0.4];
    s.lmPower = 1;
    await D.say('ch31_12');
    // 4. Which way is it pointing?
    const l13 = D.sayAsync('ch31_13');
    await D.cue('Problem four'); B.card(3);
    await D.cue('copies'); s.write = 1;
    await l13;
    await D.wait(fast ? 0.3 : 1.5);
    // Odyssey goes dark
    await this.go(D, 'odyssey', 0, 0.6, { x: 0, z: 0 });
    const l14 = D.sayAsync('ch31_14');
    const t0 = this.t; await D.until(() => { s.power = Math.max(0, 0.5 * (1 - (this.t - t0) / (fast ? 0.5 : 2.5))); return s.power <= 0; });
    await this.go(D, 'aquarius', 0, 0.6, { x: 0, z: 0 });
    s.write = 0; this.swiA.g.visible = true;
    await cueNth(D, 'ch31_14', 'Tick', 1); B.tick(2);
    await cueNth(D, 'ch31_14', 'Tick', 2); B.tick(3);
    await l14;
    await D.wait(fast ? 0.5 : 4);
  }
}
