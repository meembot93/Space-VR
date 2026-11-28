// Era 3, Apollo 11 part 4 (n 25): Lunar orbit. 19-20 July 1969.
//
// 1. Into the Moon's shadow: the Sun slides behind the black Moon and goes out; a ring of light
//    blooms round it, the corona (the music starts). "Look at that."
// 2. Behind the Moon, no radio: the engine fires to slow them into orbit. In Houston the room
//    waits, the big screen showing LOSS OF SIGNAL and a clock counting.
// 3. Out of the shadow, the first close craters sliding by beneath.
// 4. The next day, inside Columbia: Neil and Buzz, suited, float forward to the tunnel and Eagle.
// 5. Eagle undocks and turns slowly in front of Mike's window, its four legs out. "The Eagle has
//    wings." (Adults point at Eagle so Mike can check the legs.) "You cats take it easy..."
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo } from '../era3/base.js';
import { person, sit, wear } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { cabin, dressCabin } from '../era3/cabin.js';
import { envMap, flameMesh, cabinRumble, clank, hiss, staticBurst, quindar, beep } from '../era3/fx.js';
import { spaceSun, moonGlobe, moonGround } from '../era3/worlds.js';
import { glowSprite } from '../wow/fx.js';
import { holdProp } from '../people.js';
import { canvasTex, damp, lerp } from '../util.js';
import { rng } from '../shapes.js';

const M = await loadAll(['craft/apollo_csm', 'craft/lm_ascent', 'craft/lm_descent', 'craft/mission_control', 'props/helmet_apollo']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);
const LM_TOP_DECK = 2.62, LM_K = 0.82;

// The corona: a soft white glow with long, uneven streamers, for behind the black Moon
function coronaTex() {
  return canvasTex(512, 512, (c, w, h) => {
    const cx = w / 2, cy = h / 2, r0 = w * 0.18;
    const g = c.createRadialGradient(cx, cy, r0 * 0.9, cx, cy, w / 2); g.addColorStop(0, 'rgba(255,252,240,1)'); g.addColorStop(0.12, 'rgba(240,238,255,0.55)'); g.addColorStop(0.4, 'rgba(200,205,235,0.14)'); g.addColorStop(1, 'rgba(180,190,230,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    const r = rng(25); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, len = r0 * (0.5 + r() * (i % 9 === 0 ? 2.6 : 1.1)), wd = 0.02 + r() * 0.06;
      const gr = c.createLinearGradient(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
      gr.addColorStop(0, 'rgba(255,250,240,0.22)'); gr.addColorStop(1, 'rgba(200,210,255,0)'); c.fillStyle = gr;
      c.beginPath(); c.moveTo(cx + Math.cos(a - wd) * r0, cy + Math.sin(a - wd) * r0); c.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); c.lineTo(cx + Math.cos(a + wd) * r0, cy + Math.sin(a + wd) * r0); c.fill();
    }
    // a few pink prominences on the edge
    for (let i = 0; i < 5; i++) { const a = r() * 6.28; c.fillStyle = 'rgba(255,90,120,0.55)'; c.beginPath(); c.ellipse(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, 4 + r() * 5, 2 + r() * 3, a, 0, 7); c.fill(); }
  });
}

// Eagle: descent stage, ascent stage on top, legs out (its own origin at the bottom of the descent stage)
function eagle(env) {
  const lm = new THREE.Group(); lm.add(copy(M.lm_descent, env, 1.0)); const as = copy(M.lm_ascent, env, 1.0); as.position.y = LM_TOP_DECK; lm.add(as);
  lm.userData.top = LM_TOP_DECK + (M.lm_ascent?.size.y || 4.2);
  return lm;
}
// Columbia with Eagle docked on its nose: the stack's middle near the origin, the CM's nose along +y
function stack(env) {
  const g = new THREE.Group();
  const cm = copy(M.apollo_csm, env, 1.1); g.add(cm);
  const nose = new THREE.Box3().setFromObject(cm).max.y;
  const lm = eagle(env); lm.scale.setScalar(LM_K); lm.rotation.x = Math.PI; lm.position.y = nose + 0.2 + lm.userData.top * LM_K; g.add(lm);
  const sps = flameMesh(5, 0.8, 'hyper'); sps.position.y = new THREE.Box3().setFromObject(cm).min.y; g.add(sps); sps.userData.set(0, 0);
  g.userData = { cm, lm, sps, nose };
  return g;
}

