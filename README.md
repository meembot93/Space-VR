# Starward: Era 1, Watchers of the Sky

A storytelling VR experience for Meta Quest, played in the Quest Browser (WebXR + three.js r170):
a playable documentary through the history of looking up at the sky. Era 1 follows people from
a Stone Age campfire to Ptolemy's model of the heavens, in 7 chapters, with Astra, a small glowing star,
as your guide. Astra narrates in Meem's voice. Plan: the "Era 1 Plan: Ancient Sky Watchers" doc.

## Play

Open the GitHub Pages link in the Quest Browser and press **Enter VR**:
https://meembot93.github.io/Space-VR/

Built so far: **Chapter 2, Stonehenge at dawn** (the test chapter). Arrive on the misty plain
before sunrise, walk into the almost-finished circle, help the builders haul the last stone in
with the rope (grip it and pull hand over hand), and watch the midsummer Sun rise through the gap.

Address-bar options for testing: `?fast` (placeholder lines and timelines run quickly),
`?debug` (shows which narration clips are still missing; N skips a line on desktop),
`?chapter=2`, `?labels` (tags every stand-in model "PLACEHOLDER"), `?autostart` (desktop).

## Controls

**Quest** (same as Broadside VR): left stick walk, right stick snap turn (45°) or smooth turn,
grip = grab (the rope), trigger = touch (the journal page), B or Y = voice chat mic on/off.

**Desktop test mode:** click to look around, WASD to walk, hold the mouse on the rope and drag
down to pull (or tap E), click the journal page.

## Travel with friends

Up to 4 players. One presses **Host** on the title screen and reads out the 4-letter room code;
friends type it next to **Join**. Then everyone presses Enter VR. The host's headset runs the
story; everyone hears the same narration at the same time and anyone can haul the rope.
Voice chat is built in. Free and peer-to-peer (WebRTC via PeerJS). See docs/MULTIPLAYER.md.

## How it's built

- Plain ES modules, no build step. `index.html` loads `js/main.js`. three.js is vendored in `lib/`.
- `js/sky.js`: one sky for every chapter (stars, Milky Way, dawn colours, Sun, Moon), driven by the Sun's position.
- `js/chapters.js`: the chapter list and the director. Each chapter (`js/chapters/*.js`) builds its
  place and tells its story top to bottom: `await D.say('ch2_03')`, `await D.until(...)`.
- `js/narration.js` + `js/script.js`: every narration line, numbered. Meem's recorded clip plays if
  it exists (`sounds/narration/`), otherwise the line shows as a subtitle for about as long as it
  takes to say. No generated voices. How to record: docs/RECORDING.md.
- `js/guide.js`: Astra, the guide star (Meem's `models/star_guide.glb`).
- `js/people.js`: characters. Meem's Tripo models (rigged, Mixamo bone names, no animation clips)
  are posed in code: idle, haul, point, cheer. Anyone without a model yet is a plain "clay" stand-in.
  `tools/lineup.html?model=builder` previews every pose. Models: docs/ASSETS.md.
- `js/player.js`: you, your hands, the controls. Chapters add grabbable things to `G.interactables`.
- `js/net/`: multiplayer and voice chat, adapted from Broadside VR.
- Sound effects and ambience are synthesized with WebAudio.

## Testing

`cd tools/test && npm install && npm test` runs Chapter 2 in Chromium with Meta's IWER headset
emulator (a virtual Quest 3): enters VR, walks, snap-turns, grips and hauls the rope, checks the
sunbeam, touches the journal page. Add `--shots` to save screenshots.

## Version number (please keep it up to date)

`js/version.js` holds the version shown on the title screen. **Every change merged to main must
bump `VERSION` by 1 and update `CHANGES`**, so Meem can tell whether the headset has the newest build.
