"""Place the voice lines on the 60 s timeline, time every word, process the voice, write the stems.

usage: python -I build_voice.py <tts dir with L01.wav.. + lines.json>
Writes  voice/voice.wav (48 kHz stereo, exactly 60 s), src/data/words.json, src/data/captions.json.

Word times: the model gives no alignment, so each line is split at its silent gaps (pauses at commas, full stops and
"..."); punctuation segments map onto those voiced regions in order, and inside a region the words share the time in
proportion to their phoneme counts. Good to a few frames, which is what word-highlighted captions need.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "audio"))
from dsp import SR, hp, peq, shelf, make_ir, convolve_st, integrated, dbg, write_wav, ns  # noqa: E402

DUR = 60.0
# line start times (s): each lands on its shot (see src/story.ts SHOTS)
SLOTS = {
    "L01": 0.55, "L02": 5.25, "L03": 9.0, "L04": 12.45, "L05": 15.55, "L06": 18.85, "L07": 23.2,
    "L08": 26.55, "L09": 32.4, "L10": 36.35, "L11": 42.45, "L12": 45.45, "L13": 49.2, "L14": 53.75, "L15": 56.55,
}
PUNCT = (",", ".", "?", "!", "...")


def voiced_regions(x, sr, gap=0.11, thr_db=-34.0):
    hop, win = int(0.01 * sr), int(0.025 * sr)
    n = max(1, (len(x) - win) // hop + 1)
    e = np.array([np.sqrt(np.mean(x[i * hop:i * hop + win] ** 2) + 1e-12) for i in range(n)])
    on = 20 * np.log10(e / e.max()) > thr_db
    regs, i = [], 0
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            regs.append([i * hop / sr, (j * hop + win) / sr])
            i = j
        else:
            i += 1
    merged = [regs[0]]
    for a, b in regs[1:]:
        if a - merged[-1][1] < gap:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return merged


def segments(words):
    segs, cur = [], []
    for w in words:
        cur.append(w)
        if w["w"].endswith(PUNCT):
            segs.append(cur)
            cur = []
    if cur:
        segs.append(cur)
    return segs


def spread(words, a, b):
    weights = np.array([w["ph"] + 1.5 for w in words], float)
    edges = a + (b - a) * np.concatenate([[0], np.cumsum(weights) / weights.sum()])
    return [(edges[i], edges[i + 1]) for i in range(len(words))]


def energy(x, sr):
    hop, win = int(0.01 * sr), int(0.025 * sr)
    n = max(1, (len(x) - win) // hop + 1)
    return np.array([np.sqrt(np.mean(x[i * hop:i * hop + win] ** 2) + 1e-12) for i in range(n)]), hop / sr


def time_line(line, x, sr):
    # words keep their punctuation ("up..."); phoneme counts come from the TTS pass (same order)
    toks = line["text"].split()
    assert len(toks) == len(line["words"]), line["id"]
    words = [{"w": t, "ph": w["ph"]} for t, w in zip(toks, line["words"])]
    regs = voiced_regions(x, sr)
    segs = segments(words)
    if len(regs) == len(segs):
        out = []
        for seg, (a, b) in zip(segs, regs):
            out += list(zip(seg, spread(seg, a, b)))
        return out
    # otherwise: proportional over the voiced span, then snap each segment boundary to the quietest 10 ms nearby
    e, dt = energy(x, sr)
    a0, b0 = regs[0][0], regs[-1][1]
    allw = [w for s in segs for w in s]
    est = spread(allw, a0, b0)
    bounds, k = [a0], 0
    for seg in segs[:-1]:
        k += len(seg)
        t = est[k][0]
        i0, i1 = max(0, int((t - 0.25) / dt)), min(len(e), int((t + 0.25) / dt))
        bounds.append((i0 + int(np.argmin(e[i0:i1]))) * dt + 0.012)
    bounds.append(b0)
    out = []
    for i, seg in enumerate(segs):
        out += list(zip(seg, spread(seg, bounds[i], bounds[i + 1])))
    print(f"  {line['id']}: {len(regs)} regions / {len(segs)} segments -> snapped at {[round(b, 2) for b in bounds[1:-1]]}")
    return out


def compress(x, thr_db=-24.0, ratio=2.5, att=0.005, rel=0.12):
    env = np.abs(x)
    a, r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    lvl = signal.lfilter([1 - r], [1, -r], env)  # smooth follower (release-dominated, fine for speech)
    lvl = np.maximum(lvl, 1e-6)
    db = 20 * np.log10(lvl)
    over = np.maximum(db - thr_db, 0)
    gain = dbg(-over * (1 - 1 / ratio))
    return x * gain


def main(tts):
    meta = json.load(open(os.path.join(tts, "lines.json")))
    mono = np.zeros(ns(DUR))
    words_out = []
    for line in meta["lines"]:
        x, sr = sf.read(os.path.join(tts, line["id"] + ".wav"))
        t0 = SLOTS[line["id"]]
        for w, (a, b) in time_line(line, x, sr):
            words_out.append({"w": w["w"], "s": round(t0 + a, 3), "e": round(t0 + b, 3), "line": line["id"]})
        y = signal.resample_poly(x, SR // sr, 1)
        k = ns(t0)
        assert k + len(y) <= len(mono), f"{line['id']} runs past the end"
        mono[k:k + len(y)] += y
        print(f"{line['id']} {t0:6.2f} -> {t0 + len(x) / sr:6.2f}  {line['text']}")

    # voice chain: rumble cut, warmth, de-box, presence, gentle compression, a small dark room
    v = hp(mono, 80, 2)
    v = shelf(v, 160, 2.5, "low")
    v = peq(v, 420, -1.5, 1.2)
    v = peq(v, 3300, 2.0, 0.9)
    v = shelf(v, 9000, -2.0, "high")
    v = compress(v)
    ir = make_ir(0.9, seed=7, hf=1.6, pre=0.008)
    wet = convolve_st(v, ir) * dbg(-21)
    st = np.stack([v, v]) + wet
    st *= dbg(-18.0 - integrated(st))  # voice stem at -18 LUFS; the mix sets the final level
    os.makedirs(os.path.join(HERE), exist_ok=True)
    write_wav(os.path.join(HERE, "voice.wav"), st)

    data = os.path.join(ROOT, "src", "data")
    os.makedirs(data, exist_ok=True)
    json.dump(words_out, open(os.path.join(data, "words.json"), "w"), indent=0)
    json.dump(captions(words_out), open(os.path.join(data, "captions.json"), "w"), indent=0)
    print(f"{len(words_out)} words, voice.wav {integrated(st):.1f} LUFS")


def captions(words, max_words=3, max_chars=18):
    """Chunks of 1-3 words, broken at punctuation; each chunk shows until the next one starts (or 0.35 s after)."""
    chunks, cur = [], []
    for i, w in enumerate(words):
        cur.append(w)
        text = " ".join(c["w"] for c in cur)
        nxt = words[i + 1] if i + 1 < len(words) else None
        brk = (w["w"].endswith(PUNCT) or len(cur) >= max_words or nxt is None or nxt["line"] != w["line"]
               or (nxt and len(text) + 1 + len(nxt["w"]) > max_chars))
        if brk:
            chunks.append(cur)
            cur = []
    out = []
    for i, c in enumerate(chunks):
        end = c[-1]["e"] + 0.35
        if i + 1 < len(chunks):
            end = min(end, chunks[i + 1][0]["s"])
        out.append({"s": c[0]["s"], "e": round(end, 3),
                    "words": [{"w": w["w"].replace("...", "…"), "s": w["s"], "e": w["e"]} for w in c]})
    return out


if __name__ == "__main__":
    main(sys.argv[1])
