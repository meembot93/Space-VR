// The real night sky: about 5,000 stars from the Hipparcos / Yale Bright Star catalogs (every star
// you can see with your eyes) plus 36,000 fainter ones, Milky Way star dust, the 88 constellations'
// stick figures, and the Milky Way in colour (drawn by the sky dome in sky.js).
// Data: data/sky.json, faint.bin, milkyway.jpg and milkyway-color.jpg, made by tools/sky/build_sky.py
// and build_sky_detail.py from Olaf Frohn's d3-celestial (BSD licence, see data/LICENSE-d3-celestial.txt).
//
// The sky turns with the time of night and is set for each chapter's place and era:
//   G.sky.setPlace({ lat: 51.2, year: -2500, sunLon: 90 })
// lat = latitude in degrees; year (negative = BC) shifts the stars for the slow wobble of Earth's
// axis (precession: 4,500 years ago Thuban, not Polaris, was the pole star); sunLon = where the Sun
// is along its yearly path (0 spring, 90 midsummer, 180 autumn, 270 midwinter). The time of night
// comes from wherever the chapter puts the Sun, so stars and Sun always agree.
import * as THREE from 'three';

const D2R = Math.PI / 180, R = 900;
export const DUST_MAX = 160000;  // most Milky Way dust stars (2 triangles each)
// The figures drawn faintly all night: the famous ones and the zodiac (any other lights up when you point at it)
const MAJOR = new Set(['And', 'Aql', 'Ari', 'Aur', 'Boo', 'CMa', 'Car', 'Cas', 'Cen', 'Cet', 'Cyg', 'Eri', 'Gem', 'Leo', 'Ori', 'Peg', 'Per',
  'Sco', 'Sgr', 'Tau', 'UMa', 'Vir', 'Lyr', 'UMi', 'Cru', 'CMi', 'Dra', 'Her', 'Cnc', 'Lib', 'Cap', 'Aqr', 'Psc', 'Oph']);
const DATA = new URL('../data/', import.meta.url).href;

// Star colour from its B-V index (blue-white hot stars to orange-red cool ones)
function bvColor(bv, out) {
  const t = Math.max(-0.4, Math.min(2, bv));
  if (t < 0) return out.setRGB(0.72, 0.8, 1);
  if (t < 0.4) return out.setRGB(0.85 + t * 0.35, 0.9 + t * 0.2, 1);
  if (t < 0.8) return out.setRGB(1, 0.98 - (t - 0.4) * 0.2, 1 - (t - 0.4) * 0.6);
  if (t < 1.4) return out.setRGB(1, 0.9 - (t - 0.8) * 0.35, 0.76 - (t - 0.8) * 0.6);
  return out.setRGB(1, 0.68, 0.4);
}
// Unit vector for right ascension / declination (degrees), in the star sphere's own frame
export function eqVec(ra, dec, out = new THREE.Vector3()) {
  const a = ra * D2R, d = dec * D2R;
  return out.set(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d));
}

export class StarField {
  constructor() {
    this.group = new THREE.Group();          // turned every frame to match the place and time
    this.group.matrixAutoUpdate = false;
    this.toWorld = new THREE.Matrix4();       // star frame (J2000 catalog) -> world directions
    this.toStar = new THREE.Matrix3();        // world directions -> catalog frame (for the Milky Way map)
    this.place = { lat: 51.2, year: 2000, sunLon: 90 };
    this.opacity = 0;
    this.lineOpacity = 0;
    this.ready = false;
    this.mwTex = new THREE.TextureLoader().load(DATA + 'milkyway.jpg');
    this.mwTex.colorSpace = THREE.NoColorSpace;
    this.mwTex.wrapS = THREE.RepeatWrapping;
    this.mwColor = new THREE.TextureLoader().load(DATA + 'milkyway-color.jpg');
    this.mwColor.minFilter = THREE.LinearFilter; this.mwColor.generateMipmaps = false; // (no seam line where the map wraps)
    this.detail = 1;          // 0..1: how much Milky Way star dust to draw (lowered if the headset struggles)
    this.dustBudget = DUST_MAX; // how many dust stars this scene has room for (see budget())
    const faint = fetch(DATA + 'faint.bin').then((r) => r.arrayBuffer()).then((b) => { this.faint = new Int16Array(b); }).catch((e) => console.warn('faint stars', e));
    this.loaded = Promise.all([fetch(DATA + 'sky.json').then((r) => r.json()), faint]).then(([j]) => this.build(j)).catch((e) => console.warn('star catalog', e));
    this.loaded.then(() => this.buildDust());
    this.setPlace({});
  }

