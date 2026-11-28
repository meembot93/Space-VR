// Apollo 13 (chapters n 30-34): the shared pieces.
//
//  - The problem board: a chalkboard in a Houston back room. Each problem appears on it as a card;
//    when the fix works the card gets a chalk tick and a short chime. Ticks carry over from part to
//    part (BEFORE), so by splashdown it holds 13. It shows two ways: as a real board on a wall
//    (board.mesh()) and as a small copy that pops up beside your view for a few seconds whenever a
//    card is written or ticked (board.popup(G), then board.card(i) / board.tick(i)).
//  - Mission Control in April 1970 (mcc13), the cold, dark lifeboat (coldCabin), the far side of the
//    Moon from close by (orbitGround), the Command Module alone (cmOnly), parachutes (chute).
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3 } from './base.js';
import { person, sit } from './folk.js';
import { copy } from './craft.js';
import { envMap } from './fx.js';
import { room, surfMat, table, chair, picture } from './sets.js';
import { moonGround } from './worlds.js';
import { glowSprite } from '../wow/fx.js';
import { canvasTex, damp } from '../util.js';
import { rng } from '../shapes.js';
import { LINES } from '../script.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();

// What each card says (short, so kids can read them)
export const PROBLEMS = [
  'An engine stops early', 'What broke?', 'Odyssey running out of power', 'Which way is Aquarius pointing?',
  'Not heading home', 'Can’t see the stars', 'Too slow getting home', 'Not enough water and power',
  'The air is turning bad', 'Drifting off course', 'Waking Odyssey up', 'Odyssey’s battery is low', 'Pushing Aquarius away',
];
// how many problems are already on the board (all ticked) when each part starts
export const BEFORE = { 30: 0, 31: 1, 32: 4, 33: 8, 34: 9 };

// Wait until the narration reaches the nth time `word` appears in line `id` (1 = first, -1 = last)
export function cueNth(D, id, word, nth = 1) {
  const txt = LINES[id] || ''; let i = -1;
  if (nth < 0) i = txt.lastIndexOf(word); else for (let k = 0; k < nth; k++) i = txt.indexOf(word, i + 1);
  return D.cue(i < 0 ? 0.95 : i / Math.max(1, txt.length));
}

