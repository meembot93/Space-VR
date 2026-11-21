// Cameo characters: "echoes" of real sky-watchers who appear for a moment, glowing softly like a
// memory, show you their idea, then fade away in a swirl of sparks. Each one uses Meem's Tripo model
// when it's listed in models/index.json (e.g. 'architect'), and a plain stand-in until then; either
// way it gets the same gentle glow, so a stand-in still looks deliberate.
import * as THREE from 'three';
import { makePerson, animatePerson } from '../people.js';
import { glowPoints, clamp01 } from './fx.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Echo {
  // opts: { model, look (stand-in colours), tint (glow colour), pos, face (yaw, radians) }
  constructor(G, parent, opts) {
    this.G = G; this.tint = new THREE.Color(opts.tint ?? 0x9fc8ff);
    this.P = makePerson({ model: opts.model, seed: opts.seed || 5, ...(opts.look || {}) });
    this.P.g.position.copy(opts.pos); this.P.g.rotation.y = opts.face || 0;
    parent.add(this.P.g);
    this.mats = [];
    this.k = 0; this.on = false; this.ghost();
    // a little cloud of sparks around them as they appear and go
    this.sparks = glowPoints(40, { sizeScale: 200 }); parent.add(this.sparks);
    this.sp = Array.from({ length: 40 }, () => ({ a: Math.random() * 6.28, y: Math.random() * 1.9, r: 0.3 + Math.random() * 0.35, v: 0.3 + Math.random() * 0.6 }));
    this.P.g.visible = false;
  }

  // Give every material the echo look (also for the Tripo model once it has loaded)
  ghost() {
    this.P.g.traverse((o) => {
      if (!o.isMesh || o.userData.echo) return;
      o.userData.echo = true;
      const m = (o.material = o.material.clone());
      m.transparent = true; m.depthWrite = true;
      if ('emissive' in m) { m.emissive = this.tint.clone(); m.emissiveIntensity = 0.55; }
      else if (m.color) m.color.lerp(this.tint, 0.4);
      this.mats.push(m);
    });
  }

  show(on = true) { this.on = on; if (on) this.P.g.visible = true; }

  update(dt, t) {
    const P = this.P;
    if (P.model && !this.modelGhosted) { this.modelGhosted = true; this.ghost(); }
    this.k = clamp01(this.k + dt * (this.on ? 0.7 : -0.6));
    P.g.visible = this.k > 0.01;
    this.sparks.visible = this.k > 0.01 && this.k < 0.99;
    if (!P.g.visible) return;
    for (const m of this.mats) { m.opacity = 0.82 * this.k; if ('emissiveIntensity' in m) m.emissiveIntensity = 0.45 + 0.15 * Math.sin(t * 2.2); }
    animatePerson(P, t, dt);
    // sparks spiral up around them while they fade in or out
    const S = this.sparks.userData, c = P.g.position;
    this.sp.forEach((q, i) => {
      q.a += dt * q.v * 2; q.y = (q.y + dt * q.v) % 2;
      S.pos.set([c.x + Math.cos(q.a) * q.r, c.y + q.y, c.z + Math.sin(q.a) * q.r], i * 3);
      const k = Math.sin(this.k * Math.PI) * (1 - q.y / 2);
      S.col.set([this.tint.r * k, this.tint.g * k, this.tint.b * k], i * 3); S.size[i] = 0.025;
    });
    S.commit();
  }

  // Where their right hand is (world), for props
  hand(out = new THREE.Vector3()) {
    const P = this.P, B = P.rig?.bones;
    if (B?.RightHand) return B.RightHand.getWorldPosition(out);
    if (P.arms) { P.arms[1].updateWorldMatrix(true, false); return out.set(0, -0.62, 0).applyMatrix4(P.arms[1].matrixWorld); }
    return P.g.getWorldPosition(out).setY(out.y + 1.2);
  }

  dispose() { this.P.g.parent?.remove(this.P.g); this.sparks.parent?.remove(this.sparks); this.sparks.geometry.dispose(); }
}
