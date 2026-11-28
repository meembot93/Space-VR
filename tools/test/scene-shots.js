// Pictures of a chapter's places without playing the story (Era 3 chapters, built on js/era3/base.js):
//   node scene-shots.js <n> <out dir> "<scene> <x> <z> <yaw deg> <pitch deg> [name] [js]" ...
// Each shot: jump to the scene, stand at x, z facing yaw (compass degrees), look up/down by pitch,
// optionally run js first (e.g. "ch.s.chute=1"), wait a moment, save <out>/<n>_<name or scene>.png.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const [n, out, ...shots] = process.argv.slice(2);
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: Number(process.env.W || 900), height: Number(process.env.H || 560) } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('ERROR', m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${srv.address().port}/index.html?autostart&chapter=${n}${process.env.Q || ''}`);
  await page.waitForFunction(() => window.G?.director?.running, null, { timeout: 120000 });
  await page.evaluate(() => { G.director.stop(); G.narration.stop(); G.ui.fadeIn?.(0.01); G.ui.subtitle?.(''); });
  fs.mkdirSync(out, { recursive: true });
  for (const sh of shots) {
    const [scene, x, z, yaw, pitch, name, ...js] = sh.split(' ');
    await page.evaluate(([scene, x, z, yaw, pitch, js]) => {
      const ch = G.director.chapter; window.ch = ch;
      ch.s.scene = scene; ch.setScene(scene);
      G.events.emit('placePlayers', { x: +x, z: +z, yaw: -(+yaw) * Math.PI / 180 });
      G.player.pitch = +pitch * Math.PI / 180;
      if (js) eval(js);
      G.ui.fadeIn?.(0.01);
    }, [scene, x, z, yaw, pitch, js.join(' ')]);
    await page.waitForTimeout(Number(process.env.WAIT || 2500));
    await page.screenshot({ path: path.join(out, `${n}_${name && name !== '-' ? name : scene}.png`) });
    console.log('shot', scene, name || '');
  }
  await browser.close(); srv.close();
})();
