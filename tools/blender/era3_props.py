# Era 3 small props, one GLB each (one mesh + one material). Real sizes in metres, origin = bottom
# centre (helmets: the neck ring's centre), front = -y in Blender (+z in the game).
#   helmet_sk1.glb      Gagarin's SK-1: white hard shell, red-orange 'CCCP' cover, round visor
#   helmet_mercury.glb  Mercury: silver, round visor, the microphone boom inside
#   helmet_gemini.glb   Gemini: white with the wide visor
#   helmet_apollo.glb   Apollo moonwalk: clear bubble under the white visor assembly, gold visor down
#   helmet_berkut.glb   Leonov's Berkut (Voskhod 2): white shell with the sun filter
#   apollo_couch.glb    one Apollo crew couch
#   dsky.glb            Apollo guidance computer keypad and display
#   hand_controller.glb Apollo rotation hand controller (pistol grip)
#   hasselblad.glb      the moon camera on its chest bracket
#   flag_1969.glb       the Apollo 11 flag on its pole with the top crossbar
#   seismometer.glb     passive seismic experiment with its two solar wings
#   laser_reflector.glb the retroreflector array on its tilted stand
#   python3 -I tools/blender/era3_props.py [out dir]
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # (loads mathutils)
from mathutils import Matrix, Vector
from kit import Kit, reset

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'era3')
os.makedirs(OUT, exist_ok=True)

PAL = {
    'white':  ((0.90, 0.90, 0.88), 0.5, 0.05),
    'white2': ((0.78, 0.78, 0.76), 0.55, 0.05),
    'black':  ((0.04, 0.04, 0.045), 0.6, 0.1),
    'dark':   ((0.14, 0.14, 0.15), 0.5, 0.5),
    'grey':   ((0.45, 0.46, 0.47), 0.55, 0.4),
    'silver': ((0.82, 0.83, 0.85), 0.22, 1.0),
    'steel':  ((0.62, 0.62, 0.60), 0.35, 1.0),
    'alu':    ((0.70, 0.70, 0.68), 0.45, 0.8),
    'gold':   ((0.95, 0.70, 0.25), 0.12, 1.0),    # gold visor, mirror-like
    'foil':   ((0.85, 0.62, 0.22), 0.32, 1.0),
    'glass':  ((0.03, 0.04, 0.06), 0.05, 0.0),
    'red':    ((0.72, 0.10, 0.08), 0.6, 0.0),
    'orange': ((0.85, 0.35, 0.08), 0.6, 0.0),
    'blue':   ((0.06, 0.12, 0.40), 0.6, 0.0),
    'flagw':  ((0.93, 0.93, 0.91), 0.8, 0.0),
    'green':  ((0.35, 0.85, 0.40), 0.4, 0.0),     # DSKY numbers
    'panel':  ((0.08, 0.10, 0.22), 0.3, 0.4),
    'fabric': ((0.80, 0.80, 0.76), 0.95, 0.0),
    'rubber': ((0.10, 0.10, 0.10), 0.9, 0.0),
}


def new():
    reset()
    return Kit(PAL)


def rod(k, a, b, r, color, segs=8):
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    k.tube(Matrix.Translation(a) @ rot, r, d.length, color, segs=segs, cap=False)


def save(k, name):
    tris = k.export(os.path.join(OUT, name + '.glb'))
    print(f'MODEL {name}: {tris} triangles')


def dome(k, c, rx, ry, rz, color, segs=32, rings=12, z0=-0.2, colors=None, sx=1.0):
    """An egg-ish shell: a sphere scaled by rx/ry/rz from latitude z0 (-1..1) to the top."""
    prof = []
    for i in range(rings + 1):
        t = math.asin(z0) + (math.pi / 2 - math.asin(z0)) * i / rings
        prof.append((math.cos(t), math.sin(t)))
    m = Matrix.Translation(c) @ Matrix.Diagonal((rx, ry, rz, 1))
    return k.lathe(prof, segs, color, m=m, colors=colors)


