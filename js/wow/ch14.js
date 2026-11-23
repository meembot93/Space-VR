// Era 2, Chapter 7 extras (n 14): Sputnik. The big moments (the launch, everyone from both eras
// watching it at the viewing spot, the Korolev cross, the ride to orbit, the radio room, the ring of
// echoes, the rising Moon) live in the chapter itself; here:
//  - Living constellation (ch14_01, the night at the pad): the Swan flies down the Milky Way, or the
//    Great Bear walks if the Swan has set; on the hill (ch14_11) the Hunter or the Bull rises in the east.
import { Timeline } from './fx.js';

export default class Ch14Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
  }
  line(id) {
    const G = this.G, F = G.skyFigures, fast = G.params.has('fast');
    const pick = (list) => list.find((n) => F?.height(n) > 10);
    if (id === 'ch14_01') { const n = pick(['swan', 'bear', 'bull']); if (n) this.tl.after(fast ? 0.3 : 4, () => F.play(n, { secs: 16 })); }
    if (id === 'ch14_02') F?.stopAll?.();
    if (id === 'ch14_11') { const n = pick(['hunter', 'bull', 'swan', 'bear']); if (n) this.tl.after(fast ? 0.3 : 2, () => F.play(n, { secs: 18 })); }
    if (id === 'ch14_12') F?.stopAll?.();
  }
  update(dt) { this.tl.update(dt); }
  dispose() { this.G.skyFigures?.stopAll?.(); }
}
