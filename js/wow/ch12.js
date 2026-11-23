// Chapter 12 extras: the summer constellations over the farm while the Principia glows, and a
// shimmer as Kepler's ellipse appears over the orchard (no ghost figures: the ellipse and its
// label carry Kepler's part).
import { shimmer, Timeline } from './fx.js';

export default class Ch12Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.ellOn = false;
  }
  line(id) {
    const G = this.G, F = G.skyFigures, fast = G.params.has('fast');
    if (id === 'ch12_09') {
      const n = F?.height('swan') > 15 ? 'swan' : F?.height('bear') > 10 ? 'bear' : null;
      if (n) this.tl.after(fast ? 0.3 : 4, () => F.play(n, { secs: 22 }));
    }
    if (id === 'ch12_10') this.tl.after(fast ? 0.5 : 8, () => F?.stopAll?.());
  }
  update(dt) {
    const s = this.ch.s; this.tl.update(dt);
    const on = !!s.ell && s.phase === 'principia';
    if (on && !this.ellOn) shimmer(this.G, 3, 0.12);
    this.ellOn = on;
  }
  dispose() { this.G.skyFigures?.stopAll?.(); }
}
