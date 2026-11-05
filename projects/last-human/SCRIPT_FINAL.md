# THE LAST HUMAN ALIVE: final cut

The final version combines the second-person hook and the ending of V1 with the strongest scenes of V3.
It runs 107.8 s (3233 frames at 30 fps) at 1080×1920.

- **From V1:** "You woke up today…", the corner, and "who's been watching you sleep?"
- **From V3:** the cameras, the reflection, the photo and the double.

## How it is built

The film is an edit (`FINAL` in `src/story.ts`). Each row shows a source shot from a source frame, optionally with a new camera. That lets the strongest V3 shots stay exactly as they were while weak or slow ones are recut, lengthened or re-shot.

| Pass | What | Where |
|---|---|---|
| Plates | 3D picture only, no text (`FinalPlate`) | `scripts/render_final.mjs` → `out/final/plates/` |
| Reused | V3 chunks with no text baked in: S13, S13B, S14, S16 | `out/chunks/` |
| Overlay | every word on screen, on transparency (`FinalOverlay`) | `scripts/render_overlay.mjs` → `out/final/overlay.mov` |
| Voice | `voice/build_voice_final.py` | `voice/voice_final.wav`, `src/data/captions_final.json` |
| Sound | `audio/soundtrack_final.py` (every cue locked to source frames through the edit table) | `audio/mix_final.wav`, `audio/cues_final.md` |
| Master | `scripts/assemble_final.mjs` | `out/last_human_FINAL.mp4` |

## The edit

| Time (s) | Shot | Picture | Narration |
|---|---|---|---|
| 0.00 | S02 | His eyes snap open on the pillow. | "You woke up today… and everyone was gone." |
| 1.87 | S03 | He jolts upright. | |
| 3.57 | S04 | Over his shoulder at the window, the empty city. Palm on the glass. | "No people. No cars moving. No voices." / "HELLO?!" (three echoes, then total silence) |
| 9.30 | S05 | At the glass, close. | "Nothing." "You're the last person alive." "Or at least…" |
| 14.23 | CAM | Night: the laundry camera turns until it stares down the lens. | "…that's what you think." |
| 15.97 | TITLE | THE LAST HUMAN ALIVE (boom) | |
| 17.97 | P1 | Day 1 sunrise: the phone on the nightstand (No Service, 06:12) beside the stopped clock. | "No signal. And every clock you find… says 06:12." |
| 22.37 | S06 | Day 2: the empty avenue. | "You search the city for hours." |
| 25.17 | PIGEON | A pigeon frozen mid-wingbeat; the camera drifts round it. | "A bird hangs in the air… mid-flight." |
| 28.37 | S07 | Fingers through frozen steam. | "Steam over a coffee cup… frozen like glass." |
| 31.97 | S08 | Dusk, the red light that never changes. | "The second they vanished… everything stopped." |
| 35.37 | S01 | Day 3 night: a crane down to the street; the camera turns to the empty spot before he arrives. | "And you haven't slept since." "On the third night… you notice the cameras." |
| 43.67 | S09 | Step left, it follows. Step right, it follows. | "You step left. It follows." "You step right. It follows." |
| 48.77 | S10 | Every camera turns. | "Then every single one… turns to follow you." |
| 52.37 | S11 | His face. | |
| 53.57 | S12 | Walking with his reflection. | "You tell yourself it's a glitch. You're tired. You're seeing things." |
| 57.87 | S13 / S13B | The mirror test (no narration). | |
| 62.67 | S14 | He steps back; the reflection takes one more step. | "Until your reflection… takes one more step than you do." |
| 65.67 | S15 | The reflection goes black and becomes it; the grin. | "It wasn't copying you." "It was practising." |
| 70.97 | S16 | SLAM. The chain. He slides down the door. | "You run home. You lock every door." |
| 73.17 | S17 | On the floor with the phone. It buzzes. | "Then, for the first time in three days… your phone buzzes." |
| 78.77 | S18 | A message from "Me": the photo, pushing in. | "A photo of you. Asleep." "Sent from your own number… one minute ago." |
| 84.77 | S19 | His face; his eyes go to the bed. | "But you haven't slept in three days." "So who's sleeping in your bed?" |
| 89.87 | S20 | The bed: him (the double), terrified, turning to the corner. | |
| 92.87 | E1 | Over his shoulder, into the corner (the exact framing of S21). Empty. One floorboard creaks. | (silence) |
| 95.27 | E2 | You on the floor: your eyes go to the corner, your head follows; you stop breathing. | "You're the last human alive." |
| 98.27 | E3 | From the corner, high, looking down at you. We hear it breathe. | "So who's been watching you sleep?" |
| 100.67 | S21 | The same frame as E1, but it is standing there, black against the dim wall. Its eyes open; it grins. Hard cut. | |
| 103.37 | BLACK | Silence; somewhere, one camera turns. | |
| 104.77 | TITLE | THE LAST HUMAN ALIVE | |

## Rules kept

- **Characters:**
  - Same protagonist, orange hoodie and 2D-in-3D style.
  - He never smiles. Only the entity grins, and its design is unchanged.
  - The one in the bed is the same guy, terrified of it.
- **Time:** no clock moves, and every clock says 06:12. On-screen labels give only the day and the hours awake.
- **Sound:** no wind, no traffic, no ticking. Only him, and "them".
- **Captions:**
  - They sit low on face close-ups and on the phone.
  - The last two lines are quieter and closer (dry voice, smaller white captions with no highlight).

## Delivery

- **Master:** `out/last_human_FINAL.mp4`, H.264 CRF 17 (331 MB).
- **Upload copy:** `out/last_human_FINAL_upload.mp4`, CRF 21 (117 MB).
- **Both:** 3233 frames, 1080×1920, 30 fps; mix at -14.1 LUFS, true peak -1.1 dBFS.
- **QA (`scripts/qa.py`):**
  - Black frames only at the title cards and the planned cut to black.
  - Holds only where the picture is meant to be still: the entity's stare, the empty corner, the titles.
  - Jumps only on the cuts and where the phone lights up.
