// The Moon's face, made at load time (no downloads): the real near side, with the seas (maria) in
// their true shapes and places, bright cratered highlands, the famous craters (Tycho and its rays,
// Copernicus, Kepler, Aristarchus, Plato's dark floor, Clavius...), mountain ranges and ray systems.
//
// moonFields(proj, W, H) builds the raw maps (call it once and keep what you need):
//   proj 'disc': the face as we see it from Earth, a W x W square with the disc filling it (north up,
//                Mare Crisium on the right), for the sky's Moon and the eclipse Moons.
//   proj 'map':  the whole globe, W x H equirectangular (as js/chapters/galileo.js's telescope Moon).
// It gives h (height, in Moon radii), alb (brightness 0..1, as the eye sees it) and tint (0 a cool
// blue-grey sea .. 1 a warm brown one; highlands 0.55).
//
// moonSkyTextures(): the textures the sky's Moon shader (js/sky.js) uses: the face (R brightness,
// G B the surface slopes east and north, A height) and a small colour map.
// moonFaceTexture(): a plain colour picture of the full Moon (with a little relief), for chapters
// that draw their own Moon (the Babylon and Greece eclipses).
import * as THREE from 'three';

const D2R = Math.PI / 180;

// ---------- The map: every feature in lunar latitude / longitude (degrees, east positive) ----------
// Seas: [lat, lon, a, b, rot] blobs, a and b their half-widths east-west and north-south (degrees
// of arc on the Moon), rot turns the blob (degrees). The coasts are made ragged with noise.
// tone: how bright the sea is (0..1); tint: 0 blue-grey (titanium-rich) .. 1 brownish.
export const MARIA = [
  { name: 'Imbrium', tone: 0.39, tint: 0.45, blobs: [[34, -16, 15.5, 12.5, 0], [38, -24, 11, 8, 10], [30, -25, 9, 7, 0], [25, -14, 8, 5, 0], [41, -10, 8, 5, 0], [28, -5, 5, 6, 0], [35, -6, 6, 6, 0], [44.5, -31.5, 5.2, 3.6, -10]] },
  { name: 'Procellarum', tone: 0.40, tint: 0.3, blobs: [[41, -50, 7, 6, 0], [33, -56, 9, 8, 0], [22, -59, 10, 9, 0], [11, -56, 10, 9, 0], [1, -51, 8, 8, 0], [-5, -44, 7, 6, 0], [13, -45, 7, 8, 0], [26, -42, 5, 6, 0], [4, -40, 6, 6, 0], [-9, -51, 6, 5, 0], [-3, -60, 5, 6, 0], [18, -68, 6, 9, 0], [6, -66, 5, 6, 0], [32, -66, 6, 6, 0], [50, -55, 6, 4, 0], [55, -45, 6, 4, 0], [30, -38, 7, 7, 0], [20, -38, 6, 6, 0], [38, -40, 6, 5, 0], [-12, -40, 6, 5, 0], [-2, -35, 5, 4, 0]] },
  { name: 'Frigoris', tone: 0.47, tint: 0.55, blobs: [[60, -42, 6, 3.5, 0], [57.5, -30, 8, 3.2, 0], [56.5, -18, 7, 3, 0], [56.5, -6, 7, 3, 0], [57, 6, 7, 3.4, 0], [57.5, 18, 7, 3.2, 0], [57, 30, 6, 2.8, 0], [55.5, 40, 5, 2.4, 0], [52, -48, 6, 4, 0]] },
  { name: 'Serenitatis', tone: 0.44, tint: 0.7, edge: 0.08, blobs: [[28, 17.5, 10.5, 10, 0], [21, 21, 4, 3, 0]] },
  { name: 'Somniorum', tone: 0.5, tint: 0.65, blobs: [[37.5, 30, 4.5, 3, 25]] },
  { name: 'Mortis', tone: 0.46, tint: 0.6, blobs: [[45, 27, 1.8, 1.5, 0]] },
  { name: 'Vaporum', tone: 0.42, tint: 0.6, blobs: [[13, 4, 4, 3, 0], [16.5, 0, 2.5, 2, 0]] },
  { name: 'Medii', tone: 0.47, tint: 0.55, blobs: [[2, 1.5, 3, 1.8, 0]] },
  { name: 'Aestuum', tone: 0.4, tint: 0.4, blobs: [[11, -8.5, 3.2, 2.4, 0]] },
  { name: 'Tranquillitatis', tone: 0.35, tint: 0.12, blobs: [[9, 29, 9, 7, 0], [8, 25, 8, 6, 10], [6, 34, 8, 8, 0], [14, 30, 6, 5, 0], [2, 28, 5, 4, 0], [1, 38, 5, 5, 0], [17, 24, 3.5, 3, 0], [-4, 26, 3.5, 3.2, 0]] },
  { name: 'Crisium', tone: 0.37, tint: 0.35, blobs: [[17, 58.5, 9.5, 7.2, 0]] },
  { name: 'Fecunditatis', tone: 0.42, tint: 0.55, blobs: [[-5, 50, 6.5, 8, 0], [-12, 52, 6, 6, 0], [-2, 45, 5, 4, 0], [2, 53, 4, 3.5, 0], [-17, 49, 4.5, 4, 0], [-21, 52, 3.5, 3, 0]] },
  { name: 'Nectaris', tone: 0.41, tint: 0.55, blobs: [[-15, 35, 5.3, 5.5, 0], [-20.5, 33.5, 3, 2.4, 0]] },
  { name: 'Nubium', tone: 0.43, tint: 0.5, blobs: [[-20, -15, 9.5, 8, 0], [-15, -20, 6, 5, 0], [-26, -19, 6, 5, 0], [-12, -11, 5, 4, 0], [-10, -23, 6, 4.5, 0], [-4, -19, 5, 3, 0], [-32, -28, 4, 2.5, 0]] },
  { name: 'Insularum', tone: 0.42, tint: 0.45, blobs: [[7, -31, 7, 6, 0], [3, -24, 5, 3.5, 0], [12, -33, 4, 4, 0]] },
  { name: 'Humorum', tone: 0.38, tint: 0.45, blobs: [[-24.5, -38.5, 6, 6, 0], [-27, -42, 3, 3, 0]] },
  // round the limbs, seen side-on
  { name: 'Marginis', tone: 0.42, tint: 0.5, blobs: [[13, 86, 5, 4, 0]] },
  { name: 'Smythii', tone: 0.4, tint: 0.4, blobs: [[1, 87, 6, 5, 0]] },
  { name: 'Undarum', tone: 0.4, tint: 0.45, blobs: [[7, 68, 3, 2, 0], [1, 65, 2.5, 2, 0], [22.5, 67.5, 2, 1.6, 0]] },
  { name: 'Australe', tone: 0.42, tint: 0.5, blobs: [[-46, 82, 6, 5, 0], [-50, 93, 7, 5, 0], [-40, 88, 3, 3, 0]] },
  { name: 'Humboldtianum', tone: 0.42, tint: 0.5, blobs: [[57, 82, 5, 4, 0]] },
  { name: 'Orientale', tone: 0.42, tint: 0.4, blobs: [[-14, -86, 3, 6, 0], [-25, -84, 2, 3, 0]] },
];
// Patches inside the seas that are brighter: [lat, lon, a, b, how much]
const UNMARE = [[26, -50, 4, 3, 0.55], [23, -57, 2, 3, 0.3], [-6, -16, 3, 2, 0.35]];

