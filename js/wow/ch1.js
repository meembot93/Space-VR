// Chapter 1 extras: the campfire.
//  - Wow: "Look up." Until then the fire's glare keeps the sky dim. On those words the fire throws
//    up a column of sparks that spiral into the sky and become the stars, and the whole night sky
//    and the Milky Way blaze out.
//  - Living constellations: while you look around the sky (ch1_04 and the pause after it), the
//    Lion prowls overhead, the Bear lumbers along, and the Hunter raises his club at the Bull.
import * as THREE from 'three';
import { glowPoints, skyLevel, shimmer, whoosh, awe, ease, clamp01, Timeline } from './fx.js';

const N = 160, FIRE = new THREE.Vector3(0, 0.5, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export default class Ch1Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter;
    this.sparks = glowPoints(N, { sizeScale: 260 }); this.sparks.visible = false; G.scene.add(this.sparks);
    this.tl = new Timeline();
    this.sky = 0;       // 0 = dim (fire glare), 1 = the full night sky
    this.burst = -1;    // seconds since the sparks went up
    this.p = Array.from({ length: N }, () => ({ start: new THREE.Vector3(), target: new THREE.Vector3(), delay: 0, spin: 0, r: 0 }));
  }

  line(id) {
    const G = this.G;
    if (id === 'ch1_03') this.go = G.t + 1.4;            // "...Look up." comes at the end of the line
    if (id === 'ch1_04') this.figT = G.t + 7;            // the constellations wake as Astra talks about the stars
  }

  launch() {
    const G = this.G, sf = G.sky.starField;
    this.burst = 0; this.sparks.visible = true;
    // each spark flies to a real bright star above the horizon
    const stars = [];
    if (sf.ready) for (let i = 0; i < sf.mags.length && stars.length < N; i++) { if (sf.mags[i] > 3.6) continue; sf.dirOf(i, _a); if (_a.y > 0.12) stars.push(_a.clone()); }
    this.p.forEach((q, i) => {
      q.delay = Math.random() * 2.2; q.spin = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2); q.r = 0.15 + Math.random() * 0.5;
      q.a0 = Math.random() * 6.28; q.h = 3 + Math.random() * 5;
      q.target.copy(stars.length ? stars[i % stars.length] : _b.set(Math.random() - 0.5, 0.5 + Math.random(), Math.random() - 0.5).normalize());
    });
    shimmer(G, 5, 0.22); whoosh(G, 4, 0.35, FIRE); awe(G, 12, 0.09, 98);
  }

  update(dt) {
    const G = this.G;
    this.tl.update(dt);
    if (this.go && G.t >= this.go) { this.go = 0; this.launch(); }
    if (this.figT && G.t >= this.figT) { this.figT = 0; this.wakeFigures(); }
    // the sky: dim beside the fire until the sparks rise, then it fills in
    if (this.burst >= 0) this.sky = clamp01(this.sky + dt / 6 * (this.burst > 1.5 ? 1 : 0));
    const k = ease(this.sky);
    skyLevel(G, 0.32 + 0.68 * k, 0.25 + 1.15 * k);
    if (this.burst < 0) return;
    this.burst += dt;
    const P = this.sparks.userData, cam = G.camera.getWorldPosition(_b);
    let live = 0;
    this.p.forEach((q, i) => {
      const t = this.burst - q.delay;
      let s = 0;
      if (t > 0 && t < 7) {
        live++;
        // rise in a spiral out of the fire, then shoot off to its star
        const rise = Math.min(1, t / 1.8), a = q.a0 + t * q.spin;
        _a.set(Math.cos(a) * q.r * (1 + rise), 0.3 + rise * q.h * (0.4 + 0.6 * rise), Math.sin(a) * q.r * (1 + rise)).add(FIRE);
        const fly = ease((t - 1.4) / 4.2);
        if (fly > 0) _a.lerp(_b.copy(q.target).multiplyScalar(320).add(cam), fly * fly);
        // grow with distance so it stays a visible spark all the way, then melt into its star
        s = (0.05 + 0.03 * Math.sin(t * 13 + i)) * (1 + fly * 90);
        if (t > 5.6) s *= Math.max(0, (7 - t) / 1.4);
        P.pos.set([_a.x, _a.y, _a.z], i * 3);
        const hot = clamp01(1 - fly * 1.3);
        P.col.set([1, 0.55 + 0.45 * (1 - hot), 0.2 + 0.8 * (1 - hot)], i * 3);
      }
      P.size[i] = s;
    });
    P.commit();
    if (!live && this.burst > 3) this.sparks.visible = false;
  }

  // Ice Age animals in the stars: the Lion prowls overhead, the Bear lumbers in the north, and low in
  // the west the Hunter faces the Bull (whichever of them are above the horizon tonight)
  wakeFigures() {
    const F = this.G.skyFigures, up = (n) => F.height(n) > 8;
    const plan = [['lion', 0, 24], ['bear', 3, 22], ['hunter', 6, 20], ['bull', 7.5, 19], ['doves', 10, 14]];
    for (const [n, at, secs] of plan) if (up(n)) this.tl.after(at, () => F.play(n, { secs }));
  }

  dispose() {
    this.G.scene.remove(this.sparks); this.sparks.geometry.dispose();
    this.G.sky.uni.milky.value = 1;
    this.G.skyFigures.stopAll();
  }
}
