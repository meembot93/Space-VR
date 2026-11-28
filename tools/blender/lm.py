# The Apollo lunar module (Eagle) for Era 3, in the two halves that separate on the Moon:
#   lm_descent.glb  the gold-foil descent stage with its four legs, footpads, ladder, porch and engine.
#                   Origin = the ground under its centre (footpads rest on z=0). Top deck at z = TOP.
#   lm_ascent.glb   the crew cabin that lifts off. Origin = its own bottom, which sits on the descent
#                   stage's top deck (place it at TOP = 2.62 m above the descent stage's origin).
# Front (hatch, ladder, windows) faces -y in Blender = +z in the game. Real sizes in metres.
#   python3 -I tools/blender/lm.py [out dir]
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # (loads mathutils)
from mathutils import Matrix, Vector
from kit import Kit, reset

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'era3')
os.makedirs(OUT, exist_ok=True)

PAL = {
    'gold':   ((0.85, 0.62, 0.22), 0.32, 1.0),    # kapton foil
    'gold2':  ((0.80, 0.56, 0.18), 0.4, 1.0),    # crinkled foil, darker
    'amber':  ((0.68, 0.44, 0.13), 0.45, 1.0),
    'mylar':  ((0.80, 0.80, 0.82), 0.25, 1.0),    # silver foil
    'black':  ((0.05, 0.05, 0.055), 0.6, 0.1),
    'cabin':  ((0.60, 0.60, 0.58), 0.55, 0.4),    # ascent stage grey aluminium
    'cabin2': ((0.48, 0.48, 0.47), 0.6, 0.4),
    'cabin3': ((0.70, 0.70, 0.67), 0.5, 0.5),
    'kblack': ((0.07, 0.065, 0.06), 0.35, 0.6),   # black kapton blanket, a little shiny
    'dark':   ((0.15, 0.15, 0.16), 0.55, 0.5),
    'strut':  ((0.70, 0.68, 0.62), 0.35, 1.0),
    'glass':  ((0.02, 0.03, 0.05), 0.08, 0.0),
    'bell':   ((0.22, 0.22, 0.24), 0.45, 0.7),
    'inside': ((0.03, 0.03, 0.03), 0.9, 0.0),
    'white':  ((0.86, 0.86, 0.84), 0.55, 0.05),
    'red':    ((0.70, 0.08, 0.08), 0.6, 0.0),
    'blue':   ((0.06, 0.12, 0.40), 0.6, 0.0),
    'dish':   ((0.82, 0.82, 0.80), 0.5, 0.2),
}
TOP = 2.62        # descent stage top deck, above ground
BOT = 1.0         # descent stage underside


def new():
    reset()
    return Kit(PAL)