// Famous craters: [lat, lon, diameter km, options]. fresh 0..1: bright walls and ejecta (young);
// old 0..1: worn down and shallow; floor: the floor's own brightness (a lava-filled dark floor);
// bright: extra brightness all over (Aristarchus).
export const CRATERS = [
  [-43.3, -11.2, 85, { fresh: 1, name: 'Tycho' }], [9.6, -20.1, 93, { fresh: 0.85, name: 'Copernicus' }], [8.1, -38.0, 32, { fresh: 0.9, name: 'Kepler' }],
  [23.7, -47.4, 40, { fresh: 1, bright: 0.25, name: 'Aristarchus' }], [51.6, -9.4, 101, { floor: 0.3, old: 0.2, name: 'Plato' }], [-58.4, -14.4, 225, { old: 0.45, name: 'Clavius' }],
  // Clavius's arc of craters across its floor
  [-56.3, -12.0, 52, { old: 0.1 }], [-58.8, -18.2, 44, { old: 0.1 }], [-60.9, -14.3, 21, {}], [-57.8, -9.0, 17, {}], [-56.5, -15.5, 13, {}], [-59.9, -6.1, 25, { old: 0.2 }],
  [-9.3, -1.9, 153, { old: 0.55, flat: 1, floor: 0.6 }], [-13.4, -3.2, 108, { old: 0.4 }], [-18.2, -1.9, 96, { old: 0.25 }], [-11.2, 4.0, 136, { old: 0.4 }], [-5.1, 5.2, 138, { old: 0.85 }],
  [-11.4, 26.4, 100, { fresh: 0.35 }], [-13.2, 24.0, 98, { old: 0.4 }], [-18.0, 23.6, 100, { old: 0.6 }], [-21.5, 33.2, 124, { old: 0.8, flat: 1 }], [-29.7, 32.2, 88, { old: 0.2 }],
  [-50.0, -6.2, 194, { old: 0.75 }], [-49.6, -21.7, 145, { old: 0.5 }], [-44.3, -55.3, 206, { old: 0.55, floor: 0.5 }], [-49.6, -60.2, 84, { flat: 1, old: 0.3 }], [-66.5, -69.1, 300, { old: 0.8 }],
  [-5.2, -68.6, 172, { floor: 0.22, old: 0.3, name: 'Grimaldi' }], [-3.0, -74.6, 139, { floor: 0.3, old: 0.5 }], [-13.8, -50.1, 46, { floor: 0.3 }], [-16.7, -66.8, 46, { floor: 0.3 }], [2.2, -67.6, 115, { old: 0.6 }],
  [-17.6, -40.1, 110, { old: 0.3, flat: 1 }], [-8.9, 61.1, 132, { fresh: 0.2 }], [-25.1, 60.4, 177, { old: 0.25 }], [-16.4, 61.6, 147, { old: 0.75 }], [-36.0, 60.6, 135, { old: 0.6 }], [27.7, 55.5, 125, { old: 0.5 }],
  [31.8, 29.9, 95, { old: 0.6, flat: 1 }], [14.5, -11.3, 58, { fresh: 0.2 }], [29.7, -4.0, 81, { flat: 1, floor: 0.42 }], [33.9, 1.2, 55, { fresh: 0.3 }], [30.7, 1.5, 39, {}], [40.2, 4.6, 57, { flat: 1, old: 0.3 }],
  [50.2, 17.4, 87, { fresh: 0.15 }], [44.3, 16.3, 67, {}], [46.7, 44.4, 87, {}], [46.7, 39.1, 69, {}], [53.6, 57.0, 123, { floor: 0.3 }], [16.1, 46.8, 28, { fresh: 1 }], [14.5, 9.1, 38, { fresh: 0.6 }], [16.3, 16.0, 26, { fresh: 0.8 }],
  [-33.0, 0.7, 128, { old: 0.6 }], [-25.5, -1.9, 118, { old: 0.7 }], [-28.4, -1.0, 126, { old: 0.7 }], [-29.9, -13.5, 106, { old: 0.6, flat: 1 }], [-20.7, -22.2, 61, { fresh: 0.3 }], [-6.0, -17.0, 97, { old: 0.9, flat: 1 }],
  [-45.0, 40.0, 190, { old: 0.9 }], [-41.0, 6.0, 126, { old: 0.5, flat: 1 }], [-41.8, 14.0, 114, { old: 0.4 }], [-70.6, -5.5, 111, { old: 0.2 }], [8.6, -1.6, 12, {}], [-1.9, 47.6, 11, { fresh: 0.7 }],
  [14.6, 54.7, 22, { fresh: 0.4 }], [-24.5, -63.9, 19, { fresh: 0.9 }], [-32.5, 51.6, 8, { fresh: 1 }], [-33.5, 59.0, 11, { fresh: 1 }], [66.3, 10.1, 51, { fresh: 0.7 }], [62.0, -42.0, 165, { old: 0.85 }], [63.5, -63.0, 142, { old: 0.4 }],
  [8.4, -77.6, 43, { fresh: 0.8 }], [61.7, 50.3, 31, { fresh: 0.7 }], [7.6, -50.0, 15, { fresh: 0.6 }], [-26.4, -56.4, 15, {}], [21.6, 39.0, 30, { old: 0.2 }], [26.4, 2.9, 15, {}], [-3.3, -26.8, 9, { fresh: 0.6 }],
];
// Ray systems: [lat, lon, reach (Moon radii, i.e. radians), rays, brightness, seed]
export const RAYS = [
  [-43.3, -11.2, 1.25, 22, 0.4, 3, [[14, 1, 1], [32, 0.75, 0.9], [52, 0.6, 0.8], [75, 0.5, 0.7], [-8, 0.55, 0.7], [-38, 0.55, 0.8], [-70, 0.45, 0.6], [110, 0.4, 0.6], [150, 0.3, 0.5], [200, 0.3, 0.5], [235, 0.35, 0.6], [-100, 0.4, 0.6]]], [9.6, -20.1, 0.42, 34, 0.42, 5], [8.1, -38.0, 0.28, 22, 0.38, 7], [23.7, -47.4, 0.26, 18, 0.36, 11],
  [16.1, 46.8, 0.3, 12, 0.24, 13], [66.3, 10.1, 0.45, 14, 0.17, 17], [-24.5, -63.9, 0.22, 10, 0.18, 19], [-32.5, 51.6, 0.28, 10, 0.2, 23], [-33.5, 59.0, 0.25, 9, 0.18, 29],
  [8.4, -77.6, 0.25, 10, 0.16, 31], [61.7, 50.3, 0.2, 9, 0.15, 37], [-1.9, 47.6, 0.18, 4, 0.18, 41], [16.3, 16.0, 0.12, 8, 0.12, 43], [7.6, -50.0, 0.12, 8, 0.12, 47], [-3.3, -26.8, 0.1, 7, 0.12, 53],
];
// Mountain ranges: lines of peaks, [[lat, lon], ...], height (Moon radii)
export const RANGES = [
  [[[14.5, -10], [17, -6], [19, -3.5], [21, -1], [24, 1.5], [26.5, 3.5]], 0.0035],   // Apennines
  [[[14.5, -30], [14.8, -25], [15, -20], [14.6, -16]], 0.0018],                        // Carpathians
  [[[45.5, -5], [47.5, -1], [49, 2], [48.5, 5]], 0.0022],                              // Alps
  [[[34, 8], [36.5, 9], [39, 9.5], [41.5, 10]], 0.0028],                               // Caucasus
  [[[16.5, 8], [18, 12], [19.5, 15], [19, 19]], 0.0016],                               // Haemus
  [[[45.5, -38], [48, -34], [48.8, -29], [47.5, -25], [45, -24]], 0.0022],             // Jura round Sinus Iridum
  [[[-15, -46], [-20, -45], [-26, -44], [-30, -40]], 0.0012],                          // Humorum's rim
  [[[23, 46], [26, 51], [28, 57], [26, 64], [21, 67], [13, 67], [9, 61], [10, 53], [14, 50]], 0.0016], // Crisium's ring
  [[[-8, 30], [-11, 30], [-15, 30.5], [-20, 29.5]], 0.0014],                           // Altai scarp... and Pyrenees
  [[[-20, 22], [-23, 23], [-26, 25], [-29, 26]], 0.0016],                              // Rupes Altai
];

