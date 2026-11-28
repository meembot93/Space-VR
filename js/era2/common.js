// Shared building blocks for the Era 2 chapters (1543 to 1957): where the Sun is at a given hour,
// European town houses with steep tiled roofs and glowing windows, stepped brick gables, the sky
// journal page every chapter ends with, glowing labels, and Astra's "fly over there" bookkeeping.
// Everything here merges into a few meshes, like the rest of the game (see js/kit.js).
import * as THREE from 'three';
import { Kit } from '../kit.js';
import { canvasTex, damp } from '../util.js';
import { rng } from '../shapes.js';
import { loadGLB } from '../models.js';

// ---------- Town houses built in Blender (tools/blender/houses.py) ----------
// Plastered walls with a stone footing and corner stones, tiled roofs in real courses with eaves and a
// ridge cap, baked soft shadows: house() uses them (stretched to each house, tinted to its colours)
// and falls back to plain shapes without them (?noset). They ride in the Kit (kit.mesh()).
const HOUSE = new Map(), EAVE = 0.238, PLASTER = 0xd8d2c6, TILE = 0xbab2a6;
if (!new URLSearchParams(location.search).has('noset')) {
  const gl = await loadGLB('sets/houses.glb').catch(() => null);
  if (gl) { gl.scene.updateMatrixWorld(true); gl.scene.traverse((o) => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); HOUSE.set(o.name, { g, map: o.material.map }); } }); }
}
const _hm = new THREE.Matrix4(), _hq = new THREE.Quaternion(), _hy = new THREE.Vector3(0, 1, 0);
const tintFor = (col, own) => { const a = new THREE.Color(col), b = new THREE.Color(own); return new THREE.Color(Math.min(2, a.r / b.r), Math.min(2, a.g / b.g), Math.min(2, a.b / b.b)).getHex(); };
function housePiece(k, name, p, yaw, sx, sy, sz, tint) {
  const P = HOUSE.get(name); const g = P.g.clone();
  g.applyMatrix4(_hm.compose(new THREE.Vector3(...p), _hq.setFromAxisAngle(_hy, yaw), new THREE.Vector3(sx, sy, sz)));
  const c = new THREE.Color(tint), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  k.addTextured(P.map, g);
}

export const D2R = Math.PI / 180;
export const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

// Compass bearing (degrees clockwise from north) to a point `r` metres away at height y
export const at = (az, r, y = 0, out = new THREE.Vector3()) => out.set(Math.sin(az * D2R) * r, y, -Math.cos(az * D2R) * r);

// The Sun at a local solar time (hours, 12 = noon) on a day of the year given by the Sun's place
// along its yearly path (sunLon: 0 spring equinox, 90 midsummer, 180 autumn, 270 midwinter)
// at latitude lat. Returns { az, el } in degrees, ready for G.sky.set(az, el).
export function sunAt(lat, sunLon, hour) {
  const eps = 23.44 * D2R, dec = Math.asin(Math.sin(eps) * Math.sin(sunLon * D2R));
  const H = (hour - 12) * 15 * D2R, phi = lat * D2R;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(H));
  return { az: (az / D2R + 360) % 360, el: el / D2R };
}