def rod(k, a, b, r, color, segs=8):
    """A round strut from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    k.tube(Matrix.Translation(a) @ rot, r, d.length, color, segs=segs, cap=False)


import random
RNG = random.Random(11)


def pick(weights):
    r = RNG.random() * sum(w for _, w in weights)
    for c, w in weights:
        r -= w
        if r <= 0:
            return c
    return weights[-1][0]


def crinkle(k, p0, pu, pv, nu, nv, jit, weights):
    """A foil blanket over the flat quad p0 + u*pu + v*pv: a grid whose inner points are pushed in
    and out at random (the crinkle), each cell coloured from weights [(name, weight)]."""
    p0, pu, pv = Vector(p0), Vector(pu), Vector(pv)
    n = pu.cross(pv).normalized()
    grid = []
    for j in range(nv + 1):
        row = []
        for i in range(nu + 1):
            q = p0 + pu * (i / nu) + pv * (j / nv)
            if 0 < i < nu and 0 < j < nv:
                q = q + n * (RNG.random() * jit) + pu.normalized() * (RNG.random() - 0.5) * jit * 0.6
            row.append(k.bm.verts.new(q))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            f = k.bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            f[k.col] = k.ci(pick(weights))


def pbox(k, c, size, weights, cell=0.35, seam=None):
    """A box whose every face is a grid of separately coloured panels (bolted aluminium sheets)."""
    c = Vector(c); sx, sy, sz = (v / 2 for v in size)
    faces = [((-sx, -sy, -sz), (2 * sx, 0, 0), (0, 0, 2 * sz)),      # front (-y)
             ((sx, sy, -sz), (-2 * sx, 0, 0), (0, 0, 2 * sz)),       # back
             ((sx, -sy, -sz), (0, 2 * sy, 0), (0, 0, 2 * sz)),       # right
             ((-sx, sy, -sz), (0, -2 * sy, 0), (0, 0, 2 * sz)),      # left
             ((-sx, -sy, sz), (2 * sx, 0, 0), (0, 2 * sy, 0))]       # top
    for o, u, v in faces:
        u, v = Vector(u), Vector(v)
        crinkle(k, c + Vector(o), u, v, max(1, round(u.length / cell)), max(1, round(v.length / cell)), 0.0, weights)


FOIL = [('gold', 5), ('gold2', 3), ('amber', 2), ('mylar', 0.6)]
PANEL = [('cabin', 5), ('cabin3', 3), ('cabin2', 2)]
BLANKET = [('kblack', 5), ('black', 2), ('dark', 1)]


def save(k, name):
    tris = k.export(os.path.join(OUT, name + '.glb'), smooth_angle=20)
    print(f'MODEL {name}: {tris} triangles')


# ================= DESCENT STAGE =================
k = new()
# Octagonal body: long faces front/back/left/right (where the legs sit), short cut corners.
W = 2.1            # half-width of a long face from the centre
C = 1.45           # where the corner cut starts
oct_pts = [(W, -C), (W, C), (C, W), (-C, W), (-W, C), (-W, -C), (-C, -W), (C, -W)]


def foil(i, b):
    return ('gold', 'gold2', 'gold', 'gold2', 'amber')[(i * 7 + b * 3) % 5]


# sides: crinkled foil blankets (gold kapton, with darker and silver patches), the corner bays
# black lower down where the engine's heat reached them
for f in range(8):
    p0, p1 = Vector((*oct_pts[f], BOT)), Vector((*oct_pts[(f + 1) % 8], BOT))
    long = f % 2 == 0
    crinkle(k, p0, p1 - p0, Vector((0, 0, TOP - BOT)), 12 if long else 6, 9, 0.045, FOIL)
# top deck and underside
for z, rev, col in ((TOP, False, 'mylar'), (BOT, True, 'black')):
    vs = [k.bm.verts.new((x, y, z)) for x, y in oct_pts]
    fc = k.bm.faces.new(list(reversed(vs)) if rev else vs)
    fc[k.col] = k.ci(col)
# black thermal panels on the corner bays (the quad bays between the legs)
for f in (1, 3, 5, 7):
    p0, p1 = Vector((*oct_pts[f], 0)), Vector((*oct_pts[(f + 1) % 8], 0))
    mid = (p0 + p1) / 2; n = Vector((mid.x, mid.y, 0)).normalized()
    a = math.atan2(p1.y - p0.y, p1.x - p0.x)
    k.box(mid + n * 0.05 + Vector((0, 0, BOT + 0.35)), ((p1 - p0).length * 0.9, 0.04, 0.5), 'black', rot=(0, 0, a))
# descent engine: bell under the middle
m = Matrix.Translation((0, 0, BOT))
prof = [(0.75, BOT - 1.35 - BOT), (0.55, -0.7), (0.33, -0.25), (0.35, 0.0)]
k.lathe([(r, z) for r, z in prof], 32, 'bell', m=m)
k.lathe([(r - 0.03, z) for r, z in reversed(prof)], 32, 'inside', m=m)
k.lathe([(0.75, -1.35), (0.72, -1.35)], 32, 'bell', m=m)

# legs: one on each long face. Primary strut from the upper side out and down to the footpad,
# two secondary struts from the underside, and the knee braces.
PAD_R = 4.3
for li, ang in enumerate((-math.pi / 2, 0.0, math.pi / 2, math.pi)):
    d = Vector((math.cos(ang), math.sin(ang), 0))
    t = Vector((-d.y, d.x, 0))
    pad = d * PAD_R + Vector((0, 0, 0.12))
    top = d * (W + 0.05) + Vector((0, 0, TOP - 0.15))
    rod(k, top, pad + Vector((0, 0, 0.12)), 0.09, 'strut', 10)                 # primary strut (gold-wrapped tube)
    rod(k, top + d * 0.3 + Vector((0, 0, -0.45)), pad + Vector((0, 0, 0.12)), 0.06, 'gold', 8)  # shock absorber cover
    knee = d * (PAD_R - 0.9) + Vector((0, 0, 0.9))
    for s in (-1, 1):
        base = d * (W - 0.05) + t * (s * 1.25) + Vector((0, 0, BOT + 0.05))
        rod(k, base, knee, 0.045, 'strut', 6)                                      # secondary struts
        rod(k, d * (W - 0.05) + t * (s * 1.0) + Vector((0, 0, BOT + 0.9)), base + (knee - base) * 0.55, 0.03, 'strut', 6)  # deployment truss
    # footpad: a shallow dish
    k.lathe([(0, 0), (0.38, 0.0), (0.47, 0.08), (0.47, 0.16), (0.12, 0.2), (0, 0.2)], 24, 'mylar', m=Matrix.Translation(pad - Vector((0, 0, 0.12))))
    # lunar surface sensing probe (not on the ladder leg)
    if li != 0:
        rod(k, pad + Vector((0, 0, 0.05)) - d * 0.3, pad - d * 0.35 + Vector((0, 0, -0.12)) + Vector((0, 0, 0.001)), 0.012, 'strut', 4)

# ladder on the front (-y) leg, and the porch at the top
d = Vector((0, -1, 0)); t = Vector((1, 0, 0))
top = d * (W + 0.05) + Vector((0, 0, TOP - 0.15)); pad = d * PAD_R + Vector((0, 0, 0.24))
for s in (-1, 1):
    rod(k, top + t * (s * 0.38) + d * 0.08, pad + t * (s * 0.38) + d * 0.08 + Vector((0, 0, 0.35)), 0.025, 'strut', 6)
for i in range(9):
    f = (i + 0.5) / 9.3
    p = top.lerp(pad + Vector((0, 0, 0.35)), f) + d * 0.08
    rod(k, p - t * 0.38, p + t * 0.38, 0.018, 'strut', 5)
k.box(d * (W + 0.45) + Vector((0, 0, TOP - 0.08)), (1.05, 0.85, 0.05), 'mylar')            # porch
for s in (-1, 1):
    rod(k, d * (W + 0.05) + t * (s * 0.5) + Vector((0, 0, TOP - 0.05)), d * (W + 0.85) + t * (s * 0.5) + Vector((0, 0, TOP + 0.6)), 0.018, 'strut', 5)  # handrails
# MESA (equipment bay that swung down to the left of the ladder) folded closed: a silver panel
k.box(Vector((-1.05, -W - 0.04, BOT + 0.85)), (0.9, 0.05, 1.1), 'mylar')
# the plaque on the ladder leg: a small steel plate
k.box(top + d * 0.12 + Vector((0, 0, -0.35)), (0.24, 0.02, 0.16), 'strut', rot=(-0.5, 0, 0))
# US flag folded in its cover on the leg: small panel
k.box(Vector((0.9, -W - 0.04, BOT + 1.1)), (0.6, 0.04, 0.4), 'mylar')
# "UNITED STATES" was painted on the descent stage side: small lettering on the front-right foil
k.text('UNITED STATES', Matrix.Translation((W + 0.04, -0.2, TOP - 0.55)) @ Matrix.Rotation(math.pi / 2, 4, 'Z'), 0.16, 'black', depth=0.01)
save(k, 'lm_descent')


# ================= ASCENT STAGE =================
k = new()
# z = 0 is the descent stage top deck.
CZ = 1.55          # cabin axis height
CR = 1.18          # cabin radius
# Crew compartment: a drum lying across (axis along x), faceted front.
k.lathe([(0, -0.95), (CR, -0.95), (CR, -0.6), (CR, -0.2), (CR, 0.2), (CR, 0.6), (CR, 0.95), (0, 0.95)], 28, 'cabin',
        m=Matrix.Translation((0, 0.1, CZ)) @ Matrix.Rotation(math.pi / 2, 4, 'Y'),
        colors=lambda i, b: pick(PANEL))
# lower cabin block (midsection) down to the deck
pbox(k, (0, 0.2, 0.55), (2.3, 2.1, 1.1), BLANKET, cell=0.3)
crinkle(k, (-1.16, -0.86, 0.0), (2.32, 0, 0), (0, 0, 1.1), 10, 5, 0.04, BLANKET)
# faceted front face: a flat plate with the two triangular windows, tilted back a little
FY = -1.24
k.prism([(-1.0, 0.85), (1.0, 0.85), (1.15, 2.05), (0.5, 2.5), (-0.5, 2.5), (-1.15, 2.05)], 0.25, 'cabin',
        m=Matrix.Translation((0, FY + 0.1, 0)) @ Matrix.Rotation(-0.12, 4, 'X'))
for s in (-1, 1):  # windows: triangles, flat top edge, sloping down to the inner corner
    k.prism([(s * 0.14, 2.38), (s * 0.92, 2.22), (s * 0.14, 1.72)], 0.05, 'glass',
            m=Matrix.Translation((0, FY - 0.03, 0.02)) @ Matrix.Rotation(-0.12, 4, 'X'))
    k.prism([(s * 0.08, 2.44), (s * 1.0, 2.26), (s * 0.08, 1.62)], 0.035, 'dark',
            m=Matrix.Translation((0, FY - 0.01, 0.02)) @ Matrix.Rotation(-0.12, 4, 'X'))
# forward hatch (square) below the windows, with the black thermal blanket around it
k.box((0, FY - 0.05, 1.25), (0.95, 0.06, 0.95), 'black')
k.box((0, FY - 0.09, 1.25), (0.8, 0.04, 0.8), 'cabin2', bevel=0.03)
k.box((0.3, FY - 0.13, 1.25), (0.06, 0.05, 0.25), 'strut')                            # handle
k.box((0, FY - 0.4, 0.62), (1.0, 0.6, 0.06), 'mylar')                                   # top of the porch
# side fuel and oxidiser tanks bulging out (left/right), black-blanketed underneath
for s in (-1, 1):
    k.lathe([(0, -0.7), (0.5, -0.62), (0.68, -0.3), (0.72, 0), (0.68, 0.3), (0.5, 0.62), (0, 0.7)], 20,
            'cabin2', m=Matrix.Translation((s * 1.35, 0.45, 0.75)) @ Matrix.Rotation(math.pi / 2, 4, 'X'),
            colors=lambda i, b: 'black' if b < 2 else 'cabin2')
# aft equipment bay: a box behind the cabin with black radiator panels
pbox(k, (0, 1.65, 1.6), (2.6, 1.0, 1.5), PANEL, cell=0.32)
k.box((0, 2.17, 1.6), (2.4, 0.04, 1.3), 'black')
k.box((0, 1.4, 2.45), (1.6, 0.6, 0.2), 'cabin')
for s in (-1, 1):
    k.box((s * 1.32, 1.65, 1.6), (0.04, 0.9, 1.3), 'black')
# docking tunnel and drogue on top, plus the overhead rendezvous window
k.tube(Matrix.Translation((0, 0.15, CZ + CR - 0.1)), 0.44, 0.42, 'cabin', segs=24)
k.lathe([(0.44, CZ + CR + 0.32), (0.5, CZ + CR + 0.38), (0.5, CZ + CR + 0.42), (0.3, CZ + CR + 0.38), (0, CZ + CR + 0.26)], 24, 'dark',
        m=Matrix.Translation((0, 0.15, 0)))
k.box((0, -0.55, CZ + CR - 0.08), (0.35, 0.3, 0.06), 'glass', rot=(-0.5, 0, 0))
# RCS thruster quads at the four corners, each with four small bells
for sx in (-1, 1):
    for sy in (-1, 1):
        c = Vector((sx * 1.75, 0.3 + sy * 1.05, 2.2))
        rod(k, c - Vector((sx * 0.6, 0, 0.2)), c, 0.05, 'strut', 6)
        k.box(c, (0.3, 0.3, 0.3), 'dark', bevel=0.03)
        for dv in ((0, 0, 1), (0, 0, -1), (sx, 0, 0), (0, sy, 0)):
            dv = Vector(dv)
            rot = Vector((0, 0, 1)).rotation_difference(dv).to_matrix().to_4x4()
            k.tube(Matrix.Translation(c + dv * 0.15) @ rot, 0.05, 0.22, 'bell', segs=8, cap=False, r2=0.09)
        k.box(c + Vector((sx * 0.0, sy * 0.0, -0.4)), (0.55, 0.55, 0.03), 'mylar')     # plume deflector plate
# rendezvous radar dish (front top, on the right) and the steerable S-band dish (right side)
k.lathe([(0, -0.05), (0.32, 0.08), (0.34, 0.1), (0.0, 0.0)], 20, 'dish',
        m=Matrix.Translation((0.62, -0.75, CZ + CR + 0.3)) @ Matrix.Rotation(-0.9, 4, 'X'))
rod(k, (0.62, -0.5, CZ + CR - 0.1), (0.62, -0.72, CZ + CR + 0.28), 0.05, 'strut', 6)
rod(k, (1.2, 1.1, 2.4), (1.8, 1.4, 2.9), 0.03, 'strut', 6)
k.lathe([(0, -0.06), (0.42, 0.1), (0.44, 0.12), (0.0, 0.0)], 20, 'dish',
        m=Matrix.Translation((1.85, 1.42, 2.95)) @ Matrix.Rotation(0.6, 4, 'Y'))
# VHF antennas: two thin spikes
rod(k, (-0.9, 1.2, 2.4), (-1.35, 1.0, 3.3), 0.015, 'strut', 4)
rod(k, (0.9, 1.9, 0.6), (1.2, 2.5, -0.1), 0.015, 'strut', 4)
# ascent engine: short bell hidden under the cabin
k.lathe([(0.45, -0.25), (0.3, 0.05), (0.2, 0.2), (0.25, 0.35)], 20, 'bell', m=Matrix.Translation((0, 0.2, 0)))
# flag and lettering on the ascent stage front-left
for i in range(7):
    k.box((-0.72, FY - 0.03, 1.72 - i * 0.03), (0.32, 0.02, 0.03), 'red' if i % 2 == 0 else 'white')
k.box((-0.81, FY - 0.04, 1.66), (0.14, 0.02, 0.12), 'blue')
save(k, 'lm_ascent')
