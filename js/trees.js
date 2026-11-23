// Trees: a shared library of detailed procedural trees and plants, for every chapter.
//
// Every tree is grown from a seed: a gnarled, tapering trunk with a root flare and bark texture,
// limbs that branch 3 to 4 times (real curved tubes that thin out), and a crown made of many
// alpha-tested leaf cards (each card is a canvas-drawn spray of leaves, tinted a little
// differently, darker inside the crown). Leaves and twigs sway gently in the wind (in the shader).
// A tree is 2 meshes: bark (wood, fruit, snow) and leaves. A grove() of many trees is also 2 meshes.
//
// Sizes are in metres, positions are local to the tree (its foot at 0,0,0); place the group yourself.
// detail: 'hero' (15-25k triangles, for a tree you stand under), 'high' (~4-8k), 'mid' (~1.5-3k),
// 'low' (~200-600, for groves and backgrounds). Every kind takes { seed, height, detail }.
//
//   import { appleTree, orchardTree, deciduousTree, bareTree, conifer, cypress, poplar, palm, olive,
//            bush, grove, makeApple } from '../trees.js';
//
//   const t = appleTree({ seed: 3, height: 6, apples: 40, windfalls: 8, reserveApples: 1,
//                         reserveNear: new THREE.Vector3(0.9, 2, 0.4), ground: (x, z) => 0 });
//   t.group.position.set(x, groundHeight(x, z), z); root.add(t.group);
//   t.apples     every apple on the tree: [{ pos, r }] (local); t.reserved: apples NOT built, so
//                the chapter can hang its own makeApple() there and drop it from a real branch
//   orchardTree({ seed: 5, height: 4, apples: 18 })                       smaller fruit trees
//   deciduousTree({ seed: 7, height: 12, shape: 'oak' })                   summer oak ('elm' = vase-shaped)
//   bareTree({ seed: 9, height: 10, snow: true })                         winter, fine twigs, snow on the tops
//   conifer({ seed: 2, height: 11, type: 'spruce', snow: true })          'spruce' tiers, or 'pine' (tall bare trunk)
//   cypress({ seed: 4, height: 11 })   poplar({ seed: 4, height: 16 })    tall and narrow, for Italy
//   palm({ seed: 6, height: 9, dates: true })                             date palm, Egypt and Babylon
//   olive({ seed: 8, height: 4.5 })                                       gnarled, silvery, Greece
//   bush({ seed: 1, height: 1.2 })                                        a leafy shrub
//
//   Many trees cheaply (2 draw calls, a few variants copied, each turned and sized):
//   const g = grove(conifer, spots, { detail: 'low', variants: 4, snow: true });   spots: [{ x, y, z, s, yaw }]
//   root.add(g.group);   g.tris = triangles
//
// Each result: { group, bark, leaves (meshes), tris, height, crown: { center, radius } }.
// Wind: a shared clock moves every tree; set TREE_WIND.strength (0 = still).
import * as THREE from 'three';
import { rng, noise2 } from './shapes.js';

export const TREE_WIND = { strength: 1 };
const U_T = { value: 0 }, U_S = { value: 1 };
const tick = () => { U_T.value = performance.now() / 1000; U_S.value = TREE_WIND.strength; };

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const DET = { low: 0, mid: 1, high: 2, hero: 3 };
const pick = (d, arr) => arr[DET[d] ?? 1];

// ---------------------------------------------------------------------------------------------
// Geometry buffer: positions, normals, uvs, colours, sway (metres of wind movement) and "plain"
// (1 = ignore the texture: apples, dates, snow)
class Buf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.sw = []; this.pl = []; this.ix = []; }
  get count() { return this.p.length / 3; }
  get tris() { return this.ix.length / 3; }
  v(p, n, u, w, col, sway, plain = 0) {
    this.p.push(p.x, p.y, p.z); this.n.push(n.x, n.y, n.z); this.uv.push(u, w);
    this.c.push(col.r, col.g, col.b); this.sw.push(sway); this.pl.push(plain);
    return this.count - 1;
  }
  tri(a, b, c) { this.ix.push(a, b, c); }
  // copy another buffer in, moved by matrix m, colours multiplied by tint (not plain parts)
  append(src, m, nm, tint, swayK = 1) {
    const base = this.count, P = src.p, N = src.n;
    for (let i = 0; i < P.length; i += 3) {
      _v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(m); this.p.push(_v.x, _v.y, _v.z);
      _v.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(nm).normalize(); this.n.push(_v.x, _v.y, _v.z);
      const pl = src.pl[i / 3], k = pl > 0.5 ? 1 : 0;
      this.c.push(k ? src.c[i] : src.c[i] * tint.r, k ? src.c[i + 1] : src.c[i + 1] * tint.g, k ? src.c[i + 2] : src.c[i + 2] * tint.b);
    }
    for (const x of src.uv) this.uv.push(x);
    for (const x of src.sw) this.sw.push(x * swayK);
    for (const x of src.pl) this.pl.push(x);
    for (const x of src.ix) this.ix.push(x + base);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sw, 1));
    g.setAttribute('aPlain', new THREE.Float32BufferAttribute(this.pl, 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.ix, 1) : new THREE.Uint16BufferAttribute(this.ix, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------------------------------------------------------------------------------------------
// Textures (drawn once, shared)
const texCache = {};
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
const rgb = (c, k = 1, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;

// Turn a drawn canvas with transparent background into a texture whose see-through pixels carry
// the leaves' average colour (so no dark fringes when it's filtered far away)
function cutoutTex(cv, g) {
  const W = cv.width, H = cv.height, img = g.getImageData(0, 0, W, H), d = img.data;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
  n = Math.max(1, n); r /= n; gg /= n; b /= n;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a < 255) { const k = a / 255; d[i] = d[i] * k + r * (1 - k); d[i + 1] = d[i + 1] * k + gg * (1 - k); d[i + 2] = d[i + 2] * k + b * (1 - k); }
    d[i + 3] = a > 110 ? 255 : a > 40 ? a * 1.6 : a;     // crisp leaf edges
  }
  const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4;
  t.flipY = false; t.needsUpdate = true;
  return t;
}

// Leaf styles. Each texture is a 2x2 atlas of leaf sprays (quadrants 0-3, the twig runs from the
// bottom edge up); for conifers quadrants 2 and 3 are the snow-laden versions.
const LEAF = {
  broad: { len: [0.13, 0.19], wid: 0.5, n: 60, cols: [[62, 104, 36], [84, 124, 44], [52, 88, 30], [100, 134, 56], [74, 112, 40]], twig: [70, 54, 38] },
  apple: { len: [0.13, 0.18], wid: 0.55, n: 56, cols: [[66, 108, 48], [86, 126, 58], [56, 92, 42], [98, 136, 70], [74, 116, 52]], twig: [86, 64, 46], serr: true },
  olive: { len: [0.15, 0.21], wid: 0.17, n: 90, cols: [[96, 112, 78], [126, 140, 108], [80, 96, 64], [150, 160, 132], [110, 124, 92]], twig: [96, 86, 70] },
  poplar: { len: [0.09, 0.13], wid: 0.85, n: 80, cols: [[78, 124, 42], [98, 142, 52], [64, 106, 36], [118, 152, 66]], twig: [90, 80, 60], delta: true },
  needle: { needle: true, cols: [[34, 64, 38], [44, 78, 44], [28, 54, 34], [52, 86, 48]], twig: [80, 58, 40] },
  pine: { pine: true, cols: [[48, 78, 44], [60, 92, 50], [40, 66, 38], [70, 100, 58]], twig: [110, 72, 48] },
  scale: { scale: true, cols: [[30, 56, 34], [40, 70, 40], [24, 46, 28], [50, 80, 46]], twig: [70, 50, 36] },
};

function drawLeaf(g, L, W, col, st, r) {
  g.beginPath(); g.moveTo(0, 0);
  if (st.delta) { g.bezierCurveTo(W * 1.1, -L * 0.1, W * 0.8, -L * 0.6, 0, -L); g.bezierCurveTo(-W * 0.8, -L * 0.6, -W * 1.1, -L * 0.1, 0, 0); }
  else { g.bezierCurveTo(W * 0.95, -L * 0.18, W * 0.8, -L * 0.72, 0, -L); g.bezierCurveTo(-W * 0.8, -L * 0.72, -W * 0.95, -L * 0.18, 0, 0); }
  const gr = g.createLinearGradient(-W, 0, W, 0), k = 0.85 + r() * 0.3;
  gr.addColorStop(0, rgb(col, k * 0.78)); gr.addColorStop(0.5, rgb(col, k)); gr.addColorStop(1, rgb(col, k * 1.18));
  g.fillStyle = gr; g.fill();
  if (st.serr) { g.strokeStyle = rgb(col, 0.7, 0.6); g.lineWidth = 1; g.stroke(); }
  // midrib and a few veins
  g.strokeStyle = rgb(col, 1.35, 0.55); g.lineWidth = Math.max(1, W * 0.09);
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L * 0.92); g.stroke();
  if (W > 6) {
    g.lineWidth = Math.max(0.7, W * 0.04);
    for (let i = 1; i < 5; i++) { const y = -L * i / 5.5; g.beginPath(); g.moveTo(0, y); g.lineTo(W * 0.6, y - L * 0.12); g.moveTo(0, y); g.lineTo(-W * 0.6, y - L * 0.12); g.stroke(); }
  }
}

