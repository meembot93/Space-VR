// The frame every Era 3 chapter is built on. A chapter is a string of places (scenes): the
// training yard, the pad, the cabin, space, Houston... Each scene is its own group, with its own
// ground, sky and update; only one shows at a time and you're moved between them with a fade.
//
//   class Gagarin extends Chapter3 {
//     constructor(G) { super(G, 16); this.addScene('pad', { group, height, bounds, place, sky, update }); ... }
//     async run(D) { await this.go(D, 'pad', yaw); await D.say('ch16_01'); ... }
//   }
//
// Also here: hands-on moments that play themselves in Kids mode (touch/ask), a gentle shake for
// launches (a centimetre or two, never more: comfort), the faded-film look for flashbacks to
// 1962, a 1960s TV picture, the journal page at the end, and Astra's place (s.guide).
import * as THREE from 'three';
import { Journal, guideUpdate, label } from '../era2/common.js';
import { Life } from '../life.js';
import { canvasTex, damp } from '../util.js';
import { animate } from './folk.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
export const D2R = Math.PI / 180;
export const yawTo = (bearing) => -bearing * D2R;           // placePlayers yaw for a compass bearing (0 = north = -z)
export const bearing = (dx, dz) => (Math.atan2(dx, -dz) / D2R + 360) % 360;

export class Chapter3 {
  constructor(G, n) {
    this.G = G; this.n = n;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.scenes = {}; this.cur = null;
    this.s = { scene: null, phase: 'start', guide: null, journal: 0, want: null, done: {}, shake: 0 };
    this.t = 0; this.F = G.params.has('fast') ? 4 : 1; this.fast = G.params.has('fast');
    this.life = new Life(this.root);
    this.people = [];        // everyone animated each frame (people.js or folk.js figures)
    this.start = { pos: new THREE.Vector3(), yaw: 0 };
    // lights on the root, so their number never changes (no stutter when scenes switch)
    this.key = new THREE.DirectionalLight(0xffffff, 0); this.root.add(this.key, this.key.target);
    this.lamp = new THREE.PointLight(0xffe8c8, 0, 12, 1.4); this.root.add(this.lamp);
    this.lamp2 = new THREE.PointLight(0xffe8c8, 0, 12, 1.4); this.root.add(this.lamp2);
    this.flameLight = new THREE.PointLight(0xff9a40, 0, 0, 1.15); this.root.add(this.flameLight);
    this.film = new Film(G);
  }

  // ---------- Places ----------
  // def: { group, height(x, z), bounds, place: { lat, year, sunLon }, sky(dt, t), update(dt, t), enter(), exit(),
  //        amb (wind 0..1), fogFar, mist, indoors (no pointing at stars), space: a Space to show (it hides the sky's Sun and Moon) }
  addScene(name, def) {
    const g = def.group || new THREE.Group(); g.visible = false; if (!g.parent) this.root.add(g);
    this.scenes[name] = { name, height: () => 0, bounds: 4, amb: 0.4, fogFar: 2500, mist: 0, ...def, group: g };
    return g;
  }
  setScene(name) {
    const G = this.G, S = this.scenes[name]; if (!S) return;
    const was = this.scenes[this.cur];
    if (was && was !== S) { was.group.visible = false; was.exit?.(); if (was.space) was.space.exit(); }
    this.cur = name; S.group.visible = true;
    G.world.height = S.height; G.world.bounds = S.bounds; G.world.blockers = S.blockers || []; G.world.center = null;
    G.sky.fogFar = S.fogFar; G.sky.mist = S.mist; G.audio.amb = S.amb;
    if (S.place) G.sky.setPlace(S.place);
    if (S.space) S.space.enter(null);
    G.sky.indoors = !!S.indoors;   // no star-pointing under a roof
    G.sky.hideMoon?.();   // each scene shows its own Moon (sky() sets it every frame)
    this.key.intensity = 0; this.lamp.intensity = 0; this.lamp2.intensity = 0; this.flameLight.intensity = 0;
    S.enter?.();
  }
  // Fade out, move to a place (pos: where you stand in it), fade in
  async go(D, name, yaw = 0, secs = 0.8, pos = { x: 0, z: 0 }) {
    const G = this.G, s = this.s;
    await G.ui.fadeOut(secs); D.check();
    s.scene = name; s.guide = null; this.setScene(name); G.world.center = { x: pos.x, z: pos.z };
    G.events.emit('placePlayers', { x: pos.x, z: pos.z, yaw });
    await G.ui.fadeIn(secs * 1.4); D.check();
  }
  // a line for Kids mode or for Adults mode
  pick(D, kidsId, adultsId) { return D.kids ? kidsId : adultsId; }

