# THE LAST TRAIN — Generation Guide (Stage 5 handoff)

This is everything needed to turn the storyboard into footage with consistent characters. The per-shot prompts are in `05_ep01_storyboard.md` (the **GEN** line under each shot). This file holds the blocks those prompts depend on.

## Three production routes

| Route | Quality ceiling | Consistency | Cost and time | Use it for |
|---|---|---|---|---|
| **1. AI image-to-video** (any tool that accepts reference images and first/last frames) | High, when keyframes are strong | Medium. Needs the workflow below and strict QC. | Low money, high iteration | Fastest path to a publishable episode |
| **2. Full 3D** (Blender: modelled, rigged characters animated to the storyboard) | Highest | Perfect, because the same model is used every shot | High: a modeller and animator, weeks per episode | The long-term series once it has an audience |
| **3. Previz animatic** (this repo's three.js + Remotion pipeline) | Blockout only | Perfect | Low, and can be rendered in this repo | Locking timing, camera, and the sound mix **before** paying for generation |

**Recommended:** route 3 first (lock the 88-second cut and sound), then route 1 shot by shot over the locked animatic. Move to route 2 if the series takes off.

---

## STYLE block (prepend to every image and video prompt)

```
Premium stylized 3D animated series, cinematic feature-animation quality. Sculpted stylized
characters with slightly enlarged eyes and hands, simplified facial planes, painterly
hand-painted textures with visible brushwork on walls and tiles, subsurface skin, expressive
faces. Cinematic lighting: cold cyan-white fluorescent and deep emergency red, volumetric haze,
drifting dust particles, dramatic shadows, anamorphic shallow depth of field, subtle film
grain. Vertical 9:16 composition, strong foreground depth. Underground metro horror atmosphere.
```

## NEGATIVE block

```
photorealistic, live action, real photo, 2D, flat cel shading, anime, chibi, cartoon toy,
plastic look, low poly, video game graphics, oversaturated, neon gore, splatter, dismemberment,
extra fingers, deformed hands, warped faces, text, letters, signage text, logo, watermark,
subtitles, real transit branding
```

---

## Character reference prompts (make model sheets FIRST)

Generate each as a **turnaround sheet** (front / three-quarter / side / back, neutral grey background, even light), then a **6-expression sheet**. Pick the best result and **lock it**. Keep its seed and attach those images as references to every shot that character appears in.

### KAI
```
Character turnaround sheet of KAI, a 23-year-old man, lean, 175 cm, warm brown skin, tight
black curls longer on top with short faded sides and one curl falling on his forehead, strong
dark eyebrows with a small pale scar through his LEFT eyebrow, dark brown eyes, slight overbite,
round thin gold-wire glasses with white athletic tape wrapped on the LEFT hinge. Bright
orange hi-vis vest with two horizontal silver reflective bands, "STAFF" on the back, small name
badge on RIGHT chest, black two-way radio clipped on LEFT chest strap, charcoal hoodie
underneath with hood down, navy work trousers, scuffed white sneakers with one orange lace on the
LEFT shoe, retractable key reel with many keys on the RIGHT hip. Front, three-quarter, side,
back views, neutral grey background.
```
Expressions: forced polite smile · frozen terror (breath held) · panicked fumble · teary jaw-clench · whispering tenderness · pleading look into the camera.

### WREN
```
Character turnaround sheet of WREN, a small 9-year-old girl, pale skin with freckles across her
nose, large grey-green eyes, straight dark brows, small serious mouth, straight copper-auburn bob
slightly uneven, small brass hair clip shaped like a wren bird on the RIGHT side. Oversized
heather-grey metro staff fleece reaching her knees with sleeves rolled up four times, black
leggings, mustard-yellow rain boots, white bandage on her LEFT wrist. Calm, watchful expression.
Front, three-quarter, side, back views, neutral grey background.
```
Expressions: calm stare · finger to lips "shh" · the lie ("…Nobody") · scream (Ep 2A only) · quiet tears · tiny trusting smile.

### TOMAS, "the Tall Man" (two sheets: human and Stiller)
```
Character turnaround sheet of TOMAS, a very tall gangly 38-year-old man, 196 cm, long arms,
salt-and-pepper short beard, kind tired eyes, long navy train operator's coat to mid-calf,
navy metro driver's cap with a brass badge, name badge on LEFT chest. Front, three-quarter,
side, back, neutral grey background.
```
Stiller variant: add *"infected: grey-green skin, dark vein webbing spreading from a bite on his RIGHT forearm up to his neck, milky eyes with pinprick pupils, thin dark blood trails from both ears, jaw slack, cap still on."*
Silhouette test: the black-filled figure must read as *tall + cap + long coat*.

### RUTH
```
Character turnaround sheet of RUTH, a sturdy 58-year-old woman, 165 cm, deep brown skin, broad
cheekbones, laugh lines, short grey locs tied back, reading glasses on a green-and-gold beaded
chain, navy supervisor blazer with a red lanyard and keycard, white shirt, black boots, upright
ex-military posture. Front, three-quarter, side, back, neutral grey background.
```

### THE COMMUTER (infected)
```
Infected woman in her 30s, camel wool coat, one high heel missing so she stands lopsided,
wired earbud in one ear, phone in her limp hand, grey-green skin, dark vein webbing, milky eyes
with pinprick pupils, thin dark blood trail from her ears down her neck, jaw working silently.
Turnaround, neutral grey background, stylized 3D, restrained horror.
```

### THE NIGHT RUNNER (infected)
```
Infected lean young man in a reflective running jacket with silver stripes, headphones around
his neck, a fitness watch with a flashing screen, grey-green skin, vein webbing, milky eyes,
blood trails from the ears, crouched predatory sprinting pose. Turnaround, neutral grey
background, stylized 3D.
```

### THE BUSKER (infected)
```
Infected old man with a battered sticker-covered guitar case strapped to his back, one snapped
guitar string curling out, shabby coat, grey-green skin, milky eyes, ear blood trails, slow
heavy shuffling pose. Turnaround, neutral grey background, stylized 3D.
```

---

## Environment reference prompts (make these before any shot, then reuse)

1. **Platform 2:** *underground metro platform at night, cream bevelled wall tiles with a deep teal enamel band and brass trim at shoulder height, vaulted tiled ceiling, cable trays, an electronic departure board, benches, a stopped train with violet stripe, cold cyan-white fluorescent tubes, haze.*
2. **Carriage interior:** *metro carriage interior, steel grab poles, violet patterned seat fabric, blank ad panels, black windows reflecting the interior, fluorescent ceiling tubes, ceiling speaker grille.*
3. **Escalator:** *long stopped escalator between levels, steel treads, white balustrade light strips, abandoned stroller and dropped bouquet, red emergency lighting.*
4. **Mezzanine corridor:** *60-metre low-ceiling tiled corridor, vending machine, fallen wet-floor sign, steel staff door with wire-glass window midway on one wall, a short stair and descending steel security shutter at the far end with amber strobes.*
5. **Signal equipment room:** *small dark room full of signal equipment racks, blinking blue and green LEDs, cables, a single high window, deep shadows.*
6. **Ticket hall (Ep 2B):** *metro ticket hall, ticket gates, ticket office with a wall of CCTV monitors, tall glass doors to a rainy street, sodium-amber light through rain-streaked glass.*
7. **Halloran Square (Ep 2B):** *city square at night in heavy rain, sodium streetlamps, wet reflective asphalt, crowds of people standing perfectly still all facing camera.*

**Original signage only:** a circle split by a diagonal bar, white condensed caps on teal enamel. Never a real network's roundel, colours or typeface.

---

## Consistency workflow (per shot)

1. **Keyframe first.** Generate the shot's **first frame** as a still: STYLE block + the shot's GEN line + the character reference images + the environment reference. For camera moves, also generate the **last frame**.
2. **Check the keyframe against the LOCK list** (`03_character_bible.md`). Pay attention to side-specific details: taped LEFT hinge, LEFT eyebrow scar, radio on the LEFT chest, key reel on the RIGHT hip, Wren's clip on the RIGHT and bandage on the LEFT. If the generator mirrors the image, flip it back or regenerate.
3. **Animate** the keyframe (image-to-video, or first-plus-last frame). Keep each generation ≤ 5 s. Describe *only the motion* in the video prompt (camera move plus character action) so the look isn't re-invented.
4. **Generate 3–4 takes**, keep the best, and log seed and take in a shot tracker.
5. **No text from the generator.** Composite every sign, board row, phone screen and the door warning in post (motion-tracked).
6. **Unify in post:** apply one colour grade (LUT) to all clips, add the same grain and haze overlay, and match black levels. Differences between generations disappear under a shared finish.
7. **Bolter "stutter" motion:** if the generator smooths it out, create it in the edit by holding 2 frames and dropping 2 frames in a rhythm. Keep the pattern identical for every Bolter so it reads as deliberate, not as a glitch.

## Voice

- **Best:** cast human actors (Kai: soft mid-baritone, 20s, natural. Wren: real child actor, whisper delivery. Ruth: deep alto, Nigerian-British. Lucy: real child, phone-quality. PA and Control: calm, neutral female).
- **If synthetic:** use an expressive voice model, direct **each line separately** with emotion notes from the screenplay, record whispers as whispers (not quiet speech), and add breaths and mouth noise back in. Never generate the whole script in one pass. That is what produces "robotic AI narration".
- Record all VO close-mic, dry. Reverb and phone/radio treatment are added in the mix.

## Shot tracker template

| Shot | Keyframe OK | Take | Seed | LOCK check | Text comp | Graded | Notes |
|---|---|---|---|---|---|---|---|
| S1 | ☐ | | | ☐ | n/a | ☐ | |
| … | | | | | | | |
