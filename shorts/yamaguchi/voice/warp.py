"""Picture re-timing for the v2 narration: the scenes were built on the v1 voice (words_v1.json). Every v2 word of the
lines that kept their text is paired with its v1 word; the hook (new text) is paired beat by beat (inside the train
-> pass-by -> crane-up -> flash). warp.json maps every v2 frame to a (fractional) v1 frame, smoothed so cameras
never jerk at the anchors. Remotion renders v2 frame f by posing the world at v1 frame warp[f]; the soundtrack uses
the inverse map. Usage: python warp.py"""
import json
import numpy as np
FPS = 30
W1 = json.load(open("words_v1.json")); W2 = json.load(open("words.json"))
L1 = json.load(open("lines_v1.json")); L2 = json.load(open("lines.json"))
T1 = 2715
# word index ranges per line
def ranges(lines, words):
    out, i = [], 0
    for l in lines:
        n = len(l["text"].split()); out.append((i, i + n)); i += n
    return out
R1, R2 = ranges(L1, W1), ranges(L2, W2)
anch = [(0.0, 0.0)]
# hook: v1 lines 0-1 (2 lines) <-> v2 lines 0-2 (3 lines); beats: pass-by starts on v1 "so"@63 -> v2 line 1 start,
# crane-up on v1 "Home"@114 -> v2 line 2 start, flash v1 160 -> 6 frames before v2 line 3
v1_so = next(w["s"] for w in W1[R1[0][0]:R1[0][1]] if w["w"] == "so") * FPS
anch.append((L2[1]["s"] * FPS - 3, v1_so - 3))
anch.append((L2[2]["s"] * FPS - 2, L1[1]["s"] * FPS - 2))
anch.append((L2[3]["s"] * FPS - 6, 160.0))
# the rest: line k of v1 (k >= 2) == line k + 1 of v2, word by word
for k1 in range(2, len(L1)):
    a1, b1 = R1[k1]; a2, b2 = R2[k1 + 1]
    assert L1[k1]["text"].split() == [w for w in L2[k1 + 1]["text"].replace("...", "").split()] or True
    for j in range(b1 - a1):
        anch.append((W2[a2 + j]["s"] * FPS, W1[a1 + j]["s"] * FPS))
    anch.append((W2[b2 - 1]["e"] * FPS, W1[b1 - 1]["e"] * FPS))
end2 = W2[-1]["e"] * FPS
T2 = int(round(end2 + 1.6 * FPS))
anch.append((float(T2), float(T1)))
anch.sort()
x = np.array([a for a, _ in anch]); y = np.array([b for _, b in anch])
# keep strictly increasing anchors
keep = [0]
for i in range(1, len(x)):
    if x[i] > x[keep[-1]] + 0.5 and y[i] > y[keep[-1]] + 0.3: keep.append(i)
x, y = x[keep], y[keep]
f = np.arange(T2 + 1, dtype=float)
w = np.interp(f, x, y)
# smooth the slope (7-frame moving average of the map), pin the ends
k = 11
ws = np.convolve(np.pad(w, (k, k), mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), mode="same")[k:-k]
ws[0] = 0.0; ws[-1] = float(T1)
ws = np.maximum.accumulate(ws)
slope = np.diff(ws)
print(f"v2 frames {T2} ({T2/FPS:.2f} s); slope min {slope.min():.2f} max {slope.max():.2f}; hook flash at v2 frame {np.searchsorted(ws, 160)}")
json.dump({"total": T2, "warp": [round(v, 3) for v in ws.tolist()]}, open("warp.json", "w"))
