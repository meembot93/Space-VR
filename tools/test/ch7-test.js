// Headset emulator test for Chapter 7, Ptolemy's spinning sky. Same setup as vr-test.js (a
// virtual Quest 3 via Meta's IWER): enters VR on ?chapter=7, walks up the hall with the left
// stick, touches Ptolemy's scroll with the trigger, grips and follows Mars around its backward
// loop, watches the small-circle-on-big-circle machine trace the same loop, then touches the
// journal page to finish Era 1.
//
//   cd tools/test && npm install && node ch7-test.js  (or npm run test:ch7; add --shots to save screenshots)
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
  await page.goto(`http://localhost:${port}/index.html?fast&rating=adults&chapter=7`);
  await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 15000 });
  await page.click('#vrBtn');
  await page.waitForFunction(() => window.G?.mode === 'vr' && G.director.n === 7, null, { timeout: 15000 });
  check(true, 'Chapter 7 starts in VR');
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(__dirname, `ch7_${name}.png`) }); };
  const until = async (fn, arg, ms = 90000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
  await page.evaluate(() => { window.__skip = setInterval(() => G.narration.skip(), 200); });
  // note who is talking during ch7_09 (Aristarchus, not Astra)
  await page.evaluate(() => G.events.on('narrating', (d) => { if (d.id === 'ch7_09' && d.on) setTimeout(() => { window.__who = G.narration.cur?.speaker; window.__astraLevel = G.narration.level; }, 120); }));
  const stats = async () => page.evaluate(() => ({ calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles }));

  // Walk up the hall toward the ring
  await until(() => G.director.chapter?.s.phase === 'walk');
  await page.waitForTimeout(1500);
  await shot('1_hall');
  const hall = await stats();
  console.log(`      hall: draw calls ${hall.calls}, triangles ${hall.tris} (both eyes together)`);
  const z0 = await page.evaluate(() => G.camera.getWorldPosition(new G.camera.position.constructor()).z);
  await page.evaluate(() => __xr.controllers.left.updateAxes('thumbstick', 0, -1));
  await page.waitForTimeout(1500);
  await page.evaluate(() => __xr.controllers.left.updateAxes('thumbstick', 0, 0));
  const z1 = await page.evaluate(() => G.camera.getWorldPosition(new G.camera.position.constructor()).z);
  check(z0 - z1 > 0.1, `left stick walks up the hall (${(z0 - z1).toFixed(2)} m)`);

  // The scroll: wait for it to unroll, then touch it with the right trigger
  await until(() => G.director.chapter?.s.phase === 'touch');
  await page.waitForTimeout(800);
  await shot('2_scroll');
  await page.evaluate(async () => {
    const V = G.camera.position.constructor, p = new V(0, G.director.chapter.scrollY + 0.05, -4.55);
    const l = G.player.dolly.worldToLocal(p.clone());
    __xr.controllers.right.position.set(l.x, l.y, l.z);
    await new Promise((r) => setTimeout(r, 200));
    __xr.controllers.right.updateButtonValue('trigger', 1); await new Promise((r) => setTimeout(r, 200));
    __xr.controllers.right.updateButtonValue('trigger', 0);
  });
  const touched = await until(() => G.director.chapter?.s.where === 'cosmos', null, 15000).then(() => true, () => false);
  check(touched, 'touching the scroll takes you into Ptolemy’s universe');
  await until(() => G.director.chapter?.s.phase === 'spheres' && G.ui.fade < 0.05, null, 20000).catch(() => {});
  await page.waitForTimeout(1500);
  await shot('3_spheres');
  const cos = await stats();
  console.log(`      cosmos: draw calls ${cos.calls}, triangles ${cos.tris}`);
  const feet = await page.evaluate(() => G.player.dolly.position.y);
  check(Math.abs(feet) < 0.2, `standing on top of the little Earth (feet at ${feet.toFixed(2)} m)`);

  // Follow Mars: squeeze the grip and point at it
  await until(() => G.director.chapter?.s.phase === 'follow');
  const mt0 = await page.evaluate(() => G.director.chapter.s.mt);
  await page.evaluate(() => __xr.controllers.right.updateButtonValue('squeeze', 1));
  const t0 = Date.now(); let shotFollow = false;
  while (Date.now() - t0 < 240000) {   // headless runs at a few fps, so following takes longer than on a headset
    const done = await page.evaluate(() => {
      const ch = G.director.chapter, V = G.camera.position.constructor;
      if (ch.s.phase !== 'follow') return true;
      // hold the hand out toward Mars
      const head = G.camera.getWorldPosition(new V()), m = ch.marsBig.getWorldPosition(new V());
      const p = head.clone().add(m.sub(head).normalize().multiplyScalar(0.55));
      const l = G.player.dolly.worldToLocal(p); __xr.controllers.right.position.set(l.x, l.y, l.z);
      return false;
    });
    if (done) break;
    await page.waitForTimeout(250);
    if (SHOTS && Date.now() - t0 > 6000 && !shotFollow) { shotFollow = true; await shot('4_follow'); }
  }
  await page.evaluate(() => __xr.controllers.right.updateButtonValue('squeeze', 0));
  const follow = await page.evaluate(() => [G.director.chapter.s.phase, G.director.chapter.s.mt, G.t - G.director.chapter.followStart]);
  check(follow[0] !== 'follow' && follow[1] > mt0, `gripping and following moves Mars along its loop (phase now ${follow[0]})`);

  await until(() => G.director.chapter?.s.phase === 'epicycle' && G.director.chapter.s.et > 0, null, 30000);
  await page.waitForTimeout(800);
  await shot('5_epicycle');
  // The machine's Mars must appear exactly where the real Mars is
  const match = await page.evaluate(() => {
    const ch = G.director.chapter, V = G.camera.position.constructor;
    const a = ch.marsSmall.getWorldPosition(new V()).sub(new V(0, 1.6, 0)).normalize();
    const b = ch.marsBig.getWorldPosition(new V()).sub(new V(0, 1.6, 0)).normalize();
    return Math.acos(Math.min(1, a.dot(b))) * 180 / Math.PI;
  });
  check(match < 1, `the small circle on the big circle puts Mars in the same place as the real sky (${match.toFixed(2)}° apart)`);

  await until(() => G.director.chapter?.s.phase === 'aristarchus' && G.director.chapter.s.arist === 1, null, 60000);
  await page.waitForTimeout(2500);
  await shot('6_aristarchus');
  await until(() => window.__who !== undefined, null, 30000).catch(() => {});
  const who = await page.evaluate(() => [window.__who, window.__astraLevel]);
  check(who[0] === 'Aristarchus' && who[1] === 0, `Aristarchus speaks his own line, Astra stays quiet (${who[0]})`);

  await until(() => G.director.chapter?.s.journal === 1, null, 120000);
  await page.waitForTimeout(1500);
  await shot('7_journal');
  check(await page.evaluate(() => G.director.chapter.s.where === 'hall'), 'the lights come up: back in the hall');
  await page.evaluate(async () => {
    const ch = G.director.chapter, p = ch.journal.getWorldPosition(new G.camera.position.constructor());
    const l = G.player.dolly.worldToLocal(p.clone());
    __xr.controllers.left.position.set(l.x, l.y, l.z);
    await new Promise((r) => setTimeout(r, 150));
    __xr.controllers.left.updateButtonValue('trigger', 1);
    await new Promise((r) => setTimeout(r, 150));
    __xr.controllers.left.updateButtonValue('trigger', 0);
  });
  await until(() => G.director.chapter?.s.phase === 'done', null, 20000).then(() => check(true, 'touching the journal page ends the chapter'), () => check(false, 'touching the journal page ends the chapter'));
  check(hall.tris < 1100000 && cos.tris < 1100000, `scene stays inside the triangle budget (hall ${hall.tris}, cosmos ${cos.tris}, both eyes)`);
  check(errors.length === 0, `no errors in the page${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failures ? `${failures} check(s) failed` : 'All checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
