// Starward (Era 1, Watchers of the Sky; Era 2, The Telescope and the Rocket). Boots the 3D world, the title screen and the chapters.
import * as THREE from 'three';
import { Sky } from './sky.js';
import { Sound } from './audio.js';
import { Events } from './events.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { Narration } from './narration.js';
import { Guide } from './guide.js';
import { CHAPTER_ICONS } from './icons.js';
import { Director, CHAPTERS, ERAS, chapterNum, chapterLabel, partNum } from './chapters.js';
import { makeWorld } from './world.js';
import { Net } from './net/net.js';
import { Music } from './music.js';
import { Stargazing } from './stargazing.js';
import { Soundscape } from './soundscape.js';
import { Flight } from './flight.js';
import { Opening } from './opening.js';
import { Atmosphere } from './atmosphere.js';
import { VERSION } from './version.js';
import { Extras } from './extras.js';
import { SkyFigures } from './skyfigures.js';
import { Graphics, detectLevel } from './graphics.js';

const params = new URLSearchParams(location.search);
const G = window.G = { t: 0, mode: null, params, debug: params.has('debug'), isHost: true, started: false };
G.events = new Events();
G.interactables = [];

// ---------- Renderer, scene, camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
// Sharpness, foveation and shadows come from the Graphics setting (js/graphics.js)
document.body.appendChild(renderer.domElement);
G.renderer = renderer;

const scene = G.scene = new THREE.Scene();
const camera = G.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 2500);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

G.gfx = new Graphics(G);
G.world = makeWorld();
G.sky = new Sky(scene);
G.audio = new Sound();
G.player = new Player(G);
G.players = [G.player];
G.ui = new UI(G);
G.narration = new Narration(G);
G.guide = new Guide(G);
G.director = new Director(G);
G.net = new Net(G);
G.music = new Music(G);
G.stargazing = new Stargazing(G);
G.soundscape = new Soundscape(G);
G.flight = new Flight(G);
G.opening = new Opening(G);
G.atmosphere = new Atmosphere(G);
G.skyFigures = new SkyFigures(G);
G.extras = new Extras(G);
G.player.setupVR(renderer);

// ---------- Settings on the title screen (remembered on this headset) ----------
const store = {
  get: (k, d) => { try { return localStorage.getItem('starward.' + k) ?? d; } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem('starward.' + k, v); } catch (e) { /* private mode */ } },
};
function choice(id, key, def, apply) {
  const wrap = document.getElementById(id), cur = store.get(key, def);
  for (const b of wrap.querySelectorAll('button')) {
    b.classList.toggle('on', b.dataset.v === cur);
    b.addEventListener('click', () => {
      if (wrap.dataset.hostOnly && !G.isHost) return;
      store.set(key, b.dataset.v);
      for (const o of wrap.querySelectorAll('button')) o.classList.toggle('on', o === b);
      apply(b.dataset.v);
    });
  }
  apply(cur);
}
// Kids (default) or Adults, picked on the title page. Kids mode is hands-free: every chapter plays
// itself (see D.auto in js/chapters.js) and the eclipse in Chapter 4 is wonder, not fear. Adults is
// interactive. The host's setting applies to everyone.
G.setKids = (on) => { G.kids = !!on; G.events.emit('kids', { on: G.kids }); for (const b of document.querySelectorAll('#rating button')) b.classList.toggle('on', (b.dataset.v === 'kids') === G.kids); };
choice('rating', 'rating', params.get('rating') || 'kids', (v) => G.setKids(v !== 'adults'));
choice('turning', 'turn', 'snap', (v) => { G.player.smoothTurn = v === 'smooth'; });
// Seated (default) or Standing. Seated lifts your eyes to a grown-up's standing height when VR
// starts, so sitting down or being small doesn't put you near the ground. Either way, holding a
// thumbstick in for a second resets your height (js/player.js).
choice('posture', 'posture', params.get('posture') || 'seated', (v) => G.player.setSeated(v === 'seated'));
// Graphics: High on Quest 3 / Quest Pro / PC, Standard on Quest 2. Switching rebuilds the chapter
// (so the characters load with the right textures).
let gfxFirst = true;
choice('gfx', 'gfx', params.get('gfx') || detectLevel(), (v) => {
  G.gfx.set(v);
  if (!gfxFirst && G.isHost && !G.started) loading = G.director.load(chapterPick).catch((e) => { note.textContent = e.message; });
  gfxFirst = false;
});
choice('subs', 'subs', 'on', (v) => { G.ui.subsOn = v === 'on'; G.ui.subtitle(G.ui.subText || ''); });

