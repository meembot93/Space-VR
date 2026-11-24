// Splits Meem's R-7 (models/r7.glb, one mesh) into the pieces the Sputnik chapter moves on its own:
// the core stage, four strap-on boosters and the two halves of the nose fairing. Writes
// models/r7_parts.glb with nodes core, booster0..3, nose_n, nose_s, in metres, rocket coordinates
// (y = 0 at the tail, the engine bells hang below it; +x east, -z north). Each booster's node sits at
// its tail centre with its mesh around that point, so the chapter can throw it away on its own.
// Tripo made the rocket with six strap-ons; the real R-7 has four, so four of them are kept and
// spaced a quarter turn apart (north, east, south, west, like the chapter's support arms expect).
// Also writes models/sputnik_ball.glb: Sputnik's ball without Tripo's antennas (the chapter adds
// straight ones that can swing open), centred on its middle and 0.58 m across.
// Run: cd tools/models && npm install && node split_r7.mjs
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const M = new URL('../../models/', import.meta.url).pathname;
const DEBUG = process.argv.includes('--debug');

// ---------- helpers ----------
function readPrim(doc) {
  const p = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  return { prim: p, P: p.getAttribute('POSITION').getArray(), N: p.getAttribute('NORMAL').getArray(), U: p.getAttribute('TEXCOORD_0').getArray(), I: p.getIndices().getArray(), mat: p.getMaterial() };
}
// Cut triangles cleanly along a plane (coordinate `axis` = `value`): the ones that cross it are split,
// so the cut edge is straight instead of following the mesh's zig-zag. Returns { lo, hi } loose triangles.
function clip(S, tris, axis, value) {
  const lo = [], hi = [], corner = (vi) => ({ p: [S.P[vi * 3], S.P[vi * 3 + 1], S.P[vi * 3 + 2]], n: [S.N[vi * 3], S.N[vi * 3 + 1], S.N[vi * 3 + 2]], u: [S.U[vi * 2], S.U[vi * 2 + 1]] });
  const mix = (a, b, f) => { const L = (x, y) => x.map((v, i) => v + (y[i] - v) * f), n = L(a.n, b.n), l = Math.hypot(...n) || 1; return { p: L(a.p, b.p), n: n.map((v) => v / l), u: L(a.u, b.u) }; };
  const fan = (poly, out) => { for (let i = 1; i < poly.length - 1; i++) out.push([poly[0], poly[i], poly[i + 1]]); };
  for (const t of tris) {
    const c = [0, 1, 2].map((k) => corner(S.I[t * 3 + k])), d = c.map((q) => q.p[axis] - value);
    if (d.every((x) => x <= 0)) { lo.push(c); continue; }
    if (d.every((x) => x >= 0)) { hi.push(c); continue; }
    const pl = [], ph = [];   // walk the triangle's edges (Sutherland-Hodgman against both half-spaces)
    for (let i = 0; i < 3; i++) {
      const a = c[i], b = c[(i + 1) % 3], da = d[i], db = d[(i + 1) % 3];
      if (da <= 0) pl.push(a); if (da >= 0) ph.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const m = mix(a, b, da / (da - db)); pl.push(m); ph.push(m); }
    }
    fan(pl, lo); fan(ph, hi);
  }
  return { lo, hi };
}
// Loose triangles split by a plane (as clip(), for triangles that are already loose)
function clipSoup(soup, axis, value) {
  const S = { P: [], N: [], U: [], I: [] };
  for (const tri of soup) for (const c of tri) { S.I.push(S.P.length / 3); S.P.push(...c.p); S.N.push(...c.n); S.U.push(...c.u); }
  return clip(S, soup.map((_, i) => i), axis, value);
}
// A new document holding the source material once and one node per part.
// parts: [{ name, pos: [x, y, z], sets: [{ tris: [triangle index], xf(v, n, vi) -> [v, n] }] }]
function writeParts(src, S, parts, file) {
  const doc = src; const root = doc.getRoot(), buf = root.listBuffers()[0], scene = root.listScenes()[0];
  for (const n of root.listNodes()) { n.dispose(); }
  const old = root.listMeshes();
  for (const part of parts) {
    const P = [], N = [], U = [], I = []; let ntri = 0;
    for (const set of part.sets) {
      const map = new Map(); ntri += (set.tris || []).length;
      for (const t of set.tris || []) for (let k = 0; k < 3; k++) {
        const vi = S.I[t * 3 + k]; let ni = map.get(vi);
        if (ni === undefined) {
          ni = P.length / 3; map.set(vi, ni);
          const [v, n] = set.xf([S.P[vi * 3], S.P[vi * 3 + 1], S.P[vi * 3 + 2]], [S.N[vi * 3], S.N[vi * 3 + 1], S.N[vi * 3 + 2]], vi);
          P.push(...v); N.push(...n); U.push(S.U[vi * 2], S.U[vi * 2 + 1]);
        }
        I.push(ni);
      }
      // or loose triangles ({ p, n, u } corners, as clip() makes)
      const keys = new Map(); ntri += (set.soup || []).length;
      for (const tri of set.soup || []) for (const c of tri) {
        const [v, n] = set.xf(c.p, c.n), key = [...v, ...c.u].map((x) => Math.round(x * 1e5)).join(',');
        let ni = keys.get(key);
        if (ni === undefined) { ni = P.length / 3; keys.set(key, ni); P.push(...v); N.push(...n); U.push(...c.u); }
        I.push(ni);
      }
    }
    const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
    const prim = doc.createPrimitive().setAttribute('POSITION', acc('VEC3', new Float32Array(P))).setAttribute('NORMAL', acc('VEC3', new Float32Array(N)))
      .setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(U))).setIndices(acc('SCALAR', P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I))).setMaterial(S.mat);
    const mesh = doc.createMesh(part.name).addPrimitive(prim);
    scene.addChild(doc.createNode(part.name).setMesh(mesh).setTranslation(part.pos || [0, 0, 0]));
    console.log(file, part.name, 'tris', ntri, 'verts', P.length / 3);
  }
  for (const m of old) { for (const p of m.listPrimitives()) p.dispose(); m.dispose(); }
  for (const a of root.listAccessors()) if (!a.listParents().some((p) => p !== root)) a.dispose();
  return io.write(M + file, doc);
}

