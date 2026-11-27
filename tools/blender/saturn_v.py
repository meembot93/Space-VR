# The Saturn V for Era 3 (Apollo 8, 11, 13 and the rollout), one GLB per piece that comes apart in
# flight, each one mesh + one material (one draw call):
#   saturn_s1c.glb        first stage with its five F-1 engines, fins and engine fairings (42 m)
#   saturn_interstage.glb the ring between the first and second stage (drops away after staging)
#   saturn_s2.glb         second stage with five J-2s and the cone up to the third stage (24.9 + 5.8 m)
#   saturn_s4b.glb        third stage with its J-2 and the instrument ring on top (18.7 m)
#   saturn_sla.glb        the tapered adapter that hides the lunar module (8.5 m)
#   apollo_les.glb        the launch escape tower with its cover over the command module
#   f1_engine.glb         one F-1 engine for close-ups (5.8 m)
# Every piece stands on its own origin (its bottom centre, the engines hang below it), +z = up/nose.
# Real sizes in metres.   python3 -I tools/blender/saturn_v.py [out dir]
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # (loads mathutils)
from mathutils import Matrix, Vector
from kit import Kit, reset

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'era3')
os.makedirs(OUT, exist_ok=True)

PAL = {
    'white':  ((0.88, 0.88, 0.86), 0.55, 0.05),
    'white2': ((0.80, 0.81, 0.80), 0.5, 0.1),
    'black':  ((0.05, 0.05, 0.06), 0.6, 0.0),
    'rib':    ((0.70, 0.70, 0.69), 0.5, 0.1),
    'grey':   ((0.45, 0.46, 0.48), 0.5, 0.6),
    'dark':   ((0.14, 0.14, 0.15), 0.55, 0.5),
    'bell':   ((0.10, 0.10, 0.11), 0.5, 0.6),
    'bell2':  ((0.42, 0.41, 0.40), 0.45, 0.8),
    'inside': ((0.03, 0.03, 0.03), 0.9, 0.0),
    'pipe':   ((0.62, 0.60, 0.55), 0.35, 1.0),
    'gold':   ((0.80, 0.58, 0.22), 0.3, 1.0),
    'red':    ((0.70, 0.08, 0.08), 0.6, 0.0),
    'blue':   ((0.06, 0.12, 0.40), 0.6, 0.0),
    'flagw':  ((0.92, 0.92, 0.90), 0.6, 0.0),
    'orange': ((0.75, 0.22, 0.08), 0.55, 0.1),
    'silver': ((0.78, 0.79, 0.81), 0.3, 1.0),
}
SEG = 64
R1 = 5.05     # S-IC and S-II radius
R3 = 3.30     # S-IVB radius


def new():
    reset()
    return Kit(PAL)


