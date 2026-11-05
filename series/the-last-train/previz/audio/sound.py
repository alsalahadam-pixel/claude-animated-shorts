"""Episode 1 previz soundtrack: synthesized SFX + original score, mixed under the scratch dialogue.
Every cue time comes from 05_ep01_storyboard.md. Usage: python sound.py <out_dir>  (reads out_dir/vo_stem.wav)"""
import os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', 'templates', 'audio'))
from dsp import (SR, TAU, ns, tt, rng, lp, hp, bp, colored, fades, modal, pan, place, make_ir, convolve_st,
                 read_wav, write_wav, integrated, true_peak, dbg)  # noqa: E402

OUT = sys.argv[1]
DUR = 88.0
N = ns(DUR)
R = rng(42)
sfx = np.zeros((2, N)); mus = np.zeros((2, N)); bed = np.zeros((2, N)); hum_b = np.zeros((2, N))

def env(n, a=0.005, r=0.05):
    e = np.ones(n); ka, kr = min(n, ns(a)), min(n, ns(r))
    if ka: e[:ka] = np.linspace(0, 1, ka)
    if kr: e[-kr:] *= np.linspace(1, 0, kr)
    return e

def note(f):
    return 440.0 * 2 ** ((f - 69) / 12)

# ------------------------------------------------------------ sound generators
def bell(f, dur=1.4, a=1.0):
    return a * modal(dur, [(f, 1.0, 0.55), (f * 2.0, 0.35, 0.3), (f * 2.76, 0.22, 0.18), (f * 5.4, 0.08, 0.08)], R)

def door_chime(t, g=0.32):
    place(sfx, pan(bell(659.25), -0.1), t, g); place(sfx, pan(bell(523.25), -0.1), t + 0.42, g)

def pa_chime(t, g=0.25):
    for i, f in enumerate([783.99, 659.25, 523.25]): place(sfx, pan(bell(f, 1.2) * 0.8, 0.3), t + i * 0.32, g)

def hiss(dur=1.3, g=1.0):
    n = colored(ns(dur), R, 0.3); return hp(n, 2500, 2) * np.exp(-tt(dur) / (dur * 0.35)) * g

def doors_slide(dur=0.8):
    n = lp(colored(ns(dur), R, 1.0), 900, 2) * 0.6 + hp(colored(ns(dur), R, 0.0), 4000, 2) * 0.15
    return n * env(ns(dur), 0.05, 0.3)

def step(kind='tile', g=1.0):
    d = 0.09; t = tt(d)
    thump = np.sin(TAU * 85 * t) * np.exp(-t / 0.018)
    scuff = bp(colored(ns(d), R, 0.5), 600, 3500, 2) * np.exp(-t / 0.025) * 0.6
    x = thump + scuff
    if kind == 'metal':
        x = x * 0.7 + modal(0.25, [(R.uniform(380, 520), 0.5, 0.06), (R.uniform(900, 1300), 0.35, 0.04), (R.uniform(2100, 2600), 0.2, 0.03)], R)[:ns(0.25)][:len(x)] * 1.0
    return x * g

def footsteps(t0, t1, rate, kind='tile', g=0.5, p=0.0):
    t = t0
    while t < t1:
        place(sfx, pan(step(kind, R.uniform(0.8, 1.1)), p + R.uniform(-0.05, 0.05)), t + R.uniform(-0.01, 0.01), g); t += 1.0 / rate

def knock(g=1.0):
    return modal(0.35, [(180, 1.0, 0.07), (392, 0.55, 0.05), (830, 0.3, 0.03), (1650, 0.12, 0.02)], R) * g + hp(colored(ns(0.35), R, 0), 1500, 2) * np.exp(-tt(0.35) / 0.006) * 0.4