export class ProblemBoard {
  constructor(G, n) {
    this.G = G;
    this.shown = BEFORE[n] ?? 0;            // cards written up
    this.ticks = Array.from({ length: 13 }, (_, i) => (i < this.shown ? 1 : 0));   // 0..1 how much of each tick is drawn
    this.write = Array.from({ length: 13 }, (_, i) => (i < this.shown ? 1 : 0));   // 0..1 card fading in
    this.newest = -1;
    this.W = 1024; this.H = 640;
    this.tex = canvasTex(this.W, this.H, (c) => this.draw(c));
    this.dirty = true; this.popT = 0; this.popK = 0;
  }
  // a framed chalkboard w metres wide, for a wall
  mesh(w = 3.0) {
    const h = w * this.H / this.W, g = new THREE.Group(), k = new Kit();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.95, emissive: 0xffffff, emissiveMap: this.tex, emissiveIntensity: 0.12 }));
    g.add(face);
    k.box(w + 0.12, 0.06, 0.05, 0x7a5a3a, [0, h / 2 + 0.03, -0.02]); k.box(w + 0.12, 0.06, 0.05, 0x7a5a3a, [0, -h / 2 - 0.03, -0.02]);
    k.box(0.06, h + 0.12, 0.05, 0x7a5a3a, [-w / 2 - 0.03, 0, -0.02]); k.box(0.06, h + 0.12, 0.05, 0x7a5a3a, [w / 2 + 0.03, 0, -0.02]);
    k.box(w * 0.9, 0.025, 0.07, 0x6a4a2a, [0, -h / 2 - 0.06, 0.03]);                          // the chalk ledge
    for (let i = 0; i < 4; i++) k.cyl(0.006, 0.006, 0.07, 5, 0xf4f0e8, [-w * 0.3 + i * 0.09, -h / 2 - 0.04, 0.04], [0, 0, Math.PI / 2]);
    k.box(0.12, 0.04, 0.05, 0x8a6a4a, [w * 0.3, -h / 2 - 0.03, 0.04]);                        // the eraser
    g.add(k.mesh(FLAT));
    return g;
  }
  // the small copy beside your view; it follows your gaze while it's showing
  popup(G) {
    const g = this.pop = new THREE.Group(), w = 0.62, h = w * this.H / this.W;
    this.popMat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.popMat); face.renderOrder = 20; g.add(face);
    this.popFrame = new THREE.MeshBasicMaterial({ color: 0x6a4a2a, transparent: true, opacity: 0, depthWrite: false });
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.03, h + 0.03), this.popFrame); fr.position.z = -0.002; fr.renderOrder = 19; g.add(fr);
    g.visible = false; G.scene.add(g);
    return g;
  }
  // write card i (0-based) on the board, and show it
  card(i, secs = 4.5) { this.shown = Math.max(this.shown, i + 1); this.newest = i; this.write[i] = Math.min(this.write[i], 0.01); this.show(secs); this.G.audio.click?.(null, 0.1); }
  // tick card i: the chalk mark draws itself, with a chime
  tick(i, secs = 4) {
    if (this.shown <= i) { this.shown = i + 1; this.write[i] = 1; }
    this.newest = i; this.ticks[i] = Math.min(this.ticks[i], 0.01); this.show(secs);
    setTimeout(() => this.G.audio.chime?.(null, 0.45), 350);
  }
  show(secs) { this.popT = Math.max(this.popT, secs); this.snap = !this.pop?.visible; this.dirty = true; }
  update(dt) {
    let busy = false;
    for (let i = 0; i < 13; i++) {
      if (i < this.shown && this.write[i] < 1) { this.write[i] = Math.min(1, this.write[i] + dt * 1.6); busy = true; }
      if (this.ticks[i] > 0 && this.ticks[i] < 1) { this.ticks[i] = Math.min(1, this.ticks[i] + dt * 1.4); busy = true; }
    }
    if (busy || this.dirty) { this.draw(this.tex.image.getContext('2d')); this.tex.needsUpdate = true; this.dirty = false; }
    if (!this.pop) return;
    this.popT = Math.max(0, this.popT - dt);
    this.popK = damp(this.popK, this.popT > 0 ? 1 : 0, 5, dt);
    this.pop.visible = this.popK > 0.01;
    this.popMat.opacity = this.popK; this.popFrame.opacity = this.popK;
    if (!this.pop.visible) return;
    // beside your view, a little right and below eye level, 1.25 m away, turning with your head
    const cam = this.G.camera; cam.getWorldPosition(_a); cam.getWorldDirection(_b); _b.y = 0; _b.normalize();
    const tgt = _a.clone().addScaledVector(_b, 1.25).add(V(-_b.z * 0.42, -0.16, _b.x * 0.42));
    if (this.snap) { this.pop.position.copy(tgt); this.snap = false; } else this.pop.position.lerp(tgt, 1 - Math.exp(-4 * dt));
    this.pop.lookAt(_a);
  }
  dispose() { if (this.pop) this.G.scene.remove(this.pop); }

  draw(c) {
    const W = this.W, H = this.H;
    // slate: dark green-black with old smudges of chalk
    c.fillStyle = '#1e2a24'; c.fillRect(0, 0, W, H);
    const r = rng(13);
    for (let i = 0; i < 26; i++) { c.fillStyle = `rgba(220,230,220,${0.02 + r() * 0.03})`; c.beginPath(); c.ellipse(r() * W, r() * H, 40 + r() * 120, 10 + r() * 30, r() * 3, 0, 7); c.fill(); }
    c.fillStyle = '#eef2ea'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center'; c.fillText('APOLLO 13: PROBLEMS', W / 2, 58);
    c.fillRect(W / 2 - 230, 70, 460, 3);
    // two columns of cards: 1-7 on the left, 8-13 on the right
    const cw = 470, ch = 66, gap = 10;
    for (let i = 0; i < this.shown; i++) {
      const col = i < 7 ? 0 : 1, row = i < 7 ? i : i - 7;
      const x = 28 + col * (cw + 30), y = 96 + row * (ch + gap), a = this.write[i];
      c.save(); c.globalAlpha = a; c.translate(x + cw / 2, y + ch / 2); c.rotate(((i * 37) % 7 - 3) * 0.004); c.translate(-cw / 2, -ch / 2);
      c.fillStyle = i === this.newest ? '#fff6c8' : '#f4f0e4'; c.fillRect(0, 0, cw - 80, ch);
      c.fillStyle = '#c8302a'; c.fillRect(0, 14, cw - 80, 2);                                 // the index card's red line
      c.fillStyle = '#9a9a9a'; c.beginPath(); c.arc((cw - 80) / 2, 6, 5, 0, 7); c.fill();       // a pin
      c.fillStyle = '#1a2a6a'; c.textAlign = 'left'; c.font = 'bold 26px sans-serif'; c.fillText(String(i + 1), 12, 48);
      c.font = '24px sans-serif'; c.fillStyle = '#1a1a1a';
      let txt = PROBLEMS[i]; while (c.measureText(txt).width > cw - 140 && txt.length > 4) txt = txt.slice(0, -2) + '…';
      c.fillText(txt, 50, 47);
      c.restore();
      // the chalk tick, drawn stroke by stroke
      const k = this.ticks[i];
      if (k > 0) {
        const tx = x + cw - 60, ty = y + ch / 2;
        c.save(); c.strokeStyle = '#f4f8f0'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = 'rgba(255,255,255,0.5)'; c.shadowBlur = 6;
        const p1 = Math.min(1, k / 0.35), p2 = clamp01((k - 0.35) / 0.65);
        c.beginPath(); c.moveTo(tx - 18, ty - 2); c.lineTo(tx - 18 + 16 * p1, ty - 2 + 20 * p1);
        if (p2 > 0) c.lineTo(tx - 2 + 34 * p2, ty + 18 - 46 * p2);
        c.stroke(); c.restore();
      }
    }
    // the count, in chalk, bottom right
    const done = this.ticks.filter((t) => t >= 1).length;
    if (done) { c.fillStyle = '#eef2ea'; c.font = 'bold 34px sans-serif'; c.textAlign = 'right'; c.fillText(`${done} fixed`, W - 30, H - 26); }
  }
}

