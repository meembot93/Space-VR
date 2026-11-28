// Era 3, Chapter 6 (n 20): Losses and the giant, 1966-67.
//
// 1. Korolev's office, January 1966, a winter evening: his coat still on the stand, the N1 drawings
//    still on the desk, Pravda with his photo in a black frame. The Chief Designer is gone.
// 2. A barge on the canal at the Cape: a Saturn V first stage lying on its side, sliding past;
//    von Braun watches from the quay, the Vehicle Assembly Building far off in the haze.
// 3. Launch Complex 34 at dusk: the empty concrete stand, the plaque ("Ad astra per aspera"), three
//    little lights that come on one by one for Grissom, White and Chaffee. The flag at half-staff.
// 4. (Adults) The clean room: a new Apollo capsule with the new hatch. You open it: outward, in seconds.
// 5. The Kremlin wall at night: flowers and a portrait for Vladimir Komarov.
// 6. Dawn at the Vehicle Assembly Building. A flashback to Rice Stadium ("a giant rocket more than
//    three hundred feet tall"), then the huge doors rise, and there it stands: the Saturn V on its
//    launch tower, on the crawler (music, the wow). It creeps out toward you, slower than walking.
// 7. Apollo 4 from the press site, 5.5 km away: the light first, the sound sixteen seconds later.
//    Walter Cronkite holds the window: "Our building's shaking!"
// 8. Baikonur, the assembly hall: the N1 lying on its cradle, its thirty engines facing you. The
//    hall's lights go out row by row.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, yawTo, bearing, tvSet } from '../era3/base.js';
import { person, makeFolk, sit } from '../era3/folk.js';
import { loadAll, copy, Rocket } from '../era3/craft.js';
import { Puffs, envMap, clank } from '../era3/fx.js';
import { groundPlane, sea } from '../era3/worlds.js';
import { room, surfMat, quad, desk, chair, table, shelf, deskLamp, picture, wall, floodTower, lattice } from '../era3/sets.js';
import { riceStadium } from '../era3/places.js';
import { SATURN, saturnRocket, saturnStack, PAD_Y } from '../era3/saturn.js';
import { glowSprite, rumble } from '../wow/fx.js';
import { canvasTex, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';

const M = await loadAll([...SATURN, 'craft/launch_tower', 'craft/crawler', 'craft/n1', 'craft/r7_vostok']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const DECK_Y = 6.1;                 // the crawler's deck, where the launch tower's platform sits
const VAB_Z = -110;                 // the Vehicle Assembly Building's south face (the big doors)
const CRAWL_Z0 = -128;              // the crawler's centre when the doors open (the rocket just inside)
const PAD39 = V(0, 14, -1500);      // Apollo 4 on Pad 39A, seen from the press site (the pad is a raised mound)
const N1_AT = V(45, 10.4, 0);       // the N1's engines end, lying in the hall

export default class Saturn extends Chapter3 {
  constructor(G) {
    super(G, 20);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { lit: 0, hatch: 0, doors: 0, roll: 0, shaking: 0, dark: 0 });
    this.buildOffice(); this.buildBarge(); this.buildPad34(); this.buildClean(); this.buildKremlin();
    riceStadium(this, 'stadium'); this.buildVAB(); this.buildPress(); this.buildN1();
  }
  dim(sun, hemi) { this.G.sky.sunLight.intensity *= sun; this.G.sky.hemi.intensity *= hemi; }

  // ---------- 1. Korolev's office, January 1966 ----------
  buildOffice() {
    const R = room(7, 6, 3.2, { floor: surfMat('parquet'), wall: { n: surfMat('panelwood', '#6a4a2a'), s: surfMat('wallpaper', '#c8c0a0'), e: surfMat('wallpaper', '#c8c0a0'), w: surfMat('wallpaper', '#c8c0a0') }, ceil: surfMat('plaster', '#ece8dc'), windows: [{ side: 'e', at: 0.2, y: 0.9, w: 1.6, h: 1.8 }], skirt: 0x3a2a1a });
    const g = R.group, k = new Kit();
    desk(k, 0, -1.7, 0, { w: 1.9, d: 0.9 }); table(k, 0, 0.3, 0, { w: 0.8, d: 2.0, cloth: 0x3a5a3a });
    for (const sz of [-0.5, 0.5]) for (const sx of [-0.6, 0.6]) chair(k, sx, 0.3 + sz, sx > 0 ? -Math.PI / 2 : Math.PI / 2, { seat: 0x3a3a3a });
    chair(k, 0.35, -2.55, 0.5, { seat: 0x3a2a1e });                         // his chair, pushed back from the desk, empty
    shelf(k, -3.2, -1.2, Math.PI / 2, { w: 1.8, h: 2.1 }); shelf(k, -3.2, 1.2, Math.PI / 2, { w: 1.8, h: 2.1, seed: 5 });
    for (let i = 0; i < 3; i++) { k.box(0.24, 0.1, 0.2, [0x1a1a1a, 0xe8e4dc, 0x8a2a20][i], [-0.75 + i * 0.27, 0.81, -1.95]); k.box(0.2, 0.04, 0.05, 0x1a1a1a, [-0.75 + i * 0.27, 0.89, -1.95]); }   // the telephones
    const dl = deskLamp(k, 0.75, 0.76, -1.95, 0.4);
    // the coat stand in the corner: his long winter coat, his fur hat on the top peg, a scarf
    const cx = 2.95, cz = -2.45;
    k.cyl(0.025, 0.03, 1.9, 8, 0x3a2416, [cx, 0.95, cz]); for (const a of [0, Math.PI / 2]) k.box(0.6, 0.04, 0.05, 0x3a2416, [cx, 0.03, cz], [0, a + 0.4, 0]);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; k.cyl(0.012, 0.012, 0.16, 5, 0x3a2416, [cx + Math.cos(a) * 0.07, 1.82, cz + Math.sin(a) * 0.07], [0, -a, Math.PI / 2 - 0.5]); }
    const coat = 0x34322e, ox = cx - 0.16, oz = cz + 0.1;
    k.cyl(0.15, 0.27, 1.05, 12, coat, [ox, 1.18, oz]); k.box(0.46, 0.09, 0.2, coat, [ox, 1.7, oz], [0, 0.5, 0]);
    for (const s of [-1, 1]) k.cyl(0.05, 0.065, 0.68, 8, coat, [ox + s * 0.19, 1.36, oz + s * 0.1], [0, 0, s * 0.06]);
    k.cyl(0.12, 0.15, 0.1, 10, 0x5a4a3a, [ox, 1.74, oz]);                                         // the fur collar
    for (let i = 0; i < 4; i++) k.ball(0.016, 0, 0x8a7a5a, [ox + 0.11, 1.5 - i * 0.16, oz + 0.2]);   // buttons
    k.cyl(0.12, 0.13, 0.13, 10, 0x4a3e32, [cx, 1.97, cz]); k.ball(0.125, 1, 0x4a3e32, [cx, 2.03, cz], 0, [1, 0.5, 1]);   // the fur hat
    k.box(0.08, 0.7, 0.02, 0x6a2a24, [cx - 0.02, 1.45, cz - 0.12]);                                // a scarf
    // a black-ribboned portrait on the desk corner, two red carnations in a glass
    k.cyl(0.03, 0.03, 0.18, 8, 0xc8d8d8, [-0.3, 0.85, -1.4]); for (let i = 0; i < 2; i++) { k.cyl(0.004, 0.004, 0.26, 3, 0x3a6a2a, [-0.3 + i * 0.02, 0.98, -1.4]); k.ball(0.03, 0, 0xc8202a, [-0.3 + i * 0.03 - 0.01, 1.12 + i * 0.03, -1.4]); }
    g.add(k.mesh(FLAT));
    const por = picture(0.24, 0.3, (c, w, h) => { c.fillStyle = '#9a9488'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a3a3a'; c.beginPath(); c.ellipse(w / 2, h * 0.98, w * 0.46, h * 0.36, 0, 0, 7); c.fill(); c.fillStyle = '#d8ccbc'; c.beginPath(); c.ellipse(w / 2, h * 0.42, w * 0.2, h * 0.2, 0, 0, 7); c.fill(); c.fillStyle = '#4a4440'; c.beginPath(); c.ellipse(w / 2, h * 0.27, w * 0.21, h * 0.08, 0, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.moveTo(w * 0.62, 0); c.lineTo(w, 0); c.lineTo(w, h * 0.3); c.closePath(); c.fill(); }, { frame: 0x1a1a1a });
    por.position.set(-0.6, 0.93, -1.6); por.rotation.set(-0.15, 0.25, 0); g.add(por);
    // his drawings of the N1 on the desk, and the big sheet pinned to the wall
    const n1Sheet = (c, w, h, big) => {
      c.fillStyle = '#f2eee2'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a3050'; c.fillStyle = '#2a3050'; c.lineWidth = big ? 2 : 1.5;
      const cxx = w * 0.32, top = h * 0.08, bot = h * 0.9, bw = w * 0.13;
      c.beginPath(); c.moveTo(cxx - bw, bot); c.lineTo(cxx - bw * 0.42, h * 0.45); c.lineTo(cxx - bw * 0.3, h * 0.28); c.lineTo(cxx - bw * 0.16, h * 0.18); c.lineTo(cxx, top); c.lineTo(cxx + bw * 0.16, h * 0.18); c.lineTo(cxx + bw * 0.3, h * 0.28); c.lineTo(cxx + bw * 0.42, h * 0.45); c.lineTo(cxx + bw, bot); c.closePath(); c.stroke();
      for (const y of [0.45, 0.62, 0.28]) { c.beginPath(); c.moveTo(cxx - bw * (y === 0.28 ? 0.3 : y === 0.45 ? 0.42 : 0.68), h * y); c.lineTo(cxx + bw * (y === 0.28 ? 0.3 : y === 0.45 ? 0.42 : 0.68), h * y); c.stroke(); }
      for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(cxx - bw * 0.8 + i * bw * 0.32, bot + 6, 4, 0, 7); c.stroke(); }
      c.setLineDash([6, 4]); c.beginPath(); c.moveTo(cxx, top - 10); c.lineTo(cxx, bot + 16); c.stroke(); c.setLineDash([]);
      c.font = `bold ${big ? 40 : 28}px serif`; c.fillText('Н1 — Л3', w * 0.55, h * 0.16);
      c.font = `${big ? 20 : 15}px serif`; ['Блок А: 30 двигателей НК-15', 'Блок Б', 'Блок В', 'Л3: ЛОК + ЛК', 'Высота 105 м', 'Масса 2750 т'].forEach((s, i) => c.fillText(s, w * 0.55, h * (0.3 + i * 0.09)));
      c.strokeRect(6, 6, w - 12, h - 12); c.strokeRect(w * 0.55, h * 0.84, w * 0.4, h * 0.1); c.fillText('С. П. Королёв', w * 0.57, h * 0.905);
    };
    const sheet = quad(0.9, 0.62, new THREE.MeshLambertMaterial({ map: canvasTex(512, 352, (c, w, h) => n1Sheet(c, w, h, false)) })); sheet.rotation.set(-Math.PI / 2, 0, 0.08); sheet.position.set(0.05, 0.772, -1.55); g.add(sheet);
    const sheet2 = quad(0.86, 0.6, new THREE.MeshLambertMaterial({ map: canvasTex(512, 352, (c, w, h) => { n1Sheet(c, w, h, false); c.fillStyle = 'rgba(0,0,0,0.05)'; c.fillRect(0, 0, w, h); }) })); sheet2.rotation.set(-Math.PI / 2, 0, -0.2); sheet2.position.set(-0.2, 0.771, -1.75); g.add(sheet2);
    const wallSheet = picture(1.7, 1.15, (c, w, h) => n1Sheet(c, w, h, true), { frame: 0xb8b0a0 }); wallSheet.position.set(0, 1.95, -2.97); g.add(wallSheet); this.n1Sheet = wallSheet;
    // the calendar on the wall: January 1966
    const cal = picture(0.36, 0.5, (c, w, h) => { c.fillStyle = '#f0ece0'; c.fillRect(0, 0, w, h); c.fillStyle = '#a82a20'; c.fillRect(0, 0, w, h * 0.22); c.fillStyle = '#fff'; c.font = 'bold 34px serif'; c.textAlign = 'center'; c.fillText('1966', w / 2, h * 0.16); c.fillStyle = '#2a2a2a'; c.font = 'bold 30px serif'; c.fillText('ЯНВАРЬ', w / 2, h * 0.32); c.font = '20px serif'; for (let d = 1; d <= 31; d++) { const i = d + 4, x = (i % 7) * w / 7 + w / 14, y = h * 0.42 + Math.floor(i / 7) * h * 0.1; c.fillStyle = d === 14 ? '#a82a20' : '#2a2a2a'; c.fillText(String(d), x, y); } }, { frame: 0xe8e4d8 });
    cal.position.set(1.5, 1.85, -2.97); g.add(cal);
    // Pravda on the table, his photo in a black frame: the first time the papers printed his name
    const pr = quad(0.56, 0.4, new THREE.MeshLambertMaterial({ map: canvasTex(448, 320, (c, w, h) => {
      c.fillStyle = '#e8e2d0'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.font = 'bold 54px serif'; c.textAlign = 'center'; c.fillText('ПРАВДА', w / 2, 56); c.fillRect(10, 66, w - 20, 3);
      c.lineWidth = 6; c.strokeRect(w / 2 - 60, 84, 120, 150); c.fillStyle = '#8a8478'; c.fillRect(w / 2 - 56, 88, 112, 142); c.fillStyle = '#4a4640'; c.beginPath(); c.ellipse(w / 2, 150, 32, 38, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(w / 2, 238, 54, 40, 0, 0, 7); c.fill();
      c.fillStyle = '#1a1a1a'; c.font = 'bold 18px serif'; c.fillText('Сергей Павлович КОРОЛЁВ', w / 2, 258); c.font = '13px serif'; c.fillText('1907 — 1966', w / 2, 276);
      c.fillStyle = 'rgba(30,30,30,0.45)'; for (let col = 0; col < 2; col++) for (let y = 90; y < h - 10; y += 9) c.fillRect(col ? w / 2 + 70 : 14, y, w / 2 - 86, 3);
    }) })); pr.rotation.set(-Math.PI / 2, 0, -0.3); pr.position.set(0.05, 0.78, 0.4); g.add(pr); this.pravda = pr;
    // little models: his R-7 and his N1 on the desk
    const r7 = copy(M.r7_vostok, envMap('room'), 0.8); r7.scale.multiplyScalar(0.012); r7.position.set(-0.85, 0.76, -1.5); g.add(r7);
    const n1 = copy(M.n1, envMap('room'), 0.8); n1.scale.multiplyScalar(0.0062); n1.position.set(0.62, 0.77, -1.55); g.add(n1); this.n1Model = n1;
    // outside: a snowy winter evening, snow falling past the window
    const snowView = quad(30, 12, new THREE.MeshBasicMaterial({ fog: false, side: THREE.DoubleSide, map: canvasTex(512, 200, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#4a5670'); gr.addColorStop(0.55, '#8a92a4'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#c8ccd8'; c.fillRect(0, h * 0.55, w, h); c.fillStyle = '#5a5a64'; for (let i = 0; i < 6; i++) c.fillRect(30 + i * 85, h * 0.36, 50, h * 0.2); const r = rng(3); for (let i = 0; i < 40; i++) { c.fillStyle = '#1a2420'; const x = r() * w, s = 10 + r() * 20; c.beginPath(); c.moveTo(x, h * 0.55 - s * 2.4); c.lineTo(x - s / 2, h * 0.58); c.lineTo(x + s / 2, h * 0.58); c.fill(); } for (let i = 0; i < 7; i++) { c.fillStyle = '#f8d890'; c.fillRect(40 + i * 66 + r() * 20, h * 0.5 + r() * 8, 4, 4); } }) }));
    snowView.position.set(9, 2, 0.2); snowView.rotation.y = -Math.PI / 2; g.add(snowView);
    const NS = 260, sp = new Float32Array(NS * 3), r = rng(17);
    for (let i = 0; i < NS; i++) sp.set([3.7 + r() * 5, r() * 4, -2.5 + r() * 5.4], i * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xf4f8ff, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false })); g.add(this.snow);
    this.addScene('office', { group: g, bounds: 1.0, indoors: true, place: { lat: 55.9, year: 1966, sunLon: 295 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(235, -8); this.dim(0.3, 0.6); this.lamp.position.copy(dl); this.lamp.intensity = 1.8; this.lamp.distance = 6; this.lamp2.position.set(0, 3, 0.8); this.lamp2.intensity = 0.5; this.lamp2.distance = 8; },
      update: (dt, t) => { const p = this.snow.geometry.attributes.position; for (let i = 0; i < NS; i++) { let y = p.getY(i) - dt * 0.5; if (y < 0) y += 4; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.05); } p.needsUpdate = true; } });
  }

  // ---------- 2. The barge with the first stage ----------
  buildBarge() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(51);
    g.add(groundPlane({ size: 5000, seg: 150, h: (x, z) => (x < 4.8 ? 0 : x < 58 ? -3.5 : 0.3 + (N(x / 40, z / 40) - 0.5) * 0.5), color: (x, z, c) => { const m = N(x / 6, z / 6); if (x < 4.8) c.setRGB(0.6 + m * 0.06, 0.59 + m * 0.06, 0.55 + m * 0.05); else if (x < 58) c.setRGB(0.2, 0.22, 0.18); else c.setRGB(0.42 + m * 0.12, 0.44 + m * 0.1, 0.28); } }));
    const S = sea({ size: 6000, col: 0x2a4a48, sky: 0xa8c0d0, sun: V(0.7, 0.35, 0.2) }); S.position.y = -0.8; g.add(S); this.bSea = S;
    // the quay: a concrete edge with bollards; a crane and a shed down the way
    k.box(1.2, 1.6, 300, 0x8a8a84, [4.2, -0.8, 0]); for (let z = -140; z <= 140; z += 12) { k.cyl(0.18, 0.22, 0.5, 8, 0x2a2a2a, [4.3, 0.25, z]); k.cyl(0.26, 0.26, 0.06, 8, 0x2a2a2a, [4.3, 0.52, z]); }
    k.box(10, 6, 24, 0xb8b4a8, [-12, 3, -34]); k.box(10.4, 0.4, 24.4, 0x6a5a4a, [-12, 6.2, -34], [0, 0, 0.12]);
    lattice(k, 0.5, -60, 2.4, 2.4, 22, { col: 0xd0a030, step: 2.4 }); k.box(26, 1.2, 1.2, 0xd0a030, [8, 22.6, -60]);
    for (let i = 0; i < 8; i++) k.cyl(0.06, 0.06, 1.1, 6, 0xd8c020, [3.5, 0.55, -18 + i * 4.5]);   // the quay's railings
    for (let i = 0; i < 7; i++) k.box(0.06, 0.06, 4.5, 0xd8c020, [3.5, 1.05, -15.75 + i * 4.5]);
    // far off: the Vehicle Assembly Building in the haze, and the low Launch Control Center
    k.box(218, 160, 158, 0xd4d4ce, [300, 80, -900]); k.box(90, 22, 50, 0xc8c8c0, [180, 11, -760]);
    for (let i = 0; i < 20; i++) k.box(0.8, 150, 0.4, 0xb8b8b2, [194 + i * 11, 80, -820.8]);
    g.add(k.mesh(FLAT));
    // the barge (Poseidon), the stage lying on its cradles, and the tug pushing from behind
    const B = new THREE.Group(); g.add(B); this.barge = B;
    const bk = new Kit();
    bk.box(16, 3, 74, 0x3a4652, [0, -1.0, 0]); bk.box(16.2, 0.25, 74.2, 0x8a3a2a, [0, -2.2, 0]);
    for (const s of [-1, 1]) bk.box(0.3, 0.7, 72, 0x4a5662, [s * 7.85, 0.85, 0]);
    for (const z of [-14, 2, 18]) { bk.box(12, 2.2, 2.2, 0x6a6e72, [0, 1.6, z]); bk.box(12.6, 0.5, 2.6, 0x2a2a2a, [0, 2.6, z]); }   // the cradles
    // the tug
    bk.box(10, 3, 14, 0x2a3a5a, [0, -0.9, 45]); bk.box(6, 3.2, 6, 0xe8e4d8, [0, 2.1, 46]); bk.box(6.4, 0.3, 6.4, 0x2a3a5a, [0, 3.8, 46]); bk.box(4.6, 0.9, 0.1, 0x2a3a4a, [0, 2.8, 42.96]);
    bk.cyl(0.5, 0.6, 3, 10, 0xe8e4d8, [0, 5, 49]); bk.cyl(0.52, 0.52, 0.8, 10, 0x1a1a1a, [0, 6.6, 49]); bk.box(9.6, 0.5, 1.4, 0x1a1a1a, [0, 0.4, 38.2]);
    B.add(bk.mesh(FLAT));
    const name = quad(14, 1.6, new THREE.MeshLambertMaterial({ transparent: true, map: canvasTex(560, 64, (c, w, h) => { c.fillStyle = '#f0ece0'; c.font = 'bold 50px sans-serif'; c.textAlign = 'center'; c.fillText('POSEIDON      NASA', w / 2, 50); }) })); name.rotation.y = -Math.PI / 2; name.position.set(-8.02, -0.6, -4); B.add(name);
    const st = copy(M.saturn_s1c, envMap('day'), 0.9); st.rotation.x = -Math.PI / 2; st.position.set(0, 2.8 + 6.95, 24); B.add(st);
    this.stack1 = st;
    this.tugPuffs = new Puffs(120); g.add(this.tugPuffs.mesh);
    // von Braun on the quay with two of his engineers
    this.vbB = person(g, 'von_braun', V(1.6, 0, -2.2), Math.PI / 2 + 0.3);
    this.engs = [makeFolk({ kind: 'shirt', coat: 0xeeeee8, hat: 'hardhat', seed: 701 }), makeFolk({ kind: 'shirt', coat: 0xd8e0e8, tie: 0x5a2a2a, glasses: true, seed: 702 })];
    this.engs[0].g.position.set(2.8, 0, -4.4); this.engs[0].g.rotation.y = Math.PI / 2 + 0.4; this.engs[1].g.position.set(2.2, 0, 1.6); this.engs[1].g.rotation.y = Math.PI / 2 - 0.2;
    for (const P of this.engs) g.add(P.g);
    this.people.push(this.vbB, ...this.engs);
    this.addScene('barge', { group: g, bounds: 1.2, place: { lat: 28.6, year: 1966, sunLon: 60 }, amb: 0.35, fogFar: 2600, mist: 0.08,
      sky: () => { this.G.sky.set(95, 18); this.key.position.set(200, 120, 40); this.key.target.position.set(20, 0, 0); this.key.intensity = 0.8; },
      update: (dt, t) => {
        this.bSea.userData.update?.(t);
        this.bargeZ = (this.bargeZ ?? 46) - dt * 2.2 * this.F; B.position.set(22, 0, Math.max(-60, this.bargeZ));
        for (const P of [this.vbB, ...this.engs]) P.look = B.position.clone().add(V(0, 6, 8));
        if ((this.tugT = (this.tugT || 0) - dt) < 0) { this.tugT = 0.3; this.tugPuffs.emit(22, 7, B.position.z + 49, 0.3, 1.4, 0.6, 0.6, 3.5, 4, 0x6a6a6a, 0.35, 0.4); }
        this.tugPuffs.update(this.G, dt, [0.6, 0.4]);
      } });
  }

  // ---------- 3. Launch Complex 34 at dusk ----------
  buildPad34() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(34);
    g.add(groundPlane({ size: 4000, seg: 140, h: (x, z) => (x > 420 ? -2 : (N(x / 50, z / 50) - 0.5) * 0.5 * clamp01((Math.hypot(x, z + 20) - 34) / 40)), color: (x, z, c) => { const m = N(x / 5, z / 5); if (x > 380) c.setRGB(0.7, 0.64, 0.5); else c.setRGB(0.38 + m * 0.1, 0.4 + m * 0.08, 0.26); } }));
    const S = sea({ size: 8000, col: 0x22384a, sky: 0x6a6a8a, sun: V(-0.8, 0.05, 0.3) }); S.position.set(4400, -1.2, 0); g.add(S); this.p34Sea = S;
    // the concrete apron and the launch stand: four thick legs, the deck with the round hole where
    // the rocket stood, the flame deflector beneath; rusted stubs where the tower was
    k.box(70, 0.25, 64, 0x9a968c, [0, 0.12, -24]);
    const C = -22, conc = 0xa09a8e;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(3.4, 7.2, 3.4, conc, [sx * 4.6, 3.6, C + sz * 4.6]);
    k.box(13.2, 2.4, 13.2, conc, [0, 8.4, C]); k.cyl(2.9, 2.9, 0.06, 24, 0x1a1a1a, [0, 9.62, C]); k.box(13.4, 0.2, 0.3, 0x8a6a4a, [0, 7.3, C + 6.6]);
    k.box(6, 3.4, 9, 0x6a5a4a, [0, 1.7, C], [0, 0, 0]); k.box(6.1, 0.4, 9.6, 0x5a4a3a, [0, 3.5, C], [0.5, 0, 0]);
    for (const [x, z, h] of [[-18, -32, 4.5], [-18, -40, 3], [-24, -32, 5.5], [-24, -40, 2.5], [14, -36, 2]]) { k.box(0.5, h, 0.5, 0x6a3a22, [x, h / 2, z]); k.box(0.9, 0.12, 0.9, 0x5a3220, [x, h, z]); }
    k.box(4, 1.2, 0.4, 0x8a8478, [-20, 0.6, -36]);
    // the memorial: a granite block with the plaque, three little lights, a wreath, the flag
    k.box(2.5, 1.5, 0.35, 0x4a4844, [0, 0.75, -7.25], [-0.08, 0, 0]); k.box(2.7, 0.12, 0.6, 0x5a5854, [0, 0.06, -7.2]);
    for (let i = 0; i < 3; i++) { const x = -0.55 + i * 0.55; k.cyl(0.07, 0.09, 0.22, 8, 0x3a3a3a, [x, 0.11, -6.5]); k.box(0.12, 0.14, 0.12, 0xe8e0c8, [x, 0.29, -6.5]); }
    k.add(new THREE.TorusGeometry(0.42, 0.11, 6, 16), 0x2a4a2a, [1.9, 0.75, -6.8], [0, -0.3, 0]); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.ball(0.06, 0, i % 3 ? 0xe8e8e0 : 0xb02030, [1.9 + Math.cos(a) * 0.42 * Math.cos(0.3), 0.75 + Math.sin(a) * 0.42, -6.8 + Math.cos(a) * 0.42 * Math.sin(0.3) + 0.08]); }
    for (const s of [-1, 1]) k.cyl(0.02, 0.02, 1.3, 4, 0x3a3a3a, [1.9 + s * 0.3, 0.6, -6.85], [0, 0, s * 0.3]);
    k.cyl(0.05, 0.06, 9, 8, 0xd8d8d0, [3.4, 4.5, -9]); k.ball(0.1, 0, 0xc8a040, [3.4, 9.05, -9]);
    g.add(k.mesh(FLAT));
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 8, 4), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, map: canvasTex(152, 80, (c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f0ece4' : '#b02030'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#2a3a6a'; c.fillRect(0, 0, w * 0.4, h * 7 / 13); c.fillStyle = '#fff'; for (let i = 0; i < 30; i++) c.fillRect(4 + (i % 6) * 10, 3 + Math.floor(i / 6) * 8, 2, 2); }) }));
    flag.position.set(4.32, 5.6, -9); g.add(flag); this.p34flag = flag;
    const plaque = quad(2.2, 0.91, new THREE.MeshLambertMaterial({ emissive: 0xffffff, emissiveIntensity: 0.12, map: canvasTex(600, 248, (c, w, h) => {
      c.fillStyle = '#4a3a22'; c.fillRect(0, 0, w, h); const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#c8a858'); gr.addColorStop(1, '#a08040'); c.fillStyle = gr; c.fillRect(8, 8, w - 16, h - 16);
      c.fillStyle = '#3a2a14'; c.textAlign = 'center'; c.font = 'bold 24px Georgia, serif'; c.fillText('LAUNCH COMPLEX 34', w / 2, 40); c.font = '17px Georgia, serif'; c.fillText('Friday, 27 January 1967, 1831 hours', w / 2, 66);
      c.font = 'bold 21px Georgia, serif'; c.fillText('VIRGIL I. GRISSOM  ·  EDWARD H. WHITE II  ·  ROGER B. CHAFFEE', w / 2, 102);
      c.font = 'italic 15px Georgia, serif'; c.fillText('They gave their lives in service to their country in the ongoing exploration', w / 2, 134); c.fillText('of humankind\'s final frontier. Remember them not for how they died', w / 2, 154); c.fillText('but for those ideals for which they lived.', w / 2, 174);
      c.font = 'bold 26px Georgia, serif'; c.fillText('AD ASTRA PER ASPERA', w / 2, 214); c.font = '13px Georgia, serif'; c.fillText('(a rough road leads to the stars)', w / 2, 234);
    }) })); plaque.rotation.set(-0.08, 0, 0); plaque.position.set(0, 0.84, -7.0); plaque.material.emissiveMap = plaque.material.map; g.add(plaque);
    this.lights34 = [0, 1, 2].map((i) => { const f = glowSprite(0xffc070, 0.32, 0); f.position.set(-0.55 + i * 0.55, 0.42, -6.5); g.add(f); return f; });
    this.addScene('pad34', { group: g, bounds: 1.2, place: { lat: 28.5, year: 1967, sunLon: 307 }, amb: 0.35, fogFar: 3000, mist: 0.04,
      sky: () => { this.G.sky.set(250, -5); this.key.position.set(-200, 30, 60); this.key.target.position.set(0, 0, -20); this.key.intensity = 0.25; this.lamp.position.set(0, 0.7, -6.0); this.lamp.distance = 6; this.lamp.intensity = 0.5 * this.lit34; },
      update: (dt, t) => {
        this.p34Sea.userData.update?.(t);
        this.lit34 = 0;
        this.lights34.forEach((f, i) => { const on = this.s.lit > i ? 1 : 0; f.material.opacity = damp(f.material.opacity, on * (0.85 + 0.15 * Math.sin(t * 9 + i * 2)), 2, dt); this.lit34 += f.material.opacity; });
        const pa = this.p34flag.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i) + 0.9; pa.setZ(i, Math.sin(x * 3 - t * 2.4) * 0.07 * x); } pa.needsUpdate = true;
      } });
  }

  // ---------- 4. (Adults) The clean room: the new hatch ----------
  buildClean() {
    const R = room(14, 12, 9, { floor: surfMat('tiles', '#e4e6e2'), wall: surfMat('tiles', '#eef0ec'), ceil: surfMat('acoustic', '#f0f0ec'), skirt: 0x8a9a9a });
    const g = R.group; g.remove(g.children[0]);     // the floor: our own, with the well the service module stands in
    const k = new Kit(), H = 2.25, cz = -0.5;
    const floorM = surfMat('tiles', '#dcdedc');
    for (const [w, d, x, z] of [[14, 6 - H - cz, 0, (H + cz + 6) / 2 + 0], [14, 6 - H + cz, 0, -(6 + H - cz) / 2], [7 - H, 2 * H, -(7 + H) / 2, cz], [7 - H, 2 * H, (7 + H) / 2, cz]]) { const f = quad(w, d, floorM, 1.5); f.rotation.x = -Math.PI / 2; f.position.set(x, 0, z); g.add(f); }
    for (const [x, z, w, d] of [[0, cz - H, 2 * H + 0.2, 0.12], [0, cz + H, 2 * H + 0.2, 0.12], [-H, cz, 0.12, 2 * H], [H, cz, 0.12, 2 * H]]) { k.box(w, 0.02, d, 0xe8c020, [x, 0.01, z]); k.box(w, 1.0, d * 0.5 + 0.02, 0xd8dcd8, [x, -0.5, z]); }
    for (const [x, z] of [[-H, cz - H], [H, cz - H], [-H, cz + H], [H, cz + H]]) { k.cyl(0.025, 0.025, 1.05, 6, 0xe8c020, [x, 0.52, z]); }
    for (const [a, b] of [[[-H, cz - H], [H, cz - H]], [[-H, cz - H], [-H, cz + H]], [[H, cz - H], [H, cz + H]]]) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]); k.box(Math.abs(b[0] - a[0]) || 0.04, 0.04, Math.abs(b[1] - a[1]) || 0.04, 0xe8c020, [(a[0] + b[0]) / 2, 1.05, (a[1] + b[1]) / 2]); void L; }
    k.box(14, 0.2, 12, 0x6a6a68, [0, -11.5, 0]);                          // the bottom of the well, far below
    // the work stands, a tool cart, the overhead crane
    for (const sx of [-1, 1]) { k.box(1.2, 2.4, 3, 0xc8ccc8, [sx * 5.4, 1.2, -3]); k.box(1.4, 0.06, 3.2, 0x8a8e8a, [sx * 5.4, 2.42, -3]); }
    k.box(0.9, 0.9, 0.5, 0x3a5a8a, [3.4, 0.45, 2.6]); k.box(0.92, 0.03, 0.52, 0xc8c8c8, [3.4, 0.91, 2.6]);
    k.box(14, 0.5, 0.5, 0xd8b020, [0, 8.2, -2]); k.box(1.2, 0.8, 1.2, 0x3a3a3a, [0.8, 7.7, -2]); k.cyl(0.02, 0.02, 3, 4, 0x2a2a2a, [0.8, 5.8, -2]);
    for (let i = 0; i < 4; i++) k.box(2.4, 0.06, 0.4, 0xffffff, [-4.5 + i * 3, 8.95, 2]);
    g.add(k.mesh(FLAT));
    const banner = quad(5, 0.7, new THREE.MeshLambertMaterial({ map: canvasTex(640, 90, (c, w, h) => { c.fillStyle = '#1a3a6a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0f0e8'; c.font = 'bold 46px sans-serif'; c.textAlign = 'center'; c.fillText('APOLLO  ·  BLOCK II', w / 2, 62); }) })); banner.position.set(0, 6.6, -5.98); g.add(banner);
    // the capsule (its service module down in the well) and the new hatch, facing you
    const csm = copy(M.apollo_csm, envMap('room'), 0.9); csm.position.set(0, 0.02, cz); g.add(csm);
    const tilt = 32.5 * Math.PI / 180, hy = 1.15, hr = 1.96 - Math.tan(tilt) * hy;
    const Hg = new THREE.Group(); Hg.position.set(0, 0.02 + hy, cz + hr + 0.02); Hg.rotation.x = -tilt; g.add(Hg);
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.8), new THREE.MeshBasicMaterial({ map: canvasTex(144, 160, (c, w, h) => { c.fillStyle = '#1a1c1e'; c.fillRect(0, 0, w, h); c.fillStyle = '#5a5e5a'; c.fillRect(10, h * 0.55, w - 20, 14); c.fillRect(20, h * 0.68, w - 40, 30); c.fillStyle = '#3a3e42'; c.fillRect(0, 0, w, h * 0.3); for (let i = 0; i < 18; i++) { c.fillStyle = ['#e8e0c0', '#80ff80', '#ffb040'][i % 3]; c.fillRect(8 + (i % 9) * 15, 10 + Math.floor(i / 9) * 14, 5, 4); } }) }));
    inside.position.z = 0.005; Hg.add(inside);
    const fk = new Kit(); fk.box(0.82, 0.05, 0.05, 0x8a8e92, [0, 0.42, 0.02]); fk.box(0.82, 0.05, 0.05, 0x8a8e92, [0, -0.42, 0.02]); for (const s of [-1, 1]) fk.box(0.05, 0.88, 0.05, 0x8a8e92, [s * 0.39, 0, 0.02]); Hg.add(fk.mesh(FLAT));
    this.hinge = new THREE.Group(); this.hinge.position.set(-0.37, 0, 0.05); Hg.add(this.hinge);
    const pk = new Kit(); pk.box(0.74, 0.82, 0.06, 0xc8ccd0, [0.37, 0, 0]); pk.box(0.1, 0.05, 0.05, 0x2a2a2a, [0.62, 0, 0.05]); pk.box(0.04, 0.04, 0.12, 0x3a3a3a, [0.62, 0, 0.03]); pk.cyl(0.07, 0.07, 0.02, 12, 0x1a2a3a, [0.37, 0.18, 0.035], [Math.PI / 2, 0, 0]);
    for (const y of [-0.3, 0.3]) pk.box(0.08, 0.1, 0.06, 0x8a8a8a, [0.02, y, 0.02]);
    const panel = pk.mesh(FLAT); this.hinge.add(panel);
    this.handle = new THREE.Object3D(); this.handle.position.set(0.62, 0, 0.08); this.hinge.add(this.handle);
    this.hatchIt = this.touchable('hatch', () => this.handle.getWorldPosition(new THREE.Vector3()), { hint: 'Open the new hatch: touch its black handle (TRIGGER)', deskHint: 'Click the black handle on the capsule\'s hatch', r: 0.15 });
    // two technicians in white
    this.techs = [makeFolk({ kind: 'coverall', coat: 0xf2f2f0, hat: 'cap', seed: 721 }), makeFolk({ kind: 'coverall', coat: 0xf2f2f0, hat: 'cap', glasses: true, seed: 722 })];
    this.techs[0].g.position.set(-3.2, 0, -0.9); this.techs[0].g.rotation.y = Math.PI / 2; this.techs[0].pose = 'work';
    this.techs[1].g.position.set(2.9, 0, 0.9); this.techs[1].g.rotation.y = -Math.PI / 2 - 0.3; this.techs[1].pose = 'hold';
    for (const P of this.techs) { g.add(P.g); P.look = V(0, 1.6, cz); }
    this.people.push(...this.techs);
    this.addScene('clean', { group: g, bounds: 0.8, place: { lat: 28.5, year: 1968, sunLon: 0 }, amb: 0.05, fogFar: 300,
      sky: () => { this.G.sky.set(180, 40); this.dim(0.1, 1.2); this.lamp.position.set(0, 7.5, 2); this.lamp.intensity = 4; this.lamp.distance = 20; this.lamp2.position.set(0, 4, 4); this.lamp2.intensity = 1.5; this.lamp2.distance = 10; },
      update: (dt) => { this.hinge.rotation.y = damp(this.hinge.rotation.y, this.s.hatch ? -1.65 : 0, this.s.hatch ? 1.3 : 6, dt); } });
  }

  // ---------- 5. The Kremlin wall, April 1967: Komarov ----------
  buildKremlin() {
    const g = new THREE.Group(), k = new Kit();
    const sq = quad(260, 160, surfMat('brick', '#4a4a4e'), 3); sq.rotation.x = -Math.PI / 2; sq.position.z = 40; g.add(sq);
    const W = wall([-70, -9], [70, -9], 11, { kind: 'brick', col: '#8a3a2a', t: 3 }); W.material = W.material.clone(); W.material.color.setHex(0xc86a58); g.add(W);
    for (let x = -69; x <= 69; x += 2.6) { k.box(1.5, 1.6, 0.9, 0x8a3428, [x, 11.8, -8.2]); for (const s of [-1, 1]) k.box(0.5, 0.8, 0.9, 0x8a3428, [x + s * 0.5, 13.0, -8.2], [0, 0, -s * 0.3]); }
    // the tower down the wall, with its glowing red star
    const tx = -46;
    k.box(13, 34, 13, 0x8a3428, [tx, 17, -12]); k.box(10, 10, 10, 0x8a3428, [tx, 39, -12]); k.box(8, 7, 8, 0xd8d0c0, [tx, 47.5, -12]); k.box(8.2, 1.5, 8.2, 0x2a2a2a, [tx, 47.5, -7.9 - 0.01]);
    k.cyl(0.1, 4.6, 16, 8, 0x2a5a3a, [tx, 59, -12]); k.ball(4.2, 0, 0x8a8a7a, [tx, 46, -5.8], 0, [0.6, 0.6, 0.05]);
    g.add(k.mesh(FLAT));
    const star = glowSprite(0xff3020, 5, 0.9); star.position.set(tx, 68.5, -12); g.add(star);
    const star2 = glowSprite(0xff8060, 2, 1); star2.position.copy(star.position); g.add(star2);
    // the plaque in the wall, the heaped flowers and wreaths, his portrait on an easel
    const pl = quad(0.7, 0.52, new THREE.MeshLambertMaterial({ map: canvasTex(280, 208, (c, w, h) => { c.fillStyle = '#141414'; c.fillRect(0, 0, w, h); c.fillStyle = '#d8b860'; c.textAlign = 'center'; c.font = 'bold 26px serif'; c.fillText('КОМАРОВ', w / 2, 70); c.font = '19px serif'; c.fillText('ВЛАДИМИР МИХАЙЛОВИЧ', w / 2, 104); c.font = '20px serif'; c.fillText('1927 — 1967', w / 2, 150); }) }));
    pl.position.set(0, 2.1, -7.48); g.add(pl);
    const fk = new Kit(), r = rng(66);
    for (let i = 0; i < 120; i++) { const x = (r() - 0.5) * 3.2, z = -7.3 + r() * 1.1 * (1 - Math.abs(x) / 2.2); fk.ball(0.05 + r() * 0.03, 0, [0xc01828, 0xd82838, 0xf0f0e8, 0xe04050, 0xa01020][Math.floor(r() * 5)], [x, 0.05 + r() * 0.3 * (1 - Math.abs(x) / 1.8), z]); }
    for (let i = 0; i < 40; i++) fk.cyl(0.006, 0.006, 0.3, 3, 0x3a6a2a, [(r() - 0.5) * 3, 0.12, -7.2 + r() * 0.9], [r() - 0.5, 0, r() - 0.5]);
    for (const [x, rot] of [[-1.2, 0.2], [1.3, -0.2]]) { fk.add(new THREE.TorusGeometry(0.5, 0.13, 6, 18), 0x2a4a2a, [x, 0.75, -7.2], [-0.1, rot, 0]); fk.box(0.08, 0.7, 0.01, 0xa01828, [x + 0.15, 0.4, -7.05], [0, rot, 0.2]); fk.box(0.08, 0.7, 0.01, 0x1a1a1a, [x + 0.25, 0.42, -7.05], [0, rot, 0.25]); }
    for (const s of [-1, 1]) fk.cyl(0.02, 0.02, 1.7, 4, 0x4a3420, [-2.4 + s * 0.25, 0.8, -6.6], [-0.15, 0, s * 0.12]); fk.cyl(0.02, 0.02, 1.6, 4, 0x4a3420, [-2.4, 0.8, -6.3], [0.3, 0, 0]); fk.box(0.7, 0.04, 0.08, 0x4a3420, [-2.4, 0.86, -6.5]);
    g.add(fk.mesh(FLAT));
    const por = picture(0.55, 0.72, (c, w, h) => { c.fillStyle = '#a09a90'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a3a2a'; c.beginPath(); c.ellipse(w / 2, h * 1.0, w * 0.48, h * 0.38, 0, 0, 7); c.fill(); for (let i = 0; i < 6; i++) { c.fillStyle = '#c8a040'; c.fillRect(w * 0.28 + (i % 3) * 8, h * 0.78 + Math.floor(i / 3) * 8, 5, 5); } c.fillStyle = '#d8c8b4'; c.beginPath(); c.ellipse(w / 2, h * 0.44, w * 0.19, h * 0.17, 0, 0, 7); c.fill(); c.fillStyle = '#5a4a3a'; c.beginPath(); c.ellipse(w / 2, h * 0.3, w * 0.2, h * 0.07, 0, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.moveTo(w * 0.6, 0); c.lineTo(w, 0); c.lineTo(w, h * 0.3); c.closePath(); c.fill(); }, { frame: 0x1a1a1a });
    por.position.set(-2.4, 1.25, -6.48); por.rotation.x = -0.15; g.add(por);
    // people who came with flowers, standing quietly
    this.mourners = [];
    for (const [x, z, o, pose] of [[-1.6, -4.4, { kind: 'greatcoat', hat: 'peaked', coat: 0x3a4a3a, seed: 741 }, 'idle'], [-0.6, -4.0, { kind: 'dress', hat: 'kerchief', coat: 0x4a3a4a, seed: 742 }, 'hold'], [0.8, -4.6, { kind: 'jacket', hat: 'ushanka', coat: 0x2a2a2e, seed: 743 }, 'idle'], [1.9, -3.9, { kind: 'greatcoat', hat: 'fedora', coat: 0x3a3634, seed: 744 }, 'idle'], [2.9, -4.5, { kind: 'dress', coat: 0x5a4a3a, hat: 'kerchief', seed: 745 }, 'idle']]) {
      const P = makeFolk(o); P.g.position.set(x, 0, z); P.g.rotation.y = Math.PI + (x * -0.06); P.pose = pose; P.look = V(0, 1.4, -8); g.add(P.g); this.mourners.push(P);
    }
    this.people.push(...this.mourners);
    this.addScene('kremlin', { group: g, bounds: 1.2, place: { lat: 55.75, year: 1967, sunLon: 35 }, amb: 0.2, fogFar: 1500,
      sky: () => { this.G.sky.set(320, -22); this.key.position.set(10, 30, 40); this.key.target.position.set(0, 4, -9); this.key.intensity = 0.35; this.key.color.setHex(0xffd8b0); this.lamp.position.set(2.5, 4.5, -3); this.lamp.intensity = 4.0; this.lamp.distance = 16; this.lamp2.position.set(-2.4, 2.2, -5); this.lamp2.intensity = 1.0; this.lamp2.distance = 5; },
      exit: () => { this.key.color.setHex(0xffffff); },
      update: (dt, t) => { star.material.opacity = 0.8 + 0.1 * Math.sin(t * 1.3); } });
  }

  // ---------- 6. The Vehicle Assembly Building at dawn: the Saturn V ----------
  buildVAB() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(39);
    g.add(groundPlane({ size: 5000, seg: 160, h: (x, z) => (Math.abs(x) < 30 && z > -112 ? 0 : (N(x / 60, z / 60) - 0.5) * 0.6 * clamp01((Math.abs(x) - 30) / 20)), color: (x, z, c) => { const m = N(x / 4, z / 4); const ax = Math.abs(x); if (z > -112 && ax > 6 && ax < 20) c.setRGB(0.5 + m * 0.08, 0.47 + m * 0.07, 0.41 + m * 0.06); else if (z > -112 && ax < 30) c.setRGB(0.4 + m * 0.08, 0.44 + m * 0.08, 0.3); else c.setRGB(0.36 + m * 0.1, 0.4 + m * 0.1, 0.26); } }));
    // the building: walls round a dark high bay, the south face with its doorway shaped like an
    // upside-down T (wide at the bottom for the platform, tall and narrow above for the rocket)
    const Z = VAB_Z, D = 158, Wd = 218, H = 160, LW = 28, LH = 26, UW = 14, UH = 148, face = 0xd6d6d0;
    k.box(Wd / 2 - LW, H, 2, face, [-(Wd / 2 + LW) / 2, H / 2, Z - 1]); k.box(Wd / 2 - LW, H, 2, face, [(Wd / 2 + LW) / 2, H / 2, Z - 1]);
    for (const s of [-1, 1]) k.box(LW - UW, H - LH, 2, face, [s * (LW + UW) / 2, LH + (H - LH) / 2, Z - 1]);
    k.box(2 * UW, H - UH, 2, face, [0, UH + (H - UH) / 2, Z - 1]);
    k.box(Wd, H, 2, 0x8a8a86, [0, H / 2, Z - D]); for (const s of [-1, 1]) k.box(2, H, D, face, [s * Wd / 2, H / 2, Z - D / 2]); k.box(Wd, 2, D, 0xc8c8c2, [0, H, Z - D / 2]);
    // the panel seams down the faces, the louvred bands, the door's edge frame
    for (let x = -Wd / 2 + 4; x < Wd / 2; x += 6) if (Math.abs(x) > LW + 1) k.box(0.4, H, 0.3, 0xb8b8b2, [x, H / 2, Z + 0.1]); else if (Math.abs(x) > UW + 1) k.box(0.4, H - LH, 0.3, 0xb8b8b2, [x, LH + (H - LH) / 2, Z + 0.1]);
    for (const y of [40, 80, 120]) for (const s of [-1, 1]) k.box(Wd / 2 - LW - 4, 3, 0.4, 0x9a9a94, [s * (Wd / 2 + LW) / 2, y, Z + 0.2]);
    for (const s of [-1, 1]) { k.box(1, UH - LH, 1, 0x5a5a5a, [s * (UW + 0.5), LH + (UH - LH) / 2, Z + 0.3]); k.box(1, LH, 1, 0x5a5a5a, [s * (LW + 0.5), LH / 2, Z + 0.3]); }
    for (const s of [-1, 1]) k.box(Wd / 2 - 40, 2, 1, 0x8a8a84, [s * (Wd / 4 + 20), 2, Z + 0.6]);
    // inside the high bay: work platforms jutting from the walls, girders, and the bay's lamps
    for (let y = 20; y < 140; y += 18) for (const s of [-1, 1]) { k.box(10, 1.2, 22, 0x6a6a64, [s * 22, y, Z - 22]); k.box(0.3, 1.0, 22, 0xd0a030, [s * 17.1, y + 1, Z - 22]); }
    for (const s of [-1, 1]) k.box(4, H, 4, 0x4a4a48, [s * 30, H / 2, Z - 40]);
    k.box(70, 4, 4, 0x4a4a48, [0, 150, Z - 30]);
    g.add(k.mesh(FLAT));
    const bayLamps = []; for (let y = 24; y < 150; y += 16) for (const s of [-1, 1]) for (const z of [-8, -36]) { const L = glowSprite(0xfff0d0, 3.2, 0.9); L.position.set(s * 26, y, Z + z); g.add(L); bayLamps.push(L); }
    // the doors: big panels that rise one by one behind the face above the doorway
    this.doors = [];
    const dMat = new THREE.MeshLambertMaterial({ color: 0xc8c8c2 }), rib = new THREE.MeshLambertMaterial({ color: 0xa8a8a2 });
    const panel = (w, h) => { const p = new THREE.Group(); p.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), dMat)); for (let x = -w / 2 + 2; x < w / 2; x += 4) { const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, h - 0.4, 0.3), rib); r2.position.set(x, 0, 0.7); p.add(r2); } return p; };
    const nUp = 9, ph = (UH - LH) / nUp;
    for (let i = 0; i < nUp; i++) { const p = panel(2 * UW + 2, ph); const y0 = LH + ph * (i + 0.5); p.position.set(0, y0, Z - 0.4); g.add(p); this.doors.push({ p, y0, y1: UH + ph / 2 - 1 - i * 0.2, z1: Z - 3 - i * 1.3, at: (nUp - 1 - i) / nUp * 0.6 }); }
    for (const s of [-1, 1]) { const p = panel(LW, LH); p.position.set(s * LW / 2, LH / 2, Z - 0.4); g.add(p); this.doors.push({ p, x0: s * LW / 2, x1: s * (LW + 24), z1: Z - 3, at: 0.55, side: true }); }
    // the crawler with the launch tower and the Saturn V
    const CR = new THREE.Group(); g.add(CR); this.crawler = CR;
    CR.add(copy(M.crawler, envMap('dawn'), 0.8));
    const T = copy(M.launch_tower, envMap('dawn'), 0.8); T.position.set(0, DECK_Y, 4.7); T.rotation.y = 0; CR.add(T);
    const SV = saturnStack(M, envMap('dawn'), 1.0); SV.position.set(0, DECK_Y + PAD_Y, 4.7); CR.add(SV);
    CR.position.set(0, 0, CRAWL_Z0);
    this.crPuffs = new Puffs(160); g.add(this.crPuffs.mesh);
    // the people out on the grass at dawn: von Braun and some of his team, a photographer
    this.vbV = person(g, 'von_braun', V(37.2, 0, 58.6), 0);
    this.watchers = [];
    for (const [x, z, o] of [[34.5, 57, { kind: 'shirt', coat: 0xeeeee8, hat: 'hardhat', seed: 761 }], [43, 56.4, { kind: 'jacket', coat: 0x5a5a4a, hat: 'cap', seed: 762 }], [45, 61.5, { kind: 'shirt', coat: 0xd8e0e8, tie: 0x2a2a4a, seed: 763 }], [31, 62, { kind: 'dress', coat: 0x6a7a9a, seed: 764 }]]) { const P = makeFolk(o); P.g.position.set(x, 0, z); g.add(P.g); this.watchers.push(P); }
    this.watchers[1].pose = 'hold';
    this.people.push(this.vbV, ...this.watchers);
    this.addScene('vab', { group: g, bounds: 1.5, place: { lat: 28.6, year: 1967, sunLon: 230 }, amb: 0.3, fogFar: 4000, mist: 0.05,
      sky: () => { this.G.sky.set(108, 4); this.key.position.set(320, 60, 40); this.key.target.position.set(0, 50, VAB_Z); this.key.intensity = 1.1; this.key.color.setHex(0xffd8a8);
        const o = this.doorK || 0; this.lamp2.position.set(0, 120, VAB_Z - 14); this.lamp2.intensity = 1100 * o; this.lamp2.distance = 220; this.lamp2.decay = 1.3; },
      exit: () => { this.key.color.setHex(0xffffff); this.lamp2.decay = 1.4; },
      update: (dt, t) => {
        const s = this.s;
        this.doorK = clamp01((this.doorK || 0) + (s.doors ? dt * this.F / 9 : 0));
        for (const d of this.doors) { const k2 = ease((this.doorK - d.at) / 0.4); if (d.side) d.p.position.set(d.x0 + (d.x1 - d.x0) * k2, LH / 2, VAB_Z - 0.4 + (d.z1 - VAB_Z + 0.4) * Math.min(1, k2 * 4)); else d.p.position.set(0, d.y0 + (d.y1 - d.y0) * k2, VAB_Z - 0.4 + (d.z1 - VAB_Z + 0.4) * Math.min(1, k2 * 5)); }
        for (const L of bayLamps) L.material.opacity = 0.9;
        if (s.roll) { CR.position.z += dt * this.F * 0.9; if ((this.crT = (this.crT || 0) - dt) < 0) { this.crT = 0.25; for (const sx of [-1, 1]) this.crPuffs.emit(sx * 12, 9.5, CR.position.z - 12, 0, 2, 0, 0.8, 4, 5, 0x5a5a5a, 0.3, 0.4); } }
        this.crPuffs.update(this.G, dt, [0.5, 0.2]);
        const look = V(0, 50, CR.position.z); for (const P of [this.vbV, ...this.watchers]) { P.look = look; P.g.rotation.y = Math.atan2(-P.g.position.x, CR.position.z - P.g.position.z); }
      } });
  }

  // ---------- 7. Apollo 4 from the press site ----------
  buildPress() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(44);
    g.add(groundPlane({ size: 9000, seg: 170, h: (x, z) => { const d = Math.hypot(x - PAD39.x, z - PAD39.z); if (d < 120) return PAD39.y * clamp01((150 - d) / 60); if (z < -200 && z > -1250) return -2.5; return (N(x / 80, z / 80) - 0.5) * 0.8 * clamp01((Math.hypot(x, z) - 30) / 60); }, color: (x, z, c) => { const m = N(x / 10, z / 10); const d = Math.hypot(x - PAD39.x, z - PAD39.z); if (d < 120) c.setRGB(0.66, 0.64, 0.58); else if (z < -200 && z > -1250) c.setRGB(0.2, 0.24, 0.2); else c.setRGB(0.4 + m * 0.1, 0.42 + m * 0.1, 0.27); } }));
    const S = sea({ size: 9000, col: 0x3a5a6a, sky: 0xd8b8a0, sun: V(0.9, 0.08, -0.2) }); S.position.y = -0.7; g.add(S); this.prSea = S;
    // the CBS trailer: a small room with a long window toward the pad
    const R = room(6, 4, 2.7, { floor: surfMat('lino', '#7a7268'), wall: { n: surfMat('panelwood', '#8a6a4a'), s: surfMat('panelwood', '#8a6a4a'), e: surfMat('panelwood', '#8a6a4a'), w: surfMat('panelwood', '#8a6a4a') }, ceil: surfMat('acoustic'), windows: [{ side: 'n', at: 0.2, y: 0.95, w: 4.8, h: 1.35 }], doors: [{ side: 'e', at: 1.0, w: 0.9, h: 2.05 }], skirt: 0x2a2018, outside: surfMat('plaster', '#d8d8d0'), thick: 0.14 });
    g.add(R.group); const rk = new Kit();
    rk.box(6.4, 0.3, 4.4, 0xd8d8d0, [0, 2.85, 0]); rk.box(6.4, 0.5, 4.4, 0x6a6a68, [0, -0.25, 0]);
    desk(rk, 0.2, -1.55, Math.PI, { w: 3.2, d: 0.7 });
    rk.cyl(0.012, 0.012, 0.3, 5, 0x2a2a2a, [-0.3, 0.92, -1.5]); rk.ball(0.04, 0, 0x6a6a6a, [-0.3, 1.08, -1.5]); rk.box(0.3, 0.02, 0.22, 0xf0ece0, [0.4, 0.77, -1.4]); rk.box(0.42, 0.14, 0.32, 0x3a3a3a, [1.3, 0.83, -1.45]);
    chair(rk, -0.3, -0.85, 0.3, { seat: 0x2a2a2a }); chair(rk, 1.2, -0.85, -0.2, { seat: 0x2a2a2a });
    g.add(rk.mesh(FLAT));
    const tv = tvSet((c, w, h) => drawSaturn(c, w, h, this.s.tvT || 0), { w: 0.5, legs: false }); tv.g.position.set(-1.8, 0.76, -1.6); tv.g.rotation.y = 0.35; g.add(tv.g); this.prTV = tv;
    const sign = quad(1.1, 0.3, new THREE.MeshLambertMaterial({ map: canvasTex(330, 90, (c, w, h) => { c.fillStyle = '#1a1a1a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0f0e8'; c.font = 'bold 60px sans-serif'; c.textAlign = 'center'; c.fillText('CBS NEWS', w / 2, 66); }) })); sign.position.set(-1.6, 2.35, -1.97); g.add(sign);
    // outside: the bleachers, the press, the countdown clock
    const ok = new Kit();
    for (let i = 0; i < 4; i++) ok.box(14, 0.4 + i * 0.4, 0.8, 0x8a8a84, [-14, 0.2 + i * 0.2, -12 - i * 0.8]);
    ok.box(4, 0.3, 0.3, 0x2a2a2a, [12, 6.2, -26]); for (const s of [-1, 1]) ok.box(0.3, 6, 0.3, 0x2a2a2a, [12 + s * 1.8, 3, -26]); ok.box(7, 2.4, 0.4, 0x1a1a1a, [12, 7.6, -26]);
    g.add(ok.mesh(FLAT));
    const clockTex = canvasTex(420, 140, (c, w, h) => drawClock(c, w, h, 0));
    const clock = quad(6.6, 2.2, new THREE.MeshBasicMaterial({ map: clockTex })); clock.position.set(12, 7.6, -25.78); g.add(clock); this.clockTex = clockTex;
    this.reporters = [];
    for (let i = 0; i < 7; i++) { const P = makeFolk({ kind: i % 3 === 2 ? 'dress' : i % 2 ? 'shirt' : 'suit', hat: i === 1 ? 'fedora' : 'none', coat: [0xe8e8e0, 0x4a4a52, 0x8a6a7a, 0xe0e4e8, 0x5a4a3a, 0x7a8aa0, 0xd8c8a8][i], seed: 780 + i }); P.g.position.set(-19 + i * 1.6, 0.4 + (i % 3) * 0.2, -12.4 - (i % 3) * 0.8); P.g.rotation.y = Math.PI; P.look = V(PAD39.x, 60, PAD39.z); g.add(P.g); this.reporters.push(P); }
    this.people.push(...this.reporters);
    // Cronkite at the window, and his producer beside him
    this.cronkite = person(g, 'cronkite', V(0.5, 0, -1.0), Math.PI); this.cronkite.look = V(PAD39.x, 40, PAD39.z);
    this.producer = makeFolk({ kind: 'shirt', coat: 0xe0e4e8, tie: 0x5a2a2a, glasses: true, seed: 791 }); this.producer.g.position.set(1.55, 0, -1.05); this.producer.g.rotation.y = Math.PI; this.producer.look = V(PAD39.x, 40, PAD39.z); g.add(this.producer.g);
    this.people.push(this.cronkite, this.producer);
    // the pad: the launch tower and the Saturn V, floodlights round it
    const pk = new Kit(); for (const [x, z] of [[-90, -60], [90, -60], [0, 100]]) floodTower(pk, PAD39.x + x, PAD39.z + z, Math.atan2(-x, -z), 30); pk.box(60, 2, 50, 0x8a8a84, [PAD39.x, PAD39.y - 1, PAD39.z]); g.add(pk.mesh(FLAT));
    const tw = copy(M.launch_tower, envMap('dawn'), 0.8); tw.position.copy(PAD39); g.add(tw);
    this.puffs = new Puffs(1400); g.add(this.puffs.mesh);
    this.a4 = new Rocket(g, { ...saturnRocket(M), env: envMap('dawn'), az: 90 });
    this.a4.place(PAD39.x, PAD39.y + PAD_Y, PAD39.z);
    this.addScene('press', { group: g, bounds: 0.8, place: { lat: 28.4, year: 1967, sunLon: 226 }, amb: 0.2, fogFar: 9000, mist: 0.04,
      sky: () => { this.G.sky.set(112, 3); this.key.position.set(400, 50, 0); this.key.target.position.set(0, 0, -100); this.key.intensity = 0.9; this.key.color.setHex(0xffd0a0); this.lamp.position.set(0, 2.4, 0.4); this.lamp.intensity = 0.7; this.lamp.distance = 6;
        const f = this.a4.flash || 0; this.lamp2.position.set(0, 3, -6); this.lamp2.color.setHex(0xffc080); this.lamp2.intensity = f * 3; this.lamp2.distance = 12; },
      exit: () => { this.key.color.setHex(0xffffff); this.lamp2.color.setHex(0xfff0dc); },
      update: (dt, t) => {
        const s = this.s;
        this.prSea.userData.update?.(t);
        this.a4.update(dt, t, this.F); this.puffs.update(this.G, dt * this.F, [3, 1], this.a4.flash || 0);
        s.tvT = (s.tvT || 0) + dt; this.prTV.pic.update(dt, t);
        if ((this.tvAcc = (this.tvAcc || 0) + dt) > 0.1) { this.tvAcc = 0; this.clockN = s.count != null ? Math.max(0, s.count - (t - s.countT) * this.F) : 600; drawClock(this.clockTex.image.getContext('2d'), 420, 140, this.clockN); this.clockTex.needsUpdate = true; }
        const C = this.cronkite, P = this.producer;
        C.pose = s.shaking ? (s.shaking === 2 ? 'talk' : 'hold') : 'idle'; P.pose = s.shaking ? 'hold' : 'idle';
        for (const R2 of this.reporters) R2.pose = this.a4.rising ? 'cheer' : 'idle';
        if (s.shaking && (this.rattleT = (this.rattleT || 0) - dt) < 0) { this.rattleT = 0.12 + Math.random() * 0.2; clank(this.G, V(0.2, 1.6, -1.9), 0.05 + Math.random() * 0.05); }
      } });
  }

  // ---------- 8. Baikonur: the N1 in its hall ----------
  buildN1() {
    const R = room(150, 56, 40, { floor: surfMat('concrete', '#8a8680'), wall: surfMat('concrete', '#a8a49c'), ceil: surfMat('concrete', '#6a6864'), skirt: 0x4a4a48, rep: 4 });
    const g = R.group, k = new Kit();
    for (const z of [-4, 4]) k.box(140, 0.12, 0.2, 0x5a5a5a, [0, 0.06, z]);                              // the rails
    k.box(110, 1.4, 6, 0x3a4a5a, [-5, 1.6, 0]); for (let x = -58; x <= 48; x += 6) for (const z of [-3.2, 3.2]) k.cyl(0.45, 0.45, 0.5, 10, 0x2a2a2a, [x, 0.5, z], [Math.PI / 2, 0, 0]);   // the transporter
    for (const x of [34, 10, -18, -42]) { const rr = x > 20 ? 8.2 : x > 0 ? 6.4 : x > -30 ? 5.0 : 3.6; k.box(2, N1_AT.y - rr + 0.6 - 2.3, 2.4 * rr, 0x4a5a6a, [x, 2.3 + (N1_AT.y - rr + 0.6 - 2.3) / 2, 0]); }
    for (const z of [-20, 20]) k.box(150, 1.6, 1.6, 0xb8a030, [0, 34, z]); for (const x of [-30, 25]) k.box(2, 2, 40, 0xb8a030, [x, 33, 0]);   // the overhead cranes
    for (let x = -70; x <= 70; x += 14) for (const s of [-1, 1]) k.box(1.2, 40, 1.2, 0x7a7670, [x, 20, s * 27.4]);
    g.add(k.mesh(FLAT));
    const n1 = copy(M.n1, envMap('room'), 0.7); n1.rotation.z = Math.PI / 2; n1.position.copy(N1_AT); g.add(n1);
    const banner = quad(30, 4, new THREE.MeshLambertMaterial({ map: canvasTex(900, 120, (c, w, h) => { c.fillStyle = '#a81e1e'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0e0a0'; c.font = 'bold 64px serif'; c.textAlign = 'center'; c.fillText('СЛАВА СОВЕТСКОЙ НАУКЕ!', w / 2, 84); }) })); banner.position.set(0, 26, -27.9); g.add(banner);
    // rows of lamps along the roof: they go out row by row at the end
    this.n1Lamps = [];
    for (let i = 0; i < 9; i++) { const row = []; for (const z of [-16, 0, 16]) { const L = glowSprite(0xfff4d8, 2.6, 0.95); L.position.set(64 - i * 16, 38.5, z); g.add(L); row.push(L); } this.n1Lamps.push(row); }
    this.addScene('n1', { group: g, bounds: 1.2, indoors: true, place: { lat: 45.9, year: 1968, sunLon: 300 }, amb: 0.06, fogFar: 600,
      sky: () => { this.G.sky.set(240, -30); this.dim(0.2, 1); const on = 1 - this.darkK; this.G.sky.hemi.intensity *= 0.25 + 0.75 * on;
        this.lamp.position.set(55, 30, 12); this.lamp.intensity = 900 * on + 60; this.lamp.distance = 90; this.lamp2.position.set(-10, 32, 0); this.lamp2.intensity = 900 * clamp01(1 - this.darkK * 1.6); this.lamp2.distance = 90; },
      update: (dt) => {
        this.darkK = clamp01((this.darkK || 0) + (this.s.dark ? dt * this.F / 14 : 0));
        this.n1Lamps.forEach((row, i) => { const off = this.darkK * 10 > 9 - i; for (const L of row) L.material.opacity = damp(L.material.opacity, off ? 0.05 : 0.95, 4, dt); });
      } });
  }

  beds() { return [
    { kind: 'room', vol: 0.06, on: (ch) => ch.cur === 'office' || ch.cur === 'press' },
    { kind: 'surf', at: V(22, 0, 0), vol: 0.05, ref: 20, on: (ch) => ch.cur === 'barge' },
    { kind: 'surf', at: V(400, 0, 0), vol: 0.07, ref: 60, wide: true, on: (ch) => ch.cur === 'pad34' },
    { kind: 'vent', at: V(0, 6, 0), vol: 0.06, ref: 6, on: (ch) => ch.cur === 'clean' },
    { kind: 'leaves', at: V(0, 4, -30), vol: 0.05, ref: 40, wide: true, on: (ch) => ch.cur === 'stadium' || ch.cur === 'vab' },
    { kind: 'room', vol: 0.1, on: (ch) => ch.cur === 'n1' },
  ]; }

  // ---------- The story ----------
  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. Korolev's office
    await this.go(D, 'office', 0, 0.1, { x: 0.6, z: 1.6 });
    s.guide = [-2.0, 2.2, 0.0];
    await D.say('ch20_01');
    const l2 = D.sayAsync('ch20_02');
    await D.cue('newspapers'); this.guideTo(this.pravda, 0.6, 0.5);
    await D.cue('coat'); s.guide = [2.2, 2.3, -1.2];
    await D.cue('drawings'); this.guideTo(this.n1Sheet, 0.4, 1.2);
    await l2;
    await D.wait(fast ? 0.3 : 2);
    // 2. The barge
    this.bargeZ = 46;
    await this.go(D, 'barge', yawTo(70), 1.2, { x: 0, z: 0 });
    s.guide = [-2.4, 2.6, -3.6];
    await D.say('ch20_03');
    await D.wait(fast ? 0.3 : 3);
    // 3. Launch Complex 34
    s.lit = 0;
    await this.go(D, 'pad34', 0, 1.4, { x: 0, z: -2.6 });
    s.guide = [-3.0, 2.2, -5.4];
    await D.say('ch20_04');
    const l5 = D.sayAsync(this.pick(D, 'ch20_05', 'ch20_06'));
    await D.cue('Grissom'); s.lit = 1;
    await D.cue('White'); s.lit = 2;
    await D.cue('Chaffee'); s.lit = 3;
    await l5;
    await D.wait(fast ? 0.3 : 2.5);
    // 4. (Adults) the new hatch
    if (!D.kids) {
      s.hatch = 0;
      await this.go(D, 'clean', 0, 1.0, { x: 0, z: 3.0 });
      s.guide = [-2.4, 2.4, 1.0];
      await D.say('ch20_07');
      await this.ask(D, 'hatch', { hint: this.hatchIt.hint, deskHint: this.hatchIt.deskHint, after: 1, timeout: 18 });
      s.hatch = 1; clank(G, this.handle.getWorldPosition(new THREE.Vector3()), 0.3);
      await D.wait(fast ? 0.5 : 3.5);
    }
    // 5. Komarov
    await this.go(D, 'kremlin', 0, 1.2, { x: 0, z: 0.5 });
    s.guide = [3.0, 2.4, -3.2];
    await D.say('ch20_08');
    await D.wait(fast ? 0.3 : 2.5);
    // 6. The VAB at dawn; Kennedy's words; the doors open
    s.doors = 0; s.roll = 0; this.doorK = 0; this.crawler.position.z = CRAWL_Z0;
    const toDoor = yawTo(bearing(0 - 40, VAB_Z - 60));
    await this.go(D, 'vab', toDoor, 1.4, { x: 40, z: 60 });
    s.guide = [33, 3.5, 54];
    await D.say('ch20_09');
    s.film = 1;
    await this.go(D, 'stadium', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-6, 4.5, -4]; s.kennedy = 1;
    await D.say('ch20_10');
    s.kennedy = 0; s.applause = 1; await D.wait(fast ? 0.3 : 1.2); s.applause = 0;
    s.film = 0;
    await this.go(D, 'vab', toDoor, 0.8, { x: 40, z: 60 });
    s.guide = [33, 3.5, 54];
    s.doors = 1; rumble(G, 8, 0.25, V(0, 40, VAB_Z));
    await D.wait(fast ? 1 : 4.5);
    await D.say('ch20_11');               // the music begins here
    s.roll = 1; rumble(G, 16, 0.3, V(0, 5, VAB_Z));
    await D.say('ch20_12');
    await D.wait(fast ? 0.5 : 6);
    // 7. Apollo 4 from the press site
    s.shaking = 0; this.a4.reset(); this.puffs.clear(); 
    await this.go(D, 'press', 0, 1.2, { x: -1.0, z: 0.6 });
    s.count = 25; s.countT = this.t;
    s.guide = [-2.4, 1.8, 0.9];
    const l13 = D.sayAsync('ch20_13');
    await D.cue('Watch'); this.a4.ignite(G, { listener: V(-1, 1.6, 0.6), puffs: this.puffs, delay: 16, roarVol: 2.6, secs: 40 });
    s.count = 0; s.countT = this.t;
    await l13;
    await D.wait(fast ? 3 : Math.max(1, 16 - 6));
    s.shaking = 1; s.rumble = 0.012; rumble(G, 30, 0.6, null);
    await D.wait(fast ? 0.3 : 1.5);
    s.shaking = 2;
    await D.say('ch20_14');
    await D.wait(fast ? 0.5 : 5);
    s.rumble = 0; s.shaking = 0;
    await D.wait(fast ? 0.3 : 2);
    // 8. The N1 in its hall at Baikonur
    s.dark = 0; this.darkK = 0;
    await this.go(D, 'n1', yawTo(bearing(N1_AT.x - 62, N1_AT.z - 12)), 1.4, { x: 62, z: 12 });
    s.guide = [56, 4, 5];
    await D.say('ch20_15');
    s.dark = 1;
    if (!D.kids) await D.say('ch20_16');
    await D.wait(fast ? 0.5 : 5);
  }
}

// The CBS monitor: the Saturn V on its pad in grey, from the long lens
function drawSaturn(c, w, h, t) {
  const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8a8a8a'); gr.addColorStop(1, '#c8c8c8'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  c.fillStyle = '#4a4a4a'; c.fillRect(0, h * 0.82, w, h * 0.18);
  c.fillStyle = '#5a5a5a'; c.fillRect(w * 0.38, h * 0.12, w * 0.08, h * 0.7); for (let y = 0.14; y < 0.8; y += 0.06) c.fillRect(w * 0.46, h * y, w * 0.05, h * 0.012);
  c.fillStyle = '#f0f0f0'; c.fillRect(w * 0.52, h * 0.22, w * 0.07, h * 0.6); c.beginPath(); c.moveTo(w * 0.52, h * 0.22); c.lineTo(w * 0.555, h * 0.08); c.lineTo(w * 0.59, h * 0.22); c.fill();
  c.fillStyle = '#2a2a2a'; for (const y of [0.4, 0.52, 0.7]) c.fillRect(w * 0.52, h * y, w * 0.07, h * 0.02);
}
// The countdown clock at the press site
function drawClock(c, w, h, secs) {
  c.fillStyle = '#111'; c.fillRect(0, 0, w, h);
  const m = Math.floor(secs / 60), s2 = Math.floor(secs % 60);
  c.fillStyle = '#ff6a30'; c.font = 'bold 84px monospace'; c.textAlign = 'center'; c.fillText(`T-${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}`, w / 2, 100);
  c.fillStyle = '#f0e8d0'; c.font = 'bold 20px sans-serif'; c.fillText('APOLLO 4', w / 2, 128);
}
