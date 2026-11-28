// Era 3, Apollo 11 part 6 (n 27): The moonwalk. 20-21 July 1969.
//
// 1. The hatch opens; Neil backs out onto the porch, pulls the ring, and the TV camera swings out.
// 2. A living room on Earth: a family watching the grey, ghostly picture of the ladder ("I'm at the
//    foot of the ladder..."). Then you're there, beside the ladder: "One small step..." Walter
//    Cronkite in his studio. Your feet on the Moon: his footprint, and the small blue Earth above
//    (the music starts here and plays to the end).
// 3. Buzz comes down. "Magnificent desolation." He hops and lopes (Adults hop with him: hold the
//    left stick back for a slow Moon jump).
// 4. The flag (the pole won't go in far). The plaque. The phone call from the Oval Office.
// 5. The experiments: the seismometer, the solar wind sheet, the laser mirror (Adults fire the
//    laser from Earth and count to two and a half). The little packet for the fallen, both sides.
// 6. Neil jogs alone to the rim of Little West crater. (Adults collect rocks with the scoop.)
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo, tvSet } from '../era3/base.js';
import { person, sit, wear } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { envMap, click, beep, clank } from '../era3/fx.js';
import { earthSpace, moonGround } from '../era3/worlds.js';
import { room, surfMat, desk, chair, sofa, armchair, rug, lampStand, curtains, picture } from '../era3/sets.js';
import { holdProp, walkToward } from '../people.js';
import { glowSprite, skyLevel } from '../wow/fx.js';
import { canvasTex, damp, lerp } from '../util.js';
import { rng } from '../shapes.js';

const M = await loadAll(['craft/lm_ascent', 'craft/lm_descent', 'craft/flag_1969', 'craft/laser_reflector', 'craft/seismometer', 'props/helmet_apollo', 'props/hasselblad']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LM_DECK = 2.62, LM_Y = 0.35;          // the descent stage's top deck; its footpads sit 0.35 below its origin
// the site (Eagle at the middle, its ladder and hatch facing +z, i.e. south; the Sun low in the east, behind you)
const LADDER = V(0, 0, 5.2);                  // the foot of the ladder (the front footpad)
const FLAG = V(-3.5, 0, 9.5), SEIS = V(5.5, 0, 12.5), LRRR = V(3.0, 0, 13.0), SWC = V(-1.5, 0, 12.0), PACKET = V(1.2, 0, 7.2);
const LITTLE_WEST = V(60, 0, -4), LW_R = 12;
const SUN = V(1, 0.24, 0.18).normalize();     // from the east, 13 degrees up
const EARTH_DIR = V(-0.41, 0.57, -0.71).normalize();   // above Eagle, as you face it from the south

// a boot print: ridged sole marks pressed into the grey
function bootTex() {
  return canvasTex(128, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = 'rgba(30,30,28,0.55)'; c.beginPath(); c.ellipse(w / 2, h * 0.3, w * 0.36, h * 0.26, 0, 0, 7); c.ellipse(w / 2, h * 0.75, w * 0.3, h * 0.2, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(200,198,190,0.35)'; for (let y = h * 0.08; y < h * 0.95; y += 12) { if (y > h * 0.52 && y < h * 0.58) continue; c.fillRect(w * 0.18, y, w * 0.64, 4); }
  });
}
// the TV picture from the Moon: grey, ghostly, upside-down-ish (the first seconds were), noisy
function drawGhost(c, w, h, t, k) {
  c.fillStyle = '#3a3a3a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#9a9a9a'; c.fillRect(0, h * 0.72, w, h);                               // the bright ground
  c.fillStyle = '#d8d8d8'; c.fillRect(w * 0.3, 0, w * 0.05, h * 0.75);                  // the leg
  c.strokeStyle = '#b8b8b8'; c.lineWidth = 3; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(w * 0.4, h * (0.08 + i * 0.12)); c.lineTo(w * 0.52, h * (0.08 + i * 0.12)); c.stroke(); }   // the ladder rungs
  c.beginPath(); c.moveTo(w * 0.4, 0); c.lineTo(w * 0.4, h * 0.72); c.moveTo(w * 0.52, 0); c.lineTo(w * 0.52, h * 0.72); c.stroke();
  // the white figure coming down: k 0 (top) .. 1 (on the ground)
  const y = lerp(h * 0.08, h * 0.42, k); c.fillStyle = 'rgba(245,245,245,0.92)';
  c.beginPath(); c.ellipse(w * 0.47, y, w * 0.07, h * 0.08, 0, 0, 7); c.fill(); c.fillRect(w * 0.41, y + h * 0.05, w * 0.12, h * 0.2); c.fillRect(w * 0.42, y + h * 0.24, w * 0.04, h * 0.1); c.fillRect(w * 0.48, y + h * 0.24, w * 0.04, h * 0.1);
  // snow and rolling bars
  const r = Math.random; for (let i = 0; i < 500; i++) { const v = r() * 255 | 0; c.fillStyle = `rgba(${v},${v},${v},0.25)`; c.fillRect(r() * w, r() * h, 2, 1); }
  const bar = (t * 40) % (h + 40) - 20; c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, bar, w, 18);
}

