// Inside the spacecraft. Every cabin is built round your eyes at (0, 1.6, 0), looking -z: you sit
// in the couch, the instrument panel close in front, the windows showing the real world outside
// (the pad, the sky turning black, the Earth: the chapter puts those in the same scene).
//
//   const C = cabin('apollo', { crew: [left, right] });  scene.add(C.group);
//   C.lights(on), C.panel (touchable spots: C.spot('abort'), ...), C.windows[i].dir (world look direction)
//
// The shells are lathed and painted (canvas textures) with window holes cut by alpha, so one
// mesh is the whole wall; panels are painted with dials, toggles and warning lights, and the
// toggle levers stand out in 3D (one instanced mesh) so they look real up close.
import * as THREE from 'three';
import { canvasTex } from '../util.js';
import { rng } from '../shapes.js';
import { loadE3, copy } from './craft.js';

const EYE = 1.6;

// ---------- Painted panels ----------
// Paints a panel into g (w×h px): blocks of dials, rows of toggles with labels, lit warning
// lights. Returns the toggle positions in 0..1 (u, v) for 3D levers, and named spots.
const WORDS = ['FUEL', 'OXID', 'CABIN', 'PRESS', 'O2 FLOW', 'H2O', 'BUS A', 'BUS B', 'SCE', 'SPS', 'RCS', 'GIMBAL', 'PITCH', 'YAW', 'ROLL', 'CMC', 'ABORT', 'TAPE', 'S BAND', 'VHF', 'LIGHTS', 'SUIT', 'ECS', 'DOCK', 'PYRO', 'SEQ', 'LOGIC', 'TEMP', 'AMPS', 'VOLTS', 'MAIN', 'BATT', 'GLY', 'ARM', 'SAFE', 'LES', 'CSM', 'ORDEAL', 'EDS', 'ELS', 'FDAI', 'RATE', 'ATT', 'MODE', 'UP TLM', 'SIG CND'];
const RU = ['ТОПЛИВО', 'ДАВЛ', 'КАБИНА', 'О2', 'ВЛАЖН', 'ТЕМП', 'СВЯЗЬ', 'СПУСК', 'ВКЛ', 'ВЫКЛ', 'РУЧН', 'АВТО', 'ОРИЕНТ', 'ТДУ'];
export function paintPanel(g, w, h, { seed = 1, base = '#3a3c3e', ink = '#e8e8e0', russian = false, dense = 1, lit = 0.12, gauges = 6, special = [] } = {}) {
  const r = rng(seed), words = russian ? RU : WORDS;
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  // brushed metal grain + panel seams
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.025})`; g.fillRect(0, r() * h, w, 1); }
  const toggles = [], spots = {};
  // split into rectangular sub-panels
  const cols = 3 + Math.round(r() * 2 * dense), rows = 2 + Math.round(r() * dense);
  const cw = w / cols, rh = h / rows;
  let gaugeLeft = gauges;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const x0 = cx * cw + 6, y0 = cy * rh + 6, pw = cw - 12, ph = rh - 12;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0 + 2, y0 + 3, pw, ph);
    g.fillStyle = shade(base, -6 + r() * 10); g.fillRect(x0, y0, pw, ph);
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5; g.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1);
    // screws at the corners
    for (const [sx, sy] of [[5, 5], [pw - 5, 5], [5, ph - 5], [pw - 5, ph - 5]]) { g.fillStyle = '#8a8c8e'; g.beginPath(); g.arc(x0 + sx, y0 + sy, 2.2, 0, 7); g.fill(); }
    // a title strip
    g.fillStyle = ink; g.font = `bold ${Math.max(8, rh * 0.07) | 0}px sans-serif`; g.textAlign = 'center';
    g.fillText(words[(r() * words.length) | 0], x0 + pw / 2, y0 + rh * 0.09);
    const kind = r();
    if (gaugeLeft > 0 && kind < 0.35) {
      gaugeLeft--;
      const n = pw > ph ? 2 : 1; for (let i = 0; i < n; i++) dial(g, x0 + pw * (i + 0.5) / n, y0 + ph * 0.55, Math.min(pw / n, ph) * 0.36, r, ink, words[(r() * words.length) | 0]);
    } else if (kind < 0.5) {
      // tape meters: vertical strips with a moving marker
      const n = 3 + (r() * 3 | 0);
      for (let i = 0; i < n; i++) {
        const tx = x0 + pw * (i + 0.6) / (n + 0.2), ty = y0 + ph * 0.18, th = ph * 0.7;
        g.fillStyle = '#111'; g.fillRect(tx - 6, ty, 12, th); g.fillStyle = '#ddd'; for (let k = 0; k < 10; k++) g.fillRect(tx - 6, ty + th * k / 10, 4, 1);
        g.fillStyle = '#f0c040'; g.fillRect(tx - 6, ty + th * (0.2 + r() * 0.6), 12, 3);
      }
    } else {
      // rows of toggles, each with a label, some with red guards, and a few lit lights
      const tr = Math.max(1, Math.round(ph / 60)), tc = Math.max(2, Math.round(pw / 34));
      for (let j = 0; j < tr; j++) for (let i = 0; i < tc; i++) {
        const tx = x0 + pw * (i + 0.5) / tc, ty = y0 + ph * (0.3 + 0.62 * (j + 0.5) / tr);
        g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(tx, ty, 5.5, 0, 7); g.fill();
        g.fillStyle = '#9a9c9e'; g.beginPath(); g.arc(tx, ty, 3.5, 0, 7); g.fill();
        if (r() < 0.12) { g.strokeStyle = '#c02818'; g.lineWidth = 2.5; g.strokeRect(tx - 9, ty - 11, 18, 22); }
        g.fillStyle = ink; g.font = `${Math.max(7, rh * 0.05) | 0}px sans-serif`; g.fillText(words[(r() * words.length) | 0], tx, ty - 10);
        toggles.push([tx / w, 1 - ty / h, r() < 0.5 ? 1 : -1]);
      }
      if (r() < 0.6) for (let i = 0; i < 4; i++) {
        const lx = x0 + 10 + i * 18, ly = y0 + ph - 14, on = r() < lit * 3;
        g.fillStyle = on ? (r() < 0.5 ? '#ff5030' : '#ffc030') : '#3a2a20'; g.fillRect(lx, ly, 14, 8);
      }
    }
  }
  // the named special parts (a big red abort handle, an event timer, a globe…): [{ name, u, v, s, kind }]
  for (const sp of special) {
    const x = sp.u * w, y = (1 - sp.v) * h, s = sp.s * h;
    if (sp.kind === 'timer') { g.fillStyle = '#080808'; g.fillRect(x - s, y - s * 0.3, s * 2, s * 0.6); g.fillStyle = '#ff7a30'; g.font = `bold ${s * 0.42 | 0}px monospace`; g.textAlign = 'center'; g.fillText(sp.text || '00:00', x, y + s * 0.15); }
    else if (sp.kind === 'light') { g.fillStyle = sp.col || '#ff3020'; g.fillRect(x - s, y - s * 0.4, s * 2, s * 0.8); g.fillStyle = '#200'; g.font = `bold ${s * 0.35 | 0}px sans-serif`; g.textAlign = 'center'; g.fillText(sp.text || '', x, y + s * 0.12); }
    else if (sp.kind === 'globe') { const gr = g.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.1, x, y, s); gr.addColorStop(0, '#9ac8e8'); gr.addColorStop(1, '#1a3a5a'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.strokeStyle = '#ccc'; g.lineWidth = 3; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(x, y, s * Math.abs(k) / 2.5, s, 0, 0, 7); g.stroke(); } }
    else if (sp.kind === 'fdai') { const gr = g.createLinearGradient(0, y - s, 0, y + s); gr.addColorStop(0, '#e8e8e8'); gr.addColorStop(0.5, '#e8e8e8'); gr.addColorStop(0.5, '#202020'); gr.addColorStop(1, '#202020'); g.fillStyle = '#111'; g.fillRect(x - s * 1.2, y - s * 1.2, s * 2.4, s * 2.4); g.fillStyle = gr; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.strokeStyle = '#f0a020'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x + s * 0.5, y); g.stroke(); }
    else if (sp.kind === 'screen') { g.fillStyle = '#0a140c'; g.fillRect(x - s, y - s * 0.75, s * 2, s * 1.5); g.strokeStyle = '#555'; g.lineWidth = 4; g.strokeRect(x - s, y - s * 0.75, s * 2, s * 1.5); }
    spots[sp.name] = [sp.u, sp.v];
  }
  return { toggles, spots };
}
function dial(g, x, y, R, r, ink, word) {
  g.fillStyle = '#0c0c0c'; g.beginPath(); g.arc(x, y, R * 1.12, 0, 7); g.fill();
  g.fillStyle = '#181a1a'; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
  g.strokeStyle = ink; g.lineWidth = 1.2;
  for (let i = 0; i <= 20; i++) { const a = Math.PI * (0.75 + 1.5 * i / 20), l = i % 5 ? 0.12 : 0.22; g.beginPath(); g.moveTo(x + Math.cos(a) * R * 0.92, y + Math.sin(a) * R * 0.92); g.lineTo(x + Math.cos(a) * R * (0.92 - l), y + Math.sin(a) * R * (0.92 - l)); g.stroke(); }
  g.strokeStyle = '#c03020'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, R * 0.85, Math.PI * 1.95, Math.PI * 2.25); g.stroke();
  const a = Math.PI * (0.75 + 1.5 * (0.2 + r() * 0.6));
  g.strokeStyle = '#f4f0e0'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8); g.stroke();
  g.fillStyle = '#555'; g.beginPath(); g.arc(x, y, R * 0.1, 0, 7); g.fill();
  g.fillStyle = ink; g.font = `${Math.max(7, R * 0.22) | 0}px sans-serif`; g.textAlign = 'center'; g.fillText(word, x, y + R * 0.55);
  // glass glint
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.ellipse(x - R * 0.3, y - R * 0.4, R * 0.5, R * 0.25, -0.5, 0, 7); g.fill();
}
function shade(hex, d) { const n = parseInt(hex.slice(1), 16); const c = (s) => Math.max(0, Math.min(255, ((n >> s) & 255) + d)); return `rgb(${c(16)},${c(8)},${c(0)})`; }

// A flat (or curved) panel with painted face and 3D toggle levers. w, h metres; curve: radius of
// the arc it bends round (0 = flat). Returns { mesh, group, spots: { name: local Vector3 } }
export function panelMesh(w, h, opts = {}) {
  const PX = 1024, PY = Math.round(PX * h / w);
  let info;
  const tex = canvasTex(PX, PY, (g) => { info = paintPanel(g, PX, PY, opts); });
  tex.anisotropy = 8;
  const curve = opts.curve || 0;
  const geo = new THREE.PlaneGeometry(w, h, curve ? 24 : 1, 1);
  const bend = (x) => (curve ? [Math.sin(x / curve) * curve, curve - Math.cos(x / curve) * curve] : [x, 0]);
  if (curve) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const [bx, bz] = bend(p.getX(i)); p.setX(i, bx); p.setZ(i, bz); } geo.computeVertexNormals(); }
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.25, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.06 }));
  group.add(mesh);
  // a back box so it has depth
  const back = new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, h * 1.01, 0.08), new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.8 }));
  back.position.z = -0.045 + (curve ? bend(0)[1] : 0); if (!curve) group.add(back);
  // the levers
  const T = info.toggles.slice(0, 260);
  if (T.length) {
    const lg = new THREE.CylinderGeometry(0.0022, 0.0028, 0.02, 5); lg.translate(0, 0.01, 0); lg.rotateX(Math.PI / 2);
    const lev = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: 0xd0d2d4, metalness: 0.8, roughness: 0.3 }), T.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1);
    T.forEach(([u, v, up], i) => { const x = (u - 0.5) * w, y = (v - 0.5) * h, [bx, bz] = bend(x); m.compose(new THREE.Vector3(bx, y, bz + 0.002), q.setFromEuler(e.set(up * 0.45, curve ? x / curve * -1 : 0, 0, 'YXZ')), s); lev.setMatrixAt(i, m); });
    group.add(lev);
  }
  const spots = {};
  for (const [k, [u, v]] of Object.entries(info.spots)) { const x = (u - 0.5) * w, [bx, bz] = bend(x); spots[k] = new THREE.Vector3(bx, (v - 0.5) * h, bz + 0.01); }
  return { group, mesh, spots, tex };
}

// ---------- Shells ----------
// A lathed wall round the z axis (profile [radius, z] from back to front), painted: padding,
// rivets, cable runs, stowage bags; holes where the windows are (alpha). wins: [{ ang (deg round
// from up, clockwise seen from behind), z, w, h (metres), round }]
function shell(profile, wins, { col = '#c8c6c0', seed = 3, quilt = true, russian = false } = {}) {
  const pts = profile.map(([r, z]) => new THREE.Vector2(r, z));
  const geo = new THREE.LatheGeometry(pts, 64); geo.rotateX(Math.PI / 2);   // the lathe's axis (y) becomes z
  // the lathe's texture v steps evenly per profile point; u = 0.5 - angle/360 (0 = down)
  const NP = pts.length;
  const W = 2048, H = 1024, r = rng(seed);
  const circ = (rad) => 2 * Math.PI * rad;
  const tex = canvasTex(W, H, (g) => {
    g.fillStyle = col; g.fillRect(0, 0, W, H);
    // quilted insulation / padding
    if (quilt) { g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 2; for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.04})`; g.fillRect(r() * W, r() * H, 3, 3); } }
    // stowage lockers, bags, cable runs, labels
    for (let i = 0; i < 26; i++) { const x = r() * W, y = r() * H, w = 60 + r() * 160, h = 40 + r() * 90; g.fillStyle = r() < 0.5 ? 'rgba(80,82,86,0.55)' : 'rgba(205,200,185,0.9)'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.strokeRect(x, y, w, h); g.fillStyle = 'rgba(20,20,20,0.7)'; g.font = '14px sans-serif'; g.fillText((russian ? RU : WORDS)[(r() * 14) | 0], x + 6, y + 18); for (let k = 0; k < 4; k++) { g.fillStyle = '#999'; g.beginPath(); g.arc(x + (k % 2 ? w - 6 : 6), y + (k < 2 ? 6 : h - 6), 2.5, 0, 7); g.fill(); } }
    for (let i = 0; i < 10; i++) { g.strokeStyle = `rgba(${40 + r() * 40},${40 + r() * 40},${50 + r() * 40},0.8)`; g.lineWidth = 4 + r() * 6; const y = r() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 80, W * 0.6, y + (r() - 0.5) * 80, W, y + (r() - 0.5) * 30); g.stroke(); }
    // the window holes (alpha 0) with a dark frame round each
    for (const wn of wins) {
      const z = wn.z; let i = 1; while (i < profile.length - 1 && !((profile[i - 1][1] - z) * (profile[i][1] - z) <= 0)) i++;
      const t = (z - profile[i - 1][1]) / ((profile[i][1] - profile[i - 1][1]) || 1), rad = profile[i - 1][0] + (profile[i][0] - profile[i - 1][0]) * t;
      const v = (i - 1 + t) / (NP - 1), seg = pts[i].distanceTo(pts[i - 1]);
      wn.rad = rad;
      const u = (((0.5 - wn.ang / 360) % 1) + 1) % 1, pw = wn.w / circ(rad) * W, ph = wn.h / seg * H / (NP - 1);
      for (const du of [-1, 0, 1]) {
        const cx = (u + du) * W, cy = (1 - v) * H;
        g.fillStyle = '#2a2a2c'; shape(g, cx, cy, pw * 1.3, ph * 1.3, wn.round); g.fill();
        g.globalCompositeOperation = 'destination-out'; shape(g, cx, cy, pw, ph, wn.round); g.fill(); g.globalCompositeOperation = 'source-over';
      }
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  const m = new THREE.Mesh(geo, mat);
  return m;
}
function shape(g, cx, cy, w, h, round) {
  g.beginPath();
  if (round) g.ellipse(cx, cy, w / 2, h / 2, 0, 0, 7);
  else { const rr = Math.min(w, h) * 0.18; g.roundRect(cx - w / 2, cy - h / 2, w, h, rr); }
}
// The look direction (cabin space) through a window
function winDir(wn) { const a = wn.ang * Math.PI / 180; return new THREE.Vector3(Math.sin(a), Math.cos(a), 0).multiplyScalar(wn.rad).add(new THREE.Vector3(0, 0, wn.z)); }

