// The flight between chapters: when a chapter ends, you glide through the stars along a glowing
// timeline ribbon, past a marker for each chapter, to the next one. As you arrive, its year and
// place appear ("Egypt · about 2500 BC"). About ten seconds, then the new chapter fades in.
//
// Arriving at the star, a little glowing diorama of the next chapter's place grows out of its light
// in front of you and turns slowly on its base for a few seconds (js/dioramas.js), then the chapter
// fades in as before.
//
// It's its own little scene, drawn instead of the world while it plays, so the next chapter can
// be built (in the dark, before the flight) without being seen. Comfort: you move straight ahead,
// slowly and smoothly, never turning, with the ribbon steady under you as a floor to look at.
import * as THREE from 'three';
import { CHAPTERS, ERAS, chapterLabel } from './chapters.js';
import { buildDiorama } from './dioramas.js';
import { glowPoints, textSprite, shimmer } from './wow/fx.js';

// Where and when each chapter happens (shown on the ribbon and on arrival)
export const PLACES = {
  1: { year: '30,000 years ago', place: 'Ice Age France' },
  2: { year: 'about 2500 BC', place: 'Stonehenge, England' },
  3: { year: 'about 2500 BC', place: 'The Nile, Egypt' },
  4: { year: 'about 700 BC', place: 'Babylon' },
  5: { year: 'about 350 BC', place: 'Athens, Greece' },
  6: { year: '1900 AD', place: 'Antikythera, Greece' },
  7: { year: 'about 150 AD', place: 'Alexandria, Egypt' },
  8: { year: '1543', place: 'Frombork, Poland' },
  9: { year: '1572', place: 'Denmark' },
  10: { year: '1600', place: 'Prague' },
  11: { year: '1610', place: 'Padua, Italy' },
  12: { year: '1666', place: 'Woolsthorpe, England' },
  13: { year: '1903 to 1944', place: 'Russia, America, Germany' },
  14: { year: '1957', place: 'Kazakhstan, Soviet Union' },
};
const GAP = 36;     // metres between chapter markers on the ribbon
const DROP = 1.25;  // how far below your eyes the ribbon runs
// The diorama: where it stands in front of you (its base top, metres from your eyes), how big
// (metres per base radius: about 0.9 m across) and how many extra seconds the flight holds for it
const DIO_AT = new THREE.Vector3(0, -0.64, -1.55), DIO_SIZE = 0.44, DIO_HOLD = 4.5;
const DIO_SPIN = 0.11;    // radians a second

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
    this.card.position.set(0, 0.62, -3); this.card.renderOrder = 5; this.rig.add(this.card);

    // The diorama's stage: warm lights (only the diorama is lit in this scene), a soft glow pooled
    // under its base, a sparkle of motes, and the place-and-year plaque. The model itself is built
    // only when needed (play), and thrown away for the next one.
    this.glowMap = glowTex();
    const D = this.dio = new THREE.Group(); D.visible = false; this.rig.add(D);
    this.dioSpin = new THREE.Group(); D.add(this.dioSpin);
    D.add(new THREE.HemisphereLight(0xf6f2ff, 0x3a3448, 1.5));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.2); key.position.set(-1.2, 2.2, 1.6); key.target = D; D.add(key);
    const rim = new THREE.DirectionalLight(0x9ab8ff, 0.9); rim.position.set(1.5, 1.2, -2); rim.target = D; D.add(rim);
    this.dioLamp = new THREE.PointLight(0xffb060, 0.3, 1.4, 1.5); this.dioLamp.position.set(0, 0.2, 0.3); D.add(this.dioLamp);
    this.dioLights = [key, rim, this.dioLamp];
    this.dioPool = new THREE.Mesh(new THREE.CircleGeometry(DIO_SIZE * 1.9, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.dioPool.position.y = -DIO_SIZE * 0.24; this.dioPool.renderOrder = 2; D.add(this.dioPool);
    this.dioHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd08a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.dioHalo.position.set(0, DIO_SIZE * 0.3, -DIO_SIZE * 0.6); this.dioHalo.scale.setScalar(DIO_SIZE * 3.6); D.add(this.dioHalo);
    this.motes = glowPoints(90, { sizeScale: 260 }); this.motes.renderOrder = 3; D.add(this.motes);
    const mr = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647, rr = mr(7);
    this.moteSeeds = Array.from({ length: 90 }, () => ({ a: rr() * Math.PI * 2, r: 0.15 + rr() * 1.0, sp: 0.3 + rr() * 0.6, h: rr(), ph: rr() * 6.3, burst: rr() < 0.6 }));

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
    // crossing into a new era: its name first, then the chapter
    const newEra = info && CHAPTERS.find((c) => c.n === from)?.era !== info.era;
    this.card.material.map = labelTex([[newEra ? `Era ${info.era}: ${ERAS[info.era].title}` : chapterLabel(to), newEra ? 64 : 56, '#ffd98a'], [info?.title || '', 80, '#fff3d6'], [`${newEra ? chapterLabel(to) + ' · ' : ''}${P.place || ''}, ${P.year || ''}`, 52, '#ffd98a']], 1400, 420);
    this.card.material.opacity = 0; this.card.material.needsUpdate = true;
    this.fade = 1; this.active = true; this.chimed = false;
    this.setupDiorama(to);
    G.soundscape?.setLevel(0);
    // the flight's own music, if Meem's track is listed in sounds/music/index.json ("flight", and
    // "flight_era" for the flight into a new era); it fades as the next chapter starts
    G.music.ready.then(() => { const f = (newEra && G.music.files.flight_era) || G.music.files.flight; if (f && this.active) G.music.sting(f, 0.7); });
    const A = G.audio;
    if (A.ctx) {
      // a soft rushing sound for the glide, and a warm swell
      const o = A.out(null, 0.25);
      A.noise(o, { type: 'bandpass', f: 300, f2: 1400, q: 0.8, peak: 0.35, a: secs * 0.4, d: secs * 0.55 });
      A.swell(secs + (this.hold || 0) + 2);
    }
    return new Promise((ok) => { this.done = ok; });
  }

  // Build the next chapter's diorama (only that one), throwing away the last
  setupDiorama(n) {
    if (this.dioModel) {
      for (const c of this.dioModel.children) c.material.dispose();
      this.dioSpin.remove(this.dioModel); this.dioModel.geometry.dispose(); this.dioModel = null;
    }
    if (this.dioLabel) { this.dio.remove(this.dioLabel); this.dioLabel.material.map.dispose(); this.dioLabel.material.dispose(); this.dioLabel = null; }
    this.hold = 0; this.dio.visible = false; this.dioShown = false;
    let d = null;
    try { d = buildDiorama(n); } catch (e) { console.error(e); }
    if (!d) return;
    this.dioModel = d.mesh; d.mesh.scale.setScalar(DIO_SIZE); this.dioSpin.add(d.mesh);
    for (const [x, y, z, c, s] of d.glows) {
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowMap, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      g.position.set(x, y, z); g.scale.setScalar(s); g.userData.o = 0.9; d.mesh.add(g);
    }
    if (d.label) {
      this.dioLabel = textSprite(d.label, 0.06, { color: '#ffe6b8', glow: 'rgba(255,190,110,0.8)' });
      this.dioLabel.position.set(0, -DIO_SIZE * 0.5, DIO_SIZE * 1.3); this.dio.add(this.dioLabel);
    }
    this.dioTris = d.tris;
    this.hold = this.G.params.has('fast') ? 0.6 : DIO_HOLD;
  }

  // The diorama at real time t since the flight began: it grows out of the star's light as you
  // arrive, sparkles, turns slowly, and fades away with the fade to black
  updateDiorama(dt, markZ) {
    const D = this.dio, s = this.secs, t0 = s * 0.6, grow = s * 0.2;
    if (!this.dioModel || this.t < t0) { D.visible = false; return; }
    D.visible = true;
    const g = Math.min(1, (this.t - t0) / grow), e = ease(g), end = this.secs + this.hold;
    const out = Math.max(0, Math.min(1, (this.t - (end - s * 0.14)) / (s * 0.12)));   // fade at the very end
    // from the star (far down the ribbon) to its place in front of you
    D.position.set(0, -DROP + 0.05, markZ).lerp(DIO_AT, e);
    D.scale.setScalar(Math.max(0.02, e * (1 - 0.15 * out)));
    this.dioSpin.rotation.y = -0.45 + (this.t - t0) * DIO_SPIN;
    const vis = Math.min(1, g * 1.6) * (1 - out);
    const M = this.dioModel.material;
    M.transparent = vis < 0.999; M.opacity = vis; M.depthWrite = vis > 0.5;
    for (const c of this.dioModel.children) c.material.opacity = c.userData.o * vis * (0.85 + 0.15 * Math.sin(this.t * 7 + c.position.x * 9));
    for (const L of this.dioLights) L.visible = vis > 0.01;
    this.dioPool.material.opacity = 0.55 * vis;
    this.dioHalo.material.opacity = 0.22 * vis + 0.5 * Math.max(0, 1 - Math.abs(g - 0.55) * 3) * (1 - out);   // a flash as it blooms
    if (this.dioLabel) this.dioLabel.material.opacity = Math.max(0, Math.min(1, (g - 0.7) / 0.3)) * (1 - out);
    // motes: a burst outward as it blooms, then a slow drift upward round it
    const P = this.motes.userData, tt = this.t - t0;
    this.moteSeeds.forEach((m, i) => {
      const b = m.burst ? Math.min(1, tt / (grow * 1.2)) : 0, rad = (m.burst ? 0.1 + b * m.r : m.r * 0.6) * DIO_SIZE * 1.4;
      const a = m.a + tt * 0.25 * m.sp, y = m.burst ? (0.2 + m.h * 0.6) * DIO_SIZE * b + 0.2 * b * b : ((m.h + tt * 0.06 * m.sp) % 1) * DIO_SIZE * 1.6;
      P.pos[i * 3] = Math.cos(a) * rad; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = Math.sin(a) * rad;
      const f = (m.burst ? Math.max(0, 1 - b * b) : Math.min(1, tt / grow) * (0.4 + 0.6 * Math.abs(Math.sin(this.t * 2 * m.sp + m.ph)))) * (1 - out);
      P.col[i * 3] = 1 * f; P.col[i * 3 + 1] = 0.82 * f; P.col[i * 3 + 2] = 0.5 * f;
      P.size[i] = m.burst ? 0.012 : 0.008;
    });
    P.commit();
    if (!this.dioShown && g > 0) { this.dioShown = true; shimmer(this.G, 2.5, 0.12); }
  }

  update(dt) {
    if (!this.active) return;
    const G = this.G; this.t += this.freeze ? 0 : dt;
    // the flight's own clock: it pauses at the star while the diorama is shown (this.hold seconds)
    const gEnd = this.secs * 0.8;
    const ft = this.t < gEnd ? this.t : this.t < gEnd + this.hold ? gEnd : this.t - this.hold;
    const k = ft / this.secs;
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
    // the ribbon dims while the diorama is shown, so the little world stands out
    this.ribbonMat.uniforms.uFade.value = 1 - 0.6 * (this.dio.visible ? Math.min(1, (this.t - this.secs * 0.6) / (this.secs * 0.2)) : 0);
    this.updateDiorama(dt, z - GAP * (this.to - 1));
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
