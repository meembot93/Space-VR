// Loads Meem's Tripo-made models (GLB files in models/). models/index.json lists which ones
// exist, e.g. { "star_guide": { "file": "star_guide.glb", "height": 0.3 } }. Anything not
// listed gets the placeholder stand-in built in code, so nothing breaks before a model arrives.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const DIR = new URL('../models/', import.meta.url).href; // works from any page (game or tools)
let list = null;
const loader = new GLTFLoader();
const cache = new Map();

export function modelList() {
  if (!list) list = fetch(DIR + 'index.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return list;
}

// Resolves with { scene, animations, info } for a listed model, or null if there isn't one yet.
// Each call returns a fresh copy (meshes and materials are shared, so copies are cheap).
// far: the light copy for big crowds (info.far). pick: a number that chooses one of the model's
// recoloured copies (info.variants), so a room of engineers or a crowd isn't full of twins.
export async function loadModel(name, { sd = false, far = false, pick = null } = {}) {   // sd: skip the HD version (big crowds)
  const list = await modelList();
  let info = list[name];
  if (!info) return null;
  if (pick !== null && info.variants?.length) { const all = [name, ...info.variants]; info = list[all[Math.abs(pick) % all.length]] || info; }
  // High graphics (js/graphics.js) uses the full-texture version when there is one (info.hd)
  const file = (far && info.far) || (!sd && globalThis.G?.gfx?.hd && info.hd) || info.file;
  if (!cache.has(file)) cache.set(file, loader.loadAsync(DIR + file).catch((e) => { console.warn('Model failed', name, e); return null; }));
  const gltf = await cache.get(file);
  if (!gltf) return null;
  const scene = cloneSkinned(gltf.scene); // keeps each copy's skeleton its own
  // Size it: stand on the ground (y = 0) and be `height` metres tall, centred on x/z
  if (info.height) {
    const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3());
    const k = info.height / Math.max(1e-3, size.y);
    scene.scale.multiplyScalar(k);
    const b2 = new THREE.Box3().setFromObject(scene), c = b2.getCenter(new THREE.Vector3());
    scene.position.x -= c.x; scene.position.z -= c.z;
    scene.position.y -= info.center ? c.y : b2.min.y;
  }
  if (info.turn) scene.rotation.y = info.turn * Math.PI / 180;
  return { scene, animations: gltf.animations, info };
}

// A GLB straight from models/ by file name (e.g. 'herd/sheep.glb'), not listed in index.json, loaded once
// and shared: resolves with the GLTF itself (clone its scene before use), or null if it isn't there.
export function loadGLB(file) {
  if (!cache.has(file)) cache.set(file, loader.loadAsync(DIR + file).catch((e) => { console.warn('Model failed', file, e); return null; }));
  return cache.get(file);
}
