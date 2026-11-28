// Point at the night sky to learn the stars: aim a controller (or look, on desktop) at a star and
// its name and constellation appear beside it, and its constellation's figure lights up.
// Works in every chapter whenever stars are out; nothing for a chapter to do.
import * as THREE from 'three';
import { makeCard } from './ui.js';
import { damp } from './util.js';

const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _c = new THREE.Vector3();
const LABEL_DIST = 60;

export class Stargazing {
  constructor(G) {
    this.G = G;
    this.card = makeCard(1000, 240, 1, { size: 60, bg: 'rgba(6,10,26,0.62)', border: 'rgba(150,180,255,0.7)' });
    this.card.renderOrder = 980; this.card.scale.setScalar(LABEL_DIST * 0.26);
    G.scene.add(this.card);
    // a soft ring around the chosen star
    const rc = document.createElement('canvas'); rc.width = rc.height = 64;
    const g = rc.getContext('2d'); g.strokeStyle = 'rgba(255,225,160,0.95)'; g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.stroke();
    this.ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(rc), transparent: true, depthTest: false, depthWrite: false, fog: false }));
    this.ring.renderOrder = 981; this.ring.visible = false; G.scene.add(this.ring);
    // the pointer: a thin beam from your hand that fades out
    const bc = document.createElement('canvas'); bc.width = 4; bc.height = 64;
    const bg = bc.getContext('2d'), gr = bg.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(190,210,255,0)'); gr.addColorStop(1, 'rgba(190,210,255,0.55)'); bg.fillStyle = gr; bg.fillRect(0, 0, 4, 64);
    this.beam = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 2.5).translate(0, 1.25, 0).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    this.beam.visible = false; G.scene.add(this.beam);
    this.cur = null; this.show = 0; this.hold = 0; this.hinted = false; this.upT = 0;
  }

  // Which way the player is pointing: a raised controller in VR, the view on desktop
  aim() {
    const G = this.G, P = G.player;
    if (G.mode === 'vr') {
      let best = null;
      for (const h of P.hands) {
        if (!h.src || h.held || h.hover) continue;
        h.ctrl.getWorldPosition(_o); h.ctrl.getWorldQuaternion(_q);
        const d = _c.set(0, 0, -1).applyQuaternion(_q);
        if (d.y > 0.12 && (!best || h.side === 'right')) best = { o: _o.clone(), d: d.clone(), hand: h };
      }
      return best;
    }
    if (G.mode === 'desktop') {
      G.camera.getWorldPosition(_o); G.camera.getWorldDirection(_d);
      return _d.y > 0.12 ? { o: _o.clone(), d: _d.clone() } : null;
    }
    return null;
  }

  update(dt) {
    const G = this.G, sf = G.sky.starField;
    const night = sf.opacity;
    const a = night > 0.25 && !G.paused && !G.sky.indoors ? this.aim() : null;   // (not under a roof)
    // the pointer beam
    this.beam.visible = !!(a && a.hand);
    if (this.beam.visible) { this.beam.position.copy(a.o); this.beam.lookAt(_c.copy(a.o).add(a.d)); this.beam.material.opacity = night; }
    // say how it works the first time someone points up at a starry sky
    if (a && !this.hinted) { this.upT += dt; if (this.upT > 1.2) { this.hinted = true; G.ui.showHint(G.mode === 'vr' ? 'Point at a star to see its name' : 'Look at a star to see its name', 5); } }
    const pick = a ? sf.pick(a.d, G.mode === 'vr' ? 3 : 2.2) : null;
    // keep the current star a moment, so the label doesn't flicker between neighbours
    if (pick && (!this.cur || pick.i !== this.cur.i)) { this.hold += dt; if (!this.cur || this.hold > 0.25) { this.cur = pick; this.hold = 0; this.draw(); } }
    else if (pick) this.hold = 0;
    this.show = damp(this.show, pick ? 1 : 0, pick ? 8 : 2.5, dt);
    if (!pick && this.show < 0.02) this.cur = null;
    const c = this.cur, vis = !!c && this.show > 0.02;
    this.card.visible = this.ring.visible = vis;
    sf.highlight(c?.con, this.show * 0.9);
    if (!vis) return;
    // label beside the star, facing you
    G.camera.getWorldPosition(_o);
    const w = c.world.set(sf.dirs[c.i * 3], sf.dirs[c.i * 3 + 1], sf.dirs[c.i * 3 + 2]).applyMatrix4(_m.copy(sf.toWorld).setPosition(0, 0, 0));
    this.ring.position.copy(_o).addScaledVector(w, LABEL_DIST);
    this.ring.scale.setScalar(LABEL_DIST * 0.05 * (1 + 0.08 * Math.sin(G.t * 4)));
    this.ring.material.opacity = this.show;
    // put the card just below the star (or above it when the star is low)
    const below = w.y > 0.25 ? -1 : 1;
    this.card.position.copy(_o).addScaledVector(w, LABEL_DIST);
    this.card.position.y += below * LABEL_DIST * 0.095;
    this.card.lookAt(_o);
    this.card.material.opacity = this.show;
  }

  draw() {
    const c = this.cur;
    const con = c.conEn && c.conEn !== c.conName ? `${c.conName}, the ${c.conEn}` : c.conName;
    if (c.name) this.card.userData.set(c.name, `in ${con}`);
    else this.card.userData.set(con, 'a star in this constellation');
  }
}
const _m = new THREE.Matrix4();
