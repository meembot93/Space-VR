// A friend in your world (multiplayer): a traveller figure under their head, their hands as
// floating gloves (in VR), and their name above them. Their headset sends a pose about 20 times
// a second: head and hands in world space, [x, y, z, qx, qy, qz, qw].
import * as THREE from 'three';
import { makePerson, animatePerson } from '../people.js';
import { buildGlove } from '../player.js';
import { canvasTex } from '../util.js';

export const SEAT_COLOURS = ['#e0b040', '#5a8ad8', '#6ab05a', '#c070c0'];
const TUNICS = [0x8a6a30, 0x3a5a8a, 0x4a7a3a, 0x7a3a7a];
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

function nameTag(name, colour) {
  const tex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = 'rgba(8,12,28,0.7)'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 14); g.fill();
    g.strokeStyle = colour; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#fff6dc'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, w / 2, h / 2 + 1, w - 20);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(0.5, 0.125, 1); return sp;
}

export class RemotePlayer {
  constructor(G, id, name, peer) {
    this.G = G; this.id = id; this.remote = true; this.peer = peer || null;
    this.seat = parseInt(id.split(':')[1]) || 0;
    this.name = name || `Traveller ${this.seat + 1}`;
    this.p = makePerson({ tunic: TUNICS[this.seat % 4], seed: 900 + this.seat, hair: 0x3a2a1a });
    this.gloves = [buildGlove(), buildGlove()];
    this.gloves[0].userData.thumb.position.x = 0.045;
    this.tag = nameTag(this.name, SEAT_COLOURS[this.seat % 4]);
    this.parts = [this.p.g, ...this.gloves, this.tag];
    for (const o of this.parts) G.scene.add(o);
    for (const g of this.gloves) g.visible = false;
    this.head = new THREE.Vector3(0, 1.6, 0); this.yaw = 0; this.have = false;
    this.target = null;
  }

  headPos(out) { return out.copy(this.head); }

  setPose(pk) { this.target = pk; }

  update(dt) {
    const pk = this.target; if (!pk) return;
    const k = 1 - Math.exp(-dt * 14);
    _p.fromArray(pk.h, 0);
    if (!this.have) { this.head.copy(_p); this.have = true; } else this.head.lerp(_p, k);
    _q.fromArray(pk.h, 3); _e.setFromQuaternion(_q);
    let dy = _e.y - this.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * k;
    // Body stands under the head, facing where they look
    const ground = this.G.world.height(this.head.x, this.head.z);
    this.p.g.position.set(this.head.x, ground, this.head.z);
    this.p.g.scale.setScalar(Math.max(0.55, Math.min(1.15, (this.head.y - ground + 0.1) / 1.7)));
    this.p.g.rotation.y = this.yaw + Math.PI; // figures face +Z, a head's "forward" is -Z
    animatePerson(this.p, this.G.t, dt);
    this.tag.position.set(this.head.x, this.head.y + 0.42, this.head.z);
    this.tag.material.color.setHex(this.talking ? 0xffe27a : 0xffffff);
    [pk.l, pk.r].forEach((h, i) => {
      const g = this.gloves[i]; g.visible = !!h;
      if (h) { _p.fromArray(h, 0); _q.fromArray(h, 3); g.position.lerp(_p, g.userData.seen ? k : 1); g.quaternion.slerp(_q, g.userData.seen ? k : 1); g.userData.seen = true; }
    });
    this.p.arms.forEach((a) => { a.visible = !(pk.l || pk.r); });
  }

  dispose() { for (const o of this.parts) this.G.scene.remove(o); }
}
