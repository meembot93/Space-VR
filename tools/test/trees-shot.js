// Screenshot the tree preview page (tools/trees.html): node trees-shot.js <out.png> [query] [width] [height]
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(path.join(__dirname, '../..'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
const [out, q = '', w = '1600', h = '1000'] = process.argv.slice(2);
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await page.goto(`http://localhost:${srv.address().port}/tools/trees.html?${q}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out });
  if (errors.length) console.log(errors.join('\n'));
  await browser.close(); srv.close();
})();
