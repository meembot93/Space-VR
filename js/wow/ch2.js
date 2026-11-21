// Chapter 2 extras: Stonehenge.
//  - Wow, part 1: when the first light of the longest day shines into the circle (ch2_08), golden
//    motes swirl in the sunbeam.
//  - Wow, part 2: during the year in a few seconds (ch2_09), the Sun paints its path across the sky
//    every couple of weeks: a fan of glowing golden arcs that swings low to winter and back up to
//    summer, each one starting from its sunrise point on the horizon. The last one, midsummer's,
//    rises right back through the gap.
import * as THREE from 'three';
import { glowPoints, awe, shimmer, D2R, clamp01, ease } from './fx.js';

const LAT = 51.18, EPS = 23.95, ARCS = 27, PTS = 40, AXIS = 50;
const _a = new THREE.Vector3();

// The Sun's path across the sky on one day: [az, el, az, el, ...] from sunrise to sunset
function sunPath(sunLon) {
  const dec = Math.asin(Math.sin(EPS * D2R) * Math.sin(sunLon * D2R)), phi = LAT * D2R;
  const H0 = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(dec))));
  const pts = [];
  for (let i = 0; i < PTS; i++) {
    const H = -H0 + (2 * H0 * i) / (PTS - 1);
    const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / D2R + 180;
    pts.push(az, Math.max(-0.5, el / D2R));
  }
  return pts;
}

export default class Ch2Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter;
    this.arcs = Array.from({ length: ARCS }, (_, k) => sunPath(90 + (360 * k) / (ARCS - 1)));
    // line the paths up with the circle's own midsummer sunrise
    const shift = AXIS - this.arcs[0][0];
    for (const a of this.arcs) for (let i = 0; i < a.length; i += 2) a[i] += shift;
    const self = this;
    G.skyFigures.define('sunpaths', {
      frame: 'horizon', day: true, color: [1, 0.62, 0.2],
      gen() {
        const L = self.lapse;
        return self.arcs.map((pts, k) => {
          const f = k / (ARCS - 1), shown = clamp01((L - f) * ARCS * 0.8 + 0.5);
          // the newest path is bright, older ones settle into a soft fan; midsummer stays bright
          const age = clamp01((L - f) * 3), summer = k === 0 || k === ARCS - 1;
          return { pts, w: summer ? 1.5 : 0.9, taper: false, part: 'a' + k, a: shown * (summer ? 1 : 1 - age * 0.55) };
        });
      },
    });
    this.lapse = 0;
    // Golden motes drifting in the sunbeam
    this.motes = glowPoints(90, { sizeScale: 220 }); this.motes.visible = false; G.scene.add(this.motes);
    this.m = Array.from({ length: 90 }, () => ({ along: Math.random(), side: (Math.random() - 0.5) * 1.4, up: 0.4 + Math.random() * 2.4, sp: 0.01 + Math.random() * 0.02, ph: Math.random() * 6 }));
    this.moteK = 0;
  }

  line(id) {
    const G = this.G;
    if (id === 'ch2_08') { this.motesOn = true; awe(G, 12, 0.08, 110); shimmer(G, 3, 0.15); }
    if (id === 'ch2_09') { G.skyFigures.play('sunpaths', { secs: 60, drawSecs: 0.01 }); this.paths = true; }
    if (id === 'ch2_10') this.fadeAt = G.t + 7;
  }

  // Let the full fan of paths hang in the sky a moment before Astra goes on
  async after(id, D) {
    if (id === 'ch2_09') { await D.until(() => (this.ch.s?.lapse ?? 1) >= 1, 30); await D.wait(G_fast(this.G) ? 0.3 : 3); }
  }

  update(dt, t) {
    const G = this.G, s = this.ch.s || {};
    this.lapse = s.phase === 'lapse' ? s.lapse : this.paths ? 1 : 0;
    if (this.fadeAt && G.t > this.fadeAt) { this.fadeAt = 0; G.skyFigures.stop('sunpaths'); this.motesOn = false; }
    // motes: in the shaft from the gap to the middle of the circle
    this.moteK = clamp01(this.moteK + dt * (this.motesOn ? 0.4 : -0.3));
    this.motes.visible = this.moteK > 0.01;
    if (!this.motes.visible) return;
    const P = this.motes.userData, dir = _a.set(Math.sin(AXIS * D2R), 0, -Math.cos(AXIS * D2R));
    const beam = clamp01(this.ch.beamV ?? 1);
    this.m.forEach((q, i) => {
      q.along = (q.along - dt * q.sp + 1) % 1;
      const r = 1 + q.along * 22, sx = -dir.z, sz = dir.x, wob = Math.sin(t * 0.7 + q.ph) * 0.25;
      P.pos.set([dir.x * r + sx * (q.side + wob), q.up + Math.sin(t * 0.5 + q.ph) * 0.2, dir.z * r + sz * (q.side + wob)], i * 3);
      const tw = 0.6 + 0.4 * Math.sin(t * 3 + q.ph * 3), k = this.moteK * beam * ease(Math.min(q.along * 5, 1)) * tw;
      P.col.set([k, 0.82 * k, 0.5 * k], i * 3);
      P.size[i] = 0.03;
    });
    P.commit();
  }

  dispose() { this.G.scene.remove(this.motes); this.motes.geometry.dispose(); }
}
const G_fast = (G) => G.params.has('fast');
