// Era 2, Chapter 6 extras (n 13): the rocket dreamers. The big moments (Goddard's launch, the
// rockets that came after rising over the field, the V-2 through the clouds, the edge of space)
// live in the chapter itself; here:
//  - Living constellation (ch13_04, "we cannot stay in the cradle forever"): as Tsiolkovsky's chalk
//    rocket flies out of the window, the Great Bear (or whichever figure is up) wakes over Kaluga.
//  - Cameo (ch13_06 to ch13_07): an echo of Tsiolkovsky stands at the edge of Goddard's field and
//    watches the rocket he only ever drew fly for real. (They never met.)
//  - Cameo (ch13_08, "They were wrong"): an echo of Newton (the last chapter) beside the bubble of
//    empty space: every push has an equal push back, so a rocket needs nothing to push against.
import * as THREE from 'three';
import { Echo } from './echo.js';
import { shimmer, Timeline } from './fx.js';

const _a = new THREE.Vector3();

export default class Ch13Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.tsi = new Echo(G, chapter.B, { model: 'tsiolkovsky', tint: 0xa8d0ff, pos: new THREE.Vector3(-2.7, 0, 0.9), face: 2.4, seed: 5, look: { beard: true, hair: 0x8a8a8a } });
    this.newton = new Echo(G, chapter.B, { model: 'newton', tint: 0xffd8a0, pos: new THREE.Vector3(-0.9, 0, -0.7), face: 0.8, seed: 7, look: { hair: 0xd8d0c0 } });
  }
  line(id) {
    const G = this.G, F = G.skyFigures, fast = G.params.has('fast');
    if (id === 'ch13_04') {
      const n = ['bear', 'swan', 'bull', 'hunter'].find((f) => F?.height(f) > 8);
      if (n) this.tl.after(fast ? 0.3 : 7, () => F.play(n, { secs: 16 }));
    }
    if (id === 'ch13_05') F?.stopAll?.();
    if (id === 'ch13_06') { this.tsi.show(true); shimmer(G, 3, 0.12); }
    if (id === 'ch13_08') { this.tsi.show(false); this.tl.after(fast ? 0.3 : 6.5, () => { this.newton.show(true); shimmer(G, 3, 0.14); }); }
  }
  lineEnd(id) { if (id === 'ch13_08') this.tl.after(this.G.params.has('fast') ? 0.2 : 2, () => this.newton.show(false)); }
  update(dt, t) {
    this.tl.update(dt);
    // Tsiolkovsky follows his rocket with his eyes; Newton points at the little rocket in the bubble
    const rk = this.ch.rk?.getWorldPosition(_a);
    if (rk) { this.tsi.P.look = rk.clone().setY(rk.y + 1.5); this.tsi.P.pose = this.ch.fT > 2.2 && !this.ch.landed ? 'point' : 'idle'; this.tsi.P.pointAt.copy(this.tsi.P.look); }
    if (this.ch.vac) { this.ch.vac.getWorldPosition(_a); this.newton.P.pose = 'point'; this.newton.P.pointAt.copy(_a); this.newton.P.look = _a.clone(); }
    this.tsi.update(dt, t); this.newton.update(dt, t);
  }
  dispose() { this.G.skyFigures?.stopAll?.(); }
}
