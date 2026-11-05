"""Narration for "Home Was Nagasaki" v4: Kokoro TTS, one narrator (am_fenrir) throughout, unprocessed.
v3 blended other voices in per line and pitch-shifted them, which made the narrator sound processed and unsteady.
v4 keeps one voice and lets the tone move the way a person's does: passages are spoken in one breath (several
sentences per call, so the intonation flows across them), the pace moves gently with the story (about +-10 %), quiet
passages are spoken a little softer, and the punctuation carries the emphasis. Per-phoneme durations
(kokoro-dur.onnx) give word timings -> voice.wav + words.json [{w, s, e}] + lines.json [{text, s, e}].
Usage: python tts.py <speed> <out_dir>"""
import json, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

SPEED = float(sys.argv[1]) if len(sys.argv) > 1 else 1.31
OUT = sys.argv[2] if len(sys.argv) > 2 else "."
K = Kokoro("/home/user/tts/kokoro-dur.onnx", "/home/user/tts/voices-v1.0.bin")
VOICE = "am_fenrir"
# passages: (lines spoken together, pace, level dB, pause after in s). The lines keep their text from v3 (the picture
# re-timing pairs words line by line), only the delivery changes.
PASSAGES = [
    (["This man survived the atomic bomb on Hiroshima!", "Then he hopped on a train to get away from it all..."], 1.02, 0.0, 0.18),
    (["Straight to Nagasaki."], 0.92, -1.0, 0.55),
    (["It's August nineteen forty five, and ship designer Tsutomu Yamaguchi is wrapping up a work trip in Hiroshima.",
      "He's packed and ready to go home to his wife and baby son, when he realizes he forgot his hanko!",
      "That's his official name stamp, so he heads back to the shipyard to get it."], 1.02, 0.0, 0.2),
    (["At a quarter past eight, he looks up at a plane and sees two tiny parachutes drifting down."], 0.95, -1.5, 0.3),
    (["Then... the whole sky turns white."], 0.9, -1.0, 0.6),
    (["He's three kilometers away, and it still bursts his eardrums and burns his whole left side.",
      "After a night in a shelter, he does the sensible thing and catches a train home."], 1.01, 0.0, 0.3),
    (["Home is Nagasaki."], 0.92, -1.0, 0.45),
    (["Two days later, wrapped in bandages, he goes back to work, because of course he does.",
      "He tells his boss that one single bomb destroyed an entire city.",
      "His boss says that's crazy.", "No bomb could ever do that."], 1.02, 0.0, 0.35),
    (["And right then... the same white light fills the room."], 0.92, -0.5, 0.6),
    (["He later said he thought the mushroom cloud had followed him from Hiroshima."], 0.97, -0.5, 0.3),
    (["Those two bombs killed well over a hundred thousand people, and somehow, he survived both."], 0.9, -2.0, 0.4),
    (["You see, both times, he was about three kilometers from the center, and distance is everything.",
      "Ever sat by a campfire?", "Lean in close, and it scorches your face!", "Take a few steps back, and it's just warm.",
      "The heat spreads out in every direction, so every time you double the distance, only a quarter of it reaches you."], 1.0, 0.0, 0.3),
    (["Three kilometers was close enough to hurt him, but far enough to let him live.",
      "His wife and son survived too, sheltering in a tunnel."], 0.96, -0.5, 0.25),
    (["In two thousand nine, he became the only person officially recognized as surviving both bombs.",
      "He spent his last years asking the world never to build another one."], 0.95, -0.5, 0.35),
    (["Two atomic bombs. Three days apart. And Tsutomu Yamaguchi still lived to be ninety three."], 0.93, 0.0, 0.0),
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
