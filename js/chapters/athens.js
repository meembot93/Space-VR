// The city of Athens around 350 BC, seen at night from the hill of the Agora: the city wall with
// its towers and the great double gate, the Long Wall running down to the sea, hundreds of
// whitewashed houses with red tile roofs, the Agora's long stoa, round Tholos and a second
// temple, and the Acropolis rock with its own wall, the gateway (Propylaea), the bronze Athena
// and the Parthenon on top. Everything is merged into a few meshes to keep draw calls low.
import * as THREE from 'three';
import { Kit } from '../kit.js';
import { rng, noise2 } from '../shapes.js';
import { canvasTex } from '../util.js';
import { loadProps } from '../props.js';
// Meem's whitewashed Greek house (simplified: the nearest is 44 m away), waited for before the chapter builds
const PROPS = await loadProps(['house_greek_lo']);

const TILE = 0xa8583a, TILE2 = 0x9a4a30, STONE = 0x9a8c72, BRICK = 0xc8b692, WHITE = [0xe4dac4, 0xdcceb2, 0xd2c09e, 0xe8e0cc, 0xcfc2a8];
const N = noise2(77);

// is (x, z) inside the polygon?
function inside(poly, x, z) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
// distance from (x, z) to the segment a-b
function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
// a pitched roof: a triangular prism, ridge along the local x axis
function roof(k, w, d, rise, color, p, yaw) {
  const g = new THREE.CylinderGeometry(1, 1, w, 3, 1);
  g.rotateZ(Math.PI / 2); g.rotateX(Math.PI / 2);   // ridge along x, apex up
  g.scale(1, rise / 1.5, d / 2 / 0.866);
  g.translate(0, rise / 3 - 0.0, 0);
  k.add(g, color, p, [0, yaw, 0]);
}
// a whitewashed house with a tiled roof (some with a second floor or a courtyard wing)
function house(k, x, y, z, w, d, h, yaw, r) {
  const c = Math.cos(yaw), s = Math.sin(yaw), wall = WHITE[Math.floor(r() * WHITE.length)];
  // within 100 m: Meem's model (it has its own roof, door and windows); past that, these simple shapes
  if (k.P && Math.hypot(x, z) < 100 && k.P.add('house_greek_lo', x, y, z, yaw, { w, d, h: h + 2 })) { r(); r(); return; }
  k.box(w, h + 1.5, d, wall, [x, y + (h - 1.5) / 2, z], [0, yaw, 0]);
  roof(k, w + 0.5, d + 0.7, d * 0.28, r() < 0.5 ? TILE : TILE2, [x, y + h, z], yaw);
  // door and a small dark window on the street side
  k.box(0.9, 1.8, 0.1, 0x3a2a1a, [x + s * (d / 2 + 0.02), y + 0.9, z + c * (d / 2 + 0.02)], [0, yaw, 0]);
  if (h > 4) k.box(0.6, 0.6, 0.1, 0x2a2018, [x + s * (d / 2 + 0.02) + c * w * 0.25, y + h * 0.7, z + c * (d / 2 + 0.02) - s * w * 0.25], [0, yaw, 0]);
  // a courtyard wing on bigger houses
  if (w > 9 && r() < 0.6) {
    const ox = -c * (w / 2 - 2), oz = s * (w / 2 - 2);
    k.box(4, 2.6, d * 0.8, wall, [x + ox - s * d * 0.8, y + 0.8, z + oz - c * d * 0.8], [0, yaw, 0]);
  }
}

