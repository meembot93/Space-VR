// Real surfaces: photo textures (CC0, from Poly Haven and ambientCG, see textures/CREDITS.md) laid
// over the game's own colours, so grounds and walls get real grain, pebbles, grass blades and bumps
// while each chapter keeps its painted look (its colours, its day or night).
//
// Ground: texGround(mesh, opts) gives a ground mesh (a PlaneGeometry with vertex colours, as every
// chapter builds its ground) the ground shader. It picks, per spot, from up to three layers by the
// vertex colour there: green spots get `green` (grass), bright/pale spots `pale` (sand, chalk, snow,
// stone) and the rest `earth` (dirt). Each layer is a detail texture (colour divided by its own
// blur, so it only adds detail, never changes the colour) and a normal map. Two scales per layer
// and a slow brightness wander hide the repeat.
//   opts: { green: 'grass', earth: 'dirt', pale: 'sand', scale: 2.2 (m per repeat), strength: 1.6,
//           bump: 1.6, wander: 0.22 }   layer names are files in textures/ground/<name>_d/_n.jpg
import * as THREE from 'three';

const DIR = new URL('../textures/', import.meta.url).href;
const loader = new THREE.TextureLoader();
const cache = new Map();
export function tex(path, { srgb = false, aniso = 8 } = {}) {
  if (cache.has(path)) return cache.get(path);
  const t = loader.load(DIR + path);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  cache.set(path, t);
  return t;
}

export const OFF = typeof location !== 'undefined' && new URLSearchParams(location.search).has('notex');

const GROUND_VERT_PARS = 'varying vec3 vGW;\n';
const GROUND_FRAG_PARS = `
varying vec3 vGW;
uniform sampler2D gD0, gN0, gD1, gN1, gD2, gN2;
uniform float gScale, gStrength, gBump, gWander;
vec3 gDet(sampler2D d, vec2 uv) {
  // two scales, the second turned, so no repeat lines up
  vec3 a = texture2D(d, uv).rgb;
  vec3 b = texture2D(d, mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.37 + 0.31).rgb;
  return (a * 0.62 + b * 0.38) * 2.0;
}
vec3 gNor(sampler2D n, vec2 uv) { return texture2D(n, uv).xyz * 2.0 - 1.0; }
float gHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y); }
`;
// weights from the colour at this spot: green -> layer 0, pale -> layer 2, else layer 1
const GROUND_WEIGHTS = `
  vec3 gC = vColor.rgb;
  vec3 gS = sqrt(max(gC, 0.0));                       // about sRGB, as the colours were picked
  float gL = dot(gS, vec3(0.3, 0.59, 0.11));
  float gGreen = smoothstep(0.0, 0.05, gS.g - max(gS.r, gS.b) * 0.97);
  float gPale = (1.0 - gGreen) * smoothstep(0.56, 0.72, gL);
  vec3 gW = vec3(gGreen, (1.0 - gGreen) * (1.0 - gPale), gPale);
  vec2 gUV = vec2(vGW.x, -vGW.z) / gScale;
`;

