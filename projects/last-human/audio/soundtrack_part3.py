"""Score, sound design and mix for PART 3 (122 s): "It has your face."

usage: python -I audio/soundtrack_part3.py   (reads voice/voice_part3.wav, src/data/words_part3.json)
Writes audio/mix_part3.wav (48 kHz stereo, -14 LUFS integrated, true peak <= -1.2 dBTP) and audio/cues_part3.md.

An action short: every cut has its own hard-edged sound, three places get real silence (the far figure, the platform,
the empty seat), and the score is pulses and risers under the chase, clusters on the scares.
"""
import json
import os
import sys

import numpy as np
from scipy import ndimage, signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import soundtrack as S  # noqa: E402
import soundtrack_v3 as V  # noqa: E402
import soundtrack_final as F2  # noqa: E402
import soundtrack_part2 as P2  # noqa: E402
from dsp import (SR, bp, colored, convolve_st, dbg, fades, hp, integrated, lp, make_ir, ns, pan, rng,  # noqa: E402
                 smooth_noise, true_peak, read_wav, write_wav)

ROWS = [("T01", 90), ("T02", 180), ("T03", 120), ("T04", 210), ("T05", 210), ("T06", 120), ("T07", 150), ("T08", 180),
        ("T09", 120), ("T10A", 120), ("T10B", 120), ("T10C", 120), ("T11", 210), ("T12", 210), ("T13", 180), ("T14", 150),
        ("T15", 150), ("T16A", 120), ("T16B", 120), ("T17", 360), ("T19", 180), ("T20A", 45), ("T20B", 105), ("END3", 90)]
START = {}
_t = 0
for _id, _n in ROWS:
    START[_id] = _t; _t += _n
TOTAL = _t
assert TOTAL == 3660, TOTAL
DUR = TOTAL / 30
N = ns(DUR)
R = V.R = rng(3303)
CUES = []


def ft(row, f):
    return (START[row] + f) / 30.0


def st(row):
    return START[row] / 30.0


def en(row):
    return (START[row] + dict(ROWS)[row]) / 30.0


def cue(t, name):
    CUES.append((t, name))


def add(buf, x, t, g=1.0, p=0.0, until=None, fade=0.006):
    if x.ndim == 1:
        x = pan(x, p)
    x = x * g
    if until is not None:
        keep = ns(until - t)
        if keep <= 0:
            return
        if keep < x.shape[1]:
            x = x[:, :keep].copy()
            nf = min(ns(fade), keep)
            x[:, keep - nf:] *= np.linspace(1, 0, nf)[None, :]
    k = ns(t)
    if k < 0:
        x = x[:, -k:]; k = 0
    n = min(x.shape[1], N - k)
    if n > 0:
        buf[:, k:k + n] += x[:, :n]


V.add = add
T = V.T


# ---------------------------------------------------------------- new sounds
def door_crash(g=1.0):
    """a door flung open into the wall: the slam, the handle's rattle, one bounce"""
    y = S.door_slam(1.0)
    n = ns(0.6); t = T(n)
    rattle = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, d in ((1450, 0.08), (2310, 0.05), (3640, 0.03))) * 0.25
    out = np.zeros(ns(1.4)); out[:len(y)] += y; k = ns(0.02); out[k:k + n] += rattle
    b = S.door_slam(0.35); k = ns(0.32); out[k:k + len(b)] += b[:len(out) - k]
    return out * g


def glass_shatter(g=1.0):
    n = ns(1.2); t = T(n)
    burst = hp(colored(n, R, 0.0), 2500) * np.exp(-t / 0.05)
    pings = np.zeros(n)
    for _ in range(60):
        at = R.uniform(0, 0.7) ** 1.6; f = R.uniform(2800, 9500); d = R.uniform(0.02, 0.12)
        k = ns(at); m = n - k; tt = T(m)
        pings[k:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt / d) * R.uniform(0.1, 0.5)
    body = lp(colored(n, R, 1.0), 600) * np.exp(-t / 0.08) * 0.6
    return fades((burst + pings * 0.6 + body) * g, 0.0005, 0.1)