def keys_jangle(dur, density=90, g=1.0):
    x = np.zeros(ns(dur) + ns(0.3))
    for _ in range(int(dur * density)):
        f = R.uniform(2200, 7500); k = ns(R.uniform(0, dur))
        ping = modal(0.25, [(f, 1, R.uniform(0.03, 0.12)), (f * 1.53, 0.5, 0.04)], R)
        x[k:k + len(ping)] += ping[:len(x) - k] * R.uniform(0.2, 1.0)
    return x * g * 0.18

def glass_crack(dur=1.4, g=1.0):
    x = np.zeros(ns(dur))
    for i in range(int(dur * 160)):
        k = ns(dur * (R.random() ** 1.8)); c = bp(R.standard_normal(ns(0.004)), 1800, 7000, 1) * R.uniform(0.2, 1.0)
        x[k:k + len(c)] += c[:len(x) - k]
    return x * g

def shatter(g=1.0):
    d = 2.2; x = hp(colored(ns(d), R, 0.2), 1500, 2) * np.exp(-tt(d) / 0.35) * 0.6
    for _ in range(120):
        f = R.uniform(2500, 9000); k = ns(R.uniform(0, 1.2) ** 1.5)
        p = modal(0.4, [(f, 1, R.uniform(0.05, 0.25))], R); x[k:k + len(p)] += p[:len(x) - k] * R.uniform(0.1, 0.5)
    return x * g

def thoom(g=1.0):
    d = 1.4; t = tt(d); f = 52 * (1 + 0.6 * np.exp(-t / 0.05))
    body = np.sin(TAU * np.cumsum(f) / SR) * np.exp(-t / 0.35)
    thud = lp(colored(ns(d), R, 1.5), 260, 2) * np.exp(-t / 0.12) * 1.2
    return (body + thud) * g

def slam(g=1.0):
    return modal(0.6, [(118, 1.0, 0.14), (296, 0.5, 0.09), (715, 0.35, 0.05), (1680, 0.15, 0.03)], R) * g + lp(colored(ns(0.6), R, 1), 1200, 2) * np.exp(-tt(0.6) / 0.03) * 0.8 * g

def clank(g=1.0):
    a = modal(1.2, [(512, 1.0, 0.28), (1227, 0.7, 0.2), (2094, 0.45, 0.14), (3312, 0.3, 0.09), (4810, 0.15, 0.05)], R)
    b = modal(1.2, [(560, 0.8, 0.22), (1350, 0.5, 0.16), (2600, 0.3, 0.1)], R)
    x = a.copy(); k = ns(0.045); x[k:] += b[:len(x) - k] * 0.8
    return x * g + hp(colored(ns(1.2), R, 0), 2000, 2) * np.exp(-tt(1.2) / 0.01) * 0.5 * g

def phone_buzz(dur, g=1.0):
    t = tt(dur); on = ((t % 0.9) < 0.45).astype(float)
    x = np.sign(np.sin(TAU * 175 * t)) * 0.4 + np.sin(TAU * 350 * t) * 0.3
    return bp(x, 120, 2500, 2) * lp(on, 40, 1) * g

def ringtone(dur, g=1.0):
    x = np.zeros(ns(dur) + ns(0.5)); seq = [84, 88, 91, 96, 91, 88]
    for i in range(int(dur / 0.11)):
        f = note(seq[i % len(seq)]); p = modal(0.3, [(f, 1, 0.09), (f * 3, 0.2, 0.03)], R); k = ns(i * 0.11); x[k:k + len(p)] += p[:len(x) - k]
    return x[:ns(dur)] * g

def tinny(dur, g=1.0):
    x = np.zeros(ns(dur)); seq = [69, 72, 76, 72, 74, 77, 81, 77]
    for i in range(int(dur / 0.14)):
        f = note(seq[i % len(seq)]); d = 0.14; s = np.sign(np.sin(TAU * f * tt(d))) * np.exp(-tt(d) / 0.06); k = ns(i * 0.14); x[k:k + len(s)] += s[:len(x) - k]
    return bp(x, 1200, 4500, 3) * g