// glass in a window: faint tint and reflections (so you feel it's there)
function glass(wn, axisY) {
  const g = new THREE.Mesh(wn.round ? new THREE.CircleGeometry(0.5, 24) : new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x88aacc, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide }));
  g.scale.set(wn.w * 1.05, wn.h * 1.05, 1);
  const p = winDir(wn); g.position.copy(p).multiplyScalar(0.985); g.position.y += axisY;
  g.lookAt(new THREE.Vector3(0, axisY, wn.z)); return g;
}

// ---------- The cabins ----------
// kind: 'vostok' | 'mercury' | 'gemini' | 'apollo' | 'lm' | 'soyuz'
// opts: { russian, seat: 'left'|'center'|'right' (Apollo) }
// Returns { group, windows: [{ dir (world, after the group is placed) }], panel, spots, crew: [seat
// spots for other people {pos, yaw}], light (PointLight), lights(on), setTimer(text), warn(name, on) }
export function cabin(kind, opts = {}) {
  const group = new THREE.Group(), inner = new THREE.Group(); group.add(inner);
  let wins = [], profile, axisY = EYE, P, crew = [], extra = [];
  const panelCol = { vostok: '#5a6a6a', mercury: '#2c2e30', gemini: '#2c2e30', apollo: '#38393a', lm: '#3a3b3c', soyuz: '#5a6a6a' }[kind];
  if (kind === 'vostok') {
    // a ball 2.3 m across; the Vzor porthole low in front (it shows the Earth sliding by), a
    // round side window, the panel in front of you, the globe instrument that shows where you are
    const R = 1.15; profile = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; profile.push([Math.max(0.02, Math.sin(a) * R), 0.25 - Math.cos(a) * R]); }
    wins = [{ ang: 180, z: -0.75, w: 0.36, h: 0.36, round: true, name: 'vzor' }, { ang: 255, z: -0.2, w: 0.26, h: 0.26, round: true, name: 'side' }, { ang: 20, z: 0.05, w: 0.24, h: 0.24, round: true, name: 'hatch' }];
    axisY = EYE - 0.1;
    P = panelMesh(0.7, 0.36, { seed: 21, base: panelCol, russian: true, dense: 0.6, gauges: 3, special: [{ name: 'globe', u: 0.5, v: 0.55, s: 0.32, kind: 'globe' }, { name: 'timer', u: 0.15, v: 0.25, s: 0.14, kind: 'timer', text: '00:00' }] });
    P.group.position.set(0, EYE - 0.18, -0.68); P.group.rotation.x = -0.35;
  } else if (kind === 'mercury') {
    // a cone you wear: panel 55 cm away, the trapezoid window above it, the periscope screen
    profile = [[0.95, 0.75], [0.95, 0.55], [0.75, -0.1], [0.5, -0.8], [0.38, -1.1], [0.01, -1.12]];
    wins = [{ ang: 0, z: -0.55, w: 0.26, h: 0.3, round: false, name: 'front' }, { ang: 270, z: -0.1, w: 0.2, h: 0.2, round: true, name: 'side' }];
    P = panelMesh(0.72, 0.4, { seed: 12, base: panelCol, dense: 0.8, gauges: 4, curve: 0.9, special: [{ name: 'periscope', u: 0.5, v: 0.5, s: 0.13, kind: 'screen' }, { name: 'abort', u: 0.1, v: 0.35, s: 0.06, kind: 'light', text: 'ABORT' }, { name: 'timer', u: 0.86, v: 0.75, s: 0.1, kind: 'timer', text: '00:00:00' }] });
    P.group.position.set(0, EYE - 0.12, -0.52); P.group.rotation.x = -0.25; P.group.rotation.y = Math.PI; P.group.rotation.y = 0;
  } else if (kind === 'gemini') {
    // two seats side by side, a window over each, the big centre panel between you
    profile = [[1.15, 0.75], [1.15, 0.5], [0.95, -0.2], [0.62, -0.95], [0.42, -1.3], [0.01, -1.32]];
    wins = [{ ang: -22, z: -0.62, w: 0.26, h: 0.34, round: false, name: 'left' }, { ang: 22, z: -0.62, w: 0.26, h: 0.34, round: false, name: 'right' }];
    group.position.x = 0; inner.position.x = 0.36;   // you're in the left seat: the cabin's middle is 36 cm to your right
    P = panelMesh(1.15, 0.42, { seed: 33, base: panelCol, dense: 1, gauges: 6, curve: 1.0, special: [{ name: 'fdai', u: 0.18, v: 0.5, s: 0.1, kind: 'fdai' }, { name: 'timer', u: 0.5, v: 0.8, s: 0.08, kind: 'timer', text: '000:00:00' }, { name: 'fdai2', u: 0.82, v: 0.5, s: 0.1, kind: 'fdai' }] });
    P.group.position.set(0, EYE - 0.14, -0.58); P.group.rotation.x = -0.3;
    crew.push({ pos: new THREE.Vector3(0.72, 0, 0), yaw: 0 });
  } else if (kind === 'apollo') {
    // the Command Module: a cone 3.9 m across at the base; three couches; the Main Display Console
    // arching over you; two triangular rendezvous windows looking forward, two side windows, and
    // the round hatch window above the middle couch
    profile = [[1.95, 0.9], [1.95, 0.6], [1.6, -0.2], [1.0, -1.25], [0.55, -1.95], [0.42, -2.05], [0.01, -2.06]];
    const seat = opts.seat || 'left', off = { left: 0.68, center: 0, right: -0.68 }[seat];
    inner.position.x = off;
    wins = [{ ang: -32, z: -1.25, w: 0.3, h: 0.34, round: false, name: 'rdvL' }, { ang: 32, z: -1.25, w: 0.3, h: 0.34, round: false, name: 'rdvR' }, { ang: 0, z: -0.25, w: 0.27, h: 0.27, round: true, name: 'hatch' }, { ang: -88, z: -0.05, w: 0.3, h: 0.3, round: true, name: 'sideL' }, { ang: 88, z: -0.05, w: 0.3, h: 0.3, round: true, name: 'sideR' }];
    P = panelMesh(2.3, 0.62, { seed: 44, base: panelCol, dense: 1.6, gauges: 8, curve: 1.3, special: [{ name: 'fdai', u: 0.2, v: 0.6, s: 0.07, kind: 'fdai' }, { name: 'timer', u: 0.5, v: 0.88, s: 0.06, kind: 'timer', text: '000:00:00' }, { name: 'master', u: 0.42, v: 0.86, s: 0.035, kind: 'light', text: 'MASTER ALARM', col: '#5a1810' }, { name: 'abort', u: 0.08, v: 0.4, s: 0.04, kind: 'light', text: 'ABORT', col: '#5a1810' }, { name: 'dsky', u: 0.5, v: 0.35, s: 0.07, kind: 'screen' }] });
    P.group.position.set(0, EYE - 0.02, -0.82); P.group.rotation.x = -0.42;
    for (const x of [-0.68, 0, 0.68]) if (Math.abs(x - off) > 0.1) crew.push({ pos: new THREE.Vector3(x - off, 0, 0), yaw: 0 });
  } else if (kind === 'lm') {
    // the Lunar Module's cabin: you stand (no seats), strapped in by cords; two triangular windows
    // looking down and out, the panel between, the commander on the left
    profile = [[1.2, 0.8], [1.2, -0.2], [1.1, -0.9], [0.9, -1.15], [0.01, -1.16]];
    wins = [{ ang: -40, z: -0.98, w: 0.36, h: 0.42, round: false, name: 'left' }, { ang: 40, z: -0.98, w: 0.36, h: 0.42, round: false, name: 'right' }, { ang: 0, z: -0.6, w: 0.14, h: 0.14, round: false, name: 'overhead' }];
    axisY = EYE - 0.05; inner.position.x = 0.42;
    P = panelMesh(0.5, 0.75, { seed: 55, base: panelCol, dense: 1.2, gauges: 6, special: [{ name: 'master', u: 0.5, v: 0.92, s: 0.05, kind: 'light', text: 'MASTER ALARM', col: '#5a1810' }, { name: 'timer', u: 0.5, v: 0.78, s: 0.08, kind: 'timer', text: '102:45:40' }, { name: 'dsky', u: 0.5, v: 0.25, s: 0.12, kind: 'screen' }] });
    P.group.position.set(0, EYE - 0.25, -0.75); P.group.rotation.x = -0.15;
    crew.push({ pos: new THREE.Vector3(0.84, 0, 0), yaw: 0, stand: true });
  } else if (kind === 'soyuz') {
    // the Soyuz orbital module: a ball with a round hatch ahead (the docking module beyond)
    const R = 1.1; profile = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; profile.push([Math.max(0.02, Math.sin(a) * R), 0.3 - Math.cos(a) * R]); }
    wins = [{ ang: 0, z: -0.8, w: 0.75, h: 0.75, round: true, name: 'hatch' }, { ang: 120, z: 0, w: 0.22, h: 0.22, round: true, name: 'side' }];
    P = panelMesh(0.6, 0.3, { seed: 66, base: panelCol, russian: true, dense: 0.6, gauges: 2 });
    P.group.position.set(-0.6, EYE - 0.3, -0.35); P.group.rotation.y = 1.0;
  }
  const S = shell(profile, wins, { col: kind === 'vostok' || kind === 'soyuz' ? '#a8b0a8' : kind === 'apollo' ? '#b8b4a8' : '#9a9690', seed: kind.length * 7, russian: opts.russian || kind === 'vostok' || kind === 'soyuz' });
  S.position.y = axisY; inner.add(S);
  for (const wn of wins) inner.add(glass(wn, axisY));
  inner.add(P.group);
  // the floor of the cabin (the couch's base and the bulkhead behind your feet) — a dark disc
  const back = new THREE.Mesh(new THREE.CircleGeometry(profile[0][0] * 0.99, 40), new THREE.MeshStandardMaterial({ color: 0x5a5a58, roughness: 0.9 }));
  back.position.set(0, axisY, profile[0][1] - 0.01); inner.add(back);
  // your couch (seen at your sides and knees): a padded frame, and your legs and hands in the suit
  const suit = opts.suit ?? (kind === 'vostok' ? 0xd86a2a : 0xe8e6e0);
  const couch = new THREE.Group(); inner.add(couch);
  const pad = new THREE.MeshStandardMaterial({ color: kind === 'vostok' ? 0x4a5a5a : 0x707070, roughness: 0.9 });
  const sm = new THREE.MeshStandardMaterial({ color: suit, roughness: 0.85 });
  for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.5), pad); arm.position.set(sx * 0.3 - inner.position.x * 0, EYE - 0.62, -0.15); couch.add(arm); }
  // knees up in front (you lie back in the couch): two suited legs reaching toward the panel
  if (kind !== 'lm' && kind !== 'soyuz') for (const sx of [-1, 1]) {
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.38, 4, 8), sm); th.rotation.x = Math.PI / 2 - 0.5; th.position.set(sx * 0.11, EYE - 0.58, -0.32); couch.add(th);
  }
  couch.position.x = -inner.position.x;   // the couch follows you, not the cabin's middle
  // ceiling light, warm-white
  const light = new THREE.PointLight(0xfff0dc, 0.0, 3.5, 1.6); light.position.set(-inner.position.x, axisY + 0.5, -0.2); group.add(light);
  // a little red/amber glow from the lit lights on the panel
  const glow = new THREE.PointLight(0xffa060, 0.0, 1.2, 2); glow.position.copy(P.group.position).add(new THREE.Vector3(0, 0, 0.25)); inner.add(glow);

  const C = {
    group, inner, kind, panel: P.group, spots: P.spots, crew, light, glow, shell: S, wins,
    windows: wins.map((wn) => ({ name: wn.name, local: winDir(wn).add(new THREE.Vector3(0, axisY - EYE, 0)) })),
    // look direction through a window, in world space (after the group's been placed)
    dirOf(name) { const w = C.windows.find((x) => x.name === name) || C.windows[0]; group.updateMatrixWorld(true); const p = w.local.clone().add(inner.position).add(new THREE.Vector3(0, EYE, 0)).applyMatrix4(group.matrixWorld); const e = new THREE.Vector3(0, EYE, 0).applyMatrix4(group.matrixWorld); return p.sub(e).normalize(); },
    // a world point on the panel (for touch spots)
    spot(name) { const v = P.spots[name]; if (!v) return null; return P.group.localToWorld(v.clone()); },
    lights(on, k = 1) { light.intensity = on ? 1.6 * k : 0; glow.intensity = on ? 0.4 * k : 0; },
    // the panel's event timer, master alarm etc. as 3D labels over the paint
    overlay(name, mesh) { const v = P.spots[name]; if (!v) return; mesh.position.copy(v).add(new THREE.Vector3(0, 0, 0.004)); P.group.add(mesh); },
  };
  C.lights(true);
  return C;
}

