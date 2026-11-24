// Chapter 10 (Kepler), Adults: the drawing board on the desk. Checks the pencil is in reach of a hand
// from where you start, that grabbing it and moving your hand round the pins draws the ellipse
// (the pencil follows the hand, it doesn't draw by itself while you steer), and that the finished
// drawing flies out to Mars's orbit.   node ch10-pen-test.js
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures++; };
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  const errors = [];
  page.on('pageerror', (e) => { if (!/Pointer Lock/.test(e.message)) errors.push(e.message); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${srv.address().port}/index.html?fast&autostart&rating=adults&chapter=10`);
  await page.waitForFunction(() => window.G?.director?.running, null, { timeout: 600000 });
  await page.evaluate(() => { window.__skip = setInterval(() => { if (G.director.chapter?.s.pen !== 1) G.narration.skip(); }, 150); });
  await page.waitForFunction(() => G.director.chapter?.s.pen === 1, null, { timeout: 900000, polling: 200 });
  const r = await page.evaluate(() => {
    const c = G.director.chapter, it = c.penIt, V = G.camera.position.constructor;
    // a hand reaching forward and a little right from where you start (head 1.6 m up)
    const st = c.start.pos, top = G.world.height(st.x, st.z);
    const hand = new V(st.x + 0.3, top + 1.1, st.z - 0.4);
    return { disabled: it.disabled, reach: it.reach(hand), interactable: G.interactables.includes(it), kids: !!G.kids };
  });
  check(!r.kids, 'Adults mode');
  check(r.interactable && !r.disabled, 'the pencil can be taken');
  check(r.reach < 0.22, `the pencil is in reach of a hand from the start (gap ${r.reach.toFixed(2)} m)`);
  // grab and steer the pencil round with the hand (onHold every ~frame)
  await page.evaluate(() => { const c = G.director.chapter; window.__h = { pos: new G.camera.position.constructor() }; c.penIt.onGrab(window.__h); });
  await page.waitForFunction(() => G.director.chapter.s.pen === 2, null, { timeout: 60000 });
  const steps = [];
  for (let i = 1; i <= 40; i++) {
    const out = await page.evaluate((i) => {
      const c = G.director.chapter, a = i / 40 * Math.PI * 1.02;   // half way round
      c.board.localToWorld(window.__h.pos.set(0.155 * 1.3 * Math.cos(a), 0.1, -0.14 * 1.3 * Math.sin(a)));
      c.penIt.onHold(window.__h);
      return { a, pen: c.penA, bins: c.binN };
    }, i);
    steps.push(out);
    await page.waitForTimeout(60);
  }
  const half = steps[steps.length - 1];
  check(half.bins > 45 && half.bins < 80, `the line follows the hand half way round (${half.bins}/120 drawn)`);
  check(Math.abs(half.pen - half.a) < 0.4, `the pencil sits where the hand is (pencil ${half.pen.toFixed(2)} rad, hand ${half.a.toFixed(2)} rad)`);
  for (let i = 41; i <= 84; i++) {
    await page.evaluate((i) => {
      const c = G.director.chapter, a = i / 40 * Math.PI;   // on round the rest of the way
      c.board.localToWorld(window.__h.pos.set(0.2 * Math.cos(a), 0.1, -0.18 * Math.sin(a)));
      c.penIt.onHold(window.__h);
    }, i);
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => G.director.chapter.penIt.onRelease(window.__h));
  await page.waitForFunction(() => G.director.chapter.s.pen >= 3, null, { timeout: 300000 }).catch(() => {});
  check(await page.evaluate(() => G.director.chapter.s.pen >= 3), 'all the way round: the drawing is done');
  await page.waitForFunction(() => G.director.chapter.s.pen === 4 && G.director.chapter.s.ell === 2, null, { timeout: 300000 }).catch(() => {});
  check(await page.evaluate(() => G.director.chapter.s.pen === 4 && G.director.chapter.s.ell === 2), 'the drawing flew out and landed on Mars\'s orbit');
  check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); srv.close();
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
})();
