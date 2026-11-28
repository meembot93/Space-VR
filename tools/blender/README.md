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
- `export_scene.js` + `venice_set.py`: the Venice set for ch11 (models/sets/venice.glb). Pulls the code-built
  city out of the game, rebuilds the islands with straight stone quays, bakes soft shadows, and drops every
  face you can't see from the belfry or the bird's-eye peek. `?noset` in the URL shows the old one.
- `setkit.py`: shared helpers for sets made of separate pieces (buildings, temples) with named procedural
  materials (stone courses, mud plaster, reed matting); bakes colour + soft shadows into one texture per group
  and exports each piece as its own node, so the game stands each on its own ground and merges them.
- `babylon_city.py`: Ch4's city houses (6 low-poly mud-brick kinds, stretched to each plot), the temple courtyard's crenellated walls and tower-gates (models/sets/babylon_city.glb). `?noset` = old boxes.
- `furniture.py`: Era 3 room furniture (desk, chair, table, shelf case, armchair, sofa; and the diner stool, booth, table, counter, jukebox and the blockhouse console) with bevels, wood grain and baked shadows (models/sets/furniture.glb); js/era3/sets.js places them through `Kit.addTextured`. `?noset` = boxes.
- `houses.py`: Era 2 town-house walls, gables and tiled roofs, plus Venetian facades (vwalls), roof_lo, funnel chimneys and altanas for Venice (models/sets/houses.glb), stretched and tinted per house by `house()` in js/era2/common.js (Tycho, Padua, Woolsthorpe, Kaluga). `?noset` = plain shapes.
- `giza.py`: Ch3's pyramids, temples, tombs and causeway (models/sets/giza.glb).
- `egypt_village.py`: Ch3's priest's house you stand on and the seven houses round it (models/sets/egypt_village.glb).
  `?noset` shows Ch3's old code-built ones too.
