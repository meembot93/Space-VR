// Multiplayer: up to 4 people share one journey. One hosts and reads out a 4-letter room code;
// friends type it next to Join. The host's headset runs the story (narration, the rope, the
// Sun); friends' headsets follow the host's state and hear the same lines at the same time.
// Voice chat is built in (voice.js). Same design as Broadside VR; see docs/MULTIPLAYER.md.
//
// Messages: friend -> host: hello, p (pose), a (action)
//           host -> friend: welcome, s (state + everyone's pose, 20/s), e (event), bye
import { openRoom, joinRoom } from './transport.js';
import { RemotePlayer } from './avatar.js';
import { Voice } from './voice.js';
import { VERSION } from '../version.js';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (they look like 1 and 0)
const FORWARD = ['say', 'sfx', 'placePlayers', 'chapterStart', 'chapterEnd', 'kids', 'pause', 'extra'];

export class Net {
  constructor(G) {
    this.G = G;
    this.mode = null;        // null (alone), 'host' or 'friend'
    this.links = new Map();  // host: player id -> link
    this.avatars = new Map();// player id -> RemotePlayer
    this.sendT = 0;
    this.voice = new Voice(G, this);
    G.events.on('*', (name, data) => {
      if (this.mode !== 'host' || !FORWARD.includes(name)) return;
      for (const l of this.links.values()) l.send({ t: 'e', n: name, d: data });
    });
  }

  get on() { return !!this.mode; }

  // ---------- Host ----------
  async host(name) {
    const G = this.G;
    for (let tries = 0; tries < 5; tries++) {
      const code = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
      try {
        this.room = await openRoom(code, (link) => this.onLink(link));
        this.mode = 'host'; this.code = code; G.player.name = name || 'Host';
        this.voice.attach(this.room.peer);
        return code;
      } catch (e) { if (e.message !== 'taken') throw e; }
    }
    throw new Error('taken');
  }

  onLink(link) {
    const G = this.G;
    let pl = null;
    link.onMessage = (m) => {
      if (m.t === 'hello' && !pl) {
        if (m.v !== VERSION) { link.send({ t: 'bye', why: 'version:' + VERSION }); setTimeout(() => link.close(), 500); return; }
        const used = new Set([0, ...[...this.avatars.values()].map((a) => a.seat)]);
        const seat = [1, 2, 3].find((s) => !used.has(s));
        if (seat == null) { link.send({ t: 'bye', why: 'full' }); setTimeout(() => link.close(), 500); return; }
        pl = new RemotePlayer(G, 'player:' + seat, m.name, m.peer);
        this.avatars.set(pl.id, pl); this.links.set(pl.id, link); G.players.push(pl);
        link.send({ t: 'welcome', id: pl.id, kids: G.kids, ch: G.director.n, playing: !!G.director.running });
        G.ui.showHint(`${pl.name} joined`, 3);
      } else if (!pl) return;
      else if (m.t === 'p') pl.setPose(m.p);
      else if (m.t === 'a') G.applyAction({ ...m.a, player: pl.id });
    };
    link.onClose = () => {
      if (!pl) return;
      this.avatars.delete(pl.id); this.links.delete(pl.id); G.players.splice(G.players.indexOf(pl), 1);
      pl.dispose(); this.voice.drop(pl.id); G.ui.showHint(`${pl.name} left`, 3);
    };
  }

  // ---------- Friend ----------
  async join(code, name) {
    const G = this.G;
    const link = await joinRoom(code);
    const welcome = await new Promise((ok, fail) => {
      link.onMessage = (m) => { if (m.t === 'welcome') ok(m); else if (m.t === 'bye') fail(new Error(m.why || 'closed')); };
      link.onClose = () => fail(new Error('closed'));
      link.send({ t: 'hello', v: VERSION, name, peer: link.peer?.id || null });
    });
    this.mode = 'friend'; this.link = link; this.code = code;
    G.isHost = false; G.player.id = welcome.id; G.player.name = name || 'Friend';
    G.setKids?.(welcome.kids);
    link.onMessage = (m) => this.fromHost(m);
    link.onClose = () => { this.mode = null; G.hostLeft?.(); };
    this.voice.attach(link.peer);
    return welcome;
  }

  async fromHost(m) {
    const G = this.G;
    if (m.t === 's') {
      if (m.ch && G.director.n !== m.ch && !this.loading) {
        this.loading = true;
        try { await G.director.load(m.ch); } finally { this.loading = false; }
      }
      if (m.st && G.director.chapter && G.director.n === m.ch) G.director.chapter.setState(m.st);
      G.director.running = m.run;
      const seen = new Set();
      for (const [id, name, peer, pose] of m.pl) {
        if (id === G.player.id) continue;
        seen.add(id);
        let a = this.avatars.get(id);
        if (!a) { a = new RemotePlayer(G, id, name, peer); this.avatars.set(id, a); G.players.push(a); }
        a.peer = peer; if (pose) a.setPose(pose);
      }
      for (const [id, a] of this.avatars) if (!seen.has(id)) { this.avatars.delete(id); G.players.splice(G.players.indexOf(a), 1); a.dispose(); }
    } else if (m.t === 'e') G.onNetEvent(m.n, m.d);
    else if (m.t === 'bye') { this.link?.close(); }
  }

  // A friend's action goes to the host
  sendAction(a) { this.link?.send({ t: 'a', a }); }

  leave() {
    try { if (this.mode === 'host') { for (const l of this.links.values()) l.send({ t: 'bye', why: 'closed' }); this.room?.close(); } else this.link?.close(); } catch (e) { /* gone */ }
  }

  update(dt) {
    const G = this.G;
    for (const a of this.avatars.values()) a.update(dt);
    this.voice.update(dt);
    if (!this.mode) return;
    this.sendT -= dt; if (this.sendT > 0) return; this.sendT = 0.05;
    const me = G.mode ? G.player.pose() : null;
    if (this.mode === 'friend') { if (me) this.link?.send({ t: 'p', p: me }); return; }
    const pl = [[G.player.id, G.player.name, this.room?.peer?.id || null, me], ...[...this.avatars.values()].map((a) => [a.id, a.name, a.peer, a.target])];
    const msg = { t: 's', ch: G.director.n || 0, st: G.director.chapter?.getState() || null, run: !!G.director.running, pl };
    for (const l of this.links.values()) l.send(msg);
  }
}