// A small glowing text/lamp that sits on a panel (timer digits, the master alarm): set(text, col, on)
export function panelLamp(w = 0.12, h = 0.04, { text = '', col = '#ff3020', font = 'bold 44px sans-serif', mono = false } = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w); const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }));
  let last = '';
  m.userData.set = (t = text, cc = col, on = true) => {
    const key = t + cc + on; if (key === last) return; last = key;
    g.clearRect(0, 0, c.width, c.height); g.fillStyle = on ? cc : '#1a0c08'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = on ? '#ffffff' : '#555'; g.font = mono ? `bold ${c.height * 0.7 | 0}px monospace` : font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, c.width / 2, c.height / 2 + 2);
    tex.needsUpdate = true;
  };
  m.userData.set(text, col, false);
  return m;
}

// The real props in the cabin (Meem's models): a DSKY, a hand controller, helmets. Loads them
// and places them by the named spots if the cabin has them.
export async function dressCabin(C) {
  if (C.kind === 'apollo' || C.kind === 'lm') {
    const [dsky, hc] = await Promise.all([loadE3('props/dsky'), loadE3('props/hand_controller')]);
    if (dsky && C.spots.dsky) { const d = copy(dsky); fit(d, dsky, 0.2); d.position.copy(C.spots.dsky); d.rotation.x = -Math.PI / 2 * 0; C.panel.add(d); }
    if (hc) { const h = copy(hc); fit(h, hc, 0.16); h.position.set(0.32 - C.inner.position.x * 0, EYE - 0.62, -0.32); C.group.add(h); C.handController = h; }
  }
}
function fit(o, M, size) { const s = size / Math.max(M.size.x, M.size.y, M.size.z); o.scale.setScalar(s); }
