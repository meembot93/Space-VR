// Dressing a character model differently, so two people made from the same Tripo model don't look
// like twins: their clothes get another colour, their hair can go grey or dark, and they can be a
// little broader or slimmer. The face and hands keep their own colours.
//
//   dress(P, { hue: 0.3, sat: 0.8, val: 1.1, hair: 0x9a9a9a, build: 1.06 })
//     hue   turn the clothes' colour round the colour wheel (0..1 is a full turn)
//     sat   more (>1) or less (<1) colourful clothes      val  lighter (>1) or darker (<1) clothes
//     mul   a colour the clothes are multiplied by (e.g. to dye white linen brown)
//     hair  colour for the dark hair and beard (only on the head)     build  body width (1 = as made)
//
// It works on the skinned mesh: weights for the head, neck and hands say "leave this alone", the
// body, upper arms and thighs say "clothes"; forearms, shins and feet are clothes unless the pixel
// looks like skin. Each person gets their own copy of the material, but every dressed material uses
// one shader, so it costs no extra shader compiles.
import * as THREE from 'three';

const KEEP = /^(Neck|Head|HeadTop_End|LeftHand|RightHand|LeftEye|RightEye)/;            // never recoloured
const MAYBE = /^(LeftArm|RightArm|LeftForeArm|RightForeArm|LeftUpLeg|RightUpLeg|LeftLeg|RightLeg|LeftFoot|RightFoot|LeftToe|RightToe)/;   // clothes unless skin
const HEAD = /^(Neck|Head|HeadTop_End)/;                                                 // where hair is

// Per-vertex weights: x = clothes for sure, y = clothes unless skin, z = head (for hair)
function maskFor(mesh) {
  const g = mesh.geometry;
  if (g.attributes.dressMask) return;
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = mesh.skeleton.bones;
  const name = (i) => bones[i]?.name.replace(/^mixamorig[:_]?/, '') || '';
  const n = g.attributes.position.count, out = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    let keep = 0, maybe = 0, head = 0;
    for (let j = 0; j < 4; j++) {
      const w = sw.getComponent(v, j); if (!w) continue;
      const nm = name(si.getComponent(v, j));
      if (KEEP.test(nm)) keep += w; else if (MAYBE.test(nm)) maybe += w;
      if (HEAD.test(nm)) head += w;
    }
    out[v * 3] = Math.max(0, 1 - keep - maybe); out[v * 3 + 1] = maybe; out[v * 3 + 2] = head;
  }
  g.setAttribute('dressMask', new THREE.BufferAttribute(out, 3));
}

function patch(m, o) {
  const u = {
    dHue: { value: (o.hue || 0) * Math.PI * 2 }, dSat: { value: o.sat ?? 1 }, dVal: { value: o.val ?? 1 },
    dHair: { value: new THREE.Color(o.hair ?? 0x000000) }, dMul: { value: new THREE.Color(o.mul ?? 0xffffff) }, dHairOn: { value: o.hair == null ? 0 : 1 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 dressMask;\nvarying vec3 vDress;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDress = dressMask;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vDress; uniform float dHue, dSat, dVal, dHairOn; uniform vec3 dHair, dMul;
vec3 dressHSV(vec3 c) { vec4 K = vec4(0., -1./3., 2./3., -1.); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6. * d + 1e-6)), d / (q.x + 1e-6), q.x); }
vec3 dressRecolor(vec3 c) {
  // turn the hue (YIQ rotation keeps brightness), then saturation and lightness
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 y = toYIQ * c; float cs = cos(dHue), sn = sin(dHue);
  y.yz = mat2(cs, sn, -sn, cs) * y.yz * dSat;
  return clamp(toRGB * y * dVal * dMul, 0., 1.); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{ vec3 c = diffuseColor.rgb, h = dressHSV(pow(max(c, 0.), vec3(0.4545)));   // judge colours as you'd see them (sRGB)
  float skin = (1. - smoothstep(0.0, 0.02, abs(h.x - 0.07) - 0.05)) * smoothstep(0.18, 0.3, h.y) * (1. - smoothstep(0.6, 0.75, h.y)) * smoothstep(0.38, 0.52, h.z);
  float k = clamp(vDress.x + vDress.y * (1. - skin), 0., 1.);
  diffuseColor.rgb = mix(c, dressRecolor(c), k);
  // hair and beard: the dark, dull pixels on the head take the new hair colour (keeping their shading)
  float hair = dHairOn * vDress.z * (1. - smoothstep(0.12, 0.35, h.z)) * (1. - smoothstep(0.2, 0.6, h.y));
  diffuseColor.rgb = mix(diffuseColor.rgb, dHair * (0.35 + 2.2 * h.z), hair); }`);
  };
  m.customProgramCacheKey = () => 'dress1';
  m.userData.dress = u;
}

// Dress P now if its model has loaded, or as soon as it does
export function dress(P, o = {}) {
  P.dressing = o;
  const apply = () => {
    if (P.dressed) return true;
    if (!P.model) return false;
    P.dressed = true;
    P.model.scene.traverse((m) => {
      if (!m.isSkinnedMesh || !m.material) return;
      maskFor(m);
      m.material = m.material.clone(); patch(m.material, o);
    });
    if (o.build && o.build !== 1) P.model.scene.scale.x *= o.build, P.model.scene.scale.z *= o.build;
    return true;
  };
  if (!apply()) { let n = 0; const iv = setInterval(() => { if (apply() || ++n > 240) clearInterval(iv); }, 250); }
  return P;
}

// A handful of looks that read clearly as different clothes on the same model
export const LOOKS = [
  { hue: 0, sat: 1, val: 1 },
  { hue: 0.55, sat: 0.9, val: 0.85, build: 1.05 },
  { hue: 0.33, sat: 0.8, val: 0.95, hair: 0x7a7470, build: 0.96 },
  { hue: 0.9, sat: 1.2, val: 0.75, build: 1.08 },
  { hue: 0.15, sat: 0.5, val: 1.15, hair: 0x2a1a10 },
  { hue: 0.7, sat: 0.7, val: 0.9, hair: 0xb0aca4, build: 0.94 },
];
