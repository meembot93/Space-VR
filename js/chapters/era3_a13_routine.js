// Era 3, Apollo 13 part 1 (n 30): A Routine Flight. April 1970.
//
// 1. The simulator hall in Houston, three days before launch: Ken Mattingly has been near measles, so
//    Jack Swigert takes his seat. "It's okay, Jack. Take good care of my ship." The crew climb in.
// 2. 11 April: liftoff, watched from the press site. Then up high, the second stage's five engines...
//    and the middle one goes out early. Problem 1 on the board; the other four burn longer. Tick.
// 3. Two days out: the crew's TV show from the ship (the music starts)... and at home, nobody's
//    watching it. "This is the crew of Apollo 13, wishing everybody there a nice evening."
// 4. Outside, the docked ships coast on toward the Moon, quiet.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { yawTo } from '../era3/base.js';
import { person, sit } from '../era3/folk.js';
import { loadAll, copy, Rocket } from '../era3/craft.js';
import { cabin, dressCabin } from '../era3/cabin.js';
import { Puffs, envMap, flameMesh, cabinRumble, click } from '../era3/fx.js';
import { earthSpace, spaceSun, groundPlane, sea } from '../era3/worlds.js';
import { room, surfMat, picture, rug, sofa, armchair, lampStand, curtains } from '../era3/sets.js';
import { tvSet } from '../era3/base.js';
import { SATURN, saturnRocket, SAT_Y, PAD_Y } from '../era3/saturn.js';
import { Apollo13, simHall, cueNth, docked } from '../era3/a13.js';
import { holdProp } from '../people.js';
import { glowSprite } from '../wow/fx.js';
import { canvasTex, lerp } from '../util.js';
import { rng, noise2 } from '../shapes.js';

const M = await loadAll([...SATURN, 'craft/launch_tower', 'craft/lm_ascent', 'craft/lm_descent']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);
const PAD = V(-60, 0, -650);            // the pad from the press site (brought in from 5.6 km)

// the TV camera the crew used (a grey box with a lens and a handle)
function tvCamera() { const k = new Kit(); k.box(0.1, 0.12, 0.2, 0x8a8c8e, [0, 0, 0]); k.cyl(0.035, 0.04, 0.08, 12, 0x1a1a1a, [0, 0, -0.14], [Math.PI / 2, 0, 0]); k.box(0.03, 0.06, 0.12, 0x2a2a2a, [0, 0.09, 0]); return k.mesh(FLAT); }
// a ball game on an April evening's TV (what people watched instead)
function drawGame(c, w, h, t) {
  c.fillStyle = '#3a7a3a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#b88a5a'; c.beginPath(); c.moveTo(w * 0.5, h * 0.95); c.lineTo(w * 0.85, h * 0.6); c.lineTo(w * 0.5, h * 0.3); c.lineTo(w * 0.15, h * 0.6); c.closePath(); c.fill();
  c.fillStyle = '#3a7a3a'; c.beginPath(); c.moveTo(w * 0.5, h * 0.84); c.lineTo(w * 0.74, h * 0.6); c.lineTo(w * 0.5, h * 0.4); c.lineTo(w * 0.26, h * 0.6); c.closePath(); c.fill();
  c.fillStyle = '#f4f0e8'; for (const [x, y] of [[0.5, 0.88], [0.8, 0.6], [0.5, 0.33], [0.2, 0.6]]) c.fillRect(w * x - 4, h * y - 4, 8, 8);
  const px = w * (0.5 + Math.sin(t * 1.3) * 0.02); c.fillStyle = '#e8e8e8'; c.fillRect(px - 3, h * 0.55, 6, 14);
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(w * 0.05, h * 0.05, w * 0.42, h * 0.14); c.fillStyle = '#fff'; c.font = `bold ${h * 0.08 | 0}px sans-serif`; c.textAlign = 'left'; c.fillText('METS 3  CUBS 2', w * 0.07, h * 0.15);
}

