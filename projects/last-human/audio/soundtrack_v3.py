"""Score, sound design and final mix for the v3 cut (62.5 s: 60 s film, black, a silent PART 2? card).

usage: python -I audio/soundtrack_v3.py   (reads voice/voice.wav, voice/shout.wav, src/data/words.json)
Writes audio/mix.wav (48 kHz stereo, 62.5 s, -14 LUFS integrated, true peak <= -1.2 dBTP), stems and audio/cues.md.

Every time below is a frame of src/story.ts divided by 30. The film is built in four sections so that its hard cuts
are true silences, reverb tails included:
  A 0.00-11.40   the street, Day 1, the shout and its echoes      -> everything stops at 11.40 (silence to 11.75)
  B 11.75-43.70  Day 2, the cameras, the reflection, the entity   -> cut dead by the door slam at 43.70
  C 43.70-52.10  home: the chain, the floor, the buzz, the photo  -> everything drops out at 52.10
  D 52.10-60.00  the bed, him, the devil                          -> all sound cuts at 60.00; silence after
Story rule 1 holds in sound too: no wind, no traffic, no ticking clocks. Only him, and "them".
"""
import json
import os
import sys

import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import soundtrack as S  # noqa: E402  (the instruments and effects of the first cut)
from dsp import (SR, bp, colored, convolve_st, dbg, fades, hp, integrated, lp, make_ir, ns, pan, rng,  # noqa: E402
                 smooth_noise, true_peak, read_wav, write_wav)

DUR = 62.5
N = ns(DUR)
R = rng(303)
CUES = []
F = lambda f: f / 30.0  # noqa: E731  frame -> seconds
T = S.T
m2f = S.m2f


def cue(t, name):
    CUES.append((t, name))


def add(buf, x, t, g=1.0, p=0.0, until=None, fade=0.012):
    """mix x (mono or stereo) into buf at t; optionally truncated at `until` with a short fade"""
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


def section():
    return {"music": np.zeros((2, N)), "sfx": np.zeros((2, N)), "amb": np.zeros((2, N))}


# ---------------------------------------------------------------- new sounds for v3
def rustle(dur, gain=1.0):
    """duvet / cloth: band-limited noise with a crackly amplitude"""
    n = ns(dur); t = T(n)
    z = colored(n, R, 0.4)
    y = bp(z, 350, 4200) * (0.55 + 0.45 * np.abs(smooth_noise(n, R, 18.0)))
    e = np.sin(np.pi * np.minimum(1, t / dur)) ** 0.8
    return y * e * gain


def palm_glass(gain=1.0):
    n = ns(0.9); t = T(n)
    thump = lp(colored(n, R, 1.2), 400) * np.exp(-t / 0.03) + np.sin(2 * np.pi * 95 * t) * np.exp(-t / 0.05) * 0.6
    ring = sum(np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, d in ((1210, 0.35), (2690, 0.18), (4410, 0.09))) * 0.08
    return fades((thump + ring) * gain, 0.001, 0.1)


def floor_buzz(dur=0.17, gain=1.0):
    """a phone vibrating against a wooden floor"""
    n = ns(dur); t = T(n)
    motor = S.buzz(dur, 1.0)
    rattle = bp(colored(n, R, 0.0), 200, 1800) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 155 * t))) * 0.6
    return fades((motor + rattle) * gain, 0.004, 0.01)


def pant(t0, t1, rate, gain, buf, p=0.0, until=None):
    """fast, shallow breathing: in / out alternately"""
    t, k = t0, 0
    while t < t1:
        add(buf, S.breath(0.5 / rate, gain * (1.0 if k % 2 == 0 else 0.75), rising=(k % 2 == 0)), t, 1.0, p, until)
        t += 0.5 / rate; k += 1


