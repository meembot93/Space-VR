# The Giza set for Chapter 3 (Egypt, about 2500 BC), built in Blender:
#   the Great Pyramid (Khufu) and Khafre's, finished in polished white casing with a gilded capstone,
#   Menkaure's still being built (red granite lower courses, the stepped core, a mud-brick ramp,
#   blocks waiting), a queen's pyramid, a mastaba tomb, mortuary and valley temples, a stretch of
#   covered causeway and the low Sphinx temple.
# Each piece is its own node (its origin on the middle of its base, front/east along +x), so the
# game can stand each one on the uneven desert. All share ONE baked texture (stone colours, block
# joints and soft ambient-occlusion shadows), so the game merges them into one draw call.
#
#   python3 -I tools/blender/giza.py            (needs `pip install bpy`; writes models/sets/giza.glb)
import math, os, sys
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'models', 'sets', 'giza.glb')
TEX = 2048
SAMPLES = int(os.environ.get('SAMPLES', '24'))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------------- materials (procedural, baked away at the end) ----------------
def node_mat(name, base, mortar, row_h, brick_w, mortar_w=0.04, noise_amt=0.12, noise_scale=0.3, joint_dark=0.6, slant=False):
    """Stone in courses: Blender's brick texture driven by world-size coordinates (metres).
    Rows run horizontally whatever way a face leans (x+y along, z up)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    bsdf = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    add = N.new('ShaderNodeMath'); add.operation = 'ADD'
    L.new(sep.outputs['X'], add.inputs[0]); L.new(sep.outputs['Y'], add.inputs[1])
    comb = N.new('ShaderNodeCombineXYZ'); L.new(add.outputs[0], comb.inputs['X']); L.new(sep.outputs['Z'], comb.inputs['Y'])
    br = N.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = mortar_w
    br.inputs['Brick Width'].default_value = brick_w
    br.inputs['Row Height'].default_value = row_h
    br.inputs['Color1'].default_value = (*base, 1)
    br.inputs['Color2'].default_value = tuple(c * 0.9 for c in base) + (1,)
    br.inputs['Mortar'].default_value = (*mortar, 1)
    br.offset = 0.5; br.squash = 1.0
    L.new(comb.outputs[0], br.inputs['Vector'])
    # weathering: soft blotches of lighter and darker stone
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = noise_scale; nz.inputs['Detail'].default_value = 6
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'OVERLAY'
    mix.inputs['Factor'].default_value = noise_amt
    L.new(br.outputs['Color'], mix.inputs['A']); L.new(nz.outputs['Color'], mix.inputs['B'])
    L.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.8
    return m


def flat_mat(name, rgb, noise_amt=0.15, noise_scale=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    bsdf = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = noise_scale; nz.inputs['Detail'].default_value = 8
    L.new(tc.outputs['Object'], nz.inputs['Vector'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'OVERLAY'
    mix.inputs['Factor'].default_value = noise_amt
    mix.inputs['A'].default_value = (*rgb, 1)
    L.new(nz.outputs['Color'], mix.inputs['B'])
    L.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    return m


def srgb(h):
    c = [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


MAT = {
    # polished Tura limestone casing: fine joints, big courses about 1.4 m
    'casing': node_mat('casing', srgb(0xf1e9d6), srgb(0xb8aa8a), 1.45, 2.6, mortar_w=0.12, noise_amt=0.18, noise_scale=0.05),
    'casing_q': node_mat('casing_q', srgb(0xece2ca), srgb(0xb4a688), 0.9, 1.8, mortar_w=0.1, noise_amt=0.2, noise_scale=0.08),
    'granite': node_mat('granite', srgb(0xa86a5c), srgb(0x6e4238), 1.2, 2.2, mortar_w=0.05, noise_amt=0.35, noise_scale=1.5),
    'core': node_mat('core', srgb(0xcfb487), srgb(0x6a563c), 1.0, 1.6, mortar_w=0.09, noise_amt=0.4, noise_scale=0.4),
    'wall': node_mat('wall', srgb(0xd9ccad), srgb(0xa99a7a), 0.9, 1.7, mortar_w=0.05, noise_amt=0.25, noise_scale=0.15),
    'pave': node_mat('pave', srgb(0xddd0b0), srgb(0xb3a585), 1.5, 1.5, mortar_w=0.03, noise_amt=0.2, noise_scale=0.1),
    'mud': node_mat('mud', srgb(0x8e6e4a), srgb(0x6a5034), 0.18, 0.42, mortar_w=0.08, noise_amt=0.3, noise_scale=0.3),
    'gold': flat_mat('gold', srgb(0xf3d27a), 0.1, 3),
    'dark': flat_mat('dark', srgb(0x2a2118), 0.1),
    'rough': node_mat('rough', srgb(0xc9ae80), srgb(0x806a48), 1.3, 2.4, mortar_w=0.1, noise_amt=0.45, noise_scale=0.6),
    'red': flat_mat('red', srgb(0x9a4a3a), 0.2),
}


# ---------------- building helpers ----------------
class Piece:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []

    def mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def poly(self, pts, mat):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs); f.material_index = self.mi(mat)
        return f

    def box(self, c, s, mat, batter=0.0, rot=0.0, top_mat=None):
        """Box centred at c=(x,y,z-bottom) size s=(w,d,h); batter: how far each wall leans in at the top."""
        x, y, z = c; w, d, h = s
        bw, bd = w / 2, d / 2; tw, td = max(0.01, bw - batter), max(0.01, bd - batter)
        ca, sa = math.cos(rot), math.sin(rot)
        P = lambda px, py, pz: Vector((x + px * ca - py * sa, y + px * sa + py * ca, pz))
        b = [P(-bw, -bd, z), P(bw, -bd, z), P(bw, bd, z), P(-bw, bd, z)]
        t = [P(-tw, -td, z + h), P(tw, -td, z + h), P(tw, td, z + h), P(-tw, td, z + h)]
        for i in range(4):
            j = (i + 1) % 4
            self.poly([b[i], b[j], t[j], t[i]], mat)
        self.poly(t, top_mat or mat)
        return t

    def pyramid(self, b, h, mat, top=1.0, cap=0.0, cap_mat='gold', z0=0.0):
        """Square pyramid on the origin, base b, height h; top < 1 cuts it flat (unfinished);
        cap: the top fraction in another material (the gilded pyramidion)."""
        hb = b / 2
        def ring(k):
            r = hb * (1 - k); zz = z0 + h * k
            return [Vector((-r, -r, zz)), Vector((r, -r, zz)), Vector((r, r, zz)), Vector((-r, r, zz))]
        bands = [(0, top - cap if cap else top, mat)] + ([(top - cap, top, cap_mat)] if cap else [])
        for k0, k1, m in bands:
            lo, hi = ring(k0), ring(k1)
            for i in range(4):
                j = (i + 1) % 4
                if k1 >= 0.9999:
                    self.poly([lo[i], lo[j], Vector((0, 0, z0 + h))], m)
                else:
                    self.poly([lo[i], lo[j], hi[j], hi[i]], m)
        if top < 0.9999:
            self.poly(ring(top), mat)

    def obj(self):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-4)
        self.bm.to_mesh(me); self.bm.free()
        for m in self.mats:
            me.materials.append(MAT[m])
        ob = bpy.data.objects.new(self.name, me)
        scene.collection.objects.link(ob)
        return ob


def enclosure(p, half, wall_h=5.0, t=3.0):
    for (ox, oy, w, d) in [(0, -half, half * 2 + t, t), (0, half, half * 2 + t, t), (-half, 0, t, half * 2 - t), (half, 0, t, half * 2 - t)]:
        p.box((ox, oy, -1.5), (w, d, wall_h + 1.5), 'wall', batter=0.35, top_mat='wall')
    p.box((0, 0, -1.0), (half * 2 - t, half * 2 - t, 1.3), 'pave')     # the paved court (sinks into the sand)


rng = np.random.default_rng(7)
pieces = []

# The two finished pyramids: casing, capstone, court and enclosure wall
for name, b, h in [('khufu', 230, 146), ('khafre', 215, 143)]:
    p = Piece(name)
    p.pyramid(b, h, 'casing', cap=0.035, z0=0.3)
    enclosure(p, b / 2 + 14)
    pieces.append(p)

# Menkaure's, half built: granite casing to 16 %, the stepped core to 62 %, a mud-brick ramp up the
# east side (+x), blocks and sledges waiting at its foot
p = Piece('menkaure')
b, h = 105, 65
p.pyramid(b, h, 'granite', top=0.16, z0=0.3)
n = 14
for i in range(n):
    k0 = 0.16 + (0.62 - 0.16) * i / n; k1 = 0.16 + (0.62 - 0.16) * (i + 1) / n
    w = b * (1 - k0) - 1.2
    p.box((0, 0, 0.3 + h * k0), (w, w, h * (k1 - k0)), 'core', batter=0.15)
rise, rl, xt = h * 0.62, 150, b * 0.19
ang = math.atan2(rise, rl)
# the ramp: a long sloping causeway of mud brick with sloping sides, its top a packed-earth road
L_ = math.hypot(rl, rise)
for side in (-1, 1):
    p.poly([Vector((xt, side * 7, 0.3 + rise)), Vector((xt + rl, side * 7, 0)), Vector((xt + rl, side * 9.5, 0)), Vector((xt, side * 9.5, 0.3 + rise - 2))][::(1 if side > 0 else -1)], 'mud')
    p.poly([Vector((xt, side * 9.5, 0.3 + rise - 2)), Vector((xt + rl, side * 9.5, 0)), Vector((xt + rl, side * 9.5, -2)), Vector((xt, side * 9.5, -2))][::(1 if side > 0 else -1)], 'mud')
p.poly([Vector((xt, -7, 0.3 + rise)), Vector((xt + rl, -7, 0)), Vector((xt + rl, 7, 0)), Vector((xt, 7, 0.3 + rise))][::-1], 'mud')
# blocks: a few on the working level, many at the foot of the ramp, and on sledges
for i in range(34):
    bx = xt + rl + 6 + rng.random() * 32; by = -15 + rng.random() * 30
    p.box((bx, by, 0), (2.4, 1.6, 1.3), 'rough', rot=rng.random() * 3)
for i in range(8):
    w = b * (1 - 0.62) - 1.2
    p.box(((rng.random() - 0.5) * (w - 6), (rng.random() - 0.5) * (w - 6), 0.3 + rise), (2.2, 1.5, 1.2), 'rough', rot=rng.random() * 3)
for i in range(4):     # a block on its sledge, part way up the ramp
    f = 0.2 + i * 0.2
    p.box((xt + rl * f, -3 + (i % 2) * 6, rise * (1 - f) + 0.3), (2.6, 1.7, 1.3), 'rough', rot=0)
enclosure(p, b / 2 + 12)
pieces.append(p)

# A queen's pyramid (three stand beside Khufu's)
p = Piece('queen'); p.pyramid(48, 30, 'casing_q', z0=0.2); p.box((0, 0, -1), (52, 52, 1.2), 'pave'); pieces.append(p)

# A mastaba tomb: flat-topped with sloping walls, a false door and a little offering chapel on the east
p = Piece('mastaba')
p.box((0, 0, -1), (12, 24, 7), 'wall', batter=1.1)
p.box((6.05, 2.5, 0), (0.25, 1.4, 3.0), 'dark')                       # the false door (a dark niche)
p.box((6.05, -4.5, 0), (0.25, 1.0, 2.6), 'dark')
p.box((7.2, 2.5, -0.5), (2.5, 4.5, 3.0), 'wall', batter=0.15)          # the chapel
p.box((8.46, 2.5, 0), (0.06, 1.1, 2.0), 'dark')
pieces.append(p)

# The mortuary temple: high battered walls round an open court with square granite pillars,
# a hall at the back against the pyramid (-x), the doorway east (+x) where the causeway arrives
p = Piece('mortuary_temple')
W, D, H = 46, 40, 10
for (ox, oy, w, d) in [(0, -D / 2 + 2, W, 4), (0, D / 2 - 2, W, 4), (-W / 2 + 2, 0, 4, D - 8), (W / 2 - 2, -12, 4, D / 2 - 6), (W / 2 - 2, 12, 4, D / 2 - 6)]:
    p.box((ox, oy, -1), (w, d, H + 1), 'wall', batter=0.4)
p.box((-W / 2 + 12, 0, -1), (16, D - 8, H + 0.5), 'wall', batter=0.2)    # the inner hall block
p.box((-W / 2 + 20.05, 0, 0), (0.3, 4, 6), 'dark')                       # its door into the court
p.box((W / 2 - 2, 0, 0), (4.6, 5, 7.5), 'dark')                         # the entrance
p.box((4, 0, -0.5), (24, D - 8, 0.6), 'pave')
for i in range(6):
    for side in (-1, 1):
        p.box((-6 + i * 4.2, side * 11.5, 0), (1.3, 1.3, 7.5), 'granite', top_mat='granite')
p.box((4, 11.5, 7.5), (26, 3.5, 0.8), 'granite'); p.box((4, -11.5, 7.5), (26, 3.5, 0.8), 'granite')   # roof beams over the colonnades
pieces.append(p)

# The valley temple, by the water: a square block cased in granite, two doors east, a landing quay
p = Piece('valley_temple')
p.box((0, 0, -1), (42, 42, 11), 'granite', batter=0.6, top_mat='pave')
p.box((21.0, -9, 0), (1.0, 4, 7), 'dark'); p.box((21.0, 9, 0), (1.0, 4, 7), 'dark')
p.box((27, 0, -1.2), (10, 50, 1.6), 'pave')
pieces.append(p)

# One 10 m stretch of the covered causeway (walls, a roof with a light slit), along x
p = Piece('causeway')
p.box((0, 0, -2), (10.05, 9, 2.5), 'wall')                               # its raised base
p.box((0, -3.9, 0.5), (10.05, 1.2, 4), 'wall'); p.box((0, 3.9, 0.5), (10.05, 1.2, 4), 'wall')
p.box((0, -2.2, 4.5), (10.05, 3.4, 0.5), 'pave'); p.box((0, 2.2, 4.5), (10.05, 3.4, 0.5), 'pave')
pieces.append(p)

# The Sphinx temple in front of the Sphinx: low, with a pillared court
p = Piece('sphinx_temple')
p.box((0, 0, -1), (36, 34, 5), 'granite', batter=0.3, top_mat='pave')
for i in range(5):
    p.box((-12 + i * 6, 0, 4), (1.2, 1.2, 1.6), 'granite')
p.box((18.05, 0, 0), (0.5, 4, 3.5), 'dark')
pieces.append(p)

objs = [p.obj() for p in pieces]

# ---------------- lay out side by side for baking (so they don't shade each other) ----------------
x = 0
home = {}
for ob in objs:
    ob.location = (x, 0, 0); home[ob.name] = x
    x += 380
# a sand floor under each, for the shadows at their feet (not exported)
bpy.ops.mesh.primitive_plane_add(size=1, location=(x / 2, 0, -0.02)); ground = bpy.context.object
ground.scale = (x + 800, 800, 1)

# ---------------- one UV atlas for all pieces ----------------
for o in scene.objects: o.select_set(False)
for ob in objs: ob.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(50), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.uv.pack_islands(rotate=True, margin=0.002, shape_method='CONCAVE')
bpy.ops.object.mode_set(mode='OBJECT')

# ---------------- bake colour and ambient occlusion ----------------
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
img_col = bpy.data.images.new('giza_col', TEX, TEX, alpha=False)
img_ao = bpy.data.images.new('giza_ao', TEX, TEX, alpha=False); img_ao.colorspace_settings.name = 'Non-Color'


def target(img):
    for m in MAT.values():
        nt = m.node_tree
        t = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage')
        t.name = 'BAKE'; t.image = img
        nt.nodes.active = t


scene.render.bake.margin = 8
scene.render.bake.use_selected_to_active = False
target(img_col)
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)
print('baked colour')
scene.world = bpy.data.worlds.new('w'); scene.world.color = (1, 1, 1)
target(img_ao)
scene.render.bake.use_clear = True
bpy.ops.object.bake(type='AO', use_clear=True)
print('baked occlusion')

col = np.array(img_col.pixels[:]).reshape(TEX, TEX, 4)
ao = np.array(img_ao.pixels[:]).reshape(TEX, TEX, 4)[..., :1]
lin = col[..., :3] * (0.42 + 0.58 * ao)
s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.clip(lin, 0, 1), 1 / 2.4) - 0.055)
final = bpy.data.images.new('giza', TEX, TEX, alpha=False)
px = np.concatenate([s, np.ones((TEX, TEX, 1))], axis=2)
final.pixels = px.ravel().tolist()
final.colorspace_settings.name = 'sRGB'
# (Blender treats the float buffer as linear when saving; write it out ourselves instead)
final.file_format = 'JPEG'
tmp = os.path.join(HERE, 'out'); os.makedirs(tmp, exist_ok=True)
jpg = os.path.join(tmp, 'giza.jpg')
from PIL import Image
Image.fromarray((np.flipud(s) * 255 + 0.5).clip(0, 255).astype(np.uint8)).save(jpg, quality=88)
final = bpy.data.images.load(jpg)

# ---------------- one plain material with the baked texture, then export ----------------
mat = bpy.data.materials.new('giza'); mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
t = nt.nodes.new('ShaderNodeTexImage'); t.image = final
nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.85
for ob in objs:
    ob.data.materials.clear(); ob.data.materials.append(mat)
    ob.location = (0, 0, 0)
bpy.data.objects.remove(ground)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
for o in scene.objects: o.select_set(o in objs)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True,
                          export_image_format='JPEG', export_jpeg_quality=88)
tris = {ob.name: sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in objs}
print('exported', OUT, tris, 'total', sum(tris.values()))
