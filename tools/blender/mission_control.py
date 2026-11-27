# Mission Control, Houston (the Apollo-era Mission Operations Control Room) as one set piece:
# four stepped rows of grey-green consoles facing the wall of big screens (world map with the orbit
# track in the middle, data screens either side), chairs, the glass viewing room at the back, ceiling
# lights. One mesh + one material.
#   mission_control.glb  origin = floor centre of the room; the screen wall is at y = -10 (Blender),
#                        i.e. the controllers face -y (= +z in the game). 26 m wide, 20 m deep, 6 m tall.
# Seat positions for people are printed (x, y, floor z, facing -y).
#   python3 -I tools/blender/mission_control.py [out dir]
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # (loads mathutils)
from mathutils import Matrix, Vector
from kit import Kit, reset

OUT = sys.argv[-1] if len(sys.argv) > 1 and not sys.argv[-1].endswith('.py') else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'era3')
os.makedirs(OUT, exist_ok=True)

PAL = {
    'console': ((0.42, 0.46, 0.44), 0.6, 0.1),
    'console2': ((0.34, 0.37, 0.36), 0.6, 0.1),
    'panel':  ((0.22, 0.23, 0.24), 0.5, 0.2),
    'crt':    ((0.05, 0.09, 0.07), 0.15, 0.0),
    'crtlit': ((0.35, 0.75, 0.45), 0.3, 0.0),
    'btn_w':  ((0.85, 0.85, 0.80), 0.5, 0.0),
    'btn_r':  ((0.75, 0.15, 0.10), 0.5, 0.0),
    'btn_a':  ((0.90, 0.60, 0.15), 0.5, 0.0),
    'btn_g':  ((0.25, 0.65, 0.30), 0.5, 0.0),
    'desk':   ((0.55, 0.53, 0.48), 0.6, 0.0),
    'carpet': ((0.24, 0.27, 0.33), 0.95, 0.0),
    'step':   ((0.30, 0.32, 0.36), 0.9, 0.0),
    'wall':   ((0.62, 0.60, 0.55), 0.9, 0.0),
    'wall2':  ((0.50, 0.48, 0.44), 0.9, 0.0),
    'ceil':   ((0.70, 0.70, 0.68), 0.9, 0.0),
    'light':  ((1.00, 0.98, 0.90), 0.9, 0.0),
    'map':    ((0.06, 0.12, 0.28), 0.6, 0.0),
    'land':   ((0.35, 0.55, 0.40), 0.6, 0.0),
    'track':  ((0.95, 0.85, 0.30), 0.6, 0.0),
    'scrtxt': ((0.75, 0.85, 0.95), 0.6, 0.0),
    'frame':  ((0.12, 0.12, 0.13), 0.6, 0.2),
    'glass':  ((0.10, 0.12, 0.14), 0.1, 0.0),
    'chair':  ((0.18, 0.18, 0.20), 0.7, 0.0),
    'chrome': ((0.70, 0.70, 0.70), 0.3, 1.0),
    'black':  ((0.04, 0.04, 0.045), 0.6, 0.0),
    'ash':    ((0.55, 0.55, 0.56), 0.3, 0.8),
}
W, D, H = 26.0, 20.0, 6.0
FRONT = -10.0

k = Kit(PAL)
reset()
k = Kit(PAL)

# ---- room shell (inward-facing boxes) ----
k.box((0, 0, -0.05), (W, D, 0.1), 'carpet')
k.box((0, 0, H + 0.05), (W, D, 0.1), 'ceil')
k.box((-W / 2 - 0.05, 0, H / 2), (0.1, D, H), 'wall')
k.box((W / 2 + 0.05, 0, H / 2), (0.1, D, H), 'wall')
k.box((0, FRONT - 0.05, H / 2), (W, 0.1, H), 'wall2')
# side wall panelling strips
for s in (-1, 1):
    for y in range(-9, 10, 2):
        k.box((s * (W / 2 - 0.02), y, 2.2), (0.04, 0.06, 4.4), 'wall2')
    k.box((s * (W / 2 - 0.03), 0, 1.0), (0.06, D, 0.08), 'wall2')
