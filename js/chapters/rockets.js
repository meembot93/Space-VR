// Era 2, Chapter 6 (n 13): the rocket dreamers. Four places.
//
// 1. Kaluga, Russia, a winter night in 1903. Konstantin Tsiolkovsky's glazed veranda study in his
//    wooden house: log walls, a white tiled stove, a kerosene lamp, the schoolteacher's chalkboard,
//    his tin model airship hanging from the beams, a bicycle, a samovar, a cat on the windowsill.
//    Snow falls on the yard, the street, the log houses with carved white window frames, the golden
//    domes, the frozen Oka. His ideas come alive as glowing chalk drawings in the air: Newton's
//    cannon and Jules Verne's Moon cannon out over the roofs (crossed out: it would never work), his
//    liquid-fuel rocket, a balloon zooming round the room, the rocket train dropping its stages, and
//    "the Earth is the cradle of humanity": the chalk rocket flies out of the window to the stars.
// 2. Auburn, Massachusetts, 16 March 1926: the snowy field on Aunt Effie's farm. Goddard's spindly
//    rocket in its launch frame (motor on top, tanks below), Esther filming, Henry Sachs with the
//    blowtorch on a pole. "All right, Henry. Light it." (Adults: you are Henry.) Roar, a 2.5 second
//    hop, 12.5 m up, and it lands in the cabbage patch; the dog bolts, the crows scatter. Then (wow)
//    the rockets that came after rise as giant chalk outlines across the field: the V-2, the Saturn V,
//    the rockets of today. Newspapers mock him, and a glowing bubble of empty space shows that a
//    rocket pushes on its own gas (with an echo of Newton). The 1969 correction.
// 3. Peenemünde on the Baltic, 1944, at dusk in the misty pines: the V-2 alone on its firing table
//    under floodlights. Sombre: no violence, a row of small remembrance lights for the prisoners who
//    were forced to build it. Then it climbs through the clouds, lighting them from inside...
// 4. ...out to the edge of space (the Earth's curve below), and the map of where the rocket
//    builders went after the war: America and the Soviet Union, and a faint beep. Back in Kaluga
//    at night for the journal page.
// World axes: -Z north, +X east, +Y up.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, walkToward, holdProp, dropProp } from '../people.js';
import { makeHerd, makeFlock, makeSmoke, makeTorch, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { glowPoints, rumble, whoosh, awe, shimmer, beeps } from '../wow/fx.js';
import { Space, lonLat } from '../wow/space.js';
import { D2R, ease, clamp01, at, sunAt, house, windows, gableRoof, gableWall, glow, label, Journal, INK, guideUpdate } from '../era2/common.js';

const N1 = noise2(131), N2 = noise2(133), N3 = noise2(137);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _col = new THREE.Color();
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const RX = 2.6, RZ = 2.2, RH = 2.9;                 // Tsiolkovsky's veranda study
const LAT_K = 54.5, SL_K = 275, LAT_A = 42.2, SL_A = 355, LAT_P = 54.1, SL_P = 89;
const EYE_K = V3(0.6, 1.6, 1.0);                     // where you stand in Kaluga (eyes)
const CHAIR = V3(-0.95, 0, -0.78), SEAT_Y = 0.47;     // Tsiolkovsky's chair at the desk (seat top), facing north
const SEAT_FRONT = V3(-0.95, 0, -1.1), DESK_SIDE = V3(-0.36, 0, -1.1), TALK_SPOT = V3(-0.42, 0, -0.3);
const FRAME = V3(0, 0, -2.2);                        // Goddard's launch frame
const LAND = V3(-38, 0, -42);
// the flight: straight up 4.2 m in the frame, then an arc 12.5 m high (above the frame's foot) to the cabbages
const FLY = (() => { const u0 = 0.22, h0 = 4.2, M = 12.5 - h0, D = h0 + 0.1; const a = 2 * M + 2 * Math.sqrt(M * (M + D)), b = a + D; return { u0, h0, a, b, apex: u0 + (1 - u0) * a / (2 * b) }; })();
const IGNITER_Y = 2.24;   // the igniter hangs in the mouth of the nozzle (rocket's own height)
const HENRY_LIGHT = V3(1.3, 0, -0.75);   // where Henry stands to light it, a pole's length from the nozzle
const CAMERA_A = V3(4.3, 0, -1.5), ESTHER = V3(4.76, 0, -1.5);   // Esther's movie camera (lens to the west, at the rocket) and her place behind it                        // the cabbage patch, 56 m away
const PAD = V3(0, 0, -55);                           // the V-2's firing table
const CLOUD = 200;                                   // the cloud deck over Peenemünde
const PEEN = [54.15, 13.8], WSANDS = [32.4, -106.5], MOSCOW = [55.75, 37.6];

// ---------- the ground in each place ----------
function valley(z) { // Kaluga: the high bank, the slope down to the frozen Oka, the far bank
  if (z > -30) return -0.55;
  if (z > -250) return -0.55 - 28 * ease((-30 - z) / 220);
  if (z > -330) return -28.6;
  return -28.6 + Math.min(30, (-330 - z) * 0.12);
}
export function kalugaHeight(x, z) {
  if (Math.abs(x) < RX + 0.05 && Math.abs(z) < RZ + 0.05) return 0;
  return valley(z) + (N1(x / 40, z / 40) - 0.5) * 1.6 * clamp((Math.hypot(x, z) - 15) / 30, 0, 1) + (N2(x / 6, z / 6) - 0.5) * 0.12;
}
// (level where the people and the props stand, within 8 m of the frame; rolling further out)
export function auburnHeight(x, z) { const d = Math.hypot(x - 1.5, z); return (N1(x / 90 + 7, z / 90) - 0.5) * 5 * clamp((d - 30) / 80, 0, 1) + (N2(x / 9, z / 9) - 0.5) * 0.25 * clamp((d - 8) / 10, 0, 1); }
// (level round the firing table, along the walk back and at your post, so the concrete and the people sit right on it)
function balticHeight(x, z) {
  const dp = Math.hypot(x, z - PAD.z), dw = Math.abs(x - 3) < 9 && z > PAD.z && z < 6 ? 0 : Math.min(dp - 14, Math.hypot(x, z) - 8);
  return (N3(x / 60, z / 60) - 0.5) * 2 * clamp((dp - 45) / 60, 0, 1) + (N2(x / 7, z / 7) - 0.5) * 0.1 * clamp(Math.min(dp - 14, dw) / 6, 0, 1);
}

function groundMesh(size, seg, hf, colf, patch = null) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (size / 2), 1.7) * (size / 2) / r0 : 0; x *= kk; z *= kk;
    // under the fine ground patch near you, this coarse ground ducks out of the way (one surface, no flicker)
    const under = patch && Math.abs(x - patch.x) < patch.w / 2 - 0.5 && Math.abs(z - patch.z) < patch.d / 2 - 0.5;
    const y = hf(x, z) - (under ? 0.3 : 0); p.setXYZ(i, x, y, z); colf(x, z, y, c); cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, FLAT);
}
// The ground right round you, fine enough (about 30 cm) that it matches the height function exactly,
// so feet, frame legs and tripod spurs stand on it, not above or in it. Its rim folds down a little to
// meet the coarse ground. colf(x, z, y, c) colours it; edge() lets the coarse colours take over at the rim.
function groundPatch({ x: cx, z: cz, w, d }, step, hf, colf) {
  const nx = Math.round(w / step), nz = Math.round(d / step);
  const g = new THREE.PlaneGeometry(w, d, nx, nz); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx, z = p.getZ(i) + cz, rim = Math.min(w / 2 - Math.abs(x - cx), d / 2 - Math.abs(z - cz));
    const y = hf(x, z) - (rim < 0.01 ? 0.06 : 0); p.setXYZ(i, x, y, z); colf(x, z, y, c, clamp01(rim / 6)); cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, FIG_MAT);
}
// a cylinder between two points (pipes, struts, branches)
function pipe(k, a, b, r, col, seg = 5) {
  const d = _d.subVectors(b, a), L = d.length(); if (L < 1e-4) return;
  const g = new THREE.CylinderGeometry(r, r, L, seg); g.translate(0, L / 2, 0);
  g.applyQuaternion(_q.setFromUnitVectors(UP, d.normalize())); g.translate(a.x, a.y, a.z); k.add(g, col);
}

// a curve of points through a list (bent wood, hoses, cables)
function bend(k, pts, r, col, sides = 6) { k.tube(pts.map((p) => (p.toArray ? p.toArray() : p)), r, col, sides); }
// A bentwood (Thonet No. 14) chair at (x, z), facing -z: round cane seat, splayed legs, a leg ring,
// and the back legs sweeping up into the hooped back.
function bentwoodChair(k, x, z, seatY) {
  const BW = 0x3a2214, CANE = 0xb89a5a, R = 0.2;
  k.cyl(R, R, 0.02, 20, CANE, [x, seatY - 0.01, z]); k.add(new THREE.TorusGeometry(R, 0.018, 5, 24), BW, [x, seatY - 0.012, z], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 10; i++) k.box(0.004, 0.003, R * 1.9 * Math.sin(Math.acos((i - 4.5) / 5.2)), 0x9a7e44, [x + (i - 4.5) * 0.038, seatY + 0.001, z]);
  // front legs: splayed, tapering
  for (const s of [-1, 1]) pipe(k, V3(x + s * 0.13, seatY - 0.02, z - 0.14), V3(x + s * 0.17, 0, z - 0.2), 0.016, BW, 6);
  // back legs run on up into the back
  for (const s of [-1, 1]) bend(k, [[x + s * 0.18, 0, z + 0.22], [x + s * 0.15, seatY * 0.5, z + 0.17], [x + s * 0.15, seatY, z + 0.15], [x + s * 0.155, seatY + 0.25, z + 0.19], [x + s * 0.14, seatY + 0.47, z + 0.22]], 0.016, BW);
  k.add(new THREE.TorusGeometry(0.14, 0.015, 5, 16, Math.PI), BW, [x, seatY + 0.47, z + 0.22], [-0.12, 0, 0]);
  bend(k, [[x - 0.1, seatY + 0.02, z + 0.16], [x - 0.11, seatY + 0.2, z + 0.18], [x, seatY + 0.33, z + 0.2], [x + 0.11, seatY + 0.2, z + 0.18], [x + 0.1, seatY + 0.02, z + 0.16]], 0.011, BW);
  k.add(new THREE.TorusGeometry(0.17, 0.011, 4, 20), BW, [x, 0.2, z], [Math.PI / 2, 0, 0]);
  for (const [ox, oz] of [[-0.13, -0.08], [0.13, -0.08], [-0.13, 0.1], [0.13, 0.1]]) pipe(k, V3(x + ox, seatY - 0.02, z + oz), V3(x + ox * 0.95, seatY - 0.09, z + oz * 1.05), 0.008, BW, 4);
}

// Sitting, for Meem's rigged models (Tripo, Mixamo bones): the thighs go forward level with the
// seat, the shins down to the floor, and the whole body drops so the hips rest on the seat.
// Call after animatePerson. k: 0 standing .. 1 seated. seatY: seat top, in the figure's parent space.
const _sa = new THREE.Vector3(), _sb = new THREE.Vector3(), _sd = new THREE.Vector3(), _sq = new THREE.Quaternion(), _sq2 = new THREE.Quaternion();
function aimBoneTo(bone, child, want, k) {
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(false, false);
  bone.getWorldPosition(_sa); child.getWorldPosition(_sb);
  _sq.setFromUnitVectors(_sd.subVectors(_sb, _sa).normalize(), want);
  bone.getWorldQuaternion(_sq2).premultiply(_sq); bone.parent.getWorldQuaternion(_q).invert(); _sq2.premultiply(_q);
  bone.quaternion.slerp(_sq2, k);
}
function sitPose(P, k, seatY, floorY = 0) {
  if (!P.rig || k <= 0.001) return;
  const B = P.rig.bones;
  if (!B.LeftUpLeg || !B.LeftLeg || !B.LeftFoot) return;
  if (P.hipRest == null) {   // hip joint and ankle heights standing (legs are at rest here: animatePerson reset them)
    P.inner.position.y = 0; P.g.updateWorldMatrix(true, true);
    P.hipRest = B.LeftUpLeg.getWorldPosition(_sa).y - P.g.getWorldPosition(_sb).y;
    P.ankleRest = B.LeftFoot.getWorldPosition(_sa).y - _sb.y;
  }
  // drop the body so the hip joints sit just above the seat (the thighs have some thickness)
  P.inner.position.y = lerp(0, seatY + 0.1 - P.hipRest, k);
  P.inner.updateWorldMatrix(true, true);
  ['Left', 'Right'].forEach((side, i) => {
    const up = B[side + 'UpLeg'], low = B[side + 'Leg'], foot = B[side + 'Foot'];
    _a.set((i ? -1 : 1) * 0.12, -0.12, 1).normalize().transformDirection(P.inner.matrixWorld);
    aimBoneTo(up, low, _a, k);
    // the shin reaches down to the floor, angled forward a little if it is longer than the drop
    low.updateWorldMatrix(true, false); low.getWorldPosition(_b); foot.getWorldPosition(_c);
    const L = _b.distanceTo(_c), drop = Math.max(0.05, _b.y - (floorY + P.ankleRest)), fwd = Math.sqrt(Math.max(0.0025, L * L - drop * drop));
    _c.set((i ? -1 : 1) * 0.02, -drop, fwd).normalize();
    _c.transformDirection(P.inner.matrixWorld);
    aimBoneTo(low, foot, _c, k);
  });
}

// ---------- Dressed figures (for people with no Tripo model yet) ----------
// Better than the plain clay stand-in: a smooth turned body (coat or skirt), boots, gloves, collar,
// scarf, a period hat and a face, so each one reads as a different person in their own clothes.
// Works with animatePerson (stand-in arms) and swings its own legs when walking (animateFigure).
// o: { height, coat, coatLen (0 hip .. 1 ankle), skirt, trousers, boots, skin, hair, hat, hatCol,
//      scarf, collar (fur colour), beard, glasses, gloves, seed }
const FIG_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
function makeFigure(o = {}) {
  const H = (o.height || 1.75) / 1.75, coat = o.coat ?? 0x3a3a40, skin = o.skin ?? 0xd8b098, hair = o.hair ?? 0x4a3020;
  const boots = o.boots ?? 0x1e1a18, legCol = o.trousers ?? 0x2a2a2e, gl = o.gloves ?? 0x2a2420;
  const k = new Kit();
  // the coat (or dress): a turned profile from the hem up to the shoulders, slightly flared
  const hemY = lerp(0.82, 0.22, o.coatLen ?? 0.6), prof = [[0.0, hemY - 0.01], [0.27, hemY], [0.25, hemY + 0.12], [0.2, 0.92], [0.185, 1.0], [0.2, 1.15], [0.215, 1.3], [0.2, 1.38], [0.13, 1.43], [0.07, 1.45], [0.0, 1.45]];
  if (o.skirt) prof[1][0] = 0.3;
  const lg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 18); lg.scale(1, 1, 0.78); k.add(lg, coat);
  // buttons, a belt, pocket flaps
  for (let i = 0; i < 4; i++) k.ball(0.012, 0, 0x1a1a1a, [0.035, 1.28 - i * 0.12, 0.165 - i * 0.004]);
  if (o.belt) k.cyl(0.19, 0.19, 0.04, 16, o.belt, [0, 0.98, 0], 0, [1, 1, 0.8]);
  for (const s of [-1, 1]) k.box(0.12, 0.012, 0.03, coat, [s * 0.12, 0.86, 0.17], [0.2, 0, 0], 0.85);
  // collar: fur, a turned-up coat collar, or a knitted scarf with its ends hanging
  if (o.collar != null) k.add(new THREE.TorusGeometry(0.1, 0.045, 6, 14), o.collar, [0, 1.43, 0.01], [Math.PI / 2 - 0.15, 0, 0], [1, 0.85, 1]);
  else k.cyl(0.09, 0.12, 0.08, 10, coat, [0, 1.46, 0], 0, [1, 1, 0.9], 0.9);
  if (o.scarf != null) { k.add(new THREE.TorusGeometry(0.085, 0.03, 5, 12), o.scarf, [0, 1.46, 0.01], [Math.PI / 2, 0, 0]); k.box(0.07, 0.32, 0.025, o.scarf, [0.06, 1.3, 0.17], [0.1, 0, 0.08]); }
  // neck, head, face (nose, ears, eyes, brows, mouth), hair
  k.cyl(0.05, 0.055, 0.09, 8, skin, [0, 1.5, 0]);
  k.ball(0.105, 2, skin, [0, 1.62, 0.005], 0, [0.92, 1.12, 1.02]);
  k.cyl(0.006, 0.019, 0.045, 6, skin, [0, 1.615, 0.112], [-1.35, 0, 0], 0.95);
  for (const s of [-1, 1]) { k.ball(0.022, 0, skin, [s * 0.097, 1.615, -0.005], 0, [0.5, 1, 0.8], 0.92); k.ball(0.011, 0, 0x2a2420, [s * 0.036, 1.638, 0.093]); k.box(0.04, 0.008, 0.01, hair, [s * 0.038, 1.665, 0.094], [0, 0, -s * 0.12]); }
  k.box(0.04, 0.006, 0.01, 0x8a4a40, [0, 1.565, 0.098]);
  if (o.glasses) for (const s of [-1, 1]) k.add(new THREE.TorusGeometry(0.019, 0.003, 4, 10), 0x2a2a2a, [s * 0.036, 1.638, 0.1]);
  if (o.beard) k.ball(0.085, 1, hair, [0, 1.545, 0.045], 0, [1, 0.85, 0.8]);
  if (o.moustache) k.box(0.06, 0.012, 0.015, hair, [0, 1.58, 0.1]);
  k.ball(0.108, 1, hair, [0, 1.655, -0.02], 0, [0.95, 0.85, 1.0]);
  if (o.longHair) k.ball(0.09, 1, hair, [0, 1.56, -0.07], 0, [1.1, 1.2, 0.7]);
  // hats
  const hc = o.hatCol ?? 0x2a2a2a;
  if (o.hat === 'cloche') { k.ball(0.125, 2, hc, [0, 1.67, -0.005], 0, [1, 0.82, 1.05]); k.cyl(0.15, 0.15, 0.012, 18, hc, [0, 1.625, 0.0], [0.12, 0, 0], 0.9); k.add(new THREE.TorusGeometry(0.115, 0.012, 4, 16), o.hatBand ?? 0x8a2a3a, [0, 1.65, 0], [Math.PI / 2 - 0.12, 0, 0]); k.ball(0.03, 0, o.hatBand ?? 0x8a2a3a, [0.1, 1.67, 0.06]); }
  else if (o.hat === 'fedora') { k.cyl(0.1, 0.115, 0.12, 14, hc, [0, 1.74, -0.01]); k.cyl(0.18, 0.18, 0.012, 18, hc, [0, 1.69, -0.01], [-0.06, 0, 0]); k.cyl(0.117, 0.117, 0.03, 14, 0x1a1a1a, [0, 1.7, -0.01]); k.box(0.03, 0.02, 0.18, hc, [0, 1.8, -0.01], 0, 0.8); }
  else if (o.hat === 'cap') { k.ball(0.12, 1, hc, [0, 1.69, -0.01], 0, [1.05, 0.55, 1.15]); k.box(0.17, 0.012, 0.08, hc, [0, 1.67, 0.11], [0.2, 0, 0], 0.8); }
  else if (o.hat === 'ushanka') { k.cyl(0.13, 0.12, 0.16, 14, hc, [0, 1.73, -0.01]); for (const s of [-1, 1]) k.box(0.03, 0.12, 0.1, hc, [s * 0.12, 1.62, -0.01]); k.box(0.24, 0.05, 0.03, hc, [0, 1.72, 0.12], [-0.2, 0, 0]); }
  else if (o.hat === 'shawl') { k.ball(0.125, 1, hc, [0, 1.64, -0.01], 0, [1.02, 1.05, 1.08]); k.cyl(0.001, 0.2, 0.35, 12, hc, [0, 1.4, -0.03], 0, [1, 1, 0.75]); }
  else if (o.hat === 'fieldcap') { k.box(0.2, 0.08, 0.24, hc, [0, 1.73, -0.01]); k.box(0.2, 0.02, 0.06, hc, [0, 1.69, 0.13], [0.35, 0, 0]); }
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); g.userData.kind = 'characters';
  inner.add(new THREE.Mesh(k.geometry(), FIG_MAT));
  // legs (trousers or stockings, boots), each turning at the hip
  const legs = [];
  for (const sx of [-1, 1]) {
    const lk = new Kit(); lk.cyl(0.062, 0.05, 0.78, 10, legCol, [0, -0.43, 0]); lk.cyl(0.055, 0.058, 0.18, 10, boots, [0, -0.73, 0]); lk.box(0.1, 0.07, 0.24, boots, [0, -0.79, 0.04]); lk.ball(0.05, 1, boots, [0, -0.785, 0.15], 0, [1, 0.7, 0.9]);
    const leg = new THREE.Group(); leg.add(new THREE.Mesh(lk.geometry(), FIG_MAT)); leg.position.set(sx * 0.095, 0.83, 0); inner.add(leg); legs.push(leg);
  }
  // arms in sleeves, gloved hands
  const arms = [];
  for (const sx of [-1, 1]) {
    const ak = new Kit(); ak.ball(0.07, 1, coat, [0, -0.01, 0]); ak.cyl(0.065, 0.055, 0.58, 10, coat, [0, -0.29, 0]); ak.cyl(0.06, 0.06, 0.05, 10, coat, [0, -0.56, 0], 0, 1, 0.8);
    ak.ball(0.045, 1, gl, [0, -0.63, 0.005], 0, [0.8, 1.2, 1]); ak.box(0.02, 0.05, 0.03, gl, [sx * -0.035, -0.6, 0.03]);
    const arm = new THREE.Group(); arm.add(new THREE.Mesh(ak.geometry(), FIG_MAT)); arm.position.set(sx * 0.215, 1.36, 0); inner.add(arm); arms.push(arm);
  }
  inner.scale.setScalar(H);
  return { g, inner, arms, legs, pose: 'idle', phase: (o.seed || 1) * 1.7, pointAt: new THREE.Vector3(), placeholder: true, H };
}
function animateFigureLegs(P, dt) { P.legs.forEach((l) => { l.rotation.x = damp(l.rotation.x, 0, 10, dt); }); }
function animateFigure(P, t, dt) {
  animatePerson(P, t, dt);
  const sw = P.pose === 'walk' ? Math.sin(P.stride || 0) * 0.45 : 0;
  P.legs.forEach((l, i) => { l.rotation.x = damp(l.rotation.x, i ? -sw : sw, 10, dt); });
}
// aim a figure's arm (from its shoulder) at a world point
const _fa = new THREE.Vector3(), _fq = new THREE.Quaternion(), FDOWN = new THREE.Vector3(0, -1, 0);
function aimArm(P, i, world, dt) {
  const arm = P.arms[i]; _fa.copy(world); P.inner.worldToLocal(_fa); _fa.sub(arm.position).normalize();
  _fq.setFromUnitVectors(FDOWN, _fa); arm.quaternion.slerp(_fq, Math.min(1, dt * 8));
}

// Henry's igniter: a brass blowtorch lashed to the end of a long pole (so he can light the motor from
// a step away), with its fuel tank, pump knob, burner tube and a roaring blue flame. +y runs up the pole.
function poleTorch(len = 1.9) {
  const g = new THREE.Group(), k = new Kit(), BR = 0xc09a48, POLE = 0x7a5a36;
  k.cyl(0.018, 0.024, len, 7, POLE, [0, len / 2, 0]);
  for (const y of [0.06, 0.12, len - 0.32, len - 0.22, len - 0.12]) k.cyl(0.027, 0.027, 0.018, 7, 0x8a7a58, [0, y, 0]);   // twine lashings
  k.cyl(0.042, 0.042, 0.13, 14, BR, [0.05, len - 0.2, 0]); k.ball(0.042, 1, BR, [0.05, len - 0.135, 0], 0, [1, 0.4, 1]); k.ball(0.042, 1, BR, [0.05, len - 0.265, 0], 0, [1, 0.4, 1]);
  k.cyl(0.006, 0.006, 0.06, 5, 0x3a3a3a, [0.05, len - 0.1, 0]); k.cyl(0.014, 0.014, 0.012, 8, 0x2a2a2a, [0.05, len - 0.068, 0]);   // the pump
  k.cyl(0.006, 0.006, 0.05, 5, BR, [0.085, len - 0.16, 0], [0, 0, -0.6]); k.cyl(0.013, 0.013, 0.02, 8, 0x5a1a10, [0.105, len - 0.145, 0], [0, 0, -0.6]);   // the valve
  k.tube([[0.05, len - 0.13, 0], [0.05, len - 0.06, 0], [0.04, len + 0.02, 0], [0.025, len + 0.12, 0]], 0.009, 0x8a7a4a, 6);
  k.cyl(0.016, 0.013, 0.09, 10, 0x6a6a6a, [0.022, len + 0.16, 0], [0, 0, 0.12]); k.cyl(0.019, 0.019, 0.012, 10, 0x4a4a4a, [0.017, len + 0.205, 0]);
  g.add(k.mesh(FIG_MAT));
  const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const cone = (r, L, m) => { const cg = new THREE.CylinderGeometry(0.0, r, L, 10, 1, true); cg.translate(0, L / 2, 0); return new THREE.Mesh(cg, m); };
  const fl = new THREE.Group(); fl.position.set(0.015, len + 0.21, 0); fl.add(cone(0.02, 0.2, fm(0x6a9aff, 0.55)), cone(0.011, 0.09, fm(0xd8e8ff, 0.9)), glow(0x9ab8ff, 0.22, 0.7), cone(0.03, 0.28, fm(0xff9a40, 0.22))); g.add(fl);
  const ph = Math.random() * 6;
  g.userData.flicker = (t, bright = 1) => { fl.scale.set(1 + 0.1 * Math.sin(t * 31 + ph), 0.9 + 0.2 * Math.sin(t * 23 + ph * 2), 1); fl.visible = bright > 0.05; };
  g.userData.tip = fl;
  return g;
}

// Walk toward (x, z) but around things in the way: obstacles are circles { x, z, r } (props, and other
// people). If the straight line passes through one ahead, head for a point just beside it instead.
function walkAround(P, x, z, dt, opts, obstacles) {
  const g = P.g.position; let tx = x, tz = z;
  for (let pass = 0; pass < 2; pass++) {
    const dx = tx - g.x, dz = tz - g.z, L = Math.hypot(dx, dz); if (L < 0.05) break;
    const ux = dx / L, uz = dz / L; let hit = null, best = Infinity;
    for (const o of obstacles) {
      if (o.P === P) continue;
      const ox = o.P ? o.P.g.position.x : o.x, oz = o.P ? o.P.g.position.z : o.z, R = (o.r ?? 0.3) + 0.3;
      const along = (ox - g.x) * ux + (oz - g.z) * uz; if (along < 0 || along > L + R * 0.5) continue;
      const side = (ox - g.x) * -uz + (oz - g.z) * ux;
      if (Math.abs(side) < R && along < best && Math.hypot(ox - x, oz - z) > R) { best = along; hit = { ox, oz, R, side }; }
    }
    if (!hit) break;
    const s = hit.side > 0 ? -1 : 1;   // pass on the side we are already on
    tx = hit.ox + -uz * s * (hit.R + 0.15) - ux * 0.1; tz = hit.oz + ux * s * (hit.R + 0.15) - uz * 0.1;
  }
  const arrivedAtDetour = (tx !== x || tz !== z);
  const done = walkToward(P, tx, tz, dt, { ...opts, stop: arrivedAtDetour ? 0.02 : opts.stop ?? 0.15 });
  return done && !arrivedAtDetour;
}

