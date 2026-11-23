// Graphics quality: "standard" (the original look, safe on Quest 2) or "high" (Quest 3, Quest Pro
// and PCs). Picked on the title screen; the default comes from the headset's name.
//
// High turns on, without any chapter having to know about it:
//  - a sharper picture (more pixels per eye) and less blur at the edges of the view (foveation)
//  - real shadows: from the Sun or Moon (whichever chapter light is brightest, centred on you), and
//    from big fires (the campfire, the temple fire) for people and stones
//  - crisper textures seen at an angle (anisotropic filtering), and Meem's characters with their
//    full 2048-pixel Tripo textures (models/hd/, see models.js)
//  - more Milky Way star dust (a bigger triangle budget for the sky, see sky.js budget())
// If frames start running late in the headset, it steps back on its own: first the edge blur
// comes back, then shadows get coarser, then they switch off. (The star dust thins itself too.)
//
// URL overrides for testing: ?gfx=standard|high, ?sharp=1.6 (pixels per eye).
import * as THREE from 'three';

export const LEVELS = {
  standard: { scale: 1.2, foveation: 1, shadows: false, shadowMap: 0, aniso: 0, skyTris: 520000, hd: false },
  high: { scale: 1.4, foveation: 0.4, shadows: true, shadowMap: 2048, aniso: 16, skyTris: 900000, hd: true },
};

// Quest 3 / 3S / Pro have the newer, faster chip; any other Quest (or a phone) gets Standard.
export function detectLevel(ua = navigator.userAgent) {
  if (/Quest 3|Quest Pro/i.test(ua)) return 'high';
  if (/Quest|OculusBrowser|Android|iPhone|iPad/i.test(ua)) return 'standard';
  return 'high'; // a PC
}

const FIRE_TRIS = 150000; // ...if there's not too much around them (a fire's shadow draws its whole surroundings 6 times)
const SHADOW_R = 30;      // the Sun's shadows cover a 60 m square around you
const FIRE_MIN = 8;       // point lights this bright (and reaching 20 m+) are "big fires" that cast shadows
const ORIGIN = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _m = new THREE.Matrix4(), _mi = new THREE.Matrix4();

export class Graphics {
  constructor(G) {
    this.G = G;
    this.renderer = G.renderer;
    this.level = 'standard';
    this.p = LEVELS.standard;
    this.step = 0;         // how far it has stepped back because frames ran late (0 = not at all)
    this.dirLights = [];   // chapter Sun/Moon lights found in the scene
    this.sweepT = 0;
    this.seenTex = new WeakSet();
    this.lateT = 0; this.okT = 0; this.lastNow = 0;
    // The one light that casts the Sun's (or Moon's) shadow. Each frame it borrows the direction,
    // colour and brightness of the brightest chapter light, which is dimmed to 0 just for that
    // frame's drawing, so the scene is lit exactly as the chapter set it up.
    const L = this.shadowLight = new THREE.DirectionalLight(0xffffff, 0);
    L.name = 'gfx-shadow-sun';
    L.shadow.camera.left = L.shadow.camera.bottom = -SHADOW_R;
    L.shadow.camera.right = L.shadow.camera.top = SHADOW_R;
    L.shadow.camera.near = 1; L.shadow.camera.far = 260;
    L.shadow.bias = -0.0004; L.shadow.normalBias = 0.04;
    L.shadow.intensity = 0.72;  // keep a little light in the shadows: stylized, not pitch black
    this.borrowed = null; this.borrowedI = 0;
  }

  get hd() { return this.p.hd; }
  get high() { return this.level === 'high'; }

  // Pick a level. The sharpness only changes when VR is not running (the browser fixes it then).
  set(level) {
    this.level = LEVELS[level] ? level : 'standard';
    this.p = LEVELS[this.level];
    this.step = 0;
    const R = this.renderer, P = this.G.params;
    if (!R.xr.isPresenting) R.xr.setFramebufferScaleFactor(Number(P.get('sharp')) || this.p.scale);
    R.xr.setFoveation(this.p.foveation);
    const wasOn = R.shadowMap.enabled;
    R.shadowMap.enabled = this.p.shadows;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    this.shadowLight.castShadow = this.p.shadows;
    this.setMapSize(this.p.shadowMap || 512);
    if (this.p.shadows && !this.shadowLight.parent) this.G.scene.add(this.shadowLight, this.shadowLight.target);
    if (!this.p.shadows && this.shadowLight.parent) this.shadowLight.removeFromParent(), this.shadowLight.target.removeFromParent();
    if (wasOn !== this.p.shadows) this.G.scene.traverse((o) => { for (const m of mats(o)) m.needsUpdate = true; });
    if (this.G.sky) this.G.sky.maxTris = this.p.skyTris;
    this.sweepT = 0;
  }

