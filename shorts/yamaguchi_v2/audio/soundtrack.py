# Soundtrack of "Home Was Nagasaki" v2 (the re-edit): original score + synthesized SFX + the narration, mixed to
# -15 LUFS / -1.2 dBTP, with the music ducked 6 dB while words are spoken (~13 LU under the words, swelling in the gaps).
# Score arc: a tense cold open that cuts to silence on the white; a tape rewind; the light pentatonic theme (yo scale,
# D) for the peaceful morning; ticking and a swelling pad + taiko roll into the first flash; silence; a low drone and a
# sparse music box after it; a hopeful fragment on the train home and a dark hit on "Nagasaki"; a low pulse in the office
# that tightens into the second flash; the family theme alone on a music box for "his wife and baby son"; a warm chord
# when they survive; the music box in minor for the cost; the theme slow and warm for the last years, two drum hits for
# the two bombs and the full theme to close.
# SFX are timed from the v2 edit (remotion/edl.json: a v1 source frame in a segment -> output time) and the words.
# Usage: python soundtrack.py  ->  mix.wav, stem_music.wav, stem_sfx.wav, stem_voice.wav, cues.md
import json
import os
import numpy as np
from dsp import (SR, ns, tt, rng, lp, hp, bp, peq, colored, smooth_noise, fades, modal, phase, pan, st, place, widen, make_ir,
                 convolve_st, integrated, momentary_max, true_peak, read_wav, write_wav, dbg)
