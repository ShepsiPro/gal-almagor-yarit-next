#!/usr/bin/env python3
"""Yarit's logo lockups with the business's full name (owner, 2026-10-07): the name "יערית", then
"מקבוצת גל אלמגור סוכנות לביטוח", never one without the other. This is the name used for legal purposes.

Built from Yarit's own parts, never redrawn:
  - the shield: public/assets/yarit-shield.png
  - the wordmark "יערית": scripts/logo-src/wordmark-navy.png and wordmark-white.png, cropped whole from the
    previous logo files (they were "יערית / מקבוצת גל אלמגור")
  - the subline set in Coherenti Regular (app/fonts), the site's font and the one the previous subline was set in,
    in the previous subline's colour (#304054 on light, white on dark)

Writes:
  public/assets/yarit-logo.png          horizontal (header): wordmark over a ONE-line subline, shield on the right;
                                        the subline stays the size it was, so it is still legible at 54 px high
  public/assets/yarit-logo-white.png    the same for dark backgrounds (footer)
  public/assets/yarit-logo-stacked.png  stacked: shield, wordmark, the subline on two centred lines
  app/opengraph-image.png               1200x630 link preview: the stacked lockup on white
(The first build, scripts/build_logo_assets.py, made the 2026-06 assets from a WhatsApp photo; it is history.)

Usage: python3 scripts/build_name_lockups.py      (needs Pillow with raqm for Hebrew shaping)"""
import os

from PIL import Image, ImageDraw, ImageFont, features

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)  # noqa: E731
LINE1, LINE2 = "מקבוצת גל אלמגור", "סוכנות לביטוח"
SUB = f"{LINE1} {LINE2}"
FONT = P("app", "fonts", "Coherenti-Regular.ttf")
SIZE = 52                      # the previous subline's size (it matched Coherenti Regular at 52 px)
INK = (48, 64, 84, 255)        # #304054, the previous subline's colour
WHITE = (255, 255, 255, 255)

if not features.check("raqm"):
    raise SystemExit("Pillow needs raqm (libraqm) to shape Hebrew right to left")


def text_img(txt, fill):
    """the text, shaped right to left, cropped tight to its pixels"""
    f = ImageFont.truetype(FONT, SIZE)
    probe = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    x0, y0, x1, y1 = probe.textbbox((0, 0), txt, font=f, direction="rtl", language="he")
    im = Image.new("RGBA", (x1 - x0 + 20, y1 - y0 + 20), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((10 - x0, 10 - y0), txt, font=f, fill=fill, direction="rtl", language="he")
    return im.crop(im.getbbox())


shield_src = Image.open(P("public", "assets", "yarit-shield.png")).convert("RGBA")


def shield(h):
    return shield_src.resize((round(shield_src.width * h / shield_src.height), h), Image.LANCZOS)


def horizontal(word_file, fill, out):
    # the previous geometry: canvas 246 high, wordmark at y 18, subline glyphs from y 167 to 231, the text
    # right-aligned, 43 px to the shield (195 x 246)
    word = Image.open(P("scripts", "logo-src", word_file)).convert("RGBA")
    sub = text_img(SUB, fill)
    col_w = max(word.width, sub.width)
    sh = shield(246)
    W = col_w + 43 + sh.width
    c = Image.new("RGBA", (W, 246), (0, 0, 0, 0))
    c.alpha_composite(word, (col_w - word.width, 18))
    c.alpha_composite(sub, (col_w - sub.width, 231 - sub.height + 1))
    c.alpha_composite(sh, (col_w + 43, 0))
    c.save(P("public", "assets", out), optimize=True)
    print(out, c.size)
    return c


def stacked(fill, word_file):
    # the previous stacked geometry: shield 299 x 376, 57 px, wordmark 441 x 117, 40 px, subline; now two lines
    word = Image.open(P("scripts", "logo-src", word_file)).convert("RGBA")
    l1, l2 = text_img(LINE1, fill), text_img(LINE2, fill)
    sh = shield(376)
    W = max(word.width, l1.width, l2.width, sh.width)
    lead = 66  # line advance between the two subline lines (baseline to baseline)
    y_word = sh.height + 57
    y_l1 = y_word + word.height + 40
    # align the two lines on their baselines: the tight crops differ (ל and ק reach out), so measure each line's
    # baseline offset from its crop top with the font metrics
    f = ImageFont.truetype(FONT, SIZE)
    probe = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    def base_off(txt):
        _, top, _, _ = probe.textbbox((0, 0), txt, font=f, direction="rtl", language="he", anchor="ls")
        return -top  # pixels from the glyph top to the baseline
    b1 = y_l1 + base_off(LINE1)
    b2 = b1 + lead
    H = b2 + (l2.height - base_off(LINE2)) + 2
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    c.alpha_composite(sh, ((W - sh.width) // 2, 0))
    c.alpha_composite(word, ((W - word.width) // 2, y_word))
    c.alpha_composite(l1, ((W - l1.width) // 2, b1 - base_off(LINE1)))
    c.alpha_composite(l2, ((W - l2.width) // 2, b2 - base_off(LINE2)))
    return c


horizontal("wordmark-navy.png", INK, "yarit-logo.png")
horizontal("wordmark-white.png", WHITE, "yarit-logo-white.png")
st = stacked(INK, "wordmark-navy.png")
st.save(P("public", "assets", "yarit-logo-stacked.png"), optimize=True)
print("yarit-logo-stacked.png", st.size)

# the link preview: the stacked lockup on white, 1200 x 630, about 520 px high, centred
og = Image.new("RGBA", (1200, 630), (255, 255, 255, 255))
s = 520 / st.height
lk = st.resize((round(st.width * s), 520), Image.LANCZOS)
og.alpha_composite(lk, ((1200 - lk.width) // 2, (630 - lk.height) // 2))
og.convert("RGB").save(P("app", "opengraph-image.png"), optimize=True)
print("opengraph-image.png", og.size)
