// Meem's prop and building models (models/props/<name>.glb, from the model wish list), placed many
// times over as one InstancedMesh per model, so a whole street of houses costs one draw call.
//
//   const P = await loadProps(['house_mudbrick', 'amphora']);   // at the top of a chapter module
//   if (P.has('house_mudbrick')) P.add('house_mudbrick', x, y, z, yaw, { w, d, h });
//   scene.add(P.build());
//
// Every model is baked once: standing on y = 0, centred on x/z, its front (door, bow) facing +z,
// and sized in metres by SIZE below. add() then stretches it to a footprint { w, d, h } (w along
// its own x, d along z, h tall), or scales it evenly with { s } (1 = the size below).
// If a model is missing, has() is false and the chapter keeps its old code shapes.
// Houses also come as <name>_lo (about 400 triangles, 256 px texture) for whole cities seen from afar.
import * as THREE from 'three';
import { loadGLB } from './models.js';

// Real size of each model: the longest of [x, y, z] that is given, in metres. turn: degrees to turn
// it so its front faces +z (Tripo's houses already do).
const SIZE = {
  house_mudbrick: { h: 4.5 }, house_greek: { h: 4.2 }, house_north: { h: 11 }, house_italian: { h: 10 },
  house_english: { h: 6.5 }, house_log: { h: 6 },
  ship_ancient: { x: 16, turn: 90 }, boat_small: { z: 5 },
  amphora: { h: 0.9 }, barrel: { h: 0.95 }, crate_basket_set: { x: 1.6 }, oil_lamp: { x: 0.16 },
  lantern: { h: 0.32 }, table_stool: { x: 1.5 }, book_set: { x: 0.36 },
  // (the rest of the wish list: a first guess each; a chapter can pass its own to loadProps)
  ship_carrack: { x: 30 },
  hide_tent: { h: 3 }, fire_pit: { x: 1.4 }, sitting_log: { x: 2 }, drying_rack: { h: 1.8 }, mammoth_tusks: { x: 3 },
  sarsen_stone: { h: 5.5 }, sarsen_lintel: { x: 3.2 }, bluestone: { h: 2 }, roundhouse: { h: 6 }, stone_sledge: { x: 4 },
  sphinx: { x: 73 }, reed_boat: { x: 5 }, granary: { h: 4 }, temple_pylon: { h: 18 }, bell_frame: { h: 1.6 },
  tablet_shelf: { h: 2 }, clay_tablet: { x: 0.12 }, reading_desk: { x: 1.4 }, brazier: { h: 0.8 }, babylon_gate: { h: 23 },
  lampstand: { h: 1.5 }, greek_statue: { h: 2.6 }, fire_tripod: { h: 1.2 }, well_syene: { x: 2.2 }, chinese_pavilion: { x: 20 }, inkstone_set: { x: 0.6 },
  sponge_boat: { x: 10 }, air_pump: { h: 1.2 }, bronze_statue: { x: 2 }, wreck_timbers: { x: 14 },
  scroll_cabinet: { h: 2.6 }, bronze_door: { h: 4 }, egyptian_column: { h: 7 },
  frombork_cathedral: { x: 90 }, copernicus_desk: { h: 2.6 }, triquetrum: { h: 2 }, handcart: { x: 2.5 },
  uraniborg: { h: 25 }, mural_quadrant: { h: 2.5 }, herrevad_abbey: { x: 40 }, wood_fence: { x: 3 },
  tiled_stove: { h: 2.2 }, bookcase: { h: 2.2 }, globe_stand: { h: 1.2 }, writing_desk_chair: { x: 1.6 }, tyn_church: { h: 80 }, market_stall: { h: 2.6 },
  galileo_telescope: { h: 1.6 }, church_bell: { h: 1.2 }, gondola: { x: 11 }, st_marks: { x: 76 }, lens_workbench: { x: 2 },
  woolsthorpe_manor: { h: 9 }, stone_barn: { h: 7 }, dovecote: { h: 8 }, hay_cart: { x: 4.5 }, beehive_skeps: { x: 1.5 },
  field_gate: { x: 3.5 }, cannon: { x: 3 }, apple_ladder: { h: 3 },
  goddard_rocket: { h: 3.5 }, farmhouse_clapboard: { h: 9 }, red_barn_silo: { h: 14 }, model_t: { x: 3.4 }, samovar: { h: 0.5 },
  chalkboard: { h: 1.8 }, bicycle_1900: { x: 1.8 }, film_camera_tripod: { h: 1.7 }, ww2_truck: { x: 7 },
  soviet_truck: { x: 7 }, radio_receiver: { h: 1.9 }, family_radio: { h: 0.45 }, apartment_block: { h: 15 },
};

