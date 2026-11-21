// The sky journal: at the end of each chapter the guide hands you a page with a drawing of
// what you saw. Pages are drawn on a canvas in an inked, hand-drawn style.
import * as THREE from 'three';
import { canvasTex } from './util.js';

function parchment(g, w, h) {
  const gr = g.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.7);
  gr.addColorStop(0, '#f2e3bf'); gr.addColorStop(1, '#d4bb86');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(110,80,40,0.5)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
}

const DRAW = {
  // Chapter 2: the circle from above, with a line from the centre out to the midsummer sunrise
  stonehenge(g, w, h) {
    parchment(g, w, h);
    const cx = w * 0.42, cy = h * 0.56, R = h * 0.3, ink = '#3a2a18';
    g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 3;
    const ax = (50 - 90) * Math.PI / 180; // compass 50° drawn with north up
    for (let i = 0; i < 30; i++) {
      const a = ax + (6.4 + i * 11.97) * Math.PI / 180;
      g.save(); g.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.rotate(a + Math.PI / 2); g.fillRect(-9, -4, 18, 8); g.restore();
    }
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1;
    // horseshoe of trilithons opening toward the sunrise
    for (const rel of [180, 128, 232, 82, 278]) {
      const a = ax + rel * Math.PI / 180, rr = R * (rel === 180 ? 0.46 : rel % 100 === 28 || rel === 232 ? 0.52 : 0.57);
      g.save(); g.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); g.rotate(a + Math.PI / 2); g.fillRect(-15, -5, 30, 10); g.restore();
    }
    // the sunrise line, out through the gap, past the Heel Stone, to the Sun
    g.setLineDash([10, 8]); g.strokeStyle = '#b5651d'; g.lineWidth = 4;
    const ex = cx + Math.cos(ax) * R * 2.3, ey = cy + Math.sin(ax) * R * 2.3;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
    g.fillStyle = ink; g.fillRect(cx + Math.cos(ax) * R * 1.65 - 7, cy + Math.sin(ax) * R * 1.65 - 7, 14, 14);
    g.fillStyle = '#e0952a'; g.beginPath(); g.arc(ex, ey, 26, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#e0952a'; g.lineWidth = 4;
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; g.beginPath(); g.moveTo(ex + Math.cos(a) * 34, ey + Math.sin(a) * 34); g.lineTo(ex + Math.cos(a) * 48, ey + Math.sin(a) * 48); g.stroke(); }
    g.fillStyle = ink; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
    g.fillText('Stonehenge, about 2500 BC', 40, 70);
    g.font = 'italic 32px Georgia, serif';
    g.fillText('Midsummer sunrise, through the gap', 40, h - 40);
    g.font = 'bold 28px Georgia, serif'; g.fillText('N ↑', w - 90, 70);
  },
  // Chapter 1: the tally bone with 29 marks, and the Moon's phases above it
  campfire(g, w, h) {
    parchment(g, w, h);
    const ink = '#3a2a18';
    g.fillStyle = ink; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
    g.fillText('The first calendar, 30,000 years ago', 40, 70);
    // phases: new, crescent, half, gibbous, full, and back
    const ph = [0.04, 0.12, 0.25, 0.37, 0.5, 0.63, 0.75, 0.88, 0.96];
    ph.forEach((p, i) => {
      const x = 120 + i * 98, y = 210, r = 34, waxing = p < 0.5, k = Math.cos(p * 2 * Math.PI), side = waxing ? 1 : -1;
      g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
      g.fillStyle = '#e8c860'; g.beginPath();
      for (let j = 0; j <= 24; j++) { const a = -Math.PI / 2 + Math.PI * j / 24; g.lineTo(x + side * Math.cos(a) * r, y + Math.sin(a) * r); }
      for (let j = 24; j >= 0; j--) { const a = -Math.PI / 2 + Math.PI * j / 24; g.lineTo(x + side * k * Math.cos(a) * r, y + Math.sin(a) * r); }
      g.fill();
    });
    // the bone
    g.fillStyle = '#efe4c8'; g.strokeStyle = ink; g.lineWidth = 3;
    g.beginPath(); g.moveTo(90, 400); g.quadraticCurveTo(w / 2, 340, w - 90, 400); g.lineTo(w - 90, 450); g.quadraticCurveTo(w / 2, 390, 90, 450); g.closePath(); g.fill(); g.stroke();
    for (let i = 0; i < 29; i++) {
      const t = 0.06 + i / 28 * 0.88, x = 90 + t * (w - 180), y = 425 - Math.sin(t * Math.PI) * 30;
      g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 2, y + 16); g.stroke();
    }
    g.font = 'italic 32px Georgia, serif'; g.fillText('29 marks: one round of the Moon', 40, h - 100);
    g.fillText('New, growing, full, shrinking... and new again', 40, h - 50);
  },
  // Chapter 3: Sirius rising before the Sun, the flooding Nile, and the three seasons
  nile(g, w, h) {
    parchment(g, w, h);
    const ink = '#3a2a18';
    g.fillStyle = ink; g.font = 'italic bold 44px Georgia, serif'; g.textAlign = 'left';
    g.fillText('Egypt, about 2500 BC: a new year', 40, 70);
    // horizon, the Sun's glow, Sirius just above it
    g.strokeStyle = ink; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 330); g.lineTo(w - 60, 330); g.stroke();
    const gr = g.createRadialGradient(640, 330, 0, 640, 330, 130); gr.addColorStop(0, 'rgba(230,150,60,0.8)'); gr.addColorStop(1, 'rgba(230,150,60,0)');
    g.fillStyle = gr; g.fillRect(500, 200, 280, 130);
    g.fillStyle = '#3a4a8a'; g.save(); g.translate(560, 250);
    for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 4); g.fillRect(-3, -22, 6, 44); }
    g.restore();
    g.fillStyle = ink; g.font = 'italic 28px Georgia, serif'; g.fillText('Sirius (Sopdet) returns', 600, 250);
    // pyramids on the left, the river with waves
    g.fillStyle = '#b89a60'; for (const [x, s] of [[120, 70], [210, 55], [280, 40]]) { g.beginPath(); g.moveTo(x - s, 330); g.lineTo(x, 330 - s * 1.2); g.lineTo(x + s, 330); g.fill(); }
    g.strokeStyle = '#3a6a9a'; g.lineWidth = 3;
    for (let row = 0; row < 3; row++) { g.beginPath(); for (let x = 60; x < w - 60; x += 10) g.lineTo(x, 370 + row * 18 + Math.sin(x / 18 + row) * 5); g.stroke(); }
    // three seasons
    const names = ['Flood', 'Growing', 'Harvest'], cols = ['#3a6a9a', '#4a7a3a', '#c09a40'];
    names.forEach((n, i) => {
      const x = 120 + i * 290;
      g.fillStyle = cols[i]; g.fillRect(x, 470, 230, 70);
      g.fillStyle = '#f4ead2'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.fillText(n, x + 115, 516);
    });
    g.textAlign = 'left'; g.fillStyle = ink; g.font = 'italic 32px Georgia, serif';
    g.fillText('365 days, three seasons of four months', 40, h - 50);
  },
};

export function makeJournalPage(kind) {
  const tex = canvasTex(1024, 720, DRAW[kind] || parchment);
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46 * 720 / 1024), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false }));
  const g = new THREE.Group(); g.add(page); // lookAt() on the group turns the drawing toward you
  return g;
}
