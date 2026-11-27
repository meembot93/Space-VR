# Shared helpers for building Starward SETS in Blender (whole buildings and places, not props):
#   - Piece: one building or object, made of boxes, cylinders, slabs and free polygons, each face with
#     a named procedural material (stone in courses, mud plaster, reed matting...);
#   - bake_export(): lays every piece out apart, gives each group of pieces one UV atlas, bakes its
#     colours and soft ambient-occlusion shadows into one texture, and writes a GLB where each piece
#     is its own node (origin on its base) sharing that texture, so the game can place the pieces
#     on its own ground and merge each group into a single draw call.
# Blender axes: x east, y north, z up (the GLB comes out y-up, north = -z, as the game uses).
import math, os
import bpy, bmesh
import numpy as np
from mathutils import Vector

scene = None
MAT = {}


def reset():
    global scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    MAT.clear()


def srgb(h):
    c = [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# ---------------- material node helpers ----------------
class M:
    """A tiny node-graph builder: M(name) then chain helpers; out(color) finishes it."""
    def __init__(self, name):
        self.m = bpy.data.materials.new(name); self.m.use_nodes = True
        self.nt = self.m.node_tree; self.N = self.nt.nodes; self.L = self.nt.links
        self.tc = self.N.new('ShaderNodeTexCoord')
        MAT[name] = self.m

    def link(self, a, b): self.L.new(a, b)

    def obj(self): return self.tc.outputs['Object']

    def courses(self):
        """(along the wall, up) coordinates, so rows run level on any wall, leaning or not."""
        sep = self.N.new('ShaderNodeSeparateXYZ'); self.link(self.obj(), sep.inputs[0])
        add = self.N.new('ShaderNodeMath'); add.operation = 'ADD'
        self.link(sep.outputs['X'], add.inputs[0]); self.link(sep.outputs['Y'], add.inputs[1])
        comb = self.N.new('ShaderNodeCombineXYZ'); self.link(add.outputs[0], comb.inputs['X']); self.link(sep.outputs['Z'], comb.inputs['Y'])
        return comb.outputs[0]

    def rgb(self, c):
        n = self.N.new('ShaderNodeRGB'); n.outputs[0].default_value = (*c, 1); return n.outputs[0]

    def noise(self, scale, detail=6, rough=0.55, vec=None, dims='3D'):
        n = self.N.new('ShaderNodeTexNoise'); n.noise_dimensions = dims
        n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rough
        self.link(vec or self.obj(), n.inputs['Vector']); return n

    def brick(self, base, base2, mortar, row_h, width, mortar_w, vec=None):
        b = self.N.new('ShaderNodeTexBrick'); b.offset = 0.5
        b.inputs['Scale'].default_value = 1.0; b.inputs['Mortar Size'].default_value = mortar_w
        b.inputs['Brick Width'].default_value = width; b.inputs['Row Height'].default_value = row_h
        b.inputs['Color1'].default_value = (*base, 1); b.inputs['Color2'].default_value = (*base2, 1); b.inputs['Mortar'].default_value = (*mortar, 1)
        b.inputs['Mortar Smooth'].default_value = 0.2
        self.link(vec or self.courses(), b.inputs['Vector']); return b

    def mix(self, a, b, fac, mode='MIX'):
        n = self.N.new('ShaderNodeMix'); n.data_type = 'RGBA'; n.blend_type = mode
        if isinstance(fac, (int, float)): n.inputs['Factor'].default_value = fac
        else: self.link(fac, n.inputs['Factor'])
        for slot, v in (('A', a), ('B', b)):
            if isinstance(v, tuple): n.inputs[slot].default_value = (*v, 1)
            else: self.link(v, n.inputs[slot])
        return n.outputs['Result']

    def ramp(self, inp, stops):
        """stops: [(pos, value 0..1), ...] -> a greyscale mask"""
        r = self.N.new('ShaderNodeValToRGB'); el = r.color_ramp.elements
        for i, (p, v) in enumerate(stops):
            e = el[i] if i < len(el) else el.new(p)
            e.position = p; e.color = (v, v, v, 1)
        self.link(inp, r.inputs['Fac']); return r.outputs['Color']

    def wave(self, scale, axis='X', distortion=2.0, detail=3, vec=None, kind='BANDS'):
        w = self.N.new('ShaderNodeTexWave'); w.wave_type = kind; w.bands_direction = axis
        w.inputs['Scale'].default_value = scale; w.inputs['Distortion'].default_value = distortion; w.inputs['Detail'].default_value = detail
        self.link(vec or self.obj(), w.inputs['Vector']); return w

    def voronoi_edges(self, scale, width=0.03, vec=None):
        v = self.N.new('ShaderNodeTexVoronoi'); v.feature = 'DISTANCE_TO_EDGE'
        v.inputs['Scale'].default_value = scale
        self.link(vec or self.obj(), v.inputs['Vector'])
        return self.ramp(v.outputs['Distance'], [(0, 0), (width, 1)])   # 0 on the cracks

    def out(self, color, rough=0.85):
        bsdf = self.N['Principled BSDF']; self.link(color, bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = rough
        return self.m


def flat(name, c, var=0.12, scale=3.0):
    m = M(name)
    return m.out(m.mix(m.rgb(srgb(c)), m.noise(scale, 6).outputs['Fac'], var, 'OVERLAY'))


# ---------------- geometry ----------------
class Piece:
    def __init__(self, name, group):
        self.name, self.group = name, group
        self.bm = bmesh.new(); self.mats = []

    def mi(self, mat):
        if mat not in self.mats: self.mats.append(mat)
        return self.mats.index(mat)

    def poly(self, pts, mat):
        vs = [self.bm.verts.new(Vector(p)) for p in pts]
        f = self.bm.faces.new(vs); f.material_index = self.mi(mat); return f

    def box(self, c, s, mat, batter=0.0, rot=0.0, top=None, bottom=False, sides=None, taper_y=None):
        """c=(x, y, z-bottom) s=(w, d, h). batter: walls lean in by this at the top. top: material of
        the top face (None: same), False: no top. sides: [-y, +x, +y, -x] materials (or None)."""
        x, y, z = c; w, d, h = s
        bw, bd = w / 2, d / 2; tw, td = max(0.005, bw - batter), max(0.005, bd - batter)
        if taper_y is not None: td = taper_y / 2
        ca, sa = math.cos(rot), math.sin(rot)
        P = lambda px, py, pz: (x + px * ca - py * sa, y + px * sa + py * ca, pz)
        b = [P(-bw, -bd, z), P(bw, -bd, z), P(bw, bd, z), P(-bw, bd, z)]
        t = [P(-tw, -td, z + h), P(tw, -td, z + h), P(tw, td, z + h), P(-tw, td, z + h)]
        for i in range(4):
            j = (i + 1) % 4
            self.poly([b[i], b[j], t[j], t[i]], (sides[i] if sides and sides[i] else mat))
        if top is not False: self.poly(t, top or mat)
        if bottom: self.poly(b[::-1], mat)
        return t

    def cyl(self, c, r, h, mat, segs=8, r2=None, axis='Z', cap=True, rot=0.0):
        """Cylinder (or cone, r2) from point c along an axis ('Z' up, 'X' or 'Y' lying, or a vector)."""
        r2 = r if r2 is None else r2
        if isinstance(axis, str): ax = Vector({'X': (1, 0, 0), 'Y': (0, 1, 0), 'Z': (0, 0, 1)}[axis])
        else: ax = Vector(axis).normalized()
        u = ax.orthogonal().normalized(); v = ax.cross(u)
        c = Vector(c)
        lo = [c + (u * math.cos(2 * math.pi * i / segs + rot) + v * math.sin(2 * math.pi * i / segs + rot)) * r for i in range(segs)]
        hi = [c + ax * h + (u * math.cos(2 * math.pi * i / segs + rot) + v * math.sin(2 * math.pi * i / segs + rot)) * r2 for i in range(segs)]
        for i in range(segs):
            j = (i + 1) % segs
            self.poly([lo[i], lo[j], hi[j], hi[i]], mat)
        if cap:
            self.poly(hi, mat); self.poly(lo[::-1], mat)

    def lathe(self, c, prof, mat, segs=10):
        """A turned shape (jar, basket) standing at c: prof = [(radius, height), ...] bottom to top."""
        c = Vector(c); rings = []
        for (r, z) in prof:
            rings.append([c + Vector((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
        for k in range(len(prof) - 1):
            for i in range(segs):
                j = (i + 1) % segs
                if prof[k][0] < 1e-4 and prof[k + 1][0] < 1e-4: continue
                pts = [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]]
                if prof[k][0] < 1e-4: pts = [rings[k][i], rings[k + 1][j], rings[k + 1][i]]
                elif prof[k + 1][0] < 1e-4: pts = [rings[k][i], rings[k][j], rings[k + 1][i]]
                self.poly(pts, mat)

    def dome(self, c, r, h, mat, segs=10, rings=4):
        prof = [(r * math.cos(math.pi / 2 * k / rings), h * math.sin(math.pi / 2 * k / rings)) for k in range(rings + 1)]
        prof[-1] = (0, h)
        self.lathe(c, prof, mat, segs)

    def obj(self):
        me = bpy.data.meshes.new(self.name)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        self.bm.to_mesh(me); self.bm.free()
        for m in self.mats: me.materials.append(MAT[m])
        ob = bpy.data.objects.new(self.name, me); scene.collection.objects.link(ob)
        ob['group'] = self.group
        return ob


# ---------------- bake and export ----------------
def bake_export(pieces, out_path, tex_sizes, samples=24, ao_strength=0.6, jpeg_dir=None, saturation=1.0, gain=1.0):
    """pieces: [Piece]; tex_sizes: {group: pixels}. Writes out_path (GLB)."""
    from PIL import Image
    objs = [p.obj() for p in pieces]
    groups = {}
    for ob in objs: groups.setdefault(ob['group'], []).append(ob)
    # lay every piece out apart, on a floor that only catches their shadows
    x = 0
    for ob in objs:
        ob.location = (x, 0, 0); x += max(ob.dimensions.x, ob.dimensions.y) + 60
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x / 2, 0, -0.01)); ground = bpy.context.object
    ground.scale = (x + 400, 600, 1)
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = samples
    scene.render.bake.margin = 6
    scene.world = bpy.data.worlds.new('w'); scene.world.color = (1, 1, 1)
    finals = {}
    jpeg_dir = jpeg_dir or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
    os.makedirs(jpeg_dir, exist_ok=True)
    for gname, gobjs in groups.items():
        T = tex_sizes[gname]
        for o in scene.objects: o.select_set(False)
        for ob in gobjs: ob.select_set(True)
        bpy.context.view_layer.objects.active = gobjs[0]
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(50), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
        bpy.ops.uv.pack_islands(rotate=True, margin=0.003, shape_method='CONCAVE')
        bpy.ops.object.mode_set(mode='OBJECT')
        imgs = {}
        for kind in ('col', 'ao'):
            img = bpy.data.images.new(f'{gname}_{kind}', T, T, alpha=False)
            if kind == 'ao': img.colorspace_settings.name = 'Non-Color'
            for m in MAT.values():
                nt = m.node_tree; t = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage')
                t.name = 'BAKE'; t.image = img; nt.nodes.active = t
            if kind == 'col': bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)
            else: bpy.ops.object.bake(type='AO', use_clear=True)
            imgs[kind] = np.array(img.pixels[:]).reshape(T, T, 4)
            print('baked', gname, kind)
        lin = imgs['col'][..., :3] * ((1 - ao_strength) + ao_strength * imgs['ao'][..., :1])
        s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(np.clip(lin, 0, 1), 1 / 2.4) - 0.055)
        # colour grading: richer colours (procedural mixes come out a little washed), overall gain
        luma = (s * np.array([0.3, 0.59, 0.11])).sum(axis=2, keepdims=True)
        s = np.clip((luma + (s - luma) * saturation) * gain, 0, 1)
        jpg = os.path.join(jpeg_dir, gname + '.jpg')
        Image.fromarray((np.flipud(s) * 255 + 0.5).clip(0, 255).astype(np.uint8)).save(jpg, quality=88)
        img = bpy.data.images.load(jpg)
        mat = bpy.data.materials.new(gname); mat.use_nodes = True
        nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
        nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 0.9
        finals[gname] = mat
    for ob in objs:
        ob.data.materials.clear(); ob.data.materials.append(finals[ob['group']]); ob.location = (0, 0, 0)
        for p in ob.data.polygons: p.material_index = 0
    bpy.data.objects.remove(ground)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    for o in scene.objects: o.select_set(o in objs)
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True, export_yup=True,
                              export_image_format='JPEG', export_jpeg_quality=88, export_extras=False)
    tris = {ob.name: sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in objs}
    print('exported', out_path, tris, 'total', sum(tris.values()))
    return tris