// ---------- Mission Control, April 1970 ----------
// The room from Apollo 11 (Meem's model), Gene Kranz's White Team: Kranz standing at his console,
// Sy Liebergot at the power console (EECOM), the capcom, flight controllers in white shirts.
// screen(c, w, h, t) draws the big front screen. Returns { g, kranz, lieb, capcom, ctl, scr }.
export function mcc13(ch, M, name, { screen = null, place = { lat: 29.6, year: 1970, sunLon: 25 } } = {}) {
  const g = new THREE.Group();
  g.add(copy(M.mission_control, envMap('room'), 0.6));
  const seats = [[-4.5, 3.8, 'eng_white_shirt'], [1.5, 3.8, 'eng_blue_shirt'], [4.5, 3.8, 'eng_black'], [3.0, 1.8, 'eng_white_shirt'], [-1.5, 1.8, 'eng_blue_shirt']];
  const ctl = seats.map(([x, z, who]) => { const P = person(g, who, V(x, 0, z), Math.PI); sit(P); P.look = V(x * 0.3, 3, -9); return P; });
  const lieb = person(g, 'sy_liebergot', V(-3.0, 0, 1.8), Math.PI); sit(lieb); lieb.look = V(-1, 3, -9);
  const capcom = person(g, 'joe_kerwin', V(0, 0, 1.8), Math.PI); sit(capcom); capcom.look = V(0, 3, -9);
  const kranz = person(g, 'kranz', V(1.4, 0, 5.6), Math.PI + 0.3); kranz.look = V(0, 3, -9);
  ch.people.push(...ctl, lieb, capcom, kranz);
  let scr = null, tex = null;
  if (screen) {
    tex = canvasTex(1024, 556, (c, w, h) => screen(c, w, h, 0));
    scr = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.8), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.set(0, 3.4, -9.8); g.add(scr);   // over the model's middle screen
  }
  let acc = 0;
  ch.addScene(name, { group: g, bounds: 1.2, indoors: true, place, amb: 0.05, fogFar: 300,
    sky: () => { ch.G.sky.set(250, 30); ch.G.sky.hemi.intensity = 0.9; ch.lamp.position.set(0, 5, 4); ch.lamp.intensity = 3.2; ch.lamp.distance = 22; ch.lamp2.position.set(0, 3.5, -8); ch.lamp2.color.setHex(0x9ac8ff); ch.lamp2.intensity = 1.2; ch.lamp2.distance = 12; },
    exit: () => { ch.lamp2.color.setHex(0xfff0dc); },
    update: (dt, t) => { if (screen && (acc += dt) > 0.2) { acc = 0; screen(tex.image.getContext('2d'), 1024, 556, t); tex.needsUpdate = true; } } });
  return { g, kranz, lieb, capcom, ctl, scr };
}
// the player's spot in it: near the back, looking at the screens
export const MCC_SPOT = { x: 6, z: 6, bearing: 320 };

