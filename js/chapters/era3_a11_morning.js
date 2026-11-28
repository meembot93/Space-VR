// Era 3, Apollo 11 part 1 (n 22): Launch morning. 16 July 1969.
//
// 1. The crew quarters at 4:15 a.m.: Deke Slayton opens the door. "Rise and shine."
// 2. Breakfast: steak and eggs round one table (the crew in shirts, Deke, Bill Anders).
// 3. The suit room: helmets clicked on, the hiss of pure oxygen.
// 4. Out to the van past cheering workers and popping flashbulbs.
// 5. Pad 39A before dawn: the Saturn V creaks and pours white clouds of boiling-off cold.
//    The elevator up the tower (Adults press its button): up out of the mist, and the Sun rises
//    over the ocean (the music starts here).
// 6. On the crew access arm, 98 m up: Buzz waits alone; the beaches and roads full of people.
// 7. Rice Stadium, 1962: "The eyes of the world now look into space".
// 8. The white room: Guenter Wendt gives Neil a key to the Moon; Neil gives him a ticket for a
//    space taxi. The hatch closes.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { Chapter3, D2R, yawTo, bearing } from '../era3/base.js';
import { person, makeFolk, sit, wear } from '../era3/folk.js';
import { loadAll, copy } from '../era3/craft.js';
import { Puffs, envMap, hiss, clank, flashPop, applause, click, beep } from '../era3/fx.js';
import { groundPlane, sea } from '../era3/worlds.js';
import { room, surfMat, quad, chair, table, bed, picture, floodTower, lattice, deskLamp, shelf } from '../era3/sets.js';
import { riceStadium } from '../era3/places.js';
import { SATURN, saturnStack, PAD_Y, CREW_ARM_Y, TOWER } from '../era3/saturn.js';
import { holdProp, dropProp } from '../people.js';
import { glowSprite } from '../wow/fx.js';
import { canvasTex, damp } from '../util.js';
import { rng, noise2 } from '../shapes.js';

