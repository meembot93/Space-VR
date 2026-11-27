# Era 3 spacecraft before Apollo, one GLB each (one mesh + one material = one draw call):
#   sputnik2.glb    Laika's Sputnik 2 (1957): cone frame, ball instrument sphere, her cabin at the base
#   explorer1.glb   Explorer 1 (1958): the pencil-thin US satellite on its last rocket stage
#   vostok.glb      Vostok (Gagarin, Tereshkova): the ball cabin on its double-cone service module
#   voskhod2.glb    Voskhod 2 (Leonov's spacewalk): the ball with the Volga inflatable airlock
#   mercury.glb     Mercury capsule (Shepard, Glenn) with its escape tower and retro pack
#   gemini.glb      Gemini: dark crew cabin on its white adapter, two hatches with windows
#   agena.glb       Agena target vehicle with its docking collar (Gemini 8 docking)
#   soyuz19.glb     Soyuz 19 (Apollo-Soyuz 1975): orbital ball, cabin, service module, two solar wings
# Each stands on its own origin (bottom centre), +z = nose, real sizes in metres.
#   python3 -I tools/blender/early_craft.py [out dir]
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # (loads mathutils)
from mathutils import Matrix, Vector
from kit import Kit, reset

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'era3')
os.makedirs(OUT, exist_ok=True)

PAL = {
    'white':  ((0.86, 0.86, 0.84), 0.55, 0.05),
    'white2': ((0.76, 0.77, 0.76), 0.55, 0.1),
    'black':  ((0.05, 0.05, 0.055), 0.6, 0.1),
    'shingle': ((0.10, 0.10, 0.11), 0.45, 0.6),
    'shingle2': ((0.16, 0.16, 0.17), 0.5, 0.6),
    'dark':   ((0.15, 0.15, 0.16), 0.55, 0.5),
    'grey':   ((0.48, 0.49, 0.50), 0.5, 0.5),
    'silver': ((0.80, 0.81, 0.83), 0.25, 1.0),
    'steel':  ((0.62, 0.62, 0.60), 0.35, 1.0),
    'gold':   ((0.85, 0.62, 0.22), 0.32, 1.0),
    'copper': ((0.62, 0.36, 0.20), 0.4, 1.0),
    'heat':   ((0.30, 0.22, 0.15), 0.8, 0.0),     # ablative heat shield
    'glass':  ((0.02, 0.03, 0.05), 0.08, 0.0),
    'red':    ((0.70, 0.08, 0.08), 0.6, 0.0),
    'blue':   ((0.06, 0.12, 0.40), 0.6, 0.0),
    'green':  ((0.32, 0.40, 0.28), 0.8, 0.0),     # Soviet green thermal blanket
    'green2': ((0.26, 0.33, 0.23), 0.85, 0.0),
    'panel':  ((0.08, 0.10, 0.22), 0.3, 0.4),     # solar cells
    'cloth':  ((0.70, 0.70, 0.66), 0.95, 0.0),    # airlock fabric
    'orange': ((0.80, 0.38, 0.10), 0.6, 0.0),
}


def new():
    reset()
    return Kit(PAL)


def rod(k, a, b, r, color, segs=6):
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    k.tube(Matrix.Translation(a) @ rot, r, d.length, color, segs=segs, cap=False)


def sphere(k, c, r, color, segs=24, rings=12, colors=None):
    prof = [(r * math.sin(math.pi * i / rings), -r * math.cos(math.pi * i / rings)) for i in range(rings + 1)]
    k.lathe(prof, segs, color, m=Matrix.Translation(c), colors=colors)


def save(k, name):
    tris = k.export(os.path.join(OUT, name + '.glb'))
    print(f'MODEL {name}: {tris} triangles')


def porthole(k, c, n, r, frame='steel'):
    """A round window on a surface at c facing direction n."""
    n = Vector(n).normalized()
    rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix().to_4x4()
    k.tube(Matrix.Translation(c) @ rot, r + 0.04, 0.03, frame, segs=16)
    k.tube(Matrix.Translation(Vector(c) + n * 0.02) @ rot, r, 0.02, 'glass', segs=16)


