// Chapter 1 in the headset emulator: enter VR, wait for the tally bone, carve marks on it with
// the trigger, let the Moon go round, then touch the journal page.   node ch1-test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures++; };
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript({ path: require.resolve('iwer/build/iwer.min.js') });
  await page.addInitScript(() => { const d = new IWER.XRDevice(IWER.metaQuest3); d.installRuntime({ forceInstall: true }); window.__xr = d; });
  await page.goto(`http://localhost:${srv.address().port}/index.html?fast&rating=adults&chapter=1`);
  await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 15000 });
  await page.click('#vrBtn');
  await page.waitForFunction(() => window.G?.mode === 'vr', null, { timeout: 10000 });
  check(true, 'VR session started in Chapter 1');
  await page.evaluate(() => { window.__skip = setInterval(() => G.narration.skip(), 200); });
  const until = (fn, ms = 120000) => page.waitForFunction(fn, null, { timeout: ms, polling: 100 });
  await until(() => G.director.chapter?.s.phase === 'sky');
  const night = await page.evaluate(() => G.sky.starField.opacity);
  check(night > 0.9, `a full starry night sky (stars at ${night.toFixed(2)})`);
  await until(() => G.director.chapter?.s.phase === 'carve' && G.director.chapter.bone.visible);
  await page.waitForTimeout(800);
  // touch the bone with the right controller's trigger, three times
  for (let i = 0; i < 3; i++) {
    await page.evaluate(async () => {
      const ch = G.director.chapter, p = ch.bone.getWorldPosition(new G.camera.position.constructor());
      const l = G.player.dolly.worldToLocal(p.clone()); __xr.controllers.right.position.set(l.x, l.y, l.z);
      await new Promise((r) => setTimeout(r, 200)); __xr.controllers.right.updateButtonValue('trigger', 1);
      await new Promise((r) => setTimeout(r, 200)); __xr.controllers.right.updateButtonValue('trigger', 0);
      await new Promise((r) => setTimeout(r, 500));
    });
  }
  const marks = await page.evaluate(() => G.director.chapter.s.marks);
  check(marks >= 3, `touching the bone with the trigger carves marks (${marks})`);
  await until(() => G.director.chapter?.s.marks >= 29, 240000).then(() => check(true, 'the Moon goes all the way round: 29 marks'), () => check(false, '29 marks'));
  const moonOk = await page.evaluate(() => G.sky.moon.visible || G.director.chapter.s.phase !== 'wane');
  check(moonOk, 'the Moon is in the sky while you carve');
  await until(() => G.director.chapter?.s.journal === 1, 120000);
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const ch = G.director.chapter, p = ch.journal.getWorldPosition(new G.camera.position.constructor());
    const l = G.player.dolly.worldToLocal(p.clone()); __xr.controllers.left.position.set(l.x, l.y, l.z);
    await new Promise((r) => setTimeout(r, 150)); __xr.controllers.left.updateButtonValue('trigger', 1);
    await new Promise((r) => setTimeout(r, 150)); __xr.controllers.left.updateButtonValue('trigger', 0);
  });
  await until(() => G.director.chapter?.s.phase === 'done' || G.director.n === 2, 30000).then(() => check(true, 'touching the journal page ends Chapter 1'), () => check(false, 'journal ends the chapter'));
  await until(() => G.director.n === 2 && G.director.running, 60000).then(() => check(true, 'Chapter 2 starts by itself afterwards'), () => check(false, 'Chapter 2 starts afterwards'));
  const info = await page.evaluate(() => ({ calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles }));
  console.log(`      draw calls ${info.calls}, triangles ${info.tris} (both eyes together)`);
  check(errors.length === 0, `no errors in the page${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failures ? `${failures} check(s) failed` : 'All checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
