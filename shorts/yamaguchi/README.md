# Home Was Nagasaki

A 90-second vertical cartoon short about Tsutomu Yamaguchi, the only person officially recognised as a survivor of both atomic bombings. It was made with this repo's skill (`SKILL.md`): flat cartoon characters in a three.js toon world, rendered in Remotion.

| Path | What it is |
|---|---|
| `SCRIPT.md` | Facts with sources, and the narration as spoken |
| `voice/` | `tts.py` (Kokoro TTS, `am_michael` at 1.345x, with per-phoneme durations), `voice.wav`, `words.json`, `lines.json` |
| `remotion/` | The Remotion project for this short (`src/videos/yama/`), plus helper scripts |
| `audio/` | `soundtrack.py` (original score, synthesized SFX, the mix), DSP and instrument kit from `templates/audio/`, `cues.md` |
| `qa/` | `short_qa.py` and `shots.json` for the frame-by-frame check |
| `final/` | `home_was_nagasaki.mp4`: the finished 89 s short, 1080x1920, -15.0 LUFS (v3: mood-driven narration) |

## Sets and shots
There is one world with six sets, and each shot shows only its own set (`story.ts` `SHOTS`, `sets.ts`):
- **rail**: rice paddies, track, telegraph poles, the train, and Nagasaki harbour ahead
- **street**: a Hiroshima street of machiya, the shipyard (ship on the slip, gantry crane), the 8:15 clock, the river with lanterns
- **field**: the plain under the distant mushroom cloud, and the night shelter
- **office**: the Mitsubishi drafting room, the boss's desk, and the hanko desk insert
- **camp**: the campfire, the two distance targets, and the heat diagram
- **garden**: the tunnel hill, the 2009 certificate, the podium with paper cranes, and the bench under the blossom tree

## Differences from the bridge template
- **No MSAA.** This sandbox renders with software WebGL, where 4x MSAA cost 4.3 s of 7.5 s per frame. The ink pass anti-aliases its own lines.
- **Lens blur depth.** Without MSAA, the lens blur reads a separate distance texture written by the ink pass (`ink.ts` `distRT`). Reading the composer's depth texture caused a framebuffer feedback loop and blank frames.
- **No FXAA.** postprocessing's `FXAAEffect` drew an oval artifact over the whole frame, so it is off.
- **Portrait framing.** The narrow 9:16 frame cannot fit wide two-shots. Characters in a two-shot stand within about 1.3 m of each other, and the camera sits behind them.
- **Far look points.** When a camera looks hundreds of metres away, use `zoom` (fov push), not `dolly`. A dolly pushes the lens toward the far look point and flies past the subject.

## Reproduce
```bash
cd remotion && npm i && npm i typescript@5.6.3
```
```bash
node scripts/render_final.mjs out/final 460 2
```
Then join the chunks with ffmpeg's concat, and mux with `audio/mix.wav` (`-map 0:v:0 -map 1:a:0`).
