"""Narration for "Home Was Nagasaki" V3: Kokoro TTS (am_fenrir), pushed as far as it goes.
- Each passage is directed on its own: pace (slower on the emotional lines, quicker through transitions), level, and
  the pause after it (long silences at the flashes).
- Takes: every passage is synthesized several times with the voice's style row shifted (Kokoro picks one style vector
  per phoneme count; neighbouring rows give the same voice a different intonation) and small speed changes. Each take
  is scored on pitch movement (p10-p90, in semitones), on staying the same voice (median pitch within 1 semitone of the
  narrator's), and on hitting the passage's target pace. The best take is kept. Punch lines get the most takes.
- Per-phoneme durations (kokoro-dur.onnx) give word timings -> voice.wav + words.json + lines.json + takes.json.
Usage: python tts.py <speed> <out_dir>"""
import dataclasses, json, sys
import numpy as np, soundfile as sf, librosa
from kokoro_onnx import Kokoro

SPEED = float(sys.argv[1]) if len(sys.argv) > 1 else 1.45
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
K = Kokoro("/home/user/tts/kokoro-dur.onnx", "/home/user/tts/voices-v1.0.bin")
VOICE = "am_fenrir"
BASE = K.get_voice_style(VOICE)
# (lines spoken together, pace, level dB, pause after s, kind: punch = most takes and pitch movement matters most,
#  warm = emotional (slow target pace), flow = information (quicker target pace))
PASSAGES = [
    # cold open: Nagasaki, the second flash
    (["This man has already survived one atomic bomb."], 1.04, 0.0, 0.1, "punch"),
    (["Now, he's about to survive another."], 0.95, 0.0, 0.65, "punch"),
    (["How do you survive that... twice?"], 0.95, -0.5, 1.15, "punch"),
    # Hiroshima, 6 August
    (["Hiroshima, August sixth, nineteen forty five.",
      "He's a ship designer from Nagasaki, going home today to his wife and baby son."], 1.05, 0.0, 0.12, "flow"),
    (["But he's forgotten his name stamp, so he turns back."], 1.03, 0.0, 0.2, "flow"),
    (["Eight fifteen."], 1.0, -0.5, 0.2, "punch"),
    (["A plane."], 0.95, -1.0, 0.2, "punch"),
    (["Two small parachutes, drifting down."], 0.95, -1.0, 0.3, "punch"),
    (["Then... the sky turns white."], 0.9, -1.0, 0.85, "punch"),
    (["Three kilometers away, it still bursts his eardrums and burns his left side."], 1.03, 0.0, 0.15, "flow"),
    (["The next day, he takes the train home."], 1.0, 0.0, 0.15, "flow"),
    (["Home... is Nagasaki."], 0.92, -1.0, 0.35, "punch"),
    # Nagasaki, 9 August
    (["August ninth. Still bandaged, he's back at work,", "telling his boss how one bomb destroyed an entire city."], 1.05, 0.0, 0.15, "flow"),
    (["His boss doesn't believe him."], 0.98, 0.0, 0.2, "punch"),
    (["And right then... the same white light fills the room."], 0.93, -0.5, 0.75, "punch"),
    (["The blast throws him to the floor."], 0.98, 0.0, 0.15, "punch"),
    (["He thought the mushroom cloud had followed him from Hiroshima."], 0.98, -0.5, 0.2, "warm"),
    (["And his wife and baby son were somewhere out there."], 0.92, -1.0, 0.4, "warm"),
    (["They were alive."], 0.92, -0.5, 0.15, "punch"),
    (["She'd gone out to find ointment for his burns, and sheltered with the baby in a tunnel."], 0.98, -0.5, 0.25, "warm"),
    (["Across both cities, over a hundred thousand others did not."], 0.93, -2.0, 0.3, "warm"),
    (["Both times, he was three kilometers away."], 1.04, 0.0, 0.08, "flow"),
    (["Close enough to be hurt."], 0.95, 0.0, 0.12, "punch"),
    (["Far enough to live."], 0.93, 0.0, 0.35, "punch"),
    # after
    (["For decades, he barely spoke of it.", "Then cancer took his son, the baby from the tunnel."], 0.95, -1.0, 0.25, "warm"),
    (["So he began to speak out, even at the United Nations."], 1.03, 0.0, 0.15, "flow"),
    (["In two thousand nine, he became the only person officially recognized as surviving both."], 1.0, 0.0, 0.45, "flow"),
    (["His name was Tsutomu Yamaguchi."], 0.9, 0.0, 0.35, "punch"),
    (["He died a year later, at ninety three."], 0.98, -0.5, 0.3, "warm"),
    (["Two atomic bombs. Three days apart."], 0.93, 0.0, 0.15, "punch"),
    (["He survived both... and spent his last years fighting so the world would never see a third."], 0.95, 0.0, 0.0, "warm"),
]
# target speaking rate (words/s) per kind, and the takes: (style row offset, speed factor)
TARGET = {"punch": 3.3, "warm": 3.8, "flow": 4.5}
TAKES = {"punch": [(0, 1.0), (-60, 1.0), (60, 1.0), (120, 1.0), (180, 1.0), (60, 0.95), (0, 1.05)],
         "warm": [(0, 1.0), (-60, 1.0), (60, 1.0), (120, 1.0), (0, 0.96)],
         "flow": [(0, 1.0), (-60, 1.0), (60, 1.0)]}
