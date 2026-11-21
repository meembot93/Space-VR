// You: reads the Quest controllers (or keyboard and mouse), moves you around, and draws your
// hands. Same controls as Broadside VR:
//   left stick: walk     right stick: snap turn (45°) or smooth turn
//   grip (side button): grab      trigger: use / point
// Things you can grab or touch register themselves in G.interactables (see below), so a
// chapter just adds objects there and gets called back.
//
// An interactable is an object with any of:
//   reach(handPos)        -> distance in metres if this hand can grab/touch it (else Infinity)
//   aim(origin, dir)      -> distance along the ray if the desktop crosshair is on it (else Infinity)
//   onGrab(hand), onHold(hand, dt), onRelease(hand), onTouch(hand)   (hand.pos is a Vector3)
//   hint                  -> short words shown the first time a hand comes near it
import * as THREE from 'three';
import { clamp } from './util.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const REACH = 0.22;      // how close a hand must be to grab something (metres)
const WALK = 1.8;        // walking speed (metres a second), a comfortable stroll

// A simple soft glove for each hand
export function buildGlove(color = 0xe8d2b0) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.032, 0.09), mat); g.add(palm);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.02, 0.05), mat);
    f.position.set(-0.027 + i * 0.018, -0.006, -0.065); f.rotation.x = -0.3; g.add(f);
  }
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.045), mat);
  thumb.position.set(-0.045, -0.008, -0.02); thumb.rotation.y = 0.5; g.add(thumb);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.05, 8), new THREE.MeshLambertMaterial({ color: 0x6a5a8a, flatShading: true }));
  cuff.rotation.x = Math.PI / 2; cuff.position.z = 0.065; g.add(cuff);
  g.userData.mat = mat; g.userData.thumb = thumb;
  return g;
}

export class Player {
  constructor(G, id = 'player:0') {
    this.G = G; this.id = id; this.name = '';
    this.dolly = new THREE.Group(); G.scene.add(this.dolly);
    this.dolly.add(G.camera); G.camera.position.set(0, 1.6, 0);
    this.hands = []; this.snapLatch = false; this.smoothTurn = false;
    this.yaw = 0; this.pitch = 0; this.keys = {};
    this.frozen = false;   // chapters can hold you still (e.g. during a cutscene)
    this.deskHand = { side: 'desk', pos: new THREE.Vector3(), held: null, hover: null, desk: true };
  }

  // Stand at x, z facing compass yaw (radians, 0 = looking north / -Z)
  placeAt(x, z, yaw = 0) {
    this.dolly.position.set(x, this.G.world.height(x, z), z);
    this.dolly.rotation.set(0, yaw, 0);
    this.yaw = 0; this.pitch = 0;
    for (const h of [...this.hands, this.deskHand]) this.release(h);
  }

  headPos(out) { return this.G.camera.getWorldPosition(out); }

