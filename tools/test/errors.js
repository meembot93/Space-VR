// Load a chapter on desktop and print every console error and warning for a while: node errors.js <n> [secs]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const [n, secs = '30'] = process.argv.slice(2);
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type().toUpperCase(), m.text().slice(0, 400)); });
  await page.goto(`http://localhost:${srv.address().port}/index.html?fast&autostart&chapter=${n}${process.env.Q || ""}`);
  const t0 = Date.now();
  while (Date.now() - t0 < Number(secs) * 1000) {
    await page.waitForTimeout(5000);
    const st = await page.evaluate(() => ({ running: G.director?.running, n: G.director?.n, scene: G.director?.chapter?.cur, line: G.narration?.cur?.id, t: Math.round(G.t) })).catch((e) => e.message);
    console.log('state', JSON.stringify(st));
  }
  await browser.close(); srv.close();
})();
