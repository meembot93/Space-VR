// Chapter 5 extras: Greece.
//  - Living constellations (ch5_01, Athens at night, where most of our constellation stories come
//    from): the Swan glides down the Milky Way overhead and the Scorpion strikes low in the south.
//  - Wow (ch5_12, "Today, with satellites..."): the ground falls away and you float in space beside
//    the whole Earth. A satellite drifts by, a ring of light runs right round the planet (about
//    40,000 km), and two parallel sunbeams reach Syene and Alexandria: straight down into the well
//    at Syene, slanting at Alexandria, with lines to the Earth's centre showing the same 7 degrees.
//    Then you're back in Alexandria.
import * as THREE from 'three';
import { Space, lonLat } from './space.js';
import { glowSprite, textSprite, shimmer, awe, whoosh, Timeline, clamp01, ease } from './fx.js';

const SYENE = [24.09, 32.9], ALEX = [31.2, 29.92];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion();

export default class Ch5Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.space = new Space(G, { earthR: 14 });
    const E = this.space.earth, R = this.space.R;
    const gold = (o = 0) => new THREE.MeshBasicMaterial({ color: 0xffd890, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    // the ring right round the world, through both cities (the meridian at about 31 degrees east)
    this.ringMat = gold(); this.ring = new THREE.Mesh(new THREE.BufferGeometry(), this.ringMat); E.add(this.ring); this.ringK = 0;
    this.km = textSprite('about 40,000 km around', 1.6); this.km.material.opacity = 0; this.space.group.add(this.km);
    // the two cities
    this.cities = [SYENE, ALEX].map(([la, lo], i) => {
      const n = lonLat(la, lo); const dot = glowSprite(0xffe2a0, 1.4, 0); dot.position.copy(n).multiplyScalar(R * 1.01); E.add(dot);
      const lab = textSprite(i ? 'Alexandria' : 'Syene', 0.9); lab.material.opacity = 0; this.space.group.add(lab);
      return { n, dot, lab };
    });
    // sunbeams (long thin shafts, parallel) and the lines down to the centre (seen through the Earth)
    this.beams = this.cities.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 8, 1, true).translate(0, 0.5, 0), gold()); this.space.group.add(m); return m; });
    this.radMat = new THREE.MeshBasicMaterial({ color: 0xffe8b8, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.radials = this.cities.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, R, 6).translate(0, R / 2, 0), this.radMat); m.renderOrder = 6; E.add(m); return m; });
    this.cities.forEach((c, i) => this.radials[i].quaternion.setFromUnitVectors(_a.set(0, 1, 0), c.n));
    this.deg = textSprite('7°', 1.4); this.deg.material.depthTest = false; this.deg.material.opacity = 0; this.space.group.add(this.deg);
    // a satellite: a little body with two solar panels and a blinking light
    const sat = this.sat = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0xd8d0b8, metalness: 0.6, roughness: 0.4, fog: false }));
    const panelM = new THREE.MeshStandardMaterial({ color: 0x2a4a9a, emissive: 0x0a1840, metalness: 0.3, roughness: 0.5, fog: false });
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.55), panelM); p.position.x = sx * 1.1; sat.add(p); }
    this.blink = glowSprite(0xff6050, 0.6, 1); this.blink.position.z = 0.45; sat.add(body, this.blink);
    sat.visible = false; this.space.group.add(sat);
  }

  line(id) {
    const G = this.G, F = G.skyFigures;
    if (id === 'ch5_01') {
      if (F.height('swan') > 10) this.tl.after(5, () => F.play('swan', { secs: 20 }));
      if (F.height('scorpion') > 6) this.tl.after(9, () => F.play('scorpion', { secs: 16 }));
    }
    if (id === 'ch5_02') F.stopAll();
    if (id === 'ch5_12') this.goToSpace();
  }
  lineEnd(id) { if (id === 'ch5_12' && this.inSpace) this.tl.after(this.G.params.has('fast') ? 0.3 : 3.5, () => this.backToEarth()); }
  async after(id, D) { if (id === 'ch5_12' && this.inSpace) await D.until(() => !this.inSpace && !this.fading, 15); }

  async goToSpace() {
    const G = this.G; this.inSpace = true; this.fading = true;
    whoosh(G, 3, 0.4);
    await G.ui.fadeOut(0.7);
    // lay it out in front of where you're looking: the Earth ahead and a little below
    const cam = G.camera.getWorldPosition(_a), f = G.camera.getWorldDirection(_b).setY(0).normalize();
    const left = _c.set(f.z, 0, -f.x); // 90 degrees to the left of f
    const E = this.space.earth, R = this.space.R;
    E.position.copy(cam).addScaledVector(f, R * 2.7).add(new THREE.Vector3(0, -R * 0.15, 0));
    // turn the Earth so the cities' meridian faces you edge-on, on the left: north is up
    E.quaternion.setFromUnitVectors(lonLat(0, 31), left.clone());
    E.updateMatrixWorld(true);
    // the Sun is straight over Syene at noon on the longest day
    this.space.sunDir.copy(this.cities[0].n).applyQuaternion(E.quaternion).normalize();
    this.f = f.clone(); this.t0 = G.t;
    this.space.enter(this.ch.root);
    this.ringK = 0; this.k = 0;
    await G.ui.fadeIn(1.4);
    this.fading = false;
    awe(G, 16, 0.08, 98); this.tl.after(2.5, () => shimmer(G, 3, 0.15)); this.tl.after(7, () => shimmer(G, 2, 0.12));
  }

  async backToEarth() {
    const G = this.G; this.fading = true;
    await G.ui.fadeOut(0.8);
    this.space.exit(); this.inSpace = false;
    await G.ui.fadeIn(1);
    this.fading = false;
  }

  update(dt, t) {
    const G = this.G; this.tl.update(dt);
    this.space.update(dt);
    if (!this.space.on) return;
    const E = this.space.earth, R = this.space.R, T = G.t - this.t0;
    E.updateMatrixWorld(true);
    // the ring draws itself round the world
    const ring = clamp01((T - 2) / 3.5);
    if (Math.abs(ring - this.ringK) > 0.01 || (ring === 1 && this.ringK !== 1)) {
      this.ringK = ring; this.ring.geometry.dispose();
      // in the Earth's own frame: the great circle through the poles and longitude 31 east
      const tor = new THREE.TorusGeometry(R * 1.012, 0.07, 6, 160, Math.max(0.001, ease(ring) * Math.PI * 2));
      tor.rotateZ(Math.PI / 2 - 0.05); tor.applyQuaternion(_q.setFromUnitVectors(_a.set(0, 0, 1), lonLat(0, 31 + 90)));
      this.ring.geometry = tor;
    }
    this.ringMat.opacity = 0.85 * clamp01((T - 2) * 2);
    this.km.material.opacity = clamp01((T - 4.5) * 1.2);
    this.km.position.copy(E.position).add(_a.set(0, R * 1.22, 0));
    // the satellite glides past along a tilted orbit
    this.sat.visible = T > 1;
    const a = T * 0.22 + 0.8, orbit = R * 1.32;
    this.sat.position.copy(E.position).add(_a.set(Math.cos(a) * orbit, Math.sin(a) * orbit * 0.35, Math.sin(a) * orbit * 0.94).applyAxisAngle(_b.set(0, 1, 0), 0.5));
    this.sat.lookAt(E.position); this.blink.material.opacity = Math.sin(t * 6) > 0.6 ? 1 : 0.1;
    // the sunbeams, the cities and the 7 degrees
    const b = clamp01((T - 6.5) / 1.5), sun = this.space.sunDir;
    this.cities.forEach((c, i) => {
      const p = _a.copy(c.n).multiplyScalar(R * 1.01).applyMatrix4(E.matrixWorld);
      const len = 60 * ease(b), m = this.beams[i];
      m.position.copy(p).addScaledVector(sun, len); m.quaternion.setFromUnitVectors(_b.set(0, 1, 0), _c.copy(sun).negate()); m.scale.set(1, Math.max(0.001, len), 1);
      m.material.opacity = 0.8 * b;
      c.dot.material.opacity = b; c.dot.scale.setScalar(1.2 + 0.3 * Math.sin(t * 4 + i));
      c.lab.material.opacity = b; c.lab.position.copy(p).addScaledVector(_b.copy(c.n).applyQuaternion(E.quaternion), 2.2).add(_c.set(0, i ? 0.9 : -0.9, 0));
    });
    const r = clamp01((T - 9) / 1.2);
    this.radMat.opacity = 0.75 * r; this.deg.material.opacity = r;
    this.deg.position.copy(E.position).addScaledVector(_a.copy(lonLat(28, 31)).applyQuaternion(E.quaternion), R * 0.28).addScaledVector(this.f, -R * 1.05);
  }

  dispose() { this.space.dispose(); this.G.skyFigures.stopAll(); }
}