// ---------- Your place in the story (remembered on this headset) ----------
// Every chapter you finish gets a tick on the title page, and the title page picks up where you
// left off: the chapter you were in the middle of, or the next one after the last you finished.
const progress = {
  done: new Set(String(store.get('done', '')).split(',').map(Number).filter(Boolean)),
  resume: Number(store.get('resume', 0)) || 0,
  save() { store.set('done', [...this.done].sort((a, b) => a - b).join(',')); store.set('resume', String(this.resume)); },
};
const readyN = (n) => CHAPTERS.find((c) => c.n === n && c.ready)?.n || 0;

// Chapter list, one group per era: only chapters that are built can be picked
let chapterPick = Number(params.get('chapter')) || readyN(progress.resume) || CHAPTERS.find((c) => c.ready).n;
const chapList = document.getElementById('chapters');
const chapButtons = [];
const pickChapter = (n) => { chapterPick = n; for (const o of chapButtons) o.classList.toggle('on', Number(o.dataset.n) === n); showEra(); };
// the line under the title follows the era of the chapter you've picked
function showEra() {
  const era = CHAPTERS.find((c) => c.n === chapterPick)?.era || 1, E = ERAS[era];
  document.getElementById('eraLine').textContent = `Era ${era} · ${E.title}`;
  document.getElementById('eraSub').textContent = E.sub;
}
let eraShown = 0;
for (const c of CHAPTERS) {
  if (c.era !== eraShown) {
    eraShown = c.era;
    const h = document.createElement('div'); h.className = 'eraHead'; h.textContent = `Era ${c.era} · ${ERAS[c.era].title}`;
    chapList.appendChild(h);
  }
  const b = document.createElement('button'); b.dataset.n = c.n;
  b.innerHTML = `<span class="ico">${CHAPTER_ICONS[c.n] || ''}</span><span>${chapterNum(c.n)}${c.group ? '.' + partNum(c.n) : ''}. ${c.title}${c.ready ? '' : ' (coming soon)'}</span>`;
  b.disabled = !c.ready; b.classList.toggle('on', c.n === chapterPick);
  b.addEventListener('click', () => { if (G.isHost) pickChapter(c.n); });
  chapList.appendChild(b); chapButtons.push(b);
}
// ticks on the chapters you've finished, and "Start from the beginning" once you've begun
const startOver = document.createElement('button'); startOver.className = 'startOver'; startOver.textContent = 'Start from the beginning';
startOver.addEventListener('click', () => { if (G.isHost) pickChapter(CHAPTERS.find((c) => c.ready).n); });
chapList.appendChild(startOver);
function showTicks() {
  for (const b of chapButtons) {
    const n = Number(b.dataset.n); let t = b.querySelector('.tick');
    if (progress.done.has(n) && !t) { t = document.createElement('span'); t.className = 'tick'; t.textContent = '\u2713'; t.title = 'Finished'; b.appendChild(t); }
  }
  startOver.style.display = progress.done.size || progress.resume > 1 ? 'block' : 'none';
}
showTicks();
showEra();

// ---------- Actions: everything a player does to the story goes through here ----------
// On the host it goes straight to the chapter; a friend's headset sends it to the host.
G.applyAction = (a) => {
  if (a.type === 'pause') { G.setPaused(!G.paused); return true; }
  return G.director.chapter?.act(a, G.players.find((p) => p.id === a.player)) || false;
};
G.act = (a) => {
  if (G.isHost) return G.applyAction({ player: G.player.id, ...a });
  G.net.sendAction(a); return true;
};

