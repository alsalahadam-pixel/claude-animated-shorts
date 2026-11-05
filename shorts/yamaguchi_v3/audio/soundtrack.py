# Soundtrack of "Home Was Nagasaki" V3: a synthesized cinematic score (strings, felt piano, low brass, risers; cine.py)
# + synthesized SFX + the directed narration, mixed to -15 LUFS / -1.2 dBTP. The music sits ~6 LU under the voice and
# ducks 7 dB under the words, so it rises in the gaps; it stops dead at each white-out and for a breath before the name.
# Arc: a dissonant drone and quickening heartbeat into the cold-open flash; the morning theme on piano and warm strings;
# a trembling fifth, heartbeat and riser under the bomber; silence on the white and a late blast; the theme fragile on
# the train home, a braam on "Nagasaki"; a tightening pulse in the office; the family theme alone on piano; a warm swell
# when they are alive; piano in minor for the cost; the theme building to the name, and in full to the last word.
# Usage: python soundtrack.py  ->  mix.wav, stem_music.wav, stem_sfx.wav, stem_voice.wav, cues.md
import json
import os
import numpy as np
from dsp import (SR, ns, tt, rng, lp, hp, bp, peq, colored, smooth_noise, fades, modal, phase, pan, st, place, widen, make_ir,
                 convolve_st, integrated, momentary_max, true_peak, read_wav, write_wav, dbg)
import instruments as I
import cine as C
import sfx_gen as G

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 30
EDL = json.load(open(os.path.join(HERE, "..", "remotion", "edl.json")))
TOTAL = EDL["total"]
DUR = TOTAL / FPS
N = ns(DUR)
SEGS = EDL["segs"]
o = lambda frame: frame / FPS                                   # output frame -> s
WORDS = json.load(open(os.path.join(HERE, "..", "voice", "words.json")))
LINES = json.load(open(os.path.join(HERE, "..", "voice", "lines.json")))
def wt(word, line, nth=0):
    """start time of `word` in narration line `line` (0-based)"""
    a = sum(len(l["text"].split()) for l in LINES[:line])
    n = len(LINES[line]["text"].split())
    return [w["s"] for w in WORDS[a:a + n] if w["w"].lower() == word.lower()][nth]
def seg(sid, s0):
    return next(s for s in SEGS if s["id"] == sid and s["s0"] == s0)
def src(sid, s0, f):
    """output time (s) at which the segment (shot sid starting at source frame s0) plays source frame f"""
    s = seg(sid, s0)
    return o(s["o0"] + (f - s["s0"]) * (s["o1"] - s["o0"]) / (s["s1"] - s["s0"]))
def span(sid, s0):
    s = seg(sid, s0); return o(s["o0"]), o(s["o1"])
WH = [tuple(o(x) for x in w) for w in EDL["whites"]]         # (ramp start, full, hold end, clear) in s
FLASHES = [o(x) for x in EDL["flashes"]]
REW = [tuple(o(x) for x in r) for r in EDL["rewind"]][0]

# ================================================================ score
Q = 0.6  # quarter note at 100 bpm
YO = {"D3": 50, "E3": 52, "G3": 55, "A3": 57, "B3": 59, "D4": 62, "E4": 64, "G4": 67, "A4": 69, "B4": 71, "D5": 74, "E5": 76, "G5": 79, "A5": 81,
      "D2": 38, "A2": 45, "F3": 53, "G2": 43, "E2": 40, "B2": 47, "Fs4": 66, "Fs3": 54, "Cs4": 61, "Eb4": 63, "Bb3": 58, "Bb4": 70, "Eb5": 75, "F4": 65, "C4": 60}
M = lambda n: I.m2f(YO[n])
# theme: (beat, note, beats)
THEME = [(0, "A4", 0.5), (0.5, "B4", 0.5), (1, "D5", 1), (2, "B4", 0.5), (2.5, "A4", 0.5), (3, "G4", 1),
         (4, "E4", 0.5), (4.5, "G4", 0.5), (5, "A4", 1.5), (6.5, "D4", 0.5), (7, "E4", 1),
         (8, "A4", 0.5), (8.5, "B4", 0.5), (9, "D5", 0.5), (9.5, "E5", 0.5), (10, "D5", 0.5), (10.5, "B4", 0.5), (11, "A4", 1),
         (12, "G4", 0.5), (12.5, "A4", 0.5), (13, "B4", 0.5), (13.5, "D5", 0.5), (14, "A4", 2)]
BASS = ["D2", "G2", "D2", "A2", "D2", "G2", "E2", "A2"]   # one per bar (4 beats)
CHORD = {"D2": ["D4", "Fs4", "A4"], "G2": ["G3", "B3", "D4"], "A2": ["A3", "Cs4", "E4"], "E2": ["E3", "G3", "B3"]}