def fluorescent(dur, g=1.0, seed=1):
    t = tt(dur); r = rng(seed)
    x = sum(np.sin(TAU * 100 * h * t + r.uniform(0, 6)) / h ** 1.3 for h in range(1, 8))
    flick = np.repeat(r.random(int(dur * 9) + 1) < 0.85, ns(1 / 9) + 1)[:len(t)].astype(float)
    crack = hp(r.standard_normal(len(t)), 3000, 2) * (r.random(len(t)) < 0.0015) * 3
    return (x * 0.25 * lp(flick, 30, 1) + crack * 0.1 + bp(colored(len(t), r, 1.0), 60, 400, 2) * 0.05) * g

def stiller_hum(dur, g=1.0, seed=2):
    t = tt(dur); r = rng(seed); x = np.zeros(len(t))
    for v in range(14):
        f0 = r.uniform(105, 175); drift = 1 + 0.01 * np.sin(TAU * r.uniform(0.05, 0.2) * t + r.uniform(0, 6))
        saw = 2 * ((np.cumsum(f0 * drift) / SR) % 1.0) - 1
        x += saw * (0.6 + 0.4 * np.sin(TAU * r.uniform(0.1, 0.4) * t + r.uniform(0, 6)))
    x = bp(x, 180, 900, 2); x = lp(x, 650, 2)
    return x / (np.std(x) + 1e-9) * 0.1 * g

def rumble(dur, g=1.0):
    return lp(colored(ns(dur), R, 2.0), 120, 2) * 0.5 * g

def motor(dur, g=1.0):
    t = tt(dur); saw = 2 * ((55 * t) % 1.0) - 1; rat = bp(colored(len(t), R, 0.5), 300, 2500, 2) * (0.5 + 0.5 * np.sin(TAU * 13 * t))
    return (lp(saw, 300, 2) * 0.35 + rat * 0.25) * g

def beep(g=1.0):
    d = 0.13; return np.sign(np.sin(TAU * 1046 * tt(d))) * env(ns(d), 0.003, 0.02) * 0.3 * g

def heartbeat(t0, t1, bpm0, bpm1, g=1.0, buf=None):
    buf = sfx if buf is None else buf; t = t0
    while t < t1:
        bpm = bpm0 + (bpm1 - bpm0) * (t - t0) / max(1e-6, t1 - t0)
        for dt, a in [(0, 1.0), (0.26, 0.7)]:
            d = 0.16; x = np.sin(TAU * 52 * tt(d)) * np.exp(-tt(d) / 0.04) + lp(colored(ns(d), R, 2), 150, 2) * np.exp(-tt(d) / 0.03) * 0.5
            place(buf, x, t + dt, g * a)
        t += 60.0 / bpm

def breath(t0, t1, rate, g=1.0):
    t = t0
    while t < t1:
        d = 0.5 / rate * 0.9; x = bp(colored(ns(d), R, 0.6), 500, 3000, 2) * np.sin(np.pi * np.linspace(0, 1, ns(d))) ** 2
        place(sfx, pan(x, -0.05), t, g * R.uniform(0.7, 1.0)); t += 1.0 / rate

def crackle(n=22, span=0.25, g=1.0):
    x = np.zeros(ns(span) + ns(0.02))
    for _ in range(n):
        k = ns(R.uniform(0, span)); c = bp(R.standard_normal(ns(0.006)), 900, 4500, 1) * R.uniform(0.3, 1); x[k:k + len(c)] += c
    return x * g

def saw(f, dur):
    t = tt(dur); return 2 * ((f * t) % 1.0) - 1

def sub_swell(dur, g=1.0):
    t = tt(dur); f = 30 + 18 * t / dur
    return np.sin(TAU * np.cumsum(f) / SR) * (t / dur) ** 2 * g + lp(colored(len(t), R, 2), 80, 2) * (t / dur) ** 2 * 0.4 * g

