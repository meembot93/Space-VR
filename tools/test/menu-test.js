// The opening, the pause menu, fast forward and "pick up where you left off", in the headset emulator.
//   node menu-test.js [shotdir]     (saves a few screenshots to shotdir if given)
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const shots = process.argv[2];
let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) failures++; };
(async () => {
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const base = `http://localhost:${srv.address().port}/index.html`;
  const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, name + '.jpg'), type: 'jpeg', quality: 70 }); };
  const open = async (q) => {
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript({ path: require.resolve('iwer/build/iwer.min.js') });
    await page.addInitScript(() => { const d = new IWER.XRDevice(IWER.metaQuest3); d.installRuntime({ forceInstall: true }); window.__xr = d; });
    await page.goto(base + q);
    await page.waitForFunction(() => !document.getElementById('vrBtn').disabled && window.G?.director?.chapter, null, { timeout: 60000 });
    return { page, errors };
  };

  // 1. The opening plays before Chapter 1, spells the title, then the chapter starts
  let { page, errors } = await open('?fast&opening&chapter=1');
  await page.click('#vrBtn');
  await page.waitForFunction(() => G.opening.active, null, { timeout: 30000 });
  check(true, 'The opening starts before Chapter 1');
  await page.waitForFunction(() => G.opening.formT >= 0 && G.opening.t - G.opening.formT > 1.4, null, { timeout: 90000 });
  await shot(page, 'opening_title');
  const lit = await page.evaluate(() => G.opening.word.material.opacity);
  check(lit > 0.9, `The stars spell STARWARD (word brightness ${lit.toFixed(2)})`);
  await page.waitForFunction(() => G.director.running && !G.opening.active, null, { timeout: 60000 });
  check(await page.evaluate(() => G.director.n === 1 && G.ui.sub.parent === G.scene), 'Then Chapter 1 starts (and the subtitles are back in the world)');
  check(await page.evaluate(() => localStorage.getItem('starward.resume') === '1'), 'Your place is saved as Chapter 1');

  // 2. The pause menu: pick "Skip to the next chapter" with the thumbstick and trigger keys
  await page.waitForTimeout(1500);
  await page.evaluate(() => G.togglePause());
  await page.waitForTimeout(500);
  await shot(page, 'pause_menu');
  const items = await page.evaluate(() => G.ui.menu.map((i) => i.key));
  check(['resume', 'restart', 'next', 'ff', 'title'].every((k) => items.includes(k)), `The pause menu lists ${items.join(', ')}`);
  await page.evaluate(() => { const i = G.ui.menu.findIndex((x) => x.key === 'next'); for (let k = 0; k < i; k++) G.ui.menuMove(1); G.ui.menuChoose(); });
  await page.waitForFunction(() => G.director.n === 2 && G.director.running && !G.paused, null, { timeout: 90000 });
  check(true, 'Skip to the next chapter: Chapter 2 starts');
  check(await page.evaluate(() => localStorage.getItem('starward.resume') === '2'), 'Your place is saved as Chapter 2');

  // 3. Fast forward: narration lines go by much faster
  await page.evaluate(() => { window.__lines = 0; G.events.on('narrating', (d) => { if (d.on) __lines++; }); G.narration.speed = 1; });
  await page.evaluate(() => G.togglePause()); await page.waitForTimeout(300);
  await page.evaluate(() => { const i = G.ui.menu.findIndex((x) => x.key === 'ff'); for (let k = 0; k < i; k++) G.ui.menuMove(1); G.ui.menuChoose(); });
  check(await page.evaluate(() => G.ff && !G.paused), 'Fast forward turns on and the story carries on');
  const r0 = Date.now();
  const ok3 = await page.waitForFunction(() => __lines >= 4, null, { timeout: 120000 }).then(() => true, () => false);
  check(ok3, `Fast forward: 4 lines go by in ${Math.round((Date.now() - r0) / 1000)} s (each one cut short)`);

  // 4. Back to the title page keeps your place
  await page.evaluate(() => G.togglePause()); await page.waitForTimeout(300);
  check(await page.evaluate(() => G.ui.menu.find((x) => x.key === 'ff').label.includes('ON')), 'The menu shows fast forward is on');
  await page.evaluate(() => { const i = G.ui.menu.findIndex((x) => x.key === 'title'); for (let k = 0; k < i; k++) G.ui.menuMove(1); G.ui.menuChoose(); });
  await page.waitForFunction(() => document.getElementById('overlay').style.display === 'flex' && !G.started, null, { timeout: 30000 });
  check(await page.evaluate(() => !G.ff && !G.director.running), 'Back to the title page: the story stops and fast forward is off');
  check(errors.length === 0, `No errors in the page${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
  await page.close();

  // 5. Finish a chapter, reopen: Chapter 1 has a tick and the title page picks the next one
  ({ page, errors } = await open('?fast'));
  await page.evaluate(() => { localStorage.setItem('starward.done', '1'); localStorage.setItem('starward.resume', '2'); });
  await page.close();
  ({ page, errors } = await open('?fast'));
  const t = await page.evaluate(() => ({ pick: document.querySelector('#chapters button.on')?.dataset.n, ticks: [...document.querySelectorAll('#chapters .tick')].map((x) => x.parentElement.dataset.n), card: document.getElementById('endCard').textContent, over: document.querySelector('.startOver').style.display }));
  await shot(page, 'title_page');
  check(t.pick === '2' && t.ticks.join() === '1', `Title page: Chapter 2 picked, tick on Chapter 1 (picked ${t.pick}, ticks ${t.ticks})`);
  check(/Welcome back/.test(t.card) && t.over === 'block', `It says "${t.card}" and offers Start from the beginning`);
  await page.close();

  await browser.close(); srv.close();
  console.log(failures ? `${failures} check(s) failed` : 'All checks passed');
  process.exit(failures ? 1 : 0);
})();
