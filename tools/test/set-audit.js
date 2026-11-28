// Set audit: load a chapter (desktop mode), stop the story a few seconds in, and take a ring of
// pictures from where you stand (4 directions + looking down) to judge sets and ground.
//   node set-audit.js <n> <out dir>
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const [n, out] = process.argv.slice(2);
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(`http://localhost:${srv.address().port}/index.html?autostart&chapter=${n}${process.env.Q || ''}`);
  await page.waitForFunction(() => window.G?.director?.running, null, { timeout: 180000 });
  await page.waitForTimeout(Number(process.env.SETTLE || 6000));
  const info = await page.evaluate(() => { G.director.stop(); G.narration.stop(); G.ui.subtitle?.(''); G.ui.fadeIn?.(0.01);
    const p = G.player; return { yaw: p.yaw ?? 0, x: p.rig?.position.x ?? 0, z: p.rig?.position.z ?? 0, tris: G.renderer?.info?.render?.triangles }; });
  fs.mkdirSync(out, { recursive: true });
  const shots = [[0, 0], [90, 0], [180, 0], [270, 0], [0, -35]];
  for (const [dy, pitch] of shots) {
    await page.evaluate(([y, p]) => { G.player.yaw = y; G.player.pitch = p; G.ui.fadeIn?.(0.01); }, [info.yaw + dy * Math.PI / 180, pitch * Math.PI / 180]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, `ch${n}_${dy}${pitch ? 'd' : ''}.jpg`), type: 'jpeg', quality: 70 });
  }
  const tris = await page.evaluate(() => G.renderer?.info?.render?.triangles);
  console.log('done', n, JSON.stringify(info), 'tris', tris);
  await browser.close(); srv.close();
})();