def clang(f0=420, g=1.0, d=0.35):
    n = ns(d * 3); t = T(n)
    y = sum(np.sin(2 * np.pi * f0 * r * t + R.uniform(0, 6)) * np.exp(-t / (d / r ** 0.5)) * a for r, a in ((1, 1), (2.76, 0.6), (5.4, 0.35), (8.9, 0.2)))
    y += hp(colored(n, R, 0.0), 1500) * np.exp(-t / 0.01) * 0.6
    return fades(y * g, 0.0005, 0.05)


def scrape(dur, g=1.0):
    n = ns(dur); t = T(n)
    z = colored(n, R, 0.2)
    fc = 1800 + 900 * smooth_noise(n, R, 6.0)
    y = np.zeros(n); seg = ns(0.02)
    for i in range(0, n, seg):
        c = max(400, fc[i]); y[i:i + seg] = bp(z[max(0, i - 900):i + seg], c * 0.7, c * 1.4)[-len(z[i:i + seg]):]
    return fades(y * np.sin(np.pi * np.minimum(1, t / dur)) ** 0.5 * g, 0.01, 0.05)


def crunch(g=1.0):
    """the pipe into the camera: a hard hit, plastic and glass cracking, an electric spit"""
    n = ns(0.9); t = T(n)
    thud = lp(colored(n, R, 1.0), 500) * np.exp(-t / 0.03) + np.sin(2 * np.pi * 90 * t) * np.exp(-t / 0.05)
    crack = hp(colored(n, R, 0.0), 1800) * np.exp(-t / 0.02) * 1.2
    out = thud + crack
    for x in (clang(980, 0.5, 0.12), glass_shatter(0.4)):
        m = min(n, len(x)); out[:m] += x[:m]
    z = zap(0.5, 0.6); k = ns(0.03); out[k:k + len(z)] += z[:n - k]
    return out * g


def zap(dur=0.4, g=1.0):
    """an electric arc: a buzz chopped by random gating, with crackle"""
    n = ns(dur); t = T(n)
    buzz = signal.square(2 * np.pi * 120 * t) * 0.5 + signal.sawtooth(2 * np.pi * 240 * t) * 0.3
    gate = (smooth_noise(n, R, 80.0) > -0.1).astype(float)
    cr = (R.uniform(size=n) > 0.995) * R.standard_normal(n) * 2.0
    y = bp(buzz * gate, 150, 6000) + hp(cr, 2000)
    return fades(y * np.exp(-t / (dur * 0.6)) * g, 0.002, 0.05)


def crackle(dur, g=1.0):
    n = ns(dur); t = T(n)
    imp = (R.uniform(size=n) > 0.997) * R.standard_normal(n)
    y = hp(np.convolve(imp, np.exp(-np.arange(200) / 30.0), mode="same"), 1800)
    return y * np.exp(-t / (dur * 0.5)) * g


def pneumatic(g=1.0):
    n = ns(0.9); t = T(n)
    hiss = bp(colored(n, R, 0.3), 1500, 7000) * np.exp(-t / 0.25)
    clunk = lp(colored(ns(0.3), R, 1.0), 300) * np.exp(-T(ns(0.3)) / 0.04) + np.sin(2 * np.pi * 80 * T(ns(0.3))) * np.exp(-T(ns(0.3)) / 0.06)
    out = hiss * 0.5; k = ns(0.22); out[k:k + len(clunk)] += clunk * 1.2
    return out * g


def motor(dur, f0=60, f1=420, g=1.0, k0=0.0):
    n = ns(dur); t = T(n)
    f = f0 + (f1 - f0) * np.clip((t - k0) / max(0.01, dur - k0), 0, 1) ** 1.5
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * 0.6 + np.sin(2 * ph) * 0.3 + np.sin(3.01 * ph) * 0.15
    return y * np.minimum(1, t / 0.8) * g