def visor_cut(i, b, segs, a_mid, a_half, b0, b1, inside, outside):
    a = 2 * math.pi * (i + 0.5) / segs
    da = (a - a_mid + math.pi) % (2 * math.pi) - math.pi
    return inside if abs(da) < a_half and b0 <= b < b1 else outside


FRONT = -math.pi / 2          # angle of -y


def neck_ring(k, r=0.13, color='alu'):
    k.lathe([(r, 0.0), (r + 0.025, 0.0), (r + 0.025, 0.035), (r, 0.035)], 32, color)


# ---- SK-1 (Gagarin) ----
k = new()
neck_ring(k, color='steel')
dome(k, (0, 0, 0.17), 0.15, 0.16, 0.17, 'white', z0=-0.75,
     colors=lambda i, b: visor_cut(i, b, 32, FRONT, 0.95, 3, 9, 'glass', 'white'))
dome(k, (0, 0.005, 0.18), 0.157, 0.167, 0.168, 'orange', z0=0.35, colors=lambda i, b: 'orange' if True else 'white')
k.text('CCCP', Matrix.Translation((0, 0, 0.255)), 0.04, 'white', depth=0.002, wrap_r=0.142)
save(k, 'helmet_sk1')

# ---- Mercury ----
k = new()
neck_ring(k)
dome(k, (0, 0, 0.17), 0.145, 0.16, 0.17, 'silver', z0=-0.75,
     colors=lambda i, b: visor_cut(i, b, 32, FRONT, 0.85, 3, 8, 'glass', 'silver'))
k.box((0.13, -0.05, 0.14), (0.03, 0.06, 0.05), 'dark')                         # visor seal valve
k.box((-0.13, -0.05, 0.14), (0.03, 0.06, 0.05), 'dark')
rod(k, (0.1, -0.06, 0.1), (0.03, -0.13, 0.11), 0.006, 'black')                # microphone boom inside
save(k, 'helmet_mercury')

# ---- Gemini ----
k = new()
neck_ring(k)
dome(k, (0, 0, 0.17), 0.15, 0.165, 0.175, 'white', z0=-0.75,
     colors=lambda i, b: visor_cut(i, b, 32, FRONT, 1.05, 3, 9, 'glass', 'white'))
k.box((0, 0.16, 0.1), (0.1, 0.04, 0.06), 'white2', bevel=0.01)              # comms pod at the back
k.text('NASA', Matrix.Translation((0, 0, 0.2)) @ Matrix.Rotation(math.pi, 4, 'Z'), 0.03, 'blue', depth=0.002, wrap_r=0.163)
save(k, 'helmet_gemini')

# ---- Apollo moonwalk: bubble, white visor assembly (LEVA), gold visor down ----
k = new()
neck_ring(k, r=0.15)
dome(k, (0, 0, 0.2), 0.16, 0.17, 0.19, 'glass', z0=-0.6)                       # the clear bubble (dark glass)
dome(k, (0, 0, 0.2), 0.178, 0.188, 0.208, 'white', z0=-0.45,
     colors=lambda i, b: visor_cut(i, b, 32, FRONT, 1.15, 1, 8, 'gold', 'white'))
for s in (-1, 1):
    k.box((s * 0.175, -0.02, 0.17), (0.02, 0.07, 0.06), 'white2', bevel=0.005)  # visor pivots
    k.box((s * 0.15, -0.1, 0.32), (0.04, 0.05, 0.03), 'dark')                   # side eyeshades (up)
k.box((0, -0.15, 0.37), (0.12, 0.05, 0.02), 'white2', rot=(0.7, 0, 0))         # centre eyeshade
save(k, 'helmet_apollo')

# ---- Berkut (Leonov) ----
k = new()
neck_ring(k, color='steel')
dome(k, (0, 0, 0.18), 0.155, 0.165, 0.18, 'white', z0=-0.75,
     colors=lambda i, b: visor_cut(i, b, 32, FRONT, 0.9, 3, 9, 'glass', 'white'))
dome(k, (0, -0.004, 0.18), 0.16, 0.17, 0.185, 'gold', z0=0.25,
     colors=lambda i, b: visor_cut(i, b, 32, FRONT, 0.9, 0, 4, 'gold', 'white'))     # sun filter pushed up
