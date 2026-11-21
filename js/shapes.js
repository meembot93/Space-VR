// Shapes and helpers shared by the chapters: a repeatable random number generator, smooth
// noise for landscapes, and rough natural stones.
import * as THREE from 'three';
import { lerp } from './util.js';

// A tiny repeatable random number generator, so every headset builds the same landscape
export function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// Smooth value noise for the rolling chalk downland
export function noise2(seed) {
  const r = rng(seed), P = new Float32Array(256); for (let i = 0; i < 256; i++) P[i] = r();
  const h = (x, z) => P[((x * 73856093) ^ (z * 19349663)) & 255];
  return (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v);
  };
}
// A rough, chunky stone: a finely subdivided box rounded off, dented with noise, and scored with
// the shallow vertical grooves real sarsens have (flat-shaded, so every facet catches the light)
const STONE_DETAIL = 2.6;        // how many more facets than the simplest version
export function roughStone(w, h, d, seed, segs = [3, 6, 2]) {
  const sg = segs.map((n) => Math.max(2, Math.round(n * STONE_DETAIL)));
  const g = new THREE.BoxGeometry(w, h, d, ...sg);
  const p = g.attributes.position, r = rng(seed), n = noise2(seed), n2 = noise2(seed + 17);
  const off = r() * 100, flute = 3 + r() * 3, fph = r() * 6;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // round the edges: pull corners in
    const nx = x / (w / 2), ny = y / (h / 2), nz = z / (d / 2);
    const k = 1 - 0.18 * (Math.abs(nx * nz)) - 0.08 * Math.abs(nx * ny * nz) - 0.05 * Math.abs(ny) ** 6;
    x *= k; z *= k;
    // taper toward the top a little, and dent: big lumps, small pits, and vertical weathering grooves
    const top = (ny + 1) / 2;
    x *= 1 - top * 0.12; z *= 1 - top * 0.08;
    const dn = (n(x * 1.3 + off, y * 1.3 + z) - 0.5) * 0.22 + (n2(x * 4.1 + z * 3.3, y * 3.7) - 0.5) * 0.07
      + Math.sin((x + z) * flute + fph + n(y * 0.4, x) * 2) * 0.018;
    x += Math.sign(x) * dn; z += Math.sign(z) * dn * 0.8;
    if (ny > 0.99) y += (n(x * 2 + off, z * 2) - 0.5) * 0.25 + (n2(x * 5, z * 5) - 0.5) * 0.05;
    p.setXYZ(i, x, y + h / 2, z);
  }
  g.computeVertexNormals();
  return g;
}

