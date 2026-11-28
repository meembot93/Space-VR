# Clean up Leonov's Berkut helmet from Tripo (models/era3/props/helmet_berkut.glb, already trimmed):
#  - paints out Tripo's smudged red letters (gold fills in from around them)
#  - adds crisp CCCP letters as real geometry, shaped onto the dome
#  - closes the open visor (Tripo left a hollow, odd-looking inside) with a smooth tinted glass visor
# Still one mesh + one material: the texture gets a thin strip at the bottom holding the new colours.
#   python3 -I tools/blender/fix_berkut.py [in.glb] [out.glb]
import os, sys, math
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if a.endswith('.glb')]
SRC = args[0] if args else os.path.join(HERE, '..', '..', 'models', 'era3', 'props', 'helmet_berkut.glb')
OUT = args[1] if len(args) > 1 else SRC

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
ob = next(o for o in bpy.data.objects if o.type == 'MESH')
mat = ob.data.materials[0]
imgs = {n.image.name: n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'}
base = next(i for n, i in imgs.items() if 'basecolor' in n or 'base' in n.lower())
rm = next(i for n, i in imgs.items() if '_rm' in n or 'metal' in n.lower())
nrm = next(i for n, i in imgs.items() if 'normal' in n.lower())
W, H = base.size
STRIP = 32
H2 = H + STRIP

def arr(im):
    return np.array(im.pixels[:], dtype=np.float32).reshape(im.size[1], im.size[0], 4)   # row 0 = bottom

# ---- 1. paint out the red letters: mask red pixels, fill them by diffusing the gold around them ----
b = arr(base)
r, g, bl = b[..., 0], b[..., 1], b[..., 2]
mask = (r > g + 0.18) & (r > bl + 0.25) & (g < 0.55)
grow = mask.copy()
for _ in range(2):                                  # include the soft edges of the letters
    grow = grow | np.roll(grow, 1, 0) | np.roll(grow, -1, 0) | np.roll(grow, 1, 1) | np.roll(grow, -1, 1)
known = ~grow
fill = b.copy(); fill[grow] = 0
wsum = known.astype(np.float32)
for _ in range(60):                                 # diffuse colours inward from the edges
    acc = np.zeros_like(fill); cnt = np.zeros_like(wsum)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        acc += np.roll(np.roll(fill * wsum[..., None], dy, 0), dx, 1)
        cnt += np.roll(np.roll(wsum, dy, 0), dx, 1)
    new = grow & (wsum == 0) & (cnt > 0)
    fill[new] = acc[new] / cnt[new][:, None]
    wsum = np.where(new, 1.0, wsum)
b[grow] = fill[grow]
print('painted out', int(grow.sum()), 'pixels')

# ---- 2. grow each texture by a strip at the bottom with flat colour swatches ----
SW = {'red': ((0.72, 0.06, 0.05), 0.55, 0.0), 'glass': ((0.10, 0.12, 0.14), 0.08, 0.0)}
def padded(a, kind):
    out = np.zeros((H2, W, 4), np.float32); out[STRIP:] = a; out[..., 3] = 1
    for i, (name, (col, rough, metal)) in enumerate(SW.items()):
        x0, x1 = i * 64, i * 64 + 64
        if kind == 'base': out[:STRIP, x0:x1, :3] = [c ** 1.0 for c in col]
        elif kind == 'rm': out[:STRIP, x0:x1, :3] = [0, rough, metal]
        else: out[:STRIP, x0:x1, :3] = [0.5, 0.5, 1.0]
    return out
for im, a, kind in ((base, b, 'base'), (rm, arr(rm), 'rm'), (nrm, arr(nrm), 'n')):
    p = padded(a, kind)
    im.scale(W, H2)
    im.pixels[:] = p.ravel()
    im.pack()
def swatch_uv(name):
    i = list(SW).index(name)
    return ((i * 64 + 32) / W, (STRIP / 2) / H2)
me = ob.data
uvl = me.uv_layers.active.data
for l in uvl:                                        # old UVs squeeze into the upper part
    l.uv = (l.uv[0], (l.uv[1] * H + STRIP) / H2)

# ---- geometry helpers ----
bm = bmesh.new(); bm.from_mesh(me)
bvh = BVHTree.FromBMesh(bm)
vs = [ob.matrix_world @ v.co for v in me.vertices]
lo = Vector([min(v[i] for v in vs) for i in range(3)]); hi = Vector([max(v[i] for v in vs) for i in range(3)])
print('bounds', lo, hi)
mw_inv = ob.matrix_world.inverted()
C = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z + (hi.z - lo.z) * 0.5))   # roughly the dome centre
uv = bm.loops.layers.uv.active

def add_faces(polys, color):
    u = swatch_uv(color)
    for poly in polys:
        f = bm.faces.new([bm.verts.new(mw_inv @ p) for p in poly]); f.smooth = (color == 'glass')
        for l in f.loops:
            l[uv].uv = u

