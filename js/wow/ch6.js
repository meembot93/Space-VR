// Chapter 6 extras: the Antikythera machine.
//  - Wow (ch6_08, "Nothing this complicated would be built again for more than a thousand years"):
//    the machine's gears burst out to the size of buildings, all around you, turning slowly in the
//    deep blue, so you stand inside the world's first computer. On "...a machine you could hold in
//    your hands" they shrink back into the little box over the rock.
//  - As Astra says "Someone, two thousand years ago...", the little machine glows warm, like lamplight
//    in a workshop, and a few words appear over it: made by hand, over 2,000 years ago.
import * as THREE from 'three';
import { rumble, awe, shimmer, glowSprite, textSprite, Timeline, clamp01, ease } from './fx.js';

const BIG = 55;   // how many times bigger the gears get
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

export default class Ch6Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.giant = new THREE.Group(); this.giant.visible = false; (chapter.sea || G.scene).add(this.giant);
    this.mat = new THREE.MeshStandardMaterial({ color: 0xd8a850, emissive: 0x4a3208, roughness: 0.4, metalness: 0.55, transparent: true, opacity: 0 });
    this.edge = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true });
    this.parts = (chapter.gears || []).map((g) => {
      const m = new THREE.Mesh(g.m.geometry, this.mat); m.position.copy(g.to);
      const w = new THREE.Mesh(g.m.geometry, this.edge); m.add(w);
      this.giant.add(m); return { m, speed: g.speed };
    });
    this.k = 0; this.grow = 0; this.spin = 0;
    // the maker's moment: lamplight on the box, and the words over it
    this.lampGlow = glowSprite(0xffc070, 0.9, 0); this.label = textSprite('Made by hand, over 2,000 years ago', 0.055);
    this.label.material.opacity = 0; this.made = 0; this.madeOn = false;
    (chapter.sea || G.scene).add(this.lampGlow, this.label);
  }

  line(id) {
    const G = this.G;
    if (id === 'ch6_08') {
      this.on = true; this.t = 0; rumble(G, 5, 0.5); awe(G, 16, 0.09, 82);
      this.tl.after(9.5, () => { this.on = false; shimmer(G, 3, 0.15); });          // "...in your hands": back into the box
      this.tl.after(10.5, () => { this.madeOn = true; shimmer(G, 2.5, 0.12); });   // "Someone, two thousand years ago..."
    }
  }
  // a moment inside the gears before Astra carries on
  async after(id, D) { if (id === 'ch6_08') await D.until(() => this.grow < 0.02, 12); }
  async outro() { this.madeOn = false; }

  update(dt, t) {
    const G = this.G; this.tl.update(dt);
    // the warm glow and the words, over the box wherever it floats
    this.made = clamp01(this.made + dt * (this.madeOn ? 0.6 : -0.8));
    this.lampGlow.visible = this.label.visible = this.made > 0.01 && !!this.ch.box?.visible;
    if (this.lampGlow.visible) {
      const P = this.lampGlow.parent; this.ch.box.getWorldPosition(_a); P.worldToLocal(_a);
      this.lampGlow.position.copy(_a); this.lampGlow.scale.setScalar(0.55 + 0.04 * Math.sin(t * 3));
      this.lampGlow.material.opacity = this.made * (0.45 + 0.08 * Math.sin(t * 5.3));
      this.label.position.copy(_a).add(_b.set(0, 0.24, 0)); this.label.material.opacity = this.made;
    }
    // grow out around you, then shrink back into the box
    this.grow = clamp01(this.grow + dt * (this.on ? 0.33 : -0.4));
    this.giant.visible = this.grow > 0.01;
    if (!this.giant.visible) return;
    const g = ease(this.grow), box = this.ch.box;
    const from = box ? box.getWorldPosition(_a) : _a.set(0, 1, 0), cam = G.camera.getWorldPosition(_b);
    // the gears' faces turn toward you, and the front ones stop a couple of metres short of your face
    const toCam = _c.copy(cam).sub(from).setY(0).normalize(), scale = 1 + (BIG - 1) * g * g;
    _d.copy(cam).addScaledVector(toCam, -0.085 * scale);
    const parent = this.giant.parent; parent.updateWorldMatrix(true, false);
    this.giant.position.lerpVectors(from, _d, g); parent.worldToLocal(this.giant.position);
    this.giant.scale.setScalar(scale);
    _q.setFromUnitVectors(_e.set(0, 0, 1), toCam);
    if (box) this.giant.quaternion.copy(box.getWorldQuaternion(_q2)).slerp(_q, g); else this.giant.quaternion.copy(_q);
    this.mat.opacity = Math.min(1, g * 1.4) * 0.92; this.edge.opacity = g * 0.18;
    // turning: the faster gears spin like wheels, the big ones slowly
    this.spin += dt * 0.35;
    for (const p of this.parts) p.m.rotation.z = this.spin * Math.PI * 2 * p.speed;
  }

  dispose() { this.giant.parent?.remove(this.giant); this.lampGlow.parent?.remove(this.lampGlow, this.label); }
}
