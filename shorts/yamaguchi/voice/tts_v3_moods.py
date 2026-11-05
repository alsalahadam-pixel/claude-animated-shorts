"""Narration for "Home Was Nagasaki" v3: Kokoro TTS, narrator am_fenrir with a mood per line (voice blend, pace, pitch, level, room) sentence by sentence, with per-phoneme durations
(kokoro-dur.onnx = kokoro-v1.0.onnx with the encoder's duration tensor exposed as an output named "duration"),
mapped to words -> voice.wav (24 kHz mono) + words.json [{w, s, e}] + lines.json [{text, s, e}].
Usage: python tts.py <speed> <out_dir>"""
import json, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

SPEED = float(sys.argv[1]) if len(sys.argv) > 1 else 1.38
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
K = Kokoro("/home/user/tts/kokoro-dur.onnx", "/home/user/tts/voices-v1.0.bin")
# v3: the delivery follows the story. Each line has a MOOD: a blend of Kokoro voice styles around the narrator
# (am_fenrir), a pace, a pitch shift (semitones, time-preserving), a level and a room send.
#   excited / playful lean on am_puck (bright, bouncy); suspense / dramatic / somber / warm lean on am_onyx (deep,
#   slow); deadpan leans on am_michael (the flattest voice we measured), so the jokes land dry.
MOODS = {
    "excited":  ({"am_fenrir": 0.55, "am_puck": 0.45}, 1.0, +1.0, +1.5, 0.03),
    "playful":  ({"am_fenrir": 0.6, "am_puck": 0.4}, 0.97, +0.6, +0.5, 0.03),
    "story":    ({"am_fenrir": 1.0}, 1.0, 0.0, 0.0, 0.04),
    "suspense": ({"am_fenrir": 0.55, "am_onyx": 0.45}, 0.9, -0.8, -2.0, 0.09),
    "dramatic": ({"am_onyx": 0.6, "am_fenrir": 0.4}, 0.8, -1.2, -0.5, 0.16),
    "intense":  ({"am_fenrir": 0.8, "am_onyx": 0.2}, 1.05, -0.3, +1.5, 0.04),
    "deadpan":  ({"am_michael": 0.55, "am_fenrir": 0.3, "am_onyx": 0.15}, 0.93, -0.6, -1.0, 0.03),
    "somber":   ({"am_onyx": 0.5, "am_fenrir": 0.5}, 0.85, -1.3, -3.0, 0.12),
    "curious":  ({"am_fenrir": 0.7, "am_puck": 0.3}, 0.98, +0.4, 0.0, 0.04),
    "warm":     ({"am_fenrir": 0.7, "am_onyx": 0.3}, 0.93, -0.4, -1.0, 0.08),
    "triumph":  ({"am_fenrir": 0.65, "am_puck": 0.35}, 0.92, +0.3, +1.0, 0.1),
}
# (text as spoken, gap in seconds AFTER the line, mood)
LINES = [
    ("This man survived the atomic bomb on Hiroshima!", 0.08, "excited"),
    ("Then he hopped on a train to get away from it all...", 0.14, "playful"),
    ("Straight to Nagasaki.", 0.55, "deadpan"),
    ("It's August nineteen forty five, and ship designer Tsutomu Yamaguchi is wrapping up a work trip in Hiroshima.", 0.1, "story"),
    ("He's packed and ready to go home to his wife and baby son, when he realizes he forgot his hanko!", 0.1, "playful"),
    ("That's his official name stamp, so he heads back to the shipyard to get it.", 0.12, "playful"),
    ("At a quarter past eight, he looks up at a plane and sees two tiny parachutes drifting down.", 0.3, "suspense"),
    ("Then... the whole sky turns white.", 0.6, "dramatic"),
    ("He's three kilometers away, and it still bursts his eardrums and burns his whole left side.", 0.12, "intense"),
    ("After a night in a shelter, he does the sensible thing and catches a train home.", 0.25, "playful"),
    ("Home is Nagasaki.", 0.4, "deadpan"),
    ("Two days later, wrapped in bandages, he goes back to work, because of course he does.", 0.12, "playful"),
    ("He tells his boss that one single bomb destroyed an entire city.", 0.1, "story"),
    ("His boss says that's crazy!", 0.06, "excited"),
    ("No bomb could ever do that!", 0.32, "excited"),
    ("And right then... the same white light fills the room.", 0.6, "dramatic"),
    ("He later said he thought the mushroom cloud had followed him from Hiroshima.", 0.25, "deadpan"),
    ("Those two bombs killed well over a hundred thousand people, and somehow, he survived both.", 0.35, "somber"),
    ("You see, both times, he was about three kilometers from the center, and distance is everything.", 0.12, "curious"),
    ("Ever sat by a campfire?", 0.06, "curious"),
    ("Lean in close, and it scorches your face!", 0.06, "excited"),
    ("Take a few steps back, and it's just warm.", 0.12, "warm"),
    ("The heat spreads out in every direction, so every time you double the distance, only a quarter of it reaches you.", 0.12, "curious"),
    ("Three kilometers was close enough to hurt him, but far enough to let him live.", 0.3, "warm"),
    ("His wife and son survived too, sheltering in a tunnel.", 0.15, "warm"),
    ("In two thousand nine, he became the only person officially recognized as surviving both bombs.", 0.12, "triumph"),
    ("He spent his last years asking the world never to build another one.", 0.32, "somber"),
    ("Two atomic bombs. Three days apart. And Tsutomu Yamaguchi still lived to be ninety three.", 0.0, "triumph"),
]
FIX = {"tsˈuːɾəmˌuː": "tsuːtˈoʊmuː", "jˌæmɐɡˈʌtʃi": "jˌɑːmɑːɡˈuːtʃi", "nˌæɡɐsˈæki": "nˌɑːɡɑːsˈɑːki", "hˈæŋkoʊ": "hˈɑːŋkoʊ"}
SR = 24000

