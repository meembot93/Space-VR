# Era 3 rockets before the Saturn V (and the Soviet Moon rocket), one GLB each, booster only unless
# noted; the spacecraft sits on top at the height printed as "top" (its own GLB from early_craft.py).
#   juno1.glb            Juno I with its spinning upper stages and Explorer 1 (whole thing, 21 m)
#   mercury_redstone.glb Redstone booster for Shepard's flight (capsule on top)
#   mercury_atlas.glb    Atlas booster for Glenn's flight (capsule on top)
#   titan2_glv.glb       Titan II for Gemini (Gemini sits on top)
#   r7_vostok.glb        R-7 'Vostok' rocket: core, four strap-ons, upper stage and payload fairing
#   saturn_ib_s1.glb     Saturn IB first stage (Apollo 7, Skylab, Apollo-Soyuz); saturn_s4b + sla + CSM go on top
#   n1.glb               Soviet N1 Moon rocket (whole stack, 105 m)
# Origin = bottom centre (engines hang below), +z up, real sizes in metres.
#   python3 -I tools/blender/launchers.py [out dir]
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # (loads mathutils)
from mathutils import Matrix, Vector
from kit import Kit, reset

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'era3')
os.makedirs(OUT, exist_ok=True)

PAL = {
    'white':  ((0.88, 0.88, 0.86), 0.55, 0.05),
    'white2': ((0.78, 0.79, 0.78), 0.55, 0.1),
    'black':  ((0.05, 0.05, 0.055), 0.6, 0.1),
    'dark':   ((0.14, 0.14, 0.15), 0.55, 0.5),
    'grey':   ((0.50, 0.51, 0.52), 0.6, 0.3),
    'silver': ((0.80, 0.81, 0.83), 0.28, 1.0),
    'steel':  ((0.62, 0.62, 0.60), 0.35, 1.0),
    'bell':   ((0.12, 0.12, 0.13), 0.5, 0.6),
    'bell2':  ((0.42, 0.41, 0.40), 0.45, 0.8),
    'inside': ((0.03, 0.03, 0.03), 0.9, 0.0),
    'r7':     ((0.66, 0.68, 0.64), 0.75, 0.05),   # R-7 light grey-green
    'r7b':    ((0.56, 0.58, 0.54), 0.8, 0.05),
    'red':    ((0.70, 0.08, 0.08), 0.6, 0.0),
    'blue':   ((0.06, 0.12, 0.40), 0.6, 0.0),
    'flagw':  ((0.92, 0.92, 0.90), 0.6, 0.0),
    'orange': ((0.75, 0.22, 0.08), 0.55, 0.1),
}


def new():
    reset()
    return Kit(PAL)


def rod(k, a, b, r, color, segs=6):
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    k.tube(Matrix.Translation(a) @ rot, r, d.length, color, segs=segs, cap=False)


def bell(k, at, top_r, exit_r, length, segs=20, colors=('bell', 'bell2')):
    m = Matrix.Translation(at)
    prof = []
    for i in range(7):
        f = i / 6
        prof.append((top_r + (exit_r - top_r) * (f ** 1.6), -length * f))
    prof = list(reversed(prof))
    k.lathe(prof, segs, m=m, colors=lambda i, b: colors[1] if b < 2 else colors[0])
    k.lathe([(r - 0.02, z) for r, z in reversed(prof)], segs, 'inside', m=m)


def fin(k, ang, r, pts, depth, color):
    k.prism(pts, depth, color, m=Matrix.Rotation(ang, 4, 'Z') @ Matrix.Translation((r, 0, 0)))


def letters(k, word, ang, z_top, h, r, color='black'):
    z = z_top
    for ch in word:
        if ch != ' ':
            k.text(ch, Matrix.Rotation(ang + math.pi / 2, 4, 'Z') @ Matrix.Translation((0, 0, z - h)), h, color, depth=0.01, wrap_r=r)
        z -= h * 1.18


def flag(k, ang, z, w_ang, h, r):
    for i in range(13):
        z0 = z - (i + 1) * h / 13
        k.lathe([(r + 0.006, z0), (r + 0.006, z0 + h / 13)], 32, a0=ang - w_ang / 2, a1=ang + w_ang / 2,
                colors=lambda s, b, i=i: 'blue' if (s < 13 and i < 7) else ('red' if i % 2 == 0 else 'flagw'))