def thin_note(f, dur, gain=1.0):
    n = ns(dur); t = T(n)
    ph = 2 * np.pi * np.cumsum(f * (1 + 0.003 * np.sin(2 * np.pi * 4.6 * t))) / SR
    y = np.sin(ph) + 0.15 * np.sin(2 * ph)
    e = np.minimum(1, t / 0.6) * np.clip((dur - t) / (dur * 0.75), 0, 1) ** 1.5
    return y * e * gain


def glide_glass(dur, f0, f1, gain=1.0):
    """the thin high glass tone that rises while the reflection falls out of sync"""
    n = ns(dur); t = T(n)
    f = f0 * (f1 / f0) ** (t / dur)
    y = sum(np.sin(2 * np.pi * np.cumsum(f * r) / SR + R.uniform(0, 6)) * a for r, a in ((1, 1), (1.0037, 0.8), (1.498, 0.35)))
    e = np.minimum(1, t / 1.5)
    return y * e * gain / 2.2


def reverse_swell(dur, gain=1.0):
    """a reversed cymbal-like swell (noise + cluster), peaking at its end"""
    n = ns(dur); t = T(n)
    z = bp(colored(n, R, 0.3), 1500, 9000) * np.exp(-t / 0.5)
    c = S.cluster([466.2, 493.9, 523.3], dur, 0.01, dur * 0.9, 0.6, trem=7)[:n] * np.exp(-t / 0.7)
    return (z * 0.7 + c)[::-1] * gain


def servo_follow(gain=1.0):
    return S.servo(0.46, 175, 205, gain)


