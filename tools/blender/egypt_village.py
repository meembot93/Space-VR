# Chapter 3 (Egypt, about 2500 BC): the priest's house you stand on, and the seven houses round it,
# built in Blender with mud plaster, mud brick, palm-log beams, reed awnings and roof clutter, and
# baked soft shadows. Sizes and places match js/chapters/nile.js exactly (the roof is 9 x 9 m,
# 7.5 m up; the bell, the sighting post, the table and the stair hole are where the game expects).
#
#   python3 -I tools/blender/egypt_village.py         (needs `pip install bpy`; writes models/sets/egypt_village.glb)
# Two textures: 'roof' (the priest's house, seen from 1 m) and 'near' (the neighbours).
import math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import setkit as K
from setkit import Piece, M, srgb, flat

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'models', 'sets', 'egypt_village.glb')
K.reset()

# ---------------- materials ----------------
def plaster(name, base, dirt, white=False):
    m = M(name)
    n1 = m.noise(1.2, 8, 0.6).outputs['Fac']
    n2 = m.noise(0.25, 4).outputs['Fac']
    col = m.mix(m.rgb(srgb(base)), n1, 0.22, 'OVERLAY')
    # flaked patches where the mud brick shows through, more of them low down
    br = m.brick(srgb(0x8a6a48), srgb(0x7a5c3c), srgb(0x9a8668), 0.11, 0.36, 0.015)
    flake = m.ramp(m.noise(0.9, 5, 0.7).outputs['Fac'], [(0.0, 0), (0.62, 0), (0.66, 1)])
    col = m.mix(col, br.outputs['Color'], flake)
    # rain streaks and grime at the foot of the walls
    streak = m.wave(1.5, 'Z', 6, 2).outputs['Fac']
    col = m.mix(col, m.rgb(srgb(dirt)), m.ramp(streak, [(0, 0.0), (1, 0.12)]))
    # hairline cracks
    cr = m.voronoi_edges(0.7, 0.012)
    col = m.mix(m.rgb(srgb(dirt)), col, m.ramp(cr, [(0, 0.7), (1, 1)]))
    m.out(col)

plaster('plaster', 0xb8804a, 0x6a4428)
plaster('plaster_b', 0xa06c40, 0x5a3c22)
plaster('white', 0xc89a64, 0x7a5636)
# packed-earth roof floor: mottled, with swept arcs
m = M('floor')
col = m.mix(m.rgb(srgb(0x9a6e46)), m.noise(2.5, 8).outputs['Fac'], 0.3, 'OVERLAY')
col = m.mix(col, m.rgb(srgb(0x6e5538)), m.ramp(m.noise(0.6, 3).outputs['Fac'], [(0.45, 0), (0.7, 0.5)]))
m.out(col)
# mud brick, bare
m = M('brick'); b = m.brick(srgb(0x8e6c48), srgb(0x7c5e3e), srgb(0xa08a6a), 0.11, 0.36, 0.014)
m.out(m.mix(b.outputs['Color'], m.noise(3, 6).outputs['Fac'], 0.25, 'OVERLAY'))
# reed matting: fine stripes woven in bands
m = M('reed')
w1 = m.wave(28, 'X', 0.4, 1).outputs['Fac']; w2 = m.wave(4, 'Y', 0.2, 1).outputs['Fac']
col = m.mix(m.rgb(srgb(0xc9a964)), m.rgb(srgb(0x9a7a40)), m.ramp(w1, [(0, 0), (1, 0.7)]))
col = m.mix(col, m.rgb(srgb(0x7a5e30)), m.ramp(w2, [(0.85, 0), (1, 0.5)]))
m.out(col)
# a woven floor mat: chequered weave, dyed bands
m = M('mat')
w1 = m.wave(18, 'X', 0.3, 1).outputs['Fac']; w2 = m.wave(18, 'Y', 0.3, 1).outputs['Fac']
weave = m.mix(m.rgb((0.5, 0.5, 0.5)), w1, w2, 'MULTIPLY')
col = m.mix(m.rgb(srgb(0xb8865a)), m.rgb(srgb(0x8a5a36)), m.ramp(w1, [(0.4, 0), (0.6, 0.6)]))
col = m.mix(col, m.rgb(srgb(0x7a3a2a)), m.ramp(m.wave(1.2, 'Y', 0, 0).outputs['Fac'], [(0.9, 0), (0.95, 1)]))
m.out(col)
# palm wood: grainy, dark
m = M('wood')
g = m.wave(9, 'Z', 8, 3).outputs['Fac']
m.out(m.mix(m.rgb(srgb(0x6a4e30)), m.rgb(srgb(0x4a3420)), m.ramp(g, [(0.3, 0), (0.7, 0.8)])))
m = M('palm')   # palm trunk: rings
g = m.wave(14, 'Z', 0.5, 1).outputs['Fac']
m.out(m.mix(m.rgb(srgb(0x7a6040)), m.rgb(srgb(0x4e3a24)), m.ramp(g, [(0.6, 0), (0.9, 1)])))
flat('clay', 0xa45a36, 0.2, 6)
flat('clay2', 0xb87448, 0.2, 6)
flat('dark', 0x1a120a, 0.05)
flat('limestone', 0xd8ccb0, 0.15, 4)
flat('linen', 0xe8e0cc, 0.1, 5)
flat('red', 0x8a3a2a, 0.15, 5)
flat('blue', 0x3a5a7a, 0.15, 5)
flat('basket', 0xc49a5a, 0.3, 12)
flat('grain', 0xd8b868, 0.3, 20)
flat('dates', 0x6a2a1a, 0.4, 30)

