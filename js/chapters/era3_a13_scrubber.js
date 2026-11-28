// Era 3, Apollo 13 part 4 (n 33): Square Peg, Round Hole. 15-16 April 1970.
//
// 1. In cold, dim Aquarius, the air is turning bad (problem 9): the carbon dioxide gauge creeps up,
//    the warning light comes on. Odyssey's spare filters are square; Aquarius's holders are round.
// 2. A back room in Houston, the problem board on the wall: Ed Smylie's team tip a box of everything
//    on board onto the table (the music starts) - bags, flight-plan card, a sock, hoses, grey tape -
//    and build the "mailbox".
// 3. Back in Aquarius, the steps come up over the radio and Swigert and Haise build it (Adults pick
//    up each glowing piece in turn). The warning light goes out and the gauge falls. Tick.
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { person } from '../era3/folk.js';
import { loadAll } from '../era3/craft.js';
import { cabin, panelLamp, dressCabin } from '../era3/cabin.js';
import { click, beep } from '../era3/fx.js';
import { Apollo13, backRoom, cueNth, coldCabin } from '../era3/a13.js';
import { holdProp } from '../people.js';
import { glowSprite } from '../wow/fx.js';
import { canvasTex, lerp } from '../util.js';
import { rng } from '../shapes.js';

await loadAll(['props/dsky', 'props/hand_controller']);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const EYE = V(0, 1.6, 0);

// ---------- The "mailbox": a square filter in a box of flight-plan card, wrapped in a bag, a hose taped in ----------
// Returns { group, parts: [{ obj, home: Vector3, homeRot: Euler, name }] } in the order they go on.
function mailbox() {
  const g = new THREE.Group(), parts = [];
  const add = (obj, name, pos, rot = [0, 0, 0]) => { obj.position.set(...pos); obj.rotation.set(...rot); g.add(obj); parts.push({ obj, name, home: obj.position.clone(), homeRot: obj.rotation.clone() }); return obj; };
  // the square filter (Odyssey's: white, with a red stripe and a grille)
  const fk = new Kit(); fk.box(0.22, 0.22, 0.14, 0xe8e6e0, [0, 0, 0]); fk.box(0.23, 0.02, 0.15, 0xc83030, [0, 0.08, 0]); for (let i = 0; i < 5; i++) fk.box(0.18, 0.006, 0.005, 0x8a8a8a, [0, -0.06 + i * 0.03, 0.072]);
  const filt = fk.mesh(FLAT);
  // a box of card round it (the flight plan's covers), printed on
  const cardT = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a3a3a'; c.font = '10px monospace'; for (let i = 0; i < 9; i++) c.fillText('APOLLO 13 FLIGHT PLAN', 4, 14 + i * 13); });
  const cm = new THREE.MeshStandardMaterial({ map: cardT, roughness: 0.95 });
  const card = new THREE.Group(); for (const [x, y, w, h] of [[-0.125, 0, 0.01, 0.24], [0.125, 0, 0.01, 0.24], [0, 0.125, 0.26, 0.01], [0, -0.125, 0.26, 0.01]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), cm); m.position.set(x, y, 0.02); card.add(m); }
  // the plastic bag over it all
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3, 3, 3, 3), new THREE.MeshStandardMaterial({ color: 0xe8f0f8, transparent: true, opacity: 0.32, roughness: 0.2, depthWrite: false }));
  { const p = bag.geometry.attributes.position, r = rng(3); for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.92 + r() * 0.12), p.getY(i) * (0.92 + r() * 0.12), p.getZ(i) * (0.92 + r() * 0.12)); bag.geometry.computeVertexNormals(); }
  // the suit hose, taped into the bag
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0.15), V(0, -0.05, 0.3), V(0.1, -0.2, 0.4), V(0.25, -0.3, 0.42)]);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.022, 8), new THREE.MeshStandardMaterial({ color: 0x5a6a8a, roughness: 0.7 }));
  // grey tape: strips round the edges
  const tk = new Kit(); for (const [x, y, w, h] of [[0, 0.15, 0.32, 0.04], [0, -0.15, 0.32, 0.04], [0.15, 0, 0.04, 0.32], [-0.15, 0, 0.04, 0.32]]) tk.box(w, h, 0.31, 0x8a8c8e, [x, y, 0]); tk.box(0.08, 0.08, 0.04, 0x8a8c8e, [0, 0, 0.16]);
  const tape = tk.mesh(FLAT);
  add(filt, 'filter', [0, 0, 0]); add(card, 'card', [0, 0, 0]); add(hose, 'hose', [0, 0, 0]); add(bag, 'bag', [0, 0, 0]); add(tape, 'tape', [0, 0, 0]);
  return { group: g, parts };
}
// the gauge: carbon dioxide's partial pressure, 0-15 mm of mercury (red past 7.6)
function drawGauge(c, w, h, v) {
  c.fillStyle = '#1a1a1c'; c.fillRect(0, 0, w, h); c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(w / 2, h * 0.62, w * 0.42, 0, 7); c.fill();
  const a0 = Math.PI * 1.15, a1 = Math.PI * 1.85, at = (x) => lerp(a0, a1, x / 15);
  c.lineWidth = 8; c.strokeStyle = '#c83020'; c.beginPath(); c.arc(w / 2, h * 0.62, w * 0.36, at(7.6), a1); c.stroke();
  c.strokeStyle = '#e8e8e0'; c.lineWidth = 3; for (let i = 0; i <= 15; i++) { const a = at(i), r0 = w * (i % 5 ? 0.33 : 0.3); c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * r0, h * 0.62 + Math.sin(a) * r0); c.lineTo(w / 2 + Math.cos(a) * w * 0.38, h * 0.62 + Math.sin(a) * w * 0.38); c.stroke(); }
  c.fillStyle = '#e8e8e0'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('CO2', w / 2, h * 0.86); c.font = '12px sans-serif'; c.fillText('0', w * 0.17, h * 0.52); c.fillText('15', w * 0.83, h * 0.52);
  const a = at(Math.min(15, v)); c.strokeStyle = '#f0f0f0'; c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2, h * 0.62); c.lineTo(w / 2 + Math.cos(a) * w * 0.34, h * 0.62 + Math.sin(a) * w * 0.34); c.stroke();
}