// Story events that every headset reacts to (the host gets them directly, friends over the network)
function spread(x, z, yaw, seat) {
  // friends stand in a little arc beside the host so nobody is inside anybody
  if (!seat) return [x, z];
  const side = [0, -1.1, 1.1, -2.2][seat] || 0;
  return [x + Math.cos(yaw) * side, z - Math.sin(yaw) * side];
}
G.onNetEvent = (name, d) => {
  if (name === 'say') G.narration.say(d.id);
  else if (name === 'sfx') sfx(d.k);
  else if (name === 'placePlayers') placeMe(d);
  else if (name === 'chapterStart') { G.ui.fadeIn(2.5); G.music.play('ch' + d.n); }
  else if (name === 'chapterEnd') { chapterEnded(); G.music.stop(5); }
  else if (name === 'kids') G.setKids(d.on);
  else if (name === 'pause') setPaused(d.on, true);
  else if (name === 'extra') G.events.emit('extra', d);   // a wow moment the host started (js/extras.js)
};

// ---------- Pause (A or X in VR, P on desktop) ----------
// Everything in the story stops: Astra's voice, the Sun, the builders. You can still look around.
// In a group, anyone can pause and it pauses for everybody (the host decides).
function setPaused(on, fromHost) {
  on = !!on;
  if (on === !!G.paused) return;
  G.paused = on;
  G.narration.pause(on);
  G.player.frozen = on;
  G.ui.setPaused(on);
  if (G.isHost && !fromHost) G.events.emit('pause', { on });
}
G.setPaused = (on) => setPaused(on);

// The pause menu (host only; a friend's pause card just says how to carry on). Chapter jumps are
// left out while the story is between chapters (the flight), so nothing starts twice.
let between = false, jumping = false;
G.pauseMenu = () => {
  if (!G.isHost) return null;
  const n = G.director.n, items = [{ key: 'resume', label: 'Carry on' }];
  if (!between && !jumping && !G.flight.active) {
    items.push({ key: 'restart', label: 'Restart this chapter' });
    if (readyN(n + 1)) items.push({ key: 'next', label: 'Skip to the next chapter' });
    if (readyN(n - 1)) items.push({ key: 'prev', label: 'Back to the chapter before' });
  }
  items.push({ key: 'ff', label: G.ff ? 'Fast forward: ON (turn off)' : 'Fast forward (for reviewing)' });
  if (!between && !jumping && !G.flight.active) items.push({ key: 'title', label: 'Back to the title page' });
  return items;
};
G.menuPick = (key) => {
  const n = G.director.n;
  if (key === 'resume') setPaused(false);
  else if (key === 'restart') jumpTo(n);
  else if (key === 'next') jumpTo(readyN(n + 1));
  else if (key === 'prev') jumpTo(readyN(n - 1));
  else if (key === 'ff') { setFastForward(!G.ff); setPaused(false); }
  else if (key === 'title') toTitle();
};
// Fast forward: the story runs four times faster and each line of narration is cut short after a
// moment (its subtitle still flashes up), so you can whizz through a chapter to check things
G.ff = false;
function setFastForward(on) {
  G.ff = !!on;
  G.ui.showHint(G.ff ? '\u23E9 Fast forward on (pause to turn it off)' : 'Normal speed', 3);
}
// Go straight to chapter n (restart, skip on or back)
async function jumpTo(n) {
  if (!n || jumping) return;
  jumping = true;
  setPaused(false);
  G.director.stop(); G.music.stop(1);
  await G.ui.fadeOut(0.8);
  G.ui.subtitle(''); G.ui.showHint('');
  pickChapter(n);
  try { await G.director.load(n); } catch (e) { console.error(e); }
  jumping = false;
  G.director.play();
}
// Back to the title page, keeping your place (you can carry on from this chapter later)
async function toTitle() {
  setPaused(false); setFastForward(false); G.ui.showHint('');
  G.director.stop(); G.music.stop(1);
  await G.ui.fadeOut(0.8);
  G.ui.subtitle('');
  G.started = false;
  const s = renderer.xr.getSession(); if (s) s.end().catch(() => {});
  G.mode = null; overlay.style.display = 'flex';
  document.getElementById('crosshair').style.display = 'none';
  document.exitPointerLock?.();
  endCard.style.display = 'block'; endCard.textContent = `Paused at ${chapterLabel(chapterPick)}. Press Enter VR to start it again.`;
  loading = G.director.load(chapterPick);
}
G.togglePause = () => {
  if (!G.started || !G.director.chapter) return;
  if (G.isHost) setPaused(!G.paused); else G.net.sendAction({ type: 'pause' });
};
function placeMe(d) {
  const seat = parseInt(G.player.id.split(':')[1]) || 0;
  const [x, z] = spread(d.x, d.z, d.yaw, seat);
  if (G.mode === 'vr') {
    // In VR you may be standing anywhere in your room: put your *head* on the spot
    G.player.placeAt(x, z, d.yaw);
    camera.updateMatrixWorld(true);
    const hp = camera.getWorldPosition(new THREE.Vector3());
    G.player.dolly.position.x += x - hp.x; G.player.dolly.position.z += z - hp.z;
    // and turn so you face the right way: rotate the rig by the difference
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const now = Math.atan2(-dir.x, -dir.z);
    G.player.turn(d.yaw - now);
  } else { G.player.placeAt(x, z, 0); G.player.yaw = d.yaw; G.player.pitch = 0; }
}
G.events.on('placePlayers', (d) => placeMe(d));
G.events.on('sfx', (d) => sfx(d.k));
function sfx(k) {
  const A = G.audio;
  if (k === 'boom') A.boom(null); else if (k === 'cheer') A.cheer(new THREE.Vector3(0, 1, -30)); else if (k === 'swell') A.swell(16); else if (k === 'page') A.page(); else if (k === 'carve') A.carve(); else if (k === 'bell') A.bell(null, 1.2);
}