# three.js (x, z) -> Blender (x, y)
B = lambda x, z: (x, -z)


def beams(p, w, d, z, side_x=True, step=0.65):
    """Palm-log beam ends poking out of two opposite walls just under the roof."""
    if side_x:
        n = int(d / step)
        for i in range(n):
            y = -d / 2 + (i + 0.5) * d / n
            for s in (-1, 1): p.cyl((s * (w / 2 - 0.05), y, z), 0.085, 0.3, 'palm', segs=6, axis=(s, 0, 0))
    else:
        n = int(w / step)
        for i in range(n):
            x = -w / 2 + (i + 0.5) * w / n
            for s in (-1, 1): p.cyl((x, s * (d / 2 - 0.05), z), 0.085, 0.3, 'palm', segs=6, axis=(0, s, 0))


def parapet(p, w, d, z, h, t, mat, gaps=()):
    """A low wall round the roof's edge, rounded off on top with a mud coping."""
    for (cx, cy, ww, dd) in [(0, -d / 2 + t / 2, w, t), (0, d / 2 - t / 2, w, t), (-w / 2 + t / 2, 0, t, d - 2 * t), (w / 2 - t / 2, 0, t, d - 2 * t)]:
        p.box((cx, cy, z - 0.02), (ww, dd, h), mat, top=False)
        p.box((cx, cy, z + h - 0.02), (ww + 0.04, dd + 0.04, 0.07), mat, batter=0.03)


def door(p, w, d, side, z0, mat_lintel='wood'):
    """A dark doorway with a palm-log lintel on side (x, y) unit direction."""
    sx, sy = side
    if sx:
        x = sx * (w / 2 + 0.01)
        p.box((x, 0, z0), (0.06, 1.0, 1.95), 'dark')
        p.cyl((x + sx * 0.03, -0.75, z0 + 2.05), 0.08, 1.5, mat_lintel, segs=6, axis='Y')
    else:
        y = sy * (d / 2 + 0.01)
        p.box((0, y, z0), (1.0, 0.06, 1.95), 'dark')
        p.cyl((-0.75, y + sy * 0.03, z0 + 2.05), 0.08, 1.5, mat_lintel, segs=6, axis='X')


