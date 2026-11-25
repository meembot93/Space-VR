// Era 2, Chapter 7 (n 14): Sputnik. Tyuratam (later called Baikonur), Kazakhstan, Soviet Union,
// the night of 4 October 1957. The last chapter of Era 2: the first thing people ever launched into orbit.
//
// 1. Night at the pad. The R-7 stands over its flame pit, hung in the four arms of the launch
//    structure: the core stage and its four tapered boosters flaring out at the bottom like a skirt.
//    Searchlights, white vapour pouring off the frosty oxygen tanks, trucks and engineers, the cold
//    steppe wind, a full starry sky. Korolev walks out of the bunker and looks up at his rocket; a
//    glowing echo of Tsiolkovsky (whose books he read as a young man) appears beside him.
// 2. You ride the lift up the service tower to the nose. The nose fairing opens: inside is Sputnik,
//    a polished ball with four long antennas, shining in the searchlights. Then it closes.
// 3. The countdown, from the viewing spot 330 m away: the service tower lowers, sirens, the lights
//    dim. No music yet: Meem's launch music starts right at liftoff (MOMENTS in js/music.js).
// 4. Liftoff: the desert flashes orange, a wall of steam and dust rolls out, the controllers rumble,
//    the roar arrives late (sound takes about a second to cross 330 m), and the rocket climbs on a
//    pillar of fire. High up, the four boosters fall away in a glowing cross: the "Korolev cross".
// 5. You ride along: the Earth falls away and curves, dawn on its edge; the engine stops, the nose
//    fairing pops off, Sputnik springs free and its antennas swing out.
// 6. "Listen! The signal!": a glowing window opens onto the radio room; the engineer jumps up.
// 7. Orbit in fast motion: day, night, city lights, the beep all the way.
// 8. Rooftops at dusk: families with radios watch the moving light (the rocket's core stage) cross
//    the sky. Sputnik drifts past you, beeping, like at the very end of Era 1.
// 9. A hill at night: everyone from both eras stands round you as glowing echoes, all looking up at
//    the moving light. Then a huge Moon rises: Era 3, the Space Race.
//
// The pad is built in one group (`site`) with the rocket at its origin. You always stand near the
// world's origin; the site slides under you to put you at the pad, on the lift, or at the viewing spot.
// World axes: -Z north, +X east, +Y up.
import * as THREE from 'three';
import { Kit, FLAT, segs } from '../kit.js';
import { makePerson, animatePerson, runRoutine, walkToward, holdProp } from '../people.js';
import { makeFlock, makeSmoke, makeCloth, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';
import { glowPoints, glowSprite, textSprite, shimmer, whoosh, awe } from '../wow/fx.js';
import { Echo } from '../wow/echo.js';
import { Space, lonLat } from '../wow/space.js';
import { D2R, ease, clamp01, at, sunAt, windows, label, Journal, INK, guideUpdate } from '../era2/common.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadProps } from '../props.js';

// Meem's R-7 and Sputnik (Tripo models), cut into the pieces that move on their own by
// tools/models/split_r7.mjs: r7_parts.glb has the core stage above the boosters, four boosters and
// the two halves of the nose fairing (metres, rocket coordinates); sputnik_ball.glb is Sputnik's
// ball, 58 cm across, without antennas (they're added here so they can swing open).
// The chapter waits for them (this module only finishes loading once they're in).
const GLB = (f) => new GLTFLoader().loadAsync(new URL('../../models/' + f, import.meta.url).href).catch((e) => { console.warn('Model failed', f, e); return null; });
const [R7, SPUTNIK] = await Promise.all([GLB('r7_parts.glb'), GLB('sputnik_ball.glb')]);
const r7Part = (name) => R7?.scene.getObjectByName(name);
// Meem's tanker truck, the tracking station's receiver, a family's radio and an apartment block (models/props)
const PROPS = await loadProps(['soviet_truck', 'radio_receiver', 'family_radio', 'apartment_block'],
  { soviet_truck: { z: 7 }, radio_receiver: { h: 1.75 }, family_radio: { h: 0.34 }, apartment_block: { x: 20 } });   // (the truck's length is along its z)

const LAT = 45.92, LON = 63.34, YEAR = 1957, SUNLON = 191, HOUR = 23.7;   // 22:28 Moscow time = local midnight
const MOON = { az: 230, el: 14, phase: 0.36 };                               // a waxing gibbous Moon, low in the south-west
const BASE = 0.6;                     // the rocket hangs with its engines just above the pad
const APRON = 0.25;                   // the concrete pad's top
const PS = new THREE.Vector3(-9, 0, 31);              // where you stand at the pad
const LIFT0 = 6.4, LIFT1 = 2.6;                       // the lift cage (x), and the end of the platform by the nose
const DECK = 26.0;                                    // the top platform, level with Sputnik
const VS = at(205, 330);                              // the viewing spot, 330 m south-south-west of the pad
const DOOR = new THREE.Vector3(-25.5, 0, 22);         // the bunker's door
const KS = new THREE.Vector3(-13.5, 0, 25.5);         // where Korolev stops to look up
const LAUNCH_AZ = 37;                                 // Sputnik's orbit (65 degrees) means heading north-east
const SPEED_OF_SOUND = 343;
const ROOF = 12.5;                                    // the rooftop you stand on in the town
const ER = 400;                                       // the Earth's radius out in space (m)
const N1 = noise2(141), N2 = noise2(143), N3 = noise2(147);
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), ONE = new THREE.Vector3(1, 1, 1);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _col = new THREE.Color();
const yawTo = (bearing) => -bearing * D2R;           // placePlayers yaw for a compass bearing
const bearing = (dx, dz) => (Math.atan2(dx, -dz) / D2R + 360) % 360;

// ---------- The ground at the launch site (site coordinates: the rocket at the origin) ----------
const onApron = (x, z) => Math.abs(x) < 28 && Math.abs(z) < 28;
const inSlot = (x, z) => Math.abs(x) < 6 && z < 6 && z > -28;
function terrain(x, z) {
  const r = Math.min(Math.hypot(x, z), Math.hypot(x - VS.x, z - VS.z));
  return (N1(x / 300, z / 300) - 0.5) * 10 * clamp01((r - 150) / 400) + (N2(x / 30, z / 30) - 0.5) * 0.6 * clamp01((r - 60) / 80);
}
export function siteH(x, z) { return onApron(x, z) && !inSlot(x, z) ? APRON : terrain(x, z); }
const stepH = (x, z) => x > DOOR.x && x < DOOR.x + 1.3 && Math.abs(z - DOOR.z) < 1.1 ? APRON + 0.16 * clamp01((DOOR.x + 1.3 - x) / 0.4) : siteH(x, z);   // the bunker door's step (he steps down off its front edge)
const ROADS = [
  [[28, 12], [140, 30], [320, 44], [900, 90]],
  [[-24, 30], [-140, 300], [-250, 552]],
  [[-140, 300], [-330, 880]],
];
const RAIL = [[4, 28], [4, 170], [-330, 860]];
function distPoly(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// ---------- Little geometry helpers ----------
// A bar from a to b, t thick (any direction), into a Kit
function bar(k, a, b, t, col) {
  const d = _e.subVectors(b, a), len = d.length(); if (len < 1e-4) return;
  const g = new THREE.BoxGeometry(t, len, t);
  _q.setFromUnitVectors(Y, d.normalize());
  g.applyMatrix4(_m.compose(_d.addVectors(a, b).multiplyScalar(0.5), _q, ONE));
  k.add(g, col);
}
// A square lattice truss from a to b, w wide at a and w2 at b: four legs, rings every `step`, zigzag braces.
// skip(j, face) leaves out a brace (a doorway).
function truss(k, a, b, w, w2, col, { step = 2.6, leg = 0.16, br = 0.07, skip = null } = {}) {
  const ax = _a.subVectors(b, a).clone(), L = ax.length(); ax.normalize();
  const u = new THREE.Vector3().crossVectors(ax, Math.abs(ax.y) > 0.9 ? X : Y).normalize(), v = new THREE.Vector3().crossVectors(ax, u);
  const S = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  const corner = (f, i) => { const ww = lerp(w, w2, f) / 2; return a.clone().addScaledVector(ax, f * L).addScaledVector(u, S[i][0] * ww).addScaledVector(v, S[i][1] * ww); };
  for (let i = 0; i < 4; i++) bar(k, corner(0, i), corner(1, i), leg, col);
  const n = Math.max(1, Math.round(L / step));
  for (let j = 0; j <= n; j++) for (let i = 0; i < 4; i++) bar(k, corner(j / n, i), corner(j / n, (i + 1) % 4), br, col);
  for (let j = 0; j < n; j++) for (let i = 0; i < 4; i++) { if (skip?.(j, i)) continue; bar(k, corner(j / n, j % 2 ? i : (i + 1) % 4), corner((j + 1) / n, j % 2 ? (i + 1) % 4 : i), br, col); }
}
// A turned shape (profile [[r, y], ...]) with vertex colours from colorAt(y, x, z); ready to push into a Kit
function lathe(pts, seg, colorAt, phiStart = 0, phiLen = Math.PI * 2) {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, phiStart, phiLen).toNonIndexed();
  g.deleteAttribute('uv');
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { _col.setHex(colorAt(p.getY(i), p.getX(i), p.getZ(i))); c.set([_col.r, _col.g, _col.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

// ---------- The R-7 ----------
const BAND = 0x6a6e76;
// Meem's model gives the boosters, the core stage above them and the nose fairing. The core stage
// between the boosters is built here (Tripo's mesh only had the strips that showed between them):
// narrow at the bottom (it fits between the boosters), widening up to the model's core at 18.8 m,
// and on inside it a little, so the join never shows a gap.
const CORE = [[0.001, 0], [1.0, 0], [1.04, 1.2], [1.08, 3], [1.15, 6], [1.24, 10], [1.34, 14], [1.44, 17], [1.5, 18.6], [1.5, 20.2], [0.001, 20.2]];
const CORE_TOP = 18.8;   // where Meem's core stage starts
// The nose fairing over Sputnik (Meem's, in two halves, north and south, that open on hinges at the bottom)
const NOSE = [[1.48, 0], [1.46, 0.3], [1.37, 0.46], [1.25, 0.76], [1.0, 1.37], [0.79, 1.98], [0.55, 2.59], [0.4, 2.9], [0.15, 3.2], [0.001, 3.66]];
const NOSE_Y = r7Part('nose_n')?.position.y ?? 25.2;
const BOOSTERS = [90, 180, 270, 0];   // bearings round the core of booster0..3 in r7_parts.glb
const B_AXIS = 2.6;                   // the boosters' axes are this far from the core's at the bottom

// The radius of a lathe profile at height y
function rAt(prof, y) {
  for (let i = 1; i < prof.length; i++) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; if (y1 > y0 && y >= y0 && y <= y1) return lerp(r0, r1, (y - y0) / (y1 - y0)); }
  return prof[prof.length - 2][0];
}
// A rocket engine: the combustion chamber, the throat and the bell (open below, dark inside), hanging
// down from y = 0. r = the bell's mouth.
function engine(k, x, z, r, len, { chamber = true } = {}) {
  const N = 16, bell = [[r * 0.34, 0], [r * 0.4, -len * 0.12], [r * 0.6, -len * 0.42], [r * 0.82, -len * 0.74], [r, -len], [r * 1.04, -len * 1.01]];
  k.add(new THREE.LatheGeometry(bell.map(([a, b]) => new THREE.Vector2(a, b)), segs(N)), 0x4a4644, [x, 0, z]);
  // inside the bell: sooty, a little warm at the throat
  const inner = bell.slice(0, 5).map(([a, b]) => new THREE.Vector2(a * 0.93, b)).reverse();
  k.add(new THREE.LatheGeometry(inner, segs(N)), 0x1a1614, [x, 0, z]);
  k.add(new THREE.TorusGeometry(r * 1.02, 0.018, 4, segs(N)), 0x7a746c, [x, -len, z], [Math.PI / 2, 0, 0]);   // the stiffening ring at the lip
  k.add(new THREE.TorusGeometry(r * 0.6, 0.014, 4, segs(N)), 0x6a645c, [x, -len * 0.42, z], [Math.PI / 2, 0, 0]);
  if (chamber) { k.cyl(r * 0.42, r * 0.36, len * 0.3, 12, 0x5a5652, [x, len * 0.15, z]); k.cyl(r * 0.46, r * 0.46, 0.05, 12, 0x8a847a, [x, len * 0.3, z]); }
}
// A ring frame standing a little proud of the skin at height y
function ringFrame(k, prof, y, col = 0x6e766c, t = 0.022) { const r = rAt(prof, y) + t * 0.5; k.add(new THREE.TorusGeometry(r, t, 4, segs(44)), col, [0, y, 0], [Math.PI / 2, 0, 0]); }
// A raised cable tunnel running up the skin at bearing a (radians round the axis) from y0 to y1
function tunnel(k, prof, a, y0, y1, w = 0.16, col = 0x8a9488) {
  const s = Math.sin(a), c = Math.cos(a), pts = [y0, ...prof.map((p) => p[1]).filter((y) => y > y0 && y < y1), y1];
  for (let i = 0; i < pts.length - 1; i++) {
    const ya = pts[i], yb = pts[i + 1], ra = rAt(prof, ya) + 0.05, rb = rAt(prof, yb) + 0.05;
    bar(k, new THREE.Vector3(s * ra, ya, c * ra), new THREE.Vector3(s * rb, yb, c * rb), w, col);
  }
}
// The painted skin: grey-green panels with seams, rivet rows and frost on the oxygen tanks.
// L = the hull's length; seams, frost and dark are heights in metres.
function hullTex(L, { seams = [], frost = [], dark = [], tunnels = [], panels = 16, marks = [], base = '#93a08f' } = {}) {
  return canvasTex(1024, 2048, (g, w, h) => {
    const Y = (y) => (1 - y / L) * h, R = rng(Math.round(L * 7));
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // the panels, each a slightly different shade (as real skin panels are)
    for (let i = 0; i < panels; i++) for (let j = 0; j < seams.length + 1; j++) {
      const y0 = j ? seams[j - 1] : 0, y1 = j < seams.length ? seams[j] : L, v = Math.floor((R() - 0.5) * 18);
      g.fillStyle = `rgba(${v > 0 ? '255,255,255' : '20,30,20'},${Math.abs(v) / 200})`; g.fillRect(i * w / panels, Y(y1), w / panels, Y(y0) - Y(y1));
    }
    // a soft weathering gradient and grime streaks down from the seams
    for (let i = 0; i < 260; i++) { const x = R() * w, y = R() * h; g.fillStyle = `rgba(40,46,38,${0.03 + R() * 0.05})`; g.fillRect(x, y, 1 + R() * 3, 20 + R() * 120); }
    // frost on the oxygen tanks: white, crusted, with darker cracks and streaks
    for (const [y0, y1] of frost) {
      const gr = g.createLinearGradient(0, Y(y1), 0, Y(y0)); gr.addColorStop(0, 'rgba(236,242,246,0.7)'); gr.addColorStop(0.08, '#e8eef2'); gr.addColorStop(0.92, '#e4eaee'); gr.addColorStop(1, 'rgba(228,234,238,0.75)');
      g.fillStyle = gr; g.fillRect(0, Y(y1), w, Y(y0) - Y(y1));
      for (let i = 0; i < 2600; i++) { const x = R() * w, y = Y(y0) + (Y(y1) - Y(y0)) * R(); g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.8)' : 'rgba(170,184,196,0.45)'; g.fillRect(x, y, 1 + R() * 4, 1 + R() * 3); }
      for (let i = 0; i < 90; i++) { const x = R() * w, y = Y(y1) + R() * (Y(y0) - Y(y1)); g.fillStyle = 'rgba(150,166,178,0.35)'; g.fillRect(x, y, 1.5, 10 + R() * 60); }
      // ragged edges: frost reaching past the tank ends
      for (const ye of [y0, y1]) for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(232,238,242,0.8)'; g.fillRect(R() * w, Y(ye) + (R() - 0.5) * 26, 3 + R() * 10, 2 + R() * 5); }
    }
    for (const [y0, y1] of dark) { g.fillStyle = '#3c3e3a'; g.fillRect(0, Y(y1), w, Y(y0) - Y(y1)); }
    // vertical panel lines and their rivets
    for (let i = 0; i < panels; i++) {
      const x = i * w / panels; g.fillStyle = 'rgba(40,46,40,0.55)'; g.fillRect(x, 0, 2, h); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 2, 0, 1, h);
      g.fillStyle = 'rgba(50,56,50,0.5)'; for (let y = 6; y < h; y += 9) { g.fillRect(x - 5, y, 2, 2); g.fillRect(x + 6, y, 2, 2); }
    }
    // the ring seams: a dark joint, a bright edge, and rows of rivets either side
    for (const s of seams) {
      const y = Y(s); g.fillStyle = 'rgba(30,34,30,0.85)'; g.fillRect(0, y - 2, w, 4); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y + 2, w, 1.5);
      g.fillStyle = 'rgba(40,46,40,0.6)'; for (let x = 3; x < w; x += 8) { g.fillRect(x, y - 9, 2, 2); g.fillRect(x, y + 7, 2, 2); }
    }
    // cable tunnels (the raised ducts) leave a darker shadow line beside them
    for (const a of tunnels) { const x = (a / (Math.PI * 2)) * w; g.fillStyle = 'rgba(30,36,30,0.35)'; g.fillRect(x - 14, 0, 6, h); }
    // stencilled marks: little white letters and lines, as on the real thing
    g.fillStyle = 'rgba(240,240,230,0.8)'; g.font = 'bold 22px sans-serif';
    for (const [u, y, text] of marks) { const x = u * w; g.fillText(text, x, Y(y)); g.fillRect(x, Y(y) + 6, 40, 3); }
  });
}
// A turned hull with UVs that run with height (u round, v = y / L), for the painted skin
function hullGeo(prof, seg) {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg), L = prof[prof.length - 1][1];
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setY(i, p.getY(i) / L);
  return g;
}
const CORE_SEAMS = [1.2, 3, 6, 10, 13, 16.2];
// The core stage's details: four main chambers and four verniers, the tail ring, ring frames, cable tunnels
function coreGeo() {
  const k = new Kit();
  for (let i = 0; i < 4; i++) { const a = (i + 0.5) / 4 * Math.PI * 2; engine(k, Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.29, 0.9); }
  // the verniers: small swivelling engines on brackets between the main chambers' quadrants
  for (const a of [0, 90, 180, 270]) {
    const x = Math.sin(a * D2R) * 0.86, z = Math.cos(a * D2R) * 0.86;
    engine(k, x, z, 0.12, 0.42, { chamber: false }); k.box(0.16, 0.14, 0.16, 0x5a5652, [x, 0.06, z]);
  }
  k.add(new THREE.TorusGeometry(0.96, 0.05, 6, segs(40)), 0x4a4e48, [0, 0.02, 0], [Math.PI / 2, 0, 0]);
  k.cyl(0.9, 0.9, 0.04, 32, 0x2a2826, [0, 0.01, 0]);   // the tail's heat shield
  for (const y of CORE_SEAMS) ringFrame(k, CORE, y, 0x8a8e92);
  for (const a of [Math.PI / 4, Math.PI * 1.25]) tunnel(k, CORE, a, 1.3, CORE_TOP - 0.1, 0.16, 0x9a9ea2);
  // a ring frame round the join with Meem's core stage, and a couple of access hatches between the boosters
  k.add(new THREE.TorusGeometry(1.55, 0.045, 5, segs(48)), 0x7a7e82, [0, CORE_TOP + 0.02, 0], [Math.PI / 2, 0, 0]);
  for (const [a, y] of [[0.8, 7.2], [3.9, 9.6], [2.4, 12.5]]) { const r = rAt(CORE, y); k.box(0.5, 0.4, 0.04, 0x8e9296, [Math.sin(a) * r, y, Math.cos(a) * r], [0, a, 0]); }
  return k.geometry();
}
// The flame: an additive teardrop of fire, brightest at the nozzle, flickering
const FLAME_VS = `varying float vY; varying float vF; uniform float len;
  void main(){ vY = -position.y / len; vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`;
const FLAME_FS = `varying float vY; varying float vF; uniform float t; uniform float amt;
  void main(){ float k = clamp(vY, 0.0, 1.0);
    float fl = 0.85 + 0.15 * sin(t * 37.0 + k * 21.0) * sin(t * 23.0 - k * 9.0);
    vec3 hot = vec3(1.0, 0.97, 0.85), mid = vec3(1.0, 0.62, 0.2), cool = vec3(0.9, 0.25, 0.08);
    vec3 c = mix(hot, mid, smoothstep(0.05, 0.4, k)); c = mix(c, cool, smoothstep(0.4, 1.0, k));
    float a = pow(vF, 1.4) * (1.0 - smoothstep(0.55, 1.0, k)) * fl * amt;
    gl_FragColor = vec4(c * a * 1.6, 1.0); }`;
function flameMesh(len, width) {
  const prof = [[0.001, 0.35], [0.5, 0], [0.8, -0.12], [0.78, -0.35], [0.62, -0.6], [0.38, -0.85], [0.001, -1]].map(([r, y]) => new THREE.Vector2(r * width, y * len));
  const mat = new THREE.ShaderMaterial({ uniforms: { t: { value: 0 }, amt: { value: 0 }, len: { value: len } }, vertexShader: FLAME_VS, fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), mat); m.frustumCulled = false; m.renderOrder = 3; m.visible = false;
  return m;
}

// Sputnik 1: a polished ball 58 cm across (Meem's), with four long antennas swept back from its front
// (+Y is its front). sp.userData.open(k): 0 folded, 1 swung out.
function makeSputnik(env) {
  const g = new THREE.Group(), src = SPUTNIK?.scene.getObjectByName('ball');
  // polished aluminium: Meem's seams and bumps (normal and roughness maps) on a bright mirror finish
  const shiny = new THREE.MeshStandardMaterial({ color: 0xeef1f6, metalness: 1, roughness: 0.6, envMap: env, envMapIntensity: 1.4 });
  if (src) { shiny.normalMap = src.material.normalMap; shiny.roughnessMap = src.material.roughnessMap; }
  const ball = new THREE.Mesh(src ? src.geometry : new THREE.SphereGeometry(0.29, 48, 32), shiny); g.add(ball);
  const am = new THREE.MeshStandardMaterial({ color: 0xd8dce4, metalness: 1, roughness: 0.25, envMap: env });
  const ants = [];
  [2.4, 2.9, 2.4, 2.9].forEach((len, i) => {
    const az = (i + 0.5) * Math.PI / 2, piv = new THREE.Group();
    // the root: on the front half of the ball, 60 degrees from the front
    piv.position.set(Math.cos(az) * 0.25, 0.145, Math.sin(az) * 0.25);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.008, len, 5).translate(0, -len / 2, 0), am);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 8), am);
    piv.add(rod, knob); g.add(piv); ants.push({ piv, az });
  });
  g.userData.ball = ball; g.userData.mats = [shiny, am];
  g.userData.open = (k) => { for (const A of ants) { const sweep = lerp(0.07, 0.61, k); A.piv.rotation.set(0, 0, 0); A.piv.rotateY(-A.az); A.piv.rotateZ(sweep); } };
  g.userData.open(1);
  return g;
}

// An environment for the shiny metal: night sky, searchlights, a warm glow low down
function envNight() {
  const t = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#05070f'); gr.addColorStop(0.45, '#1a2440'); gr.addColorStop(0.52, '#4a4040'); gr.addColorStop(0.6, '#2a241e'); gr.addColorStop(1, '#100e0c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (const [x, y, r] of [[60, 100, 26], [190, 95, 22], [320, 105, 30], [440, 98, 20], [256, 40, 12]]) { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,250,235,1)'); rg.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 160; i++) g.fillRect((i * 97) % w, (i * 53) % (h * 0.45), 1.5, 1.5);
  });
  t.mapping = THREE.EquirectangularReflectionMapping; return t;
}
function envSpace() {
  const t = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#000006'; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, h * 0.5, 0, h); gr.addColorStop(0, '#5a8ad0'); gr.addColorStop(0.15, '#1a3a70'); gr.addColorStop(1, '#0a1428'); g.fillStyle = gr; g.fillRect(0, h * 0.52, w, h * 0.48);
    const rg = g.createRadialGradient(128, 110, 0, 128, 110, 40); rg.addColorStop(0, 'rgba(255,255,250,1)'); rg.addColorStop(1, 'rgba(255,250,230,0)'); g.fillStyle = rg; g.fillRect(80, 60, 100, 100);
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 200; i++) g.fillRect((i * 97) % w, (i * 37) % (h * 0.5), 1, 1);
  });
  t.mapping = THREE.EquirectangularReflectionMapping; return t;
}

// ---------- Soft puffs: vapour, steam, dust and smoke, all in one draw call ----------
const PUFF_VS = `attribute float size; attribute vec4 tint; varying vec4 vT; uniform float scale;
  void main(){ vT = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
    gl_PointSize = size <= 0.0 ? 0.0 : clamp(size * scale / max(0.1, -mv.z), 1.0, 480.0); }`;
const PUFF_FS = `varying vec4 vT; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0;
    float a = (1.0 - smoothstep(0.25, 1.0, r)) * (0.85 + 0.15 * sin((c.x * 9.0 + c.y * 7.0) + vT.a * 31.0));
    gl_FragColor = vec4(vT.rgb, vT.a * a); }`;