export default class A13Routine extends Apollo13 {
  constructor(G) {
    super(G, 30);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { climb: 0, s2: 0, out: 0, tv: 0 });
    this.buildSim(); this.buildPress(); this.buildStage(); this.buildCabin(); this.buildHome(); this.buildCoast();
    Object.assign(G.narration.radio, { ch30_07: 'nasa' });
  }

  // ---------- 1. The simulator ----------
  buildSim() {
    const S = simHall(this, 'sim');
    const g = S.g;
    // Lovell and Haise by the steps, Mattingly with them; Swigert walks in from the side
    this.lovS = person(g, 'lovell', V(-1.5, 0, 2.3), 0.5);
    this.haiS = person(g, 'haise', V(-0.3, 0, 2.5), -0.4);
    this.mattS = person(g, 'ken_mattingly', V(0.7, 0, 2.2), -1.2);
    this.swiS = person(g, 'swigert', V(4.5, 0, 3.4), -1.6);
    const ck = new Kit(); ck.box(0.22, 0.3, 0.015, 0x6a4a2a, [0, 0, 0]); ck.box(0.2, 0.26, 0.004, 0xf4f0e8, [0, 0, 0.01]);
    holdProp(this.mattS, ck.mesh(FLAT), 'Left', [0, 0.06, 0.04]);
    this.crewS = [this.lovS, this.haiS, this.swiS];
    this.people.push(this.lovS, this.haiS, this.mattS, this.swiS);
    // the path up into the simulator: the foot of the steps, the top, the hatch
    this.path = [V(-0.9, 0, 2.0), V(-0.9, 1.9, 0.1), V(-0.9, 1.9, -1.4)];
    const self = this, S0 = this.scenes.sim, up = S0.update;
    S0.update = (dt, t) => {
      up?.(dt, t);
      const s = self.s;
      // Swigert walks over to the others
      const sw = self.swiS;
      if (!s.climb) {
        const tgt = V(0.1, 0, 2.9), d = tgt.clone().sub(sw.g.position).setY(0);
        if (s.swi && d.length() > 0.05) { sw.g.position.addScaledVector(d.normalize(), Math.min(d.length(), dt * this.F * 1.1)); sw.g.rotation.y = Math.atan2(d.x, d.z); sw.pose = 'walk'; }
        else { sw.pose = s.matt ? 'idle' : 'idle'; if (s.swi) sw.g.rotation.y = Math.atan2(self.mattS.g.position.x - sw.g.position.x, self.mattS.g.position.z - sw.g.position.z); }
      }
      self.mattS.pose = s.matt ? 'talk' : 'hold'; self.mattS.look = sw.g.position.clone().setY(1.6);
      self.lovS.look = self.haiS.look = sw.g.position.clone().setY(1.6);
      // up the steps, one after another, and in through the hatch
      if (s.climb) self.crewS.forEach((P, i) => {
        const k = clamp01((self.climbT - i * 2.2) / 5.5); if (k <= 0) { P.pose = 'idle'; return; }
        if (k >= 1) { P.g.visible = false; return; }
        const p = k < 0.15 ? P.from.clone().lerp(self.path[0], k / 0.15) : k < 0.7 ? self.path[0].clone().lerp(self.path[1], (k - 0.15) / 0.55) : self.path[1].clone().lerp(self.path[2], (k - 0.7) / 0.3);
        const d = p.clone().sub(P.g.position).setY(0); if (d.lengthSq() > 1e-6) P.g.rotation.y = Math.atan2(d.x, d.z);
        P.g.position.copy(p); P.pose = 'walk';
      });
      if (s.climb) self.climbT += dt * this.F;
      self.mattS.g.rotation.y = s.climb ? Math.atan2(-0.9 - 0.7, -0.5 - 2.2) : Math.atan2(sw.g.position.x - 0.7, sw.g.position.z - 2.2);
    };
  }

  // ---------- 2. Liftoff, from the press site ----------
  buildPress() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(30);
    g.add(groundPlane({ size: 5000, seg: 120, h: () => 0, color: (x, z, c) => { const m = N(x / 30, z / 30); if (z < -300 && z > -1100 && N(x / 400, z / 300) > 0.45) c.setRGB(0.2, 0.34, 0.44); else c.setRGB(0.32 + m * 0.1, 0.4 + m * 0.08, 0.2); } }));
    const S = sea({ size: 9000, col: 0x2a5a7a, sky: 0xa8c8e8, sun: V(0.9, 0.5, 0) }); S.position.set(5200, -0.6, 0); g.add(S); this.pressSea = S;
    k.box(80, 6, 70, 0x9a968c, [PAD.x, 3, PAD.z]);
    // the press site: a grandstand roof, the big countdown clock, a flagpole, cameras on tripods
    k.box(14, 0.2, 5, 0xe8e4d8, [-2, 3.2, 3.5]); for (let i = 0; i < 4; i++) k.cyl(0.06, 0.06, 3.2, 6, 0x8a8a8a, [-8 + i * 4, 1.6, 1.2]);
    for (let r = 0; r < 4; r++) k.box(14, 0.08, 0.6, 0x9a8a6a, [-2, 0.3 + r * 0.4, 2.2 + r * 0.7]);
    k.cyl(0.05, 0.05, 9, 6, 0xd8d8d8, [6, 4.5, -2]);
    for (let i = 0; i < 3; i++) { const x = -8.5 + i * 1.6; for (const a of [0, 2.1, 4.2]) k.cyl(0.015, 0.015, 1.5, 4, 0x2a2a2a, [x + Math.cos(a) * 0.2, 0.72, -1.5 + Math.sin(a) * 0.2], [Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15]); k.box(0.2, 0.2, 0.4, 0x2a2a2a, [x, 1.55, -1.5]); k.cyl(0.06, 0.07, 0.25, 10, 0x111111, [x, 1.55, -1.82], [Math.PI / 2, 0, 0]); }
    g.add(k.mesh(FLAT));
    const flag = picture(1.5, 0.8, (c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f4f0e8' : '#b22234'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, w * 0.4, h * 7 / 13); }, { frame: 0xd8d8d8, px: 256 });
    flag.position.set(6.78, 8.4, -2); g.add(flag);
    this.clockTex = canvasTex(512, 128, (c, w, h) => this.drawClock(c, w, h, 10));
    const clk = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: this.clockTex, toneMapped: false })); clk.position.set(-6, 2.4, -3.5); clk.rotation.y = 0.4; g.add(clk);
    const ck = new Kit(); ck.box(4.2, 1.2, 0.3, 0x2a2a2a, [0, 0, -0.18]); ck.cyl(0.08, 0.08, 1.8, 6, 0x5a5a5a, [-1.6, -1.5, -0.2]); ck.cyl(0.08, 0.08, 1.8, 6, 0x5a5a5a, [1.6, -1.5, -0.2]); const ckm = ck.mesh(FLAT); ckm.position.copy(clk.position); ckm.rotation.y = 0.4; g.add(ckm);
    const T = copy(M.launch_tower, envMap('day'), 0.9); T.position.set(PAD.x, 6, PAD.z); g.add(T);
    this.rocket = new Rocket(g, { ...saturnRocket(M), env: envMap('day'), az: 72 }); this.rocket.place(PAD.x, 6 + PAD_Y, PAD.z);
    this.puffs = new Puffs(700, { floor: 6 }); g.add(this.puffs.mesh);
    // reporters and photographers along the rail
    this.press = [['reporter', -4.2, -0.9, Math.PI + 0.1], ['man_suit', -2.6, 0.2, Math.PI - 0.1], ['woman_dress', 2.4, 0.1, Math.PI + 0.2], ['tech_white', 3.8, -1.0, Math.PI], ['man_suit', -5.6, 0.8, Math.PI + 0.3]].map(([w, x, z, yaw]) => { const P = person(g, w, V(x, 0, z), yaw); return P; });
    this.people.push(...this.press);
    this.addScene('press', { group: g, bounds: 1.0, place: { lat: 28.5, year: 1970, sunLon: 21 }, amb: 0.5, fogFar: 4000,
      sky: () => { this.G.sky.set(255, 32); this.key.position.set(-300, 200, 60); this.key.target.position.set(0, 0, -300); this.key.intensity = 2.0; },
      update: (dt, t) => {
        const s = this.s;
        S.userData.update?.(t);
        this.rocket.update(dt, t, this.F); this.puffs.update(this.G, dt * this.F, [2, 0], this.rocket.flash || 0);
        const T0 = this.rocket.T; if ((this.cAcc = (this.cAcc || 0) + dt) > 0.1) { this.cAcc = 0; this.drawClock(this.clockTex.image.getContext('2d'), 512, 128, T0 < 0 ? 10 : Math.max(-60, 8.9 - T0)); this.clockTex.needsUpdate = true; }
        const up = this.rocket.rising;
        this.press.forEach((P, i) => { P.look = this.rocket.pos.clone(); P.pose = up ? (i % 2 ? 'point' : 'gasp') : 'idle'; });
      } });
  }
  drawClock(c, w, h, secs) {
    c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, w, h);
    const s = Math.abs(Math.round(secs)), txt = `${secs >= 0 ? 'T-' : 'T+'}00:00:${String(s).padStart(2, '0')}`;
    c.fillStyle = '#ff5a2a'; c.font = 'bold 84px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 4);
  }

  // ---------- 2. Up high: the second stage's five engines ----------
  buildStage() {
    const g = new THREE.Group();
    const SP = this.SPst = earthSpace(this.G, { earthR: 1500 });
    SP.earth.position.set(0, -1500 - 160, -150); SP.sunDir.set(-0.6, 0.55, 0.3).normalize();
    // the rocket lies across the view, climbing to the right: S-II, third stage, adapter, Odyssey
    const st = this.stS = new THREE.Group(); st.rotation.z = -Math.PI / 2 + 0.12; st.position.set(-20, -2, -46); g.add(st);
    const env = envMap('space');
    for (const [m, y] of [['saturn_s2', 0], ['saturn_s4b', SAT_Y.s4b - SAT_Y.s2], ['saturn_sla', SAT_Y.sla - SAT_Y.s2], ['apollo_csm', SAT_Y.csm - SAT_Y.s2]]) { const o = copy(M[m], env, 1.0); o.position.y = y; st.add(o); }
    // five J-2s: the middle one and four round it
    this.j2 = [[0, 0], ...[0, 1, 2, 3].map((q) => { const a = Math.PI / 4 + q * Math.PI / 2; return [Math.cos(a) * 2.7, Math.sin(a) * 2.7]; })].map(([x, z], i) => {
      const f = flameMesh(16, 2.4, 'hydro'); f.position.set(x, -3.4, z); st.add(f); return f;
    });
    this.addScene('stage', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s;
        SP.earth.rotation.y += dt * 0.01; SP.atmoU.sun.value.copy(SP.sunDir);
        this.key.position.copy(SP.sunDir).multiplyScalar(80); this.key.target.position.copy(st.position); this.key.intensity = 2.4;
        this.j2.forEach((f, i) => f.userData.set(i === 0 && s.out ? Math.max(0, 1 - (this.outT = (this.outT || 0) + dt * 3)) : 0.85 + 0.15 * Math.sin(t * 29 + i), t + i));
        st.position.x = -20 + Math.sin(t * 0.2) * 0.3;
      } });
  }

  // ---------- 3. The TV show, inside Odyssey ----------
  buildCabin() {
    const g = new THREE.Group();
    const C = this.Cc = cabin('apollo', { seat: 'center' }); g.add(C.group);
    dressCabin(C);
    this.lovC = person(C.group, 'lovell', V(-1.0, 0.45, -0.25), 0.9); this.lovC.g.rotation.z = 0.1;
    this.haiC = person(C.group, 'haise', V(0.95, 0.3, -0.3), -1.1); this.haiC.g.rotation.set(0.1, -1.1, -0.12);
    this.swiC = person(C.group, 'swigert', V(0.2, 0.55, 0.85), Math.PI - 0.2);
    holdProp(this.lovC, tvCamera(), 'Right', [0, 0.06, 0.08]);
    this.people.push(this.lovC, this.haiC, this.swiC);
    // the camera's red light
    this.tally = glowSprite(0xff3020, 0.05, 0); g.add(this.tally);
    this.winC = C.dirOf('hatch');
    this.addScene('cabin', { group: g, bounds: 0.25, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); this.G.sky.set(200, -40); },
      update: (dt, t) => {
        this.key.position.set(4, 6, -2); this.key.target.position.set(0, 1.4, 0); this.key.intensity = 1.4;
        this.lovC.g.position.y = 0.45 + Math.sin(t * 0.5) * 0.04; this.haiC.g.position.y = 0.3 + Math.sin(t * 0.45 + 1) * 0.05; this.swiC.g.position.y = 0.55 + Math.sin(t * 0.4 + 2) * 0.04;
        this.lovC.look = this.haiC.g.position.clone().add(V(0, 1.5, 0)); this.haiC.look = this.lovC.g.position.clone().add(V(0, 1.5, 0));
        this.haiC.pose = this.s.tv ? 'wave' : 'talk'; this.lovC.pose = this.s.signoff ? 'talk' : 'hold';
        this.lovC.props?.Right?.obj.getWorldPosition(this.tally.position); this.tally.position.y += 0.1; this.tally.material.opacity = this.s.tv ? 0.9 : 0;
      } });
  }

  // ---------- 3. At home: nobody's watching ----------
  buildHome() {
    const R = room(5.5, 4.6, 2.6, { floor: surfMat('carpet', '#7a6a48'), wall: surfMat('wallpaper', '#b8a888'), ceil: surfMat('plaster', '#ece4d4'), windows: [{ side: 'e', at: 0.6, y: 0.9, w: 1.3, h: 1.2 }], doors: [{ side: 'w', at: 1.2, w: 0.9, h: 2.1 }], skirt: 0x3a2a1e, outside: surfMat('brick'), thick: 0.2 });
    const g = R.group, k = new Kit();
    rug(k, 0, 0.4, 0, { w: 2.6, d: 1.8, col: 0x6a4a2a, border: 0xd8a040 });
    sofa(k, 0, 1.5, Math.PI, { col: 0x5a7a4a, w: 2.0 }); armchair(k, 1.9, 0.6, Math.PI + 0.7, { col: 0xb8783a });
    lampStand(k, -1.6, 1.8, { h: 1.5, shade: 0xf0d090 }); curtains(k, R.windows[0], { col: 0xd89040 });
    k.box(0.5, 0.45, 0.5, 0x6a4a2a, [-1.4, 0.22, 1.5]);
    for (let i = 0; i < 5; i++) k.box(0.14, 0.03, 0.14, [0xc83030, 0x3060c0, 0xf0d040, 0x30a050, 0xe8e8e8][i], [-0.6 + i * 0.22, 0.02, -0.6 + (i % 2) * 0.2], [0, i, 0]);   // the kids' board game on the rug
    g.add(k.mesh(FLAT));
    const tv = this.homeTV = tvSet((c, w, h, t) => drawGame(c, w, h, t), { w: 0.66, legs: true, color: true }); tv.g.position.set(0, 0, -1.9); g.add(tv.g);
    // Dad reading the paper, Mom at the game with the kids; nobody looking at the TV
    const paper = new Kit(); paper.box(0.5, 0.36, 0.01, 0xece8dc, [0, 0, 0]);
    this.fam = [['man_casual', -0.55, 1.5, Math.PI, 1], ['woman_summer', -0.1, -0.2, Math.PI * 0.5, 0], ['boy', -0.9, -0.95, 0.3, 0], ['girl', 0.6, -0.9, -0.5, 0]].map(([who, x, z, yaw, seat]) => {
      const P = person(g, who, V(x, 0, z), yaw); if (seat) sit(P); return P; });
    holdProp(this.fam[0], paper.mesh(FLAT), 'Right', [0.05, 0.12, 0.25]);
    this.people.push(...this.fam);
    this.addScene('home', { group: g, bounds: 0.8, indoors: true, place: { lat: 41.5, year: 1970, sunLon: 23 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(290, -25); this.lamp.position.set(-1.6, 1.6, 1.8); this.lamp.intensity = 1.1; this.lamp.distance = 6; this.lamp2.position.set(0, 0.95, -1.4); this.lamp2.color.setHex(0xc8e0c8); this.lamp2.intensity = 0.6 + 0.2 * Math.sin(this.t * 9); this.lamp2.distance = 4; },
      exit: () => { this.lamp2.color.setHex(0xfff0dc); },
      update: (dt, t) => {
        this.homeTV.pic.update(dt, t);
        this.fam[0].pose = 'hold'; this.fam[0].look = V(-0.5, 1.0, 1.0);
        this.fam.slice(1).forEach((P, i) => { P.pose = i === 0 ? 'talk' : 'work'; P.look = V(-0.2, 0.1, -0.5); });
      } });
  }

  // ---------- 4. Coasting on, outside ----------
  buildCoast() {
    const g = new THREE.Group();
    const SP = this.SPc = earthSpace(this.G, { earthR: 22 });
    SP.earth.position.set(-260, -60, 320); SP.sunDir.set(0.7, 0.3, 0.4).normalize();
    this.sunC = spaceSun(50); SP.group.add(this.sunC);
    const D = this.dock = docked(M, envMap('space'), { damaged: false });
    D.group.rotation.set(0, 0.6, -Math.PI / 2 + 0.1); D.group.position.set(-4, 0.6, -26); g.add(D.group);
    this.addScene('coast', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        SP.atmoU.sun.value.copy(SP.sunDir); this.sunC.position.copy(SP.sunDir).multiplyScalar(1400).add(EYE);
        this.key.position.copy(SP.sunDir).multiplyScalar(80); this.key.target.position.copy(D.group.position); this.key.intensity = 2.2;
        D.group.position.x = -4 + (this.t % 600) * 0.05; D.group.rotation.x = t * 0.02;
      } });
  }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast, B = this.board;
    Object.assign(s, { swi: 0, matt: 0, climb: 0, out: 0, tv: 0, signoff: 0 }); this.climbT = 0; this.outT = 0;
    this.crewS.forEach((P) => { P.g.visible = true; P.from = P.g.position.clone(); });
    // 1. Three days before launch
    await this.go(D, 'sim', yawTo(345), 0.1, { x: 1.5, z: 6.5 });
    s.guide = [2.4, 2.4, 4.6];
    const l2 = D.sayAsync('ch30_01');
    await D.wait(fast ? 0.5 : 3); s.swi = 1;
    await l2;
    await D.say('ch30_02');
    s.matt = 1;
    await D.say('ch30_03');
    s.matt = 0;
    this.crewS.forEach((P) => { P.from = P.g.position.clone(); }); this.climbT = 0; s.climb = 1;
    await D.wait(fast ? 2 : 9);
    // 2. Liftoff
    this.rocket.reset(); this.puffs.clear();
    await this.go(D, 'press', yawTo(355), 0.8, { x: 0, z: 1.2 });
    s.guide = [-1.5, 2.6, -1.5];
    await D.wait(fast ? 0.5 : 1.5);
    this.rocket.ignite(G, { listener: V(0, 1.6, 1.2), puffs: this.puffs });
    const l4 = D.sayAsync('ch30_04');
    await D.cue('Five minutes');
    await D.until(() => this.rocket.T > 8.9 + (fast ? 2 : 7));
    await this.go(D, 'stage', 0, 0.6, { x: 0, z: 0 });
    s.guide = [-3, 2.4, -6];
    await D.cue('problem one'); B.card(0);
    await D.cue('shuts off'); s.out = 1; G.audio.click?.(null, 0.1);
    await l4;
    const l5 = D.sayAsync('ch30_05');
    await cueNth(D, 'ch30_05', 'Tick'); B.tick(0);
    await l5;
    await D.wait(fast ? 0.5 : 2.5);
    // 3. The TV show (the music starts with this line)
    await this.go(D, 'cabin', 0, 0.8, { x: 0, z: 0 });
    s.guide = [0.3, 2.2, -1.0]; s.tv = 1;
    const l6 = D.sayAsync('ch30_06');
    await D.cue('But no TV');
    await this.go(D, 'home', yawTo(340), 0.6, { x: 1.6, z: 1.2 });
    s.guide = [0.6, 1.9, -1.0];
    await l6;
    await D.wait(fast ? 0.3 : 1.5);
    await this.go(D, 'cabin', 0, 0.6, { x: 0, z: 0 });
    s.signoff = 1;
    await D.say('ch30_07');
    s.tv = 0; click(G, null, 0.15);
    await D.wait(fast ? 0.5 : 2);
    // 4. On toward the Moon
    await this.go(D, 'coast', 0, 1.0, { x: 0, z: 0 });
    s.guide = [-2, 2.4, -6];
    await D.wait(fast ? 1 : 7);
  }
}