def save(k, name, top=None):
    tris = k.export(os.path.join(OUT, name + '.glb'))
    print(f'MODEL {name}: {tris} triangles' + (f'  (spacecraft sits at z = {top:.2f})' if top is not None else ''))


SEG = 40

# ================= Redstone family =================
def redstone(k, length, roll):
    R = 0.89
    # tail with four fins and the rudders, long tank, instrument section, adapter
    k.lathe([(0.0, 0.0), (R - 0.05, 0.0), (R, 0.1), (R, length)], SEG,
            colors=lambda i, b: 'white' if not roll else ('black' if (i * 4 // SEG) % 2 == 0 and b == 3 and False else 'white'))
    for z0, z1 in roll:                                      # black roll bands, half black half white
        k.lathe([(R + 0.004, z0), (R + 0.004, z1)], SEG, colors=lambda i, b: 'black' if (i * 4 // SEG) % 2 == 0 else 'white')
    for q in range(4):
        a = q * math.pi / 2 + math.pi / 4
        fin(k, a, R - 0.05, [(0, 0.0), (1.05, -0.15), (1.05, 0.55), (0, 2.6)], 0.1, 'white')
        fin(k, a, R + 0.95, [(0, -0.25), (0.06, -0.25), (0.06, 0.45), (0, 0.45)], 0.12, 'dark')
    bell(k, (0, 0, 0.05), 0.35, 0.52, 1.0)
    for q in range(4):                                       # jet vanes peeking out under the tail
        a = q * math.pi / 2
        k.box((0.4 * math.cos(a), 0.4 * math.sin(a), -1.0), (0.04, 0.3, 0.35), 'dark', rot=(0, 0, a))
    return R


# Juno I (Jupiter-C): Redstone, then the spinning tub of little rockets and Explorer 1 on the tip
k = new()
R = redstone(k, 17.0, [(3.0, 3.6), (12.5, 13.1)])
k.lathe([(R, 17.0), (R, 18.2), (0.55, 18.6), (0.5, 18.6)], SEG, colors=lambda i, b: 'white' if b < 1 else 'steel')
k.lathe([(0.5, 18.6), (0.5, 19.4), (0.0, 19.4)], 24, 'steel')                     # spin tub
for i in range(11):                                                                # 11 Sergeant rockets round the tub
    a = i * 2 * math.pi / 11
    k.tube(Matrix.Translation((0.36 * math.cos(a), 0.36 * math.sin(a), 18.5)), 0.08, 1.2, 'dark', segs=8)
k.lathe([(0, 19.4), (0.0795, 19.4), (0.0795, 20.4), (0.06, 20.9), (0.03, 21.2), (0, 21.25)], 16,
        colors=lambda i, b: 'white' if b < 2 and (i // 2) % 2 == 0 else ('black' if b < 2 else 'steel'))
letters(k, 'UNITED STATES ARMY', -0.4, 15.5, 0.45, R)
save(k, 'juno1')

# Mercury-Redstone: Redstone stretched, the black-and-white ring adapter, capsule on top
k = new()
R = redstone(k, 17.6, [(16.0, 16.6)])
k.lathe([(R, 17.6), (R, 18.8), (0.95, 19.0)], SEG, colors=lambda i, b: 'white2' if b == 0 else 'steel')
k.lathe([(0.95, 19.0), (0.0, 19.0)], SEG, 'dark')
letters(k, 'UNITED STATES', -0.4, 14.5, 0.55, R)
flag(k, -0.4, 6.0, 0.7, 0.75, R)
save(k, 'mercury_redstone', top=19.0)


# ================= Mercury-Atlas =================
k = new()
R = 1.525
# booster section (the skirt that dropped away) with the two booster engines and their fairings
k.lathe([(0.0, 0.0), (R + 0.2, 0.0), (R + 0.2, 2.8), (R, 3.2)], SEG, 'silver')
for s in (-1, 1):                                                                  # booster engine pods
    c = Vector((s * 1.25, 0, 0))
    k.lathe([(0.0, 0.0), (0.82, 0.0), (0.82, 2.4), (0.6, 3.6), (0, 3.8)], 20, 'silver', m=Matrix.Translation(c))
    bell(k, c + Vector((0, 0, 0.05)), 0.4, 0.7, 1.5)
bell(k, (0, 0, 0.05), 0.3, 0.5, 1.4)                                               # sustainer in the middle
for s in (-1, 1):                                                                  # vernier engines on the sides
    k.tube(Matrix.Translation((0, s * (R + 0.1), 6.0)) @ Matrix.Rotation(math.pi, 4, 'X'), 0.08, 0.35, 'dark', segs=8, cap=False, r2=0.14)
# the balloon tank: one shiny steel cylinder tapering at the top
k.lathe([(R, 3.2), (R, 18.5), (1.2, 20.4), (0.95, 21.0)], SEG, colors=lambda i, b: 'silver' if (i % 5) else 'steel')
for z in (8.0, 13.5):
    k.lathe([(R + 0.01, z - 0.04), (R + 0.01, z + 0.04)], SEG, 'steel')
k.lathe([(0.95, 21.0), (0.95, 21.9), (0.0, 21.9)], SEG, colors=lambda i, b: 'white2' if b == 0 else 'dark')     # capsule adapter
k.tube(Matrix.Translation((0, R - 0.1, 4.0)), 0.12, 14.0, 'steel', segs=8)         # cable tunnel up the side
letters(k, 'UNITED STATES', -0.35, 17.0, 0.7, R)
flag(k, -0.35, 7.6, 0.6, 0.9, R)
save(k, 'mercury_atlas', top=21.9)


# ================= Titan II GLV =================
k = new()
R = 1.525
# first stage: white tank with the black lower skirt, two engines
k.lathe([(0.0, 0.0), (R - 0.1, 0.0), (R, 0.15), (R, 3.0), (R, 19.0), (R, 21.0)], SEG,
        colors=lambda i, b: 'black' if b <= 1 else ('white' if b != 4 else 'white2'))
for s in (-1, 1):
    bell(k, (s * 0.72, 0, 0.1), 0.35, 0.68, 2.6)
k.tube(Matrix.Translation((0, R - 0.05, 2.0)), 0.13, 18.0, 'white2', segs=8)        # conduit
# open truss interstage (you could see the second-stage engine through it)
Z2 = 21.0
for i in range(12):
    a = i * 2 * math.pi / 12; b = (i + 1) * 2 * math.pi / 12
    rod(k, (R * math.cos(a), R * math.sin(a), Z2), (R * math.cos(b), R * math.sin(b), Z2 + 1.4), 0.05, 'dark')
    rod(k, (R * math.cos(b), R * math.sin(b), Z2), (R * math.cos(a), R * math.sin(a), Z2 + 1.4), 0.05, 'dark')
bell(k, (0, 0, Z2 + 1.4), 0.3, 0.9, 1.3)
# second stage and the Gemini adapter ring
k.lathe([(R, Z2 + 1.4), (R, Z2 + 7.2), (0.0, Z2 + 7.2)], SEG, colors=lambda i, b: 'white' if b == 0 else 'dark')
k.lathe([(R + 0.01, Z2 + 3.0), (R + 0.01, Z2 + 3.6)], SEG, colors=lambda i, b: 'black' if (i * 4 // SEG) % 2 == 0 else 'white')
letters(k, 'UNITED STATES', -0.4, 17.5, 0.7, R)
flag(k, -0.4, 7.5, 0.6, 0.9, R)
for q in range(2):
    a = q * math.pi + math.pi / 2
    k.box((R * math.cos(a), R * math.sin(a), 20.6), (0.2, 0.2, 0.6), 'dark', rot=(0, 0, a))
save(k, 'titan2_glv', top=Z2 + 7.2)


# ================= R-7 'Vostok' =================
k = new()
RC = 1.47
# core stage (Block A): narrow waist below the strap-ons' noses, wider tank, then the truss to stage 2
k.lathe([(0.0, 0.0), (1.1, 0.0), (1.1, 1.0), (RC, 3.0), (RC, 17.0), (1.35, 19.5), (1.08, 23.2), (1.08, 26.0)], SEG,
        colors=lambda i, b: 'r7' if (i // 5) % 2 else 'r7b')
for i in range(4):                                                                 # four core engine bells
    a = i * math.pi / 2 + math.pi / 4
    bell(k, (0.45 * math.cos(a), 0.45 * math.sin(a), 0.0), 0.2, 0.36, 1.3, segs=14)
# the four strap-ons: cones narrowing up to a point against the core
for q in range(4):
    a = q * math.pi / 2
    c = Vector((math.cos(a), math.sin(a), 0)) * (RC + 1.35)
    prof = [(0.0, 0.0), (1.34, 0.0), (1.34, 1.8), (1.05, 8.0), (0.6, 15.5), (0.25, 19.2), (0.0, 19.6)]
    rings = k.lathe(prof, 24, m=Matrix.Translation(c) @ Matrix.Translation(-Vector((math.cos(a), math.sin(a), 0)) * 0.25),
                    colors=lambda i, b: 'r7' if (i // 4) % 2 else 'r7b')
    lean = Vector((math.cos(a), math.sin(a), 0))
    for v in {v for ring in rings for v in ring}:            # lean the nose in so it rests against the core
        v.co -= lean * (1.05 * (v.co.z / 19.6) ** 1.4)
    for j in range(4):
        aa = j * math.pi / 2 + math.pi / 4
        bell(k, c + Vector((0.45 * math.cos(aa), 0.45 * math.sin(aa), 0.0)), 0.2, 0.36, 1.3, segs=12)
    # the triangular air rudder on the outside of each strap-on
    d = Vector((math.cos(a), math.sin(a), 0))
    k.prism([(0.0, 0.0), (0.9, 0.0), (0.0, 1.4)], 0.08, 'r7b', m=Matrix.Translation(c + d * 1.3) @ Matrix.Rotation(a, 4, 'Z'))
# open truss between core and upper stage (Block E)
Z = 26.0
for i in range(10):
    a = i * 2 * math.pi / 10; b = (i + 1) * 2 * math.pi / 10
    rod(k, (1.08 * math.cos(a), 1.08 * math.sin(a), Z), (1.29 * math.cos(b), 1.29 * math.sin(b), Z + 1.0), 0.05, 'dark')
bell(k, (0, 0, Z + 1.0), 0.18, 0.4, 0.8, segs=12)
k.lathe([(1.29, Z + 1.0), (1.29, Z + 3.9)], SEG, 'r7')
# payload fairing: cylinder, then a cone with the round windows Gagarin's ball looked out of
k.lathe([(1.29, Z + 3.9), (1.29, Z + 6.8), (1.25, Z + 7.2), (0.6, Z + 10.4), (0.25, Z + 11.4), (0, Z + 11.5)], SEG, 'white2')
for i in range(3):
    a = i * 2 * math.pi / 3 - math.pi / 2
    k.tube(Matrix.Translation((1.26 * math.cos(a), 1.26 * math.sin(a), Z + 5.6)) @ Matrix.Rotation(math.pi / 2, 4, Vector((-math.sin(a), math.cos(a), 0))), 0.18, 0.05, 'dark', segs=12)
k.text('CCCP', Matrix.Rotation(-0.6, 4, 'Z') @ Matrix.Translation((0, 0, 12.0)), 1.0, 'red', depth=0.02, wrap_r=RC)
save(k, 'r7_vostok')


# ================= Saturn IB first stage =================
k = new()
# eight 1.78 m tanks round a 2.67 m centre tank, alternating white and black-white, eight fins, eight H-1s
H = 24.5
k.lathe([(0, 0.0), (1.34, 0.0), (1.34, H - 1.0), (0.9, H - 0.2), (0, H - 0.1)], 24, 'white2')
for i in range(8):
    a = i * 2 * math.pi / 8
    c = Vector((math.cos(a), math.sin(a), 0)) * 2.2
    k.lathe([(0, 0.0), (0.89, 0.0), (0.89, H - 1.6), (0.6, H - 0.7), (0, H - 0.5)], 18, m=Matrix.Translation(c),
            colors=(lambda s, b: 'white') if i % 2 == 0 else (lambda s, b: 'black' if b == 1 and s < 9 else 'white'))
# tail unit and thrust structure
k.lathe([(0, 0.0), (3.3, 0.0), (3.3, 2.2), (3.1, 2.5)], 48, colors=lambda i, b: 'white' if b == 1 else 'dark')
for i in range(8):
    a = i * 2 * math.pi / 8 + math.pi / 8
    bell(k, (math.cos(a) * (1.75 if i % 2 else 2.4), math.sin(a) * (1.75 if i % 2 else 2.4), 0.0), 0.32, 0.55, 1.9, segs=16)
    fin(k, a, 3.25, [(0, -0.4), (2.0, -0.6), (2.0, 0.8), (0, 3.2)], 0.15, 'white')
# spider beam and the adapter flare up to the S-IVB (6.6 m)
k.lathe([(3.1, H - 0.3), (3.3, H + 0.3), (3.3, H + 1.8)], 48, colors=lambda i, b: 'white' if b == 1 else 'grey')
k.lathe([(3.3, H + 1.8), (0.0, H + 1.8)], 48, 'dark')
letters(k, 'UNITED STATES', -0.35, H - 2.0, 0.8, 3.1)
k.lathe([(3.12, 6.0), (3.12, 17.0)], 48, a0=-0.7, a1=0.05, colors=lambda i, b: 'white')     # skin over the tanks where the letters sit
save(k, 'saturn_ib_s1', top=H + 1.8)


# ================= N1 =================
k = new()
# Block A: the great cone, 17 m at the base, 30 engines in two rings
A = 30.1
k.lathe([(0, 0.0), (8.4, 0.0), (8.4, 1.0), (7.6, 6.0), (6.6, 12.0), (5.5, 19.0), (5.2, 24.0), (5.0, A)], 64,
        colors=lambda i, b: 'white' if b in (0, 1, 4, 5) else ('white2' if i % 2 else 'white'))
k.lathe([(8.42, 6.0), (7.62, 6.0), (7.62, 6.5), (8.42, 6.5)][:2] + [(7.55, 6.6)], 64, 'grey')
for i in range(24):
    a = i * 2 * math.pi / 24
    bell(k, (7.4 * math.cos(a), 7.4 * math.sin(a), 0.0), 0.35, 0.6, 1.6, segs=12)
for i in range(6):
    a = i * 2 * math.pi / 6
    bell(k, (2.5 * math.cos(a), 2.5 * math.sin(a), 0.0), 0.35, 0.6, 1.6, segs=12)
for i in range(4):                                                                 # lattice grid fins
    a = i * math.pi / 2 + math.pi / 4
    m = Matrix.Rotation(a, 4, 'Z') @ Matrix.Translation((8.6, 0, 1.5))
    k.box(None, (1.6, 0.12, 3.2), 'grey', m=m)
    for g in range(4):
        k.box(None, (0.06, 0.6, 3.2), 'dark', m=m @ Matrix.Translation((-0.6 + g * 0.4, 0, 0)))
# open truss interstage to Block B, then Block B, Block V, the lunar stages under the shroud
def truss(z, r0, r1, h, n=16):
    for i in range(n):
        a = i * 2 * math.pi / n; b = (i + 1) * 2 * math.pi / n
        rod(k, (r0 * math.cos(a), r0 * math.sin(a), z), (r1 * math.cos(b), r1 * math.sin(b), z + h), 0.08, 'dark')
truss(A, 5.0, 4.8, 2.0)
B = A + 2.0
k.lathe([(4.8, B), (4.2, B + 6.0), (3.5, B + 13.5), (3.5, B + 18.0)], 56, colors=lambda i, b: 'white' if (i // 7) % 2 or b != 1 else 'white2')
truss(B + 18.0, 3.5, 3.0, 1.6)
V = B + 19.6
k.lathe([(3.0, V), (2.95, V + 9.0), (2.95, V + 11.0)], 48, colors=lambda i, b: 'white' if b == 0 else 'white2')
G = V + 11.0
k.lathe([(2.95, G), (2.95, G + 4.0), (2.3, G + 6.0), (2.3, G + 18.0), (1.8, G + 21.0), (0.9, G + 23.0), (0, G + 23.4)], 48,
        colors=lambda i, b: 'white' if b in (0, 2) else 'grey')
k.lathe([(0.5, G + 23.4), (0.5, G + 24.0), (0.0, G + 24.0)], 16, 'grey')
for q in range(4):                                                                 # escape tower legs and motor
    a = q * math.pi / 2
    rod(k, (0.8 * math.cos(a), 0.8 * math.sin(a), G + 22.6), (0.3 * math.cos(a), 0.3 * math.sin(a), G + 25.5), 0.05, 'dark')
k.lathe([(0.4, G + 25.5), (0.5, G + 26.0), (0.5, G + 30.5), (0.25, G + 32.0), (0, G + 32.4)], 18, 'white2')
k.text('CCCP', Matrix.Rotation(-0.4, 4, 'Z') @ Matrix.Translation((0, 0, B + 8.0)), 2.0, 'red', depth=0.03, wrap_r=3.9)
save(k, 'n1')
