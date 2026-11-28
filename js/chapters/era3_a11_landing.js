// Era 3, Apollo 11 part 5 (n 26): The landing. 20 July 1969.
//
// No music until "The Eagle has landed": only the engine's hum, breathing, beeps and voices.
// 1. Inside Eagle, standing between Neil and Buzz, the two triangle windows; the descent engine
//    lights fifteen kilometres up; the radio drops in and out.
// 2. Program alarm 1202: the yellow light, the master alarm. "Give us a reading..." Houston: Steve
//    Bales and Jack Garman check; "We're go on that alarm."
// 3. Low over the ground: the computer is heading for a crater full of boulders. Neil takes over and
//    flies on past (Adults point at a smooth patch beyond). "Forty feet, down two and a half.
//    Picking up some dust." Dust streams sideways. "Sixty seconds." "Thirty seconds."
// 4. "Contact light." "Shutdown." Silence; the dust settles.
// 5. "The Eagle has landed." (The music.) Houston erupts. Kennedy, 1962, over the still grey ground.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo } from '../era3/base.js';
import { person, sit, wear } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { cabin, panelLamp, dressCabin } from '../era3/cabin.js';
import { Puffs, envMap, cabinRumble, staticBurst, quindar, beep, masterAlarm, breath, applause, click } from '../era3/fx.js';
import { moonGround } from '../era3/worlds.js';
import { glowSprite } from '../wow/fx.js';
import { canvasTex, damp, lerp } from '../util.js';
import { rng } from '../shapes.js';

const M = await loadAll(['craft/mission_control', 'props/helmet_apollo']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);
const FOOT = 3.6;   // your eyes stand this far above the footpads (the cabin sits high on its legs)

// The ground beneath: high up, a cratered plain bent round a small sphere (a near horizon); low
// down, the landing site: West crater and its boulder field on the left, the smooth patch beyond.
const HI_R = 8000;
function highGround() {
  const r = rng(61), craters = [];
  for (let i = 0; i < 110; i++) { const rad = 20 + Math.pow(r(), 2.2) * 230; craters.push([(r() - 0.5) * 3800, (r() - 0.5) * 3800, rad, rad * (0.16 + r() * 0.08)]); }
  const MG = moonGround({ size: 4000, seg: 230, seed: 61, craters, rocks: 0 });
  const p = MG.ground.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) * 1.8 - (x * x + z * z) / (2 * HI_R)); }
  MG.ground.geometry.computeVertexNormals(); MG.ground.frustumCulled = false;
  const pivot = new THREE.Group(); MG.group.position.y = HI_R; pivot.add(MG.group);
  return pivot;
}
// the landing site, in its own space: Eagle comes down at (0, 0); West crater at (-55, 210), its
// boulders strewn round it; you come in from +z, heading -z
const WEST = [-60, 120, 48];
function siteGround() {
  const r = rng(73), boulders = [];
  for (let i = 0; i < 70; i++) { const a = r() * 6.28, d = WEST[2] * (0.4 + r() * 1.3); boulders.push([WEST[0] + Math.cos(a) * d, WEST[1] + Math.sin(a) * d, 1.4 + Math.pow(r(), 2) * 3.4]); }
  const craters = [[WEST[0], WEST[1], WEST[2], 9], [70, 330, 30, 6], [-150, 60, 22, 4.5], [110, 120, 14, 3], [-30, -120, 18, 3.5], [40, -260, 34, 6], [-12, -18, 6, 1]];
  return moonGround({ size: 1600, seg: 240, seed: 73, craters, flatten: [[0, 0, 14]], boulders, rocks: 1400 });
}

