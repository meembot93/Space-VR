// Chapter 7: Ptolemy's spinning sky. Alexandria, Egypt, about 150 AD. The finale of Era 1.
//
// You arrive in a great hall of scrolls, sunlight slanting in through high windows. In the middle
// stands a brass model of the heavens, and beside it Claudius Ptolemy at his table. His scroll
// (the Almagest) unrolls; touch it and the hall goes dark: you are standing on a small Earth in
// the middle of the universe as Ptolemy saw it, with the Moon, Sun, planets and stars each riding
// a see-through crystal sphere around you.
//
// Then: grip and follow Mars across the stars (it stops and loops backward), watch Ptolemy's fix
// (a small circle riding on a big circle) trace the very same loop, see the whole model run like
// clockwork, and finally hear a quiet voice from the shadows, Aristarchus: "What if the Sun is in
// the middle?" The crystal spheres fade, the lights come up, and Astra hands you the last
// journal page of Era 1.
//
// The Mars path is the real geometry: Earth and Mars going round the Sun on circles (1 year and
// 1.88 years), seen from Earth. Ptolemy's big circle + small circle adds up to exactly the same
// thing, which is why his model worked. (Mars's tilt is exaggerated a little so the loop shows.)
//
// World axes: -Z is north, +X is east, +Y is up. The hall runs north-south; you enter at the
// south end. The cosmos is centred on the same spot, shown instead of the hall.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson } from '../people.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';

const D2R = Math.PI / 180;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---------- The hall ----------
const HW = 8.5;            // half the hall's width (x)
const HL = 15;             // half its length (z)
const HH = 10.5;           // height to the ceiling
const SHELF_TOP = 4.6;     // the scroll cabinets reach this high
const START = new THREE.Vector3(0, 0, 11.5);
const SPOT = new THREE.Vector3(0, 0, -3.3);       // stand here, in front of Ptolemy's table
const TABLE = new THREE.Vector3(0, 0, -4.6);
const ARMILLARY = new THREE.Vector3(0, 0, -9.2);

// ---------- The cosmos ----------
const EYE = 1.6;           // the cosmos is centred on your eyes
const GLOBE_R = 6;         // the little Earth you stand on
const TILT = 24;           // the planets' road (the ecliptic) rises this many degrees in front of you
// Ptolemy's order, from the Earth outward. r = radius of the crystal sphere (m), size of the body,
// speed = how fast it goes round in the clockwork (made-up but in the right order), lam = start.
const BODIES = [
  { k: 'moon', name: 'Moon', r: 7.5, size: 0.42, col: 0xdfe4ee, glow: 'rgba(220,230,255,1)', speed: 0.5, lam: -70 },
  { k: 'mercury', name: 'Mercury', r: 9, size: 0.2, col: 0xc8b8a0, glow: 'rgba(255,240,210,1)', speed: 0.36, lam: 52 },
  { k: 'venus', name: 'Venus', r: 10.5, size: 0.28, col: 0xfff2c8, glow: 'rgba(255,250,220,1)', speed: 0.3, lam: 30 },
  { k: 'sun', name: 'Sun', r: 12, size: 0.95, col: 0xffd060, glow: 'rgba(255,220,120,1)', speed: 0.24, lam: 12 },
  { k: 'mars', name: 'Mars', r: 14, size: 0.32, col: 0xd8563a, glow: 'rgba(255,120,80,1)', speed: 0.17, lam: -22 },
  { k: 'jupiter', name: 'Jupiter', r: 16, size: 0.55, col: 0xe8c89a, glow: 'rgba(255,230,190,1)', speed: 0.1, lam: -44 },
  { k: 'saturn', name: 'Saturn', r: 18, size: 0.45, col: 0xe2cf90, glow: 'rgba(255,235,170,1)', speed: 0.06, lam: 64 },
];
const STARS_R = 20.5;      // the outermost sphere: the fixed stars
const MARS = BODIES[4];
// Mars's real path, from Earth: Earth's orbit 1 AU / 1 year, Mars 1.524 AU / 1.881 years
const T0 = -0.42, T1 = 0.42;       // the stretch of time we follow (years, 0 = Mars opposite the Sun)
const INC = 4.2 * D2R, NODE = -40 * D2R; // Mars's tilt (exaggerated about 2x so the loop shows)
const MARS_LAM0 = -4;              // where the loop sits in the sky (degrees along the ecliptic)
const SCALE = 3.1;                 // metres per AU for the see-through Ptolemy machine
const NPATH = 220;

// Earth and Mars around the Sun (ecliptic coordinates: x, y in the plane, z north), in AU
function earthAt(t, out) { const a = 2 * Math.PI * t; return out.set(Math.cos(a), Math.sin(a), 0); }
function marsAt(t, out) { const a = 2 * Math.PI * t / 1.881; return out.set(1.524 * Math.cos(a), 1.524 * Math.sin(a), 1.524 * Math.sin(INC) * Math.sin(a - NODE)); }

// A direction from the ecliptic (longitude lam, latitude bet, degrees) to the world, around your eyes
function eclDir(lam, bet, out = new THREE.Vector3()) {
  const l = lam * D2R, b = bet * D2R, t = TILT * D2R;
  const x = Math.sin(l) * Math.cos(b), y = Math.sin(b), z = -Math.cos(l) * Math.cos(b);
  return out.set(x, y * Math.cos(t) - z * Math.sin(t), y * Math.sin(t) + z * Math.cos(t));
}
// An ecliptic-coordinate vector (AU, as from earthAt/marsAt) into world space (no offset)
function eclVec(v, out) {
  // ecliptic x axis = longitude 0 (straight ahead), y = longitude 90 (to the right), z = north pole
  const l0 = MARS_LAM0 * D2R, c = Math.cos(l0), s = Math.sin(l0);
  const x = v.x * c - v.y * s, y = v.x * s + v.y * c;          // turn so Mars's loop sits ahead of you
  const lx = y, ly = v.z, lz = -x, t = TILT * D2R;
  return out.set(lx, ly * Math.cos(t) - lz * Math.sin(t), ly * Math.sin(t) + lz * Math.cos(t));
}
const _e = new THREE.Vector3(), _mv = new THREE.Vector3();
// Where Mars appears (unit direction from your eyes) at time t
function marsDir(t, out) { marsAt(t, _mv).sub(earthAt(t, _e)); return eclVec(_mv, out).normalize(); }

function glowMat(color, add = true) {
  const t = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, color); gr.addColorStop(0.25, color.replace(/[\d.]+\)$/, '0.45)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
}

function labelSprite(text, w = 2.4, color = 'rgba(255,240,210,0.95)') {
  const t = canvasTex(512, 128, (g, W, H) => {
    g.font = 'italic bold 64px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 10; g.fillStyle = color; g.fillText(text, W / 2, H / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(w, w / 4, 1); return s;
}

// A crystal sphere: faint glass that glows at its edges (cheap: additive, no depth writes)
function crystalMat(color) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, opacity: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; uniform float opacity; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float a = (0.04 + pow(f, 3.0) * 0.55) * opacity; gl_FragColor = vec4(color * a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
  });
}

// ---------- Textures drawn in code ----------
function marbleTex() {
  const t = canvasTex(512, 512, (g, w, h) => {
    const r = rng(17);
    const tiles = [['#e9e1cf', '#d9cdb4'], ['#b98d6a', '#a77b58']];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const [a, b] = tiles[(i + j) % 2], x = i * 128, y = j * 128;
      const gr = g.createLinearGradient(x, y, x + 128, y + 128); gr.addColorStop(0, a); gr.addColorStop(1, b);
      g.fillStyle = gr; g.fillRect(x, y, 128, 128);
      g.strokeStyle = 'rgba(90,70,50,0.18)'; g.lineWidth = 1.5;
      for (let v = 0; v < 3; v++) { g.beginPath(); let px = x + r() * 128, py = y; g.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (r() - 0.5) * 50; py += 128 / 6; g.lineTo(px, py); } g.stroke(); }
      g.strokeStyle = 'rgba(60,40,25,0.5)'; g.lineWidth = 3; g.strokeRect(x, y, 128, 128);
    }
    // a border band of small dark diamonds every other tile
    g.fillStyle = 'rgba(80,50,30,0.55)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.save(); g.translate(i * 128, j * 128); g.rotate(Math.PI / 4); g.fillRect(-9, -9, 18, 18); g.restore(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(HW * 2 / 3, HL * 2 / 3); return t;
}