  setMapSize(n) {
    const s = this.shadowLight.shadow;
    if (s.mapSize.x === n) return;
    s.mapSize.set(n, n);
    if (s.map) { s.map.dispose(); s.map = null; }
  }

  // Once a second: make the scene's meshes cast and catch shadows, sharpen new textures, and
  // find the chapter's Sun/Moon lights and big fires. Cheap, and it picks up whatever a chapter,
  // a wow moment or a late-loading model has added since.
  sweep(scene) {
    const p = this.p, sky = this.G.sky?.group, dl = this.dirLights; dl.length = 0;
    const aniso = p.aniso ? Math.min(p.aniso, this.renderer.capabilities.getMaxAnisotropy()) : 0;
    const fires = [];
    scene.updateMatrixWorld();
    scene.traverse((o) => {
      if (!o.isPointLight) return;
      if (p.shadows && this.step < 3 && !o.userData.gfxSeen) {
        o.userData.gfxSeen = true;
        if (o.intensity >= FIRE_MIN && o.distance >= 20 && trisNear(scene, o, sky) < FIRE_TRIS) {
          o.castShadow = true; o.shadow.mapSize.set(512, 512); o.shadow.intensity = 0.8; o.shadow.bias = -0.002; o.shadow.normalBias = 0.05;
          o.shadow.camera.near = 0.3;
        }
      }
      if (o.castShadow) fires.push(o.getWorldPosition(new THREE.Vector3()));
    });
    scene.traverse((o) => {
      if (o.isDirectionalLight && o !== this.shadowLight) { dl.push(o); return; }
      if (o.isPointLight) return;
      if (!o.isMesh) return;
      // Every mesh catches shadows (meshes that share a material must agree, or three.js keeps
      // rebuilding its shaders), but only solid lit things cast them.
      o.receiveShadow = p.shadows;
      if (o.userData.gfxCast === undefined) o.userData.gfxCast = castsShadow(o, sky) && !inFire(o, fires);
      o.castShadow = p.shadows && o.userData.gfxCast;
      if (aniso) for (const m of mats(o)) for (const k of TEX_SLOTS) {
        const t = m[k];
        if (t && !this.seenTex.has(t)) { this.seenTex.add(t); if (t.anisotropy < aniso) { t.anisotropy = aniso; t.needsUpdate = true; } }
      }
    });
  }

  // Called every frame just before drawing.
  beforeRender(scene, camera, dt) {
    if (scene !== this.G.scene) return;
    if ((this.sweepT -= dt) <= 0) { this.sweepT = 1; this.sweep(scene); }
    this.watchFrames();
    if (!this.p.shadows || this.step >= 3) { this.renderer.shadowMap.autoUpdate = false; return; }
    // The brightest Sun or Moon light that's showing
    let best = null, bi = 0;
    for (const l of this.dirLights) {
      if (l.intensity <= bi || !shown(l, scene)) continue;
      best = l; bi = l.intensity;
    }
    const L = this.shadowLight;
    if (!best) { L.intensity = 0; this.renderer.shadowMap.autoUpdate = this.anyFire(scene); return; }
    best.updateWorldMatrix(true, false); best.target.updateWorldMatrix(true, false);
    const dir = _a.setFromMatrixPosition(best.matrixWorld).sub(_b.setFromMatrixPosition(best.target.matrixWorld)).normalize();
    if (dir.lengthSq() < 0.5) dir.set(0, 1, 0);
    L.color.copy(best.color); L.intensity = bi;
    this.borrowed = best; this.borrowedI = bi; best.intensity = 0;
    // Centre the shadow square a little ahead of where you're looking, and snap it to whole
    // shadow pixels so the edges don't crawl as you move.
    camera.getWorldPosition(_b); camera.getWorldDirection(_c); _c.y = 0;
    if (_c.lengthSq() > 1e-4) _b.addScaledVector(_c.normalize(), SHADOW_R * 0.45);
    _m.lookAt(dir, ORIGIN, THREE.Object3D.DEFAULT_UP);   // the same turn three.js gives the shadow camera
    _mi.copy(_m).invert();
    const texel = (SHADOW_R * 2) / L.shadow.mapSize.x;
    _b.applyMatrix4(_mi); _b.x = Math.round(_b.x / texel) * texel; _b.y = Math.round(_b.y / texel) * texel; _b.applyMatrix4(_m);
    L.target.position.copy(_b); L.position.copy(_b).addScaledVector(dir, 120);
    L.target.updateMatrixWorld(); L.updateMatrixWorld();
    this.renderer.shadowMap.autoUpdate = true;
  }

