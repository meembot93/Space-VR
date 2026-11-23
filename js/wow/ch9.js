// Era 2, Chapter 2 extras (n 9): Tycho. The big moments (the new star, the explosion, the comet
// through the crystal sphere, the Kepler echo) live in the chapter itself; here:
//  - Living constellation (ch9_06, arriving on Hven): the Swan flies down the Milky Way overhead.
//  - Cameo (ch9_01): an echo of Copernicus (the last chapter) watches from the lane for a moment,
//    as if handing the sky on.
import * as THREE from 'three';
import { Echo } from './echo.js';
import { shimmer, Timeline } from './fx.js';

export default class Ch9Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.cop = new Echo(G, chapter.A, { model: 'copernicus', tint: 0xffd8a0, pos: new THREE.Vector3(-4, 0, -3), face: -0.6, seed: 4 });
  }
  line(id) {
    const G = this.G, F = G.skyFigures;
    if (id === 'ch9_01') this.tl.after(G.params.has('fast') ? 0.2 : 2, () => { this.cop.show(true); shimmer(G, 3, 0.12); });
    if (id === 'ch9_02') this.cop.show(false);
    if (id === 'ch9_06') { const n = F?.height('swan') > 8 ? 'swan' : F?.height('bear') > 8 ? 'bear' : null; if (n) this.tl.after(G.params.has('fast') ? 0.3 : 3, () => F.play(n, { secs: 14 })); }
    if (id === 'ch9_07') F?.stopAll?.();
  }
  update(dt, t) { this.tl.update(dt); this.cop.update(dt, t); }
  dispose() { this.G.skyFigures?.stopAll?.(); }
}