// The Almagest: columns of Greek, a table of numbers and a diagram of circles on circles
function almagestTex() {
  return canvasTex(1024, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#d9c393'); gr.addColorStop(0.5, '#efe0b8'); gr.addColorStop(1, '#d9c393');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = rng(5), ink = '#3a2614';
    const greek = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψω';
    g.fillStyle = ink; g.font = 'bold 42px Georgia, serif'; g.textAlign = 'center';
    g.fillText('ΜΑΘΗΜΑΤΙΚΗ ΣΥΝΤΑΞΙΣ', w / 2, 58);
    g.font = '19px Georgia, serif'; g.textAlign = 'left';
    for (const col of [40, 290]) for (let y = 100; y < h - 30; y += 24) {
      let s = ''; const n = 16 + (r() * 6 | 0); for (let i = 0; i < n; i++) s += r() < 0.18 ? ' ' : greek[r() * greek.length | 0];
      g.fillText(s, col, y);
    }
    // the diagram: Earth in the middle, a big circle, a small circle riding on it, Mars's loop
    const cx = 690, cy = 270; g.strokeStyle = ink; g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, 120, 0, 7); g.stroke();
    g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill();
    const ex = cx + Math.cos(-0.7) * 120, ey = cy + Math.sin(-0.7) * 120;
    g.beginPath(); g.arc(ex, ey, 46, 0, 7); g.stroke();
    g.setLineDash([5, 5]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#a3361e'; g.beginPath(); g.arc(ex + 46 * Math.cos(2.2), ey + 46 * Math.sin(2.2), 9, 0, 7); g.fill();
    g.strokeStyle = '#a3361e'; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 80; i++) { const t = i / 80 * 6.28; const x = 880 + i * 0.9 - Math.sin(t) * 22, y = 400 - Math.sin(t / 2) * 6 - Math.cos(t) * 16 * Math.sin(t / 2); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    // a table of numbers in the corner
    g.fillStyle = ink; g.font = '17px Georgia, serif';
    for (let y = 120; y < 230; y += 22) g.fillText(`${greek[r() * 24 | 0]}${greek[24 + (r() * 24 | 0)]}   ${greek[r() * 24 | 0]}   ${greek[24 + (r() * 24 | 0)]}${greek[24 + (r() * 24 | 0)]}`, 860, y);
    g.strokeStyle = 'rgba(58,38,20,0.4)'; g.strokeRect(850, 100, 150, 136);
    // worn edges
    g.fillStyle = 'rgba(120,80,30,0.25)'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
  });
}

// The little Earth you stand on: blue sea, and the lands Ptolemy knew, in a friendly painted style
function globeTex() {
  return canvasTex(1024, 512, (g, w, h) => {
    const sea = g.createLinearGradient(0, 0, 0, h); sea.addColorStop(0, '#2a5f8f'); sea.addColorStop(0.5, '#3b7fb0'); sea.addColorStop(1, '#2a5f8f');
    g.fillStyle = sea; g.fillRect(0, 0, w, h);
    const r = rng(77);
    const blob = (x, y, rx, ry, col, n = 18) => {
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i <= n; i++) { const a = i / n * 6.283, k = 0.75 + r() * 0.45; const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.closePath(); g.fill();
    };
    // land masses (loosely: Europe, Africa, Asia up top near where you stand, others scattered)
    const land = ['#7c9a4a', '#8fa955', '#b49a62'];
    for (let i = 0; i < 26; i++) blob(r() * w, 60 + r() * (h - 120), 30 + r() * 90, 20 + r() * 60, land[i % 3]);
    for (let i = 0; i < 60; i++) blob(r() * w, 60 + r() * (h - 120), 6 + r() * 16, 5 + r() * 12, land[i % 3], 8);
    g.fillStyle = 'rgba(240,246,255,0.9)'; g.fillRect(0, 0, w, 26); g.fillRect(0, h - 26, w, 26);
    // faint lines of latitude and longitude, like Ptolemy's maps
    g.strokeStyle = 'rgba(255,240,200,0.25)'; g.lineWidth = 2;
    for (let y = h / 12; y < h; y += h / 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x < w; x += w / 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  });
}

// The last journal page of Era 1: Ptolemy's universe, with Mars on its small circle
function drawJournal(g, w, h) {
  const gr = g.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.7);
  gr.addColorStop(0, '#f2e3bf'); gr.addColorStop(1, '#d4bb86');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(110,80,40,0.5)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
  const ink = '#3a2a18', cx = w * 0.36, cy = h * 0.56;
  g.strokeStyle = ink; g.lineWidth = 2.5;
  const rings = [42, 64, 86, 108, 134, 160, 186, 214];
  rings.forEach((R, i) => { g.globalAlpha = i === 7 ? 0.5 : 0.8; g.setLineDash(i === 7 ? [6, 6] : []); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke(); });
  g.setLineDash([]); g.globalAlpha = 1;
  g.fillStyle = '#3b7fb0'; g.beginPath(); g.arc(cx, cy, 16, 0, 7); g.fill(); g.stroke();
  const dots = [['#9aa0aa', -1.9, 7], ['#a89a80', -0.6, 5], ['#e8d8a8', 0.4, 6], ['#e0952a', 2.4, 13], ['#b5402a', -0.25, 7], ['#c9a878', 1.2, 9], ['#c8b070', -2.6, 8]];
  dots.forEach(([c, a, s], i) => {
    const R = rings[i], x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    if (i === 4) { g.strokeStyle = '#b5402a'; g.beginPath(); g.arc(x, y, 22, 0, 7); g.stroke(); g.fillStyle = c; g.beginPath(); g.arc(x + 22 * Math.cos(1), y + 22 * Math.sin(1), s, 0, 7); g.fill(); return; }
    g.fillStyle = c; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
  });
  for (let i = 0; i < 40; i++) { const a = i * 2.39, R = 214; g.fillStyle = ink; g.fillRect(cx + Math.cos(a) * R - 2, cy + Math.sin(a) * R - 2, 4, 4); }
  g.fillStyle = ink; g.font = 'italic bold 42px Georgia, serif'; g.textAlign = 'left';
  g.fillText('Ptolemy’s universe, about 150 AD', 40, 70);
  g.font = 'italic 27px Georgia, serif';
  const tx = w * 0.66;
  g.fillText('Earth still, in the middle.', tx, 200);
  g.fillText('Moon, Mercury, Venus, Sun,', tx, 240);
  g.fillText('Mars, Jupiter, Saturn,', tx, 274);
  g.fillText('then the stars.', tx, 308);
  g.fillStyle = '#8a2e1c'; g.fillText('Mars loops: a small circle', tx, 370); g.fillText('riding on a big one.', tx, 404);
  g.fillStyle = '#b5651d'; g.font = 'italic bold 28px Georgia, serif';
  g.fillText('Aristarchus asked:', tx, 492); g.fillText('“What if the Sun', tx, 528); g.fillText('is in the middle?”', tx, 562);
}

