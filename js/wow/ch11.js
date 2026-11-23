// Era 2, Chapter 4 extras (n 11): Galileo. The big moments (the telescope view, the Moon's mountains,
// the Milky Way breaking into stars, Jupiter's moons whirling across the sky, Venus, the spacecraft)
// live in the chapter itself; here:
//  - Cameo (ch11_09, "it made him famous"): an echo of Kepler (the last chapter) appears at the
//    corner of the roof terrace reading The Starry Messenger, and raises it in delight: he wrote
//    back to Galileo at once, and soon built a better telescope of his own.
//  - Living constellation (ch11_10): the Bull walks across the sky with Jupiter among its horns, as
//    it was in January 1610 (or the Hunter, if the Bull is too low).
import * as THREE from 'three';
import { Kit } from '../kit.js';
import { holdProp } from '../people.js';
import { Echo } from './echo.js';
import { shimmer, Timeline } from './fx.js';

const TOPB = 11;

export default class Ch11Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.kep = new Echo(G, chapter.B, { model: 'kepler', tint: 0xa8d0ff, pos: new THREE.Vector3(1.55, TOPB, 1.45), face: -2.4, seed: 7 });
    const k = new Kit(); k.box(0.16, 0.03, 0.22, 0x8a6a3a, [0, 0, 0]); k.box(0.15, 0.025, 0.21, 0xf0e4c8, [0.006, 0, 0]);
    holdProp(this.kep.P, k.mesh(), 'Right', [0, 0.06, 0.06]);
  }
  line(id) {
    const G = this.G, F = G.skyFigures;
    if (id === 'ch11_10') { const n = ['bull', 'hunter'].find((f) => F?.height(f) > 12); if (n) this.tl.after(G.params.has('fast') ? 0.3 : 4, () => F.play(n, { secs: 16 })); }
  }
  lineEnd(id) { if (id === 'ch11_10') this.G.skyFigures?.stopAll?.(); }
  update(dt, t) {
    const s = this.ch.s;
    this.tl.update(dt);
    const on = s.book === 2 && !s.gloom && s.scene === 'padua';
    if (on && !this.kep.on) shimmer(this.G, 3, 0.12);
    this.kep.show(on);
    this.kep.P.pose = this.kep.k > 0.9 ? 'cheer' : 'hold';
    this.kep.update(dt, t);
  }
  dispose() { this.G.skyFigures?.stopAll?.(); }
}
