"""Edit decision list for "Home Was Nagasaki" v2 -> edl.json (read by src/videos/yama2/Short.tsx).
The v2 edit re-uses the v1 world: every segment poses one v1 shot (id) at a source frame that runs linearly from s0
to s1 while the output runs from o0 to o1 (s1 < s0 plays it backwards: the rewind). Cuts sit on narration word starts
(voice/words.json). cam names a v2 camera angle (story.ts CAM2) instead of the shot's own. xf = crossfade frames.
Also: white-outs and short flashes, impact kicks, title cards and word-timed captions, all in output frames.
Usage: python edl.py <out.json>"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(HERE, "..", "voice")
WORDS = json.load(open(os.path.join(V, "words.json")))
LINES = json.load(open(os.path.join(V, "lines.json")))
FPS = 30

# word index per line
LW, i = [], 0
for l in LINES:
    n = len(l["text"].split()); LW.append(list(range(i, i + n))); i += n

def w(line, k=0):
    """output frame of the start of word k of line"""
    return round(WORDS[LW[line][k]]["s"] * FPS)

END = round(WORDS[-1]["e"] * FPS) + 66  # hold on the last image ~2.2 s after the last word

# (o0, shot id, s0, s1, cam, xf): o1 = the next segment's o0
S = [
    # ---- cold open: Nagasaki, the second flash, in the middle of the story ----
    (0, 21, 1338, 1366, "coCU", 0),       # his bandaged face, the windows behind him begin to burn
    (52, 22, 1423, 1487, None, 0),        # (under the white) the cloud over him: "for the second time"
    # ---- rewind three days ----
    (116, 16, 1043, 1000, None, 0),
    (126, 15, 985, 935, None, 0),
    (136, 13, 870, 810, None, 0),
    (146, 11, 760, 690, None, 0),
    # ---- Hiroshima, 6 August ----
    (160, 4, 160, 215, None, 0),          # the tanker on the slip
    (w(4, 0), 4, 223, 270, None, 0),      # "Ship designer..." with his drawing
    (262, 4, 274, 319, None, 0),          # waving goodbye, suitcase in hand
    (w(5, 0), 5, 328, 405, None, 0),      # walking home; thinking of his wife and son
    (w(6, 0), 6, 437, 461, None, 0),      # "But he forgot his hanko"
    (438, 7, 485, 506, None, 0),          # the stamp (hits on "stamp")
    (w(6, 8), 8, 518, 546, None, 0),      # turns back
    (w(7, 0), 9, 565, 590, None, 0),      # 8:15
    (w(8, 0) - 5, 10, 599, 616, None, 0), # looks up
    (w(8, 2), 11, 626, 706, None, 0),     # plane, two parachutes
    (w(9, 0), 11, 706, 747, None, 0),     # the sky turns white
    (650, 12, 754, 818, None, 0),         # (under the white) the cloud, 3 km away
    (w(10, 3) - 3, 13, 800, 832, None, 0),  # eardrums
    (w(10, 9), 13, 836, 872, None, 0),    # burns
    (w(11, 0), 14, 877, 912, None, 0),    # the shelter at night
    (w(11, 7), 15, 920, 960, None, 6),    # the train home (golden)
    (w(12, 0), 16, 991, 1043, None, 0),   # "Home... is Nagasaki"
    # ---- Nagasaki, 9 August ----
    (w(13, 0), 17, 1045, 1090, None, 8),  # back at work, bandaged
    (w(13, 6), 17, 1112, 1142, None, 0),  # colleagues stare
    (w(14, 0), 18, 1176, 1212, "tell", 0),  # "one bomb"
    (w(14, 6), 18, 1206, 1246, None, 0),  # the thought of the destroyed city
    (w(15, 0), 19, 1250, 1291, "doubt", 0),  # the boss does not believe him
    (w(16, 0), 21, 1336, 1356, None, 0),  # "And right then..."
    (w(16, 3) + 8, 21, 1354, 1366, "coCU", 0),  # the same light (the cold open, now in context)
    (1192, 21, 1386, 1430, "floor", 0),   # (under the white) on the floor, dust in the air
    (w(18, 0), 33, 0, 46, None, 0),       # the cloud over Nagasaki
    (w(18, 9) - 4, 22, 1425, 1475, None, 0),  # "followed him from Hiroshima"
    (w(19, 0), 22, 1476, 1516, "worry", 0),   # his wife and son
    (w(19, 6), 33, 46, 85, None, 0),      # "somewhere in that city"
    (w(20, 0), 28, 2213, 2268, None, 10), # they survived: the tunnel
    (w(21, 0), 23, 1526, 1584, None, 12), # the lanterns: the cost
    (w(21, 7), 23, 1607, 1663, None, 0),  # him on the bank
    (w(22, 0), 24, 1686, 1738, None, 10), # both times about 3 km
    (w(22, 7), 24, 1752, 1775, None, 0),
    (w(23, 0), 27, 2140, 2166, None, 8),  # close enough to be hurt
    (w(24, 0), 27, 2189, 2230, None, 0),  # far enough to live
    # ---- after ----
    (w(25, 0), 31, 2441, 2477, None, 10), # he told the world
    (w(25, 6), 31, 2500, 2530, None, 0),
    (w(26, 0), 30, 2366, 2414, None, 0),  # the stamp again: 2009
    (w(26, 9) - 6, 29, 2300, 2375, None, 0),  # the certificate
    (w(27, 0), 32, 2549, 2616, None, 10), # died the following year, at 93
    (w(28, 0), 12, 790, 820, None, 0),    # two atomic bombs
    (w(28, 3) - 9, 22, 1432, 1474, None, 0),  # three days apart
    (w(29, 0), 32, 2560, 2610, None, 0),  # the man who survived both
    (w(29, 6), 32, 2610, 2700, "gardenEnd", 0),  # pull back to the evening sky
]

segs = []
for k, (o0, sid, s0, s1, cam, xf) in enumerate(S):
    o1 = S[k + 1][0] if k + 1 < len(S) else END
    assert o1 > o0, (k, o0, o1)
    seg = {"o0": o0, "o1": o1, "id": sid, "s0": s0, "s1": s1}
    if cam: seg["cam"] = cam
    if xf: seg["xf"] = xf
    # caption height: higher where he sits small at the bottom of a wide (the clouds) or on the bench at the end
    if (sid in (12, 22) and not cam): seg["cy"] = 1110
    if cam == "gardenEnd": seg["cy"] = 1180
    segs.append(seg)

# white-outs [ramp start, full, hold end, clear] and 4-frame flashes, output frames
whites = [
    [w(0, 8) - 2, w(0, 8) + 6, 64, 78],                 # cold open: on "bomb"
    [w(9, 3), w(9, 4) + 4, 672, 690],                   # Hiroshima: "turns white"
    [w(16, 6) + 2, w(16, 9) + 2, 1214, 1226],           # Nagasaki: "fills the room"
]
flashes = [160, w(28, 0), w(28, 3) - 9]
kicks = [[whites[0][1], 1.2], [419, 0.6], [447, 0.7], [whites[1][1], 1.2], [whites[2][1], 1.2], [1218, 0.5], [1846, 0.6],
         [w(28, 0), 0.5], [w(28, 3) - 9, 0.5]]
titles = [
    {"o0": 166, "o1": 213, "kind": "place", "top": "HIROSHIMA", "sub": "AUGUST 6, 1945"},
    {"o0": 226, "o1": 300, "kind": "place", "top": "TSUTOMU YAMAGUCHI, 29", "sub": "SHIP DESIGNER, MITSUBISHI"},
    {"o0": w(13, 0) + 3, "o1": w(13, 6) - 2, "kind": "place", "top": "NAGASAKI", "sub": "AUGUST 9, 1945"},
    {"o0": w(26, 0) + 3, "o1": w(26, 9) - 8, "kind": "place", "top": "MARCH 24, 2009", "sub": "OFFICIALLY RECOGNIZED"},
    {"o0": END - 64, "o1": END, "kind": "end", "top": "TSUTOMU YAMAGUCHI", "sub": "1916 – 2010",
     "note": "An illustrated retelling of documented events"},
]
rewind = [[116, 160]]

# ---- captions: words grouped 1-3 at a time, numbers written as numbers ----
MERGE = [(["nineteen", "forty", "five"], "1945"), (["Three", "kilometers"], "3 km"), (["three", "kilometers"], "3 km"), (["two", "thousand", "nine"], "2009"), (["ninety", "three"], "93"),
         (["Eight", "fifteen"], "8:15"), (["sixth"], "6th"), (["ninth"], "9th")]
toks = []
for li, l in enumerate(LINES):
    raw = l["text"].split()
    ids = LW[li]
    j = 0
    while j < len(ids):
        done = False
        for seq, rep in MERGE:
            n = len(seq)
            if [WORDS[x]["w"] for x in ids[j:j + n]] == seq:
                last = raw[j + n - 1]; punct = re.sub(r"^[\w']+", "", last)
                toks.append({"t": rep + punct, "o0": round(WORDS[ids[j]]["s"] * FPS), "o1": round(WORDS[ids[j + n - 1]]["e"] * FPS), "line": li})
                j += n; done = True; break
        if not done:
            toks.append({"t": raw[j], "o0": round(WORDS[ids[j]]["s"] * FPS), "o1": round(WORDS[ids[j]]["e"] * FPS), "line": li})
            j += 1
FUNC = {"a", "an", "the", "to", "is", "of", "in", "his", "their", "he", "and", "but", "at", "that", "this", "one", "be", "who", "for", "were", "was", "as", "he's"}
caps, cur = [], []
for k, t in enumerate(toks):
    cur.append(t)
    nxt = toks[k + 1] if k + 1 < len(toks) else None
    chars = sum(len(x["t"]) for x in cur) + len(cur) - 1
    brk = (nxt is None or nxt["line"] != t["line"] or re.search(r"[.,!?;:…]$", t["t"]) or len(cur) >= 3
           or chars + 1 + len(nxt["t"]) > 17 or nxt["o0"] - t["o1"] > 8)
    # never leave a little word dangling at the end of a group if the next word still fits
    if brk and nxt is not None and nxt["line"] == t["line"] and not re.search(r"[.,!?;:]$", t["t"]) and t["t"].lower() in FUNC and len(cur) < 4 and chars + 1 + len(nxt["t"]) <= 21:
        brk = False
    if brk:
        o1 = min(nxt["o0"] - 1, cur[-1]["o1"] + 12) if nxt else cur[-1]["o1"] + 18
        caps.append({"o0": cur[0]["o0"] - 1, "o1": o1, "w": [{"t": x["t"].upper(), "o0": x["o0"]} for x in cur]})
        cur = []

edl = {"total": END, "segs": segs, "whites": whites, "flashes": flashes, "kicks": kicks, "titles": titles, "rewind": rewind, "caps": caps}
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "edl.json")
json.dump({"total": END, "segs": segs, "whites": whites, "flashes": flashes, "kicks": kicks, "titles": titles, "rewind": rewind, "caps": caps}, open(os.path.join(HERE, "edl.json"), "w"), indent=0)
json.dump(edl, open(out, "w"), indent=0)
print(f"{len(segs)} segments, {END} frames ({END / FPS:.1f} s), {len(caps)} caption groups; mean shot {END / len(segs) / FPS:.2f} s")
