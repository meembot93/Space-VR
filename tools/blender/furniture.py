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
# 1950s-60s diner and control-room materials
m = M('chrome'); m.out(m.mix(m.rgb(srgb(0xd8dce0)), m.wave(3, 'Z', 1, 2).outputs['Fac'], 0.35, 'OVERLAY'))
m = M('vinyl'); m.out(m.mix(m.rgb(srgb(0xb8241c)), m.noise(25, 6, 0.6).outputs['Fac'], 0.15, 'OVERLAY'))
m = M('vinyl_tuft'); b = m.brick(srgb(0xc02a20), srgb(0xbc2a1e), srgb(0x9a1e16), 0.62, 0.3, 0.006)   # vertical channel seams
m.out(m.mix(b.outputs['Color'], m.noise(25, 6, 0.6).outputs['Fac'], 0.12, 'OVERLAY'))
m = M('formica'); col = m.mix(m.rgb(srgb(0xe8e4dc)), m.rgb(srgb(0xb8c8c8)), m.ramp(m.noise(18, 4).outputs['Fac'], [(0.62, 0), (0.66, 1)]))
m.out(m.mix(col, m.noise(60, 4).outputs['Fac'], 0.06, 'OVERLAY'))
m = M('redpanel'); m.out(m.mix(m.rgb(srgb(0xc83a2a)), m.wave(40, 'Z', 0, 1).outputs['Fac'], 0.06, 'OVERLAY'))
m = M('steelgreen'); m.out(m.mix(m.rgb(srgb(0x6a7468)), m.noise(8, 6).outputs['Fac'], 0.1, 'OVERLAY'))
m = M('panel')   # instrument panel: rows of round gauges on dark grey
b = m.brick(srgb(0x2a2e2a), srgb(0x2a2e2a), srgb(0x3e443e), 0.12, 0.14, 0.004)
v = m.N.new('ShaderNodeTexVoronoi'); v.feature = 'F1'; v.inputs['Scale'].default_value = 6; m.link(m.obj(), v.inputs['Vector'])
dial = m.ramp(v.outputs['Distance'], [(0.0, 0.9), (0.1, 0.9), (0.115, 0.2), (0.13, 0)])
col = m.mix(b.outputs['Color'], m.rgb(srgb(0xe8e4d0)), dial)
m.out(col)
flat('glowamber', 0xe8a040, 0.1, 8)
flat('glowred', 0xd84030, 0.1, 8)
flat('wood2', 0x8a4a2a, 0.12, 6)
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


def stool():
    p = Piece('stool', 'g')
    p.lathe((0, 0, 0), [(0.2, 0), (0.2, 0.02), (0.12, 0.05), (0.045, 0.09), (0.04, 0.6), (0.07, 0.64), (0.0, 0.645)], 'chrome', segs=12)
    p.lathe((0, 0, 0.64), [(0.0, 0), (0.18, 0.0), (0.195, 0.02), (0.195, 0.05)], 'chrome', segs=14)
    p.lathe((0, 0, 0.64), [(0.19, 0.05), (0.19, 0.1), (0.17, 0.125), (0.0, 0.13)], 'vinyl', segs=14)
    return p


def booth():
    # a bench for one side of a booth, 1.2 m wide, sitter faces -y Blender (+z game), back at +y
    p = Piece('booth', 'g'); w = 1.2
    p.box((0, 0, 0), (w, 0.48, 0.08), 'chrome', top=False)
    p.box((0, 0, 0.08), (w, 0.46, 0.3), 'redpanel', top=False)
    p.box((0, -0.01, 0.38), (w - 0.02, 0.48, 0.09), 'vinyl', batter=0.02)    # seat cushion
    p.box((0, 0.25, 0.08), (w, 0.14, 1.07), 'redpanel', top='chrome')        # back frame
    p.box((0, 0.17, 0.48), (w - 0.06, 0.06, 0.62), 'vinyl_tuft', batter=0.015)   # tufted back pad
    p.box((0, 0.25, 1.15), (w + 0.01, 0.15, 0.03), 'chrome')
    return p


def dtable():
    p = Piece('dtable', 'g'); w, d, h = 1.2, 0.75, 0.76
    p.box((0, 0, h - 0.04), (w, d, 0.04), 'formica', sides=['chrome'] * 4)
    p.cyl((0, 0, 0), 0.04, h - 0.04, 'chrome', segs=8)
    p.lathe((0, 0, 0), [(0.25, 0), (0.25, 0.015), (0.06, 0.04), (0.0, 0.045)], 'chrome', segs=12)
    return p


