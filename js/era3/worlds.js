// Era 3 places that many chapters share: the Earth seen from orbit (day side, night side with city
// lights, a cloud layer, the thin blue air, sunrise on its edge), the Moon as a whole cratered
// globe (the real near side, js/moontex.js), the Moon's surface you stand on, open ground (steppe,
// grass, sand) and the sea.
import * as THREE from 'three';
import { Space, lonLat } from '../wow/space.js';
import { glowPoints, glowSprite } from '../wow/fx.js';
import { moonFields } from '../moontex.js';
import { rng, noise2 } from '../shapes.js';
import { canvasTex, clamp } from '../util.js';
import { FLAT } from '../kit.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { texGround } from '../surfaces.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const _a = new THREE.Vector3();

// A few big cities (lat, lon) for the lights on the night side of the Earth
export const CITIES = [[55.7, 37.6], [59.9, 30.3], [51.5, -0.1], [48.9, 2.3], [52.5, 13.4], [40.7, -74], [41.9, -87.6], [34, -118.2], [19.4, -99.1], [-23.5, -46.6], [-34.6, -58.4], [35.7, 139.7], [34.7, 135.5], [31.2, 121.5], [39.9, 116.4], [22.5, 114.1], [19.1, 72.9], [28.6, 77.2], [22.6, 88.4], [30, 31.2], [41, 29], [45.5, -73.6], [43.7, -79.4], [37.8, -122.4], [29.8, -95.4], [-33.9, 151.2], [-37.8, 145], [1.3, 103.8], [13.8, 100.5], [-6.2, 106.8], [6.5, 3.4], [-26.2, 28], [40.4, -3.7], [41.9, 12.5], [45.5, 9.2], [50.4, 30.5], [53.9, 27.6], [43.2, 76.9], [41.3, 69.3], [56.8, 60.6], [55, 82.9], [33.7, 73], [24.9, 67], [35.7, 51.4], [33.3, 44.4], [39.7, -105], [47.6, -122.3], [25.8, -80.2], [42.4, -71], [38.9, -77], [-12, -77], [4.7, -74.1], [10.5, -66.9], [60.2, 24.9], [59.3, 18.1], [55.7, 12.6], [47.5, 19], [50.1, 14.4], [52.2, 21], [44.4, 26.1], [37.6, 127], [14.6, 121], [23.1, -82.4], [28.5, -81.4], [32.8, -96.8], [33.7, -84.4], [44.9, -93.2], [39.1, -94.6], [36.2, -115.1], [35.1, -106.6]];

// ---------- The Earth from space ----------
// A Space (js/wow/space.js) with city lights on the night side and a drifting cloud layer.
// opts: { earthR (m), cities (true), clouds (true) }
export function earthSpace(G, { earthR = 400, cities = true, clouds = true } = {}) {
  const SP = new Space(G, { earthR });
  SP.ball.material.roughness = 0.9;
  if (cities) {
    const pts = [], r = rng(31);
    for (const [la, lo] of CITIES) for (let i = 0; i < 8; i++) pts.push(lonLat(la + (r() - 0.5) * 2.2, lo + (r() - 0.5) * 3, new THREE.Vector3()).multiplyScalar(earthR * 1.003));
    const C = glowPoints(pts.length, { sizeScale: 300 }); SP.earth.add(C);
    pts.forEach((p, i) => { C.userData.pos.set([p.x, p.y, p.z], i * 3); C.userData.size[i] = 0.9 + r() * 1.4; });
    SP.cityPts = pts; SP.cities = C;
    // lights show only on the night side: dim each by the Sun
    SP.updateCities = () => {
      const U = C.userData, sun = SP.sunDir, q = SP.earth.getWorldQuaternion(new THREE.Quaternion());
      pts.forEach((p, i) => { const d = _a.copy(p).normalize().applyQuaternion(q).dot(sun), k = clamp01((-d - 0.02) / 0.12) * 0.9; U.col.set([k, k * 0.78, k * 0.42], i * 3); });
      U.commit();
    };
  }
  if (clouds) {
    const tex = canvasTex(1024, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h); const N = noise2(77), N2 = noise2(78), img = g.createImageData(w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const lat = (0.5 - y / h) * Math.PI, band = 0.55 + 0.45 * Math.cos(lat * 3.2);
        const v = N(x / 70, y / 50) * 0.6 + N2(x / 22, y / 18) * 0.4, a = clamp01((v * band - 0.42) * 3.2) * 0.9;
        const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 255;
      }
      g.putImageData(img, 0, 0);
    });
    const cl = new THREE.Mesh(new THREE.SphereGeometry(earthR * 1.008, 64, 48), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, fog: false }));
    SP.earth.add(cl); SP.clouds = cl;
  }
  const up = SP.update.bind(SP);
  SP.update = (dt) => { up(dt); if (SP.on) { SP.updateCities?.(); if (SP.clouds) SP.clouds.rotation.y += dt * 0.002; } };
  return SP;
}

