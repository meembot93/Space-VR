# Apollo Command and Service Module ("Columbia"), stylized, for Era 3. One mesh, one material.
#   python3 tools/blender/apollo_csm.py [out.glb]
# Real sizes in metres: CM 3.9 m across, 3.2 m tall; SM 3.9 m across, 7.5 m with its engine bell.
# Origin = the centre of the CM's heat shield (the join with the service module). +z (glTF +y) = nose.
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # (loads mathutils)
from mathutils import Matrix, Vector, Euler
from kit import Kit, reset

reset()
k = Kit({
    'silver':   ((0.80, 0.81, 0.83), 0.28, 1.0),   # CM's polished skin
    'silver2':  ((0.66, 0.67, 0.70), 0.38, 1.0),   # its second strip tone
    'heat':     ((0.42, 0.27, 0.16), 0.85, 0.0),   # heat shield (bronze-brown ablator)
    'grey':     ((0.45, 0.46, 0.48), 0.55, 0.6),
    'dark':     ((0.12, 0.12, 0.13), 0.6, 0.3),
    'glass':    ((0.02, 0.03, 0.05), 0.08, 0.0),
    'white':    ((0.86, 0.86, 0.84), 0.55, 0.15),  # SM painted panels
    'white2':   ((0.76, 0.77, 0.77), 0.45, 0.5),   # SM radiators
    'line':     ((0.30, 0.31, 0.33), 0.6, 0.3),    # panel seams
    'bell':     ((0.20, 0.20, 0.22), 0.5, 0.5),    # engine bell, top
    'bell2':    ((0.55, 0.53, 0.50), 0.4, 0.8),    # engine bell, lower extension
    'inside':   ((0.04, 0.04, 0.04), 0.9, 0.0),
    'red':      ((0.70, 0.08, 0.08), 0.6, 0.0),
    'blue':     ((0.06, 0.12, 0.40), 0.6, 0.0),
    'flagwhite':((0.92, 0.92, 0.90), 0.6, 0.0),
    'gold':     ((0.85, 0.62, 0.20), 0.3, 1.0),    # foil on the antenna
})

R = 1.95                  # body radius
HALF = math.radians(33)   # cone half-angle
SEG = 48

# ---- Command module ----------------------------------------------------------------------------
cone_top = 0.15 + (R - 0.55) / math.tan(HALF)      # where the cone meets the nose shoulder
prof_heat = [(0, -0.22), (0.7, -0.19), (1.3, -0.12), (1.7, -0.04), (1.88, 0.02), (R, 0.08)]
k.lathe(prof_heat, SEG, 'heat')
k.lathe([(R, 0.08), (R - 0.01, 0.15)], SEG, 'grey')
# the cone in alternating strips, like the CM's reflective tape
k.lathe([(R - 0.01, 0.15), (1.35, 0.15 + (R - 1.35) / math.tan(HALF)), (0.55, cone_top)], SEG,
        colors=lambda i, b: 'silver' if i % 2 == 0 else 'silver2')
k.lathe([(0.55, cone_top), (0.47, cone_top + 0.08), (0.44, cone_top + 0.18), (0.44, cone_top + 0.5),
         (0.36, cone_top + 0.56), (0, cone_top + 0.57)], 32, 'grey')
# docking probe
tip = cone_top + 0.57
k.tube(Matrix.Translation((0, 0, tip)), 0.09, 0.45, 'dark', segs=10, cap=False, r2=0.05)
k.tube(Matrix.Translation((0, 0, tip + 0.45)), 0.05, 0.12, 'grey', segs=10, r2=0.0)
for a in range(3):   # the three probe arms
    ang = a * 2 * math.pi / 3
    m = Matrix.Translation((0.17 * math.cos(ang), 0.17 * math.sin(ang), tip + 0.02)) @ \
        Euler((0, -0.55, ang), 'ZYX').to_matrix().to_4x4()
    k.tube(Matrix.Translation((0, 0, tip)) @ Matrix.Rotation(ang, 4, 'Z') @ Matrix.Rotation(-0.75, 4, 'Y'),
           0.018, 0.33, 'dark', segs=6, cap=False)


