"""Edit decision list for "Home Was Nagasaki" V3 -> edl.json (read by src/videos/yama3/Short.tsx). Built on the V2 list.
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

# (o0, shot id, s0, s1, cam, xf, look): o1 = the next segment's o0
S = [
    # ---- cold open: Nagasaki, 9 August, the second flash ----
    (0, 21, 1338, 1350, "coCU", 0, None),         # his bandaged face, talking: "this man has already survived..."
    (w(0, 5), 12, 790, 804, None, 0, None),       # flash-cut: "one atomic bomb" = the Hiroshima cloud
    (44, 21, 1352, 1368, "coCU", 0, None),        # "now he's about to survive another": the windows burn, he turns
    (106, 33, 10, 70, None, 0, None),             # (under the white) the cloud over Nagasaki: "how do you survive that..."
    (w(2, 5), 22, 1476, 1487, None, 0, None),     # punch-in on his face: "...twice?"
    # ---- rewind (no words: the tape spools back) ----
    (178, 16, 1043, 1005, None, 0, None), (187, 15, 985, 945, None, 0, None), (196, 13, 870, 830, None, 0, None), (205, 11, 760, 700, None, 0, None),
    # ---- Hiroshima, 6 August ----
    (214, 4, 160, 216, None, 0, None),            # the tanker on the slip; HIROSHIMA card
    (w(4, 0), 4, 223, 262, None, 0, None),        # "a ship designer from Nagasaki"
    (w(4, 6), 5, 347, 394, None, 0, None),        # going home; the thought of his wife and son pops on "wife"
    (w(5, 0), 6, 437, 458, None, 0, None),        # "but he's forgotten his name stamp"
    (w(5, 5), 7, 492, 503, None, 0, None),        # the stamp
    (w(5, 6), 8, 518, 550, None, 0, None),        # turns back
    # ---- 8:15 ----
    (w(6, 0), 9, 565, 590, None, 0, None),        # the clock
    (w(7, 0), 11, 624, 640, "lookUp", 0, None),   # "a plane": his face, the bomber high above
    (w(8, 0), 11, 640, 688, "chutes", 0, None),   # telephoto: the two parachutes
    (w(9, 0), 10, 636, 660, "faceUp", 0, None),   # "then...": his face as the light comes (burn-up into the white)
    (574, 12, 754, 827, None, 0, None),           # (under the white) the cloud, 3 km away
    (w(10, 6), 13, 805, 830, None, 0, None),      # eardrums
    (w(10, 10), 13, 836, 868, None, 0, None),     # burns
    (w(11, 0), 14, 877, 891, None, 0, None),      # the shelter, that night
    (w(11, 4), 15, 920, 948, None, 6, None),      # the train home
    (w(12, 0), 16, 991, 1046, None, 0, None),     # "Home... is Nagasaki"
    # ---- Nagasaki, 9 August ----
    (w(13, 0), 17, 1045, 1082, None, 8, None),    # back at work, bandaged
    (w(13, 4), 18, 1170, 1211, "tell", 0, None),  # telling his boss about Hiroshima
    (w(14, 4), 18, 1200, 1246, None, 0, None),    # "one bomb... an entire city" (the finger, the thought)
    (w(15, 0), 19, 1250, 1283, "doubt", 0, None), # the boss does not believe him
    (w(16, 0), 21, 1338, 1350, None, 0, None),    # "and right then..."
    (w(16, 3), 21, 1352, 1368, "coCU", 0, None),  # the cold open again, now in context: the light
    (1018, 21, 1386, 1440, "floor", 0, None),     # (under the white) on the floor in the dust
    # ---- the aftermath ----
    (w(18, 0), 33, 0, 33, None, 0, None),         # the cloud over Nagasaki
    (w(18, 7), 22, 1425, 1461, None, 0, None),    # "had followed him from Hiroshima"
    (w(19, 0), 22, 1476, 1517, "worry", 0, None), # his wife and son (the thought from Hiroshima returns)
    (w(19, 6), 33, 33, 77, None, 0, None),        # "somewhere out there"
    (w(20, 0), 28, 2210, 2346, None, 10, None),   # they were alive: she walks out of the tunnel with the baby
    (w(22, 0), 23, 1526, 1562, None, 12, None),   # lanterns: the others
    (w(22, 5), 23, 1607, 1656, None, 0, None),    # him on the bank
    (w(23, 0), 24, 1699, 1743, None, 8, None),    # both times, about 3 km
    (w(24, 0), 27, 2140, 2165, None, 6, None),    # close enough to be hurt
    (w(25, 0), 27, 2189, 2220, None, 0, None),    # far enough to live
    # ---- after ----
    (w(26, 0), 32, 2470, 2547, "benchSad", 10, None),  # decades of silence; his son
    (w(27, 6), 28, 2250, 2283, None, 0, "memory"),     # memory: the baby from the tunnel
    (w(28, 0), 31, 2441, 2474, None, 0, None),         # he speaks out
    (w(28, 6), 31, 2500, 2540, None, 0, None),         # even at the United Nations
    (w(29, 0), 30, 2366, 2417, None, 0, None),         # 2009: the stamp (hits on "nine")
    (w(29, 9), 29, 2310, 2374, None, 0, None),         # the certificate
    (w(30, 0), 32, 2560, 2637, None, 0, None),         # his name
    (w(31, 0), 32, 2560, 2600, "gardenEnd", 8, None),  # he died at 93 (the wide, the evening)
    (w(32, 0), 12, 790, 817, None, 0, None),           # two atomic bombs
    (w(32, 3) - 9, 33, 40, 85, None, 0, None),         # three days apart
    (w(33, 0), 32, 2605, 2640, None, 0, None),         # he survived both...
    (w(33, 4), 32, 2600, 2700, "gardenEnd", 0, None),  # ...and spent his last years: pull back to the sky
]

segs = []
for k, (o0, sid, s0, s1, cam, xf, look) in enumerate(S):
    o1 = S[k + 1][0] if k + 1 < len(S) else END
    assert o1 > o0, (k, o0, o1)
    seg = {"o0": o0, "o1": o1, "id": sid, "s0": s0, "s1": s1}
    if cam: seg["cam"] = cam
    if xf: seg["xf"] = xf
    if look: seg["look"] = look
    # caption height: higher where his face or figure sits low in the frame
    if (sid in (12, 22) and not cam): seg["cy"] = 1110
    if cam == "gardenEnd": seg["cy"] = 1000
    if cam == "lookUp": seg["cy"] = 980
    segs.append(seg)

we = lambda line, k: round(WORDS[LW[line][k]]["e"] * FPS)
# white-outs [ramp start, full, hold end, clear], burn-ups [start, full] (the picture over-exposes into the white)
whites = [
    [we(1, 5) - 6, we(1, 5) + 2, 136, 148],                      # cold open: on "another" (the card stays readable)
    [w(9, 1) + 15, w(9, 4) + 5, 600, 612],                       # Hiroshima: "...turns white"
    [w(16, 9) - 2, we(16, 9) + 0, 1040, 1050],                   # Nagasaki: "...fills the room"
]
burns = [[60, whites[0][0]], [w(9, 0) + 6, whites[1][0]], [w(16, 3) + 6, whites[2][0]]]
wcards = [
    {"o0": whites[0][1], "o1": whites[0][2], "top": "11:02 AM", "sub": "NAGASAKI \u00b7 AUGUST 9, 1945"},
    {"o0": whites[1][1], "o1": whites[1][2], "top": "8:15 AM", "sub": "HIROSHIMA \u00b7 AUGUST 6, 1945"},
    {"o0": whites[2][1], "o1": whites[2][2], "top": "11:02 AM", "sub": "NAGASAKI \u00b7 AUGUST 9, 1945"},
]
flashes = [w(0, 5), 44, 214, w(32, 0), w(32, 3) - 9]
kicks = [[whites[0][1], 1.2], [365, 0.6], [385, 0.7], [whites[1][2] - 2, 1.4], [whites[2][1], 1.2], [whites[2][2], 0.6], [1775, 0.6],
         [w(32, 0), 0.5], [w(32, 3) - 9, 0.5]]
titles = [
    {"o0": 218, "o1": 266, "kind": "place", "top": "HIROSHIMA", "sub": "AUGUST 6, 1945"},
    {"o0": w(13, 0) + 3, "o1": w(13, 4) - 2, "kind": "place", "top": "NAGASAKI", "sub": "AUGUST 9, 1945"},
    {"o0": w(29, 0) + 3, "o1": w(29, 9) - 4, "kind": "place", "top": "MARCH 24, 2009", "sub": "OFFICIALLY RECOGNIZED"},
    {"o0": w(30, 3) - 2, "o1": w(32, 0) - 3, "kind": "name", "top": "TSUTOMU YAMAGUCHI", "sub": "1916 \u2013 2010"},
    {"o0": END - 62, "o1": END, "kind": "end", "top": "TSUTOMU YAMAGUCHI", "sub": "1916 \u2013 2010",
     "note": "The only person officially recognized as a survivor of both atomic bombings. An illustrated retelling of documented events."},
]
rewind = [[178, 214]]
NO_CAPS = {30}  # "His name was Tsutomu Yamaguchi": the name card says it

# ---- captions: words grouped 1-3 at a time, numbers written as numbers ----
MERGE = [(["nineteen", "forty", "five"], "1945"), (["Three", "kilometers"], "3 km"), (["three", "kilometers"], "3 km"), (["two", "thousand", "nine"], "2009"), (["ninety", "three"], "93"),
         (["Eight", "fifteen"], "8:15"), (["sixth"], "6th"), (["ninth"], "9th")]
toks = []
for li, l in enumerate(LINES):
    if li in NO_CAPS: continue
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

edl = {"total": END, "segs": segs, "whites": whites, "flashes": flashes, "kicks": kicks, "titles": titles, "rewind": rewind, "caps": caps,
       "burns": burns, "wcards": wcards}
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "edl.json")
json.dump(edl, open(os.path.join(HERE, "edl.json"), "w"), indent=0)
json.dump(edl, open(out, "w"), indent=0)
print(f"{len(segs)} segments, {END} frames ({END / FPS:.1f} s), {len(caps)} caption groups; mean shot {END / len(segs) / FPS:.2f} s")
