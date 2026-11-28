// The Saturn V, stacked from its pieces (tools/blender/saturn_v.py, apollo_csm.py, launch_tower.py),
// for the rollout, Apollo 4, Apollo 8, Apollo 11 and Apollo 13. Every piece stands on its own
// origin (its bottom centre, engines hanging below); the numbers below put them on top of each
// other. The whole rocket stands about 124 m with its escape tower (stylized: a little taller than
// the real 111 m, matching the launch tower model).
//
//   const M = await loadAll(SATURN);            // plus 'craft/launch_tower', 'craft/crawler' if needed
//   const R = new Rocket(group, { ...saturnRocket(M), env });   R.place(x, LAUNCH_Y, z)
//   const stack = saturnStack(M, env);          // a still model (the rollout, the pad at night)
import * as THREE from 'three';
import { copy } from './craft.js';

export const SATURN = ['craft/saturn_s1c', 'craft/saturn_interstage', 'craft/saturn_s2', 'craft/saturn_s4b', 'craft/saturn_sla', 'craft/apollo_csm', 'craft/apollo_les'];
// heights of each piece's origin above the rocket's bottom
export const SAT_Y = { s1c: 0, interstage: 42, s2: 47.5, s4b: 78.2, sla: 96.9, csm: 111.9, les: 111.9 };
export const SAT_TOP = 124.3;          // the top of the escape tower
export const PAD_Y = 8.6;              // on the launch tower's platform, the rocket's bottom is this high
export const CREW_ARM_Y = SAT_Y.csm + 0.3;   // the crew access arm's floor (by the hatch), above the rocket's bottom

// Rocket() options: the pieces in the order they come off, the five F-1s on the first stage, the
// five J-2s on the second, one J-2 on the third
export function saturnRocket(M) {
  const parts = [
    { M: M.saturn_s1c, y: SAT_Y.s1c, name: 's1c' },
    { M: M.saturn_interstage, y: SAT_Y.interstage, name: 'interstage' },
    { M: M.saturn_s2, y: SAT_Y.s2, name: 's2' },
    { M: M.saturn_s4b, y: SAT_Y.s4b, name: 's4b' },
    { M: M.saturn_sla, y: SAT_Y.sla, name: 'sla' },
    { M: M.apollo_csm, y: SAT_Y.csm, name: 'csm' },
    { M: M.apollo_les, y: SAT_Y.les, name: 'les' },
  ];
  const f1 = [[0, 0], ...[0, 1, 2, 3].map((q) => { const a = Math.PI / 4 + q * Math.PI / 2; return [Math.cos(a) * 4.0, Math.sin(a) * 4.0]; })];
  const engines = f1.map(([x, z]) => ({ x, z, y: -5.6, len: 34, width: 4.2, kind: 'kero', stage: 0 }));
  return { parts, engines, size: 2.5, hold: 8.9, accel: 3.6, az: 72, tilt: 25, tiltAt: 2500, trench: 0, glowEnd: 260, trailEnd: 220, lightI: 900 };
}

// A still Saturn V as one group (bottom of the first stage at y = 0)
export function saturnStack(M, env = null, k = 0.9) {
  const g = new THREE.Group();
  for (const p of saturnRocket(M).parts) { if (!p.M) continue; const m = copy(p.M, env, k); m.position.y = p.y; g.add(m); }
  return g;
}