export default class Ptolemy {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.hall = new THREE.Group(); this.root.add(this.hall);
    this.cosmos = new THREE.Group(); this.cosmos.visible = false; this.root.add(this.cosmos);
    this.start = { pos: START, yaw: 0 };
    // Shared progress (sent to friends' headsets)
    this.s = {
      phase: 'arrive',  // arrive, walk, scroll, touch, spheres, follow, epicycle, clock, aristarchus, wrong, back, journal, done
      where: 'hall',    // 'hall' or 'cosmos' (which place everyone is in)
      scroll: 0,        // 0 rolled up .. 1 open on the table
      arm: 0,           // the brass model in the hall lights up
      shells: 0,        // crystal spheres showing, 0..1
      labels: 0,        // names on the spheres
      turn: 0,          // how far the spheres have turned (the clockwork)
      spin: 0.25,       // how fast they turn right now
      mt: T0,           // Mars's time along its loop (years)
      trail: 0,         // 1 = the real path is drawn up to mt
      focus: 0,         // 1 = everything but Mars dims
      epi: 0,           // the big circle + small circle machine, 0..1
      et: T0,           // the machine's own time
      arist: 0,         // Aristarchus in the shadows, 0..1
      sun: 0,           // the Sun glowing
      guide: null,      // [x, y, z] where Astra hovers, or null = beside you
      ring: 0,
      point: 0,         // Ptolemy points at his model
      journal: 0,       // 1 = the page is out, 2 = you touched it
    };
    G.sky.setPlace({ lat: 31.2, year: 150, sunLon: 0 }); // Alexandria, spring, about 150 AD
    G.sky.hideMoon?.();
    G.world.height = () => 0;
    G.world.bounds = HL - 0.6;
    G.world.blockers = [];
    G.audio.amb = 0.4;
    this.buildHall();
    this.buildArmillary();
    this.buildTable();
    this.buildPeople();
    this.buildCosmos();
    this.buildMachine();
    this.buildEffects();
    this.useHall(true);
    this.registerInteractables();
    this.tickT = 0; this.prevTurn = 0;
  }

  // ---------- Building the hall ----------
  buildHall() {
    const H = this.hall, k = new Kit(), r = rng(3);
    // Floor: polished marble tiles
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, HL * 2), new THREE.MeshLambertMaterial({ map: marbleTex() }));
    floor.rotation.x = -Math.PI / 2; H.add(floor);
    const WALL = 0xd8c8a4, WALL2 = 0xc8b48c, WOOD = 0x6e4628, WOOD2 = 0x5a3820, STONE = 0xe6dcc4, RED = 0x8a3a2a, BLUE = 0x3a5a7a;
    // Long walls: plaster below, a painted band, then piers between the high windows, then the roof
    const WIN_Y0 = 6.6, WIN_Y1 = 9.3, BAY = 3.75;
    for (const sx of [-1, 1]) {
      const x = sx * (HW + 0.25);
      k.box(0.5, WIN_Y0, HL * 2, WALL, [x, WIN_Y0 / 2, 0]);
      k.box(0.52, 0.5, HL * 2, RED, [x, SHELF_TOP + 0.55, 0]);              // a painted frieze above the cabinets
      k.box(0.53, 0.12, HL * 2, 0xd8b050, [x, SHELF_TOP + 0.85, 0]);
      for (let z = -HL; z <= HL + 0.01; z += BAY) k.box(0.5, WIN_Y1 - WIN_Y0, 1.25, WALL, [x, (WIN_Y0 + WIN_Y1) / 2, z]); // piers
      k.box(0.5, HH - WIN_Y1 + 0.4, HL * 2, WALL2, [x, (WIN_Y1 + HH + 0.4) / 2, 0]);
      // window sills
      for (let z = -HL + BAY / 2; z < HL; z += BAY) k.box(0.8, 0.12, 2.4, STONE, [x - sx * 0.2, WIN_Y0, z]);
    }
    // End walls: the far (north) wall full of cabinets, the near (south) wall with a great bronze door
    for (const sz of [-1, 1]) {
      const z = sz * (HL + 0.25);
      k.box(HW * 2 + 1, HH + 0.4, 0.5, WALL, [0, (HH + 0.4) / 2, z]);
      k.box(HW * 2 + 1, 0.5, 0.52, RED, [0, SHELF_TOP + 0.55, z]);
    }
    k.box(3.6, 5.6, 0.3, 0x7a5a2a, [0, 2.8, HL - 0.05]);                     // the door
    for (let i = 0; i < 12; i++) k.box(0.16, 0.16, 0.1, 0xc8a040, [-1.4 + (i % 4) * 0.93, 0.9 + (i / 4 | 0) * 1.9, HL - 0.2]); // studs
    k.box(4.4, 0.5, 0.5, STONE, [0, 5.85, HL - 0.1]);
    // Ceiling: coffered wood, with beams across
    k.box(HW * 2 + 1, 0.3, HL * 2 + 1, 0x4a3020, [0, HH + 0.55, 0]);
    for (let z = -HL; z <= HL; z += BAY) k.box(HW * 2, 0.5, 0.45, WOOD, [0, HH + 0.2, z]);
    for (const x of [-HW / 2, 0, HW / 2]) k.box(0.35, 0.4, HL * 2, WOOD2, [x, HH + 0.22, 0]);
    // Two rows of columns down the hall (with bases and capitals), carrying a beam
    const COLX = 5.2;
    this.colZ = [];
    for (const sx of [-1, 1]) for (let z = -HL + BAY; z < HL - 1; z += BAY) {
      const x = sx * COLX;
      k.cyl(0.46, 0.46, 0.3, 4, STONE, [x, 0.15, z], [0, Math.PI / 4, 0], [1.4, 1, 1.4]);
      k.cyl(0.42, 0.48, 0.25, 16, STONE, [x, 0.42, z]);
      k.cyl(0.34, 0.4, 6.8, 16, 0xeee4cc, [x, 4.0, z]);
      for (let f = 0; f < 8; f++) { const a = f / 8 * 6.283; k.box(0.05, 6.6, 0.05, 0xd4c8ac, [x + Math.cos(a) * 0.37, 4.0, z + Math.sin(a) * 0.37]); } // fluting
      k.cyl(0.55, 0.36, 0.5, 16, 0xe8dcc0, [x, 7.65, z]);                   // capital
      k.box(1.2, 0.22, 1.2, STONE, [x, 8.0, z]);
      this.G.world.blockers.push({ x, z, r: 0.5 });
      this.colZ.push(z);
    }
    for (const sx of [-1, 1]) k.box(0.7, 0.7, HL * 2, STONE, [sx * COLX, 8.45, 0]);
    // Cabinets of pigeonholes along both long walls and the far wall
    const CELL = 0.62, ROWS = 7, BOT = 0.25, DEPTH = 0.55;
    this.cells = [];
    const cabinet = (len, place) => {
      const n = Math.floor(len / CELL), L = n * CELL;
      // back, top, and the grid of boards (in the cabinet's own frame: x along, y up, z out from the wall)
      place([L, SHELF_TOP - BOT, 0.06], [0, (SHELF_TOP + BOT) / 2, -DEPTH / 2], 0x3a2414);
      for (let i = 0; i <= ROWS; i++) place([L + 0.08, 0.05, DEPTH], [0, BOT + i * (SHELF_TOP - BOT) / ROWS, 0], WOOD);
      for (let j = 0; j <= n; j++) place([0.05, SHELF_TOP - BOT, DEPTH], [-L / 2 + j * CELL, (SHELF_TOP + BOT) / 2, 0], j % 4 ? WOOD : WOOD2);
      place([L + 0.2, BOT, DEPTH + 0.1], [0, BOT / 2, 0.02], WOOD2);
      place([L + 0.3, 0.14, DEPTH + 0.16], [0, SHELF_TOP + 0.07, 0.03], WOOD2);
      return { n, L, rowH: (SHELF_TOP - BOT) / ROWS };
    };
    // long walls (with a gap in the middle of each for a doorway into a side room)
    for (const sx of [-1, 1]) for (const [z0, z1] of [[-HL + 0.4, -1.8], [1.8, HL - 0.4]]) {
      const len = z1 - z0, cz = (z0 + z1) / 2, x = sx * (HW - DEPTH / 2);
      const cab = cabinet(len, (s, p, c) => k.box(s[2], s[1], s[0], c, [x - sx * p[2], p[1], cz + p[0] * -sx]));
      for (let j = 0; j < cab.n; j++) for (let i = 0; i < ROWS; i++) this.cells.push({ p: new THREE.Vector3(x - sx * 0.12, BOT + (i + 0.5) * cab.rowH, cz + (-cab.L / 2 + (j + 0.5) * CELL) * -sx), axis: 'x' });
      for (let z = z0; z < z1; z += 1.1) this.G.world.blockers.push({ x: sx * (HW - 0.4), z, r: 0.55 });
    }
    // doorways into the side rooms: dark openings with stone frames
    for (const sx of [-1, 1]) {
      k.box(0.1, 3.2, 3.0, 0x1a120c, [sx * (HW - 0.02), 1.6, 0]);
      k.box(0.6, 0.4, 3.8, STONE, [sx * (HW - 0.1), 3.4, 0]);
      for (const sz of [-1, 1]) k.box(0.6, 3.4, 0.4, STONE, [sx * (HW - 0.1), 1.7, sz * 1.7]);
      k.box(0.06, 3.0, 3.6, WALL, [sx * (HW - 0.02), SHELF_TOP - 0.3 + 1.6, 0], 0, [1, 0.3, 1]);
      this.G.world.blockers.push({ x: sx * (HW - 0.2), z: 0, r: 0.6 });
    }
    {
      const len = HW * 2 - 0.8, z = -HL + DEPTH / 2;
      const cab = cabinet(len, (s, p, c) => k.box(s[0], s[1], s[2], c, [p[0], p[1], z + p[2]]));
      for (let j = 0; j < cab.n; j++) for (let i = 0; i < ROWS; i++) this.cells.push({ p: new THREE.Vector3(-cab.L / 2 + (j + 0.5) * CELL, BOT + (i + 0.5) * cab.rowH, z + 0.12), axis: 'z' });
      for (let x = -HW + 0.6; x < HW; x += 1.1) this.G.world.blockers.push({ x, z: -HL + 0.4, r: 0.55 });
    }
    for (let x = -HW + 0.6; x < HW; x += 1.1) this.G.world.blockers.push({ x, z: HL - 0.3, r: 0.5 });
    // Reading tables along the aisles, with scrolls and inkpots, and benches
    this.desks = [];
    for (const [x, z] of [[-6.6, -9], [-6.6, 7], [6.6, -6], [6.6, 8.5], [-2.4, 7.5]]) {
      const rot = Math.abs(x) > 3 ? Math.PI / 2 : 0;
      const w = 2.2, d = 0.9;
      const P = (dx, dz) => [x + (rot ? dz : dx), 0, z + (rot ? dx : dz)];
      k.box(rot ? d : w, 0.08, rot ? w : d, WOOD, [x, 0.82, z]);
      for (const a of [-1, 1]) for (const b of [-1, 1]) { const p = P(a * (w / 2 - 0.12), b * (d / 2 - 0.1)); k.box(0.08, 0.8, 0.08, WOOD2, [p[0], 0.4, p[2]]); }
      for (let i = 0; i < 4; i++) { const p = P((r() - 0.5) * w * 0.8, (r() - 0.5) * d * 0.5); k.cyl(0.045, 0.045, 0.42, 7, 0xe8d8b0, [p[0], 0.9, p[2]], [0, r() * 3, Math.PI / 2]); }
      const ip = P(w * 0.3, -0.2); k.cyl(0.04, 0.05, 0.08, 8, 0x2a2420, [ip[0], 0.9, ip[2]]);
      this.G.world.blockers.push({ x, z, r: 0.9 });
      this.desks.push({ x, z, rot, seat: P(0, d / 2 + 0.38) });
    }
    // Tall pottery jars and a couple of bronze lamp stands
    for (const [x, z] of [[-4, 13.5], [4, 13.5], [-7.4, -1.9], [7.4, 1.9]]) {
      k.cyl(0.18, 0.12, 0.15, 10, 0x9a5a34, [x, 0.08, z]); k.ball(0.32, 1, 0xa8643a, [x, 0.55, z], 0, [1, 1.35, 1]);
      k.cyl(0.12, 0.18, 0.25, 10, 0x9a5a34, [x, 1.0, z]); k.cyl(0.33, 0.33, 0.04, 14, 0x2a2018, [x, 0.6, z], 0, [1, 1, 1]);
      this.G.world.blockers.push({ x, z, r: 0.35 });
    }
    this.lamps = [];
    for (const [x, z] of [[-3.2, -3.5], [3.2, -3.5], [-3.2, 4], [3.2, 4]]) {
      k.cyl(0.3, 0.38, 0.12, 10, 0x8a6a30, [x, 0.06, z]); k.cyl(0.04, 0.05, 1.6, 6, 0x9a7a3a, [x, 0.9, z]);
      k.cyl(0.25, 0.12, 0.14, 10, 0xb08a40, [x, 1.75, z]);
      this.G.world.blockers.push({ x, z, r: 0.3 }); this.lamps.push(new THREE.Vector3(x, 1.95, z));
    }
    // Painted banners between the windows: blue and red cloth hangings with gold edges
    for (const sx of [-1, 1]) for (let z = -HL + BAY; z < HL - 1; z += BAY * 2) {
      k.box(0.04, 1.5, 1.0, z % 2 ? BLUE : RED, [sx * (HW - 0.02), SHELF_TOP + 1.75, z]);
      k.box(0.05, 0.08, 1.04, 0xd8b050, [sx * (HW - 0.03), SHELF_TOP + 1.03, z]);
    }
    const m = k.mesh(FLAT); H.add(m);
    // The scrolls themselves: thousands of rolled ends peeking out of the pigeonholes (one draw)
    const geo = new THREE.CylinderGeometry(0.055, 0.055, 0.34, 7, 1, false);
    const N = this.cells.length * 4;
    const scrolls = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    const cc = new THREE.Color(), tones = [0xe8d8b0, 0xdcc89a, 0xcfb888, 0xf0e2c0, 0xb89a68], tags = [0x9a3a28, 0x3a5a8a, 0x5a7a3a, 0xc89a30];
    let n = 0; const up = new THREE.Vector3(0, 1, 0), axX = new THREE.Vector3(1, 0, 0), axZ = new THREE.Vector3(0, 0, 1);
    for (const c of this.cells) {
      const count = r() < 0.08 ? 0 : 2 + (r() * 3 | 0);
      for (let i = 0; i < count && n < N; i++) {
        const ox = (i % 2 - 0.5) * 0.2 + (r() - 0.5) * 0.06, oy = (i < 2 ? -0.17 : -0.07) + (r() - 0.5) * 0.02;
        _a.copy(c.p); if (c.axis === 'x') { _a.z += ox; _a.x += (r() - 0.5) * 0.06 * (c.p.x > 0 ? 1 : -1); } else { _a.x += ox; _a.z += (r() - 0.5) * 0.06; }
        _a.y += oy;
        _q.setFromUnitVectors(up, c.axis === 'x' ? axX : axZ);
        const sc = 0.85 + r() * 0.35; _m.compose(_a, _q, _b.set(sc, 0.9 + r() * 0.2, sc));
        scrolls.setMatrixAt(n, _m); scrolls.setColorAt(n, cc.setHex(r() < 0.1 ? tags[r() * 4 | 0] : tones[r() * 5 | 0])); n++;
      }
    }
    scrolls.count = n; H.add(scrolls);
  }

  // The brass model of the heavens in the middle of the hall: rings within rings, Earth inside
  buildArmillary() {
    const g = new THREE.Group(); g.position.copy(ARMILLARY); this.hall.add(g);
    const k = new Kit(), BR = 0xc8a040, BR2 = 0x9a7428, STONE = 0xe6dcc4;
    k.cyl(0.9, 1.1, 0.3, 16, STONE, [0, 0.15, 0]); k.cyl(0.5, 0.7, 0.9, 16, STONE, [0, 0.75, 0]); k.cyl(0.75, 0.55, 0.2, 16, STONE, [0, 1.3, 0]);
    k.cyl(0.06, 0.08, 0.9, 8, BR2, [0, 1.8, 0]);
    k.add(new THREE.TorusGeometry(1.3, 0.05, 6, 48), BR, [0, 2.9, 0], [Math.PI / 2, 0, 0]);       // the horizon ring
    k.add(new THREE.TorusGeometry(1.3, 0.04, 6, 48), BR2, [0, 2.9, 0], [0, 0, 0]);                // meridian
    for (const a of [-1, 1]) k.box(0.1, 0.1, 0.36, BR2, [a * 1.32, 2.9, 0]);
    this.armBase = k.mesh(FLAT); g.add(this.armBase);
    // The turning part (one mesh: a set of nested tilted rings, the Earth, little planet beads)
    const t = new Kit();
    [1.15, 0.98, 0.82, 0.68].forEach((R, i) => t.add(new THREE.TorusGeometry(R, 0.03, 5, 40), i % 2 ? BR2 : BR, [0, 0, 0], [Math.PI / 2 + (i - 1.5) * 0.35, i * 0.6, 0]));
    t.add(new THREE.TorusGeometry(1.06, 0.07, 5, 48), 0xd8b050, [0, 0, 0], [Math.PI / 2 - TILT * D2R, 0, 0]);   // the zodiac band
    t.ball(0.22, 2, 0x3b7fb0, [0, 0, 0]);
    BODIES.forEach((b, i) => { const a = i * 0.9; t.ball(0.045 + b.size * 0.05, 1, b.col, [Math.cos(a) * (0.35 + i * 0.1), Math.sin(a) * 0.15, Math.sin(a) * (0.35 + i * 0.1)]); });
    this.armSpin = t.mesh(FLAT); this.armSpin.position.y = 2.9; g.add(this.armSpin);
    // a soft golden glow when it comes alive
    this.armGlow = new THREE.Sprite(glowMat('rgba(255,210,120,1)')); this.armGlow.position.y = 2.9; this.armGlow.scale.setScalar(4.5); this.armGlow.material.opacity = 0; g.add(this.armGlow);
    this.G.world.blockers.push({ x: ARMILLARY.x, z: ARMILLARY.z, r: 1.3 });
  }

  // Ptolemy's table with the Almagest on it, ready to unroll toward you
  buildTable() {
    const k = new Kit(), WOOD = 0x6e4628, WOOD2 = 0x4e301a;
    const W = 2.4, D = 1.1, Y = 0.95;
    k.box(W, 0.1, D, WOOD, [0, Y, 0]); k.box(W + 0.1, 0.06, D + 0.1, WOOD2, [0, Y - 0.08, 0]);
    for (const a of [-1, 1]) { k.box(0.12, Y - 0.1, D - 0.2, WOOD2, [a * (W / 2 - 0.2), (Y - 0.1) / 2, 0]); k.box(0.35, 0.08, D - 0.1, WOOD2, [a * (W / 2 - 0.2), 0.04, 0]); }
    // instruments: a small bronze astrolabe-like ring, a measuring rod, inkpot, a stack of scrolls
    k.add(new THREE.TorusGeometry(0.16, 0.015, 5, 24), 0xc8a040, [0.85, Y + 0.22, -0.3], [0.2, 0.5, 0]);
    k.cyl(0.02, 0.03, 0.2, 6, 0x9a7428, [0.85, Y + 0.09, -0.3]);
    k.box(0.7, 0.02, 0.04, 0xc8a040, [-0.7, Y + 0.06, -0.38], [0, 0.4, 0]);
    k.cyl(0.04, 0.05, 0.08, 8, 0x2a2420, [0.95, Y + 0.09, 0.25]);
    for (let i = 0; i < 5; i++) k.cyl(0.05, 0.05, 0.5, 8, 0xe8d8b0, [-0.85 + (i % 3) * 0.11, Y + 0.1 + (i / 3 | 0) * 0.09, -0.15], [0, 0, Math.PI / 2]);
    const m = k.mesh(FLAT); m.position.copy(TABLE); this.hall.add(m);
    this.G.world.blockers.push({ x: TABLE.x - 0.6, z: TABLE.z, r: 0.6 }, { x: TABLE.x + 0.6, z: TABLE.z, r: 0.6 });
    // The scroll: the paper (grows as it unrolls) and the roll itself, rolling toward you
    this.scrollY = Y + 0.08;
    const tex = almagestTex();
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.62), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, emissive: 0x332211 }));
    this.paper.rotation.x = -Math.PI / 2 + 0.0; this.paper.geometry.translate(0.5, 0, 0);
    this.paperG = new THREE.Group(); this.paperG.position.set(TABLE.x - 0.6, this.scrollY, TABLE.z + 0.05); this.paperG.add(this.paper);
    this.paper.rotation.set(-Math.PI / 2, 0, 0);
    this.hall.add(this.paperG);
    const rk = new Kit();
    rk.cyl(0.05, 0.05, 0.7, 12, 0xe2cfa0, [0, 0, 0]); for (const a of [-1, 1]) rk.cyl(0.025, 0.02, 0.1, 8, 0x5a3820, [0, a * 0.38, 0]);
    this.roll = rk.mesh(FLAT); this.roll.rotation.x = Math.PI / 2; this.hall.add(this.roll);
    this.roll2 = this.roll.clone(); this.hall.add(this.roll2);
    this.paperTex = tex;
  }

  buildPeople() {
    this.people = [];
    const add = (pos, face, look, role) => {
      const P = makePerson({ seed: 70 + this.people.length * 11, ...look });
      P.g.position.copy(pos); P.g.rotation.y = face; P.role = role; P.tintHex = look.tint;
      this.hall.add(P.g); this.people.push(P); P.blk = { x: pos.x, z: pos.z, r: 0.3 }; this.G.world.blockers.push(P.blk);
      return P;
    };
    // Ptolemy himself, behind his table, facing you as you come up the hall
    this.ptolemy = add(new THREE.Vector3(0.35, 0, TABLE.z - 0.95), 0, { model: 'ptolemy', tunic: 0xe8e0d0, hair: 0xd8d4cc, beard: true, height: 1.74 }, 'ptolemy');
    // Other scholars: reading at the side tables, and one looking up at the model
    const looks = [
      { model: 'aristotle', tunic: 0xd8c8a8, hair: 0x5a4030, beard: true, tint: 0xc8d8ff },
      { model: 'aristotle', tunic: 0xb89a78, hair: 0x2a2018, beard: true, tint: 0xffd8b0 },
      { model: 'ptolemy', tunic: 0xa8b8c8, hair: 0x3a2a20, beard: true, tint: 0xd0ffd0 },
    ];
    this.desks.slice(0, 3).forEach((d, i) => {
      const P = add(new THREE.Vector3(d.seat[0], 0, d.seat[2]), Math.atan2(d.x - d.seat[0], d.z - d.seat[2]), looks[i], 'read');
      P.g.position.y = 0; // (they stand at their desks to read, as people often did)
    });
    const w = add(new THREE.Vector3(ARMILLARY.x + 2.1, 0, ARMILLARY.z + 0.8), Math.atan2(-2.1, -0.8), looks[1], 'gaze'); w.pointAt.copy(ARMILLARY).setY(2.9);
    // Aristarchus: in the dark cosmos, standing in the shadows on the curve of the little Earth
    const ap = new THREE.Vector3(-0.9, 0, -1.9), apr = Math.hypot(ap.x, ap.z);
    ap.y = Math.sqrt(GLOBE_R * GLOBE_R - apr * apr) - GLOBE_R;
    const A = makePerson({ model: 'aristotle', seed: 5, tunic: 0x8090a8, hair: 0x9a9a9a, beard: true });
    A.g.position.copy(ap);
    // lean with the ground, facing you
    A.g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _a.set(ap.x, ap.y + GLOBE_R, ap.z).normalize());
    A.g.rotateY(Math.atan2(-ap.x, -ap.z));
    A.dark = true; this.aristarchus = A; this.cosmos.add(A.g);
    this.aGlow = new THREE.Sprite(glowMat('rgba(150,180,255,1)')); this.aGlow.position.copy(ap).add(_a.set(0, 1.1, 0)); this.aGlow.scale.set(2.6, 3.4, 1); this.aGlow.material.opacity = 0;
    this.aGlow.renderOrder = -1; this.cosmos.add(this.aGlow);
    this.tinted = new Set();
  }

  // Give a model its own colours once it has loaded: scholars a different shade, Aristarchus in shadow
  tintModels() {
    for (const P of [...this.people, this.aristarchus]) {
      if (!P.model || this.tinted.has(P)) continue;
      this.tinted.add(P);
      const look = P === this.aristarchus ? 0x8a9ac8 : P.tintHex;
      if (!look && P !== this.aristarchus) continue;
      P.model.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        o.material.color?.multiply(new THREE.Color(look));
        if (P === this.aristarchus) { o.material.transparent = true; o.material.opacity = 0; P.mats = (P.mats || []).concat(o.material); if (o.material.emissive) o.material.emissive.setHex(0x1a2440); }
      });
    }
  }

  // ---------- The cosmos ----------
  buildCosmos() {
    const C = this.cosmos;
    // The little Earth you stand on
    const globe = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R, 64, 40), new THREE.MeshLambertMaterial({ map: globeTex(), emissive: 0x0a1420 }));
    globe.position.y = -GLOBE_R; globe.rotation.set(0.3, 0, 0.2); C.add(globe); this.globe = globe;
    // a soft atmosphere halo round the Earth's edge
    const atm = new THREE.Mesh(new THREE.SphereGeometry(GLOBE_R * 1.03, 48, 24), crystalMat(0x6ab0ff)); atm.position.y = -GLOBE_R; atm.material.side = THREE.FrontSide; atm.material.uniforms.opacity.value = 0.9; C.add(atm);
    // The crystal spheres, one per body, plus the sphere of the stars. Each turns as one piece:
    // a glassy shell, a gold ring along the planets' road, and two faint meridians (so you see it turn)
    this.spheres = [];
    const all = [...BODIES, { k: 'stars', name: 'The fixed stars', r: STARS_R, size: 0, col: 0xffffff, speed: 0.03, lam: 0 }];
    all.forEach((b, i) => {
      const g = new THREE.Group(); g.position.y = EYE; C.add(g);
      const S0 = {};
      const tilt = new THREE.Group(); tilt.rotation.x = TILT * D2R; g.add(tilt);   // the ecliptic frame
      const spin = new THREE.Group(); tilt.add(spin);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(b.r, 40, 24), crystalMat(b.k === 'stars' ? 0x9ab0ff : 0x9fd8ff)); spin.add(shell);
      const rk = new Kit();
      // (only the outermost sphere draws the planets' road, a gold line, or they'd all pile up on one line)
      rk.add(new THREE.TorusGeometry(b.r, b.k === 'stars' ? 0.05 : 0.004, 4, 128), 0xffd880, [0, 0, 0], [Math.PI / 2, 0, 0]);
      const rings = new THREE.Mesh(rk.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      spin.add(rings);
      // little glints of light scattered over the crystal, so you can see each sphere turning
      if (b.k !== 'stars') {
        const gr = rng(50 + i), n = 140, gp = new Float32Array(n * 3);
        for (let j = 0; j < n; j++) { const lam = gr() * 360, bet = Math.asin(gr() * 1.6 - 0.8) / D2R; const v = _a.set(Math.sin(lam * D2R) * Math.cos(bet * D2R), Math.sin(bet * D2R), -Math.cos(lam * D2R) * Math.cos(bet * D2R)).multiplyScalar(b.r); gp.set([v.x, v.y, v.z], j * 3); }
        const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3));
        S0.glints = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0x6fd0ff, size: 0.08 + b.r * 0.008, map: dotTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        spin.add(S0.glints);
      }
      const S = Object.assign(S0, { b, g, tilt, spin, shell, rings, i, body: null, glow: null, label: null });
      if (b.size) {
        const body = new THREE.Mesh(new THREE.IcosahedronGeometry(b.size, 2), new THREE.MeshBasicMaterial({ color: b.col, fog: false, transparent: true }));
        const glow = new THREE.Sprite(glowMat(b.glow)); glow.scale.setScalar(b.size * (b.k === 'sun' ? 7 : 5));
        body.add(glow);
        if (b.k === 'saturn') { const ring = new THREE.Mesh(new THREE.RingGeometry(b.size * 1.4, b.size * 2.2, 32), new THREE.MeshBasicMaterial({ color: 0xd8c890, side: THREE.DoubleSide, transparent: true, opacity: 0.8, fog: false })); ring.rotation.x = 1.2; body.add(ring); }
        if (b.k === 'moon') { const dark = new THREE.Mesh(new THREE.IcosahedronGeometry(b.size * 1.01, 2), new THREE.MeshBasicMaterial({ color: 0x1a2030, fog: false })); dark.scale.set(0.55, 1, 1); dark.position.x = -b.size * 0.48; body.add(dark); }
        body.position.set(Math.sin(b.lam * D2R) * b.r, 0, -Math.cos(b.lam * D2R) * b.r);
        spin.add(body); S.body = body; S.glow = glow;
      }
      // its name, just under the body (the stars' name high up in front of you)
      const lab = labelSprite(b.name, b.k === 'stars' ? 6 : 1.2 + b.r * 0.2);
      if (S.body) { lab.position.set(0, -(b.size + 0.3 + b.r * 0.045), 0); S.body.add(lab); }
      else { eclDir(0, 30, lab.position).multiplyScalar(b.r * 0.97); lab.position.y += EYE; C.add(lab); }
      lab.material.opacity = 0; S.label = lab;
      this.spheres.push(S);
    });
    this.sphereOf = Object.fromEntries(this.spheres.map((S) => [S.b.k, S]));
    // Mars's real path across the stars: dots drawn as Mars goes (and the model's path, in gold)
    const mk = (color, size) => {
      const pos = new Float32Array(NPATH * 3);
      for (let i = 0; i < NPATH; i++) { marsDir(lerp(T0, T1, i / (NPATH - 1)), _a).multiplyScalar(MARS.r - 0.1); pos.set([_a.x, _a.y + EYE, _a.z], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setDrawRange(0, 0);
      const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, map: dotTex() }));
      p.frustumCulled = false; C.add(p); return p;
    };
    this.realPath = mk(0xff7a50, 0.32);
    this.modelPath = mk(0xffe08a, 0.2);
    // A big Mars for following (rides on its sphere at the right place in the loop)
    this.marsBig = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), new THREE.MeshBasicMaterial({ color: 0xe0603c, fog: false }));
    const mg = new THREE.Sprite(glowMat('rgba(255,120,70,1)')); mg.scale.setScalar(3.2); this.marsBig.add(mg); this.marsHalo = mg;
    this.marsBig.visible = false; C.add(this.marsBig);
    // The beam from your hand to Mars while you follow it (your headset only)
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffa070, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.beam.visible = false; this.root.add(this.beam);
  }

  // Ptolemy's machine for Mars: the big circle (deferent) round the Earth, and the small circle
  // (epicycle) whose middle rides along it. Mars sits on the small circle.
  buildMachine() {
    const M = this.machine = new THREE.Group(); M.position.y = EYE; this.cosmos.add(M);
    const add = (geo, col, op = 0.9) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); M.add(m); return m; };
    this.defRing = add(new THREE.TorusGeometry(1.524 * SCALE, 0.03, 4, 128), 0xffd070);
    this.epiRing = add(new THREE.TorusGeometry(1 * SCALE, 0.03, 4, 96), 0xff9a70);
    this.spoke = add(new THREE.CylinderGeometry(0.015, 0.015, 1, 5, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), 0xffd070, 0.6);
    this.arm = add(new THREE.CylinderGeometry(0.015, 0.015, 1, 5, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), 0xff9a70, 0.6);
    this.sight = add(new THREE.CylinderGeometry(0.008, 0.008, 1, 5, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2), 0xffffff, 0.35);
    this.hub = add(new THREE.IcosahedronGeometry(0.09, 1), 0xffd070);
    this.marsSmall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 2), new THREE.MeshBasicMaterial({ color: 0xe0603c, fog: false }));
    const sg = new THREE.Sprite(glowMat('rgba(255,120,70,1)')); sg.scale.setScalar(1.3); this.marsSmall.add(sg); M.add(this.marsSmall);
    // the rings lie in the planets' plane
    const n = eclVec(_a.set(0, 0, 1), new THREE.Vector3()).normalize();
    this.planeQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    this.defRing.quaternion.copy(this.planeQ); this.epiRing.quaternion.copy(this.planeQ);
    this.machineMats = M.children.map((o) => o.material).filter(Boolean);
    M.visible = false;
  }

  buildEffects() {
    // Sunbeams slanting down from the east windows onto the floor, with dust floating in them
    const H = this.hall;
    const tex = canvasTex(64, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,230,170,0.0)'); gr.addColorStop(0.2, 'rgba(255,230,170,0.75)'); gr.addColorStop(1, 'rgba(255,220,150,0.25)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const sd = g.createLinearGradient(0, 0, w, 0); sd.addColorStop(0, 'rgba(0,0,0,1)'); sd.addColorStop(0.25, 'rgba(0,0,0,0)'); sd.addColorStop(0.75, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = sd; g.fillRect(0, 0, w, h);
    });
    const beamMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const patchMat = new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, 'rgba(255,225,160,0.9)'); gr.addColorStop(1, 'rgba(255,225,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    const BAY = 3.75, top = 7.9;
    this.beamMats = [beamMat, patchMat];
    for (let z = -HL + BAY / 2; z < HL; z += BAY * (1)) {
      if (Math.abs(z) < 1) continue;
      const from = new THREE.Vector3(HW - 0.2, top, z), to = new THREE.Vector3(-1.6, 0.02, z - 2.2);
      const len = from.distanceTo(to);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, len), beamMat);
      b.position.copy(from).add(to).multiplyScalar(0.5); b.lookAt(to); b.rotateX(Math.PI / 2);
      const b2 = b.clone(); b2.rotateY(Math.PI / 2); H.add(b, b2);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), patchMat); p.rotation.x = -Math.PI / 2; p.position.copy(to); p.position.y = 0.02; H.add(p);
    }
    // Dust in the light
    const N = 500, pos = new Float32Array(N * 3), r = rng(9);
    for (let i = 0; i < N; i++) pos.set([(r() - 0.5) * HW * 1.8, 0.5 + r() * 7, (r() - 0.5) * HL * 1.8], i * 3);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff0c8, size: 0.025, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    H.add(this.dust);
    // Lamp flames on the bronze stands
    this.flames = this.lamps.map((p) => { const s = new THREE.Sprite(glowMat('rgba(255,180,80,1)')); s.position.copy(p); s.scale.setScalar(0.5); H.add(s); return s; });
    // Glowing "stand here" ring
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.copy(SPOT).setY(0.04); H.add(this.ring);
    // The journal page (Astra holds it up at the end)
    const jt = canvasTex(1024, 720, drawJournal);
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46 * 720 / 1024), new THREE.MeshBasicMaterial({ map: jt, side: THREE.DoubleSide, fog: false }));
    this.journal = new THREE.Group(); this.journal.add(page); this.journal.visible = false; this.root.add(this.journal);
  }

  // Swap between the hall and the cosmos (sky, ground, where you can walk)
  useHall(on) {
    const G = this.G;
    this.hall.visible = on; this.cosmos.visible = !on;
    this.where = on ? 'hall' : 'cosmos';
    if (on) { G.world.height = () => 0; G.world.bounds = HL - 0.6; G.world.blockers = this.hallBlockers || G.world.blockers; this.hallBlockers = G.world.blockers; }
    else {
      this.hallBlockers = G.world.blockers;
      G.world.blockers = [];
      G.world.bounds = 2.4;
      G.world.height = (x, z) => Math.sqrt(Math.max(0, GLOBE_R * GLOBE_R - x * x - z * z)) - GLOBE_R;
    }
  }

  registerInteractables() {
    const G = this.G, self = this;
    // The scroll: touch it (after it has unrolled) to go into Ptolemy's universe
    this.scrollIt = {
      hint: 'Touch Ptolemy’s scroll (TRIGGER or GRIP)',
      deskHint: 'Click Ptolemy’s scroll',
      get disabled() { return self.s.phase !== 'touch'; },
      reach(pos) { self.paper.getWorldPosition(_a); _a.x += 0.6; _a.y = self.scrollY; return Math.max(0, Math.hypot(pos.x - _a.x, (pos.y - _a.y) * 1.5, pos.z - _a.z) - 0.4); },
      aim(o, d) { _a.set(TABLE.x, self.scrollY, TABLE.z + 0.05); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.5 ? t : Infinity; },
      onTouch() { G.act({ type: 'touchScroll' }); },
      onGrab() { G.act({ type: 'touchScroll' }); },
    };
    // Mars: hold GRIP (anywhere) and follow it with your hand; time runs while you hold on
    this.marsIt = {
      hint: 'Hold GRIP and follow Mars with your hand',
      deskHint: 'Hold the mouse button to follow Mars (or tap E)',
      get disabled() { return self.s.phase !== 'follow'; },
      reach() { return 0.05; },            // any hand, anywhere (it's far up in the sky)
      aim() { return 3; },
      onGrab(h) { self.holding = h; },
      onHold(h, dt) {
        // faster when your hand points along toward Mars
        self.camPos(_a); _b.copy(h.pos).sub(_a).normalize();
        self.marsBig.getWorldPosition(_c); _c.sub(_a).normalize();
        const on = h === G.player.deskHand ? 1 : clamp((_b.dot(_c) - 0.75) / 0.2, 0, 1);
        self.onTrack = on;
        G.act({ type: 'follow', dt: Math.min(dt, 0.1) * (0.6 + 0.6 * on) });
        if (Math.random() < dt * 6) G.player.haptic?.(h, 0.15 + 0.3 * on, 20);
      },
      onRelease() { self.holding = null; },
      onKey() { G.act({ type: 'follow', dt: 0.6 }); },
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
    G.interactables.push(this.scrollIt, this.marsIt, this.pageIt);
  }

  camPos(out) { return this.G.camera.getWorldPosition(out); }

  // ---------- Actions from any player (run on the host) ----------
  act(a) {
    const s = this.s;
    if (a.type === 'touchScroll' && s.phase === 'touch') { s.phase = 'touched'; return true; }
    if (a.type === 'follow' && s.phase === 'follow') { s.mt = Math.min(T1, s.mt + a.dt * MARS_RATE); this.lastFollow = this.G.t; return true; }
    if (a.type === 'touchPage' && s.journal === 1) { s.journal = 2; return true; }
    return false;
  }

  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story (host only) ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    const placeAll = (pos, yaw) => G.events.emit('placePlayers', { x: pos.x, z: pos.z, yaw });
    const face = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
    // Arrive at the south end of the hall, looking up it toward the model of the heavens
    placeAll(START, 0);
    await G.ui.fadeIn(2.5);
    s.guide = [0, 5.5, 2]; // Astra drifts up into the hall's light
    await D.say('ch7_01');
    s.guide = [-5.5, 3.2, 4]; // ...along the scroll cabinets
    s.phase = 'walk'; s.ring = D.kids ? 0 : 1;
    D.hint('Walk up the hall to the glowing ring (left stick)', 8);
    await D.say('ch7_02');
    s.guide = null;
    const there = () => G.players.every((p) => { p.headPos?.(_a) ?? _a.copy(p.view?.head || SPOT); return Math.hypot(_a.x - SPOT.x, _a.z - SPOT.z) < 1.8; });
    if (D.kids) await D.goTo(SPOT, 0);   // Kids mode: a quick fade takes you there
    else if (!(await D.until(there, fast ? 3 : 30))) {
      await G.ui.fadeOut(0.8); placeAll(SPOT, 0); await G.ui.fadeIn(1);
    }
    s.ring = 0; G.ui.showHint('');
    // The scroll unrolls
    s.phase = 'scroll'; s.point = 1; s.guide = [1.6, 2.1, TABLE.z - 0.2];
    await D.say('ch7_03');
    await D.until(() => s.scroll >= 1, 5);
    s.phase = 'touch'; s.arm = 1;
    D.hint(G.mode === 'desktop' ? this.scrollIt.deskHint : this.scrollIt.hint, 8);
    if (!(await D.auto(() => s.phase === 'touched', () => { s.phase = 'touched'; }, { after: fast ? 0.3 : 2.5, timeout: fast ? 4 : 40 }))) s.phase = 'touched';
    G.ui.showHint('');
    // The room goes dark: into Ptolemy's universe
    s.point = 0;
    await G.ui.fadeOut(1.6);
    s.where = 'cosmos'; s.phase = 'spheres'; s.shells = 1; s.labels = 1; s.spin = 0.25;
    placeAll(new THREE.Vector3(0, 0, 0.1), 0);
    await D.wait(0.3);
    s.guide = [2.4, EYE + 0.6, -5];
    await G.ui.fadeIn(2.2);
    await D.say('ch7_04');
    s.labels = 0;
    // Follow Mars
    s.focus = 1; s.spin = 0; s.trail = 1; s.mt = T0;
    s.guide = [-3.2, EYE + 1.4, -5.5];
    await D.say('ch7_05');
    s.phase = 'follow';
    D.hint(G.mode === 'desktop' ? this.marsIt.deskHint : this.marsIt.hint, 8);
    this.followStart = G.t;
    // Kids mode: Mars traces its loop by itself while you watch
    await D.auto(() => s.mt >= T1, (dt) => { s.mt = Math.min(T1, s.mt + dt * MARS_RATE * (fast ? 4 : 1)); }, { after: fast ? 0.2 : 1 });
    G.ui.showHint('');
    // Ptolemy's answer: the small circle on the big circle
    s.phase = 'epicycle'; s.epi = 1; s.et = T0;
    await D.say('ch7_06');
    await D.until(() => s.et >= T1, 20);
    await D.wait(fast ? 0.3 : 1.5);
    // The whole universe runs like clockwork
    s.phase = 'clock'; s.epi = 0; s.focus = 0; s.trail = 0; s.spin = 1.6;
    s.guide = null;
    await D.say('ch7_07');
    // Aristarchus, from the shadows
    s.phase = 'aristarchus'; s.spin = 0.3; s.focus = 0.6;
    await D.say('ch7_08');
    s.arist = 1;
    await D.wait(fast ? 0.3 : 1.8);
    s.sun = 1;
    await D.say('ch7_09');
    await D.wait(fast ? 0.2 : 1);
    await D.say('ch7_10');
    s.phase = 'wrong'; s.arist = 0; s.spin = 0;
    await D.say('ch7_11');
    s.shells = 0;
    await D.wait(fast ? 0.3 : 2);
    // The lights come up: back in Ptolemy's hall
    await G.ui.fadeOut(1.4);
    s.where = 'hall'; s.phase = 'back'; s.sun = 0; s.focus = 0; s.arm = 0.5;
    placeAll(SPOT, 0);
    await D.wait(0.3);
    await G.ui.fadeIn(1.8);
    s.guide = null;
    await D.say('ch7_12');
    // The last journal page of Era 1
    s.journal = 1; s.phase = 'journal';
    G.events.emit('sfx', { k: 'page' });
    D.hint(G.mode === 'desktop' ? this.pageIt.deskHint : this.pageIt.hint, 8);
    await D.auto(() => s.journal === 2, () => this.act({ type: 'touchPage' }), { after: fast ? 0.5 : 4 });
    G.ui.showHint('');
    G.events.emit('sfx', { k: 'page' });
    await D.wait(1.2);
    s.phase = 'done';
  }

  // ---------- Every frame, every headset ----------
  update(dt, t) {
    const G = this.G, s = this.s, host = G.isHost, fast = G.params.has('fast') ? 4 : 1;
    if (host) {
      if (s.phase === 'scroll' || s.phase === 'touch') s.scroll = Math.min(1, s.scroll + dt / 3.2 * fast);
      s.turn += dt * s.spin * 0.25;
      // If nobody follows Mars for a while, it carries on by itself
      if (s.phase === 'follow' && G.t - (this.followStart ?? G.t) > 12 && G.t - (this.lastFollow ?? 0) > 4) s.mt = Math.min(T1, s.mt + dt * MARS_RATE * 0.5 * fast);
      if (s.phase === 'epicycle') s.et = Math.min(T1, s.et + dt * 0.075 * fast);
    }
    if ((s.where === 'hall') !== this.hall.visible) this.useHall(s.where === 'hall');
    this.tintModels();
    if (s.where === 'hall') this.updateHall(dt, t); else this.updateCosmos(dt, t);

    // Astra: hover where the story wants it, or out in front of you
    if (s.guide) { _a.fromArray(s.guide); if (!this.guideAt || !this.guideAt.equals(_a)) { this.guideAt = _a.clone(); G.guide.flyTo(this.guideAt); G.guide.chime(); } }
    else if (this.guideAt && s.journal !== 1) { this.guideAt = null; G.guide.follow(); }
    // The journal page floats in front of you, held up by Astra
    this.journal.visible = s.journal === 1;
    if (s.journal === 1) {
      G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize();
      if (!this.pageSet) { this.pageSet = true; this.journal.position.copy(_a).addScaledVector(_b, 0.62); this.journal.position.y -= 0.2; }
      this.journal.lookAt(_a);
      this.journal.position.y += Math.sin(t * 1.6) * 0.0006;
      G.guide.flyTo(_c.copy(this.journal.position).add(_d.set(-_b.z * 0.4, 0.12, _b.x * 0.4)), _a);
      this.guideAt = this.guideAt || _c.clone();
    }
  }

  updateHall(dt, t) {
    const G = this.G, s = this.s;
    // Bright late morning outside (the high windows show the sky); soft light inside
    G.sky.sunSize = 1;
    G.sky.set(115, 52);
    G.sky.sunLight.intensity *= 0.55; G.sky.hemi.intensity *= 0.9;
    G.sky.mist = damp(G.sky.mist, 0, 1, dt);
    // The scroll unrolls toward you: the paper grows, the roll travels
    const u = ease(s.scroll), len = lerp(0.04, 1.2, u);
    this.paper.scale.set(len, 1, 1);
    this.paperG.position.set(TABLE.x - 0.6, this.scrollY, TABLE.z + 0.05);
    this.roll.position.set(TABLE.x - 0.6 + len, this.scrollY + 0.05, TABLE.z + 0.05); this.roll.rotation.set(Math.PI / 2, 0, -u * 12);
    this.roll2.position.set(TABLE.x - 0.62, this.scrollY + 0.05, TABLE.z + 0.05);
    this.paper.material.emissive.setRGB(0.2, 0.13, 0.07).multiplyScalar(s.phase === 'touch' ? 1 + Math.sin(t * 4) * 0.8 : 1);
    // The brass model turns slowly, and glows when it's about to come alive
    this.armSpin.rotation.y += dt * (0.1 + s.arm * 0.4);
    this.armSpin.rotation.x = Math.sin(t * 0.2) * 0.1;
    this.armGlowV = damp(this.armGlowV || 0, s.arm, 2, dt);
    this.armGlow.material.opacity = this.armGlowV * (0.35 + 0.15 * Math.sin(t * 2));
    // sunbeams breathe a little; dust drifts
    this.beamMats[0].opacity = 0.2 + 0.03 * Math.sin(t * 0.4);
    const dp = this.dust.geometry.attributes.position;
    for (let i = 0; i < dp.count; i += 7) { dp.setY(i, (dp.getY(i) + dt * 0.03) % 8); }
    dp.needsUpdate = true;
    for (const [i, f] of this.flames.entries()) f.scale.setScalar(0.42 + 0.06 * Math.sin(t * 13 + i * 2) + 0.03 * Math.sin(t * 29 + i));
    // Stand-here ring
    this.ringV = damp(this.ringV || 0, s.ring, 3, dt);
    this.ring.material.opacity = this.ringV * (0.55 + 0.25 * Math.sin(t * 3));
    this.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 3)); this.ring.visible = this.ringV > 0.01;
    // People
    for (const P of this.people) {
      if (P.role === 'ptolemy') { P.pose = s.point ? 'point' : 'idle'; P.pointAt.copy(ARMILLARY).setY(2.9); }
      else if (P.role === 'gaze') P.pose = 'point';
      else P.pose = 'idle';
      animatePerson(P, t, dt);
    }
  }

  updateCosmos(dt, t) {
    const G = this.G, s = this.s;
    // Deep night: the real stars are Ptolemy's outermost sphere
    G.sky.sunSize = 1; G.sky.set(115, -32);
    G.sky.mist = damp(G.sky.mist, 0, 1, dt);
    this.shellV = damp(this.shellV ?? 0, s.shells, 1.2, dt);
    this.labelV = damp(this.labelV ?? 0, s.labels, 2, dt);
    this.focusV = damp(this.focusV ?? 0, s.focus, 2, dt);
    this.sunV = damp(this.sunV ?? 0, s.sun, 1.5, dt);
    this.epiV = damp(this.epiV ?? 0, s.epi, 2, dt);
    this.aristV = damp(this.aristV ?? 0, s.arist, 1.2, dt);
    // The crystal spheres turn, each at its own speed, carrying its body along the road
    for (const S of this.spheres) {
      const b = S.b, mars = b.k === 'mars', dim = mars ? 1 : 1 - 0.75 * this.focusV;
      S.spin.rotation.y = -s.turn * b.speed * 6;   // (each body rides along on its own sphere)
      if (S.body) {
        const sunBoost = b.k === 'sun' ? 1 + this.sunV * 1.8 + this.sunV * 0.3 * Math.sin(t * 3) : 1;
        S.glow.material.opacity = dim * (b.k === 'sun' ? 0.9 : 0.75);
        S.glow.scale.setScalar(b.size * (b.k === 'sun' ? 7 : 5) * sunBoost);
        S.body.material.opacity = dim; S.body.visible = !(mars && (s.phase === 'follow' || s.phase === 'epicycle' || s.trail));
      }
      S.shell.material.uniforms.opacity.value = this.shellV * dim * (b.k === 'stars' ? 0.5 : 1) * (mars ? 1 + this.focusV * 0.6 : 1);
      S.rings.material.opacity = this.shellV * dim * 0.45;
      if (S.glints) S.glints.material.opacity = this.shellV * dim * 0.5;
      S.label.material.opacity = this.labelV * (S.body ? S.body.material.opacity : 1);
      S.shell.visible = S.rings.visible = this.shellV > 0.01;
    }
    // Mars on its loop, and its trail of dots
    const following = s.trail || s.phase === 'follow' || s.phase === 'epicycle';
    this.marsBig.visible = !!following;
    if (following) {
      const mt = s.phase === 'epicycle' ? s.et : s.mt;
      marsDir(mt, this.marsBig.position).multiplyScalar(MARS.r - 0.15); this.marsBig.position.y += EYE;
      this.marsHalo.material.opacity = 0.8 + 0.2 * Math.sin(t * 4);
      const k = Math.round((s.mt - T0) / (T1 - T0) * (NPATH - 1)) + 1;
      this.realPath.geometry.setDrawRange(0, s.trail ? clamp(k, 0, NPATH) : 0);
      const ke = Math.round((s.et - T0) / (T1 - T0) * (NPATH - 1)) + 1;
      this.modelPath.geometry.setDrawRange(0, s.phase === 'epicycle' ? clamp(ke, 0, NPATH) : 0);
    } else { this.realPath.geometry.setDrawRange(0, 0); this.modelPath.geometry.setDrawRange(0, 0); }
    this.realPath.material.opacity = s.phase === 'epicycle' ? 0.55 : 1;
    // Mars moving backward: a little warning glow, and a soft tone when it turns round
    if (s.phase === 'follow') {
      const v = marsDir(s.mt + 0.01, _a).sub(marsDir(s.mt, _b)), back = v.dot(eclVec(_c.set(0, 1, 0), _d)) < 0;
      if (back !== this.wasBack && this.wasBack !== undefined) G.audio.chime(this.marsBig.position, 0.25);
      this.wasBack = back;
    }
    // Your hand's beam to Mars while you follow it
    const h = this.holding;
    this.beam.visible = !!(h && s.phase === 'follow' && h !== G.player.deskHand);
    if (this.beam.visible) { this.beam.position.copy(h.pos); this.beam.lookAt(this.marsBig.position); this.beam.scale.set(1, 1, h.pos.distanceTo(this.marsBig.position)); this.beam.material.opacity = 0.3 + 0.5 * (this.onTrack || 0); }
    // Ptolemy's machine: big circle, small circle, Mars, and your line of sight out to the stars
    this.machine.visible = this.epiV > 0.01;
    if (this.machine.visible) {
      for (const m of this.machineMats) m.opacity = this.epiV * (m.userData.base ??= m.opacity);
      const et = s.et;
      eclVec(marsAt(et, _a), _b).multiplyScalar(SCALE);            // the middle of the small circle
      eclVec(earthAt(et, _a).negate(), _c).multiplyScalar(SCALE);  // Mars's place on it
      this.hub.position.copy(_b); this.epiRing.position.copy(_b);
      this.marsSmall.position.copy(_b).add(_c);
      const seg = (m, from, to) => { m.position.copy(from); m.lookAt(_d.copy(to).add(this.machine.position)); m.scale.set(1, 1, Math.max(0.01, from.distanceTo(to))); };
      seg(this.spoke, _e.copy(_b).setLength(0.7), _b);
      seg(this.arm, _b, this.marsSmall.position);
      const far = _a.copy(this.marsSmall.position).normalize().multiplyScalar(MARS.r - 0.2);
      seg(this.sight, _mv.copy(far).setLength(0.7), far);
      this.epiRing.rotation.z = 0; // (ring itself is round; its turning shows through the arm)
    }
    // Clockwork: a tick each time the spheres move on a notch
    if (s.spin > 0.5) { const notch = Math.floor(s.turn * 24); if (notch !== this.prevNotch) { this.prevNotch = notch; G.audio.tick(null); } }
    // Aristarchus in the shadows: fades in, a cool light behind him, glowing softly while he speaks
    const A = this.aristarchus;
    A.g.visible = this.aristV > 0.01;
    if (A.mats) for (const m of A.mats) m.opacity = this.aristV;
    this.aGlow.material.opacity = this.aristV * (0.35 + 0.5 * (G.narration.otherLevel || 0));
    A.pose = 'idle'; animatePerson(A, t, dt);
    // The little Earth turns very, very slowly under you (you can't feel it... can you?)
    this.globe.rotation.y += dt * 0.004;
  }

  dispose() {
    this.G.scene.remove(this.root);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
    this.G.world.height = () => 0;
  }
}

const MARS_RATE = 0.065;   // years of Mars's loop per second while you follow it

function dotTex() {
  return canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
}
