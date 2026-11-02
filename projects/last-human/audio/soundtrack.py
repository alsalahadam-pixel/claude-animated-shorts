"""Original score + synthesized sound design + final mix for the 60 s short (numpy/scipy only).

usage: python -I soundtrack.py            (reads ../voice/voice.wav and ../src/data/words.json)
Writes audio/mix.wav (48 kHz stereo, exactly 60.000 s, -14 LUFS integrated, true peak <= -1 dBTP) plus stems and
audio/cues.md. All times below come from the shot table in src/story.ts (frame / 30) and the voice slots.
"""
import json
import os
import sys

import numpy as np
from scipy import ndimage, signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from dsp import (SR, bp, colored, convolve_st, curve, dbg, fades, hp, integrated, lp, make_ir, ns, pan, peq,  # noqa: E402
                 read_wav, rng, smooth_noise, true_peak, write_wav)

DUR = 60.0
N = ns(DUR)
R = rng(2026)
CUES = []


def T(n):
    return np.arange(n) / SR


def cue(t, name):
    CUES.append((t, name))


def add(buf, x, t, g=1.0, p=0.0):
    """mix mono or stereo x into stereo buf at time t (s) with gain g and pan p"""
    if x.ndim == 1:
        x = pan(x, p)
    k = ns(t)
    if k >= buf.shape[1]:
        return
    n = min(x.shape[1], buf.shape[1] - k)
    if k < 0:
        x = x[:, -k:]; n = min(x.shape[1], buf.shape[1]); k = 0
    buf[:, k:k + n] += g * x[:, :n]


def env_ar(n, att, rel):
    t = T(n)
    e = np.minimum(1, t / max(att, 1e-4)) * np.exp(-t / max(rel, 1e-4))
    return e


def m2f(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ================================================================ instruments
def piano(f, vel=0.6, dur=4.0, detune_c=0.0):
    """additive felt piano: inharmonic partials, faster decay up the series, a soft hammer, slightly out of tune"""
    n = ns(dur); t = T(n)
    f = f * 2 ** (detune_c / 1200)
    y = np.zeros(n)
    B = 0.00035
    for k in range(1, 11):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > SR * 0.45:
            break
        a = (1 / k ** 1.3) * np.exp(-t * (0.55 + 0.45 * k))
        y += a * np.sin(2 * np.pi * fk * t + R.uniform(0, 6.28))
    ham = bp(colored(ns(0.03), R, 1.0), 800, 3000) * np.exp(-T(ns(0.03)) / 0.006) * 0.15
    y[:len(ham)] += ham
    y *= np.minimum(1, t / 0.004)
    return fades(lp(y, 3200), 0.002, 0.3) * vel


def pad(freqs, dur, att=2.0, rel=2.5, cutoff=900, gain=1.0, detune=8.0, trem=0.0):
    n = ns(dur); t = T(n)
    y = np.zeros((2, n))
    for f in freqs:
        for d, side in ((-detune, -0.6), (0, 0), (detune, 0.6)):
            ff = f * 2 ** (d / 1200)
            w = signal.sawtooth(2 * np.pi * ff * t + R.uniform(0, 6.28)) * 0.33
            y += pan(w, side * 0.7)
    y = lp(y, cutoff, 2)
    e = np.minimum(1, t / att) * np.minimum(1, (dur - t) / rel)
    if trem:
        e *= 1 - trem * (0.5 + 0.5 * np.sin(2 * np.pi * 0.25 * t))
    return y * e[None, :] * gain / max(1, len(freqs))


def drone(f, dur, gain=1.0, att=3.0, rel=3.0):
    n = ns(dur); t = T(n)
    wob = 1 + 0.002 * smooth_noise(n, R, 0.2)
    ph = 2 * np.pi * np.cumsum(f * wob) / SR
    y = np.sin(ph) + 0.5 * np.sin(2 * ph + 0.3) + 0.25 * signal.sawtooth(ph * 1.0)
    y = lp(y, 300)
    e = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, dur - t) / rel)
    return y * e * gain


def boom(dur=2.5, f0=62, f1=32, gain=1.0):
    n = ns(dur); t = T(n)
    f = f1 + (f0 - f1) * np.exp(-t / 0.25)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.8)
    th = lp(colored(n, R, 1.5), 180) * np.exp(-t / 0.08) * 0.6
    return fades((y + th) * gain, 0.001, 0.4)


