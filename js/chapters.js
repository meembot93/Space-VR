// The chapters of Era 1 and Era 2, and the director that runs them.
//
// A chapter module (js/chapters/*.js) exports a class with:
//   constructor(G)          build the place: ground, models, people (and register interactables)
//   start                   where you stand: { x, z, yaw }
//   async run(D)            the story, written top to bottom with the director's helpers:
//                             await D.say('ch2_03')         narration line (Meem's clip or subtitle)
//                             await D.until(() => cond, s)  wait for something (or s seconds)
//                             await D.wait(s)               just wait
//                             await D.auto(cond, step, o)   a player action that plays itself in Kids mode
//                             D.hint(text, s)               an instruction; hidden in Kids mode
//
// Kids mode (G.kids, the default) is fully hands-free: the kid just watches. Every wait on the
// player goes through D.auto: in Adults mode it waits for cond (up to o.timeout s, false if it ran
// out); in Kids mode, after o.after s (default 2), step(dt) runs every frame until cond is true,
// so Astra or the people do the action themselves. Use D.hint (not G.ui.showHint) for "do this"
// hints, and D.goTo(pos, yaw) instead of asking a kid to walk somewhere.
//   update(dt, t)           animate every frame (on every headset)
//   act(a, player)          a player's action, e.g. { type: 'pull', amount } (host only)
//   getState() / setState() the shared progress, as plain data, so friends' headsets match
//   dispose()               remove everything
//
// In multiplayer only the host runs run(); friends get the state and the narration lines.
export const CHAPTERS = [
  { n: 1, title: 'Campfire, 30,000 years ago', ready: true, load: () => import('./chapters/campfire.js') },
  { n: 2, title: 'Stonehenge at dawn', ready: true, load: () => import('./chapters/stonehenge.js') },
  { n: 3, title: 'Sirius over the Nile', ready: true, load: () => import('./chapters/nile.js') },
  { n: 4, title: 'Babylon predicts an eclipse', ready: true, load: () => import('./chapters/babylon.js') },
  { n: 5, title: 'Greece proves the Earth is round', ready: true, load: () => import('./chapters/greece.js') },
  { n: 6, title: 'Diving for the Antikythera machine', ready: true, load: () => import('./chapters/antikythera.js') },
  { n: 7, title: 'Ptolemy’s spinning sky', ready: true, load: () => import('./chapters/ptolemy.js') },
  // Era 2: The Telescope and the Rocket. Numbered on from Era 1 inside the game (line ids ch8_.. to
  // ch14_..); the title page and the flights call them Era 2, Chapters 1 to 7 (see chapterLabel).
  { n: 8, era: 2, title: 'Copernicus moves the Sun', ready: true, load: () => import('./chapters/copernicus.js') },
  { n: 9, era: 2, title: 'Tycho’s new star', ready: true, load: () => import('./chapters/tycho.js') },
  { n: 10, era: 2, title: 'Kepler’s ellipses', ready: true, load: () => import('./chapters/kepler.js') },
  { n: 11, era: 2, title: 'Galileo’s telescope', ready: false, load: () => import('./chapters/galileo.js') },
  { n: 12, era: 2, title: 'Newton’s apple and cannon', ready: true, load: () => import('./chapters/newton.js') },
  { n: 13, era: 2, title: 'The rocket dreamers', ready: false, load: () => import('./chapters/rockets.js') },
  { n: 14, era: 2, title: 'Sputnik', ready: true, load: () => import('./chapters/sputnik.js') },
];
for (const c of CHAPTERS) c.era ||= 1;

// The eras, and a chapter's number within its era (Era 2's first chapter is n 8, shown as Chapter 1)
export const ERAS = {
  1: { title: 'Watchers of the Sky', sub: 'Thirty thousand years of people looking up.' },
  2: { title: 'The Telescope and the Rocket', sub: 'From a Sun in the middle to a beep from space.' },
};
export const chapterNum = (n) => { const c = CHAPTERS.find((x) => x.n === n); return c ? CHAPTERS.filter((x) => x.era === c.era && x.n <= n).length : n; };
export const chapterLabel = (n) => { const c = CHAPTERS.find((x) => x.n === n); return c?.era > 1 ? `Era ${c.era}, Chapter ${chapterNum(n)}` : `Chapter ${n}`; };

import { VIEW } from './people.js';
import { LINES } from './script.js';

class Stop extends Error {}

