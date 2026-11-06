"""Final-cut voice timeline: place L01-L27 + SHOUT, time every word, process, write stems and captions.

usage: python -I build_voice_final.py <tts final dir>
Writes voice/voice_final.wav (48 kHz stereo), voice/shout_final.wav (the dry shout alone, for the echo design),
src/data/words_final.json and src/data/captions_final.json. Start times are in SCRIPT_FINAL.md.
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

DUR = 3362 / 30
SLOTS = {"L01": 0.45, "L02": 3.75, "SHOUT": 7.25, "L03": 9.95, "L04": 11.2, "L05": 13.45, "L06": 18.3, "L07": 22.6,
         "L08": 25.35, "L09": 28.55, "L10": 32.2, "L11": 35.6, "L12": 37.9, "L13": 43.95, "L14": 46.3, "L15": 48.85,
         "L16": 53.75, "L17": 62.8, "L18": 67.3, "L19": 69.3, "L20": 71.15, "L21": 74.1, "L22": 79.0, "L23": 81.5,
         "L24": 85.0, "L25": 87.5, "L26": 95.6, "L27": 98.75}
CLOSE = {"L26", "L27"}   # the last two lines: dry, close to the ear, quieter


def main(tts):
    meta = json.load(open(os.path.join(tts, "lines.json")))
    mono = np.zeros(ns(DUR)); close = np.zeros(ns(DUR)); shout = np.zeros(ns(DUR))
    words = []
    for line in meta["lines"]:
        x, sr = sf.read(os.path.join(tts, line["id"] + ".wav"))
        t0 = SLOTS[line["id"]]
        y = signal.resample_poly(x, SR // sr, 1)
        k = ns(t0)
        if line["id"] == "SHOUT":
            y = np.tanh(peq(y, 2500, 5.0, 0.8) * 2.2) * 0.9
            shout[k:k + len(y)] += y
        else:
            (close if line["id"] in CLOSE else mono)[k:k + len(y)] += y
            for w, (a, b) in B.time_line(line, x, sr):
                words.append({"w": w["w"], "s": round(t0 + a, 3), "e": round(t0 + b, 3), "line": line["id"]})
        print(f"{line['id']:6s} {t0:6.2f} -> {t0 + len(x) / sr:6.2f}  {line['text']}")
    chain = lambda v: B.compress(shelf(peq(peq(shelf(hp(v, 80, 2), 160, 2.5, "low"), 420, -1.5, 1.2), 3300, 2.0, 0.9), 9000, -2.0, "high"))
    v = chain(mono)
    wet = convolve_st(v, make_ir(0.9, seed=7, hf=1.6, pre=0.008)) * dbg(-21)
    st = np.stack([v, v]) + wet
    # the ending lines: proximity (more low end), softer top, almost no room; a whisper of reversed room before L27
    c = B.compress(shelf(shelf(hp(close, 70, 2), 180, 4.0, "low"), 7000, -4.0, "high"))
    cw = convolve_st(c, make_ir(1.4, seed=11, hf=2.2, pre=0.01)) * dbg(-30)
    k27 = ns(SLOTS["L27"])
    seg = c[k27:k27 + ns(1.2)]
    rev = convolve_st(seg[::-1].copy(), make_ir(1.8, seed=5, hf=2.5, pre=0.0))[:, ::-1] * dbg(-17)
    a = max(0, k27 - rev.shape[1] + ns(0.06))
    pre = np.zeros((2, ns(DUR))); n = min(rev.shape[1], ns(DUR) - a); pre[:, a:a + n] = rev[:, :n]
    pre[:, k27 + ns(0.06):] = 0
    g = dbg(-18.0 - integrated(st))
    st = st * g + (np.stack([c, c]) + cw + pre) * g * dbg(-2.5)
    sh = np.stack([shout, shout]) * g * dbg(4.0)
    write_wav(os.path.join(HERE, "voice_final.wav"), st + sh)
    write_wav(os.path.join(HERE, "shout_final.wav"), sh)
    data = os.path.join(os.path.dirname(HERE), "src", "data")
    for w in words:
        w["w"] = w["w"].replace("six", "06:").replace("twelve.", "12.") if w["line"] == "L06" else w["w"]
    # "six twelve" reads as one time on screen
    for i, w in enumerate(words):
        if w["w"] == "06:" and i + 1 < len(words) and words[i + 1]["w"].startswith("12"):
            w["w"] = "06:12."; w["e"] = words[i + 1]["e"]; words[i + 1]["drop"] = True
    words = [w for w in words if not w.get("drop")]
    caps = B.captions(words)
    caps.append({"s": SLOTS["SHOUT"], "e": SLOTS["SHOUT"] + 1.0, "kind": "shout", "words": [{"w": "HELLO?!", "s": SLOTS["SHOUT"], "e": SLOTS["SHOUT"] + 0.9}]})
    caps.sort(key=lambda c: c["s"])
    for a, b in zip(caps, caps[1:]):
        a["e"] = round(min(a["e"], b["s"]), 3)
    for c in caps:   # never over the title cards
        for t0, t1 in ((479 / 30, 539 / 30), (3197 / 30, DUR)):
            if c["s"] < t0 < c["e"]:
                c["e"] = round(t0 - 0.02, 3)
    json.dump(words, open(os.path.join(data, "words_final.json"), "w"), indent=0)
    json.dump(caps, open(os.path.join(data, "captions_final.json"), "w"), indent=0)
    print(f"{len(words)} words, {len(caps)} caption chunks, voice {integrated(st + sh):.1f} LUFS")
    for cp in caps:
        print(f"  {cp['s']:7.2f}-{cp['e']:7.2f}  {' '.join(w['w'] for w in cp['words'])}")


if __name__ == "__main__":
    main(sys.argv[1])
