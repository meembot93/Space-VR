// The opening, before Chapter 1: you float in the dark among the stars while Astra asks the big
// questions (open_01, open_02). On "This is the story of how we found out" (open_03) hundreds of
// the stars stream together in front of you and spell STARWARD, with the era's name beneath and the
// opening music swelling (sounds/music/index.json "title", else the generated score). Then it fades
// to black and the campfire fades in. About 30 seconds.
//
// Like the flight (js/flight.js), it's its own little scene drawn instead of the world, so Chapter 1
// stays hidden behind it. Comfort: you don't move; the stars turn very slowly around you.
// Plays when the host starts at the first chapter from the title page (not with friends; testing
// addresses with ?chapter= skip it unless they add &opening).
import * as THREE from 'three';
import { ERAS } from './chapters.js';
import { glowTex, ease, clamp01 } from './wow/fx.js';

const N = 2400;          // stars in the sky around you
const WORD = 'STARWARD';
const DIST = 9;          // metres from your eyes to the word
const WIDTH = 7.6;       // how wide the word is, metres (about 45 degrees: well inside the view)
const FORM = 4.5;        // seconds for the stars to fly into the letters

export class Opening {
  constructor(G) {
    this.G = G; this.active = false;
    const S = this.scene = new THREE.Scene();
    S.background = new THREE.Color(0x010208);
    this.rig = new THREE.Group(); S.add(this.rig);
    this.sky = new THREE.Group(); this.rig.add(this.sky);

    // Stars all round you on a big sphere, a few brighter and warmer ones among them
    const pos = this.home = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 15, q = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * q * r, u * r, Math.sin(a) * q * r], i * 3);
      const b = 0.45 + Math.pow(Math.random(), 3) * 0.55;
      c.setHSL(Math.random() < 0.25 ? 0.1 : 0.58 + Math.random() * 0.06, 0.45, b * 0.85); col.set([c.r, c.g, c.b], i * 3);
    }
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.stars.frustumCulled = false; this.sky.add(this.stars);

    // The letters: points sampled from the word drawn on a canvas, in front of you (rig space)
    this.letters = this.wordPoints();
    this.movers = Array.from({ length: this.letters.length / 3 }, (_, k) => Math.floor((k * 7919) % N));
    // the bright "word" stars: their own points, so they can glow brighter than the sky
    const lg = this.wordGeo = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.letters.length), 3));
    this.word = new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.24, map: glowTex(), color: 0xffe6b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.word.frustumCulled = false; this.rig.add(this.word);

    // The era's name under the word
    const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 200;
    const x = cv.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(255,190,110,0.8)'; x.shadowBlur = 18;
    x.font = '76px Georgia, serif'; x.fillStyle = '#ffe2a8'; x.fillText(`Era 1 · ${ERAS[1].title}`, 700, 100);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    this.sub = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6 * 200 / 1400), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false }));
    this.sub.position.set(0, -0.05, -DIST); this.rig.add(this.sub);

    // Its own fade to black
    this.fader = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 1, side: THREE.BackSide, depthTest: false, depthWrite: false }));
    this.fader.renderOrder = 10; S.add(this.fader);
  }

  // The word as points: draw it big on a canvas and keep a dot wherever the letters are
  wordPoints() {
    const W = 1200, H = 220, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 190px Georgia, serif'; g.fillText(WORD, W / 2, H / 2 + 6);
    const d = g.getImageData(0, 0, W, H).data, out = [], step = 7, scale = WIDTH / W;
    for (let y = 0; y < H; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < W; x += step) {
      if (d[(y * W + Math.floor(x)) * 4 + 3] > 128) out.push((x - W / 2) * scale, (H / 2 - y) * scale + 1.15, -DIST);
    }
    return new Float32Array(out);
  }

  // Run it. Resolves when the screen is black again at the end (or straight away if skipped).
  async play() {
    const G = this.G, fast = G.params.has('fast');
    this.place();
    this.t = 0; this.formT = -1; this.fadeTo = 0; this.fade = 1; this.endT = -1; this.active = true;
    this.geo.attributes.position.array.set(this.home); this.geo.attributes.position.needsUpdate = true;
    this.word.material.opacity = 0; this.sub.material.opacity = 0;
    // the subtitles card lives in the world scene: borrow it while the opening is on
    this.subParent = G.ui.sub.parent; this.scene.add(G.ui.sub);
    G.soundscape?.setLevel(0);
    const wait = (s) => new Promise((ok) => setTimeout(ok, s * 1000));
    G.narration.preload('open_');
    await wait(fast ? 0.3 : 2.5);
    await G.narration.say('open_01');
    await G.narration.say('open_02');
    this.formT = this.t;
    G.music.moment('title', 0.6);
    G.audio.swell?.(10);
    await G.narration.say('open_03');
    // hold on the title while the music plays, then fade away
    await new Promise((ok) => { const f = () => (this.t - this.formT > (fast ? 1.5 : FORM + 4) ? ok() : setTimeout(f, 100)); f(); });
    this.fadeTo = 1;
    await new Promise((ok) => { const f = () => (this.fade >= 1 ? ok() : setTimeout(f, 50)); f(); });
    this.active = false;
    this.subParent?.add(G.ui.sub);
    G.soundscape?.setLevel(1);
  }

  // Face the way you're looking (level), at your head
  place() {
    const cam = this.G.camera, d = cam.getWorldDirection(new THREE.Vector3());
    cam.getWorldPosition(this.rig.position); this.rig.rotation.set(0, Math.atan2(-d.x, -d.z), 0);
  }

  update(dt) {
    if (!this.active) return;
    const G = this.G; if (!G.paused) this.t += dt;
    G.camera.getWorldPosition(this.rig.position);
    G.camera.getWorldPosition(this.fader.position);
    // fade in at the start, out at the end
    this.fade += (this.fadeTo > this.fade ? 1 : -1) * dt / (this.fadeTo ? 1.6 : 2.5);
    this.fade = clamp01(this.fade); this.fader.material.opacity = this.fade;
    this.sky.rotation.y = this.t * 0.006;
    if (this.formT < 0) return;
    // the chosen stars fly from their place in the sky into the letters, then twinkle
    const k = (this.t - this.formT) / (G.params.has('fast') ? 1.2 : FORM), p = this.geo.attributes.position.array, w = this.wordGeo.attributes.position.array, L = this.letters;
    this.sky.updateMatrix();
    const v = new THREE.Vector3();
    for (let j = 0; j < this.movers.length; j++) {
      const i = this.movers[j], e = ease(k * 1.25 - (j % 37) / 37 * 0.25);
      v.set(this.home[i * 3], this.home[i * 3 + 1], this.home[i * 3 + 2]).applyMatrix4(this.sky.matrix);
      const x = v.x + (L[j * 3] - v.x) * e, y = v.y + (L[j * 3 + 1] - v.y) * e, z = v.z + (L[j * 3 + 2] - v.z) * e;
      w[j * 3] = x; w[j * 3 + 1] = y + (e >= 1 ? Math.sin(this.t * 2 + j) * 0.004 : 0); w[j * 3 + 2] = z;
      // hide the sky copy of a star once it has left its place
      if (e > 0) { p[i * 3] = 0; p[i * 3 + 1] = -999; p[i * 3 + 2] = 0; }
    }
    this.geo.attributes.position.needsUpdate = true; this.wordGeo.attributes.position.needsUpdate = true;
    this.word.material.opacity = clamp01(k * 4);
    this.word.material.size = 0.24 + 0.08 * Math.max(0, 1 - Math.abs(k - 1) * 3);
    this.sub.material.opacity = clamp01((k - 1) * 2);
  }
}