// ---------- Title screen, VR and desktop ----------
const overlay = document.getElementById('overlay');
const vrBtn = document.getElementById('vrBtn'), deskBtn = document.getElementById('deskBtn'), note = document.getElementById('note');
const endCard = document.getElementById('endCard');
document.getElementById('version').textContent = `Version ${VERSION}`;
if (!params.get('chapter') && readyN(progress.resume) > 1) {
  endCard.style.display = 'block';
  endCard.textContent = `Welcome back! Carrying on from ${chapterLabel(chapterPick)}, ${CHAPTERS.find((c) => c.n === chapterPick).title}.`;
}

if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
    vrBtn.disabled = !ok;
    note.textContent = ok ? 'VR headset ready.' : (window.isSecureContext ? 'No VR headset found. You can still try it on desktop.' : 'VR needs an https:// address. Desktop mode works anywhere.');
  }).catch(() => { note.textContent = 'Could not check for VR.'; });
} else note.textContent = window.isSecureContext ? 'This browser has no WebXR. Desktop mode works.' : 'VR needs an https:// address. Desktop mode works anywhere.';

// Build the chapter's world straight away, so the title screen's "Enter" is instant
let loading = G.director.load(chapterPick).catch((e) => { note.textContent = e.message; });

async function begin() {
  setPaused(false);
  overlay.style.display = 'none';
  endCard.style.display = 'none';
  G.audio.init();
  if (G.started) return;
  G.started = true;
  if (!G.isHost) {
    // A friend waits for the host's story; the host's state drives everything
    G.ui.fadeIn(1.5);
    if (!G.director.running) G.ui.showHint('Waiting for the host to start the chapter', 6);
    return;
  }
  await loading;
  if (G.director.n !== chapterPick) await G.director.load(chapterPick);
  // the opening among the stars, before the very first chapter (js/opening.js)
  if (chapterPick === CHAPTERS.find((c) => c.ready).n && !G.net.mode && (!params.has('chapter') || params.has('opening'))) { between = true; await G.opening.play(); between = false; }
  G.director.play();
}