# ================= Sputnik 2 =================
k = new()
# the cone frame: a ribbed cone 4 m tall, open-looking via dark panels between silver ribs
k.lathe([(0.0, 0.0), (0.64, 0.0), (0.64, 0.8)], 32, 'silver')                  # Laika's pressurised cabin
k.lathe([(0.64, 0.8), (0.0, 0.8)], 32, 'steel')
for i in range(6):
    a = i * math.pi / 3
    k.box((0.65 * math.cos(a), 0.65 * math.sin(a), 0.4), (0.06, 0.06, 0.8), 'steel', rot=(0, 0, a))
for i in range(8):                                                                # frame ribs up the cone
    a = i * math.pi / 4
    rod(k, (1.0 * math.cos(a), 1.0 * math.sin(a), 0.8), (0.15 * math.cos(a), 0.15 * math.sin(a), 3.9), 0.035, 'steel')
for z, r in ((0.8, 1.0), (1.8, 0.75), (2.9, 0.43)):
    k.lathe([(r, z - 0.03), (r, z + 0.03)], 32, 'steel')
k.box((0, 0, 1.5), (0.9, 0.5, 0.7), 'gold', bevel=0.03)                          # instrument block (radiation counters)
k.lathe([(0, 2.2), (0.58 * 0.6, 2.25), (0.29, 2.5), (0.29, 2.6), (0.18, 2.75), (0, 2.8)], 24, 'steel')  # sun/UV instrument
sphere(k, (0, 0, 3.15), 0.29, 'silver')                                          # the Sputnik-1-style ball
for i in range(4):
    a = i * math.pi / 2 + 0.4
    rod(k, (0.25 * math.cos(a), 0.25 * math.sin(a), 3.2), (1.6 * math.cos(a), 1.6 * math.sin(a), 1.2), 0.012, 'steel', 4)
k.lathe([(0.15, 3.9), (0.0, 4.0)], 16, 'steel')
save(k, 'sputnik2')


