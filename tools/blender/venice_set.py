# The Venice set for the Galileo chapter (ch11), made in Blender from the code-built one.
#   node tools/blender/export_scene.js 11 A venice_ground,venice_city tools/blender/out/venice
#   python3 -I tools/blender/venice_set.py tools/blender/out/venice models/sets/venice.glb
# (export_scene.js needs ?noset so it exports the code-built Venice, which it adds itself)
# What Blender adds:
#  1. The islands rebuilt with crisp outlines and stone quays dropping into the water (the old ground
#     was a 97k-triangle grid whose shores sloped across a whole grid square).
#  2. Soft shadows baked in (ambient occlusion): lanes, courtyards, the feet of walls and the Piazza's
#     edges darken. The city's go into its vertex colours (worked out here), the ground's into a texture (Cycles).
#  3. Every face you can never see from the belfry (or the bird's-eye peek above it) is removed.
import sys, os, math, random, time
import bpy, bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

src, out = [a for a in sys.argv if not a.endswith('.py')][-2:]
T0 = time.time()
def log(*a): print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)

TOPA = 48.0
LAND_Y = 1.2

# ---- Venice's land, as in js/chapters/galileo.js (game coords: x east, z south, y up) -----------
GC = [(-215, 110), (-300, 30), (-420, -60), (-520, -200), (-490, -380), (-600, -560), (-760, -640), (-900, -600)]
def seg_d(x, z, P):
    best = 1e9
    for (ax, az), (bx, bz) in zip(P, P[1:]):
        dx, dz = bx - ax, bz - az
        t = min(1, max(0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
        best = min(best, math.hypot(x - ax - dx * t, z - az - dz * t))
    return best
def box_sd(x, z, x0, x1, z0, z1):   # signed distance to an axis box (negative inside)
    cx, cz, hx, hz = (x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (z1 - z0) / 2
    qx, qz = abs(x - cx) - hx, abs(z - cz) - hz
    return math.hypot(max(qx, 0), max(qz, 0)) + min(max(qx, qz), 0)
def land_sd(x, z):
    """Signed distance to the shore: negative on land. Matches veniceLand() in galileo.js."""
    main = max(box_sd(x, z, -1300, 1150, -1300, 92), -box_sd(x, z, -1e5, -230, 60, 1e5))
    d = min(main, box_sd(x, z, -1350, -255, 105, 335), box_sd(x, z, -1500, -150, 395, 470), box_sd(x, z, 250, 420, 360, 470))
    return max(d, -(seg_d(x, z, GC) - 24))   # minus the Grand Canal

def G2B(x, y, z): return Vector((x, -z, y))       # game -> Blender
def B2G(v): return (v.x, v.z, -v.y)

# ---- import ------------------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(name):
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, name + '.glb'))
    o = [o for o in bpy.context.selected_objects if o.type == 'MESH'][0]
    o.name = name
    bpy.ops.object.select_all(action='DESELECT')
    return o
city = imp('venice_city')
occ = imp('occluders')
log('imported city', len(city.data.polygons), 'occluders', len(occ.data.polygons))

# ---- 1. the islands ----------------------------------------------------------------------------
X0, X1, Z0, Z1, STEP = -1504, 1164, -1312, 484, 4.0
nx, nz = int((X1 - X0) / STEP), int((Z1 - Z0) / STEP)
bm = bmesh.new()
grid = {}
def gv(i, j):
    k = (i, j)
    if k not in grid: grid[k] = bm.verts.new(G2B(X0 + i * STEP, LAND_Y, Z0 + j * STEP))
    return grid[k]
for i in range(nx):
    for j in range(nz):
        cx, cz = X0 + (i + 0.5) * STEP, Z0 + (j + 0.5) * STEP
        if land_sd(cx, cz) < 0:
            bm.faces.new((gv(i, j), gv(i, j + 1), gv(i + 1, j + 1), gv(i + 1, j)))
bm.verts.ensure_lookup_table()
# pull the staircase outline onto the true shore (Newton steps along the distance field's gradient)
for v in [v for v in bm.verts if v.is_boundary]:
    x, _, z = B2G(v.co)
    for _ in range(4):
        d = land_sd(x, z); e = 0.05
        gx = (land_sd(x + e, z) - land_sd(x - e, z)) / (2 * e); gz = (land_sd(x, z + e) - land_sd(x, z - e)) / (2 * e)
        g2 = gx * gx + gz * gz
        if g2 < 1e-6: break
        x -= d * gx / g2; z -= d * gz / g2
    v.co = G2B(x, LAND_Y, z)
log('shore snapped')
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.3)
log('land grid', len(bm.faces))
# quays: the shore edges drop as stone walls to below the water
edges = [e for e in bm.edges if e.is_boundary]
quay = bmesh.new()
qcol = quay.loops.layers.float_color.new('Color')
for e in edges:
    f = e.link_faces[0]
    a, b = e.verts
    # keep the wall's outside facing the water: same winding as the land face
    l = [l for l in f.loops if l.edge == e][0]
    if l.vert != a: a, b = b, a
    top_a, top_b = a.co.copy(), b.co.copy()
    bot_a, bot_b = top_a - Vector((0, 0, 1.7)), top_b - Vector((0, 0, 1.7))
    mid_a, mid_b = top_a - Vector((0, 0, 1.25)), top_b - Vector((0, 0, 1.25))
    vs = [quay.verts.new(p) for p in (top_b, top_a, mid_a, mid_b, bot_a, bot_b)]
    for quad, c in (((vs[0], vs[1], vs[2], vs[3]), (0.42, 0.38, 0.32)), ((vs[3], vs[2], vs[4], vs[5]), (0.12, 0.14, 0.10))):
        try:
            qf = quay.faces.new(quad)
        except ValueError:
            continue
        for lp in qf.loops: lp[qcol] = (*c, 1)
