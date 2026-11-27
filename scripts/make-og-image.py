#!/usr/bin/env python3
"""
STEP 4A — generate the Open Graph image (public/og-image.jpg).
1200x630, dark background with gold serif wordmark — matches the site tokens.
Run: python3 scripts/make-og-image.py
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os

W, H = 1200, 630
BG = (10, 10, 10, 255)        # --bg
GOLD = (201, 162, 75, 255)    # --gold
GOLD_LIGHT = (230, 200, 119, 255)  # --gold-light
CREAM = (243, 237, 224, 255)  # --cream
MUTED = (168, 159, 140, 255)  # --muted

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "public", "og-image.jpg")

SERIF = "/usr/share/fonts/truetype/noto-serif-sc/NotoSerifSC-SemiBold.ttf"
SANS = "/usr/share/fonts/truetype/chinese/NotoSansSC-Regular.ttf"

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

# Soft radial gold glow behind the wordmark (subtle, no text harm).
glow = Image.new("L", (W, H), 0)
gdraw = ImageDraw.Draw(glow)
gdraw.ellipse([W // 2 - 430, H // 2 - 300, W // 2 + 430, H // 2 + 300], fill=26)
glow = glow.filter(ImageFilter.GaussianBlur(120))
img.paste(Image.new("RGB", (W, H), GOLD_LIGHT), (0, 0), glow)
draw = ImageDraw.Draw(img)

# Thin gold frame.
draw.rounded_rectangle([24, 24, W - 24, H - 24], radius=26, outline=GOLD, width=2)

# Eyebrow.
eyebrow = ImageFont.truetype(SANS, 28)
eb = "FRIED OMENA  ·  NAIROBI, KENYA"
eb_w = draw.textlength(eb, font=eyebrow)
draw.text(((W - eb_w) / 2, 170), eb, font=eyebrow, fill=MUTED)

# Wordmark.
title = ImageFont.truetype(SERIF, 128)
t = "Lake Flavour"
t_w = draw.textlength(t, font=title)
draw.text(((W - t_w) / 2, 235), t, font=title, fill=GOLD_LIGHT)

# Gold rule.
draw.line([(W - 240) / 2, 430, (W + 240) / 2, 430], fill=GOLD, width=3)

# Tagline.
tag = ImageFont.truetype(SANS, 40)
tg = "Crisp. Golden. Straight from the lake."
tg_w = draw.textlength(tg, font=tag)
draw.text(((W - tg_w) / 2, 465), tg, font=tag, fill=CREAM)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT, "JPEG", quality=88)
print(f"saved {OUT} ({W}x{H})")