  build(j) {
    this.data = j;
    const n = j.stars.length / 4, c = new THREE.Color(), v = new THREE.Vector3();
    this.dirs = new Float32Array(n * 3); this.mags = new Float32Array(n);
    // Every star is a small glowing card that always faces you: 2 triangles each, sized in pixels
    // so stars stay crisp in the headset, with a soft halo (and faint spikes) on the brightest.
    // Layers: the ~5,000 stars you can see one by one, ~36,000 fainter ones (magnitude 6-8), and
    // up to DUST_MAX tiny ones scattered through the Milky Way's star clouds. How many of the
    // last are drawn follows the scene's triangle budget and the headset's frame rate (detail).
    const faint = this.faint, nf = faint ? faint.length / 4 : 0;
    const N = n + nf;
    const dir = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N * 2);
    const put = (i, x, y, z, mag, bv, dim) => {
      dir[i * 3] = x * R; dir[i * 3 + 1] = y * R; dir[i * 3 + 2] = z * R;
      // brightness: each magnitude step is 2.5x fainter; squeezed so faint stars still show
      const b = Math.pow(10, -0.4 * (mag - 1)) ** 0.5;
      bvColor(bv, c);
      const k = Math.min(1, 0.16 + b * 0.8) * dim;
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k;
      sz[i * 2] = Math.min(4.2, 0.95 + b * 1.5);                 // core radius (pixels)
      sz[i * 2 + 1] = b > 0.35 ? Math.min(11, 1.6 + b * 2.8) : 1.6; // whole card, as a multiple of the core (halo)
    };
    for (let i = 0; i < n; i++) {
      const [ra, dec, mag, bv] = j.stars.slice(i * 4, i * 4 + 4);
      eqVec(ra, dec, v); this.dirs.set([v.x, v.y, v.z], i * 3); this.mags[i] = mag;
      put(i, v.x, v.y, v.z, mag, bv, 1);
    }
    for (let i = 0; i < nf; i++) {
      const ra = (faint[i * 4] + 32768) / 65535 * 360, dec = faint[i * 4 + 1] / 100;
      eqVec(ra, dec, v); put(n + i, v.x, v.y, v.z, faint[i * 4 + 2] / 1000, faint[i * 4 + 3] / 1000, 0.55);
    }
    this.mat = starMaterial();
    this.points = cards(dir, col, sz, this.mat); this.points.renderOrder = -9;
    this.group.add(this.points);
    this.coreTris = N * 2;
    // Constellation stick figures: faint lines between the stars
    const lp = [], mp = []; this.conSegs = {};
    for (const [id, con] of Object.entries(j.constellations)) {
      const start = lp.length / 3;
      for (const line of con.lines) for (let i = 0; i + 1 < line.length; i++) {
        eqVec(line[i][0], line[i][1], v).multiplyScalar(R * 0.99); lp.push(v.x, v.y, v.z);
        eqVec(line[i + 1][0], line[i + 1][1], v).multiplyScalar(R * 0.99); lp.push(v.x, v.y, v.z);
      }
      this.conSegs[id] = [start, lp.length / 3 - start];
      if (MAJOR.has(id)) mp.push(...lp.slice(start * 3));
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    this.lineMat = new THREE.LineBasicMaterial({ color: 0x8fb0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.lines = new THREE.LineSegments(mg, this.lineMat); this.lines.frustumCulled = false; this.lines.renderOrder = -9;
    // One constellation drawn brighter, when you point at one of its stars
    this.hiMat = new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.hi = new THREE.LineSegments(lg.clone(), this.hiMat); this.hi.frustumCulled = false; this.hi.renderOrder = -8; this.hi.visible = false;
    this.group.add(this.lines, this.hi);
    // Which stars have a name / constellation to show
    this.labels = new Map(); for (const [i, name, c] of j.names) this.labels.set(i, { name, con: c });
    this.ready = true;
  }

  // Set the place and era (see the top of this file). Any field left out stays as it was.
  setPlace(p) {
    Object.assign(this.place, p);
    const T = (this.place.year - 2000) / 100;              // centuries from the year 2000
    this.eps = Math.min(24.5, Math.max(22.1, 23.4393 - 0.013 * T)) * D2R; // tilt of Earth's axis then (it rocks between 22 and 24.5 degrees)
    const prec = (5029.0966 * T / 3600) * D2R;            // how far the equinoxes had slid
    // J2000 equatorial -> ecliptic, slide along the ecliptic, -> equatorial of that era
    const e0 = 23.4393 * D2R;
    this.prec = new THREE.Matrix4().makeRotationX(this.eps)
      .multiply(new THREE.Matrix4().makeRotationZ(prec))
      .multiply(new THREE.Matrix4().makeRotationX(-e0));
    // the Sun's place among the stars on that date (in the era's own frame)
    const l = this.place.sunLon * D2R;
    this.sunRA = Math.atan2(Math.cos(this.eps) * Math.sin(l), Math.cos(l));
  }

  // Turn the sky to match the Sun's position (compass bearing and height, degrees)
  update(sunAz, sunEl, t) {
    const phi = this.place.lat * D2R, az = sunAz * D2R, alt = sunEl * D2R;
    const H = Math.atan2(-Math.sin(az) * Math.cos(alt), Math.cos(phi) * Math.sin(alt) - Math.sin(phi) * Math.cos(alt) * Math.cos(az));
    const L = this.sunRA + H, cL = Math.cos(L), sL = Math.sin(L), cp = Math.cos(phi), sp = Math.sin(phi);
    // equatorial (of date) -> world: hour angle, then tip the pole up to the latitude.
    // World axes: +X east, +Y up, -Z north.
    const A = new THREE.Matrix4().set(cL, sL, 0, 0, sL, -cL, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    const B = new THREE.Matrix4().set(0, -1, 0, 0, cp, 0, sp, 0, sp, 0, -cp, 0, 0, 0, 0, 1);
    this.dateToWorld = B.multiply(A);
    this.toWorld.copy(this.dateToWorld).multiply(this.prec);
    this.group.matrix.copy(this.toWorld);
    this.toStar.setFromMatrix4(this.toWorld).transpose();
    if (this.mat) {
      const U = this.mat.uniforms;
      U.opacity.value = this.opacity; U.twinkle.value = t; U.pxAng.value = this.pxAng || 0.0012;
      this.lineMat.opacity = this.lineOpacity * this.opacity;
      this.points.visible = this.lines.visible = this.opacity > 0.01;
      if (this.dust) {
        this.dust.visible = this.opacity > 0.01;
        this.dust.geometry.setDrawRange(0, Math.round(Math.min(this.dustBudget, DUST_MAX) * this.detail) * 6);
      }
    }
  }

  // The labelled star nearest to a world direction, within `maxDeg` (brighter stars win ties)
  pick(dir, maxDeg = 2.5) {
    if (!this.ready) return null;
    const inv = _m.copy(this.toWorld).setPosition(0, 0, 0).invert();
    const d = _v.copy(dir).applyMatrix4(inv).normalize();
    const cosMax = Math.cos(maxDeg * D2R);
    let best = null, bestScore = -Infinity;
    for (const [i, info] of this.labels) {
      const dot = d.x * this.dirs[i * 3] + d.y * this.dirs[i * 3 + 1] + d.z * this.dirs[i * 3 + 2];
      if (dot < cosMax) continue;
      const ang = Math.acos(Math.min(1, dot)) / D2R;
      const score = -ang - this.mags[i] * 0.35;
      if (score > bestScore) { bestScore = score; best = { i, ...info, mag: this.mags[i] }; }
    }
    if (!best) return null;
    const con = this.data.constellations[best.con];
    best.conName = con?.name || best.con; best.conEn = con?.en || '';
    best.world = new THREE.Vector3(this.dirs[best.i * 3], this.dirs[best.i * 3 + 1], this.dirs[best.i * 3 + 2]).applyMatrix4(_m.copy(this.toWorld).setPosition(0, 0, 0));
    return best;
  }

  // Index of a named star (e.g. 'Sirius'), or -1
  find(name) { if (!this.ready) return -1; for (const [i, l] of this.labels) if (l.name === name) return i; return -1; }
  // Where a star is in the world right now (unit direction)
  dirOf(i, out = new THREE.Vector3()) {
    return out.set(this.dirs[i * 3], this.dirs[i * 3 + 1], this.dirs[i * 3 + 2]).applyMatrix4(_m.copy(this.toWorld).setPosition(0, 0, 0));
  }
  // The Sun's compass bearing on this date when it's at height el (degrees): morning (east) or evening
  sunAzAt(el, morning = true) {
    const phi = this.place.lat * D2R, dec = Math.asin(Math.sin(this.eps) * Math.sin(this.place.sunLon * D2R)), h = el * D2R;
    const c = (Math.sin(dec) - Math.sin(phi) * Math.sin(h)) / (Math.cos(phi) * Math.cos(h));
    const az = Math.acos(Math.max(-1, Math.min(1, c))) / D2R;
    return morning ? az : 360 - az;
  }

  // Draw one constellation brighter (null = none)
  highlight(id, amount = 1) {
    if (!this.hi) return;
    const s = id && this.conSegs?.[id];
    this.hi.visible = !!s && amount > 0.01;
    if (s) { this.hi.geometry.setDrawRange(s[0], s[1]); this.hiMat.opacity = amount * this.opacity; }
  }
}
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();

// Milky Way star dust: tiny faint stars, thickest where the Milky Way glows brightest (read from its
// map), in random order so any number of them drawn is spread evenly.
StarField.prototype.buildDust = async function () {
  const img = await new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = DATA + 'milkyway.jpg'; }).catch(() => null);
  if (!img) return;
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const r = mulberry(11), N = DUST_MAX, c = new THREE.Color(), v = new THREE.Vector3();
  const dir = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N * 2);
  for (let i = 0; i < N;) {
    const z = r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - z * z);
    v.set(q * Math.cos(a), q * Math.sin(a), z);
    const ra = ((Math.atan2(v.y, v.x) / D2R) + 360) % 360, dec = Math.asin(z) / D2R;
    const d = px[(Math.min(H - 1, Math.floor((90 - dec) / 180 * H)) * W + Math.floor(ra / 360 * W) % W) * 4] / 255;
    if (r() > 0.05 + 1.1 * d ** 1.3) continue;           // most go into the bright band
    dir.set([v.x * R * 0.998, v.y * R * 0.998, v.z * R * 0.998], i * 3);
    const t = r();
    bvColor(t < 0.25 ? -0.1 : t < 0.7 ? 0.5 : 1.2, c);
    const k = (0.05 + 0.14 * r() ** 3) * (0.6 + 0.6 * d);
    col.set([c.r * k, c.g * k, c.b * k], i * 3);
    sz[i * 2] = 0.8 + r() * 0.3; sz[i * 2 + 1] = 1.6;
    i++;
  }
  this.dust = cards(dir, col, sz, this.mat); this.dust.renderOrder = -9;
  this.dust.geometry.setDrawRange(0, 0); this.group.add(this.dust);
};

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// A batch of star cards in one mesh: 4 corners and 2 triangles per star (merged rather than
// instanced: phone-class GPUs like the Quest's handle one big mesh of tiny quads better)
function cards(dir, col, sz, mat) {
  const n = dir.length / 3, P = new Float32Array(n * 12), C = new Float32Array(n * 12), S = new Float32Array(n * 8);
  const I = new Uint32Array(n * 6);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) {
    P.set(dir.subarray(i * 3, i * 3 + 3), (i * 4 + k) * 3); C.set(col.subarray(i * 3, i * 3 + 3), (i * 4 + k) * 3); S.set(sz.subarray(i * 2, i * 2 + 2), (i * 4 + k) * 2);
  }
  for (let i = 0, v = 0; i < n; i++, v += 4) I.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('scol', new THREE.BufferAttribute(C, 3));
  g.setAttribute('ssize', new THREE.BufferAttribute(S, 2));
  g.setIndex(new THREE.BufferAttribute(I, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R);
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
  return m;
}

function starMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, twinkle: { value: 0 }, pxAng: { value: 0.0012 } },
    vertexShader: `attribute vec3 scol; attribute vec2 ssize;
      uniform float opacity, twinkle, pxAng;
      varying vec3 vC; varying vec2 vUv; varying float vCore, vSpike;
      void main(){
        vec3 sdir = position;
        int k = gl_VertexID % 4;                                 // which corner of the card
        vec2 corner = vec2(k == 1 || k == 2 ? 1.0 : -1.0, k >= 2 ? 1.0 : -1.0);
        vec3 wd = normalize(mat3(modelMatrix) * sdir);
        float alt = wd.y;
        // dimmer and redder near the horizon (thicker air), gone below it
        float ext = smoothstep(-0.01, 0.12, alt);
        // twinkling: stronger low in the sky, a little colour flicker on the bright ones
        float ph = twinkle * (2.6 + fract(sdir.x * 0.0137) * 5.0) + sdir.z * 0.31;
        float low = 1.0 - smoothstep(0.08, 0.6, alt);
        float tw = 1.0 + (0.1 + 0.3 * low) * sin(ph) * sin(ph * 1.7 + 1.3);
        vec3 tint = mix(vec3(1.0, 0.72, 0.5), vec3(1.0), smoothstep(0.0, 0.25, alt));
        tint *= 1.0 + 0.12 * low * vec3(sin(ph * 2.3), sin(ph * 2.9 + 2.0), sin(ph * 3.1 + 4.0));
        vC = scol * opacity * ext * tw * tint;
        float big = ssize.y;
        vCore = 1.0 / big; vSpike = smoothstep(4.0, 9.0, big);
        vUv = corner;
        vec4 mv = modelViewMatrix * vec4(sdir, 1.0);
        float rad = ssize.x * big * pxAng * length(mv.xyz);
        mv.xy += corner * rad;
        if (vC.r + vC.g + vC.b < 0.004) mv.xy *= 0.0;          // invisible (daytime, below the horizon): no pixels
        gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `varying vec3 vC; varying vec2 vUv; varying float vCore, vSpike;
      void main(){
        float r = length(vUv);
        if (r > 1.0) discard;
        float q = r / vCore;
        float a = exp(-q * q * 2.2);                                      // the star itself
        a += (1.0 - vCore) * 0.22 * pow(1.0 - r, 3.0);                    // a soft halo around bright ones
        float sp = exp(-abs(vUv.x) * 60.0) + exp(-abs(vUv.y) * 60.0);     // faint cross spikes on the brightest
        a += vSpike * sp * 0.25 * pow(1.0 - r, 2.0);
        gl_FragColor = vec4(vC * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}
