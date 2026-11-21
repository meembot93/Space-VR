// The flight between chapters: when a chapter ends, you glide through the stars along a glowing
// timeline ribbon, past a marker for each chapter, to the next one. As you arrive, its year and
// place appear ("Egypt · about 2500 BC"). About ten seconds, then the new chapter fades in.
//
// It's its own little scene, drawn instead of the world while it plays, so the next chapter can
// be built (in the dark, before the flight) without being seen. Comfort: you move straight ahead,
// slowly and smoothly, never turning, with the ribbon steady under you as a floor to look at.
import * as THREE from 'three';
import { CHAPTERS } from './chapters.js';

// Where and when each chapter happens (shown on the ribbon and on arrival)
export const PLACES = {
  1: { year: '30,000 years ago', place: 'Ice Age France' },
  2: { year: 'about 2500 BC', place: 'Stonehenge, England' },
  3: { year: 'about 2500 BC', place: 'The Nile, Egypt' },
  4: { year: 'about 700 BC', place: 'Babylon' },
  5: { year: 'about 350 BC', place: 'Athens, Greece' },
  6: { year: '1901 AD', place: 'Antikythera, Greece' },
  7: { year: 'about 150 AD', place: 'Alexandria, Egypt' },
};
const GAP = 36;     // metres between chapter markers on the ribbon
const DROP = 1.25;  // how far below your eyes the ribbon runs

