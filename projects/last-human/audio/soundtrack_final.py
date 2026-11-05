"""Score, sound design and final mix for THE FINAL CUT (107.77 s).

usage: python -I audio/soundtrack_final.py   (reads voice/voice_final.wav, voice/shout_final.wav, src/data/words_final.json)
Writes audio/mix_final.wav (48 kHz stereo, -14 LUFS integrated, true peak <= -1.2 dBTP) and audio/cues_final.md.

The edit is the FINAL table of src/story.ts: each row shows a source shot from a source frame. ft(row, f) turns a
source frame into seconds of the final film, so every sync point (a step, a servo, a slam) stays locked to the picture.
Sections, each with its own hard edge (reverb tails included):
  A  0.00- 9.30  you wake; the window; the shout and its echoes     -> silence 9.30-9.90
  B  9.90-17.95  "Nothing." ... the camera turns to the lens; the title boom
  C 17.97-35.37  Day 1-2: the phone at 06:12, the frozen world
  D 35.37-70.97  Day 3: the cameras, the reflection, the entity     -> cut dead by the door slam
  E 70.97-84.77  home: the chain, the buzz, the photo                -> everything drops out
  F 84.77-103.37 the bed; the empty corner; it watches; its eyes     -> all sound cuts on the black
  G in the black: one camera servo turning somewhere; the end title
No wind, no traffic, no ticking clocks. Only him, and "them".
"""
import json
import os
import sys

import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import soundtrack as S  # noqa: E402
import soundtrack_v3 as V  # noqa: E402  (rustle, palm_glass, floor_buzz, thin_note, glide_glass, reverse_swell, servo_follow)
from dsp import (SR, bp, colored, convolve_st, dbg, fades, hp, integrated, lp, make_ir, ns, pan, rng,  # noqa: E402
                 smooth_noise, true_peak, read_wav, write_wav)

# ---------------------------------------------------------------- the edit (mirrors FINAL in src/story.ts)
ROWS = [("S02", 56, 160), ("S03", 51, 216), ("S04", 172, 170), ("S05", 148, 342), ("CAM", 52, 0), ("TITLE1", 60, 0),
        ("P1", 132, 0), ("S06", 84, 380), ("PIGEON", 96, 464), ("S07", 108, 450), ("S08", 102, 546),
        ("S01", 249, -105), ("S09", 153, 591), ("S10", 108, 705), ("S11", 36, 813), ("S12", 129, 789),
        ("S13", 72, 918), ("S13B", 72, 990), ("S14", 90, 1062), ("S15", 159, 1152), ("S16", 66, 1311),
        ("S17", 168, 1269), ("S18", 180, 1437), ("S19", 153, 1482), ("S20", 90, 1635), ("E1", 72, 0), ("E2", 90, 0),
        ("E3", 72, 0), ("S21", 81, 1725), ("BLACK", 42, 0), ("TITLE2", 90, 0)]
START, FROM = {}, {}
_t = 0
for _id, _n, _fr in ROWS:
    START[_id] = _t; FROM[_id] = _fr; _t += _n
TOTAL = _t
assert TOTAL == 3233, TOTAL
DUR = TOTAL / 30
N = ns(DUR)
R = V.R = rng(909)


def ft(row, f):
    """source frame f of a row -> seconds in the final film"""
    return (START[row] + f - FROM[row]) / 30.0


def st(row):
    return START[row] / 30.0


CUES = []


def cue(t, name):
    CUES.append((t, name))


def add(buf, x, t, g=1.0, p=0.0, until=None, fade=0.012):
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


V.add = add  # V.pant mixes through add


def section():
    return {"music": np.zeros((2, N)), "sfx": np.zeros((2, N)), "amb": np.zeros((2, N))}


def room_tone(dur, cut=380, g=0.05):
    return np.stack([hp(lp(colored(ns(dur), R, 1.0), cut), 40)] * 2) * g