export function buildAthens({ H, temple, colonnade, avoid }) {
  const r = rng(321);
  const city = new Kit(), walls = new Kit();
  const marble = [];         // geometries of the temples (with their own colours)
  const torches = [], windows = [], blockers = [];

  // ---------------- The city wall ----------------
  // A ring of stone walls round the city, open to the south where the hill drops to the sea.
  const poly = [[-64, 26], [-82, -8], [-112, -62], [-255, -118], [-285, -300], [-80, -400], [130, -340], [150, -150], [102, -40], [86, 24]];
  const WH = 8.5, WT = 4;    // wall height above the ground, thickness
  const gate = { e: 0, t: 0.62 };   // the great double gate (Dipylon), on the first stretch, left of the temple
  const gp = [poly[0][0] + (poly[1][0] - poly[0][0]) * gate.t, poly[0][1] + (poly[1][1] - poly[0][1]) * gate.t];
  const tower = (x, z, yaw, size = 7.5, extra = 5.5, big = false) => {
    const y = Math.min(H(x, z), H(x + 3, z + 3), H(x - 3, z - 3)) - 3, hh = WH + extra + 3;
    walls.box(size, 3.4, size, STONE, [x, y + 1.7, z], [0, yaw, 0]);
    walls.box(size - 0.3, hh - 3.4, size - 0.3, BRICK, [x, y + 3.4 + (hh - 3.4) / 2, z], [0, yaw, 0]);
    walls.box(size + 0.3, 0.35, size + 0.3, STONE, [x, y + hh, z], [0, yaw, 0]);
    // battlements: three merlons a side
    const c = Math.cos(yaw), s = Math.sin(yaw), m = size / 2 - 0.4;
    for (const [u, v] of [[-1, 1], [0, 1], [1, 1], [-1, -1], [0, -1], [1, -1]]) {
      for (const sw of [0, 1]) {
        const a = sw ? v * m : u * (size / 3), b = sw ? u * (size / 3) : v * m;
        walls.box(sw ? 0.6 : 1.3, 1.2, sw ? 1.3 : 0.6, BRICK, [x + c * a + s * b, y + hh + 0.75, z - s * a + c * b], [0, yaw, 0]);
      }
    }
    // a tiled pyramid roof on the big gate towers, dark arrow slits on every face
    if (big) walls.add(new THREE.ConeGeometry(size * 0.72, 3.2, 4, 1), TILE, [x, y + hh + 1.9, z], [0, yaw + Math.PI / 4, 0]);
    for (let f = 0; f < 4; f++) {
      const a = yaw + f * Math.PI / 2, fx = Math.sin(a) * (size / 2 - 0.1), fz = Math.cos(a) * (size / 2 - 0.1);
      walls.box(0.35, 1.4, 0.3, 0x2a2018, [x + fx, y + hh - 2.6, z + fz], [0, a, 0]);
    }
    torches.push(new THREE.Vector3(x, y + hh + 1.6, z));
    return y + hh;
  };
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  for (let e = 0; e < poly.length - 1; e++) {
    const a = poly[e], b = poly[e + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);       // box x axis along the wall
    // which side is outside: away from the middle of the city
    const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    const out = (nx * (mx - cx) + nz * (mz - cz)) > 0 ? 1 : -1;
    const n = Math.ceil(len / 9), step = len / n;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (e === gate.e && Math.abs(t - gate.t) * len < 9) continue;   // the gate's opening and towers
      const y = Math.min(H(x - (b[0] - a[0]) / n / 2, z - (b[1] - a[1]) / n / 2), H(x + (b[0] - a[0]) / n / 2, z + (b[1] - a[1]) / n / 2)) - 3;
      walls.box(step + 0.05, 3.6, WT + 0.4, STONE, [x, y + 1.8, z], [0, yaw, 0]);                    // stone footing
      walls.box(step + 0.05, WH + 3 - 3.6, WT, BRICK, [x, y + 3.6 + (WH - 0.6) / 2, z], [0, yaw, 0]);  // plastered brick
      walls.box(step + 0.05, 0.3, WT + 0.3, STONE, [x, y + WH + 3, z], [0, yaw, 0]);                   // coping
      // merlons along the outer edge of the walkway
      const ox = nx * out * (WT / 2 - 0.3), oz = nz * out * (WT / 2 - 0.3), m = Math.max(2, Math.round(step / 2.2));
      for (let j = 0; j < m; j++) {
        const u = ((j + 0.5) / m - 0.5) * step, ux = Math.cos(yaw) * u, uz = -Math.sin(yaw) * u;
        walls.box(1.2, 1.1, 0.6, BRICK, [x + ux + ox, y + WH + 3.7, z + uz + oz], [0, yaw, 0]);
      }
    }
    // towers along the stretch, about every 38 m, and at every corner
    const nt = Math.max(1, Math.round(len / 38));
    for (let i = 0; i < nt; i++) {
      const t = i / nt, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (e === gate.e && Math.abs(t - gate.t) * len < 16) continue;
      tower(x, z, yaw, i === 0 ? 8.5 : 7.5, i === 0 ? 6.5 : 5.5);
    }
  }
  tower(...poly[poly.length - 1], 0, 8.5, 6.5);
  // The great gate: two massive towers either side of a deep gateway with open bronze doors
  {
    const a = poly[gate.e], b = poly[gate.e + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, yaw = Math.atan2(-uz, ux);
    const [x, z] = gp, y = H(x, z) - 3, gw = 6.5, gh = 7;
    for (const side of [-1, 1]) {
      const tx = x + ux * side * 8.5, tz = z + uz * side * 8.5;
      tower(tx, tz, yaw, 10, 9, true);
      // the doors, swung open toward the city
      walls.box(0.25, gh, gw / 2, 0x6a4a22, [x + ux * side * 3.0 + uz * 2.4, y + 3 + gh / 2, z + uz * side * 3.0 - ux * 2.4], [0, yaw + Math.PI / 2 + side * 0.5, 0]);
    }
    // lintel and the wall over the gateway, with a painted band
    walls.box(gw + 1.4, WH + 3 - gh - 3 + 1.2, WT + 1, BRICK, [x, y + 3 + gh + (WH - gh + 1.2) / 2, z], [0, yaw, 0]);
    walls.box(gw + 1.6, 0.8, WT + 1.1, 0x8a7a60, [x, y + 3 + gh + 0.4, z], [0, yaw, 0]);
    walls.box(gw + 1.7, 0.4, WT + 1.2, 0x9a3a2a, [x, y + 3 + gh + 1.6, z], [0, yaw, 0]);
    // fires burning in front of the gate
    for (const side of [-1, 1]) torches.push(new THREE.Vector3(x + ux * side * 4.2 + uz * 3.6, y + 5.4, z + uz * side * 4.2 - ux * 3.6));
  }
  // The Long Wall, running down the hill to the harbour by the sea
  {
    const a = poly[0], b = [-190, 210], len = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    const n = Math.ceil(len / 8);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = H(x, z) - 3;
      walls.box(len / n + 0.4, WH + 2, WT - 0.5, BRICK, [x, y + (WH + 2) / 2, z], [0, yaw, 0]);
      walls.box(len / n + 0.4, 0.3, WT, STONE, [x, y + WH + 2, z], [0, yaw, 0]);
      if (i % 5 === 0) tower(x, z, yaw, 6.5, 4);
    }
  }

  // ---------------- The Acropolis ----------------
  const AC = new THREE.Vector3(-123, 0, -170), AY = H(AC.x, AC.z) - 2, RH = 50, ROT = 0.56;
  const co = Math.cos(ROT), si = Math.sin(ROT);
  const L2W = (u, v) => [AC.x + co * u + si * v, AC.z - si * u + co * v];   // the rock's own axes (u east-ish, v toward us)
  {
    // the rock: a craggy, steep-sided table, longer than it is wide
    const g = new THREE.CylinderGeometry(1, 1.45, 1, 22, 5, false), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), rr = Math.hypot(x, z);
      const top = y > 0.49, k = top ? 1 : 1 + 0.18 * (N(Math.cos(a) * 2 + y * 3, Math.sin(a) * 2) - 0.5);
      p.setXYZ(i, x * 68 * k, (y + 0.5) * RH + (top ? 0 : (N(a * 3, y * 4) - 0.5) * 6), z * 40 * k * (rr > 0 ? 1 : 1));
    }
    g.computeVertexNormals();
    city.add(g, 0x8a7a62, [AC.x, AY, AC.z], [0, ROT, 0]);
    city.add(new THREE.CylinderGeometry(1, 1, 0.6, 22), 0x8a7e66, [AC.x, AY + RH + 0.2, AC.z], [0, ROT, 0], [66, 1, 38.5]);  // levelled top
    // its own wall round the edge
    for (let i = 0; i < 40; i++) {
      const a0 = i / 40 * Math.PI * 2, a1 = (i + 1) / 40 * Math.PI * 2;
      const [x0, z0] = L2W(Math.cos(a0) * 66, Math.sin(a0) * 38.5), [x1, z1] = L2W(Math.cos(a1) * 66, Math.sin(a1) * 38.5);
      if (Math.cos((a0 + a1) / 2) < -0.93) continue;   // the gateway end, to the west
      city.box(Math.hypot(x1 - x0, z1 - z0) + 0.3, 4.5, 2, BRICK, [(x0 + x1) / 2, AY + RH + 2.2, (z0 + z1) / 2], [0, Math.atan2(-(z1 - z0), x1 - x0), 0]);
    }
    // the Parthenon, broadside to us, its front to the east
    const P = temple({ L: 69.5, W: 30.9, nL: 17, nW: 8, colH: 10.4, colD: 1.9, seg: 12, figures: true });
    const [px, pz] = L2W(10, 16); P.geo.rotateY(ROT); P.geo.translate(px, AY + RH + 0.5, pz); marble.push(P.geo);
    // the Erechtheion, smaller, on the north side
    const E = temple({ L: 23, W: 11.6, nL: 6, nW: 6, colH: 6.6, colD: 0.7, seg: 10, figures: false });
    const [ex, ez] = L2W(-8, -18); E.geo.rotateY(ROT); E.geo.translate(ex, AY + RH + 0.5, ez); marble.push(E.geo);
    // the gateway (Propylaea), facing west down the ramp
    const pk = new Kit();
    colonnade(pk, 0, 0, Math.PI / 2, 6, 3.4, 8.8, 0.8, 0xe8e0cc, 0xd8ccb0, 14, 0, true);
    colonnade(pk, 0, -15, 0, 4, 3, 6.5, 0.55, 0xe8e0cc, 0xd8ccb0, 6, 0, true);
    colonnade(pk, 0, 15, Math.PI, 4, 3, 6.5, 0.55, 0xe8e0cc, 0xd8ccb0, 6, 0, true);
    const pg = pk.geometry(); pg.rotateY(ROT); const [gx, gz] = L2W(-66, 0); pg.translate(gx, AY + RH + 0.4, gz); marble.push(pg);
    // the zig-zag ramp up the west end
    for (let i = 0; i < 5; i++) {
      const [x, z] = L2W(-82 - i * 2, (i % 2 ? 1 : -1) * 10);
      city.box(30, 0.8, 5, 0x9a8e74, [x, AY + RH * (1 - (i + 1) / 6), z], [i % 2 ? 0.12 : -0.12, ROT + Math.PI / 2, 0]);
    }
    // the great bronze Athena (Promachos) with her spear and shield, between the gateway and the Parthenon
    const [ax, az] = L2W(-36, 12), sy = AY + RH + 0.5;
    city.box(3, 2.5, 3, 0xd8ccb0, [ax, sy + 1.25, az]);
    city.cyl(1.0, 1.5, 6, 8, 0x8a6a30, [ax, sy + 5.5, az]);
    city.cyl(0.6, 0.9, 2.5, 8, 0x8a6a30, [ax, sy + 9.6, az]);
    city.ball(0.55, 1, 0x8a6a30, [ax, sy + 11.3, az]);
    city.cyl(0.4, 0.7, 0.9, 6, 0x9a7a3a, [ax, sy + 11.9, az]);   // helmet crest
    city.cyl(0.08, 0.08, 14, 5, 0x6a5020, [ax + 1.5, sy + 9, az], [0, 0, 0.08]);
    city.cyl(1.5, 1.5, 0.2, 12, 0x9a7a3a, [ax - 1.3, sy + 6.5, az + 0.3], [0, 0, Math.PI / 2 - 0.2]);
    torches.push(new THREE.Vector3(ax + 2.1, sy + 16.2, az));   // the gleaming spear tip, seen by sailors at sea
    // fires on the Acropolis
    for (const [u, v] of [[-50, 10], [-50, -10], [50, 12], [52, -12], [14, 20], [-14, 22]]) { const [x, z] = L2W(u, v); torches.push(new THREE.Vector3(x, AY + RH + 3, z)); }
  }

  // ---------------- The Agora ----------------
  // the long two-aisled stoa along its north side, facing the open square
  {
    const sx = -6, sz = -56, y = H(sx, sz);
    const sk = new Kit();
    sk.box(60, 7, 12.9, 0xd8ccb0, [0, -3.52, -4.55]);                    // terrace it stands on (just under and behind the stoa's floor, so they never flicker)
    for (let i = 0; i < 3; i++) sk.box(60 - i * 0.6, 0.3, 1, 0xe0d4ba, [0, -0.15 - i * 0.3, 2.3 + i * 0.6]);
    colonnade(sk, 0, 1.5, 0, 22, 2.6, 6.4, 0.45, 0xece4d0, TILE, 9.5, 0, true);
    for (let i = 0; i < 10; i++) column(sk, -24 + i * 5.3, 0, -3, 6.0, 0.4);  // the inner row
    sk.box(56, 0.4, 0.5, PAINT, [0, 6.5, 1.6]);
    const g = sk.geometry(); g.translate(sx, y + 0.2, sz); marble.push(g);
    blockers.push(...Array.from({ length: 12 }, (_, i) => ({ x: sx - 27 + i * 5, z: sz - 3, r: 4 })));
  }
  // the Tholos: a round council house with a conical tiled roof
  {
    const x = 24, z = -44, y = H(x, z);
    const tk = new Kit();
    tk.cyl(9.6, 10, 4, 24, 0xd8ccb0, [0, -1.4, 0]);
    tk.cyl(8.4, 8.4, 5.4, 24, 0xe4dac4, [0, 3, 0]);
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; column(tk, Math.cos(a) * 9.1, 0.6, Math.sin(a) * 9.1, 5.2, 0.32); }
    tk.cyl(9.8, 9.8, 0.6, 24, 0xe8e0cc, [0, 6.1, 0]);
    tk.add(new THREE.ConeGeometry(10.4, 4.2, 24, 1, true), TILE, [0, 8.5, 0]);
    tk.box(1.4, 3, 0.4, 0x3a2a1a, [-8.45, 2.1, 0], [0, Math.PI / 2, 0]);
    const g = tk.geometry(); g.translate(x, y, z); marble.push(g);
    blockers.push({ x, z, r: 10.5 });
  }
  // a second temple on the rise beyond the stoa (the Temple of Ares)
  {
    const T = temple({ L: 34, W: 15, nL: 13, nW: 6, colH: 6, colD: 1.05, seg: 12, figures: true });
    const x = -4, z = -104; T.geo.translate(x, H(x, z) - 0.4, z); marble.push(T.geo);
    city.box(40, 3, 21, 0x9a8e74, [x, H(x, z) - 1.9, z]);
    torches.push(new THREE.Vector3(x + 21, H(x, z) + 1.6, z - 5), new THREE.Vector3(x + 21, H(x, z) + 1.6, z + 5));
  }

  // ---------------- The houses ----------------
  // Blocks of houses along a street grid, packed between the walls, the Agora and the Acropolis.
  const grid = new Map(), cell = 11, GY = 0.22;
  const cg = Math.cos(GY), sg = Math.sin(GY);
  let placed = 0;
  city.P = PROPS.fresh();
  for (let tries = 0; tries < 9000 && placed < 520; tries++) {
    // stand on a street grid, turned a little, with streets every 3 blocks
    const gi = Math.floor((r() - 0.5) * 44), gj = Math.floor((r() - 0.5) * 70) - 14;
    if (gi % 4 === 0 || gj % 5 === 0) continue;
    const u = gi * cell + (r() - 0.5) * 1.5, v = gj * cell + (r() - 0.5) * 1.5;
    const x = cg * u + sg * v, z = -sg * u + cg * v;
    const key = gi + ',' + gj; if (grid.has(key)) continue;
    if (!inside(poly, x, z)) continue;
    if (Math.hypot(x, z) < 44 || avoid(x, z)) continue;
    if (x > -40 && x < 50 && z > -78 && z < -28) continue;   // the Agora square
    if (Math.abs(x + 4) < 26 && Math.abs(z + 104) < 16) continue;    // the temple on the rise
    { const du = (x - AC.x) * co - (z - AC.z) * si, dv = (x - AC.x) * si + (z - AC.z) * co; if ((du / 102) ** 2 + (dv / 66) ** 2 < 1) continue; }
    let near = false; for (let e = 0; e < poly.length - 1; e++) if (segDist(x, z, poly[e], poly[e + 1]) < 9) { near = true; break; }
    if (near) continue;
    grid.set(key, 1); placed++;
    const w = 6 + r() * 4.5, d = 6 + r() * 3, h = 3 + (r() < 0.35 ? 2.8 : 0) + r() * 0.6, y = H(x, z) - 0.3;
    house(city, x, y, z, w, d, h, -GY + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.06, r);
    if (r() < 0.22) windows.push(new THREE.Vector3(x + (r() - 0.5) * 4, y + 1.6 + r() * 2, z + (r() - 0.5) * 4));
  }

  // ---------------- Lights ----------------
  // Torches on the towers and fires on the Acropolis (big), lamplit windows and doorways (small):
  // all one cloud of glowing points each, so they cost almost nothing.
  const glowTex = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,215,150,1)'); gr.addColorStop(0.25, 'rgba(255,160,70,0.6)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  const cloud = (pts, size) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, size, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  };

  // Materials: a touch of their own light so the city doesn't sink into the dark
  const stoneMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x1e1a14 });
  const marbleMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x2a241a });
  const group = new THREE.Group();
  const cityG = city.geometry(), wallG = walls.geometry();
  group.add(new THREE.Mesh(mergeG([cityG, wallG]), stoneMat));
  group.add(new THREE.Mesh(mergeG(marble), marbleMat));
  group.add(city.P.build({ glow: 0x2a2620 }));
  const torchPts = cloud(torches, 7), winPts = cloud(windows, 2.6);
  group.add(torchPts, winPts);
  return { group, torches: torchPts, windows: winPts, blockers, acropolis: new THREE.Vector3(AC.x, AY + RH + 12, AC.z), gate: new THREE.Vector3(gp[0], H(...gp), gp[1]) };
}

const PAINT = 0x2c4c86;
// the plain Greek column, same as the stoa's
function column(k, x, y, z, h, rad) {
  k.cyl(rad * 0.86, rad, h - 0.25, 10, 0xece4d0, [x, y + (h - 0.25) / 2, z]);
  k.cyl(rad * 1.25, rad * 0.86, 0.12, 10, 0xece4d0, [x, y + h - 0.19, z]);
  k.box(rad * 2.6, 0.13, rad * 2.6, 0xece4d0, [x, y + h - 0.065, z]);
}
// merge geometries that all carry position, normal and colour
function mergeG(list) {
  const k = new Kit();
  for (const g of list) { const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.normal) n.computeVertexNormals(); k.parts.push(n); }
  return k.geometry();
}