// ---------- Chalk drawings in the air ----------
// Dots along strokes (lists of [x, y] in metres, in the drawing's own flat plane, which faces you).
// They draw themselves in stroke order (drawRange), so a drawing appears line by line. One draw call each.
function chalkMat(color, additive) {
  return new THREE.ShaderMaterial({
    uniforms: { scale: { value: 300 }, color: { value: new THREE.Color(color) }, opacity: { value: 0 } },
    vertexShader: `attribute float size; attribute float b; varying float vB; uniform float scale;
      void main(){ vB = b; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float sc = length(modelMatrix[0].xyz); gl_PointSize = clamp(size * sc * scale / max(0.1, -mv.z), 1.5, 40.0); }`,
    fragmentShader: additive
      ? `uniform vec3 color; uniform float opacity; varying float vB; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, r); gl_FragColor = vec4(color * vB * a * opacity * 1.3, 1.0); }`
      : `uniform vec3 color; uniform float opacity; varying float vB; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.2, r); gl_FragColor = vec4(color * (0.75 + 0.25 * vB), a * opacity); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
  });
}
class Sketch {
  constructor(parent, strokes, { spacing = 0.02, dot = 0.02, color = 0xdfeaff, additive = true, secs = 2, seed = 1 } = {}) {
    const r = rng(seed * 7 + 3), P = [], S = [], Bv = [];
    for (const st of strokes) for (let i = 1; i < st.length; i++) {
      const [x0, y0] = st[i - 1], [x1, y1] = st[i], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / spacing));
      for (let j = 0; j < n; j++) { const f = j / n; P.push(x0 + (x1 - x0) * f + (r() - 0.5) * spacing * 0.6, y0 + (y1 - y0) * f + (r() - 0.5) * spacing * 0.6, 0); S.push(dot * (0.7 + 0.6 * r())); Bv.push(0.65 + 0.35 * r()); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('size', new THREE.Float32BufferAttribute(S, 1)); g.setAttribute('b', new THREE.Float32BufferAttribute(Bv, 1));
    this.n = S.length; this.pts = new THREE.Points(g, chalkMat(color, additive)); this.pts.frustumCulled = false;
    this.g = new THREE.Group(); this.g.add(this.pts); this.g.visible = false; parent.add(this.g);
    this.k = 0; this.op = 0; this.secs = secs; this.labels = [];
  }
  addLabel(text, x, y, h, opts) { const l = label(text, h, opts); l.position.set(x, y, 0.01); l.material.opacity = 0; this.g.add(l); this.labels.push(l); return l; }
  place(pos, eye) { this.g.position.copy(pos); this.g.lookAt(eye); return this; }
  update(dt, on, fast = 1, fadeSpeed = 2) {
    if (on) this.k = Math.min(1, this.k + dt * fast / this.secs);
    this.op = damp(this.op, on ? 1 : 0, fadeSpeed, dt);
    this.g.visible = this.op > 0.01;
    if (!this.g.visible) { if (!on) this.k = 0; return; }
    this.pts.geometry.setDrawRange(0, Math.floor(this.n * this.k));
    this.pts.material.uniforms.opacity.value = this.op;
    for (const l of this.labels) l.material.opacity = this.op * clamp01(this.k * 3 - 2);
  }
}
const circ = (cx, cy, r, a0 = 0, a1 = Math.PI * 2, n = 48, sy = 1) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * sy]; });
const quad = (p0, c, p1, n = 30) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]; });
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
// a rocket outline from a profile of [height, radius] pairs, with fins and a few flame flicks
function outline(prof, fins = [], flame = 0) {
  const L = prof.map(([y, r]) => [-r, y]), R = prof.map(([y, r]) => [r, y]);
  const st = [L, R, [[-prof[0][1], prof[0][0]], [prof[0][1], prof[0][0]]]];
  for (let i = 1; i < prof.length - 1; i++) if (prof[i][2]) st.push([[-prof[i][1], prof[i][0]], [prof[i][1], prof[i][0]]]);   // stage joints
  for (const f of fins) { st.push(f); st.push(f.map(([x, y]) => [-x, y])); }
  if (flame) { const w = prof[0][1]; for (let i = -2; i <= 2; i++) st.push(quad([i * w * 0.3, 0], [i * w * 0.5, -flame * 0.5], [i * w * 0.15, -flame * (0.8 + 0.2 * Math.cos(i))], 10)); }
  return st;
}

// ---------- Soft puffs (smoke, vapour, snow bursts, flame glow): one draw call per kind ----------
class Puffs {
  constructor(parent, n, { color = 0xffffff, additive = false, scale = 300 } = {}) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: scale }, color: { value: new THREE.Color(color) } },
      vertexShader: `attribute float size; attribute float alpha; varying float vA; uniform float scale;
        void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(size * scale / max(0.1, -mv.z), 1.0, 500.0); }`,
      fragmentShader: additive
        ? `uniform vec3 color; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(color * a * a * vA, 1.0); }`
        : `uniform vec3 color; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float a = smoothstep(0.5, 0.1, r) * (0.8 + 0.2 * sin(c.x * 17.0 + c.y * 11.0)); gl_FragColor = vec4(color * (0.85 + 0.3 * (0.5 - c.y)), a * vA); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 3; parent.add(this.pts);
    this.p = Array.from({ length: n }, () => ({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, age: 1, life: 1, s0: 1, s1: 1, a: 0, drag: 1, up: 0 }));
    this.i = 0; this.n = n; this.live = 0;
  }
  emit(pos, vel, s0, s1, life, a = 1, drag = 1, up = 0) {
    const q = this.p[this.i]; this.i = (this.i + 1) % this.n;
    q.x = pos.x; q.y = pos.y; q.z = pos.z; q.vx = vel.x; q.vy = vel.y; q.vz = vel.z; q.age = 0; q.life = life; q.s0 = s0; q.s1 = s1; q.a = a; q.drag = drag; q.up = up;
    this.live = 3;
  }
  update(dt) {
    if (this.live <= 0) { this.pts.visible = false; return; }
    this.pts.visible = true; let any = false;
    this.p.forEach((q, i) => {
      if (q.age < q.life) {
        q.age += dt; any = true; const k = Math.exp(-q.drag * dt);
        q.vx *= k; q.vz *= k; q.vy = q.vy * k + q.up * dt;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      }
      const f = clamp01(q.age / q.life);
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.size[i] = q.s0 + (q.s1 - q.s0) * Math.sqrt(f);
      this.alpha[i] = q.age < q.life ? q.a * Math.min(1, f * 8) * (1 - f) : 0;
    });
    if (!any) this.live -= 1;
    for (const k of ['position', 'size', 'alpha']) this.pts.geometry.attributes[k].needsUpdate = true;
  }
}

