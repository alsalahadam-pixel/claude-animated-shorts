# Build the v3 review sheets (before/after comparisons, entity design) from rendered stills.
# usage: python scripts/review_sheets.py   (reads out/ref, out/sb4, out/v3, out/v4; writes review_v3/)
import os
from PIL import Image, ImageDraw, ImageFont

OUT = "review_v3"
os.makedirs(OUT, exist_ok=True)
FD = "/usr/share/fonts/truetype/jetbrains-mono/"
BG, INK, ORANGE, DIM, RED, GREEN = (22, 23, 42), (242, 239, 233), (255, 179, 92), (150, 150, 180), (255, 110, 110), (120, 230, 170)


def font(px, w="Medium"):
    return ImageFont.truetype(FD + f"JetBrainsMono-{w}.ttf", px)


def fit(path, h):
    im = Image.open(path).convert("RGB")
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def wrap(d, xy, text, fnt, width, fill, lh=30):
    x, y = xy
    line = ""
    for word in text.split():
        t = (line + " " + word).strip()
        if d.textlength(t, font=fnt) > width and line:
            d.text((x, y), line, font=fnt, fill=fill); y += lh; line = word
        else:
            line = t
    if line: d.text((x, y), line, font=fnt, fill=fill)


def header(d, W, title, sub):
    d.text((40, 30), title, font=font(46, "Bold"), fill=INK)
    d.text((40, 92), sub, font=font(26), fill=DIM)


