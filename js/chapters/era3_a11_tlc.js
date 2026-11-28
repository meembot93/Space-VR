// Era 3, Apollo 11 part 3 (n 24): To the Moon. 16-19 July 1969.
//
// 1. Over the Pacific, the third stage lights again: the J-2's pale flame, six minutes, faster and
//    faster. "Apollo 11, this is Houston. You are go for TLI."
// 2. Transposition and docking, seen from outside: Columbia separates and turns round; the panels of
//    the rocket open like a flower, and there's Eagle in its gold foil (the music starts).
// 3. Inside Columbia with Mike Collins: the docking target in the window, closer, closer... docked.
//    (Adults take the hand controller.) Then outside again: Eagle pulled free of the rocket.
// 4. Three days coasting: the crew floating, bacon cubes, sleeping bags; the slow barbecue roll,
//    sunlight sweeping from window to window.
// 5. The Earth, smaller every time you look. (Adults hold up a thumb and cover it.)
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R } from '../era3/base.js';
import { person, sit, wear } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { cabin, panelLamp, dressCabin } from '../era3/cabin.js';
import { envMap, flameMesh, cabinRumble, clank, hiss, beep } from '../era3/fx.js';
import { earthSpace, spaceSun } from '../era3/worlds.js';
import { SAT_Y } from '../era3/saturn.js';
import { glowSprite } from '../wow/fx.js';
import { canvasTex, damp, lerp } from '../util.js';
import { rng } from '../shapes.js';

const M = await loadAll(['craft/saturn_s4b', 'craft/apollo_csm', 'craft/lm_ascent', 'craft/lm_descent', 'props/helmet_apollo']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const EYE = V(0, 1.6, 0);

// the stack, measured up its axis from the bottom of the third stage
const SLA0 = SAT_Y.sla - SAT_Y.s4b, CSM0 = SAT_Y.csm - SAT_Y.s4b;   // 18.7, 33.7
const LM0 = SLA0 + 0.3, LM_TOP_DECK = 2.62;
const SLA_H = CSM0 - 6.9 - SLA0, SLA_R0 = 3.3, SLA_R1 = 1.95;

// the CM's heat shield is its origin: how far is the probe's tip, and the top of Eagle's drogue?
function extent(o) { const b = new THREE.Box3().setFromObject(o); return b; }

// The Earth's view as a small disc for the hatch window (cheap, and always lit right)
function earthDisc() {
  const tex = canvasTex(256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w * 0.4, h * 0.4, 4, w / 2, h / 2, w / 2); g.addColorStop(0, '#6aa8e8'); g.addColorStop(0.8, '#2a5aa8'); g.addColorStop(1, '#0a1a3a');
    c.fillStyle = g; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill();
    const r = rng(9); c.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(r() * w, r() * h, 6 + r() * 26, 3 + r() * 8, r() * 3, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(150,120,70,0.8)'; c.beginPath(); c.ellipse(w * 0.55, h * 0.5, 30, 50, 0.4, 0, 7); c.fill();
    c.globalCompositeOperation = 'destination-in'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill();
    c.globalCompositeOperation = 'source-over'; const s = c.createLinearGradient(0, 0, w, 0); s.addColorStop(0.55, 'rgba(0,0,0,0)'); s.addColorStop(0.85, 'rgba(0,0,10,0.85)'); c.fillStyle = s; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 1, 0, 7); c.fill();
  });
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false }));
}

