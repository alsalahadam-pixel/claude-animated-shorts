# YOU'RE THE LAST HUMAN ALIVE… BUT SOMETHING IS WATCHING YOU.

A 60 s vertical (1080x1920, 30 fps) psychological horror short made with the `cartoon-3d-short` skill:
a hand-drawn 2D character (procedural Canvas2D drawing on camera-facing cards) inside a three.js 3D world,
rendered with Remotion. Script and shot list: `SCRIPT.md`.

| Path | What it is |
|---|---|
| `src/story.ts` | The shot timeline: cameras, poses, expressions, character lights, depth of field |
| `src/char/draw.ts` | The 2D character renderer (rig, cel shading, faces, the Watcher) |
| `src/world/` | Apartment, skyline, city, props, painted textures, the World that switches sets per shot |
| `src/LastHuman.tsx` | Composition: post chain (lens blur, bloom, tone map, grade, grain) and caption/title overlays |
| `voice/` | `tts.py` (Kokoro-82M, local) and `build_voice.py` (timeline, word timings, captions) |
| `audio/soundtrack.py` | Original synthesized score, sound design and the final mix (-14 LUFS, -1.2 dBTP) |
| `scripts/` | `stills.mjs`, `render_chunks.mjs` (per-shot render), `assemble.sh` (concat + mux) |

## Rebuild
```
npm install
python voice/tts.py <kokoro model.onnx> <kokoro-js voices dir> <tts out dir> am_michael 0.9
python voice/build_voice.py <tts out dir>          # voice/voice.wav, src/data/words.json, captions.json
python audio/soundtrack.py                         # audio/mix.wav
node scripts/stills.mjs Photo out/photo/p_ 0 1 && cp out/photo/p_0.jpg public/photo.jpg
node scripts/render_chunks.mjs                     # out/chunks/<shot>.mp4
scripts/assemble.sh                                # out/last_human_final.mp4
```
No GPU is needed: `scripts/chrome.sh` runs headless Chromium with SwiftShader (about 3-5 s per frame on 4 cores).