def string_hit(g=1.0):
    d = 2.2; x = sum(saw(note(m) * (1 + R.uniform(-0.003, 0.003)), d) for m in [38, 45, 50, 53])
    return lp(x, 1400, 2) * np.exp(-tt(d) / 0.5) * env(ns(d), 0.004, 0.3) * 0.25 * g

def strings_note(m, d, g=1.0):
    x = saw(note(m), d) + saw(note(m) * 1.004, d) * 0.7 + saw(note(m) * 0.997, d) * 0.6
    return lp(x, 700, 2) * env(ns(d), 0.02, 0.08) * g

def piano(m, d=2.5, g=1.0):
    f = note(m); x = sum(modal(d, [(f * k * (1 + 0.0004 * k * k) * (1 + det), 1.0 / k ** 1.4, 1.2 / k ** 0.6)], R) for k in range(1, 7) for det in (-0.0025, 0.0, 0.002))
    return lp(x, 2400, 2) * env(ns(d), 0.003, 0.4) * 0.22 * g

def drone(dur, root=38, g=1.0):
    t = tt(dur); x = sum(np.sin(TAU * note(m) * t + i) * a for i, (m, a) in enumerate([(root, 1.0), (root + 12, 0.5), (root + 7, 0.35), (root - 12, 0.6)]))
    x *= 0.8 + 0.2 * np.sin(TAU * 0.13 * t)
    return x * env(len(t), 1.0, 1.0) * g * 0.12

# ------------------------------------------------------------ BEDS (with silence windows)
bed_mask = np.ones(N)
def cut(a, b, fade=0.03):
    i, j = ns(a), ns(b); bed_mask[i:j] = 0; f = ns(fade)
    bed_mask[max(0, i - f):i] *= np.linspace(1, 0, min(f, i)); bed_mask[j:j + f] *= np.linspace(0, 1, f)
cut(22.95, 24.0)          # radio slap -> total silence (S9->S10)
cut(68.8, 73.6, 0.08)     # revelation silence (S26), only the hum survives

place(bed, pan(fluorescent(36.2, 1.0, 3), 0.15), 0.0, 0.5)
place(bed, pan(rumble(88.0), 0.0), 0.0, 0.35)
place(bed, pan(bp(colored(N, R, 1.2), 200, 2000, 2) * 0.03, 0), 0.0, 1.0)           # room tone
place(bed, pan(motor(40.0), 0.35), 48.0, 0.5)
# Stiller hum: carriage (louder in close shots), then from the signal room
hum_env = np.interp(np.arange(N) / SR, [0, 10, 11, 13.4, 19, 23.2, 26.6, 30.2, 36.2, 54, 55.4, 68.8, 73.6, 76, 88],
                                       [0.4, 0.5, 1.0, 1.0, 0.6, 0.9, 1.2, 1.0, 0.0, 0.0, 0.35, 0.6, 0.9, 0.0, 0.0])
place(hum_b, pan(stiller_hum(88.0), 0.0) * hum_env, 0.0, 1.0)
hum_b[:, ns(22.95):ns(23.95)] = 0.0; hum_b[:, ns(23.95):ns(24.6)] *= np.linspace(0, 1, ns(24.6) - ns(23.95))