# ---- 3. the visor: a smooth glass cap inside the rim (front = -y) ----
# find the opening: rays from far in front; inside the opening they travel deep before hitting
front_y = lo.y
def depth_at(x, z):
    hit = bvh.ray_cast(mw_inv @ Vector((x, front_y - 0.5, z)), Vector((0, 1, 0)))
    return (ob.matrix_world @ hit[0]).y - front_y if hit[0] else -1.0
pts = []
for i in range(-40, 41):
    for j in range(0, 81):
        x = i * 0.005; z = lo.z + j * 0.005
        d = depth_at(x, z)
        ex, ey, ez, ec = (hi.x - lo.x) / 2, (hi.y - lo.y) / 2, (hi.z - lo.z) / 2, (hi.z + lo.z) / 2
        q = 1 - (x / ex) ** 2 - ((z - ec) / ez) ** 2
        if d >= 0 and q > 0.05 and d - ey * (1 - math.sqrt(q)) > 0.03:     # much deeper than a closed shell
            pts.append((x, z))
xs = [p[0] for p in pts]; zs = [p[1] for p in pts]
cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
mid = [p[0] for p in pts if abs(p[1] - cz) < 0.02]
ax = min((max(mid) - min(mid)) / 2, 0.145); az = (max(zs) - min(zs)) / 2 + 0.008
rim = [depth_at(cx + ax * 0.9 * math.cos(t), cz + az * 1.2 * math.sin(t)) for t in [k * math.pi / 12 for k in range(24)]]
rim = sorted(d for d in rim if 0 <= d < 0.06)
ry = front_y + (rim[len(rim) // 2] if rim else 0.02) + 0.006       # glass front, just behind the rim
R = 0.2                                                            # the visor bends back like a sphere
def glass_y(x, z):
    return ry + R - math.sqrt(max(R * R - (x - cx) ** 2 - (z - cz) ** 2, 0))
print('visor', round(cx, 3), round(cz, 3), round(ax, 3), round(az, 3), 'glass y', round(ry, 3))
def inside(c, shrink=0.0):
    return ((c.x - cx) / (ax - shrink)) ** 2 + ((c.z - cz) / (az - shrink)) ** 2 < 1
inner = [f for f in bm.faces
         if (lambda c: inside(c, 0.004) and c.y < glass_y(c.x, c.z) + 0.002)(ob.matrix_world @ f.calc_center_median())]
bmesh.ops.delete(bm, geom=inner, context='FACES')
print('removed', len(inner), 'faces in front of the glass')
bvh = BVHTree.FromBMesh(bm)
NR, NT = 6, 32
def cap(rr, t):
    x = cx + ax * rr * math.cos(t); z = cz + az * rr * math.sin(t)
    return Vector((x, glass_y(x, z), z))
polys = []
for i in range(NR):
    for k in range(NT):
        t0, t1 = k * 2 * math.pi / NT, (k + 1) * 2 * math.pi / NT
        r0, r1 = i / NR, (i + 1) / NR
        q = [cap(r0, t0), cap(r1, t0), cap(r1, t1), cap(r0, t1)]
        polys.append(q[:3] if i == 0 else q)
add_faces(polys, 'glass')

# ---- 4. CCCP letters shaped onto the dome above the visor ----
bpy.ops.object.text_add()
t = bpy.context.object
t.data.body = 'CCCP'
t.data.align_x = 'CENTER'; t.data.align_y = 'CENTER'
t.data.size = 1.0; t.data.space_character = 1.15
font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
if os.path.exists(font):
    t.data.font = bpy.data.fonts.load(font)
t.data.resolution_u = 4
bpy.ops.object.convert(target='MESH')
tm = t.data
tb = bmesh.new(); tb.from_mesh(tm)
bmesh.ops.triangulate(tb, faces=tb.faces)
tv = [v.co.copy() for v in tb.verts]
w = max(v.x for v in tv) - min(v.x for v in tv)
LW = 0.17                                            # letters' width across the dome (m)
s = LW / w
top_z = cz + az + 0.03                              # just above the visor rim
H_L = 0.04                                          # letter height
for f in tb.faces:
    poly = []
    for v in f.verts:
        x, y = v.co.x * s, v.co.y * s
        # wrap: x -> angle round the dome, y -> angle up the dome; cast toward the dome centre
        ang = x / 0.19
        el = (top_z + H_L / 2 + y - C.z) / 0.19
        out = Vector((math.sin(ang) * math.cos(el), -math.cos(ang) * math.cos(el), math.sin(el)))
        hit, n, _, _ = bvh.ray_cast(mw_inv @ (C + out), (mw_inv.to_3x3() @ -out).normalized())
        if hit is None:
            break
        poly.append(ob.matrix_world @ hit + out * 0.0025)
    else:
        a, b2, c2 = poly
        if (b2 - a).cross(c2 - a).dot(a - C) < 0:
            poly = [a, c2, b2]
        add_faces([poly], 'red')
tb.free()
bpy.data.objects.remove(t)

bm.to_mesh(me); bm.free()
bpy.context.view_layer.objects.active = ob
for o in bpy.data.objects:
    o.select_set(o == ob)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_image_format='AUTO', use_selection=True,
                          export_jpeg_quality=88)
print('saved', OUT, len(me.polygons), 'faces')
