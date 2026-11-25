#!/usr/bin/env python3
"""Makes the pilot capstone's two image sources, deterministically:

- practice-template/lessons/b-capstone/project/fixit/march/booking-confirmation-march.pdf,
  the signed booking as a two-page scan (page images only, no text layer, as a
  scanner makes it);
- practice-template/project/fixit/sources/flyer-2026-10.png, a photo of last
  October's printed flyer.

Each has a text version beside it, written by hand and kept in step with the
words drawn here: booking-confirmation-march-text.md and flyer-2026-10.md.
Needs Pillow and the macOS system fonts. Run from anywhere:
  python3 courses/fixit/tools/make-assets.py
"""
import random
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

COURSE = Path(__file__).resolve().parent.parent
FONTS = Path("/System/Library/Fonts/Supplemental")


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def scanned(page, seed):
    """Grey paper, a slight skew, specks and blur, as a cheap office scanner gives."""
    rnd = random.Random(seed)
    page = page.rotate(rnd.uniform(-0.8, 0.8), resample=Image.BICUBIC, fillcolor=(236, 234, 228))
    draw = ImageDraw.Draw(page)
    for _ in range(900):
        x, y = rnd.randrange(page.width), rnd.randrange(page.height)
        g = rnd.randrange(120, 200)
        draw.point((x, y), fill=(g, g, g))
    return page.filter(ImageFilter.GaussianBlur(0.6)).convert("L").convert("RGB")


def booking():
    w, h = 1000, 1414  # A4 at about 120 dpi
    reg, bold, sig = font("Arial.ttf", 22), font("Arial Bold.ttf", 22), font("Bradley Hand Bold.ttf", 40)
    head = font("Arial Bold.ttf", 30)
    pages = []

    p1 = Image.new("RGB", (w, h), (246, 245, 240))
    d = ImageDraw.Draw(p1)
    d.rectangle((70, 70, w - 70, 150), outline=(40, 40, 40), width=3)
    d.text((95, 92), "MILLBROOK LIBRARY: ROOM BOOKING CONFIRMATION", font=head, fill=(20, 20, 20))
    y = 200
    rows = [
        ("Booking ref:", "MBL-2027-0313-B"),
        ("Group:", "Millbrook Fixers"),
        ("Room:", "B (first floor)"),
        ("Date:", "Saturday 13 March 2027"),
        ("Hours booked:", "10:00 to 13:30 (room to be vacated by 13:30)"),
        ("Public admission:", "from 10:30, at the group's discretion"),
    ]
    for k, v in rows:
        d.text((95, y), k, font=bold, fill=(20, 20, 20))
        d.text((330, y), v, font=reg, fill=(20, 20, 20))
        y += 44
    y += 26
    paras = [
        ("Maximum occupancy:", ["40 persons, including organisers, volunteers and library", "staff. The group is responsible for keeping numbers within", "this limit."]),
        ("Access:", ["Room B is on the first floor, accessible by lift (next to the", "children's library) or stairs."]),
        ("Equipment:", ["6 tables, 20 chairs, 2 extension reels (PAT tested).", "No cooking appliances."]),
        ("Library contact for the public:", ["Events Desk, 555-0100."]),
    ]
    for k, lines in paras:
        d.text((95, y), k, font=bold, fill=(20, 20, 20))
        y += 36
        for line in lines:
            d.text((125, y), line, font=reg, fill=(20, 20, 20))
            y += 32
        y += 22
    d.text((95, h - 120), "Page 1 of 2. Signatures overleaf.", font=reg, fill=(70, 70, 70))
    pages.append(scanned(p1, 1))

    p2 = Image.new("RGB", (w, h), (246, 245, 240))
    d = ImageDraw.Draw(p2)
    d.text((95, 110), "Booking ref: MBL-2027-0313-B", font=bold, fill=(20, 20, 20))
    d.text((95, 170), "Both parties agree to the terms on page 1 and the library's", font=reg, fill=(20, 20, 20))
    d.text((95, 202), "standard conditions for community room hire.", font=reg, fill=(20, 20, 20))
    for i, (who, name, date) in enumerate([("Signed for the library:", "Dee Okafor", "Events Desk, 24 February 2027"), ("Signed for the group:", "Priya", "Millbrook Fixers, 25 February 2027")]):
        y = 320 + i * 220
        d.text((95, y), who, font=bold, fill=(20, 20, 20))
        d.text((130, y + 50), name, font=sig, fill=(25, 35, 90))
        d.line((120, y + 110, 600, y + 110), fill=(60, 60, 60), width=2)
        d.text((125, y + 122), date, font=reg, fill=(20, 20, 20))
    d.text((95, h - 120), "Page 2 of 2.", font=reg, fill=(70, 70, 70))
    pages.append(scanned(p2, 2))

    out = COURSE / "practice-template/lessons/b-capstone/project/fixit/march/booking-confirmation-march.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)
    when = time.gmtime(1803287640)  # 2027-02-25 09:14 UTC
    pages[0].save(out, "PDF", save_all=True, append_images=pages[1:], resolution=120, quality=55,
                  title="Scan 2027-02-25", author="Library scanner", creationDate=when, modDate=when)
    return out


def flyer():
    w, h = 900, 1200
    img = Image.new("RGB", (w, h), (64, 58, 52))  # the noticeboard behind the paper
    paper = Image.new("RGB", (720, 1000), (255, 214, 64))
    d = ImageDraw.Draw(paper)
    big, mid, reg = font("Arial Black.ttf", 76), font("Arial Bold.ttf", 40), font("Arial.ttf", 32)
    small = font("Arial Italic.ttf", 24)
    def centre(y, text, f, fill=(30, 30, 30)):
        tw = d.textlength(text, font=f)
        d.text(((720 - tw) / 2, y), text, font=f, fill=fill)
    centre(60, "FIX-IT", big, (170, 30, 30))
    centre(150, "SATURDAY!", big, (170, 30, 30))
    centre(290, "Millbrook Library, Room B", mid)
    centre(345, "Every second Saturday, 10am to 1pm", reg)
    d.rounded_rectangle((90, 420, 630, 520), radius=20, fill=(170, 30, 30))
    centre(445, "60 seats, just turn up!", mid, (255, 255, 255))
    centre(570, "Bring your broken toasters, bikes,", reg)
    centre(612, "lamps, laptops and jumpers.", reg)
    centre(670, "We fix anything!", mid)
    centre(750, "Free. Tea and biscuits.", reg)
    centre(810, "Questions? Text Priya on 555-0187.", reg)
    centre(920, "Millbrook Fixers: keeping things out of landfill since 2024", small, (80, 60, 20))
    paper = paper.rotate(-3.5, resample=Image.BICUBIC, expand=True, fillcolor=(64, 58, 52))
    img.paste(paper, ((w - paper.width) // 2, (h - paper.height) // 2))
    d = ImageDraw.Draw(img)
    d.ellipse((440, 85, 470, 115), fill=(200, 40, 40))  # a drawing pin
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    out = COURSE / "practice-template/project/fixit/sources/flyer-2026-10.png"
    img.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out, optimize=True)
    return out


if __name__ == "__main__":
    for path in (booking(), flyer()):
        print(f"{path.relative_to(COURSE)}: {path.stat().st_size} bytes")