def sectors(n, a='black', b='white', offset=0):
    """Colours alternating round the body in n sectors (the Saturn's black-and-white roll pattern)."""
    return lambda i, band: a if ((i * n // SEG) + offset) % 2 == 0 else b


def stringers(k, r, z0, z1, n, color='rib', w=0.09, d=0.05):
    for s in range(n):
        a = (s + 0.5) * 2 * math.pi / n
        k.box((r * math.cos(a), r * math.sin(a), (z0 + z1) / 2), (d, w, z1 - z0), color, rot=(0, 0, a))


def ring(k, r, z, h=0.12, color='rib', out=0.04):
    k.lathe([(r + out, z - h / 2), (r + out, z + h / 2)], SEG, color)


def bell(k, at, top_r, throat_r, exit_r, length, throat_at=0.18, segs=32, dark_frac=0.55, colors=('bell', 'bell2')):
    """An engine bell hanging down from `at` (a point): chamber, throat, then the flaring nozzle."""
    m = Matrix.Translation(at)
    zt = -length * throat_at
    prof = [(top_r, 0), (top_r, zt * 0.5), (throat_r, zt)]
    for i in range(1, 7):
        f = i / 6
        prof.append((throat_r + (exit_r - throat_r) * (1 - (1 - f) ** 1.7), zt + (-length - zt) * f))
    prof = list(reversed(prof))       # bottom to top
    nb = len(prof) - 1
    k.lathe(prof, segs, m=m, colors=lambda i, b: colors[1] if b < nb * (1 - dark_frac) else colors[0])
    k.lathe([(p[0] - 0.03, p[1]) for p in reversed(prof)], segs, 'inside', m=m)
    k.lathe([(exit_r, -length), (exit_r - 0.03, -length)], segs, colors[1], m=m)
    k.tube(m @ Matrix.Translation((0, 0, zt * 0.5)), top_r * 0.9, -zt * 0.5 + 0.4, 'dark', segs=12)


def letters(k, word, ang, z_top, h, color='black', r=R1):
    """Letters stacked one above another down the side (how 'UNITED STATES' runs on the S-IC)."""
    z = z_top
    for ch in word:
        if ch != ' ':
            k.text(ch, Matrix.Rotation(ang + math.pi / 2, 4, 'Z') @ Matrix.Translation((0, 0, z - h)), h, color, depth=0.02, wrap_r=r)
        z -= h * 1.18


def flag(k, ang, z, w_ang, h, r=R1):
    """A US flag wrapped on the body: 13 stripes and the blue canton, upright."""
    for i in range(13):
        z0 = z - (i + 1) * h / 13
        k.lathe([(r + 0.012, z0), (r + 0.012, z0 + h / 13)], 40, a0=ang - w_ang / 2, a1=ang + w_ang / 2,
                colors=lambda s, b, i=i: 'blue' if (s < 16 and i < 7) else ('red' if i % 2 == 0 else 'flagw'))


def f1(k, at):
    """One F-1: the big bell, its turbopump and the pipes round the chamber."""
    bell(k, at, 0.55, 0.48, 1.85, 5.6, throat_at=0.2, segs=36, dark_frac=0.62)
    p = Vector(at)
    k.tube(Matrix.Translation(p + Vector((0.75, 0, -1.6))), 0.32, 1.4, 'pipe', segs=12)        # turbopump
    k.tube(Matrix.Translation(p + Vector((0.75, 0, -0.2))), 0.22, 0.2, 'dark', segs=10)
    k.box(p + Vector((0, 0.62, -0.5)), (0.5, 0.25, 0.8), 'pipe', bevel=0.03)                  # gas generator
    for a in range(6):                                                                         # manifold ring
        aa = a * math.pi / 3
        k.box(p + Vector((0.6 * math.cos(aa), 0.6 * math.sin(aa), -1.25)), (0.18, 0.18, 0.5), 'pipe', rot=(0, 0, aa))
    k.lathe([(0.9, -1.55), (0.9, -1.35)], 24, 'pipe', m=Matrix.Translation(p))                # torus-ish manifold band
    k.lathe([(1.25, -2.4), (1.25, -2.25)], 32, 'bell2', m=Matrix.Translation(p))              # bell stiffener ring


def j2(k, at):
    bell(k, at, 0.35, 0.28, 1.0, 3.4, throat_at=0.22, segs=28, dark_frac=0.5, colors=('dark', 'bell'))
    k.tube(Matrix.Translation(Vector(at) + Vector((0.45, 0, -1.1))), 0.2, 0.9, 'pipe', segs=10)


def save(k, name):
    tris = k.export(os.path.join(OUT, name + '.glb'))
    print(f'MODEL {name}: {tris} triangles')


# ================= S-IC =================
k = new()
H1 = 42.0
def s1c_col(i, b):
    # bands: 0 aft skirt, 1 lower tank, 2 intertank, 3 upper tank, 4 forward skirt
    if b in (0, 2, 4):
        return sectors(8 if b != 0 else 4, offset=1 if b == 2 else 0)(i, b)
    return 'white'
k.lathe([(0, 0), (R1 * 0.7, 0), (R1, 0.25), (R1, 6.2), (R1, 20.8), (R1, 26.6), (R1, 38.9), (R1, H1)], SEG,
        colors=lambda i, b: 'dark' if b < 2 else s1c_col(i, b - 2))
for (z0, z1) in ((0.25, 6.2), (20.8, 26.6), (38.9, H1)):
    stringers(k, R1, z0, z1, 64)
for z in (6.2, 20.8, 26.6, 38.9, H1 - 0.06):
    ring(k, R1, z)
k.lathe([(R1, H1), (R1 - 0.3, H1), (0, H1)], SEG, 'grey')
# four fins and the conical fairings over the outer engines (at 45 degrees, with the outer engines)
for q in range(4):
    a = math.pi / 4 + q * math.pi / 2
    rad = Vector((math.cos(a), math.sin(a), 0)); up = Vector((0, 0, 1)); side = up.cross(rad)
    M = Matrix((rad, side, up)).transposed().to_4x4()
    k.lathe([(1.7, -0.9), (1.7, 0.0), (1.45, 3.0), (0.9, 6.5), (0.25, 8.6), (0, 8.7)], 24, 'white', m=Matrix.Translation(rad * (R1 - 0.35)))   # fairing
    # the fin: a swept slab standing out from the fairing
    k.prism([(0.0, -0.7), (3.3, -1.0), (3.3, 0.5), (0.0, 5.8)], 0.42, 'white', m=Matrix.Translation(rad * (R1 + 1.1)) @ M)
    k.prism([(3.25, -1.05), (3.45, -1.05), (3.45, 0.55), (3.25, 0.55)], 0.46, 'black', m=Matrix.Translation(rad * (R1 + 1.1)) @ M)
# heat shield and the five F-1s
k.lathe([(0, -0.15), (R1 - 0.2, -0.15), (R1 - 0.2, 0)], SEG, 'dark')
f1(k, (0, 0, -0.15))
for q in range(4):
    a = math.pi / 4 + q * math.pi / 2
    f1(k, (3.25 * math.cos(a), 3.25 * math.sin(a), -0.15))
# lettering: the flag over UNITED STATES down one side, USA on the opposite side
flag(k, 0.0, 37.5, 0.62, 2.0)
letters(k, 'UNITED STATES', 0.0, 34.6, 1.55)
letters(k, 'USA', math.pi, 18.5, 3.2)
save(k, 'saturn_s1c')

# ================= interstage (S-IC/S-II) =================
k = new()
k.lathe([(R1, 0), (R1, 5.5)], SEG, 'white')
k.lathe([(R1 - 0.05, 5.5), (R1 - 0.05, 0)], SEG, 'dark')
stringers(k, R1, 0.1, 5.4, 64)
ring(k, R1, 0.06); ring(k, R1, 5.44)
for q in range(8):                     # ullage motor fairings
    a = q * math.pi / 4 + math.pi / 8
    p = Vector((math.cos(a), math.sin(a), 0)) * (R1 + 0.12)
    k.lathe([(0.0, 0.6), (0.2, 1.0), (0.2, 3.2), (0.1, 3.6)], 10, 'white2', m=Matrix.Translation(p))
save(k, 'saturn_interstage')

# ================= S-II (with the cone up to the S-IVB) =================
k = new()
H2 = 24.9
k.lathe([(0, 0.4), (R1 * 0.8, 0.4), (R1, 0), (R1, 3.0), (R1, 21.4), (R1, H2)], SEG,
        colors=lambda i, b: 'dark' if b < 2 else ('white' if b != 3 else 'white'))
stringers(k, R1, 0.05, 3.0, 64); stringers(k, R1, 21.4, H2, 64)
for z in (0.06, 3.0, 21.4, H2 - 0.06):
    ring(k, R1, z)
for z in (6.5, 10.2, 13.9, 17.6):     # the tank's weld lines
    ring(k, R1, z, h=0.05, color='white2', out=0.01)
# the aft interstage cone to the S-IVB, its black roll stripes
k.lathe([(R1, H2), (R3 + 0.02, H2 + 5.8)], SEG, colors=sectors(4, 'white', 'white2'))
k.lathe([(R3 + 0.02, H2 + 5.8), (0, H2 + 5.8)], SEG, 'grey')
for q in range(4):
    a = q * math.pi / 2 + math.pi / 4
    p = Vector((math.cos(a), math.sin(a), 0))
    k.box(p * (R1 - 0.9) + Vector((0, 0, H2 + 2.9)), (0.12, 1.1, 5.9), 'black', rot=(0, -0.3, a))
k.lathe([(0, 0.0), (R1 - 0.3, 0.0)], SEG, 'dark')
j2(k, (0, 0, 0))
for q in range(4):
    a = math.pi / 4 + q * math.pi / 2
    j2(k, (2.6 * math.cos(a), 2.6 * math.sin(a), 0))
flag(k, 0.0, 19.5, 0.62, 2.0)
save(k, 'saturn_s2')

# ================= S-IVB with the instrument unit =================
k = new()
H3 = 17.8
k.lathe([(0, 0.3), (R3 * 0.7, 0.3), (R3, 0), (R3, 2.3), (R3, 15.9), (R3, H3), (R3, H3 + 0.91), (R3 - 0.2, H3 + 0.91), (0, H3 + 0.91)], SEG,
        colors=lambda i, b: 'dark' if b < 2 else (sectors(8)(i, b) if b == 2 else ('white' if b in (3, 4) else ('white2' if b == 5 else 'grey'))))
stringers(k, R3, 0.05, 2.3, 48); stringers(k, R3, 15.9, H3, 48)
for z in (0.05, 2.3, 15.9, H3):
    ring(k, R3, z)
k.lathe([(R3 + 0.03, H3 + 0.35), (R3 + 0.03, H3 + 0.55)], SEG, 'black')   # IU band
# the two APS thruster pods at the bottom
for s in (0, math.pi):
    p = Vector((math.cos(s), math.sin(s), 0))
    M = Matrix((Vector((0, 0, 1)).cross(p), Vector((0, 0, 1)), p)).transposed().to_4x4()
    k.box(None, (1.3, 2.0, 0.7), 'white', m=Matrix.Translation(p * (R3 + 0.3) + Vector((0, 0, 1.3))) @ M, bevel=0.15)
    k.box(None, (0.7, 0.5, 0.72), 'black', m=Matrix.Translation(p * (R3 + 0.3) + Vector((0, 0, 0.45))) @ M, bevel=0.06)
# a tunnel fairing down the side
k.box((0, R3 + 0.08, H3 / 2), (0.5, 0.25, H3 - 2.5), 'white2', bevel=0.08)
j2(k, (0, 0, 0))
letters(k, 'USA', 0.0, 13.5, 1.6, r=R3)
save(k, 'saturn_s4b')

# ================= SLA (the adapter round the lunar module) =================
k = new()
HS = 8.5
k.lathe([(R3, 0), (1.98, HS)], SEG, colors=lambda i, b: 'silver' if (i * 4 // SEG) % 2 == 0 else 'white2')
k.lathe([(1.95, HS), (R3 - 0.03, 0)], SEG, 'inside')
for q in range(4):                  # the seams where the four panels open
    a = q * math.pi / 2
    p0 = Vector((math.cos(a), math.sin(a), 0)) * (R3 + 0.02); p1 = Vector((math.cos(a), math.sin(a), 0)) * 2.0 + Vector((0, 0, HS))
    d = p1 - p0
    k.tube(Matrix.Translation(p0) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4(), 0.05, d.length, 'grey', segs=6, cap=False)
save(k, 'saturn_sla')

# ================= Launch escape tower =================
k = new()
# boost protective cover over the CM (same cone as the CM: 3.9 m across, 33 degree half-angle)
half = math.radians(33)
ctop = (1.96 - 0.5) / math.tan(half)
k.lathe([(2.03, -0.05), (2.08, 0.12), (0.6, ctop + 0.02), (0.38, ctop + 0.25), (0, ctop + 0.3)], 48, 'white')
for i in range(4):   # its little windows
    a = math.pi / 2 + (i - 1.5) * 0.5
    k.box((1.3 * math.cos(a), 1.3 * math.sin(a), 1.0), (0.22, 0.05, 0.22), 'black', rot=(0, 0, a + math.pi / 2))
# the truss: four legs and cross-bracing, in red
base = ctop + 0.2; top = base + 3.0
for q in range(4):
    a = q * math.pi / 2 + math.pi / 4
    p0 = Vector((math.cos(a), math.sin(a), 0)) * 0.55 + Vector((0, 0, base))
    p1 = Vector((math.cos(a), math.sin(a), 0)) * 0.38 + Vector((0, 0, top))
    d = p1 - p0
    rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    k.tube(Matrix.Translation(p0) @ rot, 0.045, d.length, 'red', segs=6, cap=False)
for lvl in range(4):
    z = base + lvl * 1.0; rr = 0.55 - lvl * (0.17 / 3)
    for q in range(4):
        a0 = q * math.pi / 2 + math.pi / 4; a1 = a0 + math.pi / 2
        p0 = Vector((math.cos(a0), math.sin(a0), 0)) * rr + Vector((0, 0, z))
        p1 = Vector((math.cos(a1), math.sin(a1), 0)) * rr + Vector((0, 0, z + (0.5 if lvl < 3 else 0)))
        d = p1 - p0
        k.tube(Matrix.Translation(p0) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4(), 0.03, d.length, 'red', segs=5, cap=False)
# the escape motor, the pitch motor and the nose with its canards
k.lathe([(0.5, top), (0.66, top + 0.5), (0.66, top + 4.2), (0.4, top + 4.9), (0.4, top + 5.6), (0.25, top + 6.4), (0.06, top + 6.9), (0, top + 6.95)], 32,
        colors=lambda i, b: 'black' if b in (0, 4, 5, 6) else 'white')
for q in range(4):                    # the escape motor's four nozzles
    a = q * math.pi / 2 + math.pi / 4
    p = Vector((math.cos(a), math.sin(a), 0)) * 0.48 + Vector((0, 0, top + 0.4))
    k.tube(Matrix.Translation(p) @ Matrix.Rotation(math.pi + 0.55, 4, Vector((-math.sin(a), math.cos(a), 0))), 0.1, 0.4, 'dark', segs=8, cap=False, r2=0.18)
for q in range(2):                    # canards, folded
    a = q * math.pi
    p = Vector((math.cos(a), math.sin(a), 0)) * 0.45 + Vector((0, 0, top + 5.0))
    k.box(p, (0.06, 0.45, 0.9), 'white', rot=(0, 0, a))
save(k, 'apollo_les')

# ================= F-1 close-up =================
k = new()
k.lathe([(0, 0), (1.0, 0), (1.0, 0.25), (0, 0.25)], 32, 'dark')    # gimbal mount
f1(k, (0, 0, 0))
save(k, 'f1_engine')
