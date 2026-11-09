"""Part 3 voice timeline: place Q01-Q15 and the two shouts, time every word, process, write the stems and captions.

usage: python -I build_voice_part3.py <tts part3 dir>
Writes voice/voice_part3.wav (48 kHz stereo, 122.0 s), src/data/words_part3.json and src/data/captions_part3.json.
Q01 and the two RUN!s have no captions: the hook text and the RUN! slams say them. Q15 is dry and close.
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

DUR = 3660 / 30
SLOTS = {"Q01": 0.2, "Q02": 3.4, "Q03": 6.0, "RUN1": 11.9, "Q05": 20.6, "Q06": 27.6, "Q06B": 31.3, "Q07": 36.4, "Q08": 42.3,
         "Q09": 47.2, "Q10": 58.4, "Q11": 65.6, "Q12A": 72.3, "Q12": 75.6, "RUN2": 88.1, "Q14": 96.5, "Q15": 110.0}
CLOSE = {"Q15"}
SHOUT = {"RUN1", "RUN2"}


def main(tts):
    meta = json.load(open(os.path.join(tts, "lines.json")))
    mono = np.zeros(ns(DUR)); close = np.zeros(ns(DUR)); shout = np.zeros(ns(DUR))
    words = []
    for line in meta["lines"]:
        x, sr = sf.read(os.path.join(tts, line["id"] + ".wav"))
        t0 = SLOTS[line["id"]]
        y = signal.resample_poly(x, SR // sr, 1)
        k = ns(t0)
        if line["id"] in SHOUT:
            y = np.tanh(peq(y, 2500, 5.0, 0.8) * 2.4) * 0.9
            shout[k:k + len(y)] += y
            continue
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
    sh = np.stack([shout, shout]) * g * dbg(5.0)
    shw = convolve_st(shout, make_ir(1.6, seed=3, hf=1.4, pre=0.01)) * g * dbg(-6.0)
    out = st * g + (np.stack([c, c]) + cw) * g * dbg(-1.0) + sh + shw
    write_wav(os.path.join(HERE, "voice_part3.wav"), out)
    data = os.path.join(os.path.dirname(HERE), "src", "data")
    caps = B.captions([w for w in words if w["line"] != "Q01"])
    merged = []
    for c in caps:   # a chunk shorter than 0.3 s never reads: fold it into the next one
        if merged and merged[-1].get("short"):
            prev = merged.pop(); c = {"s": prev["s"], "e": c["e"], "words": prev["words"] + c["words"]}
        if c["e"] - c["s"] < 0.3:
            c["short"] = True
        merged.append(c)
    caps = [{k: v for k, v in c.items() if k != "short"} for c in merged]
    for a, b in zip(caps, caps[1:]):
        a["e"] = round(min(a["e"], b["s"]), 3)
    json.dump(words, open(os.path.join(data, "words_part3.json"), "w"), indent=0)
    json.dump(caps, open(os.path.join(data, "captions_part3.json"), "w"), indent=0)
    print(f"{len(words)} words, {len(caps)} caption chunks, voice {integrated(out):.1f} LUFS")
    for cp in caps:
        print(f"  {cp['s']:6.2f}-{cp['e']:6.2f}  {' '.join(w['w'] for w in cp['words'])}")


if __name__ == "__main__":
    main(sys.argv[1])