// ---------- The Moon as a globe ----------
// The real near side, every crater's walls shaded by the light, the line between day and night
// throwing long shadows. R: radius (m). setSun(worldDir) aims the light.
let moonTex = null;
function moonData() {
  if (moonTex) return moonTex;
  const W = 1024, H = 512, F = moonFields('map', W, H), hr = F.h, al = F.alb, data = new Uint8Array(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    data[p * 4] = clamp(Math.round((0.5 + hr[p] / 0.06) * 255), 0, 255); data[p * 4 + 1] = clamp(Math.round(al[p] * 255), 0, 255);
    const x = p % W, y = (p / W) | 0, gu = (hr[y * W + (x + 1) % W] - hr[y * W + (x + W - 1) % W]) / 2, gv = (hr[Math.min(H - 1, y + 1) * W + x] - hr[Math.max(0, y - 1) * W + x]) / 2;
    data[p * 4 + 2] = clamp(Math.round((0.5 + gu / 0.008) * 255), 0, 255); data[p * 4 + 3] = clamp(Math.round((0.5 + gv / 0.008) * 255), 0, 255);
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4; tex.needsUpdate = true;
  return (moonTex = { tex, hr, W, H });
}
export function moonGlobe(R = 100, { seg = 160, relief = 1.4 } = {}) {   // relief: how tall the mountains stand (1.4 seen from afar; less when you skim low over it)
  const { tex, hr, W, H } = moonData();
  const geo = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.65)); geo.rotateY(-Math.PI / 2);
  const P = geo.attributes.position, UV = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) {
    const u = UV.getX(i), w = UV.getY(i), x = ((Math.floor(u * W) % W) + W) % W, y = Math.max(0, Math.min(H - 1, Math.floor(w * H))), k = 1 + hr[y * W + x] * relief;
    P.setXYZ(i, P.getX(i) * k, P.getY(i) * k, P.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({
    uniforms: { hm: { value: tex }, L: { value: new THREE.Vector3(1, 0, 0) }, op: { value: 1 }, bump: { value: 0.06 * 12.2 * 2.2 }, earth: { value: 0.03 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D hm; uniform vec3 L; uniform float op, bump, earth; varying vec2 vUv; varying vec3 vN; varying vec3 vP;
      void main(){ vec4 t = texture2D(hm, vUv); float h = t.r; float alb = t.g;
        vec3 n = normalize(vN); vec3 sx = dFdx(vP), sy = dFdy(vP); vec2 g = (t.ba - 0.5) * (0.008 / 0.06) * vec2(${W}.0, ${H}.0); vec2 ux = dFdx(vUv), uy = dFdy(vUv); if (abs(ux.x) > 0.5) ux.x = 0.0; if (abs(uy.x) > 0.5) uy.x = 0.0;
        vec2 dh = vec2(dot(g, ux), dot(g, uy)) * bump;
        vec3 r1 = cross(sy, n), r2 = cross(n, sx); float det = dot(sx, r1); vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
        vec3 bn = normalize(abs(det) * n - grad);
        float d = max(dot(bn, L), 0.0); float term = smoothstep(-0.07, 0.05, dot(n, L));
        float peaks = smoothstep(0.62, 0.7, h) * smoothstep(-0.12, -0.02, dot(n, L)) * (1.0 - term);
        vec3 col = vec3(1.0, 0.97, 0.92) * alb * (1.35 * pow(d, 0.85) * term + 0.9 * peaks) + vec3(0.035, 0.04, 0.055) * alb * earth * 10.0;
        gl_FragColor = vec4(col, op); }`,
    transparent: false, fog: false,
  });
  const m = new THREE.Mesh(geo, mat); m.scale.setScalar(R); m.frustumCulled = false;
  m.userData.setSun = (dir) => mat.uniforms.L.value.copy(dir).normalize();
  m.userData.mat = mat;
  return m;
}

// ---------- The Moon's surface you stand on ----------
// A patch `size` m across: soft grey dust with small craters, rocks and boulders, footprints can
// be pressed into it; it curves gently down at the edges so the horizon is close, like on the Moon.
// opts: { size, seed, craters: [[x, z, r, depth]], flatten: [[x, z, r]] (keep flat, e.g. under the lander), boulders }
export function moonGround({ size = 600, seg = 220, seed = 11, craters = [], flatten = [], boulders = [], rocks = 900, clear = [] } = {}) {
  const N1 = noise2(seed), N2 = noise2(seed + 1), N3 = noise2(seed + 2), r = rng(seed);
  const cr = [...craters];
  for (let i = 0; i < 140; i++) { const a = r() * 6.28, d = 20 + Math.pow(r(), 0.7) * size * 0.45, rad = 0.6 + Math.pow(r(), 3) * 14; cr.push([Math.cos(a) * d, Math.sin(a) * d, rad, rad * (0.18 + r() * 0.1)]); }
  const curve = (x, z) => -((x * x + z * z) / (2 * 1737000)) * 1.0;   // the Moon's curve (1737 km radius)
  const H = (x, z) => {
    let y = (N1(x / 90, z / 90) - 0.5) * 2.2 + (N2(x / 14, z / 14) - 0.5) * 0.3 + (N3(x / 3, z / 3) - 0.5) * 0.06;
    for (const [cx, cz, R, D] of cr) {
      const d = Math.hypot(x - cx, z - cz) / R; if (d > 1.6) continue;
      y += d < 1 ? -D * (1 - d * d) + D * 0.25 : D * 0.25 * Math.max(0, 1 - (d - 1) / 0.6) ** 2;
    }
    for (const [fx, fz, fr] of flatten) { const d = Math.hypot(x - fx, z - fz); if (d < fr * 1.6) y *= clamp01((d - fr) / (fr * 0.6)); }
    return y + curve(x, z);
  };
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    // denser near the middle (where you stand), wider apart out to the horizon
    let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (size / 2), 1.7) * (size / 2) / r0 : 0;
    x *= kk; z *= kk; const y = H(x, z); p.setXYZ(i, x, y, z);
    const v = 0.5 + (N2(x / 6, z / 6) - 0.5) * 0.12 + (N1(x / 40, z / 40) - 0.5) * 0.1;
    c.setRGB(v * 0.95, v * 0.93, v * 0.9); col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  // the dust: fine speckle in a texture, tiled
  const dust = canvasTex(512, 512, (gg, w, h) => {
    gg.fillStyle = '#9a9894'; gg.fillRect(0, 0, w, h); const rr = rng(seed + 9);
    for (let i = 0; i < 26000; i++) { const v = 120 + rr() * 90 | 0; gg.fillStyle = `rgba(${v},${v - 2},${v - 5},${0.2 + rr() * 0.4})`; gg.fillRect(rr() * w, rr() * h, 1 + rr() * 2, 1 + rr() * 2); }
    for (let i = 0; i < 90; i++) { gg.fillStyle = `rgba(40,40,40,${0.08 + rr() * 0.1})`; gg.beginPath(); gg.arc(rr() * w, rr() * h, 1 + rr() * 6, 0, 7); gg.fill(); }
  });
  dust.wrapS = dust.wrapT = THREE.RepeatWrapping;
  const uv = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / 4; uv[i * 2 + 1] = p.getZ(i) / 4; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mat = new THREE.MeshStandardMaterial({ map: dust, vertexColors: true, roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(g, mat);
  // rocks scattered about, and the boulders named by the chapter, in one mesh
  const rk = [];
  for (let i = 0; i < rocks; i++) {
    const a = r() * 6.28, d = 3 + Math.pow(r(), 1.5) * size * 0.4, x = Math.cos(a) * d, z = Math.sin(a) * d; let s = 0.05 + Math.pow(r(), 5) * 0.8;
    for (const [cx, cz, cr, cs] of clear) if (Math.hypot(x - cx, z - cz) < cr) s = Math.min(s, cs);   // keep the ground where people walk clear of big rocks
    rk.push([x, z, s]);
  }
  for (const b of boulders) rk.push(b);
  // a lumpy rock: a rounded ball pushed about by noise (the same spot always moves the same way, so
  // the shared corners stay joined), squashed, with a few flat faces where it broke
  const ico = new THREE.IcosahedronGeometry(1, 3); ico.deleteAttribute('uv'); ico.deleteAttribute('normal');
  const rg = mergeVertices(ico), rp = rg.attributes.position, RN = noise2(seed + 5);
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i);
    let k = 0.82 + (RN(x * 1.3 + 3, z * 1.3 + y) - 0.5) * 0.5 + (RN(x * 3.1, y * 3.1 + z) - 0.5) * 0.16;
    if (x * 0.6 + y * 0.3 - z * 0.7 > 0.55) k *= 0.88;   // a broken face
    rp.setXYZ(i, x * k, y * k * 0.68, z * k);
  }
  rg.computeVertexNormals();
  const rocksM = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0x8a8884, roughness: 1 }), rk.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  rk.forEach(([x, z, s], i) => { m.compose(new THREE.Vector3(x, H(x, z) + s * 0.2, z), q.setFromEuler(e.set(r(), r() * 6, r())), new THREE.Vector3(s, s, s)); rocksM.setMatrixAt(i, m); });
  const grp = new THREE.Group(); grp.add(ground, rocksM);
  return { group: grp, height: H, ground, rocks: rocksM };
}

// ---------- Open ground ----------
// size m across, seg steps; h(x, z) height; color(x, z, c) sets the colour. Denser near the middle.
export function groundPlane({ size = 3000, seg = 140, h = () => 0, color = (x, z, c) => c.setHex(0x7a7a5a), dense = 1.6, cx = 0, cz = 0, mat = FLAT, tex = null }) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (size / 2), dense) * (size / 2) / r0 : 0;
    x = x * kk + cx; z = z * kk + cz; p.setXYZ(i, x, h(x, z), z);
    color(x, z, c); cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  return texGround(new THREE.Mesh(g, mat), tex || {});
}

// ---------- The sea ----------
// A big sea that glints and swells (a shader on a flat disc): col deep colour, sky the colour it
// reflects near the horizon. update(t) moves the waves.
export function sea({ size = 6000, col = 0x1a4a6a, sky = 0x9ac0e0, sun = new THREE.Vector3(0.3, 0.5, -0.8) } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, col: { value: new THREE.Color(col) }, sky: { value: new THREE.Color(sky) }, sun: { value: sun.clone().normalize() }, fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 3000 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float t; uniform vec3 col, sky, sun; varying vec3 vW;
      void main(){ vec2 p = vW.xz;
        float w = sin(p.x * 0.11 + t * 0.9) * 0.5 + sin(p.y * 0.17 - t * 1.1) * 0.35 + sin((p.x + p.y) * 0.31 + t * 1.7) * 0.2 + sin((p.x - p.y) * 0.9 + t * 2.3) * 0.08;
        vec3 n = normalize(vec3(cos(p.x * 0.11 + t * 0.9) * 0.05 + cos((p.x - p.y) * 0.9 + t * 2.3) * 0.06, 1.0, cos(p.y * 0.17 - t * 1.1) * 0.05 + cos((p.x + p.y) * 0.31 + t * 1.7) * 0.06));
        vec3 v = normalize(cameraPosition - vW); float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 c = mix(col * (0.8 + 0.15 * w), sky, clamp(fres * 0.9 + 0.1, 0.0, 1.0));
        vec3 h = normalize(sun + v); c += vec3(1.0, 0.95, 0.85) * pow(max(dot(n, h), 0.0), 180.0) * 1.4 * step(0.0, sun.y);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 64).rotateX(-Math.PI / 2), mat);
  m.userData.update = (t) => { mat.uniforms.t.value = t; };
  return m;
}

// The Sun as seen from space or the Moon: a white-hot disc with a soft glare round it
export function spaceSun(size = 60) {
  const g = new THREE.Group(); g.add(glowSprite(0xffffff, size, 1), glowSprite(0xfff4e0, size * 4, 0.35));
  return g;
}
