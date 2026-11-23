// Era 2, Chapter 7 extras (n 14): Sputnik. The big moments (the launch, the Korolev cross, the ride
// to orbit, the radio room, the ring of echoes, the rising Moon) live in the chapter itself; here:
//  - Living constellation (ch14_01, the night at the pad): the Swan flies down the Milky Way, or the
//    Great Bear walks if the Swan has set; on the hill (ch14_11) the Hunter or the Bull rises in the east.
//  - Cameo (ch14_04 to ch14_05): an echo of Robert Goddard stands with the watchers at the viewing
//    spot, as if to see his dream fly, and fades once the rocket is gone.
import * as THREE from 'three';
import { Echo } from './echo.js';
import { shimmer, Timeline } from './fx.js';

const _a = new THREE.Vector3();

export default class Ch14Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    const V = chapter.korolevView, f = chapter.vf, r = chapter.vr;
    if (chapter.site && V && f) {
      const pos = V.clone().addScaledVector(r, -2.2).addScaledVector(f, -0.8);
      this.god = new Echo(G, chapter.site, { model: 'goddard', tint: 0xc0f0e0, pos, face: Math.atan2(f.x, f.z), seed: 6 });
    }
  }
  line(id) {
    const G = this.G, F = G.skyFigures, fast = G.params.has('fast');
    const pick = (list) => list.find((n) => F?.height(n) > 10);
    if (id === 'ch14_01') { const n = pick(['swan', 'bear', 'bull']); if (n) this.tl.after(fast ? 0.3 : 4, () => F.play(n, { secs: 16 })); }
    if (id === 'ch14_02') F?.stopAll?.();
    if (id === 'ch14_04' && this.god) { this.god.show(true); shimmer(G, 2.5, 0.1); }
    if (id === 'ch14_06') this.god?.show(false);
    if (id === 'ch14_11') { const n = pick(['hunter', 'bull', 'swan', 'bear']); if (n) this.tl.after(fast ? 0.3 : 2, () => F.play(n, { secs: 18 })); }
    if (id === 'ch14_12') F?.stopAll?.();
  }
  update(dt, t) {
    this.tl.update(dt);
    if (!this.god) return;
    const R = this.ch.rocket, P = this.god.P;
    if (R) { R.getWorldPosition(_a); _a.y += 18; P.look = _a.clone(); P.pointAt.copy(_a); P.pose = this.ch.launchT > 3 ? 'point' : 'idle'; }
    this.god.update(dt, t);
  }
  dispose() { this.god?.dispose(); this.G.skyFigures?.stopAll?.(); }
}