def windows(p, w, d, z, rnd, n=2):
    for (sx, sy) in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        for i in range(n):
            if rnd.random() < 0.35: continue
            o = (i - (n - 1) / 2) * 2.6 + (rnd.random() - 0.5) * 0.5
            if sx: p.box((sx * (w / 2 + 0.01), o, z), (0.05, 0.5, 0.32), 'dark')
            else: p.box((o, sy * (d / 2 + 0.01), z), (0.5, 0.05, 0.32), 'dark')


def jar(p, x, y, z, s=1.0, mat='clay'):
    p.lathe((x, y, z), [(0, 0), (0.12 * s, 0.02 * s), (0.24 * s, 0.25 * s), (0.22 * s, 0.48 * s), (0.1 * s, 0.62 * s), (0.12 * s, 0.7 * s), (0.09 * s, 0.7 * s), (0.0, 0.66 * s)], mat)


def basket(p, x, y, z, r=0.26, h=0.24, fill='grain'):
    p.lathe((x, y, z), [(0, 0), (r * 0.85, 0.01), (r, h), (r * 0.93, h)], 'basket', segs=12)
    p.lathe((x, y, z + h - 0.06), [(r * 0.92, 0), (r * 0.6, 0.05), (0, 0.07)], fill, segs=12)


def awning(p, cx, cy, w, d, z, h, rnd, posts=None):
    """A reed shade on four palm posts, with cross-poles and frayed edges."""
    pts = posts or [(cx - w / 2 + 0.2, cy - d / 2 + 0.2), (cx + w / 2 - 0.2, cy - d / 2 + 0.2), (cx - w / 2 + 0.2, cy + d / 2 - 0.2), (cx + w / 2 - 0.2, cy + d / 2 - 0.2)]
    for (px, py) in pts:
        p.cyl((px, py, z), 0.055, h, 'palm', segs=7)
    for (a, b) in [(0, 1), (2, 3)]:
        (x0, y0), (x1, y1) = pts[a], pts[b]
        p.cyl((x0 - 0.15, y0, z + h - 0.06), 0.045, (x1 - x0) + 0.3, 'wood', segs=6, axis='X')
    for i in range(5):
        x = pts[0][0] + (pts[1][0] - pts[0][0]) * i / 4
        p.cyl((x, pts[0][1] - 0.25, z + h + 0.02), 0.03, (pts[2][1] - pts[0][1]) + 0.5, 'wood', segs=5, axis='Y')
    # the reed roof, very slightly sagging (two slopes), its edges a little ragged
    x0, x1 = pts[0][0] - 0.3, pts[1][0] + 0.3; y0, y1 = pts[0][1] - 0.35, pts[2][1] + 0.35
    zt = z + h + 0.07
    ym = (y0 + y1) / 2
    p.poly([(x0, y0, zt), (x1, y0, zt), (x1, ym, zt - 0.06), (x0, ym, zt - 0.06)], 'reed')
    p.poly([(x0, ym, zt - 0.06), (x1, ym, zt - 0.06), (x1, y1, zt), (x0, y1, zt)], 'reed')
    p.poly([(x0, ym, zt - 0.08), (x1, ym, zt - 0.08), (x1, y0, zt - 0.02), (x0, y0, zt - 0.02)], 'reed')
    p.poly([(x0, y1, zt - 0.02), (x1, y1, zt - 0.02), (x1, ym, zt - 0.08), (x0, ym, zt - 0.08)], 'reed')
    for i in range(int((x1 - x0) / 0.18)):
        xx = x0 + 0.09 + i * 0.18; L = 0.05 + rnd.random() * 0.12
        for yy, s in ((y0, -1), (y1, 1)):
            p.poly([(xx - 0.07, yy, zt - 0.01), (xx + 0.07, yy, zt - 0.01), (xx + 0.04, yy + s * L, zt - 0.03 - L * 0.4)][::(1 if s < 0 else -1)], 'reed')