// One broad-leaved spray in a square of side S: a twig with side twigs, leaves along them
function drawSpray(g, S, st, r) {
  const twig = (x0, y0, x1, y1, w) => { g.strokeStyle = rgb(st.twig); g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * S * 0.1, (y0 + y1) / 2, x1, y1); g.stroke(); };
  const segs = [];
  const mx = S * (0.42 + r() * 0.16), my = S * 0.14;
  twig(S * 0.5, S * 1.0, mx, my, S * 0.018); segs.push([S * 0.5, S, mx, my]);
  for (let i = 0; i < 4; i++) {
    const t = 0.25 + i * 0.17 + r() * 0.06, x0 = S * 0.5 + (mx - S * 0.5) * t, y0 = S + (my - S) * t, side = i % 2 ? 1 : -1;
    const a = side * (0.6 + r() * 0.4), l = S * (0.26 + r() * 0.12) * (1 - t * 0.3);
    const x1 = x0 + Math.sin(a) * l, y1 = y0 - Math.cos(a) * l;
    twig(x0, y0, x1, y1, S * 0.01); segs.push([x0, y0, x1, y1]);
  }
  // leaves: back ones darker first, front ones lighter last
  const n = st.n, ls = [];
  for (let i = 0; i < n; i++) {
    const s = segs[(r() * segs.length) | 0], t = 0.15 + r() * 0.85;
    const x = s[0] + (s[2] - s[0]) * t, y = s[1] + (s[3] - s[1]) * t, ta = Math.atan2(s[2] - s[0], -(s[3] - s[1]));
    const side = r() < 0.5 ? -1 : 1, a = ta + side * (0.5 + r() * 0.9) * (t > 0.95 ? 0.3 : 1);
    ls.push([x, y, a, i / n]);
  }
  for (const [x, y, a, d] of ls) {
    const L = S * (st.len[0] + r() * (st.len[1] - st.len[0])), W = L * st.wid * 0.5;
    const col = st.cols[(r() * st.cols.length) | 0];
    g.save(); g.translate(x, y); g.rotate(a);
    if (r() < 0.25) g.scale(0.55 + r() * 0.3, 1);            // some leaves seen side-on
    drawLeaf(g, L, W, col.map((c) => c * (0.72 + d * 0.38)), st, r);
    g.restore();
  }
}

// A spruce/fir spray: a twig with side twiglets (and their own side shoots), thick with short
// needles; the snowy version has snow lying along the top of every twig
function drawNeedles(g, S, st, r, snow) {
  const twigs = [[S * 0.5, S * 0.98, S * 0.5 + (r() - 0.5) * S * 0.08, S * 0.03, 1]];
  for (let i = 0; i < 12; i++) {
    const t = 0.06 + i * 0.075, x0 = S * 0.5 + (twigs[0][2] - S * 0.5) * t, y0 = S * 0.98 - t * S * 0.95, side = i % 2 ? 1 : -1;
    const l = S * 0.4 * (1 - t * 0.55) * (0.85 + r() * 0.3), a = 0.8 + r() * 0.3;
    const x1 = x0 + side * Math.sin(a) * l, y1 = y0 - Math.cos(a) * l;
    twigs.push([x0, y0, x1, y1, 0.7]);
    for (const f of [0.35, 0.65]) {
      const bx = x0 + (x1 - x0) * f, by = y0 + (y1 - y0) * f, l2 = l * 0.38, a2 = a + side * 0.0 + 0.7 * (r() < 0.5 ? 1 : -1);
      twigs.push([bx, by, bx + side * Math.sin(a2) * l2, by - Math.cos(a2) * l2, 0.45]);
    }
  }
  g.lineCap = 'round';
  for (const [x0, y0, x1, y1, w] of twigs) { g.strokeStyle = rgb(st.twig); g.lineWidth = S * 0.012 * w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  for (let pass = 0; pass < 2; pass++) for (const [x0, y0, x1, y1, w] of twigs) {
    const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), n = L / (S * 0.0045);
    for (let i = 0; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, nl = S * (0.05 + r() * 0.03) * (1 - t * 0.4) * (0.7 + w * 0.4);
      for (const side of [-1, 1]) {
        const na = a + side * (0.55 + r() * 0.6);
        g.strokeStyle = rgb(st.cols[(r() * st.cols.length) | 0], (0.7 + r() * 0.35) * (pass ? 1.15 : 0.85)); g.lineWidth = S * 0.0075;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(na) * nl, y + Math.sin(na) * nl); g.stroke();
      }
    }
  }
  if (snow) for (const [x0, y0, x1, y1, w] of twigs) {
    if (w < 0.5 && r() < 0.5) continue;
    const t0 = 0.05 + r() * 0.15, t1 = 0.7 + r() * 0.25, lw = S * (0.035 + r() * 0.025) * (0.6 + w * 0.5);
    const ax = x0 + (x1 - x0) * t0, ay = y0 + (y1 - y0) * t0, bx = x0 + (x1 - x0) * t1, by = y0 + (y1 - y0) * t1;
    g.strokeStyle = 'rgb(178,192,214)'; g.lineWidth = lw; g.beginPath(); g.moveTo(ax, ay + lw * 0.25); g.lineTo(bx, by + lw * 0.25); g.stroke();
    g.strokeStyle = `rgb(${236 + r() * 14 | 0},${241 + r() * 10 | 0},${248 + r() * 7 | 0})`; g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    for (let k = 0; k < 3; k++) { const t = r(), cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t; g.fillStyle = 'rgb(244,247,252)'; g.beginPath(); g.arc(cx, cy, lw * (0.5 + r() * 0.3), 0, 6.283); g.fill(); }
  }
}

// Pine tufts: bunches of long needles fanning out from the twig ends
function drawPine(g, S, st, r, snow) {
  g.strokeStyle = rgb(st.twig); g.lineWidth = S * 0.025; g.beginPath(); g.moveTo(S * 0.5, S); g.lineTo(S * 0.5, S * 0.35); g.stroke();
  const tufts = [[S * 0.5, S * 0.3, 1]];
  for (let i = 0; i < 4; i++) { const y = S * (0.5 + i * 0.12), side = i % 2 ? 1 : -1; tufts.push([S * 0.5 + side * S * 0.22, y - S * 0.12, 0.75]); g.lineWidth = S * 0.016; g.beginPath(); g.moveTo(S * 0.5, y); g.lineTo(S * 0.5 + side * S * 0.2, y - S * 0.1); g.stroke(); }
  for (const [cx, cy, k] of tufts) for (let i = 0; i < 90 * k; i++) {
    const a = -Math.PI / 2 + (r() - 0.5) * 3.6, l = S * (0.12 + r() * 0.12) * k;
    g.strokeStyle = rgb(st.cols[(r() * st.cols.length) | 0], 0.75 + r() * 0.45); g.lineWidth = S * 0.006;
    g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + Math.cos(a) * l * 0.5, cy + Math.sin(a) * l * 0.5 - l * 0.08, cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke();
  }
  if (snow) for (const [cx, cy, k] of tufts) { g.fillStyle = 'rgb(236,242,250)'; g.beginPath(); g.ellipse(cx, cy - S * 0.03, S * 0.11 * k, S * 0.05 * k, 0, 0, 6.283); g.fill(); }
}

// Cypress scale-leaf foliage: dense little flat fans of tiny round scales
function drawScale(g, S, st, r) {
  for (let i = 0; i < 70; i++) {
    const cx = S * (0.15 + r() * 0.7), cy = S * (0.1 + r() * 0.8), a = -Math.PI / 2 + (r() - 0.5) * 1.6, l = S * (0.12 + r() * 0.1);
    const col = st.cols[(r() * st.cols.length) | 0], k = 0.7 + (i / 70) * 0.5;
    for (let j = 0; j < 10; j++) {
      const t = j / 10, x = cx + Math.cos(a) * l * t, y = cy + Math.sin(a) * l * t, rr = S * 0.03 * (1 - t * 0.6);
      g.fillStyle = rgb(col, k * (0.9 + r() * 0.2)); g.beginPath(); g.ellipse(x, y, rr, rr * 0.8, a, 0, 6.283); g.fill();
      for (const side of [-1, 1]) { const b = a + side * 0.9; g.beginPath(); g.ellipse(x + Math.cos(b) * rr * 1.4, y + Math.sin(b) * rr * 1.4, rr * 0.75, rr * 0.55, b, 0, 6.283); g.fill(); }
    }
  }
}

function leafTex(style) {
  if (texCache['leaf_' + style]) return texCache['leaf_' + style];
  const st = LEAF[style], S = st.needle || st.pine || st.scale ? 256 : 512, [cv, g] = canvas(S * 2, S * 2), r = rng(77 + style.length * 13);
  for (let q = 0; q < 4; q++) {
    g.save(); g.translate((q % 2) * S, (q >> 1) * S);
    g.beginPath(); g.rect(S * 0.02, S * 0.02, S * 0.96, S * 0.96); g.clip();
    if (st.needle) drawNeedles(g, S, st, r, q >= 2);
    else if (st.pine) drawPine(g, S, st, r, q >= 2);
    else if (st.scale) drawScale(g, S, st, r);
    else drawSpray(g, S, st, r);
    g.restore();
  }
  return (texCache['leaf_' + style] = cutoutTex(cv, g));
}

