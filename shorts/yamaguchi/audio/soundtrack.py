# Soundtrack of "Home Was Nagasaki": original score + synthesized SFX + the narration, mixed to -15 LUFS / -1.2 dBTP.
# Score: a light pentatonic (yo scale, D) plucked theme for the everyday beats, hard cuts to silence at both flashes,
# a quiet in-scale music box for the cost, curious plucks for the explanation, and the theme again, slower and warm,
# for the ending. SFX: train (chuffs, rail clacks, whistle), shipyard riveting, cicadas, footsteps, pops and dings,
# the stamp, clock ticks, a four-engine drone, the flash whine, ear ringing, distant rumble, night crickets, office
# room tone, a boss's laugh, water, campfire crackle and sizzle, garden birds, applause.
# Every time comes from the picture (shorts/yamaguchi/voice/words.json frames and the remotion story.ts constants).
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
TOTAL = 2715
DUR = TOTAL / FPS
N = ns(DUR)
fr = lambda f: f / FPS
WORDS = json.load(open(os.path.join(HERE, "..", "voice", "words.json")))

# ---------------------------------------------------------------- picture constants (mirrors story.ts)
FLASH1 = (fr(706), fr(724), fr(754), fr(776))     # ramp start, full white, hold end, clear
FLASH2 = (fr(1362), fr(1378), fr(1423), fr(1446))
HOOK_FLASH = fr(160)

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


def woodblock(r, vel):
    return modal(0.12, [(r.uniform(1180, 1240), 1.0, 0.025), (r.uniform(2600, 2700), 0.4, 0.012)], r) * vel


