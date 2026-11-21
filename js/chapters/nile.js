// Chapter 3: Sirius over the Nile. Egypt, about 2500 BC, the dark hour before dawn in midsummer.
// Then the bridge: the Nebra sky disk, on a hilltop in what is now Germany, about 1600 BC.
//
// You stand on the flat mud-brick roof of a priest's house in a village on the west bank of the
// Nile. Behind you, to the west, the brand-new pyramids stand on the desert edge. In front of you,
// to the east, the dry fields run down to the river. A priest-astronomer waits by his sighting
// post. As the sky starts to pale, you watch the eastern horizon for the first sight of Sirius in
// months (its "heliacal rising"), point at it, ring the bell to wake the village, and then watch a
// whole Egyptian year go by in a minute: Flood, Growing, Harvest.
//
// The sky is worked out properly: Sirius' and the Sun's positions for 2500 BC (precession and
// Sirius' own drift included) seen from Memphis, latitude 29.9° N. On the morning Sirius first
// reappears, the Sun is still about 9° below the horizon. Here Sirius rises at a compass bearing
// of about 115° (east-south-east) and the Sun about 40 minutes later at about 62°.
//
// World axes as everywhere: -Z is north, +X is east, +Y is up. The roof you stand on is at the
// origin, so the walking limit (G.world.bounds, a circle round the origin) keeps you on it.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { makePerson, animatePerson, walkToward } from '../people.js';
import { makeHerd, makeFlock, makeSmoke, Life } from '../life.js';
import { dirFromAzEl } from '../sky.js';
import { canvasTex, clamp, lerp, damp } from '../util.js';
import { makeJournalPage } from '../journal.js';

const D2R = Math.PI / 180;
const SILT = new THREE.Color(0x5c452c);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const smooth = (a, b, x) => ease((x - a) / (b - a));
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
const N1 = noise2(41), N2 = noise2(57);
// Position on the ground at compass bearing az (degrees) and distance r from the roof
const at = (az, r, y = 0, out = new THREE.Vector3()) => out.set(Math.sin(az * D2R) * r, y, -Math.cos(az * D2R) * r);

// ---------- The sky, worked out for the place and the year ----------
// Precession (Lieske 1977) from the J2000 star catalogue to `year`, plus the star's own motion.
function starAt(raH, decD, pmRA, pmDec, year) {
  const yrs = year - 2000, T = yrs / 100;
  let ra = raH * 15 * D2R + pmRA / 3.6e6 * yrs * D2R / Math.cos(decD * D2R), dec = decD * D2R + pmDec / 3.6e6 * yrs * D2R;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) / 3600 * D2R;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) / 3600 * D2R;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) / 3600 * D2R;
  const A = Math.cos(dec) * Math.sin(ra + zeta), B = Math.cos(th) * Math.cos(dec) * Math.cos(ra + zeta) - Math.sin(th) * Math.sin(dec);
  const C = Math.sin(th) * Math.cos(dec) * Math.cos(ra + zeta) + Math.cos(th) * Math.sin(dec);
  ra = Math.atan2(A, B) + z; dec = Math.asin(C);
  return { ra, dec };
}
// Height above the horizon and compass bearing (degrees) of { ra, dec } at latitude lat and sidereal time lst (radians)
function altAz(s, lat, lst) {
  const H = lst - s.ra, la = lat * D2R;
  const alt = Math.asin(Math.sin(la) * Math.sin(s.dec) + Math.cos(la) * Math.cos(s.dec) * Math.cos(H));
  const az = Math.atan2(-Math.cos(s.dec) * Math.sin(H), Math.sin(s.dec) * Math.cos(la) - Math.cos(s.dec) * Math.cos(H) * Math.sin(la));
  return [((az / D2R) + 360) % 360, alt / D2R];
}
const YEAR = -2499;                       // 2500 BC (astronomers count a year 0)
const LAT = 29.85;                        // Memphis
const SIRIUS = starAt(6.7525, -16.716, -546.0, -1223.1, YEAR);
const OBLIQ = 23.978 * D2R;               // the tilt of the Earth's axis back then
const SUN_LON = 93 * D2R;                 // just after midsummer: the morning Sirius comes back
const SUN = { ra: Math.atan2(Math.cos(OBLIQ) * Math.sin(SUN_LON), Math.cos(SUN_LON)), dec: Math.asin(Math.sin(OBLIQ) * Math.sin(SUN_LON)) };
const SIDEREAL = 2 * Math.PI / 1436.07;   // radians of sky turn per minute
// The sidereal time when Sirius stands 1° above the horizon, rising (the moment the story is built around)
const LST0 = (() => {
  let lo = SIRIUS.ra - Math.PI, hi = SIRIUS.ra;  // rising: hour angle between -180° and 0°
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (altAz(SIRIUS, LAT, m)[1] < 1) lo = m; else hi = m; }
  return (lo + hi) / 2;
})();
export function skyAt(minutes) {          // minutes from that moment: [sunAz, sunEl, siriusAz, siriusEl]
  const lst = LST0 + minutes * SIDEREAL;
  return [...altAz(SUN, LAT, lst), ...altAz(SIRIUS, LAT, lst)];
}
// The Pleiades for the Nebra bridge: 1600 BC, seen from the Mittelberg (51.3° N), high in the south-east
const PLEIADES = [
  ['Alcyone', 3.7914, 24.105, 2.9], ['Atlas', 3.8193, 24.053, 3.6], ['Electra', 3.7477, 24.113, 3.7], ['Maia', 3.7638, 24.368, 3.9],
  ['Merope', 3.7720, 23.948, 4.2], ['Taygeta', 3.7535, 24.467, 4.3], ['Pleione', 3.8197, 24.137, 5.0],
].map(([name, ra, dec, mag]) => ({ name, mag, ...starAt(ra, dec, 19, -45, -1599) }));
const NEBRA_LAT = 51.28;
const NEBRA_LST = PLEIADES[0].ra - 1.6 * 15 * D2R;  // an hour and a half before they cross the south

// ---------- The land ----------
// The river runs north-south 270-720 m east of you; the village sits on a low mound so the flood
// can't reach it; the desert rises behind it to the west where the pyramids stand.
const RIVER_W = 225;
const riverX = (z) => 410 + Math.sin(z / 420) * 40 + Math.sin(z / 150) * 8;
const FLOOD_LO = -0.9, FLOOD_HI = 1.35;   // water level: the river in summer, the flood at its height
const VX = -125;                          // the middle of the village mound (you're on its east edge)
const vmound = (x, z) => Math.hypot((x - VX) / 165, z / 330);
export function groundHeight(x, z) {
  const d = Math.abs(x - riverX(z)) - RIVER_W;       // distance from the river bank (negative: in the water)
  let h;
  if (d < 0) h = -3.2 * smooth(0, -45, d) + 0.25 * smooth(-12, 0, d);
  else h = 0.25 + 0.55 * smooth(0, 700, d) + (N2(x / 40, z / 40) - 0.5) * 0.25;
  // the village mound
  const vm = vmound(x, z);
  h += 2.35 * smooth(1.05, 0.7, vm);
  // desert to the west, rising to the plateau where the pyramids are
  // (a long, even slope up to the plateau, so nothing hides the pyramids' feet from the village)
  h += smooth(-330, -1250, x) * 30 + smooth(-330, -700, x) * (N1(x / 160, z / 160) - 0.5) * 3 + smooth(-330, -520, x) * (N2(x / 25, z / 25) - 0.5) * 1.5;
  // low desert hills far to the east (kept low so the horizon is clear for Sirius and the Sun)
  h += smooth(990, 1600, x) * (7 + N1(x / 200 + 9, z / 200) * 7);
  return h;
}
const isField = (x, z) => {
  const d = Math.abs(x - riverX(z)) - RIVER_W;
  return d > 8 && x > -330 && x < 980 && vmound(x, z) > 1.04;
};
// The roof you stand on: the priest's two-storey house at the edge of the village, looking over the fields
const ROOF = groundHeight(0, 0) + 7.2;

// ---------- Textures ----------
function glowMat(color = 'rgba(255,220,140,1)', blend = THREE.AdditiveBlending) {
  const t = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, color); gr.addColorStop(0.25, color.replace(/[\d.]+\)$/, '0.55)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: blend, fog: false });
}
function textSprite(text, sub = '', w = 512) {
  const t = canvasTex(w, 128, (g, W, H) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 8;
    g.fillStyle = 'rgba(255,244,220,0.96)'; g.font = 'bold 50px Georgia, serif'; g.fillText(text, W / 2, sub ? 44 : H / 2);
    if (sub) { g.font = 'italic 34px Georgia, serif'; g.fillStyle = 'rgba(230,220,200,0.9)'; g.fillText(sub, W / 2, 96); }
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(w / 128, 1, 1); return s;
}

// The Nebra sky disk, as it looked when new: blue-green bronze with gold inlay
function nebraTex(stage = 3) {
  // stage: 0 bare bronze, 1 + the Sun, 2 + the Moon, 3 + the stars (the whole disk)
  return canvasTex(512, 512, (g, w) => {
    const c = w / 2, R = w / 2 - 2;
    g.fillStyle = '#2f6b5e'; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
    // patina mottling
    const r = rng(77);
    for (let i = 0; i < 900; i++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * R * 0.98, s = 3 + r() * 14;
      g.fillStyle = r() < 0.5 ? `rgba(30,80,66,${0.15 + r() * 0.25})` : `rgba(90,150,128,${0.1 + r() * 0.2})`;
      g.beginPath(); g.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, s, 0, 6.283); g.fill();
    }
    const gold = g.createLinearGradient(0, 0, w, w); gold.addColorStop(0, '#f6d77a'); gold.addColorStop(0.5, '#d9a93a'); gold.addColorStop(1, '#f2cc66');
    g.fillStyle = gold; g.strokeStyle = gold;
    // the Sun (or full Moon) and the crescent Moon
    if (stage >= 1) { g.beginPath(); g.arc(c - 110, c + 40, 62, 0, 6.283); g.fill(); }
    if (stage >= 2) { g.beginPath(); g.arc(c + 95, c - 70, 66, 0, 6.283); g.arc(c + 125, c - 95, 60, 0, 6.283, true); g.fill('evenodd'); }
    if (stage < 3) return;
    // horizon arcs at the edges, and the "sun boat" at the bottom
    g.lineCap = 'round';
    for (const s of [-1, 1]) { g.lineWidth = 14; g.beginPath(); g.arc(c, c, R - 22, s < 0 ? Math.PI * 0.78 : -Math.PI * 0.22, s < 0 ? Math.PI * 1.22 : Math.PI * 0.22); g.stroke(); }
    g.lineWidth = 10; g.beginPath(); g.arc(c, c + 40, 150, Math.PI * 0.32, Math.PI * 0.68); g.stroke();
    // the Pleiades cluster (7 dots, between Sun and Moon) and the scattered stars
    const cl = [[0, 0], [20, -12], [38, 4], [16, 18], [-18, 14], [-12, -20], [6, -36]];
    for (const [x, y] of cl) { g.beginPath(); g.arc(c - 10 + x, c - 120 + y, 9, 0, 6.283); g.fill(); }
    const rs = rng(5);
    for (let i = 0; i < 25; i++) {
      let x, y; do { x = (rs() - 0.5) * 2 * R * 0.8; y = (rs() - 0.5) * 2 * R * 0.8; } while (Math.hypot(x, y) > R * 0.78 || Math.hypot(x + 110, y - 40) < 85 || Math.hypot(x - 95, y + 70) < 85 || Math.hypot(x + 10, y + 120) < 60);
      g.beginPath(); g.arc(c + x, c + y, 8, 0, 6.283); g.fill();
    }
    // little holes round the rim
    g.fillStyle = '#16302a';
    for (let i = 0; i < 39; i++) { const a = i / 39 * 6.283; g.beginPath(); g.arc(c + Math.cos(a) * (R - 7), c + Math.sin(a) * (R - 7), 3, 0, 6.283); g.fill(); }
  });
}

