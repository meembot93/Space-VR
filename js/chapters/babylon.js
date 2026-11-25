// Chapter 4: Babylon predicts an eclipse. The top of the ziggurat in Babylon, about 700 BC, night.
//
// You stand on the top terrace of the great stepped temple tower, the whole city spread out below in
// the moonlight: flat mudbrick roofs, lamps in doorways, the temple walls, the Euphrates with palms
// along its banks. A sky-watcher shows you the shelves of clay tablets: hundreds of years of nightly
// notes. You press tonight's Moon into soft clay with a reed, pull four old tablets off the shelf
// (one for every 18 years), and when they lie side by side their eclipses line up like a song
// repeating. The pattern points to tonight... and the full Moon darkens and turns copper-red.
//
// Layout (world axes: -Z north, +X east). The terrace floor is y = 0 and the city is 24 m below.
// The terrace runs x -10..10, z -12..10. The shrine fills the north end; its front wall is lined with
// tablet shelves, with a long reading desk in front of them. The writing table is east of the middle.
// The full Moon hangs in the south-west, over the river.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, runRoutine, holdProp } from '../people.js';
import { dress } from '../dress.js';
import { makeSmoke, Life } from '../life.js';
import { dirFromAzEl } from '../sky.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { rng } from '../shapes.js';
import { moonFaceTexture } from '../moontex.js';
import { loadProps } from '../props.js';
// Meem's mud-brick house (simplified: the city is all 25 m below you), the Ishtar Gate, and up on the
// terrace the tablet shelves, the scribes' table, clay tablets drying and the brazier, waited for
// before the chapter builds (each falls back to the old code shapes if it is missing)
const PROPS = await loadProps(['house_mudbrick_lo', 'babylon_gate', 'tablet_shelf', 'reading_desk', 'clay_tablet_lo', 'brazier']);
const NIGHT = 0x231c16;   // the models' own faint light, so they don't sink into the dark
import { grove, palm as palmTree } from '../trees.js';

const D2R = Math.PI / 180;
const BASE = -24;                 // the city's ground level, below the terrace
const MOON_AZ = 240, MOON_EL = 32; // the full Moon: south-west, a comfortable look up (exactly opposite the Sun)
const MOON_R = 40, MOON_D = 860;  // drawn about 10 times bigger than life, so the eclipse reads well
const UMBRA = 2.6, PEN = 4.4;     // Earth's shadow at the Moon's distance, in Moon radii (real values)
const ZIG_Z = -1;                 // the ziggurat's middle (the terrace is a little longer than wide)
const TIERS = [[10, 11, 0], [16, 17, -6], [23, 24, -12], [31, 32, -18]]; // half width, half depth, top y
const TAB_W = 0.36, TAB_H = 0.46; // the big tablets on the desk
const PAT = [0.1, 0.22, 0.31, 0.45, 0.55, 0.66, 0.78, 0.9]; // where the eclipses fall on every 18-year tablet
const YEARS = ['72 years ago', '54 years ago', '36 years ago', '18 years ago', 'Tonight'];
const MARKS = [ // the six wedges you press: a little line of cuneiform for "the Moon" (the god Sin, written 30)
  { u: 0.12, v: 0.1, a: 0 }, { u: 0.2, v: 0.1, a: 90 }, { u: 0.3, v: 0.1, a: 200 },
  { u: 0.38, v: 0.1, a: 200 }, { u: 0.46, v: 0.1, a: 200 }, { u: 0.56, v: 0.1, a: 90 },
];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const MOON_SKY = new THREE.Color(0x0e1a3a), MOON_HORIZON = new THREE.Color(0x1c2846);
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));


function glowMat(color = 'rgba(255,200,120,1)', fog = false) {
  const t = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, color); gr.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.35)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog });
}

