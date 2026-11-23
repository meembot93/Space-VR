// Era 2, Chapter 1 extras (n 8): Copernicus.
//  - Cameo (ch8_01): Aristarchus of Samos, who first put the Sun in the middle 1,800 years before,
//    appears as an echo by the parapet, looking up, and fades away when the line ends.
//  - Wow (ch8_04 to ch8_05): the Sun leaves your hand and drops into the middle of the sky model, a
//    golden ring of light bursts out across the lagoon, and the tangle of loops unwinds into circles.
//  - Living constellation (ch8_07): as the sky turns through the night, the Great Bear wakes up and
//    walks round the Pole Star.
//  - Foreshadowing (ch8_10): as the book's drawing rises into the stars, the W of Cassiopeia lights up
//    and one new star flickers there (the star Tycho will see in 1572: the next chapter).
import * as THREE from 'three';
import { Echo } from './echo.js';
import { glowSprite, glowPoints, shimmer, whoosh, awe, Timeline, clamp01, ease } from './fx.js';

const TOP = 14;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export default class Ch8Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.ari = new Echo(G, chapter.root, { model: 'aristotle', tint: 0x9fc0ff, pos: new THREE.Vector3(-1.6, TOP, -1.7), face: 0.5, seed: 3, look: { tunic: 0xe8e0d0, beard: true } });
    // the burst: a flat ring of light that sweeps out from the model's middle
    this.ring = glowPoints(360, { sizeScale: 300 }); this.ring.visible = false; chapter.root.add(this.ring);
    this.ringT = -1;
    // the new star in Cassiopeia
    this.nova = glowSprite(0xfff2d0, 30, 0); this.nova.visible = false; G.scene.add(this.nova);
    this.novaT = -1;
  }

  line(id) {
    const G = this.G, F = G.skyFigures;
    if (id === 'ch8_01') { this.ari.show(true); shimmer(G, 3, 0.15); }
    if (id === 'ch8_07' && F?.height('bear') > 5) this.tl.after(G.params.has('fast') ? 0.5 : 6, () => F.play('bear', { secs: 16 }));
    if (id === 'ch8_08') F?.stopAll?.();
    if (id === 'ch8_10') this.tl.after(G.params.has('fast') ? 0.5 : 5, () => { this.novaT = 0; this.nova.visible = true; shimmer(G, 5, 0.18); });
  }
  lineEnd(id) { if (id === 'ch8_01') this.ari.show(false); }

  update(dt, t) {
    const G = this.G, ch = this.ch, s = ch.s;
    this.tl.update(dt);
    this.ari.update(dt, t);
    // the Sun lands in the middle: the burst
    if (s.sunHand >= 3 && this.ringT < 0 && !this.burst) { this.burst = true; this.ringT = 0; whoosh(G, 2.5, 0.35); awe(G, 9, 0.08, 98); }
    if (this.ringT >= 0) {
      this.ringT += dt; const k = this.ringT / 3.5;
      this.ring.visible = k < 1;
      if (k >= 1) this.ringT = -1;
      else {
        const R = this.ring.userData, M = ch.model, r = 0.2 + ease(k) * 40, a = (1 - k) * (1 - k);
        for (let i = 0; i < 360; i++) {
          const ang = i / 360 * Math.PI * 2;
          M.localToWorld(_a.set(Math.cos(ang) * r, 0, Math.sin(ang) * r));
          R.pos.set([_a.x, _a.y, _a.z], i * 3); R.col.set([a, a * 0.8, a * 0.45], i * 3); R.size[i] = 0.05 + r * 0.01;
        }
        R.commit();
      }
    }
    // Cassiopeia and its new star
    const sf = G.sky.starField;
    if (this.novaT >= 0) {
      this.novaT += dt;
      const on = s.diagram || this.novaT < 12, k = clamp01(this.novaT / 3) * (on ? 1 : clamp01(1 - (this.novaT - 12) / 3));
      sf?.highlight?.('Cas', 0.8 * k);
      const i = sf?.find?.('Caph') ?? -1;
      if (i >= 0) {
        sf.dirOf(i, _a); _b.set(0, 1, 0).cross(_a).normalize();
        G.camera.getWorldPosition(this.nova.position);
        this.nova.position.addScaledVector(_a.addScaledVector(_b, 0.03).normalize(), 900);
      }
      this.nova.material.opacity = k * (0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 3.1));
      if (k <= 0 && this.novaT > 12) { this.novaT = -1; this.nova.visible = false; sf?.highlight?.(null); }
    }
  }

  dispose() {
    this.G.scene.remove(this.nova);
    this.G.sky.starField?.highlight?.(null);
    this.G.skyFigures?.stopAll?.();
  }
}
