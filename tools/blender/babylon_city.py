# Chapter 4 (Babylon, about 700 BC): the city below the ziggurat, built in Blender instead of plain
# boxes. Pieces the game places many times (js/chapters/babylon.js), each scaled to its spot:
#   lo0..lo5        flat-roofed mud-brick houses, 10 x 10 m footprint, 4 m to the roof (the game
#                   stretches them to each plot): parapets, roof rooms, stairs, palm-log beam ends,
#                   doors, small windows, reed shades, jars, plaster flaking to brick, rain streaks
#   tower           the temple courtyard's tower-gate, 5 x 5 x 12 m, stepped battlements, ribbed
#   wall            16 m of the courtyard wall, 3 m thick, 9 m tall, ribbed, battlements
# Baked soft shadows. Two textures: 'houses' and 'walls'.
#   python3 -I tools/blender/babylon_city.py     (needs `pip install bpy`; writes models/sets/babylon_city.glb)
import math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import setkit as K
from setkit import Piece, M, srgb, flat

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'models', 'sets', 'babylon_city.glb')
K.reset()


def plaster(name, base, dirt):
    m = M(name)
    col = m.mix(m.rgb(srgb(base)), m.noise(1.2, 8, 0.6).outputs['Fac'], 0.22, 'OVERLAY')
    br = m.brick(srgb(0x8a6a48), srgb(0x7a5c3c), srgb(0x9a8668), 0.11, 0.36, 0.015)
    flake = m.ramp(m.noise(0.9, 5, 0.7).outputs['Fac'], [(0.0, 0), (0.6, 0), (0.65, 1)])
    col = m.mix(col, br.outputs['Color'], flake)
    streak = m.wave(1.5, 'Z', 6, 2).outputs['Fac']
    col = m.mix(col, m.rgb(srgb(dirt)), m.ramp(streak, [(0, 0.0), (1, 0.14)]))
    cr = m.voronoi_edges(0.7, 0.012)
    col = m.mix(m.rgb(srgb(dirt)), col, m.ramp(cr, [(0, 0.7), (1, 1)]))
    m.out(col)


plaster('pl_a', 0xb08a62, 0x6a4c30)
plaster('pl_b', 0xa07a54, 0x5a4028)
plaster('pl_c', 0xbe9c74, 0x7a5a3a)
plaster('pl_d', 0x9a7e60, 0x5a4630)
m = M('roof')
col = m.mix(m.rgb(srgb(0xa88a64)), m.noise(2.5, 8).outputs['Fac'], 0.3, 'OVERLAY')
m.out(m.mix(col, m.rgb(srgb(0x7a6244)), m.ramp(m.noise(0.6, 3).outputs['Fac'], [(0.45, 0), (0.7, 0.5)])))
# baked brick (the temple and city walls): big square bricks, bitumen-dark mortar, here and there glazed
m = M('wall'); b = m.brick(srgb(0xa48660), srgb(0x8e7252), srgb(0x5a4a38), 0.09, 0.34, 0.012)
col = m.mix(b.outputs['Color'], m.noise(3, 6).outputs['Fac'], 0.25, 'OVERLAY')
col = m.mix(col, m.rgb(srgb(0x5e4a36)), m.ramp(m.wave(1.2, 'Z', 5, 2).outputs['Fac'], [(0, 0), (1, 0.18)]))
m.out(col)
m = M('wall_top'); m.out(m.mix(m.rgb(srgb(0x9a8060)), m.noise(2, 6).outputs['Fac'], 0.3, 'OVERLAY'))
m = M('palm'); g = m.wave(14, 'Z', 0.5, 1).outputs['Fac']
m.out(m.mix(m.rgb(srgb(0x7a6040)), m.rgb(srgb(0x4e3a24)), m.ramp(g, [(0.6, 0), (0.9, 1)])))
m = M('wood'); g = m.wave(9, 'Z', 8, 3).outputs['Fac']
m.out(m.mix(m.rgb(srgb(0x6a4e30)), m.rgb(srgb(0x4a3420)), m.ramp(g, [(0.3, 0), (0.7, 0.8)])))
m = M('reed')
w1 = m.wave(28, 'X', 0.4, 1).outputs['Fac']
m.out(m.mix(m.rgb(srgb(0xc9a964)), m.rgb(srgb(0x9a7a40)), m.ramp(w1, [(0, 0), (1, 0.7)])))
flat('dark', 0x1a120a, 0.05)
flat('clay', 0xa45a36, 0.2, 6)
flat('cloth', 0x8a3a2a, 0.15, 5)
flat('blue', 0x2a4a8a, 0.2, 5)   # a glazed blue band (Babylon's famous glazed brick)


