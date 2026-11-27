# The Saturn V's mobile launcher (Launch Complex 39): the grey platform with the exhaust hole and
# hold-down arms, the red umbilical tower with its hammerhead crane, and the nine swing arms reaching
# to the rocket (arm 9 = the crew access arm with the white room at the command module hatch).
#   launch_tower.glb   origin = ground under the rocket's centre. The rocket's bottom (saturn_s1c's
#                      origin) stands at z = ROCKET_Z (printed below); the tower sits behind it (+y in
#                      Blender = -z in the game). Real sizes in metres.
#   python3 -I tools/blender/launch_tower.py [out dir]
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # (loads mathutils)
from mathutils import Matrix, Vector
from kit import Kit, reset

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'era3')
os.makedirs(OUT, exist_ok=True)

PAL = {
    'red':    ((0.62, 0.12, 0.08), 0.7, 0.1),
    'red2':   ((0.48, 0.09, 0.06), 0.75, 0.1),
    'grey':   ((0.55, 0.55, 0.53), 0.85, 0.0),
    'grey2':  ((0.40, 0.40, 0.39), 0.85, 0.0),
    'dark':   ((0.12, 0.12, 0.13), 0.7, 0.2),
    'white':  ((0.86, 0.86, 0.84), 0.6, 0.0),
    'black':  ((0.04, 0.04, 0.045), 0.8, 0.0),
    'hose':   ((0.18, 0.18, 0.19), 0.6, 0.1),
    'steel':  ((0.55, 0.55, 0.57), 0.45, 0.8),
    'glass':  ((0.10, 0.14, 0.18), 0.2, 0.0),
}
DECK = 7.6                     # platform top above ground
ROCKET_Z = DECK + 1.0          # the S-IC's bottom rests on the hold-down arms here
TY0, TY1 = 13.0, 25.0          # tower spans these y (rocket axis at y = 0)
TX = 6.0                       # tower half-width in x
TOP = DECK + 118.0             # tower top (crane deck)
BAY = 6.0