// ---------- small helpers ----------
const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ll = (lat, lon) => [Math.cos(lat * D2R) * Math.sin(lon * D2R), Math.sin(lat * D2R), Math.cos(lat * D2R) * Math.cos(lon * D2R)];
// east and north at a point on the sphere
const basis = (c) => { const l = Math.hypot(c[2], c[0]) || 1e-6, e = [c[2] / l, 0, -c[0] / l]; return [e, [c[1] * e[2] - c[2] * e[1], c[2] * e[0] - c[0] * e[2], c[0] * e[1] - c[1] * e[0]]]; };

// A wrapping G x G grid (G a power of two) of fractal value noise
function fbmGrid(G, seed, oct, base) {
  const out = new Float32Array(G * G), r = rng(seed);
  let amp = 1, tot = 0;
  for (let o = 0, cells = base; o < oct; o++, cells *= 2, amp *= 0.5) {
    const P = new Float32Array(cells * cells); for (let i = 0; i < P.length; i++) P[i] = r();
    const k = cells / G;
    for (let j = 0; j < G; j++) {
      const fy = j * k, yi = fy | 0, ty = fy - yi, v = ty * ty * (3 - 2 * ty), y0 = (yi % cells) * cells, y1 = ((yi + 1) % cells) * cells;
      for (let i = 0; i < G; i++) {
        const fx = i * k, xi = fx | 0, tx = fx - xi, u = tx * tx * (3 - 2 * tx), x0 = xi % cells, x1 = (xi + 1) % cells;
        const a = P[y0 + x0] + (P[y0 + x1] - P[y0 + x0]) * u, b = P[y1 + x0] + (P[y1 + x1] - P[y1 + x0]) * u;
        out[j * G + i] += (a + (b - a) * v) * amp;
      }
    }
    tot += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
// the grid stretched over a W x H picture, `rep` times across (bilinear, wrapping)
function noiseOver(grid, G, W, H, rep, ox = 0, oy = 0) {
  const out = new Float32Array(W * H), M = G - 1, kx = G * rep / W, ky = G * rep / W;
  for (let j = 0, p = 0; j < H; j++) {
    const fy = (j + 0.5) * ky + oy, yi = Math.floor(fy), ty = fy - yi, r0 = (yi & M) * G, r1 = ((yi + 1) & M) * G;
    for (let i = 0; i < W; i++, p++) {
      const fx = (i + 0.5) * kx + ox, xi = Math.floor(fx), tx = fx - xi, x0 = xi & M, x1 = (xi + 1) & M;
      const a = grid[r0 + x0] + (grid[r0 + x1] - grid[r0 + x0]) * tx, b = grid[r1 + x0] + (grid[r1 + x1] - grid[r1 + x0]) * tx;
      out[p] = a + (b - a) * ty;
    }
  }
  return out;
}
// a w x h picture blown up to W x H (bilinear)
function upsample(src, w, h, W, H, wrap) {
  const out = new Float32Array(W * H), sx = w / W, sy = h / H;
  for (let j = 0, p = 0; j < H; j++) {
    let fy = (j + 0.5) * sy - 0.5; if (fy < 0) fy = 0; if (fy > h - 1) fy = h - 1;
    const y0 = fy | 0, y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for (let i = 0; i < W; i++, p++) {
      let fx = (i + 0.5) * sx - 0.5, x0, x1;
      if (wrap) { if (fx < 0) fx += w; x0 = fx | 0; x1 = (x0 + 1) % w; } else { if (fx < 0) fx = 0; if (fx > w - 1) fx = w - 1; x0 = fx | 0; x1 = Math.min(w - 1, x0 + 1); }
      const tx = fx - x0, a = src[y0 * w + x0] + (src[y0 * w + x1] - src[y0 * w + x0]) * tx, b = src[y1 * w + x0] + (src[y1 * w + x1] - src[y1 * w + x0]) * tx;
      out[p] = a + (b - a) * ty;
    }
  }
  return out;
}
// every pixel's direction on the unit sphere (x east, y north, z towards Earth)
function directions(disc, W, H) {
  const n = W * H, vx = new Float32Array(n), vy = new Float32Array(n), vz = new Float32Array(n);
  for (let j = 0, p = 0; j < H; j++) for (let i = 0; i < W; i++, p++) {
    let x, y, z;
    if (disc) {
      x = (i + 0.5) / W * 2 - 1; y = 1 - (j + 0.5) / H * 2; const r2 = x * x + y * y;
      if (r2 < 1) z = Math.sqrt(1 - r2); else { const r = Math.sqrt(r2); x /= r; y /= r; z = 0; } // outside: the rim (padding)
    } else {
      const th = (1 - (j + 0.5) / H) * Math.PI, ph = (i + 0.5) / W * 2 * Math.PI, st = Math.sin(th);
      x = -Math.sin(ph) * st; y = Math.cos(th); z = -Math.cos(ph) * st;
    }
    vx[p] = x; vy[p] = y; vz[p] = z;
  }
  return { vx, vy, vz };
}
// the block of pixels that can be within angle `ang` of the unit vector c: [j0, j1, i0, i1] (i may wrap on a map)
function rectFor(disc, W, H, c, ang) {
  if (disc) {
    if (c[2] < -Math.sin(Math.min(ang, 1.5))) return null;
    const rad = 2 * Math.sin(Math.min(ang, 3) / 2) + 2 / W;
    return [Math.max(0, Math.floor((1 - (c[1] + rad)) * H / 2)), Math.min(H - 1, Math.ceil((1 - (c[1] - rad)) * H / 2)), Math.max(0, Math.floor((c[0] - rad + 1) * W / 2)), Math.min(W - 1, Math.ceil((c[0] + rad + 1) * W / 2))];
  }
  const th = Math.acos(Math.max(-1, Math.min(1, c[1])));
  let ph = Math.atan2(-c[0], -c[2]); if (ph < 0) ph += Math.PI * 2;
  const sw = Math.sin(th) > 0.05 ? Math.min(Math.PI, ang / Math.sin(th) * 1.2 + 4 / W) : Math.PI;
  return [Math.max(0, Math.floor((1 - (th + ang) / Math.PI) * H)), Math.min(H - 1, Math.ceil((1 - (th - ang) / Math.PI) * H)), Math.floor((ph - sw) / (2 * Math.PI) * W), Math.ceil((ph + sw) / (2 * Math.PI) * W)];
}
function pixAt(disc, W, H, c) {
  if (disc) return Math.min(H - 1, Math.max(0, Math.round((1 - c[1]) * H / 2 - 0.5))) * W + Math.min(W - 1, Math.max(0, Math.round((c[0] + 1) * W / 2 - 0.5)));
  let ph = Math.atan2(-c[0], -c[2]); if (ph < 0) ph += Math.PI * 2;
  return Math.min(H - 1, Math.floor((1 - Math.acos(Math.max(-1, Math.min(1, c[1]))) / Math.PI) * H)) * W + Math.min(W - 1, Math.floor(ph / (2 * Math.PI) * W));
}

// The seas and highlands: the quarter-size seas blown up smoothly, coasts roughened, highlands mottled
function baseLayer(disc, W, H, w, hh, vy, nB, nF, ins, toneL, tintL, nAl, nCl, h, alb, tint, mare) {
  const wrap = !disc;
  const sx = w / W, sy = hh / H, rimR = (1 + 4 / W) ** 2;
  for (let j = 0; j < H; j++) {
    // the quarter-size seas, blown up smoothly (all five maps at once)
    let fy = (j + 0.5) * sy - 0.5; if (fy < 0) fy = 0; if (fy > hh - 1) fy = hh - 1;
    const y0 = fy | 0, r0 = y0 * w, r1 = Math.min(hh - 1, y0 + 1) * w, ty = fy - y0, yd = 1 - (j + 0.5) / H * 2;
    for (let i = 0, p = j * W; i < W; i++, p++) {
      if (disc) { const xd = (i + 0.5) / W * 2 - 1; if (xd * xd + yd * yd > rimR) continue; }   // well outside the disc: leave it plain
      let fx = (i + 0.5) * sx - 0.5, x0, x1;
      if (wrap) { if (fx < 0) fx += w; x0 = fx | 0; x1 = (x0 + 1) % w; } else { if (fx < 0) fx = 0; if (fx > w - 1) fx = w - 1; x0 = fx | 0; x1 = Math.min(w - 1, x0 + 1); }
      const tx = fx - x0, wa = (1 - tx) * (1 - ty), wb = tx * (1 - ty), wc = (1 - tx) * ty, wd = tx * ty, a0 = r0 + x0, a1 = r0 + x1, a2 = r1 + x0, a3 = r1 + x1;
      const insV = ins[a0] * wa + ins[a1] * wb + ins[a2] * wc + ins[a3] * wd, toneV = toneL[a0] * wa + toneL[a1] * wb + toneL[a2] * wc + toneL[a3] * wd;
      const tintV = tintL[a0] * wa + tintL[a1] * wb + tintL[a2] * wc + tintL[a3] * wd, nA = nAl[a0] * wa + nAl[a1] * wb + nAl[a2] * wc + nAl[a3] * wd, nC = nCl[a0] * wa + nCl[a1] * wb + nCl[a2] * wc + nCl[a3] * wd;
      const b = nB[p], f = nF[p];
      const soft = 0.012 + 0.03 * nC; let m = (insV + (b - 0.5) * 0.035 + (f - 0.5) * 0.014) / soft + 0.5; m = m <= 0 ? 0 : m >= 1 ? 1 : m * m * (3 - 2 * m);
      mare[p] = m;
      // highlands: bright and mottled, a little brighter in the south; seas darker, with their own tones
      let south = (-0.1 - vy[p]) / 0.6; south = south <= 0 ? 0 : south >= 1 ? 1 : south * south * (3 - 2 * south);
      const hl = 0.71 + (nA - 0.5) * 0.18 + (b - 0.5) * 0.1 + (f - 0.5) * 0.05 + 0.04 * south;
      alb[p] = hl + (toneV + (f - 0.5) * 0.03 - hl) * m;
      tint[p] = 0.55 + (nC - 0.5) * 0.15 + (tintV - 0.55) * m;
      // highland lumps; flat seas with faint wrinkle ridges
      const rg = 1 - Math.abs(b * 2 - 1), r2 = rg * rg, r4 = r2 * r2;
      h[p] = ((nA - 0.5) * 0.007 + (f - 0.5) * 0.0012) * (1 - m) - 0.003 * m + m * 0.0006 * r4 * r4;
    }
  }
}

function stampCrater(S, c, R, o) {
    const { disc, W, H, vx, vy, vz, h, alb, tint, mare, nB } = S;
    const old = o.old || 0, fresh = o.fresh || 0, complex = R > 0.006, flat = o.flat || 0, post = o.post !== false, jit = o.jit || 0;
    const dep = R * (complex ? 0.13 : 0.28) * (1 - 0.65 * old) * (flat ? 0.6 : 1), fl = complex ? 0.42 + 0.2 * flat : 0;
    const reach = 2.2 + fresh * 0.8, rect = rectFor(disc, W, H, c, R * reach); if (!rect) return;
    const [j0, j1, i0, i1] = rect, cx = c[0], cy = c[1], cz = c[2], iR2 = 2 / (R * R), lim = reach * reach;
    const rimA = dep * 0.36 * (1 - 0.5 * old), ej = dep * 0.12 * (1 - old), wallB = 0.05 * (1 - old) + 0.18 * fresh, floor = o.floor;
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
      const p = j * W + (disc ? ii : ((ii % W) + W) % W);
      const d2 = (1 - (vx[p] * cx + vy[p] * cy + vz[p] * cz)) * iR2; if (d2 >= lim) continue;
      const d = d2 > 0 ? Math.sqrt(d2) : 0, kk = post ? 1 : 1 - 0.85 * mare[p], nb = nB[p];
      let dh = 0, da = 0;
      if (d < 1) {
        const s = d < fl ? 0 : (d - fl) / (1 - fl);
        dh = -dep * (1 - (complex ? s * s * s : s * s));
        if (complex && s > 0) dh += dep * 0.035 * Math.sin(s * 14) * (1 - old);                        // terraced walls
        if (complex && !flat && d < 0.2) { const q = 1 - d / 0.2; dh += dep * 0.55 * q * Math.sqrt(q) * (0.6 + nb * 0.8); } // the central peak
        da = jit + wallB * s * s;
        if (floor != null && d < 0.9) { const f = 1 - smooth(0.72, 0.9, d); alb[p] += (floor + (nb - 0.5) * 0.06 - alb[p]) * f; tint[p] += (0.4 - tint[p]) * f; }
      } else da = jit * Math.max(0, 1.6 - d) / 0.6;
      // the rim: a rounded crest, steep inside and long outside
      const x = (d - 1) / (d < 1 ? 0.12 : 0.32); if (x > -2 && x < 2) { const q = 1 - x * x * 0.25; dh += rimA * q * q * q * q; }
      if (d > 1) { const q = 1 - (d - 1) / (reach - 1); dh += ej * q * q * (0.4 + 1.2 * nb); if (fresh) da += fresh * 0.2 * q * q * (0.5 + nb); }
      h[p] += dh * kk; alb[p] += da * kk;
    }
    if (o.bright) S.visit(c, R * 2.5, (p, dd) => { const a = Math.sqrt(Math.max(0, 2 * (1 - dd))) / R; alb[p] += o.bright * Math.exp(-((a / 1.4) ** 2)); });
}

// One ray system looked up from its table for every pixel it reaches
function rayPixels(disc, W, H, V, c, e, nn, reach, tab, NB, ND, bright, hB, hF, hC, ray) {
  const R = rectFor(disc, W, H, c, reach); if (!R) return;
  const ca = Math.cos(reach), [j0, j1, i0, i1] = R, { vx, vy, vz } = V, R0 = reach * 0.09, k2 = 1 / (R0 * R0), TAU = 2 * Math.PI;
  for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
    const p = j * W + (disc ? ii : ((ii % W) + W) % W), d = vx[p] * c[0] + vy[p] * c[1] + vz[p] * c[2];
    if (d < ca) continue;
    const a = Math.acos(d > 1 ? 1 : d), u = vx[p] * e[0] + vy[p] * e[1] + vz[p] * e[2], v = vx[p] * nn[0] + vy[p] * nn[1] + vz[p] * nn[2];
    let fb = Math.atan2(v, u) / TAU * NB; if (fb < 0) fb += NB;
    const b0 = Math.min(NB - 1, fb | 0), tb = fb - b0, b1 = (b0 + 1) % NB, fd = a / reach * (ND - 1), k0 = Math.min(ND - 2, fd | 0), td = fd - k0;
    const s = (tab[b0 * ND + k0] * (1 - tb) + tab[b1 * ND + k0] * tb) * (1 - td) + (tab[b0 * ND + k0 + 1] * (1 - tb) + tab[b1 * ND + k0 + 1] * tb) * td;
    const near = Math.exp(-a * a * k2) * 0.25;                       // the bright splash close in
    const patch = 0.35 + 1.6 * hF[p] * hB[p] + 0.3 * hC[p];
    ray[p] += bright * ((s < 1.1 ? s : 1.1) * patch + near);
  }
}

