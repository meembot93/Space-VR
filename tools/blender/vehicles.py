# Era 3 vehicles, one GLB each (one mesh + one material). Origin = ground under the centre, front = -y.
#   crawler.glb       the crawler-transporter that carried the launcher and Saturn V to the pad
#                     (40 x 35 m, deck top at z = DECK printed below; the launch_tower.glb sits on it)
#   lunar_rover.glb   the Apollo 15-17 lunar roving vehicle with its umbrella antenna and TV camera
#   python3 -I tools/blender/vehicles.py [out dir]
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # (loads mathutils)
from mathutils import Matrix, Vector
from kit import Kit, reset

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'era3')
os.makedirs(OUT, exist_ok=True)

PAL = {
    'body':   ((0.78, 0.78, 0.75), 0.75, 0.05),
    'body2':  ((0.62, 0.62, 0.60), 0.75, 0.05),
    'dark':   ((0.14, 0.14, 0.15), 0.6, 0.4),
    'track':  ((0.20, 0.19, 0.18), 0.8, 0.6),
    'black':  ((0.04, 0.04, 0.045), 0.7, 0.0),
    'glass':  ((0.08, 0.12, 0.16), 0.1, 0.0),
    'red':    ((0.70, 0.10, 0.08), 0.6, 0.0),
    'blue':   ((0.06, 0.12, 0.40), 0.6, 0.0),
    'yellow': ((0.85, 0.70, 0.15), 0.6, 0.0),
    'alu':    ((0.72, 0.72, 0.70), 0.4, 0.9),
    'mesh':   ((0.55, 0.55, 0.52), 0.75, 0.6),     # wire-mesh wheels and antenna
    'fender': ((0.45, 0.50, 0.58), 0.6, 0.2),
    'seat':   ((0.30, 0.42, 0.30), 0.8, 0.0),     # LRV seats: green-grey webbing
    'gold':   ((0.85, 0.62, 0.22), 0.32, 1.0),
    'panel':  ((0.20, 0.20, 0.22), 0.5, 0.3),
    'white':  ((0.88, 0.88, 0.86), 0.6, 0.0),
}


def rod(k, a, b, r, color, segs=6):
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    k.tube(Matrix.Translation(a) @ rot, r, d.length, color, segs=segs, cap=False)


def save(k, name, extra=''):
    tris = k.export(os.path.join(OUT, name + '.glb'))
    print(f'MODEL {name}: {tris} triangles {extra}')


# ================= crawler-transporter =================
reset(); k = Kit(PAL)
L, Wd = 40.0, 35.0
DECK = 6.1
k.box((0, 0, DECK - 1.6), (L * 0.9, Wd * 0.85, 3.2), 'body')                        # main body/deck
k.box((0, 0, DECK - 0.02), (L * 0.9, Wd * 0.85, 0.04), 'body2')
for s in (-1, 1):                                                                    # side girders with panel lines
    for i in range(10):
        k.box((-16 + i * 3.6, s * (Wd * 0.425 + 0.02), DECK - 1.6), (0.12, 0.04, 3.0), 'body2')
k.box((0, 0, DECK - 3.8), (L * 0.5, Wd * 0.5, 1.4), 'dark')                          # underside machinery
# four double-track trucks at the corners
for sx in (-1, 1):
    for sy in (-1, 1):
        cx, cy = sx * 13.5, sy * 12.0
        k.box((cx, cy, 2.6), (9.0, 7.0, 1.6), 'body2')                              # truck frame
        k.box((cx, cy, 3.9), (3.0, 3.0, 1.4), 'dark')                               # jacking cylinder housing
        for ty in (-1, 1):
            y = cy + ty * 2.3
            k.box((cx, y, 1.0), (10.4, 2.3, 1.7), 'track')                          # the track belt
            for i in range(14):                                                     # shoes
                k.box((cx - 5.0 + i * 0.77, y, 0.08), (0.6, 2.4, 0.16), 'track')
                k.box((cx - 5.0 + i * 0.77, y, 1.9), (0.6, 2.4, 0.12), 'track')
            for i in range(4):                                                      # rollers
                k.tube(Matrix.Translation((cx - 3.6 + i * 2.4, y - 1.2, 0.9)) @ Matrix.Rotation(-math.pi / 2, 4, 'X'), 0.6, 2.4, 'dark', segs=12)
