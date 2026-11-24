# Starward

A storytelling VR experience for Meta Quest, played in the Quest Browser (WebXR + three.js r170):
a playable documentary through the history of looking up at the sky. Era 1 follows people from
a Stone Age campfire to Ptolemy's model of the heavens, in 7 chapters, with Astra, a small glowing star,
as your guide. Astra narrates in Meem's voice. Plan: the "Era 1 Plan: Ancient Sky Watchers" doc.

**Era 2, The Telescope and the Rocket** (chapters n 8-14, shown as Era 2, Chapters 1-7) carries on
straight after Era 1: Copernicus on his tower at Frombork, Tycho's new star and Uraniborg, Kepler's
ellipses in Prague, Galileo's telescope in Venice and Padua, Newton's apple and cannon, the rocket
dreamers (Tsiolkovsky, Goddard, the V-2) and the launch of Sputnik. Shared Era 2 set helpers are in
`js/era2/common.js`; Meem's music loops are in `sounds/music/` (`index.json` maps chapter to file).

## Play

Open the GitHub Pages link in the Quest Browser and press **Enter VR**:
https://meembot93.github.io/Space-VR/

Built so far: **Chapter 2, Stonehenge at dawn** (the test chapter). Arrive on the misty plain
before sunrise, walk into the almost-finished circle, help the builders haul the last stone in
with the rope (grip it and pull hand over hand), and watch the midsummer Sun rise through the gap.

**Chapter 3, Sirius over the Nile.** Stand on a priest's rooftop in Egypt, 2500 BC, before dawn, with
the new pyramids behind you and the Nile in front. Watch the east and point at Sirius the moment she
rises again after months hidden in the Sun's glare (worked out for the real date and place), ring the
bell to wake the village, and watch a whole Egyptian year go by: Flood, Growing, Harvest. Then the
bridge: hold the Nebra sky disk up to the Pleiades on a German hilltop. Test: `npm run test:ch3` in tools/test.

**Chapter 4, Babylon predicts an eclipse.** Night on top of the ziggurat, the city and the
Euphrates below in the moonlight. Pick up the reed and press tonight's Moon into soft clay, pull
four old tablets off the shelf, see their eclipses line up every 18 years, and watch the full Moon
darken and turn copper-red right on time.

Address-bar options for testing: `?fast` (placeholder lines and timelines run quickly),
`?debug` (shows which narration clips are still missing; N skips a line on desktop),
`?chapter=2`, `?labels` (tags every stand-in model "PLACEHOLDER"), `?autostart` (desktop),
`?gfx=standard` or `?gfx=high` (graphics level), `?sharp=1.6` (pixels per eye in VR).

## Controls

**Quest** (same as Broadside VR): left stick walk, right stick snap turn (45°) or smooth turn,
grip = grab (the rope), trigger = touch (the journal page), B or Y = voice chat mic on/off,
hold either thumbstick pressed in for 1 second = reset your height.

**Seated / Standing** (title screen, remembered on the headset): Seated (default) lifts your
eyes to a grown-up's standing height (1.6 m) as VR starts, so sitting or being small doesn't put
you near the ground; Standing uses your real height. Tall players are never pushed down.
`?posture=standing` picks it from the address. `node tools/test/height-test.js` checks it.

**Desktop test mode:** click to look around, WASD to walk, hold the mouse on the rope and drag
down to pull (or tap E), click the journal page.

## Travel with friends

Up to 4 players. One presses **Host** on the title screen and reads out the 4-letter room code;
friends type it next to **Join**. Then everyone presses Enter VR. The host's headset runs the
story; everyone hears the same narration at the same time and anyone can haul the rope.
Voice chat is built in. Free and peer-to-peer (WebRTC via PeerJS). See docs/MULTIPLAYER.md.

## How it's built

- Plain ES modules, no build step. `index.html` loads `js/main.js`. three.js is vendored in `lib/`.
- `js/graphics.js`: the Graphics setting on the title screen. Standard is the original look (Quest 2).
  High (default on Quest 3, Quest Pro and PCs) draws more pixels per eye, adds real shadows from the
  Sun or Moon and from big fires, sharper textures, the full 2048-pixel character textures
  (`models/hd/`, listed as `"hd"` in `models/index.json`) and more Milky Way star dust. Chapters don't
  need to do anything; mark a mesh `userData.noShadow = true` if it shouldn't cast a shadow.
- `js/sky.js`: one sky for every chapter (stars, Milky Way, dawn colours, Sun, Moon), driven by the Sun's position.
- `js/chapters.js`: the chapter list and the director. Each chapter (`js/chapters/*.js`) builds its
  place and tells its story top to bottom: `await D.say('ch2_03')`, `await D.until(...)`.
- `js/narration.js` + `js/script.js`: every narration line, numbered. Meem's recorded clip plays if
  it exists (`sounds/narration/`), otherwise the line shows as a subtitle for about as long as it
  takes to say. No generated voices. How to record: docs/RECORDING.md.
