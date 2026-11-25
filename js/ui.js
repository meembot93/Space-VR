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
  mesh.userData.set = (text, small = '', speaker = '') => {
    const key = text + '|' + small + '|' + speaker; if (key === cur) return; cur = key;
    const g = tex.userData.ctx; g.clearRect(0, 0, w, h);
    if (!text) { mesh.visible = false; tex.needsUpdate = true; return; }
    // long lines shrink the letters until every word fits on the card (never cut off)
    let size = S.size, lines, lh, smallH, nameH, need;
    for (;;) {
      g.font = `${size}px ${S.font}`;
      lines = wrap(g, text, w - 80);
      lh = size * 1.22; smallH = small ? size * 0.8 : 0; nameH = speaker ? size * 0.85 : 0;
      need = lines.length * lh + 44 + smallH + nameH;
      if (need <= h - 8 || size <= S.size * 0.55) break;
      size = Math.floor(size * 0.92);
    }
    const boxH = Math.min(h - 8, need);
    const y0 = (h - boxH) / 2;
    g.fillStyle = S.bg; g.beginPath(); g.roundRect(4, y0, w - 8, boxH, 26); g.fill();
    g.strokeStyle = S.border; g.lineWidth = 3; g.stroke();
    g.fillStyle = S.color; g.textAlign = 'center'; g.textBaseline = 'middle';
    // who's talking, in gold above the words (the guide star is called Astra)
    if (speaker) { g.font = `bold ${size * 0.62}px ${S.font}`; g.fillStyle = '#ffd77a'; g.fillText(speaker, w / 2, y0 + 16 + nameH * 0.5); g.font = `${size}px ${S.font}`; g.fillStyle = S.color; }
    lines.forEach((ln, i) => g.fillText(ln, w / 2, y0 + 22 + nameH + lh * (i + 0.5)));
    if (small) { g.font = `italic ${size * 0.6}px ${S.font}`; g.fillStyle = 'rgba(255,230,170,0.75)'; g.fillText(small, w / 2, y0 + boxH - smallH * 0.75); }
    tex.needsUpdate = true;
  };
  return mesh;
}

