// Chapter 3 extras: the Nile.
//  - Cameo + wow (ch3_02, "they lined them up with north"): the echo of a pyramid architect appears on
//    the roof beside you and holds up a merkhet (a plumb line on a sighting stick). A glowing line drops
//    from two stars that hang one above the other over the pole (Kochab and Mizar, the way some
//    Egyptologists think it was done) straight down to the north horizon, a line of light runs south
//    from there along the Great Pyramid's east side, and the pyramid's base lights up, square to it.
//  - Wow (ch3_06, Sirius returns): Sirius flares into a starburst, and above her Orion, whom the
//    Egyptians called Sah, strides up the sky.
//  - Bridge: once the Nebra disk's stars match the sky, the Pleiades fly up as seven doves.
import * as THREE from 'three';
import { Echo } from './echo.js';
import { glowSprite, shimmer, awe, Timeline, clamp01, D2R } from './fx.js';
import { dirFromAzEl } from '../sky.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const KHUFU_H = 146, KHUFU_B = 230;

function rayTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.translate(128, 128); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    g.rotate(Math.PI / 4); const len = i % 2 ? 70 : 125, gr = g.createLinearGradient(0, 0, len, 0);
    gr.addColorStop(0, 'rgba(220,235,255,0.95)'); gr.addColorStop(1, 'rgba(220,235,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -3); g.lineTo(len, 0); g.lineTo(0, 3); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default class Ch3Extras {
  constructor(G, chapter) {
    this.G = G; this.ch = chapter; this.tl = new Timeline();
    this.root = new THREE.Group(); (chapter.egypt || G.scene).add(this.root);
    const roofY = G.world.height(0, 0);
    // the architect stands at the north edge of the roof, facing north
    this.arch = new Echo(G, this.root, { model: 'architect', seed: 21, tint: 0xffd9a0, pos: new THREE.Vector3(-1.4, roofY, -1.6), face: 0,
      look: { tunic: 0xece4d0, skin: 0x9a6a46, hair: 0x1a1410, height: 1.72 } });
    // the merkhet: a short stick with a plumb line hanging from its end
    const m = this.merkhet = new THREE.Group();
    const gold = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6).rotateZ(Math.PI / 2).translate(0.15, 0, 0), gold);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.5, 4).translate(0, -0.25, 0), gold); cord.position.x = 0.35;
    const bob = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 8).rotateX(Math.PI), gold); bob.position.set(0.35, -0.52, 0);
    m.add(stick, cord, bob); m.userData.mat = gold; this.root.add(m);
    // the line on the ground: from the north horizon along the Great Pyramid's east side, and its base square
    const top = chapter.pyramidTops?.[0] || new THREE.Vector3(-580, 160, -380);
    const by = top.y - KHUFU_H + 1.2, h = KHUFU_B / 2, ex = top.x + h;
    const lineMat = this.lineMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const strip = (x0, z0, x1, z1, w) => { const L = Math.hypot(x1 - x0, z1 - z0), s = new THREE.Mesh(new THREE.PlaneGeometry(w, L).rotateX(-Math.PI / 2), lineMat); s.position.set((x0 + x1) / 2, by, (z0 + z1) / 2); s.rotation.y = Math.atan2(x1 - x0, z1 - z0); return s; };
    this.ground = new THREE.Group();
    this.ground.add(strip(ex, top.z + h, ex, top.z - 2600, 3.5));                                         // due north, past the horizon
    this.ground.add(strip(top.x - h, top.z - h, ex, top.z - h, 2.5), strip(top.x - h, top.z + h, ex, top.z + h, 2.5), strip(top.x - h, top.z - h, top.x - h, top.z + h, 2.5)); // the rest of the base
    this.ground.visible = false; this.root.add(this.ground);
    this.lineK = 0; this.archOn = 0;
    // Sirius's starburst
    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: rayTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.flare.renderOrder = -6; this.flareGlow = glowSprite(0xcfe0ff, 1, 0); this.flareGlow.renderOrder = -6;
    G.scene.add(this.flare, this.flareGlow); this.flareT = -1;
  }

  line(id) {
    const G = this.G, F = G.skyFigures;
    if (id === 'ch3_02') {
      this.tl.after(6, () => { this.arch.show(true); this.archOn = 1; G.audio.chime?.(this.arch.P.g.position); });
      this.tl.after(9.5, () => { this.northLine(); this.lineOn = true; shimmer(G, 3, 0.15); });
    }
    if (id === 'ch3_03') this.tl.after(2.5, () => { this.arch.show(false); this.lineOn = false; F.stop('north'); });
    if (id === 'ch3_06') {
      this.flareT = 0; awe(G, 10, 0.08, 104); shimmer(G, 2.5, 0.18);
      if (F.height('hunter') > 5) this.tl.after(2.5, () => F.play('hunter', { secs: 22 }));
    }
  }

  // Kochab and Mizar, one straight above the other, and the plumb line between them dropped to the horizon
  northLine() {
    const G = this.G, sf = G.sky.starField, F = G.skyFigures;
    const ia = sf.find('Kochab'), ib = sf.find('Mizar');
    if (ia < 0 || ib < 0) return;
    const pa = sf.dirOf(ia, _a), elA = Math.asin(pa.y) / D2R, azA = Math.atan2(pa.x, -pa.z) / D2R;
    const pb = sf.dirOf(ib, _b), elB = Math.asin(pb.y) / D2R, azB = Math.atan2(pb.x, -pb.z) / D2R;
    const top = Math.max(elA, elB) + 4, az = (azA + azB) / 2;
    const pts = []; for (let e = top; e >= -0.5; e -= 1.5) pts.push(az * (e - 0) / top, e); // leans to exactly north at the horizon
    F.define('north', { frame: 'horizon', day: true, color: [1, 0.85, 0.5], gen: () => [
      { pts, w: 0.8, taper: false, part: 'line' },
      { pts: ring(azA, elA), w: 0.6, taper: false, part: 'ka' }, { pts: ring(azB, elB), w: 0.6, taper: false, part: 'kb' },
    ] });
    F.play('north', { secs: 40, drawSecs: 2.5 });
  }

  // Hold the moment a little so the line can reach the pyramid
  async after(id, D) { if (id === 'ch3_02' && this.lineOn) await D.wait(this.G.params.has('fast') ? 0.3 : 3.5); }

  async outro(D) {
    const F = this.G.skyFigures;
    if (F.height('doves') > 5 && this.ch.s?.scene === 'nebra') { F.play('doves', { secs: 12, drawSecs: 1.2 }); shimmer(this.G, 3, 0.15); await D.wait(this.G.params.has('fast') ? 0.5 : 8); }
  }

  update(dt, t) {
    const G = this.G; this.tl.update(dt);
    this.arch.update(dt, t);
    // the architect lifts his merkhet toward the stars over the pole
    const P = this.arch.P; P.pose = this.arch.on ? 'point' : 'idle';
    P.g.getWorldPosition(_a); P.pointAt.copy(_a).add(dirFromAzEl(0, 38, _b).multiplyScalar(40));
    this.arch.hand(this.merkhet.position); this.merkhet.parent.worldToLocal(this.merkhet.position);
    this.merkhet.rotation.y = Math.PI / 2;
    this.merkhet.userData.mat.opacity = this.arch.k * 0.9;
    this.merkhet.visible = this.arch.k > 0.01;
    // the line on the ground grows from the north toward the pyramid
    this.lineK = clamp01(this.lineK + dt * (this.lineOn ? 0.35 : -0.4));
    this.ground.visible = this.lineK > 0.01;
    this.lineMat.opacity = this.lineK * (0.55 + 0.15 * Math.sin(t * 3));
    // Sirius's starburst: a big flash that settles into a slow sparkle
    if (this.flareT >= 0 && this.ch.sirius) {
      this.flareT += dt;
      const f = this.flareT, k = f < 0.6 ? f / 0.6 : Math.max(0.25, 1 - (f - 0.6) / 4);
      const fade = f > 14 ? clamp01(1 - (f - 14) / 3) : 1;
      for (const sp of [this.flare, this.flareGlow]) sp.position.copy(this.ch.sirius.getWorldPosition(_a)).multiplyScalar(0.98);
      this.flare.scale.setScalar(140 * k + 30); this.flare.material.rotation = f * 0.08;
      this.flare.material.opacity = (0.5 + 0.5 * k) * fade; this.flareGlow.scale.setScalar(110 * k + 25); this.flareGlow.material.opacity = 0.7 * k * fade;
      if (f > 17) this.flareT = -1;
    } else { this.flare.material.opacity = 0; this.flareGlow.material.opacity = 0; }
  }

  dispose() {
    this.arch.dispose(); this.root.parent?.remove(this.root);
    this.G.scene.remove(this.flare, this.flareGlow);
    this.G.skyFigures.stopAll();
  }
}

function ring(az, el) { const p = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; p.push(az + (Math.cos(a) * 1.4) / Math.max(0.2, Math.cos(el * D2R)), el + Math.sin(a) * 1.4); } return p; }