// One blob of a sea, on the quarter-size picture: adds its smooth "how far inside" weight
function seaBlob(disc, w, hh, V, c, e, nn, A, B, cr, sr, mn, TAU, tone, edge, tnt, sum, sizeW, toneW, tintW) {
  const R = rectFor(disc, w, hh, c, Math.max(A, B) * 1.5 + 0.12); if (!R) return;
  const ca = Math.cos(Math.max(A, B) * 1.5 + 0.12), [j0, j1, i0, i1] = R, { vx, vy, vz } = V;
  for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
    const p = j * w + (disc ? ii : ((ii % w) + w) % w), x = vx[p], y = vy[p], z = vz[p];
    if (x * c[0] + y * c[1] + z * c[2] < ca) continue;
    const u0 = x * e[0] + y * e[1] + z * e[2], w0 = x * nn[0] + y * nn[1] + z * nn[2];
    const u = (u0 * cr + w0 * sr) / A, v = (-u0 * sr + w0 * cr) / B, inside = (1 - Math.sqrt(u * u + v * v)) * mn;
    const wt = Math.exp(Math.min(30, inside / TAU));
    let k = inside / 0.05; k = k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
    sum[p] += wt; sizeW[p] += wt * mn; toneW[p] += wt * (tone - edge * (1 - k)); tintW[p] += wt * tnt;
  }
}
// One mountain peak
function stampPeak(disc, W, H, vx, vy, vz, h, alb, nB, c, R, top) {
  const rect = rectFor(disc, W, H, c, R * 2.2); if (!rect) return;
  const [j0, j1, i0, i1] = rect, k = 2 / (R * R) * 1.6, lim = (1 - Math.cos(R * 2.2)) * k;
  for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
    const p = j * W + (disc ? ii : ((ii % W) + W) % W), q = (1 - (vx[p] * c[0] + vy[p] * c[1] + vz[p] * c[2])) * k;
    if (q > lim) continue;
    const g = Math.exp(-q); h[p] += top * g * (0.6 + 0.8 * nB[p]); alb[p] += 0.03 * g;
  }
}