def counter():
    # 7.2 m lunch counter, customers' side -y (game +z)
    p = Piece('counter', 'g'); w, d, h = 7.2, 0.7, 1.0
    p.box((0, 0, 0), (w, d, 0.1), 'chrome', top=False)
    p.box((0, 0, 0.1), (w, d, h - 0.14), 'redpanel', top=False)
    for z in (0.32, 0.62): p.box((0, -d / 2 - 0.01, z), (w, 0.02, 0.04), 'chrome', top=False)
    p.box((0, -0.075, h - 0.04), (w + 0.2, d + 0.15, 0.06), 'formica', sides=['chrome'] * 4)
    p.box((0, -d / 2 - 0.12, 0.18), (w, 0.04, 0.04), 'chrome')   # foot rail
    return p


def jukebox():
    p = Piece('jukebox', 'g'); w, d, h = 0.8, 0.55, 1.1
    p.box((0, 0, 0), (w, d, 0.08), 'chrome')
    p.box((0, 0, 0.08), (w, d, h - 0.08), 'wood2', top=False)
    prof = [(math.cos(math.pi * i / 10) * w / 2, math.sin(math.pi * i / 10) * 0.42) for i in range(11)]
    for (sy, mat) in [(-d / 2, 'glowamber'), (d / 2, 'wood2')]:
        pts = [(x, sy, h + z) for (x, z) in prof]
        p.poly(pts if sy > 0 else pts[::-1], mat)
    for i in range(10):
        a, b = prof[i], prof[i + 1]
        p.poly([(a[0], -d / 2, h + a[1]), (b[0], -d / 2, h + b[1]), (b[0], d / 2, h + b[1]), (a[0], d / 2, h + a[1])][::-1], 'wood2')
    for sx in (-1, 1): p.box((sx * (w / 2 - 0.06), -d / 2 - 0.02, 0.1), (0.08, 0.04, h + 0.15), 'glowred', top=False)
    p.box((0, -d / 2 - 0.01, 0.55), (w - 0.25, 0.02, 0.4), 'chrome', top=False)   # the record window
    p.box((0, -d / 2 - 0.01, 0.15), (w - 0.25, 0.02, 0.3), 'dark', top=False)     # speaker grille
    return p


def console():
    # a blockhouse control console, 1.8 m wide: desk and a sloped instrument panel, operator at -y
    p = Piece('console', 'g'); w = 1.8
    p.box((0, 0.05, 0), (w, 0.5, 0.06), 'dark', top=False)
    p.box((0, 0.05, 0.06), (w, 0.5, 0.7), 'steelgreen', top=False)
    p.box((0, -0.05, 0.76), (w + 0.04, 0.7, 0.04), 'steelgreen')                  # desk top
    # the sloped panel
    y0, y1, z0, z1 = 0.0, 0.28, 0.8, 1.28
    p.poly([(-w / 2, y0, z0), (w / 2, y0, z0), (w / 2, y1, z1), (-w / 2, y1, z1)], 'panel')
    p.poly([(-w / 2, y1, z1), (w / 2, y1, z1), (w / 2, 0.3, z0), (-w / 2, 0.3, z0)], 'steelgreen')
    for sx in (-1, 1):
        x = sx * w / 2
        t = [(x, y0, z0), (x, 0.3, z0), (x, y1, z1)]
        p.poly(t if sx > 0 else t[::-1], 'steelgreen')
    for i in range(9):
        p.cyl((-0.8 + i * 0.2, -0.15, 0.8), 0.018, 0.03, 'glowamber' if i % 3 else 'glowred', segs=6)   # switches
    return p


pieces = [desk(), chair(), table(), shelf(), armchair(), armchair('sofa', 1.8, 'fabric'), stool(), booth(), dtable(), counter(), jukebox(), console()]
objs = [pc.obj() for pc in pieces]
for ob in objs: bevel(ob)
# hand the already-made objects to the baker
_orig = Piece.obj
it = iter(objs)
Piece.obj = lambda self: next(it)
K.bake_export(pieces, OUT, {'f': 1024, 'g': 1024}, samples=24, ao_strength=0.75, saturation=1.25)
