// Rooms and set pieces for Era 3's indoor and outdoor places: a room with painted walls, floor and
// ceiling and real window openings (you see the world outside through them), furniture (desks,
// chairs, an armchair, a rug, lamps, shelves, framed pictures, curtains), brick walls and fences,
// floodlights, a concrete apron. Everything that can be is merged into one mesh per material.
import * as THREE from 'three';
import { Kit, FLAT, SMOOTH, segs } from '../kit.js';
import { canvasTex } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { surface } from '../surfaces.js';
import { loadGLB } from '../models.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- Furniture built in Blender (tools/blender/furniture.py) ----------
// Rounded edges, wood grain, upholstery, baked soft shadows. desk/chair/table/shelf/armchair/sofa use
// these (stretched to the size asked for) and fall back to boxes without them (?noset = boxes).
// They ride along in the Kit you pass: kit.mesh() gets them as a child mesh (one per texture).
const FURN = new Map();
if (!new URLSearchParams(location.search).has('noset')) {
  const gl = await loadGLB('sets/furniture.glb').catch(() => null);
  if (gl) { gl.scene.updateMatrixWorld(true); gl.scene.traverse((o) => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); FURN.set(o.name, { g, map: o.material.map }); } }); }
}
const _fm = new THREE.Matrix4(), _fq = new THREE.Quaternion(), _fy = new THREE.Vector3(0, 1, 0);
function furn(k, name, x, y, z, yaw, sx = 1, sy = 1, sz = 1, tint = null) {
  const p = FURN.get(name); if (!p) return false;
  const g = p.g.clone(); g.applyMatrix4(_fm.compose(new THREE.Vector3(x, y, z), _fq.setFromAxisAngle(_fy, yaw), new THREE.Vector3(sx, sy, sz)));
  const c = new THREE.Color(tint ?? 0xffffff), n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  k.addTextured(p.map, g);
  return true;
}
// a tint that turns the piece's own upholstery colour into col
const tintFor = (col, own) => { const a = new THREE.Color(col), b = new THREE.Color(own); return new THREE.Color(Math.min(2, a.r / b.r), Math.min(2, a.g / b.g), Math.min(2, a.b / b.b)).getHex(); };