class Puffs {
  constructor(n) {
    this.n = n; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.tint = new Float32Array(n * 4); this.size = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('tint', new THREE.BufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ uniforms: { scale: { value: 420 } }, vertexShader: PUFF_VS, fragmentShader: PUFF_FS, transparent: true, depthWrite: false });
    this.mesh = new THREE.Points(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4;
    this.p = Array.from({ length: n }, () => ({ age: 1, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 1, s1: 1, a: 0, r: 1, g: 1, b: 1, drag: 0.5, hot: 0 }));
    this.live = 0;
  }
  emit(x, y, z, vx, vy, vz, s0, s1, life, col, a, drag = 0.5, hot = 0) {
    const q = this.p[this.i]; this.i = (this.i + 1) % this.n;
    Object.assign(q, { age: 0, life, x, y, z, vx, vy, vz, s0, s1, a, drag, hot }); _col.setHex(col); q.r = _col.r; q.g = _col.g; q.b = _col.b;
  }
  clear() { for (const q of this.p) q.age = q.life = 1; }
  // wind: [x, z] m/s; light(q) returns how much orange firelight falls on a puff (0..)
  update(dt, wind, light) {
    let live = 0;
    for (let i = 0; i < this.n; i++) {
      const q = this.p[i];
      if (q.age >= q.life) { this.size[i] = 0; continue; }
      live++;
      q.age += dt; const k = Math.min(1, q.age / q.life), dr = Math.exp(-q.drag * dt);
      q.vx = q.vx * dr + wind[0] * (1 - dr); q.vz = q.vz * dr + wind[1] * (1 - dr); q.vy *= dr;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < 0.3 && q.vy < 0) { q.y = 0.3; q.vy = 0; }
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.size[i] = lerp(q.s0, q.s1, 1 - (1 - k) * (1 - k));
      const L = light ? light(q) : 0, hot = q.hot * (1 - k) * (1 - k);
      this.tint[i * 4] = Math.min(1.4, q.r + L * 1.0 + hot); this.tint[i * 4 + 1] = Math.min(1.2, q.g + L * 0.5 + hot * 0.75); this.tint[i * 4 + 2] = q.b + L * 0.15 + hot * 0.3;
      this.tint[i * 4 + 3] = q.a * Math.min(1, q.age * 3) * Math.pow(1 - k, 1.3);
    }
    this.live = live;
    const g = this.mesh.geometry; for (const n of ['position', 'tint', 'size']) g.attributes[n].needsUpdate = true;
  }
}

// ---------- Sounds (made here in WebAudio, like the rest of the game) ----------
function noiseSrc(A, loop = true) { const s = A.ctx.createBufferSource(); s.buffer = A.noiseBuf; s.loop = loop; return s; }
// A long noise with an envelope: rise a, hold h, fall d (seconds), through a filter, at pos (or none)
function longNoise(A, out, { type = 'lowpass', f = 200, q = 0.7, peak = 1, a = 0.1, h = 1, d = 2, t0 = 0, f2 = null }) {
  const c = A.ctx, t = c.currentTime + t0, src = noiseSrc(A), fl = c.createBiquadFilter(), g = c.createGain();
  fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + a + h + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + h); g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + d);
  src.connect(fl); fl.connect(g); g.connect(out); src.start(t, Math.random()); src.stop(t + a + h + d + 0.1);
}
// The rocket's roar: a deep rumble, a ragged mid roar, and the crackle big rockets make
function roar(G, pos, secs, vol = 1) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 300, 0.6);
  longNoise(A, o, { type: 'lowpass', f: 70, peak: 1.0, a: 1.2, h: secs * 0.45, d: secs * 0.55 });
  longNoise(A, o, { type: 'bandpass', f: 260, f2: 160, q: 0.6, peak: 0.55, a: 0.8, h: secs * 0.35, d: secs * 0.6 });
  longNoise(A, o, { type: 'highpass', f: 2500, q: 0.5, peak: 0.12, a: 0.5, h: secs * 0.25, d: secs * 0.5 });
  for (let i = 0; i < secs * 7; i++) A.noise(o, { type: 'bandpass', f: 600 + Math.random() * 2400, q: 1.5, peak: 0.3 * (1 - i / (secs * 7)), a: 0.003, d: 0.05 + Math.random() * 0.08, t0: 0.6 + Math.random() * secs * 0.8 });
}
// An air-raid style siren, rising and falling
function siren(G, pos, secs = 6, vol = 0.5) {
  const A = G.audio; if (!A.ctx) return;
  const c = A.ctx, t = c.currentTime, o = A.out(pos, vol, 120, 0.5);
  for (const det of [0, 7]) {
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.detune.value = det;
    osc.frequency.setValueAtTime(220, t);
    for (let k = 0; k < secs / 3; k++) { osc.frequency.linearRampToValueAtTime(720, t + k * 3 + 1.6); osc.frequency.linearRampToValueAtTime(380, t + k * 3 + 3); }
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.8); g.gain.setValueAtTime(0.12, t + secs - 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
    osc.connect(lp); lp.connect(g); g.connect(o); osc.start(t); osc.stop(t + secs + 0.1);
  }
}
// One radio beep (Sputnik's signal, about 1 kHz once the receiver tunes it), optionally from a place
function beep(G, pos = null, vol = 0.14, radio = false) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 2);
  A.tone(o, { type: 'square', f: 1000, peak: 0.12, a: 0.005, d: 0.26 });
  if (radio) A.noise(o, { type: 'bandpass', f: 1800, q: 0.7, peak: 0.05, a: 0.01, d: 0.45 });
}
function clank(G, pos, vol = 0.3) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 6);
  for (const f of [310, 523, 830]) A.tone(o, { type: 'triangle', f: f * (0.9 + Math.random() * 0.2), peak: 0.1, a: 0.002, d: 0.4 + Math.random() * 0.4 });
  A.noise(o, { type: 'bandpass', f: 1400, q: 2, peak: 0.2, a: 0.002, d: 0.08 });
}
function hiss(G, pos, vol = 0.25, secs = 1.6) {
  const A = G.audio; if (!A.ctx) return;
  longNoise(A, A.out(pos, vol, 5), { type: 'highpass', f: 3000, q: 0.5, peak: 0.4, a: 0.15, h: secs * 0.4, d: secs * 0.6 });
}

// A few big cities (lat, lon) for the lights on the night side of the Earth
const CITIES = [[55.7, 37.6], [59.9, 30.3], [51.5, -0.1], [48.9, 2.3], [52.5, 13.4], [40.7, -74], [41.9, -87.6], [34, -118.2], [19.4, -99.1], [-23.5, -46.6], [-34.6, -58.4], [35.7, 139.7], [34.7, 135.5], [31.2, 121.5], [39.9, 116.4], [22.5, 114.1], [19.1, 72.9], [28.6, 77.2], [22.6, 88.4], [30, 31.2], [41, 29], [45.5, -73.6], [43.7, -79.4], [37.8, -122.4], [29.8, -95.4], [-33.9, 151.2], [-37.8, 145], [1.3, 103.8], [13.8, 100.5], [-6.2, 106.8], [6.5, 3.4], [-26.2, 28], [40.4, -3.7], [41.9, 12.5], [45.5, 9.2], [50.4, 30.5], [53.9, 27.6], [43.2, 76.9], [41.3, 69.3], [56.8, 60.6], [55, 82.9], [33.7, 73], [24.9, 67], [35.7, 51.4], [33.3, 44.4], [39.7, -105], [47.6, -122.3], [25.8, -80.2], [42.4, -71], [38.9, -77], [-12, -77], [4.7, -74.1], [10.5, -66.9], [60.2, 24.9], [59.3, 18.1], [55.7, 12.6], [47.5, 19], [50.1, 14.4], [52.2, 21], [44.4, 26.1], [37.6, 127], [14.6, 121], [23.1, -82.4]];