export class Director {
  constructor(G) { this.G = G; this.chapter = null; this.n = 0; this.token = 0; }

  // Build chapter n (every headset). Resolves when it's ready to play.
  async load(n) {
    const G = this.G, info = CHAPTERS.find((c) => c.n === n);
    if (!info?.ready) throw new Error('Chapter ' + n + ' is not built yet');
    this.stop(); VIEW.cam = G.camera;
    G.extras?.dispose();
    if (this.chapter) { this.chapter.dispose(); this.chapter = null; }
    G.interactables.length = 0;
    const mod = await info.load();
    this.chapter = new mod.default(G);
    G.guide.follow(); G.guide.place();
    G.sky.budget(G.scene);   // the rest of the triangle budget goes on the stars
    this.n = n; this.info = info;
    G.narration.preload(`ch${n}_`);
    await G.extras?.load(n, this.chapter);   // wow moments, sky figures, cameos (js/extras.js)
    return this.chapter;
  }

  // Run the story (host). Everyone's view fades in.
  async play() {
    const G = this.G, ch = this.chapter, token = ++this.token;
    this.running = true;
    G.events.emit('chapterStart', { n: this.n });
    try {
      const D = this.helpers(token);
      await ch.run(D);
      await G.extras?.outro(D);
      if (token === this.token) G.events.emit('chapterEnd', { n: this.n });
    } catch (e) { if (!(e instanceof Stop)) console.error(e); }
    if (token === this.token) this.running = false;
  }

  stop() { this.token++; this.running = false; this.G.narration.stop(); this.waits = []; }

  helpers(token) {
    const G = this.G, check = () => { if (token !== this.token) throw new Stop(); };
    const D = {
      say: async (id) => { check(); G.events.emit('say', { id }); await G.narration.say(id); check(); await G.extras?.after(id, D); check(); },
      wait: (s) => D.until(() => false, s),
      until: (cond, timeout = Infinity, step = null) => new Promise((ok, fail) => {
        const w = { cond, left: timeout, ok, fail, token, step };
        (this.waits ||= []).push(w);
      }).then((r) => { check(); return r; }),
      // say a line while something else happens: returns the promise without waiting
      sayAsync: (id) => D.say(id).catch(() => {}),
      // Time something to the words of the line being said: waits until the narration reaches
      // `at`, either a fraction (0.5 = halfway) or a word or phrase from the line ('full Moon').
      // Use with sayAsync:  const l = D.sayAsync('ch1_08'); await D.cue('walk by'); s.x = 1; await l;
      cue: (at) => {
        const c = G.narration.cur; let f = at;
        if (typeof at === 'string') { const txt = LINES[c?.id] || ''; const i = txt.indexOf(at); f = i < 0 ? 0 : i / Math.max(1, txt.length); }
        return D.until(() => !G.narration.cur || G.narration.cur !== c || G.narration.progress() >= f);
      },
      // Kids mode: hands-free (see the top of this file)
      get kids() { return !!G.kids; },
      hint: (text, secs) => { if (!G.kids || !text) G.ui.showHint(G.kids ? '' : text, secs); },
      auto: async (cond, step, { after = 2, timeout = Infinity } = {}) => {
        if (!G.kids) return D.until(cond, timeout);
        let t = 0;
        await D.until(cond, Infinity, (dt) => { t += dt; if (t >= after) step?.(dt); });
        return true;
      },
      // move everyone to a spot with a quick fade (instead of asking a kid to walk there)
      goTo: async (pos, yaw) => {
        await G.ui.fadeOut(0.6); check();
        G.events.emit('placePlayers', { x: pos.x, z: pos.z, yaw });
        await G.ui.fadeIn(0.8); check();
      },
      check,
    };
    return D;
  }

  update(dt) {
    if (this.waits?.length) {
      for (const w of [...this.waits]) {
        if (w.token !== this.token) { this.waits.splice(this.waits.indexOf(w), 1); w.fail(new Stop()); continue; }
        w.left -= dt;
        if (w.step) { try { w.step(dt); } catch (e) { console.error(e); } }
        let done = false, timedOut = false;
        try { done = !!w.cond(); } catch (e) { console.error(e); done = true; }
        if (!done && w.left <= 0) { done = true; timedOut = true; }
        if (done) { this.waits.splice(this.waits.indexOf(w), 1); w.ok(!timedOut); }
      }
    }
    this.chapter?.update(dt, this.G.t);
  }
}