// Houston's big screen during the descent: altitude and speed, falling
function drawPDI(c, w, h, alt, fuel, alarm) {
  c.fillStyle = '#081018'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(90,160,200,0.25)'; c.lineWidth = 1; for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.fillStyle = '#c8e0f0'; c.font = 'bold 30px monospace'; c.textAlign = 'left'; c.fillText('APOLLO 11   LM POWERED DESCENT', 24, 44);
  // the descent curve, and Eagle's dot on it
  c.strokeStyle = '#d8e8a0'; c.lineWidth = 3; c.beginPath(); for (let i = 0; i <= 60; i++) { const k = i / 60, x = 60 + k * 560, y = 90 + (1 - Math.pow(1 - k, 2.2)) * 240; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  const k = 1 - Math.pow(clamp01(alt / 15000), 0.45), x = 60 + k * 560, y = 90 + (1 - Math.pow(1 - k, 2.2)) * 240;
  c.fillStyle = '#f8f0a0'; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill();
  c.textAlign = 'right'; c.fillStyle = '#88a8c0'; c.font = '26px monospace'; c.fillText('ALTITUDE', w - 40, 120); c.fillText('FUEL (SEC)', w - 40, 240);
  c.fillStyle = '#f8d080'; c.font = 'bold 56px monospace'; c.fillText(alt > 2000 ? `${(alt / 1000).toFixed(1)} KM` : `${Math.round(alt * 3.28)} FT`, w - 40, 180);
  c.fillStyle = fuel < 35 ? '#f86040' : '#f8d080'; c.fillText(fuel > 120 ? '---' : String(Math.max(0, Math.round(fuel))), w - 40, 300);
  if (alarm) { c.fillStyle = '#f8c020'; c.fillRect(640, 330, 200, 44); c.fillStyle = '#201000'; c.font = 'bold 30px monospace'; c.textAlign = 'center'; c.fillText(`PROG ${alarm}`, 740, 362); }
}

export default class A11Landing extends Chapter3 {
  constructor(G) {
    super(G, 26);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { phase: 'hi', engine: 0, alarm: 0, take: 0, low: 0, landed: 0, cheer: 0, dust: 0 });
    this.buildLM(); this.buildMCC();
    Object.assign(G.narration.radio, { ch26_06: 'nasa', ch26_07: 'nasa', ch26_12: 'nasa', ch26_13: 'nasa', ch26_17: 'nasa', ch26_18: 'tv' });
  }

  // ---------- Inside Eagle ----------
  buildLM() {
    const g = new THREE.Group();
    const C = this.C = cabin('lm'); g.add(C.group);
    dressCabin(C);
    // Neil on the left, Buzz on the right, standing at their windows, helmets on
    this.neil = person(C.group, 'armstrong', C.crew[0].pos.clone(), 0.25); this.buzz = person(C.group, 'aldrin', C.crew[1].pos.clone(), -0.25);
    for (const P of [this.neil, this.buzz]) wear(P, copy(M.helmet_apollo), { lift: -0.05, size: 1 });
    this.people.push(this.neil, this.buzz);
    this.winL = C.dirOf('left'); this.winR = C.dirOf('right');
    // the program alarm light and the master alarm on the panel, and the mission clock
    this.prog = panelLamp(0.07, 0.03, { text: 'PROG', col: '#c89010' }); C.overlay('dsky', this.prog); this.prog.position.y += 0.1;
    this.master = panelLamp(0.1, 0.035, { text: 'MASTER ALARM', col: '#c02818', font: 'bold 28px sans-serif' }); C.overlay('master', this.master);
    this.clock = panelLamp(0.1, 0.03, { text: '102:33:05', col: '#200800', mono: true }); C.overlay('timer', this.clock);
    // outside: the high plain, the landing site, and the dust
    this.hi = highGround(); g.add(this.hi);
    this.site = siteGround(); g.add(this.site.group);
    this.dust = new Puffs(500, { floor: -50 }); g.add(this.dust.mesh);
    // and a thin sheet of dust streaking out across the ground (two rings, growing and fading in turn)
    const streak = canvasTex(512, 512, (c, w, h) => { const r = rng(4); c.translate(w / 2, h / 2);
      for (let i = 0; i < 260; i++) { const a = r() * 6.28, r0 = w * (0.08 + r() * 0.2), r1 = r0 + w * (0.1 + r() * 0.25); c.strokeStyle = `rgba(225,218,205,${0.08 + r() * 0.25})`; c.lineWidth = 1 + r() * 4; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke(); } });
    this.sheets = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: streak, transparent: true, opacity: 0, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; g.add(m); return m; });
    // the smooth patch to aim for (Adults point at it)
    this.patch = glowSprite(0x9adcff, 16, 0); this.site.group.add(this.patch); this.patch.position.set(0, 1, 0);
    this.spotIt = this.touchable('spot', this.patch, { hint: 'Point out of the window at the glowing smooth patch, past the boulders', deskHint: 'Click the glowing smooth patch past the boulders', r: 14, grab: false });
    this.addScene('lm', { group: g, bounds: 0.15, amb: 0, fogFar: 9000, airless: true,
      enter: () => { C.lights(true, 0.6); this.G.sky.set(100, -60); },
      update: (dt, t) => this.updateLM(dt, t) });
  }
  updateLM(dt, t) {
    const s = this.s, G = this.G, C = this.C;
    // the Sun low behind you (early morning at Tranquility: long shadows)
    const sd = V(0.25, 0.18, 0.95).normalize();
    this.key.position.copy(sd).multiplyScalar(300); this.key.target.position.set(0, -40, -200); this.key.intensity = 2.6;
    // the descent: high (sliding by fast, falling), then low over the site (slowing, sinking)
    this.hi.visible = s.phase === 'hi'; this.site.group.visible = s.phase !== 'hi';
    if (s.phase === 'hi') {
      this.hiK = (this.hiK || 0) + dt * this.F;
      const h = Math.max(300, 430 - this.hiK * 3);
      this.hi.position.set(0, EYE.y - h - HI_R, 0); this.hi.rotation.x = -0.3 + this.hiK * 30 / HI_R;
    } else {
      // d: how far ahead the landing spot is; h: your eyes above the ground there
      const rate = s.take ? 9 : 14;
      if (!s.landed) {
        this.siteD = Math.max(0, (this.siteD ?? 520) - dt * this.F * rate * clamp01((this.siteD ?? 520) / 60 + 0.15));
        this.siteH = s.low ? Math.max(FOOT, (this.siteH ?? 120) - dt * this.F * lerp(1.2, 3.5, clamp01((this.siteH ?? 120) / 120))) : Math.max(40, (this.siteH ?? 120) - dt * this.F * 1.6);
        if (s.low && this.siteD < 0.5 && this.siteH <= FOOT + 0.01) s.touch = 1;
      }
      // the computer's target (in the boulders) until Neil takes over; then the smooth patch
      const tx = s.take ? 0 : WEST[0] * 0.6;
      this.site.group.position.set(-tx * clamp01(this.siteD / 400), EYE.y - this.siteH - this.site.height(0, 0), -this.siteD);
      this.patch.material.opacity = s.want === 'spot' || s.showPatch ? 0.35 + 0.2 * Math.sin(t * 4) : 0;
      // dust streaming out sideways, low and fast, once you're under 40 feet; settling after shutdown
      const dustOn = !s.landed && this.siteH < 14;
      if (dustOn) {
        const n = Math.round(dt * 260), gy = this.site.group.position.y + 0.15;
        for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, r0 = 1 + Math.random() * 3, sp = 18 + Math.random() * 14; this.dust.emit(Math.cos(a) * r0, gy, -this.siteD + Math.sin(a) * r0, Math.cos(a) * sp, 0.15, Math.sin(a) * sp, 0.8, 6, 1.8, 0xd8d0c0, 0.5 * clamp01((14 - this.siteH) / 8), 0.1); }
      }
      this.sheetK = dustOn ? Math.min(1, (this.sheetK || 0) + dt * 0.8) : Math.max(0, (this.sheetK || 0) - dt * 0.25);
      this.sheets.forEach((m, i) => { const ph = (t * 0.9 + i * 0.5) % 1; m.scale.setScalar(0.35 + ph * 1.1); m.rotation.z = i * 1.3; m.position.set(0, this.site.group.position.y + 0.3 + i * 0.05, -this.siteD); m.material.opacity = this.sheetK * Math.sin(ph * Math.PI) * 0.55 * clamp01((16 - this.siteH) / 8 + (s.landed ? 1 : 0)); });
      this.dust.update(G, dt);
    }
    // the engine: a hum and a slight shake while it burns
    if (s.engine) { this.humT = (this.humT || 0) - dt; if (this.humT <= 0) { this.humT = 5; cabinRumble(G, 7, 0.09); } C.group.position.set((Math.random() - 0.5) * 0.002, (Math.random() - 0.5) * 0.002, 0); }
    else C.group.position.set(0, 0, 0);
    // breathing in the helmets now and then
    if (!s.landed && s.engine) { this.brT = (this.brT || 4) - dt; if (this.brT <= 0) { this.brT = 6 + Math.random() * 4; breath(G, 0.05, 3.2); } }
    // the lights
    const al = s.alarm && Math.sin(t * 7) > -0.2;
    this.prog.userData.set('PROG', '#c89010', !!s.alarm); this.master.userData.set('MASTER ALARM', '#c02818', !!al);
    const secs = 102 * 3600 + 33 * 60 + 5 + Math.floor(this.clockT = (this.clockT || 0) + dt * this.F);
    this.clock.userData.set(`${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`, '#200800', true);
    // the crew look out of their windows (Buzz down at his panel when calling numbers)
    this.neil.look = C.group.localToWorld(EYE.clone().addScaledVector(this.winL, 3)); this.buzz.look = s.low && !s.landed ? C.group.localToWorld(V(0.15, 1.3, -0.7)) : C.group.localToWorld(EYE.clone().addScaledVector(this.winR, 3));
  }

  // ---------- Houston ----------
  buildMCC() {
    const g = new THREE.Group();
    g.add(copy(M.mission_control, envMap('room'), 0.6));
    const seats = [[-4.5, 3.8, 'eng_white_shirt'], [1.5, 3.8, 'eng_blue_shirt'], [4.5, 3.8, 'eng_black'], [-3.0, 1.8, 'eng_blue_shirt'], [3.0, 1.8, 'eng_white_shirt'], [-4.5, 1.8, 'eng_black']];
    this.ctl = seats.map(([x, z, who]) => { const P = person(g, who, V(x, 0, z), Math.PI); sit(P); P.look = V(x * 0.3, 3, -9); return P; });
    this.bales = person(g, 'bales', V(-1.5, 0, 3.8), Math.PI); sit(this.bales);
    this.garman = person(g, 'jack_garman', V(-2.4, 0, 4.3), Math.PI - 0.5);
    this.duke = person(g, 'duke', V(0, 0, 1.8), Math.PI); sit(this.duke);
    this.kranz = person(g, 'kranz', V(1.4, 0, 5.6), Math.PI + 0.3);
    this.people.push(...this.ctl, this.bales, this.garman, this.duke, this.kranz);
    const tex = this.pdiTex = canvasTex(1024, 384, (c, w, h) => drawPDI(c, w, h, 15000, 999, 0));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.set(0, 3.2, -9.9); g.add(scr);
    this.addScene('mcc', { group: g, bounds: 1.2, indoors: true, place: { lat: 29.6, year: 1969, sunLon: 118 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(240, 35); this.G.sky.hemi.intensity = 0.9; this.lamp.position.set(0, 5, 4); this.lamp.intensity = 3.2; this.lamp.distance = 22; this.lamp2.position.set(0, 3.5, -8); this.lamp2.color.setHex(0x9ac8ff); this.lamp2.intensity = 1.2; this.lamp2.distance = 12; },
      exit: () => { this.lamp2.color.setHex(0xfff0dc); },
      update: (dt, t) => {
        const s = this.s;
        if ((this.pAcc = (this.pAcc || 0) + dt) > 0.25) { this.pAcc = 0; drawPDI(this.pdiTex.image.getContext('2d'), 1024, 384, s.phase === 'hi' ? 11800 : s.landed ? 0 : (this.siteH || 160) * 3, s.landed ? 17 : s.phase === 'hi' ? 999 : 90, s.alarm ? 1202 : 0); this.pdiTex.needsUpdate = true; }
        const cheer = s.cheer ? 'cheer' : 'idle';
        for (const P of this.ctl) P.pose = cheer;
        this.kranz.pose = cheer; this.duke.pose = s.cheer ? 'cheer' : 'talk';
        this.bales.pose = s.cheer ? 'cheer' : s.alarm ? 'talk' : 'idle'; this.garman.pose = s.cheer ? 'cheer' : s.alarm ? 'talk' : 'idle';
        this.bales.look = s.alarm ? this.garman.g.position.clone().setY(1.6) : V(-0.5, 3, -9); this.garman.look = this.bales.g.position.clone().setY(1.1);
      } });
  }

  beds() { return [
    { kind: 'room', vol: 0.08, on: (ch) => ch.cur === 'mcc' },
    { kind: 'vent', at: V(0, 1.6, 0), vol: 0.04, ref: 3, on: (ch) => ch.cur === 'lm' },
  ]; }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    const blip = () => { staticBurst(G, 0.25 + Math.random() * 0.3, 0.12); };
    // 1. Inside Eagle, high up; the engine lights
    Object.assign(s, { phase: 'hi', engine: 0, alarm: 0, take: 0, low: 0, landed: 0, cheer: 0, touch: 0, showPatch: 0 });
    this.hiK = 0; this.siteD = 520; this.siteH = 120; this.clockT = 0;
    await this.go(D, 'lm', 0, 0.1, { x: 0, z: 0 });
    s.guide = [0, 2.3, -0.5];
    await D.say('ch26_01');
    s.engine = 1; cabinRumble(G, 4, 0.25); this.shake(0.006, 1.2);
    const l2 = D.sayAsync('ch26_02');
    await D.wait(fast ? 0.5 : 4); blip(); await D.wait(fast ? 0.3 : 2.5); blip();
    await l2;
    // 2. The alarm
    s.alarm = 1; masterAlarm(G, 2.5, 0.12);
    await D.say('ch26_03');
    await D.say('ch26_04');
    await this.go(D, 'mcc', yawTo(320), 0.6, { x: 6, z: 6 });
    s.guide = [4.2, 2.4, 4.4];
    await D.say('ch26_05');
    await D.say('ch26_06');
    s.alarm = 0;
    await D.say('ch26_07');
    // 3. Low over the site: the boulders ahead
    s.phase = 'low'; this.siteD = 520; this.siteH = 120;
    await this.go(D, 'lm', 0, 0.6, { x: 0, z: 0 });
    s.guide = [0.2, 2.3, -0.5];
    this.guideTo(this.site.group.localToWorld(V(WEST[0], 10, WEST[1])), 2, 0);
    await D.say('ch26_08');
    s.take = 1;
    await D.say('ch26_09');
    if (!D.kids) {
      await D.say('ch26_10');
      await this.ask(D, 'spot', { hint: this.spotIt.hint, deskHint: this.spotIt.deskHint, after: 1, timeout: 15 });
    }
    s.showPatch = 1;
    s.low = 1; s.guide = [0.2, 2.3, -0.5];
    await D.until(() => this.siteH < 16 || fast);
    await D.say('ch26_11');
    s.showPatch = 0;
    await D.say('ch26_12');
    await D.until(() => this.siteH < 8 || fast);
    await D.say('ch26_13');
    await D.until(() => s.touch || fast, 40);
    this.siteD = 0; this.siteH = FOOT;
    // 4. Contact; shutdown; the dust settles
    beep(G, null, 0.1, 900, 0.3);
    await D.say('ch26_14');
    s.landed = 1; this.shake(0.01, 0.5); click(G, null, 0.25);
    await D.say('ch26_15');
    s.engine = 0;
    await D.wait(fast ? 0.5 : 3.5);
    // 5. The Eagle has landed
    await D.say('ch26_16');        // the music begins here, and plays to the end
    await this.go(D, 'mcc', yawTo(320), 0.5, { x: 6, z: 6 });
    s.guide = [4.2, 2.4, 4.4];
    s.cheer = 1; applause(G, null, 7, 0.3);
    await D.say('ch26_17');
    await D.wait(fast ? 0.5 : 2.5);
    s.cheer = 0;
    await this.go(D, 'lm', 0, 0.8, { x: 0, z: 0 });
    s.guide = [0.2, 2.3, -0.5];
    await D.say('ch26_18');
    await D.say(this.pick(D, 'ch26_20', 'ch26_19'));
    await D.wait(fast ? 0.5 : 4);
  }
}