// A palm frond: green (left half) and dry brown (right half); base at the bottom, tip at the top
function frondTex() {
  if (texCache.frond) return texCache.frond;
  const W = 256, H = 1024, [cv, g] = canvas(W * 2, H), r = rng(91);
  for (let col = 0; col < 2; col++) {
    const x0 = col * W + W / 2, cols = col ? [[150, 118, 70], [128, 98, 58], [170, 140, 90]] : [[66, 104, 42], [84, 122, 50], [56, 90, 36], [98, 130, 60]];
    for (let y = H * 0.86; y > H * 0.02; y -= 7) {
      const t = 1 - y / H, prof = Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.12) / 0.88 * 0.92 + 0.08)), 0.6);
      for (const side of [-1, 1]) {
        const L = W * 0.48 * prof * (0.85 + r() * 0.2), a = side * (0.55 + r() * 0.15), droop = col ? r() * 0.4 : 0;
        const ex = x0 + Math.sin(a) * L, ey = y - Math.cos(a + side * droop) * L * 0.9;
        g.strokeStyle = rgb(cols[(r() * cols.length) | 0], 0.85 + r() * 0.3); g.lineWidth = 5 + r() * 2; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + ex) / 2, (y + ey) / 2 - 6, ex, ey); g.stroke();
        g.strokeStyle = rgb(cols[0], 1.3, 0.4); g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y); g.lineTo((x0 + ex) / 2, (y + ey) / 2 - 3); g.stroke();
      }
    }
    g.strokeStyle = col ? '#7a6040' : '#8a8a48'; g.lineWidth = 8; g.lineCap = 'butt';
    g.beginPath(); g.moveTo(x0, H); g.lineTo(x0, H * 0.02); g.stroke();
  }
  return (texCache.frond = cutoutTex(cv, g));
}

// Bark: a tiling texture of fissures and ridges (also used as the bump map)
const BARK = {
  oak: { base: [92, 78, 64], dark: [40, 32, 26], light: [128, 116, 100], fis: 30, wob: 5, w: [3, 9] },
  apple: { base: [104, 90, 74], dark: [54, 44, 36], light: [140, 128, 112], fis: 18, wob: 3, w: [2, 5], flakes: true },
  pine: { base: [138, 82, 54], dark: [62, 40, 30], light: [170, 112, 76], fis: 14, wob: 8, w: [3, 6], plates: true },
  spruce: { base: [92, 72, 58], dark: [48, 36, 30], light: [124, 104, 88], fis: 20, wob: 3, w: [1, 3], flakes: true },
  olive: { base: [112, 104, 90], dark: [56, 50, 42], light: [150, 144, 128], fis: 22, wob: 10, w: [2, 7] },
  cypress: { base: [106, 74, 54], dark: [56, 38, 28], light: [138, 102, 78], fis: 34, wob: 2, w: [1, 4] },
  palm: { base: [112, 96, 74], dark: [58, 48, 36], light: [146, 128, 100], palm: true },
};
function barkTex(style) {
  if (texCache['bark_' + style]) return texCache['bark_' + style];
  const st = BARK[style], W = 256, H = 512, [cv, g] = canvas(W, H), r = rng(31 + style.length * 7);
  g.fillStyle = rgb(st.base); g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2500; i++) { g.fillStyle = rgb(r() < 0.5 ? st.dark : st.light, 1, 0.12 + r() * 0.15); g.fillRect(r() * W, r() * H, 1 + r() * 3, 2 + r() * 8); }
  if (st.palm) {
    // leaf-base scars: rings with a criss-cross of diamond scars, fibres between
    for (let y = 0; y < H; y += 64) {
      for (let x = -32; x < W + 32; x += 32) {
        g.fillStyle = rgb(st.dark, 1, 0.7); g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + 16, y + 30); g.lineTo(x + 32, y + 4); g.lineTo(x + 16, y + 14); g.fill();
        g.fillStyle = rgb(st.light, 1, 0.5); g.beginPath(); g.moveTo(x + 16, y + 34); g.lineTo(x + 32, y + 60); g.lineTo(x + 48, y + 34); g.lineTo(x + 32, y + 44); g.fill();
      }
      g.fillStyle = rgb(st.dark, 1, 0.9); g.fillRect(0, y, W, 4);
    }
    for (let i = 0; i < 400; i++) { g.strokeStyle = rgb(st.dark, 1, 0.3); g.lineWidth = 1; const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + 10 + r() * 20); g.stroke(); }
  } else {
    const wiggle = (x0, w, col, a) => {
      for (const dx of [-W, 0, W]) {
        g.strokeStyle = rgb(col, 1, a); g.lineWidth = w; g.beginPath();
        let x = x0 + dx; g.moveTo(x, -10);
        for (let y = 0; y <= H + 10; y += 8) { x += (r() - 0.5) * st.wob; g.lineTo(x, y); }
        g.stroke();
      }
    };
    for (let i = 0; i < st.fis; i++) {
      const x = r() * W, w = st.w[0] + r() * (st.w[1] - st.w[0]);
      wiggle(x + w * 0.7, w * 0.5, st.light, 0.5); wiggle(x, w, st.dark, 0.9);
    }
    if (st.plates) for (let i = 0; i < 60; i++) { g.strokeStyle = rgb(st.dark, 1, 0.8); g.lineWidth = 2; const x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + r() * 30, y + (r() - 0.5) * 8); g.stroke(); }
    if (st.flakes) for (let i = 0; i < 90; i++) { g.fillStyle = rgb(r() < 0.5 ? st.light : st.dark, 1, 0.35); g.fillRect(r() * W, r() * H, 6 + r() * 14, 4 + r() * 10); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return (texCache['bark_' + style] = t);
}

// ---------------------------------------------------------------------------------------------
// Materials: wind in the vertex shader, "plain" parts (fruit, snow) skip the texture, and leaf
// cards keep their rounded crown normals on both faces
const VERT_HEAD = 'uniform float uWindT;\nuniform float uWindS;\nattribute float aSway;\nattribute float aPlain;\nvarying float vPlain;\n';
const VERT_WIND = `#include <begin_vertex>
  vPlain = aPlain;
  {
    vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
    float ph = dot(wp.xz, vec2(0.13, 0.09));
    float s = aSway * uWindS, t = uWindT;
    float fl = sin(t * 6.3 + wp.x * 3.1 + wp.y * 2.3) * 0.22 + sin(t * 8.9 + wp.z * 3.7) * 0.12;
    transformed.x += s * (sin(t * 1.1 + ph) * 0.55 + sin(t * 2.3 + ph * 2.1 + wp.y * 0.4) * 0.25 + fl);
    transformed.z += s * (sin(t * 0.9 + ph * 1.3 + 1.7) * 0.4 + cos(t * 2.7 + ph * 1.7) * 0.2 + fl * 0.8);
    transformed.y += s * fl * 0.5;
  }`;
function windify(mat, leaf) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWindT = U_T; sh.uniforms.uWindS = U_S;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_HEAD).replace('#include <begin_vertex>', VERT_WIND);
    if (sh.fragmentShader.includes('#include <map_fragment>')) {
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vPlain;\n')
        .replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n sampledDiffuseColor.rgb = mix( sampledDiffuseColor.rgb, vec3( 1.0 ), vPlain );\n diffuseColor *= sampledDiffuseColor;\n#endif');
      if (leaf) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\n normal *= faceDirection;\n#endif');
    }
  };
  mat.customProgramCacheKey = () => 'starward-tree-' + (leaf ? 1 : 0);
  return mat;
}
const matCache = {};
function barkMat(style) {
  return (matCache['b' + style] ||= windify(new THREE.MeshLambertMaterial({ map: barkTex(style), bumpMap: barkTex(style), bumpScale: 1.2, vertexColors: true }), false));
}
function leafMat(style) {
  if (matCache['l' + style]) return matCache['l' + style];
  const map = style === 'frond' ? frondTex() : leafTex(style);
  const m = windify(new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, vertexColors: true }), true);
  m.userData.depth = windify(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 }), true);
  return (matCache['l' + style] = m);
}

// ---------------------------------------------------------------------------------------------
// Tubes: a branch is a list of points and radii, skinned with rings (parallel-transport frames).
// o: { sides, col (THREE.Color), barkW (metres per texture tile around), flare, lobes, bumps,
//      nz (noise fn), snow, sway(p) }
function tube(buf, pts, rads, o) {
  const n = pts.length, sides = o.sides, T = [], N = [], B = [];
  for (let i = 0; i < n; i++) T.push(new THREE.Vector3().subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize());
  let nn = Math.abs(T[0].y) < 0.9 ? new THREE.Vector3().crossVectors(T[0], UP).normalize() : new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < n; i++) {
    nn = nn.clone().addScaledVector(T[i], -nn.dot(T[i])).normalize();
    N.push(nn); B.push(new THREE.Vector3().crossVectors(T[i], nn));
  }
  const reps = Math.max(1, Math.round((6.283 * rads[0]) / (o.barkW || 0.7)));
  let along = 0;
  const start = buf.count, snowCol = new THREE.Color(0xeef3fa), mossCol = new THREE.Color(0x56622e), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    if (i) along += pts[i].distanceTo(pts[i - 1]);
    const y = pts[i].y;
    for (let j = 0; j <= sides; j++) {
      const th = (j / sides) * 6.283;
      _u.copy(N[i]).multiplyScalar(Math.cos(th)).addScaledVector(B[i], Math.sin(th));
      let rr = rads[i];
      if (o.flare) rr *= 1 + o.flare * Math.exp(-Math.max(0, y) / 0.45) * (0.55 + 0.45 * Math.sin(o.lobes * th + (o.ph || 0)));
      if (o.bumps) rr *= 1 + o.bumps * (o.nz(th * 1.6 + 3, y * 1.4) - 0.5) * 2;
      _v.copy(pts[i]).addScaledVector(_u, rr);
      col.copy(o.col).multiplyScalar(0.88 + 0.24 * (o.nz ? o.nz(th * 0.8, y * 0.5) : 0.5));
      if (o.moss && y < 1.2) col.lerp(mossCol, o.moss * (1 - y / 1.2) * Math.max(0, _u.x * 0.7 + 0.3));
      let plain = 0;
      if (o.snow && _u.y > 0.2 && Math.abs(T[i].y) < 0.9) {
        const k = sstep(0.2, 0.55, _u.y) * (1 - Math.abs(T[i].y)) * (o.snowK ?? 1);
        if (k > 0.05) { _v.addScaledVector(UP, rr * 0.7 * k + 0.012 * k); col.lerp(snowCol, Math.min(1, k * 1.6)); plain = Math.min(1, k * 1.6); }
      }
      buf.v(_v, _u, (j / sides) * reps, along / ((o.barkW || 0.7) * 2), col, o.sway ? o.sway(_v) : 0, plain);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) {
    const a = start + i * (sides + 1) + j, b = a + sides + 1;
    buf.tri(a, b, a + 1); buf.tri(a + 1, b, b + 1);
  }
}

