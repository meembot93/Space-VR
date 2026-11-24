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
// in the sky (the summer constellations come out: js/wow/ch12.js), and a little new star creeping steadily across
// the sky: a satellite, your own moon, three hundred years later (the next chapters).
// World axes: -Z north, +X east, +Y up. You start at the origin looking east (az 95).
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { appleTree, orchardTree, deciduousTree, conifer, grove, makeApple } from '../trees.js';
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
const BOOKSPOT = at(106, 2.4);                     // where Newton stands with the Principia (clear of the apple boughs)
const KEPSPOT = at(104, 3.5);                      // an open patch of grass beside him (no trees)
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
// Sitting on the grass with his back to the trunk (k = 1), getting up through a crouch (k = 0.5),
// standing (k = 0). Runs after animatePerson, which stands the legs up. Returns the hips' height.
const _t0 = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
function sitLegs(P, k, hipY) {
  const B = P.rig?.bones; if (!B || k < 0.01) return hipY;
  const crouch = 1 - Math.abs(k - 0.5) * 2, t = clamp01((k - 0.5) * 2);
  B.Spine?.rotateX(-0.1 * t + 0.45 * crouch);   // leaning back on the trunk; forward as he gets up
  P.inner.updateWorldMatrix(true, false);
  for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
    const up = B[side + 'UpLeg'], low = B[side + 'Leg'], foot = B[side + 'Foot'];
    if (!up || !low || !foot) continue;
    // sitting: knees drawn up a little (his left more than his right), heels on the grass
    const kn = side === 'Left' ? 0.42 : 0.2;
    _t0.set(sx * 0.2, kn, 1).normalize().lerp(_t2.set(sx * 0.14, 0.05, 1).normalize(), 1 - t).normalize();
    _t1.set(sx * 0.06, -kn * 1.25 - 0.08, 1).normalize().lerp(_t2.set(sx * 0.03, -1, 0.12).normalize(), 1 - t).normalize();
    const w = Math.min(1, k * 2);
    aimBone(up, low, _t0.transformDirection(P.inner.matrixWorld), w);
    aimBone(low, foot, _t1.transformDirection(P.inner.matrixWorld), w);
  }
  // the hips: 0.12 m up sitting, 0.42 crouching, at standing height once up
  return k > 0.5 ? lerp(0.42, 0.12, ease(t)) : lerp(hipY, 0.42, ease(k * 2));
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
    const k = new Kit(), wins = [], r = rng(61), ST = 0xcfc2a0, ST2 = 0xbcae8c, MORTAR = 0x9a8f78, ROOF = 0x6a645a;
    const { x, z } = HOUSE, y = groundHeight(x, z) - 0.2, yaw = Math.atan2(-x, -z);   // its front looks at the orchard
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const W = 14, D = 6.4, H = 6.2, RH = 4.6, PH = 2.7;
    // the walls (their colour is the mortar: the dressed stones are laid over them below)
    k.box(W, H, D, MORTAR, P(0, H / 2, 0), [0, yaw, 0]);
    k.box(W + 0.2, 0.5, D + 0.2, ST2, P(0, 0.25, 0), [0, yaw, 0]);                 // the plinth
    k.box(W + 0.1, 0.22, D + 0.1, ST2, P(0, 3.1, 0), [0, yaw, 0]);                 // the string course between the floors
    k.add(gableRoof(W, D, RH, 0.3), ROOF, P(0, H, 0), [0, yaw, 0]);
    for (const sx of [-1, 1]) {
      k.add(gableWall(D, RH, 0.3), MORTAR, P(sx * (W / 2 - 0.15), H, 0), [0, yaw + Math.PI / 2, 0]);
      // the gable-end chimney stack: weathering bands, a moulded cap and two flues
      const cx = sx * (W / 2 - 0.5), top = H + RH + 2.6;
      k.box(1.2, RH + 2.6, 0.9, ST2, P(cx, H + (RH + 2.6) / 2, 0), [0, yaw, 0]);
      k.box(1.3, 0.12, 1.0, 0x9a8e74, P(cx, H + RH + 0.5, 0), [0, yaw, 0]);
      k.box(1.3, 0.1, 1.0, 0x9a8e74, P(cx, top - 0.45, 0), [0, yaw, 0]);
      k.box(1.38, 0.22, 1.08, 0x9a8e74, P(cx, top + 0.1, 0), [0, yaw, 0]);
      for (const oz of [-0.2, 0.2]) { k.box(0.36, 0.3, 0.32, ST2, P(cx, top + 0.36, oz), [0, yaw, 0]); k.box(0.22, 0.02, 0.18, 0x141210, P(cx, top + 0.52, oz), [0, yaw, 0]); }
      this.chimneys = (this.chimneys || []).concat([new THREE.Vector3(...P(cx, top + 0.6, 0))]);
      // coped gables: stone copings up both rakes, kneelers at the eaves, a finial at the top
      const sl = Math.hypot(D / 2 + 0.1, RH + 0.15), ang = Math.atan2(RH, D / 2);
      for (const sz of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.44, 0.16, sl); g.rotateX(sz > 0 ? ang : -ang);
        k.add(g, 0xa89c80, P(sx * (W / 2 - 0.15), H + RH / 2 + 0.16, sz * D / 4), [0, yaw, 0]);
        k.box(0.5, 0.36, 0.55, 0xa89c80, P(sx * (W / 2 - 0.15), H + 0.1, sz * (D / 2 + 0.02)), [0, yaw, 0]);
      }
    }
    // the stone-slate roof: courses graded from big slates at the eaves to small ones at the ridge,
    // each course kicked up a little at its lower edge, in lengths of slightly different stone
    {
      const over = 0.3, ang = Math.atan2(RH, D / 2), drop = over * RH / (D / 2), eave = D / 2 + over, len = Math.hypot(eave, RH + drop);
      for (const sz of [-1, 1]) {
        let sd = 0;
        while (sd < len - 0.2) {
          const cw = 0.44 - 0.2 * (sd / len), mid = sd + cw / 2, lift = 0.03;
          const lz = sz * (eave - mid * Math.cos(ang)), ly = H - drop + mid * Math.sin(ang);
          const nx = sz * Math.sin(ang) * lift, ny = Math.cos(ang) * lift;   // out from the roof
          for (let ox = -W / 2 - over + 0.02; ox < W / 2 + over - 0.1;) {
            const pl = Math.min(W / 2 + over - 0.02 - ox, 0.5 + r() * 1.2), g = new THREE.BoxGeometry(pl - 0.012, 0.025, cw + 0.03);
            g.rotateX(sz > 0 ? ang - 0.05 : -ang + 0.05);
            const sh = 0.86 + r() * 0.24, mossy = r() < 0.12;
            k.add(g, new THREE.Color(mossy ? 0x5e6248 : ROOF).multiplyScalar(sh).getHex(), P(ox + pl / 2, ly + ny, lz + nx), [0, yaw, 0]);
            ox += pl;
          }
          sd += cw;
        }
      }
      // the ridge: a row of V-shaped ridge stones
      for (let ox = -W / 2 - 0.2; ox < W / 2 + 0.2; ox += 0.62) { const g = new THREE.BoxGeometry(0.6, 0.24, 0.24); g.rotateX(Math.PI / 4); k.add(g, 0x5a554c, P(ox + 0.3, H + RH + 0.04, 0), [0, yaw, 0]); }
    }
    // the rear wing (the T) and its own roof
    k.box(6, H - 0.4, 7, ST, P(1.5, (H - 0.4) / 2, -D / 2 - 3.4), [0, yaw, 0]);
    k.add(gableRoof(7, 6, 4, 0.3).rotateY(Math.PI / 2), ROOF, P(1.5, H - 0.4, -D / 2 - 3.4), [0, yaw, 0]);
    // the porch with its little coped gable, a moulded doorway, the plank door, a worn stone step
    k.box(2.6, PH, 1.8, MORTAR, P(-0.8, PH / 2, D / 2 + 0.9), [0, yaw, 0]);
    k.box(2.7, 0.3, 1.9, ST2, P(-0.8, 0.15, D / 2 + 0.92), [0, yaw, 0]);
    k.add(gableRoof(1.8, 2.6, 1.0, 0.15).rotateY(Math.PI / 2), ROOF, P(-0.8, PH, D / 2 + 0.9), [0, yaw, 0]);
    k.add(gableWall(2.6, 1.0, 0.2), MORTAR, P(-0.8, PH, D / 2 + 1.72), [0, yaw, 0]);
    { const sl = Math.hypot(1.4, 1.08), ang = Math.atan2(1.0, 1.3);
      for (const sx of [-1, 1]) { const g = new THREE.BoxGeometry(sl, 0.12, 0.3); g.rotateZ(sx > 0 ? -ang : ang); k.add(g, 0xa89c80, P(-0.8 + sx * 0.66, PH + 0.56, D / 2 + 1.74), [0, yaw, 0]); }
      k.ball(0.1, 0, 0xa89c80, P(-0.8, PH + 1.18, D / 2 + 1.74)); }
    const fz = D / 2 + 1.8;
    k.box(1.3, 2.3, 0.04, 0x1a120c, P(-0.8, 1.15, fz + 0.01), [0, yaw, 0]);                 // the dark doorway behind the door
    for (let i = 0; i < 5; i++) k.box(0.2, 2.08, 0.05, new THREE.Color(0x4a3020).multiplyScalar(0.85 + r() * 0.3).getHex(), P(-0.8 - 0.42 + i * 0.21, 1.06, fz + 0.04), [0, yaw, 0]);
    for (const yy of [0.35, 1.05, 1.75]) for (let i = 0; i < 5; i++) k.box(0.03, 0.03, 0.02, 0x1a1a1a, P(-0.8 - 0.42 + i * 0.21, yy, fz + 0.075), [0, yaw, 0]);   // nail heads
    k.box(0.04, 0.12, 0.05, 0x1a1a1a, P(-0.8 + 0.4, 1.0, fz + 0.09), [0, yaw, 0]);           // the latch
    for (const sx of [-1, 1]) k.box(0.18, 2.32, 0.1, ST2, P(-0.8 + sx * 0.64, 1.16, fz + 0.03), [0, yaw, 0]);   // the jambs
    k.box(1.5, 0.26, 0.12, ST2, P(-0.8, 2.4, fz + 0.04), [0, yaw, 0]);                       // the lintel
    k.box(1.7, 0.08, 0.2, ST2, P(-0.8, 2.56, fz + 0.06), [0, yaw, 0]);                       // its hood mould
    k.box(1.6, 0.2, 0.6, 0xa89c80, P(-0.8, 0.1, D / 2 + 2.1), [0, yaw, 0]);
    k.box(1.3, 0.16, 0.36, 0xa89c80, P(-0.8, 0.0, D / 2 + 2.55), [0, yaw, 0]);
    // stone-mullioned windows: a surround, the mullions, a sill, the drip mould, the panes (some glowing)
    const holes = { front: [], side: [] };
    const win = (lx, ly, lz, n, face = 0, list = null) => {
      const w = n * 0.55, fz = lz + 0.04;
      const fy = yaw + face;
      const Q = (ax, ay, az) => { const cc = Math.cos(face), ss = Math.sin(face); return P(ax * cc + az * ss, ay, -ax * ss + az * cc); };
      k.box(w + 0.3, 1.35, 0.12, ST2, Q(lx, ly, fz), [0, fy, 0]);
      for (let i = 0; i < n; i++) wins.push({ p: new THREE.Vector3(...Q(lx - w / 2 + 0.275 + i * 0.55, ly, fz + 0.07)), yaw: fy });
      for (let i = 1; i < n; i++) k.box(0.08, 1.15, 0.16, ST2, Q(lx - w / 2 + i * 0.55, ly, fz + 0.06), [0, fy, 0]);
      k.box(0.06, 1.15, 0.03, 0x2a2420, Q(lx - w / 2 + 0.01, ly, fz + 0.075), [0, fy, 0]);
      k.box(w + 0.45, 0.14, 0.24, ST2, Q(lx, ly + 0.72, fz + 0.06), [0, fy, 0]);   // the drip mould
      for (const sx of [-1, 1]) k.box(0.1, 0.22, 0.24, ST2, Q(lx + sx * (w / 2 + 0.17), ly + 0.6, fz + 0.06), [0, fy, 0]);   // its return ends
      k.box(w + 0.4, 0.09, 0.24, ST2, Q(lx, ly - 0.72, fz + 0.06), [0, fy, 0]);     // the sill
      list?.push([lx - w / 2 - 0.3, lx + w / 2 + 0.3, ly - 0.82, ly + 0.84]);
    };
    for (const [lx, n] of [[-5, 3], [2.3, 3], [5.2, 2]]) win(lx, 1.6, D / 2, n, 0, holes.front);
    for (const [lx, n] of [[-5, 3], [-0.8, 2], [2.3, 3], [5.2, 2]]) win(lx, 4.6, D / 2, n, 0, holes.front);
    for (const sx of [-1, 1]) win(0, 4.6, W / 2, 2, sx * Math.PI / 2);   // the gable ends
    holes.side.push([-0.95, 0.95, 3.78, 5.44], [-0.55, 0.55, H - 0.01, H + RH + 3]);   // the gable window, the chimney
    win(0, H + 1.4, W / 2, 1, Math.PI / 2);
    // dressed limestone laid in courses over the walls, and big quoin stones at the corners
    holes.front.push([-0.8 - 1.42, -0.8 + 1.42, -1, PH + 1.1]);
    ashlar(k, r, P, yaw, 0, 0, D / 2, W, H, 0, holes.front);
    for (const sx of [-1, 1]) ashlar(k, r, P, yaw, sx * Math.PI / 2, sx * W / 2, 0, D, H, RH, sx > 0 ? holes.side.concat([[-0.6, 0.6, H + 0.6, H + 2.3]]) : holes.side);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) quoins(k, r, P, yaw, sx * W / 2, sz * D / 2, sx, sz, H);
    for (const sx of [-1, 1]) quoins(k, r, P, yaw, -0.8 + sx * 1.3, D / 2 + 1.8, sx, 1, PH, 0.3, 0.42, 0.26);
    ashlar(k, r, P, yaw, 0, -0.8, D / 2 + 1.8, 2.6, PH, 1.0, [[-0.78, 0.78, -1, 2.68]], 0.45, 0.3);
    for (const sx of [-1, 1]) ashlar(k, r, P, yaw, sx * Math.PI / 2, -0.8 + sx * 1.3, D / 2 + 0.9, 1.8, PH, 0, [], 0.3, 0.3);
    // the lantern on its iron bracket by the door
    const LP = P(0.12, 2.3, fz + 0.32);
    k.box(0.04, 0.04, 0.34, 0x1e1c1a, P(0.12, 2.58, fz + 0.17), [0, yaw, 0]); k.box(0.12, 0.2, 0.03, 0x1e1c1a, P(0.12, 2.55, fz + 0.015), [0, yaw, 0]);
    k.cyl(0.006, 0.006, 0.12, 4, 0x1e1c1a, [LP[0], LP[1] + 0.22, LP[2]]);
    k.cyl(0.01, 0.13, 0.1, 4, 0x1e1c1a, [LP[0], LP[1] + 0.15, LP[2]], [0, yaw + Math.PI / 4, 0]);
    k.cyl(0.09, 0.09, 0.03, 4, 0x1e1c1a, [LP[0], LP[1] - 0.12, LP[2]], [0, yaw + Math.PI / 4, 0]);
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.015, 0.22, 0.015, 0x1e1c1a, [LP[0] + (ox * c + oz * s) * 0.06, LP[1] - 0.01, LP[2] + (-ox * s + oz * c) * 0.06], [0, yaw, 0]);
    k.box(0.1, 0.18, 0.1, 0xf0c070, [LP[0], LP[1] - 0.01, LP[2]], [0, yaw, 0]);
    this.root.add(k.mesh());
    this.manorWins = windows(wins, { lit: 0.55, w: 0.42, h: 1.0, seed: 6 }); this.root.add(this.manorWins);
    this.doorPos = new THREE.Vector3(...P(-0.8, 0, D / 2 + 2.6));
    this.lantern = new THREE.PointLight(0xffa860, 0, 14, 1.6); this.lantern.position.set(...LP); this.root.add(this.lantern);
    this.lanternGlow = glow(0xffb060, 0.5, 0); this.lanternGlow.position.copy(this.lantern.position); this.root.add(this.lanternGlow);
    this.houseYaw = yaw;
  }

  // The farmyard: a stone barn, a round dovecote, the cart and the haystacks, beehives (straw skeps),
  // the dry-stone walls round the orchard, a field gate, the corn stooks in the harvest field.
  buildFarm() {
    const k = new Kit(), r = rng(17), wins = [];
    const by = groundHeight(BARN.x, BARN.z);
    house(k, { x: BARN.x, y: by - 0.2, z: BARN.z, w: 16, d: 7, h: 5, roof: 5, yaw: Math.atan2(-BARN.x, -BARN.z), wall: 0xc4b694, roofCol: 0x7a6a50 }, []);   // (a barn: no house windows)
    { // the barn's threshing doors (a big pair of plank doors under a timber lintel), ventilation
      // slits in the stone, and corner stones
      const yw = Math.atan2(-BARN.x, -BARN.z), c = Math.cos(yw), s = Math.sin(yw), fz = 3.5;
      const Q = (lx, ly, lz) => [BARN.x + lx * c + lz * s, by - 0.2 + ly, BARN.z - lx * s + lz * c];
      k.box(3.6, 3.9, 0.06, 0x14100c, Q(2.5, 1.95, fz + 0.01), [0, yw, 0]);
      for (let i = 0; i < 12; i++) k.box(0.27, 3.6, 0.06, new THREE.Color(0x5a4430).multiplyScalar(0.8 + r() * 0.35).getHex(), Q(2.5 - 1.5 + i * 0.27 + (i >= 6 ? 0.06 : -0.06), 1.8, fz + 0.05 + (i >= 6 ? 0.012 : 0)), [0, yw + (i >= 6 ? 0.02 : 0), 0]);
      for (const yy of [0.6, 1.8, 3.0]) for (const sx of [-1, 1]) k.box(1.5, 0.14, 0.04, 0x4a3828, Q(2.5 + sx * 0.83, yy, fz + 0.1), [0, yw, 0]);
      k.box(4.2, 0.35, 0.3, 0x4a3828, Q(2.5, 4.05, fz + 0.06), [0, yw, 0]);
      for (const sx of [-1, 1]) k.box(0.25, 4.0, 0.2, 0x4a3828, Q(2.5 + sx * 1.92, 2.0, fz + 0.06), [0, yw, 0]);
      for (const lx of [-6.5, -4.6, -2.7, 5.6, 7.2]) for (const ly of [1.6, 3.4]) k.box(0.12, 0.7, 0.06, 0x14100c, Q(lx, ly, fz + 0.01), [0, yw, 0]);
      for (const sx of [-1, 1]) for (let i = 0; i < 9; i++) k.box(i % 2 ? 0.35 : 0.6, 0.5, 0.06, 0xd2c6a6, Q(sx * (8 - (i % 2 ? 0.175 : 0.3) + 0.03), 0.45 + i * 0.52, fz + 0.02), [0, yw, 0]);
    }
    const out = at(15, 34); house(k, { x: out.x, y: groundHeight(out.x, out.z) - 0.2, z: out.z, w: 7, d: 5, h: 3, roof: 3, yaw: Math.atan2(-out.x, -out.z) + 0.3, wall: 0xc8b898, roofCol: 0x8a5a3a }, wins);
    // the dovecote
    const dv = at(62, 36), dy = groundHeight(dv.x, dv.z);
    k.cyl(2.2, 2.4, 5, 14, 0xcfc2a0, [dv.x, dy + 2.5, dv.z]); k.cyl(0.001, 2.8, 2.6, 14, 0x6a645a, [dv.x, dy + 6.3, dv.z]); k.cyl(0.4, 0.4, 0.8, 8, 0x8a7a60, [dv.x, dy + 7.8, dv.z]);
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; k.box(0.25, 0.25, 0.1, 0x1a1410, [dv.x + Math.sin(a) * 2.32, dy + 4 + (i % 2) * 0.5, dv.z + Math.cos(a) * 2.32], [0, a, 0]); }
    // haystacks (clear of the orchard wall) and a cart in the yard
    for (const [az, d] of [[5, 22.5], [358, 21.5], [14, 27]]) { const p = at(az, d), y = groundHeight(p.x, p.z); k.cyl(1.6, 2.1, 3, 10, 0xb89a56, [p.x, y + 1.5, p.z]); k.cyl(0.001, 1.8, 1.8, 10, 0xa88a4a, [p.x, y + 3.9, p.z]); }
    const ca = at(25, 18), cy = groundHeight(ca.x, ca.z), cyaw = 0.6;
    k.box(1.4, 0.15, 2.6, 0x6a4a2e, [ca.x, cy + 0.85, ca.z], [0, cyaw, 0]);
    for (const sx of [-1, 1]) { k.box(0.06, 0.5, 2.6, 0x5a3e26, [ca.x + Math.cos(cyaw) * sx * 0.68, cy + 1.1, ca.z - Math.sin(cyaw) * sx * 0.68], [0, cyaw, 0]); k.cyl(0.55, 0.55, 0.08, 12, 0x4a3420, [ca.x + Math.cos(cyaw) * sx * 0.8, cy + 0.55, ca.z - Math.sin(cyaw) * sx * 0.8], [0, cyaw, Math.PI / 2]); }
    k.box(1.2, 0.5, 2.2, 0xb89a56, [ca.x, cy + 1.2, ca.z], [0, cyaw, 0]);
    k.box(0.08, 0.08, 2.4, 0x5a3e26, [ca.x + Math.sin(cyaw) * 2.4, cy + 0.6, ca.z + Math.cos(cyaw) * 2.4], [0.25, cyaw, 0]);
    // beehives: straw skeps on a bench by the orchard wall
    const bh = at(150, 11), bhy = groundHeight(bh.x, bh.z);
    { // a weathered plank on two little stone piers, a straw skep on a board on each third, each
      // under its own straw hackle (a rain hat), with a dark entrance at the foot facing the sun
      const BY = 0.4, c4 = Math.cos(0.4), s4 = Math.sin(0.4), Q = (ox, y, oz = 0) => [bh.x + ox * c4 + oz * s4, bhy + y, bh.z - ox * s4 + oz * c4];
      k.box(2.3, 0.07, 0.48, 0x7a6448, Q(0, BY + 0.035), [0, 0.4, 0]); k.box(2.3, 0.05, 0.03, 0x5e4a34, Q(0, BY + 0.01, 0.25), [0, 0.4, 0]);
      for (const ox of [-0.85, 0.85]) for (let j = 0; j < 3; j++) k.box(0.36 - j * 0.03, 0.12, 0.4 - j * 0.02, pickStone(r), Q(ox + (r() - 0.5) * 0.03, 0.06 + j * 0.125), [0, 0.4 + (r() - 0.5) * 0.1, 0]);
      for (const ox of [-0.7, 0, 0.7]) {
        k.box(0.5, 0.025, 0.42, 0x6a5038, Q(ox, BY + 0.083), [0, 0.4 + (r() - 0.5) * 0.2, 0]);
        k.ball(0.3, 1, 0xc8a050, Q(ox, BY + 0.3), 0, [1, 1.05, 1]);
        for (let j = 0; j < 6; j++) { const d = -0.2 + j * 0.075, rr = Math.sqrt(0.09 - d * d) + 0.012; k.cyl(rr, rr, 0.028, 12, 0xa88038, Q(ox, BY + 0.3 + d)); }
        k.box(0.09, 0.05, 0.04, 0x1a1208, Q(ox, BY + 0.13, 0.27), [0, 0.4, 0]);
        k.cyl(0.03, 0.42, 0.3, 12, 0xb89a56, Q(ox, BY + 0.68), [0, r(), 0]);      // the hackle
      }
    }
    this.hives = new THREE.Vector3(bh.x, bhy + 0.8, bh.z);
    // the dry-stone wall round the orchard (a rough square): coursed limestone, through-stones,
    // upright coping, built-up corners and wall ends, stone gateposts and two five-bar gates
    const WX = 30, WZ0 = -18, WZ1 = 24;
    const ws = new Kit();
    dryWall(ws, r, -26, WZ0, 6, WZ0, { a: 'corner', b: 'end' });
    dryWall(ws, r, -26, WZ1, -26, WZ0, { a: 'corner', b: 'corner' });
    dryWall(ws, r, -26, WZ1, 6.2, WZ1, { a: 'corner', b: 'post' }); dryWall(ws, r, 9.8, WZ1, WX, WZ1, { a: 'post', b: 'corner' });
    dryWall(ws, r, WX, -6, WX, 10.2, { a: 'end', b: 'post' }); dryWall(ws, r, WX, 13.8, WX, WZ1, { a: 'post', b: 'corner' });
    for (const [cx, cz] of [[-26, WZ0], [-26, WZ1], [WX, WZ1]]) wallCorner(ws, r, cx, cz);
    // gateposts and the gates: the east one shut, the south one swung open into the orchard
    for (const [px, pz] of [[6.0, WZ1], [10.0, WZ1], [WX, 10.0], [WX, 14.0]]) gatePost(ws, r, px, pz);
    fiveBarGate(ws, WX, 10.25, -Math.PI / 2 - 0.1, 3.45);
    fiveBarGate(ws, 6.25, WZ1, 1.3, 3.45);
    this.root.add(ws.mesh());
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
    // the hero: Newton's apple tree (full detail). One apple near the ideal spot over the grass by
    // him is left off the tree: that is the one that falls (it hangs from a real twig).
    // (seed 14 turned so no low limb reaches over Newton and the shallow side of the root flare
    // is under him; the apple that falls hangs about 1.85 m up, just past his knees, to his right)
    const ty = groundHeight(TREE.x, TREE.z), UPV = new THREE.Vector3(0, 1, 0);
    const yaw = Math.atan2(-TOWARD.z, TOWARD.x) + 270 * D2R;
    const toWorld = (v) => v.clone().applyAxisAngle(UPV, yaw);
    const want = new THREE.Vector3().addScaledVector(TOWARD, 0.7).addScaledVector(SIDE, -0.45).setY(1.9).applyAxisAngle(UPV, -yaw);
    this.heroTree = appleTree({ seed: 14, height: 5.4, apples: 30, windfalls: 9, reserveApples: 1, reserveNear: want,
      ground: (x, z) => { const w = toWorld(new THREE.Vector3(x, 0, z)); return groundHeight(TREE.x + w.x, TREE.z + w.z) - ty; } });
    this.heroTree.group.position.set(TREE.x, ty, TREE.z); this.heroTree.group.rotation.y = yaw; this.root.add(this.heroTree.group);
    const ra = this.heroTree.reserved[0];
    if (ra) APPLE0.copy(toWorld(ra.pos)).add(TREE).setY(ty + ra.pos.y);
    // seat Newton just clear of the real trunk (its bark between hip and shoulder height, toward him)
    {
      const pos = this.heroTree.bark.geometry.attributes.position, w = new THREE.Vector3(); let rmax = 0.15;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i); if (y < 0.15 || y > 0.9) continue;
        w.set(pos.getX(i), 0, pos.getZ(i)).applyAxisAngle(UPV, yaw);
        const along = w.x * TOWARD.x + w.z * TOWARD.z, side = Math.abs(w.x * SIDE.x + w.z * SIDE.z);
        if (along > 0 && side < 0.25 && Math.hypot(w.x, w.z) < 0.6) rmax = Math.max(rmax, along);
      }
      SIT.copy(TREE).addScaledVector(TOWARD, rmax + 0.2); this.trunkR = rmax;
    }
    this.trees.push(new THREE.Vector3(TREE.x, ty, TREE.z));
    this.G.world.blockers.push({ x: TREE.x, z: TREE.z, r: 0.35 });
    // the rest of the orchard: fruit trees in rows, nearer ones in more detail
    const near = [], far = [];
    const tree = (x, z, sc) => {
      const y = groundHeight(x, z), spot = { x, y: y - 0.03, z, s: sc, yaw: r() * 6.28 };
      (Math.hypot(x, z) < 10 ? near : far).push(spot);
      this.trees.push(new THREE.Vector3(x, y, z));
      this.G.world.blockers.push({ x, z, r: 0.3 * sc });
    };
    for (let gx = -24; gx <= 28; gx += 6.5) for (let gz = -16; gz <= 22; gz += 6.5) {
      const x = gx + (r() - 0.5) * 1.6, z = gz + (r() - 0.5) * 1.6, d = Math.hypot(x, z), az = (Math.atan2(x, -z) / D2R + 360) % 360;
      if (d < 3.2 || (d < 7 && az > 30 && az < 175) || Math.hypot(x - TREE.x, z - TREE.z) < 4.5) continue;
      if (az > 92 && az < 145) continue;                     // keep the view to the rising Moon open
      if (Math.hypot(x - HOUSE.x, z - HOUSE.z) < 11) continue;
      if (Math.hypot(x - KEPSPOT.x, z - KEPSPOT.z) < 2.5 || Math.hypot(x - BOOKSPOT.x, z - BOOKSPOT.z) < 2.5) continue;
      tree(x, z, 0.8 + r() * 0.35);
    }
    for (const [list, detail, seed] of [[near, 'mid', 4], [far, 'low', 9]]) if (list.length) { const g = grove(orchardTree, list, { detail, variants: 5, seed, apples: 6, height: 4.6, trunkExtra: 0.7 }); this.root.add(g.group); }   // height + trunkExtra: tall enough to read as trees, not bushes (Meem)
    // a wooden ladder against one tree and a basket of picked apples beside it
    const lt = this.trees[3] || TREE;
    k.box(0.06, 3.2, 0.06, 0x7a5a3a, [lt.x + 0.9, lt.y + 1.5, lt.z - 0.25], [0, 0, 0.3]); k.box(0.06, 3.2, 0.06, 0x7a5a3a, [lt.x + 0.9, lt.y + 1.5, lt.z + 0.25], [0, 0, 0.3]);
    for (let i = 0; i < 8; i++) k.box(0.05, 0.05, 0.5, 0x7a5a3a, [lt.x + 1.32 - i * 0.12, lt.y + 0.2 + i * 0.38, lt.z]);
    k.cyl(0.3, 0.22, 0.32, 10, 0x9a7440, [lt.x + 1.8, lt.y + 0.16, lt.z + 0.5]);
    for (let i = 0; i < 9; i++) ak.ball(0.05, 0, 0xc0281c, [lt.x + 1.8 + (r() - 0.5) * 0.35, lt.y + 0.33 + r() * 0.06, lt.z + 0.5 + (r() - 0.5) * 0.35]);
    // the orchard grass round you: tufts of longer grass, clover, buttercups and daisies, molehills
    // (kept clear of Newton's spot and where the apple lands)
    const GR = [0x4a6a2c, 0x5a7a34, 0x3e5a26, 0x6a8040, 0x7a8a46];
    for (let i = 0; i < 520; i++) {
      const a = r() * 6.28, d = 1.2 + Math.pow(r(), 0.7) * 17, x = Math.sin(a) * d, z = -Math.cos(a) * d;
      if (Math.hypot(x - SIT.x, z - SIT.z) < 1.7 || Math.hypot(x - APPLE0.x, z - APPLE0.z) < 0.9 || Math.hypot(x - BOOKSPOT.x, z - BOOKSPOT.z) < 1.4 || Math.hypot(x - TREE.x, z - TREE.z) < 0.5) continue;
      const y = groundHeight(x, z), col = GR[Math.floor(r() * GR.length)];
      for (let b = 0; b < 3; b++) { const h = 0.12 + r() * 0.16, ba = r() * 6.28; k.cyl(0.002, 0.018, h, 3, col, [x + Math.cos(ba) * 0.05, y + h / 2 - 0.01, z + Math.sin(ba) * 0.05], [(r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5]); }
      if (r() < 0.25) k.ball(0.014, 0, r() < 0.6 ? 0xe8d040 : 0xf2f0e8, [x + 0.08, y + 0.1 + r() * 0.06, z + 0.03]);
    }
    for (let i = 0; i < 3; i++) { const p = at(200 + i * 40, 9 + i * 3), y = groundHeight(p.x, p.z); k.ball(0.22, 1, 0x4a3a28, [p.x, y - 0.06, p.z], [r(), r(), 0], [1, 0.45, 1]); }
    // Newton's little pile of books on the grass beside him, and an open notebook
    k.box(0.22, 0.05, 0.3, 0x5a2a1a, [SIT.x + SIDE.x * 0.68, groundHeight(SIT.x, SIT.z) + 0.025, SIT.z + SIDE.z * 0.68], [0, 0.4, 0]);
    k.box(0.2, 0.05, 0.28, 0x2a3a2a, [SIT.x + SIDE.x * 0.68, groundHeight(SIT.x, SIT.z) + 0.075, SIT.z + SIDE.z * 0.68], [0, 0.7, 0]);
    k.box(0.36, 0.01, 0.26, 0xece0c0, [SIT.x + SIDE.x * 0.92 + TOWARD.x * 0.5, groundHeight(SIT.x, SIT.z) + 0.01, SIT.z + SIDE.z * 0.92 + TOWARD.z * 0.5], [0, 0.9, 0]);
    this.root.add(k.mesh());
    this.applesMesh = ak.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); this.root.add(this.applesMesh);
  }

  // Beyond the walls: hedgerows and oaks along the fields, woods on the far hills, and across the
  // valley Colsterworth: its church tower with pinnacles, cottages with lit windows.
  buildCountry() {
    const k = new Kit(), r = rng(37), wins = [], oaks = [];
    const hedge = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < len; d += 3.2) {
        const f = d / len, x = ax + (bx - ax) * f + (r() - 0.5), z = az + (bz - az) * f + (r() - 0.5), y = groundHeight(x, z);
        k.ball(1.6 + r() * 0.6, 0, [0x2e4422, 0x36502a, 0x283c1e][Math.floor(r() * 3)], [x, y + 1.2, z], [r(), r(), 0], [1, 0.85, 1]);
        if (r() < 0.04 && !(Math.abs((Math.atan2(x, -z) / D2R + 360) % 360 - 117) < 22)) oaks.push({ x, y: y - 0.1, z, s: 0.6 + r() * 0.4 });   // a hedgerow oak
      }
    };
    for (const [ax, az, bx, bz] of [[-260, 32, 120, 32], [120, -200, 120, 260], [-60, 120, 300, 120], [-260, -60, -40, -60], [-40, -260, -40, -40], [40, -120, 300, -120], [-200, 200, 120, 200], [200, -300, 200, 300], [-160, -260, -160, 120]]) hedge(ax, az, bx, bz);
    // woods on the hills all round
    const woods = [];
    for (let i = 0; i < 70; i++) {
      const a = r() * 360, d = 380 + r() * 700, p = at(a, d), y = groundHeight(p.x, p.z), h = 13 + r() * 8;
      if (a > 92 && a < 140 && d < 800) continue;
      woods.push({ x: p.x, y: y - 0.3, z: p.z, s: h / 12 * 1.3 });
    }
    // the hedgerow oaks, and the trees of the woods (far off: the simplest level of detail)
    for (const [list, shape, seed] of [[oaks, 'oak', 3], [woods, 'oak', 7]]) if (list.length) { const g = grove(deciduousTree, list, { detail: 'low', variants: 4, seed, shape }); this.root.add(g.group); }
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
    // his mother, Hannah, at the door with a lantern; later calling him in (Meem's model: bonnet, bodice, apron)
    this.hannah = add('hannah_newton', this.doorPos.clone().setY(groundHeight(this.doorPos.x, this.doorPos.z)), { tunic: 0x4a3a46, skin: 0xd8b49a, hair: 0x4a3a2a });
    this.hannah.g.rotation.y = this.houseYaw;
    this.hannahLamp = makeTorch({ len: 0.3, color: 0xffc070, size: 0.6 }); holdProp(this.hannah, this.hannahLamp, 'Right', [0, 0.02, 0.02]);
    this.hannah.routine = [{ x: this.doorPos.x, z: this.doorPos.z, pose: 'idle', secs: 14, look: this.nw.g.position.clone().setY(1) }, { x: this.doorPos.x + 3, z: this.doorPos.z + 2, pose: 'work', secs: 8 }, { x: this.doorPos.x - 2, z: this.doorPos.z + 3, pose: 'idle', secs: 6 }];
    // a shepherd bringing the flock in, and a farmhand forking hay onto the cart
    const sp = at(138, 36);   // (this side of the lane's hedge)
    this.shep = add('townsman', sp.setY(groundHeight(sp.x, sp.z)), { tunic: 0x5a5a3a, hair: 0x4a3a2a, beard: true, height: 1.7 });
    const staff = new Kit(); staff.cyl(0.02, 0.02, 1.6, 5, 0x5a4028, [0, 0.8, 0]); holdProp(this.shep, staff.mesh(), 'Right', [0, 0.05, 0.02]);
    this.shep.routine = [at(132, 40), at(110, 46), at(80, 40), at(60, 52), at(100, 58), at(118, 52)].map((p, i) => ({ x: p.x, z: p.z, pose: i % 3 === 2 ? 'beckon' : 'idle', secs: 4 + (i % 3) * 3, speed: 0.6 }));
    const hp = new THREE.Vector3(9.23, 0, -25.3);
    this.hand = add('townsman_1600', hp.setY(groundHeight(hp.x, hp.z)), { tunic: 0x6a5a40, hair: 0x2a1a10 });   // a farmhand in doublet and cap
    const fork = new Kit(); fork.cyl(0.018, 0.018, 1.5, 5, 0x6a4a2e, [0, 0.75, 0]); for (const ox of [-0.05, 0, 0.05]) fork.cyl(0.006, 0.006, 0.25, 4, 0x5a5a5a, [ox, 1.6, 0]); holdProp(this.hand, fork.mesh(), 'Right', [0, 0.05, 0.02]);
    // (he forks hay from the haystack by the manor's gable end and loads the cart, walking round the
    // front corner of the house both ways, never through it)
    this.hand.routine = [{ x: 9.23, z: -25.3, pose: 'work', secs: 12, face: -1.89 }, { x: 6.3, z: -20.4, pose: 'idle', secs: 3 }, { x: 8.84, z: -17.14, pose: 'work', secs: 8, face: -0.97 }, { x: 6.0, z: -21.2, pose: 'idle', secs: 3 }];
    for (const P of [this.hand]) for (const st of P.routine) { delete st.y; }
    this.people = [this.nw, this.hannah, this.shep, this.hand];
  }

  buildLife() {
    const L = this.life;
    this.sheep = L.add(makeHerd('sheep', { n: 16, area: { x: at(140, 48).x, z: at(140, 48).z, r: 9 }, height: groundHeight, mode: 'follow', seed: 7 }));
    this.sheepDog = L.add(makeHerd('dog', { n: 1, area: { x: 0, z: 40, r: 4 }, height: groundHeight, mode: 'follow', seed: 3, speed: 2.4 }));
    // the farm dog, asleep by Newton (it goes to sniff the apple)
    const dp = SIT.clone().addScaledVector(SIDE, -1.25).addScaledVector(TOWARD, 0.4);   // on his right, the side the apple falls (so it never crosses his legs)
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
    this.apple = makeApple(this.heroTree.reserved[0]?.r ?? 0.045, 0xb8261a);   // the same apple as the ones on the tree
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
    this.centreLab = label("toward the middle of the Earth", 0.13); this.centreLab.material.opacity = 0; this.centreLab.material.depthTest = false; this.root.add(this.centreLab);
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
    // (a big quarto, lying open: calf boards, a rounded spine, two thick blocks of pages with lines of
    // Latin and a diagram of an orbit, and a ribbon)
    const bk = new Kit(), CALF = 0x5a3018, PAGE = 0xeee2c4, INKC = 0x8a7a64;
    for (const sx of [-1, 1]) {
      bk.box(0.205, 0.008, 0.3, CALF, [sx * 0.104, 0.004, 0], [0, 0, sx * 0.04]);
      bk.box(0.19, 0.026, 0.28, PAGE, [sx * 0.1, 0.021, 0], [0, 0, sx * 0.04]);
      bk.box(0.18, 0.006, 0.27, 0xf6ecd4, [sx * 0.098, 0.035, 0], [0, 0, sx * 0.07]);      // the top leaf, curling up from the gutter
      for (let i = 0; i < 11; i++) { if (sx > 0 && i > 2 && i < 8) continue; bk.box(0.14 - (i % 3) * 0.02, 0.0015, 0.0032, INKC, [sx * (0.1 - (i % 3) * 0.01), 0.0415 - (i % 3) * 0.0007, 0.11 - i * 0.022], [0, 0, sx * 0.07]); }
    }
    bk.cyl(0.012, 0.012, 0.3, 8, CALF, [0, 0.006, 0], [Math.PI / 2, 0, 0]);
    bk.box(0.008, 0.002, 0.2, 0x8a1a1a, [0.004, 0.039, 0.16], [0.3, 0, 0]);
    // the diagram on the right-hand page: an orbit round a dot
    for (let j = 0; j < 14; j++) { const a = j / 14 * 6.28; bk.box(0.012, 0.0015, 0.005, INKC, [0.1 + Math.cos(a) * 0.045, 0.0415 + 0.07 * Math.cos(a) * 0.045, Math.sin(a) * 0.035], [0, -a, 0.07]); }
    bk.ball(0.006, 0, INKC, [0.088, 0.041, 0]);
    this.principia = bk.mesh(); this.principia.visible = false;
    // ...lying open on a little garden table, by a candle lantern
    const tk = new Kit(), tdir = BOOKSPOT.clone().negate().normalize(), tp = BOOKSPOT.clone().addScaledVector(tdir, 0.62);
    // an oak side table: a thick top, a frieze rail, turned legs on a low stretcher frame
    const OAK = 0x6a4a2e, OAK2 = 0x553a22, IRON = 0x1e1c1a;
    tk.box(0.86, 0.045, 0.6, OAK, [0, 0.785, 0]); tk.box(0.84, 0.02, 0.58, OAK2, [0, 0.755, 0]);
    for (const sz of [-1, 1]) tk.box(0.72, 0.09, 0.03, OAK2, [0, 0.695, sz * 0.235]);
    for (const sx of [-1, 1]) tk.box(0.03, 0.09, 0.44, OAK2, [sx * 0.345, 0.695, 0]);
    for (const [ox, oz] of [[-0.34, -0.23], [0.34, -0.23], [-0.34, 0.23], [0.34, 0.23]]) {
      tk.box(0.055, 0.12, 0.055, OAK2, [ox, 0.69, oz]);                              // the square top of the leg
      tk.cyl(0.022, 0.028, 0.18, 8, OAK, [ox, 0.54, oz]); tk.ball(0.038, 1, OAK, [ox, 0.42, oz], 0, [1, 1.5, 1]);   // the turned bulb
      tk.cyl(0.028, 0.022, 0.2, 8, OAK, [ox, 0.27, oz]); tk.box(0.05, 0.12, 0.05, OAK2, [ox, 0.08, oz]);          // and the foot
    }
    for (const sz of [-1, 1]) tk.box(0.66, 0.04, 0.03, OAK2, [0, 0.08, sz * 0.23]);
    tk.box(0.03, 0.04, 0.44, OAK2, [0, 0.08, 0]);
    // on it: a candle lantern, an inkwell and quill, loose sheets of calculation, two small books
    const LX = 0.28, LZ = -0.14, LY = 0.81;
    tk.box(0.13, 0.02, 0.13, IRON, [LX, LY + 0.01, LZ]); tk.cyl(0.001, 0.1, 0.07, 4, IRON, [LX, LY + 0.25, LZ], [0, Math.PI / 4, 0]); tk.cyl(0.012, 0.012, 0.04, 6, IRON, [LX, LY + 0.3, LZ]);
    for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) tk.box(0.012, 0.2, 0.012, IRON, [LX + ox * 0.058, LY + 0.12, LZ + oz * 0.058]);
    tk.cyl(0.015, 0.015, 0.08, 8, 0xf2ead2, [LX, LY + 0.06, LZ]);
    tk.cyl(0.03, 0.035, 0.045, 8, 0x1c1c22, [-0.3, LY + 0.022, -0.17]);
    tk.box(0.004, 0.004, 0.26, 0xf0ece0, [-0.27, LY + 0.1, -0.12], [0.9, 0.5, 0]);
    tk.box(0.02, 0.002, 0.15, 0xf0ece0, [-0.25, LY + 0.17, -0.07], [0.9, 0.5, 0]);
    for (let i = 0; i < 4; i++) tk.box(0.2, 0.003, 0.27, i % 2 ? 0xe8dcc0 : 0xf0e6cc, [0.12 + i * 0.03, LY + 0.002 + i * 0.004, 0.12 - i * 0.02], [0, 0.3 - i * 0.35, 0]);
    tk.box(0.12, 0.035, 0.17, 0x5a2a1a, [-0.32, LY + 0.018, 0.17], [0, 0.2, 0]); tk.box(0.11, 0.03, 0.16, 0x2a3a2a, [-0.31, LY + 0.05, 0.17], [0, 0.5, 0]);
    this.table = tk.mesh(); this.table.position.set(tp.x, groundHeight(tp.x, tp.z), tp.z); this.table.rotation.y = Math.atan2(tdir.x, tdir.z); this.root.add(this.table);
    this.table.add(this.principia); this.principia.position.set(-0.06, 0.808, 0.03); this.principia.rotation.y = 0.12;
    this.tableLamp = glow(0xffb050, 0.35, 0.9); this.tableLamp.position.set(0.28, 0.88, -0.14); this.table.add(this.tableLamp);
    this.table.visible = false;
    this.bookGlow = glow(0xffd890, 0.8, 0); this.principia.add(this.bookGlow);
    this.bookLab = label('Principia, 1687', 0.16); this.bookLab.material.opacity = 0; this.root.add(this.bookLab);
    this.bookSparks = glowPoints(70, { sizeScale: 260 }); this.bookSparks.visible = false; this.root.add(this.bookSparks);
    this.bs = Array.from({ length: 70 }, () => ({ a: Math.random() * 6.28, y: Math.random() * 3, r: 0.1 + Math.random() * 0.3, v: 0.4 + Math.random() * 0.8 }));
    // ch12_10: a satellite: a steady little star creeping across the sky (and its speed)
    this.sat = glow(0xf4f8ff, 9, 0); this.root.add(this.sat);
    this.satTrail = glowPoints(50, { sizeScale: 1800 }); this.satTrail.visible = false; this.root.add(this.satTrail);
    this.satLab = label('8 kilometres every second', 0.32); this.satLab.material.opacity = 0; this.root.add(this.satLab);
  }

  // ---------- The cannon on the little Earth (shown in space) ----------
  buildCannon() {
    const G = this.G, sp = this.space = new Space(G, { earthR: ER });
    // everything in the plane of the orbits: x along the cannon's aim, y up through the mountain
    const C = this.cg = new THREE.Group(); sp.group.add(C);
    const mtnNoise = (ux, uz, f) => ((Math.abs(N2(ux * 1.7 + 3, uz * 1.7 + f * 1.3) - 0.5) * 2 - 0.45) * 0.42 + (N1(ux * 5 + f * 4, uz * 5 - f * 3) - 0.5) * 0.16) * (1 - f * 0.5) * clamp01((0.965 - f) * 12);
    // the impossibly tall mountain (over England): concave flanks cut by ridges and gullies, green
    // foothills, bare rock, snow fields above, and a small flat summit for the cannon
    const mg = new THREE.CylinderGeometry(0.2, 0.8, 1.45, 44, 18).toNonIndexed(), mp = mg.attributes.position, mc = new Float32Array(mp.count * 3), col = new THREE.Color();
    const GRASS = new THREE.Color(0x4a6a32), GRASS2 = new THREE.Color(0x5e7a3a), ROCK = new THREE.Color(0x7a7060), ROCK2 = new THREE.Color(0x5a5248), SNOW = new THREE.Color(0xeef2f6);
    for (let i = 0; i < mp.count; i++) {
      const x = mp.getX(i), y = mp.getY(i), z = mp.getZ(i), f = clamp01((y + 0.725) / 1.45), rr = Math.hypot(x, z);
      const ux = rr > 1e-4 ? x / rr : 0, uz = rr > 1e-4 ? z / rr : 0;
      // the profile (wide foothills, steepening to the summit), then ridges and gullies
      const r0 = 0.8 - 0.6 * f, R = 0.15 + 0.73 * Math.pow(1 - f, 1.25);
      const n = mtnNoise(ux, uz, f);
      const k = rr > 1e-4 ? (R / r0) * (1 + n) : 1; mp.setX(i, x * k); mp.setZ(i, z * k);
      const snowLine = 0.6 + (N2(ux * 3 + 9, uz * 3) - 0.5) * 0.25 - n * 0.6;
      if (f < 0.2 + (N1(ux * 3, uz * 3) - 0.5) * 0.1) col.copy(GRASS).lerp(GRASS2, N1(ux * 6, uz * 6 + f * 8));
      else if (f < snowLine || f > 0.97) col.copy(ROCK).lerp(ROCK2, clamp01(0.5 - n * 2.5 + (N1(ux * 7, f * 9) - 0.5)));
      else col.copy(SNOW).lerp(ROCK, clamp01(n * 2.5));
      mc.set([col.r, col.g, col.b], i * 3);
    }
    mg.setAttribute('color', new THREE.BufferAttribute(mc, 3)); mg.computeVertexNormals();
    this.mountain = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, fog: false }));
    this.mountain.position.y = ER - 0.4 + 0.725; C.add(this.mountain);
    // dark pine forests on its lower slopes (they grow with it)
    { const rr = rng(77), spots = [];
      for (let i = 0; i < 40; i++) { const f = 0.03 + rr() * 0.3, a = rr() * 6.283, R = (0.15 + 0.73 * Math.pow(1 - f, 1.25)) * (1 + mtnNoise(Math.cos(a), Math.sin(a), f)) - 0.012; spots.push({ x: Math.cos(a) * R, y: -0.725 + f * 1.45 - 0.01, z: Math.sin(a) * R, s: 0.008 + rr() * 0.006 }); }
      const g = grove(conifer, spots, { detail: 'low', variants: 3, seed: 5, type: 'pine' }); this.mountain.add(g.group); }
    // the cannon: a long iron barrel on a wooden carriage, aimed level along +x
    const ck = new Kit(), top = ER + MT;
    // (an iron barrel with reinforcing rings, a muzzle swell and a knob at the breech, on an oak
    // carriage: stepped side cheeks, two axles, four little wheels)
    const IRN = 0x2a2a2e, OAKC = 0x6a4a2e, OAKD = 0x4a3420, Z = [0, 0, -Math.PI / 2];
    ck.cyl(0.021, 0.029, 0.26, 14, IRN, [0.06, 0.06, 0], Z);
    for (const [x, rr] of [[-0.055, 0.032], [-0.005, 0.03], [0.07, 0.027]]) ck.cyl(rr, rr, 0.012, 14, 0x34343a, [x, 0.06, 0], Z);
    ck.cyl(0.025, 0.023, 0.025, 14, 0x34343a, [0.18, 0.06, 0], Z);
    ck.ball(0.029, 1, IRN, [-0.07, 0.06, 0]); ck.ball(0.011, 1, IRN, [-0.1, 0.06, 0]);
    for (const sz of [-1, 1]) {
      ck.box(0.17, 0.034, 0.012, OAKC, [0.0, 0.04, sz * 0.033]);
      ck.box(0.07, 0.022, 0.012, OAKC, [-0.06, 0.068, sz * 0.033]);
      ck.box(0.012, 0.012, 0.014, 0x1e1e20, [0.02, 0.06, sz * 0.033]);           // the trunnion cap
    }
    ck.box(0.16, 0.012, 0.06, OAKD, [0.0, 0.022, 0]);
    for (const x of [-0.055, 0.06]) {
      ck.box(0.016, 0.014, 0.1, OAKD, [x, 0.018, 0]);
      for (const sz of [-1, 1]) ck.cyl(0.018, 0.018, 0.01, 12, OAKD, [x, 0.018, sz * 0.048], [Math.PI / 2, 0, 0]);
    }
    this.cannon = ck.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.3, fog: false }));
    this.cannon.position.set(0, top, 0); C.add(this.cannon);
    this.muzzle = new THREE.Vector3(0.2, top + 0.06, 0);
    this.flash = glow(0xffc070, 0.6, 0); this.flash.position.copy(this.muzzle); C.add(this.flash);
    // a tiny Newton beside it (the same model, very small)
    this.tiny = makePerson({ model: 'newton', seed: 4, tunic: 0x3a3a44, hair: 0x6a4a2a, height: 1.72 });
    this.tiny.g.scale.setScalar(0.13); this.tiny.g.position.set(-0.11, top - 0.003, 0.055); this.tiny.g.rotation.y = Math.PI / 2; C.add(this.tiny.g);
    // the cannonballs, their glowing trails, the dust where they land, the lines of pull
    this.balls = SPEEDS.map(() => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false })), glow(0xffd890, 0.6, 1)); g.visible = false; C.add(g); return g; });
    this.trails = glowPoints(2600, { sizeScale: 1000 }); C.add(this.trails);
    this.puffs = glowPoints(160, { sizeScale: 900 }); C.add(this.puffs); this.pf = [];
    this.paths = SPEEDS.map((k) => simulate(k * VC));
    this.shotLabs = ['slow', 'faster', 'really fast'].map((t) => { const l = label(t, 0.42); l.material.opacity = 0; C.add(l); return l; });
    this.orbitLab = label('An orbit!', 0.4); this.orbitLab.material.opacity = 0; C.add(this.orbitLab);
    this.gravLab = label('GRAVITY', 1.1, { bold: true, color: '#ffe8b0' }); this.gravLab.material.opacity = 0; C.add(this.gravLab);
    this.moonLab = label('the Moon, falling too', 0.3); this.moonLab.material.opacity = 0; C.add(this.moonLab);
    // far off: a little Sun with planets going round it
    this.mini = new THREE.Group(); this.mini.scale.setScalar(1.8); sp.group.add(this.mini);
    this.miniSun = glow(0xffc050, 2.2, 0); this.mini.add(this.miniSun);
    this.miniPts = glowPoints(420, { sizeScale: 700 }); this.mini.add(this.miniPts);
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
    this.shotN = 0; this.shotT = 0; this.orbA = 0; this.loops = 0; this.moonA = -0.9;
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
      if (ready !== this.guideLever) { this.guideLever = ready; if (ready) { this.knobGlow.getWorldPosition(_a); G.guide.flyTo(_a.add(_b.set(0, 0.25, 0)).clone()); G.guide.chime(); } else G.guide.flyTo(this.astraSpot.clone()); this.guideAt = null; }
    } else guideUpdate(this, busy);
  }

  updatePeople(dt, t, sun) {
    const s = this.s, N = this.nw;
    // Newton: reading under the tree; looking at the apple; up on his feet, the apple held up to the
    // Moon; at the table with the Principia. With Meem's rigged model he sits on the grass with his
    // back to the trunk, gets up through a crouch and steps clear of the tree before he stands; a model
    // without a rig stands by the trunk and acts with his whole body (turning, leaning, looking up).
    const rigged = !!N.rig, statue = !!N.model && !rigged;
    const sitting = s.nw === 'read' || s.nw === 'look';
    N.sitK = Math.max(0, N.sitK - dt * 0.7 * (sitting ? -1 : 1)); N.sitK = Math.min(1, N.sitK);   // about a second and a half to get up
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
    // standing up, he steps forward off the trunk he was leaning on
    if (!this.atBook && rigged) { const f = 0.42 * (1 - ease(N.sitK)); N.g.position.set(SIT.x + TOWARD.x * f, 0, SIT.z + TOWARD.z * f); this.nwBlk.x = N.g.position.x; this.nwBlk.z = N.g.position.z; }
    animatePerson(N, t, dt);
    const hipH = sitLegs(N, N.sitK, N.hipY ?? 0.9);
    N.g.position.y = groundHeight(N.g.position.x, N.g.position.z) - Math.max(0, (N.hipY ?? 0.9) - hipH);
    if (statue) { this.nwLean = damp(this.nwLean || 0, lean, 2, dt); N.inner.rotation.x = this.nwLean; }
    // Hannah at the door; at moonrise she calls him in (he doesn't come)
    const H = this.hannah;
    if (s.phase === 'moon') { walkToward(H, this.doorPos.x, this.doorPos.z, dt, { height: groundHeight }); H.pose = 'beckon'; H.look = N.g.position.clone().setY(1.4); }
    else runRoutine(H, dt, { height: groundHeight });
    animatePerson(H, t, dt); this.hannahLamp.userData.flicker(t);
    runRoutine(this.shep, dt, { height: groundHeight }); animatePerson(this.shep, t, dt);
    this.sheep.lead.copy(this.shep.g.position).addScaledVector(_a.set(Math.sin(this.shep.g.rotation.y), 0, Math.cos(this.shep.g.rotation.y)), -4);
    this.sheepDog.lead.copy(this.shep.g.position).add(_a.set(Math.sin(t * 0.3) * 6, 0, Math.cos(t * 0.23) * 5));
    // the flock (and his dog) step aside for the shepherd when he turns back through them
    { const sx = this.shep.g.position.x, sz = this.shep.g.position.z;
      for (const o of [...this.sheep.animals, ...this.sheepDog.animals]) {
        const dx = o.x - sx, dz = o.z - sz, d = Math.hypot(dx, dz) || 1e-3;
        if (d < 1.2) { o.x = sx + dx / d * 1.2; o.z = sz + dz / d * 1.2; }
        if (Math.hypot(o.tx - sx, o.tz - sz) < 1.6) { o.tx = sx + dx / d * 2.4; o.tz = sz + dz / d * 2.4; }
      } }
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
        this.dog.lead.copy(A.position).addScaledVector(TOWARD, 0.3).addScaledVector(SIDE, -0.35); this.dogBack = 7; this.bark(A.position, 0.6);
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
      for (let i = 0; i < 90; i++) { const f = ((i / 90) + t * 0.18) % 1, d = f * f * 7; P.pos.set([_a.x, _a.y - 0.1 - d, _a.z], i * 3); const b = k2 * (1 - f) * 0.9; P.col.set([b, b * 0.85, b * 0.55], i * 3); P.size[i] = 0.05 + f * 0.1; }
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
    this.table.localToWorld(this.bookLab.position.set(0.95, 1.2, 0.1));   // beside the table, clear of Newton
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
    if (this.satTrail.visible) { const P = this.satTrail.userData; for (let i = 0; i < 50; i++) { const ff = Math.max(0, f - i * 0.0012), q = _b.copy(_c).addScaledVector(dirFromAzEl(215 + ff * 190, 18 + Math.sin(ff * Math.PI) * 58, _d), 420); P.pos.set([q.x, q.y, q.z], i * 3); const b = i ? 0.45 * (1 - i / 50) : 1.6; P.col.set([b * 0.85, b * 0.92, b], i * 3); P.size[i] = i ? 0.9 : 4.5; } P.commit(); }
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
    if (on) this.layoutSpace(); else { this.space.exit(); G.sky.uni.milky.value = 1; G.guide.follow(); this.guideLever = null; }
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
    this.mini.position.copy(cam).addScaledVector(f, 10).addScaledVector(r, -11).add(_a.set(0, 4, 0));
    this.lever.position.copy(cam).addScaledVector(f, 0.42).addScaledVector(r, 0.4).add(_a.set(0, -0.72, 0));
    this.lever.rotation.y = Math.atan2(r.x, r.z);
    this.astraSpot = cam.clone().addScaledVector(f, 1.7).addScaledVector(r, -1.0).add(_a.set(0, 0.15, 0));   // off to the left, clear of the mountain and the shots
    this.guideLever = null;
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
        for (let j = 0; j < 90; j++) { const a = j / 90 * Math.PI * 2; P.pos.set([Math.cos(a) * R, 0, Math.sin(a) * R], m * 3); P.col.set([0.3 * k, 0.3 * k, 0.4 * k], m * 3); P.size[m] = 0.02; m++; }
        const a = t * w * fast * 3 + i * 1.7; P.pos.set([Math.cos(a) * R, 0, Math.sin(a) * R], m * 3); P.col.set([col.r * k, col.g * k, col.b * k], m * 3); P.size[m] = 0.16; m++;
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

// ---------- The manor's masonry ----------
// Dressed limestone blocks laid in courses over one face of the house (the wall behind shows through
// the joints as mortar). face: the face's outward angle in the house's own frame (0 = front, +z);
// (cx, cz) its middle; w wide, h to the eaves, plus a gable triangle gh high; holes: [u0, u1, v0, v1].
const ASHLAR = [0xcfc2a0, 0xc6b896, 0xd6caa8, 0xbfb290, 0xd0c09a, 0xc8bea4];
function ashlar(k, r, P, yaw, face, cx, cz, w, h, gh, holes, margin = 0.66, v0 = 0.52) {
  const tx = Math.cos(face), tz = -Math.sin(face), nx = Math.sin(face), nz = Math.cos(face), R = [0, yaw + face, 0];
  const all = holes;
  let v = v0;
  while (v < h + gh - 0.3) {
    if (v < 3.23 && v + 0.33 > 2.97 && h > 4) { v = 3.23; continue; }     // the string course
    const rh = 0.26 + r() * 0.09, vm = v + rh / 2;
    const hw = vm < h ? w / 2 - margin : (w / 2) * (1 - (v + rh - h) / gh) - 0.3;
    if (hw < 0.2) break;
    // the row's free stretches between the windows
    let segs = [[-hw, hw]];
    for (const [u0, u1, v0, v1] of all) {
      if (v1 < v || v0 > v + rh) continue;
      segs = segs.flatMap(([a, b]) => (u1 <= a || u0 >= b ? [[a, b]] : [[a, u0], [u1, b]].filter(([p, q]) => q - p > 0.12)));
    }
    for (const [a, b] of segs) {
      for (let u = a + r() * 0.05; u < b - 0.1;) {
        const bl = Math.min(b - u, 0.36 + r() * 0.5), out = 0.012 + r() * 0.02 - 0.03, um = u + bl / 2;
        const col = new THREE.Color(ASHLAR[Math.floor(r() * ASHLAR.length)]).multiplyScalar(0.93 + r() * 0.12).getHex();
        k.box(bl - 0.025, rh - 0.025, 0.06, col, P(cx + tx * um + nx * out, vm, cz + tz * um + nz * out), R);
        u += bl;
      }
    }
    v += rh;
  }
}
// Quoins: big long-and-short stones up a corner, proud of both faces
function quoins(k, r, P, yaw, cx, cz, sx, sz, h, v0 = 0.5, L = 0.62, S = 0.36) {
  let v = v0, i = 0;
  while (v < h - 0.15) {
    if (h > 4 && v < 3.23 && v + 0.34 > 2.97) { v = 3.23; continue; }
    const rh = Math.min(0.34, h - v), dx = i % 2 ? S : L, dz = i % 2 ? L : S;
    const col = new THREE.Color(ASHLAR[Math.floor(r() * ASHLAR.length)]).multiplyScalar(1.02 + r() * 0.06).getHex();
    k.box(dx, rh - 0.022, dz, col, P(cx - sx * dx / 2 + sx * 0.04, v + rh / 2, cz - sz * dz / 2 + sz * 0.04), [0, yaw, 0]);
    v += rh; i++;
  }
}

// ---------- The orchard's dry-stone wall ----------
// Lincolnshire limestone, laid dry: a dark hearting (the core, seen between the stones), two faces of
// coursed stones that lean in as the wall rises (the batter), through-stones tying the faces, and a
// row of upright coping stones on top. a/b: how each end finishes: 'corner', 'post' or 'end'.
const WALL_H = 1.06, WALL_COURSES = [0.25, 0.22, 0.2, 0.2, 0.19];
const WALL_STONE = [0xa39b88, 0x958e7c, 0xb0a892, 0x8a8474, 0x9c9684, 0xaaa08a, 0x8e8a76, 0x9a9a84];
const wallHalf = (y) => 0.33 - 0.13 * clamp(y / WALL_H, 0, 1);
const pickStone = (r, shade = 1) => { const c = new THREE.Color(WALL_STONE[Math.floor(r() * WALL_STONE.length)]).multiplyScalar(shade * (0.9 + r() * 0.18)); return c.getHex(); };
function dryWall(k, r, ax, az, bx, bz, { a = 'end', b = 'end' } = {}) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux, yw = Math.atan2(-uz, ux);
  const ins = { corner: 0.42, post: 0.27, end: 0 }, s0 = ins[a], s1 = L - ins[b];
  const px = (d, o) => ax + ux * d + nx * o, pz = (d, o) => az + uz * d + nz * o, gy = (d) => groundHeight(px(d, 0), pz(d, 0));
  // the hearting, in short lengths so it follows the ground
  const nCore = Math.ceil((s1 - s0) / 2), cl = (s1 - s0) / nCore;
  for (let i = 0; i < nCore; i++) {
    const g = new THREE.BoxGeometry(cl, WALL_H + 0.15, 1), p = g.attributes.position;
    for (let j = 0; j < p.count; j++) p.setZ(j, p.getZ(j) * 2 * (p.getY(j) > 0 ? wallHalf(WALL_H) - 0.02 : wallHalf(0) - 0.02));
    const dm = s0 + (i + 0.5) * cl;
    k.add(g, 0x4e4a42, [px(dm, 0), gy(dm) + (WALL_H + 0.15) / 2 - 0.15, pz(dm, 0)], [0, yw, 0]);
  }
  // the two faces, course by course
  for (const side of [-1, 1]) {
    let y = 0;
    WALL_COURSES.forEach((ch, c) => {
      let d = s0 + r() * 0.15;
      if (d > s0 + 0.02) { const l = d - s0 - 0.02, dm = s0 + l / 2; if (l > 0.05) k.box(l, ch - 0.03, 0.14, pickStone(r), [px(dm, side * (wallHalf(y + ch / 2) - 0.05)), gy(dm) + y + ch / 2, pz(dm, side * (wallHalf(y + ch / 2) - 0.05))], [0, yw, 0]); }
      while (d < s1 - 0.06) {
        const sl = (0.24 + r() * 0.36) * (1.25 - c * 0.08), e = Math.min(s1, d + sl), len = e - d - 0.018 - r() * 0.015;
        if (len < 0.06) break;
        const sh = ch - 0.02 - r() * 0.035, ym = y + ch / 2 + (r() - 0.5) * 0.012, dm = d + len / 2, proud = 0.012 + r() * 0.03, off = side * (wallHalf(ym) + proud - 0.07);
        k.box(len, sh, 0.14, pickStone(r), [px(dm, off), gy(dm) + ym, pz(dm, off)], [0, yw + (r() - 0.5) * 0.05, (r() - 0.5) * 0.07]);
        d = e;
      }
      y += ch;
    });
  }
  // through-stones: long flat stones right through the wall, sticking out a little on both faces
  for (let d = s0 + 0.6 + r() * 0.4; d < s1 - 0.4; d += 1.1 + r() * 0.5) {
    const ym = WALL_COURSES[0] + WALL_COURSES[1] + WALL_COURSES[2] + 0.005;
    k.box(0.26 + r() * 0.1, 0.075, wallHalf(ym) * 2 + 0.16, pickStone(r, 0.95), [px(d, 0), gy(d) + ym, pz(d, 0)], [0, yw + (r() - 0.5) * 0.08, 0]);
  }
  // the coping: a row of stones set on edge
  for (let d = s0 + 0.02; d < s1 - 0.05;) {
    const t = 0.07 + r() * 0.05, hh = 0.2 + r() * 0.13, w = wallHalf(WALL_H) * 2 + 0.04 + r() * 0.05, dm = d + t / 2;
    k.box(t, hh, w, pickStone(r, 0.92), [px(dm, 0), gy(dm) + WALL_H + hh / 2 - 0.04, pz(dm, 0)], [0, yw + (r() - 0.5) * 0.12, (r() - 0.5) * 0.16]);
    d += t + 0.01 + r() * 0.012;
  }
  // a finished wall end: big tie stones laid across the wall, alternating, and a capstone
  for (const [kind, de, dir] of [[a, s0, 1], [b, s1, -1]]) {
    if (kind !== 'end') continue;
    let y = 0;
    WALL_COURSES.forEach((ch, c) => {
      const l = c % 2 ? 0.32 : 0.48, dm = de + dir * l / 2, wd = wallHalf(y + ch / 2) * 2 + 0.07;
      k.box(l, ch - 0.02, wd, pickStone(r, 1.04), [px(dm, 0), gy(de) + y + ch / 2, pz(dm, 0)], [0, yw, (r() - 0.5) * 0.04]);
      y += ch;
    });
    k.box(0.5, 0.16, wallHalf(WALL_H) * 2 + 0.12, pickStone(r, 0.96), [px(de + dir * 0.25, 0), gy(de) + WALL_H + 0.08, pz(de + dir * 0.25, 0)], [0, yw, 0]);
  }
}
// The corner where two walls meet: big quoin stones laid alternately one way and the other
function wallCorner(k, r, x, z) {
  const gy = groundHeight(x, z); let y = 0;
  WALL_COURSES.forEach((ch, c) => {
    const w = wallHalf(y + ch / 2) * 2 + 0.1, l = w + 0.28;
    k.box(c % 2 ? w : l, ch - 0.02, c % 2 ? l : w, pickStone(r, 1.04), [x + (c % 2 ? 0 : 0.06), gy + y + ch / 2, z + (c % 2 ? 0.06 : 0)], [0, (r() - 0.5) * 0.05, 0]);
    y += ch;
  });
  k.box(0.62, 0.2, 0.62, pickStone(r, 0.94), [x, gy + WALL_H + 0.1, z], [0, 0.1, 0]);
}
// A square stone gatepost: stacked blocks and a weathered capstone, with iron hinge pins
function gatePost(k, r, x, z) {
  const gy = groundHeight(x, z) - 0.1; let y = 0;
  for (const h of [0.42, 0.36, 0.34, 0.3, 0.26]) { const w = 0.46 - y * 0.03; k.box(w, h - 0.015, w, pickStone(r, 1.08), [x, gy + y + h / 2, z], [0, (r() - 0.5) * 0.06, 0]); y += h; }
  k.box(0.56, 0.1, 0.56, pickStone(r, 0.95), [x, gy + y + 0.05, z]);
  k.cyl(0.001, 0.26, 0.16, 4, pickStone(r, 0.9), [x, gy + y + 0.18, z], [0, Math.PI / 4, 0]);
}
// A five-bar field gate in weathered oak: hinged at (hx, hz), swung to `yaw` (its length runs along
// the local x axis), with a diagonal brace, iron hinge straps and a latch
function fiveBarGate(k, hx, hz, yaw, len) {
  const c = Math.cos(yaw), s = Math.sin(yaw), gy = groundHeight(hx, hz) + 0.1;
  const P = (lx, ly, lz) => [hx + lx * c + lz * s, gy + ly, hz - lx * s + lz * c], R = [0, yaw, 0];
  const OAK = 0x8c7a60, OAK2 = 0x75644e, IRON = 0x2a2826;
  k.box(0.11, 1.26, 0.1, OAK2, P(0.06, 0.6, 0), R);                     // the heel (hinge) stile
  k.box(0.08, 1.12, 0.07, OAK2, P(len - 0.05, 0.56, 0), R);             // the head stile
  k.box(len, 0.1, 0.075, OAK, P(len / 2, 1.13, 0), R);                  // the heavy top rail
  for (const y of [0.1, 0.3, 0.52, 0.78]) k.box(len - 0.06, 0.075, 0.04, OAK, P(len / 2, y, 0), R);
  // the brace, from the foot of the heel up toward the middle of the top rail
  const bx0 = 0.12, by0 = 0.12, bx1 = len * 0.55, by1 = 1.08, bl = Math.hypot(bx1 - bx0, by1 - by0);
  k.box(bl, 0.07, 0.035, OAK2, P((bx0 + bx1) / 2, (by0 + by1) / 2, 0.058), [0, yaw, Math.atan2(by1 - by0, bx1 - bx0)]);
  // a short upright in the middle
  k.box(0.06, 1.0, 0.035, OAK2, P(len * 0.55, 0.6, -0.058), R);
  // iron hinge straps and the latch
  for (const y of [0.3, 1.13]) { k.box(0.55, 0.035, 0.012, IRON, P(0.32, y, 0.05), R); k.cyl(0.02, 0.02, 0.12, 6, IRON, P(-0.02, y, 0), R); }
  k.box(0.16, 0.03, 0.02, IRON, P(len + 0.03, 0.95, 0.045), R);
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
