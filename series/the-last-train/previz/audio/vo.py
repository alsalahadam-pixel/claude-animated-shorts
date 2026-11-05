"""Scratch dialogue for the previz: Piper TTS per line, fitted to its screenplay slot, then treated
(whisper / radio / phone / PA / through-steel). Writes vo_stem.wav (stereo, 48 kHz, 88 s) and vo_timing.json.
Usage: python vo.py <voices_dir> <out_dir>"""
import json, os, sys, wave, io
import numpy as np
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', 'templates', 'audio'))
from dsp import SR, lp, hp, bp, rng, make_ir, convolve_st, write_wav, place, pan, fades  # noqa: E402
from piper import PiperVoice, SynthesisConfig  # noqa: E402

VOICES, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
DUR = 88.0
LINES = json.load(open(os.path.join(HERE, 'lines.json')))

_cache = {}
def voice(name):
    if name not in _cache:
        _cache[name] = PiperVoice.load(os.path.join(VOICES, name + '.onnx'))
    return _cache[name]

def synth(model, text, speaker=None, length=1.0):
    v = voice(model)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        v.synthesize_wav(text, w, syn_config=SynthesisConfig(speaker_id=speaker, length_scale=length, noise_scale=0.6, noise_w_scale=0.7))
    buf.seek(0)
    with wave.open(buf, 'rb') as w:
        sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(float) / 32768
    x = signal.resample_poly(x, SR, sr)
    # trim silence
    e = np.abs(x) > 0.01
    if e.any():
        a, b = np.argmax(e), len(e) - np.argmax(e[::-1])
        x = x[max(0, a - 200): b + 400]
    return x

def f0(x):
    """median F0 by autocorrelation over voiced frames"""
    fr, hop, out = 2048, 512, []
    for i in range(0, len(x) - fr, hop):
        s = x[i:i + fr] * np.hanning(fr)
        if np.sqrt(np.mean(s ** 2)) < 0.02: continue
        ac = np.correlate(s, s, 'full')[fr - 1:]
        lo, hi = SR // 400, SR // 70
        k = lo + np.argmax(ac[lo:hi])
        if ac[k] > 0.35 * ac[0]: out.append(SR / k)
    return float(np.median(out)) if out else 0.0

# ---- cast libritts speakers by pitch
probe = 'Please. I can hear them. Is someone there?'
survey = []
for sid in range(0, 900, 9):
    survey.append((f0(synth('en-us-libritts-high', probe, sid)), sid))
survey.sort()
fem = [s for s in survey if s[0] > 165]
ruth = min(fem, key=lambda s: abs(s[0] - 172))[1]          # deep female
kids = [s for s in survey if s[0] > 215]
wren = kids[-1][1] if kids else survey[-1][1]               # highest voice
lucy = kids[-3][1] if len(kids) >= 3 else survey[-2][1]
print('cast: ruth', ruth, 'wren', wren, 'lucy', lucy, '| top pitches', survey[-5:])
CAST = {
    'kai': ('en-us-ryan-high', None, 0),
    'ruth': ('en-us-libritts-high', ruth, 0),
    'pa': ('en-gb-southern_english_female-low', None, 0),
    'wren': ('en-us-libritts-high', wren, 3),   # +3 semitones (child)
    'lucy': ('en-us-libritts-high', lucy, 4),
}

def pitch_up(x, semis):
    if not semis: return x
    r = 2 ** (semis / 12)
    up, down = 100, int(round(100 * r))
    return signal.resample_poly(x, up, down)

def whisperize(x, amount=0.85, seed=1):
    f, t, Z = signal.stft(x, SR, nperseg=1024, noverlap=768)
    ph = rng(seed).uniform(-np.pi, np.pi, Z.shape)
    W = np.abs(Z) * np.exp(1j * ph)
    _, y = signal.istft(W, SR, nperseg=1024, noverlap=768)
    y = y[:len(x)]; y = np.pad(y, (0, len(x) - len(y)))
    y = hp(y, 900, 2) * 1.6
    return (1 - amount) * x * 0.6 + amount * y

