// Chapter 6: Diving for the Antikythera machine. Off the island of Antikythera, 1900.
//
// You start on the deck of a Greek sponge-diving boat sheltering after a storm. The diver in his
// brass helmet climbs down the ladder, and you follow him to the seafloor 45 m down: bronze and
// marble statues lying in the sand, scattered wine jars, the bones of a ship 2,000 years old.
// Astra shows you a lump of green, crusty bronze. You pick it up, look closer (gear teeth!),
// X-rays look inside it, and its gears fly out and build the whole machine in front of you.
// Turn its handle: the Sun and Moon travel round the zodiac, the Moon ball shows the phases,
// and on the back the eclipse dial finds the next eclipse.
//
// Comfort underwater (no nausea): the floor is steady and you walk the normal way; nothing
// moves the camera; the drifting specks barely move and stay put in the world; the "dive"
// is a fade, not a fall. World axes: -Z north, +X east, +Y up.
import * as THREE from 'three';
import { Kit } from '../kit.js';
import { makePerson, animatePerson } from '../people.js';
import { dress } from '../dress.js';
import { makeFlock, makeDolphins, Life } from '../life.js';
import { canvasTex, clamp, lerp, damp, angleWrap } from '../util.js';

const D2R = Math.PI / 180, TAU = Math.PI * 2;
const DECK = 0.95;                       // deck height above the sea on the boat
const START_TOP = new THREE.Vector3(-0.45, 0, 0.7);
const START_SEA = new THREE.Vector3(0, 0, 0);
const STATUE = new THREE.Vector3(-3.4, 0, -8.2);   // the bronze youth (Astra shows the statues here)
const WRECK = new THREE.Vector3(1.2, 0, -15);       // middle of the wreck site
const WRECK_YAW = 28 * D2R;
const ROCK = new THREE.Vector3(3.5, 0, -5.5);       // the flat rock the lump lies on
const STAND = new THREE.Vector3(3.5, 0, -4.72);     // where you stand to hold it and crank the machine
const DIVER = new THREE.Vector3(0.5, 0, -7.6);
const MONTHS_PER_TURN = 1;               // one turn of the handle = one month (the Moon ball goes round once)
const SAROS = 223, METONIC = 235;        // months on the back dials (eclipse cycle, 19-year calendar)
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const sstep = (a, b, x) => ease((x - a) / (b - a));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler();
const faceToward = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z)); // yaw for placePlayers
const turnToward = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);       // rotation.y for a figure

// Months on the eclipse (Saros) dial that carry an eclipse sign: about every six months
const ECLIPSES = []; for (let m = 6, k = 0; m < SAROS; m += k++ % 3 === 2 ? 5 : 6) ECLIPSES.push(m);

// A tiny repeatable random number generator, so every headset builds the same seafloor
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function noise2(seed) {
  const r = rng(seed), P = new Float32Array(256); for (let i = 0; i < 256; i++) P[i] = r();
  const h = (x, z) => P[((x * 73856093) ^ (z * 19349663)) & 255];
  return (x, z) => {
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v);
  };
}
const NS1 = noise2(41), NS2 = noise2(77), NS3 = noise2(5);

// The seafloor: sand with ripples, nearly flat where the wreck lies, a rocky slope rising to the
// west (the island's underwater cliff), and the bottom dropping away into deep blue to the north-east
export function seabedHeight(x, z) {
  const r = Math.hypot(x - 0.5, z + 8);
  let h = (NS1(x / 14 + 3, z / 14) - 0.5) * 1.3 * clamp((r - 9) / 12, 0.12, 1);
  h += Math.sin(x * 1.7 + z * 0.55 + NS2(x / 4, z / 4) * 3) * 0.03;
  h += sstep(-13, -42, x) * 13 * (0.7 + 0.6 * NS2(x / 20, z / 20));
  h -= sstep(18, 60, -z * 0.7 + x * 0.7) * 9;
  return h;
}

// ---------- Shaders added to plain three.js materials ----------
// Dancing light on the seafloor (caustics), on any lit material. The pattern sits in the world.
function addCaustics(mat, uTime, strength = 0.5) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'varying vec3 vCW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 cw = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        cw = instanceMatrix * cw;
      #endif
      vCW = (modelMatrix * cw).xyz;`);
    sh.fragmentShader = 'uniform float uTime;\nvarying vec3 vCW;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      {
        vec2 p = vCW.xz * 0.9; float t = uTime;
        float a = p.x * 1.6 + sin(p.y * 1.1 + t * 0.7) * 1.4 + sin(p.y * 0.43 - t * 0.4);
        float b = p.y * 1.6 + sin(p.x * 1.3 - t * 0.6) * 1.4 + sin(p.x * 0.51 + t * 0.3);
        float c = pow(1.0 - abs(sin(a)), 9.0) + pow(1.0 - abs(sin(b)), 9.0);
        vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
        float facing = clamp(dot(normal, upV), 0.0, 1.0);
        outgoingLight += diffuseColor.rgb * vec3(0.55, 0.85, 0.9) * c * facing * ${strength.toFixed(2)};
      }
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'caustics' + strength;
  return mat;
}

// Seagrass that sways gently in the swell (top of each blade moves, roots stay put)
function addSway(mat, uTime) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      vec2 ip = vec2(0.0);
      #ifdef USE_INSTANCING
        ip = instanceMatrix[3].xz;
      #endif
      float k = position.y * position.y;
      transformed.x += sin(uTime * 0.9 + ip.x * 0.7 + ip.y * 0.3) * 0.18 * k;
      transformed.z += sin(uTime * 0.7 + ip.y * 0.6) * 0.1 * k;`);
  };
  mat.customProgramCacheKey = () => 'sway';
  return mat;
}

// The sea surface seen from the boat: low-poly swell, rolling slowly (the boat itself stays still)
function addWaves(mat, uTime) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3(position);
      vec2 w = (modelMatrix * vec4(position, 1.0)).xz;
      transformed.y += sin(w.x * 0.21 + uTime * 1.05) * 0.16 + sin(w.y * 0.17 - uTime * 0.85 + w.x * 0.05) * 0.14
        + sin((w.x + w.y) * 0.43 + uTime * 1.6) * 0.05;`);
  };
  mat.customProgramCacheKey = () => 'waves';
  return mat;
}

// Soft specks drifting in the water (or rising bubbles). They are drawn around you, but each
// speck stays put in the world, so moving your head shows depth instead of a rushing stream.
function makeSpecks({ n, size, color, box, rise = 0, uTime, opacity = 0.5 }) {
  const r = rng(n + 7), pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set([r() * box[0], r() * box[1], r() * box[2]], i * 3); seed[i] = r() * 100; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime, origin: { value: new THREE.Vector3() }, box: { value: new THREE.Vector3(...box) }, color: { value: new THREE.Color(color) }, opacity: { value: opacity }, size: { value: size }, rise: { value: rise }, wrap: { value: rise ? 0 : 1 } },
    vertexShader: `attribute float seed; uniform float uTime, size, rise, wrap; uniform vec3 origin, box; varying float vA;
      void main() {
        vec3 p = position;
        if (rise > 0.0) {
          // a bubble column: each bubble rises from the origin, wobbling, then starts again
          float k = fract(uTime * rise / box.y + seed);
          p = origin + vec3((position.x / box.x - 0.5) * 0.25 * (0.3 + k) + sin(uTime * 3.0 + seed) * 0.03, k * box.y, (position.z / box.z - 0.5) * 0.25 * (0.3 + k));
          vA = smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(0.8, 1.0, k));
        } else {
          p += vec3(sin(uTime * 0.11 + seed) * 0.4, sin(uTime * 0.07 + seed * 1.3) * 0.3 - uTime * 0.012, cos(uTime * 0.09 + seed) * 0.4);
          p = origin + mod(p - origin + box * 0.5, box) - box * 0.5;
          float d = length(p - origin);
          vA = 1.0 - smoothstep(box.x * 0.3, box.x * 0.5, d);
        }
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(size * 300.0 / -mv.z, 1.0, 14.0);
      }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying float vA;
      void main() { vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(c)); gl_FragColor = vec4(color, a * vA * opacity); }`,
    transparent: true, depthWrite: false,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false;
  return p;
}

// ---------- Shapes ----------
// A lumpy, crusty shape (rocks, the corroded bronze lump, sponges): a box or ball dented with noise
function lumpy(geo, seed, amt, scale = 1) {
  const p = geo.attributes.position, n = noise2(seed), n2 = noise2(seed + 9);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + ((n(x * 2.1 * scale + 7, z * 2.1 * scale + y * 1.7 * scale) - 0.5) * amt + (n2(x * 6 * scale + z * 4 * scale, y * 6 * scale) - 0.5) * amt * 0.4);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

// A double-ended wooden hull (used for the sponge boat and the ghost of the old ship)
function hullGeo(L, B, sheer, keel, n = 22, m = 10) {
  const pos = [], idx = [], rows = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, half = Math.max(0.03, B / 2 * Math.pow(Math.sin(Math.PI * u), 0.55));
    const top = sheer + 0.5 * Math.pow(2 * u - 1, 4) * (sheer * 0.5 + 0.3);
    const bot = lerp(top - 0.25, keel, Math.pow(Math.sin(Math.PI * u), 0.35));
    const row = [];
    for (let j = 0; j <= m; j++) {
      const a = (j / m - 0.5) * Math.PI, s = Math.sin(a);
      const x = half * Math.sign(s) * Math.pow(Math.abs(s), 0.6);
      const y = top - (top - bot) * Math.pow(Math.cos(a), 0.9);
      row.push(pos.length / 3); pos.push(x, y, (u - 0.5) * L);
    }
    rows.push(row);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const a = rows[i][j], b = rows[i + 1][j], c = rows[i + 1][j + 1], d = rows[i][j + 1];
    idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// The flat deck inside the hull, at height y
function deckGeo(L, B, y, n = 22) {
  const pos = [];
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const h0 = Math.max(0.02, B / 2 * Math.pow(Math.sin(Math.PI * u0), 0.55)) * 0.97, h1 = Math.max(0.02, B / 2 * Math.pow(Math.sin(Math.PI * u1), 0.55)) * 0.97;
    const z0 = (u0 - 0.5) * L, z1 = (u1 - 0.5) * L;
    pos.push(-h0, y, z0, -h1, y, z1, h1, y, z1, -h0, y, z0, h1, y, z1, h0, y, z0);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}

// A bronze gear wheel: teeth all round, and (on the bigger ones) four spokes, like the real wheels
function gearGeo(r, teeth, th, spokes = r > 0.035 ? 4 : 0) {
  const sh = new THREE.Shape(), td = Math.min(r * 0.14, 0.004 + r * 0.03), step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step, pts = [[r - td, a], [r, a + step * 0.22], [r, a + step * 0.5], [r - td, a + step * 0.72]];
    for (const [rr, aa] of pts) { const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr; if (i === 0 && rr === r - td && aa === a) sh.moveTo(x, y); else sh.lineTo(x, y); }
  }
  if (spokes) {
    const rin = r * 0.24, rout = r - td - r * 0.12, sw = r * 0.1;
    for (let k = 0; k < spokes; k++) {
      const a0 = k * TAU / spokes + sw / rin, a1 = (k + 1) * TAU / spokes - sw / rin;
      const b0 = k * TAU / spokes + sw / rout, b1 = (k + 1) * TAU / spokes - sw / rout;
      const hole = new THREE.Path();
      hole.absarc(0, 0, rout, b0, b1, false); hole.absarc(0, 0, rin, a1, a0, true);
      sh.holes.push(hole);
    }
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -th / 2); g.computeVertexNormals();
  return g;
}

function glowTex(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,200,120,0)') {
  return canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
}
const additive = (map, color = 0xffffff, opacity = 1) => new THREE.SpriteMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });

// ---------- The machine's dials, painted on canvases ----------
const PLATE_W = 0.29, PLATE_H = 0.47;          // shown at 1.5x real size so the details are easy to see
const FRONT_C = new THREE.Vector2(0, 0.04);     // the big front dial's centre (on the plate)
const MET_C = new THREE.Vector2(0, 0.115), SAR_C = new THREE.Vector2(0, -0.12); // back dials
const PX = 1024 / PLATE_W;                      // canvas pixels per metre
const sarosR = (m) => 0.03 + 0.068 * m / SAROS, metonicR = (m) => 0.035 + 0.066 * m / METONIC;
const sarosA = (m) => m / SAROS * 4 * TAU, metonicA = (m) => m / METONIC * 5 * TAU;

function bronzePlate(g, w, h) {
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, '#c99a4c'); gr.addColorStop(0.5, '#b0813a'); gr.addColorStop(1, '#8f6528');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const r = rng(3);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '60,40,10' : '255,230,170'},${0.05 + r() * 0.06})`; g.fillRect(r() * w, r() * h, 2 + r() * 6, 1 + r() * 3); }
  g.strokeStyle = 'rgba(70,45,15,0.8)'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
}
const ZODIAC = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];
function drawFront(g, w, h) {
  bronzePlate(g, w, h);
  const cx = w / 2 + FRONT_C.x * PX, cy = h / 2 - FRONT_C.y * PX, ink = '#3a2408';
  const R1 = 0.105 * PX, R2 = 0.09 * PX, R3 = 0.072 * PX;
  g.strokeStyle = ink; g.lineWidth = 4;
  for (const R of [R1, R2, R3]) { g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); }
  // outer ring: the 365 days of the Egyptian calendar
  g.lineWidth = 1.5;
  for (let i = 0; i < 365; i++) { const a = i / 365 * TAU, k = i % 30 === 0 ? 0.88 : 0.95; g.beginPath(); g.moveTo(cx + Math.sin(a) * R1, cy - Math.cos(a) * R1); g.lineTo(cx + Math.sin(a) * R1 * k, cy - Math.cos(a) * R1 * k); g.stroke(); }
  // inner ring: the twelve signs of the zodiac
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a0 = i / 12 * TAU; g.beginPath(); g.moveTo(cx + Math.sin(a0) * R2, cy - Math.cos(a0) * R2); g.lineTo(cx + Math.sin(a0) * R3, cy - Math.cos(a0) * R3); g.lineWidth = 3; g.stroke();
    const a = a0 + TAU / 24, rr = (R2 + R3) / 2;
    g.save(); g.translate(cx + Math.sin(a) * rr, cy - Math.cos(a) * rr); g.rotate(a);
    g.font = `bold ${ZODIAC[i].length > 8 ? 17 : 21}px Georgia, serif`; g.fillText(ZODIAC[i], 0, 1); g.restore();
  }
  // the dial's middle: darker, with a faint star pattern
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R3); gr.addColorStop(0, '#5a3a14'); gr.addColorStop(1, '#7a5220');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R3 - 2, 0, TAU); g.fill();
  const r = rng(9); g.fillStyle = 'rgba(255,230,170,0.6)';
  for (let i = 0; i < 40; i++) { const a = r() * TAU, d = Math.sqrt(r()) * (R3 - 8); g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2, 2); }
  // tiny Greek writing, like the real "user's manual" engraved on the plates
  g.fillStyle = 'rgba(58,36,8,0.55)'; g.font = '15px Georgia, serif'; g.textAlign = 'left';
  const greek = 'ΗΛΙΟΣ ΣΕΛΗΝΗ ΚΡΟΝΟΣ ΖΕΥΣ ΑΡΗΣ ΑΦΡΟΔΙΤΗ ΕΡΜΗΣ ΖΩΔΙΑΚΟΣ ΜΗΝΕΣ ΕΚΛΕΙΨΙΣ ';
  for (let row = 0; row < 7; row++) g.fillText(greek.slice(row * 7) + greek, 30, cy + R1 + 40 + row * 22);
  for (let row = 0; row < 4; row++) g.fillText(greek.slice(row * 5) + greek, 30, 34 + row * 22);

  // the window at the bottom (cut out, so you can see the gears behind it)
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.roundRect(w * 0.1, h / 2 + 0.095 * PX, w * 0.8, 0.12 * PX, 16); g.fill();
  g.globalCompositeOperation = 'source-over';
}
function drawSpiral(g, cx, cy, rOf, aOf, months, ink) {
  g.strokeStyle = ink; g.lineWidth = 5;
  for (const off of [-0.5, 0.5]) {
    g.beginPath();
    for (let m = 0; m <= months; m += 0.5) { const a = aOf(m), rr = (rOf(m) + off * 0.012) * PX; const x = cx + Math.sin(a) * rr, y = cy - Math.cos(a) * rr; if (m === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  }
  // a little tick for every month
  g.lineWidth = 1.2;
  for (let m = 0; m <= months; m++) { const a = aOf(m), r0 = (rOf(m) - 0.006) * PX, r1 = (rOf(m) + 0.006) * PX; g.beginPath(); g.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0); g.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); g.stroke(); }
}
function drawBack(g, w, h) {
  bronzePlate(g, w, h);
  const ink = '#3a2408', toX = (x) => w / 2 + x * PX, toY = (y) => h / 2 - y * PX;
  drawSpiral(g, toX(MET_C.x), toY(MET_C.y), metonicR, metonicA, METONIC, ink);
  drawSpiral(g, toX(SAR_C.x), toY(SAR_C.y), sarosR, sarosA, SAROS, ink);
  // eclipse signs on the lower spiral: Σ (Moon) and Η (Sun), in little boxes
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 19px Georgia, serif';
  ECLIPSES.forEach((m, i) => {
    const a = sarosA(m), rr = sarosR(m) * PX, x = toX(SAR_C.x) + Math.sin(a) * rr, y = toY(SAR_C.y) - Math.cos(a) * rr;
    g.fillStyle = '#f2cf80'; g.beginPath(); g.roundRect(x - 12, y - 12, 24, 24, 5); g.fill();
    g.strokeStyle = ink; g.lineWidth = 2; g.stroke(); g.fillStyle = ink; g.fillText(i % 3 === 1 ? 'Η' : 'Σ', x, y + 1);
  });
  g.font = 'bold 30px Georgia, serif'; g.fillStyle = ink;
  g.fillText('CALENDAR', w / 2, 40); g.fillText('ECLIPSES', w / 2, h - 30);
}

