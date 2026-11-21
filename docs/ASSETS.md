# Models and where they go

Meem makes each character in Tripo from one front picture (list and descriptions: the Era 1 plan
doc, "Characters to make in Tripo"), auto-rigged as **Humanoid with the Mixamo skeleton**, about
14,000 triangles. No animation clips are needed: the game poses the bones in code.

To add one: shrink its textures (`npx @gltf-transform/cli resize in.glb out.glb --width 1024 --height 1024`),
put it in `models/`, and list it in `models/index.json` under the name the code asks for:

| Name in index.json | File | Used for | Status |
|---|---|---|---|
| `star_guide` | star_guide.glb | the guide, every chapter | in |
| `builder` | stonehenge_builder.glb | Ch 2 haulers, pit team and crowd | in |
| `storyteller` | ice_age_storyteller.glb | Ch 1 | received, waits for Ch 1 |
| `priest` | egyptian_priest.glb | Ch 3 priest-astronomer | in |
| `skywatcher` | babylonian_skywatcher.glb | Ch 4 sky-watcher, apprentice and townspeople | in |
| `architect` | egyptian_architect.glb | Ch 3 ghostly pyramid architect on the roof | first pass by Claude |
| `villager` | egyptian_villager.glb | Ch 3 villagers walking out with lamps (light, ~5k) | first pass by Claude |
| `sailor` | sponge_crew.glb | Ch 6 crew at the diver's air pump | first pass by Claude |
| `instrument_maker` | instrument_maker.glb | Ch 6 ghostly Greek instrument maker | first pass by Claude |
| `builder_far` | stonehenge_builder_far.glb | Ch 2 crowd and torch-carrying families, far off (light, ~5k) | first pass by Claude |

## First-pass models (made by Claude, swap any time)

The ones marked "first pass by Claude" were made from Meem's own Tripo models by
`tools/models/derive.mjs`: same skeleton, repainted (wig, grey hair, apron, new clothes colours),
a little reshaped, and for the "light" ones simplified to about 5,000 triangles with a 512 texture.
To replace one with a better Tripo model, export it with the usual recipe, shrink its textures,
and save it over the file of the same name in `models/` (or change `file` in `models/index.json`).
For a light one, also shrink it: `npx @gltf-transform/cli simplify in.glb out.glb --ratio 0.37`.

Fields: `file`, `height` (metres; the model is scaled to it, feet on the ground), optional
`turn` (degrees, if it faces the wrong way), optional `center` (true: centred on its middle, for
floating things like the guide). `tools/lineup.html?model=NAME` shows it in every pose.

Anything not listed shows as a plain "clay" stand-in (add `?labels` to the address to tag them).
