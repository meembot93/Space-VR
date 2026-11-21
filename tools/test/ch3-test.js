// Headset emulator test for Chapter 3 (Sirius over the Nile) and the Nebra disk bridge.
// Runs the chapter in Chromium with Meta's IWER emulator (a virtual Quest 3): points the right
// controller at Sirius as it rises, tugs the bell rope, touches the journal page with the trigger,
// then grips the Nebra disk and lifts it up to the sky.
//
//   cd tools/test && npm install && npm run test:ch3          (add --shots to save screenshots)
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
  await page.goto(`http://localhost:${port}/index.html?fast&rating=adults&chapter=3`);
  await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 15000 });
  await page.click('#vrBtn');
  await page.waitForFunction(() => window.G?.mode === 'vr', null, { timeout: 10000 });
  check(true, 'VR session started in Chapter 3');
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(__dirname, `ch3_${name}.png`) }); };
  const until = async (fn, arg, ms = 60000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
  const phase = () => page.evaluate(() => G.director.chapter?.s.phase);
  await page.evaluate(() => { window.__skip = setInterval(() => G.narration.skip(), 200); });

  // You start on the roof
  await until(() => G.director.chapter?.s.phase === 'arrive');
  const roof = await page.evaluate(() => G.player.dolly.position.y);
  check(roof > 5, `you stand up on the roof (${roof.toFixed(1)} m above the river)`);
  await shot('1_arrive');

  // Sirius rises: point the right controller at it
  await until(() => G.director.chapter?.s.phase === 'search', null, 90000);
  await page.evaluate(() => clearInterval(window.__skip));
  await until(() => G.director.chapter?.sirius.material.opacity > 0.05, null, 30000).catch(() => {});
  // (she twinkles, so take the brightest of a few looks)
  const sky = await page.evaluate(async () => { let op = 0; for (let i = 0; i < 10; i++) { op = Math.max(op, G.director.chapter.sirius.material.opacity); await new Promise((r) => setTimeout(r, 100)); } return { op }; });
  check(sky.op > 0.05, `Sirius shows just above the horizon (brightness ${sky.op.toFixed(2)})`);
  await shot('2_search');
  // aim: turn the controller so its pointing direction (-Z) is toward Sirius, in the rig's own space
  await page.evaluate(() => {
    const V = G.camera.position.constructor, c = G.director.chapter;
    const sd = c.sirius.position.clone().sub(G.camera.getWorldPosition(new V())).normalize();
    const dollyQ = G.player.dolly.getWorldQuaternion(G.camera.quaternion.clone()).invert();
    const local = sd.applyQuaternion(dollyQ);
    const q = G.camera.quaternion.clone().setFromUnitVectors(new V(0, 0, -1), local);
    __xr.controllers.right.quaternion.set(q.x, q.y, q.z, q.w);
  });
  await until(() => G.director.chapter?.s.found, null, 20000).then(() => check(true, 'pointing the controller at Sirius finds it'), () => check(false, 'pointing the controller at Sirius finds it'));
  await page.evaluate(() => { __xr.controllers.right.quaternion.set(0, 0, 0, 1); window.__skip = setInterval(() => G.narration.skip(), 200); });

  // The bell: grip the rope and tug it down
  await until(() => G.director.chapter?.s.phase === 'bell', null, 30000);
  await page.evaluate(() => clearInterval(window.__skip));
  const rung0 = await page.evaluate(() => G.director.chapter.s.rung);
  await page.evaluate(async () => {
    const V = G.camera.position.constructor, c = G.director.chapter, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const B = c.bellPos;
    G.events.emit('placePlayers', { x: B.x - 0.6, z: B.z - 0.6, yaw: G.player.dolly.rotation.y });
    await wait(300);
    const rope = c.bellRope.getWorldPosition(new V()); rope.y -= 0.5;
    const setHand = (p) => { const l = G.player.dolly.worldToLocal(p.clone()); __xr.controllers.left.position.set(l.x, l.y, l.z); };
    setHand(rope); await wait(200);
    __xr.controllers.left.updateButtonValue('squeeze', 1); await wait(150);
    for (let i = 1; i <= 5; i++) { setHand(rope.clone().setY(rope.y - i * 0.05)); await wait(80); }
    __xr.controllers.left.updateButtonValue('squeeze', 0); await wait(150);
  });
  await page.waitForTimeout(500);
  const rung1 = await page.evaluate(() => G.director.chapter.s.rung);
  check(rung1 > rung0, `tugging the bell rope rings the bell (${rung1 - rung0} ring)`);
  await page.evaluate(() => { window.__skip = setInterval(() => G.narration.skip(), 200); });

  // Lamps come on, the Sun comes up, then the year goes by
  await until(() => G.director.chapter?.s.phase === 'year', null, 120000);
  const lit = await page.evaluate(() => G.director.chapter.s.lights);
  check(lit > 0.9, 'the village lamps are lit');
  await until(() => G.director.chapter?.s.year > 0.2, null, 60000);
  await page.waitForTimeout(300);
  const water = await page.evaluate(() => G.director.chapter.water.position.y);
  check(water > 0.5, `the flood spreads over the fields (water ${water.toFixed(2)} m up)`);
  await shot('3_flood');
  await until(() => G.director.chapter?.s.year > 0.65, null, 60000);
  const crops = await page.evaluate(() => G.director.chapter.crops.visible && G.director.chapter.water.position.y < 0);
  check(crops, 'the flood goes down and the crops grow');
  await shot('4_growing');

  // The journal page
  await until(() => G.director.chapter?.s.journal === 1, null, 120000);
  await page.waitForTimeout(1500);
  await shot('5_journal');
  await page.evaluate(async () => {
    const ch = G.director.chapter, p = ch.journal.getWorldPosition(new G.camera.position.constructor());
    const l = G.player.dolly.worldToLocal(p.clone());
    __xr.controllers.left.position.set(l.x, l.y, l.z);
    await new Promise((r) => setTimeout(r, 150));
    __xr.controllers.left.updateButtonValue('trigger', 1);
    await new Promise((r) => setTimeout(r, 150));
    __xr.controllers.left.updateButtonValue('trigger', 0);
  });
  await until(() => G.director.chapter?.s.scene === 'nebra', null, 20000).then(() => check(true, 'touching the journal page goes on to the Nebra sky disk'), () => check(false, 'touching the journal page goes on to the Nebra sky disk'));

  // The Nebra disk: grip it and lift it up
  await until(() => G.director.chapter?.s.phase === 'hold', null, 30000);
  await page.waitForTimeout(1500);
  await page.evaluate(() => clearInterval(window.__skip));
  await shot('6_disk');
  await page.evaluate(async () => {
    const V = G.camera.position.constructor, c = G.director.chapter, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const p = c.disk.getWorldPosition(new V());
    const setHand = (q) => { const l = G.player.dolly.worldToLocal(q.clone()); __xr.controllers.right.position.set(l.x, l.y, l.z); };
    setHand(p); await wait(200);
    __xr.controllers.right.updateButtonValue('squeeze', 1); await wait(150);
    const head = G.camera.getWorldPosition(new V());
    for (let i = 1; i <= 6; i++) { setHand(p.clone().lerp(head.clone().add(new V(0.1, 0.35, -0.3)), i / 6)); await wait(100); }
  });
  await until(() => G.director.chapter?.s.held, null, 15000).then(() => check(true, 'gripping the disk and lifting it up lights the Pleiades'), () => check(false, 'gripping the disk and lifting it up lights the Pleiades'));
  await page.waitForTimeout(800);
  await shot('7_pleiades');
  await until(() => G.director.chapter?.s.phase === 'done', null, 30000).then(() => check(true, 'the chapter ends'), () => check(false, 'the chapter ends'));

  const info = await page.evaluate(async () => {
    // back in Egypt for a moment, to count what the busiest view costs
    const c = G.director.chapter; c.s.scene = 'egypt'; G.player.dolly.rotation.y = Math.PI / 2;
    await new Promise((r) => setTimeout(r, 600));
    return { calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles };
  });
  console.log(`      draw calls ${info.calls}, triangles ${info.tris} (both eyes together)`);
  check(errors.length === 0, `no errors in the page${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failures ? `${failures} check(s) failed` : 'All checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
