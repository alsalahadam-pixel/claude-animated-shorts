"""Score, sound design and mix for PART 2 (46.0 s TikTok loop): "There are no cameras in your room."

usage: python -I audio/soundtrack_part2.py   (reads voice/voice_part2.wav, src/data/words_part2.json)
Writes audio/mix_part2.wav (48 kHz stereo, -14 LUFS integrated, true peak <= -1.2 dBTP) and audio/cues_part2.md.

Two worlds, cut hard against each other:
  the FEED   (the camera nobody installed): a baby-monitor hiss, mains hum, digital tears on every glitch
  the ROOM   (you, by the door): almost nothing. Breath, heartbeat, a low drone that keeps rising.
The film is a loop: it ends on the feed and begins on the feed, so the hiss runs straight through the seam, and the
REC beep on frame 0 doubles as the restart.
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
import soundtrack_final as F2  # noqa: E402  (the floorboard creak of Part 1)
from dsp import (SR, bp, colored, convolve_st, dbg, fades, hp, integrated, lp, make_ir, ns, pan, rng,  # noqa: E402
                 smooth_noise, true_peak, read_wav, write_wav)

ROWS = [("BED", 84), ("FACE", 102), ("SITUP", 132), ("EMPTY", 72), ("STAND", 108), ("CORNER", 96), ("GRIN", 162),
        ("BEHIND", 114), ("FREEZE", 90), ("MSG", 150), ("CHAIN", 135), ("TURN", 45), ("END", 90)]
START = {}
_t = 0
for _id, _n in ROWS:
    START[_id] = _t; _t += _n
TOTAL = _t
assert TOTAL == 1380, TOTAL
DUR = TOTAL / 30
N = ns(DUR)
R = V.R = rng(2024)
FEED = {"BED", "SITUP", "STAND", "GRIN", "BEHIND", "END"}


def ft(row, f):
    """local frame f of a row -> seconds"""
    return (START[row] + f) / 30.0


def st(row):
    return START[row] / 30.0


def en(row):
    return (START[row] + dict(ROWS)[row]) / 30.0


CUES = []


def cue(t, name):
    CUES.append((t, name))


def add(buf, x, t, g=1.0, p=0.0, until=None, fade=0.008):
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


# ---------------------------------------------------------------- new sounds
def feed_hiss(dur):
    """the feed's own audio: band-limited hiss, a mains hum, a few crackles (a cheap camera's microphone)"""
    n = ns(dur); t = V.T(n)
    z = bp(colored(n, R, 0.2), 900, 7000) * (0.85 + 0.15 * smooth_noise(n, R, 3.0))
    hum = sum(np.sin(2 * np.pi * 50 * k * t) / k ** 1.3 for k in (1, 2, 3, 4, 6)) * 0.35
    crack = np.zeros(n)
    for _ in range(int(dur * 5)):
        k = R.integers(0, max(1, n - 400)); crack[k:k + 200] += R.standard_normal(200) * R.uniform(0.3, 1.0)
    return z * 0.5 + bp(hum, 45, 900) + hp(crack, 2500) * 0.25


def glitch(dur=0.25, gain=1.0):
    """a digital tear: stepped square tones and crushed noise, chopped"""
    n = ns(dur); t = V.T(n)
    seg = ns(0.022)
    y = np.zeros(n)
    for i in range(0, n, seg):
        f = R.choice([180, 320, 640, 1250, 2400, 90])
        m = min(seg, n - i)
        tt = np.arange(m) / SR
        y[i:i + m] = signal.square(2 * np.pi * f * tt) * R.uniform(0.3, 1.0) * (R.uniform() > 0.2)
    z = np.round(colored(n, R, 0.0) * 6) / 6
    out = bp(y * 0.6 + z * 0.5, 120, 9000)
    return fades(out * gain, 0.002, 0.02)


def beep(f=1320, dur=0.09, gain=1.0):
    n = ns(dur); t = V.T(n)
    return fades(np.sin(2 * np.pi * f * t) * gain, 0.003, 0.01)


def relay(gain=1.0):
    """the feed switching cameras: a relay click and a short burst"""
    n = ns(0.12); t = V.T(n)
    y = hp(colored(n, R, 0.0), 1500) * np.exp(-t / 0.004) + np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.01) * 0.5
    return y * gain


def bed_creak(gain=1.0):
    """bed springs and frame taking a sudden weight shift"""
    n = ns(0.5); t = V.T(n)
    f = 140 + 90 * np.exp(-t / 0.08)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.15)
    springs = sum(np.sin(2 * np.pi * fr * t) * np.exp(-t / d) for fr, d in ((1840, 0.12), (2610, 0.08), (3350, 0.05))) * 0.25
    return fades((y + springs + bp(colored(n, R, 0.4), 300, 3000) * np.exp(-t / 0.05) * 0.6) * gain, 0.001, 0.05)


def chain_link(gain=1.0):
    """one link dragged along the slot: a short metallic scrape and a clink"""
    n = ns(0.18); t = V.T(n)
    scrape = bp(colored(n, R, 0.0), 2500, 9000) * np.exp(-t / 0.04)
    ring = sum(np.sin(2 * np.pi * fr * t) * np.exp(-t / d) for fr, d in ((2950, 0.05), (4720, 0.03), (6210, 0.02))) * 0.6
    return fades((scrape * 0.7 + ring) * gain, 0.0005, 0.04)


def chain_drop(gain=1.0):
    """the chain falls out of the slot and swings: a clatter of links, then a jingle that dies away"""
    n = ns(1.6); t = V.T(n)
    y = np.zeros(n)
    for k in range(14):
        at = 0.02 * k + R.uniform(0, 0.015)
        c = S.clink(R.uniform(2400, 5200), R.uniform(0.3, 0.8) * np.exp(-at / 0.2))
        i = ns(at); y[i:i + len(c)] += c[:max(0, n - i)]
    for k, at in enumerate((0.42, 0.85, 1.25)):
        c = S.clink(R.uniform(2600, 4200), 0.35 / (k + 1))
        i = ns(at); y[i:i + len(c)] += c[:max(0, n - i)]
    return y * gain


# ---------------------------------------------------------------- the film
def build():
    music, sfx, amb = (np.zeros((2, N)) for _ in range(3))
    room = make_ir(0.9, 3, hf=1.4)
    big = make_ir(3.0, 5, hf=1.1, pre=0.02)
    # the two worlds: hiss on every feed shot (hard edges), room tone on every room shot
    for row, n in ROWS:
        a, b = st(row), en(row)
        if row in FEED:
            add(amb, feed_hiss(b - a + 0.05), a, 0.9, 0.0, until=b, fade=0.004)
        else:
            add(amb, np.stack([hp(lp(colored(ns(b - a), R, 1.0), 300), 40)] * 2) * 0.05, a, 1.0, 0.0, until=b, fade=0.004)

    cue(0.0, "frame 0: the REC beep and a low hit with the hook text (it also restarts the loop)")
    add(sfx, beep(1320, 0.09, 0.22), 0.0, 1.0, 0.2)
    add(music, S.boom(1.8, 56, 30, 0.55), 0.0)
    add(music, S.drone(41.2, 6.4, 0.3, 0.6, 1.0), 0.0)
    # sleeping breath on the feed (its breath, 4 s period, in phase with the duvet)
    for t0 in (0.0, 4.0 * 10.75):
        add(sfx, lp(S.breath(1.6, 0.05), 1500), t0 + 0.15, 1.0, 0.25)

    cue(st("FACE"), "FACE: you, by the door: quick shallow breaths; a low drone creeps in")
    V.pant(st("FACE") + 0.1, en("FACE") - 0.2, 1.4, 0.06, sfx, 0.0, until=en("FACE"))
    add(music, S.drone(36.7, en("CORNER") - st("FACE"), 0.3, 2.0, 0.5), st("FACE"))

    cue(ft("SITUP", 54), "SITUP: it sits bolt upright (bed creak, duvet), then snaps round to the lens on 'awake' (hit)")
    add(sfx, bed_creak(0.5), ft("SITUP", 54), 1.0, 0.3)
    add(sfx, V.rustle(0.4, 0.2), ft("SITUP", 54), 1.0, 0.3)
    add(music, S.boom(2.2, 52, 26, 0.9), ft("SITUP", 66))
    add(music, S.stinger(0.35), ft("SITUP", 66))
    add(sfx, glitch(0.04, 0.18), ft("SITUP", 54))
    add(sfx, glitch(0.27, 0.42), ft("SITUP", 124), 1.0, 0.0)

    cue(st("EMPTY"), "EMPTY: the real bed, empty: silence but one low hit and a thin high tone")
    add(music, S.boom(2.0, 44, 24, 0.75), st("EMPTY"))
    add(music, V.thin_note(2637.0, 2.4, 0.03), st("EMPTY"), 1.0, 0.0, until=en("EMPTY"))

    cue(ft("STAND", 68), "STAND: a tear, a thud: between two frames it is closer")
    add(sfx, glitch(0.27, 0.45), ft("STAND", 68))
    add(music, S.boom(1.2, 70, 34, 0.5), ft("STAND", 72))

    cue(st("CORNER"), "CORNER: the empty corner: held breath, a single floorboard")
    add(sfx, S.breath(0.5, 0.06, True), st("CORNER") + 0.05)
    add(music, S.cluster([110, 116.5, 164.8], en("CORNER") - st("CORNER"), 1.6, 0.2, 0.1, trem=0.5), st("CORNER"), until=en("CORNER"))
    add(sfx, F2.creak(1.0, 0.045), st("CORNER") + 2.2, 1.0, -0.4)

    cue(ft("GRIN", 30), "GRIN: your face in the lens; the eyes go white (reversed swell, quiet sting), then the grin (cluster)")
    add(music, S.drone(30.9, en("GRIN") - st("GRIN"), 0.5, 0.5, 0.2), st("GRIN"), until=en("GRIN"))
    add(music, V.reverse_swell(0.9, 0.45), ft("GRIN", 30) - 0.9)
    add(music, S.stinger(0.3), ft("GRIN", 34))
    add(sfx, glitch(0.07, 0.25), ft("GRIN", 33))
    add(music, S.cluster([466.2, 493.9, 523.3, 554.4], en("GRIN") - ft("GRIN", 74), 1.3, 0.05, 0.24, trem=9), ft("GRIN", 74), until=en("GRIN"))
    add(sfx, glitch(0.27, 0.6), ft("GRIN", 150))

    cue(st("BEHIND"), "BEHIND: the feed switches (relay, tear): a camera behind you. A heartbeat starts")
    add(sfx, relay(0.4), st("BEHIND"))
    add(sfx, glitch(0.2, 0.35), st("BEHIND"))
    add(music, S.drone(36.7, en("CHAIN") - st("BEHIND"), 0.38, 1.0, 0.4), st("BEHIND"), until=en("CHAIN"))
    t = st("BEHIND") + 0.6
    while t < en("FREEZE"):
        add(sfx, S.heartbeat(0.16 + 0.12 * (t - st("BEHIND")) / 6.8), t, until=en("FREEZE"))
        t += 0.86

    cue(st("FREEZE"), "FREEZE: you don't move: no breath, heartbeat, a high tone")
    add(music, V.thin_note(3135.9, 3.0, 0.02), st("FREEZE"), 1.0, 0.0, until=en("FREEZE"))

    cue(ft("MSG", 2), "MSG: the phone buzzes in your hands, twice; dread swell")
    add(sfx, S.buzz(0.23, 0.33), ft("MSG", 2), 1.0, 0.1)
    add(sfx, S.buzz(0.23, 0.33), ft("MSG", 13), 1.0, 0.1)
    add(music, S.cluster([110, 116.5, 155.6, 164.8], en("MSG") - st("MSG"), 1.4, 0.2, 0.3, trem=0.5), st("MSG") + 0.3, until=en("MSG"))
    add(music, S.boom(2.4, 50, 28, 0.45), ft("MSG", 60))

    cue(ft("CHAIN", 18), "CHAIN: behind you, the chain slides, link by link; it drops out and swings; a riser climbs")
    for t0 in (18, 31, 41, 52, 60, 69, 77):
        add(sfx, chain_link(0.5), ft("CHAIN", t0), 1.0, -0.15)
    add(sfx, chain_drop(0.55), ft("CHAIN", 88), 1.0, -0.15)
    add(music, S.riser(en("TURN") - ft("CHAIN", 30), 220, 3400, 0.9), ft("CHAIN", 30), until=en("TURN"))
    add(music, S.cluster([987.8, 1046.5, 1108.7, 1174.7], en("TURN") - ft("CHAIN", 60), 1.6, 0.01, 0.22, trem=11), ft("CHAIN", 60), until=en("TURN"))

    cue(st("TURN"), "TURN: a sharp inhale and a whoosh as you turn; everything cuts dead on the cut to the feed")
    add(sfx, S.breath(0.3, 0.22, True), st("TURN"))
    add(sfx, S.whoosh(0.6, 0.25), st("TURN") + 0.1)

    cue(st("END"), "END: only the feed's hiss, the last line, and the loop back to frame 0")

    # reverb, then each shot's own hard edge: nothing rings across a cut except the music bed between room shots
    music = music + convolve_st(music.mean(0), big) * 0.3
    sfx = sfx + convolve_st(sfx.mean(0), room) * 0.18
    gate = np.ones(N)
    gate[ns(st("END")):] = 0          # the riser and everything else stop dead on the last cut: only hiss and voice remain
    music *= gate[None, :]
    sfx *= gate[None, :]
    return music, sfx, amb


def duck_curve(words, depth_db=-7.0, pre=0.1, post=0.35):
    on = np.zeros(N)
    for w in words:
        on[ns(max(0, w["s"] - pre)):ns(min(DUR, w["e"] + post))] = 1
    return dbg(depth_db * ndimage.uniform_filter1d(on, ns(0.15)))


def main():
    voice, sr = read_wav(os.path.join(ROOT, "voice", "voice_part2.wav"))
    assert sr == SR, sr
    voice = np.pad(voice, ((0, 0), (0, max(0, N - voice.shape[1]))))[:, :N]
    words = json.load(open(os.path.join(ROOT, "src", "data", "words_part2.json")))
    music, sfx, amb = build()
    music *= dbg(-24.5 - integrated(music))
    sfx *= dbg(-25.0 - integrated(sfx))
    amb *= dbg(-31.0 - integrated(amb))
    mix = voice + music * duck_curve(words)[None, :] + sfx + amb
    for _ in range(3):
        mix = S.limiter(mix * dbg(-14.0 - integrated(mix)), -1.2)
    write_wav(os.path.join(HERE, "mix_part2.wav"), mix)
    with open(os.path.join(HERE, "cues_part2.md"), "w") as fh:
        fh.write("# Sound cues (Part 2)\n\n| time (s) | cue |\n|---|---|\n")
        for t, c in sorted(CUES):
            fh.write(f"| {t:6.2f} | {c} |\n")
        fh.write(f"\nmix: {integrated(mix):.1f} LUFS integrated, true peak {true_peak(mix):.1f} dBTP, {mix.shape[1] / SR:.3f} s\n")
    # loop seam: the last 50 ms and the first 50 ms should sit at a similar level (hiss into hiss)
    a, b = mix[:, -ns(0.05):], mix[:, :ns(0.05)]
    rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)  # noqa: E731
    print(f"mix_part2.wav {integrated(mix):.2f} LUFS, TP {true_peak(mix):.2f} dBTP, {mix.shape[1] / SR:.3f} s; seam {rms(a):.1f} dB -> {rms(b):.1f} dB")


if __name__ == "__main__":
    main()