# ---------------- the priest's house (you stand on its roof) ----------------
W, HR = 9.0, 7.5          # 9 x 9 m, roof floor 7.5 m above its foot
p = Piece('priest_house', 'roof')
rnd = random.Random(3)
p.box((0, 0, -1.2), (W, W, HR + 1.2), 'plaster', batter=0.06, top=False)
# the roof floor round the stair hole (three (-3.2, -2.8), 1.4 x 2.0 -> Blender x -3.9..-2.5, y 1.8..3.8)
hx0, hx1, hy0, hy1 = -3.9, -2.5, 1.8, 3.8
T = 0.3   # parapet thickness
fz = HR
e = W / 2 - 0.06
p.poly([(-e, -e, fz), (e, -e, fz), (e, hy0, fz), (-e, hy0, fz)], 'floor')
p.poly([(-e, hy1, fz), (e, hy1, fz), (e, e, fz), (-e, e, fz)], 'floor')
p.poly([(-e, hy0, fz), (hx0, hy0, fz), (hx0, hy1, fz), (-e, hy1, fz)], 'floor')
p.poly([(hx1, hy0, fz), (e, hy0, fz), (e, hy1, fz), (hx1, hy1, fz)], 'floor')
# the stairwell: walls going down into the dark, and mud-brick steps down to the north
for (x0, y0, x1, y1) in [(hx0, hy0, hx1, hy0), (hx1, hy0, hx1, hy1), (hx1, hy1, hx0, hy1), (hx0, hy1, hx0, hy0)]:
    p.poly([(x0, y0, fz), (x0, y0, fz - 2.6), (x1, y1, fz - 2.6), (x1, y1, fz)], 'brick')
for i in range(7):
    z = fz - 0.22 * (i + 1); y = hy0 + 0.05 + i * 0.27
    p.box(((hx0 + hx1) / 2, y + 0.14, z - 0.3), (hx1 - hx0 - 0.02, 0.28, 0.3), 'brick', top='floor')