def rumble(dur, g=1.0):
    n = ns(dur)
    return lp(colored(n, R, 1.6), 180) * g


def clatter(t0, t1, buf, speed, g=1.0):
    """wheel joints: clack-clack pairs; speed(t) = metres per second; joints every 13 m"""
    t = t0
    while t < t1:
        v = max(0.5, speed(t))
        for dt in (0.0, 2.6 / v):
            c = clang(R.uniform(160, 220), 0.35, 0.06)
            add(buf, lp(c, 2500), t + dt, g, R.uniform(-0.3, 0.3), until=t1)
        t += 13.0 / v


def steps(t0, t1, rate, kind, g, buf, p=0.0, until=None):
    t = t0
    while t < t1:
        add(buf, S.footstep(kind, g * R.uniform(0.85, 1.1)), t + R.uniform(-0.01, 0.01), 1.0, p, until)
        t += 1.0 / rate


def creak_wave(dur, g=1.0):
    """hundreds of joints cracking at once: a wave of tiny creaks"""
    n = ns(dur); y = np.zeros(n)
    for _ in range(140):
        k = ns(R.uniform(0, dur * 0.8)); c = F2.creak(R.uniform(0.08, 0.2), R.uniform(0.2, 0.6))
        y[k:k + len(c)] += c[:n - k]
    return y * g


