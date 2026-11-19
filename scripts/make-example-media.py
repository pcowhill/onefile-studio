#!/usr/bin/env python3
"""
Generates the ORIGINAL media used by the v0.2 example projects (no third-party
footage). Requires Pillow and ffmpeg (libvpx-vp9).

  python3 scripts/make-example-media.py

Outputs (committed):
  src/examples/media/walkthrough.webm  – a short, silent product walkthrough of
                                          the fictional "Tasklane" app (VP9)
  src/examples/media/confetti.gif      – a looping confetti/party animation
"""
import math
import os
import random
import shutil
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'examples', 'media')
os.makedirs(OUT, exist_ok=True)

FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def font(size, bold=False):
    try:
        return ImageFont.truetype(FONT_B if bold else FONT, size)
    except OSError:
        return ImageFont.load_default()


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ video
W, H, FPS, SECONDS = 640, 360, 15, 7
BLUE = (37, 99, 235)
INK = (15, 23, 42)
MUTED = (100, 116, 139)
LINE = (226, 232, 240)
BG = (246, 248, 251)


def rounded(d, box, r, fill=None, outline=None, width=1):
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


def cursor(d, x, y, pressed):
    pts = [(x, y), (x, y + 18), (x + 5, y + 14), (x + 9, y + 22), (x + 12, y + 20), (x + 8, y + 13), (x + 14, y + 13)]
    d.polygon(pts, fill=(255, 255, 255), outline=INK)
    if pressed:
        d.ellipse((x - 9, y - 9, x + 9, y + 9), outline=BLUE, width=2)


def frame(i):
    t = i / FPS
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    # window chrome
    d.rectangle((0, 0, W, 34), fill=(255, 255, 255))
    d.line((0, 34, W, 34), fill=LINE)
    for k, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        d.ellipse((14 + k * 16, 12, 24 + k * 16, 22), fill=c)
    d.text((W / 2, 17), 'Tasklane — Sprint board', fill=MUTED, font=font(12), anchor='mm')
    # sidebar
    d.rectangle((0, 35, 150, H), fill=(255, 255, 255))
    d.line((150, 35, 150, H), fill=LINE)
    rounded(d, (14, 50, 34, 70), 6, fill=BLUE)
    d.text((42, 60), 'Tasklane', fill=INK, font=font(14, True), anchor='lm')
    for k, label in enumerate(['Boards', 'Timeline', 'Insights', 'Settings']):
        y = 96 + k * 30
        if k == 0:
            rounded(d, (10, y - 12, 140, y + 12), 7, fill=(232, 239, 253))
        d.text((24, y), label, fill=BLUE if k == 0 else MUTED, font=font(12, k == 0), anchor='lm')
    # header
    d.text((172, 62), 'Sprint 24', fill=INK, font=font(20, True), anchor='lm')
    # "New task" button with hover/press around t=1.6..2.0
    pressed = 1.6 < t < 1.9
    bx = (W - 128, 48, W - 20, 76)
    rounded(d, bx, 8, fill=(29, 78, 216) if pressed else BLUE)
    d.text(((bx[0] + bx[2]) / 2, 62), '+ New task', fill=(255, 255, 255), font=font(12, True), anchor='mm')
    # columns
    cols = ['To do', 'In progress', 'Done']
    cw = (W - 172 - 20 - 2 * 14) / 3
    cards = {
        0: ['Write release notes', 'Design empty states'],
        1: ['Offline export', 'Theme picker'],
        2: ['Charts & tables', 'Countdown widget'],
    }
    for c, name in enumerate(cols):
        x0 = 172 + c * (cw + 14)
        rounded(d, (x0, 92, x0 + cw, H - 16), 10, fill=(238, 242, 247))
        d.text((x0 + 12, 108), f'{name}', fill=MUTED, font=font(11, True), anchor='lm')
        items = list(cards[c])
        # new card appears in "To do" after the click
        appear = ease((t - 1.9) / 0.6)
        if c == 0 and appear > 0:
            items = ['Share walkthrough'] + items
        # card moves from In progress to Done between 3.6s and 5.0s
        move = ease((t - 3.6) / 1.4)
        y = 124
        for k, label in enumerate(items):
            if c == 1 and label == 'Theme picker' and move > 0:
                continue
            hgt = 52
            alpha_shift = 0
            if c == 0 and label == 'Share walkthrough':
                alpha_shift = (1 - appear) * -20
            yy = y + alpha_shift
            rounded(d, (x0 + 8, yy, x0 + cw - 8, yy + hgt), 8, fill=(255, 255, 255), outline=LINE)
            d.text((x0 + 18, yy + 18), label, fill=INK, font=font(11, True), anchor='lm')
            tag = ['Docs', 'Design', 'Eng'][(k + c) % 3]
            rounded(d, (x0 + 18, yy + 30, x0 + 18 + 44, yy + 44), 7, fill=(232, 239, 253))
            d.text((x0 + 40, yy + 37), tag, fill=BLUE, font=font(9, True), anchor='mm')
            y += hgt + 10
        if c == 2 and move > 0:
            # moving card animates from column 1 to column 2
            sx = 172 + 1 * (cw + 14) + 8
            ex = 172 + 2 * (cw + 14) + 8
            sy, ey = 124 + 62, y
            mx = sx + (ex - sx) * move
            my = sy + (ey - sy) * move - math.sin(move * math.pi) * 18
            rounded(d, (mx, my, mx + cw - 16, my + 52), 8, fill=(255, 255, 255), outline=BLUE, width=2)
            d.text((mx + 10, my + 18), 'Theme picker', fill=INK, font=font(11, True), anchor='lm')
            if move >= 1:
                rounded(d, (mx + cw - 44, my + 30, mx + cw - 22, my + 44), 7, fill=(220, 252, 231))
                d.text((mx + cw - 33, my + 37), '✓', fill=(22, 163, 74), font=font(10, True), anchor='mm')
    # toast
    toast = ease((t - 5.3) / 0.4) * (1 - ease((t - 6.6) / 0.3))
    if toast > 0:
        ty = H - 12 - 40 * toast
        rounded(d, (W / 2 - 110, ty - 18, W / 2 + 110, ty + 18), 18, fill=INK)
        d.text((W / 2, ty), 'Board updated — 1 task done', fill=(255, 255, 255), font=font(12, True), anchor='mm')
    # cursor path
    path = [(0.0, (420, 250)), (1.5, (W - 74, 64)), (2.4, (W - 74, 64)), (3.4, (172 + 1.5 * (cw + 14), 210)), (5.0, (172 + 2.5 * (cw + 14), 230)), (7.0, (560, 300))]
    for (t0, p0), (t1, p1) in zip(path, path[1:]):
        if t0 <= t <= t1:
            k = ease((t - t0) / (t1 - t0))
            cx, cy = p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k
            break
    else:
        cx, cy = path[-1][1]
    cursor(d, cx, cy, pressed or 3.6 < t < 3.8)
    return img


