// Prints a living-constellation figure's strokes at time t as JSON (for tools/sky/figures.py).
//   node tools/sky/figure_dump.mjs hunter 0.0 > hunter.json
import { FIGURES, layout } from '../../js/skyart.js';
const [name, t = '0'] = process.argv.slice(2);
const f = FIGURES[name];
console.log(JSON.stringify(layout(f, Number(t)).map((s) => { const p = []; for (let i = 0; i < s.pts.length; i += 2) p.push([s.pts[i], s.pts[i + 1]]); return { p, w: s.w }; })));