vrBtn.addEventListener('click', async () => {
  G.audio.init();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    await renderer.xr.setSession(session);
    G.player.onSession(session);
    G.mode = 'vr'; camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
    G.player.onVRStart();
    session.addEventListener('end', () => { G.mode = null; overlay.style.display = 'flex'; });
    begin();
  } catch (e) { note.textContent = 'Could not start VR: ' + e.message; }
});
deskBtn.addEventListener('click', () => {
  G.mode = 'desktop';
  camera.position.set(0, 1.6, 0);
  G.player.initDesktop(renderer.domElement);
  document.getElementById('crosshair').style.display = 'block';
  renderer.domElement.requestPointerLock?.();
  begin();
});
if (params.has('autostart')) deskBtn.click(); // testing

// End of a chapter: straight on to the next one if it's built, otherwise a card and back to the title
function chapterEnded() {
  const n = G.director.n, next = CHAPTERS.find((c) => c.n === n + 1 && c.ready);
  between = true;
  const cur = CHAPTERS.find((c) => c.n === n);
  // the next part of the same chapter (Apollo 11, Apollo 13): straight on, no card and no flight
  if (next && cur?.group && next.group === cur.group) {
    (async () => {
      await G.ui.fadeOut(1.2);
      if (G.isHost) { pickChapter(next.n); await G.director.load(next.n); G.director.play(); }
    })();
    return;
  }
  if (next) {
    const crossing = next.era !== cur?.era;
    if (crossing) G.ui.subtitle(`The end of Era ${cur.era}: ${ERAS[cur.era].title}`, `Next: Era ${next.era}, ${ERAS[next.era].title}`);
    else G.ui.subtitle(`End of ${chapterLabel(n)}`, `Next: ${chapterLabel(next.n)}, ${next.title}`);
    setTimeout(async () => {
      await G.ui.fadeOut(1.5);
      G.ui.subtitle('');
      // build the next chapter while the screen is dark, then fly to it through the stars (js/flight.js)
      if (G.isHost) {
        pickChapter(next.n);
        await G.director.load(next.n);
      }
      await G.flight.play(n, next.n);
      if (!G.isHost) return;          // friends follow the host into the next chapter
      G.director.play();
    }, 3500);
    return;
  }
  if (n === 7) G.ui.subtitle('The end of Era 1: Watchers of the Sky. Thank you for watching the sky!', 'Era 2 is on the way.');
  else if (n === 14) G.ui.subtitle('The end of Era 2: The Telescope and the Rocket. Thank you for watching the sky!', 'Era 3, the Space Race, is on the way.');
  else if (n === 35) G.ui.subtitle('The end of Era 3: The Space Race. Thank you for watching the sky!', 'Era 4, Living in Space, is on the way.');
  else G.ui.subtitle(`End of ${chapterLabel(n)}. Thank you for watching the sky!`, 'More chapters are on the way.');
  setTimeout(async () => {
    await G.ui.fadeOut(1.5);
    G.ui.subtitle('');
    G.started = false; between = false; G.ff = false;
    const s = renderer.xr.getSession(); if (s) s.end().catch(() => {});
    G.mode = null; overlay.style.display = 'flex';
    endCard.style.display = 'block'; endCard.textContent = `You finished ${chapterLabel(n)}. Press Enter VR to play it again.`;
    document.exitPointerLock?.();
    if (G.isHost) loading = G.director.load(chapterPick);
  }, 6000);
}
G.events.on('chapterEnd', chapterEnded);
G.events.on('chapterStart', (d) => { if (!G.isHost) return; progress.resume = d.n; progress.save(); });
G.events.on('chapterEnd', (d) => {
  if (!G.isHost) return;
  const n = d?.n || G.director.n; progress.done.add(n);
  progress.resume = readyN(n + 1); progress.save(); showTicks();   // after the very last chapter, back to the start
});
G.events.on('chapterStart', (d) => { between = false; G.music.play('ch' + d.n); G.gfx.reset(); });
G.events.on('chapterEnd', () => G.music.stop(5));

