// Era 3, Apollo 13 part 5 (n 34): The Way Home. 16-17 April 1970.
//
// 1. Drifting off course (problem 10), the computer off: Lovell keeps the edge of the Earth on the
//    window's crosshair while Haise steers and Swigert times the burn (Adults hold it on). Tick.
// 2. The simulator in Houston: Ken Mattingly and John Aaron write a new way to wake Odyssey on a
//    tiny power budget (problem 11). Tick. Power flows backwards from Aquarius (problem 12). Tick.
// 3. They let the Service Module go, and see it: "There's one whole side of that spacecraft
//    missing!" Then Aquarius pushed clear (problem 13): "Farewell, Aquarius, and we thank you."
// 4. Reentry: the fire, then the silence. Four minutes, five, six; Mission Control waits. "Okay, Joe."
//    (the music starts and plays to the end). Three parachutes; cheers and cigars in Houston; the
//    board, full of ticks.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { yawTo } from '../era3/base.js';
import { person, sit } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { cabin, dressCabin } from '../era3/cabin.js';
import { envMap, cabinRumble, click, clank, hiss, wave } from '../era3/fx.js';
import { earthSpace, spaceSun, sea } from '../era3/worlds.js';
import { Apollo13, mcc13, MCC_SPOT, simHall, backRoom, cueNth, docked, splitSM, coldCabin, cmOnly, chute } from '../era3/a13.js';
import { holdProp } from '../people.js';
import { glowSprite, rumble } from '../wow/fx.js';
import { canvasTex, lerp } from '../util.js';
import { rng } from '../shapes.js';

const M = await loadAll(['craft/apollo_csm', 'craft/lm_ascent', 'craft/lm_descent', 'craft/mission_control', 'props/helmet_apollo']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);

// The Earth as a lit disc, half in shadow (its sunlit edge is what Lovell kept on the crosshair)
function earthDisc() {
  const tex = canvasTex(256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w * 0.4, h * 0.4, 4, w / 2, h / 2, w / 2); g.addColorStop(0, '#6aa8e8'); g.addColorStop(0.8, '#2a5aa8'); g.addColorStop(1, '#0a1a3a');
    c.fillStyle = g; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill();
    const r = rng(9); c.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(r() * w, r() * h, 6 + r() * 26, 3 + r() * 8, r() * 3, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(150,120,70,0.8)'; c.beginPath(); c.ellipse(w * 0.55, h * 0.5, 30, 50, 0.4, 0, 7); c.fill();
    c.globalCompositeOperation = 'destination-in'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill();
    c.globalCompositeOperation = 'source-over'; const s = c.createLinearGradient(0, 0, w, 0); s.addColorStop(0.5, 'rgba(0,0,0,0)'); s.addColorStop(0.62, 'rgba(0,0,10,0.97)'); c.fillStyle = s; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 1, 0, 7); c.fill();
  });
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false }));
}
// The big screen in Mission Control during the blackout: the clock counting up, and nothing else
function drawLOS(c, w, h, secs, contact) {
  c.fillStyle = '#05080a'; c.fillRect(0, 0, w, h);
  c.fillStyle = contact ? '#7aff9a' : '#ff6a4a'; c.font = 'bold 54px monospace'; c.textAlign = 'center';
  c.fillText(contact ? 'SIGNAL' : 'NO SIGNAL', w / 2, h * 0.3);
  const m = Math.floor(secs / 60), s = Math.floor(secs % 60);
  c.fillStyle = '#e8ffe8'; c.font = 'bold 120px monospace'; c.fillText(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, w / 2, h * 0.68);
  c.fillStyle = '#7a8a7a'; c.font = '28px monospace'; c.fillText('ODYSSEY  ENTRY  BLACKOUT', w / 2, h * 0.9);
}