def parapet(p, w, d, z, h, t, mat):
    for (cx, cy, ww, dd) in [(0, -d / 2 + t / 2, w, t), (0, d / 2 - t / 2, w, t), (-w / 2 + t / 2, 0, t, d - 2 * t), (w / 2 - t / 2, 0, t, d - 2 * t)]:
        p.box((cx, cy, z - 0.02), (ww, dd, h), mat, top='roof')


def beams(p, w, d, z, step=0.9):
    n = int(d / step)
    for i in range(n):
        y = -d / 2 + (i + 0.5) * d / n
        for s in (-1, 1): p.cyl((s * (w / 2 - 0.05), y, z), 0.09, 0.32, 'palm', segs=5, axis=(s, 0, 0), cap=False)


def house(name, rnd, h, mat, lo=False):
    p = Piece(name, 'houses')
    w = d = 10.0
    p.box((0, 0, 0), (w, d, h), mat, batter=0.06, top='roof')
    parapet(p, w - 0.12, d - 0.12, h, 0.55, 0.3, mat)
    if not lo: beams(p, w - 0.12, d - 0.12, h - 0.45)
    # door (front is -y in Blender = +z in the game) and small high windows
    dx = (rnd.random() - 0.5) * 4
    p.box((dx, -d / 2 - 0.02, 0), (1.1, 0.08, 2.0), 'dark', top=False)
    p.box((dx, -d / 2 - 0.08, 2.0), (1.6, 0.18, 0.18), 'wood')
    for (sx, sy) in [(0, -1), (0, 1), (1, 0), (-1, 0)]:
        for k in range(2):
            if rnd.random() < 0.4: continue
            o = (k - 0.5) * 4.5 + (rnd.random() - 0.5)
            zz = h - 1.2
            if sx: p.box((sx * (w / 2 - 0.02), o, zz), (0.08, 0.55, 0.35), 'dark', top=False)
            else: p.box((o, sy * (d / 2 - 0.02), zz), (0.55, 0.08, 0.35), 'dark', top=False)
    # a roof room on most, with its own door; a stair up the side on some
    if rnd.random() < 0.75:
        rw, rd, rh = 3 + rnd.random() * 2, 3 + rnd.random() * 1.5, 2.2
        rx, ry = (rnd.random() - 0.5) * (w - rw - 1.2), 1.2 + rnd.random() * (d / 2 - rd / 2 - 1.5)
        p.box((rx, ry, h), (rw, rd, rh), mat, batter=0.04, top='roof')
        p.box((rx, ry - rd / 2 - 0.02, h), (0.8, 0.08, 1.6), 'dark', top=False)
        if not lo: beams(p, rw, rd, h + rh - 0.3, step=1.1)
    if rnd.random() < 0.5:
        sx = 1 if rnd.random() < 0.5 else -1
        n = 3 if lo else 8
        for i in range(n):
            p.box((sx * (w / 2 + 0.55), -d / 2 + 1.2 + i * (h / n) * 0.9, 0), (1.1, 0.9, (i + 1) * h / n), mat, top='roof')
    # a reed shade on posts, or jars and a cloth drying
    r = rnd.random()
    if r < 0.45:
        ax, ay = (rnd.random() - 0.5) * 3, -2.5 + (rnd.random() - 0.5)
        for (px, py) in [(ax - 1.4, ay - 1), (ax + 1.4, ay - 1), (ax - 1.4, ay + 1), (ax + 1.4, ay + 1)]: p.cyl((px, py, h), 0.06, 1.8, 'palm', segs=3 if lo else 5, cap=False)
        p.box((ax, ay, h + 1.8), (3.2, 2.4, 0.08), 'reed')
    elif not lo:
        for i in range(2 + int(rnd.random() * 3)):
            jx, jy = -3 + rnd.random() * 2, -3 + i * 0.7
            p.lathe((jx, jy, h), [(0, 0), (0.14, 0.02), (0.28, 0.3), (0.24, 0.55), (0.12, 0.68), (0.0, 0.66)], 'clay', segs=7)
        if rnd.random() < 0.5: p.box((2, 1, h + 1.0), (2.2, 0.03, 1.0), 'cloth', top=False)
    return p