export default class A11Moonwalk extends Chapter3 {
  constructor(G) {
    super(G, 27);
    this.start = { pos: V(2.4, 0, 9.0), yaw: yawTo(340) };
    Object.assign(this.s, { hatch: 0, cam: 0, down: 0, step: 0, buzz: 0, hop: 0, flag: 0, exp: 0, laser: 0, packet: 0, jog: 0, scoop: 0 });
    this.buildSite(); this.buildHome(); this.buildStudio(); this.buildOval();
    Object.assign(G.narration.radio, { ch27_03: 'tv', ch27_04: 'tv', ch27_07: 'nasa', ch27_08: 'nasa', ch27_09: 'nasa', ch27_13: 'nasa', ch27_15: 'tv' });
  }

  // ---------- Tranquility Base ----------
  buildSite() {
    const g = new THREE.Group();
    const MG = this.MG = moonGround({ size: 700, seed: 19, craters: [[LITTLE_WEST.x, LITTLE_WEST.z, LW_R, 3.5], [-28, 30, 6, 1.2], [22, 40, 4, 0.8], [-40, -25, 9, 1.8]], flatten: [[0, 0, 8], [2, 10, 7]], rocks: 1100, clear: [[0, 8, 16, 0.12], [LITTLE_WEST.x * 0.5, 4, 34, 0.25]], boulders: [[-12, 18, 0.9], [14, -9, 0.7], [30, 25, 1.1]] });
    g.add(MG.group);
    const H = this.H = MG.height;
    // Eagle
    const env = envMap('moon');
    const lm = this.lm = new THREE.Group(); lm.add(copy(M.lm_descent, env, 1.0)); const as = copy(M.lm_ascent, env, 1.0); as.position.y = LM_DECK; lm.add(as);
    lm.position.set(0, H(0, 0) + LM_Y, 0); g.add(lm);
    // the TV camera on its arm by the ladder (swings out on the ring), and the plaque on the ladder leg
    const ck = new Kit(); ck.box(0.18, 0.12, 0.3, 0x2a2a2c, [0, 0, 0.15]); ck.cyl(0.04, 0.05, 0.08, 10, 0x111111, [0, 0, 0.33], [Math.PI / 2, 0, 0]);
    const cam = this.tvCam = new THREE.Group(); const cm = ck.mesh(FLAT); cam.add(cm); cam.position.set(-0.9, H(0, 0) + 1.6, 3.0); cam.rotation.y = -1.4; g.add(cam);
    const plaque = picture(0.34, 0.2, (c, w, h) => { c.fillStyle = '#d8d8d4'; c.fillRect(0, 0, w, h); c.fillStyle = '#222'; c.font = `bold ${h * 0.09 | 0}px serif`; c.textAlign = 'center';
      c.fillText('HERE MEN FROM THE PLANET EARTH', w / 2, h * 0.5); c.fillText('FIRST SET FOOT UPON THE MOON', w / 2, h * 0.6); c.fillText('JULY 1969, A.D.', w / 2, h * 0.7); c.fillText('WE CAME IN PEACE FOR ALL MANKIND', w / 2, h * 0.82);
      for (const x of [0.27, 0.73]) { c.strokeStyle = '#333'; c.lineWidth = 2; c.beginPath(); c.arc(w * x, h * 0.22, h * 0.16, 0, 7); c.stroke(); } }, { frame: 0xb8b8b4, px: 512, basic: false });
    plaque.position.set(0.12, H(0, 0) + 1.25, 4.05); plaque.rotation.x = -0.15; g.add(plaque); this.plaque = plaque;
    // footprints: a field of them appears as they walk (the first one by the footpad)
    const bt = bootTex(), bm = new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.prints = []; const pr = rng(9);
    const printAt = (x, z, yaw) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.32), bm); m.rotation.set(-Math.PI / 2, 0, yaw); m.position.set(x, H(x, z) + 0.02, z); m.visible = false; g.add(m); this.prints.push(m); return m; };
    this.firstPrint = printAt(0.25, 5.7, 0.2);
    for (let i = 0; i < 120; i++) { const a = pr() * 6.28, d = 1.5 + pr() * 12; printAt(Math.cos(a) * d * 0.8, 6 + Math.sin(a) * d * 0.6, pr() * 6); }
    // Neil and Buzz in their suits, helmets and backpacks
    this.neil = person(g, 'armstrong', V(0, H(0, 3.6) + 2.4, 3.6), Math.PI); this.buzz = person(g, 'aldrin', V(0.6, H(0, 0) + LM_DECK, 1.0), Math.PI);
    for (const P of [this.neil, this.buzz]) { wear(P, copy(M.helmet_apollo), { lift: -0.05, size: 1 }); const pk = new Kit(); pk.box(0.5, 0.65, 0.25, 0xe8e6e0, [0, 1.15, -0.25]); pk.box(0.32, 0.12, 0.2, 0xd8d6d0, [0, 1.55, -0.28]); P.inner.add(pk.mesh(FLAT)); }
    this.buzz.g.visible = false;
    this.people.push(this.neil, this.buzz);
    // the flag (hidden until planted), the seismometer, the laser mirror, the solar wind sheet, the packet
    this.flag = copy(M.flag_1969, env, 1.0); this.flag.position.copy(FLAG).setY(H(FLAG.x, FLAG.z)); this.flag.rotation.y = 0.6; this.flag.visible = false; g.add(this.flag);
    this.seis = copy(M.seismometer, env, 1.0); this.seis.position.copy(SEIS).setY(H(SEIS.x, SEIS.z)); this.seis.rotation.y = 0.3; this.seis.visible = false; g.add(this.seis);
    this.lrrr = copy(M.laser_reflector, env, 1.0); this.lrrr.position.copy(LRRR).setY(H(LRRR.x, LRRR.z)); this.lrrr.rotation.y = -0.2; this.lrrr.visible = false; g.add(this.lrrr);
    const sw = new Kit(); sw.cyl(0.015, 0.015, 1.6, 6, 0xc8c8c0, [0, 0.8, 0]); sw.box(0.32, 1.1, 0.005, 0xe8e8f0, [0, 1.0, 0.02]); sw.box(0.36, 0.03, 0.03, 0xb8b8b0, [0, 1.56, 0.02]);
    this.swc = sw.mesh(FLAT); this.swc.position.copy(SWC).setY(H(SWC.x, SWC.z)); this.swc.rotation.y = 0.4; this.swc.visible = false; g.add(this.swc);
    const pk = new Kit(); pk.box(0.14, 0.03, 0.1, 0xe8e4d8, [0, 0.015, 0]); pk.cyl(0.025, 0.025, 0.01, 12, 0xc8a040, [0.03, 0.035, 0]); pk.cyl(0.022, 0.022, 0.01, 12, 0xc84030, [-0.03, 0.035, 0.01]);
    this.packet = pk.mesh(FLAT); this.packet.position.copy(PACKET).setY(H(PACKET.x, PACKET.z)); this.packet.visible = false; g.add(this.packet);
    // the laser from Earth: a thin green beam, and the pulse's dot travelling up and back
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0x40ff60, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    g.add(this.beam); this.pulse = glowSprite(0x60ff80, 1.2, 0); g.add(this.pulse);
    this.lrrrIt = this.touchable('laser', this.lrrr, { hint: 'Point at the mirror and pull the trigger to fire the laser from Earth', deskHint: 'Click the laser mirror on the ground', r: 0.5, grab: false });
    this.hopIt = this.touchable('hop', () => this.buzz.g.getWorldPosition(new THREE.Vector3()).add(V(0, 1.2, 0)), { hint: 'Pull your left stick back and hold it, for a slow Moon jump', deskHint: 'Click Buzz to hop with him', r: 0.6, grab: false });
    // the scoop and tongs, on the ground by the footpad (Adults pick them up)
    const tk = new Kit(); tk.cyl(0.012, 0.012, 0.8, 6, 0xb8b8b0, [0, 0.4, 0]); tk.box(0.1, 0.03, 0.12, 0x9a9a94, [0, 0.02, 0.05]);
    this.scoop = tk.mesh(FLAT); this.scoop.position.set(1.6, H(1.6, 8.2) + 0.45, 8.2); this.scoop.rotation.z = 1.3; g.add(this.scoop);
    this.scoopIt = this.touchable('scoop', this.scoop, { hint: 'Grab the scoop by your feet and pick up a Moon rock', deskHint: 'Click the scoop on the ground', r: 0.35 });
    this.scoopGlow = glowSprite(0xffe0a0, 0.5, 0); this.scoopGlow.position.copy(this.scoop.position).add(V(0, 0.2, 0)); g.add(this.scoopGlow);
    // the Earth, small and blue, high in the black sky
    const SP = this.SP = earthSpace(this.G, { earthR: 36, cities: false }); SP.earth.position.copy(EARTH_DIR).multiplyScalar(1300); SP.sunDir.copy(SUN);
    this.earthGlow = glowSprite(0x9ac8ff, 120, 0.0); this.earthGlow.position.copy(SP.earth.position); g.add(this.earthGlow);
    this.addScene('site', { group: g, bounds: 14, height: (x, z) => H(x, z) + (this.jumpY || 0), space: SP, amb: 0, fogFar: 9000,
      place: { lat: 0.7, year: 1969, sunLon: 118 },
      exit: () => { skyLevel(this.G, 1, 1); },
      update: (dt, t) => this.updateSite(dt, t) });
  }
  updateSite(dt, t) {
    const s = this.s, H = this.H, G = this.G, SP = this.SP;
    this.G.sky.set(90, -60); skyLevel(this.G, 0.35, 0.3);
    SP.sunDir.copy(SUN); SP.atmoU.sun.value.copy(SUN); SP.earth.rotation.y += dt * 0.01; SP.earth.position.copy(EARTH_DIR).multiplyScalar(1300);
    this.key.position.copy(SUN).multiplyScalar(80); this.key.target.position.set(0, 0, 6); this.key.intensity = 3.0;
    // the hatch and the porch: Neil backs out onto the porch, comes down the ladder
    const lad = LADDER, top = H(0, 0) + LM_Y + 2.15;
    if (!s.step) {
      this.downK = clamp01((this.downK || 0) + (s.down ? dt * this.F / 16 : 0));
      const y = lerp(top + 0.5, H(lad.x, lad.z) + 0.25, ease(this.downK));
      this.neil.g.position.set(lad.x, y, lerp(3.4, lad.z - 0.35, ease(Math.min(1, this.downK * 3))));
      this.neil.g.rotation.y = Math.PI; this.neil.pose = s.down ? 'hold' : 'idle';
      this.neil.g.visible = s.hatch > 0;
    }
    this.tvCam.rotation.y = damp(this.tvCam.rotation.y, s.cam ? 0.2 : -1.4, 1.5, dt);
    // the first step: off the footpad, and the print appears
    if (s.step === 1) { this.neil.g.position.set(lad.x + 0.1, H(lad.x, lad.z + 0.6), lad.z + 0.6); this.neil.g.rotation.y = 0.2; this.firstPrint.visible = true; s.step = 2; }
    // Buzz: down the ladder, then hopping and loping
    if (s.buzz === 1) {
      this.bK = clamp01((this.bK || 0) + dt * this.F / 10);
      this.buzz.g.visible = true; this.buzz.g.position.set(lad.x - 0.1, lerp(top + 0.5, H(lad.x, lad.z) + 0.25, ease(this.bK)), lad.z - 0.35); this.buzz.g.rotation.y = Math.PI; this.buzz.pose = 'hold';
      if (this.bK >= 1) { s.buzz = 2; this.buzz.g.position.set(lad.x - 0.5, H(lad.x - 0.5, lad.z + 0.8), lad.z + 0.8); }
    }
    if (s.hop) {
      // a kangaroo hop across in front of you: slow arcs, a sixth of the weight
      this.hT = (this.hT || 0) + dt * this.F;
      const ph = (this.hT % 1.6) / 1.6, x = -1.5 + Math.sin(this.hT * 0.25) * 2.5, z = 10.5;
      this.buzz.g.position.set(x, H(x, z) + Math.sin(ph * Math.PI) * 0.45, z); this.buzz.g.rotation.y = Math.cos(this.hT * 0.25) > 0 ? Math.PI / 2 : -Math.PI / 2; this.buzz.pose = 'walk';
      if (ph < 0.05) this.prints[(this.pI = ((this.pI || 0) + 1) % 120) + 0] && (this.prints[this.pI].position.set(x, H(x, z) + 0.02, z), this.prints[this.pI].visible = true);
    }
    // your own Moon jump (Adults: left stick held back)
    if (s.want === 'hop') {
      let back = false; for (const h of G.player.hands || []) { const ax = h.gp?.axes || []; const sy = ax.length >= 4 ? ax[3] : ax[1] || 0; if (h.side === 'left' && sy > 0.6) back = true; }
      this.holdBack = back ? (this.holdBack || 0) + dt : 0; if (this.holdBack > 0.35) G.act({ type: 'touch', key: 'hop' });
    }
    if (this.jumpT != null) { this.jumpT += dt; const k = this.jumpT / 2.4; this.jumpY = k < 1 ? Math.sin(k * Math.PI) * 1.1 : 0; if (k >= 1) this.jumpT = null; }
    // the flag, the experiments, the packet
    this.flag.visible = !!s.flag; if (s.flag) { this.fK = clamp01((this.fK || 0) + dt * this.F / 3); this.flag.position.y = H(FLAG.x, FLAG.z) + lerp(0.6, 0, ease(this.fK)); }
    this.seis.visible = this.lrrr.visible = this.swc.visible = !!s.exp; this.packet.visible = !!s.packet;
    // the laser: up to Earth and back, 2.5 seconds
    if (this.lzT != null) {
      this.lzT += dt; const up = this.lrrr.position.clone().add(V(0, 0.3, 0)), far = up.clone().addScaledVector(EARTH_DIR, 400);
      this.beam.position.copy(up).lerp(far, 0.5); this.beam.scale.set(1, 400, 1); this.beam.quaternion.setFromUnitVectors(V(0, 1, 0), EARTH_DIR); this.beam.material.opacity = Math.max(0, 0.5 - this.lzT * 0.12);
      const k = this.lzT / 2.5; this.pulse.material.opacity = k < 1 ? 0.9 : 0; this.pulse.position.copy(up).addScaledVector(EARTH_DIR, (k < 0.5 ? k * 2 : 2 - k * 2) * 400);
      if (this.lzT > 2.5 && !this.lzBack) { this.lzBack = true; beep(G, null, 0.12, 1400, 0.25); G.ui.showHint('Back in 2.5 seconds: the light went to the Moon and home again', 5); }
      if (this.lzT > 5) { this.lzT = null; this.beam.material.opacity = 0; }
    }
    // Neil's jog to Little West crater, and back toward you
    if (s.jog === 1) { const rim = V(LITTLE_WEST.x - LW_R - 1, 0, LITTLE_WEST.z); if (walkToward(this.neil, rim.x, rim.z, dt * this.F, { speed: 1.6, height: (x, z) => H(x, z) })) { s.jog = 2; this.neil.pose = 'idle'; this.neil.look = LITTLE_WEST.clone().setY(H(LITTLE_WEST.x, LITTLE_WEST.z)); } }
    this.scoopGlow.material.opacity = s.want === 'scoop' ? 0.5 + 0.3 * Math.sin(t * 5) : 0;
    // they look at you now and then; at the flag when it goes up
    if (s.flag && !s.exp) { this.neil.look = this.flag.position.clone().add(V(0, 1.6, 0)); this.buzz.look = this.flag.position.clone().add(V(0, 1.6, 0)); }
  }

  // ---------- A living room on Earth ----------
  buildHome() {
    const R = room(5.5, 4.6, 2.6, { floor: surfMat('carpet', '#6a5a48'), wall: surfMat('wallpaper', '#9aa88a'), ceil: surfMat('plaster', '#ece4d4'), windows: [{ side: 'e', at: 0.6, y: 0.9, w: 1.3, h: 1.2 }], doors: [{ side: 'w', at: 1.2, w: 0.9, h: 2.1 }], skirt: 0x3a2a1e, outside: surfMat('brick'), thick: 0.2 });
    const g = R.group, k = new Kit();
    rug(k, 0, 0.4, 0, { w: 2.6, d: 1.8, col: 0x5a3a28 });
    sofa(k, 0, 1.5, Math.PI, { col: 0x8a6a3a, w: 2.0 }); armchair(k, 1.9, 0.6, Math.PI + 0.7, { col: 0x5a6a7a });
    lampStand(k, -1.6, 1.8, { h: 1.5 }); curtains(k, R.windows[0], { col: 0xc8a060 });
    k.box(0.5, 0.45, 0.5, 0x6a4a2a, [-1.4, 0.22, 1.5]); k.box(0.24, 0.02, 0.18, 0xe8e4d8, [-1.4, 0.46, 1.5]);   // a side table and a newspaper
    g.add(k.mesh(FLAT));
    const tv = this.homeTV = tvSet((c, w, h, t) => drawGhost(c, w, h, t, this.ghostK || 0), { w: 0.66, legs: true }); tv.g.position.set(0, 0, -1.9); g.add(tv.g);
    // the family: on the sofa, Grandma in the armchair, the kids on the rug as close as they can get
    this.fam = [];
    for (const [who, x, z, yaw, seat] of [['man_casual', -0.55, 1.5, Math.PI, 1], ['woman_summer', 0.25, 1.5, Math.PI, 1], ['woman_older', 1.9, 0.6, Math.PI + 0.7, 1], ['boy', -1.0, -0.7, Math.PI - 0.5, 0], ['girl', -0.5, -1.0, Math.PI - 0.3, 0]]) {
      const P = person(g, who, V(x, 0, z), yaw); if (seat) sit(P); P.look = V(0, 0.8, -1.9); this.fam.push(P);
    }
    this.people.push(...this.fam);
    this.addScene('home', { group: g, bounds: 0.8, indoors: true, place: { lat: 41.5, year: 1969, sunLon: 118 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(290, -25); this.lamp.position.set(-1.6, 1.6, 1.8); this.lamp.intensity = 0.8; this.lamp.distance = 6; this.lamp2.position.set(0, 0.95, -1.4); this.lamp2.color.setHex(0xc8d4ff); this.lamp2.intensity = 0.8 + 0.25 * Math.sin(this.t * 9); this.lamp2.distance = 4; },
      exit: () => { this.lamp2.color.setHex(0xfff0dc); },
      update: (dt, t) => { this.homeTV.pic.update(dt, t); for (const P of this.fam) P.pose = this.s.cheerHome ? 'cheer' : 'idle'; } });
  }

  // ---------- Walter Cronkite's studio ----------
  buildStudio() {
    const R = room(7, 6, 3.2, { floor: surfMat('lino', '#3a3a40'), wall: surfMat('plaster', '#2a3040'), ceil: surfMat('plaster', '#1a1a20') });
    const g = R.group, k = new Kit();
    k.box(2.6, 0.75, 0.9, 0x6a7a8a, [0, 0.375, -1.0]); k.box(2.7, 0.04, 1.0, 0x8a9aa8, [0, 0.77, -1.0]);
    for (const x of [-0.5, 0.5]) k.box(0.22, 0.05, 0.3, 0x222222, [x, 0.8, -1.2]);
    g.add(k.mesh(FLAT));
    const back = picture(5.5, 2.2, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a2a4a'); gr.addColorStop(1, '#0a1428'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f0f0f0'; c.font = `bold ${h * 0.18 | 0}px sans-serif`; c.textAlign = 'center'; c.fillText('MAN ON THE MOON', w * 0.56, h * 0.36); c.font = `${h * 0.1 | 0}px sans-serif`; c.fillStyle = '#c8d4e8'; c.fillText('THE EPIC JOURNEY OF APOLLO 11', w * 0.56, h * 0.55);
      c.fillStyle = '#e8e8e0'; c.beginPath(); c.arc(w * 0.08, h * 0.45, h * 0.16, 0, 7); c.fill(); c.fillStyle = '#9a9a94'; for (const [x, y, r] of [[0.07, 0.4, 0.035], [0.1, 0.5, 0.025], [0.075, 0.52, 0.02]]) { c.beginPath(); c.arc(w * x, h * y, h * r, 0, 7); c.fill(); } }, { frame: 0x111111, px: 1024, basic: true });
    back.position.set(0, 1.9, -2.9); g.add(back);
    for (const x of [-2.4, 2.4]) { const tv = tvSet((c, w, h, t) => drawGhost(c, w, h, t, 1), { w: 0.55, legs: false }); tv.g.position.set(x, 0.8, -2.2); tv.g.rotation.y = -x * 0.15; g.add(tv.g); (this.stTVs ||= []).push(tv); }
    this.cronkite = person(g, 'cronkite', V(0, 0, -1.65), 0); sit(this.cronkite); this.cronkite.look = V(0, 1.2, 2.5);
    this.people.push(this.cronkite);
    this.addScene('studio', { group: g, bounds: 0.6, indoors: true, place: { lat: 40.7, year: 1969, sunLon: 118 }, amb: 0.03, fogFar: 300,
      sky: () => { this.G.sky.set(290, -25); this.lamp.position.set(0, 2.8, 1.0); this.lamp.intensity = 2.4; this.lamp.distance = 8; this.lamp2.position.set(-2, 2.4, -0.5); this.lamp2.intensity = 0.8; this.lamp2.distance = 6; },
      update: (dt, t) => { for (const tv of this.stTVs) tv.pic.update(dt, t); this.cronkite.pose = 'talk'; } });
  }

  // ---------- The Oval Office ----------
  buildOval() {
    const R = room(7.5, 6, 3.4, { floor: surfMat('carpet', '#2a3a6a'), wall: surfMat('plaster', '#e8e0c8'), ceil: surfMat('plaster', '#f4f0e4'), windows: [{ side: 'n', at: -1.4, y: 0.6, w: 1.1, h: 2.2 }, { side: 'n', at: 0, y: 0.6, w: 1.1, h: 2.2 }, { side: 'n', at: 1.4, y: 0.6, w: 1.1, h: 2.2 }], skirt: 0xd8d0b8, thick: 0.2 });
    const g = R.group, k = new Kit();
    desk(k, 0, -1.6, 0, { w: 2.0, d: 0.9, col: 0x4a2a18 }); chair(k, 0, -2.3, 0, { col: 0x3a2418, seat: 0x2a2a2a, h: 0.5 });
    rug(k, 0, 0.6, 0, { w: 4, d: 3, col: 0x2a3a6a, border: 0xd8c060 });
    for (const wn of R.windows) curtains(k, wn, { col: 0xc8a040 });
    k.cyl(0.015, 0.015, 2.2, 6, 0xc8a040, [-1.9, 1.1, -2.6]); k.cyl(0.015, 0.015, 2.2, 6, 0xc8a040, [1.9, 1.1, -2.6]);
    k.box(0.12, 0.1, 0.18, 0x1a1a1a, [0.5, 0.82, -1.5]);   // the telephone
    g.add(k.mesh(FLAT));
    for (const [x, draw] of [[-1.9, (c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#fff' : '#b22234'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, w * 0.4, h * 0.54); }], [1.9, (c, w, h) => { c.fillStyle = '#1a2a6a'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8e0c0'; c.beginPath(); c.arc(w / 2, h / 2, w * 0.22, 0, 7); c.fill(); }]]) {
      const f = picture(0.8, 1.1, draw, { frame: 0xc8a040 }); f.position.set(x + (x < 0 ? 0.4 : -0.4), 1.6, -2.6); g.add(f);
    }
    // a TV beside the desk showing the Moon (they could see each other: the President on one side, the Moon on the other)
    const tv = this.ovalTV = tvSet((c, w, h, t) => drawGhost(c, w, h, t, 1), { w: 0.6, legs: true }); tv.g.position.set(2.2, 0, -0.6); tv.g.rotation.y = -1.0; g.add(tv.g);
    this.nixon = person(g, 'nixon', V(0.4, 0, -2.1), 0); sit(this.nixon); this.nixon.look = V(2.2, 1.0, -0.6);
    this.people.push(this.nixon);
    this.addScene('oval', { group: g, bounds: 0.8, indoors: true, place: { lat: 38.9, year: 1969, sunLon: 118 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(270, -20); this.lamp.position.set(0, 3.0, 0.5); this.lamp.intensity = 2.2; this.lamp.distance = 9; this.lamp2.position.set(2.0, 1.0, -0.3); this.lamp2.color.setHex(0xc8d4ff); this.lamp2.intensity = 0.6; this.lamp2.distance = 3; },
      exit: () => { this.lamp2.color.setHex(0xfff0dc); },
      update: (dt, t) => { this.ovalTV.pic.update(dt, t); this.nixon.pose = 'talk'; } });
  }

  act(a) {
    if (a.type === 'touch' && a.key === 'hop' && this.s.want === 'hop') this.jumpT = 0;
    if (a.type === 'touch' && a.key === 'laser' && this.s.want === 'laser') { this.lzT = 0; this.lzBack = false; }
    return super.act(a);
  }

  beds() { return [
    { kind: 'room', vol: 0.06, on: (ch) => ch.cur === 'home' || ch.cur === 'studio' || ch.cur === 'oval' },
  ]; }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast, H = this.H;
    Object.assign(s, { hatch: 0, cam: 0, down: 0, step: 0, buzz: 0, hop: 0, flag: 0, exp: 0, packet: 0, jog: 0 });
    this.downK = 0; this.bK = 0; this.ghostK = 0;
    for (const p of this.prints) p.visible = false;
    // 1. The hatch opens
    await this.go(D, 'site', yawTo(340), 0.1, { x: 2.4, z: 9.0 });
    s.guide = [3.4, 2.6, 7.6];
    s.hatch = 1; clank(G, null, 0.15);
    const l1 = D.sayAsync('ch27_01');
    await D.cue('ring'); s.cam = 1; click(G, null, 0.2);
    await l1;
    // 2. Watching on Earth
    await this.go(D, 'home', yawTo(320), 0.8, { x: 1.7, z: 1.4 });
    s.guide = [0.6, 1.9, -0.6];
    s.down = 1;
    await D.say('ch27_02');
    this.ghostK = 0.6;
    await D.say('ch27_03');
    this.ghostK = 1;
    // the step, from beside the ladder
    this.downK = 1;
    await this.go(D, 'site', yawTo(350), 0.6, { x: 1.6, z: 7.6 });
    s.guide = [3.0, 2.6, 6.8];
    const l4 = D.sayAsync('ch27_04');
    await D.wait(fast ? 0.3 : 1.2); s.step = 1;
    await l4;
    await this.go(D, 'studio', 0, 0.6, { x: 0, z: 1.2 });
    s.guide = [-1.6, 1.9, 0.2];
    await D.say('ch27_05');
    await this.go(D, 'site', yawTo(350), 0.6, { x: 1.4, z: 8.0 });
    s.guide = [2.6, 2.6, 7.2];
    this.guideTo(this.firstPrint, 0.6, 0.6);
    const l6 = D.sayAsync('ch27_06');            // the music begins here, and plays to the end
    await D.cue('look up'); this.guideTo(this.SP.earth.position.clone().normalize().multiplyScalar(6).add(V(1.4, 1.6, 8)), 0, 1.2);
    await l6;
    // 3. Buzz comes down
    s.buzz = 1; this.bK = 0;
    await D.say('ch27_07');
    await D.say('ch27_08');
    await D.until(() => s.buzz === 2 || fast, 12);
    s.buzz = 2;
    await D.say('ch27_09');
    s.hop = 1; this.hT = 0;
    await D.say('ch27_10');
    if (!D.kids) { await D.say('ch27_11'); await this.ask(D, 'hop', { hint: this.hopIt.hint, deskHint: this.hopIt.deskHint, after: 1, timeout: 15 }); await D.wait(fast ? 0.3 : 2.4); }
    s.hop = 0; this.buzz.g.position.set(-2.2, H(-2.2, 9.2), 9.2); this.buzz.pose = 'idle';
    // 4. The flag, the plaque, the phone call
    s.flag = 1; this.fK = 0; this.neil.g.position.set(-2.6, H(-2.6, 9.0), 9.0); this.neil.g.rotation.y = -0.8;
    this.guideTo(FLAG.clone().setY(H(FLAG.x, FLAG.z) + 1.8), 0.4, 0.8);
    await D.say('ch27_12');
    this.neil.g.position.set(0.6, H(0.6, 4.9), 4.9); this.neil.g.rotation.y = Math.PI; this.neil.look = this.plaque.position;
    this.guideTo(this.plaque, 0.5, 0.6);
    await D.say('ch27_13');
    await D.say('ch27_14');
    await this.go(D, 'oval', 0, 0.6, { x: 0, z: 1.4 });
    s.guide = [-1.5, 2.0, 0.2];
    await D.say('ch27_15');
    // 5. The experiments
    s.exp = 1; this.neil.g.position.set(4.6, H(4.6, 11.4), 11.4); this.neil.g.rotation.y = 2.4; this.buzz.g.position.set(2.0, H(2.0, 12.0), 12.0); this.buzz.g.rotation.y = 2.0;
    await this.go(D, 'site', yawTo(80), 0.6, { x: 0.8, z: 11.6 });
    s.guide = [1.6, 2.4, 10.2];
    this.guideTo(this.lrrr, 0.6, 0.6);
    await D.say('ch27_16');
    if (!D.kids) { await D.say('ch27_17'); await this.ask(D, 'laser', { hint: this.lrrrIt.hint, deskHint: this.lrrrIt.deskHint, after: 1, timeout: 15 }); this.lzT ??= 0; await D.wait(fast ? 0.5 : 5); }
    s.packet = 1; this.buzz.g.position.set(1.6, H(1.6, 7.8), 7.8); this.buzz.g.rotation.y = Math.PI + 0.4; this.buzz.pose = 'idle'; this.buzz.look = PACKET.clone();
    this.guideTo(this.packet, 0.5, 0.5);
    await D.say('ch27_18');
    // 6. Little West crater
    s.jog = 1; this.neil.g.position.set(4.0, H(4.0, 8.0), 8.0);
    this.guideTo(LITTLE_WEST.clone().setY(H(LITTLE_WEST.x, LITTLE_WEST.z) + 5), 1, 0);
    await D.say('ch27_19');
    if (!D.kids) { await D.say('ch27_20'); await this.ask(D, 'scoop', { hint: this.scoopIt.hint, deskHint: this.scoopIt.deskHint, after: 1, timeout: 20 }); }
    await D.wait(fast ? 0.5 : 5);
  }
}
