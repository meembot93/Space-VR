// A tiny modelling kit: build a low-poly model out of simple shapes, each with its own
// colour, then merge them into ONE mesh with ONE shared material. That keeps the draw
// count low for Quest while still allowing lots of small coloured details.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Faceted, flat-shaded look (like the reference art). Colours come from the vertices.
export const FLAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
// Smooth-shaded version (used for the detailed close-up pirates).
export const SMOOTH = new THREE.MeshLambertMaterial({ vertexColors: true });

// Detail level for shapes built from now on: 1 = the original low-poly look, 2 = twice the
// segments around every rounded shape and one more subdivision on balls. people.js sets it
// while building each level of detail.
export const QUALITY = { q: 1 };
export const segs = (n) => (n <= 4 ? n : Math.round(n * QUALITY.q));   // 3- and 4-sided shapes keep their shape

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Kit {
  constructor() { this.parts = []; }

  // geo: a three.js geometry (it is consumed). color: hex. Optional placement:
  // p = [x,y,z], r = [rx,ry,rz] (radians, XYZ order), s = number or [sx,sy,sz].
  add(geo, color, p, r, s, shade = 1) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    _p.set(...(p || [0, 0, 0]));
    _q.setFromEuler(_e.set(...(r || [0, 0, 0])));
    if (Array.isArray(s)) _s.set(...s); else _s.setScalar(s ?? 1);
    g.applyMatrix4(_m.compose(_p, _q, _s));
    _c.setHex(color).multiplyScalar(shade);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(g);
    return g;
  }

  // Shortcuts for the shapes used most.
  box(w, h, d, color, p, r, s) { return this.add(new THREE.BoxGeometry(w, h, d), color, p, r, s); }
  cyl(rt, rb, h, seg, color, p, r, s) { return this.add(new THREE.CylinderGeometry(rt, rb, h, segs(seg)), color, p, r, s); }
  ball(rad, detail, color, p, r, s) { return this.add(new THREE.IcosahedronGeometry(rad, Math.min(2, detail + (QUALITY.q > 1 ? 1 : 0))), color, p, r, s); }

  // A bent "tube" through a list of points (for guards, straps). Square-ish cross section.
  tube(pts, rad, color, sides = 4) {
    const curve = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)), false, 'catmullrom', 0.2);
    return this.add(new THREE.TubeGeometry(curve, segs(Math.max(4, pts.length * 2)), rad, segs(sides), false), color);
  }

  geometry() {
    const g = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    g.computeBoundingSphere();
    return g;
  }

  mesh(mat = FLAT) { return new THREE.Mesh(this.geometry(), mat); }
}

// Nudge a shade a little, for variety between pirates (amount ~0.1).
export function vary(hex, amt, rnd = Math.random) {
  _c.setHex(hex);
  const k = 1 + (rnd() * 2 - 1) * amt;
  return _c.setRGB(Math.min(1, _c.r * k), Math.min(1, _c.g * k), Math.min(1, _c.b * k)).getHex();
}

// ---------- Shared weapon shapes (used by the pirates and by the player's own weapons) ----------
export const COL = {
  steel: 0xc9cfd8, steelDark: 0x8e95a0, brass: 0xc29a3a, brassDark: 0x8a6a24,
  grip: 0x5a3220, wood: 0x8a4f26, woodDark: 0x6a3a1a, iron: 0x3a3d44, ironDark: 0x2a2c31,
};