// The journal page Astra hands you at the end: the machine's front dial and its gears
function drawJournal(g, w, h) {
  const gr = g.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.7);
  gr.addColorStop(0, '#f2e3bf'); gr.addColorStop(1, '#d4bb86'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(110,80,40,0.5)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
  const ink = '#3a2a18'; g.strokeStyle = ink; g.fillStyle = ink;
  // the front dial
  const cx = w * 0.3, cy = h * 0.55, R = h * 0.27;
  g.lineWidth = 3; for (const k of [1, 0.84, 0.66]) { g.beginPath(); g.arc(cx, cy, R * k, 0, TAU); g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(cx + Math.sin(a) * R * 0.66, cy - Math.cos(a) * R * 0.66); g.lineTo(cx + Math.sin(a) * R * 0.84, cy - Math.cos(a) * R * 0.84); g.stroke(); }
  g.lineWidth = 5; g.strokeStyle = '#c0841e'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(0.9) * R * 0.95, cy - Math.cos(0.9) * R * 0.95); g.stroke();
  g.fillStyle = '#e0952a'; g.beginPath(); g.arc(cx + Math.sin(0.9) * R * 0.75, cy - Math.cos(0.9) * R * 0.75, 14, 0, TAU); g.fill();
  g.strokeStyle = '#6a6a72'; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(2.6) * R * 0.8, cy - Math.cos(2.6) * R * 0.8); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + Math.sin(2.6) * R * 0.62, cy - Math.cos(2.6) * R * 0.62, 12, 0, TAU); g.fill();
  g.fillStyle = '#222'; g.beginPath(); g.arc(cx + Math.sin(2.6) * R * 0.62, cy - Math.cos(2.6) * R * 0.62, 12, -Math.PI / 2, Math.PI / 2); g.fill();
  // two gears meshing
  const gear = (x, y, r, n) => {
    g.beginPath();
    for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * TAU, rr = i % 2 ? r : r * 0.86; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.strokeStyle = ink; g.lineWidth = 3; g.stroke();
    for (let k = 0; k < 4; k++) { const a = k * TAU / 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); g.stroke(); }
  };
  gear(w * 0.68, h * 0.46, 95, 40); gear(w * 0.68 + 128, h * 0.46 + 60, 40, 16); gear(w * 0.62, h * 0.78, 52, 22);
  g.fillStyle = ink; g.font = 'italic bold 42px Georgia, serif'; g.textAlign = 'left';
  g.fillText('The Antikythera machine', 40, 68);
  g.font = 'italic 30px Georgia, serif';
  g.fillText('Made about 2,100 years ago. Found 1901.', 40, 110);
  g.fillText('Turn the handle: Sun, Moon, and eclipses', 40, h - 36);
}

export default class Antikythera {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.top = new THREE.Group(); this.sea = new THREE.Group(); this.root.add(this.top, this.sea);
    this.uTime = { value: 0 };
    this.start = { pos: START_TOP, yaw: 0 };
    // Shared progress (sent to friends' headsets)
    this.s = {
      scene: 'top',    // 'top' (on the boat) or 'sea' (on the seafloor)
      phase: 'boat',   // boat, seabed, lump, closer, xray, crank, eclipse, closing, journal, done
      dive: 0,         // the diver climbing down the ladder, 0..1
      surf: 0,         // ...and bursting back up, shouting
      guide: null,     // [x, y, z] where Astra hovers, or null = out in front of you
      point: 0,        // the diver points: 1 at the statues, 2 at the lump
      ghost: 0,        // the ghost of the ship, as it was, over the wreck
      ring: 0,         // the glowing "stand here" ring
      lump: 0,         // 0 lying on the rock, 1 picked up, 2 floating over the rock for the X-ray
      glint: 0,        // gear teeth glinting in the lump
      xray: 0, build: 0, // the X-ray look inside, then the gears flying out to build the machine
      crank: 0,        // turns of the handle (months)
      flip: 0,         // the machine turns round to show its back
      eclipse: 0, eclM: -1, // an eclipse found on the back dial (which month)
      holo: 0,         // the sky the machine holds, shown around you at the end
      journal: 0,
    };
    this.clock = 0; this.phaseT = 0; this.lastPhase = '';
    this.sceneNow = null;
    this.waterFog = new THREE.FogExp2(0x0e4a5e, 0.034);
    // The real sky over Antikythera (36° N) in spring 1901 (a daytime sky on the boat)
    G.sky.setPlace?.({ lat: 35.9, year: 1901, sunLon: 30 });
    G.sky.hideMoon?.();
    this.topBlk = [{ x: 0, z: -2.2, r: 0.12 }];
    this.seaBlk = [];