# ---------------------------------------------------------------- the film
def build():
    sfx, music, amb = (np.zeros((2, N)) for _ in range(3))
    room = make_ir(0.8, 3, hf=1.4)
    street = make_ir(1.6, 11, hf=1.2, pre=0.01)
    tunnel = make_ir(3.2, 17, hf=1.0, pre=0.03)
    sub = np.zeros((2, N))   # everything underground goes through the tunnel reverb

    # ---- T01: the door
    cue(0.0, "T01 the door flies open: crash, a deep hit, a dissonant sting; the hallway tube buzzing")
    add(sfx, door_crash(1.0), 0.0, 1.0, -0.1)
    add(music, S.boom(2.8, 52, 24, 1.0), 0.0)
    add(music, S.stinger(0.5), 0.02)
    add(amb, S.hum(3.0, 0.08), 0.0, 1.0, 0.0, until=en("T03"))
    add(music, S.cluster([466.2, 493.9, 523.3, 554.4], 3.0, 0.05, 0.8, 0.12, trem=9), 0.1, until=st("T02"))

    # ---- T02: scrambling back; it steps in, in jerks
    cue(st("T02"), "T02 you scramble back (hands, sneakers, panting); its steps arrive all at once, each with a digital tick")
    for t in np.arange(st("T02") + 0.1, en("T02") - 0.4, 0.29):
        add(sfx, V.rustle(0.18, 0.12), t, 1.0, R.uniform(-0.2, 0.2))
        add(sfx, lp(S.footstep("dry", 0.12), 2500), t + 0.12, 1.0, 0.1)
    V.pant(st("T02"), en("T03"), 2.4, 0.09, sfx, 0.0)
    for k in range(0, 180, 5):
        t = ft("T02", k)
        if k % 15 == 0:
            add(sfx, lp(S.footstep("dry", 0.3), 900), t, 1.0, -0.15)
        add(sfx, P2.glitch(0.03, 0.06), t, 1.0, -0.2)
    add(sfx, P2.glitch(0.2, 0.3), ft("T02", 118), 1.0, -0.2)
    add(music, S.drone(36.7, en("T03") - st("T02"), 0.45, 1.5, 0.2), st("T02"), until=en("T03"))
    add(music, S.cluster([220, 233.1, 246.9], en("T03") - st("T02"), 2.5, 0.1, 0.1, trem=6), st("T02"), until=en("T03"))

    # ---- T03: the hand; RUN
    cue(ft("T03", 46), "T03 its hand comes in: everything drops to his breathing and one high tone")
    add(music, V.thin_note(2637.0, 1.4, 0.03), ft("T03", 46), 1.0, 0.2, until=ft("T03", 86))
    cue(ft("T03", 86), "RUN! (voice) on a hit and a whoosh")
    add(music, S.boom(1.6, 64, 30, 0.8), ft("T03", 86))
    add(sfx, S.whoosh(0.5, 0.5), ft("T03", 84), 1.0, -0.4)

    # ---- T04: the window, the fire escape
    cue(st("T04"), "T04 glass bursts; the night outside (wind-less city hum); landing on iron grating; down the iron stairs")
    add(sfx, glass_shatter(0.9), st("T04"), 1.0, 0.1)
    add(amb, np.stack([hp(lp(colored(ns(7.2), R, 1.2), 800), 60)] * 2) * 0.05, st("T04"), 1.0, 0.0, until=en("T04"))
    add(sfx, clang(380, 0.6, 0.3), ft("T04", 9), 1.0, 0.1)
    for t in np.arange(ft("T04", 30), ft("T04", 76), 0.17):
        add(sfx, clang(R.uniform(300, 460), 0.32, 0.18), t, 1.0, 0.25 + R.uniform(-0.1, 0.1))
    add(music, S.riser(ft("T04", 76) - st("T04"), 200, 1200, 0.4), st("T04"), until=ft("T04", 76))
    cue(ft("T04", 96), "it at the window: silence, then its head tilts (a slow creak), then it is out on the wall, upside down")
    add(sfx, F2.creak(0.7, 0.12), ft("T04", 104), 1.0, -0.3)
    for k in range(128, 210, 5):
        add(sfx, P2.glitch(0.03, 0.05), ft("T04", k), 1.0, -0.4)
        if k % 10 == 0:
            add(sfx, lp(scrape(0.12, 0.2), 3000), ft("T04", k), 1.0, -0.4)
    add(music, S.drone(30.9, 3.4, 0.5, 0.5, 0.3), ft("T04", 108), until=en("T04"))

    # ---- T05: the street; every camera wakes up
    cue(st("T05"), "T05 the street: neon hum, his running feet, a pulse; on 'wakes up' a wall of servos and LED beeps")
    add(amb, S.hum(en("T07") - st("T05"), 0.06), st("T05"), 1.0, 0.25, until=en("T07"))
    steps(st("T05"), ft("T05", 168), 3.2, "wet", 0.28, sfx, -0.05)
    t = st("T05")
    while t < ft("T05", 76):
        n = ns(0.3); tt = T(n)
        add(music, lp(np.sin(2 * np.pi * 55 * tt) + 0.4 * np.sin(2 * np.pi * 110 * tt), 300) * np.exp(-tt / 0.12) * 0.6, t, until=ft("T05", 76))
        t += 0.5
    for i in range(22):
        add(sfx, S.servo(0.55 + R.uniform(0, 0.3), 150 + 6 * i, 215 + 5 * i, 0.12), ft("T05", 76) + R.uniform(0, 0.06), 1.0, R.uniform(-0.9, 0.9))
    for i in range(10):
        add(sfx, P2.beep(R.choice([1760, 2093, 2349]), 0.05, 0.06), ft("T05", 82) + i * 0.03 + R.uniform(0, 0.02), 1.0, R.uniform(-0.8, 0.8))
    add(music, S.boom(2.2, 58, 30, 0.9), ft("T05", 76))
    add(music, S.drone(55.0, en("T05") - ft("T05", 76), 0.45, 0.3, 0.3), ft("T05", 76), until=en("T05"))

    # ---- T06: it's already there (near silence)
    cue(st("T06"), "T06 it is already there: the street sound drops away to a high whine and his breathing")
    add(music, V.thin_note(3135.9, 4.0, 0.025), st("T06"), 1.0, 0.0, until=en("T06"))
    add(music, S.drone(32.7, 4.0, 0.4, 0.4, 0.4), st("T06"), until=en("T06"))
    V.pant(st("T06"), en("T06"), 1.6, 0.06, sfx, 0.0)

    # ---- T07: the other way; it's there too
    cue(st("T07"), "T07 whip-pan whoosh, running, and a sting when it is there too")
    add(sfx, S.whoosh(0.5, 0.45), ft("T07", 6), 1.0, 0.3)
    steps(ft("T07", 12), ft("T07", 52), 3.4, "wet", 0.3, sfx, 0.0)
    add(sfx, S.footstep("wet", 0.45), ft("T07", 52), 1.0, 0.0)
    add(music, S.stinger(0.55), ft("T07", 45))
    add(music, S.boom(1.8, 60, 28, 0.7), ft("T07", 45))
    add(sfx, P2.glitch(0.12, 0.25), ft("T07", 44), 1.0, 0.3)

    # ---- T08 + T09: the feeds
    cue(st("T08"), "T08 the camera's own audio: hiss, hum; his steps pass; it glitches into the picture")
    add(amb, P2.feed_hiss(en("T09") - st("T08") + 0.05), st("T08"), 0.9, 0.0, until=en("T09"))
    steps(ft("T08", 10), ft("T08", 130), 3.3, "wet", 0.16, sfx, 0.0)
    add(sfx, P2.glitch(0.27, 0.5), ft("T08", 86))
    add(music, S.cluster([110, 116.5, 164.8], 3.5, 0.2, 1.0, 0.14, trem=1.0), ft("T08", 90), until=en("T08"))
    cue(ft("T09", 34), "T09 he drags a pipe up (scrape), swings (whoosh); the camera dies: crunch, glass, an electric spit, then static")
    add(sfx, scrape(0.8, 0.25), ft("T09", 34), 1.0, 0.1)
    add(sfx, S.whoosh(0.35, 0.6), ft("T09", 70), 1.0, 0.0)
    add(sfx, crunch(1.0), ft("T09", 78), 1.0, 0.0)
    add(amb, S.static(en("T09") - ft("T09", 80), 0.25), ft("T09", 80), 1.0, 0.0, until=en("T09"))

    # ---- T10A: sparks, the cable, the grid dying pair by pair
    cue(st("T10A"), "T10A sparks crackling; the conduit ripped off the wall (metal shriek); six zaps going up the facade")
    add(amb, S.hum(en("T10C") - st("T10A"), 0.045), st("T10A"), 1.0, 0.25, until=en("T10C"))
    add(sfx, crackle(1.4, 0.5), st("T10A"), 1.0, 0.4)
    add(sfx, zap(0.6, 0.5), st("T10A") + 0.05, 1.0, 0.4)
    add(sfx, scrape(0.5, 0.5), ft("T10A", 38), 1.0, 0.3)
    add(sfx, clang(260, 0.5, 0.25), ft("T10A", 50), 1.0, 0.3)
    for i in range(6):
        t0 = ft("T10A", 52 + i * 8)
        add(sfx, zap(0.35, 0.45), t0, 1.0, 0.35 - i * 0.02)
        add(sfx, crackle(0.6, 0.35), t0, 1.0, 0.35)
    add(music, S.riser(en("T10A") - st("T10A"), 220, 1800, 0.45), st("T10A"), until=en("T10A"))
    for t in np.arange(st("T10A"), en("T10C"), 0.5):
        n = ns(0.25); tt = T(n)
        add(music, lp(np.sin(2 * np.pi * 49 * tt), 200) * np.exp(-tt / 0.1) * 0.5, t, until=en("T10C"))

    # ---- T10B: run north; the cameras swing; it is under them
    cue(st("T10B"), "T10B running; the crossing's cameras swing (servos); it glitches in under them; he skids")
    steps(st("T10B"), ft("T10B", 64), 3.3, "wet", 0.28, sfx, 0.0)
    for i in range(6):
        add(sfx, S.servo(0.5, 160, 220, 0.12), ft("T10B", 40) + i * 0.03, 1.0, R.uniform(-0.6, 0.2))
    add(sfx, P2.glitch(0.25, 0.4), ft("T10B", 54), 1.0, -0.4)
    add(music, S.stinger(0.45), ft("T10B", 54))
    add(sfx, scrape(0.25, 0.2), ft("T10B", 64), 1.0, 0.0)

    # ---- T10C: to the subway
    cue(st("T10C"), "T10C running for the subway sign (its buzz), down into the dark")
    steps(st("T10C"), ft("T10C", 72), 3.3, "wet", 0.26, sfx, -0.2)
    add(sfx, S.hum(2.5, 0.05), ft("T10C", 40), 1.0, -0.5, until=en("T10C"))
    steps(ft("T10C", 72), en("T10C"), 4.0, "dry", 0.2, sfx, -0.3)

    # ---- underground (through the tunnel reverb)
    cue(st("T11"), "T11 the stairs down: echoing steps, a deep empty room tone, a drip")
    add(amb, np.stack([lp(colored(ns(en("T16A") - st("T11")), R, 1.6), 160)] * 2) * 0.08, st("T11"), 1.0, 0.0, until=en("T16A"))
    steps(st("T11"), ft("T11", 150), 3.6, "dry", 0.3, sub, 0.0)
    add(sub, P2.beep(1900, 0.03, 0.04), ft("T11", 170), 1.0, 0.5)
    add(music, S.drone(41.2, en("T12") - st("T11"), 0.35, 1.5, 0.5), st("T11"), until=en("T12"))
    cue(st("T12"), "T12 the platform: silence; a torch click; breathing; drips")
    add(sfx, P2.relay(0.25), ft("T12", 4), 1.0, -0.1)
    for t in (st("T12") + 1.0, st("T12") + 3.4, st("T12") + 5.9):
        add(sfx, S.breath(0.8, 0.07), t); add(sfx, S.breath(0.9, 0.05, False), t + 0.9)
    for t in (st("T12") + 2.2, st("T12") + 5.0):
        add(sub, P2.beep(R.uniform(1500, 2100), 0.025, 0.05), t, 1.0, R.uniform(-0.6, 0.6))
    cue(ft("T13", 2), "T13 the phone buzzes twice in his hand; a heartbeat; a dread swell")
    add(sfx, S.buzz(0.23, 0.35), ft("T13", 2), 1.0, 0.0)
    add(sfx, S.buzz(0.23, 0.35), ft("T13", 14), 1.0, 0.0)
    t = ft("T13", 20)
    while t < en("T14"):
        add(sfx, S.heartbeat(0.22), t, until=en("T14")); t += 0.8
    add(music, S.cluster([110, 116.5, 155.6, 164.8], en("T13") - st("T13"), 1.4, 0.2, 0.28, trem=0.5), st("T13") + 0.3, until=en("T13"))
    cue(st("T14"), "T14 the spin (whoosh), nothing; then a slow riser as he lifts the light to the tunnel")
    add(sfx, S.whoosh(0.45, 0.4), st("T14"), 1.0, 0.0)
    add(music, S.riser(en("T14") - ft("T14", 90), 120, 1400, 0.6), ft("T14", 90), until=en("T14"))
    cue(ft("T15", 12), "T15 THE TUNNEL: their eyes open: the biggest hit of the film; a low choir of breath; the lean: a wave of creaks")
    add(music, S.boom(3.5, 46, 20, 1.2), ft("T15", 12))
    add(music, S.stinger(0.7), ft("T15", 12))
    add(music, S.cluster([233.1, 246.9, 261.6, 277.2, 293.7], en("T15") - ft("T15", 12), 0.1, 0.3, 0.3, trem=7), ft("T15", 12), until=en("T15"))
    for k in range(12):
        add(sub, F2.low_breath(R.uniform(1.4, 2.2), 0.04, k % 2 == 0), ft("T15", 14) + R.uniform(0, 3.0), 1.0, R.uniform(-0.8, 0.8))
    add(sub, creak_wave(1.5, 0.35), ft("T15", 96), 1.0, 0.0)
    cue(st("T16A"), "T16A RUN!: sprinting steps echoing; behind him a rumble of many feet stepping together; the dive")
    add(music, S.boom(1.5, 64, 30, 0.9), st("T16A") + 0.1)
    steps(st("T16A"), ft("T16A", 50), 3.6, "dry", 0.32, sub, 0.0)
    for k in range(6):
        t0 = st("T16A") + k * 0.6
        for _ in range(16):
            add(sub, lp(S.footstep("dry", 0.08), 700), t0 + R.uniform(0, 0.05), 1.0, R.uniform(-0.9, -0.2))
    add(sfx, lp(colored(ns(0.3), R, 1.0), 400) * np.exp(-T(ns(0.3)) / 0.05) * 0.8, ft("T16A", 60), 1.0, 0.0)
    add(music, S.riser(en("T16A") - st("T16A"), 300, 2400, 0.6), st("T16A"), until=en("T16A"))
    cue(ft("T16A", 62), "the dead lights stutter on: a zap and a buzz on every flash, and each time they are closer (a surge of feet)")
    for k in (62, 74, 86, 96, 104, 112, 116):
        add(sfx, zap(0.12, 0.35), ft("T16A", k), 1.0, 0.3)
        add(sub, P2.relay(0.3), ft("T16A", k), 1.0, 0.3)
        for _ in range(10):
            add(sub, lp(S.footstep("dry", 0.1), 700), ft("T16A", k) + R.uniform(0, 0.08), 1.0, R.uniform(-0.6, 0.3))

    # ---- in the train
    cue(st("T16B"), "T16B the doors slam (hiss, clunk); muffled silence inside; its face at the door glass (a slap, a sting)")
    add(sfx, pneumatic(0.9), ft("T16B", 7), 1.0, 0.3)
    add(amb, np.stack([lp(colored(ns(en("T20B") - st("T16B")), R, 1.6), 120)] * 2) * 0.05, st("T16B"), 1.0, 0.0, until=en("T20B"))
    V.pant(st("T16B") + 0.4, en("T16B"), 1.6, 0.08, sfx, 0.0)
    add(sfx, V.palm_glass(0.5), ft("T16B", 58), 1.0, 0.4)
    add(music, S.stinger(0.5), ft("T16B", 58))
    add(music, S.drone(30.9, 4.0, 0.5, 0.3, 0.3), st("T16B"), until=en("T16B"))
    cue(ft("T17", 50), "T17 the train lurches (brakes release, clunk), the motor whines up, the wheels start to clatter; a tick as the clock flips")
    add(sfx, pneumatic(0.6), ft("T17", 46), 1.0, 0.0)
    add(sfx, S.door_slam(0.4), ft("T17", 50), 1.0, 0.0)
    add(sfx, motor(en("T17") - ft("T17", 50), 40, 380, 0.12), ft("T17", 50), 1.0, 0.0, until=en("T17"))
    add(amb, rumble(en("T17") - ft("T17", 50), 0.25), ft("T17", 50), 1.0, 0.0, until=en("T17"))
    clatter(ft("T17", 60), en("T17"), sfx, lambda t: 2.4 * (t - ft("T17", 50)) + 0.5, 0.5)
    add(sfx, S.clink(4200, 0.08), ft("T17", 82), 1.0, 0.3)
    add(music, S.cluster([987.8, 1046.5, 1108.7], en("T17") - ft("T17", 140), 2.0, 0.3, 0.1, trem=9), ft("T17", 140), until=en("T17"))
    t = ft("T17", 190)
    while t < en("T17"):
        add(sfx, S.whoosh(0.3, 0.12), t + R.uniform(0, 0.05), 1.0, 0.6)
        v = 2.4 * (t - ft("T17", 50)); t += 2.6 / max(4.0, v)
    cue(st("T19"), "T19 slumped on the seat: steady muffled rumble and clatter; when the other one appears, a slow breath close in the right ear")
    add(amb, rumble(en("T20B") - st("T19"), 0.22), st("T19"), 1.0, 0.0, until=en("T20B"))
    clatter(st("T19"), en("T20B"), sfx, lambda t: 11.0, 0.35)
    add(sfx, F2.low_breath(1.8, 0.1, True), ft("T19", 42), 1.0, 0.7)
    add(sfx, F2.low_breath(2.0, 0.08, False), ft("T19", 100), 1.0, 0.7)
    add(music, S.drone(32.7, en("T20B") - st("T19"), 0.45, 1.0, 0.2), st("T19"), until=en("T20B"))
    cue(st("T20B"), "T20B back to the glass: a cluster and riser to the hard cut, then silence")
    add(music, S.riser(en("T20B") - st("T20B"), 200, 3600, 1.0), st("T20B"), until=en("T20B"))
    add(music, S.cluster([987.8, 1046.5, 1108.7, 1174.7], en("T20B") - st("T20B"), 2.0, 0.01, 0.3, trem=11), st("T20B"), until=en("T20B"))
    cue(ft("END3", 10), "END: silence, then one low hit as PART 4 appears")
    add(music, S.boom(2.6, 44, 24, 0.6), ft("END3", 10))

    sub_wet = sub + convolve_st(sub.mean(0), tunnel) * 0.55
    sfx = sfx + sub_wet + convolve_st(sfx.mean(0), room) * 0.15
    music = music + convolve_st(music.mean(0), street) * 0.25
    gate = np.ones(N); gate[ns(st("END3")):ns(ft("END3", 10))] = 0
    return music * gate[None, :], sfx * gate[None, :], amb * gate[None, :]


