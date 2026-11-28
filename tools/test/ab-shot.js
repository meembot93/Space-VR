// Before/after: the same view with real surfaces and with ?notex (the old look).
//   node ab-shot.js <n> <out prefix> "<yaw deg> <pitch deg>" ...   (yaw relative to the start view)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const [n, out, ...views] = process.argv.slice(2);
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const mode of (process.env.MODES || 'new,old').split(',')) {
    const page = await browser.newPage({ viewport: { width: Number(process.env.W || 960), height: Number(process.env.H || 540) } });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 400)); });
    await page.goto(`http://localhost:${srv.address().port}/index.html?autostart&chapter=${n}${mode === 'old' ? '&notex&noset' : ''}${process.env.Q || ''}`);
    await page.waitForFunction(() => window.G?.director?.running, null, { timeout: 180000 });
    await page.waitForTimeout(Number(process.env.SETTLE || 5000));
    const y0 = await page.evaluate(() => { G.director.stop(); G.narration.stop(); G.ui.subtitle?.(''); G.ui.fadeIn?.(0.01); if (window.__pre) eval(window.__pre); return G.player.yaw; });
    if (process.env.JS) await page.evaluate(process.env.JS);
    for (const v of views) {
      const [yaw, pitch] = v.split(' ').map(Number);
      await page.evaluate(([y, p]) => { G.player.yaw = y; G.player.pitch = p; G.ui.fadeIn?.(0.01); }, [y0 + yaw * Math.PI / 180, pitch * Math.PI / 180]);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${out}_${yaw}_${pitch}_${mode}.jpg`, type: 'jpeg', quality: 80 });
    }
    await page.close();
  }
  await browser.close(); srv.close();
})();
