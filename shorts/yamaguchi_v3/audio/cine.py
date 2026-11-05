"""Cinematic instruments for the V3 score, synthesized (no samples): an ensemble string section (detuned band-limited
saws, vibrato, slow bow attack, warm low-pass), a felt piano (inharmonic partials, per-partial decay, hammer noise),
a low-brass "braam" (saw cluster through soft saturation with a filter sweep), risers, sub drops and a reverse swell.
All return mono float arrays at dsp.SR unless noted."""
import numpy as np
from dsp import SR, ns, tt, lp, hp, bp, fades, phase


def _saw(f, n, r, cents=0.0, vib=0.0025, vib_hz=5.2, hmax=7000.0):
    """band-limited saw by additive partials with a little vibrato"""
    t = np.arange(n) / SR
    ff = f * 2 ** (cents / 1200) * (1 + vib * np.sin(2 * np.pi * vib_hz * t + r.uniform(0, 6.28)))
    ph = 2 * np.pi * np.cumsum(ff) / SR + r.uniform(0, 6.28)
    y = np.zeros(n)
    for k in range(1, int(hmax / f) + 1):
        y += np.sin(k * ph) / k ** 1.15
    return y


def strings(freqs, dur, vel=0.5, r=None, att=0.8, rel=1.2, bright=2600.0, voices=5, spread=9.0):
    """sustained string-section chord: voices per note detuned by +-spread cents, bowed attack, warm filter"""
    r = r or np.random.default_rng(3)
    n = ns(dur + rel)
    y = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            c = (v - (voices - 1) / 2) / max(1, (voices - 1) / 2) * spread
            y += _saw(f, n, r, c, vib=0.0022 + 0.001 * r.random(), vib_hz=4.8 + 0.8 * r.random(), hmax=min(7000.0, bright * 3))
    y /= max(1, len(freqs) * voices) ** 0.7
    t = np.arange(n) / SR
    env = np.clip(t / att, 0, 1) ** 1.6 * np.exp(-np.maximum(t - dur, 0) / (rel / 3))
    y = lp(y, bright, 2) * env
    y = hp(y, 60, 2)
    return y * vel * 0.5


def piano(f, vel=0.6, r=None, dur=3.0, bright=1.0):
    """felt piano note: slightly inharmonic partials, high partials die first, a soft hammer thump"""
    r = r or np.random.default_rng(5)
    n = ns(dur); t = np.arange(n) / SR
    B = 0.00035
    y = np.zeros(n)
    for k in range(1, 18):
        fk = k * f * np.sqrt(1 + B * k * k)
        if fk > 9000: break
        a = (1 / k ** 1.25) * (0.9 if k == 1 else 1.0) * (1 if k < 6 else bright)
        tau = 2.2 / (1 + 0.55 * k) * (1.6 if f < 200 else 1.0)
        y += a * np.sin(2 * np.pi * fk * t + r.uniform(0, 6.28)) * (0.7 * np.exp(-t / (tau * 0.18)) + 0.3 * np.exp(-t / tau))
    ham = lp(r.standard_normal(n), 2200, 2) * np.exp(-t / 0.012) * 0.25
    y = (y + ham) * np.clip(t / 0.003, 0, 1)
    return fades(y * vel * 0.45, 0.0, 0.08)


def braam(f=36.7, dur=3.2, vel=1.0, r=None):
    """low brass hit: saw cluster (root, fifth, octave) through saturation, filter opening then closing, sub underneath"""
    r = r or np.random.default_rng(7)
    n = ns(dur); t = np.arange(n) / SR
    y = np.zeros(n)
    for mult, g in ((1, 1.0), (1.5, 0.6), (2, 0.55), (3, 0.25)):
        for c in (-7, 0, 7):
            y += g * _saw(f * mult, n, r, c, vib=0.0008, hmax=4000)
    y = np.tanh(1.6 * y / 4)
    # time-varying low-pass: open fast, close slowly (block-wise one-pole)
    cut = 180 + 1700 * np.exp(-t / 0.55) * np.clip(t / 0.06, 0, 1)
    out = np.zeros(n); s = 0.0; blk = 64
    for i in range(0, n, blk):
        a = 1 - np.exp(-2 * np.pi * cut[i] / SR)
        for j in range(i, min(n, i + blk)):
            s += a * (y[j] - s); out[j] = s
    sub = np.sin(phase(f * (1 + 0.15 * np.exp(-t / 0.08)))) * 0.8
    env = np.clip(t / 0.04, 0, 1) * np.exp(-t / (dur * 0.45))
    return (out * 1.4 + sub) * env * vel * 0.6


def riser(dur, r=None, f0=300.0, f1=6000.0):
    """noise band sweeping up with a rising tone, swelling to the end"""
    r = r or np.random.default_rng(11)
    n = ns(dur); t = np.arange(n) / SR; u = t / dur
    fc = f0 * (f1 / f0) ** u
    x = r.standard_normal(n)
    out = np.zeros(n); blk = 256
    for i in range(0, n, blk):
        c = fc[i]
        out[i:i + blk] = bp(x[max(0, i - 2048):i + blk], c * 0.8, min(c * 1.25, 11000), 2)[-len(x[i:i + blk]):]
    tone = np.sin(2 * np.pi * np.cumsum(220 * (4.0 ** u)) / SR) * 0.25
    return (out * 0.8 + tone) * u ** 2.2


def sub_drop(dur=1.6, f0=70.0, f1=28.0):
    n = ns(dur); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (dur * 0.3))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (dur * 0.45)) * np.clip(t / 0.005, 0, 1)


def reverse_swell(x, dur):
    """reversed tail of a sound, ending at its loudest (place it to end on the hit)"""
    y = np.asarray(x)[::-1]
    m = ns(dur)
    y = y[-m:] if len(y) >= m else np.pad(y, (m - len(y), 0))
    return y * np.linspace(0, 1, len(y)) ** 1.5