FIX = {"tsˈuːɾəmˌuː": "tsuːtˈoʊmuː", "jˌæmɐɡˈʌtʃi": "jˌɑːmɑːɡˈuːtʃi", "nˌæɡɐsˈæki": "nˌɑːɡɑːsˈɑːki", "hˈæŋkoʊ": "hˈɑːŋkoʊ"}
SR = 24000

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



def shifted(off):
    n = len(BASE); idx = np.clip(np.arange(n) + off, 0, n - 1)
    return BASE[idx]


def pitch_st(a):
    y = librosa.resample(a.astype(np.float32), orig_sr=SR, target_sr=16000)
    f0, vf, _ = librosa.pyin(y, fmin=65, fmax=300, sr=16000, frame_length=1024, hop_length=256)
    v = f0[np.isfinite(f0)]
    return 12 * np.log2(v / 100) if len(v) > 8 else np.array([0.0])


def synth(text, off, speed):
    ph = K.tokenizer.phonemize(text)
    for x, yv in FIX.items(): ph = ph.replace(x, yv)
    return K.create_timed(ph, voice=shifted(off), speed=speed, is_phonemes=True, sentence_pause=0.11, clause_pause=0.05)


# the narrator's own median pitch (offset 0, neutral pace) over a few passages
ref = np.concatenate([pitch_st(synth(" ".join(p[0]), 0, SPEED * p[1])[0]) for p in PASSAGES[4:7]])
REF_MED = float(np.median(ref))
audio, words, lines, t = [], [], [], 0.06
takes_log = []
audio.append(np.zeros(int(0.06 * SR), np.float32))
for texts, pace, level, gap, kind in PASSAGES:
    text = " ".join(texts); nw = len(text.split())
    best = None
    for off, sf_ in TAKES[kind]:
        a, sr, tm = synth(text, off, SPEED * pace * sf_)
        st = pitch_st(a)
        move = float(np.percentile(st, 90) - np.percentile(st, 10))
        drift = abs(float(np.median(st)) - REF_MED)
        dur = len(a) / SR; rate = nw / max(0.3, dur)
        # same narrator first (a take more than 1.2 semitones off his usual pitch loses), then movement, then pace
        score = move - 20.0 * max(0.0, drift - 1.2) - 1.5 * abs(rate - TARGET[kind]) * (kind != "punch")
        if kind == "punch": score -= 1.0 * max(0.0, rate - 3.9) + 1.0 * max(0.0, 2.3 - rate)
        if best is None or score > best[0]: best = (score, off, sf_, a, tm, move, drift, rate)
    score, off, sf_, a, tm, move, drift, rate = best
    takes_log.append({"text": text, "takes": len(TAKES[kind]), "row_offset": off, "speed": round(SPEED * pace * sf_, 3), "pitch_move_st": round(move, 1),
                      "drift_st": round(drift, 2), "words_per_s": round(rate, 2)})
    print(f"{kind:5s} off {off:+4d} x{sf_:.2f}  move {move:4.1f} st  drift {drift:4.2f}  {rate:4.2f} w/s | {text[:60]}")
    # trim the model's own lead-in / tail silence so only the directed pauses remain
    env = np.abs(a); thr = env.max() * 10 ** (-42 / 20)
    nz = np.nonzero(env > thr)[0]
    lead = max(0, nz[0] - int(0.03 * SR)); tail = min(len(a), nz[-1] + int(0.06 * SR))
    a = a[lead:tail]
    tm = [dataclasses.replace(x, start=x.start - lead / SR, end=x.end - lead / SR) for x in tm]
    ws = words_of(tm, text)
    i = 0
    for line in texts:
        n = len(line.split()); lw = ws[i:i + n]; i += n
        lines.append({"text": line, "s": round(t + lw[0]["s"], 3), "e": round(t + lw[-1]["e"], 3)})
    for w in ws: words.append({"w": w["w"], "s": round(t + w["s"], 3), "e": round(t + w["e"], 3)})
    a = a.astype(np.float32) * 10 ** (level / 20)
    audio.append(a); t += len(a) / SR
    audio.append(np.zeros(int(gap * SR), np.float32)); t += int(gap * SR) / SR
y = np.concatenate(audio)
y = y / max(1e-6, np.abs(y).max()) * 0.89
sf.write(f"{OUT}/voice.wav", y, SR)
json.dump(words, open(f"{OUT}/words.json", "w"), indent=0)
json.dump(lines, open(f"{OUT}/lines.json", "w"), indent=1)
json.dump(takes_log, open(f"{OUT}/takes.json", "w"), indent=1)
print(f"speed {SPEED}: {len(y)/SR:.2f} s, {len(words)} words, last word ends {words[-1]['e']:.2f} s")