// A green-on-black flight-controller screen with columns of numbers (some jumping about when `wild`)
export function drawData(c, w, h, t, { title = 'EECOM', wild = 0, rows = null, seed = 3 } = {}) {
  c.fillStyle = '#060a08'; c.fillRect(0, 0, w, h);
  const L = rows || ['O2 TK1 QTY', 'O2 TK2 QTY', 'O2 TK1 PRESS', 'O2 TK2 PRESS', 'FC1 FLOW', 'FC2 FLOW', 'FC3 FLOW', 'MAIN BUS A', 'MAIN BUS B'];
  const top = h * 0.16, step = (h * 0.8) / L.length, fs = Math.min(step * 0.72, w * 0.05) | 0;
  c.fillStyle = '#7aff9a'; c.font = `bold ${fs * 1.1 | 0}px monospace`; c.textAlign = 'left'; c.fillText(title, w * 0.04, h * 0.1);
  const r = rng(seed + Math.floor(t * (wild ? 6 : 0.5)));
  c.font = `${fs}px monospace`;
  L.forEach((name, i) => {
    const y = top + (i + 0.8) * step, v = typeof name === 'object' ? name : null;
    c.fillStyle = '#7aff9a'; c.fillText(v ? v.n : name, w * 0.04, y);
    const val = v ? v.v(t, r) : (wild && r() < wild ? (r() * 999).toFixed(1) : (300 + seed * 11 + i * 37).toFixed(1));
    c.fillStyle = v?.bad && wild ? '#ff5a4a' : '#d8ffe0'; c.fillText(String(val), w * 0.58, y);
  });
}

// ---------- The cold lifeboat: frost on the glass, water drops floating, breath clouds ----------
// C: a cabin(); heads: () => [Vector3 world positions of mouths]. Returns update(dt, t, cold 0..1).
export function coldCabin(C, parent, heads) {
  const frost = canvasTex(256, 256, (c, w, h) => { const r = rng(17); c.clearRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const x = r() * w, y = r() * h, d = Math.hypot(x - w / 2, y - h / 2) / (w / 2); if (r() > (d - 0.45) * 2) continue; c.fillStyle = `rgba(230,240,255,${0.1 + r() * 0.25})`; c.beginPath(); c.arc(x, y, 0.6 + r() * 2.2, 0, 7); c.fill(); }
    for (let i = 0; i < 40; i++) { c.strokeStyle = 'rgba(240,248,255,0.35)'; c.lineWidth = 1; const x = r() * w, y = r() * h; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 4; j++) c.lineTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 40); c.stroke(); } });
  const fm = new THREE.SpriteMaterial({ map: frost, transparent: true, opacity: 0, depthWrite: false });
  const frosts = C.windows.map((w) => { const s = new THREE.Sprite(fm); s.position.copy(w.local).multiplyScalar(0.96).add(V(0, 1.6, 0)); s.scale.setScalar(0.36); C.group.add(s); return s; });
  // drops: tiny shining spheres drifting about the cabin
  const dm = new THREE.MeshStandardMaterial({ color: 0xcfe4ff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.75 });
  const N = 34, drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.006, 8, 6), dm, N); C.group.add(drops);
  const r = rng(23), dd = Array.from({ length: N }, () => ({ p: V((r() - 0.5) * 1.6, 0.9 + r() * 1.1, -0.7 + r() * 1.2), v: V((r() - 0.5) * 0.01, (r() - 0.5) * 0.01, (r() - 0.5) * 0.01), s: 0.6 + r() * 1.4 }));
  const m4 = new THREE.Matrix4();
  // breath: soft white puffs at each mouth, now and then
  const bm = new THREE.SpriteMaterial({ map: glowSprite().material.map, color: 0xe8f0ff, transparent: true, opacity: 0, depthWrite: false });
  const puffs = Array.from({ length: 6 }, () => { const s = new THREE.Sprite(bm.clone()); parent.add(s); return { s, t: 9, life: 2.2 }; });
  let next = 0, who = 0;
  return (dt, t, cold) => {
    fm.opacity = cold * 0.45;
    drops.visible = cold > 0.05;
    dd.forEach((d, i) => { d.p.addScaledVector(d.v, dt); for (const ax of ['x', 'y', 'z']) { const lim = ax === 'y' ? [0.8, 2.1] : ax === 'x' ? [-0.9, 0.9] : [-0.75, 0.6]; if (d.p[ax] < lim[0] || d.p[ax] > lim[1]) d.v[ax] *= -1; }
      m4.makeScale(d.s * cold, d.s * cold, d.s * cold).setPosition(d.p); drops.setMatrixAt(i, m4); });
    drops.instanceMatrix.needsUpdate = true;
    if (cold > 0.3 && (next -= dt) <= 0) {
      const hs = heads(); if (hs.length) { const h = hs[who++ % hs.length]; const p = puffs.find((q) => q.t >= q.life) || puffs[0]; parent.worldToLocal(p.s.position.copy(h)); p.t = 0; p.v = V((r() - 0.5) * 0.05, 0.03, 0.06); }
      next = 0.9 + r() * 0.9;
    }
    for (const p of puffs) { if (p.t >= p.life) { p.s.material.opacity = 0; continue; } p.t += dt; const k = p.t / p.life; p.s.position.addScaledVector(p.v, dt); p.s.scale.setScalar(0.06 + k * 0.28); p.s.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.4)) * 0.35 * cold; }
  };
}

