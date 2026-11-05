# contact sheet: python scripts/sheet.py out.jpg img1 img2 ... (rows of up to 4, half size)
import sys
from PIL import Image
out, fs = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGB") for f in fs]
w, h = ims[0].size; n = min(4, len(ims)); rows = (len(ims) + n - 1) // n
s = Image.new("RGB", (w * n, h * rows), "white")
for i, im in enumerate(ims): s.paste(im.resize((w, h)), ((i % n) * w, (i // n) * h))
s.save(out, quality=82)