export class UI {
  constructor(G) {
    this.G = G;
    // Subtitles: a card that floats a little below your gaze and lazily follows your head
    this.sub = makeCard(1400, 380, 1.25);
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
    this.blink = 0;   // the player's bird's-eye peek blinks with this, apart from the story's fades
    // Pause: the world dims and a card says how to carry on
    this.dim = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8),
      new THREE.MeshBasicMaterial({ color: 0x02040c, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }));
    this.dim.renderOrder = 985; this.dim.visible = false; G.camera.add(this.dim);
    this.pauseCard = makeCard(1100, 260, 0.9, { size: 52 });
    this.pauseCard.renderOrder = 995; G.scene.add(this.pauseCard);
    this.paused = false; this.dimV = 0;
    // The pause menu (host): a list you move through with a thumbstick and pick with the trigger.
    // G.pauseMenu() (js/main.js) says which items there are; G.menuPick(key) does them.
    this.menuCard = makeCard(1100, 640, 0.9, { size: 50 });
    this.menuCard.renderOrder = 995; G.scene.add(this.menuCard);
    this.menu = null; this.menuSel = 0;
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

  subtitle(text, small = '', speaker = '') {
    this.subText = text;
    this.sub.userData.set(this.subsOn ? text : '', small, speaker);
    if (this.domSub) { this.domSub.textContent = this.subsOn ? (speaker ? speaker + ': ' : '') + text : ''; this.domSub.style.display = this.subsOn && text && this.G.mode === 'desktop' ? 'block' : 'none'; }
  }
  showHint(text, secs = 5) {
    this.hintT = secs; this.hint.userData.set(text);
    if (this.domHint) { this.domHint.textContent = text; this.domHint.style.display = text && this.G.mode === 'desktop' ? 'block' : 'none'; }
  }

  setPaused(on) {
    this.paused = on;
    const vr = this.G.mode !== 'desktop';
    this.menu = on ? this.G.pauseMenu?.() || null : null; this.menuSel = 0;
    if (on) this.placed = false;   // the pause card appears straight in front of you
    if (this.menu) { this.pauseCard.userData.set(''); this.drawMenu(); return; }
    this.menuCard.userData.set('');
    this.pauseCard.userData.set(on ? 'Paused' : '', on ? (vr ? 'A or X: carry on.  Hold a thumbstick in: reset height' : 'Press P to carry on') : '');
    if (this.domHint) { this.domHint.textContent = on ? 'Paused. Press P to carry on.' : ''; this.domHint.style.display = on && !vr ? 'block' : 'none'; }
  }

  // The menu's words, with the chosen item marked
  drawMenu() {
    const m = this.menu; if (!m) return;
    const vr = this.G.mode !== 'desktop';
    const lines = m.map((it, i) => (i === this.menuSel ? '\u25B6  ' + it.label + '  \u25C0' : it.label));
    this.menuCard.userData.set('Paused\n\n' + lines.join('\n'), vr ? 'Thumbstick up/down to choose, trigger to pick.  A or X: carry on' : 'Arrow keys to choose, Enter to pick.  P: carry on');
    if (this.domHint) {
      this.domHint.textContent = 'Paused:  ' + m.map((it, i) => (i === this.menuSel ? '[' + it.label + ']' : it.label)).join('  \u00B7  ') + '   (arrows + Enter, P to carry on)';
      this.domHint.style.display = vr ? 'none' : 'block';
    }
  }
  menuMove(d) {
    if (!this.menu) return;
    this.menuSel = (this.menuSel + d + this.menu.length) % this.menu.length; this.drawMenu();
    this.G.audio.ctx && this.G.audio.tick?.();
  }
  menuChoose() { const it = this.menu?.[this.menuSel]; if (it) this.G.menuPick?.(it.key); }

  update(dt) {
    const G = this.G, cam = G.camera;
    this.dimV = damp(this.dimV, this.paused ? 0.55 : 0, 6, dt);
    this.dim.material.opacity = this.dimV; this.dim.visible = this.dimV > 0.005;
    // Fade
    if (this.fade !== this.fadeTo) {
      const s = this.fadeSpeed * dt;
      this.fade = this.fade < this.fadeTo ? Math.min(this.fadeTo, this.fade + s) : Math.max(this.fadeTo, this.fade - s);
      if (this.fade === this.fadeTo && this.fadeDone) { const d = this.fadeDone; this.fadeDone = null; d(); }
    }
    const dark = Math.max(this.fade, this.blink);
    this.fader.material.opacity = dark; this.fader.visible = dark > 0.001;
    // Hint timer
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) this.showHint(''); }
    // Place the cards in front of you, following your head's turn slowly (comfier than head-locked)
    cam.getWorldPosition(_a); cam.getWorldDirection(_b);
    const yaw = Math.atan2(_b.x, _b.z), pitch = Math.asin(clamp(_b.y, -1, 1));
    if (!this.placed) { this.subYaw = yaw; this.subPitch = pitch; this.placed = true; }
    // the cards also tip down when you look down (at a scroll, a table, the ground), lazily
    if (Math.abs(pitch - this.subPitch) > 0.25) this.subPitch += (pitch - this.subPitch) * (1 - Math.exp(-dt * 3));
    let dy = yaw - this.subYaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    if (Math.abs(dy) > 0.35) this.subYaw += dy * (1 - Math.exp(-dt * 3));
    const fx = Math.sin(this.subYaw), fz = Math.cos(this.subYaw);
    const desk = G.mode === 'desktop';
    const pt = clamp(this.subPitch, -1.1, 0.6), cp = Math.cos(pt), sp = Math.sin(pt);
    for (const [card, dist, drop] of [[this.sub, 1.6, 0.42], [this.hint, 1.5, 0.08], [this.pauseCard, 1.3, -0.05], [this.menuCard, 1.3, -0.02]]) {
      // straight ahead along your (lazy) gaze, then `drop` lower on the card's own up direction
      card.position.set(_a.x + fx * dist * cp, _a.y + dist * sp - drop * cp, _a.z + fz * dist * cp);
      card.position.x += fx * drop * sp; card.position.z += fz * drop * sp;
      card.lookAt(_a);
      if (desk) card.visible = false; // the page shows them instead
      else if (card === this.sub) card.visible = !!(this.subsOn && this.subText);
      else if (card === this.hint) card.visible = this.hintT > 0 && !this.paused;
      else if (card === this.menuCard) card.visible = this.paused && !!this.menu;
      else card.visible = this.paused && !this.menu;
    }
  }
}