# ---------------------------------------------------------------- the film
def build():
    A, B, C, D = section(), section(), section(), section()
    big = make_ir(3.4, 5, hf=1.1, pre=0.02)
    room = make_ir(1.0, 3, hf=1.4)
    street = make_ir(1.6, 11, hf=1.2, pre=0.01)

    # ================= A: 0.00-11.40
    cue(0.0, "S01 night street: neon hum, low A drone")
    add(A["amb"], S.hum(4.8, 0.05), 0.0, 1.0, 0.2, until=4.8)
    add(A["music"], S.drone(55.0, 4.9, 0.35, 1.2, 0.4), 0.0, until=4.8)
    cue(F(12), "CCTV pans onto the empty spot (servo, mechanical stop)")
    add(A["sfx"], S.servo(1.1, 150, 215, 0.3), F(12), 1.0, 0.45)
    add(A["sfx"], S.clink(5600, 0.03), F(50), 1.0, 0.45)                 # the LED blinks once
    cue(2.3, "sub swell as he walks in; his wet footsteps")
    add(A["music"], S.drone(36.7, 2.6, 0.5, 1.6, 0.3), 2.3, until=4.8)
    for t, g in ((2.13, 0.16), (2.78, 0.26), (3.43, 0.3)):
        add(A["sfx"], S.footstep("wet", g), t, 1.0, -0.3)
    add(A["sfx"], S.footstep("dry", 0.08), 3.62, 1.0, -0.2)
    add(A["music"], S.piano(m2f(88), 0.28, 4.0, -18), 2.78, 1.0, 0.25, until=4.8)
    cue(4.8, "S02 Day 1: morning room tone, high air; a low felt note as his eyes open")
    add(A["amb"], np.stack([hp(lp(colored(ns(6.6), R, 1.0), 380), 40)] * 2) * 0.05, 4.8)
    add(A["amb"], thin_note(5300, 4.0, 0.010), 4.8, 1.0, 0.1)
    add(A["music"], S.pad([110, 164.8, 246.9, 261.6], 6.8, 2.0, 0.4, 650, 0.7), 4.8)
    add(A["music"], S.piano(m2f(57), 0.42, 4.5), F(184), 1.0, -0.1)
    add(A["sfx"], S.breath(0.35, 0.08), F(183))
    cue(F(219), "S03 he jolts upright: sharp inhale, duvet")
    add(A["sfx"], S.breath(0.4, 0.2), F(218)); add(A["sfx"], rustle(0.5, 0.16), F(219), 1.0, 0.1)
    cue(F(276), "S04 palm on the glass; the shout (voice) and its echoes")
    add(A["sfx"], palm_glass(0.22), F(276), 1.0, 0.2)
    shout, _ = read_wav(os.path.join(ROOT, "voice", "shout.wav"))
    seg = shout[:, ns(9.35):ns(9.35) + ns(1.0)]
    for t, g, lpf, p in ((10.40, -8.0, 3200, -0.55), (10.85, -13.0, 2100, 0.6), (11.25, -18.0, 1400, 0.0)):
        e = lp(seg.mean(0), lpf, 2)
        e = e + convolve_st(e, big).mean(0) * 0.8
        add(A["sfx"], e * dbg(g), t, 1.0, p)

    # ================= B: 11.75-43.70
    cue(11.75, "S05 after the silence: one low piano note under 'I haven't slept since.'")
    add(B["music"], S.piano(m2f(50), 0.5, 5.0), 11.75, 1.0, 0.0)
    add(B["music"], S.pad([73.4, 110, 174.6, 220], 2.4, 0.8, 1.0, 600, 0.6), 11.75)
    cue(13.4, "S06 Day 2 avenue: near silence, his steps; a low drone underneath")
    add(B["amb"], np.stack([hp(lp(colored(ns(6.3), R, 1.2), 260), 30)] * 2) * 0.035, 13.4)
    add(B["music"], S.drone(41.2, 6.4, 0.32, 1.5, 1.0), 13.4)
    for t in (13.8, 14.36, 14.92):
        add(B["sfx"], S.footstep("dry", 0.12), t, 1.0, -0.05)
    add(B["music"], S.piano(m2f(72), 0.22, 4.0, 12), 13.62, 1.0, 0.2)
    add(B["music"], S.piano(m2f(69), 0.2, 4.0, -10), 16.4, 1.0, -0.2)
    cue(16.0, "S07 fingers through the frozen steam: a faint glassy tone")
    add(B["sfx"], S.glass(1.6, 0.05), 15.95, 1.0, 0.1)
    cue(18.1, "S08 the red lamp hums; he walks under it")
    add(B["amb"], S.hum(1.6, 0.03), 18.1, 1.0, 0.3)
    for t in (18.2, 18.84, 19.47):
        add(B["sfx"], S.footstep("dry", 0.17), t, 1.0, 0.0)
    cue(19.7, "S09 Day 3 night: neon hum; servo on each follow; low pulse from 21.0")
    add(B["amb"], S.hum(5.1, 0.045), 19.7, 1.0, 0.2, until=24.8)
    for t in (20.25, 20.6, 22.75, 23.12):
        add(B["sfx"], S.footstep("wet", 0.2), t, 1.0, -0.1)
    add(B["sfx"], servo_follow(0.24), F(614), 1.0, 0.4)
    add(B["sfx"], servo_follow(0.24), F(689), 1.0, 0.4)
    beat = 1.0
    t = 21.0
    while t < 24.8:
        n = ns(0.32); tt = T(n)
        w = lp(np.sin(2 * np.pi * 55 * tt) + 0.4 * np.sin(2 * np.pi * 110 * tt), 300) * np.exp(-tt / 0.14)
        add(B["music"], w * 0.5, t, 1.0, 0.0, until=24.8)
        t += beat
    add(B["music"], S.cluster([932.3, 987.8, 1046.5], 3.0, 2.0, 0.2, 0.05), 21.8, until=24.8)
    cue(24.8, "S10 the pulse cuts out (0.3 s of nothing), then every camera turns: a wall of servos")
    for i in range(12):
        add(B["sfx"], S.servo(0.8 + R.uniform(0, 0.35), 140 + 9 * i, 205 + 8 * i, 0.11), F(753 + (i % 5) * 2) + R.uniform(0, 0.04), 1.0, R.uniform(-0.9, 0.9))
    add(B["music"], S.boom(2.4, 58, 32, 0.8), 25.1)
    add(B["music"], S.drone(55.0, 3.4, 0.4, 0.6, 0.8), 25.1)
    add(B["amb"], S.hum(3.5, 0.035), 25.1, 1.0, -0.2)
    cue(27.1, "S11 his face: breath only, heartbeat enters very low")
    add(B["sfx"], S.breath(0.7, 0.07), 27.25); add(B["sfx"], S.breath(0.8, 0.05, False), 27.95)
    for t in (27.5, 28.45, 29.4, 30.35):
        add(B["sfx"], S.heartbeat(0.22), t)
    cue(28.3, "S12 walking with the reflection: his steps and a glassy double")
    add(B["amb"], S.hum(2.9, 0.03), 28.3, 1.0, 0.3, until=31.2, fade=0.9)
    add(B["music"], S.drone(41.2, 3.0, 0.3, 0.8, 0.9), 28.3)
    for t in (28.3, 28.94, 29.57, 30.21, 30.75, 31.2):
        st = S.footstep("wet", 0.24)
        add(B["sfx"], st, t, 1.0, 0.15)
        add(B["sfx"], hp(st, 1800) * 0.5, t + 0.012, 1.0, -0.35)     # the reflection, a hair late, glassy
    cue(31.2, "S13 ambience gone; his breathing; a thin glass tone rising")
    add(B["music"], glide_glass(5.5, 1760, 1975, 0.05), 31.2, until=F(1101))
    for t in (31.9, 33.4, 34.9):
        add(B["sfx"], S.breath(0.9, 0.05), t); add(B["sfx"], S.breath(1.0, 0.035, False), t + 0.9)
    add(B["sfx"], rustle(0.6, 0.04), F(948), 1.0, -0.2)                # the hand comes up
    cue(F(1074), "S14 he steps back; it steps back")
    for t in (35.85, 36.2):
        st = S.footstep("wet", 0.2)
        add(B["sfx"], st, t, 1.0, 0.2); add(B["sfx"], hp(st, 1800) * 0.5, t + 0.012, 1.0, -0.3)
    cue(F(1112), "THE EXTRA STEP: the glass tone stops; one wet footstep is the only sound; dead silence")
    xs = S.footstep("wet", 0.42)
    xs = xs + convolve_st(xs, street).mean(0)[:len(xs)] * 0.2
    add(B["sfx"], xs, F(1114), 1.0, -0.25)
    cue(F(1186), "S15 its face goes black: sub drop, reversed swell into the eyes")
    add(B["music"], S.boom(3.0, 48, 26, 1.0), F(1186), until=43.7)
    add(B["music"], reverse_swell(F(1217) - F(1190), 0.5), F(1190), until=43.7)
    cue(F(1217), "the entity's eyes snap open: stinger")
    add(B["music"], S.stinger(0.9), F(1217), until=43.7)
    cue(F(1258), "the grin spreads: dissonant cluster")
    add(B["music"], S.cluster([466.2, 493.9, 523.3, 554.4], 3.0, 1.2, 0.4, 0.22, trem=9), F(1258), until=43.7)
    add(B["music"], S.drone(36.7, 3.4, 0.45, 1.0, 0.2), 40.3, until=43.7)

    # ================= C: 43.70-52.10
    cue(43.7, "S16 SLAM on the cut; the chain; he slides down the door")
    add(C["sfx"], S.door_slam(0.85), 43.69, 1.0, -0.1)
    add(C["amb"], np.stack([hp(lp(colored(ns(8.5), R, 1.0), 300), 40)] * 2) * 0.045, 43.7)
    add(C["sfx"], rustle(0.3, 0.06), F(1326), 1.0, -0.3)
    for i, t in enumerate(np.linspace(F(1332), F(1337), 6)):
        add(C["sfx"], S.clink(2600 + 260 * (i % 3), 0.09), t, 1.0, -0.35)
    add(C["sfx"], S.clink(1800, 0.2), F(1338), 1.0, -0.35)
    cue(F(1350), "he drops to the floor")
    add(C["sfx"], rustle(0.45, 0.1), F(1350), 1.0, -0.1)
    land = lp(colored(ns(0.4), R, 1.2), 250) * np.exp(-T(ns(0.4)) / 0.05) + np.sin(2 * np.pi * 70 * T(ns(0.4))) * np.exp(-T(ns(0.4)) / 0.08)
    add(C["sfx"], land * 0.4, F(1363))
    add(C["sfx"], S.breath(1.1, 0.07, False), F(1366))
    add(C["music"], S.drone(36.7, 8.4, 0.45, 1.0, 0.3), 43.7, until=52.1)
    add(C["music"], S.pad([73.4, 110, 174.6], 6.0, 1.5, 1.5, 480, 0.5, trem=0.3), 44.4, until=52.1)
    for t, m, v in ((44.9, 74, 0.2), (46.1, 69, 0.16)):
        add(C["music"], S.piano(m2f(m), v, 4.0, R.uniform(-20, 20)), t, 1.0, R.uniform(-0.2, 0.2), until=52.1)
    cue(F(1392), "S17 the phone buzzes against the floor, twice; his breath catches")
    add(C["sfx"], floor_buzz(F(1397) - F(1392), 0.3), F(1392), 1.0, 0.1)
    add(C["sfx"], floor_buzz(F(1409) - F(1404), 0.3), F(1404), 1.0, 0.1)
    add(C["sfx"], S.breath(0.3, 0.12), F(1393))
    cue(48.2, "S18 the photo: dread swell; heartbeat speeding up")
    add(C["music"], S.cluster([110, 116.5, 155.6, 164.8], 3.9, 1.2, 0.3, 0.32, trem=0.5), 48.2, until=52.1)
    add(C["music"], S.boom(2.5, 50, 28, 0.5), 48.3, until=52.1)
    t, gap = 48.6, 0.9
    while t < 52.1:
        add(C["sfx"], S.heartbeat(0.32 + 0.12 * (t - 48.6) / 3.5), t, until=52.1)
        t += gap; gap = max(0.55, gap * 0.94)

    # ================= D: 52.10-60.00
    cue(52.1, "S19 everything drops out but one thin held note, gone by 54.5")
    add(D["music"], thin_note(1318.5, 2.4, 0.05), 52.1, 1.0, 0.0)
    add(D["amb"], np.stack([hp(lp(colored(ns(7.9), R, 1.0), 300), 40)] * 2) * 0.03, 52.1)
    cue(54.5, "S20 slow breathing from the bed (not his), muffled by the duvet")
    t0 = 54.5
    for k in range(2):
        tb = t0 + k / 0.55
        add(D["sfx"], lp(S.breath(0.85, 0.07), 1400), tb, 1.0, 0.25); add(D["sfx"], lp(S.breath(0.95, 0.05, False), 1400), tb + 0.9, 1.0, 0.25)
    add(D["sfx"], rustle(0.3, 0.05), F(1662), 1.0, 0.25)
    cue(F(1670), "he jolts upright in the bed: gasp, duvet, a low hit")
    add(D["sfx"], S.breath(0.42, 0.24), F(1669), 1.0, 0.2)
    add(D["sfx"], rustle(0.55, 0.2), F(1670), 1.0, 0.2)
    add(D["music"], S.boom(1.6, 62, 30, 0.55), F(1670))
    pant(F(1680), F(1712), 1.5, 0.11, D["sfx"], 0.2)
    cue(F(1712), "he turns to the corner: a creeping low cluster, fast heartbeat underneath")
    add(D["music"], S.cluster([220, 233.1, 246.9], 2.4, 1.6, 0.1, 0.12, trem=5), F(1705), until=58.3)
    add(D["music"], S.drone(32.7, 2.6, 0.5, 1.8, 0.1), F(1705), until=58.3)
    t, gap = 56.4, 0.5
    while t < 58.3:
        add(D["sfx"], S.heartbeat(0.22), t, until=58.3)
        t += gap
    cue(58.3, "S21 the corner: sub pressure; eyes open (stinger), the grin rises; ALL SOUND CUTS at 60.00")
    add(D["music"], S.drone(30.9, 1.8, 0.6, 0.2, 0.05), 58.3)
    add(D["music"], S.stinger(1.3), F(1755))
    add(D["sfx"], S.clink(900, 0.15), F(1755))
    add(D["music"], S.riser(1.25, 300, 3200, 1.0), F(1764))
    add(D["music"], S.cluster([987.8, 1046.5, 1108.7, 1174.7], 1.3, 1.25, 0.01, 0.3, trem=11), F(1764))   # builds right up to the cut

    # reverb per section, then each section's own hard edge
    edges = {"A": (0.0, 11.40, 0.012), "B": (11.75, 43.70, 0.008), "C": (43.69, 52.10, 0.15), "D": (52.10, 60.00, 0.005)}
    out = {"music": np.zeros((2, N)), "sfx": np.zeros((2, N)), "amb": np.zeros((2, N))}
    for name, sec in zip("ABCD", (A, B, C, D)):
        s0, s1, fo = edges[name]
        mask = np.zeros(N); mask[ns(s0):ns(s1)] = 1
        nf = ns(fo); mask[ns(s1) - nf:ns(s1)] *= np.linspace(1, 0, nf)
        for k in out:
            x = sec[k]
            if k == "music":
                x = x + convolve_st(x.mean(0), big) * 0.32
            elif k == "sfx":
                x = x + convolve_st(x.mean(0), room) * 0.2
            out[k] += x * mask[None, :]
    return out["music"], out["sfx"], out["amb"]


