// Era 2, Chapter 5 extras (n 12): Newton. The big moments (the slow-motion apple, the cannon on the
// little Earth firing faster and faster until the ball falls all the way round, the Moon falling too,
// the satellite) live in the chapter itself; here:
//  - Cameo (ch12_09, "His math even explained Kepler's ellipses"): an echo of Kepler (two chapters
//    back) appears beside Newton under the ellipse, delighted, cheering, then points up at it.
//  - Living constellation (ch12_09/10, the summer night): the Swan flies down the Milky Way overhead
//    (or the Great Bear walks, if the Swan is low).
import * as THREE from 'three';
import { Echo } from './echo.js';
import { shimmer, Timeline } from './fx.js';
import { KEPSPOT } from '../chapters/newton.js';

export default class Ch12Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.kep = new Echo(G, chapter.root, { model: 'kepler', tint: 0xa8c8ff, pos: new THREE.Vector3(KEPSPOT.x, G.world.height(KEPSPOT.x, KEPSPOT.z), KEPSPOT.z), face: Math.atan2(-KEPSPOT.x, -KEPSPOT.z) - 0.5, seed: 7 });
    this.kepT = -1;
  }
  line(id) {
    const G = this.G, F = G.skyFigures, fast = G.params.has('fast');
    if (id === 'ch12_09') {
      const n = F?.height('swan') > 15 ? 'swan' : F?.height('bear') > 10 ? 'bear' : null;
      if (n) this.tl.after(fast ? 0.3 : 4, () => F.play(n, { secs: 22 }));
    }
    if (id === 'ch12_10') this.tl.after(fast ? 0.5 : 8, () => F?.stopAll?.());
  }
  update(dt, t) {
    const s = this.ch.s; this.tl.update(dt);
    const on = !!s.ell && s.phase === 'principia';
    if (on && this.kepT < 0) { this.kepT = 0; this.kep.show(true); shimmer(this.G, 3, 0.12); }
    if (this.kepT >= 0) {
      this.kepT += dt;
      const P = this.kep.P; P.pose = this.kepT < 3.5 ? 'cheer' : 'point';
      P.look = this.ch.ellG.position.clone(); P.pointAt.copy(this.ch.ellG.position);
      if (!on && this.kepT > 2) this.kep.show(false);
    }
    this.kep.update(dt, t);
  }
  dispose() { this.G.skyFigures?.stopAll?.(); this.kep.dispose(); }
}
