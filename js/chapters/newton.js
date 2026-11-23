// Era 2, Chapter 5 (n 12): Newton's apple and cannon. Woolsthorpe Manor, Lincolnshire, August 1666.
//
// A late-summer evening on the farm where Isaac Newton has come home while the plague keeps the
// university shut: the grey limestone manor with its steep stone-slate roof and lit windows, the barn
// and dovecote, an orchard heavy with apples inside a dry-stone wall, sheep being brought in across
// the pasture by a shepherd and his dog, corn stooks in the stubble, rooks going home, and far off
// across the valley Colsterworth's church tower, its bell tolling now and then. The Sun sets behind
// you, the full Moon rises in front.
//
// The story: young Newton sits reading under an apple tree; an apple falls (in slow motion), and
// glowing arrows ask why it only ever falls down, toward the middle of the Earth. He gets up, holds
// the apple up to the rising Moon: does the same pull reach that far? Then the wow: the farm vanishes
// and you float in space, a giant beside a small Earth with an impossibly tall mountain on top over
// England, a cannon on its peak and a tiny Newton beside it. Fire (Adults: pull the brass lever by
// your hand; Kids: Astra does): slow, it lands near; faster, farther; really fast, the ball falls all
// the way round and comes back past the cannon (tiny Newton ducks): an orbit. Then the Moon swings
// round the Earth doing the same, lines of pull flow toward the Earth's middle, the planets circle a
// distant Sun, and the word GRAVITY glows. Back on the farm at night: the Principia, Kepler's ellipse
// in the sky (Kepler's echo approves: js/wow/ch12.js), and a little new star creeping steadily across
// the sky: a satellite, your own moon, three hundred years later (the next chapters).
// World axes: -Z north, +X east, +Y up. You start at the origin looking east (az 95).
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, walkToward, holdProp, dropProp } from '../people.js';
import { makeHerd, makeFlock, makeSmoke, makeTorch, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { glowPoints, whoosh, awe, shimmer, rumble } from '../wow/fx.js';
import { Space, lonLat } from '../wow/space.js';
import { dirFromAzEl } from '../sky.js';
import { D2R, ease, clamp01, at, sunAt, house, windows, gableRoof, gableWall, glow, label, Journal, INK, guideUpdate } from '../era2/common.js';

const LAT = 52.81, LON = -0.63, YEAR = 1666, SUNLON = 150;   // Woolsthorpe, late August
const FACE = 95;                                              // you look east, toward the rising Moon
const N1 = noise2(121), N2 = noise2(123), N3 = noise2(125);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _w0 = new THREE.Vector3(), _w1 = new THREE.Vector3(), _w2 = new THREE.Vector3(), _dq = new THREE.Quaternion(), _bq = new THREE.Quaternion(), _pq = new THREE.Quaternion();

export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = (N1(x / 140, z / 140) - 0.5) * 14 * clamp((r - 40) / 120, 0, 1);       // rolling fields
  h += (N2(x / 11, z / 11) - 0.5) * 0.25 * clamp((r - 6) / 10, 0, 1);              // little bumps
  h -= 16 * clamp((x - 70) / 220, 0, 1) * clamp((520 - x) / 200, 0, 1);            // the Witham valley to the east
  h += 18 * clamp((x - 450) / 300, 0, 1);                                          // ...and the far side, Colsterworth
  return h;
}

// The places on the farm (bearings and distances from where you start)
const TREE = at(78, 4.7);                          // the apple tree
const TOWARD = _a.copy(TREE).negate().normalize().clone();
const SIT = TREE.clone().addScaledVector(TOWARD, 0.42);                    // Newton's back against the trunk
const SIDE = new THREE.Vector3(-TOWARD.z, 0, TOWARD.x);                    // to his left (our right)
const APPLE0 = TREE.clone().addScaledVector(TOWARD, 1.05).addScaledVector(SIDE, -0.5).setY(1.95);
const HOUSE = at(38, 24), BARN = at(352, 30), CHURCH = at(100, 760);
const BOOKSPOT = at(86, 3.0);                      // where Newton stands with the Principia
export const KEPSPOT = at(104, 3.5);               // ...and where Kepler's echo appears (js/wow/ch12.js)
const ORR = at(100, 10, 9.5);                      // the ellipse over the orchard
const MOON_AZ = (h) => 113 + (h - 19) * 9, MOON_EL = (h) => 7.5 + (h - 19) * 5;

// ---------- Newton's cannon: the numbers ----------
const ER = 3, MT = 1.05, R0 = ER + MT + 0.08;      // the little Earth, the mountain, the cannon's muzzle
const PERIOD = 14;                                  // seconds for one orbit
const VC = 2 * Math.PI * R0 / PERIOD, GM = VC * VC * R0;
const SPEEDS = [0.42, 0.72, 1];
const TILT = -17 * D2R, SCALE = 0.8;                // the orbits' plane leans its top toward you, so you see the mountain's face
const MOON_R = 6.4, MOON_T = 30;

// Ellipse for the Principia moment (Sun at a focus)
const EA = 1.7, EE = 0.45, EB = EA * Math.sqrt(1 - EE * EE), EC = EA * EE;
function ellAt(M, out) { let E = M; for (let i = 0; i < 6; i++) E -= (E - EE * Math.sin(E) - M) / (1 - EE * Math.cos(E)); return out.set(EA * Math.cos(E) - EC, 0, -EB * Math.sin(E)); }

// Turn a bone so it points (toward its child) along a world direction (like people.js does for arms)
function aimBone(bone, child, want, k) {
  bone.updateWorldMatrix(true, false); child.updateWorldMatrix(false, false);
  bone.getWorldPosition(_w0); child.getWorldPosition(_w1);
  _w1.sub(_w0).normalize(); _dq.setFromUnitVectors(_w1, want);
  bone.getWorldQuaternion(_bq); _bq.premultiply(_dq);
  bone.parent.getWorldQuaternion(_pq).invert(); _bq.premultiply(_pq);
  bone.quaternion.slerp(_bq, k);
}
// Sitting on the grass, legs stretched out in front (after animatePerson, which stands them up)
function sitLegs(P, k) {
  const B = P.rig?.bones; if (!B || k < 0.01) return;
  P.inner.updateWorldMatrix(true, false);
  for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
    const up = B[side + 'UpLeg'], low = B[side + 'Leg'], foot = B[side + 'Foot'];
    if (!up || !low || !foot) continue;
    aimBone(up, low, _w2.set(sx * 0.16, -0.08, 1).transformDirection(P.inner.matrixWorld), k);
    aimBone(low, foot, _w2.set(sx * 0.08, -0.16, 1).transformDirection(P.inner.matrixWorld), k);
  }
}