# operator cabs on two corners, with their windows
for sx, sy in ((-1, -1), (1, 1)):
    c = Vector((sx * 17.0, sy * 15.8, DECK - 1.2))
    k.box(c, (3.0, 2.2, 2.0), 'body', bevel=0.05)
    k.box(c + Vector((0, -sy * 1.11, 0.3)), (2.6, 0.04, 0.8), 'glass')
    k.box(c + Vector((sx * 1.51, 0, 0.3)), (0.04, 1.8, 0.8), 'glass')
# railings round the deck, the exhaust stacks and the levelling marks
for sx in (-1, 1):
    rod(k, (sx * 18, -14.8, DECK + 1.0), (sx * 18, 14.8, DECK + 1.0), 0.04, 'yellow')
    for y in range(-14, 15, 2):
        rod(k, (sx * 18, y, DECK), (sx * 18, y, DECK + 1.0), 0.03, 'yellow')
for sy in (-1, 1):
    rod(k, (-18, sy * 14.8, DECK + 1.0), (18, sy * 14.8, DECK + 1.0), 0.04, 'yellow')
for x in (-6, 6):
    k.tube(Matrix.Translation((x, 13.5, DECK)), 0.35, 2.5, 'dark', segs=10)
for x in (-8, 8):                                                                    # pedestals the launcher sits on
    for y in (-8, 8):
        k.box((x, y, DECK + 0.4), (2.0, 2.0, 0.8), 'body2')
k.text('NASA', Matrix.Translation((0, -Wd * 0.425 - 0.03, DECK - 1.8)), 1.4, 'blue', depth=0.03)
save(k, 'crawler', f'(deck top z = {DECK + 0.8} with pedestals)')


# ================= lunar roving vehicle =================
reset(); k = Kit(PAL)
WB, TR, WR = 2.29, 1.83, 0.41        # wheelbase, track, wheel radius
Z = WR
k.box((0, 0, Z + 0.15), (1.1, 2.6, 0.12), 'alu')                                     # chassis
k.box((0, 0.2, Z + 0.3), (1.0, 1.0, 0.04), 'alu')                                    # floor under the seats
for sy in (-1, 1):
    for sx in (-1, 1):
        c = Vector((sx * TR / 2, sy * WB / 2, Z))
        rot = Matrix.Rotation(math.pi / 2, 4, 'Y')
        # wire-mesh wheel: tyre with chevron treads, open hub
        k.lathe([(0.12, -0.11), (WR - 0.03, -0.11), (WR, -0.08), (WR, 0.08), (WR - 0.03, 0.11), (0.12, 0.11)], 24,
                m=Matrix.Translation(c) @ rot, colors=lambda i, b: 'gold' if b == 2 and i % 3 == 0 else 'mesh')
        k.tube(Matrix.Translation(c - Vector((0.13, 0, 0))) @ rot, 0.12, 0.26, 'dark', segs=10)
        # fender: a curved arc over the top half of the wheel
        k.lathe([(WR + 0.06, -0.14), (WR + 0.06, 0.14)], 16, 'fender', m=Matrix.Translation(c) @ rot @ Matrix.Rotation(0, 4, 'Z'),
                a0=-0.1, a1=math.pi * 0.95)
        # suspension arms to the chassis
        rod(k, c - Vector((sx * 0.12, 0, 0)), Vector((sx * 0.5, sy * (WB / 2 - 0.25), Z + 0.15)), 0.03, 'alu')
        rod(k, c - Vector((sx * 0.12, 0, 0)), Vector((sx * 0.5, sy * (WB / 2 + 0.2), Z + 0.15)), 0.03, 'alu')
