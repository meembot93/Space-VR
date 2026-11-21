// Audit helper: plays a chapter in Kids mode and saves two screenshots per narration line
// (shortly after it starts and later on), so you can check the scene shows what Astra says.
//   node audit-shots.js <chapter> <outdir>
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const n = Number(process.argv[2]), out = process.argv[3] || __dirname;
const extra = process.argv[4] || '';
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.addInitScript({ path: require.resolve('iwer/build/iwer.min.js') });
  await page.addInitScript(() => { const d = new IWER.XRDevice(IWER.metaQuest3); d.installRuntime({ forceInstall: true }); window.__xr = d; });
  await page.goto(`http://localhost:${srv.address().port}/index.html?fast&chapter=${n}${extra}`);
  await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 20000 });
  await page.click('#vrBtn');
  await page.waitForFunction(() => window.G?.mode === 'vr' && G.director.running, null, { timeout: 15000 });
  await page.evaluate(() => G.narration.ready.then(() => { G.narration.files = {}; G.narration.speed = 1.4; }));   // subtitles on game time, so shots match the words
  await page.evaluate(() => { window.__said = []; G.events.on('say', ({ id }) => __said.push(id)); window.__ended = false; G.events.on('chapterEnd', () => { window.__ended = true; }); });
  let seen = 0; const t0 = Date.now();
  while (Date.now() - t0 < 900000) {
    const st = await page.evaluate(() => ({ said: __said.slice(), ended: __ended }));
    if (st.ended) break;
    if (st.said.length > seen) {
      const id = st.said[seen]; seen++;
      // let game time run: wait for ~1.5 s and ~5 s of game time into the line
      const g0 = await page.evaluate(() => G.t);
      await page.waitForFunction((g) => G.t > g + 1.2, g0, { timeout: 60000 }).catch(() => {});
      await page.screenshot({ path: path.join(out, `${id}_a.jpg`), quality: 60, type: 'jpeg' });
      await page.waitForFunction((id) => G.narration.cur?.id !== id || G.narration.progress() > 0.65, id, { timeout: 120000 }).catch(() => {});
      await page.screenshot({ path: path.join(out, `${id}_b.jpg`), quality: 60, type: 'jpeg' });
      console.log('shot', id);
      await page.evaluate((id) => { if (G.narration.cur?.id === id) G.narration.skip(); }, id);
    }
    await page.waitForTimeout(200);
  }
  await browser.close(); srv.close();
})();
