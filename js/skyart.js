// Drawings for the living constellations (js/skyfigures.js): glowing figures drawn around the real
// stars, which come alive and act out their story. Plain data plus small motion functions, no three.js.
//
// Each figure is drawn on a flat patch of sky centred on `center` [right ascension, declination] in
// degrees (J2000), seen from the ground with celestial north up: x to the right (west), y up (north),
// both in degrees. tools/sky/figure_dump.mjs prints a figure's strokes (to plot over a star chart and check it lines up).
//
// A figure has parts; a part has strokes (lists of x, y points, smoothed into curves unless sharp)
// and can turn around a pivot, on top of its parent part. `move(t)` gives the angles (radians) for
// each part at time t (seconds since the figure woke up), plus dx, dy (degrees) to move the whole figure.
//   stroke: { p: [x0, y0, x1, y1, ...], w: width (1 = normal), closed, sharp,
//             taper: true (thin toward the end) or 'start' (thin at the start) }
// A figure can instead have gen(t), which returns its strokes directly (the Pleiades doves).

const S = Math.sin;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export const FIGURES = {
  // Orion, the hunter: club raised in his right hand, a lion's skin held out in his left, toward the Bull
  hunter: {
    con: 'Ori', center: [75.79, 9.2], color: [1, 0.86, 0.58],
    parts: [
      { id: 'body', strokes: [
        { p: [-7.9, 2.6, -6.6, 1.6, -6.7, -0.2, -7.9, -0.9, -9.2, -0.3, -9.3, 1.4, -8.6, 2.5, -7.9, 2.6], w: 1.1 },          // head (Meissa)
        { p: [-8.1, -0.9, -8.0, -1.9] },                                                                             // neck
        { p: [-13.1, -1.6, -10.5, -1.9, -8.0, -2.1, -5.5, -2.8], w: 1.2 },                                                 // shoulders (Betelgeuse to Bellatrix)
        { p: [-12.8, -2.3, -11.9, -6.5, -10.6, -11.0] },                                                              // side
        { p: [-5.9, -3.3, -6.4, -6.8, -6.9, -9.3] },                                                                  // side
        { p: [-10.7, -11.7, -9.7, -11.3, -8.5, -10.5, -7.4, -9.6, -6.7, -9.3], w: 1.3, sharp: true },                     // belt (the three belt stars)
        { p: [-10.7, -11.7, -11.6, -13.6, -12.6, -15.0, -9.5, -15.6, -6.6, -14.6, -5.2, -13.2, -6.7, -9.3], sharp: true }, // tunic
        { p: [-8.4, -11.3, -8.3, -13.6, -8.2, -15.2], w: 0.7 },                                                        // sword
      ] },
      { id: 'legR', parent: 'body', pivot: [-10.6, -15.2], strokes: [
        { p: [-10.6, -15.2, -11.0, -17.4, -11.8, -19.8, -13.4, -20.4] },                                              // leg to Saiph
      ] },
      { id: 'legL', parent: 'body', pivot: [-7.0, -14.9], strokes: [
        { p: [-7.0, -14.9, -5.2, -16.2, -3.0, -18.0, -1.6, -18.6] },                                                  // striding leg to Rigel
      ] },
      { id: 'clubArm', parent: 'body', pivot: [-13.1, -1.6], strokes: [
        { p: [-13.1, -1.6, -15.2, -0.2, -15.6, 2.4, -15.1, 4.6] },                                                    // arm up
        { p: [-15.2, 4.0, -15.5, 7.4, -14.7, 10.6, -13.4, 12.6], w: 2.6, taper: 'start' },                            // the club
      ] },
      { id: 'shieldArm', parent: 'body', pivot: [-5.5, -2.8], strokes: [
        { p: [-5.5, -2.8, -2.8, -1.4, 0.6, 0.4] },                                                                    // arm out
        { p: [-1.6, 6.4, -0.3, 6.2, 1.7, 4.3, 2.0, 1.0, 3.1, -0.3, 3.3, -2.2, 3.0, -3.6, 2.2, -6.8, 1.2, -7.5], w: 1.1 }, // lion skin's edge (the shield stars)
        { p: [-1.6, 6.4, -0.6, 3.0, 0.2, -1.6, -0.2, -5.4, 1.2, -7.5], w: 0.8 },                                     // its inner edge
        { p: [1.2, -7.5, 0.6, -8.8, 1.6, -9.6], w: 0.6, taper: true },                                                // a paw hanging down
      ] },
    ],
    // He swings the club back and brings it down, steps in, and holds up the skin against the Bull
    move(t) {
      const c = t % 3.2, swing = c < 2.0 ? ease(c / 2.0) : 1 - ease((c - 2.0) / 1.2);
      return {
        clubArm: 0.35 * swing - 0.15, shieldArm: -0.08 * swing, legL: 0.06 * swing, legR: -0.04 * swing,
        dx: 0.5 * swing, dy: 0.25 * Math.abs(S(t * 2)),
      };
    },
  },

  // Taurus, the Bull: Aldebaran is his fiery eye, the Pleiades ride on his back, horns lowered at Orion
  bull: {
    con: 'Tau', center: [75.79, 9.2], color: [1, 0.72, 0.5],
    parts: [
      { id: 'body', strokes: [
        { p: [12.4, 10.4, 15.0, 13.6, 18.4, 15.0, 22.8, 14.2, 27.6, 12.8, 31.6, 9.8, 32.6, 6.0], w: 1.1 },           // neck, hump (under the Pleiades) and back
        { p: [12.2, 1.6, 15.0, -0.6, 19.0, -1.0, 24.0, -0.4, 28.2, 1.0, 31.4, 2.8, 32.6, 6.0], w: 1.1 },              // chest and belly
        { p: [32.4, 8.4, 35.0, 6.6, 35.4, 3.0, 34.8, 0.6], w: 0.7, taper: true },                                     // tail
        { p: [28.6, 1.2, 29.0, -3.4, 29.8, -7.4, 30.8, -8.6], sharp: true },                                          // hind legs
        { p: [31.2, 3.0, 32.4, -2.6, 33.2, -7.0, 34.2, -8.2], sharp: true },
        { p: [14.0, 0.6, 13.6, -3.6, 13.0, -8.4, 11.8, -9.0], sharp: true },                                         // front leg, planted
      ] },
      { id: 'paw', parent: 'body', pivot: [17.6, -0.6], strokes: [
        { p: [17.6, -0.6, 18.4, -3.8, 16.6, -6.4, 15.0, -6.8], sharp: true },                                       // front leg, pawing the ground
      ] },
      { id: 'head', parent: 'body', pivot: [12.6, 6.0], strokes: [
        { p: [12.4, 10.4, 9.6, 11.6, 7.2, 10.6, 5.0, 8.2, 3.8, 6.0, 4.4, 4.4, 6.6, 3.8, 9.4, 3.2, 12.2, 1.6], w: 1.2 }, // face (around the Hyades)
        { p: [4.6, 5.6, 5.0, 5.3], w: 0.6 },                                                                         // nostril
        { p: [6.6, 7.9, 7.4, 7.4, 6.6, 7.1, 6.0, 7.5, 6.6, 7.9], w: 0.6 },                                             // the eye: Aldebaran
        { p: [9.8, 11.6, 6.0, 15.6, 0.6, 18.8, -5.4, 20.3], w: 1.3, taper: true },                                     // horn to Elnath
        { p: [8.2, 10.8, 3.4, 13.0, -2.6, 13.4, -8.3, 12.4], w: 1.3, taper: true },                                    // horn to zeta Tauri
        { p: [11.2, 10.8, 12.6, 12.2, 13.4, 11.2], w: 0.7 },                                                          // ear
      ] },
    ],
    // He lowers his head and tosses his horns, paws the ground, and lunges at the Hunter
    move(t) {
      const c = t % 2.6, toss = c < 1.6 ? ease(c / 1.6) : 1 - ease((c - 1.6) / 1.0);
      return { head: 0.22 * toss - 0.08, paw: 0.5 * Math.max(0, S(t * 5)) * (1 - toss), dx: -0.9 * toss, dy: -0.2 * toss };
    },
  },

  // Leo, the Lion (in the Ice Age, a cave lion): the Sickle is his mane, Regulus his heart, Denebola his tail
  lion: {
    con: 'Leo', center: [157.25, 18.79], color: [1, 0.8, 0.45],
    parts: [
      { id: 'body', strokes: [
        { p: [4.4, 9.8, 0.6, 5.6, -4.0, 3.4, -10.7, 3.0, -14.2, 0.8], w: 1.1 },                                     // back to the hip (Zosma)
        { p: [5.2, -6.0, 1.0, -6.6, -4.0, -6.4, -9.2, -5.2, -12.0, -4.0], w: 1.1 },                                  // belly from the chest (Regulus)
        { p: [-14.2, 0.8, -15.2, -2.0, -13.6, -4.2] },                                                               // haunch
        { p: [4.6, 10.6, 2.4, 9.2, 1.0, 6.6, 1.6, 4.4, 1.0, 1.8, 2.4, -1.0, 3.4, -3.4, 5.2, -6.0], w: 1.2, sharp: false }, // mane (the Sickle)
        { p: [3.6, 9.0, 2.8, 6.8, 3.0, 4.4, 2.4, 1.6, 3.6, -0.8], w: 0.6 },                                          // mane, inner
      ] },
      { id: 'head', parent: 'body', pivot: [6.0, 5.4], strokes: [
        { p: [5.4, 9.6, 8.2, 9.6, 10.6, 8.0, 12.6, 6.4, 13.6, 5.0, 13.0, 4.0], w: 1.1 },                              // brow and nose
        { p: [7.2, 9.6, 7.6, 11.0, 8.8, 10.0], w: 0.7 },                                                             // ear
        { p: [9.6, 6.8, 10.2, 6.9], w: 0.6 },                                                                         // eye
      ] },
      { id: 'jaw', parent: 'head', pivot: [10.0, 3.6], strokes: [
        { p: [13.0, 4.0, 11.6, 3.2, 9.4, 2.8, 7.0, 3.0], w: 0.9 },                                                   // jaw (opens to roar)
      ] },
      { id: 'tail', parent: 'body', pivot: [-14.2, 0.8], strokes: [
        { p: [-14.2, 0.8, -16.8, 0.2, -18.8, -1.8, -20.1, -3.3, -21.0, -2.2], w: 0.8 },
        { p: [-20.4, -3.0, -21.6, -2.6, -21.4, -1.4], w: 1.4, taper: true },                                          // tuft (Denebola)
      ] },
      { id: 'fl1', parent: 'body', pivot: [4.6, -6.2], strokes: [{ p: [4.6, -6.2, 5.2, -9.0, 5.6, -12.0, 7.4, -12.6], sharp: true }] },
      { id: 'fl2', parent: 'body', pivot: [1.6, -6.4], strokes: [{ p: [1.6, -6.4, 1.2, -9.2, 1.4, -12.0, 3.0, -12.6], sharp: true }] },
      { id: 'hl1', parent: 'body', pivot: [-11.0, -3.2], strokes: [{ p: [-11.0, -3.2, -12.2, -7.6, -11.2, -12.0, -9.6, -12.6], sharp: true }] },
      { id: 'hl2', parent: 'body', pivot: [-13.6, -3.4], strokes: [{ p: [-13.6, -3.4, -15.6, -7.8, -15.0, -12.2, -13.4, -12.6], sharp: true }] },
    ],
    // He prowls along (legs swinging in turn, tail swishing) and every few seconds lifts his head and roars
    move(t) {
      const w = t * 2.4, roar = Math.max(0, S(t * 0.9 - 1.2)) ** 3;
      return { fl1: 0.25 * S(w), fl2: -0.25 * S(w), hl1: -0.22 * S(w), hl2: 0.22 * S(w),
        tail: 0.2 * S(t * 1.6), head: 0.18 * roar, jaw: -0.35 * roar, dx: t * 0.35, dy: 0.15 * Math.abs(S(w)) };
    },
  },

  // Ursa Major, the Great Bear (an Ice Age cave bear, or Callisto for the Greeks): the Big Dipper's bowl is
  // her body and its handle her long tail
  bear: {
    con: 'UMa', center: [164.94, 53.12], color: [0.85, 0.85, 1],
    parts: [
      { id: 'body', strokes: [
        { p: [9.6, 10.0, 4.2, 9.8, -0.5, 8.7, -6.0, 7.6, -10.3, 5.4, -11.2, 3.2], w: 1.2 },                          // back (Dubhe to Megrez)
        { p: [-11.2, 3.2, -8.0, 1.3, -3.0, 2.2, -0.3, 3.3, 5.0, 3.0, 9.6, 4.4, 12.2, 8.4], w: 1.1 },                    // belly (Phecda, Merak)
      ] },
      { id: 'head', parent: 'body', pivot: [11.0, 8.6], strokes: [
        { p: [9.6, 10.0, 11.6, 12.4, 14.4, 12.8, 17.0, 13.4, 18.6, 13.0, 18.6, 12.2, 16.2, 10.6, 13.2, 9.2, 12.2, 8.4], w: 1.1 }, // head and snout (omicron)
        { p: [11.2, 12.2, 11.4, 13.6, 12.6, 13.2], w: 0.7 },                                                         // ear
        { p: [14.6, 11.8, 15.1, 11.9], w: 0.6 },                                                                      // eye
      ] },
      { id: 'tail', parent: 'body', pivot: [-10.3, 5.4], strokes: [
        { p: [-10.3, 5.4, -16.0, 6.2, -20.8, 7.3, -27.8, 4.3], w: 1.0, taper: true },                                  // the Dipper's handle
      ] },
      { id: 'fl1', parent: 'body', pivot: [9.0, 3.8], strokes: [{ p: [9.0, 3.8, 13.5, 0.6, 17.4, -0.8, 20.2, -1.6], sharp: true }] },  // to theta, iota
      { id: 'fl2', parent: 'body', pivot: [6.0, 3.2], strokes: [{ p: [6.0, 3.2, 7.4, -3.2, 7.4, -9.8, 9.2, -10.6], sharp: true }] },   // to lambda, mu
      { id: 'hl1', parent: 'body', pivot: [-7.8, 1.4], strokes: [{ p: [-7.8, 1.4, -7.8, -4.8, -5.6, -13.0, -4.2, -20.8, -2.4, -21.6], sharp: true }] }, // to nu, xi
      { id: 'hl2', parent: 'body', pivot: [-4.0, 2.0], strokes: [{ p: [-4.0, 2.0, -1.8, -8.7, -0.4, -12.4, 1.4, -12.8], sharp: true }] }, // psi
    ],
    // She lumbers along, swinging her head
    move(t) {
      const w = t * 1.7;
      return { fl1: 0.12 * S(w), fl2: -0.12 * S(w), hl1: -0.1 * S(w), hl2: 0.1 * S(w), head: 0.08 * S(w * 0.5), tail: 0.05 * S(t), dx: t * 0.25, dy: 0.2 * Math.abs(S(w)) };
    },
  },

  // Canis Major, the Great Dog: Sirius, the brightest star of all, shines on his nose. He leaps after the Hunter.
  dog: {
    con: 'CMa', center: [103.68, -21.91], color: [0.75, 0.88, 1],
    parts: [
      { id: 'body', strokes: [
        { p: [-2.4, 5.6, -3.4, 2.4, -4.2, -1.6, -4.6, -4.8], w: 1.1 },                                               // back (neck to Wezen)
        { p: [-0.6, 3.4, 0.0, 0.6, -0.8, -2.6, -2.2, -5.2, -4.0, -5.6], w: 1.1 },                                     // chest and belly
      ] },
      { id: 'head', parent: 'body', pivot: [-1.2, 4.4], strokes: [
        { p: [-2.4, 5.6, -1.6, 7.4, 0.0, 7.0, 1.4, 6.2, 2.8, 5.6, 2.6, 4.6, 0.8, 4.4, -0.6, 3.4], w: 1.1 },           // head, nose at Sirius
        { p: [-1.6, 7.4, -1.8, 9.0, 0.1, 10.0, -0.4, 7.4], w: 0.8 },                                                  // ear (pricked up)
        { p: [0.2, 6.1, 0.6, 6.1], w: 0.6 },                                                                          // eye
      ] },
      { id: 'tail', parent: 'body', pivot: [-4.6, -4.8], strokes: [{ p: [-4.6, -4.8, -5.6, -6.0, -6.5, -7.6, -7.6, -7.2], w: 0.8, taper: true }] }, // to Aludra
      { id: 'fl1', parent: 'body', pivot: [-0.2, 0.6], strokes: [{ p: [-0.2, 0.6, 3.4, 2.0, 6.0, 3.2, 7.7, 3.8], sharp: true }] },       // reaching forward to Mirzam
      { id: 'fl2', parent: 'body', pivot: [-0.6, -0.4], strokes: [{ p: [-0.6, -0.4, 2.0, -1.4, 4.4, -1.0, 5.6, -0.2], sharp: true }] },
      { id: 'hl1', parent: 'body', pivot: [-3.4, -5.2], strokes: [{ p: [-3.4, -5.2, -0.9, -7.1, 0.8, -9.2, 2.2, -9.6], sharp: true }] }, // Adhara
      { id: 'hl2', parent: 'body', pivot: [-4.2, -5.0], strokes: [{ p: [-4.2, -5.0, -5.6, -8.4, -7.6, -10.2, -9.0, -10.4], sharp: true }] },
    ],
    // He bounds along: front legs reach, back legs push, tail wagging
    move(t) {
      const w = t * 3.2, b = S(w);
      return { body: 0.08 * b, fl1: 0.3 * b, fl2: 0.35 * b, hl1: -0.3 * b, hl2: -0.3 * b, tail: 0.35 * S(t * 7), head: -0.06 * b,
        dx: t * 0.5, dy: 0.6 * Math.max(0, b) };
    },
  },

  // Scorpius, the Scorpion: red Antares is his heart. In the Greek story he chased Orion off the sky,
  // which is why the Hunter sets in the west as the Scorpion rises in the east.
  scorpion: {
    con: 'Sco', center: [251.27, -32.93], color: [1, 0.55, 0.4],
    parts: [
      { id: 'body', strokes: [
        { p: [9.2, 10.8, 7.2, 9.6, 5.4, 7.6, 3.6, 6.6, 2.0, 4.6, 0.6, 1.6, -1.1, -1.4], w: 1.6, taper: true },         // head and body, through Antares
        { p: [9.6, 9.2, 7.4, 8.0, 5.6, 6.2, 4.2, 5.2], w: 0.7 },                                                      // the body's other edge
        { p: [5.6, 7.4, 8.4, 4.6, 9.4, 3.2], w: 0.5 }, { p: [4.2, 6.0, 6.8, 2.8, 7.4, 1.2], w: 0.5 },                  // legs
        { p: [3.2, 6.6, 1.4, 9.2, 0.8, 10.8], w: 0.5 }, { p: [2.2, 5.2, -0.2, 7.0, -1.2, 8.2], w: 0.5 },
      ] },
      { id: 'tail', parent: 'body', pivot: [-1.1, -1.4], strokes: [
        { p: [-1.1, -1.4, -1.3, -5.1, -1.8, -9.5, -5.0, -10.6, -9.8, -10.9, -12.2, -8.3], w: 1.2 },                    // the tail
      ] },
      { id: 'sting', parent: 'tail', pivot: [-12.2, -8.3], strokes: [
        { p: [-12.2, -8.3, -11.3, -7.0, -9.8, -4.8, -8.6, -4.4], w: 1.2, taper: true },                                  // the stinger (Shaula)
      ] },
      { id: 'clawA', parent: 'body', pivot: [9.4, 10.6], strokes: [
        { p: [9.4, 10.6, 9.6, 13.1, 11.0, 15.4], w: 0.9 },                                                            // arm up to Acrab
        { p: [11.0, 15.4, 10.0, 17.4, 11.2, 18.6], w: 0.9, taper: true },                                              // pincer
        { p: [11.0, 15.4, 12.8, 16.6, 13.0, 18.2], w: 0.9, taper: true },
      ] },
      { id: 'clawB', parent: 'body', pivot: [10.0, 8.6], strokes: [
        { p: [10.0, 8.6, 10.5, 6.4, 13.4, 6.0], w: 0.9 },                                                            // arm out past Fang
        { p: [13.4, 6.0, 15.4, 7.6, 16.8, 7.0], w: 0.9, taper: true },
        { p: [13.4, 6.0, 15.4, 4.8, 16.8, 5.2], w: 0.9, taper: true },
      ] },
    ],
    // The tail arches and the stinger strikes; the claws snap
    move(t) {
      const c = t % 2.4, strike = c < 0.5 ? ease(c / 0.5) : 1 - ease((c - 0.5) / 1.4);
      return { tail: -0.12 * strike, sting: -0.6 * strike, clawA: 0.15 * S(t * 4), clawB: -0.15 * S(t * 4 + 1), dx: 0.4 * S(t * 0.7) };
    },
  },

  // Cygnus, the Swan (for the Greeks, Zeus in disguise), flying down the Milky Way: Deneb her tail, Albireo her beak
  swan: {
    con: 'Cyg', center: [302.66, 40.68], color: [0.88, 0.92, 1],
    parts: [
      { id: 'body', strokes: [
        { p: [-5.4, 4.9, -4.0, 2.6, -2.2, -0.4, 1.2, -4.0, 2.9, -5.6], w: 1.6, taper: 'start' },                     // body, from the tail (Deneb)
        { p: [2.9, -5.6, 5.4, -8.2, 7.4, -10.6, 9.1, -12.6], w: 0.9 },                                                // long neck
        { p: [9.1, -12.6, 10.4, -14.0], w: 0.8, taper: true },                                                        // beak (Albireo)
        { p: [-5.4, 4.9, -7.4, 7.0], w: 0.8, taper: true }, { p: [-5.4, 4.9, -5.4, 7.6], w: 0.8, taper: true }, { p: [-5.4, 4.9, -3.4, 7.0], w: 0.8, taper: true }, // tail feathers
      ] },
      { id: 'wingA', parent: 'body', pivot: [-1.6, -0.6], strokes: [
        { p: [-1.6, -0.6, 4.6, 4.6, 6.5, 11.6, 8.2, 13.7], w: 1.2, taper: true },                                     // leading edge (to Fawaris and on)
        { p: [-1.0, -2.0, 3.6, 0.6, 6.0, 5.2, 7.4, 9.6, 8.2, 13.7], w: 0.6 },                                         // feathers' edge
      ] },
      { id: 'wingB', parent: 'body', pivot: [-2.8, -1.0], strokes: [
        { p: [-2.8, -1.0, -7.4, -6.4, -10.6, -8.0, -13.8, -9.6], w: 1.2, taper: true },                                // to Aljanah and zeta
        { p: [-1.6, -2.6, -6.0, -7.6, -10.0, -9.6, -13.8, -9.6], w: 0.6 },
      ] },
    ],
    // Slow, strong wingbeats as she glides along the Milky Way toward her beak
    move(t) {
      const f = S(t * 2.2);
      return { wingA: 0.22 * f, wingB: -0.22 * f, dx: t * 0.3, dy: -t * 0.33 };
    },
  },

  // The zodiac: the Sun's yearly path round the sky (the ecliptic) with the twelve signs the Babylonians
  // named, drawn in one long sweep around you. Drawn on the ecliptic itself (frame 'ecliptic': x is
  // minus the ecliptic longitude, so x still runs to the west; y is ecliptic latitude).
  zodiac: {
    con: null, frame: 'ecliptic', center: [0, 0], color: [1, 0.85, 0.5],
    gen(t) {
      if (!ZODIAC) ZODIAC = buildZodiac();
      const glow = 1 + 0.12 * S(t * 2);
      return ZODIAC.map((s) => (s.glyph ? { ...s, w: s.w * glow } : s));
    },
  },

  // The Pleiades, the seven sisters, who became doves (Greek story): seven little birds that flutter
  doves: {
    con: 'Tau', center: [56.75, 24.12], color: [0.8, 0.9, 1],
    // each dove circles near her own star, wings beating, then they all fly off together, away from Orion
    gen(t) {
      const out = [], away = Math.max(0, t - 6) * 0.9;
      [[0.3, 0.3], [-0.6, -0.2], [0.9, -0.5], [-0.2, 0.9], [-1.1, 0.5], [0.6, 1.2], [1.4, 0.3]].forEach(([x, y], i) => {
        const a = t * (0.9 + i * 0.07) + i * 0.9, r = 0.35 + 0.1 * (i % 3);
        const cx = x * 1.4 + Math.cos(a) * r + away * (1 + i * 0.08), cy = y * 1.4 + Math.sin(a) * r * 0.6 + away * 0.35;
        const flap = S(t * 9 + i * 1.7), k = 0.55;
        out.push({ pts: [cx - k, cy + k * 0.55 * flap, cx - k * 0.45, cy + k * 0.2 + k * 0.15 * flap, cx, cy, cx + k * 0.45, cy + k * 0.2 + k * 0.15 * flap, cx + k, cy + k * 0.55 * flap], w: 0.55, taper: false, part: 'b' + i });
      });
      return out;
    },
  },
};

