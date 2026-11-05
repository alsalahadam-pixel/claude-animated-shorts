"""Narration for "Home Was Nagasaki" v2 edit (cold open, ~75 s). Same delivery as the v4 narration: Kokoro TTS, one narrator (am_fenrir) throughout, unprocessed.
v3 blended other voices in per line and pitch-shifted them, which made the narrator sound processed and unsteady.
v4 keeps one voice and lets the tone move the way a person's does: passages are spoken in one breath (several
sentences per call, so the intonation flows across them), the pace moves gently with the story (about +-10 %), quiet
passages are spoken a little softer, and the punctuation carries the emphasis. Per-phoneme durations
(kokoro-dur.onnx) give word timings -> voice.wav + words.json [{w, s, e}] + lines.json [{text, s, e}].
Usage: python tts.py <speed> <out_dir>"""
import json, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

SPEED = float(sys.argv[1]) if len(sys.argv) > 1 else 1.38
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
K = Kokoro("/home/user/tts/kokoro-dur.onnx", "/home/user/tts/voices-v1.0.bin")
VOICE = "am_fenrir"
# passages: (lines spoken together, pace, level dB, pause after in s). The lines keep their text from v3 (the picture
# re-timing pairs words line by line), only the delivery changes.
PASSAGES = [
    # cold open: the second flash first, then rewind
    (["This man is about to survive an atomic bomb..."], 1.0, 0.0, 0.62),
    (["For the second time."], 0.9, -0.5, 0.38),
    (["Rewind three days."], 1.0, -0.5, 0.42),
    # Hiroshima
    (["August sixth, nineteen forty five.", "Ship designer Tsutomu Yamaguchi is finishing a work trip in Hiroshima.",
      "Today, he's finally going home, to his wife Hisako and their baby boy."], 1.02, 0.0, 0.2),
    (["But he forgot his hanko, his name stamp, and turns back for it."], 1.04, 0.0, 0.28),
    (["Eight fifteen."], 0.95, -0.5, 0.22),
    (["A plane flies over, and two small parachutes drift down."], 0.95, -1.0, 0.25),
    (["Then... the sky turns white."], 0.88, -1.0, 0.95),
    (["Three kilometers away, the blast still bursts his eardrums and burns his left side.",
      "He spends the night in a shelter, then catches a train home."], 1.02, 0.0, 0.22),
    (["Home... is Nagasaki."], 0.9, -1.0, 0.5),
    # Nagasaki
    (["On August ninth, still in bandages, he goes back to work.", "He tells his boss one bomb destroyed an entire city.",
      "His boss doesn't believe him."], 1.03, 0.0, 0.25),
    (["And right then... the same white light fills the room."], 0.92, -0.5, 0.85),
    (["The blast throws him to the floor.",
      "He later said he thought the mushroom cloud had followed him from Hiroshima."], 0.98, 0.0, 0.32),
    (["And his wife and baby son were somewhere in that city."], 0.95, -0.5, 0.38),
    (["They survived, sheltering in a tunnel."], 0.97, 0.0, 0.32),
    (["But together, the two bombs killed well over a hundred thousand people."], 0.9, -2.0, 0.45),
    (["Both times, he was about three kilometers from the center.", "Close enough to be hurt.", "Far enough to live."], 0.97, 0.0, 0.38),
    # after
    (["Late in life, he finally told the world his story.",
      "In two thousand nine, he became the only person officially recognized as surviving both bombs.",
      "He died the following year, at ninety three."], 0.98, -0.5, 0.38),
    (["Two atomic bombs. Three days apart.",
      "And the man who survived both spent his last years asking that there never be a third."], 0.92, 0.0, 0.0),
]
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


audio, words, lines, t = [], [], [], 0.06
audio.append(np.zeros(int(0.06 * SR), np.float32))
for texts, pace, level, gap in PASSAGES:
    text = " ".join(texts)
    ph = K.tokenizer.phonemize(text)
    for a, b in FIX.items(): ph = ph.replace(a, b)
    a, sr, tm = K.create_timed(ph, voice=VOICE, speed=SPEED * pace, is_phonemes=True, sentence_pause=0.16, clause_pause=0.07)
    assert sr == SR
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
print(f"speed {SPEED}: {len(y)/SR:.2f} s, {len(words)} words, last word ends {words[-1]['e']:.2f} s")