// ---------- The Moon's surface from close by, curving away (the far side) ----------
export function orbitGround(seed, R = 3000, H = 190) {
  const r = rng(seed), craters = [];
  for (let i = 0; i < 90; i++) { const rad = 15 + Math.pow(r(), 2.2) * 190; craters.push([(r() - 0.5) * 2900, (r() - 0.5) * 2900, rad, rad * (0.16 + r() * 0.08)]); }
  const MG = moonGround({ size: 3000, seg: 230, seed, craters, rocks: 0 });
  const p = MG.ground.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) * 1.6 - (x * x + z * z) / (2 * R)); }
  MG.ground.geometry.computeVertexNormals(); MG.ground.frustumCulled = false;
  const pivot = new THREE.Group(); pivot.position.y = 1.6 - H - R; MG.group.position.y = R; pivot.add(MG.group); pivot.rotation.x = -500 / R;
  pivot.userData.slide = (dt, speed = 14) => { pivot.rotation.x = Math.min(pivot.rotation.x + dt * speed / R, 500 / R); };
  return pivot;
}
// Keep only the Command Module of the CSM model (cut away the Service Module below it). Needs
// G.renderer.localClippingEnabled; call the returned function each frame after moving it.
export function cmOnly(o) {
  const plane = new THREE.Plane(V(0, 1, 0), 0);
  o.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); c.material.clippingPlanes = [plane]; } });
  return () => { o.updateWorldMatrix(true, false); const up = V(0, 1, 0).transformDirection(o.matrixWorld), p = o.getWorldPosition(_a); plane.setFromNormalAndCoplanarPoint(up, p.addScaledVector(up, -0.02)); };
}
// ...or only the Service Module (for the moment it's let go)
export function smOnly(o) {
  const plane = new THREE.Plane(V(0, -1, 0), 0);
  o.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); c.material.clippingPlanes = [plane]; } });
  return () => { o.updateWorldMatrix(true, false); const dn = V(0, -1, 0).transformDirection(o.matrixWorld), p = o.getWorldPosition(_a); plane.setFromNormalAndCoplanarPoint(dn, p.addScaledVector(dn, -0.02)); };
}
// a parachute: a shallow dome of red and white panels, with its lines down to a point
export function chute(R = 4) {
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

// The docked ships, Odyssey (CSM) behind and Aquarius (LM) in front, nose to nose: a group whose
// +y runs from the CSM's engine to the LM's descent stage. Returns { group, csm, csmModel, lm, smHole }.
// LM_DECK: the ascent stage sits this high on the descent stage (as in parts 3-8 of Apollo 11).
export function docked(M, env, { damaged = true } = {}) {
  const g = new THREE.Group();
  const csm = new THREE.Group(); const o = copy(M.apollo_csm, env, 1.1); csm.add(o); g.add(csm);
  const ex = new THREE.Box3().setFromObject(o); const nose = ex.max.y;
  // the LM hangs upside down off the CM's nose: its top hatch on the probe
  const lm = new THREE.Group(); lm.add(copy(M.lm_descent, env, 1.0)); const as = copy(M.lm_ascent, env, 1.0); as.position.y = 2.62; lm.add(as);
  const lmTop = 2.62 + (M.lm_ascent?.size.y || 4.2);
  lm.rotation.z = Math.PI; lm.position.y = nose + 0.15 + lmTop; g.add(lm);
  // the blown-out bay on the Service Module: a dark gash with torn foil and a hanging panel
  let smHole = null;
  if (damaged) {
    const k = new Kit(), R = 1.98;
    k.box(1.5, 4.2, 0.25, 0x1a1612, [0, -3.7, R - 0.05]); for (let i = 0; i < 7; i++) k.cyl(0.015, 0.015, 0.8 + (i % 3) * 0.3, 4, [0xc8a050, 0x8a3a2a, 0xd8d8d8][i % 3], [-0.5 + i * 0.16, -2.2 - (i % 4) * 0.9, R + 0.1], [0.5 * (i % 2 ? 1 : -1), 0, 0.4]);
    k.box(0.5, 0.8, 0.3, 0x5a4a3a, [-0.3, -2.8, R - 0.1]); k.cyl(0.18, 0.18, 0.9, 10, 0x8a7a5a, [0.3, -4.1, R - 0.25]);
    smHole = k.mesh(FLAT); csm.add(smHole);
    const foil = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.6, 4, 4), new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }));
    { const p = foil.geometry.attributes.position, rr = rng(5); for (let i = 0; i < p.count; i++) p.setZ(i, (rr() - 0.5) * 0.25); foil.geometry.computeVertexNormals(); }
    foil.position.set(0.8, -5.6, R + 0.45); foil.rotation.set(0.6, 0.5, 0.3); csm.add(foil); smHole.userData.foil = foil;
  }
  return { group: g, csm, csmModel: o, lm, lmTop, nose, smBottom: ex.min.y, smHole };
}

