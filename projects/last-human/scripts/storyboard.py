"""Lay storyboard stills out on labelled sheets. usage: python -I storyboard.py <stills dir> <out prefix>"""
import sys
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
B = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
R = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 17)
# frame, shot, beat
PANELS = [
    (30, "S01  0:00-0:04.8", "Camera turns to an empty spot"), (120, "S01", "...and he walks into it"),
    (190, "S02  0:04.8-0:07.2", "Day 1: eyes snap open"), (245, "S03  0:07.2-0:08.9", "Jolts upright; dust hangs frozen"),
    (290, "S04  0:08.9-0:11.4", "Palm on glass: HELLO?!"), (380, "S05  0:11.4-0:13.4", "\"I haven't slept since.\""),
    (430, "S06  0:13.4-0:15.0", "Day 2: pigeon frozen mid-air"), (490, "S07  0:15.0-0:18.2", "Fingers through frozen steam"),
    (570, "S08  0:18.2-0:19.7", "Red light, clock 06:12"), (615, "S09  0:19.7-0:24.8", "Step left: it follows"),
    (700, "S09", "Step right: it follows"), (790, "S10  0:24.8-0:27.1", "Every camera turns"),
    (835, "S11  0:27.1-0:28.3", "His face, looking up"), (890, "S12  0:28.3-0:30.6", "Reflection walks in sync"),
    (960, "S13  0:30.6-0:35.4", "Mirror test: hand raised"), (1050, "S13", "Lean: it lags 14 frames"),
    (1110, "S14  0:35.4-0:38.4", "It takes one more step"), (1148, "S14", "It turns to us on its own"),
    (1250, "S15  0:38.4-0:43.7", "His face. Smiling. \"Practising.\""), (1335, "S16  0:43.7-0:45.9", "The chain goes on"),
    (1370, "S16", "Slides down the door"), (1420, "S17  0:45.9-0:47.9", "The phone lights up"),
    (1540, "S18  0:47.9-0:52.1", "From: Me. Him, asleep."), (1615, "S19  0:52.1-0:54.5", "He looks toward the bed"),
    (1660, "S20  0:54.5-0:58.3", "The duvet breathes"), (1730, "S20", "It sits up, slowly"),
    (1795, "S21  0:58.3-1:00.0", "His face. Hard cut to black."), (1860, "END  1:00.0-1:02.5", "Black, silence, then PART 2?"),
]
W, H, PAD, TXT, COLS, ROWS = 360, 640, 14, 64, 4, 2
per = COLS * ROWS
for s in range(0, len(PANELS), per):
    group = PANELS[s:s + per]
    sheet = Image.new("RGB", (COLS * (W + PAD) + PAD, ROWS * (H + TXT + PAD) + PAD), "#111018")
    d = ImageDraw.Draw(sheet)
    for i, (f, shot, beat) in enumerate(group):
        x = PAD + (i % COLS) * (W + PAD); y = PAD + (i // COLS) * (H + TXT + PAD)
        sheet.paste(Image.open(f"{src}/f_{f}.jpg").resize((W, H)), (x, y))
        d.text((x, y + H + 6), shot, font=B, fill="#ffb35c")
        d.text((x, y + H + 36), beat, font=R, fill="#e8e6ee")
    sheet.save(f"{out}_{s // per + 1}.jpg", quality=88)
    print(f"{out}_{s // per + 1}.jpg")
