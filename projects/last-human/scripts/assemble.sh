#!/bin/bash
# Join the shot chunks in story order, add the final mix, encode for TikTok / Shorts / Reels (1080x1920, 30 fps, H.264 + AAC).
set -euo pipefail
cd "$(dirname "$0")/.."
ids=$(grep -oE 'id: "[0-9a-z]+", a: [0-9]+' src/story.ts | grep -v photo | sed -E 's/id: "([0-9a-z]+)".*/\1/')
: > out/chunks/list.txt
for id in $ids; do
  [ -f "out/chunks/$id.mp4" ] || { echo "missing chunk $id"; exit 1; }
  echo "file '$PWD/out/chunks/$id.mp4'" >> out/chunks/list.txt
done
ffmpeg -y -loglevel error -f concat -safe 0 -i out/chunks/list.txt -i audio/mix.wav \
  -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -level 4.2 -r 30 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -t 60 out/last_human_final.mp4
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,width,height,r_frame_rate -of csv=p=0 out/last_human_final.mp4
ls -la out/last_human_final.mp4