// ---------- A back room in Houston: a long table under strip lights, the problem board on the wall ----------
// Returns { g, k (a Kit for extra furniture, already added), table: top height }. The board's face
// is on the north wall (z = -2.95), its middle 1.75 m up; you stand at (0, 1.6) looking north.
export function backRoom(ch, name, board, { amb = 0.03 } = {}) {
  const R = room(8, 6, 3.2, { floor: surfMat('lino', '#7a7466'), wall: surfMat('plaster', '#d8d2c0'), ceil: surfMat('acoustic'), frame: 0x5a5a52 });
  const g = R.group, k = new Kit();
  const b = board.mesh(3.0); b.position.set(0, 1.75, -2.93); g.add(b);
  // the long table, chairs, coffee, ashtrays, rolled drawings; a filing cabinet and a clock
  table(k, 0, -0.2, 0, { w: 3.2, d: 1.1, col: 0x6a5a4a });
  for (const x of [-1.2, 0, 1.2]) { chair(k, x, -1.05, 0, { col: 0x3a3a3a, seat: 0x4a4a4a }); chair(k, x, 0.65, Math.PI, { col: 0x3a3a3a, seat: 0x4a4a4a }); }
  for (const [x, z] of [[-1.3, -0.4], [-0.3, 0.1], [1.1, -0.5], [0.6, 0.2]]) { k.cyl(0.04, 0.035, 0.09, 10, 0xf4f0e8, [x, 0.8, z]); k.cyl(0.033, 0.033, 0.005, 10, 0x3a2414, [x, 0.84, z]); }
  k.cyl(0.07, 0.06, 0.03, 12, 0x8a8a8a, [1.4, 0.77, 0.1]);
  k.box(0.5, 1.3, 0.6, 0x7a8078, [3.6, 0.65, -2.4]); for (let i = 0; i < 4; i++) k.box(0.42, 0.02, 0.01, 0x3a3a3a, [3.6, 0.3 + i * 0.3, -2.09]);
  k.cyl(0.18, 0.18, 0.04, 20, 0xf4f0e8, [-2.4, 2.65, -2.95], [Math.PI / 2, 0, 0]); k.cyl(0.19, 0.19, 0.03, 20, 0x2a2a2a, [-2.4, 2.65, -2.96], [Math.PI / 2, 0, 0]);
  // strip lights in the ceiling
  for (const z of [-1.6, 0, 1.6]) k.box(2.4, 0.04, 0.3, 0xf8f8f0, [0, 3.17, z]);
  g.add(k.mesh(FLAT));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.26), new THREE.MeshBasicMaterial({ color: 0xfffff0 }));
  for (const z of [-1.6, 0, 1.6]) { const m = glow.clone(); m.rotation.x = Math.PI / 2; m.position.set(0, 3.145, z); g.add(m); }
  ch.addScene(name, { group: g, bounds: 2.2, indoors: true, place: { lat: 29.6, year: 1970, sunLon: 25 }, amb, fogFar: 200,
    sky: () => { ch.G.sky.set(250, 30); ch.G.sky.hemi.intensity = 0.8; ch.lamp.position.set(0, 2.9, -0.5); ch.lamp.intensity = 3.0; ch.lamp.distance = 10; ch.lamp.color.setHex(0xf8f8ec); ch.lamp2.position.set(0, 2.6, -2.2); ch.lamp2.intensity = 1.2; ch.lamp2.distance = 5; } });
  return { g, table: 0.75 };
}