def pairs_sheet(name, title, sub, items, cols=2, h=720):
    """items: (label, note, before_path, after_path)"""
    fw = round(h * 540 / 960)
    gap, pad = 14, 40
    cw = 2 * fw + gap
    W = pad * 2 + cols * cw + (cols - 1) * 60
    rows = (len(items) + cols - 1) // cols
    rh = 70 + h + 90
    H = 150 + rows * rh + 20
    s = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(s)
    header(d, W, title, sub)
    for i, (label, note, b, a) in enumerate(items):
        x = pad + (i % cols) * (cw + 60)
        y = 150 + (i // cols) * rh
        d.text((x, y), label, font=font(30, "Bold"), fill=ORANGE)
        for j, (p, tag, col) in enumerate(((b, "BEFORE", RED), (a, "AFTER", GREEN))):
            im = fit(p, h)
            s.paste(im, (x + j * (fw + gap), y + 48))
            d.rectangle((x + j * (fw + gap), y + 48, x + j * (fw + gap) + 118, y + 84), fill=(0, 0, 0))
            d.text((x + j * (fw + gap) + 10, y + 52), tag, font=font(24, "Bold"), fill=col)
        wrap(d, (x, y + 48 + h + 12), note, font(22), cw, INK)
    s.save(f"{OUT}/{name}.jpg", quality=90)
    print(name, s.size)


# 1 — character reference, before vs after
b, a = Image.open("out/ref/before_0.jpg").convert("RGB"), Image.open("out/ref/v4_0.jpg").convert("RGB")
w = 1080
b, a = b.resize((w, round(b.height * w / b.width))), a.resize((w, round(a.height * w / a.width)))
s = Image.new("RGB", (2 * w + 60 + 40, 150 + a.height + 30), BG)
d = ImageDraw.Draw(s)
header(d, s.width, "Protagonist reference: before / after", "Same character, same renderer as the film. Nose, hands, sleeves, shoes and the walk were rebuilt.")
s.paste(b, (40, 150)); s.paste(a, (40 + w + 20, 150))
for x, t, c in ((40, "BEFORE", RED), (40 + w + 20, "AFTER", GREEN)):
    d.rectangle((x, 150, x + 130, 192), fill=(0, 0, 0)); d.text((x + 12, 156), t, font=font(28, "Bold"), fill=c)
s.save(f"{OUT}/1_reference_before_after.jpg", quality=90)
a_full = Image.open("out/ref/v4_0.jpg").convert("RGB"); a_full.save(f"{OUT}/1_reference_corrected.jpg", quality=92)
print("1", s.size)

# 2 — anatomy in context
pairs_sheet("2_anatomy_in_context", "Arms, hands and face in the film: before / after",
            "Frames from the actual shots (half resolution).", [
    ("S13 · hand on the glass", "Was a stiff straight 'zombie' arm. Now he steps in, elbow bent, palm flat on the glass.", "out/sb4/f_960.jpg", "out/v3/f_960.jpg"),
    ("S16 · locking the chain", "Was an arm folded over the head. Now: one hand braced on the door, the other drags the chain.", "out/sb4/f_1335.jpg", "out/v4/f_1336.jpg"),
    ("S17 · holding the phone", "Was the screen facing us, one floating hand. Now both hands grip it, fingers round the back.", "out/sb4/f_1420.jpg", "out/v4/f_1420.jpg"),
    ("S19 · the turned face", "Nose now sits between the eyes in 3/4 view; same shape in every shot. Caption moved off the face.", "out/sb4/f_1615.jpg", "out/v4/f_1625.jpg"),
])

# 3 — camera
pairs_sheet("3_camera_before_after", "Camera: before / after", "Shot sizes and angles chosen per beat, foreground depth, no random moves.", [
    ("S12 · the walk to the glass", "Foreground bollard and a lower lens: depth, and the street feels long and empty.", "out/sb4/f_890.jpg", "out/v3/f_880.jpg"),
    ("S13 · the mirror test", "Profile two-shot: his hand and its hand meet exactly on the glass line.", "out/sb4/f_960.jpg", "out/v3/f_960.jpg"),
    ("S20 · the bed", "Was a flat medium shot of a double sitting up. Now his eye line, low from the floor by the door: something too tall unfolds out of the bed against the window.", "out/sb4/f_1730.jpg", "out/v3/f_1745.jpg"),
    ("S21 · the last shot", "Was his smiling face. Now the entity, close, eyes on us: then a hard cut to black.", "out/sb4/f_1795.jpg", "out/v3/f_1795.jpg"),
])

# 4 — entity design + where it appears
ent = Image.open("out/ref/entity_0.jpg").convert("RGB").crop((0, 80, 2160, 1620))
W = 2160
s = Image.new("RGB", (W, 150 + ent.height + 40 + 70 + 760 + 120), BG)
d = ImageDraw.Draw(s)
header(d, W, "The entity: the original design, unchanged", "The figure from the first cut's final seconds: dark, too tall, too thin, white eyes, a long grin. Only it smiles.")
s.paste(ent, (0, 150))
y = 150 + ent.height + 40
d.text((40, y), "Where it appears in the film", font=font(34, "Bold"), fill=ORANGE)
y += 60
row = [
    ("S06 · 0:14", "far down the avenue", "inset430"),
    ("S15 · 0:39", "his reflection", "out/v4/f_1190.jpg"),
    ("S15 · 0:40", "goes black", "out/v4/f_1206.jpg"),
    ("S15 · 0:40", "becomes it", "out/v4/f_1214.jpg"),
    ("S15 · 0:43", "the grin", "out/v4/f_1300.jpg"),
    ("S20 · 0:58", "rises from his bed", "out/v3/f_1745.jpg"),
    ("S21 · 0:59", "looks at us", "out/v3/f_1795.jpg"),
]
h = 500
fw = round(h * 540 / 960)
gap = (W - 80 - len(row) * fw) // (len(row) - 1)
for i, (t, n, p) in enumerate(row):
    x = 40 + i * (fw + gap)
    if p == "inset430":
        im = Image.open("out/v3/f_430.jpg").convert("RGB")
        crop = im.crop((196, 345, 296, 523)).resize((fw, h), Image.LANCZOS)
        s.paste(crop, (x, y))
        small = im.resize((round(fw * 0.42), round(h * 0.42)))
        s.paste(small, (x + fw - small.width - 6, y + h - small.height - 6))
        dd = ImageDraw.Draw(s)
        bx = x + fw - small.width - 6
        by = y + h - small.height - 6
        k = small.width / im.width
        dd.rectangle((bx + 196 * k, by + 345 * k, bx + 296 * k, by + 523 * k), outline=ORANGE, width=2)
    else:
        s.paste(fit(p, h), (x, y))
    d.text((x, y + h + 10), t, font=font(24, "Bold"), fill=ORANGE)
    d.text((x, y + h + 42), n, font=font(22), fill=INK)
s = s.crop((0, 0, W, y + h + 90))
s.save(f"{OUT}/4_entity.jpg", quality=90)
print("4", s.size)