  // ---------- Hands-on moments (Adults), played by themselves in Kids mode ----------
  // where: an Object3D (or a function giving a world point); r: how close counts as touching
  touchable(key, where, { hint, deskHint, r = 0.4, grab = true } = {}) {
    const G = this.G, self = this;
    const pos = (out) => (typeof where === 'function' ? out.copy(where()) : where.getWorldPosition(out));
    const it = {
      hint, deskHint: deskHint || hint,
      get disabled() { return self.s.want !== key; },
      reach(p) { return Math.max(0, p.distanceTo(pos(_a)) - r); },
      aim(o, d) { pos(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < r + 0.1 ? t : Infinity; },
      onTouch() { G.act({ type: 'touch', key }); }, onGrab() { if (grab) G.act({ type: 'touch', key }); },
    };
    G.interactables.push(it);
    return it;
  }
  // Ask for a hands-on moment: Astra's hint; Adults wait for the touch (up to timeout s); Kids
  // watch it happen by itself after `after` s (step(dt) runs each frame until done, then done).
  async ask(D, key, { hint, deskHint, after = 1.5, timeout = 25, step = null } = {}) {
    const G = this.G, s = this.s;
    s.want = key; s.done[key] = false;
    if (hint) D.hint(G.mode === 'desktop' ? (deskHint || hint) : hint, Math.min(timeout, 12));
    await D.auto(() => s.done[key], step || (() => { s.done[key] = true; }), { after: this.fast ? 0.3 : after, timeout: this.fast ? 2 : timeout });
    s.done[key] = true; s.want = null; G.ui.showHint('');
  }
  act(a) {
    if (a.type === 'touch' && this.s.want === a.key) { this.s.done[a.key] = true; this.G.audio.chime?.(null, 0.3); for (const h of this.G.player.hands || []) this.G.player.haptic(h, 0.5, 80); return true; }
    return this.journal?.act(a) || false;
  }
  getState() { return this.s; }
  setState(st) { const was = this.s.scene; Object.assign(this.s, st); if (st.scene && st.scene !== was) this.setScene(st.scene); }

  // Astra hovers by something: a world point [x, y, z] (or null to come back to your side)
  guideTo(obj, up = 0.6, side = 0.6) {
    if (!obj) { this.s.guide = null; return; }
    const p = obj.isVector3 ? obj.clone() : obj.getWorldPosition(new THREE.Vector3());
    this.G.camera.getWorldPosition(_a); _b.subVectors(p, _a).setY(0).normalize();
    p.add(_c.set(-_b.z * side, up, _b.x * side));
    this.s.guide = p.toArray();
  }
  // a little shake (launches, a bang): amt in metres (keep it at 0.02 or less), fading over secs
  shake(amt, secs = 1) { this.shakeAmt = Math.max(this.shakeAmt || 0, amt); this.shakeFade = amt / Math.max(0.1, secs); for (const h of this.G.player.hands || []) this.G.player.haptic(h, Math.min(1, amt * 50), secs * 1000); }

  // ---------- Every frame ----------
  update(dt, t) {
    const G = this.G, s = this.s;
    this.t += dt;
    if (s.scene && s.scene !== this.cur) this.setScene(s.scene);
    const S = this.scenes[this.cur];
    if (S) { try { S.sky?.(dt, t); S.update?.(dt, t); } catch (e) { console.error(e); } S.space?.update(dt); }
    // everyone in the scene you're in (found once per scene), and anyone listed in this.people
    if (S && !S.folk) { S.folk = new Set(); S.group.traverse((o) => { if (o.userData.person) S.folk.add(o.userData.person); }); }
    const seen = S?.folk || new Set();
    for (const P of seen) if (P.g.visible) animate(P, t, dt);
    for (const P of this.people) if (!seen.has(P) && P.g.visible && (P.g.parent?.visible ?? true)) animate(P, t, dt);
    this.life.update(dt, t);
    // the shake moves the world a little under you (never you)
    if (this.shakeAmt > 0.0005 || s.rumble) {
      const a = Math.max(this.shakeAmt || 0, s.rumble || 0);
      this.root.position.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      this.shakeAmt = Math.max(0, (this.shakeAmt || 0) - (this.shakeFade || 0.01) * dt);
      if (s.rumble && (this.rumbleT = (this.rumbleT || 0) - dt) <= 0) { this.rumbleT = 0.15; for (const h of G.player.hands || []) G.player.haptic(h, Math.min(1, s.rumble * 40), 160); }
    } else this.root.position.set(0, 0, 0);
    this.film.update(dt, t, s.film ? 1 : 0);
    const busy = this.journal ? this.journal.update() : false;
    guideUpdate(this, busy);
  }

  dispose() {
    this.G.world.center = null; this.G.sky.indoors = false;
    const G = this.G;
    for (const S of Object.values(this.scenes)) { S.space?.dispose(); S.dispose?.(); }
    this.film.dispose();
    G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    G.world.blockers = [];
    G.music?.stopSting?.(2);
  }
}

// ---------- The faded-film look (flashbacks to Rice Stadium, 1962) ----------
// A quad just in front of your eyes that multiplies the view by a warm, faded tone with a dark
// edge, flickers like an old projector, and drifts specks and scratches across it.
const FILM_FS = `uniform float amt, t; varying vec2 vUv;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){ vec2 c = vUv - 0.5; float v = 1.0 - smoothstep(0.28, 0.75, length(c * vec2(1.25, 1.0)));
    float fl = 0.93 + 0.07 * h(vec2(floor(t * 18.0), 1.0));
    vec3 tone = mix(vec3(1.0), vec3(1.08, 0.92, 0.7) * fl, amt);
    float grain = (h(vUv * 400.0 + floor(t * 24.0)) - 0.5) * 0.18 * amt;
    float sx = fract(0.3 + floor(t * 3.0) * 0.37); float scr = smoothstep(0.0015, 0.0, abs(vUv.x - sx)) * 0.5 * amt * step(0.6, h(vec2(floor(t * 3.0), 3.0)));
    float speck = step(0.9993, h(floor(vUv * 220.0) + floor(t * 12.0))) * 0.7 * amt;
    gl_FragColor = vec4(tone * mix(1.0, v * 0.85 + 0.15, amt) + grain - scr - speck, 1.0); }`;
class Film {
  constructor(G) {
    this.G = G; this.k = 0;
    this.mat = new THREE.ShaderMaterial({ uniforms: { amt: { value: 0 }, t: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FILM_FS, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendEquation: THREE.AddEquation });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), this.mat); this.quad.position.z = -0.2; this.quad.renderOrder = 999; this.quad.visible = false; this.quad.frustumCulled = false;
    G.camera.add(this.quad); if (!G.camera.parent) G.scene.add(G.camera);
  }
  update(dt, t, on) { this.k = damp(this.k, on, 2.5, dt); this.mat.uniforms.amt.value = this.k; this.mat.uniforms.t.value = t; this.quad.visible = this.k > 0.01; }
  dispose() { this.G.camera.remove(this.quad); this.mat.dispose(); this.quad.geometry.dispose(); }
}

