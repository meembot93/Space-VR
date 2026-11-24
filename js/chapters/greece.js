// Chapter 5: Greece proves the Earth is round. Then two short bridges: China's court
// astronomers record a comet, and Hipparchus sorts the stars by brightness.
//
// Five places, built once and shown one at a time (a "set"), joined by journal-page fades:
//   grove   An olive grove above the sea near Athens, about 350 BC, at night. A ship sinks below
//           the horizon, the Moon goes into eclipse and Earth's curved shadow crosses it, then
//           you hold a plate and a ball up to Aristotle's oil lamp and compare their shadows.
//   syene   Syene (Aswan), southern Egypt, about 240 BC, noon on the longest day: the Sun shines
//           straight down a deep well, and a stick you stand up casts no shadow.
//   alex    Alexandria, same day, same noon: the stick casts a short shadow, you measure its
//           angle (about 7 degrees, one fiftieth of a circle) and a globe is measured out in 50 slices.
//   china   Bridge: a palace courtyard in China at night, a comet over the wall; paint it on silk.
//   rhodes  Bridge: a hilltop on Rhodes at night; sort glowing stars into Bright and Faint baskets.
//
// World axes as everywhere: -Z is north, +X is east, +Y is up.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, walkToward, runRoutine, holdProp } from '../people.js';
import { dress } from '../dress.js';
import { makeHerd, makeFlock, makeTorch, Life } from '../life.js';
import { dirFromAzEl } from '../sky.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { makeCard } from '../ui.js';
import { rng, noise2 } from '../shapes.js';
import { grove, grassTuft, palm as palmTree, olive as oliveTree, cypress as cypressTree } from '../trees.js';
import { buildAthens } from './athens.js';
import { loadProps } from '../props.js';
// Meem's houses and the Greek ship (models/props), waited for before the chapter builds
const PROPS = await loadProps(['house_mudbrick', 'house_mudbrick_lo', 'house_greek_lo', 'ship_ancient', 'amphora', 'oil_lamp', 'table_stool']);
import { moonFaceTexture } from '../moontex.js';

const D2R = Math.PI / 180;
const MOON_AZ = 160, MOON_EL = 24;           // the eclipsed Moon, over the sea to the south
const ANGLE = 7.2;                           // Eratosthenes' angle: Alexandria's Sun is 7.2° from overhead
const STICK_H = 1.6;                         // the measuring stick (gnomon)
const at = (az, r, y = 0, out = new THREE.Vector3()) => out.set(Math.sin(az * D2R) * r, y, -Math.cos(az * D2R) * r);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const _col = new THREE.Color();
const face = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);            // a model faces +z
const yawToward = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z)); // a player faces -z

const N1 = noise2(51), N2 = noise2(57), N3 = noise2(63);

function glowMat(color, opacity = 1) {
  const t = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, color); gr.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.35)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return new THREE.SpriteMaterial({ map: t, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
}
function label(text, w = 1, color = 'rgba(255,240,210,0.95)') {
  const t = canvasTex(512, 128, (g, W, H) => {
    g.font = 'bold 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText(text, W / 2 + 3, H / 2 + 3); g.fillStyle = color; g.fillText(text, W / 2, H / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(w, w / 4, 1); return s;
}

// Ground: a big plane, finer near the middle, shaped and coloured by the set's own functions.
// hole(x, z) true leaves a gap (the well's shaft).
function buildGround(size, seg, height, color, hole) {
  let g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i);
    const r0 = Math.hypot(x, z), k = r0 > 0 ? Math.pow(r0 / (size / 2), 1.7) * (size / 2) / r0 : 0;
    x *= k; z *= k; p.setXYZ(i, x, height(x, z), z);
  }
  g = g.toNonIndexed();
  const q = g.attributes.position, pos = new Float32Array(q.count * 3), cols = new Float32Array(q.count * 3), c = new THREE.Color();
  let n = 0;
  for (let t = 0; t < q.count; t += 3) {
    const cx = (q.getX(t) + q.getX(t + 1) + q.getX(t + 2)) / 3, cz = (q.getZ(t) + q.getZ(t + 1) + q.getZ(t + 2)) / 3;
    if (hole && hole(cx, cz)) continue;
    for (let j = 0; j < 3; j++, n++) {
      const x = q.getX(t + j), y = q.getY(t + j), z = q.getZ(t + j); color(x, y, z, c);
      pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z; cols[n * 3] = c.r; cols[n * 3 + 1] = c.g; cols[n * 3 + 2] = c.b;
    }
  }
  g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, n * 3), 3)); out.setAttribute('color', new THREE.BufferAttribute(cols.slice(0, n * 3), 3));
  out.computeVertexNormals();
  return new THREE.Mesh(out, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}

// Little tufts of grass (or dry desert scrub), one instanced mesh
function tufts(n, seed, place, colA, colB, h = 0.3) {
  // curved blades, dark at the root and pale at the tip (js/trees.js grassTuft)
  const blade = grassTuft({ blades: 6, height: h, seed, root: _col.setHex(colA).multiplyScalar(0.8).getHex(), tip: _col.setHex(colB).multiplyScalar(1.2).getHex() });
  const m = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), n);
  const r = rng(seed + 1), mm = new THREE.Matrix4(), cc = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    place(r, p); _q.setFromAxisAngle(up, r() * 6.28); const sc = 0.7 + r() * 0.8;
    mm.compose(p, _q, _a.set(sc, sc, sc)); m.setMatrixAt(i, mm);
    m.setColorAt(i, cc.setRGB(0.8 + r() * 0.3, 0.8 + r() * 0.3, 0.8 + r() * 0.25));
  }
  return m;
}

// A plain Greek-style column (drum shaft, a little swell, square capital)
function column(k, x, y, z, h, rad, color) {
  k.cyl(rad * 0.86, rad, h - 0.25, 12, color, [x, y + (h - 0.25) / 2, z]);
  k.cyl(rad * 1.25, rad * 0.86, 0.12, 12, color, [x, y + h - 0.19, z]);
  k.box(rad * 2.6, 0.13, rad * 2.6, color, [x, y + h - 0.065, z]);
  k.box(rad * 2.5, 0.12, rad * 2.5, color, [x, y + 0.06, z]);
}

// A row of columns with a beam on top and a low gable roof: a temple front or a stoa
function colonnade(k, cx, cz, yaw, n, spacing, h, rad, stone, roof, depth = 4, y = 0, gable = true) {
  const c = Math.cos(yaw), s = Math.sin(yaw), w = (n - 1) * spacing;
  const P = (u, v) => [cx + c * u + s * v, cz - s * u + c * v];
  for (let i = 0; i < n; i++) { const [x, z] = P(-w / 2 + i * spacing, 0); column(k, x, y, z, h, rad, stone); }
  const [bx, bz] = P(0, -depth / 2 + 0.3);
  k.box(w + rad * 3, 0.45, depth, stone, [bx, y + h + 0.22, bz], [0, yaw, 0]);
  k.box(w + rad * 3, 0.35, depth + 0.4, stone, [bx, y - 0.17, bz], [0, yaw, 0]);
  // back wall
  const [wx, wz] = P(0, -depth + 0.4); k.box(w + rad * 2, h, 0.4, 0xd8cdb4, [wx, y + h / 2, wz], [0, yaw, 0]);
  if (gable) {
    // a triangular prism, apex up, ridge running front to back
    const half = (w + rad * 3) / 2, gh = half * 0.26, g = new THREE.CylinderGeometry(1, 1, depth + 0.6, 3, 1);
    g.rotateX(-Math.PI / 2); g.scale(half / 0.866, gh / 1.5, 1);
    k.add(g, roof, [bx, y + h + 0.45 + gh / 3, bz], [0, yaw, 0]);
  } else k.box(w + rad * 3.4, 0.25, depth + 0.6, roof, [bx, y + h + 0.57, bz], [0, yaw, 0]);
}

// ---------- A classic Doric temple, at real scale ----------
// Built along x (its front, with the door, faces +x: Greek temples face the sunrise), centred
// on the origin, standing on y = 0. Sizes default to the Temple of Hephaestus in Athens (finished
// about 415 BC, still standing today): 6 by 13 columns on a 13.7 by 31.8 m platform, 5.7 m columns.
// Painted the way Greek temples really were: blue triglyphs, red and blue bands, a blue pediment
// with marble figures. Returns { geo, columns: [[x, z]], cella: { x0, x1, w }, top } for blockers.
const MARBLE = 0xece4d0, MARBLE2 = 0xe0d6be, PAINT_BLUE = 0x2c4c86, PAINT_RED = 0xa8382c, TILE = 0xb4603e;
function doricTemple({ L = 31.8, W = 13.7, nL = 13, nW = 6, colH = 5.7, colD = 1.02, seg = 32, figures = true } = {}) {
  const k = new Kit(), r = rng(808);
  const steps = 3, stepH = 0.36, stepW = 0.5, base = steps * stepH;
  // the stepped platform (krepidoma)
  for (let i = 0; i < steps; i++) { const o = (steps - 1 - i) * stepW * 2; k.box(L + o, stepH, W + o, i === steps - 1 ? MARBLE : MARBLE2, [0, stepH * (i + 0.5), 0]); }
  // columns: fluted shafts with a gentle swell (entasis), a cushion capital (echinus) and a square slab (abacus)
  const inset = colD * 0.62, sx = (L - 2 * inset) / (nL - 1), sz = (W - 2 * inset) / (nW - 1);
  const shaftH = colH - 0.5, R0 = colD / 2;
  const shaft = () => {
    const g = new THREE.CylinderGeometry(R0 * 0.78, R0, shaftH, seg, 6, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = y / shaftH + 0.5;
      const a = Math.atan2(z, x), flute = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * seg / 4)), 0.6);  // 20-ish shallow grooves
      const sw = 1 + 0.03 * Math.sin(Math.PI * t);
      p.setXYZ(i, x * flute * sw, y, z * flute * sw);
    }
    g.computeVertexNormals(); return g;
  };
  const columns = [];
  const column = (x, z, scale = 1) => {
    const y0 = base;
    k.add(shaft(), MARBLE, [x, y0 + shaftH / 2, z], 0, scale);
    k.cyl(R0 * 0.8, R0 * 0.8, 0.06, seg / 2, 0xc8b898, [x, y0 + shaftH - 0.1, z]);                  // necking groove
    k.add(new THREE.CylinderGeometry(R0 * 1.22, R0 * 0.8, 0.3, seg / 2, 1), MARBLE, [x, y0 + shaftH + 0.15, z]); // echinus
    k.box(colD * 1.3, 0.2, colD * 1.3, MARBLE, [x, y0 + shaftH + 0.4, z]);                             // abacus
    columns.push([x, z]);
  };
  for (let i = 0; i < nL; i++) for (let j = 0; j < nW; j++) {
    if (i !== 0 && i !== nL - 1 && j !== 0 && j !== nW - 1) continue;
    column(-L / 2 + inset + i * sx, -W / 2 + inset + j * sz);
  }
  // the walled inner room (cella) with its porch: two columns between the wall ends (in antis)
  const cw = W - 2 * inset - 2 * sz * 0.95, cx0 = -L / 2 + inset + sx * 1.9, cx1 = L / 2 - inset - sx * 2.2;
  const top = base + colH;
  const wallH = colH + 0.6;
  k.box(cx1 - cx0, wallH, 0.7, MARBLE2, [(cx0 + cx1) / 2, base + wallH / 2, -cw / 2 + 0.35]);
  k.box(cx1 - cx0, wallH, 0.7, MARBLE2, [(cx0 + cx1) / 2, base + wallH / 2, cw / 2 - 0.35]);
  k.box(0.7, wallH, cw, MARBLE2, [cx0 + 0.35, base + wallH / 2, 0]);
  const dx = cx1 - sx * 1.1;   // the front wall of the cella, set back behind its porch
  for (const sgn of [-1, 1]) k.box(0.7, wallH, cw / 2 - 1.5, MARBLE2, [dx, base + wallH / 2, sgn * (cw / 4 + 0.75)]);
  k.box(0.7, wallH - 5.2, 3, MARBLE2, [dx, base + 5.2 + (wallH - 5.2) / 2, 0]);
  k.box(0.12, 5.2, 3, 0x1a120a, [dx + 0.3, base + 2.6, 0]);                   // the dark doorway
  k.box(0.1, 5.2, 1.0, 0x8a6a2a, [dx + 0.6, base + 2.6, -1.25], [0, 0.9, 0]);  // bronze doors, opened inward
  k.box(0.1, 5.2, 1.0, 0x8a6a2a, [dx + 0.6, base + 2.6, 1.25], [0, -0.9, 0]);
  for (const z of [-cw / 2 + 0.35, cw / 2 - 0.35]) k.box(0.9, wallH, 0.9, MARBLE, [cx1, base + wallH / 2, z]);   // wall ends (antae)
  for (const z of [-cw / 6, cw / 6]) column(cx1, z);
  // the entablature: architrave, the frieze of triglyphs and metopes, the projecting cornice
  const archH = colH * 0.15, frzH = colH * 0.16, corH = 0.42, deep = colD * 1.3;
  // trim: pull the inner face back (m), for a band laid over another ring, so their inner faces don't
  // share a plane and flicker
  const ring = (y, h, out, color, trim = 0) => {
    const d = deep + out - trim, o = out + trim;
    k.box(L - 2 * inset + deep + 2 * out, h, d, color, [0, y + h / 2, -W / 2 + inset + (-o) / 2]);
    k.box(L - 2 * inset + deep + 2 * out, h, d, color, [0, y + h / 2, W / 2 - inset + o / 2]);
    k.box(d, h, W - 2 * inset - 2 * trim, color, [-L / 2 + inset - o / 2, y + h / 2, 0]);
    k.box(d, h, W - 2 * inset - 2 * trim, color, [L / 2 - inset + o / 2, y + h / 2, 0]);
  };
  const yA = top;
  ring(yA, archH, 0, MARBLE);
  ring(yA + archH - 0.1, 0.1, 0.06, PAINT_RED, 0.03);                                    // the painted band (taenia)
  const yF = yA + archH;
  ring(yF, frzH, -0.08, 0xd8ccb0);                                                 // metopes, set back a little
  // triglyphs: one over every column and one between, painted blue, with their grooves
  const tri = (x, z, rotY) => {
    const w = colD * 0.62;
    k.box(w, frzH, 0.16, PAINT_BLUE, [x, yF + frzH / 2, z], [0, rotY, 0]);
    for (const o of [-w / 6, w / 6]) k.box(0.05, frzH * 0.86, 0.04, 0x1a2c50, [x + Math.cos(rotY) * o, yF + frzH * 0.45, z - Math.sin(rotY) * o], [0, rotY, 0]);
  };
  const ez = W / 2 - inset + deep / 2 - 0.02, ex = L / 2 - inset + deep / 2 - 0.02;
  for (let i = 0; i <= (nL - 1) * 2; i++) { const x = -L / 2 + inset + i * sx / 2; tri(x, ez, 0); tri(x, -ez, 0); }
  for (let j = 0; j <= (nW - 1) * 2; j++) { const z = -W / 2 + inset + j * sz / 2; tri(ex, z, Math.PI / 2); tri(-ex, z, Math.PI / 2); }
  // a few metopes carved with figures (Theseus and Heracles at the Hephaisteion): small reliefs on the front
  for (let j = 0; j < (nW - 1) * 2; j++) {
    const z = -W / 2 + inset + (j + 0.5) * sz / 2;
    k.box(0.08, frzH * 0.6, sz * 0.22, 0xf0e8d4, [ex - 0.02, yF + frzH * 0.5, z + sz * 0.05]);
    k.ball(0.12, 0, 0xf0e8d4, [ex - 0.02, yF + frzH * 0.78, z + sz * 0.05]);
    k.box(0.06, frzH * 0.45, sz * 0.08, 0x9a3a2a, [ex - 0.01, yF + frzH * 0.4, z - sz * 0.13]);
  }
  const yC = yF + frzH;
  ring(yC, 0.08, 0.1, PAINT_BLUE);
  ring(yC + 0.08, corH, 0.32, MARBLE);                                             // the cornice
  const yR = yC + 0.08 + corH;                                                     // where the roof and the pediments begin
  // the pediments: a low triangle at each end, its back wall painted blue, with figures standing in it
  const halfW = W / 2 - inset + deep / 2 + 0.32, ph = halfW * 0.27;
  for (const end of [-1, 1]) {
    const x = end * (L / 2 - inset + deep / 2 + 0.1);
    const tym = new THREE.Shape(); tym.moveTo(-halfW + 0.3, 0); tym.lineTo(halfW - 0.3, 0); tym.lineTo(0, ph - 0.12); tym.lineTo(-halfW + 0.3, 0);
    const tg = new THREE.ExtrudeGeometry(tym, { depth: 0.5, bevelEnabled: false }); tg.rotateY(Math.PI / 2); tg.translate(-0.25 - end * 0.12, 0, 0);
    k.add(tg, 0x4a6a9a, [x, yR, 0]);
    // the raking cornices along the two sloping edges
    const slope = Math.atan2(ph, halfW), len = Math.hypot(halfW, ph) + 0.25;
    for (const side of [-1, 1]) k.box(0.95, 0.36, len, MARBLE, [x + end * 0.12, yR + ph / 2 + 0.1, side * halfW / 2], [side * slope, 0, 0]);
    // statues in the pediment, tallest in the middle where there's room
    if (figures) for (let f = -5; f <= 5; f++) {
      if (f === 0) continue;
      const z = f * halfW / 6, hh = (ph - 0.25) * (1 - Math.abs(z) / halfW) * 0.85;
      if (hh < 0.35) continue;
      const lean = (r() - 0.5) * 0.3;
      k.box(0.32, hh * 0.62, 0.42, 0xf2ead8, [x + end * 0.05, yR + hh * 0.31, z], [lean, 0, 0]);
      k.ball(0.15, 0, 0xf2ead8, [x + end * 0.05, yR + hh * 0.62 + 0.1, z + lean * 0.3]);
    }
    const cg = new THREE.ConeGeometry(0.4, 1.0, 6); k.add(cg, MARBLE, [x + end * 0.1, yR + ph + 0.45, 0]);              // acroteria
    for (const side of [-1, 1]) k.add(new THREE.ConeGeometry(0.25, 0.7, 5), MARBLE, [x + end * 0.1, yR + 0.4, side * (halfW - 0.2)]);
  }
  // the roof: two slopes of terracotta tiles, with rows of cover tiles and little upright antefixes at the eaves
  const roofL = 2 * (L / 2 - inset + deep / 2 + 0.1), slope = Math.atan2(ph, halfW), sl = Math.hypot(halfW, ph);
  for (const side of [-1, 1]) {
    k.box(roofL, 0.22, sl + 0.25, TILE, [0, yR + ph / 2 + 0.13, side * halfW / 2], [side * slope, 0, 0]);
    for (let x = -roofL / 2 + 0.35; x < roofL / 2; x += 0.72) {
      const cv = new THREE.CylinderGeometry(0.1, 0.1, sl + 0.2, 5, 1, false, 0, Math.PI); cv.rotateX(Math.PI / 2); cv.rotateZ(Math.PI / 2);
      k.add(cv, 0xa0503a, [x, yR + ph / 2 + 0.25, side * halfW / 2], [side * slope, 0, 0]);
      k.box(0.14, 0.32, 0.06, MARBLE, [x, yR + 0.35, side * (halfW + 0.1)]);
    }
  }
  k.box(roofL, 0.16, 0.32, 0xa0503a, [0, yR + ph + 0.12, 0]);                       // the ridge
  // the coffered ceiling between the colonnade and the room (so you don't see into the roof)
  k.box(L - 2 * inset, 0.25, W - 2 * inset, 0xc8bca0, [0, yA + archH + frzH - 0.15, 0]);
  return { geo: k.geometry(), columns, cella: { x0: cx0, x1: cx1, w: cw, door: dx }, top: yR + ph, L, W, base };
}