// ---------- Roofs and walls ----------
// A gabled roof: two slopes meeting at a ridge along x, w long, d deep, h high, with an overhang.
// Built as a plain geometry, so Kit can colour and merge it.
export function gableRoof(w, d, h, over = 0.25) {
  const W = w / 2 + over, D = d / 2 + over, hh = h + over * h / (d / 2);
  const v = [
    // left slope (toward -z) and right slope (+z)
    -W, -over * h / (d / 2), -D, W, -over * h / (d / 2), -D, W, hh - over * h / (d / 2), 0,
    -W, -over * h / (d / 2), -D, W, hh - over * h / (d / 2), 0, -W, hh - over * h / (d / 2), 0,
    W, -over * h / (d / 2), D, -W, -over * h / (d / 2), D, -W, hh - over * h / (d / 2), 0,
    W, -over * h / (d / 2), D, -W, hh - over * h / (d / 2), 0, W, hh - over * h / (d / 2), 0,
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  // both sides drawn: duplicate with reversed winding so the underside of the overhang shows
  const back = g.clone(); const p = back.attributes.position;
  for (let i = 0; i < p.count; i += 3) { const x = p.getX(i + 1), y = p.getY(i + 1), z = p.getZ(i + 1); p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)); p.setXYZ(i + 2, x, y, z); }
  back.computeVertexNormals();
  return joinGeo([g, back]);
}
function joinGeo(list) {
  const n = list.reduce((s, g) => s + g.attributes.position.count, 0), pos = new Float32Array(n * 3);
  let o = 0; for (const g of list) { pos.set(g.attributes.position.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.computeVertexNormals();
  return out;
}
// A triangular gable wall (the end of a house under its roof): w wide, h high, t thick, in the x-y plane
export function gableWall(w, h, t = 0.3) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false }); g.translate(0, 0, -t / 2);
  return g;
}
// A stepped brick gable (Baltic brick Gothic): stacked blocks narrowing to the top, with little
// pinnacles on each step. In the x-y plane, w wide at the bottom, h high.
export function steppedGable(k, w, h, steps, color, p, yaw = 0, t = 0.5, pin = 0x9a3a26) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const put = (x, y, z) => [p[0] + x * c + z * s, p[1] + y, p[2] - x * s + z * c];
  for (let i = 0; i < steps; i++) {
    const f0 = i / steps, ww = w * (1 - f0) + 0.6, sh = h / steps;
    k.box(ww, sh, t, color, put(0, f0 * h + sh / 2, 0), [0, yaw, 0]);
    // a little pointed pinnacle at both ends of every step
    for (const sx of [-1, 1]) {
      k.box(0.32, sh * 0.55, 0.32, pin, put(sx * (ww / 2 - 0.16), f0 * h + sh + sh * 0.27, 0), [0, yaw, 0]);
      k.cyl(0.001, 0.2, 0.5, 4, pin, put(sx * (ww / 2 - 0.16), f0 * h + sh * 1.55 + 0.25, 0), [0, yaw + Math.PI / 4, 0]);
    }
    // a blind (bricked-up) pointed window in each step, darker
    if (i < steps - 1) k.box(Math.min(0.5, ww * 0.12), sh * 0.6, 0.06, 0x5a2416, put(0, f0 * h + sh * 0.5, t / 2 + 0.01), [0, yaw, 0]);
  }
}