// Text on a little floating label
function label(text, w = 0.42, color = '#ffe7b0') {
  const t = canvasTex(512, 112, (g, W, H) => {
    g.fillStyle = 'rgba(20,14,6,0.55)'; g.beginPath(); g.roundRect(4, 8, W - 8, H - 16, 30); g.fill();
    g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(text, W / 2, H / 2 + 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(w, w * 112 / 512, 1); return s;
}

// ---------- Clay and cuneiform, drawn on canvases ----------
// One wedge: a triangular head pressed deep, with a thin tail (the reed's edge). a = angle in degrees.
function wedge(g, x, y, s, a, depth = 1) {
  g.save(); g.translate(x, y); g.rotate(a * D2R);
  g.fillStyle = `rgba(60,38,18,${0.75 * depth})`;
  g.beginPath(); g.moveTo(-s * 0.55, -s * 0.5); g.lineTo(s * 0.55, -s * 0.5); g.lineTo(0, s * 0.35); g.closePath(); g.fill();
  g.fillStyle = `rgba(255,236,200,${0.35 * depth})`; // light catching the upper lip
  g.beginPath(); g.moveTo(-s * 0.55, -s * 0.5); g.lineTo(s * 0.55, -s * 0.5); g.lineTo(s * 0.4, -s * 0.38); g.lineTo(-s * 0.4, -s * 0.38); g.fill();
  g.strokeStyle = `rgba(60,38,18,${0.7 * depth})`; g.lineWidth = s * 0.12;
  g.beginPath(); g.moveTo(0, s * 0.3); g.lineTo(0, s * 1.5); g.stroke();
  g.restore();
}
function claySurface(g, w, h, base, seed) {
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,240,210' : '60,40,20'},${0.04 + r() * 0.05})`; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 14, 0, 7); g.fill(); }
  // rounded, darker edges
  const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(40,24,10,0.45)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
}
// An eclipse note: a little Moon with Earth's shadow taking a bite
function eclipseSign(g, x, y, R) {
  g.strokeStyle = 'rgba(60,38,18,0.85)'; g.lineWidth = 4;
  g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke();
  g.fillStyle = 'rgba(60,38,18,0.75)'; g.beginPath(); g.arc(x, y, R, -1.2, 1.2); g.arc(x + R * 0.9, y, R * 0.75, 1.9, -1.9, true); g.fill();
}
// An old tablet: rows of wedges, with an eclipse note at each place in the 18-year pattern
function drawOldTablet(g, w, h, seed) {
  claySurface(g, w, h, '#b8976c', seed);
  const r = rng(seed + 5);
  for (let y = 0.06; y < 0.96; y += 0.052) {
    let x = 0.07; const end = 0.7 + r() * 0.06;
    while (x < end) { const n = 1 + (r() * 4 | 0); for (let i = 0; i < n && x < end; i++) { wedge(g, x * w, y * h, 15, [0, 90, 200][r() * 3 | 0], 0.8); x += 0.035; } x += 0.03 + r() * 0.03; }
    g.strokeStyle = 'rgba(70,45,20,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0.05 * w, (y + 0.026) * h); g.lineTo(0.95 * w, (y + 0.026) * h); g.stroke();
  }
  for (const v of PAT) eclipseSign(g, 0.84 * w, (v + (r() - 0.5) * 0.01) * h, 17);
}

// The Moon: the real near side (shared with the sky's Moon, see js/moontex.js)
const moonTex = moonFaceTexture;

const MOON_VS = `varying vec2 vUv; void main(){ vUv = uv; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p; }`;
const MOON_FS = `
uniform sampler2D map; uniform vec2 shadowC; uniform float umbraR, penR, red, bright;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  if (r > 1.0) discard;
  float limb = 0.72 + 0.28 * sqrt(max(0.0, 1.0 - r * r));
  vec3 alb = texture2D(map, vUv).rgb * limb;
  float d = distance(p, shadowC);
  float umbra = 1.0 - smoothstep(umbraR - 0.14, umbraR + 0.03, d);
  float pen = 1.0 - smoothstep(umbraR, penR, d);
  vec3 lit = alb * vec3(1.0, 0.98, 0.93) * bright * (1.0 - 0.5 * pen);
  // Inside Earth's shadow: sunlight bent through Earth's air, deep copper, brighter toward the shadow's edge
  float edge = smoothstep(umbraR * 0.3, umbraR, d);
  vec3 inside = alb * vec3(0.78, 0.26, 0.1) * (0.06 + 0.62 * red) * (0.6 + 0.55 * edge);
  vec3 col = mix(lit, inside, umbra);
  gl_FragColor = vec4(col, smoothstep(1.0, 0.97, r));
  #include <colorspace_fragment>
}`;

export default class Babylon {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.start = { pos: new THREE.Vector3(-8.2, 0, 2.2), yaw: 0 }; // by the west parapet, looking out over the city
    // Shared progress (sent to friends' headsets)
    this.s = {
      phase: 'arrive', // arrive, write, archive, pattern, predict, lookup, eclipse, total, closing, journal, done
      marks: MARKS.map(() => 0),  // wedges pressed into tonight's tablet
      fetched: [0, 0, 0, 0],      // old tablets pulled off the shelf
      lines: 0,                   // the glowing lines joining the eclipses, 0..1
      mine: 0,                    // your tablet carried over to the end of the row, 0..1
      tonight: 0,                 // the pattern points at tonight
      ecl: 0, red: 0,             // the eclipse: Earth's shadow moving in, then the copper glow
      guide: null,                // [x, y, z] where Astra hovers, or null = out in front of you
      ring: 0, ringAt: [0, 0],    // the glowing "stand here" ring
      watcher: 'idle',            // what the sky-watcher is doing: idle, shelves, tablet, moon
      nod: 0,                     // counts up each time he nods
      journal: 0,                 // 1 = the page is out, 2 = you touched it
      close: 0, closeN: 0, dry: 0, // ch4_02: the big close-up tablet, wedges pressed into it, drying
      sky: 0,                     // ch4_03: 1 the Moon ringed, 2 + the planets, 3 + a comet, 4 + lightning
      ghosts: 0,                  // ch4_05: how many earlier sky-watchers stand in the line
      calm: 0,                    // ch4_08: the watchers calmly write it down while the town is scared
      wheel: 0,                   // ch4_10: 1 sixty minutes, 2 360 degrees, 3 the twelve signs
    };
    G.world.height = () => 0;     // you are on the terrace
    G.world.bounds = 8.8;
    G.world.blockers = [];
    G.sky.fogFar = 1500;
    G.sky.mist = 0;
    G.audio.amb = 0.45;
    // Babylon (32.5° N), 700 BC, a spring night: the real stars of that sky
    G.sky.setPlace({ lat: 32.5, year: -700, sunLon: 0 });
    this.moonDir = dirFromAzEl(MOON_AZ, MOON_EL);

    this.buildZiggurat();
    this.buildTerrace();
    this.buildCity();
    this.buildShelvesAndDesk();
    this.buildWritingTable();
    this.buildPeople();
    this.buildMoon();
    this.buildEffects();
    this.buildJournal();
    this.buildStory();
    this.registerInteractables();
    this.cricketT = 1; this.murmurT = 0; this.drumT = 0; this.shown = { marks: 0, fetched: [0, 0, 0, 0] };
  }

  // ---------- Building the place ----------
  buildZiggurat() {
    const k = new Kit(), r = rng(3);
    const BRICK = [0xb09572, 0xa58a66, 0x9c8160, 0x927858];
    TIERS.forEach(([hx, hz, top], i) => {
      const h = i === TIERS.length - 1 ? top - BASE : 6, cz = ZIG_Z, col = BRICK[i];
      k.box(hx * 2, h, hz * 2, col, [0, top - h / 2, cz]);
      // pilasters: the shallow buttresses that give Mesopotamian walls their ribbed look
      const step = 2.4;
      for (let x = -hx + 1.2; x < hx - 0.6; x += step) for (const sz of [-1, 1]) k.box(0.8, h - 0.4, 0.35, col - 0x080808, [x, top - h / 2 - 0.2, cz + sz * (hz + 0.15)]);
      for (let z = -hz + 1.2; z < hz - 0.6; z += step) for (const sx of [-1, 1]) k.box(0.35, h - 0.4, 0.8, col - 0x080808, [sx * (hx + 0.15), top - h / 2 - 0.2, cz + z]);
      // a dark band of bitumen-and-reed layers near the top of each tier
      k.box(hx * 2 + 0.9, 0.25, hz * 2 + 0.9, 0x5a4632, [0, top - 0.9, cz]);
    });
    // The great stairway up the south face, from the courtyard to the second tier
    const z0 = ZIG_Z + TIERS[1][1], z1 = z0 + 45, steps = 60;
    for (let i = 0; i < steps; i++) {
      const f = i / steps, y = lerp(BASE, TIERS[1][2], f), z = lerp(z1, z0, f);
      k.box(7 - (i % 2) * 0.03, 0.4 + (y - BASE), 0.8, i % 2 ? 0xa48a66 : 0x9e8462, [0, BASE + (y - BASE + 0.4) / 2, z]);   // (every other step a hair narrower: no shared side faces)
    }
    for (const sx of [-1, 1]) k.box(0.8, 1, 46, 0x8e7656, [sx * 3.9, lerp(BASE, TIERS[1][2], 0.5) + 0.5, (z0 + z1) / 2], [Math.atan2(TIERS[1][2] - BASE, 45), 0, 0]);
    // a short stair from the second tier up to the terrace (south side)
    for (let i = 0; i < 10; i++) k.box(3.6, 0.6 * (i + 1), 0.6, 0xa48a66, [0, -6 + 0.3 * (i + 1), ZIG_Z + 11 + 5.7 - i * 0.6]);
    this.root.add(k.mesh());
    void r;
  }

  buildTerrace() {
    const k = new Kit(), G = this.G;
    // Brick floor (textured), the terrace top
    const tex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#6b5640'; g.fillRect(0, 0, w, h);
      const r = rng(8);
      for (let row = 0; row < 8; row++) for (let c = -1; c < 5; c++) {
        const x = c * 64 + (row % 2) * 32, y = row * 32, v = 0.85 + r() * 0.25;
        g.fillStyle = `rgb(${172 * v | 0},${146 * v | 0},${110 * v | 0})`; g.fillRect(x + 2, y + 2, 60, 28);
        for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(60,40,20,${r() * 0.15})`; g.fillRect(x + 4 + r() * 50, y + 4 + r() * 20, 4 + r() * 8, 2 + r() * 4); }
      }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(14, 15);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 22).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
    floor.position.set(0, 0.012, ZIG_Z); this.root.add(floor);   // (1.2 cm over the terrace's own top, so the two never flicker)
    // Parapet around the edge with stepped battlements, a gap where the little stair comes up
    const PAR = 0xa68b67;
    const wall = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
      k.box(0.45, 0.8, len, PAR, [(x0 + x1) / 2, 0.4, (z0 + z1) / 2], [0, yaw, 0]);
      for (let d = 0.4; d < len - 0.2; d += 0.9) {
        const x = lerp(x0, x1, d / len), z = lerp(z0, z1, d / len);
        k.box(0.45, 0.22, 0.45, PAR, [x, 0.91, z], [0, yaw, 0]); k.box(0.26, 0.16, 0.26, PAR, [x, 1.1, z], [0, yaw, 0]);
      }
    };
    const N = ZIG_Z - 11, S = ZIG_Z + 11;
    wall(-9.8, N, -9.8, S); wall(9.8, N, 9.8, S); wall(-9.8, S, -1.9, S); wall(1.9, S, 9.8, S);
    // The shrine on the north end: blue glazed brick, gold bands, stepped battlements, a dark doorway
    const SZ0 = N, SZ1 = ZIG_Z - 6.5, scz = (SZ0 + SZ1) / 2, sd = SZ1 - SZ0;
    const BLUE = 0x2f5aa0, GOLD = 0xd4ac55;
    k.box(15, 4.6, sd, BLUE, [0, 2.3, scz]);
    for (const y of [0.25, 3.0, 4.5]) k.box(15.2, 0.22, sd + 0.2, GOLD, [0, y, scz]);
    for (let x = -7.2; x <= 7.2; x += 0.9) { k.box(0.5, 0.35, 0.5, BLUE, [x, 4.8, SZ1 - 0.25]); k.box(0.3, 0.25, 0.3, BLUE, [x, 5.08, SZ1 - 0.25]); }
    k.box(1.6, 2.7, 0.2, 0x0e0a08, [0, 1.35, SZ1 + 0.02]);                 // doorway
    for (const sx of [-1, 1]) k.box(0.35, 3.2, 0.35, GOLD, [sx * 1.0, 1.6, SZ1 + 0.1]); // door posts
    // Rosettes along the gold band (the flower pattern of Babylon's glazed walls)
    for (let x = -6.6; x <= 6.6; x += 1.1) if (Math.abs(x) > 1.4) {
      k.cyl(0.15, 0.15, 0.03, 12, 0xf2e8c8, [x, 3.6, SZ1 + 0.02], [Math.PI / 2, 0, 0]);
      k.cyl(0.06, 0.06, 0.04, 8, 0xd4ac55, [x, 3.6, SZ1 + 0.03], [Math.PI / 2, 0, 0]);
    }
    // A low brazier on the east side, and tablets drying in a row on the east parapet's ledge
    const P = PROPS.fresh();
    if (!P.add('brazier', 8.4, 0.01, ZIG_Z + 6, 0, { w: 0.9, h: 0.45 })) k.cyl(0.35, 0.25, 0.5, 10, 0x4a3a2a, [8.4, 0.25, ZIG_Z + 6]);
    this.root.add(k.mesh(), P.build({ glow: NIGHT }));
    G.world.blockers.push({ x: 8.4, z: ZIG_Z + 6, r: 0.5 });
    // Can't walk into the shrine (a row of round blockers along its front, behind the shelves)
    for (let x = -9.4; x <= 9.4; x += 0.5) G.world.blockers.push({ x, z: SZ1 - 0.1, r: 0.6 });
    this.shrineFront = SZ1;
  }

  buildCity() {
    const k = new Kit(), r = rng(19), lights = [], torches = [];
    const inTemenos = (x, z) => Math.abs(x) < 104 && Math.abs(z - ZIG_Z) < 104;
    const RIVER = -150, riverW = 34;
    const MUD = [0x9a8262, 0xa38a68, 0x8f7758, 0xb09774, 0x86705a];
    // Houses: flat mudbrick roofs on a rough grid of streets, all the way out to the city walls
    // the Ishtar Gate model's footprint (built below at x 112 on the north wall, 25 m tall): no house in it
    const GS = PROPS.size('babylon_gate'), gHW = GS ? GS.x * 25 / GS.y / 2 + 1 : 0, gHD = GS ? GS.z * 25 / GS.y / 2 + 1 : 0;
    for (let gx = -436; gx <= 436; gx += 15) for (let gz = -436; gz <= 436; gz += 15) {
      const x = gx + (r() - 0.5) * 4, z = gz + (r() - 0.5) * 4;
      if (inTemenos(x, z) || Math.abs(x - RIVER) < riverW + 14 || Math.abs(x - 112) < 9 || r() < 0.22) continue;
      if (Math.hypot(x - 0, z - 170) < 55 || Math.hypot(x + 85, z + 300) < 70) continue; // the big temple and the palace
      const w = 8 + r() * 5, d = 8 + r() * 5, h = 3.2 + r() * (r() < 0.25 ? 5 : 2.5), col = MUD[r() * 5 | 0];
      const yaw = (r() - 0.5) * 0.12;
      if (GS && Math.abs(x - 112) < gHW + w / 2 && Math.abs(z + 440) < gHD + d / 2) continue;
      if (PROPS.has('house_mudbrick_lo') && Math.hypot(x, z - ZIG_Z) < 175) {
        // nearer houses: Meem's mud-brick house (it has its own roof room and door, facing +z)
        PROPS.add('house_mudbrick_lo', x, BASE, z, yaw, { w, d, h: h + 1.2 });
        r();
      } else {
        k.box(w, h, d, col, [x, BASE + h / 2, z], [0, yaw, 0]);
        if (r() < 0.6) k.box(w * 0.35, 1.8, d * 0.35, col, [x + (r() - 0.5) * w * 0.4, BASE + h + 0.9, z + (r() - 0.5) * d * 0.4], [0, yaw, 0]); // a roof room
        k.box(1.1, 1.9, 0.2, 0x2a2018, [x, BASE + 0.95, z + d / 2 + 0.05], [0, yaw, 0]); // door
      }
      if (r() < 0.33) lights.push(x + (r() - 0.5) * 2, BASE + 1.3, z + d / 2 + 0.4);   // a lamp in the doorway
      if (r() < 0.12) lights.push(x, BASE + h + 0.6, z);                               // a fire on the roof
    }
    // The ziggurat's walled courtyard, with tower-gates
    const T = 104, TW = 0x9c8462;
    for (const [x0, z0, x1, z1] of [[-T, -T, T, -T], [-T, T, T, T], [-T, -T, -T, T], [T, -T, T, T]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
      k.box(3, 9, len, TW, [(x0 + x1) / 2, BASE + 4.5, ZIG_Z + (z0 + z1) / 2], [0, yaw, 0]);
      for (let d = 0; d <= len; d += 16) k.box(5, 12, 5, TW, [lerp(x0, x1, d / len), BASE + 6, ZIG_Z + lerp(z0, z1, d / len)], [0, yaw, 0]);
    }
    // Houses for the temple's priests and sky-watchers inside the courtyard, along its walls
    for (let i = 0; i < 40; i++) {
      const side = i % 4, t = -90 + (i / 4 | 0) * 18 + r() * 4, x = side < 2 ? t : (side === 2 ? -92 : 92), z = side < 2 ? (side ? 92 : -92) : t;
      if (Math.abs(x) < 12 && z > 0) continue;
      // facing in, toward the tower
      if (!PROPS.add('house_mudbrick_lo', x, BASE, ZIG_Z + z, Math.atan2(-x, -z), { w: 12, d: 9, h: 5.5 })) k.box(12, 5, 9, 0xa08866, [x, BASE + 2.5, ZIG_Z + z]);
    }
    // Esagila, the great temple of Marduk, south of the tower
    k.box(70, 10, 60, 0x9e8664, [0, BASE + 5, 170]);
    k.box(36, 16, 26, 0xa68d6a, [0, BASE + 8, 160]);
    for (let x = -16; x <= 16; x += 2.6) k.box(0.9, 15, 0.4, 0x988060, [x, BASE + 7.5, 173.2]);
    k.box(6, 7, 0.3, 0x1a140e, [0, BASE + 3.5, 200.2]);
    // The king's palace by the river, north-west
    k.box(120, 14, 80, 0xa08866, [-85, BASE + 7, -300]); k.box(50, 22, 40, 0xab9270, [-70, BASE + 11, -310]);
    // The city walls with towers every 20 m
    const W = 440;
    // The Ishtar Gate: blue glazed brick with gold lions and bulls, where the Processional Way leaves
    // the city through the north wall (the wall is split round it)
    const GX = 112, GP = PROPS.fresh(), gate = GP.add('babylon_gate', GX, BASE, -W, 0, { h: 25 }), GH = gate ? GP.size('babylon_gate').x * 25 / GP.size('babylon_gate').y / 2 - 1 : 0;
    if (gate) this.root.add(GP.build({ glow: NIGHT }));
    for (const [x0, z0, x1, z1] of [[-W, -W, W, -W], [-W, W, W, W], [-W, -W, -W, W], [W, -W, W, W]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
      if (gate && z0 === -W && z1 === -W) {
        for (const [a, b] of [[x0, GX - GH], [GX + GH, x1]]) k.box(8, 14, b - a, 0x8a7356, [(a + b) / 2, BASE + 7, z0], [0, yaw, 0]);
      } else k.box(8, 14, len, 0x8a7356, [(x0 + x1) / 2, BASE + 7, (z0 + z1) / 2], [0, yaw, 0]);
      for (let d = 0; d <= len; d += 20) {
        const x = lerp(x0, x1, d / len), z = lerp(z0, z1, d / len);
        if (Math.abs(x - RIVER) < riverW + 2) continue;
        if (gate && z0 === -W && z1 === -W && Math.abs(x - GX) < GH + 6) continue;
        k.box(11, 19, 11, 0x8f7759, [x, BASE + 9.5, z], [0, yaw, 0]);
      }
    }
    // Torches along the Processional Way, the broad street east of the courtyard
    for (let z = -420; z <= 420; z += 14) for (const sx of [-1, 1]) torches.push(112 + sx * 6.5, BASE + 2.2, z);
    this.root.add(k.mesh());
    this.root.add(PROPS.build());

    // Ground: paved courtyard, dusty streets, green fields by the river, desert beyond the walls
    const g = new THREE.PlaneGeometry(2600, 2600, 130, 130); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const pave = new THREE.Color(0x9a8868), dirt = new THREE.Color(0x76634a), field = new THREE.Color(0x3c5530), sand = new THREE.Color(0x8e7a5a), bank = new THREE.Color(0x4a4030);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), dr = Math.abs(x - RIVER);
      p.setY(i, BASE + (dr < riverW ? -1.2 : 0));
      const inside = Math.abs(x) < W && Math.abs(z) < W;
      c.copy(inside ? dirt : sand);
      if (!inside && dr < 260 && r() < 0.85) c.lerp(field, 0.85);
      if (inTemenos(x, z)) c.copy(pave);
      if (dr < riverW + 6) c.copy(bank);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    this.root.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
    // The Euphrates: dark water, with the moonlight glittering on it
    const river = new THREE.Mesh(new THREE.PlaneGeometry(riverW * 2, 2600).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x15283c, emissive: 0x050a12 }));
    river.position.set(RIVER, BASE - 0.4, 0); this.root.add(river);
    const glitTex = canvasTex(128, 256, (gg, w, h) => {
      const rr = rng(4);
      for (let i = 0; i < 260; i++) { const y = rr() * h, x = w / 2 + (rr() - 0.5) * w * (0.25 + 0.75 * rr()) * 0.9; gg.fillStyle = `rgba(230,235,255,${0.2 + rr() * 0.6})`; gg.fillRect(x, y, 3 + rr() * 10, 1.5); }
    });
    glitTex.wrapT = THREE.RepeatWrapping;
    const t = (RIVER - 0) / Math.sin(MOON_AZ * D2R), gp = new THREE.Vector3(Math.sin(MOON_AZ * D2R) * t, BASE - 0.3, ZIG_Z - Math.cos(MOON_AZ * D2R) * t);
    this.glitter = new THREE.Mesh(new THREE.PlaneGeometry(riverW * 1.9, 150).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glitTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    this.glitter.position.copy(gp); this.glitter.rotation.y = 0; this.root.add(this.glitter);

    // Date palms along both banks and in the gardens
    this.buildPalms(RIVER, riverW);
    // City lights: lamps in doorways, fires on roofs, torches along the Processional Way
    const pts = (arr, size, color) => {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const m = new THREE.PointsMaterial({ size, color, map: glowMat().map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
      const o = new THREE.Points(geo, m); this.root.add(o); return o;
    };
    this.cityLights = [pts(lights, 3.2, 0xffb060), pts(torches, 4.5, 0xff9a40)];
  }

  // ---------- Story pieces timed to the narration ----------
  buildStory() {
    const G = this.G;
    this.life = new Life(this.root);
    // smoke from a few rooftop fires and bread ovens around the courtyard
    for (const [x, z] of [[-40, 60], [55, -40], [-70, -30], [30, 90]]) this.life.add(makeSmoke(new THREE.Vector3(x, BASE + 5, z), { rise: 14, size: 3, color: 0x8a8070, opacity: 0.22 }));
    // townspeople in the courtyard stroll about until the Moon starts to go dark
    const town = this.people.filter((P) => P.role === 'town' && P.g.position.y <= BASE + 0.1);
    town.forEach((P, i) => { const h = P.home; P.routine = [{ x: h.x, z: h.z, pose: 'idle', secs: 4 + i }, { x: h.x + 6 - (i % 3) * 5, z: h.z - 5 - (i % 2) * 6, pose: i % 2 ? 'talk' : 'idle', secs: 5 }]; P.ri = i % 2; P.stroll = true; });
    // ch4_02: a close-up of a clay tablet, floating in front of you: a reed presses wedges in, then it dries
    this.closeCv = document.createElement('canvas'); this.closeCv.width = 256; this.closeCv.height = 320;
    this.closeTex = new THREE.CanvasTexture(this.closeCv); this.closeTex.colorSpace = THREE.SRGBColorSpace;
    this.close = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.625), new THREE.MeshBasicMaterial({ map: this.closeTex, transparent: true, opacity: 0, fog: false }));
    const rk = new Kit(); rk.cyl(0.006, 0.008, 0.3, 5, 0xc8b070, [0, 0.15, 0]); rk.box(0.012, 0.02, 0.012, 0x9a8050, [0, 0, 0]);
    this.closeReed = rk.mesh(); this.closeReed.visible = false; this.root.add(this.closeReed);
    this.close.visible = false; this.root.add(this.close); this.drawClose(0, 0);
    this.watcherReed = this.closeReed.clone(); this.watcherReed.visible = true; holdProp(this.watcher, this.watcherReed, 'Right', [0, 0.06, 0.02]); this.watcherReed.visible = false;
    // ch4_03: what the watchers wrote down: the Moon, the planets, a comet, the weather
    const add = (o) => { o.visible = false; this.root.add(o); return o; };
    this.skyBits = new THREE.Group(); this.root.add(this.skyBits);
    this.moonRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.moonRing.position.copy(this.moonDir).multiplyScalar(830); this.moonRing.lookAt(0, 0, 0); this.moonRing.scale.setScalar(MOON_R * 1.9); this.skyBits.add(this.moonRing);
    this.planets = [['Jupiter', 286, 27, 'rgba(255,246,220,1)', 14], ['Mars', 302, 14, 'rgba(255,150,100,1)', 10]].map(([name, az, el, col, sz]) => {
      const g = new THREE.Group(), sp = new THREE.Sprite(glowMat(col)); sp.scale.setScalar(sz); g.add(sp);
      const lb = label(name, 60); lb.position.y = -12; g.add(lb); g.position.copy(dirFromAzEl(az, el)).multiplyScalar(800);
      g.userData.mats = [sp.material, lb.material]; this.skyBits.add(g); return g;
    });
    const ct = canvasTex(256, 32, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(180,220,255,0)'); gr.addColorStop(0.85, 'rgba(210,235,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h * 0.15); g.lineTo(w, h * 0.85); g.fill(); });
    this.comet = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.12), new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
    this.comet.scale.setScalar(130); this.skyBits.add(this.comet);
    this.flash = new THREE.Sprite(glowMat('rgba(220,225,255,1)')); this.flash.position.copy(dirFromAzEl(298, 2)).multiplyScalar(700); this.flash.scale.set(500, 160, 1); this.flash.material.opacity = 0; this.skyBits.add(this.flash);
    // ch4_05: the notes of the watchers before him, one after another, back through the years: a line of
    // little tables, each piled with one watcher's clay tablets, older and darker the further back they go,
    // each lit by its own oil lamp as Astra names them
    this.ghosts = [];
    for (let i = 0; i < 5; i++) {
      const k = new Kit(), r = rng(600 + i), wood = [0x6a4a2c, 0x5e4228, 0x553c24, 0x4c3620, 0x43301c][i];
      k.box(0.56, 0.04, 0.38, wood, [0, 0.58, 0]);
      for (const [x, z] of [[-0.24, -0.15], [0.24, -0.15], [-0.24, 0.15], [0.24, 0.15]]) k.box(0.04, 0.56, 0.04, wood, [x, 0.28, z]);
      k.box(0.48, 0.03, 0.3, wood, [0, 0.14, 0]);                                                         // a shelf under it
      // the tablets: a pile on top and a few leaning, older ones darker and more worn
      const clay = new THREE.Color(0xc8a070).lerp(new THREE.Color(0x6a5440), i / 5);
      const tab = (x, y, z, rx, ry) => { const c = clay.clone().multiplyScalar(0.9 + r() * 0.2); k.box(0.1, 0.035, 0.14, c.getHex(), [x, y, z], [rx, ry, 0]); };
      for (let j = 0; j < 3 + i; j++) tab(-0.12 + r() * 0.04, 0.618 + j * 0.036, -0.02 + r() * 0.04, 0, (r() - 0.5) * 0.4);
      for (let j = 0; j < 3; j++) tab(-0.02 + j * 0.105, 0.66, 0.08, -1.1, 0);   // side by side, not overlapping
      for (let j = 0; j < 2 + (i % 3); j++) tab(-0.15 + j * 0.13, 0.173, 0, 0, (r() - 0.5) * 0.6);
      k.add(new THREE.LatheGeometry([[0, 0], [0.04, 0.005], [0.045, 0.025], [0.015, 0.035], [0, 0.035]].map(([a, b]) => new THREE.Vector2(a, b)), 8), 0xa0603a, [0.18, 0.6, -0.1]);   // the lamp
      const g = new THREE.Group(); g.add(k.mesh(FLAT));
      const flame = new THREE.Sprite(glowMat('rgba(255,180,90,1)')); flame.position.set(0.18, 0.7, -0.1); flame.scale.setScalar(0.5); flame.material.opacity = 0; g.add(flame);
      g.position.set(this.deskX - 1.5 - i * 0.95, 0, this.shrineFront + 0.95 + i * 0.25); g.rotation.y = 0.5 + i * 0.05; g.visible = false; g.userData.flame = flame;
      this.root.add(g); this.ghosts.push(g);
    }
    // ch4_10: what Babylon left us: sixty minutes, 360 degrees, the twelve signs of the zodiac
    const face = (kind) => canvasTex(512, 512, (g, w) => {
      const c = w / 2, R = 220; g.strokeStyle = '#ffe2a8'; g.fillStyle = '#ffe2a8'; g.lineWidth = 6;
      g.beginPath(); g.arc(c, c, R, 0, 6.283); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (kind === 0) {
        for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283, l = i % 5 ? 14 : 30; g.lineWidth = i % 5 ? 3 : 6; g.beginPath(); g.moveTo(c + Math.sin(a) * (R - 6), c - Math.cos(a) * (R - 6)); g.lineTo(c + Math.sin(a) * (R - 6 - l), c - Math.cos(a) * (R - 6 - l)); g.stroke(); }
        g.lineWidth = 8; g.beginPath(); g.moveTo(c, c); g.lineTo(c, c - R * 0.7); g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(c, c); g.lineTo(c + R * 0.45, c + R * 0.2); g.stroke();
        g.font = 'bold 54px Georgia, serif'; g.fillText('60 minutes', c, c + R * 0.45);
      } else if (kind === 1) {
        for (let i = 0; i < 36; i++) { const a = i / 36 * 6.283, l = i % 9 ? 14 : 34; g.lineWidth = i % 9 ? 3 : 6; g.beginPath(); g.moveTo(c + Math.sin(a) * (R - 6), c - Math.cos(a) * (R - 6)); g.lineTo(c + Math.sin(a) * (R - 6 - l), c - Math.cos(a) * (R - 6 - l)); g.stroke(); }
        g.font = 'bold 34px Georgia, serif'; [['0°', 0], ['90°', 90], ['180°', 180], ['270°', 270]].forEach(([tx, d]) => { const a = d * D2R; g.fillText(tx, c + Math.sin(a) * (R - 70), c - Math.cos(a) * (R - 70)); });
        g.font = 'bold 64px Georgia, serif'; g.fillText('360°', c, c);
      } else {
        const signs = ['♈︎', '♉︎', '♊︎', '♋︎', '♌︎', '♍︎', '♎︎', '♏︎', '♐︎', '♑︎', '♒︎', '♓︎'];
        for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * 6.283; g.lineWidth = 3; g.beginPath(); g.moveTo(c + Math.sin(i / 12 * 6.283) * R, c - Math.cos(i / 12 * 6.283) * R); g.lineTo(c + Math.sin(i / 12 * 6.283) * (R - 80), c - Math.cos(i / 12 * 6.283) * (R - 80)); g.stroke();
          g.font = '52px "Segoe UI Symbol", "Noto Sans Symbols", "Apple Symbols", serif'; g.fillText(signs[i], c + Math.sin(a) * (R - 40), c - Math.cos(a) * (R - 40)); }
        g.beginPath(); g.arc(c, c, R - 80, 0, 6.283); g.stroke();
        g.font = 'bold 40px Georgia, serif'; g.fillText('12 signs', c, c - 10); g.font = '28px Georgia, serif'; g.fillText('of the zodiac', c, c + 30);
      }
    });
    this.wheelMats = [0, 1, 2].map((k) => new THREE.MeshBasicMaterial({ map: face(k), transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.wheel = new THREE.Group(); for (const m of this.wheelMats) this.wheel.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m));
    this.wheel.visible = false; this.root.add(this.wheel);
  }

  updateStory(dt, t) {
    const G = this.G, s = this.s;
    this.life.update(dt, t);
    G.camera.getWorldPosition(_c);
    // the close-up tablet, out in front of you, and the reed pressing into it
    this.closeV = damp(this.closeV || 0, s.close ? 1 : 0, 3, dt);
    this.close.visible = this.closeReed.visible = this.closeV > 0.01;
    if (this.close.visible) {
      if (!this.closeSet) { this.closeSet = true; G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize(); this.close.position.copy(_c).addScaledVector(_b, 0.9).add(_a.set(-_b.z * 0.25, -0.15, _b.x * 0.25)); }
      this.close.lookAt(_c); this.close.material.opacity = this.closeV;
      this.dryV = damp(this.dryV || 0, s.dry, 0.8, dt);
      const key = s.closeN * 100 + Math.round(this.dryV * 20);
      if (key !== this.closeKey) { this.closeKey = key; this.drawClose(s.closeN, this.dryV); if (this.lastN !== s.closeN && s.closeN) this.squish(this.close.position); this.lastN = s.closeN; }
      // the reed: hops to the next spot and presses in (gone once it starts to dry)
      const n = Math.min(11, s.closeN), row = Math.floor(n / 4), col = n % 4;
      _a.set((50 + col * 50 + (row % 2) * 10) / 256 - 0.5, 0.5 - (70 + row * 70) / 320, 0).multiply(_b.set(0.5, 0.625, 1));
      this.closeReed.position.copy(_a).applyQuaternion(this.close.quaternion).add(this.close.position);
      _b.set(0, 0, 1).applyQuaternion(this.close.quaternion);
      this.closeReed.position.addScaledVector(_b, 0.03 + 0.04 * Math.abs(Math.sin(t * 9)));
      this.closeReed.quaternion.copy(this.close.quaternion); this.closeReed.rotateX(-1.2);
      this.closeReed.visible = this.close.visible && s.dry < 1;
    } else this.closeSet = false;
    this.watcherReed.visible = s.watcher === 'write' || (s.calm && s.ecl > 0.3);
    // ch4_03: the Moon ringed, the planets, a comet, a flash of lightning far off
    this.skyBits.position.copy(_c);
    const sk = s.sky;
    this.moonRing.material.opacity = damp(this.moonRing.material.opacity, sk >= 1 ? 0.7 : 0, 3, dt); this.moonRing.scale.setScalar(MOON_R * (1.9 + 0.1 * Math.sin(t * 3)));
    for (const pl of this.planets) for (const m of pl.userData.mats) m.opacity = damp(m.opacity, sk >= 2 ? 1 : 0, 2.5, dt);
    if (sk >= 3 && this.cometT == null) this.cometT = 0;
    if (this.cometT != null) {
      this.cometT += dt / 3.2; const k = Math.min(1, this.cometT);
      dirFromAzEl(lerp(262, 318, k), lerp(46, 22, k), this.comet.position).multiplyScalar(780);
      dirFromAzEl(lerp(262, 318, k + 0.02), lerp(46, 22, k + 0.02), _a).multiplyScalar(780);
      this.comet.lookAt(0, 0, 0); this.comet.material.opacity = Math.sin(Math.PI * k) * 0.9;
      // point the streak along its path (head first)
      _b.copy(_a).sub(this.comet.position).normalize(); const up = _b.dot(_a.set(0, 1, 0).applyQuaternion(this.comet.quaternion)), right = _b.dot(_a.set(1, 0, 0).applyQuaternion(this.comet.quaternion));
      this.comet.rotateZ(Math.atan2(up, right));
      if (k >= 1 && sk < 3) this.cometT = null;
    }
    this.flash.material.opacity = sk >= 4 ? Math.max(0, Math.sin(t * 17) * Math.sin(t * 5.3)) * 0.8 * (Math.sin(t * 0.9) > 0.3 ? 1 : 0) : 0;
    // ch4_05: the notes of the earlier watchers
    this.ghostV = damp(this.ghostV || 0, s.ghosts, 2, dt);
    this.ghosts.forEach((g, i) => {
      const k = clamp(this.ghostV - i, 0, 1); g.visible = s.phase === 'archive' || this.ghostV > 0.02;   // the tables wait in the dark; the lamps light one by one
      if (!g.visible) return;
      g.userData.flame.material.opacity = k * k * (0.75 + 0.15 * Math.sin(t * 9 + i * 2));
    });
    // ch4_10: the clock, the circle, the zodiac, out under the Moon
    const wv = s.wheel;
    this.wheelMats.forEach((m, i) => { m.opacity = damp(m.opacity, wv === i + 1 ? 0.9 : 0, 2.5, dt); });
    this.wheel.visible = this.wheelMats.some((m) => m.opacity > 0.01);
    if (this.wheel.visible) { this.wheel.position.copy(dirFromAzEl(MOON_AZ + 22, MOON_EL - 16)).multiplyScalar(40).add(_c); this.wheel.scale.setScalar(16); this.wheel.lookAt(_c); this.wheel.rotateZ(Math.sin(t * 0.3) * 0.05); }
  }

  // The close-up tablet: n wedges pressed in, dry = 0 (dark wet clay) .. 1 (pale, baked hard)
  drawClose(n, dry) {
    const g = this.closeCv.getContext('2d'), w = 256, h = 320;
    const wet = [106, 84, 62], dr = [200, 176, 136], c = wet.map((v, i) => Math.round(lerp(v, dr[i], dry)));
    g.clearRect(0, 0, w, h); g.fillStyle = `rgb(${c})`; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 26); g.fill();
    g.fillStyle = `rgba(255,255,255,${0.12 * (1 - dry)})`; g.beginPath(); g.ellipse(90, 70, 60, 26, -0.4, 0, 6.283); g.fill();   // wet shine
    for (let i = 0; i < n; i++) { const row = Math.floor(i / 4), col = i % 4; wedge(g, 50 + col * 50 + (row % 2) * 10, 70 + row * 70, 20, [0, 90, 45, 0][(i * 7) % 4], 1); }
    this.closeTex.needsUpdate = true;
  }

  buildPalms(RIVER, riverW) {
    const r = rng(41), near = [], far = [];
    // real date palms (js/trees.js); the ones near the ziggurat in more detail
    const palm = (x, z, s) => { (Math.hypot(x, z - ZIG_Z) < 160 ? near : far).push({ x, y: BASE - 0.2, z, s: s * (0.8 + r() * 0.3) }); };
    for (let i = 0; i < 260; i++) {
      const side = r() < 0.5 ? -1 : 1, x = RIVER + side * (riverW + 5 + r() * 40), z = -1100 + r() * 2200;
      palm(x, z, 0.9 + r() * 0.3);
    }
    for (let i = 0; i < 40; i++) { const x = (r() - 0.5) * 180, z = ZIG_Z + (r() < 0.5 ? -1 : 1) * (60 + r() * 34); if (Math.abs(x) > 40) palm(x, z, 0.85 + r() * 0.2); }
    if (near.length) this.root.add(grove(palmTree, near, { detail: 'mid', height: 11, dates: true, seed: 41, variants: 5 }).group);
    if (far.length) this.root.add(grove(palmTree, far, { detail: 'low', height: 11, seed: 43, variants: 4 }).group);
  }

  // The tablet shelves along the shrine's front wall, and the reading desk in front of them
  buildShelvesAndDesk() {
    const k = new Kit(), r = rng(55), F = this.shrineFront;
    const SHELF_Z = F + 0.2, WOOD = 0x6e4e30;
    // Meem's tablet shelves (two to each side, 2.1 m tall, full of tablets of their own): the four
    // glowing tablets wait on their boards (heights measured off the model, x 1.05)
    const SP = PROPS.fresh(), model = false;   // (Meem's tablet_shelf: its own stretched tablets poked through the posts and hid the glowing ones, so the code shelves stay for now)
    const ROWS = model ? [0.44, 0.80, 1.17, 1.52, 1.90] : [0.32, 0.74, 1.16, 1.58, 2.0];
    this.shelfSpots = [];
    if (model) {
      for (const [x0, x1] of [[-6.8, -1.4], [1.4, 6.8]]) for (const h of [0, 1]) SP.add('tablet_shelf', x0 + (x1 - x0) * (h + 0.5) / 2, 0.01, SHELF_Z, 0, { w: (x1 - x0) / 2, h: 2.1, d: 0.44 });
      this.root.add(SP.build({ glow: NIGHT }));
    }
    for (const [x0, x1] of model ? [] : [[-6.8, -1.4], [1.4, 6.8]]) {
      k.box(x1 - x0, 0.06, 0.42, WOOD, [(x0 + x1) / 2, 2.38, SHELF_Z]);
      for (const y of ROWS) {
        k.box(x1 - x0, 0.05, 0.42, WOOD, [(x0 + x1) / 2, y - 0.025, SHELF_Z]);
        for (let x = x0 + 0.13; x < x1 - 0.1; x += 0.15) this.shelfSpots.push([x, y, x0 < 0]);
      }
      for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 4) k.box(0.07, 2.42, 0.44, WOOD - 0x0a0806, [x, 1.21, SHELF_Z]);   // (1 cm proud of the boards, front and back)
      k.box(x1 - x0, 2.4, 0.04, 0x3a2a1c, [(x0 + x1) / 2, 1.2, SHELF_Z - 0.2]);
    }
    // The reading desk: a long sloping board on legs, right in front of the left shelves
    this.deskX = -4.0; const DZ = F + 0.68, DY = 0.92, TILT = 52 * D2R;
    k.box(2.9, 0.05, 0.5, 0x7a5636, [this.deskX, DY, DZ], [-(Math.PI / 2 - TILT), 0, 0]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, DY, 0.07, WOOD, [this.deskX + sx * 1.35, DY / 2, DZ + sz * 0.15]);
    k.box(2.9, 0.04, 0.06, WOOD, [this.deskX, DY - 0.2, DZ + 0.16]); // the ledge the tablets rest on
    this.root.add(k.mesh());
    // A frame on the desk's surface: x along the desk, y up the slope, z out of the board
    this.desk = new THREE.Group();
    this.desk.position.set(this.deskX, DY + 0.05, DZ + 0.02);
    this.desk.rotation.x = -(Math.PI / 2 - TILT);
    this.root.add(this.desk); this.desk.updateMatrixWorld(true);
    this.slotX = [-0.9, -0.45, 0, 0.45, 0.9];

    // Hundreds of tablets on the shelves (one small tablet shape, repeated)
    const tg = new THREE.BoxGeometry(0.12, 0.17, 0.035); tg.translate(0, 0.085, 0);
    const keep = new Set();
    // four spots on the left shelves at hand height stay empty for the glowing ones
    this.special = [[-5.15, ROWS[2]], [-4.55, ROWS[3]], [-3.75, ROWS[2]], [-3.05, ROWS[3]]];
    const shelfTabs = new THREE.InstancedMesh(tg, new THREE.MeshLambertMaterial({ color: 0xffffff }), this.shelfSpots.length + 24);
    const m = new THREE.Matrix4(), cc = new THREE.Color(); let n = 0;
    for (const [x, y] of this.shelfSpots) {
      if (this.special.some(([sx, sy]) => Math.abs(sx - x) < 0.2 && Math.abs(sy - y) < 0.05)) continue;
      if (r() < 0.1) continue;
      _q.setFromEuler(new THREE.Euler(-0.08 - r() * 0.12, (r() - 0.5) * 0.3, (r() - 0.5) * 0.08));
      m.compose(_a.set(x, y, SHELF_Z + 0.02), _q, _b.set(1, 0.9 + r() * 0.25, 1)); shelfTabs.setMatrixAt(n, m);
      shelfTabs.setColorAt(n++, cc.setHex(0xb89a72).multiplyScalar(0.75 + r() * 0.35));
    }
    // a row drying on top of the east parapet (Meem's clay tablet, lying face up, if it loaded): two
    // side by side in each gap between the battlements (wall top 0.8 m, battlements every 0.9 m from 0.4 m)
    const DP = PROPS.fresh();
    for (let i = 0; i < 24; i++) {
      const rz = (r() - 0.5) * 0.3, dx = (r() - 0.5) * 0.03, x = 9.8 + (i & 1 ? 0.11 : -0.11) + dx;
      const z = ZIG_Z - 11 + 0.85 + 0.9 * (6 + (i >> 1));   // the middle of a gap
      // (the model lies down from its foot toward -z: set its foot half a tablet past the gap's middle)
      if (DP.add('clay_tablet_lo', x, 0.805, z + 0.06, 0, { w: 0.13, tilt: [-Math.PI / 2, rz] })) continue;
      _q.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rz));
      m.compose(_a.set(x, 0.82, z + 0.085), _q, _b.set(1, 1, 1)); shelfTabs.setMatrixAt(n, m);
      shelfTabs.setColorAt(n++, cc.setHex(0x9e7c56).multiplyScalar(0.8 + r() * 0.2));
    }
    shelfTabs.count = n; void keep;
    if (n) this.root.add(shelfTabs);
    this.root.add(DP.build({ glow: NIGHT }));

    // The four old tablets you pull down (one for every 18 years), big and glowing on the shelf
    this.old = [];
    for (let i = 0; i < 4; i++) {
      const T = this.makeTablet((g, w, h) => drawOldTablet(g, w, h, 300 + i * 17));
      const [sx, sy] = this.special[i];
      T.userData.shelfPos = new THREE.Vector3(sx, sy + TAB_H * 0.32, SHELF_Z + 0.06);
      T.userData.shelfQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, (r() - 0.5) * 0.2, 0));
      T.userData.shelfScale = 0.62;
      T.position.copy(T.userData.shelfPos); T.quaternion.copy(T.userData.shelfQuat); T.scale.setScalar(0.62);
      T.userData.fly = 0; T.userData.slot = i;
      const glow = new THREE.Sprite(glowMat('rgba(255,210,120,1)')); glow.scale.setScalar(0.75); glow.position.z = 0.02; T.add(glow); T.userData.glow = glow;
      this.root.add(T); this.old.push(T);
      const L = label(YEARS[i], 0.34); L.position.set(this.slotX[i], TAB_H / 2 + 0.07, 0.05); L.visible = false; this.desk.add(L); T.userData.label = L;
    }
    const L5 = label(YEARS[4], 0.34, '#ffd27a'); L5.position.set(this.slotX[4], TAB_H / 2 + 0.07, 0.05); L5.visible = false; this.desk.add(L5); this.tonightLabel = L5;

    // Glowing lines that join the same eclipse on every tablet: one line per place in the pattern
    this.lineMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.lines = [];
    const markX = (i) => this.slotX[i] + (0.84 - 0.5) * TAB_W, markY = (v) => (0.5 - v) * TAB_H;
    PAT.forEach((v, j) => {
      const x0 = markX(0), x1 = markX(3), len = x1 - x0;
      const geo = new THREE.PlaneGeometry(1, 0.008); geo.translate(0.5, 0, 0);
      const ln = new THREE.Mesh(geo, this.lineMat); ln.position.set(x0, markY(v), 0.058); ln.userData.len = len; ln.scale.x = 0.0001;
      this.desk.add(ln); this.lines.push(ln);
    });
    // ...and the line that runs on from the last tablet into tonight's
    const geo = new THREE.PlaneGeometry(1, 0.012); geo.translate(0.5, 0, 0);
    this.tonightMat = this.lineMat.clone(); this.tonightMat.color.setHex(0xffe08a);
    this.tonightLine = new THREE.Mesh(geo, this.tonightMat); this.tonightLine.position.set(markX(3), markY(PAT[0]), 0.06);
    this.tonightLine.userData.len = markX(4) - markX(3); this.tonightLine.scale.x = 0.0001; this.desk.add(this.tonightLine);
    // little glows on each eclipse mark, and a big one on tonight's place
    this.markGlows = [];
    const gm = glowMat('rgba(255,200,110,1)');
    for (let i = 0; i < 4; i++) for (const v of PAT) { const sp = new THREE.Sprite(gm); sp.position.set(markX(i), markY(v), 0.062); sp.scale.setScalar(0.07); sp.visible = false; this.desk.add(sp); this.markGlows.push(sp); }
    this.tonightGlow = new THREE.Sprite(glowMat('rgba(255,120,70,1)')); this.tonightGlow.position.set(markX(4), markY(PAT[0]), 0.065); this.tonightGlow.scale.setScalar(0.001); this.desk.add(this.tonightGlow);
    // where each slot is in the world (for the flights)
    this.slotPos = this.slotX.map((x) => this.desk.localToWorld(new THREE.Vector3(x, 0, 0.026)));
    this.slotQuat = this.desk.getWorldQuaternion(new THREE.Quaternion());
  }

  // A big tablet: a clay slab with a drawn face. The group's origin is the middle of its back.
  makeTablet(draw) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(TAB_W, TAB_H, 0.045, 2, 2, 1), new THREE.MeshLambertMaterial({ color: 0x9c7c58 }));
    body.position.z = 0.0225; g.add(body);
    const tex = canvasTex(360, 460, draw);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(TAB_W - 0.012, TAB_H - 0.012), new THREE.MeshLambertMaterial({ map: tex }));
    face.position.z = 0.047; g.add(face);   // 2 mm proud of the clay, so it never flickers
    g.userData.tex = tex; g.userData.face = face;
    return g;
  }

  // The writing table, the soft clay tablet for tonight, and the reed
  buildWritingTable() {
    const k = new Kit(), TX = 3.4, TZ = ZIG_Z - 3.5, TY = 0.88; // a tall scribe's table, easy to reach standing
    const P = PROPS.fresh();
    if (P.add('reading_desk', TX, 0.01, TZ, 0, { w: 1.15, d: 0.7, h: TY + 0.02 })) this.root.add(P.build({ glow: NIGHT }));
    else {
      k.box(1.15, 0.06, 0.7, 0x7a5636, [TX, TY, TZ]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.06, TY, 0.06, 0x5e4228, [TX + sx * 0.5, TY / 2, TZ + sz * 0.28]);
    }
    k.cyl(0.13, 0.16, 0.2, 10, 0x8a5a3a, [TX + 0.45, TY + 0.13, TZ - 0.2]);             // a jar of water for wetting the clay
    k.cyl(0.11, 0.11, 0.02, 10, 0x3a4a5a, [TX + 0.45, TY + 0.235, TZ - 0.2]);
    k.cyl(0.08, 0.1, 0.06, 8, 0x9a6a40, [TX - 0.45, TY + 0.06, TZ - 0.22]);             // the lamp's dish
    k.box(0.3, 0.1, 0.06, 0x5e4228, [TX - 0.05, TY + 0.08, TZ + 0.0]);                    // the block the tablet leans on
    this.root.add(k.mesh());
    this.G.world.blockers.push({ x: TX - 0.3, z: TZ - 0.1, r: 0.28 }, { x: TX + 0.3, z: TZ - 0.1, r: 0.28 });
    // Tonight's tablet: soft, darker wet clay, lying tilted toward you, with the marks to press
    this.clay = this.makeTablet((g, w, h) => this.drawMine(g, w, h));
    this.clay.userData.home = new THREE.Vector3(TX - 0.05, TY + 0.05, TZ + 0.16);
    this.clay.userData.homeQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.55, 0, 0)); // propped up, tilted toward you
    this.clay.position.copy(this.clay.userData.home); this.clay.quaternion.copy(this.clay.userData.homeQuat);
    this.clay.children[0].material = new THREE.MeshLambertMaterial({ color: 0x7e5e40 });
    this.root.add(this.clay);
    // The reed stylus: a thin cut reed with a slanted tip
    const rk = new Kit();
    rk.add(new THREE.CylinderGeometry(0.006, 0.0065, 0.2, 6).rotateX(Math.PI / 2).translate(0, 0, -0.03), 0xc8b070);
    rk.add(new THREE.ConeGeometry(0.0065, 0.03, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.145), 0xd8c080);
    rk.add(new THREE.CylinderGeometry(0.0075, 0.0075, 0.012, 6).rotateX(Math.PI / 2).translate(0, 0, 0.02), 0x8a7040);
    this.reed = rk.mesh(); this.reedTip = new THREE.Vector3(0, 0, -0.16);
    this.reed.userData.home = new THREE.Vector3(TX + 0.28, TY + 0.04, TZ + 0.12);
    this.reed.userData.homeQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.5, 0));
    this.reed.position.copy(this.reed.userData.home); this.reed.quaternion.copy(this.reed.userData.homeQuat);
    this.root.add(this.reed);
    this.reedGlow = new THREE.Sprite(glowMat('rgba(150,220,255,1)')); this.reedGlow.scale.setScalar(0.12); this.reed.add(this.reedGlow); this.reedGlow.position.z = -0.04;
    this.writeSpot = new THREE.Vector3(TX, 0, TZ + 0.75);
    this.archiveSpot = new THREE.Vector3(this.deskX, 0, this.shrineFront + 1.55);
    this.tableLamp = new THREE.Vector3(TX - 0.45, TY + 0.16, TZ - 0.22);
  }

  // Tonight's tablet: the glowing outlines of the marks still to press, and the ones you pressed
  drawMine(g, w, h) {
    claySurface(g, w, h, '#86684a', 91);
    const marks = this.s?.marks || MARKS.map(() => 0);
    MARKS.forEach((M, i) => {
      if (marks[i]) wedge(g, M.u * w, M.v * h, 26, M.a, 1);
      else {
        g.save(); g.translate(M.u * w, M.v * h); g.rotate(M.a * D2R);
        g.strokeStyle = 'rgba(255,214,120,0.95)'; g.lineWidth = 4; g.shadowColor = '#ffcc66'; g.shadowBlur = 12;
        g.beginPath(); g.moveTo(-14, -13); g.lineTo(14, -13); g.lineTo(0, 9); g.closePath(); g.stroke();
        g.beginPath(); g.moveTo(0, 9); g.lineTo(0, 38); g.stroke();
        g.restore();
      }
    });
    // a faint ruled line under tonight's entry
    g.strokeStyle = 'rgba(40,25,10,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0.05 * w, 0.17 * h); g.lineTo(0.95 * w, 0.17 * h); g.stroke();
    if (this.s?.tonight) eclipseSign(g, 0.84 * w, PAT[0] * h, 17);
  }
  redrawMine() { const T = this.clay.userData.tex; const g = T.userData.ctx; this.drawMine(g, 360, 460); T.needsUpdate = true; }
  // Where mark i is, in the world
  markPos(i, out = new THREE.Vector3()) {
    const M = MARKS[i]; return this.clay.localToWorld(out.set((M.u - 0.5) * (TAB_W - 0.012), (0.5 - M.v) * (TAB_H - 0.012), 0.047));
  }

  buildPeople() {
    this.people = [];
    const add = (pos, face, look, role) => {
      const P = makePerson({ model: 'skywatcher', seed: 60 + this.people.length * 7, tunic: [0x5a4a7a, 0x7a5a3a, 0x8a6a4a, 0x6a5a4a][this.people.length % 4], beard: true, hair: 0x2a1a10, ...look });
      P.g.position.copy(pos); P.g.rotation.y = face; P.role = role; P.face = face; P.home = pos.clone();
      P.blk = { x: pos.x, z: pos.z, r: 0.3 };
      this.root.add(P.g); this.people.push(P);
      return P;
    };
    const faceDir = (d) => Math.atan2(d.x, d.z);
    // The sky-watcher, between the shelves and the writing table, and his young apprentice by the parapet
    this.watcher = add(new THREE.Vector3(0.6, 0, this.shrineFront + 1.3), 0, {}, 'watcher');
    this.G.world.blockers.push(this.watcher.blk);
    this.apprentice = add(new THREE.Vector3(-7.4, 0, ZIG_Z + 7.6), faceDir(this.moonDir), { height: 1.62, model: 'architect' }, 'apprentice');
    dress(this.apprentice, { mul: 0xb89c80, sat: 1.2, hue: 0.02, build: 1.02 });   // young, in a plain woollen wrap
    this.G.world.blockers.push(this.apprentice.blk);
    // Townspeople below: temple servants on the tier under you, and people in the courtyard and on the stairs
    const md = faceDir(this.moonDir);
    // Every one of them a different person (Meem's models from the other chapters, in Babylonian wool):
    // shaven-headed temple servants, a scribe, porters, an old woman come to see the Moon
    const TOWN = [
      ['priest', { mul: 0xe0d4bc }], ['instrument_maker', { mul: 0xa08a6a, sat: 0.8 }], ['builder', { hue: 0.92, sat: 0.9, val: 0.9 }], ['villager', { mul: 0xc0a888 }],
      ['skywatcher', { hue: 0.6, sat: 0.55, val: 0.8, hair: 0x6a6460 }], ['sailor', { hue: 0.08, sat: 0.6, val: 0.9 }],
      ['aristotle', { mul: 0xa89070, sat: 0.7, hair: 0x2a2018 }], ['storyteller', { hue: 0.03, sat: 0.7, val: 1.1 }], ['builder_far', { hue: 0.55, sat: 0.4, val: 0.85, hair: 0x5a5450 }],
      ['villager', { mul: 0x9a8468, val: 0.9, build: 1.08 }],
    ];
    let ti = 0;
    const town = (pos, face) => { const [model, look] = TOWN[ti++]; dress(add(pos, face, { model }, 'town'), look); };
    for (const [x, y, z] of [[-5, -6, ZIG_Z + 13.5], [2.5, -6, ZIG_Z + 14.2], [6.5, -6, ZIG_Z + 13], [-13, -6, ZIG_Z + 2]]) town(new THREE.Vector3(x, y, z), md + (Math.random() - 0.5) * 0.4);
    for (const [x, z] of [[-6, 66], [-2.5, 70], [3, 67], [9, 70], [-11, 74]]) town(new THREE.Vector3(x, BASE, ZIG_Z + z), md + (Math.random() - 0.5) * 0.6);
    const stair = (z) => lerp(BASE, -6, (ZIG_Z + TIERS[1][1] + 45 - z) / 45);
    town(new THREE.Vector3(-1.5, stair(ZIG_Z + 44), ZIG_Z + 44), md);   // (the other villager is 30 m away, up on the tier)
  }

  buildMoon() {
    const G = this.G;
    this.moonU = {
      map: { value: moonTex() }, shadowC: { value: new THREE.Vector2(-UMBRA - 1.05, 0.35) },
      umbraR: { value: UMBRA }, penR: { value: PEN }, red: { value: 0 }, bright: { value: 1.12 },
    };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(MOON_R * 2, MOON_R * 2), new THREE.ShaderMaterial({
      uniforms: this.moonU, vertexShader: MOON_VS, fragmentShader: MOON_FS, transparent: true, depthWrite: false, fog: false,
    }));
    const pos = this.moonDir.clone().multiplyScalar(MOON_D);
    m.position.copy(pos);
    m.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(), pos, new THREE.Vector3(0, 1, 0)));
    m.renderOrder = -7; m.frustumCulled = false;
    this.moon = m;
    this.moonHalo = new THREE.Sprite(glowMat('rgba(200,215,255,1)')); this.moonHalo.position.copy(pos); this.moonHalo.scale.setScalar(MOON_R * 5); this.moonHalo.renderOrder = -8;
    // The sky follows your head, so the Moon rides along with it like the stars do
    G.sky.group.add(this.moonHalo, m);
    // Moonlight: soft and blue-white, from the Moon's direction
    this.moonLight = new THREE.DirectionalLight(0xb8c8ff, 1.0);
    this.moonLight.position.copy(this.moonDir).multiplyScalar(100); this.root.add(this.moonLight); this.root.add(this.moonLight.target);
    this.lit = 1;
  }

  buildEffects() {
    // Oil lamps: a small flame glow each, and two real lights near the tables that flicker
    this.flames = [];
    const fm = glowMat('rgba(255,170,70,1)');
    const lamps = [this.tableLamp, new THREE.Vector3(this.deskX - 1.5, 1.0, this.shrineFront + 0.6), new THREE.Vector3(this.deskX + 1.5, 1.0, this.shrineFront + 0.6),
      new THREE.Vector3(-1.0, 3.3, this.shrineFront + 0.3), new THREE.Vector3(1.0, 3.3, this.shrineFront + 0.3), new THREE.Vector3(8.4, 0.75, ZIG_Z + 6),
      new THREE.Vector3(-9.8, 1.05, ZIG_Z + 10.8), new THREE.Vector3(9.8, 1.05, ZIG_Z + 10.8), new THREE.Vector3(-9.8, 1.05, ZIG_Z - 6.4), new THREE.Vector3(9.8, 1.05, ZIG_Z - 6.4)];
    const k = new Kit();
    lamps.forEach((p, i) => {
      const f = new THREE.Sprite(fm); f.position.copy(p); f.scale.setScalar(i === 5 ? 0.9 : 0.22); f.userData.ph = i * 1.7; f.userData.base = f.scale.x;
      this.root.add(f); this.flames.push(f);
      if (i > 0 && i !== 5) k.cyl(0.05, 0.07, 0.05, 8, 0x9a6a40, [p.x, p.y - 0.06, p.z]);
    });
    this.root.add(k.mesh());
    this.lampA = new THREE.PointLight(0xffa850, 3.2, 9, 1.6); this.lampA.position.copy(this.tableLamp).add(_a.set(0, 0.35, 0.3));
    this.lampB = new THREE.PointLight(0xffa850, 3.2, 9, 1.6); this.lampB.position.set(this.deskX, 1.6, this.shrineFront + 1.4);
    this.root.add(this.lampA, this.lampB);
    // Glowing ring on the floor: "stand here"
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; this.ring = ring; this.root.add(ring);
  }

  // The journal page: a red Moon beside a row of wedge-shaped marks
  buildJournal() {
    const tex = canvasTex(1024, 720, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.7);
      gr.addColorStop(0, '#f2e3bf'); gr.addColorStop(1, '#d4bb86'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(110,80,40,0.5)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
      const ink = '#3a2a18';
      // the red Moon, with a bright rim on one side
      const mx = w * 0.7, my = h * 0.5, R = 150;
      const mg = g.createRadialGradient(mx + 40, my - 20, 10, mx, my, R);
      mg.addColorStop(0, '#d0683a'); mg.addColorStop(0.75, '#8e2e18'); mg.addColorStop(1, '#5a1a0c');
      g.fillStyle = mg; g.beginPath(); g.arc(mx, my, R, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,200,150,0.7)'; g.lineWidth = 6; g.beginPath(); g.arc(mx, my, R - 3, -0.9, 0.9); g.stroke();
      g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.arc(mx, my, R, 0, 7); g.stroke();
      // the wedge marks, three rows, like a page of the diaries
      const r = rng(12);
      for (let row = 0; row < 3; row++) { let x = 70; while (x < w * 0.44) { const n = 1 + (r() * 3 | 0); for (let i = 0; i < n; i++) { wedge(g, x, h * 0.36 + row * 90, 30, [0, 90, 200][r() * 3 | 0], 1.2); x += 38; } x += 30; } }
      g.fillStyle = ink; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
      g.fillText('Babylon, about 700 BC', 40, 70);
      g.font = 'italic 32px Georgia, serif';
      g.fillText('An eclipse of the Moon, predicted from the records', 40, h - 40);
      g.font = '26px Georgia, serif'; g.fillText('every 18 years, the eclipses come back', 60, h * 0.36 + 3 * 90);
    });
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46 * 720 / 1024), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false }));
    this.journal = new THREE.Group(); this.journal.add(page); this.journal.visible = false; this.root.add(this.journal);
  }

  registerInteractables() {
    const G = this.G, self = this;
    // The reed: pick it up with GRIP and press its tip into each glowing mark
    this.reedIt = {
      hint: 'Pick up the reed (GRIP), then press its tip into each glowing mark',
      get disabled() { return self.s.phase !== 'write'; },
      reach(pos) { return self.reedHand ? Infinity : Math.max(0, pos.distanceTo(self.reed.position) - 0.08); },
      aim() { return Infinity; }, // on desktop you click the tablet instead
      onGrab(h) { self.reedHand = h; },
      onHold(h) { self.holdReed(h); },
      onRelease() { self.reedHand = null; },
    };
    // The clay tablet itself: touch a mark with TRIGGER (or click it on desktop)
    this.clayIt = {
      hint: 'Press the reed into each glowing mark (or touch them with TRIGGER)',
      deskHint: 'Click the soft clay tablet to press in each mark',
      get disabled() { return self.s.phase !== 'write'; },
      reach(pos) {
        self.clay.worldToLocal(_c.copy(pos));
        return Math.abs(_c.x) < TAB_W * 0.6 && Math.abs(_c.y) < TAB_H * 0.6 ? Math.max(0, Math.abs(_c.z - 0.045) - 0.04) : Infinity;
      },
      aim(o, d) { return self.rayTablet(self.clay, o, d); },
      onTouch(h) {
        const left = MARKS.map((_, i) => i).filter((i) => !self.s.marks[i]);
        if (!left.length) return;
        let best = left[0];
        if (!h.desk) { let bd = Infinity; for (const i of left) { const d = self.markPos(i, _b).distanceTo(h.pos); if (d < bd) { bd = d; best = i; } } }
        G.act({ type: 'press', k: best });
      },
    };
    this.clayIt.onKey = this.clayIt.onTouch;
    // The four glowing tablets on the shelf: grab or touch one and it goes to its place on the desk
    this.oldIts = this.old.map((T, i) => ({
      hint: 'Grab a glowing tablet (GRIP or TRIGGER)',
      deskHint: 'Click a glowing tablet on the shelf',
      get disabled() { return self.s.phase !== 'archive' || !!self.s.fetched[i]; },
      reach(pos) { T.getWorldPosition(_a); _a.y += TAB_H * 0.31 * 0.62; return Math.max(0, pos.distanceTo(_a) - 0.14); },
      aim(o, d) { T.getWorldPosition(_a); _a.y += TAB_H * 0.31 * 0.62; _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.16 ? t : Infinity; },
      onGrab() { G.act({ type: 'fetch', i }); },
      onTouch() { G.act({ type: 'fetch', i }); },
      onKey() { G.act({ type: 'fetch', i }); },
    }));
    // The journal page Astra hands you at the end: touch it to finish the chapter
    this.pageIt = {
      hint: 'Touch the journal page (TRIGGER or GRIP)',
      deskHint: 'Click the journal page',
      get disabled() { return self.s.journal !== 1; },
      reach(pos) { self.journal.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.22); },
      aim(o, d) { self.journal.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.3 ? t : Infinity; },
      onTouch() { G.act({ type: 'touchPage' }); },
      onGrab() { G.act({ type: 'touchPage' }); },
    };
    G.interactables.push(this.reedIt, this.clayIt, ...this.oldIts, this.pageIt);
  }

  // Desktop crosshair: how far along the ray it hits this tablet's face (or Infinity)
  rayTablet(T, o, d) {
    T.updateMatrixWorld(); const inv = _q.copy(T.getWorldQuaternion(_q)).invert();
    const lo = T.worldToLocal(_a.copy(o)), ld = _b.copy(d).applyQuaternion(inv);
    if (Math.abs(ld.z) < 1e-4) return Infinity;
    const t = (0.045 - lo.z) / ld.z; if (t <= 0) return Infinity;
    const x = lo.x + ld.x * t, y = lo.y + ld.y * t;
    return Math.abs(x) < TAB_W * 0.55 && Math.abs(y) < TAB_H * 0.55 ? t : Infinity;
  }

  // The reed follows your hand; when its tip pushes into a glowing mark, that mark is pressed
  holdReed(h) {
    if (h.grip) {
      h.grip.getWorldPosition(_a); h.grip.getWorldQuaternion(_q);
      _q2.setFromEuler(new THREE.Euler(-0.55, 0, 0)); // tip angled down, like holding a pen
      this.reed.quaternion.copy(_q).multiply(_q2);
      this.reed.position.copy(_a).add(_b.set(0, -0.015, -0.03).applyQuaternion(_q));
    } else this.reed.position.copy(h.pos);
    this.reed.updateMatrixWorld();
    const tip = this.reed.localToWorld(_c.copy(this.reedTip));
    const lo = this.clay.worldToLocal(tip.clone());
    if (lo.z > 0.09 || lo.z < -0.04) return;
    for (let i = 0; i < MARKS.length; i++) {
      if (this.s.marks[i]) continue;
      const M = MARKS[i], dx = lo.x - (M.u - 0.5) * (TAB_W - 0.012), dy = lo.y - (0.5 - M.v) * (TAB_H - 0.012);
      if (Math.hypot(dx, dy) < 0.045) { this.G.act({ type: 'press', k: i }); this.G.player.haptic(h, 0.6, 40); break; }
    }
  }
  // Where the reed's tip is right now (the headset test uses this too)
  reedTipWorld(out = new THREE.Vector3()) { this.reed.updateMatrixWorld(); return this.reed.localToWorld(out.copy(this.reedTip)); }

  // ---------- Actions from any player (run on the host) ----------
  act(a) {
    const s = this.s;
    if (a.type === 'press' && s.phase === 'write' && a.k >= 0 && a.k < MARKS.length && !s.marks[a.k]) { s.marks[a.k] = 1; return true; }
    if (a.type === 'fetch' && s.phase === 'archive' && a.i >= 0 && a.i < 4 && !s.fetched[a.i]) { s.fetched[a.i] = 1; return true; }
    if (a.type === 'touchPage' && s.journal === 1) { s.journal = 2; return true; }
    return false;
  }

  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story (host only) ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    const placeAll = (pos, yaw) => G.events.emit('placePlayers', { x: pos.x, z: pos.z, yaw });
    const goTo = async (spot, face, hint) => {
      if (D.kids) { await D.wait(fast ? 0.2 : 1); await D.goTo(spot, face); return; }   // Kids mode: a quick fade takes you there
      s.ring = 1; s.ringAt = [spot.x, spot.z];
      G.ui.showHint(hint, 8);
      const there = () => G.players.every((p) => { p.headPos?.(_a) ?? _a.copy(spot); return Math.hypot(_a.x - spot.x, _a.z - spot.z) < 1.1; });
      if (!(await D.until(there, fast ? 3 : 25))) { await G.ui.fadeOut(0.6); placeAll(spot, face); await G.ui.fadeIn(0.8); }
      s.ring = 0; G.ui.showHint('');
    };
    // Start: at the parapet, looking west over the city and the river
    placeAll(this.start.pos, this.faceToward(this.start.pos, new THREE.Vector3(-60, 0, 0)));
    await G.ui.fadeIn(2.5);
    s.guide = [-7, 2.6, 4];
    await D.say('ch4_01');
    // ch4_02: a clay tablet up close. The reed presses wedge after wedge into it, then it dries hard.
    s.close = 1; s.closeN = 0; s.guide = null; s.watcher = 'write';
    const l2 = D.sayAsync('ch4_02');
    await D.cue('They pressed');
    for (let i = 1; i <= 12; i++) { s.closeN = i; await D.wait(fast ? 0.05 : 0.32); }
    await D.cue('let it dry'); s.dry = 1;
    await l2;
    s.close = 0; s.watcher = 'idle';
    s.guide = [this.deskX, 2.7, this.shrineFront + 0.9]; s.watcher = 'shelves'; // by the shelves of tablets
    // ...and the things they wrote down appear in the sky as Astra names them
    const l3 = D.sayAsync('ch4_03');
    await D.cue('Where the Moon'); s.sky = 1; s.watcher = 'moon';
    await D.cue('Which planets'); s.sky = 2;
    await D.cue('every comet'); s.sky = 3;
    await D.cue('even the weather'); s.sky = 4;
    await l3;
    s.sky = 0; s.watcher = 'idle';
    // Write down the Moon
    s.phase = 'write'; s.guide = [this.writeSpot.x + 0.7, 1.5, this.writeSpot.z - 1.5];
    const sayW = D.say('ch4_04');
    await goTo(this.writeSpot, this.faceToward(this.writeSpot, this.clay.position), 'Walk to the glowing ring by the writing table (left stick)');
    await sayW;
    D.hint(G.mode === 'desktop' ? this.clayIt.deskHint : this.reedIt.hint, 9);
    this.helpAt = G.t + (D.kids ? (fast ? 0.3 : 1.5) : fast ? 4 : 45);   // the sky-watcher writes it (Kids mode: right away)
    await D.until(() => s.marks.every(Boolean));
    this.helpAt = null;
    G.ui.showHint(''); s.watcher = 'tablet'; s.nod++;
    await D.wait(fast ? 0.3 : 1.5);
    // The old records
    s.phase = 'archive'; s.watcher = 'shelves'; s.guide = [this.deskX + 1.6, 2.2, this.shrineFront + 1.1];
    const sayA = D.say('ch4_05');
    await goTo(this.archiveSpot, this.faceToward(this.archiveSpot, _a.set(this.deskX, 0, this.shrineFront)), 'Walk to the glowing ring by the shelves');
    // the watchers before him appear in a line, one after another, back through the years
    if (G.narration.cur?.id === 'ch4_05') {
      await D.cue('One watcher'); s.ghosts = 1;
      await D.cue('the next one'); s.ghosts = 3;
      await D.cue('never stopped'); s.ghosts = 5;
    } else s.ghosts = 5;
    await sayA;
    D.hint(G.mode === 'desktop' ? this.oldIts[0].deskHint : this.oldIts[0].hint, 8);
    this.helpAt = G.t + (D.kids ? (fast ? 0.3 : 1.5) : fast ? 4 : 40);
    await D.until(() => s.fetched.every(Boolean));
    this.helpAt = null;
    G.ui.showHint(''); s.watcher = 'idle'; s.ghosts = 0;
    await D.wait(fast ? 0.3 : 1.6);
    // The pattern
    s.phase = 'pattern'; s.guide = [this.deskX - 1.7, 1.7, this.shrineFront + 1.2];
    await D.say('ch4_06');
    await D.until(() => s.lines >= 1, 12);
    // Your tablet goes on the end of the row, and the pattern points at tonight
    s.phase = 'predict';
    await D.until(() => s.mine >= 1, 8);
    s.tonight = 1; G.events.emit('sfx', { k: 'page' });
    await D.say('ch4_07');
    s.nod++;
    // Look up!
    s.phase = 'lookup'; s.watcher = 'moon';
    const md = this.moonDir;
    s.guide = [md.x * 5 + this.archiveSpot.x * 0.3, 1.6 + md.y * 5, md.z * 5 + this.archiveSpot.z * 0.3];
    D.hint('Turn around and look up at the Moon', 8);
    const looking = () => { G.camera.getWorldDirection(_a); return _a.dot(md) > 0.9; };
    if (D.kids) { await D.wait(fast ? 0.2 : 1.5); await D.goTo(this.archiveSpot, this.faceToward(this.archiveSpot, _b.copy(this.archiveSpot).add(md))); await D.wait(fast ? 0.2 : 1.5); }
    else await D.until(looking, fast ? 2 : 12);
    G.ui.showHint('');
    s.phase = 'eclipse'; G.events.emit('sfx', { k: 'swell' });
    await D.until(() => s.ecl >= 0.22);
    // the town below is frightened; up here the sky-watchers calmly write it down
    const l8 = D.sayAsync('ch4_08');
    await D.cue('But up here'); s.calm = 1; s.nod++;
    await l8;
    await D.until(() => s.ecl >= 1);
    s.phase = 'total';
    await D.until(() => s.red >= 0.55);
    await D.say('ch4_09');
    await D.wait(fast ? 0.5 : 3);
    s.phase = 'closing'; s.guide = null; s.watcher = 'idle';
    const l10 = D.sayAsync('ch4_10');
    await D.cue('sixty minutes'); s.wheel = 1;
    await D.cue('three hundred'); s.wheel = 2;
    await D.cue('twelve signs'); s.wheel = 3;
    await D.cue('All from here'); s.wheel = 0;
    await l10;
    // The journal page
    s.journal = 1; s.phase = 'journal';
    G.events.emit('sfx', { k: 'page' });
    D.hint(G.mode === 'desktop' ? this.pageIt.deskHint : this.pageIt.hint, 8);
    await D.auto(() => s.journal === 2, () => this.act({ type: 'touchPage' }), { after: fast ? 0.5 : 4 });
    G.ui.showHint('');
    G.events.emit('sfx', { k: 'page' });
    await D.wait(1.2);
    s.phase = 'done';
  }

  faceToward(from, to) { return Math.atan2(-(to.x - from.x), -(to.z - from.z)); }

  // ---------- Every frame, every headset ----------
  update(dt, t) {
    const G = this.G, s = this.s, host = G.isHost, fast = G.params.has('fast') ? 4 : 1;
    // Host-side timelines (and the sky-watcher lending a hand if you need help)
    if (host) {
      if (s.phase === 'write' && this.helpAt && G.t > this.helpAt) { const i = s.marks.indexOf(0); if (i >= 0) { s.marks[i] = 1; this.helpAt = G.t + 1.4; } }
      if (s.phase === 'archive' && this.helpAt && G.t > this.helpAt) { const i = s.fetched.indexOf(0); if (i >= 0) { s.fetched[i] = 1; this.helpAt = G.t + 1.6; } }
      if (s.phase === 'pattern') s.lines = Math.min(1, s.lines + dt / 7 * fast);
      if (s.phase === 'predict') s.mine = Math.min(1, s.mine + dt / 2.6 * fast);
      if (s.phase === 'eclipse') s.ecl = Math.min(1, s.ecl + dt / 30 * fast);
      if (s.phase === 'eclipse') s.red = Math.min(0.2, s.ecl * 0.2);
      if (['total', 'closing', 'journal', 'done'].includes(s.phase)) { s.ecl = 1; s.red = Math.min(1, s.red + dt / 7 * fast); }
    }

    // ----- The sky: a night with the full Moon; Earth's shadow creeps over it, then it glows copper
    G.sky.set(MOON_AZ - 180, -MOON_EL); // the Sun is below the far side of the world, right opposite the Moon
    G.sky.hideMoon(); // the sky's own Moon hides: this chapter draws a big one that can be eclipsed
    const e = ease(s.ecl);
    // the shadow's edge touches the Moon at the start, and covers it completely from about three quarters of the way
    const sc = this.moonU.shadowC.value.set(lerp(-UMBRA - 1.05, -0.9, e), lerp(0.35, 0.3, e));
    this.moonU.red.value = s.red;
    // how much of the Moon is still in sunlight (a quick count over the disc)
    let lit = 0, n = 0;
    for (let y = -0.9; y <= 0.91; y += 0.3) for (let x = -0.9; x <= 0.91; x += 0.3) { if (x * x + y * y > 1) continue; n++; if (Math.hypot(x - sc.x, y - sc.y) > UMBRA) lit++; }
    this.lit = damp(this.lit, lit / n, 4, dt);
    const L = this.lit;
    this.moonHalo.material.opacity = 0.18 + 0.5 * L * L + s.red * 0.05;
    this.moonHalo.material.color.setRGB(1, lerp(0.55, 1, L), lerp(0.45, 1, L));
    this.moonLight.intensity = 0.08 + 1.9 * L;
    this.moonLight.color.setRGB(lerp(0.9, 0.72, L), lerp(0.45, 0.78, L), lerp(0.35, 1, L));
    G.sky.hemi.intensity = 0.55 + 0.55 * L;
    G.sky.hemi.color.setHex(0x8494c4);
    G.sky.hemi.groundColor.setHex(0x54483a);
    // A moonlit sky is a deep blue, and hides the fainter stars; in the eclipse they come back
    const U = G.sky.uni;
    if (U?.zenith) { U.zenith.value.lerp(MOON_SKY, 0.65 * L); U.horizon.value.lerp(MOON_HORIZON, 0.6 * L); }
    if (U?.milky) U.milky.value = 0.25 + 0.75 * (1 - L);
    if (G.sky.starField) G.sky.starField.opacity = 0.5 + 0.5 * (1 - L);
    this.glitter.material.opacity = 0.75 * L;
    this.glitter.material.map.offset.y = (t * 0.03) % 1;

    // ----- Lamps flicker
    for (const f of this.flames) f.scale.setScalar(f.userData.base * (0.9 + 0.12 * Math.sin(t * 9 + f.userData.ph) + 0.08 * Math.sin(t * 23 + f.userData.ph * 2)));
    const fl = 0.85 + 0.1 * Math.sin(t * 8.3) + 0.06 * Math.sin(t * 21);
    this.lampA.intensity = 3.2 * fl; this.lampB.intensity = 3.2 * (0.85 + 0.1 * Math.sin(t * 7.1 + 1) + 0.06 * Math.sin(t * 19 + 2));
    for (const c of this.cityLights) c.material.opacity = 0.85 + 0.15 * Math.sin(t * 2.3);

    // ----- Tonight's tablet: redraw when a mark goes in, with a soft squish
    const nm = s.marks.reduce((a, b) => a + b, 0);
    if (nm !== this.shown.marks || (s.tonight && !this.shownTonight)) {
      if (nm > this.shown.marks) this.squish(this.clay.position);
      this.shown.marks = nm; this.shownTonight = !!s.tonight; this.redrawMine();
    }
    // The reed rests on the table unless someone here is holding it
    if (!this.reedHand) { this.reed.position.lerp(this.reed.userData.home, 1 - Math.exp(-dt * 8)); this.reed.quaternion.slerp(this.reed.userData.homeQuat, 1 - Math.exp(-dt * 8)); }
    this.reedGlow.visible = s.phase === 'write' && !this.reedHand;
    this.reedGlow.material.opacity = 0.5 + 0.3 * Math.sin(t * 4);
    // Your tablet flies over to the end of the row on the desk
    if (s.mine > 0) {
      const k = ease(s.mine);
      this.clay.position.lerpVectors(this.clay.userData.home, this.slotPos[4], k); this.clay.position.y += Math.sin(Math.PI * k) * 0.8;
      this.clay.quaternion.slerpQuaternions(this.clay.userData.homeQuat, this.slotQuat, k);
    }
    this.tonightLabel.visible = s.mine >= 1;

    // ----- The old tablets: glowing on the shelf, then gliding down onto the desk
    this.old.forEach((T, i) => {
      const u = T.userData;
      if (s.fetched[i]) { if (!this.shown.fetched[i]) { this.shown.fetched[i] = 1; G.audio.tick(T.position); } u.fly = Math.min(1, u.fly + dt / 1.3); }
      const k = ease(u.fly);
      T.position.lerpVectors(u.shelfPos, this.slotPos[i], k); T.position.y += Math.sin(Math.PI * k) * 0.35;
      T.quaternion.slerpQuaternions(u.shelfQuat, this.slotQuat, k);
      T.scale.setScalar(lerp(u.shelfScale, 1, k));
      if (u.fly >= 1 && !u.landed) { u.landed = true; this.clack(T.position); }
      u.glow.visible = s.phase === 'archive' && !s.fetched[i];
      u.glow.material.opacity = 0.55 + 0.3 * Math.sin(t * 3 + i);
      u.label.visible = u.fly >= 1;
    });
    // The pattern: the same eclipses on every tablet light up, and lines join them across the desk
    const lv = s.lines;
    this.lines.forEach((ln, j) => { const k = clamp(lv * 1.6 - j * 0.08, 0, 1); ln.scale.x = Math.max(0.0001, ease(k) * ln.userData.len); });
    this.lineMat.opacity = lv > 0 ? 0.85 : 0;
    this.markGlows.forEach((g, i) => { const j = i % PAT.length, k = clamp(lv * 1.6 - j * 0.08, 0, 1); g.visible = k > 0.05; g.scale.setScalar(0.06 + 0.02 * Math.sin(t * 3 + j)); });
    const tn = s.tonight ? 1 : 0;
    this.tonightV = damp(this.tonightV || 0, tn, 2, dt);
    this.tonightLine.scale.x = Math.max(0.0001, this.tonightV * this.tonightLine.userData.len);
    this.tonightMat.opacity = this.tonightV * (0.75 + 0.25 * Math.sin(t * 4));
    this.tonightGlow.scale.setScalar(0.001 + this.tonightV * (0.16 + 0.04 * Math.sin(t * 4)));

    // ----- Stand-here ring
    this.ringV = damp(this.ringV || 0, s.ring, 3, dt);
    this.ring.position.set(s.ringAt[0], 0.03, s.ringAt[1]);
    this.ring.material.opacity = this.ringV * (0.55 + 0.25 * Math.sin(t * 3));
    this.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
    this.ring.visible = this.ringV > 0.01;

    // ----- Story pieces
    this.updateStory(dt, t);
    // ----- People
    const moonPt = _c.copy(this.moonDir).multiplyScalar(60);
    const eclipsing = s.ecl > 0.3 && s.phase !== 'journal' && s.phase !== 'done';
    for (const P of this.people) {
      if (P.role === 'watcher') {
        const w = s.watcher;
        P.pose = w === 'shelves' || w === 'moon' ? 'point' : w === 'write' ? 'write' : 'idle';
        if (s.calm && eclipsing) { P.pose = 'write'; }   // not scared: he writes it down
        if (w === 'shelves') P.pointAt.set(this.deskX, 1.4, this.shrineFront);
        else if (w === 'moon') P.pointAt.copy(moonPt).add(P.g.position);
        // turn to face the shelves, the Moon, or you
        let want;
        if (w === 'shelves') want = Math.atan2(this.deskX - P.g.position.x, this.shrineFront - P.g.position.z) * 0.6;
        else if (w === 'moon') want = Math.atan2(this.moonDir.x, this.moonDir.z);
        else { G.camera.getWorldPosition(_a); want = Math.atan2(_a.x - P.g.position.x, _a.z - P.g.position.z); }
        let d = want - P.g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        P.g.rotation.y += d * (1 - Math.exp(-dt * 2));
      } else if (P.role === 'apprentice') {
        P.pose = eclipsing ? 'point' : 'idle'; P.pointAt.copy(moonPt).add(P.g.position);
      } else {
        // townspeople stroll about; as the Moon darkens they stop, stare, point and gasp in fright
        if (P.stroll && !eclipsing) runRoutine(P, dt, { speed: 0.9 });
        else P.pose = eclipsing ? (P.phase % 3 < 1.2 ? 'gasp' : 'point') : 'idle';
        P.pointAt.copy(moonPt).add(P.g.position);
        P.look = eclipsing ? _b.copy(this.moonDir).multiplyScalar(60).add(P.g.position).clone() : null;
        P.glance = !eclipsing;
      }
      animatePerson(P, t, dt);
      if (P.role === 'watcher') this.nodHead(P, dt);
    }

    // ----- Guide: hover where the story wants it, or out in front of you
    if (s.guide) { _a.fromArray(s.guide); if (!this.guideAt || !this.guideAt.equals(_a)) { this.guideAt = _a.clone(); G.guide.flyTo(this.guideAt); G.guide.chime(); } }
    else if (this.guideAt && s.journal !== 1) { this.guideAt = null; G.guide.follow(); }
    // The journal page floats in front of you, held up by the guide
    this.journal.visible = s.journal === 1;
    if (s.journal === 1) {
      G.camera.getWorldPosition(_a); G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize();
      if (!this.pageSet) { this.pageSet = true; this.journal.position.copy(_a).addScaledVector(_b, 0.62); this.journal.position.y -= 0.2; }
      this.journal.lookAt(_a);
      G.guide.flyTo(_c.copy(this.journal.position).add(_b.set(-_b.z * 0.4, 0.12, _b.x * 0.4)), _a);
      this.guideAt = this.guideAt || _c.clone();
    }

    // ----- Night sounds: crickets, and the city murmuring (and drumming, in Adults mode) at the eclipse
    if (G.audio.ok) {
      this.cricketT -= dt;
      if (this.cricketT <= 0) { this.cricketT = 0.4 + Math.random() * 1.6; this.cricket(_a.set((Math.random() - 0.5) * 60, -20, (Math.random() - 0.5) * 60)); }
      if (eclipsing) {
        this.murmurT -= dt;
        if (this.murmurT <= 0) { this.murmurT = 0.5 + Math.random() * 1.2; this.murmur(_a.set((Math.random() - 0.5) * 30, BASE + 2, ZIG_Z + 40 + Math.random() * 30), G.kids ? 0.5 : 1); }
        if (!G.kids) { this.drumT -= dt; if (this.drumT <= 0) { this.drumT = 1.6; G.audio.drum(_a.set(0, BASE + 2, 170)); } }
      }
    }
  }

  // The sky-watcher nods (when you've finished writing, and when the pattern points at tonight)
  nodHead(P, dt) {
    const H = P.rig?.bones?.Head; if (!H) return;
    H.quaternion.copy(P.rig.rest.get(H));
    if (this.s.nod !== this.nodSeen) { this.nodSeen = this.s.nod; this.nodT = this.s.nod ? 0 : 99; }
    this.nodT = (this.nodT ?? 99) + dt;
    if (this.nodT < 1.6) H.rotateX(Math.sin(this.nodT / 1.6 * Math.PI * 2) * 0.3 * Math.sin(this.nodT / 1.6 * Math.PI));
    if (this.s.watcher === 'moon') H.rotateX(-0.35); // looking up
  }

  // ----- Little synthesized sounds (nothing recorded)
  squish(pos) { const A = this.G.audio; if (!A.ok) return; const o = A.out(pos, 0.6, 1.5); A.noise(o, { type: 'lowpass', f: 700, f2: 200, peak: 0.6, a: 0.01, d: 0.18 }); A.tone(o, { f: 120, f2: 70, peak: 0.25, a: 0.005, d: 0.12 }); }
  clack(pos) { const A = this.G.audio; if (!A.ok) return; const o = A.out(pos, 0.5, 2); A.noise(o, { type: 'bandpass', f: 1400, q: 2, peak: 0.5, a: 0.002, d: 0.08 }); A.tone(o, { type: 'triangle', f: 380, f2: 300, peak: 0.25, a: 0.002, d: 0.1 }); }
  cricket(pos) {
    const A = this.G.audio, o = A.out(pos, 0.05, 6), f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) A.tone(o, { type: 'triangle', f, peak: 0.3, a: 0.004, d: 0.03, t0: i * 0.06 });
  }
  murmur(pos, vol) {
    const A = this.G.audio, o = A.out(pos, 0.35 * vol, 12);
    for (let i = 0; i < 5; i++) A.noise(o, { type: 'bandpass', f: 260 + Math.random() * 500, f2: 240 + Math.random() * 500, q: 6, peak: 0.3, a: 0.12 + Math.random() * 0.2, d: 0.5 + Math.random() * 0.8, t0: Math.random() * 0.6 });
  }

  dispose() {
    const G = this.G;
    G.scene.remove(this.root);
    G.sky.group.remove(this.moon, this.moonHalo);
    if (G.sky.uni?.milky) G.sky.uni.milky.value = 1;
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.moon.geometry.dispose();
    G.world.blockers = [];
  }
}
