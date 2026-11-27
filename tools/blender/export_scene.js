// Export a chapter's code-built set from the game, for a Blender pass (tools/blender/venice_set.py).
//   node tools/blender/export_scene.js <chapter> <group> <name,name,...> <out dir>
//   e.g.  node tools/blender/export_scene.js 11 A venice_ground,venice_city,venice_far tools/blender/out/venice
// Writes <name>.glb for each named mesh (colours kept), and occluders.glb: everything else that stands
// still in that group (models, facades, the tower), as bare shapes, so the baked shadows include them.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png' };
const [n, group, names, outDir] = process.argv.slice(2);
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const srv = await new Promise((ok) => { const s = http.createServer((req, res) => { const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(0, () => ok(s)); });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  page.on('pageerror', (e) => console.log('PAGEERR', e.message)); page.on('console', (m) => { if (m.text().startsWith('missing') || m.text().startsWith('@')) console.log(m.text()); });
  await page.goto(`http://localhost:${srv.address().port}/index.html?fast&autostart&noset&rating=kids&chapter=${n}`);
  await page.waitForFunction(() => window.G?.director?.chapter && G.director.running, null, { timeout: 120000 });
  await page.waitForTimeout(3000);
  const files = await page.evaluate(async ([group, names]) => {
    const THREE = await import('three');
    const { GLTFExporter } = await import('/lib/addons/exporters/GLTFExporter.js');
    const { mergeGeometries } = await import('/lib/addons/utils/BufferGeometryUtils.js');
    const A = G.director.chapter[group], want = names.split(','), out = {};
    A.updateMatrixWorld(true);
    const exp = async (obj) => { const b = await new GLTFExporter().parseAsync(obj, { binary: true }); let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    // the named meshes may not be in the scene (the chapter builds them but adds the set instead)
    const found = {};
    const scan = (o) => { if (want.includes(o.name)) found[o.name] = o; };
    A.traverse(scan);
    const ch = G.director.chapter;
    for (const nm of want) if (!found[nm]) console.log('missing', nm);
    for (const [nm, o] of Object.entries(found)) {
      const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true })); m.name = nm;
      const s = new THREE.Scene(); s.add(m); out[nm] = await exp(s);
    }
    // occluders: still, opaque meshes of the group, merged, position only
    const parts = [];
    const skip = new Set(Object.values(found));
    A.traverseVisible((o) => {
      if (!o.isMesh || o.isSkinnedMesh || skip.has(o)) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m.transparent || m.blending !== THREE.NormalBlending || !o.geometry.attributes.position) return;
      let moving = false; for (let p = o; p && p !== A; p = p.parent) if ((ch.boats || []).includes(p) || (ch.gondolas || []).includes(p)) moving = true;
      if (moving) return;
      const bs = o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere);
      if (bs.radius > 2000) return;   // the sea
      const base = new THREE.BufferGeometry(); base.setAttribute('position', o.geometry.attributes.position.clone()); if (o.geometry.index) base.setIndex(o.geometry.index.clone());
      const mats = [];
      if (o.isInstancedMesh) { const mm = new THREE.Matrix4(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mm); mats.push(mm.clone().premultiply(o.matrixWorld)); } } else mats.push(o.matrixWorld);
      for (const M of mats) { const g = base.clone(); g.applyMatrix4(M); parts.push(g.index ? g.toNonIndexed() : g); }
    });
    const merged = mergeGeometries(parts, false);
    out.occluders = await exp(new THREE.Mesh(merged, new THREE.MeshStandardMaterial()));
    return out;
  }, [group, names]);
  for (const [nm, b64] of Object.entries(files)) { fs.writeFileSync(path.join(outDir, nm + '.glb'), Buffer.from(b64, 'base64')); console.log('wrote', nm, Math.round(b64.length * 0.75 / 1024), 'KB'); }
  await browser.close(); srv.close();
})();