- `js/guide.js`: Astra, the guide star (Meem's `models/star_guide.glb`).
- `js/people.js`: characters. Meem's Tripo models (rigged, Mixamo bone names, no animation clips)
  are posed in code: idle, haul, point, cheer. Anyone without a model yet is a plain "clay" stand-in.
  `tools/lineup.html?model=builder` previews every pose. Models: docs/ASSETS.md; first-pass stand-in models are made by `tools/models/derive.mjs`.
- `js/player.js`: you, your hands, the controls. Chapters add grabbable things to `G.interactables`.
- `js/net/`: multiplayer and voice chat, adapted from Broadside VR.
- `js/atmosphere.js`: golden-hour haze, ground mist, sea-breeze specks, moving firelight, dust in sunbeams (per chapter, reads chapter state only).
- `js/flight.js`: between chapters you glide along a timeline ribbon through the stars; it shows the next chapter's year and place (PLACES).
- `js/extras.js` + `js/wow/chN.js`: each chapter's big "wow" moment, living constellations and cameo
  characters, kept apart from the chapter's story file. They start on narration lines (on every headset)
  and can hold the story for a moment (`after(id, D)`). Chapter 7's file also has the Era 1 finale.
- `js/skyfigures.js` + `js/skyart.js`: living constellations, glowing figures (the Hunter, the Bull, the
  Lion, the Great Bear, the Scorpion, the Swan, the Seven Sisters as doves, the zodiac) drawn over the
  real stars and moving: `G.skyFigures.play('lion')`. `js/wow/echo.js`: ghostly "echo" cameo people.
  `js/wow/space.js`: the whole Earth from space (map: `data/earth.jpg`, made by `tools/sky/build_earth.py`).
- `js/soundscape.js`: steady 3D sounds placed in each chapter (fire, river, waves, crowds, leaves), one recipe per chapter.
- Sound effects and ambience are synthesized with WebAudio. Background music (`js/music.js`) is a
  soft generated score unless `sounds/music/index.json` lists a track for the chapter, e.g.
  `{ "ch2": "stonehenge.mp3" }`: drop in Meem's own music or a free track whose license allows any use.

## Testing

`cd tools/test && npm install && npm test` runs Chapter 2 in Chromium with Meta's IWER headset
emulator (a virtual Quest 3): enters VR, walks, snap-turns, grips and hauls the rope, checks the
sunbeam, touches the journal page. Add `--shots` to save screenshots.
`npm run test:ch4` plays Chapter 4 the same way: grips the reed and presses the six marks into
the clay, grabs the four glowing tablets, looks up at the Moon and checks it turns red.
`npm run test:ch7` plays Chapter 7: walks up the hall, touches Ptolemy's scroll, grips
and follows Mars around its backward loop, checks the small-circle-on-big-circle machine puts Mars in
the same place, hears Aristarchus, and touches the last journal page.

`node shot.js <chapter> <line id> <secs> <az> <el> out.png` saves a screenshot of a moment (SLOW=1 lets
lines play at real speed after that line; LOOK='js' points the view at something). `node trace.js <chapter>`
prints each narration line as the chapter plays itself.
`node audit-shots.js <chapter> <dir>` plays a chapter in Kids mode and saves two screenshots per narration
line, to check that what's on screen matches what Astra is saying.
`node clip-test.js <chapter ...>` plays chapters in Kids mode and checks everyone, twice a second, for
bodies clipping into the set (legs through a chair, a head inside a camera) and feet sunk or floating;
it exits with 1 and lists each problem with its narration line, person, body part and the mesh hit.

## Scenes that act out the story

- `D.cue('a word')` in a chapter's `run()` waits until the current line reaches that word, so the
  scene changes right as Astra says it (`const l = D.sayAsync('ch1_08'); await D.cue('walk by'); ...; await l;`).
- `js/people.js` poses: idle, pull, point, cheer, walk, talk, gasp, wave, work, carry, hold, write, beckon.
  `P.look` turns a head toward a point, `P.glance` makes someone look at you now and then,
  `walkToward` / `runRoutine` walk people around, `holdProp` puts a prop in a hand.
  `tools/lineup.html?model=builder&look&animals` previews them all.
- `js/life.js`: herds (reindeer, horses, goats, sheep, cows, donkeys, dogs, ibis, moose), bird flocks,
  dolphins, fish, smoke, cloth, torches. Each is one or two draw calls, except sheep, cows, horses,
  dogs and the moose: those are Meem's rigged Tripo models (one draw call per animal), walked,
  grazing and swishing their tails by turning their bones in code. Herds use lighter copies in
  `models/herd/` (about 5k triangles, the moose 8k), made from the originals in `models/` with
  `npx @gltf-transform/cli weld cow.glb w.glb` then `npx @gltf-transform/cli simplify w.glb herd/cow.glb --ratio 0.45 --error 0.01`.

## Version number (please keep it up to date)

`js/version.js` holds the version shown on the title screen. **Every change merged to main must
bump `VERSION` by 1 and update `CHANGES`**, so Meem can tell whether the headset has the newest build.
