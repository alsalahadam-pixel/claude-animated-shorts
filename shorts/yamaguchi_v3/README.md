# Home Was Nagasaki (V3)

V3 pushes the V2 edit further, in the same style with the same characters. V1 (`shorts/yamaguchi`) and V2
(`shorts/yamaguchi_v2`) are unchanged.

- **Length:** 75.7 s, 54 shots
- **Opening:** a cold open with a flash-cut to the Hiroshima cloud, then the white-out with a stamped 11:02 AM card, then the question "How do you survive that... twice?"
- **Bombing:** the first bombing is rebuilt with new angles (a low look-up to the bomber, telephoto parachutes, his face burning white), a late-arriving blast and a ringing silence
- **Office:** the return to work is motivated (he is reporting on Hiroshima)
- **Aftermath:** the human core: his family survived because his wife had gone out to find ointment for his burns
- **Ending:** the name is held back until the end: "His name was Tsutomu Yamaguchi"
- **Narration:** Kokoro, directed phrase by phrase, with the best of several takes per line
- **Score:** a new synthesized score with strings, piano and low brass

`SCRIPT.md` has the scene-by-scene diagnosis, the script and the fact check (documented, reported or illustrated).
`ANALYSIS.md` has the full second-by-second analysis of V1 and V2.

| Path | What it is |
|---|---|
| `voice/` | `tts.py`: directed passages with take selection (style-row and speed takes, scored on pitch movement and voice identity). Also `voice.wav`, `words.json`, `lines.json`, and `takes.json` (which take won for each line) |
| `remotion/edl.py` | The V3 edit decision list, written to `edl.json`. It holds:<br>- segments, with an optional camera and grade<br>- white-outs<br>- burn-ups<br>- cards on the white<br>- flashes and kicks<br>- titles, including the name reveal<br>- captions |
| `remotion/src/videos/yama3/` | A copy of the V2 world with V3 additions:<br>- `Short.tsx`: burn-up, white cards, memory grade, name card<br>- `story.ts`: the `lookUp`, `chutes`, `faceUp` and `benchSad` cameras<br>- `cast.ts`: his shocked face at the flash, him in the sky shots, the grieving old man<br>- `sets.ts`: paler blossoms |
| `audio/cine.py` | Synthesized strings, felt piano, braam, riser, sub drop |
| `audio/soundtrack.py` | Score, SFX and mix, all timed from `edl.json` and the words: -15 LUFS, true peak -1.2 dBTP |
| `qa/` | `short_qa.py`, `make_shots.py` and `shots.json` (the planned cuts) |
| `final/home_was_nagasaki_v3.mp4` | The finished short: 1080x1920, 30 fps |

## Reproduce
```bash
python3 voice/tts.py 1.45 voice
```
```bash
python3 remotion/edl.py /home/user/remo/src/videos/yama3/edl.json
```
```bash
cd audio && python3 soundtrack.py
```
```bash
COMP=YamaShortV3 node scripts/render_final.mjs out/final_v3 456 2
```
Then concatenate the chunks and mux with `audio/mix.wav` (`-map 0:v:0 -map 1:a:0`).