// a cratered world: many little ones, fewer big ones; most made before the seas flooded
function randomCraters(S, total, Rmin, mare, rr) {
  const { disc, W, H } = S;
  for (let i = 0; i < total; i++) {
    const z = rr() * 2 - 1, a = rr() * Math.PI * 2, q = Math.sqrt(1 - z * z), c = [q * Math.cos(a), z, q * Math.sin(a)];
    const R = Math.min(0.05, Rmin * (1 - rr()) ** (-1 / 1.9)), post = rr() < 0.3, fr = rr(), old = rr(), jit = (rr() - 0.5) * 0.14;
    if (disc && c[2] < -0.05) continue;
    if (mare[pixAt(disc, W, H, c)] > 0.5 && post && fr > 0.3) continue;   // the seas have far fewer craters
    stampCrater(S, c, R, { post, fresh: post && fr < 0.15 ? fr * 4 : 0, old: post ? old * 0.5 : 0.3 + old * 0.7, jit });
  }
}
// one ray across the direction bins of its table, at one distance
function rayBins(tab, NB, ND, kd, bc, bci, span, wd, along) {
  const k = 2 * Math.PI / NB / wd;
  for (let db = -span; db <= span; db++) { const bi = ((bci + db) % NB + NB) % NB, off = (bci + db - bc) * k; tab[bi * ND + kd] += along * Math.exp(-off * off); }
}