# ------------------------------------------------------------ SFX timeline
place(sfx, pan(hiss(1.3), -0.3), 0.0, 0.35)
door_chime(0.04)
place(sfx, pan(doors_slide(), 0.0), 0.08, 0.5)
place(sfx, pan(tinny(2.8), 0.1), 2.6, 0.05)                    # Kai's earbud bleed
footsteps(7.7, 10.4, 1.9, 'tile', 0.32)
place(sfx, pan(phone_buzz(2.8), -0.2), 10.6, 0.22)            # Commuter's phone
place(sfx, pan(tinny(2.8), -0.2), 10.6, 0.07)
place(sfx, pan(crackle(4, 0.04), -0.3), 14.75, 0.5)           # twitch
pa_chime(15.42)
for i in range(4): place(sfx, pan(crackle(12, 0.12), 0.1), 15.9 + i * 0.6, 0.35)
place(sfx, pan(crackle(30, 0.22), 0.0), 19.9, 0.55)           # necks
place(sfx, pan(hp(colored(ns(1.3), R, 0), 1500, 2) * 0.08, 0.0), 21.65, 1.0)   # radio static under Ruth
place(sfx, pan(slam(0.5) * 0.4, 0.0), 22.95, 0.6)             # hand slaps radio
place(sfx, pan(sub_swell(4.2), 0.0), 24.0, 0.7)
for i in range(18): place(sfx, pan(crackle(3, 0.03), R.uniform(-0.5, 0.5)), 23.6 + i * 0.12, 0.25)  # stutter turns
place(sfx, pan(keys_jangle(0.35, 40, 0.6), 0.1), 27.2, 1.0)   # the second sound
door_chime(27.55, 0.28)
place(sfx, pan(doors_slide(0.9), 0.0), 27.7, 0.45)
place(sfx, pan(slam(0.9), -0.1), 28.62, 0.7)
place(sfx, pan(thoom(1.0), 0.0), 29.0, 0.9)
place(sfx, pan(glass_crack(1.6, 0.6), 0.2), 29.05, 0.6)
for i in range(26): place(sfx, pan(lp(thoom(0.4), 300, 2)[:ns(0.5)], R.uniform(-0.6, 0.2)), 29.6 + i * R.uniform(0.18, 0.3), R.uniform(0.15, 0.3))
footsteps(30.4, 35.6, 1.4, 'tile', 0.25)
footsteps(35.8, 36.2, 6.2, 'tile', 0.4, 0.3)
place(sfx, pan(crackle(14, 0.2), 0.0), 36.55, 0.35)
footsteps(37.85, 40.6, 6.8, 'metal', 0.45)
breath(37.8, 44.6, 3.2, 0.12)
place(sfx, pan(lp(glass_crack(1.0), 2500, 2), -0.4), 39.0, 0.25)
footsteps(40.85, 43.0, 6.0, 'tile', 0.42)
footsteps(43.0, 43.9, 3.0, 'tile', 0.3)
place(sfx, pan(bp(colored(ns(0.4), R, 0.5), 300, 3000, 2) * 0.2, -0.2), 41.0, 1.0)  # phone rustle
breath(44.8, 48.0, 1.4, 0.1)
footsteps(48.05, 51.0, 6.5, 'tile', 0.42)
k = 0
while True:
    tb = (0.25 + k) / 1.6
    if tb > 86.6: break
    if tb >= 48.0 and not (68.8 <= tb < 73.6): place(sfx, pan(beep(), 0.35), tb, 0.35)
    k += 1
for tk in (51.05, 51.37, 51.69): place(sfx, pan(knock(), -0.15), tk, 0.6)
place(sfx, pan(bp(saw(2400, 0.12) * env(ns(0.12)), 1500, 5000, 2), 0.0), 51.25, 0.15)  # sneaker squeak
place(sfx, pan(shatter(0.8), -0.6), 60.2, 0.45)
footsteps(60.4, 62.3, 22, 'tile', 0.12, -0.5)
place(sfx, pan(keys_jangle(2.0, 110, 1.0), 0.1), 63.05, 1.0)  # the sound mistake
place(sfx, pan(ringtone(0.45), 0.0), 66.75, 0.5)
place(sfx, pan(lp(ringtone(0.9), 500, 3) * 2.0, 0.0), 67.2, 0.5)      # smothered
heartbeat(53.0, 68.8, 72, 96, 0.5)
heartbeat(73.6, 76.0, 46, 46, 0.6)                             # slow motion
heartbeat(76.0, 81.3, 96, 104, 0.45)
place(sfx, pan(clank(1.0), -0.05), 86.8, 0.75)
door_chime(87.25, 0.22)