def riser(dur, f0=200, f1=2400, gain=1.0):
    n = ns(dur); t = T(n)
    u = t / dur
    z = colored(n, R, 0.5)
    fc = f0 * (f1 / f0) ** u
    out = np.zeros(n)
    # piecewise band-pass sweep
    seg = ns(0.05)
    for i in range(0, n, seg):
        c = fc[min(i, n - 1)]
        out[i:i + seg] = bp(z[max(0, i - 2000):i + seg], c * 0.7, c * 1.4)[-len(z[i:i + seg]):]
    tone = sum(np.sin(2 * np.pi * np.cumsum(fr * (1 + 0.6 * u)) / SR) for fr in (440, 466.2, 523.3)) * 0.12
    return fades((out * 0.6 + tone) * u ** 2 * gain, 0.01, 0.02)


def cluster(freqs, dur, att=1.5, rel=1.5, gain=1.0, trem=6.0):
    n = ns(dur); t = T(n)
    y = sum(np.sin(2 * np.pi * f * t + R.uniform(0, 6)) for f in freqs) / len(freqs)
    y *= 1 - 0.25 * (0.5 + 0.5 * np.sin(2 * np.pi * trem * t))
    e = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, dur - t) / rel)
    return y * e * gain


def stinger(gain=1.0):
    n = ns(3.5); t = T(n)
    hi = sum(signal.sawtooth(2 * np.pi * f * t + R.uniform(0, 6)) for f in (880, 932.3, 987.8, 1046.5, 1108.7)) / 5
    hi = bp(hi, 600, 5000) * np.exp(-t / 0.9) * np.minimum(1, t / 0.01)
    scr = np.sin(2 * np.pi * 1300 * t + 6 * np.sin(2 * np.pi * 377 * t)) * np.exp(-t / 0.5) * 0.4
    return (boom(3.5, 70, 30, 1.0)[:n] * 1.0 + (hi + scr) * 0.45) * gain


# ================================================================ sound effects
def footstep(kind="dry", gain=1.0):
    n = ns(0.28); t = T(n)
    heel = lp(colored(n, R, 1.0), 900) * np.exp(-t / 0.018)
    thump = np.sin(2 * np.pi * 85 * t) * np.exp(-t / 0.03) * 0.8
    scuff = bp(colored(n, R, 0.3), 1500, 6000) * np.exp(-np.maximum(t - 0.03, 0) / 0.05) * (t > 0.025) * 0.25
    y = heel + thump + scuff
    if kind == "wet":
        y += bp(colored(n, R, 0.0), 2500, 9000) * np.exp(-np.maximum(t - 0.01, 0) / 0.06) * 0.5
    return fades(y * gain * R.uniform(0.8, 1.1), 0.001, 0.05)


def steps(t0, t1, speed, start_d=0.0, kind="dry", gain=1.0, p=0.0, buf=None, wet_k=0.0):
    k = 0
    while True:
        d = 0.75 * k + 0.375
        if d >= start_d:
            t = t0 + (d - start_d) / speed
            if t >= t1:
                break
            add(buf, footstep(kind, gain), t, 1.0, p)
        k += 1


def wind(dur, gain=1.0):
    n = ns(dur)
    z = colored(n, R, 1.3)
    g = 0.55 + 0.45 * smooth_noise(n, R, 0.15)
    y = np.stack([bp(z, 180, 900) * g, bp(np.roll(z, 9000), 180, 900) * g[::-1]])
    return fades(y * gain, 1.0, 1.0)


def servo(dur=1.2, f0=170, f1=240, gain=1.0):
    n = ns(dur); t = T(n)
    f = f0 + (f1 - f0) * np.minimum(1, t / (dur * 0.6))
    w = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR) + 0.4 * signal.square(2 * np.pi * np.cumsum(f * 3.01) / SR)
    w = bp(w, 300, 3500) * (1 + 0.2 * np.sin(2 * np.pi * 31 * t))
    gear = bp(colored(n, R, 0.0), 3000, 8000) * 0.15
    e = np.minimum(1, t / 0.03) * np.minimum(1, (dur - t) / 0.08)
    stop = np.zeros(n); k = ns(dur - 0.05); stop[k:k + ns(0.02)] = np.hanning(ns(0.02)) * 1.5
    return fades((w * 0.5 + gear) * e * gain + hp(stop, 1000) * gain, 0.005, 0.02)


