// Era 2, Chapter 1 (n 8): Copernicus moves the Sun. Frombork, Poland, an autumn night around 1540.
//
// You stand on top of a brick tower in the corner of the cathedral's walls, high on its hill: the
// great red-brick cathedral with its stepped gables and slender turrets behind you, the little town
// below, and beyond it the Vistula Lagoon, silver under a thin Moon. Nicolaus Copernicus works at his
// desk under a wooden lean-to, with his instruments (a triquetrum, a quadrant) beside him.
//
// The story: Aristarchus's old question; the sky as Ptolemy drew it, floating over the lagoon as a
// glowing model, circles on circles; you take the Sun and put it in the middle, and the tangle of
// loops unwinds, live, into neat circles (the very same motions, seen from the Sun instead of the
// Earth); Mars's backward loop turns out to be the Earth overtaking it; the whole sky turns because
// the Earth spins; thirty years of quiet work; the printed book arrives in 1543; and its famous
// diagram rises into the stars.
//
// The model is real geometry: each planet goes round the Sun on a circle with its true period. Seen
// from the Earth (subtract the Earth's position) those same circles become Ptolemy's loops. Radii
// are squeezed so Saturn fits (the loops still come out, just as they do in the real sky).
// World axes: -Z north, +X east, +Y up. The tower top is at y = TOP; the lagoon lies to the north.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, walkToward, holdProp, dropProp } from '../people.js';
import { makeHerd, makeFlock, makeSmoke, makeTorch, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2, roughStone } from '../shapes.js';
import { glowPoints } from '../wow/fx.js';
import { grove, deciduousTree, bareTree, conifer } from '../trees.js';
import { D2R, ease, clamp01, at, sunAt, house, windows, steppedGable, gableRoof, glow, label, Journal, INK, guideUpdate } from '../era2/common.js';

const LAT = 54.36, YEAR = 1540, SUNLON = 215;     // Frombork, early November
const TOP = 14;                                    // the tower's top floor, metres above the hilltop
const HALF = 3;                                    // the tower is 6 x 6 m
const ORR = new THREE.Vector3(0, TOP + 3.3, -10); // where the sky model floats, out over the hillside
const TILT = 30;                                   // ...tipped toward you so you see into it (degrees)
const N1 = noise2(81), N2 = noise2(83);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();

// ---------- Brick and roof-tile surfaces ----------
// Kit meshes carry only positions and colours, so the bricks are drawn by the shader from the
// world position: courses of big medieval bricks (30 x 10 cm) in running bond, with mortar joints
// and a little colour from brick to brick (a few over-burnt, darker). Roof tiles the same way: rows
// of rounded clay tiles, each row shadowed by the lip of the one above. Far off, the pattern fades
// to its average colour so it never shimmers.
const SURF_GLSL = `
varying vec3 vSW; varying vec3 vSN;
float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`;
const SURF = {
  brick: `
    vec3 n = abs(vSN);
    vec2 uv = (n.y > 0.75 ? vSW.xz : (n.x > n.z ? vec2(vSW.z, vSW.y) : vec2(vSW.x, vSW.y))) / vec2(0.30, 0.10);
    vec2 fw = fwidth(uv);   // (before the half-brick offset, which jumps between rows)
    float row = floor(uv.y); uv.x += fract(row * 0.5);
    vec2 id = vec2(floor(uv.x), row), f = fract(uv), d = min(f, 1.0 - f);
    vec2 mw = vec2(0.011 / 0.30, 0.011 / 0.10);
    float b = smoothstep(mw.x - fw.x, mw.x + fw.x, d.x) * smoothstep(mw.y - fw.y, mw.y + fw.y, d.y);
    float h = sHash(id), h2 = sHash(id + 17.31);
    vec3 brick = diffuseColor.rgb * (0.84 + 0.3 * h) * (h2 < 0.07 ? 0.6 : 1.0);
    vec3 mortar = mix(diffuseColor.rgb, vec3(0.5, 0.47, 0.42), 0.42);
    float far = smoothstep(0.22, 0.55, max(fw.x, fw.y));
    diffuseColor.rgb = mix(mix(mortar, brick, b), diffuseColor.rgb * 0.95, far);`,
  tile: `
    vec3 n = abs(vSN);
    vec2 uv = vec2(n.x > n.z ? vSW.z : vSW.x, vSW.y) / vec2(0.21, 0.15);
    vec2 fw = fwidth(uv);
    float row = floor(uv.y); uv.x += fract(row * 0.5);
    vec2 id = vec2(floor(uv.x), row), f = fract(uv);
    float lip = 1.0 - 0.45 * smoothstep(0.72, 1.0, f.y);
    float round_ = 0.78 + 0.22 * sin(f.x * 3.14159);
    float k = lip * round_ * (0.86 + 0.26 * sHash(id));
    float far = smoothstep(0.25, 0.6, max(fw.x, fw.y));
    diffuseColor.rgb *= mix(k, 0.82, far);`,
};
function surfaceMat(kind) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vSW; varying vec3 vSN;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vSW = (modelMatrix * vec4(transformed, 1.0)).xyz; vSN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = SURF_GLSL + '\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      { ${SURF[kind]} }`);
  };
  m.customProgramCacheKey = () => 'starward-surface-' + kind;
  return m;
}
const BRICK = surfaceMat('brick'), TILES = surfaceMat('tile');

// Turn smoothly toward an angle the short way round
const dampAng = (a, b, k, dt) => a + damp(0, Math.atan2(Math.sin(b - a), Math.cos(b - a)), k, dt);

// A beam (square section w x d) from point a to point b
const _up = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function beam(k, a, b, w, d, color) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
  _e.setFromQuaternion(_q.setFromUnitVectors(_up, dir.normalize()), 'XYZ');
  return k.box(w, len, d, color, A.add(B).multiplyScalar(0.5).toArray(), [_e.x, _e.y, _e.z]);
}
// A pointed (Gothic) arch panel, w wide, h tall to its point, t thick, standing in the x-y plane
function archGeo(w, h, t) {
  const s = new THREE.Shape(), sp = h - w * 0.75;
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, sp);
  s.quadraticCurveTo(w / 2, sp + w * 0.5, 0, h); s.quadraticCurveTo(-w / 2, sp + w * 0.5, -w / 2, sp); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 3 }); g.translate(0, 0, -t / 2);
  return g;
}
// The brick frame round a pointed arch: an arch-shaped ring, w x h outside, `rim` wide
function archRing(w, h, t, rim = 0.14) {
  const s = new THREE.Shape(), sp = h - w * 0.75;
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, sp); s.quadraticCurveTo(w / 2, sp + w * 0.5, 0, h); s.quadraticCurveTo(-w / 2, sp + w * 0.5, -w / 2, sp); s.closePath();
  const iw = w - rim * 2, ih = h - rim * 1.4, isp = ih - iw * 0.75, hole = new THREE.Path();
  hole.moveTo(-iw / 2, 0.01); hole.lineTo(-iw / 2, isp); hole.quadraticCurveTo(-iw / 2, isp + iw * 0.5, 0, ih); hole.quadraticCurveTo(iw / 2, isp + iw * 0.5, iw / 2, isp); hole.lineTo(iw / 2, 0.01); hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 3 }); g.translate(0, 0, -t / 2);
  return g;
}

// ---------- The ground: the cathedral hill, the town below it, the lagoon ----------
const WATER = -19.6;
export function groundHeight(x, z) {
  // the hilltop (cathedral and tower) is flat at 0; north of it the slope drops to the town and shore
  const edge = -14 + Math.sin(x / 23) * 4;
  let h = 0;
  if (z < edge) h = -17 * (1 - Math.exp(-(edge - z) / 16));
  if (z < -150 + Math.sin(x / 70) * 15) h = lerp(h, -22, clamp((-150 + Math.sin(x / 70) * 15 - z) / 20, 0, 1));   // the shore
  if (x < -190) h = lerp(h, -22, clamp((-190 - x) / 25, 0, 1) * clamp((-30 - z) / 30, 0, 1));                      // lagoon to the west too
  // rolling fields and woods to the south, small bumps everywhere
  h += (N1(x / 90, z / 90) - 0.5) * 8 * clamp((z - 90) / 120, 0, 1);
  h += (N2(x / 9, z / 9) - 0.5) * 0.35 * clamp((Math.hypot(x, z) - 10) / 20, 0, 1);
  return h;
}

// The planets, round the Sun: real periods (years); radii squeezed to fit (metres in the model)
const BODIES = [
  { k: 'mercury', name: 'Mercury', T: 0.241, r: 0.42, size: 0.035, col: 0xd8c8b0, ph: 1.2, trail: 0.95 },
  { k: 'venus', name: 'Venus', T: 0.615, r: 0.66, size: 0.055, col: 0xfff0c8, ph: 3.4, trail: 1.6 },
  { k: 'earth', name: 'Earth', T: 1, r: 0.95, size: 0.06, col: 0x5aa0ff, ph: 0, trail: 1 },
  { k: 'mars', name: 'Mars', T: 1.881, r: 1.3, size: 0.048, col: 0xff6a42, ph: 0.35, trail: 2.6 },
  { k: 'jupiter', name: 'Jupiter', T: 11.86, r: 1.85, size: 0.1, col: 0xf0d2a8, ph: 2.3, trail: 4.5 },
  { k: 'saturn', name: 'Saturn', T: 29.46, r: 2.35, size: 0.085, col: 0xf0dc98, ph: 4.6, trail: 7 },
];
const EARTH = 2, MARS = 3;
const ZODIAC_R = 2.85;           // the band of stars the planets are seen against
const TRAIL_N = 150;
function helio(i, t, out) { const B = BODIES[i], a = 2 * Math.PI * t / B.T + B.ph; return out.set(Math.cos(a) * B.r, 0, -Math.sin(a) * B.r); }