# ================= Explorer 1 =================
k = new()
L = 2.03; R = 0.0795
k.lathe([(0, 0), (R, 0), (R, 1.0), (R, 1.5), (R * 0.85, 1.75), (R * 0.5, 1.95), (0, L)], 24,
        colors=lambda i, b: 'white' if b == 0 else (('white' if (i // 3) % 2 == 0 else 'black') if b == 1 else 'steel'))
for b, (z0, z1) in enumerate(((0.3, 0.45), (0.75, 0.82))):
    k.lathe([(R + 0.003, z0), (R + 0.003, z1)], 24, 'black')
k.lathe([(0, -0.6), (R, -0.6), (R, 0)], 24, 'steel')                             # the spent fourth stage
k.lathe([(0.04, -0.75), (R * 0.9, -0.6)], 16, 'dark')
for i in range(4):                                                                # whip antennas
    a = i * math.pi / 2
    rod(k, (R * math.cos(a), R * math.sin(a), 0.9), (0.6 * math.cos(a), 0.6 * math.sin(a), 0.55), 0.004, 'steel', 3)
save(k, 'explorer1')


# ================= Vostok =================
def vostok_body(k, volga=False):
    # service module: two cones back to back, gas bottles round the join
    k.lathe([(0, 0), (0.45, 0.0), (1.22, 1.05), (1.15, 1.2), (0.65, 1.95), (0, 1.95)], 32,
            colors=lambda i, b: 'silver' if b in (1, 2) else 'steel')
    for i in range(16):
        a = i * 2 * math.pi / 16
        sphere(k, (1.12 * math.cos(a), 1.12 * math.sin(a), 1.1), 0.18, 'grey', segs=10, rings=6)
    for i in range(8):                                                             # louvres (radiator shutters)
        a = (i + 0.5) * 2 * math.pi / 8
        k.box((0.92 * math.cos(a), 0.92 * math.sin(a), 1.55), (0.06, 0.32, 0.45), 'dark', rot=(0, 0.6, a))
    k.lathe([(0.2, -0.2), (0.12, 0.0)], 12, 'dark')                                # retro engine nozzle
    # the ball cabin, 2.3 m, with portholes, the hatch and the antennas
    c = Vector((0, 0, 1.95 + 1.15))
    sphere(k, c, 1.15, 'white2', segs=32, rings=16,
           colors=lambda i, b: 'white2' if (b + i // 4) % 2 else 'white')
    k.lathe([(0.75, 0.0), (0.6, 0.12)], 24, 'steel', m=Matrix.Translation((0, 0, 1.95)))
    for d in ((0.8, -0.8, 0.3), (-0.9, -0.5, -0.4), (0.2, 0.9, 0.6)):
        n = Vector(d).normalized()
        porthole(k, c + n * 1.15, n, 0.17)
    n = Vector((0, -1, 0.35)).normalized()
    hatch_c = c + n * 1.12
    rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix().to_4x4()
    k.tube(Matrix.Translation(hatch_c) @ rot, 0.5, 0.05, 'dark', segs=20)
    k.tube(Matrix.Translation(hatch_c) @ rot, 0.44, 0.07, 'white2', segs=20)
    k.tube(Matrix.Translation(c + Vector((0, 0, 1.12))), 0.12, 0.12, 'steel', segs=12)   # top connector
    for a, l in ((0.0, 1.4), (math.pi, 1.4)):                                     # whip antennas
        rod(k, c + Vector((0.4 * math.cos(a), 0.4 * math.sin(a), 1.05)), c + Vector((0.9 * math.cos(a), 0.9 * math.sin(a), 1.05 + l)), 0.012, 'steel', 3)
    for a in (math.pi / 2, -math.pi / 2):
        rod(k, Vector((0.5 * math.cos(a), 0.5 * math.sin(a), 1.95)), Vector((1.4 * math.cos(a), 1.4 * math.sin(a), 0.6)), 0.012, 'steel', 3)
    # straps that held the ball to the service module
    for i in range(4):
        a = i * math.pi / 2 + math.pi / 4
        rod(k, (0.95 * math.cos(a), 0.95 * math.sin(a), 1.4), c + Vector((0.95 * math.cos(a), 0.95 * math.sin(a), -0.55)), 0.03, 'steel', 4)
    k.text('CCCP', Matrix.Translation(c) @ Matrix.Rotation(-0.5, 4, 'Z'), 0.28, 'red', depth=0.01, wrap_r=1.16)
    return c


k = new()
vostok_body(k)
save(k, 'vostok')

# ================= Voskhod 2 =================
k = new()
c = vostok_body(k)
# backup solid retro rocket on top
k.tube(Matrix.Translation(c + Vector((0, 0, 1.15))), 0.32, 0.6, 'steel', segs=16)
k.lathe([(0, 0), (0.32, 0)], 16, 'dark', m=Matrix.Translation(c + Vector((0, 0, 1.75))))
# Volga airlock: a fabric cylinder sticking out sideways from the hatch, ringed with hoops
n = Vector((0, -1, 0.35)).normalized()
rot = Vector((0, 0, 1)).rotation_difference(n).to_matrix().to_4x4()
base = c + n * 1.05
prof = [(0.62, 0.0), (0.62, 0.25)]
for j in range(6):
    z = 0.3 + j * 0.36
    prof += [(0.6, z), (0.66, z + 0.06), (0.6, z + 0.12)]
prof += [(0.6, 2.45), (0.55, 2.5), (0.4, 2.55), (0, 2.56)]
k.lathe(prof, 24, 'cloth', m=Matrix.Translation(base) @ rot,
        colors=lambda i, b: 'steel' if b < 2 or b >= len(prof) - 4 else ('cloth' if b % 3 else 'white2'))
k.tube(Matrix.Translation(base + n * 2.56) @ rot, 0.34, 0.05, 'steel', segs=16)          # outer hatch
for i in range(3):
    a = i * 2 * math.pi / 3
    off = Vector((math.cos(a), math.sin(a), 0))
    rod(k, base + (rot @ off.to_4d()).to_3d() * 0.64, base + n * 2.0 + (rot @ off.to_4d()).to_3d() * 0.68, 0.04, 'grey', 6)  # gas bottles alongside
save(k, 'voskhod2')


# ================= Mercury =================
k = new()
# heat shield and retro pack at the bottom
k.lathe([(0, 0.0), (0.6, 0.02), (0.94, 0.08), (0.945, 0.14)], 32, 'heat')
k.lathe([(0, -0.35), (0.25, -0.35), (0.3, -0.05), (0.3, 0.0)], 18, 'steel')         # retro pack
for i in range(3):
    a = i * 2 * math.pi / 3
    rod(k, (0.27 * math.cos(a), 0.27 * math.sin(a), -0.2), (0.9 * math.cos(a), 0.9 * math.sin(a), 0.13), 0.025, 'steel', 4)
for i in range(3):
    a = i * 2 * math.pi / 3 + math.pi / 3
    k.lathe([(0.06, -0.42), (0.1, -0.33)], 8, 'dark', m=Matrix.Translation((0.16 * math.cos(a), 0.16 * math.sin(a), 0)))
# body: black corrugated shingles on the cone, cylinder neck, antenna canister
SEG = 40
k.lathe([(0.945, 0.14), (0.93, 0.2), (0.41, 1.95)], SEG, colors=lambda i, b: 'shingle' if i % 2 == 0 else 'shingle2')
k.lathe([(0.41, 1.95), (0.41, 2.55), (0.33, 2.62), (0.3, 2.62), (0.3, 3.0), (0.25, 3.08), (0.0, 3.1)], SEG,
        colors=lambda i, b: 'shingle2' if b < 2 else ('shingle' if b < 4 else 'dark'))
# window, hatch, lettering
TILT = -math.atan(0.535 / 1.75)
def on_cone(z, turn=0.0):
    r = 0.945 - (z - 0.2) * 0.535 / 1.75
    return Matrix.Rotation(turn, 4, 'Z') @ Matrix.Translation((0, -r - 0.012, z)) @ Matrix.Rotation(TILT, 4, 'X')
k.prism([(-0.21, -0.17), (0.21, -0.17), (0.15, 0.17), (-0.15, 0.17)], 0.03, 'steel', m=on_cone(1.55))
k.prism([(-0.17, -0.13), (0.17, -0.13), (0.12, 0.13), (-0.12, 0.13)], 0.05, 'glass', m=on_cone(1.55))
k.prism([(-0.33, -0.4), (0.33, -0.4), (0.26, 0.4), (-0.26, 0.4)], 0.03, 'shingle2', m=on_cone(0.8, math.pi / 2))
k.prism([(-0.3, -0.37), (0.3, -0.37), (0.23, 0.37), (-0.23, 0.37)], 0.034, 'dark', m=on_cone(0.8, math.pi / 2))
k.text('UNITED STATES', Matrix.Rotation(-0.25, 4, 'Z') @ Matrix.Translation((0, 0, 1.1)), 0.075, 'white', depth=0.005, wrap_r=0.66)
# escape tower: three-legged truss and the motor with three nozzles
for i in range(3):
    a = i * 2 * math.pi / 3
    rod(k, (0.26 * math.cos(a), 0.26 * math.sin(a), 3.05), (0.12 * math.cos(a), 0.12 * math.sin(a), 4.6), 0.03, 'red', 5)
for z in (3.5, 4.05):
    for i in range(3):
        a0 = i * 2 * math.pi / 3; a1 = a0 + 2 * math.pi / 3; r = 0.26 - (z - 3.05) * 0.09
        rod(k, (r * math.cos(a0), r * math.sin(a0), z), (r * math.cos(a1), r * math.sin(a1), z + 0.3), 0.018, 'red', 4)
k.lathe([(0.14, 4.6), (0.16, 4.75), (0.16, 6.2), (0.1, 6.5), (0.05, 6.8), (0, 6.82)], 18,
        colors=lambda i, b: 'white' if b in (1,) else 'steel')
for i in range(3):
    a = i * 2 * math.pi / 3
    k.tube(Matrix.Translation((0.13 * math.cos(a), 0.13 * math.sin(a), 4.85)) @ Matrix.Rotation(math.pi + 0.5, 4, Vector((-math.sin(a), math.cos(a), 0))), 0.035, 0.18, 'dark', segs=8, cap=False, r2=0.07)
save(k, 'mercury')


# ================= Gemini =================
k = new()
# white adapter (retro + equipment sections), with its ribs
AD = 2.3
k.lathe([(1.52, 0), (1.52, 0.1), (1.15, AD)], 48, colors=lambda i, b: 'white' if i % 6 else 'white2')
k.lathe([(1.5, 0.08), (0, 0.08)], 48, 'dark')
for z in (0.9, 1.6):
    r = 1.52 - (1.52 - 1.15) * z / AD
    k.lathe([(r + 0.015, z - 0.03), (r + 0.015, z + 0.03)], 48, 'white2')
for i in range(4):                                                                 # OAMS thrusters on the rim
    a = i * math.pi / 2 + math.pi / 4
    k.tube(Matrix.Translation((1.4 * math.cos(a), 1.4 * math.sin(a), 0.35)) @ Matrix.Rotation(math.pi / 2, 4, Vector((-math.sin(a), math.cos(a), 0))), 0.05, 0.14, 'dark', segs=8, cap=False, r2=0.09)
# reentry module: dark, bell-shaped, crew cabin then the narrow RCS / recovery nose
z0 = AD
k.lathe([(1.15, z0), (1.14, z0 + 0.1), (0.98, z0 + 0.9), (0.62, z0 + 1.65), (0.5, z0 + 1.7), (0.5, z0 + 2.3), (0.45, z0 + 2.4),
         (0.42, z0 + 3.0), (0.35, z0 + 3.2), (0.2, z0 + 3.3), (0, z0 + 3.32)], 48,
        colors=lambda i, b: ('shingle' if i % 2 == 0 else 'shingle2') if b < 3 else ('dark' if b < 6 else 'white2'))
# two big hatches with their windows on the front (-y)
for s in (-1, 1):
    m = Matrix.Translation((s * 0.38, 0, 0)) @ Matrix.Translation((0, -0.88, z0 + 0.55)) @ Matrix.Rotation(-0.45, 4, 'X')
    k.prism([(-0.32, 0.0), (0.32, 0.0), (0.26, 1.0), (-0.26, 1.0)], 0.04, 'shingle2', m=m)
    k.prism([(-0.14, 0.55), (0.14, 0.55), (0.12, 0.9), (-0.06, 0.92)], 0.06, 'glass', m=m @ Matrix.Translation((s * 0.04, 0, 0)))
k.text('UNITED STATES', Matrix.Translation((0, 0, z0 + 1.3)) @ Matrix.Rotation(math.pi / 2, 4, 'Z'), 0.09, 'white', depth=0.005, wrap_r=0.8)
k.box((0, 0.75, z0 + 0.9), (0.3, 0.02, 0.18), 'red', rot=(0.45, 0, 0))
save(k, 'gemini')


# ================= Agena =================
k = new()
R = 0.76
k.lathe([(0, 0), (0.25, 0.0), (0.45, 0.6), (R, 0.75), (R, 6.2), (R, 6.9)], 40,
        colors=lambda i, b: 'dark' if b == 3 else ('white' if b == 4 else 'grey'))
k.lathe([(0.15, -0.6), (0.38, -0.05), (0.25, 0.0)], 20, 'dark')                    # main engine bell
for i in range(2):                                                                 # gold foil bands
    k.lathe([(R + 0.005, 2.2 + i * 1.6), (R + 0.005, 2.6 + i * 1.6)], 40, 'gold')
# the docking cone (target docking adapter) at the front, with its status display
k.lathe([(R, 6.9), (0.66, 7.05), (0.66, 7.55), (0.95, 7.95), (0.88, 7.98), (0.5, 7.6), (0, 7.6)], 40,
        colors=lambda i, b: 'white2' if b < 3 else 'dark')
k.box((0.55, -0.48, 7.2), (0.35, 0.08, 0.25), 'dark', rot=(0, 0, -0.8))
for i, col in enumerate(('red', 'white', 'orange')):
    k.box((0.48 + i * 0.07, -0.55, 7.25), (0.05, 0.04, 0.05), col, rot=(0, 0, -0.8))
for a in (0.0, math.pi):                                                          # antennas
    rod(k, (R * math.cos(a), R * math.sin(a), 6.5), (1.3 * math.cos(a), 1.3 * math.sin(a), 6.9), 0.012, 'steel', 3)
save(k, 'agena')


# ================= Soyuz 19 =================
k = new()
# service module (bottom): cylinder 2.72 m with the green-grey skin, engine, radiators
RS = 1.36
k.lathe([(0, 0.0), (0.7, 0.0), (RS, 0.3), (RS, 2.26), (1.1, 2.4), (0, 2.4)], 40,
        colors=lambda i, b: 'green' if b in (1, 2) and i % 5 else ('green2' if b in (1, 2) else 'steel'))
k.lathe([(0.25, -0.3), (0.42, 0.0)], 18, 'dark')
for i in range(4):
    a = i * math.pi / 2 + math.pi / 4
    k.box((1.38 * math.cos(a), 1.38 * math.sin(a), 1.2), (0.05, 0.5, 1.7), 'white2', rot=(0, 0, a))
# two solar wings, each three panels, sticking out left and right
for s in (-1, 1):
    rod(k, (s * RS, 0, 1.6), (s * (RS + 0.35), 0, 1.6), 0.04, 'steel')
    for p in range(3):
        x0 = s * (RS + 0.35 + p * 1.1)
        k.box((x0 + s * 0.55, 0, 1.6), (1.05, 0.03, 1.3), 'panel')
        k.box((x0 + s * 0.55, 0.02, 1.6), (1.05, 0.01, 0.04), 'steel')
# descent module: the headlight-shaped crew cabin, dark green
z1 = 2.4
k.lathe([(1.08, z1), (1.1, z1 + 0.1), (1.05, z1 + 0.6), (0.85, z1 + 1.45), (0.4, z1 + 2.1), (0, z1 + 2.15)], 40,
        colors=lambda i, b: 'green2' if b else 'heat')
porthole(k, Vector((0, -0.95, z1 + 0.9)), (0, -1, 0.3), 0.12)
# orbital module: a ball with the APAS docking collar on the nose
z2 = z1 + 1.95
sphere(k, (0, 0, z2 + 1.13), 1.13, 'green', segs=32, rings=14, colors=lambda i, b: 'green' if (i // 4) % 2 else 'green2')
porthole(k, Vector((0.75, -0.75, z2 + 1.3)), (0.7, -0.7, 0.2), 0.1)
k.tube(Matrix.Translation((0, 0, z2 + 2.18)), 0.55, 0.25, 'steel', segs=24)
for i in range(3):                                                                 # APAS guide petals
    a = i * 2 * math.pi / 3
    k.prism([(-0.22, 0.0), (0.22, 0.0), (0.0, 0.42)], 0.04, 'steel',
            m=Matrix.Translation((0, 0, z2 + 2.43)) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z') @ Matrix.Translation((0, -0.42, 0)) @ Matrix.Rotation(0.3, 4, 'X'))
for a in (0.4, 2.2, 4.0):                                                          # antennas on the ball
    rod(k, (0.9 * math.cos(a), 0.9 * math.sin(a), z2 + 1.6), (1.5 * math.cos(a), 1.5 * math.sin(a), z2 + 2.2), 0.012, 'steel', 3)
k.text('CCCP', Matrix.Translation((0, 0, z1 + 0.3)) @ Matrix.Rotation(0.6, 4, 'Z'), 0.25, 'red', depth=0.01, wrap_r=1.08)
save(k, 'soyuz19')