// ---------- the R-7 ----------
{
  const doc = await io.read(M + 'r7.glb'), S = readPrim(doc), nv = S.P.length / 3, nt = S.I.length / 3;
  const HEIGHT = 30.0, Y0 = -0.9;                      // 30 m tall; the bells hang 0.9 m below the tail
  let ymax = 0; for (let i = 0; i < nv; i++) ymax = Math.max(ymax, S.P[i * 3 + 1]);
  const K = HEIGHT / ymax, RC = 0.0505, TIPY = 0.66, NOSEY = 0.855, CORE_FROM = Number(process.env.CORE_FROM || 0.645);
  // the six strap-ons' bearings (atan2(z, x)): the middle of each lobe of the outline at mid height
  // (a histogram of the outline's angle, then six peaks 60 degrees apart, each nudged to its own peak)
  const hist = new Float32Array(360);
  for (let i = 0; i < nv; i++) { const y = S.P[i * 3 + 1]; if (y < 0.15 || y > 0.5) continue; const x = S.P[i * 3], z = S.P[i * 3 + 2], r = Math.hypot(x, z); if (r > 0.065) hist[Math.floor(((Math.atan2(z, x) * 180 / Math.PI) + 360) % 360)] += r - 0.065; }
  const win = (a, w) => { let s = 0; for (let d = -w; d <= w; d++) s += hist[((Math.round(a) + d) % 360 + 360) % 360]; return s; };
  let off = 0, bw = -1; for (let a = 0; a < 60; a++) { let s = 0; for (let k = 0; k < 6; k++) s += win(a + k * 60, 12); if (s > bw) { bw = s; off = a; } }
  const angs = [];
  for (let k = 0; k < 6; k++) { let ba = off + k * 60, bs = -1; for (let a = off + k * 60 - 10; a <= off + k * 60 + 10; a++) { const s = win(a, 12); if (s > bs) { bs = s; ba = a; } } angs.push(((ba % 360) + 360) % 360); }
  console.log('strap-on bearings (atan2 z,x)', angs);
  // each strap-on's outer edge by height: its axis is half-way between the core (RC) and that edge
  const BIN = 0.01, NB = Math.ceil(TIPY / BIN) + 1;
  const outer = angs.map(() => new Float32Array(NB));
  angs.forEach((a, k) => {
    const c = Math.cos(a * Math.PI / 180), sn = Math.sin(a * Math.PI / 180);
    for (let i = 0; i < nv; i++) { const y = S.P[i * 3 + 1]; if (y > TIPY) continue; const x = S.P[i * 3], z = S.P[i * 3 + 2], along = x * c + z * sn, perp = Math.abs(-x * sn + z * c); if (perp < 0.012 && along > RC) { const b = Math.floor(y / BIN); outer[k][b] = Math.max(outer[k][b], along); } }
    // fill gaps and smooth
    for (let b = 1; b < NB; b++) if (!outer[k][b]) outer[k][b] = outer[k][b - 1];
    for (let b = NB - 2; b >= 0; b--) if (!outer[k][b]) outer[k][b] = outer[k][b + 1];
    // a sparse slice can miss the edge: take the widest of the neighbouring slices
    const o = Float32Array.from(outer[k]); for (let b = 0; b < NB; b++) outer[k][b] = Math.max(o[b], o[Math.max(0, b - 2)], o[Math.max(0, b - 1)], o[Math.min(NB - 1, b + 1)], o[Math.min(NB - 1, b + 2)]);
  });
  if (DEBUG) for (let b = 0; b < NB; b += 3) console.log((b * BIN).toFixed(2), angs.map((_, k) => outer[k][b].toFixed(3)).join(' '));
  const prof = (k, y) => { const b = Math.min(NB - 1, Math.max(0, Math.floor(y / BIN))), o = Math.max(RC + 0.004, outer[k][b]); return { c: (o + RC) / 2, r: (o - RC) / 2 }; };
  // which piece each triangle belongs to: the nearest axis, measured in each piece's own radii
  const owner = new Int8Array(nt);   // -1 core, 0..5 strap-on, 9 nose
  for (let t = 0; t < nt; t++) {
    let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { const v = S.I[t * 3 + k]; x += S.P[v * 3] / 3; y += S.P[v * 3 + 1] / 3; z += S.P[v * 3 + 2] / 3; }
    owner[t] = -1;
    if (y > NOSEY) { owner[t] = 9; continue; }
    if (y > TIPY) continue;
    const dc = Math.hypot(x, z) / RC; let best = dc;
    angs.forEach((a, k) => { const { c, r } = prof(k, y), bx = Math.cos(a * Math.PI / 180) * c, bz = Math.sin(a * Math.PI / 180) * c, d = Math.hypot(x - bx, z - bz) / r; if (d < best) { best = d; owner[t] = k; } });
  }
  // a smooth axis for each strap-on (a parabola through its outline), to turn its outer half round
  // onto its inner side: Tripo's mesh has no inner side where the strap-ons were joined to the core
  const quad = (pts) => {   // least squares v = q0 + q1 y + q2 y^2
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
    for (const [y, v] of pts) { const f = [1, y, y * y]; for (let i = 0; i < 3; i++) { B[i] += f[i] * v; for (let j = 0; j < 3; j++) A[i][j] += f[i] * f[j]; } }
    const M3 = A.map((r, i) => [...r, B[i]]);
    for (let i = 0; i < 3; i++) { let m = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M3[r][i]) > Math.abs(M3[m][i])) m = r; [M3[i], M3[m]] = [M3[m], M3[i]]; for (let r = 0; r < 3; r++) if (r !== i) { const f = M3[r][i] / M3[i][i]; for (let c = i; c < 4; c++) M3[r][c] -= f * M3[i][c]; } }
    const q = M3.map((r, i) => r[3] / r[i]); return (y) => q[0] + q[1] * y + q[2] * y * y;
  };
  // each strap-on's axis and radius by height: a circle fitted to its outer half in each slice
  // (the outer half is whole: Tripo's mesh only lost the sides that touched the core and the others)
  const fit = angs.map((a, k) => {
    const ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180), cs = [], rs = [];
    for (let b = 7; b <= 60; b++) {
      const y0 = b * BIN, { c: c0, r: r0 } = prof(k, y0 + BIN / 2), pts = [];
      for (let i = 0; i < nv; i++) { const y = S.P[i * 3 + 1]; if (y < y0 || y >= y0 + BIN) continue; const x = S.P[i * 3], z = S.P[i * 3 + 2], u = x * ca + z * sa - c0, w = -x * sa + z * ca, d = Math.hypot(u, w); if (d < r0 * 1.25 && d > r0 * 0.6 && u > -0.2 * r0) pts.push([u, w]); }
      if (pts.length < 8) continue;
      // Kasa circle fit: u^2 + w^2 = 2 a u + 2 b w + c
      let S11 = 0, S12 = 0, S22 = 0, S1 = 0, S2 = 0, n = pts.length, T1 = 0, T2 = 0, T0 = 0;
      for (const [u, w] of pts) { const q = u * u + w * w; S11 += u * u; S12 += u * w; S22 += w * w; S1 += u; S2 += w; T1 += q * u; T2 += q * w; T0 += q; }
      const M = [[2 * S11, 2 * S12, S1, T1], [2 * S12, 2 * S22, S2, T2], [2 * S1, 2 * S2, n, T0]];
      for (let i = 0; i < 3; i++) { let m = i; for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[m][i])) m = r; [M[i], M[m]] = [M[m], M[i]]; for (let r = 0; r < 3; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let c = i; c < 4; c++) M[r][c] -= f * M[i][c]; } }
      const ua = M[0][3] / M[0][0], wb = M[1][3] / M[1][1], cc = M[2][3] / M[2][2], rr = Math.sqrt(cc + ua * ua + wb * wb);
      cs.push([y0 + BIN / 2, c0 + ua]); rs.push([y0 + BIN / 2, rr]);
    }
    const fc = quad(cs), fr = quad(rs);
    if (DEBUG) console.log('strap-on', a, cs.filter((_, i) => i % 6 === 0).map(([y, c], i) => `${y.toFixed(2)}:${c.toFixed(4)}/${rs[i * 6][1].toFixed(4)}`).join(' '));
    return (y) => { const yy = Math.min(0.62, Math.max(0.04, y)); return { c: fc(yy), r: fr(yy) }; };
  });
  // keep four, a quarter turn apart: atan2 bearings 0 (east), 90 (south), 180 (west), 270 (north)
  const keep = [0, 90, 180, 270].map((target) => { let bk = -1, bd = 999; angs.forEach((a, k) => { const d = Math.abs(((a - target + 540) % 360) - 180); if (d < bd) { bd = d; bk = k; } }); return { k: bk, target }; });
  if (new Set(keep.map((q) => q.k)).size < 4) { keep.length = 0; [0, 1, 3, 4].forEach((k, i) => keep.push({ k, target: i * 90 })); }
  console.log('kept', keep.map((q) => `${angs[q.k]}->${q.target}`).join(', '));
  if (DEBUG) for (let y = 0.02; y < 0.66; y += 0.04) console.log('y m', (y * K + Y0).toFixed(1), 'inner edge', keep.map(({ k }) => ((fit[k](y).c - fit[k](y).r) * K).toFixed(2)).join(' '), 'axis', keep.map(({ k }) => (fit[k](y).c * K).toFixed(2)).join(' '), 'r', keep.map(({ k }) => (fit[k](y).r * K).toFixed(2)).join(' '));
  const parts = [];
  const scale = ([x, y, z]) => [x * K, y * K + Y0, z * K];
  const cen = (t) => { let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { const v = S.I[t * 3 + k]; x += S.P[v * 3] / 3; y += S.P[v * 3 + 1] / 3; z += S.P[v * 3 + 2] / 3; } return [x, y, z]; };
  // the core: only above the strap-ons' tips (below, Tripo's core is just the strips that showed
  // between six strap-ons); the chapter builds the rest of it
  console.log('core from y', (CORE_FROM * K + Y0).toFixed(3));
  const top = clip(S, [...owner.keys()].filter((t) => (owner[t] === -1 || owner[t] === 9) && cen(t)[1] > CORE_FROM), 1, NOSEY);   // a clean cut under the fairing
  parts.push({ name: 'core', sets: [{ soup: top.lo, xf: (v, n) => [scale(v), n] }] });
  const BOT = 0.065, HALF = Number(process.env.HALF || 98) * Math.PI / 180;
  keep.forEach(({ k, target }, i) => {
    const d = (target - angs[k]) * Math.PI / 180, c = Math.cos(d), s = Math.sin(d);
    const ca = Math.cos(angs[k] * Math.PI / 180), sa = Math.sin(angs[k] * Math.PI / 180);
    const rot = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];   // turns atan2(z, x) by +d
    const base = fit[k](0.07).c * K, ta = target * Math.PI / 180, pos = [Math.cos(ta) * base, 0, Math.sin(ta) * base];
    const local = ([x, y, z]) => { const along = x * ca + z * sa, perp = -x * sa + z * ca, { c: cc, r } = fit[k](y); return { a: along - cc, t: perp, r }; };
    const tris = [...owner.keys()].filter((t) => owner[t] === k);
    const outerHalf = tris.filter((t) => { const L = local(cen(t)); return Math.abs(Math.atan2(L.t, L.a)) <= HALF; });
    const far = (t) => { let m = 0; for (let j = 0; j < 3; j++) { const v = S.I[t * 3 + j], L = local([S.P[v * 3], S.P[v * 3 + 1], S.P[v * 3 + 2]]); m = Math.max(m, Math.hypot(L.a, L.t) / L.r, Math.abs(Math.atan2(L.t, L.a)) > HALF + 0.25 ? 9 : 0); } return m; };
    // the face of the strap-on faces out from its axis; the bits Tripo used to glue it to its neighbours face sideways
    const facing = (t) => { const p = cen(t), L = local(p), d = Math.hypot(L.a, L.t) || 1; let nx = 0, nz = 0; for (let j = 0; j < 3; j++) { const v = S.I[t * 3 + j]; nx += S.N[v * 3]; nz += S.N[v * 3 + 2]; } const na = nx * ca + nz * sa, nt = -nx * sa + nz * ca, nl = Math.hypot(na, nt) || 1; return (na * L.a + nt * L.t) / (d * nl); };
    const keepT = tris.filter((t) => { const p = cen(t), L = local(p); const f = Math.abs(Math.atan2(L.t, L.a)); if (f > HALF) return false; if (f < 0.6 && p[1] < 0.13) return true; return far(t) <= 1.3 && facing(t) > 0.3; });
    const copyT = keepT.filter((t) => { const p = cen(t), L = local(p); if (p[1] < 0.1 && Math.abs(Math.atan2(L.t, L.a)) < 0.6 && far(t) > 1.12) return false; return p[1] > 0.1 || Math.hypot(L.a, L.t) <= L.r * (p[1] < BOT ? 1.05 : 1.12); });
    const place = (v, n) => { const w = scale(rot(v)); return [[w[0] - pos[0], w[1] - pos[1], w[2] - pos[2]], rot(n)]; };
    // half a turn round the strap-on's own axis (at each height)
    const flip = ([x, y, z], [nx, ny, nz]) => {
      const { c: cc } = fit[k](y), ax = ca * cc, az = sa * cc;
      return place([2 * ax - x, y, 2 * az - z], [-nx, ny, -nz]);
    };
    if (process.env.SPLITDBG) parts.push({ name: 'keep' + i, pos, sets: [{ tris: keepT, xf: place }] }, { name: 'copy' + i, pos, sets: [{ tris: copyT, xf: flip }] });
    else parts.push({ name: 'booster' + i, pos, sets: [{ tris: keepT, xf: place }, { tris: copyT, xf: flip }] });
  });
  const noseY = NOSEY * K + Y0;
  console.log('nose fairing starts at y', noseY.toFixed(3), 'core radius', (RC * K).toFixed(3));
  for (const south of [false, true]) {
    const halves = clipSoup(top.hi, 2, 0), soup = south ? halves.hi : halves.lo;   // split down the middle, north and south
    parts.push({ name: south ? 'nose_s' : 'nose_n', pos: [0, noseY, 0], sets: [{ soup, xf: (v, n) => { const w = scale(v); return [[w[0], w[1] - noseY, w[2]], n]; } }] });
  }
  await writeParts(doc, S, parts, 'r7_parts.glb');
}

