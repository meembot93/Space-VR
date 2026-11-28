# Era 2's plain town houses (js/era2/common.js house(): Tycho's Hven, Newton's farm, Galileo's Padua,
# the far houses of Kaluga...), built in Blender instead of flat boxes. Three pieces the game stretches
# to each house and tints to its wall and roof colours (so the textures are pale and neutral):
#   walls   10 x 8 m footprint (game x by z), 4 m high, no top: lime plaster with damp at the foot,
#           a shadow band under the eaves, patches flaked to stone, a stone footing, corner stones
#   gables  the two triangles at the ends of a roof whose ridge runs along x (10 m), 8 m wide, 3.4 m high
#   roof    the roof itself: courses of tiles in real steps, overhanging eaves, a ridge cap. Its eaves
#           sit at z = 0 and come EAVE m below the wall top (the game lowers it by that)
#   python3 -I tools/blender/houses.py     (needs `pip install bpy`; writes models/sets/houses.glb)
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import setkit as K
from setkit import Piece, M, srgb, flat

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'models', 'sets', 'houses.glb')
K.reset()

L, D, H, WH = 10.0, 8.0, 3.4, 4.0      # ridge length, width across, roof height, wall height
OV = 0.28                               # overhang (horizontal)
SL = H / (D / 2)                         # slope
EAVE = OV * SL                           # how far the eaves hang below the wall top


def zmask(m, stops):
    sep = m.N.new('ShaderNodeSeparateXYZ'); m.link(m.obj(), sep.inputs[0])
    mr = m.N.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0; mr.inputs['From Max'].default_value = WH
    m.link(sep.outputs['Z'], mr.inputs['Value'])
    return m.ramp(mr.outputs['Result'], stops)


# lime plaster (pale: the game tints it to each house's colour)
m = M('plaster')
col = m.mix(m.rgb(srgb(0xd8d2c6)), m.noise(1.4, 8, 0.6).outputs['Fac'], 0.18, 'OVERLAY')
col = m.mix(col, m.noise(9, 6, 0.6).outputs['Fac'], 0.08, 'OVERLAY')
st = m.brick(srgb(0x9a948a), srgb(0x868076), srgb(0x6a645a), 0.28, 0.5, 0.02)
flake = m.ramp(m.noise(0.7, 5, 0.7).outputs['Fac'], [(0.0, 0), (0.64, 0), (0.68, 1)])
col = m.mix(col, st.outputs['Color'], flake)
streak = m.wave(1.3, 'X', 6, 2).outputs['Fac']
col = m.mix(col, m.rgb(srgb(0x8a8070)), m.ramp(streak, [(0, 0.0), (1, 0.12)]))
col = m.mix(col, m.rgb(srgb(0x7a7466)), zmask(m, [(0.0, 0.5), (0.18, 0.0)]))            # damp at the foot
col = m.mix(col, m.rgb(srgb(0x6a6458)), zmask(m, [(0.86, 0.0), (1.0, 0.45)]))           # eave shadow
m.out(col)
m = M('stone'); b = m.brick(srgb(0x8a8478), srgb(0x77716a), srgb(0x55504a), 0.3, 0.55, 0.025)
m.out(m.mix(b.outputs['Color'], m.noise(4, 6).outputs['Fac'], 0.25, 'OVERLAY'))
m = M('quoin'); m.out(m.mix(m.rgb(srgb(0xc8c0b0)), m.noise(3, 6).outputs['Fac'], 0.2, 'OVERLAY'))
# clay tiles (pale grey-tan, the game tints them): staggered tiles in courses, moss and soot
m = M('tile')
v = m.N.new('ShaderNodeCombineXYZ'); sep = m.N.new('ShaderNodeSeparateXYZ'); m.link(m.obj(), sep.inputs[0])
m.link(sep.outputs['X'], v.inputs['X']); m.link(sep.outputs['Y'], v.inputs['Y'])
t = m.brick(srgb(0xc4bcb0), srgb(0xb0a89a), srgb(0x4a4440), D / 2 / 9 * 1.0, 0.24, 0.012, vec=v.outputs[0])
col = m.mix(t.outputs['Color'], m.noise(6, 6).outputs['Fac'], 0.22, 'OVERLAY')
col = m.mix(col, m.rgb(srgb(0x6e7058)), m.ramp(m.noise(0.9, 6, 0.65).outputs['Fac'], [(0.5, 0), (0.75, 0.55)]))   # moss
col = m.mix(col, m.rgb(srgb(0x5a5650)), m.ramp(m.wave(0.8, 'Y', 4, 2).outputs['Fac'], [(0, 0), (1, 0.15)]))
m.out(col)
flat('ridge', 0xa49a8c, 0.15, 5)
flat('under', 0x6a6458, 0.1, 3)


