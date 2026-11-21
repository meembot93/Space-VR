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
};

export function makeJournalPage(kind) {
  const tex = canvasTex(1024, 720, DRAW[kind] || parchment);
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46 * 720 / 1024), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false }));
  const g = new THREE.Group(); g.add(page); // lookAt() on the group turns the drawing toward you
  return g;
}
