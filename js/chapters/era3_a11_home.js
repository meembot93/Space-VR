// Era 3, Apollo 11 part 8 (n 29): Homecoming. 21-24 July 1969.
//
// 1. Behind the Moon one last time, the engine fires for home. "Time to open up the LRL doors, Charlie."
// 2. Reentry: the window glows orange, then blazing white, then black.
// 3. Three red-and-white parachutes bloom against the blue Pacific sky (the music starts and plays
//    to the end). Splashdown, 24 July; Navy swimmers in the water.
// 4. On USS Hornet: the crew wave through the window of the sealed trailer; the President greets them.
// 5. Huntsville, Alabama: the crowd lifts Wernher von Braun onto their shoulders.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo } from '../era3/base.js';
import { person, sit, wear } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { cabin, dressCabin } from '../era3/cabin.js';
import { envMap, flameMesh, cabinRumble, clank, beep, wave } from '../era3/fx.js';
import { moonGround, spaceSun, sea, groundPlane } from '../era3/worlds.js';
import { picture } from '../era3/sets.js';
import { glowSprite, glowPoints, rumble, whoosh } from '../wow/fx.js';
import { canvasTex, damp, lerp } from '../util.js';
import { rng } from '../shapes.js';

const M = await loadAll(['craft/apollo_csm', 'props/helmet_apollo']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);
const _a = new THREE.Vector3();

// the Moon's far side from orbit, dark (as in parts 4 and 7)
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
// Keep only the Command Module of the CSM model (cut away the Service Module below it)
function cmOnly(o) {
  const plane = new THREE.Plane(V(0, 1, 0), 0);
  o.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); c.material.clippingPlanes = [plane]; } });
  return () => { o.updateWorldMatrix(true, false); const up = V(0, 1, 0).transformDirection(o.matrixWorld), p = o.getWorldPosition(_a); plane.setFromNormalAndCoplanarPoint(up, p.addScaledVector(up, -0.02)); };
}
// a parachute: a shallow dome of red and white panels, with its lines down to a point
function chute(R = 4) {
  const g = new THREE.Group();
  const tex = canvasTex(512, 128, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#f4f0e8' : '#d83020'; c.fillRect(i * w / 16, 0, w / 16 + 1, h); } c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, h * 0.85, w, h * 0.15); });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.45 }));
  dome.scale.y = 0.6; g.add(dome);
  const lines = []; const rim = R * Math.sin(Math.PI * 0.42), ry = R * Math.cos(Math.PI * 0.42) * 0.6;
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; lines.push(Math.cos(a) * rim, ry, Math.sin(a) * rim, 0, -R * 2.6, 0); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xd8d4c8, transparent: true, opacity: 0.6 })));
  return g;
}