export function groundMaterial(base, o = {}) {
  if (OFF) return base;
  const L = [o.green || 'grass', o.earth || 'dirt', o.pale || 'sand'];
  const m = base;
  m.flatShading = false;
  const u = {
    gScale: { value: o.scale || 2.2 }, gStrength: { value: o.strength ?? 1.6 }, gBump: { value: o.bump ?? 1.6 }, gWander: { value: o.wander ?? 0.22 },
  };
  L.forEach((name, i) => { u['gD' + i] = { value: tex(`ground/${name}_d.jpg`) }; u['gN' + i] = { value: tex(`ground/${name}_n.jpg`) }; });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = GROUND_VERT_PARS + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = GROUND_FRAG_PARS + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  ${GROUND_WEIGHTS}
  vec3 gDetail = vec3(0.0);
  if (gW.x > 0.01) gDetail += gW.x * gDet(gD0, gUV);
  if (gW.y > 0.01) gDetail += gW.y * gDet(gD1, gUV * 0.9);
  if (gW.z > 0.01) gDetail += gW.z * gDet(gD2, gUV * 0.8);
  gDetail /= max(gW.x + gW.y + gW.z, 0.001);
  float gWand = 1.0 + gWander * (gNoise(vGW.xz * 0.045) - 0.5) * 2.0 + gWander * 0.5 * (gNoise(vGW.xz * 0.21) - 0.5);
  float gHue = gNoise(vGW.xz * 0.03 + 17.0);
  diffuseColor.rgb *= max(mix(vec3(1.0), gDetail, gStrength), 0.0) * gWand * mix(vec3(1.06, 1.0, 0.9), vec3(0.93, 1.0, 1.07), gHue);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 gn = vec3(0.0);
    if (gW.x > 0.01) gn += gW.x * gNor(gN0, gUV);
    if (gW.y > 0.01) gn += gW.y * gNor(gN1, gUV * 0.9);
    if (gW.z > 0.01) gn += gW.z * gNor(gN2, gUV * 0.8);
    gn.xy *= gBump;
    vec3 T = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    vec3 B = normalize((viewMatrix * vec4(0.0, 0.0, -1.0, 0.0)).xyz);
    T = normalize(T - normal * dot(normal, T)); B = normalize(B - normal * dot(normal, B));
    normal = normalize(T * gn.x + B * gn.y + normal * max(gn.z, 0.2));
  }`);
  };
  m.customProgramCacheKey = () => 'ground3:' + L.join(',');
  m.needsUpdate = true;
  return m;
}

// Give a ground mesh the ground shader (replaces its material with a smooth-shaded copy)
export function texGround(mesh, o = {}) {
  if (OFF || !mesh?.material || mesh.userData.ground3) return mesh;
  const old = mesh.material;
  const m = old.isMeshLambertMaterial || old.isMeshStandardMaterial ? old.clone() : new THREE.MeshLambertMaterial({ vertexColors: true });
  m.vertexColors = true;
  if (!mesh.geometry.attributes.normal || old.flatShading) mesh.geometry.computeVertexNormals();
  mesh.material = groundMaterial(m, o);
  mesh.userData.ground3 = true;
  return mesh;
}

// ---------- Walls and floors ----------
// surface(kind, col): a material with real grain for a wall or floor whose UVs are in metres / rep
// (rep about 1.5 m, as Era 3's rooms and quads use). col keeps the chapter's chosen colour: the
// photo only adds its detail (boards, joints, pores, bumps) on top. Returns null for an unknown kind.
//   kinds: plaster, boards, parquet, checker, concrete, brick, redbrick, ashlar, mudbrick, marble,
//          rooftiles, cobbles, sandstone, rubble, clayplaster, asphalt
// rep: how many of the photo's repeats fit in one UV unit; nScale: bump strength
export const SURF = {
  plaster: { col: '#d8d0bc', rep: 0.5, n: 0.6 }, boards: { col: '#8a6a48', rep: 0.75, n: 0.6 }, parquet: { col: '#a07a50', rep: 1.0, n: 0.5 },
  checker: { col: '#a8a49a', rep: 0.75, n: 0.5 }, concrete: { col: '#a8a49c', rep: 0.5, n: 0.7 }, brick: { col: '#9a6a52', rep: 0.75, n: 1 },
  redbrick: { col: '#8a3a2a', rep: 0.75, n: 1 }, ashlar: { col: '#b8a888', rep: 0.4, n: 1 }, mudbrick: { col: '#a08060', rep: 0.5, n: 0.9 },
  marble: { col: '#e8e0d0', rep: 0.5, n: 0.4 }, rooftiles: { col: '#a8583a', rep: 0.75, n: 1 }, cobbles: { col: '#8a8478', rep: 0.75, n: 1 },
  sandstone: { col: '#b89868', rep: 0.5, n: 0.8 }, rubble: { col: '#a89070', rep: 0.5, n: 1 }, clayplaster: { col: '#c8b8a0', rep: 0.5, n: 0.6 },
  asphalt: { col: '#5a5a58', rep: 0.4, n: 0.6 }, grass: { col: '#5a8a3a', rep: 2, n: 0.8, path: 'ground/grass' },
};
const _c = new THREE.Color();
export function surfaceTex(kind, rep = 1) {
  const S = SURF[kind]; if (!S) return null;
  const k = `${kind}@${rep}`;
  if (cache.has(k)) return cache.get(k);
  const one = (f) => { const t = loader.load(DIR + f); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.repeat.set(S.rep * rep, S.rep * rep); return t; };
  const P = S.path || `surf/${kind}`, d = one(`${P}_d.jpg`), n = one(`${P}_n.jpg`);
  const r = { d, n }; cache.set(k, r); return r;
}
// Turn a material that shows a flat colour (or a painted canvas) into one with real detail
export function surface(kind, col = null, { rough = 0.9, metal = 0, tint = 0xffffff, rep = 1, bump = 1, keepMap = false, base = null } = {}) {
  if (OFF) return null;
  const S = SURF[kind]; if (!S) return null;
  const T = surfaceTex(kind, rep);
  const m = base || new THREE.MeshStandardMaterial({ roughness: rough, metalness: metal });
  if (!keepMap) { m.map = T.d; m.color.set(col || S.col).multiply(_c.set(tint)).multiplyScalar(2); }
  m.normalMap = T.n; m.normalScale = new THREE.Vector2(S.n * bump, S.n * bump);
  m.needsUpdate = true;
  return m;
}

// Find a chapter's ground (big, flat-lying PlaneGeometry meshes with vertex colours) and give it the
// ground shader. A chapter can set this.groundTex = { ...texGround opts } or false to skip.
const _b = new THREE.Box3();
export function autoGround(root, opts = {}) {
  if (OFF || opts === false) return 0;
  let n = 0;
  root.traverse((m) => {
    if (!m.isMesh || m.isInstancedMesh || m.userData.ground3 || m.userData.noGroundTex) return;
    const g = m.geometry, mat = m.material;
    if (!g?.attributes?.color || Array.isArray(mat) || !(mat.isMeshLambertMaterial || mat.isMeshStandardMaterial)) return;
    if (mat.transparent || mat.map) return;
    if (!/Plane/.test(g.type) && !m.userData.isGround) return;
    if (!g.boundingBox) g.computeBoundingBox(); _b.copy(g.boundingBox);
    const sx = _b.max.x - _b.min.x, sy = _b.max.y - _b.min.y, sz = _b.max.z - _b.min.z;
    if (Math.min(sx, sz) < 40 || sy > Math.min(sx, sz) * 0.5) return;   // big and lying flat
    texGround(m, opts); n++;
  });
  return n;
}

// ---------- Solid things: walls, houses, towers built from coloured boxes ----------
// texSolid(mesh, kind, opts) lays a surface's photo detail over a vertex-coloured mesh (Kit boxes)
// from three sides by world position (no UVs needed), plus grime near the ground and slow
// weathering patches, so a plain box city reads as mud brick, stone or plaster.
//   opts: { scale: metres per repeat (2), strength: 1.4, bump: 1, ground: y of the street (grime
//           below ground + 1.2 m), grime: 0.35, weather: 0.25 }
const SOLID_FRAG = `
varying vec3 vGW; varying vec3 vGN;
uniform sampler2D sD, sN; uniform float sScale, sStrength, sBump, sGround, sGrime, sWeather;
float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(sHash(i), sHash(i + vec2(1, 0)), f.x), mix(sHash(i + vec2(0, 1)), sHash(i + vec2(1, 1)), f.x), f.y); }
`;
export function texSolid(mesh, kind, o = {}) {
  if (OFF || !mesh?.material || mesh.userData.solid3) return mesh;
  const S = SURF[kind]; if (!S) return mesh;
  const old = mesh.material;
  const m = old.clone();
  const u = { sD: { value: tex(`${S.path || 'surf/' + kind}_d.jpg`) }, sN: { value: tex(`${S.path || 'surf/' + kind}_n.jpg`) }, sScale: { value: o.scale || 2 }, sStrength: { value: o.strength ?? 1.4 },
    sBump: { value: (o.bump ?? 1) * S.n }, sGround: { value: o.ground ?? -1e4 }, sGrime: { value: o.grime ?? 0.35 }, sWeather: { value: o.weather ?? 0.25 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vGW; varying vec3 vGN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 wp = vec4(transformed, 1.0); vec3 wn = objectNormal;
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp; wn = mat3(instanceMatrix) * wn;
  #endif
    vGW = (modelMatrix * wp).xyz; vGN = normalize(mat3(modelMatrix) * wn); }`);
    sh.fragmentShader = SOLID_FRAG + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 sW = abs(normalize(vGN)); sW = pow(sW, vec3(4.0)); sW /= sW.x + sW.y + sW.z;
  vec2 uX = vec2(vGW.z, vGW.y) / sScale, uY = vec2(vGW.x, vGW.z) / sScale, uZ = vec2(vGW.x, vGW.y) / sScale;
  vec3 sDet = (sW.x > 0.02 ? sW.x * texture2D(sD, uX).rgb : vec3(0.0)) + (sW.y > 0.02 ? sW.y * texture2D(sD, uY).rgb : vec3(0.0)) + (sW.z > 0.02 ? sW.z * texture2D(sD, uZ).rgb : vec3(0.0));
  sDet *= 2.0 / max(sW.x * step(0.02, sW.x) + sW.y * step(0.02, sW.y) + sW.z * step(0.02, sW.z), 0.001);
  float sUp = vGW.y - sGround;
  float sGr = sGrime * (1.0 - smoothstep(0.0, 1.4, sUp)) * step(-0.5, sUp);
  float sWe = 1.0 + sWeather * (sNoise(vGW.xz * 0.13 + vGW.y * 0.21) - 0.5) + sWeather * 0.6 * (sNoise(vec2(vGW.x + vGW.z, vGW.y) * 0.7) - 0.5);
  diffuseColor.rgb *= max(mix(vec3(1.0), sDet, sStrength), 0.0) * sWe * (1.0 - sGr);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 nX = texture2D(sN, uX).xyz * 2.0 - 1.0, nY = texture2D(sN, uY).xyz * 2.0 - 1.0, nZ = texture2D(sN, uZ).xyz * 2.0 - 1.0;
    vec3 wn = normalize(vGN); vec3 sg = sign(wn);
    // whiteout blend of the three projections, in world space
    vec3 tX = vec3(0.0, nX.y, nX.x * sg.x) * sBump, tY = vec3(nY.x, 0.0, -nY.y * sg.y) * sBump, tZ = vec3(nZ.x * sg.z, nZ.y, 0.0) * sBump;
    vec3 wnb = normalize(wn + tX * sW.x + tY * sW.y + tZ * sW.z);
    normal = normalize((viewMatrix * vec4(wnb, 0.0)).xyz);
  }`);
  };
  m.customProgramCacheKey = () => 'solid3:' + kind + (m.flatShading ? 'f' : '');
  m.needsUpdate = true;
  mesh.material = m; mesh.userData.solid3 = true;
  return mesh;
}