def duck_curve(words, depth_db=-8.0, pre=0.1, post=0.35):
    on = np.zeros(N)
    for w in words:
        on[ns(max(0, w["s"] - pre)):ns(min(DUR, w["e"] + post))] = 1
    return dbg(depth_db * ndimage.uniform_filter1d(on, ns(0.15)))


def main():
    voice, sr = read_wav(os.path.join(ROOT, "voice", "voice_part3.wav"))
    assert sr == SR, sr
    voice = np.pad(voice, ((0, 0), (0, max(0, N - voice.shape[1]))))[:, :N]
    words = json.load(open(os.path.join(ROOT, "src", "data", "words_part3.json")))
    music, sfx, amb = build()
    music *= dbg(-23.0 - integrated(music))
    sfx *= dbg(-22.0 - integrated(sfx))
    amb *= dbg(-30.0 - integrated(amb))
    mix = voice * dbg(1.0) + music * duck_curve(words)[None, :] + sfx * duck_curve(words, -4.0)[None, :] + amb
    for _ in range(4):
        mix = S.limiter(mix * dbg(-14.0 - integrated(mix)), -1.2)
    write_wav(os.path.join(HERE, "mix_part3.wav"), mix)
    with open(os.path.join(HERE, "cues_part3.md"), "w") as fh:
        fh.write("# Sound cues (Part 3)\n\n| time (s) | cue |\n|---|---|\n")
        for t, c in sorted(CUES):
            fh.write(f"| {t:6.2f} | {c} |\n")
        fh.write(f"\nmix: {integrated(mix):.1f} LUFS integrated, true peak {true_peak(mix):.1f} dBTP, {mix.shape[1] / SR:.3f} s\n")
    print(f"mix_part3.wav {integrated(mix):.2f} LUFS, TP {true_peak(mix):.2f} dBTP, {mix.shape[1] / SR:.3f} s")


if __name__ == "__main__":
    main()
