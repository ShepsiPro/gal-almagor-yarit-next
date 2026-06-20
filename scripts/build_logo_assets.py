#!/usr/bin/env python3
"""Generate Yarit logo + icon assets from the source WhatsApp image.

Source: a 1024x1024 stacked lockup (shield / "יערית" / "סוכנות לביטוח")
on a near-white background.

Outputs:
  public/assets/yarit-logo.png          horizontal header lockup (transparent)
  public/assets/yarit-logo-stacked.png  trimmed original lockup (transparent)
  app/icon.png                          512 shield, transparent (favicon source)
  app/favicon.ico                       multi-size shield, transparent
  app/apple-icon.png                    180 shield on white
  app/opengraph-image.png               1200x630 social card
  public/icon-192.png / icon-512.png    maskable PWA icons (shield on white)
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = "/Users/shepsi/Downloads/WhatsApp Image 2026-06-20 at 12.39.38.jpeg"

NAVY = (30, 65, 100, 255)  # not used for fills, just reference


def p(*parts):
    return os.path.join(ROOT, *parts)


def remove_background(img, thresh=100):
    """Flood-fill the exterior near-white background to transparent."""
    img = img.convert("RGBA")
    w, h = img.size
    seeds = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]
    for s in seeds:
        ImageDraw.floodfill(img, s, (0, 0, 0, 0), thresh=thresh)
    return img


def alpha_rows(img, amin=20):
    """Return list of bools: does row y have any visible pixel."""
    a = img.split()[3]
    px = a.load()
    w, h = img.size
    rows = []
    for y in range(h):
        present = False
        for x in range(0, w, 3):  # subsample columns for speed
            if px[x, y] > amin:
                present = True
                break
        rows.append(present)
    return rows


def find_bands(rows, min_gap=10):
    """Split rows into content bands separated by gaps >= min_gap empty rows."""
    bands = []
    start = None
    gap = 0
    for y, present in enumerate(rows):
        if present:
            if start is None:
                start = y
            gap = 0
        else:
            if start is not None:
                gap += 1
                if gap >= min_gap:
                    bands.append((start, y - gap + 1))
                    start = None
                    gap = 0
    if start is not None:
        bands.append((start, len(rows)))
    return bands


def tight(img):
    bb = img.getbbox()
    return img.crop(bb) if bb else img


def paste_center(canvas, im, cx, cy):
    canvas.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))


def on_white(im, size, pad_frac=0.0):
    """Center im on an opaque white square of `size`, leaving pad_frac margin."""
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    avail = int(size * (1 - 2 * pad_frac))
    scale = min(avail / im.width, avail / im.height)
    r = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
    paste_center(canvas, r, size / 2, size / 2)
    return canvas


# ---------------------------------------------------------------- load + clean
raw = Image.open(SRC)
clean = remove_background(raw)
lockup = tight(clean)
print("trimmed lockup:", lockup.size)

# ---------------------------------------------------------------- find 3 bands
rows = alpha_rows(lockup)
bands = find_bands(rows, min_gap=8)
print("bands (y0,y1):", bands, "->", len(bands), "found")

if len(bands) < 3:
    raise SystemExit(f"Expected >=3 bands (shield/name/tagline), got {len(bands)}")

shield_band, name_band, tag_band = bands[0], bands[1], bands[2]


def band_crop(band):
    y0, y1 = band
    strip = lockup.crop((0, y0, lockup.width, y1))
    return tight(strip)


shield = band_crop(shield_band)
name = band_crop(name_band)
tag = band_crop(tag_band)
print("shield:", shield.size, "| name:", name.size, "| tagline:", tag.size)

os.makedirs(p("public", "assets"), exist_ok=True)

# ---------------------------------------------------------------- stacked save
lockup.save(p("public", "assets", "yarit-logo-stacked.png"))

# -------------------------------------------------------- horizontal header lockup
# Text column: "יערית" stacked over the tagline, right-aligned (RTL).
gap_text = int(name.height * 0.28)
col_w = max(name.width, tag.width)
col_h = name.height + gap_text + tag.height
text_col = Image.new("RGBA", (col_w, col_h), (0, 0, 0, 0))
text_col.alpha_composite(name, (col_w - name.width, 0))           # right align
text_col.alpha_composite(tag, (col_w - tag.width, name.height + gap_text))

# Scale shield to balance the text block height.
sh_target = int(col_h * 1.18)
sh_scale = sh_target / shield.height
shield_h = shield.resize(
    (int(shield.width * sh_scale), sh_target), Image.LANCZOS
)

gap_mark = int(shield_h.width * 0.22)
total_w = text_col.width + gap_mark + shield_h.width
total_h = max(text_col.height, shield_h.height)
header = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
# RTL: shield on the right, text to its left.
header.alpha_composite(text_col, (0, (total_h - text_col.height) // 2))
header.alpha_composite(shield_h, (text_col.width + gap_mark, (total_h - shield_h.height) // 2))
header = tight(header)
header.save(p("public", "assets", "yarit-logo.png"))
print("header lockup:", header.size, "ratio %.3f" % (header.width / header.height))


def white_of(im):
    """Recolor an image to solid white, preserving its alpha (letter shapes)."""
    solid = Image.new("RGBA", im.size, (255, 255, 255, 255))
    solid.putalpha(im.split()[3])
    return solid


# White-wordmark variant for the dark footer (shield keeps full color).
name_w, tag_w = white_of(name), white_of(tag)
text_col_w = Image.new("RGBA", (col_w, col_h), (0, 0, 0, 0))
text_col_w.alpha_composite(name_w, (col_w - name_w.width, 0))
text_col_w.alpha_composite(tag_w, (col_w - tag_w.width, name.height + gap_text))
header_w = Image.new("RGBA", (total_w, total_h), (0, 0, 0, 0))
header_w.alpha_composite(text_col_w, (0, (total_h - text_col_w.height) // 2))
header_w.alpha_composite(shield_h, (text_col.width + gap_mark, (total_h - shield_h.height) // 2))
tight(header_w).save(p("public", "assets", "yarit-logo-white.png"))

# ---------------------------------------------------------------- shield square
side = max(shield.width, shield.height)
shield_sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
paste_center(shield_sq, shield, side / 2, side / 2)

# app/icon.png (transparent 512) + favicon.ico (multi-size, transparent)
icon512 = shield_sq.resize((512, 512), Image.LANCZOS)
icon512.save(p("app", "icon.png"))
icon512.save(
    p("app", "favicon.ico"),
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

# apple-icon (Apple ignores transparency -> put on white, slight padding)
on_white(shield_sq, 180, pad_frac=0.10).save(p("app", "apple-icon.png"))

# maskable PWA icons (need ~16% safe-zone padding, opaque bg)
on_white(shield_sq, 192, pad_frac=0.16).save(p("public", "icon-192.png"))
on_white(shield_sq, 512, pad_frac=0.16).save(p("public", "icon-512.png"))

# ---------------------------------------------------------------- OG image
og = Image.new("RGBA", (1200, 630), (255, 255, 255, 255))
lk = tight(lockup)
scale = (630 * 0.74) / lk.height
lk_r = lk.resize((int(lk.width * scale), int(lk.height * scale)), Image.LANCZOS)
paste_center(og, lk_r, 600, 315)
og.convert("RGB").save(p("app", "opengraph-image.png"))

print("DONE. wrote:")
for f in [
    "public/assets/yarit-logo.png",
    "public/assets/yarit-logo-stacked.png",
    "app/icon.png", "app/favicon.ico", "app/apple-icon.png",
    "app/opengraph-image.png", "public/icon-192.png", "public/icon-512.png",
]:
    fp = p(*f.split("/"))
    print("  %-38s %d bytes" % (f, os.path.getsize(fp)))