def on_cone(ang, z, lift=0.0):
    """Matrix for a flat panel lying on the cone at angle ang (0 = +x), height z: its z = outward."""
    r = R - 0.01 - (z - 0.15) * math.tan(HALF)
    radial = Vector((math.cos(ang), math.sin(ang), 0))
    n = (radial * math.cos(HALF) + Vector((0, 0, math.sin(HALF)))).normalized()
    up = (Vector((0, 0, 1)) - radial * math.sin(HALF) * 0).normalized()
    side = n.cross(Vector((0, 0, 1))).normalized()
    upv = side.cross(n).normalized()
    pos = radial * r + Vector((0, 0, z)) + n * lift
    M = Matrix((side, upv, n)).transposed().to_4x4()
    return Matrix.Translation(pos) @ M


def window(ang, z, w, h):
    m = on_cone(ang, z, 0.0)
    k.box(None, (w + 0.08, h + 0.08, 0.05), 'grey', m=m @ Matrix.Diagonal((1, 1, 1, 1)), bevel=0.012)
    k.box(None, (w, h, 0.05), 'glass', m=m @ Matrix.Translation((0, 0, 0.012)))


front = math.radians(90)          # +y side faces the crew's "up" in this build: hatch + windows
window(front, 1.15, 0.36, 0.36)                     # hatch window
k.box(None, (0.75, 0.82, 0.03), 'silver2', m=on_cone(front, 1.1, 0.0), bevel=0.01)  # hatch
window(front + 0.62, 1.45, 0.30, 0.30)              # rendezvous windows (look forward)
window(front - 0.62, 1.45, 0.30, 0.30)
window(front + 1.15, 0.95, 0.34, 0.34)              # side windows
window(front - 1.15, 0.95, 0.34, 0.34)
# CM thrusters (small dark ports in pairs)
for a in (0.4, 2.0, 3.6, 5.2):
    for dz in (0, 0.14):
        k.box(None, (0.09, 0.09, 0.04), 'dark', m=on_cone(a, 1.55 + dz, 0.0))
# umbilical / attach points around the base
for i in range(6):
    k.box(None, (0.16, 0.08, 0.04), 'grey', m=on_cone(i * math.pi / 3 + 0.26, 0.24, 0.0))

# ---- Service module ----------------------------------------------------------------------------
SM_TOP, SM_BOT = -0.24, -6.9
k.lathe([(1.2, -0.21), (R - 0.03, SM_TOP + 0.02), (R, SM_TOP)], SEG, 'grey')   # fairing lip
k.lathe([(R, SM_TOP), (R, SM_TOP - 0.45)], SEG, 'white2')                       # top band
# body: 6 sectors; radiator panels on two of them, the rest white
def sm_col(i, b):
    sector = i * 6 // SEG
    return 'white2' if sector in (1, 4) and b == 1 else 'white'
k.lathe([(R, SM_TOP - 0.45), (R, -2.2), (R, -5.6), (R, SM_BOT)], SEG, colors=sm_col)
# seams between the sectors and round the body
for s in range(6):
    a = s * math.pi / 3
    k.box((R * math.cos(a), R * math.sin(a), (SM_TOP + SM_BOT) / 2), (0.05, 0.05, SM_TOP - SM_BOT - 0.4),
          'line', rot=(0, 0, a))
for z in (SM_TOP - 0.45, -5.6):
    k.lathe([(R + 0.012, z - 0.025), (R + 0.012, z + 0.025)], SEG, 'line')
# aft bulkhead and engine
k.lathe([(R, SM_BOT), (1.75, SM_BOT - 0.18), (1.1, SM_BOT - 0.32), (0.62, SM_BOT - 0.36)], SEG, 'grey')
bz = SM_BOT - 0.36
bell = [(0.55, bz), (0.48, bz - 0.25), (0.52, bz - 0.45), (0.7, bz - 0.9), (0.9, bz - 1.5),
        (1.08, bz - 2.1), (1.22, bz - 2.75)]