const cache = new Map();
function bake(name, own) {
  const key = own ? name + JSON.stringify(own) : name;
  if (!cache.has(key)) cache.set(key, loadGLB('props/' + name + '.glb').then((gltf) => {
    if (!gltf) return null;
    gltf.scene.updateMatrixWorld(true);
    let src = null; gltf.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
    if (!src) return null;
    const g = src.geometry.clone(); g.applyMatrix4(src.matrixWorld);
    const sz = own || SIZE[name.replace(/_lo$/, '')] || { h: 1 };   // name_lo: the same model, simplified for far away
    if (sz.turn) g.rotateY(sz.turn * Math.PI / 180);
    g.computeBoundingBox(); let b = g.boundingBox; const c = b.getCenter(new THREE.Vector3());
    g.translate(-c.x, -b.min.y, -c.z);
    const s0 = b.getSize(new THREE.Vector3());
    const k = sz.h ? sz.h / s0.y : sz.x ? sz.x / s0.x : sz.z / s0.z;
    g.scale(k, k, k); g.computeBoundingBox();
    const m = src.material.clone();
    m.metalness = name === 'lantern' ? 0.4 : 0; m.roughness = Math.max(0.75, m.roughness ?? 1); m.metalnessMap = null;
    return { geometry: g, material: m, size: g.boundingBox.getSize(new THREE.Vector3()) };
  }));
  return cache.get(key);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// sizes (optional): this chapter's own { h | x | z, turn } for any of the names, in place of SIZE
export async function loadProps(names, sizes = {}) {
  const got = {};
  await Promise.all(names.map(async (n) => { got[n] = await bake(n, sizes[n]); }));
  return new PropSet(got);
}

export class PropSet {
  constructor(models) { this.models = models; this.items = {}; }
  has(name) { return !!this.models[name]; }
  // A new, empty set using the same models (for another place in the same chapter)
  fresh() { return new PropSet(this.models); }
  size(name) { return this.models[name]?.size; }
  // { w, d, h } stretches it to that footprint (any left out follow the others); { s } scales it evenly
  add(name, x, y, z, yaw = 0, o = {}) {
    const M = this.models[name]; if (!M) return false;
    const S = M.size;
    let sx, sy, sz;
    if (o.w || o.d || o.h) {
      sx = o.w ? o.w / S.x : null; sz = o.d ? o.d / S.z : null; sy = o.h ? o.h / S.y : null;
      const any = sx ?? sz ?? sy; sx ??= sz ?? any; sz ??= sx; sy ??= (sx + sz) / 2;
    } else sx = sy = sz = o.s ?? 1;
    _q.setFromAxisAngle(_up, yaw);
    if (o.tilt) _q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(o.tilt[0], 0, o.tilt[1])));
    (this.items[name] ||= []).push(_m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)).clone());
    return true;
  }
  count(name) { return this.items[name]?.length || 0; }
  // One InstancedMesh per model used, in a group. glow: a colour of their own light (night scenes,
  // so the models don't sink into the dark next to the code-built buildings, which glow a little)
  build({ glow } = {}) {
    const g = new THREE.Group();
    for (const [name, list] of Object.entries(this.items)) {
      const M = this.models[name];
      let mat = M.material;
      if (glow) { mat = mat.clone(); mat.emissive = new THREE.Color(glow); mat.emissiveMap = mat.map; }
      const mesh = new THREE.InstancedMesh(M.geometry, mat, list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.computeBoundingSphere(); mesh.name = 'props:' + name;
      g.add(mesh);
    }
    this.items = {};
    return g;
  }
}
