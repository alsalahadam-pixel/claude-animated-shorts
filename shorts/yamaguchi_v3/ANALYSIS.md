# Home Was Nagasaki: Phase 1 analysis (V1 and V2), 2026-11-04
Inspected: the V1 final (95 s) and V2 final (76 s) at one frame per second, both narration tracks (measured: pitch,
pace, pauses, loudness), both scripts, the source project (sets, cast, cameras, edit list), the score, SFX and transitions.
Nothing has been changed yet.

## The short version: why people leave
1. **The story runs out of questions at 50 s (V2) or 47 s (V1).** The hook asks "how do you survive two atomic bombs?".
   V2 then answers every question by 50 s: he survives, his family survives. The last 26 s are an epilogue: statistics,
   a diagram, a biography summary. Nothing pulls the viewer to the end. This is the biggest retention problem in both versions.
2. **The narration reports instead of telling.**
   - 13 of 30 V2 lines start with "He" or "His", and almost every line is a plain event ("He spends the night... He tells his boss... He died...").
   - There is no sensory detail, no question to the viewer, and only one moment inside his head (the quote).
3. **The synthetic voice is flattest exactly where it matters most** (measured, see below).
   - The punch lines come out monotone.
   - The emotional lines are rushed.
   - Every sentence ends with the same downward fall.
   - This is the "not engaging" feeling you describe, and it is the hardest thing to fix with the tools in this sandbox.
4. **Stakes are told, never shown.**
   - We never see Hiroshima or Nagasaki destroyed.
   - After each flash we cut to the same generic orange plain.
   - "One bomb destroyed an entire city" is a tiny thought-bubble icon.
   - The cartoon mushroom cloud is soft and cute.
5. **V2's cold open spoils its own second act.** We see the office flash at 0 s, then sit through 9 s of the same office
   (31-40 s) waiting for something we already know happens, with no new information.

## Second by second: V2 (current, 76 s)
| Time | On screen | Narration | Risk | Problem |
|---|---|---|---|---|
| 0-2 | Bandaged CU in the office, the windows burn, white-out | "This man is about to survive an atomic bomb..." | low | Strong. The line is rushed (5.2 words/s) |
| 2-4 | The cloud, then a punch-in on his face | "...for the second time." | low | Strong payoff and curiosity |
| 4-5 | Rewind streaks over the train, field and sky | "Rewind three days." | low | Works. The line itself is flat (4.5 semitone range) |
| 5-10 | Ship sweep, HIROSHIMA card, name card | Date, "ship designer... finishing a work trip" | **high** | The hook's tension drops into a CV. Three text layers at once (place card + name card + captions). The ship shot is abstract |
| 10-14 | Walking home, the wife and baby bubble | "...going home to his wife Hisako and their baby boy" | low | Good human beat, but only 3 s, and it is the only time we see what he stands to lose |
| 14-16 | Shock face, hanko stamp, turns back | "But he forgot his hanko..." | low | Good, but rushed (5.8 words/s). The irony (a stamp put him there) is not landed |
| 16-17 | Clock 8:15 | "Eight fifteen." | low | OK |
| 17-21 | Near-empty blue sky, tiny plane and parachutes | "A plane flies over..." | **high** | 4 s of almost nothing on screen (lowest motion in the video) right where tension should peak |
| 21-23 | White-out | "Then... the sky turns white." | low | Works |
| 23-30 | Orange plain, dazed, injuries, shelter, train | 3 km, eardrums, burns, shelter, train | medium | Injuries pass in 2 s. No destroyed city. The same plain as the cold open |
| 28-31 | Crane up to Nagasaki | "Home... is Nagasaki." | low | Strong irony beat. Monotone delivery (4.6 semitone range) |
| 31-39 | The office: 6 near-identical medium shots, the boss's doubt | Back to work, tells his boss, boss doesn't believe him | **high** | We already saw this in the cold open. No new information, no countdown, no new angle. "His boss doesn't believe him" is spoken almost flat (1.3 semitones) |
| 39-41 | White-out, on the floor in the dust | "...fills the room. The blast throws him to the floor." | low | Good. "Throws him to the floor" is flat (2.9 semitones) |
| 42-47 | Cloud over Nagasaki, his worried face, the family bubble | Quote; "his wife and baby son were somewhere in that city" | low | The best emotional beat, but over in 3 s and rushed (5.0 words/s) |
| 48-50 | Tunnel, the family together | "They survived..." | medium | Releases all remaining tension at 63 % of the runtime |
| 50-54 | Lanterns | "...killed well over a hundred thousand people" | medium | The right image, but the only human cost in the film, and abstract |
| 54-59 | Target diagram, "close enough / far enough" | 3 km, the two lines | **high** | An explanation with nothing at stake. "3 km" was already said at 23 s |
| 59-67 | Podium, stamp, certificate, bench | Late life, 2009, died | **high** | Biography summary. The strongest late fact (officially he had survived only one bomb until 2009) is not used as a reveal |
| 67-70 | The two clouds | "Two atomic bombs. Three days apart." | low | Good rhythm |
| 70-76 | Bench, wide on the garden, end card | "...asking that there never be a third." | medium | Good last line. The picture is slow and the blossoms render as red/purple balls (off palette) |