export default class A13Home extends Apollo13 {
  constructor(G) {
    super(G, 34);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { aim: 0, burn: 0, power: 0, smSep: 0, lmSep: 0, heat: 0, los: 0, contact: 0, chutes: 0, cheer: 0 });
    this.buildAquarius(); this.buildSim(); this.buildOutside(); this.buildReentry(); this.buildMCC(); this.buildSea(); backRoom(this, 'board', this.board);
    this.buildBoardRoom();
    Object.assign(G.narration.radio, { ch34_11: 'nasa', ch34_13: 'nasa', ch34_15: 'nasa' });
  }

  // ---------- 1. Flying by hand ----------
  buildAquarius() {
    const g = new THREE.Group();
    const C = this.Ca = cabin('lm'); g.add(C.group);
    dressCabin(C);
    this.lovA = person(C.group, 'lovell', C.crew[0].pos.clone(), 0.15);
    this.haiA = person(C.group, 'haise', C.crew[1].pos.clone(), -0.25);
    this.swiA = person(C.group, 'swigert', V(0.15, 0.0, 0.35), -0.2);
    this.people.push(this.lovA, this.haiA, this.swiA);
    const wl = C.windows.find((w) => w.name === 'left'); this.wdir = wl.local.clone().normalize();
    this.reticle = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(128, 128, (c, w, h) => { c.strokeStyle = 'rgba(255,170,60,0.95)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 6); c.lineTo(w / 2, h - 6); c.moveTo(6, h / 2); c.lineTo(w - 6, h / 2); c.stroke(); }) }));
    this.reticle.position.copy(this.wdir).multiplyScalar(wl.local.length() - 0.05).add(EYE); this.reticle.lookAt(EYE); C.group.add(this.reticle);
    this.earthA = earthDisc(); g.add(this.earthA);
    this.aimIt = this.touchable('aim', () => (C.handController ? C.handController.getWorldPosition(new THREE.Vector3()) : C.group.localToWorld(V(0.32, 0.98, -0.32))), { hint: 'Grip the hand controller by your right hand to hold the Earth’s edge on the crosshair', deskHint: 'Click the hand controller by your right hand', r: 0.2 });
    this.hcGlow = glowSprite(0x80c0ff, 0.25, 0); C.group.add(this.hcGlow);
    this.burnGlow = glowSprite(0xffb060, 0.6, 0); this.burnGlow.position.set(0, 0.2, -1.2); C.group.add(this.burnGlow);
    this.coldFn = coldCabin(C, g, () => [this.lovA, this.haiA, this.swiA].map((P) => P.g.localToWorld(V(0, 1.62, 0.12))));
    this.addScene('aquarius', { group: g, bounds: 0.25, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { this.G.sky.set(200, -40); },
      update: (dt, t) => {
        const s = this.s;
        C.lights(true, 0.18);
        this.coldFn(dt, t, 0.9);
        // the Earth: its lit edge wanders off the crosshair, then is held on it
        this.aK = s.aim ? clamp01((this.aK || 0) + dt * this.F / 2.5) : 0;
        const drift = V(Math.sin(t * 0.4) * 0.12, Math.cos(t * 0.33) * 0.08, 0).multiplyScalar(1 - ease(this.aK) * 0.92);
        const R = 110, d = 1200;   // the disc's radius and distance; its sunlit edge (the left one) on the cross
        this.earthA.scale.setScalar(R * 2);
        this.earthA.position.copy(this.wdir).add(drift).normalize().multiplyScalar(d).add(EYE).add(V(R * 0.9, 0, 0));
        this.key.position.set(-6, 3, -3); this.key.target.position.set(0, 1.4, 0); this.key.intensity = 0.3;
        this.burnGlow.material.opacity = s.burn ? 0.15 + 0.1 * Math.sin(t * 30) : 0;
        if (C.handController) { this.hcGlow.position.copy(C.handController.position).add(V(0, 0.08, 0)); this.hcGlow.material.opacity = s.want === 'aim' ? 0.5 + 0.4 * Math.sin(t * 6) : 0; }
        this.lovA.look = C.group.localToWorld(this.reticle.position.clone()); this.lovA.pose = s.aim ? 'work' : 'idle';
        this.haiA.pose = s.aim ? 'work' : 'idle'; this.swiA.pose = s.burn ? 'point' : 'idle'; this.swiA.look = V(0, 1.4, -0.5);
      } });
  }

  // ---------- 2. The simulator ----------
  buildSim() {
    const S = simHall(this, 'sim', { year: 1970 }), g = S.g;
    this.matt = person(g, 'ken_mattingly', V(-0.9, 1.9, -1.0), 0.4);
    this.aaron = person(g, 'john_aaron', V(4.8, 0, -0.6), -1.2);
    this.simEng = [['eng_white_shirt', 5.7, -3.2, Math.PI / 2], ['eng_blue_shirt', 5.7, 1.4, Math.PI / 2]].map(([w, x, z, yaw]) => { const P = person(g, w, V(x, 0, z), yaw); sit(P); return P; });
    const ck = new Kit(); ck.box(0.22, 0.3, 0.015, 0x6a4a2a, [0, 0, 0]); ck.box(0.2, 0.26, 0.004, 0xf4f0e8, [0, 0, 0.01]);
    holdProp(this.aaron, ck.mesh(FLAT), 'Left', [0, 0.06, 0.04]);
    this.people.push(this.matt, this.aaron, ...this.simEng);
    const S0 = this.scenes.sim, up = S0.update;
    S0.update = (dt, t) => {
      up?.(dt, t);
      const s = this.s;
      this.aaron.pose = s.aaronTalk ? 'talk' : 'hold'; this.aaron.look = this.matt.g.position.clone().add(V(0, 1.6, 0));
      this.matt.pose = s.mattTalk ? 'talk' : 'idle'; this.matt.look = this.aaron.g.position.clone().add(V(0, 1.6, 0));
      this.simEng.forEach((P) => { P.pose = 'work'; P.look = V(7, 1.1, P.g.position.z); });
    };
  }

  // ---------- 3. Outside: the Service Module let go, then Aquarius ----------
  buildOutside() {
    const g = new THREE.Group();
    const SP = this.SPo = earthSpace(this.G, { earthR: 40 });
    SP.earth.position.set(-180, -60, -420); SP.sunDir.set(0.6, 0.4, 0.5).normalize();
    this.sunO = spaceSun(50); SP.group.add(this.sunO);
    const env = envMap('space');
    const D = this.dk = docked(M, env, { damaged: true });
    const SPL = this.spl = splitSM(D, M, env);
    D.group.rotation.set(0, 0.3, -Math.PI / 2 + 0.1); D.group.position.set(-2, 0.6, -22); g.add(D.group);
    // the power pulse, running from Aquarius back into Odyssey along the tunnel
    this.pulse = glowSprite(0x80c8ff, 1.6, 0); g.add(this.pulse);
    this.addScene('outside', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s;
        SP.atmoU.sun.value.copy(SP.sunDir); this.sunO.position.copy(SP.sunDir).multiplyScalar(1400).add(EYE);
        this.key.position.copy(SP.sunDir).multiplyScalar(80); this.key.target.position.copy(D.group.position); this.key.intensity = 2.4;
        // the Service Module drifts back and turns, showing its open side
        this.smK = s.smSep ? clamp01((this.smK || 0) + dt * this.F / 16) : 0;
        SPL.sm.position.set(0, -ease(this.smK) * 13, ease(this.smK) * 5); SPL.sm.rotation.set(ease(this.smK) * 0.25, Math.sin(this.smK * 3) * 0.3, ease(this.smK) * 0.5);
        // Aquarius pushed away
        this.lmK = s.lmSep ? clamp01((this.lmK || 0) + dt * this.F / 14) : 0;
        D.lm.position.y = D.nose + 0.15 + D.lmTop + ease(this.lmK) * 30; D.lm.rotation.x = ease(this.lmK) * 0.5;
        SPL.clipCM(); SPL.clipSM();
        // the power pulse
        const a = D.lm.getWorldPosition(new THREE.Vector3()), b = D.csm.localToWorld(V(0, 1.5, 0)), f = (t * 0.6) % 1;
        this.pulse.position.lerpVectors(a, b, f); this.pulse.material.opacity = s.power ? 0.8 * Math.sin(Math.PI * f) : 0;
      } });
  }

  // ---------- 4. Reentry, inside Odyssey ----------
  buildReentry() {
    const g = new THREE.Group();
    const C = this.Cr = cabin('apollo', { seat: 'center' }); g.add(C.group);
    dressCabin(C);
    this.lovR = person(C.group, 'lovell', C.crew[0].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.lovR);
    this.haiR = person(C.group, 'haise', C.crew[1].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.haiR);
    this.people.push(this.lovR, this.haiR);
    this.fire = C.windows.map((w) => { const s = glowSprite(0xff8030, 0.9, 0); s.position.copy(w.local).multiplyScalar(1.05).add(EYE); C.group.add(s); return s; });
    this.addScene('reentry', { group: g, bounds: 0.2, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true, 0.5); this.G.sky.set(200, -70); },
      update: (dt, t) => {
        const s = this.s;
        this.hK = s.heat ? (this.hK || 0) + dt * this.F / 12 : 0;
        const k = this.hK, glow = k < 0.15 ? k / 0.15 : k < 0.8 ? 1 : Math.max(0, 1 - (k - 0.8) / 0.15);
        const col = new THREE.Color(0xff6a20).lerp(new THREE.Color(0xfff4e0), clamp01((k - 0.25) / 0.3) * (k < 0.7 ? 1 : 0.4));
        this.fire.forEach((f, i) => { f.material.color.copy(col); f.material.opacity = glow * (0.8 + 0.2 * Math.sin(t * 23 + i)); f.scale.setScalar(0.9 + glow * 0.5); });
        this.lamp.position.set(0, 2.2, -1.0); this.lamp.color.copy(col); this.lamp.intensity = glow * 3.5; this.lamp.distance = 4;
        if (s.heat && glow > 0.3) C.group.position.set((Math.random() - 0.5) * 0.006 * glow, (Math.random() - 0.5) * 0.006 * glow, 0); else C.group.position.set(0, 0, 0);
        if (s.heat && (this.rT = (this.rT || 0) - dt) <= 0) { this.rT = 3; cabinRumble(this.G, 4, 0.18 * glow + 0.02); }
      },
      exit: () => { this.lamp.color.setHex(0xffe8c8); } });
  }

  // ---------- 4. Mission Control: the silence, then "Okay, Joe" ----------
  buildMCC() {
    const R = this.R = mcc13(this, M, 'mcc', { screen: (c, w, h) => drawLOS(c, w, h, this.losT || 0, this.s.contact) });
    // cigars, for later
    this.cigars = [R.kranz, R.lieb, ...R.ctl.slice(0, 3)].map((P) => { const k = new Kit(); k.cyl(0.008, 0.008, 0.12, 6, 0x6a4a2a, [0, 0, 0], [0, 0, Math.PI / 2]); const m = k.mesh(FLAT); m.visible = false; holdProp(P, m, 'Right', [0, 0.05, 0.04]); return m; });
    this.smoke = this.cigars.map(() => { const s = glowSprite(0xd8d8d8, 0.2, 0); R.g.add(s); return s; });
    this.scenes.mcc.update = ((up) => (dt, t) => {
      const s = this.s;
      this.losT = s.los && !s.contact ? (this.losT || 0) + dt * this.F * (this.fast ? 1 : 1.0) * this.losRate : this.losT || 0;
      up(dt, t);
      const all = [R.kranz, R.lieb, R.capcom, ...R.ctl];
      all.forEach((P, i) => {
        if (s.cheer) { if (P.sitting) sit(P, false); P.pose = i % 3 === 0 ? 'cheer' : i % 3 === 1 ? 'wave' : 'cheer'; }
        else P.pose = s.los ? 'idle' : 'idle';
        P.look = V(0, 3.2, -9.9);
      });
      this.cigars.forEach((m) => { m.visible = !!s.cheer; });
      this.smoke.forEach((sp, i) => { const m = this.cigars[i]; if (!s.cheer) { sp.material.opacity = 0; return; } m.getWorldPosition(sp.position); R.g.worldToLocal(sp.position); sp.position.y += 0.15 + ((t * 0.3 + i * 0.37) % 1) * 0.5; sp.material.opacity = 0.25 * (1 - ((t * 0.3 + i * 0.37) % 1)); sp.scale.setScalar(0.15 + ((t * 0.3 + i * 0.37) % 1) * 0.4); });
    })(this.scenes.mcc.update);
  }

  // ---------- 4. Splashdown ----------
  buildSea() {
    const g = new THREE.Group();
    const S = this.seaM = sea({ size: 6000, col: 0x1a4a7a, sky: 0x8ab8e8, sun: V(0.4, 0.7, -0.4) }); S.position.y = -0.3; g.add(S);
    const cm = this.cmS = new THREE.Group(); const o = copy(M.apollo_csm, envMap('day'), 0.9); cm.add(o); g.add(cm); this.cmClip = cmOnly(o);
    this.chutes = [0, 1, 2].map((i) => { const c = chute(4.2); const a = i / 3 * Math.PI * 2; c.userData.off = V(Math.cos(a) * 3.6, 12.5, Math.sin(a) * 3.6); g.add(c); return c; });
    this.splash = glowSprite(0xffffff, 14, 0); g.add(this.splash);
    // USS Iwo Jima on the horizon, a helicopter overhead
    const sk = new Kit(); sk.box(30, 8, 200, 0x6a7074, [0, 2, 0]); sk.box(8, 14, 30, 0x7a8084, [10, 14, -20]);
    const ship = sk.mesh(FLAT); ship.position.set(260, 0, -900); ship.rotation.y = 0.5; g.add(ship);
    this.heli = new THREE.Group(); const hk = new Kit(); hk.ball(1.4, 1, 0x3a4a5a, [0, 0, 0], 0, [1.6, 1, 1]); hk.cyl(0.25, 0.15, 5, 6, 0x3a4a5a, [0, 0.2, 4], [Math.PI / 2, 0, 0]); hk.box(9, 0.06, 0.4, 0x222222, [0, 1.6, 0]); hk.box(0.4, 0.06, 9, 0x222222, [0, 1.6, 0]);
    this.heli.add(hk.mesh(FLAT)); g.add(this.heli);
    this.addScene('sea', { group: g, bounds: 0.6, place: { lat: -21.6, year: 1970, sunLon: 27 }, amb: 0.5, fogFar: 4000, mist: 0.05,
      height: () => 0.6,
      sky: () => { this.G.sky.set(60, 38); this.key.position.set(40, 70, -30); this.key.target.position.set(0, 0, -30); this.key.intensity = 2.6; },
      update: (dt, t) => {
        const s = this.s;
        this.seaM.userData.update?.(t);
        this.dK = s.chutes ? clamp01((this.dK || 0) + dt * this.F / (s.down ? 3 : 24)) : 0;
        const y = lerp(55, 0.2, this.dK), base = V(-3, y, -16);
        if (this.dK < 1) { cm.position.copy(base); cm.rotation.set(0, 0, 0); }
        else { cm.position.set(base.x, -0.6 + Math.sin(t * 0.9) * 0.2, base.z); cm.rotation.set(Math.sin(t * 0.7) * 0.06, 0.4, Math.cos(t * 0.8) * 0.06); }
        this.cmClip();
        this.chutes.forEach((c, i) => {
          const open = s.chutes ? clamp01((this.dK - i * 0.02) * 12) : 0;
          c.visible = open > 0 && this.dK < 1.0;
          c.position.copy(cm.position).add(c.userData.off.clone().multiplyScalar(lerp(0.6, 1, open))).add(V(Math.sin(t * 0.6 + i) * 0.4, 0, Math.cos(t * 0.5 + i) * 0.4));
          c.scale.set(lerp(0.2, 1, ease(open)), lerp(1.4, 1, ease(open)), lerp(0.2, 1, ease(open)));
          c.lookAt(cm.position.clone().add(V(0, -40, 0))); c.rotateX(-Math.PI / 2);
        });
        if (this.dK >= 1 && !this.splashed) { this.splashed = true; this.spT = 0; wave(this.G, cm.position, 0.5); }
        if (this.spT != null) { this.spT += dt; this.splash.position.copy(cm.position).add(V(0, 1.5, 0)); this.splash.material.opacity = Math.max(0, 0.9 - this.spT * 0.5); this.splash.scale.setScalar(10 + this.spT * 6); }
        this.heli.position.set(cm.position.x + 30 - (t % 40) * 0.3, 28, cm.position.z - 20); this.heli.rotation.y = 1.2;
      } });
  }

  // ---------- 4. The back room: the board, full ----------
  buildBoardRoom() {
    const g = this.scenes.board.group;
    this.boardFolk = [['ed_smylie', -1.5, -2.0, 0.2], ['eng_white_shirt', 1.6, -1.8, -0.4], ['eng_blue_shirt', -0.4, -1.4, 0.1], ['eng_black', 2.4, -0.4, -0.9]].map(([w, x, z, yaw]) => person(g, w, V(x, 0, z), yaw));
    this.people.push(...this.boardFolk);
    this.scenes.board.update = (dt, t) => { this.boardFolk.forEach((P, i) => { P.pose = this.s.cheer ? (i % 2 ? 'cheer' : 'wave') : 'idle'; P.look = V(0, 1.6, 1.8); }); };
  }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast, B = this.board;
    Object.assign(s, { aim: 0, burn: 0, power: 0, smSep: 0, lmSep: 0, heat: 0, los: 0, contact: 0, chutes: 0, down: 0, cheer: 0, aaronTalk: 0, mattTalk: 0 });
    this.aK = 0; this.smK = 0; this.lmK = 0; this.losT = 0; this.losRate = 1; this.dK = 0; this.splashed = false; this.spT = null;
    // 1. Flying by hand
    await this.go(D, 'aquarius', 0, 0.1, { x: 0, z: 0 });
    s.guide = [-0.6, 2.0, -0.6];
    const l1 = D.sayAsync('ch34_01');
    await D.cue('Problem ten'); B.card(9);
    await l1;
    const l2 = D.sayAsync('ch34_02');
    if (D.kids) { await D.cue('Haise'); s.aim = 1; }
    await l2;
    if (!D.kids) {
      await D.say('ch34_03');
      await this.ask(D, 'aim', { hint: this.aimIt.hint, deskHint: this.aimIt.deskHint, after: 1, timeout: 20 });
      s.aim = 1;
    }
    s.burn = 1; cabinRumble(G, fast ? 2 : 7, 0.15); rumble(G, fast ? 2 : 7, 0.3);
    await D.wait(fast ? 1.5 : 7);
    s.burn = 0;
    const l4 = D.sayAsync('ch34_04');
    await cueNth(D, 'ch34_04', 'Tick'); B.tick(9);
    await l4;
    // 2. The simulator
    await this.go(D, 'sim', yawTo(330), 0.8, { x: 2.6, z: 3.2 });
    s.guide = [3.4, 2.4, 1.6];
    const l5 = D.sayAsync('ch34_05');
    await D.cue('Problem eleven'); B.card(10);
    await l5;
    await D.say('ch34_06');
    s.aaronTalk = 1; await D.say('ch34_07'); s.aaronTalk = 0;
    s.mattTalk = 1; await D.say('ch34_08'); s.mattTalk = 0;
    const l9 = D.sayAsync('ch34_09');
    await cueNth(D, 'ch34_09', 'Tick', 1); B.tick(10);
    await D.cue('Problem twelve'); B.card(11);
    await D.cue('So they send');
    s.power = 1;
    await this.go(D, 'outside', 0, 0.6, { x: 0, z: 0 });
    s.guide = [-3, 2.4, -6];
    await cueNth(D, 'ch34_09', 'Tick', -1); B.tick(11);
    await l9;
    s.power = 0;
    // 3. Letting go
    clank(G, null, 0.2); s.smSep = 1;
    await D.say('ch34_10');
    await D.until(() => this.smK > 0.6);
    await D.say('ch34_11');
    await D.wait(fast ? 0.5 : 2);
    const l12 = D.sayAsync('ch34_12');
    await D.cue('Problem thirteen'); B.card(12);
    await cueNth(D, 'ch34_12', 'Tick'); hiss(G, null, 0.15, 1.2); s.lmSep = 1; B.tick(12);
    await l12;
    await D.say('ch34_13');
    await D.wait(fast ? 0.5 : 3);
    // 4. Reentry and the silence
    await this.go(D, 'reentry', 0, 1.0, { x: 0, z: 0 });
    s.guide = [0, 2.2, -0.9]; s.heat = 1; this.hK = 0;
    const l14 = D.sayAsync('ch34_14');
    await D.cue('Four minutes pass');
    s.los = 1; this.losT = 225; this.losRate = 1;
    await this.go(D, 'mcc', yawTo(MCC_SPOT.bearing), 0.8, { x: MCC_SPOT.x, z: MCC_SPOT.z });
    s.guide = [3.5, 2.6, 2.6]; s.heat = 0;
    this.losRate = fast ? 8 : 9;      // the clock races on through five and six minutes
    await l14;
    this.losRate = 1;
    await D.wait(fast ? 0.5 : 3);
    s.contact = 1;
    await D.say('ch34_15');           // "Okay, Joe." The music starts here, to the end.
    s.cheer = 1;
    await D.wait(fast ? 0.5 : 2.5);
    // Parachutes, splashdown, cheers, the board
    s.chutes = 1; this.dK = 0.35;
    await this.go(D, 'sea', yawTo(355), 0.8, { x: 0, z: 0 });
    s.guide = [-1.2, 3, -6];
    const l16 = D.sayAsync('ch34_16');
    await D.cue('Splashdown'); s.down = 1;
    await D.cue('And in Houston');
    await this.go(D, 'mcc', yawTo(MCC_SPOT.bearing), 0.6, { x: MCC_SPOT.x, z: MCC_SPOT.z });
    s.guide = [3.5, 2.6, 2.6];
    await D.cue('a chalkboard');
    await this.go(D, 'board', 0, 0.6, { x: 0, z: 1.8 });
    s.guide = [-1.9, 2.5, -1.8];
    await l16;
    await D.wait(fast ? 1 : 6);
  }
}