// A leaf card: a quad with its stem end at p, growing along `up`, facing `nrm`.
// quad = atlas quadrant 0-3 (or 'frond' handled separately); normals bend out from the crown centre
function card(buf, p, up, nrm, w, h, quad, col, sway, crownC, crownBlend = 0.75, half = 2) {
  const side = _w.crossVectors(up, nrm).normalize(), u0 = (quad % half) / half + 0.004, u1 = u0 + 1 / half - 0.008;
  const vT = ((quad / half) | 0) / half + 0.004, vB = vT + 1 / half - 0.008;
  const c = _v.copy(p).addScaledVector(up, h * 0.5), nOut = new THREE.Vector3();
  if (crownC) nOut.subVectors(c, crownC).normalize().multiplyScalar(crownBlend).addScaledVector(nrm, 1 - crownBlend).addScaledVector(UP, 0.25).normalize();
  else nOut.copy(nrm);
  const corners = [[-0.5, -0.06, u0, vB], [0.5, -0.06, u1, vB], [0.5, 0.94, u1, vT], [-0.5, 0.94, u0, vT]], ids = [];
  for (const [sx, sy, u, v] of corners) {
    const q = new THREE.Vector3().copy(p).addScaledVector(side, sx * w).addScaledVector(up, sy * h);
    ids.push(buf.v(q, nOut, u, v, col, sway + (sy > 0.5 ? 0.02 : 0) * Math.sign(sway)));
  }
  buf.tri(ids[0], ids[1], ids[2]); buf.tri(ids[0], ids[2], ids[3]);
}

