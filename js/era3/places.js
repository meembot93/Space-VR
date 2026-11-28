// Places that come back in several Era 3 chapters, built the same way each time so they feel like
// the same rooms: von Braun's office in Huntsville, Alabama; Rice Stadium, Houston (Kennedy's speech).
import * as THREE from 'three';
import { Kit, FLAT } from '../kit.js';
import { canvasTex, damp } from '../util.js';
import { person, makeFolk, sit, Crowd } from './folk.js';
import { loadProps } from '../props.js';
import { rng } from '../shapes.js';
import { loadE3, copy } from './craft.js';
import { room, surfMat, quad, desk, chair, shelf, deskLamp, picture } from './sets.js';
import { texSolid } from '../surfaces.js';
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Von Braun's office: a desk under two windows looking out on the green hills of north Alabama, his
// rocket models on the shelf, a blackboard of sums, the flag. He stands at the window (ch.vb); set
// ch.s.vbTurn = 1 and he turns to talk to you. You stand at (0, 1.2) facing north.
export function vbOffice(ch, name = 'office', { year = 1958, sunLon = 300, boardLine = 'Juno I: 4 stages' } = {}) {
    const R = room(5.6, 5, 3.0, { floor: surfMat('lino', '#7a7268'), wall: { n: surfMat('plaster', '#d8d4c4'), s: surfMat('panelwood'), e: surfMat('panelwood'), w: surfMat('panelwood') }, ceil: surfMat('acoustic'), windows: [{ side: 'n', at: -1.2, y: 0.9, w: 1.4, h: 1.5 }, { side: 'n', at: 1.2, y: 0.9, w: 1.4, h: 1.5 }], doors: [{ side: 'e', at: 1.6, w: 0.9, h: 2.1 }], skirt: 0x2a2018 });
    const g = R.group, k = new Kit();
    desk(k, 0, -1.2, Math.PI, { w: 1.7, d: 0.85, col: 0x5a3a22 });
    chair(k, 0, -1.95, Math.PI, { seat: 0x3a2a22 });
    for (const x of [-0.6, 0.6]) chair(k, x, 0.3, 0, { seat: 0x6a4a2a });
    shelf(k, -2.65, -0.6, Math.PI / 2, { w: 1.6, h: 2.0, seed: 11 });
    const dl = deskLamp(k, -0.65, 0.76, -1.45, 0.3);
    k.box(0.4, 0.02, 0.3, 0xe8e4d8, [0.2, 0.775, -1.1]); k.box(0.3, 0.015, 0.22, 0xd8d0b8, [-0.2, 0.775, -0.95], [0, 0.3, 0]);   // papers
    k.cyl(0.04, 0.035, 0.1, 8, 0xe8e8e0, [0.55, 0.81, -1.05]);   // a coffee cup
    // a blackboard of trajectory sums on the south wall, a US flag on a pole
    k.box(2.2, 1.2, 0.04, 0x2a3a2e, [0.6, 1.6, 2.47]); k.box(2.3, 0.05, 0.1, 0x6a4a2a, [0.6, 0.98, 2.42]);
    k.cyl(0.02, 0.02, 2.4, 6, 0xc8a050, [2.4, 1.2, -2.1]);
    g.add(k.mesh(FLAT));
    const flag = picture(0.9, 0.55, (c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f0f0f0' : '#b82a2a'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#2a3a7a'; c.fillRect(0, 0, w * 0.42, h * 0.54); c.fillStyle = '#fff'; for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) c.fillRect(6 + x * 13, 5 + y * 12, 3, 3); }, { frame: 0xc8a050 });
    flag.position.set(2.15, 2.05, -2.1); flag.rotation.y = -0.6; g.add(flag);
    const board = picture(2.1, 1.1, (c, w, h) => { c.fillStyle = '#2a3a2e'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(240,240,230,0.85)'; c.fillStyle = 'rgba(240,240,230,0.85)'; c.lineWidth = 2; c.font = '15px serif'; c.fillText('v = √(GM / r)', 20, 30); c.fillText('Δv ≈ 7.9 km/s', 20, 60); c.fillText(boardLine, 20, 90); c.beginPath(); c.arc(170, 75, 40, 0, 7); c.stroke(); c.beginPath(); c.ellipse(170, 75, 62, 52, 0.3, 0, 7); c.stroke(); c.fillText('Explorer', 210, 40); });
    board.position.set(0.6, 1.6, 2.44); board.rotation.y = Math.PI; g.add(board);
    // rocket models on the shelf and the desk: his V-2, the Redstone, the Juno
    Promise.all([loadE3('craft/juno1'), loadE3('craft/mercury_redstone'), loadE3('craft/saturn_s1c')]).then(([a, b, c]) => { for (const [MM, x, y, z, h] of [[a, -2.55, 1.46, -1.15, 0.5], [b, -2.55, 1.1, -0.2, 0.45], [year > 1962 ? c : null, -2.55, 0.74, 0.3, 0.3]]) { if (!MM) continue; const o = copy(MM); o.scale.setScalar(h / MM.size.y); o.position.set(x, y, z); g.add(o); } });
    // outside: the green hills of north Alabama in the spring sun
    const hills = canvasTex(1024, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9ac0e0'); gr.addColorStop(0.55, '#d8e8f0'); gr.addColorStop(0.56, '#6a8a4a'); gr.addColorStop(1, '#4a6a32'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#5a7a42'; c.beginPath(); c.moveTo(0, h * 0.6); for (let x = 0; x <= w; x += 32) c.lineTo(x, h * 0.5 - Math.sin(x / 90) * 18 - Math.sin(x / 37) * 6); c.lineTo(w, h); c.lineTo(0, h); c.fill(); c.fillStyle = '#8a8a80'; c.fillRect(620, h * 0.36, 10, 50); c.fillRect(600, h * 0.44, 50, 6); c.fillStyle = '#e8e8e0'; c.fillRect(640, h * 0.3, 6, 46); });
    const bd = new THREE.Mesh(new THREE.PlaneGeometry(60, 15), new THREE.MeshBasicMaterial({ map: hills })); bd.position.set(0, 2, -24); g.add(bd);
    ch.vb = person(g, 'von_braun', V(1.2, 0, -2.0), Math.PI);
    ch.people.push(ch.vb);
    ch.addScene(name, { group: g, bounds: 1.2, place: { lat: 34.7, year, sunLon }, amb: 0.05, fogFar: 400,
      sky: () => { ch.G.sky.set(160, 30); ch.G.sky.sunLight.intensity *= 0.35; ch.G.sky.hemi.intensity *= 0.8; ch.lamp.position.copy(dl); ch.lamp.intensity = 0.8; ch.lamp.distance = 5; },
      update: (dt, t) => { ch.vb.look = ch.s.vbTurn ? V(0, 1.6, 0.8) : V(1.2, 1.6, -6); ch.vb.g.rotation.y = damp(ch.vb.g.rotation.y, ch.s.vbTurn ? 0.3 : Math.PI, 2, dt); ch.vb.pose = ch.s.vbTurn ? 'talk' : 'idle'; } });
  return g;
}

// ---------- Rice Stadium, Houston, 12 September 1962 ----------
// The speakers' stand on the field, Kennedy at the lectern (ch.rice.jfk), Glenn and von Braun sitting
// behind him, the hot crowd fanning itself in the stands, the pale Moon over the east stand. Used in
// the faded-film flashbacks. You stand on the field at (0, 0) facing north. ch.s.kennedy = 1: he
// speaks; ch.s.applause = 1: the crowd cheers; ch.s.riceDusk = 1: the stadium empty at dusk, the flags
// lowered (after Dallas).
const STAGE_Z = -13;
const PROPS = await loadProps(['film_camera_tripod']);
export function riceStadium(ch, name = 'stadium') {
  const R = ch.rice = {};
  const flagMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, map: canvasTex(152, 80, (c, w, h) => { for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#f0ece4' : '#b02030'; c.fillRect(0, i * h / 13, w, h / 13 + 1); } c.fillStyle = '#2a3a6a'; c.fillRect(0, 0, w * 0.4, h * 7 / 13); c.fillStyle = '#fff'; for (let i = 0; i < 30; i++) c.fillRect(4 + (i % 6) * 10, 3 + Math.floor(i / 6) * 8, 2, 2); }) });
  const g = new THREE.Group(), k = new Kit();
  const turf = quad(140, 110, surfMat('grass', '#5a8a3a'), 4); turf.rotation.x = -Math.PI / 2; turf.position.z = -20; g.add(turf);
  for (let i = -4; i <= 4; i++) k.box(0.15, 0.02, 60, 0xf0f0e8, [i * 9, 0.01, -20]);
  // the stands: concrete steps in a bowl round three sides (north, east, west)
  const stepsN = 32, rise = 0.48, tread = 0.85;
  // (the steps, rim wall, columns and press box are concrete: real photo texture, js/surfaces.js)
  const kc = new Kit(), Y = V(0, 1, 0);
  const at = (cx, cz, yaw, u, y, d) => { const p = V(u, y, -d).applyAxisAngle(Y, yaw); return [cx + p.x, p.y, cz + p.z]; };
  const stand = (cx, cz, yaw, w, r0) => {
    for (let i = 0; i < stepsN; i++) { const d = r0 + i * tread, y = 0.6 + i * rise; kc.box(w, y, tread, i % 2 ? 0xb8b2a6 : 0xc4beb2, at(cx, cz, yaw, 0, y / 2, d), [0, yaw, 0]); }
    const dTop = r0 + stepsN * tread, yTop = 0.6 + (stepsN - 1) * rise;
    // a rim wall along the top row with a pipe railing, and the back of the stand on concrete columns
    kc.box(w, 1.1, 0.3, 0xb0aa9e, at(cx, cz, yaw, 0, yTop + 0.55, dTop - 0.15), [0, yaw, 0]);
    k.box(w, 0.05, 0.05, 0x8a8a84, at(cx, cz, yaw, 0, yTop + 1.45, dTop - 0.25), [0, yaw, 0]);
    for (let u = -w / 2 + 3; u < w / 2; u += 6) {
      k.box(0.05, 0.35, 0.05, 0x8a8a84, at(cx, cz, yaw, u, yTop + 1.25, dTop - 0.25), [0, yaw, 0]);
      kc.box(1.1, yTop + 1.1, 1.2, 0xa8a296, at(cx, cz, yaw, u, (yTop + 1.1) / 2, dTop + 0.55), [0, yaw, 0]);   // a column down the back
    }
    // entry tunnels (dark mouths) in the front wall, and a band of shadow under the first row
    for (let u = -w / 2 + 10; u < w / 2 - 5; u += 20) k.box(2.4, 2.1, 0.06, 0x14120f, at(cx, cz, yaw, u, 1.05, r0 - tread / 2 - 0.02), [0, yaw, 0]);
  };
  stand(0, STAGE_Z, 0, 120, 24); stand(-42, -20, Math.PI / 2, 80, 6); stand(42, -20, -Math.PI / 2, 80, 6);
  // the press box high on the north stand: a long glazed cabin on the top rim
  { const d = 24 + stepsN * tread, y = 0.6 + stepsN * rise + 1.1; kc.box(50, 4.2, 4.5, 0xbab4a8, [0, y + 2.1, STAGE_Z - d - 1.5]); kc.box(52, 0.3, 5.5, 0x9a948a, [0, y + 4.35, STAGE_Z - d - 1.5]);
    for (let x = -23.5; x <= 23.5; x += 2.5) k.box(2.1, 1.6, 0.05, 0x22303a, [x, y + 2.4, STAGE_Z - d + 0.78]); }
  // four floodlight towers outside the corners: tapered steel masts with banks of lamps
  for (const [x, z] of [[-62, STAGE_Z - 40], [62, STAGE_Z - 40], [-62, 8], [62, 8]]) {
    k.box(1.4, 34, 1.4, 0x7a7a76, [x, 17, z], null, [0.5, 1, 0.5]); k.box(2.2, 2, 2.2, 0x6a6a66, [x, 1, z]);
    k.box(7, 3.2, 0.6, 0x5a5a56, [x, 35.5, z], [0, Math.atan2(-x, -z + (STAGE_Z - 16)), 0]);
    for (let i = 0; i < 12; i++) k.box(0.9, 0.7, 0.12, 0xe8e4d0, [x + ((i % 4) - 1.5) * 1.6 * Math.cos(Math.atan2(-x, -z + (STAGE_Z - 16))), 34.6 + Math.floor(i / 4) * 0.95, z - ((i % 4) - 1.5) * 1.6 * Math.sin(Math.atan2(-x, -z + (STAGE_Z - 16)))], [0, Math.atan2(-x, -z + (STAGE_Z - 16)), 0]);
  }
  g.add(texSolid(kc.mesh(FLAT), 'concrete', { scale: 3, ground: 0, grime: 0.3, weather: 0.35 }));
  // the speakers' stand: a platform with bunting, the lectern and its microphones, flags
  k.box(14, 1.4, 6, 0x6a5a48, [0, 0.7, STAGE_Z]);
  for (let i = 0; i < 9; i++) k.box(1.5, 0.6, 0.05, i % 3 === 0 ? 0xb02030 : i % 3 === 1 ? 0xf0ece4 : 0x2a3a6a, [-6 + i * 1.5, 1.05, STAGE_Z + 3.02]);
  k.box(0.9, 1.2, 0.6, 0x5a3a22, [0, 2.0, STAGE_Z + 2.2]); for (const x of [-0.18, 0.18]) k.cyl(0.012, 0.012, 0.4, 5, 0x2a2a2a, [x, 2.78, STAGE_Z + 2.45]);
  for (let i = 0; i < 8; i++) chair(k, -5 + i * 1.3 + (i > 3 ? 0.9 : 0), STAGE_Z - 0.6, 0, { seat: 0x3a3a3a, col: 0x3a3a3a });
  for (const x of [-6.5, 6.5]) k.cyl(0.03, 0.03, 4, 6, 0xc8a040, [x, 3.4, STAGE_Z - 2]);
  // the scoreboard over the north stand
  k.box(16, 6, 0.6, 0x2a2a2a, [0, 24, STAGE_Z - 52]); k.box(1, 10, 1, 0x5a5a5a, [-6, 17, STAGE_Z - 52]); k.box(1, 10, 1, 0x5a5a5a, [6, 17, STAGE_Z - 52]);
  g.add(k.mesh(FLAT));
  const sb = quad(15, 5, new THREE.MeshBasicMaterial({ map: canvasTex(480, 160, (c, w, h) => { c.fillStyle = '#1a1a1a'; c.fillRect(0, 0, w, h); c.fillStyle = '#f0e8c0'; c.font = 'bold 54px Georgia, serif'; c.textAlign = 'center'; c.fillText('RICE  STADIUM', w / 2, 70); c.font = 'bold 34px Georgia, serif'; c.fillText('WELCOME MR. PRESIDENT', w / 2, 128); }) })); sb.position.set(0, 24, STAGE_Z - 51.68); g.add(sb);
  R.flags = [-6.5, 6.5].map((x) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), flagMat); f.position.set(x + 0.72, 4.9, STAGE_Z - 2); g.add(f); return f; });
  // the crowd: people (sitting, fanning) on the near rows; the far rows painted
  const r = rng(31), spots = [];
  for (let i = 0; i < 9; i++) { const d = 24 + i * tread + 0.4, y = 0.6 + i * rise; for (let x = -22; x <= 22; x += 0.62) if (r() < 0.9) spots.push({ x: x + (r() - 0.5) * 0.15, y, z: STAGE_Z - d, yaw: (r() - 0.5) * 0.3 }); }
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) { const d = 6 + i * tread + 0.4, y = 0.6 + i * rise; for (let z = -2; z >= -30; z -= 0.62) if (r() < 0.85) spots.push({ x: sx * (42 - d), y, z, yaw: -sx * Math.PI / 2 + (r() - 0.5) * 0.3 }); }
  R.ricers = new Crowd(spots, { seed: 33, sit: true, who: ['man_casual', 'woman_dress', 'man_suit', 'woman_summer', 'woman_office', 'woman_older', 'eng_white_shirt', 'girl', 'boy'] });
  g.add(R.ricers.group);
  // the far rows: a painted crowd, one band per concrete step (people in 1962 summer clothes, a few
  // empty seats, hats, fans), each band with the step's lit tread and shadowed riser
  const far = surfMat('plaster', '#c8c0b0'); far.map = canvasTex(1024, 512, (c, w, h) => {
    const rr = rng(9), RH = 32;
    for (let row = 0; row < 16; row++) {
      const y0 = row * RH;
      c.fillStyle = '#b4ada0'; c.fillRect(0, y0, w, RH); c.fillStyle = '#8a8478'; c.fillRect(0, y0 + RH - 7, w, 7); c.fillStyle = '#cfc8ba'; c.fillRect(0, y0 + RH - 9, w, 2);
      for (let x = 2 + rr() * 6; x < w - 10; x += 12 + rr() * 5) {
        if (rr() < 0.08) continue;   // an empty seat
        const shirt = ['#f0eee8', '#e8e4da', '#f4f2ec', '#a8c0d8', '#d8c8a8', '#c8d4e0', '#e0b8a8', '#9ab0c8', '#e8d8b0', '#5a6a8a', '#f0f0ea', '#c8a878'][Math.floor(rr() * 12)];
        const skin = ['#e8c8a8', '#d8a888', '#c89878', '#8a5a3a', '#f0d0b8'][Math.floor(rr() * 5)];
        const by = y0 + RH - 9 - 13;
        c.fillStyle = shirt; c.fillRect(x, by, 9, 13);
        c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x + 7, by, 2, 13);
        c.fillStyle = skin; c.fillRect(x + 2, by - 6, 5, 6);
        const hair = rr(); c.fillStyle = hair < 0.15 ? '#e8e0c8' : hair < 0.3 ? '#2a2a2a' : ['#3a2a1a', '#5a4028', '#8a6a3a', '#1a1612'][Math.floor(rr() * 4)];
        if (hair < 0.15) c.fillRect(x, by - 8, 9, 3); else c.fillRect(x + 2, by - 7, 5, 2);   // a straw hat, or hair
        if (rr() < 0.06) { c.fillStyle = '#f4f0e0'; c.fillRect(x + 6, by - 4, 5, 5); }   // a fan or a programme
      }
    }
  }); far.map.wrapS = far.map.wrapT = THREE.RepeatWrapping; far.map.repeat.set(3, 23 / 16);
  const farRows = (cx, cz, yaw, w, d0, i0) => { const len = (stepsN - i0) * Math.hypot(tread, rise); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, len), far); const dmid = d0 + (i0 + (stepsN - i0) / 2) * tread, ymid = 0.6 + (i0 + (stepsN - i0) / 2) * rise + 0.55; const o = V(0, ymid, -dmid).applyAxisAngle(V(0, 1, 0), yaw); p.position.set(cx + o.x, o.y, cz + o.z); p.rotation.set(-Math.PI / 2 + Math.atan2(tread, rise), yaw, 0, 'YXZ'); g.add(p); };
  farRows(0, STAGE_Z, 0, 120, 24, 9); farRows(-42, -20, Math.PI / 2, 80, 6, 6); farRows(42, -20, -Math.PI / 2, 80, 6, 6);
  // Kennedy at the lectern; Glenn and von Braun sitting behind him; a few dignitaries
  R.jfk = person(g, 'kennedy', V(0, 1.4, STAGE_Z + 1.7), 0); R.jfk.look = V(0, 1.6, 6);
  R.glennR = person(g, 'glenn', V(-1.1, 1.4, STAGE_Z - 0.6), 0); sit(R.glennR);
  R.vbR = person(g, 'von_braun', V(1.5, 1.4, STAGE_Z - 0.6), 0); sit(R.vbR);
  R.digs = [];
  for (const [x, o] of [[-3.7, { kind: 'suit', coat: 0x3a3a42, seed: 431 }], [-2.4, { kind: 'suit', coat: 0x5a5a5e, hair: 0x8a8478, seed: 432 }], [2.8, { kind: 'suit', coat: 0x2a2a32, seed: 433 }], [4.1, { kind: 'dress', coat: 0x8a6a7a, seed: 434 }]]) { const P = makeFolk(o); P.g.position.set(x, 1.4, STAGE_Z - 0.6); sit(P); g.add(P.g); P.look = V(0, 3, STAGE_Z + 1.7); R.digs.push(P); }
  R.glennR.look = V(0, 2.9, STAGE_Z + 1.7); R.vbR.look = V(0, 2.9, STAGE_Z + 1.7);
  ch.people.push(R.jfk, R.glennR, R.vbR, ...R.digs);
  // the press in front of the stand, with their film cameras
  R.press = [];
  for (let i = 0; i < 4; i++) { const P = makeFolk({ kind: i % 2 ? 'shirt' : 'suit', hat: i === 1 ? 'fedora' : 'none', coat: [0xe8e8e0, 0x4a4a52, 0xe0e4e8, 0x5a4a3a][i], seed: 440 + i }); P.g.position.set(-5 + i * 3.3, 0, STAGE_Z + 6.5 + (i % 2) * 0.6); P.g.rotation.y = Math.PI; P.pose = 'hold'; P.look = V(0, 3, STAGE_Z + 1.7); g.add(P.g); R.press.push(P); }
  if (PROPS.has('film_camera_tripod')) { const P = PROPS.fresh(); P.add('film_camera_tripod', -3.4, 0, STAGE_Z + 7.0, Math.PI, { h: 1.7 }); P.add('film_camera_tripod', 3.4, 0, STAGE_Z + 7.2, Math.PI + 0.2, { h: 1.7 }); g.add(P.build()); }
  ch.people.push(...R.press);
  ch.addScene(name, { group: g, bounds: 1.5, place: { lat: 29.7, year: 1962, sunLon: 169 }, amb: 0.3, fogFar: 2000, mist: 0.02,
    sky: () => { if (ch.s.riceDusk) { ch.G.sky.set(285, -3); ch.G.sky.setMoon(118, 12, 1.1, 0.4); } else { ch.G.sky.set(250, 48); ch.G.sky.setMoon(118, 32, 1.1, 0.4); } },
    update: (dt, t) => {
      const s = ch.s, dusk = !!s.riceDusk;
      // after Dallas: the stands empty, nobody on the stand, the flags lowered to half-staff
      R.ricers.group.visible = !dusk;
      for (const P of [R.jfk, R.glennR, R.vbR, ...R.digs, ...R.press]) P.g.visible = !dusk;
      R.dk = damp(R.dk || 0, dusk ? 1 : 0, 0.5, dt); for (const f of R.flags) f.position.y = 4.9 - R.dk * 1.6;
      if (!dusk) R.ricers.update(t, dt, s.applause ? 'cheer' : 'fan');
      R.jfk.pose = s.kennedy ? 'talk' : 'idle';
    } });
  return R;
}
