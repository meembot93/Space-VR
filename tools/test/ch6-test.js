// Headset emulator test for Chapter 6 (the Antikythera dive): runs the chapter in Chromium with
// Meta's IWER emulator pretending to be a Quest 3. Starts on the boat, follows the diver down,
// walks on the seafloor, picks up the bronze lump with GRIP, turns the machine's handle round and
// round with the controller until the eclipse dial finds an eclipse, then touches the journal page.
//
//   cd tools/test && npm install && node ch6-test.js          (add --shots to save screenshots)
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
  await page.goto(`http://localhost:${port}/index.html?fast&chapter=6`);
  await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 15000 });
  await page.click('#vrBtn');
  await page.waitForFunction(() => window.G?.mode === 'vr' && G.director.n === 6, null, { timeout: 20000 });
  check(true, 'VR session started in Chapter 6');
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(__dirname, `ch6_${name}.png`) }); };
  const until = async (fn, arg, ms = 90000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
  await page.evaluate(() => { window.__skip = setInterval(() => G.narration.skip(), 250); });
  const ch = (expr, arg) => page.evaluate(expr, arg);

  // On the boat
  await until(() => G.director.chapter?.s.phase === 'boat' || G.director.chapter?.s.phase === 'dive');
  const deckY = await ch(() => G.player.dolly.position.y);
  check(Math.abs(deckY - 0.95) < 0.05, `you stand on the boat's deck (${deckY.toFixed(2)} m above the sea)`);
  await shot('1_boat');
  // Down to the seafloor
  await until(() => G.director.chapter?.s.scene === 'sea');
  await page.waitForTimeout(1500);
  const under = await ch(() => ({ fog: G.scene.fog?.isFogExp2, sky: G.sky.group.visible }));
  check(under.fog && !under.sky, 'underwater: blue water fog, the sky hidden');
  // Walk on the seafloor with the left stick
  const before = await ch(() => [...G.camera.getWorldPosition(new G.camera.position.constructor()).toArray(), G.t]);
  await ch(() => __xr.controllers.left.updateAxes('thumbstick', 0, -1));
  await page.waitForTimeout(1200);
  await ch(() => __xr.controllers.left.updateAxes('thumbstick', 0, 0));
  const after = await ch(() => [...G.camera.getWorldPosition(new G.camera.position.constructor()).toArray(), G.t]);
  const walked = Math.hypot(after[0] - before[0], after[2] - before[2]);
  check(walked > 0.1, `left stick walks on the seafloor (${walked.toFixed(2)} m)`);
  await shot('2_seafloor');

  // The lump: stand at the rock, reach out and squeeze GRIP on it
  await until(() => G.director.chapter?.s.phase === 'lump');
  await ch(() => { const c = G.director.chapter; G.events.emit('placePlayers', { x: 3.5, z: -4.72, yaw: 0 }); });
  await page.waitForTimeout(400);
  const held = await ch(async () => {
    const c = G.director.chapter, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const setHand = (p) => { const l = G.player.dolly.worldToLocal(p.clone()); __xr.controllers.right.position.set(l.x, l.y, l.z); };
    setHand(c.lump.position); await wait(200);
    const frame = async (n = 1) => { for (let i = 0; i < n; i++) { const t0 = G.t; while (G.t === t0) await wait(10); } };
    __xr.controllers.right.updateButtonValue('squeeze', 1); await frame(2);
    const h = G.player.hands.find((x) => x.side === 'right'), lifted = c.s.lump >= 1, inHand = h.held === c.lumpIt;
    const up = c.lump.position.clone().add(new G.camera.position.constructor(0, 0.25, 0.1)); setHand(up); await frame(6);
    return { lump: lifted && inHand ? 1 : 0, d: c.holdHand ? c.lump.position.distanceTo(h.pos) : 0 };
  });
  check(held.lump === 1 && held.d < 0.1, `GRIP picks up the lump and it stays in your hand (${held.d.toFixed(2)} m from the hand)`);
  await shot('3_lump');
  await ch(() => __xr.controllers.right.updateButtonValue('squeeze', 0));

  // The X-ray and the gears building the machine
  await until(() => G.director.chapter?.s.phase === 'crank', null, 120000);
  check(await ch(() => G.director.chapter.s.build >= 1 && G.director.chapter.box.visible), 'the gears fly out and build the machine');
  await page.waitForTimeout(800);
  await shot('4_machine');
  // Grip the handle and turn it round in circles
  const turnHandle = (turns) => ch(async (turns) => {
    const c = G.director.chapter, V = G.camera.position.constructor, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const piv = c.crankPivot.position, R = 0.072;
    const handAt = (a) => { const p = c.box.localToWorld(new V(piv.x + 0.045, piv.y + Math.cos(a) * R, piv.z + Math.sin(a) * R)); const l = G.player.dolly.worldToLocal(p); __xr.controllers.right.position.set(l.x, l.y, l.z); };
    const a0 = c.crankPivot.rotation.x;
    const frame = async () => { const t0 = G.t; while (G.t === t0) await wait(10); };
    handAt(a0); await frame(); await frame();
    __xr.controllers.right.updateButtonValue('squeeze', 1); await frame(); await frame();
    for (let a = 0; a < turns * Math.PI * 2; a += 0.4) { handAt(a0 + a); await frame(); if (c.s.eclipse) break; }
    __xr.controllers.right.updateButtonValue('squeeze', 0); await frame();
    return c.s.crank;
  }, turns);
  const c1 = await turnHandle(1.5);
  check(c1 > 1, `turning the handle with GRIP moves the days on (${c1.toFixed(2)} turns)`);
  const moon = await ch(() => G.director.chapter.moonPtr.rotation.z);
  check(Math.abs(moon) > 1, 'the Moon pointer goes round on the front dial');
  // The eclipse dial on the back
  await until(() => G.director.chapter?.s.phase === 'eclipse', null, 120000);
  check(await ch(() => G.director.chapter.s.flip === 1), 'the machine turns round to show its back');
  let n = 0;
  while (n++ < 12 && !(await ch(() => G.director.chapter.s.eclipse))) await turnHandle(1);
  check(await ch(() => G.director.chapter.s.eclipse === 1), `turning on finds an eclipse on the back dial (month ${await ch(() => G.director.chapter.s.eclM)})`);
  await page.waitForTimeout(1500);
  await shot('5_eclipse');

  // The journal page
  await until(() => G.director.chapter?.s.journal === 1, null, 120000);
  await page.waitForTimeout(1500);
  await shot('6_journal');
  await ch(async () => {
    const c = G.director.chapter, p = c.journal.getWorldPosition(new G.camera.position.constructor());
    const l = G.player.dolly.worldToLocal(p.clone());
    __xr.controllers.left.position.set(l.x, l.y, l.z);
    await new Promise((r) => setTimeout(r, 150));
    __xr.controllers.left.updateButtonValue('trigger', 1);
    await new Promise((r) => setTimeout(r, 150));
    __xr.controllers.left.updateButtonValue('trigger', 0);
  });
  await until(() => G.director.chapter?.s.phase === 'done', null, 20000).then(() => check(true, 'touching the journal page ends the chapter'), () => check(false, 'touching the journal page ends the chapter'));
  check(errors.length === 0, `no errors in the page${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failures ? `${failures} check(s) failed` : 'All checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
