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
    ("S20 · the bed", "Was a flat wide of a double of him. Now his eye line from the floor by the door; a slow zoom follows a stranger, a woman, as she sits up and looks at him.", "out/sb4/f_1730.jpg", "out/v5/f_1746.jpg"),
    ("S21 · the last shot", "Was his smiling face. Now the entity, separately, beside the bed: eyes open, a slow zoom, its grin. Hard cut to black.", "out/sb4/f_1795.jpg", "out/v5/f_1799.jpg"),
])

# 4 — entity design + where it appears
ent = Image.open("out/ref/EntityRef_0.jpg").convert("RGB").crop((0, 80, 2160, 1620))
W = 2160
s = Image.new("RGB", (W, 150 + ent.height + 40 + 70 + 760 + 120), BG)
d = ImageDraw.Draw(s)
header(d, W, "The entity (the devil): the original design, unchanged", "Dark, too tall, too thin, white eyes, a long grin. Not the woman in the bed, and not him. Only it ever smiles.")
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
    ("S21 · 0:58", "beside the bed", "out/v5/f_1750.jpg"),
    ("S21 · 1:00", "looks at us, grins", "out/v5/f_1799.jpg"),
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


# 5 — the woman in the bed: reference
Image.open("out/ref/SleeperRef_0.jpg").convert("RGB").save(f"{OUT}/5_woman_in_the_bed_reference.jpg", quality=92)

# 6 — storyboard S18 / S20 / S21
panels = [
    ("S18", 1545, "51.5", "The photo from \"Me\": someone asleep in his bed, turned to the wall. No face. He assumes it's him."),
    ("S20", 1650, "55.0", "His eye line from the floor. The duvet breathes; the lump shifts. Someone is under there."),
    ("S20", 1680, "56.0", "A head lifts off the pillow. Eyes open, heavy with sleep. Slow zoom begins."),
    ("S20", 1696, "56.5", "Up on her elbows, hands pushing on the mattress. A beat."),
    ("S20", 1714, "57.1", "She pushes up; hair falls forward; the duvet slides to her waist. Breathing."),
    ("S20", 1736, "57.9", "Sitting. Her eyes find him first, then her head turns, with a slow, human blink."),
    ("S20", 1746, "58.2", "A stranger, a woman, in his bed, staring at him. Not him, not the entity."),
    ("S21", 1750, "58.3", "CUT WIDE. Beside the bed, by the window, where the photo was taken from: the entity. She doesn't see it."),
    ("S21", 1759, "58.6", "Its eyes snap open (2 frames), a 3-frame push-in. Focus racks from her to it."),
    ("S21", 1776, "59.2", "A slow zoom isolates it. She leaves frame. The grin starts to spread."),
    ("S21", 1799, "60.0", "Full grin, eyes on us. HARD CUT TO BLACK, all sound cut. Then silence and PART 2?"),
]
h = 600
fw = round(h * 540 / 960)
gap, pad, per_row = 18, 40, 6
rows = (len(panels) + per_row - 1) // per_row
W = pad * 2 + per_row * fw + (per_row - 1) * gap
rh = 40 + h + 200
s = Image.new("RGB", (W, 150 + rows * rh), BG)
d = ImageDraw.Draw(s)
header(d, W, "Storyboard: S18 · S20 · S21 (revised)", "Three different beings: him (on the floor), a woman in his bed (human), the entity beside the bed (not her).")
for i, (shot, fr, t, note) in enumerate(panels):
    x = pad + (i % per_row) * (fw + gap)
    y = 150 + (i // per_row) * rh
    d.text((x, y), f"{shot} · {t} s", font=font(26, "Bold"), fill=ORANGE)
    s.paste(fit(f"out/v5/f_{fr}.jpg", h), (x, y + 38))
    wrap(d, (x, y + 38 + h + 10), note, font(20), fw, INK, lh=26)
s.save(f"{OUT}/6_storyboard_S18_S20_S21.jpg", quality=90)
print("6", s.size)