class Score:
    def __init__(self):
        self.dry = np.zeros((2, N))
        self.send = np.zeros((2, N))
        self.r = rng(1945)

    def add(self, x, t, g=1.0, p=0.0, send=0.25):
        if t >= DUR or t < -5:
            return
        x = pan(x, p) if np.asarray(x).ndim == 1 else x
        place(self.dry, x, t, g)
        place(self.send, x, t, g * send)

    def theme(self, t0, t1, beat=Q, inst="pluck", vel=0.55, bass=True, perc=True, chords=False, transpose=0, start_beat=0):
        """loop the 16-beat theme from t0, cut everything that would start after t1"""
        b = start_beat
        while True:
            t = t0 + (b - start_beat) * beat
            if t >= t1:
                break
            loop, ib = divmod(b, 16)
            for (bt, n, L) in THEME:
                if abs(bt - ib) < 1e-6:
                    f = M(n) * 2 ** (transpose / 12)
                    if inst == "pluck":
                        self.add(I.pluck(f, vel, self.r, dur=max(0.5, L * beat * 1.6), bright=0.65, pos=0.13), t, 1.0, 0.15)
                    elif inst == "box":
                        self.add(I.musicbox(f, vel * 0.9, self.r, dur=1.8), t, 1.0, 0.1, 0.4)
                    else:
                        self.add(I.glock(f, vel * 0.7, self.r, dur=1.4), t, 1.0, 0.2)
                    if inst == "box" and int(ib) % 4 == 0:
                        pass
                for half in (0, 0.5):
                    pass
            for k in (0.5,):
                if b % 1 == 0 and perc and t + k * beat < t1:
                    self.add(woodblock(self.r, 0.18 + 0.06 * (b % 2)), t + k * beat, 1.0, -0.35, 0.1)
            if b % 1 == 0 and bass and int(b) % 2 == 0:
                bn = BASS[int(b // 4) % 8]
                f = M(bn) * 2 ** (transpose / 12) * (1 if int(b) % 4 == 0 else 1.5)
                self.add(I.pluck(f, 0.75, self.r, dur=1.0, bright=0.25, pos=0.3), t, 1.0, -0.1, 0.12)
            if chords and b % 4 == 0:
                bn = BASS[int(b // 4) % 8]
                self.add(I.pad([M(n) * 2 ** (transpose / 12) for n in CHORD[bn]], beat * 4 * 0.95, 0.4, self.r, att=0.4, rel=1.2, warm=1400), t, 0.6, 0, 0.5)
            b += 0.5


def taiko(r, vel=1.0):
    """o-daiko 'don': low membrane with a pitch drop, second mode, skin slap; long-ish decay"""
    d = 0.9; t = tt(d)
    f0 = 68 * (1 + 0.25 * np.exp(-t / 0.03))
    y = np.sin(phase(f0)) * np.exp(-t / 0.32) + 0.45 * np.sin(phase(f0 * 2.3)) * np.exp(-t / 0.12) + 0.2 * np.sin(phase(f0 * 3.6)) * np.exp(-t / 0.06)
    y += lp(r.standard_normal(len(t)), 900, 2) * np.exp(-t / 0.012) * 0.9
    return fades(y * vel, 0.0005, 0.08)


def taiko_ka(r, vel=0.5):
    """rim 'ka': dry wooden click"""
    return modal(0.1, [(r.uniform(1750, 1850), 1.0, 0.012), (r.uniform(3100, 3300), 0.5, 0.006), (620, 0.6, 0.02)], r) * vel


def woodblock(r, vel):
    return modal(0.12, [(r.uniform(1180, 1240), 1.0, 0.025), (r.uniform(2600, 2700), 0.4, 0.012)], r) * vel


def segc(sid, s0, cam=None):
    return next(s for s in SEGS if s["id"] == sid and s["s0"] == s0 and s.get("cam") == cam)
def srcc(sid, s0, f, cam=None):
    s = segc(sid, s0, cam)
    return o(s["o0"] + (f - s["s0"]) * (s["o1"] - s["o0"]) / (s["s1"] - s["s0"]))
def t0of(sid, s0, cam=None): return o(segc(sid, s0, cam)["o0"])
BURNS = [tuple(o(x) for x in b) for b in EDL["burns"]]


def heartbeat(r, vel=0.6):
    """lub-dub: two soft low thumps"""
    out = np.zeros(ns(0.6))
    for k, (t0, g) in enumerate(((0.0, 1.0), (0.2, 0.7))):
        t = tt(0.3)
        y = np.sin(phase(52 * (1 + 0.3 * np.exp(-t / 0.02)))) * np.exp(-t / 0.08) * g
        place_mono(out, y, t0)
    return lp(out, 200, 2) * vel


def build_score():
    S = Score(); r = S.r
    W0, W1, W2 = WH
    F = lambda n: M(n) if isinstance(n, str) else n
    def pad(notes, a, b, vel=0.4, att=0.8, rel=1.2, bright=2400, g=0.8, send=0.5, p=0.0):
        if b - a > 0.1: S.add(C.strings([F(n) for n in notes], b - a, vel, r, att=att, rel=rel, bright=bright), a, g, p, send)
    def pno(n, t, vel=0.5, p=0.1, dur=3.0, send=0.45): S.add(C.piano(F(n), vel, r, dur), t, 1.0, p, send)
    def ptheme(a, b, beat=0.6, vel=0.5, start=0, bass=True, strings=True, svel=0.28, tr=0.0):
        k = 2 ** (tr / 12); bb = start
        while True:
            t = a + (bb - start) * beat
            if t >= b - 0.05: break
            ib = bb % 16
            for (bt, n, L) in THEME:
                if abs(bt - ib) < 1e-6: pno(M(n) * k, t, vel)
            if bb % 4 == 0:
                bn = BASS[int(bb // 4) % 8]
                if bass: pno(M(bn) * 2 * k, t, vel * 0.75, -0.15, 3.5)
                if strings: pad([M(x) * k for x in CHORD[bn]], t, min(b, t + 4 * beat), svel, att=0.4, rel=0.9)
            bb += 0.5
    def beats(a, b, every, fn):
        t = a
        while t < b: fn(t); t += every

    # ---- cold open: a low dissonant string drone and a heartbeat that quickens; a riser into the white; dead stop
    pad(["D2", I.m2f(39), "A2"], 0.0, W0[1] + 0.05, 0.55, att=0.6, rel=0.05, bright=900)
    for k, t in enumerate((0.05, 0.85, 1.55, 2.15, 2.65, 3.05, 3.35)):
        S.add(heartbeat(r, 0.75 + 0.06 * k), t, 1.0, 0, 0.1)
    S.add(C.braam(36.7, 2.0, 0.55, r), o(EDL["flashes"][0]) - 0.02, 1.0, 0, 0.3)    # the Hiroshima cloud flash-cut
    S.add(C.riser(W0[1] - 1.7, r), 1.7, 0.9, 0, 0.3)
    pad(["A3", "Eb4", "A4"], 2.0, W0[1] + 0.02, 0.35, att=1.2, rel=0.02, bright=3200)
    # "how do you survive that... TWICE?": the dark chord, a hit on "twice"
    t_tw = wt("twice", 2)
    pad(["D3", "A3", "F4"], W0[2], REW[0] + 0.2, 0.45, att=0.3, rel=0.6, bright=1600)
    S.add(I.timpani(M("D2") * 2, 0.9, r), t_tw - 0.02, 1.0, 0, 0.4); S.add(taiko(r, 1.0), t_tw - 0.02, 1.0, 0, 0.4)
    # ---- Hiroshima: the morning theme on piano with warm strings, until the shock
    t_mor = REW[1]; t_shock = srcc(6, 437, 446); t_clock = t0of(9, 565)
    ptheme(t_mor + 0.05, t_shock - 0.05, beat=0.55, vel=0.48)
    pno(M("D5") * 2, t_shock, 0.6, 0.2, 2.5)                                          # the "oh no" note
    # turns back: a quick, light figure
    for k, n in enumerate(["A4", "G4", "E4", "D4", "E4", "G4", "A4", "B4"]):
        if t_shock + 0.35 + 0.22 * k < t_clock - 0.1: pno(n, t_shock + 0.35 + 0.22 * k, 0.32, -0.1, 1.2)
    # ---- 8:15: the music stops on the clock; an open fifth trembles; heartbeat quickens; riser; silence before the flash
    t_plane = t0of(11, 624, "lookUp")
    pad(["D3", "A3"], t_clock, W1[1], 0.4, att=1.6, rel=0.02, bright=1500)
    pad(["A3", "Eb4", "A4", "Bb4"], t_plane, W1[0] - 0.25, 0.32, att=2.5, rel=0.1, bright=3500)
    t = t_plane; k = 0
    while t < W1[0] - 0.3:
        S.add(heartbeat(r, 0.6 + 0.05 * min(k, 6)), t, 1.0, 0, 0.1); t += max(0.45, 0.85 - 0.05 * k); k += 1
    S.add(C.riser(W1[0] - 0.25 - (W1[0] - 2.2), r), W1[0] - 2.2, 0.85, 0, 0.3)
    # after the flash: a grieving chord, then sparse piano at the shelter; the train home: the theme, fragile
    t_shel = t0of(14, 877); t_train = t0of(15, 920); t_home = wt("Home", 12); t_naga = wt("Nagasaki", 12)
    pad(["D3", "F3", "A3", I.m2f(63)], W1[2] + 0.3, t_shel + 0.6, 0.38, att=1.2, rel=1.0, bright=1400)
    for k, n in enumerate(["A4", "D5", "Bb4", "A4"]):
        pno(n, t_shel + 0.05 + 0.36 * k, 0.32, 0.2, 2.0)
    ptheme(t_train, t_home - 0.1, beat=0.5, vel=0.36, bass=False, svel=0.22)
    # "Home... is NAGASAKI": the braam
    S.add(C.braam(36.7, 3.0, 1.0, r), t_naga - 0.03, 1.0, 0, 0.35)
    S.add(I.timpani(M("D2") * 2, 1.0, r), t_naga - 0.03, 1.0, 0, 0.4)
    pad(["D3", "F3", I.m2f(56)], t_naga, t_naga + 1.6, 0.5, att=0.05, rel=0.9, bright=1400)
    # ---- the office: a low pulse that tightens, a heartbeat under the boss, a riser into the second white
    t_off = t0of(17, 1045); t_doubt = t0of(19, 1250, "doubt"); t_then = wt("And", 16)
    pad(["D2", "A2"], t_off, W2[1], 0.35, att=1.5, rel=0.02, bright=700)
    k = 0
    def pulse(t):
        nonlocal k
        pno(M("D2") * (2 if k % 4 != 2 else 1.5), t, 0.42 + 0.1 * (t > t_doubt), -0.1, 0.8); k += 1
    beats(t_off + 0.3, t_then, 0.6, pulse)
    beats(t_doubt, t_then, 0.8, lambda t: S.add(heartbeat(r, 0.85), t, 1.0, 0, 0.1))
    pad(["A3", "Eb4", "A4", "Bb4"], t_then, W2[1], 0.4, att=1.2, rel=0.02, bright=3600)
    S.add(C.riser(W2[0] - t_then + 0.1, r), t_then, 0.9, 0, 0.3)
    # ---- after the second bomb: a low drone; the family theme alone on piano for "his wife and baby son"; a heartbeat
    t_cloud = t0of(33, 0); t_fam = wt("And", 19); t_alive = wt("They", 20)
    pad(["D2", I.m2f(39), "A2"], W2[2], t_fam + 0.4, 0.42, att=1.0, rel=1.0, bright=600)
    S.add(I.timpani(M("D2") * 2, 0.7, r), t_cloud, 1.0, 0, 0.5)
    for b, n in ((0, "A4"), (0.5, "B4"), (1, "D5"), (2, "B4"), (2.5, "A4"), (3, "G4")):
        pno(n, wt("wife", 19) + b * 0.55, 0.42, 0.1, 2.6)
    pad(["G3", "Bb3", "D4"], t_fam, t_alive, 0.32, att=0.6, rel=0.3, bright=1500)
    beats(wt("were", 19), t_alive - 0.3, 0.78, lambda t: S.add(heartbeat(r, 0.8), t, 1.0, 0, 0.1))
    # "They were alive": a warm major swell, the theme slow and tender
    t_but = wt("Across", 22)
    pad(["D3", "Fs3", "A3", "D4"], t_alive - 0.05, t_but + 0.3, 0.55, att=0.35, rel=1.0, bright=2600)
    ptheme(t_alive + 0.6, t_but - 0.1, beat=0.62, vel=0.38, bass=False, strings=False)
    # the cost: piano alone in minor over low strings
    t_both = wt("Both", 23)
    for n, b in (("A4", 0), ("Bb4", 1), ("A4", 2), ("G4", 3), ("D4", 4.5), ("Eb4", 6), ("D4", 7)):
        if t_but + 0.1 + b * 0.5 < t_both - 0.2: pno(n, t_but + 0.1 + b * 0.5, 0.42, 0.15, 2.4)
    pad(["G2", "D3", "Bb3"], t_but, t_both + 0.3, 0.35, att=1.0, rel=1.0, bright=1100)
    # 3 km: soft arpeggio; close enough (minor) / far enough (major)
    t_close, t_far, t_dec = wt("Close", 24), wt("Far", 25), wt("For", 26)
    for k, n in enumerate(["D4", "A4", "F4", "A4", "D4", "A3"]):
        if t_both + 0.25 * k < t_close - 0.1: pno(n, t_both + 0.25 * k, 0.3, -0.2 + 0.4 * (k % 2), 1.4)
    pad(["D3", "F3", "A3"], t_close, t_far, 0.45, att=0.1, rel=0.4, bright=1500)
    pad(["D3", "Fs3", "A3", "D4"], t_far, t_dec + 0.3, 0.48, att=0.1, rel=0.9, bright=2200)
    pno("A5", wt("live", 25), 0.45, 0.2, 3.0)
    # ---- after: the silence of decades (piano, low strings); the memory (the family theme, high and soft)
    t_son = wt("Then", 27); t_mem = t0of(28, 2250); t_speak = wt("So", 28)
    pad(["G2", "D3", "Bb3"], t_dec, t_speak + 0.3, 0.32, att=1.0, rel=0.8, bright=1000)
    for n, b in (("D4", 0), ("F4", 1.2), ("A4", 2.0), ("G4", 3.2)):
        pno(n, t_dec + 0.2 + b * 0.6, 0.38, 0.1, 2.6)
    for b, n in ((0, "A5"), (0.5, "B5"), (1, "D5"), (2, "B4")):
        pno(M(n) if n in YO else I.m2f({"B5": 83}[n]), t_mem + 0.05 + b * 0.45, 0.28, 0.2, 2.2)
    # he speaks out; 2009: the theme returns, building on strings
    t_rec = wt("In", 29); t_name = wt("His", 30); t_tsu = wt("Tsutomu", 30); t_died = wt("He", 31)
    ptheme(t_speak, t_name - 0.5, beat=0.56, vel=0.42, svel=0.32)
    S.add(I.timpani(M("D2") * 2, 0.55, r), srcc(30, 2366, 2382), 1.0, 0, 0.4)
    pad(["D3", "A3", "D4", "Fs4"], t_rec, t_name - 0.35, 0.4, att=1.5, rel=0.35, bright=2600)
    # silence... then the name: the full warm chord, the low brass soft underneath
    pad(["D2", "A2", "D3", "Fs3", "A3", "D4", "Fs4"], t_tsu - 0.1, t_died + 1.0, 0.62, att=0.25, rel=1.5, bright=3000)
    for n in ("D3", "A3", "D4", "Fs4", "A4"):
        pno(n, t_tsu - 0.05, 0.5, 0.0, 4.0)
    S.add(C.braam(36.7, 3.0, 0.45, r), t_tsu - 0.08, 1.0, 0, 0.4)
    pad(["B2", "Fs3", "B3", "D4"], t_died + 0.8, wt("Two", 32), 0.36, att=0.8, rel=0.6, bright=1800)
    # two bombs, three days: two hits
    t_two, t_three, t_fin = wt("Two", 32), wt("Three", 32), wt("He", 33)
    for tx in (t_two, t_three):
        S.add(taiko(r, 1.25), tx - 0.02, 1.0, 0, 0.4); S.add(I.timpani(M("D2") * 2, 0.9, r), tx - 0.02, 1.0, 0, 0.4)
    pad(["D3", "A3", "D4"], t_two, t_fin, 0.42, att=0.1, rel=0.4, bright=1400)
    # the close: the whole theme, strings rising under it; the final chord on "third", ringing out
    t_third = wt("third", 33)
    ptheme(t_fin, t_third - 0.1, beat=0.5, vel=0.5, svel=0.4)
    pad(["D2", "A2", "D3", "Fs3", "A3", "D4"], t_fin + 1.2, t_third, 0.35, att=2.5, rel=0.2, bright=2800)
    pad(["D2", "A2", "D3", "Fs3", "A3", "D4", "A4"], t_third - 0.05, DUR - t_third + 0.4, 0.62, att=0.2, rel=0.01, bright=3200)
    for n in ("D2", "D3", "A3", "D4", "Fs4", "A4", "D5"):
        pno(n, t_third - 0.03, 0.5, 0.0, 5.0)
    ir = make_ir(2.4, 7, hf=1.3)
    out = S.dry + convolve_st(S.send, ir) * 0.6
    # hard cuts: silent from full white to the end of the hold; a short breath of silence before the name
    for (a, b, c, d) in WH:
        g = np.ones(N); g[ns(b - 0.02):ns(c + 0.05)] = 0; out *= g[None, :]
    g = np.ones(N); a, b = ns(t_name - 0.3), ns(t_tsu - 0.12)
    g[a:b] = np.linspace(1, 0, b - a) ** 2 * 0.0 + np.clip(1 - np.arange(b - a) / max(1, ns(0.15)), 0, 1)
    out *= g[None, :]
    return out


# ================================================================ sound effects
def chuff(r, k=1.0):
    d = 0.32
    t = tt(d)
    x = bp(r.standard_normal(len(t)), 250, 2600, 1) * np.exp(-t / 0.07) * (1 - np.exp(-t / 0.006))
    x += lp(r.standard_normal(len(t)), 180, 2) * np.exp(-t / 0.05) * 0.8
    return x * k


def clack(r, k=1.0):
    return modal(0.25, [(r.uniform(900, 1000), 1.0, 0.03), (r.uniform(2100, 2300), 0.6, 0.02), (r.uniform(320, 360), 0.8, 0.04)], r) * k


def steam_whistle(r, dur=1.4, pitch=1.0):
    t = tt(dur)
    env = np.clip(t / 0.06, 0, 1) * np.clip((dur - t) / 0.25, 0, 1)
    y = np.zeros_like(t)
    for f in (494, 587, 740):  # a soft chord whistle
        ph = phase(f * pitch * (1 + 0.004 * np.sin(2 * np.pi * 5 * t)))
        y += np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
    y += bp(r.standard_normal(len(t)), 800, 5000, 1) * 0.6
    return y * env * 0.3


def gull(r):
    """herring-gull 'kee-ow': falling squeal with a rough edge, twice"""
    out = np.zeros(ns(0.8))
    for k, t0 in enumerate((0.0, 0.34)):
        d = 0.28; t = tt(d)
        f = (2300 - 900 * (t / d) ** 0.7) * (1 - 0.05 * k)
        y = np.sin(phase(f)) + 0.45 * np.sin(2 * phase(f)) + 0.2 * np.sin(3 * phase(f))
        y *= (0.7 + 0.3 * np.sin(2 * np.pi * 60 * t)) * np.sin(np.pi * t / d) ** 0.6
        place_mono(out, y, t0)
    return out


def place_mono(buf, x, t):
    k = ns(t); n = min(len(x), len(buf) - k)
    if n > 0: buf[k:k + n] += x[:n]


def ship_horn(r, dur=1.7):
    """deep two-note ship's horn (a low major third), slight swell and flutter"""
    t = tt(dur)
    env = np.clip(t / 0.12, 0, 1) * np.clip((dur - t) / 0.35, 0, 1)
    y = np.zeros_like(t)
    for f0 in (98.0, 123.5):
        ph = phase(f0 * (1 + 0.003 * np.sin(2 * np.pi * 4.5 * t)))
        for k in range(1, 14):
            y += np.sin(k * ph) / k ** 0.9
    y = lp(y, 1400, 2) + 0.15 * bp(r.standard_normal(len(t)), 200, 1200, 1)
    return y * env * 0.4


def crane_hum(dur, r):
    n = ns(dur); t = np.arange(n) / SR
    y = 0.6 * np.sin(phase(np.full(n, 58.0))) + 0.3 * np.sin(phase(np.full(n, 116.0)))
    y += 0.25 * np.sin(phase(380 + 40 * np.sin(2 * np.pi * 0.2 * t))) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.31 * t))
    chain = np.zeros(n); tm = 0.3
    while tm < dur - 0.2:
        place_mono(chain, modal(0.12, [(r.uniform(1800, 2600), 0.6, 0.02), (r.uniform(3800, 4600), 0.3, 0.01)], r), tm); tm += r.uniform(0.25, 0.9)
    return y * 0.5 + chain


def cicadas(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for v in range(3):
        f = r.uniform(4600, 6200)
        am = 0.5 + 0.5 * np.sin(2 * np.pi * r.uniform(60, 90) * t)
        sw = 0.6 + 0.4 * np.sin(2 * np.pi * r.uniform(0.08, 0.2) * t + r.uniform(0, 6))
        y += bp(r.standard_normal(n), f * 0.92, f * 1.08, 2) * am * sw
    return y


def plane_drone(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f0 in (62.0, 64.5, 67.0, 69.5):
        ph = phase(f0 * (1 + 0.01 * np.sin(2 * np.pi * 0.3 * t)))
        for k in range(1, 12):
            y += np.sin(k * ph + r.uniform(0, 6)) / k ** 1.1
    y = lp(y, 900, 2) + 0.4 * lp(colored(n, r, 1.0), 500)
    env = np.clip(t / 1.5, 0, 1) ** 1.5
    return y * env


def whine(dur, r):
    t = tt(dur)
    f = 1500 * (6.0 ** (t / dur))
    y = np.sin(phase(f)) * 0.6 + bp(r.standard_normal(len(t)), 1500, 9000, 1) * 0.5
    return y * (t / dur) ** 2


def ring(dur, r, f=4200):
    t = tt(dur)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 1.003 * t)) * np.exp(-t / (dur * 0.45)) * np.clip(t / 0.02, 0, 1)


def rumble(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    y = lp(colored(n, r, 2.0), 110, 3) * (1 - np.exp(-t / 0.25)) * np.exp(-t / (dur * 0.35))
    y += lp(colored(n, r, 1.0), 420, 2) * 0.25 * np.exp(-t / 0.9)
    return y


def body_thud(r):
    """a body hitting a wooden floor: low thump, board knock, cloth"""
    t = tt(0.5)
    y = np.exp(-t / 0.05) * np.sin(phase(70 * (1 + 0.4 * np.exp(-t / 0.01))))
    y += modal(0.5, [(190, 0.5, 0.05), (420, 0.3, 0.03)], r)
    y += bp(r.standard_normal(len(t)), 600, 4000, 1) * np.exp(-t / 0.04) * 0.3
    return fades(y, 0, 0.05)


def stamp(r):
    t = tt(0.4)
    th = np.exp(-t / 0.03) * np.sin(phase(110 * (1 + 0.5 * np.exp(-t / 0.008))))
    slap = bp(r.standard_normal(len(t)), 900, 6000, 1) * np.exp(-t / 0.012) * 0.7
    wood = modal(0.4, [(420, 0.4, 0.03), (980, 0.2, 0.015)], r)
    return fades(th * 1.2 + slap + wood, 0, 0.05)


def pop(r, up=True):
    t = tt(0.18)
    f = 300 * (3.0 ** (t / 0.18)) if up else 900 * (0.4 ** (t / 0.18))
    return np.sin(phase(f)) * np.exp(-t / 0.05) * np.clip(t / 0.005, 0, 1)


def plip(r):
    t = tt(0.15)
    return np.sin(phase(1400 * (1.8 ** (t / 0.15)))) * np.exp(-t / 0.035)


def tick(r, hi=True):
    return modal(0.08, [(3200 if hi else 2500, 1.0, 0.008), (6100, 0.3, 0.004)], r)


def crackle(dur, r, dens=18):
    n = ns(dur)
    y = lp(colored(n, r, 1.5), 300, 2) * 0.35
    tm = 0.0
    while tm < dur:
        L = ns(r.uniform(0.002, 0.012))
        k = ns(tm)
        if k + L < n:
            y[k:k + L] += hp(r.standard_normal(L), 1500) * r.uniform(0.3, 1.2)
        tm += r.exponential(1 / dens)
    return y


def sizzle(dur, r):
    t = tt(dur)
    return hp(r.standard_normal(len(t)), 3000) * (0.6 + 0.4 * smooth_noise(len(t), r, 25)) * np.clip(t / 0.05, 0, 1) * np.exp(-t / (dur * 0.6))


def swish(dur, r, lo=500, hi=3000):
    t = tt(dur)
    return bp(r.standard_normal(len(t)), lo, hi, 1) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2


def laugh(r, base=118, n=5):
    """a stout man's 'ha-ha-ha': formant pulses with falling pitch"""
    out = np.zeros(ns(0.2 * n + 0.4))
    for i in range(n):
        d = 0.13
        m = ns(d)
        t = np.arange(m) / SR
        f0 = base * (1.25 - 0.06 * i) * np.interp(t, [0, d], [1.08, 0.95])
        forms = G.vowel_track(m, [(0, "a"), (d, "A")])
        amp = np.clip(t / 0.01, 0, 1) * np.clip((d - t) / 0.04, 0, 1)
        y = G.vox(f0, forms, amp, r, 1.0, tilt=1.05, breath=0.5)
        h = bp(r.standard_normal(ns(0.05)), 800, 4000, 1) * np.exp(-tt(0.05) / 0.02) * 0.6
        k = ns(i * 0.19)
        out[k:k + ns(0.05)] += h
        out[k + ns(0.03):k + ns(0.03) + m] += y
    return out



def boom(r, dur=4.0):
    """the blast arriving: a sub drop, a broadband crack and a long low roll"""
    t = tt(dur)
    sub = np.sin(phase(48 * (1 + 0.8 * np.exp(-t / 0.08)))) * np.exp(-t / 0.7)
    crack = bp(r.standard_normal(len(t)), 200, 5000, 1) * np.exp(-t / 0.05) * 0.8
    return fades(sub * 1.2 + crack + rumble(dur, r) * 1.4, 0.002, 0.3)


def tape_rewind(dur, r):
    """tape spooling back: fast falling chirps, getting quicker, over a hissy whirr that rises"""
    n = ns(dur); t = np.arange(n) / SR
    y = bp(r.standard_normal(n), 2000, 7000, 1) * 0.25 * (0.4 + 0.6 * t / dur)
    whirr = np.sin(phase(300 + 900 * (t / dur) ** 1.5)) * 0.25
    y += whirr * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t))
    tm = 0.0
    while tm < dur - 0.06:
        d = 0.05; tc = tt(d)
        c = np.sin(phase(3200 * (0.35 ** (tc / d)))) * np.exp(-tc / 0.015) * 0.5
        place_mono(y, c, tm); tm += 0.11 - 0.07 * tm / dur
    return y * np.clip(t / 0.05, 0, 1)


def glass_rattle(dur, r):
    """window panes buzzing in their frames, building"""
    n = ns(dur); t = np.arange(n) / SR
    y = G.rattle(dur, r, density=40 + 60 * 1.0) if hasattr(G, "rattle") else np.zeros(n)
    y = y[:n] if len(y) >= n else np.pad(y, (0, n - len(y)))
    return hp(y, 1200) * (t / dur) ** 2


def debris(dur, r, dens=9):
    """small things settling after the blast: ticks, clinks, a little grit"""
    n = ns(dur); y = lp(colored(n, r, 1.0), 2500) * 0.08 * np.exp(-np.arange(n) / SR / (dur * 0.5))
    tm = 0.05
    while tm < dur:
        place_mono(y, modal(0.08, [(r.uniform(1500, 4200), 0.6, 0.01), (r.uniform(500, 900), 0.4, 0.02)], r) * r.uniform(0.2, 0.8) * np.exp(-tm / dur), tm)
        tm += r.exponential(1 / dens)
    return y


def reverse_cymbal(dur, r):
    x = I.cymbal(0.6, r, dur)
    x = x if np.asarray(x).ndim == 1 else x.mean(0)
    return x[::-1][-ns(dur):]


def build_sfx():
    r = rng(809)
    B = np.zeros((2, N))
    K = np.zeros((2, N))   # not gated by the white-outs (ringing, the blasts)
    cues = []

    def ev(t, x, g_db, p=0.0, name="", keep=False):
        if t >= DUR: return
        x = pan(x, p) if np.asarray(x).ndim == 1 else x
        place(K if keep else B, x, t, dbg(g_db))
        if name: cues.append((t, name))

    def bed(t0, t1, x_fn, g_db, name, fin=0.4, fout=0.4):
        d = t1 - t0
        if d <= 0.05: return
        x = st(x_fn(d))
        x = fades(x, fin, fout) if x.ndim == 1 else np.stack([fades(c, fin, fout) for c in x])
        ev(t0, x, g_db, name=name)

    W0, W1, W2 = WH
    BEAT = 1 / 7.2
    def chuffs(a, b, g, lpf=None):
        t, k = a, 0
        while t < b:
            x = chuff(r, 1.0 if k % 2 == 0 else 0.7)
            if lpf: x = lp(x, lpf, 2)
            ev(t, x, g, -0.2); t += BEAT; k += 1
    def clacks(a, b, g, period=1.47):
        t = a + 0.2
        while t < b:
            for dt, dg in ((0, 0), (0.11, -1), (0.62, -2), (0.73, -3)): ev(t + dt, clack(r), g + dg, 0.25)
            t += period
    def steps(a, b, g, every, scuff=0.4):
        t = a
        while t < b: ev(t, G.stroll_step(r, scuff), g, 0); t += every

    # ---- cold open: room tone, the panes buzz, the whine; the flash-cut to Hiroshima; white: ringing, the blast
    bed(0.0, W0[1], lambda d: lp(colored(ns(d), rng(9), 1.0), 900) * 0.4, -37, "office room tone", 0.05, 0.02)
    fc = o(EDL["flashes"][0])
    ev(fc - 0.12, swish(0.3, r, 400, 5000), -22, 0, "whoosh into the flash-cut")
    ev(fc, rumble(1.6, r), -16, 0, "the Hiroshima cloud (a low roll)")
    ev(o(EDL["flashes"][1]) - 0.1, swish(0.25, r, 600, 6000), -24, 0, "whoosh back")
    ev(1.6, glass_rattle(W0[1] - 1.6, r), -24, 0.2, "window panes buzzing")
    ev(1.9, whine(W0[1] - 1.9, r), -18, 0, "flash whine")
    ev(W0[1], ring(3.2, r), -27, 0, "ear ringing", keep=True)
    ev(W0[1] + 0.25, boom(r, 3.8), -8, 0, "the blast (cold open)", keep=True)
    ev(W0[1] + 0.25, C.sub_drop(1.8), -12, 0, keep=True)
    bed(W0[2] - 0.2, REW[0], lambda d: G.breeze(d, rng(5), 1.0, 0.3, 600)[0], -27, "wind over the city", 0.3, 0.2)
    # ---- rewind: tape spooling back, a reversed cymbal into the flash
    ev(REW[0], tape_rewind(REW[1] - REW[0], r), -16, 0, "tape rewind")
    rc = reverse_cymbal(REW[1] - REW[0] + 0.02, r)
    ev(REW[1] - len(rc) / SR, rc, -17, 0.2, "reverse cymbal into the flash")
    # ---- Hiroshima morning: shipyard, cicadas, footsteps
    a, b = REW[1], t0of(5, 347)
    t = a + 0.15
    while t < b:
        for j in range(4): ev(t + j * 0.09, G.hammer_hit(r, 0.35), -30, -0.6)
        t += r.uniform(0.9, 1.6)
    bed(a, b, lambda d: hp(crackle(d, rng(23), 40), 1800), -31, "welding sizzle", 0.2, 0.3)
    bed(a, b, lambda d: crane_hum(d, rng(24)), -33, "gantry crane", 0.3, 0.5)
    for tg in (a + 0.4, a + 1.9): ev(tg, gull(r), -27, float(r.uniform(-0.7, 0.7)), "gull")
    ev(t0of(4, 223) + 0.2, ship_horn(r), -21, 0.3, "ship's horn")
    bed(a, W1[1], lambda d: cicadas(d, rng(3)), -34, "cicadas (summer)", 0.3, 0.05)
    steps(b + 0.05, t0of(6, 437), -27, 0.35)
    ev(srcc(5, 347, 369), pop(r), -25, 0.3, "thought bubble (wife and son)")
    ev(srcc(6, 437, 449), plip(r), -26, 0.2, "sweat drop")
    ev(srcc(7, 492, 494), stamp(r), -12, 0, "the name stamp")
    steps(t0of(8, 518) + 0.05, t0of(9, 565), -27, 0.3, 0.6)
    # ---- 8:15: the clock ticks; the bomber's drone grows; the parachutes; the flash; silence; the blast arrives late
    t_clock = t0of(9, 565)
    for k in range(4): ev(t_clock + 0.05 + k * 0.42, tick(r, k % 2 == 0), -21 + k, -0.2, "clock tick" if k == 0 else "")
    t_plane = t0of(11, 624, "lookUp")
    ev(t_plane - 0.4, plane_drone(W1[1] - t_plane + 0.4, r), -25, 0.0, "B-29 drone (four engines)")
    ev(t0of(11, 640, "chutes") + 0.1, swish(0.9, r, 300, 1500), -27, 0.3, "parachutes open")
    ev(W1[0] - 0.8, whine(W1[1] - W1[0] + 0.8, r), -18, 0, "flash whine")
    ev(W1[1], ring(4.0, r), -27, 0, "ear ringing", keep=True)
    ev(W1[2] - 0.12, boom(r, 4.6), -7, 0, "the blast arrives (Hiroshima)", keep=True)
    ev(W1[2] - 0.12, C.sub_drop(2.2), -10, 0, keep=True)
    bed(W1[2], t0of(14, 877), lambda d: G.breeze(d, rng(51), 1.0, 0.3, 700)[0], -28, "dusty wind", 0.4, 0.4)
    ev(srcc(13, 805, 806), ring(1.2, r, 3900), -24, 0, "eardrums ringing")
    ev(srcc(13, 836, 838), sizzle(1.2, r), -29, 0.3, "burns (smoke hiss)")
    # ---- the shelter at night; the train home; the crane up over Nagasaki
    a, b = span(14, 877)
    bed(a, b + 0.2, lambda d: G.crickets(d, rng(7), 3), -32, "crickets", 0.1, 0.2)
    a, b = span(15, 920)
    chuffs(a, b, -15); clacks(a, b, -20)
    ev(a + 0.05, steam_whistle(r, 1.0), -18, 0.2, "steam whistle")
    a, b = span(16, 991)
    chuffs(a, b, -20)
    ev(a, swish(1.6, r, 200, 2200), -21, 0.2, "crane-up wind")
    # ---- Nagasaki office (the room tone starts under the crane: a J-cut)
    a = t0of(17, 1045)
    bed(a - 0.5, W2[1], lambda d: lp(colored(ns(d), rng(91), 1.0), 900) * 0.4, -38, "office room tone", 0.4, 0.02)
    t = a + 0.3
    while t < o(segc(21, 1338)["o0"] if False else 958):
        ev(t, swish(r.uniform(0.15, 0.3), r, 2500, 7000) * 0.6, -36, r.uniform(-0.6, 0.6)); t += r.uniform(0.6, 1.4)
    ev(srcc(18, 1200, 1201), pop(r), -25, 0.2, "thought bubble (the city)")
    t_then = wt("And", 16)
    ev(t_then + 0.3, glass_rattle(W2[1] - t_then - 0.3, r), -23, 0.2, "window panes buzzing")
    ev(W2[0] - 1.0, whine(W2[1] - W2[0] + 1.0, r), -18, 0, "second flash whine")
    ev(W2[1], ring(3.5, r), -27, 0, "ear ringing", keep=True)
    ev(W2[1] + 0.25, boom(r, 4.2), -8, 0, "the blast (Nagasaki)", keep=True)
    ev(W2[1] + 0.25, C.sub_drop(2.0), -11, 0, keep=True)
    ev(W2[1] + 0.5, body_thud(r), -13, 0.2, "he hits the floor", keep=True)
    ev(W2[2] - 0.1, debris(2.6, r), -21, 0.1, "debris settling")
    bed(W2[2], t0of(33, 0), lambda d: G.breeze(d, rng(52), 0.6, 0.2, 600)[0], -31, "dust in the room", 0.3, 0.3)
    # ---- the cloud over the city; the field; the family
    for s0 in (0, 33):
        a, b = span(33, s0)
        ev(a, rumble(b - a + 1.0, r), -18, 0, "distant rumble")
        bed(a, b, lambda d: G.breeze(d, rng(53), 1.0, 0.35, 600)[0], -29, "wind over the hills", 0.2, 0.2)
    a = t0of(22, 1425)
    bed(a, o(segc(22, 1476, "worry")["o1"]), lambda d: G.breeze(d, rng(54), 1.0, 0.3, 700)[0], -29, "dusty wind", 0.2, 0.2)
    ev(srcc(22, 1476, 1488, "worry"), pop(r), -27, 0.3, "thought bubble (wife and son)")
    # alive: birds by the tunnel, her footsteps
    a, b = span(28, 2210)
    bed(a, b, lambda d: G.bird_chirps(d, rng(15), 0.45, "sparrow"), -35, "birds", 0.5, 0.4)
    steps(srcc(28, 2210, 2215), srcc(28, 2210, 2245), -30, 0.3, 0.3)
    # lanterns: water, crickets
    a, b = t0of(23, 1526), o(segc(23, 1607)["o1"])
    bed(a, b, lambda d: G.water_bed(d, rng(11), 0.35, 0.4), -32, "river water", 0.5, 0.5)
    bed(a, b, lambda d: G.crickets(d, rng(12), 2), -40, "crickets", 0.5, 0.5)
    # 3 km: whooshes
    a = t0of(24, 1699)
    ev(a - 0.2, swish(1.0, r, 300, 2000), -28, 0, "whoosh to the map")
    ev(srcc(24, 1699, 1719), swish(0.9, r, 1500, 6000), -30, 0.2, "dashed line draws out")
    # garden, the bench, the podium, the certificate
    a = t0of(27, 2140)
    bed(a - 0.2, DUR, lambda d: G.breeze(d, rng(17), 1.0, 0.15, 900)[0], -40, "breeze", 0.4, 0.8)
    bed(a - 0.2, t0of(31, 2441), lambda d: G.bird_chirps(d, rng(16), 0.4, "sparrow"), -37, "garden birds", 0.4, 0.4)
    a, b = t0of(31, 2441), o(segc(31, 2500)["o1"])
    bed(a, b, lambda d: G.babble(d, rng(18), 140, 1.0, active=0.3) * 0.25, -41, "a hall, listening")
    app = G.applause(1.4, rng(19), 30)
    app *= np.clip(tt(1.4) / 0.15, 0, 1)[None, :] * np.clip((1.4 - tt(1.4)) / 0.8, 0, 1)[None, :]
    ev(b - 0.5, app, -33, name="applause (soft)")
    ev(srcc(30, 2366, 2382), stamp(r), -12, 0, "the stamp on the certificate")
    app2 = G.applause(1.2, rng(20), 12)
    app2 *= np.clip(tt(1.2) / 0.15, 0, 1)[None, :] * np.clip((1.2 - tt(1.2)) / 0.8, 0, 1)[None, :]
    ev(srcc(29, 2310, 2343), app2, -37, name="a few hands clap")
    bed(t0of(32, 2560), DUR, lambda d: G.bird_chirps(d, rng(21), 0.3, "sparrow"), -38, "birds (the bench)", 0.6, 1.0)
    # two bombs, three days: two distant booms under the drums
    for tx in FLASHES[3:]:
        ev(tx, rumble(2.2, r), -16, 0, "distant boom")
    # white-outs: everything but the ringing and the blasts is silent while the frame is white
    for (a_, b_, c_, d_) in WH:
        g = np.ones(N); g[ns(b_):ns(c_ - 0.06)] = 0.0
        B *= g[None, :]
    return B + K, cues


# ================================================================ mix
def speech_env(depth_db=-4.0):
    ctrl = 200
    nc = int(DUR * ctrl) + 2
    va = np.zeros(nc)
    for w in WORDS:
        va[max(0, int((w["s"] - 0.08) * ctrl)): int((w["e"] + 0.15) * ctrl)] = 1.0
    e = np.zeros(nc); x = 0.0
    for i in range(nc):
        k = 0.25 if va[i] > x else 0.03
        x += (va[i] - x) * k; e[i] = x
    return np.interp(np.arange(N) / SR, np.arange(nc) / ctrl, depth_db * e)


def limiter(x, ceil_db=-1.2):
    from scipy import ndimage, signal
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    L = ns(0.003)
    g = ndimage.minimum_filter1d(gr, 2 * L + 1)
    g = ndimage.uniform_filter1d(g, 2 * L + 1)
    # slow release
    rel = ndimage.minimum_filter1d(g, ns(0.06))
    g = np.minimum(g, ndimage.uniform_filter1d(rel, ns(0.06)))
    return x * np.minimum(g, 1.0)[None, :]


def punch(v):
    """narration chain, kept light so the voice stays natural: rumble cut, a touch of low-mid clean-up and presence,
    slow gentle 2:1 levelling (no saturation), a whisper of room"""
    from scipy import ndimage
    x = hp(v, 70, 2)
    x = peq(x, 280, -1.5, 1.0)
    x = peq(x, 3200, 1.8, 0.8)
    env = np.sqrt(ndimage.uniform_filter1d(x ** 2, ns(0.03)) + 1e-12)
    lvl = 20 * np.log10(env); thr = np.percentile(lvl[lvl > -60], 75)
    gr = np.where(lvl > thr, (thr - lvl) * (1 - 1 / 2.0), 0.0)
    gr = ndimage.uniform_filter1d(gr, ns(0.05))
    x = x * 10 ** (gr / 20)
    wet = convolve_st(x, make_ir(0.3, 31, hf=1.8))[0]
    return x + 0.03 * wet / (np.abs(wet).max() + 1e-9) * np.abs(x).max()


def shelf_hi(x, f0, db):
    from dsp import shelf
    return shelf(x, f0, db, "high")



def main():
    v, sr = read_wav(os.path.join(HERE, "..", "voice", "voice.wav"))
    v = v.mean(0)
    if sr != SR:
        from scipy import signal
        v = signal.resample_poly(v, SR, sr)
    voice = np.zeros(N); voice[: min(N, len(v))] = v[:N]
    voice = st(punch(voice))
    print("score..."); music = build_score()
    print("sfx..."); sfx, cues = build_sfx()
    Lv = integrated(voice)
    # balance: music ~6 LU under the voice before ducking, ducked 7 dB while words are spoken (so ~13 LU under the
    # words, rising in the gaps); SFX stem ~11 LU under
    Lm = integrated(music); music *= dbg(Lv - 6.0 - Lm)
    music *= dbg(speech_env(-7.0))[None, :]
    Ls = integrated(sfx); sfx *= dbg(Lv - 11.0 - Ls)
    mix = voice + music + sfx
    g = dbg(-15.0 - integrated(mix))
    mix, voice, music, sfx = mix * g, voice * g, music * g, sfx * g
    mix = limiter(mix)
    fade = np.ones(N); fade[-ns(0.8):] = np.linspace(1, 0, ns(0.8)) ** 1.5
    mix *= fade[None, :]
    write_wav(os.path.join(HERE, "mix.wav"), mix)
    for name, x in (("voice", voice), ("music", music), ("sfx", sfx)):
        write_wav(os.path.join(HERE, f"stem_{name}.wav"), x)
    rep = f"integrated {integrated(mix):.1f} LUFS, true peak {true_peak(mix):.1f} dBTP, voice {integrated(voice):.1f}, music {integrated(music):.1f}, sfx {integrated(sfx):.1f}, length {mix.shape[1]/SR:.3f} s"
    print(rep)
    with open(os.path.join(HERE, "cues.md"), "w") as fh:
        fh.write("# Sound cues: Home Was Nagasaki (V3)\n\n" + rep + "\n\n| time (s) | frame | cue |\n|---|---|---|\n")
        for t, name in sorted(cues):
            fh.write(f"| {t:6.2f} | {round(t*FPS)} | {name} |\n")


if __name__ == "__main__":
    main()