// ---------- Play with friends ----------
const nameIn = document.getElementById('nameIn'), codeIn = document.getElementById('codeIn');
const hostBtn = document.getElementById('hostBtn'), joinBtn = document.getElementById('joinBtn');
const mpNote = document.getElementById('mpNote'), roomEl = document.getElementById('room');
nameIn.value = store.get('name', '');
const myName = () => { const n = nameIn.value.trim().slice(0, 14); store.set('name', n); return n; };
const WHY = {
  network: 'Couldn’t reach the matchmaking server. Check the headset is online and try again.',
  noroom: 'No journey found with that code. Check the code, and that the host has pressed “Host”.',
  full: 'That journey is full (4 travellers).',
  timeout: 'The host didn’t answer. Try again; some work or school networks block this.',
  closed: 'The host closed the connection.',
};
const mpBusy = (on) => { hostBtn.disabled = joinBtn.disabled = on; };
async function hostGame() {
  G.net.voice.mic();
  mpBusy(true); mpNote.textContent = 'Opening a room…';
  try {
    const code = await G.net.host(myName());
    roomEl.textContent = `Room code: ${code}`; roomEl.style.display = 'block';
    mpNote.textContent = 'Friends: open Starward, type this code and press Join. Then everyone presses Enter VR. You pick the chapter and start it.';
    for (const el of [hostBtn, joinBtn, codeIn, nameIn]) el.style.display = 'none';
  } catch (e) { mpNote.textContent = WHY[e.message] || `Couldn’t open a room (${e.message}).`; mpBusy(false); }
}
async function joinGame() {
  const code = codeIn.value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { mpNote.textContent = 'Type the 4-letter room code from the host’s screen first.'; codeIn.focus(); return; }
  if (G.started) { mpNote.textContent = 'Reload the page to join a friend.'; return; }
  G.net.voice.mic();
  mpBusy(true); mpNote.textContent = `Looking for journey ${code}…`;
  try {
    G.director.stop();
    await G.net.join(code, myName());
    roomEl.textContent = `Joined ${code}`; roomEl.style.display = 'block';
    mpNote.textContent = 'You’re in! Press Enter VR (or Try on desktop). The host picks the chapter and starts it.';
    for (const el of [hostBtn, joinBtn, codeIn, nameIn]) el.style.display = 'none';
    for (const id of ['rating', 'chapters']) document.getElementById(id).classList.add('locked');
  } catch (e) {
    const v = /^version:(\d+)/.exec(e.message);
    mpNote.textContent = v ? `The host has version ${v[1]} and you have version ${VERSION}. Both of you: reload the page.` : (WHY[e.message] || `Couldn’t join (${e.message}).`);
    mpBusy(false);
  }
}
G.hostLeft = () => {
  G.ui.subtitle('The host has left the journey.');
  setTimeout(() => location.reload(), 4000);
};
hostBtn.addEventListener('click', hostGame);
joinBtn.addEventListener('click', joinGame);
codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinGame(); });
window.addEventListener('pagehide', () => G.net.leave());
if (params.has('host')) hostGame();
else if (params.get('join')) { codeIn.value = params.get('join'); joinGame(); }