// A flat-roofed mud-brick or whitewashed house
// (k.P, if set, is a PropSet: then it's Meem's house model instead, mud-brick or, for white walls,
// the whitewashed Greek one; simplified past 40 m from the middle of the place)
function house(k, x, z, w, d, h, yaw, wall, y = 0) {
  if (k.P) {
    const far = Math.hypot(x, z) > 40, kind = wall === 0xe8dcc0 ? 'house_greek' : 'house_mudbrick';
    const name = far || kind === 'house_greek' ? kind + '_lo' : kind;
    if (k.P.add(name, x, y - 0.1, z, yaw, { w, d, h: h + (kind === 'house_greek' ? 1.6 : 0.5) })) return;
  }
  k.box(w, h, d, wall, [x, y + h / 2, z], [0, yaw, 0]);
  k.box(w + 0.2, 0.15, d + 0.2, 0x8a7458, [x, y + h + 0.07, z], [0, yaw, 0]);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  k.box(0.8, 1.6, 0.1, 0x3a2a1a, [x + s * (d / 2 + 0.01), y + 0.8, z + c * (d / 2 + 0.01)], [0, yaw, 0]);
  k.box(0.5, 0.5, 0.1, 0x2a2018, [x + s * (d / 2 + 0.01) + c * w * 0.28, y + h * 0.65, z + c * (d / 2 + 0.01) - s * w * 0.28], [0, yaw, 0]);
}

// Date palms and olive trees come from js/trees.js: palm() and olive() just note where they stand
// (on the kit or list given); addPalms() and the grove set grow them as a grove or two (a few draw calls).
function palm(k, x, y, z, h, seed) { (k.palms ||= []).push({ x, y, z, s: h / 9, yaw: seed * 2.39996 }); }
function olive(list, _unused, x, y, z, s, seed) { list.push({ x, y, z, s, yaw: seed * 2.39996 }); }
function addPalms(g, k, nearR = 25) {
  const pl = k.palms || [], near = pl.filter((p) => Math.hypot(p.x, p.z) < nearR), far = pl.filter((p) => Math.hypot(p.x, p.z) >= nearR);
  if (near.length) g.add(grove(palmTree, near, { detail: 'high', height: 9, dates: true, seed: 51, variants: Math.min(4, near.length) }).group);
  if (far.length) g.add(grove(palmTree, far, { detail: 'mid', height: 9, seed: 53, variants: 4 }).group);
  k.palms = [];
}

// The sky journal page at the end of the chapter: two sticks on a curved Earth, parallel sunbeams
function journalPage() {
  const tex = canvasTex(1024, 720, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.7);
    gr.addColorStop(0, '#f2e3bf'); gr.addColorStop(1, '#d4bb86'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(110,80,40,0.5)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    const ink = '#3a2a18', cx = w * 0.42, cy = h * 1.32, R = h * 0.92;
    g.strokeStyle = ink; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, Math.PI * 1.22, Math.PI * 1.78); g.stroke();
    // centre lines out through Syene and Alexandria, 7.2° apart (drawn wider so you can see it)
    const aS = -Math.PI / 2, aA = -Math.PI / 2 - 14 * D2R;
    g.setLineDash([8, 8]); g.lineWidth = 2;
    for (const a of [aS, aA]) { g.beginPath(); g.moveTo(cx + Math.cos(a) * (R - 160), cy + Math.sin(a) * (R - 160)); g.lineTo(cx + Math.cos(a) * (R + 70), cy + Math.sin(a) * (R + 70)); g.stroke(); }
    g.setLineDash([]);
    g.beginPath(); g.arc(cx, cy, R - 130, aA, aS); g.stroke();
    g.font = 'italic bold 30px Georgia, serif'; g.fillStyle = ink; g.fillText('7°', cx - 52, cy - R + 112);
    // the two sticks and their shadows
    const stick = (a, name, shadow) => {
      const bx = cx + Math.cos(a) * R, by = cy + Math.sin(a) * R, tx = cx + Math.cos(a) * (R + 70), ty = cy + Math.sin(a) * (R + 70);
      g.lineWidth = 7; g.strokeStyle = '#5a3a1a'; g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke();
      if (shadow) { g.lineWidth = 6; g.strokeStyle = 'rgba(40,25,10,0.7)'; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 24, by + 3); g.stroke(); }
      g.font = 'italic 28px Georgia, serif'; g.fillStyle = ink; g.fillText(name, tx - 60, ty - 18);
    };
    stick(aS, 'Syene', false); stick(aA, 'Alexandria', true);
    // parallel sunbeams straight down
    g.strokeStyle = '#d08a20'; g.lineWidth = 3;
    for (let i = 0; i < 7; i++) { const x = w * 0.18 + i * 70; g.beginPath(); g.moveTo(x, 90); g.lineTo(x, 200); g.stroke(); g.beginPath(); g.moveTo(x - 7, 188); g.lineTo(x, 202); g.lineTo(x + 7, 188); g.stroke(); }
    g.fillStyle = '#e0952a'; g.beginPath(); g.arc(w * 0.86, 120, 40, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink; g.font = 'italic bold 42px Georgia, serif'; g.fillText('Eratosthenes, about 240 BC', 40, 66);
    g.font = 'italic 30px Georgia, serif'; g.fillText('7° = 1/50 of a circle.   800 km × 50 = 40,000 km around', 40, h - 40);
  });
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46 * 720 / 1024), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false }));
  const g = new THREE.Group(); g.add(page); return g;
}

// ---------- The eclipsed Moon: a big disc on the sky with Earth's round shadow sliding across ----------
const MOON_VS = `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const MOON_FS = `
uniform vec2 shadowC; uniform float shadowR, guide, glow; uniform sampler2D moonMap;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vUv * 3.0;                       // the plane is 3 Moon-radii wide each way
  float r = length(p);
  float disc = 1.0 - smoothstep(0.985, 1.0, r);
  // Moon surface: the real near side (js/moontex.js)
  vec3 col = texture2D(moonMap, clamp(p * 0.5 + 0.5, 0.0, 1.0)).rgb;
  col *= 1.0 - 0.18 * pow(r, 4.0);
  // Earth's shadow: dark coppery red inside, soft edge (the penumbra)
  float d = length(p - shadowC);
  float sh = 1.0 - smoothstep(shadowR - 0.1, shadowR + 0.12, d);
  col = mix(col, col * vec3(0.32, 0.12, 0.07), sh);
  float a = disc;
  // A soft halo around the Moon (dimmer once the shadow covers it)
  a = max(a, (1.0 - smoothstep(1.0, 1.7, r)) * 0.22 * glow);
  vec3 halo = vec3(0.7, 0.75, 0.9) * glow;
  col = mix(halo, col, disc);
  // The rest of the shadow's circle, drawn faintly out past the Moon, so you can see the curve
  float ring = (1.0 - smoothstep(0.0, 0.035, abs(d - shadowR))) * guide * step(1.0, r) * step(0.5, fract(atan(p.y - shadowC.y, p.x - shadowC.x) * 18.0));
  col = mix(col, vec3(1.0, 0.75, 0.45), ring); a = max(a, ring * 0.9);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

export default class Greece {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.s = {
      set: 'grove', phase: 'arrive',
      guide: null,      // [x, y, z] where Astra hovers, or null = out in front of you
      ship: 0,          // 0..1 the ship sailing away over the horizon
      eclipse: 0,       // 0..1 Earth's shadow sliding onto the Moon
      curve: 0,         // the faint circle that shows the shadow's whole curve
      obj: {},          // things being carried: name -> [x,y,z,qx,qy,qz,qw]
      plate: 0, ball: 0, // tried the plate edge-on / held up the ball
      demo: 0,          // 0..1 if nobody tries, the plate and ball show it themselves
      ring: null,       // [x, z] glowing "put it here" ring, or null
      plantS: 0, plantA: 0, // the sticks stand in Syene / Alexandria
      glint: 0,         // the Sun's reflection deep in the well
      prot: 0,          // 1 the protractor is out, 2 measured
      measure: 0,       // 0..1 the angle sweeping open
      globe: 0, slices: 0, grow: 0,
      journal: 0,
      comet: 0, paint: 0,  // 1 the scroll can be painted, 2 painted; painting 0..1 in `brush`
      brush: 0,
      sorted: [0, 0, 0, 0, 0, 0], // stars: 0 floating, 1 in Bright, 2 in Faint
      point: 0, cheer: 0,
    };
    this.local = {};      // things this headset's hand is carrying
    this.sets = {};
    G.sky.fogFar = 1100; G.sky.mist = 0; G.audio.amb = 0.6;
    G.narration.preload('br5_');

