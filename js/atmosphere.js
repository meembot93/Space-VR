// Weather and light: the air itself. Added on top of each chapter without changing it.
//   - Golden-hour haze: around sunrise and sunset, the far distance glows warm toward the Sun and
//     cool away from it (one soft see-through ring round you, read from the sky's Sun position).
//   - Ground mist: soft sheets lying low over the Nile's fields, the Euphrates and Salisbury Plain,
//     drifting slowly, burning off as the Sun climbs.
//   - Sea breeze: specks of salt spray and dust carried past you on the wind, in gusts (Athens,
//     Alexandria, the sponge boat), with the breeze in your ears.
//   - Firelight: fire and lamp lights shift and sway a little as well as flicker, so light moves
//     across faces the way real flames do.
//   - Dust in the sunbeams of Ptolemy's hall.
// Like js/soundscape.js it reads a chapter's state but never changes the chapter's story.
// Budget: at most a few hundred extra triangles and 3-4 draw calls per chapter.
import * as THREE from 'three';
import { dirFromAzEl } from './sky.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Color();
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- Golden-hour haze ----------
function makeHaze() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { sunDir: { value: new THREE.Vector3(1, 0, 0) }, warm: { value: new THREE.Color(1, 0.55, 0.3) }, cool: { value: new THREE.Color(0.45, 0.4, 0.65) }, amt: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
    vertexShader: 'varying vec3 vP; varying float vY; void main(){ vP = normalize(position); vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 sunDir, warm, cool; uniform float amt; varying vec3 vP; varying float vY;
      void main(){ vec2 d = normalize(vP.xz), s = normalize(sunDir.xz + 1e-4);
        float toward = pow(max(0.0, dot(d, s)), 2.5);
        vec3 col = mix(cool, warm, toward);
        float a = amt * pow(1.0 - vY, 2.2) * (0.35 + 0.65 * toward);
        gl_FragColor = vec4(col, a); }`,
  });
  // a ring 320 m out, from a little below the ground to 90 m up (uv.y 0 at the bottom)
  const m = new THREE.Mesh(new THREE.CylinderGeometry(320, 320, 110, 48, 1, true).translate(0, 35, 0), mat);
  m.renderOrder = -1; m.frustumCulled = false;
  return m;
}

// ---------- Ground mist: one mesh of soft horizontal sheets ----------
// spots: [[x, y, z, size], ...]
function makeMist(spots, color = 0xc8d0dc) {
  const g = new THREE.BufferGeometry(), P = [], UV = [], S = [], I = [];
  spots.forEach(([x, y, z, s], k) => {
    const b = P.length / 3, a = Math.random() * Math.PI;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const lx = (u - 0.5) * s, lz = (v - 0.5) * s;
      P.push(x + lx * Math.cos(a) - lz * Math.sin(a), y, z + lx * Math.sin(a) + lz * Math.cos(a)); UV.push(u, v); S.push(k * 7.31);
    }
    I.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('seed', new THREE.Float32BufferAttribute(S, 1)); g.setIndex(I);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, amt: { value: 1 }, col: { value: new THREE.Color(color) } }]),
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    vertexShader: `attribute float seed; varying vec2 vUv; varying float vSeed; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vSeed = seed; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uT, amt; uniform vec3 col; varying vec2 vUv; varying float vSeed; varying vec3 vW;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
      void main(){ vec2 q = vW.xz * 0.035 + vec2(uT * 0.02, uT * 0.008) + vSeed;
        float m = n(q) * 0.6 + n(q * 2.3 - uT * 0.03) * 0.4;
        float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
        gl_FragColor = vec4(col, amt * edge * smoothstep(0.3, 0.8, m) * 0.55);
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 2;
  return mesh;
}
function scatter(n, area, ground, lift = [0.4, 2.5], size = [40, 80]) {
  const out = [];
  for (let i = 0; i < n * 4 && out.length < n; i++) {
    const [x, z] = area(); if (x == null) continue;
    const y = ground(x, z); if (y == null) continue;
    out.push([x, y + lift[0] + Math.random() * (lift[1] - lift[0]), z, size[0] + Math.random() * (size[1] - size[0])]);
  }
  return out;
}

// ---------- Drifting specks (spray, dust, pollen) round you ----------
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
function makeSpecks(n, box, color, size) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * box, Math.random() * box * 0.4, (Math.random() - 0.5) * box], i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: glowTex(), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  p.frustumCulled = false; p.userData.box = box;
  return p;
}