// A random direction perpendicular to d
function perp(d, r, out = new THREE.Vector3()) {
  const a = Math.abs(d.y) < 0.9 ? UP : _w.set(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(d, a).normalize(), v = new THREE.Vector3().crossVectors(d, u);
  const t = r() * 6.283; return out.copy(u).multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t));
}
function rotateAway(d, ang, az, out = new THREE.Vector3()) {
  const a = Math.abs(d.y) < 0.9 ? UP : _w.set(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(d, a).normalize(), v = new THREE.Vector3().crossVectors(d, u);
  _u.copy(u).multiplyScalar(Math.cos(az)).addScaledVector(v, Math.sin(az));
  return out.copy(d).multiplyScalar(Math.cos(ang)).addScaledVector(_u, Math.sin(ang)).normalize();
}

// ---------------------------------------------------------------------------------------------
// The branching skeleton. P.trunk and P.levels (each level = the branches it spawns on its parent).
//   trunk: { len, rad, sections, sides, gnarl, up, taper, stems, spread }
//   level: { n, start, end, angle, angleVar, lenRatio, shrink, radRatio, sections, sides, gnarl, up, taper }
function skeleton(P, r) {
  const out = [];
  const grow = (start, dir, len, rad, lvl) => {
    const L = lvl ? P.levels[lvl - 1] : P.trunk, ns = Math.max(2, L.sections), step = len / ns;
    const pts = [start.clone()], rads = [rad], dirs = [dir.clone()], d = dir.clone(), p = start.clone();
    for (let i = 1; i <= ns; i++) {
      const g = L.gnarl * (lvl ? 1 : 0.6);
      d.x += (r() - 0.5) * g; d.z += (r() - 0.5) * g; d.y += (r() - 0.5) * g * 0.5;
      d.y += (L.up || 0) * step * (lvl ? 1 : 0.4);
      if (lvl && p.y < 0.6 && d.y < 0.2) d.y += 0.3;           // never dig into the ground
      d.normalize(); p.addScaledVector(d, step);
      pts.push(p.clone()); dirs.push(d.clone());
      rads.push(rad * (1 - (L.taper ?? 0.7) * Math.pow(i / ns, 0.9)));
    }
    const br = { pts, rads, dirs, lvl, len }; out.push(br);
    if (lvl >= P.levels.length) return;
    const C = P.levels[lvl], n = Math.max(1, Math.round(C.n * (0.8 + r() * 0.4))), az0 = r() * 6.28;
    for (let k = 0; k < n; k++) {
      const t = C.start + (C.end - C.start) * (n === 1 ? 1 : (k + 0.2 + r() * 0.6) / n);
      const f = t * ns, i0 = Math.min(ns - 1, Math.floor(f)), fr = f - i0;
      const pos = pts[i0].clone().lerp(pts[i0 + 1], fr), pr = rads[i0] + (rads[i0 + 1] - rads[i0]) * fr, pd = dirs[i0].clone().lerp(dirs[i0 + 1], fr).normalize();
      const ang = C.angle + (r() - 0.5) * (C.angleVar ?? 0.3), cd = rotateAway(pd, ang, az0 + k * 2.39996 + (r() - 0.5) * 0.6);
      const cl = len * C.lenRatio * (1 - (C.shrink ?? 0.4) * t) * (0.8 + r() * 0.4);
      grow(pos, cd, cl, Math.min(pr * 0.92, pr * C.radRatio * (1.1 - t * 0.3)), lvl + 1);
    }
  };
  const T = P.trunk, stems = T.stems || 1;
  for (let s = 0; s < stems; s++) {
    const a = r() * 6.28, lean = stems > 1 ? (T.spread || 0.35) * (0.6 + r() * 0.6) : (T.lean || 0.05) * r();
    const d = new THREE.Vector3(Math.cos(a) * Math.sin(lean), Math.cos(lean), Math.sin(a) * Math.sin(lean));
    grow(new THREE.Vector3(stems > 1 ? Math.cos(a) * T.rad * 0.5 : 0, -0.3, stems > 1 ? Math.sin(a) * T.rad * 0.5 : 0), d,
      T.len * (stems > 1 ? 0.75 + r() * 0.5 : 1), T.rad * (stems > 1 ? 0.75 + r() * 0.4 : 1), 0);
  }
  return out;
}

// Skin a skeleton, put leaf cards on its outer branches. Returns { bark, leaves, crown, info }
function broadleaf(P, o, r) {
  const bark = new Buf(), leaves = new Buf(), nz = noise2(o.seed * 7 + 3);
  const brs = skeleton(P, r), H = o.height, last = P.levels.length;
  // the crown: where the leaves go
  const anchors = [];
  for (const b of brs) if (P.leaf && b.lvl >= last - 1) {
    const isT = b.lvl === last, n = isT ? P.leaf.per : P.leaf.perInner || 0;
    for (let i = 0; i < n; i++) {
      const t = (P.leaf.start ?? 0.25) + (1 - (P.leaf.start ?? 0.25)) * (n === 1 ? 1 : (i + r() * 0.8) / n), f = t * (b.pts.length - 1), i0 = Math.min(b.pts.length - 2, f | 0);
      anchors.push([b.pts[i0].clone().lerp(b.pts[i0 + 1], f - i0), b.dirs[i0 + 1]]);
    }
  }
  const crownC = new THREE.Vector3(); for (const [p] of anchors) crownC.add(p); if (anchors.length) crownC.divideScalar(anchors.length); else crownC.set(0, H * 0.6, 0);
  let crownR = 0.1; for (const [p] of anchors) crownR = Math.max(crownR, p.distanceTo(crownC));
  const swayK = o.sway ?? 0.1, sway = (p) => swayK * Math.pow(Math.max(0, p.y - H * 0.2) / H, 1.3) * (0.35 + Math.hypot(p.x, p.z) / (crownR + 0.5));
  // wood
  const bcol = new THREE.Color(o.barkColor ?? 0xffffff);
  for (const b of brs) {
    const L = b.lvl ? P.levels[b.lvl - 1] : P.trunk;
    tube(bark, b.pts, b.rads, { sides: L.sides, col: bcol, barkW: b.lvl ? 0.4 : 0.7, nz, sway, snow: o.snow, flare: b.lvl ? 0 : P.trunk.flare, lobes: P.trunk.lobes || 5, ph: r() * 6, bumps: b.lvl ? 0 : P.trunk.bumps, moss: b.lvl ? 0 : o.moss });
  }
  // surface roots
  for (let i = 0; i < (P.roots || 0); i++) {
    const a = (i / P.roots) * 6.28 + r() * 0.5, L = P.trunk.rad * (4 + r() * 4), pts = [], rads = [];
    for (let k = 0; k <= 5; k++) { const t = k / 5; pts.push(new THREE.Vector3(Math.cos(a) * (P.trunk.rad * 0.6 + L * t), 0.12 - t * 0.28 + Math.sin(t * 5 + a) * 0.03, Math.sin(a) * (P.trunk.rad * 0.6 + L * t))); rads.push(P.trunk.rad * 0.38 * (1 - t * 0.8)); }
    tube(bark, pts, rads, { sides: 6, col: bcol, barkW: 0.5, nz, moss: o.moss });
  }
  // leaves
  if (P.leaf) {
    const pal = (o.leafColors || [0xffffff, 0xeef4e0, 0xdfe8cc, 0xf4f0d8]).map((h) => new THREE.Color(h)), col = new THREE.Color();
    for (const [p, d] of anchors) {
      for (let k = 0; k < (P.leaf.cards || 1); k++) {
        const up = d.clone().addScaledVector(perp(d, r), 0.9 + r() * 0.5).addScaledVector(UP, P.leaf.upBias ?? 0.2).normalize();
        const nrm = perp(up, r), s = P.leaf.size * (0.75 + r() * 0.5);
        const inner = Math.min(1, p.distanceTo(crownC) / crownR), hgt = (p.y - (crownC.y - crownR)) / (2 * crownR);
        col.copy(pal[(r() * pal.length) | 0]).multiplyScalar((0.5 + 0.5 * Math.pow(inner, 0.8)) * (0.78 + 0.32 * Math.min(1, Math.max(0, hgt))) * (0.9 + r() * 0.2));
        card(leaves, p, up, nrm, s, s, (r() * (P.leaf.quads || 4)) | 0, col, sway(p) + 0.01 + r() * 0.01, crownC);
      }
    }
  }
  return { bark, leaves, crown: { center: crownC, radius: crownR }, brs };
}

// ---------------------------------------------------------------------------------------------
// The kinds. Each `build` returns { bark, leaves, barkStyle, leafStyle, extra }.
const scaleP = (P, k) => {
  P.trunk.len *= k; P.trunk.rad *= k;
  if (P.leaf) P.leaf.size *= k;
  for (const L of P.levels) L.gnarl = L.gnarl ?? 0.3;
  return P;
};

function appleParams(o, hero) {
  const d = o.detail, k = o.height / (hero ? 6 : 4.2);
  return scaleP({
    trunk: { len: hero ? 2.1 : 1.6, rad: hero ? 0.2 : 0.15, sections: pick(d, [3, 5, 9, 14]), sides: pick(d, [5, 7, 11, 16]), gnarl: 0.32, taper: 0.55, flare: 0.55, lobes: 5, bumps: 0.09, lean: 0.2 },
    levels: [
      { n: pick(d, [4, 5, 5, 6]), start: 0.55, end: 1, angle: 1.0, angleVar: 0.25, lenRatio: 1.35, shrink: 0.15, radRatio: 0.72, sections: pick(d, [3, 4, 7, 9]), sides: pick(d, [4, 5, 8, 10]), gnarl: 0.4, up: 0.03, taper: 0.75 },
      { n: pick(d, [3, 5, 6, 7]), start: 0.25, end: 1, angle: 0.85, angleVar: 0.4, lenRatio: 0.55, shrink: 0.4, radRatio: 0.62, sections: pick(d, [2, 3, 4, 6]), sides: pick(d, [3, 4, 5, 7]), gnarl: 0.45, up: -0.02, taper: 0.8 },
      ...(DET[d] >= 1 ? [{ n: pick(d, [0, 4, 5, 5]), start: 0.2, end: 1, angle: 0.9, angleVar: 0.5, lenRatio: 0.5, shrink: 0.3, radRatio: 0.6, sections: pick(d, [2, 2, 3, 3]), sides: pick(d, [3, 3, 4, 4]), gnarl: 0.5, up: 0.04, taper: 0.88 }] : []),
    ],
    leaf: { per: pick(d, [5, 5, 5, 6]), perInner: pick(d, [1, 1, 2, 2]), cards: 1, size: pick(d, [1.1, 0.8, 0.62, 0.52]), start: 0.15, upBias: 0.1 },
    roots: hero ? 6 : DET[d] >= 2 ? 3 : 0,
  }, k);
}

function fruitTree(o, hero) {
  const r = rng(o.seed * 101 + 7), P = appleParams(o, hero);
  const T = broadleaf(P, { ...o, sway: 0.08, moss: 0.35 }, r);
  // apples hang under the twigs, mostly on the outside of the crown
  const apples = [], reserved = [], twigs = T.brs.filter((b) => b.lvl === P.levels.length);
  const n = o.apples ?? (hero ? 40 : 18), ar = (o.appleSize ?? 0.04) * (hero ? 1 : 1.05), colors = o.appleColors || [0xb8261a, 0xa81e16, 0xc83a1e, 0x9aa83a, 0xc05a24];
  for (let i = 0; i < n * 3 && apples.length < n; i++) {
    const b = twigs[(r() * twigs.length) | 0]; if (!b) break;
    const p = b.pts[Math.max(1, b.pts.length - 1 - ((r() * 2) | 0))].clone();
    if (p.distanceTo(T.crown.center) < T.crown.radius * 0.55 || p.y < 1.1) continue;
    p.y -= 0.03 + ar;
    apples.push({ pos: p, r: ar * (0.85 + r() * 0.3), color: colors[(r() * colors.length) | 0], stem: b.pts[b.pts.length - 1] });
  }
  if (o.reserveApples) {
    const near = o.reserveNear || new THREE.Vector3(0, 2, 1);
    apples.sort((a, b) => a.pos.distanceTo(near) - b.pos.distanceTo(near));
    reserved.push(...apples.splice(0, o.reserveApples));
  }
  for (const a of apples) appleInto(T.bark, a.pos, a.r, a.color, hero ? 2 : 1, 0.06, r);
  // windfalls on the grass
  const ground = o.ground || (() => 0);
  for (let i = 0; i < (o.windfalls ?? (hero ? 8 : 3)); i++) {
    const a = r() * 6.28, d = 0.6 + r() * T.crown.radius * 0.9, x = Math.cos(a) * d, z = Math.sin(a) * d, ar2 = ar * (0.9 + r() * 0.2);
    appleInto(T.bark, new THREE.Vector3(x, ground(x, z) + ar2 * 0.75, z), ar2, r() < 0.7 ? 0x8e2414 : 0x8a7a30, hero ? 2 : 0, 0, r);
  }
  return { bark: T.bark, leaves: T.leaves, barkStyle: 'apple', leafStyle: 'apple', crown: T.crown, extra: { apples, reserved } };
}

// An apple: a slightly squashed, dimpled ball with a blush, and a little stem
function appleGeo(rad, detail, color, r = Math.random) {
  const g = new THREE.IcosahedronGeometry(rad, detail), p = g.attributes.position, n = p.count, cols = new Float32Array(n * 3);
  const c0 = new THREE.Color(color), c1 = new THREE.Color(color).lerp(new THREE.Color(0xd8b040), 0.45), c = new THREE.Color(), ph = r() * 6;
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = y / rad;
    const dim = 1 - 0.28 * Math.exp(-Math.pow((1 - Math.abs(ny)) * 4, 2));
    p.setXYZ(i, x * 1.06, y * 0.9 * dim, z * 1.06);
    c.copy(c0).lerp(c1, Math.max(0, Math.sin(Math.atan2(z, x) + ph)) * 0.6 * (1 - Math.abs(ny)));
    cols.set([c.r, c.g, c.b], i * 3);
    _v.set(x, y, z).normalize(); g.attributes.normal.setXYZ(i, _v.x, _v.y, _v.z);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}
function appleInto(buf, pos, rad, color, detail, stemLen, r) {
  const g = appleGeo(rad, detail, color, r), p = g.attributes.position, nn = g.attributes.normal, c = g.attributes.color, base = buf.count;
  const sw = 0.05;
  for (let i = 0; i < p.count; i++) {
    _v.set(p.getX(i) + pos.x, p.getY(i) + pos.y, p.getZ(i) + pos.z); _u.set(nn.getX(i), nn.getY(i), nn.getZ(i));
    _c.setRGB(c.getX(i), c.getY(i), c.getZ(i)); buf.v(_v, _u, 0, 0, _c, stemLen ? sw : 0, 1);
  }
  for (let i = 0; i < p.count; i += 3) buf.tri(base + i, base + i + 1, base + i + 2);
  if (stemLen) {
    const a = pos.clone().setY(pos.y + rad * 0.8), b = pos.clone().setY(pos.y + rad + stemLen);
    tube(buf, [a, b], [0.004, 0.003], { sides: 3, col: new THREE.Color(0x4a3a22), sway: () => sw });
  }
  g.dispose();
}
// A loose apple mesh for the story (same look as the ones on the tree)
export function makeApple(rad = 0.04, color = 0xb8261a) {
  const g = appleGeo(rad, 2, color);
  const stem = new THREE.CylinderGeometry(0.003, 0.004, 0.025, 4).toNonIndexed(); stem.translate(0, rad * 0.85, 0);
  stem.setAttribute('color', new THREE.BufferAttribute(new Float32Array(stem.attributes.position.count * 3).fill(0.06), 3)); stem.deleteAttribute('uv');
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  m.add(new THREE.Mesh(stem, m.material));
  return m;
}

function oakParams(o, bare) {
  const d = o.detail, elm = o.shape === 'elm', k = o.height / 12;
  const lv = [
    { n: pick(d, [4, 5, 6, 7]), start: elm ? 0.35 : 0.42, end: 1, angle: elm ? 0.55 : 0.85, angleVar: 0.3, lenRatio: elm ? 0.85 : 0.95, shrink: 0.35, radRatio: 0.68, sections: pick(d, [3, 4, 7, 10]), sides: pick(d, [4, 6, 8, 12]), gnarl: 0.32, up: elm ? 0.05 : 0.035, taper: 0.72 },
    { n: pick(d, [4, 5, 6, 7]), start: 0.25, end: 1, angle: 0.75, angleVar: 0.4, lenRatio: 0.55, shrink: 0.35, radRatio: 0.6, sections: pick(d, [2, 3, 4, 6]), sides: pick(d, [3, 4, 5, 7]), gnarl: 0.45, up: 0.02, taper: 0.8 },
  ];
  if (DET[d] >= 1 || bare) lv.push({ n: pick(d, [3, 4, 5, 6]), start: 0.2, end: 1, angle: 0.8, angleVar: 0.5, lenRatio: 0.5, shrink: 0.3, radRatio: 0.6, sections: pick(d, [2, 2, 3, 3]), sides: pick(d, [3, 3, 4, 4]), gnarl: 0.55, up: 0.03, taper: 0.88 });
  if (bare && DET[d] >= 2) lv.push({ n: pick(d, [0, 0, 4, 5]), start: 0.25, end: 1, angle: 0.75, angleVar: 0.5, lenRatio: 0.5, shrink: 0.3, radRatio: 0.6, sections: 2, sides: 3, gnarl: 0.6, up: 0.06, taper: 0.9 });
  return scaleP({
    trunk: { len: elm ? 6.5 : 5.2, rad: 0.42, sections: pick(d, [4, 6, 10, 16]), sides: pick(d, [5, 8, 12, 16]), gnarl: 0.18, taper: 0.62, flare: 0.5, lobes: 6, bumps: 0.08, lean: 0.12 },
    levels: lv,
    leaf: bare ? null : { per: pick(d, [6, 5, 5, 6]), perInner: pick(d, [2, 2, 2, 2]), cards: 1, size: pick(d, [2.8, 2.0, 1.5, 1.15]), start: 0.15, upBias: 0.2 },
    roots: DET[d] >= 2 ? 5 : 0,
  }, k);
}

function buildDeciduous(o) {
  const r = rng(o.seed * 131 + 11), T = broadleaf(oakParams(o, false), { ...o, sway: 0.16, moss: 0.4 }, r);
  return { bark: T.bark, leaves: T.leaves, barkStyle: 'oak', leafStyle: 'broad', crown: T.crown };
}
function buildBare(o) {
  const r = rng(o.seed * 137 + 5), T = broadleaf(oakParams(o, true), { ...o, sway: 0.1, moss: o.snow ? 0 : 0.3 }, r);
  return { bark: T.bark, leaves: T.leaves, barkStyle: 'oak', leafStyle: 'broad', crown: T.crown };
}
function buildOlive(o) {
  const d = o.detail, k = o.height / 4.5, r = rng(o.seed * 151 + 3);
  const P = scaleP({
    trunk: { len: 1.9, rad: 0.17, stems: 2 + ((r() * 2) | 0), spread: 0.35, sections: pick(d, [3, 5, 8, 12]), sides: pick(d, [5, 7, 10, 14]), gnarl: 0.55, taper: 0.5, flare: 0.7, lobes: 4, bumps: 0.18 },
    levels: [
      { n: pick(d, [3, 4, 5, 5]), start: 0.45, end: 1, angle: 0.8, angleVar: 0.4, lenRatio: 0.9, shrink: 0.3, radRatio: 0.7, sections: pick(d, [3, 4, 6, 8]), sides: pick(d, [3, 5, 7, 9]), gnarl: 0.5, up: 0.04, taper: 0.75 },
      { n: pick(d, [3, 4, 5, 6]), start: 0.25, end: 1, angle: 0.8, angleVar: 0.5, lenRatio: 0.6, shrink: 0.3, radRatio: 0.6, sections: pick(d, [2, 3, 3, 4]), sides: pick(d, [3, 3, 4, 5]), gnarl: 0.55, up: 0.0, taper: 0.85 },
    ],
    leaf: { per: pick(d, [6, 6, 7, 8]), perInner: 2, cards: 1, size: pick(d, [1.25, 0.95, 0.78, 0.6]), start: 0.15, upBias: 0.1 },
    roots: DET[d] >= 2 ? 4 : 0,
  }, k);
  const T = broadleaf(P, { ...o, sway: 0.07, leafColors: [0xffffff, 0xe8f0f0, 0xf0f0e0, 0xdde6dd] }, r);
  return { bark: T.bark, leaves: T.leaves, barkStyle: 'olive', leafStyle: 'olive', crown: T.crown };
}
function buildBush(o) {
  const d = o.detail, k = o.height / 1.2, r = rng(o.seed * 173 + 1);
  const P = scaleP({
    trunk: { len: 0.7, rad: 0.025, stems: 5, spread: 0.6, sections: 3, sides: pick(d, [3, 3, 4, 5]), gnarl: 0.5, taper: 0.7 },
    levels: [{ n: pick(d, [2, 3, 4, 4]), start: 0.3, end: 1, angle: 0.7, angleVar: 0.4, lenRatio: 0.7, shrink: 0.3, radRatio: 0.6, sections: 2, sides: 3, gnarl: 0.5, up: 0.05, taper: 0.85 }],
    leaf: { per: pick(d, [3, 4, 5, 6]), perInner: 2, cards: 1, size: pick(d, [0.7, 0.55, 0.45, 0.38]), start: 0.1, upBias: 0.3 },
  }, k);
  const T = broadleaf(P, { ...o, sway: 0.04 }, r);
  return { bark: T.bark, leaves: T.leaves, barkStyle: 'apple', leafStyle: o.leaf || 'broad', crown: T.crown };
}

// Spruce: tiers of drooping branches all the way up, covered in needle sprays
function buildSpruce(o) {
  const d = o.detail, H = o.height, r = rng(o.seed * 211 + 9), nz = noise2(o.seed * 5 + 1);
  const bark = new Buf(), leaves = new Buf(), R = H * (o.width ?? 0.27), base = H * (o.crownBase ?? 0.06);
  const sway = (p) => 0.08 * Math.pow(Math.max(0, p.y) / H, 1.4) * (0.4 + Math.hypot(p.x, p.z) / R);
  // trunk
  const tp = [], tr = [], ns = pick(d, [4, 6, 10, 16]), lean = new THREE.Vector3((r() - 0.5) * 0.04, 1, (r() - 0.5) * 0.04);
  for (let i = 0; i <= ns; i++) { const t = i / ns; tp.push(new THREE.Vector3(lean.x * t * H + (nz(t * 4, 1) - 0.5) * 0.08, -0.3 + t * (H + 0.3), lean.z * t * H + (nz(t * 4, 5) - 0.5) * 0.08)); tr.push(H * 0.022 * (1 - t * 0.95)); }
  tube(bark, tp, tr, { sides: pick(d, [5, 6, 9, 12]), col: new THREE.Color(0xffffff), barkW: 0.5, nz, sway, flare: 0.4, lobes: 5, bumps: 0.04 });
  const trunkAt = (y) => { const t = (y + 0.3) / (H + 0.3), f = t * ns, i0 = Math.min(ns - 1, f | 0); return tp[i0].clone().lerp(tp[i0 + 1], f - i0); };
  const gap = pick(d, [0.62, 0.5, 0.38, 0.28]) * H / 10, nb = pick(d, [5, 6, 6, 7]), sprays = pick(d, [2, 3, 4, 6]);
  const pal = [0xffffff, 0xe6eedc, 0xd4e0cc].map((h) => new THREE.Color(h)), col = new THREE.Color(), crownC = new THREE.Vector3(0, H * 0.4, 0);
  for (let y = base; y < H * 0.96; y += gap * (0.85 + r() * 0.3)) {
    const t = (y - base) / (H - base), rad = R * Math.pow(1 - t, 0.95) + 0.12, az0 = r() * 6.28, droop = 0.35 + (1 - t) * 0.35;
    const nbr = t > 0.85 ? Math.max(3, nb - 2) : nb;
    for (let b = 0; b < nbr; b++) {
      const az = az0 + (b / nbr) * 6.28 + (r() - 0.5) * 0.5, L = rad * (0.8 + r() * 0.35), dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
      const st = trunkAt(y), pts = [], m = pick(d, [2, 3, 4, 5]);
      for (let j = 0; j <= m; j++) { const s = j / m; pts.push(st.clone().addScaledVector(dir, s * L).add(_v.set(0, (0.15 * s - droop * s * s + 0.35 * Math.pow(s, 4)) * L * 0.6, 0))); }
      if (DET[d] >= 1) tube(bark, pts, pts.map((_, j) => H * 0.006 * (1 - j / (m + 0.5))), { sides: pick(d, [3, 3, 4, 5]), col: new THREE.Color(0xd0c8c0), barkW: 0.3, sway, snow: o.snow });
      // needle sprays along the branch: one lying flat, one tilted down across it (so it looks full from the side)
      for (let s = 0; s < sprays; s++) {
        const u = 0.12 + (s / sprays) * 0.86, f = u * m, i0 = Math.min(m - 1, f | 0), p = pts[i0].clone().lerp(pts[i0 + 1], f - i0);
        const tang = pts[i0 + 1].clone().sub(pts[i0]).normalize(), w = Math.min(1.6, Math.max(0.4, L * 0.65)) * (0.8 + r() * 0.4) * (DET[d] ? 1 : 1.4);
        const side = _u.crossVectors(tang, UP).normalize().clone();
        const flat = UP.clone().applyAxisAngle(tang, (r() - 0.5) * 0.6), hang = UP.clone().applyAxisAngle(tang, 1.1 * (r() < 0.5 ? 1 : -1));
        const start = p.clone().addScaledVector(tang, -w * 0.45);
        const shade = (0.55 + 0.45 * u) * (0.8 + 0.3 * t) * (0.9 + r() * 0.2);
        col.copy(pal[(r() * 3) | 0]).multiplyScalar(shade);
        const snowy = o.snow && r() < 0.85;
        card(leaves, start, tang, flat, w * 0.85, w, snowy ? 2 + ((r() * 2) | 0) : (r() * 2) | 0, col, sway(p) + 0.01, crownC, 0.45);
        if (DET[d] >= 1 || r() < 0.5) card(leaves, start.clone().addScaledVector(side, 0), tang, hang, w * 0.7, w * 0.95, snowy && r() < 0.6 ? 2 + ((r() * 2) | 0) : (r() * 2) | 0, col.clone().multiplyScalar(0.85), sway(p) + 0.01, crownC, 0.45);
      }
    }
  }
  // the leader: a spire of upright sprays
  for (let i = 0; i < 3; i++) { const a = i * 2.1, n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); col.copy(pal[0]).multiplyScalar(0.95); card(leaves, trunkAt(H * 0.9), UP, n, 0.5 * H / 10, H * 0.12, o.snow ? 2 : 0, col, sway(UP.clone().multiplyScalar(H)), crownC, 0.3); }
  return { bark, leaves, barkStyle: 'spruce', leafStyle: 'needle', crown: { center: crownC, radius: R } };
}

