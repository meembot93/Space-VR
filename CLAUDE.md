# Notes for Claude

- Starward: WebXR storytelling VR (Quest Browser), three.js r170 in `lib/`, plain ES modules, no build step. See README.md.
- **Every PR merged to main must bump `VERSION` in `js/version.js` by 1 and replace `CHANGES`
  with 2-4 short words-only items on what changed.** The title screen shows it; Meem uses it to check the headset has the newest build.
- Narration is ONLY Meem's own recordings (`sounds/narration/`, imported with `tools/narration/import.py`).
  Never add synthetic/TTS voices. Missing clips show as subtitles.
- Characters are Meem's Tripo models (~14k tris, rigged with Mixamo bone names, no clips), shrunk with
  `npx @gltf-transform/cli resize --width 1024 --height 1024`, listed in `models/index.json`. Budget: under
  300-500k tris per scene, few draw calls. Stand-ins in `js/people.js` until a model arrives.
- Run `tools/test` (IWER headset emulator) after changing controls or a chapter's story.
- Meem has no game-dev background: give click-by-click steps for anything they must do.