export default class Sputnik {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.site = new THREE.Group(); this.root.add(this.site);
    this.town = new THREE.Group(); this.town.visible = false; this.root.add(this.town);
    this.hill = new THREE.Group(); this.hill.visible = false; this.root.add(this.hill);
    this.start = { pos: new THREE.Vector3(0, 0, 0), yaw: yawTo(bearing(-PS.x, -PS.z)) };
    this.s = {
      scene: 'pad', phase: 'arrive', guide: null,
      trucks: 1,       // trucks drive about the pad
      beams: 1,        // the searchlights (dim for the countdown)
      korolev: 0,      // 1 = he walks out of the bunker; 2 = the Chief Designer label
      echo: 0,         // Tsiolkovsky beside him
      rise: 0,         // the lift up the service tower
      nose: 0,         // the fairing open
      spLabel: 0, touch: 0,
      count: 0,        // the countdown has begun (tower lowers, sirens)
      num: 0,          // the number showing (5..1)
      launch: 0,       // ignition
      ride: 0, speedLab: 0, ring: 0, cutoff: 0, sep: 0,
      radio: 0, signal: 0, cheer: 0,
      orbit: 0, clock: 0,
      pass: 0, lightLab: 0, memory: 0,
      echoes: 0, moon: 0, title: 0,
      meet: 0, allGlow: 0,   // the crowd at the viewing spot greets you; everyone glows (ch14_15)
      journal: 0,
    };
    this.t = 0; this.F = G.params.has('fast') ? 4 : 1;
    this.liftY = APRON; this.liftX = LIFT0; this.liftK = 0; this.noseK = 0;
    this.cT = -1; this.launchT = -1; this.rideT = -1; this.sepT = -1; this.orbitT = -1; this.passT = -1; this.memT = -1;
    this.envN = envNight(); this.envS = envSpace();
    this.puffs = new Puffs(1600); this.site.add(this.puffs.mesh);
    this.life = new Life(this.root);
    this.buildGround();
    this.buildPad();
    this.buildRocket();
    this.buildFar();
    this.buildPeople();
    this.buildLights();
    this.buildSpace();
    this.buildTown();
    this.buildHill();
    this.journal = new Journal(this, drawJournal);
    this.registerInteractables();
    this.setScene('pad');
    this.ventT = 0; this.clankT = 3; this.beepT = 0;
  }

  // ---------- Where you are ----------
  setScene(name) {
    const G = this.G; this.cur = name;
    const siteOn = name === 'pad' || name === 'lift' || name === 'view';
    this.site.visible = siteOn; this.town.visible = name === 'roofs'; this.hill.visible = name === 'hill';
    if (name === 'space') this.space.enter(null); else this.space.exit();
    if (siteOn) {
      const o = name === 'pad' ? PS : name === 'view' ? VS : _a.set(this.liftX, 0, 0);
      this.site.position.set(-o.x, 0, -o.z); this.site.updateMatrixWorld(true);
      G.world.height = (x, z) => {
        const sx = x - this.site.position.x, sz = z - this.site.position.z;
        if (this.cur === 'lift' && Math.abs(sz) < 1.2 && sx > LIFT1 - 1.1 && sx < LIFT0 + 1.2) return this.liftY;
        return siteH(sx, sz);
      };
      G.world.bounds = name === 'pad' ? 6 : name === 'view' ? 5 : 0.9;
      G.sky.fogFar = 3200; G.sky.mist = 0;
      G.sky.setPlace({ lat: LAT, year: YEAR, sunLon: SUNLON });
      G.audio.amb = name === 'lift' ? 1 : 0.8;
    } else if (name === 'space') {
      G.world.height = () => 0; G.world.bounds = 1.5; G.audio.amb = 0;
    } else if (name === 'roofs') {
      G.world.height = () => ROOF; G.world.bounds = 4; G.sky.fogFar = 1400; G.sky.mist = 0.05; G.audio.amb = 0.3;
      G.sky.setPlace({ lat: 51.5, year: YEAR, sunLon: SUNLON + 1 });
    } else if (name === 'hill') {
      G.world.height = hillH; G.world.bounds = 4; G.sky.fogFar = 2200; G.sky.mist = 0; G.audio.amb = 0.6;
      G.sky.setPlace({ lat: LAT, year: YEAR, sunLon: SUNLON + 2 });
    }
    G.world.blockers = [];
    if (name !== 'space' && !siteOn) this.flameLight.intensity = 0;
  }
  // a site-coordinates point as a world point
  W(x, y, z, out = new THREE.Vector3()) { return out.set(x, y, z).add(this.site.position); }
  async move(D, name, yaw, secs = 0.8) {
    const G = this.G, s = this.s;
    await G.ui.fadeOut(secs); D.check();
    s.scene = name; this.setScene(name);
    G.events.emit('placePlayers', { x: 0, z: 0, yaw });
    await G.ui.fadeIn(secs * 1.4); D.check();
  }

  // ---------- 1. The launch site ----------
  buildGround() {
    const SIZE = 5200, SEG = 120, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const steppe = new THREE.Color(0x857c66), scrub = new THREE.Color(0x5e5a4a), frost = new THREE.Color(0x9e9c94), road = new THREE.Color(0x4e4a44), soot = new THREE.Color(0x26221e), gravel = new THREE.Color(0x6a655c);
    const CX = -110, CZ = 260;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.6) * (SIZE / 2) / r0 : 0;
      x = x * kk + CX; z = z * kk + CZ;
      const y = Math.max(Math.abs(x), Math.abs(z)) < 75 ? Math.min(0, terrain(x, z)) - 0.05 : terrain(x, z); p.setXYZ(i, x, y, z);   // big triangles: keep every one near the pad under the concrete
      c.copy(steppe).lerp(scrub, clamp01(N3(x / 9, z / 9) * 1.6 - 0.5)).lerp(frost, 0.25 * N2(x / 40, z / 40));
      for (const R of ROADS) if (distPoly(x, z, R) < 4) c.lerp(road, 0.75);
      if (distPoly(x, z, RAIL) < 3) c.lerp(gravel, 0.7);
      const sc = Math.abs(x) < 30 ? clamp01(1 - Math.abs(x) / 30) * clamp01((-z - 10) / 20) * clamp01((260 + z) / 120) : 0;   // scorched where the exhaust blasts out north
      c.lerp(soot, sc * 0.85);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    this.site.add(new THREE.Mesh(g, FLAT));
  }

  buildPad() {
    const k = new Kit(), r = rng(5), CON = 0x8e8c86, CON2 = 0x6e6c68, STEEL = 0x7a7e86, RED = 0x9a3a2a;
    // the concrete apron, round the slot over the flame pit
    // cast in 4 m slabs with tar-filled joints between them; each slab a slightly different shade,
    // darker and sooty toward the flame pit, a few patched or cracked
    for (let x = -26; x < 28; x += 4) for (let z = -26; z < 28; z += 4) {
      if (inSlot(x, z) || inSlot(x + 2, z) || Math.abs(x) < 8 && z < 8 && z > -28) continue;
      const soot = clamp01(1 - (Math.hypot(x, z) - 6) / 14) * 0.35, v = 0.9 + r() * 0.16 - soot, c = _col.setHex(CON).multiplyScalar(v).getHex();
      k.box(3.94, APRON, 3.94, c, [x, APRON / 2, z]);
      if (r() < 0.12) k.box(1 + r() * 1.5, 0.012, 0.8 + r(), _col.setHex(CON2).multiplyScalar(0.9 + r() * 0.2).getHex(), [x + (r() - 0.5) * 1.5, APRON + 0.008, z + (r() - 0.5) * 1.5], [0, r() * 3, 0]);   // a patch
    }
    // the narrow strips either side of the slot, out to its walls
    for (const sx of [-1, 1]) k.box(1.7, APRON, 34, _col.setHex(CON).multiplyScalar(0.75).getHex(), [sx * 7.15, APRON / 2, -11]);
    k.box(16, APRON, 1.7, _col.setHex(CON).multiplyScalar(0.8).getHex(), [0, APRON / 2, 7.15]);
    // painted lines: walkways round the pad, raised a little so they never flicker
    for (const [x, z, w, d] of [[0, 12.5, 30, 0.14], [-12.5, -4, 0.14, 33], [12.5, -4, 0.14, 33]]) k.box(w, 0.012, d, 0xb89a30, [x, APRON + 0.008, z]);
    // the slot: dark concrete walls dropping into the pit; the pit floor glows faintly red-brown with soot
    k.box(12, 0.05, 34, 0x0c0a09, [0, -0.4, -11]);
    for (const sx of [-1, 1]) k.box(0.6, 3, 34, 0x302c28, [sx * 6, -1.3, -11]);
    k.box(12, 3, 0.6, 0x302c28, [0, -1.3, 6]);
    // a yellow-and-black safety edge round the slot
    for (let i = 0; i < 17; i++) { const zz = 5.6 - i * 2; for (const sx of [-1, 1]) k.box(0.25, 0.04, 1, i % 2 ? 0xd8b030 : 0x1a1a1a, [sx * 6.2, APRON + 0.02, zz]); }
    // floodlight poles at the apron's corners (their lamps glow in this.lamps)
    this.lampPts = [];
    for (const [x, z] of [[-26, 26], [26, 26], [-26, -26], [26, -26]]) { k.cyl(0.18, 0.26, 16, 6, STEEL, [x, 8, z]); k.box(2.2, 0.6, 0.4, 0x3a3c40, [x, 16.2, z], [0, Math.atan2(x, z), 0]); this.lampPts.push([x, 16, z, 1.6]); }
    // the four support arms are built in buildRocket(); the cable mast here
    // the bunker: an earth mound with a concrete portal and a steel door, periscopes and cables
    const bx = DOOR.x - 9, bz = DOOR.z, mx = bx - 1;   // the mound sits a metre back so its facets stay under the door step
    k.ball(12, 2, 0x6a6350, [mx, -3.5, bz], 0, [1, 0.62, 0.8]);
    k.box(1.6, 3.6, 7, CON, [DOOR.x - 0.9, 1.8, DOOR.z]); k.box(4.2, 0.5, 7.4, CON, [DOOR.x - 1.4, 3.8, DOOR.z]);
    k.box(0.15, 2.3, 1.6, 0x3a4a3a, [DOOR.x - 0.08, 1.15 + APRON, DOOR.z]); k.box(0.1, 0.12, 0.6, 0x9a9a9a, [DOOR.x, 1.1 + APRON, DOOR.z + 0.4]);
    // the blast door's frame, its rivet straps and locking wheel, a step, a caged lamp and a sign
    const DX = DOOR.x, DZ = DOOR.z, A = APRON;
    for (const s of [-1, 1]) k.box(0.3, 2.7, 0.3, 0x7a7872, [DX + 0.05, A + 1.35, DZ + s * 0.95]);
    k.box(0.32, 0.35, 2.2, 0x7a7872, [DX + 0.05, A + 2.85, DZ]);
    for (const y of [0.35, 1.15, 1.95]) k.box(0.05, 0.1, 1.5, 0x2e3a2e, [DX + 0.01, A + y, DZ]);
    k.add(new THREE.TorusGeometry(0.2, 0.025, 4, 12), 0x8a8a84, [DX + 0.04, A + 1.2, DZ - 0.25], [0, Math.PI / 2, 0]);
    for (let i = 0; i < 4; i++) k.box(0.02, 0.38, 0.02, 0x8a8a84, [DX + 0.04, A + 1.2, DZ - 0.25], [i * Math.PI / 4, 0, 0]);
    k.box(0.9, 0.16, 2.2, 0x8a8882, [DX + 0.45, A + 0.08, DZ]);
    k.box(0.44, 0.1, 2.2, 0x8a8882, [DX + 1.1, A + 0.034, DZ], [0, 0, -0.38]);   // a little ramp down off the step
    for (const s of [-1, 1]) k.box(2.6, 2.4, 0.4, CON, [DX + 1.0, A + 1.2, DZ + s * 3.3], [0, s * 0.25, 0]);   // wing walls
    k.box(0.25, 0.2, 0.3, 0x2a2a2a, [DX + 0.15, A + 3.1, DZ]); k.cyl(0.09, 0.09, 0.18, 8, 0xfff0c8, [DX + 0.25, A + 2.95, DZ], [0, 0, Math.PI / 2]);
    for (const y of [2.88, 3.02]) k.box(0.04, 0.02, 0.24, 0x2a2a2a, [DX + 0.36, A + y, DZ]);
    k.box(0.03, 0.45, 0.7, 0xc8c0a0, [DX + 0.04, A + 2.35, DZ + 1.55]); k.box(0.035, 0.08, 0.5, 0xa03020, [DX + 0.045, A + 2.45, DZ + 1.55]);
    k.cyl(0.25, 0.3, 3.2, 10, 0x6a6a66, [bx + 4.5, 4.4, bz + 3.4]); k.cyl(0.42, 0.42, 0.3, 10, 0x4a4a46, [bx + 4.5, 6.1, bz + 3.4]);   // the air intake
    k.cyl(0.03, 0.03, 4, 4, 0x8a8a84, [bx + 1, 8.6, bz]);   // the lightning rod
    for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = 7 + r() * 5, x = bx + Math.cos(a) * d, z = bz + Math.sin(a) * d * 0.8; if (x > DX - 1) continue; k.ball(0.3 + r() * 0.3, 0, 0x5a5640, [x, Math.max(0.2, -3.5 + 7.4 * Math.sqrt(Math.max(0, 1 - ((x - mx) / 12) ** 2 - ((z - bz) / 9.6) ** 2))), z], 0, [1.3, 0.5, 1.1]); }
    for (const [ox, oz] of [[-6, -2], [-8, 2.5]]) { k.cyl(0.18, 0.18, 2.4, 8, 0x5a5e5a, [bx + ox + 6, 4.8, bz + oz]); k.box(0.5, 0.35, 0.35, 0x4a4e4a, [bx + ox + 6.1, 6, bz + oz]); }
    k.box(0.4, 0.4, 24, 0x3a3a3a, [DOOR.x + 6, 0.2, DOOR.z - 14], [0, 0.6, 0]);   // cable duct to the pad
    this.lampPts.push([DOOR.x + 0.3, 3.2, DOOR.z, 0.6]);
    // sandbags and a sentry hut by the bunker
    for (let i = 0; i < 9; i++) k.ball(0.45, 0, 0x8a7a5a, [DOOR.x + 1.5, 0.3 + (i % 3) * 0.35, DOOR.z - 3.4 + Math.floor(i / 3) * 0.7], 0, [1.4, 0.55, 0.9]);
    // the cable mast (swings away just before liftoff) is a group: see below
    // the service tower: built separately so it can lower away
    // a LOX tanker's hose and the hydrants at the apron edge
    for (const z of [-6, 6]) { k.cyl(0.35, 0.35, 1, 8, RED, [24, 0.75, z]); k.cyl(0.12, 0.12, 0.5, 6, 0xb0b0b0, [24, 1.35, z]); }
    // cable trays and pipe runs across the apron
    for (const [x0, z0, x1, z1] of [[-26, 10, -6.5, 4], [26, -4, 6.5, -2], [8, 26, 3, 6.3]]) bar(k, new THREE.Vector3(x0, APRON + 0.15, z0), new THREE.Vector3(x1, APRON + 0.15, z1), 0.3, 0x4a4c50);
    // crates, gas bottles, a work table
    for (let i = 0; i < 8; i++) { const x = -22 + r() * 6, z = -20 + r() * 10; k.box(1 + r(), 0.8 + r() * 0.6, 1 + r() * 0.5, 0x6a5a3a, [x, APRON + 0.5, z], [0, r() * 3, 0]); }
    for (let i = 0; i < 6; i++) k.cyl(0.13, 0.13, 1.4, 8, i % 2 ? 0x3a6a9a : 0x2a7a3a, [18 + i * 0.32, APRON + 0.7, 22]);
    this.site.add(k.mesh());

    // The service tower: a lattice tower east of the rocket with platforms reaching to it at several
    // levels, a lift cage inside, and the top platform level with Sputnik. It lowers away (pivoting at
    // its outer foot) before launch.
    const T = new Kit(), TC = 0xb04a2a, X0 = 4.6, X1 = 8.6, TOPY = 33.8;
    for (const [x, z] of [[X0, -2], [X0, 2], [X1, -2], [X1, 2]]) bar(T, new THREE.Vector3(x - X1, 0, z), new THREE.Vector3(x - X1, TOPY, z), 0.22, TC);
    for (let j = 0; j <= 13; j++) {
      const y = j * 2.6; for (const [a, b] of [[[X0, -2], [X1, -2]], [[X1, -2], [X1, 2]], [[X1, 2], [X0, 2]], [[X0, 2], [X0, -2]]]) bar(T, new THREE.Vector3(a[0] - X1, y, a[1]), new THREE.Vector3(b[0] - X1, y, b[1]), 0.09, TC);
      if (j < 13) for (const [a, b, face] of [[[X0, -2], [X1, -2], 0], [[X1, -2], [X1, 2], 1], [[X1, 2], [X0, 2], 2], [[X0, 2], [X0, -2], 3]]) {
        if (face === 3 && (j >= 9 || j === 0)) continue;   // a clear way out onto the top platform (and a door at the bottom)
        const [p0, p1] = j % 2 ? [a, b] : [b, a];
        bar(T, new THREE.Vector3(p0[0] - X1, y, p0[1]), new THREE.Vector3(p1[0] - X1, y + 2.6, p1[1]), 0.07, TC);
      }
    }
    // platforms toward the rocket at 6, 12, 18 m and the top deck, with railings
    const plat = (y, x0) => {
      T.box(X0 - x0 + 0.2, 0.12, 2.2, 0x6a6e74, [(x0 + X0) / 2 - X1, y, 0]);
      for (const sz of [-1, 1]) { T.box(X0 - x0, 0.05, 0.05, 0xd8b030, [(x0 + X0) / 2 - X1, y + 1.05, sz * 1.08]); for (let x = x0; x <= X0; x += 0.9) T.box(0.05, 1.05, 0.05, 0xd8b030, [x - X1, y + 0.52, sz * 1.08]); }
    };
    plat(6, 3.9); plat(12, 3.3); plat(18, 2.5);
    // the top deck: open steel grating (you can see the pad far below through it), with its railings
    const grate = (K, x0, x1, z0, z1, top) => {
      for (const z of [z0, z1]) K.box(x1 - x0, 0.1, 0.06, 0x5a5e64, [(x0 + x1) / 2, top - 0.05, z]);
      for (const x of [x0, x1]) K.box(0.06, 0.1, z1 - z0, 0x5a5e64, [x, top - 0.05, (z0 + z1) / 2]);
      for (let z = z0 + 0.5; z < z1 - 0.1; z += 0.5) K.box(x1 - x0, 0.08, 0.03, 0x4a4e54, [(x0 + x1) / 2, top - 0.06, z]);
      for (let x = x0 + 0.05; x < x1 - 0.02; x += 0.055) K.box(0.012, 0.035, z1 - z0, 0x7a7e86, [x, top - 0.0175, (z0 + z1) / 2]);
    };
    grate(T, 1.6 - X1, X0 - X1, -1.1, 1.1, DECK);
    for (const sz of [-1, 1]) { T.box(X0 - 1.6, 0.05, 0.05, 0xd8b030, [(1.6 + X0) / 2 - X1, DECK + 1.05, sz * 1.08]); for (let x = 1.6; x <= X0; x += 0.9) T.box(0.05, 1.05, 0.05, 0xd8b030, [x - X1, DECK + 0.52, sz * 1.08]); T.box(X0 - 1.6, 0.12, 0.02, 0xd8b030, [(1.6 + X0) / 2 - X1, DECK + 0.06, sz * 1.1]); }
    grate(T, X0 - X1, 0, -2, 2, DECK);
    // a little roof and a lamp at the top
    T.box(4.4, 0.15, 4.4, 0x5a5e64, [(X0 + X1) / 2 - X1, TOPY, 0]);
    this.tower = new THREE.Group(); this.tower.position.set(X1, 0, 0);
    this.tower.add(T.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
    this.site.add(this.tower);
    // the lift cage (you ride it): a floor plate and a frame, moving up the shaft
    const L = new Kit();
    for (const z of [-1.2, 1.2]) L.box(2.4, 0.1, 0.06, 0x5a5e64, [0, -0.05, z]); for (const x of [-1.2, 1.2]) L.box(0.06, 0.1, 2.4, 0x5a5e64, [x, -0.05, 0]);
    for (let z = -0.7; z < 1; z += 0.7) L.box(2.4, 0.08, 0.03, 0x4a4e54, [0, -0.06, z]); for (let x = -1.15; x < 1.18; x += 0.055) L.box(0.012, 0.035, 2.4, 0x7a7e86, [x, -0.0175, 0]);
    for (const [x, z] of [[-1.15, -1.15], [1.15, -1.15], [1.15, 1.15], [-1.15, 1.15]]) L.box(0.06, 2.4, 0.06, 0xd8b030, [x, 1.2, z]);
    L.box(2.4, 0.06, 0.06, 0xd8b030, [0, 1.05, 1.15]); L.box(0.06, 0.06, 2.4, 0xd8b030, [1.15, 1.05, 0]); L.box(2.4, 0.06, 2.4, 0x4a4e54, [0, 2.4, 0]);
    this.cage = L.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })); this.cage.position.set(LIFT0, APRON, 0); this.site.add(this.cage);
    this.lampPts.push([X1 - 2, TOPY + 0.4, 0, 1.0], [X0, DECK + 2.6, 2, 0.5], [X0, 12.5, -2, 0.5]);
  }

  buildRocket() {
    const R = this.rocket = new THREE.Group(); R.position.set(0, BASE, 0); this.site.add(R);
    // Meem's R-7 (its own texture, lit by the night sky) and, between its boosters, the lower core
    // stage built here: a painted skin to match, with its engines, ring frames and cable tunnels
    this.r7Mat = (env, k = 0.8) => { const m = r7Part('core').material.clone(); m.envMap = env; m.envMapIntensity = k; return m; };
    const mm = this.r7Mat(this.envN);
    this.rocketMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.45, envMap: this.envN, envMapIntensity: 0.7 });
    this.coreTex = hullTex(CORE[CORE.length - 1][1], { seams: CORE_SEAMS, dark: [[0, 0.3]], tunnels: [Math.PI / 4, Math.PI * 1.25], marks: [[0.1, 2.2, '8К71'], [0.6, 4.4, 'А']], base: '#aeb2b4' });
    this.coreSkin = new THREE.MeshStandardMaterial({ map: this.coreTex, metalness: 0.35, roughness: 0.6, envMap: this.envN, envMapIntensity: 0.75 });
    this.coreHull = hullGeo(CORE, 48);
    this.coreG = coreGeo();
    this.core = new THREE.Mesh(this.coreHull, this.coreSkin); this.details = [new THREE.Mesh(this.coreG, this.rocketMat)]; this.core.add(this.details[0]); R.add(this.core);
    this.coreTop = new THREE.Mesh(r7Part('core').geometry, mm); this.core.add(this.coreTop);
    this.boosters = BOOSTERS.map((b, i) => {
      const src = r7Part('booster' + i), g = new THREE.Group(), m = new THREE.Mesh(src.geometry, mm);
      g.position.copy(src.position); g.add(m);
      const fl = flameMesh(11, 1.5); fl.position.y = -0.7; m.add(fl);
      R.add(g); return { g, m, fl, b, v: new THREE.Vector3(), spin: new THREE.Vector3(), glow: glowSprite(0xffa040, 1, 0), trail: [] };
    });
    this.coreFlame = flameMesh(14, 1.7); this.coreFlame.position.y = -0.7; this.core.add(this.coreFlame);
    // the nose fairing (two halves on hinges) and Sputnik inside
    const nm = this.noseMat = this.r7Mat(this.envN); nm.side = THREE.DoubleSide;
    const NR = NOSE[0][0];
    this.halves = [false, true].map((south) => {
      const hinge = new THREE.Group(); hinge.position.set(0, NOSE_Y, south ? NR : -NR);
      const m = new THREE.Mesh(r7Part(south ? 'nose_s' : 'nose_n').geometry, nm); m.position.set(0, 0, south ? -NR : NR); hinge.add(m);
      // inside the half: ring ribs, a stiffener down the middle, the hinge fittings and the seam's lip
      const rk = new Kit(), sg = south ? 1 : -1;
      for (const y of [0.2, 0.9, 1.7, 2.45]) rk.add(new THREE.TorusGeometry(rAt(NOSE, y) - 0.07, 0.025, 4, segs(20), Math.PI), 0x8a8e94, [0, y, 0], [sg * Math.PI / 2, 0, 0]);
      bar(rk, new THREE.Vector3(0, 0.12, sg * (NR - 0.1)), new THREE.Vector3(0, 2.9, sg * 0.33), 0.06, 0x7a7e86);
      for (const x of [-0.9, 0.9]) rk.box(0.14, 0.14, 0.2, 0x4a4e54, [x, 0.07, sg * (NR - 0.12)]);
      m.add(rk.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
      R.add(hinge); return { hinge, m, south };
    });
    // the adapter cone Sputnik sits on
    const ad = new Kit(); ad.cyl(0.2, 0.75, 0.9, 16, 0x9a9ea4, [0, NOSE_Y + 0.45, 0]); ad.cyl(0.25, 0.25, 0.05, 16, 0x4a4e54, [0, NOSE_Y + 0.92, 0]);
    ad.cyl(NR - 0.02, NR - 0.02, 0.06, 40, 0x7a7e84, [0, NOSE_Y - 0.03, 0]);   // the top of the core stage, under the fairing
    // its bolt ring, the separation pushers and the cable to the satellite
    ad.add(new THREE.TorusGeometry(0.74, 0.03, 4, segs(24)), 0x6a6e74, [0, NOSE_Y + 0.02, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ad.cyl(0.018, 0.018, 0.05, 6, 0x3a3c40, [Math.sin(a) * 0.7, NOSE_Y + 0.06, Math.cos(a) * 0.7]); }
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.4; ad.cyl(0.03, 0.03, 0.35, 6, 0x5a5e64, [Math.sin(a) * 0.3, NOSE_Y + 0.7, Math.cos(a) * 0.3], [0.35 * Math.cos(a), 0, -0.35 * Math.sin(a)]); }
    bar(ad, new THREE.Vector3(0.45, NOSE_Y + 0.3, 0.1), new THREE.Vector3(0.12, NOSE_Y + 0.95, 0.12), 0.025, 0x2a2a2a);
    R.add(ad.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
    this.sp = makeSputnik(this.envN); this.sp.position.set(0, NOSE_Y + 1.25, 0); this.sp.userData.open(0.05); R.add(this.sp);
    this.spGlow = glowSprite(0xfff4e0, 1.2, 0); this.sp.add(this.spGlow);
    this.spLab = label('Sputnik: "travelling companion"', 0.16); this.spLab.position.set(0, 0.75, 0); this.spLab.material.opacity = 0; this.sp.add(this.spLab);
    // a soft light inside the open fairing so the ball shines
    this.noseLight = new THREE.PointLight(0xfff0d8, 0, 4, 1.5);
    // The four support arms ("the tulip"): lattice booms from pivots on the pad up to the boosters'
    // shoulders. At liftoff they fall back, pulled by their counterweights.
    const AK = new Kit(), AC = 0x8a8e94;
    // each arm: a tall tapering lattice boom, a brace truss behind it, a hinge on the pad, a heavy
    // counterweight that swings it back at liftoff, and a support head that cradles the rocket
    truss(AK, new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(-3.9, 15.4, 0), 1.3, 0.6, AC, { step: 1.6, leg: 0.14, br: 0.06 });
    truss(AK, new THREE.Vector3(1.2, 0.5, 0), new THREE.Vector3(-2.2, 9.5, 0), 0.7, 0.45, 0x7e828a, { step: 1.5, leg: 0.1, br: 0.05 });
    AK.cyl(0.22, 0.22, 2.0, 12, 0x4a4e54, [0.3, 0.35, 0], [Math.PI / 2, 0, 0]);                 // the hinge pin
    for (const z of [-0.85, 0.85]) AK.box(0.9, 0.9, 0.18, 0x5a5e64, [0.3, 0.3, z]);           // its brackets
    AK.box(1.6, 1.1, 1.4, 0x8a8a84, [1.6, 0.45, 0]); AK.box(1.7, 0.1, 1.5, 0x5a5e64, [1.6, 1.05, 0]); for (const y of [0.1, 0.55]) AK.box(1.66, 0.08, 1.46, 0x5a5e64, [1.6, y, 0]);   // the counterweight
    for (const z of [-0.74, 0.74]) for (const x of [0.82, 2.38]) AK.box(0.08, 1.12, 0.08, 0x4a4e54, [x, 0.5, z]);
    AK.box(1.4, 0.35, 1.3, 0x5a5e64, [-3.95, 15.55, 0]); AK.box(0.5, 0.5, 1.0, 0x3a3c40, [-4.4, 15.95, 0]);   // the support head and its cup
    AK.box(0.08, 0.5, 1.3, 0xd8b030, [-3.3, 15.55, 0]);                                       // a yellow warning stripe
    bar(AK, new THREE.Vector3(-3.4, 15.2, 0.4), new THREE.Vector3(-1.2, 7.5, 0.5), 0.12, 0x3a3a3a);   // the hydraulic line down the boom
    const armGeo = AK.geometry(), armMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.arms = [45, 135, 225, 315].map((b) => {
      const piv = new THREE.Group(); piv.position.copy(at(b, 6.1)).setY(APRON); piv.rotation.y = -b * D2R + Math.PI / 2;
      const m = new THREE.Mesh(armGeo, armMat); piv.add(m); this.site.add(piv);
      return { piv, m };
    });
    // the cable mast (umbilical): a slim tower west-north-west with an arm to the core
    const MK = new Kit(); truss(MK, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 14, 0), 1.2, 0.8, 0x8a8e94, { step: 2, leg: 0.12, br: 0.06 });
    truss(MK, new THREE.Vector3(0, 13.4, 0), new THREE.Vector3(-3.8, 13.4, 0), 0.6, 0.4, 0x8a8e94, { step: 1.2, leg: 0.08, br: 0.05 });
    MK.box(0.2, 0.2, 5, 0x2a2a2a, [-2, 12.6, 0], [0, 0, 0.3]);
    this.mast = new THREE.Group(); this.mast.position.copy(at(300, 5.3)).setY(APRON); this.mast.rotation.y = -300 * D2R + Math.PI / 2;
    this.mast.add(MK.mesh(armMat)); this.site.add(this.mast);
    // exhaust bits: the core's tail glow, the fire trail, the Korolev cross's streaks
    this.tailGlow = glowSprite(0xffc070, 1, 0); this.tailGlow.renderOrder = 6; this.site.add(this.tailGlow);
    this.fire = glowPoints(160, { sizeScale: 420, depthTest: true }); this.fire.visible = false; this.site.add(this.fire);
    this.cross = glowPoints(4 * 70, { sizeScale: 420, depthTest: false }); this.cross.visible = false; this.site.add(this.cross);
    for (const B of this.boosters) { B.glow.visible = false; this.site.add(B.glow); }
    this.crossFlare = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 256, (g) => { g.translate(128, 128); for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -5); g.lineTo(128, 0); g.lineTo(0, 5); g.fill(); } const rg = g.createRadialGradient(0, 0, 0, 0, 0, 40); rg.addColorStop(0, 'rgba(255,255,240,1)'); rg.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = rg; g.fillRect(-40, -40, 80, 80); }), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
    this.crossFlare.visible = false; this.crossFlare.renderOrder = 7; this.site.add(this.crossFlare);
    this.flight = { pos: new THREE.Vector3(0, BASE, 0), vel: new THREE.Vector3(), dir: new THREE.Vector3(0, 1, 0) };
    // the vents where oxygen vapour pours off (rocket coordinates)
    this.vents = [[0, 19.6, 1.45], [0, 19.6, -1.45], [1.45, 17, 0], [-1.45, 17, 0]];
    for (const b of BOOSTERS) { const q = at(b, B_AXIS + 0.6); this.vents.push([q.x, 13.5, q.z], [q.x * 0.97, 9, q.z * 0.97]); }
  }

  // ---------- Around the pad: roads, rail, the assembly building, trucks ----------
  buildFar() {
    const k = new Kit(), r = rng(21), wins = [];
    const H = (x, z) => terrain(x, z);
    // the railway from the assembly building (rails, sleepers near the pad), and the transporter-erector
    for (let i = 0; i < RAIL.length - 1; i++) {
      const [ax, az] = RAIL[i], [bx, bz] = RAIL[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 24), yaw = Math.atan2(bx - ax, bz - az);
      for (let j = 0; j < n; j++) {
        const f0 = j / n, f1 = (j + 1) / n, x0 = ax + (bx - ax) * f0, z0 = az + (bz - az) * f0, x1 = ax + (bx - ax) * f1, z1 = az + (bz - az) * f1;
        for (const s of [-0.76, 0.76]) { const ox = Math.cos(yaw) * s, oz = -Math.sin(yaw) * s; bar(k, new THREE.Vector3(x0 + ox, H(x0, z0) + 0.2, z0 + oz), new THREE.Vector3(x1 + ox, H(x1, z1) + 0.2, z1 + oz), 0.09, 0x6a6a6e); }
        if (i === 0 || j < 8) for (let q = 0; q < 24; q += 1.6) { const f = f0 + (f1 - f0) * q / 24, x = ax + (bx - ax) * f, z = az + (bz - az) * f; k.box(2.4, 0.12, 0.25, 0x3a3026, [x, H(x, z) + 0.08, z], [0, yaw, 0]); }
      }
    }
    // the transporter-erector, lying back on its rails after raising the rocket
    truss(k, new THREE.Vector3(4, 2.2, 34), new THREE.Vector3(4, 2.2, 64), 2.6, 2.6, 0x8a8e94, { step: 2.5, leg: 0.16, br: 0.08 });
    for (const z of [36, 44, 54, 62]) { k.box(2.4, 1.0, 2.2, 0x3a3c40, [4, 0.7, z]); for (const s of [-0.76, 0.76]) k.cyl(0.4, 0.4, 0.2, 10, 0x2a2a2a, [4 + s, 0.55, z - 0.6], [0, 0, Math.PI / 2]); }
    k.box(3.6, 0.3, 4, 0x4a4e54, [4, 3.6, 34]);   // its cradle end
    // a diesel locomotive waiting down the line, headlight on
    k.box(3, 3.6, 16, 0x3a4a3a, [4, 2.3, 120]); k.box(3.2, 0.4, 16.4, 0x2a2a2a, [4, 4.2, 120]); k.box(2.6, 1, 3, 0x2a3a2a, [4, 4.8, 113]);
    k.box(2.6, 0.3, 0.1, 0xc8b030, [4, 2.2, 111.95]);
    for (const z of [114, 118, 122, 126]) for (const s of [-1.2, 1.2]) k.cyl(0.5, 0.5, 0.3, 10, 0x1a1a1a, [4 + s, 0.5, z], [0, 0, Math.PI / 2]);
    // the assembly building (MIK): a huge hangar with lit windows and its doors open to the rails
    const MX = -340, MZ = 900, MY = H(MX, MZ), myaw = Math.atan2(RAIL[2][0] - RAIL[1][0], RAIL[2][1] - RAIL[1][1]);
    const P = (lx, ly, lz) => [MX + lx * Math.cos(myaw) + lz * Math.sin(myaw), MY + ly, MZ - lx * Math.sin(myaw) + lz * Math.cos(myaw)];
    k.box(46, 30, 110, 0xa8a8a0, P(0, 15, 30), [0, myaw, 0]);
    for (let i = 0; i < 10; i++) k.cyl(23.5, 23.5, 10.5, 12, 0x8a8c88, P(0, 30, -20 + i * 11), [0, myaw, Math.PI / 2], [1, 1, 0.25]);
    k.box(24, 26, 0.4, 0xffe8b0, P(0, 13, -25.1), [0, myaw, 0]);
    for (let i = 0; i < 11; i++) for (const s of [-1, 1]) for (let f = 0; f < 3; f++) wins.push({ p: new THREE.Vector3(...P(s * 23.1, 6 + f * 8, -20 + i * 10)), yaw: myaw + s * Math.PI / 2 });
    // workshops, barracks, a water tower, the LOX plant's tanks
    for (let i = 0; i < 10; i++) {
      const x = 120 + (i % 5) * 26, z = 70 + Math.floor(i / 5) * 30, y = H(x, z);
      k.box(20, 4, 9, 0xb8b0a0, [x, y + 2, z]); k.box(20.6, 0.4, 9.6, 0x6a5a4a, [x, y + 4.2, z]);
      for (let w = 0; w < 5; w++) wins.push({ p: new THREE.Vector3(x - 8 + w * 4, y + 2.2, z + 4.52), yaw: 0 });
    }
    { const x = 170, z = 30, y = H(x, z); k.cyl(0.3, 0.4, 18, 6, 0x6a6e74, [x, y + 9, z]); k.cyl(3.5, 3, 4, 12, 0x8a8e94, [x, y + 20, z]); k.cyl(0.001, 3.8, 1.6, 12, 0x6a6e74, [x, y + 22.8, z]); }
    for (let i = 0; i < 4; i++) { const x = 80 + i * 14, z = -70, y = H(x, z); k.cyl(4.5, 4.5, 16, 14, 0xd8dcdc, [x, y + 5, z], [Math.PI / 2, 0, 0]); for (const s of [-6, 6]) k.box(1.2, 2.6, 3, 0x6a6a6a, [x, y + 1.3, z + s]); }
    for (let i = 0; i < 2; i++) { const x = 85 + i * 24, z = -100, y = H(x, z); k.ball(7, 2, 0xd0d4d6, [x, y + 9, z]); for (let j = 0; j < 6; j++) { const a = j / 6 * 6.28; k.cyl(0.2, 0.2, 6, 5, 0x6a6a6a, [x + Math.cos(a) * 5.5, y + 3, z + Math.sin(a) * 5.5]); } }
    // power poles along the roads
    for (const R of ROADS) for (let i = 0; i < R.length - 1; i++) {
      const [ax, az] = R[i], [bx, bz] = R[i + 1], L = Math.hypot(bx - ax, bz - az);
      for (let d = 20; d < L; d += 45) { const x = ax + (bx - ax) * d / L + 6, z = az + (bz - az) * d / L, y = H(x, z); if (Math.hypot(x - VS.x, z - VS.z) < 60) continue; k.cyl(0.12, 0.16, 9, 5, 0x4a3a2a, [x, y + 4.5, z]); k.box(2, 0.12, 0.12, 0x4a3a2a, [x, y + 8.4, z], [0, Math.atan2(bx - ax, bz - az) + Math.PI / 2, 0]); }
    }
    // four searchlight towers round the pad: lattice towers with a cluster of lamps on top
    this.beamFrom = [];
    for (const b of [30, 150, 210, 330]) {
      const q = at(b, 75), y = H(q.x, q.z);
      truss(k, new THREE.Vector3(q.x, y, q.z), new THREE.Vector3(q.x, y + 24, q.z), 3.2, 1.6, 0x7a7e86, { step: 3, leg: 0.16, br: 0.07 });
      k.box(2.8, 0.2, 2.8, 0x4a4e54, [q.x, y + 24, q.z]); k.box(2.4, 1.8, 0.6, 0x2a2c30, [q.x, y + 25.2, q.z], [0, -b * D2R, 0]);
      this.beamFrom.push(new THREE.Vector3(q.x, y + 25.4, q.z)); this.lampPts.push([q.x * 0.985, y + 25.4, q.z * 0.985, 3.2]);
    }
    // scrub bushes everywhere (camel thorn and saxaul)
    for (let i = 0; i < 300; i++) {
      const a = r() * 6.28, d = 30 + Math.pow(r(), 0.7) * 900, x = Math.cos(a) * d, z = Math.sin(a) * d - 0;
      if (onApron(x, z) || distPoly(x, z, RAIL) < 5 || ROADS.some((R2) => distPoly(x, z, R2) < 6) || (Math.abs(x) < 30 && z < -20)) continue;
      const s = 0.4 + r() * 0.8; k.ball(s, 0, r() < 0.5 ? 0x5a5a3e : 0x6e6648, [x, H(x, z) + s * 0.35, z], [0, r() * 3, 0], [1.3, 0.6, 1.1]);
    }
    // the viewing spot: a low concrete wall, a field table with telephones, a loudspeaker on a pole
    const vy = 0, vb = bearing(-VS.x, -VS.z), fx = Math.sin(vb * D2R), fz = -Math.cos(vb * D2R), rx = -fz, rz = fx;
    const V = (f, s, y = 0) => [VS.x + fx * f + rx * s, vy + y, VS.z + fz * f + rz * s];
    // a breastwork of concrete blocks in two staggered courses, sandbags along the top
    const vr = -vb * D2R;
    const BL = 14 / 12;
    for (let c = 0; c < 2; c++) for (let i = 0; i <= 12; i++) {
      const a = Math.max(-7, -7 + (i - (c ? 0.5 : 0)) * BL), b = Math.min(7, a + (c && i === 0 ? BL / 2 : BL));
      if (b - a < 0.1) continue;
      k.box(b - a - 0.03, 0.43, 0.6, _col.setHex(0x6e6c66).multiplyScalar(0.85 + r() * 0.25).getHex(), V(4.5, (a + b) / 2, 0.22 + c * 0.45), [0, vr, 0]);
    }
    for (let i = 0; i < 18; i++) k.ball(0.32, 1, _col.setHex(0x8a7a58).multiplyScalar(0.85 + r() * 0.25).getHex(), V(4.5 + (r() - 0.5) * 0.12, -6.6 + i * 0.78, 1.02), [0, vr + (r() - 0.5) * 0.3, 0], [1.25, 0.42, 0.85]);
    // the field table behind you, with two field telephones, a map case and a thermos
    const tb = (f, sd, y) => V(-2.6 + f, -1.2 + sd, y);
    k.box(1.6, 0.05, 0.8, 0x5a4a3a, tb(0, 0, 0.78), [0, vr, 0]); for (const [a, b] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) k.box(0.05, 0.76, 0.05, 0x2a2a2a, tb(b, a, 0.38));
    k.box(0.25, 0.15, 0.2, 0x1a1a1a, tb(0, -0.4, 0.88), [0, vr, 0]); k.box(0.25, 0.15, 0.2, 0x3a2a1a, tb(0.1, 0.3, 0.88), [0, vr, 0]);
    k.box(0.5, 0.03, 0.4, 0xc8b890, tb(-0.1, -0.05, 0.82), [0, vr + 0.2, 0]); k.cyl(0.05, 0.05, 0.3, 10, 0x3a5a3a, tb(0.2, 0.6, 0.95));
    // a field lamp on a pole at the end of the wall
    k.cyl(0.05, 0.06, 3.2, 6, 0x3a3a3a, V(4.0, -7.6, 1.6)); k.box(0.7, 0.05, 0.05, 0x3a3a3a, V(4.0, -7.3, 3.15), [0, vr + Math.PI / 2, 0]); k.cyl(0.12, 0.2, 0.18, 10, 0x2a3a2a, V(4.0, -7.0, 3.05));
    this.viewLampPos = new THREE.Vector3(...V(4.0, -7.0, 2.9)); this.lampPts.push([...V(4.0, -7.0, 2.92), 0.5]);
    k.cyl(0.08, 0.1, 6, 5, 0x4a3a2a, V(-3, 11, 3)); k.cyl(0.35, 0.12, 0.8, 8, 0x6a6e74, V(-3, 11, 5.8), [Math.PI / 2 - 0.2, -vb * D2R + Math.PI, 0]);
    // a jeep parked behind
    jeep(k, V(-5, 3.5), -vb * D2R + 0.6);
    this.site.add(k.mesh());
    this.site.add(windows(wins, { lit: 0.7, seed: 8, w: 1.4, h: 1.2 }));
    this.lampPts.push([...V(-2.95, 11, 5.9), 0.25]);
    // static lamps: one glowing draw call
    this.lamps = glowPoints(this.lampPts.length, { sizeScale: 300 });
    this.lampPts.forEach(([x, y, z, s], i) => { const L = this.lamps.userData; L.pos.set([x, y, z], i * 3); L.col.set([1, 0.92, 0.75], i * 3); L.size[i] = s; });
    this.lamps.userData.commit(); this.site.add(this.lamps);
    // the searchlight beams: soft cones of light from the towers onto the rocket
    const bk = [], tgtY = [9, 17, 22, 13];
    this.beamFrom.forEach((p0, i) => {
      const p1 = new THREE.Vector3(0, tgtY[i], 0), d = p1.clone().sub(p0), L = d.length() * 1.25;
      const g = new THREE.CylinderGeometry(0.7, 9, L, 18, 1, true).translate(0, -L / 2, 0);
      const uv = g.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setY(j, 1 - uv.getY(j));
      g.applyMatrix4(_m.compose(p0, _q.setFromUnitVectors(_a.set(0, -1, 0), d.normalize()), ONE));
      bk.push(g);
    });
    this.beams = new THREE.Group();
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { amt: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float amt; varying vec2 vUv; varying float vF; void main(){ float a = pow(1.0 - vUv.y, 2.2) * pow(vF, 2.0) * 0.16 * amt; gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, 1.0); }',
    });
    for (const g of bk) this.beams.add(new THREE.Mesh(g, this.beamMat));
    this.beams.children.forEach((m) => { m.frustumCulled = false; m.renderOrder = 2; });
    this.site.add(this.beams);
    // trucks: a LOX tanker parked by the rocket, and two more driving the road to the pad
    this.trucks = [];
    const tk = (kind, path, speed, ph) => { const T = makeTruck(kind); this.site.add(T.g); const tr = { ...T, path: path.map(([x, z]) => new THREE.Vector3(x, 0, z)), i: 0, wait: ph, speed }; tr.g.position.copy(tr.path[0]).setY(siteH(tr.path[0].x, tr.path[0].z)); this.trucks.push(tr); return tr; };
    tk('tanker', [[14, 9], [14, 9]], 0, 1e9).g.rotation.y = -Math.PI / 2;
    tk('cable', [[260, 40], [140, 31], [36, 14], [18, 18], [36, 14], [140, 31]], 7, 2);
    tk('jeep', [[-30, 34], [-90, 190], [-140, 300], [-90, 190], [-30, 34], [-10, 40]], 9, 6);
    this.hose = new Kit(); bar(this.hose, new THREE.Vector3(12.2, 1.4, 9), new THREE.Vector3(7, 0.5, 6), 0.18, 0x2a2a2a); bar(this.hose, new THREE.Vector3(7, 0.5, 6), new THREE.Vector3(3.4, 1.4, 1.0), 0.18, 0x2a2a2a);
    this.hoseM = this.hose.mesh(); this.site.add(this.hoseM);
    this.carGlow = glowPoints(12, { sizeScale: 300 }); this.site.add(this.carGlow);
    // smoke from the barracks' stoves, and a flock of birds roosting
    this.stove = makeSmoke(new THREE.Vector3(150, terrain(150, 70) + 6, 70), { n: 7, rise: 9, size: 2, opacity: 0.16, color: 0x9a9aa4 }); this.site.add(this.stove.group);
  }

  buildPeople() {
    const add = (parent, model, pos, look = {}) => { const P = makePerson({ model, seed: 11 + parent.children.length * 3, ...look }); P.g.position.copy(pos); parent.add(P.g); return P; };
    // Korolev: waits in the bunker, then walks out to look up at his rocket
    this.korolev = add(this.site, 'korolev', DOOR.clone().setX(DOOR.x + 0.45).setY(stepH(DOOR.x + 0.45, DOOR.z)), { height: 1.72, tunic: 0x2a2a30 });   // on the door step
    this.korolev.g.visible = false; this.korolev.g.rotation.y = Math.PI / 2;
    // Tsiolkovsky's book, which Korolev read as a young man: it glows open beside him as he's named
    this.book = makeBook(); this.book.position.set(KS.x - 1.1, 1.45, KS.z + 0.7); this.book.visible = false; this.site.add(this.book);
    this.bookLab = label("Tsiolkovsky's book, 1903", 0.16); this.bookLab.position.set(0, 0.42, 0); this.bookLab.material.opacity = 0; this.book.add(this.bookLab);
    this.chiefLab = label('The Chief Designer', 0.32); this.chiefLab.material.opacity = 0; this.site.add(this.chiefLab);
    // engineers and soldiers of the launch crew, each dressed differently, working round the rocket
    const crew = [
      { kind: 'jacket', coat: 0x3a4450, hat: 'ushanka', hatCol: 0x4a3e32, height: 1.76, moustache: true },
      { kind: 'jacket', coat: 0x5a5644, hat: 'cap', hatCol: 0x2a2a2c, height: 1.68 },
      { kind: 'greatcoat', coat: 0x4a4a3a, hat: 'peaked', hatCol: 0x4a4a3a, height: 1.8, gloves: 0x2a2420 },
      { kind: 'greatcoat', coat: 0x2a2a2e, hat: 'fedora', hatCol: 0x3a3632, height: 1.72, glasses: true, scarf: 0x8a7a5a },
      { kind: 'jacket', coat: 0x22262a, hat: 'beret', hatCol: 0x1a1a1e, height: 1.71, scarf: 0x6a2a24 },
    ];
    const hm = [[-4, 8, 'work', 0.5], [5, 6.5, 'work', -0.4], [-7.2, -4, 'hold', 0.8], [11, 11, 'hold', -1.2], [-3, 14, 'talk', 3]];
    this.eng = hm.map(([x, z, pose, face], i) => {
      // the first is Meem's Soviet engineer (quilted jacket, ushanka, glasses)
      const P = i === 0 ? makePerson({ model: 'soviet_engineer', seed: 11, height: 1.76 }) : makeFolk({ seed: 11 + i * 7, ...crew[i] }); P.g.position.set(x, APRON, z); this.site.add(P.g);
      P.home = { x, z, pose, face }; P.g.rotation.y = face;
      P.routine = i < 2 ? null : [{ x, z, pose, secs: 7 + i, face }, { x: x + (i % 2 ? 6 : -5), z: z + 4, pose: 'talk', secs: 5, face: face + 1 }, { x: 8 - i * 3, z: 18, pose: 'point', secs: 4 }];
      if (i === 2) { P.lamp = makeLamp(); holdProp(P, P.lamp, 'Right', [0, 0.06, 0.03]); }
      if (i === 3) holdProp(P, makeClipboard(), 'Left');
      return P;
    });
    // a fitter up on the service tower's middle platform
    this.towerMan = makeFolk({ seed: 41, kind: 'jacket', coat: 0x6a5a3a, hat: 'ushanka', hatCol: 0x6a6a66, height: 1.7, gloves: 0x5a4a32 });
    this.towerMan.g.position.set(4.0 - 8.6, 12.06, 0.4); this.towerMan.g.rotation.y = -Math.PI / 2; this.towerMan.pose = 'work'; this.tower.add(this.towerMan.g);
    // The viewing spot: everyone from both eras has come to watch, one of each, in a loose arc round
    // you on both sides so you see their faces and the rocket between them
    const vb = bearing(-VS.x, -VS.z), f = new THREE.Vector3(Math.sin(vb * D2R), 0, -Math.cos(vb * D2R)), rr = new THREE.Vector3(-f.z, 0, f.x);
    this.vf = f; this.vr = rr;
    const slot = (deg, r) => VS.clone().addScaledVector(f, Math.cos(deg * D2R) * r).addScaledVector(rr, Math.sin(deg * D2R) * r);
    this.korolevView = slot(-30, 3.0);
    const who = [
      ['von_braun', 'Wernher von Braun', -38, 3.2], ['tsiolkovsky', 'Tsiolkovsky', -47, 4.0], ['goddard', 'Goddard', -58, 3.4], ['newton', 'Newton', -67, 3.3],
      ['galileo', 'Galileo', -78, 4.1], ['kepler', 'Kepler', -88, 3.3], ['tycho', 'Tycho', -100, 4.2], ['copernicus', 'Copernicus', -112, 3.4],
      ['storyteller', 'The storyteller', 28, 3.4], ['builder', 'A Stonehenge builder', 38, 4.0], ['priest', 'A priest of the Nile', 50, 3.3], ['skywatcher', 'A skywatcher of Babylon', 61, 4.2],
      ['chinese_astronomer', 'A Chinese astronomer', 72, 3.4], ['eratosthenes', 'Eratosthenes', 84, 4.2], ['aristotle', 'Aristotle', 95, 3.3], ['ptolemy', 'Ptolemy', 106, 4.2], ['diver', 'The sponge diver', 118, 3.4],
    ];
    this.crowd = who.map(([model, name, deg, r], i) => {
      const P = makePerson({ model, sd: true, seed: 90 + i * 5 });   // everyone in their own model (Meem's von Braun too, front and centre by Korolev)
      const p = slot(deg, r); P.g.position.copy(p).setY(siteH(p.x, p.z)); P.g.visible = false; this.site.add(P.g);
      P.name = model; P.home = p.clone(); P.yawR = Math.atan2(-p.x, -p.z); P.g.rotation.y = P.yawR;
      P.lab = label(name, 0.15); P.lab.material.opacity = 0; P.lab.visible = false; this.site.add(P.lab);
      P.halo = glowSprite(0xffd8a0, 1.5, 0); P.halo.visible = false; this.site.add(P.halo);
      P.k = 0; P.named = -1; P.i = i;
      return P;
    });
    // who hugs whom when it flies
    this.hugs = [['tsiolkovsky', 'goddard'], ['galileo', 'kepler'], ['storyteller', 'builder']].map(([a, b]) => [this.crowd.find((P) => P.name === a), this.crowd.find((P) => P.name === b)]);
  }

  buildLights() {
    // lights live on the root so their count never changes (no stutter when scenes switch)
    this.moonLight = new THREE.DirectionalLight(0xa8b8e8, 0.5); this.root.add(this.moonLight, this.moonLight.target);
    this.spots = [150, 210].map((b, i) => {
      const L = new THREE.SpotLight(0xf0f4ff, i ? 70 : 120, 0, 0.2, 0.6, 1); this.root.add(L, L.target); L.userData.b = b; return L;
    });
    this.flameLight = new THREE.PointLight(0xff9a40, 0, 0, 1.15); this.root.add(this.flameLight);
    this.roomLight = new THREE.PointLight(0xffd8a0, 0, 9, 1.4); this.root.add(this.roomLight);
    this.viewLight = new THREE.PointLight(0xffd8a8, 0, 22, 1.2); this.root.add(this.viewLight);
    this.root.add(this.noseLight);
  }

  // ---------- 2. Up into space ----------
  buildSpace() {
    const G = this.G, SP = this.space = new Space(G, { earthR: ER });
    SP.ball.material.roughness = 0.9;
    // city lights on the night side
    const pts = [], r = rng(31);
    for (const [la, lo] of CITIES) for (let i = 0; i < 8; i++) pts.push(lonLat(la + (r() - 0.5) * 2.2, lo + (r() - 0.5) * 3, new THREE.Vector3()).multiplyScalar(ER * 1.003));
    this.cityPts = pts; this.cities = glowPoints(pts.length, { sizeScale: 300 }); SP.earth.add(this.cities);
    pts.forEach((p, i) => { this.cities.userData.pos.set([p.x, p.y, p.z], i * 3); });
    // the ride rocket: the core stage on its own, nose and Sputnik
    const RR = this.rideRocket = new THREE.Group(); SP.group.add(RR);
    // in sunlight out here: the same skins, lit by the space sky
    const sMat = (m) => { const c = m.clone(); c.envMap = this.envS; c.envMapIntensity = 1.5; return c; };
    const rc = new THREE.Mesh(this.coreHull, sMat(this.coreSkin)); rc.add(new THREE.Mesh(this.coreG, sMat(this.rocketMat)), new THREE.Mesh(r7Part('core').geometry, this.r7Mat(this.envS, 1.3))); RR.add(rc);
    this.rideFlame = flameMesh(30, 2.2); this.rideFlame.position.y = -0.7; RR.add(this.rideFlame);
    const rnm = this.r7Mat(this.envS, 1.3); rnm.side = THREE.DoubleSide;
    this.rideHalves = [false, true].map((south) => { const m = new THREE.Mesh(r7Part(south ? 'nose_s' : 'nose_n').geometry, rnm); m.position.y = NOSE_Y; RR.add(m); return { m, south, v: new THREE.Vector3(), spin: 0 }; });
    this.sp2 = makeSputnik(this.envS); this.sp2.userData.open(0.05); SP.group.add(this.sp2);
    this.sp2Glow = glowSprite(0xfff8e8, 1.4, 0.4); this.sp2.add(this.sp2Glow);
    this.rideGlow = glowSprite(0xffc080, 30, 0); SP.group.add(this.rideGlow);
    this.speedLab = label('8 kilometres every second', 0.5); this.speedLab.material.opacity = 0; SP.group.add(this.speedLab);
    this.orbitLab = label('Once round the Earth: 96 minutes', 0.45); this.orbitLab.material.opacity = 0; SP.group.add(this.orbitLab);
    // the path round the Earth (falling, and missing)
    this.orbitRing = glowPoints(360, { sizeScale: 300 }); this.orbitRing.visible = false; SP.group.add(this.orbitRing);
    // our own Sun, which can rise over the Earth's edge
    this.spaceSun = glowSprite(0xfff4e0, 150, 0); SP.group.add(this.spaceSun);
    this.buildRadioRoom();
  }

  // The radio room: a tracking station's receivers; a glowing window opens onto it out in space
  buildRadioRoom() {
    const R = this.room = new THREE.Group(); R.visible = false; this.root.add(R);
    const k = new Kit(), W = 3.6, Hh = 2.6, Dp = 3.2, r = rng(53);
    // a wooden plank floor: boards of slightly different shades, in staggered lengths, over a dark subfloor
    k.box(W, 0.04, Dp, 0x1e1610, [0, -0.06, -Dp / 2]);
    for (let i = 0; i < 20; i++) {
      const x = -W / 2 + (i + 0.5) * W / 20; let z = 0, cut = 0.6 + r() * 1.6;
      while (z > -Dp + 0.01) { const z1 = Math.max(-Dp, z - cut), c = _col.setHex(0x7a5634).multiplyScalar(0.82 + r() * 0.3).getHex(); k.box(W / 20 - 0.007, 0.04, z - z1 - 0.006, c, [x, -0.02, (z + z1) / 2]); z = z1; cut = 1.2 + r() * 1.4; }
    }
    // walls: painted green-grey above a darker dado, a skirting board, a ceiling with a lamp
    k.box(W, Hh, 0.1, 0x8a9a86, [0, Hh / 2, -Dp - 0.05]); for (const s of [-1, 1]) k.box(0.1, Hh, Dp, 0x7e8e7a, [s * (W / 2 + 0.05), Hh / 2, -Dp / 2]);
    k.box(W, 0.9, 0.03, 0x4e5e4a, [0, 0.45, -Dp + 0.015]); for (const s of [-1, 1]) k.box(0.03, 0.9, Dp, 0x4a5a46, [s * (W / 2 - 0.015), 0.45, -Dp / 2]);
    k.box(W, 0.04, 0.05, 0x3a2a1a, [0, 0.92, -Dp + 0.03]); for (const s of [-1, 1]) k.box(0.05, 0.04, Dp, 0x3a2a1a, [s * (W / 2 - 0.03), 0.92, -Dp / 2]);
    k.box(W, 0.1, Dp, 0xd8d4c8, [0, Hh + 0.05, -Dp / 2]);
    k.cyl(0.01, 0.01, 0.5, 4, 0x2a2a2a, [0.3, Hh - 0.25, -2.3]); k.cyl(0.04, 0.22, 0.14, 12, 0x3a5a3a, [0.3, Hh - 0.55, -2.3]);   // over the desk, clear of the cheering arms
    // the desk, the racks of receivers with their knobs and meters
    k.box(2.8, 0.05, 0.8, 0x6a4a2a, [0, 0.76, -2.5]); k.box(2.8, 0.7, 0.04, 0x5a3a22, [0, 0.38, -2.88]);
    for (const x of [-1.37, 1.37]) k.box(0.05, 0.74, 0.76, 0x5a3a22, [x, 0.37, -2.5]);
    k.box(0.5, 0.62, 0.7, 0x5a3a22, [-1.0, 0.38, -2.5]); for (let j = 0; j < 3; j++) { k.box(0.44, 0.17, 0.01, 0x6a4a2a, [-1.0, 0.18 + j * 0.2, -2.145]); k.box(0.08, 0.02, 0.02, 0xb8a070, [-1.0, 0.2 + j * 0.2, -2.135]); }
    for (let i = 0; i < 4; i++) {
      const x = -1.2 + i * 0.8; k.box(0.74, 1.42, 0.45, 0x4a5248, [x, 1.5, -2.88]); k.box(0.76, 0.04, 0.47, 0x3a4038, [x, 2.22, -2.88]);
      for (let j = 0; j < 4; j++) { k.cyl(0.035, 0.035, 0.05, 10, 0x1a1a1a, [x - 0.25 + j * 0.17, 1.05, -2.63], [Math.PI / 2, 0, 0]); k.box(0.01, 0.03, 0.01, 0xd8d8d0, [x - 0.25 + j * 0.17, 1.07, -2.6]); }
      for (const y of [1.25, 1.65, 2.05]) k.box(0.7, 0.012, 0.01, 0x2a302a, [x, y, -2.65]);
      for (const sx of [-0.3, 0.3]) for (const y of [1.2, 2.1]) k.cyl(0.012, 0.012, 0.02, 6, 0x9a9a90, [x + sx, y, -2.64], [Math.PI / 2, 0, 0]);
    }
    // a tape recorder, a telephone, a microphone, a log book and pencils, an ashtray, a mug
    k.box(0.5, 0.18, 0.35, 0x3a3a3a, [0.85, 0.87, -2.4]); for (const x of [0.73, 0.97]) { k.cyl(0.08, 0.08, 0.02, 14, 0x5a4a3a, [x, 0.97, -2.4]); k.cyl(0.02, 0.02, 0.03, 6, 0x9a9a9a, [x, 0.98, -2.4]); }
    k.box(0.2, 0.08, 0.16, 0x111111, [1.25, 0.82, -2.35]); k.box(0.22, 0.04, 0.05, 0x111111, [1.25, 0.89, -2.38], [0, 0, 0]);
    k.cyl(0.05, 0.07, 0.03, 10, 0x2a2a2a, [0.2, 0.795, -2.55]); k.cyl(0.008, 0.008, 0.25, 4, 0x8a8a8a, [0.2, 0.92, -2.55]); k.cyl(0.03, 0.025, 0.08, 8, 0x5a5a5a, [0.2, 1.06, -2.53], [0.4, 0, 0]);
    k.box(0.32, 0.02, 0.22, 0xe8e0c8, [-0.6, 0.79, -2.35], [0, 0.2, 0]); k.box(0.3, 0.012, 0.21, 0x6a2a2a, [-0.6, 0.778, -2.35], [0, 0.2, 0]);
    for (let i = 0; i < 3; i++) k.box(0.15, 0.01, 0.01, [0xd8a030, 0x3a6a3a, 0xa03030][i], [-0.3, 0.79, -2.25 - i * 0.03], [0, 0.4 + i * 0.3, 0]);
    k.cyl(0.05, 0.04, 0.03, 10, 0x8a8a8a, [-1.1, 0.79, -2.25]); k.cyl(0.035, 0.035, 0.09, 10, 0xd8d0c0, [-0.85, 0.83, -2.2]);
    // two chairs: one at the desk pushed back (he jumped up), one by the wall
    const chair = (x, z, yaw) => {
      const c = Math.cos(yaw), sn = Math.sin(yaw), P = (a, b) => [x + a * c + b * sn, z - a * sn + b * c];
      k.box(0.42, 0.04, 0.42, 0x6a4a2a, [P(0, 0)[0], 0.46, P(0, 0)[1]], [0, yaw, 0]);
      for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) { const q = P(a, b); k.box(0.035, 0.46, 0.035, 0x4a3220, [q[0], 0.23, q[1]]); }
      for (const a of [-0.18, 0.18]) { const q = P(a, 0.19); k.box(0.035, 0.48, 0.035, 0x4a3220, [q[0], 0.7, q[1]], [0, yaw, 0]); }
      const q = P(0, 0.19); k.box(0.4, 0.14, 0.025, 0x6a4a2a, [q[0], 0.84, q[1]], [0, yaw, 0]);
    };
    // Meem's receiver cabinet (its reels on top) in the front corner by the right wall, turned a little toward the window
    const RP = PROPS.fresh(), rcv = RP.add('radio_receiver', 1.46, 0, -0.55, -Math.PI / 2 + 0.35);
    if (rcv) R.add(RP.build());
    chair(-0.35, -1.25, 0.35); chair(1.45, rcv ? -1.5 : -1.0, -1.2);
    // on the walls: a map of the world, a clock, a calendar for October 1957, a poster
    k.box(1.2, 0.7, 0.02, 0xd8d0b0, [-W / 2 + 0.02, 2.0, -1.5], [0, Math.PI / 2, 0]); for (const [z, y, w, h] of [[-1.75, 2.1, 0.3, 0.25], [-1.45, 2.15, 0.2, 0.3], [-1.2, 2.0, 0.35, 0.2], [-1.4, 1.85, 0.12, 0.2]]) k.box(w, h, 0.01, 0x8a9a6a, [-W / 2 + 0.032, y, z], [0, Math.PI / 2, 0]);
    k.cyl(0.16, 0.16, 0.04, 20, 0xf0ece0, [W / 2 - 0.03, 2.1, -1.2], [0, 0, Math.PI / 2]); k.add(new THREE.TorusGeometry(0.165, 0.015, 4, 20), 0x2a2a2a, [W / 2 - 0.035, 2.1, -1.2], [0, Math.PI / 2, 0]);
    k.box(0.4, 0.3, 0.015, 0xece4c8, [W / 2 - 0.02, 1.5, -2.2], [0, -Math.PI / 2, 0]); k.box(0.4, 0.07, 0.012, 0xa03020, [W / 2 - 0.03, 1.62, -2.2], [0, -Math.PI / 2, 0]);
    k.box(0.4, 0.32, 0.35, 0x3a3e3a, [-0.4, 0.95, -2.48]); k.box(0.44, 0.03, 0.38, 0x2a2e2a, [-0.4, 1.125, -2.48]);   // the oscilloscope
    R.add(k.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
    // glowing dials and the oscilloscope's green trace
    const dk = new Kit();
    for (let i = 0; i < 4; i++) { dk.box(0.5, 0.18, 0.02, 0xffc860, [-1.2 + i * 0.8, 1.85, -2.648]); dk.box(0.12, 0.1, 0.02, 0x80ff90, [-1.05 + i * 0.8, 1.45, -2.648]); }
    dk.box(0.32, 0.24, 0.02, 0x60ff80, [-0.4, 1.0, -2.3]);
    R.add(dk.mesh(new THREE.MeshBasicMaterial({ vertexColors: true })));
    this.scope = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.2), new THREE.MeshBasicMaterial({ map: canvasTex(128, 96, () => {}), transparent: true }));
    this.scope.position.set(-0.4, 1.0, -2.28); R.add(this.scope);
    // the window frame
    const sh = new THREE.Shape(); sh.moveTo(-W / 2 - 0.12, -0.12); sh.lineTo(W / 2 + 0.12, -0.12); sh.lineTo(W / 2 + 0.12, Hh + 0.12); sh.lineTo(-W / 2 - 0.12, Hh + 0.12); sh.closePath();
    const hole = new THREE.Path(); hole.moveTo(-W / 2, 0); hole.lineTo(-W / 2, Hh); hole.lineTo(W / 2, Hh); hole.lineTo(W / 2, 0); hole.closePath(); sh.holes.push(hole);
    this.frame = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    R.add(this.frame);
    this.frameSparks = glowPoints(90, { sizeScale: 300 }); R.add(this.frameSparks);
    // the engineers: Meem's Soviet engineer at the desk ("Listen! The signal!"), and one beside him
    // in a lab coat with the headphones
    const looks = [null, { kind: 'labcoat', coat: 0xe8e8e2, trousers: 0x3a3a3a, glasses: true, moustache: true, headphones: true, hair: 0x6a6a64, height: 1.68 }];
    this.radioMen = [[-0.3, -1.8, Math.PI], [0.9, -1.5, Math.PI + 0.5]].map(([x, z, f], i) => {
      const P = i === 0 ? makePerson({ model: 'soviet_engineer', seed: 51, height: 1.76 }) : makeFolk({ seed: 51 + i * 4, ...looks[i] }); P.g.position.set(x, 0, z); P.g.rotation.y = f; R.add(P.g); P.f0 = f; return P;
    });
    this.sigLab = label('beep... beep... beep...', 0.22, { color: '#d8ffe0', glowCol: 'rgba(120,255,160,0.7)' }); this.sigLab.position.set(0, Hh + 0.45, 0); this.sigLab.material.opacity = 0; R.add(this.sigLab);
  }

  // ---------- 3. Rooftops at dusk ----------
  buildTown() {
    const k = new Kit(), r = rng(61), wins = [], T = this.town, ant = new Kit(), lampP = [], TP = PROPS.fresh();   // TP: Meem's models
    const g = new THREE.PlaneGeometry(1600, 1600, 8, 8); g.rotateX(-Math.PI / 2);
    T.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x3a3a3c })));
    // our block: you stand on its flat roof
    const block = (x, z, w, d, h, col, roofCol = 0x4a4a4c, me = false) => {
      // the walls stop 0.2 m short; the roof (inset inside the parapets, so no faces overlap) tops out at h
      k.box(w, h - 0.2, d, col, [x, (h - 0.2) / 2, z]);
      if (me) for (let i = 0; i < Math.round(w - 0.6); i++) { const ww = (w - 0.6) / Math.round(w - 0.6); k.box(ww - 0.02, 0.2, d - 0.6, _col.setHex(roofCol).multiplyScalar(0.85 + r() * 0.25).getHex(), [x - (w - 0.6) / 2 + (i + 0.5) * ww, h - 0.1, z]); }
      else k.box(w - 0.6, 0.2, d - 0.6, roofCol, [x, h - 0.1, z]);
      if (me) k.box(w - 0.6, 0.1, d - 0.6, 0x1a1a1a, [x, h - 0.16, z]);   // tar under the roofing sheets' joints
      for (const [px, pz, pw, pd] of [[x, z - d / 2 + 0.15, w, 0.3], [x, z + d / 2 - 0.15, w, 0.3], [x - w / 2 + 0.15, z, 0.3, d - 0.6], [x + w / 2 - 0.15, z, 0.3, d - 0.6]]) k.box(pw, (me ? 0.9 : 0.8) + 0.2, pd, col, [px, h - 0.2 + ((me ? 0.9 : 0.8) + 0.2) / 2, pz]);
      // a coping of darker stone along the parapet tops
      for (const [px, pz, pw, pd] of [[x, z - d / 2 + 0.15, w + 0.06, 0.38], [x, z + d / 2 - 0.15, w + 0.06, 0.38], [x - w / 2 + 0.15, z, 0.38, d - 0.68], [x + w / 2 - 0.15, z, 0.38, d - 0.68]]) k.box(pw, 0.06, pd, _col.setHex(col).multiplyScalar(0.7).getHex(), [px, h + (me ? 0.9 : 0.8) + 0.03, pz]);
      k.box(0.2, 0.35, 0.2, 0x5a4a3a, [x, h + 0.175, z]);
      const fl = Math.floor(h / 3.2);
      for (const [fx, fz, yaw, len] of [[0, d / 2 + 0.02, 0, w], [0, -d / 2 - 0.02, Math.PI, w], [w / 2 + 0.02, 0, Math.PI / 2, d], [-w / 2 - 0.02, 0, -Math.PI / 2, d]]) {
        const n = Math.floor(len / 3.2);
        for (let f = 0; f < fl; f++) for (let i = 0; i < n; i++) { const o = -len / 2 + (i + 0.5) * len / n; wins.push({ p: new THREE.Vector3(x + fx + (yaw === 0 || yaw === Math.PI ? o : 0), 1.8 + f * 3.2, z + fz + (yaw === 0 || yaw === Math.PI ? 0 : o)), yaw }); }
      }
      // chimneys and a TV aerial (the newest thing in 1957)
      for (let i = 0; i < 2; i++) { const cx = x + (r() - 0.5) * w * 0.7, cz = z + (r() - 0.5) * d * 0.7; if (me && Math.hypot(cx - x, cz - z) < 4) continue; k.box(0.7, 1.6, 0.7, 0x7a4a3a, [cx, h + 0.8, cz]); k.box(0.82, 0.1, 0.82, 0x5a3a2a, [cx, h + 1.55, cz]); for (const o of [-0.15, 0.15]) k.cyl(0.08, 0.09, 0.35, 6, 0x9a5a3a, [cx + o, h + 1.75, cz]); }
      if (r() < 0.6) { const ax = x + (r() - 0.5) * w * 0.5, az = z + (r() - 0.5) * d * 0.5; ant.cyl(0.03, 0.03, 3, 4, 0x9a9a9a, [ax, h + 1.5, az]); for (let j = 0; j < 4; j++) ant.box(1.4 - j * 0.2, 0.03, 0.03, 0x9a9a9a, [ax, h + 2.2 + j * 0.3, az], [0, r() * 3, 0]); }
    };
    // window panes on Meem's apartment block (its model has none that light up), so at night it has lit
    // windows like the code-built blocks round it. Measured on the model at its 20 m: the walls run x -9.9..9.9,
    // z -5.8 (back) .. 0.5 (front, a tree before its door); four rows of windows; balconies (no panes behind
    // them) at x -10..-8, -3.5..-1.5, 1.5..3 and 7.5..9.5 on the front, the outer two on the back
    const blockWins = (bx, bz, yaw) => {
      const c = Math.cos(yaw), sn = Math.sin(yaw), put = (lx, ly, lz, ry) => wins.push({ p: new THREE.Vector3(bx + lx * c + lz * sn, ly, bz - lx * sn + lz * c), yaw: yaw + ry });
      for (const y of [2.0, 3.75, 5.25, 7.0]) {
        for (const lx of [-6.6, -5.0, 0, 4.6, 6.1]) put(lx, y, 0.56, 0);
        for (const lx of [-6.3, -4.3, -2.3, -0.3, 1.7, 3.7, 5.7]) put(lx, y, -5.93, Math.PI);
        for (const lz of [-4.2, -1.6]) { put(9.95, y, lz, Math.PI / 2); put(-9.95, y, lz, -Math.PI / 2); }
      }
    };
    const pal = [0x8a6a58, 0x9a8a78, 0x7a7068, 0xa89880, 0x6a5a50, 0x8a7a6a];
    block(0, 0, 14, 12, ROOF, 0x8a6a58, 0x4a4a4c, true);
    block(-21, -8, 14, 16, 10, 0x9a8a78); block(19, -14, 12, 14, 15, 0x7a7068); block(0, -28, 26, 12, 9, 0xa89880);
    for (let gx = -6; gx <= 6; gx++) for (let gz = -6; gz <= 6; gz++) {
      const x = gx * 26 + (r() - 0.5) * 4, z = gz * 26 + (r() - 0.5) * 4;
      if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
      const far = Math.hypot(gx, gz);
      // Meem's apartment block in a few of the nearer spots, out where you look (south-west), facing our roof
      const ay = Math.round(Math.atan2(-x, -z) / (Math.PI / 2)) * Math.PI / 2;
      if ([[-2, 1], [-2, 2], [-1, 2], [0, 2]].some(([a, b]) => a === gx && b === gz) && TP.add('apartment_block', x, 0, z, ay)) { blockWins(x, z, ay); continue; }
      block(x, z, 12 + r() * 8, 10 + r() * 8, 8 + r() * (far > 4 ? 18 : 10), pal[Math.floor(r() * pal.length)]);
    }
    // a water tower on a roof, a church spire and a factory chimney on the skyline
    k.cyl(1.6, 1.6, 2.6, 10, 0x5a3a2a, [24, 15 + 3.4, -10]); k.cyl(0.001, 1.8, 1.2, 10, 0x4a3a2a, [24, 15 + 5.3, -10]); for (let i = 0; i < 4; i++) k.box(0.12, 2, 0.12, 0x3a2a1a, [24 + (i % 2 ? 1 : -1), 16, -10 + (i < 2 ? 1 : -1)]);
    k.box(8, 22, 8, 0xa8a090, [-60, 11, -170]); k.cyl(0.001, 4.5, 20, 8, 0x5a6a6a, [-60, 32, -170]);
    k.cyl(2, 3, 50, 10, 0x7a4a3a, [140, 25, -200]);
    // a washing line and a crate with the radio on our roof
    bar(k, new THREE.Vector3(-5.5, ROOF + 1.7, 3.8), new THREE.Vector3(5.5, ROOF + 1.7, 4.5), 0.02, 0xd8d8d8);
    for (const x of [-5.5, 5.5]) k.box(0.08, 1.7, 0.08, 0x5a4a3a, [x, ROOF + 0.85, x < 0 ? 3.8 : 4.5]);
    for (let i = 0; i < 5; i++) k.box(0.5 + r() * 0.3, 0.6 + r() * 0.4, 0.02, [0xe8e0d0, 0x8aa0c0, 0xd0a0a0, 0xe8e8e8, 0xa0c0a0][i], [-4 + i * 1.9, ROOF + 1.3, 3.95 + i * 0.14]);
    k.box(2.2, 2.4, 2.0, 0x7a5a48, [-4.6, ROOF + 1.2, -3.6]); k.box(2.4, 0.12, 2.2, 0x3a3a3c, [-4.6, ROOF + 2.46, -3.6]);   // the stair hut
    k.box(0.9, 2.0, 0.05, 0x4a3a2a, [-4.6, ROOF + 1.0, -2.58]); k.cyl(0.03, 0.03, 0.05, 6, 0xb8a060, [-4.25, ROOF + 1.0, -2.55], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) k.box(0.08, 2.08, 0.07, 0x3a2a1e, [-4.6 + s * 0.49, ROOF + 1.04, -2.57]); k.box(1.06, 0.08, 0.07, 0x3a2a1e, [-4.6, ROOF + 2.08, -2.57]);
    k.box(1.4, 0.05, 0.36, 0x6a4a2a, [3.8, ROOF + 0.45, -3.9]); for (const x of [3.2, 4.4]) k.box(0.06, 0.45, 0.32, 0x3a2a1a, [x, ROOF + 0.225, -3.9]);   // a bench
    for (const [x, z] of [[5.7, -1.5], [5.7, -0.6], [-5.7, 1.0]]) { k.cyl(0.18, 0.13, 0.3, 10, 0xa05a3a, [x, ROOF + 0.15, z]); k.ball(0.2, 1, 0x3a5a2a, [x, ROOF + 0.38, z], 0, [1, 0.7, 1]); }
    k.cyl(0.14, 0.11, 0.28, 10, 0x6a6e72, [-3.2, ROOF + 0.14, 2.6]);
    k.box(0.6, 0.5, 0.5, 0x6a4a2a, [1.6, ROOF + 0.25, -1.2]);
    const famRadio = TP.add('family_radio', 1.6, ROOF + 0.5, -1.2, 0);   // Meem's family radio on the crate (its dial on the right of its face)
    if (!famRadio) { k.box(0.5, 0.34, 0.28, 0x5a3a22, [1.6, ROOF + 0.67, -1.2]); k.box(0.36, 0.16, 0.02, 0xd8c8a0, [1.6, ROOF + 0.7, -1.055]); }
    // street lamps (one glowing draw call)
    for (let i = -6; i <= 6; i++) for (const zz of [-13, 13, -39, 39]) { const x = i * 26 + 13; k.cyl(0.08, 0.1, 6, 5, 0x2a2a2a, [x, 3, zz]); lampP.push([x, 6.1, zz]); }
    T.add(k.mesh()); T.add(ant.mesh(), TP.build({ glow: 0x231c16 }));
    T.add(windows(wins, { lit: 0.55, seed: 13, w: 1.0, h: 1.3, warm: 0xffc870 }));
    this.radioDial = glowSprite(0xffc060, 0.35, 0.9); this.radioDial.position.set(famRadio ? 1.72 : 1.6, famRadio ? ROOF + 0.65 : ROOF + 0.7, -1.0); T.add(this.radioDial);
    this.radioPos = new THREE.Vector3(1.6, ROOF + 0.7, -1.0);
    const L = glowPoints(lampP.length, { sizeScale: 300 }); lampP.forEach(([x, y, z], i) => { L.userData.pos.set([x, y, z], i * 3); L.userData.col.set([1, 0.85, 0.6], i * 3); L.userData.size[i] = 0.9; }); L.userData.commit(); T.add(L);
    this.washing = makeCloth(1.2, 0.8, { color: 0xd8d0c0, hang: true }); this.washing.group.position.set(4.6, ROOF + 1.7, 4.35); T.add(this.washing.group);
    this.townLife = new Life(T);
    this.pigeons = this.townLife.add(makeFlock({ n: 10, center: new THREE.Vector3(-20, 30, -30), r: 30, height: 6, color: 0x3a3a40, size: 0.7, seed: 7, speed: 7 }));
    // the families: ours, and neighbours on the roofs around
    // each one dressed differently (a city at dusk in 1957: coats, hats, a headscarf, a beret)
    const looks = [
      { kind: 'greatcoat', coat: 0x8a7a5a, hat: 'fedora', hatCol: 0x4a3a2a, moustache: true },
      { kind: 'dress', coat: 0x6a2a2e, hat: 'kerchief', hatCol: 0xc8b890, hair: 0x5a3a20 },
      { kind: 'kid', coat: 0xc83a3a, girl: true, hat: 'beret', hatCol: 0x2a3a6a, trousers: 0x2a2a2a, hair: 0x8a6030 },
      { kind: 'kid', coat: 0x3a5a7a, hat: 'cap', hatCol: 0x4a4a4a, trousers: 0x3a3a3a },
      { kind: 'jacket', coat: 0x5a5e62, hat: 'cap', hatCol: 0x2a2a2a, scarf: 0xb8a060 },
      { kind: 'kid', coat: 0x5a7a3a, trousers: 0x2a2a2a, hair: 0x2a1e14 },
      { kind: 'greatcoat', coat: 0x22263a, hat: 'fedora', hatCol: 0x5a5a5a, glasses: true },
      { kind: 'dress', coat: 0x3a6a5a, hat: 'beret', hatCol: 0x8a2a3a, hair: 0x2a1a10 },
      { kind: 'suit', coat: 0x6a5a48, trousers: 0x4a3e30, hat: 'none', hair: 0xb0aca4, moustache: true, tie: 0x2a4a2a },
      { kind: 'kid', girl: true, coat: 0xd8b040, hat: 'kerchief', hatCol: 0xe8e0d0 },
    ];
    // the mother and the boy of our family are Meem's (a red coat and headscarf; a puffy coat and knitted hat)
    const add = (x, y, z, h, i, face) => {
      const model = i === 1 ? 'soviet_woman' : i === 3 ? 'soviet_boy' : null;
      const P = model ? makePerson({ model, seed: 71 + i * 5, height: h }) : makeFolk({ seed: 71 + i * 5, height: h, ...looks[i] });
      P.g.position.set(x, y, z); P.g.rotation.y = face; T.add(P.g); P.ph = i; return P;
    };
    this.family = [add(-0.6, ROOF, -1.6, 1.78, 0, 2.6), add(0.6, ROOF, -2.0, 1.64, 1, 2.9), add(-0.2, ROOF, -0.9, 1.22, 2, 2.6), add(0.75, ROOF, -0.75, 1.32, 3, 3.1)];
    this.neigh = [add(-22, 10, -10, 1.7, 4, 2.4), add(-19.5, 10, -9, 1.2, 5, 2.4), add(19, 15, -15, 1.72, 6, 2.8), add(21, 15, -13, 1.62, 7, 2.6), add(-3, 9, -27, 1.7, 8, 2.9), add(2, 9, -28, 1.3, 9, 3.1)];
    // the moving light (the rocket's core stage) and, ahead of it, faint Sputnik
    this.passLight = glowSprite(0xfff4dc, 22, 0); this.passLight.renderOrder = 6; this.root.add(this.passLight);
    this.passSp = glowSprite(0xe8eeff, 8, 0); this.root.add(this.passSp);
    this.passLab = label('the rocket stage', 0.9); this.passLab.material.opacity = 0; this.root.add(this.passLab);
    this.passLab2 = label('Sputnik', 0.7); this.passLab2.material.opacity = 0; this.root.add(this.passLab2);
    // the memory of Era 1's last moment: Sputnik drifting past, beeping
    this.memSp = makeSputnik(this.envN); this.memSp.visible = false; this.root.add(this.memSp);
    this.memGlow = glowSprite(0xbfd8ff, 2.2, 0); this.memSp.add(this.memGlow);
    this.memSparks = glowPoints(60, { sizeScale: 300 }); this.memSparks.visible = false; this.root.add(this.memSparks);
  }

  // ---------- 4. The hill of echoes ----------
  buildHill() {
    const H = this.hill, SIZE = 3000, SEG = 120, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color(), grass = new THREE.Color(0x4a5236), dry = new THREE.Color(0x7a7256);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i); const r0 = Math.hypot(x, z), kk = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.8) * (SIZE / 2) / r0 : 0; x *= kk; z *= kk;
      p.setXYZ(i, x, hillH(x, z), z); c.copy(grass).lerp(dry, N3(x / 20, z / 20) * 0.7); cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); H.add(new THREE.Mesh(g, FLAT));
    // a village far below with its lights, and a road
    const lights = glowPoints(160, { sizeScale: 300 }), r = rng(77);
    for (let i = 0; i < 160; i++) { const a = 2.6 + (r() - 0.5) * 0.5, d = 350 + r() * 250, x = Math.cos(a) * d, z = Math.sin(a) * d; lights.userData.pos.set([x, hillH(x, z) + 2, z], i * 3); lights.userData.col.set([1, 0.8, 0.5], i * 3); lights.userData.size[i] = 1 + r() * 1.5; }
    lights.userData.commit(); H.add(lights);
    const k = new Kit(); for (let i = 0; i < 40; i++) { const a = r() * 6.28, d = 60 + r() * 300, x = Math.cos(a) * d, z = Math.sin(a) * d, y = hillH(x, z); k.cyl(0.15, 0.25, 4, 5, 0x2a221a, [x, y + 2, z]); k.ball(1.8, 1, 0x2a3a22, [x, y + 4.6, z], 0, [1, 1.3, 1]); }
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28 + 0.3; k.ball(0.5, 0, 0x6a6a62, [Math.cos(a) * 6.5, hillH(Math.cos(a) * 6.5, Math.sin(a) * 6.5) + 0.15, Math.sin(a) * 6.5], [r(), r(), r()], [1.3, 0.6, 1]); }
    H.add(k.mesh());
    // everyone from both eras, in a ring round you
    const who = [['storyteller', 'The storyteller, 30,000 years ago', 0xffd0a0], ['builder', 'The Stonehenge builders', 0xffe0b0], ['priest', 'The priests of the Nile', 0xffe8a0], ['skywatcher', 'The skywatchers of Babylon', 0xffc8a0], ['eratosthenes', 'Eratosthenes', 0xd8e8ff], ['ptolemy', 'Ptolemy', 0xd0d8ff], ['copernicus', 'Copernicus', 0xffd8a0], ['tycho', 'Tycho', 0xffe0c0], ['kepler', 'Kepler', 0xa8c8ff], ['galileo', 'Galileo', 0xc8e0ff], ['newton', 'Newton', 0xe0d0ff], ['tsiolkovsky', 'Tsiolkovsky', 0xbfd8ff], ['goddard', 'Goddard', 0xc0f0e0], ['von_braun', 'Wernher von Braun', 0xd0e4ff]];
    this.ringEchoes = who.map(([model, name, tint], i) => {
      const a = (i / who.length) * Math.PI * 2 + 0.25, x = Math.sin(a) * 4.6, z = -Math.cos(a) * 4.6;
      const E = new Echo(this.G, H, { model, tint, pos: new THREE.Vector3(x, hillH(x, z), z), face: Math.atan2(-x, -z), seed: 81 + i * 3, look: { beard: i % 3 === 1 } });
      E.lab = label(name, 0.13); E.lab.position.set(x, hillH(x, z) + 2.15, z); E.lab.material.opacity = 0; H.add(E.lab);
      E.i = i; return E;
    });
    // a ring of light on the grass where they stand, and a little pool of light at each one's feet
    this.ringGlow = glowPoints(144 + who.length, { sizeScale: 300 }); H.add(this.ringGlow);
    this.eraTitle = textSprite('Era 3: The Space Race', 3.6, { color: '#ffe7b0' }); this.eraTitle.material.opacity = 0; this.root.add(this.eraTitle);
    this.eraSub = textSprite('Starward', 1.5, { color: '#cfe0ff', glow: 'rgba(140,180,255,0.6)' }); this.eraSub.material.opacity = 0; this.root.add(this.eraSub);
  }

  registerInteractables() {
    const G = this.G, self = this;
    this.spIt = {
      hint: 'Reach out and touch Sputnik (TRIGGER or GRIP)', deskHint: 'Click Sputnik to touch it',
      get disabled() { return self.s.touch !== 1; },
      reach(pos) { self.sp.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 1.6); },
      aim(o, d) { self.sp.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.5 ? Math.min(t, 1) : Infinity; },
      onTouch() { G.act({ type: 'touchSputnik' }); }, onGrab() { G.act({ type: 'touchSputnik' }); },
    };
    G.interactables.push(this.spIt);
  }
  act(a) {
    if (a.type === 'touchSputnik' && this.s.touch === 1) { this.s.touch = 2; return true; }
    return this.journal.act(a);
  }
  getState() { return this.s; }
  setState(st) { const was = this.s.scene; Object.assign(this.s, st); if (st.scene && st.scene !== was) this.setScene(st.scene); }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    G.music.ready?.then(() => G.music.files.ch14 && G.music.preload?.(G.music.files.ch14));
    G.events.emit('placePlayers', { x: 0, z: 0, yaw: this.start.yaw });
    await G.ui.fadeIn(3);
    // 1. Night at the pad
    s.phase = 'arrive'; s.guide = this.W(-2.5, 31, 4).toArray();
    const l1 = D.sayAsync('ch14_01');
    await D.cue('Engineers'); s.phase = 'engineers'; s.guide = this.W(12, 3, 14).toArray();
    await D.cue('On the launch pad'); s.phase = 'rocket'; s.guide = this.W(-3, 20, 3).toArray(); this.beamPulse = 1;
    await l1;
    // 2. Korolev
    s.phase = 'korolev'; s.korolev = 1; s.guide = this.W(KS.x - 0.8, 2.6, KS.z - 1.4).toArray();
    const l2 = D.sayAsync('ch14_02');
    await D.cue('Tsiolkovsky'); s.echo = 1;
    await D.cue('His name was kept secret'); s.korolev = 2;
    await l2;
    await D.wait(fast ? 0.3 : 1.5);
    s.echo = 0; s.korolev = 3;
    // 3. Up the service tower to Sputnik
    await this.move(D, 'lift', yawTo(270));
    s.phase = 'rise'; s.rise = 1; s.guide = null;
    await D.until(() => this.liftK >= 1, fast ? 3 : 20);
    s.phase = 'nose';
    const l3 = D.sayAsync('ch14_03');
    await D.cue('On top'); s.nose = 1; s.guide = this.W(0.2, NOSE_Y + 2.4, 1.6).toArray();
    await D.cue('Its name'); s.spLabel = 1;
    await l3;
    s.touch = 1;
    D.hint(G.mode === 'desktop' ? this.spIt.deskHint : this.spIt.hint, 9);
    await D.auto(() => s.touch >= 2, () => { s.touch = 2; }, { after: fast ? 0.3 : 1.5, timeout: fast ? 2 : 20 });
    if (s.touch < 2) s.touch = 2;
    G.ui.showHint('');
    await D.wait(fast ? 0.4 : 3);
    s.nose = 0; s.spLabel = 0; s.guide = null;
    await D.until(() => this.noseK < 0.02, fast ? 2 : 6);
    // 4. The countdown, from the viewing spot
    await this.move(D, 'view', yawTo(bearing(-VS.x, -VS.z)), 1);
    // everyone who ever looked up has come to watch: they turn to greet you
    s.phase = 'crowd'; s.meet = 1; s.guide = this.W(...this.crowd[4].home.clone().setY(2.4).toArray()).toArray();
    await D.say('ch14_13');
    await D.wait(fast ? 0.3 : 1.5);
    s.meet = 2;
    s.phase = 'countdown'; s.trucks = 0;
    s.guide = at(bearing(-VS.x, -VS.z) - 14, 9, 3.3).toArray();
    s.count = 1;
    await D.until(() => this.cT >= 4);
    const l4 = D.sayAsync('ch14_04');
    s.num = 5;
    for (const [w, n] of [['four', 4], ['three', 3], ['two', 2], ['one', 1]]) { await D.cue(w); s.num = n; }
    await l4;
    await D.until(() => this.cT >= 10);
    // 5. Liftoff!
    s.num = 0; s.launch = 1; s.phase = 'liftoff'; s.guide = at(bearing(-VS.x, -VS.z) - 34, 6, 2.2).toArray();
    await D.say('ch14_05');
    // and the crowd: each one is named, glows softly and nods
    const l14 = D.sayAsync('ch14_14');
    await D.cue('The storytellers'); this.name('storyteller');
    await D.cue('the builders'); this.name('builder');
    await D.cue('the stargazers'); this.name('priest', 'skywatcher', 'chinese_astronomer', 'aristotle', 'eratosthenes', 'ptolemy', 'diver');
    await D.cue('Copernicus'); this.name('copernicus', 'tycho');
    await D.cue('Galileo'); this.name('galileo', 'kepler');
    await D.cue('Newton'); this.name('newton');
    await D.cue('Each one stood'); this.name('tsiolkovsky', 'goddard');
    await D.cue('shoulders'); this.name('von_braun');   // his own moment: Meem wants von Braun seen at Sputnik
    await l14;
    const l15 = D.sayAsync('ch14_15');
    await D.cue('all of those dreams'); s.allGlow = 1;
    await l15;
    await D.until(() => this.launchT >= 27, fast ? 10 : 45);
    s.allGlow = 0;
    // 6. Ride along to orbit
    await this.move(D, 'space', 0, 0.7);
    s.phase = 'ride'; s.ride = 1;
    await D.until(() => this.rideT >= 1.5);
    const l6 = D.sayAsync('ch14_06');
    await D.cue('Eight kilometers'); s.speedLab = 1;
    await D.cue("Just like Newton's"); s.ring = 1;
    await D.cue("It's in orbit"); s.cutoff = 1;
    await l6;
    s.speedLab = 0; s.sep = 1;
    await D.until(() => this.sepT >= 6.5, fast ? 3 : 12);
    // 7. The signal
    s.phase = 'radio'; s.radio = 1; s.ring = 0;
    await D.until(() => this.roomK > 0.9, fast ? 1 : 3);
    const l7 = D.sayAsync('ch14_07');
    await D.cue('Beep'); s.signal = 1;
    await D.cue("It's working"); s.cheer = 1;
    await l7;
    await D.wait(fast ? 0.4 : 3);
    s.radio = 0;
    // 8. Orbit
    s.phase = 'orbit'; s.orbit = 1;
    const l8 = D.sayAsync('ch14_08');
    await D.cue('Once around'); s.clock = 1;
    await l8;
    await D.until(() => this.orbitT >= 22, fast ? 3 : 14);
    s.clock = 0;
    // 9. All round the world: rooftops at dusk
    await this.move(D, 'roofs', yawTo(220), 1);
    s.phase = 'roofs'; s.orbit = 0; s.signal = 1; s.pass = 1;
    const l9 = D.sayAsync('ch14_09');
    await D.cue('That moving light'); s.lightLab = 1;
    await l9;
    // 10. The beep at the end of Era 1
    s.lightLab = 0; s.memory = 1;
    await D.say('ch14_10');
    await D.until(() => this.memT >= 12, fast ? 2 : 10);
    s.memory = 0; s.signal = 0; s.guide = null; G.guide.follow();
    // 11. Everyone on the hill
    await this.move(D, 'hill', yawTo(150), 1.2);
    s.phase = 'hill'; s.pass = 2; this.passT = 0; s.echoes = 1;
    await D.wait(fast ? 0.3 : 2);
    await D.say('ch14_11');
    // 12. The Moon rises: Era 3
    s.phase = 'moon'; s.moon = 1; s.guide = at(100, 7, 3.4).toArray();
    const l12 = D.sayAsync('ch14_12');
    await D.cue('walk on the Moon'); s.title = 1;
    await l12;
    await D.wait(fast ? 0.5 : 5);
    s.guide = null;
    s.phase = 'journal';
    await this.journal.present(D);
    s.phase = 'done';
  }

  // ---------- Every frame ----------
  update(dt, t) {
    const G = this.G, s = this.s;
    this.t += dt;
    if (s.scene !== this.cur) this.setScene(s.scene);
    const onSite = this.site.visible;
    this.updateSky(dt, t);
    if (onSite) { this.updatePad(dt, t); this.updateLaunch(dt, t); }
    this.updatePuffs(dt);
    this.updateLift(dt, t);
    this.updatePeople(dt, t);
    this.updateSpace(dt, t);
    this.updateRoom(dt, t);
    this.updateTown(dt, t);
    this.updateHill(dt, t);
    this.life.update(dt, t);
    const busy = this.journal.update();
    guideUpdate(this, busy);
  }

  updateSky(dt, t) {
    const G = this.G, s = this.s, c = this.cur;
    if (c === 'pad' || c === 'lift' || c === 'view') {
      const sun = sunAt(LAT, SUNLON, HOUR + this.t / 1800); G.sky.set(sun.az, sun.el);
      G.sky.setMoon(MOON.az, MOON.el, 1, MOON.phase);
      this.moonLight.position.copy(at(MOON.az, 200, 55)); this.moonLight.intensity = 0.55;
      // the flash: the whole desert lit orange
      const f = this.flash || 0;
      if (f > 0.001) {
        const U = G.sky.uni; _col.setRGB(1, 0.5, 0.15);
        U.horizon.value.lerp(_col.setRGB(0.6, 0.27, 0.08), Math.min(0.45, f * 0.4)); U.glow.value.lerp(_col, Math.min(0.2, f * 0.2)); U.zenith.value.lerp(_col.setRGB(0.1, 0.045, 0.02), Math.min(0.25, f * 0.2));
        G.sky.hemi.color.lerp(_col.setRGB(1, 0.55, 0.25), Math.min(0.8, f)); G.sky.hemi.intensity += f * 0.5;
        G.scene.fog.color.lerp(_col.setRGB(0.3, 0.13, 0.05), Math.min(0.5, f * 0.45));
        G.sky.starField.opacity *= 1 - Math.min(0.45, f * 0.4);
      }
    } else if (c === 'roofs') {
      const sun = sunAt(51.5, SUNLON + 1, 18.55 + this.t / 3000); G.sky.set(sun.az, sun.el);
      G.sky.setMoon(140, 18, 1, MOON.phase + 0.04);
      this.moonLight.position.copy(at(140, 200, 70)); this.moonLight.intensity = 0.3;
    } else if (c === 'hill') {
      const sun = sunAt(LAT, SUNLON + 2, 21.6); G.sky.set(sun.az, sun.el);
      // ch14_12: a huge full Moon rises in the east
      this.moonV = damp(this.moonV ?? 0, s.moon ? 1 : 0, 0.35 * this.F, dt);
      if (this.moonV > 0.003) G.sky.setMoon(100, -4 + 17 * ease(this.moonV), 6.5, 0.5); else G.sky.hideMoon();
      this.moonLight.position.copy(at(100, 200, 40)); this.moonLight.intensity = 0.25 + 0.6 * this.moonV;
    } else this.moonLight.intensity = 0;
    if (c !== 'space') this.spaceSun.material.opacity = 0;
  }

  // ---------- The pad, living ----------
  updatePad(dt, t) {
    const G = this.G, s = this.s, F = this.F;
    // searchlights: on the rocket; dim for the countdown
    this.beamV = damp(this.beamV ?? 1, s.count ? (this.cT > 2 ? 0.22 : 1) : 1, 0.8, dt);
    this.beamPulse = Math.max(0, (this.beamPulse || 0) - dt * 0.5);
    this.beamMat.uniforms.amt.value = this.beamV * (1 + this.beamPulse * 0.8) * (this.launchT > 3 ? clamp01(1 - (this.launchT - 3) / 3) : 1);
    this.spots.forEach((L, i) => {
      const p0 = this.beamFrom[i + 1]; this.W(p0.x, p0.y, p0.z, L.position); this.W(0, 14, 0, L.target.position);
      L.intensity = (i ? 70 : 120) * this.beamV * (this.launchT > 2 ? 0.2 : 1);
    });
    this.lamps.visible = this.beamV > 0.5 || this.cur !== 'view';
    for (const m of this.details) m.visible = this.cur !== 'view';
    this.viewLight.intensity = this.cur === 'view' ? 14 * (0.45 + 0.55 * this.beamV) : 0; this.W(this.viewLampPos.x, this.viewLampPos.y, this.viewLampPos.z, this.viewLight.position);
    // trucks drive the road (and leave for the countdown)
    const CG = this.carGlow.userData; let ci = 0;
    for (const T of this.trucks) {
      if (s.trucks && T.speed > 0) {
        if (T.wait > 0) T.wait -= dt;
        else {
          const tgt = T.path[T.i], g = T.g.position, dx = tgt.x - g.x, dz = tgt.z - g.z, d = Math.hypot(dx, dz);
          if (d < 0.5) { T.i = (T.i + 1) % T.path.length; if (T.i % 3 === 0) T.wait = 4 + (T.i % 2) * 3; }
          else {
            const want = Math.atan2(dx, dz); let dy = want - T.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); T.g.rotation.y += dy * Math.min(1, dt * 2);
            const st = Math.min(d, T.speed * dt * (Math.abs(dy) > 0.6 ? 0.4 : 1)); g.x += dx / d * st; g.z += dz / d * st; g.y = siteH(g.x, g.z);
            for (const w of T.wheels) w.rotation.x += st / 0.5;
          }
        }
      }
      // headlights
      for (const [lx, ly, lz] of T.lamps) { T.g.localToWorld(_a.set(lx, ly, lz)); this.site.worldToLocal(_a); CG.pos.set([_a.x, _a.y, _a.z], ci * 3); CG.col.set([1, 0.95, 0.8], ci * 3); CG.size[ci] = T.speed > 0 ? 0.9 : 0.4; ci++; }
    }
    while (ci < 12) { CG.size[ci] = 0; ci++; }
    CG.commit();
    // vapour pours off the frosty oxygen tanks and sinks in the cold air
    if (this.launchT < 1) {
      this.ventT -= dt;
      if (this.ventT <= 0) {
        this.ventT = 0.06;
        const v = this.vents[Math.floor(Math.random() * this.vents.length)], R = this.rocket.position;
        const ox = v[0] * 1.05, oz = v[2] * 1.05, L = Math.hypot(ox, oz) || 1;
        this.puffs.emit(R.x + ox, R.y + v[1], R.z + oz, ox / L * 0.6 + (Math.random() - 0.5) * 0.3, -0.5 - Math.random() * 0.6, oz / L * 0.6, 0.4, 3.2 + Math.random() * 2, 6 + Math.random() * 3, 0xe8ecf2, 0.32, 0.4);
        if (Math.random() < 0.25) this.puffs.emit(12.2, 1.6, 9, (Math.random() - 0.5) * 0.4, -0.2, 0.3, 0.4, 2.5, 5, 0xe8ecf2, 0.28, 0.5);   // the tanker's hose
      }
    }
    if (this.cur === 'pad' || this.cur === 'lift') {
      this.clankT -= dt;
      if (this.clankT <= 0) { this.clankT = 3 + Math.random() * 6; const p = this.W(...(Math.random() < 0.5 ? [8.6, 12 + Math.random() * 14, 0] : [Math.random() * 4 - 2, 0.5 + Math.random() * 18, 1.6]), _a); if (Math.random() < 0.5) clank(G, p.clone(), 0.25); else hiss(G, p.clone(), 0.22); }
    }
    this.stove.update(dt, t);
    this.hoseM.visible = !s.count; this.cage.visible = !s.count;
    // the nose fairing opens (ch14_03)
    this.noseK = damp(this.noseK, s.nose ? 1 : 0, 1.1 * F, dt);
    const na = ease(this.noseK) * 1.15;
    for (const h of this.halves) h.hinge.rotation.x = (h.south ? 1 : -1) * na;
    this.sp.userData.open(0.05 + 0.05 * this.noseK);
    this.sp.rotation.y = this.t * 0.15 * this.noseK;
    this.noseLight.intensity = 6 * this.noseK; this.sp.getWorldPosition(this.noseLight.position); this.noseLight.position.x += 1.2; this.noseLight.position.y += 0.6;
    const touchGlow = s.touch === 1 ? 0.5 + 0.3 * Math.sin(t * 5) : 0;
    this.spGlowV = damp(this.spGlowV || 0, s.touch === 2 && this.noseK > 0.5 ? 1 : 0, 3, dt);
    this.spGlow.material.opacity = Math.max(touchGlow * this.noseK, this.spGlowV * (0.6 + 0.2 * Math.sin(t * 9)));
    this.spGlow.scale.setScalar(1 + this.spGlowV * 0.6);
    if (s.touch === 2 && !this.touched) { this.touched = true; shimmer(G, 2.5, 0.2); G.audio.chime(this.sp.getWorldPosition(_a), 0.5); for (const h of G.player.hands) G.player.haptic(h, 0.5, 120); setTimeout(() => this.beepNow = 3, 600); }
    if (this.beepNow > 0 && (this.beepT -= dt) <= 0) { this.beepT = 0.62; this.beepNow--; beep(G, this.sp.getWorldPosition(_a).clone(), 0.08); }
    this.spLabV = damp(this.spLabV || 0, s.spLabel ? 1 : 0, 2.5, dt); this.spLab.material.opacity = this.spLabV;
    // the countdown: the service tower lowers away, sirens, the cable mast swings back
    if (s.count && this.cT < 0) { this.cT = 0; siren(G, this.W(0, 4, 0), 7, 0.9); this.tl = [[7, () => siren(G, this.W(0, 4, 0), 3.5, 0.9)]]; }
    if (this.cT >= 0) {
      this.cT += dt * F;
      for (const e of [...(this.tl || [])]) if (this.cT >= e[0]) { this.tl.splice(this.tl.indexOf(e), 1); e[1](); }
      this.tower.rotation.z = -ease(clamp01((this.cT - 0.5) / 7)) * 1.4;
      this.mast.rotation.z = -ease(clamp01((this.cT - 8.6) / 1.2)) * 0.6;
    }
    // the countdown numbers, floating out in front of you
    if (!this.nums) { this.nums = [1, 2, 3, 4, 5].map((n) => { const sp = textSprite(String(n), 1.6, { color: '#ffe0a0', glow: 'rgba(255,150,60,0.8)' }); sp.material.opacity = 0; this.root.add(sp); return sp; }); }
    const vb = bearing(-VS.x, -VS.z);
    this.nums.forEach((sp, i) => { const on = s.num === i + 1 && this.cur === 'view'; sp.material.opacity = damp(sp.material.opacity, on ? 1 : 0, on ? 10 : 4, dt); sp.position.copy(at(vb, 10, 4.6)); sp.scale.set(sp.scale.y * (sp.material.map.image.width / sp.material.map.image.height), 1.6 + (on ? 0.3 * (1 - sp.material.opacity) : 0), 1); sp.visible = sp.material.opacity > 0.01; });
  }

  // ---------- Ignition, liftoff, the climb, and the Korolev cross ----------
  updateLaunch(dt, t) {
    const G = this.G, s = this.s, F = this.F, R = this.rocket, fl = this.flight;
    if (s.launch && this.launchT < 0) this.ignite();
    if (this.launchT < 0) { this.flash = 0; this.flameLight.intensity = 0; return; }
    const prevT = this.launchT; this.launchT += dt * F; const T = this.launchT, dtt = dt * F;
    // engines: build up over the first two seconds
    const thrust = clamp01(T / 1.6), sep = T >= 18;
    const amt = (0.75 + 0.25 * Math.sin(t * 40)) * thrust;
    this.coreFlame.visible = true; this.coreFlame.material.uniforms.amt.value = amt; this.coreFlame.material.uniforms.t.value = t;
    this.coreFlame.scale.set(1 + 0.4 * clamp01((T - 4) / 8), 1 + 0.9 * clamp01((T - 4) / 8) + 0.08 * Math.sin(t * 31), 1 + 0.4 * clamp01((T - 4) / 8));
    for (const B of this.boosters) { const on = !sep || T < 17.7; B.fl.visible = on; B.fl.material.uniforms.amt.value = on ? amt : 0; B.fl.material.uniforms.t.value = t + B.b; B.fl.scale.copy(this.coreFlame.scale); }
    // the climb: slow at first, faster and faster, leaning over toward the north-east
    if (T > 2.4) {
      const tt = T - 2.4, h = fl.pos.y;
      const theta = 42 * D2R * Math.pow(clamp01((h - 110) / 1100), 0.8);
      fl.dir.set(Math.sin(LAUNCH_AZ * D2R) * Math.sin(theta), Math.cos(theta), -Math.cos(LAUNCH_AZ * D2R) * Math.sin(theta));
      const v = 9.4 * tt;
      fl.vel.copy(fl.dir).multiplyScalar(v);
      fl.pos.addScaledVector(fl.vel, dtt);
      R.position.copy(fl.pos);
      R.quaternion.setFromUnitVectors(Y, fl.dir);
    }
    // the support arms fall back as it rises; the flame light climbs with it
    for (const A of this.arms) A.m.rotation.z = -ease(clamp01((T - 2.2) / 1.6)) * 0.62;
    const tail = _a.copy(fl.dir).multiplyScalar(-2).add(fl.pos);
    this.W(tail.x, Math.max(tail.y, 2), tail.z, this.flameLight.position);
    const fade = clamp01(1 - (T - 20) / 8);
    this.flash = Math.min(1.2, thrust * (1.2 - 0.85 * clamp01((T - 2) / 8)) * fade);
    this.flameLight.intensity = 700 * thrust * (0.85 + 0.15 * Math.sin(t * 33)) * (0.4 + 0.6 * clamp01(1 - (T - 6) / 14));
    // haptics: the rumble reaches your hands with the sound
    const here = this.cur === 'view' ? this.soundDelay : 0;
    if (T > here * F && T < (here + 9) * F) { this.hapT = (this.hapT || 0) - dt; if (this.hapT <= 0) { this.hapT = 0.12; const k = clamp01(1 - (T / F - here) / 9) * 0.9 + 0.1; for (const h of G.player.hands) G.player.haptic(h, k, 150); } }
    // the tail glow and the fire trail
    G.camera.getWorldPosition(_b); const dist = this.W(fl.pos.x, fl.pos.y, fl.pos.z, _c).distanceTo(_b);
    this.tailGlow.position.copy(tail).addScaledVector(fl.dir, -3);
    this.tailGlow.material.opacity = Math.min(1, thrust * 1.2) * (0.85 + 0.15 * Math.sin(t * 27));
    this.tailGlow.scale.setScalar(clamp(12 + dist * 0.05, 14, 90) * (1 + 0.3 * clamp01((T - 3) / 6)));
    this.tailGlow.visible = T < 32;
    const FP = this.fire.userData; this.fire.visible = T < 32;
    for (let i = 0; i < 160; i++) {
      const f = i / 160, l = f * (24 + 30 * clamp01((T - 3) / 8));
      const w = (Math.sin(i * 12.9898) * 0.5) * (1 + f * 3), w2 = Math.cos(i * 4.1414) * 0.5 * (1 + f * 3);
      FP.pos.set([tail.x - fl.dir.x * l + w, tail.y - fl.dir.y * l, tail.z - fl.dir.z * l + w2], i * 3);
      const v = (1 - f) * thrust * (0.75 + 0.25 * Math.sin(t * 20 + i));
      FP.col.set([v, v * (0.75 - f * 0.4), v * (0.4 - f * 0.3)], i * 3); FP.size[i] = 1.6 + f * 5;
    }
    FP.commit();
    // smoke: a wall of steam and dust rolling out from the pit; then the trail behind the rocket
    this.smokeT = (this.smokeT || 0) - dtt;
    if (this.smokeT <= 0 && T < 26) {
      this.smokeT = 0.05;
      if (T < 9) for (let i = 0; i < 4; i++) {
        const a = Math.random() < 0.55 ? (-90 + (Math.random() - 0.5) * 50) * D2R : Math.random() * 6.28, sp = 18 + Math.random() * 34;
        const x0 = Math.cos(a) * 6, z0 = Math.sin(a) * 6;
        this.puffs.emit(x0, 2 + Math.random() * 3, z0 - (a < 0 ? 10 : 0), Math.cos(a) * sp, 2 + Math.random() * 5, Math.sin(a) * sp, 6, 38 + Math.random() * 30, 16 + Math.random() * 10, Math.random() < 0.5 ? 0x8a8478 : 0xb8b4ac, 0.55, 0.35, 1.2);
      }
    }
    // the smoke trail: puffs laid evenly along the path flown since last frame, so it reads as one column
    if (T > 2.6 && T < 30) {
      const last = this.trailLast || (this.trailLast = tail.clone()), L = last.distanceTo(tail), step = clamp(4 + fl.pos.y / 120, 4, 16);
      const n = Math.min(14, Math.floor(L / step));
      for (let i = 1; i <= n; i++) {
        const f = i / n, jit = () => (Math.random() - 0.5) * 2.5, hi = clamp01(fl.pos.y / 1500);
        this.puffs.emit(lerp(last.x, tail.x, f) + jit(), lerp(last.y, tail.y, f) + jit(), lerp(last.z, tail.z, f) + jit(), -fl.vel.x * 0.08, -fl.vel.y * 0.08, -fl.vel.z * 0.08,
          9 + hi * 10, 26 + hi * 30 + Math.random() * 12, 26, 0xb4b4bc, 0.62, 0.6, 1.6);
      }
      if (n > 0) last.copy(tail);
    }
    // high up, the four boosters fall away in a glowing cross
    if (sep && !this.sepped) {
      this.sepped = true; this.sepAt = fl.pos.clone();
      const side = new THREE.Vector3();
      for (const B of this.boosters) {
        B.m.getWorldPosition(_a); B.m.getWorldQuaternion(_q);
        this.site.add(B.g); this.site.worldToLocal(_a); B.g.position.copy(_a); B.g.quaternion.copy(_q); B.m.rotation.set(0, 0, 0); B.m.position.set(0, 0, 0);
        side.copy(at(B.b, 1)).applyQuaternion(R.quaternion).normalize();
        B.v.copy(fl.vel).multiplyScalar(0.82).addScaledVector(side, 55);
        B.spin.set(side.z, 0, -side.x).normalize().multiplyScalar(0.9);
        B.glow.visible = true; B.trail.length = 0;
      }
      this.cross.visible = true; this.crossFlare.visible = true; this.crossT = 0;
      G.audio.ctx && whoosh(G, 4, 0.25);
    }
    if (this.sepped) {
      this.crossT += dtt;
      const k = this.crossT, CP = this.cross.userData;
      this.boosters.forEach((B, bi) => {
        B.v.y -= 9.8 * dtt * 0.6; B.g.position.addScaledVector(B.v, dtt);
        _q.setFromAxisAngle(B.spin, B.spin.length() * dtt * 0.6); B.g.quaternion.premultiply(_q);
        const tp = _a.set(0, 0.2, 0).applyQuaternion(B.g.quaternion).add(B.g.position);
        if ((B.tt = (B.tt || 0) - dtt) <= 0) { B.tt = 0.08; B.trail.unshift(tp.clone()); if (B.trail.length > 70) B.trail.pop(); }
        const hot = clamp01(1 - k / 9);
        B.glow.position.copy(tp); B.glow.material.opacity = hot * (0.8 + 0.2 * Math.sin(t * 13 + bi)); B.glow.scale.setScalar(26 * (0.6 + 0.4 * hot) * clamp(dist / 500, 0.6, 3));
        for (let i = 0; i < 70; i++) {
          const p = B.trail[i], j = bi * 70 + i;
          if (!p) { CP.size[j] = 0; continue; }
          CP.pos.set([p.x, p.y, p.z], j * 3); const v = hot * (1 - i / 70) * 0.9;
          CP.col.set([v, v * 0.62, v * 0.25], j * 3); CP.size[j] = 9 + i * 0.45;
        }
      });
      CP.commit();
      this.crossFlare.position.copy(this.sepAt); this.crossFlare.material.opacity = clamp01(1 - k / 4) * clamp01(k * 4);
      this.crossFlare.scale.setScalar(480 + k * 140);
      this.crossFlare.visible = k < 4.1;
      if (k > 10) { this.cross.visible = false; for (const B of this.boosters) B.glow.visible = false; }
    }
    // after the boosters, the core stage burns on alone: a little star climbing away
    if (T > 32) { this.coreFlame.visible = false; }
    void prevT;
  }

  ignite() {
    const G = this.G; this.launchT = 0;
    G.camera.getWorldPosition(_a); this.soundDelay = this.cur === 'view' ? this.W(0, 2, 0, _b).distanceTo(_a) / SPEED_OF_SOUND : 0;
    const d = this.soundDelay / this.F;
    setTimeout(() => { if (this.G.director.chapter !== this) return; roar(G, this.W(0, 6, 0), 22, 3.2); G.audio.boom?.(null); }, d * 1000);
    setTimeout(() => { if (this.G.director.chapter !== this) return; G.audio.cheer?.(this.W(VS.x + 4, 1.6, VS.z - 2)); }, (d + 6) * 1000);
    for (const h of G.player.hands) G.player.haptic(h, 0.3, 200);
  }

  updatePuffs(dt) {
    const G = this.G, onSite = this.site.visible;
    this.puffs.mesh.visible = onSite;
    if (!onSite) return;
    this.puffs.mat.uniforms.scale.value = G.mode === 'vr' ? 760 : innerHeight / (2 * Math.tan(G.camera.fov * D2R / 2));
    const fp = this.flameLight.position, I = this.flameLight.intensity / 700, sx = this.site.position.x, sy = this.site.position.y, sz = this.site.position.z;
    this.puffs.update(dt * (this.launchT >= 0 ? this.F : 1), [1.2, 0.5], I > 0.01 ? (q) => { const d = Math.hypot(q.x + sx - fp.x, q.y + sy - fp.y, q.z + sz - fp.z); return I * 1.6 / (1 + d / 25); } : null);
  }

  // ---------- The lift ride up the service tower ----------
  updateLift(dt, t) {
    const s = this.s;
    if (this.cur !== 'lift') return;
    if (s.rise && this.liftK < 1) {
      this.riseT = (this.riseT || 0) + dt * this.F;
      const up = ease(clamp01(this.riseT / 11)), glide = ease(clamp01((this.riseT - 11.5) / 3));
      this.liftY = lerp(APRON, DECK, up); this.liftX = lerp(LIFT0, LIFT1, glide);
      this.liftK = glide >= 1 ? 1 : 0;
      if (!this.liftSound) { this.liftSound = true; const A = this.G.audio; if (A.ctx) { longNoise(A, A.out(null, 0.25), { type: 'bandpass', f: 140, q: 2, peak: 0.6, a: 0.6, h: 9, d: 1.5 }); clank(this.G, null, 0.3); } }
      if (this.riseT > 11 && !this.liftStop) { this.liftStop = true; clank(this.G, null, 0.35); }
    }
    this.site.position.set(-this.liftX, 0, 0);
    this.cage.position.set(Math.max(this.liftX, LIFT0), this.liftY, 0);
  }

  // ---------- People ----------
  updatePeople(dt, t) {
    const s = this.s, G = this.G, K = this.korolev;
    if (this.site.visible) {
      const top = this.W(0, 26, 0, new THREE.Vector3()), rocketTop = this.rocket.position.clone().add(this.site.position).add(_a.set(0, 24, 0).applyQuaternion(this.rocket.quaternion));
      const view = this.cur === 'view';
      // Korolev
      if (!view) {
        if (s.korolev && !K.g.visible) { K.g.visible = true; clank(G, this.W(DOOR.x, 1.2, DOOR.z), 0.4); }
        if (s.korolev) {
          if (walkToward(K, KS.x, KS.z, dt, { speed: 0.9 * this.F, height: stepH })) { K.pose = s.korolev === 2 ? 'idle' : 'idle'; K.look = top.clone(); K.g.rotation.y = damp(K.g.rotation.y, Math.atan2(-KS.x, -KS.z), 2, dt); }
        }
      } else {
        if (!this.kView) { this.kView = true; K.g.visible = true; K.g.position.copy(this.korolevView); K.g.rotation.y = Math.atan2(this.vf.x, this.vf.z); holdProp(K, makeBinoculars(), 'Right', [0, 0.05, 0.05]); }
        const lt = this.launchT;
        K.pose = lt < 0 ? 'hold' : lt < 6 * this.F ? 'gasp' : lt < 12 * this.F ? 'point' : 'cheer';
        K.pointAt.copy(rocketTop); K.look = rocketTop.clone();
      }
      if (K.g.visible) animatePerson(K, t, dt);
      // Tsiolkovsky's book glows open beside Korolev, its pages turning
      this.bookV = damp(this.bookV || 0, s.echo && !view ? 1 : 0, 2, dt);
      this.book.visible = this.bookV > 0.01;
      if (this.book.visible) {
        const B = this.book.userData; this.book.scale.setScalar(0.6 + 0.9 * ease(this.bookV)); this.book.position.y = 1.45 + 0.05 * Math.sin(t * 1.3);
        this.book.lookAt(G.camera.getWorldPosition(_a)); this.book.rotateX(-0.3);
        B.glow.material.opacity = 0.55 * this.bookV; B.page.rotation.y = -Math.PI * ease(((t * 0.4) % 1) * 1.3); B.mats.forEach((m) => { m.opacity = this.bookV; });
        this.bookLab.material.opacity = this.bookV;
        const SP = B.sparks.userData;
        for (let i = 0; i < 30; i++) { const a = i * 2.4 + t * 0.6, y = ((i * 0.13 + t * 0.15) % 1); SP.pos.set([Math.cos(a) * 0.3 * (1 - y), 0.05 + y * 0.7, Math.sin(a) * 0.3 * (1 - y)], i * 3); const v = this.bookV * (1 - y) * 0.8; SP.col.set([v, v * 0.85, v * 0.55], i * 3); SP.size[i] = 0.03; }
        SP.commit();
      }
      this.chiefV = damp(this.chiefV || 0, s.korolev === 2 && !view ? 1 : 0, 2.5, dt);
      this.chiefLab.material.opacity = this.chiefV; this.chiefLab.position.copy(K.g.position).setY(K.g.position.y + 2.3); this.chiefLab.visible = this.chiefV > 0.01;
      // engineers
      for (const P of this.eng) {
        P.g.visible = !view;
        if (view) continue;
        if (s.korolev && s.korolev < 3 && P.home) { P.pose = 'idle'; P.look = K.g.getWorldPosition(new THREE.Vector3()).setY(1.6); }
        else if (P.routine) runRoutine(P, dt, { height: siteH, speed: 1 });
        else { P.pose = P.home.pose; P.look = null; P.glance = true; }
        if (s.phase === 'rocket' && P.home && P.home.x < 0) { P.pose = 'point'; this.W(0, 24, 0, P.pointAt); P.look = P.pointAt.clone(); }
        animate(P, t, dt); P.lamp?.userData.flicker?.(t);
      }
      this.towerMan.g.visible = !s.count; if (!s.count) animate(this.towerMan, t, dt);
      this.updateCrowd(dt, t, view, rocketTop);
    }
  }

  // The crowd at the viewing spot: they turn to greet you (ch14_13), watch the countdown, gasp, point
  // and cheer at liftoff, three pairs hug, and each one glows softly and nods as they're named (ch14_14)
  updateCrowd(dt, t, view, rocketTop) {
    const G = this.G, s = this.s, eye = G.camera.getWorldPosition(_e).sub(this.site.position), lr = this.launchT < 0 ? -1 : this.launchT / this.F;
    this.meetV = damp(this.meetV || 0, s.meet === 1 ? 1 : 0, 1.5, dt);
    if (s.meet === 1 && this.meetT == null) this.meetT = G.t;
    const hugOn = lr > 7, me = G.camera.getWorldPosition(new THREE.Vector3());
    for (const P of this.crowd) {
      P.g.visible = view; P.lab.visible = P.halo.visible = false;
      if (!view) continue;
      // which way they face: the rocket, or turned toward you while you're greeted
      const toMe = Math.atan2(eye.x - P.g.position.x, eye.z - P.g.position.z);
      let dy = toMe - P.yawR; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      let yaw = P.yawR + dy * 0.75 * this.meetV, want = P.home;
      const pair = hugOn && this.hugs.find((h) => h.includes(P));
      const other = pair && (pair[0] === P ? pair[1] : pair[0]);
      if (pair) {
        const mid = _a.addVectors(P.home, other.home).multiplyScalar(0.5), d = _b.subVectors(P.home, other.home).setY(0).normalize();
        want = _c.copy(mid).addScaledVector(d, 0.27); yaw = Math.atan2(other.g.position.x - P.g.position.x, other.g.position.z - P.g.position.z);
      }
      const g = P.g.position; g.x = damp(g.x, want.x, 1.6, dt); g.z = damp(g.z, want.z, 1.6, dt); g.y = siteH(g.x, g.z);
      let ry = yaw - P.g.rotation.y; ry = Math.atan2(Math.sin(ry), Math.cos(ry)); P.g.rotation.y += ry * Math.min(1, dt * 3);
      // what they do
      const named = P.namedT != null ? G.t - P.namedT : 99;
      // von Braun turns to you and nods while he's named, so you see his face (Meem wants him seen here)
      if (!pair && P.name === 'von_braun' && named < 4) { yaw = toMe; let r2 = yaw - P.g.rotation.y; r2 = Math.atan2(Math.sin(r2), Math.cos(r2)); P.g.rotation.y += r2 * Math.min(1, dt * 3); }
      if (!pair && P.name === 'von_braun' && named < 4) { P.pose = 'idle'; P.look = me.clone(); }   // arms down: just looks at you and nods (a raised arm could read as a salute)
      else if (pair) { P.pose = 'hold'; P.look = other.g.position.clone().add(this.site.position).setY(1.6); }
      else if (lr < 0) { P.pose = this.meetV > 0.5 && P.i % 5 === 0 ? 'wave' : 'idle'; P.look = this.meetV > 0.3 ? me.clone() : rocketTop.clone(); }
      else { P.pose = lr < 2.5 ? 'idle' : lr < 6 ? (P.i % 3 ? 'gasp' : 'point') : P.i % 3 === 0 ? 'point' : P.i % 3 === 1 ? 'cheer' : 'wave'; P.look = rocketTop.clone(); }
      P.pointAt.copy(rocketTop);
      animate(P, t, dt);
      // named: a nod and a soft warm light on them
      const nk = named < 3.5 ? Math.min(1, named / 0.4) * clamp01((3.5 - named) / 1.2) : 0;
      P.k = damp(P.k, Math.max(nk, s.allGlow ? 0.75 : 0), 3, dt); P.kn = damp(P.kn || 0, nk, 3, dt);
      const nod = named < 1.6 ? Math.sin(named * 7.8) * 0.22 * (1 - named / 1.6) : 0;
      if (P.rig?.bones.Head) P.rig.bones.Head.rotateX(nod); else P.nod = nod;
      P.halo.visible = P.k > 0.01; P.halo.material.opacity = 0.4 * P.k; P.halo.scale.setScalar(1.6 + 0.2 * Math.sin(t * 2 + P.i));
      P.halo.position.copy(P.g.position).add(_d.set(0, 1.15, 0)).addScaledVector(_b.subVectors(P.g.position, eye).setY(0).normalize(), 0.35);
      // their names: one by one as you're greeted, and again as they're named
      const lv = Math.max(this.meetV > 0.5 && G.t - this.meetT > P.i * 0.25 ? 1 : 0, P.kn);
      P.lab.material.opacity = damp(P.lab.material.opacity, lv * 0.9, 3, dt); P.lab.visible = P.lab.material.opacity > 0.01;
      P.lab.position.copy(P.g.position).setY(P.g.position.y + (P.H || 1) * 1.75 + 0.3 + (P.i % 2) * 0.16);
    }
  }
  // ch14_14: light up the people a phrase names
  name(...who) { for (const P of this.crowd) if (who.includes(P.name)) P.namedT = this.G.t; }

  // ---------- Out in space: the ride, Sputnik set free, orbit ----------
  updateSpace(dt, t) {
    const G = this.G, s = this.s, SP = this.space, F = this.F;
    if (this.cur !== 'space') return;
    const eye = G.camera.getWorldPosition(_e).clone();
    if (this.rideT < 0) {
      this.rideT = 0; this.earthA = 0;
      // orient the Earth: Tyuratam straight below, the launch direction (north-east) ahead of you
      const u = lonLat(LAT, LON), n = lonLat(LAT + 0.5, LON).sub(u), e = lonLat(LAT, LON + 0.5).sub(u);
      n.addScaledVector(u, -n.dot(u)).normalize(); e.addScaledVector(u, -e.dot(u)).normalize();
      const ahead = n.multiplyScalar(Math.cos(LAUNCH_AZ * D2R)).add(e.multiplyScalar(Math.sin(LAUNCH_AZ * D2R))).normalize();
      const zs = ahead.clone().negate(), xs = new THREE.Vector3().crossVectors(u, zs);
      this.earthQ0 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xs, u, zs).transpose());
      this.sunB = -9;
      roar(G, eye.clone().add(_a.set(5, -6, 22)), 14, 0.9);
      whoosh(G, 6, 0.4);
      this.rideHalves.forEach((h) => { h.m.position.set(0, NOSE_Y, 0); h.m.rotation.set(0, 0, 0); h.m.visible = true; });
      this.rideRocket.add(this.sp2); this.sp2.position.set(0, NOSE_Y + 1.25, 0); this.sp2.rotation.set(0, 0, 0); this.sp2.userData.open(0.05);
    }
    this.rideT += dt * F;
    const T = this.rideT;
    // speed: the Earth turns under you faster and faster; altitude grows, the curve appears
    const spin = s.orbit ? 0.32 : 0.012 + 0.05 * ease(T / 12);
    this.earthA += spin * dt * F;
    let alt = lerp(22, 75, ease(T / 14));
    if (s.orbit) { this.orbitT = (this.orbitT < 0 ? 0 : this.orbitT) + dt * F; alt = lerp(75, 160, ease(this.orbitT / 6)); }
    SP.earth.position.set(eye.x, eye.y - ER - alt, eye.z);
    SP.earth.quaternion.setFromAxisAngle(X, this.earthA).multiply(this.earthQ0);
    // the Sun: just below the horizon ahead (dawn on the edge); in orbit it rises, crosses and sets, again and again
    if (s.orbit) this.sunB += 26 * dt * F;
    const sb = this.sunB * D2R; SP.sunDir.set(0, Math.sin(sb), -Math.cos(sb)).normalize();
    SP.atmoU.sun.value.copy(SP.sunDir);
    // our Sun sprite, hidden behind the Earth when it's behind it
    const c = _a.copy(SP.earth.position).sub(eye), tca = c.dot(SP.sunDir), d2 = c.lengthSq() - tca * tca;
    const hidden = tca > 0 && d2 < (ER * 1.01) ** 2;
    this.sunVis = damp(this.sunVis || 0, hidden ? 0 : 1, 6, dt);
    this.spaceSun.position.copy(eye).addScaledVector(SP.sunDir, 900); this.spaceSun.material.opacity = this.sunVis;
    SP.sun.intensity = 3.2 * (0.15 + 0.85 * this.sunVis);
    // city lights on the night side
    const CL = this.cities.userData; SP.earth.updateMatrixWorld();
    this.cityPts.forEach((p, i) => { _b.copy(p).normalize().applyQuaternion(SP.earth.quaternion); const night = clamp01((-_b.dot(SP.sunDir) - 0.02) * 8); const v = night * (0.55 + 0.45 * Math.sin(i * 7.7)); CL.col.set([v, v * 0.78, v * 0.45], i * 3); CL.size[i] = 3.5 + (i % 5); });
    CL.commit();
    // the ride rocket alongside (to your right, nose ahead), until Sputnik is set free
    const RR = this.rideRocket, pitch = lerp(18, 4, ease(T / 12)) * D2R;
    if (!s.sep) {
      RR.position.set(eye.x + 6.5, eye.y - 7.5 + 2 * Math.sin(T * 0.4), eye.z + 17);
      RR.rotation.set(-(Math.PI / 2 - pitch), 0, 0);
    }
    this.cutV = damp(this.cutV ?? 1, s.cutoff ? 0 : 1, 3, dt);
    this.rideFlame.visible = this.cutV > 0.02; this.rideFlame.material.uniforms.amt.value = this.cutV * (0.8 + 0.2 * Math.sin(t * 37)); this.rideFlame.material.uniforms.t.value = t;
    RR.localToWorld(this.rideGlow.position.set(0, -2, 0)); this.rideGlow.material.opacity = this.cutV * 0.9; this.rideGlow.scale.setScalar(26 + 4 * Math.sin(t * 23));
    RR.localToWorld(this.flameLight.position.set(0, -4, 0)); this.flameLight.intensity = 160 * this.cutV * (0.85 + 0.15 * Math.sin(t * 31));
    if (s.cutoff && !this.cutSound) { this.cutSound = true; G.audio.ctx && clank(G, null, 0.2); }
    // the label and the path round the Earth
    this.speedLabV = damp(this.speedLabV || 0, s.speedLab ? 1 : 0, 3, dt); this.speedLab.material.opacity = this.speedLabV;
    RR.localToWorld(this.speedLab.position.set(0, 18, -3)); this.speedLab.visible = this.speedLabV > 0.01;
    this.ringV = damp(this.ringV || 0, s.ring ? 1 : 0, 1.5, dt); this.orbitRing.visible = this.ringV > 0.01;
    if (this.orbitRing.visible) {
      const OP = this.orbitRing.userData, C = SP.earth.position, Rr = ER + alt;
      for (let i = 0; i < 360; i++) { const a = i / 360 * Math.PI * 2 + T * 0.1; OP.pos.set([C.x, C.y + Math.cos(a) * Rr, C.z - Math.sin(a) * Rr], i * 3); const v = this.ringV * (i % 4 < 2 ? 0.9 : 0.25) * clamp01(Math.min(i, 360 - i) / 30 + 0.3); OP.col.set([v, v * 0.85, v * 0.5], i * 3); OP.size[i] = 3; }
      OP.commit();
    }
    // Sputnik set free: the fairing pops off, it springs out, its antennas swing open
    if (s.sep) {
      if (this.sepT < 0) {
        this.sepT = 0; this.sp2.getWorldPosition(_a); this.sp2.getWorldQuaternion(_q); SP.group.add(this.sp2); this.sp2.position.copy(_a); this.sp2.quaternion.copy(_q);
        this.spFrom = _a.clone(); this.spQ0 = _q.clone();
        this.rideHalves.forEach((h) => { h.v.set(h.south ? 0 : 0, 0, h.south ? 1 : -1).multiplyScalar(2.2); h.spin = (h.south ? 1 : -1) * 1.2; });
        if (G.audio.ctx) { const o = G.audio.out(null, 0.4); G.audio.tone(o, { type: 'triangle', f: 180, f2: 90, peak: 0.4, a: 0.002, d: 0.25 }); G.audio.noise(o, { type: 'bandpass', f: 900, q: 1, peak: 0.4, a: 0.002, d: 0.12 }); shimmer(G, 3, 0.15); }
      }
      this.sepT += dt * F; const k = this.sepT;
      this.rideHalves.forEach((h) => { h.m.position.addScaledVector(h.v, dt * F); h.m.rotation.x += h.spin * dt * F; if (k > 5) h.m.visible = false; });
      // the rocket stage drops slowly back and away
      RR.position.addScaledVector(_a.set(0.15, -0.6, 2.2), dt * F); RR.rotation.z += 0.03 * dt * F;
      // Sputnik comes to float just in front of you
      const want = _b.set(eye.x + 0.35, eye.y - 0.05, eye.z - 2.4), f = ease(clamp01((k - 0.4) / 5.5));
      this.sp2.position.lerpVectors(this.spFrom, want, f);
      if (k <= 6) this.sp2.quaternion.slerpQuaternions(this.spQ0, _q.setFromEuler(new THREE.Euler(-1.2, 0.6, 0.3)), f);
      this.sp2.userData.open(ease(clamp01((k - 1.2) / 1.6)));
      if (k > 1.2 && k < 2.6 && (this.antT = (this.antT || 0) - dt) <= 0) { this.antT = 0.35; G.audio.tick?.(this.sp2.position); }
      if (k > 6) this.sp2.rotateOnAxis(_a.set(0.3, 1, 0.1).normalize(), dt * 0.25);
    }
    this.sp2Glow.material.opacity = 0.25 + 0.15 * Math.sin(t * 2);
    // the beep, all the way round
    if (s.signal && this.cur === 'space') { this.beepT -= dt; if (this.beepT <= 0) { this.beepT = 0.62; beep(G, s.radio ? null : this.sp2.getWorldPosition(_a).clone(), s.radio ? 0.12 : 0.08, !!s.radio); } }
    // "once round the Earth"
    this.clockV = damp(this.clockV || 0, s.clock ? 1 : 0, 2, dt); this.orbitLab.material.opacity = this.clockV; this.orbitLab.visible = this.clockV > 0.01;
    this.orbitLab.position.set(eye.x - 1.5, eye.y + 1.4, eye.z - 6);
    SP.update(dt);
    G.sky.starField.opacity = 1; G.sky.uni.milky.value = 1.3;
  }

  // The radio room's window
  updateRoom(dt, t) {
    const G = this.G, s = this.s, R = this.room;
    this.roomK = damp(this.roomK || 0, s.radio && this.cur === 'space' ? 1 : 0, 2 * this.F, dt);
    R.visible = this.roomK > 0.01;
    this.roomLight.intensity = 10 * this.roomK;
    if (!R.visible) return;
    if (!this.roomPlaced) { this.roomPlaced = true; G.camera.getWorldPosition(_a); R.position.set(_a.x - 2.4, _a.y - 1.3, _a.z - 5.2); R.lookAt(_a.x, R.position.y, _a.z); if (G.audio.ctx) { shimmer(G, 2.5, 0.15); whoosh(G, 2, 0.2); } }
    const k = ease(this.roomK); R.scale.setScalar(k);
    for (const P of this.radioMen) P.g.visible = k > 0.6;   // the people appear once the window is mostly open
    this.roomLight.position.copy(R.position).add(_a.set(0, 2, 0).applyQuaternion(R.quaternion)).add(_b.set(0, 0, -1).applyQuaternion(R.quaternion));
    this.frame.material.opacity = 0.75 + 0.25 * Math.sin(t * 3);
    const FS = this.frameSparks.userData;
    for (let i = 0; i < 90; i++) { const a = (i / 90 + t * 0.05) % 1, per = 2 * (3.6 + 2.6), d = a * per; let x, y; if (d < 3.6) { x = -1.8 + d; y = -0.1; } else if (d < 6.2) { x = 1.85; y = d - 3.6; } else if (d < 9.8) { x = 1.8 - (d - 6.2); y = 2.7; } else { x = -1.85; y = 2.6 - (d - 9.8); } FS.pos.set([x, y, 0.05], i * 3); const v = 0.6 + 0.4 * Math.sin(i * 3.1 + t * 6); FS.col.set([v * 0.6, v * 0.85, v], i * 3); FS.size[i] = 0.05; }
    FS.commit();
    // the engineers: listening; then the signal; then they jump up cheering
    this.radioMen.forEach((P, i) => {
      if (s.cheer) { P.pose = 'cheer'; P.g.rotation.y = damp(P.g.rotation.y, P.f0 - Math.PI + (i ? -0.4 : 0.2), 4, dt); P.look = G.camera.getWorldPosition(_a).clone(); }
      else if (s.signal) { P.pose = i ? 'point' : 'gasp'; P.pointAt.copy(this.scope.getWorldPosition(_a)); P.look = P.pointAt.clone(); }
      else { P.pose = i ? 'idle' : 'hold'; P.look = this.scope.getWorldPosition(_a).clone(); }
      animate(P, t, dt);
    });
    if (s.cheer && !this.roomCheer) { this.roomCheer = true; G.audio.cheer?.(R.position); }
    this.sigLab.material.opacity = damp(this.sigLab.material.opacity, s.signal ? 1 : 0, 3, dt);
    // the oscilloscope: a green trace that jumps with each beep
    const ph = ((this.t % 0.62) / 0.62), on = s.signal && ph < 0.45;
    if ((this.scopeT = (this.scopeT || 0) - dt) <= 0) {
      this.scopeT = 0.05; const tex = this.scope.material.map, g = tex.userData.ctx;
      g.fillStyle = '#031a08'; g.fillRect(0, 0, 128, 96); g.strokeStyle = '#6cff8a'; g.lineWidth = 2; g.beginPath();
      for (let x = 0; x < 128; x++) { const y = 48 + (on ? Math.sin(x * 0.9 + t * 40) * 30 : (Math.random() - 0.5) * 4); x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); tex.needsUpdate = true;
    }
  }

  // ---------- Rooftops: the moving light ----------
  updateTown(dt, t) {
    const G = this.G, s = this.s;
    const on = this.cur === 'roofs' || this.cur === 'hill';
    // the moving light across the sky (both on the rooftops and on the hill)
    if (s.pass && on) {
      if (this.passT < 0) this.passT = 0;
      this.passT += dt * this.F;
      const k = clamp01(this.passT / (this.cur === 'hill' ? 34 : 30));
      const az = this.cur === 'hill' ? lerp(305, 125, k) : lerp(300, 140, k), el = this.cur === 'hill' ? 6 + 66 * Math.sin(Math.PI * k) : 8 + 52 * Math.sin(Math.PI * k);
      G.camera.getWorldPosition(_a);
      this.passDir = this.passDir || new THREE.Vector3();
      this.passDir.set(Math.sin(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), -Math.cos(az * D2R) * Math.cos(el * D2R));
      this.passLight.position.copy(_a).addScaledVector(this.passDir, 800);
      // it tumbles, so it brightens and fades as it goes
      const tw = 0.7 + 0.3 * Math.sin(this.passT * 2.3) * Math.sin(this.passT * 0.9 + 1);
      const vis = clamp01(k * 12) * clamp01((1 - k) * 12);
      this.passLight.material.opacity = vis * tw; this.passLight.scale.setScalar(16 + 8 * tw);
      const k2 = clamp01(k + 0.035), az2 = lerp(this.cur === 'hill' ? 305 : 300, this.cur === 'hill' ? 125 : 140, k2), el2 = (this.cur === 'hill' ? 6 + 66 * Math.sin(Math.PI * k2) : 8 + 52 * Math.sin(Math.PI * k2)) - 1.5;
      _b.set(Math.sin(az2 * D2R) * Math.cos(el2 * D2R), Math.sin(el2 * D2R), -Math.cos(az2 * D2R) * Math.cos(el2 * D2R));
      this.passSp.position.copy(_a).addScaledVector(_b, 800); this.passSp.material.opacity = vis * 0.55;
      this.labV = damp(this.labV || 0, s.lightLab ? 1 : 0, 2, dt);
      this.passLab.position.copy(this.passLight.position).add(_c.set(0, -40, 0)); this.passLab.scale.set(this.passLab.scale.x / this.passLab.scale.y * 40, 40, 1); this.passLab.material.opacity = this.labV * vis;
      this.passLab2.position.copy(this.passSp.position).add(_c.set(0, 34, 0)); this.passLab2.scale.set(this.passLab2.scale.x / this.passLab2.scale.y * 32, 32, 1); this.passLab2.material.opacity = this.labV * vis;
      if (s.lightLab && !this.guideOnLight) { this.guideOnLight = true; s.guide = _c.copy(_a).addScaledVector(this.passDir, 9).toArray(); }
      if (this.passT > 40 && this.cur === 'hill') this.passT = 0;
    } else { this.passLight.material.opacity = 0; this.passSp.material.opacity = 0; this.passLab.material.opacity = 0; this.passLab2.material.opacity = 0; }
    this.passLight.visible = this.passLight.material.opacity > 0.01; this.passSp.visible = this.passLight.visible;
    if (this.cur !== 'roofs') { this.memSp.visible = false; this.memSparks.visible = false; return; }
    this.townLife.update(dt, t); this.washing.update(dt, t);
    // the radio on the crate: static and the beep
    this.radioDial.material.opacity = 0.7 + 0.3 * Math.sin(t * 3);
    if (s.signal && !s.memory) { this.beepT -= dt; if (this.beepT <= 0) { this.beepT = 0.62; beep(G, this.radioPos, 0.12, true); } }
    // the families: the light makes everyone look up and point
    const look = this.passLight.position.clone();
    this.family.forEach((P, i) => {
      if (s.memory) { P.pose = i === 2 ? 'point' : 'gasp'; P.look = this.memSp.position.clone(); P.pointAt.copy(P.look); }
      else if (s.lightLab || this.passT > 4) { P.pose = i === 0 || i === 3 ? 'point' : i === 2 ? 'cheer' : 'idle'; P.look = look; P.pointAt.copy(look); }
      else { P.pose = i === 1 ? 'hold' : 'idle'; P.look = this.radioPos; }
      animate(P, t, dt);
    });
    this.neigh.forEach((P, i) => { P.pose = this.passT > 3 + i ? (i % 2 ? 'point' : 'wave') : 'idle'; P.look = look; P.pointAt.copy(look); animate(P, t, dt); });
    // ch14_10: Sputnik drifts by in front of you, beeping, like at the very end of Era 1
    if (s.memory) {
      if (this.memT < 0) { this.memT = 0; this.memSp.visible = true; this.memSparks.visible = true; G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize(); this.memC = _a.clone(); this.memF = _b.clone(); shimmer(G, 3, 0.15); s.guide = null; }
      this.memT += dt * this.F; const k = clamp01(this.memT / 12), c = this.memC, f = this.memF, r = _c.set(-f.z, 0, f.x);
      this.memSp.position.copy(c).addScaledVector(f, 3.2).addScaledVector(r, -3.4 + 6.8 * k).add(_d.set(0, 0.2 + 0.5 * Math.sin(k * Math.PI), 0));
      this.memSp.rotation.set(this.memT * 0.4, this.memT * 0.7, 0.3);
      const vis = clamp01(this.memT * 1.5) * clamp01((12 - this.memT) * 1.5);
      this.memGlow.material.opacity = 0.35 * vis;
      for (const m of this.memSp.userData.mats) { m.transparent = true; m.opacity = vis; }
      if ((this.memBeep = (this.memBeep || 0) - dt) <= 0 && this.memT < 11) { this.memBeep = 0.62; beep(G, this.memSp.position.clone(), 0.14); }
      const MS = this.memSparks.userData;
      for (let i = 0; i < 60; i++) { const a = i * 2.4 + this.memT * 1.5, rr = 0.5 + (i % 7) * 0.12, tr = (i / 60) * 1.4; MS.pos.set([this.memSp.position.x - r.x * tr + Math.cos(a) * rr * 0.4, this.memSp.position.y + Math.sin(a) * rr * 0.4, this.memSp.position.z - r.z * tr + Math.sin(a * 1.3) * rr * 0.3], i * 3); const v = vis * (1 - i / 60) * 0.7; MS.col.set([v * 0.7, v * 0.85, v], i * 3); MS.size[i] = 0.05; }
      MS.commit();
      G.guide.flyTo(_d.copy(this.memSp.position).add(_a.set(0, 0.6, 0)), this.memSp.position);
    } else this.memSp.visible = this.memSparks.visible = false;
  }

  // ---------- The hill: everyone looks up ----------
  updateHill(dt, t) {
    const G = this.G, s = this.s;
    if (this.cur !== 'hill') { return; }
    const mel = (-4 + 17 * ease(this.moonV || 0)) * D2R;
    const look = s.moon ? G.camera.getWorldPosition(new THREE.Vector3()).add(_a.set(Math.sin(100 * D2R) * Math.cos(mel), Math.sin(mel), -Math.cos(100 * D2R) * Math.cos(mel)).multiplyScalar(900)) : this.passLight.position.clone();
    this.ringEchoes.forEach((E, i) => {
      if (s.echoes && !E.on) { E.delay ??= 0.25 + i * 0.22; E.delay -= dt * this.F; if (E.delay <= 0) { E.show(true); if (i % 3 === 0) G.audio.chime(E.P.g.position, 0.2); } }
      E.P.look = look; E.P.pointAt.copy(look);
      E.P.pose = s.moon ? (i % 4 === 0 ? 'point' : 'idle') : (i % 3 === 0 ? 'point' : i % 5 === 1 ? 'gasp' : 'idle');
      E.update(dt, t);
      for (const m of E.mats) if ('emissiveIntensity' in m) m.emissiveIntensity = 0.9 + 0.25 * Math.sin(t * 2.2 + i);
      E.lab.material.opacity = E.k * 0.85; E.lab.visible = E.k > 0.02;
    });
    // the ring of light runs round from one echo to the next as they appear
    const RG = this.ringGlow.userData, n = this.ringEchoes.length;
    for (let j = 0; j < 144; j++) {
      const a = (j / 144) * Math.PI * 2 + 0.25, x = Math.sin(a) * 4.6, z = -Math.cos(a) * 4.6, E = this.ringEchoes[Math.floor((j / 144) * n) % n];
      const v = E.k * (0.32 + 0.12 * Math.sin(t * 3 - j * 0.35));
      RG.pos.set([x, hillH(x, z) + 0.06, z], j * 3); RG.col.set([v * E.tint.r, v * E.tint.g, v * E.tint.b], j * 3); RG.size[j] = 0.42;
    }
    this.ringEchoes.forEach((E, i) => { const p = E.P.g.position, v = E.k * 0.55; RG.pos.set([p.x, p.y + 0.1, p.z], (144 + i) * 3); RG.col.set([v * E.tint.r, v * E.tint.g, v * E.tint.b], (144 + i) * 3); RG.size[144 + i] = 2.2; });
    RG.commit();
    if (s.echoes && !this.ringSound) { this.ringSound = true; if (G.audio.ctx) { awe(G, 16, 0.08, 98); shimmer(G, 4, 0.15); } }
    // the title over the rising Moon
    this.titleV = damp(this.titleV || 0, s.title ? 1 : 0, 1.2, dt);
    const camY = G.camera.getWorldPosition(_b).y;
    this.eraTitle.position.copy(at(100, 26, camY + 15)); this.eraTitle.material.opacity = this.titleV;
    this.eraSub.position.copy(at(100, 26, camY + 18.2)); this.eraSub.material.opacity = this.titleV * 0.8;
    this.eraTitle.visible = this.titleV > 0.01; this.eraSub.visible = this.eraTitle.visible;
    if (s.title && !this.titleSound) { this.titleSound = true; if (G.audio.ctx) { shimmer(G, 5, 0.18); awe(G, 14, 0.1, 82); } }
  }

  dispose() {
    this.G.music?.stopSting?.(2);
    this.space.dispose();
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.coreTex.dispose();
    for (const E of this.ringEchoes) E.dispose?.();
    this.G.world.blockers = [];
  }
}

