// Text you see in the headset: subtitles for the narration, short control hints, and a
// fade to black between scenes. On desktop the same text also shows in the page.
import * as THREE from 'three';
import { canvasTex, damp, clamp } from './util.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion();

// Word-wrap text onto a canvas, centred. Returns the lines drawn.
function wrap(g, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

// A floating text card. set(text) redraws it only when the words change.
export function makeCard(w, h, worldW, style = {}) {
  const tex = canvasTex(w, h, () => {});
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldW * h / w),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false }));
  mesh.renderOrder = 990; mesh.visible = false;
  const S = { bg: 'rgba(8,12,28,0.72)', border: 'rgba(255,214,120,0.85)', color: '#fff6dc', font: 'Georgia, serif', size: 46, ...style };
  let cur = null;
  mesh.userData.set = (text, small = '') => {
    const key = text + '|' + small; if (key === cur) return; cur = key;
    const g = tex.userData.ctx; g.clearRect(0, 0, w, h);
    if (!text) { mesh.visible = false; tex.needsUpdate = true; return; }
    g.font = `${S.size}px ${S.font}`;
    const lines = wrap(g, text, w - 80);
    const lh = S.size * 1.22, smallH = small ? S.size * 0.8 : 0;
    const boxH = Math.min(h - 8, lines.length * lh + 44 + smallH);
    const y0 = (h - boxH) / 2;
    g.fillStyle = S.bg; g.beginPath(); g.roundRect(4, y0, w - 8, boxH, 26); g.fill();
    g.strokeStyle = S.border; g.lineWidth = 3; g.stroke();
    g.fillStyle = S.color; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => g.fillText(ln, w / 2, y0 + 22 + lh * (i + 0.5)));
    if (small) { g.font = `italic ${S.size * 0.6}px ${S.font}`; g.fillStyle = 'rgba(255,230,170,0.75)'; g.fillText(small, w / 2, y0 + boxH - smallH * 0.75); }
    tex.needsUpdate = true;
  };
  return mesh;
}

export class UI {
  constructor(G) {
    this.G = G;
    // Subtitles: a card that floats a little below your gaze and lazily follows your head
    this.sub = makeCard(1400, 300, 1.25);
    this.hint = makeCard(1100, 150, 0.85, { bg: 'rgba(30,20,6,0.78)', border: 'rgba(120,220,255,0.9)', color: '#dff6ff', size: 44 });
    G.scene.add(this.sub, this.hint);
    this.subYaw = 0; this.placed = false;
    this.hintT = 0;
    this.subsOn = true;
    // Fade to black: a dark sphere right around your head
    this.fader = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 1, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }));
    this.fader.renderOrder = 1000; G.camera.add(this.fader);
    this.fade = 1; this.fadeTo = 1; this.fadeSpeed = 1;
    this.domSub = document.getElementById('dsub');
    this.domHint = document.getElementById('dhint');
  }

  // Fade to black (1) or in (0) over `secs`. Resolves when done.
  fadeOut(secs = 1) { return this.fadeTarget(1, secs); }
  fadeIn(secs = 1.5) { return this.fadeTarget(0, secs); }
  fadeTarget(v, secs) {
    this.fadeTo = v; this.fadeSpeed = 1 / Math.max(0.01, secs);
    return new Promise((ok) => { this.fadeDone = ok; if (this.fade === v) { this.fadeDone = null; ok(); } });
  }

  subtitle(text, small = '') {
    this.subText = text;
    this.sub.userData.set(this.subsOn ? text : '', small);
    if (this.domSub) { this.domSub.textContent = this.subsOn ? text : ''; this.domSub.style.display = this.subsOn && text && this.G.mode === 'desktop' ? 'block' : 'none'; }
  }
  showHint(text, secs = 5) {
    this.hintT = secs; this.hint.userData.set(text);
    if (this.domHint) { this.domHint.textContent = text; this.domHint.style.display = text && this.G.mode === 'desktop' ? 'block' : 'none'; }
  }

  update(dt) {
    const G = this.G, cam = G.camera;
    // Fade
    if (this.fade !== this.fadeTo) {
      const s = this.fadeSpeed * dt;
      this.fade = this.fade < this.fadeTo ? Math.min(this.fadeTo, this.fade + s) : Math.max(this.fadeTo, this.fade - s);
      if (this.fade === this.fadeTo && this.fadeDone) { const d = this.fadeDone; this.fadeDone = null; d(); }
    }
    this.fader.material.opacity = this.fade; this.fader.visible = this.fade > 0.001;
    // Hint timer
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.showHint(''); }
    // Place the cards in front of you, following your head's turn slowly (comfier than head-locked)
    cam.getWorldPosition(_a); cam.getWorldDirection(_b);
    const yaw = Math.atan2(_b.x, _b.z);
    if (!this.placed) { this.subYaw = yaw; this.placed = true; }
    let dy = yaw - this.subYaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    if (Math.abs(dy) > 0.35) this.subYaw += dy * (1 - Math.exp(-dt * 3));
    const fx = Math.sin(this.subYaw), fz = Math.cos(this.subYaw);
    const desk = G.mode === 'desktop';
    for (const [card, dist, drop] of [[this.sub, 1.6, 0.42], [this.hint, 1.5, 0.08]]) {
      card.position.set(_a.x + fx * dist, _a.y - drop, _a.z + fz * dist);
      card.lookAt(_a.x, card.position.y, _a.z);
      if (desk) card.visible = false; // the page shows them instead
      else if (card === this.sub) card.visible = !!(this.subsOn && this.subText);
      else card.visible = this.hintT > 0;
    }
  }
}