for f in quay.faces: f.normal_update()
# the land's top: just its outline, filled with as few triangles as possible (it carries a texture)
log('quays', len(quay.faces))
top = bmesh.new(); vm = {}
def tv(v):
    if v not in vm: vm[v] = top.verts.new(v.co)
    return vm[v]
bedges = [top.edges.new((tv(e.verts[0]), tv(e.verts[1]))) for e in edges if e.verts[0] != e.verts[1]]
bm.free(); bm = top
bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=bm.edges[:], normal=Vector((0, 0, 1)))
for f in bm.faces:
    f.normal_update()
    if f.normal.z < 0: f.normal_flip()
log('land top', len(bm.faces), 'tris')
ground_me = bpy.data.meshes.new('venice_ground'); bm.to_mesh(ground_me); bm.free()
ground = bpy.data.objects.new('venice_ground', ground_me); bpy.context.scene.collection.objects.link(ground)
quay_me = bpy.data.meshes.new('venice_quays'); quay.to_mesh(quay_me); quay.free()
quays = bpy.data.objects.new('venice_quays', quay_me); bpy.context.scene.collection.objects.link(quays)
log('ground', len(ground_me.polygons), 'tris; quays', len(quay_me.polygons), 'faces')

# ground UVs: a plain top-down map, split in two: the heart of the city round the Piazza (fine)
# and the rest (coarse). Each half gets its own baked texture.
CORE = (-420, 380, -420, 230)       # x0, x1, z0, z1: around the Piazza and the basin's shore
def split_core(obj):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    # cut the land along the core's edges so each face is wholly in or out
    for (axis, val) in (('x', CORE[0]), ('x', CORE[1]), ('z', CORE[2]), ('z', CORE[3])):
        if axis == 'x': co, no = G2B(val, 0, 0), Vector((1, 0, 0))
        else: co, no = G2B(0, 0, val), Vector((0, 1, 0))
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    inner = bmesh.new(); outer = bmesh.new()
    for f in bm.faces:
        c = f.calc_center_median(); x, _, z = B2G(c)
        dst = inner if CORE[0] <= x <= CORE[1] and CORE[2] <= z <= CORE[3] else outer
        dst.faces.new([dst.verts.new(v.co) for v in f.verts])
    res = []
    for nm, b, (x0, x1, z0, z1) in (('venice_ground_core', inner, CORE), ('venice_ground_far', outer, (X0, X1, Z0, Z1))):
        bmesh.ops.remove_doubles(b, verts=b.verts, dist=0.01)
        uv = b.loops.layers.uv.new('UVMap')
        for f in b.faces:
            for lp in f.loops:
                x, _, z = B2G(lp.vert.co)
                lp[uv].uv = ((x - x0) / (x1 - x0), 1 - (z - z0) / (z1 - z0))
        me = bpy.data.meshes.new(nm); b.to_mesh(me); b.free()
        o = bpy.data.objects.new(nm, me); bpy.context.scene.collection.objects.link(o)
        o['rect'] = (x0, x1, z0, z1)
        res.append(o)
    bm.free()
    return res
ground_core, ground_far = split_core(ground)
bpy.data.objects.remove(ground)
log('ground core', len(ground_core.data.polygons), 'far', len(ground_far.data.polygons))

# ---- 2. baked soft shadows (ambient occlusion) ---------------------------------------------------
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 48
world = bpy.data.worlds.new('w'); sc.world = world
world.light_settings.distance = 6.0     # how far a wall's shadow reaches
sc.render.bake.margin = 4