def make_video():
    tmp = tempfile.mkdtemp()
    try:
        for i in range(FPS * SECONDS):
            frame(i).save(os.path.join(tmp, f'f{i:04d}.png'))
        out = os.path.join(OUT, 'walkthrough.webm')
        subprocess.run(
            [
                'ffmpeg', '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', os.path.join(tmp, 'f%04d.png'),
                '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '42', '-pix_fmt', 'yuv420p', '-row-mt', '1', '-an', out,
            ],
            check=True,
        )
        print('video', os.path.getsize(out))
    finally:
        shutil.rmtree(tmp)


# ------------------------------------------------------------------ GIF
def make_gif():
    rnd = random.Random(7)
    S = 220
    colors = [(181, 83, 44), (217, 154, 61), (111, 143, 92), (126, 106, 150), (192, 100, 90), (242, 195, 139)]
    bits = [
        dict(x=rnd.uniform(-20, 20), vx=rnd.uniform(-3.2, 3.2), vy=rnd.uniform(-7.5, -4.0), c=rnd.choice(colors), r=rnd.uniform(0, 6.28), w=rnd.choice([6, 8, 10]))
        for _ in range(42)
    ]
    frames = []
    N = 18
    for f in range(N):
        img = Image.new('RGB', (S, S), (251, 247, 241))
        d = ImageDraw.Draw(img)
        # party popper
        d.polygon([(70, 190), (110, 120), (140, 150)], fill=(181, 83, 44))
        d.line([(80, 172), (118, 132)], fill=(242, 195, 139), width=4)
        d.line([(92, 184), (128, 146)], fill=(242, 195, 139), width=4)
        tt = (f / N) * 1.0
        for b in bits:
            k = tt * 22
            x = 125 + b['x'] + b['vx'] * k
            y = 135 + b['vy'] * k + 0.32 * k * k
            if y > S + 10:
                continue
            ang = b['r'] + k * 0.5
            w, h = b['w'], b['w'] * 0.45
            pts = [(x + math.cos(ang) * dx - math.sin(ang) * dy, y + math.sin(ang) * dx + math.cos(ang) * dy) for dx, dy in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]]
            d.polygon(pts, fill=b['c'])
        frames.append(img.convert('P', palette=Image.ADAPTIVE, colors=16))
    out = os.path.join(OUT, 'confetti.gif')
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=70, loop=0, optimize=True, disposal=1)
    print('gif', os.path.getsize(out))


if __name__ == '__main__':
    make_video()
    make_gif()