    this.buildTop();
    this.buildSea();
    this.buildMachine();
    this.buildJournal();
    this.registerInteractables();
    this.applyScene('top');
  }

  // ======================= On the boat =======================
  buildTop() {
    const T = this.top, uT = this.uTime;
    // The sea: a big low-poly swell, flat-shaded so the facets catch the light
    const sg = new THREE.PlaneGeometry(1400, 1400, 140, 140); sg.rotateX(-Math.PI / 2);
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r0 = Math.hypot(x, z), k = r0 > 0 ? Math.pow(r0 / 700, 1.7) * 700 / r0 : 0; p.setXYZ(i, x * k, 0, z * k); }
    const sea = new THREE.Mesh(sg, addWaves(new THREE.MeshLambertMaterial({ color: 0x23708a, emissive: 0x06202a, flatShading: true }), uT));
    T.add(sea);

    // Antikythera island: steep, dry, rocky, a little green scrub on top
    const ig = new THREE.PlaneGeometry(760, 520, 110, 80); ig.rotateX(-Math.PI / 2);
    const ip = ig.attributes.position, cols = new Float32Array(ip.count * 3), c = new THREE.Color();
    const rockC = new THREE.Color(0x9c8a70), cliffC = new THREE.Color(0x7d6c58), scrub = new THREE.Color(0x67733f), beach = new THREE.Color(0xcab894);
    const IC = new THREE.Vector3(330, 0, -230);
    for (let i = 0; i < ip.count; i++) {
      const x = ip.getX(i) + IC.x, z = ip.getZ(i) + IC.z;
      const dx = (x - IC.x) / 300, dz = (z - IC.z) / 200, d = Math.hypot(dx, dz);
      let h = Math.pow(clamp(1 - d, 0, 1), 0.55) * 95 * (0.75 + 0.5 * NS1(x / 70, z / 70)) + (NS3(x / 18, z / 18) - 0.5) * 8 - 6;
      if (h < -4) h = -4;
      ip.setXYZ(i, x, h, z);
      c.copy(rockC).lerp(cliffC, NS2(x / 9, z / 9));
      if (h > 40 && NS1(x / 25 + 9, z / 25) > 0.45) c.lerp(scrub, 0.7);
      if (h < 2) c.lerp(beach, 0.6);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    ig.setAttribute('color', new THREE.BufferAttribute(cols, 3)); ig.computeVertexNormals();
    T.add(new THREE.Mesh(ig, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    // a small rocky islet closer in (the storm drove them into its shelter)
    const islet = new Kit();
    for (let i = 0; i < 6; i++) { const r = rng(60 + i); islet.add(lumpy(new THREE.IcosahedronGeometry(6 + r() * 9, 2), 70 + i, 0.6, 0.1), 0x8a7a64, [150 + r() * 40, -3 + r() * 3, 60 + r() * 30], [0, 0, 0], [1.4, 0.7 + r() * 0.5, 1]); }
    T.add(islet.mesh());

    // Storm clouds breaking up, far off
    const cm = new THREE.SpriteMaterial({ map: canvasTex(128, 64, (g, w, h) => {
      for (let i = 0; i < 12; i++) { const r = rng(i + 3), x = 20 + r() * 88, y = 22 + r() * 24, rr = 14 + r() * 18; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    }), color: 0x9aa0aa, transparent: true, depthWrite: false, fog: false });
    const r = rng(17);
    for (let i = 0; i < 9; i++) {
      const s = new THREE.Sprite(cm), az = r() * 360 * D2R, el = (5 + r() * 14) * D2R, d = 800;
      s.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, -Math.cos(az) * Math.cos(el) * d);
      s.scale.set(360 + r() * 300, 120 + r() * 80, 1); T.add(s);
    }

    // The sponge boat: a double-ended wooden caique, white with a blue band, red below the water
    const L = 11, B = 3.6, hull = hullGeo(L, B, 1.22, -0.9);
    const hp = hull.attributes.position, hc = new Float32Array(hp.count * 3);
    for (let i = 0; i < hp.count; i++) {
      const y = hp.getY(i), z = hp.getZ(i), top = 1.22 + 0.5 * Math.pow(2 * (z / L + 0.5) - 1, 4) * (0.61 + 0.3);
      c.setHex(y > top - 0.1 ? 0x6a4a2a : y > top - 0.35 ? 0x2f5d9a : y > 0.12 ? 0xece8dc : 0x7a2e24);
      hc.set([c.r, c.g, c.b], i * 3);
    }
    hull.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    T.add(new THREE.Mesh(hull, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    const deck = new Kit(); deck.add(deckGeo(L, B, DECK), 0x4e3824);   // (dark: it shows only in the seams)
    // deck planks: each its own board, a little apart, in slightly different browns (one clean layer,
    // 1.5 cm proud of the deck, so nothing flickers), then the mast, yard with the sail furled, bowsprit
    const rp = rng(31);
    for (let x = -1.6; x <= 1.61; x += 0.2) {
      const len = 9.5 * Math.pow(1 - Math.abs(x) / 1.9, 0.5);
      for (let z = -len / 2, j = 0; z < len / 2 - 0.05; j++) {                                   // boards butt-jointed along the length
        const l = Math.min(len / 2 - z, 1.6 + rp() * 1.4) - 0.01, c = new THREE.Color(0xb08a5a).multiplyScalar(0.88 + rp() * 0.2);
        deck.box(0.188, 0.015, l, c.getHex(), [x, DECK + 0.0075, z + l / 2]); z += l + 0.01;
      }
    }
    deck.cyl(0.07, 0.09, 7.4, 8, 0x7a5a36, [0, DECK + 3.7, -2.2]);
    deck.cyl(0.04, 0.05, 8.5, 6, 0x6a4a2a, [0.2, DECK + 4.6, -2.0], [0.15, 0, 1.15]);
    deck.cyl(0.16, 0.16, 7.2, 8, 0xe6dcc0, [0.28, DECK + 4.5, -2.0], [0.15, 0, 1.15]);
    deck.cyl(0.04, 0.06, 2.6, 6, 0x6a4a2a, [0, 1.75, -6.4], [-1.25, 0, 0]);
    // the air pump: a wooden chest with two big flywheels the crew turn to send air down the hose
    deck.box(0.62, 0.62, 0.48, 0x6e4a2a, [-0.6, DECK + 0.31, 2.3]);
    deck.box(0.66, 0.05, 0.52, 0x4e3420, [-0.6, DECK + 0.64, 2.3]);
    deck.cyl(0.05, 0.05, 1.05, 6, 0x333333, [-0.6, DECK + 0.45, 2.3], [0, 0, Math.PI / 2]);
    // oars along the rails, a barrel, coiled rope, a basket of sponges
    for (const sx of [-1, 1]) deck.box(0.06, 0.04, 4.2, 0x8a6a44, [sx * 1.45, DECK + 0.25, 0.8], [0, sx * 0.03, 0]);
    deck.cyl(0.24, 0.24, 0.6, 10, 0x7a5232, [0.9, DECK + 0.3, 3.0]);
    deck.add(new THREE.TorusGeometry(0.22, 0.05, 5, 14), 0xb59a6a, [-0.9, DECK + 0.05, -0.9], [Math.PI / 2, 0, 0]);
    deck.add(new THREE.TorusGeometry(0.16, 0.05, 5, 12), 0xb59a6a, [-0.9, DECK + 0.13, -0.9], [Math.PI / 2, 0, 0]);
    deck.cyl(0.34, 0.28, 0.35, 10, 0x8a6a3a, [1.0, DECK + 0.17, -3.4]);
    const rs = rng(23);
    for (let i = 0; i < 14; i++) deck.add(lumpy(new THREE.IcosahedronGeometry(0.09 + rs() * 0.04, 1), 90 + i, 0.5, 8), rs() < 0.5 ? 0xb08a3e : 0x8a6a2c, [1.0 + (rs() - 0.5) * 0.4, DECK + 0.38 + rs() * 0.12, -3.4 + (rs() - 0.5) * 0.4]);
    // sponges drying on a line from the mast to the bow
    for (let i = 0; i < 12; i++) { const k = (i + 1) / 13; deck.add(lumpy(new THREE.IcosahedronGeometry(0.08 + rs() * 0.03, 1), 120 + i, 0.5, 8), 0xa88238, [0, lerp(DECK + 2.4, 1.9, k) - Math.sin(k * Math.PI) * 0.35 - 0.12, lerp(-2.2, -5.9, k)]); }
    // the ladder over the side, down into the water
    for (const dz of [-0.2, 0.2]) deck.box(0.04, 3.0, 0.04, 0x6a4a2a, [1.86, -0.1, 0.25 + dz], [0, 0, -0.1]);
    for (let y = -1.4; y < 1.2; y += 0.3) deck.box(0.04, 0.03, 0.42, 0x7a5a36, [1.86 - y * 0.1, y, 0.25]);
    T.add(deck.mesh());
    // rigging lines
    const lines = [[0, DECK + 7, -2.2, 0, 1.6, -6.4], [0, DECK + 7, -2.2, 1.6, 1.25, 1.0], [0, DECK + 7, -2.2, -1.6, 1.25, 1.0], [0, DECK + 7, -2.2, 0, 1.3, 5.3], [0, DECK + 2.4, -2.2, 0, 1.9, -5.9]];
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines.flat(), 3));
    T.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a3022 })));
    // the pump's flywheels (they turn while the diver is down)
    this.wheels = [];
    for (const sx of [-1, 1]) {
      const wk = new Kit();
      wk.add(new THREE.TorusGeometry(0.42, 0.03, 5, 22), 0x7a2a22);
      for (let k = 0; k < 6; k++) wk.box(0.02, 0.8, 0.02, 0x7a2a22, [0, 0, 0], [0, 0, k * Math.PI / 6]);
      wk.cyl(0.03, 0.03, 0.22, 6, 0x333333, [0.36, 0, 0], [Math.PI / 2, 0, 0]);
      const wm = wk.mesh(); wm.rotation.y = Math.PI / 2; wm.position.set(-0.6 + sx * 0.52, DECK + 0.45, 2.3);
      const holder = new THREE.Group(); holder.add(wm); T.add(holder); this.wheels.push(wm);
    }
    // the air hose: from the pump, over the rail, down into the sea
    const hose = new THREE.CatmullRomCurve3([[-0.3, DECK + 0.4, 2.05], [0.4, DECK + 0.05, 1.6], [1.3, DECK + 0.05, 0.6], [1.75, 1.3, 0.45], [2.05, 0.6, 0.5], [2.2, -1.5, 0.6], [2.4, -4, 0.7]].map((v) => new THREE.Vector3(...v)));
    T.add(new THREE.Mesh(new THREE.TubeGeometry(hose, 40, 0.025, 5), new THREE.MeshLambertMaterial({ color: 0x3a3328 })));

    // The diver (Meem's sponge diver), and two of the crew at the pump
    this.diverTop = makePerson({ model: 'diver', seed: 3 });
    this.diverTop.g.position.set(1.0, DECK + 0.015, 0.35); T.add(this.diverTop.g);
    this.crew = [];
    for (const [x, face] of [[-1.25, Math.PI / 2], [0.05, -Math.PI / 2]]) {
      const P = makePerson({ model: ['sailor', 'instrument_maker'][this.crew.length], seed: 50 + this.crew.length * 9, tunic: [0x5a6a8a, 0x8a7a5a][this.crew.length], beard: true, hair: 0x2a2018 });
      if (this.crew.length) dress(P, { mul: 0x6a7488, sat: 0.6, hair: 0x3a3430 });   // the old hand at the pump, in a faded blue smock
      P.g.position.set(x, DECK + 0.015, 2.3); P.g.rotation.y = face; P.pose = 'pull'; T.add(P.g); this.crew.push(P);
    }
    // Bubbles coming up where the diver went down
    this.surfaceBubbles = makeSpecks({ n: 40, size: 0.05, color: 0xffffff, box: [1, 1.2, 1], rise: 0.5, uTime: uT, opacity: 0 });
    this.surfaceBubbles.material.uniforms.origin.value.set(2.1, -1.1, 0.4);
    T.add(this.surfaceBubbles);
  }

  // ======================= On the seafloor =======================
  buildSea() {
    const S = this.sea, uT = this.uTime, blk = this.seaBlk;
    const cMat = () => addCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), uT);
    this.sandMat = cMat();
    // The water all around: bright up toward the surface, deep blue below, shimmering light overhead
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
      uniforms: { uTime: uT, top: { value: new THREE.Color(0x4fb4c8) }, mid: { value: this.waterFog.color }, bot: { value: new THREE.Color(0x031722) } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 top, mid, bot; uniform float uTime; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 col = h > 0.0 ? mix(mid, top, pow(h, 0.7)) : mix(mid, bot, pow(-h, 0.5));
          float sw = smoothstep(0.7, 0.93, h);
          col += vec3(0.45, 0.75, 0.8) * sw * (0.55 + 0.45 * sin(d.x * 38.0 + uTime * 0.8) * sin(d.z * 33.0 - uTime * 1.1));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    this.dome.frustumCulled = false; this.dome.renderOrder = -10; S.add(this.dome);

    // Sand: ripples, darker patches, a little debris; finer close to the wreck
    const SIZE = 150, SEG = 130, g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const sand = new THREE.Color(0xcdb98e), sand2 = new THREE.Color(0xa8946c), rock = new THREE.Color(0x7a7266), dark = new THREE.Color(0x6a5e48);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i);
      const r0 = Math.hypot(x, z), k = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.5) * (SIZE / 2) / r0 : 0;
      x = x * k + 0.5; z = z * k - 8;
      const y = seabedHeight(x, z);
      p.setXYZ(i, x, y, z);
      c.copy(sand).lerp(sand2, NS2(x / 6, z / 6) * 0.8);
      c.multiplyScalar(0.92 + 0.08 * Math.sin(x * 1.7 + z * 0.55 + NS2(x / 4, z / 4) * 3));
      if (x < -12) c.lerp(rock, clamp((-12 - x) / 8, 0, 0.9));
      if (Math.hypot(x - WRECK.x, z - WRECK.z) < 7) c.lerp(dark, 0.25);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    S.add(new THREE.Mesh(g, this.sandMat));

    // Rocks: boulders on the slope, the flat-topped rock the lump lies on, sponges and urchins on them
    const rk = new Kit(), r = rng(101);
    const place = (geo, col, x, z, yOff = 0, rot = [0, 0, 0], sc = 1) => { rk.add(geo, col, [x, seabedHeight(x, z) + yOff, z], rot, sc); };
    for (let i = 0; i < 70; i++) {
      let x, z; do { x = -40 + r() * 70; z = -45 + r() * 60; } while (Math.hypot(x - WRECK.x, z - WRECK.z) < 9 || Math.hypot(x, z) < 4 || Math.hypot(x - ROCK.x, z - ROCK.z) < 2.5);
      const big = x < -12 ? 1.6 + r() * 2.4 : 0.4 + r() * 1.1;
      place(lumpy(new THREE.IcosahedronGeometry(big, 1), 200 + i, 0.55, 0.8 / big), r() < 0.7 ? 0x6e6a5e : 0x7e6a64, x, z, big * 0.15, [r(), r() * 6, r()], [1, 0.6 + r() * 0.4, 1]);
      if (Math.hypot(x, z + 8) < 26 && big < 2.4) blk.push({ x, z, r: big * 0.8 });
      // pink coralline crust, yellow sponges, black urchins
      for (let j = 0; j < 3; j++) {
        const a = r() * TAU, rr = big * 0.75, kind = r();
        rk.add(lumpy(new THREE.IcosahedronGeometry(kind < 0.4 ? 0.12 : 0.07, 1), 300 + i * 3 + j, 0.6, 6), kind < 0.4 ? 0xc89a3a : kind < 0.7 ? 0x1e1a22 : 0xa86a7a,
          [x + Math.cos(a) * rr * 0.8, seabedHeight(x, z) + big * 0.55, z + Math.sin(a) * rr * 0.8]);
      }
    }
    // the flat rock (a slab of stone), top at waist height so you can pick the lump up without bending
    const gy = seabedHeight(ROCK.x, ROCK.z);
    this.rockTop = gy + 0.95;
    const slab = lumpy(new THREE.CylinderGeometry(0.52, 0.72, 0.95, 11, 4), 444, 0.32, 3);
    const sp = slab.attributes.position;
    for (let i = 0; i < sp.count; i++) if (sp.getY(i) > 0.4) sp.setY(i, 0.475);
    slab.computeVertexNormals();
    rk.add(slab, 0x7a7468, [ROCK.x, gy + 0.475, ROCK.z]);
    rk.add(lumpy(new THREE.IcosahedronGeometry(0.11, 1), 445, 0.6, 6), 0xc89a3a, [ROCK.x - 0.5, gy + 0.6, ROCK.z - 0.25]);
    blk.push({ x: ROCK.x, z: ROCK.z, r: 0.48 });
    S.add(new THREE.Mesh(rk.geometry(), cMat()));

    // Seagrass meadows (Posidonia) away from the wreck
    const blade = new Kit(), rb = rng(9);
    for (let i = 0; i < 6; i++) {
      const bg = new THREE.PlaneGeometry(0.035, 0.75, 1, 4); bg.translate(0, 0.375, 0);
      const a = rb() * TAU; blade.add(bg, 0xffffff, [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05], [(rb() - 0.5) * 0.4, a, (rb() - 0.5) * 0.4], [1, 0.6 + rb() * 0.6, 1]);
    }
    const bladeGeo = blade.geometry();
    const N = 1100, grass = new THREE.InstancedMesh(bladeGeo, addSway(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), uT), N);
    const mm = new THREE.Matrix4(), cc = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const patch = i / 40 | 0, pr = rng(700 + patch), px = -30 + pr() * 55, pz = -40 + pr() * 55;
      let x = px + (r() - 0.5) * 7, z = pz + (r() - 0.5) * 7;
      if (Math.hypot(x - WRECK.x, z - WRECK.z) < 8 || Math.hypot(x, z) < 3 || Math.hypot(x - STAND.x, z - STAND.z) < 2) { x += 30; }
      _q.setFromAxisAngle(_a.set(0, 1, 0), r() * TAU);
      const sc = 0.7 + r() * 0.6;
      mm.compose(_b.set(x, seabedHeight(x, z) - 0.02, z), _q, _c.set(sc, sc, sc)); grass.setMatrixAt(i, mm);
      grass.setColorAt(i, cc.setHex(0x3f6a34).lerp(new THREE.Color(0x8a9a4a), r() * 0.5));
    }
    S.add(grass);

    this.buildWreck();
    this.buildStatues();
    this.buildLife();

    // Shafts of light from the surface, faint and slow
    const rayTex = canvasTex(64, 256, (g2, w, h) => {
      const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(200,245,255,0.5)'); gr.addColorStop(0.6, 'rgba(200,245,255,0.35)'); gr.addColorStop(1, 'rgba(200,245,255,0)');
      g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
      const sd = g2.createLinearGradient(0, 0, w, 0); sd.addColorStop(0, 'rgba(0,0,0,1)'); sd.addColorStop(0.5, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,1)');
      g2.globalCompositeOperation = 'destination-out'; g2.fillStyle = sd; g2.fillRect(0, 0, w, h);
    });
    const ray = new Kit(), rr = rng(33);
    for (let i = 0; i < 9; i++) {
      const x = -10 + rr() * 22, z = -22 + rr() * 22, w = 1.2 + rr() * 2;
      for (const a of [0, Math.PI / 2]) {
        const pg = new THREE.PlaneGeometry(w, 34); pg.translate(0, 17, 0);
        ray.add(pg, 0xffffff, [x, seabedHeight(x, z), z], [0.12, a + rr(), 0.08]);
      }
    }
    const rg = ray.geometry(); rg.deleteAttribute('color');
    // put the uvs back (the kit dropped them): u across, v up the shaft
    const rp = rg.attributes.position, uv = new Float32Array(rp.count * 2);
    // (each plane is two triangles in the order three.js builds them: (top-left, bottom-left, top-right), (bottom-left, bottom-right, top-right))
    const quad = [[0, 1], [0, 0], [1, 1], [0, 0], [1, 0], [1, 1]];
    for (let i = 0; i < rp.count; i += 6) for (let j = 0; j < 6; j++) uv.set(quad[j], (i + j) * 2);
    rg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.rays = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: rayTex, color: 0x9fe6f0, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    S.add(this.rays);

    // Specks of drifting "marine snow" all around you
    this.snow = makeSpecks({ n: 700, size: 0.03, color: 0xd8f0f0, box: [22, 12, 22], uTime: uT, opacity: 0.55 });
    S.add(this.snow);
  }

  buildWreck() {
    const S = this.sea, k = new Kit(), r = rng(55), W = WRECK, cy = Math.cos(WRECK_YAW), sy = Math.sin(WRECK_YAW);
    const at = (along, across) => [W.x + across * cy + along * sy, W.z - across * sy + along * cy];
    // the keel, half buried, and the ribs of the hull curving up out of the sand (a lot has rotted away)
    for (let i = -10; i <= 10; i++) {
      const [x, z] = at(i * 0.7, 0); k.box(0.3, 0.25, 0.75, 0x3a2e22, [x, seabedHeight(x, z) + 0.02, z], [0, WRECK_YAW, 0]);
    }
    for (let i = -8; i <= 8; i++) for (const side of [-1, 1]) {
      if (r() < 0.3) continue;
      const len = 0.8 + r() * 1.6 * (1 - Math.abs(i) / 10), pts = [];
      for (let j = 0; j <= 4; j++) { const t = j / 4, [x, z] = at(i * 0.85, side * (0.2 + t * 1.6)); pts.push([x, seabedHeight(x, z) + Math.sin(t * 1.4) * len - 0.1, z]); }
      k.tube(pts, 0.07, r() < 0.5 ? 0x3e3226 : 0x2e261e, 5);
    }
    // planks lying around
    for (let i = 0; i < 16; i++) { const [x, z] = at((r() - 0.5) * 16, (r() - 0.5) * 6); k.box(0.22, 0.05, 1.2 + r() * 1.8, 0x4a3a2a, [x, seabedHeight(x, z) + 0.03, z], [r() * 0.2, r() * TAU, r() * 0.2]); }
    // lead anchor stocks and a few marble blocks
    for (let i = 0; i < 2; i++) { const [x, z] = at(-7 - i * 1.5, 1.5 - i * 3); k.box(1.7, 0.16, 0.18, 0x55595e, [x, seabedHeight(x, z) + 0.06, z], [0, r() * TAU, 0.1]); }
    for (let i = 0; i < 4; i++) { const [x, z] = at((r() - 0.5) * 12, (r() - 0.5) * 8), s = 0.4 + r() * 0.4; k.add(lumpy(new THREE.BoxGeometry(s * 1.6, s, s, 3, 2, 2), 600 + i, 0.15, 2), 0xd6d0c4, [x, seabedHeight(x, z) + s * 0.3, z], [r() * 0.3, r() * TAU, r() * 0.3]); }
    S.add(new THREE.Mesh(k.geometry(), addCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), this.uTime)));

    // Wine jars (amphorae), dozens of them: standing, tipped over, piled, half sunk in the sand
    const prof = [[0, 0], [0.025, 0.02], [0.055, 0.1], [0.12, 0.33], [0.14, 0.47], [0.115, 0.6], [0.05, 0.68], [0.04, 0.82], [0.055, 0.85], [0.03, 0.86]].map(([x, y]) => new THREE.Vector2(x, y));
    const ak = new Kit(); ak.add(new THREE.LatheGeometry(prof, 9), 0xffffff);
    for (const s of [-1, 1]) ak.add(new THREE.TorusGeometry(0.06, 0.012, 4, 8, Math.PI), 0xffffff, [s * 0.07, 0.72, 0], [0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2]);
    const NA = 46, amph = new THREE.InstancedMesh(ak.geometry(), addCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), this.uTime), NA);
    const mm = new THREE.Matrix4(), cc = new THREE.Color();
    for (let i = 0; i < NA; i++) {
      const pile = i < 20, [x, z] = pile ? at(2 + (r() - 0.5) * 4, (r() - 0.5) * 2.2) : at((r() - 0.5) * 18, (r() - 0.5) * 9);
      const lying = r() < 0.7;
      _e.set(lying ? Math.PI / 2 + (r() - 0.5) * 0.4 : (r() - 0.5) * 0.4, r() * TAU, (r() - 0.5) * 0.3, 'YXZ');
      _q.setFromEuler(_e);
      const y = seabedHeight(x, z) + (lying ? 0.06 + (pile ? (i % 3) * 0.16 : 0) : -0.25 - r() * 0.3);
      mm.compose(_b.set(x, y, z), _q, _c.setScalar(0.9 + r() * 0.25)); amph.setMatrixAt(i, mm);
      amph.setColorAt(i, cc.setHex(0xb0643a).lerp(new THREE.Color(r() < 0.4 ? 0x6a6a48 : 0x8a5a3a), r() * 0.6));
    }
    S.add(amph);
    // Glass bowls (some of the cargo) and bronze coins scattered among the timbers
    const bowl = new THREE.LatheGeometry([[0, 0], [0.06, 0.005], [0.09, 0.04], [0.095, 0.05], [0.088, 0.05], [0.05, 0.012], [0, 0.01]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
    const glass = new THREE.InstancedMesh(bowl, new THREE.MeshLambertMaterial({ color: 0x7fd0c0, emissive: 0x0a3a3a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 7);
    for (let i = 0; i < 7; i++) { const [x, z] = at(-3 + r() * 6, -1.5 + r() * 3); mm.compose(_b.set(x, seabedHeight(x, z) + 0.01, z), _q.setFromEuler(_e.set((r() - 0.5) * 0.6, r() * TAU, (r() - 0.5) * 0.6)), _c.setScalar(1)); glass.setMatrixAt(i, mm); }
    S.add(glass);
    const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.003, 10), new THREE.MeshLambertMaterial({ color: 0xc9a050, emissive: 0x3a2808 }), 34);
    for (let i = 0; i < 34; i++) {
      const near = i < 10, x = near ? STAND.x - 0.8 + r() * 1.6 : at(r() * 8 - 4, r() * 4 - 2)[0], z = near ? STAND.z - 1.6 + r() * 0.6 : at(r() * 8 - 4, r() * 4 - 2)[1];
      mm.compose(_b.set(x, seabedHeight(x, z) + 0.01, z), _q.setFromEuler(_e.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5)), _c.setScalar(1)); coins.setMatrixAt(i, mm);
    }
    S.add(coins);

    // The ghost of the ship as it was: a big Greek cargo ship, shimmering above its own remains
    const hg = hullGeo(26, 8, 2.6, -1.6, 26, 12);
    this.ghost = new THREE.Group();
    const gm = new THREE.MeshBasicMaterial({ color: 0x6fd8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const lm = new THREE.LineBasicMaterial({ color: 0xbff2ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.ghost.add(new THREE.Mesh(hg, gm), new THREE.LineSegments(new THREE.WireframeGeometry(hullGeo(26, 8, 2.6, -1.6, 13, 6)), lm));
    const mastG = new THREE.BufferGeometry(); mastG.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, -2, 0, 16, -2, -6, 14, -2, 6, 14, -2, 0, 16, -2, 0, 2.6, -13, 0, 16, -2, 0, 2.6, 13], 3));
    this.ghost.add(new THREE.LineSegments(mastG, lm));
    this.ghostMats = [gm, lm];
    this.ghost.position.set(W.x, 3.2, W.z); this.ghost.rotation.y = WRECK_YAW; this.ghost.visible = false;
    S.add(this.ghost);
  }

  // Statues lying in the sand: one bronze, two marble (three of Meem's models, turned to bronze and stone)
  buildStatues() {
    this.statues = [];
    const add = (pos, yaw, rot, y, kind, pose) => {
      const holder = new THREE.Group(); holder.position.set(pos.x, seabedHeight(pos.x, pos.z) + y, pos.z); holder.rotation.y = yaw;
      const P = makePerson({ model: ['architect', 'aristotle', 'eratosthenes'][this.statues.length], seed: 70 + this.statues.length * 5, tunic: kind === 'bronze' ? 0x4d6b4a : 0xd8d2c6, skin: kind === 'bronze' ? 0x4d6b4a : 0xd8d2c6, hair: kind === 'bronze' ? 0x3d5a3a : 0xcfc8ba });
      P.g.rotation.set(...rot); P.pose = pose; P.kind = kind; holder.add(P.g); this.sea.add(holder);
      P.g.updateMatrixWorld(true);
      P.pointAt.copy(holder.localToWorld(new THREE.Vector3(-0.6, 0.9, -2.2)));
      this.statues.push(P);
      this.seaBlk.push({ x: pos.x, z: pos.z, r: 0.55 });
    };
    // the bronze youth, on his back, one arm raised (like the famous one found here)
    add(STATUE, 0.5, [-Math.PI / 2, 0, 0], 0.1, 'bronze', 'point');
    add(new THREE.Vector3(-6.2, 0, -10.8), -0.4, [0, 0, Math.PI / 2], 0.16, 'marble', 'idle');
    add(new THREE.Vector3(-1.4, 0, -12.2), 2.2, [-Math.PI / 2 + 0.25, 0, 0.3], -0.02, 'marble', 'cheer');
    this.seaBlk.push({ x: -1.4, z: -11.4, r: 0.4 }, { x: STATUE.x + 0.4, z: STATUE.z - 0.75, r: 0.4 });
  }

  // Once a statue's model has loaded: stone and bronze materials, and freeze its pose
  finishStatues() {
    for (const P of this.statues) {
      if (P.done) continue;
      if (!P.model) { if (!P.frozen) { animatePerson(P, 0, 1); P.frozen = true; } continue; }
      P.model.scene.traverse((o) => {
        if (!o.isMesh) return;
        const n = o.material.normalMap;
        o.material = P.kind === 'bronze'
          ? new THREE.MeshStandardMaterial({ color: 0x4f7458, roughness: 0.55, metalness: 0.35, normalMap: n, emissive: 0x0a1a12 })
          : new THREE.MeshStandardMaterial({ color: 0xdcd6ca, roughness: 0.9, metalness: 0, normalMap: n, emissive: 0x15140f });
      });
      animatePerson(P, 0, 1);
      P.done = true;
    }
  }

  buildLife() {
    const S = this.sea, uT = this.uTime;
    // The diver on the seafloor: his air hose rising into the blue, and his breath bubbling up
    this.diver = makePerson({ model: 'diver', seed: 3 });
    this.diver.g.position.set(DIVER.x, seabedHeight(DIVER.x, DIVER.z), DIVER.z);
    this.diver.g.rotation.y = turnToward(DIVER, STATUE);
    S.add(this.diver.g);
    this.seaBlk.push({ x: DIVER.x, z: DIVER.z, r: 0.35 });
    const by = seabedHeight(DIVER.x, DIVER.z);
    const hose = new THREE.CatmullRomCurve3([[DIVER.x, by + 1.7, DIVER.z + 0.05], [DIVER.x + 0.15, by + 2.3, DIVER.z + 0.4], [DIVER.x + 0.9, by + 5, DIVER.z + 1.4], [DIVER.x + 1.6, by + 12, DIVER.z + 2.4], [DIVER.x + 2.4, by + 30, DIVER.z + 4]].map((v) => new THREE.Vector3(...v)));
    S.add(new THREE.Mesh(new THREE.TubeGeometry(hose, 40, 0.024, 5), new THREE.MeshLambertMaterial({ color: 0x3a3328 })));
    this.bubbles = makeSpecks({ n: 50, size: 0.045, color: 0xe8ffff, box: [1, 9, 1], rise: 0.9, uTime: uT, opacity: 0.85 });
    this.bubbles.material.uniforms.origin.value.set(DIVER.x, by + 1.75, DIVER.z);
    S.add(this.bubbles);

    // Fish: two small silvery shoals circling slowly, and a few bigger fish cruising about
    const fk = new Kit();
    fk.add(new THREE.OctahedronGeometry(0.05, 0), 0xffffff, [0, 0, 0], [0, 0, 0], [0.45, 0.8, 2.2]);
    const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.09, 0, 0.045, -0.16, 0, -0.045, -0.16], 3)); tail.computeVertexNormals();
    fk.add(tail, 0xffffff);
    this.fishGeo = fk.geometry();
    this.schools = [
      { c: new THREE.Vector3(-4, 3.2, -11), R: 5.5, w: 0.14, n: 45, y: 0.8 },
      { c: new THREE.Vector3(6, 2.2, -16), R: 4, w: -0.18, n: 35, y: 0.6 },
      { c: new THREE.Vector3(0, 4.5, -6), R: 11, w: 0.06, n: 6, y: 1.5, big: true },
    ];
    const total = this.schools.reduce((a, s) => a + s.n, 0);
    this.fish = new THREE.InstancedMesh(this.fishGeo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x0c2630 }), total);
    const r = rng(91), cc = new THREE.Color();
    this.fishData = [];
    for (const sc of this.schools) for (let i = 0; i < sc.n; i++) {
      this.fishData.push({ sc, ph: r() * (sc.big ? TAU : 1.3), dr: (r() - 0.5) * (sc.big ? 4 : 1.4), dy: (r() - 0.5) * sc.y, bob: r() * TAU, s: sc.big ? 2.6 + r() * 1.2 : 0.8 + r() * 0.4 });
      this.fish.setColorAt(this.fishData.length - 1, cc.setHex(sc.big ? 0x8a8f9a : 0xc8d8e0).lerp(new THREE.Color(0x6a8aa0), r() * 0.5));
    }
    this.fish.frustumCulled = false;
    S.add(this.fish);
    this.updateFish(0);
  }

  updateFish(t) {
    const mm = _m;
    this.fishData.forEach((f, i) => {
      const sc = f.sc, a = sc.w * t + f.ph, R = sc.R + f.dr;
      _b.set(sc.c.x + Math.cos(a) * R, sc.c.y + f.dy + Math.sin(t * 0.8 + f.bob) * 0.15, sc.c.z + Math.sin(a) * R);
      const heading = Math.atan2(-Math.sin(a) * Math.sign(sc.w), Math.cos(a) * Math.sign(sc.w)); // along the circle
      _q.setFromEuler(_e.set(0, heading + Math.sin(t * 6 + f.bob) * 0.08, 0, 'YXZ'));
      mm.compose(_b, _q, _c.setScalar(f.s)); this.fish.setMatrixAt(i, mm);
    });
    this.fish.instanceMatrix.needsUpdate = true;
  }

  // ======================= The lump, and the machine inside it =======================
  buildMachine() {
    const S = this.sea;
    this.floatPos = new THREE.Vector3(ROCK.x, this.rockTop + 0.27, ROCK.z);
    // --- The lump: a slab of green, crusty, corroded bronze with one big wheel showing in it
    this.lump = new THREE.Group();
    const lg = lumpy(new THREE.BoxGeometry(0.19, 0.15, 0.055, 8, 6, 3), 31, 0.35, 9);
    const lp = lg.attributes.position, lc = new Float32Array(lp.count * 3), c = new THREE.Color(), n = noise2(12);
    for (let i = 0; i < lp.count; i++) {
      const v = n(lp.getX(i) * 40, lp.getY(i) * 40 + lp.getZ(i) * 30);
      c.setHex(0x4f7a5e).lerp(new THREE.Color(0x8aa87a), v * 0.6).lerp(new THREE.Color(0x5a4a32), v > 0.7 ? 0.6 : 0); lc.set([c.r, c.g, c.b], i * 3);
    }
    lg.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    this.lumpMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.1, flatShading: true, transparent: true, opacity: 1 });
    this.lumpBody = new THREE.Mesh(lg, this.lumpMat);
    this.lumpGearMat = new THREE.MeshStandardMaterial({ color: 0x5f8a66, roughness: 0.7, metalness: 0.3, emissive: 0x000000, transparent: true });
    this.lumpGear = new THREE.Mesh(gearGeo(0.058, 56, 0.008), this.lumpGearMat);
    this.lumpGear.position.set(0.012, 0.005, 0.026);
    // crust half covering the wheel
    const cg = lumpy(new THREE.SphereGeometry(0.05, 8, 6), 33, 0.6, 20), cc2 = new Float32Array(cg.attributes.position.count * 3);
    for (let i = 0; i < cc2.length / 3; i++) { c.setHex(0x55806a).lerp(new THREE.Color(0x9ab08a), n(i * 0.7, i * 0.3) * 0.7); cc2.set([c.r, c.g, c.b], i * 3); }
    cg.setAttribute('color', new THREE.BufferAttribute(cc2, 3));
    const crust = new THREE.Mesh(cg, this.lumpMat);
    crust.scale.set(1.2, 0.8, 0.35); crust.position.set(-0.045, -0.035, 0.03);
    this.lump.add(this.lumpBody, this.lumpGear, crust);
    this.lumpRest = new THREE.Vector3(ROCK.x - 0.05, this.rockTop + 0.03, ROCK.z + 0.18);
    this.lump.position.copy(this.lumpRest); this.lump.rotation.set(-Math.PI / 2 + 0.15, 0, 0.4);
    this.lumpQRest = this.lump.quaternion.clone();
    S.add(this.lump);
    // a soft glow so you can find it among the rocks
    this.lumpGlow = new THREE.Sprite(additive(glowTex('rgba(160,255,200,0.9)', 'rgba(80,200,160,0)'), 0xffffff, 0));
    this.lumpGlow.scale.setScalar(0.6); S.add(this.lumpGlow);

    // --- The machine (a reconstruction, as people think it looked when it was new)
    this.box = new THREE.Group(); this.box.position.copy(this.floatPos); this.box.visible = false;
    S.add(this.box);
    this.gearMat = new THREE.MeshStandardMaterial({ color: 0xd2a04a, roughness: 0.42, metalness: 0.45, emissive: 0x000000 });
    this.gearXMat = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false });
    // [radius, teeth, x, y, z, turns per handle turn]
    const GEARS = [
      [0.1, 224, 0, 0.04, 0.035, 1 / 12.37], [0.018, 15, 0.118, 0.04, 0.035, -1.2], [0.045, 38, -0.062, -0.1, 0.012, -0.5], [0.03, 24, -0.062, -0.1, -0.004, -0.5],
      [0.05, 48, 0.052, -0.135, 0.02, 0.4], [0.095, 223, 0, -0.12, -0.035, 1 / 18.6], [0.04, 32, 0.072, -0.065, -0.05, -0.62], [0.03, 27, -0.07, -0.165, -0.052, 0.8],
      [0.026, 20, 0.032, 0.125, 0.012, -1.0], [0.026, 21, 0.032, 0.125, -0.002, -1.0], [0.04, 36, -0.075, 0.13, -0.012, 0.66], [0.05, 53, 0.068, 0.15, -0.03, -0.45],
      [0.035, 30, -0.03, 0.175, -0.052, 0.9], [0.028, 22, 0.085, 0.195, -0.056, -1.1], [0.026, 20, -0.105, 0.0, -0.02, 1.3], [0.032, 27, 0.095, -0.02, -0.022, -1.0],
      [0.06, 64, -0.04, 0.06, -0.03, 0.3], [0.022, 18, 0.04, -0.01, -0.058, -1.6],
    ];
    const r = rng(77);
    this.gears = GEARS.map(([rad, teeth, x, y, z, speed]) => {
      const geo = gearGeo(rad, teeth, 0.006);
      const m = new THREE.Mesh(geo, this.gearMat);
      const glow = new THREE.Mesh(geo, this.gearXMat); m.add(glow);
      // where it starts: packed inside the lump, small and jumbled
      const from = new THREE.Vector3((r() - 0.5) * 0.12, (r() - 0.5) * 0.09, (r() - 0.5) * 0.03);
      const fromQ = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.8, (r() - 0.5) * 0.8, r() * TAU));
      const g = { m, glow, speed, to: new THREE.Vector3(x, y, z), from, fromQ, fromS: 0.45, delay: r() * 0.35 };
      this.box.add(m);
      return g;
    });
    // the wooden case: top, bottom, the crank side; glass on the other side so you can see in
    const wood = new Kit();
    wood.box(0.31, 0.02, 0.17, 0x6b4423, [0, PLATE_H / 2 + 0.01, 0]); wood.box(0.31, 0.02, 0.17, 0x6b4423, [0, -PLATE_H / 2 - 0.01, 0]);
    wood.box(0.02, PLATE_H, 0.17, 0x7a5030, [PLATE_W / 2 + 0.01, 0, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.box(0.02, PLATE_H, 0.02, 0x5a3a1e, [sx * (PLATE_W / 2 + 0.01), 0, sz * 0.075]);
    // axles for the gears (thin bronze pins front to back)
    for (const [, , x, y] of GEARS) wood.cyl(0.003, 0.003, 0.14, 4, 0x8a6a30, [x, y, 0], [Math.PI / 2, 0, 0]);
    this.caseMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0 });
    this.caseMesh = new THREE.Mesh(wood.geometry(), this.caseMat); this.box.add(this.caseMesh);
    this.glassMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(0.15, PLATE_H), this.glassMat); glassPane.rotation.y = -Math.PI / 2; glassPane.position.x = -PLATE_W / 2 - 0.005; this.box.add(glassPane);
    // front and back plates with their dials
    const ftex = canvasTex(1024, Math.round(1024 * PLATE_H / PLATE_W), drawFront), btex = canvasTex(1024, Math.round(1024 * PLATE_H / PLATE_W), drawBack);
    this.plateMats = [ftex, btex].map((map) => new THREE.MeshLambertMaterial({ map, transparent: true, opacity: 0, alphaTest: 0.02, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.4 }));
    const front = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W, PLATE_H), this.plateMats[0]); front.position.z = 0.078;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(PLATE_W, PLATE_H), this.plateMats[1]); back.position.z = -0.078; back.rotation.y = Math.PI;
    this.box.add(front, back);
    // pointers: the Sun (gold) and the Moon (silver, with its little half-black, half-white ball)
    const arm = (len, w, col) => { const k = new Kit(); k.box(w, len, 0.004, col, [0, len / 2 - 0.01, 0]); k.cyl(0.008, 0.008, 0.008, 10, col, [0, 0, 0], [Math.PI / 2, 0, 0]); return k.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x2a1a06 })); };
    this.sunPtr = new THREE.Group(); this.sunPtr.add(arm(0.104, 0.006, 0xf2c040)); this.sunPtr.position.set(FRONT_C.x, FRONT_C.y, 0.083);
    const sunDisk = new THREE.Mesh(new THREE.CircleGeometry(0.011, 16), new THREE.MeshBasicMaterial({ color: 0xffd24a })); sunDisk.position.set(0, 0.08, 0.003); this.sunPtr.add(sunDisk);
    this.moonPtr = new THREE.Group(); this.moonPtr.add(arm(0.07, 0.005, 0xc8ccd4)); this.moonPtr.position.set(FRONT_C.x, FRONT_C.y, 0.088);
    const ballTex = canvasTex(64, 32, (g, w, h) => { g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, w / 2, h); g.fillStyle = '#18161c'; g.fillRect(w / 2, 0, w / 2, h); });
    this.moonBall = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 10), new THREE.MeshBasicMaterial({ map: ballTex }));
    this.moonBall.position.set(0, 0.058, 0.012); this.moonPtr.add(this.moonBall);
    this.box.add(this.sunPtr, this.moonPtr);
    this.metPtr = new THREE.Group(); this.metPtr.position.set(MET_C.x, MET_C.y, -0.083); this.metArm = arm(1, 0.005, 0xe0b050); this.metPtr.add(this.metArm);
    this.sarPtr = new THREE.Group(); this.sarPtr.position.set(SAR_C.x, SAR_C.y, -0.083); this.sarArm = arm(1, 0.005, 0xe0b050); this.sarPtr.add(this.sarArm);
    this.sarBead = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a })); this.sarPtr.add(this.sarBead);
    this.box.add(this.metPtr, this.sarPtr);
    // the glow on the eclipse sign you reach
    this.eclGlow = new THREE.Sprite(additive(glowTex('rgba(255,230,140,1)', 'rgba(255,160,60,0)'), 0xffffff, 0)); this.eclGlow.scale.setScalar(0.07); this.box.add(this.eclGlow);
    // the handle on the side: an arm and a wooden knob
    this.crankPivot = new THREE.Group(); this.crankPivot.position.set(PLATE_W / 2 + 0.025, FRONT_C.y, 0);
    const ck = new Kit();
    ck.cyl(0.008, 0.008, 0.04, 8, 0x8a6a30, [-0.01, 0, 0], [0, 0, Math.PI / 2]);
    ck.box(0.012, 0.085, 0.02, 0xb08a40, [0.012, 0.035, 0]);
    ck.cyl(0.014, 0.014, 0.06, 10, 0x6a4020, [0.045, 0.072, 0], [0, 0, Math.PI / 2]);
    this.crankMesh = ck.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0 }));
    this.crankPivot.add(this.crankMesh); this.box.add(this.crankPivot);
    this.knob = new THREE.Object3D(); this.knob.position.set(0.045, 0.072, 0); this.crankPivot.add(this.knob);
    this.knobGlow = new THREE.Sprite(additive(glowTex('rgba(255,230,160,1)', 'rgba(255,190,90,0)'), 0xffffff, 0)); this.knobGlow.scale.setScalar(0.14); this.knob.add(this.knobGlow);

    // --- The eclipse, shown above the machine when you find one: the Moon slides over the Sun
    this.eclipseFx = new THREE.Group(); this.eclipseFx.position.copy(this.floatPos).add(_a.set(0, 0.62, 0)); this.eclipseFx.visible = false;
    this.corona = new THREE.Sprite(additive(glowTex('rgba(255,250,230,1)', 'rgba(255,200,120,0)'), 0xffffff, 0)); this.corona.scale.setScalar(0.5);
    this.eclSun = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, fog: false }));
    this.eclMoon = new THREE.Mesh(new THREE.CircleGeometry(0.104, 32), new THREE.MeshBasicMaterial({ color: 0x050608, transparent: true, opacity: 0, fog: false }));
    this.eclMoon.position.z = 0.002; this.eclipseFx.add(this.corona, this.eclSun, this.eclMoon); S.add(this.eclipseFx);

    // --- The sky the machine holds: rings around you with the Sun, Moon and planets going round
    this.holo = new THREE.Group(); this.holo.position.copy(this.floatPos); this.holo.visible = false; S.add(this.holo);
    const hm = (col) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.holoMats = [];
    this.orbits = [];
    const ORB = [[0.4, 0xc0c8d8, 0.06, 'Moon', 4], [0.62, 0xe0d0a0, 0.03, 'Mercury', 1.6], [0.84, 0xfff0c0, 0.035, 'Venus', 1.2], [1.1, 0xffd060, 0.1, 'Sun', 0.8], [1.36, 0xff8a5a, 0.035, 'Mars', 0.45], [1.6, 0xffe0b0, 0.05, 'Jupiter', 0.2], [1.84, 0xe8d8a0, 0.045, 'Saturn', 0.1]];
    for (const [R, col, size, , speed] of ORB) {
      const ringM = hm(col); this.holoMats.push(ringM);
      const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.004, R + 0.004, 96), ringM); ring.rotation.x = -Math.PI / 2;
      const ballM = additive(glowTex(), col, 0); this.holoMats.push(ballM);
      const ball = new THREE.Sprite(ballM); ball.scale.setScalar(size * 2.2);
      const piv = new THREE.Group(); piv.add(ball); ball.position.x = R; piv.rotation.y = R * 7;
      this.holo.add(ring, piv); this.orbits.push({ piv, speed });
    }
    // the zodiac all round: twelve little star groups on the outside
    const zp = [], zr = rng(12);
    for (let i = 0; i < 12; i++) for (let j = 0; j < 6; j++) { const a = (i + 0.2 + zr() * 0.6) / 12 * TAU; zp.push(Math.cos(a) * (2.15 + zr() * 0.2), (zr() - 0.5) * 0.3, Math.sin(a) * (2.15 + zr() * 0.2)); }
    const zg = new THREE.BufferGeometry(); zg.setAttribute('position', new THREE.Float32BufferAttribute(zp, 3));
    const zm = new THREE.PointsMaterial({ color: 0xfff4d0, size: 0.035, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.holoMats.push(zm); this.holo.add(new THREE.Points(zg, zm));
  }

  buildJournal() {
    const tex = canvasTex(1024, 720, drawJournal);
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46 * 720 / 1024), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false }));
    this.journal = new THREE.Group(); this.journal.add(page); this.journal.visible = false; this.root.add(this.journal);
    // a glowing ring on the ground: "stand here"
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.set(STAND.x, seabedHeight(STAND.x, STAND.z) + 0.05, STAND.z);
    this.sea.add(this.ring);
  }

  // ======================= Things you can grab =======================
  registerInteractables() {
    const G = this.G, self = this;
    this.lumpIt = {
      hint: 'Squeeze GRIP to pick up the lump of bronze',
      deskHint: 'Click and hold on the lump to pick it up',
      get disabled() { return self.s.scene !== 'sea' || !(self.s.phase === 'lump' || self.s.phase === 'closer'); },
      reach(pos) { return Math.max(0, pos.distanceTo(self.lump.position) - 0.1); },
      aim(o, d) { _b.copy(self.lump.position).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.16 ? t : Infinity; },
      onGrab(h) { self.holdHand = h; G.act({ type: 'lift' }); G.audio.tick(self.lump.position); },
      onRelease(h) { if (self.holdHand === h) self.holdHand = null; },
    };
    this.crankIt = {
      hint: 'Squeeze GRIP on the handle, then turn it round and round',
      deskHint: 'Hold the mouse button on the handle and move the mouse in circles (or tap E)',
      get disabled() { return !(self.s.phase === 'crank' || self.s.phase === 'eclipse') || self.s.build < 1; },
      reach(pos) { self.knob.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.04); },
      aim(o, d) { self.crankPivot.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.13 ? t : Infinity; },
      onGrab(h) { h.crankA = self.handAngle(h.pos); self.cranking = h; },
      onHold(h) {
        const a = self.handAngle(h.pos), da = angleWrap(a - h.crankA);
        if (Math.abs(da) > 0.004 && Math.abs(da) < 2.5) { G.act({ type: 'crank', amount: da / TAU }); h.crankA = a; }
        else if (Math.abs(da) >= 2.5) h.crankA = a;
      },
      onRelease(h) { if (self.cranking === h) self.cranking = null; },
      onMouse(h, dx, dy) { const amt = (dx + dy) * 0.0025; if (amt) G.act({ type: 'crank', amount: clamp(amt, -0.2, 0.2) }); },
      onKey() { G.act({ type: 'crank', amount: 0.25 }); },
    };
    this.pageIt = {
      hint: 'Touch the journal page (TRIGGER or GRIP)',
      deskHint: 'Click the journal page',
      get disabled() { return self.s.journal !== 1; },
      reach(pos) { self.journal.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.22); },
      aim(o, d) { self.journal.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.3 ? t : Infinity; },
      onTouch() { G.act({ type: 'touchPage' }); },
      onGrab() { G.act({ type: 'touchPage' }); },
    };
    G.interactables.push(this.lumpIt, this.crankIt, this.pageIt);
  }

  // The angle of a hand around the handle's axle (the axle runs along the machine's sideways axis)
  handAngle(p) {
    _a.copy(p); this.box.worldToLocal(_a);
    return Math.atan2(_a.z - this.crankPivot.position.z, _a.y - this.crankPivot.position.y);
  }

  // ---------- Actions from any player (run on the host) ----------
  act(a) {
    const s = this.s;
    if (a.type === 'lift' && s.lump === 0 && (s.phase === 'lump' || s.phase === 'closer')) { s.lump = 1; return true; }
    if (a.type === 'crank' && (s.phase === 'crank' || s.phase === 'eclipse') && s.build >= 1) { s.crank = Math.max(0, s.crank + a.amount * MONTHS_PER_TURN); return true; }
    if (a.type === 'touchPage' && s.journal === 1) { s.journal = 2; return true; }
    return false;
  }

  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ======================= The story (host only) =======================
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    const placeAll = (pos, yaw) => G.events.emit('placePlayers', { x: pos.x, z: pos.z, yaw });
    const hint = (it, secs = 7) => D.hint(G.mode === 'desktop' ? it.deskHint : it.hint, secs);
    const near = (spot, d) => G.players.every((p) => { p.headPos?.(_a) ?? _a.copy(p.view?.head || spot); return Math.hypot(_a.x - spot.x, _a.z - spot.z) < d; });
    // On the boat, after the storm. The diver is getting ready at the ladder.
    s.scene = 'top'; s.phase = 'boat';
    placeAll(START_TOP, faceToward(START_TOP, new THREE.Vector3(2, 0, 0.3)));
    await G.ui.fadeIn(2.5);
    const line1 = D.sayAsync('ch6_01');
    await D.cue('One diver'); s.phase = 'dive';        // he climbs down the ladder and is gone...
    await D.cue('comes back up'); s.surf = 1;          // ...then bursts back up, waving and shouting; the crew gasp
    await line1;
    await D.wait(fast ? 0.3 : 2);
    // Follow him down (a fade, not a fall)
    await G.ui.fadeOut(1.4);
    s.scene = 'sea'; s.phase = 'seabed';
    placeAll(START_SEA, faceToward(START_SEA, STATUE.clone().add(new THREE.Vector3(1.5, 0, 0))));
    await D.wait(0.4);
    await G.ui.fadeIn(2.5);
    s.guide = [STATUE.x + 0.5, seabedHeight(STATUE.x, STATUE.z) + 1.3, STATUE.z + 0.8]; s.point = 1;
    await D.say('ch6_02');
    s.point = 0; s.ghost = 1; s.guide = [WRECK.x - 1, 3.2, WRECK.z + 4];
    await D.say('ch6_03');
    s.ghost = 0;
    // The lump of bronze on the flat rock
    s.phase = 'lump'; s.ring = D.kids ? 0 : 1; s.point = 2;
    s.guide = [ROCK.x - 0.55, this.rockTop + 0.55, ROCK.z - 0.1];
    await D.say('ch6_04');
    hint(this.lumpIt, 8);
    if (D.kids) { await D.wait(fast ? 0.2 : 1); await D.goTo(STAND, 0); await D.wait(fast ? 0.2 : 1.5); s.lump = 1; }   // Kids mode: the diver lifts it for you
    const got = await D.until(() => s.lump >= 1, fast ? 15 : 40);
    if (!got) {
      // Nobody picked it up: bring everyone to the rock and lift it for them
      if (!near(STAND, 1.6)) { await G.ui.fadeOut(0.8); placeAll(STAND, 0); await G.ui.fadeIn(1); }
      s.lump = 1;
    }
    s.ring = 0; s.point = 0; G.ui.showHint('');
    s.phase = 'closer'; s.glint = 1;
    await D.say('ch6_05');
    // X-rays see inside; the gears fly out and build the machine over the rock
    if (!near(STAND, 2.5)) { await G.ui.fadeOut(0.8); placeAll(STAND, 0); await G.ui.fadeIn(1); }
    s.lump = 2; s.glint = 0; s.phase = 'xray';
    s.guide = [ROCK.x - 0.7, this.rockTop + 0.9, ROCK.z + 0.1];
    await D.say('ch6_06');
    await D.until(() => s.build >= 1, 12);
    s.build = 1;
    // Turn the handle
    s.phase = 'crank'; s.ring = D.kids ? 0 : 1;
    s.guide = [ROCK.x - 0.6, this.rockTop + 0.95, ROCK.z + 0.05];
    hint(this.crankIt, 8);
    await D.say('ch6_07');
    s.flip = 1;
    s.phase = 'eclipse';
    D.hint('Keep turning the handle until the pointer reaches an eclipse sign', 8);
    await D.until(() => s.eclipse > 0, 120);
    s.eclipse = 1; s.ring = 0; G.ui.showHint('');
    G.events.emit('sfx', { k: 'swell' });
    await D.wait(fast ? 0.5 : 4);
    // Everything people knew about the sky, in a box you could hold
    s.phase = 'closing'; s.holo = 1; s.guide = null;
    await D.say('ch6_08');
    s.holo = 2;
    await D.wait(fast ? 0.3 : 2);
    s.journal = 1; s.phase = 'journal';
    G.events.emit('sfx', { k: 'page' });
    hint(this.pageIt, 8);
    await D.auto(() => s.journal === 2, () => this.act({ type: 'touchPage' }), { after: fast ? 0.5 : 4 });
    G.ui.showHint('');
    G.events.emit('sfx', { k: 'page' });
    await D.wait(1.2);
    s.phase = 'done';
  }

  // ======================= Switching between the boat and the seafloor =======================
  applyScene(name) {
    const G = this.G;
    this.sceneNow = name;
    const sea = name === 'sea';
    this.top.visible = !sea; this.sea.visible = sea;
    if (G.sky.group) G.sky.group.visible = !sea;
    if (sea) {
      if (!this.savedFog) this.savedFog = G.scene.fog;
      G.scene.fog = this.waterFog;
      G.world.height = seabedHeight; G.world.bounds = 22; G.world.blockers = this.seaBlk;
      G.audio.amb = 0;
      // Blue-green light from above; the sky's own lights are re-set by the next chapter
      G.sky.hemi.color.setHex(0x8fdcf0); G.sky.hemi.groundColor.setHex(0x1a3a46); G.sky.hemi.intensity = 0.95;
      G.sky.sunLight.color.setHex(0xc8f0ff); G.sky.sunLight.intensity = 1.5; G.sky.sunLight.position.set(6, 40, 8);
    } else {
      if (this.savedFog) { G.scene.fog = this.savedFog; this.savedFog = null; }
      G.world.height = () => DECK; G.world.bounds = 1.3; G.world.blockers = this.topBlk;
      G.sky.fogFar = 1500; G.sky.mist = 0.22; G.sky.sunSize = 1;
      G.sky.set(235, 24);
      G.audio.amb = 0.8;
    }
  }

  // ======================= Every frame, every headset =======================
  update(dt, t) {
    const G = this.G, s = this.s, host = G.isHost, fast = G.params.has('fast') ? 4 : 1;
    this.uTime.value += dt;
    if (s.scene !== this.sceneNow) this.applyScene(s.scene);
    // ---- Host-side timelines
    if (host) {
      this.clock += dt;
      if (s.phase !== this.lastPhase) { this.lastPhase = s.phase; this.phaseT = 0; }
      this.phaseT += dt * fast;
      const T = this.phaseT;
      if (s.phase === 'dive') s.dive = Math.min(1, s.dive + dt / 6 * fast);
      if (s.phase === 'xray') { s.xray = clamp((T - 2.5) / 2.5, 0, 1); s.build = clamp((T - 7) / 4.5, 0, 1); }
      if (s.phase === 'crank' && T > 13.2) s.flip = 1;
      if (s.phase === 'crank' && G.kids && T > 2 && s.build >= 1 && !this.cranking) s.crank += dt * 0.5;     // "And on the back..."
      if (s.phase === 'eclipse') {
        // after a while the handle turns itself, so nobody gets stuck
        // (Kids mode: it turns by itself straight away)
        if (T > (G.kids ? 1 : 30) && !this.cranking) s.crank += dt * 0.7;
        const m0 = this.prevCrank ?? s.crank;
        if (!s.eclipse) for (const m of ECLIPSES) if ((m0 < m && s.crank >= m) || (m0 > m && s.crank <= m)) { s.eclipse = 1; s.eclM = m; break; }
      }
      this.prevCrank = s.crank;
    }
    if (this.sceneNow === 'top') this.updateTop(dt, t); else this.updateSea(dt, t);
    // Astra: hover where the story wants, or out in front of you
    if (s.guide) { _a.fromArray(s.guide); if (!this.guideAt || !this.guideAt.equals(_a)) { this.guideAt = _a.clone(); G.guide.flyTo(this.guideAt); G.guide.chime(); } }
    else if (this.guideAt && s.journal !== 1) { this.guideAt = null; G.guide.follow(); }
    // The journal page floats in front of you, held up by Astra
    this.journal.visible = s.journal === 1;
    if (s.journal === 1) {
      G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize();
      if (!this.pageSet) { this.pageSet = true; this.journal.position.copy(_a).addScaledVector(_b, 0.62); this.journal.position.y -= 0.2; }
      this.journal.lookAt(_a);
      G.guide.flyTo(_c.copy(this.journal.position).add(_b.set(-_b.z * 0.4, 0.12, _b.x * 0.4)), _a);
      this.guideAt = this.guideAt || _c.clone();
    }
  }

  updateTop(dt, t) {
    const G = this.G, s = this.s;
    // The diver: faces you, then turns to the ladder and climbs down into the sea
    const D = this.diverTop, k = s.dive;
    if (k <= 0) { D.g.position.set(1.0, DECK + 0.015, 0.35); D.g.rotation.y = turnToward(D.g.position, START_TOP); D.pose = 'idle'; }
    else {
      const step = ease(clamp(k / 0.25, 0, 1)), down = ease(clamp((k - 0.25) / 0.75, 0, 1));
      D.g.position.set(lerp(1.0, 1.55, step) + down * 0.3, lerp(DECK + 0.015, -2.6, down), lerp(0.35, 0.25, step));
      D.g.rotation.y = lerp(turnToward(_a.set(1, 0, 0.35), START_TOP), -Math.PI / 2, step); // back to the sea, climbing down the ladder facing the boat
      D.pose = down > 0 ? 'pull' : 'idle';
    }
    // ...and back up again, shouting about people on the seafloor
    this.surfV = damp(this.surfV || 0, s.surf ? 1 : 0, 2.5, dt);
    if (s.surf) { D.g.position.set(1.95, lerp(-2.6, DECK - 0.55, this.surfV), 0.25); D.g.rotation.y = -Math.PI / 2; D.pose = 'wave'; }
    D.g.visible = D.g.position.y > -2.4;
    animatePerson(D, t, dt);
    // gulls over the boat, dolphins out at sea
    if (!this.topLife) {
      this.topLife = new Life(this.top);
      this.topLife.add(makeFlock({ n: 7, center: new THREE.Vector3(4, 16, -10), r: 18, height: 5, color: 0xf0f0f0, size: 1.1, speed: 6, seed: 61 }));
      this.topLife.add(makeDolphins({ n: 4, center: new THREE.Vector3(0, 0, 0), r: 46, sea: 0, seed: 62 }));
    }
    this.topLife.update(dt, t);
    // the crew turn the pump wheels once he's going down
    const pumping = k > 0.2;
    for (const w of this.wheels) w.rotation.x += dt * (pumping ? 2.4 : 0);
    for (const P of this.crew) { P.pose = s.surf && this.surfV > 0.5 ? 'gasp' : pumping ? 'pull' : 'idle'; P.look = s.surf ? D.g.position : null; P.glance = true; animatePerson(P, t, dt); }
    this.surfaceBubbles.material.uniforms.opacity.value = damp(this.surfaceBubbles.material.uniforms.opacity.value, k > 0.7 ? 0.8 : 0, 2, dt);
    // waves lapping on the hull, a gull now and then
    if (G.audio.ok) {
      this.lapT = (this.lapT ?? 1) - dt;
      if (this.lapT <= 0) { this.lapT = 1.6 + Math.random() * 2.2; const o = G.audio.out(_a.set((Math.random() - 0.5) * 4, 0.2, (Math.random() - 0.5) * 8), 0.5, 3); G.audio.noise(o, { f: 700, f2: 180, peak: 0.25, a: 0.35, d: 1.1 }); }
      this.gullT = (this.gullT ?? 4) - dt;
      if (this.gullT <= 0) { this.gullT = 5 + Math.random() * 9; const o = G.audio.out(_a.set((Math.random() - 0.5) * 80, 25, -20 - Math.random() * 60), 0.25, 8); for (let i = 0; i < 3; i++) G.audio.tone(o, { type: 'sawtooth', f: 1500 - i * 80, f2: 900, peak: 0.06, a: 0.03, d: 0.28, t0: i * 0.32 }); }
    }
  }

  updateSea(dt, t) {
    const G = this.G, s = this.s;
    G.camera.getWorldPosition(_c);
    this.dome.position.copy(_c);
    this.snow.material.uniforms.origin.value.copy(_c);
    this.finishStatues();
    this.updateFish(t);
    this.rays.material.opacity = 0.075 + 0.025 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1);
    // The diver points (at the statues, then at the lump), otherwise stands and breathes
    const D = this.diver, target = s.point === 2 || s.phase !== 'seabed' ? ROCK : STATUE;
    D.g.rotation.y = damp(D.g.rotation.y, turnToward(DIVER, target), 1.5, dt);
    D.pose = s.point ? 'point' : 'idle';
    D.pointAt.set(target.x, (s.point === 2 ? this.rockTop : seabedHeight(target.x, target.z) + 0.3), target.z);
    animatePerson(D, t, dt);
    // The ghost ship
    this.ghostV = damp(this.ghostV || 0, s.ghost, 1.2, dt);
    this.ghost.visible = this.ghostV > 0.01;
    this.ghostMats[0].opacity = this.ghostV * (0.07 + 0.02 * Math.sin(t * 2)); this.ghostMats[1].opacity = this.ghostV * 0.35;
    this.ghost.position.y = 3.2 + Math.sin(t * 0.5) * 0.15;
    // Stand-here ring
    this.ringV = damp(this.ringV || 0, s.ring, 3, dt);
    this.ring.visible = this.ringV > 0.01;
    this.ring.material.opacity = this.ringV * (0.55 + 0.25 * Math.sin(t * 3));
    this.updateLump(dt, t);
    this.updateMachine(dt, t);
    this.updateSounds(dt, t);
  }

  updateLump(dt, t) {
    const G = this.G, s = this.s, L = this.lump;
    // let go of it once the X-ray starts
    if (s.lump === 2 && this.holdHand) { for (const h of [...G.player.hands, G.player.deskHand]) if (h.held === this.lumpIt) G.player.release(h); this.holdHand = null; }
    if (s.lump === 0) { L.position.copy(this.lumpRest); L.quaternion.copy(this.lumpQRest); }
    else if (this.holdHand && s.lump === 1) {
      // in your hand (on desktop: in front of your eyes), turned so the wheel faces you
      L.position.lerp(this.holdHand.pos, 1 - Math.exp(-dt * 20));
      G.camera.getWorldPosition(_a); _m.lookAt(_a, L.position, _b.set(0, 1, 0)); _q.setFromRotationMatrix(_m);
      L.quaternion.slerp(_q, 1 - Math.exp(-dt * 8));
    } else {
      // floating just above the rock, turning slowly
      _a.copy(this.floatPos); _a.y += s.lump === 1 ? -0.05 + Math.sin(t * 1.3) * 0.02 : 0;
      L.position.lerp(_a, 1 - Math.exp(-dt * 2));
      G.camera.getWorldPosition(_b); _m.lookAt(_b, L.position, _c.set(0, 1, 0)); _q.setFromRotationMatrix(_m);
      if (s.lump === 1) _q.multiply(_q2.setFromAxisAngle(_c.set(0, 1, 0), Math.sin(t * 0.6) * 0.5));
      L.quaternion.slerp(_q, 1 - Math.exp(-dt * 2));
    }
    // a soft glow showing where it is, until you pick it up
    const findMe = (s.phase === 'lump' && s.lump === 0) ? 1 : 0;
    this.lumpGlowV = damp(this.lumpGlowV || 0, findMe, 2, dt);
    this.lumpGlow.position.copy(L.position); this.lumpGlow.material.opacity = this.lumpGlowV * (0.5 + 0.3 * Math.sin(t * 3));
    this.lumpGlow.visible = this.lumpGlowV > 0.01;
    // "Look closer": the gear teeth catch the light
    this.glintV = damp(this.glintV || 0, s.glint, 2, dt);
    this.lumpGearMat.emissive.setRGB(0.9, 0.62, 0.2).multiplyScalar(this.glintV * (0.35 + 0.3 * Math.sin(t * 4)));
    // X-ray: the crust turns see-through and the gears inside light up; then the lump melts away
    const xr = this.xrV = damp(this.xrV || 0, s.xray, 3, dt), bd = s.build;
    this.lumpMat.opacity = Math.max(0, (1 - xr * 0.8) * (1 - clamp(bd * 3, 0, 1)));
    this.lumpMat.emissive.setRGB(0.1, 0.45, 0.55).multiplyScalar(xr);
    this.lumpGearMat.opacity = this.lumpMat.opacity;
    this.lumpMat.depthWrite = xr < 0.1;
    L.visible = this.lumpMat.opacity > 0.01;
  }

  updateMachine(dt, t) {
    const G = this.G, s = this.s;
    const xr = this.xrV || 0, bd = this.bdV = damp(this.bdV || 0, s.build, 6, dt);
    this.box.visible = xr > 0.02 || bd > 0;
    if (!this.box.visible) return;
    // The box faces you over the rock (and turns round to show its back)
    this.flipV = damp(this.flipV || 0, s.flip, 1.6, dt);
    this.box.rotation.y = Math.PI * ease(this.flipV);
    this.box.position.copy(this.floatPos); this.box.position.y += Math.sin(t * 0.9) * 0.006;
    // Gears: inside the lump (X-ray), then flying out to their places
    this.crankV = damp(this.crankV ?? s.crank, s.crank, 12, dt);
    const turns = this.crankV;
    for (const g of this.gears) {
      const k = ease(clamp((bd - g.delay * 0.6) / 0.6, 0, 1));
      g.m.position.lerpVectors(g.from, g.to, k);
      _q.setFromAxisAngle(_a.set(0, 0, 1), turns * TAU * g.speed);
      g.m.quaternion.copy(g.fromQ).slerp(_q, k);
      g.m.scale.setScalar(lerp(g.fromS, 1, k));
      g.m.visible = xr > 0.05 || bd > 0;
    }
    // in the X-ray the gears glow blue; once built they're plain bronze
    this.gearXMat.opacity = xr * (1 - bd) * 0.8;
    this.gearMat.emissive.setRGB(0.05, 0.25, 0.3).multiplyScalar(xr * (1 - bd));
    // the case and dials fade in at the end of the build
    const caseK = clamp((bd - 0.75) / 0.25, 0, 1);
    this.caseMat.opacity = caseK; this.caseMat.transparent = caseK < 1; this.caseMat.depthWrite = caseK > 0.5;
    this.glassMat.opacity = caseK * 0.12;
    for (const m of this.plateMats) { m.opacity = caseK; m.transparent = caseK < 1; }
    this.crankMesh.material.opacity = caseK; this.crankMesh.material.transparent = caseK < 1;
    for (const o of [this.sunPtr, this.moonPtr, this.metPtr, this.sarPtr]) o.visible = caseK > 0.5;
    // Dials: one turn of the handle is one month
    const days = turns * MONTHS_PER_TURN * 29.53;
    this.sunPtr.rotation.z = -(days / 365.25) * TAU;
    this.moonPtr.rotation.z = -(days / 27.32) * TAU;
    this.moonBall.rotation.y = -(turns * MONTHS_PER_TURN % 1) * TAU + Math.PI / 2;
    const m = turns * MONTHS_PER_TURN;
    this.crankPivot.rotation.x = turns * TAU;
    const sm = m % SAROS, mm = m % METONIC;
    this.sarPtr.rotation.z = sarosA(sm); this.sarArm.scale.y = sarosR(sm) + 0.01; this.sarBead.position.y = sarosR(sm);
    this.metPtr.rotation.z = metonicA(mm); this.metArm.scale.y = metonicR(mm) + 0.01;
    // A click from the gears for every eighth of a turn
    const tick = Math.floor(turns * 8);
    if (this.lastTick != null && tick !== this.lastTick && G.audio.ok) G.audio.tick(this.box.position);
    this.lastTick = tick;
    // Where to grab: the knob glows
    const grabMe = (s.phase === 'crank' || s.phase === 'eclipse') && bd >= 1 && !this.cranking ? 1 : 0;
    this.knobV = damp(this.knobV || 0, grabMe, 3, dt);
    this.knobGlow.material.opacity = this.knobV * (0.45 + 0.3 * Math.sin(t * 3.5));
    this.knobGlow.visible = this.knobV > 0.01;
    // The eclipse you found: its sign lights up, and above the machine the Moon covers the Sun
    this.eclV = damp(this.eclV || 0, s.eclipse && s.phase === 'eclipse' ? 1 : 0, 1.5, dt);
    if (s.eclM >= 0) { const a = sarosA(s.eclM), rr = sarosR(s.eclM); this.eclGlow.position.set(SAR_C.x - Math.sin(a) * rr, SAR_C.y + Math.cos(a) * rr, -0.09); }
    this.eclGlow.material.opacity = this.eclV * (0.7 + 0.3 * Math.sin(t * 5));
    this.eclGlow.visible = this.eclV > 0.01;
    this.eclipseFx.visible = this.eclV > 0.01;
    if (this.eclipseFx.visible) {
      G.camera.getWorldPosition(_a); this.eclipseFx.lookAt(_a);
      this.eclSlide = s.eclipse ? Math.min(1, (this.eclSlide || 0) + dt / 2) : 0;
      this.eclMoon.position.x = (1 - ease(this.eclSlide)) * 0.24;
      this.eclSun.material.opacity = this.eclV; this.eclMoon.material.opacity = this.eclV;
      this.corona.material.opacity = this.eclV * (0.25 + 0.75 * ease((this.eclSlide - 0.7) / 0.3));
      this.corona.scale.setScalar(0.42 + 0.2 * ease((this.eclSlide - 0.7) / 0.3));
    }
    if (s.eclipse && !this.eclSfx) { this.eclSfx = true; G.audio.chime(this.box.position, 0.5); }
    // The sky the machine holds, all around you, then gathered back into the box
    const hv = this.holoV = damp(this.holoV || 0, s.holo === 1 ? 1 : 0, s.holo === 2 ? 1.2 : 0.8, dt);
    this.holo.visible = hv > 0.01;
    if (this.holo.visible) {
      const k = s.holo === 2 ? hv : 1;
      this.holo.scale.setScalar(lerp(0.08, 1, ease(k)));
      this.holo.position.copy(this.floatPos).add(_a.set(0, lerp(0, 0.55, ease(k)), 0));
      for (const o of this.orbits) o.piv.rotation.y += dt * o.speed * 0.6;
      for (const mat of this.holoMats) mat.opacity = hv * (mat.isPointsMaterial ? 0.9 : mat.isSpriteMaterial ? 0.95 : 0.3);
    }
  }

  updateSounds(dt, t) {
    const G = this.G, A = G.audio;
    if (!A.ok) return;
    // the deep hush of the water (a low rumble), started once sound is on
    if (!this.hush) {
      const c = A.ctx, src = c.createBufferSource(); src.buffer = A.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
      const g = c.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(A.master); src.start();
      this.hush = { src, g };
    }
    this.hush.g.gain.setTargetAtTime(this.sceneNow === 'sea' ? 0.16 : 0, A.ctx.currentTime, 0.5);
    // the diver breathing out: a burst of bubbles
    this.breathT = (this.breathT ?? 2) - dt;
    if (this.breathT <= 0) {
      this.breathT = 3.5 + Math.random() * 1.5;
      const o = A.out(_a.copy(this.bubbles.material.uniforms.origin.value), 0.5, 2);
      for (let i = 0; i < 7; i++) A.tone(o, { f: 280 + Math.random() * 300, f2: 700 + Math.random() * 500, peak: 0.08, a: 0.005, d: 0.06, t0: i * (0.05 + Math.random() * 0.06) });
    }
  }

  dispose() {
    const G = this.G;
    G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    if (this.savedFog) { G.scene.fog = this.savedFog; this.savedFog = null; }
    if (G.sky.group) G.sky.group.visible = true;
    G.sky.mist = 0;
    if (this.hush) { try { this.hush.src.stop(); } catch (e) { /* already stopped */ } this.hush = null; }
    G.world.blockers = [];
  }
}