# ceiling light panels
for x in range(-10, 11, 4):
    for y in range(-8, 9, 4):
        k.box((x, y, H - 0.01), (2.2, 0.6, 0.02), 'light')

# ---- the screen wall ----
SZ = 3.4          # centre of the main screens
def screen(cx, w, h, kind):
    k.box((cx, FRONT + 0.06, SZ), (w + 0.2, 0.1, h + 0.2), 'frame')
    k.box((cx, FRONT + 0.12, SZ), (w, 0.02, h), 'map')
    if kind == 'map':
        for x0, z0, ww, hh in ((-0.33, 0.12, 0.18, 0.22), (-0.27, -0.12, 0.08, 0.2), (-0.02, 0.14, 0.12, 0.14),
                               (0.0, -0.05, 0.1, 0.22), (0.18, 0.12, 0.26, 0.16), (0.32, -0.18, 0.1, 0.08), (-0.1, 0.33, 0.18, 0.05)):
            k.box((cx + x0 * w, FRONT + 0.14, SZ + z0 * h), (ww * w, 0.02, hh * h), 'land')
        for i in range(60):                       # the sine-wave orbit track across the map
            x = -0.48 + i / 60 * 0.96
            k.box((cx + x * w, FRONT + 0.16, SZ + 0.3 * h * math.sin(x * 2 * math.pi * 1.5 + 0.6)), (0.07, 0.02, 0.07), 'track')
    else:
        rows = 9
        for r in range(rows):
            z = SZ + h / 2 - (r + 1) * h / (rows + 1)
            for c in range(3):
                ln = 0.18 + 0.12 * ((r * 7 + c * 3) % 4) / 3
                k.box((cx - w / 2 + 0.15 * w + c * 0.3 * w + ln * w / 2, FRONT + 0.14, z), (ln * w, 0.02, 0.09), 'scrtxt')
screen(0, 7.0, 3.8, 'map')
screen(-7.2, 4.6, 3.0, 'data')
screen(7.2, 4.6, 3.0, 'data')
for i, x in enumerate((-10.6, -3.5, 3.5, 10.6)):            # the small status screens up top
    k.box((x, FRONT + 0.06, 5.55), (2.2, 0.1, 0.7), 'frame')
    k.box((x, FRONT + 0.12, 5.55), (2.0, 0.02, 0.55), 'map')
    for c in range(4):
        k.box((x - 0.75 + c * 0.5, FRONT + 0.14, 5.55), (0.35, 0.02, 0.18), 'track' if c == i else 'scrtxt')
k.box((0, FRONT + 0.3, 1.05), (W, 0.6, 0.1), 'wall2')        # low ledge under the screens

# ---- console rows ----
def console(cx, cy, z, n_crt=2):
    """One 1.25 m console position facing -y: body, sloped panel with CRTs and buttons, desk."""
    k.box((cx, cy, z + 0.38), (1.24, 0.75, 0.76), 'console')
    k.box((cx, cy - 0.38, z + 0.05), (1.24, 0.02, 0.1), 'black')                # kick plate
    # sloped top panel rising away from the controller (toward -y)
    m = Matrix.Translation((cx, cy - 0.12, z + 0.95)) @ Matrix.Rotation(-0.45, 4, 'X')
    k.box(None, (1.24, 0.12, 0.65), 'console2', m=m)
    for i in range(n_crt):
        x = (i - (n_crt - 1) / 2) * 0.5
        k.box(None, (0.42, 0.04, 0.32), 'panel', m=m @ Matrix.Translation((x, 0.06, 0.12)))
        k.box(None, (0.34, 0.03, 0.26), 'crt', m=m @ Matrix.Translation((x, 0.08, 0.12)))
        for r in range(4):
            k.box(None, (0.22 - 0.04 * (r % 2), 0.02, 0.02), 'crtlit', m=m @ Matrix.Translation((x - 0.04, 0.095, 0.2 - r * 0.05)))
    for r in range(2):                                                            # button strips
        for c in range(10):
            col = ('btn_w', 'btn_w', 'btn_a', 'btn_w', 'btn_g', 'btn_w', 'btn_r', 'btn_w', 'btn_w', 'btn_a')[(c + r * 3) % 10]
            k.box(None, (0.05, 0.03, 0.035), col, m=m @ Matrix.Translation((-0.5 + c * 0.11, 0.07, -0.15 - r * 0.07)))
    k.box((cx, cy + 0.32, z + 0.77), (1.24, 0.35, 0.04), 'desk')                 # writing shelf
    k.box((cx + 0.35, cy + 0.33, z + 0.81), (0.14, 0.14, 0.03), 'ash')          # ashtray
    k.box((cx - 0.4, cy + 0.36, z + 0.83), (0.18, 0.12, 0.08), 'black')        # telephone / comm box