def static(dur, gain=1.0):
    n = ns(dur)
    z = hp(colored(n, R, 0.0), 400)
    z *= 1 + 0.3 * np.sign(np.sin(2 * np.pi * 7.3 * T(n)))
    return fades(z * gain, 0.05, 0.05)


def hum(dur, gain=1.0):
    n = ns(dur); t = T(n)
    y = sum(np.sin(2 * np.pi * 60 * k * t) / k for k in (1, 2, 3, 5))
    crack = np.zeros(n)
    for _ in range(int(dur * 3)):
        k = R.integers(0, n - 2000); crack[k:k + 300] += R.standard_normal(300) * 0.6
    return fades(y * 0.4 * gain + hp(crack, 2000) * gain * 0.3, 0.3, 0.3)


def door_slam(gain=1.0):
    n = ns(1.2); t = T(n)
    thud = lp(colored(n, R, 1.2), 300) * np.exp(-t / 0.06) * 1.2 + np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.12)
    wood = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, d in ((180, 0.15), (410, 0.08), (730, 0.05))) * 0.4
    rattle = bp(colored(n, R, 0.0), 2000, 7000) * np.exp(-np.maximum(t - 0.04, 0) / 0.12) * (t > 0.04) * 0.25
    return fades((thud + wood + rattle) * gain, 0.001, 0.2)


def clink(f=3200, gain=1.0):
    n = ns(0.25); t = T(n)
    y = sum(np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, d in ((1, 0.06), (2.76, 0.03), (5.4, 0.015)))
    return fades(y * gain, 0.0005, 0.05)


def buzz(dur=0.42, gain=1.0):
    n = ns(dur); t = T(n)
    y = signal.square(2 * np.pi * 155 * t) * 0.6 + np.sin(2 * np.pi * 310 * t) * 0.3
    y *= 1 + 0.5 * np.sin(2 * np.pi * 37 * t)
    y = bp(y, 120, 2500)
    e = np.minimum(1, t / 0.01) * np.minimum(1, (dur - t) / 0.02)
    return y * e * gain


def heartbeat(gain=1.0):
    def thump(d=0.18, f=52):
        n = ns(d); t = T(n)
        return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.6 * np.exp(-t / 0.02))) / SR) * np.exp(-t / 0.06) + lp(colored(n, R, 1.5), 120) * np.exp(-t / 0.02) * 0.4
    y = np.zeros(ns(0.6))
    a = thump(); y[:len(a)] += a
    b = thump(0.16, 46) * 0.7; k = ns(0.22); y[k:k + len(b)] += b
    return y * gain


def breath(dur=0.6, gain=1.0, rising=True):
    n = ns(dur); t = T(n)
    z = colored(n, R, 0.5)
    y = bp(z, 500, 2600) + 0.6 * bp(z, 1100, 1500)
    e = np.sin(np.pi * np.minimum(1, t / dur)) ** (0.7 if rising else 1.5)
    return y * e * gain


def whoosh(dur=0.9, gain=1.0):
    n = ns(dur); t = T(n)
    z = colored(n, R, 0.7)
    fc = 300 + 2500 * np.sin(np.pi * t / dur) ** 2
    y = np.zeros(n); seg = ns(0.03)
    for i in range(0, n, seg):
        c = fc[i]; y[i:i + seg] = bp(z[max(0, i - 1500):i + seg], c * 0.6, c * 1.6)[-len(z[i:i + seg]):]
    return y * np.sin(np.pi * t / dur) ** 2 * gain


def glass(dur, gain=1.0):
    return cluster([1760, 1766.5, 2637, 2645, 3520], dur, 2.0, 1.5, gain, trem=0.7)


