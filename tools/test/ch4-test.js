// Headset emulator test for Chapter 4 (Babylon predicts an eclipse). Same setup as vr-test.js:
// Meta's IWER emulator pretends to be a Quest 3. Plays the whole chapter with the virtual
// controllers: picks up the reed with GRIP and presses its tip into the six glowing marks, grabs
// the four glowing tablets off the shelf, turns to the Moon, watches the eclipse turn red, and
// touches the journal page with the trigger.
//
//   cd tools/test && npm install && npm run test:ch4          (add --shots to save screenshots)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.argv.includes('--shots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg' };

function serve() {
  return new Promise((ok) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(res);
    }).listen(0, () => ok(srv));
  });
}

let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures++; };

(async () => {
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript({ path: require.resolve('iwer/build/iwer.min.js') });
  await page.addInitScript(() => { const d = new IWER.XRDevice(IWER.metaQuest3); d.installRuntime({ forceInstall: true }); window.__xr = d; });
  await page.goto(`http://localhost:${port}/index.html?fast&rating=adults&chapter=4`);
  await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 15000 });
  await page.click('#vrBtn');
  await page.waitForFunction(() => window.G?.mode === 'vr' && G.director.n === 4, null, { timeout: 15000 });
  check(true, 'VR session started in Chapter 4');
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(__dirname, `ch4_${name}.png`) }); };
  const until = async (fn, arg, ms = 90000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).catch(async (e) => {
    console.log('  (stuck; story state:', JSON.stringify(await page.evaluate(() => ({ ...G.director.chapter?.s, t: G.t, fade: G.ui.fade, paused: G.paused }))), ')'); throw e;
  });
  await page.evaluate(() => { window.__skip = setInterval(() => G.narration.skip(), 200); });
  const wait = (ms) => page.waitForTimeout(ms);

  await wait(1500);
  await shot('1_arrive');
  // Writing: walk to the ring with the left stick (or the story fades you there)
  await until(() => G.director.chapter?.s.phase === 'write');
  await page.evaluate(() => __xr.controllers.left.updateAxes('thumbstick', 0, -1));
  await wait(1000);
  await page.evaluate(() => __xr.controllers.left.updateAxes('thumbstick', 0, 0));
  await until(() => G.director.chapter.s.ring === 0, null, 120000);
  // Put the right hand on the reed, squeeze GRIP, then move the hand so the reed's tip pushes into each mark
  const pressed = await page.evaluate(async () => {
    const ch = G.director.chapter, V = G.camera.position.constructor, R = __xr.controllers.right;
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const setHand = (p) => { const l = G.player.dolly.worldToLocal(p.clone()); R.position.set(l.x, l.y, l.z); };
    // nudge the controller by however far the reed's tip still is from where we want it
    // (the controller's own point and its grip differ a little, so this is repeated until it lands)
    const nudge = (tipWanted) => {
      const tip = ch.reedTipWorld(new V()), d = G.player.dolly;
      const l = d.worldToLocal(tipWanted.clone()).sub(d.worldToLocal(tip.clone()));
      R.position.set(R.position.x + l.x, R.position.y + l.y, R.position.z + l.z);
    };
    setHand(ch.reed.position.clone()); await w(300);
    R.updateButtonValue('squeeze', 1); await w(300);
    if (!ch.reedHand) return -1;
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 6 && !ch.s.marks[i]; k++) {
        nudge(ch.markPos(i, new V())); await w(250);
      }
    }
    R.updateButtonValue('squeeze', 0); await w(150);
    return ch.s.marks.filter(Boolean).length;
  });
  check(pressed === 6, `pressed all six marks into the clay with the reed held in GRIP (${pressed} of 6)`);
  await shot('2_written');

  // The archive: grab each glowing tablet off the shelf
  await until(() => G.director.chapter?.s.phase === 'archive');
  await until(() => G.director.chapter.s.ring === 0, null, 120000);
  const fetched = await page.evaluate(async () => {
    const ch = G.director.chapter, V = G.camera.position.constructor, R = __xr.controllers.right;
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 4; i++) {
      if (ch.s.fetched[i]) continue;
      const p = ch.old[i].getWorldPosition(new V()); p.y += 0.09;
      const l = G.player.dolly.worldToLocal(p); R.position.set(l.x, l.y, l.z); await w(250);
      R.updateButtonValue('squeeze', 1); await w(200); R.updateButtonValue('squeeze', 0); await w(150);
    }
    return ch.s.fetched.filter(Boolean).length;
  });
  check(fetched === 4, `grabbed the four glowing tablets off the shelf (${fetched} of 4)`);
  await until(() => G.director.chapter?.s.tonight === 1, null, 60000);
  await wait(800);
  await shot('3_pattern');
  const pat = await page.evaluate(() => ({ lines: G.director.chapter.s.lines, mine: G.director.chapter.s.mine, landed: G.director.chapter.old.every((T) => T.userData.landed) }));
  check(pat.lines >= 1 && pat.mine >= 1 && pat.landed, 'the tablets lie side by side, the eclipse lines join them, and tonight\'s tablet joins the row');

  // Look up at the Moon: turn the headset toward it
  await until(() => G.director.chapter?.s.phase === 'lookup' || G.director.chapter?.s.phase === 'eclipse');
  await page.evaluate(() => {
    const d = G.director.chapter.moonDir, Q = G.camera.quaternion.constructor, E = G.camera.rotation.constructor;
    const dollyYaw = G.player.dolly.rotation.y;
    const q = new Q().setFromEuler(new E(Math.asin(d.y), Math.atan2(-d.x, -d.z) - dollyYaw, 0, 'YXZ'));
    __xr.quaternion.set(q.x, q.y, q.z, q.w);
  });
  await until(() => G.director.chapter?.s.phase === 'eclipse', null, 20000);
  check(true, 'looking up at the Moon starts the eclipse');
  await until(() => G.director.chapter?.s.ecl > 0.5, null, 60000);
  await shot('4_partial');
  await until(() => G.director.chapter?.s.red >= 0.9, null, 90000);
  await wait(500);
  await shot('5_red');
  const moon = await page.evaluate(() => ({ lit: G.director.chapter.lit, red: G.director.chapter.moonU.red.value }));
  check(moon.lit < 0.1 && moon.red > 0.9, `the Moon is fully in Earth's shadow and glowing copper (sunlit part ${moon.lit.toFixed(2)}, red ${moon.red.toFixed(2)})`);

  // The journal page
  await until(() => G.director.chapter?.s.journal === 1, null, 120000);
  await wait(1500);
  await shot('6_journal');
  await page.evaluate(async () => {
    const ch = G.director.chapter, p = ch.journal.getWorldPosition(new G.camera.position.constructor());
    const l = G.player.dolly.worldToLocal(p.clone());
    __xr.controllers.left.position.set(l.x, l.y, l.z);
    await new Promise((r) => setTimeout(r, 200));
    __xr.controllers.left.updateButtonValue('trigger', 1);
    await new Promise((r) => setTimeout(r, 200));
    __xr.controllers.left.updateButtonValue('trigger', 0);
  });
  await until(() => G.director.chapter?.s.phase === 'done', null, 20000).then(() => check(true, 'touching the journal page with the trigger ends the chapter'), () => check(false, 'touching the journal page ends the chapter'));
  const info = await page.evaluate(() => ({ calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles }));
  console.log(`      draw calls ${info.calls}, triangles ${info.tris} (both eyes together)`);
  check(errors.length === 0, `no errors in the page${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failures ? `${failures} check(s) failed` : 'All checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
