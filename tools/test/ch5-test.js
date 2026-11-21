// Headset emulator test for Chapter 5 (Greece proves the Earth is round, plus its two bridges).
// Plays the whole chapter on a virtual Quest 3: holds the plate and the ball up to the lamp,
// stands both sticks in their rings, measures the angle, touches the journal page, paints the
// comet and sorts Hipparchus's stars into their baskets (one on purpose into the wrong one first).
//
//   cd tools/test && npm install && node ch5-test.js          (add --shots to save screenshots)
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
  await page.goto(`http://localhost:${port}/index.html?fast&chapter=5&rating=adults`);
  await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 15000 });
  await page.click('#vrBtn');
  await page.waitForFunction(() => window.G?.mode === 'vr' && G.director.n === 5, null, { timeout: 20000 });
  check(true, 'Chapter 5 starts in VR');
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(__dirname, `ch5_${name}.png`) }); };
  const until = async (fn, arg, ms = 300000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
  const st = (k) => page.evaluate((k) => G.director.chapter.s[k], k);
  await page.evaluate(() => { window.__skip = setInterval(() => G.narration.skip(), 200); });
  const stats = {};
  const measure = async (name) => { await page.waitForTimeout(400); stats[name] = await page.evaluate(() => ({ calls: G.renderer.info.render.calls, tris: G.renderer.info.render.triangles })); };

  // In-page helpers: put a controller at a world position, squeeze/trigger, move it along
  await page.evaluate(() => {
    const V = G.camera.position.constructor;
    window.__T = {
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      put(hand, p) { const l = G.player.dolly.worldToLocal(new V(p.x, p.y, p.z)); __xr.controllers[hand].position.set(l.x, l.y, l.z); },
      async carry(hand, from, to, steps = 6) {
        this.put(hand, from); await this.wait(200);
        __xr.controllers[hand].updateButtonValue('squeeze', 1); await this.wait(200);
        for (let i = 1; i <= steps; i++) { this.put(hand, { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps, z: from.z + (to.z - from.z) * i / steps }); await this.wait(120); }
        await this.wait(600);
      },
      async letGo(hand) { __xr.controllers[hand].updateButtonValue('squeeze', 0); await this.wait(300); },
      async poke(hand, p) { this.put(hand, p); await this.wait(200); __xr.controllers[hand].updateButtonValue('trigger', 1); await this.wait(200); __xr.controllers[hand].updateButtonValue('trigger', 0); await this.wait(200); },
      wp(o) { return o.getWorldPosition(new V()); },
    };
  });

  // ---- Athens: the ship, the eclipse ----
  await until(() => G.director.chapter?.s.phase === 'eclipse');
  await shot('1_grove');
  await measure('grove');
  await until(() => G.director.chapter?.s.curve === 1);
  const ecl = await st('eclipse');
  check(ecl > 0.5, `Earth's shadow slides onto the Moon (${ecl.toFixed(2)})`);
  await shot('2_eclipse');

  // ---- The plate and the ball at the lamp ----
  await until(() => G.director.chapter?.s.phase === 'shadows');
  await page.evaluate(() => clearInterval(window.__skip));   // let Astra finish "Try it yourself" while we play
  await page.waitForTimeout(800);
  const plateP = page.evaluate(async () => {
    const ch = G.director.chapter, T = __T;
    await T.carry('right', T.wp(ch.plate), { x: 0.45, y: 1.35, z: -3.45 });
    const shadow = ch.shadows[0].visible, held = !!ch.local.plate;
    await T.wait(500); window.__holding = true; while (window.__holding) await T.wait(100);
    const tried = ch.s.plate;
    await T.letGo('right');
    return { shadow, held, tried };
  });
  await until(() => window.__holding, null, 20000); await shot('3_plate_held'); await page.evaluate(() => { window.__holding = false; });
  const plateRes = await plateP;
  check(plateRes.held, 'grip picks up the plate');
  check(plateRes.shadow, 'the plate throws a shadow on the wall');
  check(plateRes.tried === 1, 'holding the plate edge-on to the lamp counts as trying it');
  const ballRes = await page.evaluate(async () => {
    const ch = G.director.chapter, T = __T;
    await T.carry('left', T.wp(ch.ball), { x: 0.4, y: 1.3, z: -3.5 });
    const shadow = ch.shadows[1].visible;
    for (let i = 0; i < 100 && !ch.s.ball; i++) await T.wait(200);   // about a second of game time (the test browser is slow)
    const tried = ch.s.ball;
    await T.letGo('left');
    return { shadow, tried };
  });
  check(ballRes.shadow && ballRes.tried === 1, 'the ball held up to the lamp throws a round shadow');
  await page.evaluate(() => { window.__skip = setInterval(() => G.narration.skip(), 200); });

  // ---- Syene: the well and the stick ----
  await until(() => G.director.chapter?.s.set === 'syene');
  await page.waitForTimeout(600);
  await shot('4_syene');
  await measure('syene');
  await until(() => G.director.chapter?.s.phase === 'plantS');
  const glint = await page.evaluate(() => G.director.chapter.glintSpr.visible);
  check(glint, 'the Sun shines on the water at the bottom of the well');
  await page.evaluate(async () => {
    const ch = G.director.chapter, T = __T, r = ch.ringS;
    // walk over next to the stick first, so it's in reach
    const sp = T.wp(ch.stickS); G.events.emit('placePlayers', { x: sp.x + 0.5, z: sp.z + 0.4, yaw: 0 }); await T.wait(300);
    await T.carry('right', T.wp(ch.stickS), { x: r[0], y: 0.3, z: r[1] });
    await T.letGo('right');
  });
  await until(() => G.director.chapter?.s.plantS === 1, null, 10000).then(() => check(true, 'carrying the stick to the ring stands it up'), () => check(false, 'carrying the stick to the ring stands it up'));
  const shS = await page.evaluate(() => G.director.chapter.stickS.userData.shadow.scale.y);
  check(shS < 0.01, `in Syene the stick has no shadow (${shS.toFixed(3)} m)`);

  // ---- Alexandria: the short shadow, the protractor, the globe ----
  await until(() => G.director.chapter?.s.phase === 'plantA');
  await page.waitForTimeout(500);
  await shot('5_alex');
  await page.evaluate(async () => {
    const ch = G.director.chapter, T = __T, r = ch.ringA;
    const sp = T.wp(ch.stickA); G.events.emit('placePlayers', { x: sp.x + 0.5, z: sp.z + 0.4, yaw: 0 }); await T.wait(300);
    await T.carry('right', T.wp(ch.stickA), { x: r[0], y: 0.3, z: r[1] });
    await T.letGo('right');
  });
  await until(() => G.director.chapter?.s.plantA === 1, null, 10000);
  const shA = await page.evaluate(() => { const sh = G.director.chapter.stickA.userData.shadow; const p = sh.localToWorld(new G.camera.position.constructor(0, 0, -1)); return { len: sh.scale.y, northward: p.z < sh.position.z }; });
  check(Math.abs(shA.len - 0.202) < 0.01 && shA.northward, `in Alexandria it casts a short shadow, pointing north (${shA.len.toFixed(3)} m)`);
  await until(() => G.director.chapter?.s.prot === 1);
  await page.evaluate(async () => {
    const ch = G.director.chapter, T = __T, p = ch.protTop;
    G.events.emit('placePlayers', { x: p.x + 0.7, z: p.z, yaw: Math.PI / 2 }); await T.wait(300);
    await T.poke('right', { x: p.x + 0.1, y: p.y - 0.3, z: p.z });
  });
  await until(() => G.director.chapter?.s.measure >= 1, null, 20000).then(() => check(true, 'touching the protractor measures the 7° angle'), () => check(false, 'touching the protractor measures the angle'));
  await shot('6_measure');
  await until(() => G.director.chapter?.s.slices >= 50);
  await page.waitForTimeout(500);
  await shot('7_globe');
  await measure('alexandria');
  check(true, 'the globe is measured out in 50 slices');

  // ---- Journal page ----
  await until(() => G.director.chapter?.s.journal === 1);
  await page.waitForTimeout(1200);
  await shot('8_journal');
  await page.evaluate(async () => { const ch = G.director.chapter; await __T.poke('left', __T.wp(ch.journal)); });
  await until(() => G.director.chapter?.s.journal === 2, null, 10000).then(() => check(true, 'touching the journal page turns to the bridges'), () => check(false, 'touching the journal page'));

  // ---- Bridge: China ----
  await until(() => G.director.chapter?.s.set === 'china' && G.director.chapter.s.paint === 1);
  await page.waitForTimeout(600);
  await measure('china');
  await page.evaluate(async () => { const ch = G.director.chapter; await __T.poke('right', __T.wp(ch.scroll)); });
  await until(() => G.director.chapter?.s.brush >= 1, null, 15000).then(() => check(true, 'touching the silk scroll paints the comet'), () => check(false, 'painting the comet'));
  await shot('9_china');

  // ---- Bridge: Hipparchus's stars ----
  await until(() => G.director.chapter?.s.phase === 'sort');
  await page.waitForTimeout(500);
  await shot('10_rhodes');
  await measure('rhodes');
  const sortRes = await page.evaluate(async () => {
    const ch = G.director.chapter, T = __T, s = ch.s;
    // first: a bright star into the Faint basket (should bounce back)
    const i0 = ch.mags.indexOf(1), bF = ch.baskets[1];
    await T.carry('right', T.wp(ch.stars[i0]), { x: bF.x, y: bF.y + 0.12, z: bF.z }); await T.letGo('right');
    const wrongKept = s.sorted[i0];
    for (let i = 0; i < 6; i++) {
      const b = ch.baskets[ch.mags[i] <= 3 ? 0 : 1];
      await T.carry('right', T.wp(ch.stars[i]), { x: b.x, y: b.y + 0.12, z: b.z }); await T.letGo('right');
    }
    return { wrongKept, sorted: [...s.sorted], oops: s.oops || 0 };
  });
  check(sortRes.wrongKept === 0 && sortRes.oops >= 1, 'a star dropped in the wrong basket comes back out');
  check(sortRes.sorted.every((v) => v), `all six stars sorted by hand (${sortRes.sorted.join(',')})`);
  await until(() => G.director.chapter?.s.phase === 'done', null, 30000).then(() => check(true, 'the chapter finishes'), () => check(false, 'the chapter finishes'));
  for (const [k, v] of Object.entries(stats)) console.log(`      ${k}: draw calls ${v.calls}, triangles ${v.tris} (both eyes together)`);
  check(errors.length === 0, `no errors in the page${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await browser.close(); srv.close();
  console.log(failures ? `${failures} check(s) failed` : 'All checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
