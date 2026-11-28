# Clean up a rigged Tripo character in Blender and make a lighter copy that keeps its rig.
#   python3 tools/blender/tripo_cleanup.py in.glb out.glb [target_tris=14000] [texture_px=1024]
# Steps: drop any stray extra meshes (each one is an extra draw call),
# weld split vertices, delete tiny floating crumbs, decimate to the target while keeping UVs and bone
# weights, keep at most 4 bone influences per vertex, shrink the textures, and export one skinned mesh.
import sys, os, math
import bpy, bmesh

# props (no rig) can also be resized to real size, with the origin moved to the middle of their base:
#   --h=0.38 (height in metres) or --len=3.1 (longest side across the ground)
opts = dict(a[2:].split('=') for a in sys.argv if a.startswith('--') and '=' in a)
args = [a for a in sys.argv if not a.endswith('.py') and not a.startswith('--')]
src, out = args[-4:-2] if len(args) >= 4 else args[-2:]
nums = [a for a in sys.argv[1:] if a.isdigit()]
target = int(nums[0]) if nums else 14000
px = int(nums[1]) if len(nums) > 1 else 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
body = max(meshes, key=tris)
report = {'before_tris': tris(body), 'stray_meshes': []}
shapes = {pb.custom_shape for a in bpy.data.objects if a.type == 'ARMATURE' for pb in a.pose.bones}
for o in meshes:
    if o is not body:   # (the importer's own bone-display shapes are not in the file: not reported)
        if o not in shapes: report['stray_meshes'].append(f'{o.name} ({tris(o)} tris at {tuple(round(c, 2) for c in o.matrix_world.translation)})')
        bpy.data.objects.remove(o)

bm = bmesh.new(); bm.from_mesh(body.data)
v0 = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
report['welded_verts'] = v0 - len(bm.verts)
# floating crumbs: islands with few vertices AND tiny size (buttons, eyes etc. are kept)
H = max(v.co.z for v in bm.verts) - min(v.co.z for v in bm.verts) or 1
H = max(H, max(v.co.y for v in bm.verts) - min(v.co.y for v in bm.verts))
seen, crumbs = set(), []
for v in bm.verts:
    if v in seen: continue
    st, isl = [v], []
    seen.add(v)
    while st:
        x = st.pop(); isl.append(x)
        for e in x.link_edges:
            y = e.other_vert(x)
            if y not in seen: seen.add(y); st.append(y)
    lo = [min(p.co[i] for p in isl) for i in range(3)]; hi = [max(p.co[i] for p in isl) for i in range(3)]
    if len(isl) < 12 and max(h - l for h, l in zip(hi, lo)) < 0.004 * H:
        crumbs += isl
report['crumb_verts_deleted'] = len(crumbs)
bmesh.ops.delete(bm, geom=crumbs, context='VERTS')
bm.to_mesh(body.data); bm.free()

# decimate, keeping UV seams and weights (Blender's collapse decimate carries vertex groups along)
cur = tris(body)
if target and cur > target:
    mod = body.modifiers.new('dec', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'; mod.ratio = target / cur; mod.use_collapse_triangulate = True
    mod.delimit = {'UV', 'SEAM'}
    bpy.context.view_layer.objects.active = body
    # the armature modifier must stay last, so move decimate to the top
    while body.modifiers[0].name != 'dec':
        bpy.ops.object.modifier_move_up(modifier='dec')
    bpy.ops.object.modifier_apply(modifier='dec')
# weights: at most 4 bones, summing to 1
bpy.context.view_layer.objects.active = body
body.select_set(True)
bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
if body.vertex_groups:   # (animals come unrigged: nothing to limit)
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
bpy.ops.object.mode_set(mode='OBJECT')

for im in bpy.data.images:
    if im.size[0] > px:
        im.scale(px, px)
report['after_tris'] = tris(body)

if ('h' in opts or 'len' in opts) and not any(o.type == 'ARMATURE' for o in bpy.data.objects):
    from mathutils import Vector, Matrix
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in bpy.data.objects if o.type == 'MESH' for v in o.data.vertices]
    lo = Vector([min(p[i] for p in pts) for i in range(3)]); hi = Vector([max(p[i] for p in pts) for i in range(3)])
    size = hi - lo
    f = float(opts['h']) / size.z if 'h' in opts else float(opts['len']) / max(size.x, size.y)
    m = Matrix.Scale(f, 4) @ Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)))
    for o in bpy.data.objects:
        if o.parent is None:
            o.matrix_world = m @ o.matrix_world
    report['size_m'] = [round(c * f, 2) for c in size]

for o in bpy.data.objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_image_format='AUTO',
                          export_skins=True, export_animations=False, export_jpeg_quality=88)
report['file_mb'] = round(os.path.getsize(out) / 1e6, 2)
print('REPORT', report)