function labelTex(lines, w = 1024, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = 1 / lines.length;
  lines.forEach(([text, size, color], i) => {
    // shrink the words until they fit, with a margin, so nothing is ever cut off at the sides
    let fs = size; g.font = `${fs}px Georgia, serif`;
    while (fs > 20 && g.measureText(text).width > w * 0.9) { fs -= 2; g.font = `${fs}px Georgia, serif`; }
    g.fillStyle = color; g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 12;
    g.fillText(text, w / 2, h * step * (i + 0.5));
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,230,170,0.8)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export class Flight {
  constructor(G) {
    this.G = G; this.active = false;
    const S = this.scene = new THREE.Scene();
    S.background = new THREE.Color(0x02030a);
    this.rig = new THREE.Group(); S.add(this.rig);      // placed at your head, facing where you look
    this.track = new THREE.Group(); this.rig.add(this.track); // slides toward you as you fly

    // Stars all around, in a long tube; they wrap round so they never run out
    const N = 2600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.pow(Math.random(), 0.6) * 70;
      pos.set([Math.cos(a) * r, Math.sin(a) * r * 0.8, -Math.random() * 300], i * 3);
      c.setHSL(0.55 + Math.random() * 0.12, 0.4, 0.6 + Math.random() * 0.4); if (Math.random() < 0.2) c.setHSL(0.1, 0.6, 0.75);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.starPos = pos;
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.22, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.stars.frustumCulled = false; this.rig.add(this.stars);

    // The timeline ribbon: a soft golden band with light flowing along it
    const len = GAP * (CHAPTERS.length + 3);
    this.ribbonMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uFade: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; varying float vZ; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vZ = position.y; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float uT; uniform float uFade; varying vec2 vUv; varying float vZ;
        void main(){ float edge = 1.0 - abs(vUv.x - 0.5) * 2.0; float core = pow(edge, 3.0);
          float flow = 0.5 + 0.5 * sin(vZ * 0.9 + uT * 3.0);
          vec3 col = mix(vec3(1.0, 0.72, 0.3), vec3(1.0, 0.95, 0.8), core) * (0.25 + 0.6 * core + 0.25 * flow * edge);
          gl_FragColor = vec4(col * uFade, edge * uFade); }`,
    });
    const rib = new THREE.Mesh(new THREE.PlaneGeometry(1.4, len, 1, 1).rotateX(-Math.PI / 2).translate(0, -DROP, -len / 2 + GAP * 1.5), this.ribbonMat);
    rib.frustumCulled = false; this.track.add(rib);

    // A marker and a label for every chapter
    const glow = glowTex();
    this.marks = [];
    for (const ch of CHAPTERS) {
      const P = PLACES[ch.n] || { year: '', place: '' }, z = -GAP * (ch.n - 1);
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffe2a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(0, -DROP + 0.05, z); m.scale.setScalar(1.2); this.track.add(m);
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: labelTex([[P.year, 74, '#ffd98a'], [P.place, 62, '#e8f0ff']]), transparent: true, depthWrite: false }));
      lab.position.set(ch.n % 2 ? -1.5 : 1.5, -DROP + 0.55, z); lab.rotation.y = ch.n % 2 ? 0.35 : -0.35; this.track.add(lab);
      this.marks.push({ n: ch.n, m, lab });
    }

    // The arrival card, floating ahead: "Chapter 3 / Sirius over the Nile / The Nile, Egypt, about 2500 BC".
    // About 35 degrees wide, so it sits well inside the headset's view.
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.6), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
    this.card.position.set(0, 0.45, -3); this.card.renderOrder = 5; this.rig.add(this.card);

    // Its own fade to black (the world's fader isn't in this scene)
    this.fader = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 1, side: THREE.BackSide, depthTest: false, depthWrite: false }));
    this.fader.renderOrder = 10; S.add(this.fader);
  }

  // Fly from chapter `from` to chapter `to`. Resolves when the screen is black again at the end.
  play(from, to, secs = 10) {
    const G = this.G, P = PLACES[to] || {}, info = CHAPTERS.find((c) => c.n === to);
    if (G.params.has('fast')) secs = 2;
    // face the way you're looking, level
    const cam = G.camera, p = cam.getWorldPosition(new THREE.Vector3()), d = cam.getWorldDirection(new THREE.Vector3());
    this.rig.position.copy(p); this.rig.rotation.set(0, Math.atan2(-d.x, -d.z), 0);
    this.from = from; this.to = to; this.t = 0; this.secs = secs;
    this.card.material.map?.dispose();
    this.card.material.map = labelTex([[`Chapter ${to}`, 56, '#ffd98a'], [info?.title || '', 80, '#fff3d6'], [`${P.place || ''}, ${P.year || ''}`, 56, '#ffd98a']], 1400, 420);
    this.card.material.opacity = 0; this.card.material.needsUpdate = true;
    this.fade = 1; this.active = true; this.chimed = false;
    G.soundscape?.setLevel(0);
    const A = G.audio;
    if (A.ctx) {
      // a soft rushing sound for the glide, and a warm swell
      const o = A.out(null, 0.25);
      A.noise(o, { type: 'bandpass', f: 300, f2: 1400, q: 0.8, peak: 0.35, a: secs * 0.4, d: secs * 0.55 });
      A.swell(secs + 2);
    }
    return new Promise((ok) => { this.done = ok; });
  }

  update(dt) {
    if (!this.active) return;
    const G = this.G; this.t += dt;
    const k = this.t / this.secs;
    // fade in over the first second, out over the last
    this.fade = k < 0.12 ? 1 - k / 0.12 : k > 0.9 ? (k - 0.9) / 0.1 : 0;
    this.fader.material.opacity = Math.min(1, this.fade);
    G.camera.getWorldPosition(this.fader.position);
    // glide from one marker to the next, easing in and out (start a little before the old one)
    const z0 = GAP * (this.from - 1) - 6, z1 = GAP * (this.to - 1) - 4.5;
    const z = z0 + (z1 - z0) * ease(Math.min(1, k / 0.8));
    this.track.position.z = z;
    // stars drift past (a little faster than the ribbon, they're far away... it reads as depth)
    const sp = this.starPos, move = (z1 - z0) / (this.secs * 0.8) * dt * (k < 0.8 ? 1.4 * Math.sin(Math.PI * Math.min(1, k / 0.8)) : 0.05);
    for (let i = 2; i < sp.length; i += 3) { sp[i] += move; if (sp[i] > 10) sp[i] -= 300; }
    this.stars.geometry.attributes.position.needsUpdate = true;
    this.ribbonMat.uniforms.uT.value = this.t;
    // the marker you're heading for glows brighter; its card appears as you arrive
    for (const M of this.marks) M.m.scale.setScalar(M.n === this.to ? 1.4 + 0.25 * Math.sin(this.t * 4) : 0.9);
    this.card.material.opacity = Math.max(0, Math.min(1, (k - 0.6) / 0.12)) * (1 - Math.max(0, (k - 0.9) / 0.1));
    if (k > 0.7 && !this.chimed) { this.chimed = true; G.audio.ctx && G.audio.chime(null, 0.3); }
    if (k >= 1) {
      this.active = false; G.soundscape?.setLevel(1);
      const d = this.done; this.done = null; d?.();
    }
  }
}