k.lathe(bell, 36, colors=lambda i, b: 'bell' if b < 3 else 'bell2')
k.lathe([(p[0] - 0.03, p[1]) for p in reversed(bell)], 36, 'inside')   # the inside of the bell
k.lathe([(1.22, bz - 2.75), (1.19, bz - 2.75)], 36, 'bell2')            # its rim
# RCS quads: four boxes near the top, each with four nozzles
for q in range(4):
    a = q * math.pi / 2 + math.pi / 4
    rad = Vector((math.cos(a), math.sin(a), 0)); side = Vector((-math.sin(a), math.cos(a), 0))
    c = rad * (R + 0.1) + Vector((0, 0, -1.25))
    M = Matrix((side, Vector((0, 0, 1)), rad)).transposed().to_4x4()
    k.box(None, (0.55, 0.6, 0.12), 'white2', m=Matrix.Translation(c) @ M, bevel=0.02)
    k.box(None, (0.3, 0.3, 0.12), 'grey', m=Matrix.Translation(c + rad * 0.1) @ M, bevel=0.02)
    for d in ((0, 0, 1), (0, 0, -1), (1, 0, 0), (-1, 0, 0)):
        dv = side * d[0] + Vector((0, 0, d[2]))
        base = c + rad * 0.12 + dv * 0.14
        z = dv.normalized(); x = rad; y = z.cross(x)
        Mn = Matrix((x, y, z)).transposed().to_4x4()
        k.tube(Matrix.Translation(base) @ Mn, 0.035, 0.14, 'dark', segs=8, cap=False, r2=0.06)
# high-gain antenna on its boom at the aft end
a = math.radians(-90)
rad = Vector((math.cos(a), math.sin(a), 0))
root = rad * R + Vector((0, 0, SM_BOT + 0.25))
Mb = Matrix((Vector((0, 0, 1)).cross(rad), Vector((0, 0, 1)), rad)).transposed().to_4x4()
k.tube(Matrix.Translation(root) @ Mb, 0.05, 1.1, 'grey', segs=8)
hub = root + rad * 1.1
for (dx, dz) in ((-0.33, 0.33), (0.33, 0.33), (-0.33, -0.33), (0.33, -0.33)):
    p = hub + Vector((0, 0, dz)) + Vector((0, 0, 1)).cross(rad) * dx
    Md = Matrix.Translation(p) @ Matrix((Vector((0, 0, 1)), rad.cross(Vector((0, 0, 1))), rad)).transposed().to_4x4()
    k.lathe([(0, 0.06), (0.15, 0.03), (0.3, 0.1)], 16, 'white', m=Md)
    k.lathe([(0.3, 0.1), (0.15, 0.03), (0, 0.06)], 16, 'gold', m=Md @ Matrix.Translation((0, 0, -0.012)))
# "UNITED STATES" and the flag, on the side facing +x
Mt = Matrix.Rotation(math.radians(90), 4, 'Z')
k.text('UNITED STATES', Mt @ Matrix.Translation((0, 0, -3.4)), 0.34, 'dark', depth=0.006, wrap_r=R)
fa = 0.0
for i in range(13):   # 13 stripes beside a blue canton, wrapped round the body above the lettering
    z = -2.35 - i * 0.042
    k.lathe([(R + 0.008, z - 0.042), (R + 0.008, z)], 40, a0=fa - 0.24, a1=fa + 0.24,
            colors=lambda s, b, i=i: ('blue' if (s < 16 and i < 7) else ('red' if i % 2 == 0 else 'flagwhite')))

out = sys.argv[-1] if sys.argv[-1].endswith('.glb') else os.path.join(os.path.dirname(__file__), 'out', 'apollo_csm.glb')
os.makedirs(os.path.dirname(out), exist_ok=True)
k.export(out)