// Scots pine: a tall straight trunk, bare below, a flat-topped crown of needle tufts
function buildPine(o) {
  const d = o.detail, k = o.height / 16, r = rng(o.seed * 223 + 4);
  const P = scaleP({
    trunk: { len: 15, rad: 0.3, sections: pick(d, [4, 6, 10, 14]), sides: pick(d, [5, 7, 10, 14]), gnarl: 0.1, taper: 0.85, flare: 0.3, lobes: 5, bumps: 0.04, lean: 0.12 },
    levels: [
      { n: pick(d, [7, 10, 12, 14]), start: 0.58, end: 1, angle: 1.2, angleVar: 0.3, lenRatio: 0.3, shrink: 0.55, radRatio: 0.45, sections: pick(d, [2, 3, 5, 6]), sides: pick(d, [3, 4, 5, 6]), gnarl: 0.35, up: 0.07, taper: 0.7 },
      { n: pick(d, [3, 5, 6, 7]), start: 0.25, end: 1, angle: 0.75, angleVar: 0.4, lenRatio: 0.5, shrink: 0.3, radRatio: 0.6, sections: 2, sides: 3, gnarl: 0.4, up: 0.06, taper: 0.85 },
    ],
  }, k);
  const T = broadleaf(P, { ...o, sway: 0.12 }, r), H = o.height, sz = pick(d, [3.6, 2.7, 2.3, 1.9]) * k;
  // needle pads: at each twig, one flat tuft (needles fanning up) and two crossed upright ones
  const tips = [], last = P.levels.length;
  for (const b of T.brs) if (b.lvl >= last - 1) for (const f of b.lvl === last ? (DET[d] >= 2 ? [0.35, 0.7, 1] : [0.5, 1]) : [1]) { const i = Math.round(f * (b.pts.length - 1)); tips.push([b.pts[i], b.dirs[i]]); }
  const cc = new THREE.Vector3(); for (const [p] of tips) cc.add(p); cc.divideScalar(Math.max(1, tips.length));
  let cr = 0.1; for (const [p] of tips) cr = Math.max(cr, p.distanceTo(cc));
  const sway = (p) => 0.12 * Math.pow(Math.max(0, p.y - H * 0.2) / H, 1.3) * (0.35 + Math.hypot(p.x, p.z) / (cr + 0.5));
  const col = new THREE.Color(), quad = () => (o.snow && r() < 0.7 ? 2 : 0) + ((r() * 2) | 0);
  for (const [p, dir] of tips) {
    const s = sz * (0.8 + r() * 0.4), inner = Math.min(1, p.distanceTo(cc) / cr), hz = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    col.setScalar((0.55 + 0.45 * inner) * (0.9 + r() * 0.2));
    card(T.leaves, p.clone().addScaledVector(hz, -s * 0.35), hz, UP.clone().applyAxisAngle(hz, (r() - 0.5) * 0.5), s * 0.9, s, quad(), col, sway(p) + 0.01, cc, 0.5);
    for (let k2 = 0; k2 < pick(d, [1, 2, 2, 2]); k2++) {
      const n = perp(UP, r), up = UP.clone().addScaledVector(hz, 0.4).normalize();
      card(T.leaves, p.clone().addScaledVector(up, -s * 0.3), up, n, s * 0.85, s * 0.8, quad(), col.clone().multiplyScalar(0.9), sway(p) + 0.01, cc, 0.5);
    }
  }
  return { bark: T.bark, leaves: T.leaves, barkStyle: 'pine', leafStyle: 'pine', crown: { center: cc, radius: cr } };
}