export default class Copernicus {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.start = { pos: new THREE.Vector3(-0.4, 0, 1.0), yaw: 0 };   // facing north, over the lagoon
    this.s = {
      phase: 'arrive',
      guide: null,
      hour: 20.5,        // local time (the sky follows it)
      model: 0,          // the sky model showing (0..1)
      k: 1,              // 1 = seen from the Earth (Ptolemy), 0 = from the Sun (Copernicus)
      epi: 0,            // Ptolemy's circles on circles drawn in
      sunHand: 0,        // 1 = the Sun is floating by your hand to grab; 2 = flying to the middle; 3 = in the middle
      names: 0,          // how many planet names are lit
      mars: 0,           // 1 = following Mars from the Earth (the sight line and its path on the stars)
      spin: 0,           // the Earth spinning, then the sky turning
      years: 0,          // ch8_08: the pile of pages grows
      friend: 0,         // Rheticus comes to visit
      book: 0,           // 1 the messenger brings it, 2 in Copernicus's hands, 3 he's gone, the book glows on the desk
      diagram: 0,        // the famous drawing rising into the stars
      journal: 0,
      cop: 'desk',       // what Copernicus is doing: desk, sight, look, talk, point, hold
    };
    this.t = 0; this.tm = 3.2;   // model time (years)
    G.world.height = (x, z) => (Math.abs(x) < HALF && Math.abs(z) < HALF ? TOP : groundHeight(x, z));
    G.world.bounds = 2.25;
    G.world.blockers = [];
    G.sky.fogFar = 2600; G.sky.mist = 0;
    G.sky.setPlace({ lat: LAT, year: YEAR, sunLon: SUNLON });
    G.audio.amb = 0.6;
    this.buildGround();
    this.buildLagoon();
    this.buildCathedral();
    this.buildTown();
    this.buildTower();
    this.buildTrees();
    this.buildPeople();
    this.buildLife();
    this.buildModel();
    this.buildBook();
    this.journal = new Journal(this, drawJournal);
    this.registerInteractables();
    this.bellT = 4; this.owlT = 25; this.gullT = 8;
  }

  // ---------- Building the place ----------
  buildGround() {
    const SIZE = 2400, SEG = 190;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const grass = new THREE.Color(0x4a5a34), grass2 = new THREE.Color(0x6a6a3a), field = new THREE.Color(0x7a6a44), mud = new THREE.Color(0x4a3e30), sand = new THREE.Color(0x8a7e62), yard = new THREE.Color(0x7a7266);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i);
      // more detail near the tower, stretched out far away
      const r0 = Math.hypot(x, z), k = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.8) * (SIZE / 2) / r0 : 0;
      x = x * k + 40; z = z * k - 20;
      const y = groundHeight(x, z); p.setXYZ(i, x, y, z);
      c.copy(grass).lerp(grass2, N2(x / 18, z / 18));
      if (z > 90) c.lerp(field, clamp(N1(x / 40 + 3, z / 40) * 1.6 - 0.4, 0, 1));                  // ploughed fields
      if (y < -20.5) c.copy(sand);
      if (x > -6 && x < 112 && z > -8 && z < 58) c.lerp(yard, 0.7);                                   // the cathedral close
      if (z < -55 && z > -150 && x > -130 && x < 60) c.lerp(mud, 0.45);                              // the town's lanes
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    this.root.add(new THREE.Mesh(g, FLAT));
  }

  buildLagoon() {
    // the water: dark, with the Moon's light glancing off it
    const w = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshPhongMaterial({ color: 0x0c1a28, specular: 0x8899bb, shininess: 60, emissive: 0x02060c }));
    w.rotation.x = -Math.PI / 2; w.position.set(0, WATER, -1500); this.root.add(w);
    // a path of glitter on the water toward the Moon, shimmering (one long strip, additive)
    this.glitTex = canvasTex(64, 512, (g, W, H) => {
      for (let i = 0; i < 900; i++) { const y = Math.random() * H, x = W / 2 + (Math.random() - 0.5) * W * (0.15 + 0.85 * y / H); g.fillStyle = `rgba(220,230,255,${0.2 + Math.random() * 0.8})`; g.fillRect(x, y, 1 + Math.random() * 2, 1); }
    });
    this.glitTex.wrapT = THREE.RepeatWrapping;
    this.glitter = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ map: this.glitTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.glitter.rotation.x = -Math.PI / 2; this.glitter.position.y = WATER + 0.05; this.root.add(this.glitter);
    // the Vistula Spit on the far side: a long low line of dark pine forest and dunes
    const k = new Kit();
    k.box(9000, 3, 60, 0x6a6650, [0, WATER + 1, -2100]);
    this.root.add(k.mesh());
  }

  // Frombork Cathedral: a long brick hall church, steep tiled roof, stepped gables east and west,
  // slender octagonal turrets at the corners of the west front, buttresses and tall pointed windows.
  // Round it the cathedral close's wall with its towers (you're on top of the north-west one).
  buildCathedral() {
    const k = new Kit(), kb = new Kit(), kt = new Kit(), B = 0x9a4630, B2 = 0x8a3c28, ROOF = 0x8a3424, STONE = 0xb8a890, DARKW = 0x120c0a;
    const x0 = 30, x1 = 98, z0 = 14, z1 = 32, H = 17;   // the nave (west end at x0)
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, L = x1 - x0, W = z1 - z0;
    kb.box(L, H, W, B, [cx, H / 2, cz]);
    k.box(L + 0.8, 1.0, W + 0.8, STONE, [cx, 0.3, cz]); k.box(L + 0.5, 0.12, W + 0.5, STONE, [cx, 0.86, cz]);
    // the roof, very steep and high, tiled; a corbel frieze and a moulded cornice under the eaves
    kt.add(gableRoof(L, W, 15, 0.5), ROOF, [cx, H, cz]);
    steppedGable(kb, W, 15, 6, B, [x0 - 0.25, H, cz], Math.PI / 2, 0.8, B2);
    steppedGable(kb, W, 15, 6, B, [x1 + 0.25, H, cz], Math.PI / 2, 0.8, B2);
    for (const sz of [-1, 1]) {
      const z = sz < 0 ? z0 : z1;
      k.box(L, 0.18, 0.3, STONE, [cx, H - 0.3, z + sz * 0.12]);
      for (let x = x0 + 0.6; x < x1 - 0.4; x += 0.9) kb.box(0.3, 0.4, 0.22, B2, [x, H - 0.62, z + sz * 0.1]);
      k.box(L, 0.14, 0.12, STONE, [cx, 2.6, z + sz * 0.06]);                         // a stone band under the windows
    }
    // buttresses with stepped stone weatherings, and the tall pointed windows between them: a
    // stone frame, two mullions, a transom and the glass (some panes lit from candles inside)
    this.cathWins = [];
    for (let i = 0; i <= 9; i++) {
      const x = x0 + 2 + i * (L - 4) / 9;
      for (const sz of [-1, 1]) {
        const z = sz < 0 ? z0 : z1, yaw = sz < 0 ? Math.PI : 0;
        kb.box(1.4, H - 1, 1.6, B2, [x, (H - 1) / 2, z + sz * 0.8]);
        kb.box(1.4, 6, 0.8, B2, [x, 3, z + sz * 1.95]);
        for (const [y, d] of [[6.05, 2.4], [H - 0.95, 1.65]]) k.box(1.55, 0.12, d + 0.1, STONE, [x, y, z + sz * d / 2]);
        k.cyl(0.001, 1.0, 1.6, 4, STONE, [x, H - 0.1, z + sz * 0.8], [0, Math.PI / 4, 0], [1, 1, 0.9]);
        if (i < 9) {
          const wx = x + (L - 4) / 18;
          this.cathWins.push({ p: new THREE.Vector3(wx, 8.5, z + sz * 0.06), yaw });
          k.add(archRing(2.3, 11.2, 0.22, 0.2), STONE, [wx, 3, z + sz * 0.11], [0, yaw, 0]);
          k.add(archGeo(1.9, 10.9, 0.02), DARKW, [wx, 3.05, z + sz * 0.02], [0, yaw, 0]);
          for (const ox of [-0.27, 0.27]) k.box(0.08, 8.6, 0.06, STONE, [wx + ox, 7.6, z + sz * 0.1]);
          k.box(1.6, 0.08, 0.06, STONE, [wx, 8.6, z + sz * 0.1]);
        }
      }
    }
    // the slender octagonal turrets at the west front, with tall pointed spires
    for (const tz of [z0 - 0.4, z1 + 0.4]) {
      kb.cyl(1.4, 1.5, 32, 8, B2, [x0 - 0.4, 16, tz]);
      for (let j = 1; j < 6; j++) k.cyl(1.55, 1.55, 0.35, 8, STONE, [x0 - 0.4, j * 5.5, tz]);
      for (let j = 0; j < 8; j++) { const a = (j + 0.5) / 8 * Math.PI * 2; if (j % 2) k.add(archGeo(0.32, 1.1, 0.04), DARKW, [x0 - 0.4 + Math.sin(a) * 1.44, 27, tz + Math.cos(a) * 1.44], [0, a, 0]); }
      kt.cyl(0.001, 1.6, 9, 8, ROOF, [x0 - 0.4, 36.5, tz]);
      k.ball(0.18, 0, 0xc8a040, [x0 - 0.4, 41.1, tz]);
    }
    for (const tz of [z0 + 4, z1 - 4]) { kb.cyl(0.7, 0.75, 8, 8, B2, [x0 - 0.5, H + 12, tz]); kt.cyl(0.001, 0.85, 5, 8, ROOF, [x0 - 0.5, H + 18.5, tz]); }
    // the west front: two tall pointed windows either side of the porch
    for (const oz of [-5.2, 5.2]) {
      k.add(archRing(2.3, 11.2, 0.22, 0.2), STONE, [x0 - 0.11, 3.6, cz + oz], [0, -Math.PI / 2, 0]);
      k.add(archGeo(1.9, 10.9, 0.02), DARKW, [x0 - 0.02, 3.65, cz + oz], [0, -Math.PI / 2, 0]);
      for (const m of [-0.27, 0.27]) k.box(0.06, 8.6, 0.08, STONE, [x0 - 0.1, 8.2, cz + oz + m]);
      this.cathWins.push({ p: new THREE.Vector3(x0 - 0.06, 9.1, cz + oz), yaw: -Math.PI / 2 });
    }
    // the porch at the west door, with its own little stepped gable, and the great door in a
    // deep pointed portal (stepped stone orders)
    kb.box(7, 9, 6, B, [x0 - 3.5, 4.5, cz]); kt.add(gableRoof(6, 7, 4, 0.2).rotateY(Math.PI / 2), ROOF, [x0 - 3.5, 9, cz]);
    steppedGable(kb, 7, 4, 3, B, [x0 - 6.5, 9, cz], Math.PI / 2, 0.5, B2);
    for (let o = 0; o < 3; o++) k.add(archRing(4.2 - o * 0.5, 6.4 - o * 0.45, 0.12, 0.25), STONE, [x0 - 7.06 + o * 0.0, 0.6, cz], [0, -Math.PI / 2, 0], [1, 1, 1 + o * 0.6]);
    k.add(archGeo(2.6, 5.1, 0.04), 0x3a2414, [x0 - 7.02, 0.6, cz], [0, -Math.PI / 2, 0]);
    for (let i = 0; i < 6; i++) k.box(0.03, 3.6, 0.04, 0x241408, [x0 - 7.05, 2.4, cz - 1.0 + i * 0.4]);
    // a little ridge turret (the signal bell) in the middle of the roof
    k.cyl(0.9, 0.9, 3, 6, 0x5a4a38, [cx, H + 15.5, cz]); k.cyl(0.001, 1.1, 5, 6, 0x4a6a5a, [cx, H + 19.5, cz]);

    // The close's wall: brick on a stone plinth, buttressed every eight metres, a blind pointed arch
    // in every bay, a corbel table carrying the crenellated breastwork (each merlon with an arrow
    // slit and a stone cap) and a plank wall-walk behind it. Towers at its corners, a gate to the south.
    const mid = [56, 28];
    const wall = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len, yaw = Math.atan2(-uz, ux);
      let nx = -uz, nz = ux; if ((mid[0] - (ax + bx) / 2) * nx + (mid[1] - (az + bz) / 2) * nz > 0) { nx = -nx; nz = -nz; }   // outward
      const fy = Math.atan2(nx, nz);   // facing out
      const P = (s, y, o) => [ax + ux * s + nx * o, y, az + uz * s + nz * o];
      kb.box(len, 6.5, 1.4, B, P(len / 2, 3.25, 0), [0, yaw, 0]);
      k.box(len, 1.1, 1.9, STONE, P(len / 2, 0.35, 0), [0, yaw, 0]); k.box(len, 0.1, 1.7, STONE, P(len / 2, 0.95, 0), [0, yaw, 0]);
      const bays = Math.max(1, Math.round(len / 8)), bl = len / bays;
      for (let i = 0; i <= bays; i++) {
        const s = i * bl;
        if (i > 0 && i < bays) {   // buttress, with a stone weathering on top
          kb.box(0.9, 5.2, 0.7, B2, P(s, 2.6, 1.05), [0, yaw, 0]);
          k.box(1.0, 0.1, 0.8, STONE, P(s, 5.25, 1.05), [0, yaw, 0]); kb.box(0.9, 0.5, 0.35, B2, P(s, 5.55, 0.87), [0, yaw, 0]); k.box(1.0, 0.08, 0.45, STONE, P(s, 5.84, 0.88), [0, yaw, 0]);
        }
        if (i < bays) {            // the bay's blind arch: white plaster in a brick frame
          const c = s + bl / 2;
          k.add(archGeo(bl * 0.42, 3.3, 0.02), 0xcfc6b4, P(c, 1.6, 0.71), [0, fy, 0]);
          kb.add(archRing(bl * 0.42 + 0.3, 3.5, 0.08, 0.15), B2, P(c, 1.5, 0.74), [0, fy, 0]);
          k.box(bl * 0.42 + 0.45, 0.1, 0.16, STONE, P(c, 1.47, 0.78), [0, yaw, 0]);
        }
      }
      // corbels, the breastwork (overhanging a little), its coping, merlons with slits and caps
      for (let s = 0.4; s < len - 0.2; s += 0.62) kb.box(0.24, 0.3, 0.26, B2, P(s, 6.35, 0.83), [0, yaw, 0]);
      kb.box(len, 1.0, 0.5, B, P(len / 2, 7.0, 0.68), [0, yaw, 0]);
      k.box(len, 0.06, 0.56, STONE, P(len / 2, 7.53, 0.68), [0, yaw, 0]);
      for (let s = 1.2; s < len - 0.6; s += 2.4) {
        kb.box(1.3, 0.95, 0.5, B2, P(s, 8.03, 0.68), [0, yaw, 0]);
        k.box(1.4, 0.07, 0.58, STONE, P(s, 8.54, 0.68), [0, yaw, 0]); k.box(1.2, 0.06, 0.4, STONE, P(s, 8.6, 0.68), [0, yaw, 0]);
        k.add(archGeo(0.12, 0.62, 0.02), DARKW, P(s, 7.7, 0.94), [0, fy, 0]);
      }
      // the wall-walk: three runs of boards, joints staggered
      const wr = rng(Math.round(ax * 7 + az * 13 + bx));
      for (let j = 0; j < 3; j++) for (let s = -wr() * 2; s < len;) { const l = 2.2 + wr() * 1.6, s0 = Math.max(0, s), s1 = Math.min(len, s + l);
        if (s1 - s0 > 0.1) k.box(s1 - s0 - 0.02, 0.05, 0.29, [0x5a4232, 0x624a36, 0x52402e][(j + Math.floor(s)) % 3], P((s0 + s1) / 2, 6.525, -0.55 + j * 0.3), [0, yaw, 0]);
        s += l; }
    };
    wall(HALF, 0, 112, 0); wall(112, 0, 112, 56); wall(112, 56, 0, 56); wall(0, 56, 0, HALF);
    // the corner towers: brick, banded, blind arches, slit windows, steep tiled pyramid roofs
    const tower = (x, z, h, w) => {
      kb.box(w, h, w, B2, [x, h / 2, z]);
      k.box(w + 0.5, 1.2, w + 0.5, STONE, [x, 0.3, z]);
      k.box(w + 0.12, 0.16, w + 0.12, STONE, [x, h * 0.45, z]);
      for (const [nx, nz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const fy = Math.atan2(nx, nz), o = w / 2;
        k.add(archGeo(1.5, h * 0.4, 0.02), 0xcfc6b4, [x + nx * (o + 0.01), h * 0.47, z + nz * (o + 0.01)], [0, fy, 0]);
        kb.add(archRing(1.8, h * 0.4 + 0.25, 0.1, 0.15), B, [x + nx * (o + 0.05), h * 0.46, z + nz * (o + 0.05)], [0, fy, 0]);
        k.add(archGeo(0.2, 0.9, 0.04), DARKW, [x + nx * (o + 0.02), h * 0.2, z + nz * (o + 0.02)], [0, fy, 0]);
        for (let i = 0; i < 9; i++) { const l = -w / 2 + 0.3 + i * (w - 0.6) / 8; kb.box(0.2, 0.3, 0.2, B, [x + nx * (o + 0.08) + nz * l, h - 0.35, z + nz * (o + 0.08) - nx * l]); }
      }
      k.box(w + 0.4, 0.12, w + 0.4, STONE, [x, h - 0.14, z]);
      kt.cyl(0.001, (w / 2 + 0.4) * Math.SQRT2, w * 1.1, 4, ROOF, [x, h + w * 0.55, z], [0, Math.PI / 4, 0]);
      k.cyl(0.04, 0.04, 1.4, 6, 0x3a3a3a, [x, h + w * 1.1 + 0.6, z]); k.ball(0.14, 0, 0xc8a040, [x, h + w * 1.1 + 0.2, z]);
    };
    tower(112, 0, 12, 6); tower(112, 56, 11, 6); tower(0, 56, 11, 6);
    // the south gate tower: stepped gables, a deep pointed gateway with its stone orders, a dark passage
    kb.box(9, 15, 8, B, [56, 7.5, 56]); k.box(9.5, 1.2, 8.5, STONE, [56, 0.3, 56]);
    kt.add(gableRoof(9, 8, 6, 0.4), ROOF, [56, 15, 56]);
    steppedGable(kb, 8, 6, 4, B, [56 - 4.6, 15, 56], Math.PI / 2, 0.5, B2); steppedGable(kb, 8, 6, 4, B, [56 + 4.6, 15, 56], Math.PI / 2, 0.5, B2);
    for (const sz of [-1, 1]) {
      const fy = sz < 0 ? Math.PI : 0;
      k.add(archGeo(3.6, 6, 0.04), 0x0e0a08, [56, 0, 56 + sz * 4.02], [0, fy, 0]);
      for (let o = 0; o < 2; o++) k.add(archRing(4.4 + o * 0.7, 6.8 + o * 0.5, 0.12, 0.3), STONE, [56, 0, 56 + sz * (4.08 + o * 0.06)], [0, fy, 0]);
      for (const ox of [-2.4, 2.4]) k.add(archGeo(0.9, 3.2, 0.02), 0xcfc6b4, [56 + ox, 8.4, 56 + sz * 4.01], [0, fy, 0]);
      k.add(archGeo(0.26, 1.0, 0.04), DARKW, [56, 9.6, 56 + sz * 4.02], [0, fy, 0]);
    }
    // the canons' houses (curias) inside and just outside the close
    this.closeWins = [];
    const hr = rng(5);
    for (const [x, z, yaw] of [[14, 44, 0], [24, 46, 0], [70, 46, 0], [82, 45, 0], [94, 46, 0], [10, 10, Math.PI / 2], [104, 12, -Math.PI / 2], [104, 30, -Math.PI / 2], [30, 70, Math.PI], [46, 72, Math.PI], [66, 70, Math.PI], [86, 71, Math.PI]]) {
      house(k, { x, y: groundHeight(x, z), z, w: 8 + hr() * 3, d: 7, h: 6 + hr() * 2, yaw, wall: [0xd6c4a2, 0xc8b08a, 0x9a4a32][Math.floor(hr() * 3)], roofCol: ROOF, gableFront: hr() < 0.4, timber: hr() < 0.35 ? 0x3a2a1c : null }, this.closeWins);
    }
    this.root.add(k.mesh(), kb.mesh(BRICK), kt.mesh(TILES));
    const wl = windows(this.cathWins.map((w) => ({ p: w.p, yaw: w.yaw })), { lit: 0.35, w: 1.5, h: 9, warm: 0xc0803a, seed: 9 });
    this.root.add(wl);
    this.root.add(windows(this.closeWins, { lit: 0.5, seed: 4 }));
  }

  // The town of Frombork down the hill: lanes of tall narrow houses with their gables to the street,
  // a market square with the town hall, St Nicholas's church, the harbour and its fishing boats.
  buildTown() {
    const k = new Kit(), r = rng(12), wins = [];
    const ROOFS = [0x8a3424, 0x9a4028, 0x7a3020, 0x5a4a44], WALLS = [0xe0d2b0, 0xd4c094, 0xc8a878, 0xb8b0a0, 0x9a4a32, 0xd8c8b8];
    this.chimneys = [];
    const street = (x0, z0, x1, z1, side) => {
      const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len, yaw = Math.atan2(dx, dz) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      for (let d = 2; d < len - 3;) {
        const w = 5 + r() * 3, x = x0 + dx * (d + w / 2) + side * -dz * 6.5, z = z0 + dz * (d + w / 2) + side * dx * 6.5;
        const y = groundHeight(x, z);
        house(k, { x, y: y - 0.3, z, w, d: 9, h: 6 + r() * 4, yaw, wall: WALLS[Math.floor(r() * WALLS.length)], roofCol: ROOFS[Math.floor(r() * ROOFS.length)], gableFront: r() < 0.75, stepped: r() < 0.2, timber: r() < 0.3 ? 0x3a2a1c : null }, wins);
        if (r() < 0.25) this.chimneys.push(new THREE.Vector3(x, y + 13, z));
        d += w + 0.3;
      }
    };
    // lanes running down to the harbour, and two along the shore
    for (const x of [-95, -65, -35, -5, 25]) { street(x, -60, x - 6, -140, 1); street(x, -60, x - 6, -140, -1); }
    street(-110, -145, 40, -145, 1);
    // the market square, the town hall in the middle
    const mx = -50, mz = -100;
    k.box(14, 10, 10, 0xb84a30, [mx, groundHeight(mx, mz) + 5, mz]); k.add(gableRoof(14, 10, 8, 0.3), 0x7a2e22, [mx, groundHeight(mx, mz) + 10, mz]);
    k.cyl(1.2, 1.4, 12, 8, 0xa84a30, [mx + 5, groundHeight(mx, mz) + 16, mz]); k.cyl(0.001, 1.6, 6, 8, 0x3a5a4a, [mx + 5, groundHeight(mx, mz) + 25, mz]);
    // St Nicholas's, the town church, with its tower
    const sx = 10, sz = -112, sy = groundHeight(sx, sz);
    k.box(24, 11, 12, 0x9a4630, [sx, sy + 5.5, sz]); k.add(gableRoof(24, 12, 9, 0.3), 0x7a2e22, [sx, sy + 11, sz]);
    k.box(7, 26, 7, 0x8a3c28, [sx - 14, sy + 13, sz]); k.cyl(0.001, 4.6, 14, 4, 0x7a2e22, [sx - 14, sy + 33, sz], [0, Math.PI / 4, 0]);
    // the harbour: a wooden pier and its boats
    const py = WATER + 0.6;
    k.box(4, 0.4, 60, 0x5a4632, [-40, py, -185]);
    for (let i = 0; i < 12; i++) k.cyl(0.18, 0.18, 3, 5, 0x3a2a1c, [-42 + (i % 2) * 4, WATER - 0.6, -158 - Math.floor(i / 2) * 10]);
    this.boats = [];
    for (let i = 0; i < 6; i++) {
      const bk = new Kit(), L = 7 + r() * 4;
      bk.cyl(0.9, 0.7, L, 8, 0x4a3420, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 0.45]);
      bk.box(1.4, 0.15, L * 0.8, 0x6a5038, [0, 0.38, 0]);
      bk.cyl(0.06, 0.08, 7, 5, 0x3a2a1c, [0, 3.6, L * 0.1]);
      bk.box(0.05, 3.5, 2.4, 0xb8a888, [0, 3.8, L * 0.1 - 1.2]);   // a furled sail
      const b = bk.mesh(); b.position.set(-48 + (i % 2) * 16 + r() * 2, WATER + 0.25, -170 - i * 9); b.rotation.y = (r() - 0.5) * 0.3; b.userData.ph = r() * 6;
      this.root.add(b); this.boats.push(b);
    }
    this.root.add(k.mesh());
    this.root.add(windows(wins, { lit: 0.33, seed: 8 }));
  }

  // The tower you stand on: a brick tower on a stone plinth, banded, with tall blind pointed arches
  // on each face and a corbel frieze carrying the battlements. On top: a plank floor (with the stair
  // hatch, open), the crenellated parapet, and Copernicus's corner: a writing desk under a board
  // lean-to, his books and papers, ink, a candle; his instruments (a triquetrum, a quadrant).
  buildTower() {
    const k = new Kit(), kb = new Kit(), kt = new Kit(), r = rng(21);
    const B = 0x9a4630, B2 = 0x8a3c28, STONE = 0xb0a48e, PLASTER = 0xcfc6b4, WOOD = 0x6a4a30, DARK = 0x3a2818, IRON = 0x2a282c, BRASS = 0xc09a40;
    const W = HALF + 0.2;   // outer face of the parapet (it overhangs the tower on its corbels)
    // ---- the tower body: solid below the top room, then four walls round the stairwell
    kb.box(HALF * 2, TOP - 2.8, HALF * 2, B, [0, (TOP - 2.8) / 2, 0]);
    kb.box(HALF * 2, 2.75, 0.5, B, [0, TOP - 1.425, -HALF + 0.25]); kb.box(HALF * 2, 2.75, 0.5, B, [0, TOP - 1.425, HALF - 0.25]);
    kb.box(0.5, 2.75, HALF * 2 - 1, B, [-HALF + 0.25, TOP - 1.425, 0]); kb.box(0.5, 2.75, HALF * 2 - 1, B, [HALF - 0.25, TOP - 1.425, 0]);
    k.box(HALF * 2 + 0.5, 1.3, HALF * 2 + 0.5, STONE, [0, 0.35, 0]);                     // stone plinth
    k.box(HALF * 2 + 0.3, 0.14, HALF * 2 + 0.3, STONE, [0, 1.07, 0]);                   // its chamfered top
    for (const y of [4.6, 9.4]) k.box(HALF * 2 + 0.1, 0.16, HALF * 2 + 0.1, STONE, [0, y, 0]);   // string courses
    // each face: two tall blind arches (white plaster inside a brick frame), a slit window, corbels
    for (const [nx, nz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const yaw = Math.atan2(nx, nz), c = Math.cos(yaw), sn = Math.sin(yaw);
      const at3 = (lx, y, out) => [nx * (HALF + out) + lx * c, y, nz * (HALF + out) - lx * sn];
      for (const lx of [-1.35, 1.35]) {
        k.add(archGeo(1.5, 4.2, 0.02), PLASTER, at3(lx, 4.9, 0.01), [0, yaw, 0]);
        kb.add(archRing(1.78, 4.42, 0.1, 0.14), B2, at3(lx, 4.8, 0.05), [0, yaw, 0]);
        k.box(1.9, 0.1, 0.16, STONE, at3(lx, 4.75, 0.08), [0, yaw, 0]);
      }
      k.add(archGeo(0.26, 1.1, 0.04), 0x120c0a, at3(0, 6.6, 0.02), [0, yaw, 0]);   // slit window
      k.box(0.5, 0.08, 0.14, STONE, at3(0, 6.56, 0.07), [0, yaw, 0]);
      k.add(archGeo(0.3, 0.9, 0.04), 0x120c0a, at3(0, 11.6, 0.02), [0, yaw, 0]);
      // corbels under the overhanging parapet, and a band of dark header bricks above them
      for (let i = 0; i < 12; i++) { const lx = -HALF + 0.25 + i * (HALF * 2 - 0.5) / 11; kb.box(0.2, 0.32, 0.24, B2, at3(lx, TOP - 0.61, 0.1), [0, yaw, 0]); kb.box(0.14, 0.12, 0.14, B2, at3(lx, TOP - 0.84, 0.05), [0, yaw, 0]); }
    }
    // the tower's door into the close (south face), and a little life round its foot: a well,
    // barrels, a woodpile under a lean-to roof, a handcart
    k.add(archRing(1.7, 3.0, 0.16, 0.22), STONE, [1.4, 0.9, HALF + 0.08]);
    k.add(archGeo(1.26, 2.72, 0.04), 0x4a3020, [1.4, 0.9, HALF + 0.02]);
    for (let i = 0; i < 4; i++) k.box(0.02, 2.0, 0.03, 0x2a1a10, [1.4 - 0.45 + i * 0.3, 1.9, HALF + 0.05]);
    for (const y of [1.4, 2.5]) k.box(1.1, 0.06, 0.02, IRON, [1.4, y, HALF + 0.06]);
    k.box(1.7, 0.2, 0.9, STONE, [1.4, 0.8, HALF + 0.5]);   // the doorstep
    { const wx = 7, wz = 21, wy = groundHeight(wx, wz);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.box(0.42, 0.8, 0.22, i % 2 ? STONE : 0xa09480, [wx + Math.cos(a) * 0.75, wy + 0.4, wz + Math.sin(a) * 0.75], [0, -a + Math.PI / 2, 0]); }
      k.cyl(0.62, 0.62, 0.05, 12, 0x0a1218, [wx, wy + 0.6, wz]);
      for (const sx of [-1, 1]) k.box(0.12, 1.8, 0.12, DARK, [wx + sx * 0.8, wy + 0.9, wz]);
      k.box(1.8, 0.12, 0.12, DARK, [wx, wy + 1.85, wz]); k.cyl(0.08, 0.08, 1.5, 8, WOOD, [wx, wy + 1.6, wz], [0, 0, Math.PI / 2]);
      kt.add(gableRoof(1.9, 1.4, 0.6, 0.15), 0x7a2e22, [wx, wy + 1.95, wz]);
      k.cyl(0.16, 0.13, 0.3, 8, 0x5a3e26, [wx + 0.45, wy + 0.95, wz + 0.1]); }
    for (const [x, z] of [[4.0, 4.3], [4.5, 5.0], [3.9, 5.1]]) { const y = groundHeight(x, z); k.cyl(0.3, 0.26, 0.85, 10, 0x5a3e26, [x, y + 0.425, z]); for (const h of [0.15, 0.7]) k.cyl(0.31, 0.31, 0.04, 10, IRON, [x, y + h, z]); }
    { const y = groundHeight(-0.5, 4.2);
      for (let i = 0; i < 24; i++) k.cyl(0.09, 0.09, 1.0, 6, i % 4 ? 0x7a5a3a : 0x8a6a44, [-1.6 + (i % 8) * 0.19, y + 0.1 + Math.floor(i / 8) * 0.18, 4.0], [Math.PI / 2, 0, 0]);
      for (const x of [-1.8, 0.0]) k.box(0.1, 1.5, 0.1, DARK, [x, y + 0.75, 4.6]);
      k.box(2.1, 0.06, 1.3, 0x5a3e28, [-0.9, y + 1.45, 4.1], [0.35, 0, 0]); }
    { const cx = 15, cz = 3.6, y = groundHeight(cx, cz);
      k.box(1.6, 0.06, 0.9, WOOD, [cx, y + 0.62, cz], [0, 0, -0.12]); for (const sz of [-1, 1]) k.box(1.6, 0.25, 0.04, WOOD, [cx, y + 0.76, cz + sz * 0.44], [0, 0, -0.12]);
      for (const sz of [-1, 1]) { k.cyl(0.42, 0.42, 0.05, 12, 0x4a3420, [cx + 0.2, y + 0.42, cz + sz * 0.5], [Math.PI / 2, 0, 0]); k.cyl(0.05, 0.05, 0.08, 6, IRON, [cx + 0.2, y + 0.42, cz + sz * 0.53], [Math.PI / 2, 0, 0]); }
      for (const sz of [-1, 1]) beam(k, [cx - 0.75, y + 0.68, cz + sz * 0.3], [cx - 1.8, y + 0.05, cz + sz * 0.3], 0.06, 0.06, WOOD); }
    // ---- the parapet: a brick breastwork 0.7 m high on top of the corbels, stone coping, merlons
    kb.box(W * 2, 1.15, 0.4, B, [0, TOP + 0.7 - 0.575, -HALF]); kb.box(W * 2, 1.15, 0.4, B, [0, TOP + 0.7 - 0.575, HALF]);
    kb.box(0.4, 1.15, W * 2 - 0.8, B, [-HALF, TOP + 0.7 - 0.575, 0]); kb.box(0.4, 1.15, W * 2 - 0.8, B, [HALF, TOP + 0.7 - 0.575, 0]);
    const cope = (ax, az, bx, bz) => {   // coping stones with fine joints between them
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 0.62), yaw = Math.atan2(-(bz - az), bx - ax);
      for (let i = 0; i < n; i++) { const f = (i + 0.5) / n; k.box(len / n - 0.008, 0.08, 0.5, i % 3 ? STONE : 0xa89a84, [ax + (bx - ax) * f, TOP + 0.74, az + (bz - az) * f], [0, yaw, 0]); }
    };
    cope(-W - 0.05, -HALF, W + 0.05, -HALF); cope(-W - 0.05, HALF, W + 0.05, HALF); cope(-HALF, -HALF + 0.25, -HALF, HALF - 0.25); cope(HALF, -HALF + 0.25, HALF, HALF - 0.25);
    const merlon = (x, z, w, d) => {
      kb.box(w, 0.36, d, B2, [x, TOP + 0.96, z]);
      k.box(w + 0.06, 0.05, d + 0.06, STONE, [x, TOP + 1.165, z]); k.box(w - 0.12, 0.04, d - 0.12, STONE, [x, TOP + 1.21, z]);
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) merlon(sx * HALF, sz * HALF, 0.6, 0.6);
    for (const f of [-1.5, 0, 1.5]) { merlon(f, -HALF, 0.6, 0.4); merlon(f, HALF, 0.6, 0.4); merlon(-HALF, f, 0.4, 0.6); merlon(HALF, f, 0.4, 0.6); }
    // ---- the floor: one layer of oak boards with thin dark seams, butt joints staggered, cut
    // round the stair hatch. Below the seams, the dark subfloor (5 cm down, never touching them).
    const HX = -1.5, HZ = 1.9, HH = 0.45, IN = HALF - 0.2;   // the hatch, and the inside of the parapet
    const sub = (x0, x1, z0, z1) => k.box(x1 - x0, 0.2, z1 - z0, 0x1c140e, [(x0 + x1) / 2, TOP - 0.15, (z0 + z1) / 2]);
    sub(-2.5, 2.5, -2.5, HZ - HH); sub(-2.5, 2.5, HZ + HH, 2.5); sub(-2.5, HX - HH, HZ - HH, HZ + HH); sub(HX + HH, 2.5, HZ - HH, HZ + HH);
    const BW = (IN * 2) / 28, boardCols = [0x7a5a3a, 0x6e5034, 0x735436, 0x664a30, 0x7e6040, 0x6a4c32];
    const board = (x, z0, z1) => { if (z1 - z0 < 0.05) return; const c = new THREE.Color(boardCols[Math.floor(r() * boardCols.length)]).multiplyScalar(0.92 + r() * 0.16); k.box(BW - 0.007, 0.04, z1 - z0 - 0.006, c.getHex(), [x, TOP - 0.02, (z0 + z1) / 2]); };
    for (let i = 0; i < 28; i++) {
      const x = -IN + (i + 0.5) * BW, cut = Math.abs(x - HX) < HH + BW / 2 - 0.01;
      let z = -IN; const joints = [];
      for (let zz = -IN + 0.6 + r() * 1.9; zz < IN - 0.4; zz += 1.6 + r() * 1.4) joints.push(zz);
      joints.push(IN);
      for (const j of joints) {
        if (cut && z < HZ + HH && j > HZ - HH) { board(x, z, HZ - HH); board(x, HZ + HH, j); }
        else board(x, z, j);
        z = j;
      }
    }
    // the hatch: a trim of boards round the hole, the shaft below with its ladder, the trap door open
    for (const [x, z, w, d] of [[HX, HZ - HH - 0.04, HH * 2 + 0.16, 0.08], [HX, HZ + HH + 0.04, HH * 2 + 0.16, 0.08], [HX - HH - 0.04, HZ, 0.08, HH * 2], [HX + HH + 0.04, HZ, 0.08, HH * 2]]) k.box(w, 0.05, d, 0x5a3e26, [x, TOP - 0.013, z]);
    for (const [x, z, w, d] of [[HX, HZ - HH - 0.05, HH * 2, 0.1], [HX, HZ + HH + 0.05, HH * 2, 0.1], [HX - HH - 0.05, HZ, 0.1, HH * 2], [HX + HH + 0.05, HZ, 0.1, HH * 2]]) kb.box(w, 2.7, d, 0x6a3020, [x, TOP - 1.42, z]);
    k.box(HH * 2, 0.05, HH * 2, 0x3a2a1c, [HX, TOP - 2.78, HZ]);
    const lad = (f) => [TOP - 2.78 + f * 3.53, HZ - 0.2 + f * (0.2 - HH + 0.07)];   // the ladder, up the north side of the shaft
    for (const sx of [-1, 1]) { const [y0, z0] = lad(0), [y1, z1] = lad(1); beam(k, [HX + sx * 0.25, y0, z0], [HX + sx * 0.25, y1, z1], 0.06, 0.05, 0x5a3e26); }
    for (let i = 1; i < 11; i++) { const [y, z] = lad(i / 11.6); beam(k, [HX - 0.25, y, z], [HX + 0.25, y, z], 0.035, 0.035, 0x6a4a30); }
    const ang = Math.PI / 2 + 0.15, hz = HZ + HH;
    const dP = (ly, lz) => [TOP + ly * Math.cos(ang) - lz * Math.sin(ang), hz + ly * Math.sin(ang) + lz * Math.cos(ang)];  // door space (hinge at origin) to world y, z
    { const [y, z] = dP(0.025, -0.45); k.box(HH * 2 - 0.02, 0.05, 0.9, 0x6a4a30, [HX, y, z], [ang, 0, 0]); }
    for (const lz of [-0.72, -0.18]) { const [y, z] = dP(-0.02, lz); k.box(HH * 2 - 0.1, 0.03, 0.12, 0x553a24, [HX, y, z], [ang, 0, 0]); }   // battens underneath
    for (const lx of [-0.28, 0.28]) { const [y, z] = dP(0.055, -0.25); k.box(0.05, 0.008, 0.5, IRON, [HX + lx, y, z], [ang, 0, 0]); }       // strap hinges
    // ---- the lean-to over the desk (east side): four posts, two beams, rafters, a board-and-batten roof
    const X1 = 1.35, X2 = HALF - 0.3, Y1 = 2.75, Y2 = 2.3, slope = Math.atan2(Y1 - Y2, X2 - X1);
    for (const z of [-1.4, 1.4]) {
      k.box(0.14, Y1, 0.14, DARK, [X1, TOP + Y1 / 2, z]); k.box(0.14, Y2, 0.14, DARK, [X2, TOP + Y2 / 2, z]);
      beam(k, [X1, TOP + Y1 - 0.5, z], [X1, TOP + Y1 - 0.01, z - Math.sign(z) * 0.45], 0.08, 0.08, DARK);   // knee braces up to the beams
      beam(k, [X2, TOP + Y2 - 0.5, z], [X2, TOP + Y2 - 0.01, z - Math.sign(z) * 0.45], 0.08, 0.08, DARK);
    }
    k.box(0.16, 0.16, 3.2, 0x4a3220, [X1, TOP + Y1 + 0.08, 0]); k.box(0.16, 0.16, 3.2, 0x4a3220, [X2, TOP + Y2 + 0.08, 0]);
    const RL = (X2 - X1) / Math.cos(slope) + 0.9, rc = [(X1 + X2) / 2, TOP + (Y1 + Y2) / 2 + 0.16, 0];
    const rP = (lx, ly, lz) => [rc[0] + lx * Math.cos(slope) + ly * Math.sin(slope), rc[1] - lx * Math.sin(slope) + ly * Math.cos(slope), lz];
    for (let i = 0; i < 7; i++) k.box(RL, 0.09, 0.07, 0x4a3220, rP(0, 0.045, -1.5 + i * 0.5), [0, 0, -slope]);            // rafters
    for (let i = 0; i < 13; i++) k.box(RL + 0.05, 0.025, 0.26, i % 3 ? 0x5a3e28 : 0x52381f, rP(0, 0.1, -1.68 + i * 0.28), [0, 0, -slope]);   // boards
    for (let i = 0; i < 12; i++) k.box(RL + 0.05, 0.03, 0.06, 0x3e2a18, rP(0, 0.125, -1.54 + i * 0.28), [0, 0, -slope]);  // battens over the joints
    // ---- the desk: a tall writing desk (he writes standing, the way scholars did), a slanted
    // book-rest with his great manuscript open on it, a shelf underneath with more books
    const dx = HALF - 0.85, dz = 0.15, DH = 0.95; this.DESK = { x: dx, z: dz, y: TOP + DH };
    k.box(0.78, 0.05, 1.56, 0x6e4c2e, [dx, TOP + DH - 0.025, dz]); k.box(0.8, 0.02, 1.58, 0x5a3c22, [dx, TOP + DH - 0.06, dz]);
    for (const [ox, oz] of [[-0.31, -0.68], [0.31, -0.68], [-0.31, 0.68], [0.31, 0.68]]) {
      k.cyl(0.035, 0.035, DH - 0.07, 8, DARK, [dx + ox, TOP + (DH - 0.07) / 2, dz + oz]);
      k.cyl(0.05, 0.05, 0.08, 8, DARK, [dx + ox, TOP + DH * 0.55, dz + oz]); k.cyl(0.045, 0.04, 0.06, 8, DARK, [dx + ox, TOP + 0.03, dz + oz]);
    }
    for (const sx of [-1, 1]) k.box(0.03, 0.12, 1.36, 0x5a3c22, [dx + sx * 0.31, TOP + DH - 0.13, dz]);   // aprons
    for (const sz of [-1, 1]) k.box(0.62, 0.12, 0.03, 0x5a3c22, [dx, TOP + DH - 0.13, dz + sz * 0.68]);
    k.box(0.62, 0.03, 1.36, 0x5e4026, [dx, TOP + 0.24, dz]);                                              // the low shelf
    for (let i = 0; i < 7; i++) { const h = 0.24 + r() * 0.08; k.box(0.2 + r() * 0.06, h, 0.05 + r() * 0.03, [0x6a2a1a, 0x3a3020, 0x5a4a2a, 0x2a3a4a, 0x7a5a2a][i % 5], [dx + 0.05, TOP + 0.255 + h / 2, dz - 0.6 + i * 0.075], [0, 0, (i === 6 ? 0.35 : 0)]); }
    for (let i = 0; i < 3; i++) k.cyl(0.04, 0.04, 0.42, 8, 0xe0d2b0, [dx - 0.05, TOP + 0.295, dz + 0.25 + i * 0.09], [0, 0, Math.PI / 2]);  // rolled charts
    // the book-rest: a slanted board facing him, the manuscript open on it
    const tilt = 0.4, lp = [dx + 0.17, TOP + DH + 0.1, dz + 0.3];
    k.box(0.32, 0.025, 0.44, 0x5a3c22, lp, [0, 0, tilt]); k.box(0.03, 0.15, 0.4, 0x5a3c22, [dx + 0.3, TOP + DH + 0.075, dz + 0.3]);
    k.box(0.03, 0.03, 0.44, 0x5a3c22, [lp[0] - 0.15, lp[1] - 0.07, lp[2]]);                           // the ledge that holds the book
    for (const sz of [-1, 1]) k.box(0.28, 0.025, 0.2, 0xece0c0, [lp[0] - 0.01 * Math.sin(tilt) + 0.0, lp[1] + 0.026, lp[2] + sz * 0.1], [sz * 0.06, 0, tilt]);
    k.box(0.3, 0.012, 0.42, 0x6a3a1e, [lp[0] + 0.004, lp[1] + 0.008, lp[2]], [0, 0, tilt]);            // its binding underneath
    // books, loose papers, ink and quill, a brass astrolabe, the candle (below)
    const bookCols = [0x6a2a1a, 0x3a3020, 0x5a4a2a, 0x2a3a4a, 0x7a5a2a];
    for (let i = 0; i < 5; i++) { const w = 0.28 - i * 0.02, d = 0.36 - i * 0.02, y = TOP + DH + 0.031 + i * 0.061, ry = (r() - 0.5) * 0.4;
      k.box(w, 0.06, d, bookCols[i], [dx + 0.12, y, dz - 0.52], [0, ry, 0]); k.box(w - 0.01, 0.046, d - 0.03, 0xe6d8b4, [dx + 0.12 + 0.01 * Math.cos(ry), y, dz - 0.52 - 0.01 * Math.sin(ry)], [0, ry, 0]); }
    for (let i = 0; i < 4; i++) k.box(0.21, 0.003, 0.29, i % 2 ? 0xece0c0 : 0xe4d6b0, [dx - 0.16 + i * 0.012, TOP + DH + 0.002 + i * 0.003, dz + 0.0 + i * 0.03], [0, -0.3 + i * 0.22, 0]);
    k.cyl(0.03, 0.035, 0.05, 8, 0x1a1a1a, [dx - 0.2, TOP + DH + 0.025, dz - 0.28]);
    beam(k, [dx - 0.2, TOP + DH + 0.03, dz - 0.28], [dx - 0.13, TOP + DH + 0.24, dz - 0.33], 0.006, 0.004, 0xf0f0e8);
    beam(k, [dx - 0.16, TOP + DH + 0.13, dz - 0.305], [dx - 0.11, TOP + DH + 0.27, dz - 0.34], 0.025, 0.003, 0xe8e8e0);   // the feather's vane
    k.cyl(0.09, 0.09, 0.012, 16, BRASS, [dx + 0.2, TOP + DH + 0.006, dz + 0.7]); k.cyl(0.07, 0.07, 0.006, 16, 0x8a6a2a, [dx + 0.2, TOP + DH + 0.015, dz + 0.7]);
    beam(k, [dx + 0.11, TOP + DH + 0.022, dz + 0.7], [dx + 0.29, TOP + DH + 0.022, dz + 0.7], 0.012, 0.006, BRASS);
    // a stool, pushed aside; the chest with iron bands; an hourglass on it
    const st = [dx + 0.1, -1.15];
    k.cyl(0.19, 0.19, 0.04, 12, WOOD, [st[0], TOP + 0.5, st[1]]);
    for (const a of [0.3, 2.4, 4.5]) beam(k, [st[0] + Math.cos(a) * 0.1, TOP + 0.48, st[1] + Math.sin(a) * 0.1], [st[0] + Math.cos(a) * 0.2, TOP, st[1] + Math.sin(a) * 0.2], 0.035, 0.035, DARK);
    const ch = [dx + 0.05, dz + 1.45];
    k.box(0.6, 0.42, 1.0, 0x5a3a22, [ch[0], TOP + 0.21, ch[1]]); k.box(0.64, 0.08, 1.04, 0x6a4a2a, [ch[0], TOP + 0.46, ch[1]]);
    for (const oz of [-0.36, 0, 0.36]) k.box(0.66, 0.52, 0.04, IRON, [ch[0], TOP + 0.26, ch[1] + oz]);
    k.box(0.02, 0.1, 0.08, BRASS, [ch[0] - 0.33, TOP + 0.36, ch[1]]);
    k.cyl(0.05, 0.05, 0.015, 10, WOOD, [ch[0], TOP + 0.508, ch[1] + 0.25]); k.cyl(0.05, 0.05, 0.015, 10, WOOD, [ch[0], TOP + 0.665, ch[1] + 0.25]);
    k.cyl(0.04, 0.004, 0.07, 10, 0xd8e0e8, [ch[0], TOP + 0.55, ch[1] + 0.25]); k.cyl(0.004, 0.04, 0.07, 10, 0xd8e0e8, [ch[0], TOP + 0.62, ch[1] + 0.25]);
    for (const a of [0.8, 2.4, 4.0, 5.6]) k.box(0.012, 0.15, 0.012, WOOD, [ch[0] + Math.cos(a) * 0.045, TOP + 0.587, ch[1] + 0.25 + Math.sin(a) * 0.045]);
    // a lantern hanging from the lean-to's beam
    k.box(0.12, 0.16, 0.12, 0x2a2a2a, [X1, TOP + Y1 - 0.25, -0.9]); k.cyl(0.001, 0.1, 0.07, 4, 0x2a2a2a, [X1, TOP + Y1 - 0.135, -0.9], [0, Math.PI / 4, 0]);
    beam(k, [X1, TOP + Y1 - 0.1, -0.9], [X1, TOP + Y1, -0.9], 0.01, 0.01, IRON);
    // ---- the triquetrum (Ptolemy's rulers), set up in the meridian on the west side: a post on
    // braced feet, the sighting arm hinged at its top (two brass sights), the graduated ruler hinged
    // low on the post, the arm's end resting on it; a plumb line to keep the post true.
    const TX = -HALF + 0.75, TZ = 0.55, PH = 2.7, L = 2.1, ZD = 36 * D2R;   // ZD: the star's distance from the zenith
    this.TRI = { x: TX, z: TZ };
    for (const a of [0, Math.PI / 2]) k.box(0.9, 0.07, 0.11, DARK, [TX, TOP + 0.035, TZ], [0, a + Math.PI / 4, 0]);
    for (const a of [0.785, 2.356, 3.927, 5.498]) beam(k, [TX + Math.cos(a) * 0.38, TOP + 0.07, TZ + Math.sin(a) * 0.38], [TX + Math.cos(a) * 0.05, TOP + 0.75, TZ + Math.sin(a) * 0.05], 0.05, 0.05, DARK);
    k.box(0.12, PH, 0.12, WOOD, [TX, TOP + 0.07 + PH / 2, TZ]); k.box(0.15, 0.05, 0.15, BRASS, [TX, TOP + PH + 0.095, TZ]);
    const T = [TX + 0.145, TOP + PH, TZ], E = [TX + 0.145, TOP + PH - L * Math.cos(ZD), TZ - L * Math.sin(ZD)], P0 = [TX + 0.09, TOP + PH - L, TZ];
    beam(k, T, E, 0.06, 0.05, 0x8a6a42);
    k.cyl(0.03, 0.03, 0.34, 8, BRASS, [TX + 0.07, TOP + PH, TZ], [0, 0, Math.PI / 2]); k.cyl(0.03, 0.03, 0.22, 8, BRASS, [TX + 0.06, P0[1], TZ], [0, 0, Math.PI / 2]);
    for (const f of [0.06, 0.94]) { const p = [T[0], T[1] + (E[1] - T[1]) * f, T[2] + (E[2] - T[2]) * f]; k.box(0.08, 0.1, 0.01, BRASS, [p[0], p[1] + 0.05, p[2]], [ZD - Math.PI / 2, 0, 0]); }
    const rd = new THREE.Vector3(0, E[1] - P0[1], E[2] - P0[2]); const rl = rd.length(); rd.normalize();
    const R1 = [P0[0], P0[1] + rd.y * (rl + 0.18), P0[2] + rd.z * (rl + 0.18)];
    beam(k, P0, R1, 0.05, 0.05, 0xb08a52);
    const pn = new THREE.Vector3(0, -rd.z, rd.y); if (pn.y < 0) pn.negate();   // the ruler's upper face
    for (let i = 1; i < 30; i++) { const s0 = 0.15 + i * (rl + 0.0 - 0.15) / 30, y = P0[1] + rd.y * s0 + pn.y * 0.028, z = P0[2] + rd.z * s0 + pn.z * 0.028; beam(k, [P0[0] - 0.02, y, z], [P0[0] + (i % 5 ? 0.0 : 0.02), y, z], 0.006, 0.006, 0x2a1a10); }
    k.box(0.12, 0.03, 0.03, BRASS, [TX + 0.06, TOP + PH - 0.08, TZ + 0.1]);
    beam(k, [TX + 0.1, TOP + PH - 0.09, TZ + 0.11], [TX + 0.1, TOP + 0.62, TZ + 0.11], 0.004, 0.004, 0xd8d0c0);
    k.cyl(0.001, 0.025, 0.07, 8, BRASS, [TX + 0.1, TOP + 0.6, TZ + 0.11], [Math.PI, 0, 0]);
    this.triSky = new THREE.Vector3(0, Math.cos(ZD), Math.sin(ZD));   // the way it points
    // ---- a quadrant on its stand by the south wall, and an iron brazier on legs
    const qx = -0.35, qz = HALF - 0.55, QC = qx + 0.31, QY = TOP + 1.05, qf = qz - 0.07;   // its face looks north, toward you
    k.box(0.1, 1.2, 0.1, DARK, [qx, TOP + 0.6, qz]); k.box(0.5, 0.06, 0.1, DARK, [qx, TOP + 0.03, qz]); k.box(0.1, 0.06, 0.5, DARK, [qx, TOP + 0.03, qz]);
    k.add(new THREE.CircleGeometry(0.62, 10, 0, Math.PI / 2).rotateY(Math.PI), 0x8a6a42, [QC, QY, qf]);
    k.add(new THREE.CircleGeometry(0.62, 10, 0, Math.PI / 2), 0x6a4a30, [QC - 0.62, QY, qf + 0.001], [0, 0, 0], [1, 1, 1]);
    for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI / 2, rr = i % 3 ? 0.56 : 0.53; beam(k, [QC - Math.cos(a) * rr, QY + Math.sin(a) * rr, qf - 0.004], [QC - Math.cos(a) * 0.61, QY + Math.sin(a) * 0.61, qf - 0.004], 0.006, 0.004, 0x2a1a10); }
    beam(k, [QC, QY, qf - 0.008], [QC - 0.6, QY, qf - 0.008], 0.03, 0.01, BRASS); beam(k, [QC, QY, qf - 0.008], [QC, QY + 0.6, qf - 0.008], 0.03, 0.01, BRASS);
    beam(k, [QC, QY, qf - 0.016], [QC - 0.62 * Math.cos(0.95), QY + 0.62 * Math.sin(0.95), qf - 0.016], 0.025, 0.012, 0xd0aa50);   // the alidade
    const bx = 0.95, bz = 2.2; this.BRAZIER = { x: bx, z: bz };
    k.cyl(0.32, 0.2, 0.26, 12, 0x2a2a2a, [bx, TOP + 0.6, bz]); k.cyl(0.34, 0.34, 0.04, 12, 0x3a3a3a, [bx, TOP + 0.73, bz]);
    k.cyl(0.29, 0.29, 0.02, 12, 0x4a1a0a, [bx, TOP + 0.7, bz]);
    for (let i = 0; i < 9; i++) { const a = r() * 6.28, rr = r() * 0.2; k.ball(0.05 + r() * 0.03, 0, i % 3 ? 0x2a1a14 : 0x6a2a10, [bx + Math.cos(a) * rr, TOP + 0.72, bz + Math.sin(a) * rr]); }
    for (const a of [0, 2.1, 4.2]) beam(k, [bx + Math.cos(a) * 0.18, TOP + 0.5, bz + Math.sin(a) * 0.18], [bx + Math.cos(a) * 0.3, TOP, bz + Math.sin(a) * 0.3], 0.035, 0.035, 0x1a1a1a);
    this.root.add(kb.mesh(BRICK), kt.mesh(TILES), k.mesh());
    // the shaft below the hatch glows faintly from a lamp on the stair
    const glowBelow = new THREE.Mesh(new THREE.PlaneGeometry(HH * 2 - 0.02, HH * 2 - 0.02).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a2412 }));
    glowBelow.position.set(HX, TOP - 2.75, HZ); this.root.add(glowBelow);
    // the candle on the desk and its light; the brazier's coals and glow
    const cx = dx + 0.2, cz = dz - 0.2;
    this.candle = new THREE.PointLight(0xffa860, 3.2, 9, 1.6); this.candle.position.set(cx, TOP + DH + 0.25, cz); this.root.add(this.candle);
    const ck = new Kit(); ck.cyl(0.022, 0.022, 0.14, 8, 0xf0e8d0, [0, 0.085, 0]); ck.cyl(0.05, 0.06, 0.015, 10, 0x8a6a3a, [0, 0.008, 0]); ck.cyl(0.012, 0.012, 0.02, 6, 0x8a6a3a, [0, 0.02, 0]);
    ck.box(0.035, 0.004, 0.025, 0xf0e8d0, [0.03, 0.017, 0.02]);   // a drip of wax on the dish
    this.candleStick = ck.mesh(); this.candleStick.position.set(cx, TOP + DH, cz); this.root.add(this.candleStick);
    this.flame = glow(0xffb050, 0.12); this.flame.position.set(cx, TOP + DH + 0.19, cz); this.root.add(this.flame);
    this.coals = glow(0xff6a20, 0.7, 0.8); this.coals.position.set(bx, TOP + 0.8, bz); this.root.add(this.coals);
    this.brazierLight = new THREE.PointLight(0xff7a30, 1.5, 5, 1.8); this.brazierLight.position.set(bx, TOP + 1.05, bz); this.root.add(this.brazierLight);
    this.smoke = makeSmoke(new THREE.Vector3(bx, TOP + 0.85, bz), { n: 6, rise: 3, size: 0.4, opacity: 0.15, color: 0x8a8a8a });
    this.root.add(this.smoke.group);
    // where people can't walk through
    this.G.world.blockers.push({ x: dx, z: dz, r: 0.75 }, { x: dx, z: dz + 1.3, r: 0.5 }, { x: TX, z: TZ, r: 0.5 }, { x: bx, z: bz, r: 0.45 }, { x: qx, z: qz, r: 0.35 }, { x: HX, z: HZ, r: 0.4 });
    this.HATCH = { x: HX, z: HZ + 0.12 };   // where people come up the ladder
    // the pile of manuscript pages (grows through ch8_08)
    const pk = new Kit(); for (let i = 0; i < 60; i++) pk.box(0.3, 0.006, 0.4, i % 7 ? 0xece0c0 : 0xd8c8a0, [((i * 37) % 7 - 3) * 0.003, 0.003 + i * 0.007, ((i * 11) % 5 - 2) * 0.004], [0, ((i * 13) % 9 - 4) * 0.02, 0]);
    this.pages = pk.mesh(); this.pages.position.set(dx - 0.17, TOP + DH, dz + 0.5); this.root.add(this.pages);
    this.pageN = 20; this.pages.geometry.setDrawRange(0, 20 * 36);
  }

  // Trees from the shared library (js/trees.js), each kind as one grove (2 draw calls). Early
  // November: the oaks and limes on the hillside are gold and russet, some already bare; dark pines
  // and spruces on the far hills and along the Vistula Spit across the lagoon.
  buildTrees() {
    const r = rng(44), near = [[], [], [], []];   // gold, russet, still green-brown, bare
    for (let i = 0; i < 170 && near.flat().length < 75; i++) {
      const x = -200 + r() * 420, z = -150 + r() * 330;
      if (x > -11 && x < 119 && z > -9 && z < 63) continue;                 // not in the close, nor against its walls
      if (z < -52 && z > -153 && x > -135 && x < 62) continue;               // not in the town's lanes
      if (x > 20 && x < 100 && z > 60 && z < 82) continue;                   // nor on the canons' houses outside the gate
      if (Math.hypot(x, z) < 14) continue;
      const k = r(), list = near[k < 0.38 ? 0 : k < 0.66 ? 1 : k < 0.8 ? 2 : 3];
      list.push({ x, y: groundHeight(x, z) - 0.1, z, s: 0.65 + r() * 0.6, yaw: r() * 6.283 });
    }
    const tint = (g, k) => { const c = g.leaves?.geometry.getAttribute('color'); if (!c) return; for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * k[0], c.getY(i) * k[1], c.getZ(i) * k[2]); c.needsUpdate = true; };
    const autumn = [[3.0, 1.25, 0.45], [3.2, 0.95, 0.4], [2.2, 1.12, 0.5]];   // the green leaf texture turned gold, russet, brown
    this.treeTris = 0;
    near.forEach((spots, i) => {
      if (!spots.length) return;
      const g = i < 3 ? grove(deciduousTree, spots, { detail: 'low', height: 10, shape: i === 1 ? 'elm' : 'oak', variants: 3, seed: 3 + i }) : grove(bareTree, spots, { detail: 'low', height: 10, variants: 3, seed: 9 });
      if (i < 3) tint(g, autumn[i]);
      this.root.add(g.group); this.treeTris += g.tris;
    });
    // dark forest on the far hills to the south and east: spruce and pine
    const far = [[], []];
    for (let i = 0; i < 80; i++) {
      const a = 60 + r() * 160, d = 420 + r() * 500, p = at(a, d);
      far[i % 2].push({ x: p.x, y: groundHeight(p.x, p.z) - 0.2, z: p.z, s: 1 + r() * 0.5, yaw: r() * 6.283 });
    }
    far.forEach((spots, i) => { const g = grove(conifer, spots, { detail: 'low', height: 15, type: i ? 'pine' : 'spruce', variants: 3, seed: 21 + i }); this.root.add(g.group); this.treeTris += g.tris; });
    // the pines of the Vistula Spit, two kilometres off across the water
    const spit = [];
    for (let i = 0; i < 50; i++) spit.push({ x: -2400 + i * 96 + r() * 50, y: WATER + 2.4, z: -2100 + (r() - 0.5) * 40, s: 1.4 + r() * 0.6, yaw: r() * 6.283 });
    const sg = grove(conifer, spit, { detail: 'low', height: 14, type: 'pine', variants: 3, seed: 31 }); this.root.add(sg.group); this.treeTris += sg.tris;
  }

  buildPeople() {
    const G = this.G;
    this.people = [];
    const add = (model, pos, look = {}, role = '') => {
      const P = makePerson({ model, seed: 11 + this.people.length * 7, ...look });
      P.g.position.copy(pos); P.role = role; this.root.add(P.g); this.people.push(P); return P;
    };
    // Copernicus at his desk, and (later) his young friend Rheticus
    this.cop = add('copernicus', new THREE.Vector3(HALF - 1.5, TOP, 0.15), { tunic: 0x7a1a1a, hair: 0x2a1a10, height: 1.74 }, 'cop');
    this.cop.g.rotation.y = Math.PI / 2; this.cop.glance = true;   // facing his desk (+x)
    this.friend = add('rheticus', new THREE.Vector3(this.HATCH.x, TOP - 2.5, this.HATCH.z), { tunic: 0x2a3a5a, hair: 0x6a4a2a, height: 1.72 }, 'friend');
    this.friend.g.visible = false;
    this.messenger = add('townsman', new THREE.Vector3(this.HATCH.x, TOP - 2.5, this.HATCH.z), { tunic: 0x5a4a32, hair: 0x3a2a1a, height: 1.7 }, 'messenger');
    this.messenger.g.visible = false;
    // Everyone else in the scene is a different person (no two copies of one model on screen at
    // once: 'canon' is Rheticus's face and 'townsman' is the messenger's, so neither is used again).
    // A night watchman walking the close's wall with his lantern
    const wy = 6.55, wz = 0.25;   // on the wall-walk's boards, behind the breastwork
    this.watch = add('sailor', new THREE.Vector3(20, wy, wz), { tunic: 0x4a4038, hair: 0x2a1a10, beard: true }, 'watch');
    this.watch.routine = [{ x: 60, z: wz, pose: 'idle', secs: 6, look: new THREE.Vector3(60, 0, -200) }, { x: 104, z: wz, pose: 'idle', secs: 4 }, { x: 10, z: wz, pose: 'idle', secs: 8, look: new THREE.Vector3(0, TOP + 1.5, 0) }];
    this.watchLamp = makeTorch({ len: 0.4, color: 0xffc070, size: 0.7 }); holdProp(this.watch, this.watchLamp, 'Right', [0, 0.02, 0.02]);
    // two robed canons crossing the close with lanterns, to and from the cathedral
    this.walkers = [];
    ['eratosthenes', 'instrument_maker'].forEach((model, i) => {
      const P = add(model, new THREE.Vector3(20 + i * 20, 0, 40), { tunic: 0x1a1a1e, hair: 0x6a6a6a, height: 1.72 }, 'canon');
      P.routine = [{ x: 28 - i * 2, z: 23, pose: 'idle', secs: 5 + i * 3 }, { x: 22 + i * 26, z: 42, pose: 'talk', secs: 6 + i * 2, look: new THREE.Vector3(30 + i * 20, 1.6, 44) }];
      P.ri = i; const L = makeTorch({ len: 0.35, color: 0xffc070, size: 0.6 }); holdProp(P, L, 'Right', [0, 0.02, 0.02]); P.lamp = L;
      this.walkers.push(P);
    });
    // two townsfolk in the market square, far below
    ['villager', 'builder_far'].forEach((model, i) => {
      const x = -54 + i * 6, z = -92 - i * 5, P = add(model, new THREE.Vector3(x, groundHeight(x, z), z), { tunic: [0x5a4a32, 0x6a2a2a][i], hair: 0x3a2a1a, height: 1.64 + i * 0.08 }, 'town');
      P.routine = [{ x: x + 6, z: z - 4, pose: i ? 'talk' : 'idle', secs: 6 + i }, { x: x - 4, z: z + 6, pose: 'work', secs: 5 }];
      this.walkers.push(P);
    });
    this.G.world.blockers.push(this.copBlk = { x: this.cop.g.position.x, z: this.cop.g.position.z, r: 0.3 });
  }

  buildLife() {
    this.life = new Life(this.root);
    this.horses = this.life.add(makeHerd('horse', { n: 5, area: { x: 70, z: 85, r: 12 }, height: groundHeight, seed: 4 }));
    this.dog = this.life.add(makeHerd('dog', { n: 1, area: { x: 40, z: 40, r: 10 }, height: groundHeight, seed: 7 }));
    this.cows = this.life.add(makeHerd('cow', { n: 6, area: { x: -60, z: 120, r: 25 }, height: groundHeight, seed: 9 }));
    this.gulls = this.life.add(makeFlock({ n: 10, center: new THREE.Vector3(-30, WATER + 25, -260), r: 60, height: 10, color: 0xd8dce0, size: 1.3, seed: 6, speed: 7 }));
    this.smokes = (this.chimneys || []).slice(0, 7).map((p) => this.life.add(makeSmoke(p, { n: 6, rise: 9, size: 1.4, opacity: 0.12, color: 0x9098a8 })));
  }

  // ---------- The sky model: the planets, the Sun, the trails, the circles ----------
  buildModel() {
    const M = this.model = new THREE.Group(); M.position.copy(ORR); M.rotation.x = TILT * D2R; M.scale.setScalar(2.2); M.visible = false; this.root.add(M);
    this.bodies = BODIES.map((B) => {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(B.size, 20, 14), new THREE.MeshBasicMaterial({ color: B.col, transparent: true, fog: false }));
      const halo = glow(B.col, B.size * 7, 0.7);
      const lab = label(B.name, 0.11); lab.position.y = B.size + 0.12; lab.material.opacity = 0;
      g.add(ball, halo, lab); M.add(g);
      return { B, g, ball, halo, lab };
    });
    // the Earth gets its oceans and land, and a tiny Moon going round it
    new THREE.TextureLoader().load(new URL('../../data/earth.jpg', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; const b = this.bodies[EARTH].ball; b.material.map = t; b.material.color.setHex(0xffffff); b.material.needsUpdate = true; });
    this.moonBall = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd8dce8, fog: false }));
    this.bodies[EARTH].g.add(this.moonBall);
    // the Sun
    this.sun = new THREE.Group(); M.add(this.sun);
    this.sunBall = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffe28a, fog: false }));
    this.sunGlow = glow(0xffb040, 1.4, 0.9); this.sunGlow2 = glow(0xfff0c0, 0.5, 1);
    this.sunLab = label('Sun', 0.13); this.sunLab.position.y = 0.3; this.sunLab.material.opacity = 0;
    this.sun.add(this.sunBall, this.sunGlow, this.sunGlow2, this.sunLab);
    // the trails (each planet's recent path) and the circles, as glowing dots
    this.trails = glowPoints(BODIES.length * TRAIL_N + 8, { sizeScale: 340 }); M.add(this.trails);
    const RINGS = 6 * 90 + 5 * 60 + 5 * 90 + 140 + 60;
    this.rings = glowPoints(RINGS, { sizeScale: 340 }); M.add(this.rings);
    // the band of stars round the outside (the zodiac), and Mars's path on it
    this.zodiac = glowPoints(240 + 160, { sizeScale: 340 }); M.add(this.zodiac);
    const Z = this.zodiac.userData, zr = rng(77);
    for (let i = 0; i < 240; i++) { const a = zr() * Math.PI * 2, rr = ZODIAC_R + (zr() - 0.5) * 0.18; Z.pos.set([Math.cos(a) * rr, (zr() - 0.5) * 0.25, -Math.sin(a) * rr], i * 3); const b = 0.3 + zr() * 0.7; Z.col.set([b * 0.8, b * 0.85, b], i * 3); Z.size[i] = 0.004 + zr() * zr() * 0.012; }
    this.zBase = Z.col.slice(0, 240 * 3);
    this.marsHits = [];
    // a faint glassy disc under it all, so it reads as one object floating there
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(ZODIAC_R + 0.15, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a5a9a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.disc.position.y = -0.02; M.add(this.disc);
    // the Sun you can grab (ch8_04): it floats out to your hand, then you send it into the middle
    this.handSun = new THREE.Group(); this.handSun.visible = false; this.root.add(this.handSun);
    this.handSun.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe28a, fog: false })), glow(0xffb040, 0.6, 0.9));
    // ch8_07: a big Earth, spinning on its axis
    this.bigEarth = new THREE.Group(); this.bigEarth.visible = false; this.bigEarth.position.copy(ORR); this.root.add(this.bigEarth);
    const eb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 32), new THREE.MeshStandardMaterial({ roughness: 0.9, transparent: true, opacity: 0, fog: false }));
    new THREE.TextureLoader().load(new URL('../../data/earth.jpg', import.meta.url).href, (t) => { t.colorSpace = THREE.SRGBColorSpace; eb.material.map = t; eb.material.needsUpdate = true; });
    this.bigEarthBall = eb; this.bigEarthTilt = new THREE.Group(); this.bigEarthTilt.rotation.z = -23.4 * D2R; this.bigEarthTilt.add(eb); this.bigEarth.add(this.bigEarthTilt);
    const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.6, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, fog: false })); this.bigEarthTilt.add(axis); this.axis = axis;
    this.bigEarthLight = new THREE.DirectionalLight(0xfff4e0, 0); this.bigEarthLight.position.set(ORR.x + 5, ORR.y + 2, ORR.z + 4); this.bigEarthLight.target = this.bigEarth; this.root.add(this.bigEarthLight);
  }

  // The book (ch8_09-10): De revolutionibus, printed in Nuremberg, and its diagram of the circles
  buildBook() {
    const k = new Kit();
    k.box(0.24, 0.05, 0.32, 0x6a3a1e, [0, 0, 0]); k.box(0.22, 0.045, 0.31, 0xece0c0, [0.008, 0, 0]);
    this.book = k.mesh(); this.book.visible = false; this.root.add(this.book);
    this.bookGlow = glow(0xffd890, 0.7, 0); this.book.add(this.bookGlow);
    // the diagram: Sol in the middle, the planets' circles round it, the stars outside, all labelled
    const tex = canvasTex(1024, 1024, (g, w) => {
      const c = w / 2; g.strokeStyle = '#ffe2a8'; g.fillStyle = '#ffe2a8'; g.lineWidth = 5; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,190,90,0.9)'; g.shadowBlur = 14;
      const names = ['Mercurius', 'Venus', 'Tellus', 'Mars', 'Iupiter', 'Saturnus', 'Stellarum fixarum sphaera'];
      names.forEach((n, i) => { const R = 90 + i * 60; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.stroke(); g.font = `italic ${i === 6 ? 26 : 30}px Georgia, serif`; g.fillText(n, c, c - R - 2 + 24); });
      g.beginPath(); g.arc(c, c, 34, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3a2a10'; g.font = 'bold 30px Georgia, serif'; g.fillText('Sol', c, c + 2);
    });
    this.diagram = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.diagram.visible = false; this.root.add(this.diagram);
    // ch8_09: the light of his work rising from the book as sparks, once he has laid it down
    this.sparks = glowPoints(60, { sizeScale: 260 }); this.sparks.visible = false; this.root.add(this.sparks);
    this.sp = Array.from({ length: 60 }, () => ({ a: Math.random() * 6.28, y: Math.random() * 2, r: 0.2 + Math.random() * 0.4, v: 0.3 + Math.random() * 0.7 }));
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.sunIt = {
      hint: 'Grab the Sun with GRIP and push it into the middle', deskHint: 'Click the Sun to put it in the middle',
      get disabled() { return self.s.sunHand !== 1; },
      reach(pos) { self.handSun.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.15); },
      aim(o, d) { self.handSun.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.2 ? t : Infinity; },
      onGrab() { G.act({ type: 'sun' }); }, onTouch() { G.act({ type: 'sun' }); },
    };
    G.interactables.push(this.sunIt);
  }

  act(a) {
    if (a.type === 'sun' && this.s.sunHand === 1) { this.s.sunHand = 2; this.G.events.emit('sfx', { k: 'swell' }); return true; }
    return this.journal.act(a);
  }
  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    G.events.emit('placePlayers', { x: this.start.pos.x, z: this.start.pos.z, yaw: this.start.yaw });
    await G.ui.fadeIn(3);
    // Aristarchus's question (his echo appears on the tower: js/wow/ch8.js)
    s.guide = at(345, 30, TOP + 9).toArray();
    await D.say('ch8_01');
    // Copernicus, by day a busy canon; at night, the planets
    s.guide = [HALF - 1.4, TOP + 2.3, -0.9];
    const l2 = D.sayAsync('ch8_02');
    await D.cue("That's Nicolaus"); s.cop = 'look';
    await D.cue('But at night'); s.cop = 'sight';
    await l2;
    // Ptolemy's sky, floating over the lagoon: circles on circles on circles
    s.guide = [ORR.x + 4.2, ORR.y + 1.2, ORR.z + 2]; s.phase = 'model'; s.cop = 'look'; s.model = 1; s.k = 1;
    const l3 = D.sayAsync('ch8_03');
    await D.cue('spinning circles'); s.epi = 1;
    await D.cue('Circles on circles'); s.epi = 2;
    await l3;
    // Take the Sun... and put it in the middle
    s.phase = 'sun'; s.cop = 'talk';
    const l4 = D.sayAsync('ch8_04');
    await D.cue('Take the Sun'); s.sunHand = 1;
    await l4;
    D.hint(G.mode === 'desktop' ? this.sunIt.deskHint : this.sunIt.hint, 9);
    await D.auto(() => s.sunHand >= 2, () => { s.sunHand = 2; }, { after: fast ? 0.3 : 1.5, timeout: fast ? 2 : 25 });
    if (s.sunHand < 2) s.sunHand = 2;
    G.ui.showHint('');
    await D.until(() => s.sunHand >= 3, fast ? 3 : 8);
    s.sunHand = 3;
    await D.until(() => s.k < 0.02, fast ? 3 : 10);
    // Each planet in its own circle, round the Sun
    s.phase = 'planets'; s.cop = 'point';
    const l5 = D.sayAsync('ch8_05');
    for (const [w, n] of [['Mercury', 1], ['Venus', 2], ['Earth', 3], ['Mars', 4], ['Jupiter', 5], ['Saturn', 6]]) { await D.cue(w); s.names = n; }
    await l5;
    // Mars from the Earth: overtaking on the inside lane
    s.phase = 'mars'; s.mars = 1; this.marsHits.length = 0;
    await D.say('ch8_06');
    await D.until(() => this.passDone, fast ? 2 : 14);
    // The Earth spins; the whole sky turns
    s.phase = 'spin'; s.mars = 0; s.names = 0;
    const l7 = D.sayAsync('ch8_07');
    await D.cue('Because the Earth'); s.spin = 1; s.model = 0;
    await l7;
    await D.until(() => this.spinDone, fast ? 2 : 14);
    s.spin = 0;
    // Thirty years of quiet work (and a few friends)
    s.phase = 'years'; s.cop = 'desk'; s.guide = null;
    const l8 = D.sayAsync('ch8_08');
    s.years = 1;
    await D.cue('a few friends'); s.friend = 1;
    await l8;
    // 1543: the book arrives
    s.phase = 'book'; s.book = 1;
    const l9 = D.sayAsync('ch8_09');
    await D.until(() => this.bookDelivered, fast ? 2 : 12);
    s.book = 2;
    await D.cue('on the day he died'); s.book = 3;
    await l9;
    // The revolution begins: the drawing rises into the sky
    s.phase = 'diagram'; s.diagram = 1;
    s.guide = [3.5, TOP + 3, -6];
    await D.say('ch8_10');
    await D.wait(fast ? 0.5 : 3);
    s.diagram = 0; s.guide = null;
    s.phase = 'journal';
    await this.journal.present(D);
    s.phase = 'done';
  }

  // ---------- Every frame ----------
  update(dt, t) {
    const G = this.G, s = this.s;
    this.t += dt;
    // the sky: night over the Baltic; ch8_07 turns it quickly through the hours
    if (s.spin && this.spinT >= 3) s.hour = 20.5 + Math.min(1, (this.spinT - 3) / 9) * 7 - Math.max(0, (this.spinT - 12)) * 2.4;
    else if (!s.spin) s.hour = damp(s.hour, 20.5 + this.t / 600, 1, dt);
    s.hour = Math.max(20.5, s.hour);
    const sun = sunAt(LAT, SUNLON, s.hour);
    G.sky.set(sun.az, sun.el);
    // a thin crescent Moon low in the west-south-west, setting over the water
    const mAz = 248 + (s.hour - 20.5) * 9, mEl = 13 - (s.hour - 20.5) * 6;
    G.sky.setMoon(mAz, mEl, 1, 0.16);
    this.moonLight ||= (() => { const L = new THREE.DirectionalLight(0xa8b8e8, 0.55); this.root.add(L, L.target); return L; })();
    this.moonLight.position.copy(at(mAz, 200, 60)); this.moonLight.intensity = 0.55 * clamp01((mEl + 2) / 8);
    // the glitter path runs across the lagoon toward the Moon
    G.camera.getWorldPosition(_a);
    const gl = this.glitter; gl.position.x = _a.x; gl.position.z = _a.z; gl.rotation.z = -mAz * D2R + Math.PI; gl.scale.set(60, 2600, 1);
    gl.material.opacity = 0.5 * clamp01((mEl + 1) / 6); this.glitTex.offset.y = -t * 0.02;
    for (const b of this.boats) { b.position.y = WATER + 0.25 + Math.sin(t * 0.8 + b.userData.ph) * 0.06; b.rotation.z = Math.sin(t * 0.6 + b.userData.ph) * 0.03; }
    // fire and candle
    const fl = 0.8 + 0.2 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1);
    this.candle.intensity = 3 * fl * (s.book === 3 ? 0.5 : 1); this.flame.scale.set(0.1 + 0.02 * fl, 0.16 * fl, 1);
    this.brazierLight.intensity = 1.2 + 0.5 * fl; this.coals.material.opacity = 0.6 + 0.3 * fl;
    this.smoke.update(dt, t);
    // pages pile up over the years
    if (s.years) this.pageN = Math.min(60, this.pageN + dt * 3);
    this.pages.geometry.setDrawRange(0, Math.floor(this.pageN) * 36);
    this.life.update(dt, t);
    this.sounds(dt);
    this.updatePeople(dt, t);
    this.updateModel(dt, t);
    this.updateBook(dt, t);
    const busy = this.journal.update();
    if (!busy && s.sunHand === 1 && this.handSet) { if (!this.guideAtSun) { this.guideAtSun = true; G.guide.flyTo(this.handSun.position.clone().add(_d.set(0.35, 0.25, 0))); } }
    else { if (this.guideAtSun) { this.guideAtSun = false; this.guideAt = null; G.guide.follow(); } guideUpdate(this, busy); }
  }

  sounds(dt) {
    const G = this.G, A = G.audio; if (!A.ctx) return;
    // the cathedral bell tolls the hour now and then; an owl in the trees; gulls over the water
    if ((this.bellT -= dt) <= 0) { this.bellT = 70 + Math.random() * 40; for (let i = 0; i < 3; i++) setTimeout(() => A.bell(_b.set(64, 30, 23), 0.5), i * 2600); }
    if ((this.owlT -= dt) <= 0) { this.owlT = 30 + Math.random() * 30; const o = A.out(at(120 + Math.random() * 100, 60, -5), 0.25, 10); A.tone(o, { f: 380, f2: 340, peak: 0.25, a: 0.05, d: 0.5 }); A.tone(o, { f: 360, f2: 320, peak: 0.2, a: 0.1, d: 0.9, t0: 0.7 }); }
    if ((this.gullT -= dt) <= 0) { this.gullT = 9 + Math.random() * 14; const p = this.gulls.group?.children?.[0]?.position || at(350, 200, -10); const o = A.out(_b.set(-30 + (Math.random() - 0.5) * 80, WATER + 20, -240), 0.2, 30); A.tone(o, { type: 'triangle', f: 1400, f2: 900, peak: 0.12, a: 0.02, d: 0.35 }); A.tone(o, { type: 'triangle', f: 1300, f2: 850, peak: 0.1, a: 0.02, d: 0.3, t0: 0.4 }); }
  }

  updatePeople(dt, t) {
    const G = this.G, s = this.s, C = this.cop;
    // Copernicus: at his desk writing, looking up, at the triquetrum, or talking with you
    const deskSpot = [HALF - 1.5, 0.15], sightSpot = [this.TRI.x + 0.5, this.TRI.z - 1.65];   // at the low end of the triquetrum's arm
    const HA = this.HATCH;
    // ch8_09 (book 3): he lays the book on his desk, then goes quietly down the stairs for the last time
    const leaving = s.book === 3, want = leaving ? (this.bookOnDesk ? [HA.x, HA.z] : deskSpot) : s.cop === 'sight' ? sightSpot : s.book >= 1 && s.book < 3 ? [0.8, 0.9] : deskSpot;
    const arrived = this.copDown ? true : walkToward(C, want[0], want[1], dt, { speed: 0.7, height: () => TOP });
    this.copBlk.x = C.g.position.x; this.copBlk.z = C.g.position.z;
    if (leaving) {
      if (!this.bookOnDesk && arrived && this.bookPassed) { this.bookOnDesk = true; dropProp(C, 'Right'); this.root.add(this.book); this.book.position.set(this.DESK.x - 0.15, this.DESK.y + 0.026, this.DESK.z - 0.53); this.book.rotation.set(0, 0.2, 0); this.book.scale.setScalar(1); this.sparkT = 4; }
      else if (this.bookOnDesk && arrived) { this.copDown = true; C.pose = 'walk'; C.stride = (C.stride || 0) + dt * 4; C.g.position.y -= dt * 0.9; if (C.g.position.y < TOP - 2.5) C.g.visible = false; }
    } else if (arrived) {
      C.look = null;
      if (s.cop === 'sight') { const sky = _a.set(this.TRI.x + 0.15, TOP + 2.7, this.TRI.z).addScaledVector(this.triSky, 30); C.g.rotation.y = dampAng(C.g.rotation.y, Math.atan2(sky.x - C.g.position.x, sky.z - C.g.position.z), 3, dt); C.pose = 'point'; C.pointAt.copy(sky); C.look = sky.clone(); }
      else if (s.book === 1) { C.pose = 'idle'; C.look = this.messenger.g.position.clone().setY(TOP + 1.5); }
      else if (s.book === 2) { C.pose = 'hold'; C.look = this.book.position.clone(); }
      else if (s.phase === 'model' || s.phase === 'sun' || s.phase === 'planets' || s.phase === 'mars') { C.g.rotation.y = dampAng(C.g.rotation.y, Math.PI, 2, dt); C.pose = s.cop === 'point' ? 'point' : s.cop === 'talk' ? 'talk' : 'idle'; C.pointAt.copy(ORR); C.look = ORR.clone(); }
      else if (s.phase === 'spin') { C.pose = 'idle'; C.look = _a.set(C.g.position.x, TOP + 30, C.g.position.z - 20).clone(); }
      else if (s.cop === 'look') { C.pose = 'idle'; C.look = null; }
      else { C.g.rotation.y = dampAng(C.g.rotation.y, Math.PI / 2, 3, dt); C.pose = s.friend && this.friendHere ? 'talk' : 'write'; }
    }
    C.glance = s.phase === 'arrive' || s.cop === 'look';
    if (C.g.visible) animatePerson(C, t, dt);
    // Rheticus: up the stairs, to the desk, talking over the work
    const F = this.friend;
    if (s.friend) {
      F.g.visible = true;
      if (F.g.position.y < TOP) { F.g.position.y = Math.min(TOP, F.g.position.y + dt * 1.2); F.pose = 'walk'; F.stride = (F.stride || 0) + dt * 5; }
      else if (walkToward(F, 0.6, 0.6, dt, { speed: 0.8, height: () => TOP })) { this.friendHere = true; F.pose = s.book ? 'idle' : 'talk'; F.look = C.g.position.clone().setY(TOP + 1.6); F.g.rotation.y = dampAng(F.g.rotation.y, Math.atan2(C.g.position.x - F.g.position.x, C.g.position.z - F.g.position.z), 3, dt); }
      if (s.book === 3) { F.pose = 'idle'; F.look = this.book.position.clone(); }
      animatePerson(F, t, dt);
    }
    // the messenger with the printed book
    const Ms = this.messenger;
    if (s.book === 1 && !this.bookDelivered) {
      Ms.g.visible = true;
      if (!this.msgBook) { this.msgBook = true; this.book.visible = true; holdProp(Ms, this.book, 'Right', [0, 0.06, 0.05]); }
      if (Ms.g.position.y < TOP) { Ms.g.position.y = Math.min(TOP, Ms.g.position.y + dt * 1.2); Ms.pose = 'walk'; Ms.stride = (Ms.stride || 0) + dt * 5; }
      else if (walkToward(Ms, 0.1, 0.9, dt, { speed: 0.9, height: () => TOP })) { Ms.pose = 'hold'; Ms.look = C.g.position.clone().setY(TOP + 1.6); this.holdT = (this.holdT || 0) + dt; if (this.holdT > 1.5) this.bookDelivered = true; }
    }
    if (this.bookDelivered && !this.bookPassed) { this.bookPassed = true; dropProp(Ms, 'Right'); holdProp(C, this.book, 'Right', [0, 0.06, 0.05]); }
    if (this.bookDelivered) { walkToward(Ms, HA.x, HA.z, dt, { speed: 0.9, height: () => TOP }); if (Math.hypot(Ms.g.position.x - HA.x, Ms.g.position.z - HA.z) < 0.3) { Ms.g.position.y -= dt * 1.2; if (Ms.g.position.y < TOP - 2.5) Ms.g.visible = false; } }
    if (Ms.g.visible) animatePerson(Ms, t, dt);
    // the town and the close
    runRoutine(this.watch, dt, { height: () => 6.55, speed: 0.8 }); animatePerson(this.watch, t, dt); this.watchLamp.userData.flicker(t);
    for (const P of this.walkers) { runRoutine(P, dt, { height: groundHeight, speed: 0.9 }); animatePerson(P, t, dt); P.lamp?.userData.flicker(t); }
  }

  updateModel(dt, t) {
    const G = this.G, s = this.s, M = this.model, fast = G.params.has('fast') ? 3 : 1;
    this.modelV = damp(this.modelV || 0, s.model ? 1 : 0, 1.2, dt);
    M.visible = this.modelV > 0.01;
    // the Sun flying from your hand into the middle
    if (s.sunHand === 1) {
      if (!this.handSet) { this.handSet = true; G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize(); this.handSun.position.copy(_a).addScaledVector(_b, 0.5).add(_c.set(0, -0.25, 0)); this.sunFrom = null; }
      this.handSun.visible = true; this.handSun.position.y += Math.sin(t * 2) * 0.0006;
      this.handSun.scale.setScalar(1 + 0.08 * Math.sin(t * 4));
    }
    if (s.sunHand === 2) {
      if (!this.sunFrom) { this.sunFrom = this.handSun.position.clone(); this.sunFly = 0; }
      this.sunFly += dt / 2.2 * fast;
      M.localToWorld(_a.set(0, 0, 0));
      this.handSun.position.lerpVectors(this.sunFrom, _a, ease(this.sunFly)); this.handSun.position.y += Math.sin(Math.PI * Math.min(1, this.sunFly)) * 0.8;
      if (this.sunFly >= 1) { this.handSun.visible = false; if (G.isHost) s.sunHand = 3; this.G.audio.ctx && this.G.audio.chime(this.handSun.position, 0.5); }
    }
    if (s.sunHand >= 3) this.handSun.visible = false;
    // seen from the Earth (k = 1) or from the Sun (k = 0): once the Sun is in, the view slides over
    if (s.sunHand >= 3 && G.isHost) s.k = Math.max(0, s.k - dt / 6 * fast);
    if (!M.visible) return;
    // model time: brisk while the loops are on show, slow for Mars, held still while the Earth spins
    const rate = s.phase === 'mars' ? this.marsRate(dt) : s.sunHand === 1 || s.sunHand === 2 ? 0.08 : 0.35;
    this.tm += dt * rate * fast;
    const k = s.k, E = helio(EARTH, this.tm, _d).clone();
    const pos = (i, tt, out) => { helio(i, tt, out); const e = helio(EARTH, tt, _c); return out.addScaledVector(e, -k); };
    // bodies
    const show = this.modelV;
    this.bodies.forEach((b, i) => {
      pos(i, this.tm, b.g.position);
      const dim = s.phase === 'mars' && i !== EARTH && i !== MARS ? 0.25 : 1;
      b.ball.material.opacity = show * dim; b.halo.material.opacity = 0.7 * show * dim;
      const named = s.names > i;
      b.lab.material.opacity = damp(b.lab.material.opacity, named ? show : 0, 3, dt);
    });
    this.sun.position.copy(E).multiplyScalar(-k);
    this.sun.visible = s.sunHand >= 3 || k > 0.99;
    this.sunBall.scale.setScalar(s.sunHand >= 3 ? 1 : 0.7);
    this.sunGlow.material.opacity = 0.9 * show; this.sunGlow.scale.setScalar(1.4 + 0.1 * Math.sin(t * 3));
    this.sunLab.material.opacity = damp(this.sunLab.material.opacity, s.phase === 'planets' && s.names === 0 ? show : 0, 3, dt);
    const mp = this.tm / 0.0748 * Math.PI * 2; this.moonBall.position.set(Math.cos(mp) * 0.11, 0, -Math.sin(mp) * 0.11);
    this.disc.material.opacity = 0.06 * show;
    // trails: each body's recent path, fading toward its tail
    const T = this.trails.userData;
    BODIES.forEach((B, i) => {
      const len = B.trail * (0.35 + 0.65 * k), c = new THREE.Color(B.col);
      for (let j = 0; j < TRAIL_N; j++) {
        const f = j / TRAIL_N, tt = this.tm - f * len;
        pos(i, tt, _a);
        const o = (i * TRAIL_N + j) * 3, a = (1 - f) * show * (s.phase === 'mars' && i !== MARS && i !== EARTH ? 0.15 : 0.75);
        T.pos.set([_a.x, _a.y, _a.z], o); T.col.set([c.r * a, c.g * a, c.b * a], o); T.size[i * TRAIL_N + j] = 0.022;
      }
    });
    // the Sun's own trail while it's still going round the Earth
    for (let j = 0; j < 8; j++) { const o = (BODIES.length * TRAIL_N + j) * 3; helio(EARTH, this.tm - j * 0.03, _a).multiplyScalar(-k); T.pos.set([_a.x, _a.y, _a.z], o); const a = k * show * (1 - j / 8) * 0.8; T.col.set([a, a * 0.8, a * 0.4], o); T.size[BODIES.length * TRAIL_N + j] = 0.05; }
    T.commit();
    // circles: the planets' orbits (bright once the Sun is in the middle); Ptolemy's big circles
    // (deferents) and the small circles riding on them (epicycles) while seen from the Earth
    const R = this.rings.userData; let n = 0;
    const epiOn = Math.min(1, s.epi) * k * show, orbOn = (1 - k) * show;
    const dot = (x, y, z, r, g, b, sz) => { R.pos.set([x, y, z], n * 3); R.col.set([r, g, b], n * 3); R.size[n] = sz; n++; };
    BODIES.forEach((B, i) => { const c = new THREE.Color(B.col); for (let j = 0; j < 90; j++) { const a = j / 90 * Math.PI * 2; dot(Math.cos(a) * B.r, 0, -Math.sin(a) * B.r, c.r * orbOn * 0.35, c.g * orbOn * 0.35, c.b * orbOn * 0.35, 0.012); } });
    const epiK = s.epi >= 2 ? 1 : 0.45;
    BODIES.forEach((B, i) => {
      if (i === EARTH) return;
      const inner = B.r < BODIES[EARTH].r;
      // outer planet: deferent radius r_p round the Earth, epicycle radius r_e round the deferent point
      // inner planet: deferent = the Sun's circle (r_e), epicycle radius r_p round the Sun
      const defR = inner ? BODIES[EARTH].r : B.r, epiR = inner ? B.r : BODIES[EARTH].r;
      const c = new THREE.Color(B.col);
      helio(inner ? EARTH : i, this.tm, _a); if (inner) _a.multiplyScalar(-1);
      for (let j = 0; j < 90; j++) { const a = j / 90 * Math.PI * 2; const v = epiOn * 0.28; dot(Math.cos(a) * defR, 0, -Math.sin(a) * defR, c.r * v, c.g * v, c.b * v, 0.01); }
      for (let j = 0; j < 60; j++) { const a = j / 60 * Math.PI * 2; const v = epiOn * epiK * 0.7; dot(_a.x + Math.cos(a) * epiR, 0, _a.z - Math.sin(a) * epiR, c.r * v, c.g * v, c.b * v, 0.014); }
    });
    // ch8_06: the sight line from the Earth through Mars, out to the stars; where it lands, a red mark
    const mOn = this.marsV = damp(this.marsV || 0, s.mars ? 1 : 0, 2, dt);
    const e = this.bodies[EARTH].g.position, m = this.bodies[MARS].g.position;
    _b.subVectors(m, e).normalize();
    // where the line meets the star band (a circle of radius ZODIAC_R round the Sun)
    const bq = e.dot(_b), cq = e.lengthSq() - ZODIAC_R * ZODIAC_R, tHit = -bq + Math.sqrt(Math.max(0, bq * bq - cq));
    _c.copy(e).addScaledVector(_b, tHit);
    for (let j = 0; j < 140; j++) { const f = j / 139; _a.copy(e).addScaledVector(_b, f * tHit); const v = mOn * 0.55 * (0.4 + 0.6 * ((j + Math.floor(t * 12)) % 4 === 0 ? 1 : 0.3)); dot(_a.x, _a.y, _a.z, v, v * 0.45, v * 0.3, 0.012); }
    if (mOn > 0.5 && (this.lastHit == null || this.lastHit.distanceTo(_c) > 0.025)) { this.lastHit = _c.clone(); this.marsHits.push(_c.clone()); if (this.marsHits.length > 60) this.marsHits.shift(); }
    for (let j = 0; j < 60; j++) { const h = this.marsHits[j]; if (h) dot(h.x, h.y + 0.02, h.z, mOn, mOn * 0.35, mOn * 0.2, 0.03 + 0.02 * (j === this.marsHits.length - 1)); else dot(0, 0, 0, 0, 0, 0, 0); }
    while (n < R.size.length) dot(0, 0, 0, 0, 0, 0, 0);
    R.commit();
    // the stars of the band, brighter while we watch Mars against them
    const Z = this.zodiac.userData; for (let i = 0; i < 240 * 3; i++) Z.col[i] = this.zBase[i] * show * (0.4 + 0.6 * mOn); Z.commit();
    // the big spinning Earth (ch8_07)
    this.spinV = damp(this.spinV || 0, s.spin ? 1 : 0, 1.5, dt);
    if (s.spin) { this.spinT = (this.spinT || 0) + dt * fast; if (this.spinT > 15) this.spinDone = true; }
    this.bigEarth.visible = this.spinV > 0.01;
    const fadeE = this.spinV * clamp01(1 - ((this.spinT || 0) - 4) / 2);
    this.bigEarthBall.material.opacity = fadeE; this.axis.material.opacity = fadeE * 0.9; this.bigEarthLight.intensity = fadeE * 2.5;
    this.bigEarthBall.rotation.y += dt * 1.6;
  }

  // Mars time: slow while Earth catches up and passes it (the loop), so you can watch it
  marsRate(dt) {
    const e = helio(EARTH, this.tm, _a).clone(), m = helio(MARS, this.tm, _b);
    const ang = Math.abs(Math.atan2(e.x * m.z - e.z * m.x, e.x * m.x + e.z * m.z));   // angle between them, seen from the Sun
    if (ang < 0.25) this.passing = true;
    if (this.passing && ang > 0.9) this.passDone = true;
    return ang < 1.2 ? 0.06 + 0.12 * ang : 0.35;
  }

  updateBook(dt, t) {
    const s = this.s, G = this.G;
    this.bookGlow.material.opacity = damp(this.bookGlow.material.opacity, s.book >= 2 ? 0.8 + 0.2 * Math.sin(t * 2) : 0, 2, dt);
    // the light of his life's work, rising from the book on his desk
    this.sparks.visible = (this.sparkT || 0) > 0;
    if (this.sparks.visible) {
      this.sparkT -= dt; const S = this.sparks.userData, c = this.book.position;
      this.sp.forEach((q, i) => {
        q.a += dt * q.v * 1.5; q.y += dt * q.v * 0.8; if (q.y > 6) q.y = 0;
        S.pos.set([c.x + Math.cos(q.a) * q.r * (1 + q.y * 0.2), c.y + q.y, c.z + Math.sin(q.a) * q.r * (1 + q.y * 0.2)], i * 3);
        const v = Math.max(0, Math.min(1, this.sparkT / 2)) * (1 - q.y / 6); S.col.set([v, v * 0.85, v * 0.5], i * 3); S.size[i] = 0.03;
      });
      S.commit();
    }
    // the diagram: lifts off the book, grows, and rises out over the lagoon into the stars
    this.diagV = damp(this.diagV || 0, s.diagram ? 1 : 0, s.diagram ? 0.5 : 1.2, dt);
    if (s.diagram) this.diagT = (this.diagT || 0) + dt * (G.params.has('fast') ? 3 : 1);
    const D = this.diagram; D.visible = this.diagV > 0.01;
    if (D.visible) {
      const k = ease(Math.min(1, (this.diagT || 0) / 14));
      this.book.getWorldPosition(_a); _b.copy(at(350, 60, TOP + 38));
      D.position.lerpVectors(_a.setY(_a.y + 0.3), _b, k); D.scale.setScalar(0.4 + k * 60);
      G.camera.getWorldPosition(_c); D.lookAt(_c);
      D.material.opacity = this.diagV * (0.9 - 0.3 * k);
    }
  }

  dispose() {
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.sky.hideMoon();
  }
}

