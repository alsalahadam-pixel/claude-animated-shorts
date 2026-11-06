"""Part 2 voice timeline: place P01-P09, time every word, process, write the stem and captions.

usage: python -I build_voice_part2.py <tts part2 dir>
Writes voice/voice_part2.wav (48 kHz stereo, 46.0 s), src/data/words_part2.json and src/data/captions_part2.json.
P01 has no caption: the hook text on screen says it. P06 and P09 are dry and close (the entity's lines, in his voice).
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

DUR = 1380 / 30
SLOTS = {"P01": 0.15, "P02": 2.95, "P03": 6.4, "P04": 13.3, "P05": 17.0, "P06": 20.45, "P07": 25.5, "P08": 33.0, "P09": 43.35}
CLOSE = {"P06", "P09"}


def main(tts):
    meta = json.load(open(os.path.join(tts, "lines.json")))
    mono = np.zeros(ns(DUR)); close = np.zeros(ns(DUR))
    words = []
    for line in meta["lines"]:
        x, sr = sf.read(os.path.join(tts, line["id"] + ".wav"))
        t0 = SLOTS[line["id"]]
        y = signal.resample_poly(x, SR // sr, 1)
        k = ns(t0)
        (close if line["id"] in CLOSE else mono)[k:k + len(y)] += y
        for w, (a, b) in B.time_line(line, x, sr):
            words.append({"w": w["w"], "s": round(t0 + a, 3), "e": round(t0 + b, 3), "line": line["id"]})
        print(f"{line['id']:6s} {t0:6.2f} -> {t0 + len(x) / sr:6.2f}  {line['text']}")
    v = B.compress(shelf(peq(peq(shelf(hp(mono, 80, 2), 160, 2.5, "low"), 420, -1.5, 1.2), 3300, 2.5, 0.9), 9000, -1.5, "high"))
    wet = convolve_st(v, make_ir(0.8, seed=7, hf=1.6, pre=0.008)) * dbg(-22)
    st = np.stack([v, v]) + wet
    c = B.compress(shelf(shelf(hp(close, 70, 2), 180, 4.0, "low"), 7000, -3.0, "high"))
    cw = convolve_st(c, make_ir(1.4, seed=11, hf=2.2, pre=0.01)) * dbg(-28)
    g = dbg(-18.0 - integrated(st))
    out = st * g + (np.stack([c, c]) + cw) * g * dbg(-1.0)
    write_wav(os.path.join(HERE, "voice_part2.wav"), out)
    data = os.path.join(os.path.dirname(HERE), "src", "data")
    caps = B.captions([w for w in words if w["line"] != "P01"])
    for a, b in zip(caps, caps[1:]):
        a["e"] = round(min(a["e"], b["s"]), 3)
    json.dump(words, open(os.path.join(data, "words_part2.json"), "w"), indent=0)
    json.dump(caps, open(os.path.join(data, "captions_part2.json"), "w"), indent=0)
    print(f"{len(words)} words, {len(caps)} caption chunks, voice {integrated(out):.1f} LUFS")
    for cp in caps:
        print(f"  {cp['s']:6.2f}-{cp['e']:6.2f}  {' '.join(w['w'] for w in cp['words'])}")


if __name__ == "__main__":
    main(sys.argv[1])
