// Pictures of models in the game's renderer (tools/blender/view.html), for checking how they look.
//   node model-shots.js <out dir> <model> [<model> ...]   model: path under models/era3 without .glb,
//   optionally with extra view.html settings after a |, e.g. "craft/saturn_s1c|&az=60&dist=200"
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(path.join(__dirname, '../..'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png' };
const [out, ...items] = process.argv.slice(2);
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
  fs.mkdirSync(out, { recursive: true });
  for (const it of items) {
    const [f, extra] = it.split('|');
    await page.goto(`http://localhost:${srv.address().port}/tools/blender/view.html?file=../../models/era3/${f}.glb&az=30&el=12&env=day${extra || ''}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(out, f.replace(/\//g, '_') + '.png') });
  }
  await browser.close(); srv.close();
})();
