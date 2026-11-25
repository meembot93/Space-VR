// Seated / Standing and height reset, in the headset emulator (a virtual Quest 3).
// Sits the virtual player down (eyes 1.1 m above the floor), enters VR in Seated mode and checks
// their eyes are lifted to a standing grown-up's 1.6 m; then shrinks them and holds a thumbstick
// in to reset; then Standing mode (real height) and a tall player (never pushed down).
//
//   cd tools/test && npm install && node height-test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };
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
  await page.goto(`http://localhost:${port}/index.html?fast&chapter=1`);
  await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 15000 });
  const def = await page.evaluate(() => document.querySelector('#posture button.on')?.dataset.v);
  check(def === 'seated', `title screen has Seated / Standing, Seated picked by default (${def})`);

  // Sit down (eyes 1.1 m above the real floor), then Enter VR
  await page.evaluate(() => __xr.position.set(0, 1.1, 0));
  await page.click('#vrBtn');
  await page.waitForFunction(() => window.G?.mode === 'vr', null, { timeout: 10000 });
  const eye = () => page.evaluate(() => {
    const p = G.camera.getWorldPosition(new G.camera.position.constructor());
    return +(p.y - G.world.height(p.x, p.z)).toFixed(2);
  });
  const settle = (s) => page.waitForFunction((s) => { window.__t0 ??= G.t; if (G.t - window.__t0 > s) { window.__t0 = undefined; return true; } }, s, { timeout: 60000, polling: 50 });
  await settle(1.5);
  let e = await eye();
  check(Math.abs(e - 1.6) < 0.05, `Seated: sitting player's eyes lifted to standing height (${e} m above the ground, real 1.1 m)`);

  // Hands come up too (they ride with the eyes)
  const handUp = await page.evaluate(() => G.player.dolly.position.y - G.world.height(G.player.dolly.position.x, G.player.dolly.position.z));
  check(handUp > 0.4, `the whole rig (hands too) is raised (${handUp.toFixed(2)} m)`);

  // Slouch / a smaller kid: hold the left thumbstick in for over a second to reset
  const holdStick = async (side) => {
    await page.evaluate((s) => __xr.controllers[s].updateButtonValue('thumbstick', 1), side);
    await settle(1.4);
    await page.evaluate((s) => __xr.controllers[s].updateButtonValue('thumbstick', 0), side);
    await settle(0.2);
  };
  await page.evaluate(() => __xr.position.set(0, 0.85, 0)); await settle(0.3);
  e = await eye(); check(e < 1.45, `slouching lowers the view before the reset (${e} m)`);
  await holdStick('left');
  e = await eye(); check(Math.abs(e - 1.6) < 0.05, `holding the left thumbstick in resets height (${e} m)`);
  const hint = await page.evaluate(() => G.ui.hint.visible || G.ui.hintT > 0);
  check(hint, 'a "Height reset" note shows');

  // A short tap doesn't reset height (the lift from the last reset, 0.75 m, stays as it was):
  // it's the bird's-eye peek: up 30 m for a few seconds with a beam where you stand, then back
  await page.evaluate(() => __xr.position.set(0, 1.0, 0));
  await page.evaluate(() => __xr.controllers.right.updateButtonValue('thumbstick', 1)); await settle(0.3);
  await page.evaluate(() => __xr.controllers.right.updateButtonValue('thumbstick', 0)); await settle(1.0);
  e = await eye(); check(Math.abs(e - 31.75) < 0.1, `a quick click of the stick gives the bird's-eye peek (${e} m up)`);
  const beam = await page.evaluate(() => !!G.player.peekBeam?.visible);
  check(beam, 'a beam of light marks where you stand');
  await settle(5.5);
  e = await eye(); check(Math.abs(e - 1.75) < 0.05, `the peek ends back on the ground, height not reset (${e} m)`);
  // a story fade (a scene change) ends a peek straight away
  await page.evaluate(() => __xr.controllers.right.updateButtonValue('thumbstick', 1)); await settle(0.3);
  await page.evaluate(() => __xr.controllers.right.updateButtonValue('thumbstick', 0)); await settle(1.0);
  await page.evaluate(() => { G.ui.fadeOut(0.3); }); await settle(0.1);
  e = await eye(); check(Math.abs(e - 1.75) < 0.05, `a scene fade brings you straight back down from a peek (${e} m)`);
  await page.evaluate(() => G.ui.fadeIn(0.3)); await settle(0.5);
  await holdStick('right');
  e = await eye(); check(Math.abs(e - 1.6) < 0.05, `right thumbstick works too (${e} m)`);

  // Standing: your real height
  await page.evaluate(() => G.player.setSeated(false)); await settle(0.2);
  e = await eye(); check(Math.abs(e - 1.0) < 0.05, `Standing uses your real height (${e} m)`);
  // A tall grown-up standing who resets keeps their own height (never pushed down)
  await page.evaluate(() => __xr.position.set(0, 1.85, 0)); await settle(0.2);
  await holdStick('left');
  e = await eye(); check(Math.abs(e - 1.85) < 0.05, `a tall player is never pushed down (${e} m)`);

  // Still lifted after the story moves you somewhere new
  await page.evaluate(() => __xr.position.set(0, 1.1, 0));
  await holdStick('left');
  await page.evaluate(() => G.player.placeAt(3, -4, 0.5)); await settle(0.3);
  e = await eye(); check(Math.abs(e - 1.6) < 0.05, `the height carries over when you're moved to a new spot (${e} m)`);

  check(errors.length === 0, `no errors${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll height checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