# ================================================================ build
def build():
    music = np.zeros((2, N))
    sfx = np.zeros((2, N))
    amb = np.zeros((2, N))
    rev_room = make_ir(1.1, 3, hf=1.4)
    rev_big = make_ir(3.4, 5, hf=1.1, pre=0.02)

    # ---------- score
    cue(0.0, "hook: sub boom + bell, A-minor pad enters")
    add(music, boom(3.0, 66, 30, 2.0), 0.0)
    add(music, piano(m2f(88), 0.35, 5.0), 0.02, 1.0, 0.2)
    add(music, drone(55.0, 12.4, 0.5, 1.5, 1.2), 0.0)
    add(music, pad([110, 164.8, 246.9, 261.6], 12.6, 2.0, 1.5, 700, 0.9), 0.3)
    mel1 = [(1.7, 76, 0.18), (5.3, 69, 0.35), (6.4, 72, 0.3), (7.6, 71, 0.3), (9.2, 64, 0.32), (10.4, 67, 0.28), (11.3, 69, 0.3)]
    for t, m, v in mel1:
        add(music, piano(m2f(m), v, 4.5, R.uniform(-14, 14)), t, 1.0, R.uniform(-0.3, 0.3))
    cue(12.0, "city: F maj7 -> D min -> E, wind; piano continues")
    add(music, pad([87.3, 130.8, 164.8, 220], 4.0, 1.0, 1.2, 800, 0.85), 12.0)
    add(music, pad([73.4, 110, 174.6, 261.6], 4.2, 1.2, 1.2, 800, 0.85), 15.3)
    add(music, pad([82.4, 123.5, 220, 246.9], 4.6, 1.2, 1.5, 900, 0.85), 18.5)
    add(music, drone(41.2, 10.8, 0.45, 2.0, 1.0), 12.0)
    mel2 = [(12.6, 72, 0.3), (13.6, 71, 0.28), (15.0, 69, 0.3), (16.4, 76, 0.22), (17.6, 74, 0.26), (19.2, 72, 0.28), (20.6, 71, 0.28), (21.8, 68, 0.3)]
    for t, m, v in mel2:
        add(music, piano(m2f(m), v, 4.0, R.uniform(-16, 16)), t, 1.0, R.uniform(-0.3, 0.3))
    cue(22.6, "night: low pulse ostinato A1 at 84 bpm, high tension cluster")
    beat = 60 / 84 / 2
    t = 22.6
    while t < 32.0:
        n = ns(0.3); tt = T(n)
        w = signal.sawtooth(2 * np.pi * 55 * tt) * np.exp(-tt / 0.12)
        prog = (t - 22.6) / 9.4
        w = lp(w, 250 + 900 * prog)
        add(music, w * (0.35 + 0.35 * prog), t, 1.0)
        t += beat
    add(music, cluster([932.3, 987.8, 1046.5, 1108.7], 9.4, 3.0, 1.0, 0.09), 22.6)
    add(music, drone(55.0, 9.6, 0.5, 1.0, 0.6), 22.6)
    add(music, riser(2.2, 150, 1800, 0.4), 26.4)
    cue(28.5, "cameras turn: swell")
    add(music, boom(2.0, 55, 35, 0.6), 28.5)
    cue(32.0, "reflection: drone + glass tone; near silence 36.3-38.9")
    add(music, drone(43.65, 4.6, 0.35, 0.5, 1.2), 32.0)
    add(music, glass(9.5, 0.10), 32.2)
    cue(39.3, "the smile: dissonant swell + stinger at 40.0")
    add(music, cluster([466.2, 493.9, 523.3, 554.4], 2.6, 0.8, 0.8, 0.18, trem=9), 39.2)
    add(music, stinger(1.1), 40.0)
    cue(42.0, "home: door slam on the cut, low D drone, piano reprise")
    add(music, drone(36.7, 10.0, 0.5, 1.0, 1.5), 42.0)
    add(music, pad([73.4, 110, 174.6], 7.0, 2.0, 2.0, 500, 0.55, trem=0.3), 42.4)
    for t, m, v in [(44.2, 74, 0.22), (45.6, 69, 0.2), (47.0, 65, 0.2)]:
        add(music, piano(m2f(m), v, 4.5, R.uniform(-22, 22)), t, 1.0, R.uniform(-0.2, 0.2))
    cue(49.2, "the photo: dread swell")
    add(music, cluster([110, 116.5, 155.6, 164.8], 4.2, 1.2, 1.5, 0.35, trem=0.5), 49.1)
    add(music, boom(2.5, 50, 28, 0.55), 49.25)
    cue(53.2, "riser to the end; heartbeat")
    add(music, riser(5.6, 120, 3000, 0.26), 53.3)
    add(music, cluster([220, 233.1, 246.9, 261.6, 277.2], 5.6, 4.0, 0.05, 0.09, trem=11), 53.3)
    cue(58.9, "cut to black: stinger, tail to 60")
    add(music, stinger(3.6), 58.9)

    # ---------- ambience
    add(amb, np.stack([hp(lp(colored(ns(12.0), R, 1.0), 400), 40)] * 2) * 0.05, 0.0)            # room tone (morning)
    for k in range(5, 12):
        add(amb, clink(4200, 0.05), k + 0.5, 1.0, -0.4)                                          # a clock ticking
    add(amb, static(3.4, 0.028), 8.6, 1.0, -0.3)                                                   # TV static on screen
    add(amb, static(3.4, 0.012), 5.2, 1.0, -0.6)
    add(amb, wind(10.6, 0.08), 12.0)
    add(amb, np.stack([lp(colored(ns(10.6), R, 2.0), 120)] * 2) * 0.04, 12.0)                    # far city rumble
    add(amb, hum(9.4, 0.025), 22.6)                                                               # neon buzz
    add(amb, wind(9.4, 0.05), 22.6)
    add(amb, hum(10.0, 0.02), 32.0)
    add(amb, np.stack([hp(lp(colored(ns(18.0), R, 1.0), 300), 40)] * 2) * 0.04, 42.0)           # room tone (night)
    for k in range(43, 49):
        add(amb, clink(4200, 0.035), k + 0.2, 1.0, 0.4)

    # ---------- foley / sfx
    cue(0.55, "inhale as his eyes open"); add(sfx, breath(0.55, 0.12), 0.48)
    cue(2.0, "gasp: he jolts upright"); add(sfx, breath(0.45, 0.18), 1.95); add(sfx, whoosh(0.5, 0.05), 1.95)
    add(sfx, whoosh(0.8, 0.10), 11.6)                                                              # dip to the city
    steps(12.0, 15.4, 1.25, 0.0, "dry", 0.22, 0.0, sfx)
    steps(15.4, 18.6, 1.0, 0.0, "dry", 0.18, 0.4, sfx)
    steps(18.6, 22.6, 1.1, 0.0, "dry", 0.3, -0.1, sfx)
    add(sfx, hum(4.0, 0.03), 18.6, 1.0, -0.3)                                                      # traffic-light buzz
    steps(22.6, 25.6, 1.15, 0.0, "wet", 0.32, 0.1, sfx)
    steps(25.6, 28.4, 1.15, 3.45, "wet", 0.12, -0.3, sfx)
    cue(24.5, "first camera starts to turn"); add(sfx, servo(1.1, 160, 200, 0.10), 24.5, 1.0, 0.5)
    cue(25.9, "close camera follows him"); add(sfx, servo(1.7, 150, 230, 0.22), 25.85)
    add(sfx, servo(0.4, 200, 210, 0.12), 27.6)
    cue(28.5, "every camera turns")
    for i in range(10):
        add(sfx, servo(1.0 + R.uniform(0, 0.3), 140 + 12 * i, 210 + 10 * i, 0.08), 28.5 + (i % 5) * 0.1 + R.uniform(0, 0.05), 1.0, R.uniform(-0.8, 0.8))
    # scene 5: his steps stop; the reflection takes one more (closer, glassy)
    k = 0
    while True:
        d = 0.75 * k + 0.375; t = 32.0 + d / 1.1
        if t > 37.25:
            break
        add(sfx, footstep("wet", 0.3), t, 1.0, 0.1); k += 1
    add(sfx, footstep("wet", 0.18), 37.55, 1.0, 0.1)
    cue(38.25, "THE REFLECTION'S EXTRA STEP")
    st = footstep("wet", 0.42); st = st + np.convolve(st, np.exp(-T(ns(0.4)) / 0.08) * np.sin(2 * np.pi * 2637 * T(ns(0.4))) * 0.02)[:len(st)]
    add(sfx, st, 38.25, 1.0, -0.2)
    add(sfx, whoosh(1.2, 0.06), 39.2)
    cue(42.0, "door slam"); add(sfx, door_slam(0.7), 41.98)
    cue(43.2, "chain lock")
    for i, t in enumerate([43.2, 43.28, 43.37, 43.45]):
        add(sfx, clink(2800 + 300 * i, 0.10), t, 1.0, -0.3)
    add(sfx, clink(1900, 0.2), 43.53, 1.0, -0.3)
    add(sfx, breath(0.9, 0.06, False), 44.4)
    cue(48.2, "phone buzz x2"); add(sfx, buzz(0.42, 0.22), 48.2, 1.0, 0.1); add(sfx, buzz(0.42, 0.22), 48.75, 1.0, 0.1)
    cue(49.5, "heartbeat (speeding up)")
    t, gap = 49.6, 0.95
    while t < 58.85:
        add(sfx, heartbeat((0.4 + 0.15 * (t - 49.6) / 9) * (0.6 if 53.6 < t < 58.7 else 1.0)), t)
        t += gap; gap = max(0.48, gap * 0.95)
    cue(54.7, "head turn: cloth + whoosh"); add(sfx, whoosh(1.4, 0.08), 54.7); add(sfx, breath(0.6, 0.06), 54.8)
    cue(57.07, "eyes open in the dark: click + low hit")
    add(sfx, clink(900, 0.15), 57.05); add(sfx, boom(1.5, 45, 28, 0.35), 57.07)
    add(sfx, whoosh(0.5, 0.06), 58.5)

    # reverb sends
    music = music + convolve_st(music.mean(0), rev_big) * 0.35
    sfx = sfx + convolve_st(sfx.mean(0), rev_room) * 0.25
    return music, sfx, amb