# ------------------------------------------------------------ MUSIC
place(mus, pan(drone(23.2, 38, 1.0), 0.0), 0.0, 0.5)
place(mus, pan(string_hit(), 0.0), 29.0, 0.8)
bar = 2.4
pat = [38, 38, 41, 38, 33, 38, 40, 38]
t = 35.8
while t < 51.69:
    for i, m in enumerate(pat):
        tn = t + i * 0.3
        if tn >= 51.69: break
        x = strings_note(m, 0.28)
        place(mus, pan(x, -0.2), tn, 0.22); place(mus, pan(strings_note(m + 12, 0.28) * 0.4, 0.25), tn, 0.22)
    t += bar
for tb in np.arange(35.8, 51.0, bar * 2):   # brass chime motif E -> C
    for j, m in enumerate([52, 48]):
        d = 1.0; x = lp(saw(note(m), d) + saw(note(m) * 1.003, d), 1100, 2) * env(ns(d), 0.12, 0.3) * 0.18
        place(mus, pan(x, 0.0), tb + j * 0.6, 1.0)
trem = (saw(note(74), 3.6) + saw(note(81), 3.6)) * (0.5 + 0.5 * np.sin(TAU * 12 * tt(3.6)))
place(mus, pan(lp(trem, 4000, 2) * env(len(trem), 0.4, 0.02) * 0.04, 0.3), 48.0, 1.0)
gh = np.sin(TAU * 1760 * tt(15.8) + 0.004 * np.sin(TAU * 5 * tt(15.8)) * 60) * 0.5 + np.sin(TAU * 3520 * tt(15.8)) * 0.08
place(mus, pan(gh * env(len(gh), 1.2, 0.1) * 0.05, 0.1), 53.0, 1.0)
place(mus, pan(drone(13.0, 26, 1.2), 0.0), 73.6, 0.6)
for i, (m, dt) in enumerate([(76, 0.0), (72, 0.55), (64, 1.6), (60, 2.15)]):
    place(mus, pan(piano(m, 2.6), (-0.2 if i % 2 else 0.2)), 82.7 + dt, 0.9)

# ------------------------------------------------------------ MIX
vo, sr = read_wav(os.path.join(OUT, 'vo_stem.wav'))
vo = vo[:, :N] if vo.shape[1] >= N else np.pad(vo, ((0, 0), (0, N - vo.shape[1])))
# slow-motion section: pitch the beds down by blending a low-passed copy (cheap "slowed" feel)
voice_env = lp(np.abs(vo).mean(0), 6, 1); duck = 1.0 - 0.6 * np.clip(voice_env / (voice_env.max() * 0.15 + 1e-9), 0, 1)
ir_plat, ir_corr = make_ir(1.9, 21, pre=0.02), make_ir(1.1, 22, pre=0.012)
split = ns(36.2)
send = sfx * 0.35
wet = np.zeros_like(sfx)
wet[:, :split] = convolve_st(send[:, :split], ir_plat)[:, :split]
wet[:, split:] = convolve_st(send[:, split:], ir_corr)
beds = (bed + convolve_st(bed * 0.2, ir_plat)) * bed_mask
mix = vo * 1.0 + (sfx + wet * 0.8) * dbg(-6) + mus * dbg(-3) * duck + beds * dbg(-8) * duck + hum_b * dbg(-4)
L = integrated(mix); mix *= dbg(-13.4 - L)
mix = np.tanh(mix / 0.89) * 0.89
mix = fades(mix, 0.002, 0.01)
print('integrated LUFS', round(integrated(mix), 2), 'true peak', round(true_peak(mix), 2))
write_wav(os.path.join(OUT, 'mix.wav'), mix)
write_wav(os.path.join(OUT, 'stem_sfx.wav'), (sfx + wet * 0.8) * dbg(-6) + beds * dbg(-8))
write_wav(os.path.join(OUT, 'stem_music.wav'), mus * dbg(-3))
print('wrote mix.wav')
