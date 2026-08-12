#!/usr/bin/env python3
"""Rebuild every derived image for musroek.com from the Dropbox originals."""
from PIL import Image, ImageFilter, ImageSequence
import numpy as np, os, json
from collections import deque

UP = "/mnt/user-data/uploads/00_WORK_ARCHIVE"
WEB = "/mnt/user-data/uploads/Website"
BH = f"{UP}/00_Ongoing Projects/Bird Humans"
GRAD = f"{UP}/2023/Organic Intuition - Gradshow/Edited_final"
DARK = (18, 17, 15)

for d in ("works", "works_sm", "works_dark", "works_dark_sm"):
    os.makedirs(f"static/images/{d}", exist_ok=True)

def flat(im, bg=(255, 255, 255)):
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        c = Image.new("RGBA", im.size, bg + (255,)); c.alpha_composite(im); im = c
    return im.convert("RGB")

def save(im, slug, dark=False, big=1600, sm=760):
    d1 = "works_dark" if dark else "works"
    d2 = "works_dark_sm" if dark else "works_sm"
    b = im.copy(); b.thumbnail((big, big), Image.LANCZOS)
    b.save(f"static/images/{d1}/{slug}.jpg", "JPEG", quality=88, optimize=True, progressive=True)
    s = im.copy(); s.thumbnail((sm, sm), Image.LANCZOS)
    s.save(f"static/images/{d2}/{slug}.jpg", "JPEG", quality=68, optimize=True, progressive=True)