def duck_curve(words, depth_db=-7.0, pre=0.1, post=0.35):
    on = np.zeros(N)
    for w in words:
        on[ns(max(0, w["s"] - pre)):ns(min(DUR, w["e"] + post))] = 1
    sm = ndimage.uniform_filter1d(on, ns(0.15))
    return dbg(depth_db * sm)


def limiter(x, ceil_db=-1.2, look=0.003, rel=0.08):
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest")
    # release: smooth upward only
    g2 = np.minimum(g1, ndimage.uniform_filter1d(ndimage.minimum_filter1d(g1, ns(rel)), ns(rel)))
    g3 = np.minimum(ndimage.uniform_filter1d(g2, 2 * La + 1, mode="nearest"), 1.0)
    return x * g3[None, :]


def main():
    voice, sr = read_wav(os.path.join(ROOT, "voice", "voice.wav"))
    assert sr == SR and voice.shape[1] == N, (sr, voice.shape)
    words = json.load(open(os.path.join(ROOT, "src", "data", "words.json")))
    music, sfx, amb = build()
    # stem levels relative to the voice (-18 LUFS)
    music *= dbg(-27.0 - integrated(music))
    sfx *= dbg(-27.5 - integrated(sfx))
    amb *= dbg(-33.0 - integrated(amb))
    duck = duck_curve(words)
    music_d = music * duck[None, :]
    amb_d = amb * dbg(-3 * (1 - duck))[None, :] if False else amb
    mix = voice + music_d + sfx + amb_d
    g = dbg(-14.0 - integrated(mix))
    mix = limiter(mix * g, -1.2)
    mix = fades(mix, 0.0, 0.25)
    mix *= dbg(-14.0 - integrated(mix))
    mix = limiter(mix, -1.2)
    out = os.path.join(HERE, "mix.wav")
    write_wav(out, mix)
    for name, x in (("stem_voice", voice), ("stem_music", music_d), ("stem_sfx", sfx), ("stem_amb", amb_d)):
        write_wav(os.path.join(HERE, name + ".wav"), x * g)
    with open(os.path.join(HERE, "cues.md"), "w") as fh:
        fh.write("# Sound cues\n\n| time (s) | cue |\n|---|---|\n")
        for t, c in sorted(CUES):
            fh.write(f"| {t:6.2f} | {c} |\n")
        fh.write(f"\nmix: {integrated(mix):.1f} LUFS integrated, true peak {true_peak(mix):.1f} dBTP, {mix.shape[1] / SR:.3f} s\n")
    print(f"mix.wav {integrated(mix):.2f} LUFS, TP {true_peak(mix):.2f} dBTP, {mix.shape[1] / SR:.3f} s")


if __name__ == "__main__":
    main()