p.box(((hx0 + hx1) / 2, (hy0 + hy1) / 2, fz - 2.7), (hx1 - hx0, hy1 - hy0, 0.05), 'dark')
# a low kerb round the hole on its open sides, so it reads as a drop
p.box((hx1 + 0.08, (hy0 + hy1) / 2, fz), (0.16, hy1 - hy0 + 0.32, 0.18), 'plaster_b')
p.box(((hx0 + hx1) / 2, hy0 - 0.08, fz), (hx1 - hx0, 0.16, 0.18), 'plaster_b')
parapet(p, W, W, fz, 0.55, T, 'plaster')
beams(p, W, W, fz - 0.35, side_x=True)
# drain spouts through the east and south walls
p.cyl((W / 2 - 0.1, -1.5, fz + 0.04), 0.06, 0.45, 'wood', segs=5, axis='X')
p.cyl((1.2, -W / 2 + 0.1, fz + 0.04), 0.06, 0.45, 'wood', segs=5, axis='-Y' if False else (0, -1, 0))
# the house below: a door on the west (the village side), small high windows, a lower floor's beams
door(p, W, W, (-1, 0), -0.05)
windows(p, W, W, 5.4, rnd, 2)
windows(p, W, W, 2.4, rnd, 2)
beams(p, W, W, 3.7, side_x=False)
# a whitewashed band and a darker wet foot round the bottom of the walls
p.box((0, 0, -1.2), (W + 0.03, W + 0.03, 1.5), 'plaster_b', top=False)
# the reed shade on palm posts, south-west corner (three posts (-4,1.3) (-1.6,1.3) (-4,4) (-1.6,4))
awning(p, 0, 0, 0, 0, fz, 2.25, rnd, posts=[B(-4, 4), B(-1.6, 4), B(-4, 1.3), B(-1.6, 1.3)])
# a woven mat and cushions under it, a headrest
mx, my = B(-2.8, 2.6)
p.box((mx, my, fz), (2.1, 2.5, 0.03), 'mat')
p.box((mx - 0.8, my - 0.75, fz + 0.03), (0.6, 0.35, 0.13), 'red', batter=0.04)
p.box((mx + 0.3, my - 0.9, fz + 0.03), (0.55, 0.32, 0.12), 'blue', batter=0.04)
p.box((mx - 0.3, my + 0.6, fz + 0.03), (1.0, 0.6, 0.05), 'linen')
# water jars on stands, baskets of grain and dates, a bread oven, a quern stone
jar(p, *B(-4.0, -1.2), fz, 1.0, 'clay')
jar(p, *B(-3.5, -1.5), fz, 0.8, 'clay2')
p.cyl((*B(-3.85, -0.55), fz), 0.18, 0.12, 'clay2', segs=10, r2=0.2)
basket(p, *B(3.6, 3.7), fz, 0.26, 0.22, 'grain')
basket(p, *B(3.0, 3.85), fz, 0.2, 0.18, 'dates')
p.dome((*B(-3.7, -3.6), fz), 0.5, 0.7, 'clay', segs=10)              # the bread oven
p.box((*B(-3.7, -3.1), fz), (0.25, 0.04, 0.22), 'dark')
p.box((*B(-2.6, -3.85), fz), (0.55, 0.35, 0.12), 'limestone', batter=0.04)   # quern
p.box((*B(-2.6, -3.85), fz + 0.12), (0.3, 0.12, 0.06), 'limestone')
# the offering table: a limestone slab on a pedestal (lamp sits at three (3.4, Y+0.78, -3.4))
tx, ty = B(3.4, -3.4)
p.box((tx, ty, fz), (0.3, 0.3, 0.06), 'limestone')
p.cyl((tx, ty, fz + 0.06), 0.07, 0.64, 'limestone', segs=8, r2=0.06)
p.box((tx, ty, fz + 0.7), (0.7, 0.5, 0.05), 'limestone')
p.lathe((tx, ty, fz + 0.75), [(0, 0), (0.07, 0.01), (0.08, 0.035), (0.06, 0.03), (0, 0.02)], 'clay2')
for (ox, oy) in ((-0.22, 0.1), (0.2, -0.12)): p.lathe((tx + ox, ty + oy, fz + 0.75), [(0, 0), (0.05, 0.01), (0.06, 0.08), (0.03, 0.12), (0, 0.12)], 'clay')
# the sighting post on its little mud-brick stand on the east wall (three SP = (4.35, Y+0.75, -0.3))
sx, sy = B(W / 2 - 0.15, -0.3)
p.box((sx, sy, fz + 0.53), (0.34, 0.3, 0.22), 'plaster_b', batter=0.03)
p.box((sx - 0.05, sy, fz + 0.75), (0.08, 0.06, 0.55), 'wood')
p.box((sx - 0.05, sy + 0.035, fz + 1.26), (0.025, 0.04, 0.14), 'wood')
p.box((sx - 0.05, sy - 0.035, fz + 1.26), (0.025, 0.04, 0.14), 'wood')
# the bell frame, south-east corner (three B = (3.2, ., 3.3)): two posts and a beam
bx, by = B(3.2, 3.3)
for s in (-1, 1): p.box((bx + s * 0.55, by, fz), (0.13, 0.13, 2.27), 'wood')
p.box((bx, by, fz + 2.13), (1.4, 0.16, 0.15), 'wood')
for s in (-1, 1): p.box((bx + s * 0.55, by, fz), (0.3, 0.3, 0.12), 'plaster_b', batter=0.05)
# a bundle of firewood and a broom by the north wall
for i in range(6): p.cyl((1.6 + (i % 3) * 0.07, 4.05 + (i // 3) * 0.07, fz + 0.05), 0.035, 0.9 + rnd.random() * 0.2, 'wood', segs=5, axis=(1, 0.05 * i, 0.06))
pieces = [p]


# ---------------- the neighbours ----------------
# [three x, z, w (x), d (z), roof height, door direction in three (x, z)], as in nile.js `near`
NEAR = [(-10.4, 0, 8.5, 9, 4.3, (0, -1)), (0, 10.2, 9, 8, 4.6, (-1, 0)), (0, -10.4, 9, 8.5, 3.8, (0, 1)), (-10, 10, 8, 8, 5.2, (1, 0)),
        (-10.2, -10.2, 8, 8, 4.8, (0, 1)), (2, 21, 8, 8, 3.6, (-1, 0)), (1, -22, 9, 8, 3.4, (-1, 0))]
for i, (x, z, w, d, h, dr) in enumerate(NEAR):
    rnd = random.Random(100 + i)
    p = Piece(f'house_{i}', 'near')
    wall = ['plaster', 'plaster_b', 'white'][i % 3]
    p.box((0, 0, -1.2), (w, d, h + 1.2), wall, batter=0.05, top='floor')
    parapet(p, w, d, h, 0.45, 0.28, wall)
    beams(p, w, d, h - 0.3, side_x=(i % 2 == 0))
    door(p, w, d, (dr[0], -dr[1]), -0.05)
    windows(p, w, d, h - 1.1, rnd, 2)
    p.box((0, 0, -1.2), (w + 0.03, d + 0.03, 1.4), 'plaster_b', top=False)
    # an outside stair of mud brick up one side (some houses), or a roof hatch
    if i % 3 != 1:
        side = 1 if i % 2 else -1
        n = int(h / 0.25)
        for k in range(n):
            p.box((-w / 2 + 0.6 + k * (w - 1.6) / n, side * (d / 2 + 0.45), -0.5), ((w - 1.6) / n + 0.02, 0.8, 0.5 + (k + 1) * h / n), 'brick', top='floor')
    else:
        p.box((w / 2 - 1.6, d / 2 - 1.6, h), (1.0, 1.2, 0.04), 'dark')
    # roof life: a shade or a little roof room, jars, drying dates, a mat with bedding, firewood
    if i % 2 == 0:
        awning(p, -w / 4, -d / 4, 2.6, 2.2, h, 1.9, rnd)
    else:
        p.box((w / 2 - 1.7, -d / 2 + 1.6, h), (2.4, 2.2, 1.9), wall, batter=0.04, top='reed')
        p.box((w / 2 - 1.7 - 1.21, -d / 2 + 1.6, h), (0.04, 0.8, 1.5), 'dark')
    for k in range(rnd.randint(2, 4)):
        jar(p, (rnd.random() - 0.5) * (w - 2), (rnd.random() - 0.5) * (d - 2), h, 0.7 + rnd.random() * 0.4, ['clay', 'clay2'][k % 2])
    p.box((w / 4 - 0.5, d / 4, h), (1.6, 1.1, 0.03), 'mat')
    p.box((w / 4 - 0.5, d / 4 + 0.2, h + 0.03), (1.3, 0.6, 0.08), 'linen', batter=0.03)
    if rnd.random() < 0.7: basket(p, -w / 4 + 1.5, d / 4 + 0.6, h, 0.25, 0.2, ['grain', 'dates'][i % 2])
    if i % 2: p.box((-w / 4, d / 4 + 1.0, h), (1.4, 0.9, 0.04), 'reed')
    # a bread oven by the wall of every other house, on the ground
    if i % 2 == 0: p.dome((w / 2 + 0.7, d / 4, 0), 0.55, 0.75, 'clay', segs=10)
    pieces.append(p)

K.bake_export(pieces, OUT, {'roof': 2048, 'near': 2048}, samples=int(os.environ.get('SAMPLES', '24')), saturation=1.55, gain=0.9)
