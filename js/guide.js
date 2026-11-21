// The guide, Astra: a small glowing star with friendly eyes that floats out in front of you through
// every chapter. Every narration line is the guide talking (in Meem's voice), so it glows brighter
// while it speaks. Chapters can send it to hover by something (flyTo) and call it back (follow).
//
// Looks: Meem's Tripo model star_guide.glb once it's listed in models/index.json; until then
// a stand-in star built here in code (same size and colours).
import * as THREE from 'three';
import { loadModel } from './models.js';
import { damp, clamp } from './util.js';

const SIZE = 0.3; // metres across, about a basketball (it looks bigger further away, see update)
const AHEAD = 7;     // when it's just keeping you company: about 7 m (23 ft) out in front of you
const SIDE = -9;     // ...a little left of straight ahead (degrees), so it never hides what you're looking at
const LAZY = 32;     // it only moves round to your front again once you turn more than this (degrees) away
const D2R = Math.PI / 180;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,190,0.9)'); gr.addColorStop(0.3, 'rgba(255,210,120,0.35)'); gr.addColorStop(1, 'rgba(255,190,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// The stand-in star: a plump, rounded five-pointed star, warm gold, with eyes and a smile
function buildStandIn() {
  const g = new THREE.Group();
  const sh = new THREE.Shape(), R = 0.5, r = 0.27, pts = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
    pts.push(new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad));
  }
  // Round every corner so the points look plump and soft
  const P = (i) => pts[(i + 10) % 10];
  sh.moveTo(P(0).clone().lerp(P(1), 0.3).x, P(0).clone().lerp(P(1), 0.3).y);
  for (let i = 1; i <= 10; i++) {
    const a = P(i).clone().lerp(P(i - 1), 0.3), b = P(i).clone().lerp(P(i + 1), 0.3);
    sh.lineTo(a.x, a.y); sh.quadraticCurveTo(P(i).x, P(i).y, b.x, b.y);
  }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.1, bevelSegments: 4, curveSegments: 4 });
  geo.translate(0, 0, -0.06); geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xffb83a, emissiveIntensity: 0.9, roughness: 0.6, metalness: 0 }));
  g.add(body);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x2a1a10 }), shineM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), eyeM);
    eye.scale.set(0.8, 1.15, 0.45); eye.position.set(sx * 0.11, 0.04, 0.19); g.add(eye);
    const sh2 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), shineM); sh2.position.set(sx * 0.11 + 0.025, 0.08, 0.225); g.add(sh2);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 6, 12, Math.PI * 0.8), eyeM);
  smile.rotation.z = Math.PI + Math.PI * 0.1; smile.position.set(0, -0.07, 0.2); g.add(smile);
  g.scale.setScalar(SIZE);
  g.userData.body = body;
  return g;
}

export class Guide {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group();          // position in the world
    this.root.userData.kind = 'characters';
    this.bob = new THREE.Group(); this.root.add(this.bob);
    this.look = buildStandIn(); this.bob.add(this.look);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.halo.scale.setScalar(SIZE * 3.2); this.bob.add(this.halo);
    G.scene.add(this.root);
    this.mode = 'follow';  // 'follow' (out in front of you) or 'at' (hovering by something)
    this.target = new THREE.Vector3();
    this.lookTarget = null;
    this.homeYaw = null;   // the direction (from you) it rests in while following
    this.placed = false;
    this.speed = 2.2;
    this.glow = 0;
    // Swap in Meem's model as soon as it exists
    loadModel('star_guide').then((m) => {
      if (!m) return;
      this.bob.remove(this.look);
      this.look = new THREE.Group(); this.look.add(m.scene); this.bob.add(this.look);
      this.model = m;
      m.scene.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); if ('emissive' in o.material) { o.material.emissive.setHex(0xffb040); o.material.emissiveIntensity = 0.35; o.material.emissiveMap = o.material.map; } } });
    });
  }

  // Hover next to a point in the world (e.g. the stone, the gap) and face `lookAt` (or you)
  flyTo(pos, lookAt = null) { this.mode = 'at'; this.target.copy(pos); this.lookTarget = lookAt ? lookAt.clone() : null; }
  follow() { this.mode = 'follow'; this.lookTarget = null; this.homeYaw = null; }
  // Snap straight to its spot in front of you (start of a chapter)
  place() { this.placed = false; this.homeYaw = null; }
  chime() { this.G.audio.chime(this.root.position); }

  update(dt) {
    const G = this.G, cam = G.camera;
    cam.getWorldPosition(_a); cam.getWorldDirection(_b); _b.y = 0;
    if (_b.lengthSq() < 1e-4) _b.set(0, 0, -1); _b.normalize();
    let goal = _c;
    if (this.mode === 'follow') {
      // Out in front of you, a little above the horizon. It doesn't chase every small head turn:
      // only when you look well away does it drift round to your new front.
      const headYaw = Math.atan2(_b.x, -_b.z);
      const off = this.homeYaw == null ? Infinity : Math.abs(((headYaw - this.homeYaw) / D2R + 540) % 360 - 180);
      if (off > LAZY) this.homeYaw = headYaw + SIDE * D2R;
      goal.set(Math.sin(this.homeYaw), 0, -Math.cos(this.homeYaw)).multiplyScalar(AHEAD).add(_a);
      goal.y = _a.y + 0.45;
      const gh = G.world.height ? G.world.height(goal.x, goal.z) : 0;
      if (goal.y < gh + 1.2) goal.y = gh + 1.2;
    } else goal.copy(this.target);
    if (!this.placed) { this.root.position.copy(goal); this.placed = true; }
    // Glide there, without overshooting
    const d = this.root.position.distanceTo(goal);
    const k = 1 - Math.exp(-dt * (this.mode === 'follow' ? 1.4 : 1.6));
    if (d > 0.001) {
      const step = Math.min(d * k, this.speed * 3 * dt + d * 0.02);
      this.root.position.lerp(goal, step / d);
    }
    // Bigger the further away it is, so it's always easy to see (normal size up close)
    const far = this.root.position.distanceTo(_a);
    this.root.scale.setScalar(damp(this.root.scale.x, clamp(far / 2.4, 1, 4), 3, dt));
    // Gentle floating
    const t = G.t;
    this.bob.position.y = Math.sin(t * 1.7) * 0.03;
    this.bob.rotation.z = Math.sin(t * 1.1) * 0.12;
    // Face you (or what it's showing you), turning smoothly
    const lt = this.lookTarget || _a;
    _m.lookAt(lt, this.root.position, THREE.Object3D.DEFAULT_UP);
    _q.setFromRotationMatrix(_m);
    this.root.quaternion.slerp(_q, 1 - Math.exp(-dt * 4));
    // Glow with the voice
    const lv = G.narration ? G.narration.level : 0;
    this.glow = damp(this.glow, lv, 12, dt);
    const pulse = 1 + this.glow * 0.25 + Math.sin(t * 2.3) * 0.03;
    this.halo.scale.setScalar(SIZE * 3.2 * pulse);
    this.halo.material.opacity = clamp(0.55 + this.glow * 0.5, 0, 1);
    this.look.scale.setScalar(1 + this.glow * 0.06);
    const body = this.look.userData.body;
    if (body) body.material.emissiveIntensity = 0.75 + this.glow * 0.9;
  }
}