// A town house: walls, a steep roof, a chimney, door, windows. Returns where its windows are (world,
// facing out), so the town's lit windows can be made in one mesh.
// o: { x, y, z, w (along the street), d, h (to the eaves), roof (height), yaw, wall, roofCol, timber,
//      gableFront (true: the gable faces the street, the Baltic and Dutch way), stepped }
export function house(k, o, win = []) {
  const { x, y, z, w, d, h, yaw = 0, wall = 0xd8c8a8, roofCol = 0x9a3a28, timber = null, gableFront = false } = o;
  const roof = o.roof ?? (gableFront ? w : d) * 0.85;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  // o.props + o.model: Meem's house model (js/props.js) in this footprint instead of the shapes below.
  // (No code window panes on it: they didn't line up with the model's own windows.)
  if (o.props?.add(o.model, x, y, z, yaw, { w, d, h: h + roof * 0.9 })) return win;
  if (HOUSE.size && !o.stepped) {
    const wt = tintFor(wall, PLASTER), rt = tintFor(roofCol, TILE), ry = gableFront ? yaw + Math.PI / 2 : yaw;
    const [L, Dd] = gableFront ? [d, w] : [w, d];
    housePiece(k, 'walls', P(0, 0, 0), yaw, w / 10, h / 4, d / 8, wt);
    housePiece(k, 'gables', P(0, h, 0), ry, L / 10, roof / 3.4, Dd / 8, wt);
    housePiece(k, 'roof', P(0, h - EAVE * roof / 3.4, 0), ry, L / 10, roof / 3.4, Dd / 8, rt);
  } else {
  k.box(w, h, d, wall, P(0, h / 2, 0), [0, yaw, 0]);
  k.box(w + 0.1, 0.35, d + 0.1, 0x6a6058, P(0, 0.17, 0), [0, yaw, 0]);          // stone footing
  if (gableFront) {
    // roof ridge runs back from the street; gables at front and back
    const g = gableRoof(d, w, roof, 0.2); g.rotateY(Math.PI / 2); k.add(g, roofCol, P(0, h, 0), [0, yaw, 0]);
    if (o.stepped) { steppedGable(k, w, roof, 4, wall, P(0, h, d / 2 - 0.1), yaw, 0.35, roofCol); steppedGable(k, w, roof, 4, wall, P(0, h, -d / 2 + 0.1), yaw, 0.35, roofCol); }
    else for (const sz of [-1, 1]) { const gw = gableWall(w, roof, 0.2); k.add(gw, wall, P(0, h, sz * (d / 2 - 0.1)), [0, yaw, 0]); }
  } else {
    k.add(gableRoof(w, d, roof, 0.25), roofCol, P(0, h, 0), [0, yaw, 0]);
    for (const sx of [-1, 1]) { const gw = gableWall(d, roof, 0.2); k.add(gw, wall, P(sx * (w / 2 - 0.1), h, 0), [0, yaw + Math.PI / 2, 0]); }
  }
  }
  // half-timbering: dark beams on the street face
  const fz = d / 2 + 0.03;
  if (timber != null) {
    k.box(w, 0.16, 0.06, timber, P(0, h * 0.5, fz), [0, yaw, 0]); k.box(w, 0.16, 0.06, timber, P(0, h - 0.08, fz), [0, yaw, 0]);
    for (let i = 0; i <= Math.round(w / 1.4); i++) k.box(0.16, h, 0.06, timber, P(-w / 2 + i * w / Math.round(w / 1.4), h / 2, fz), [0, yaw, 0]);
    for (let i = 0; i < Math.round(w / 1.4); i++) { const x0 = -w / 2 + (i + 0.5) * w / Math.round(w / 1.4); k.box(0.12, h * 0.62, 0.05, timber, P(x0, h * 0.25, fz), [0, yaw, (i % 2 ? 1 : -1) * 0.75]); }
  }
  // chimney
  k.box(0.6, roof * 0.9 + 0.8, 0.6, 0x7a4a38, P(w * 0.25, h + roof * 0.45 + 0.4, gableFront ? -d * 0.2 : 0), [0, yaw, 0]);
  // door and windows on the street side (the windows are added later as glowing panes or dark glass)
  k.box(0.9, 1.9, 0.08, 0x3a2416, P(-w * 0.25, 0.95, fz), [0, yaw, 0]);
  const floors = Math.max(1, Math.round(h / 3)), cols = Math.max(1, Math.floor(w / 1.6));
  for (let f = 0; f < floors; f++) for (let i = 0; i < cols; i++) {
    const lx = -w / 2 + (i + 0.5) * w / cols, ly = 1.6 + f * 3;
    if (f === 0 && Math.abs(lx - -w * 0.25) < 0.8) continue;
    win.push({ p: new THREE.Vector3(...P(lx, ly, fz + 0.02)), yaw });
  }
  if (gableFront) win.push({ p: new THREE.Vector3(...P(0, h + roof * 0.3, fz + 0.02)), yaw });
  return win;
}

// Windows: small panes in one mesh. A share of them glow warm (candles and fires inside), the
// rest are dark glass. lit: 0..1 how many are lit; returns the mesh (MeshBasicMaterial, vertex colours).
export function windows(list, { lit = 0.45, w = 0.55, h = 0.8, seed = 3, warm = 0xffb45a, dark = 0x1a1a22 } = {}) {
  const k = new Kit(), r = rng(seed), c = new THREE.Color();
  for (const it of list) {
    const on = r() < lit;
    c.setHex(on ? warm : dark); if (on) c.multiplyScalar(0.7 + r() * 0.5);
    k.box(w, h, 0.03, c.getHex(), it.p.toArray(), [0, it.yaw, 0]);
    // a cross of glazing bars on the lit ones
    if (on) { const o = new THREE.Vector3(Math.sin(it.yaw) * 0.02, 0, Math.cos(it.yaw) * 0.02).add(it.p); k.box(w, 0.05, 0.03, 0x2a1a10, o.toArray(), [0, it.yaw, 0]); k.box(0.05, h, 0.03, 0x2a1a10, o.toArray(), [0, it.yaw, 0]); }
  }
  return k.mesh(new THREE.MeshBasicMaterial({ vertexColors: true }));
}

