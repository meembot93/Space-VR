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
  if (OFF || !mesh?.material) return mesh;
  const old = mesh.material;
  const m = old.isMeshLambertMaterial || old.isMeshStandardMaterial ? old.clone() : new THREE.MeshLambertMaterial({ vertexColors: true });
  m.vertexColors = true;
  if (!mesh.geometry.attributes.normal || old.flatShading) mesh.geometry.computeVertexNormals();
  mesh.material = groundMaterial(m, o);
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
  asphalt: { col: '#5a5a58', rep: 0.4, n: 0.6 },
};
const _c = new THREE.Color();
export function surfaceTex(kind, rep = 1) {
  const S = SURF[kind]; if (!S) return null;
  const k = `${kind}@${rep}`;
  if (cache.has(k)) return cache.get(k);
  const d = tex(`surf/${kind}_d.jpg`).clone(), n = tex(`surf/${kind}_n.jpg`).clone();
  for (const t of [d, n]) { t.repeat.set(S.rep * rep, S.rep * rep); }
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
