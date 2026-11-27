# Blender tools (trial, 2026-11-27)

Claude builds and cleans models by running Blender from Python (`pip install bpy`, Blender 5.3), in the
cloud session, so nothing needs installing on Meem's Mac. Output is plain GLB, so it ports to Unity too.

- `kit.py`: hard-surface kit. Turned shapes, boxes, tubes, lettering, all in ONE mesh with ONE material
  (a palette texture for colour + one for roughness/metal), so a model is one draw call.
- `apollo_csm.py`: test prop, Apollo command + service module (about 6,300 triangles).
- `tripo_cleanup.py in.glb out.glb 14000 1024`: welds, removes crumbs, decimates a rigged Tripo
  character to a target keeping its rig and UVs, max 4 bone weights, shrinks textures.
- `view.html?file=out/x.glb&az=30&el=10`: look at a GLB in the game's renderer (run a local server at the repo root).

Outputs go to `out/` (not committed).