export default class Newton {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.start = { pos: new THREE.Vector3(0, 0, 0), yaw: -FACE * D2R };
    this.s = {
      phase: 'arrive', guide: null,
      hour: 18.8,      // local time (the Sun and stars follow it)
      nw: 'read',      // Newton: read (sitting), look (sitting, at the apple), stand, moon, book
      apple: 0,        // 0 hanging, 1 falling, 2 on the grass, 3 in Newton's hand
      why: 0,          // ch12_03: 1 the wrong ways (up, sideways), 2 the pull down toward the Earth's middle
      moonQ: 0,        // ch12_04: 1 the line to the Moon, 2 the question
      space: 0,        // the cannon on the little Earth
      mtn: 0,          // the mountain grown
      armed: 0, pull: 0, shot: 0,   // the lever: shots ready, lever pulls, shots fired
      tangent: 0,      // ch12_07: the straight line the ball would take without the pull
      orbitLab: 0, moon: 0, lines: 0, planets: 0, gravity: 0,
      book: 0,         // ch12_09: 1 Newton holds the Principia, 2 it glows open
      ell: 0,          // the ellipse
      sat: 0,          // ch12_10: a satellite creeping across the sky
      journal: 0,
    };
    this.t = 0;
    G.world.height = groundHeight;
    G.world.bounds = 7; G.world.blockers = [];
    G.sky.fogFar = 2600; G.sky.mist = 0;
    G.sky.setPlace({ lat: LAT, year: YEAR, sunLon: SUNLON });
    G.audio.amb = 0.45;
    this.life = new Life(this.root);
    this.buildGround();
    this.buildManor();
    this.buildFarm();
    this.buildOrchard();
    this.buildCountry();
    this.buildPeople();
    this.buildLife();
    this.buildApple();
    this.buildSkyBits();
    this.buildCannon();
    this.journal = new Journal(this, drawJournal);
    this.registerInteractables();
    this.bellT = 9; this.birdT = 2; this.owlT = 40; this.cricketT = 1; this.bleatT = 5; this.cowT = 20;
  }

  // ---------- The land ----------
  buildGround() {
    const SIZE = 3200, SEG = 200, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const lush = new THREE.Color(0x4e7030), grass = new THREE.Color(0x5e7e36), dry = new THREE.Color(0x8a8a46), stubble = new THREE.Color(0xb0984e), lane = new THREE.Color(0x6a5a40), dark = new THREE.Color(0x3a5228);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i);
      const r0 = Math.hypot(x, z), k = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.8) * (SIZE / 2) / r0 : 0; x *= k; z *= k;
      p.setXYZ(i, x, groundHeight(x, z), z);
      const r = Math.hypot(x, z);
      c.copy(r < 26 ? lush : grass).lerp(dark, N2(x / 7, z / 7) * 0.35);
      // the fields: a patchwork of pasture, hay and harvested corn
      const f = N3(Math.floor(x / 90) * 0.37 + 0.5, Math.floor(z / 70) * 0.41 + 0.5);
      if (r > 34) c.lerp(f < 0.35 ? stubble : f < 0.55 ? dry : grass, 0.75);
      if (Math.abs(x - 40) < 80 && z > 25 && z < 110 && r > 34) c.copy(stubble).lerp(dry, N2(x / 4, z / 4) * 0.4);   // the harvest field
      const ln = Math.abs(z - 30 - Math.sin(x / 40) * 4);
      if (ln < 2.2 && x > -200 && x < 90) c.lerp(lane, 0.8);                    // the lane past the farm
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    this.root.add(new THREE.Mesh(g, FLAT));
    // a little stream down in the valley, catching the sky
    const st = new THREE.Mesh(new THREE.PlaneGeometry(14, 3000), new THREE.MeshPhongMaterial({ color: 0x1a2a38, specular: 0x9aaacc, shininess: 80 }));
    st.rotation.x = -Math.PI / 2; st.rotation.z = 0.12; st.position.set(235, groundHeight(235, 0) - 0.6, 0); this.root.add(st);
  }

  // Woolsthorpe Manor: a grey limestone farmhouse, two storeys and attics under a steep stone-slate
  // roof, tall chimneys at the gable ends, stone-mullioned windows, a rear wing (the T), a porch.
  buildManor() {
    const k = new Kit(), wins = [], ST = 0xcfc2a0, ST2 = 0xb8aa88, ROOF = 0x6a645a;
    const { x, z } = HOUSE, y = groundHeight(x, z) - 0.2, yaw = Math.atan2(-x, -z);   // its front looks at the orchard
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const W = 14, D = 6.4, H = 6.2, RH = 4.6;
    k.box(W, H, D, ST, P(0, H / 2, 0), [0, yaw, 0]);
    k.box(W + 0.2, 0.5, D + 0.2, ST2, P(0, 0.25, 0), [0, yaw, 0]);
    k.box(W + 0.1, 0.22, D + 0.1, ST2, P(0, 3.1, 0), [0, yaw, 0]);                 // the string course between the floors
    k.add(gableRoof(W, D, RH, 0.3), ROOF, P(0, H, 0), [0, yaw, 0]);
    for (const sx of [-1, 1]) {
      k.add(gableWall(D, RH, 0.3), ST, P(sx * (W / 2 - 0.15), H, 0), [0, yaw + Math.PI / 2, 0]);
      k.box(1.2, RH + 2.6, 0.9, ST2, P(sx * (W / 2 - 0.5), H + (RH + 2.6) / 2, 0), [0, yaw, 0]);   // gable chimney stacks
      k.box(1.35, 0.25, 1.05, 0x9a8e74, P(sx * (W / 2 - 0.5), H + RH + 2.7, 0), [0, yaw, 0]);
      this.chimneys = (this.chimneys || []).concat([new THREE.Vector3(...P(sx * (W / 2 - 0.5), H + RH + 3, 0))]);
    }
    // the rear wing (the T) and its own roof
    k.box(6, H - 0.4, 7, ST, P(1.5, (H - 0.4) / 2, -D / 2 - 3.4), [0, yaw, 0]);
    k.add(gableRoof(7, 6, 4, 0.3).rotateY(Math.PI / 2), ROOF, P(1.5, H - 0.4, -D / 2 - 3.4), [0, yaw, 0]);
    // the porch with its little gable, the door, a stone step
    k.box(2.6, 3.2, 1.8, ST, P(-0.8, 1.6, D / 2 + 0.9), [0, yaw, 0]);
    k.add(gableRoof(1.8, 2.6, 1.3, 0.15).rotateY(Math.PI / 2), ROOF, P(-0.8, 3.2, D / 2 + 0.9), [0, yaw, 0]);
    k.add(gableWall(2.6, 1.3, 0.2), ST, P(-0.8, 3.2, D / 2 + 1.75), [0, yaw, 0]);
    k.box(1.1, 2.1, 0.1, 0x3a2416, P(-0.8, 1.05, D / 2 + 1.82), [0, yaw, 0]);
    k.box(1.6, 0.18, 0.6, ST2, P(-0.8, 0.09, D / 2 + 2.1), [0, yaw, 0]);
    // stone-mullioned windows: a surround, the mullions, the panes (some glowing)
    const win = (lx, ly, lz, n, face = 0) => {
      const w = n * 0.55, fz = lz + 0.04;
      const fy = yaw + face;
      const Q = (ax, ay, az) => { const cc = Math.cos(face), ss = Math.sin(face); return P(ax * cc + az * ss, ay, -ax * ss + az * cc); };
      k.box(w + 0.3, 1.35, 0.12, ST2, Q(lx, ly, fz), [0, fy, 0]);
      for (let i = 0; i < n; i++) wins.push({ p: new THREE.Vector3(...Q(lx - w / 2 + 0.275 + i * 0.55, ly, fz + 0.07)), yaw: fy });
      for (let i = 1; i < n; i++) k.box(0.08, 1.15, 0.16, ST2, Q(lx - w / 2 + i * 0.55, ly, fz + 0.06), [0, fy, 0]);
      k.box(w + 0.45, 0.14, 0.24, ST2, Q(lx, ly + 0.72, fz + 0.06), [0, fy, 0]);   // the drip mould
    };
    for (const [lx, n] of [[-5, 3], [2.3, 3], [5.2, 2]]) win(lx, 1.6, D / 2, n);
    for (const [lx, n] of [[-5, 3], [-0.8, 2], [2.3, 3], [5.2, 2]]) win(lx, 4.6, D / 2, n);
    for (const sx of [-1, 1]) win(0, 4.6, W / 2, 2, sx * Math.PI / 2);   // the gable ends
    win(0, H + 1.4, W / 2, 1, Math.PI / 2);
    this.root.add(k.mesh());
    this.manorWins = windows(wins, { lit: 0.55, w: 0.42, h: 1.0, seed: 6 }); this.root.add(this.manorWins);
    // the lantern by the door
    this.doorPos = new THREE.Vector3(...P(-0.8, 0, D / 2 + 2.6));
    this.lantern = new THREE.PointLight(0xffa860, 0, 14, 1.6); this.lantern.position.set(...P(0.6, 2.5, D / 2 + 1.95)); this.root.add(this.lantern);
    this.lanternGlow = glow(0xffb060, 0.5, 0); this.lanternGlow.position.copy(this.lantern.position); this.root.add(this.lanternGlow);
    const lk = new Kit(); lk.box(0.2, 0.3, 0.2, 0x2a2018, [0, 0, 0]); const lm = lk.mesh(); lm.position.copy(this.lantern.position); this.root.add(lm);
    this.houseYaw = yaw;
  }

  // The farmyard: a stone barn, a round dovecote, the cart and the haystacks, beehives (straw skeps),
  // the dry-stone walls round the orchard, a field gate, the corn stooks in the harvest field.
  buildFarm() {
    const k = new Kit(), r = rng(17), wins = [];
    const by = groundHeight(BARN.x, BARN.z);
    house(k, { x: BARN.x, y: by - 0.2, z: BARN.z, w: 16, d: 7, h: 5, roof: 5, yaw: Math.atan2(-BARN.x, -BARN.z), wall: 0xc4b694, roofCol: 0x7a6a50 }, wins);
    const out = at(15, 34); house(k, { x: out.x, y: groundHeight(out.x, out.z) - 0.2, z: out.z, w: 7, d: 5, h: 3, roof: 3, yaw: Math.atan2(-out.x, -out.z) + 0.3, wall: 0xc8b898, roofCol: 0x8a5a3a }, wins);
    // the dovecote
    const dv = at(62, 36), dy = groundHeight(dv.x, dv.z);
    k.cyl(2.2, 2.4, 5, 14, 0xcfc2a0, [dv.x, dy + 2.5, dv.z]); k.cyl(0.001, 2.8, 2.6, 14, 0x6a645a, [dv.x, dy + 6.3, dv.z]); k.cyl(0.4, 0.4, 0.8, 8, 0x8a7a60, [dv.x, dy + 7.8, dv.z]);
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; k.box(0.25, 0.25, 0.1, 0x1a1410, [dv.x + Math.sin(a) * 2.32, dy + 4 + (i % 2) * 0.5, dv.z + Math.cos(a) * 2.32], [0, a, 0]); }
    // haystacks and a cart in the yard
    for (const [az, d] of [[5, 22], [358, 21], [12, 20]]) { const p = at(az, d), y = groundHeight(p.x, p.z); k.cyl(1.6, 2.1, 3, 10, 0xb89a56, [p.x, y + 1.5, p.z]); k.cyl(0.001, 1.8, 1.8, 10, 0xa88a4a, [p.x, y + 3.9, p.z]); }
    const ca = at(25, 18), cy = groundHeight(ca.x, ca.z), cyaw = 0.6;
    k.box(1.4, 0.15, 2.6, 0x6a4a2e, [ca.x, cy + 0.85, ca.z], [0, cyaw, 0]);
    for (const sx of [-1, 1]) { k.box(0.06, 0.5, 2.6, 0x5a3e26, [ca.x + Math.cos(cyaw) * sx * 0.68, cy + 1.1, ca.z - Math.sin(cyaw) * sx * 0.68], [0, cyaw, 0]); k.cyl(0.55, 0.55, 0.08, 12, 0x4a3420, [ca.x + Math.cos(cyaw) * sx * 0.8, cy + 0.55, ca.z - Math.sin(cyaw) * sx * 0.8], [0, cyaw, Math.PI / 2]); }
    k.box(1.2, 0.5, 2.2, 0xb89a56, [ca.x, cy + 1.2, ca.z], [0, cyaw, 0]);
    k.box(0.08, 0.08, 2.4, 0x5a3e26, [ca.x + Math.sin(cyaw) * 2.4, cy + 0.6, ca.z + Math.cos(cyaw) * 2.4], [0.25, cyaw, 0]);
    // beehives: straw skeps on a bench by the orchard wall
    const bh = at(150, 11), bhy = groundHeight(bh.x, bh.z);
    k.box(2.2, 0.08, 0.5, 0x6a4a2e, [bh.x, bhy + 0.5, bh.z], [0, 0.4, 0]); for (const ox of [-0.8, 0, 0.8]) k.box(0.08, 0.5, 0.4, 0x5a3e26, [bh.x + ox * Math.cos(0.4), bhy + 0.25, bh.z - ox * Math.sin(0.4)], [0, 0.4, 0]);
    for (const ox of [-0.7, 0, 0.7]) { k.ball(0.32, 1, 0xc8a050, [bh.x + ox * Math.cos(0.4), bhy + 0.75, bh.z - ox * Math.sin(0.4)], 0, [1, 1.15, 1]); for (let j = 0; j < 4; j++) k.cyl(0.33 - j * 0.06, 0.34 - j * 0.06, 0.03, 10, 0xa88038, [bh.x + ox * Math.cos(0.4), bhy + 0.58 + j * 0.12, bh.z - ox * Math.sin(0.4)]); }
    this.hives = new THREE.Vector3(bh.x, bhy + 0.8, bh.z);
    // the dry-stone wall round the orchard (a rough square), with a gap and a wooden gate to the south
    const wall = (ax, az, bx, bz, gap = null) => {
      const len = Math.hypot(bx - ax, bz - az), yw = Math.atan2(-(bz - az), bx - ax);
      for (let d = 0; d < len; d += 0.9) {
        const f = (d + 0.45) / len, wx = ax + (bx - ax) * f, wz = az + (bz - az) * f;
        if (gap && Math.hypot(wx - gap[0], wz - gap[1]) < 1.8) continue;
        const wy = groundHeight(wx, wz), h = 1.05 + r() * 0.15;
        k.box(0.95, h, 0.55, [0x9a9080, 0x8a8272, 0xa8a090][Math.floor(r() * 3)], [wx, wy + h / 2, wz], [0, yw + (r() - 0.5) * 0.06, 0]);
        k.box(0.95, 0.18, 0.35, 0x7a7466, [wx, wy + h + 0.09, wz], [0, yw, 0.1 * (r() - 0.5)]);   // the coping stones
      }
    };
    const WX = 30, WZ0 = -18, WZ1 = 24;
    wall(-26, WZ0, 6, WZ0); wall(WX, WZ1, -26, WZ1, [8, WZ1]); wall(-26, WZ1, -26, WZ0); wall(WX, -6, WX, WZ1, [WX, 12]);
    for (let i = 0; i < 5; i++) k.box(0.06, 0.08, 3.2, 0x6a5038, [WX, groundHeight(WX, 12) + 0.25 + i * 0.22, 12]);
    // the harvest field: rows of corn stooks
    for (let i = 0; i < 90; i++) {
      const x = -10 + (i % 15) * 7 + r() * 1.5, z = 38 + Math.floor(i / 15) * 9 + r() * 1.5, y = groundHeight(x, z);
      k.cyl(0.001, 0.45, 1.1, 6, 0xc8a85a, [x, y + 0.5, z], [0, r(), (r() - 0.5) * 0.2]); k.cyl(0.25, 0.35, 0.3, 6, 0xb89850, [x, y + 0.15, z]);
    }
    this.root.add(k.mesh());
    this.root.add(windows(wins, { lit: 0.2, seed: 11 }));
  }

  // The orchard: rows of old apple trees heavy with red apples, some fallen on the grass.
  buildOrchard() {
    const k = new Kit(), ak = new Kit(), r = rng(29);
    this.trees = [];
    const tree = (x, z, s, hero = false) => {
      const y = groundHeight(x, z), lean = [(r() - 0.5) * 0.16, 0, (r() - 0.5) * 0.16];
      k.cyl(0.1 * s, 0.16 * s, 1.5 * s, 7, 0x4a3a2a, [x, y + 0.75 * s, z], lean);
      for (let b = 0; b < 4; b++) { const a = b / 4 * 6.28 + r(); k.cyl(0.04 * s, 0.07 * s, 1.2 * s, 5, 0x4a3a2a, [x + Math.cos(a) * 0.35 * s, y + 1.8 * s, z + Math.sin(a) * 0.35 * s], [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7]); }
      const greens = [0x46642a, 0x547430, 0x3c5a24, 0x5a7a34];
      const blobs = [[0, 2.65, 0, 1.15]];
      for (let b = 0; b < 5; b++) { const a = b / 5 * 6.28 + r(); blobs.push([Math.cos(a) * 0.85, 2.3 + r() * 0.6, Math.sin(a) * 0.85, 0.75 + r() * 0.3]); }
      for (const [bx, by, bz, br] of blobs) k.ball(br * s, 1, greens[Math.floor(r() * greens.length)], [x + bx * s, y + by * s, z + bz * s], [r(), r(), r()], [1, 0.8, 1]);
      // apples on the outside of the crown, and a few windfalls in the grass
      const n = hero ? 34 : 18;
      for (let i = 0; i < n; i++) {
        const [bx, by, bz, br] = blobs[1 + Math.floor(r() * 5)], a = r() * 6.28, e = (r() - 0.6) * 1.6;
        ak.ball(0.045 * (hero ? 1.1 : 1), 0, r() < 0.8 ? 0xc0281c : 0x9aa030, [x + (bx + Math.cos(a) * Math.cos(e) * br * 0.95) * s, y + (by + Math.sin(e) * br * 0.75) * s, z + (bz + Math.sin(a) * Math.cos(e) * br * 0.95) * s]);
      }
      for (let i = 0; i < 4; i++) { const a = r() * 6.28, d = 0.5 + r() * 1.6; ak.ball(0.042, 0, 0xa02818, [x + Math.cos(a) * d, groundHeight(x + Math.cos(a) * d, z + Math.sin(a) * d) + 0.035, z + Math.sin(a) * d]); }
      this.trees.push(new THREE.Vector3(x, y, z));
      this.G.world.blockers.push({ x, z, r: 0.3 * s });
    };
    tree(TREE.x, TREE.z, 1.2, true);
    for (let gx = -24; gx <= 28; gx += 6.5) for (let gz = -16; gz <= 22; gz += 6.5) {
      const x = gx + (r() - 0.5) * 1.6, z = gz + (r() - 0.5) * 1.6, d = Math.hypot(x, z), az = (Math.atan2(x, -z) / D2R + 360) % 360;
      if (d < 3.2 || (d < 7 && az > 30 && az < 175) || Math.hypot(x - TREE.x, z - TREE.z) < 4.5) continue;
      if (az > 92 && az < 145) continue;                     // keep the view to the rising Moon open
      if (Math.hypot(x - HOUSE.x, z - HOUSE.z) < 11) continue;
      if (Math.hypot(x - KEPSPOT.x, z - KEPSPOT.z) < 2.5 || Math.hypot(x - BOOKSPOT.x, z - BOOKSPOT.z) < 2.5) continue;
      tree(x, z, 0.8 + r() * 0.35);
    }
    // a wooden ladder against one tree and a basket of picked apples beside it
    const lt = this.trees[3] || TREE;
    k.box(0.06, 3.2, 0.06, 0x7a5a3a, [lt.x + 0.9, lt.y + 1.5, lt.z - 0.25], [0, 0, 0.3]); k.box(0.06, 3.2, 0.06, 0x7a5a3a, [lt.x + 0.9, lt.y + 1.5, lt.z + 0.25], [0, 0, 0.3]);
    for (let i = 0; i < 8; i++) k.box(0.05, 0.05, 0.5, 0x7a5a3a, [lt.x + 1.32 - i * 0.12, lt.y + 0.2 + i * 0.38, lt.z]);
    k.cyl(0.3, 0.22, 0.32, 10, 0x9a7440, [lt.x + 1.8, lt.y + 0.16, lt.z + 0.5]);
    for (let i = 0; i < 9; i++) ak.ball(0.05, 0, 0xc0281c, [lt.x + 1.8 + (r() - 0.5) * 0.35, lt.y + 0.33 + r() * 0.06, lt.z + 0.5 + (r() - 0.5) * 0.35]);
    // Newton's little pile of books on the grass beside him, and an open notebook
    k.box(0.22, 0.05, 0.3, 0x5a2a1a, [SIT.x + SIDE.x * 0.55, groundHeight(SIT.x, SIT.z) + 0.025, SIT.z + SIDE.z * 0.55], [0, 0.4, 0]);
    k.box(0.2, 0.05, 0.28, 0x2a3a2a, [SIT.x + SIDE.x * 0.55, groundHeight(SIT.x, SIT.z) + 0.075, SIT.z + SIDE.z * 0.55], [0, 0.7, 0]);
    k.box(0.36, 0.01, 0.26, 0xece0c0, [SIT.x - SIDE.x * 0.6 + TOWARD.x * 0.3, groundHeight(SIT.x, SIT.z) + 0.01, SIT.z - SIDE.z * 0.6 + TOWARD.z * 0.3], [0, 0.9, 0]);
    this.root.add(k.mesh());
    this.applesMesh = ak.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); this.root.add(this.applesMesh);
  }

  // Beyond the walls: hedgerows and oaks along the fields, woods on the far hills, and across the
  // valley Colsterworth: its church tower with pinnacles, cottages with lit windows.
  buildCountry() {
    const k = new Kit(), r = rng(37), wins = [];
    const hedge = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < len; d += 3.2) {
        const f = d / len, x = ax + (bx - ax) * f + (r() - 0.5), z = az + (bz - az) * f + (r() - 0.5), y = groundHeight(x, z);
        k.ball(1.6 + r() * 0.6, 0, [0x2e4422, 0x36502a, 0x283c1e][Math.floor(r() * 3)], [x, y + 1.2, z], [r(), r(), 0], [1, 0.85, 1]);
        if (r() < 0.07 && !(Math.abs((Math.atan2(x, -z) / D2R + 360) % 360 - 117) < 22)) { const h = 7 + r() * 5; k.cyl(0.3, 0.45, h * 0.5, 6, 0x3a2e22, [x, y + h * 0.25, z]); k.ball(h * 0.42, 1, 0x2a401e, [x, y + h * 0.75, z], [r(), r(), 0], [1, 0.8, 1]); }
      }
    };
    for (const [ax, az, bx, bz] of [[-260, 32, 120, 32], [120, -200, 120, 260], [-60, 120, 300, 120], [-260, -60, -40, -60], [-40, -260, -40, -40], [40, -120, 300, -120], [-200, 200, 120, 200], [200, -300, 200, 300], [-160, -260, -160, 120]]) hedge(ax, az, bx, bz);
    // woods on the hills all round
    for (let i = 0; i < 260; i++) {
      const a = r() * 360, d = 380 + r() * 700, p = at(a, d), y = groundHeight(p.x, p.z), h = 10 + r() * 8;
      if (a > 92 && a < 140 && d < 800) continue;
      k.ball(h * 0.55, 0, [0x24361c, 0x2a3e20, 0x30462a][Math.floor(r() * 3)], [p.x, y + h * 0.6, p.z], [r(), r(), 0], [1, 0.8, 1]);
    }
    // Colsterworth across the valley
    const cy = groundHeight(CHURCH.x, CHURCH.z);
    k.box(30, 12, 12, 0xb8ab8a, [CHURCH.x + 18, cy + 6, CHURCH.z]); k.add(gableRoof(30, 12, 6, 0.3), 0x5a5448, [CHURCH.x + 18, cy + 12, CHURCH.z]);
    k.box(9, 28, 9, 0xb0a282, [CHURCH.x, cy + 14, CHURCH.z]);
    for (const [ox, oz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) k.cyl(0.001, 0.9, 5, 4, 0xa89a7a, [CHURCH.x + ox, cy + 30.5, CHURCH.z + oz]);
    k.box(9.6, 1, 9.6, 0x9a8e70, [CHURCH.x, cy + 28, CHURCH.z]);
    this.churchBell = new THREE.Vector3(CHURCH.x, cy + 22, CHURCH.z);
    for (let i = 0; i < 26; i++) {
      const p = at(85 + r() * 30, 690 + r() * 160), y = groundHeight(p.x, p.z);
      house(k, { x: p.x, y: y - 0.3, z: p.z, w: 7 + r() * 4, d: 6, h: 4 + r() * 2, yaw: Math.atan2(-p.x, -p.z) + (r() - 0.5) * 0.6, wall: [0xc8ba98, 0xb8aa88, 0xd0c4a4][Math.floor(r() * 3)], roofCol: [0x6a645a, 0x8a7a50, 0x7a4a30][Math.floor(r() * 3)] }, wins);
    }
    this.root.add(k.mesh());
    this.root.add(windows(wins, { lit: 0.4, w: 0.9, h: 1.1, seed: 19 }));
  }

  buildPeople() {
    const add = (model, pos, look = {}) => { const P = makePerson({ model, seed: 23 + this.root.children.length * 3, ...look }); P.g.position.copy(pos); this.root.add(P.g); return P; };
    // Isaac Newton, 23, reading under the apple tree with his back to the trunk
    this.nw = add('newton', SIT.clone().setY(groundHeight(SIT.x, SIT.z)), { tunic: 0x3a3a44, hair: 0x6a4a2a, height: 1.72 });
    this.nw.g.rotation.y = Math.atan2(TOWARD.x, TOWARD.z); this.nw.sitK = 1;
    const bk = new Kit(); bk.box(0.16, 0.025, 0.22, 0x5a2a1a, [0, 0, 0]); bk.box(0.15, 0.03, 0.21, 0xece0c0, [0.004, 0, 0]);
    this.smallBook = bk.mesh(); holdProp(this.nw, this.smallBook, 'Right', [0, 0.08, 0.04]);
    this.G.world.blockers.push(this.nwBlk = { x: SIT.x, z: SIT.z, r: 0.4 });
    // his mother, Hannah, at the door with a lantern; later calling him in
    this.hannah = add('villager', this.doorPos.clone().setY(groundHeight(this.doorPos.x, this.doorPos.z)), { tunic: 0x5a4a5a, hair: 0x4a3a2a, height: 1.62 });
    this.hannah.g.rotation.y = this.houseYaw;
    this.hannahLamp = makeTorch({ len: 0.3, color: 0xffc070, size: 0.6 }); holdProp(this.hannah, this.hannahLamp, 'Right', [0, 0.02, 0.02]);
    this.hannah.routine = [{ x: this.doorPos.x, z: this.doorPos.z, pose: 'idle', secs: 14, look: this.nw.g.position.clone().setY(1) }, { x: this.doorPos.x + 3, z: this.doorPos.z + 2, pose: 'work', secs: 8 }, { x: this.doorPos.x - 2, z: this.doorPos.z + 3, pose: 'idle', secs: 6 }];
    // a shepherd bringing the flock in, and a farmhand forking hay onto the cart
    const sp = at(150, 45);
    this.shep = add('townsman', sp.setY(groundHeight(sp.x, sp.z)), { tunic: 0x5a5a3a, hair: 0x4a3a2a, beard: true, height: 1.7 });
    const staff = new Kit(); staff.cyl(0.02, 0.02, 1.6, 5, 0x5a4028, [0, 0.8, 0]); holdProp(this.shep, staff.mesh(), 'Right', [0, 0.05, 0.02]);
    this.shep.routine = [at(140, 40), at(110, 46), at(80, 40), at(60, 52), at(100, 58), at(135, 52)].map((p, i) => ({ x: p.x, z: p.z, pose: i % 3 === 2 ? 'beckon' : 'idle', secs: 4 + (i % 3) * 3, speed: 0.6 }));
    const hp = at(8, 20.5);
    this.hand = add('townsman', hp.setY(groundHeight(hp.x, hp.z)), { tunic: 0x6a5a40, hair: 0x2a1a10, height: 1.74 });
    const fork = new Kit(); fork.cyl(0.018, 0.018, 1.5, 5, 0x6a4a2e, [0, 0.75, 0]); for (const ox of [-0.05, 0, 0.05]) fork.cyl(0.006, 0.006, 0.25, 4, 0x5a5a5a, [ox, 1.6, 0]); holdProp(this.hand, fork.mesh(), 'Right', [0, 0.05, 0.02]);
    this.hand.routine = [{ ...at(10, 20.5), pose: 'work', secs: 12, face: 0.9 }, { ...at(22, 18.2), pose: 'work', secs: 8, face: -1 }, { ...at(14, 22), pose: 'idle', secs: 5 }];
    for (const P of [this.hand]) for (const st of P.routine) { delete st.y; }
    this.people = [this.nw, this.hannah, this.shep, this.hand];
  }

  buildLife() {
    const L = this.life;
    this.sheep = L.add(makeHerd('sheep', { n: 16, area: { x: at(140, 48).x, z: at(140, 48).z, r: 9 }, height: groundHeight, mode: 'follow', seed: 7 }));
    this.sheepDog = L.add(makeHerd('dog', { n: 1, area: { x: 0, z: 40, r: 4 }, height: groundHeight, mode: 'follow', seed: 3, speed: 2.4 }));
    // the farm dog, asleep by Newton (it goes to sniff the apple)
    const dp = SIT.clone().addScaledVector(SIDE, 1.2).addScaledVector(TOWARD, 0.4);
    this.dog = L.add(makeHerd('dog', { n: 1, area: { x: dp.x, z: dp.z, r: 0.25 }, height: groundHeight, mode: 'follow', seed: 9, speed: 1.8, scale: 0.8 }));
    this.dog.lead.copy(dp); this.dogHome = dp.clone();
    this.cows = L.add(makeHerd('cow', { n: 5, area: { x: at(330, 55).x, z: at(330, 55).z, r: 14 }, height: groundHeight, seed: 4 }));
    this.horses = L.add(makeHerd('horse', { n: 2, area: { x: at(290, 40).x, z: at(290, 40).z, r: 10 }, height: groundHeight, seed: 6 }));
    this.rooks = L.add(makeFlock({ n: 16, center: new THREE.Vector3(-60, 45, -140), r: 60, height: 12, color: 0x161414, size: 0.9, seed: 4, speed: 7 }));
    this.bats = L.add(makeFlock({ n: 5, center: new THREE.Vector3(HOUSE.x, 6, HOUSE.z + 6), r: 9, height: 3, color: 0x1a1612, size: 0.35, seed: 8, speed: 9 }));
    this.smokes = (this.chimneys || []).slice(0, 1).map((p) => L.add(makeSmoke(p, { n: 7, rise: 10, size: 1.2, opacity: 0.14, color: 0x9a98a0 })));
  }

  // ---------- The apple and the arrows ----------
  buildApple() {
    const k = new Kit(); k.ball(0.055, 1, 0xc8281a, [0, 0, 0]); k.cyl(0.004, 0.004, 0.04, 4, 0x3a2a1a, [0, 0.06, 0]); k.box(0.04, 0.005, 0.02, 0x4a7a2a, [0.02, 0.07, 0], [0, 0, 0.4]);
    this.apple = k.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 }));
    this.apple.position.copy(APPLE0); this.root.add(this.apple);
    this.appleGlow = glow(0xffd890, 0.45, 0); this.apple.add(this.appleGlow);
    this.appleTrail = glowPoints(40, { sizeScale: 260 }); this.root.add(this.appleTrail); this.trailPts = [];
    // ch12_03: arrows round the apple (up and sideways: the ways it never goes; down: the way it does)
    const arrow = (len, col) => {
      const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 8).translate(0, len / 2, 0), m);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 10).translate(0, len + 0.05, 0), m);
      g.add(shaft, head); g.userData.m = m; this.root.add(g); return g;
    };
    this.arrows = [arrow(0.45, 0xffd890), arrow(0.45, 0xffd890), arrow(0.45, 0xffd890)];   // up, left, right
    this.down = arrow(0.6, 0xffe2a0);
    this.pullDots = glowPoints(90, { sizeScale: 300, depthTest: false }); this.pullDots.visible = false; this.root.add(this.pullDots);
    this.centreLab = label("toward the middle of the Earth", 0.09); this.centreLab.material.opacity = 0; this.centreLab.material.depthTest = false; this.root.add(this.centreLab);
  }

  // The Moon question, the ellipse and the satellite (all on the farm)
  buildSkyBits() {
    this.moonLine = glowPoints(60, { sizeScale: 900 }); this.moonLine.visible = false; this.root.add(this.moonLine);
    this.moonQ = label('?', 34, { glowCol: 'rgba(160,200,255,0.9)' }); this.moonQ.material.opacity = 0; this.root.add(this.moonQ);
    this.moonPull = new THREE.Group(); this.root.add(this.moonPull);
    const pm = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.moonPull.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 9, 8).translate(0, 4.5, 0), pm), new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.5, 12).translate(0, 10.7, 0), pm));
    this.moonPullM = pm;
    this.moonLight = new THREE.DirectionalLight(0xa8b8e8, 0); this.root.add(this.moonLight, this.moonLight.target);
    // ch12_09: the ellipse, the Sun at one focus, a planet swinging round it
    const M = this.ellG = new THREE.Group(); M.position.copy(ORR); M.scale.setScalar(1.7); M.visible = false; this.root.add(M);
    this.ellPts = glowPoints(420, { sizeScale: 900 }); M.add(this.ellPts);
    this.ellSun = glow(0xffc050, 1.2, 0); M.add(this.ellSun);
    this.ellPlanet = new THREE.Group(); this.ellPlanet.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshBasicMaterial({ color: 0x9ac8ff, fog: false })), glow(0x9ac8ff, 0.5, 0.9)); M.add(this.ellPlanet);
    this.ellLab = label("Kepler's ellipse, explained", 0.2); this.ellLab.position.set(-EC, 0.55, EB + 0.25); this.ellLab.material.opacity = 0; M.add(this.ellLab);
    // the Principia in Newton's hands
    const bk = new Kit(); bk.box(0.26, 0.06, 0.34, 0x4a2a16, [0, 0, 0]); bk.box(0.24, 0.055, 0.33, 0xece0c0, [0.008, 0, 0]);
    this.principia = bk.mesh(); this.principia.visible = false;
    // ...lying open on a little garden table, by a candle lantern
    const tk = new Kit(), tdir = BOOKSPOT.clone().negate().normalize(), tp = BOOKSPOT.clone().addScaledVector(tdir, 0.62);
    tk.box(0.8, 0.05, 0.55, 0x6a4a2e, [0, 0.78, 0]); for (const [ox, oz] of [[-0.34, -0.22], [0.34, -0.22], [-0.34, 0.22], [0.34, 0.22]]) tk.box(0.05, 0.78, 0.05, 0x4a3420, [ox, 0.39, oz]);
    tk.box(0.12, 0.2, 0.12, 0x2a2018, [0.28, 0.9, -0.12]);
    this.table = tk.mesh(); this.table.position.set(tp.x, groundHeight(tp.x, tp.z), tp.z); this.table.rotation.y = Math.atan2(tdir.x, tdir.z); this.root.add(this.table);
    this.table.add(this.principia); this.principia.position.set(-0.05, 0.835, 0.02); this.principia.rotation.y = 0.15;
    this.tableLamp = glow(0xffb050, 0.35, 0.9); this.tableLamp.position.set(0.28, 0.92, -0.12); this.table.add(this.tableLamp);
    this.table.visible = false;
    this.bookGlow = glow(0xffd890, 0.8, 0); this.principia.add(this.bookGlow);
    this.bookLab = label('Principia, 1687', 0.16); this.bookLab.material.opacity = 0; this.root.add(this.bookLab);
    this.bookSparks = glowPoints(70, { sizeScale: 260 }); this.bookSparks.visible = false; this.root.add(this.bookSparks);
    this.bs = Array.from({ length: 70 }, () => ({ a: Math.random() * 6.28, y: Math.random() * 3, r: 0.1 + Math.random() * 0.3, v: 0.4 + Math.random() * 0.8 }));
    // ch12_10: a satellite: a steady little star creeping across the sky (and its speed)
    this.sat = glow(0xf4f8ff, 4, 0); this.root.add(this.sat);
    this.satTrail = glowPoints(50, { sizeScale: 1800 }); this.satTrail.visible = false; this.root.add(this.satTrail);
    this.satLab = label('8 kilometres every second', 0.32); this.satLab.material.opacity = 0; this.root.add(this.satLab);
  }

  // ---------- The cannon on the little Earth (shown in space) ----------
  buildCannon() {
    const G = this.G, sp = this.space = new Space(G, { earthR: ER });
    // everything in the plane of the orbits: x along the cannon's aim, y up through the mountain
    const C = this.cg = new THREE.Group(); sp.group.add(C);
    // the impossibly tall mountain (over England), craggy, with snow on its peak
    const mg = new THREE.CylinderGeometry(0.07, 0.8, 1.45, 28, 8).toNonIndexed(), mp = mg.attributes.position, mc = new Float32Array(mp.count * 3), col = new THREE.Color();
    for (let i = 0; i < mp.count; i++) {
      const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i), f = (y + 0.725) / 1.45, a = Math.atan2(z, x);
      const n = (N2(a * 2.2, f * 4) - 0.5) * 0.22 * (1 - f * 0.7) * (f > 0.98 ? 0 : 1);
      const rr = Math.hypot(x, z); if (rr > 0.01) { mp.setX(i, x * (1 + n / Math.max(0.1, rr))); mp.setZ(i, z * (1 + n / Math.max(0.1, rr))); }
      col.setHex(f < 0.25 ? 0x4a6a32 : f < 0.72 ? 0x7a7060 : 0xeef2f6).lerp(new THREE.Color(0x5a5248), (N1(a * 3, f * 6) - 0.4) * 0.5);
      mc.set([col.r, col.g, col.b], i * 3);
    }
    mg.setAttribute('color', new THREE.BufferAttribute(mc, 3)); mg.computeVertexNormals();
    this.mountain = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, fog: false }));
    this.mountain.position.y = ER - 0.4 + 0.725; C.add(this.mountain);
    // the cannon: a long iron barrel on a wooden carriage, aimed level along +x
    const ck = new Kit(), top = ER + MT;
    ck.cyl(0.022, 0.03, 0.26, 12, 0x2a2a2e, [0.06, 0.06, 0], [0, 0, -Math.PI / 2]);
    ck.ball(0.03, 1, 0x2a2a2e, [-0.07, 0.06, 0]);
    ck.box(0.2, 0.04, 0.08, 0x6a4a2e, [0.0, 0.025, 0]);
    for (const sz of [-1, 1]) ck.cyl(0.035, 0.035, 0.015, 12, 0x4a3420, [0.02, 0.03, sz * 0.05], [Math.PI / 2, 0, 0]);
    this.cannon = ck.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.3, fog: false }));
    this.cannon.position.set(0, top, 0); C.add(this.cannon);
    this.muzzle = new THREE.Vector3(0.2, top + 0.06, 0);
    this.flash = glow(0xffc070, 0.6, 0); this.flash.position.copy(this.muzzle); C.add(this.flash);
    // a tiny Newton beside it (the same model, very small)
    this.tiny = makePerson({ model: 'newton', seed: 4, tunic: 0x3a3a44, hair: 0x6a4a2a, height: 1.72 });
    this.tiny.g.scale.setScalar(0.13); this.tiny.g.position.set(-0.12, top - 0.005, 0.07); this.tiny.g.rotation.y = Math.PI / 2; C.add(this.tiny.g);
    // the cannonballs, their glowing trails, the dust where they land, the lines of pull
    this.balls = SPEEDS.map(() => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false })), glow(0xffd890, 0.6, 1)); g.visible = false; C.add(g); return g; });
    this.trails = glowPoints(2600, { sizeScale: 1000 }); C.add(this.trails);
    this.puffs = glowPoints(160, { sizeScale: 900 }); C.add(this.puffs); this.pf = [];
    this.paths = SPEEDS.map((k) => simulate(k * VC));
    this.shotLabs = ['slow', 'faster', 'really fast'].map((t) => { const l = label(t, 0.42); l.material.opacity = 0; C.add(l); return l; });
    this.orbitLab = label('An orbit!', 0.4); this.orbitLab.material.opacity = 0; C.add(this.orbitLab);
    this.gravLab = label('GRAVITY', 0.7, { bold: true, color: '#ffe8b0' }); this.gravLab.material.opacity = 0; C.add(this.gravLab);
    this.moonLab = label('the Moon, falling too', 0.3); this.moonLab.material.opacity = 0; C.add(this.moonLab);
    // far off: a little Sun with planets going round it
    this.mini = new THREE.Group(); sp.group.add(this.mini);
    this.miniSun = glow(0xffc050, 2.2, 0); this.mini.add(this.miniSun);
    this.miniPts = glowPoints(420, { sizeScale: 300 }); this.mini.add(this.miniPts);
    this.miniLab = label('...and the planets round the Sun', 0.32); this.miniLab.position.y = 2.2; this.miniLab.material.opacity = 0; this.mini.add(this.miniLab);
    // the brass lever by your hand (Adults pull it; in Kids mode Astra does)
    const lv = this.lever = new THREE.Group(); sp.group.add(lv);
    const lk = new Kit(); lk.box(0.24, 0.06, 0.16, 0x4a3420, [0, 0, 0]); lk.cyl(0.03, 0.03, 0.2, 10, 0xb08a42, [0, 0.03, 0], [0, 0, Math.PI / 2]);
    lv.add(lk.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5, fog: false })));
    this.arm = new THREE.Group(); this.arm.position.y = 0.03; lv.add(this.arm);
    const ak = new Kit(); ak.cyl(0.012, 0.014, 0.32, 8, 0xc8a050, [0, 0.16, 0]); ak.ball(0.04, 1, 0x8a2a1a, [0, 0.34, 0]);
    this.arm.add(ak.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.6, fog: false })));
    this.knobGlow = glow(0xffd890, 0.25, 0); this.knobGlow.position.y = 0.34; this.arm.add(this.knobGlow);
    this.thread = glowPoints(60, { sizeScale: 200 }); sp.group.add(this.thread);
    this.shotN = 0; this.shotT = 0; this.orbA = 0; this.loops = 0; this.moonA = 2.3;
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.leverIt = {
      hint: 'Pull the brass lever by your hand (GRIP) to fire the cannon', deskHint: 'Click the brass lever to fire the cannon',
      get disabled() { return !self.spaceOn || self.s.armed <= self.s.pull; },
      reach(pos) { self.knobGlow.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.12); },
      aim(o, d) { self.knobGlow.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.15 ? t : Infinity; },
      onGrab() { G.act({ type: 'fire' }); }, onTouch() { G.act({ type: 'fire' }); },
    };
    G.interactables.push(this.leverIt);
  }
  act(a) {
    if (a.type === 'fire' && this.s.armed > this.s.pull) { this.s.pull = this.s.armed; return true; }
    return this.journal.act(a);
  }
  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    G.events.emit('placePlayers', { x: this.start.pos.x, z: this.start.pos.z, yaw: this.start.yaw });
    await G.ui.fadeIn(3);
    // England, 1666: the plague; home on the farm
    s.phase = 'farm';
    const l1 = D.sayAsync('ch12_01');
    await D.cue('family'); s.guide = at(40, 10, 5).toArray();
    await D.cue('Isaac Newton'); s.guide = SIT.clone().addScaledVector(SIDE, -0.9).setY(1.7).toArray();
    await l1;
    // the apple falls
    s.phase = 'apple';
    const l2 = D.sayAsync('ch12_02');
    await D.cue('saw an apple'); s.apple = 1; s.nw = 'look';
    await l2;
    await D.until(() => s.apple >= 2, fast ? 2 : 8);
    s.apple = Math.max(2, s.apple);
    // why always down?
    s.phase = 'why'; s.guide = APPLE0.clone().addScaledVector(SIDE, -0.6).setY(1.1).toArray();
    const l3 = D.sayAsync('ch12_03');
    await D.cue('Never sideways'); s.why = 1;
    await D.cue('Something must'); s.why = 2;
    await l3;
    await D.wait(fast ? 0.2 : 1.5);
    // the Moon
    s.phase = 'moon'; s.why = 3; s.nw = 'stand'; s.guide = null;
    const l4 = D.sayAsync('ch12_04');
    await D.cue('looked up'); s.nw = 'moon'; s.guide = at(MOON_AZ(19.4) - 6, 6, 3.4).toArray();
    await D.cue('does it pull'); s.moonQ = 1;
    await D.cue("why doesn't"); s.moonQ = 2;
    await l4;
    await D.wait(fast ? 0.2 : 1.2);
    // Newton's cannon
    s.phase = 'cannon'; s.moonQ = 0; s.guide = null;
    const l5 = D.sayAsync('ch12_05');
    await D.cue('Imagine'); s.space = 1;
    await D.until(() => this.spaceOn === 1 && !this.spaceBusy, fast ? 3 : 6);
    await D.cue('tall mountain'); s.mtn = 1;
    await D.cue('Fire it'); s.armed = 1; s.pull = 1; s.shot = 1;
    await l5;
    await D.until(() => this.shotDone(0), fast ? 2 : 8);
    for (const n of [2, 3]) {
      s.armed = n;
      D.hint(G.mode === 'desktop' ? this.leverIt.deskHint : this.leverIt.hint, 10);
      await D.auto(() => s.pull >= n, () => { s.pull = n; }, { after: fast ? 0.3 : 2.2, timeout: fast ? 2 : 25 });
      s.pull = Math.max(s.pull, n); G.ui.showHint('');
      if (n === 2) {
        const l6 = D.sayAsync('ch12_06');
        await D.cue('faster'); s.shot = 2;
        await l6;
        await D.until(() => this.shotDone(1), fast ? 2 : 10);
      } else {
        const l7 = D.sayAsync('ch12_07');
        await D.cue('really fast'); s.shot = 3;
        await D.cue('curves away'); s.tangent = 1;
        await D.cue('keeps missing'); s.tangent = 0;
        await l7;
        await D.until(() => this.loops >= 1, fast ? 3 : 16);
      }
    }
    // an orbit; the Moon falls too; gravity
    s.phase = 'gravity';
    const l8 = D.sayAsync('ch12_08');
    await D.cue('an orbit'); s.orbitLab = 1;
    await D.cue('The Moon is falling'); s.moon = 1; s.orbitLab = 0;
    await D.cue('The same pull'); s.lines = 1;
    await D.cue('planets around'); s.planets = 1;
    await D.cue('Newton called it'); s.gravity = 1;
    await l8;
    await D.wait(fast ? 0.3 : 3);
    // back to the farm, at night: the Principia
    s.space = 0; s.hour = 21.3; s.nw = 'book'; s.apple = 4;
    await D.until(() => this.spaceOn === 0 && !this.spaceBusy, fast ? 3 : 6);
    s.phase = 'principia'; s.book = 1; s.guide = ORR.clone().add(_a.set(0, 0.6, 0)).addScaledVector(SIDE, 0).toArray();
    const l9 = D.sayAsync('ch12_09');
    await D.cue('ellipses'); s.ell = 1;
    await D.cue('1687'); s.book = 2;
    await l9;
    await D.wait(fast ? 0.3 : 2);
    // ...and hidden in it: your own moon
    s.phase = 'satellite'; s.ell = 0; s.guide = null;
    const l10 = D.sayAsync('ch12_10');
    await D.cue('fast enough'); s.sat = 1;
    await D.cue('eight kilometers'); s.sat = 2;
    await D.cue('your own moon'); s.sat = 3;
    await l10;
    await D.wait(fast ? 0.3 : 3);
    s.phase = 'journal';
    await this.journal.present(D);
    s.sat = 0; s.phase = 'done';
  }

  shotDone(i) { return this.shotN > i + 1 || (this.shotN === i + 1 && this.shotT * this.speed() >= this.paths[i].pts.length * this.paths[i].dt + 0.6); }
  speed() { return this.G.params.has('fast') ? 4 : 1; }

  // ---------- Every frame ----------
  update(dt, t) {
    const G = this.G, s = this.s;
    this.t += dt;
    // the evening goes by: sunset, twilight, night (and on to night after the cannon)
    const want = { farm: 18.8, apple: 18.95, why: 19.05, moon: 19.35, cannon: 19.5 }[s.phase] ?? s.hour;
    if (s.phase in { farm: 1, apple: 1, why: 1, moon: 1, cannon: 1 }) s.hour = damp(s.hour, want, 0.25, dt);
    else if (G.isHost !== false && s.hour < 21.9) s.hour += dt / 400;
    const sun = sunAt(LAT, SUNLON, s.hour); G.sky.set(sun.az, sun.el);
    // the full Moon rising in the east-south-east
    const mAz = MOON_AZ(s.hour), mEl = MOON_EL(s.hour);
    G.sky.setMoon(mAz, mEl, 1.7 - clamp01((mEl - 4) / 20) * 0.5, 0.5);
    const night = clamp01((-sun.el - 2) / 10);
    this.moonLight.position.copy(at(mAz, 200, 200 * Math.tan(Math.max(4, mEl) * D2R))); this.moonLight.intensity = 0.5 * night;
    this.lantern.intensity = 2.2 * clamp01((-sun.el + 1) / 6) * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3));
    this.lanternGlow.material.opacity = this.lantern.intensity / 2.2 * 0.8;
    this.manorWins.material.color.setScalar(0.35 + 0.65 * clamp01((-sun.el + 2) / 8));
    this.life.update(dt, t);
    this.bats.group.visible = sun.el < -1;
    this.rooks.group.visible = sun.el > -6;
    this.updatePeople(dt, t, sun);
    this.updateApple(dt, t);
    this.updateMoonQ(dt, t, mAz, mEl);
    this.updatePrincipia(dt, t);
    this.updateSat(dt, t);
    if (s.space !== (this.spaceOn ?? 0) && !this.spaceBusy) this.setSpace(s.space);
    this.updateCannon(dt, t);
    this.space.update(dt);
    this.sounds(dt, sun);
    const busy = this.journal.update();
    if (this.spaceOn && !busy) {
      // in space Astra waits by the lever while a shot is ready
      const ready = s.armed > s.pull;
      if (ready !== this.guideLever) { this.guideLever = ready; if (ready) { this.knobGlow.getWorldPosition(_a); G.guide.flyTo(_a.add(_b.set(0, 0.25, 0)).clone()); G.guide.chime(); } else G.guide.follow(); this.guideAt = null; }
    } else guideUpdate(this, busy);
  }

  updatePeople(dt, t, sun) {
    const s = this.s, N = this.nw;
    // Newton: reading under the tree; looking at the apple; up on his feet, the apple held up to the
    // Moon; at the table with the Principia. Meem's Newton model has no rig yet, so until it does he
    // stands by the trunk and acts with his whole body (turning, leaning in, looking up); with a rig
    // he sits on the grass and uses his hands (the same code, both ways).
    const rigged = !!N.rig, statue = !!N.model && !rigged;
    const sitting = rigged && (s.nw === 'read' || s.nw === 'look');
    N.sitK = damp(N.sitK, sitting ? 1 : 0, 2.2, dt);
    if (rigged && N.hipY == null) { N.rig.bones.Hips?.getWorldPosition(_a); N.hipY = N.rig.bones.Hips ? _a.y - N.g.getWorldPosition(_b).y : 0.9; }
    const turn = (p, k = 1.5) => { let dy = Math.atan2(p.x - N.g.position.x, p.z - N.g.position.z) - N.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); N.g.rotation.y += dy * Math.min(1, dt * k); };
    let lean = 0;
    if (s.nw === 'book' || s.phase === 'principia' || s.phase === 'satellite' || s.phase === 'journal' || s.phase === 'done') {
      if (!this.atBook) { this.atBook = true; N.g.position.set(BOOKSPOT.x, 0, BOOKSPOT.z); N.g.rotation.y = Math.atan2(-BOOKSPOT.x, -BOOKSPOT.z); dropProp(N, 'Right'); this.nwBlk.x = BOOKSPOT.x; this.nwBlk.z = BOOKSPOT.z; this.table.visible = this.principia.visible = true; }
      N.pose = s.sat || s.ell ? 'point' : 'hold';
      const tgt = s.sat ? this.sat.position : s.ell ? ORR : this.table.position;
      N.look = tgt.clone(); N.pointAt.copy(tgt); if (s.sat || s.ell) turn(tgt, 1);
      lean = s.sat || s.ell ? -0.12 : 0.18;
    } else if (s.nw === 'read' || s.nw === 'look') {
      N.pose = 'hold'; N.look = s.nw === 'look' ? this.apple.position.clone() : null;
      if (statue && s.nw === 'look') { turn(this.apple.position, 1.2); lean = 0.2; }
      if (statue && s.nw === 'read') { lean = 0.06 + 0.03 * Math.sin(t * 0.5); if (!this.statueBook) { this.statueBook = true; dropProp(N, 'Right'); } }
    } else {
      // up on his feet: (with hands) pick up the apple, then hold it up toward the Moon
      if (rigged && !this.picked && N.sitK < 0.3) { this.picked = true; this.apple.position.set(0, 0, 0); dropProp(N, 'Right'); holdProp(N, this.apple, 'Right', [0, 0.06, 0.05]); this.applePicked = true; }
      if (s.nw === 'moon') { dirFromAzEl(MOON_AZ(s.hour), MOON_EL(s.hour), _a).multiplyScalar(300).add(N.g.position); N.pose = 'point'; N.pointAt.copy(_a); N.look = _a.clone(); turn(_a); lean = -0.14; }
      else { N.pose = 'hold'; N.look = this.applePicked ? N.g.position.clone().addScaledVector(TOWARD, 0.6).setY(1.2) : this.apple.position.clone(); if (statue) { turn(this.apple.position, 1.2); lean = 0.15; } }
    }
    N.g.position.y = groundHeight(N.g.position.x, N.g.position.z) - Math.max(0, (N.hipY ?? 0.9) - 0.12) * ease(N.sitK);
    animatePerson(N, t, dt); sitLegs(N, ease(N.sitK));
    if (statue) { this.nwLean = damp(this.nwLean || 0, lean, 2, dt); N.inner.rotation.x = this.nwLean; }
    // Hannah at the door; at moonrise she calls him in (he doesn't come)
    const H = this.hannah;
    if (s.phase === 'moon') { walkToward(H, this.doorPos.x, this.doorPos.z, dt, { height: groundHeight }); H.pose = 'beckon'; H.look = N.g.position.clone().setY(1.4); }
    else runRoutine(H, dt, { height: groundHeight });
    animatePerson(H, t, dt); this.hannahLamp.userData.flicker(t);
    runRoutine(this.shep, dt, { height: groundHeight }); animatePerson(this.shep, t, dt);
    this.sheep.lead.copy(this.shep.g.position).addScaledVector(_a.set(Math.sin(this.shep.g.rotation.y), 0, Math.cos(this.shep.g.rotation.y)), -4);
    this.sheepDog.lead.copy(this.shep.g.position).add(_a.set(Math.sin(t * 0.3) * 6, 0, Math.cos(t * 0.23) * 5));
    runRoutine(this.hand, dt, { height: groundHeight }); animatePerson(this.hand, t, dt);
  }

  updateApple(dt, t) {
    const G = this.G, s = this.s, A = this.apple, fast = this.speed();
    if (s.apple === 1 && !this.falling) { this.falling = true; this.fallT = 0; whoosh(G, 2.5, 0.12, A.position); G.audio.ctx && G.audio.noise(G.audio.out(A.position, 0.3, 3), { type: 'highpass', f: 2500, peak: 0.3, a: 0.02, d: 0.4 }); }
    // the fall, in slow motion
    const gy = groundHeight(APPLE0.x, APPLE0.z) + 0.05;
    if (this.falling && !this.landed) {
      this.fallT += dt * fast;
      const k = 0.42, y = APPLE0.y - 0.5 * 9.8 * (this.fallT * k) ** 2;
      A.position.set(APPLE0.x, Math.max(gy, y), APPLE0.z); A.rotation.x = this.fallT * 1.2;
      this.trailPts.unshift(A.position.clone()); this.trailPts.length = Math.min(this.trailPts.length, 40);
      if (y <= gy) {
        this.landed = true; this.landT = 0; if (G.isHost !== false && s.apple === 1) s.apple = 2;
        if (G.audio.ctx) { const o = G.audio.out(A.position, 0.7, 3); G.audio.tone(o, { f: 140, f2: 70, peak: 0.6, a: 0.003, d: 0.25 }); G.audio.noise(o, { f: 700, f2: 200, peak: 0.4, a: 0.003, d: 0.15 }); }
        this.dog.lead.copy(A.position).addScaledVector(TOWARD, 0.45); this.dogBack = 7; this.bark(A.position, 0.6);
      }
    }
    if (this.landed && !this.applePicked) { this.landT += dt; const b = Math.max(0, Math.sin(this.landT * 9)) * 0.06 * Math.exp(-this.landT * 4); A.position.y = gy + b; A.position.addScaledVector(TOWARD, dt * 0.08 * Math.exp(-this.landT * 2)); }
    if (this.dogBack != null && (this.dogBack -= dt) < 0) { this.dogBack = null; this.dog.lead.copy(this.dogHome); }
    if (s.apple === 4 && this.principia.visible) A.visible = false;
    // the trail behind the falling apple
    const T = this.appleTrail.userData; let n = 0;
    if (this.landed) this.trailPts.pop();
    this.trailPts.forEach((p, i) => { const b = (1 - i / 40) * 0.8; T.pos.set([p.x, p.y, p.z], n * 3); T.col.set([b, b * 0.8, b * 0.5], n * 3); T.size[n] = 0.02; n++; });
    for (; n < 40; n++) T.size[n] = 0;
    T.commit();
    // the apple glows while we think about it
    const glowOn = s.apple === 1 || (s.why > 0 && s.why < 3) || s.moonQ;
    this.appleGlow.material.opacity = damp(this.appleGlow.material.opacity, glowOn ? 0.75 : 0, 3, dt);
    // ch12_03: up and sideways (never!), then down: the pull toward the Earth's middle
    A.getWorldPosition(_a);
    const k1 = this.whyA = damp(this.whyA || 0, s.why === 1 ? 1 : 0, 3, dt);
    this.noT = s.why >= 1 ? (this.noT || 0) + dt * fast : 0;
    const dirs = [[0, 1, 0], [SIDE.x, 0, SIDE.z], [-SIDE.x, 0, -SIDE.z]];
    this.arrows.forEach((g, i) => {
      g.position.copy(_a); g.quaternion.setFromUnitVectors(_b.set(0, 1, 0), _c.set(...dirs[i]));
      const red = clamp01((this.noT - 0.9 - i * 0.25) * 2);
      g.userData.m.opacity = k1 * 0.85 * (0.4 + 0.6 * Math.abs(Math.sin(this.noT * 4 + i)) * (1 - red * 0.6));
      g.userData.m.color.setRGB(1, lerp(0.85, 0.25, red), lerp(0.55, 0.2, red));
      g.scale.setScalar(Math.max(0.01, k1 * (1 - red * 0.5)));
      g.visible = g.userData.m.opacity > 0.01;
    });
    const k2 = this.whyB = damp(this.whyB || 0, s.why === 2 ? 1 : 0, 2.5, dt);
    this.down.position.copy(_a).add(_b.set(0, -0.08, 0)); this.down.quaternion.setFromUnitVectors(_b.set(0, 1, 0), _c.set(0, -1, 0));
    this.down.userData.m.opacity = k2 * 0.95; this.down.visible = k2 > 0.01; this.down.scale.set(1, 0.3 + 0.7 * ease(k2) + 0.08 * Math.sin(t * 5), 1);
    // ...a stream of light sinking into the ground, toward the Earth's centre
    this.pullDots.visible = k2 > 0.01;
    if (this.pullDots.visible) {
      const P = this.pullDots.userData;
      for (let i = 0; i < 90; i++) { const f = ((i / 90) + t * 0.18) % 1, d = f * f * 7; P.pos.set([_a.x, _a.y - 0.1 - d, _a.z], i * 3); const b = k2 * (1 - f) * 0.9; P.col.set([b, b * 0.85, b * 0.55], i * 3); P.size[i] = 0.03 + f * 0.06; }
      P.commit();
    }
    this.centreLab.material.opacity = k2; this.centreLab.position.copy(_a).add(_b.set(0, -0.55, 0)).addScaledVector(TOWARD, 0.35);
  }

  // ch12_04: a line from the apple up to the Moon, the pull reaching it, and the question
  updateMoonQ(dt, t, mAz, mEl) {
    const s = this.s;
    const k = this.mqK = damp(this.mqK || 0, s.moonQ ? 1 : 0, 1.5, dt);
    this.moonLine.visible = k > 0.01; this.moonPullM.opacity = 0; this.moonQ.material.opacity = 0;
    if (!this.moonLine.visible) return;
    this.G.camera.getWorldPosition(_c);
    const md = dirFromAzEl(mAz, mEl, _d);
    this.apple.getWorldPosition(_a);
    const end = _b.copy(_c).addScaledVector(md, 160);
    const P = this.moonLine.userData;
    for (let i = 0; i < 60; i++) { const f = i / 60, ff = (f + t * 0.12) % 1, q = _w2.lerpVectors(_a, end, ff * ff); P.pos.set([q.x, q.y, q.z], i * 3); const b = k * 0.8 * (0.4 + 0.6 * ff); P.col.set([b, b * 0.9, b * 0.7], i * 3); P.size[i] = 0.012 + ff * 0.05; }
    P.commit();
    // at the Moon: an arrow pulling it down toward the Earth (wobbling: why doesn't it fall?)
    const m2 = clamp01(k * 2 - 1);
    this.moonPull.position.copy(_c).addScaledVector(md, 160).add(_a.set(0, -3, 0));
    this.moonPull.quaternion.setFromUnitVectors(_a.set(0, 1, 0), _b.set(0, -1, 0));
    this.moonPull.scale.setScalar(0.6 + 0.08 * Math.sin(t * 4));
    this.moonPullM.opacity = m2 * 0.7;
    this.mq2 = damp(this.mq2 || 0, s.moonQ === 2 ? 1 : 0, 2, dt);
    this.moonQ.material.opacity = this.mq2;
    this.moonQ.position.copy(_c).addScaledVector(md, 160).add(_a.set(0, 9 + Math.sin(t * 2) * 0.8, 0)).addScaledVector(_b.set(-md.z, 0, md.x).normalize(), 12);
  }

  updatePrincipia(dt, t) {
    const G = this.G, s = this.s;
    this.bookGlow.material.opacity = damp(this.bookGlow.material.opacity, s.book === 2 ? 0.9 + 0.1 * Math.sin(t * 3) : s.book ? 0.35 : 0, 2, dt);
    this.principia.getWorldPosition(_a);
    this.bookLab.material.opacity = damp(this.bookLab.material.opacity, s.book === 2 && s.phase === 'principia' ? 1 : 0, 2, dt);
    this.bookLab.position.copy(_a).add(_b.set(0, 0.55, 0));
    if (s.book === 2 && !this.bookFlare) { this.bookFlare = true; shimmer(G, 4, 0.16); G.events.emit('sfx', { k: 'page' }); }
    this.bookSparks.visible = s.book === 2 && s.phase === 'principia';
    if (this.bookSparks.visible) { const S = this.bookSparks.userData; this.bs.forEach((q, i) => { q.a += dt * q.v * 2; q.y = (q.y + dt * q.v) % 3; S.pos.set([_a.x + Math.cos(q.a) * q.r * (1 + q.y), _a.y + q.y * 1.4, _a.z + Math.sin(q.a) * q.r * (1 + q.y)], i * 3); const b = 1 - q.y / 3; S.col.set([b, b * 0.85, b * 0.5], i * 3); S.size[i] = 0.03; }); S.commit(); }
    // the ellipse over the orchard, facing you
    const v = this.ellV = damp(this.ellV || 0, s.ell ? 1 : 0, 1.4, dt); const M = this.ellG; M.visible = v > 0.01;
    if (!M.visible) return;
    G.camera.getWorldPosition(_a); M.lookAt(_a); M.rotateX(Math.PI / 2 - 0.35);
    if (s.ell && !this.ellSnd) { this.ellSnd = true; awe(G, 10, 0.07, 98); }
    this.eM = (this.eM || 0) + dt * 0.8 * this.speed(); ellAt(this.eM, this.ellPlanet.position);
    const P = this.ellPts.userData;
    for (let j = 0; j < 360; j++) { const a = j / 360 * Math.PI * 2, f = clamp01(v * 1.3 - j / 360 * 0.3); P.pos.set([EA * Math.cos(a) - EC, 0, -EB * Math.sin(a)], j * 3); P.col.set([f, f * 0.85, f * 0.45], j * 3); P.size[j] = 0.03; }
    // equal areas: a few spokes from the Sun to the planet, fading behind it
    for (let j = 0; j < 60; j++) { const f = j / 60, q = this.ellPlanet.position; P.pos.set([q.x * f, 0, q.z * f], (360 + j) * 3); const b = v * 0.5 * f; P.col.set([b * 0.6, b * 0.8, b], (360 + j) * 3); P.size[360 + j] = 0.015; }
    P.commit();
    this.ellSun.material.opacity = v; this.ellLab.material.opacity = v;
  }

  // ch12_10: a satellite crossing the sky, steady and silent, from the south-west over to the north-east
  updateSat(dt, t) {
    const s = this.s, G = this.G;
    if (s.sat && this.satT == null) this.satT = 0;
    if (this.satT == null) { this.sat.material.opacity = 0; this.satTrail.visible = false; this.satLab.material.opacity = 0; return; }
    this.satT += dt * this.speed();
    const f = clamp01(this.satT / 26), az = 215 + f * 190, el = 18 + Math.sin(f * Math.PI) * 58;
    G.camera.getWorldPosition(_c);
    this.sat.position.copy(_c).addScaledVector(dirFromAzEl(az, el, _a), 420);
    this.sat.material.opacity = (s.sat ? 1 : 0) * clamp01(this.satT) * (0.85 + 0.15 * Math.sin(t * 2)) * (f < 1 ? 1 : 0);
    this.satTrail.visible = this.sat.material.opacity > 0.01;
    if (this.satTrail.visible) { const P = this.satTrail.userData; for (let i = 0; i < 50; i++) { const ff = Math.max(0, f - i * 0.0025), q = _b.copy(_c).addScaledVector(dirFromAzEl(215 + ff * 190, 18 + Math.sin(ff * Math.PI) * 58, _d), 420); P.pos.set([q.x, q.y, q.z], i * 3); const b = 0.5 * (1 - i / 50); P.col.set([b * 0.8, b * 0.9, b], i * 3); P.size[i] = 0.4; } P.commit(); }
    this.satLab.material.opacity = damp(this.satLab.material.opacity, s.sat >= 2 && s.phase === 'satellite' ? 1 : 0, 2, dt);
    this.satLab.position.copy(_c).add(at(FACE, 9, 3.6));
    if (s.sat === 3 && !this.beeped) { this.beeped = true; const A = G.audio; if (A.ctx) { const o = A.out(null, 0.08); for (let i = 0; i < 5; i++) A.tone(o, { type: 'square', f: 1000, peak: 0.1, a: 0.005, d: 0.25, t0: i * 0.62 }); } }
    if (!s.sat) this.satT = null;
  }

  // ---------- Space: the cannon ----------
  async setSpace(on) {
    const G = this.G; this.spaceBusy = true;
    whoosh(G, 2.4, 0.35);
    await G.ui.fadeOut(0.7);
    if (on) this.layoutSpace(); else { this.space.exit(); G.sky.uni.milky.value = 1; }
    this.spaceOn = on;
    if (on) { rumble(G, 4, 0.3); this.tl0 = G.t; }
    await G.ui.fadeIn(1.2);
    this.spaceBusy = false;
    if (on) awe(G, 14, 0.08, 92);
  }

  // Lay the little Earth out in front of wherever you're looking
  layoutSpace() {
    const G = this.G, sp = this.space;
    const cam = G.camera.getWorldPosition(new THREE.Vector3()), f = G.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    const r = new THREE.Vector3(-f.z, 0, f.x), u = new THREE.Vector3(0, Math.cos(TILT), 0).addScaledVector(f, Math.sin(TILT)), n = new THREE.Vector3().crossVectors(r, u);
    const E = cam.clone().addScaledVector(f, 6.2).add(_a.set(0, -2.9, 0));
    this.cg.scale.setScalar(SCALE); sp.earth.scale.setScalar(SCALE);
    this.cg.position.copy(E); this.cg.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, n));
    sp.earth.position.copy(E);
    // England under the mountain, the Atlantic and Africa turned toward you
    const q = new THREE.Quaternion().setFromUnitVectors(lonLat(LAT, LON), u);
    const fr = lonLat(5, -20).applyQuaternion(q).projectOnPlane(u).normalize(), want = n.clone().projectOnPlane(u).normalize();
    const ang = Math.atan2(_a.crossVectors(fr, want).dot(u), fr.dot(want));
    sp.earth.quaternion.copy(q).premultiply(new THREE.Quaternion().setFromAxisAngle(u, ang));
    sp.sunDir.copy(f).negate().multiplyScalar(0.7).addScaledVector(r, -0.55).add(_a.set(0, 0.5, 0)).normalize();
    sp.moon.scale.setScalar(0.62); sp.moon.visible = false;
    this.mini.position.copy(cam).addScaledVector(f, 10).addScaledVector(r, -8).add(_a.set(0, 2.5, 0));
    this.lever.position.copy(cam).addScaledVector(f, 0.42).addScaledVector(r, 0.4).add(_a.set(0, -0.72, 0));
    this.lever.rotation.y = Math.atan2(r.x, r.z);
    sp.enter(this.root);
    this.mtnK = this.s.mtn ? 1 : 0;
  }

  updateCannon(dt, t) {
    const G = this.G, s = this.s, sp = this.space, C = this.cg, fast = this.speed();
    if (!this.spaceOn) return;
    // the mountain rises out of the Earth
    this.mtnK = Math.min(1, (this.mtnK || 0) + (s.mtn ? dt * fast / 2.5 : 0));
    const mk = ease(this.mtnK); this.mountain.scale.set(0.4 + 0.6 * mk, Math.max(0.01, mk), 0.4 + 0.6 * mk); this.mountain.position.y = ER - 0.4 + 0.725 * mk;
    this.cannon.visible = this.tiny.g.visible = mk > 0.95;
    // a new shot
    if (s.shot > this.shotN) {
      this.shotN = s.shot; this.shotT = 0; this.leverT = 0;
      const A = G.audio; C.localToWorld(_a.copy(this.muzzle));
      if (A.ctx) { const o = A.out(_a, 1.2, 4); A.tone(o, { f: 90, f2: 35, peak: 0.9, a: 0.002, d: 0.9 }); A.noise(o, { f: 1800, f2: 120, peak: 0.9, a: 0.002, d: 0.7 }); }
      this.burst(this.muzzle, 0xffc070, 30, 0.6);
      if (this.shotN === 3) this.tl3 = true;
    }
    if (this.shotN) this.shotT += dt;
    this.flash.material.opacity = this.shotN ? Math.max(0, 1 - this.shotT * 4) : 0; this.flash.scale.setScalar(0.4 + this.shotT * 2);
    // the lever: knocks over and springs back with each shot; glows while it's ready
    this.leverT = (this.leverT ?? 9) + dt;
    this.arm.rotation.x = this.leverT < 0.25 ? -0.6 + 1.6 * ease(this.leverT / 0.25) : this.leverT < 1.4 ? 1.0 - 1.6 * ease((this.leverT - 0.25) / 1.15) : -0.6;
    const ready = s.armed > s.pull;
    this.knobGlow.material.opacity = ready ? 0.55 + 0.35 * Math.sin(t * 5) : 0.1;
    // a faint thread of light from the lever to the cannon
    { const P = this.thread.userData; this.knobGlow.getWorldPosition(_a); C.localToWorld(_b.copy(this.muzzle)); for (let i = 0; i < 60; i++) { const f = i / 60, ff = (f + t * 0.3) % 1; _c.lerpVectors(_a, _b, ff); _c.y += Math.sin(ff * Math.PI) * 0.6; P.pos.set([_c.x, _c.y, _c.z], i * 3); const b = ready ? 0.35 : 0.08; P.col.set([b, b * 0.85, b * 0.5], i * 3); P.size[i] = 0.01; } P.commit(); }
    // the cannonballs and their trails
    const T = this.trails.userData; let n = 0;
    const dot = (x, y, z, r, g, b, sz) => { if (n >= 2600) return; T.pos.set([x, y, z], n * 3); T.col.set([r, g, b], n * 3); T.size[n] = sz; n++; };
    for (let i = 0; i < 3; i++) {
      const B = this.balls[i]; B.visible = this.shotN > i;
      if (!B.visible) { this.shotLabs[i].material.opacity = 0; continue; }
      const path = this.paths[i], tt = i === this.shotN - 1 ? this.shotT * fast : 1e9;
      if (i < 2) {
        const idx = Math.min(path.pts.length - 1, Math.floor(tt / path.dt));
        B.position.set(path.pts[idx][0], path.pts[idx][1], 0);
        const cur = i === this.shotN - 1, br = cur ? 0.9 : 0.35;
        for (let j = 0; j <= idx; j += 2) dot(path.pts[j][0], path.pts[j][1], 0, br, br * 0.8, br * 0.45, 0.04);
        if (idx === path.pts.length - 1 && !path.hit) { path.hit = true; this.burst(B.position, 0x9a8060, 40, 0.35); this.thud(B.position); }
        this.shotLabs[i].material.opacity = damp(this.shotLabs[i].material.opacity, path.hit && s.phase === 'cannon' ? 0.9 : 0, 3, dt);
        this.shotLabs[i].position.copy(B.position).multiplyScalar(1.12).add(_a.set(0, 0.1, 0));
      } else {
        // round and round: one loop every PERIOD seconds
        const ang = this.orbA = tt / PERIOD * Math.PI * 2;
        B.position.set(Math.sin(ang) * R0, Math.cos(ang) * R0, 0);
        const loops = Math.floor(ang / (Math.PI * 2));
        if (loops > this.loops) { this.loops = loops; if (loops === 1) { whoosh(G, 1.6, 0.5, C.localToWorld(_a.copy(this.muzzle))); shimmer(G, 4, 0.18); } }
        const drawn = Math.min(1, ang / (Math.PI * 2));
        for (let j = 0; j < 400; j++) { const f = j / 400; if (f > drawn) break; const a = f * Math.PI * 2, back = drawn < 1 ? 1 : 0.55 + 0.45 * (((a - ang) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2); dot(Math.sin(a) * R0, Math.cos(a) * R0, 0, back, back * 0.85, back * 0.5, 0.04); }
        this.shotLabs[2].material.opacity = 0;
      }
    }
    // ch12_07: the straight line it would fly without the pull
    this.tanK = damp(this.tanK || 0, s.tangent ? 1 : 0, 3, dt);
    if (this.tanK > 0.01) for (let j = 0; j < 90; j++) { const x = 0.2 + j * 0.07; if (j % 3 === 2) continue; dot(x, R0, 0, 0.45 * this.tanK, 0.65 * this.tanK, this.tanK, 0.018); }
    // tiny Newton: points along the shot, ducks as the ball comes round behind him, then cheers
    const TN = this.tiny, aNow = this.orbA % (Math.PI * 2);
    TN.pose = this.shotN < 3 ? (this.shotN ? 'point' : 'idle') : this.loops >= 1 && aNow > 5.9 ? 'gasp' : this.loops >= 1 ? 'cheer' : 'point';
    C.localToWorld(TN.pointAt.copy(this.shotN && this.shotN < 3 ? this.balls[this.shotN - 1].position : _a.set(1, R0, 0)));
    animatePerson(TN, t, dt);
    if (!TN.rig) { const duck = TN.pose === "gasp", hop = TN.pose === "cheer"; TN.duckK = damp(TN.duckK || 0, duck ? 0.9 : 0, 8, dt); TN.inner.rotation.x = TN.duckK; TN.inner.position.y = hop ? Math.abs(Math.sin(t * 7)) * 0.25 : 0; }
    this.orbitLab.material.opacity = damp(this.orbitLab.material.opacity, s.orbitLab ? 1 : 0, 3, dt); this.orbitLab.position.set(R0 + 0.9, 0.4, 0);
    // ch12_08: the Moon falls round the Earth too
    this.moonK = damp(this.moonK || 0, s.moon ? 1 : 0, 1.2, dt);
    sp.moon.visible = this.moonK > 0.01;
    if (sp.moon.visible) {
      this.moonA += dt * fast * Math.PI * 2 / MOON_T;
      C.localToWorld(sp.moon.position.set(Math.sin(this.moonA) * MOON_R, Math.cos(this.moonA) * MOON_R, -0.3));
      sp.moon.scale.setScalar(0.62 * SCALE * ease(this.moonK)); sp.moon.rotation.y = this.moonA;
      for (let j = 0; j < 300; j++) { const a = j / 300 * Math.PI * 2; dot(Math.sin(a) * MOON_R, Math.cos(a) * MOON_R, -0.3, 0.25 * this.moonK, 0.3 * this.moonK, 0.4 * this.moonK, 0.02); }
      this.moonLab.material.opacity = damp(this.moonLab.material.opacity, s.moon && !s.lines ? 1 : 0, 2, dt);
      this.moonLab.position.set(Math.sin(this.moonA) * MOON_R, Math.cos(this.moonA) * MOON_R + 0.85, -0.3);
    }
    // the pull: light flowing from the ball and the Moon straight toward the middle of the Earth
    this.lineK = damp(this.lineK || 0, s.lines ? 1 : 0, 2, dt);
    if (this.lineK > 0.01) for (const [px, py, pz] of [[this.balls[2].position.x, this.balls[2].position.y, 0], [Math.sin(this.moonA) * MOON_R, Math.cos(this.moonA) * MOON_R, -0.3]]) {
      const L = Math.hypot(px, py);
      for (let j = 0; j < 40; j++) { const f = ((j / 40) + t * 0.5) % 1, d = L - (L - ER) * f, b = this.lineK * (0.3 + 0.7 * f); dot(px / L * d, py / L * d, pz * (1 - f), b, b * 0.9, b * 0.6, 0.025); }
    }
    while (n < 2600) dot(0, 0, 0, 0, 0, 0, 0);
    T.commit();
    // the planets round a far-off Sun
    this.miniK = damp(this.miniK || 0, s.planets ? 1 : 0, 1.2, dt);
    this.mini.visible = this.miniK > 0.01;
    if (this.mini.visible) {
      this.mini.lookAt(G.camera.getWorldPosition(_a)); this.mini.rotateX(Math.PI / 2 - 0.5);
      const P = this.miniPts.userData, k = this.miniK; let m = 0;
      [[0.55, 0.24, 0xd8c8b0], [0.9, 0.15, 0x9ac8ff], [1.3, 0.08, 0xff7a50], [1.8, 0.04, 0xf0d2a8]].forEach(([R, w, c], i) => {
        const col = new THREE.Color(c);
        for (let j = 0; j < 90; j++) { const a = j / 90 * Math.PI * 2; P.pos.set([Math.cos(a) * R, 0, Math.sin(a) * R], m * 3); P.col.set([0.15 * k, 0.15 * k, 0.2 * k], m * 3); P.size[m] = 0.012; m++; }
        const a = t * w * fast * 3 + i * 1.7; P.pos.set([Math.cos(a) * R, 0, Math.sin(a) * R], m * 3); P.col.set([col.r * k, col.g * k, col.b * k], m * 3); P.size[m] = 0.09; m++;
      });
      while (m < 420) { P.size[m] = 0; m++; }
      P.commit(); this.miniSun.material.opacity = k; this.miniLab.material.opacity = s.planets && !s.gravity ? k : damp(this.miniLab.material.opacity, 0, 2, dt);
    }
    this.gravLab.material.opacity = damp(this.gravLab.material.opacity, s.gravity ? 1 : 0, 1.5, dt); this.gravLab.position.set(0, R0 + 1.25, 0);
    if (s.gravity && !this.gravSnd) { this.gravSnd = true; shimmer(G, 5, 0.2); }
    // dust and smoke puffs
    const PF = this.puffs.userData; let q = 0;
    for (const p of this.pf) { p.life -= dt * 1.2; if (p.life <= 0) continue; p.p.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - dt * 1.5); if (q < 160) { PF.pos.set([p.p.x, p.p.y, p.p.z], q * 3); PF.col.set([p.c.r * p.life, p.c.g * p.life, p.c.b * p.life], q * 3); PF.size[q] = p.sz * (1.6 - p.life); q++; } }
    this.pf = this.pf.filter((p) => p.life > 0);
    for (; q < 160; q++) PF.size[q] = 0;
    PF.commit();
  }
  burst(at0, color, n, spd) { const c = new THREE.Color(color); for (let i = 0; i < n; i++) this.pf.push({ p: at0.clone(), v: new THREE.Vector3().randomDirection().multiplyScalar(spd * (0.3 + Math.random())), life: 0.8 + Math.random() * 0.4, c, sz: 0.05 }); if (this.pf.length > 160) this.pf.splice(0, this.pf.length - 160); }
  thud(p) { const A = this.G.audio; if (!A.ctx) return; const o = A.out(this.cg.localToWorld(_a.copy(p)), 0.8, 4); A.tone(o, { f: 80, f2: 40, peak: 0.6, a: 0.003, d: 0.4 }); A.noise(o, { f: 400, f2: 100, peak: 0.4, a: 0.003, d: 0.3 }); }
  bark(p, vol = 0.5) { const A = this.G.audio; if (!A.ctx) return; const o = A.out(p, vol, 4); for (let i = 0; i < 2; i++) { A.noise(o, { type: 'bandpass', f: 750, f2: 500, q: 3, peak: 0.6, a: 0.004, d: 0.11, t0: i * 0.28 }); A.tone(o, { type: 'triangle', f: 520, f2: 320, peak: 0.25, a: 0.004, d: 0.1, t0: i * 0.28 }); } }

  // Evening on the farm: blackbirds, sheep, the cows, the distant church bell; crickets and an owl at night
  sounds(dt, sun) {
    const A = this.G.audio; if (!A.ctx || this.spaceOn) return;
    const night = clamp01((-sun.el - 3) / 8);
    if ((this.bellT -= dt) <= 0) { this.bellT = 60 + Math.random() * 40; for (let i = 0; i < 3; i++) setTimeout(() => A.bell(this.churchBell, 0.35), i * 4200); }
    if ((this.birdT -= dt) <= 0) { this.birdT = 1.5 + Math.random() * 3 + night * 10; if (night < 0.6) A.chirp(at(Math.random() * 360, 8 + Math.random() * 20, 3)); }
    if ((this.bleatT -= dt) <= 0) { this.bleatT = 7 + Math.random() * 9; const o = A.out(this.shep.g.position.clone().add(_a.set((Math.random() - 0.5) * 8, 0.5, (Math.random() - 0.5) * 8)), 0.18, 10); A.noise(o, { type: 'bandpass', f: 900, q: 5, peak: 0.3, a: 0.05, d: 0.55 }); A.tone(o, { type: 'sawtooth', f: 310, f2: 280, peak: 0.05, a: 0.05, d: 0.55 }); }
    if ((this.cowT -= dt) <= 0) { this.cowT = 25 + Math.random() * 25; const o = A.out(at(330, 55, 1), 0.25, 15); A.tone(o, { type: 'sawtooth', f: 120, f2: 95, peak: 0.12, a: 0.3, d: 1.4 }); }
    if (night > 0.3 && (this.owlT -= dt) <= 0) { this.owlT = 25 + Math.random() * 25; const o = A.out(at(300 + Math.random() * 80, 50, 8), 0.25, 10); A.tone(o, { f: 380, f2: 340, peak: 0.25, a: 0.05, d: 0.5 }); A.tone(o, { f: 360, f2: 320, peak: 0.2, a: 0.1, d: 0.9, t0: 0.7 }); }
    if (night > 0.2 && (this.cricketT -= dt) <= 0) { this.cricketT = 0.5 + Math.random() * 1.4; const o = A.out(at(Math.random() * 360, 5 + Math.random() * 12, 0.2), 0.05 * night, 4), f = 4400 + Math.random() * 500; for (let i = 0; i < 3; i++) A.tone(o, { type: 'triangle', f, peak: 0.25, a: 0.003, d: 0.035, t0: i * 0.07 }); }
    // bees round the hives while it's light
    if (night < 0.3 && (this.beeT = (this.beeT ?? 0) - dt) <= 0) { this.beeT = 2.5; const o = A.out(this.hives, 0.08, 1.5); A.tone(o, { type: 'sawtooth', f: 220 + Math.random() * 30, f2: 235, peak: 0.06, a: 0.6, d: 1.6 }); }
  }

  dispose() {
    this.space.dispose();
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.sky.hideMoon();
    this.G.sky.uni.milky.value = 1;
  }
}