const M = await loadAll([...SATURN, 'craft/launch_tower', 'craft/apollo_couch', 'props/helmet_apollo']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _a = new THREE.Vector3();

const ARM_Y = PAD_Y + CREW_ARM_Y;            // the crew access arm's floor
const LIFT = { x: 9.6, z: -15.5, y0: PAD_Y - 0.6 };   // the elevator cage, on the tower's east face
const CLOUD_Y = 46;                          // the top of the morning mist
const SUN_AZ = 64;                           // a July sunrise over the Atlantic: east-north-east

// A deep groaning creak: the cold rocket's metal shrinking as it's filled (ch22_06)
function creak(G, pos, vol = 0.35) {
  const A = G.audio; if (!A.ctx) return;
  const o = A.out(pos, vol, 60, 0.5), f = 48 + Math.random() * 30;
  A.tone(o, { type: 'sawtooth', f, f2: f * (0.7 + Math.random() * 0.2), peak: 0.07, a: 0.4, d: 1.4 + Math.random() });
  A.tone(o, { type: 'triangle', f: f * 2.03, f2: f * 1.6, peak: 0.05, a: 0.3, d: 1.2 });
  A.noise(o, { type: 'lowpass', f: 260, f2: 120, q: 3, peak: 0.25, a: 0.5, d: 1.6 });
}
// a low hiss of venting oxygen, now and then
function vent(G, pos, vol = 0.25) {
  const A = G.audio; if (!A.ctx) return;
  A.noise(A.out(pos, vol, 40, 0.6), { type: 'bandpass', f: 900 + Math.random() * 600, q: 0.6, peak: 0.3, a: 0.4, d: 2.5 });
}

export default class A11Morning extends Chapter3 {
  constructor(G) {
    super(G, 22);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { door: 0, up: 0, wake: 0, hiss: 0, walk: 0, flashes: 0, liftGo: 0, lift: 0, at: 'ground', sun: 0, key: 0, ticket: 0, inside: 0, hatch: 0 });
    this.buildQuarters(); this.buildMess(); this.buildSuitRoom(); this.buildVan(); this.buildPad();
    riceStadium(this, 'stadium'); this.buildWhiteRoom();
  }

  // ---------- 1. The crew quarters, 4:15 a.m. ----------
  buildQuarters() {
    const R = room(4.4, 4.0, 2.6, { floor: surfMat('lino', '#7a7466'), wall: surfMat('plaster', '#d4ccb4'), ceil: surfMat('acoustic'),
      windows: [{ side: 'w', at: 0.4, y: 1.0, w: 1.0, h: 1.0 }], doors: [{ side: 's', at: 1.3, w: 0.9, h: 2.05 }] });
    const g = R.group, k = new Kit();
    bed(k, -0.9, -0.85, 0, { blanket: 0x5a6a8a }); bed(k, 1.2, -0.85, 0, { blanket: 0x6a5a4a });
    k.box(0.82, 0.1, 1.2, 0x5a6a8a, [-0.9, 0.66, -0.3]);              // Collins's blanket, over him
    k.box(0.5, 0.1, 1.3, 0x6a5a4a, [1.4, 0.64, -0.75], [0, 0.04, 0]);   // Neil's, thrown back
    k.box(0.45, 0.55, 0.4, 0x5a4030, [0.15, 0.275, -1.6]);             // the nightstand
    k.box(0.5, 1.9, 0.55, 0x6a5038, [-1.85, 0.95, 1.4]);               // a wardrobe
    k.box(0.3, 0.04, 0.22, 0x2a2a2a, [0.15, 0.57, -1.6]);
    shelf(k, 1.95, 0.9, -Math.PI / 2, { w: 0.9, h: 1.1, seed: 9 });
    g.add(k.mesh(FLAT));
    // the clock: 4:15
    const clock = picture(0.28, 0.28, (c, w, h) => { c.fillStyle = '#f4f0e4'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 2, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 6; c.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.fillStyle = '#222'; c.fillRect(w / 2 + Math.sin(a) * w * 0.4 - 3, h / 2 - Math.cos(a) * h * 0.4 - 3, 6, 6); }
      c.lineCap = 'round'; c.lineWidth = 10; c.beginPath(); c.moveTo(w / 2, h / 2); const ha = (4.25 / 12) * Math.PI * 2; c.lineTo(w / 2 + Math.sin(ha) * w * 0.22, h / 2 - Math.cos(ha) * h * 0.22); c.stroke();
      c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2, h / 2); const ma = 0.25 * Math.PI * 2; c.lineTo(w / 2 + Math.sin(ma) * w * 0.34, h / 2 - Math.cos(ma) * h * 0.34); c.stroke(); }, { frame: 0x2a2a2a });
    clock.position.set(0.15, 2.0, -1.97); g.add(clock);
    const cal = picture(0.36, 0.48, (c, w, h) => { c.fillStyle = '#f0ece0'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a4a8a'; c.fillRect(0, 0, w, h * 0.2); c.fillStyle = '#fff'; c.font = 'bold 30px serif'; c.textAlign = 'center'; c.fillText('JULY 1969', w / 2, h * 0.14);
      c.fillStyle = '#333'; c.font = '20px serif'; for (let d = 1; d <= 31; d++) { const x = ((d + 1) % 7) * w / 7 + w / 14, y = h * 0.3 + Math.floor((d + 1) / 7) * h * 0.13; c.fillText(String(d), x, y); if (d === 16) { c.strokeStyle = '#c02020'; c.lineWidth = 4; c.beginPath(); c.arc(x, y - 7, 17, 0, 7); c.stroke(); } } });
    cal.position.set(2.17, 1.6, -1.2); cal.rotation.y = -Math.PI / 2; g.add(cal);
    // outside the window: night, with the floodlit pad far off
    const night = quad(3, 2, new THREE.MeshBasicMaterial({ fog: false, map: canvasTex(512, 340, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#05081a'); gr.addColorStop(0.62, '#0e1430'); gr.addColorStop(0.64, '#07080c'); gr.addColorStop(1, '#040406'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      const r = rng(4); c.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { c.globalAlpha = 0.3 + r() * 0.7; c.fillRect(r() * w, r() * h * 0.58, 1.5, 1.5); } c.globalAlpha = 1;
      const x = w * 0.62; const gl = c.createRadialGradient(x, h * 0.6, 2, x, h * 0.6, 60); gl.addColorStop(0, 'rgba(255,240,200,0.9)'); gl.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = gl; c.fillRect(x - 60, h * 0.6 - 60, 120, 120);
      c.fillStyle = '#fff6e0'; c.fillRect(x - 1.5, h * 0.5, 3, h * 0.12); }) }));
    night.position.set(-2.9, 1.5, 0.4); night.rotation.y = Math.PI / 2; g.add(night);
    // the door, swinging open into a lit hallway
    const hinge = new THREE.Group(); hinge.position.set(1.3 - 0.45, 0, 2.0); g.add(hinge); this.qDoor = hinge;
    const dk = new Kit(); dk.box(0.88, 2.03, 0.05, 0x7a5a3a, [0.44, 1.02, 0]); dk.ball(0.035, 1, 0xc8b070, [0.8, 1.0, -0.05]); hinge.add(dk.mesh(FLAT));
    const hall = quad(2, 2.4, new THREE.MeshBasicMaterial({ color: 0xfff0d0 })); hall.position.set(1.3, 1.2, 2.6); hall.rotation.y = Math.PI; g.add(hall);
    this.hallLight = new THREE.SpotLight(0xffe8c0, 0, 9, 0.7, 0.6, 1.2); this.hallLight.position.set(1.3, 2.1, 2.4); this.hallLight.target.position.set(0.4, 0, -0.5); g.add(this.hallLight, this.hallLight.target);
    // Neil sitting up on his bed; Mike asleep under his blanket; Deke at the door
    this.neilQ = person(g, 'armstrong_casual', V(0.45, 0, 0.15), 0.4); this.neilQ.look = V(1.3, 1.7, 2);
    this.mikeQ = person(g, 'collins_casual', V(-0.9, 0.56, 0.5), 0); this.mikeQ.g.rotation.set(-Math.PI / 2, 0, 0); this.mikeQ.g.position.set(-0.9, 0.63, 0.75);
    this.dekeQ = person(g, 'slayton', V(1.3, 0, 2.7), Math.PI); this.dekeQ.look = V(0, 1.2, -0.5);
    this.people.push(this.neilQ, this.mikeQ, this.dekeQ);
    this.addScene('quarters', { group: g, bounds: 0.6, indoors: true, place: { lat: 28.5, year: 1969, sunLon: 114 }, amb: 0.02, fogFar: 200,
      sky: () => { this.G.sky.set(SUN_AZ, -24); this.lamp.position.set(0.15, 0.9, -1.4); this.lamp.intensity = 0.5 + 1.2 * (this.s.door ? 0 : 1) * 0; this.lamp.distance = 6; this.lamp.color.setHex(0xffd8a0); },
      update: (dt) => {
        const s = this.s; this.doorK = damp(this.doorK || 0, s.door ? 1 : 0, 2.5, dt);
        this.qDoor.rotation.y = -this.doorK * 1.6;
        this.hallLight.intensity = this.doorK * 9;
        this.lamp.intensity = s.wake ? 1.6 : 0.25;                       // the bedside lamp clicks on
        this.dekeQ.g.position.z = 2.7 - this.doorK * 0.85;
        this.dekeQ.pose = s.door && !s.wake ? 'wave' : 'talk';
        this.neilQ.pose = 'idle';
        this.mikeQ.g.rotation.z = s.wake ? Math.sin(this.t * 2) * 0.03 : 0;
      } });
  }

  // ---------- 2. Breakfast: steak and eggs ----------
  buildMess() {
    const R = room(6.0, 5.0, 2.7, { floor: surfMat('lino', '#6a6a5c'), wall: { n: surfMat('panelwood', '#7a5a3c'), s: surfMat('plaster', '#d8d0bc'), e: surfMat('plaster', '#d8d0bc'), w: surfMat('plaster', '#d8d0bc') }, ceil: surfMat('acoustic'),
      windows: [{ side: 'e', at: 0, y: 1.0, w: 1.6, h: 1.1 }] });
    const g = R.group, k = new Kit();
    table(k, 0, -0.4, 0, { w: 2.6, d: 1.0, col: 0x6a4a2a, cloth: 0xf0ece4 });
    const seats = [[-0.7, -1.1, 0], [0.3, -1.1, 0], [-1.6, -0.4, Math.PI / 2], [1.6, -0.4, -Math.PI / 2], [-0.6, 0.3, Math.PI], [0.5, 0.3, Math.PI]];
    for (const [x, z, y] of seats) chair(k, x, z, y, { seat: 0x6a2a1e });
    // plates of steak and eggs, toast, juice and coffee at every place
    const plate = (x, z) => {
      k.cyl(0.13, 0.11, 0.02, 16, 0xf4f2ec, [x, 0.765, z]);
      k.ball(0.07, 1, 0x5a3018, [x - 0.03, 0.785, z], 0, [1.2, 0.25, 0.85]);          // the steak
      k.cyl(0.04, 0.045, 0.008, 12, 0xf8f6ee, [x + 0.06, 0.78, z + 0.04]); k.ball(0.018, 1, 0xf0b020, [x + 0.06, 0.786, z + 0.04], 0, [1, 0.5, 1]);   // an egg
      k.cyl(0.035, 0.03, 0.1, 10, 0xf0a030, [x + 0.18, 0.81, z - 0.08]);              // orange juice
      k.cyl(0.04, 0.035, 0.08, 10, 0xf4f2ec, [x - 0.18, 0.8, z - 0.06]);              // coffee
      k.box(0.08, 0.012, 0.08, 0xc89050, [x + 0.15, 0.77, z + 0.1], [0, 0.4, 0]);     // toast
    };
    for (const [x, z] of [[-0.7, -0.75], [0.3, -0.75], [-1.15, -0.4], [1.15, -0.4], [-0.6, -0.05], [0.5, -0.05]]) plate(x, z);
    k.cyl(0.06, 0.05, 0.2, 10, 0xe8e8e0, [-0.1, 0.86, -0.4]); k.cyl(0.05, 0.05, 0.16, 10, 0xc8d8e0, [0.15, 0.84, -0.45]);
    k.box(1.6, 0.9, 0.5, 0x8a8a80, [2.2, 0.45, 2.2]); k.box(1.6, 0.05, 0.55, 0xb8b8b0, [2.2, 0.92, 2.2]);   // the kitchen counter
    g.add(k.mesh(FLAT));
    const flag = picture(0.9, 0.55, (c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f0ece4' : '#b02030'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#2a3a6a'; c.fillRect(0, 0, w * 0.42, h * 0.54); c.fillStyle = '#fff'; for (let i = 0; i < 30; i++) c.fillRect(6 + (i % 6) * 17, 6 + Math.floor(i / 6) * 13, 3, 3); }, { frame: 0x3a2a1a });
    flag.position.set(-1.2, 1.8, -2.47); g.add(flag);
    const patch = picture(0.5, 0.5, (c, w, h) => { c.fillStyle = '#1a2a5a'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 3, 0, 7); c.fill(); c.strokeStyle = '#d8b040'; c.lineWidth = 8; c.stroke();
      c.fillStyle = '#c8c8c0'; c.beginPath(); c.arc(w / 2, h * 0.78, w * 0.5, Math.PI * 1.15, Math.PI * 1.85); c.fill(); c.fillStyle = '#4a7ac0'; c.beginPath(); c.arc(w * 0.3, h * 0.3, w * 0.08, 0, 7); c.fill();
      c.fillStyle = '#c8a050'; c.beginPath(); c.moveTo(w * 0.35, h * 0.62); c.lineTo(w * 0.62, h * 0.4); c.lineTo(w * 0.7, h * 0.46); c.lineTo(w * 0.44, h * 0.66); c.fill();
      c.fillStyle = '#f0e8c0'; c.font = 'bold 28px sans-serif'; c.textAlign = 'center'; c.fillText('APOLLO 11', w / 2, h * 0.2); }, { frame: 0x3a2a1a });
    patch.position.set(0.8, 1.8, -2.47); g.add(patch);
    const dawn = quad(4, 2.4, new THREE.MeshBasicMaterial({ fog: false, map: canvasTex(256, 160, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a1030'); gr.addColorStop(0.6, '#2a2a4a'); gr.addColorStop(0.62, '#0a0a10'); gr.addColorStop(1, '#050508'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }) }));
    dawn.position.set(3.6, 1.5, 0); dawn.rotation.y = -Math.PI / 2; g.add(dawn);
    // the crew in their shirts, Deke at the head, Bill Anders
    const at = (i, dy = 0) => V(seats[i][0], 0, seats[i][1] + dy);
    this.mess = [['armstrong_casual', 0], ['aldrin_casual', 1], ['collins_casual', 4], ['slayton', 2], ['anders', 5]].map(([m, i]) => { const P = person(g, m, at(i), seats[i][2]); sit(P); P.look = V(0, 1.2, -0.4); return P; });
    this.cook = makeFolk({ kind: 'shirt', coat: 0xf4f2ec, hat: 'none', seed: 2201 }); this.cook.g.position.set(2.2, 0, 2.8); this.cook.g.rotation.y = Math.PI; g.add(this.cook.g); this.cook.look = V(0, 1.2, -0.4);
    this.people.push(...this.mess, this.cook);
    this.addScene('mess', { group: g, bounds: 0.6, indoors: true, place: { lat: 28.5, year: 1969, sunLon: 114 }, amb: 0.02, fogFar: 200,
      sky: () => { this.G.sky.set(SUN_AZ, -18); this.lamp.position.set(0, 2.5, -0.4); this.lamp.intensity = 2.2; this.lamp.distance = 8; this.lamp.color.setHex(0xfff0d8); this.lamp2.position.set(-2, 2.4, 1.6); this.lamp2.intensity = 0.9; this.lamp2.distance = 7; },
      update: (dt, t) => { this.mess.forEach((P, i) => { P.pose = (Math.floor(t / 3 + i * 1.7) % 3 === 0) ? 'talk' : 'idle'; }); this.mess[3].pose = 'talk'; } });
  }

  // ---------- 3. The suit room ----------
  buildSuitRoom() {
    const R = room(6.4, 5.0, 2.8, { floor: surfMat('tiles', '#d8dcd8'), wall: surfMat('plaster', '#e4e6e0'), ceil: surfMat('acoustic') });
    const g = R.group, k = new Kit();
    // three reclining lounge chairs in a row
    this.lounges = [-1.6, 0, 1.6].map((x) => { k.box(0.7, 0.4, 1.6, 0x5a6a7a, [x, 0.2, -0.8]); k.box(0.66, 0.08, 0.9, 0x3a4a5a, [x, 0.44, -0.55]); k.box(0.66, 0.9, 0.12, 0x3a4a5a, [x, 0.8, -1.45], [-0.35, 0, 0]); return x; });
    // the suit lockers, a bench, the oxygen carts, a wall chart
    for (let i = 0; i < 6; i++) k.box(0.55, 2.0, 0.5, i % 2 ? 0x8a9aa8 : 0x7a8a98, [-3.0 + 0.28, 1.0, -1.8 + i * 0.58]);
    k.box(2.0, 0.45, 0.4, 0x6a5a48, [1.5, 0.225, 2.2]);
    for (const x of [-2.3, -0.75, 0.85]) { const z = -1.5; k.box(0.4, 0.5, 0.3, 0xb8bcc0, [x, 0.6, z]); k.box(0.42, 0.05, 0.32, 0x8a8e92, [x, 0.35, z]); for (const s of [-1, 1]) k.cyl(0.04, 0.04, 0.05, 8, 0x2a2a2a, [x + s * 0.15, 0.04, z], [0, 0, Math.PI / 2]); k.cyl(0.015, 0.015, 0.35, 6, 0x2a2a2a, [x, 0.25, z]); }
    for (const x of [-1.6, 0, 1.6]) k.cyl(0.02, 0.02, 0.9, 6, 0x4a5a8a, [x - 0.5, 0.75, -1.0], [0.5, 0, 0.6]);   // hoses up to the suits
    g.add(k.mesh(FLAT));
    const sign = picture(1.6, 0.4, (c, w, h) => { c.fillStyle = '#e8e4d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a2a5a'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('SUIT ROOM  ·  MSOB', w / 2, h * 0.68); }, { frame: 0x5a5a5a, px: 512 });
    sign.position.set(0, 2.2, -2.47); g.add(sign);
    // the crew, suited, lying back in the lounges; helmets going on
    this.suited = ['collins', 'armstrong', 'aldrin'].map((m, i) => { const x = this.lounges[i]; const P = person(g, m, V(x, 0.1, -0.55), 0); sit(P); P.look = V(0, 1.6, 2); return P; });
    this.suitHelmets = this.suited.map((P) => { const h = wear(P, copy(M.helmet_apollo), { lift: -0.05, size: 1 }); h.visible = false; return h; });
    // suit technicians (Joe Schmitt at Neil's side)
    this.techs = [0, 1, 2].map((i) => { const T = makeFolk({ kind: 'coverall', coat: 0xf0f0ec, hat: 'cap', seed: 2210 + i, glasses: i === 1 }); T.g.position.set(this.lounges[i] + 0.62, 0, -0.95); T.g.rotation.y = -Math.PI / 2 + 0.5; g.add(T.g); T.look = V(this.lounges[i], 1.2, -0.6); return T; });
    this.people.push(...this.suited, ...this.techs);
    this.addScene('suitroom', { group: g, bounds: 0.6, indoors: true, place: { lat: 28.5, year: 1969, sunLon: 114 }, amb: 0.03, fogFar: 200,
      sky: () => { this.G.sky.set(SUN_AZ, -14); this.lamp.position.set(0, 2.6, 0); this.lamp.intensity = 2.6; this.lamp.distance = 9; this.lamp.color.setHex(0xf0f4ff); },
      update: () => { const s = this.s; this.suitHelmets.forEach((h, i) => { h.visible = s.helmets > i; }); this.techs.forEach((T, i) => { T.pose = s.helmets === i + 1 && !s.hiss ? 'work' : 'idle'; }); } });
  }

  // ---------- 4. Out to the van ----------
  buildVan() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(41);
    g.add(groundPlane({ size: 1200, seg: 60, h: () => 0, color: (x, z, c) => { const m = N(x / 6, z / 6); if (Math.abs(x) < 18 && z > -14 && z < 30) c.setRGB(0.44 + m * 0.05, 0.44 + m * 0.05, 0.43); else c.setRGB(0.2 + m * 0.06, 0.3 + m * 0.06, 0.16); } }));
    // the Manned Spacecraft Operations Building: a long pale block with a lit doorway
    k.box(60, 14, 16, 0xc8c4b8, [0, 7, -22]);
    for (let i = 0; i < 18; i++) for (let j = 0; j < 3; j++) k.box(1.6, 1.2, 0.05, (i * 7 + j * 3) % 5 === 0 ? 0xf0e0a8 : 0x2a3038, [-27 + i * 3.2, 3 + j * 3.6, -13.97]);
    k.box(5, 3.4, 0.4, 0x8a8478, [0, 1.7, -13.9]); k.box(4.4, 0.2, 2.6, 0x9a968c, [0, 3.3, -12.6]);
    for (const s of [-1, 1]) k.box(0.15, 3.2, 0.15, 0x7a766c, [s * 2.0, 1.6, -11.4]);
    // the van: a white motor coach with a blue stripe, door open
    const vx = 3.6, vz = -6.5;
    k.box(2.4, 2.5, 8.0, 0xf0f0ea, [vx, 1.55, vz - 1]); k.box(2.42, 0.35, 8.02, 0x2a4a8a, [vx, 1.4, vz - 1]); k.box(2.2, 0.15, 7.8, 0xd8d8d0, [vx, 2.85, vz - 1]);
    for (let i = 0; i < 5; i++) k.box(0.03, 0.6, 1.0, 0x1a2a3a, [vx - 1.21, 2.2, vz - 4 + i * 1.5]);
    k.box(2.2, 0.8, 0.05, 0x1a2a3a, [vx, 2.15, vz + 3.02]);
    k.box(0.05, 2.0, 0.9, 0x2a2a2e, [vx - 1.21, 1.3, vz + 1.6]);
    for (const [ox, oz] of [[-1.1, 2.2], [1.1, 2.2], [-1.1, -3.6], [1.1, -3.6]]) k.cyl(0.45, 0.45, 0.3, 14, 0x1a1a1a, [vx + ox, 0.45, vz + oz], [0, 0, Math.PI / 2]);
    // security cars and a fence, floodlights
    for (const [x, z] of [[9, -2], [-8, 4]]) { k.box(1.9, 0.8, 4.6, 0xe8e8e0, [x, 0.7, z]); k.box(1.7, 0.55, 2.4, 0x1a2a3a, [x, 1.35, z - 0.2]); k.box(0.4, 0.1, 0.2, 0xc02020, [x, 1.66, z - 0.2]); }
    for (let i = 0; i < 16; i++) k.cyl(0.04, 0.04, 1.8, 4, 0x7a7a7a, [-16, 0.9, -12 + i * 2.6]);
    floodTower(k, -14, -8, 0.9, 12); floodTower(k, 14, 6, -2.3, 12);
    g.add(k.mesh(FLAT));
    // the crew walking out, carrying their portable air conditioners; workers and photographers either side
    const box = () => { const b = new Kit(); b.box(0.28, 0.2, 0.14, 0xc8ccd0, [0, -0.1, 0]); b.box(0.06, 0.04, 0.02, 0x2a2a2a, [0, 0.02, 0]); return b.mesh(FLAT); };
    this.walkers = ['armstrong', 'collins', 'aldrin'].map((m, i) => { const P = person(g, m, V(0, 0, -12.5 - i * 1.3), Math.PI); wear(P, copy(M.helmet_apollo), { lift: -0.05, size: 1 }); holdProp(P, box(), 'Right', [0, 0.1, 0.05]); P.look = V(2, 1.6, 0); return P; });
    this.walkers.forEach((P, i) => { P.g.rotation.y = 0; P.g.position.set(-0.4 + i * 0.4, 0, -11.6 - i * 1.4); });
    const seeds = [2231, 2232, 2233, 2234, 2235, 2236, 2237, 2238, 2239, 2240];
    this.crowdV = seeds.map((sd, i) => { const side = i % 2 ? 1 : -1; const P = makeFolk({ kind: ['shirt', 'coverall', 'suit', 'shirt', 'jacket'][i % 5], coat: [0xf0f0ea, 0xe8e8e0, 0x4a4a52, 0xc8d8e8, 0x6a5a40][i % 5], hat: i % 3 === 0 ? 'hardhat' : 'none', tie: i % 4 === 1 ? 0x2a2a4a : undefined, seed: sd }); P.g.position.set(side * (2.4 + (i % 3) * 0.6) - (side > 0 ? 0 : 0), 0, -10 + Math.floor(i / 2) * 1.6); P.g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; P.look = V(0, 1.6, -6); g.add(P.g); return P; });
    this.flashes = [0, 1, 2, 3].map(() => { const f = glowSprite(0xffffff, 1.2, 0); g.add(f); return f; });
    this.people.push(...this.walkers, ...this.crowdV);
    this.addScene('van', { group: g, bounds: 0.6, place: { lat: 28.5, year: 1969, sunLon: 114 }, amb: 0.3, fogFar: 1500, mist: 0.1,
      sky: () => { this.G.sky.set(SUN_AZ, -9); this.G.sky.setMoon(250, 30, 1, 0.12); this.key.position.set(-10, 12, -6); this.key.target.position.set(0, 0, -8); this.key.intensity = 1.3; this.key.color.setHex(0xfff0d0);
        this.lamp.position.set(0, 3.0, -12.5); this.lamp.intensity = 4; this.lamp.distance = 14; this.lamp.color.setHex(0xfff0d0); this.lamp2.position.set(2, 3, -4); this.lamp2.intensity = 2; this.lamp2.distance = 12; this.lamp2.color.setHex(0xe8f0ff); },
      exit: () => { this.key.color.setHex(0xffffff); },
      update: (dt, t) => {
        const s = this.s;
        this.walkers.forEach((P, i) => {
          if (!s.walk) { P.pose = 'idle'; return; }
          const path = [V(-0.4 + i * 0.4, 0, -11.6 - i * 1.4), V(0.5, 0, -3.6), V(2.2, 0, -4.9)];
          P.k = Math.min(1, (P.k || 0) + dt * this.F / 11);
          const kk = clamp01(P.k * 1.15 - i * 0.08), seg = kk < 0.75 ? 0 : 1, f = seg === 0 ? kk / 0.75 : (kk - 0.75) / 0.25;
          const a = path[seg], b = path[seg + 1]; P.g.position.lerpVectors(a, b, f);
          P.g.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); P.pose = kk < 1 ? 'walk' : 'idle';
          if (kk >= 1) P.g.visible = false;
          if (kk > 0.4 && kk < 0.8) P.pose = 'wave';
        });
        this.crowdV.forEach((P, i) => { P.pose = s.walk ? (i % 3 === 0 ? 'cheer' : i % 3 === 1 ? 'wave' : 'hold') : 'idle'; P.look = this.walkers[0].g.position.clone().setY(1.6); });
        // flashbulbs popping now and then
        this.flashes.forEach((f, i) => {
          if (s.walk && Math.random() < dt * 0.9) { const P = this.crowdV[(i * 3 + Math.floor(t)) % this.crowdV.length]; f.position.copy(P.g.position).add(V(0, 1.6, 0)); f.material.opacity = 1; flashPop(this.G, f.position, 0.14); }
          f.material.opacity = Math.max(0, f.material.opacity - dt * 6);
        });
      } });
  }

  // ---------- 5 & 6. Pad 39A at dawn, the elevator, the access arm ----------
  buildPad() {
    const g = new THREE.Group(), k = new Kit(), N = noise2(69);
    g.add(groundPlane({ size: 6000, seg: 150, h: (x, z) => { const d = Math.hypot(x, z); return x > 520 ? -2 : d < 120 ? 0 : (N(x / 60, z / 60) - 0.5) * 0.8; },
      color: (x, z, c) => { const m = N(x / 8, z / 8), d = Math.hypot(x, z); if (d < 120) c.setRGB(0.5 + m * 0.06, 0.49 + m * 0.06, 0.46); else if (x > 470) c.setRGB(0.78, 0.72, 0.58); else if (N(x / 140, z / 140) > 0.62) c.setRGB(0.12, 0.2, 0.26); else c.setRGB(0.22 + m * 0.08, 0.3 + m * 0.07, 0.14); } }));
    const S = sea({ size: 9000, col: 0x24425e, sky: 0xe8b898, sun: V(0.9, 0.05, -0.44) }); S.position.set(5020, -1.4, 0); g.add(S); this.padSea = S;
    // the pad's slope and flame trench, lamps, the fuel and oxygen tank farms, a road out
    k.box(80, 1.2, 70, 0x9a968c, [0, 0.6, -4]); k.box(14, 1.25, 40, 0x3a3836, [0, 0.62, 30]);
    for (const [x, z] of [[-90, -70], [90, -70], [-70, 80], [70, 80]]) floodTower(k, x, z, Math.atan2(-x, -z), 30);
    for (const [x, z, r, col] of [[-140, -60, 10, 0xe8e8e4], [140, -60, 12, 0xe8e8e4], [-160, 40, 8, 0xd8d8d0]]) { k.cyl(r, r, r * 1.6, 24, col, [x, r * 0.8 + 0.5, z]); k.ball(r, 2, col, [x, r * 1.6 + 0.5, z], 0, [1, 0.5, 1]); }
    k.box(8, 0.1, 1200, 0x4a4844, [-40, 0.05, 640]);
    // the elevator: two rails up the tower's east face, a cage that rides them, a call button
    for (const s of [-1, 1]) k.box(0.22, ARM_Y + 6 - LIFT.y0, 0.22, 0x9a4a2a, [LIFT.x + s * 1.1, LIFT.y0 + (ARM_Y + 6 - LIFT.y0) / 2, LIFT.z - 1.05]);
    for (let y = LIFT.y0 + 3; y < ARM_Y + 5; y += 6) k.box(2.4, 0.12, 0.12, 0x9a4a2a, [LIFT.x, y, LIFT.z - 1.05]);
    // a landing at the top, joining the cage to the arm's walkway along the tower face
    k.box(LIFT.x - 0.5, 0.12, 1.8, 0x6a6e72, [(LIFT.x + 0.5) / 2 - 0.5, ARM_Y - 0.06, TOWER.face + 0.95]);
    for (const zz of [TOWER.face + 1.85]) for (let x = 1.4; x < LIFT.x - 1.2; x += 1.2) k.box(0.05, 1.05, 0.05, 0xc8c4b8, [x, ARM_Y + 0.52, zz]);
    k.box(LIFT.x - 2.6, 0.05, 0.05, 0xc8c4b8, [(LIFT.x - 1.2 + 1.4) / 2, ARM_Y + 1.05, TOWER.face + 1.85]);
    g.add(k.mesh(FLAT));
    const T = copy(M.launch_tower, envMap('dawn'), 0.8); g.add(T);
    const SV = this.stack = saturnStack(M, envMap('dawn'), 1.0); SV.position.y = PAD_Y; g.add(SV);
    // the cage (its own group, moved each frame)
    const cage = this.cage = new THREE.Group(), ck = new Kit();
    ck.box(2.0, 0.1, 2.0, 0x5a5e62, [0, -0.05, 0]); ck.box(2.0, 0.08, 2.0, 0x5a5e62, [0, 2.45, 0]);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ck.box(0.06, 2.5, 0.06, 0x4a4e52, [x * 0.97, 1.25, z * 0.97]);
    for (const y of [0.55, 1.05]) { ck.box(2.0, 0.04, 0.04, 0xd8b020, [0, y, 0.98]); ck.box(0.04, 0.04, 2.0, 0xd8b020, [0.98, y, 0]); ck.box(0.04, 0.04, 2.0, 0xd8b020, [-0.98, y, 0]); }
    for (let i = -4; i <= 4; i++) ck.box(0.015, 2.4, 0.015, 0x6a6e72, [i * 0.22, 1.25, -0.98]);
    ck.box(0.18, 0.3, 0.08, 0x3a3e42, [0.7, 1.2, -0.92]);
    cage.add(ck.mesh(FLAT));
    const btn = this.liftBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0x30c040, emissive: 0x20a030, emissiveIntensity: 0.6 }));
    btn.rotation.x = Math.PI / 2; btn.position.set(0.7, 1.25, -0.87); cage.add(btn);
    cage.position.set(LIFT.x, LIFT.y0, LIFT.z); g.add(cage);
    this.liftIt = this.touchable('lift', btn, { hint: 'Press the green button', deskHint: 'Click the green button', r: 0.25 });
    // the boiling-off cold: white clouds pouring down the rocket's sides and out of its vents
    this.vapor = new Puffs(900, { floor: PAD_Y + 0.4 }); g.add(this.vapor.mesh);
    // the morning mist: a soft layer of cloud you rise through
    const mistTex = canvasTex(512, 512, (c, w, h) => { const r = rng(12); c.clearRect(0, 0, w, h); for (let i = 0; i < 260; i++) { const x = r() * w, y = r() * h, rr = 20 + r() * 70; const gr = c.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(255,255,255,${0.10 + r() * 0.12})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); } });
    mistTex.wrapS = mistTex.wrapT = THREE.RepeatWrapping; mistTex.repeat.set(10, 10);
    this.mists = [0, 1, 2, 3].map((i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshBasicMaterial({ map: mistTex, color: 0xd8d0d4, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 12 + i * (CLOUD_Y - 12) / 3; m.renderOrder = 3; g.add(m); return m; });
    // the crowds on the beaches and causeways: tiny dots of colour and the glint of cars, miles off
    const n = 9000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), r = rng(71), cc = new THREE.Color();
    const shores = [[[520, -2600], [520, 2600]], [[-900, -2200], [-900, 2400]], [[-300, 1600], [480, 1600]]];
    for (let i = 0; i < n; i++) { const [a, b] = shores[i % 3]; const f = r(); pos[i * 3] = a[0] + (b[0] - a[0]) * f + (r() - 0.5) * 18; pos[i * 3 + 1] = 1.0; pos[i * 3 + 2] = a[1] + (b[1] - a[1]) * f + (r() - 0.5) * 18;
      cc.setHex([0xd84030, 0x3060c0, 0xf0f0e8, 0xe8c040, 0x40a060, 0xf0a0b0, 0x202020][Math.floor(r() * 7)]); col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.beach = new THREE.Points(pg, new THREE.PointsMaterial({ size: 2.4, vertexColors: true, sizeAttenuation: true, fog: false })); this.beach.visible = false; g.add(this.beach);
    // Buzz, waiting alone on the walkway; Neil and Mike already gone into the white room
    this.buzzArm = person(g, 'aldrin', V(0.5, ARM_Y, -7.0), Math.PI / 2 - 0.3); wear(this.buzzArm, copy(M.helmet_apollo), { lift: -0.05, size: 1 }); this.buzzArm.look = V(600, ARM_Y - 60, 200);
    // pad workers at the bottom
    this.padCrew = [0, 1, 2].map((i) => { const P = makeFolk({ kind: 'coverall', coat: [0xe8e8e0, 0xd8a030, 0xe8e8e0][i], hat: 'hardhat', seed: 2250 + i }); P.g.position.set(LIFT.x + 2.5 + i * 0.9, PAD_Y - 0.6, LIFT.z + 4 + i * 0.6); P.g.rotation.y = -1.2 - i * 0.6; g.add(P.g); P.look = V(0, 60, 0); return P; });
    this.people.push(this.buzzArm, ...this.padCrew);
    this.addScene('pad', { group: g, bounds: 0.5, place: { lat: 28.6, year: 1969, sunLon: 114 }, amb: 0.45, fogFar: 6000, mist: 0.12,
      height: () => (this.s.at === 'lift' ? this.cage.position.y : this.s.at === 'arm' ? ARM_Y : this.s.at === 'deck' ? PAD_Y - 0.6 : 1.2),
      sky: () => {
        const s = this.s, el = -6 + 8 * ease(s.sun);
        this.G.sky.set(SUN_AZ, el); this.G.sky.setMoon(250, 26, 1, 0.12);
        this.key.position.set(Math.sin(SUN_AZ * D2R) * 400, 60 + el * 10, -Math.cos(SUN_AZ * D2R) * 400); this.key.target.position.set(0, 60, 0);
        this.key.intensity = 0.25 + 1.1 * ease(s.sun); this.key.color.setRGB(1, 0.78 + 0.1 * s.sun, 0.6 + 0.1 * s.sun);
        // the pad's floodlights, fading as the day comes
        this.lamp.position.set(30, 40, 30); this.lamp.intensity = 650 * (1 - 0.8 * s.sun); this.lamp.distance = 220; this.lamp.decay = 1.3; this.lamp.color.setHex(0xfff2dc);
      },
      exit: () => { this.key.color.setHex(0xffffff); this.lamp.decay = 1.4; },
      update: (dt, t) => {
        const s = this.s;
        this.padSea.userData.update?.(t);
        // the elevator: up 112 m, slowing at the top
        if (s.liftGo) { s.lift = Math.min(1, s.lift + dt * this.F / 30); }
        this.cage.position.y = LIFT.y0 + (ARM_Y - LIFT.y0) * (s.lift < 0.9 ? s.lift / 0.95 : 1 - (1 - s.lift) * (1 - 0.9 / 0.95) / 0.1);
        this.liftBtn.material.emissiveIntensity = s.want === 'lift' ? 0.6 + 0.6 * Math.sin(t * 6) : s.liftGo ? 1.0 : 0.3;
        // the mist thins as you climb out of it, and the shoreline crowds appear
        const camY = this.G.camera.getWorldPosition(_a).y;
        this.mists.forEach((m, i) => { m.visible = camY > m.position.y + 1; m.material.opacity = 0.5 * clamp01((camY - m.position.y) / 12); m.material.color.setRGB(0.85 + 0.15 * s.sun, 0.8 + 0.08 * s.sun, 0.82); m.position.x = Math.sin(t * 0.01 + i) * 30; });
        this.G.sky.mist = 0.32 * (1 - clamp01((camY - 10) / (CLOUD_Y - 10))) + 0.05;
        this.beach.visible = camY > CLOUD_Y;
        // venting: clouds tumbling down the sides, and puffs from the vents high up
        const v = this.vapor;
        this.vAcc = (this.vAcc || 0) + dt * 70; for (; this.vAcc >= 1; this.vAcc--) { const a = Math.random() * Math.PI * 2, y = PAD_Y + 4 + Math.random() * 100, r = y > PAD_Y + 80 ? 3.4 : 5.1;
          v.emit(Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a) * 1.6, -0.8 - Math.random() * 0.8, Math.sin(a) * 1.6, 2.5, 10 + Math.random() * 6, 6 + Math.random() * 3, 0xeef2f8, 0.42, 0.3, 0, -0.3); }
        if (Math.random() < dt * 1.5) for (let i = 0; i < 6; i++) v.emit(-3.8, PAD_Y + 79 + Math.random(), 1.2, -3 - Math.random(), 0.3, Math.random() - 0.5, 1.5, 9, 4, 0xffffff, 0.5, 0.4, 0, -0.4);
        v.update(this.G, dt, [0.6, 0.2]);
        // creaks and hisses
        if ((this.creakT = (this.creakT ?? 2) - dt) <= 0) { this.creakT = 2.5 + Math.random() * 4; creak(this.G, V(0, PAD_Y + 30 + Math.random() * 60, 0), 0.5); if (Math.random() < 0.5) vent(this.G, V(-4, PAD_Y + 80, 1), 0.3); }
        this.padCrew.forEach((P, i) => { P.pose = i === 1 ? 'point' : 'idle'; });
      } });
  }

  // ---------- 8. The white room ----------
  buildWhiteRoom() {
    const R = room(3.4, 3.2, 2.5, { floor: surfMat('tiles', '#e8e8e4'), wall: { n: surfMat('plaster', '#f4f4f0'), s: surfMat('plaster', '#f4f4f0'), e: surfMat('plaster', '#f4f4f0'), w: surfMat('plaster', '#f4f4f0') }, ceil: surfMat('plaster', '#f8f8f4'),
      doors: [{ side: 's', at: 0, w: 1.0, h: 0.9 }], windows: [{ side: 'e', at: 0.2, y: 1.2, w: 0.7, h: 0.5 }] });
    const g = R.group, k = new Kit();
    // the hatch side (south): the Command Module's silver skin filling the wall, the open hatch, the couches inside
    const skin = new THREE.MeshStandardMaterial({ map: canvasTex(512, 256, (c, w, h) => { c.fillStyle = '#c8ccd0'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 24) { c.fillStyle = x % 48 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)'; c.fillRect(x, 0, 12, h); } }), metalness: 0.6, roughness: 0.35 });
    const hull = quad(3.4, 2.5, skin); hull.position.set(0, 1.25, 1.62); hull.rotation.y = Math.PI; g.add(hull);
    g.remove(g.children.find((o) => o.isMesh && Math.abs(o.position.z - 1.6) < 0.01 && o.geometry.type === 'ShapeGeometry'));
    // the opening, framed; inside: dim green-grey, the couches and a lit panel
    const hk = new Kit(); hk.box(1.1, 0.08, 0.1, 0x8a8e92, [0, 1.4, 1.58]); hk.box(1.1, 0.08, 0.1, 0x8a8e92, [0, 0.46, 1.58]); for (const s of [-1, 1]) hk.box(0.08, 1.0, 0.1, 0x8a8e92, [s * 0.55, 0.93, 1.58]);
    hk.box(1.0, 0.9, 1.6, 0x3a4038, [0, 0.95, 2.45]); g.add(hk.mesh(FLAT));
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), new THREE.MeshBasicMaterial({ color: 0x0c0e0c })); hole.position.set(0, 0.93, 3.24); hole.rotation.y = Math.PI; g.add(hole);
    const couch = copy(M.apollo_couch, envMap('room'), 0.7); couch.scale.setScalar(0.8); couch.position.set(0, 0.55, 2.4); couch.rotation.y = Math.PI; g.add(couch);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.25), new THREE.MeshBasicMaterial({ color: 0x8a7a50 })); panel.position.set(0, 1.3, 3.2); panel.rotation.y = Math.PI; g.add(panel);
    // the hatch door, hinged on the left; it swings shut at the end
    const hinge = this.hatchHinge = new THREE.Group(); hinge.position.set(-0.55, 0, 1.52); g.add(hinge);
    const dk = new Kit(); dk.box(1.06, 0.98, 0.1, 0xb8bcc0, [0.53, 0.93, 0]); dk.box(0.2, 0.06, 0.05, 0x3a3a3a, [0.8, 0.93, -0.07]); dk.box(0.28, 0.2, 0.02, 0x1a2a3a, [0.53, 1.2, -0.06]); hinge.add(dk.mesh(FLAT));
    hinge.rotation.y = 1.7;
    // the room: equipment racks, a bench, a headset hook, a phone; a window east to the sea
    k.box(0.5, 1.8, 0.4, 0xd8dcd8, [-1.45, 0.9, -1.1]); k.box(0.48, 0.3, 0.02, 0x2a2a2a, [-1.45, 1.3, -0.89]);
    k.box(1.4, 0.45, 0.4, 0xc8c8c0, [0.6, 0.225, -1.35]);
    k.box(0.2, 0.3, 0.12, 0x2a2a2a, [1.62, 1.4, -0.6]);
    g.add(k.mesh(FLAT));
    const sky = quad(2.5, 1.5, new THREE.MeshBasicMaterial({ fog: false, map: canvasTex(256, 160, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6a8ac8'); gr.addColorStop(0.55, '#f0c8a0'); gr.addColorStop(0.58, '#3a5a7a'); gr.addColorStop(1, '#2a4a6a'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,240,200,0.9)'; c.beginPath(); c.arc(w * 0.6, h * 0.5, 10, 0, 7); c.fill(); }) }));
    sky.position.set(2.6, 1.45, 0.2); sky.rotation.y = -Math.PI / 2; g.add(sky);
    // Guenter Wendt, a technician, Neil
    this.wendt = person(g, 'wendt', V(0.7, 0, 0.5), -Math.PI / 2 - 0.3); this.wendt.look = V(-0.3, 1.7, 0.4);
    this.tech2 = makeFolk({ kind: 'coverall', coat: 0xf4f4f0, hat: 'cap', seed: 2261 }); this.tech2.g.position.set(0.9, 0, 1.1); this.tech2.g.rotation.y = -2.4; g.add(this.tech2.g); this.tech2.look = V(0, 1.4, 1.5);
    this.neilW = person(g, 'armstrong', V(-0.2, 0, 0.55), Math.PI / 2 + 0.2); this.neilHelmet = wear(this.neilW, copy(M.helmet_apollo), { lift: -0.05, size: 1 }); this.neilW.look = V(0.7, 1.7, 0.5);
    // the key to the Moon: a big foam key with a crescent Moon on its bow
    const kk = new Kit(); kk.cyl(0.018, 0.018, 0.38, 8, 0xe8e4d8, [0, 0.19, 0]); kk.box(0.07, 0.03, 0.02, 0xe8e4d8, [0.035, 0.02, 0]); kk.box(0.05, 0.03, 0.02, 0xe8e4d8, [0.025, 0.07, 0]);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 20), new THREE.MeshLambertMaterial({ color: 0xe8e4d8 })); bow.position.y = 0.45;
    const key = this.moonKey = new THREE.Group(); key.add(kk.mesh(FLAT)); key.add(bow);
    const cres = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20, 0.6, 4.4), new THREE.MeshLambertMaterial({ color: 0xd8b040, side: THREE.DoubleSide })); cres.position.set(0, 0.45, 0.02); key.add(cres);
    holdProp(this.wendt, key, 'Right', [0, 0.05, 0.03]); key.visible = false;
    this.ticket = picture(0.16, 0.08, (c, w, h) => { c.fillStyle = '#f0e8c8'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1a1a'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('SPACE TAXI', w / 2, h * 0.36); c.font = '13px sans-serif'; c.fillText('Good between', w / 2, h * 0.62); c.fillText('any two planets', w / 2, h * 0.84); }, { frame: 0xd8c890, px: 256 });
    this.ticket.visible = false;
    this.people.push(this.wendt, this.tech2, this.neilW);
    this.addScene('white', { group: g, bounds: 0.4, indoors: true, place: { lat: 28.6, year: 1969, sunLon: 114 }, amb: 0.1, fogFar: 300,
      sky: () => { this.G.sky.set(SUN_AZ, 6); this.lamp.position.set(0, 2.3, 0); this.lamp.intensity = 2.4; this.lamp.distance = 6; this.lamp.color.setHex(0xf8f8ff); this.lamp2.position.set(0, 1.2, 2.6); this.lamp2.intensity = 0.4; this.lamp2.distance = 2.5; this.lamp2.color.setHex(0xd8f0d0); },
      update: (dt) => {
        const s = this.s;
        this.wendt.pose = s.key === 1 ? 'hold' : 'talk'; this.neilW.pose = s.ticket === 1 ? 'hold' : 'idle';
        this.moonKey.visible = s.key > 0;
        if (s.key === 2 && this.moonKey.parent !== this.neilKeyHand) { dropProp(this.wendt); holdProp(this.neilW, this.moonKey, 'Left', [0, 0.05, 0.03]); this.neilKeyHand = this.moonKey.parent; }
        if (s.ticket === 1 && !this.ticket.visible) { this.ticket.visible = true; holdProp(this.neilW, this.ticket, 'Right', [0, 0.06, 0.03]); }
        if (s.ticket === 2 && this.ticket.parent && this.ticketTo !== 'wendt') { dropProp(this.neilW, 'Right'); holdProp(this.wendt, this.ticket, 'Right', [0, 0.06, 0.03]); this.ticketTo = 'wendt'; }
        // Neil climbs in: steps to the hatch and is gone
        if (s.inside) { this.inK = Math.min(1, (this.inK || 0) + dt * this.F / 3); this.neilW.g.position.lerpVectors(V(-0.2, 0, 0.55), V(0, 0, 1.4), this.inK); this.neilW.g.rotation.y = 0; this.neilW.pose = 'walk'; if (this.inK >= 1) this.neilW.g.visible = false; }
        this.hatchHinge.rotation.y = damp(this.hatchHinge.rotation.y, s.hatch ? 0 : 1.7, 1.6, dt);
        this.tech2.pose = s.hatch ? 'work' : 'idle';
      } });
  }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast;
    // 1. The crew quarters
    await this.go(D, 'quarters', yawTo(92), 0.1, { x: -1.4, z: 1.2 });
    s.guide = [-1.6, 2.0, -1.0];
    await D.say('ch22_01');
    s.door = 1; click(G, V(1.3, 1, 2), 0.2);
    await D.wait(fast ? 0.3 : 1.2);
    s.wake = 1; click(G, V(0.15, 0.9, -1.6), 0.15);
    await D.say('ch22_02');
    await D.wait(fast ? 0.3 : 1.5);
    // 2. Breakfast
    await this.go(D, 'mess', yawTo(0), 1.0, { x: 0, z: 1.6 });
    s.guide = [-2.0, 2.0, 0.6];
    await D.say('ch22_03');
    await D.wait(fast ? 0.3 : 2);
    // 3. The suit room
    s.helmets = 0; s.hiss = 0;
    await this.go(D, 'suitroom', yawTo(0), 1.0, { x: 0, z: 1.7 });
    s.guide = [-2.4, 2.0, 0.6];
    const l4 = D.sayAsync('ch22_04');
    await D.cue('Gloves'); clank(G, V(0, 1, -0.6), 0.12);
    await D.cue('Helmets'); for (let i = 1; i <= 3; i++) { s.helmets = i; clank(G, V(this.lounges[i - 1], 1.3, -0.6), 0.2); await D.wait(fast ? 0.1 : 0.45); }
    await D.cue('hiss'); s.hiss = 1; hiss(G, V(0, 1.2, -0.6), 0.3, 2.5);
    await l4;
    await D.wait(fast ? 0.3 : 1.5);
    // 4. Out to the van
    s.walk = 0;
    await this.go(D, 'van', yawTo(bearing(0 - 5.5, -10 - 1)), 1.0, { x: 5.5, z: 1 });
    s.guide = [7, 2.6, -1.5];
    await D.wait(fast ? 0.2 : 0.6);
    s.walk = 1; applause(G, V(0, 1.5, -8), 6, 0.3);
    await D.say('ch22_05');
    await D.wait(fast ? 0.5 : 4);
    s.walk = 0;
    // 5. The pad at dawn
    s.at = 'ground'; s.sun = 0; s.lift = 0; s.liftGo = 0; this.vapor.clear();
    await this.go(D, 'pad', yawTo(bearing(0 - 30, 0 - 46)), 1.4, { x: 30, z: 46 });
    s.guide = [25, 6, 42];
    await D.say('ch22_06');
    await D.wait(fast ? 0.5 : 3);
    // the elevator
    s.at = 'lift';
    await this.go(D, 'pad', yawTo(200), 1.0, { x: LIFT.x - 0.2, z: LIFT.z + 0.3 });
    s.guide = [LIFT.x - 1.6, LIFT.y0 + 2.4, LIFT.z + 2.2];
    await D.say('ch22_07');
    if (!D.kids) await D.say('ch22_08');
    await this.ask(D, 'lift', { hint: this.liftIt.hint, deskHint: this.liftIt.deskHint, after: 1.2, timeout: 20 });
    click(G, this.liftBtn.getWorldPosition(new THREE.Vector3()), 0.2); beep(G, null, 0.08, 800, 0.2);
    s.liftGo = 1; clank(G, null, 0.2);
    // up through the mist, then the Sun comes up over the sea
    await D.until(() => this.cage.position.y > CLOUD_Y + 8 || s.lift >= 1);
    s.sunGo = 1;
    this.guideTo(V(LIFT.x + Math.sin(SUN_AZ * D2R) * 30, this.cage.position.y + 6, LIFT.z - Math.cos(SUN_AZ * D2R) * 30), 0, 0);
    const l9 = D.sayAsync('ch22_09');        // the music begins here
    for (let i = 0; i < 200 && s.sun < 1; i++) { s.sun = Math.min(1, s.sun + (fast ? 0.2 : 0.03)); this.guideTo(V(LIFT.x + Math.sin(SUN_AZ * D2R) * 20, this.cage.position.y + 4, LIFT.z - Math.cos(SUN_AZ * D2R) * 20), 0, 0); await D.wait(0.2); }
    await l9;
    await D.until(() => s.lift >= 1);
    clank(G, null, 0.25);
    await D.wait(fast ? 0.3 : 1.2);
    // 6. On the access arm
    s.at = 'arm';
    await this.go(D, 'pad', yawTo(180), 0.8, { x: -0.3, z: -10.6 });
    s.guide = [-1.4, ARM_Y + 2.2, -8.4];
    await D.say('ch22_10');
    this.guideTo(V(300, ARM_Y - 20, 120), 0, 0);
    await D.wait(fast ? 0.3 : 3);
    // 7. Rice Stadium, 1962
    s.film = 1;
    await this.go(D, 'stadium', 0, 0.8, { x: 0, z: 0 });
    s.guide = [-6, 4.5, -4]; s.kennedy = 1;
    await D.say('ch22_11');
    s.kennedy = 0; s.applause = 1; await D.wait(fast ? 0.3 : 1.2); s.applause = 0;
    s.film = 0;
    // 8. The white room
    s.key = 0; s.ticket = 0; s.inside = 0; s.hatch = 0;
    await this.go(D, 'white', yawTo(120), 0.8, { x: -1.25, z: -1.1 });
    s.guide = [-1.2, 2.0, -1.2];
    await D.say('ch22_12');
    s.key = 1;
    await D.say('ch22_13');
    s.key = 2;
    s.ticket = 1;
    await D.say('ch22_14');
    s.ticket = 2;
    await D.wait(fast ? 0.3 : 1.2);
    s.inside = 1;
    const l15 = D.sayAsync('ch22_15');
    await D.cue('hatch'); s.hatch = 1;
    await D.wait(fast ? 0.2 : 1.3); clank(G, V(0, 1, 1.5), 0.4);
    await l15;
    await D.wait(fast ? 0.5 : 2.5);
  }
}