// ---------- Painted surfaces ----------
// Each returns a repeating CanvasTexture; rep: [u, v] metres per repeat
const texCache = new Map();
function cached(key, make) { if (!texCache.has(key)) texCache.set(key, make()); return texCache.get(key); }
export function surf(kind, col = null) {
  return cached(kind + (col || ''), () => {
    let t;
    if (kind === 'boards') t = canvasTex(512, 512, (g, w, h) => {   // wooden floorboards, 8 across
      const r = rng(5); for (let i = 0; i < 8; i++) { const b = 90 + r() * 40 | 0; g.fillStyle = col || `rgb(${b + 40},${b + 10},${b - 30})`; if (col) g.globalAlpha = 1; g.fillRect(i * 64, 0, 64, h); g.fillStyle = `rgba(${b},${b - 30},${b - 60},0.25)`; g.fillRect(i * 64, 0, 64, h);
        for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(60,30,10,${0.05 + r() * 0.08})`; g.beginPath(); const x = i * 64 + r() * 64; g.moveTo(x, 0); g.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.6, x + 2, h); g.stroke(); }
        g.fillStyle = 'rgba(30,15,5,0.7)'; g.fillRect(i * 64, 0, 2, h); const j = r() * h; g.fillRect(i * 64, j, 64, 2); }
    });
    else if (kind === 'parquet') t = canvasTex(512, 512, (g, w, h) => { const r = rng(9); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const b = 110 + r() * 40 | 0; g.fillStyle = `rgb(${b + 30},${b},${b - 40})`; g.fillRect(x * 64, y * 64, 64, 64); g.strokeStyle = 'rgba(50,25,10,0.5)'; for (let k = 0; k < 4; k++) { if ((x + y) % 2) g.strokeRect(x * 64 + k * 16, y * 64, 16, 64); else g.strokeRect(x * 64, y * 64 + k * 16, 64, 16); } } });
    else if (kind === 'lino') t = canvasTex(512, 512, (g, w, h) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? (col || '#8a8274') : '#c8c0b0'; g.fillRect(x * 128, y * 128, 128, 128); } const r = rng(3); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); } });
    else if (kind === 'concrete') t = canvasTex(512, 512, (g, w, h) => { g.fillStyle = col || '#a8a49c'; g.fillRect(0, 0, w, h); const r = rng(7); for (let i = 0; i < 9000; i++) { const v = r() * 0.08; g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${v})` : `rgba(255,255,255,${v})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); } g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(30,30,30,${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); } });
    else if (kind === 'brick') t = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#8a8478'; g.fillRect(0, 0, w, h); const r = rng(13); for (let y = 0; y < 16; y++) for (let x = -1; x < 8; x++) { const b = 120 + r() * 50 | 0, ox = (y % 2) * 32; g.fillStyle = col ? col : `rgb(${b + 30},${b - 40},${b - 60})`; g.fillRect(x * 64 + ox + 2, y * 32 + 2, 60, 28); g.fillStyle = `rgba(0,0,0,${r() * 0.15})`; g.fillRect(x * 64 + ox + 2, y * 32 + 2, 60, 28); } });
    else if (kind === 'plaster') t = canvasTex(512, 512, (g, w, h) => { g.fillStyle = col || '#d8d0bc'; g.fillRect(0, 0, w, h); const r = rng(17); for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},0.03)`; g.fillRect(r() * w, r() * h, 3, 3); } for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(120,100,70,0.04)'; g.beginPath(); g.ellipse(r() * w, r() * h, 80, 60, 0, 0, 7); g.fill(); } });
    else if (kind === 'wallpaper') t = canvasTex(256, 512, (g, w, h) => { g.fillStyle = col || '#c8b88a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(120,80,40,0.22)'; for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { const ox = (y / 64) % 2 * 32; g.beginPath(); g.ellipse(x + ox + 16, y + 20, 8, 14, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x + ox + 16, y + 44, 4, 0, 7); g.fill(); } g.fillStyle = 'rgba(90,60,30,0.15)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h); });
    else if (kind === 'panelwood') t = canvasTex(512, 512, (g, w, h) => { g.fillStyle = col || '#6a4428'; g.fillRect(0, 0, w, h); const r = rng(21); for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(30,15,5,${0.05 + r() * 0.1})`; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 8, w * 0.6, y - 8, w, y + 3); g.stroke(); } g.strokeStyle = 'rgba(20,10,0,0.6)'; g.lineWidth = 4; g.strokeRect(20, 20, w - 40, h - 40); g.strokeStyle = 'rgba(255,220,180,0.15)'; g.lineWidth = 2; g.strokeRect(26, 26, w - 52, h - 52); });
    else if (kind === 'tiles') t = canvasTex(512, 512, (g, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = col || '#e8e8e0'; g.fillRect(x * 64, y * 64, 64, 64); g.strokeStyle = 'rgba(80,80,80,0.5)'; g.strokeRect(x * 64 + 0.5, y * 64 + 0.5, 63, 63); } });
    else if (kind === 'acoustic') t = canvasTex(512, 512, (g, w, h) => { g.fillStyle = col || '#e0dcd0'; g.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 12) for (let x = 6; x < w; x += 12) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x, y, 1.6, 0, 7); g.fill(); } g.strokeStyle = 'rgba(0,0,0,0.3)'; g.strokeRect(0, 0, w, h); });
    else if (kind === 'deck') t = canvasTex(512, 512, (g, w, h) => { const r = rng(23); for (let i = 0; i < 16; i++) { const b = 150 + r() * 30 | 0; g.fillStyle = col || `rgb(${b},${b - 20},${b - 50})`; g.fillRect(0, i * 32, w, 32); g.fillStyle = '#1a1612'; g.fillRect(0, i * 32, w, 3); } });
    else if (kind === 'grass') t = canvasTex(512, 512, (g, w, h) => { g.fillStyle = col || '#6a7a3a'; g.fillRect(0, 0, w, h); const r = rng(29); for (let i = 0; i < 12000; i++) { const v = r(); g.strokeStyle = v < 0.5 ? 'rgba(40,60,20,0.25)' : 'rgba(170,170,90,0.22)'; const x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 6); g.stroke(); } });
    else t = canvasTex(64, 64, (g) => { g.fillStyle = col || '#888'; g.fillRect(0, 0, 64, 64); });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  });
}
// a material with a painted surface repeating every `rep` metres (world-sized UVs from boxUV)
// Real photo detail (js/surfaces.js) for the plain kinds; patterned ones (wallpaper, tiles, acoustic,
// panelling) keep their painted pattern and get the photo's bumps only.
const REAL = { boards: 'boards', parquet: 'parquet', concrete: 'concrete', brick: 'brick', plaster: 'plaster', deck: 'boards', grass: 'grass' };
const BUMPS = { wallpaper: 'plaster', tiles: 'marble', lino: 'marble', panelwood: 'boards', acoustic: 'plaster' };
export function surfMat(kind, col, { rough = 0.9, metal = 0, tint = 0xffffff, emissive = 0 } = {}) {
  if (REAL[kind] && !emissive) { const m = surface(REAL[kind], col, { rough, metal, tint, rep: kind === 'lino' ? 0.5 : 1 }); if (m) return m; }
  const m = new THREE.MeshStandardMaterial({ map: surf(kind, col), roughness: rough, metalness: metal, color: tint });
  if (BUMPS[kind]) surface(BUMPS[kind], null, { keepMap: true, base: m, bump: 0.6 });
  if (emissive) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = m.map; m.emissiveIntensity = emissive; }
  return m;
}
// A flat rectangle (w × h metres) with UVs in metres / rep
export function quad(w, h, mat, rep = 1) {
  const g = new THREE.PlaneGeometry(w, h);
  // a picture (a texture that doesn't repeat: signs, maps, painted views) is stretched over it once
  if (mat.map && mat.map.wrapS !== THREE.ClampToEdgeWrapping) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / rep, uv.getY(i) * h / rep); }
  return new THREE.Mesh(g, mat);
}

// ---------- A room ----------
// w (x) × d (z) × h, floor at y 0, centred on 0. opts: { floor: material, wall: material (or per
// side {n,s,e,w}), ceil: material, windows: [{ side: 'n'|'s'|'e'|'w', at (m along, from the middle),
// y (bottom), w, h }], doors: [{ side, at, w, h }], skirting colour, rep }
// Walls are built with real holes for the windows and doors. Returns { group, windows: [{ pos, normal }] }
export function room(w, d, h, { floor, wall, ceil, windows = [], doors = [], skirt = 0x3a2a1e, rep = 1.5, frame = 0xe8e4d8, outside = null, thick = 0.14, open = [] } = {}) {
  const group = new THREE.Group();
  const F = quad(w, d, floor || surfMat('boards'), rep); F.rotation.x = -Math.PI / 2; group.add(F);
  if (ceil !== false) { const C = quad(w, d, ceil || surfMat('plaster', '#e8e4d8'), 2); C.rotation.x = Math.PI / 2; C.position.y = h; group.add(C); }
  const sides = { n: { len: w, pos: [0, 0, -d / 2], rot: 0 }, s: { len: w, pos: [0, 0, d / 2], rot: Math.PI }, e: { len: d, pos: [w / 2, 0, 0], rot: -Math.PI / 2 }, w: { len: d, pos: [-w / 2, 0, 0], rot: Math.PI / 2 } };
  const wins = [];
  const k = new Kit();
  for (const [name, S] of Object.entries(sides)) {
    if (open.includes(name)) continue;   // a side left open (a glass partition, a stage)
    const holes = [...windows.filter((x) => x.side === name).map((x) => ({ ...x, win: true })), ...doors.filter((x) => x.side === name).map((x) => ({ ...x, y: 0 }))];
    const shape = new THREE.Shape(); shape.moveTo(-S.len / 2, 0); shape.lineTo(S.len / 2, 0); shape.lineTo(S.len / 2, h); shape.lineTo(-S.len / 2, h); shape.lineTo(-S.len / 2, 0);
    for (const o of holes) { const p = new THREE.Path(); const x0 = o.at - o.w / 2, y0 = o.y ?? 0.9; p.moveTo(x0, y0); p.lineTo(x0, y0 + o.h); p.lineTo(x0 + o.w, y0 + o.h); p.lineTo(x0 + o.w, y0); p.lineTo(x0, y0); shape.holes.push(p); }
    const g = new THREE.ShapeGeometry(shape); const uv = g.attributes.uv, P = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i) / rep, P.getY(i) / rep);
    const mat = (wall && !wall.isMaterial ? wall[name] : wall) || surfMat('plaster');
    const m = new THREE.Mesh(g, mat); m.position.set(...S.pos); m.rotation.y = S.rot; group.add(m);
    // outside: the same wall seen from outdoors (its back face), set out by the wall's thickness,
    // with reveals round the openings so the wall reads solid from both sides
    if (outside) {
      const om = outside.isMaterial ? outside : outside[name]; const ob = om.userData.back || (om.userData.back = Object.assign(om.clone(), { side: THREE.BackSide }));
      const o = new THREE.Mesh(g, ob); o.rotation.y = S.rot; o.position.set(...S.pos).addScaledVector(new THREE.Vector3(Math.sin(S.rot), 0, Math.cos(S.rot)), -thick); group.add(o);
    }
    // skirting, and window frames with sills and glazing bars
    const dir = new THREE.Vector3(Math.sin(S.rot), 0, Math.cos(S.rot)), right = new THREE.Vector3(Math.cos(S.rot), 0, -Math.sin(S.rot));
    const at = (u, y, inn = 0.02) => new THREE.Vector3(...S.pos).addScaledVector(right, u).addScaledVector(dir, inn).setY(y).toArray();
    k.box(S.len, 0.1, 0.02, skirt, at(0, 0.05), [0, S.rot, 0]);
    for (const o of holes) {
      const y0 = o.y ?? 0.9;
      if (outside) {   // reveals: the opening's sides, top and sill through the wall's thickness
        k.box(o.w, 0.02, thick, frame, at(o.at, y0 + o.h, -thick / 2), [0, S.rot, 0]); if (o.y !== 0) k.box(o.w, 0.02, thick, frame, at(o.at, y0, -thick / 2), [0, S.rot, 0]);
        for (const sx of [-1, 1]) k.box(0.02, o.h, thick, frame, at(o.at + sx * o.w / 2, y0 + o.h / 2, -thick / 2), [0, S.rot, 0]);
      }
      k.box(o.w + 0.12, 0.06, 0.08, frame, at(o.at, y0 + o.h + 0.03, 0.03), [0, S.rot, 0]);
      for (const sx of [-1, 1]) k.box(0.06, o.h, 0.08, frame, at(o.at + sx * (o.w / 2 + 0.03), y0 + o.h / 2, 0.03), [0, S.rot, 0]);
      if (o.win) {
        k.box(o.w + 0.2, 0.04, 0.2, frame, at(o.at, y0 - 0.02, 0.08), [0, S.rot, 0]);
        k.box(0.04, o.h, 0.04, frame, at(o.at, y0 + o.h / 2, -0.06), [0, S.rot, 0]);
        k.box(o.w, 0.04, 0.04, frame, at(o.at, y0 + o.h * 0.66, -0.06), [0, S.rot, 0]);
        wins.push({ pos: new THREE.Vector3(...at(o.at, y0 + o.h / 2, 0)), normal: dir.clone().negate(), w: o.w, h: o.h });
      }
    }
  }
  if (outside) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(thick + 0.04, h, thick + 0.04, frame, [sx * (w / 2 + thick / 2), h / 2, sz * (d / 2 + thick / 2)]);   // corner posts
  group.add(k.mesh(FLAT));
  // faint glass in each window
  for (const wn of wins) { const gm = new THREE.Mesh(new THREE.PlaneGeometry(wn.w, wn.h), new THREE.MeshBasicMaterial({ color: 0xa8c0d0, transparent: true, opacity: 0.08, depthWrite: false })); gm.position.copy(wn.pos).addScaledVector(wn.normal, 0.06); gm.lookAt(gm.position.clone().add(wn.normal)); group.add(gm); }
  return { group, windows: wins };
}

// ---------- Furniture (all built into a Kit you pass in, so one mesh per room) ----------
export const WOOD = 0x6a4428, DARKWOOD = 0x3a2416, STEEL = 0x8a8e92;
export function desk(k, x, z, yaw = 0, { w = 1.5, d = 0.75, h = 0.76, col = WOOD, drawers = true } = {}) {
  const R = (lx, ly, lz) => rot(x, z, yaw, lx, ly, lz);
  if (drawers && furn(k, 'desk', x, 0, z, yaw, w / 1.5, h / 0.76, d / 0.75, tintFor(col, WOOD))) return;
  k.box(w, 0.04, d, col, R(0, h - 0.02, 0), [0, yaw, 0]);
  if (drawers) { k.box(0.42, h - 0.05, d - 0.05, col, R(-w / 2 + 0.23, (h - 0.05) / 2, 0), [0, yaw, 0]); for (let i = 0; i < 3; i++) { k.box(0.38, 0.18, 0.01, shadeHex(col, 0.85), R(-w / 2 + 0.23, 0.15 + i * 0.22, d / 2 - 0.02), [0, yaw, 0]); k.box(0.08, 0.015, 0.02, 0xc8b070, R(-w / 2 + 0.23, 0.18 + i * 0.22, d / 2), [0, yaw, 0]); } }
  for (const [sx, sz] of [[1, 1], [1, -1]].concat(drawers ? [] : [[-1, 1], [-1, -1]])) k.box(0.05, h - 0.04, 0.05, col, R(sx * (w / 2 - 0.05), (h - 0.04) / 2, sz * (d / 2 - 0.05)), [0, yaw, 0]);
  k.box(w - 0.1, 0.25, 0.02, col, R(0, h - 0.17, -d / 2 + 0.04), [0, yaw, 0]);   // modesty panel
}
export function chair(k, x, z, yaw = 0, { col = WOOD, seat = 0x6a2a1e, h = 0.46 } = {}) {
  const R = (lx, ly, lz) => rot(x, z, yaw, lx, ly, lz);
  if (furn(k, 'chair', x, 0, z, yaw, 1, h / 0.46, 1, tintFor(col, WOOD))) return;
  k.box(0.44, 0.05, 0.42, seat, R(0, h, 0), [0, yaw, 0]);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) k.box(0.035, h, 0.035, col, R(sx * 0.19, h / 2, sz * 0.18), [0, yaw, 0]);
  for (const sx of [-1, 1]) k.box(0.035, 0.5, 0.035, col, R(sx * 0.19, h + 0.25, -0.18), [0, yaw, 0]);
  k.box(0.42, 0.18, 0.025, col, R(0, h + 0.38, -0.19), [0, yaw, 0]);
}
export function armchair(k, x, z, yaw = 0, { col = 0x6a3a2a, leg = DARKWOOD } = {}) {
  const R = (lx, ly, lz) => rot(x, z, yaw, lx, ly, lz);
  if (furn(k, 'armchair', x, 0, z, yaw, 1, 1, 1, tintFor(col, 0x7a3a2a))) return;
  k.box(0.72, 0.22, 0.7, col, R(0, 0.3, 0), [0, yaw, 0]);
  k.box(0.6, 0.12, 0.58, shadeHex(col, 1.1), R(0, 0.46, 0.04), [0, yaw, 0]);
  k.box(0.72, 0.6, 0.16, col, R(0, 0.65, -0.29), [0, yaw, 0]);
  for (const sx of [-1, 1]) k.box(0.12, 0.3, 0.68, col, R(sx * 0.32, 0.55, 0), [0, yaw, 0]);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) k.box(0.05, 0.2, 0.05, leg, R(sx * 0.3, 0.1, sz * 0.28), [0, yaw, 0]);
}
export function sofa(k, x, z, yaw = 0, { col = 0x4a5a3a, w = 1.8 } = {}) {
  const R = (lx, ly, lz) => rot(x, z, yaw, lx, ly, lz);
  if (furn(k, 'sofa', x, 0, z, yaw, w / 1.8, 1, 1, tintFor(col, 0x4a5a3a))) return;
  k.box(w, 0.24, 0.8, col, R(0, 0.3, 0), [0, yaw, 0]);
  for (let i = 0; i < 3; i++) k.box(w / 3 - 0.04, 0.12, 0.66, shadeHex(col, 1.1), R((i - 1) * w / 3, 0.47, 0.05), [0, yaw, 0]);
  k.box(w, 0.55, 0.18, col, R(0, 0.62, -0.32), [0, yaw, 0]);
  for (const sx of [-1, 1]) k.box(0.16, 0.3, 0.78, col, R(sx * (w / 2 - 0.08), 0.55, 0), [0, yaw, 0]);
}
export function table(k, x, z, yaw = 0, { w = 1.2, d = 0.8, h = 0.75, col = WOOD, cloth = null } = {}) {
  const R = (lx, ly, lz) => rot(x, z, yaw, lx, ly, lz);
  if (furn(k, 'table', x, 0, z, yaw, w / 1.2, h / 0.75, d / 0.8, tintFor(col, WOOD))) { if (cloth) k.box(w + 0.1, 0.01, d + 0.1, cloth, R(0, h + 0.005, 0), [0, yaw, 0]); return; }
  k.box(w, 0.04, d, col, R(0, h - 0.02, 0), [0, yaw, 0]);
  if (cloth) k.box(w + 0.1, 0.01, d + 0.1, cloth, R(0, h + 0.005, 0), [0, yaw, 0]);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) k.box(0.05, h - 0.04, 0.05, col, R(sx * (w / 2 - 0.06), (h - 0.04) / 2, sz * (d / 2 - 0.06)), [0, yaw, 0]);
}
export function shelf(k, x, z, yaw = 0, { w = 1.0, h = 1.8, d = 0.32, col = WOOD, seed = 3, books = true } = {}) {
  const R = (lx, ly, lz) => rot(x, z, yaw, lx, ly, lz), r = rng(seed);
  const n = Math.round(h / 0.36), model = n === 5 && furn(k, 'shelf', x, 0, z, yaw, w / 1.0, h / 1.8, d / 0.32, tintFor(col, WOOD));
  if (!model) { for (const sx of [-1, 1]) k.box(0.03, h, d, col, R(sx * w / 2, h / 2, 0), [0, yaw, 0]); k.box(w, h, 0.02, shadeHex(col, 0.8), R(0, h / 2, -d / 2), [0, yaw, 0]); }
  for (let i = 0; i <= n; i++) {
    const y = i * h / n; if (!model) k.box(w, 0.025, d, col, R(0, y, 0), [0, yaw, 0]);
    if (books && i < n) { let bx = -w / 2 + 0.03; while (bx < w / 2 - 0.06) { const bw = 0.025 + r() * 0.035, bh = 0.2 + r() * 0.1; if (r() < 0.9) k.box(bw, bh, d * 0.8, [0x6a1a1a, 0x1a3a5a, 0x2a4a2a, 0x8a6a3a, 0x3a2a4a, 0xc8b890, 0x5a3a1a][(r() * 7) | 0], R(bx + bw / 2, y + 0.015 + bh / 2, 0.01), [0, yaw, 0]); bx += bw + 0.004; } }
  }
}
export function rug(k, x, z, yaw = 0, { w = 2.4, d = 1.7, col = 0x8a2a20, border = 0xc8a050 } = {}) {
  const R = (lx, ly, lz) => rot(x, z, yaw, lx, ly, lz);
  k.box(w, 0.012, d, border, R(0, 0.006, 0), [0, yaw, 0]);
  k.box(w - 0.2, 0.014, d - 0.2, col, R(0, 0.007, 0), [0, yaw, 0]);
  k.box(w * 0.4, 0.016, d * 0.4, border, R(0, 0.008, 0), [0, yaw + Math.PI / 4 * 0, 0]);
}
export function lampStand(k, x, z, { h = 1.5, shade = 0xe8c888 } = {}) {
  k.cyl(0.16, 0.18, 0.03, 12, 0x2a2a2a, [x, 0.015, z]); k.cyl(0.012, 0.012, h, 6, 0x8a7a5a, [x, h / 2, z]);
  k.cyl(0.14, 0.24, 0.28, 14, shade, [x, h, z]);
  return new THREE.Vector3(x, h - 0.05, z);
}
export function deskLamp(k, x, y, z, yaw = 0) {
  k.cyl(0.08, 0.09, 0.02, 10, 0x2a3a2a, [x, y + 0.01, z]);
  k.cyl(0.008, 0.008, 0.36, 5, 0x8a8a7a, [x, y + 0.18, z]);
  k.add(new THREE.ConeGeometry(0.1, 0.12, segs(12), 1, true), 0x2a4a2a, [x + Math.sin(yaw) * 0.1, y + 0.36, z + Math.cos(yaw) * 0.1], [0.5, yaw, 0]);
  return new THREE.Vector3(x + Math.sin(yaw) * 0.12, y + 0.3, z + Math.cos(yaw) * 0.12);
}
export function curtains(k, wn, { col = 0x8a3a2a } = {}) {
  const right = new THREE.Vector3(-wn.normal.z, 0, wn.normal.x), yaw = Math.atan2(wn.normal.x, wn.normal.z);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const p = wn.pos.clone().addScaledVector(right, s * (wn.w / 2 + 0.05 + i * 0.07)).addScaledVector(wn.normal, 0.08 + (i % 2) * 0.03);
    k.box(0.08, wn.h + 0.5, 0.03, shadeHex(col, 0.9 + (i % 2) * 0.15), [p.x, wn.pos.y + 0.1, p.z], [0, yaw, 0]);
  }
}
// a framed picture on a wall: draw(g, w, h) paints it. Returns the mesh (front faces +z)
export function picture(w, h, draw, { frame = 0x3a2416, px = 256, basic = false } = {}) {
  const g = new THREE.Group();
  const f = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.03), new THREE.MeshLambertMaterial({ color: frame })); g.add(f);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE[basic ? 'MeshBasicMaterial' : 'MeshLambertMaterial']({ map: canvasTex(px, Math.round(px * h / w), draw) })); p.position.z = 0.017; g.add(p);
  return g;
}

// ---------- Outdoors ----------
// A brick (or plank) wall from a to b ([x, z]), h tall, with piers every few metres
export function wall(a, b, h = 2.4, { kind = 'brick', col = null, t = 0.3, pier = 4 } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(b[0] - a[0], b[1] - a[1]) - Math.PI / 2;
  const g = new THREE.BoxGeometry(len, h, t); const uv = g.attributes.uv, P = g.attributes.position, N = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) { const ax = Math.abs(N.getX(i)) > 0.5 ? P.getZ(i) : P.getX(i); uv.setXY(i, ax / 2, P.getY(i) / 1); }
  const m = new THREE.Mesh(g, surfMat(kind, col)); m.position.set((a[0] + b[0]) / 2, h / 2, (a[1] + b[1]) / 2); m.rotation.y = -yaw;
  return m;
}
// A floodlight tower (a lattice mast with a bank of lamps on top), facing yaw. Returns { mesh, lamp: world pos of the lamps }
export function floodTower(k, x, z, yaw, h = 22) {
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; k.cyl(0.06, 0.06, h, 4, 0x5a5e62, [x + Math.cos(a) * 0.5, h / 2, z + Math.sin(a) * 0.5]); }
  for (let y = 2; y < h; y += 2.2) k.box(1.1, 0.05, 1.1, 0x5a5e62, [x, y, z]);
  const fx = x + Math.sin(yaw) * 0.4, fz = z + Math.cos(yaw) * 0.4;
  k.box(2.6, 1.6, 0.4, 0x3a3e42, [fx, h + 0.8, fz], [-0.3, yaw, 0]);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) k.cyl(0.24, 0.24, 0.05, 10, 0xfff8e0, [fx + Math.cos(yaw) * (c - 1.5) * 0.6 + Math.sin(yaw) * 0.22, h + 0.3 + r * 0.5, fz - Math.sin(yaw) * (c - 1.5) * 0.6 + Math.cos(yaw) * 0.22], [Math.PI / 2 - 0.3, yaw, 0]);
  return new THREE.Vector3(fx, h + 0.8, fz);
}
// A birch tree (white bark, yellow autumn leaves): built in code, one mesh into kit k
export function birch(k, x, z, { h = 9, seed = 1, leaf = 0xd8b040, bare = 0 } = {}) {
  const r = rng(seed);
  k.cyl(0.11, 0.16, h, 7, 0xe8e4dc, [x, h / 2, z]);
  for (let i = 0; i < 9; i++) k.box(0.2, 0.03, 0.02, 0x2a2a28, [x + (r() - 0.5) * 0.1, 0.5 + r() * h * 0.8, z + 0.13]);
  for (let i = 0; i < 7; i++) { const y = h * (0.45 + i * 0.08), a = r() * 6.28, L = 1.2 + r() * 1.2; k.cyl(0.02, 0.05, L, 4, 0xd8d4cc, [x + Math.cos(a) * L * 0.4, y + L * 0.25, z + Math.sin(a) * L * 0.4], [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]); }
  if (bare < 1) for (let i = 0; i < 14; i++) { const a = r() * 6.28, rr = 0.6 + r() * 1.6, y = h * (0.55 + r() * 0.45); k.ball(0.6 + r() * 0.7, 1, shadeHex(leaf, 0.8 + r() * 0.4), [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr], 0, [1, 0.8, 1]); }
}

// rotate a local (lx, ly, lz) by yaw about (x, z)
function rot(x, z, yaw, lx, ly, lz) { const c = Math.cos(yaw), s = Math.sin(yaw); return [x + lx * c + lz * s, ly, z - lx * s + lz * c]; }
export function shadeHex(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return c.getHex(); }
export { rot };

// A steel lattice tower w × d × h at (x, z): four legs, girders every `step` metres, X bracing.
export function lattice(k, x, z, w, d, h, { col = 0xb84a2a, step = 3, leg = 0.25, br = 0.08, y0 = 0, floors = false } = {}) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(leg, h, leg, col, [x + sx * w / 2, y0 + h / 2, z + sz * d / 2]);
  for (let y = y0 + step; y <= y0 + h + 0.01; y += step) {
    k.box(w, br * 1.6, br * 1.6, col, [x, y, z - d / 2]); k.box(w, br * 1.6, br * 1.6, col, [x, y, z + d / 2]);
    k.box(br * 1.6, br * 1.6, d, col, [x - w / 2, y, z]); k.box(br * 1.6, br * 1.6, d, col, [x + w / 2, y, z]);
    if (floors) k.box(w, 0.06, d, 0x4a4a48, [x, y, z]);
    const L1 = Math.hypot(w, step), a1 = Math.atan2(step, w), L2 = Math.hypot(d, step), a2 = Math.atan2(step, d);
    for (const s of [-1, 1]) {
      k.box(L1, br, br, col, [x, y - step / 2, z - d / 2], [0, 0, s * a1]); k.box(L1, br, br, col, [x, y - step / 2, z + d / 2], [0, 0, s * a1]);
      k.box(br, br, L2, col, [x - w / 2, y - step / 2, z], [s * a2, 0, 0]); k.box(br, br, L2, col, [x + w / 2, y - step / 2, z], [s * a2, 0, 0]);
    }
  }
}
// A 1960s bus (front = +z), into kit k
export function bus(k, x, z, yaw = 0, { col = 0x3a6a9a, roof = 0xe8e4d8 } = {}) {
  const R = (lx, ly, lz) => rot(x, z, yaw, lx, ly, lz), r = [0, yaw, 0];
  k.box(2.4, 1.6, 8.5, col, R(0, 1.3, 0), r); k.box(2.3, 0.9, 8.3, roof, R(0, 2.5, 0), r);
  k.box(2.42, 0.6, 7.6, 0x2a3a4a, R(0, 2.45, -0.2), r);   // the windows band
  for (let i = 0; i < 7; i++) k.box(2.44, 0.62, 0.08, roof, R(0, 2.45, -3.6 + i * 1.1), r);
  k.box(2.2, 0.7, 0.05, 0x2a3a4a, R(0, 2.4, 4.26), r); k.box(2.3, 0.3, 0.2, 0x9a9a9a, R(0, 0.55, 4.3), r);
  for (const sx of [-1, 1]) for (const sz of [-2.8, 2.8]) k.add(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 12), 0x1a1a1a, R(sx * 1.1, 0.48, sz), [0, yaw, Math.PI / 2]);
  for (const sx of [-0.8, 0.8]) k.cyl(0.12, 0.12, 0.05, 8, 0xfff8d0, R(sx, 0.9, 4.27), [Math.PI / 2, yaw, 0]);
}
// A plain wooden or iron bed with a blanket (head toward -z local)
export function bed(k, x, z, yaw = 0, { blanket = 0x6a4a3a, frame = 0x3a3a3a } = {}) {
  const R = (lx, ly, lz) => rot(x, z, yaw, lx, ly, lz), r = [0, yaw, 0];
  k.box(0.9, 0.2, 2.0, frame, R(0, 0.35, 0), r); for (const sz of [-1, 1]) k.box(0.9, sz < 0 ? 0.9 : 0.6, 0.05, frame, R(0, sz < 0 ? 0.45 : 0.3, sz * 1.0), r);
  k.box(0.86, 0.14, 1.94, 0xe8e4dc, R(0, 0.52, 0), r); k.box(0.6, 0.1, 0.36, 0xf0ece4, R(0, 0.64, -0.75), r);
}