def heel_strikes(phase, f0, f1):
    """source frames where a walk cycle's phase crosses a heel strike (every half cycle)"""
    out, prev = [], np.floor(phase(f0) * 2)
    for f in np.arange(f0 + 0.25, f1, 0.25):
        k = np.floor(phase(f) * 2)
        if k != prev:
            out.append(f); prev = k
    return out


STRIDE = 1.4


def creak(dur=0.9, gain=1.0):
    """a single floorboard taking weight, slowly: a low, pitched, uneven rasp"""
    n = ns(dur); t = V.T(n)
    f = 95 + 40 * np.sin(np.pi * t / dur) + 8 * smooth_noise(n, R, 9.0)
    saw = np.sin(2 * np.pi * np.cumsum(f) / SR)
    grit = (np.abs(smooth_noise(n, R, 60.0)) > 0.55).astype(float)
    y = bp(saw * (0.4 + grit) + colored(n, R, 0.6) * 0.15, 120, 1600)
    e = np.sin(np.pi * np.minimum(1, t / dur)) ** 1.5
    return y * e * gain


def low_breath(dur, gain=1.0, rising=True):
    """something large breathing slowly: a breath, dark and slowed"""
    x = S.breath(dur, 1.0, rising)
    y = lp(x, 520, 2) + lp(colored(len(x), R, 1.6), 140) * np.abs(x).max() * 0.6 * np.sin(np.pi * np.linspace(0, 1, len(x)))
    return y * gain


