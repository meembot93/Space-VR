// Screenshot the star-bridge dioramas (js/dioramas.js): flies to each chapter's star and pauses
// while its diorama is shown.   node dioramas.js <out dir> [n ...] [--view]
// Saves <out dir>/dio_<n>.png (a close look) and, with --view, dio_<n>_view.png (what you see in the headset).
// Prints each diorama's triangle count. Fails on page errors.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const args = process.argv.slice(2), view = args.includes('--view');
const out = args.find((a) => !a.startsWith('--') && isNaN(Number(a))) || '.';
const list = args.filter((a) => !isNaN(Number(a)) && a !== '').map(Number);
const NS = list.length ? list : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => { if (!/Pointer Lock/.test(e.message)) errors.push(e.message); });
  page.on('console', (m) => { if (m.type() === 'error' && !/Pointer Lock/.test(m.text())) errors.push(m.text()); });
  await page.goto(`http://localhost:${srv.address().port}/index.html?autostart&rating=kids&chapter=1`);
  await page.waitForFunction(() => window.G?.director?.running, null, { timeout: 60000 });
  await page.evaluate(() => { G.director.stop(); G.narration.stop(); });
  for (const n of NS) {
    const r = await page.evaluate(async (n) => {
      const F = G.flight, P = G.player;
      P.pitch = -0.2; P.yaw = 0; G.camera.fov = 75; G.camera.updateProjectionMatrix();
      await new Promise((ok) => requestAnimationFrame(ok));
      F.play(Math.max(1, n - 1), n);
      F.t = F.secs * 0.8 + 2.2; F.freeze = true;
      await new Promise((ok) => setTimeout(ok, 400));
      return { tris: F.dioTris, label: F.dioLabel?.material.map.image.width ? 'yes' : 'no' };
    }, n);
    console.log(`diorama ${n}: ${r.tris} triangles, label ${r.label}`);
    if (view) await page.screenshot({ path: path.join(out, `dio_${n}_view.png`) });
    // a closer look, aimed at the model
    await page.evaluate(() => {
      const F = G.flight, p = F.dio.getWorldPosition(new F.dio.position.constructor()); p.y += 0.2;
      const c = G.camera.getWorldPosition(p.clone()), d = p.clone().sub(c).normalize(), P = G.player;
      P.yaw = Math.atan2(-d.x, -d.z) - P.dolly.rotation.y; P.pitch = Math.asin(d.y);
      G.camera.fov = 38; G.camera.updateProjectionMatrix();
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `dio_${n}.png`) });
    await page.evaluate(() => { const F = G.flight; F.freeze = false; F.t = F.secs + F.hold + 1; });
    await page.waitForTimeout(300);
  }
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close(); srv.close();
  process.exit(errors.length ? 1 : 0);
})();