k.text('CCCP', Matrix.Translation((0, 0, 0.2)) @ Matrix.Rotation(math.pi, 4, 'Z'), 0.04, 'red', depth=0.002, wrap_r=0.153)
save(k, 'helmet_berkut')

# ---- Apollo couch ----
k = new()
for s in (-1, 1):                                                               # side rails / frame
    rod(k, (s * 0.25, -0.9, 0.35), (s * 0.25, 0.25, 0.35), 0.02, 'alu')
    rod(k, (s * 0.25, 0.25, 0.35), (s * 0.25, 0.45, 1.0), 0.02, 'alu')
    rod(k, (s * 0.25, -0.9, 0.35), (s * 0.25, -1.0, 0.75), 0.02, 'alu')
    for y in (-0.6, 0.0):
        rod(k, (s * 0.25, y, 0.0), (s * 0.25, y, 0.35), 0.025, 'grey')             # struts to the floor
k.box((0, -0.32, 0.38), (0.5, 1.15, 0.05), 'fabric', bevel=0.01)                 # seat pan + thigh
k.box((0, 0.36, 0.67), (0.5, 0.05, 0.7), 'fabric', rot=(-0.33, 0, 0), bevel=0.01)  # back
k.box((0, -0.98, 0.58), (0.4, 0.05, 0.42), 'fabric', rot=(0.25, 0, 0), bevel=0.01)  # lower legs
k.box((0, 0.5, 1.07), (0.3, 0.12, 0.2), 'fabric', bevel=0.02)                     # headrest
for s in (-1, 1):
    k.box((s * 0.32, -0.05, 0.55), (0.08, 0.35, 0.05), 'grey')                     # arm rests
save(k, 'apollo_couch')

# ---- DSKY ----
k = new()
k.box((0, 0, 0.1), (0.2, 0.06, 0.2), 'grey', bevel=0.004)
k.box((0.04, -0.031, 0.155), (0.09, 0.003, 0.08), 'black')                       # display
for r in range(3):
    k.box((0.04, -0.034, 0.18 - r * 0.025), (0.07, 0.002, 0.012), 'green')
k.box((-0.055, -0.031, 0.155), (0.07, 0.003, 0.08), 'dark')                      # warning lights
for r in range(4):
    for c in range(2):
        k.box((-0.07 + c * 0.03, -0.034, 0.185 - r * 0.018), (0.024, 0.002, 0.012), 'white2' if (r + c) % 3 else 'orange')
for r in range(3):                                                               # 19 keys
    for c in range(7):
        if r != 1 and c in (0, 6):
            continue
        k.box((-0.084 + c * 0.028, -0.034, 0.08 - r * 0.026 + (0.013 if c in (0, 6) else 0)), (0.022, 0.008, 0.02), 'white2')
save(k, 'dsky')

# ---- rotation hand controller ----
k = new()
k.box((0, 0, 0.02), (0.07, 0.09, 0.04), 'dark', bevel=0.005)
k.tube(Matrix.Translation((0, 0, 0.04)), 0.02, 0.05, 'black', segs=12)
k.box((0, 0.0, 0.13), (0.045, 0.06, 0.12), 'black', rot=(0.25, 0, 0), bevel=0.012)    # pistol grip
k.box((0, -0.035, 0.12), (0.015, 0.01, 0.025), 'red')                               # trigger
k.box((0, 0.01, 0.2), (0.035, 0.03, 0.015), 'grey')                                 # thumb switch
save(k, 'hand_controller')

# ---- Hasselblad on its chest bracket ----
k = new()
k.box((0, 0, 0.05), (0.1, 0.1, 0.1), 'silver', bevel=0.006)                         # body
k.box((0, 0.065, 0.05), (0.1, 0.035, 0.1), 'silver', bevel=0.004)                   # film magazine
k.tube(Matrix.Translation((0, -0.05, 0.05)) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 0.035, 0.07, 'black', segs=20)  # lens
k.tube(Matrix.Translation((0, -0.12, 0.05)) @ Matrix.Rotation(math.pi / 2, 4, 'X'), 0.028, 0.004, 'glass', segs=20)
k.box((0.065, 0.0, 0.06), (0.03, 0.06, 0.04), 'black')                              # trigger handle
k.box((0, 0.02, -0.02), (0.06, 0.06, 0.04), 'alu')                                  # bracket
save(k, 'hasselblad')

