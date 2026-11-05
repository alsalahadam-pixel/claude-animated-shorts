# THE LAST TRAIN — Quality Control (Stage 7)

Two parts: **(1)** the review already done on the script and storyboard, with every fix applied to the files, and **(2)** the checklist for reviewing generated footage before release.

---

## Part 1: Script and storyboard review (completed)

### Problems found and fixed

| # | Area | Problem in draft | Fix applied |
|---|---|---|---|
| 1 | **Hook** | The draft opened on a narrated line close to the brief's example ("every train stopped…"). That isn't original, and it's words, not picture. | Replaced with an image-led hook: doors open on a carriage of still, turned-away passengers. "Nobody got off" lands at 0:04, but the image is strange from frame 1. |
| 2 | **Infection logic** | Kai *called out* "Last stop, folks!" with no reaction, but the radio triggered everyone 16 s later. The rules contradicted themselves. | Set the **rule of two** (soft sound → twitch, sharp sound → orient, second sound → bolt, and only *new* sounds count). Kai's line is now routine and quiet. Every sound in Ep 1 and both Ep 2 branches was re-checked against it. |
| 3 | **Time logic** | The pack reached the mezzanine at 1:00 but never arrived by 1:28, with no reason given. | The pack now **halts and searches** (they lost his sound), orients on the keys, creeps forward on the ringtone, and is coiled one sound away at the vote. The final CLANK *is* that sound. |
| 4 | **Plausibility** | How did a 9-year-old survive an hour locked in with her infected father? | New hidden rule: **the infected ignore Wren** (immunity, revealed in Ep 6). Seeded in both Ep 2 branches when Tomas calms at her touch. |
| 5 | **Canon conflict** | The draft line "My dad locked me in" contradicted the canon (Ruth chained the door) and wasted a clue. | Changed to **"A lady locked *us* in." / "…Us?" / "…Me. Just me."** This plants both Ruth and the hidden father. |
| 6 | **Board continuity** | S14 flipped the *bottom* row to STATION CLOSING, which was the row holding the `0417` clue. | STATION CLOSING now appears in the header line, and the 0417 row stays lit. |
| 7 | **Dialogue density** | Ruth's radio speech was 28 words in 6 s (4.7 words/s, too fast to land). The PA was 19 words in 4 s. | Ruth is down to 16 words. The PA was trimmed to 15 words and extended under S8 (about 2.6 words/s). Kai's intro VO was trimmed to 11 words with an L-cut. |
| 8 | **Breathing room** | Wren's name exchange crowded S21. | Moved to S23, where it plays as Kai babbling while he fumbles the keys, which is more natural. S21 now breathes for 5 s. |
| 9 | **Vote balance (B)** | "Leave her and run" read as plain cowardice, an easy A win. | B became **"Run for the shutter"**, backed by Lucy's voicemail ("someone's knocking") and the glowing "LUCY CALLING" in the B panel. B is now loyalty, not selfishness. |
| 10 | **Vote balance (A)** | Opening the door was the obvious "good" answer. | Added the warning ("NO MATTER WHAT SHE SAYS"), the "us" slip, the tall silhouette, Wren's lie "…Nobody", and the pack one sound away. A is now a real risk. |
| 11 | **Props** | Kai carried mop plus coffee. Two props means more continuity risk, and a dropped cup would be an unplanned trigger sound. | Coffee removed. The mop stays and pays off as the door bar in Ep 2A. |
| 12 | **Camera variety** | Three back-to-back lens repeats (S5/S6 85 mm, S12/S13 35 mm, S20/S21 50 mm). | S6 → 75 mm, S13 → 40 mm, S20 → 65 mm. A script check now confirms no consecutive lens or angle repeats across all 30 shots. |
| 13 | **Geography** | The overhead decision shot (S27) wouldn't read without set-up. | S18 establishes the shutter on the right, S22 the threat on the left, and S19 the door between them, all before S27. |
| 14 | **Text in generated shots** | AI generators garble signs, boards and phone screens. | All readable text is marked "added in post" in every shot and in the generation guide. |
| 15 | **Loop** | The ending didn't connect back to the start. | The final sound is the door chime, which is also the first sound, so the end loops cleanly into S1. |

### Checks that passed
- **Timing:** 30 shots, continuous timecodes, total 88.0 s (inside the 75–90 s target). Verified with a script.
- **Structure:** the hook lands by 0:04; protagonist and situation by 0:15; danger and objective by 0:36; discovery (Lucy) by 0:48; complication (door) by 1:01; revelation (silhouette) at 1:09; vote at 1:22.
- **New information every 2–3 s:** the longest shot (S13, 6 s) carries three dialogue beats, a light change and an exit. The only deliberate holds are S21 and S26, the emotional beats.
- **Protagonist realism:** Kai never fights, never knows what to do, and every noise he makes causes the next danger.
- **Gore:** restrained throughout, suitable for the platforms.
- **Originality:** no characters, designs, scenes, names, signage or music taken from existing works. Transit branding is invented.

### Remaining risks (watch these in production)
1. **Character drift between AI generations** is the biggest risk. Mitigate with model sheets first, keyframes, the LOCK checks and a shared grade (`08_generation_guide.md`).
2. **Bolter stutter-motion may read as a glitch.** Use the same 2-hold/2-drop pattern for every Bolter, and show it clearly in S10 so viewers learn it as a trait.
3. **Fourth-wall look (S29)** works only once per episode. Never add a second one.
4. **The S27 speed ramp and the S29/S30 freeze** are *subjective time*. If test viewers ask "why didn't they just attack?", add 6 frames of the pack creeping in S28's background.

---

## Part 2: Footage QC checklist (run on every assembled cut)

**Per shot**
- [ ] LOCK list matches the character bible, including LEFT/RIGHT details (glasses tape, scar, radio, key reel, Wren's clip and bandage).
- [ ] No warped hands, faces or extra fingers. Eyes track correctly.
- [ ] Camera move matches the storyboard. No unmotivated shake, zoom or drift.
- [ ] Light matches the colour script (cyan → red at S12 → red plus amber from S18).
- [ ] Props in the correct hand (mop RIGHT, phone LEFT pocket).
- [ ] No generated text anywhere in frame.

**Whole cut**
- [ ] Watch at 1× on a phone, sound on, then sound off. Does the story still read?
- [ ] Hook test: show the first 3 s to someone new. Can they say what's wrong?
- [ ] Vote test: can a new viewer explain both options and argue for each?
- [ ] No frozen spans of 12 frames or more except the intentional freeze (S30). No black or white flash frames. (Use `templates/scripts/short_qa.py`.)
- [ ] Loudness −14 LUFS integrated, −1 dBTP. Dialogue intelligible on phone speakers.
- [ ] Silence beats are truly silent (S9→S10, S26), with no music bleeding through.
- [ ] End frame loops cleanly into S1.
- [ ] Captions and graphics inside the safe zone (y 290–1440, x 80–920).
