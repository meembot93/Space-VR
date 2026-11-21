// Chapter 6 extras: the Antikythera machine.
//  - Wow (ch6_08, "Nothing this complicated would be built again for more than a thousand years"):
//    the machine's gears burst out to the size of buildings, all around you, turning slowly in the
//    deep blue, so you stand inside the world's first computer. On "...a machine you could hold in
//    your hands" they shrink back into the little box over the rock.
//  - Cameo: as Astra says "Someone, two thousand years ago...", the echo of the Greek instrument maker
//    who built it appears beside the rock, hand on the crank.
import * as THREE from 'three';
import { Echo } from './echo.js';
import { seabedHeight } from '../chapters/antikythera.js';
import { rumble, awe, shimmer, Timeline, clamp01, ease } from './fx.js';

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
    const fp = chapter.floatPos || new THREE.Vector3();
    const pos = new THREE.Vector3(fp.x + 0.75, 0, fp.z - 0.35); pos.y = seabedHeight(pos.x, pos.z);
    this.maker = new Echo(G, chapter.sea || G.scene, { model: 'instrument_maker', seed: 33, tint: 0x9fe0ff, pos, face: -Math.PI / 2 - 0.4,
      look: { tunic: 0xd8ccb0, skin: 0xc09070, hair: 0x6a6a6a, beard: true, height: 1.72 } });
  }

  line(id) {
    const G = this.G;
    if (id === 'ch6_08') {
      this.on = true; this.t = 0; rumble(G, 5, 0.5); awe(G, 16, 0.09, 82);
      this.tl.after(9.5, () => { this.on = false; shimmer(G, 3, 0.15); });          // "...in your hands": back into the box
      this.tl.after(10.5, () => this.maker.show(true));                            // "Someone, two thousand years ago..."
    }
  }
  // a moment inside the gears before Astra carries on
  async after(id, D) { if (id === 'ch6_08') await D.until(() => this.grow < 0.02, 12); }
  async outro() { this.maker.show(false); }

  update(dt, t) {
    const G = this.G; this.tl.update(dt);
    this.maker.update(dt, t);
    if (this.maker.on) { this.maker.P.pose = 'point'; this.maker.P.pointAt.copy(this.ch.box?.getWorldPosition(_a) || _a); }
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

  dispose() { this.giant.parent?.remove(this.giant); this.maker.dispose(); }
}