export default class A11Home extends Chapter3 {
  constructor(G) {
    super(G, 29);
    G.renderer.localClippingEnabled = true;
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { tei: 0, heat: 0, chutes: 0, splash: 0, lift: 0 });
    this.buildTEI(); this.buildReentry(); this.buildSea(); this.buildHornet(); this.buildHuntsville();
    Object.assign(G.narration.radio, { ch29_02: 'nasa', ch29_07: 'tv' });
  }

  // ---------- 1. The burn for home, behind the Moon ----------
  buildTEI() {
    const g = new THREE.Group();
    const moon = this.moonT = orbitGround(57); g.add(moon);
    const csm = this.csmT = new THREE.Group(); const o = copy(M.apollo_csm, envMap('space'), 1.1); csm.add(o); csm.rotation.set(0, 0.5, -Math.PI / 2 - 0.1); csm.position.set(1.5, 0.8, -12); g.add(csm);
    const ex = new THREE.Box3().setFromObject(o);
    this.sps = flameMesh(8, 1.6, 'hyper'); this.sps.position.y = ex.min.y; o.add(this.sps); this.sps.userData.set(0, 0);
    this.addScene('tei', { group: g, bounds: 0.4, amb: 0, fogFar: 9000, airless: true,
      enter: () => { this.G.sky.set(200, -70); },
      update: (dt, t) => {
        const s = this.s;
        moon.userData.slide(dt * this.F, 10);
        this.key.position.set(-30, 10, 20); this.key.target.position.copy(csm.position); this.key.intensity = 0.25;   // only starlight and earthshine
        this.sps.userData.set(s.tei ? 0.9 + 0.1 * Math.sin(t * 31) : 0, t);
        this.flameLight.position.copy(csm.position).add(V(-10, 0, 3)); this.flameLight.intensity = s.tei ? 10 : 0; this.flameLight.distance = 40; this.flameLight.color.setHex(0xffc890);
        this.teiK = s.tei ? (this.teiK || 0) + dt * this.F : this.teiK || 0;
        csm.position.x = 1.5 + this.teiK * this.teiK * 0.03;
      } });
  }

  // ---------- 2. Reentry ----------
  buildReentry() {
    const g = new THREE.Group();
    const C = this.Cr = cabin('apollo', { seat: 'center' }); g.add(C.group);
    dressCabin(C);
    this.neilR = person(C.group, 'armstrong', C.crew[0].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.neilR);
    this.mikeR = person(C.group, 'collins', C.crew[1].pos.clone().add(V(0, 0.45, 0.1)), 0); sit(this.mikeR);
    for (const P of [this.neilR, this.mikeR]) wear(P, copy(M.helmet_apollo), { lift: -0.05, size: 1 });
    this.people.push(this.neilR, this.mikeR);
    // the fire outside every window: a glow filling the glass
    this.fire = C.windows.map((w) => { const s = glowSprite(0xff8030, 0.9, 0); s.position.copy(w.local).multiplyScalar(1.05).add(EYE); C.group.add(s); return s; });
    this.addScene('reentry', { group: g, bounds: 0.2, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { C.lights(true, 0.6); this.G.sky.set(200, -70); },
      update: (dt, t) => {
        const s = this.s;
        this.hK = s.heat ? (this.hK || 0) + dt * this.F / 14 : 0;
        const k = this.hK, glow = k < 0.15 ? k / 0.15 : k < 0.8 ? 1 : Math.max(0, 1 - (k - 0.8) / 0.15);
        const col = new THREE.Color(0xff6a20).lerp(new THREE.Color(0xfff4e0), clamp01((k - 0.25) / 0.3) * (k < 0.7 ? 1 : 0.4));
        this.fire.forEach((f, i) => { f.material.color.copy(col); f.material.opacity = glow * (0.8 + 0.2 * Math.sin(t * 23 + i)); f.scale.setScalar(0.9 + glow * 0.5); });
        this.lamp.position.set(0, 2.2, -1.0); this.lamp.color.copy(col); this.lamp.intensity = glow * 3.5; this.lamp.distance = 4;
        if (s.heat && glow > 0.3) C.group.position.set((Math.random() - 0.5) * 0.006 * glow, (Math.random() - 0.5) * 0.006 * glow, 0); else C.group.position.set(0, 0, 0);
        if (s.heat && (this.rT = (this.rT || 0) - dt) <= 0) { this.rT = 3; cabinRumble(this.G, 4, 0.18 * glow + 0.02); }
      },
      exit: () => { this.lamp.color.setHex(0xffe8c8); } });
  }

  // ---------- 3. Parachutes and splashdown ----------
  buildSea() {
    const g = new THREE.Group();
    const S = this.seaM = sea({ size: 6000, col: 0x1a4a7a, sky: 0x8ab8e8, sun: V(0.4, 0.7, -0.4) }); S.position.y = -0.3; g.add(S);
    const cm = this.cmS = new THREE.Group(); const o = copy(M.apollo_csm, envMap('day'), 0.9); cm.add(o); g.add(cm); this.cmClip = cmOnly(o);
    this.chutes = [0, 1, 2].map((i) => { const c = chute(4.2); const a = i / 3 * Math.PI * 2; c.userData.off = V(Math.cos(a) * 3.6, 12.5, Math.sin(a) * 3.6); c.userData.tilt = V(Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28); g.add(c); return c; });
    // the splash, and the swimmers' raft beside the floating capsule
    this.splash = glowSprite(0xffffff, 14, 0); g.add(this.splash);
    const rk = new Kit(); rk.cyl(1.6, 1.6, 0.35, 20, 0xd8a020, [0, 0, 0]); rk.cyl(1.2, 1.2, 0.36, 20, 0x8a6a1a, [0, 0.01, 0]);
    this.raft = rk.mesh(FLAT); g.add(this.raft);
    this.swim = ['frogman', 'frogman', 'frogman'].map((w, i) => { const P = person(g, w, V(0, -99, 0), 0); return P; });
    this.people.push(...this.swim);
    this.heli = new THREE.Group(); const hk = new Kit(); hk.ball(1.4, 1, 0x3a4a5a, [0, 0, 0], 0, [1.6, 1, 1]); hk.cyl(0.25, 0.15, 5, 6, 0x3a4a5a, [0, 0.2, 4], [Math.PI / 2, 0, 0]); hk.box(9, 0.06, 0.4, 0x222222, [0, 1.6, 0]); hk.box(0.4, 0.06, 9, 0x222222, [0, 1.6, 0]);
    this.heli.add(hk.mesh(FLAT)); g.add(this.heli);
    this.addScene('sea', { group: g, bounds: 0.6, place: { lat: 13.3, year: 1969, sunLon: 121 }, amb: 0.5, fogFar: 4000, mist: 0.05,
      height: () => 0.6,
      sky: () => { this.G.sky.set(80, 42); this.key.position.set(40, 70, -30); this.key.target.position.set(0, 0, -30); this.key.intensity = 2.6; },
      update: (dt, t) => {
        const s = this.s;
        this.seaM.userData.update?.(t);
        // descending: from 70 m up, ahead of you, to the water
        this.dK = s.chutes ? clamp01((this.dK || 0) + dt * this.F / 26) : 0;
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
        // the swimmers and the raft, once it's down
        const down = this.dK >= 1;
        this.raft.visible = down; this.raft.position.set(cm.position.x + 3.6, -0.2 + Math.sin(t * 1.1) * 0.15, cm.position.z + 1.5);
        this.swim.forEach((P, i) => { P.g.visible = down; P.g.position.set(cm.position.x + 2.6 + i * 0.8, -1.1 + Math.sin(t * 1.2 + i) * 0.1, cm.position.z + 2.4 - i * 0.6); P.g.rotation.y = -1.2; P.pose = i === 1 ? 'wave' : 'idle'; });
        this.heli.position.set(cm.position.x + 30 - (t % 40) * 0.3, 28, cm.position.z - 20); this.heli.rotation.y = 1.2;
      } });
  }

  // ---------- 4. USS Hornet: the sealed trailer and the President ----------
  buildHornet() {
    const g = new THREE.Group();
    const S = this.seaH = sea({ size: 6000, col: 0x1a4a7a, sky: 0x8ab8e8, sun: V(0.4, 0.7, -0.4) }); S.position.y = -18; g.add(S);
    // the flight deck: grey steel, painted lines, the island to one side
    const deckTex = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#5a5e60'; c.fillRect(0, 0, w, h); const r = rng(3); for (let i = 0; i < 3000; i++) { const v = 80 + r() * 30 | 0; c.fillStyle = `rgba(${v},${v + 3},${v + 5},0.3)`; c.fillRect(r() * w, r() * h, 3, 1); } c.fillStyle = 'rgba(30,30,30,0.4)'; for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 1); c.fillStyle = '#e8e4d0'; c.fillRect(w * 0.48, 0, 6, h); });
    deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping; deckTex.repeat.set(4, 16);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(32, 1, 120), new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.85 })); deck.position.set(0, -0.5, -20); g.add(deck);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(28, 17, 116), new THREE.MeshStandardMaterial({ color: 0x6a7074, roughness: 0.8 })); hull.position.set(0, -9.5, -20); g.add(hull);
    const k = new Kit();
    k.box(5, 12, 20, 0x7a8084, [13, 6, -26]); k.box(3, 4, 8, 0x7a8084, [13, 14, -26]); k.cyl(0.2, 0.2, 10, 6, 0x5a5e60, [13, 21, -26]);   // the island, mast
    k.box(0.2, 1.0, 120, 0x9a9e9a, [-16, 0.5, -20]);
    // a bunting-hung platform for the President, a band's music stands, a red carpet to the trailer
    k.box(4, 0.3, 3, 0x6a3a2a, [-3.5, 0.15, -4]); k.box(1.6, 0.04, 6, 0xa02020, [-1.2, 0.02, -2]);
    for (let i = 0; i < 6; i++) k.cyl(0.015, 0.015, 1.1, 4, 0x2a2a2a, [-9 + i * 0.7, 0.55, 3]);
    g.add(k.mesh(FLAT));
    const bunting = picture(4.2, 0.6, (c, w, h) => { const cols = ['#b22234', '#f4f0e8', '#3c3b6e']; for (let i = 0; i < 9; i++) { c.fillStyle = cols[i % 3]; c.beginPath(); c.moveTo(i * w / 9, 0); c.lineTo((i + 1) * w / 9, 0); c.quadraticCurveTo((i + 0.5) * w / 9, h * 1.6, i * w / 9, 0); c.fill(); } }, { frame: 0x6a3a2a, px: 512 });
    bunting.position.set(-3.5, 0.6, -2.45); g.add(bunting);
    // the Mobile Quarantine Facility: a silver trailer with a rounded back and a window in it
    // (hollow, so you can see the crew through the window: walls, roof and floor as separate panels)
    const mq = new Kit(), SIL = 0xc8ccd0, W = 1.3, L = 5, Y0 = 0.2, Y1 = 2.8, WZ0 = 1.8, WZ1 = 3.2, WY0 = 1.55, WY1 = 2.25;
    mq.box(0.05, Y1 - Y0, 2 * L, SIL, [-W, (Y0 + Y1) / 2, 0]);                                  // the far wall
    mq.box(0.05, WY0 - Y0, 2 * L, SIL, [W, (Y0 + WY0) / 2, 0]); mq.box(0.05, Y1 - WY1, 2 * L, SIL, [W, (WY1 + Y1) / 2, 0]);   // the near wall, below and above the window
    mq.box(0.05, WY1 - WY0, WZ0 + L, SIL, [W, (WY0 + WY1) / 2, (-L + WZ0) / 2]); mq.box(0.05, WY1 - WY0, L - WZ1, SIL, [W, (WY0 + WY1) / 2, (WZ1 + L) / 2]);
    mq.box(2 * W, 0.08, 2 * L, 0x9a9ea2, [0, Y1, 0]); mq.box(2 * W, 0.08, 2 * L, 0x6a6a6a, [0, Y0, 0]); mq.box(2 * W, Y1 - Y0, 0.05, SIL, [0, (Y0 + Y1) / 2, L]);
    mq.cyl(W, W, Y1 - Y0, 20, SIL, [0, (Y0 + Y1) / 2, -L], [0, 0, 0], [1, 1, 0.6]);
    for (let z = -4.5; z <= 4.5; z += 0.5) for (const sx of [-1, 1]) mq.box(0.02, 0.03, 0.03, 0xa8acb0, [sx * (W + 0.03), 1.0, z]);
    mq.box(0.05, 0.08, WZ1 - WZ0 + 0.16, 0x7a7e82, [W + 0.02, WY0 - 0.04, (WZ0 + WZ1) / 2]); mq.box(0.05, 0.08, WZ1 - WZ0 + 0.16, 0x7a7e82, [W + 0.02, WY1 + 0.04, (WZ0 + WZ1) / 2]);
    mq.box(1.6, 0.05, 0.6, 0xd8d4c8, [0.2, 1.0, (WZ0 + WZ1) / 2]);                                // a shelf inside, under the window
    mq.cyl(0.35, 0.35, 0.3, 12, 0x2a2a2a, [1.1, 0.35, -3.2], [0, 0, Math.PI / 2]); mq.cyl(0.35, 0.35, 0.3, 12, 0x2a2a2a, [-1.1, 0.35, -3.2], [0, 0, Math.PI / 2]);
    const mqf = mq.mesh(FLAT); mqf.position.set(0, 0, -9); g.add(mqf);
    const inside = new THREE.PointLight(0xfff0d8, 1.2, 4, 1.5); inside.position.set(0.3, 2.3, -6.5); g.add(inside);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(WZ1 - WZ0, WY1 - WY0), new THREE.MeshBasicMaterial({ color: 0x9ab8d0, transparent: true, opacity: 0.12, depthWrite: false })); glass.position.set(W + 0.01, (WY0 + WY1) / 2, -9 + (WZ0 + WZ1) / 2); glass.rotation.y = Math.PI / 2; g.add(glass);
    const sign = picture(2.4, 0.5, (c, w, h) => { c.fillStyle = '#f4f0e8'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a2a5a'; c.font = `bold ${h * 0.42 | 0}px sans-serif`; c.textAlign = 'center'; c.fillText('HORNET + 3', w / 2, h * 0.66); }, { frame: 0x1a2a5a, px: 512 });
    sign.position.set(1.33, 2.55, -10.5); sign.rotation.y = Math.PI / 2; g.add(sign);
    // the crew at the window (in their flight suits), the President outside it
    this.crewW = [['armstrong_casual', 2.5], ['aldrin_casual', 3.0], ['collins_casual', 2.0]].map(([w, z], i) => { const P = person(g, w, V(0.55 - i * 0.12, 0.24, -9 + z), Math.PI / 2); P.pose = 'wave'; return P; });
    this.nixon = person(g, 'nixon', V(2.6, 0, -6.3), -Math.PI / 2 + 0.2); this.nixon.look = V(1.3, 1.9, -6.5);
    this.navy = [['navy_officer', 3.8, -4.6, -1.2], ['sailor_us', 5.0, -8.0, -1.6], ['sailor_us', 5.6, -6.0, -1.4], ['sailor_us', 4.6, -11.0, -1.9], ['navy_officer', 3.4, -12.0, -2.2]].map(([w, x, z, yaw]) => person(g, w, V(x, 0, z), yaw));
    this.people.push(...this.crewW, this.nixon, ...this.navy);
    this.addScene('hornet', { group: g, bounds: 3, place: { lat: 13.3, year: 1969, sunLon: 121 }, amb: 0.5, fogFar: 4000, mist: 0.04,
      sky: () => { this.G.sky.set(100, 35); this.key.position.set(40, 70, -10); this.key.target.position.set(0, 0, -8); this.key.intensity = 2.6; },
      update: (dt, t) => {
        this.seaH.userData.update?.(t);
        this.nixon.pose = this.s.nixon ? 'talk' : 'wave';
        for (const P of this.navy) P.look = this.nixon.g.position.clone().add(V(0, 1.6, 0));
      } });
  }

  // ---------- 5. Huntsville: von Braun on their shoulders ----------
  buildHuntsville() {
    const g = new THREE.Group();
    g.add(groundPlane({ size: 400, seg: 40, color: (x, z, c) => c.setHex(Math.abs(x) < 6 ? 0x3a3a3c : 0x5a5a52) }));
    // the courthouse square: brick fronts with lit windows, a banner, street lamps
    const k = new Kit(), r = rng(5);
    for (let i = 0; i < 7; i++) { const x = -21 + i * 7, h = 7 + r() * 5; k.box(6.6, h, 6, [0x8a4a3a, 0x9a6a4a, 0x7a5a4a, 0xa89a80][i % 4], [x, h / 2, -26]); for (let fy = 0; fy < 3; fy++) for (let fx = 0; fx < 3; fx++) if (h > 2.5 + fy * 2.6) k.box(1, 1.4, 0.05, r() < 0.7 ? 0xf8d890 : 0x2a2a30, [x - 2 + fx * 2, 2 + fy * 2.6, -22.97]); }
    for (const x of [-7, 7]) for (const z of [-16, -6, 4]) { k.cyl(0.08, 0.1, 4.2, 6, 0x2a2a2a, [x, 2.1, z]); k.ball(0.25, 1, 0xfff0c0, [x, 4.3, z]); }
    g.add(k.mesh(FLAT));
    this.lampGlow = [[-7, -16], [7, -16], [-7, -6], [7, -6], [-7, 4], [7, 4]].map(([x, z]) => { const s = glowSprite(0xffe0a0, 2.2, 0.7); s.position.set(x, 4.3, z); g.add(s); return s; });
    const banner = picture(9, 1.4, (c, w, h) => { c.fillStyle = '#f4f0e8'; c.fillRect(0, 0, w, h); c.fillStyle = '#b22234'; let fs = h * 0.5; c.font = `bold ${fs | 0}px sans-serif`; while (c.measureText('WELCOME HOME APOLLO 11').width > w * 0.9) { fs -= 2; c.font = `bold ${fs | 0}px sans-serif`; } c.textAlign = 'center'; c.fillText('WELCOME HOME APOLLO 11', w / 2, h * 0.5 + fs * 0.36); }, { frame: 0x3c3b6e, px: 1024 });
    banner.position.set(0, 6.2, -14); g.add(banner);
    // the crowd round him, cheering; von Braun up on two men's shoulders
    this.vb = person(g, 'von_braun', V(0, 0.95, -9), 0.15);
    const crowdW = ['man_suit', 'woman_dress', 'man_casual', 'reporter', 'woman_office', 'eng_white_shirt', 'eng_blue_shirt', 'man_suit', 'woman_summer', 'boy', 'man_casual', 'eng_black', 'woman_older', 'girl'];
    this.crowd = crowdW.map((w, i) => { const a = i / crowdW.length * Math.PI * 2 + 0.3, d = i < 2 ? 0.35 : 1.6 + (i % 3) * 0.9; const P = person(g, w, V(Math.cos(a) * d, 0, -9 + Math.sin(a) * d), 0); P.g.lookAt(0, 0, -9); P.look = V(0, 2.6, -9); return P; });
    this.people.push(this.vb, ...this.crowd);
    this.flashes = Array.from({ length: 5 }, () => { const s = glowSprite(0xffffff, 1.2, 0); g.add(s); return s; });
    this.addScene('huntsville', { group: g, bounds: 3, place: { lat: 34.7, year: 1969, sunLon: 121 }, amb: 0.3, fogFar: 600,
      sky: () => { this.G.sky.set(300, -22); this.lamp.position.set(0, 5, -5); this.lamp.intensity = 2.5; this.lamp.distance = 16; this.lamp2.position.set(-7, 4, -6); this.lamp2.intensity = 1.5; this.lamp2.distance = 12; },
      update: (dt, t) => {
        const s = this.s;
        this.vb.g.position.y = 0.95 + (s.lift ? Math.abs(Math.sin(t * 2.2)) * 0.12 : 0); this.vb.pose = s.lift ? 'cheer' : 'wave';
        this.crowd.forEach((P, i) => { P.pose = i < 2 ? 'carry' : (Math.sin(t * 0.7 + i) > -0.3 ? 'cheer' : 'idle'); });
        this.flashes.forEach((f, i) => { const on = Math.sin(t * 3.1 + i * 2.7) > 0.985; if (on) f.position.copy(this.crowd[(i * 3 + 2) % this.crowd.length].g.position).add(V(0, 1.8, 0)); f.material.opacity = on ? 1 : f.material.opacity * 0.8; });
      } });
  }

  beds() { return [
    { kind: 'vent', at: V(0, 1.6, 0), vol: 0.05, ref: 3, on: (ch) => ch.cur === 'reentry' },
    { kind: 'surf', at: V(0, 0, -20), vol: 0.22, ref: 20, wide: true, on: (ch) => ch.cur === 'sea' || ch.cur === 'hornet' },
  ]; }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    Object.assign(s, { tei: 0, heat: 0, chutes: 0, lift: 0, nixon: 0 }); this.teiK = 0; this.hK = 0; this.dK = 0; this.splashed = false; this.spT = null;
    // 1. Behind the Moon, the burn for home
    await this.go(D, 'tei', 0, 0.1, { x: 0, z: 0 });
    s.guide = [-3, 2.6, -7];
    s.tei = 1; cabinRumble(G, 6, 0.15);
    await D.say('ch29_01');
    s.tei = 0;
    await D.say('ch29_02');
    await D.say('ch29_03');
    // 2. Reentry
    await this.go(D, 'reentry', 0, 0.8, { x: 0, z: 0 });
    s.guide = [0.3, 2.2, -0.9];
    s.heat = 1; whoosh(G, 10, 0.3);
    await D.say('ch29_04');
    await D.until(() => this.hK >= 1 || fast, 10);
    // 3. Parachutes (the music begins here, and plays to the end)
    await this.go(D, 'sea', yawTo(350), 0.8, { x: 0, z: 0 });
    s.guide = [-2, 3, -4];
    s.chutes = 1;
    this.guideTo(V(-3, 30, -16), 2, 5);
    await D.say('ch29_05');
    await D.until(() => this.dK >= 1 || fast, 20);
    s.guide = [2.5, 2.6, -5];
    await D.wait(fast ? 0.5 : 3);
    // 4. On Hornet
    await this.go(D, 'hornet', yawTo(250), 0.8, { x: 6.5, z: -4.5 });
    s.guide = [5.2, 2.4, -5.6];
    await D.say('ch29_06');
    s.nixon = 1;
    await D.say('ch29_07');
    s.nixon = 0;
    // 5. Huntsville
    await this.go(D, 'huntsville', 0, 0.8, { x: 0.5, z: -3.0 });
    s.guide = [-1.6, 2.6, -4.6];
    s.lift = 1;
    await D.say('ch29_08');
    await D.wait(fast ? 0.5 : 6);
  }
}
