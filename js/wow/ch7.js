// Chapter 7 extras: Ptolemy's spinning sky, and the end of Era 1.
//  - Living constellations (ch7_07, the Almagest, whose star catalogue named 48 constellations, most
//    of the ones we still use): the Swan, the Scorpion and the Great Bear wake up on the sphere of
//    the fixed stars.
//  - Wow (ch7_11, "...And it was wrong."): on "wrong", the crystal spheres shatter: thousands of glass
//    shards burst outward and tumble away into the dark.
//  - Finale (after the last journal page): you lift off the Earth. It falls away below you into a
//    blue ball, the Moon looms up and sweeps past, a tiny satellite beeping its radio "beep... beep..."
//    drifts by (Sputnik, where the story is heading), and the words "Era 2 is on the way" glow ahead.
import * as THREE from 'three';
import { Space } from './space.js';
import { textSprite, glowSprite, shimmer, shatter, rumble, whoosh, awe, beeps, Timeline, clamp01, ease } from './fx.js';

const SHARDS = 900;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

export default class Ch7Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    // glass shards: one instanced mesh
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.5, 0, -0.35, -0.3, 0.05, 0.4, -0.25, -0.05], 3)); tri.computeVertexNormals();
    this.shardMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.shards = new THREE.InstancedMesh(tri, this.shardMat, SHARDS); this.shards.frustumCulled = false; this.shards.visible = false;
    (chapter.cosmos || G.scene).add(this.shards);
    this.sh = []; this.broken = false; this.breakT = 0;
    // the finale
    this.space = new Space(G, { earthR: 60 });
    this.sputnik = makeSputnik(); this.sputnik.visible = false; this.space.group.add(this.sputnik);
    this.title = new THREE.Group(); this.space.group.add(this.title);
    this.t1 = textSprite('Era 2 is on the way', 1.4); this.t2 = textSprite('Starward', 2.6, { color: '#ffe7b0' });
    this.t2.position.y = 2.2; this.title.add(this.t1, this.t2); this.title.visible = false;
    this.finT = -1;
  }

  line(id) {
    const G = this.G, F = G.skyFigures;
    if (id === 'ch7_07') {
      const plan = [['swan', 3, 20], ['scorpion', 6, 17], ['bear', 9, 14]];
      for (const [n, at, secs] of plan) if (F.height(n) > 8) this.tl.after(at, () => F.play(n, { secs }));
    }
    if (id === 'ch7_08') F.stopAll();
    if (id === 'ch7_11') this.tl.after(this.G.params.has('fast') ? 0.3 : 3.2, () => this.shatter());   // "...And it was wrong."
  }

  shatter() {
    const G = this.G, spheres = this.ch.spheres || [];
    this.broken = true; this.breakT = 0; this.shards.visible = true;
    shatter(G, 0.4); rumble(G, 2.5, 0.35);
    const eye = spheres[0]?.g.position.y ?? 1.6;
    // shards from every crystal sphere (not the stars'), spread over each shell
    const shells = spheres.filter((S) => S.b.k !== 'stars');
    for (let i = 0; i < SHARDS; i++) {
      const S = shells[i % Math.max(1, shells.length)], r = S ? S.b.r : 5;
      const d = new THREE.Vector3().randomDirection();
      this.sh[i] = { p: d.clone().multiplyScalar(r).add(_a.set(0, eye, 0)), v: d.multiplyScalar(1.5 + Math.random() * 3 + r * 0.25), rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(8), size: 0.08 + Math.random() * 0.25 + r * 0.012 };
    }
  }

  // The finale starts on every headset (the host sends it), and the host waits for it to finish
  async outro(D) {
    this.G.events.emit('extra', { k: 'finale' });
    await D.until(() => this.finT < 0 || this.finT > 40, 60);
    if (this.finT >= 0) await D.until(() => this.finT < 0, 15);
  }
  extra(d) { if (d.k === 'finale') this.finale(); }

  async finale() {
    const G = this.G; this.finT = 0; this.fin = true; this.cam = null;
    await G.ui.fadeOut(1.2);
    G.skyFigures.stopAll();
    // you're just above the Earth: it fills the view below you, the Moon far ahead
    this.cam = G.camera.getWorldPosition(new THREE.Vector3());
    this.fwd = G.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    this.right = new THREE.Vector3(-this.fwd.z, 0, this.fwd.x);
    this.space.sunDir.copy(this.right).multiplyScalar(-1).add(_a.set(0, 0.4, 0)).addScaledVector(this.fwd, -0.3).normalize();
    this.space.enter(this.ch.root);
    this.space.moon.visible = true; this.sputnik.visible = true; this.title.visible = true;
    this.finT = 0; this.place(0);
    rumble(G, 9, 0.7); whoosh(G, 7, 0.4);
    await G.ui.fadeIn(1.5);
    this.tl.after(4, () => awe(G, 22, 0.1, 82));
    this.tl.after(16, () => whoosh(G, 4, 0.35));
    this.tl.after(23, () => beeps(G, 9));
    this.tl.after(30, () => shimmer(G, 5, 0.18));
  }

  // Where everything is, T seconds into the flight (you stay still; the worlds move past you)
  place(T) {
    if (!this.cam) return;
    const c = this.cam, f = this.fwd, r = this.right;
    // the Earth drops away below and a little ahead, shrinking to a ball
    const up = ease(T / 18) * 0.85 + (T / 40) * 0.15;
    this.space.earth.position.copy(c).add(_a.set(0, -66 - 900 * up * up, 0)).addScaledVector(f, 30 + 160 * up);
    this.space.earth.rotation.y = 1.9 + T * 0.01;
    // the Moon grows ahead, then sweeps past on your right
    const m = clamp01((T - 6) / 16), mz = 1400 - 1500 * ease(m);
    this.space.moon.position.copy(c).addScaledVector(f, mz).addScaledVector(r, 40 + 30 * ease(m)).add(_a.set(0, 12, 0));
    this.space.moon.rotation.y = T * 0.03;
    // Sputnik drifts across in front of you, beeping
    const s = clamp01((T - 21) / 12);
    this.sputnik.position.copy(c).addScaledVector(f, 6).addScaledVector(r, -7 + 14 * s).add(_a.set(0, 0.4 + 0.6 * s, 0));
    this.sputnik.rotation.set(T * 0.4, T * 0.7, 0.3);
    this.sputnik.visible = T > 20 && T < 36;
    // the words, far ahead
    const w = clamp01((T - 30) / 3);
    this.title.position.copy(c).addScaledVector(f, 14).add(_a.set(0, 1.2, 0));
    for (const t of [this.t1, this.t2]) t.material.opacity = w * (T > 41 ? clamp01(1 - (T - 41) / 2) : 1);
  }

  update(dt, t) {
    const G = this.G; this.tl.update(dt);
    // shards flying
    if (this.broken) {
      this.breakT += dt;
      for (const S of this.ch.spheres || []) { if (S.b.k === 'stars') continue; S.shell.visible = S.rings.visible = false; if (S.glints) S.glints.visible = false; }
      const fade = clamp01(1 - (this.breakT - 1.5) / 3);
      this.shardMat.opacity = 0.75 * fade;
      for (let i = 0; i < SHARDS; i++) {
        const q = this.sh[i]; q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 0.3); q.rot.addScaledVector(q.spin, dt);
        _m.compose(q.p, _q.setFromEuler(_e.set(q.rot.x, q.rot.y, q.rot.z)), _s.setScalar(q.size));
        this.shards.setMatrixAt(i, _m);
      }
      this.shards.instanceMatrix.needsUpdate = true;
      if (this.breakT > 5) { this.broken = false; this.shards.visible = false; }
    } else if (this.ch.s?.where === 'hall') for (const S of this.ch.spheres || []) if (S.glints) S.glints.visible = true;
    // the finale
    if (this.finT >= 0) {
      this.finT += dt;
      this.space.update(dt); this.place(this.finT);
      if (this.finT > 44 && !this.ending) { this.ending = true; this.end(); }
    }
  }

  async end() {
    await this.G.ui.fadeOut(1.5);
    this.space.exit(); this.finT = -1; this.title.visible = false;
    await this.G.ui.fadeIn(0.8);
  }

  dispose() { this.space.dispose(); this.shards.parent?.remove(this.shards); this.G.skyFigures.stopAll(); }
}

// Sputnik 1: a shiny ball with four long whip antennas swept back
function makeSputnik() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.29, 24, 16), new THREE.MeshStandardMaterial({ color: 0xe8e8ec, metalness: 0.95, roughness: 0.18, fog: false })));
  const am = new THREE.MeshStandardMaterial({ color: 0xcfcfd4, metalness: 0.9, roughness: 0.3, fog: false });
  for (const [x, y] of [[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 2.6, 4).translate(0, -1.3, 0), am);
    a.position.set(x, y, -0.2); a.rotation.set(-Math.PI / 2 + 0.35, 0, 0); a.rotation.z = Math.atan2(y, x) - Math.PI / 2; a.rotateX(0.3);
    g.add(a);
  }
  const glint = glowSprite(0xffffff, 0.9, 0.5); g.add(glint);
  return g;
}