// ---------- The builder ----------
export function moonFields(proj = 'disc', W = 1024, H = proj === 'disc' ? W : W / 2) {
  const t0 = performance.now(), n = W * H, disc = proj === 'disc', T = [];
  const { vx, vy, vz } = directions(disc, W, H);
  // visit every pixel within angle `ang` of c: fn(p, cosine of the angle)
  const visitIn = (V, w, h, c, ang, fn) => {
    const R = rectFor(disc, w, h, c, ang); if (!R) return;
    const ca = Math.cos(ang), [j0, j1, i0, i1] = R;
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) {
      const p = j * w + (disc ? ii : ((ii % w) + w) % w), d = V.vx[p] * c[0] + V.vy[p] * c[1] + V.vz[p] * c[2];
      if (d >= ca) fn(p, d);
    }
  };
  const full = { vx, vy, vz }, visit = (c, ang, fn) => visitIn(full, W, H, c, ang, fn);
  // noise: broad (A, C) and fine (B, F)
  const G = 256, gA = fbmGrid(G, 7, 5, 4), gB = fbmGrid(G, 11, 4, 16), gC = fbmGrid(G, 13, 4, 6);
  const nB = noiseOver(gB, G, W, H, 1.5), nF = noiseOver(gB, G, W, H, 6, 17, 41);
  T.push(performance.now() - t0);

  // 1. The seas, worked out on a picture a quarter the size (their shapes are broad), then their
  //    coasts sharpened and roughened at full size
  const w = W >> 2, hh = H >> 2, nl = w * hh, low = directions(disc, w, hh);
  const nAl = noiseOver(gA, G, w, hh, 1), nCl = noiseOver(gC, G, w, hh, 1, 91, 37);
  // each blob's "how far inside" (radians) is blended with the others smoothly (no seams where blobs
  // overlap), then the coasts are pushed in and out by broad and middling noise
  const nMl = noiseOver(gB, G, w, hh, 0.5, 5, 9), TAU = 0.007;
  const sum = new Float32Array(nl), toneW = new Float32Array(nl), tintW = new Float32Array(nl), sizeW = new Float32Array(nl);
  for (const M of MARIA) for (const [lat, lon, a, b, rot] of M.blobs) {
    const c = ll(lat, lon), [e, nn] = basis(c), A = a * D2R, B = b * D2R, cr = Math.cos(rot * D2R), sr = Math.sin(rot * D2R), mn = Math.min(A, B);
    seaBlob(disc, w, hh, low, c, e, nn, A, B, cr, sr, mn, TAU, M.tone, M.edge || 0, M.tint, sum, sizeW, toneW, tintW);
  }
  const ins = new Float32Array(nl), toneL = new Float32Array(nl), tintL = new Float32Array(nl);
  for (let p = 0; p < nl; p++) {
    const sm = sum[p];
    const big = sm > 1e-12 ? Math.min(1, Math.max(0.3, sizeW[p] / sm / 0.18)) : 1;   // small seas get smaller wobbles
    ins[p] = (sm > 1e-12 ? TAU * Math.log(sm) : -1) - 0.004 + ((nAl[p] - 0.5) * 0.15 + (nMl[p] - 0.5) * 0.13) * big;
    toneL[p] = (sm > 1e-12 ? toneW[p] / sm : 0.4) + (nCl[p] - 0.5) * 0.2 + (nMl[p] - 0.5) * 0.1;
    tintL[p] = (sm > 1e-12 ? tintW[p] / sm : 0.55) + (nCl[p] - 0.5) * 0.35;
  }
  for (const [lat, lon, a, b, k] of UNMARE) { const c = ll(lat, lon), A = a * D2R; visitIn(low, w, hh, c, A * 1.6, (p, d) => { const ang = Math.acos(Math.min(1, d)); ins[p] -= k * 0.06 * (1 - smooth(A * 0.5, A * 1.5, ang)); }); }
  const wrap = !disc, h = new Float32Array(n), alb = new Float32Array(n).fill(0.7), tint = new Float32Array(n).fill(0.55), mare = new Float32Array(n);
  baseLayer(disc, W, H, w, hh, vy, nB, nF, ins, toneL, tintL, nAl, nCl, h, alb, tint, mare);
  T.push(performance.now() - t0);

  // 2. Craters, stamped straight into the maps
  const S = { disc, W, H, vx, vy, vz, h, alb, tint, mare, nB, visit }, crater = (c, R, o) => stampCrater(S, c, R, o);
  // a cratered world: many little ones, fewer big ones; most made before the seas flooded
  const pix = disc ? 2 / W : 2 * Math.PI / W, rr = rng(91), Rmin = Math.max(0.0016, pix * 1.2);
  const total = Math.min(70000, Math.round(5500 * (0.006 / Rmin) ** 1.9));
  randomCraters(S, total, Rmin, mare, rr);
  for (const [lat, lon, km, o] of CRATERS) crater(ll(lat, lon), km / 2 / 1737, { post: true, ...o });
  // Tycho's dark collar of melt, just outside its rim
  { const R = 42.5 / 1737; visit(ll(-43.3, -11.2), R * 1.8, (p, d) => { const a = Math.sqrt(Math.max(0, 2 * (1 - d))) / R; alb[p] -= 0.08 * Math.exp(-(((a - 1.25) / 0.22) ** 2)); }); }
  T.push(performance.now() - t0);

  // 3. Mountain ranges: rows of peaks
  const rp = rng(57);
  for (const [pts, top0] of RANGES) for (let s = 0; s < pts.length - 1; s++) for (let k = 0; k < 22; k++) {
    const f = k / 22, lat = pts[s][0] + (pts[s + 1][0] - pts[s][0]) * f + (rp() - 0.5) * 2.6, lon = pts[s][1] + (pts[s + 1][1] - pts[s][1]) * f + (rp() - 0.5) * 2.6;
    const R = 0.003 + rp() ** 2 * 0.012, top = top0 * (0.3 + rp()) * Math.sqrt(R / 0.01), iR2 = 2 / (R * R);
    stampPeak(disc, W, H, vx, vy, vz, h, alb, nB, ll(lat, lon), R, top);
  }

  T.push(performance.now() - t0);
  // 4. Rays: long, faint, patchy streaks fanning out from the young craters. Each system is drawn
  //    first into a small table by direction and distance, then looked up for every pixel.
  //    (on a half-size picture: they are soft streaks, and this is the slowest step)
  const NB = 720, ND = 64, W2 = W >> 1, H2 = H >> 1, half = directions(disc, W2, H2), ray = new Float32Array(W2 * H2);
  const hB = noiseOver(gB, G, W2, H2, 1.5), hF = noiseOver(gB, G, W2, H2, 6, 17, 41), hC = noiseOver(gC, G, W2, H2, 1, 91, 37);
  for (const [lat, lon, reach, nr, bright, seed, main] of RAYS) {
    const c = ll(lat, lon), [e, nn] = basis(c), r = rng(seed), tab = new Float32Array(NB * ND);
    for (let k = 0; k < nr + (main ? main.length : 0); k++) {
      const M = k >= nr ? main[k - nr] : null;   // the named long rays: [bearing from north (degrees), length, strength]
      const b0 = M ? (90 - M[0]) * D2R : r() * Math.PI * 2, w0 = M ? 0.005 + 0.004 * r() : 0.002 + r() * 0.005, len = M ? reach * M[1] : reach * (0.25 + 0.6 * r()), str = M ? M[2] : 0.15 + 0.6 * r() ** 2, f1 = 3 + r() * 9, f2 = r() * 6, a0 = reach * (0.04 + 0.1 * r());
      const bc = b0 / (2 * Math.PI) * NB, bci = Math.round(bc);
      for (let kd = 1; kd < ND; kd++) {
        const a = (kd / (ND - 1)) * reach; if (a > len) break;
        const wd = (w0 + a * 0.012) / Math.sin(a), along = str * (1 - a / len) ** (M ? 0.4 : 0.7) * (0.6 + 0.4 * Math.sin(a / reach * f1 * 6 + f2)) * smooth(a0 * 0.5, a0 * 1.5, a);
        const span = Math.min(NB / 2, Math.ceil(wd * 2.5 / (2 * Math.PI) * NB));
        rayBins(tab, NB, ND, kd, bc, bci, span, wd, along);
      }
    }
    rayPixels(disc, W2, H2, half, c, e, nn, reach, tab, NB, ND, bright, hB, hF, hC, ray);
  }
  T.push(performance.now() - t0);
  const rayF = upsample(ray, W2, H2, W, H, wrap);
  for (let p = 0; p < n; p++) {
    const add = rayF[p], a = alb[p] + add;
    alb[p] = a < 0.05 ? 0.05 : a > 1 ? 1 : a;
    if (add > 0.002) tint[p] += (0.62 - tint[p]) * Math.min(1, add * 2);
  }
  T.push(performance.now() - t0);
  const out = { proj, W, H, h, alb, tint, vx, vy, vz };
  out.ms = performance.now() - t0;
  console.log(`Moon map (${proj} ${W}x${H}) built in ${out.ms.toFixed(0)} ms (stages ${T.map((x) => x.toFixed(0)).join(' ')})`);
  return out;
}

