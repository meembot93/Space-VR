// Out in space: the whole Earth as a ball, its thin blue air, the Moon, and the stars all around.
// Used for Chapter 5's look at the whole planet and for the Era 1 finale. While it's showing, the
// chapter's own place is hidden and the sky is held at deep night.
//   const sp = new Space(G); sp.enter(chapterRoot); ... sp.exit();
// Earth map: data/earth.jpg (tools/sky/build_earth.py, from public-domain Natural Earth coastlines).
import * as THREE from 'three';
import { skyLevel, D2R } from './fx.js';

const DATA = new URL('../../data/', import.meta.url).href;
let earthTex = null;
function loadEarth() {
  if (!earthTex) { earthTex = new THREE.TextureLoader().load(DATA + 'earth.jpg'); earthTex.colorSpace = THREE.SRGBColorSpace; earthTex.anisotropy = 4; }
  return earthTex;
}

// A point on the Earth (latitude, longitude in degrees) on a unit ball, matching SphereGeometry's map
export function lonLat(lat, lon, out = new THREE.Vector3()) {
  const phi = (90 - lat) * D2R, th = (lon + 180) * D2R;
  return out.set(-Math.cos(th) * Math.sin(phi), Math.cos(phi), Math.sin(th) * Math.sin(phi));
}

const ATMO_VS = `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const ATMO_FS = `uniform vec3 sun; uniform float opacity; varying vec3 vN; varying vec3 vV;
  void main(){ float rim = 1.0 - abs(dot(vN, vV)); float lit = smoothstep(-0.25, 0.4, dot(vN, sun));
    vec3 c = mix(vec3(0.25, 0.5, 1.0), vec3(0.6, 0.8, 1.0), rim) * lit;
    gl_FragColor = vec4(c * pow(rim, 2.2) * 1.6 * opacity, 1.0); }`;

export class Space {
  constructor(G, { earthR = 16 } = {}) {
    this.G = G; this.R = earthR;
    this.group = new THREE.Group(); this.group.visible = false; G.scene.add(this.group);
    this.sunDir = new THREE.Vector3(-1, 0.3, 0.2).normalize();
    // the Earth, turned by this.spin (a group so chapters can turn it to show a place)
    this.earth = new THREE.Group(); this.group.add(this.earth);
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(earthR, 64, 48), new THREE.MeshStandardMaterial({ map: loadEarth(), roughness: 0.85, metalness: 0, fog: false }));
    this.earth.add(this.ball);
    this.atmoU = { sun: { value: this.sunDir }, opacity: { value: 1 } };
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(earthR * 1.035, 48, 32), new THREE.ShaderMaterial({
      uniforms: this.atmoU, vertexShader: ATMO_VS, fragmentShader: ATMO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false }));
    this.atmo2 = new THREE.Mesh(this.atmo.geometry, this.atmo.material.clone()); this.atmo2.material.side = THREE.FrontSide; this.atmo2.material.uniforms = this.atmoU;
    this.earth.add(this.atmo, this.atmo2);
    // the Moon: grey, cratered, lit by the same Sun
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(earthR * 0.27, 40, 28), new THREE.MeshStandardMaterial({ map: moonTex(), roughness: 1, fog: false }));
    this.moon.visible = false; this.group.add(this.moon);
    // sunlight, and a little fill so the night side isn't pure black
    this.sun = new THREE.DirectionalLight(0xfff4e0, 3.2); this.group.add(this.sun, this.sun.target);
    this.fill = new THREE.AmbientLight(0x223355, 0.35); this.group.add(this.fill);
    this.on = false;
  }

  // Show space around you. `hide`: the chapter's own scene (its root group), hidden until exit()
  enter(hide) {
    this.hidden = hide || null; if (hide) { this.wasVisible = hide.visible; hide.visible = false; }
    this.group.visible = true; this.on = true;
    this.G.sky.mist = 0;
  }
  exit() {
    if (this.hidden) this.hidden.visible = this.wasVisible ?? true;
    this.hidden = null; this.group.visible = false; this.on = false;
    this.G.sky.uni.milky.value = 1;
  }

  // Every frame while it's showing (after the chapter's own update, so the night sky wins)
  update(dt) {
    if (!this.on) return;
    const G = this.G;
    G.sky.set(G.sky.sunAz, -40); skyLevel(G, 1, 1.6);
    G.sky.hideMoon();
    G.sky.sunLight.intensity = 0; G.sky.hemi.intensity = 0.05;
    this.sun.position.copy(this.earth.getWorldPosition(new THREE.Vector3())).addScaledVector(this.sunDir, 100);
    this.sun.target.position.copy(this.earth.position);
  }

  dispose() { this.exit(); this.G.scene.remove(this.group); }
}

function moonTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#9a9a98'; g.fillRect(0, 0, 512, 256);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // dark "seas" and lots of craters
  g.fillStyle = 'rgba(70,72,78,0.55)';
  for (const [x, y, w] of [[120, 90, 60], [170, 120, 45], [210, 80, 40], [90, 140, 35], [330, 110, 50], [380, 150, 30]]) { g.beginPath(); g.ellipse(x, y, w, w * 0.7, r(), 0, 7); g.fill(); }
  for (let i = 0; i < 220; i++) {
    const x = r() * 512, y = 20 + r() * 216, rad = 1 + r() ** 3 * 14;
    g.fillStyle = 'rgba(60,60,64,0.35)'; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
    g.strokeStyle = 'rgba(210,210,205,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x - rad * 0.15, y - rad * 0.15, rad, 3.6, 5.6); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
