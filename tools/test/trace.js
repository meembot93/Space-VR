// node trace.js <chapter> <secs> [query]  — play a chapter hands-free, print each narration line and the phase as it goes
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const [n, secs = 300, q = ''] = process.argv.slice(2);
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${srv.address().port}/index.html?fast&autostart&chapter=${n}${q}`);
  await page.waitForFunction(() => window.G?.director?.running, null, { timeout: 30000 });
  await page.evaluate(() => { window.__log = []; G.events.on('narrating', ({ id, on }) => { if (on) __log.push(id + '@' + G.t.toFixed(1)); }); G.events.on('chapterEnd', () => __log.push('END@' + G.t.toFixed(1))); setInterval(() => G.narration.skip(), 200); });
  const t0 = Date.now(); let seen = 0;
  while ((Date.now() - t0) / 1000 < secs) {
    await page.waitForTimeout(5000);
    const r = await page.evaluate(() => ({ log: __log, phase: G.director.chapter?.s?.phase, t: G.t.toFixed(1), fps: G.renderer?.info?.render?.calls }));
    if (r.log.length > seen) { console.log(r.log.slice(seen).join(' ')); seen = r.log.length; }
    else console.log(`  ...t=${r.t} phase=${r.phase}`);
    if (r.log.some((l) => l.startsWith('END'))) break;
  }
  await browser.close(); srv.close(); process.exit(0);
})();