// ---------- Sputnik's ball ----------
{
  const doc = await io.read(M + 'sputnik.glb'), S = readPrim(doc), nv = S.P.length / 3, nt = S.I.length / 3;
  // fit the ball: start from the median point, then the middle of the shell at the typical radius
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
  let c = [0, 1, 2].map((j) => med(Array.from({ length: nv }, (_, i) => S.P[i * 3 + j]))), r = 0;
  for (let it = 0; it < 6; it++) {
    const d = Array.from({ length: nv }, (_, i) => Math.hypot(S.P[i * 3] - c[0], S.P[i * 3 + 1] - c[1], S.P[i * 3 + 2] - c[2]));
    r = med(d.filter((v) => v < 0.35));
    const mn = [9, 9, 9], mx = [-9, -9, -9];
    for (let i = 0; i < nv; i++) if (Math.abs(d[i] - r) < r * 0.08) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], S.P[i * 3 + j]); mx[j] = Math.max(mx[j], S.P[i * 3 + j]); }
    c = [0, 1, 2].map((j) => (mn[j] + mx[j]) / 2); r = (mx[0] - mn[0] + mx[1] - mn[1] + mx[2] - mn[2]) / 6;
  }
  const K = 0.29 / r, CUT = Number(process.env.SP_CUT || 1.03);
  console.log('Sputnik ball centre', c.map((v) => v.toFixed(4)), 'radius', r.toFixed(4), 'scale', K.toFixed(3));
  const tris = [];
  for (let t = 0; t < nt; t++) { let ok = true; for (let k = 0; k < 3; k++) { const v = S.I[t * 3 + k]; if (Math.hypot(S.P[v * 3] - c[0], S.P[v * 3 + 1] - c[1], S.P[v * 3 + 2] - c[2]) > r * CUT) ok = false; } if (ok) tris.push(t); }
  await writeParts(doc, S, [{ name: 'ball', sets: [{ tris, xf: ([x, y, z], n) => [[(x - c[0]) * K, (y - c[1]) * K, (z - c[2]) * K], n] }] }], 'sputnik_ball.glb');
}