def select_only(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o

mat = bpy.data.materials.new('bake'); mat.use_nodes = True
for o in (city, quays, occ):
    o.data.materials.clear(); o.data.materials.append(mat)

# the ground: bake AO to an image, then paint the stone and paving colours under it
def value_noise(W, H, cell, seed):
    rnd = np.random.default_rng(seed)
    gw, gh = W // cell + 2, H // cell + 2
    g = rnd.random((gh, gw)).astype(np.float32)
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32) / cell
    xi, yi = xs.astype(int), ys.astype(int); fx, fy = xs - xi, ys - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = g[yi, xi] * (1 - fx) + g[yi, xi + 1] * fx; c = g[yi + 1, xi] * (1 - fx) + g[yi + 1, xi + 1] * fx
    return a * (1 - fy) + c * fy

def srgb2lin(c): c = np.asarray(c, np.float32) / 255; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def bake_ground(o, px):
    img = bpy.data.images.new(o.name + '_ao', px, px, alpha=False, float_buffer=True)
    m = bpy.data.materials.new(o.name); m.use_nodes = True
    t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = img
    m.node_tree.nodes.active = t
    o.data.materials.clear(); o.data.materials.append(m)
    select_only(o)
    log('baking', o.name, px)
    bpy.ops.object.bake(type='AO', target='IMAGE_TEXTURES', margin=8)
    aoi = np.array(img.pixels[:], np.float32).reshape(px, px, 4)[:, :, 0]   # rows bottom-up
    x0, x1, z0, z1 = o['rect']
    # world position of each texel (row 0 = bottom = v 0 = z1)
    xs = x0 + (np.arange(px) + 0.5) / px * (x1 - x0)
    zs = z1 - (np.arange(px) + 0.5) / px * (z1 - z0)
    X, Z = np.meshgrid(xs, zs)
    stone, paving = srgb2lin((0x9a, 0x8c, 0x78)), srgb2lin((0xc8, 0xbb, 0xa2))
    metres = (x1 - x0) / px
    nz = value_noise(px, px, max(2, int(30 / metres)), 7) * 0.5 + value_noise(px, px, max(2, int(6 / metres)), 8) * 0.15
    col = stone[None, None, :] * (1 - nz[..., None]) + paving[None, None, :] * nz[..., None]
    piazza = (X > -185) & (X < 110) & (Z > -60) & (Z < 95)
    col[piazza] = paving
    if metres < 0.6:   # the Piazza's grid of white stone stripes, painted in (they were thin boxes)
        stripe = srgb2lin((0xe8, 0xe0, 0xd0))
        sx = (np.abs(((X + 170) % 12) - 0.2) < 0.25) & (X > -170) & (X < 25) & (Z > -55) & (Z < 25)
        sz = (np.abs(((Z + 40) % 12) - 0.2) < 0.25) & (Z > -40) & (Z < 14) & (X > -170) & (X < 26)
        col[(sx | sz) & piazza] = stripe
    shade = 0.5 + 0.5 * aoi
    col = col * shade[..., None]
    col = np.where(col <= 0.0031308, col * 12.92, 1.055 * np.power(np.clip(col, 0, 1), 1 / 2.4) - 0.055)   # byte images hold sRGB
    out = np.concatenate([col, np.ones((px, px, 1), np.float32)], axis=2)
    final = bpy.data.images.new(o.name + '_tex', px, px, alpha=False)
    final.pixels = out.ravel()
    final.file_format = 'JPEG'
    m2 = bpy.data.materials.new(o.name + '_m'); m2.use_nodes = True
    bsdf = m2.node_tree.nodes['Principled BSDF']
    t2 = m2.node_tree.nodes.new('ShaderNodeTexImage'); t2.image = final; t2.extension = 'EXTEND'
    m2.node_tree.links.new(t2.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 1.0
    o.data.materials.clear(); o.data.materials.append(m2)
    final.pack()
# the other objects must be in the scene (they cast the shadows) but use plain materials
for o in (ground_core, ground_far):
    o.data.materials.clear(); o.data.materials.append(mat)
bake_ground(ground_core, 2048)
bake_ground(ground_far, 1024)
log('ground baked')

# ---- 3. remove what can't be seen ----------------------------------------------------------------
eyes = []
for h in (0.9, 1.35, 1.9):
    eyes.append(G2B(0, TOPA + h, 0))
for i in range(8):
    a = i * math.pi / 4
    for h in (1.2, 1.9):
        eyes.append(G2B(3.9 * math.cos(a), TOPA + h, 3.9 * math.sin(a)))
peek = [G2B(dx, TOPA + 31.6, dz) for dx, dz in ((0, 0), (3, 0), (-3, 0), (0, 3), (0, -3))]

def tri_data(objs, skip_tower=False):
    verts, polys, owner = [], [], []
    for oi, o in enumerate(objs):
        me = o.data; M = o.matrix_world; base = len(verts)
        verts += [M @ v.co for v in me.vertices]
        for p in me.polygons:
            if skip_tower:
                c = M @ p.center
                if math.hypot(c.x, c.y) < 14 and c.z > TOPA - 2: continue
            polys.append(tuple(base + i for i in p.vertices)); owner.append((oi, p.index))
    return verts, polys, owner

targets = [city, quays, ground_core, ground_far]
def build_bvh(skip_tower):
    v, p, owner = tri_data(targets + [occ], skip_tower)
    return BVHTree.FromPolygons(v, p, all_triangles=False, epsilon=0.0), owner
bvh_belfry, own_b = build_bvh(False)
bvh_peek, own_p = build_bvh(True)
log('BVHs ready')

def visible_faces(oi, o):
    me = o.data; M = o.matrix_world
    keep = np.zeros(len(me.polygons), bool)
    for p in me.polygons:
        c = M @ p.center
        nrm = (M.to_3x3() @ p.normal).normalized()
        pts = [c] + [c.lerp(M @ me.vertices[i].co, 0.8) for i in p.vertices[:4]]
        hit = False
        for bvh, own, E in ((bvh_belfry, own_b, eyes), (bvh_peek, own_p, peek)):
            for e in E:
                if (e - c).dot(nrm) <= 0: continue     # facing away from this eye
                for q in pts:
                    d = q - e; L = d.length
                    loc, n_, idx, dist = bvh.ray_cast(e, d / L, L + 0.05)
                    if idx is None or dist >= L - 0.05 or own[idx] == (oi, p.index):
                        hit = True; break
                if hit: break
            if hit: break
        keep[p.index] = hit
    return keep

# soft shadows for the city and quays, worked out here for each corner of each face we keep. (Cycles
# bakes colours exactly at the corners, where the next face over always half-shades them: dark seams
# along every roof edge. Here each corner looks out from a little way in from the corner instead.)
def hemi(n, rnd):
    out = []
    for _ in range(n):
        u, v = rnd.random(), rnd.random()
        r, t = math.sqrt(u), 2 * math.pi * v
        out.append((r * math.cos(t), r * math.sin(t), math.sqrt(max(0, 1 - u))))
    return out
DIRS = hemi(28, random.Random(5))
AO_R = 6.0
def corner_ao(o, keep, floor):
    me = o.data; M = o.matrix_world; ca = me.color_attributes[0]
    n = len(ca.data); col = np.empty(n * 4, np.float32); ca.data.foreach_get('color', col); col = col.reshape(-1, 4)
    for p in me.polygons:
        if not keep[p.index]: continue
        nrm = (M.to_3x3() @ p.normal).normalized()
        t = nrm.orthogonal().normalized(); b = nrm.cross(t)
        c = M @ p.center
        for li in p.loop_indices:
            v = M @ me.vertices[me.loops[li].vertex_index].co
            q = v.lerp(c, 0.3) + nrm * 0.03
            occl = 0.0
            for (x, y, z) in DIRS:
                d = t * x + b * y + nrm * z
                hit = bvh_belfry.ray_cast(q, d, AO_R)
                if hit[0] is not None: occl += 1 - hit[3] / AO_R
            ao = 1 - occl / len(DIRS)
            col[li, :3] *= floor + (1 - floor) * ao
    ca.data.foreach_set('color', col.ravel())

for oi, o in enumerate(targets):
    keep = visible_faces(oi, o)
    if o in (city, quays): corner_ao(o, keep, 0.62 if o is city else 0.55); log(o.name, 'shaded')
    bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
    gone = [f for f in bm.faces if not keep[f.index]]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bm.to_mesh(o.data); bm.free()
    log(o.name, 'kept', int(keep.sum()), 'of', len(keep))

# ---- export ---------------------------------------------------------------------------------------
# the quays join the city (same vertex-colour material, one draw call)
for o in (city, quays):
    o.data.materials.clear()
select_only(city); quays.select_set(True); bpy.ops.object.join()
bpy.data.objects.remove(occ)
bpy.ops.object.select_all(action='DESELECT')
for o in (city, ground_core, ground_far): o.select_set(True)
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (city, ground_core, ground_far))
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_image_format='JPEG',
                          export_jpeg_quality=85, export_attributes=False, export_vertex_color='ACTIVE')
log('exported', out, tris, 'triangles,', round(os.path.getsize(out) / 1e6, 2), 'MB')
