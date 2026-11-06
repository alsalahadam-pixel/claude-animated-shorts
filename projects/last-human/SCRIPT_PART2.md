# THE LAST HUMAN ALIVE: Part 2, "There are no cameras in your room."

A 46-second loop made for TikTok: 1380 frames at 30 fps, 1080×1920.

**Premise:** your phone starts showing a live night-vision feed of your own bedroom. The feed comes from the corner where the entity stood in Part 1. The film ends on its first frame, so it loops.

## Why it is built this way

These are the lessons from Part 1:
- **Frame 1 is the hook.** The night-vision feed and the big text are on screen from the first frame, with no fade-in. That frame is also the thumbnail.
- **Something happens every 4–5 seconds.** There is no black screen and no title card. The whole film is 46 s instead of 1:52.
- **It is brighter.** The camera's night vision reads in a bright feed, and the room shots are exposed brighter than in Part 1.
- **It loops.** The last shot is the first shot, and the last line ("So who's watching this?") leads into the first ("There are no cameras in your room."). The hiss runs through the seam, and the REC beep on frame 0 restarts it.
- **Text stays clear of TikTok's interface.** Captions avoid the top tabs, the button column and the caption block. During the grin and the message, captions move to the top.
- **It works without Part 1.** Viewers of Part 1 also get two callbacks: "It's done practising" and the corner seen in Part 1's exact framing.

## The edit

| Time | Shot | Picture | Voice |
|---|---|---|---|
| 0:00.0 | FEED, CAM 04 | Night-vision camera, REC, clock frozen at 06:12. Someone asleep in your bed. Big text: **PART 2 / THERE ARE NO CAMERAS IN YOUR ROOM**. | "There are no cameras in your room." |
| 0:02.8 | ROOM | You on the floor by the door, lit by the phone, reading it. | "So why is your phone showing you a live feed of it?" |
| 0:06.2 | FEED | It sits bolt upright like something pulled on a string. On "awake?" its head snaps round to the lens. The camera pans and zooms in on its own. | "And why is the one in your bed… awake?" |
| 0:10.6 | ROOM | The real bed: empty, the duvet thrown back. | (silence, one hit) |
| 0:13.0 | FEED | It is standing in the room, looking up at the lens. A tear in the picture, and it is closer. | "It's not in the bed anymore." |
| 0:16.6 | ROOM | The corner, in Part 1's last framing. Empty. | "It's not in the corner." |
| 0:19.8 | FEED | Your face fills the lens. Its eyes go white and glow, and it grins (the entity's grin, on your face). | "It's done practising." |
| 0:25.2 | FEED, CAM 07 | The feed switches to a camera right above the door, looking down at you and your phone. | "Then the feed switches… to the camera behind you." |
| 0:29.0 | ROOM | You. You don't move. You don't breathe. | (heartbeat) |
| 0:32.0 | ROOM | The phone buzzes. Message from "Me", now: a photo of you from that camera, and **"Don't turn around."** | "A message. From you." |
| 0:37.0 | ROOM | Above your head the door chain slides back, link by link, drops out and swings away. Your eyes go up; your head doesn't. | (chain, riser) |
| 0:41.5 | ROOM | You turn. Cut before you see. | (gasp) |
| 0:43.0 | FEED | Back to the first frame: someone asleep in your bed. | "So who's watching this?" → loops to 0:00 |

## Rules kept

- **Characters:** same protagonist, hoodie and palette. He never smiles: the face that grins has the entity's white eyes and the entity's grin.
- **Time:** every clock says 06:12, including the camera's timestamp.

## Files

| What | Where |
|---|---|
| Shots | `src/story.ts`: P2A–P2L and the `P2` edit table |
| New drawing and props | his face with the entity's eyes and grin (`possessed` in `src/char/draw.ts`); the chain undoing itself and the thrown-back duvet (`src/world/apartment.ts`); the message screen (`World.msgScreen`) |
| Night-vision look | `src/post/cctv.ts` |
| Voice | `voice/lines_part2.json`, `voice/build_voice_part2.py` |
| Sound | `audio/soundtrack_part2.py` (cues in `audio/cues_part2.md`) |
| Render | `PART=2 node scripts/render_final.mjs`, `PART=2 node scripts/render_overlay.mjs`, `PART=2 node scripts/assemble_final.mjs` |
| Cover | `Part2Cover` composition, frame 716 |

## Posting it on TikTok

- **Caption:** `There are no cameras in your room. #horror #scary #creepy #animation #thelasthumanalive`
- **Pinned comment:** `Which one is the real him? 👀`
- **Cover:** `out/last_human_PART2_cover.jpg` (the grin in the feed, "PART 2").
- **Playlist:** add Part 1 and Part 2 to one TikTok playlist ("The Last Human Alive") so viewers can binge.
- **Reaching Part 1's viewers:** post Part 2 as a video reply to a comment on Part 1 (or at least link it in a pinned comment on Part 1), so they're told it's out.
- **Don't add an end card or "follow for part 3".** It breaks the loop; ask in the pinned comment instead.

## Delivery

- **Upload copy:** `out/last_human_PART2_upload.mp4`, CRF 21, 83 MB.
- **Master:** `out/last_human_PART2.mp4`, CRF 17.
- **Both:** 1380 frames, 1080×1920, 30 fps.
- **Cover:** `out/last_human_PART2_cover.jpg`.
- **Mix:** -14.1 LUFS integrated, peak -1.0 dBFS.
- **QA (`scripts/qa.py`):**
  - No black or frozen frames.
  - Jumps occur only on the cuts, the sit-up, the glitch jump and the turn.
  - Mean brightness 0.25, about twice Part 1's 0.12.
- **Loop seam:** the last and first frames differ by 2.6/255, against 1.8 between any two neighbouring frames (that is the camera noise).
