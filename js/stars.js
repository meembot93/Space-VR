// The real night sky: about 5,000 stars from the Hipparcos / Yale Bright Star catalogs (every star
// you can see with your eyes), the 88 constellations' stick figures, and the Milky Way's glow.
// Data: data/sky.json and data/milkyway.jpg, made by tools/sky/build_sky.py from Olaf Frohn's
// d3-celestial (BSD licence, see data/LICENSE-d3-celestial.txt).
//
// The sky turns with the time of night and is set for each chapter's place and era:
//   G.sky.setPlace({ lat: 51.2, year: -2500, sunLon: 90 })
// lat = latitude in degrees; year (negative = BC) shifts the stars for the slow wobble of Earth's
// axis (precession: 4,500 years ago Thuban, not Polaris, was the pole star); sunLon = where the Sun
// is along its yearly path (0 spring, 90 midsummer, 180 autumn, 270 midwinter). The time of night
// comes from wherever the chapter puts the Sun, so stars and Sun always agree.
import * as THREE from 'three';

const D2R = Math.PI / 180, R = 900;
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
    this.loaded = fetch(DATA + 'sky.json').then((r) => r.json()).then((j) => this.build(j)).catch((e) => console.warn('star catalog', e));
    this.setPlace({});
  }

  build(j) {
    this.data = j;
    const n = j.stars.length / 4, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    const v = new THREE.Vector3(), c = new THREE.Color();
    this.dirs = new Float32Array(n * 3); this.mags = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const [ra, dec, mag, bv] = j.stars.slice(i * 4, i * 4 + 4);
      eqVec(ra, dec, v); this.dirs.set([v.x, v.y, v.z], i * 3); this.mags[i] = mag;
      pos.set([v.x * R, v.y * R, v.z * R], i * 3);
      // brightness: each magnitude step is 2.5x fainter; squeeze it so faint stars still show
      const b = Math.pow(10, -0.4 * (mag - 1)) ** 0.5;
      bvColor(bv, c);
      const k = Math.min(1, 0.22 + b * 0.75);
      col.set([c.r * k, c.g * k, c.b * k], i * 3);
      size[i] = Math.max(1.6, Math.min(9, 2.2 + b * 4.2));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 0 }, scale: { value: 1 }, twinkle: { value: 0 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float scale, opacity, twinkle;
        void main(){
          vec3 wd = normalize(mat3(modelMatrix) * position);
          // stars dim and redden near the horizon (thicker air), and vanish below it
          float alt = wd.y;
          float ext = smoothstep(-0.01, 0.12, alt);
          float tw = 1.0 + 0.18 * sin(twinkle * (3.0 + fract(position.x * 0.37) * 4.0) + position.z) * (1.0 - smoothstep(0.1, 0.5, alt));
          vC = color * opacity * ext * tw * mix(vec3(1.0, 0.75, 0.55), vec3(1.0), smoothstep(0.0, 0.25, alt));
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww;
          gl_PointSize = size * scale * (0.6 + 0.4 * ext);
        }`,
      fragmentShader: `varying vec3 vC;
        void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float a = smoothstep(0.5, 0.0, r); a = a * a * (1.6 - r);
          gl_FragColor = vec4(vC * a, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = -9;
    this.group.add(this.points);
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
      this.mat.uniforms.opacity.value = this.opacity;
      this.mat.uniforms.twinkle.value = t;
      this.lineMat.opacity = this.lineOpacity * this.opacity;
      this.points.visible = this.lines.visible = this.opacity > 0.01;
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
