# Home Was Nagasaki (v2 edit)

This is a re-edit of `shorts/yamaguchi`, made for audience retention. The original project, its assets and its final
video (`shorts/yamaguchi/final/home_was_nagasaki.mp4`) are unchanged. This folder holds the new version.

- **Length:** 76 s (v1: 95 s)
- **Shots:** 51, about 1.5 s each, cut on the narration's words
- **Opening:** a cold open on the second bomb, then a rewind to Hiroshima
- **Text on screen:** word-timed captions, place and date cards, and an end card
- **Story:** the campfire physics detour is gone. A family thread runs through it, and the boss no longer laughs (that line was invented in v1)

`SCRIPT.md` has the diagnosis, the script, and the fact check. Each fact is marked documented, reported, or illustrated.

| Path | What it is |
|---|---|
| `SCRIPT.md` | Diagnosis, narration as spoken, facts with sources |
| `voice/` | `tts.py` (Kokoro `am_fenrir` at 1.38x, passages spoken in one breath), `voice.wav`, `words.json`, `lines.json` |
| `remotion/edl.py` | The edit decision list, written to `edl.json`. Each segment poses one v1 shot at a source-frame range, optionally with a new camera angle. It also holds the white-outs, flashes, kicks, titles and captions, all in output frames, anchored to the words |
| `remotion/src/videos/yama2/` | A copy of the v1 world with v2 additions:<br>- `Short.tsx` plays the EDL: crossfades, captions, title cards, the rewind overlay<br>- `story.ts` `CAM2` holds the new angles: cold-open close-up, the floor after the blast, the boss's doubt, the worried close-up<br>- shot 33 (the cloud over Nagasaki)<br>- new expressions (`say`, `worried`, `sad`, `doubt`)<br>- dust in the office after the blast<br>- the office glow fades after the flash |
| `audio/soundtrack.py` | Score, SFX and mix, all timed from `edl.json` and the words.<br>- Music ducks 6 dB under speech. Silence at the white-outs.<br>- The mix is -15 LUFS, with true peak at -1.2 dBTP |
| `qa/` | `short_qa.py` and `shots.json` (the planned cuts) for the frame check |
| `final/home_was_nagasaki_v2.mp4` | The finished short: 1080x1920, 30 fps |

## Reproduce
In the working Remotion project (`/home/user/remo`; `sync.sh` copies its files here):
```bash
python3 voice/tts.py 1.38 voice
```
```bash
python3 remotion/edl.py /home/user/remo/src/videos/yama2/edl.json
```
```bash
cd audio && python3 soundtrack.py
```
```bash
COMP=YamaShortV2 node scripts/render_final.mjs out/final_v2 480 2
```
Then join the chunks with ffmpeg's concat demuxer, and mux with `audio/mix.wav` (`-map 0:v:0 -map 1:a:0`).