// ---------- Firelight that moves ----------
function fireLights(ch, names) {
  const out = [];
  for (const k of names) {
    const L = ch[k]; if (!L?.isLight) continue;
    out.push({ L, home: L.position.clone(), base: L.color.clone(), seed: Math.random() * 100 });
  }
  return out;
}

export class Atmosphere {
  constructor(G) {
    this.G = G; this.ch = null; this.root = new THREE.Group(); G.scene.add(this.root);
    this.haze = makeHaze(); G.scene.add(this.haze);
    this.gust = 0;
  }

  clear() {
    for (const o of [...this.root.children]) { this.root.remove(o); o.geometry?.dispose(); o.material?.dispose(); }
    this.mists = []; this.specks = null; this.motes = null; this.fires = []; this.recipe = {};
  }

  async build(n, ch) {
    this.clear();
    const G = this.G, R = this.recipe = { n };
    const ground = G.world.height;
    if (n === 2) {
      // Salisbury Plain before sunrise: mist in the hollows all round the circle
      const m = makeMist(scatter(55, () => { const a = Math.random() * 6.28, r = 25 + Math.random() * 260; return [Math.cos(a) * r, Math.sin(a) * r]; }, ground, [0.3, 1.6], [30, 60]), 0xd8dce6);
      this.root.add(m); this.mists.push({ m, burn: [2, 14] });
    }
    if (n === 3) {
      // Mist on the Nile and the fields beside it before dawn
      const nile = await import('./chapters/nile.js');
      const rx = (z) => 410 + Math.sin(z / 420) * 40;
      const m = makeMist(scatter(70, () => [30 + Math.random() * (rx(0) + 120), (Math.random() - 0.5) * 900], (x, z) => Math.max(nile.groundHeight(x, z), -0.9), [0.4, 2.2], [45, 90]), 0xd4d8e4);
      this.root.add(m); this.mists.push({ m, burn: [0, 12], on: (c) => c.s?.scene !== 'nebra' });
    }
    if (n === 4) {
      // Night mist on the Euphrates and its fields, lit by the Moon
      const m = makeMist(scatter(40, () => [-150 + (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 900], () => -24.6, [0.3, 1.8], [40, 80]), 0xb8c4dc);
      this.root.add(m); this.mists.push({ m, amt: 0.8 });
      this.fires = fireLights(ch, ['lampA', 'lampB']);
    }
    if (n === 1) this.fires = fireLights(ch, ['light']);
    if (n === 5) {
      this.fires = fireLights(ch, ['templeLight', 'lampLight', 'chinaLight']);
      this.specks = makeSpecks(260, 26, 0xdfe8f0, 0.05); this.root.add(this.specks);
      R.wind = (c) => (c.cur === 'grove' || c.cur === 'alex' || c.cur === 'rhodes' ? 1 : c.cur === 'syene' ? 0.5 : 0);
      R.windDir = new THREE.Vector3(-0.3, 0, -1).normalize(); // off the sea, from the south
    }
    if (n === 6) {
      this.specks = makeSpecks(300, 22, 0xe8f4ff, 0.045); this.root.add(this.specks);
      R.wind = (c) => (c.sceneNow === 'sea' ? 0 : 1);
      R.windDir = new THREE.Vector3(1, 0, 0.2).normalize();
    }
    if (n === 8) {
      // mist lying on the Vistula Lagoon under the Moon; the candle and the brazier flicker
      const m = makeMist(scatter(45, () => [(Math.random() - 0.5) * 900, -170 - Math.random() * 700], () => -19.4, [0.3, 1.6], [40, 90]), 0xb8c4dc);
      this.root.add(m); this.mists.push({ m, amt: 0.7 });
      this.fires = fireLights(ch, ['candle', 'brazierLight']);
    }
    if (n === 10) {
      // river mist along the Vltava; dust in the candlelight of the study
      const m = makeMist(scatter(30, () => [-330 + (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 1400], () => -3, [0.3, 1.4], [40, 80]), 0xb8c4dc);
      this.root.add(m); this.mists.push({ m, amt: 0.7 });
      this.motes = makeSpecks(120, 4, 0xfff0c8, 0.02); this.motes.material.opacity = 0.35; this.root.add(this.motes);
      this.fires = fireLights(ch, ['candle', 'stove']);
    }
    if (n === 12) {
      // evening mist settling in the Witham valley; midges and pollen in the last light; the door lantern
      const m = makeMist(scatter(45, () => [80 + Math.random() * 380, (Math.random() - 0.5) * 900], ground, [0.3, 1.6], [40, 90]), 0xc8d0dc);
      this.root.add(m); this.mists.push({ m, amt: 0.7, on: (c) => !c.spaceOn });
      this.specks = makeSpecks(160, 18, 0xfff0c8, 0.03); this.root.add(this.specks);
      R.wind = (c) => (c.spaceOn ? 0 : 0.15); R.windDir = new THREE.Vector3(1, 0, 0.3).normalize();
      this.fires = fireLights(ch, ['lantern']);
    }
    if (n === 9) {
      // frost mist over Herrevad's fields; the lamp on Hven's terrace flickers
      const m = makeMist(scatter(40, () => { const a = Math.random() * 6.28, r = 30 + Math.random() * 300; return [Math.cos(a) * r, Math.sin(a) * r]; }, ground, [0.2, 1.2], [30, 60]), 0xc8d0dc);
      this.root.add(m); this.mists.push({ m, amt: 0.8, on: (c) => c.cur === 'abbey' });
      this.fires = fireLights(ch, ['lampB', 'folkLight']);
    }
    if (n === 7) {
      // dust turning slowly in the sunbeams of the hall
      this.motes = makeSpecks(220, 14, 0xfff0c8, 0.03); this.motes.material.opacity = 0.45; this.root.add(this.motes);
      R.motesOn = (c) => c.hall?.visible !== false;
    }
  }

  update(dt, t) {
    const G = this.G, sky = G.sky, ch = G.director.chapter;
    if (ch !== this.ch) { this.ch = ch; if (ch) this.build(G.director.n, ch).catch((e) => console.warn('atmosphere', e)); else this.clear(); }
    G.camera.getWorldPosition(_v);
    // haze round the Sun at golden hour (none at night, at noon, or underwater)
    const el = sky.sunEl, under = G.scene.fog?.isFogExp2;
    const golden = under ? 0 : smooth(-14, -5, el) * (1 - smooth(10, 24, el));
    const H = this.haze, U = H.material.uniforms;
    U.amt.value += (golden * 0.55 - U.amt.value) * Math.min(1, dt * 2);
    H.visible = U.amt.value > 0.01; H.position.set(_v.x, _v.y - 2, _v.z);
    if (H.visible) {
      dirFromAzEl(sky.sunAz, Math.max(el, 0), U.sunDir.value);
      const low = 1 - smooth(-4, 14, el);    // redder the lower the Sun
      U.warm.value.setRGB(1, 0.72 - 0.3 * low, 0.45 - 0.25 * low);
      U.cool.value.setRGB(0.5, 0.48, 0.7).multiplyScalar(0.5 + 0.5 * smooth(-10, 4, el));
    }
    if (!ch) return;
    // mist: drifts, and burns off as the Sun gets up
    for (const M of this.mists || []) {
      const u = M.m.material.uniforms; u.uT.value = t;
      let a = M.amt ?? 1; if (M.burn) a *= 1 - smooth(M.burn[0], M.burn[1], el);
      if (M.on && !M.on(ch)) a = 0;
      u.amt.value += (a - u.amt.value) * Math.min(1, dt);
      M.m.visible = u.amt.value > 0.01;
      // pick up the colour of the air: dark blue at night, pink-gold at dawn
      if (G.scene.fog) u.col.value.copy(G.scene.fog.color).lerp(_c.setHex(0xffffff), 0.35 + 0.25 * smooth(-6, 6, el));
    }
    // gusts: a slow rise and fall, sometimes a strong one
    this.gust = 0.45 + 0.35 * Math.sin(t * 0.37) * Math.sin(t * 0.19 + 2) + 0.3 * Math.max(0, Math.sin(t * 0.11 + 1)) ** 6;
    if (this.specks) {
      const R = this.recipe, w = R.wind ? R.wind(ch) : 0, P = this.specks, pos = P.geometry.attributes.position, a = pos.array, box = P.userData.box;
      P.visible = w > 0.01;
      if (P.visible) {
        P.position.set(_v.x, _v.y - 1.5, _v.z);
        const sp = (1.5 + 4.5 * this.gust) * w * dt;
        for (let i = 0; i < a.length; i += 3) {
          a[i] += R.windDir.x * sp + Math.sin(t * 1.3 + i) * 0.004; a[i + 1] += Math.sin(t * 0.9 + i * 0.7) * 0.006; a[i + 2] += R.windDir.z * sp;
          // wrap within the box round you
          if (a[i] > box / 2) a[i] -= box; else if (a[i] < -box / 2) a[i] += box;
          if (a[i + 2] > box / 2) a[i + 2] -= box; else if (a[i + 2] < -box / 2) a[i + 2] += box;
        }
        pos.needsUpdate = true;
        P.material.opacity = 0.35 + 0.35 * this.gust;
      }
      this.breeze(dt, w);
    }
    if (this.motes) {
      const on = this.recipe.motesOn(ch), M = this.motes; M.visible = on;
      if (on) { M.position.set(-7, 0.5, -7); M.rotation.y = t * 0.01; M.position.y = 0.5 + Math.sin(t * 0.1) * 0.2; }
    }
    // firelight: flicker in colour and sway in place (the chapter sets the brightness)
    for (const F of this.fires || []) {
      const s = F.seed, k = Math.sin(t * 9 + s) * 0.5 + Math.sin(t * 23.7 + s * 2) * 0.3 + Math.sin(t * 3.1 + s) * 0.2;
      F.L.position.set(F.home.x + Math.sin(t * 2.3 + s) * 0.06 + k * 0.03, F.home.y + Math.abs(k) * 0.08, F.home.z + Math.cos(t * 1.9 + s) * 0.06);
      F.L.color.copy(F.base).offsetHSL(0.012 * k, 0, 0.04 * k);
    }
  }

  // The breeze you hear: a soft rush that rises with each gust
  breeze(dt, w) {
    const A = this.G.audio; if (!A.ctx || w <= 0) return;
    this.breezeT = (this.breezeT ?? 0) - dt;
    if (this.breezeT <= 0) {
      this.breezeT = 1.6 + Math.random() * 1.6;
      const side = Math.random() < 0.5 ? -1 : 1, o = A.out(_w.copy(this.recipe.windDir).multiplyScalar(-6).add(_v).setY(_v.y + side), 0.18 * w * (0.4 + this.gust), 4);
      A.noise(o, { type: 'bandpass', f: 500 + Math.random() * 300, f2: 250, q: 0.6, peak: 0.5, a: 1.1, d: 2.2 });
    }
  }
}
