// Chapter 13 (the rocket dreamers), Adults: you are Henry. In the headset emulator, grab the blowtorch
// on its pole with GRIP, carry its flame to the rocket's igniter, and check the fuse catches and it flies.
//   node ch13-torch-test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures++; };
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript({ path: require.resolve('iwer/build/iwer.min.js') });
  await page.addInitScript(() => { const d = new IWER.XRDevice(IWER.metaQuest3); d.installRuntime({ forceInstall: true }); window.__xr = d; });
  await page.goto(`http://localhost:${srv.address().port}/index.html?fast&rating=adults&chapter=13`);
  await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 300000 });
  await page.click('#vrBtn', { timeout: 240000 });
  await page.waitForFunction(() => window.G?.mode === 'vr' && G.director.running, null, { timeout: 300000 });
  check(await page.evaluate(() => !G.kids), 'Adults mode');
  await page.evaluate(() => { window.__hints = []; const sh = G.ui.showHint.bind(G.ui); G.ui.showHint = (t, s) => { if (t) __hints.push(t); return sh(t, s); }; window.__skip = setInterval(() => { if (G.director.chapter?.s.torch !== 1) G.narration.skip(); }, 200); });
  await page.waitForFunction(() => G.director.chapter?.s.torch === 1, null, { timeout: 900000, polling: 200 });
  check(true, 'the torch is offered to you');
  const hints = await page.evaluate(() => __hints.join(' | '));
  check(/igniter/.test(hints), `the hint says what to do (${hints.slice(-90)})`);
  check(await page.evaluate(() => G.director.chapter.ignMark.visible), 'the igniter has its pulsing marker');
  // stand beside the frame, then put the right hand on the torch's pole and squeeze
  await page.evaluate(() => G.events.emit('placePlayers', { x: 0.2, z: 0.4, yaw: 0 }));
  await page.waitForTimeout(500);
  const setHand = (p) => page.evaluate((p) => { const V = G.camera.position.constructor; const l = G.player.dolly.worldToLocal(new V(...p)); __xr.controllers.right.position.set(l.x, l.y, l.z); }, p);
  const pole = await page.evaluate(() => { const ch = G.director.chapter, V = G.camera.position.constructor; return ch.torchP.localToWorld(new V(0, 0.9, 0)).toArray(); });
  await setHand(pole); await page.waitForTimeout(400);
  await page.evaluate(() => { const ch = G.director.chapter, V = G.camera.position.constructor, act = ch.act.bind(ch); ch.act = (a) => { if (a.type === 'light' && window.__litD == null) window.__litD = ch.torchP.userData.tip.getWorldPosition(new V()).distanceTo(ch.igniterWorld(new V())); return act(a); }; });
  await page.evaluate(() => __xr.controllers.right.updateButtonValue('squeeze', 1));
  await page.waitForTimeout(500);
  check(await page.evaluate(() => !!G.director.chapter.held), 'grabbed the torch with GRIP');
  // carry the flame to the igniter: work out where the hand must be so the flame's tip lands on it
  for (let i = 0; i < 6; i++) {
    const want = await page.evaluate(() => { const ch = G.director.chapter, V = G.camera.position.constructor; const tip = ch.torchP.userData.tip.getWorldPosition(new V()), ign = ch.igniterWorld(new V()); const h = ch.held.pos.clone(); return h.add(ign.sub(tip)).toArray(); });
    await setHand(want); await page.waitForTimeout(400);
    if (await page.evaluate(() => G.director.chapter.s.lit)) break;
  }
  const d = await page.evaluate(() => window.__litD ?? 99);   // where the flame was when it caught
  check(await page.evaluate(() => G.director.chapter.s.lit === 1 && G.director.chapter.s.byYou === 1) && d < 0.35, `you lit it (flame ${d.toFixed(2)} m from the igniter)`);
  await page.evaluate(() => __xr.controllers.right.updateButtonValue('squeeze', 0));
  await page.waitForFunction(() => G.director.chapter.fuseT > 0.2, null, { timeout: 30000 }).then(() => check(true, 'the fuse catches (sparks)'), () => check(false, 'the fuse catches'));
  await page.waitForFunction(() => G.director.chapter.fT > 3, null, { timeout: 60000 }).then(() => check(true, 'the rocket roars and flies'), () => check(false, 'the rocket flies'));
  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED'); process.exit(failures ? 1 : 0);
})();