## V1 (95 s), where the feedback came from
- 0-6: a slow hook (inside the train, a pass-by, a crane). The first event happens at 6 s.
- 7-11: holds on him standing at the ship with a blueprint (about 5 s with no change).
- 41-44: the boss laughs ("that's crazy"). This was invented dialogue, and the comic tone undercut the tragedy right before the second bomb.
- 52-57: lanterns for 6 s, then **58-71: the target diagram and campfire physics (about 14 s)**. This is almost certainly where
  "stopped halfway" happens: the climax has just finished and the video turns into a lecture.
- 80-95: recognition, podium, bench: 15 s of epilogue.

## Narration, measured (pyin pitch, word timings)
| | V1 | V2 |
|---|---|---|
| Voice | Kokoro TTS am_fenrir 1.31x | Kokoro TTS am_fenrir 1.38x |
| Pace | 3.62 words/s | 3.58 words/s |
| Pitch range (p5-p95) | 14.7 semitones | 15.2 semitones |

The overall numbers look fine. The problem is where the movement goes:
- **Flattest on the key lines.** In semitones of pitch range:
  - "His boss doesn't believe him": 1.3
  - "The blast throws him to the floor": 2.9
  - "Far enough to live": 3.6
  - "Two atomic bombs. Three days apart.": 4.1
  - "Close enough to be hurt": 4.3
  - "Rewind three days": 4.5
  - "Home... is Nagasaki": 4.6

  A human narrator lands these with the most movement. The TTS gives them the least, because short sentences get a default flat contour.
- **Rushed where it should slow down.** In words per second:
  - the hook: 5.2
  - "his wife and baby son were somewhere in that city": 5.0
  - "he forgot his hanko": 5.8

  The date lines are slow, about 3.1. The priorities are inverted: slow on facts, fast on feelings.
- **The same falling cadence on almost every sentence** (-5 to -9 semitones over the last 0.35 s). The ear hears a list being read.
- **No variety of distance.** The voice never gets close and quiet or big and urgent. Loudness varies only as much as normal speech.

Honest limit: Kokoro is the best TTS that runs offline here (HuggingFace is blocked, so no newer voice models).
Within it I can re-script for speech, direct it phrase by phrase, and audition other voices. A real person reading the script
(even a phone recording), or a premium TTS that you generate and send me, would move this more than anything else I can do.

## Script
- Strong material that is under-used (all documented):
  - He went back for a **name stamp**. A tiny errand put him under the bomb.
  - He was **explaining the first bomb when the second one hit**.
  - "**The mushroom cloud had followed me** from Hiroshima."
  - Officially he survived **only one bomb for 64 years**: he was registered for Nagasaki in 1957, and Hiroshima was added only in 2009.
  - He lived to **93**.
- Missing: what he saw, heard and felt (sources mention the flash, being blown over, ruptured eardrums, the burns).
  Also any line spoken to the viewer, and any question left open past the middle.
- Repeated: "3 km" (23 s and 54 s), the cloud-and-plain image (4 times), the office (cold open + 9 s).

## Picture
- **Strong:**
  - the style
  - the cold open
  - the rewind
  - the Nagasaki skyline under the cloud
  - the thought-bubble callbacks
  - the lanterns
  - the floor shot
  - captions and cards
- **Weak:**
  - dead sky shots (17-21 s)
  - no destruction shown
  - one generic plain standing in for two cities
  - static medium shots in the office
  - characters mostly stand facing the camera (little acting)
  - a soft, cute mushroom cloud
  - off-palette blossoms in the ending
  - old Yamaguchi (bald, glasses) has no visual link to young Yamaguchi
  - text layers stack at 6-9 s

## Sound
- The music is synthesized (plucks, music box, pads). It is clean but small, closer to a toy than a film score: no strings,
  piano or low brass, and no long arc to a final payoff. It builds into the flashes well, and the silences at the white-outs work.
- The SFX are synthesized and thin outside the blasts.
- The mix is safe (voice -15 LUFS, music ~13 LU under the words). That serves clarity, but it is timid for "cinematic":
  the music could rise harder between lines.

## Direction for V3 (pending the rest of your brief)
- **Restructure around a question that stays open to the last 10 s.** Use the 64-year fight to be believed: "For 64 years,
  officially, he had survived only one." It is documented and it pays off at the end.
- **Hold the family's fate open longer**, and give the wife and son a real scene before the first bomb.
- **Show the cities destroyed** in the existing style: a ruined variant of the street set, smoke, an orange sky. Also replace the dead sky shots.
- **Rewrite the narration for the ear**: shorter lines, varied sentence openings, sensory detail, the ironies landed. Direct
  the delivery phrase by phrase, and either audition other voices or use a human recording.
- **A fuller score** (strings and piano textures, a long arc) and a louder music bed between lines.