# two seats (webbing frames) and the control stick between them
for sx in (-1, 1):
    k.box((sx * 0.3, 0.2, Z + 0.42), (0.46, 0.5, 0.05), 'seat')
    k.box((sx * 0.3, 0.46, Z + 0.68), (0.46, 0.05, 0.5), 'seat', rot=(0.25, 0, 0))
    for y in (0.0, 0.42):
        rod(k, (sx * 0.3 - 0.22, y, Z + 0.3), (sx * 0.3 - 0.22, y, Z + 0.45), 0.015, 'alu')
    rod(k, (sx * 0.52, 0.0, Z + 0.55), (sx * 0.52, 0.42, Z + 0.55), 0.012, 'alu')   # armrest/handhold
rod(k, (0, -0.15, Z + 0.32), (0, -0.15, Z + 0.62), 0.02, 'black')                    # T-handle hand controller
k.box((0, -0.15, Z + 0.64), (0.12, 0.03, 0.03), 'black')
# control and display console at the front, on a post
rod(k, (0, -0.55, Z + 0.2), (0, -0.55, Z + 0.95), 0.03, 'alu')
k.box((0, -0.55, Z + 1.05), (0.46, 0.1, 0.3), 'panel', rot=(0.3, 0, 0))
k.box((-0.1, -0.61, Z + 1.07), (0.06, 0.02, 0.06), 'white', rot=(0.3, 0, 0))
k.box((0.1, -0.61, Z + 1.07), (0.12, 0.02, 0.06), 'white', rot=(0.3, 0, 0))
# front: the communications relay box, umbrella high-gain antenna and the TV camera on its mast
k.box((0, -1.25, Z + 0.4), (0.5, 0.3, 0.3), 'white', bevel=0.02)
rod(k, (0.25, -1.2, Z + 0.55), (0.25, -1.25, Z + 1.75), 0.02, 'alu')
k.lathe([(0.0, 0.0), (0.45, 0.16), (0.48, 0.18), (0.0, 0.03)], 16, 'mesh',
        m=Matrix.Translation((0.25, -1.25, Z + 1.75)) @ Matrix.Rotation(0.5, 4, 'X'))
for i in range(8):                                                                   # umbrella ribs
    a = i * math.pi / 4
    rod(k, (0.25, -1.25, Z + 1.75), Vector((0.25, -1.25, Z + 1.75)) + (Matrix.Rotation(0.5, 4, 'X') @ Vector((0.47 * math.cos(a), 0.47 * math.sin(a), 0.17)).to_4d()).to_3d(), 0.006, 'alu', 3)
rod(k, (-0.25, -1.2, Z + 0.55), (-0.25, -1.2, Z + 1.3), 0.02, 'alu')                 # camera mast
k.box((-0.25, -1.25, Z + 1.38), (0.14, 0.24, 0.14), 'gold')                          # TV camera (gold-wrapped)
k.tube(Matrix.Translation((-0.25, -1.37, Z + 1.38)) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 0.04, 0.08, 'black', segs=10)
rod(k, (-0.4, -1.1, Z + 0.55), (-0.45, -1.05, Z + 1.6), 0.008, 'alu', 3)               # low-gain antenna
k.lathe([(0.0, 0.0), (0.05, 0.25), (0.0, 0.3)], 8, 'alu', m=Matrix.Translation((-0.45, -1.05, Z + 1.6)))
# rear: the tool carrier / pallet
k.box((0, 1.25, Z + 0.45), (0.8, 0.35, 0.5), 'alu')
for i in range(4):
    k.box((-0.3 + i * 0.2, 1.25, Z + 0.78), (0.04, 0.3, 0.18), 'dark')
# the US flag decal on the front console box
k.box((0, -1.41, Z + 0.45), (0.16, 0.01, 0.1), 'red')
save(k, 'lunar_rover')
