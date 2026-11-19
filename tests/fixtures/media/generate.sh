#!/usr/bin/env bash
# Regenerates the small media fixtures used by the unit and e2e tests.
# Requires ffmpeg (libvpx-vp9, libopus, libx264, aac, libmp3lame) and Python 3 with Pillow.
# Usage: bash tests/fixtures/media/generate.sh
set -euo pipefail
cd "$(dirname "$0")"
FF="ffmpeg -y -hide_banner -loglevel error"

# 3 s, 320x180 VP9 WebM with an Opus tone (plays in every Chromium build).
$FF -f lavfi -i "testsrc2=size=320x180:rate=15:duration=3" -f lavfi -i "sine=frequency=330:duration=3" \
  -c:v libvpx-vp9 -b:v 200k -deadline realtime -cpu-used 8 -pix_fmt yuv420p -c:a libopus -b:a 32k -shortest clip.webm

# 2 s, 320x180 H.264 MP4 with AAC audio (Playwright's Chromium may not decode it; used for import/export tests).
$FF -f lavfi -i "testsrc=size=320x180:rate=15:duration=2" -f lavfi -i "sine=frequency=440:duration=2" \
  -c:v libx264 -preset veryfast -crf 32 -pix_fmt yuv420p -c:a aac -b:a 48k -movflags +faststart -shortest clip.mp4

# 2 s MP3 tone and a 1 s WAV tone.
$FF -f lavfi -i "sine=frequency=523:duration=2" -ac 1 -c:a libmp3lame -b:a 48k tone.mp3
$FF -f lavfi -i "sine=frequency=660:duration=1" -ac 1 -ar 16000 -c:a pcm_s16le tone.wav

# Animated GIF (4 frames) and a static GIF.
python3 - <<'PY'
from PIL import Image, ImageDraw
frames = []
for i, c in enumerate([(109, 74, 255), (255, 126, 179), (255, 210, 63), (0, 184, 148)]):
    im = Image.new('RGB', (64, 64), (255, 255, 255))
    d = ImageDraw.Draw(im)
    d.ellipse((8 + i * 4, 8, 40 + i * 4, 40), fill=c)
    frames.append(im)
frames[0].save('spinner.gif', save_all=True, append_images=frames[1:], duration=120, loop=0)
still = Image.new('RGB', (48, 32), (61, 139, 255))
ImageDraw.Draw(still).rectangle((8, 8, 40, 24), fill=(255, 255, 255))
still.save('still.gif')
PY
ls -l clip.webm clip.mp4 tone.mp3 tone.wav spinner.gif still.gif