// ---------- Props ----------
function hillH(x, z) { const r = Math.hypot(x, z); return 9 * Math.exp(-((r / 45) ** 2)) + (N1(x / 60, z / 60) - 0.5) * 8 * clamp01((r - 60) / 200) + (N2(x / 7, z / 7) - 0.5) * 0.2 * clamp01((r - 8) / 10); }
function jeep(k, p, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw), P = (x, y, z) => [p[0] + x * c + z * s, p[1] + y, p[2] - x * s + z * c];
  k.box(1.7, 0.7, 3.6, 0x4a5a3a, P(0, 0.8, 0), [0, yaw, 0]); k.box(1.6, 0.7, 1.6, 0x3e4e32, P(0, 1.5, -0.3), [0, yaw, 0]);
  for (const [x, z] of [[-0.85, 1.2], [0.85, 1.2], [-0.85, -1.2], [0.85, -1.2]]) k.cyl(0.38, 0.38, 0.3, 10, 0x1a1a1a, P(x, 0.38, z), [0, yaw, Math.PI / 2]);
}
// A 1950s Soviet truck: a long bonnet, a square cab, and a body (a frosty oxygen tank, or a cable drum)
function makeTruck(kind) {
  const k = new Kit(), g = new THREE.Group(), wheels = [];
  if (kind === 'tanker' && PROPS.has('soviet_truck')) {   // Meem's green tanker (its cab at +z, like these)
    const TP = PROPS.fresh(); TP.add('soviet_truck', 0, 0, 0, 0); g.add(TP.build({ glow: 0x231c16 }));
    return { g, wheels, lamps: [[-0.82, 1.2, 3.45], [0.82, 1.2, 3.45]] };
  }
  const body = kind === 'tanker' ? 0x4a5a4a : kind === 'jeep' ? 0x4a5a3a : 0x3a4a5a;
  if (kind === 'jeep') {
    k.box(1.7, 0.7, 3.6, body, [0, 0.8, 0]); k.box(1.6, 0.7, 1.6, 0x3e4e32, [0, 1.5, -0.3]); k.box(1.5, 0.4, 0.05, 0x1a2a3a, [0, 1.55, 0.51]);
  } else {
    k.box(2.2, 0.35, 6.4, 0x2a2a2a, [0, 0.9, -0.6]);
    k.box(1.6, 0.9, 1.6, body, [0, 1.5, 2.4]); k.box(2.2, 1.5, 1.6, body, [0, 2.0, 1.0]); k.box(1.9, 0.6, 0.05, 0x1a2a3a, [0, 2.3, 1.81]);
    k.box(2.4, 0.15, 0.6, 0x2a2a2a, [0, 1.2, 3.1]);
    if (kind === 'tanker') { k.cyl(1.05, 1.05, 4.2, 14, 0xe4e8ec, [0, 2.1, -1.6], [Math.PI / 2, 0, 0]); for (const z of [-3.4, 0.2]) k.cyl(1.1, 1.1, 0.12, 14, 0x9aa0a6, [0, 2.1, z], [Math.PI / 2, 0, 0]); k.box(0.6, 0.3, 0.6, 0x9aa0a6, [0, 3.2, -1.6]); }
    else { k.box(2.3, 0.6, 4.4, 0x5a4a32, [0, 1.4, -1.6]); k.cyl(0.9, 0.9, 1.4, 12, 0x6a4a2a, [0, 2.4, -1.6], [0, 0, Math.PI / 2]); k.cyl(0.55, 0.55, 1.45, 12, 0x2a2a2a, [0, 2.4, -1.6], [0, 0, Math.PI / 2]); }
  }
  const m = k.mesh(); g.add(m);
  const wk = new Kit(); wk.cyl(0.5, 0.5, 0.36, 12, 0x1a1a1a, [0, 0, 0], [0, 0, Math.PI / 2]); wk.box(0.38, 0.2, 0.2, 0x4a4a4a, [0, 0, 0]);
  const wg = wk.geometry();
  const spots = kind === 'jeep' ? [[-0.85, 1.2], [0.85, 1.2], [-0.85, -1.2], [0.85, -1.2]] : [[-1.0, 2.3], [1.0, 2.3], [-1.0, -1.2], [1.0, -1.2], [-1.0, -2.6], [1.0, -2.6]];
  for (const [x, z] of spots) { const w = new THREE.Mesh(wg, FLAT); w.position.set(x, kind === 'jeep' ? 0.38 : 0.5, z); g.add(w); wheels.push(w); }
  const lamps = kind === 'jeep' ? [[-0.6, 1.0, 1.82], [0.6, 1.0, 1.82]] : [[-0.75, 1.55, 3.22], [0.75, 1.55, 3.22]];
  return { g, wheels, lamps };
}
// ---------- People of 1957 ----------
// Meem has no models for everyday people of the 1950s yet, so these are built here: each one dressed
// differently (a quilted work jacket, a greatcoat, a suit, a dress) with a different hat and face, so
// no two in a scene look alike. They pose like the game's other stand-ins (people.js): a body, two
// arms that swing from the shoulders, and here also a head that turns to look (P.look).
// look: { kind: 'jacket'|'greatcoat'|'suit'|'labcoat'|'dress'|'kid', hat: 'ushanka'|'cap'|'fedora'|
//   'peaked'|'beret'|'kerchief'|'none', coat, trousers, hair, skin, height, glasses, moustache, scarf,
//   girl, headphones, seed }
const SKINS = [0xd8b49a, 0xc89e82, 0xe0c0a8, 0xb88a6c, 0xd0a88c];
function makeFolk(look = {}) {
  const R = rng(look.seed || 7), kind = look.kind || 'jacket', kid = kind === 'kid', girl = !!look.girl || kind === 'dress';
  const H = (look.height || 1.74) / 1.74, coat = look.coat ?? 0x3a3c40, trou = look.trousers ?? 0x2a2a2c;
  const skin = look.skin ?? SKINS[Math.floor(R() * SKINS.length)], hair = look.hair ?? [0x2a1e14, 0x4a3420, 0x6a5038, 0x1a1614, 0x8a8478][Math.floor(R() * 5)];
  const shoe = 0x1e1a18, k = new Kit(), hk = new Kit(), long = kind === 'greatcoat' || kind === 'labcoat';
  // shoes and legs (trousers; stockings and a skirt for women and girls)
  for (const s of [-1, 1]) {
    k.ball(0.1, 1, shoe, [s * 0.1, 0.05, 0.04], 0, [0.6, 0.5, 1.3]);
    k.cyl(0.07, 0.062, 0.82, 8, girl ? 0x9a8070 : trou, [s * 0.1, 0.49, 0]);
  }
  // the body
  if (girl) {
    k.cyl(0.19, 0.29, 0.52, 14, coat, [0, 0.66, 0]);                       // skirt (dress or coat)
    k.cyl(0.18, 0.2, 0.5, 12, coat, [0, 1.15, 0]);
    k.cyl(0.205, 0.205, 0.05, 12, look.belt ?? 0x3a2a1e, [0, 0.95, 0]);
    k.box(0.16, 0.2, 0.02, look.collar ?? 0xe8e0d0, [0, 1.36, 0.17], [-0.25, 0, 0]);   // a white collar
  } else if (long) {
    k.cyl(0.21, 0.3, 0.98, 14, coat, [0, 0.9, 0]);                          // a long coat to below the knee
    k.cyl(0.2, 0.21, 0.24, 12, coat, [0, 1.31, 0]);
    if (kind === 'greatcoat') { k.cyl(0.225, 0.225, 0.06, 12, look.belt ?? 0x2a1e16, [0, 1.0, 0]); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) k.ball(0.014, 0, 0xb8a060, [s * 0.07, 1.06 + i * 0.12, 0.215]); }
    else { k.box(0.02, 0.85, 0.02, 0xc8c8c0, [0, 0.95, 0.25]); k.box(0.14, 0.18, 0.02, 0x3a4a6a, [0.1, 1.12, 0.22], [0, 0.1, 0]); }   // lab coat: its front edge, a pen pocket
  } else {
    k.cyl(0.2, 0.215, 0.58, 12, coat, [0, 1.15, 0]);                        // jacket or suit
    if (kind === 'jacket') for (let i = 0; i < 6; i++) k.add(new THREE.TorusGeometry(0.212 - i * 0.003, 0.008, 3, segs(14)), _col.setHex(coat).multiplyScalar(0.7).getHex(), [0, 0.92 + i * 0.09, 0], [Math.PI / 2, 0, 0]);   // the quilting of a telogreika
    if (kind === 'suit') { k.box(0.13, 0.2, 0.02, 0xe8e4dc, [0, 1.35, 0.19], [-0.2, 0, 0]); k.box(0.04, 0.3, 0.02, look.tie ?? 0x6a2a2a, [0, 1.25, 0.205]); }
    if (kind === 'kid') k.cyl(0.21, 0.2, 0.08, 12, look.belt ?? 0x2a2a2a, [0, 0.9, 0]);
    for (let i = 0; i < 4; i++) k.ball(0.013, 0, 0x2a2420, [0, 0.95 + i * 0.12, 0.215]);
  }
  k.add(new THREE.SphereGeometry(0.21, segs(12), 6), coat, [0, 1.36, 0], 0, [1.08, 0.42, 0.78]);   // shoulders
  k.cyl(0.1, 0.14, 0.09, 10, look.scarf ?? coat, [0, 1.45, 0]);                                   // collar or scarf
  if (look.scarf) k.box(0.1, 0.3, 0.03, look.scarf, [0.08, 1.3, 0.2], [0, 0, 0.1]);
  k.cyl(0.05, 0.055, 0.08, 8, skin, [0, 1.5, 0]);
  // the head (its own piece, so it can turn): face, nose, ears, eyes, brows, hair, hat
  const hy = 1.6, hz = 0.0;
  hk.ball(0.112, 2, skin, [0, hy, hz], 0, [0.92, 1.1, 1.0]);
  hk.box(0.03, 0.05, 0.04, _col.setHex(skin).multiplyScalar(0.95).getHex(), [0, hy - 0.015, 0.11], [0.2, 0, 0]);
  for (const s of [-1, 1]) {
    hk.ball(0.026, 0, skin, [s * 0.105, hy, 0], 0, [0.6, 1, 0.9]);
    hk.box(0.024, 0.018, 0.01, 0x1a1412, [s * 0.04, hy + 0.025, 0.105]);
    hk.box(0.04, 0.01, 0.012, hair, [s * 0.042, hy + 0.05, 0.104], [0, 0, s * -0.12]);
  }
  hk.box(0.04, 0.01, 0.01, 0x8a4a40, [0, hy - 0.06, 0.1]);
  if (look.moustache) hk.box(0.07, 0.016, 0.016, hair, [0, hy - 0.042, 0.108]);
  if (look.glasses) { for (const s of [-1, 1]) hk.add(new THREE.TorusGeometry(0.024, 0.005, 3, 10), 0x1a1a1a, [s * 0.042, hy + 0.025, 0.112]); hk.box(0.025, 0.006, 0.006, 0x1a1a1a, [0, hy + 0.03, 0.115]); }
  const hat = look.hat || 'none';
  if (hat !== 'kerchief') hk.ball(0.118, 1, hair, [0, hy + 0.04, -0.018], 0, [0.98, girl ? 0.92 : 0.8, 1.02]);
  if (girl && hat !== 'kerchief') { hk.ball(0.06, 1, hair, [0, hy + 0.02, -0.11]); if (kid) for (const s of [-1, 1]) hk.cyl(0.025, 0.018, 0.2, 6, hair, [s * 0.1, hy - 0.12, -0.04]); }
  const hc = look.hatCol ?? 0x3a3430;
  if (hat === 'ushanka') { hk.ball(0.13, 1, hc, [0, hy + 0.08, -0.01], 0, [1.02, 0.62, 1.02]); hk.cyl(0.132, 0.135, 0.08, 12, _col.setHex(hc).multiplyScalar(0.8).getHex(), [0, hy + 0.06, -0.01]); for (const s of [-1, 1]) hk.box(0.035, 0.1, 0.11, _col.setHex(hc).multiplyScalar(0.8).getHex(), [s * 0.125, hy + 0.1, -0.01], [0, 0, s * 0.5]); }
  if (hat === 'cap') { hk.cyl(0.125, 0.12, 0.06, 12, hc, [0, hy + 0.11, -0.005]); hk.ball(0.12, 1, hc, [0, hy + 0.13, 0.02], 0, [1.05, 0.35, 1.1]); hk.box(0.18, 0.014, 0.08, _col.setHex(hc).multiplyScalar(0.8).getHex(), [0, hy + 0.09, 0.13], [0.15, 0, 0]); }
  if (hat === 'fedora') { hk.cyl(0.1, 0.115, 0.12, 12, hc, [0, hy + 0.15, -0.01]); hk.cyl(0.118, 0.118, 0.03, 12, 0x1a1a1a, [0, hy + 0.11, -0.01]); hk.cyl(0.18, 0.18, 0.012, 16, hc, [0, hy + 0.095, -0.01]); }
  if (hat === 'peaked') { hk.cyl(0.15, 0.12, 0.05, 14, hc, [0, hy + 0.15, -0.01]); hk.cyl(0.12, 0.12, 0.05, 12, 0x8a2a2a, [0, hy + 0.11, -0.01]); hk.box(0.17, 0.012, 0.07, 0x1a1a1a, [0, hy + 0.085, 0.12], [0.25, 0, 0]); hk.ball(0.015, 0, 0xd8b040, [0, hy + 0.12, 0.122]); }
  if (hat === 'beret') hk.ball(0.13, 1, hc, [0.02, hy + 0.11, -0.01], [0, 0, 0.15], [1.05, 0.38, 1.05]);
  if (hat === 'kerchief') { hk.ball(0.125, 1, hc, [0, hy + 0.035, -0.035], 0, [1.02, 1.05, 0.98]); hk.box(0.06, 0.05, 0.04, hc, [0, hy - 0.13, 0.04]); }
  if (look.headphones) { hk.add(new THREE.TorusGeometry(0.125, 0.012, 4, 14, Math.PI), 0x2a2a2a, [0, hy, 0], [0, 0, 0]); for (const s of [-1, 1]) hk.cyl(0.045, 0.045, 0.04, 10, 0x1a1a1a, [s * 0.12, hy, 0], [0, 0, Math.PI / 2]); }
  // kids: a bigger head for their size
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner); g.userData.kind = 'characters';
  inner.add(k.mesh(FLAT));
  const head = new THREE.Group(); head.position.set(0, 1.5, 0); inner.add(head);
  const hm = hk.mesh(SOFT); hm.position.set(0, -1.5, 0); head.add(hm); if (kid) head.scale.setScalar(1.16);
  const arms = [];
  for (const sx of [-1, 1]) {
    const ak = new Kit(), sleeve = kind === 'labcoat' ? 0xe8e8e2 : coat;
    ak.cyl(0.062, 0.054, 0.56, 8, sleeve, [0, -0.28, 0]); ak.cyl(0.058, 0.058, 0.05, 8, _col.setHex(sleeve).multiplyScalar(0.75).getHex(), [0, -0.55, 0]);
    ak.ball(0.046, 1, look.gloves ?? skin, [0, -0.62, 0.01], 0, [0.8, 1.1, 0.7]);
    const arm = new THREE.Group(); arm.add(ak.mesh(FLAT)); arm.position.set(sx * 0.235, 1.38, 0); inner.add(arm); arms.push(arm);
  }
  inner.scale.setScalar(H);
  return { g, inner, arms, head, pose: 'idle', phase: R() * 6, pointAt: new THREE.Vector3(), placeholder: true, H, folk: true };
}
const SOFT = new THREE.MeshLambertMaterial({ vertexColors: true });
// Move a person and, for the people above, turn the head toward P.look (within what a neck can do)
const _hl = new THREE.Vector3();
function animate(P, t, dt) {
  animatePerson(P, t, dt);
  if (!P.head) return;
  let yaw = Math.sin(t * 0.3 + P.phase) * 0.15, pitch = 0;
  if (P.look) { _hl.copy(P.look); P.g.worldToLocal(_hl); _hl.y -= 1.6 * P.H; yaw = clamp(Math.atan2(_hl.x, _hl.z), -1.1, 1.1); pitch = clamp(-Math.atan2(_hl.y, Math.hypot(_hl.x, _hl.z)), -0.6, 0.45); }
  P.head.rotation.y = damp(P.head.rotation.y, yaw, 4, dt); P.head.rotation.x = damp(P.head.rotation.x, pitch + (P.nod || 0), 4, dt);
}
// Tsiolkovsky's book, open, glowing softly with a turning page and a few sparks rising off it
function makeBook() {
  const g = new THREE.Group(), mats = [];
  const tex = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#f2e8cc'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(60,40,20,0.75)';
    for (const x0 of [14, 142]) for (let y = 14; y < h - 10; y += 7) c.fillRect(x0, y, 90 + ((y * 7) % 13), 2);
    c.strokeStyle = 'rgba(60,40,20,0.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(150, 100); c.quadraticCurveTo(190, 40, 236, 20); c.stroke();   // a rocket's path drawn in the margin
    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(124, 0, 8, h);
  });
  const pm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, fog: false }); mats.push(pm);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), pm); p.position.set(s * 0.1, 0, 0); p.rotation.y = -s * 0.18; g.add(p); }
  const cm = new THREE.MeshBasicMaterial({ color: 0x6a2a20, transparent: true, side: THREE.DoubleSide, fog: false }); mats.push(cm);
  const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.3), cm); cover.position.z = -0.012; g.add(cover);
  const page = new THREE.Group(), pg = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), pm); pg.position.x = 0.1; page.add(pg); page.position.z = 0.004; g.add(page);
  page.rotation.order = 'YZX';
  const glow = glowSprite(0xffe0a8, 0.9, 0); glow.position.z = -0.05; g.add(glow);
  const sparks = glowPoints(30, { sizeScale: 200 }); sparks.rotation.x = 0.5; g.add(sparks);
  g.userData = { glow, page, mats, sparks };
  return g;
}
// A clipboard with a checklist
function makeClipboard() { const k = new Kit(); k.box(0.23, 0.32, 0.012, 0x7a5a3a, [0, 0.12, 0]); k.box(0.2, 0.26, 0.004, 0xe8e4d8, [0, 0.11, 0.008]); k.box(0.08, 0.03, 0.02, 0x9a9a9a, [0, 0.27, 0.01]); return k.mesh(); }
function makeBinoculars() { const k = new Kit(); for (const x of [-0.035, 0.035]) k.cyl(0.022, 0.026, 0.13, 8, 0x1a1a1a, [x, 0.04, 0], [Math.PI / 2, 0, 0]); k.box(0.05, 0.02, 0.04, 0x2a2a2a, [0, 0.04, 0]); return k.mesh(); }
function makeLamp() {
  const g = new THREE.Group(), k = new Kit(); k.cyl(0.04, 0.035, 0.18, 8, 0x3a3a3a, [0, 0.08, 0]); k.cyl(0.06, 0.04, 0.05, 8, 0x5a5a5a, [0, 0.19, 0]); g.add(k.mesh());
  const s = glowSprite(0xfff0d0, 0.5, 0.8); s.position.y = 0.24; g.add(s);
  g.userData.flicker = () => {}; return g;
}