def beam(k, a, b, w, color, h=None):
    """A square steel beam from a to b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((1, 0, 0)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    k.box(None, (d.length, w, h or w), color, m=Matrix.Translation((a + b) / 2) @ rot)


k = Kit(PAL)
reset()
k = Kit(PAL)

# ---- the platform: a big grey slab with the square exhaust hole under the rocket ----
PX0, PX1, PY0, PY1, HOLE = -24.5, 24.5, -16.0, 25.0, 7.0
k.box(((PX0 - HOLE) / 2, (PY0 + PY1) / 2, DECK / 2), (-HOLE - PX0, PY1 - PY0, DECK), 'grey')
k.box(((PX1 + HOLE) / 2, (PY0 + PY1) / 2, DECK / 2), (PX1 - HOLE, PY1 - PY0, DECK), 'grey')
k.box((0, (PY0 - HOLE) / 2, DECK / 2), (2 * HOLE, -HOLE - PY0, DECK), 'grey')
k.box((0, (PY1 + HOLE) / 2, DECK / 2), (2 * HOLE, PY1 - HOLE, DECK), 'grey')
k.box((0, 0, 0.6), (2 * HOLE - 0.2, 2 * HOLE - 0.2, 1.2), 'black')               # the dark pit below
# legs under the platform (the six pedestals it rests on at the pad)
for x in (-18, 0, 18):
    for y in (-10, 20):
        k.box((x, y, -0.0), (3, 3, 0.4), 'grey2')
# the platform's sides: rows of access doors and vents so the slab doesn't read as a plain block
for y, nx in ((PY0 - 0.03, -1), (PY1 + 0.03, 1)):
    for x in range(-22, 23, 4):
        k.box((x, y, 2.6), (2.2, 0.06, 3.0), 'grey2')
        k.box((x + 1.4, y, 5.6), (0.8, 0.06, 0.8), 'dark')
for x, sgn in ((PX0 - 0.03, -1), (PX1 + 0.03, 1)):
    for y in range(-14, 25, 4):
        k.box((x, y, 2.6), (0.06, 2.2, 3.0), 'grey2')
        k.box((x, y + 1.4, 5.6), (0.06, 0.8, 0.8), 'dark')
k.box((0, 0, DECK - 0.3), (2 * HOLE + 0.6, 2 * HOLE + 0.6, 0.6), 'dark')           # rim round the hole
# deck stripes / plates
for x in (-16, 16):
    k.box((x, 4, DECK + 0.02), (10, 26, 0.04), 'grey2')
# four hold-down arms round the hole, each a heavy wedge reaching to the rocket's base
for a in range(4):
    ang = math.pi / 4 + a * math.pi / 2
    d = Vector((math.cos(ang), math.sin(ang), 0))
    base = d * (HOLE + 1.6) + Vector((0, 0, DECK))
    tip = d * 4.6 + Vector((0, 0, ROCKET_Z))
    k.box(None, (2.4, 2.0, 1.6), 'grey2', m=Matrix.Translation(base + Vector((0, 0, 0.8))) @ Matrix.Rotation(ang, 4, 'Z'))
    beam(k, base + Vector((0, 0, 1.3)), tip, 1.0, 'grey2', h=0.8)
# three tail service masts beside the hole (they fed the first stage's bottom)
for x in (-9.5, 0, 9.5):
    p = Vector((x, -HOLE - 1.5 if x != 0 else HOLE + 1.5, DECK))
    if x == 0:
        continue
    k.box(p + Vector((0, 0, 2.5)), (1.6, 1.6, 5.0), 'red2')
    beam(k, p + Vector((0, 0, 4.6)), p * 0.55 + Vector((0, 0, ROCKET_Z + 3)), 0.5, 'hose')

# ---- the umbilical tower: four corner columns, a floor ring every bay, X-bracing on every face ----
cols = [(-TX, TY0), (TX, TY0), (TX, TY1), (-TX, TY1)]
for x, y in cols:
    k.box((x, y, (DECK + TOP) / 2), (0.9, 0.9, TOP - DECK), 'red')
z = DECK
level = 0
while z < TOP - 0.1:
    z1 = min(z + BAY, TOP)
    for i in range(4):
        (x0, y0), (x1, y1) = cols[i], cols[(i + 1) % 4]
        beam(k, (x0, y0, z1), (x1, y1, z1), 0.55, 'red')
        if i != 0 or level % 3 == 0:          # the rocket-facing face is more open
            beam(k, (x0, y0, z), (x1, y1, z1), 0.32, 'red2')
            beam(k, (x1, y1, z), (x0, y0, z1), 0.32, 'red2')
    # a mid-column on the two wide faces
    for x in (0,):
        for y in (TY0, TY1):
            beam(k, (x, y, z), (x, y, z1), 0.4, 'red')
    z = z1; level += 1
# floors every other bay (grating, so it reads as levels from far away)
for lv in range(0, 20, 2):
    zf = DECK + lv * BAY + BAY
    if zf < TOP:
        k.box((0, (TY0 + TY1) / 2, zf + 0.35), (2 * TX - 0.4, TY1 - TY0 - 0.4, 0.12), 'grey2')
# elevator shaft in the middle (two cars' housing) and the crane deck on top
k.box((0, (TY0 + TY1) / 2, (DECK + TOP) / 2), (3.2, 3.2, TOP - DECK), 'dark')
k.box((0, (TY0 + TY1) / 2, TOP + 0.5), (2 * TX + 1, TY1 - TY0 + 1, 1.0), 'red2')
k.box((0, (TY0 + TY1) / 2, TOP + 3.0), (4, 4, 4.0), 'red')             # crane cab and machinery
# hammerhead crane boom running across the top
beam(k, (-14, (TY0 + TY1) / 2, TOP + 6.0), (14, (TY0 + TY1) / 2, TOP + 6.0), 1.4, 'red')
beam(k, (-14, (TY0 + TY1) / 2, TOP + 7.2), (8, (TY0 + TY1) / 2, TOP + 7.2), 0.5, 'red2')
k.box((0, (TY0 + TY1) / 2, TOP + 8.0), (1.0, 1.0, 4.0), 'red')
for x in (-12, 12):
    beam(k, (0, (TY0 + TY1) / 2, TOP + 9.6), (x, (TY0 + TY1) / 2, TOP + 6.8), 0.2, 'dark')
k.box((-13, (TY0 + TY1) / 2, TOP + 4.0), (0.8, 0.8, 3.0), 'dark')       # hook block hanging
k.box((12, (TY0 + TY1) / 2, TOP + 5.0), (2.6, 2.0, 2.0), 'dark')        # counterweight
# warning beacons on top
for x, y in cols:
    k.box((x, y, TOP + 1.3), (0.4, 0.4, 0.6), 'white')

# ---- nine swing arms, red trusses from the tower face to the rocket ----
# (height above the rocket's bottom, reach to the rocket's skin radius, which stage)
ARMS = [(20.0, 5.05), (40.0, 5.05), (50.0, 5.05), (63.0, 5.05), (75.0, 5.05),
        (80.5, 3.3), (96.0, 3.3), (108.0, 1.95), (113.8, 1.4)]
for n, (h, rr) in enumerate(ARMS):
    zc = ROCKET_Z + h
    y0, y1 = TY0, rr + 0.5
    w, hh = (3.2, 3.2) if n < 8 else (2.4, 3.0)
    for sx in (-1, 1):
        for sz in (-1, 1):
            beam(k, (sx * w / 2, y0, zc + sz * hh / 2), (sx * w / 2, y1 + (1.6 if n == 8 else 0), zc + sz * hh / 2), 0.28, 'red')
    steps = max(2, int((y0 - y1) / 2.2))
    for s in range(steps):
        ya = y0 - (y0 - y1) * s / steps; yb = y0 - (y0 - y1) * (s + 1) / steps
        for sx in (-1, 1):
            beam(k, (sx * w / 2, ya, zc - hh / 2), (sx * w / 2, yb, zc + hh / 2), 0.16, 'red2')
        beam(k, (-w / 2, yb, zc + hh / 2), (w / 2, yb, zc + hh / 2), 0.16, 'red2')
    k.box((0, (y0 + y1) / 2, zc - hh / 2 + 0.1), (w - 0.3, y0 - y1, 0.12), 'grey2')          # walkway
    if n < 8:                                       # umbilical hoses drooping to the rocket
        for sx in (-0.8, 0.8):
            beam(k, (sx, y1 + 1.0, zc - hh / 2), (sx * 0.6, rr + 0.05, zc - hh / 2 - 1.2), 0.32, 'hose')
            k.box((sx * 0.6, rr + 0.12, zc - hh / 2 - 1.3), (0.7, 0.25, 0.7), 'dark')
    else:                                           # arm 9: the white room around the CM hatch
        k.box((0, rr + 1.6, zc + 0.2), (3.0, 2.6, 3.0), 'white', bevel=0.08)
        k.box((0, rr + 0.2, zc + 0.2), (1.6, 0.4, 2.0), 'white')
        k.box((0, rr + 2.95, zc + 0.6), (0.9, 0.06, 0.6), 'glass')

tris = k.export(os.path.join(OUT, 'launch_tower.glb'))
print(f'MODEL launch_tower: {tris} triangles  (rocket bottom at z = {ROCKET_Z} m)')
