// Era 2, Chapter 4 extras (n 11): Galileo. The big moments (the telescope view, the Moon's mountains,
// the Milky Way breaking into stars, Jupiter's moons whirling across the sky, Venus, the spacecraft)
// live in the chapter itself; here:
//  - Kepler's letter (ch11_09, "it made him famous"): no ghost of Kepler (Meem's rule: no glowing
//    people), just his reply arriving: a folded letter with a red seal drifts in to the corner of the
//    roof terrace, glowing softly, labelled "From Kepler, in Prague: I believe you!". He wrote back
//    to Galileo at once, and soon built a better telescope of his own.
//  - Living constellation (ch11_10): the Bull walks across the sky with Jupiter among its horns, as
//    it was in January 1610 (or the Hunter, if the Bull is too low).
import * as THREE from 'three';
import { Kit } from '../kit.js';
import { label, glow } from '../era2/common.js';
import { damp } from '../util.js';
import { shimmer, Timeline } from './fx.js';

const TOPB = 11;
const _v = new THREE.Vector3();

export default class Ch11Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    // the letter: folded paper, a red wax seal, a ribbon
    const k = new Kit(); k.box(0.22, 0.15, 0.012, 0xf2e6c8, [0, 0, 0]); k.box(0.22, 0.004, 0.014, 0xc8b898, [0, 0.02, 0]);
    k.cyl(0.022, 0.022, 0.01, 10, 0xa01818, [0, -0.005, 0.009], [Math.PI / 2, 0, 0]); k.box(0.012, 0.15, 0.016, 0x7a2020, [0.05, 0, 0]);
    this.letter = new THREE.Group(); this.letter.add(k.mesh(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, fog: false })));
    this.letterGlow = glow(0xbfd8ff, 0.7, 0); this.letter.add(this.letterGlow);
    this.letterLab = label('From Kepler, in Prague: "I believe you!"', 0.09); this.letterLab.position.y = 0.2; this.letter.scale.setScalar(1.4); this.letter.add(this.letterLab);
    this.letter.position.set(1.55, TOPB + 1.35, 1.45); this.letter.visible = false; chapter.B.add(this.letter); this.lk = 0;
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
    if (on && !this.lOn) shimmer(this.G, 3, 0.12);
    this.lOn = on;
    const k = this.lk = damp(this.lk, on ? 1 : 0, 1.5, dt), L = this.letter;
    L.visible = k > 0.01;
    if (L.visible) {
      // it drifts in from the north-east sky and settles, turning gently, facing you
      L.position.set(1.55 + (1 - k) * 3, TOPB + 1.35 + (1 - k) * 2 + Math.sin(t * 1.3) * 0.03, 1.45 - (1 - k) * 3);
      this.G.camera.getWorldPosition(_v); L.lookAt(_v.x, L.position.y, _v.z); L.rotation.z = Math.sin(t * 0.9) * 0.08;
      L.children[0].material.opacity = k; this.letterGlow.material.opacity = 0.6 * k; this.letterLab.material.opacity = k;
    }
  }
  dispose() { this.G.skyFigures?.stopAll?.(); }
}