// ---------- Textures ----------
export const MOON_SLOPE = 0.9, MOON_HMAX = 0.012;   // how the slopes and heights are packed into bytes

// the face map's bytes: R brightness, G B slopes east / north, A height (rows bottom-up, as textures go)
const enc = (v) => (v <= -1 ? 0 : v >= 1 ? 255 : (128 + 127 * v + 0.5) | 0);
function packFace(N, h, alb, vx, vy, vz) {
  const data = new Uint8Array(N * N * 4), dx = 2 / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const p = j * N + i, q = ((N - 1 - j) * N + i) * 4;   // texture rows go bottom-up
    const x = vx[p], y = vy[p], z = vz[p];
    let ge = 0, gn = 0;
    if (z > 0) {
      const hx = (h[p + (i < N - 1 ? 1 : 0)] - h[p - (i > 0 ? 1 : 0)]) / (2 * dx), hy = (h[p - (j > 0 ? N : 0)] - h[p + (j < N - 1 ? N : 0)]) / (2 * dx);
      // the slope on the curved surface, from the slope across the flat picture
      const s = hx * x + hy * y, gx = hx - x * s, gy = hy - y * s, gz = -z * s, l = Math.sqrt(x * x + z * z) || 1e-6;
      ge = (gx * z - gz * x) / l; gn = (-gx * x * y + gy * (x * x + z * z) - gz * y * z) / l;
    }
    data[q] = enc(alb[p] * 2 - 1);
    data[q + 1] = enc(ge / MOON_SLOPE);
    data[q + 2] = enc(gn / MOON_SLOPE);
    data[q + 3] = enc(h[p] / MOON_HMAX);
  }
  return data;
}
// The face for the sky's Moon shader: R brightness, G B slopes east / north, A height; plus a small
// colour (tint) map. Built once.
let skyTex = null;
export function moonSkyTextures(N = 1024) {
  if (skyTex) return skyTex;
  const t0 = performance.now(), F = moonFields('disc', N), { h, alb, tint, vx, vy, vz } = F;
  const data = packFace(N, h, alb, vx, vy, vz);
  const face = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  face.magFilter = THREE.LinearFilter; face.minFilter = THREE.LinearMipmapLinearFilter; face.generateMipmaps = true; face.anisotropy = 4; face.needsUpdate = true;
  // the colour map (soft, so small): warm highlands, blue-grey or brownish seas
  const C = 256, cd = new Uint8Array(C * C * 4), k = N / C;
  for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
    const t = tint[Math.floor((j + 0.5) * k) * N + Math.floor((i + 0.5) * k)], q = ((C - 1 - j) * C + i) * 4;
    const c = tintRGB(t); cd[q] = c[0] * 200; cd[q + 1] = c[1] * 200; cd[q + 2] = c[2] * 200; cd[q + 3] = 255;
  }
  const col = new THREE.DataTexture(cd, C, C, THREE.RGBAFormat); col.magFilter = THREE.LinearFilter; col.minFilter = THREE.LinearFilter; col.needsUpdate = true;
  skyTex = { face, col, N, ms: performance.now() - t0 };   // (the big working maps are let go now)
  console.log(`Moon textures ready in ${skyTex.ms.toFixed(0)} ms (maps ${F.ms.toFixed(0)} ms)`);
  return skyTex;
}
// tint 0 (blue-grey) .. 0.55 (neutral warm grey) .. 1 (brownish), as colour multipliers ~1
function tintRGB(t) {
  const a = t < 0.55 ? t / 0.55 : 1, b = t > 0.55 ? (t - 0.55) / 0.45 : 0;
  const r = 0.9 + 0.13 * a + 0.04 * b, g = 0.96 + 0.05 * a - 0.02 * b, bl = 1.1 - 0.15 * a - 0.08 * b;
  return [r, g, bl];
}

