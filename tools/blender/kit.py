# Small hard-surface kit for building Starward props in Blender from a Python script.
#
# Everything goes into ONE mesh with ONE material, so a model costs one draw call in the game.
# Colours come from a tiny palette texture (each face points its UVs at one swatch), and a second
# palette holds roughness/metalness per swatch, so silver can shine while a heat shield stays matte.
#
#   from kit import Kit
#   k = Kit({'silver': ((0.78, 0.79, 0.8), 0.3, 1.0), ...})      # name: (rgb 0-1, roughness, metalness)
#   k.lathe([(r, z), ...], segs=48, color='silver')                 # a turned shape around the z axis
#   k.box((x, y, z), (w, d, h), color='glass', rot=(rx, ry, rz))
#   k.export('/path/model.glb')
#
# Run with Blender's Python (Blender 4.2+ or `pip install bpy`):  python3 tools/blender/apollo_cm.py
import math
import bpy
import bmesh
from mathutils import Matrix, Vector, Euler

SW = 8      # swatches per row of the palette
PX = 8      # pixels per swatch


class Kit:
    def __init__(self, palette):
        self.names = list(palette)
        self.pal = palette
        self.bm = bmesh.new()
        self.col = self.bm.faces.layers.int.new('pal')

    def ci(self, name):
        return self.names.index(name)

    # ---- shapes -------------------------------------------------------------------------------
    def _faces(self, faces, color):
        for f in faces:
            f[self.col] = self.ci(color) if isinstance(color, str) else self.ci(color(f))

    def lathe(self, prof, segs=48, color='silver', m=Matrix(), a0=0.0, a1=2 * math.pi, colors=None):
        """Turn a profile [(r, z), ...] (listed bottom to top) around z. colors: fn(seg, band) -> name."""
        bm = self.bm
        full = abs(a1 - a0 - 2 * math.pi) < 1e-6
        n = segs if full else segs + 1
        rings = []
        for (r, z) in prof:
            if r < 1e-6:
                rings.append([bm.verts.new(m @ Vector((0, 0, z)))] * n)
            else:
                rings.append([bm.verts.new(m @ Vector((r * math.cos(a0 + (a1 - a0) * i / segs),
                                                       r * math.sin(a0 + (a1 - a0) * i / segs), z)))
                              for i in range(n)])
        for b in range(len(prof) - 1):
            lo, hi = rings[b], rings[b + 1]
            for i in range(segs):
                j = (i + 1) % n
                vs = [lo[i], lo[j], hi[j], hi[i]]
                uniq = []
                for v in vs:
                    if v not in uniq:
                        uniq.append(v)
                if len(uniq) < 3:
                    continue
                f = bm.faces.new(uniq)
                c = colors(i, b) if colors else color
                f[self.col] = self.ci(c)
        return rings

    def box(self, pos, size, color, rot=(0, 0, 0), bevel=0.0, m=None):
        bm = self.bm
        mat = m if m is not None else (Matrix.Translation(pos) @ Euler(rot).to_matrix().to_4x4())
        res = bmesh.ops.create_cube(bm, size=1.0, matrix=mat @ Matrix.Diagonal((*size, 1)))
        faces = list({f for v in res['verts'] for f in v.link_faces})
        self._faces(faces, color)
        if bevel > 0:
            edges = list({e for v in res['verts'] for e in v.link_edges})
            out = bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, affect='EDGES', profile=0.5)
            self._faces(out['faces'], color)
        return res

    def tube(self, m, r, h, color, segs=12, cap=True, r2=None):
        """A cylinder (or cone with r2) standing on the origin of matrix m, along its z."""
        r2 = r if r2 is None else r2
        prof = ([(0, 0)] if cap else []) + [(r, 0), (r2, h)] + ([(0, h)] if cap else [])
        return self.lathe(prof, segs=segs, color=color, m=m)

    def text(self, s, m, height, color, depth=0.01, wrap_r=None):
        """Flat lettering (Blender's own font) laid in the x/z plane of m. wrap_r bends it round a
        cylinder of that radius about m's z axis, so lettering sits on a round body."""
        cu = bpy.data.curves.new('t', 'FONT')
        cu.body = s; cu.size = height; cu.extrude = depth; cu.align_x = 'CENTER'
        cu.resolution_u = 2
        ob = bpy.data.objects.new('t', cu); bpy.context.scene.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get()
        me = ob.evaluated_get(dg).to_mesh()
        tmp = bmesh.new(); tmp.from_mesh(me)
        bmesh.ops.triangulate(tmp, faces=tmp.faces)
        vmap = {}
        for v in tmp.verts:
            x, y, z = v.co
            if wrap_r:
                a = x / wrap_r; rr = wrap_r + depth + z
                p = Vector((rr * math.sin(a), -rr * math.cos(a), y))
            else:
                p = Vector((x, -z, y))
            vmap[v] = self.bm.verts.new(m @ p)
        for f in tmp.faces:
            nf = self.bm.faces.new([vmap[v] for v in f.verts])
            nf[self.col] = self.ci(color)
        tmp.free(); ob.evaluated_get(dg).to_mesh_clear()
        bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)

    # ---- output -------------------------------------------------------------------------------
    def _palette_images(self):
        rows = math.ceil(len(self.names) / SW)
        W, H = SW * PX, rows * PX
        H2 = 1 << (H - 1).bit_length()
        col = bpy.data.images.new('palette', W, H2, alpha=False)
        mr = bpy.data.images.new('palette_mr', W, H2, alpha=False)
        mr.colorspace_settings.name = 'Non-Color'
        cp = [0.0] * (W * H2 * 4); mp = [0.0] * (W * H2 * 4)
        for idx, nm in enumerate(self.names):
            rgb, rough, metal = self.pal[nm]
            sx, sy = (idx % SW) * PX, (idx // SW) * PX
            for y in range(sy, sy + PX):
                for x in range(sx, sx + PX):
                    o = (y * W + x) * 4
                    cp[o:o + 4] = [*rgb, 1]
                    mp[o:o + 4] = [0, rough, metal, 1]
        col.pixels = cp; mr.pixels = mp
        col.pack(); mr.pack()
        return col, mr, W, H2

    def export(self, path, smooth_angle=35):
        col_img, mr_img, W, H = self._palette_images()
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        uv = bm.loops.layers.uv.new('UVMap')
        for f in bm.faces:
            i = f[self.col]
            u = ((i % SW) * PX + PX / 2) / W
            v = ((i // SW) * PX + PX / 2) / H
            for l in f.loops:
                l[uv].uv = (u, v)
        me = bpy.data.meshes.new('model')
        bm.to_mesh(me)
        ob = bpy.data.objects.new('model', me)
        bpy.context.scene.collection.objects.link(ob)
        for p in me.polygons:
            p.use_smooth = True
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
        except Exception:
            pass

        mat = bpy.data.materials.new('palette')
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes.get('Principled BSDF')
        t1 = nt.nodes.new('ShaderNodeTexImage'); t1.image = col_img; t1.interpolation = 'Closest'
        t2 = nt.nodes.new('ShaderNodeTexImage'); t2.image = mr_img; t2.interpolation = 'Closest'
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        nt.links.new(t1.outputs['Color'], bsdf.inputs['Base Color'])
        nt.links.new(t2.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
        nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
        me.materials.append(mat)

        for o in list(bpy.context.scene.objects):
            o.select_set(o == ob)
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                                  export_apply=True, export_yup=True)
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        print(f'exported {path}: {tris} triangles, 1 mesh, 1 material')
        return tris


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