// The twelve sign symbols, each drawn in a box from -1 to 1, in order from Aries
const GLYPHS = [
  [[-0.9, 0.4, -0.8, 0.9, -0.4, 0.95, -0.1, 0.5, 0, -0.9], [0.9, 0.4, 0.8, 0.9, 0.4, 0.95, 0.1, 0.5, 0, -0.9]],                      // Aries, the Ram
  [[0, 0.15, 0.5, -0.05, 0.5, -0.65, 0, -0.85, -0.5, -0.65, -0.5, -0.05, 0, 0.15], [-0.9, 0.9, -0.5, 0.3, 0, 0.15, 0.5, 0.3, 0.9, 0.9]], // Taurus, the Bull
  [[-0.7, 0.85, 0, 0.75, 0.7, 0.85], [-0.7, -0.85, 0, -0.75, 0.7, -0.85], [-0.35, 0.78, -0.35, -0.78], [0.35, 0.78, 0.35, -0.78]],   // Gemini, the Twins
  [[0.8, 0.2, 0.3, 0.7, -0.4, 0.65, -0.8, 0.3, -0.55, 0.05, -0.3, 0.3, -0.55, 0.5], [-0.8, -0.2, -0.3, -0.7, 0.4, -0.65, 0.8, -0.3, 0.55, -0.05, 0.3, -0.3, 0.55, -0.5]], // Cancer, the Crab
  [[-0.5, -0.12, -0.78, -0.4, -0.5, -0.68, -0.22, -0.4, -0.3, 0.3, 0.1, 0.8, 0.5, 0.4, 0.2, -0.4, 0.5, -0.8, 0.9, -0.6]],             // Leo, the Lion
  [[-0.9, 0.6, -0.8, -0.8], [-0.8, 0.4, -0.55, 0.7, -0.3, 0.4, -0.3, -0.8], [-0.3, 0.4, -0.05, 0.7, 0.2, 0.4, 0.2, -0.5, 0.5, -0.9], [0.2, 0, 0.7, 0.2, 0.8, -0.2, 0.5, -0.9]], // Virgo, the Maiden
  [[-0.9, -0.6, 0.9, -0.6], [-0.9, -0.1, -0.35, -0.1, -0.45, 0.4, 0, 0.75, 0.45, 0.4, 0.35, -0.1, 0.9, -0.1]],                       // Libra, the Scales
  [[-0.9, 0.6, -0.85, -0.6], [-0.85, 0.4, -0.55, 0.7, -0.35, 0.4, -0.35, -0.6], [-0.35, 0.4, -0.05, 0.7, 0.15, 0.4, 0.15, -0.5, 0.5, -0.8, 0.85, -0.5], [0.55, -0.4, 0.85, -0.5, 0.8, -0.85]], // Scorpio
  [[-0.8, -0.8, 0.8, 0.8], [0.15, 0.8, 0.8, 0.8, 0.8, 0.15], [-0.6, 0.1, 0.1, -0.6]],                                                // Sagittarius, the Archer
  [[-0.9, 0.6, -0.6, 0.85, -0.45, 0.2, -0.3, -0.7], [-0.3, -0.7, 0, 0.6, 0.3, 0.7, 0.45, 0.1, 0.3, -0.4, 0.7, -0.5, 0.8, -0.15, 0.5, 0.05, 0.3, -0.4]], // Capricorn, the Sea-goat
  [[-0.9, 0.2, -0.55, 0.55, -0.2, 0.2, 0.15, 0.55, 0.5, 0.2, 0.85, 0.55], [-0.9, -0.45, -0.55, -0.1, -0.2, -0.45, 0.15, -0.1, 0.5, -0.45, 0.85, -0.1]], // Aquarius, the Water-bearer
  [[-0.7, 0.9, -0.35, 0, -0.7, -0.9], [0.7, 0.9, 0.35, 0, 0.7, -0.9], [-0.6, 0, 0.6, 0]],                                           // Pisces, the Fishes
];
const SHARP = new Set([2, 6, 8, 10]);
let ZODIAC = null;
// The signs as the Babylonians laid them out: Aries begins about 27 degrees along today's (J2000) ecliptic
function buildZodiac() {
  const out = [], start = 27, size = 2.6;
  for (let k = 0; k < 12; k++) {
    const arc = []; for (let l = 0; l <= 30; l += 2) arc.push(-(start + k * 30 + l), 0);
    out.push({ pts: arc, w: 0.7, taper: false, part: 'ring' });
    const cx = -(start + k * 30 + 15), cy = 4.2;
    for (const g of GLYPHS[k]) {
      const pts = g.map((v, i) => (i % 2 ? cy + v * size : cx + v * size));
      out.push({ pts: SHARP.has(k) ? pts : smooth(pts, false, false), w: 0.9, taper: false, part: 'g' + k, glyph: true });
    }
  }
  return out;
}