def build_score():
    S = Score(); r = S.r
    # hook: theme under the first line, stop hit on "Home was Nagasaki"
    S.theme(0.05, fr(110), vel=0.5)
    S.add(I.timpani(M("D2") * 2, 0.9, r), fr(124), 1.0, 0, 0.4)
    S.add(I.pad([M("D3"), M("A3"), M("F4")], 1.2, 0.6, r, att=0.05, rel=0.6, warm=900), fr(124), 0.9, 0, 0.5)
    S.add(I.cymbal(0.25, r, 2.0), fr(158), 1.0, 0.3, 0.6)
    # Hiroshima, morning: theme with chords until the shock
    S.theme(HOOK_FLASH + 0.1, fr(436), vel=0.55, chords=True)
    S.add(I.glock(M("D5") * 2, 0.8, r), fr(447), 1.0, 0.2, 0.5)      # "hanko!" ding
    # stamp insert + walking back: glock theme, quicker
    S.theme(fr(467), fr(560), beat=0.5, inst="glock", vel=0.5, perc=True, start_beat=8)
    # clock: just the pad holding, then the plane: tension pad swelling to the flash
    S.add(I.pad([M("D3"), M("A3"), M("E4")], fr(706) - fr(565), 0.32, r, att=1.0, rel=0.05, warm=700,
                trem=lambda t: 0.8 + 0.2 * np.sin(2 * np.pi * 5.5 * t)) * np.linspace(0.6, 1.6, 2)[:, None].mean(), fr(565), 0.8, 0, 0.5)
    sw = I.pad([M("A3"), M("Eb4"), M("A4")], fr(706) - fr(624), 0.5, r, att=2.2, rel=0.03, warm=1600, trem=lambda t: 0.75 + 0.25 * np.sin(2 * np.pi * 7 * t))
    sw *= np.linspace(0.3, 1.4, sw.shape[1])[None, :]
    S.add(sw, fr(624), 0.8, 0, 0.4)
    # after the first flash: only a low dissonant drone, very soft, then the night + train morning
    S.add(I.pad([M("D2"), I.m2f(39)], fr(877) - fr(790), 0.35, r, att=1.5, rel=1.0, warm=400), fr(790), 0.7, 0, 0.6)
    for k, n in enumerate(["A4", "D5", "Bb4", "A4", "G4"]):
        S.add(I.musicbox(M(n), 0.4, r), fr(880) + k * 0.75, 1.0, 0.2, 0.5)
    S.add(I.pad([M("D3"), M("A3"), M("F4")], fr(915) - fr(877), 0.35, r, att=0.8, rel=0.8, warm=700), fr(877), 0.7, 0, 0.6)
    S.theme(fr(915), fr(988), beat=0.62, inst="pluck", vel=0.42, perc=False, chords=True)
    # "Home is Nagasaki": the same stop hit as the hook
    S.add(I.timpani(M("D2") * 2, 1.0, r), fr(1001), 1.0, 0, 0.4)
    S.add(I.pad([M("D3"), M("A3"), M("F4")], 1.3, 0.6, r, att=0.05, rel=0.7, warm=900), fr(1001), 0.9, 0, 0.5)
    # office: deadpan walking pizzicato, glock answers; ba-dum after "of course he does"
    S.theme(fr(1043), fr(1150), beat=0.6, inst="glock", vel=0.4, chords=False, start_beat=0)
    S.add(I.pluck(M("A2"), 0.9, r, 0.6, 0.3), fr(1150), 1.0, 0, 0.1); S.add(I.pluck(M("D2") * 2, 1.0, r, 0.9, 0.3), fr(1159), 1.0, 0, 0.1)
    S.theme(fr(1168), fr(1358), beat=0.6, inst="pluck", vel=0.4, chords=False, start_beat=4)
    S.add(I.glock(M("A5"), 0.7, r), fr(1186), 1.0, 0.3, 0.5)      # "one"
    # second flash: silence; then the cloud: in-scale music box over a low pad (somber), lanterns
    S.add(I.pad([M("D2"), I.m2f(39), M("A2")], fr(1526) - fr(1430), 0.4, r, att=1.5, rel=1.5, warm=500), fr(1430), 0.7, 0, 0.6)
    IN = [("A4", 0), ("Bb4", 1), ("A4", 2), ("G4", 3), ("D4", 4.5), ("Eb4", 6), ("D4", 7), ("A3", 8.5), ("D4", 10), ("G4", 11.5), ("A4", 13), ("D5", 15)]
    for n, b in IN:
        S.add(I.musicbox(M(n.replace("Bb", "Bb").replace("Eb", "Eb")) if n in YO else I.m2f(YO[n]), 0.5, r, dur=2.2), fr(1530) + b * 0.75, 1.0, 0.15, 0.55)
    S.add(I.pad([M("D3"), M("G3"), M("Bb3")], fr(1607) - fr(1526), 0.35, r, att=1.5, rel=1.0, warm=800), fr(1526), 0.8, 0, 0.6)
    S.add(I.pad([M("D3"), M("Fs3"), M("A3")], fr(1668) - fr(1607), 0.38, r, att=1.0, rel=1.2, warm=900), fr(1607), 0.8, 0, 0.6)
    # explanation: curious plucked arpeggios
    arp = ["D4", "A4", "Fs4", "A4", "D4", "B3", "G3", "D4"]
    t = fr(1668)
    k = 0
    while t < fr(2110):
        if not (fr(1866) <= t < fr(1896)):  # stop for the scorch
            n = arp[k % 8]
            S.add(I.pluck(M(n), 0.38, r, 0.9, 0.5, 0.2), t, 1.0, -0.2 + 0.4 * (k % 2), 0.3)
            if k % 8 == 0:
                S.add(I.pluck(M("D2") if (k // 8) % 2 == 0 else M("G2"), 0.6, r, 1.2, 0.25), t, 1.0, 0, 0.15)
        t += 0.3; k += 1
    S.add(I.pad([M("D3"), M("A3"), M("Fs4")], fr(2110) - fr(1668), 0.22, r, att=1.5, rel=1.0, warm=900), fr(1668), 0.7, 0, 0.6)
    for k2, fr_ in enumerate([2034, 2036, 2038, 2040]):
        S.add(I.glock(M("A5") * (1 + 0.12 * k2), 0.35, r), fr(fr_), 1.0, 0.1 * k2, 0.4)
    S.add(I.glock(M("D5") * 2, 0.6, r), fr(2063), 1.0, 0, 0.5)
    # ending: the theme again, slower and warm (music box + plucks + pad), final chord under "ninety-three"
    S.theme(fr(2110), fr(2655), beat=0.72, inst="box", vel=0.5, bass=True, perc=False, chords=True)
    S.add(I.pad([M("D3"), M("Fs3"), M("A3"), M("D4")], DUR - fr(2660), 0.55, r, att=0.3, rel=0.01, warm=1100), fr(2660), 0.9, 0, 0.6)
    for k3, n in enumerate(["D4", "Fs4", "A4", "D5"]):
        S.add(I.musicbox(M(n), 0.5, r, dur=2.5), fr(2665) + 0.12 * k3, 1.0, 0.1, 0.5)
    ir = make_ir(1.8, 7, hf=1.4)
    out = S.dry + convolve_st(S.send, ir) * 0.55
    # hard cuts at the flashes (music silent through the white-outs)
    for (a, b, c, d) in (FLASH1, FLASH2):
        g = np.ones(N)
        k0, k1 = ns(b - 0.02), ns(c + 0.1)
        g[k0:k1] = 0
        out[:, ns(a):k0] *= np.linspace(1.0, 1.0, k0 - ns(a))[None, :]
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


def steam_whistle(r, dur=1.4):
    t = tt(dur)
    env = np.clip(t / 0.06, 0, 1) * np.clip((dur - t) / 0.25, 0, 1)
    y = np.zeros_like(t)
    for f in (494, 587, 740):  # a soft chord whistle
        ph = phase(f * (1 + 0.004 * np.sin(2 * np.pi * 5 * t)))
        y += np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.1 * np.sin(3 * ph)
    y += bp(r.standard_normal(len(t)), 800, 5000, 1) * 0.6
    return y * env * 0.3


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


def build_sfx():
    r = rng(809)
    B = np.zeros((2, N))
    cues = []

    def ev(t, x, g_db, p=0.0, name=""):
        if t >= DUR:
            return
        x = pan(x, p) if np.asarray(x).ndim == 1 else x
        place(B, x, t, dbg(g_db))
        if name:
            cues.append((t, name))

    def bed(t0, t1, x_fn, g_db, name, fin=0.4, fout=0.4):
        d = t1 - t0
        x = st(x_fn(d))
        x = fades(x, fin, fout) if x.ndim == 1 else np.stack([fades(c, fin, fout) for c in x])
        ev(t0, x, g_db, name=name)

    # --- train (shots 1-3, 15-16): chuffs at ~4/s, rail clacks in pairs, whistle
    for (a, b, g) in ((0.0, fr(160), -16), (fr(915), fr(1043), -15)):
        t = a
        k = 0
        while t < b:
            ev(t, chuff(r, 1.0 if k % 4 == 0 else 0.6), g, -0.2)
            t += 0.24; k += 1
        t = a + 0.3
        while t < b:
            ev(t, clack(r), g - 4, 0.3); ev(t + 0.11, clack(r), g - 5, 0.3)
            t += 1.15
    cues.append((0.0, "train: chuffs + clacks"))
    ev(fr(918), steam_whistle(r, 1.3), -20, 0.2, "steam whistle (train leaves)")
    ev(fr(116), steam_whistle(r, 0.9) * 0.6, -24, 0.3, "distant whistle under 'Home was Nagasaki'")
    # --- shipyard: riveting hammer and clanks, gulls-ish chirps
    t = fr(165)
    while t < fr(328):
        for j in range(4):
            ev(t + j * 0.09, G.hammer_hit(r, 0.35), -30, -0.6)
        t += r.uniform(0.9, 1.6)
    cues.append((fr(165), "shipyard riveting"))
    # --- street ambience: cicadas
    bed(fr(160), fr(706), lambda d: cicadas(d, rng(3)), -34, "cicadas (summer street)", 1.0, 0.1)
    # walking footsteps (shot 5: 2 m/s, a step per 0.7 m; shot 6 until 418; shot 8 hurried)
    t = fr(330)
    while t < fr(418):
        ev(t, G.stroll_step(r, 0.4), -27, 0); t += 0.35
    t = fr(520)
    while t < fr(565):
        ev(t, G.stroll_step(r, 0.6), -27, 0); t += 0.31
    ev(fr(369), pop(r), -24, 0.3, "thought bubble pop")
    ev(fr(449), plip(r), -26, 0.2, "sweat drop")
    ev(fr(494), stamp(r), -14, 0, "hanko stamp")
    ev(fr(2382), stamp(r), -14, 0, "hanko stamp (certificate)")
    for k in range(4):
        ev(fr(567) + k * 0.5, tick(r, k % 2 == 0), -24, -0.3)
    cues.append((fr(567), "clock ticks"))
    ev(fr(612), plane_drone(fr(724) - fr(612), r), -28, 0.0, "B-29 drone (four engines)")
    ev(fr(636), swish(0.6, r, 300, 1500), -28, 0.4, "parachutes")
    # --- flash 1: whine to silence, ear ringing through the white, distant rumble, dust wind
    ev(fr(696), whine(fr(724) - fr(696), r), -20, 0, "flash whine")
    ev(fr(724), ring(4.0, r), -30, 0, "ear ringing")
    ev(fr(752), rumble(5.0, r), -12, 0, "distant blast rumble")
    bed(fr(756), fr(877), lambda d: G.breeze(d, rng(5), 1.0, 0.3, 700)[0], -28, "dusty wind", 1.0, 0.5)
    ev(fr(805), ring(1.2, r, 3900), -26, 0, "eardrums ringing")
    ev(fr(835), sizzle(1.2, r), -30, 0.3, "smoke hiss")
    # --- night shelter: crickets
    bed(fr(870), fr(920), lambda d: G.crickets(d, rng(7), 3), -34, "crickets", 0.3, 0.4)
    # --- office: room tone, pencil scratches, clock, the boss's laugh, pops, dings
    bed(fr(1043), fr(1365), lambda d: lp(colored(ns(d), rng(9), 1.0), 900) * 0.4, -40, "office room tone", 0.3, 0.05)
    t = fr(1050)
    while t < fr(1360):
        ev(t, swish(r.uniform(0.15, 0.3), r, 2500, 7000) * 0.6, -36, r.uniform(-0.6, 0.6)); t += r.uniform(0.6, 1.4)
    ev(fr(1201), pop(r), -24, 0.2, "thought bubble pop (city)")
    ev(fr(1262), laugh(r), -21, 0.25, "boss laughs")
    ev(fr(1352), whine(fr(1378) - fr(1352), r), -20, 0, "second flash whine")
    ev(fr(1378), ring(3.5, r), -30, 0, "ear ringing")
    ev(fr(1421), rumble(5.0, r), -12, 0, "rumble (Nagasaki)")
    ev(fr(1487), plip(r), -26, 0.2, "sweat drop")
    # --- lanterns: water lapping, a few crickets
    bed(fr(1520), fr(1668), lambda d: G.water_bed(d, rng(11), 0.35, 0.4), -34, "river water", 0.6, 0.6)
    bed(fr(1520), fr(1668), lambda d: G.crickets(d, rng(12), 2), -40, "crickets", 0.6, 0.6)
    # --- explanation: whoosh in, dashed line drawn, campfire
    ev(fr(1663), swish(1.4, r, 300, 2000), -28, 0, "camera crane whoosh")
    ev(fr(1719), swish(1.0, r, 1500, 6000), -30, 0.2, "dashed line draws out")
    ev(fr(1752), swish(0.8, r, 400, 2500), -28, 0, "push-in whoosh")
    bed(fr(1795), fr(2110), lambda d: crackle(d, rng(13)), -28, "campfire crackle", 0.5, 0.6)
    bed(fr(1795), fr(2110), lambda d: G.crickets(d, rng(14), 2), -40, "crickets", 0.5, 0.6)
    ev(fr(1866), sizzle(1.0, r), -22, 0, "scorch sizzle")
    ev(fr(1868), G.oof(r, "ow", 140), -22, 0, "'ow!'")
    t = fr(1900)
    while t < fr(1932):
        ev(t, G.stroll_step(r, 0.8) * 0.6, -30, 0); t += 0.32
    for k, fr_ in enumerate([2034, 2036, 2038, 2040]):
        ev(fr(fr_), pop(r), -30, 0.1 * k)
    ev(fr(1963), swish(1.6, r, 800, 4000), -32, 0, "heat rays sweep")
    # --- garden: birds + breeze; wife's steps; applause after the podium line
    bed(fr(2105), DUR, lambda d: G.bird_chirps(d, rng(15), 0.5, "sparrow"), -36, "garden birds", 0.6, 0.8)
    bed(fr(2105), DUR, lambda d: G.breeze(d, rng(16), 1.0, 0.15, 900)[0], -40, "breeze", 0.6, 0.8)
    t = fr(2215)
    while t < fr(2245):
        ev(t, G.stroll_step(r, 0.3) * 0.5, -32, -0.2); t += 0.3
    app = G.applause(3.2, rng(17), 30)
    app *= np.clip(tt(3.2) / 0.3, 0, 1)[None, :] * np.clip((3.2 - tt(3.2)) / 1.4, 0, 1)[None, :]
    ev(fr(2528), app, -26, name="applause")
    # white-outs: everything but the whine / ringing is silent while the frame is white
    for (a, b, c, d) in (FLASH1, FLASH2):
        g = np.ones(N)
        g[ns(b):ns(c - 0.06)] = 0.0
        B *= g[None, :]
    return B, cues


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


def main():
    v, sr = read_wav(os.path.join(HERE, "..", "voice", "voice.wav"))
    v = v.mean(0)
    if sr != SR:
        from scipy import signal
        v = signal.resample_poly(v, SR, sr)
    voice = np.zeros(N); voice[: min(N, len(v))] = v[:N]
    voice = st(voice)
    print("score..."); music = build_score()
    print("sfx..."); sfx, cues = build_sfx()
    Lv = integrated(voice)
    # balance: music bed ~10 LU under the voice (ducked a further 4 dB while words are spoken), SFX stem ~12 LU under
    Lm = integrated(music); music *= dbg(Lv - 10.0 - Lm)
    music *= dbg(speech_env(-4.0))[None, :]
    Ls = integrated(sfx); sfx *= dbg(Lv - 13.0 - Ls)
    mix = voice + music + sfx
    g = dbg(-15.0 - integrated(mix))
    mix, voice, music, sfx = mix * g, voice * g, music * g, sfx * g
    mix = limiter(mix)
    fade = np.ones(N); fade[-ns(1.0):] = np.linspace(1, 0, ns(1.0)) ** 1.5
    mix *= fade[None, :]
    write_wav(os.path.join(HERE, "mix.wav"), mix)
    for name, x in (("voice", voice), ("music", music), ("sfx", sfx)):
        write_wav(os.path.join(HERE, f"stem_{name}.wav"), x)
    rep = f"integrated {integrated(mix):.1f} LUFS, true peak {true_peak(mix):.1f} dBTP, voice {integrated(voice):.1f}, music {integrated(music):.1f}, sfx {integrated(sfx):.1f}, length {mix.shape[1]/SR:.3f} s"
    print(rep)
    with open(os.path.join(HERE, "cues.md"), "w") as fh:
        fh.write("# Sound cues: Home Was Nagasaki\n\n" + rep + "\n\n| time (s) | frame | cue |\n|---|---|---|\n")
        for t, name in sorted(cues):
            fh.write(f"| {t:6.2f} | {round(t*FPS)} | {name} |\n")


if __name__ == "__main__":
    main()
