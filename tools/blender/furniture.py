# Era 3's room furniture (js/era3/sets.js desk/chair/table/shelf/armchair/sofa), built in Blender with
# rounded edges, wood grain, upholstery and baked soft shadows, instead of plain boxes. Each piece is
# made at the default size the game asks for and stretched to the size each room wants.
#   desk     1.5 x 0.75 x 0.76 m, drawers on the left (-x), front +z (game)
#   chair    seat 0.46 m high, back at -z (game)
#   table    1.2 x 0.8 x 0.75 m
#   shelf    1.0 x 1.8 x 0.32 m, just the case (the game adds books)
#   armchair, sofa (1.8 m)
#   python3 -I tools/blender/furniture.py     (writes models/sets/furniture.glb)
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import setkit as K
from setkit import Piece, M, srgb, flat

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'models', 'sets', 'furniture.glb')
K.reset()

m = M('wood'); g = m.wave(22, 'X', 6, 3).outputs['Fac']
col = m.mix(m.rgb(srgb(0x6a4428)), m.rgb(srgb(0x4a2e18)), m.ramp(g, [(0.25, 0), (0.75, 0.85)]))
m.out(m.mix(col, m.noise(40, 4).outputs['Fac'], 0.12, 'OVERLAY'))
m = M('woodv'); g = m.wave(22, 'Z', 6, 3).outputs['Fac']   # grain running up the legs
col = m.mix(m.rgb(srgb(0x6a4428)), m.rgb(srgb(0x4a2e18)), m.ramp(g, [(0.25, 0), (0.75, 0.85)]))
m.out(m.mix(col, m.noise(40, 4).outputs['Fac'], 0.12, 'OVERLAY'))
m = M('leather'); m.out(m.mix(m.rgb(srgb(0x6a2a1e)), m.noise(30, 8, 0.7).outputs['Fac'], 0.25, 'OVERLAY'))
m = M('fabric'); w1 = m.wave(120, 'X', 0, 1).outputs['Fac']
m.out(m.mix(m.rgb(srgb(0x4a5a3a)), m.rgb(srgb(0x3e4c32)), m.ramp(w1, [(0, 0), (1, 0.6)])))
m = M('fabric2'); m.out(m.mix(m.rgb(srgb(0x7a3a2a)), m.noise(60, 6).outputs['Fac'], 0.2, 'OVERLAY'))
flat('brass', 0xc8a860, 0.1, 10)
flat('dark', 0x2a1a10, 0.05)


def bevel(ob, w=0.008, segs=1):
    md = ob.modifiers.new('b', 'BEVEL'); md.width = w; md.segments = segs; md.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier='b')


# Blender: x right, y back(-z game is +y Blender), z up.  game +z (front) = Blender -y
def desk():
    p = Piece('desk', 'f'); w, d, h = 1.5, 0.75, 0.76
    p.box((0, 0, h - 0.035), (w, d, 0.035), 'wood')
    p.box((0, 0, h - 0.06), (w - 0.04, d - 0.04, 0.025), 'wood')   # a lip under the top
    p.box((-w / 2 + 0.23, 0, 0.02), (0.42, d - 0.05, h - 0.08), 'wood')   # drawer pedestal
    for i in range(3):
        p.box((-w / 2 + 0.23, -d / 2 + 0.02, 0.06 + i * 0.22), (0.38, 0.02, 0.19), 'wood')
        p.cyl((-w / 2 + 0.23 - 0.05, -d / 2 + 0.01, 0.17 + i * 0.22), 0.008, 0.1, 'brass', segs=5, axis='X')
    for (sx, sy) in [(1, 1), (1, -1)]:
        p.box((sx * (w / 2 - 0.05), sy * (d / 2 - 0.05), 0), (0.05, 0.05, h - 0.06), 'woodv', batter=0.006)
    p.box((0.2, d / 2 - 0.04, h - 0.35), (w - 0.5, 0.02, 0.28), 'wood')   # modesty panel
    p.box((-w / 2 + 0.23, 0, 0), (0.44, d - 0.03, 0.03), 'dark')   # plinth
    return p


def chair():
    p = Piece('chair', 'f'); h = 0.46
    p.box((0, 0, h - 0.03), (0.44, 0.42, 0.03), 'wood')
    p.box((0, 0.01, h), (0.42, 0.38, 0.04), 'leather', batter=0.015)   # padded seat
    for (sx, sy) in [(1, -1), (-1, -1)]:
        p.box((sx * 0.19, sy * 0.18, 0), (0.035, 0.035, h - 0.03), 'woodv', batter=0.004)
    for sx in (-1, 1):
        p.box((sx * 0.19, 0.18, 0), (0.035, 0.035, h + 0.48), 'woodv', batter=0.003)   # back legs run up into the back
        p.box((sx * 0.19, 0, 0.14), (0.02, 0.36, 0.02), 'woodv')   # stretchers
    p.box((0, 0.185, h + 0.26), (0.38, 0.025, 0.2), 'wood')
    p.box((0, 0.185, h + 0.1), (0.38, 0.02, 0.04), 'wood')
    return p


def table():
    p = Piece('table', 'f'); w, d, h = 1.2, 0.8, 0.75
    p.box((0, 0, h - 0.035), (w, d, 0.035), 'wood')
    p.box((0, 0, h - 0.12), (w - 0.14, d - 0.14, 0.085), 'wood', top=False)   # apron
    for (sx, sy) in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
        p.box((sx * (w / 2 - 0.06), sy * (d / 2 - 0.06), 0), (0.055, 0.055, h - 0.035), 'woodv', batter=0.01)
    return p


def shelf():
    p = Piece('shelf', 'f'); w, h, d = 1.0, 1.8, 0.32
    for sx in (-1, 1): p.box((sx * w / 2, 0, 0), (0.03, d, h + 0.03), 'woodv')
    p.box((0, d / 2 - 0.01, 0), (w, 0.02, h), 'dark')
    n = 5
    for i in range(n + 1): p.box((0, 0, i * h / n - 0.012), (w, d, 0.025), 'wood')
    p.box((0, -d / 2 + 0.01, h + 0.01), (w + 0.08, d + 0.06, 0.04), 'wood')   # cornice
    p.box((0, -d / 2 + 0.01, 0), (w, 0.02, 0.08), 'wood')   # kick board
    return p


def armchair(name='armchair', w=0.72, mat='fabric2'):
    p = Piece(name, 'f')
    p.box((0, 0, 0.12), (w, 0.7, 0.24), mat, batter=0.01)
    p.box((0, -0.04, 0.36), (w - 0.14, 0.58, 0.12), mat, batter=0.03)   # cushion
    p.box((0, 0.29, 0.12), (w, 0.16, 0.72), mat, batter=0.02)   # back
    for sx in (-1, 1): p.box((sx * (w / 2 - 0.06), 0, 0.12), (0.12, 0.68, 0.46), mat, batter=0.02)   # arms
    for (sx, sy) in [(1, 1), (-1, 1), (1, -1), (-1, -1)]: p.cyl((sx * (w / 2 - 0.06), sy * 0.28, 0), 0.025, 0.12, 'woodv', segs=6, r2=0.018)
    return p


pieces = [desk(), chair(), table(), shelf(), armchair(), armchair('sofa', 1.8, 'fabric')]
objs = [pc.obj() for pc in pieces]
for ob in objs: bevel(ob)
# hand the already-made objects to the baker
_orig = Piece.obj
it = iter(objs)
Piece.obj = lambda self: next(it)
K.bake_export(pieces, OUT, {'f': 1024}, samples=24, ao_strength=0.75, saturation=1.25)