// The polished casing of a finished pyramid: smooth white limestone with faint courses and joints,
// a little weathering, sand drifted at the foot, and a pale capstone at the very top
function pyramidTex() {
  const t = canvasTex(512, 512, (g, w, h) => {
    const r = rng(19);
    g.fillStyle = '#f4eedf'; g.fillRect(0, 0, w, h);
    // courses: thin horizontal joints, closer together toward the top (the face narrows)
    for (let i = 0; i < 70; i++) {
      const y = h - i / 70 * h;
      g.fillStyle = `rgba(120,105,80,${0.16 + r() * 0.1})`; g.fillRect(0, y, w, 1.6);
      for (let x = r() * 30; x < w; x += 18 + r() * 26) { g.fillStyle = 'rgba(120,105,80,0.12)'; g.fillRect(x, y - h / 70, 1.2, h / 70); }
      if (r() < 0.5) { g.fillStyle = `rgba(255,252,240,${r() * 0.25})`; g.fillRect(0, y - h / 70, w, h / 70 * 0.6); }
    }
    // gentle streaks and patches
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(150,130,100,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 6 + r() * 30, 20 + r() * 80); }
    // sand drifted against the bottom
    const sand = g.createLinearGradient(0, h, 0, h * 0.9); sand.addColorStop(0, 'rgba(196,160,104,0.9)'); sand.addColorStop(1, 'rgba(196,160,104,0)');
    g.fillStyle = sand; g.fillRect(0, h * 0.9, w, h * 0.1);
    // the capstone (pyramidion): pale, gleaming
    g.fillStyle = '#f6e6b4'; g.fillRect(0, 0, w, h * 0.045);
    g.fillStyle = 'rgba(160,130,70,0.6)'; g.fillRect(0, h * 0.045, w, 2);
  });
  t.anisotropy = 8; return t;
}
// The bare core of the unfinished pyramid: rough limestone blocks in courses
function coreTex() {
  const t = canvasTex(256, 256, (g, w, h) => {
    const r = rng(23);
    g.fillStyle = '#d8c49a'; g.fillRect(0, 0, w, h);
    const rows = 4;
    for (let row = 0; row < rows; row++) {
      const y = row * h / rows;
      for (let x = (row % 2) * 20 - 20; x < w; x += 34 + r() * 14) {
        g.fillStyle = `rgba(${150 + r() * 60},${130 + r() * 50},${90 + r() * 40},0.55)`; g.fillRect(x + 1.5, y + 1.5, 32, h / rows - 3);
      }
      g.fillStyle = 'rgba(70,55,35,0.75)'; g.fillRect(0, y, w, 2.5);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

// ---------- Sounds made here (bell, night creatures, the flood) ----------
function bell(A, pos, vol = 1) {
  if (!A.ctx) return; const o = A.out(pos, vol, 6);
  // a bronze bell: a few out-of-tune partials that ring on for a long time
  [[220, 0.5, 5], [440 * 1.19, 0.32, 3.6], [220 * 2.76, 0.25, 2.4], [220 * 4.07, 0.14, 1.6], [220 * 5.4, 0.08, 1.0], [110 * 1.01, 0.18, 4.5]]
    .forEach(([f, p, d]) => A.tone(o, { f, peak: p, a: 0.003, d }));
  A.noise(o, { type: 'bandpass', f: 2400, q: 2, peak: 0.25, a: 0.001, d: 0.08 });
}
function cricket(A, pos) {
  if (!A.ctx) return; const o = A.out(pos, 0.05, 3), f = 4300 + Math.random() * 900;
  for (let i = 0; i < 3; i++) A.tone(o, { type: 'square', f, peak: 0.25, a: 0.004, d: 0.035, t0: i * 0.06 });
}
function frog(A, pos) {
  if (!A.ctx) return; const o = A.out(pos, 0.2, 8), f = 140 + Math.random() * 90;
  for (let i = 0; i < 2 + (Math.random() * 3 | 0); i++) A.tone(o, { type: 'sawtooth', f, f2: f * 0.7, peak: 0.25, a: 0.01, d: 0.09, t0: i * 0.16 });
}
function rush(A, vol) {
  if (!A.ctx) return; const o = A.out(null, vol);
  A.noise(o, { type: 'lowpass', f: 420, f2: 300, peak: 0.6, a: 1.2, d: 3.5 });
}

export default class Nile {
  constructor(G) {
    this.G = G;
    this.root = new THREE.Group(); G.scene.add(this.root);
    this.egypt = new THREE.Group(); this.root.add(this.egypt);
    this.nebra = new THREE.Group(); this.nebra.visible = false; this.root.add(this.nebra);
    // Shared progress (sent to friends' headsets)
    this.s = {
      phase: 'arrive',  // arrive, watch, search, found, bell, sunrise, year, closing, journal, bridge, hold, done
      tm: -55,          // sky time in minutes from the moment Sirius stands 1° up
      found: 0,         // someone pointed at Sirius
      rung: 0,          // how many times the bell has rung
      lights: 0,        // 0..1 village lamps lit
      year: 0,          // 0..1 the year time-lapse (flood, growing, harvest)
      guide: null,      // [x, y, z] where Astra hovers, or null = in front of you
      point: 0,         // the priest points at Sirius
      ring: 0,          // the "stand here" ring at the sighting post
      journal: 0,       // 1 = page out, 2 = touched
      scene: 'egypt',   // or 'nebra'
      held: 0,          // the disk is held up
      match: 0,         // 0..1 the disk's stars light up the sky's
      preview: 0,       // ch3_04: the flood shown spreading over the fields (and the black mud it leaves)
      cal: 0,           // ch3_09: 1 the three seasons in a ring, 2 ...that turn into our twelve months
      gold: 3,          // the Nebra disk: how much of its gold is on (0 bare bronze .. 3 all)
    };
    this.view = { water: FLOOD_LO, season: -1 };
    G.world.height = (x, z) => (this.s.scene === 'nebra' ? nebraHeight(x, z) : ROOF);
    G.world.bounds = 3.3;
    G.world.blockers = [];
    G.sky.setPlace({ lat: LAT, year: -2500, sunLon: SUN_LON / D2R });
    G.sky.fogFar = 3600;
    G.sky.mist = 0;
    G.audio.amb = 0.35;
    G.narration.preload('br3_');

    this.buildLand();
    this.buildFields();
    this.buildVillage();
    this.buildPalms();
    this.buildPyramids();
    this.buildRoof();
    this.buildPeople();
    this.buildSkyBits();
    this.buildLife();
    this.buildCalendar();
    this.buildNebra();
    this.journal = makeJournalPage('nile'); this.journal.visible = false; this.root.add(this.journal);
    this.registerInteractables();
    this.critT = 0; this.frogT = 1; this.birdT = 3;
  }

  // ---------- Building the place ----------
  buildLand() {
    const SIZE = 5200, SEG = 200;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    const sand = new THREE.Color(0xc9a46a), sand2 = new THREE.Color(0xb48a56), silt = new THREE.Color(0x6e5a40), bank = new THREE.Color(0x4f4a34), mud = new THREE.Color(0x8a7656);
    for (let i = 0; i < p.count; i++) {
      // finer near the middle: squeeze the grid toward the roof
      let x = p.getX(i), z = p.getZ(i);
      const r0 = Math.hypot(x, z), k = r0 > 0 ? Math.pow(r0 / (SIZE / 2), 1.7) * (SIZE / 2) / r0 : 0;
      x *= k; z *= k;
      const y = groundHeight(x, z);
      p.setXYZ(i, x, y, z);
      const d = Math.abs(x - riverX(z)) - RIVER_W;
      const desert = Math.max(smooth(-300, -420, x), smooth(960, 1100, x));
      c.copy(silt).lerp(mud, N2(x / 30, z / 30) * 0.6);
      if (d < 10) c.lerp(bank, 0.7);
      const vm = vmound(x, z);
      if (vm < 1.05) c.lerp(mud, 0.8);
      c.lerp(sand, desert).lerp(sand2, desert * N1(x / 60, z / 60) * 0.6);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    this.egypt.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    // The water: one big sheet. In summer it only fills the riverbed; in the flood it rises over the fields.
    const w = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600, 1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshPhongMaterial({ color: 0x1c3444, specular: 0x8a8070, shininess: 90, emissive: 0x050a10 }));
    w.position.set(380, FLOOD_LO, 0); this.water = w; this.egypt.add(w);
  }

  // The fields: plots between low earth banks, recoloured through the year (dry, flooded mud, green, gold)
  buildFields() {
    const r = rng(9), pos = [], plotOf = [], P = 34;
    this.plots = [];
    for (let gx = -320; gx < 980; gx += P) for (let gz = -1300; gz < 1300; gz += P * 1.3) {
      const x0 = gx + r() * 3, z0 = gz + r() * 3, x1 = x0 + P - 2.5, z1 = z0 + P * 1.3 - 2.5;
      if (!isField(x0, z0) || !isField(x1, z1) || !isField(x0, z1) || !isField(x1, z0)) continue;
      const id = this.plots.length, crop = r();
      this.plots.push({ crop, dry: 0.75 + r() * 0.3 });
      const Y = (x, z) => groundHeight(x, z) + 0.06;
      pos.push(x0, Y(x0, z0), z0, x0, Y(x0, z1), z1, x1, Y(x1, z1), z1, x0, Y(x0, z0), z0, x1, Y(x1, z1), z1, x1, Y(x1, z0), z0);
      for (let k = 0; k < 6; k++) plotOf.push(id);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
    g.computeVertexNormals();
    this.fields = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.plotOf = plotOf;
    this.egypt.add(this.fields);
    this.colorFields(0, 0);
    // Crops that sprout after the flood: one instanced mesh of little leaf clumps on the nearer fields
    const v = [], rb = rng(4);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * 6.28 + rb(), w = 0.05, hgt = 0.55 + rb() * 0.3, lean = 0.12;
      const cx = Math.cos(a) * 0.06, cz = Math.sin(a) * 0.06, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
      v.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, hgt, cz + Math.sin(a) * lean);
    }
    const blade = new THREE.BufferGeometry(); blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); blade.computeVertexNormals();
    const N = 9000, crops = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ color: 0x5a9a30, side: THREE.DoubleSide }), N);
    const rc = rng(8), mm = new THREE.Matrix4();
    let n = 0;
    for (let tries = 0; tries < N * 4 && n < N; tries++) {
      const x = 15 + Math.pow(rc(), 1.5) * 220, z = (rc() - 0.5) * 2 * (60 + x * 1.2);
      if (!isField(x, z)) continue;
      _q.setFromAxisAngle(_b.set(0, 1, 0), rc() * 6.28); const sc = 0.8 + rc() * 0.6;
      mm.compose(_a.set(x, groundHeight(x, z) + 0.05, z), _q, _c.set(sc * 1.6, sc, sc * 1.6)); crops.setMatrixAt(n++, mm);
    }
    crops.count = n; crops.visible = false;
    this.crops = crops; this.egypt.add(crops);
  }

  // Season colours: k = 0 dry summer, then (by the year time-lapse) flood mud, green, gold
  colorFields(year, wet) {
    const c = this.fields.geometry.attributes.color, col = new THREE.Color(), tmp = new THREE.Color();
    const DRY = new THREE.Color(0x9a8058), MUD = new THREE.Color(0x2e2618), GREEN = new THREE.Color(0x4f8a2a), GREEN2 = new THREE.Color(0x6a9a34), GOLD = new THREE.Color(0xc9a344), STUB = new THREE.Color(0xa88a58);
    const g = smooth(0.38, 0.55, year), h = smooth(0.7, 0.85, year), bare = smooth(0.95, 1.0, year);
    for (let i = 0; i < this.plotOf.length; i++) {
      const P = this.plots[this.plotOf[i]];
      col.copy(DRY).multiplyScalar(P.dry);
      col.lerp(MUD, wet);
      tmp.copy(GREEN).lerp(GREEN2, P.crop); col.lerp(tmp, g * (P.crop < 0.85 ? 1 : 0.3));
      tmp.copy(GOLD).multiplyScalar(0.9 + P.crop * 0.2); col.lerp(tmp, h * (P.crop < 0.85 ? 1 : 0.2));
      col.lerp(STUB, bare * 0.6 * (P.crop < 0.4 ? 1 : 0));
      c.setXYZ(i, col.r, col.g, col.b);
    }
    c.needsUpdate = true;
  }

  // Mud-brick houses on the mound: flat roofs (people sleep up there in summer), dark doorways,
  // little windows high up, a few round granaries, and the white walls of a temple.
  buildVillage() {
    const k = new Kit(), r = rng(13);
    const MUDB = [0xa88a64, 0x9a7c58, 0xb4986e, 0x8e7452], WHITE = 0xe4dccb, DARK = 0x231a12;
    this.lampSpots = [];
    this.roofSpots = [];
    const house = (x, z, w, d, hgt, yaw = 0) => {
      const y = groundHeight(x, z) - 0.3, col = MUDB[(r() * 4) | 0], top = y + hgt;
      k.box(w, hgt + 0.3, d, col, [x, y + (hgt + 0.3) / 2, z], [0, yaw, 0]);
      // a low lip round the roof
      const lip = 0.45;
      for (const [ox, oz, lw, ld] of [[0, d / 2, w, 0.25], [0, -d / 2, w, 0.25], [w / 2, 0, 0.25, d], [-w / 2, 0, 0.25, d]]) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        k.box(lw, lip, ld, col, [x + ox * c + oz * s, top + lip / 2, z - ox * s + oz * c], [0, yaw, 0], undefined);
      }
      // doorway and windows on a random side
      const side = (r() * 4) | 0, a = yaw + side * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), half = side % 2 ? w / 2 : d / 2;
      const fx = sa * (half + 0.02), fz = ca * (half + 0.02);
      k.box(0.95, 1.9, 0.12, DARK, [x + fx, y + 0.95 + 0.3, z + fz], [0, a, 0]);
      this.lampSpots.push(new THREE.Vector3(x + sa * (half + 0.4), y + 1.6, z + ca * (half + 0.4)));
      if (hgt > 3.6) for (const o of [-1.4, 1.4]) {
        const ox = ca * o, oz = -sa * o;
        k.box(0.5, 0.35, 0.12, DARK, [x + fx + ox, y + hgt - 0.9, z + fz + oz], [0, a, 0]);
        if (r() < 0.35) this.lampSpots.push(new THREE.Vector3(x + fx * 1.05 + ox, y + hgt - 0.9, z + fz * 1.05 + oz));
      }
      // roof clutter: a reed shelter, jars, a woven mat
      if (r() < 0.4) {
        const sx = x + (r() - 0.5) * (w - 2), sz = z + (r() - 0.5) * (d - 2);
        for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.cyl(0.05, 0.05, 1.7, 5, 0x6a5232, [sx + px, top + 0.85, sz + pz]);
        k.box(2.4, 0.08, 2.4, 0xbfa36a, [sx, top + 1.72, sz]);
      }
      if (r() < 0.6) k.cyl(0.2, 0.14, 0.55, 7, 0xa0603a, [x + (r() - 0.5) * (w - 1.5), top + 0.27, z + (r() - 0.5) * (d - 1.5)]);
      this.roofSpots.push(new THREE.Vector3(x, top, z));
    };
    // a lattice of houses on the mound, with lanes between them; the houses near you are built by hand
    const near = [[-10.4, 0, 8.5, 9, 4.3], [0, 10.2, 9, 8, 4.6], [0, -10.4, 9, 8.5, 3.8], [-10, 10, 8, 8, 5.2], [-10.2, -10.2, 8, 8, 4.8], [2, 21, 8, 8, 3.6], [1, -22, 9, 8, 3.4]];
    for (const [x, z, w, d, h] of near) house(x, z, w, d, h);
    for (let gx = -290; gx < 40; gx += 12) for (let gz = -320; gz < 320; gz += 12) {
      if (Math.abs(gx) < 18 && Math.abs(gz) < 18) continue;
      const x = gx + (r() - 0.5) * 3, z = gz + (r() - 0.5) * 3;
      if (vmound(x, z) > 0.92 || (x > -14 && Math.abs(z) < 60)) continue;
      if (r() < 0.22 || Math.abs((gx / 12 | 0) % 4) === 2 || Math.abs((gz / 12 | 0) % 5) === 3) continue; // lanes and yards
      // east of you, houses stay low so the view to the horizon is clear
      const h = Math.hypot(x, z) < 40 ? 3.2 + r() * 1.2 : 3.2 + r() * 2.8;
      house(x, z, 7 + r() * 3, 7 + r() * 3, h, (r() - 0.5) * 0.12);
      if (r() < 0.06) { const gy = groundHeight(x + 6, z); k.cyl(0.1, 1.6, 3.4, 10, 0xc0a074, [x + 6, gy + 1.7, z]); }
    }
    // the temple: whitewashed walls round a courtyard, a gateway, to the north of the village
    const tz = -230, tx = -150, ty = groundHeight(tx, tz);
    for (const [ox, oz, w, d] of [[0, -32, 60, 2], [0, 32, 60, 2], [-30, 0, 2, 64], [30, 0, 2, 64]]) k.box(w, 6, d, WHITE, [tx + ox, ty + 3, tz + oz]);
    k.box(20, 10, 4, WHITE, [tx, ty + 5, tz + 32]); k.box(4, 7, 4.4, DARK, [tx, ty + 3.5, tz + 32]);
    k.box(18, 9, 14, WHITE, [tx, ty + 4.5, tz - 12]);
    this.lampSpots.push(new THREE.Vector3(tx - 4, ty + 3, tz + 35), new THREE.Vector3(tx + 4, ty + 3, tz + 35));
    // reed boats pulled up on the river bank
    for (let i = 0; i < 9; i++) {
      const z = -200 + i * 47 + r() * 20, x = riverX(z) - RIVER_W - 4 + r() * 3, y = groundHeight(x, z);
      const b = new THREE.CylinderGeometry(0.5, 0.5, 6, 8, 1, false, 0, Math.PI); b.rotateZ(Math.PI / 2); b.rotateX(Math.PI); b.scale(1, 0.55, 1);
      k.add(b, 0xb79a5a, [x, y + 0.35, z], [0, Math.PI / 2 + (r() - 0.5) * 0.4, 0]);
    }
    this.village = k.mesh(); this.egypt.add(this.village);
  }

  // Date palms along the river and round the village (none in the line of sight to Sirius)
  buildPalms() {
    const tk = new Kit(), fk = new Kit(), r = rng(23);
    const palm = (x, z, s) => {
      const y = groundHeight(x, z) - 0.2, h = (8 + r() * 6) * s, lean = (r() - 0.5) * 0.25, la = r() * 6.28;
      const tx = Math.cos(la) * Math.sin(lean) * h, tz = Math.sin(la) * Math.sin(lean) * h;
      // trunk in rings
      for (let i = 0; i < 5; i++) {
        const t0 = i / 5, t1 = (i + 1) / 5;
        tk.add(new THREE.CylinderGeometry(0.17 * s, 0.22 * s, h / 5 + 0.05, 6), i % 2 ? 0x6a553c : 0x5e4a34,
          [x + tx * (t0 + t1) / 2, y + h * (t0 + t1) / 2, z + tz * (t0 + t1) / 2], [Math.sin(la) * lean, 0, -Math.cos(la) * lean]);
      }
      // fronds: long drooping leaves, two-sided
      const top = new THREE.Vector3(x + tx, y + h, z + tz), n = 9 + (r() * 4 | 0);
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.283 + r() * 0.3, up = 0.5 - r() * 0.9, L = (3.3 + r() * 1.2) * s;
        const pts = [], verts = [];
        for (let j = 0; j <= 4; j++) {
          const t = j / 4, dx = Math.cos(a) * L * t, dz = Math.sin(a) * L * t, dy = up * L * t - 1.6 * s * t * t;
          pts.push([top.x + dx, top.y + dy, top.z + dz, (1 - t * 0.85) * 0.55 * s]);
        }
        for (let j = 0; j < 4; j++) {
          const [x0, y0, z0, w0] = pts[j], [x1, y1, z1, w1] = pts[j + 1], px = -Math.sin(a), pz = Math.cos(a);
          verts.push(x0 - px * w0, y0, z0 - pz * w0, x0 + px * w0, y0, z0 + pz * w0, x1 + px * w1, y1, z1 + pz * w1,
            x0 - px * w0, y0, z0 - pz * w0, x1 + px * w1, y1, z1 + pz * w1, x1 - px * w1, y1, z1 - pz * w1);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.computeVertexNormals();
        fk.add(g, [0x3e6a2a, 0x4a7a30, 0x557f34][i % 3]);
      }
    };
    const clear = (x, z) => {
      const az = (Math.atan2(x, -z) / D2R + 360) % 360, d = Math.hypot(x, z);
      if (d < 22) return false;
      if (az > 98 && az < 132) return false;                                 // Sirius' line
      if (az > 52 && az < 72 && d < 600) return false;                       // the Sun's line
      if (az > 265 && az < 310 && d < 400) return false;                     // the pyramids
      return true;
    };
    let n = 0;
    for (let i = 0; i < 400 && n < 130; i++) {
      const z = (r() - 0.5) * 2400, side = r() < 0.6 ? -1 : 1, x = riverX(z) + side * (RIVER_W + 10 + r() * 40);
      if (clear(x, z)) { palm(x, z, 0.9 + r() * 0.3); n++; }
    }
    for (let i = 0; i < 160 && n < 200; i++) {
      const a = r() * 6.283, rr = 0.75 + r() * 0.4, x = VX + Math.cos(a) * 165 * rr, z = Math.sin(a) * 330 * rr;
      if (clear(x, z)) { palm(x, z, 0.85 + r() * 0.35); n++; }
    }
    this.egypt.add(tk.mesh(), fk.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }

  // The pyramids of Giza on the desert edge, as they stood around 2500 BC (closer than in real life,
  // so you can see them well). Khufu's Great Pyramid and Khafre's are finished: smooth, polished white
  // limestone casing over stepped stone courses, with a capstone that catches the first light.
  // Menkaure's is still being built: red granite casing on its lowest courses, the bare stepped
  // core above, and a mud-brick ramp up its side for hauling blocks. Around them: the queens'
  // pyramids, rows of flat-topped mastaba tombs, temples, causeways, and the Sphinx.
  buildPyramids() {
    const OX = 180;   // (the whole complex moved nearer the village than the real 15 km, so it looms)
    const base0 = (x, z, half) => Math.min(groundHeight(x - half, z - half), groundHeight(x + half, z - half), groundHeight(x - half, z + half), groundHeight(x + half, z + half), groundHeight(x, z)) - 0.5;
    // Each face its own shade, so the four sides read apart even in flat dawn light
    const FACE = [1.0, 0.86, 0.74, 0.9];   // east, north, west, south
    const tex = pyramidTex(), ctex = coreTex();
    const cased = [], core = [], plain = new Kit();
    // one smooth four-sided pyramid (with texture coordinates: u along the base, v up the face)
    const facePyr = (out, x, y, z, base, h, tint, top = 1) => {
      const b = base / 2, apex = [x, y + h * top, z];
      const corners = [[x + b, z - b], [x + b, z + b], [x - b, z + b], [x - b, z - b]];   // NE SE SW NW
      const faces = [[0, 1, 0], [3, 0, 1], [2, 3, 2], [1, 2, 3]]; // [from, to, shade index]: east, north, west, south
      for (const [f, t, si] of faces) {
        const [ax, az] = corners[f], [bx, bz] = corners[t];
        const pos = top === 1
          ? [ax, y, az, bx, y, bz, ...apex]
          : [ax, y, az, bx, y, bz, x + (bx - x) * (1 - top), y + h * top, z + (bz - z) * (1 - top), ax, y, az, x + (bx - x) * (1 - top), y + h * top, z + (bz - z) * (1 - top), x + (ax - x) * (1 - top), y + h * top, z + (az - z) * (1 - top)];
        const uv = top === 1 ? [0, 0, 1, 0, 0.5, 1] : [0, 0, 1, 0, 1 - top / 2, top, 0, 0, 1 - top / 2, top, top / 2, top];
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        const c = new THREE.Color(tint).multiplyScalar(FACE[si]), n = pos.length / 3;
        g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, k) => [c.r, c.g, c.b][k % 3]), 3));
        out.push(g);
      }
    };
    // a stepped core: courses of blocks, each a little smaller (for the pyramid still being built)
    const steps = (out, x, y, z, base, h, from, to, n, tint) => {
      for (let i = 0; i < n; i++) {
        const k0 = from + (to - from) * i / n, k1 = from + (to - from) * (i + 1) / n;
        const w = base * (1 - k0) - 1.2, hh = h * (k1 - k0);
        const g = new THREE.BoxGeometry(w, hh, w);
        // texture: block joints scale with the step's size
        const uv = g.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * w / 12, uv.getY(j) * hh / 6);
        g.translate(x, y + h * k0 + hh / 2, z);
        const nrm = g.attributes.normal, cols = [];
        for (let j = 0; j < nrm.count; j++) {
          const nx = nrm.getX(j), nz = nrm.getZ(j), si = nx > 0.5 ? 0 : nz < -0.5 ? 1 : nx < -0.5 ? 2 : nz > 0.5 ? 3 : 0;
          const c = new THREE.Color(tint).multiplyScalar(FACE[si] * (0.92 + (i % 3) * 0.04)); cols.push(c.r, c.g, c.b);
        }
        g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        out.push(g);
      }
    };
    const enclosure = (x, y, z, half) => {
      for (const [ox, oz, w, d] of [[0, -half, half * 2, 3], [0, half, half * 2, 3], [-half, 0, 3, half * 2], [half, 0, 3, half * 2]]) plain.box(w, 5, d, 0xd4c6a4, [x + ox, y + 2.5, z + oz]);
      // the paved court round the pyramid
      plain.box(half * 2 - 4, 0.6, half * 2 - 4, 0xdccfae, [x, y + 0.3, z]);
    };
    const giza = [
      // name, x, z, base, height, tint
      ['Khufu', -760 + OX, -380, 230, 146, 0xf2ead6],
      ['Khafre', -930 + OX, -205, 215, 143, 0xeee4cc],
    ];
    this.pyramidTops = [];
    for (const [, x, z, b, h, tint] of giza) {
      const y = base0(x, z, b / 2);
      facePyr(cased, x, y, z, b, h, tint);
      enclosure(x, y, z, b / 2 + 14);
      this.pyramidTops.push(new THREE.Vector3(x, y + h, z));
      // the mortuary temple on the east side, and its causeway down toward the river
      plain.box(46, 10, 40, 0xd8cbaa, [x + b / 2 + 40, y + 5, z]);
      const x0 = x + b / 2 + 63, x1 = -560 + OX, L = x1 - x0;
      for (let k = 0; k < 6; k++) { const sx = x0 + L * (k + 0.5) / 6; plain.box(L / 6 + 0.5, 4, 9, 0xd0c29e, [sx, groundHeight(sx, z) + 1.2, z]); }
    }
    // Menkaure's pyramid, half built: red granite courses, then the stepped core, a ramp, no top yet
    {
      const x = -1060 + OX, z = -40, b = 105, h = 65, y = base0(x, z, b / 2);
      facePyr(cased, x, y, z, b, h, 0xb8786a, 0.16);                                   // granite casing (lowest 16 courses)
      steps(core, x, y, z, b, h, 0.16, 0.62, 14, 0xcdb48a);                             // the core, built so far
      enclosure(x, y, z, b / 2 + 12);
      // a mud-brick ramp up the east side, as long as it needs to be to reach the working level
      const rise = h * 0.62, rl = 150, xt = x + b * 0.19, xf = xt + rl, len = Math.hypot(rl, rise);
      const rg = new THREE.BoxGeometry(len, 3, 14); rg.rotateZ(-Math.atan2(rise, rl));
      plain.add(rg, 0x8e6e4a, [(xt + xf) / 2, y + rise / 2 - 1.2, z]);
      // its sloping sides of mud brick, down to the ground
      for (let k = 0; k < 6; k++) { const f = (k + 0.5) / 6, hh = rise * (1 - f); plain.box(rl / 6 + 0.3, hh, 15, 0x7e6040, [xt + rl * f, y + hh / 2 - 1.5, z]); }
      // blocks waiting at the foot of the ramp
      const r = rng(71);
      for (let i = 0; i < 26; i++) plain.box(2.4, 1.3, 1.6, 0xcdb48a, [x + b * 0.19 + rl + 6 + r() * 30, base0(x + rl, z, 20) + 0.65, z - 15 + r() * 30], [0, r() * 3, 0]);
    }
    // the queens' pyramids beside Khufu's, small and stepped-and-cased
    for (let i = 0; i < 3; i++) { const qx = -600 + OX, qz = -450 + i * 58, y = base0(qx, qz, 25); facePyr(cased, qx, y, qz, 48, 30, 0xeae0c8); }
    // rows of mastaba tombs (flat-topped, sloping sides) west and east of the Great Pyramid
    const r = rng(83);
    for (const [ox, oz, cols2, rows] of [[-920 + OX, -560, 6, 5], [-605 + OX, -330, 3, 6]]) {
      for (let a = 0; a < cols2; a++) for (let c = 0; c < rows; c++) {
        const mx = ox + a * 26, mz = oz + c * 34, my = base0(mx, mz, 10);
        const g = new THREE.CylinderGeometry(7.5 * Math.SQRT1_2, 9.5 * Math.SQRT1_2, 6, 4, 1); g.rotateY(Math.PI / 4); g.scale(1, 1, 1.9);
        plain.add(g, 0xd2c3a0, [mx, my + 3, mz], [0, 0, 0], [1, 1, 1], 0.9 + r() * 0.15);
      }
    }
    // the Sphinx: a lion lying down with a king's head, carved from the bedrock, looking east
    {
      const sx = -640 + OX, sz = -160, sy = base0(sx, sz, 30);
      plain.box(46, 6, 15, 0xc8a878, [sx - 8, sy + 3, sz]);                      // the rock cut round it
      plain.box(36, 11, 12, 0xd2b484, [sx - 6, sy + 9, sz]);                     // body
      plain.box(18, 4, 4, 0xd2b484, [sx + 18, sy + 5, sz - 3.5]); plain.box(18, 4, 4, 0xd2b484, [sx + 18, sy + 5, sz + 3.5]); // paws
      plain.box(9, 11, 9, 0xd2b484, [sx + 8, sy + 18, sz]);                      // chest and head
      plain.add(new THREE.CylinderGeometry(2, 7.5, 10, 4, 1), 0xc0a070, [sx + 7, sy + 19, sz], [0, Math.PI / 4, 0], [0.7, 1, 1.4]); // the nemes headdress
      plain.box(40, 12, 34, 0xd8cbaa, [sx + 45, sy + 6, sz]);                    // the Sphinx temple in front
    }
    // the valley temples at the edge of the green, where boats tied up
    plain.box(42, 10, 42, 0xd8cbaa, [-520 + OX, groundHeight(-520 + OX, -330) + 4, -330]);
    // (glowing faintly by themselves: pale limestone stays visible under the stars)
    const mat = new THREE.MeshPhongMaterial({ map: tex, vertexColors: true, flatShading: true, shininess: 70, specular: 0x7a7060, emissive: 0x4a4436, emissiveMap: tex });
    const cm = new THREE.MeshLambertMaterial({ map: ctex, vertexColors: true, flatShading: true, emissive: 0x1e1a14 });
    const merge = (list, m) => { const kk = new Kit(); kk.parts.push(...list); return new THREE.Mesh(kk.geometry(), m); };
    this.pyrMat = mat;
    this.egypt.add(merge(cased, mat), merge(core, cm), plain.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x1a1712 })));
    // a small glint on each capstone when the Sun first reaches it
    this.capGlints = this.pyramidTops.map((p) => { const sp = new THREE.Sprite(glowMat('rgba(255,236,190,1)')); sp.position.copy(p); sp.scale.setScalar(26); sp.material.opacity = 0; this.egypt.add(sp); return sp; });
  }

  // Your roof: a low wall all round, mats, jars, the bell on its frame and the priest's sighting post
  buildRoof() {
    const k = new Kit(), Y = ROOF, col = 0xa88c66, W = 9;
    const y0 = groundHeight(0, 0) - 0.3;
    k.box(W, Y - y0, W, col, [0, (Y + y0) / 2 - 0.02, 0]);
    k.box(W - 0.4, 0.04, W - 0.4, 0x8e7450, [0, Y - 0.01, 0]);         // packed-earth floor
    for (const [x, z, w, d] of [[0, W / 2 - 0.15, W, 0.3], [0, -W / 2 + 0.15, W, 0.3], [W / 2 - 0.15, 0, 0.3, W], [-W / 2 + 0.15, 0, 0.3, W]]) k.box(w, 0.55, d, col, [x, Y + 0.275, z]);
    // stair opening (with the top of a ladder) in the north-west corner
    k.box(1.4, 0.05, 2.0, 0x1c140c, [-3.2, Y + 0.02, -2.8]);
    for (const s of [-0.45, 0.45]) k.box(0.08, 1.3, 0.08, 0x6a5232, [-3.2 + s, Y + 0.3, -3.75], [-0.35, 0, 0]);
    // reed awning on poles in the south-west corner, a mat and cushion under it
    for (const [x, z] of [[-4, 1.3], [-1.6, 1.3], [-4, 4], [-1.6, 4]]) k.cyl(0.05, 0.06, 2.3, 6, 0x6a5232, [x, Y + 1.15, z]);
    k.box(2.8, 0.08, 3.2, 0xc4a66a, [-2.8, Y + 2.3, 2.65], [0.06, 0, 0]);
    k.box(2.1, 0.04, 2.5, 0xb8865a, [-2.8, Y + 0.03, 2.6]);
    k.box(0.6, 0.15, 0.35, 0x8a4a3a, [-3.6, Y + 0.1, 3.4]);
    // water jars and baskets
    const lathe = (pts, c, p) => k.add(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 9), c, p);
    lathe([[0, 0], [0.12, 0.02], [0.24, 0.25], [0.22, 0.48], [0.1, 0.62], [0.11, 0.7], [0.0, 0.7]], 0xa45a36, [-4.0, Y, -1.2]);
    lathe([[0, 0], [0.1, 0.02], [0.19, 0.2], [0.17, 0.38], [0.08, 0.48], [0.09, 0.55], [0, 0.55]], 0xb06a40, [-3.5, Y, -1.5]);
    lathe([[0, 0], [0.22, 0.02], [0.26, 0.22], [0, 0.22]], 0xc49a5a, [3.6, Y, 3.7]);
    // the priest's offering table with an oil lamp
    k.box(0.7, 0.05, 0.5, 0xc8b89a, [3.4, Y + 0.75, -3.4]); k.box(0.1, 0.75, 0.1, 0x8a6a44, [3.4, Y + 0.37, -3.4]);
    lathe([[0, 0], [0.07, 0.01], [0.08, 0.04], [0, 0.04]], 0xc07a48, [3.4, Y + 0.78, -3.4]);
    // the sighting post: a palm rib with a V-notch on a stand, looking east over the wall
    const SP = this.sightPos = new THREE.Vector3(W / 2 - 0.15, Y + 0.75, -0.3);
    k.box(0.08, 0.55, 0.06, 0x7a5a36, [SP.x - 0.05, SP.y + 0.27, SP.z]);
    for (const s of [-1, 1]) k.box(0.025, 0.12, 0.05, 0x7a5a36, [SP.x - 0.05, SP.y + 0.6, SP.z + s * 0.035], [s * 0.35, 0, 0]);
    k.cyl(0.004, 0.004, 0.45, 3, 0xe0d8c0, [SP.x + 0.1, SP.y + 0.35, SP.z]);   // the plumb line
    k.ball(0.025, 0, 0x3a3a3a, [SP.x + 0.1, SP.y + 0.12, SP.z]);
    // the bell frame, by the south-east corner
    const B = this.bellPos = new THREE.Vector3(3.2, Y + 1.75, 3.3);
    for (const s of [-1, 1]) k.box(0.12, 2.2, 0.12, 0x5a4228, [B.x + s * 0.55, Y + 1.1, B.z]);
    k.box(1.35, 0.14, 0.16, 0x5a4228, [B.x, Y + 2.2, B.z]);
    this.roof = k.mesh(); this.egypt.add(this.roof);
    // The bell itself swings, so it's its own little mesh
    const bk = new Kit();
    bk.add(new THREE.LatheGeometry([[0.001, 0.02], [0.07, 0.03], [0.12, -0.05], [0.15, -0.25], [0.2, -0.38], [0.21, -0.42], [0.001, -0.4]].map(([a, b]) => new THREE.Vector2(a, b)), 16), 0xb07a3a);
    bk.box(0.04, 0.4, 0.04, 0x5a4228, [0, 0.2, 0]);
    bk.ball(0.04, 0, 0x6a4a2a, [0, -0.38, 0]);
    this.bell = new THREE.Group(); this.bell.position.copy(B).setY(Y + 2.12);
    const bm = new THREE.Mesh(bk.geometry(), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 60, specular: 0x8a6a3a, flatShading: true }));
    bm.position.y = -0.38; this.bell.add(bm); this.egypt.add(this.bell);
    // its rope
    this.bellRope = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 5).translate(0, -0.5, 0), new THREE.MeshLambertMaterial({ color: 0xa8865a }));
    this.bellRope.scale.y = 0.95; this.bellRope.position.y = -0.8; this.bell.add(this.bellRope);
    this.bellSwing = 0; this.bellV = 0;
    // a warm oil lamp glow on the table (no real light: cheap on the Quest)
    this.lamp = new THREE.Sprite(glowMat('rgba(255,190,100,1)')); this.lamp.position.set(3.4, Y + 0.86, -3.4); this.lamp.scale.setScalar(0.35);
    this.egypt.add(this.lamp);
    // "stand here" ring by the sighting post
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.47, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(SP.x - 0.85, Y + 0.05, SP.z); this.ring = ring; this.egypt.add(ring);
  }

  buildPeople() {
    const G = this.G;
    this.people = [];
    // The priest-astronomer: Meem's model (`priest` in models/index.json)
    const pr = this.priest = makePerson({ model: 'priest', seed: 3, tunic: 0xeeeadc, skin: 0x9a6a46, hair: 0x1a1410 });
    pr.g.position.set(3.75, ROOF, 1.0); pr.g.rotation.y = -Math.PI / 2 + 0.25; this.egypt.add(pr.g);
    pr.blk = { x: pr.g.position.x, z: pr.g.position.z, r: 0.3 }; G.world.blockers.push(pr.blk);
    // Neighbours asleep on their roofs (people slept outside on summer nights). They sit up at the bell.
    this.sleepers = [];
    const sk = (x, z, yaw, top) => {
      const k = new Kit();
      k.box(0.8, 0.05, 1.9, 0xb89a68, [0, 0.03, 0]);                                // mat
      k.cyl(0.2, 0.22, 1.4, 7, 0xe8e0cc, [0, 0.2, 0.15], [Math.PI / 2, 0, 0]);        // body under a linen sheet
      k.ball(0.12, 1, 0x6a4430, [0, 0.2, -0.72]);
      const m = k.mesh(); const g = new THREE.Group(); g.add(m);
      m.position.z = 0.72; // pivot at the head end, so it can sit up
      g.position.set(x, top + 0.02, z); g.rotation.y = yaw; this.egypt.add(g); this.sleepers.push({ g, m, d: Math.random() * 0.6 });
    };
    const tops = this.roofSpots;
    for (let i = 0; i < Math.min(8, tops.length); i++) sk(tops[i].x + 1.5, tops[i].z - 1, i * 1.3, tops[i].y);
    // Villagers who come out with lamps when the bell rings, and walk down toward the fields
    this.walkers = [];
    const r = rng(31);
    for (let i = 0; i < 12; i++) {
      const spot = this.lampSpots[(i * 7 + 3) % this.lampSpots.length];
      const P = makePerson({ seed: 50 + i * 5, tunic: [0xe8e0cc, 0xd8ccb0, 0xeee6d2][i % 3], skin: [0x8a5a3a, 0x7a4e32, 0x9a6844][i % 3], hair: 0x1a1410, beard: false });
      P.g.position.set(spot.x, groundHeight(spot.x, spot.z), spot.z); P.g.visible = false;
      P.home = P.g.position.clone();
      P.goal = new THREE.Vector3(50 + r() * 70, 0, P.home.z * 0.6 + (r() - 0.5) * 60);
      P.g.rotation.y = Math.atan2(P.goal.x - P.home.x, P.goal.z - P.home.z);
      P.speed = 1.1 + r() * 0.4;
      const lamp = new THREE.Sprite(glowMat('rgba(255,190,100,1)')); lamp.position.set(0.3, 1.0, 0.25); lamp.scale.setScalar(0.6); P.g.add(lamp);
      this.egypt.add(P.g); this.walkers.push(P); this.people.push(P);
    }
    this.people.push(pr);
  }

  // Life along the Nile: fishermen out on the river with lamps, ibis wading at the field edges,
  // goats and a donkey by the village, egrets flying over at dawn, smoke from the bread ovens.
  buildLife() {
    this.life = new Life(this.egypt);
    this.ibis = this.life.add(makeHerd('ibis', { n: 9, area: { x: 70, z: -40, r: 22 }, height: (x, z) => groundHeight(x, z) + 0.05, seed: 41, scale: 1.4 }));
    this.goats = this.life.add(makeHerd('goat', { n: 7, area: { x: 18, z: 26, r: 7 }, height: groundHeight, seed: 42 }));
    this.donkeys = this.life.add(makeHerd('donkey', { n: 2, area: { x: 22, z: -18, r: 5 }, height: groundHeight, seed: 43 }));
    this.egrets = this.life.add(makeFlock({ n: 14, center: new THREE.Vector3(90, 22, -10), r: 45, height: 6, color: 0xf4f2ea, seed: 44, size: 1.3, speed: 7 }));
    this.egrets.group.visible = false;
    for (const sp of this.roofSpots.slice(2, 6)) this.life.add(makeSmoke(sp.clone().add(_a.set(2, 0.5, 2)), { rise: 9, color: 0xc8c0b4, size: 1.6, opacity: 0.25 }));
    // reed fishing boats drifting on the river, each with a fisherman and a lamp at the bow
    this.boats = [];
    for (let i = 0; i < 4; i++) {
      const k = new Kit(), g = new THREE.Group();
      k.cyl(0.35, 0.25, 5.2, 8, 0xb8a060, [0, 0.15, 0], [Math.PI / 2, 0, 0], [1, 1, 0.55]);   // a bundle of papyrus reeds
      k.cyl(0.18, 0.05, 1.2, 6, 0xb8a060, [0, 0.5, 2.8], [Math.PI / 2 - 0.6, 0, 0]); k.cyl(0.18, 0.05, 1.2, 6, 0xb8a060, [0, 0.5, -2.8], [-Math.PI / 2 + 0.6, 0, 0]);
      k.cyl(0.03, 0.03, 3.2, 4, 0x5a4030, [0.3, 1.0, -1.2], [0.5, 0, 0.2]);                // the pole
      k.cyl(0.2, 0.26, 0.9, 6, 0xe8e0cc, [0, 0.75, -1], 0); k.ball(0.14, 1, 0x7a4e32, [0, 1.35, -1]);   // the fisherman, seated
      g.add(k.mesh());
      const lamp = new THREE.Sprite(glowMat('rgba(255,190,100,1)')); lamp.position.set(0, 1.1, 2.4); lamp.scale.setScalar(5); g.add(lamp);
      g.userData = { z: -260 + i * 170, x: 205 + (i % 2) * 40 + i * 6, v: (i % 2 ? 1 : -1) * (0.6 + i * 0.1), lamp };
      this.egypt.add(g); this.boats.push(g);
    }
  }

  // ch3_09: the Egyptian year as a ring in the sky (Flood, Growing, Harvest), which turns into our
  // own calendar's twelve months
  buildCalendar() {
    const wheel = (months) => canvasTex(512, 512, (g, w) => {
      const c = w / 2, R = 230;
      g.lineCap = 'butt';
      const segs = months ? 12 : 3, cols = months ? null : ['#5aa0d8', '#6ab04a', '#e0b040'];
      const names = months ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['Flood', 'Growing', 'Harvest'];
      for (let i = 0; i < segs; i++) {
        const a0 = -Math.PI / 2 + i / segs * Math.PI * 2 + 0.03, a1 = -Math.PI / 2 + (i + 1) / segs * Math.PI * 2 - 0.03;
        g.strokeStyle = months ? ['#5aa0d8', '#6ab04a', '#e0b040'][Math.floor(((i + 6) % 12) / 4)] : cols[i];
        g.globalAlpha = 0.85; g.lineWidth = 56; g.beginPath(); g.arc(c, c, R - 40, a0, a1); g.stroke(); g.globalAlpha = 1;
        const am = (a0 + a1) / 2; g.fillStyle = '#fff8e8'; g.font = `bold ${months ? 30 : 40}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.save(); g.translate(c + Math.cos(am) * (R - 40), c + Math.sin(am) * (R - 40)); g.rotate(am + Math.PI / 2); g.fillText(names[i], 0, 0); g.restore();
      }
      g.fillStyle = '#fff2c8'; g.font = 'bold 44px Georgia, serif'; g.textAlign = 'center'; g.fillText('365', c, c - 8); g.font = '28px Georgia, serif'; g.fillText('days', c, c + 30);
    });
    this.calMats = [wheel(false), wheel(true)].map((map) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    this.cal = new THREE.Group();
    for (const m of this.calMats) this.cal.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m));
    this.cal.position.copy(at(92, 55, ROOF + 14)); this.cal.scale.setScalar(26); this.cal.lookAt(0, ROOF + 1.6, 0);
    this.cal.visible = false; this.egypt.add(this.cal);
  }

  // Sirius itself (bright, twinkling, a little bigger than the sky's other stars), its name,
  // the glow of lamps across the village, and the rays you point with.
  buildSkyBits() {
    this.sirius = new THREE.Sprite(glowMat('rgba(230,240,255,1)')); this.sirius.renderOrder = -7; this.egypt.add(this.sirius);
    this.siriusRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.egypt.add(this.siriusRing);
    this.siriusLabel = textSprite('Sirius', 'Sopdet, to the Egyptians'); this.siriusLabel.material.opacity = 0; this.egypt.add(this.siriusLabel);
    // village lamps: one Points mesh (one draw call) for all of them
    const pos = new Float32Array(this.lampSpots.length * 3);
    this.lampSpots.forEach((p, i) => pos.set([p.x, p.y, p.z], i * 3));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tex = glowMat('rgba(255,180,90,1)').map;
    this.lamps = new THREE.Points(g, new THREE.PointsMaterial({ map: tex, size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.egypt.add(this.lamps);
    // pointing rays from the controllers (only while you search for Sirius)
    this.rays = [];
    const rm = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    for (const h of this.G.player.hands) {
      const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.006, 1, 5, 1, true).translate(0, 0.5, 0).rotateX(-Math.PI / 2), rm.clone());
      ray.scale.z = 25; ray.visible = false; h.ctrl.add(ray); this.rays.push(ray);
    }
    this.aimHold = 0;
  }

  // ---------- The Nebra bridge: a hilltop in Germany at night ----------
  buildNebra() {
    const N = this.nebra;
    const g = new THREE.PlaneGeometry(1600, 1600, 120, 120); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), z = p.getZ(i);
      const r0 = Math.hypot(x, z), k = r0 > 0 ? Math.pow(r0 / 800, 1.6) * 800 / r0 : 0; x *= k; z *= k;
      const y = nebraHeight(x, z); p.setXYZ(i, x, y, z);
      c.setHex(0x2a3a22).lerp(new THREE.Color(0x3c4a2a), N1(x / 20, z / 20));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    N.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    // a ring of dark oak and pine woods below the bare hilltop
    const k = new Kit(), r = rng(61);
    for (let i = 0; i < 380; i++) {
      const a = r() * 6.283, d = 26 + Math.pow(r(), 0.7) * 300, x = Math.cos(a) * d, z = Math.sin(a) * d, y = nebraHeight(x, z), s = 0.8 + r() * 0.6;
      if (r() < 0.6) { k.cyl(0.2 * s, 0.3 * s, 3 * s, 5, 0x2a2018, [x, y + 1.5 * s, z]); k.add(new THREE.ConeGeometry(2.2 * s, 7 * s, 7), 0x1e3020, [x, y + 6 * s, z]); }
      else { k.cyl(0.25 * s, 0.4 * s, 4 * s, 5, 0x2a2018, [x, y + 2 * s, z]); k.ball(3.2 * s, 1, 0x243a22, [x, y + 6.2 * s, z], 0, [1, 0.85, 1]); }
    }
    // a small fire's embers and two upright stones where the disk was buried
    k.box(0.5, 1.1, 0.35, 0x5a5a52, [2.2, nebraHeight(2.2, -2) + 0.5, -2], [0, 0.4, 0.05]);
    k.box(0.45, 0.9, 0.3, 0x55554e, [2.9, nebraHeight(2.9, -1.4) + 0.4, -1.4], [0, 0.2, -0.06]);
    N.add(k.mesh());
    // the disk
    const disk = new THREE.Group();
    // (lit a little by itself: it's night, and you need to see it)
    this.diskTex = [0, 1, 2, 3].map((k) => nebraTex(k));   // ch3 bridge: the gold goes on piece by piece as Astra names it
    const face = new THREE.MeshBasicMaterial({ map: this.diskTex[3], color: 0x9a9a92 }); this.diskFace = face;
    const edge = new THREE.MeshBasicMaterial({ color: 0x1e4a3e });
    const dm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.01, 48), [edge, face, edge]);
    dm.rotation.x = Math.PI / 2; disk.add(dm);       // face toward +Z (toward you, or up when held up)
    this.disk = disk; this.diskGlow = new THREE.Sprite(glowMat('rgba(255,220,130,1)')); this.diskGlow.scale.setScalar(0.5); this.diskGlow.material.opacity = 0; disk.add(this.diskGlow);
    disk.visible = false; N.add(disk);
    // the Pleiades, highlighted when you find them (the real sky draws the stars themselves)
    this.pleiades = new THREE.Group();
    const sm = glowMat('rgba(220,232,255,1)');
    for (const st of PLEIADES) {
      const [az, el] = altAz(st, NEBRA_LAT, NEBRA_LST);
      const sp = new THREE.Sprite(sm.clone()); dirFromAzEl(az, el, sp.position).multiplyScalar(800);
      sp.scale.setScalar(5 + (5 - st.mag) * 2.4); sp.userData.mag = st.mag; this.pleiades.add(sp);
    }
    const [paz, pel] = altAz(PLEIADES[0], NEBRA_LAT, NEBRA_LST);
    this.pleiadesDir = dirFromAzEl(paz, pel);
    const lab = textSprite('The Pleiades', 'the Seven Sisters'); dirFromAzEl(paz, pel - 4.2, lab.position).multiplyScalar(780); lab.scale.multiplyScalar(40);
    lab.material.opacity = 0; this.pleiadesLabel = lab; this.pleiades.add(lab);
    this.pleiadesRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.pleiadesRing.position.copy(this.pleiadesDir).multiplyScalar(790); this.pleiadesRing.lookAt(0, 0, 0); this.pleiadesRing.scale.setScalar(28);
    this.pleiades.add(this.pleiadesRing);
    this.pleiades.visible = false; N.add(this.pleiades);
  }

  registerInteractables() {
    const G = this.G, self = this;
    // The bell: grab its rope and tug, or just hit the bell
    const ropeEnd = () => { self.bellRope.getWorldPosition(_a); _a.y -= 0.6; return _a; };
    this.bellIt = {
      hint: 'Grab the bell rope (GRIP) and tug it, or hit the bell',
      deskHint: 'Click the bell to ring it',
      get disabled() { return !['bell', 'found'].includes(self.s.phase); },
      reach(pos) {
        self.bellRope.getWorldPosition(_b); const top = _b.y, rx = _b.x, rz = _b.z;
        const y = clamp(pos.y, top - 1.0, top), dRope = Math.hypot(pos.x - rx, pos.y - y, pos.z - rz);
        self.bell.getWorldPosition(_b); _b.y -= 0.25;
        return Math.min(dRope, Math.max(0, pos.distanceTo(_b) - 0.22));
      },
      aim(o, d) { _b.copy(self.bellPos).sub(o); _b.y -= 0.4; const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.55 ? t : Infinity; },
      onGrab(h) { h.bellFrom = h.pos.y; if (h.desk) G.act({ type: 'ring' }); },
      onHold(h) { if (h.bellFrom != null && h.bellFrom - h.pos.y > 0.08) { G.act({ type: 'ring' }); G.player.haptic(h, 0.8, 80); h.bellFrom = h.pos.y; } if (h.pos.y > h.bellFrom) h.bellFrom = h.pos.y; },
      onTouch() { G.act({ type: 'ring' }); },
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
    // The Nebra disk: grab it and hold it up to the sky
    this.diskIt = {
      hint: 'Grab the disk (GRIP) and hold it up to the sky',
      deskHint: 'Click the disk to hold it up, then look up',
      get disabled() { return self.s.phase !== 'hold'; },
      reach(pos) { self.disk.getWorldPosition(_a); return Math.max(0, pos.distanceTo(_a) - 0.16); },
      aim(o, d) { self.disk.getWorldPosition(_a); _b.copy(_a).sub(o); const t = _b.dot(d); return t > 0 && _b.addScaledVector(d, -t).length() < 0.25 ? t : Infinity; },
      onGrab(h) { self.diskHand = h; },
      onRelease(h) { if (self.diskHand === h && !h.desk) self.diskHand = null; },
      onTouch(h) { self.diskHand = h; },
    };
    G.interactables.push(this.bellIt, this.pageIt, this.diskIt);
  }

  // ---------- Actions from any player (run on the host) ----------
  act(a) {
    const s = this.s;
    if (a.type === 'found' && s.phase === 'search') { s.found = 1; return true; }
    if (a.type === 'ring' && (s.phase === 'bell' || s.phase === 'found')) { s.rung++; return true; }
    if (a.type === 'touchPage' && s.journal === 1) { s.journal = 2; return true; }
    if (a.type === 'holdUp' && s.phase === 'hold') { s.held = 1; return true; }
    return false;
  }
  getState() { return this.s; }
  setState(st) { Object.assign(this.s, st); }

  // ---------- The story (host only) ----------
  async run(D) {
    const G = this.G, s = this.s, fast = G.params.has('fast');
    const placeAll = (pos, yaw) => G.events.emit('placePlayers', { x: pos.x, z: pos.z, yaw });
    // Start in the middle of the roof, looking west-north-west toward the pyramids
    placeAll(new THREE.Vector3(0.6, 0, 0.4), this.faceToward(_a.set(0.6, 0, 0.4), at(292, 100)));
    G.guide.place();
    await G.ui.fadeIn(2.5);
    s.phase = 'arrive';
    await D.say('ch3_01');
    s.guide = at(288, 14, ROOF + 3.2).toArray();               // Astra floats out toward the pyramids
    await D.say('ch3_02');
    s.guide = at(80, 16, ROOF + 1.8).toArray();                // ...then over to the river side
    D.hint('Turn around to see the river (right stick)', 6);
    if (D.kids) D.goTo(new THREE.Vector3(0.6, 0, 0.4), this.faceToward(_c.set(0.6, 0, 0.4), at(80, 100))).catch(() => {});   // turn you to face it
    await D.say('ch3_03');
    s.guide = at(140, 12, ROOF + 1.5).toArray();
    // the flood, shown: the water spreads over the fields, then drains away leaving black mud
    const l4 = D.sayAsync('ch3_04');
    await D.cue('It spreads'); s.preview = 1;
    await D.cue('If you know'); s.preview = 2;
    await l4;
    s.preview = 0;
    // The priest by his sighting post; watch the east
    s.phase = 'watch'; s.ring = 1; s.point = 1;
    const [, , saz] = skyAt(0);
    s.guide = at(saz - 22, 9, ROOF + 1.2).toArray();           // beside the line to Sirius, not in it
    await D.say('ch3_05');
    s.ring = 0;
    // Search: Sirius comes up over the horizon. Point at it.
    s.phase = 'search'; this.searchT = G.t;
    if (s.tm < -6) s.tm = -6;                                  // (only if the lines were skipped)
    D.hint(G.mode === 'desktop' ? 'Look for a bright star just rising in the east, and hold the crosshair on it' : 'A bright star is rising in the east. Point at it with your controller', 9);
    // Kids mode: once Sirius is up, the priest spots it for everyone
    const got = await D.auto(() => s.found, () => { if ((this.sirEl ?? -9) > 1) s.found = 1; }, { after: fast ? 0.5 : 6, timeout: fast ? 8 : 90 });
    if (!got) s.found = 1;                                      // after a while, the priest shows everyone
    G.ui.showHint('');
    s.phase = 'found'; s.point = 2;
    G.events.emit('sfx', { k: 'swell' });
    await D.say('ch3_06');
    // Ring the bell
    s.phase = 'bell'; s.point = 0; s.guide = _a.copy(this.bellPos).add(_b.set(-0.6, 0.5, -0.6)).toArray();
    const rung0 = s.rung;
    await D.say('ch3_07');
    if (s.rung === rung0) D.hint(G.mode === 'desktop' ? this.bellIt.deskHint : this.bellIt.hint, 8);
    if (!(await D.auto(() => s.rung > rung0, () => { s.rung++; }, { after: fast ? 0.3 : 1.2, timeout: fast ? 4 : 40 }))) s.rung++;   // the priest rings it if nobody does
    G.ui.showHint('');
    s.phase = 'sunrise'; s.guide = null;
    await D.until(() => s.lights >= 1 && s.tm >= 52, fast ? 6 : 40);
    // A whole year in under a minute: Flood, Growing, Harvest
    s.phase = 'year';
    s.guide = at(95, 30, ROOF + 2).toArray();
    await D.say('ch3_08');
    await D.until(() => s.year >= 1);
    s.phase = 'closing'; s.guide = null;
    s.cal = 1;                                                 // the Egyptian year, as a ring...
    const l9 = D.sayAsync('ch3_09');
    await D.cue('basic shape'); s.cal = 2;                     // ...that becomes our own twelve months
    await l9;
    await D.wait(fast ? 0.3 : 1.5); s.cal = 0;
    // The journal page
    s.journal = 1; s.phase = 'journal';
    G.events.emit('sfx', { k: 'page' });
    D.hint(G.mode === 'desktop' ? this.pageIt.deskHint : this.pageIt.hint, 8);
    await D.auto(() => s.journal === 2, () => this.act({ type: 'touchPage' }), { after: fast ? 0.5 : 4 });
    G.ui.showHint('');
    G.events.emit('sfx', { k: 'page' });
    await D.wait(1.2);

    // ---------- Bridge: the Nebra sky disk ----------
    await G.ui.fadeOut(1.2);
    s.scene = 'nebra'; s.phase = 'bridge'; s.journal = 0;
    placeAll(new THREE.Vector3(0, 0, 0.5), this.faceToward(_a.set(0, 0, 0.5), at(135, 10)));
    G.guide.place();
    await D.wait(0.3);
    await G.ui.fadeIn(2);
    s.phase = 'hold'; s.gold = 0;                              // the gold goes on as Astra names each piece
    const lb = D.sayAsync('br3_01');
    await D.cue('golden Sun'); s.gold = 1;
    await D.cue('a Moon'); s.gold = 2;
    await D.cue('little cluster'); s.gold = 3;
    await lb;
    D.hint(G.mode === 'desktop' ? this.diskIt.deskHint : this.diskIt.hint, 9);
    if (!(await D.auto(() => s.held, () => { s.held = 1; }, { after: fast ? 0.3 : 2, timeout: fast ? 4 : 45 }))) s.held = 1;
    G.ui.showHint('');
    G.events.emit('sfx', { k: 'swell' });
    await D.until(() => s.match >= 1, fast ? 3 : 10);
    await D.wait(fast ? 1 : 5);
    s.phase = 'done';
  }

  faceToward(from, to) { return Math.atan2(-(to.x - from.x), -(to.z - from.z)); }

  // ---------- Every frame, every headset ----------
  update(dt, t) {
    const G = this.G, s = this.s, host = G.isHost, fast = G.params.has('fast') ? 4 : 1;
    const nebra = s.scene === 'nebra';
    this.egypt.visible = !nebra; this.nebra.visible = nebra;
    if (host) {
      // the sky turns: slowly while you listen, faster to dawn and through the year
      const rate = { arrive: 0.55, watch: 0.85, search: s.tm < 2 ? 0.45 : s.tm < 9 ? 0.12 : 0, found: 0.08, bell: 0.08, sunrise: s.lights >= 1 ? 3.2 : 0.3, year: 3, closing: 0.4, journal: 0.3 }[s.phase] ?? 0;
      s.tm = Math.min(s.phase === 'watch' ? -5 : s.phase === 'arrive' ? -16 : 200, s.tm + dt * rate * fast);
      if (s.rung > 0) s.lights = Math.min(1, s.lights + dt * 0.35 * fast);
      if (s.phase === 'year') s.year = Math.min(1, s.year + dt / 24 * fast);
      if (s.phase === 'hold' && s.held) s.match = Math.min(1, s.match + dt / 2.5 * fast);
    }
    if (nebra) { this.updateNebra(dt, t); return; }

    // Sky: the Sun from the worked-out positions; the real star sky turns to match
    const [sunAz, sunEl, sirAz0, sirEl0] = skyAt(s.tm + this.calibrate());
    G.sky.sunSize = 1.2;
    G.sky.set(sunAz, sunEl);
    G.sky.hideMoon();
    // Sirius: the catalog's Sirius (once the sky has loaded), with an extra twinkle drawn on top of
    // it: bright, flickering in colour near the horizon (it really does), dimmed by the dawn
    const sf = G.sky.starField, si = sf.find('Sirius');
    let sd = dirFromAzEl(sirAz0, sirEl0, _a);
    if (si >= 0) { sf.update(sunAz, sunEl, t); sd = sf.dirOf(si, _a); }
    const sirEl = Math.asin(clamp(sd.y, -1, 1)) / D2R, sirAz = (Math.atan2(sd.x, -sd.z) / D2R + 360) % 360;
    this.sirEl = sirEl;
    this.sirius.position.copy(sd).multiplyScalar(850);
    const ext = smooth(-0.4, 1.6, sirEl) * (1 - smooth(-6.5, -2.5, sunEl));
    const tw = 0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.3 + 1) + 0.12 * Math.sin(t * 41);
    this.sirius.material.opacity = ext * tw;
    this.sirius.material.color.setRGB(0.85 + 0.15 * Math.sin(t * 5.1), 0.9 + 0.1 * Math.sin(t * 6.7 + 2), 1);
    this.sirius.scale.setScalar(12 + 5 * ext);
    this.sirius.visible = ext > 0.01;
    // after it's found: a ring round it and its name
    const shown = s.found && s.phase !== 'year' && s.phase !== 'closing' && s.phase !== 'journal' ? 1 : 0;
    this.siriusShown = damp(this.siriusShown || 0, shown * ext, 2, dt);
    this.siriusRing.position.copy(sd).multiplyScalar(840); this.siriusRing.lookAt(0, 0, 0);
    this.siriusRing.scale.setScalar(26 + Math.sin(t * 2) * 1.5); this.siriusRing.material.opacity = this.siriusShown * 0.7;
    this.siriusLabel.position.copy(dirFromAzEl(sirAz, sirEl + 5, _b)).multiplyScalar(830); this.siriusLabel.scale.set(4 * 48, 48, 1);
    this.siriusLabel.material.opacity = this.siriusShown;
    // these sky things move with you, like the sky does
    G.camera.getWorldPosition(_c);
    for (const o of [this.sirius, this.siriusRing, this.siriusLabel]) { o.position.add(_c); }

    // Searching: does a controller (or the desktop crosshair) point at Sirius?
    const searching = s.phase === 'search';
    for (const r of this.rays) r.visible = searching && G.mode === 'vr';
    if (searching && !s.found && sirEl > -0.2) {
      let best = 0;
      if (G.mode === 'vr') {
        G.player.hands.forEach((h, i) => {
          if (!h.src) return;
          h.ctrl.getWorldQuaternion(_q); _b.set(0, 0, -1).applyQuaternion(_q);
          const c = _b.dot(sd); best = Math.max(best, c);
          this.rays[i].material.opacity = c > Math.cos(6 * D2R) ? 0.8 : 0.3;
        });
      } else if (G.mode === 'desktop') { G.camera.getWorldDirection(_b); best = _b.dot(sd); }
      this.aimHold = best > Math.cos(6 * D2R) ? this.aimHold + dt : Math.max(0, this.aimHold - dt * 2);
      if (this.aimHold > 0.5) { this.aimHold = 0; G.act({ type: 'found' }); G.audio.chime(null, 0.5); }
      // a nudge: after 30 s Astra flies out along the line to Sirius
      if (host && G.t - this.searchT > 30 / fast && !this.nudged) { this.nudged = true; s.guide = at(sirAz - 4, 12, ROOF + 1.6 + 12 * Math.tan(Math.max(1, sirEl) * D2R)).toArray(); }
    }

    // Water: the river, then the flood rising over the fields and going down again
    const y = s.year;
    // (ch3_04 shows it early: up over the fields, then down again leaving black mud)
    this.previewV = damp(this.previewV || 0, s.preview === 1 ? 1 : 0, 0.7, dt);
    this.mudV = damp(this.mudV || 0, s.preview === 2 ? 1 : 0, 1.2, dt);
    const flood = Math.max(this.previewV * 0.8, s.phase === 'year' || s.phase === 'closing' || s.phase === 'journal' ? Math.sin(Math.PI * clamp(y / 0.42, 0, 1)) : 0);
    const level = lerp(FLOOD_LO, FLOOD_HI, ease(flood));
    this.water.position.y = level;
    const wet = Math.max(Math.round(Math.max(this.previewV, this.mudV) * 10) / 10, clamp(smooth(0.06, 0.18, y) - smooth(0.5, 0.62, y) * 0.6, 0, 1));
    const key = Math.round(y * 200) + Math.round(wet * 50) * 1000;
    if (key !== this.view.season) { this.view.season = key; this.colorFields(y, wet); }
    this.fields.visible = level < FLOOD_HI - 0.05;
    // the flood water is brown with silt; the river in summer is dark and clear
    this.water.material.emissive.copy(G.scene.fog.color).multiplyScalar(0.3 - 0.2 * flood);
    this.water.material.color.setHex(0x22404e).lerp(SILT, smooth(0.0, 0.5, flood) * (s.phase === 'year' || s.preview ? 1 : 0));
    const grow = smooth(0.42, 0.6, y), ripe = smooth(0.7, 0.85, y), cut = smooth(0.94, 1.0, y);
    this.crops.visible = grow > 0.01 && cut < 0.99 && level < 0.1;
    this.crops.scale.y = Math.max(0.01, grow * (1 - cut));
    this.crops.material.color.setRGB(lerp(0.33, 0.8, ripe), lerp(0.6, 0.64, ripe), lerp(0.18, 0.24, ripe));
    if (s.phase === 'year') {
      const name = y < 0.42 ? 'Flood' : y < 0.72 ? 'Growing' : 'Harvest';
      if (name !== this.season) { this.season = name; G.ui.showHint(name, 4); if (name === 'Flood') rush(G.audio, 0.5); }
    }
    // the first sunlight touches the pyramids' capstones before anything else
    for (const g of this.capGlints) g.material.opacity = smooth(-1.5, 0.5, sunEl) * (1 - smooth(4, 10, sunEl)) * 0.8;
    // ...and the white casing blushes rose-gold in the first sunlight, like real limestone at dawn
    const glow = smooth(-2.5, 0.5, sunEl) * (1 - smooth(5, 14, sunEl));
    this.pyrMat.color.setRGB(1, 1 - 0.16 * glow, 1 - 0.34 * glow);
    this.pyrMat.emissive.setRGB(0.29 + 0.12 * glow, 0.27 + 0.06 * glow, 0.21);
    // Village lamps and people
    this.lamps.material.opacity = 0.15 + 0.85 * s.lights * (1 - smooth(-2, 6, sunEl) * 0.8);
    this.lamp.material.opacity = 0.8 + 0.2 * Math.sin(t * 13) * Math.sin(t * 5);
    for (const sl of this.sleepers) {
      const k = smooth(sl.d, sl.d + 1, s.lights * 2.2);
      sl.m.rotation.x = -k * 1.3; sl.g.visible = s.lights < 1 || s.phase !== 'year';
    }
    for (const P of this.walkers) {
      P.g.visible = s.lights > 0.05;
      if (s.lights > 0.2 && s.phase !== 'arrive') {
        // Through the year: up the mound out of the flood, then out to the fields to plant, tend and
        // bring in the harvest (some carry the sheaves home on their heads)
        const yr = s.phase === 'year' ? s.year : s.phase === 'closing' || s.phase === 'journal' ? 1 : -1;
        const home = yr > 0.04 && yr < 0.42;
        const there = walkToward(P, home ? P.home.x : P.goal.x, home ? P.home.z : P.goal.z, dt, { speed: P.speed * fast * (yr >= 0 ? 2.5 : 1), height: groundHeight, stop: 0.5 });
        if (there) {
          if (yr < 0) { P.pose = 'point'; P.pointAt.set(400, 2, P.g.position.z); }
          else if (home) P.pose = 'idle';
          else if (yr < 0.72) P.pose = 'work';
          else P.pose = P.phase % 3 < 1 ? 'carry' : 'work';
        }
      }
      animatePerson(P, t, dt);
    }
    // Life: boats drift on the river, lamps fading at dawn; birds fly once it's light
    for (const b of this.boats) {
      const u = b.userData; u.z += u.v * dt; if (u.z > 400) u.z = -400; if (u.z < -400) u.z = 400;
      b.position.set(u.x, Math.max(FLOOD_LO, this.water.position.y) + 0.05 + Math.sin(t * 1.3 + u.x) * 0.04, u.z); b.rotation.y = u.v > 0 ? 0 : Math.PI;
      u.lamp.material.opacity = clamp(1 - (sunEl + 4) / 8, 0, 1) * (0.8 + 0.2 * Math.sin(t * 9 + u.x));
    }
    this.egrets.group.visible = sunEl > -3;
    this.ibis.group.visible = this.water.position.y < 0;   // (they fly off when the flood comes)
    this.life.update(dt, t);
    // ch3_09: the year as a ring, turning into our twelve months
    this.calV = damp(this.calV || 0, s.cal ? 1 : 0, 1.5, dt); this.calM = damp(this.calM || 0, s.cal === 2 ? 1 : 0, 1.2, dt);
    this.cal.visible = this.calV > 0.01;
    this.calMats[0].opacity = this.calV * (1 - this.calM) * 0.95; this.calMats[1].opacity = this.calV * this.calM * 0.95;
    this.cal.rotation.z = (1 - this.calV) * 0.6;
    // The priest: points at where Sirius will rise, raises his arms when it's found
    const pr = this.priest;
    pr.pose = s.phase === 'found' ? 'cheer' : s.point ? 'point' : 'idle';
    pr.pointAt.copy(dirFromAzEl(sirAz, Math.max(sirEl, 0.5), _b)).multiplyScalar(60).add(pr.g.position).setY(pr.g.position.y + 2.2);
    if (s.phase === 'bell' || s.phase === 'sunrise') { pr.pose = 'point'; pr.pointAt.copy(this.bellPos); }
    animatePerson(pr, t, dt);
    // The bell swings and rings
    if (s.rung !== this.rungSeen) {
      if (this.rungSeen != null && s.rung > this.rungSeen) { this.bellV += 2.6; bell(G.audio, this.bellPos, 1); this.ringsLeft = 3; this.ringT = 1.4; }
      this.rungSeen = s.rung;
    }
    if (this.ringsLeft > 0) { this.ringT -= dt; if (this.ringT <= 0) { this.ringsLeft--; this.ringT = 1.4; this.bellV += 1.8; bell(G.audio, this.bellPos, 0.8); } }
    this.bellV += (-this.bellSwing * 18 - this.bellV * 1.2) * dt; this.bellSwing += this.bellV * dt;
    this.bell.rotation.x = this.bellSwing * 0.35;
    // Stand-here ring
    this.ringV = damp(this.ringV || 0, s.ring, 3, dt);
    this.ring.material.opacity = this.ringV * (0.55 + 0.25 * Math.sin(t * 3)); this.ring.visible = this.ringV > 0.01;
    // Astra
    this.updateGuide(t);
    // Night sounds: crickets and frogs by the river until the Sun is up; birds at dawn
    if (sunEl < 2) {
      this.critT -= dt; if (this.critT <= 0) { this.critT = 0.25 + Math.random() * 0.7; cricket(G.audio, at(Math.random() * 360, 8 + Math.random() * 30, ROOF - 3)); }
      this.frogT -= dt; if (this.frogT <= 0) { this.frogT = 0.8 + Math.random() * 2.5; frog(G.audio, at(60 + Math.random() * 60, 240 + Math.random() * 60, 0)); }
    }
    if (sunEl > -6) { this.birdT -= dt; if (this.birdT <= 0) { this.birdT = 1 + Math.random() * 4; G.audio.chirp(at(Math.random() * 360, 20 + Math.random() * 40, ROOF + 4)); } }
  }

  updateGuide(t) {
    const G = this.G, s = this.s;
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

  updateNebra(dt, t) {
    const G = this.G, s = this.s;
    if (!this.nebraSky) this.setupNebraSky();
    G.sky.sunSize = 1; G.sky.set(...this.nebraSky); G.sky.hideMoon();
    G.camera.getWorldPosition(_c);
    this.pleiades.visible = true; this.pleiades.position.copy(_c);
    // the disk: floating in front of you until you take it, then in your hand
    const d = this.disk; d.visible = s.phase === 'hold' || s.phase === 'done';
    const h = this.diskHand;
    if (h && s.phase === 'hold') {
      if (h.desk) {
        // desktop: held up at arm's length, to the left of where you look, facing you
        G.camera.getWorldDirection(_b); _a.set(1, 0, 0).applyQuaternion(G.camera.getWorldQuaternion(_q));
        d.position.copy(_c).addScaledVector(_b, 0.6).addScaledVector(_a, -0.32).y -= 0.1; d.lookAt(_c);
      } else {
        d.position.copy(h.pos); d.lookAt(_c);   // in your hand, its picture turned toward your eyes
      }
      // held up high, or held up toward the Pleiades (by the one holding it)
      _b.copy(d.position).sub(_c).normalize();
      const up = d.position.y > _c.y - 0.05 || _b.dot(this.pleiadesDir) > Math.cos(30 * D2R);
      if (up && !s.held && !this.sentHold) { this.sentHold = true; G.act({ type: 'holdUp' }); }
    } else if (!s.held) {
      if (!this.diskSet) {
        G.camera.getWorldDirection(_b); _b.y = 0; _b.normalize();
        this.diskHome = _c.clone().addScaledVector(_b, 0.55).setY(_c.y - 0.3); this.diskSet = true;
      }
      d.position.copy(this.diskHome); d.position.y += Math.sin(t * 1.5) * 0.01;
      d.lookAt(_c);
    } else if (!h) {
      // someone else held it up: it floats up beside you toward the stars
      d.position.lerp(_a.copy(_c).addScaledVector(this.pleiadesDir, 0.6), 0.05); d.lookAt(_a.copy(d.position).add(this.pleiadesDir));
    }
    // the gold goes on piece by piece (with a flash each time)
    if (this.diskFace.map !== this.diskTex[s.gold ?? 3]) { this.diskFace.map = this.diskTex[s.gold ?? 3]; this.diskFace.needsUpdate = true; this.goldFlash = 1; G.audio.chime?.(d.position, 0.4); }
    this.goldFlash = Math.max(0, (this.goldFlash || 0) - dt * 1.5);
    // the stars on the disk and in the sky light up together
    const m = ease(s.match);
    this.diskGlow.material.opacity = Math.max(m * (0.6 + 0.2 * Math.sin(t * 3)), this.goldFlash * 0.8);
    for (const sp of this.pleiades.children) if (sp.isSprite && sp !== this.pleiadesLabel) sp.material.opacity = 0.35 + m * 0.65 * (0.85 + 0.15 * Math.sin(t * 9 + sp.userData.mag * 7));
    this.pleiadesLabel.material.opacity = smooth(0.4, 1, s.match);
    this.pleiadesRing.material.opacity = m * 0.6;
    this.pleiadesRing.scale.setScalar(26 + Math.sin(t * 2));
    if (s.phase === 'hold' && !s.held) G.guide.flyTo(_a.copy(this.diskHome || _c).add(_b.set(0.35, 0.25, 0)), _c);
    else if (s.held && !this.guideFreed) {
      // Astra moves aside (never in front of the stars) and looks up at them with you
      this.guideFreed = true; _b.crossVectors(this.pleiadesDir, _a.set(0, 1, 0)).normalize();
      G.guide.flyTo(_a.copy(this.pleiadesDir).addScaledVector(_b, -0.45).normalize().multiplyScalar(5).add(_c).setY(_c.y + 0.6), _c.clone().addScaledVector(this.pleiadesDir, 50));
    }
    this.critT -= dt; if (this.critT <= 0) { this.critT = 0.3 + Math.random() * 0.9; cricket(G.audio, at(Math.random() * 360, 6 + Math.random() * 20, 0)); }
  }

  // The catalog Sirius rises a few minutes off from our own sum (the catalog leaves out Sirius' own
  // slow drift): shift the clock so it stands 1° up at the planned moment, Sun about 9° down.
  calibrate() {
    if (this.tmShift != null) return this.tmShift;
    const sf = this.G.sky.starField, si = sf.find('Sirius');
    if (si < 0) return 0;
    let lo = -40, hi = 40;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2, [az, el] = skyAt(m); sf.update(az, el, 0);
      if (Math.asin(sf.dirOf(si, _b).y) / D2R < 1) lo = m; else hi = m;
    }
    return (this.tmShift = (lo + hi) / 2);
  }

  // The bridge's sky: the Mittelberg in 1600 BC, an autumn night with the Pleiades high in the south-east
  setupNebraSky() {
    const G = this.G, sf = G.sky.starField;
    G.sky.setPlace({ lat: NEBRA_LAT, year: -1600, sunLon: 215 });
    this.nebraSky = [320, -32];
    const names = ['Alcyone', 'Atlas', 'Electra', 'Maia', 'Merope', 'Taygeta'], ids = names.map((n) => sf.find(n)).filter((i) => i >= 0);
    if (!ids.length) return;
    // choose the time of night (where the Sun is, far below the horizon) that puts them about 55° up, toward the south-east
    let best = Infinity;
    for (let az = 0; az < 360; az += 1) {
      sf.update(az, -34, 0); const d = sf.dirOf(ids[0], _b), el = Math.asin(d.y) / D2R, paz = (Math.atan2(d.x, -d.z) / D2R + 360) % 360;
      const score = Math.abs(el - 55) + Math.abs(paz - 140) * 0.5;
      if (score < best) { best = score; this.nebraSky = [az, -34]; }
    }
    sf.update(...this.nebraSky, 0);
    // put the highlights on the catalog's own stars
    const sprites = this.pleiades.children.filter((o) => o.isSprite && o !== this.pleiadesLabel);
    sprites.forEach((sp, k) => { if (k < ids.length) sf.dirOf(ids[k], sp.position).multiplyScalar(800); else sp.visible = false; });
    sf.dirOf(ids[0], this.pleiadesDir);
    this.pleiadesRing.position.copy(this.pleiadesDir).multiplyScalar(790); this.pleiadesRing.lookAt(0, 0, 0);
    const el = Math.asin(this.pleiadesDir.y) / D2R, az = Math.atan2(this.pleiadesDir.x, -this.pleiadesDir.z) / D2R;
    dirFromAzEl(az, el - 4.2, this.pleiadesLabel.position).multiplyScalar(780);
  }

  dispose() {
    this.G.scene.remove(this.root);
    for (const r of this.rays) r.parent?.remove(r);
    this.root.traverse((o) => { o.geometry?.dispose(); });
    this.G.world.blockers = [];
  }
}

// The Nebra hilltop: a rounded bare summit with woods falling away on every side
function nebraHeight(x, z) {
  const r = Math.hypot(x, z);
  return -Math.pow(Math.max(0, r - 4) / 30, 1.5) * 6 - smooth(60, 400, r) * 20 + (N1(x / 30, z / 30) - 0.5) * 1.5 * smooth(5, 25, r);
}