// The journal page: the Sun in the middle with the planets' circles, and Mars's backward loop
// explained as the Earth overtaking it
function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
  g.fillText('Copernicus, 1543: the Sun in the middle', 40, 70);
  const cx = 270, cy = 380;
  g.strokeStyle = INK; g.lineWidth = 2;
  [40, 70, 100, 140, 190, 235].forEach((r) => { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); });
  g.fillStyle = '#e0952a'; g.beginPath(); g.arc(cx, cy, 18, 0, Math.PI * 2); g.fill();
  const dots = [[40, 1.2, '#8a7a6a'], [70, 3, '#d8c890'], [100, 0.6, '#3a6aaa'], [140, 0.4, '#b5431d'], [190, 2.3, '#a08a6a'], [235, 4.4, '#b09a60']];
  for (const [r, a, c] of dots) { g.fillStyle = c; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy - Math.sin(a) * r, 8, 0, Math.PI * 2); g.fill(); }
  // Earth overtaking Mars: lines of sight, and the backward loop on the stars
  const ox = 640, oy = 560;
  g.fillStyle = INK; g.font = 'italic 28px Georgia, serif';
  g.fillText('Earth (inside lane) passes Mars:', 560, 150);
  g.strokeStyle = 'rgba(58,42,24,0.5)'; g.setLineDash([6, 6]);
  const pts = [];
  for (let i = 0; i < 7; i++) {
    const ex = ox + (i - 3) * 50, mx = ox + (i - 3) * 30, ex2 = mx + (mx - ex) * 3.6;
    g.beginPath(); g.moveTo(ex, oy); g.lineTo(ex2, 230); g.stroke(); pts.push(ex2);
    g.fillStyle = '#3a6aaa'; g.beginPath(); g.arc(ex, oy, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b5431d'; g.beginPath(); g.arc(mx, 440, 6, 0, Math.PI * 2); g.fill();
  }
  g.setLineDash([]);
  g.strokeStyle = '#b5431d'; g.lineWidth = 4; g.beginPath();
  pts.forEach((x, i) => g.lineTo(x, 230 - Math.sin(i / 6 * Math.PI) * 30)); g.stroke();
  g.fillStyle = INK; g.font = 'italic 30px Georgia, serif';
  g.fillText('Mars seems to go backward. No little circles needed.', 40, h - 40);
}