def duck_curve(words, depth_db=-7.0, pre=0.1, post=0.35):
    on = np.zeros(N)
    for w in words:
        on[ns(max(0, w["s"] - pre)):ns(min(DUR, w["e"] + post))] = 1
    return dbg(depth_db * ndimage.uniform_filter1d(on, ns(0.15)))


def main():
    voice, sr = read_wav(os.path.join(ROOT, "voice", "voice.wav"))
    assert sr == SR, sr
    voice = np.pad(voice, ((0, 0), (0, max(0, N - voice.shape[1]))))[:, :N]
    words = json.load(open(os.path.join(ROOT, "src", "data", "words.json")))
    music, sfx, amb = build()
    music *= dbg(-26.5 - integrated(music))
    sfx *= dbg(-26.0 - integrated(sfx))
    amb *= dbg(-34.0 - integrated(amb))
    music_d = music * duck_curve(words)[None, :]
    mix = voice + music_d + sfx + amb
    # the two silences that belong to the story: after the echoes, and from the cut to black onward
    gate = np.ones(N)
    gate[ns(11.40):ns(11.75)] = 0
    gate[ns(60.0):] = 0
    mix *= gate[None, :]
    g = dbg(-14.0 - integrated(mix))
    mix = S.limiter(mix * g, -1.2)
    mix *= dbg(-14.0 - integrated(mix))
    mix = S.limiter(mix, -1.2) * gate[None, :]
    write_wav(os.path.join(HERE, "mix.wav"), mix)
    for name, x in (("stem_voice", voice), ("stem_music", music_d), ("stem_sfx", sfx), ("stem_amb", amb)):
        write_wav(os.path.join(HERE, name + ".wav"), x * g * gate[None, :])
    with open(os.path.join(HERE, "cues.md"), "w") as fh:
        fh.write("# Sound cues (v3)\n\n| time (s) | cue |\n|---|---|\n")
        for t, c in sorted(CUES):
            fh.write(f"| {t:6.2f} | {c} |\n")
        fh.write(f"\nmix: {integrated(mix):.1f} LUFS integrated, true peak {true_peak(mix):.1f} dBTP, {mix.shape[1] / SR:.3f} s\n")
    print(f"mix.wav {integrated(mix):.2f} LUFS, TP {true_peak(mix):.2f} dBTP, {mix.shape[1] / SR:.3f} s")


if __name__ == "__main__":
    main()