def shape_line(a, sr, semis, gain_db, room):
    """time-preserving pitch shift, level, and a short room tail (dramatic lines get more room)"""
    import librosa
    from scipy.signal import fftconvolve
    if abs(semis) > 1e-3:
        a = librosa.effects.pitch_shift(a, sr=sr, n_steps=semis, bins_per_octave=12, res_type="soxr_hq").astype(np.float32)
    a = a * 10 ** (gain_db / 20)
    if room > 0:
        r = np.random.default_rng(7); n = int(0.6 * sr); t = np.arange(n) / sr
        ir = r.standard_normal(n) * np.exp(-t / 0.13) * (1 - np.exp(-t / 0.004)); ir /= np.sqrt(np.sum(ir ** 2))
        wet = fftconvolve(a, ir)[: len(a)]
        a = a + room * 3.0 * wet * (np.abs(a).max() / (np.abs(wet).max() + 1e-9))
    return a.astype(np.float32)
PUNCT = set(".,!?;:—…\"'()")

def plen(w):
    ph = K.tokenizer.phonemize(w)
    return max(1, len([c for c in ph if c not in PUNCT and c != " " and c not in "ˈˌ"]))

def words_of(timings, text):
    """group phoneme timings into words at spaces (punctuation does not extend a word); when espeak merged words
    ("at a" -> one group) a DP assigns 1-3 words per group and splits the group's time by each word's phoneme count"""
    groups, cur = [], []
    for t in timings:
        if t.phoneme == " ":
            if cur: groups.append(cur); cur = []
        else: cur.append(t)
    if cur: groups.append(cur)
    groups = [[t for t in g if t.phoneme not in PUNCT] for g in groups]
    groups = [g for g in groups if g]
    ws = text.split(); wl = [plen(w) for w in ws]
    G, N = len(groups), len(ws)
    gl = [len([t for t in g if t.phoneme not in "ˈˌ"]) for g in groups]
    INF = 1e9; best = [[INF] * (N + 1) for _ in range(G + 1)]; back = {}
    best[0][0] = 0
    for i in range(G):
        for j in range(N):
            if best[i][j] >= INF: continue
            for k in (1, 2, 3):
                if j + k > N: break
                c = best[i][j] + abs(gl[i] - sum(wl[j:j + k])) + 2.0 * (k - 1)
                if c < best[i + 1][j + k]: best[i + 1][j + k] = c; back[(i + 1, j + k)] = k
    assert best[G][N] < INF, (text, G, N)
    ks, i, j = [], G, N
    while i > 0: k = back[(i, j)]; ks.append(k); i -= 1; j -= k
    ks.reverse()
    out, j = [], 0
    for g, k in zip(groups, ks):
        s0, e0 = g[0].start, g[-1].end
        tot = sum(wl[j:j + k]); acc = 0
        for m in range(k):
            a = s0 + (e0 - s0) * acc / tot; acc += wl[j + m]; b = s0 + (e0 - s0) * acc / tot
            out.append({"w": ws[j + m].strip(".,!?;:"), "s": a, "e": b})
        j += k
    return out

audio, words, lines, t = [], [], [], 0.06
audio.append(np.zeros(int(0.06 * SR), np.float32))
for text, gap, mood in LINES:
    blend, sp, semis, gain_db, room = MOODS[mood]
    style = sum(w * K.voices[v] for v, w in blend.items()) / sum(blend.values())
    ph = K.tokenizer.phonemize(text)
    for a, b in FIX.items(): ph = ph.replace(a, b)
    a, sr, tm = K.create_timed(ph, voice=style, speed=SPEED * sp, is_phonemes=True, sentence_pause=0.06, clause_pause=0.04)
    a = shape_line(a.astype(np.float32), sr, semis, gain_db, room)
    assert sr == SR
    ws = words_of(tm, text)
    for w in ws: words.append({"w": w["w"], "s": round(t + w["s"], 3), "e": round(t + w["e"], 3)})
    lines.append({"text": text, "s": round(t + ws[0]["s"], 3), "e": round(t + ws[-1]["e"], 3)})
    audio.append(a.astype(np.float32)); t += len(a) / SR
    audio.append(np.zeros(int(gap * SR), np.float32)); t += int(gap * SR) / SR
y = np.concatenate(audio)
y = y / max(1e-6, np.abs(y).max()) * 0.89
json.dump([{"mood": m, "s": l["s"], "e": l["e"]} for (_, _, m), l in zip(LINES, lines)], open(f"{OUT}/moods.json", "w"), indent=1)
sf.write(f"{OUT}/voice.wav", y, SR)
json.dump(words, open(f"{OUT}/words.json", "w"), indent=0)
json.dump(lines, open(f"{OUT}/lines.json", "w"), indent=1)
print(f"speed {SPEED}: {len(y)/SR:.2f} s, {len(words)} words, last word ends {words[-1]['e']:.2f} s")