export default class Rockets {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.A = new THREE.Group(); this.B = new THREE.Group(); this.C = new THREE.Group();
    this.B.visible = this.C.visible = false; this.root.add(this.A, this.B, this.C);
    this.start = { pos: V3(EYE_K.x, 0, EYE_K.z), yaw: 0.8 };
    this.s = {
      scene: 'kaluga', phase: 'arrive', guide: null, hour: 21,
      newton: 0, verne: 0, capsule: 0, nogo: 0,   // ch13_01, ch13_03: the cannons over the roofs
      trumpet: 0, books: 0,                       // ch13_02
      rocket: 0,      // ch13_03: 1 drawn, 2 blasting gas, 3 flying out to the stars
      balloon: 0,     // 1 let go
      eq: 0, train: 0, cradle: 0, station: 0,     // ch13_04
      labels: 0, lox: 0, henry: 0, torch: 0, lit: 0,   // Auburn
      arc: 0, descend: 0, papers: 0, vacuum: 0, correction: 0,
      v2: 0, lights: 0, braun: 0,                           // Peenemünde: 1 erector down, 2 ignition, 3 lift-off
      space: 0, race: 0,                          // 1 the edge of space, 2 the map
      journal: 0,
    };
    this.t = 0;
    this.life = new Life(this.root);
    this.buildKaluga();
    this.buildStudy();
    this.buildSketches();
    this.buildAuburn();
    this.buildGoddardRocket();
    this.buildAuburnExtras();
    this.buildBaltic();
    this.buildV2();
    this.buildSpace();
    this.buildPeople();
    this.journal = new Journal(this, drawJournal);
    this.registerInteractables();
    this.setScene('kaluga');
  }

  setScene(name) {
    const G = this.G; this.cur = name;
    this.A.visible = name === 'kaluga'; this.B.visible = name === 'auburn'; this.C.visible = name === 'baltic';
    if (name === 'kaluga') {
      G.world.height = kalugaHeight; G.world.bounds = 2.1; G.world.blockers = this.blockK;
      G.sky.fogFar = 1400; G.sky.mist = 0.12; this.lat = LAT_K; this.sl = SL_K;
      G.sky.setPlace({ lat: LAT_K, year: 1903, sunLon: SL_K });
    } else if (name === 'auburn') {
      G.world.height = auburnHeight; G.world.bounds = 7; G.world.blockers = [{ x: FRAME.x, z: FRAME.z, r: 0.7 }, { x: 4.3, z: 2.9, r: 1.0 }, { x: 4.3, z: -1.5, r: 0.4 }, { x: ESTHER.x, z: ESTHER.z, r: 0.3 }];
      G.sky.fogFar = 2600; G.sky.mist = 0; this.lat = LAT_A; this.sl = SL_A;
      G.sky.setPlace({ lat: LAT_A, year: 1926, sunLon: SL_A });
      G.sky.hideMoon();
    } else {
      G.world.height = balticHeight; G.world.bounds = 3; G.world.blockers = [];
      G.sky.fogFar = 700; G.sky.mist = 0.45; this.lat = LAT_P; this.sl = SL_P;
      G.sky.setPlace({ lat: LAT_P, year: 1944, sunLon: SL_P });
      G.sky.hideMoon();
    }
  }

  // ---------- 1. Kaluga: the yard, the street, the town on the high bank of the Oka ----------
  buildKaluga() {
    const k = new Kit(), r = rng(5), A = this.A, wins = [];
    A.add(groundMesh(3000, 160, kalugaHeight, (x, z, y, c) => {
      c.setHex(0xb8c4d6).lerp(_col.setHex(0xe4eaf2), N2(x / 12, z / 12));
      if (z < -250 && z > -330) c.setHex(0x98a8ba).lerp(_col.setHex(0xb8c6d4), N1(x / 30, z / 8));   // the frozen Oka
      if (Math.abs(z + 32) < 3.5 && Math.abs(x) < 220) c.lerp(_col.setHex(0x8a8a96), 0.35 + 0.2 * Math.sin(x * 2.1));   // sledge tracks
    }));
    // our yard: a picket fence, birches, a woodpile, a well, a sledge
    const fence = (x0, z0, x1, z1, gap) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.28), yaw = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i <= n; i++) { const f = i / n, x = lerp(x0, x1, f), z = lerp(z0, z1, f); if (gap && Math.abs(x - gap) < 1.3) continue; const y = kalugaHeight(x, z); k.box(0.1, 1.25, 0.03, 0x7a6a58, [x, y + 0.62, z], [0, yaw, 0]); k.box(0.12, 0.06, 0.06, 0xeef2f8, [x, y + 1.27, z], [0, yaw, 0]); }
      for (const h of [0.35, 0.95]) for (let s = 0; s < 4; s++) { const f0 = s / 4, f1 = (s + 1) / 4, xa = lerp(x0, x1, f0), za = lerp(z0, z1, f0), xb = lerp(x0, x1, f1), zb = lerp(z0, z1, f1); pipe(k, V3(xa, kalugaHeight(xa, za) + h, za), V3(xb, kalugaHeight(xb, zb) + h, zb), 0.035, 0x5a4a3a, 4); }
    };
    fence(-16, -20, 16, -20, 3); fence(-16, -20, -16, 12); fence(16, -20, 16, -6);
    const birch = (x, z, s) => {
      const y = kalugaHeight(x, z);
      k.cyl(0.11 * s, 0.17 * s, 9 * s, 6, 0xe8e6e0, [x, y + 4.5 * s, z]);
      for (let i = 0; i < 7; i++) k.box(0.2 * s, 0.05, 0.04, 0x2a2622, [x + 0.12 * s, y + 0.6 + r() * 7 * s, z + (r() - 0.5) * 0.1], [0, r() * 3, 0]);
      for (let i = 0; i < 9; i++) { const b = r() * 6.28, h0 = (3.5 + r() * 5) * s; pipe(k, V3(x, y + h0, z), V3(x + Math.cos(b) * 2.2 * s, y + h0 + 1.8 * s, z + Math.sin(b) * 2.2 * s), 0.03 * s, 0x4a3a34, 4); }
    };
    birch(-8, -12, 1.1); birch(-11, -4, 0.95); birch(9, -15, 1.2); birch(-6, -26, 1);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 12; i++) k.cyl(0.11, 0.11, 1.1, 6, i % 3 ? 0x8a6a48 : 0x9a7a52, [-15.3, kalugaHeight(-15, -10) + 0.12 + j * 0.21, -14 + i * 0.23 + (j % 2) * 0.1], [0, 0, Math.PI / 2]);
    k.box(0.9, 0.05, 2.9, 0xeef2f8, [-15.3, kalugaHeight(-15, -10) + 0.98, -11.5]);
    const wy = kalugaHeight(-6, -7); k.cyl(0.6, 0.6, 0.8, 8, 0x6a5a48, [-6, wy + 0.4, -7]); k.box(0.08, 1.6, 0.08, 0x4a3a2a, [-6.6, wy + 0.8, -7]); k.box(0.08, 1.6, 0.08, 0x4a3a2a, [-5.4, wy + 0.8, -7]); k.add(gableRoof(1.6, 1.2, 0.5, 0.1), 0xeef2f8, [-6, wy + 1.6, -7]);
    k.box(0.5, 0.25, 1.4, 0x6a4a2a, [-3.5, kalugaHeight(-3.5, -4) + 0.2, -4], [0, 0.4, 0]);
    // the street of log houses (gables to the street, snow on the roofs), and more down the slope
    const WALLS = [0x6a4a30, 0x5a3e28, 0x4a6a8a, 0x5a7a5a, 0x7a5a3a, 0x8a7a5a];
    for (let x = -200; x <= 200; x += 15 + r() * 4) {
      if (Math.abs(x) < 3) continue;
      house(k, { x, y: kalugaHeight(x, -46), z: -46, w: 7 + r() * 2, d: 9, h: 3.4 + r() * 0.8, yaw: 0, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: 0xdfe6ee, gableFront: true }, wins);
      if (Math.abs(x) > 22) house(k, { x, y: kalugaHeight(x, -18), z: -18, w: 7 + r() * 2, d: 9, h: 3.4, yaw: Math.PI, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: 0xdfe6ee, gableFront: true }, wins);
    }
    for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 520, z = -70 - r() * 170; if (Math.hypot(x - 90, z + 130) < 30) continue; house(k, { x, y: kalugaHeight(x, z), z, w: 6 + r() * 3, d: 8, h: 3.2, yaw: Math.round(r() * 4) * Math.PI / 2, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: 0xdfe6ee, gableFront: r() < 0.7 }, wins);
    }
    // carved white window frames round every window
    for (const w of wins) { const n = _a.set(Math.sin(w.yaw), 0, Math.cos(w.yaw)); k.box(0.8, 1.05, 0.03, 0xe8e2d6, w.p.clone().addScaledVector(n, -0.01).toArray(), [0, w.yaw, 0]); k.box(0.95, 0.12, 0.05, 0xe8e2d6, w.p.clone().addScaledVector(n, 0.01).add(_b.set(0, 0.6, 0)).toArray(), [0, w.yaw, 0]); }
    // the cathedral on the hill: white walls, a great drum and gold onion domes, a bell tower
    const cx = 90, cz = -130, cy = kalugaHeight(cx, cz), GOLD = 0xd8b040, WH = 0xe8e4dc;
    k.box(22, 14, 22, WH, [cx, cy + 7, cz]); k.cyl(6, 6, 7, 16, WH, [cx, cy + 17.5, cz]);
    k.ball(6.4, 1, 0x4a7a6a, [cx, cy + 22.5, cz], 0, [1, 0.8, 1]); k.ball(1.3, 1, GOLD, [cx, cy + 28, cz], 0, [1, 1.4, 1]); k.cyl(0.08, 0.08, 4, 4, GOLD, [cx, cy + 31, cz]);
    for (const [ox, oz] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) { k.cyl(1.8, 1.8, 4, 10, WH, [cx + ox, cy + 16, cz + oz]); k.ball(2, 1, GOLD, [cx + ox, cy + 19.5, cz + oz], 0, [1, 1.3, 1]); k.cyl(0.001, 0.4, 2.2, 6, GOLD, [cx + ox, cy + 22, cz + oz]); }
    k.box(8, 30, 8, WH, [cx - 28, cy + 15, cz + 10]); k.cyl(3, 3, 6, 8, WH, [cx - 28, cy + 33, cz + 10]); k.ball(2.6, 1, GOLD, [cx - 28, cy + 38, cz + 10], 0, [1, 1.5, 1]); k.cyl(0.001, 0.6, 5, 6, GOLD, [cx - 28, cy + 43, cz + 10]);
    for (let i = 0; i < 5; i++) wins.push({ p: V3(cx - 8 + i * 4, cy + 6, cz + 11.03), yaw: 0 });
    // pines on the far bank, and along the slope
    for (let i = 0; i < 420; i++) {
      const x = (r() - 0.5) * 1600, z = -340 - r() * 500, y = kalugaHeight(x, z), s = 0.8 + r() * 0.8;
      k.cyl(0.001, 2.6 * s, 9 * s, 6, 0x1c2a22, [x, y + 6 * s, z]); k.cyl(0.001, 2.0 * s, 4 * s, 6, 0xd8e0ea, [x, y + 9.6 * s, z]);
    }
    A.add(k.mesh());
    A.add(windows(wins, { lit: 0.6, seed: 4, warm: 0xffb85a }));
    this.smokesK = [[-30, 9, -48], [24, 9, -48], [60, 9, -48], [-75, 9, -48], [-45, 2, -120], [30, -5, -170]].map(([x, y, z]) => { const sm = makeSmoke(V3(x, kalugaHeight(x, z) + y, z), { n: 6, rise: 9, size: 1.3, opacity: 0.13, color: 0x9aa0b0, wind: [0.5, 0.1] }); A.add(sm.group); return sm; });
    // snow falling outside (not in the room)
    const SN = 900, sp = new Float32Array(SN * 3); this.snowV = [];
    for (let i = 0; i < SN; i++) { let x, z; do { x = (Math.random() - 0.5) * 50; z = (Math.random() - 0.5) * 50; } while (Math.abs(x) < RX + 0.3 && Math.abs(z) < RZ + 0.3); sp.set([x, -1 + Math.random() * 13, z], i * 3); this.snowV.push(0.5 + Math.random() * 0.6); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3).setUsage(THREE.DynamicDrawUsage));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, map: glowTexture(), transparent: true, opacity: 0.85, depthWrite: false })); this.snow.frustumCulled = false; A.add(this.snow);
    // a horse pulling along the street, a dog in the yard
    this.horsesK = this.life.add(makeHerd('horse', { n: 2, area: { x: 0, z: -32, r: 70 }, mode: 'migrate', dir: [1, 0], height: kalugaHeight, seed: 6 })); A.add(this.horsesK.group);
    this.dogK = this.life.add(makeHerd('dog', { n: 1, area: { x: -4, z: -10, r: 3 }, height: kalugaHeight, seed: 3 })); A.add(this.dogK.group);
  }

  // ---------- Tsiolkovsky's veranda study ----------
  buildStudy() {
    const k = new Kit(), r = rng(13), A = this.A, LOG = 0x7a5232, LOG2 = 0x6c4a2c, FR = 0xe8e2d4;
    for (let i = 0; i < 11; i++) k.box(0.47, 0.06, RZ * 2, i % 2 ? 0x8a6a46 : 0x7e603e, [-RX + 0.24 + i * 0.47, -0.03, 0]);
    // the rug: one raised layer per border, each a clear step above the last (no flicker)
    k.box(2.2, 0.012, 1.4, 0x8a2a24, [0.2, 0.006, 0.2]); k.box(1.9, 0.012, 1.1, 0xc89a40, [0.2, 0.014, 0.2]); k.box(1.5, 0.012, 0.7, 0x3a4a6a, [0.2, 0.022, 0.2]);
    for (let i = 0; i < 12; i++) for (const sx of [-1, 1]) k.box(0.012, 0.004, 0.06, 0xd8c8a0, [0.2 + sx * 1.106, 0.004, 0.2 - 0.62 + i * 0.113]);
    // log walls (south and east), with the corner ends sticking out
    for (let i = 0; i < 12; i++) {
      const y = 0.12 + i * 0.235, c = i % 2 ? LOG : LOG2;
      k.cyl(0.13, 0.13, RX * 2 + 0.5, 7, c, [0, y, RZ + 0.05], [0, 0, Math.PI / 2]);
      k.cyl(0.13, 0.13, RZ * 2 + 0.5, 7, c, [RX + 0.05, y + 0.11, 0], [Math.PI / 2, 0, 0]);
    }
    // the glazed walls (north and west): a log sill, white frames, many small panes
    for (let i = 0; i < 3; i++) { const y = 0.12 + i * 0.235; k.cyl(0.13, 0.13, RX * 2 + 0.5, 7, LOG2, [0, y, -RZ - 0.05], [0, 0, Math.PI / 2]); k.cyl(0.13, 0.13, RZ * 2 + 0.5, 7, LOG, [-RX - 0.05, y + 0.11, 0], [Math.PI / 2, 0, 0]); }
    k.box(RX * 2, 0.05, 0.34, FR, [0, 0.82, -RZ + 0.06]); k.box(0.34, 0.05, RZ * 2, FR, [-RX + 0.06, 0.82, 0]);
    for (let i = 0; i <= 8; i++) k.box(0.07, RH - 0.8, 0.09, FR, [-RX + i * RX * 2 / 8, 0.8 + (RH - 0.8) / 2, -RZ]);
    for (let i = 0; i <= 7; i++) k.box(0.09, RH - 0.8, 0.07, FR, [-RX, 0.8 + (RH - 0.8) / 2, -RZ + i * RZ * 2 / 7]);
    for (const y of [1.55, 2.3]) { k.box(RX * 2, 0.04, 0.05, FR, [0, y, -RZ]); k.box(0.05, 0.04, RZ * 2, FR, [-RX, y, 0]); }
    k.box(RX * 2 + 0.3, 0.12, 0.2, FR, [0, RH, -RZ]); k.box(0.2, 0.12, RZ * 2 + 0.3, FR, [-RX, RH, 0]);
    // the ceiling: boards and beams
    k.box(RX * 2 + 0.5, 0.1, RZ * 2 + 0.5, 0x5a4230, [0, RH + 0.1, 0]);
    for (let i = 0; i < 5; i++) k.box(RX * 2, 0.16, 0.16, 0x4a3420, [0, RH - 0.02, -RZ + 0.4 + i * 0.9]);
    // outside: the pitched roof of boards, deep snow on it, log gables with a little attic window, the stove's brick chimney
    k.add(gableRoof(RX * 2 + 0.3, RZ * 2 + 0.3, 1.3, 0.45), 0x4a3a2c, [0, RH + 0.16, 0]);
    k.add(gableRoof(RX * 2 + 0.36, RZ * 2 + 0.3, 1.3, 0.47), 0xe6ecf4, [0, RH + 0.26, 0]);
    for (const sx of [-1, 1]) { k.add(gableWall(RZ * 2 + 0.2, 1.3, 0.24), sx > 0 ? LOG : 0xe8e2d4, [sx * (RX + 0.04), RH + 0.16, 0], [0, Math.PI / 2, 0]); k.box(0.3, 0.42, 0.04, 0xe8e2d4, [sx * (RX + 0.18), RH + 0.75, 0], [0, Math.PI / 2, 0]); }
    k.box(0.5, 1.9, 0.5, 0x8a4a38, [RX - 0.65, RH + 1.0, RZ - 0.75]); k.box(0.6, 0.1, 0.6, 0x6a3a2a, [RX - 0.65, RH + 1.95, RZ - 0.75]); k.box(0.52, 0.06, 0.52, 0xeef2f8, [RX - 0.65, RH + 2.03, RZ - 0.75]);
    // a geranium pot on the sill
    for (const x of [1.4, 2.0]) { k.cyl(0.07, 0.05, 0.12, 8, 0xa0502a, [x, 0.9, -RZ + 0.08]); k.ball(0.09, 0, 0x2a5a2a, [x, 1.02, -RZ + 0.08]); for (let j = 0; j < 4; j++) k.ball(0.03, 0, 0xd02a2a, [x + (r() - 0.5) * 0.1, 1.08 + r() * 0.05, -RZ + 0.08 + (r() - 0.5) * 0.08]); }
    // the desk against the north windows, piled with papers and books; a chair
    const dx = -0.9, dz = -1.62, WOOD = 0x5a3a22;
    // a writing desk: moulded top, an apron with a drawer, turned legs, a pedestal of drawers with brass pulls
    k.box(1.5, 0.04, 0.72, WOOD, [dx, 0.785, dz]); k.box(1.53, 0.015, 0.75, 0x4a2c18, [dx, 0.762, dz]);
    k.box(0.9, 0.1, 0.02, 0x4e301c, [dx - 0.25, 0.7, dz + 0.33]); k.box(0.5, 0.07, 0.01, 0x5e3c24, [dx - 0.35, 0.7, dz + 0.345]); k.ball(0.012, 0, 0xc8a050, [dx - 0.35, 0.7, dz + 0.355]);
    k.box(1.4, 0.1, 0.02, 0x4e301c, [dx, 0.7, dz - 0.33]); k.box(0.02, 0.1, 0.62, 0x4e301c, [dx - 0.7, 0.7, dz]);
    for (const [ox, oz] of [[-0.68, -0.3], [-0.68, 0.3]]) { const lx = dx + ox, lz = dz + oz; k.cyl(0.024, 0.016, 0.5, 8, 0x3a2416, [lx, 0.25, lz]); k.ball(0.032, 0, 0x3a2416, [lx, 0.52, lz]); k.cyl(0.028, 0.028, 0.12, 8, 0x3a2416, [lx, 0.6, lz]); k.cyl(0.02, 0.026, 0.04, 8, 0x3a2416, [lx, 0.02, lz]); }
    k.box(0.4, 0.68, 0.65, WOOD, [dx + 0.5, 0.39, dz]); k.box(0.42, 0.05, 0.67, 0x3a2416, [dx + 0.5, 0.03, dz]);
    for (let i = 0; i < 3; i++) { const y = 0.16 + i * 0.2; k.box(0.34, 0.17, 0.012, 0x6a4428, [dx + 0.5, y, dz + 0.33]); k.box(0.07, 0.015, 0.02, 0xc8a050, [dx + 0.5, y + 0.02, dz + 0.345]); k.box(0.04, 0.03, 0.006, 0xb89040, [dx + 0.5, y + 0.06, dz + 0.34]); }
    // a pen tray, a blotter, a candle, his spectacles, a glass of tea in a holder
    k.box(0.5, 0.006, 0.36, 0x2a3a2a, [dx - 0.25, 0.808, dz + 0.14]); k.box(0.2, 0.02, 0.06, 0x2a1a10, [dx + 0.05, 0.815, dz - 0.25]);
    k.cyl(0.03, 0.035, 0.07, 8, 0xd8c8a0, [dx - 0.6, 0.84, dz - 0.26]); k.cyl(0.035, 0.04, 0.012, 10, 0xb89040, [dx - 0.6, 0.81, dz - 0.26]);
    for (const s2 of [-1, 1]) k.add(new THREE.TorusGeometry(0.018, 0.002, 4, 10), 0xb0a080, [dx + 0.16 + s2 * 0.022, 0.812, dz + 0.12], [Math.PI / 2, 0, 0]);
    k.cyl(0.032, 0.028, 0.09, 10, 0xb08a3a, [dx + 0.3, 0.85, dz + 0.18]); k.cyl(0.029, 0.029, 0.07, 10, 0x8a3a12, [dx + 0.3, 0.86, dz + 0.18]); k.add(new THREE.TorusGeometry(0.025, 0.004, 4, 8, Math.PI), 0xb08a3a, [dx + 0.335, 0.85, dz + 0.18], [0, 0, -Math.PI / 2]);
    for (let i = 0; i < 9; i++) k.box(0.21, 0.002, 0.29, i % 3 ? 0xece0c0 : 0xd8c8a0, [dx - 0.55 + r() * 0.8, 0.814 + i * 0.004, dz - 0.15 + r() * 0.35], [0, r() * 1.2 - 0.6, 0]);
    for (let i = 0; i < 6; i++) k.box(0.26, 0.05, 0.19, [0x5a2a1a, 0x2a3a4a, 0x4a3a1a, 0x3a2a3a, 0x6a4a2a, 0x2a4a2a][i], [dx + 0.6, 0.83 + i * 0.05, dz - 0.15], [0, r() * 0.3, 0]);
    k.cyl(0.03, 0.035, 0.05, 8, 0x1a1a2a, [dx - 0.1, 0.83, dz - 0.25]); k.cyl(0.003, 0.003, 0.2, 3, 0xe8e0d0, [dx - 0.08, 0.9, dz - 0.24], [0.3, 0, 0.3]);
    // his bentwood chair (a Thonet, as in every Russian house), pulled up to the desk; he sits on it to write
    this.chair = bentwoodChair(k, CHAIR.x, CHAIR.z, SEAT_Y);
    // the kerosene lamp (its light is the room's light)
    const lx = dx + 0.45, lz = dz - 0.22;
    k.cyl(0.07, 0.09, 0.03, 10, 0x8a6a2a, [lx, 0.82, lz]); k.cyl(0.02, 0.03, 0.12, 8, 0x8a6a2a, [lx, 0.89, lz]); k.ball(0.07, 1, 0x6a8a6a, [lx, 0.99, lz], 0, [1, 0.8, 1]);
    const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.22, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe0a8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    chim.position.set(lx, 1.15, lz); A.add(chim);
    this.lampFlame = glow(0xffc060, 0.16); this.lampFlame.position.set(lx, 1.1, lz); A.add(this.lampFlame);
    this.lamp = new THREE.PointLight(0xffb060, 3.2, 9, 1.5); this.lamp.position.set(lx, 1.25, lz); A.add(this.lamp);
    // the bookshelf on the east wall
    const bx = RX - 0.22;
    for (let j = 0; j < 5; j++) { k.box(0.3, 0.03, 1.3, WOOD, [bx, 0.3 + j * 0.42, -1.2]); for (let i = 0; i < 12; i++) { const h = 0.24 + r() * 0.1; k.box(0.22, h, 0.05 + r() * 0.04, [0x6a2a1a, 0x2a3a2a, 0x4a3a1a, 0x3a2a3a, 0x5a4a2a, 0x7a6a4a][Math.floor(r() * 6)], [bx, 0.32 + j * 0.42 + h / 2, -1.78 + i * 0.1]); } }
    for (const z of [-1.85, -0.55]) k.box(0.3, 2.0, 0.03, WOOD, [bx, 1.0, z]);
    // the white tiled stove in the south-east corner, a bench beside it
    const sx = RX - 0.65, sz = RZ - 0.75;
    // (a Russian tiled stove: a plinth, walls of square glazed tiles, each with a blue flower painted in the middle,
    // a stepped cornice and crown, the brass-framed firebox door low on the room side)
    k.box(1.1, 2.1, 1.3, 0xd8d0c0, [sx, 1.05, sz]); k.box(1.18, 0.16, 1.38, 0xc8c0b0, [sx, 0.08, sz]);
    for (const [y, g, h] of [[2.12, 0.06, 0.06], [2.17, 0.1, 0.05], [2.22, 0.06, 0.06]]) k.box(1.1 + g * 2, h, 1.3 + g * 2, 0xe8e2d6, [sx, y, sz]);
    k.box(0.9, 0.18, 1.1, 0xe8e2d6, [sx, 2.33, sz]); k.box(1.14, 0.06, 1.34, 0xe8e2d6, [sx, 0.6, sz]);
    const tile = (x, y, z, ry) => { k.box(0.2, 0.2, 0.012, 0xf0ece2, [x, y, z], [0, ry, 0]); const n = V3(Math.sin(ry), 0, Math.cos(ry)).multiplyScalar(0.008); k.box(0.1, 0.03, 0.006, 0x3a5a9a, [x + n.x, y, z + n.z], [0, ry, 0]); k.box(0.03, 0.1, 0.006, 0x3a5a9a, [x + n.x, y, z + n.z], [0, ry, 0]); k.box(0.035, 0.035, 0.008, 0xc89a3a, [x + n.x * 1.2, y, z + n.z * 1.2], [0, ry, 0]); };
    for (let i = 0; i < 6; i++) { const y = 0.76 + i * 0.22; for (let j = 0; j < 5; j++) tile(sx - 0.556, y, sz - 0.48 + j * 0.24, -Math.PI / 2); for (let j = 0; j < 4; j++) tile(sx - 0.4 + j * 0.23, y, sz - 0.656, Math.PI); }
    k.box(0.02, 0.36, 0.42, 0x1a0e08, [sx - 0.555, 0.38, sz]); k.box(0.03, 0.42, 0.04, 0xb8964a, [sx - 0.56, 0.38, sz - 0.23]); k.box(0.03, 0.42, 0.04, 0xb8964a, [sx - 0.56, 0.38, sz + 0.23]); k.box(0.03, 0.04, 0.5, 0xb8964a, [sx - 0.56, 0.6, sz]); k.box(0.03, 0.04, 0.5, 0xb8964a, [sx - 0.56, 0.17, sz]);
    this.stoveGlow = glow(0xff7a30, 0.5, 0.8); this.stoveGlow.position.set(sx - 0.6, 0.38, sz); A.add(this.stoveGlow);
    this.stoveLight = new THREE.PointLight(0xff7030, 1.2, 4, 1.8); this.stoveLight.position.set(sx - 0.8, 0.5, sz); A.add(this.stoveLight);
    // the chalkboard on the south wall (he was a teacher)
    const board = canvasTex(512, 320, (g, w, h) => {
      g.fillStyle = '#1e2a22'; g.fillRect(0, 0, w, h); g.strokeStyle = '#6a4a2a'; g.lineWidth = 16; g.strokeRect(0, 0, w, h);
      g.fillStyle = 'rgba(235,240,230,0.85)'; g.strokeStyle = 'rgba(235,240,230,0.7)'; g.lineWidth = 3; g.font = 'italic 34px Georgia, serif';
      g.fillText('V = c · ln (M₀ / M₁)', 30, 70); g.font = 'italic 22px Georgia, serif'; g.fillText('Исследование мировых пространств', 30, 115); g.fillText('реактивными приборами, 1903', 30, 145);
      g.beginPath(); g.moveTo(330, 280); g.lineTo(420, 170); g.lineTo(440, 190); g.lineTo(350, 300); g.closePath(); g.stroke();
      g.beginPath(); g.arc(150, 240, 50, 0, 6.28); g.stroke(); g.beginPath(); g.ellipse(150, 240, 80, 20, -0.3, 0, 6.28); g.stroke();
    });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshLambertMaterial({ map: board })); bm.rotation.y = Math.PI; bm.position.set(-0.5, 1.55, RZ - 0.1); A.add(bm);
    // a bicycle against the wall (he rode about Kaluga on one)
    for (const ox of [-0.5, 0.5]) k.add(new THREE.TorusGeometry(0.33, 0.02, 5, 20), 0x1a1a1a, [-1.75 + ox, 0.35, RZ - 0.3]);
    pipe(k, V3(-2.25, 0.35, RZ - 0.3), V3(-1.75, 0.75, RZ - 0.3), 0.015, 0x2a3a2a); pipe(k, V3(-1.75, 0.75, RZ - 0.3), V3(-1.25, 0.35, RZ - 0.3), 0.015, 0x2a3a2a); pipe(k, V3(-1.75, 0.35, RZ - 0.3), V3(-1.75, 0.75, RZ - 0.3), 0.015, 0x2a3a2a); pipe(k, V3(-1.35, 0.85, RZ - 0.3), V3(-1.25, 0.35, RZ - 0.3), 0.015, 0x2a3a2a);
    k.box(0.06, 0.02, 0.5, 0x2a2a2a, [-1.35, 0.88, RZ - 0.3]); k.box(0.18, 0.04, 0.08, 0x3a2a1a, [-1.8, 0.8, RZ - 0.3]);
    // a samovar on a little table by the stove
    k.box(0.6, 0.04, 0.5, WOOD, [1.95, 0.7, 0.15]); for (const [ox, oz] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) k.box(0.04, 0.7, 0.04, 0x3a2416, [1.95 + ox, 0.35, 0.15 + oz]);
    // the samovar: a turned brass urn on a square foot, two looped handles, a tap with its little wheel,
    // the chimney crowned by the teapot keeping warm; a tray, glasses in holders, a sugar bowl
    { const X = 1.95, Z = 0.15, BR = 0xc8922e, BR2 = 0xa87420;
      k.box(0.16, 0.03, 0.16, BR2, [X, 0.735, Z]); for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.ball(0.018, 0, BR2, [X + ox * 0.065, 0.73, Z + oz * 0.065]);
      k.add(new THREE.LatheGeometry([[0.05, 0.75], [0.06, 0.78], [0.045, 0.82], [0.1, 0.85], [0.13, 0.9], [0.135, 0.98], [0.125, 1.05], [0.1, 1.09], [0.06, 1.1], [0.05, 1.1]].map(([a, b]) => new THREE.Vector2(a, b)), 16), BR, [X, 0, Z]);
      for (let f = 0; f < 12; f++) { const a = f / 12 * 6.283; k.box(0.008, 0.16, 0.01, BR2, [X + Math.cos(a) * 0.134, 0.97, Z + Math.sin(a) * 0.134], [0, -a, 0]); }
      for (const sz of [-1, 1]) k.add(new THREE.TorusGeometry(0.04, 0.007, 4, 10, Math.PI), 0x2a1a10, [X, 1.04, Z + sz * 0.14], [0, Math.PI / 2, sz * Math.PI / 2]);
      k.cyl(0.012, 0.012, 0.09, 6, BR, [X - 0.17, 0.92, Z], [0, 0, Math.PI / 2]); k.cyl(0.006, 0.01, 0.04, 6, BR, [X - 0.21, 0.9, Z]); k.cyl(0.018, 0.018, 0.006, 8, BR2, [X - 0.19, 0.95, Z]);
      k.cyl(0.035, 0.04, 0.08, 10, BR2, [X, 1.14, Z]); k.add(new THREE.TorusGeometry(0.045, 0.008, 4, 12), BR, [X, 1.18, Z], [Math.PI / 2, 0, 0]);
      k.add(new THREE.LatheGeometry([[0.03, 1.19], [0.06, 1.2], [0.07, 1.24], [0.055, 1.28], [0.03, 1.29], [0.012, 1.31], [0.0, 1.31]].map(([a, b]) => new THREE.Vector2(a, b)), 12), 0xf0f0f0, [X, 0, Z]);
      k.cyl(0.008, 0.014, 0.07, 6, 0xf0f0f0, [X + 0.08, 1.25, Z], [0, 0, -0.9]); k.add(new THREE.TorusGeometry(0.03, 0.006, 4, 8, Math.PI), 0xf0f0f0, [X - 0.07, 1.24, Z], [0, 0, Math.PI / 2]);
      for (let f = 0; f < 6; f++) k.ball(0.008, 0, 0x2a4a9a, [X + Math.cos(f) * 0.068, 1.24, Z + Math.sin(f) * 0.068]);
      k.cyl(0.24, 0.24, 0.012, 20, BR2, [X, 0.728, Z - 0.0]);
      for (const ox of [-0.17, 0.17]) { k.cyl(0.028, 0.026, 0.08, 10, 0xd8e0e0, [X + ox, 0.77, Z - 0.15]); k.cyl(0.03, 0.028, 0.06, 10, 0x8a7a5a, [X + ox, 0.765, Z - 0.15]); k.cyl(0.026, 0.026, 0.06, 10, 0x9a3a10, [X + ox, 0.77, Z - 0.15]); }
      k.cyl(0.04, 0.03, 0.05, 10, 0xf0f0f0, [X + 0.18, 0.76, Z + 0.12]); }
    A.add(k.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    // his tin model airship, hanging from the beams
    const ak = new Kit(); ak.ball(0.5, 2, 0xb8c0c8, [0, 0, 0], 0, [1, 0.24, 0.24]);
    for (let i = -4; i <= 4; i++) { const rr = 0.12 * Math.sqrt(1 - (i / 4.5) ** 2); ak.add(new THREE.TorusGeometry(rr, 0.004, 4, 16), 0x8a9098, [i * 0.1, 0, 0], [0, Math.PI / 2, 0]); }
    ak.box(0.16, 0.04, 0.05, 0x8a7a5a, [0, -0.15, 0]); for (const sx2 of [-1, 1]) pipe(ak, V3(sx2 * 0.2, 0, 0), V3(sx2 * 0.1, 0.55, 0), 0.002, 0x2a2a2a, 3);
    this.airship = ak.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.4 })); this.airship.position.set(-0.2, RH - 0.45, -1.0); this.airship.scale.setScalar(0.6); A.add(this.airship);
    // the cat on the windowsill
    const ck = new Kit(), CAT = 0x5a5a5e;
    ck.ball(0.09, 1, CAT, [0, 0.08, 0], 0, [1, 0.9, 1.5]); ck.ball(0.06, 1, CAT, [0, 0.18, 0.13]);
    for (const s2 of [-1, 1]) { ck.cyl(0.001, 0.025, 0.05, 4, CAT, [s2 * 0.035, 0.24, 0.13]); ck.box(0.012, 0.012, 0.005, 0xd8c040, [s2 * 0.022, 0.19, 0.185]); }
    this.cat = new THREE.Group(); this.catBody = ck.mesh(); this.cat.add(this.catBody);
    const tk = new Kit(); tk.cyl(0.012, 0.016, 0.22, 5, CAT, [0, 0.11, 0]); this.catTail = tk.mesh(); this.catTail.position.set(0, 0.06, -0.12); this.catTail.rotation.x = -1.9; this.cat.add(this.catTail);
    this.catHome = V3(0.7, 0.845, -RZ + 0.12); this.cat.position.copy(this.catHome); this.cat.rotation.y = 0.6; A.add(this.cat);
    // his ear trumpet, and a red balloon
    const et = new Kit(); et.cyl(0.07, 0.012, 0.3, 12, 0xb0a070, [0, 0.15, 0]); et.cyl(0.012, 0.012, 0.15, 6, 0x8a7a50, [0, -0.06, 0]);
    this.trumpetM = et.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.35 }));
    this.balloonM = new THREE.Group();
    const bl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshLambertMaterial({ color: 0xd02a2a, emissive: 0x3a0505 })); bl.scale.set(1, 1.18, 1); bl.position.y = 0.16; this.balloonM.add(bl);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 6), bl.material); knot.position.y = 0.02; this.balloonM.add(knot);
    // books that fly off the shelf (ch13_02)
    this.flyBooks = [];
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.04), new THREE.MeshLambertMaterial({ color: [0x6a2a1a, 0x2a3a5a, 0x4a3a1a, 0x3a2a4a, 0x5a4a2a, 0x2a4a2a][i], emissive: 0x221a08 })); const home = V3(RX - 0.22, 0.48 + (i % 4) * 0.42, -1.65 + i * 0.16); m.position.copy(home); m.rotation.y = Math.PI / 2; m.userData.home = home; A.add(m); this.flyBooks.push(m); }
    this.bookGlow = glow(0xffe0a0, 1.2, 0); A.add(this.bookGlow); this.bookCenter = V3(TALK_SPOT.x, 1.75, TALK_SPOT.z);
    this.blockK = [{ x: dx, z: dz, r: 0.85 }, { x: sx, z: sz, r: 0.8 }, { x: 1.95, z: 0.15, r: 0.4 }, { x: bx, z: -1.2, r: 0.3 }, { x: CHAIR.x, z: CHAIR.z, r: 0.28 }];
  }

  // ---------- the chalk drawings ----------
  buildSketches() {
    const A = this.A, sk = this.sk = {}, eye = EYE_K;
    // where the Moon hangs (first quarter, over the west)
    this.moonAz = 255; this.moonEl = 17;
    // Newton's cannon on a mountain on the round Earth (last chapter), out over the roofs
    const nS = [circ(0, 0, 4, 0, 6.29, 80), [[-0.9, 3.9], [0, 5], [0.9, 3.9]], [[0.1, 5.05], [0.9, 5.25]], quad([0.9, 5.2], [1.8, 5.3], [1.7, 3.66]), quad([0.9, 5.2], [3.6, 5.4], [3.46, 2.0]), quad([0.9, 5.2], [5.8, 4.8], [3.76, -1.37]), circ(0, 0, 5.2, Math.PI / 2, Math.PI / 2 - 6.28, 90)];
    sk.newton = new Sketch(A, nS, { spacing: 0.08, dot: 0.3, secs: 4.5, seed: 1 }).place(at(332, 34, 9).add(eye), eye);
    sk.newton.addLabel('Newton: fast enough, and it never comes down', 0, -5.2, 0.7);
    // Jules Verne's Moon cannon (1865): a giant barrel aimed at the Moon
    const vpos = at(288, 30, 6).add(eye), vg = new THREE.Object3D(); vg.position.copy(vpos); vg.lookAt(eye); vg.updateMatrixWorld();
    const moonW = at(this.moonAz, 900, 900 * Math.tan(this.moonEl * D2R)).add(eye), ml = vg.worldToLocal(moonW.clone()); const dl = V3(ml.x, ml.y, 0).normalize();
    const px = -dl.y, py = dl.x, bL = 11, bw = 0.9, bx0 = 2, by0 = -3;
    const bar = (s, t) => [bx0 + dl.x * s + px * t, by0 + dl.y * s + py * t];
    const vS = [[bar(0, -bw), bar(bL, -bw * 0.8)], [bar(0, bw), bar(bL, bw * 0.8)], circ(...bar(bL, 0), bw * 0.85, 0, 6.29, 24, 0.5).map(([x, y]) => [x, y]), [bar(0, -bw), bar(-0.6, 0), bar(0, bw)], quad([bx0 - 6, by0 - 1.5], [bx0, by0 + 1.5], [bx0 + 6, by0 - 1.5]), circ(bx0 - 1.4, by0 - 0.6, 1.1), circ(bx0 + 1.6, by0 - 0.6, 1.1)];
    for (let i = 1; i < 6; i++) vS.push([bar(i * 1.8, -bw * 0.95), bar(i * 1.8, bw * 0.95)]);
    sk.verne = new Sketch(A, vS, { spacing: 0.08, dot: 0.3, secs: 3, seed: 2 }); sk.verne.g.position.copy(vpos); sk.verne.g.quaternion.copy(vg.quaternion);
    sk.verne.addLabel('Jules Verne, 1865: From the Earth to the Moon', bx0, by0 - 2.8, 0.7);
    // an open book beside it
    sk.verne.book = new Sketch(sk.verne.g, [quad([-9, 4], [-7.5, 4.8], [-6, 4]), quad([-6, 4], [-4.5, 4.8], [-3, 4]), [[-9, 4], [-9, 1.6]], [[-3, 4], [-3, 1.6]], quad([-9, 1.6], [-7.5, 2.4], [-6, 1.6]), quad([-6, 1.6], [-4.5, 2.4], [-3, 1.6]), [[-6, 4], [-6, 1.6]], [[-8.4, 3.4], [-6.6, 3.5]], [[-8.4, 2.9], [-6.6, 3.0]], [[-5.4, 3.5], [-3.6, 3.4]], [[-5.4, 3.0], [-3.6, 2.9]]], { spacing: 0.07, dot: 0.18, secs: 1.5, seed: 9 });
    // the travellers' capsule, shot out at the Moon
    sk.capsule = new Sketch(A, [[[-0.35, -0.6], [-0.35, 0.3], [0, 0.85], [0.35, 0.3], [0.35, -0.6], [-0.35, -0.6]], circ(0, 0, 0.14, 0, 6.29, 12)], { spacing: 0.05, dot: 0.16, secs: 0.4, seed: 3 });
    this.capFrom = vg.localToWorld(V3(...bar(bL, 0), 0)); this.capDir = moonW.clone().sub(this.capFrom).normalize(); this.capQ = new THREE.Quaternion();
    // a red cross over the cannon: it would never work
    sk.nogo = new Sketch(sk.verne.g, [[[bx0 - 4, by0 - 3], [bx0 + 10, by0 + 9]], [[bx0 - 4, by0 + 9], [bx0 + 10, by0 - 3]]], { spacing: 0.08, dot: 0.3, color: 0xff6050, secs: 0.8, seed: 4 });
    // Tsiolkovsky's rocket (1903): a long body, liquid hydrogen and oxygen tanks, the pilot up front, the nozzle behind
    const rS = [[[-0.11, 0.3], [-0.11, 1.35], [-0.06, 1.62], [0, 1.72], [0.06, 1.62], [0.11, 1.35], [0.11, 0.3]], [[-0.11, 0.3], [-0.05, 0.22], [-0.16, 0.0], [0.16, 0.0], [0.05, 0.22], [0.11, 0.3]],
      rect(-0.08, 0.95, 0.08, 1.3), rect(-0.08, 0.55, 0.08, 0.9), circ(0, 1.45, 0.04, 0, 6.29, 14), [[0, 1.37], [0, 1.31]], [[-0.03, 1.33], [0.03, 1.33]], [[0, 0.55], [0, 0.32]], [[-0.03, 0.9], [-0.03, 0.4], [0, 0.32]]];
    sk.rocket = new Sketch(A, rS, { spacing: 0.006, dot: 0.012, secs: 3, seed: 5 }).place(V3(1.25, 1.2, -1.05), eye.clone().setY(1.2));
    sk.rocket.addLabel('liquid hydrogen', 0.36, 1.12, 0.075); sk.rocket.addLabel('liquid oxygen', 0.33, 0.72, 0.075);
    this.rocketHome = { pos: sk.rocket.g.position.clone(), q: sk.rocket.g.quaternion.clone() };
    this.rocketSky = at(318, 60, 40).add(eye);
    // the rocket equation
    sk.eq = new Sketch(A, [], { secs: 0.1 }); sk.eq.g.position.set(-0.9, 2.3, -1.45); sk.eq.g.lookAt(eye);
    sk.eq.addLabel('V = c · ln (M₀ / M₁)', 0, 0, 0.12, { color: '#eef4ff', glowCol: 'rgba(150,190,255,0.8)' }); sk.eq.addLabel('how fast it can go: more fuel, faster', 0, -0.13, 0.05);
    // the rocket train: four rockets end to end, each dropping off when its fuel is gone
    this.stages = [0, 1, 2, 3].map((i) => {
      const s = new Sketch(A, [rect(-0.07, i * 0.36, 0.07, i * 0.36 + 0.3), i === 3 ? [[-0.07, 1.38], [0, 1.5], [0.07, 1.38]] : [[-0.07, i * 0.36 + 0.3], [-0.03, i * 0.36 + 0.36]], [[0.07, i * 0.36 + 0.3], [0.03, i * 0.36 + 0.36]], [[-0.05, i * 0.36], [-0.09, i * 0.36 - 0.05]], [[0.05, i * 0.36], [0.09, i * 0.36 - 0.05]]], { spacing: 0.006, dot: 0.011, secs: 0.6, seed: 10 + i });
      s.place(V3(-2.1, 1.05, -1.25), eye.clone().setY(1.6)); s.home = s.g.position.clone(); return s;
    });
    this.stages[0].addLabel('a "rocket train"', 0, -0.12, 0.05);
    // the cradle, with the Earth in it
    const cS = [quad([-0.42, 0.05], [0, -0.22], [0.42, 0.05]), quad([-0.36, 0.0], [0, -0.16], [0.36, 0.0]), [[-0.33, 0.0], [-0.3, 0.3]], [[0.33, 0.0], [0.3, 0.3]], [[-0.3, 0.3], [0.3, 0.3]], circ(0, 0.2, 0.15, 0, 6.29, 40), quad([-0.08, 0.27], [-0.02, 0.3], [0.02, 0.22]), quad([0.03, 0.15], [0.1, 0.12], [0.07, 0.08]), quad([-0.1, 0.12], [-0.04, 0.1], [-0.06, 0.06])];
    sk.cradle = new Sketch(A, cS, { spacing: 0.006, dot: 0.012, secs: 2, seed: 6 }).place(V3(-0.2, 1.65, -1.65), eye);
    sk.cradle.addLabel('"The Earth is the cradle of humanity,', 0, 0.66, 0.1); sk.cradle.addLabel('but we cannot stay in the cradle forever."', 0, 0.54, 0.1);
    sk.cradle.addLabel('Земля — колыбель человечества, но нельзя вечно жить в колыбели.', 0, -0.32, 0.055, { color: '#cfe0ff' });
    // a station in space, far out in the stars: a turning wheel
    sk.station = new Sketch(A, [circ(0, 0, 5, 0, 6.29, 60, 0.4), circ(0, 0, 4.3, 0, 6.29, 60, 0.4), circ(0, 0, 0.8, 0, 6.29, 20, 0.4), [[-4.6, 0], [4.6, 0]], [[0, -1.85], [0, 1.85]], [[-3.3, -1.3], [3.3, 1.3]], [[-3.3, 1.3], [3.3, -1.3]]], { spacing: 0.1, dot: 0.25, secs: 2.5, seed: 7 }).place(at(338, 60, 44).add(eye), eye);
    sk.station.addLabel('a home in space', 0, -3, 0.9);
    // dots of gas blasting out of the chalk rocket
    this.exhK = new Puffs(A, 160, { color: 0xbfd6ff, additive: true });
  }

  // ---------- 2. Auburn: Aunt Effie's farm, the field, the cabbage patch ----------
  buildAuburn() {
    const k = new Kit(), r = rng(21), B = this.B, wins = [];
    const baseCol = (x, z, y, c) => {
      c.setHex(0xe4e8ee).lerp(_col.setHex(0xd0d6e0), N2(x / 5, z / 5));
      const bare = N1(x / 14 + 3, z / 14) + (N2(x / 3, z / 3) - 0.5) * 0.3; if (bare > 0.62) c.lerp(_col.setHex(0x8a7a58), clamp((bare - 0.62) * 6, 0, 0.85));
      if (Math.abs(z - 34 - Math.sin(x / 40) * 4) < 2.2) c.lerp(_col.setHex(0x7a6a52), 0.6);   // the road
      if (Math.abs(x - LAND.x) < 11 && Math.abs(z - LAND.z) < 9 && Math.sin((x - LAND.x) * 2.2) > 0.2) c.lerp(_col.setHex(0x5a4a3a), 0.7);   // the furrows
    };
    const PATCH = { x: 0, z: -4, w: 44, d: 40 };
    B.add(groundMesh(2600, 160, auburnHeight, baseCol, PATCH));
    // near you: the snow trodden into paths between the shelter, the camera, the sawhorse and the frame,
    // boot prints, the soot and melt round the launch frame from the test firings, sparkle in the crust
    const segD = (x, z, ax, az, bx, bz) => { const vx = bx - ax, vz = bz - az, t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1); return Math.hypot(x - ax - vx * t, z - az - vz * t); };
    const paths = [[4.3, 2.9, 0.3, -1.6], [4.6, -1.2, 0.5, -1.9], [-0.9, 0.3, 0, -1.6], [1.2, 1.6, 3.6, 2.2], [3.4, 1.8, 30, 24], [0, -2.2, -14, -16]];
    B.add(groundPatch(PATCH, 0.35, auburnHeight, (x, z, y, c, e) => {
      baseCol(x, z, y, c);
      let tr = 0; for (const [ax, az, bx, bz] of paths) tr = Math.max(tr, 1 - segD(x, z, ax, az, bx, bz) / 0.75);
      if (tr > 0) { const prints = N2(x * 3.1, z * 3.1) > 0.58 ? 0.25 : 0; c.lerp(_col.setHex(0xa8b2c0), clamp01(tr * 1.6) * (0.55 + prints) * e); }
      const fr = Math.hypot(x - FRAME.x, z - FRAME.z); if (fr < 1.6) c.lerp(_col.setHex(fr < 0.7 ? 0x4a4038 : 0x8a8070), clamp01((1.6 - fr) / 0.9) * 0.8 * e);
      if (N1(x * 1.7, z * 1.7) > 0.8) c.lerp(_col.setHex(0xffffff), 0.5 * e);
    }));
    // dead grass and weed stalks poking up through the snow where it is thin
    for (let i = 0; i < 520; i++) {
      const x = PATCH.x + (r() - 0.5) * PATCH.w * 0.95, z = PATCH.z + (r() - 0.5) * PATCH.d * 0.95;
      if (N1(x / 14 + 3, z / 14) + (N2(x / 3, z / 3) - 0.5) * 0.3 < 0.5 && r() < 0.8) continue; if (Math.hypot(x - FRAME.x, z - FRAME.z) < 1.8) continue;
      const y = auburnHeight(x, z), n = 3 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) { const h = 0.12 + r() * 0.22; k.cyl(0.001, 0.007, h, 3, r() < 0.5 ? 0x9a8a5a : 0x7a6a48, [x + (r() - 0.5) * 0.08, y + h / 2 - 0.01, z + (r() - 0.5) * 0.08], [(r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7]); }
    }
    // stone walls round the fields
    const wall = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.7); for (let i = 0; i < n; i++) { const x = lerp(x0, x1, i / n), z = lerp(z0, z1, i / n), s = 0.35 + r() * 0.25; k.ball(s, 0, [0x8a8a86, 0x7a7670, 0x9a968e][i % 3], [x + (r() - 0.5) * 0.3, auburnHeight(x, z) + s * 0.5, z + (r() - 0.5) * 0.3], [r(), r(), r()], [1.3, 0.8, 1]); if (r() < 0.5) k.ball(s * 0.7, 0, 0x8a8680, [x, auburnHeight(x, z) + s * 1.1, z], [r(), r(), r()]); } };
    wall(-90, -75, 70, -75); wall(-90, -75, -90, 28); wall(70, -75, 70, 28); wall(-90, 28, -10, 28); wall(10, 28, 70, 28);
    // the cabbage patch: rows of frost-bitten cabbages, a few posts
    // last year's cabbages, left in the frozen rows: a tight pale head in a rosette of curling outer leaves
    // (frost-bitten purple-grey at the edges), snow lodged in the hearts; a few already just stumps
    const CAB = [0x7a9a7a, 0x6a8a72, 0x8aa286], OUTER = [0x4a6a5a, 0x5a6a62, 0x6a5a6a];
    for (let i = 0; i < 9; i++) for (let j = 0; j < 12; j++) {
      const x = LAND.x - 9.5 + i * 2.3 + (r() - 0.5) * 0.3, z = LAND.z - 8 + j * 1.35, y = auburnHeight(x, z), sz = 0.8 + r() * 0.4;
      k.add(new THREE.SphereGeometry(0.14 * sz, 8, 6, 0, 6.29, 0, Math.PI / 2), 0x8a6a5a, [x, y - 0.04, z], 0, [1.3, 0.35, 1.3]);   // a ridge of earth
      if (r() < 0.12) { k.cyl(0.025, 0.03, 0.18, 6, 0x8a8a6a, [x, y + 0.09, z], [r() * 0.3, 0, r() * 0.3]); k.ball(0.05, 0, 0xe8ecf0, [x, y + 0.02, z], 0, [1.4, 0.4, 1.4]); continue; }
      k.ball(0.13 * sz, 1, CAB[(i + j) % 3], [x, y + 0.12 * sz, z], [r(), r(), r()], [1, 0.85, 1]);
      const nL = 6, a0 = r() * 6.28;
      for (let l = 0; l < nL; l++) { const a = a0 + l / nL * 6.28 + (r() - 0.5) * 0.3, d = 0.14 * sz; k.ball(0.13 * sz, 0, OUTER[(l + i) % 3], [x + Math.cos(a) * d, y + 0.07 * sz, z + Math.sin(a) * d], [0, -a, 0.9 + r() * 0.4], [1.0, 0.18, 0.75]); }
      k.ball(0.09 * sz, 0, 0xe8ecf0, [x + 0.02, y + 0.22 * sz, z], 0, [1, 0.35, 1]);
    }
    // corner stakes with a sagging string, and a scarecrow left over from summer
    for (const [x, z] of [[-12, -8], [12, -8], [-12, 8], [12, 8]]) { const X = LAND.x + x, Z = LAND.z + z, y = auburnHeight(X, Z); k.cyl(0.035, 0.045, 1.2, 6, 0x5a4a3a, [X, y + 0.55, Z], [(r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.1]); k.ball(0.05, 0, 0xe8ecf0, [X, y + 1.17, Z], 0, [1, 0.5, 1]); }
    for (const [a, b] of [[[-12, -8], [12, -8]], [[12, -8], [12, 8]], [[12, 8], [-12, 8]], [[-12, 8], [-12, -8]]]) { const A0 = V3(LAND.x + a[0], 0, LAND.z + a[1]), B0 = V3(LAND.x + b[0], 0, LAND.z + b[1]); A0.y = auburnHeight(A0.x, A0.z) + 1.0; B0.y = auburnHeight(B0.x, B0.z) + 1.0; const M = A0.clone().lerp(B0, 0.5); M.y -= 0.35; bend(k, [A0, A0.clone().lerp(M, 0.5).setY(lerp(A0.y, M.y, 0.75)), M, B0.clone().lerp(M, 0.5).setY(lerp(B0.y, M.y, 0.75)), B0], 0.005, 0x9a8a6a, 3); }
    { const X = LAND.x + 7, Z = LAND.z - 3, y = auburnHeight(X, Z); k.cyl(0.04, 0.05, 2.1, 6, 0x5a4a32, [X, y + 1.0, Z]); k.cyl(0.03, 0.03, 1.4, 6, 0x5a4a32, [X, y + 1.55, Z], [0, 0.3, Math.PI / 2]);
      k.cyl(0.16, 0.26, 0.7, 8, 0x5a4a6a, [X, y + 1.3, Z], [0, 0.3, 0]); k.cyl(0.05, 0.05, 1.1, 6, 0x6a5a7a, [X, y + 1.55, Z], [0, 0.3, Math.PI / 2]); k.ball(0.13, 1, 0xc8b078, [X, y + 1.82, Z]); k.cyl(0.11, 0.2, 0.1, 10, 0x6a5a3a, [X, y + 1.92, Z]); k.cyl(0.24, 0.24, 0.015, 14, 0x6a5a3a, [X, y + 1.88, Z]);
      for (let q = 0; q < 6; q++) k.cyl(0.004, 0.004, 0.18, 3, 0xc8b078, [X + Math.cos(0.3) * (q % 2 ? 0.72 : -0.72), y + 1.5, Z - Math.sin(0.3) * (q % 2 ? 0.72 : -0.72)], [r() - 0.5, 0, r() - 0.5]); }
    // Aunt Effie's farmhouse (white clapboard), the red barn and silo, a shed
    const fx = 52, fz = -40, fy = auburnHeight(fx, fz);
    house(k, { x: fx, y: fy, z: fz, w: 10, d: 8, h: 5.6, yaw: -Math.PI / 2, wall: 0xeeeae0, roofCol: 0x3a3a3e }, wins);
    k.box(3, 0.2, 8, 0xeeeae0, [fx - 5.5, fy + 2.6, fz]); for (const z of [-3.5, 0, 3.5]) k.box(0.15, 2.6, 0.15, 0xeeeae0, [fx - 6.8, fy + 1.3, fz + z]);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) k.box(0.05, 1.2, 0.8, 0x2a3a2a, [fx - 5.03, fy + 1.6 + (i > 1 ? 3 : 0), fz + s * (1.5 + i)]);
    const gx = 68, gz = -12, gy = auburnHeight(gx, gz);
    k.box(16, 7, 11, 0x9a2a20, [gx, gy + 3.5, gz]); k.add(gableRoof(16, 11, 5, 0.4), 0x4a4a4e, [gx, gy + 7, gz]); for (const s of [-1, 1]) k.add(gableWallGeo(11, 5), 0x9a2a20, [gx + s * 7.95, gy + 7, gz], [0, Math.PI / 2, 0]);
    k.box(0.1, 4, 4, 0xe8e4dc, [gx - 8.05, gy + 2, gz]); k.box(0.05, 3.6, 0.15, 0xe8e4dc, [gx - 8.08, gy + 2, gz], [Math.PI / 4, 0, 0]); k.box(0.05, 3.6, 0.15, 0xe8e4dc, [gx - 8.08, gy + 2, gz], [-Math.PI / 4, 0, 0]);
    k.cyl(2.6, 2.6, 12, 14, 0x8a8a8a, [gx + 4, gy + 6, gz - 8]); k.ball(2.6, 1, 0x6a6a70, [gx + 4, gy + 12, gz - 8], 0, [1, 0.6, 1]);
    // a Model T by the house
    const tx = 44, tz = -26, ty = auburnHeight(tx, tz);
    k.box(1.4, 0.6, 2.6, 0x1a1a1e, [tx, ty + 0.9, tz]); k.box(1.3, 0.7, 1.2, 0x1a1a1e, [tx, ty + 1.5, tz + 0.3]); k.box(1.4, 0.06, 1.4, 0x2a2a2e, [tx, ty + 1.88, tz + 0.3]); k.box(0.9, 0.5, 0.9, 0x1a1a1e, [tx, ty + 0.95, tz - 1.6]);
    for (const [ox, oz] of [[-0.75, -1.1], [0.75, -1.1], [-0.75, 1.0], [0.75, 1.0]]) k.add(new THREE.TorusGeometry(0.34, 0.06, 5, 14), 0x2a2a2a, [tx + ox, ty + 0.38, tz + oz], [0, Math.PI / 2, 0]);
    // telegraph poles along the road
    for (let x = -300; x <= 300; x += 40) { const z = 31 + Math.sin(x / 40) * 4, y = auburnHeight(x, z); k.cyl(0.12, 0.15, 8, 5, 0x4a3a2a, [x, y + 4, z]); k.box(1.4, 0.1, 0.1, 0x4a3a2a, [x, y + 7.6, z]); }
    // bare maples and elms, a stand of pines to the west
    for (let i = 0; i < 140; i++) {
      const a = r() * 6.28, d = 40 + r() * 340, x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.hypot(x - LAND.x, z - LAND.z) < 22 || Math.hypot(x - 60, z + 25) < 28) continue;
      const y = auburnHeight(x, z), s = 0.8 + r() * 0.8;
      if (x < -120 && r() < 0.7) { k.cyl(0.2 * s, 0.3 * s, 3 * s, 5, 0x3a2a1c, [x, y + 1.5 * s, z]); k.cyl(0.001, 3 * s, 10 * s, 7, 0x2a3a2a, [x, y + 8 * s, z]); continue; }
      k.cyl(0.15 * s, 0.3 * s, 6 * s, 5, 0x4a3e34, [x, y + 3 * s, z]);
      for (let j = 0; j < 6; j++) { const b = r() * 6.28; pipe(k, V3(x, y + (3.5 + r() * 2) * s, z), V3(x + Math.cos(b) * 3 * s, y + (7 + r() * 2) * s, z + Math.sin(b) * 3 * s), 0.07 * s, 0x4a3e34, 4); }
    }
    // the shelter: a lean-to of boards with a table of instruments, a lantern
    const shx = 4.3, shz = 2.9;
    for (const [ox, oz, h] of [[-1, -0.8, 2.2], [1, -0.8, 2.2], [-1, 0.8, 1.7], [1, 0.8, 1.7]]) k.box(0.1, h, 0.1, 0x6a5038, [shx + ox, h / 2, shz + oz]);
    k.box(2.3, 0.06, 1.9, 0x7a6048, [shx, 2.0, shz], [-0.27, 0, 0]); k.box(2.3, 0.1, 1.95, 0xeef2f6, [shx, 2.07, shz], [-0.27, 0, 0]);
    for (let i = 0; i < 7; i++) k.box(0.3, 1.7, 0.04, i % 2 ? 0x8a6a4a : 0x7a5e40, [shx - 0.95 + i * 0.32, 0.85, shz + 0.85]);
    k.box(1.4, 0.05, 0.6, 0x7a6048, [shx, 0.8, shz + 0.4]); for (const [ox, oz] of [[-0.6, 0.15], [0.6, 0.15], [-0.6, 0.65], [0.6, 0.65]]) k.box(0.05, 0.8, 0.05, 0x4a3a2a, [shx + ox, 0.4, shz + oz]);
    k.box(0.25, 0.18, 0.18, 0x2a2a2a, [shx - 0.4, 0.92, shz + 0.4]); k.box(0.2, 0.12, 0.15, 0x6a3a2a, [shx + 0.1, 0.89, shz + 0.4]); k.cyl(0.02, 0.02, 0.3, 5, 0x8a6a2a, [shx + 0.4, 0.98, shz + 0.4], [0, 0, 1.2]);
    // a sawhorse by you (the torch rests on it)
    for (const s of [-1, 1]) { pipe(k, V3(-0.9 + s * 0.2, 0, 0.0), V3(-0.9, 0.75, 0.2), 0.03, 0x7a6048); pipe(k, V3(-0.9 + s * 0.2, 0, 0.4), V3(-0.9, 0.75, 0.2), 0.03, 0x7a6048); }
    pipe(k, V3(-0.9, 0.75, -0.3), V3(-0.9, 0.75, 0.7), 0.04, 0x8a6a4a);
    // Esther's movie camera on its tripod: wooden legs with brass clamps and spurs, a pan-and-tilt head with
    // its handle, a black body with the film magazine's two drums on top, the lens and its hood (aimed west at
    // the rocket), the eyepiece at the back, and the hand crank on her side
    const cxm = CAMERA_A.x, czm = CAMERA_A.z, TW = 0x7a5a38, CB = 0x1c1c20, BR = 0xb8964a;
    for (const a of [Math.PI, Math.PI / 3, -Math.PI / 3]) {
      const foot = V3(cxm + Math.cos(a) * 0.4, auburnHeight(cxm + Math.cos(a) * 0.4, czm + Math.sin(a) * 0.4) - 0.04, czm + Math.sin(a) * 0.4), top = V3(cxm + Math.cos(a) * 0.05, 1.2, czm + Math.sin(a) * 0.05);
      for (const o of [-0.018, 0.018]) pipe(k, foot.clone().add(V3(-Math.sin(a) * o, 0.06, Math.cos(a) * o)), top.clone().add(V3(-Math.sin(a) * o, 0, Math.cos(a) * o)), 0.011, TW, 5);
      const mid = foot.clone().lerp(top, 0.45); k.box(0.07, 0.03, 0.03, BR, mid.toArray(), [0, -a, 0]); k.cyl(0.006, 0.001, 0.08, 4, 0x4a4a4a, foot.toArray());
    }
    k.cyl(0.1, 0.09, 0.05, 12, 0x3a2a1a, [cxm, 1.22, czm]); k.cyl(0.06, 0.07, 0.05, 10, 0x2a2a2a, [cxm, 1.265, czm]); k.box(0.16, 0.025, 0.14, 0x2a2a2a, [cxm, 1.3, czm]);
    pipe(k, V3(cxm + 0.06, 1.28, czm + 0.04), V3(cxm + 0.42, 1.2, czm + 0.12), 0.01, 0x2a2a2a, 5); k.cyl(0.014, 0.014, 0.08, 6, TW, [cxm + 0.44, 1.19, czm + 0.12], [0, 0, 1.35]);
    k.box(0.3, 0.2, 0.15, CB, [cxm, 1.41, czm]); k.box(0.31, 0.012, 0.16, 0x3a3a3e, [cxm, 1.515, czm]); k.box(0.012, 0.21, 0.16, 0x3a3a3e, [cxm + 0.15, 1.41, czm]);
    for (const ox of [-0.075, 0.075]) { k.cyl(0.095, 0.095, 0.07, 22, CB, [cxm + ox, 1.6, czm], [Math.PI / 2, 0, 0]); k.cyl(0.02, 0.02, 0.075, 8, 0x5a5a5e, [cxm + ox, 1.6, czm], [Math.PI / 2, 0, 0]); k.add(new THREE.TorusGeometry(0.095, 0.006, 4, 22), 0x4a4a4e, [cxm + ox, 1.6, czm - 0.036]); }
    k.cyl(0.035, 0.035, 0.08, 14, 0x2a2a2e, [cxm - 0.19, 1.41, czm + 0.02], [0, 0, Math.PI / 2]); k.cyl(0.04, 0.04, 0.012, 14, BR, [cxm - 0.235, 1.41, czm + 0.02], [0, 0, Math.PI / 2]);
    k.cyl(0.058, 0.04, 0.07, 14, 0x141416, [cxm - 0.275, 1.41, czm + 0.02], [0, 0, Math.PI / 2]); k.cyl(0.03, 0.03, 0.004, 14, 0x3a4a6a, [cxm - 0.237, 1.41, czm + 0.02], [0, 0, Math.PI / 2]);
    k.box(0.12, 0.05, 0.04, CB, [cxm + 0.04, 1.47, czm + 0.095]); k.cyl(0.018, 0.022, 0.06, 10, 0x141416, [cxm + 0.18, 1.47, czm + 0.095], [0, 0, Math.PI / 2]); k.cyl(0.024, 0.024, 0.02, 10, 0x2a2420, [cxm + 0.215, 1.47, czm + 0.095], [0, 0, Math.PI / 2]);
    k.cyl(0.02, 0.02, 0.03, 10, BR, [cxm + 0.02, 1.38, czm - 0.09], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) k.box(0.05, 0.01, 0.002, 0xc8c0a0, [cxm - 0.05 + i * 0.03, 1.36, czm + 0.076]);
    B.add(k.mesh());
    B.add(windows(wins, { lit: 0.1, seed: 9, dark: 0x2a3442 }));
    const ck = new Kit(); ck.box(0.016, 0.085, 0.01, 0x8a8a8a, [0, 0.035, 0]); ck.cyl(0.009, 0.009, 0.05, 6, 0x3a2a1a, [0, 0.075, -0.03], [Math.PI / 2, 0, 0]);
    this.crank = ck.mesh(FIG_MAT); this.crank.position.set(cxm + 0.02, 1.38, czm - 0.11); B.add(this.crank);
    this.crankHandle = new THREE.Object3D(); this.crankHandle.position.set(0, 0.075, -0.06); this.crank.add(this.crankHandle);
    this.camGrip = V3(cxm + 0.1, 1.36, czm + 0.1);   // her other hand on the side of the body, steadying it
    this.chimneyA = makeSmoke(V3(fx, fy + 10, fz + 2.5), { n: 6, rise: 8, size: 1.2, opacity: 0.18, color: 0xd8dce4 }); B.add(this.chimneyA.group);
    // cows by the barn, the farm dog, crows
    this.cowsA = this.life.add(makeHerd('cow', { n: 5, area: { x: 78, z: -28, r: 9 }, height: auburnHeight, seed: 3 })); B.add(this.cowsA.group);
    this.horseA = this.life.add(makeHerd('horse', { n: 1, area: { x: 60, z: 2, r: 5 }, height: auburnHeight, seed: 8 })); B.add(this.horseA.group);
    this.dogA = this.life.add(makeHerd('dog', { n: 1, area: { x: 5.5, z: 1.0, r: 1.5 }, height: auburnHeight, seed: 5, mode: 'follow' })); this.dogA.lead.set(5.5, 0, 1.0); B.add(this.dogA.group);
    this.crowsUp = this.life.add(makeFlock({ n: 9, center: V3(-14, 9, -20), r: 14, height: 5, color: 0x1a1a1e, size: 0.55, seed: 4, speed: 7 })); B.add(this.crowsUp.group); this.crowsUp.group.visible = false;
    const crk = new Kit(); for (let i = 0; i < 7; i++) { const x = -10 - r() * 8, z = -14 - r() * 10, y = auburnHeight(x, z), yw = r() * 6; crk.ball(0.1, 0, 0x1a1a1e, [x, y + 0.13, z], 0, [0.8, 0.8, 1.4]); crk.ball(0.06, 0, 0x1a1a1e, [x + Math.sin(yw) * 0.12, y + 0.2, z + Math.cos(yw) * 0.12]); crk.box(0.02, 0.02, 0.06, 0x3a3a2a, [x + Math.sin(yw) * 0.18, y + 0.2, z + Math.cos(yw) * 0.18], [0, yw, 0]); }
    this.crowsDown = crk.mesh(); B.add(this.crowsDown);
  }

  // Goddard's rocket and its launch frame
  buildGoddardRocket() {
    const B = this.B, fk = new Kit(), FRM = 0x5a5e62, H = 3.7, BRASS_C = 0xb89a50;
    const fy = auburnHeight(FRAME.x, FRAME.z);
    const corner = (sx, sz, y) => V3(sx * lerp(0.6, 0.2, y / H), y, sz * lerp(0.6, 0.2, y / H));
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { pipe(fk, corner(sx, sz, 0), corner(sx, sz, H), 0.022, FRM); const c0 = corner(sx, sz, 0); fk.box(0.26, 0.12, 0.26, 0x6a5038, [c0.x, 0.04, c0.z], [0, 0.1 * sx * sz, 0]); fk.cyl(0.045, 0.045, 0.05, 8, 0x3a3a3a, [c0.x, 0.12, c0.z]); }
    for (const y of [0.25, 1.4, 2.5, H]) for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) pipe(fk, corner(...a, y), corner(...b, y), 0.015, FRM, 4);
    for (const [a, b] of [[[-1, -1], [1, -1]], [[1, 1], [-1, 1]]]) { pipe(fk, corner(...a, 0.25), corner(...b, 1.4), 0.01, FRM, 4); pipe(fk, corner(...b, 1.4), corner(...a, 2.5), 0.01, FRM, 4); }
    // pipe fittings at every joint, a guide rail each side that steers the rocket straight up and out of the top
    for (const y of [0.25, 1.4, 2.5, H]) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = corner(sx, sz, y); fk.cyl(0.032, 0.032, 0.07, 8, 0x4a4e52, p.toArray()); }
    for (const sx of [-1, 1]) { pipe(fk, V3(sx * 0.13, 1.4, 0), V3(sx * 0.13, 3.3, 0), 0.008, 0x8a8e92, 5); for (const y of [1.4, 2.5]) pipe(fk, V3(sx * 0.13, y, 0), V3(sx * lerp(0.6, 0.2, y / H), y, -lerp(0.6, 0.2, y / H)), 0.007, 0x6a6e72, 4); }
    // the oxygen supply: a tall steel cylinder lying on a wooden sled, its valve and a hose to the rocket's tank
    { const ox = -1.15, oz = 0.75; fk.box(1.5, 0.06, 0.5, 0x7a6048, [ox, 0.05, oz]); for (const d of [-0.2, 0.2]) fk.box(1.6, 0.08, 0.06, 0x6a5038, [ox, 0.03, oz + d]);
      fk.cyl(0.11, 0.11, 1.25, 14, 0x3a5a3a, [ox, 0.2, oz], [0, 0, Math.PI / 2]); fk.ball(0.11, 1, 0x3a5a3a, [ox + 0.62, 0.2, oz], 0, [0.6, 1, 1]); fk.cyl(0.03, 0.03, 0.08, 8, BRASS_C, [ox + 0.72, 0.2, oz], [0, 0, Math.PI / 2]); fk.cyl(0.04, 0.04, 0.015, 8, 0x5a1a10, [ox + 0.72, 0.26, oz]);
      bend(fk, [[ox + 0.76, 0.2, oz], [ox + 0.95, 0.1, oz - 0.2], [-0.45, 0.04, 0.45], [-0.3, 0.03, 0.15], [-0.05, 0.05, 0.12]], 0.014, 0x1a1a1a, 6); }
    // a gasoline can, a toolbox, a coil of rope, an alcohol lamp for warming the lines
    fk.box(0.22, 0.32, 0.12, 0xa02a1a, [-0.95, 0.16, -1.3], [0, 0.3, 0]); fk.cyl(0.02, 0.02, 0.06, 6, 0x4a4a4a, [-0.92, 0.35, -1.3]);
    fk.box(0.45, 0.16, 0.2, 0x3a4a5a, [-1.1, 0.08, -0.7], [0, -0.4, 0]); fk.box(0.36, 0.02, 0.03, 0x1a1a1a, [-1.1, 0.2, -0.7], [0, -0.4, 0]);
    fk.add(new THREE.TorusGeometry(0.16, 0.025, 5, 14), 0x9a8a62, [0.9, 0.03, -1.4], [Math.PI / 2, 0, 0]); fk.add(new THREE.TorusGeometry(0.12, 0.025, 5, 14), 0x9a8a62, [0.9, 0.07, -1.4], [Math.PI / 2, 0, 0]);
    bend(fk, [[0.55, 0.02, 0.55], [1.0, 0.02, 1.5], [1.9, 0.02, 2.9], [2.9, 0.02, 3.9], [3.4, 0.3, 4.5]], 0.008, 0x2a2a2a, 4); // the firing cable to the shelter
    this.frame = fk.mesh(); this.frame.position.set(FRAME.x, fy, FRAME.z); B.add(this.frame);
    // the rocket: motor on top, two thin pipes down to the tanks, a cone shield over them
    // (as in the photographs of "Nell": a fist-sized motor and its nozzle at the very top, hanging between
    // the two long fuel pipes, which are the rocket's whole frame; the tanks far below, behind a cone shield)
    const rk = new Kit(), MET = 0xb8bcc0, STEEL = 0x8a8e92, BRASS = 0xb89a50, DARK = 0x4a4c4e;
    // the motor: a little chamber with flanged ends, an injector cap with two feed elbows, the nozzle pointing down
    rk.cyl(0.05, 0.05, 0.13, 14, STEEL, [0, 2.6, 0]);
    for (const y of [2.535, 2.665]) rk.cyl(0.062, 0.062, 0.016, 14, 0x9a9ea2, [0, y, 0]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; for (const y of [2.535, 2.665]) rk.cyl(0.006, 0.006, 0.026, 5, DARK, [Math.cos(a) * 0.056, y, Math.sin(a) * 0.056]); }
    rk.ball(0.048, 1, 0x9a9ea2, [0, 2.68, 0], 0, [1, 0.45, 1]); rk.cyl(0.012, 0.012, 0.05, 6, BRASS, [0, 2.72, 0]);
    rk.cyl(0.05, 0.022, 0.05, 14, 0x7a7e82, [0, 2.505, 0]); rk.cyl(0.022, 0.07, 0.19, 14, 0x5e6266, [0, 2.385, 0]); rk.add(new THREE.TorusGeometry(0.07, 0.006, 4, 14), 0x4a4e52, [0, 2.29, 0], [Math.PI / 2, 0, 0]);
    // the igniter: a little cup of black powder hung in the nozzle's mouth on two wires
    rk.cyl(0.014, 0.01, 0.03, 8, 0x2a1a12, [0, IGNITER_Y, 0]); for (const sx of [-1, 1]) bend(rk, [[sx * 0.008, IGNITER_Y + 0.01, 0], [sx * 0.03, 2.3, 0.01], [sx * 0.065, 2.36, 0.02], [sx * 0.1, 2.4, 0.02]], 0.002, sx > 0 ? 0xa03020 : 0x202020, 3);
    // the two fuel pipes, from the tanks up the sides and bending in to the chamber (gasoline one side, oxygen the other)
    for (const s of [-1, 1]) {
      bend(rk, [[s * 0.1, 1.24, 0], [s * 0.1, 2.3, 0], [s * 0.1, 2.55, 0], [s * 0.095, 2.62, 0], [s * 0.065, 2.64, 0]], 0.0095, MET, 6);
      rk.cyl(0.016, 0.016, 0.03, 8, BRASS, [s * 0.1, 1.7, 0]); rk.cyl(0.016, 0.016, 0.03, 8, BRASS, [s * 0.1, 2.2, 0]);
      rk.cyl(0.014, 0.014, 0.025, 8, BRASS, [s * 0.058, 2.64, 0], [0, 0, Math.PI / 2]);
      // brace straps between the pipes
    }
    for (const y of [1.45, 1.95, 2.42]) rk.box(0.2, 0.012, 0.01, 0x6a6e72, [0, y, 0]);
    // the shield: an upside-down cone of asbestos-lined sheet, the pipes passing through
    rk.cyl(0.016, 0.135, 0.24, 16, 0xd6d6d0, [0, 1.12, 0]); rk.add(new THREE.TorusGeometry(0.135, 0.006, 4, 16), 0x9a9a94, [0, 1.0, 0], [Math.PI / 2, 0, 0]);
    // the liquid oxygen tank (frosted white), then the gasoline tank, joined by a pipe; valves, a pressure line
    rk.cyl(0.075, 0.075, 0.36, 16, 0xe8ecef, [0, 0.79, 0]); rk.ball(0.075, 1, 0xe8ecef, [0, 0.97, 0], 0, [1, 0.42, 1]); rk.ball(0.075, 1, 0xe8ecef, [0, 0.61, 0], 0, [1, 0.42, 1]);
    for (const y of [0.68, 0.9]) rk.add(new THREE.TorusGeometry(0.077, 0.004, 4, 16), 0xc8ccd0, [0, y, 0], [Math.PI / 2, 0, 0]);
    rk.cyl(0.012, 0.012, 0.1, 6, MET, [0, 0.54, 0]);
    rk.cyl(0.07, 0.07, 0.34, 16, 0x9a8a64, [0, 0.33, 0]); rk.ball(0.07, 1, 0x9a8a64, [0, 0.5, 0], 0, [1, 0.42, 1]); rk.ball(0.07, 1, 0x9a8a64, [0, 0.16, 0], 0, [1, 0.42, 1]);
    for (const y of [0.22, 0.44]) rk.add(new THREE.TorusGeometry(0.072, 0.004, 4, 16), 0x7a6a48, [0, y, 0], [Math.PI / 2, 0, 0]);
    for (const [x, y] of [[0.1, 0.92], [-0.1, 0.42]]) { rk.cyl(0.013, 0.013, 0.05, 8, BRASS, [x * 0.82, y, 0], [0, 0, Math.PI / 2]); rk.cyl(0.004, 0.004, 0.04, 4, DARK, [x * 0.95, y + 0.025, 0]); rk.cyl(0.016, 0.016, 0.006, 8, 0xa02a1a, [x * 0.95, y + 0.045, 0]); }
    bend(rk, [[0.1, 0.92, 0], [0.1, 1.05, 0], [0.1, 1.24, 0]], 0.0095, MET, 6); bend(rk, [[-0.1, 0.42, 0], [-0.11, 0.7, 0], [-0.1, 1.0, 0], [-0.1, 1.24, 0]], 0.0095, MET, 6);
    bend(rk, [[0.04, 0.12, 0.05], [0.09, 0.3, 0.07], [0.08, 0.6, 0.075], [0.05, 0.66, 0.06]], 0.004, 0x3a3a3a, 4);
    rk.cyl(0.008, 0.008, 0.14, 5, 0x3a3a3a, [0, 0.06, 0]); rk.cyl(0.02, 0.02, 0.01, 8, 0x3a3a3a, [0, 0.0, 0]);
    this.rk = new THREE.Group(); this.rk.add(rk.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.45 })));
    this.rkBase = V3(FRAME.x, fy + 0.3, FRAME.z); this.rk.position.copy(this.rkBase); B.add(this.rk);
    // its flame (shooting down from the nozzle onto the cone shield)
    const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const cone = (r, L, m) => { const g = new THREE.CylinderGeometry(r, 0.0, L, 12, 1, true); g.translate(0, -L / 2, 0); return new THREE.Mesh(g, m); };
    this.flameA = new THREE.Group(); this.flameA.position.y = 2.26; this.flameA.add(cone(0.075, 0.9, fm(0xff9a40, 0.7)), cone(0.045, 0.6, fm(0xfff0c0, 0.9)), glow(0xffb060, 1.2, 0.9)); this.flameA.visible = false; this.rk.add(this.flameA);
    this.rkLight = new THREE.PointLight(0xffa050, 0, 12, 1.5); this.rkLight.position.y = 1.8; this.rk.add(this.rkLight);
    // a pulsing marker on the igniter when it is yours to light (Adults)
    this.ignMark = new THREE.Group(); this.ignMark.position.y = IGNITER_Y; this.rk.add(this.ignMark);
    this.ignMark.add(glow(0xffd070, 0.35, 0.8)); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8, depthWrite: false, fog: false })); ring.rotation.x = Math.PI / 2; this.ignMark.add(ring); this.ignRing = ring; this.ignMark.visible = false;
    // labels for the parts
    const dk = { color: '#fff6e0', glowCol: 'rgba(20,28,48,0.95)' };   // light text on a dark halo: readable against snow and sky
    this.rkLabs = [label('liquid-fuel rocket', 0.22, dk), label('gasoline', 0.16, dk), label('liquid oxygen', 0.16, dk), label('motor', 0.16, dk)];
    this.rkLabs[0].position.set(0, 3.25, 0); this.rkLabs[1].position.set(-0.65, 0.38, 0); this.rkLabs[2].position.set(-0.8, 0.85, 0); this.rkLabs[3].position.set(-0.55, 2.55, 0);
    for (const l of this.rkLabs) { l.material.opacity = 0; this.rk.add(l); }
    // smoke, vapour, snow bursts
    this.puffA = new Puffs(B, 220, { color: 0xeef0f4 });
    this.fireA = new Puffs(B, 120, { color: 0xffa050, additive: true });
    // the torch you can take (Adults), and Henry's own
    this.torchP = poleTorch(1.9); this.torchFlame = this.torchP.userData.tip.children[2];
    this.torchHome = { pos: V3(-0.9, 0.0, 0.2), rot: new THREE.Euler(0.0, 0, 1.18) }; this.torchP.position.copy(this.torchHome.pos); this.torchP.rotation.copy(this.torchHome.rot); B.add(this.torchP);
    this.torchGlow = glow(0xffe0a0, 0.6, 0); this.torchP.add(this.torchGlow); this.torchGlow.position.y = 1.2;
  }

  // the flight's path, the rockets that came after, the newspapers, the bubble of empty space
  buildAuburnExtras() {
    const B = this.B, eye = V3(1.2, 1.6, 1.6);
    const P = [], S = [], Bv = [];
    for (let i = 0; i <= 200; i++) { const p = this.flightPos(i / 200, _a); P.push(p.x, p.y, p.z); S.push(0.12); Bv.push(1); }
    for (let i = 0; i <= 50; i++) { const p = this.flightPos(FLY.apex, _a); P.push(p.x, auburnHeight(p.x, p.z) + (p.y - auburnHeight(p.x, p.z)) * i / 50, p.z); S.push(0.07); Bv.push(0.8); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tg.setAttribute('size', new THREE.Float32BufferAttribute(S, 1)); tg.setAttribute('b', new THREE.Float32BufferAttribute(Bv, 1));
    this.trail = new THREE.Points(tg, chalkMat(0xff7a30, false)); this.trail.frustumCulled = false; this.trail.visible = false; B.add(this.trail);
    const apex = this.flightPos(FLY.apex, V3());
    this.arcLabs = [label('2.5 seconds', 1.6, { color: '#fff0d0', glowCol: 'rgba(120,60,20,0.9)' }), label('12.5 m high', 1.6, { color: '#fff0d0', glowCol: 'rgba(120,60,20,0.9)' }), label('the cabbage patch', 1.8, { color: '#fff0d0', glowCol: 'rgba(20,60,20,0.9)' })];
    this.arcLabs[0].position.copy(this.flightPos(0.33, V3())).add(V3(-1.6, 1.4, 0)); this.arcLabs[1].position.copy(apex).add(V3(-2, 1.6, 0)); this.arcLabs[2].position.copy(LAND).setY(auburnHeight(LAND.x, LAND.z) + 3.2);
    for (const l of this.arcLabs) { l.material.opacity = 0; B.add(l); }
    // the rockets that came after, rising as giant chalk outlines across the field
    const far = 150, mk = (prof, fins, flame, x, name, h) => { const s = new Sketch(B, outline(prof, fins, flame), { spacing: h / 380, dot: h / 140, color: 0xffffff, additive: false, secs: 2.5, seed: Math.round(x) }); s.place(V3(x, auburnHeight(x, -far) - 4, -far), eye.clone().setY(auburnHeight(x, -far))); s.addLabel(name, 0, -flame - 4, 5, { color: '#ffffff', glowCol: 'rgba(20,40,80,0.9)' }); s.y0 = s.g.position.y; return s; };
    this.descend = [
      mk([[0, 0.8], [1.5, 0.82], [6.5, 0.83], [8.5, 0.8], [10.5, 0.66], [12.5, 0.32], [13.6, 0.1], [14, 0]], [[[0.62, 3.4], [1.78, 0.6], [1.78, -0.1], [0.62, 0.2]]], 5, -48, 'V-2, 1944', 14),
      mk([[0, 5.0], [42, 5.0, 1], [67, 5.0, 1], [70, 3.3], [88, 3.3, 1], [97, 1.95], [103, 1.0], [104, 0.5], [111, 0.15], [112, 0]], [[[5, 6], [6.5, 1], [6.5, -1], [5, -1]]], 18, 4, 'Saturn V, 1969: to the Moon', 112),
      mk([[0, 4.5], [70, 4.5, 1], [110, 4.5], [116, 3.6], [120, 1.8], [122, 0]], [[[4.5, 100], [6.5, 98], [6.5, 92], [4.5, 92]], [[4.5, 8], [6.3, 6], [6.3, 1], [4.5, 1]]], 18, 52, 'rockets today', 122),
    ];
    this.descendExh = new Puffs(B, 200, { color: 0xffffff });
    // the newspapers
    const papers = [
      ['JANUARY 13, 1920', 'BELIEVES ROCKET', 'CAN REACH MOON', 'Professor Goddard plans to fire a rocket at the Moon'],
      ['JANUARY 13, 1920', 'A SEVERE STRAIN', 'ON CREDULITY', '"...needs something better than a vacuum to push against"'],
      ['JULY 18, 1929', 'MOON ROCKET MAN\'S TEST', 'ALARMS WHOLE TOWN', 'Police and ambulances rush to Aunt Effie\'s farm'],
    ];
    this.papers = papers.map((p, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.66), new THREE.MeshLambertMaterial({ map: paperTex(...p), side: THREE.DoubleSide, transparent: true, opacity: 0, emissive: 0x2a2a28 })); m.userData = { a: i / 3 * 6.28 + 0.8, h: 1.45 + i * 0.18, v: 0.25 + i * 0.05 }; m.visible = false; B.add(m); return m; });
    this.correction = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.74), new THREE.MeshLambertMaterial({ map: paperTex('JULY 17, 1969', 'A CORRECTION', '', '"...a rocket can function in a vacuum as well as in an atmosphere. The Times regrets the error."', true), side: THREE.DoubleSide, transparent: true, opacity: 0, emissive: 0x3a3020 }));
    this.correction.visible = false; this.corrGlow = glow(0xffd890, 1.4, 0); this.correction.add(this.corrGlow); this.corrGlow.position.z = -0.05; B.add(this.correction);
    // a bubble of empty space with a little rocket in it: it pushes on its own gas
    const vb = this.vac = new THREE.Group(); vb.position.set(0.0, 1.55, -0.3); vb.visible = false; B.add(vb);
    this.vacShell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), new THREE.ShaderMaterial({ uniforms: { a: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float a; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(vec3(0.5,0.7,1.0) * (0.05 + f) * a, 1.0); }' }));
    vb.add(this.vacShell);
    this.vacInner = new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), new THREE.MeshBasicMaterial({ color: 0x050812, transparent: true, opacity: 0, depthWrite: false })); vb.add(this.vacInner);
    const mr = new Kit(); mr.cyl(0.025, 0.025, 0.12, 8, 0xe8e8f0, [0, 0, 0], [0, 0, -Math.PI / 2]); mr.cyl(0.001, 0.025, 0.05, 8, 0xd04030, [0.085, 0, 0], [0, 0, -Math.PI / 2]);
    this.vacRocket = mr.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })); vb.add(this.vacRocket);
    this.vacGas = glowPoints(60, { sizeScale: 200 }); vb.add(this.vacGas); this.vacGasD = Array.from({ length: 60 }, () => ({ x: 0, v: 0.3 + Math.random() * 0.4, y: (Math.random() - 0.5) * 0.04, z: (Math.random() - 0.5) * 0.04, t: Math.random() }));
    this.vacLabs = [label('empty space: nothing to push against', 0.05), label('the gas is pushed back...', 0.045), label('...so the rocket is pushed forward', 0.045), label('Newton: every push has an equal push back', 0.04, { color: '#ffe8c0', glowCol: 'rgba(200,150,60,0.7)' })];
    this.vacLabs[0].position.set(0, 0.52, 0); this.vacLabs[1].position.set(-0.2, -0.5, 0); this.vacLabs[2].position.set(0.2, -0.58, 0); this.vacLabs[3].position.set(0, 0.6, 0);
    for (const l of this.vacLabs) { l.material.opacity = 0; vb.add(l); }
  }
  // Goddard's flight: 0..1 over 2.5 s, up 12.5 m, over to the cabbage patch
  // First it climbs straight up, guided by the frame, until its tail is clear of the top (4.2 m);
  // then it noses over in an arc, 12.5 m at the top, and comes down in the cabbages.
  flightPos(u, out) {
    const g0 = auburnHeight(FRAME.x, FRAME.z) + 0.3, g1 = auburnHeight(LAND.x, LAND.z) + 0.2, U0 = FLY.u0;
    if (u <= U0) { const k = u / U0; return out.set(FRAME.x, g0 + FLY.h0 * k * k, FRAME.z); }
    const f = (u - U0) / (1 - U0), { a, b } = FLY, hx = Math.pow(f, 1.7);
    return out.set(lerp(FRAME.x, LAND.x, hx), g0 + FLY.h0 + a * f - b * f * f + (g1 - g0) * 0, lerp(FRAME.z, LAND.z, hx));
  }

  // ---------- 3. Peenemünde: misty pines, the firing table, the V-2 ----------
  buildBaltic() {
    const k = new Kit(), r = rng(41), C = this.C;
    C.add(groundMesh(2400, 150, balticHeight, (x, z, y, c) => {
      c.setHex(0x3a3a2c).lerp(_col.setHex(0x5a5440), N2(x / 8, z / 8) * 0.8);
      if (Math.hypot(x, z - PAD.z) < 30) c.lerp(_col.setHex(0x8a8070), 0.6);
      if (Math.abs(x - 6) < 3 && z > PAD.z && z < 40) c.lerp(_col.setHex(0x6a6a66), 0.75);   // the concrete road
    }));
    // pines all round, thick beyond the clearing
    for (let i = 0; i < 620; i++) {
      const a = r() * 6.28, d = 45 + Math.sqrt(r()) * 420, x = Math.cos(a) * d, z = PAD.z + Math.sin(a) * d;
      if (Math.abs(x - 6) < 6 && z > PAD.z) continue; if (Math.hypot(x, z) < 14) continue;
      const y = balticHeight(x, z), s = 0.8 + r() * 0.7;
      k.cyl(0.2 * s, 0.3 * s, 14 * s, 5, 0x4a3426, [x, y + 7 * s, z]);
      for (let j = 0; j < 3; j++) k.cyl(0.001, (2.6 - j * 0.6) * s, 4.5 * s, 7, j % 2 ? 0x1c2a20 : 0x22301e, [x, y + (11 + j * 2.6) * s, z]);
    }
    // the earth wall round the test stand: an arc of banked sand to the north, grassed and scrubby on top
    {
      const N = 48, prof = [[-6.5, 0], [-4.5, 2.6], [-2.4, 6.0], [-1.0, 7.2], [1.0, 7.3], [2.6, 6.2], [4.8, 2.8], [6.8, 0]], pos = [], col = [], c = new THREE.Color();
      const pt = (i, j) => { const a = Math.PI * (0.12 + i / N * 0.76), [o, h] = prof[j], R = 34 + o, w = N2(i * 0.7, j * 1.3); return [Math.cos(a) * R, h * (0.9 + 0.2 * w) - 0.3, PAD.z - Math.sin(a) * R]; };
      const shade = (j, i) => { const top = prof[j][1] > 6; c.setHex(top ? 0x4a5a32 : 0x8a7a58).lerp(_col.setHex(top ? 0x5a6a3a : 0x6a5a40), N1(i * 0.5, j)); return [c.r, c.g, c.b]; };
      for (let i = 0; i < N; i++) for (let j = 0; j < prof.length - 1; j++) {
        const q = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)], cc = shade(j, i);
        for (const t of [0, 1, 2, 0, 2, 3]) { pos.push(...q[t]); col.push(...cc); }
      }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); bg.computeVertexNormals();
      C.add(new THREE.Mesh(bg, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide })));
      for (let i = 0; i < 26; i++) { const a = Math.PI * (0.14 + r() * 0.72), R = 34 + (r() - 0.5) * 2, x = Math.cos(a) * R, z = PAD.z - Math.sin(a) * R; k.ball(0.8 + r() * 0.8, 0, r() < 0.5 ? 0x2a3a22 : 0x3a4428, [x, 6.6 + r() * 0.4, z], [r(), r(), r()], [1.3, 0.6, 1.2]); }
    }
    // the firing table (Brenntisch): a steel ring on four braced legs, the rocket standing on it by its fins,
    // the exhaust going down through the ring onto a four-sided blast deflector; all on a slab of concrete
    {
      const ST = 0x3a3e3a, X = PAD.x, Z = PAD.z, TOP = 1.6;
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) k.box(1.38, 0.14, 1.38, [0x7a7a74, 0x74746e, 0x80807a][(i * 7 + j * 3 + 21) % 3], [X + i * 1.4, 0.07, Z + j * 1.4]);
      k.add(new THREE.LatheGeometry([[0.95, TOP - 0.2], [1.45, TOP - 0.2], [1.45, TOP], [0.95, TOP], [0.95, TOP - 0.2]].map(([a, b]) => new THREE.Vector2(a, b)), 24), ST, [X, 0, Z]);
      for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; k.cyl(0.025, 0.025, 0.03, 6, 0x2a2a2a, [X + Math.cos(a) * 1.35, TOP + 0.01, Z + Math.sin(a) * 1.35]); }
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, cx = X + Math.cos(a) * 1.2, cz = Z + Math.sin(a) * 1.2; k.box(0.5, 0.06, 0.34, 0x4a4e4a, [cx, TOP + 0.03, cz], [0, -a, 0]); }   // fin pads
      for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const top = V3(X + ox * 0.75, TOP - 0.2, Z + oz * 0.75), foot = V3(X + ox * 1.15, 0.14, Z + oz * 1.15);
        pipe(k, foot, top, 0.11, 0x2e322e, 6); k.box(0.5, 0.06, 0.5, 0x2a2e2a, [foot.x, 0.17, foot.z]);
        for (let b = 0; b < 4; b++) k.cyl(0.03, 0.03, 0.06, 6, 0x1a1a1a, [foot.x + (b % 2 - 0.5) * 0.36, 0.22, foot.z + (b > 1 ? 0.18 : -0.18)]);
      }
      for (const [a, b] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) pipe(k, V3(X + a[0] * 1.05, 0.55, Z + a[1] * 1.05), V3(X + b[0] * 1.05, 0.55, Z + b[1] * 1.05), 0.04, 0x2e322e, 5);
      k.cyl(0.05, 1.0, 1.1, 4, 0x5a5e58, [X, 0.79, Z], [0, Math.PI / 4, 0]); k.box(1.9, 0.1, 1.9, 0x4a4e48, [X, 0.19, Z], [0, Math.PI / 4, 0]);
      // cables and a fuel hose snaking from the trucks to the table, a little ladder, gas cylinders
      bend(k, [[X + 1.3, 0.17, Z + 0.4], [X + 3, 0.18, Z + 2], [X + 6, 0.06, Z + 4], [X + 9, 0.06, Z + 7], [X + 12, 0.2, Z + 11]], 0.05, 0x1a1a1a, 6);
      bend(k, [[X - 1.2, 0.5, Z + 0.6], [X - 2, 0.2, Z + 2], [X - 5, 0.08, Z + 4], [X - 9, 0.08, Z + 6.5], [X - 11, 0.5, Z + 8]], 0.07, 0x2a2a28, 6);
      for (let i = 0; i < 6; i++) k.box(0.5, 0.04, 0.08, 0x5a5a52, [X + 1.75, 0.35 + i * 0.24, Z + 1.05 - i * 0.03], [0, 0.6, 0]);
      for (const o of [-0.22, 0.22]) pipe(k, V3(X + 1.75 + o * 0.82, 0.14, Z + 1.15 - o * 0.56), V3(X + 1.75 + o * 0.82, 1.62, Z + 0.88 - o * 0.56), 0.025, 0x5a5a52, 4);
      for (let i = 0; i < 4; i++) { const x = X - 4.6 + i * 0.32, z = Z - 2.4; k.cyl(0.13, 0.13, 1.5, 10, i % 2 ? 0x4a5a6a : 0x5a5a5a, [x, 0.89, z]); k.ball(0.13, 1, 0x4a5a6a, [x, 1.64, z], 0, [1, 0.6, 1]); k.cyl(0.03, 0.03, 0.1, 6, 0x8a7a4a, [x, 1.74, z]); }
    }
    // trucks: an Opel Blitz fuel bowser and a cable truck (cab with its long bonnet, mudguards, a tank or a
    // canvas tilt behind), parked where they backed off; floodlights on timber poles
    for (const [x, z, yaw, kind] of [[-12, PAD.z + 9, 0.4, 'tank'], [14, PAD.z + 14, -0.3, 'tilt']]) {
      const c = Math.cos(yaw), s = Math.sin(yaw), y0 = balticHeight(x, z), P = (lx, ly, lz) => [x + lx * c + lz * s, y0 + ly, z - lx * s + lz * c], R = [0, yaw, 0];
      const BODY = 0x3e4434, DK = 0x22241e;
      k.box(1.9, 0.18, 6.8, DK, P(0, 0.72, 0), R);
      k.box(1.1, 0.8, 1.4, BODY, P(0, 1.2, 3.0), R); k.box(1.0, 0.05, 1.3, BODY, P(0, 1.625, 3.0), R);
      k.box(1.0, 0.7, 0.06, 0x1a1a18, P(0, 1.15, 3.71), R); for (let i = 0; i < 6; i++) k.box(0.9, 0.025, 0.04, 0x4a4a44, P(0, 0.88 + i * 0.1, 3.755), R);
      for (const sx of [-1, 1]) { k.cyl(0.13, 0.13, 0.12, 10, 0xd8d0b0, P(sx * 0.68, 1.42, 3.65), [Math.PI / 2, yaw, 0]); k.box(0.55, 0.06, 1.6, BODY, P(sx * 0.85, 0.98, 2.9), [0, yaw, sx * 0.25]); }
      k.box(2.0, 1.4, 1.4, BODY, P(0, 1.55, 1.65), R); k.box(1.8, 0.6, 0.04, 0x2a3038, P(0, 1.85, 2.37), R); k.box(2.05, 0.06, 1.5, BODY, P(0, 2.28, 1.65), R);
      for (const sx of [-1, 1]) k.box(0.04, 0.5, 0.6, 0x2a3038, P(sx * 1.02, 1.85, 1.75), R);
      if (kind === 'tank') { k.cyl(0.95, 0.95, 4.0, 18, 0x5a6050, P(0, 1.75, -1.3), [Math.PI / 2, yaw, 0]); for (const oz of [-3.25, 0.65]) k.cyl(0.97, 0.97, 0.08, 18, DK, P(0, 1.75, oz), [Math.PI / 2, yaw, 0]); k.cyl(0.25, 0.25, 0.15, 10, DK, P(0, 2.75, -1.0), R); }
      else {
        k.box(2.1, 0.12, 4.2, DK, P(0, 0.87, -1.3), R); for (const sx of [-1, 1]) k.box(0.05, 0.6, 4.2, 0x4a4632, P(sx * 1.03, 1.24, -1.3), R);
        k.add(new THREE.CylinderGeometry(1.06, 1.06, 4.2, 14, 1, false, -Math.PI / 2, Math.PI), 0x5a5640, P(0, 1.55, -1.3), [Math.PI / 2, yaw, 0], [1, 1, 0.75]);
        k.add(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 16), 0x5a3a22, P(0, 1.5, -4.0), [0, yaw, Math.PI / 2]);
      }
      for (const [ox, oz] of [[-0.85, 2.9], [0.85, 2.9], [-0.85, -1.6], [0.85, -1.6], [-0.85, -2.6], [0.85, -2.6]]) { k.add(new THREE.CylinderGeometry(0.46, 0.46, 0.28, 14), 0x161616, P(ox, 0.46, oz), [0, yaw, Math.PI / 2]); k.add(new THREE.CylinderGeometry(0.24, 0.24, 0.3, 10), 0x3a3e34, P(ox * 1.01, 0.46, oz), [0, yaw, Math.PI / 2]); }
    }
    for (const [x, z] of [[-16, PAD.z + 18], [17, PAD.z + 20]]) {
      const y = balticHeight(x, z); k.cyl(0.14, 0.19, 10.4, 7, 0x4a3a2a, [x, y + 5.0, z]); k.box(2.2, 0.14, 0.14, 0x4a3a2a, [x, y + 9.4, z]);
      for (const ox of [-0.7, 0.7]) { k.cyl(0.32, 0.26, 0.45, 12, 0x2a2a28, [x + ox, y + 9.85, z - 0.1], [Math.PI / 2 - 0.4, 0, 0]); k.cyl(0.28, 0.28, 0.02, 12, 0xe8ecff, [x + ox, y + 9.94, z - 0.33], [Math.PI / 2 - 0.4, 0, 0]); }
      for (let i = 0; i < 12; i++) k.box(0.35, 0.04, 0.06, 0x3a2a1a, [x, y + 0.6 + i * 0.7, z + 0.2], [0, 0, (i % 2 - 0.5) * 0.2]);
      bend(k, [[x, y + 9.2, z + 0.15], [x + (x < 0 ? 3 : -3), y + 4, z + 2], [x + (x < 0 ? 6 : -6), y + 0.05, z + 3]], 0.03, 0x111111, 4);
    }
    // your observation post: a parapet of cast concrete (board marks from the shuttering, a rounded top)
    // with sandbags along it; behind you the bunker's mouth: thick walls, a lintel, a steel door, earth on top
    {
      const CON = 0x8e8e86, CON2 = 0x7e7e76, sx0 = -3.5, sx1 = 3.5;
      k.box(7, 1.0, 0.6, CON, [0, 0.5, -1.4]); k.add(new THREE.CylinderGeometry(0.3, 0.3, 7, 8, 1, false, 0, Math.PI), CON, [0, 1.0, -1.4], [0, 0, Math.PI / 2], [0.4, 1, 1]);
      for (let i = 0; i < 5; i++) k.box(7.02, 0.014, 0.62, CON2, [0, 0.12 + i * 0.19, -1.4]);
      for (let i = 0; i < 9; i++) k.box(0.014, 1.0, 0.625, CON2, [sx0 + 0.4 + i * 0.78, 0.5, -1.4]);
      for (let row = 0; row < 2; row++) for (let i = 0; i < 13; i++) {
        const x = sx0 + 0.3 + i * 0.53 + (row ? 0.26 : 0); if (x > sx1 - 0.2) continue;
        k.ball(0.27, 1, [0xa89a74, 0x9a8c68, 0xb0a27c][(i + row) % 3], [x, 1.2 + row * 0.15, -1.45 + (r() - 0.5) * 0.04], [0, (r() - 0.5) * 0.2, (r() - 0.5) * 0.1], [1.0, 0.3, 0.62]);
      }
      k.box(8.4, 3.0, 0.9, 0x6e6e68, [0, 1.5, 3.6]); k.box(8.8, 0.6, 3.4, 0x6a6a64, [0, 3.3, 2.4]);
      for (const sxx of [-1, 1]) { k.box(0.9, 3.0, 2.9, 0x727268, [sxx * 3.75, 1.5, 2.15]); k.box(0.95, 0.4, 0.4, 0x5e5e58, [sxx * 3.75, 0.2, 0.75]); }
      for (let i = 0; i < 5; i++) k.box(6.58, 0.014, 0.02, 0x5e5e58, [0, 0.5 + i * 0.5, 3.14]);
      k.box(1.3, 2.1, 0.08, 0x3a3e36, [0, 1.05, 3.11]); for (const y of [0.3, 1.05, 1.8]) k.box(1.2, 0.06, 0.04, 0x2a2e26, [0, y, 3.05]); k.cyl(0.04, 0.04, 0.15, 6, 0x8a8a7a, [0.5, 1.05, 3.0], [Math.PI / 2, 0, 0]);
      k.box(1.7, 0.25, 0.25, 0x5e5e58, [0, 2.25, 3.03]); k.box(0.9, 0.14, 0.2, 0x121212, [-2.2, 2.2, 3.06]); k.box(0.9, 0.14, 0.2, 0x121212, [2.2, 2.2, 3.06]);
      k.cyl(0.06, 0.06, 0.9, 8, 0x3a3e36, [1.6, 3.95, 2.6]); k.box(0.14, 0.24, 0.2, 0x3a3e36, [1.6, 4.45, 2.55]);
      for (let i = 0; i < 14; i++) k.ball(0.6 + r() * 0.5, 0, r() < 0.5 ? 0x4a5a32 : 0x5a5a3a, [-4 + i * 0.62, 3.65, 2.0 + r() * 1.6], [r(), r(), r()], [1.4, 0.35, 1.2]);
      k.box(0.5, 0.4, 0.4, 0x5a4a2e, [-2.6, 0.2, -0.8]); k.box(0.24, 0.14, 0.18, 0x2a2e26, [-2.6, 0.47, -0.8]); k.cyl(0.02, 0.02, 0.2, 6, 0x1a1a1a, [-2.6, 0.56, -0.8], [0, 0, Math.PI / 2]);
      k.box(0.2, 0.02, 0.26, 0x2a2a3a, [-2.37, 0.41, -0.8]);
    }
    C.add(k.mesh());
    // the erector beside the rocket: a lattice tower that lowers away before launch
    const ek = new Kit(), EC = 0x4a5048;
    for (const sx of [-0.6, 0.6]) for (const sz of [-0.6, 0.6]) ek.box(0.14, 15, 0.14, EC, [sx, 7.5, sz]);
    for (let i = 0; i < 14; i++) { ek.box(1.3, 0.08, 0.08, EC, [0, i * 1.1 + 0.5, -0.6], [0, 0, i % 2 ? 0.7 : -0.7]); ek.box(1.3, 0.08, 0.08, EC, [0, i * 1.1 + 0.5, 0.6], [0, 0, i % 2 ? -0.7 : 0.7]); ek.box(0.08, 0.08, 1.2, EC, [-0.6, i * 1.1, 0]); }
    for (const y of [4, 9, 13.5]) ek.box(1.8, 0.1, 1.2, 0x5a5a50, [-1.2, y, 0]);
    this.erector = new THREE.Group(); const em = ek.mesh(); em.position.x = 0; this.erector.add(em); this.erector.position.set(PAD.x + 2.6, 0, PAD.z); C.add(this.erector);
    // the cloud deck, lit from inside by the rocket's flame
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000, 1, 1), new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, glowP: { value: new THREE.Vector3() }, glowA: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float t, glowA; uniform vec3 glowP; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
        void main(){ vec2 q = vW.xz * 0.006 + vec2(t * 0.01, t * 0.004);
          float d = n(q) * 0.5 + n(q * 2.1 + 3.0) * 0.3 + n(q * 4.3 - 1.0) * 0.2;
          float a = clamp(0.3 + (d - 0.45) * 2.4, 0.0, 0.9) * smoothstep(2400.0, 900.0, length(vW.xz));
          vec3 c = mix(vec3(0.2, 0.19, 0.25), vec3(0.42, 0.38, 0.46), d);
          float g = glowA * exp(-length(vW - glowP) / 90.0); c += vec3(1.0, 0.55, 0.2) * g * 1.6;
          gl_FragColor = vec4(c, max(a, min(1.0, g))); }`,
    }));
    this.clouds.rotation.x = Math.PI / 2; this.clouds.position.y = CLOUD; this.clouds.renderOrder = 4; C.add(this.clouds);
    // the floodlight on the rocket, and the flame's light
    this.flood = new THREE.SpotLight(0xdde4ff, 60, 120, 0.32, 0.6, 1.3); this.flood.position.set(-16, 10, PAD.z + 18); this.flood.target.position.set(PAD.x, 8, PAD.z); C.add(this.flood, this.flood.target);
    this.floodGlow = glow(0xe8eeff, 3, 0.9); this.floodGlow.position.set(-16, 10.2, PAD.z + 17.6); C.add(this.floodGlow);
    this.flood2Glow = glow(0xe8eeff, 3, 0.9); this.flood2Glow.position.set(17, 10.2, PAD.z + 19.6); C.add(this.flood2Glow);
    // remembrance: small lights in the grass, one for each of the many who were forced to build it
    this.memorial = glowPoints(70, { sizeScale: 260 }); this.memorial.visible = false; C.add(this.memorial);
    this.memD = Array.from({ length: 70 }, (_, i) => { const a = Math.PI * (0.2 + 0.6 * i / 70) + (r() - 0.5) * 0.03, d = 16 + r() * 3; const x = Math.cos(a) * d * 1.6, z = -Math.sin(a) * d * 0.7 - 8; return { x, y: balticHeight(x, z) + 0.12, z, ph: r() * 6, at: r() }; });
    // each light is a little grave candle: a glass cup (red or clear) with a pierced tin lid, standing in the grass
    const lk = new Kit(); this.memD.forEach((q, i) => { const y = q.y - 0.12; lk.cyl(0.04, 0.035, 0.1, 10, i % 3 ? 0x8a1a14 : 0xd8d0c0, [q.x, y + 0.05, q.z]); lk.cyl(0.042, 0.042, 0.02, 10, 0x9a9a8a, [q.x, y + 0.11, q.z]); lk.cyl(0.006, 0.006, 0.02, 4, 0x9a9a8a, [q.x, y + 0.13, q.z]); });
    this.candles = lk.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0, emissive: 0x3a1a08 })); this.candles.visible = false; C.add(this.candles);
    // smoke, steam, deer at the forest edge
    this.puffC = new Puffs(C, 360, { color: 0xc8ccd4, scale: 300 });
    this.fireC = new Puffs(C, 160, { color: 0xffa050, additive: true });
    this.deer = this.life.add(makeHerd('reindeer', { n: 3, area: { x: -34, z: -22, r: 5 }, height: balticHeight, seed: 7, scale: 0.8, mode: 'follow' })); this.deer.lead.set(-34, 0, -22); C.add(this.deer.group);
  }

  // the V-2: 14 m tall, painted in black and white quarters like the test rockets
  buildV2() {
    const prof = [[0, 0.6], [0.4, 0.66], [1.5, 0.78], [3, 0.83], [6.5, 0.83], [8.5, 0.8], [10, 0.68], [11.5, 0.5], [12.8, 0.28], [13.6, 0.1], [14, 0.0]];
    let g = new THREE.LatheGeometry(prof.map(([y, rr]) => new THREE.Vector2(rr, y)), 24).toNonIndexed();
    const p = g.attributes.position, cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
      const qd = Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 2)), band = y < 2.6 ? 0 : y < 10.2 ? 1 : 2, black = (qd + band) % 2;
      const v = black ? 0.08 : 0.82; for (let j = 0; j < 3; j++) cols.set([v, v, v * 0.97], (i + j) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    g.deleteAttribute('uv'); const k = new Kit(); k.parts.push(g);
    const fin = new THREE.Shape(); fin.moveTo(0.6, 3.4); fin.lineTo(1.78, 0.6); fin.lineTo(1.78, -0.1); fin.lineTo(0.55, 0.25); fin.closePath();
    for (let i = 0; i < 4; i++) { const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.06, bevelEnabled: false }); fg.translate(0, 0, -0.03); k.add(fg, i % 2 ? 0x141414 : 0xd8d8d4, [0, 0, 0], [0, i * Math.PI / 2 + Math.PI / 4, 0]); }
    k.cyl(0.45, 0.55, 0.3, 12, 0x2a2a2a, [0, -0.1, 0]);
    this.v2 = new THREE.Group(); this.v2.add(k.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
    this.v2Base = V3(PAD.x, 1.76, PAD.z);   // standing on the table's fin pads this.v2.position.copy(this.v2Base); this.C.add(this.v2);
    const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const cone = (rr, L, m) => { const cg = new THREE.CylinderGeometry(rr, 0.0, L, 14, 1, true); cg.translate(0, -L / 2, 0); return new THREE.Mesh(cg, m); };
    this.flameC = new THREE.Group(); this.flameC.position.y = -0.25; this.flameC.add(cone(0.75, 11, fm(0xff8a30, 0.55)), cone(0.45, 7, fm(0xffe8b0, 0.85)), glow(0xffa040, 14, 0.9)); this.flameC.visible = false; this.v2.add(this.flameC);
    this.v2Light = new THREE.PointLight(0xffa050, 0, 260, 1.1); this.v2Light.position.y = -2; this.v2.add(this.v2Light);
    this.v2Lab = label('V-2', 1.2, { color: '#e8e8e8', glowCol: 'rgba(0,0,0,0.8)' }); this.v2Lab.position.set(0, 16.5, 0); this.v2Lab.material.opacity = 0; this.v2.add(this.v2Lab);
  }

  // ---------- 4. Space: the edge of space, and the map ----------
  buildSpace() {
    const G = this.G, sp = this.space = new Space(G, { earthR: 16 }), R = 16;
    sp.ball.geometry.dispose(); sp.ball.geometry = new THREE.SphereGeometry(R, 144, 96);
    const ag = new THREE.SphereGeometry(R * 1.035, 96, 64); sp.atmo.geometry.dispose(); sp.atmo.geometry = ag; sp.atmo2.geometry = ag;
    this.spTrail = glowPoints(240, { sizeScale: 300 }); sp.earth.add(this.spTrail);
    this.spDot = glow(0xffd090, 0.8, 0); sp.earth.add(this.spDot);
    this.spArcs = glowPoints(700, { sizeScale: 300 }); sp.earth.add(this.spArcs);
    this.spPins = [PEEN, WSANDS, MOSCOW].map(() => { const s = glow(0xffe0a0, 0.9, 0); sp.earth.add(s); return s; });
    this.spLabs = { v2: label('V-2, 1944: 176 km up', 1.4), first: label('the first thing ever made by people to reach space', 1.0), peen: label('Peenemünde', 1.8), usa: label('America', 2.8), ussr: label('Soviet Union', 2.8), race: label('the race to space', 2.4) };
    for (const l of Object.values(this.spLabs)) { l.material.opacity = 0; l.material.depthTest = false; sp.group.add(l); }
    this.spOrbit = glowPoints(260, { sizeScale: 300 }); sp.earth.add(this.spOrbit);
  }

  buildPeople() {
    const add = (parent, model, pos, look = {}) => { const P = makePerson({ model, seed: 11 + parent.children.length * 3, ...look }); P.g.position.copy(pos); parent.add(P.g); return P; };
    const fig = (parent, pos, o) => { const P = makeFigure(o); P.fig = true; P.g.position.copy(pos); parent.add(P.g); return P; };
    // Kaluga
    this.tsi = add(this.A, 'tsiolkovsky', CHAIR.clone(), { tunic: 0x2a2a2a, hair: 0x8a8a8a, beard: true, height: 1.72 }); this.tsi.g.rotation.y = Math.PI;
    holdProp(this.tsi, this.trumpetM, 'Left', [0, 0.08, 0.03]); this.trumpetM.visible = false;
    holdProp(this.tsi, this.balloonM, 'Right', [0, 0.12, 0.03]); this.balloonM.visible = false;
    this.walkersK = [];
    for (let i = 0; i < 3; i++) {
      // three different people (one townsman, a man in an ushanka and sheepskin, a woman in a shawl)
      const x = -40 + i * 35, at0 = V3(x, kalugaHeight(x, -32), -32);
      // (no 'townsman' model here: he wears a Renaissance ruff, three centuries too early for Kaluga)
      const P = i === 1 ? fig(this.A, at0, { height: 1.71, coat: 0x2a2a2e, coatLen: 0.7, collar: 0x4a3a2a, hat: 'cap', hatCol: 0x2a2a30, moustache: true, hair: 0x3a2a1e, trousers: 0x2a2a2e, seed: 6 }) : fig(this.A, at0, i === 0
        ? { height: 1.74, coat: 0x6a4a2a, coatLen: 0.75, collar: 0xd8c8a8, hat: 'ushanka', hatCol: 0x3a2a1e, beard: true, hair: 0x5a4a3a, boots: 0x2a2a2a, trousers: 0x2a2a30, belt: 0x2a1a10, seed: 3 }
        : { height: 1.62, coat: 0x2a3a5a, coatLen: 1, skirt: true, hat: 'shawl', hatCol: 0x8a2a2a, scarf: null, hair: 0x6a4a2a, boots: 0x2a1e18, trousers: 0x2a1e18, seed: 9 });
      P.routine = [{ x: x + 30, z: -31, pose: 'idle', secs: 3 + i }, { x: x - 25, z: -33, pose: i % 2 ? 'talk' : 'idle', secs: 4 }];
      if (i !== 1) { const L = makeTorch({ len: 0.35, color: 0xffc070, size: 0.6 }); holdProp(P, L, 'Right', [0, 0.02, 0.02]); P.lamp = L; }
      this.walkersK.push(P);
    }
    // Auburn
    const ah = (x, z) => V3(x, auburnHeight(x, z), z);
    this.god = add(this.B, 'goddard', ah(1.1, -2.9), { tunic: 0x2a2a30, height: 1.78 });
    // Henry Sachs, Clark University's instrument maker: a flat cap, a work jacket over overalls, a scarf
    this.henry = fig(this.B, ah(3.6, 2.0), { height: 1.72, coat: 0x5a4a36, coatLen: 0.2, hat: 'cap', hatCol: 0x4a4440, scarf: 0x8a2a22, trousers: 0x34405a, moustache: true, hair: 0x2a2018, gloves: 0x6a5038, boots: 0x2a1e14, seed: 12 });
    // his blowtorch pole, carried in both hands sloping up in front of him (posed every frame in updatePeopleA)
    this.henryTorch = poleTorch(1.8); this.henry.g.add(this.henryTorch);
    // Percy Roope with his stopwatch: no model yet, so a dressed figure (fedora, overcoat, glasses), not a second townsman
    this.roope = fig(this.B, ah(5.0, 1.6), { height: 1.69, coat: 0x4a4038, coatLen: 0.55, hat: 'fedora', hatCol: 0x3a3430, scarf: 0x8a7a5a, glasses: true, moustache: true, hair: 0x3a2a1e, trousers: 0x3a3a3e, seed: 5 });
    const sw = new Kit(); sw.cyl(0.028, 0.028, 0.012, 14, 0xc8c8c0, [0, 0, 0], [Math.PI / 2, 0, 0]); sw.cyl(0.024, 0.024, 0.013, 14, 0xf0ece0, [0, 0, 0.001], [Math.PI / 2, 0, 0]); sw.cyl(0.006, 0.006, 0.012, 6, 0xc8c8c0, [0, 0.033, 0]);
    this.stopwatch = sw.mesh(FIG_MAT); this.stopwatch.position.set(0, -0.66, 0.06); this.roope.arms[0].add(this.stopwatch);
    // Esther Goddard behind her movie camera: 1920s cloche hat, a long belted coat with a fur collar, gloves
    this.esther = fig(this.B, ah(ESTHER.x, ESTHER.z), { height: 1.62, coat: 0x2e4a3e, coatLen: 0.82, collar: 0x5a4636, belt: 0x22362c, hat: 'cloche', hatCol: 0x6a2a3e, hatBand: 0xc8a05a, hair: 0x4a3020, longHair: false, gloves: 0x5a3a2a, trousers: 0x6a5a50, boots: 0x2a1e18, skin: 0xe0b8a0, seed: 31 });
    this.esther.g.rotation.y = -Math.PI / 2;
    // Peenemünde: two engineers walk back to the bunker before the launch
    // Wernher von Braun, 32, who led the team: tall, fair hair swept back, a dark double-breasted suit under a long
    // black leather coat, no hat; he stands at the end of your parapet and watches it go (no Tripo model yet)
    this.braun = fig(this.C, V3(-1.7, balticHeight(-1.7, -0.55), -0.55), { height: 1.86, coat: 0x1c1a1a, coatLen: 0.85, collar: null, belt: 0x141212, hair: 0xc8a868, skin: 0xe2bca4, trousers: 0x2a2a30, boots: 0x101010, gloves: 0x1a1414, scarf: 0xd8d4c8, seed: 44 });
    this.braun.g.rotation.y = Math.PI * 0.94;
    this.braunLab = label('Wernher von Braun', 0.12, { color: '#f2ecdc', glowCol: 'rgba(10,10,16,0.9)' }); this.braunLab.position.set(0, 2.12, 0); this.braunLab.material.opacity = 0; this.braun.g.add(this.braunLab);
    // (two different men: an engineer in a white work coat and a hat, and one in a long field-grey coat and cap)
    // what the Auburn people walk round: the frame, the camera and Esther, the shelter, the sawhorse, each other
    this.obsA = [{ x: FRAME.x, z: FRAME.z, r: 0.85 }, { x: 4.5, z: -1.5, r: 0.6 }, { x: 4.3, z: 2.9, r: 1.05 }, { x: -0.9, z: 0.2, r: 0.45 }, { P: this.god, r: 0.25 }, { P: this.henry, r: 0.25 }, { P: this.roope, r: 0.25 }];
    this.eng = [0, 1].map((i) => { const x = PAD.x + 3 + i * 1.2, z = PAD.z + 5, p0 = V3(x, balticHeight(x, z), z); return fig(this.C, p0, i
      ? { height: 1.78, coat: 0x5a5e50, coatLen: 0.8, hat: 'fieldcap', hatCol: 0x4a4e42, belt: 0x2a2620, hair: 0x6a5a40, glasses: true, trousers: 0x4a4e42, boots: 0x161412, seed: 21 }
      : { height: 1.7, coat: 0xd8d4c8, coatLen: 0.7, hat: 'fedora', hatCol: 0x3a3a3a, hair: 0x2a2018, trousers: 0x3a3a40, boots: 0x161412, seed: 23 }); });
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.torchIt = {
      hint: 'Grab the torch with GRIP and touch the flame to the rocket\'s igniter', deskHint: 'Click the torch to light the rocket',
      get disabled() { return self.s.torch !== 1 || self.s.lit || self.cur !== 'auburn'; },
      reach(pos) { self.torchP.localToWorld(_a.set(0, 1.0, 0)); return Math.max(0, pos.distanceTo(_a) - 0.95); },
      aim(o, d) { self.torchP.localToWorld(_a.set(0, 1.0, 0)); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.4 ? t : Infinity; },
      onGrab(h) { if (G.mode === 'desktop') G.act({ type: 'light' }); else self.held = h; },
      onHold(h) {
        if (!h?.grip) return;
        h.grip.getWorldQuaternion(_q); _b.set(0, 0, -1).applyQuaternion(_q).add(_c.set(0, 0.6, 0)).normalize();
        self.torchP.position.copy(h.pos).addScaledVector(_b, -0.3); self.torchP.quaternion.setFromUnitVectors(UP, _b);
        self.torchP.userData.tip.getWorldPosition(_a); self.igniterWorld(_c);
        if (_a.distanceTo(_c) < 0.25 + 0.08) G.act({ type: 'light' });   // the flame's tip (8 cm beyond the nozzle) within 25 cm
      },
      onRelease() { self.held = null; },
      onTouch() { G.act({ type: 'light' }); },
    };
    G.interactables.push(this.torchIt);
  }
  igniterWorld(out) { return this.rk.localToWorld(out.set(0, IGNITER_Y, 0)); }
  act(a) {
    if (a.type === 'light' && this.s.torch === 1 && !this.s.lit) { this.s.lit = 1; this.s.byYou = 1; return true; }
    return this.journal.act(a);
  }
  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast'), w = (x) => (fast ? Math.min(x, 0.5) : x);
    G.events.emit('placePlayers', { x: this.start.pos.x, z: this.start.pos.z, yaw: this.start.yaw });
    await G.ui.fadeIn(3);
    // Newton's cannon, Verne's cannon
    s.phase = 'verne';
    const l1 = D.sayAsync('ch13_01');
    await D.cue('stay up in space'); s.newton = 1;
    await D.cue('dream'); s.newton = 0;
    await D.cue('Jules Verne'); s.verne = 1;
    await D.cue('giant cannon'); s.capsule = 1;
    await l1;
    // Tsiolkovsky
    s.phase = 'tsiol'; s.guide = [-0.5, 2.0, -0.6];
    const l2 = D.sayAsync('ch13_02');
    await D.cue('hearing'); s.trumpet = 1;
    await D.cue('library books'); s.books = 1;
    await l2;
    s.guide = null; s.books = 0;
    // a cannon would never work: you need a rocket
    s.phase = 'rocket';
    const l3 = D.sayAsync('ch13_03');
    await D.cue('never work'); s.nogo = 1;
    await D.cue('You need a rocket'); s.rocket = 1; s.trumpet = 0;
    await D.cue('blasting gas'); s.rocket = 2;
    await D.cue('balloon'); s.balloon = 1;
    await l3;
    await D.until(() => this.balloonT > 3.2, w(4));
    s.verne = 0; s.nogo = 0; s.capsule = 0;
    // the math, the rocket train, the cradle
    s.phase = 'math';
    const l4 = D.sayAsync('ch13_04');
    await D.cue('math'); s.eq = 1; s.train = 1; s.rocket = 1;
    await D.cue('reach space'); s.train = 2;
    await D.cue('he wrote'); s.cradle = 1; s.eq = 0;
    await D.cue('cannot stay'); s.rocket = 3; s.station = 1; s.phase = 'cradle';
    await l4;
    await D.wait(w(5));
    // to America
    await G.ui.fadeOut(1.5);
    s.cradle = 0; s.train = 0; s.rocket = 0;
    s.scene = 'auburn'; this.setScene('auburn');
    G.events.emit('placePlayers', { x: 1.2, z: 1.6, yaw: 0.3 });
    await G.ui.fadeIn(2);
    s.phase = 'field';
    const l5 = D.sayAsync('ch13_05');
    await D.cue('Robert Goddard'); s.labels = 1; s.guide = [FRAME.x - 1.2, 3.4, FRAME.z + 0.6];
    await D.cue('gasoline'); s.labels = 2;
    await D.cue('liquid oxygen'); s.labels = 3; s.lox = 1;
    await l5;
    s.guide = null; s.phase = 'ready'; if (G.kids) s.henry = 1;
    await D.until(() => !G.kids || this.henryReady, w(6));
    await D.say('ch13_06');
    s.labels = 0;
    // light it (Adults: you're Henry)
    s.torch = 1;
    D.hint(G.mode === 'desktop' ? this.torchIt.deskHint : this.torchIt.hint, 10);
    await D.auto(() => s.lit, () => { s.henry = 1; if (this.henryReady) { s.henry = 2; s.lit = 1; } }, { after: fast ? 0.2 : 0.8, timeout: fast ? 3 : 30 });
    if (!s.lit) { s.henry = 1; await D.until(() => this.henryReady, w(8)); s.henry = 2; s.lit = 1; }
    s.torch = 0; G.ui.showHint('');
    s.phase = 'launch';
    await D.until(() => this.fT > 6.5, fast ? 6 : 14);
    // two and a half seconds, twelve meters, the cabbage patch... and every big rocket since
    s.phase = 'landed';
    const l7 = D.sayAsync('ch13_07'); s.arc = 1;
    await D.cue('Twelve meters'); s.arc = 2;
    await D.cue('cabbage patch'); s.arc = 3;
    await D.cue('every big rocket'); s.descend = 1; s.phase = 'descend';
    await l7;
    await D.wait(w(4));
    s.descend = 0; s.arc = 0;
    // the newspapers, empty space, and the apology
    s.phase = 'papers'; s.papers = 1;
    const l8 = D.sayAsync('ch13_08');
    await D.cue('never work in empty space'); s.vacuum = 1;
    await D.cue('They were wrong'); s.vacuum = 2; s.papers = 2;
    await D.cue('Almost fifty'); s.correction = 1;
    await l8;
    await D.wait(w(3));
    // the war: Peenemünde
    await G.ui.fadeOut(1.8);
    s.correction = 0; s.vacuum = 0; s.papers = 0;
    s.scene = 'baltic'; this.setScene('baltic');
    G.events.emit('placePlayers', { x: 0, z: 0, yaw: 0 });
    await G.ui.fadeIn(2.5);
    // ch13_09: the war, the man who led the team (Meem: give him his due, no more), the V-2
    s.phase = 'v2';
    const l9 = D.sayAsync('ch13_09');
    await D.cue('Wernher'); s.phase = 'vonbraun'; s.braun = 1;
    await D.cue('called the V-2'); s.braun = 2; s.phase = 'v2'; s.v2 = 1;
    await D.cue('prisoners'); s.lights = 1;
    await D.cue('But in 1944'); s.v2 = 2;
    await D.cue('first rocket'); s.v2 = 3;
    await l9;
    await D.until(() => this.v2Y > CLOUD + 40, fast ? 5 : 14);
    // the edge of space
    await G.ui.fadeOut(1);
    s.lights = 0; s.space = 1;
    await D.until(() => this.space.on, 2);
    await G.ui.fadeIn(1.5);
    await D.until(() => this.spT > 9, fast ? 3 : 12);
    // where the rocket builders went
    s.space = 2;
    const l10 = D.sayAsync('ch13_10');
    await D.cue('race'); s.race = 1;
    await l10;
    await D.until(() => this.mapT > 14, w(5));
    // home to Kaluga for the journal
    await G.ui.fadeOut(1.5);
    s.space = 0; s.race = 0; s.v2 = 0;
    s.scene = 'kaluga'; this.setScene('kaluga'); s.phase = 'night';
    G.events.emit('placePlayers', { x: this.start.pos.x, z: this.start.pos.z, yaw: this.start.yaw });
    await D.until(() => !this.space.on, 2);
    await G.ui.fadeIn(2);
    await D.wait(w(2.5));
    s.phase = 'journal';
    await this.journal.present(D);
    s.phase = 'done';
  }

  // ---------- Every frame ----------
  update(dt, t) {
    const G = this.G, s = this.s, fast = G.params.has('fast') ? 3 : 1;
    this.t += dt;
    if (s.scene !== this.cur) this.setScene(s.scene);
    const hour = this.cur === 'kaluga' ? (s.phase === 'night' || s.phase === 'journal' || s.phase === 'done' ? 22.5 : 21) + this.t / 900 : this.cur === 'auburn' ? 14.5 : 21.4;
    const sun = sunAt(this.lat, this.sl, hour); G.sky.set(sun.az, sun.el);
    if (this.cur === 'kaluga') G.sky.setMoon(this.moonAz, this.moonEl, 1.2, 0.3);
    this.life.update(dt, t);
    if (this.A.visible) this.updateKaluga(dt, t, fast);
    if (this.B.visible) this.updateAuburn(dt, t, fast);
    else if (this.wasB) this.resetAuburnHeld();
    this.wasB = this.B.visible;
    if (this.C.visible || this.space.on || s.space) this.updateBaltic(dt, t, fast);
    this.updateSpace(dt, t, fast);
    const busy = this.journal.update();
    guideUpdate(this, busy || this.space.on);
    this.space.update(dt);
  }
  resetAuburnHeld() { this.held = null; }

  updateKaluga(dt, t, fast) {
    const G = this.G, s = this.s, sk = this.sk;
    // the lamp and the stove flicker
    const fl = 0.85 + 0.15 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1);
    this.lamp.intensity = 3.2 * fl; this.lampFlame.scale.set(0.1 + 0.02 * fl, 0.17 * fl, 1);
    this.stoveLight.intensity = 1.1 + 0.4 * Math.sin(t * 7.3) * Math.sin(t * 3.1); this.stoveGlow.material.opacity = 0.6 + 0.2 * Math.sin(t * 6.1);
    this.airship.rotation.y = Math.sin(t * 0.2) * 0.3;
    for (const sm of this.smokesK) sm.update(dt, t);
    // snow
    const sp = this.snow.geometry.attributes.position, a = sp.array;
    for (let i = 0; i < this.snowV.length; i++) { a[i * 3 + 1] -= this.snowV[i] * dt; a[i * 3] += Math.sin(t * 0.7 + i) * 0.004; if (a[i * 3 + 1] < -1.5) a[i * 3 + 1] += 13; }
    sp.needsUpdate = true;
    // the sketches
    sk.newton.update(dt, s.newton === 1, fast);
    sk.verne.update(dt, s.verne === 1, fast); sk.verne.book.update(dt, s.verne === 1 && !s.nogo, fast);
    sk.nogo.update(dt, s.nogo === 1, fast);
    // the capsule flies out of the cannon toward the Moon
    if (s.capsule && this.capT == null) { this.capT = 0; G.audio.ctx && (G.audio.boom(this.capFrom), whoosh(G, 3, 0.25)); }
    if (!s.capsule) this.capT = null;
    if (this.capT != null) {
      this.capT += dt * fast; const k = clamp01(this.capT / 5);
      sk.capsule.g.position.copy(this.capFrom).addScaledVector(this.capDir, 4 + ease(k) * 120);
      G.camera.getWorldPosition(_a); sk.capsule.g.lookAt(_a); sk.capsule.g.rotateZ(Math.atan2(-this.capDir.x, this.capDir.y) * 0 + 0.6);
      sk.capsule.g.scale.setScalar(1 + k * 1.5);
    }
    sk.capsule.update(dt, this.capT != null && this.capT < 5, fast, 1.5);
    // Tsiolkovsky's rocket: drawn, blasting gas, then off out of the window to the stars
    const R = sk.rocket;
    R.update(dt, s.rocket >= 1, fast, 1.2);
    if (s.rocket === 3) {
      this.flyOutT = (this.flyOutT || 0) + dt * fast; const k = ease(this.flyOutT / 6);
      R.g.position.lerpVectors(this.rocketHome.pos, this.rocketSky, k); R.g.position.x += Math.sin(k * Math.PI) * -3; R.g.scale.setScalar(1 + k * 22);
    } else if (s.rocket) { this.flyOutT = 0; R.g.position.copy(this.rocketHome.pos); R.g.quaternion.copy(this.rocketHome.q); R.g.scale.setScalar(1); if (s.rocket === 2) R.g.position.addScaledVector(R.g.localToWorld(_a.set(0, 1, 0)).sub(R.g.position).normalize(), 0.05 + 0.04 * Math.sin(t * 9)); }
    if ((s.rocket === 2 || s.rocket === 3) && R.op > 0.5) {
      this.exT = (this.exT || 0) - dt;
      if (this.exT <= 0) {
        this.exT = 0.025; const sc = R.g.scale.x; R.g.localToWorld(_a.set((Math.random() - 0.5) * 0.08, -0.02, 0)); R.g.localToWorld(_b.set((Math.random() - 0.5) * 0.5, -1.2 - Math.random(), 0)).sub(R.g.position).multiplyScalar(0.6);
        this.exhK.emit(_a, _b, 0.03 * sc, 0.09 * sc, 1.0, 0.9, 0.5);
      }
    }
    this.exhK.update(dt);
    if (s.rocket === 3 && !this.flySnd) { this.flySnd = true; G.audio.ctx && (whoosh(G, 4, 0.35), shimmer(G, 4, 0.18)); }
    // the equation, the rocket train dropping its stages, the cradle, the station
    sk.eq.update(dt, s.eq === 1, fast);
    if (s.train === 2) this.trainT = (this.trainT || 0) + dt * fast; else if (!s.train) this.trainT = 0;
    this.stages.forEach((st, i) => {
      const drop = i < 3 && this.trainT > 0.8 + i * 1.3, dk = drop ? clamp01((this.trainT - 0.8 - i * 1.3) / 1.6) : 0;
      st.update(dt, s.train >= 1 && dk < 1, fast, drop ? 3 : 2);
      const up = Math.max(0, this.trainT - 0.8) * 0.06;
      st.g.position.copy(st.home).add(_a.set(dk * 0.15 * (i % 2 ? 1 : -1), up - dk * 0.5, 0));
      if (drop && !st.snd) { st.snd = true; G.audio.ctx && G.audio.tick(st.g.position); }
      if (!s.train) st.snd = false;
    });
    sk.cradle.update(dt, s.cradle === 1, fast);
    if (sk.cradle.op > 0.01) sk.cradle.g.rotation.z = Math.sin(t * 1.6) * 0.06;
    sk.station.update(dt, s.station === 1, fast, 0.8);
    if (sk.station.op > 0.01) { G.camera.getWorldPosition(_a); sk.station.g.lookAt(_a); sk.station.g.rotateZ(t * 0.1); }
    // the books fly round him (ch13_02)
    this.bookV = damp(this.bookV || 0, s.books ? 1 : 0, 1.5, dt);
    this.flyBooks.forEach((b, i) => {
      const a2 = t * 0.9 + i / 6 * 6.28, bc = this.bookCenter, c0 = _a.set(bc.x + Math.cos(a2) * 0.6, bc.y + Math.sin(t * 1.3 + i) * 0.12, bc.z + Math.sin(a2) * 0.6);
      b.position.lerpVectors(b.userData.home, c0, ease(this.bookV)); b.rotation.set(this.bookV * Math.sin(t * 2 + i) * 0.4, Math.PI / 2 + this.bookV * a2, this.bookV * 0.3);
    });
    this.bookGlow.position.copy(this.bookCenter); this.bookGlow.material.opacity = 0.6 * this.bookV;
    // the balloon, let go: zooms round the room, then flops onto the floor; the cat pounces
    if (s.balloon && this.balloonT == null) {
      this.balloonT = 0; dropProp(this.tsi, 'Right'); this.A.add(this.balloonM); this.balloonM.visible = true;
      this.tsi.inner.updateMatrixWorld(true); this.balloonFrom = this.tsi.g.position.clone().add(_a.set(0.25, 1.5, 0.2));
      if (G.audio.ctx) { const o = G.audio.out(this.balloonFrom, 0.5); for (let i = 0; i < 34; i++) G.audio.tone(o, { type: 'sawtooth', f: 95 + Math.random() * 70 + i * 2, peak: 0.18, a: 0.004, d: 0.07, t0: i * 0.075 }); G.audio.noise(o, { type: 'bandpass', f: 600, f2: 300, q: 2, peak: 0.25, a: 0.05, d: 2.4 }); }
    }
    if (this.balloonT != null && s.balloon) {
      this.balloonT += dt * fast; const k = this.balloonT;
      if (k < 2.6) { const a3 = k * 4.2; this.balloonM.position.set(-0.2 + Math.cos(a3) * 1.5 * (1 - k * 0.2), 1.6 + Math.sin(k * 6) * 0.5 + k * 0.2, -0.3 + Math.sin(a3) * 1.3); this.balloonM.rotation.set(Math.sin(k * 20) * 0.8, a3, Math.cos(k * 17) * 0.8); this.balloonM.scale.setScalar(1 - k * 0.22); }
      else { const f = clamp01((k - 2.6) / 0.7); this.balloonM.position.lerp(_a.set(0.5, 0.06, -1.4), f * 0.3); this.balloonM.scale.setScalar(0.42); this.balloonM.rotation.set(1.4, 0, 0); }
    }
    if (!s.balloon && s.phase !== 'rocket') { if (this.balloonM.parent === this.A) this.balloonM.visible = false; }
    this.updateCat(dt, t);
    this.updateTsio(dt, t);
    for (const P of this.walkersK) { runRoutine(P, dt, { height: kalugaHeight, speed: 0.9 }); (P.fig ? animateFigure : animatePerson)(P, t, dt); P.lamp?.userData.flicker(t); }
  }

  updateCat(dt, t) {
    const C = this.cat, s = this.s;
    this.catTail.rotation.z = Math.sin(t * 2.3) * 0.5;
    let look = null;
    if (this.balloonT != null && this.balloonT < 3.5 && s.balloon) look = this.balloonM.position;
    else if (this.s.rocket === 2) look = this.sk.rocket.g.position;
    if (s.balloon && this.balloonT > 2.6) { // pounce on it
      const f = clamp01((this.balloonT - 2.6) / 0.6); C.position.lerpVectors(this.catHome, _a.set(0.65, 0, -1.25), f); C.position.y = lerp(this.catHome.y, 0, f) + Math.sin(f * Math.PI) * 0.3;
    } else if (!s.balloon) C.position.copy(this.catHome);
    if (look) { const yaw = Math.atan2(look.x - C.position.x, look.z - C.position.z); C.rotation.y = damp(C.rotation.y, yaw, 4, dt); }
    this.catBody.position.y = Math.sin(t * 1.4) * 0.004;
  }

  updateTsio(dt, t) {
    const T = this.tsi, s = this.s, ph = s.phase;
    G_cam(this.G, _c);
    const face = (yaw) => { let d = yaw - T.g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); T.g.rotation.y += d * Math.min(1, dt * 2.5); };
    this.trumpetM.visible = !!s.trumpet;
    // he writes sitting at his desk (at the start, and again at night); otherwise he gets up and talks to you.
    // Getting up: he slides forward off the seat and stands between chair and desk, steps out past the
    // drawers, then walks to the rug. Sitting down is the same in reverse.
    const wantSit = ph === 'arrive' || ph === 'verne' || ph === 'night' || ph === 'journal' || ph === 'done';
    const route = [SEAT_FRONT, DESK_SIDE, TALK_SPOT];
    T.sitK ??= 1; T.leg ??= 0;   // leg: 0 seated .. 3 at the talk spot (index into the route)
    let busy = false;
    if (wantSit) {
      if (T.leg > 0) { const p = route[T.leg - 1]; if (walkToward(T, p.x, p.z, dt, { speed: 1.0, stop: 0.04 })) T.leg--; busy = true; }
      else { face(Math.PI); T.sitK = Math.min(1, T.sitK + dt * 1.8); busy = T.sitK < 1; }
    } else if (T.sitK > 0) { T.sitK = Math.max(0, T.sitK - dt * 1.8); busy = true; face(Math.PI); }
    else if (T.leg < 3) { const p = route[T.leg]; if (walkToward(T, p.x, p.z, dt, { speed: 1.0, stop: 0.04 })) T.leg++; busy = true; }
    if (T.leg === 0) { const k = ease(T.sitK); T.g.position.set(lerp(SEAT_FRONT.x, CHAIR.x, k), 0, lerp(SEAT_FRONT.z, CHAIR.z + 0.02, k)); }
    this.bookCenter.set(T.g.position.x, 1.75, T.g.position.z);
    if (busy && T.pose === 'walk') { T.look = null; }
    else if (wantSit || busy) { T.pose = T.sitK > 0.5 ? 'write' : 'idle'; T.look = this.sk.verne.op > 0.3 && Math.sin(t * 0.5) > 0 ? this.sk.verne.g.position : null; }
    else if (ph === 'tsiol') { face(Math.atan2(_c.x - T.g.position.x, _c.z - T.g.position.z)); T.pose = s.trumpet ? 'hold' : 'talk'; T.look = _c.clone(); }
    else if (ph === 'rocket') {
      face(Math.atan2(1.25 - T.g.position.x, -1.05 - T.g.position.z)); T.pose = s.balloon ? (this.balloonT > 2.6 ? 'cheer' : 'gasp') : 'point'; T.pointAt.copy(this.sk.rocket.g.position); T.look = s.balloon ? this.balloonM.position.clone() : this.sk.rocket.g.position.clone();
    }
    else if (ph === 'math') { face(Math.atan2(-2.1 - T.g.position.x, -1.25 - T.g.position.z)); T.pose = s.cradle ? 'talk' : 'point'; T.pointAt.copy(this.stages[1].g.position); T.look = s.cradle ? this.sk.cradle.g.position.clone() : T.pointAt.clone(); }
    else { face(Math.PI * 1.15); T.pose = 'idle'; T.look = this.sk.station.g.position; }
    if (ph === 'rocket' && !s.balloon) this.balloonM.visible = s.rocket >= 1;
    animatePerson(T, t, dt);
    sitPose(T, ease(T.sitK), SEAT_Y);
  }

  updateAuburn(dt, t, fast) {
    const G = this.G, s = this.s, fd = dt * fast;
    this.chimneyA.update(dt, t);
    // part labels and the rocket's glow
    this.rkLabs.forEach((l, i) => { const on = s.labels >= 1 && (i === 0 || (i === 1 && s.labels >= 2) || (i === 2 && s.labels >= 3) || (i === 3 && s.labels >= 1)); l.material.opacity = damp(l.material.opacity, on ? 1 : 0, 3, dt); });
    // liquid oxygen boiling off: white vapour from the tank
    if ((s.lox || s.labels >= 3) && !s.lit && Math.random() < dt * 8) { this.rk.localToWorld(_a.set(0.08, 0.95, 0)); this.puffA.emit(_a, _b.set(0.15 + Math.random() * 0.1, -0.05, (Math.random() - 0.5) * 0.1), 0.08, 0.5, 2.2, 0.55, 0.6, 0.1); }
    // the torch on the sawhorse glows when it's yours to take
    const yours = s.torch === 1 && !G.kids && !s.lit;
    this.torchGlow.material.opacity = yours ? 0.35 + 0.25 * Math.sin(t * 5) : 0;
    this.torchP.visible = !G.kids || false;
    if (!this.held) { this.torchP.position.copy(this.torchHome.pos); this.torchP.rotation.copy(this.torchHome.rot); }
    this.torchFlame.material.opacity = yours || this.held ? 0.9 : 0; this.torchP.userData.flicker(t, yours || this.held ? 1 : 0);
    // the igniter marker (Adults, when it is yours to light)
    this.ignMark.visible = yours; if (yours) { const pk = 0.5 + 0.5 * Math.sin(t * 6); this.ignRing.scale.setScalar(0.8 + 0.5 * pk); this.ignRing.material.opacity = 0.9 - 0.6 * pk; this.ignMark.children[0].material.opacity = 0.5 + 0.4 * pk; }
    // the blowtorch roars while it burns near you (yours, or Henry's on its way to the rocket)
    const henryBurning = G.kids || s.henry >= 1;
    if (G.audio.ctx && !s.lit && ((yours && this.held) || (henryBurning && s.henry >= 1))) {
      this.hissT = (this.hissT || 0) - dt;
      if (this.hissT <= 0) { this.hissT = 0.4; const src = this.held ? this.torchP.userData.tip : this.henryTorch.userData.tip; src.getWorldPosition(_a); G.audio.noise(G.audio.out(_a.clone(), 0.35, 2), { type: 'bandpass', f: 700 + Math.random() * 300, q: 0.8, peak: 0.5, a: 0.08, d: 0.45 }); }
    }
    // the fuse catches: a second of sparks and smoke at the nozzle, then the motor roars and the launch follows
    if (s.lit && this.fuseT == null) { this.fuseT = 0; this.heldDrop = true; this.held = null; if (G.audio.ctx) { const o = G.audio.out(this.rkBase, 0.8, 4); for (let i = 0; i < 14; i++) G.audio.noise(o, { type: 'highpass', f: 2000 + Math.random() * 3000, peak: 0.3 + Math.random() * 0.3, a: 0.002, d: 0.04, t0: i * 0.06 + Math.random() * 0.03 }); } }
    if (this.fuseT != null && this.fT == null) {
      this.fuseT += fd; this.igniterWorld(_a);
      for (let i = 0; i < 3; i++) this.fireA.emit(_a, _b.set((Math.random() - 0.5) * 2.5, -0.5 - Math.random() * 1.5, (Math.random() - 0.5) * 2.5), 0.03, 0.01, 0.35, 1, 0.5, -3);
      if (Math.random() < 0.5) this.puffA.emit(_a, _b.set((Math.random() - 0.5) * 0.3, -0.2, (Math.random() - 0.5) * 0.3), 0.06, 0.5, 1.6, 0.5, 0.8, 0.35);
      if (this.fuseT > 0.9) this.fT = 0;
    }
    if (this.fT != null) this.updateLaunch(dt, t, fd);
    this.puffA.update(dt); this.fireA.update(dt);
    // the flight path, labels
    this.trail.visible = s.arc >= 1;
    if (this.trail.visible) { this.trailK = Math.min(1, (this.trailK || 0) + fd / 1.5); this.trail.geometry.setDrawRange(0, Math.floor(201 * this.trailK) + (s.arc >= 2 ? 51 : 0)); this.trail.material.uniforms.opacity.value = 0.9; } else this.trailK = 0;
    this.arcLabs.forEach((l, i) => { l.material.opacity = damp(l.material.opacity, s.arc >= i + 1 ? 1 : 0, 3, dt); });
    // the rockets that came after
    this.descend.forEach((d, i) => {
      if (s.descend) d.riseT = (d.riseT || 0) + fd; else d.riseT = 0;
      const delay = i * 0.9, k = clamp01((d.riseT - delay) / 6);
      d.update(dt, s.descend === 1 && d.riseT > delay, fast, 1.2);
      d.g.position.y = d.y0 + ease(k) * 4 + Math.max(0, d.riseT - delay - 6) * 0.6;
      if (d.op > 0.4 && s.descend && Math.random() < dt * 30) { d.g.localToWorld(_a.set((Math.random() - 0.5) * 6, -4, 0)); this.descendExh.emit(_a, _b.set((Math.random() - 0.5) * 6, -1, (Math.random() - 0.5) * 3), 3, 12, 3, 0.35, 0.3); }
    });
    if (s.descend && !this.descSnd) { this.descSnd = true; G.audio.ctx && (rumble(G, 8, 0.25, null), awe(G, 14, 0.09, 87)); }
    this.descendExh.update(dt);
    this.updatePapers(dt, t, fd);
    this.updatePeopleA(dt, t);
  }

  updateLaunch(dt, t, fd) {
    const G = this.G, s = this.s;
    const T0 = this.fT; this.fT += fd; const T = this.fT, A = G.audio;
    if (T0 === 0) { if (A.ctx) { const o = A.out(this.rkBase, 1.4, 6); A.noise(o, { type: 'highpass', f: 1500, peak: 0.6, a: 0.003, d: 0.25 }); A.noise(o, { type: 'lowpass', f: 1600, f2: 500, q: 0.6, peak: 0.85, a: 0.15, d: 5.2 }); rumble(G, 4, 0.35, this.rkBase); } this.dogA.mode = 'follow'; this.dogA.lead.set(30, 0, 24); this.dogA.animals.forEach((o) => { o.wait = 0; }); }
    // on the stand: roaring, shaking; then 2.5 s of flight; then lying in the cabbages
    const u = clamp01((T - 2.2) / 2.5);
    if (T < 2.2) { this.rk.position.copy(this.rkBase); this.rk.position.x += (Math.random() - 0.5) * 0.008; this.rk.position.z += (Math.random() - 0.5) * 0.008; this.rk.rotation.set(0, 0, 0); }
    else if (u < 1) {
      this.flightPos(u, this.rk.position);
      this.flightPos(Math.min(1, u + 0.02), _a); _b.copy(_a).sub(this.rk.position).normalize();
      if (u >= 0.999) _b.copy(this.rk.position).sub(this.flightPos(0.98, _a)).normalize();
      this.rk.quaternion.setFromUnitVectors(UP, _b);
      if (!this.liftSnd) { this.liftSnd = true; A.ctx && whoosh(G, 2.5, 0.4, this.rkBase); this.crowsDown.visible = false; this.crowsUp.group.visible = true; this.crowsUp.center.set(-14, 3, -20); }
    } else {
      this.flightPos(1, this.rk.position); this.rk.position.y -= 0.15;
      this.rk.quaternion.setFromAxisAngle(_a.set(1, 0, -1).normalize(), 1.25);
      if (!this.landed) {
        this.landed = true;
        if (A.ctx) { A.noise(A.out(this.rk.position, 1, 10), { type: 'lowpass', f: 300, peak: 0.7, a: 0.005, d: 0.5 }); setTimeout(() => A.cheer(V3(3, 1, 1)), 700); }
        for (let i = 0; i < 26; i++) this.puffA.emit(this.rk.position, _a.set((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4), 0.4, 2.2, 2.5, 0.8, 1.2, -0.5);
      }
    }
    this.lastRk = (this.lastRk || new THREE.Vector3()); 
    this.crowsUp.center.y = damp(this.crowsUp.center.y, 14, 0.8, fd);
    const burning = T < 4.6;
    this.flameA.visible = burning;
    if (burning) {
      const fl = 0.8 + 0.3 * Math.random(); this.flameA.scale.set(fl, (T < 0.3 ? T / 0.3 : 1) * (0.8 + 0.3 * Math.random()), fl);
      this.rkLight.intensity = 6 * fl;
      // the flame hits the cone shield and the smoke spills out (a trail of it while it flies)
      this.puffAcc = (this.puffAcc || 0) + dt * 50;
      while (this.puffAcc >= 1) {
        this.puffAcc -= 1; const k = Math.random();
        this.rk.localToWorld(_a.set(0, 1.25, 0)); _a.addScaledVector(_c.subVectors(this.rk.position, this.lastRk || this.rk.position), -k); const ang = Math.random() * 6.28;
        this.fireA.emit(_a, _b.set(Math.cos(ang) * 1.5, -0.6, Math.sin(ang) * 1.5), 0.2, 0.6, 0.4, 0.8, 2);
        this.puffA.emit(_a, _b.set(Math.cos(ang) * 1.2, -0.3 + Math.random() * 0.4, Math.sin(ang) * 1.2), 0.35, 2.2, 3.5, 0.6, 0.8, 0.2);
      }
    } else this.rkLight.intensity = damp(this.rkLight.intensity, 0, 4, fd);
    this.lastRk.copy(this.rk.position);
  }

  updatePapers(dt, t, fd) {
    const G = this.G, s = this.s; G_cam(G, _c);
    this.papers.forEach((m, i) => {
      const d = m.userData;
      if (s.papers === 1) { m.visible = true; d.out = 0; m.material.opacity = damp(m.material.opacity, 1, 2, dt); d.a += dt * d.v; m.position.set(_c.x + Math.cos(d.a) * 1.3, d.h + Math.sin(t * 1.3 + i) * 0.12, _c.z + Math.sin(d.a) * 1.3 - 0.2); m.lookAt(_c); m.rotateZ(Math.sin(t * 1.1 + i) * 0.2); }
      else if (s.papers === 2) { d.out = (d.out || 0) + fd; m.position.add(_a.set(-1.5 - i * 0.3, 1.6, -2.5).multiplyScalar(dt * fd / dt * d.out)); m.rotation.x += dt * 3; m.rotation.z += dt * 2; m.material.opacity = clamp01(1 - d.out / 3); m.visible = m.material.opacity > 0.01; if (!this.blowSnd) { this.blowSnd = true; whoosh(G, 2, 0.3); } }
      else { m.material.opacity = damp(m.material.opacity, 0, 3, dt); m.visible = m.material.opacity > 0.01; }
    });
    // the correction, glowing
    const cv = this.corrV = damp(this.corrV || 0, s.correction ? 1 : 0, 1.5, dt);
    this.correction.visible = cv > 0.01;
    if (this.correction.visible) { G.camera.getWorldDirection(_a).setY(0).normalize(); if (!this.corrPlaced) { this.corrPlaced = true; this.correction.position.copy(_c).addScaledVector(_a, 0.85).add(_b.set(-_a.z, 0, _a.x).multiplyScalar(0.5)).setY(_c.y - 0.08); } this.correction.lookAt(_c); this.correction.material.opacity = cv; this.corrGlow.material.opacity = 0.5 * cv; if (!this.corrSnd) { this.corrSnd = true; shimmer(G, 3, 0.15); } }
    // the bubble of empty space
    const vv = this.vacV = damp(this.vacV || 0, s.vacuum ? 1 : 0, 2, dt);
    this.vac.visible = vv > 0.01;
    if (this.vac.visible) {
      this.vac.lookAt(_c);   // the little rocket flies across your view (its nose is +x)
      this.vacShell.material.uniforms.a.value = vv; this.vacInner.material.opacity = 0.55 * vv;
      this.vacLabs[0].material.opacity = vv; this.vacLabs[1].material.opacity = this.vacLabs[2].material.opacity = this.vacLabs[3].material.opacity = s.vacuum === 2 ? vv : 0;
      if (s.vacuum === 2) this.vacX = (this.vacX ?? -0.22) + fd * 0.12; else this.vacX = -0.22;
      if (this.vacX > 0.26) this.vacX = -0.22;
      this.vacRocket.position.set(this.vacX, 0, 0);
      const S = this.vacGas.userData;
      this.vacGasD.forEach((q, i) => { q.t += dt * q.v * 2; if (q.t > 1) q.t -= 1; const on = s.vacuum === 2 ? 1 : 0, x = this.vacX - 0.08 - q.t * 0.3; S.pos.set([x, q.y * (1 + q.t * 3), q.z * (1 + q.t * 3)], i * 3); const b = on * vv * (1 - q.t) * (x > -0.4 ? 1 : 0); S.col.set([b * 0.6, b * 0.8, b], i * 3); S.size[i] = 0.01; });
      S.commit();
    }
  }

  updatePeopleA(dt, t) {
    const s = this.s, G = this.G, ph = s.phase, Gd = this.god, H = this.henry, E = this.esther, Rp = this.roope;
    const rkp = this.rk.getWorldPosition(_d).clone(); rkp.y += 1.5;
    const flying = this.fT != null && this.fT > 2.2 && !this.landed, launched = this.fT != null;
    // Goddard: checking his rocket, then back by the shelter; "All right, Henry. Light it."
    if (ph === 'field' || ph === 'arrive' || ph === 'verne') { if (walkAround(Gd, 1.1, -2.9, dt, { height: auburnHeight }, this.obsA)) { Gd.g.rotation.y = damp(Gd.g.rotation.y, Math.atan2(FRAME.x - 1.1, FRAME.z + 2.9), 3, dt); Gd.pose = s.labels ? 'point' : 'work'; Gd.pointAt.copy(this.rk.localToWorld(_a.set(0, s.labels >= 3 ? 0.8 : s.labels >= 2 ? 0.4 : 2.5, 0))); Gd.look = Gd.pointAt.clone(); } }
    else if (ph === 'ready') { if (walkAround(Gd, 3.2, 1.6, dt, { height: auburnHeight, speed: 1.2 }, this.obsA)) { Gd.pose = 'talk'; Gd.look = H.g.position.clone().setY(1.6); G_cam(G, _a); Gd.g.rotation.y = damp(Gd.g.rotation.y, Math.atan2(_a.x - 3.2, _a.z - 1.6), 3, dt); if (G.kids) Gd.look = rkp.clone(); } }
    else if (ph === 'launch' && !this.landed) { walkAround(Gd, 3.2, 1.6, dt, { height: auburnHeight }, this.obsA); Gd.pose = flying ? 'point' : 'gasp'; Gd.pointAt.copy(rkp); Gd.look = rkp.clone(); }
    else if (ph === 'launch' || ph === 'landed' || ph === 'descend') { if (walkAround(Gd, -14, -16, dt, { height: auburnHeight, speed: 1.4 }, this.obsA)) { Gd.pose = s.descend ? 'point' : 'cheer'; Gd.pointAt.set(0, 60, -150); Gd.look = s.descend ? Gd.pointAt.clone() : rkp.clone(); } }
    else { if (walkAround(Gd, -1.6, 0.3, dt, { height: auburnHeight, speed: 1.2 }, this.obsA)) { Gd.pose = s.correction ? 'idle' : 'talk'; G_cam(G, _a); Gd.look = _a.clone(); Gd.g.rotation.y = damp(Gd.g.rotation.y, Math.atan2(_a.x + 1.6, _a.z - 0.3), 3, dt); } }
    animatePerson(Gd, t, dt);
    // Henry: walks up with the blowtorch on its pole, lights it, hurries back
    this.henryTorch.userData.flicker(t, launched ? 0 : 0.8);
    this.henryTorch.visible = !(!G.kids && s.torch === 1) && !(s.byYou);
    if (s.henry >= 1 && !launched) { if (walkAround(H, HENRY_LIGHT.x, HENRY_LIGHT.z, dt, { height: auburnHeight }, this.obsA)) { this.henryReady = true; H.g.rotation.y = damp(H.g.rotation.y, Math.atan2(FRAME.x - HENRY_LIGHT.x, FRAME.z - HENRY_LIGHT.z), 4, dt); H.pose = s.henry >= 2 ? 'point' : 'hold'; H.pointAt.copy(this.igniterWorld(_a)); H.look = H.pointAt.clone(); } }
    else if (launched && !this.landed) { if (walkAround(H, 4.0, 2.4, dt, { height: auburnHeight, speed: 2.6 }, this.obsA)) { H.pose = flying ? 'point' : 'gasp'; H.pointAt.copy(rkp); H.look = rkp.clone(); } }
    else if (this.landed && (ph === 'launch' || ph === 'landed' || ph === 'descend')) { if (walkAround(H, -16, -17.5, dt, { height: auburnHeight, speed: 1.6 }, this.obsA)) { H.pose = 'cheer'; H.look = rkp.clone(); } }
    else if (!launched) { H.pose = 'idle'; H.look = null; H.glance = true; }
    else { H.pose = 'idle'; H.look = null; H.glance = true; }
    animateFigure(H, t, dt);
    // the pole: sloping up ahead of him as he walks; reaching its flame into the nozzle when he lights it
    {
      const TP = this.henryTorch, L = 1.8 + 0.21, reach = s.henry >= 1 && !launched && this.henryReady;
      H.g.updateMatrixWorld(true);
      const base = _a.set(-0.12, 1.0, 0.3), dir = _b.set(0, Math.sin(0.75), Math.cos(0.75));
      if (reach) { const ign = H.g.worldToLocal(this.igniterWorld(_c)); const sh = _d.set(-0.1, 1.3, 0.05); dir.copy(ign).sub(sh).normalize(); base.copy(ign).addScaledVector(dir, -L); }
      this.hDir = (this.hDir || V3(0, 0.68, 0.73)).lerp(dir, Math.min(1, dt * 3)).normalize(); this.hBase = (this.hBase || base.clone()).lerp(base, Math.min(1, dt * 3));
      TP.position.copy(this.hBase); TP.quaternion.setFromUnitVectors(UP, this.hDir);
      aimArm(H, 0, H.g.localToWorld(_c.copy(this.hBase).addScaledVector(this.hDir, 0.05)), dt); aimArm(H, 1, H.g.localToWorld(_c.copy(this.hBase).addScaledVector(this.hDir, 0.35)), dt);
    }
    // Esther films; Roope times it with his stopwatch
    // Esther: eye to the viewfinder, one hand steadying the camera, the other turning its crank (two turns a second)
    const cranking = launched || s.labels; this.crank.rotation.z = cranking ? -t * 12.5 : this.crank.rotation.z;
    this.crankHandle.getWorldPosition(_a); aimArm(E, 0, _a, dt);
    aimArm(E, 1, this.camGrip, dt);
    E.inner.rotation.x = 0.08; animateFigureLegs(E, dt);   // leaning in, her eye just at the eyepiece
    Rp.g.rotation.y = damp(Rp.g.rotation.y, Math.atan2(rkp.x - Rp.g.position.x, rkp.z - Rp.g.position.z), 3, dt);
    Rp.pose = this.landed && ph !== 'papers' ? 'cheer' : flying ? 'point' : 'hold'; Rp.pointAt.copy(rkp); Rp.look = rkp.clone(); animateFigure(Rp, t, dt);
  }

  updateBaltic(dt, t, fast) {
    const G = this.G, s = this.s, fd = dt * fast, A = G.audio;
    this.clouds.material.uniforms.t.value = t;
    this.floodGlow.material.opacity = this.flood2Glow.material.opacity = 0.8 + 0.1 * Math.sin(t * 50);
    // the erector lowers away
    this.erector.rotation.z = damp(this.erector.rotation.z, s.v2 >= 1 ? -0.5 : 0, 0.5, dt);
    this.v2Lab.material.opacity = damp(this.v2Lab.material.opacity, s.v2 === 1 && !s.lights ? 1 : 0, 2, dt);
    // vapour from the liquid oxygen, before launch
    if (s.v2 < 3 && Math.random() < dt * 10) { this.v2.localToWorld(_a.set(0.8, 6 + Math.random() * 2, 0)); this.puffC.emit(_a, _b.set(0.8, -0.4, (Math.random() - 0.5) * 0.4), 0.5, 3.5, 4, 0.5, 0.4, -0.1); }
    // the engineers walk back to the bunker
    this.eng.forEach((P, i) => {
      if (s.v2 >= 1) { if (walkToward(P, 4.5 + i * 1.3, -3.5, dt, { height: balticHeight, speed: 1.6 })) { P.pose = s.v2 === 3 ? 'point' : 'idle'; P.pointAt.copy(this.v2.position).setY(this.v2.position.y + 10); P.look = P.pointAt.clone(); P.g.rotation.y = damp(P.g.rotation.y, Math.PI, 2, dt); } }
      else { P.pose = 'work'; P.look = null; }
      (P.fig ? animateFigure : animatePerson)(P, t, dt);
    });
    // von Braun watches; his name while his line plays; he looks up as it climbs
    const B2 = this.braun; this.braunLab.material.opacity = damp(this.braunLab.material.opacity, s.braun === 1 ? 1 : 0, 2.5, dt);
    B2.pose = this.liftT != null && this.v2Y < 120 ? 'point' : 'idle'; B2.pointAt.copy(this.v2.position).setY(this.v2.position.y + 8);
    animateFigure(B2, t, dt); B2.inner.rotation.x = this.liftT != null ? -0.08 : 0;
    // remembrance lights
    const mv = this.memV = damp(this.memV || 0, s.lights ? 1 : 0, 0.6, dt);
    this.memorial.visible = mv > 0.01 && this.C.visible;
    this.candles.visible = this.memorial.visible; this.candles.material.opacity = clamp01(mv * 1.5);
    if (this.memorial.visible) { const M = this.memorial.userData; this.memD.forEach((q, i) => { const on = clamp01(mv * 2 - q.at), b = on * (0.7 + 0.3 * Math.sin(t * 3 + q.ph)); M.pos.set([q.x, q.y, q.z], i * 3); M.col.set([b, b * 0.75, b * 0.4], i * 3); M.size[i] = 0.12; }); M.commit(); }
    // ignition, then lift-off: up through the clouds, leaning away toward the sea
    if (s.v2 >= 2 && this.ignT == null) { this.ignT = 0; if (A.ctx) { rumble(G, 10, 0.7, this.v2Base); A.noise(A.out(this.v2Base, 1.2, 20), { type: 'lowpass', f: 900, f2: 300, q: 0.7, peak: 0.8, a: 1.5, d: 12 }); } this.deer.lead.set(-140, 0, 60); this.deer.animals.forEach((o) => { o.wait = 0; }); }
    if (this.ignT != null) this.ignT += fd;
    if (s.v2 === 3 && this.liftT == null) { this.liftT = 0; if (A.ctx) { A.noise(A.out(null, 0.6), { type: 'lowpass', f: 1400, f2: 200, q: 0.6, peak: 0.9, a: 2, d: 14 }); awe(G, 16, 0.06, 55); } }
    let y = 0;
    if (this.liftT != null) { this.liftT += fd; const tt = this.liftT; y = 3 * tt * tt + 0.6 * tt * tt * tt; }
    this.v2Y = y;
    const lean = clamp01((y - 40) / 260) * 0.4;
    this.v2.position.set(PAD.x, this.v2Base.y + y, PAD.z - y * lean * 0.6);
    this.v2.rotation.x = -lean;
    const burning = this.ignT != null;
    this.flameC.visible = burning;
    if (burning) {
      const g = this.liftT != null ? 1 : clamp01(this.ignT / 2) * 0.5, fl = 0.85 + 0.25 * Math.random();
      this.flameC.scale.set(fl * (0.6 + 0.4 * g), g * (0.85 + 0.3 * Math.random()), fl * (0.6 + 0.4 * g));
      this.v2Light.intensity = 140 * g * fl;
      // smoke billowing out along the ground, flame glow below
      if (y < 60) for (let i = 0; i < 3; i++) { const ang = Math.random() * 6.28, sp2 = 6 + Math.random() * 8; this.puffC.emit(_a.set(PAD.x, 1.2 + y * 0.3, PAD.z), _b.set(Math.cos(ang) * sp2, 1 + Math.random() * 2, Math.sin(ang) * sp2 * 0.7), 3, 16, 7, 0.6 * g + 0.2, 0.35, 0.4); }
      this.v2.localToWorld(_a.set(0, -1.5, 0)); this.fireC.emit(_a, _b.set((Math.random() - 0.5) * 3, -12, (Math.random() - 0.5) * 3), 2.5, 6, 0.5, 0.8 * g, 1);
      if (y > 0 && Math.random() < 0.6) this.puffC.emit(_a.set(this.v2.position.x, this.v2.position.y - 6, this.v2.position.z), _b.set((Math.random() - 0.5) * 2, -3, (Math.random() - 0.5) * 2), 3, 10, 9, 0.45, 0.2, 0.0);
    } else this.v2Light.intensity = 0;
    const U = this.clouds.material.uniforms; U.glowP.value.copy(this.v2.position).setY(CLOUD); U.glowA.value = burning ? clamp01(1 - Math.abs(this.v2.position.y - CLOUD) / 120) * 1.2 + 0.15 * clamp01(y / 100) : 0;
    this.puffC.update(dt); this.fireC.update(dt);
  }

  // ---------- out in space ----------
  updateSpace(dt, t, fast) {
    const G = this.G, s = this.s, sp = this.space, R = sp.R;
    if (s.space && !sp.on) this.enterSpace();
    if (!s.space && sp.on) { sp.exit(); this.spT = 0; this.mapT = 0; }
    if (!sp.on) return;
    const E = sp.earth;
    this.spT = (this.spT || 0) + dt * fast;
    if (s.space === 2) this.mapT = (this.mapT || 0) + dt * fast;
    const mk = ease((this.mapT || 0) / 5);
    sp.sunDir.copy(this.sunNear).lerp(this.sunFar, mk).normalize();
    E.position.lerpVectors(this.E0, this.E1, mk); E.quaternion.slerpQuaternions(this.q0, this.q1, mk); E.updateMatrixWorld(true);
    const nP = lonLat(...PEEN, _a).clone();
    // the V-2 climbing to the edge of space (its height drawn three times bigger, so you can see it)
    const climb = ease(clamp01(this.spT / 6)), h = 0.085 * R * climb, T = this.spTrail.userData;
    for (let i = 0; i < 240; i++) { const f = i / 239 * climb, p = _b.copy(nP).multiplyScalar(R * 1.002 + 0.085 * R * ease(f)); T.pos.set([p.x, p.y, p.z], i * 3); const b = (0.3 + 0.7 * (i / 239)) * (1 - mk); T.col.set([b, b * 0.7, b * 0.35], i * 3); T.size[i] = 0.12; }
    T.commit();
    this.spDot.position.copy(nP).multiplyScalar(R * 1.002 + h); this.spDot.material.opacity = (1 - mk) * (0.7 + 0.3 * Math.sin(t * 9)); this.spDot.scale.setScalar(0.8 + 0.3 * Math.sin(t * 7));
    const lab = (l, v, p, off) => { l.material.opacity = damp(l.material.opacity, v, 2.5, dt); if (p) l.position.copy(p).add(off); };
    const wDot = this.spDot.getWorldPosition(_c);
    lab(this.spLabs.v2, this.spT > 4 && !s.race && mk < 0.5 ? 1 : 0, wDot, _d.set(0, 0.9, 0));
    G_cam(G, _b); lab(this.spLabs.first, this.spT > 5.5 && s.space === 1 ? 1 : 0, _b.clone().add(this.spF.clone().multiplyScalar(14)), _d.set(0, 3.2, 0));
    // the map: where the rocket builders went
    const A = this.spArcs.userData; let n = 0;
    const dot = (p, r, g, b, sz) => { if (n >= 700) return; A.pos.set([p.x, p.y, p.z], n * 3); A.col.set([r, g, b], n * 3); A.size[n] = sz; n++; };
    const arc = (to, k0, col) => {
      const k = clamp01(((this.mapT || 0) - k0) / 4), m = lonLat(...to, _d).clone(), N = 300;
      for (let i = 0; i < N; i++) { const f = i / N; if (f > k) break; const p = _b.copy(nP).lerp(m, f).normalize().multiplyScalar(R * (1.01 + 0.18 * Math.sin(Math.PI * f))); const head = k < 1 && f > k - 0.03; dot(p, col[0] * (head ? 2 : 1), col[1] * (head ? 2 : 1), col[2] * (head ? 2 : 1), head ? 0.5 : 0.22); }
      return k;
    };
    const kU = s.space === 2 ? arc(WSANDS, 3, [1, 0.75, 0.4]) : 0, kS = s.space === 2 ? arc(MOSCOW, 4.5, [1, 0.45, 0.35]) : 0;
    // the race: from both, little lights go round the world
    if (s.race) {
      this.raceT = (this.raceT || 0) + dt * fast;
      for (const [o, ph, col] of [[WSANDS, 0, [1, 0.8, 0.5]], [MOSCOW, 0.5, [1, 0.5, 0.4]]]) {
        const st = lonLat(...o, _b).clone(), ax = _d.copy(st).cross(UP).normalize();
        for (let i = 0; i < 40; i++) { const a = this.raceT * 0.9 - i * 0.02 + ph * 0; const rr = R * (1.02 + Math.min(0.12, this.raceT * 0.05)); const p = st.clone().applyAxisAngle(ax, a).multiplyScalar(rr); dot(p, col[0] * (1 - i / 40), col[1] * (1 - i / 40), col[2] * (1 - i / 40), 0.28); }
      }
      if (this.raceT > 4 && !this.beeped) { this.beeped = true; beeps(G, 5, 0.12); }
    }
    while (n < 700) dot(_b.set(0, 0, 0), 0, 0, 0, 0);
    A.commit();
    [PEEN, WSANDS, MOSCOW].forEach((p, i) => { const pin = this.spPins[i]; pin.position.copy(lonLat(...p, _b)).multiplyScalar(R * 1.01); pin.material.opacity = s.space === 2 ? (i === 0 ? 1 : i === 1 ? kU : kS) * (0.7 + 0.3 * Math.sin(t * 5 + i)) : 0; });
    const wp = (ll) => E.localToWorld(lonLat(...ll, _b).multiplyScalar(R * 1.05)).clone();
    lab(this.spLabs.peen, s.space === 2 && mk > 0.6 ? 1 : 0, wp(PEEN), _d.set(0, 1.4, 0));
    lab(this.spLabs.usa, kU >= 1 ? 1 : 0, wp(WSANDS), _d.set(-1, 1.6, 0));
    lab(this.spLabs.ussr, kS >= 1 ? 1 : 0, wp(MOSCOW), _d.set(2, 1.6, 0));
    lab(this.spLabs.race, s.race && this.raceT > 2 ? 1 : 0, E.position, _d.set(0, R * 1.25, 0));
  }

  enterSpace() {
    const G = this.G, sp = this.space, R = sp.R;
    const cam = G.camera.getWorldPosition(V3()), f = G.camera.getWorldDirection(V3()).setY(0); if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const right = V3().crossVectors(f, UP).normalize();
    this.spF = f; this.spT = 0; this.mapT = 0; this.raceT = 0; this.beeped = false;
    const basis = (c, t1, out) => { const z = c.clone().normalize(), y = t1.clone().addScaledVector(z, -t1.dot(z)).normalize(), x = V3().crossVectors(y, z); return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); };
    const north = (c) => V3(0, 1, 0);
    const frame = (llLocal, wC, wUp) => { const c = lonLat(...llLocal); const qL = basis(c, north(c), new THREE.Quaternion()), qW = basis(wC, wUp, new THREE.Quaternion()); return qW.multiply(qL.invert()); };
    // near: the Earth below you, Peenemünde ahead on the curve, near the edge of the disc
    const th = 0.36, n0 = UP.clone().multiplyScalar(Math.cos(th)).addScaledVector(f, Math.sin(th));
    this.E0 = cam.clone().addScaledVector(UP, -1.18 * R); this.q0 = frame(PEEN, n0, f);
    // far: the whole Earth ahead of you, the Atlantic in the middle
    this.E1 = cam.clone().addScaledVector(f, 2.9 * R).addScaledVector(UP, -0.12 * R); this.q1 = frame([45, -50], f.clone().negate(), UP);
    this.sunNear = UP.clone().multiplyScalar(0.7).addScaledVector(f, -0.35).addScaledVector(right, 0.6).normalize(); this.sunFar = f.clone().multiplyScalar(-0.8).addScaledVector(UP, 0.35).addScaledVector(right, 0.45).normalize();
    sp.sunDir.copy(this.sunNear);
    sp.earth.position.copy(this.E0); sp.earth.quaternion.copy(this.q0);
    sp.enter(this.root);
    if (G.audio.ctx) { awe(G, 16, 0.08, 98); shimmer(G, 4, 0.15); }
  }

  dispose() {
    this.space.dispose();
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.sky.hideMoon();
  }
}

function G_cam(G, out) { return G.camera.getWorldPosition(out); }
function gableWallGeo(w, h) { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }); g.translate(0, 0, -0.1); return g; }
let _gt = null;
function glowTexture() { return (_gt ||= canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); })); }

// A newspaper page (date, headline, a line of story, columns of grey text)
function paperTex(date, h1, h2, sub, gold = false) {
  return canvasTex(512, 680, (g, w, h) => {
    g.fillStyle = gold ? '#f4ead0' : '#e8e2d2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1a1a'; g.textAlign = 'center';
    g.font = 'bold 54px Georgia, serif'; g.fillText('THE NEWS', w / 2, 70);
    g.fillRect(24, 88, w - 48, 3); g.font = '20px Georgia, serif'; g.fillText(date, w / 2, 114); g.fillRect(24, 124, w - 48, 2);
    g.font = 'bold 44px Georgia, serif'; g.fillText(h1, w / 2, 190); if (h2) g.fillText(h2, w / 2, 240);
    g.font = 'italic 22px Georgia, serif';
    const words = sub.split(' '); let line = '', y = h2 ? 290 : 250;
    for (const wd of words) { if (g.measureText(line + wd).width > w - 70) { g.fillText(line, w / 2, y); y += 30; line = ''; } line += wd + ' '; }
    g.fillText(line, w / 2, y);
    g.fillStyle = 'rgba(40,40,40,0.35)';
    for (let c = 0; c < 3; c++) for (let i = 0; i < 18; i++) g.fillRect(30 + c * 155, y + 40 + i * 16, 140 - (i % 5 === 4 ? 50 : 0), 7);
    if (gold) { g.strokeStyle = '#c0901a'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); }
  });
}

// The journal page: Tsiolkovsky's rocket and his words, Goddard's first flight, and why a rocket works in space
function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 42px Georgia, serif'; g.textAlign = 'left';
  g.fillText('The rocket dreamers, 1903 to 1944', 40, 66);
  g.strokeStyle = INK; g.lineWidth = 3;
  // Tsiolkovsky's rocket
  const rx = 120;
  g.beginPath(); g.moveTo(rx - 22, 470); g.lineTo(rx - 22, 230); g.quadraticCurveTo(rx - 22, 150, rx, 130); g.quadraticCurveTo(rx + 22, 150, rx + 22, 230); g.lineTo(rx + 22, 470); g.stroke();
  g.beginPath(); g.moveTo(rx - 22, 470); g.lineTo(rx - 36, 515); g.lineTo(rx + 36, 515); g.lineTo(rx + 22, 470); g.stroke();
  g.strokeRect(rx - 15, 260, 30, 80); g.strokeRect(rx - 15, 350, 30, 80);
  g.font = 'italic 20px Georgia, serif'; g.fillStyle = INK; g.fillText('hydrogen', rx + 30, 300); g.fillText('oxygen', rx + 30, 395);
  g.fillStyle = 'rgba(224,120,42,0.5)'; g.beginPath(); g.moveTo(rx - 30, 520); g.lineTo(rx, 600); g.lineTo(rx + 30, 520); g.fill();
  g.fillStyle = INK; g.font = 'italic 24px Georgia, serif'; g.fillText('Tsiolkovsky, 1903', 40, 640);
  g.font = 'italic 26px Georgia, serif'; g.fillText('V = c · ln (M₀ / M₁)', 240, 150);
  g.font = 'italic 22px Georgia, serif'; g.fillText('"The Earth is the cradle of humanity,', 240, 200); g.fillText('but we cannot stay in the cradle forever."', 250, 230);
  // Goddard's flight
  const gx = 640, gy = 500;
  g.beginPath(); g.moveTo(gx, gy); g.quadraticCurveTo(gx + 150, gy - 300, gx + 300, gy); g.setLineDash([8, 8]); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#5a7a4a'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(gx + 270 + i * 16, gy + 6, 8, 0, 6.28); g.fill(); }
  g.fillStyle = INK; g.fillRect(gx - 3, gy - 60, 6, 60); g.fillRect(gx - 8, gy - 70, 16, 12);
  g.font = 'italic 22px Georgia, serif'; g.fillText('12.5 m', gx + 120, gy - 165); g.fillText('2.5 s', gx + 40, gy - 90); g.fillText('cabbages!', gx + 250, gy + 40);
  g.fillText('Goddard, 16 March 1926:', 560, 300); g.fillText('the first liquid-fuel rocket', 570, 330);
  // action and reaction
  g.font = 'italic 24px Georgia, serif';
  g.fillText('A rocket pushes on its own gas, so it works even in empty space.', 40, h - 72);
  g.fillText('1944: the V-2 was the first thing made by people to reach space.', 40, h - 34);
}
