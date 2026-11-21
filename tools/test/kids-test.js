// Kids mode (the default) is hands-free: run each built chapter in the headset emulator without
// touching anything, and check it plays through to the end with no "do this" hints.   node kids-test.js [n ...]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const CHAPTERS = process.argv.slice(2).map(Number);
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures++; };
// hints that only name what's happening (season names) are fine; anything asking you to act is not
const ASKS = /\b(walk|touch|click|point|turn|pull|grab|ring|hold|press|look|follow|lift|stick|trigger|grip)\b/i;
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const list = CHAPTERS.length ? CHAPTERS : (await (async () => { const src = fs.readFileSync(path.join(ROOT, 'js/chapters.js'), 'utf8'); return [...src.matchAll(/\{ n: (\d+),[^\n]*ready: true/g)].map((m) => Number(m[1])); })());
  for (const n of list) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript({ path: require.resolve('iwer/build/iwer.min.js') });
    await page.addInitScript(() => { const d = new IWER.XRDevice(IWER.metaQuest3); d.installRuntime({ forceInstall: true }); window.__xr = d; });
    await page.goto(`http://localhost:${srv.address().port}/index.html?fast&chapter=${n}`);
    await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 20000 });
    await page.click('#vrBtn');
    await page.waitForFunction(() => window.G?.mode === 'vr' && G.director.running, null, { timeout: 15000 });
    const t0 = Date.now();
    await page.evaluate(() => {
      window.__hints = []; const sh = G.ui.showHint.bind(G.ui);
      G.ui.showHint = (t, s) => { if (t) __hints.push(t); return sh(t, s); };
      window.__skip = setInterval(() => G.narration.skip(), 200);
      window.__ended = false; G.events.on('chapterEnd', () => { window.__ended = true; });
    });
    const kids = await page.evaluate(() => G.kids);
    const ok = await page.waitForFunction(() => window.__ended, null, { timeout: 420000, polling: 250 }).then(() => true, () => false);
    const r = await page.evaluate(() => ({ hints: __hints, phase: G.director.chapter?.s?.phase }));
    const asks = r.hints.filter((h) => ASKS.test(h));
    check(kids && ok, `Chapter ${n} plays to the end by itself in Kids mode (${Math.round((Date.now() - t0) / 1000)} s${ok ? '' : ', stuck at ' + r.phase})`);
    check(asks.length === 0, `Chapter ${n} never asks the player to do anything${asks.length ? ': ' + asks.join(' | ') : ''}`);
    check(errors.length === 0, `Chapter ${n}: no errors in the page${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
    await page.close();
  }
  await browser.close(); srv.close();
  console.log(failures ? `${failures} check(s) failed` : 'All checks passed');
  process.exit(failures ? 1 : 0);
})();