// ---------- A 1960s television picture ----------
// draw(g, w, h, t) paints the picture each time it's refreshed (about 12 times a second); the set
// adds the grey, ghostly look: scanlines, a soft roll, snow, and rounded corners.
export class TVPicture {
  constructor(w = 1.0, h = 0.75, draw, { color = false } = {}) {
    this.c = document.createElement('canvas'); this.c.width = 320; this.c.height = 240; this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.draw = draw; this.color = color; this.acc = 1; this.on = true;
  }
  update(dt, t) {
    if (!this.mesh.visible || !this.mesh.parent?.visible) return;
    this.acc += dt; if (this.acc < 1 / 12) return; this.acc = 0;
    const g = this.g, W = 320, H = 240;
    g.fillStyle = '#101210'; g.fillRect(0, 0, W, H);
    if (this.on) { g.save(); this.draw(g, W, H, t); g.restore(); }
    // grey it, blur it a little, add the snow and the scanlines
    if (!this.color) { g.globalCompositeOperation = 'saturation'; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 1); }
    g.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = (t * 30) % 3; y < H; y += 3) g.fillRect(0, y, W, 1);
    const roll = (t * 0.07) % 1; g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, roll * H, W, 18);
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    this.tex.needsUpdate = true;
  }
}
// A wooden 1960s TV set with the picture in it (front = +z). Returns { g, pic }
export function tvSet(draw, { w = 0.62, legs = true, color = false } = {}) {
  const g = new THREE.Group(), h = w * 0.78, d = w * 0.7;
  const wood = new THREE.MeshLambertMaterial({ color: 0x6a4428 }), dark = new THREE.MeshLambertMaterial({ color: 0x1a1816 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(w * 1.25, h * 1.12, d), wood); box.position.y = h * 0.56 + (legs ? 0.45 : 0); g.add(box);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.86, 0.02), dark); bezel.position.set(-w * 0.08, box.position.y, d / 2 + 0.005); g.add(bezel);
  for (let i = 0; i < 2; i++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10).rotateX(Math.PI / 2), dark); k.position.set(w * 0.5, box.position.y + 0.08 - i * 0.16, d / 2 + 0.02); g.add(k); }
  if (legs) for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.46, 6), dark); l.position.set(x * w * 0.5, 0.23, z * d * 0.35); l.rotation.z = -x * 0.12; g.add(l); }
  // rabbit-ear aerial
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), dark); a.position.set(s * 0.12, box.position.y + h * 0.56 + 0.22, 0); a.rotation.z = s * 0.5; g.add(a); }
  const pic = new TVPicture(w * 0.9, h * 0.8, draw, { color }); pic.mesh.position.set(-w * 0.08, box.position.y, d / 2 + 0.02); g.add(pic.mesh);
  return { g, pic };
}

// Labels that face you and fade (era2 label), re-exported for the chapters
export { label, Journal };
