"""Generate the voice-over lines with Kokoro-82M (local ONNX, no network).

usage: python -I tts.py <model.onnx> <kokoro-js voices dir> <out dir> [voice] [speed]
Writes one wav per line (24 kHz mono) plus lines.json with durations and phoneme counts per word.
"""
import json, sys, os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

LINES = [
    "You wake up... and every other human on Earth is gone.",
    "No traffic. No voices. Not even birds.",
    "Every screen shows the same static.",
    "You search the city for days.",
    "Doors left open. Dinners half eaten.",
    "Cars still waiting at red lights that never turn green.",
    "Then you notice the cameras.",
    "Every single one is turning... to follow you.",
    "You tell yourself it's just a glitch.",
    "Until your reflection takes one more step than you do.",
    "You run home. You lock every door.",
    "Then, for the first time in days, your phone buzzes.",
    "A photo of you, asleep... taken from inside this room.",
    "You're the last human alive.",
    "So who is watching you sleep?",
]

model, vdir, out = sys.argv[1], sys.argv[2], sys.argv[3]
voice = sys.argv[4] if len(sys.argv) > 4 else "am_michael"
speed = float(sys.argv[5]) if len(sys.argv) > 5 else 0.9
os.makedirs(out, exist_ok=True)

# kokoro-js ships each voice as raw float32 (510 x 256); kokoro-onnx wants an npz of (510, 1, 256)
npz = os.path.join(out, "voices.npz")
voices = {}
for f in sorted(os.listdir(vdir)):
    if f.endswith(".bin") and f[:2] in ("am", "bm", "af", "bf"):
        a = np.fromfile(os.path.join(vdir, f), dtype=np.float32)
        voices[f[:-4]] = a.reshape(-1, 1, 256)
np.savez(npz, **voices)

k = Kokoro(model, npz)
style = voice
if "+" in voice:  # blend, e.g. am_michael+am_fenrir
    names = voice.split("+")
    style = sum(voices[n] for n in names) / len(names)

meta = []
for i, text in enumerate(LINES, 1):
    audio, sr = k.create(text, voice=style, speed=speed, lang="en-us")
    sf.write(os.path.join(out, f"L{i:02d}.wav"), audio, sr)
    words = []
    for w in text.replace("...", " ").split():
        ph = k.tokenizer.phonemize(w.strip(".,?!"), "en-us")
        words.append({"w": w, "ph": len(ph.replace(" ", ""))})
    meta.append({"id": f"L{i:02d}", "text": text, "dur": len(audio) / sr, "words": words})
    print(f"L{i:02d} {len(audio)/sr:5.2f}s  {text}")
json.dump({"voice": voice, "speed": speed, "sr": 24000, "lines": meta}, open(os.path.join(out, "lines.json"), "w"), indent=1)
