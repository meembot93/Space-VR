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

Fields: `file`, `height` (metres; the model is scaled to it, feet on the ground), optional
`turn` (degrees, if it faces the wrong way), optional `center` (true: centred on its middle, for
floating things like the guide). `tools/lineup.html?model=NAME` shows it in every pose.

Anything not listed shows as a plain "clay" stand-in (add `?labels` to the address to tag them).