    this.buildGrove();
    this.buildSyene();
    this.buildAlexandria();
    this.buildChina();
    this.buildRhodes();
    this.journal = journalPage(); this.journal.visible = false; this.root.add(this.journal);
    // The "put it here" ring (shared by every set)
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.ring.rotation.x = -Math.PI / 2; this.root.add(this.ring);
    this.registerInteractables();
    this.buildLife();
    this.cur = null; this.useSet('grove');
    this.cricketT = 0; this.waveT = 2; this.windT = 1;
  }

  // ---------- Sets ----------
  addSet(name, height, bounds) {
    const g = new THREE.Group(); g.visible = false; this.root.add(g);
    const S = this.sets[name] = { g, height, bounds, blockers: [], people: [], place: null };
    return S;
  }
  useSet(name) {
    if (this.cur === name) return;
    const G = this.G;
    for (const [k, S] of Object.entries(this.sets)) S.g.visible = k === name;
    const S = this.sets[name]; this.cur = name;
    G.world.height = S.height; G.world.bounds = S.bounds; G.world.blockers = S.blockers;
    G.sky.fogFar = S.fogFar || 1100;
    if (S.place) G.sky.setPlace(S.place);   // the real stars for that place and year
    G.sky.hideMoon();
    for (const [k, v] of Object.entries(this.local)) if (v) { this.local[k] = null; }
  }
  // ---------- Life in each place: citizens of Athens, villagers at the well in Syene, people and
  // gulls in Alexandria ----------
  buildLife() {
    this.torches = [];
    // Background people: every one a different person (one of Meem's models, in clothes of the place)
    const extra = (S, model, pos, faceTo, clothes = {}, look = {}) => {
      const P = this.person(S, model, pos, faceTo, look); P.extra = true; P.glance = true; dress(P, clothes); return P;
    };
    // Athens: citizens gathered by the temple: voting with raised hands, and thinkers arguing in pairs
    const A = this.sets.grove;
    const spk = new THREE.Vector3(-13, 0, -12.5);
    this.orator = extra(A, 'eratosthenes', spk, new THREE.Vector3(-6, 0, -6), { hue: 0.9, sat: 0.7, val: 0.9, hair: 0x4a3a2a });
    this.voters = [];
    const VOTERS = [['instrument_maker', { mul: 0xe8e0d0 }], ['sailor', { hue: 0.95, sat: 0.6, val: 0.85 }], ['builder', { hue: 0.1, sat: 0.5, val: 1.2 }], ['skywatcher', { mul: 0xe0d8c8, sat: 0.5, hair: 0x5a5048 }]];
    for (let i = 0; i < 4; i++) {
      const a = -0.75 + i * 0.5, p = new THREE.Vector3(spk.x + Math.sin(a) * 3.2 + 2.2, 0, spk.z + Math.cos(a) * 3.2 + 1.2);
      const P = extra(A, VOTERS[i][0], p, spk, VOTERS[i][1]); P.voter = true; this.voters.push(P);
      if (i % 3 === 0) { const tc = makeTorch(); holdProp(P, tc, 'Left', [0, 0.04, 0.03]); this.torches.push(tc); }
    }
    // two pairs arguing: a visiting Egyptian priest with an old woman, and two young students
    const SPOTS = [[-6.5, -7.2], [-7.6, -6.4], [4.5, -9], [5.6, -8.2]];
    const THINKERS = [['priest', { mul: 0xf0ece0 }], ['storyteller', { mul: 0xc8b8a0, sat: 0.5 }], ['architect', { mul: 0xe0d8c8, sat: 0.6 }], ['villager', { mul: 0xb8b0c8 }]];
    this.thinkers = SPOTS.map(([x, z], i) => {
      const other = SPOTS[i % 2 ? i - 1 : i + 1];
      const P = extra(A, THINKERS[i][0], new THREE.Vector3(x, 0, z), new THREE.Vector3(other[0], 0, other[1]), THINKERS[i][1]); P.thinker = true; return P;
    });
    { const tc = makeTorch(); holdProp(this.thinkers[2], tc, 'Left', [0, 0.04, 0.03]); this.torches.push(tc); }
    // Syene: a villager drawing water at the well, donkeys and goats, kites circling high in the heat
    const Sy = this.sets.syene, W = this.wellPos;
    this.drawer = extra(Sy, 'villager', new THREE.Vector3(W.x - 1.6, 0, W.z - 0.15), W);
    this.sLife = new Life(Sy.g);
    this.sLife.add(makeHerd('donkey', { n: 2, area: { x: W.x - 8, z: W.z - 6, r: 4 }, height: Sy.height, seed: 51 }));
    this.sLife.add(makeHerd('goat', { n: 5, area: { x: W.x + 7, z: W.z - 9, r: 5 }, height: Sy.height, seed: 52 }));
    this.sLife.add(makeFlock({ n: 5, center: new THREE.Vector3(W.x, 45, W.z - 20), r: 30, height: 10, color: 0x4a3a2a, size: 1.8, speed: 5, seed: 53 }));
    // Alexandria: people crossing the square, gulls overhead
    const Al = this.sets.alex;
    this.strollers = [[-8, -10], [7, -12], [-5, 6], [9, 4]].map(([x, z], i) => {
      const P = extra(Al, ['priest', 'sailor', 'architect', 'instrument_maker'][i], new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 0, 0), [{}, { hue: 0.5, sat: 0.6 }, { mul: 0xd8d0c0 }, { mul: 0xc0b098, sat: 0.7 }][i]);
      P.routine = [{ x, z, pose: i % 2 ? 'talk' : 'idle', secs: 3 + i }, { x: -x * 0.9, z: z + (i % 2 ? 5 : -5), pose: 'idle', secs: 2 + i }]; P.ri = i % 2;
      return P;
    });
    this.aLife = new Life(Al.g);
    this.aLife.add(makeFlock({ n: 10, center: new THREE.Vector3(0, 22, -15), r: 22, height: 6, color: 0xeeeeee, size: 1.1, speed: 6, seed: 54 }));
    // (China: the astronomer writes the comet down himself, at his table with the inkstone and brush)
  }

  // What the background people are doing right now
  lifePose(P, dt, t) {
    const s = this.s, S = this.sets[this.cur];
    if (P.voter) P.pose = s.vote ? (P.phase % 5 < 3.6 ? 'wave' : 'idle') : 'idle';
    else if (P === this.orator) P.pose = s.vote || s.phase === 'arrive' ? 'talk' : 'idle';
    else if (P.thinker) P.pose = s.think || P.phase % 2 < 1 ? 'talk' : 'idle';
    else if (P === this.drawer) P.pose = 'work';
    else if (P.routine) runRoutine(P, dt, { height: S.height, speed: 0.9 });
    if (s.cheer && !P.routine) P.pose = 'cheer';
    if (s.phase === 'eclipse' && this.cur === 'grove') { P.pose = P.phase % 3 < 1 ? 'point' : 'idle'; dirFromAzEl(MOON_AZ, MOON_EL, P.pointAt).multiplyScalar(50).add(P.g.position); P.look = P.pointAt.clone(); }
  }

  person(S, model, pos, faceTo, look = {}) {
    const P = makePerson({ model, seed: 70 + S.people.length * 9, ...look });
    P.g.position.copy(pos); P.g.position.y = S.height(pos.x, pos.z);
    P.g.rotation.y = face(pos, faceTo); P.home = P.g.position.clone();
    S.g.add(P.g); S.people.push(P);
    P.blk = { x: pos.x, z: pos.z, r: 0.35 }; S.blockers.push(P.blk);
    return P;
  }

  // --- Athens: an olive grove on a hill above the sea, at night ---
  buildGrove() {
    // The temple of Hephaestus stands on a low terrace to the west-north-west, its front to the east
    const TC = this.templeAt = new THREE.Vector3(-40, 0, -21), TL = 31.8, TW = 13.7, TERR = 0.9;
    const H0 = (x, z) => {
      let h = (N1(x / 40, z / 40) - 0.5) * 1.5 * clamp((Math.hypot(x, z) - 12) / 30, 0, 1);
      // down to the sea in the south; the city climbs gently away from us to the north and west,
      // so its roofs rise in tiers toward the Acropolis
      if (z > 22) h -= Math.min(30, (z - 22) * 0.16 + Math.pow(Math.max(0, z - 60) / 60, 2) * 4);
      h += clamp((20 - z) / 40, 0, 1) * Math.max(0, Math.hypot(x, z) - 45) * 0.06;
      if (z < -230) h += (-z - 230) * 0.08 * (0.6 + N2(x / 60, z / 60));                            // hills to the north
      return h;
    };
    const H = (x, z) => {
      const d = Math.max(Math.abs(x - TC.x) - TL / 2 - 7, Math.abs(z - TC.z) - TW / 2 - 6);   // outside the terrace (m)
      const k = clamp(d / 12, 0, 1), kk = k * k * (3 - 2 * k);
      return lerp(TERR, H0(x, z), kk);
    };
    const S = this.addSet('grove', H, 60); S.fogFar = 1400; S.place = { lat: 38, year: -350, sunLon: 90 };
    const g = S.g;
    const dry = new THREE.Color(0x6a6a44), dry2 = new THREE.Color(0x8a7a50), soil = new THREE.Color(0x7a5e40);
    g.add(buildGround(1100, 150, H, (x, y, z, c) => {
      c.copy(dry).lerp(dry2, N2(x / 9, z / 9)); if (N3(x / 5, z / 5) > 0.62) c.lerp(soil, 0.6);
      if (y < -24) c.lerp(_col.setHex(0x9a8a6a), 0.7); // rocky shore
      // the paved terrace round the temple, and the path up to it
      const tx = Math.abs(x - TC.x) - TL / 2 - 6, tz = Math.abs(z - TC.z) - TW / 2 - 5;
      if (Math.max(tx, tz) < 0) c.setHex(((Math.floor(x / 1.4) + Math.floor(z / 1.4)) & 1) ? 0xa89e86 : 0x9a907a);
      const pz = TC.z + (x - TC.x - TL / 2) * ((0 - TC.z) / (-TC.x - TL / 2)), onPath = x > TC.x + TL / 2 && x < 0 && Math.abs(z - pz) < 1.6;
      if (onPath) c.setHex(0x9a8e74);
    }));
    // The sea, reaching to the horizon
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x1a2a48 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -29; g.add(sea);
    // Moonlight glittering on the water toward the Moon
    const glit = new THREE.Mesh(new THREE.PlaneGeometry(26, 900), new THREE.MeshBasicMaterial({ map: canvasTex(64, 256, (c, w, h) => {
      for (let i = 0; i < 600; i++) { const y = Math.random() * h, a = 0.15 + 0.6 * (y / h); c.fillStyle = `rgba(220,225,255,${a * Math.random()})`; c.fillRect(Math.random() * w, y, 3 + Math.random() * 8, 1.5); }
    }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    glit.rotation.x = -Math.PI / 2; glit.rotation.z = -MOON_AZ * D2R + Math.PI;
    at(MOON_AZ, 520, -28.9, glit.position); g.add(glit); this.glitter = glit;

    // Olive trees all around (but not in the way of the sea view or the lamp table)
    const trunks = [], leaves = null, r = rng(5);
    for (let i = 0; i < 90; i++) {
      const a = r() * 360, d = 7 + r() * 36, p = at(a, d);
      if ((a > 120 && a < 210 && d < 40) || Math.hypot(p.x, p.z + 4) < 6) continue;
      if ((a > 235 || a < 40) && d > 16) continue;   // keep the view over the city open
      if (Math.abs(p.x - TC.x) < TL / 2 + 9 && Math.abs(p.z - TC.z) < TW / 2 + 8) continue;
      if (p.x > TC.x && p.x < 2 && Math.abs(p.z - TC.z * (1 - (p.x - TC.x) / -TC.x)) < 5) continue;
      olive(trunks, leaves, p.x, H(p.x, p.z), p.z, 0.85 + r() * 0.4, 100 + i);
      S.blockers.push({ x: p.x, z: p.z, r: 0.5 });
    }
    // The farmhouse: whitewashed wall facing south, where the lamp throws its shadows
    const k = new Kit();
    this.wallZ = -5.2;
    k.box(6, 2.6, 0.5, 0xe2d8c2, [0, 1.3, this.wallZ - 0.26]);
    k.box(6.6, 0.25, 3.6, 0xa0583a, [0, 2.75, this.wallZ - 1.6], [0.18, 0, 0]);   // tiled roof
    k.box(0.5, 2.6, 3.2, 0xd8ccb2, [-3.05, 1.3, this.wallZ - 1.8]); k.box(0.5, 2.6, 3.2, 0xd8ccb2, [3.05, 1.3, this.wallZ - 1.8]);
    k.box(0.9, 1.9, 0.08, 0x5a3a22, [2.3, 0.95, this.wallZ - 0.02]);   // door
    S.blockers.push({ x: -2, z: this.wallZ - 1, r: 1.3 }, { x: 0, z: this.wallZ - 1, r: 1.3 }, { x: 2, z: this.wallZ - 1, r: 1.3 });
    // The table with its lamp
    this.tableY = 0.92;
    k.box(1.1, 0.06, 0.65, 0x7a5432, [0.1, this.tableY - 0.03, -3.4]);
    for (const [x, z] of [[-0.38, -3.65], [0.58, -3.65], [-0.38, -3.15], [0.58, -3.15]]) k.box(0.06, this.tableY - 0.06, 0.06, 0x6a4628, [x, (this.tableY - 0.06) / 2, z]);
    S.blockers.push({ x: 0.1, z: -3.4, r: 0.45 });
    // a clay oil lamp on a tall bronze lampstand beside the table
    const LX = 0.62, LZ = -3.05, LY = 1.22;
    this.lampPos = new THREE.Vector3(LX, LY + 0.06, LZ);
    k.cyl(0.015, 0.02, LY - 0.03, 6, 0x6a5030, [LX, (LY - 0.03) / 2, LZ]); k.cyl(0.14, 0.16, 0.03, 8, 0x6a5030, [LX, 0.015, LZ]); k.cyl(0.07, 0.04, 0.03, 8, 0x6a5030, [LX, LY - 0.02, LZ]);
    const FP = PROPS.fresh();   // Meem's clay oil lamp on the stand; jars, a table and stool along the wall
    if (!FP.add('oil_lamp', LX, LY - 0.005, LZ, 0)) { k.ball(0.06, 1, 0xa0603a, [LX, LY + 0.02, LZ], 0, [1.2, 0.5, 0.9]); k.cyl(0.018, 0.022, 0.05, 6, 0x8a5030, [LX - 0.06, LY + 0.04, LZ], [0, 0, -1.1]); }
    // (jars to the right of the lamp, out of the shadows' way; the table round the east side of the house)
    FP.add('amphora', 1.05, 0, this.wallZ + 0.35, 2); FP.add('amphora', 1.5, 0, this.wallZ + 0.4, 1); FP.add('amphora', 3.75, 0, this.wallZ - 0.3, 0.4);
    if (FP.add('table_stool', 4.1, 0, this.wallZ - 1.7, -Math.PI / 2)) S.blockers.push({ x: 4.1, z: this.wallZ - 1.7, r: 0.9 });
    this.farmProps = FP.build();
    S.blockers.push({ x: LX, z: LZ, r: 0.12 });
    // a low dry-stone terrace wall and a few big jars
    for (let i = 0; i < 26; i++) { const x = -14 + i * 1.1; k.box(1.1, 0.5 + r() * 0.2, 0.6, 0x8a8068, [x, 0.25 + H(x, 9) * 0.9, 9 + Math.sin(i) * 0.3], [0, r() * 0.2, 0]); }
    for (const [x, z] of [[-1.6, -4.6], [-2.2, -4.4]]) k.cyl(0.25, 0.18, 0.8, 10, 0xa86a40, [x, 0.4, z]), k.ball(0.3, 1, 0xa86a40, [x, 0.75, z], 0, [1, 0.8, 1]);
    // ---- The temple ----
    const T = doricTemple();
    T.geo.translate(TC.x, TERR - 0.05, TC.z);
    // marble glows faintly in the moonlight (a touch of its own light so it never goes muddy)
    const marbleMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x2a241a });
    this.temple = new THREE.Mesh(T.geo, marbleMat); g.add(this.temple);
    for (const [x, z] of T.columns) S.blockers.push({ x: TC.x + x, z: TC.z + z, r: 0.6 });
    for (let x = T.cella.x0; x <= T.cella.door; x += 1.6) for (let z = -T.cella.w / 2 + 1; z <= T.cella.w / 2 - 1; z += 1.6) S.blockers.push({ x: TC.x + x, z: TC.z + z, r: 1.0 });
    const front = this.templeFront = new THREE.Vector3(TC.x + TL / 2, TERR, TC.z);
    // the altar out in front of the steps, where offerings burned, and two bronze fire bowls on tripods
    k.box(3.2, 1.2, 1.6, 0xd8ceb6, [front.x + 9, TERR + 0.6, TC.z]); k.box(3.5, 0.15, 1.9, 0xe8e0cc, [front.x + 9, TERR + 1.25, TC.z]);
    S.blockers.push({ x: front.x + 9, z: TC.z - 0.8, r: 1.1 }, { x: front.x + 9, z: TC.z + 0.8, r: 1.1 });
    this.fires = [];
    const bowl = (x, z, y) => {
      for (let i = 0; i < 3; i++) { const a = i * 2.09; k.cyl(0.03, 0.03, y, 5, 0x5a4020, [x + Math.cos(a) * 0.25, y / 2, z + Math.sin(a) * 0.25], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]); }
      k.add(new THREE.SphereGeometry(0.42, 10, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x8a6a2a, [x, y + 0.38, z]);
      this.fires.push(new THREE.Vector3(x, y + 0.55, z));
    };
    bowl(front.x + 2.2, TC.z - 5.2, TERR + 1.1); bowl(front.x + 2.2, TC.z + 5.2, TERR + 1.1);
    this.fires.push(new THREE.Vector3(front.x + 9, TERR + 1.55, TC.z));
    for (const f of this.fires.slice(0, 2)) S.blockers.push({ x: f.x, z: f.z, r: 0.5 });
    // tall dark cypresses framing the terrace, a few statues on plinths along the path
    const cyp = [];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1, x = TC.x - TL / 2 + (i >> 1) * 6.5 - 2, z = TC.z + side * (TW / 2 + 7.5 + r() * 2);
      cyp.push({ x, y: H(x, z) - 0.1, z, s: (10 + r() * 4) / 11 });
      S.blockers.push({ x, z, r: 0.8 });
    }
    for (let i = 0; i < 3; i++) {
      const t = 0.3 + i * 0.22, x = lerp(front.x + 12, -3, t), z = lerp(TC.z, 0, t) + 3.2;
      const y = H(x, z);
      k.box(0.9, 1.1, 0.9, 0xd8ceb6, [x, y + 0.55, z]);
      // a marble figure (a herm-like statue): body, head, arm
      k.cyl(0.2, 0.26, 1.3, 8, 0xeee6d2, [x, y + 1.75, z]); k.ball(0.15, 1, 0xeee6d2, [x, y + 2.55, z]);
      k.cyl(0.06, 0.06, 0.6, 5, 0xeee6d2, [x + 0.25, y + 2.0, z], [0, 0, 0.6]);
      S.blockers.push({ x, z, r: 0.7 });
    }
    g.add(k.mesh(), this.farmProps, grove(cypressTree, cyp, { detail: 'high', height: 11, seed: 5, variants: 5 }).group);
    const nearOl = trunks.filter((p) => Math.hypot(p.x, p.z) < 18), farOl = trunks.filter((p) => Math.hypot(p.x, p.z) >= 18);
    if (nearOl.length) g.add(grove(oliveTree, nearOl, { detail: 'high', height: 4.6, seed: 7, variants: 5 }).group);
    if (farOl.length) g.add(grove(oliveTree, farOl, { detail: 'mid', height: 4.6, seed: 9, variants: 5 }).group);
    // firelight on the temple front: one warm light for the bowls and the altar, plus the flames
    this.templeLight = new THREE.PointLight(0xff9a50, 30, 34, 1.4); this.templeLight.position.set(front.x + 5, TERR + 3.2, TC.z); g.add(this.templeLight);
    const fm = glowMat('rgba(255,170,70,1)');
    this.fireSprites = this.fires.map((f, i) => { const sp = new THREE.Sprite(fm); sp.position.copy(f); sp.scale.setScalar(i === 2 ? 1.8 : 1.3); g.add(sp); return sp; });
    // a soft warm glow inside the open door (lamps burning by the statue of the god)
    const dg = new THREE.Sprite(glowMat('rgba(255,180,90,1)', 0.7)); dg.position.set(TC.x + T.cella.door - 1.5, TERR + T.base + 2.5, TC.z); dg.scale.set(4, 5, 1); g.add(dg);
    // The city itself: walls and gate, the Long Wall to the sea, houses, the Agora, the Acropolis
    const city = buildAthens({ H, temple: doricTemple, colonnade, avoid: (x, z) => Math.abs(x - TC.x) < TL / 2 + 12 && Math.abs(z - TC.z) < TW / 2 + 12 });
    g.add(city.group); S.blockers.push(...city.blockers);
    this.cityLights = city.torches; this.windowLights = city.windows;
    this.acropolis = city.acropolis;
    g.add(tufts(4500, 9, (r2, p) => { at(r2() * 360, 2 + Math.pow(r2(), 1.4) * 50, 0, p); p.y = H(p.x, p.z); }, 0x5a6034, 0x9a8a58));

    // The lamp's light: a warm point light, the flame, and its glow on the wall
    this.lampLight = new THREE.PointLight(0xffa860, 2.2, 9, 1.6); this.lampLight.position.copy(this.lampPos).y += 0.06; g.add(this.lampLight);
    this.flame = new THREE.Sprite(glowMat('rgba(255,200,110,1)')); this.flame.scale.setScalar(0.22); this.flame.position.copy(this.lampLight.position); g.add(this.flame);
    const wg = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.5), new THREE.MeshBasicMaterial({ map: canvasTex(256, 128, (c, w, h) => {
      const gr = c.createRadialGradient(w * 0.57, h * 0.55, 0, w * 0.57, h * 0.55, w * 0.55); gr.addColorStop(0, 'rgba(255,170,90,0.55)'); gr.addColorStop(1, 'rgba(255,150,70,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    wg.position.set(0, 1.25, this.wallZ + 0.01); g.add(wg);
    // A cool light from the Moon
    this.moonLight = new THREE.DirectionalLight(0xa8b8ff, 0.55); dirFromAzEl(MOON_AZ, MOON_EL, this.moonLight.position).multiplyScalar(50);
    g.add(this.moonLight, this.moonLight.target);

    // The plate and the ball, resting on the table in front of the lamp
    const pk = new Kit(); pk.cyl(0.09, 0.082, 0.012, 20, 0xc87a48, [0, 0, 0]); pk.cyl(0.06, 0.06, 0.014, 20, 0xe0a070, [0, 0.001, 0]);
    this.plate = pk.mesh(); this.plate.userData.home = [0.05, this.tableY + 0.01, -3.25, 0, 0, 0, 1]; g.add(this.plate);
    const bk = new Kit(); bk.ball(0.06, 2, 0x4a7ac0, [0, 0, 0]); bk.ball(0.061, 1, 0xe8d890, [0, 0, 0], 0, [1, 0.25, 1]);
    this.ball = bk.mesh(); this.ball.userData.home = [-0.25, this.tableY + 0.06, -3.25, 0, 0, 0, 1]; g.add(this.ball);
    // Their shadows on the wall (flattened copies, squashed onto the wall from the lamp's point of view)
    const shM = new THREE.MeshBasicMaterial({ color: 0x3a2414 });
    shM.polygonOffset = true; shM.polygonOffsetFactor = -2;
    this.shadows = [this.plate, this.ball].map((o) => { const m = new THREE.Mesh(o.geometry, shM); m.matrixAutoUpdate = false; m.renderOrder = 2; g.add(m); return m; });
    // Planar projection matrix: from the lamp onto the wall's plane (z = wallZ + 0.02)
    const L = this.lampPos, P = [0, 0, 1, -(this.wallZ + 0.02)], d = P[0] * L.x + P[1] * L.y + P[2] * L.z + P[3];
    const l = [L.x, L.y, L.z, 1];
    this.shadowM = new THREE.Matrix4().set(
      d - l[0] * P[0], -l[0] * P[1], -l[0] * P[2], -l[0] * P[3],
      -l[1] * P[0], d - l[1] * P[1], -l[1] * P[2], -l[1] * P[3],
      -l[2] * P[0], -l[2] * P[1], d - l[2] * P[2], -l[2] * P[3],
      -l[3] * P[0], -l[3] * P[1], -l[3] * P[2], d - l[3] * P[3]);

    // The ship far out at sea
    const sp = PROPS.fresh();
    if (sp.add('ship_ancient', 0, -0.8, 0, 0)) this.ship = sp.build();   // Meem's Greek merchant ship
    else {
      const sk = new Kit();
      sk.box(3, 1.6, 12, 0x5a3a22, [0, 0.4, 0]); sk.box(2.4, 0.3, 11, 0x7a5432, [0, 1.25, 0]);
      sk.cyl(0.15, 0.18, 10, 6, 0x5a3a22, [0, 6, 0]); sk.box(7, 6, 0.1, 0xe8dcc0, [0, 7, 0.3]);
      this.ship = sk.mesh();
    }
    g.add(this.ship);
    this.shipLamp = new THREE.Sprite(glowMat('rgba(255,190,110,1)')); this.shipLamp.scale.setScalar(5); g.add(this.shipLamp);

    // The Moon (our own, so we can draw Earth's shadow on it)
    this.moonMat = new THREE.ShaderMaterial({
      uniforms: { shadowC: { value: new THREE.Vector2(-3.8, 0.6) }, shadowR: { value: 2.6 }, guide: { value: 0 }, glow: { value: 1 }, moonMap: { value: moonFaceTexture() } },
      vertexShader: MOON_VS, fragmentShader: MOON_FS, transparent: true, depthWrite: false, fog: false,
    });
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.moonMat); this.moon.renderOrder = -5;
    const MR = 26; this.moon.scale.setScalar(MR * 6); // Moon radius 26 m at 600 m: about 5° across, a bit bigger than life
    dirFromAzEl(MOON_AZ, MOON_EL, this.moon.position).multiplyScalar(600);
    g.add(this.moon);

    // Aristotle, by the table
    this.aristotle = this.person(S, 'aristotle', new THREE.Vector3(1.4, 0, -3.1), new THREE.Vector3(0, 0, -1.5));
    S.start = { pos: new THREE.Vector3(0, 0, 0.5), look: new THREE.Vector3(TC.x + TL / 2, 0, TC.z) };
    S.lampSpot = { pos: new THREE.Vector3(0.05, 0, -2.75), look: new THREE.Vector3(0.05, 0, -6) };
  }

  // --- Syene: noon in the desert by the Nile, the Sun straight overhead, a deep well ---
  buildSyene() {
    const W = this.wellPos = new THREE.Vector3(0, 0, -3);
    const H = (x, z) => {
      const r = Math.hypot(x, z);
      let h = (N1(x / 30 + 9, z / 30) - 0.5) * 3 * clamp((r - 14) / 40, 0, 1);
      if (x < -30) h += (-x - 30) * 0.08 * (0.5 + N2(x / 50, z / 50));  // rocky desert hills to the west
      if (x > 34 && x < 70) h -= clamp(1 - Math.abs(x - 52) / 18, 0, 1) * 1.6; // the Nile's banks
      return h;
    };
    const S = this.addSet('syene', H, 45); S.fogFar = 1800; S.place = { lat: 24.1, year: -240, sunLon: 90 };
    const sand = new THREE.Color(0xd8b87a), sand2 = new THREE.Color(0xc89a5a), green = new THREE.Color(0x6a8a3a);
    S.g.add(buildGround(1200, 150, H, (x, y, z, c) => {
      c.copy(sand).lerp(sand2, N2(x / 14, z / 14));
      if (x > 26 && x < 78) c.lerp(green, clamp(1 - Math.abs(x - 52) / 26, 0, 1) * 0.85);  // fields along the river
    }, (x, z) => Math.hypot(x - W.x, z - W.z) < 0.8));
    // The Nile
    const river = new THREE.Mesh(new THREE.PlaneGeometry(26, 2400), new THREE.MeshLambertMaterial({ color: 0x3a6a8a })); river.rotation.x = -Math.PI / 2; river.position.set(52, -0.9, 0); S.g.add(river);
    const k = new Kit(), r = rng(17);
    // The well: a waist-high round wall of dressed sandstone blocks in staggered courses, a
    // capstone rim, a stone-lined shaft going down to the water, and a stone frame with a pulley
    this.buildWell(S.g, k, W);
    S.blockers.push({ x: W.x, z: W.z, r: 1.3 }, { x: W.x - 1.9, z: W.z + 1.5, r: 0.7 });
    // Mud-brick houses, palms along the river, rocks
    k.P = PROPS.fresh();
    for (let i = 0; i < 16; i++) {
      const x = 12 + r() * 16, z = -40 + i * 5 + r() * 2;
      house(k, x, z, 4 + r() * 2, 4 + r() * 2, 2.6 + r() * 0.8, (r() - 0.5) * 0.3 - Math.PI / 2, 0xb89068, H(x, z)); S.blockers.push({ x, z, r: 2.6 });
    }
    for (let i = 0; i < 40; i++) { const x = 32 + r() * 36, z = -120 + r() * 240; if (Math.abs(x - 52) < 14) continue; palm(k, x, H(x, z), z, 6 + r() * 4, 300 + i); }
    for (let i = 0; i < 6; i++) { const x = -8 + r() * 6, z = -14 + r() * 24; palm(k, x, H(x, z), z, 6 + r() * 3, 400 + i); S.blockers.push({ x, z, r: 0.4 }); }
    for (let i = 0; i < 30; i++) { const a = r() * 360, d = 8 + r() * 60, p = at(a, d); k.ball(0.3 + r() * 0.8, 0, 0x9a7650, [p.x, H(p.x, p.z), p.z], [r(), r(), r()], [1.3, 0.6, 1]); }
    // a few boats with triangular sails on the Nile
    for (let i = 0; i < 3; i++) {
      const z = -60 + i * 50;
      if (k.P.add('ship_ancient', 52, -1.2, z, 0.2 * i, { s: 0.5 })) continue;
      k.box(1.4, 0.5, 6, 0x6a4a2a, [52, -0.7, z]); k.cyl(0.06, 0.06, 6, 5, 0x5a3a22, [52, 2.3, z]); k.add(new THREE.CircleGeometry(2.4, 3), 0xe8dcc0, [52.05, 3, z], [0, Math.PI / 2, 0]);
    }
    S.g.add(k.mesh(), k.P.build()); addPalms(S.g, k);
    S.g.add(tufts(900, 23, (r2, p) => { at(r2() * 360, 4 + Math.pow(r2(), 1.2) * 60, 0, p); p.y = H(p.x, p.z); }, 0x8a8a4a, 0xb8a060, 0.22));
    this.stickS = this.makeStick(S.g); this.stickS.userData.home = [W.x + 1.6, 0.04, W.z + 1.4, ...new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0.4)).toArray()];
    this.ringS = [W.x + 1.5, W.z - 0.2];
    S.start = { pos: new THREE.Vector3(1.6, 0, 1.3), look: W };
  }

  buildWell(g, k, W) {
    const RI = 0.77, RO = 1.08, CH = 0.17, NC = 5, NB = 14, SAND = [0xc8a878, 0xb89868, 0xd2b286, 0xae8e60, 0xc0a070];
    const r = rng(29);
    // the mortar behind the blocks (a solid ring, so there are never any gaps to see through)
    k.add(new THREE.CylinderGeometry(RO - 0.03, RO - 0.03, NC * CH, 28, 1, true), 0x7a6448, [W.x, NC * CH / 2, W.z]);
    // the blocks: curved slabs, each a little different
    for (let c = 0; c < NC; c++) for (let b = 0; b < NB; b++) {
      const a0 = ((b + (c % 2) * 0.5) / NB) * Math.PI * 2 + 0.012, a1 = a0 + (Math.PI * 2) / NB - 0.024;
      const ro = RO + (r() - 0.5) * 0.02, sh = new THREE.Shape();
      sh.absarc(0, 0, ro, a0, a1, false); sh.absarc(0, 0, RI, a1, a0, true);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: CH - 0.018, curveSegments: 3, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      k.add(geo, SAND[(r() * SAND.length) | 0], [W.x, c * CH + 0.02, W.z], 0, 1, 0.9 + r() * 0.15);
    }
    // the capstone rim, rounded on top, slightly overhanging both sides
    const top = NC * CH;
    const prof = [[RI - 0.05, top], [RI - 0.06, top + 0.06], [RI - 0.02, top + 0.11], [RO + 0.02, top + 0.11], [RO + 0.07, top + 0.06], [RO + 0.06, top]].map(([x, y]) => new THREE.Vector2(x, y));
    prof.push(prof[0].clone());
    k.add(new THREE.LatheGeometry(prof, 32), 0xdcc092, [W.x, 0, W.z]);
    // a low stone step all round the foot of the well
    const step = [[RO - 0.05, -0.05], [RO + 0.26, -0.05], [RO + 0.26, 0.09], [RO + 0.22, 0.13], [RO - 0.05, 0.13]].map(([x, y]) => new THREE.Vector2(x, y));
    step.push(step[0].clone());
    k.add(new THREE.LatheGeometry(step, 32), 0x9a8060, [W.x, 0, W.z]);
    this.wellTop = top + 0.11;
    // two square stone pillars on the rim carry a wooden beam with a pulley wheel
    const PT = top + 0.11, PH = 1.55;
    for (const sx of [-1, 1]) {
      const x = W.x + sx * (RI + RO) / 2;
      k.box(0.26, PH, 0.26, 0xc8a878, [x, PT + PH / 2, W.z]);
      k.box(0.34, 0.1, 0.34, 0xdcc092, [x, PT + PH + 0.05, W.z]);
    }
    const BY = PT + PH + 0.17;
    k.cyl(0.075, 0.075, 2.3, 8, 0x6a4a2a, [W.x, BY, W.z], [0, 0, Math.PI / 2]);
    k.box(0.05, 0.22, 0.05, 0x5a3a22, [W.x - 0.06, BY - 0.13, W.z]); k.box(0.05, 0.22, 0.05, 0x5a3a22, [W.x + 0.06, BY - 0.13, W.z]);
    k.cyl(0.17, 0.17, 0.07, 14, 0x7a5432, [W.x, BY - 0.27, W.z], [0, 0, Math.PI / 2]);
    k.cyl(0.03, 0.03, 0.16, 6, 0x4a3020, [W.x, BY - 0.27, W.z], [0, 0, Math.PI / 2]);
    // the rope runs over the wheel to a bucket resting on the rim, nearest us
    const bucket = new THREE.Vector3(W.x + 0.3, PT, W.z + (RI + RO) / 2 - 0.02);
    k.tube([[W.x, BY - 0.27, W.z + 0.17], [W.x + 0.1, BY - 0.9, W.z + 0.5], [bucket.x, PT + 0.5, bucket.z]], 0.012, 0xb8a070, 4);
    k.cyl(0.15, 0.12, 0.26, 10, 0x7a5432, [bucket.x, PT + 0.13, bucket.z]);
    k.cyl(0.155, 0.155, 0.03, 10, 0x4a3020, [bucket.x, PT + 0.22, bucket.z]); k.cyl(0.13, 0.13, 0.03, 10, 0x4a3020, [bucket.x, PT + 0.05, bucket.z]);
    k.add(new THREE.TorusGeometry(0.13, 0.008, 4, 10, Math.PI), 0x4a3020, [bucket.x, PT + 0.26, bucket.z]);
    // a stone water trough and two tall water jars beside the well
    k.box(1.3, 0.5, 0.6, 0xb09070, [W.x - 1.9, 0.25, W.z + 1.5], [0, 0.5, 0]);
    k.box(1.12, 0.04, 0.44, 0x2a4a5a, [W.x - 1.9, 0.48, W.z + 1.5], [0, 0.5, 0]);
    for (const [dx, dz] of [[-1.55, -1.3], [-1.85, -0.95]]) {
      k.cyl(0.2, 0.14, 0.6, 10, 0xa86a40, [W.x + dx, 0.3, W.z + dz]); k.ball(0.24, 1, 0xa86a40, [W.x + dx, 0.62, W.z + dz], 0, [1, 0.85, 1]);
      k.cyl(0.09, 0.11, 0.16, 8, 0xa86a40, [W.x + dx, 0.86, W.z + dz]);
    }
    // inside: the shaft, lined with stone courses, getting darker the deeper you look
    const sh = new THREE.CylinderGeometry(RI + 0.005, RI + 0.005, 8.2, 18, 36, true).toNonIndexed(), sp = sh.attributes.position, sc = new Float32Array(sp.count * 3);
    for (let i = 0; i < sp.count; i += 3) {
      let cy = 0, ca = 0;
      for (let j = 0; j < 3; j++) { cy += sp.getY(i + j) / 3; ca += Math.atan2(sp.getZ(i + j), sp.getX(i + j)) / 3; }
      const row = Math.floor((cy + 4.1) / 0.228), col = Math.floor(((ca + Math.PI) / (Math.PI * 2)) * 9 + (row % 2) * 0.5);
      const t = (cy + 4.1) / 8.2, hsh = Math.abs(Math.sin(row * 12.9898 + col * 78.233) * 43758.5) % 1;
      _col.setHex(SAND[(hsh * SAND.length) | 0]).multiplyScalar((0.12 + 0.88 * t * t) * 0.75);
      for (let j = 0; j < 3; j++) sc.set([_col.r, _col.g, _col.b], (i + j) * 3);
    }
    sh.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const sm = new THREE.Mesh(sh, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })); sm.position.set(W.x, -4.1 + 0.02, W.z); g.add(sm);
    const water = new THREE.Mesh(new THREE.CircleGeometry(RI, 24), new THREE.MeshBasicMaterial({ color: 0x1a3040 })); water.rotation.x = -Math.PI / 2; water.position.set(W.x, -7.9, W.z); g.add(water);
    this.glintSpr = new THREE.Sprite(glowMat('rgba(255,250,225,1)')); this.glintSpr.position.set(W.x, -7.85, W.z); this.glintSpr.scale.setScalar(1.1); g.add(this.glintSpr);
  }

  makeStick(parent) {
    const k = new Kit(); k.cyl(0.025, 0.03, STICK_H, 8, 0x7a5432, [0, STICK_H / 2, 0]); k.cyl(0.04, 0.04, 0.03, 8, 0x5a3a22, [0, STICK_H, 0]);
    const m = k.mesh(); parent.add(m);
    // its shadow on the ground: a thin dark strip that points away from the Sun
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 1).translate(0, 0.5, 0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x2a1a0a, transparent: true, opacity: 0.6, depthWrite: false }));
    sh.renderOrder = 1; parent.add(sh); m.userData.shadow = sh;
    return m;
  }

  // --- Alexandria: a paved square by the Library, the lighthouse out on the sea to the north ---
  buildAlexandria() {
    const H = () => 0;
    const S = this.addSet('alex', H, 28); S.fogFar = 1600; S.place = { lat: 31.2, year: -240, sunLon: 90 };
    const k = new Kit(), r = rng(41);
    const pave = new THREE.Color(0xd8c8a4), pave2 = new THREE.Color(0xc4b08a);
    S.g.add(buildGround(900, 120, (x, z) => (Math.hypot(x, z) > 140 ? -0.4 : 0), (x, y, z, c) => {
      const tile = ((Math.floor(x / 1.2) + Math.floor(z / 1.2)) & 1) ? 0.06 : 0;
      c.copy(pave).lerp(pave2, N2(x / 3, z / 3) * 0.6 + tile * 4);
      if (Math.hypot(x, z) > 60) c.lerp(_col.setHex(0xb8a070), 0.6);
    }));
    // the harbour sea, north of the city
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 2000), new THREE.MeshLambertMaterial({ color: 0x2a6a9a })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.3, -1150); S.g.add(sea);
    // The Library to the north: steps and a long colonnade
    colonnade(k, 0, -17, 0, 10, 3, 7, 0.45, 0xe8dcc4, 0xc8b894, 6);
    for (let i = 0; i < 3; i++) k.box(30, 0.2, 1.2, 0xd8ccb0, [0, 0.1 + i * 0.2 - 0.3 + 0.3, -16 + 1.2 - i * 0.4]);
    // Stoas east and west
    colonnade(k, -15, 0, Math.PI / 2, 9, 2.6, 5.5, 0.32, 0xe0d4bc, 0xb05a3a, 5, 0, false);
    colonnade(k, 15, 0, -Math.PI / 2, 9, 2.6, 5.5, 0.32, 0xe0d4bc, 0xb05a3a, 5, 0, false);
    for (let z = -12; z <= 12; z += 3) S.blockers.push({ x: -15, z, r: 0.5 }, { x: 15, z, r: 0.5 });
    for (let x = -14; x <= 14; x += 3) S.blockers.push({ x, z: -17, r: 0.6 });
    // a statue on a plinth, palms and a fountain basin in the square
    k.box(1.2, 1.4, 1.2, 0xd0c4a8, [-7, 0.7, 7]); k.cyl(0.25, 0.3, 1.6, 8, 0xc8bca0, [-7, 2.2, 7]); k.ball(0.22, 1, 0xc8bca0, [-7, 3.15, 7]);
    k.cyl(2, 2.1, 0.5, 20, 0xd8ccb0, [7, 0.25, 7]); k.cyl(1.8, 1.8, 0.05, 20, 0x5a9ab8, [7, 0.45, 7]);
    S.blockers.push({ x: -7, z: 7, r: 0.9 }, { x: 7, z: 7, r: 2.2 });
    for (const [x, z] of [[-10, -10], [10, -10], [-10, 12], [11, 12]]) { palm(k, x, 0, z, 6 + r() * 2, 500 + x); S.blockers.push({ x, z, r: 0.35 }); }
    // The city around: rows of houses, and the lighthouse (the Pharos) on its island
    k.P = PROPS.fresh();
    for (let i = 0; i < 70; i++) {
      const a = r() * 360, d = 35 + r() * 110, p = at(a, d); if (a > 330 || a < 30) continue;
      house(k, p.x, p.z, 6 + r() * 5, 6 + r() * 5, 4 + r() * 5, r() * 0.3, r() > 0.5 ? 0xe8dcc0 : 0xd0b890);
    }
    const ph = at(345, 650);
    k.box(30, 4, 30, 0xc8bca0, [ph.x, 1, ph.z]); k.box(18, 55, 18, 0xe8e0cc, [ph.x, 30, ph.z]); k.cyl(6, 8, 28, 8, 0xe8e0cc, [ph.x, 71, ph.z]);
    k.cyl(3.5, 4, 14, 12, 0xe0d8c4, [ph.x, 92, ph.z]); k.ball(3, 1, 0xd8b050, [ph.x, 101, ph.z]);
    S.g.add(k.mesh(), k.P.build()); addPalms(S.g, k);
    S.g.add(tufts(300, 31, (r2, p) => { at(r2() * 360, 20 + r2() * 40, 0, p); }, 0x8a8a4a, 0xa8a060, 0.25));
    this.stickA = this.makeStick(S.g); this.stickA.userData.home = [1.1, 0.04, -1.0, ...new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0.9)).toArray()];
    this.ringA = [0, -2.2];
    this.eratosthenes = this.person(S, 'eratosthenes', new THREE.Vector3(-1.2, 0, -3.3), new THREE.Vector3(0, 0, -2.2));
    S.start = { pos: new THREE.Vector3(2.1, 0, -1.3), look: new THREE.Vector3(0, 0, -2.4) };

    // The protractor: a half disc hanging from the stick's top, with the angle opening up on it
    const st = new THREE.Vector3(this.ringA[0], STICK_H, this.ringA[1]);
    this.protTex = canvasTex(512, 512, () => {});
    this.prot = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: this.protTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.prot.position.copy(st); this.prot.rotation.y = Math.PI / 2; this.prot.visible = false; S.g.add(this.prot);
    this.protTop = st;
    // The sun ray from the stick's top to its shadow's tip (shows while measuring)
    this.ray = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 5).translate(0, -0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffc040 }));
    this.ray.visible = false; S.g.add(this.ray);

    // The globe: Earth with Syene and Alexandria marked, and 50 slices measured out around it
    const GR = 2, gk = new Kit(), gn = noise2(77);
    const sph = new THREE.IcosahedronGeometry(GR, 4);
    const out = gk.add(sph, 0xffffff), gp = out.attributes.position, gc = out.attributes.color;
    for (let i = 0; i < gp.count; i += 3) {
      let x = 0, y = 0, z = 0; for (let j = 0; j < 3; j++) { x += gp.getX(i + j); y += gp.getY(i + j); z += gp.getZ(i + j); }
      const land = gn(x * 0.9 + 4, z * 0.9 + y * 0.6) + gn(x * 2.3, y * 2.3 + z) * 0.35;
      _col.setHex(land > 0.78 ? 0x8a7a4a : land > 0.68 ? 0x4a7a3a : 0x2a5a9a); if (Math.abs(y) > GR * 0.9) _col.setHex(0xf0f4f8);
      for (let j = 0; j < 3; j++) gc.setXYZ(i + j, _col.r, _col.g, _col.b);
    }
    this.globe = new THREE.Group(); this.globe.add(gk.mesh(FLAT));
    // the slices: 50 wedge-shaped bands around the globe's edge, facing you, revealed one by one
    const wv = [], wc = [], R1 = GR * 1.04, R2 = GR * 1.32;
    for (let i = 0; i < 50; i++) {
      const a0 = (90 + ANGLE / 2 - i * ANGLE) * D2R, a1 = a0 - ANGLE * D2R, cc = i === 0 ? [1, 0.75, 0.25] : i % 2 ? [0.95, 0.55, 0.2] : [1, 0.85, 0.4];
      const p = (a, R) => [Math.cos(a) * R, Math.sin(a) * R, 0];
      wv.push(...p(a0, R1), ...p(a1, R1), ...p(a1, R2), ...p(a0, R1), ...p(a1, R2), ...p(a0, R2));
      for (let j = 0; j < 6; j++) wc.push(...cc);
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3)); wg.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
    this.wedges = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    wg.setDrawRange(0, 6); this.globe.add(this.wedges);
    // the first slice reaching down to the centre: the 7° angle between the two cities
    const pie = new THREE.Mesh(new THREE.CircleGeometry(GR * 1.02, 6, (90 - ANGLE / 2) * D2R, ANGLE * D2R), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    pie.position.z = 0.02; this.globe.add(pie); this.pie = pie;
    // two little sticks on top: Syene (no shadow) and Alexandria
    for (const [a, nm] of [[90 - ANGLE / 2, 'Syene'], [90 + ANGLE / 2, 'Alexandria']]) {
      const st2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 5), new THREE.MeshBasicMaterial({ color: 0x5a3a1a }));
      st2.position.set(Math.cos(a * D2R) * (GR + 0.17), Math.sin(a * D2R) * (GR + 0.17), 0.05); st2.rotation.z = (a - 90) * D2R; this.globe.add(st2);
      const lb = label(nm, 2.0); lb.position.set(Math.cos(a * D2R) * (GR + 0.6) + (nm === 'Syene' ? 0.55 : -0.55), Math.sin(a * D2R) * (GR + 0.6), 0.1); this.globe.add(lb);
    }
    // parallel sunbeams coming straight down on Syene
    for (let i = -3; i <= 3; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.2, 4), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.85 }));
      const x = Math.cos((90 - ANGLE / 2) * D2R) * GR + i * 0.32; b.position.set(x, Math.sqrt(Math.max(0, GR * GR - x * x)) + 1.4, 0.05); this.globe.add(b);
    }
    this.globe.position.set(-8, 4.3, -1.6); this.globe.rotation.y = Math.PI / 2; this.globe.visible = false; S.g.add(this.globe);
    this.counter = makeCard(1100, 200, 4.2, { size: 64 }); this.counter.material.depthTest = true; this.counter.position.set(-7.2, 1.2, -1.6); this.counter.rotation.y = Math.PI / 2; this.counter.renderOrder = 5; S.g.add(this.counter);
  }

  // --- Bridge 1: a palace courtyard in China at night, a comet over the wall ---
  buildChina() {
    const H = () => 0;
    const S = this.addSet('china', H, 12); S.fogFar = 900; S.place = { lat: 34.3, year: -240, sunLon: 60 };
    const k = new Kit();
    S.g.add(buildGround(600, 60, H, (x, y, z, c) => { c.setHex(((Math.floor(x) + Math.floor(z)) & 1) ? 0x8a8478 : 0x7a7468); if (Math.hypot(x, z) > 14) c.setHex(0x4a5030); }));
    // courtyard walls with grey tile caps, a hall to the south with red pillars and a sweeping roof
    for (const [x, z, w, d] of [[0, -14, 28, 0.6], [-14, 0, 0.6, 28], [14, 0, 0.6, 28]]) { k.box(w, 3, d, 0xb8a890, [x, 1.5, z]); k.box(w + 0.6, 0.35, d + 0.6, 0x4a4a50, [x, 3.15, z]); }
    for (let i = 0; i < 8; i++) column(k, -10.5 + i * 3, 0.6, 9, 4.2, 0.28, 0xa02a1a);
    k.box(26, 0.6, 5, 0xb0a490, [0, 0.3, 10.5]); k.box(25, 4.5, 0.4, 0x8a3020, [0, 2.8, 12.6]);
    const roof = new THREE.CylinderGeometry(1, 1, 30, 4, 1); roof.rotateZ(Math.PI / 2); roof.rotateX(Math.PI / 4); roof.scale(1, 2.2, 5); k.add(roof, 0x3a3a44, [0, 6.4, 10.8]);
    k.box(31, 0.3, 1.2, 0x3a3a44, [0, 5.0, 7.6], [0.35, 0, 0]);
    // the stone table with the silk scroll, inkstone and brush
    k.box(1.3, 0.7, 0.7, 0x5a3a28, [0, 0.35, -1.3]); S.blockers.push({ x: 0, z: -1.3, r: 0.5 });
    k.box(0.12, 0.03, 0.08, 0x1a1a1a, [0.5, 0.72, -1.15]); k.cyl(0.01, 0.006, 0.22, 5, 0x6a4a2a, [0.4, 0.72, -1.05], [0, 0.5, Math.PI / 2]);
    // bronze armillary rings on a stand
    const arm = (rad, rot) => k.add(new THREE.TorusGeometry(rad, 0.02, 4, 32), 0xb08a40, [3.5, 1.6, -3], rot);
    arm(0.6, [Math.PI / 2, 0, 0]); arm(0.6, [0, 0, 0]); arm(0.55, [0.6, 0.4, 0]); k.cyl(0.06, 0.1, 1.0, 6, 0x6a5030, [3.5, 0.5, -3]);
    S.blockers.push({ x: 3.5, z: -3, r: 0.7 });
    S.g.add(k.mesh());
    // the scroll: silk, unrolled on the table; the comet paints itself on it
    this.scrollTex = canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, h); });
    this.scroll = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshLambertMaterial({ map: this.scrollTex, emissive: 0x2a2418 }));
    this.scroll.rotation.x = -Math.PI / 2; this.scroll.position.set(0, 0.705, -1.3); S.g.add(this.scroll);
    for (const x of [-0.47, 0.47]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), FLAT); rod.rotation.x = Math.PI / 2; rod.position.set(x, 0.72, -1.3); S.g.add(rod); }
    // red lanterns
    const lm = glowMat('rgba(255,90,50,1)');
    for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(lm); s.position.set(-10 + i * 4, 4.2, 8.6); s.scale.setScalar(1.3); S.g.add(s); const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd03a20 })); l.position.copy(s.position); l.scale.y = 1.3; S.g.add(l); }
    this.chinaLight = new THREE.PointLight(0xffb070, 1.5, 7, 1.5); this.chinaLight.position.set(0.8, 1.6, -0.6); S.g.add(this.chinaLight);
    // The comet: a bright head and a long soft tail, crossing the sky to the north-east
    const tailTex = canvasTex(64, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(230,240,255,0.95)'); gr.addColorStop(0.2, 'rgba(190,215,255,0.5)'); gr.addColorStop(1, 'rgba(160,190,255,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(w / 2 - 4, h); g.quadraticCurveTo(0, h * 0.3, 2, 0); g.lineTo(w - 2, 0); g.quadraticCurveTo(w, h * 0.3, w / 2 + 4, h); g.fill();
    });
    this.comet = new THREE.Group();
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(18, 110).translate(0, 55, 0), new THREE.MeshBasicMaterial({ map: tailTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    const head = new THREE.Sprite(glowMat('rgba(240,248,255,1)')); head.scale.setScalar(14);
    this.comet.add(tail, head); this.cometTail = tail; S.g.add(this.comet);
    this.astronomer = this.person(S, 'chinese_astronomer', new THREE.Vector3(-1.1, 0, -1.6), new THREE.Vector3(0, 0, 0));
    S.start = { pos: new THREE.Vector3(0, 0, -0.35), look: new THREE.Vector3(0, 0, -5) };
  }

  // --- Bridge 2: Hipparchus on a hilltop on Rhodes, sorting stars ---
  buildRhodes() {
    const H = (x, z) => -Math.pow(Math.max(0, Math.hypot(x, z) - 10), 1.3) * 0.12;
    const S = this.addSet('rhodes', H, 10); S.fogFar = 1400; S.place = { lat: 36.4, year: -130, sunLon: 180 };
    S.g.add(buildGround(1000, 110, H, (x, y, z, c) => c.setHex(0x5a5a3a).lerp(_col.setHex(0x7a6a48), N2(x / 6, z / 6))));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x14203a })); sea.rotation.x = -Math.PI / 2; sea.position.y = -60; S.g.add(sea);
    const k = new Kit(), r = rng(61);
    // a stone bench and table with scrolls, and the two baskets on stands
    k.box(1.2, 0.75, 0.6, 0x8a8070, [1.6, 0.375, -2.2]); for (let i = 0; i < 4; i++) k.cyl(0.04, 0.04, 0.35, 8, 0xe8dcc0, [1.3 + i * 0.18, 0.78, -2.2], [0, 0, Math.PI / 2 + r() * 0.3]);
    S.blockers.push({ x: 1.6, z: -2.2, r: 0.5 });
    this.baskets = [];
    for (const [x, name] of [[-0.75, 'Bright'], [0.75, 'Faint']]) {
      const pos = new THREE.Vector3(x, 0.95, -1.0);
      k.cyl(0.04, 0.05, 0.8, 6, 0x6a4a2a, [x, 0.4, -1.0]);
      const bas = new THREE.CylinderGeometry(0.24, 0.17, 0.22, 14, 2, true); k.add(bas, 0xa07a40, [x, 0.92, -1.0]); k.add(new THREE.CircleGeometry(0.17, 14).rotateX(-Math.PI / 2), 0x8a6430, [x, 0.815, -1.0]);
      k.add(new THREE.TorusGeometry(0.24, 0.02, 4, 16).rotateX(Math.PI / 2), 0x8a6430, [x, 1.03, -1.0]);
      const lb = label(name, 0.5); lb.position.set(x, 1.3, -1.0); S.g.add(lb);
      this.baskets.push(pos); S.blockers.push({ x, z: -1.0, r: 0.22 });
    }
    for (let i = 0; i < 20; i++) { const a = r() * 360, d = 4 + r() * 8, p = at(a, d); if (p.z > -4 && p.z < 1 && Math.abs(p.x) < 3) continue; k.ball(0.25 + r() * 0.5, 0, 0x7a7262, [p.x, H(p.x, p.z), p.z], [r(), r(), r()], [1.2, 0.6, 1]); }
    S.g.add(k.mesh());
    S.g.add(tufts(1200, 71, (r2, p) => { at(r2() * 360, 1.5 + r2() * 14, 0, p); p.y = H(p.x, p.z); }, 0x4a5030, 0x7a7048));
    // The stars to sort: magnitudes 1 (brightest) to 6 (faintest)
    this.mags = [4, 1, 6, 2, 5, 3];
    this.stars = this.mags.map((mag, i) => {
      const s = new THREE.Group();
      const spr = new THREE.Sprite(glowMat('rgba(255,250,235,1)', 1.05 - mag * 0.13)); spr.scale.setScalar(0.34 - mag * 0.04); s.add(spr);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035 - mag * 0.003, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 0.95).multiplyScalar(1.1 - mag * 0.14) })); s.add(core);
      const a = (-50 + i * 20) * D2R;
      s.userData.home = [Math.sin(a) * 0.85, 1.35 + (i % 2) * 0.18, -0.3 - Math.cos(a) * 0.85 + 0.2, 0, 0, 0, 1];
      S.g.add(s); return s;
    });
    // Hipparchus: the old instrument maker's model (he built his own sighting instruments), in a blue cloak
    this.hipparchus = dress(this.person(S, 'instrument_maker', new THREE.Vector3(2.4, 0, -1.5), new THREE.Vector3(0, 0, 0)), { mul: 0xb8c4d8, sat: 0.8 });
    S.start = { pos: new THREE.Vector3(0, 0, 0.6), look: new THREE.Vector3(0, 0, -3) };
  }

  // ---------- Things you can pick up ----------
  // A holdable: grip it to carry it (it follows your hand), let go to drop it. Its pose is
  // shared through the host, so friends see it move. `auto` runs on a desktop click or a
  // trigger touch, as an easy way to do the same job.
  holdable(name, mesh, { enabled, radius = 0.12, rotate = false, auto = null, hint, deskHint }) {
    const G = this.G, self = this;
    const pos = () => mesh.getWorldPosition(_c);
    const it = {
      hint, deskHint,
      get disabled() { return !enabled(); },
      reach(p) { return mesh.visible ? Math.max(0, p.distanceTo(pos()) - radius) : Infinity; },
      aim(o, d) { _a.copy(pos()).sub(o); const t = _a.dot(d); return t > 0 && _a.addScaledVector(d, -t).length() < radius + 0.08 ? t : Infinity; },
      onGrab(h) {
        if (h.desk && auto) { auto(); it.skip = true; return; }
        it.skip = false;
        const hq = h.desk ? G.camera.getWorldQuaternion(_q) : h.grip.getWorldQuaternion(_q);
        const L = { h, offQ: hq.clone().invert().multiply(mesh.getWorldQuaternion(_q2)), offP: new THREE.Vector3(), sent: 0 };
        if (!h.desk) L.offP.copy(pos()).sub(h.pos).applyQuaternion(hq.clone().invert());
        self.local[name] = L;
        G.audio.tick(pos());
      },
      onHold(h, dt) {
        const L = self.local[name]; if (!L || it.skip) return;
        L.sent -= dt; if (L.sent <= 0) { L.sent = 1 / 15; G.act({ type: 'move', o: name, p: self.poseOf(mesh) }); }
      },
      onRelease() { const L = self.local[name]; if (!L || it.skip) return; self.local[name] = null; G.act({ type: 'drop', o: name, p: self.poseOf(mesh) }); },
      onTouch() { if (auto) auto(); },
      onMouse: rotate ? (h, dx, dy) => { const L = self.local[name]; if (!L) return; L.offQ.premultiply(_q.setFromEuler(new THREE.Euler(dy * 0.01, dx * 0.01, 0))); } : undefined,
    };
    if (!rotate) delete it.onMouse;
    mesh.userData.it = it;
    return it;
  }
  poseOf(m) { m.updateWorldMatrix(true, false); return [...m.getWorldPosition(_a).toArray().map((v) => +v.toFixed(3)), ...m.getWorldQuaternion(_q).toArray().map((v) => +v.toFixed(4))]; }
  setPose(m, p) { m.position.set(p[0], p[1], p[2]); m.quaternion.set(p[3], p[4], p[5], p[6]); }
  // Where a thing is drawn this frame: in my hand, or where the host says, or at home
  placeHeld(name, m, fallback) {
    const L = this.local[name];
    if (L) {
      const h = L.h, hq = h.desk ? this.G.camera.getWorldQuaternion(_q) : h.grip.getWorldQuaternion(_q);
      m.quaternion.copy(hq).multiply(L.offQ);
      m.position.copy(h.pos).add(_a.copy(L.offP).applyQuaternion(hq));
      return true;
    }
    const p = this.s.obj[name];
    if (p) { this.setPose(m, p); return true; }
    this.setPose(m, fallback || m.userData.home); return false;
  }

  registerInteractables() {
    const G = this.G, s = this.s, self = this;
    const desk = () => G.mode === 'desktop';
    const its = [
      this.holdable('plate', this.plate, { enabled: () => s.phase === 'shadows' && s.set === 'grove', radius: 0.13, rotate: true,
        hint: 'Squeeze GRIP to pick up the plate. Hold it between the lamp and the wall, and turn it', deskHint: 'Click and hold to pick up the plate, move the mouse to turn it' }),
      this.holdable('ball', this.ball, { enabled: () => s.phase === 'shadows' && s.set === 'grove', radius: 0.1, rotate: true,
        hint: 'Squeeze GRIP to pick up the ball and hold it up to the lamp', deskHint: 'Click and hold to pick up the ball' }),
      this.holdable('stickS', this.stickS, { enabled: () => s.phase === 'plantS' && !s.plantS, radius: 0.15, auto: () => G.act({ type: 'plant', o: 'stickS' }),
        hint: 'Grab the stick (GRIP) and stand it in the glowing ring', deskHint: 'Click the stick to stand it up' }),
      this.holdable('stickA', this.stickA, { enabled: () => s.phase === 'plantA' && !s.plantA, radius: 0.15, auto: () => G.act({ type: 'plant', o: 'stickA' }),
        hint: 'Grab the stick (GRIP) and stand it in the glowing ring', deskHint: 'Click the stick to stand it up' }),
      ...this.stars.map((st, i) => this.holdable('star' + i, st, { enabled: () => s.phase === 'sort' && !s.sorted[i], radius: 0.1,
        auto: () => G.act({ type: 'sortStar', i, b: self.mags[i] <= 3 ? 1 : 2 }),
        hint: 'Grab a star (GRIP) and drop it in the Bright or the Faint basket', deskHint: 'Click a star to sort it' })),
    ];
    // touchables: the protractor, the scroll, the journal page
    const touch = (obj, enabled, type, hint, deskHint, r = 0.3) => ({
      hint, deskHint,
      get disabled() { return !enabled(); },
      reach(p) { obj.getWorldPosition(_a); return Math.max(0, p.distanceTo(_a) - r); },
      aim(o, d) { obj.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < r ? t : Infinity; },
      onTouch() { G.act({ type }); }, onGrab() { G.act({ type }); },
    });
    its.push(
      touch(this.prot, () => s.prot === 1, 'measure', 'Touch the protractor (TRIGGER) to measure the angle', 'Click the protractor to measure the angle', 0.45),
      touch(this.scroll, () => s.paint === 1, 'paint', 'Touch the silk scroll (TRIGGER) to paint the comet', 'Click the scroll to paint the comet', 0.35),
      touch(this.journal, () => s.journal === 1, 'touchPage', 'Touch the journal page (TRIGGER or GRIP)', 'Click the journal page', 0.22),
    );
    this.its = its;
    G.interactables.push(...its);
    this.desk = desk;
  }

  // ---------- Actions from any player (run on the host) ----------
  act(a) {
    const s = this.s;
    if (a.type === 'move' && a.p) { s.obj[a.o] = a.p; return true; }
    if (a.type === 'drop') {
      if (a.o === 'plate' || a.o === 'ball') { delete s.obj[a.o]; return true; }
      if (a.o === 'stickS' || a.o === 'stickA') {
        const rg = a.o === 'stickS' ? this.ringS : this.ringA;
        delete s.obj[a.o];
        if (a.p && Math.hypot(a.p[0] - rg[0], a.p[2] - rg[1]) < 0.7) this.act({ type: 'plant', o: a.o });
        return true;
      }
      if (a.o.startsWith('star')) {
        const i = +a.o.slice(4); delete s.obj[a.o];
        if (!a.p) return true;
        const near = this.baskets.map((b, j) => [Math.hypot(a.p[0] - b.x, a.p[1] - b.y - 0.1, a.p[2] - b.z), j]).sort((x, y) => x[0] - y[0])[0];
        if (near[0] < 0.45) this.act({ type: 'sortStar', i, b: near[1] + 1 });
        return true;
      }
    }
    if (a.type === 'plant') {
      if (a.o === 'stickS' && s.phase === 'plantS') { s.plantS = 1; delete s.obj.stickS; this.G.events.emit('sfx', { k: 'page' }); }
      if (a.o === 'stickA' && s.phase === 'plantA') { s.plantA = 1; delete s.obj.stickA; }
      return true;
    }
    if (a.type === 'sortStar' && s.phase === 'sort' && !s.sorted[a.i]) {
      const right = this.mags[a.i] <= 3 ? 1 : 2;
      if (a.b === right) { s.sorted[a.i] = right; s.sorted = [...s.sorted]; s.ding = (s.ding || 0) + 1; }
      else { s.oops = (s.oops || 0) + 1; s.oopsBright = right === 1; }
      return true;
    }
    if (a.type === 'measure' && s.prot === 1) { s.prot = 2; return true; }
    if (a.type === 'paint' && s.paint === 1) { s.paint = 2; return true; }
    if (a.type === 'touchPage' && s.journal === 1) { s.journal = 2; return true; }
    return false;
  }

  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story (host only) ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    const placeAll = (pos, look) => G.events.emit('placePlayers', { x: pos.x, z: pos.z, yaw: yawToward(pos, look) });
    const go = async (set, spot) => {
      await G.ui.fadeOut(0.9); G.events.emit('sfx', { k: 'page' });
      s.set = set; this.useSet(set); s.guide = null;
      const sp = spot || this.sets[set].start; placeAll(sp.pos, sp.look);
      await D.wait(0.3); await G.ui.fadeIn(1.4);
    };
    const T = (secs) => (fast ? Math.min(secs, 4) : secs);
    const everyoneNear = (p, r) => G.players.every((pl) => { pl.headPos?.(_a) ?? _a.copy(p); return Math.hypot(_a.x - p.x, _a.z - p.z) < r; });
    // Hints that ask you to do something show only in Adults mode (D.hint); in Kids mode
    // everything happens by itself (D.auto does the step after a moment)
    const hint = (vr, dk, secs = 8) => D.hint(G.mode === 'desktop' ? dk : vr, secs);
    const soon = fast ? 0.5 : 3;

    // ===== Part A: Athens, at night =====
    s.set = 'grove'; this.useSet('grove');
    const S = this.sets.grove;
    placeAll(S.start.pos, S.start.look);
    await G.ui.fadeIn(2.5);
    s.guide = _a.copy(this.templeFront).add(_b.set(7, 9.5, 5)).toArray();   // over the temple's front, beside its pediment
    const l1 = D.sayAsync('ch5_01');
    await D.cue('voting'); s.vote = 1;                 // hands go up: voting on their own laws
    await D.cue('And a group'); s.vote = 0; s.think = 1; // ...and the thinkers argue, hands waving
    await l1;
    s.think = 0;
    s.phase = 'ship';
    s.guide = at(185, 14, 2.5).toArray();
    await D.say('ch5_02');
    await D.until(() => s.ship >= 0.98, T(10));
    // The eclipse
    s.phase = 'eclipse'; s.point = 1;
    s.guide = dirFromAzEl(MOON_AZ + 14, MOON_EL - 4).multiplyScalar(9).add(S.start.pos).setY(4.5).toArray();
    G.events.emit('sfx', { k: 'swell' });
    await D.say('ch5_03');
    await D.until(() => s.eclipse >= 0.85, T(25));
    s.curve = 1;
    await D.say('ch5_04');
    await D.wait(fast ? 0.5 : 2);
    s.point = 0;
    // Try it yourself: the plate and the ball at the lamp
    await G.ui.fadeOut(0.8);
    placeAll(S.lampSpot.pos, S.lampSpot.look);
    s.curve = 0; s.phase = 'shadows'; s.guide = new THREE.Vector3(-1.3, 1.9, -3.9).toArray();
    await G.ui.fadeIn(1);
    hint('Squeeze GRIP to pick up the plate. Hold it between the lamp and the wall', 'Click and hold the plate to pick it up. Move the mouse to turn it.');
    await D.say('ch5_05');
    hint('Turn the plate, then try the ball', 'Turn the plate, then try the ball', 6);
    const tried = D.kids ? false : await D.until(() => s.plate && s.ball, fast ? 20 : 40);
    if (!tried) {
      // Nobody tried (or only half): the plate and the ball show it on their own
      for (const k of ['plate', 'ball']) this.local[k] = null;
      s.obj = {}; s.demo = 0.001; G.ui.showHint('');
      await D.until(() => s.demo >= 1);
      s.plate = s.ball = 1;
    }
    G.ui.showHint('');
    s.point = 2;
    await D.say('ch5_06');
    s.point = 0; s.phase = 'syene-go'; s.obj = {}; s.demo = 0;

    // ===== Part B: Syene, noon on the longest day =====
    await go('syene');
    s.guide = new THREE.Vector3(this.wellPos.x, 2.6, this.wellPos.z - 0.6).toArray();
    s.glint = 1;
    await D.say('ch5_07');
    hint('Walk up to the well and look down', 'Walk up to the well (WASD) and look down', 6);
    if (D.kids) await D.goTo(new THREE.Vector3(this.wellPos.x + 1.6, 0, this.wellPos.z + 0.9), yawToward(new THREE.Vector3(this.wellPos.x + 1.6, 0, this.wellPos.z + 0.9), this.wellPos));
    else await D.until(() => everyoneNear(this.wellPos, 2.6), T(12));
    s.phase = 'plantS'; s.ring = D.kids ? null : this.ringS;
    hint('Grab the stick (GRIP) and stand it in the glowing ring', 'Click the stick to stand it up');
    await D.auto(() => s.plantS, () => this.act({ type: 'plant', o: 'stickS' }), { after: soon, timeout: T(30) });
    s.plantS = 1; s.ring = null; G.ui.showHint('');
    s.guide = new THREE.Vector3(this.ringS[0] + 0.6, 2.2, this.ringS[1] - 0.4).toArray();
    await D.say('ch5_08');
    await D.wait(fast ? 0.3 : 1.5);

    // ===== Alexandria, the same noon =====
    s.phase = 'alex-go';
    await go('alex');
    s.phase = 'plantA'; s.ring = D.kids ? null : this.ringA; s.point = 3;
    hint('Grab the stick (GRIP) and stand it in the glowing ring', 'Click the stick to stand it up');
    // (Kids mode: Eratosthenes walks over and plants it himself)
    await D.auto(() => s.plantA, (dt) => { s.eraGo = 1; if (this.eratosthenes.pose === 'work' && (this.eraT = (this.eraT || 0) + dt) > 0.8) this.act({ type: 'plant', o: 'stickA' }); }, { after: soon, timeout: T(30) });
    s.plantA = 1; s.ring = null; G.ui.showHint('');
    s.guide = new THREE.Vector3(this.ringA[0] - 0.3, 2.4, this.ringA[1] - 1.2).toArray();
    await D.say('ch5_09');
    // Measure the angle
    s.prot = 1; s.phase = 'measure';
    hint('Touch the protractor (TRIGGER) to measure the angle', 'Click the protractor to measure the angle');
    await D.auto(() => s.prot === 2, () => this.act({ type: 'measure' }), { after: soon, timeout: T(20) });
    s.prot = 2; G.ui.showHint('');
    await D.until(() => s.measure >= 1);
    await D.say('ch5_10');
    // The globe, measured out in fifty slices
    s.phase = 'globe'; s.globe = 1; s.point = 0;
    s.guide = new THREE.Vector3(-7.4, 4.4, 1.6).toArray();
    G.events.emit('sfx', { k: 'swell' });
    await D.wait(fast ? 0.3 : 1.5);
    s.slices = 1;
    await D.say('ch5_11');
    await D.until(() => s.slices >= 50, T(14));
    s.slices = 50; s.grow = 1;
    await D.wait(fast ? 0.3 : 2);
    await D.say('ch5_12');
    // The journal page
    s.guide = null; s.journal = 1; s.phase = 'journal';
    G.events.emit('sfx', { k: 'page' });
    hint('Touch the journal page (TRIGGER or GRIP)', 'Click the journal page');
    await D.auto(() => s.journal === 2, () => this.act({ type: 'touchPage' }), { after: fast ? 0.5 : 4 });
    G.ui.showHint('');

    // ===== Bridge: China's court astronomers and the comet =====
    s.phase = 'china'; s.globe = 0;
    await go('china');
    s.comet = 0.001;
    s.guide = new THREE.Vector3(2.5, 3.5, -6).toArray();
    s.paint = 1;
    await D.say('br5_01');
    hint('Touch the silk scroll (TRIGGER) to paint the comet', 'Click the scroll to paint the comet', 7);
    await D.auto(() => s.paint === 2, () => this.act({ type: 'paint' }), { after: soon, timeout: T(15) });
    s.paint = 2; G.ui.showHint('');
    await D.until(() => s.brush >= 1);
    await D.wait(fast ? 0.3 : 2);

    // ===== Bridge: Hipparchus sorts the stars =====
    s.phase = 'rhodes';
    await go('rhodes');
    s.guide = new THREE.Vector3(-1.8, 2.2, -2.2).toArray();
    await D.say('br5_02');
    s.phase = 'sort';
    hint('Grab a star (GRIP) and drop it in the Bright or the Faint basket', 'Click a star to sort it');
    const allSorted = () => s.sorted.every((v) => v);
    let sortT = 0;
    const sortNext = (dt) => { sortT += dt; if (sortT < 0.8) return; sortT = 0; const i = s.sorted.findIndex((v) => !v); if (i >= 0) this.act({ type: 'sortStar', i, b: this.mags[i] <= 3 ? 1 : 2 }); };
    if (!(await D.auto(allSorted, sortNext, { after: soon, timeout: T(60) }))) {
      // help out: the rest fly into their baskets one by one
      for (let i = 0; i < 6; i++) if (!s.sorted[i]) { this.act({ type: 'sortStar', i, b: this.mags[i] <= 3 ? 1 : 2 }); await D.wait(0.6); }
    }
    G.ui.showHint(''); s.cheer = 1;
    await D.wait(fast ? 0.5 : 3);
    s.phase = 'done';
  }

  // ---------- Every frame, every headset ----------
  update(dt, t) {
    const G = this.G, s = this.s, host = G.isHost, fast = G.params.has('fast') ? 4 : 1;
    if (s.set !== this.cur) this.useSet(s.set);
    // Host-side timelines
    if (host) {
      if (s.phase === 'ship' || (s.phase !== 'arrive' && s.set === 'grove')) s.ship = Math.min(1, s.ship + dt / 16 * fast);
      if (s.phase === 'eclipse' || s.curve) s.eclipse = Math.min(1, s.eclipse + dt / 20 * fast);
      if (s.demo > 0 && s.demo < 1) s.demo = Math.min(1, s.demo + dt / 12 * fast);
      if (s.prot === 2) s.measure = Math.min(1, s.measure + dt / 3 * fast);
      if (s.slices > 0 && s.slices < 50) s.slices = Math.min(50, s.slices + dt * 4.2 * fast);
      if (s.comet > 0) s.comet = Math.min(1, s.comet + dt / 40 * fast);
      if (s.paint === 2) s.brush = Math.min(1, s.brush + dt / 2.5 * fast);
      // Has someone tried the plate edge-on, and held the ball up to the lamp?
      if (s.phase === 'shadows') {
        const pp = s.obj.plate, bp = s.obj.ball;
        if (pp && pp[2] < this.lampPos.z - 0.05) {
          _a.set(0, 1, 0).applyQuaternion(_q.set(pp[3], pp[4], pp[5], pp[6]));
          _b.set(pp[0], pp[1], pp[2]).sub(this.lampPos).normalize();
          if (Math.abs(_a.dot(_b)) < 0.2) s.plate = 1;
        }
        if (bp && bp[2] < this.lampPos.z - 0.05) { this.ballT = (this.ballT || 0) + dt; if (this.ballT > 1.2) s.ball = 1; }
      }
    }
    G.sky.sunSize = 1;
    if (this.cur === 'grove') this.updateGrove(dt, t);
    else if (this.cur === 'syene' || this.cur === 'alex') this.updateEgypt(dt, t);
    else if (this.cur === 'china') this.updateChina(dt, t);
    else if (this.cur === 'rhodes') this.updateRhodes(dt, t);

    // People
    const S = this.sets[this.cur];
    for (const P of S.people) {
      P.pose = s.cheer ? 'cheer' : 'idle';
      if (P === this.aristotle && s.point) { P.pose = 'point'; if (s.point === 1) dirFromAzEl(MOON_AZ, MOON_EL, P.pointAt).multiplyScalar(50); else P.pointAt.set(0, 1.4, this.wallZ); }
      if (P === this.eratosthenes && s.point === 3) { P.pose = 'point'; P.pointAt.set(this.ringA[0], 0, this.ringA[1] + 0.1); }
      if (P === this.eratosthenes && s.globe) { P.pose = 'point'; P.pointAt.copy(this.globe.position); }
      if (P === this.astronomer && s.comet > 0 && s.paint !== 2) { P.pose = 'point'; P.pointAt.copy(this.comet.position); }
      // Aristotle watches the shadow on the wall while the plate and ball turn; Eratosthenes walks to
      // the ring and plants his stick himself, then holds up the measure
      if (P === this.aristotle) P.look = s.phase === 'shadows' ? _c.set(0, 1.3, this.wallZ).clone() : s.point === 1 ? dirFromAzEl(MOON_AZ, MOON_EL, _c).multiplyScalar(50).add(P.g.position).clone() : null;
      if (P === this.aristotle && s.phase === 'shadows' && s.demo > 0 && s.demo < 1) P.pose = 'hold';
      if (P === this.eratosthenes && s.eraGo && !s.plantA) { if (walkToward(P, this.ringA[0] - 0.55, this.ringA[1] + 0.25, dt, { height: S.height, speed: 1 })) P.pose = 'work'; }
      if (P === this.eratosthenes && s.prot === 2 && s.measure < 1) P.pose = 'hold';
      if (P.extra) this.lifePose(P, dt, t);
      animatePerson(P, t, dt);
    }
    for (const tc of this.torches) tc.userData.flicker(t);
    if (this.cur === 'syene') this.sLife.update(dt, t);
    if (this.cur === 'alex') this.aLife.update(dt, t);
    // Guide
    if (s.guide) { _a.fromArray(s.guide); if (!this.guideAt || !this.guideAt.equals(_a)) { this.guideAt = _a.clone(); G.guide.flyTo(this.guideAt); G.guide.chime(); } }
    else if (this.guideAt && s.journal !== 1) { this.guideAt = null; G.guide.follow(); }
    // The "put it here" ring
    this.ringV = damp(this.ringV || 0, s.ring ? 1 : 0, 3, dt);
    if (s.ring) this.ring.position.set(s.ring[0], S.height(s.ring[0], s.ring[1]) + 0.04, s.ring[1]);
    this.ring.material.opacity = this.ringV * (0.55 + 0.25 * Math.sin(t * 3)); this.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
    this.ring.visible = this.ringV > 0.01;
    // The journal page floats in front of you, held up by Astra
    this.journal.visible = s.journal === 1;
    if (s.journal === 1) {
      G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize();
      if (!this.pageSet) { this.pageSet = true; this.journal.position.copy(_a).addScaledVector(_b, 0.62); this.journal.position.y -= 0.2; }
      this.journal.lookAt(_a);
      G.guide.flyTo(_c.copy(this.journal.position).add(_b.set(-_b.z * 0.4, 0.12, _b.x * 0.4)), _a);
      this.guideAt = this.guideAt || _c.clone();
    }
  }

  updateGrove(dt, t) {
    const G = this.G, s = this.s;
    G.sky.set(MOON_AZ + 180, -26);
    // The ship sails south and sinks below the horizon, hull first
    const k = ease(s.ship), dist = lerp(160, 1500, k);
    const sp = at(176, dist); sp.y = -29.6 - Math.max(0, (dist - 300) / 1200) ** 2 * 14;
    this.ship.position.copy(sp); this.ship.rotation.y = -176 * D2R + Math.PI; this.ship.rotation.z = Math.sin(t * 0.9) * 0.03;
    this.shipLamp.position.copy(sp).y += 9; this.ship.visible = this.shipLamp.visible = sp.y > -45;
    // The eclipse: Earth's shadow slides in from the left
    const e = ease(s.eclipse);
    this.moonMat.uniforms.shadowC.value.set(lerp(-3.9, -1.75, e), lerp(0.55, 0.25, e));
    this.curveV = damp(this.curveV || 0, s.curve, 2, dt); this.moonMat.uniforms.guide.value = this.curveV;
    this.moonMat.uniforms.glow.value = 1 - e * 0.5;
    this.moonLight.intensity = 0.55 * (1 - e * 0.55);
    G.camera.getWorldPosition(_a); this.moon.lookAt(_a);
    // The flame flickers
    const fl = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.05;
    this.lampLight.intensity = 2.2 * fl; this.flame.scale.setScalar(0.2 * fl);
    // the temple's fires
    const ff = 1 + Math.sin(t * 9.1) * 0.08 + Math.sin(t * 5.3 + 1) * 0.07;
    this.templeLight.intensity = 30 * ff;
    this.fireSprites.forEach((sp, i) => sp.scale.setScalar((i === 2 ? 1.8 : 1.3) * (1 + Math.sin(t * 11 + i * 2) * 0.1)));
    this.cityLights.material.size = 7 * (1 + Math.sin(t * 6.1) * 0.06 + Math.sin(t * 10.7) * 0.04);   // torches on the walls
    if (G.audio.ctx) {
      this.crackleT = (this.crackleT || 0) - dt;
      if (this.crackleT <= 0) { this.crackleT = 0.15 + Math.random() * 0.5; G.audio.noise(G.audio.out(this.fires[(Math.random() * 3) | 0], 0.25, 3), { type: 'highpass', f: 1500 + Math.random() * 2000, peak: 0.3, a: 0.002, d: 0.04 }); }
    }
    // Plate and ball: in a hand, where the host says, on the table, or showing themselves (demo)
    const demo = s.demo;
    let pf = null, bf = null;
    if (demo > 0) {
      const a = clamp(demo * 2, 0, 1), b = clamp(demo * 2 - 1, 0, 1);
      const spot = new THREE.Vector3(0.45, 1.35, -3.45);
      if (a > 0 && a < 1) { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 * (1 - clamp(a * 1.6 - 0.4, 0, 1)), 0, 0)); pf = [spot.x, spot.y, spot.z, ...q.toArray()]; }
      if (b > 0 && b < 1) { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(b * 4, b * 6, 0)); bf = [spot.x, spot.y, spot.z, ...q.toArray()]; }
    }
    this.placeHeld('plate', this.plate, pf); this.placeHeld('ball', this.ball, bf);
    // Their shadows on the wall, only when they're between the lamp and the wall
    [this.plate, this.ball].forEach((o, i) => {
      const sh = this.shadows[i]; o.updateMatrixWorld();
      const ok = o.position.z < this.lampPos.z - 0.03 && o.position.z > this.wallZ + 0.1;
      sh.visible = ok; if (ok) sh.matrix.multiplyMatrices(this.shadowM, o.matrixWorld);
    });
    // Night sounds: crickets, and the sea far below
    if (G.audio.ctx) {
      this.cricketT -= dt;
      if (this.cricketT <= 0) {
        this.cricketT = 0.4 + Math.random() * 1.2;
        const A = G.audio, o = A.out(at(Math.random() * 360, 6 + Math.random() * 14, 0.3), 0.06, 4), f = 4200 + Math.random() * 600;
        for (let i = 0; i < 3; i++) A.tone(o, { type: 'triangle', f, peak: 0.25, a: 0.003, d: 0.035, t0: i * 0.07 });
      }
      this.waveT -= dt;
      if (this.waveT <= 0) { this.waveT = 4 + Math.random() * 3; G.audio.noise(G.audio.out(at(180, 60, -20), 0.35, 30), { f: 500, f2: 200, peak: 0.4, a: 1.2, d: 2.5 }); }
    }
  }

  updateEgypt(dt, t) {
    const G = this.G, s = this.s, alex = this.cur === 'alex';
    const el = alex ? 90 - ANGLE : 89.9, az = 180;
    G.sky.set(az, el);
    const sun = dirFromAzEl(az, el, _c);
    // The stick: lying on the ground, carried, or standing in its ring, with its shadow
    const stick = alex ? this.stickA : this.stickS, ring = alex ? this.ringA : this.ringS, planted = alex ? s.plantA : s.plantS;
    const name = alex ? 'stickA' : 'stickS';
    const up = [ring[0], 0, ring[1], 0, 0, 0, 1];
    if (planted) { this.local[name] = null; this.setPose(stick, up); } else this.placeHeld(name, stick);
    const sh = stick.userData.shadow;
    sh.visible = !!planted;
    if (planted) {
      const len = Math.max(0.001, STICK_H * Math.cos(el * D2R) / Math.sin(el * D2R));
      sh.position.set(ring[0], 0.02, ring[1]); sh.scale.set(1, len, 1);
      sh.rotation.y = Math.atan2(sun.x, sun.z);   // pointing away from the Sun
    }
    if (!alex) {
      // the Sun's reflection deep down in the well (it's only there when the Sun is overhead)
      this.glintV = damp(this.glintV || 0, s.glint, 1.5, dt);
      this.glintSpr.material.opacity = this.glintV * (0.85 + 0.15 * Math.sin(t * 5));
      this.glintSpr.visible = this.glintV > 0.01;
    } else {
      // Measuring: the protractor and the sun ray, and the angle opening up to 7°
      this.prot.visible = s.prot > 0;
      if (this.prot.visible) this.drawProtractor(ease(s.measure));
      this.ray.visible = s.prot > 0;
      if (this.ray.visible) {
        const len = STICK_H / Math.sin(el * D2R);
        this.ray.position.copy(this.protTop); this.ray.scale.set(1, len, 1);
        // tilt from straight down toward the shadow's tip (north, since the Sun is in the south)
        this.ray.rotation.set(ANGLE * D2R * ease(s.measure), 0, 0);
      }
      // The globe
      this.globeV = damp(this.globeV || 0, s.globe, 2, dt);
      this.globe.visible = this.globeV > 0.01;
      if (this.globe.visible) {
        const sc = this.globeV * (1 + 0.35 * ease(s.grow));
        this.globe.scale.setScalar(sc);
        this.wedges.geometry.setDrawRange(0, Math.max(1, Math.floor(s.slices)) * 6);
        this.pie.visible = s.slices < 50 || Math.sin(t * 4) > -0.5;
      }
      const n = Math.floor(s.slices);
      this.counter.visible = s.globe && n > 0;
      if (this.counter.visible) this.counter.userData.set(n >= 50 ? '800 km × 50 = 40,000 km around' : `${n} × 800 km = ${(n * 800).toLocaleString('en-US')} km`);
      if (n !== this.lastN && n > 0 && G.audio.ctx) { this.lastN = n; G.audio.tick(this.globe.position); if (n === 50) G.audio.chime(this.globe.position, 0.6); }
    }
    // a warm breeze
    if (G.audio.ctx) { this.windT -= dt; if (this.windT <= 0) { this.windT = 3 + Math.random() * 3; G.audio.noise(G.audio.out(null, 0.12), { type: 'bandpass', f: 400, f2: 700, q: 0.6, peak: 0.3, a: 1.5, d: 2.5 }); } }
  }

  drawProtractor(k) {
    const key = Math.round(k * 50); if (key === this.protKey) return; this.protKey = key;
    const g = this.protTex.userData.ctx, W = 512, cx = 256, cy = 256, R = 236;
    g.clearRect(0, 0, W, W);
    // a half disc below the stick's top: brass-coloured, with degree marks
    g.fillStyle = 'rgba(230,200,130,0.35)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(120,80,20,0.95)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI); g.closePath(); g.stroke();
    for (let d = 0; d <= 180; d += 2) {
      const a = d * D2R, l = d % 10 === 0 ? 30 : 14;
      g.lineWidth = d % 10 === 0 ? 3 : 1.5; g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l)); g.stroke();
    }
    // the angle between straight down (the stick) and the sunbeam, opening up
    // (the plane faces east, toward you, so the shadow's tip, to the north, is on your right)
    const a1 = Math.PI / 2, a0 = Math.PI / 2 - ANGLE * D2R * k * 1.0;
    g.fillStyle = 'rgba(255,170,40,0.75)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R - 34, a0, a1); g.fill();
    g.strokeStyle = 'rgba(90,50,10,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + R); g.stroke();
    if (k > 0.98) {
      g.fillStyle = '#3a2208'; g.font = 'bold 64px Georgia, serif'; g.textAlign = 'center';
      g.fillText('7°', cx + 75, cy + 120);
      g.font = 'italic 34px Georgia, serif'; g.fillText('1/50 of a circle', cx, cy + 190);
    }
    this.protTex.needsUpdate = true;
  }

  updateChina(dt, t) {
    const G = this.G, s = this.s;
    G.sky.set(0, -30);
    // The comet drifts slowly across the sky in the north-east, its tail pointing away from the (hidden) Sun
    const az = lerp(18, 52, s.comet), el = lerp(30, 34, s.comet);
    dirFromAzEl(az, el, this.comet.position).multiplyScalar(700);
    G.camera.getWorldPosition(_a);
    this.comet.lookAt(_a); this.cometTail.rotation.z = -0.5;
    this.comet.visible = true;
    // Painting the comet on the silk
    const k = Math.round(s.brush * 40);
    if (k !== this.brushK) {
      this.brushK = k;
      const g = this.scrollTex.userData.ctx, w = 512, h = 256, b = s.brush;
      g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(150,40,30,0.8)'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20);
      // a few stars, then the comet: a round head and a long brushed tail
      g.fillStyle = '#1a1410';
      for (const [x, y] of [[70, 60], [110, 190], [420, 70], [460, 200], [300, 40]]) { g.beginPath(); g.arc(x, y, 6, 0, 6.28); g.fill(); }
      if (b > 0) {
        g.strokeStyle = '#1a1410'; g.lineCap = 'round';
        const n = Math.floor(b * 30);
        for (let i = 0; i < n; i++) { const f = i / 30; g.lineWidth = 16 * (1 - f) + 2; g.beginPath(); g.moveTo(330 - f * 220, 150 - f * 70); g.lineTo(330 - (f + 0.034) * 220, 150 - (f + 0.034) * 70); g.stroke(); }
        g.beginPath(); g.arc(336, 152, 14, 0, 6.28); g.fill();
      }
      this.scrollTex.needsUpdate = true;
      if (b > 0 && G.audio.ctx && k % 6 === 0) G.audio.noise(G.audio.out(this.scroll.position, 0.4), { type: 'highpass', f: 2500, peak: 0.2, a: 0.02, d: 0.15 });
    }
  }

  updateRhodes(dt, t) {
    const G = this.G, s = this.s;
    G.sky.set(0, -30);
    // Stars float and twinkle until they're sorted into a basket
    const inB = [0, 0];
    this.stars.forEach((st, i) => {
      const name = 'star' + i, b = s.sorted[i];
      if (b) {
        this.local[name] = null;
        const bp = this.baskets[b - 1], n = inB[b - 1]++;
        _a.set(bp.x + Math.cos(n * 2.1) * 0.08, bp.y + 0.08 + n * 0.02, bp.z + Math.sin(n * 2.1) * 0.08);
        st.position.lerp(_a, 1 - Math.exp(-dt * 6));
      } else {
        const h = st.userData.home;
        const held = this.placeHeld(name, st, [h[0], h[1] + Math.sin(t * 1.3 + i) * 0.04, h[2], 0, 0, 0, 1]);
        if (!held) st.position.y = h[1] + Math.sin(t * 1.3 + i) * 0.04;
      }
      st.children[0].material.rotation = t * 0.2;
    });
    if ((s.ding || 0) !== (this.lastDing || 0)) { this.lastDing = s.ding; G.audio.chime(this.baskets[0], 0.4); }
    if ((s.oops || 0) !== (this.lastOops || 0)) {
      this.lastOops = s.oops;
      G.ui.showHint(s.oopsBright ? 'That one is bright: try the Bright basket' : 'That one is faint: try the Faint basket', 4);
    }
    if (G.audio.ctx) {
      this.cricketT -= dt;
      if (this.cricketT <= 0) { this.cricketT = 0.6 + Math.random() * 1.4; const A = G.audio, o = A.out(at(Math.random() * 360, 5 + Math.random() * 10, 0.3), 0.05, 4); for (let i = 0; i < 3; i++) A.tone(o, { type: 'triangle', f: 4400, peak: 0.25, a: 0.003, d: 0.035, t0: i * 0.07 }); }
    }
  }

  dispose() {
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
  }
}