  // ---------- VR ----------
  setupVR(renderer) {
    this.renderer = renderer;
    for (let i = 0; i < 2; i++) {
      const ctrl = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i);
      this.dolly.add(ctrl, grip);
      const glove = buildGlove(); grip.add(glove); glove.position.z = 0.02;
      const h = { i, ctrl, grip, glove, src: null, gp: null, side: '', trig: false, sq: false, evTrig: false, evSq: false,
        held: null, hover: null, pos: new THREE.Vector3(), last: new THREE.Vector3() };
      ctrl.addEventListener('connected', (e) => { h.src = e.data; h.gp = e.data.gamepad || null; h.side = e.data.handedness; glove.userData.thumb.position.x = h.side === 'left' ? 0.045 : -0.045; });
      ctrl.addEventListener('disconnected', () => { this.release(h); h.src = null; h.gp = null; h.evTrig = h.evSq = false; });
      this.hands.push(h);
    }
  }

  // The browser's own select/squeeze events are a second way of reading the buttons
  onSession(session) {
    const handFor = (src) => this.hands.find((h) => h.src === src) || this.hands.find((h) => h.side && h.side === src.handedness);
    const on = (type, fn) => session.addEventListener(type, (e) => { const h = handFor(e.inputSource); if (h) fn(h); });
    on('selectstart', (h) => { h.evTrig = true; });
    on('selectend', (h) => { h.evTrig = false; });
    on('squeezestart', (h) => { h.evSq = true; });
    on('squeezeend', (h) => { h.evSq = false; });
  }

  haptic(h, intensity, ms) {
    try { const a = h?.gp?.hapticActuators?.[0]; if (a?.pulse) a.pulse(intensity, ms); } catch (e) { /* ignore */ }
  }

  // The nearest thing this hand could grab
  nearest(h) {
    let best = null, bd = REACH;
    for (const it of this.G.interactables) {
      if (!it.reach || it.disabled || this.G.kids) continue;   // Kids mode is hands-free
      const d = it.reach(h.pos, h);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  grab(h) {
    const it = h.hover || this.nearest(h);
    if (!it) return;
    h.held = it; it.onGrab?.(h); this.haptic(h, 0.5, 40);
  }
  release(h) {
    if (!h.held) return;
    const it = h.held; h.held = null; it.onRelease?.(h);
  }
  touch(h) {
    const it = h.hover || this.nearest(h);
    if (it?.onTouch) { it.onTouch(h); this.haptic(h, 0.4, 40); }
  }

  updateVR(dt) {
    const session = this.renderer?.xr.getSession();
    const srcs = session ? Array.from(session.inputSources) : [];
    for (const h of this.hands) {
      if (!h.src || !srcs.includes(h.src)) { const s2 = srcs.find((x) => h.side && x.handedness === h.side); if (s2) h.src = s2; }
      h.gp = h.src?.gamepad || null;
      h.last.copy(h.pos); h.grip.getWorldPosition(h.pos);
      const b = h.gp ? h.gp.buttons : [], ax = h.gp ? h.gp.axes : [];
      const btn = (i) => !!(b[i] && (b[i].pressed || b[i].value > 0.5));
      const trig = h.evTrig || btn(0), sq = h.evSq || btn(1);
      // What's in reach lights up
      if (!h.held) {
        const it = this.nearest(h);
        if (it !== h.hover) { h.hover = it; if (it) { this.haptic(h, 0.15, 15); if (it.hint && !it.hinted) { it.hinted = true; this.G.ui.showHint(it.hint, 5); } } }
      }
      if (sq && !h.sq) this.grab(h);
      if (!sq && h.sq) this.release(h);
      if (trig && !h.trig) this.touch(h);
      h.trig = trig; h.sq = sq;
      if (h.held) h.held.onHold?.(h, dt);
      // A or X: pause / carry on
      const ax4 = btn(4);
      if (ax4 && !h.ax4) this.G.togglePause?.();
      h.ax4 = ax4;
      // B or Y: voice chat mic on/off
      const by = btn(5);
      if (by && !h.by) this.G.net?.voice.setMuted(!this.G.net.voice.muted);
      h.by = by;
      h.glove.scale.set(1, sq ? 0.75 : 1, sq ? 0.85 : 1);
      h.glove.userData.mat.emissive.setHex(h.hover || h.held ? 0x4a3a10 : 0x000000);
      if (!h.gp || this.frozen) continue;
      const sx = ax.length >= 4 ? ax[2] : ax[0] || 0, sy = ax.length >= 4 ? ax[3] : ax[1] || 0;
      if (h.side === 'left') this.move(sx, sy, dt);
      if (h.side === 'right') {
        if (this.smoothTurn) { if (Math.abs(sx) > 0.2) this.turn(-Math.sign(sx) * (Math.abs(sx) - 0.2) / 0.8 * 2.2 * dt); }
        else if (Math.abs(sx) > 0.7 && !this.snapLatch) { this.snapLatch = true; this.turn(sx > 0 ? -Math.PI / 4 : Math.PI / 4); }
        else if (Math.abs(sx) < 0.3) this.snapLatch = false;
      }
    }
  }

  // Walk relative to where you're looking (x: right, y: forward is negative, like the stick)
  move(x, y, dt) {
    if (Math.abs(x) < 0.15 && Math.abs(y) < 0.15) return;
    this.G.camera.getWorldDirection(_a); _a.y = 0;
    if (_a.lengthSq() < 1e-4) return; _a.normalize();
    const rx = -_a.z, rz = _a.x, sp = WALK * dt;
    this.dolly.position.x += (_a.x * -y + rx * x) * sp;
    this.dolly.position.z += (_a.z * -y + rz * x) * sp;
  }

  // Turn around your head, not around the middle of the play area
  turn(a) {
    this.G.camera.getWorldPosition(_a); _a.sub(this.dolly.position);
    _b.copy(_a).applyAxisAngle(UP, a);
    this.dolly.position.add(_a).sub(_b);
    this.dolly.rotation.y += a;
  }

  // Feet on the ground, and out of the stones (chapters list round blockers in G.world)
  clampToGround() {
    const W = this.G.world;
    this.G.camera.getWorldPosition(_a);
    let x = _a.x, z = _a.z;
    for (const bl of W.blockers) {
      const dx = x - bl.x, dz = z - bl.z, d = Math.hypot(dx, dz), r = bl.r + 0.25;
      if (d < r) { const k = d > 1e-4 ? r / d : 1; x = bl.x + (dx || r) * k; z = bl.z + dz * k; }
    }
    const R = W.bounds, dc = Math.hypot(x, z);
    if (dc > R) { x *= R / dc; z *= R / dc; }
    this.dolly.position.x += x - _a.x; this.dolly.position.z += z - _a.z;
    this.dolly.position.y = W.height(x, z);
  }

  // ---------- Desktop (for testing without a headset) ----------
  initDesktop(canvas) {
    if (this.deskReady) return; this.deskReady = true;
    this.canvas = canvas;
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyM') this.G.net?.voice.setMuted(!this.G.net.voice.muted);
      if (e.code === 'KeyP') this.G.togglePause?.();
      if (e.code === 'KeyN' && this.G.debug) this.G.narration.skip();
      if (e.code === 'KeyE') { const it = this.deskTarget(); if (it?.onTouch) it.onTouch(this.deskHand); else if (it?.onKey) it.onKey(this.deskHand); }
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (this.G.mode !== 'desktop') return;
      if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
      const it = this.deskTarget(); if (!it) return;
      if (it.onTouch && !it.onGrab) { it.onTouch(this.deskHand); return; }
      this.deskHand.held = it; it.onGrab?.(this.deskHand);
    });
    document.addEventListener('mouseup', () => this.release(this.deskHand));
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      if (this.deskHand.held?.onMouse) { this.deskHand.held.onMouse(this.deskHand, e.movementX, e.movementY); return; }
      this.yaw -= e.movementX * 0.0024; this.pitch = clamp(this.pitch - e.movementY * 0.0024, -1.4, 1.4);
    });
  }

  // What the crosshair is on
  deskTarget() {
    const cam = this.G.camera; cam.getWorldPosition(_a); cam.getWorldDirection(_b);
    let best = null, bd = 4.5;
    for (const it of this.G.interactables) {
      if (it.disabled || this.G.kids) continue;
      const d = it.aim ? it.aim(_a, _b) : Infinity;
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  updateDesktop(dt) {
    const k = this.keys;
    if (!this.frozen) {
      const fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      const side = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      this.move(side, -fwd, dt * (k.ShiftLeft ? 2 : 1));
    }
    this.G.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    // The "hand" is a point a little in front of your eyes, where the crosshair is
    const cam = this.G.camera; cam.getWorldPosition(_a); cam.getWorldDirection(_b);
    this.deskHand.pos.copy(_a).addScaledVector(_b, 0.6);
    const tgt = this.deskHand.held ? null : this.deskTarget();
    if (tgt !== this.deskHand.hover) {
      this.deskHand.hover = tgt;
      if (tgt?.hint && !tgt.hintedDesk) { tgt.hintedDesk = true; this.G.ui.showHint(tgt.deskHint || tgt.hint, 5); }
    }
    document.getElementById('crosshair')?.classList.toggle('on', !!tgt || !!this.deskHand.held);
    if (this.deskHand.held) this.deskHand.held.onHold?.(this.deskHand, dt);
  }

  update(dt) {
    const G = this.G;
    if (G.mode === 'vr') this.updateVR(dt); else if (G.mode === 'desktop') this.updateDesktop(dt);
    this.clampToGround();
  }

  // Pose for multiplayer: head and hands in world space, [x,y,z,qx,qy,qz,qw]
  pose() {
    const G = this.G, P = (o) => { o.getWorldPosition(_a); o.getWorldQuaternion(_q); return [+_a.x.toFixed(3), +_a.y.toFixed(3), +_a.z.toFixed(3), +_q.x.toFixed(3), +_q.y.toFixed(3), +_q.z.toFixed(3), +_q.w.toFixed(3)]; };
    const vr = G.mode === 'vr';
    const hand = (side) => { const h = this.hands.find((x) => x.side === side); return vr && h?.src ? P(h.grip) : 0; };
    return { h: P(G.camera), l: hand('left'), r: hand('right') };
  }
}
