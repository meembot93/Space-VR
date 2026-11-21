// Chapter 4 extras: Babylon.
//  - Wow (ch4_09, "like all the sunsets in the world shining on the Moon at once"): rivers of sunset
//    light pour in from a great ring around you, the edge of the Earth's shadow, and stream across the
//    sky into the copper Moon. While the Moon is dark, the Milky Way blazes out.
//  - Living constellations (ch4_10, "the twelve signs of the zodiac"): the zodiac draws itself right
//    around the sky, sign by sign, and the Scorpion, the Babylonians' own sign, wakes and strikes.
import * as THREE from 'three';
import { glowPoints, skyLevel, shimmer, awe, whoosh, Timeline, clamp01, ease } from './fx.js';

const N = 420;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();

export default class Ch4Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.rays = glowPoints(N, { sizeScale: 240 }); this.rays.visible = false; G.scene.add(this.rays);
    this.p = Array.from({ length: N }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random() * 3, sp: 0.16 + Math.random() * 0.12, h: Math.random() }));
    this.k = 0; this.dark = 0;
  }

  line(id) {
    const G = this.G, F = G.skyFigures;
    if (id === 'ch4_09') this.tl.after(4.5, () => { this.on = true; whoosh(G, 5, 0.3); awe(G, 14, 0.09, 87); shimmer(G, 4, 0.12); });
    if (id === 'ch4_10') {
      this.tl.after(1, () => { this.on = false; });
      this.tl.after(9, () => { F.play('zodiac', { secs: 30, drawSecs: 9 }); shimmer(G, 8, 0.12); });
      if (F.height('scorpion') > 8) this.tl.after(14, () => F.play('scorpion', { secs: 24 }));
    }
  }

  // Let the zodiac finish going round before the journal page comes out
  async after(id, D) { if (id === 'ch4_10') await D.wait(this.G.params.has('fast') ? 0.5 : 9); }

  update(dt, t) {
    const G = this.G, s = this.ch.s || {}; this.tl.update(dt);
    // the darker the Moon, the brighter the stars and the Milky Way
    const total = ['total', 'closing'].includes(s.phase) ? 1 : s.phase === 'eclipse' ? (s.ecl ?? 0) : 0;
    this.dark = clamp01(this.dark + (total - this.dark) * Math.min(1, dt * 0.5));
    G.sky.uni.milky.value = 1 + 0.9 * ease(this.dark);
    // sunset light streaming into the Moon
    this.k = clamp01(this.k + dt * (this.on ? 0.35 : -0.25));
    this.rays.visible = this.k > 0.01;
    if (!this.rays.visible || !this.ch.moon) return;
    const cam = G.camera.getWorldPosition(_a), moon = this.ch.moon.getWorldPosition(_b);
    const md = _c.subVectors(moon, cam).normalize(), side = _d.set(0, 1, 0).cross(md).normalize(), up = new THREE.Vector3().crossVectors(md, side);
    const P = this.rays.userData, R = 70, M = 260;
    this.p.forEach((q, i) => {
      q.d += dt * q.sp; if (q.d > 1) { q.d = 0; q.a = Math.random() * Math.PI * 2; }
      // from a wide ring around you (a little behind), along a gentle curve, into the Moon's edge
      const u = ease(q.d), r = R * (1 - u) + 3.2 * u, ca = Math.cos(q.a), sa = Math.sin(q.a);
      const along = -12 + (M + 12) * u * u;
      const x = cam.x + md.x * along + (side.x * ca + up.x * sa) * r, y = cam.y + md.y * along + (side.y * ca + up.y * sa) * r, z = cam.z + md.z * along + (side.z * ca + up.z * sa) * r;
      P.pos.set([x, y, z], i * 3);
      // sunset colours: gold at the ring, deepening to copper-red as it reaches the Moon
      const f = Math.sin(q.d * Math.PI) * this.k;
      P.col.set([f, (0.62 - 0.4 * u) * f, (0.3 - 0.2 * u) * f], i * 3);
      P.size[i] = 0.35 + 3.2 * u * u;
    });
    P.commit();
  }

  dispose() {
    this.G.scene.remove(this.rays); this.rays.geometry.dispose();
    this.G.sky.uni.milky.value = 1; this.G.skyFigures.stopAll();
  }
}