export default class A13Scrubber extends Apollo13 {
  constructor(G) {
    super(G, 33);
    this.start = { pos: V(0, 0, 0), yaw: 0 };
    Object.assign(this.s, { co2: 0.3, warn: 0, tip: 0, build: 0, step: 0 });
    this.buildAquarius(); this.buildTable();
  }

  // ---------- Aquarius, cold and dim ----------
  buildAquarius() {
    const g = new THREE.Group();
    const C = this.Ca = cabin('lm'); g.add(C.group);
    dressCabin(C);
    this.lovA = person(C.group, 'lovell', C.crew[0].pos.clone(), 0.25);
    this.haiA = person(C.group, 'haise', C.crew[1].pos.clone(), -0.25);
    this.swiA = person(C.group, 'swigert', V(-0.25, 0.0, 0.25), 0.3);
    this.people.push(this.lovA, this.haiA, this.swiA);
    // the CO2 gauge and its warning light, on the front panel by the right window
    this.gTex = canvasTex(128, 128, (c, w, h) => drawGauge(c, w, h, 0));
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: this.gTex, toneMapped: false })); gm.position.set(0.42, 1.05, -0.77); C.group.add(gm);
    this.warnL = panelLamp(0.12, 0.04, { text: 'CO2 HIGH', col: '#d88010', font: 'bold 30px sans-serif' }); this.warnL.position.set(0.42, 1.18, -0.77); C.group.add(this.warnL);
    // the round holder in Aquarius (a can on the wall) and a square spare from Odyssey
    const rk = new Kit(); rk.cyl(0.1, 0.1, 0.3, 20, 0xb8bcc0, [0, 0, 0]); rk.cyl(0.105, 0.105, 0.03, 20, 0x5a5a5a, [0, 0.15, 0]); rk.cyl(0.07, 0.07, 0.31, 16, 0x2a2a2a, [0, 0.0, 0]);
    this.roundCan = rk.mesh(FLAT); this.roundCan.position.set(-0.95, 0.75, -0.15); this.roundCan.rotation.z = 0.2; C.group.add(this.roundCan);
    // the mailbox, built here piece by piece (each piece glows and waits until it's its turn)
    const MB = this.mbA = mailbox(); MB.group.position.set(0.05, 1.12, -0.42); MB.group.rotation.set(-0.3, 0.2, 0); C.group.add(MB.group);
    this.loose = MB.parts.map((p, i) => { const r = rng(40 + i); const from = V(-0.5 + i * 0.25, -0.1 + r() * 0.2, 0.15 + r() * 0.2); return { ...p, from, k: i === 0 ? 1 : 0, glow: (() => { const s = glowSprite(0x80d0ff, 0.35, 0); MB.group.add(s); return s; })() }; });
    this.pieceIt = this.touchable('piece', () => { const p = this.loose[this.s.step]; return p ? p.obj.getWorldPosition(new THREE.Vector3()) : V(0, -9, 0); }, { hint: 'Pick up the glowing piece', deskHint: 'Click the glowing piece', r: 0.16 });
    this.coldFn = coldCabin(C, g, () => [this.lovA, this.haiA, this.swiA].map((P) => P.g.localToWorld(V(0, 1.62, 0.12))));
    this.addScene('aquarius', { group: g, bounds: 0.25, indoors: true, airless: true, amb: 0, fogFar: 9000,
      enter: () => { this.G.sky.set(200, -40); },
      update: (dt, t) => {
        const s = this.s;
        C.lights(true, 0.16);
        this.key.position.set(3, 4, -5); this.key.target.position.set(0, 1.4, 0); this.key.intensity = 0.25;
        this.coldFn(dt, t, 0.8);
        if (s.fallT != null) s.co2 = lerp(0.62, 0.15, clamp01((this.t - s.fallT) / (this.fast ? 0.5 : 4)));
        if ((this.gAcc = (this.gAcc || 0) + dt) > 0.1) { this.gAcc = 0; drawGauge(this.gTex.image.getContext('2d'), 128, 128, s.co2 * 15); this.gTex.needsUpdate = true; }
        this.warnL.userData.set('CO2 HIGH', '#d88010', s.warn && Math.sin(t * 6) > -0.3);
        // the pieces: drifting loose until it's their turn, then floating into place
        this.loose.forEach((p, i) => {
          if (!s.build) { p.obj.visible = i === 0; p.obj.position.copy(p.home); p.glow.material.opacity = 0; return; }
          p.obj.visible = true;
          if (i < s.step) p.k = Math.min(1, p.k + dt * this.F * 0.8); else if (i > 0) p.k = 0;
          const loose = p.from.clone().add(V(Math.sin(t * 0.6 + i) * 0.02, Math.sin(t * 0.5 + i * 2) * 0.02, 0));
          p.obj.position.lerpVectors(loose, p.home, ease(p.k)); p.obj.rotation.set(p.homeRot.x + (1 - p.k) * Math.sin(t * 0.4 + i), p.homeRot.y + (1 - p.k) * (t * 0.3 + i), p.homeRot.z);
          p.glow.position.copy(p.obj.position); p.glow.material.opacity = i === s.step && s.step < this.loose.length ? 0.5 + 0.35 * Math.sin(t * 5) : 0;
        });
        const building = s.build && s.step < this.loose.length;
        this.swiA.pose = building ? 'work' : s.swiTalk ? 'talk' : 'idle'; this.haiA.pose = building ? 'work' : 'idle';
        this.swiA.look = this.haiA.look = this.mbA.group.getWorldPosition(new THREE.Vector3());
        this.lovA.look = s.warn ? V(0.42, 1.1, -0.77) : V(0, 1.4, -0.6); this.lovA.pose = 'idle';
      } });
  }

  // ---------- Houston: the table ----------
  buildTable() {
    const B = backRoom(this, 'table', this.board), g = B.g;
    this.smylie = person(g, 'ed_smylie', V(0.3, 0, -1.25), 0);
    this.eng = [['eng_white_shirt', -1.0, -1.2, 0.2], ['eng_blue_shirt', 1.5, -0.9, -0.6], ['eng_black', -1.7, 0.4, 1.9], ['eng_white_shirt', 2.0, 0.5, Math.PI + 0.9]].map(([w, x, z, yaw]) => person(g, w, V(x, 0, z), yaw));
    this.people.push(this.smylie, ...this.eng);
    // the box, and everything in it, about to be tipped out
    const bk = new Kit(); bk.box(0.5, 0.35, 0.4, 0xb8946a, [0, 0.175, 0]); bk.box(0.46, 0.02, 0.36, 0x8a6a4a, [0, 0.34, 0]);
    this.box = new THREE.Group(); this.box.add(bk.mesh(FLAT)); this.box.position.set(-0.6, 0.77, -0.1); g.add(this.box);
    const r = rng(9), stuff = [];
    const bagM = new THREE.MeshStandardMaterial({ color: 0xe8f0f8, transparent: true, opacity: 0.35, roughness: 0.2, depthWrite: false });
    const mk = (geo, mat, rest) => { const m = new THREE.Mesh(geo, mat); g.add(m); stuff.push({ m, rest, rot: V(r() * 3, r() * 3, r() * 3) }); return m; };
    for (let i = 0; i < 3; i++) mk(new THREE.BoxGeometry(0.28, 0.02, 0.22), bagM, V(-0.2 + i * 0.3, 0.79, 0.1 - i * 0.12));
    const cardT = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a2a2a'; c.font = 'bold 14px sans-serif'; c.fillText('FLIGHT PLAN', 10, 30); c.font = '10px monospace'; for (let i = 0; i < 6; i++) c.fillText('APOLLO 13', 10, 52 + i * 12); });
    for (let i = 0; i < 2; i++) mk(new THREE.BoxGeometry(0.22, 0.006, 0.3), new THREE.MeshStandardMaterial({ map: cardT, roughness: 0.95 }), V(0.35 + i * 0.25, 0.78, -0.25 + i * 0.1));
    mk(new THREE.CapsuleGeometry(0.03, 0.18, 4, 8), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 1 }), V(0.9, 0.79, 0.15));   // the sock
    const hc = new THREE.CatmullRomCurve3([V(-0.2, 0, 0), V(0, 0, 0.1), V(0.2, 0, 0)]);
    for (let i = 0; i < 2; i++) mk(new THREE.TubeGeometry(hc, 12, 0.02, 8), new THREE.MeshStandardMaterial({ color: 0x5a6a8a, roughness: 0.7 }), V(-0.1 + i * 0.5, 0.79, 0.3));
    mk(new THREE.TorusGeometry(0.045, 0.025, 8, 16), new THREE.MeshStandardMaterial({ color: 0x8a8c8e, roughness: 0.6 }), V(0.6, 0.8, 0.3));   // the tape
    const fk = new Kit(); fk.box(0.22, 0.22, 0.14, 0xe8e6e0, [0, 0, 0]); fk.box(0.23, 0.02, 0.15, 0xc83030, [0, 0.08, 0]);
    const filt = fk.mesh(FLAT); g.add(filt); stuff.push({ m: filt, rest: V(0.15, 0.88, -0.35), rot: V(0, 0.4, 0) });
    this.stuff = stuff;
    // the finished mailbox, appearing as they build it
    const MB = this.mbT = mailbox(); MB.group.position.set(0.2, 0.95, -0.45); MB.group.rotation.set(-0.2, -0.4, 0); MB.group.scale.setScalar(0.95); g.add(MB.group);
    this.scenes.table.update = (dt, t) => {
      const s = this.s;
      this.tipK = s.tip ? clamp01((this.tipK || 0) + dt * this.F / 1.6) : 0;
      this.box.rotation.z = -ease(this.tipK) * 2.0; this.box.position.y = 0.77 + Math.sin(ease(this.tipK) * Math.PI) * 0.1;
      const mouth = this.box.localToWorld(V(0, 0.3, 0)); this.box.parent.worldToLocal(mouth);
      stuff.forEach((q, i) => { const k = clamp01(this.tipK * 1.6 - i * 0.06); q.m.visible = this.tipK > 0.15 && !(s.built && i === stuff.length - 1);
        q.m.position.lerpVectors(mouth, q.rest, ease(k)); q.m.position.y += Math.sin(Math.PI * k) * 0.12; q.m.rotation.set(q.rot.x * (1 - k), q.rot.y, q.rot.z * (1 - k)); });
      this.mbK = s.built ? clamp01((this.mbK || 0) + dt * this.F / 6) : 0;
      MB.parts.forEach((p, i) => { p.obj.visible = this.mbK > i / MB.parts.length; });
      this.smylie.pose = s.smTalk ? 'talk' : s.built ? 'work' : 'idle'; this.smylie.look = V(0, 0.9, -0.2);
      this.eng.forEach((P, i) => { P.pose = s.built ? (i % 2 ? 'work' : 'point') : s.tip ? 'gasp' : 'idle'; P.look = V(0.2, 0.85, -0.2); });
    };
  }

  async run(D) {
    const G = this.G, s = this.s, fast = this.fast, B = this.board;
    Object.assign(s, { co2: 0.3, warn: 0, tip: 0, build: 0, step: 0, built: 0, swiTalk: 0, smTalk: 0, fallT: null }); this.tipK = 0; this.mbK = 0;
    this.loose.forEach((p, i) => { p.k = i === 0 ? 1 : 0; });
    // 1. The air
    await this.go(D, 'aquarius', 0, 0.1, { x: 0, z: 0 });
    s.guide = [0.6, 2.0, -0.5];
    const l1 = D.sayAsync('ch33_01');
    await D.cue('Problem nine'); B.card(8);
    const t0 = this.t;
    await D.until(() => { s.co2 = lerp(0.3, 0.62, clamp01((this.t - t0) / (fast ? 1 : 8))); if (s.co2 > 0.5 && !s.warn) { s.warn = 1; beep(G, null, 0.08, 1400); } return this.t - t0 > (fast ? 1 : 8); });
    await l1;
    await D.say('ch33_02');
    // 2. Houston: the table (the music starts)
    await this.go(D, 'table', 0, 0.8, { x: 0, z: 1.8 });
    s.guide = [-1.6, 2.4, -1.5];
    const l3 = D.sayAsync('ch33_03');
    await D.cue('tip a box'); s.tip = 1; click(G, null, 0.2);
    await l3;
    s.smTalk = 1; await D.say('ch33_04'); s.smTalk = 0;
    s.built = 1;
    await D.say('ch33_05');
    await D.wait(fast ? 0.3 : 2);
    // 3. Building it in Aquarius
    await this.go(D, 'aquarius', 0, 0.8, { x: 0, z: 0 });
    s.guide = [0.6, 2.0, -0.5];
    s.build = 1; s.step = 1;
    if (!D.kids) await D.say('ch33_06');
    const l7 = D.sayAsync('ch33_07');
    for (let i = 1; i < this.loose.length; i++) {
      s.step = i;
      if (!D.kids) await this.ask(D, 'piece', { hint: this.pieceIt.hint, deskHint: this.pieceIt.deskHint, after: 1, timeout: 15 });
      else await D.wait(fast ? 0.4 : 2.2);
      s.step = i + 1; click(G, null, 0.12);
      await D.wait(fast ? 0.2 : 1.0);
    }
    await l7;
    const l8 = D.sayAsync('ch33_08');
    await D.cue('warning light goes out'); s.warn = 0;
    s.fallT = this.t;
    await cueNth(D, 'ch33_08', 'Tick'); B.tick(8);
    await l8;
    await D.wait(fast ? 0.5 : 3);
  }
}