def walls():
    p = Piece('walls', 'h')
    p.box((0, 0, 0), (L, D, WH), 'plaster', top=False)
    p.box((0, 0, 0), (L + 0.12, D + 0.12, 0.45), 'stone', top='stone')                     # footing
    for sx in (-1, 1):
        for sy in (-1, 1):
            for i in range(6):
                z = 0.45 + i * 0.58; big = i % 2 == 0
                a, b = (0.6, 0.3) if big else (0.3, 0.6)
                p.box((sx * (L / 2 - a / 2 + 0.03), sy * (D / 2 - b / 2 + 0.03), z), (a + 0.06, b + 0.06, 0.5), 'quoin', top=False)
    return p


def gables():
    p = Piece('gables', 'h')
    for sx in (-1, 1):
        x = sx * L / 2
        pts = [(x, -D / 2, 0), (x, D / 2, 0), (x, 0, H)]
        p.poly(pts if sx > 0 else pts[::-1], 'plaster')
    return p


def roof():
    p = Piece('roof', 'h')
    n, lip, th = 9, 0.05, 0.06
    W = L / 2 + OV * 0.8
    Y0 = D / 2 + OV                     # eave (horizontal distance from the ridge)
    z = lambda y: EAVE + H - abs(y) * SL   # roof surface height at |y|
    for s in (-1, 1):
        ys = [s * Y0 * (1 - i / n) for i in range(n + 1)]   # eave .. ridge
        for i in range(n):
            ya, yb = ys[i], ys[i + 1]          # lower edge, upper edge of the course
            za, zb = z(ya) + lip, z(yb)
            q = [(-W, ya, za), (W, ya, za), (W, yb, zb), (-W, yb, zb)]
            p.poly(q if s < 0 else [q[1], q[0], q[3], q[2]], 'tile')
            f = [(-W, ya, za - lip), (W, ya, za - lip), (W, ya, za), (-W, ya, za)]   # the step face
            p.poly(f if s < 0 else [f[1], f[0], f[3], f[2]], 'tile')
        # underside (soffit) and the thick edge at both gable ends
        u = [(-W, s * Y0, z(Y0) - th), (W, s * Y0, z(Y0) - th), (W, 0, z(0) - th), (-W, 0, z(0) - th)]
        p.poly(u if s > 0 else [u[1], u[0], u[3], u[2]], 'under')
        e = [(W, s * Y0, z(Y0) - th), (W, s * Y0, z(Y0) + lip), (W, 0, z(0) + lip), (W, 0, z(0) - th)]
        p.poly(e if s > 0 else e[::-1], 'ridge')
        e = [(-x, y, zz) for (x, y, zz) in e]
        p.poly(e[::-1] if s > 0 else e, 'ridge')
        p.box((0, s * (Y0 - 0.04), z(Y0) - th), (2 * W, 0.05, th + lip), 'ridge', top=False)   # fascia
    p.cyl((-W - 0.05, 0, EAVE + H + 0.02), 0.13, 2 * W + 0.1, 'ridge', segs=6, axis='X')       # ridge cap
    return p


pieces = [walls(), gables(), roof()]
K.bake_export(pieces, OUT, {'h': 1024}, samples=24, ao_strength=0.7, saturation=1.0, gain=1.0)
print('EAVE', EAVE)