export default class A11TLC extends Chapter3 {
  constructor(G) {
    super(G, 24);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { burn: 0, sep: 0, open: 0, dock: 0, pull: 0, approach: 0, ptc: 0, shrink: 0 });
    this.buildSpace(); this.buildDock(); this.buildCoast();
    Object.assign(G.narration.radio, { ch24_02: 'nasa' });
  }

  // ---------- 1, 2 & the pull-out: outside, the stack over the Earth ----------
  buildSpace() {
    const g = new THREE.Group();
    const SP = this.SPs = earthSpace(this.G, { earthR: 400 });
    SP.earth.position.set(60, -520, -260); SP.sunDir.set(0.5, 0.6, 0.6).normalize();
    this.sunS = spaceSun(60); SP.group.add(this.sunS);
    // the stack lies along +x, nose to the right
    const st = this.stackG = new THREE.Group(); st.rotation.z = -Math.PI / 2; st.position.set(-26, 1.2, -24); g.add(st);
    const s4 = copy(M.saturn_s4b, envMap('space'), 1.0); st.add(s4);
    this.j2 = flameMesh(26, 2.6, 'hydro'); this.j2.position.y = -2.2; st.add(this.j2);
    // the four panels of the adapter, hinged at the bottom
    const pm = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide, envMap: envMap('space') });
    this.panels = [0, 1, 2, 3].map((i) => {
      const hinge = new THREE.Group(), a = i * Math.PI / 2 + Math.PI / 4;
      hinge.position.set(Math.sin(a) * SLA_R0, SLA0, Math.cos(a) * SLA_R0); hinge.rotation.y = a; st.add(hinge);
      const geo = new THREE.CylinderGeometry(SLA_R1, SLA_R0, SLA_H, 18, 1, true, -Math.PI / 4, Math.PI / 2);
      geo.translate(0, SLA_H / 2, 0);
      const m = new THREE.Mesh(geo, pm); m.position.set(0, 0, -SLA_R0); hinge.add(m);
      return hinge;
    });
    // Eagle inside, legs folded close (the model's legs are out: it's hidden until the panels open)
    const lm = this.lmS = new THREE.Group(); lm.add(copy(M.lm_descent, envMap('space'), 1.0)); const as = copy(M.lm_ascent, envMap('space'), 1.0); as.position.y = LM_TOP_DECK; lm.add(as);
    lm.position.y = LM0; lm.scale.setScalar(0.82); st.add(lm);
    this.lmTop = LM0 + (LM_TOP_DECK + (M.lm_ascent?.size.y || 4.2)) * 0.82;
    // Columbia: a group pivoting round its middle, so it can turn end over end
    const csm = this.csmS = new THREE.Group(); const cm = copy(M.apollo_csm, envMap('space'), 1.1); csm.add(cm); st.add(csm);
    const ex = extent(cm); this.noseLen = ex.max.y; this.smLen = -ex.min.y;
    this.sps = flameMesh(5, 0.8, 'hyper'); this.sps.position.y = -this.smLen; this.sps.visible = false; csm.add(this.sps);
    this.rcs = [0, 1, 2, 3].map((i) => { const s = glowSprite(0xf0f0ff, 1.2, 0); const a = i * Math.PI / 2; s.position.set(Math.cos(a) * 2.1, -1.5, Math.sin(a) * 2.1); csm.add(s); return s; });
    this.placeCsm(0, 0);
    this.addScene('space', { group: g, bounds: 0.4, space: SP, amb: 0, fogFar: 9000,
      update: (dt, t) => {
        const s = this.s;
        SP.earth.rotation.y += dt * 0.004; SP.atmoU.sun.value.copy(SP.sunDir); this.sunS.position.copy(SP.sunDir).multiplyScalar(2400).add(EYE);
        this.key.position.copy(SP.sunDir).multiplyScalar(80); this.key.target.position.set(0, 0, -20); this.key.intensity = 2.4;
        this.j2.userData.set(s.burn ? 0.8 + 0.2 * Math.sin(t * 30) : 0, t);
        // separation: drift away and turn round; then the panels open; then back in to dock; then pull Eagle out
        this.sepK = clamp01((this.sepK || 0) + (s.sep ? dt * this.F / 14 : 0));
        this.openK = clamp01((this.openK || 0) + (s.open ? dt * this.F / 10 : 0));
        this.dockK = clamp01((this.dockK || 0) + (s.dock ? dt * this.F / 1.5 : 0));
        this.pullK = clamp01((this.pullK || 0) + (s.pull ? dt * this.F / 14 : 0));
        if (!s.dock) this.placeCsm(this.sepK, 0); else this.placeCsm(1, this.dockK);
        this.panels.forEach((h, i) => { const k = this.openK; h.rotation.x = 0; h.children[0].rotation.x = -ease(k / 0.6) * 0.9; const away = clamp01((k - 0.55) / 0.45);
          h.children[0].position.set(0, -away * 6, -SLA_R0 - away * 14); h.children[0].rotation.x -= away * 0.8; h.visible = k < 0.999; });
        this.lmS.visible = this.openK > 0.05;
        if (this.pullK > 0) { const d = ease(this.pullK) * 22; this.lmS.position.y = LM0 + d; this.csmS.position.y = this.dockY + d; }
        const thr = s.sep && this.sepK < 1 || s.pull && this.pullK < 1;
        this.rcs.forEach((r, i) => { r.material.opacity = thr && Math.sin(t * 13 + i * 2) > 0.6 ? 0.9 : 0; });
      } });
  }
  // Columbia's place: k 0..1 the separation and turn; d 0..1 the docking (back down onto Eagle's top)
  placeCsm(k, d) {
    const csm = this.csmS, upK = ease(k / 0.45), turnK = ease((k - 0.45) / 0.55);
    const outY = CSM0 + 18 * upK;
    csm.rotation.set(0, 0, Math.PI * turnK);
    // flipped, the nose points down at Eagle: the heat shield (origin) must sit noseLen above the drogue
    this.dockY = this.lmTop + this.noseLen + 0.2;
    const hold = lerp(outY, this.dockY + 14, turnK);
    csm.position.set(0, lerp(hold, this.dockY, ease(d)), 0);
  }

  // ---------- 3. Inside Columbia: docking ----------
  buildDock() {
    const g = new THREE.Group();
    const C = this.Cd = cabin('apollo', { seat: 'left' }); g.add(C.group);
    dressCabin(C);
    this.mikeD = null;
    // Neil and Buzz in the other couches, watching
    this.neilD = person(C.group, 'armstrong', C.crew[0].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.neilD);
    this.buzzD = person(C.group, 'aldrin', C.crew[1].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.buzzD);
    this.people.push(this.neilD, this.buzzD);
    this.winD = C.dirOf('rdvL');
    // Eagle, still in the rocket's adapter ring, with the docking target on its top, coming closer
    const tgt = new THREE.Group();
    const lm = new THREE.Group(); lm.add(copy(M.lm_descent, envMap('space'), 1.0)); const as = copy(M.lm_ascent, envMap('space'), 1.0); as.position.y = LM_TOP_DECK; lm.add(as);
    const top = LM_TOP_DECK + (M.lm_ascent?.size.y || 4.2);
    lm.position.y = -top; tgt.add(lm);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 1.2, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xd8d8d4, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide })); ring.position.y = -top - 0.5; tgt.add(ring);
    const s4 = copy(M.saturn_s4b, envMap('space'), 1.0); s4.position.y = -top - 0.5 - SLA0 + 0.0; tgt.add(s4);
    // the target: a white disc with a black cross and a standing-off cross on a post
    const tk = new Kit(); tk.cyl(0.22, 0.22, 0.02, 24, 0xf0f0ea, [0, 0.01, 0]); tk.box(0.4, 0.025, 0.04, 0x111111, [0, 0.03, 0]); tk.box(0.04, 0.025, 0.4, 0x111111, [0, 0.03, 0]);
    tk.cyl(0.012, 0.012, 0.4, 6, 0x111111, [0, 0.22, 0]); tk.box(0.18, 0.02, 0.02, 0xf0f0ea, [0, 0.42, 0]); tk.box(0.02, 0.02, 0.18, 0xf0f0ea, [0, 0.42, 0]);
    const tm = tk.mesh(FLAT); tm.position.set(0.5, -0.1, 0.3); tgt.add(tm);
    g.add(tgt); this.tgt = tgt;
    // the sight (COAS): a glowing cross in the window
    const coas = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(128, 128, (c, w, h) => { c.strokeStyle = 'rgba(255,170,60,0.95)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 8); c.lineTo(w / 2, h - 8); c.moveTo(8, h / 2); c.lineTo(w - 8, h / 2); c.stroke(); c.beginPath(); c.arc(w / 2, h / 2, 26, 0, 7); c.stroke(); }) }));
    coas.position.copy(this.winD).multiplyScalar(0.45).add(EYE).add(V(0.68, 0, 0)); coas.lookAt(EYE.clone().add(V(0.68, 0, 0))); C.group.add(coas);
    this.coas = coas;
    this.hcIt = this.touchable('dock', () => (C.handController ? C.handController.getWorldPosition(new THREE.Vector3()) : C.group.localToWorld(V(0.32, 0.98, -0.32))), { hint: 'Grip the hand controller by your right hand, and fly in', deskHint: 'Click the hand controller by your right hand', r: 0.2 });
    this.hcGlow = glowSprite(0x80c0ff, 0.25, 0); C.group.add(this.hcGlow);
    this.addScene('dock', { group: g, bounds: 0.2, indoors: true, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); this.G.sky.set(200, -40); },
      update: (dt, t) => {
        const s = this.s;
        // the approach: from 30 m to touching, the cross creeping onto the target
        this.apK = clamp01((this.apK || 0) + (s.approach ? dt * this.F / 18 : 0));
        const dist = lerp(32, 1.3, ease(this.apK)), off = (1 - ease(this.apK)) * 0.9;
        const eye = C.group.localToWorld(EYE.clone().add(V(0, 0, 0)));
        this.tgt.position.copy(this.winD).multiplyScalar(dist).add(eye).add(V(off, off * 0.4, 0));
        this.tgt.quaternion.setFromUnitVectors(V(0, 1, 0), this.winD.clone().negate());
        this.key.position.set(40, 60, 30); this.key.target.position.copy(this.tgt.position); this.key.intensity = 2.2;
        if (C.handController) { this.hcGlow.position.copy(C.handController.position).add(V(0, 0.08, 0)); this.hcGlow.material.opacity = s.want === 'dock' ? 0.5 + 0.4 * Math.sin(t * 6) : 0; }
      } });
  }

  // ---------- 4 & 5. Coasting ----------
  buildCoast() {
    const g = new THREE.Group();
    const C = this.Cc = cabin('apollo', { seat: 'center' }); g.add(C.group);
    dressCabin(C);
    // Neil and Buzz floating, Mike in his couch with a food packet
    this.neilC = person(C.group, 'armstrong', V(-1.0, 0.45, -0.25), 0.9); this.buzzC = person(C.group, 'aldrin', V(0.95, 0.3, -0.3), -1.1);
    this.neilC.g.rotation.z = 0.12; this.buzzC.g.rotation.set(0.1, -1.1, -0.12);
    this.people.push(this.neilC, this.buzzC);
    // bacon cubes, a food bag, a sleeping bag hung under a couch, a checklist on a string
    const fk = new Kit(); this.cubes = [];
    // compressed bacon squares (crumbly, streaky, a sheen of coating) and a clear food pouch with its label
    const baconT = canvasTex(64, 64, (x, w, h) => { const r = rng(7); x.fillStyle = '#8a4426'; x.fillRect(0, 0, w, h);
      for (let k = 0; k < 7; k++) { x.fillStyle = k % 2 ? '#e8b88a' : '#a8502c'; x.fillRect(0, k * 9 + r() * 3, w, 3 + r() * 3); }
      for (let k = 0; k < 160; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '60,24,10' : '240,200,150'},${0.3 + r() * 0.4})`; x.fillRect(r() * w, r() * h, 2, 2); } });
    const baconM = new THREE.MeshStandardMaterial({ map: baconT, roughness: 0.45 });
    const baconG = new THREE.BoxGeometry(0.022, 0.022, 0.022, 2, 2, 2);
    { const p = baconG.attributes.position, r = rng(3); for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.9 + r() * 0.2), p.getY(i) * (0.9 + r() * 0.2), p.getZ(i) * (0.9 + r() * 0.2)); baconG.computeVertexNormals(); }
    for (let i = 0; i < 6; i++) { const cb = new THREE.Mesh(baconG, baconM); cb.position.set(-0.2 + i * 0.07, 1.45 + (i % 3) * 0.05, -0.35 - (i % 2) * 0.08); cb.rotation.set(i, i * 2, i * 0.5); C.group.add(cb); this.cubes.push(cb); }
    const pouchT = canvasTex(128, 192, (x, w, h) => { x.fillStyle = '#ece8dc'; x.fillRect(0, 0, w, h); x.fillStyle = '#c9c2b0'; x.fillRect(0, 0, w, 18); x.fillRect(0, h - 10, w, 10);
      x.fillStyle = '#fff'; x.fillRect(14, 50, w - 28, 70); x.strokeStyle = '#333'; x.lineWidth = 2; x.strokeRect(14, 50, w - 28, 70);
      x.fillStyle = '#222'; x.font = 'bold 15px sans-serif'; x.textAlign = 'center'; x.fillText('BEEF AND', w / 2, 76); x.fillText('VEGETABLES', w / 2, 94); x.font = '11px sans-serif'; x.fillText('ADD 3 OZ WATER', w / 2, 112);
      x.fillStyle = '#c62'; x.fillRect(w / 2 - 6, h - 36, 12, 26); });
    const pg = new THREE.BoxGeometry(0.08, 0.12, 0.018, 4, 6, 1);
    { const p = pg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.06; p.setZ(i, p.getZ(i) * (1 - y * y * 0.7)); } pg.computeVertexNormals(); }
    const bag = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: pouchT, roughness: 0.35, metalness: 0.05 })); bag.position.set(0.32, 1.42, -0.5); bag.rotation.set(0.3, -0.4, 0.2); C.group.add(bag); this.foodBag = bag;
    fk.cyl(0.25, 0.25, 1.6, 12, 0x6a7a6a, [-0.45, 0.25, 0.75], [0, 0, Math.PI / 2]);
    C.group.add(fk.mesh(FLAT));
    // the Earth, small in the hatch window; the sunbeam that sweeps round as the ship rolls
    this.winC = C.dirOf('rdvL');
    this.earthC = earthDisc(); g.add(this.earthC);
    this.beams = C.windows.map((w) => { const s = glowSprite(0xfff4d8, 0.5, 0); s.position.copy(w.local).multiplyScalar(0.98).add(EYE); g.add(s); return { s, a: Math.atan2(w.local.x, w.local.y) }; });
    this.thumbIt = this.touchable('thumb', () => C.group.localToWorld(EYE.clone().addScaledVector(this.winC, 0.42)), { hint: 'Hold up your hand in front of the window, and hide the Earth behind your thumb', deskHint: 'Click the little blue Earth in the window', r: 0.09, grab: false });
    this.addScene('coast', { group: g, bounds: 0.25, indoors: true, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true); this.G.sky.set(200, -40); },
      update: (dt, t) => {
        const s = this.s;
        // the roll: the light swings round, the sunbeam glows in each window in turn
        const roll = s.ptc ? t * 0.35 : 0;
        this.key.position.set(Math.sin(roll) * 6, 1.6 + Math.cos(roll) * 6, -2); this.key.target.position.set(0, 1.4, 0); this.key.intensity = 1.6;
        this.beams.forEach((b) => { b.s.material.opacity = s.ptc ? Math.max(0, Math.cos(roll - b.a)) ** 6 * 0.9 : 0; });
        // the Earth: further and smaller
        this.shK = clamp01((this.shK || 0) + (s.shrink ? dt * this.F / 14 : 0));
        this.earthC.position.copy(this.winC).multiplyScalar(60).add(EYE);
        this.earthC.scale.setScalar(lerp(5.5, 2.2, ease(this.shK)));
        // floating: slow drift and turn
        this.neilC.g.position.y = 0.45 + Math.sin(t * 0.5) * 0.04; this.neilC.g.rotation.z = 0.12 + Math.sin(t * 0.3) * 0.05;
        this.buzzC.g.position.y = 0.3 + Math.sin(t * 0.45 + 1) * 0.05; this.buzzC.g.rotation.x = 0.1 + Math.sin(t * 0.27) * 0.06;
        this.neilC.look = EYE.clone().add(V(0, 0, -1)); this.buzzC.look = this.cubes[2].position;
        this.cubes.forEach((cb, i) => { cb.position.y += Math.sin(t * 0.7 + i) * 0.0004; cb.rotation.set(t * 0.4 + i, t * 0.3 + i * 2, 0); });
        this.foodBag.rotation.set(Math.sin(t * 0.3) * 0.3, t * 0.2, 0);
      } });
  }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. TLI
    s.burn = 0; s.sep = 0; s.open = 0; s.dock = 0; s.pull = 0; this.sepK = this.openK = this.dockK = this.pullK = 0;
    await this.go(D, 'space', 0, 0.1, { x: 0, z: 0 });
    s.guide = [-3, 2.6, -6];
    s.burn = 1; cabinRumble(G, 20, 0.25);
    await D.say('ch24_01');
    await D.say('ch24_02');
    await D.wait(fast ? 0.5 : 3);
    s.burn = 0;
    // 2. Transposition: separate, turn, the flower opens
    const l3 = D.sayAsync('ch24_03');
    await D.wait(fast ? 0.2 : 1.0); s.sep = 1; clank(G, null, 0.15);
    await l3;
    await D.until(() => this.sepK >= 1);
    const l4 = D.sayAsync('ch24_04');        // the music begins here
    await D.cue('panels'); s.open = 1;
    this.guideTo(this.lmS, 3, 4);
    await l4;
    await D.wait(fast ? 0.5 : 3);
    // 3. Docking, from Mike's seat
    s.approach = 0; this.apK = 0;
    await this.go(D, 'dock', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-0.5, 2.1, -0.9];
    if (!D.kids) {
      await D.say('ch24_06');
      await this.ask(D, 'dock', { hint: this.hcIt.hint, deskHint: this.hcIt.deskHint, after: 1, timeout: 20 });
      s.approach = 1;
      await D.until(() => this.apK >= 1);
    } else {
      s.approach = 1;
      await D.say('ch24_05');
      await D.until(() => this.apK >= 1);
    }
    clank(G, null, 0.5); this.shake(0.012, 0.6); hiss(G, null, 0.15, 1);
    await D.wait(fast ? 0.3 : 1.5);
    // Eagle pulled free
    s.dock = 1; this.dockK = 1;
    await this.go(D, 'space', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-3, 2.6, -6];
    await D.wait(fast ? 0.2 : 0.6); s.pull = 1;
    await D.wait(fast ? 1 : 7);
    // 4. Coasting
    s.ptc = 0; s.shrink = 0; this.shK = 0;
    await this.go(D, 'coast', 0, 1.0, { x: 0, z: 0 });
    s.guide = [0.3, 2.2, -1.0];
    await D.say('ch24_07');
    s.ptc = 1;
    await D.say('ch24_08');
    await D.wait(fast ? 0.3 : 3);
    // 5. The Earth behind your thumb
    s.shrink = 1;
    await D.say('ch24_09');
    if (!D.kids) {
      await D.say('ch24_10');
      await this.ask(D, 'thumb', { hint: this.thumbIt.hint, deskHint: this.thumbIt.deskHint, after: 1, timeout: 15 });
      G.audio.chime?.(null, 0.3);
    }
    await D.wait(fast ? 0.5 : 4);
  }
}