// ---------- Labels and glows ----------
export function glowTex(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.25)') {
  return canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(0.25, mid); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
}
export function glow(color = 0xffffff, size = 1, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size); return s;
}
// Text that always faces you, `h` metres tall (one line)
export function label(text, h = 0.2, { color = '#fff3d6', glowCol = 'rgba(255,200,120,0.7)', font = 'Georgia, serif', bold = false } = {}) {
  const px = 72, c0 = document.createElement('canvas').getContext('2d'); c0.font = `${bold ? 'bold ' : ''}${px}px ${font}`;
  const w = Math.ceil(c0.measureText(text).width) + 48;
  const tex = canvasTex(w, px + 40, (g, W, H) => { g.font = `${bold ? 'bold ' : ''}${px}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = glowCol; g.shadowBlur = 18; g.fillStyle = color; g.fillText(text, W / 2, H / 2); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(h * w / (px + 40), h, 1); s.renderOrder = 6;
  return s;
}

// ---------- The sky journal page every chapter ends with ----------
export function parchment(g, w, h) {
  const gr = g.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.7);
  gr.addColorStop(0, '#f2e3bf'); gr.addColorStop(1, '#d4bb86'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(110,80,40,0.5)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
}
export const INK = '#3a2a18';
// ch: the chapter (uses ch.s.journal: 0 hidden, 1 out, 2 touched, and ch.root). draw(g, w, h) paints it.
export class Journal {
  constructor(ch, draw) {
    this.ch = ch; const G = this.G = ch.G;
    const tex = canvasTex(1024, 720, (g, w, h) => { parchment(g, w, h); draw(g, w, h); });
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46 * 720 / 1024), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false }));
    this.g = new THREE.Group(); this.g.add(page); this.g.visible = false; ch.root.add(this.g);
    const self = this;
    this.it = {
      hint: 'Touch the journal page (TRIGGER or GRIP)', deskHint: 'Click the journal page',
      get disabled() { return ch.s.journal !== 1; },
      reach(pos) { self.g.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.22); },
      aim(o, d) { self.g.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.3 ? t : Infinity; },
      onTouch() { G.act({ type: 'touchPage' }); }, onGrab() { G.act({ type: 'touchPage' }); },
    };
    G.interactables.push(this.it);
  }
  // the chapter's act() passes { type: 'touchPage' } here
  act(a) { if (a.type === 'touchPage' && this.ch.s.journal === 1) { this.ch.s.journal = 2; return true; } return false; }
  // at the end of run(): hand over the page and wait for a touch (Kids: Astra turns it for you)
  async present(D) {
    const G = this.G, s = this.ch.s, fast = G.params.has('fast');
    s.journal = 1; G.events.emit('sfx', { k: 'page' });
    D.hint(G.mode === 'desktop' ? this.it.deskHint : this.it.hint, 8);
    await D.auto(() => s.journal === 2, () => { s.journal = 2; }, { after: fast ? 0.5 : 4 });
    G.ui.showHint(''); G.events.emit('sfx', { k: 'page' });
    await D.wait(1.2);
  }
  update() {
    const G = this.G, s = this.ch.s;
    this.g.visible = s.journal === 1;
    if (s.journal !== 1) { this.set = false; return false; }
    G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize();
    if (!this.set) { this.set = true; this.g.position.copy(_a).addScaledVector(_b, 0.62); this.g.position.y -= 0.2; }
    this.g.lookAt(_a);
    G.guide.flyTo(_c.copy(this.g.position).add(_b.set(-_b.z * 0.4, 0.12, _b.x * 0.4)), _a);
    return true;
  }
}

// ---------- Astra ----------
// s.guide = [x, y, z] sends her to hover there (with a chime), null calls her back to your side.
export function guideUpdate(ch, busy = false) {
  const G = ch.G, s = ch.s;
  if (busy) return;
  if (s.guide) { _a.fromArray(s.guide); if (!ch.guideAt || !ch.guideAt.equals(_a)) { ch.guideAt = _a.clone(); G.guide.flyTo(ch.guideAt); G.guide.chime(); } }
  else if (ch.guideAt) { ch.guideAt = null; G.guide.follow(); }
}

// Soft, eased fade toward a 0/1 target, stored on an object: fade(o, 'k', on, speed, dt)
export function fade(o, key, on, speed, dt) { o[key] = damp(o[key] || 0, on ? 1 : 0, speed, dt); return o[key]; }
