// Starward: Era 1, Watchers of the Sky. Boots the 3D world, the title screen and the chapters.
import * as THREE from 'three';
import { Sky } from './sky.js';
import { Sound } from './audio.js';
import { Events } from './events.js';
import { Player } from './player.js';
import { UI } from './ui.js';
import { Narration } from './narration.js';
import { Guide } from './guide.js';
import { Director, CHAPTERS } from './chapters.js';
import { makeWorld } from './world.js';
import { Net } from './net/net.js';
import { Music } from './music.js';
import { Stargazing } from './stargazing.js';
import { VERSION } from './version.js';

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
renderer.xr.setFoveation(1);
// Draw the headset view a bit sharper than the browser's default (closer to the Quest's real screens)
renderer.xr.setFramebufferScaleFactor(Number(params.get('sharp')) || 1.2);
document.body.appendChild(renderer.domElement);
G.renderer = renderer;

const scene = G.scene = new THREE.Scene();
const camera = G.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 2500);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

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
// Kids (default) or Adults. Era 1 has nothing that needs softening yet; later chapters read G.kids
// (for example the eclipse in Chapter 4 is played as wonder, not fear). The host's setting applies to everyone.
G.setKids = (on) => { G.kids = !!on; G.events.emit('kids', { on: G.kids }); for (const b of document.querySelectorAll('#rating button')) b.classList.toggle('on', (b.dataset.v === 'kids') === G.kids); };
choice('rating', 'rating', params.get('rating') || 'kids', (v) => G.setKids(v !== 'adults'));
choice('turning', 'turn', 'snap', (v) => { G.player.smoothTurn = v === 'smooth'; });
choice('subs', 'subs', 'on', (v) => { G.ui.subsOn = v === 'on'; G.ui.subtitle(G.ui.subText || ''); });

// Chapter list: only chapters that are built can be picked
let chapterPick = Number(params.get('chapter')) || CHAPTERS.find((c) => c.ready).n;
const chapList = document.getElementById('chapters');
for (const c of CHAPTERS) {
  const b = document.createElement('button');
  b.textContent = `${c.n}. ${c.title}${c.ready ? '' : ' (coming soon)'}`;
  b.disabled = !c.ready; b.classList.toggle('on', c.n === chapterPick);
  b.addEventListener('click', () => { if (!G.isHost) return; chapterPick = c.n; for (const o of chapList.children) o.classList.toggle('on', o === b); });
  chapList.appendChild(b);
}

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
  G.director.play();
}

vrBtn.addEventListener('click', async () => {
  G.audio.init();
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    await renderer.xr.setSession(session);
    G.player.onSession(session);
    G.mode = 'vr'; camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
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
  if (next) {
    G.ui.subtitle(`End of Chapter ${n}`, `Next: Chapter ${next.n}, ${next.title}`);
    setTimeout(async () => {
      await G.ui.fadeOut(1.5);
      G.ui.subtitle('');
      if (!G.isHost) return;          // friends follow the host into the next chapter
      chapterPick = next.n;
      for (const b of chapList.children) b.classList.toggle('on', b.textContent.startsWith(next.n + '.'));
      await G.director.load(next.n);
      G.director.play();
    }, 4500);
    return;
  }
  if (n === 7) G.ui.subtitle('The end of Era 1: Watchers of the Sky. Thank you for watching the sky!', 'Era 2 is on the way.');
  else G.ui.subtitle(`End of Chapter ${n}. Thank you for watching the sky!`, 'More chapters are on the way.');
  setTimeout(async () => {
    await G.ui.fadeOut(1.5);
    G.ui.subtitle('');
    G.started = false;
    const s = renderer.xr.getSession(); if (s) s.end().catch(() => {});
    G.mode = null; overlay.style.display = 'flex';
    endCard.style.display = 'block'; endCard.textContent = `You finished Chapter ${n}. Press Enter VR to play it again.`;
    document.exitPointerLock?.();
    if (G.isHost) loading = G.director.load(chapterPick);
  }, 6000);
}
G.events.on('chapterEnd', chapterEnded);
G.events.on('chapterStart', (d) => G.music.play('ch' + d.n));
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

// ---------- Main loop ----------
let last = performance.now();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion();
function tick() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  G.t += dt;
  if (G.mode) G.player.update(dt);
  if (!G.paused) G.director.update(dt);
  G.narration.update(dt);
  G.music.update(dt);
  G.guide.update(dt);
  G.net.update(dt);
  G.ui.update(dt);
  camera.getWorldPosition(_a);
  G.sky.update(dt, _a, G.t);
  if (G.mode) G.stargazing.update(dt);
  camera.getWorldDirection(_b); _c.set(0, 1, 0).applyQuaternion(camera.getWorldQuaternion(_q));
  G.audio.setListener(_a, _b, _c, G.t);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(tick);
