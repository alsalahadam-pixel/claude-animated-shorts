#!/bin/bash
# Join the rendered segments, mux the soundtrack, write shots.json for QA.
set -e
cd "$(dirname "$0")/out"
printf "file 'seg/seg0.mp4'\nfile 'seg/seg1.mp4'\nfile 'seg/seg2.mp4'\n" > concat.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i concat.txt -c copy video_noaudio.mp4
# re-encode for delivery: film grain makes the CRF-17 masters large
ffmpeg -y -loglevel error -i video_noaudio.mp4 -i mix.wav -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -movflags +faststart -shortest the_last_train_ep01_previz.mp4
python3 - <<'PY'
import json
S=[(1,0.0,2.6),(2,2.6,5.0),(3,5.0,7.6),(4,7.6,10.6),(5,10.6,13.4),(6,13.4,15.4),(7,15.4,19.4),(8,19.4,21.6),(9,21.6,23.2),(10,23.2,26.6),(11,26.6,28.2),(12,28.2,30.2),(13,30.2,36.2),(14,36.2,37.8),(15,37.8,40.8),(16,40.8,44.8),(17,44.8,48.0),(18,48.0,51.0),(19,51.0,52.6),(20,52.6,55.4),(21,55.4,60.4),(22,60.4,63.0),(23,63.0,65.2),(24,65.2,66.6),(25,66.6,68.8),(26,68.8,73.6),(27,73.6,76.0),(28,76.0,79.0),(29,79.0,82.6),(30,82.6,88.0)]
json.dump({"shots":[{"id":i,"a":round(a*24),"b":round(b*24)} for i,a,b in S],"planned":[[2083,2112]]},open('shots.json','w'))
PY
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate -of compact the_last_train_ep01_previz.mp4