// ---------- The Apollo simulator hall in Houston ----------
// A tall boxy simulator on a platform (the crew climb steps into a copy of the cabin inside it; the
// boxes on top hold the pictures that play in its windows), and the instructors' consoles facing it.
// You stand at (0, 3.5) looking north at it. Returns { g, hatch: world point of the hatch }.
export function simHall(ch, name, { year = 1970 } = {}) {
  const R = room(22, 16, 8, { floor: surfMat('lino', '#8a867a'), wall: surfMat('panelwood', '#c8c2b0'), ceil: surfMat('acoustic'), frame: 0x5a5a52 });
  const g = R.group, k = new Kit(), WH = 0xdcd8cc, GR = 0x8a8e8c;
  // the platform and the simulator body
  k.box(7, 1.2, 6, GR, [0, 0.6, -3.5]);
  k.box(4.2, 3.4, 4.2, WH, [0, 2.9, -3.8]); k.box(4.3, 0.12, 4.3, 0x6a6e70, [0, 1.25, -3.8]); k.box(4.3, 0.12, 4.3, 0x6a6e70, [0, 4.6, -3.8]);
  for (const [x, z, ry] of [[-1.1, -2.5, 0.2], [1.1, -2.5, -0.2], [0, -4.6, 0], [-1.6, -4.2, 0.9], [1.6, -4.2, -0.9]]) { k.box(1.0, 0.8, 1.2, WH, [x, 5.1, z], [0, ry, 0]); k.cyl(0.32, 0.45, 0.7, 12, 0x3a3a3c, [x, 5.65, z]); }
  // panels and seams on the body, service doors, a red warning light on top
  for (let i = -1; i <= 1; i++) k.box(0.03, 3.2, 0.02, 0xa8a49a, [i * 1.3, 2.9, -1.69]);
  k.box(1.0, 1.9, 0.04, 0xc8c4b8, [1.3, 2.25, -1.68]); k.cyl(0.08, 0.08, 0.12, 10, 0xc82020, [1.8, 5.55, -2.4]);
  // the hatch, open, with light inside; the white room walkway and the steps up to it
  k.box(0.9, 0.9, 0.06, 0x2a2a2a, [-0.9, 2.5, -1.67]); k.box(1.6, 0.1, 1.6, GR, [-0.9, 1.85, -0.95]);
  for (let i = 0; i < 6; i++) k.box(0.9, 0.06, 0.3, GR, [-0.9, 0.3 + i * 0.3, 0.4 - i * 0.26 + 0.9]);
  for (const sx of [-1, 1]) { k.cyl(0.02, 0.02, 1.0, 6, 0xe8c830, [-0.9 + sx * 0.75, 2.4, -0.95]); k.cyl(0.02, 0.02, 2.6, 6, 0xe8c830, [-0.9 + sx * 0.48, 1.5, 1.0], [-0.85, 0, 0]); }
  // thick cable runs to the computers along the east wall
  k.box(0.3, 0.2, 9, 0x2a2a2a, [3.8, 0.1, 0]);
  for (let i = 0; i < 5; i++) { k.box(1.6, 2.2, 0.8, 0x7a8288, [10.2, 1.1, -6 + i * 2.2]); k.box(1.2, 0.5, 0.02, 0x1a1a1a, [9.39, 1.6, -6 + i * 2.2], [0, Math.PI / 2, 0]); }
  // the instructors' consoles, facing the simulator
  for (let i = 0; i < 4; i++) { const z = -4.2 + i * 2.4; k.box(0.9, 0.8, 2.0, 0x5a6066, [6.6, 0.4, z]); k.box(0.12, 0.6, 2.0, 0x4a5056, [7.0, 1.05, z], [0, 0, -0.4]); k.box(0.5, 0.06, 0.5, 0x3a3a3a, [5.7, 0.46, z]); k.cyl(0.04, 0.04, 0.42, 6, 0x2a2a2a, [5.7, 0.22, z]); }
  g.add(k.mesh(FLAT));
  const glowM = new THREE.MeshBasicMaterial({ color: 0xfff0d0 });
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), glowM); inside.position.set(-0.9, 2.5, -1.63); g.add(inside);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const s = picture(0.5, 0.36, (c, w, h) => drawData(c, w, h, 0, { title: ['SIM', 'CMP', 'EECOM', 'GNC'][i], seed: i * 3 + j }), { frame: 0x2a2a2a, px: 256, basic: true });
    s.position.set(6.93, 1.13, -4.82 + i * 2.4 + j * 0.62); s.rotation.y = -Math.PI / 2; s.rotation.x = 0; s.rotateX(-0.4); g.add(s); }
  const sign = picture(4.4, 0.5, (c, w, h) => { c.fillStyle = '#1a2a5a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f0e8'; c.font = `bold ${h * 0.5 | 0}px sans-serif`; c.textAlign = 'center'; c.fillText('COMMAND MODULE SIMULATOR', w / 2, h * 0.68); }, { frame: 0x1a1a1a, px: 1024 });
  sign.position.set(0, 6.6, -7.9); g.add(sign);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.3), glowM); m.rotation.x = Math.PI / 2; m.position.set(-6 + i * 6, 7.95, -4 + j * 6); g.add(m); }
  ch.addScene(name, { group: g, bounds: 3, indoors: true, place: { lat: 29.6, year, sunLon: 15 }, amb: 0.04, fogFar: 300,
    sky: () => { ch.G.sky.set(250, 30); ch.G.sky.hemi.intensity = 0.9; ch.lamp.position.set(0, 7, -1); ch.lamp.intensity = 6; ch.lamp.distance = 26; ch.lamp.color.setHex(0xf8f6ec); ch.lamp2.position.set(-0.9, 2.5, -1.2); ch.lamp2.intensity = 1.0; ch.lamp2.distance = 4; } });
  return { g, hatch: V(-0.9, 1.9, -1.2), steps: V(-0.9, 0, 1.6) };
}

// The base for the five Apollo 13 parts: the problem board (and its pop-up) comes with every one
export class Apollo13 extends Chapter3 {
  constructor(G, n) {
    super(G, n);
    G.renderer.localClippingEnabled = true;
    this.board = new ProblemBoard(G, n); this.board.popup(G);
  }
  update(dt, t) { super.update(dt, t); this.board.update(dt); }
  dispose() { this.board.dispose(); super.dispose(); }
}

// Cut the docked ships' CSM in two for the moment the Service Module is let go: the original model
// keeps only the Command Module (with Aquarius still on its nose), and a second copy, only the Service
// Module with the blown-out bay, sits where it was. Returns { sm (group in D.group's space), clipCM(),
// clipSM() } - call both clips every frame after moving things.
export function splitSM(D, M, env) {
  const clipCM = cmOnly(D.csmModel);
  const sm = new THREE.Group(); const o = copy(M.apollo_csm, env, 1.1); sm.add(o); D.group.add(sm);
  const clipSM = smOnly(o);
  if (D.smHole) { D.csm.remove(D.smHole); sm.add(D.smHole); const f = D.smHole.userData.foil; if (f) { D.csm.remove(f); sm.add(f); } }
  return { sm, clipCM, clipSM };
}