// The Moon's face from low orbit: a cratered patch 3 km across, bent to a small sphere (so the horizon
// is near), turning slowly under you on a pivot far below, so the craters slide by
const ORB_R = 3000, ORB_H = 190;
function orbitGround(seed) {
  const r = rng(seed), craters = [];
  for (let i = 0; i < 90; i++) { const rad = 15 + Math.pow(r(), 2.2) * 190; craters.push([(r() - 0.5) * 2900, (r() - 0.5) * 2900, rad, rad * (0.16 + r() * 0.08)]); }
  const MG = moonGround({ size: 3000, seg: 230, seed, craters, rocks: 0 });
  const p = MG.ground.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) * 1.6 - (x * x + z * z) / (2 * ORB_R)); }
  MG.ground.geometry.computeVertexNormals(); MG.ground.frustumCulled = false;
  MG.ground.material.map.repeat.set(1, 1);
  const pivot = new THREE.Group(); pivot.position.y = 1.6 - ORB_H - ORB_R; MG.group.position.y = ORB_R; pivot.add(MG.group);
  pivot.rotation.x = -500 / ORB_R;          // start near the back, so the far edge stays beyond the horizon
  pivot.userData.slide = (dt, speed = 14) => { pivot.rotation.x = Math.min(pivot.rotation.x + dt * speed / ORB_R, 0); };
  return pivot;
}

// Houston's big screen: the Moon, the ship's path round behind it, and the count since the signal went
function drawLOS(c, w, h, t, los) {
  c.fillStyle = '#081018'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(90,160,200,0.25)'; c.lineWidth = 1; for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  const cx = w * 0.36, cy = h * 0.52, R = h * 0.3;
  c.fillStyle = '#2a3440'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill(); c.strokeStyle = '#8ab8d8'; c.lineWidth = 3; c.stroke();
  c.setLineDash([8, 8]); c.strokeStyle = '#d8e8a0'; c.beginPath(); c.ellipse(cx, cy, R * 1.25, R * 1.25, 0, 0, 7); c.stroke(); c.setLineDash([]);
  const a = -Math.PI / 2 + (los ? 0.6 + (t * 0.02) % 1.6 : 0.3); c.fillStyle = los ? '#f8a040' : '#f8f0a0'; c.beginPath(); c.arc(cx + Math.cos(a + Math.PI) * R * 1.25, cy + Math.sin(a + Math.PI) * R * 1.25, 7, 0, 7); c.fill();
  c.fillStyle = '#c8e0f0'; c.font = 'bold 30px monospace'; c.textAlign = 'left'; c.fillText('APOLLO 11   LUNAR ORBIT INSERTION', 24, 44);
  c.fillStyle = '#88a8c0'; c.font = '24px monospace'; c.fillText('EARTH', w * 0.06, h * 0.95);
  if (los) {
    const on = Math.sin(t * 3) > -0.3;
    c.fillStyle = on ? '#f86040' : '#602818'; c.font = 'bold 48px monospace'; c.textAlign = 'center'; c.fillText('LOSS OF SIGNAL', w * 0.76, h * 0.42);
    const s = Math.floor(t), mm = String(Math.floor(s / 60) % 60).padStart(2, '0'), ss = String(s % 60).padStart(2, '0');
    c.fillStyle = '#f8d080'; c.font = 'bold 56px monospace'; c.fillText(`00:${mm}:${ss}`, w * 0.76, h * 0.6);
    c.fillStyle = '#88a8c0'; c.font = '22px monospace'; c.fillText('SPS BURN  -  NO DATA', w * 0.76, h * 0.72);
  }
}

