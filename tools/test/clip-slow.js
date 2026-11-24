// Clipping check: plays chapters in Kids mode (hands-free, narration skipped like kids-test.js) and,
// about twice a second, checks every person against the solid set: legs through a chair, a body
// through a frame, a head inside a camera, feet sunk into or floating above the floor.
//   node clip-test.js <n ...>        (no numbers: every ready chapter)
//   OUT=problems.json node clip-test.js 13    also saves the problems as JSON
// Each problem is printed once, with the narration line it happened on, the person (model name),
// the body part, where it is, and the mesh it hit. Exits with 1 when there are problems.
// The checking itself is in clip-check.js (runs inside the page).
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(process.env.ROOT || path.join(__dirname, '../..'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const CHAPTERS = process.argv.slice(2).map(Number);
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const list = CHAPTERS.length ? CHAPTERS : [...fs.readFileSync(path.join(ROOT, 'js/chapters.js'), 'utf8').matchAll(/\{ n: (\d+),[^\n]*ready: true/g)].map((m) => Number(m[1]));
  const all = [];
  let broken = 0;
  for (const n of list) {
    const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const t0 = Date.now();
    try {
      await page.goto(`http://localhost:${srv.address().port}/index.html?fast&autostart&rating=kids&chapter=${n}`);
      await page.waitForFunction(() => window.G?.director?.running, null, { timeout: 600000 });
      await page.addScriptTag({ url: '/tools/test/clip-check.js', type: 'module' });
      await page.waitForFunction(() => window.__clip, null, { timeout: 300000 });
      await page.evaluate(() => {
        window.__ended = false; G.events.on('chapterEnd', () => { window.__ended = true; });
        window.__skip = setInterval(() => G.narration.skip(), 200);
        window.__runs = 0; window.__clipErr = null;
        window.__tick = setInterval(() => { if (window.__ended) return; try { __clip.check(); window.__runs++; } catch (e) { window.__clipErr = e.stack || String(e); } }, 500);
      });
      const ok = await page.waitForFunction(() => window.__ended || window.__clipErr, null, { timeout: 4000000, polling: 500 }).then(() => true, () => false);
      const r = await page.evaluate(() => ({ problems: __clip.problems, runs: __runs, err: __clipErr, phase: G.director.chapter?.s?.phase }));
      if (r.err) { console.log(`Chapter ${n}: the checker failed: ${r.err}`); broken++; }
      if (!ok) { console.log(`Chapter ${n}: did not reach the end (stuck at ${r.phase}); checked what played`); broken++; }
      console.log(`Chapter ${n}: ${r.problems.length} problem(s), ${r.runs} checks over ${Math.round((Date.now() - t0) / 1000)} s`);
      for (const p of r.problems) console.log(`  [${p.kind}] ${p.person} (${p.pose}, standing at ${p.at}): ${p.parts.join(', ')} at (${p.where}) -> ${p.mesh}; ${p.extra}, worst ${p.worst} cm\n      during ${p.line || 'the opening'}${p.text ? ': "' + p.text.slice(0, 90) + '"' : ''}`);
      if (errors.length) console.log(`  page errors: ${errors.slice(0, 3).join(' | ')}`);
      all.push(...r.problems);
      if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(all, null, 1));
    } catch (e) { console.log(`Chapter ${n}: test failed to run: ${e.message.split('\n')[0]}`); broken++; }
    await page.close();
  }
  await browser.close(); srv.close();
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(all, null, 1));
  console.log(all.length || broken ? `${all.length} clipping problem(s)${broken ? `, ${broken} run problem(s)` : ''}` : 'No clipping found');
  process.exit(all.length || broken ? 1 : 0);
})();