# ---------------------------------------------------------------- the film
def build():
    A, B, C, D, E, Fs, G = (section() for _ in range(7))
    big = make_ir(3.4, 5, hf=1.1, pre=0.02)
    room = make_ir(1.0, 3, hf=1.4)
    street = make_ir(1.6, 11, hf=1.2, pre=0.01)

    # ================= A: 0.00-9.30  wake, window, shout
    cue(0.0, "HOOK: on the first frame a low hit and a felt note (we wake with him); morning room tone, high air")
    add(A["music"], S.boom(2.2, 58, 30, 0.45), 0.0)
    add(A["amb"], room_tone(9.4), 0.0)
    add(A["amb"], V.thin_note(5300, 6.0, 0.010), 0.0, 1.0, 0.1)
    add(A["music"], S.pad([110, 164.8, 246.9, 261.6], 9.6, 1.2, 0.4, 650, 0.7), 0.0)
    add(A["music"], S.piano(S.m2f(57), 0.42, 4.5), ft("S02", 184), 1.0, -0.1)
    add(A["sfx"], S.breath(0.35, 0.08), ft("S02", 183))
    cue(ft("S03", 219), "S03 he jolts upright: sharp inhale, duvet, a low hit")
    add(A["sfx"], S.breath(0.4, 0.2), ft("S03", 218)); add(A["sfx"], V.rustle(0.5, 0.16), ft("S03", 219), 1.0, 0.1)
    add(A["music"], S.boom(1.6, 62, 30, 0.35), ft("S03", 219))
    cue(st("S04"), "S04 the window, the empty city: a wide low drone opens up under 'No people. No cars moving.'")
    add(A["music"], S.drone(41.2, 6.0, 0.4, 2.0, 0.4), st("S04"))
    add(A["music"], S.cluster([329.6, 349.2, 493.9], 3.4, 2.4, 0.3, 0.06, trem=0.4), st("S04") + 0.6)
    for t, m in ((3.86, 64), (4.82, 62), (6.02, 57)):
        add(A["music"], S.piano(S.m2f(m), 0.22, 3.0, R.uniform(-10, 10)), t, 1.0, R.uniform(-0.2, 0.2))   # "No..." x3, descending
    cue(ft("S04", 276), "palm on the glass; the shout (voice) and its echoes off the empty city")
    add(A["sfx"], V.palm_glass(0.22), ft("S04", 276), 1.0, 0.2)
    shout, _ = read_wav(os.path.join(ROOT, "voice", "shout_final.wav"))
    seg = shout[:, ns(7.25):ns(7.25) + ns(1.0)]
    for t, g, lpf, p in ((8.30, -8.0, 3200, -0.55), (8.75, -13.0, 2100, 0.6), (9.15, -18.0, 1400, 0.0)):
        e = lp(seg.mean(0), lpf, 2)
        e = e + convolve_st(e, big).mean(0) * 0.8
        add(A["sfx"], e * dbg(g), t, 1.0, p)

    # ================= B: 9.90-17.95  "Nothing." -> the camera turns -> title
    cue(9.95, "after the silence: one low piano note under 'Nothing.' and 'You're the last person alive.'")
    add(B["music"], S.piano(S.m2f(50), 0.5, 5.0), 9.95, 1.0, 0.0)
    add(B["music"], S.pad([73.4, 110, 174.6, 220], 4.4, 0.8, 1.0, 600, 0.6), 9.95, until=st("CAM"))
    add(B["amb"], room_tone(4.3, 300, 0.035), 9.95, until=st("CAM"))
    cue(13.5, "'Or at least...': a low dissonance creeps in")
    add(B["music"], S.cluster([110, 116.5, 164.8], 2.4, 1.6, 0.2, 0.12, trem=0.6), 13.4, until=st("CAM"))
    cue(st("CAM"), "CUT to night: neon hum; the laundry camera turns until it stares down the lens (servo, stop, LED)")
    add(B["amb"], S.hum(1.75, 0.06), st("CAM"), 1.0, 0.2, until=st("TITLE1"))
    add(B["sfx"], S.servo(1.0, 150, 215, 0.34), ft("CAM", 3), 1.0, 0.15)
    add(B["sfx"], S.clink(5600, 0.035), ft("CAM", 36), 1.0, 0.15)
    add(B["music"], V.reverse_swell(st("TITLE1") - ft("CAM", 20), 0.5), ft("CAM", 20))
    cue(st("TITLE1"), "TITLE: a deep boom and a sting, decaying under the title")
    add(B["music"], S.boom(3.2, 48, 24, 1.0), st("TITLE1"))
    add(B["music"], S.stinger(0.42), st("TITLE1"))
    add(B["music"], S.drone(30.9, 2.0, 0.5, 0.05, 1.6), st("TITLE1"))

    # ================= C: 17.97-35.37  Day 1-2, the frozen world
    cue(st("P1"), "P1 Day 1 sunrise: room tone; the phone at 06:12; a quiet felt motif, no clock ticks")
    add(C["amb"], room_tone(4.4, 380, 0.045), st("P1"))
    add(C["music"], S.pad([73.4, 110, 146.8, 220], 4.6, 1.2, 1.2, 600, 0.55), st("P1"))
    for t, m in ((st("P1") + 0.3, 69), (st("P1") + 1.5, 64), (st("P1") + 2.9, 62)):
        add(C["music"], S.piano(S.m2f(m), 0.2, 4.0, R.uniform(-12, 12)), t, 1.0, R.uniform(-0.25, 0.25))
    cue(st("S06"), "S06 Day 2 avenue: near silence, his steps; a low drone")
    add(C["amb"], room_tone(13.0, 260, 0.035), st("S06"))
    add(C["music"], S.drone(41.2, 13.0, 0.3, 1.5, 1.5), st("S06"))
    ph06 = lambda f: (3.0 + (f - 402) / 30 * 1.25) / STRIDE  # noqa: E731
    for f in heel_strikes(ph06, 380, 464):
        add(C["sfx"], S.footstep("dry", 0.12), ft("S06", f), 1.0, -0.05)
    add(C["music"], S.piano(S.m2f(72), 0.2, 4.0, 12), st("S06") + 0.3, 1.0, 0.2)
    cue(st("PIGEON"), "PIGEON: no wings, no air. One high glass tone, held, as if the world is holding its breath")
    add(C["music"], V.thin_note(1975.5, 3.4, 0.03), st("PIGEON"), 1.0, 0.15)
    add(C["sfx"], S.glass(2.6, 0.035), st("PIGEON") + 0.25, 1.0, 0.2)
    add(C["music"], S.piano(S.m2f(69), 0.2, 4.0, -10), st("PIGEON") + 1.9, 1.0, -0.2)
    cue(st("S07"), "S07 his fingers through the frozen steam: a faint glassy tone")
    add(C["sfx"], S.glass(1.6, 0.05), ft("S07", 478), 1.0, 0.1)
    add(C["music"], S.piano(S.m2f(64), 0.18, 4.0, 5), st("S07") + 0.4, 1.0, 0.15)
    cue(st("S08"), "S08 the red lamp hums; he walks under it")
    add(C["amb"], S.hum(3.4, 0.03), st("S08"), 1.0, 0.3)
    ph08 = lambda f: ((f - 546) / 30 * 1.1) / STRIDE  # noqa: E731
    for f in heel_strikes(ph08, 546, 648):
        add(C["sfx"], S.footstep("dry", 0.17), ft("S08", f), 1.0, 0.0)
    cue(34.3, "'...everything stopped.': a low hit on 'stopped'")
    add(C["music"], S.boom(1.4, 52, 30, 0.35), 34.42)

    # ================= D: 35.37-70.97  Day 3 night
    cue(st("S01"), "S01 Day 3 night, the crane down to the street: neon hum, low A drone")
    add(D["amb"], S.hum(st("S09") - st("S01"), 0.05), st("S01"), 1.0, 0.2)
    add(D["music"], S.drone(55.0, st("S09") - st("S01") + 0.4, 0.33, 1.6, 0.4), st("S01"))
    cue(ft("S01", 12), "the laundry camera pans onto the empty spot (servo, mechanical stop), LED blinks")
    add(D["sfx"], S.servo(1.1, 150, 215, 0.3), ft("S01", 12), 1.0, 0.45)
    add(D["sfx"], S.clink(5600, 0.03), ft("S01", 50), 1.0, 0.45)
    cue(ft("S01", 69), "sub swell as he walks in; his wet footsteps (off screen first)")
    add(D["music"], S.drone(36.7, 2.8, 0.5, 1.6, 0.3), ft("S01", 69))
    ph01 = lambda f: -(1.15 * (103 - f) / 30) / 1.5  # noqa: E731
    for i, f in enumerate(heel_strikes(ph01, 40, 107)):
        add(D["sfx"], S.footstep("wet", min(0.3, 0.1 + 0.04 * i)), ft("S01", f), 1.0, -0.3)
    add(D["sfx"], S.footstep("dry", 0.08), ft("S01", 108), 1.0, -0.2)
    add(D["music"], S.piano(S.m2f(88), 0.28, 4.0, -18), ft("S01", 83), 1.0, 0.25)
    cue(st("S09"), "S09 the test: a step, the servo follows; low pulse building")
    add(D["amb"], S.hum(st("S10") - st("S09") + 1.3, 0.045), st("S09"), 1.0, 0.2)
    for f in (606, 620, 681, 697):
        add(D["sfx"], S.footstep("wet", 0.2), ft("S09", f), 1.0, -0.1)
    add(D["sfx"], V.servo_follow(0.24), ft("S09", 614), 1.0, 0.4)
    add(D["sfx"], V.servo_follow(0.24), ft("S09", 689), 1.0, 0.4)
    stop = ft("S10", 744)
    t = ft("S09", 630)
    while t < stop:
        n = ns(0.32); tt = V.T(n)
        w = lp(np.sin(2 * np.pi * 55 * tt) + 0.4 * np.sin(2 * np.pi * 110 * tt), 300) * np.exp(-tt / 0.14)
        add(D["music"], w * 0.5, t, 1.0, 0.0, until=stop)
        t += 1.0
    add(D["music"], S.cluster([932.3, 987.8, 1046.5], stop - ft("S09", 654), 2.0, 0.2, 0.05), ft("S09", 654), until=stop)
    cue(stop, "S10 the pulse cuts out (0.3 s of nothing), then every camera turns: a wall of servos")
    for i in range(12):
        add(D["sfx"], S.servo(0.8 + R.uniform(0, 0.35), 140 + 9 * i, 205 + 8 * i, 0.11), ft("S10", 753 + (i % 5) * 2) + R.uniform(0, 0.04), 1.0, R.uniform(-0.9, 0.9))
    add(D["music"], S.boom(2.4, 58, 32, 0.8), ft("S10", 753))
    add(D["music"], S.drone(55.0, 3.4, 0.4, 0.6, 0.8), ft("S10", 753))
    add(D["amb"], S.hum(3.0, 0.035), ft("S10", 753), 1.0, -0.2)
    cue(st("S11"), "S11 his face: breath only, a heartbeat enters very low")
    add(D["sfx"], S.breath(0.7, 0.07), st("S11") + 0.12); add(D["sfx"], S.breath(0.8, 0.05, False), st("S11") + 0.82)
    for t in np.arange(st("S11") + 0.35, st("S13"), 0.95):
        add(D["sfx"], S.heartbeat(0.22), t)
    cue(st("S12"), "S12 walking with the reflection: his steps and a glassy double")
    add(D["amb"], S.hum(st("S13") - st("S12"), 0.03), st("S12"), 1.0, 0.3, until=st("S13"), fade=0.9)
    add(D["music"], S.drone(41.2, st("S13") - st("S12") + 0.2, 0.3, 0.8, 0.9), st("S12"))
    ph12 = lambda f: ((f - 849) / 30 * 1.1) / STRIDE  # noqa: E731
    for f in heel_strikes(ph12, 789, 918):
        s_ = S.footstep("wet", 0.24)
        add(D["sfx"], s_, ft("S12", f), 1.0, 0.15)
        add(D["sfx"], hp(s_, 1800) * 0.5, ft("S12", f) + 0.012, 1.0, -0.35)
    cue(st("S13"), "S13 ambience gone; his breathing; a thin glass tone rising")
    add(D["music"], V.glide_glass(ft("S14", 1101) - st("S13"), 1760, 1975, 0.05), st("S13"), until=ft("S14", 1101))
    for t in (st("S13") + 0.7, st("S13") + 2.2, st("S13") + 3.7):
        add(D["sfx"], S.breath(0.9, 0.05), t); add(D["sfx"], S.breath(1.0, 0.035, False), t + 0.9)
    add(D["sfx"], V.rustle(0.6, 0.04), ft("S13", 948), 1.0, -0.2)
    cue(st("S14"), "S14 he steps back; it steps back")
    for f in (1075.5, 1086):
        s_ = S.footstep("wet", 0.2)
        add(D["sfx"], s_, ft("S14", f), 1.0, 0.2); add(D["sfx"], hp(s_, 1800) * 0.5, ft("S14", f) + 0.012, 1.0, -0.3)
    cue(ft("S14", 1112), "THE EXTRA STEP: the glass tone stops; one wet footstep is the only sound; dead silence")
    xs = S.footstep("wet", 0.42)
    xs = xs + convolve_st(xs, street).mean(0)[:len(xs)] * 0.2
    add(D["sfx"], xs, ft("S14", 1114), 1.0, -0.25)
    end = st("S16")
    cue(ft("S15", 1186), "S15 its face goes black: sub drop, reversed swell into the eyes")
    add(D["music"], S.boom(3.0, 48, 26, 1.0), ft("S15", 1186), until=end)
    add(D["music"], V.reverse_swell((1217 - 1190) / 30, 0.5), ft("S15", 1190), until=end)
    cue(ft("S15", 1216), "the entity's eyes open: a held, quieter sting (no jump)")
    add(D["music"], S.stinger(0.5), ft("S15", 1217), until=end)
    add(D["music"], S.drone(30.9, 2.2, 0.5, 0.3, 0.8), ft("S15", 1216), until=end)
    cue(ft("S15", 1258), "the grin spreads: dissonant cluster")
    add(D["music"], S.cluster([466.2, 493.9, 523.3, 554.4], 3.0, 1.2, 0.4, 0.22, trem=9), ft("S15", 1258), until=end)
    add(D["music"], S.drone(36.7, 3.4, 0.45, 1.0, 0.2), ft("S15", 1209), until=end)

    # ================= E: 70.97-84.77  home
    cue(st("S16"), "S16 SLAM on the cut; the chain; he slides down the door")
    add(E["sfx"], S.door_slam(0.85), st("S16") - 0.01, 1.0, -0.1)
    add(E["amb"], room_tone(14.0, 300, 0.045), st("S16"))
    add(E["sfx"], V.rustle(0.3, 0.06), ft("S16", 1326), 1.0, -0.3)
    for i, t in enumerate(np.linspace(ft("S16", 1332), ft("S16", 1337), 6)):
        add(E["sfx"], S.clink(2600 + 260 * (i % 3), 0.09), t, 1.0, -0.35)
    add(E["sfx"], S.clink(1800, 0.2), ft("S16", 1338), 1.0, -0.35)
    add(E["sfx"], V.rustle(0.45, 0.1), ft("S16", 1350), 1.0, -0.1)
    land = lp(colored(ns(0.4), R, 1.2), 250) * np.exp(-V.T(ns(0.4)) / 0.05) + np.sin(2 * np.pi * 70 * V.T(ns(0.4))) * np.exp(-V.T(ns(0.4)) / 0.08)
    add(E["sfx"], land * 0.4, ft("S16", 1363))
    add(E["sfx"], S.breath(1.1, 0.07, False), ft("S16", 1366))
    eE = st("S19")
    add(E["music"], S.drone(36.7, eE - st("S16"), 0.45, 1.0, 0.3), st("S16"), until=eE)
    add(E["music"], S.pad([73.4, 110, 174.6], 7.0, 1.5, 1.5, 480, 0.5, trem=0.3), st("S16") + 0.7, until=eE)
    for t, m, v in ((st("S16") + 1.2, 74, 0.2), (st("S17") + 0.5, 69, 0.16), (st("S17") + 2.6, 66, 0.14)):
        add(E["music"], S.piano(S.m2f(m), v, 4.0, R.uniform(-20, 20)), t, 1.0, R.uniform(-0.2, 0.2), until=eE)
    for t in (st("S17") + 0.4, st("S17") + 2.4):
        add(E["sfx"], S.breath(1.0, 0.04), t); add(E["sfx"], S.breath(1.1, 0.03, False), t + 1.0)
    cue(ft("S17", 1392), "S17 the phone buzzes against the floor, twice; his breath catches")
    add(E["sfx"], V.floor_buzz((1397 - 1392) / 30, 0.3), ft("S17", 1392), 1.0, 0.1)
    add(E["sfx"], V.floor_buzz((1409 - 1404) / 30, 0.3), ft("S17", 1404), 1.0, 0.1)
    add(E["sfx"], S.breath(0.3, 0.12), ft("S17", 1393))
    cue(st("S18") + 0.3, "S18 the photo: dread swell; heartbeat speeding up")
    add(E["music"], S.cluster([110, 116.5, 155.6, 164.8], eE - st("S18"), 1.6, 0.3, 0.32, trem=0.5), st("S18") + 0.3, until=eE)
    add(E["music"], S.boom(2.5, 50, 28, 0.5), st("S18") + 0.4, until=eE)
    t, gap = st("S18") + 0.7, 0.95
    while t < eE:
        add(E["sfx"], S.heartbeat(0.3 + 0.14 * (t - st("S18")) / 6.0), t, until=eE)
        t += gap; gap = max(0.55, gap * 0.95)

    # ================= F: 84.77-103.37  the bed, the corner, it
    cue(st("S19"), "S19 everything drops out but one thin held note")
    add(Fs["music"], V.thin_note(1318.5, 3.0, 0.05), st("S19"), 1.0, 0.0)
    add(Fs["amb"], room_tone(st("S21") - st("S19") + 2.7, 300, 0.03), st("S19"))
    cue(87.6, "'So who's sleeping in your bed?': slow breathing from the bed (not his), muffled; his head turns")
    for k in range(2):
        tb = 87.4 + k * 1.75
        add(Fs["sfx"], lp(S.breath(0.85, 0.06), 1400), tb, 1.0, 0.25); add(Fs["sfx"], lp(S.breath(0.95, 0.045, False), 1400), tb + 0.9, 1.0, 0.25)
    add(Fs["music"], S.drone(32.7, 3.0, 0.4, 1.8, 0.4), 87.9)
    add(Fs["sfx"], V.rustle(0.3, 0.05), ft("S20", 1657), 1.0, 0.25)
    cue(ft("S20", 1665), "S20 he jolts upright in the bed: gasp, duvet, a low hit")
    add(Fs["sfx"], S.breath(0.42, 0.24), ft("S20", 1664), 1.0, 0.2)
    add(Fs["sfx"], V.rustle(0.55, 0.2), ft("S20", 1665), 1.0, 0.2)
    add(Fs["music"], S.boom(1.6, 62, 30, 0.5), ft("S20", 1665))
    V.pant(ft("S20", 1673), ft("S20", 1695), 1.5, 0.11, Fs["sfx"], 0.2)
    eS20 = st("E1")
    cue(ft("S20", 1695), "he holds his breath and turns to the corner: a creeping low cluster, fast heartbeat underneath")
    add(Fs["music"], S.cluster([220, 233.1, 246.9], 1.9, 1.3, 0.1, 0.12, trem=5), ft("S20", 1694), until=eS20)
    add(Fs["music"], S.drone(32.7, 2.0, 0.5, 1.4, 0.1), ft("S20", 1694), until=eS20)
    t = ft("S20", 1686)
    while t < eS20:
        add(Fs["sfx"], S.heartbeat(0.2), t, until=eS20); t += 0.5
    cue(st("E1"), "E1 the empty corner: the heartbeat stops on the cut. Room tone, sub pressure. Nothing.")
    add(Fs["music"], S.drone(30.9, st("S21") - st("E1") + 0.2, 0.42, 1.2, 0.1), st("E1"), until=st("S21"))
    cue(st("E1") + 1.15, "one floorboard, somewhere near the corner, takes weight. Very quiet.")
    add(Fs["sfx"], creak(1.1, 0.05), st("E1") + 1.15, 1.0, -0.45)
    cue(st("E2"), "E2 you, by the door: your breath, trembling, then you stop breathing; a slow heartbeat")
    add(Fs["sfx"], S.breath(0.5, 0.07), st("E2") + 0.05, 1.0, 0.0)
    add(Fs["sfx"], S.breath(0.45, 0.05, False), st("E2") + 0.6, 1.0, 0.0)
    for t in np.arange(st("E2") + 0.4, st("E3"), 1.05):
        add(Fs["sfx"], S.heartbeat(0.14), t, until=st("E3"))
    add(Fs["music"], V.thin_note(1046.5, 3.0, 0.02), st("E2") + 0.8, 1.0, 0.0, until=st("E3"))
    cue(st("E3"), "E3 its point of view: we hear IT breathe, slow and close, in time with the sway")
    add(Fs["sfx"], low_breath(1.6, 0.11, True), st("E3") + 0.05, 1.0, -0.15)
    add(Fs["sfx"], low_breath(1.9, 0.09, False), st("E3") + 1.75, 1.0, -0.15, until=st("S21"))
    add(Fs["music"], S.cluster([61.7, 65.4, 69.3], 2.6, 1.6, 0.2, 0.18, trem=0.2), st("E3"), until=st("S21"))
    cue(st("S21"), "S21 the corner: near silence, sub pressure, his breath trembling")
    add(Fs["music"], S.drone(30.9, 2.8, 0.55, 0.6, 0.05), st("S21"))
    for k, f in enumerate((1729, 1741)):
        add(Fs["sfx"], lp(S.breath(0.6, 0.05, rising=(k == 0)), 2200), ft("S21", f), 1.0, 0.35)
    cue(ft("S21", 1750), "its eyes open, slowly: a soft swell and a thin high tone (no hit)")
    add(Fs["music"], V.reverse_swell(0.35, 0.35), ft("S21", 1750) - 0.35)
    add(Fs["music"], V.thin_note(2093.0, 1.9, 0.035), ft("S21", 1750), 1.0, 0.0)
    add(Fs["music"], S.boom(2.0, 44, 26, 0.35), ft("S21", 1752))
    cue(ft("S21", 1766), "the grin spreads; it leans in: riser and cluster build right up to the hard cut")
    add(Fs["music"], S.riser(1.35, 300, 3200, 1.0), ft("S21", 1766))
    add(Fs["music"], S.cluster([987.8, 1046.5, 1108.7, 1174.7], 1.35, 1.3, 0.01, 0.3, trem=11), ft("S21", 1766))

    # ================= G: the black and the title
    cue(st("BLACK") + 0.5, "black: one CCTV servo whirr and its stop, quiet, off to the side")
    add(G["sfx"], S.servo(0.75, 160, 205, 0.1), st("BLACK") + 0.5, 1.0, 0.55)
    cue(st("TITLE2"), "end title: a very low tone fades up with it and away")
    add(G["music"], S.drone(41.2, 3.0, 0.16, 1.2, 1.2), st("TITLE2"))
    add(G["music"], V.thin_note(1318.5, 2.8, 0.012), st("TITLE2") + 0.3, 1.0, 0.0)

    edges = {"A": (0.0, 9.30, 0.012), "B": (9.90, 17.95, 0.2), "C": (17.967, st("S01"), 0.03),
             "D": (st("S01"), st("S16"), 0.008), "E": (st("S16") - 0.01, st("S19"), 0.15),
             "F": (st("S19"), st("BLACK"), 0.005), "G": (st("BLACK") + 0.4, DUR, 0.3)}
    out = {"music": np.zeros((2, N)), "sfx": np.zeros((2, N)), "amb": np.zeros((2, N))}
    for name, sec in zip("ABCDEFG", (A, B, C, D, E, Fs, G)):
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
    voice, sr = read_wav(os.path.join(ROOT, "voice", "voice_final.wav"))
    assert sr == SR, sr
    voice = np.pad(voice, ((0, 0), (0, max(0, N - voice.shape[1]))))[:, :N]
    words = json.load(open(os.path.join(ROOT, "src", "data", "words_final.json")))
    music, sfx, amb = build()
    music *= dbg(-26.5 - integrated(music))
    sfx *= dbg(-26.0 - integrated(sfx))
    amb *= dbg(-34.0 - integrated(amb))
    music_d = music * duck_curve(words)[None, :]
    mix = voice + music_d + sfx + amb
    # the silences that belong to the story: after the echoes, and from the cut to black
    gate = np.ones(N)
    gate[ns(9.30):ns(9.90)] = 0
    gate[ns(st("BLACK")):ns(st("BLACK") + 0.4)] = 0
    g = dbg(-14.0 - integrated(mix))
    mix = S.limiter(mix * g, -1.2)
    mix *= dbg(-14.0 - integrated(mix))
    mix = S.limiter(mix, -1.2) * gate[None, :]
    write_wav(os.path.join(HERE, "mix_final.wav"), mix)
    with open(os.path.join(HERE, "cues_final.md"), "w") as fh:
        fh.write("# Sound cues (final cut)\n\n| time (s) | cue |\n|---|---|\n")
        for t, c in sorted(CUES):
            fh.write(f"| {t:6.2f} | {c} |\n")
        fh.write(f"\nmix: {integrated(mix):.1f} LUFS integrated, true peak {true_peak(mix):.1f} dBTP, {mix.shape[1] / SR:.3f} s\n")
    print(f"mix_final.wav {integrated(mix):.2f} LUFS, TP {true_peak(mix):.2f} dBTP, {mix.shape[1] / SR:.3f} s")


if __name__ == "__main__":
    main()
