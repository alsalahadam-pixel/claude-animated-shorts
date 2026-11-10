# THE LAST HUMAN ALIVE: Part 3, "It has your face."

A 2:02 action-horror episode for TikTok: 3660 frames at 30 fps, 1080×1920. It sets up the finale (Part 4).

**The rule this episode introduces:** it can appear anywhere a camera can see you.

## The edit

| Time | Shot | Picture | Voice |
|---|---|---|---|
| 0:00 | T01 | **First frame:** the door already flung open; your own face in the lit doorway, white eyes, grinning. Text: **PART 3 / IT HAS YOUR FACE** | "You turned around… and it was already inside." |
| 0:03 | T02 | You scramble backwards across the floor; it steps in, in jerks, like a broken video. | "It looks exactly like you. It moves… nothing like you." |
| 0:09 | T03 | Your face; its hand, your own hand, reaches in and over your eye. You bolt. | **RUN!** |
| 0:13 | T04 | Outside: you crash through the window onto the fire escape and run past the camera. It appears at the window, then crawls down the brick wall upside down, eyes glowing. | |
| 0:20 | T05 | The street at night: you run toward us; every camera on the street snaps to you, red lights on. | "And every camera in the city… wakes up." |
| 0:27 | T06 | Far down the street, under a camera: it is already there. | "It's already there." |
| 0:31 | T07 | You turn and run the other way, and it's standing right in front of you. | "You run the other way. It's there too." |
| 0:36 | T08 | The camera's own night-vision feed: you run through; it glitches into the picture and looks up at the lens. | "It can go anywhere a camera can see you." |
| 0:42 | T09 | The laundry camera's feed: you, below it, raise a pipe and swing; NO SIGNAL. | "So you break them." |
| 0:46 | T10A | Across the street: the smashed camera hangs sparking; you rip the cable down the wall and the cameras above die pair by pair in bursts of sparks. | "One by one." |
| 0:50 | T10B | At the crossing the cameras still alive swing to you, and under them it is standing in the road. | |
| 0:54 | T10C | The SUBWAY sign: you run for it and down into the dark. | |
| 0:58 | T11 | Down the stairwell toward us, lit green by the EXIT sign. | "There's only one place in this city with no cameras." |
| 1:05 | T12 | The platform, pitch black: your phone torch sweeps tiles and pillars. | "Underground." |
| 1:12 | T13 | Your phone buzzes: a live night-vision feed of you, from behind, on this platform. | "Your phone buzzes. A live feed… of you." "There are no cameras down here." |
| 1:18 | T14 | You spin round with the light: nothing. You turn back toward the far end and lift the light. | |
| 1:23 | T15 | **The far end of the platform is full of them.** Rows of tall grey figures; their eyes open; they all lean. | |
| 1:28 | T16A | You sprint for the train and dive in. The dead ceiling lights stutter on, and in every flash they're closer. | **RUN!** |
| 1:32 | T16B | Inside the car the doors slam shut, and your own grinning face presses to the door glass. | |
| 1:36 | T17 | Through the window the station clock flips to **06:13**, the first clock to move since it all began. The train pulls into the tunnel, past them standing along the walls. | "For three days, nothing moved. Now… the train does." |
| 1:48 | T19 | Your reflection in the dark window opposite; beside it two eyes open, then the other one, grinning. | "You're not alone on this train." |
| 1:54 | T20A | You look beside you: the seat is empty. | |
| 1:55 | T20B | Back to the glass: it's leaning in to your reflection's ear, grinning wider. Hard cut. | |
| 1:59 | END | **PART 4 · FINALE** | |

## Rules kept

- **Characters:**
  - The real him never smiles. Every grin belongs to the entity, wearing his face.
  - The protagonist, the hoodie and the palette are unchanged.
- **Time:** every clock says 06:12 until the train moves.

## Posting it on TikTok

- **Caption:** `It can go anywhere a camera can see you. #horror #scary #creepy #animation #thelasthumanalive`
- **Pinned comment:** `Where is the train taking him? Part 4 is the finale.`
- **Cover:** `out/last_human_PART3_cover.jpg`
- **Series:** add it to the series playlist and post it as a video reply to a comment on Part 2.

## Files

| What | Where |
|---|---|
| Shots | `src/story.ts`: Part 3 section, `P3` edit table |
| Sets | `src/world/part3.ts` (hallway, fire escape, subway, train, crowd, sparks, torch, street entrance) |
| Voice | `voice/lines_part3.json`, `voice/build_voice_part3.py` |
| Sound | `audio/soundtrack_part3.py` (cues in `audio/cues_part3.md`) |
| Render | `PART=3 node scripts/render_final.mjs`, `PART=3 node scripts/render_overlay.mjs`, `PART=3 node scripts/assemble_final.mjs` |

## Delivery

- **Upload copy:** `out/last_human_PART3_upload.mp4`, CRF 22, 107 MB.
- **Master:** `out/last_human_PART3.mp4`.
- **Both:** 3660 frames; mix at -14.1 LUFS integrated.
- **QA:** every shot was reviewed in stills before rendering, over four rounds, and the full video was checked after assembly.
- **Dark frames:** the only near-black frames are intentional: the torch clicking on, the dark between the light flashes and the end-card fade.
