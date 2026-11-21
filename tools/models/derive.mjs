// First-pass characters made by reworking Meem's Tripo models, until Meem makes the real ones.
//
//   cd tools/models && npm install && node derive.mjs            (all of them)
//   node derive.mjs architect --debug                            (one, with its paint regions shown in flat colours)
//
// Each recipe starts from one of the rigged models in models/, keeps its Mixamo skeleton (so every
// pose in js/people.js still works), and then:
//   - repaints parts of its texture (hair, clothes, an apron...), chosen by where they are on the body,
//   - can reshape the body a little (a belly, broader shoulders), moving vertices in the rest pose,
//   - can be simplified to fewer triangles with a smaller texture, for people seen from far away.
// The result is written to models/<file> and replaces nothing of Meem's: to swap in a better Tripo
// model later, just overwrite that file (same name) or point models/index.json at the new one.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const MODELS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../models');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// ---------- little colour helpers (0..1) ----------
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-5) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx ? d / mx : 0, mx];
}
// skin: warm orange-brown, fairly saturated, not too dark
const isSkin = (r, g, b) => { const [h, s, v] = hsv(r, g, b); return h > 5 && h < 40 && s > 0.28 && s < 0.75 && v > 0.42 && r > g && g > b; };
// Keep the original's light and shade but swap its colour: `base` scaled by how light the texel
// was compared with `mid` (the typical lightness of what's being recoloured)
const shade = (base, mid, k = 1) => (r, g, b) => { const f = 1 + (lum(r, g, b) / mid - 1) * k; return base.map((c) => c * f); };
// a cheap hash noise, for texture in flat paint (hair strands, leather grain)
const noise = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };

// ---------- the recipes ----------
// region(q, n, body) gets a point on the body and its surface direction, in the rest pose, measured in
// body heights (y 0 at the feet .. 1 at the top of the head; x across, z forward), and returns the name
// of a paint to use there (or nothing). paint[name](r, g, b, at) returns the new colour, or null to
// keep the old one (at: { q, n, x, y (texel), busy (how patterned the original is there), body }).
const RECIPES = {
  // Ch3 cameo: the Great Pyramid's architect (like Hemiunu, whose statue shows a well-fed official),
  // from the Egyptian priest: a short black wig, a plain red sash instead of the leopard skin, a belly.
  architect: {
    from: 'egyptian_priest.glb', file: 'egyptian_architect.glb',
    region(q, n, B) {
      if (q.y > 0.84 && Math.abs(q.x) < 0.08) {
        // the wig's edge: low (jaw level) behind the ears, rising to the forehead in front
        const f = Math.min(1, Math.max(0, (q.z - B.headZ - 0.004) / 0.022));
        if (q.y > 0.885 + f * (0.968 - 0.885)) return 'wig';
        return;
      }
      if (q.y > 0.45 && q.y < 0.84 && Math.abs(q.x) < 0.2) return 'sash';
    },
    paint: {
      // straight black hair, in strands running down from the crown
      wig: (r, g, b, { q, body }) => {
        const ang = Math.atan2(q.x, q.z - body.headZ), k = 0.55 + 0.45 * Math.abs(Math.sin(ang * 38)) * (0.8 + 0.4 * noise(Math.round(ang * 60), 1));
        return [0.075 * k + 0.01, 0.06 * k + 0.01, 0.055 * k + 0.01];
      },
      // the spotted leopard skin (busy, orange and dark) becomes plain red linen; skin and white cloth stay
      sash: (r, g, b, { busy }) => {
        const [h, s, v] = hsv(r, g, b);
        if (v > 0.7 && s < 0.25) return null;                          // white linen
        if (busy < 0.06 && isSkin(r, g, b)) return null;                // smooth skin
        if (busy < 0.045) return null;
        return shade(hex(0x9c3324), 0.4, 0.12)(r, g, b);
      },
    },
    rough: { wig: 0.95, sash: 0.9 },
    // a rounder belly, pushed forward and a little out to the sides; the wig stands off the head a little
    shape(c, B) {
      if (c.y > 0.84 && Math.abs(c.x) < 0.08) {
        const f = Math.min(1, Math.max(0, (c.z - B.headZ - 0.004) / 0.022)), edge = 0.885 + f * (0.968 - 0.885);
        if (c.y < edge - 0.004) return null;
        const k = Math.min(1, (c.y - edge + 0.004) / 0.012) * 0.0065, dx = c.x, dy = c.y - 0.93, dz = c.z - B.headZ, l = Math.hypot(dx, dy, dz) || 1;
        return [dx / l * k * 1.3, Math.max(0, dy / l) * k * 0.6, dz / l * k];
      }
      const d = Math.hypot((c.y - 0.6) / 0.09, c.x / 0.13);
      if (d > 1 || c.z < -0.02) return null;
      const k = (1 - d * d) ** 2;
      return [c.x * 0.15 * k, 0, 0.022 * k];
    },
  },

  // Ch6 cameo: a Greek instrument maker, from the Stonehenge builder (a working man's tunic):
  // grey hair and beard, a cream tunic and a leather apron.
  instrument_maker: {
    from: 'stonehenge_builder.glb', file: 'instrument_maker.glb',
    region(q, n) {
      if (q.y > 0.852 && Math.abs(q.x) < 0.085) return 'head';
      // the apron: a bib from the chest to the knees, rounded at the bottom corners, on the front only
      const ax = Math.abs(q.x), w = q.y > 0.6 ? 0.075 : 0.105;
      if (q.y > 0.355 && q.y < 0.68 && ax < w && q.z > 0 && n.z > -0.1 && !(q.y < 0.385 && ax > w - 0.03 + (q.y - 0.355))) return 'apron';
      if (q.y > 0.26 && q.y < 0.9 && Math.abs(q.x) < 0.3) return 'tunic';
    },
    paint: {
      // dark brown hair and beard turn grey; skin, eyes and lips stay
      head: (r, g, b) => { const L = lum(r, g, b); if (isSkin(r, g, b) || L < 0.05 || L > 0.5) return null; const v = 0.42 + L * 1.1; return [v, v * 0.98, v * 0.95]; },
      // (on the shoulders there's no bare skin, only a leather patch that looks like it: cloth there too)
      tunic: (r, g, b, { q }) => (isSkin(r, g, b) && !(q.y > 0.76 && Math.abs(q.x) > 0.075 && Math.abs(q.x) < 0.24) ? null : shade(hex(0xe2d6bc), 0.3, 0.55)(r, g, b)),
      apron: (r, g, b, { x, y }) => { const k = 0.9 + 0.2 * noise(Math.floor(x / 3), Math.floor(y / 3)); return shade(hex(0x6a4428), 0.3, 0.4)(r, g, b).map((c) => c * k); },
    },
  },

  // Ch3: villagers who walk out with lamps at night, seen from the roof: the priest without his
  // leopard skin (plain linen), with short black hair, light enough to have a dozen of them.
  villager: {
    from: 'egyptian_priest.glb', file: 'egyptian_villager.glb', tris: 5000, texture: 512,
    region(q, n, B) { return RECIPES.architect.region(q, n, B); },
    paint: {
      wig: (r, g, b, at) => RECIPES.architect.paint.wig(r, g, b, at).map((c) => c * 0.9),
      sash: (r, g, b, at) => (RECIPES.architect.paint.sash(r, g, b, at) ? shade(hex(0xe6dfcf), 0.4, 0.1)(r, g, b) : null),
    },
  },

  // Ch6: the sponge boat's crew at the air pump (Symi, 1900), from the Stonehenge builder:
  // a faded navy work smock with a red sash, and a dark cap of hair.
  sailor: {
    from: 'stonehenge_builder.glb', file: 'sponge_crew.glb',
    region(q, n) {
      if (q.y > 0.535 && q.y < 0.59 && Math.abs(q.x) < 0.2) return 'sash';
      if (q.y > 0.26 && q.y < 0.9 && Math.abs(q.x) < 0.3 && !(q.y > 0.852 && Math.abs(q.x) < 0.085)) return 'smock';
    },
    paint: {
      smock: (r, g, b, { q }) => (isSkin(r, g, b) && !(q.y > 0.76 && Math.abs(q.x) > 0.075 && Math.abs(q.x) < 0.24) ? null : shade(hex(0x3c4a66), 0.3, 0.6)(r, g, b)),
      sash: (r, g, b) => (isSkin(r, g, b) ? null : shade(hex(0xa8382c), 0.3, 0.3)(r, g, b)),
    },
  },

  // Ch2: the Stonehenge builder for people far away (the crowd, the families walking in):
  // about a third of the triangles and a smaller texture, looks the same from 20 m.
  builder_far: { from: 'stonehenge_builder.glb', file: 'stonehenge_builder_far.glb', tris: 5000, texture: 512 },
};

// ---------- the work ----------
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };

// Each vertex's skinning matrix in the rest pose (sum of weight x joint world x inverse bind)
function skinning(doc, prim) {
  const skin = doc.getRoot().listSkins()[0];
  const ibm = skin.getInverseBindMatrices(), joints = skin.listJoints();
  const S = joints.map((j, i) => mul(j.getWorldMatrix(), ibm.getElement(i, [])));
  const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'), n = prim.getAttribute('POSITION').getCount();
  const out = [], j = [], w = [];
  for (let v = 0; v < n; v++) {
    J.getElement(v, j); W.getElement(v, w);
    const m = new Array(16).fill(0);
    for (let k = 0; k < 4; k++) if (w[k]) for (let e = 0; e < 16; e++) m[e] += w[k] * S[j[k]][e];
    out.push(m);
  }
  return out;
}
const xf = (m, p, wv = 1) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r] * wv);
function inv3(m) { // inverse of the 3x3 part (column-major 4x4 in), as a function on vectors
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  const r = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((x) => x / det);
  return (v) => [r[0] * v[0] + r[1] * v[1] + r[2] * v[2], r[3] * v[0] + r[4] * v[1] + r[5] * v[2], r[6] * v[0] + r[7] * v[1] + r[8] * v[2]];
}

async function make(name, debug) {
  const R = RECIPES[name];
  const doc = await io.read(path.join(MODELS, R.from));
  const root = doc.getRoot(), prim = root.listMeshes()[0].listPrimitives()[0];
  const P = prim.getAttribute('POSITION'), UV = prim.getAttribute('TEXCOORD_0'), idx = prim.getIndices();
  const nv = P.getCount();
  const M = skinning(doc, prim);
  // rest-pose positions, in body heights
  const raw = []; for (let v = 0; v < nv; v++) raw.push(xf(M[v], P.getElement(v, [])));
  const ys = raw.map((p) => p[1]), y0 = Math.min(...ys), H = Math.max(...ys) - y0;
  const pos = raw.map((p) => ({ x: p[0] / H, y: (p[1] - y0) / H, z: p[2] / H }));
  // the head: its middle front-to-back (about where the ears are) and its top
  const hv = pos.filter((p) => p.y > 0.9 && Math.abs(p.x) < 0.08);
  const body = { headZ: (Math.min(...hv.map((p) => p.z)) + Math.max(...hv.map((p) => p.z))) / 2, headFront: Math.max(...hv.map((p) => p.z)) };
  console.log('  head', body);

  // reshape
  if (R.shape) {
    let moved = 0;
    for (let v = 0; v < nv; v++) {
      const d = R.shape(pos[v], body); if (!d) continue;
      const back = inv3(M[v])(d.map((x) => x * H)), p = P.getElement(v, []);
      P.setElement(v, [p[0] + back[0], p[1] + back[1], p[2] + back[2]]); moved++;
    }
    console.log(`  reshaped ${moved} vertices`);
  }

  // repaint
  if (R.region) {
    const tex = prim.getMaterial().getBaseColorTexture();
    const { data, info } = await sharp(Buffer.from(tex.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const TW = info.width, TH = info.height, src = Float32Array.from(data, (x) => x / 255);
    // how busy the original texture is around each texel (spots and patterns vs plain cloth or skin)
    const busy = new Float32Array(TW * TH), RAD = 3;
    for (let y = RAD; y < TH - RAD; y++) for (let x = RAD; x < TW - RAD; x++) {
      let s = 0, s2 = 0, n = 0;
      for (let dy = -RAD; dy <= RAD; dy += 2) for (let dx = -RAD; dx <= RAD; dx += 2) { const j = ((y + dy) * TW + x + dx) * 3, l = lum(src[j], src[j + 1], src[j + 2]); s += l; s2 += l * l; n++; }
      busy[y * TW + x] = Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
    }
    const state = new Int8Array(TW * TH), regs = new Int8Array(TW * TH);   // 0 empty (gutter), 1 covered by the model, 2 repainted
    const names = Object.keys(R.paint), DBG = [[1, 0, 1], [0, 1, 0], [0, 0.6, 1], [1, 1, 0], [1, 0.4, 0]];
    const tri = idx.getCount() / 3, a = [], u = [[], [], []], counts = {};
    for (let t = 0; t < tri; t++) {
      const vi = [idx.getScalar(t * 3), idx.getScalar(t * 3 + 1), idx.getScalar(t * 3 + 2)];
      const [p0, p1, p2] = vi.map((v) => pos[v]);
      const e1 = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z], e2 = [p2.x - p0.x, p2.y - p0.y, p2.z - p0.z];
      const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0], nl = Math.hypot(nx, ny, nz) || 1;
      const nrm = { x: nx / nl, y: ny / nl, z: nz / nl };
      vi.forEach((v, k) => { UV.getElement(v, a); u[k] = [a[0] * TW - 0.5, a[1] * TH - 0.5]; });
      // every texel of the triangle (a little fat, so edges aren't missed)
      const minx = Math.max(0, Math.floor(Math.min(u[0][0], u[1][0], u[2][0]) - 1)), maxx = Math.min(TW - 1, Math.ceil(Math.max(u[0][0], u[1][0], u[2][0]) + 1));
      const miny = Math.max(0, Math.floor(Math.min(u[0][1], u[1][1], u[2][1]) - 1)), maxy = Math.min(TH - 1, Math.ceil(Math.max(u[0][1], u[1][1], u[2][1]) + 1));
      const area = (u[1][0] - u[0][0]) * (u[2][1] - u[0][1]) - (u[2][0] - u[0][0]) * (u[1][1] - u[0][1]);
      if (Math.abs(area) < 1e-9) continue;
      for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
        const w1 = ((x - u[0][0]) * (u[2][1] - u[0][1]) - (u[2][0] - u[0][0]) * (y - u[0][1])) / area;
        const w2 = ((u[1][0] - u[0][0]) * (y - u[0][1]) - (x - u[0][0]) * (u[1][1] - u[0][1])) / area;
        const w0 = 1 - w1 - w2, m = -0.03;
        if (w0 < m || w1 < m || w2 < m) continue;
        const i = y * TW + x;
        if (state[i] === 2) continue;
        state[i] = 1;
        // where on the body this texel is, and what goes there
        const q = { x: w0 * p0.x + w1 * p1.x + w2 * p2.x, y: w0 * p0.y + w1 * p1.y + w2 * p2.y, z: w0 * p0.z + w1 * p1.z + w2 * p2.z };
        const reg = R.region(q, nrm, body); if (!reg) continue;
        const j = i * 3, at = { q, n: nrm, x, y, busy: busy[i], body };
        const out = debug ? DBG[names.indexOf(reg)] : R.paint[reg](src[j], src[j + 1], src[j + 2], at);
        if (!out) continue;
        counts[reg] = (counts[reg] || 0) + 1; state[i] = 2; regs[i] = names.indexOf(reg) + 1;
        for (let k = 0; k < 3; k++) data[j + k] = Math.max(0, Math.min(255, Math.round(out[k] * 255)));
      }
    }
    console.log('  repainted texels:', counts);
    // spread the new paint a few texels into the empty gutters between islands (no seams)
    for (let it = 0; it < 4; it++) {
      const cp = state.slice();
      for (let y = 1; y < TH - 1; y++) for (let x = 1; x < TW - 1; x++) {
        const i = y * TW + x; if (cp[i]) continue;
        const nb = [i - 1, i + 1, i - TW, i + TW].find((k) => cp[k] === 2);
        if (nb === undefined) continue;
        for (let k = 0; k < 3; k++) data[i * 3 + k] = data[nb * 3 + k];
        state[i] = 2; regs[i] = regs[nb];
      }
    }
    const jpg = await sharp(data, { raw: { width: TW, height: TH, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
    tex.setImage(new Uint8Array(jpg)).setMimeType('image/jpeg');
    // matte where it should be (a wig shouldn't shine like the bald head it replaced)
    const mrTex = prim.getMaterial().getMetallicRoughnessTexture();
    if (R.rough && mrTex) {
      const mr = await sharp(Buffer.from(mrTex.getImage())).removeAlpha().resize(TW, TH).raw().toBuffer();
      for (let i = 0; i < TW * TH; i++) { const rg = regs[i] && R.rough[names[regs[i] - 1]]; if (rg) { mr[i * 3 + 1] = Math.round(rg * 255); mr[i * 3 + 2] = 0; } }
      const mi = await sharp(Buffer.from(mrTex.getImage())).metadata();
      mrTex.setImage(new Uint8Array(await sharp(mr, { raw: { width: TW, height: TH, channels: 3 } }).resize(mi.width, mi.height).jpeg({ quality: 90 }).toBuffer())).setMimeType('image/jpeg');
    }
  }

  // fewer triangles and a smaller texture, for far away
  if (R.tris) {
    await doc.transform(weld());
    const now = idx.getCount() / 3;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: R.tris / now, error: 0.02, lockBorder: false }));
  }
  if (R.texture) await doc.transform(textureCompress({ encoder: sharp, resize: [R.texture, R.texture], quality: 85 }));
  await doc.transform(prune(), dedup());
  const out = path.join(MODELS, debug ? name + '_debug.glb' : R.file);
  await io.write(out, doc);
  const tris = root.listMeshes()[0].listPrimitives()[0].getIndices().getCount() / 3;
  console.log(`${name}: ${path.relative(process.cwd(), out)}  ${tris} triangles`);
}

const args = process.argv.slice(2), debug = args.includes('--debug');
const names = args.filter((a) => !a.startsWith('--'));
for (const n of names.length ? names : Object.keys(RECIPES)) { console.log(n); await make(n, debug); }