def battlements(p, x0, x1, y, z, t, step=1.6, axis='x', mat='wall'):
    """Babylon's stepped merlons along a wall top."""
    n = max(1, int(abs(x1 - x0) / step))
    for i in range(n):
        c = x0 + (i + 0.5) * (x1 - x0) / n
        pos = (c, y, z) if axis == 'x' else (y, c, z)
        size = (step * 0.55, t, 0.7) if axis == 'x' else (t, step * 0.55, 0.7)
        p.box(pos, size, mat, top='wall_top')
        size2 = (step * 0.3, t, 0.4) if axis == 'x' else (t, step * 0.3, 0.4)
        p.box((pos[0], pos[1], z + 0.7), size2, mat, top='wall_top')


def ribs(p, w, d, h, step, depth=0.25, mat='wall'):
    for sy in (-1, 1):
        n = int(w / step)
        for i in range(1, n):
            p.box((-w / 2 + i * w / n, sy * (d / 2 + depth / 2), 0), (0.7, depth, h - 0.3), mat, top=False)
    for sx in (-1, 1):
        n = int(d / step)
        for i in range(1, n):
            p.box((sx * (w / 2 + depth / 2), -d / 2 + i * d / n, 0), (depth, 0.7, h - 0.3), mat, top=False)


def tower(name, w, h):
    p = Piece(name, 'walls')
    p.box((0, 0, 0), (w, w, h), 'wall', batter=0.12, top='wall_top')
    ribs(p, w - 0.2, w - 0.2, h, w / 3)
    p.box((0, 0, h - 1.6), (w + 0.15, w + 0.15, 0.35), 'blue')   # a glazed band
    for s in (-1, 1):
        battlements(p, -w / 2, w / 2, s * (w / 2 - 0.3), h, 0.6)
        battlements(p, -w / 2 + 0.6, w / 2 - 0.6, s * (w / 2 - 0.3), h, 0.6, axis='y')
    for s in (-1, 1): p.box((s * (w / 2 + 0.01), 0, h - 3.5), (0.06, 0.5, 1.0), 'dark', top=False)
    return p


def wall(name, length, t, h):
    p = Piece(name, 'walls')
    p.box((0, 0, 0), (length, t, h), 'wall', batter=0.08, top='wall_top')
    ribs(p, length, t, h, 4.0)
    for s in (-1, 1): battlements(p, -length / 2, length / 2, s * (t / 2 - 0.3), h, 0.6, step=2.3)
    return p


rnd = random.Random(7)
pieces = []
for i, mat in enumerate(['pl_a', 'pl_b', 'pl_c', 'pl_d', 'pl_b', 'pl_c']):
    pieces.append(house(f'lo{i}', rnd, 4, mat, lo=True))
pieces += [tower('tower', 5, 12), wall('wall', 16, 3, 9)]
K.bake_export(pieces, OUT, {'houses': 1024, 'walls': 1024}, samples=20, ao_strength=0.7, saturation=1.7, gain=0.8)
