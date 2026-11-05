# THE LAST TRAIN — Episode 1 previz (animatic)

A 3D blockout of all 30 storyboard shots, rendered frame by frame with three.js in headless Chromium, with synthesized sound design and scratch dialogue. Use it to lock **timing, camera, staging and the sound mix** before paying for final animation or AI generation.

It is **not** the final look. The characters are stand-in figures built from primitives, and the voices are scratch text-to-speech (re-record with real actors). Small subtitles and a shot slug (`PREVIZ S07 0:15.4`) are burned in for review.

## What's here
| Path | What it is |
|---|---|
| `src/world.js` | Halloran Cross sets: Platform 2 and the train (around x=0); escalator, mezzanine corridor, signal room and shutter (x 184–260). Geography matches the series bible §10. |
| `src/people.js` | Posable stylized figures (Kai, Wren, the Tall Man, the Commuter, the Night Runner, passengers), using the character bible's LOCK details. |
| `src/shots.js` | The 30 shots on one 88-second timeline: camera keys, blocking, light changes, board and phone states, and the "rule of two" pack behaviour. |
| `src/textures.js` | Every readable sign drawn on canvas (board, door warning, phone screens, EXIT sign). |
| `src/main.js`, `src/overlay.js` | Renderer and post (bloom, grade, vignette, grain, impact kick), the A/B split-screen vote, temp subtitles. |
| `render.mjs` | Captures frames from headless Chromium and pipes them to ffmpeg. Also renders stills. |
| `audio/lines.json`, `audio/vo.py` | Scratch dialogue: Piper TTS per line, fitted to its screenplay slot, then given whisper, radio, phone, PA or through-steel treatment. |
| `audio/sound.py` | Synthesized SFX and original score for every storyboard cue, mixed to −14 LUFS. |

## Rebuild
```bash
npm install                                    # three.js
python audio/vo.py <piper_voices_dir> out      # out/vo_stem.wav + out/vo_timing.json
python audio/sound.py out                      # out/mix.wav
node render.mjs --stills 1.5,25.8,72.8         # check frames
for i in 0 1 2; do node render.mjs --w 720 --h 1280 --from $((i*704)) --to $(((i+1)*704)) --out out/seg/seg$i.mp4 --port $((8810+i)) & done; wait
```
Then join the segments and mux with `out/mix.wav` (see the ffmpeg lines in the session notes or `concat` demuxer).

Voices used (from the Piper v0.0.2 GitHub releases): `en-us-ryan-high` (Kai), `en-us-libritts-high` (Ruth, Wren, Lucy; cast by measured pitch, children pitched up), `en-gb-southern_english_female-low` (PA). Python needs `numpy scipy piper-tts` and the repo's `templates/audio/dsp.py`.

## Shots the animatic changed
See the end of `../05_ep01_storyboard.md`: S6, S12, S14, S20, S24, S25, S27 and S28 were restaged because the boarded framing didn't work in real 3D space or in a vertical frame.
