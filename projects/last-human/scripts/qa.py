"""QA for rendered video: per-frame luma stats, black / white / frozen / pop detection, and a contact sheet.

usage: python -I qa.py <video.mp4> <out_prefix> [every_n=6]
"""
import subprocess
import sys

import numpy as np
from PIL import Image

src, prefix = sys.argv[1], sys.argv[2]
every = int(sys.argv[3]) if len(sys.argv) > 3 else 6
W, H = 108, 192
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                     capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).astype(np.float32) / 255
n = len(fr)
luma = (fr * [0.2126, 0.7152, 0.0722]).sum(-1)
mean = luma.mean((1, 2))
diff = np.abs(np.diff(luma, axis=0)).mean((1, 2))
issues = []
for i in range(n):
    if mean[i] < 0.012:
        issues.append((i, "black"))
    if mean[i] > 0.9:
        issues.append((i, "white"))
run = 0
for i, d in enumerate(diff):
    run = run + 1 if d < 0.0008 else 0
    if run == 12:
        issues.append((i - 11, "frozen 12+ frames"))
med = np.median(diff) if len(diff) else 0
for i, d in enumerate(diff):
    if d > max(0.08, med * 12):
        issues.append((i + 1, f"pop {d:.3f}"))
print(f"{src}: {n} frames, mean luma {mean.mean():.3f} (min {mean.min():.3f}, max {mean.max():.3f}), median motion {med:.4f}")
for i, what in issues:
    print(f"  frame {i}: {what}")
# contact sheet
idx = list(range(0, n, every))
cols = 10
rows = (len(idx) + cols - 1) // cols
tw, th = 162, 288
sheet = Image.new("RGB", (cols * tw, rows * th))
full = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vf", f"select='not(mod(n\\,{every}))',scale={tw}:{th}", "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                      capture_output=True, check=True).stdout
thumbs = np.frombuffer(full, np.uint8).reshape(-1, th, tw, 3)
for k, t in enumerate(thumbs):
    sheet.paste(Image.fromarray(t), ((k % cols) * tw, (k // cols) * th))
sheet.save(prefix + "_sheet.jpg", quality=85)