// Voice chat panel: your mic, and each friend's volume and mute
const voicePanel = document.getElementById('voicePanel');
let voiceKey = '';
function drawVoicePanel() {
  const V = G.net.voice;
  if (!V.on) { voicePanel.style.display = 'none'; return; }
  const friends = [...G.net.avatars.values()];
  const key = [V.muted, !!V.stream, V.denied, ...friends.map((p) => `${p.id}:${p.name}:${V.calls.has(p.id)}:${V.pref(p.name).muted}`)].join('|');
  if (key === voiceKey) return;
  voiceKey = key; voicePanel.style.display = 'flex'; voicePanel.textContent = '';
  const row = () => { const d = document.createElement('div'); d.className = 'row'; voicePanel.appendChild(d); return d; };
  const r0 = row(), lab = document.createElement('span');
  lab.textContent = V.stream ? (V.muted ? 'Voice chat: your mic is OFF' : 'Voice chat: your mic is on') : V.denied ? 'Voice chat: no microphone allowed (you can still hear friends)' : 'Voice chat: waiting for the microphone…';
  r0.appendChild(lab);
  if (V.stream) { const b = document.createElement('button'); b.textContent = V.muted ? 'Turn mic on' : 'Mute my mic'; b.onclick = () => V.setMuted(!V.muted); r0.appendChild(b); }
  for (const pl of friends) {
    const pr = V.pref(pl.name), r = row(), n = document.createElement('span');
    n.textContent = `${pl.name}${V.calls.has(pl.id) ? '' : ' (connecting)'}`; n.style.minWidth = '110px';
    const sl = document.createElement('input'); sl.type = 'range'; sl.min = 0; sl.max = 200; sl.value = Math.round(pr.vol * 100);
    sl.oninput = () => V.setPref(pl.name, { vol: sl.value / 100 });
    const m = document.createElement('button'); m.textContent = pr.muted ? 'Unmute' : 'Mute';
    m.onclick = () => V.setPref(pl.name, { muted: !V.pref(pl.name).muted });
    r.append(n, sl, m);
  }
}
G.net.voice.onChange = () => drawVoicePanel();
setInterval(drawVoicePanel, 1000);

document.addEventListener('pointerlockchange', () => {
  if (G.mode === 'desktop' && !document.pointerLockElement) G.ui.showHint('Click to look around again', 2);
});

// ---------- Keeping the starry sky sharp and smooth ----------
// Stars are drawn a set number of pixels wide, so they need to know how big a pixel is. And if
// frames start running late while the stars are out, draw fewer of the Milky Way's dust stars
// (they come back slowly once things are smooth again). ?fulldetail turns that off (for measuring).
let frameMin = 1 / 72, frameAvg = 1 / 72, frameLast = 0;
function starDetail(now) {
  const sf = G.sky.starField, raw = frameLast ? (now - frameLast) / 1000 : 1 / 72; frameLast = now;
  sf.pxAng = G.mode === 'vr' ? 0.0008 : (camera.fov * Math.PI / 180) / Math.max(300, innerHeight);
  if (raw > 0.25 || params.has('fulldetail')) return;           // a hiccup (loading), not a trend
  frameMin = Math.min(frameMin * 1.001, raw); frameAvg += (raw - frameAvg) * 0.08;
  if (sf.opacity < 0.05 || !G.mode) return;
  if (frameAvg > frameMin * 1.22) sf.detail = Math.max(0.15, sf.detail - raw * 0.5);
  else sf.detail = Math.min(1, sf.detail + raw * 0.03);
}

// ---------- Main loop ----------
let last = performance.now();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion();
function tick() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  G.t += dt;
  if (G.mode) G.player.update(dt);
  if (!G.paused) {
    // fast forward: the story takes four steps for every frame
    for (let i = 0, k = G.ff ? 4 : 1; i < k; i++) { if (i) G.t += dt; G.director.update(dt); G.extras.update(dt, G.t); G.skyFigures.update(dt); }
  }
  G.narration.update(dt);
  G.music.update(dt);
  G.soundscape.update(dt);
  G.guide.update(dt);
  G.net.update(dt);
  G.ui.update(dt);
  camera.getWorldPosition(_a);
  starDetail(now);
  G.sky.update(dt, _a, G.t);
  G.atmosphere.update(dt, G.t);
  if (G.mode) G.stargazing.update(dt);
  camera.getWorldDirection(_b); _c.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(_q));
  G.audio.setListener(_a, _b, _c, G.t);
  G.flight.update(G.ff ? dt * 4 : dt);
  G.opening.update(dt);
  const view = G.opening.active ? G.opening.scene : G.flight.active ? G.flight.scene : scene;
  G.gfx.beforeRender(view, camera, dt);
  renderer.render(view, camera);
  G.gfx.afterRender();
}
renderer.setAnimationLoop(tick);
