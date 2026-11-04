"""v2 voice timeline: place V01-V14 + SHOUT, time every word, process, write stems and captions.

usage: python -I build_voice_v2.py <tts v2 dir>
Writes voice/voice.wav (48 kHz stereo, 62.5 s), voice/shout.wav (the dry shout alone, for the echo design),
src/data/words.json and src/data/captions.json. Reuses the word-timing and caption code of build_voice.py.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_voice as B  # noqa: E402
from build_voice import SR, hp, peq, shelf, make_ir, convolve_st, integrated, dbg, write_wav, ns  # noqa: E402

DUR = 62.5
# start times (s), from SCRIPT_v2.md
SLOTS = {"V01": 0.50, "V02": 2.85, "V03": 4.95, "SHOUT": 9.35, "V04": 11.75, "V05": 13.75, "V06": 16.55,
         "V07": 20.60, "V08": 23.10, "V09": 26.00, "V10": 39.90, "V11": 41.85, "V12": 48.20, "V13": 50.60, "V14": 52.60}


def main(tts):
    meta = json.load(open(os.path.join(tts, "lines.json")))
    mono = np.zeros(ns(DUR)); shout = np.zeros(ns(DUR))
    words = []
    for line in meta["lines"]:
        x, sr = sf.read(os.path.join(tts, line["id"] + ".wav"))
        t0 = SLOTS[line["id"]]
        y = signal.resample_poly(x, SR // sr, 1)
        k = ns(t0)
        if line["id"] == "SHOUT":
            # strained and forward: more presence, a little grit, louder than the narration
            y = np.tanh(peq(y, 2500, 5.0, 0.8) * 2.2) * 0.9
            shout[k:k + len(y)] += y
            words.append({"w": "HELLO?!", "s": round(t0, 3), "e": round(t0 + len(x) / sr, 3), "line": "SHOUT"})
        else:
            mono[k:k + len(y)] += y
            for w, (a, b) in B.time_line(line, x, sr):
                words.append({"w": w["w"], "s": round(t0 + a, 3), "e": round(t0 + b, 3), "line": line["id"]})
        print(f"{line['id']:6s} {t0:6.2f} -> {t0 + len(x) / sr:6.2f}  {line['text']}")
    v = hp(mono, 80, 2)
    v = shelf(v, 160, 2.5, "low"); v = peq(v, 420, -1.5, 1.2); v = peq(v, 3300, 2.0, 0.9); v = shelf(v, 9000, -2.0, "high")
    v = B.compress(v)
    wet = convolve_st(v, make_ir(0.9, seed=7, hf=1.6, pre=0.008)) * dbg(-21)
    st = np.stack([v, v]) + wet
    g = dbg(-18.0 - integrated(st))
    st *= g
    sh = np.stack([shout, shout]) * g * dbg(4.0)
    write_wav(os.path.join(HERE, "voice.wav"), st + sh)
    write_wav(os.path.join(HERE, "shout.wav"), sh)
    data = os.path.join(os.path.dirname(HERE), "src", "data")
    narr = [w for w in words if w["line"] != "SHOUT"]
    caps = B.captions(narr)
    caps.append({"s": SLOTS["SHOUT"], "e": SLOTS["SHOUT"] + 1.0, "kind": "shout", "words": [{"w": "HELLO?!", "s": SLOTS["SHOUT"], "e": SLOTS["SHOUT"] + 0.9}]})
    caps.sort(key=lambda c: c["s"])
    json.dump(words, open(os.path.join(data, "words.json"), "w"), indent=0)
    json.dump(caps, open(os.path.join(data, "captions.json"), "w"), indent=0)
    print(f"{len(words)} words, {len(caps)} caption chunks, voice {integrated(st + sh):.1f} LUFS")


if __name__ == "__main__":
    main(sys.argv[1])
