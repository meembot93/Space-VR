// Era 2, Chapter 2 extras (n 9): Tycho. The big moments (the new star, the explosion, the comet
// through the crystal sphere) live in the chapter itself; here:
//  - Living constellation (ch9_06, arriving on Hven): the Swan flies down the Milky Way overhead.
import * as THREE from 'three';
import { shimmer, Timeline } from './fx.js';

export default class Ch9Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
  }
  line(id) {
    const G = this.G, F = G.skyFigures;
    if (id === 'ch9_06') { const n = F?.height('swan') > 8 ? 'swan' : F?.height('bear') > 8 ? 'bear' : null; if (n) this.tl.after(G.params.has('fast') ? 0.3 : 3, () => F.play(n, { secs: 14 })); }
    if (id === 'ch9_07') F?.stopAll?.();
  }
  update(dt, t) { this.tl.update(dt); }
  dispose() { this.G.skyFigures?.stopAll?.(); }
}
