// Era 2, Chapter 3 extras (n 10): Kepler. The big moments (the circle shattering, the ellipse,
// Kepler's Dream with the Moon swelling, the Galileo echo) live in the chapter itself; here:
//  - Living constellation (ch10_08, the tables matching the sky): the Lion or the Bull walks
//    whichever is up (Mars was often among them in Tycho's records).
import { Timeline } from './fx.js';

export default class Ch10Extras {
  constructor(G, chapter) { this.G = G; this.ch = chapter; this.tl = new Timeline(); }
  line(id) {
    const G = this.G, F = G.skyFigures;
    if (id === 'ch10_08') { const n = ['lion', 'bull', 'hunter', 'bear'].find((f) => F?.height(f) > 10); if (n) this.tl.after(G.params.has('fast') ? 0.3 : 2, () => F.play(n, { secs: 12 })); }
    if (id === 'ch10_09') F?.stopAll?.();
  }
  update(dt) { this.tl.update(dt); }
  dispose() { this.G.skyFigures?.stopAll?.(); }
}