def whiten(src, slug, pct=80, clip=None, sharpen=True):
    """Line drawings: lift the paper to pure white so the work floats."""
    im = flat(Image.open(src)); im.thumbnail((2000, 2000), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    # per-channel white point — robust even when the scan is already near-white
    paper = np.array([np.percentile(a[..., c], pct) for c in range(3)])
    paper = np.clip(paper, 120, 255)
    a = a * (253.0 / paper)
    if clip:
        a[a.mean(axis=2) > clip] = 255
    out = Image.fromarray(np.clip(a, 0, 255).astype("uint8"), "RGB")
    if sharpen:
        out = out.filter(ImageFilter.UnsharpMask(radius=1.0, percent=80, threshold=3))
    save(out, slug)
    return out

def alpha_from_ink(im):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    return np.clip((248.0 - a.mean(axis=2)) * 1.45, 0, 255)

def key_bg(src, thresh=232, sat_max=26, maxpx=1500):
    """Flood-fill the studio background inward from the edges → RGBA."""
    im = flat(Image.open(src)); im.thumbnail((maxpx, maxpx), Image.LANCZOS)
    a = np.asarray(im).astype(np.int16)
    lum = a.mean(axis=2); sat = a.max(axis=2) - a.min(axis=2)
    bg = (lum > thresh) & (sat < sat_max)
    H, W = bg.shape; seen = np.zeros((H, W), bool); q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if bg[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if bg[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y+dy, x+dx
            if 0 <= ny < H and 0 <= nx < W and bg[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    al = Image.fromarray(np.where(seen, 0, 255).astype("uint8"), "L").filter(ImageFilter.GaussianBlur(1))
    r = im.convert("RGBA"); r.putalpha(al)
    return r

def both(rgba, slug):
    save(flat(rgba, (255, 255, 255)), slug)
    save(flat(rgba, DARK), slug, dark=True)

print("— Mus drawings —")
MUS_SRC = {
 "the-king-is-lonely": f"{BH}/08_PNG/The_king_is_lonely.png",
 "given-up": f"{BH}/08_PNG/given_up.png",
 "rave-prison": f"{BH}/08_PNG/rave_prison.png",
 "the-fun-one": f"{BH}/07_insta/the_fun_one.png",
 "beneath-their-wakes": f"{BH}/01_Scans/beneath their wakes.jpg",
 "he-is-stealing-a-sapling": f"{BH}/01_Scans/he is stealing a sapling.jpg",
 "is-he-stealing-a-sapling": f"{BH}/01_Scans/is he stealing a sapling.jpg",
 "sapling-stealer": f"{BH}/01_Scans/sapling stealer.jpg",
 "ketaexpress": f"{BH}/01_Scans/ketaexpress.jpg",
 "ketaexpress-two": f"{BH}/01_Scans/ketaexpresstwo.jpg",
 "the-infamous-pizza-party": f"{BH}/01_Scans/the infamous pizza party.jpg",
 "the-story-of-a-bird": f"{BH}/01_Scans/the story of a bird.jpg",
 "equal-footing": f"{BH}/01_Scans/equal_footing.png",
 "limited-time-only": f"{BH}/01_Scans/limited_time_only.png",
 "untitled-two-figures": f"{BH}/01_Scans/bird_3.jpg",
 "untitled-this-that-those": f"{BH}/01_Scans/aaaaaaaaaaa.jpg",
}
for slug, src in MUS_SRC.items():
    out = whiten(src, slug, clip=(228 if slug == "the-fun-one" else 240))
    # chalk version for dark grounds
    al = alpha_from_ink(out)
    chalk = np.dstack([np.full(al.shape + (3,), 240, dtype=np.float32), al]).astype("uint8")
    ch = Image.fromarray(chalk, "RGBA")
    save(flat(ch, DARK), slug, dark=True)
    print("  ", slug)

# birds in a tree — crop the sheet off the plank first
src = flat(Image.open(f"{UP}/2024/Untitled/01_PNGs/untitled_1x1.png")); src.thumbnail((2000, 2000), Image.LANCZOS)
a = np.asarray(src).astype(np.float32); lum = a.mean(axis=2); sat = a.max(axis=2) - a.min(axis=2)
sheet = (lum > 200) & (sat < 32)
cx = np.where(sheet.mean(axis=0) > 0.4)[0]; ry = np.where(sheet.mean(axis=1) > 0.4)[0]
crop = src.crop((int(cx.min()), int(ry.min()), int(cx.max()), int(ry.max()))) if len(cx) > 10 else src
crop.save("/tmp/birds_crop.png")
out = whiten("/tmp/birds_crop.png", "untitled-birds-in-a-tree", clip=232)
al = alpha_from_ink(out)
save(flat(Image.fromarray(np.dstack([np.full(al.shape + (3,), 240, dtype=np.float32), al]).astype("uint8"), "RGBA"), DARK),
     "untitled-birds-in-a-tree", dark=True)
print("   untitled-birds-in-a-tree (cropped)")

print("— Roek: transparent masters —")
TRANS = {
 "a-good-omen": f"{UP}/2025/A good omen/01_PNGs/A_good_omen_trans.png",
 "unbothered-on-a-hill": f"{UP}/2025/Unbothered on a hill/01_PNGs/IMG20260806192757.png",
 "hang-vogels": f"{UP}/2024/Hang Vogels/01_PNGs/hang vogels_trans.png",
 "snelle-vogel": f"{UP}/2024/Snelle Vogel/01_PNGs/snelle_vogel_trans.png",
 "vis-vogel": f"{UP}/2024/Vis Vogel/01_PNGs/vis_vogel_trans.png",
 "zatte-vogel": f"{UP}/2024/Zatte Vogel/01_PNGs/zatte_vogel_trans.png",
 "underneath": f"{UP}/2024/Underneath/01_PNGs/underneath_trans.png",
 "the-beach": f"{UP}/2024/The Beach/01_PNGs/01_the beach_trans.png",
}
for slug, src in TRANS.items():
    both(Image.open(src).convert("RGBA"), slug); print("  ", slug)

print("— Roek: keyed white studio shots —")
KEYED = {
 "a-manifesto": f"{UP}/2025/A manifesto/02_JPGs/A_manifesto_white.jpg",
 "beest-is-lief": f"{UP}/2023/Beest is Lief/02_JPGs/beest-is-lief_white.jpg",
 "the-bird-humans": f"{UP}/2024/the Bird Humans/02_JPGs/The_bird_humans_white_1.jpg",
 "the-hills-are-wild-and-messy": f"{UP}/2025/The hills are wild and messy/02_JPGs/the_hills_are_wild_and_messy.jpg",
}
for slug, src in KEYED.items():
    both(key_bg(src), slug); print("  ", slug)

print("— photographs (plates) —")
for slug, src in {"many-birds": f"{UP}/2025/00_Arts & craft market/Many_birds_1.jpg"}.items():
    im = flat(Image.open(src)); save(im, slug); save(im, slug, dark=True); print("  ", slug)

print("— Organic Intuition —")
GRAD_MAIN = f"{GRAD}/IMG20240226191021.jpg"
GAL = ["IMG20240226191016_1.jpg", "IMG20240304180144.jpg", "IMG20240226191017_1.jpg",
       "IMG20240226191013.jpg", "IMG20240226191012.jpg", "IMG20240226191020.jpg"]
im = flat(Image.open(GRAD_MAIN)); save(im, "organic-intuition"); save(im, "organic-intuition", dark=True)
for i, fn in enumerate(GAL, 1):
    g = flat(Image.open(f"{GRAD}/{fn}"))
    save(g, f"organic-intuition-{i}"); save(g, f"organic-intuition-{i}", dark=True)
print("   organic-intuition + %d gallery" % len(GAL))

print("— Muszine —")
os.system('pdftoppm -png -r 170 -f 1 -l 1 "/mnt/user-data/uploads/Muszine/00_Final/Cover.pdf" /tmp/muszine >/dev/null 2>&1')
cov = Image.open("/tmp/muszine-1.png").convert("RGB")
w, h = cov.size; cov = cov.crop((w // 2, 0, w, h))
save(cov, "muszine-2025"); save(cov, "muszine-2025", dark=True)
print("   muszine-2025", cov.size)

print("— hero (line art as PNG so strokes stay crisp) —")
im = flat(Image.open(f"{BH}/08_PNG/The_king_is_lonely.png"))
a = np.asarray(im).astype(np.float32); lum = a.mean(axis=2)
wp = float(min(max(np.percentile(lum, 80), 200), 248))
im = Image.fromarray(np.clip(a / wp * 255, 0, 255).astype("uint8"), "RGB")
im = im.filter(ImageFilter.UnsharpMask(radius=1.1, percent=95, threshold=2))
im.save("static/images/hero.png", "PNG", optimize=True)
print("   hero.png", im.size, os.path.getsize("static/images/hero.png") // 1024, "KB")

print("— logo + texture —")
frames = []
for f in ImageSequence.Iterator(Image.open(f"{WEB}/01_HEADER/logo_musroek_website_2.gif")):
    fr = f.convert("RGBA"); w, h = fr.size; sc = 160 / h
    fr = fr.resize((int(w * sc), 160), Image.LANCZOS)
    frames.append(fr.convert("P", palette=Image.ADAPTIVE, colors=16))
frames[0].save("static/images/musroek-logo.gif", save_all=True, append_images=frames[1:],
               duration=140, loop=0, optimize=True, disposal=2)

frames = []
for f in ImageSequence.Iterator(Image.open(f"{WEB}/01_HEADER/logo_musroek_website_white.gif")):
    fr = f.convert("RGBA"); w, h = fr.size; sc = 160 / h
    fr = fr.resize((int(w * sc), 160), Image.LANCZOS)
    mask = fr.split()[-1].point(lambda v: 255 if v > 110 else 0)
    p = Image.new("P", fr.size, 0)
    p.putpalette([0, 0, 0, 245, 242, 236] + [0, 0, 0] * 254)
    px = p.load(); mk = mask.load()
    for y in range(fr.size[1]):
        for x in range(fr.size[0]):
            px[x, y] = 1 if mk[x, y] else 0
    p.info["transparency"] = 0
    frames.append(p)
frames[0].save("static/images/musroek-logo-white.gif", save_all=True, append_images=frames[1:],
               duration=140, loop=0, transparency=0, disposal=2, optimize=False)

bg = Image.open(f"{WEB}/02_Photos/Backgrounds/background_about_1900px_migration.jpg").convert("RGB")
bg.thumbnail((1900, 1900), Image.LANCZOS)
bg.save("static/images/manifesto-bg.jpg", "JPEG", quality=78, optimize=True, progressive=True)

fav = flat(Image.open(f"{WEB}/01_HEADER/logo_musroek_website.png")) if os.path.isfile(f"{WEB}/01_HEADER/logo_musroek_website.png") else None
if fav:
    fav.thumbnail((180, 180), Image.LANCZOS); fav.save("static/images/favicon.png", "PNG")
print("   logo (dark + transparent white), texture, favicon")
print("\nDONE — images:", len(os.listdir("static/images/works")))