// A cannonball fired level from the mountain top at speed v: its path (in the orbit's plane) until
// it hits the ground, under a pull toward the Earth's middle that weakens with distance squared.
function simulate(v) {
  const dt = 1 / 60, pts = []; let x = 0, y = R0, vx = v, vy = 0;
  for (let i = 0; i < 60 * 30; i++) {
    pts.push([x, y]);
    const r = Math.hypot(x, y), a = GM / (r * r * r);
    vx -= a * x * dt; vy -= a * y * dt; x += vx * dt; y += vy * dt;
    if (Math.hypot(x, y) <= ER + 0.02 && Math.abs(x) > 0.5) { const k = (ER + 0.02) / Math.hypot(x, y); pts.push([x * k, y * k]); break; }
  }
  return { pts, dt, hit: false };
}

// The journal page: the apple and the Moon, and Newton's cannon drawing
function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
  g.fillText('Newton, 1666: gravity', 40, 70);
  // the cannon on the mountain, three shots, the last one an orbit
  const cx = 300, cy = 400, R = 150, top = cy - R - 40;
  g.fillStyle = 'rgba(90,140,90,0.25)'; g.beginPath(); g.arc(cx, cy, R, 0, 6.28); g.fill();
  g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, 0, 6.28); g.stroke();
  g.fillStyle = '#8a7a60'; g.beginPath(); g.moveTo(cx - 30, cy - R + 8); g.lineTo(cx, top); g.lineTo(cx + 30, cy - R + 8); g.fill(); g.stroke();
  g.setLineDash([8, 7]); g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(cx, top); g.quadraticCurveTo(cx + 60, top, cx + 75, cy - R + 18); g.stroke();
  g.beginPath(); g.moveTo(cx, top); g.bezierCurveTo(cx + 150, top, cx + R + 20, cy - 40, cx + R - 10, cy + 60); g.stroke();
  g.setLineDash([]); g.strokeStyle = '#c0601a'; g.lineWidth = 3.5; g.beginPath(); g.arc(cx, cy, R + 40, 0, 6.28); g.stroke();
  g.fillStyle = INK; g.font = 'italic 26px Georgia, serif';
  g.fillText('slow', cx + 64, top + 8); g.fillText('faster', cx + R - 10, cy - 70); g.fillStyle = '#c0601a'; g.fillText('really fast: an orbit', cx - 120, cy + R + 80);
  // the apple and the Moon, the same pull
  const ax = 720, ay = 230;
  g.fillStyle = '#b8281c'; g.beginPath(); g.arc(ax, ay, 22, 0, 6.28); g.fill(); g.fillStyle = '#4a7a2a'; g.fillRect(ax - 2, ay - 34, 4, 14);
  g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(ax, ay + 30); g.lineTo(ax, ay + 110); g.stroke(); g.beginPath(); g.moveTo(ax - 12, ay + 94); g.lineTo(ax, ay + 112); g.lineTo(ax + 12, ay + 94); g.stroke();
  g.fillStyle = '#d8d8d0'; g.beginPath(); g.arc(880, 210, 34, 0, 6.28); g.fill(); g.strokeStyle = INK; g.stroke();
  g.beginPath(); g.moveTo(880, 252); g.lineTo(880, 330); g.stroke(); g.beginPath(); g.moveTo(868, 314); g.lineTo(880, 332); g.lineTo(892, 314); g.stroke();
  g.fillStyle = INK; g.font = 'italic 28px Georgia, serif';
  g.fillText('the apple falls...', 630, 400); g.fillText('...and so does the Moon.', 630, 440);
  g.fillText('The same pull, everywhere.', 630, 520);
  g.fillText('Fast enough, and you never come down.', 40, h - 40);
}