// Italian cypress (narrow flame) or Lombardy poplar (taller column of bright leaves)
function buildColumn(o, poplar) {
  const d = o.detail, H = o.height, r = rng(o.seed * 233 + (poplar ? 2 : 8)), nz = noise2(o.seed * 3 + 2);
  const bark = new Buf(), leaves = new Buf(), R = H * (o.width ?? (poplar ? 0.12 : 0.085));
  const env = poplar ? (t) => R * Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.95)), 0.55) * (t < 0.05 ? 0.6 : 1)
    : (t) => R * Math.min(1, (1 - t) / 0.55) ** 0.75 * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.6))) * (t < 0.04 ? 0.7 : 1);
  const sway = (p) => (poplar ? 0.14 : 0.07) * Math.pow(Math.max(0, p.y) / H, 1.5);
  const ns = pick(d, [3, 5, 8, 12]), tp = [], tr = [];
  for (let i = 0; i <= ns; i++) { const t = i / ns; tp.push(new THREE.Vector3((nz(t * 3, 1) - 0.5) * 0.15, -0.3 + t * H * 0.95, (nz(t * 3, 4) - 0.5) * 0.15)); tr.push(R * (poplar ? 0.3 : 0.22) * (1 - t * 0.9)); }
  tube(bark, tp, tr, { sides: pick(d, [5, 6, 8, 12]), col: new THREE.Color(0xffffff), barkW: 0.5, nz, sway, flare: 0.5, lobes: 5, bumps: 0.06 });
  // upward limbs inside the column
  const nl = pick(d, [0, 8, 16, 26]), y0 = H * (poplar ? 0.08 : 0.04);
  for (let i = 0; i < nl; i++) {
    const t = 0.08 + r() * 0.8, y = y0 + t * (H - y0), a = r() * 6.28, e = env(t) * 0.85, st = new THREE.Vector3(0, y, 0);
    const pts = [st, st.clone().add(_v.set(Math.cos(a) * e * 0.5, e * 0.9, Math.sin(a) * e * 0.5)), st.clone().add(_v.set(Math.cos(a) * e, e * 2.2, Math.sin(a) * e))];
    tube(bark, pts, [R * 0.06, R * 0.04, R * 0.01], { sides: 3, col: new THREE.Color(0xd8d0c8), barkW: 0.3, sway });
  }
  const N = pick(d, poplar ? [150, 420, 1000, 1500] : [70, 280, 560, 1000]), sz = pick(d, [2.0, 1.1, 0.8, 0.6]) * (poplar ? 1.5 : R / 0.94);
  const crownC = new THREE.Vector3(0, H * 0.45, 0), col = new THREE.Color(), pal = [0xffffff, 0xe8eedc, 0xdde6d0].map((h) => new THREE.Color(h));
  for (let i = 0; i < N; i++) {
    const t = Math.pow(r(), 0.85), y = y0 + t * (H - y0), a = r() * 6.28, rr = env(t) * (0.5 + 0.5 * Math.sqrt(r()));
    const p = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr), out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(out, 0.35 + r() * 0.3).addScaledVector(perp(UP, r), 0.3).normalize();
    const nrm = out.clone().applyAxisAngle(up, (r() - 0.5) * 1.2), s = sz * (0.75 + r() * 0.5) * (0.6 + 0.4 * Math.min(1, env(t) / R));
    const inner = rr / (env(t) + 0.01);
    col.copy(pal[(r() * 3) | 0]).multiplyScalar((0.55 + 0.45 * inner) * (0.82 + 0.25 * t) * (0.9 + r() * 0.2));
    card(leaves, p.addScaledVector(up, -s * 0.4), up, nrm, s * 0.8, s, (r() * 4) | 0, col, sway(p) + 0.006, new THREE.Vector3(0, y, 0), 0.7);
  }
  return { bark, leaves, barkStyle: poplar ? 'oak' : 'cypress', leafStyle: poplar ? 'poplar' : 'scale', crown: { center: crownC, radius: H * 0.5 } };
}

