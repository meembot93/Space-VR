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
  check(/ring/.test(hints), `the hint says what to do (${hints.slice(-90)})`);
  check(await page.evaluate(() => G.director.chapter.ignMark.visible), 'the igniter has its pulsing marker');
  // stand beside the frame, then put the right hand on the torch's pole and squeeze
  // the chapter moves you beside the torch (LIGHT_SPOT), facing the rocket
  await page.waitForTimeout(2500);
  const setHand = (p) => page.evaluate((p) => { const V = G.camera.position.constructor; const l = G.player.dolly.worldToLocal(new V(...p)); __xr.controllers.right.position.set(l.x, l.y, l.z); }, p);
  const pole = await page.evaluate(() => { const ch = G.director.chapter, V = G.camera.position.constructor; return ch.torchP.localToWorld(new V(0, 0.9, 0)).toArray(); });
  await setHand(pole); await page.waitForTimeout(400);
  await page.evaluate(() => { const ch = G.director.chapter, V = G.camera.position.constructor, act = ch.act.bind(ch); ch.act = (a) => { if (a.type === 'light' && window.__litD == null) window.__litD = ch.torchP.userData.tip.getWorldPosition(new V()).distanceTo(ch.igniterWorld(new V())); return act(a); }; });
  await page.evaluate(() => __xr.controllers.right.updateButtonValue('squeeze', 1));
  await page.waitForTimeout(500);
  check(await page.evaluate(() => !!G.director.chapter.held), 'grabbed the torch with GRIP');
  // like a real player: hand comfortably in front of you, point the controller at the glowing ring,
  // and if the flame is a bit off, lower it a little at a time (no walking)
  check(await page.evaluate(() => G.director.chapter.ignMark.visible && G.director.chapter.ignLab.visible), 'the "Light here" circle is showing');
  let tries = 0;
  for (const dip of [0, 5, 10, 15, 20, 25]) {
    tries++;
    await page.evaluate((dip) => {
      const ch = G.director.chapter, V = G.camera.position.constructor, P = G.player, cam = G.camera.getWorldPosition(new V());
      const ign = ch.igniterWorld(new V()), f = ign.clone().sub(cam).setY(0).normalize();
      const hand = cam.clone().addScaledVector(f, 0.45).add(new V(-f.z * 0.15, -0.35, f.x * 0.15));
      const l = P.dolly.worldToLocal(hand.clone()); __xr.controllers.right.position.set(l.x, l.y, l.z);
      const dir = ign.clone().sub(hand).normalize(), m = new (G.camera.matrix.constructor)();
      const pitch = Math.asin(dir.y) - dip * Math.PI / 180, yaw = Math.atan2(-dir.x, -dir.z);
      const q = new (G.camera.quaternion.constructor)().setFromEuler(new (G.camera.rotation.constructor)(pitch, yaw, 0, 'YXZ'));
      const dq = P.dolly.getWorldQuaternion(new (G.camera.quaternion.constructor)()).invert();
      q.premultiply(dq); __xr.controllers.right.quaternion.set(q.x, q.y, q.z, q.w);
    }, dip);
    await page.waitForTimeout(500);
    console.log('   ', await page.evaluate(() => { const ch = G.director.chapter, V = G.camera.position.constructor, cam = G.camera.getWorldPosition(new V()), tip = ch.torchP.userData.tip.getWorldPosition(new V()), ign = ch.igniterWorld(new V()); return JSON.stringify({ cam: cam.toArray().map((x) => +x.toFixed(2)), tip: tip.toArray().map((x) => +x.toFixed(2)), ign: ign.toArray().map((x) => +x.toFixed(2)), d: +tip.distanceTo(ign).toFixed(2), held: !!ch.held, torch: ch.s.torch }); }));
    if (await page.evaluate(() => G.director.chapter.s.lit)) break;
  }
  const d = await page.evaluate(() => window.__litD ?? 99);   // where the flame was when it caught
  check(await page.evaluate(() => G.director.chapter.s.lit === 1 && G.director.chapter.s.byYou === 1), `you lit it from where you stand by pointing at the ring (try ${tries}, flame ${d.toFixed(2)} m from the igniter)`);
  await page.evaluate(() => __xr.controllers.right.updateButtonValue('squeeze', 0));
  await page.waitForFunction(() => G.director.chapter.fuseT > 0.2, null, { timeout: 30000 }).then(() => check(true, 'the fuse catches (sparks)'), () => check(false, 'the fuse catches'));
  await page.waitForFunction(() => G.director.chapter.fT > 3, null, { timeout: 60000 }).then(() => check(true, 'the rocket roars and flies'), () => check(false, 'the rocket flies'));
  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED'); process.exit(failures ? 1 : 0);
})();
