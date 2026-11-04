"""Generate the v2 voice lines (Kokoro-82M, local). usage: python -I tts_v2.py <model.onnx> <voices.npz> <lines_v2.json> <out dir>"""
import json, os, sys
import soundfile as sf
from kokoro_onnx import Kokoro
model, npz, spec, out = sys.argv[1:5]
cfg = json.load(open(spec)); os.makedirs(out, exist_ok=True)
k = Kokoro(model, npz)
meta = []
for lid, text in cfg["lines"]:
    speed = 1.05 if lid == "SHOUT" else cfg["speed"]
    audio, sr = k.create(text, voice=cfg["voice"], speed=speed, lang="en-us")
    sf.write(os.path.join(out, lid + ".wav"), audio, sr)
    words = [{"w": w, "ph": len(k.tokenizer.phonemize(w.strip(".,?!"), "en-us").replace(" ", ""))} for w in text.split()]
    meta.append({"id": lid, "text": text, "dur": len(audio) / sr, "words": words})
    print(f"{lid:6s} {len(audio)/sr:5.2f}s  {text}")
json.dump({"voice": cfg["voice"], "speed": cfg["speed"], "sr": 24000, "lines": meta}, open(os.path.join(out, "lines.json"), "w"), indent=1)