  // Called every frame right after drawing: give the chapter its light back.
  afterRender() {
    if (this.borrowed) { if (this.borrowed.intensity === 0) this.borrowed.intensity = this.borrowedI; this.borrowed = null; }
  }

  anyFire(scene) {
    let on = false;
    scene.traverseVisible((o) => { if (o.isPointLight && o.castShadow && o.intensity > 0) on = true; });
    return on;
  }

  // In the headset, if frames keep arriving late, step back: 1 edge blur back on, 2 coarser
  // shadows, 3 no shadows. It never steps up again until the next chapter (no flicker back and forth).
  watchFrames() {
    const now = performance.now(), raw = this.lastNow ? (now - this.lastNow) / 1000 : 0; this.lastNow = now;
    if (!this.high || this.G.mode !== 'vr' || !raw || raw > 0.25 || this.G.params.has('fulldetail')) return;
    const want = 1 / (this.renderer.xr.getSession()?.frameRate || 72);
    if (raw > want * 1.5) this.lateT += raw; else this.okT += raw;
    if (this.okT + this.lateT < 3) return;
    const late = this.lateT / (this.okT + this.lateT);
    this.lateT = this.okT = 0;
    if (late < 0.12 || this.step >= 3) return;
    this.step++;
    if (this.step === 1) this.renderer.xr.setFoveation(1);
    if (this.step === 2) this.setMapSize(1024);
    if (this.step === 3) {
      this.shadowLight.intensity = 0;
      this.G.scene.traverse((o) => { if (o.isPointLight && o.castShadow) { o.castShadow = false; o.userData.gfxSeen = false; } });
    }
    console.log('@gfx stepped back to', this.step);
  }

  // A new chapter starts with the full settings again
  reset() {
    if (!this.high) return;
    this.step = 0; this.renderer.xr.setFoveation(this.p.foveation); this.setMapSize(this.p.shadowMap); this.sweepT = 0;
  }
}

const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'bumpMap', 'aoMap'];
const mats = (o) => (!o.material ? [] : Array.isArray(o.material) ? o.material : [o.material]);
function shown(o, scene) {
  for (let p = o; p; p = p.parent) { if (!p.visible) return false; if (p === scene) return true; }
  return false;
}
// Triangles of shadow-casting things within a light's reach
function trisNear(scene, light, sky) {
  const p = light.getWorldPosition(new THREE.Vector3()), c = new THREE.Vector3();
  let tris = 0;
  scene.traverseVisible((o) => {
    if (!o.isMesh || !castsShadow(o, sky)) return;
    const g = o.geometry, r = g.boundingSphere.radius * o.getWorldScale(c).x;
    if (c.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld).distanceTo(p) - r > light.distance) return;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
  });
  return tris;
}
// The fire's own logs, flames and ring of stones: if they cast, the firelight is blocked all round
function inFire(o, fires) {
  if (!fires.length) return false;
  const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
  const r = g.boundingSphere.radius * o.getWorldScale(_c).x;
  if (r > 1.5) return false;
  const c = _c.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
  return fires.some((f) => f.distanceTo(c) < 1.8);
}
function castsShadow(o, sky) {
  for (let p = o.parent; p; p = p.parent) if (p === sky) return false;
  if (o.userData.noShadow) return false;
  for (const m of mats(o)) {
    if (!(m.isMeshLambertMaterial || m.isMeshStandardMaterial || m.isMeshPhongMaterial || m.isMeshToonMaterial)) return false;
    if (m.blending === THREE.AdditiveBlending || (m.transparent && m.opacity < 0.6)) return false;
  }
  // Huge things (sea, sky-sized domes) don't need to cast
  const g = o.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  return g.boundingSphere.radius * o.getWorldScale(_c).x < 400;
}