export default class A11Orbit extends Chapter3 {
  constructor(G) {
    super(G, 25);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { eclipse: 0, corona: 0, burn: 0, los: 0, orbit: 0, float: 0, undock: 0, legs: 0 });
    this.buildShadow(); this.buildMCC(); this.buildOrbit(); this.buildTunnel(); this.buildUndock();
    Object.assign(G.narration.radio, { ch25_07: 'nasa', ch25_09: 'nasa' });
  }

  // ---------- 1 & 2. Into the shadow: the corona, then the burn ----------
  buildShadow() {
    const g = new THREE.Group();
    // the Moon ahead, about 40 degrees across: its night side towards you, faintly lit by the Earth
    this.moonDir = V(0.15, 0.22, -1).normalize();
    const moon = this.moonS = moonGlobe(260, { relief: 1.0 }); moon.position.copy(this.moonDir).multiplyScalar(720).add(EYE); g.add(moon);
    moon.userData.mat.uniforms.earth.value = 0.06;
    // the Sun, sliding in behind the Moon's edge; the corona round the black disc
    this.sunS = spaceSun(110); g.add(this.sunS);
    this.corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: coronaTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.corona.position.copy(this.moonDir).multiplyScalar(1500).add(EYE); this.corona.scale.setScalar(260 * 2 * (1500 / 720) * 2.8); this.corona.renderOrder = -1; g.add(this.corona);
    // the ship, lying across in front of you, Columbia's engine bell towards you
    const st = this.stackS = stack(envMap('space')); st.rotation.set(0, 0.5, -Math.PI / 2 - 0.15); st.position.set(-5, -1.6, -20); g.add(st);
    this.addScene('shadow', { group: g, bounds: 0.4, amb: 0, fogFar: 9000,
      enter: () => { this.G.sky.set(200, -60); },
      update: (dt, t) => {
        const s = this.s;
        // the Sun: just off the Moon's edge, then sliding behind it
        this.eclK = clamp01((this.eclK || 0) + (s.eclipse ? dt * this.F / 7 : 0));
        const off = lerp(1.8, 0.5, ease(this.eclK));   // in Moon radii from its middle
        const sunDir = this.moonDir.clone().addScaledVector(V(1, 0.25, 0).normalize(), off * Math.atan(260 / 720)).normalize();
        this.sunS.position.copy(sunDir).multiplyScalar(1400).add(EYE); this.sunS.visible = off > 1.12;
        this.sunS.children[1].material.opacity = 0.35 * clamp01((off - 1.12) / 0.2);
        moon.userData.setSun(sunDir);
        // the corona blooms once the Sun is gone
        this.corK = clamp01((this.corK || 0) + (s.corona ? dt * this.F / 4 : 0));
        this.corona.material.opacity = ease(this.corK) * 0.95; this.corona.material.rotation = t * 0.003;
        // light on the ship: sunlit, then only the faint glow of the corona; the burn lights it orange
        this.key.position.copy(sunDir).multiplyScalar(80); this.key.target.position.copy(st.position); this.key.intensity = lerp(2.2, 0.0, ease(this.eclK)) + 0.25 * ease(this.corK);
        this.sG = s.burn ? (this.sG || 0) + dt * this.F : 0;
        st.userData.sps.userData.set(s.burn ? 0.85 + 0.15 * Math.sin(t * 31) : 0, t);
        this.flameLight.position.copy(st.position).add(V(-9, 0, 2)); this.flameLight.intensity = s.burn ? 8 : 0; this.flameLight.distance = 30;
        st.position.x = -5 - this.sG * 0.04;
      } });
  }

  // ---------- 2. Houston waits ----------
  buildMCC() {
    const g = new THREE.Group();
    g.add(copy(M.mission_control, envMap('room'), 0.6));
    const seats = [[-4.5, 3.8, 'eng_white_shirt'], [1.5, 3.8, 'eng_blue_shirt'], [4.5, 3.8, 'eng_black'], [-3.0, 1.8, 'eng_blue_shirt'], [3.0, 1.8, 'eng_white_shirt']];
    this.ctl = seats.map(([x, z, who]) => { const P = person(g, who, V(x, 0, z), Math.PI); sit(P); P.look = V(x * 0.3, 3, -9); return P; });
    this.duke = person(g, 'duke', V(0, 0, 1.8), Math.PI); sit(this.duke); this.duke.look = V(0, 3, -9);
    this.bales = person(g, 'bales', V(-1.5, 0, 3.8), Math.PI); sit(this.bales); this.bales.look = V(-0.5, 3, -9);
    this.kranzM = person(g, 'kranz', V(1.4, 0, 5.6), Math.PI + 0.3); this.kranzM.look = V(0, 3, -9);
    this.people.push(...this.ctl, this.duke, this.bales, this.kranzM);
    const tex = this.losTex = canvasTex(1024, 384, (c, w, h) => drawLOS(c, w, h, 0, false));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.set(0, 3.2, -9.9); g.add(scr);
    this.addScene('mcc', { group: g, bounds: 1.2, indoors: true, place: { lat: 29.6, year: 1969, sunLon: 117 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(250, 30); this.G.sky.hemi.intensity = 0.9; this.lamp.position.set(0, 5, 4); this.lamp.intensity = 3.2; this.lamp.distance = 22; this.lamp2.position.set(0, 3.5, -8); this.lamp2.color.setHex(0x9ac8ff); this.lamp2.intensity = 1.2; this.lamp2.distance = 12; },
      exit: () => { this.lamp2.color.setHex(0xfff0dc); },
      update: (dt, t) => {
        const s = this.s;
        this.losT = s.los ? (this.losT || 0) + dt * this.F * 6 : 0;   // the clock runs fast: 6 s a second
        if ((this.lAcc = (this.lAcc || 0) + dt) > 0.2) { this.lAcc = 0; drawLOS(this.losTex.image.getContext('2d'), 1024, 384, this.losT, !!s.los); this.losTex.needsUpdate = true; }
        this.kranzM.pose = 'idle'; this.duke.pose = s.los ? 'idle' : 'talk';
      } });
  }

  // ---------- 3. In orbit: craters sliding by ----------
  buildOrbit() {
    const g = new THREE.Group();
    const moon = this.moonO = orbitGround(31); g.add(moon);
    const st = this.stackO = stack(envMap('moon')); st.rotation.set(0.1, 0.2, -Math.PI / 2); st.position.set(-1.0, 1.0, -13); g.add(st);
    this.sunO = spaceSun(60); g.add(this.sunO);
    this.addScene('orbit', { group: g, bounds: 0.4, amb: 0, fogFar: 9000,
      enter: () => { this.G.sky.set(200, -60); },
      update: (dt, t) => {
        moon.userData.slide(dt * this.F);
        const sd = V(-0.95, 0.16, 0.25).normalize(); this.sunO.position.copy(sd).multiplyScalar(1400).add(EYE);
        this.key.position.copy(sd).multiplyScalar(50); this.key.target.position.copy(st.position); this.key.intensity = 2.0;
        st.rotation.y = 0.2 + Math.sin(t * 0.05) * 0.05;
      } });
  }

  // ---------- 4. Inside Columbia: Neil and Buzz go up the tunnel to Eagle ----------
  buildTunnel() {
    const g = new THREE.Group();
    const C = this.Ct = cabin('apollo', { seat: 'center' }); g.add(C.group);
    dressCabin(C);
    // suited, gloves on; Buzz ahead of Neil, both floating forward over the panel to the tunnel
    this.neilT = person(C.group, 'armstrong', V(-1.0, 0.45, -0.25), 0.9); this.buzzT = person(C.group, 'aldrin', V(0.95, 0.3, -0.3), -1.1);
    holdProp(this.neilT, copy(M.helmet_apollo), 'Right', [0, 0.12, 0.05]);
    this.people.push(this.neilT, this.buzzT);
    this.addScene('tunnel', { group: g, bounds: 0.2, indoors: true, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); this.G.sky.set(200, -60); },
      update: (dt, t) => {
        const s = this.s;
        this.flK = s.float ? (this.flK || 0) + dt * this.F : 0;
        const k = this.flK;
        // both drift up towards the hatch and the tunnel overhead
        this.neilT.g.position.y = 0.45 + Math.min(k * 0.03, 0.45) + Math.sin(t * 0.5) * 0.03; this.buzzT.g.position.y = 0.3 + Math.min(k * 0.035, 0.5) + Math.sin(t * 0.45 + 1) * 0.03;
        this.neilT.g.rotation.z = 0.1 + Math.sin(t * 0.4) * 0.05; this.buzzT.g.rotation.z = -0.1 + Math.sin(t * 0.35 + 1) * 0.05;
        this.key.position.set(-3, 6, 2); this.key.target.position.set(0, 1.4, 0); this.key.intensity = 0.8;
      } });
  }

  // ---------- 5. Eagle has wings ----------
  buildUndock() {
    const g = new THREE.Group();
    const moon = this.moonU = orbitGround(47); g.add(moon);
    // Columbia just beside you, nose towards Eagle
    const csm = this.csmU = copy(M.apollo_csm, envMap('moon'), 1.1); csm.rotation.set(0, 0, -Math.PI / 2 - 0.1); csm.position.set(-4.5, 0.4, -4.5); csm.rotation.y = 0.5; g.add(csm);
    // Eagle, out in front, turning slowly
    const lm = this.eagleU = eagle(envMap('moon')); const piv = this.eaglePiv = new THREE.Group(); lm.position.y = -LM_TOP_DECK; piv.add(lm); piv.position.set(2, 2.4, -24); g.add(piv);
    // a soft glow at each footpad, to show the legs checked (the model's four pads are fore, aft, left and right)
    const b = new THREE.Box3().setFromObject(lm), rx = (b.max.x - b.min.x) * 0.46, rz = (b.max.z - b.min.z) * 0.46, fy = b.min.y + 0.2;
    this.pads = [[rx, 0], [-rx, 0], [0, rz], [0, -rz]].map(([x, z]) => { const sp = glowSprite(0x9adcff, 1.6, 0); sp.position.set(x, fy, z); piv.add(sp); return sp; });
    this.eagleIt = this.touchable('eagle', piv, { hint: 'Point at Eagle, so Mike can check its four legs', deskHint: 'Click on Eagle to check its legs', r: 4.5, grab: false });
    this.sunU = spaceSun(60); g.add(this.sunU);
    this.addScene('undock', { group: g, bounds: 0.4, amb: 0, fogFar: 9000,
      enter: () => { this.G.sky.set(200, -60); },
      update: (dt, t) => {
        const s = this.s;
        moon.userData.slide(dt * this.F, 6);
        const sd = V(0.85, 0.2, 0.5).normalize(); this.sunU.position.copy(sd).multiplyScalar(1400).add(EYE);
        this.key.position.copy(sd).multiplyScalar(50); this.key.target.position.copy(piv.position); this.key.intensity = 2.2;
        // undocked: Eagle drifts out and pirouettes, slow and steady
        this.udK = clamp01((this.udK || 0) + (s.undock ? dt * this.F / 10 : 0));
        piv.position.set(2 - 1.5 * ease(this.udK), 2.4 - ease(this.udK) * 1.5, lerp(-8, -17, ease(this.udK)));
        this.spin = (this.spin || 0) + (s.undock ? dt * this.F * 0.12 : 0); piv.rotation.set(0.08, this.spin, 0.05);
        this.legK = damp(this.legK || 0, s.legs ? 1 : 0, 2, dt);
        this.pads.forEach((p, i) => { p.material.opacity = this.legK * (0.5 + 0.3 * Math.sin(t * 4 + i)); });
      } });
  }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. Into the shadow
    s.eclipse = 0; s.corona = 0; s.burn = 0; this.eclK = 0; this.corK = 0;
    await this.go(D, 'shadow', 0, 0.1, { x: 0, z: 0 });
    s.guide = [-3, 2.6, -6];
    s.eclipse = 1;
    await D.say('ch25_01');
    await D.until(() => this.eclK >= 1);
    s.corona = 1;
    await D.say('ch25_02');          // the music begins here
    this.guideTo(this.moonS.position.clone().normalize().multiplyScalar(12).add(EYE), 1.5, 3);
    await D.say('ch25_03');
    await D.wait(fast ? 0.5 : 3);
    // 2. The burn behind the Moon, Houston waiting
    s.burn = 1; cabinRumble(G, 8, 0.2);
    const l4 = D.sayAsync('ch25_04');
    await D.cue('Houston');
    s.burn = 0; s.los = 1; this.losT = 0;
    await this.go(D, 'mcc', yawTo(320), 0.6, { x: 6, z: 6 });
    s.guide = [4.2, 2.4, 4.4];
    await l4;
    await D.wait(fast ? 0.5 : 4);
    staticBurst(G, 0.5, 0.15); quindar(G, true, 0.1); s.los = 0;
    await D.wait(fast ? 0.3 : 1.2);
    // 3. Craters below
    await this.go(D, 'orbit', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-3, 2.6, -6];
    await D.say('ch25_05');
    await D.wait(fast ? 0.5 : 3);
    // 4. The next day: into Eagle
    s.float = 0; this.flK = 0;
    await this.go(D, 'tunnel', 0, 0.9, { x: 0, z: 0 });
    s.guide = [-0.4, 2.1, -0.9];
    s.float = 1;
    await D.say('ch25_06');
    await D.wait(fast ? 0.3 : 1.5);
    // 5. Undocking
    s.undock = 0; s.legs = 0; this.udK = 0; this.spin = 0;
    await this.go(D, 'undock', 0, 0.9, { x: 0, z: 0 });
    s.guide = [-2.5, 2.6, -6];
    clank(G, null, 0.2); hiss(G, null, 0.12, 0.8);
    s.undock = 1;
    await D.say('ch25_07');
    await D.say('ch25_08');
    if (!D.kids) await this.ask(D, 'eagle', { hint: this.eagleIt.hint, deskHint: this.eagleIt.deskHint, after: 1, timeout: 15 });
    s.legs = 1; beep(G, null, 0.08, 1200, 0.2);
    await D.wait(fast ? 0.3 : 2);
    await D.say('ch25_09');
    await D.wait(fast ? 0.5 : 4);
  }
}