// Date palm: a ringed, leaning trunk with a crown of arching fronds, dry fronds below, dates
function buildPalm(o) {
  const d = o.detail, H = o.height, r = rng(o.seed * 241 + 6), nz = noise2(o.seed * 11 + 5);
  const bark = new Buf(), leaves = new Buf(), lean = (o.lean ?? 0.12) * (0.5 + r()), la = r() * 6.28;
  const ns = pick(d, [4, 6, 10, 16]), tp = [], tr = [];
  for (let i = 0; i <= ns; i++) {
    const t = i / ns, off = lean * H * (t * t * 0.6 + t * 0.4);
    tp.push(new THREE.Vector3(Math.cos(la) * off + Math.sin(t * 3 + la) * 0.08, -0.3 + t * (H + 0.3), Math.sin(la) * off));
    tr.push(H * 0.022 * (1 + 0.5 * Math.exp(-t * 14) - 0.12 * t + 0.1 * sstep(0.93, 1, t)));
  }
  const top = tp[ns].clone(), sway = (p) => 0.05 * Math.pow(Math.max(0, p.y) / H, 2) + 0.12 * Math.min(1, p.distanceTo(top) / (H * 0.45)) * (p.y > H * 0.6 ? 1 : 0);
  tube(bark, tp, tr, { sides: pick(d, [5, 7, 10, 14]), col: new THREE.Color(0xffffff), barkW: 0.65, nz, sway });
  // leaf boots: the cut-off frond bases around the top of the trunk
  for (let i = 0; i < pick(d, [0, 6, 10, 16]); i++) {
    const a = r() * 6.28, y = H * (0.86 + r() * 0.12), c = trunkPoint(tp, ns, y, H), dir = new THREE.Vector3(Math.cos(a), 1.2, Math.sin(a)).normalize();
    tube(bark, [c, c.clone().addScaledVector(dir, H * 0.04)], [H * 0.01, H * 0.004], { sides: 3, col: new THREE.Color(0xb09a78), barkW: 0.3, sway });
  }
  // fronds: a V-folded strip along an arching spine, young ones upright, old ones drooping
  const nF = pick(d, [10, 16, 22, 28]), segs = pick(d, [4, 5, 7, 9]), green = new THREE.Color(), up2 = new THREE.Vector3();
  const frond = (az, elev, L, dry) => {
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev)), p = top.clone().add(_v.set(0, -H * 0.02, 0));
    const rows = [], Wm = L * (DET[d] ? 0.17 : 0.22);
    for (let k = 0; k <= segs; k++) {
      const t = k / segs, side = new THREE.Vector3().crossVectors(dir, UP).normalize(), nrm = new THREE.Vector3().crossVectors(side, dir).normalize();
      const prof = t < 0.12 ? 0.08 : Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.12) / 0.88 * 0.92 + 0.08)), 0.6);
      rows.push([p.clone(), side, nrm, Wm * prof, t]);
      p.addScaledVector(dir, L / segs); dir.y -= (dry ? 0.5 : 0.22 + 0.25 * t) * (1 / segs) * 2.2; dir.normalize();
    }
    const ids = [];
    for (const [q, side, nrm, w, t] of rows) {
      green.setScalar(dry ? 0.9 : 1).multiplyScalar(0.85 + r() * 0.1);
      const fold = 0.35, sw = sway(q);
      up2.copy(nrm).multiplyScalar(dry ? -1 : 1);
      const nOut = new THREE.Vector3().subVectors(q, top).normalize().multiplyScalar(0.5).add(nrm).normalize();
      const u0 = dry ? 0.5 : 0, uw = 0.5;
      const a = leaves.v(_v.copy(q).addScaledVector(side, -w).addScaledVector(up2, w * fold), nOut, u0 + 0.01, 1 - t * 0.98, green, sw);
      const b = leaves.v(q, nOut, u0 + uw * 0.5, 1 - t * 0.98, green, sw);
      const c = leaves.v(_v.copy(q).addScaledVector(side, w).addScaledVector(up2, w * fold), nOut, u0 + uw - 0.01, 1 - t * 0.98, green, sw);
      ids.push([a, b, c]);
    }
    for (let k = 0; k < segs; k++) { const [a, b, c] = ids[k], [a2, b2, c2] = ids[k + 1]; leaves.tri(a, a2, b); leaves.tri(b, a2, b2); leaves.tri(b, b2, c); leaves.tri(c, b2, c2); }
  };
  for (let i = 0; i < nF; i++) {
    const t = i / nF, az = i * 2.39996 + r() * 0.3, elev = 1.0 - t * 1.35 + (r() - 0.5) * 0.2;
    frond(az, elev, H * (0.36 + 0.12 * t) * (0.9 + r() * 0.2), false);
  }
  for (let i = 0; i < pick(d, [0, 3, 5, 8]); i++) frond(r() * 6.28, -1.1 - r() * 0.3, H * 0.33, true);
  // dates: orange-gold bunches hanging under the crown
  if (o.dates && DET[d] >= 1) for (let c = 0; c < 3; c++) {
    const a = r() * 6.28, cc = top.clone().add(_v.set(Math.cos(a) * H * 0.05, -H * 0.06, Math.sin(a) * H * 0.05));
    for (let i = 0; i < pick(d, [0, 10, 20, 30]); i++) {
      const p = cc.clone().add(_v.set((r() - 0.5) * 0.3, -r() * 0.5, (r() - 0.5) * 0.3));
      appleInto(bark, p, 0.022, [0xd08a2a, 0xc0661e, 0xe0a03a][(r() * 3) | 0], 0, 0, r);
    }
  }
  return { bark, leaves, barkStyle: 'palm', leafStyle: 'frond', crown: { center: top, radius: H * 0.4 } };
}
function trunkPoint(tp, ns, y, H) { const t = Math.min(0.999, Math.max(0, (y + 0.3) / (H + 0.3))), f = t * ns, i0 = f | 0; return tp[i0].clone().lerp(tp[i0 + 1], f - i0); }

// ---------------------------------------------------------------------------------------------
// Public builders
const DEFAULTS = {
  appleTree: { height: 6, detail: 'hero' }, orchardTree: { height: 4.2, detail: 'mid' }, deciduousTree: { height: 12, detail: 'high' },
  bareTree: { height: 10, detail: 'high' }, conifer: { height: 11, detail: 'high', type: 'spruce' }, cypress: { height: 11, detail: 'high' },
  poplar: { height: 16, detail: 'high' }, palm: { height: 9, detail: 'high' }, olive: { height: 4.5, detail: 'high' }, bush: { height: 1.2, detail: 'mid' },
};
const BUILD = {
  appleTree: (o) => fruitTree(o, true), orchardTree: (o) => fruitTree(o, false), deciduousTree: buildDeciduous, bareTree: buildBare,
  conifer: (o) => (o.type === 'pine' ? buildPine(o) : buildSpruce(o)), cypress: (o) => buildColumn(o, false), poplar: (o) => buildColumn(o, true),
  palm: buildPalm, olive: buildOlive, bush: buildBush,
};

function meshes(bark, leaves, bs, ls) {
  const group = new THREE.Group(), out = { group, tris: 0 };
  if (bark.tris) { out.bark = new THREE.Mesh(bark.geometry(), barkMat(bs)); out.bark.onBeforeRender = tick; group.add(out.bark); out.tris += bark.tris; }
  if (leaves.tris) {
    const m = leafMat(ls); out.leaves = new THREE.Mesh(leaves.geometry(), m); out.leaves.customDepthMaterial = m.userData.depth;
    out.leaves.onBeforeRender = tick; group.add(out.leaves); out.tris += leaves.tris;
  }
  return out;
}

function make(kind, o) {
  const opts = { seed: 1, ...DEFAULTS[kind], ...o };
  const b = BUILD[kind](opts), out = meshes(b.bark, b.leaves, b.barkStyle, b.leafStyle);
  out.height = opts.height; out.crown = b.crown; out.kind = kind;
  if (b.extra) Object.assign(out, b.extra);
  return out;
}
export const appleTree = (o = {}) => make('appleTree', o);
export const orchardTree = (o = {}) => make('orchardTree', o);
export const deciduousTree = (o = {}) => make('deciduousTree', o);
export const bareTree = (o = {}) => make('bareTree', o);
export const conifer = (o = {}) => make('conifer', o);
export const cypress = (o = {}) => make('cypress', o);
export const poplar = (o = {}) => make('poplar', o);
export const palm = (o = {}) => make('palm', o);
export const olive = (o = {}) => make('olive', o);
export const bush = (o = {}) => make('bush', o);
const KIND_OF = new Map([[appleTree, 'appleTree'], [orchardTree, 'orchardTree'], [deciduousTree, 'deciduousTree'], [bareTree, 'bareTree'], [conifer, 'conifer'], [cypress, 'cypress'], [poplar, 'poplar'], [palm, 'palm'], [olive, 'olive'], [bush, 'bush']]);

// Many trees of one kind as 2 meshes. kind: one of the builders above (or its name).
// spots: [{ x, y, z, s (size, x the height), yaw }]. opts: the kind's options (height, snow, ...),
// plus detail (default 'low'), variants (how many different trees to grow, default 4), seed.
export function grove(kind, spots, o = {}) {
  const name = typeof kind === 'string' ? kind : KIND_OF.get(kind);
  const opts = { seed: 1, ...DEFAULTS[name], detail: 'low', ...o }, nv = Math.max(1, Math.min(spots.length, opts.variants ?? 4));
  const vars = [];
  for (let i = 0; i < nv; i++) vars.push(BUILD[name]({ ...opts, seed: opts.seed * 17 + i * 31, apples: opts.apples ?? (name === 'orchardTree' ? 10 : 0), windfalls: opts.windfalls ?? 0, reserveApples: 0 }));
  const bark = new Buf(), leaves = new Buf(), r = rng(opts.seed * 7 + 1), m = new THREE.Matrix4(), nm = new THREE.Matrix3(), q = new THREE.Quaternion(), tint = new THREE.Color();
  spots.forEach((s, i) => {
    const v = vars[i % nv], sc = s.s ?? 1;
    q.setFromAxisAngle(UP, s.yaw ?? r() * 6.283);
    m.compose(_v.set(s.x, s.y ?? 0, s.z), q, _w.set(sc, sc, sc)); nm.getNormalMatrix(m);
    tint.setRGB(0.9 + r() * 0.2, 0.9 + r() * 0.2, 0.9 + r() * 0.15);
    bark.append(v.bark, m, nm, tint, sc);
    tint.setRGB(0.85 + r() * 0.25, 0.88 + r() * 0.22, 0.85 + r() * 0.2);
    leaves.append(v.leaves, m, nm, tint, sc);
  });
  const out = meshes(bark, leaves, vars[0].barkStyle, vars[0].leafStyle);
  out.count = spots.length;
  return out;
}

// Triangles of a single tree of this kind and detail (handy when planning a scene's budget)
export function treeTris(kind, o = {}) { const name = typeof kind === 'string' ? kind : KIND_OF.get(kind); const b = BUILD[name]({ seed: 1, ...DEFAULTS[name], ...o }); return b.bark.tris + b.leaves.tris; }
