// Era 2, Chapter 6 extras (n 13): the rocket dreamers. The big moments (Goddard's launch, the
// rockets that came after rising over the field, the V-2 through the clouds, the edge of space)
// live in the chapter itself; here:
//  - Living constellation (ch13_04, "we cannot stay in the cradle forever"): as Tsiolkovsky's chalk
//    rocket flies out of the window, the Great Bear (or whichever figure is up) wakes over Kaluga.
// (No ghostly cameos: Meem's rule. Newton's push-back is in the bubble of empty space itself.)
import { Timeline } from './fx.js';

export default class Ch13Extras {
  constructor(G, chapter) { this.G = G; this.ch = chapter; this.tl = new Timeline(); }
  line(id) {
    const G = this.G, F = G.skyFigures, fast = G.params.has('fast');
    if (id === 'ch13_04') {
      const n = ['bear', 'swan', 'bull', 'hunter'].find((f) => F?.height(f) > 8);
      if (n) this.tl.after(fast ? 0.3 : 7, () => F.play(n, { secs: 16 }));
    }
    if (id === 'ch13_05') F?.stopAll?.();
  }
  lineEnd() {}
  update(dt) { this.tl.update(dt); }
  dispose() { this.G.skyFigures?.stopAll?.(); }
}