// ---------- Laying a figure out at time t (used by js/skyfigures.js and the preview tool) ----------
// Returns the strokes as smooth 2D polylines: [{ pts: [x, y, ...], w, taper, closed }], in degrees.
function smooth(p, closed, sharp) {
  const n = p.length / 2;
  if (sharp || n < 3) return p.slice();
  const out = [], P = (i) => { i = closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i)); return [p[i * 2], p[i * 2 + 1]]; };
  const segs = closed ? n : n - 1, steps = 5;
  for (let i = 0; i < segs; i++) {
    const [x0, y0] = P(i - 1), [x1, y1] = P(i), [x2, y2] = P(i + 1), [x3, y3] = P(i + 2);
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(f(x0, x1, x2, x3), f(y0, y1, y2, y3));
    }
  }
  const [xe, ye] = closed ? P(0) : P(n - 1); out.push(xe, ye);
  return out;
}
const cache = new WeakMap();
export function layout(fig, t, out = []) {
  out.length = 0;
  if (fig.gen) { for (const s of fig.gen(t)) out.push(s); return out; }
  const m = fig.move ? fig.move(t) : {};
  if (!cache.has(fig)) cache.set(fig, fig.parts.map((pt) => pt.strokes.map((s) => smooth(s.p, s.closed, s.sharp))));
  const sm = cache.get(fig), xf = {};
  fig.parts.forEach((pt, i) => {
    // this part's transform: turn by its angle about its pivot, then its parent's transform
    const a = m[pt.id] || 0, c = Math.cos(a), s = Math.sin(a), [px, py] = pt.pivot || [0, 0];
    const par = pt.parent ? xf[pt.parent] : null;
    const T = (x, y) => { const dx = x - px, dy = y - py; let X = px + dx * c - dy * s, Y = py + dx * s + dy * c; return par ? par(X, Y) : [X + (m.dx || 0), Y + (m.dy || 0)]; };
    xf[pt.id] = T;
    pt.strokes.forEach((st, j) => {
      const src = sm[i][j], pts = new Array(src.length);
      for (let k = 0; k < src.length; k += 2) { const [X, Y] = T(src[k], src[k + 1]); pts[k] = X; pts[k + 1] = Y; }
      out.push({ pts, w: st.w || 1, taper: st.taper || false, part: pt.id });
    });
  });
  return out;
}
