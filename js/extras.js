// Extras: the big "wow" moments, living constellations and cameo characters layered on top of a
// chapter, kept in their own files (js/wow/chN.js) so the chapter's own story file stays as it is.
//
// A chapter's extras module exports a class:
//   constructor(G, chapter)   build anything it needs (hidden until its moment)
//   line(id)                  a narration line just started, on every headset (id like 'ch4_09')
//   lineEnd(id)               ...and finished
//   extra(d)                  the host did G.events.emit('extra', d): sent to every headset
//   async after(id, D)        host only: runs after a line, before the story carries on. Return a
//                             promise (e.g. D.wait(6)) to hold the story while something plays.
//   async outro(D)            host only: after the chapter's story, before "End of Chapter"
//   update(dt, t)             every frame (stops while paused)
//   dispose()
// Line timing: G.since(id) gives seconds since that line began (or -1), so a moment can land on
// a word in the middle of a line.
const MODULES = {
  1: () => import('./wow/ch1.js'),
  2: () => import('./wow/ch2.js'),
  3: () => import('./wow/ch3.js'),
  4: () => import('./wow/ch4.js'),
  5: () => import('./wow/ch5.js'),
  6: () => import('./wow/ch6.js'),
  7: () => import('./wow/ch7.js'),
  8: () => import('./wow/ch8.js'),
  9: () => import('./wow/ch9.js'),
};

export class Extras {
  constructor(G) {
    this.G = G; this.mod = null; this.started = {};
    G.events.on('narrating', ({ id, on }) => {
      if (on) { this.started[id] = G.t; this.call('line', id); } else this.call('lineEnd', id);
    });
    // the host starts some moments that aren't tied to a line (e.g. the finale): every headset plays them
    G.events.on('extra', (d) => this.call('extra', d));
    G.since = (id) => (this.started[id] == null ? -1 : G.t - this.started[id]);
  }

  call(fn, ...a) { try { return this.mod?.[fn]?.(...a); } catch (e) { console.error(e); } return undefined; }

  async load(n, chapter) {
    this.dispose();
    this.started = {};
    const load = MODULES[n];
    if (!load) return;
    try {
      const m = await load();
      this.mod = new m.default(this.G, chapter);
    } catch (e) { console.warn('extras for chapter', n, e); this.mod = null; }
  }

  async after(id, D) { const p = this.call('after', id, D); if (p) await p; }
  async outro(D) { const p = this.call('outro', D); if (p) await p; }
  update(dt, t) { this.call('update', dt, t); }
  dispose() { this.call('dispose'); this.mod = null; }
}