// A plain colour picture of the full Moon (disc filling the square, north up), with a little relief
// baked in so the craters read. For chapters that draw their own Moon (the eclipses).
let faceTex = null;
export function moonFaceTexture() {
  if (faceTex) return faceTex;
  const { face, N } = moonSkyTextures(), d = face.image.data, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N), o = img.data, cd = skyTex.col.image.data, C = skyTex.col.image.width, k = C / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const q = ((N - 1 - j) * N + i) * 4, p = (j * N + i) * 4;
    const ge = (d[q + 1] - 128) / 127, gn = (d[q + 2] - 128) / 127, shade = Math.max(0.6, Math.min(1.4, 1 - 0.55 * ge - 0.2 * gn));
    const t = ((C - 1 - Math.floor(j * k)) * C + Math.floor(i * k)) * 4, a = d[q] / 255 * 1.12 * shade * 255 / 200;
    o[p] = Math.min(255, a * cd[t]); o[p + 1] = Math.min(255, a * cd[t + 1]); o[p + 2] = Math.min(255, a * cd[t + 2]); o[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  faceTex = new THREE.CanvasTexture(c); faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
  return faceTex;
}

// The sky Moon's shading (GLSL): the face lit by the Sun from direction L (in the Moon's own frame:
// x right, y up, z towards you), with slopes, short shadows near the line between day and night,
// gentle limb darkening and faint earthshine on the dark part. q: the point on the disc (-1..1).
export const MOON_GLSL = /* glsl */`
uniform sampler2D moonFace, moonCol; uniform vec3 moonL; uniform float moonEarth, moonBump, moonDetail;
// fine bumps for a Moon drawn very big (finer than the face map): value noise and its slope
float mhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 mnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = mhash(i), b = mhash(i + vec2(1.0, 0.0)), c = mhash(i + vec2(0.0, 1.0)), d = mhash(i + vec2(1.0, 1.0));
  return vec3(a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y, du * (vec2(b - a, c - a) + (a - b - c + d) * u.yx));
}
float moonH(vec2 uv) { return (texture2D(moonFace, uv).a - 0.5) * ${(2 * MOON_HMAX).toFixed(4)}; }
// returns linear colour; lit = how much sunlight (0..1)
vec3 moonShade(vec2 q, out float lit) {
  float r2 = dot(q, q); vec3 n = vec3(q, sqrt(max(0.0, 1.0 - r2)));
  vec2 uv = q * 0.5 + 0.5; vec4 t = texture2D(moonFace, uv);
  vec3 tc = texture2D(moonCol, uv).rgb * 1.275;
  vec3 alb = pow(vec3(t.r), vec3(2.2)) * tc * tc;
  // the bumpy surface
  vec3 e = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0)); vec3 no = cross(n, e);
  vec2 g = (t.gb - 0.5) * ${(2 * MOON_SLOPE).toFixed(3)} * moonBump;
  if (moonDetail > 0.0) {
    vec3 n1 = mnoise(q * 140.0), n2 = mnoise(q * 330.0 + 7.0);
    g += (n1.yz / 140.0 * 1.2 + n2.yz / 330.0 * 0.8) * 60.0 * moonDetail * 0.03;
    t.r *= 1.0 + (n1.x - 0.5) * 0.08 * moonDetail + (n2.x - 0.5) * 0.06 * moonDetail;
  }
  vec3 bn = normalize(n - g.x * e - g.y * no);
  float mug = dot(n, moonL), mu0 = dot(bn, moonL), mu = max(n.z, 0.05);
  // Lommel-Seeliger (the full Moon is nearly flat-lit) mixed with a little Lambert: subtle limb darkening
  float m0 = max(mu0, 0.0), ls = 2.0 * m0 / (m0 + mu), sh = mix(m0, ls, 0.72);
  float h0 = (t.a - 0.5) * ${(2 * MOON_HMAX).toFixed(4)};
  // past the terminator only the high peaks still catch the Sun
  sh *= smoothstep(-0.015, 0.015, mug + sqrt(max(0.0, 2.0 * h0)));
  // shadows: near the terminator, march a few steps towards the Sun across the height map
  if (mug < 0.3 && sh > 0.0) {
    vec3 lt = moonL - n * mug; float ll = length(lt);
    if (ll > 1e-3) {
      vec2 dir = lt.xy / ll; float slope = mug / ll, occ = 0.0;
      for (int k = 1; k <= 10; k++) {
        float s = float(k * k) * 0.0009;   // 0.0009 .. 0.09 Moon radii
        float hk = moonH(uv + dir * s * 0.5) - (h0 + s * slope + s * s * 0.5);
        occ = max(occ, smoothstep(0.0, 0.0008, hk));
      }
      sh *= 1.0 - occ;
    }
  }
  lit = clamp(sh, 0.0, 1.0);
  vec3 col = alb * sh * 1.25;
  // earthshine: sunlight bounced off the Earth, faintly blue, on the night side
  col += alb * vec3(0.55, 0.65, 0.9) * moonEarth * smoothstep(0.08, -0.05, mug);
  return col;
}`;
