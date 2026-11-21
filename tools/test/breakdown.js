// Where the triangles go: play chapters hands-free and, at each one's busiest moment, split the
// triangles on show by kind.   node breakdown.js 1 2 3 ...
// Kinds: night sky (stars, star dust), characters (people, Astra), terrain and water (big ground and
// sea meshes), plants and trees (instanced grass and anything mostly green), and everything else
// (buildings, stones, props, effects). The split of the last three is a best guess from shape and colour.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '../..'));
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : p.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const n of process.argv.slice(2).map(Number)) {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    await page.goto(`http://localhost:${srv.address().port}/index.html?fast&fulldetail&rating=kids&chapter=${n}`);
    await page.evaluate(() => document.getElementById('deskBtn').click());
    await page.waitForFunction(() => window.G?.mode && G.director.running, null, { timeout: 30000 });
    await page.evaluate(() => {
      window.__best = null; window.__ended = false; G.events.on('chapterEnd', () => { __ended = true; });
      setInterval(() => G.narration.skip(), 300);
      const green = (o) => {
        const g = o.geometry, c = g.attributes.color, m = o.material;
        let r = 0, gg = 0, b = 0;
        if (o.isInstancedMesh && o.instanceColor) { const a = o.instanceColor.array; for (let i = 0; i < a.length; i += 3 * 7) { r += a[i]; gg += a[i + 1]; b += a[i + 2]; } }
        else if (c) { for (let i = 0; i < c.count; i += 7) { r += c.getX(i); gg += c.getY(i); b += c.getZ(i); } if (m?.color) { r *= m.color.r; gg *= m.color.g; b *= m.color.b; } }
        else if (m?.color) { r = m.color.r; gg = m.color.g; b = m.color.b; }
        return gg > r * 1.08 && gg > b * 1.1;
      };
      const t0 = G.t;
      const sample = () => {
        if (G.t - t0 < 6) return;   // skip the first moments, while models are still arriving
        const k = {}; let total = 0;
        G.scene.traverseVisible((o) => {
          if (!o.isMesh || !o.geometry) return;
          const g = o.geometry, idx = g.index ? g.index.count : g.attributes.position?.count || 0;
          const tris = Math.min(idx, g.drawRange.count) / 3 * (o.isInstancedMesh ? o.count : 1);
          if (!tris) return;
          let kind = null;
          for (let p = o; p && !kind; p = p.parent) { if (p === G.sky.group) kind = 'night sky'; else if (p.userData?.kind) kind = p.userData.kind; }
          if (!kind && o.isSkinnedMesh) kind = 'characters';
          if (!kind) {
            if (!g.boundingBox) g.computeBoundingBox();
            const s = g.boundingBox.getSize(new o.position.constructor()).multiply(o.getWorldScale(new o.position.constructor()));
            if (!o.isInstancedMesh && s.x > 120 && s.z > 120 && s.y < Math.max(s.x, s.z) * 0.2) kind = 'terrain and water';
            else if (o.isInstancedMesh || green(o)) kind = 'plants and trees';
            else kind = 'buildings, stones, props';
          }
          k[kind] = (k[kind] || 0) + tris; total += tris;
        });
        if (!__best || total > __best.total) __best = { total, k, phase: G.director.chapter?.s?.phase };
      };
      setInterval(sample, 1500);
    });
    await page.waitForFunction(() => __ended, null, { timeout: 900000, polling: 1000 }).catch(() => {});
    const b = await page.evaluate(() => __best);
    console.log(JSON.stringify({ n, ...b }));
    await page.close();
  }
  await browser.close(); srv.close();
})();
