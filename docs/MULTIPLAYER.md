# Travelling with friends (up to 4)

Same design as Broadside VR (its docs/MULTIPLAYER.md has the full background).

1. **Host:** type your name (optional), press **Host**. A 4-letter room code appears. Pick the chapter, press Enter VR.
2. **Friends:** open the same link, type the code next to **Join**, press it, then Enter VR. Friends can join any time.
3. The host's headset runs the story; friends follow the host's state 20 times a second and hear
   each narration line when the host's guide says it. Anyone can grab the rope; every pull counts.
4. Voice chat: the browser asks for the mic when you press Host or Join. B/Y in VR (M on desktop)
   turns your mic on and off; the title screen has a volume slider and Mute for each friend.

| Piece | Where |
|---|---|
| Transport (PeerJS WebRTC, room id `starward-era1-CODE`; `?net=local` = two tabs, no network) | `js/net/transport.js` |
| Host/friend messages: hello, welcome, s (chapter state + poses), e (say, sfx, placePlayers, chapterStart/End), a (actions), p (pose) | `js/net/net.js` |
| Friends' figures, gloves and name tags | `js/net/avatar.js` |
| Voice chat | `js/net/voice.js` |

A chapter only has to keep its shared progress in one plain object (`getState()/setState()`),
handle actions in `act()`, and derive everything it draws from that state in `update()`.
