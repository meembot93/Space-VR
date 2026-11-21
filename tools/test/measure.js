// Graphics budget: play a chapter hands-free in the headset emulator and record the peak number of
// triangles and draw calls.   node measure.js <chapter> [more chapters...]   (ROOT=other/checkout to measure a branch)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '../..'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const n of process.argv.slice(2).map(Number)) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.addInitScript({ path: require.resolve('iwer/build/iwer.min.js') });
    await page.addInitScript(() => { const d = new IWER.XRDevice(IWER.metaQuest3); d.installRuntime({ forceInstall: true }); window.__xr = d; });
    await page.goto(`http://localhost:${srv.address().port}/index.html?fast&fulldetail&rating=kids&chapter=${n}`);
    await page.waitForFunction(() => !document.getElementById('vrBtn').disabled, null, { timeout: 20000 });
    await page.click('#vrBtn');
    await page.waitForFunction(() => window.G?.mode === 'vr' && G.director.running, null, { timeout: 15000 });
    await page.evaluate(() => {
      window.__m = { drawn: 0, calls: 0, scene: 0, ended: false };
      G.events.on('chapterEnd', () => { __m.ended = true; });
      window.__skip = setInterval(() => G.narration.skip(), 200);
      // sample after each frame: what was drawn (both eyes), and every visible triangle in the scene
      setInterval(() => {
        const i = G.renderer.info.render; __m.drawn = Math.max(__m.drawn, i.triangles); __m.calls = Math.max(__m.calls, i.calls);
        let t = 0; G.scene.traverseVisible((o) => { if (!o.isMesh || !o.geometry) return; const g = o.geometry, c = g.index ? g.index.count : g.attributes.position?.count || 0; let k = Math.min(c, g.drawRange.count) / 3; if (o.isInstancedMesh) k *= o.count; t += k; });
        __m.scene = Math.max(__m.scene, t);
      }, 700);
    });
    await page.waitForFunction(() => __m.ended, null, { timeout: 600000, polling: 500 }).catch(() => {});
    const m = await page.evaluate(() => __m);
    console.log(JSON.stringify({ n, perEye: Math.round(m.drawn / 2), calls: Math.round(m.calls / 2), scene: Math.round(m.scene), ended: m.ended }));
    await page.close();
  }
  await browser.close(); srv.close();
})();
