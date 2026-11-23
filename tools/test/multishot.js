// Many screenshots in one run: node multishot.js <chapter> <shots.json> <outdir>
// shots.json: [{ name, line, secs, cam:[x,y,z] (eye, world), look:[x,y,z], fov, pre:'js', eval:'js' }], in story order.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '../..'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const [n, list, outDir] = process.argv.slice(2);
const shots = JSON.parse(fs.readFileSync(list, 'utf8'));
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('@')) console.log(m.text()); });
  await page.goto(`http://localhost:${srv.address().port}/index.html?fast&autostart&rating=kids&chapter=${n}${process.env.Q || ''}`);
  await page.waitForFunction(() => window.G?.director?.running, null, { timeout: 600000 });
  await page.evaluate(() => { window.__seen = {}; if (G.narration.cur) window.__seen[G.narration.cur.id] = G.t; G.events.on('narrating', (d) => { if (d.on) window.__seen[d.id] = G.t; }); });
  for (const s of shots) {
    await page.evaluate((line) => { clearInterval(window.__skip); window.__skip = setInterval(() => { if (!(line in window.__seen)) G.narration.skip(); }, 150); }, s.line);
    await page.waitForFunction((line) => line in window.__seen, s.line, { timeout: 600000, polling: 100 }).catch(async (e) => {
      console.log('STUCK', await page.evaluate(() => JSON.stringify({ t: G.t, cur: G.narration.cur?.id, seen: window.__seen, ch: !!G.director.chapter, phase: G.director.chapter?.s?.phase, running: G.director.running })));
      throw e;
    });
    await page.waitForFunction(([line, secs]) => G.t - window.__seen[line] > secs, [s.line, s.secs || 0], { timeout: 300000, polling: 100 });
    if (s.pre) await page.evaluate((e) => eval(e), s.pre);
    const info = await page.evaluate(([cam, look, fov]) => {
      G.paused = true; G.narration.pause(true);
      const P = G.player, C = G.camera;
      if (cam) { P.dolly.position.set(cam[0], cam[1] - C.position.y, cam[2]); P.dolly.rotation.set(0, 0, 0); }
      P.dolly.updateMatrixWorld(true);
      const c = C.getWorldPosition(new C.position.constructor());
      const d = new C.position.constructor(...look).sub(c).normalize();
      P.yaw = Math.atan2(-d.x, -d.z) - P.dolly.rotation.y; P.pitch = Math.asin(d.y);
      C.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); C.fov = fov || 70; C.updateProjectionMatrix();
      return { t: +G.t.toFixed(1), tris: G.sky?.sceneTris };
    }, [s.cam, s.look, s.fov]);
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, s.name + '.png'), timeout: 300000 });
    console.log(s.name, JSON.stringify(info));
    if (s.eval) console.log('  ', await page.evaluate((e) => eval(e), s.eval));
    await page.evaluate(() => { G.paused = false; G.narration.pause(false); });
  }
  await browser.close(); srv.close();
})();