def radio(x, loud=False, seed=2):
    y = bp(x, 380, 3000, 2) * (3.5 if loud else 2.2)
    y = np.tanh(y * (3.0 if loud else 1.6)) * 0.5
    n = rng(seed).standard_normal(len(y)) * (0.05 if loud else 0.025)
    y = y + bp(n, 800, 5000, 1)
    sq = rng(seed + 1).standard_normal(int(0.05 * SR)) * 0.25 * np.exp(-np.linspace(0, 8, int(0.05 * SR)))
    return np.concatenate([bp(sq, 1000, 6000, 1), y, bp(sq[::-1] * 0.6, 1000, 6000, 1)])

def phone(x):
    y = bp(x, 320, 3300, 3) * 2.0
    y = np.tanh(y * 1.3) * 0.6
    return y + rng(5).standard_normal(len(y)) * 0.006

ir_room = make_ir(1.3, 11, pre=0.01)
ir_hall = make_ir(2.6, 12, pre=0.03)
ir_small = make_ir(0.5, 13, pre=0.004)

stem = np.zeros((2, int(DUR * SR)))
timing = []
for L in LINES:
    model, spk, semis = CAST[L['who']]
    length = 1.08 if L['fx'].startswith('vo') else 1.0
    if L['who'] == 'pa': length = 1.02
    length *= L.get('len', 1.0)
    x = pitch_up(synth(model, L['text'], spk, length), semis)
    # fit into the slot
    for _ in range(4):
        if len(x) / SR <= L['max']: break
        length *= max(0.72, L['max'] / (len(x) / SR)) * 0.98
        x = pitch_up(synth(model, L['text'], spk, length), semis)
    d = len(x) / SR
    fx = L['fx']
    if fx in ('whisper', 'vo_whisper'):
        y = whisperize(x); g = 0.55
    elif fx == 'radio_loud':
        y = radio(x, True); g = 1.0
    elif fx == 'radio':
        y = radio(x); g = 0.62
    elif fx == 'phone':
        y = whisperize(x, 0.5) ; y = phone(y); g = 0.6
    elif fx == 'steel':
        y = lp(x, 1100, 2) * 1.3; g = 0.45
    elif fx == 'steel_w':
        y = lp(whisperize(x, 0.6), 1600, 2) * 1.4; g = 0.45
    elif fx == 'pa':
        y = bp(x, 260, 5200, 2); g = 0.42
    else:
        y = x; g = 0.75 if fx == 'room' else 0.85
    y = fades(y, 0.004, 0.03) * g
    dry = pan(y, 0.0)
    if fx == 'pa':
        wet = convolve_st(np.pad(y, (0, int(2.5 * SR))), ir_hall) * 0.75
        dry = np.concatenate([dry, np.zeros((2, wet.shape[1] - dry.shape[1]))], axis=1) * 0.55 + wet
    elif fx in ('room', 'whisper', 'steel', 'steel_w'):
        wet = convolve_st(np.pad(y, (0, int(1.2 * SR))), ir_room if fx == 'room' else ir_small) * (0.28 if fx == 'room' else 0.12)
        dry = np.concatenate([dry, np.zeros((2, wet.shape[1] - dry.shape[1]))], axis=1) + wet
    place(stem, dry, L['start'])
    timing.append({'id': L['id'], 'who': L['who'], 'fx': fx, 'start': L['start'], 'end': round(L['start'] + d, 3), 'text': L['text']})
    print(f"{L['id']:2} {L['who']:5} {d:4.2f}s / {L['max']}  {L['text']}")

write_wav(os.path.join(OUT, 'vo_stem.wav'), stem)
json.dump(timing, open(os.path.join(OUT, 'vo_timing.json'), 'w'), indent=1)
print('wrote', OUT)