import instruments as I
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
      "D2": 38, "A2": 45, "G2": 43, "E2": 40, "B2": 47, "Fs4": 66, "Fs3": 54, "Cs4": 61, "Eb4": 63, "Bb3": 58, "Bb4": 70, "Eb5": 75, "F4": 65, "C4": 60}
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
    # ---- cold open: dissonant drone and heartbeat drum under his face, a rising swell, cut dead on the white
    S.add(I.pad([M("D2"), I.m2f(39), M("A2")], W0[1] + 0.1, 0.5, r, att=0.8, rel=0.02, warm=500,
                trem=lambda t: 0.8 + 0.2 * np.sin(2 * np.pi * 3 * t)), 0.0, 0.9, 0, 0.5)
    for k, t in enumerate((0.05, 0.62, 1.12, 1.48)):
        S.add(taiko(r, 0.45 + 0.2 * k), t, 1.0, 0, 0.3)
    sw = I.pad([M("A3"), M("Eb4"), M("A4")], W0[1] - 0.6, 0.55, r, att=1.0, rel=0.02, warm=1800, trem=lambda t: 0.7 + 0.3 * np.sin(2 * np.pi * 8 * t))
    sw *= np.linspace(0.2, 1.5, sw.shape[1])[None, :]
    S.add(sw, 0.6, 0.8, 0, 0.4)
    # "for the SECOND time": one low hit, a dark chord under the cloud
    S.add(I.timpani(M("D2") * 2, 0.9, r), wt("second", 1) - 0.02, 1.0, 0, 0.4)
    S.add(taiko(r, 1.0), wt("second", 1) - 0.02, 1.0, 0, 0.4)
    S.add(I.pad([M("D3"), M("A3"), M("F4")], REW[0] - wt("second", 1) + 0.2, 0.45, r, att=0.05, rel=0.4, warm=900), wt("second", 1) - 0.02, 0.8, 0, 0.5)
    # ---- rewind: (sfx) then the morning: the theme with chords from the flash out of the rewind
    t_mor = FLASHES[0]
    S.add(I.cymbal(0.22, r, 1.6), t_mor - 0.04, 1.0, 0.3, 0.6)
    t_shock = src(6, 437, 446)
    S.theme(t_mor + 0.05, t_shock - 0.05, vel=0.5, chords=True)
    S.add(I.glock(M("D5") * 2, 0.8, r), t_shock, 1.0, 0.2, 0.5)                # "hanko!" ding
    t_clock = o(seg(9, 565)["o0"])
    S.theme(t_shock + 0.25, t_clock - 0.1, beat=0.5, inst="glock", vel=0.42, perc=True, start_beat=8)
    # ---- 8:15: the pad holds, then the plane: a tension pad and a taiko roll swelling to the white
    t_plane = o(seg(11, 626)["o0"])
    S.add(I.pad([M("D3"), M("A3"), M("E4")], W1[1] - t_clock, 0.32, r, att=0.8, rel=0.02, warm=700,
                trem=lambda t: 0.8 + 0.2 * np.sin(2 * np.pi * 5.5 * t)), t_clock, 0.8, 0, 0.5)
    sw = I.pad([M("A3"), M("Eb4"), M("A4")], W1[1] - t_plane, 0.5, r, att=2.0, rel=0.02, warm=1600, trem=lambda t: 0.75 + 0.25 * np.sin(2 * np.pi * 7 * t))
    sw *= np.linspace(0.3, 1.4, sw.shape[1])[None, :]
    S.add(sw, t_plane, 0.8, 0, 0.4)
    def roll(a0, a1, v0=0.35, v1=1.3):
        t = a0
        while t < a1:
            u = (t - a0) / (a1 - a0)
            S.add(taiko(r, v0 + (v1 - v0) * u ** 1.5), t, 1.0, (-0.3 if int(t * 10) % 2 else 0.3), 0.3)
            t += 0.42 - 0.3 * u
    roll(o(EDL["segs"][16]["o0"]) - 0.6, W1[1] - 0.05)
    # ---- after the first flash: low dissonant drone, a sparse music box
    t_after = W1[3]
    t_shel = o(seg(14, 877)["o0"])
    S.add(I.pad([M("D2"), I.m2f(39)], t_shel - t_after + 0.5, 0.35, r, att=1.0, rel=1.0, warm=400), t_after - 0.3, 0.7, 0, 0.6)
    for k, n in enumerate(["A4", "D5", "Bb4", "A4", "G4"]):
        S.add(I.musicbox(M(n), 0.38, r), t_after + 0.5 + k * 0.7, 1.0, 0.2, 0.5)
    # ---- the shelter, then the train home: a hopeful fragment
    t_train = o(seg(15, 920)["o0"])
    S.add(I.pad([M("D3"), M("A3"), M("F4")], t_train - t_shel + 0.3, 0.33, r, att=0.6, rel=0.6, warm=700), t_shel, 0.7, 0, 0.6)
    t_home = wt("Home", 12)
    S.theme(t_train, t_home - 0.15, beat=0.5, inst="pluck", vel=0.4, perc=False, chords=True)
    # "Home... is NAGASAKI": the dark hit
    t_naga = wt("Nagasaki", 12)
    S.add(I.timpani(M("D2") * 2, 1.0, r), t_naga - 0.02, 1.0, 0, 0.4)
    S.add(taiko(r, 1.2), t_naga - 0.02, 1.0, 0, 0.4)
    S.add(I.pad([M("D3"), M("A3"), M("F4"), I.m2f(63)], 1.6, 0.55, r, att=0.05, rel=0.8, warm=900), t_naga - 0.02, 0.9, 0, 0.5)
    # ---- Nagasaki office: a low pulse that tightens; a heartbeat under the boss; a roll into the second flash
    t_off = o(seg(17, 1045)["o0"]); t_doubt = o(seg(19, 1250)["o0"]); t_then = wt("And", 16)
    t, k = t_off + 0.3, 0
    while t < t_then:
        f = M("D2") * (2 if k % 4 != 2 else 1.5)
        S.add(I.pluck(f, 0.55 + 0.15 * (t > o(seg(18, 1176)["o0"])), r, dur=0.7, bright=0.25, pos=0.3), t, 1.0, -0.1, 0.15)
        if k % 2 == 1 and t > o(seg(18, 1176)["o0"]):
            S.add(I.pluck(M("A3") if k % 4 == 1 else I.m2f(58), 0.3, r, dur=0.6, bright=0.4), t, 1.0, 0.2, 0.2)
        t += 0.6 if t < t_doubt else 0.5; k += 1
    S.add(I.pad([M("D3"), M("A3")], t_then - t_off, 0.22, r, att=1.5, rel=0.3, warm=600), t_off, 0.7, 0, 0.5)
    t = t_doubt
    while t < t_then:
        S.add(heartbeat(r, 0.8), t, 1.0, 0, 0.1); t += 0.85
    sw = I.pad([M("A3"), M("Eb4"), M("A4")], W2[1] - t_then, 0.5, r, att=1.0, rel=0.02, warm=1800, trem=lambda t: 0.7 + 0.3 * np.sin(2 * np.pi * 8 * t))
    sw *= np.linspace(0.3, 1.5, sw.shape[1])[None, :]
    S.add(sw, t_then, 0.8, 0, 0.4)
    roll(t_then + 0.2, W2[1] - 0.05, 0.4, 1.4)
    # ---- after: a low drone; the cloud
    t_cloud = o(seg(33, 0)["o0"]); t_fam = wt("And", 19); t_surv = wt("They", 20)
    S.add(I.pad([M("D2"), I.m2f(39), M("A2")], t_fam - W2[2] + 0.5, 0.38, r, att=1.2, rel=1.0, warm=500), W2[2], 0.7, 0, 0.6)
    S.add(I.timpani(M("D2") * 2, 0.7, r), t_cloud, 1.0, 0, 0.5)
    # "his wife and baby son": the morning theme, alone and slow on a music box, over a held chord; a heartbeat
    for b, n in ((0, "A4"), (0.5, "B4"), (1, "D5"), (2, "B4"), (2.5, "A4"), (3, "G4"), (4, "E4"), (4.5, "G4"), (5, "A4")):
        S.add(I.musicbox(M(n), 0.5, r, dur=2.0), t_fam + 0.1 + b * 0.62, 1.0, 0.1, 0.55)
    S.add(I.pad([M("D3"), M("G3"), M("Bb3")], t_surv - t_fam, 0.32, r, att=0.6, rel=0.3, warm=800), t_fam, 0.8, 0, 0.6)
    t = wt("were", 19)
    while t < t_surv - 0.3:
        S.add(heartbeat(r, 0.7), t, 1.0, 0, 0.1); t += 0.8
    # "They survived": a warm major chord and a sparkle
    t_but = wt("But", 21)
    S.add(I.pad([M("D3"), M("Fs3"), M("A3"), M("D4")], t_but - t_surv + 0.4, 0.5, r, att=0.25, rel=0.9, warm=1300), t_surv - 0.05, 0.9, 0, 0.6)
    for k, n in enumerate(["D5", "Fs4", "A4", "D5"]):
        S.add(I.glock(M(n) if n in YO else M("D5"), 0.35, r), wt("survived", 20) + 0.15 * k, 1.0, 0.1 * k, 0.5)
    # the cost: the music box in minor over low pads, lanterns
    IN = [("A4", 0), ("Bb4", 1), ("A4", 2), ("G4", 3), ("D4", 4.5), ("Eb4", 6), ("D4", 7), ("A3", 8.5)]
    for n, b in IN:
        S.add(I.musicbox(M(n), 0.48, r, dur=2.2), t_but + 0.1 + b * 0.62, 1.0, 0.15, 0.55)
    t_both = wt("Both", 22)
    S.add(I.pad([M("D3"), M("G3"), M("Bb3")], t_both - t_but + 0.3, 0.35, r, att=1.2, rel=1.0, warm=800), t_but, 0.8, 0, 0.6)
    # both times ~3 km: curious plucks; "close enough to be hurt" (minor) / "far enough to live" (major)
    arp = ["D4", "A4", "Fs4", "A4", "D4", "B3", "G3", "D4"]
    t, k = t_both, 0
    t_close, t_far, t_late = wt("Close", 23), wt("Far", 24), wt("Late", 25)
    while t < t_close - 0.1:
        S.add(I.pluck(M(arp[k % 8]), 0.36, r, 0.9, 0.5, 0.2), t, 1.0, -0.2 + 0.4 * (k % 2), 0.3)
        if k % 8 == 0: S.add(I.pluck(M("D2"), 0.6, r, 1.2, 0.25), t, 1.0, 0, 0.15)
        t += 0.3; k += 1
    S.add(I.pad([M("D3"), M("F4"), M("A3")], t_far - t_close, 0.42, r, att=0.1, rel=0.4, warm=800), t_close, 0.9, 0, 0.6)
    S.add(I.pad([M("D3"), M("Fs3"), M("A3"), M("D4")], t_late - t_far + 0.3, 0.45, r, att=0.1, rel=0.8, warm=1200), t_far, 0.9, 0, 0.6)
    S.add(I.glock(M("A5"), 0.5, r), wt("live", 24), 1.0, 0.2, 0.5)
    # the last years: the theme slow and warm, building; two drum hits for "two bombs, three days"
    t_two = wt("Two", 28); t_three = wt("Three", 28); t_and = wt("And", 29)
    S.theme(t_late, t_two - 0.1, beat=0.62, inst="box", vel=0.48, bass=True, perc=False, chords=True)
    for tx in (t_two, t_three):
        S.add(taiko(r, 1.2), tx - 0.02, 1.0, 0, 0.4); S.add(I.timpani(M("D2") * 2, 0.8, r), tx - 0.02, 1.0, 0, 0.4)
    S.add(I.pad([M("D3"), M("A3"), M("D4")], t_and - t_two, 0.4, r, att=0.1, rel=0.5, warm=900), t_two, 0.8, 0, 0.5)
    # the close: the whole theme, warm (plucks + music box + chords), the final chord on "third", ring out
    t_third = wt("third", 29)
    S.theme(t_and, t_third - 0.1, beat=0.6, inst="pluck", vel=0.5, bass=True, perc=False, chords=True)
    S.theme(t_and, t_third - 0.1, beat=0.6, inst="box", vel=0.3, bass=False, perc=False)
    S.add(I.pad([M("D3"), M("Fs3"), M("A3"), M("D4")], DUR - t_third, 0.55, r, att=0.3, rel=0.01, warm=1100), t_third - 0.05, 0.9, 0, 0.6)
    for k3, n in enumerate(["D4", "Fs4", "A4", "D5"]):
        S.add(I.musicbox(M(n), 0.5, r, dur=2.5), t_third + 0.12 * k3, 1.0, 0.1, 0.5)
    ir = make_ir(1.8, 7, hf=1.4)
    out = S.dry + convolve_st(S.send, ir) * 0.55
    # hard cuts: music silent from full white to the end of the hold
    for (a, b, c, d) in WH:
        g = np.ones(N); g[ns(b - 0.02):ns(c + 0.1)] = 0; out *= g[None, :]
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
    K = np.zeros((2, N))   # not gated by the white-outs (ringing, the blast)
    cues = []

    def ev(t, x, g_db, p=0.0, name="", keep=False):
        if t >= DUR:
            return
        x = pan(x, p) if np.asarray(x).ndim == 1 else x
        place(K if keep else B, x, t, dbg(g_db))
        if name:
            cues.append((t, name))

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
            for dt, dg in ((0, 0), (0.11, -1), (0.62, -2), (0.73, -3)):
                ev(t + dt, clack(r), g + dg, 0.25)
            t += period
    def steps(a, b, g, every, scuff=0.4):
        t = a
        while t < b: ev(t, G.stroll_step(r, scuff), g, 0); t += every

    # ---- cold open: office room tone, the panes start to buzz, the whine; white: silence, ringing, the blast
    bed(0.0, W0[1], lambda d: lp(colored(ns(d), rng(9), 1.0), 900) * 0.4, -38, "office room tone", 0.05, 0.02)
    ev(0.55, glass_rattle(W0[1] - 0.55, r), -26, 0.2, "window panes buzzing")
    ev(0.7, whine(W0[1] - 0.7, r), -19, 0, "flash whine (cold open)")
    ev(W0[1], ring(3.0, r), -28, 0, "ear ringing", keep=True)
    ev(W0[1] + 0.15, boom(r, 3.6), -9, 0, "the blast (cold open)", keep=True)
    bed(W0[2] - 0.2, REW[0], lambda d: G.breeze(d, rng(5), 1.0, 0.3, 700)[0], -28, "dusty wind", 0.4, 0.2)
    # ---- rewind
    ev(REW[0], tape_rewind(REW[1] - REW[0], r), -17, 0, "tape rewind")
    rc = reverse_cymbal(REW[1] - REW[0] + 0.02, r)
    ev(REW[1] - len(rc) / SR, rc, -18, 0.2, "reverse cymbal into the flash")
    # ---- Hiroshima morning: shipyard, cicadas, footsteps
    a, b = o(seg(4, 160)["o0"]), o(seg(5, 328)["o0"])
    t = a + 0.15
    while t < b:
        for j in range(4): ev(t + j * 0.09, G.hammer_hit(r, 0.35), -30, -0.6)
        t += r.uniform(0.9, 1.6)
    bed(a, b, lambda d: hp(crackle(d, rng(23), 40), 1800), -31, "welding sizzle", 0.2, 0.3)
    bed(a, b, lambda d: crane_hum(d, rng(24)), -33, "gantry crane motor + chain", 0.3, 0.5)
    bed(a, b, lambda d: G.water_bed(d, rng(25), 0.2, 0.3), -38, "harbour water", 0.3, 0.3)
    for tg in (a + 0.5, a + 2.2, a + 3.9):
        ev(tg, gull(r), -27, float(r.uniform(-0.7, 0.7)), "gull")
    ev(src(4, 274, 288), ship_horn(r), -20, 0.3, "ship's horn (goodbye)")
    bed(a, W1[1], lambda d: cicadas(d, rng(3)), -34, "cicadas (summer street)", 0.3, 0.1)
    steps(b + 0.05, o(seg(6, 437)["o0"]), -27, 0.35)
    ev(src(5, 328, 369), pop(r), -25, 0.3, "thought bubble pop (wife and son)")
    ev(src(6, 437, 449), plip(r), -26, 0.2, "sweat drop")
    ev(src(7, 485, 494), stamp(r), -13, 0, "hanko stamp")
    steps(src(8, 518, 520), o(seg(9, 565)["o0"]), -27, 0.31, 0.6)
    t_clock = o(seg(9, 565)["o0"])
    for k in range(5): ev(t_clock + 0.1 + k * 0.5, tick(r, k % 2 == 0), -23, -0.3)
    cues.append((t_clock, "clock ticks"))
    ev(o(seg(10, 599)["o0"]), plane_drone(W1[1] - o(seg(10, 599)["o0"]), r), -27, 0.0, "B-29 drone (four engines)")
    ev(src(11, 626, 640), swish(0.6, r, 300, 1500), -28, 0.4, "parachutes")
    ev(W1[0] - 0.6, whine(W1[1] - W1[0] + 0.6, r), -19, 0, "flash whine")
    ev(W1[1], ring(4.0, r), -29, 0, "ear ringing", keep=True)
    ev(W1[1] + 0.35, boom(r, 4.5), -10, 0, "the blast (Hiroshima)", keep=True)
    bed(W1[2] - 0.2, o(seg(14, 877)["o0"]), lambda d: G.breeze(d, rng(51), 1.0, 0.3, 700)[0], -28, "dusty wind", 0.4, 0.4)
    ev(src(13, 800, 806), ring(1.2, r, 3900), -25, 0, "eardrums ringing")
    ev(src(13, 836, 838), sizzle(1.2, r), -29, 0.3, "smoke hiss")
    # ---- the shelter at night; the train home; the crane up over Nagasaki
    a, b = span(14, 877)
    bed(a, b + 0.2, lambda d: G.crickets(d, rng(7), 3), -33, "crickets", 0.2, 0.3)
    a, b = span(15, 920)
    chuffs(a, b, -15); clacks(a, b, -20)
    ev(a + 0.1, steam_whistle(r, 1.1), -18, 0.2, "steam whistle (train home)")
    a, b = span(16, 991)
    chuffs(a, b, -19)
    ev(a, swish(1.6, r, 200, 2200), -21, 0.2, "crane-up wind")
    # ---- Nagasaki office
    a = o(seg(17, 1045)["o0"])
    bed(a, W2[1], lambda d: lp(colored(ns(d), rng(91), 1.0), 900) * 0.4, -39, "office room tone", 0.3, 0.02)
    t = a + 0.3
    while t < o(seg(21, 1336)["o0"]):
        ev(t, swish(r.uniform(0.15, 0.3), r, 2500, 7000) * 0.6, -37, r.uniform(-0.6, 0.6)); t += r.uniform(0.6, 1.4)
    ev(o(seg(18, 1206)["o0"]) + 0.03, pop(r), -25, 0.2, "thought bubble pop (the city)")
    t_then = o(seg(21, 1336)["o0"])
    ev(t_then + 0.6, glass_rattle(W2[1] - t_then - 0.6, r), -25, 0.2, "window panes buzzing")
    ev(W2[0] - 0.9, whine(W2[1] - W2[0] + 0.9, r), -19, 0, "second flash whine")
    ev(W2[1], ring(3.5, r), -29, 0, "ear ringing", keep=True)
    ev(W2[1] + 0.2, boom(r, 4.0), -9, 0, "the blast (Nagasaki)", keep=True)
    ev(W2[1] + 0.45, body_thud(r), -14, 0.2, "he hits the floor", keep=True)
    ev(W2[2] - 0.1, debris(2.4, r), -22, 0.1, "debris settling")
    bed(W2[2], o(seg(33, 0)["o0"]), lambda d: G.breeze(d, rng(52), 0.6, 0.2, 600)[0], -32, "dust in the room", 0.3, 0.3)
    # ---- the cloud over the city; the field; the family
    for sid, s0 in ((33, 0), (33, 46)):
        a, b = span(sid, s0)
        ev(a, rumble(b - a + 1.0, r), -18, 0, "distant rumble")
        bed(a, b, lambda d: G.breeze(d, rng(53), 1.0, 0.35, 600)[0], -29, "wind over the hills", 0.2, 0.2)
    a, b = span(22, 1425)
    bed(a, o(seg(22, 1476)["o1"]), lambda d: G.breeze(d, rng(54), 1.0, 0.3, 700)[0], -29, "dusty wind", 0.2, 0.2)
    ev(src(22, 1476, 1488), pop(r), -27, 0.3, "thought bubble (wife and son)")
    # they survived: birds by the tunnel, her footsteps
    a, b = span(28, 2213)
    bed(a, b, lambda d: G.bird_chirps(d, rng(15), 0.4, "sparrow"), -36, "birds", 0.4, 0.4)
    steps(src(28, 2213, 2215), src(28, 2213, 2245), -31, 0.3, 0.3)
    # lanterns: water, crickets
    a, b = o(seg(23, 1526)["o0"]), o(seg(23, 1607)["o1"])
    bed(a, b, lambda d: G.water_bed(d, rng(11), 0.35, 0.4), -33, "river water", 0.5, 0.5)
    bed(a, b, lambda d: G.crickets(d, rng(12), 2), -40, "crickets", 0.5, 0.5)
    # 3 km: whooshes
    a = o(seg(24, 1686)["o0"])
    ev(a - 0.2, swish(1.2, r, 300, 2000), -28, 0, "whoosh to the map")
    ev(src(24, 1686, 1719), swish(1.0, r, 1500, 6000), -30, 0.2, "dashed line draws out")
    ev(o(seg(24, 1752)["o0"]) - 0.1, swish(0.8, r, 400, 2500), -28, 0, "push-in whoosh")
    # garden: birds + breeze from "close enough"
    a = o(seg(27, 2140)["o0"])
    bed(a - 0.2, o(seg(31, 2441)["o0"]), lambda d: G.bird_chirps(d, rng(16), 0.5, "sparrow"), -36, "garden birds", 0.4, 0.4)
    bed(a - 0.2, DUR, lambda d: G.breeze(d, rng(17), 1.0, 0.15, 900)[0], -40, "breeze", 0.4, 0.8)
    # podium: a quiet hall, applause at the end of the line
    a, b = o(seg(31, 2441)["o0"]), o(seg(31, 2500)["o1"])
    bed(a, b, lambda d: G.babble(d, rng(18), 140, 1.0, active=0.3) * 0.25, -40, "audience murmur", 0.3, 0.3) if hasattr(G, "babble") else None
    app = G.applause(1.6, rng(19), 30)   # short and soft: the next line starts right after
    app *= np.clip(tt(1.6) / 0.15, 0, 1)[None, :] * np.clip((1.6 - tt(1.6)) / 0.9, 0, 1)[None, :]
    ev(b - 0.7, app, -32, name="applause")
    ev(src(30, 2366, 2382), stamp(r), -13, 0, "stamp on the certificate")
    app2 = G.applause(1.4, rng(20), 12)
    app2 *= np.clip(tt(1.4) / 0.15, 0, 1)[None, :] * np.clip((1.4 - tt(1.4)) / 0.9, 0, 1)[None, :]
    ev(src(29, 2300, 2343), app2, -36, name="a few hands clap (certificate)")
    bed(o(seg(32, 2549)["o0"]), DUR, lambda d: G.bird_chirps(d, rng(21), 0.35, "sparrow"), -37, "birds (bench)", 0.6, 1.0)
    # two bombs, three days: two distant booms under the drums
    for tx in FLASHES[1:]:
        ev(tx, rumble(2.2, r), -17, 0, "distant boom")
    # white-outs: everything but the whine / ringing / blast is silent while the frame is white
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
    # balance: music bed ~7 LU under the voice before ducking, ducked a further 6 dB while words are spoken (so ~13 LU
    # under the words, and it swells in the gaps); SFX stem ~12 LU under
    Lm = integrated(music); music *= dbg(Lv - 7.0 - Lm)
    music *= dbg(speech_env(-6.0))[None, :]
    Ls = integrated(sfx); sfx *= dbg(Lv - 12.0 - Ls)
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
        fh.write("# Sound cues: Home Was Nagasaki (v2 edit)\n\n" + rep + "\n\n| time (s) | frame | cue |\n|---|---|---|\n")
        for t, name in sorted(cues):
            fh.write(f"| {t:6.2f} | {round(t*FPS)} | {name} |\n")


if __name__ == "__main__":
    main()
