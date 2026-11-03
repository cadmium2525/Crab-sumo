#!/bin/sh
# 曲 JSON を「かなでる」（https://github.com/cadmium2525/mp4mp3 の daw/）のエンジンで音にして audio/ に MP3 で書き出す
#   KANADERU=/path/to/mp4mp3/daw sh tools/music/build.sh [曲名...]
set -e
cd "$(dirname "$0")/../.."
DAW="${KANADERU:-../cadmium2525/mp4mp3/daw}"
mkdir -p audio tools/music/sheets
node tools/music/gen.mjs >/dev/null
NAMES="${*:-home field night sumo win lose catch}"
for n in $NAMES; do
  node "$DAW/tools/render.mjs" "tools/music/songs/$n.json" "/tmp/sumo-$n.wav" --bits 16 --sheet "tools/music/sheets/$n.png" --report > "tools/music/sheets/$n.txt"
  ffmpeg -v error -y -i "/tmp/sumo-$n.wav" -ar 44100 -c:a libmp3lame -b:a 112k "audio/$n.mp3"
  rm -f "/tmp/sumo-$n.wav"
  echo "audio/$n.mp3 $(du -k "audio/$n.mp3" | cut -f1)KB"
done