def chair(cx, cy, z):
    k.tube(Matrix.Translation((cx, cy, z)), 0.04, 0.42, 'chrome', segs=6, cap=False)
    for i in range(5):
        a = i * 2 * math.pi / 5
        k.box((cx + 0.2 * math.cos(a), cy + 0.2 * math.sin(a), z + 0.03), (0.4, 0.05, 0.04), 'chrome', rot=(0, 0, a))
    k.box((cx, cy, z + 0.47), (0.48, 0.46, 0.09), 'chair', bevel=0.02)
    k.box((cx, cy + 0.24, z + 0.82), (0.46, 0.08, 0.6), 'chair', rot=(-0.15, 0, 0), bevel=0.02)


ROWS = [(-5.6, 0.0, 6), (-2.9, 0.4, 7), (-0.2, 0.8, 8), (2.5, 1.2, 7)]   # (console y, floor height, positions)
seats = []
for r, (y, z, n) in enumerate(ROWS):
    if z > 0:                                                                     # the stepped platform
        k.box((0, y + 0.9 - (1.35 if r else 0) + 0.65, z / 2), (W - 2, 2.7, z), 'step')
        k.box((0, y - 0.48, z - 0.01), (W - 2, 0.05, 0.02), 'chrome')             # nosing strip
    for i in range(n):
        x = (i - (n - 1) / 2) * 1.26
        console(x, y, z, n_crt=2 if i % 3 else 1)
        if (i + r) % 2 == 0 or n <= 6:
            chair(x, y + 1.05, z)
            seats.append((round(x, 2), round(y + 1.05, 2), z))
    for s in (-1, 1):                                                             # end caps
        k.box((s * ((n / 2) * 1.26 + 0.03), y, z + 0.5), (0.06, 0.8, 1.0), 'console2')
# platform for the back row continues to the glass wall
k.box((0, 6.6, 1.2 / 2), (W - 2, 6.8, 1.2), 'step')

# ---- viewing room behind glass at the back ----
k.box((0, 10.05, H / 2), (W, 0.1, H), 'wall')
k.box((0, 9.9, 1.3 + 2.2), (W - 4, 0.06, 2.6), 'glass')
for x in range(-11, 12, 2):
    k.box((x, 9.85, 3.5), (0.08, 0.1, 2.6), 'frame')
k.box((0, 9.85, 2.2), (W - 4, 0.12, 0.1), 'frame')
k.box((0, 9.85, 4.8), (W - 4, 0.12, 0.1), 'frame')
for x in (-6, -2, 2, 6):                                                          # clocks above the screens
    k.box((x, FRONT + 0.06, 0.6), (1.2, 0.1, 0.5), 'frame')
    for c in range(6):
        k.box((x - 0.45 + c * 0.18, FRONT + 0.12, 0.6), (0.12, 0.02, 0.26), 'btn_r')
k.text('MISSION CONTROL', Matrix.Translation((0, FRONT + 0.11, 1.55)) @ Matrix.Rotation(math.pi, 4, 'Z'), 0.28, 'btn_w', depth=0.02)

tris = k.export(os.path.join(OUT, 'mission_control.glb'))
print(f'MODEL mission_control: {tris} triangles; {len(seats)} chairs')
print('SEATS', seats)
