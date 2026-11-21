// Screenshot a moment of a chapter on desktop: node shot.js <chapter> <line id> <secs after it starts> <az> <el> <out.png> [fov] [extra query]
// Lines before <line id> are skipped. Used to check the wow moments and sky figures.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '../..'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const [n, line, secs, az, el, out, fov = '75', q = ''] = process.argv.slice(2);
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  const small = process.env.SMALL ? { width: 400, height: 256 } : null;
  if (small) await page.setViewportSize(small);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('@')) errors.push(m.text()); });
  await page.goto(`http://localhost:${srv.address().port}/index.html?fast&autostart&rating=kids&chapter=${n}${q}`);
  await page.waitForFunction(() => window.G?.director?.running, null, { timeout: 30000 });
  if (process.env.SLOW) await page.evaluate(() => { window.__slow = 1; });
  await page.evaluate((line) => {
    window.__at = -1;
    G.events.on('narrating', (d) => { if (d.on && d.id === line) { window.__at = G.t; if (window.__slow) G.params.delete('fast'); } });
    window.__skip = setInterval(() => { if (window.__at < 0) G.narration.skip(); }, 150);
  }, line);
  await page.waitForFunction(() => window.__at >= 0, null, { timeout: 300000, polling: 100 });
  await page.waitForFunction((s) => G.t - window.__at > s, Number(secs), { timeout: 600000, polling: 100 });
  await page.evaluate(([az, el, fov]) => {
    const D = Math.PI / 180, P = G.player;
    P.yaw = -az * D - P.dolly.rotation.y; P.pitch = el * D; G.camera.fov = fov; G.camera.updateProjectionMatrix();
    G.paused = true; G.narration.pause(true);
  }, [Number(az), Number(el), Number(fov)]);
  if (small) await page.setViewportSize({ width: 1000, height: 640 });
  await page.waitForTimeout(600);
  console.log(await page.evaluate(() => JSON.stringify({ mod: G.extras.mod?.constructor.name, go: G.extras.mod?.go, burst: G.extras.mod?.burst, figT: G.extras.mod?.figT, t: G.t, started: G.extras.started })));
  console.log(await page.evaluate(() => ['hunter', 'bull', 'doves'].map((f) => `${f} h=${G.skyFigures.height(f).toFixed(0)} az=${G.skyFigures.bearing(f).toFixed(0)} on=${G.skyFigures.playing(f)}`).join(' | ') + ` stars=${G.sky.starField.opacity.toFixed(2)}`));
  await page.screenshot({ path: out });
  if (errors.length) console.log(errors.join('\n'));
  await browser.close(); srv.close();
})();