# ---- the 1969 flag ----
k = new()
H = 2.4
rod(k, (0, 0, -0.3), (0, 0, H), 0.016, 'alu', 10)
rod(k, (0, 0, H - 0.05), (0.98, 0, H - 0.05), 0.012, 'alu', 8)                      # crossbar along the top
FW, FH = 0.98, 0.65
for i in range(13):                                                                 # stripes, with a gentle ripple
    z0 = H - 0.05 - (i + 1) * FH / 13
    for j in range(8):
        x0, x1 = FW * j / 8, FW * (j + 1) / 8
        w0, w1 = 0.025 * math.sin(j * 1.3), 0.025 * math.sin((j + 1) * 1.3)
        canton = i < 7 and x1 <= FW * 0.4 + 1e-6
        col = 'blue' if canton else ('red' if i % 2 == 0 else 'flagw')
        vs = [k.bm.verts.new(p) for p in ((x0, w0, z0), (x1, w1, z0), (x1, w1, z0 + FH / 13), (x0, w0, z0 + FH / 13))]
        f = k.bm.faces.new(vs); f[k.col] = k.ci(col)
        vs2 = [k.bm.verts.new(v.co + Vector((0, 0.002, 0))) for v in reversed(vs)]
        f2 = k.bm.faces.new(vs2); f2[k.col] = k.ci(col)
for i in range(5):                                                                  # a few stars as small white dots
    for j in range(4):
        k.box((0.04 + j * 0.095 + (0.047 if i % 2 else 0), -0.004 + 0.025 * math.sin((0.04 + j * 0.095) / FW * 8 * 1.3), H - 0.09 - i * 0.065), (0.018, 0.012, 0.018), 'flagw')
save(k, 'flag_1969')

# ---- passive seismic experiment ----
k = new()
k.lathe([(0, 0), (0.2, 0), (0.2, 0.32), (0.16, 0.4), (0, 0.4)], 20, 'foil')       # the instrument under its foil skirt
k.lathe([(0.45, 0.0), (0.2, 0.08)], 24, 'silver')                                 # thermal skirt on the ground
for s in (-1, 1):                                                                 # solar wings
    rod(k, (s * 0.15, 0, 0.3), (s * 0.35, 0, 0.32), 0.012, 'alu')
    k.box((s * 0.72, 0, 0.34), (0.75, 0.55, 0.02), 'panel', rot=(0, s * 0.05, 0))
    k.box((s * 0.72, 0, 0.33), (0.77, 0.57, 0.012), 'alu', rot=(0, s * 0.05, 0))
rod(k, (0, 0.1, 0.4), (0.05, 0.2, 0.75), 0.008, 'alu')                           # antenna
k.lathe([(0.0, 0.0), (0.06, 0.02), (0.065, 0.03), (0, 0.01)], 12, 'white', m=Matrix.Translation((0.05, 0.2, 0.75)))
save(k, 'seismometer')

# ---- laser ranging retroreflector ----
k = new()
for s in (-1, 1):
    k.box((s * 0.2, 0.15, 0.12), (0.04, 0.04, 0.24), 'alu')
    k.box((s * 0.2, -0.15, 0.06), (0.04, 0.04, 0.12), 'alu')
m = Matrix.Translation((0, 0, 0.2)) @ Matrix.Rotation(0.4, 4, 'X')
k.box(None, (0.46, 0.46, 0.05), 'alu', m=m)
for r in range(10):                                                               # 100 corner-cube reflectors
    for c in range(10):
        k.box(None, (0.036, 0.036, 0.012), 'glass', m=m @ Matrix.Translation((-0.198 + c * 0.044, -0.198 + r * 0.044, 0.03)))
k.box((0, -0.25, 0.01), (0.5, 0.06, 0.02), 'alu')
save(k, 'laser_reflector')
