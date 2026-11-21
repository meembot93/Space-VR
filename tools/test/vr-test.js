// Headset emulator test (same idea as Broadside VR's): runs the game in Chromium with Meta's
// IWER emulator pretending to be a Quest 3, presses Enter VR, and plays Chapter 2 with the
// virtual controllers: walks with the left stick, snap-turns with the right, grips the rope and
// hauls it in hand over hand, then touches the journal page with the trigger.
//
//   cd tools/test && npm install && npm test          (add --shots to save screenshots)
//
// Needs Playwright with Chromium (preinstalled in Claude's cloud machines).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const SHOTS = process.argv.includes('--shots');
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
  // The emulated Quest 3, installed before the game's own code runs
  await page.addInitScript({ path: require.resolve('iwer/build/iwer.min.js') });
  await page.addInitScript(() => { const d = new IWER.XRDevice(IWER.metaQuest3); d.installRuntime({ forceInstall: true }); window.__xr = d; });
  await page.goto(`http://localhost:${port}/index.html?fast&chapter=2`);
  await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 15000 });
  check(true, 'Enter VR button is enabled with a (virtual) headset');
  await page.click('#vrBtn');
  await page.waitForFunction(() => window.G?.mode === 'vr', null, { timeout: 10000 });
  check(true, 'VR session started');
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(__dirname, `vr_${name}.png`) }); };

  // Helpers that run in the page
  const phase = () => page.evaluate(() => G.director.chapter?.s.phase);
  const until = async (fn, arg, ms = 60000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
  const skipLines = () => page.evaluate(() => { window.__skip = setInterval(() => G.narration.skip(), 200); });
  await skipLines();

  // Wait for the walk, then walk forward with the left stick and check we moved
  await until(() => G.director.chapter?.s.phase === 'walk');
  await shot('1_arrive');
  const before = await page.evaluate(() => [...G.camera.getWorldPosition(new G.camera.position.constructor()).toArray(), G.t]);
  await page.evaluate(() => __xr.controllers.left.updateAxes('thumbstick', 0, -1));
  await page.waitForTimeout(1200);
  await page.evaluate(() => __xr.controllers.left.updateAxes('thumbstick', 0, 0));
  const after = await page.evaluate(() => [...G.camera.getWorldPosition(new G.camera.position.constructor()).toArray(), G.t]);
  // (game time, not wall time: the software-rendered test browser runs at only a few frames a second)
  const walked = Math.hypot(after[0] - before[0], after[2] - before[2]), gameT = after[3] - before[3];
  check(walked > 0.6 * 1.8 * gameT && walked > 0.1, `left stick walks (${walked.toFixed(2)} m in ${gameT.toFixed(2)} s of game time)`);
  // Astra rests out in front of you (about 7 m away), not off at the edge of your view
  await page.waitForTimeout(2500);
  const astra = await page.evaluate(() => {
    const V = G.camera.position.constructor, c = G.camera.getWorldPosition(new V()), f = G.camera.getWorldDirection(new V());
    const d = G.guide.root.position.clone().sub(c); const dist = d.length();
    return { dist, ang: Math.acos(d.normalize().dot(f)) * 180 / Math.PI };
  });
  check(astra.dist > 5 && astra.dist < 9 && astra.ang < 25, `Astra waits in front of you (${astra.dist.toFixed(1)} m away, ${astra.ang.toFixed(0)}° from the middle of your view)`);
  // Point the right controller at Vega: its name comes up
  const star = await page.evaluate(async () => {
    const sf = G.sky.starField, V = G.camera.position.constructor, P = G.player;
    let vi; for (const [i, l] of sf.labels) if (l.name === 'Vega') vi = i;
    const w = new V(sf.dirs[vi * 3], sf.dirs[vi * 3 + 1], sf.dirs[vi * 3 + 2]).applyMatrix4(sf.toWorld.clone().setPosition(0, 0, 0));
    // aim the controller (in the rig's own space) along that direction
    const local = w.clone().transformDirection(P.dolly.matrixWorld.clone().invert());
    const q = new G.camera.quaternion.constructor().setFromUnitVectors(new V(0, 0, -1), local.normalize());
    const c = __xr.controllers.right; c.position.set(0.25, 1.2, -0.3); c.quaternion.set(q.x, q.y, q.z, q.w);
    await new Promise((r) => setTimeout(r, 2500));
    const res = { name: G.stargazing.cur?.name, con: G.stargazing.cur?.conName, alt: Math.asin(w.y) * 180 / Math.PI, night: sf.opacity };
    c.quaternion.set(0, 0, 0, 1);
    return res;
  });
  check(star.name === 'Vega' || star.alt < 10, `pointing at a star shows its name (${star.name} in ${star.con}, ${star.alt.toFixed(0)}° up)`);
  // Pause with X, carry on with A
  const el0 = await page.evaluate(() => { clearInterval(window.__skip); return G.director.chapter.s.sunEl; });
  const press = (hand, b) => page.evaluate(async ([hand, b]) => { __xr.controllers[hand].updateButtonValue(b, 1); await new Promise((r) => setTimeout(r, 150)); __xr.controllers[hand].updateButtonValue(b, 0); await new Promise((r) => setTimeout(r, 150)); }, [hand, b]);
  await press('left', 'x-button');
  const p1 = await page.evaluate(() => G.paused);
  await page.waitForTimeout(1500);
  const el1 = await page.evaluate(() => G.director.chapter.s.sunEl);
  await press('right', 'a-button');
  const p2 = await page.evaluate(() => G.paused);
  check(p1 === true && p2 === false && Math.abs(el1 - el0) < 0.02, `X pauses the story and A carries on (paused: ${p1}, then ${p2})`);
  await skipLines();
  // Snap turn with the right stick
  const yaw0 = await page.evaluate(() => G.player.dolly.rotation.y);
  await page.evaluate(() => __xr.controllers.right.updateAxes('thumbstick', 1, 0));
  await page.waitForTimeout(300);
  await page.evaluate(() => __xr.controllers.right.updateAxes('thumbstick', 0, 0));
  await page.waitForTimeout(200);
  const yaw1 = await page.evaluate(() => G.player.dolly.rotation.y);
  check(Math.abs(Math.abs(yaw1 - yaw0) - Math.PI / 4) < 0.01, `right stick snap-turns 45° (${((yaw1 - yaw0) * 180 / Math.PI).toFixed(1)}°)`);

  // The rope
  await until(() => G.director.chapter?.s.phase === 'pull', null, 90000);
  await page.waitForTimeout(500);
  await shot('2_pull');
  // Put the right controller on the rope beside us, squeeze, pull it in toward the centre, let go, reach out again
  const pullOnce = () => page.evaluate(async () => {
    const ch = G.director.chapter, V = G.camera.position.constructor;
    const head = G.camera.getWorldPosition(new V());
    // nearest point on the rope to our head
    const a = ch.ropeEnd, b = ch.ropeStart, ab = b.clone().sub(a);
    const t = Math.max(0, Math.min(1, head.clone().sub(a).dot(ab) / ab.lengthSq()));
    const onRope = a.clone().addScaledVector(ab, t);
    const out = ch.u.clone();               // outward along the rope (toward the stone)
    const setHand = (p) => { const l = G.player.dolly.worldToLocal(p.clone()); __xr.controllers.right.position.set(l.x, l.y, l.z); };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    setHand(onRope.clone().addScaledVector(out, 0.35)); await wait(120);
    __xr.controllers.right.updateButtonValue('squeeze', 1); await wait(120);
    for (let i = 1; i <= 6; i++) { setHand(onRope.clone().addScaledVector(out, 0.35 - i * 0.1)); await wait(60); }
    __xr.controllers.right.updateButtonValue('squeeze', 0); await wait(100);
    return ch.s.pulled;
  });
  // Walk the head next to the rope first (the stand-here ring), so it's in reach
  await page.evaluate(() => { const s = G.director.chapter.pullSpot(); G.events.emit('placePlayers', { x: s.x, z: s.z, yaw: G.player.dolly.rotation.y }); });
  let pulled = 0, n = 0;
  while (n++ < 40) { pulled = await pullOnce(); if (await phase() !== 'pull') break; }
  check(n < 40, `hauled the stone in by gripping and pulling the rope (${n} pulls)`);

  await until(() => ['gap', 'sunrise'].includes(G.director.chapter?.s.phase), null, 120000);
  check(true, 'the stone stood up in its hole');
  await until(() => G.director.chapter?.s.phase === 'lapse', null, 240000);
  await page.waitForTimeout(300);
  await shot('3_sunrise');
  const beam = await page.evaluate(() => G.director.chapter.beamV);
  check(beam > 0.3, `sunbeam shines through the gap (${beam.toFixed(2)})`);

  // The journal page: touch it with the trigger
  await until(() => G.director.chapter?.s.journal === 1, null, 240000);
  await page.waitForTimeout(1500);
  await shot('4_journal');
  await page.evaluate(async () => {
    const ch = G.director.chapter, p = ch.journal.getWorldPosition(new G.camera.position.constructor());
    const l = G.player.dolly.worldToLocal(p.clone());
    __xr.controllers.left.position.set(l.x, l.y, l.z);
    await new Promise((r) => setTimeout(r, 150));
    __xr.controllers.left.updateButtonValue('trigger', 1);
    await new Promise((r) => setTimeout(r, 150));
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