// ---------- The journal page ----------
function drawJournal(g, w, h) {
  g.fillStyle = INK; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
  g.fillText('Sputnik, 4 October 1957', 40, 70);
  // the R-7 with its four boosters, and the cross they make falling away
  const rx = 140, ry = 600;
  g.strokeStyle = INK; g.lineWidth = 3; g.fillStyle = 'rgba(58,42,24,0.1)';
  g.beginPath(); g.moveTo(rx - 14, ry); g.lineTo(rx - 22, ry - 260); g.lineTo(rx - 16, ry - 330); g.lineTo(rx, ry - 370); g.lineTo(rx + 16, ry - 330); g.lineTo(rx + 22, ry - 260); g.lineTo(rx + 14, ry); g.closePath(); g.fill(); g.stroke();
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(rx + s * 14, ry); g.lineTo(rx + s * 50, ry); g.lineTo(rx + s * 46, ry - 60); g.lineTo(rx + s * 22, ry - 200); g.stroke(); }
  g.font = 'italic 24px Georgia, serif'; g.fillText('the R-7', rx - 40, ry + 34);
  g.save(); g.translate(330, 260); g.strokeStyle = '#c0601a'; g.lineWidth = 4;
  for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(10, 0); g.quadraticCurveTo(50, 8, 90, 30); g.stroke(); }
  g.restore(); g.fillStyle = INK; g.fillText('the Korolev cross', 260, 380);
  // Sputnik itself
  const sx = 640, sy = 230;
  g.fillStyle = '#d8d4cc'; g.beginPath(); g.arc(sx, sy, 50, 0, 6.28); g.fill(); g.strokeStyle = INK; g.lineWidth = 3; g.stroke();
  g.beginPath(); g.arc(sx - 15, sy - 15, 15, 0, 6.28); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill();
  g.strokeStyle = INK; g.lineWidth = 2; for (const [a, l] of [[2.6, 230], [2.85, 270], [3.45, 230], [3.7, 270]]) { g.beginPath(); g.moveTo(sx + Math.cos(a) * 45, sy + Math.sin(a) * 45); g.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); g.stroke(); }
  g.fillStyle = INK; g.font = 'italic 26px Georgia, serif';
  g.fillText('58 cm across, 83.6 kg', 720, 200); g.fillText('four antennas', 720, 236); g.fillText('"travelling companion"', 720, 272);
  // its orbit round the Earth
  const ox = 760, oy = 470;
  g.fillStyle = '#4a80c0'; g.beginPath(); g.arc(ox, oy, 60, 0, 6.28); g.fill();
  g.strokeStyle = INK; g.setLineDash([8, 7]); g.beginPath(); g.ellipse(ox, oy, 150, 100, -0.3, 0, 6.28); g.stroke(); g.setLineDash([]);
  g.fillStyle = INK; g.beginPath(); g.arc(ox + 140, oy - 60, 6, 0, 6.28); g.fill();
  g.fillText('once round in 96 minutes', 600, 630); g.fillText('beep... beep... beep...', 330, 470);
  g.fillText('Falling round the Earth, and missing: in orbit.', 40, h - 30);
}
