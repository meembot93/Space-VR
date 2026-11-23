// Era 2, Chapter 1 extras (n 8): Copernicus.
//  - Cameo (ch8_01): Aristarchus's old question floats up by the parapet as a glowing page: his
//    name, and a little drawing with the Sun in the middle and the Earth going round it (the Earth
//    dot really travels round), fading away when the line ends.
//  - Wow (ch8_04 to ch8_05): the Sun leaves your hand and drops into the middle of the sky model, a
//    golden ring of light bursts out across the lagoon, and the tangle of loops unwinds into circles.
//  - Living constellation (ch8_07): as the sky turns through the night, the Great Bear wakes up and
//    walks round the Pole Star.
//  - Foreshadowing (ch8_10): as the book's drawing rises into the stars, the W of Cassiopeia lights up
//    and one new star flickers there (the star Tycho will see in 1572: the next chapter).
import * as THREE from 'three';
import { canvasTex } from '../util.js';
import { glowSprite, glowPoints, shimmer, whoosh, awe, Timeline, clamp01, ease } from './fx.js';

const TOP = 14;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export default class Ch8Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.ari = this.makeAristarchus(chapter.root); this.ariK = 0; this.ariOn = false;
    // the burst: a flat ring of light that sweeps out from the model's middle
    this.ring = glowPoints(360, { sizeScale: 300 }); this.ring.visible = false; chapter.root.add(this.ring);
    this.ringT = -1;
    // the new star in Cassiopeia
    this.nova = glowSprite(0xfff2d0, 30, 0); this.nova.visible = false; G.scene.add(this.nova);
    this.novaT = -1;
  }

  line(id) {
    const G = this.G, F = G.skyFigures;
    if (id === 'ch8_01') { this.ariOn = true; shimmer(G, 3, 0.15); }
    if (id === 'ch8_07' && F?.height('bear') > 5) this.tl.after(G.params.has('fast') ? 0.5 : 6, () => F.play('bear', { secs: 16 }));
    if (id === 'ch8_08') F?.stopAll?.();
    if (id === 'ch8_10') this.tl.after(G.params.has('fast') ? 0.5 : 5, () => { this.novaT = 0; this.nova.visible = true; shimmer(G, 5, 0.18); });
  }
  lineEnd(id) { if (id === 'ch8_01') this.ariOn = false; }

  // A glowing page over the north parapet: "Aristarchus of Samos, about 270 BC", and his idea drawn
  // in gold: the Sun in the middle, the Earth's circle round it, the stars far outside. The Earth
  // is a separate glowing dot that goes round while you watch.
  makeAristarchus(root) {
    const g = new THREE.Group(); g.position.set(-0.9, TOP + 1.75, -2.2); g.visible = false; root.add(g);
    const W = 0.9, H = 0.9 * 640 / 1024, cx = 0.5, cy = 0.56, R = 0.2;   // drawing centre, Earth circle (fractions of the width)
    const tex = canvasTex(1024, 640, (c, w, h) => {
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = 'rgba(255,190,90,0.9)'; c.shadowBlur = 16;
      c.fillStyle = '#ffe6b0'; c.font = 'italic 54px Georgia, serif'; c.fillText('Aristarchus of Samos', w / 2, 58);
      c.font = 'italic 34px Georgia, serif'; c.fillStyle = '#e8cf98'; c.fillText('about 270 BC', w / 2, 112);
      const x = cx * w, y = cy * h + 40;
      c.strokeStyle = 'rgba(255,226,168,0.35)'; c.lineWidth = 3; c.setLineDash([6, 10]);
      c.beginPath(); c.ellipse(x, y, 420, 190, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);   // the stars, very far
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2 + 0.07 * (i % 3); c.fillStyle = '#fff4dc'; c.beginPath(); c.arc(x + Math.cos(a) * 420, y + Math.sin(a) * 190, 2 + (i % 4 === 0 ? 2 : 0), 0, 7); c.fill(); }
      c.strokeStyle = '#ffe2a8'; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y, R * w, R * w * 0.45, 0, 0, Math.PI * 2); c.stroke();
      const gr = c.createRadialGradient(x, y, 0, x, y, 60); gr.addColorStop(0, '#fff8d0'); gr.addColorStop(0.4, '#ffc850'); gr.addColorStop(1, 'rgba(255,160,40,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, 60, 0, 7); c.fill();
      c.fillStyle = '#5a3a10'; c.font = 'bold 26px Georgia, serif'; c.shadowBlur = 0; c.fillText('Sun', x, y + 2);
    });
    const page = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    g.add(page); this.ariPage = page;
    this.ariEarth = glowSprite(0x7ab8ff, 0.07, 0); g.add(this.ariEarth);
    this.ariOrbit = { x: (cx - 0.5) * W, y: (0.5 - (cy + 40 / 640)) * H, rx: R * W, ry: R * W * 0.45 };
    return g;
  }

  update(dt, t) {
    const G = this.G, ch = this.ch, s = ch.s;
    this.tl.update(dt);
    // Aristarchus's page: fades in, faces you, the Earth going round its Sun
    this.ariK += ((this.ariOn ? 1 : 0) - this.ariK) * Math.min(1, dt * 1.5);
    this.ari.visible = this.ariK > 0.01;
    if (this.ari.visible) {
      G.camera.getWorldPosition(_a); this.ari.lookAt(_a.x, this.ari.position.y, _a.z);
      this.ari.position.y = TOP + 1.75 + Math.sin(t * 0.9) * 0.02;
      this.ariPage.material.opacity = this.ariK;
      const O = this.ariOrbit, a = t * 0.8; this.ariEarth.position.set(O.x + Math.cos(a) * O.rx, O.y - Math.sin(a) * O.ry, 0.01);
      this.ariEarth.material.opacity = this.ariK;
    }
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
