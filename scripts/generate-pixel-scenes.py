from __future__ import annotations

import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SCENE_DIR = ROOT / "public" / "assets" / "pixel-scenes"
CHAR_DIR = ROOT / "public" / "assets" / "characters"
W, H = 320, 180
SCALE = 2
FRAMES = 8
FONT_CANDIDATES = (
    Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
)

C = {
    "ink": (35, 24, 42),
    "sky": (122, 221, 249),
    "sky2": (157, 238, 255),
    "sea": (19, 126, 211),
    "sea2": (46, 181, 238),
    "foam": (176, 249, 255),
    "sand": (255, 220, 145),
    "sand2": (235, 181, 80),
    "sun": (255, 229, 72),
    "cream": (255, 247, 214),
    "paper": (255, 253, 235),
    "desk": (126, 79, 50),
    "desk2": (173, 111, 65),
    "dark": (26, 24, 49),
    "screen": (20, 42, 77),
    "skin": (198, 132, 80),
    "skin2": (155, 88, 52),
    "hair": (76, 42, 32),
    "hair2": (46, 30, 39),
    "pink": (226, 48, 118),
    "pink2": (178, 43, 104),
    "blue": (43, 129, 197),
    "blue2": (24, 86, 158),
    "green": (72, 211, 127),
    "green2": (34, 154, 94),
    "red": (255, 83, 97),
    "yellow": (255, 208, 74),
    "purple": (86, 63, 147),
    "violet": (210, 205, 255),
}


def rect(d: ImageDraw.ImageDraw, xy, fill, outline=None, width=1):
    d.rectangle(xy, fill=fill, outline=outline, width=width)


def save_gif(name: str, frames: list[Image.Image], folder: Path = SCENE_DIR):
    folder.mkdir(parents=True, exist_ok=True)
    scaled = [frame.resize((frame.width * SCALE, frame.height * SCALE), Image.Resampling.NEAREST) for frame in frames]
    scaled[0].save(
        folder / name,
        save_all=True,
        append_images=scaled[1:],
        duration=120,
        loop=0,
        optimize=False,
        disposal=2,
    )


def load_font(size: int):
    for path in FONT_CANDIDATES:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def centered_text(d: ImageDraw.ImageDraw, box, text: str, font, fill):
    left, top, right, bottom = box
    bbox = d.textbbox((0, 0), text, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = left + (right - left - width) // 2
    y = top + (bottom - top - height) // 2
    d.text((x + 1, y + 1), text, font=font, fill=(154, 116, 42))
    d.text((x, y), text, font=font, fill=fill)


def beach_bg(frame: int, dusk: bool = False) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (W, H), C["sky"])
    d = ImageDraw.Draw(img)
    if dusk:
        for y in range(76):
            rect(d, (0, y, W, y), (119 + y // 4, 153 + y // 5, 238 - y // 7))
    else:
        rect(d, (0, 0, W, 76), C["sky2"])
        for y in range(0, 76, 6):
            rect(d, (0, y, W, y + 1), (132, 226, 250))
    sx = 250 + (1 if frame % 4 in (1, 2) else 0)
    rect(d, (sx, 15, sx + 27, 42), C["sun"])
    rect(d, (sx - 8, 23, sx + 35, 35), C["sun"])
    rect(d, (sx + 6, 7, sx + 21, 51), C["sun"])
    rect(d, (0, 76, W, 128), C["sea"])
    for y in range(80, 126, 7):
        rect(d, (0, y, W, y + 2), C["sea2"])
    for i, x in enumerate((12, 94, 181, 260)):
        dx = (frame * (i + 1) * 3) % 44
        rect(d, (x - dx, 94 + i % 2 * 18, x + 52 - dx, 98 + i % 2 * 18), C["foam"])
    rect(d, (0, 128, W, H), C["sand"])
    for y in range(132, H, 7):
        rect(d, (0, y, W, y + 2), (255, 232, 174))
    for i, x in enumerate((20, 68, 132, 216, 270)):
        rect(d, (x, 156 + i % 3 * 5, x + 28, 160 + i % 3 * 5), C["sand2"])
    rect(d, (27, 112, 38, 166), (107, 67, 43))
    sway = -2 if frame % 4 < 2 else 2
    rect(d, (14 + sway, 93, 57 + sway, 100), C["green2"])
    rect(d, (29 + sway, 81, 38 + sway, 112), (17, 128, 88))
    rect(d, (5 + sway, 84, 32 + sway, 92), C["green"])
    return img, d


def room_bg(frame: int, wall=(197, 235, 229)) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (W, H), wall)
    d = ImageDraw.Draw(img)
    for y in range(0, 116, 8):
        rect(d, (0, y, W, y + 1), (180, 220, 219))
    rect(d, (0, 116, W, H), (94, 73, 100))
    for x in range(0, W, 34):
        rect(d, (x, 116, x + 20, 119), (121, 93, 121))
    rect(d, (26, 38, 106, 72), C["cream"], C["ink"], 2)
    for i, color in enumerate((C["red"], C["yellow"], C["green"], C["blue"])):
        rect(d, (36 + i * 15, 48, 47 + i * 15, 58), color)
    return img, d


def person(d: ImageDraw.ImageDraw, x: int, ground: int, gender: str, frame: int, scale: int = 1, pose: str = "idle"):
    s = scale
    bob = 1 if frame % 4 in (1, 2) and pose == "idle" else 0
    y = ground - 72 * s + bob
    outfit = C["pink"] if gender == "female" else C["blue"]
    outfit2 = C["pink2"] if gender == "female" else C["blue2"]
    hair = C["hair"] if gender == "female" else C["hair2"]
    rect(d, (x + 8*s, ground - 6*s, x + 20*s, ground), C["ink"])
    rect(d, (x + 27*s, ground - 6*s, x + 39*s, ground), C["ink"])
    rect(d, (x + 12*s, y + 54*s, x + 20*s, ground - 5*s), C["skin2"])
    rect(d, (x + 28*s, y + 54*s, x + 36*s, ground - 5*s), C["skin2"])
    rect(d, (x + 8*s, y + 31*s, x + 40*s, y + 58*s), outfit, C["ink"], max(1, s))
    rect(d, (x + 8*s, y + 58*s, x + 40*s, y + 64*s), outfit2)
    rect(d, (x + 21*s, y + 31*s, x + 29*s, y + 44*s), C["skin"])
    arm_up = pose == "wave" and frame % 4 < 2
    rect(d, (x, y + (33 if arm_up else 37)*s, x + 10*s, y + (40 if arm_up else 44)*s), C["skin"], C["ink"], max(1, s))
    rect(d, (x + 39*s, y + 37*s, x + 49*s, y + 44*s), C["skin"], C["ink"], max(1, s))
    rect(d, (x + 13*s, y + 12*s, x + 36*s, y + 35*s), C["skin"], C["ink"], max(1, s))
    rect(d, (x + 14*s, y + 12*s, x + 36*s, y + 18*s), hair)
    if gender == "female":
        rect(d, (x + 8*s, y + 18*s, x + 14*s, y + 44*s), hair)
        rect(d, (x + 36*s, y + 18*s, x + 42*s, y + 44*s), hair)
    rect(d, (x + 17*s, y + 22*s, x + 20*s, y + 25*s), C["ink"])
    rect(d, (x + 29*s, y + 22*s, x + 32*s, y + 25*s), C["ink"])
    rect(d, (x + 22*s, y + 30*s, x + 30*s, y + 33*s), C["skin2"])
    rect(d, (x + 10*s, y + 4*s, x + 39*s, y + 13*s), C["cream"], C["ink"], max(1, s))
    rect(d, (x + 4*s, y + 13*s, x + 45*s, y + 18*s), (222, 182, 100), C["ink"], max(1, s))
    rect(d, (x + 12*s, y + 10*s, x + 37*s, y + 13*s), outfit2)


def laptop_close(d: ImageDraw.ImageDraw, frame: int):
    rect(d, (22, 132, 298, 178), C["desk"], C["ink"], 3)
    rect(d, (56, 35, 264, 134), C["dark"], C["ink"], 4)
    rect(d, (66, 45, 254, 122), C["screen"])
    for i, w in enumerate((126, 82, 150, 108, 64)):
        color = (C["green"], C["foam"], C["yellow"], C["red"], C["violet"])[i]
        rect(d, (80, 58 + i * 11, 80 + w + (frame % 3) * 3, 62 + i * 11), color)
    rect(d, (38, 136, 282, 150), (195, 196, 205), C["ink"], 3)
    rect(d, (100, 150, 220, 160), (150, 151, 166), C["ink"], 2)
    rect(d, (32, 142, 84, 170), C["skin"], C["ink"], 2)
    rect(d, (236, 142, 288, 170), C["skin"], C["ink"], 2)


def video_call_bust(d: ImageDraw.ImageDraw, x: int, y: int, gender: str, frame: int):
    hair = C["hair"] if gender == "female" else C["hair2"]
    outfit = C["pink"] if gender == "female" else C["blue"]
    outfit2 = C["pink2"] if gender == "female" else C["blue2"]
    bob = 1 if frame % 4 in (1, 2) else 0
    rect(d, (x + 8, y + 38, x + 48, y + 60), outfit, C["ink"], 2)
    rect(d, (x + 8, y + 56, x + 48, y + 62), outfit2)
    rect(d, (x + 23, y + 38, x + 33, y + 50), C["skin"])
    rect(d, (x + 4, y + 44, x + 12, y + 54), C["skin"], C["ink"], 1)
    rect(d, (x + 44, y + 44, x + 52, y + 54), C["skin"], C["ink"], 1)
    rect(d, (x + 15, y + 12 + bob, x + 41, y + 39 + bob), C["skin"], C["ink"], 2)
    rect(d, (x + 14, y + 12 + bob, x + 42, y + 19 + bob), hair)
    if gender == "female":
        rect(d, (x + 8, y + 18 + bob, x + 15, y + 45 + bob), hair)
        rect(d, (x + 41, y + 18 + bob, x + 48, y + 45 + bob), hair)
    rect(d, (x + 19, y + 23 + bob, x + 22, y + 26 + bob), C["ink"])
    rect(d, (x + 33, y + 23 + bob, x + 36, y + 26 + bob), C["ink"])
    rect(d, (x + 25, y + 32 + bob, x + 32, y + 35 + bob), C["skin2"])
    rect(d, (x + 13, y + 6 + bob, x + 43, y + 14 + bob), C["cream"], C["ink"], 1)
    rect(d, (x + 8, y + 14 + bob, x + 48, y + 18 + bob), (222, 182, 100), C["ink"], 1)


def phone(d: ImageDraw.ImageDraw, x: int, y: int, frame: int, color=C["green"]):
    rect(d, (x, y, x + 44, y + 76), C["dark"], C["ink"], 3)
    rect(d, (x + 6, y + 10, x + 38, y + 62), C["violet"])
    for i in range(3):
        rect(d, (x + 11, y + 20 + i * 12, x + 32 + (frame + i) % 4, y + 25 + i * 12), color)
    rect(d, (x + 19, y + 66, x + 25, y + 70), C["cream"])


def bird(d: ImageDraw.ImageDraw, x: int, y: int, wing: int = 0):
    lift = 1 if wing % 2 else 0
    d.line((x, y + 3, x + 5, y + lift, x + 10, y + 3), fill=C["ink"], width=2)


def scene_avatar(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = beach_bg(f)
        person(d, 108, 169, gender, f, scale=2, pose="wave")
        frames.append(img)
    save_gif(f"avatar-{gender}.gif", frames, CHAR_DIR)


def scene_start(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = beach_bg(f, dusk=True)
        person(d, 116, 169, gender, f, pose="wave")
        person(d, 172, 169, "male" if gender == "female" else "female", f + 2)
        bird_offset = (f * 5) % 42
        bird(d, 88 + bird_offset, 28, f)
        bird(d, 124 + bird_offset, 22, f + 1)
        bird(d, 166 + bird_offset, 32, f)
        frames.append(img)
    save_gif(f"start-{gender}.gif", frames)


def scene_beach_talk(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = beach_bg(f, dusk=True)
        person(d, 94, 169, gender, f)
        person(d, 176, 169, "male" if gender == "female" else "female", f + 2)
        bird_offset = (f * 4) % 38
        bird(d, 78 + bird_offset, 30, f)
        bird(d, 126 + bird_offset, 24, f + 1)
        bird(d, 188 + bird_offset, 34, f)
        frames.append(img)
    save_gif(f"beach-talk-{gender}.gif", frames)
    save_gif(f"beach-{gender}.gif", frames)


def scene_product(gender: str):
    bubble_font = load_font(18)
    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), (181, 234, 238))
        d = ImageDraw.Draw(img)
        for y in range(0, H, 8):
            rect(d, (0, y, W, y + 1), (162, 220, 228))
        rect(d, (0, 120, W, H), (238, 222, 178))
        for x in range(0, W, 28):
            rect(d, (x, 134 + (x // 28) % 2 * 10, x + 18, 137 + (x // 28) % 2 * 10), (218, 188, 112))

        rect(d, (138, 28, 294, 104), C["paper"], C["ink"], 3)
        rect(d, (130, 86, 156, 106), C["paper"], C["ink"], 2)
        rect(d, (128, 90, 144, 102), C["paper"])
        centered_text(d, (150, 42, 282, 66), "Что же", bubble_font, C["ink"])
        centered_text(d, (150, 68, 282, 92), "я хочу?", bubble_font, C["ink"])

        person(d, 48, 176, gender, f, scale=2, pose="idle")
        frames.append(img)
    save_gif(f"product-{gender}.gif", frames)


def scene_notebook(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = room_bg(f)
        person(d, 18, 167, gender, f)
        rect(d, (92, 52, 286, 166), C["paper"], C["ink"], 3)
        for i, color in enumerate((C["yellow"], C["green"], C["violet"], C["red"], C["blue"])):
            x = 108 + (i % 3) * 54
            y = 68 + (i // 3) * 42
            rect(d, (x, y, x + 40, y + 28), color, C["ink"], 2)
            rect(d, (x + 8, y + 18, x + 32, y + 21), C["ink"])
        frames.append(img)
    save_gif(f"notebook-{gender}.gif", frames)


def scene_price(gender: str):
    digit_font = load_font(18)
    amounts = ("5 000", "15 000", "30 000", "50 000")
    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), (211, 232, 255))
        d = ImageDraw.Draw(img)
        for y in range(0, H, 8):
            rect(d, (0, y, W, y + 1), (185, 215, 238))
        rect(d, (0, 122, W, H), (230, 213, 176))
        for x in range(0, W, 30):
            rect(d, (x, 138 + (x // 30) % 2 * 12, x + 18, 141 + (x // 30) % 2 * 12), (204, 176, 112))

        person(d, 36, 176, gender, f, scale=2, pose="idle")
        rect(d, (168, 32, 284, 156), C["dark"], C["ink"], 4)
        rect(d, (182, 46, 270, 82), C["green"], C["ink"], 2)
        rect(d, (190, 54, 262, 74), (98, 239, 151))
        centered_text(d, (188, 52, 264, 76), amounts[(f // 2) % len(amounts)], digit_font, C["ink"])
        for r in range(3):
            for c in range(3):
                x = 184 + c * 28
                y = 96 + r * 16
                rect(d, (x, y, x + 18, y + 10), C["cream"], C["ink"], 1)
        rect(d, (264, 96, 276, 138), C["yellow"], C["ink"], 1)
        frames.append(img)
    save_gif(f"price-{gender}.gif", frames)


def scene_dream(gender: str):
    sign_font = load_font(12)
    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), C["sky2"])
        d = ImageDraw.Draw(img)
        for y in range(0, 84, 8):
            rect(d, (0, y, W, y + 1), (132, 226, 250))
        sx = 266 + (1 if f % 4 in (1, 2) else 0)
        rect(d, (sx, 16, sx + 25, 40), C["sun"])
        rect(d, (sx - 7, 24, sx + 32, 33), C["sun"])
        rect(d, (sx + 6, 8, sx + 19, 48), C["sun"])

        rect(d, (0, 128, W, H), (184, 174, 155))
        for x in range(0, W, 28):
            rect(d, (x, 140 + (x // 28) % 2 * 12, x + 18, 143 + (x // 28) % 2 * 12), (150, 142, 130))

        shops = [
            (16, 60, 98, 130, C["blue"], "Техника"),
            (118, 50, 202, 130, C["pink"], "Одежда"),
            (222, 62, 304, 130, C["green"], "Банк"),
        ]
        for left, top, right, bottom, color, label in shops:
            rect(d, (left, top, right, bottom), C["paper"], C["ink"], 3)
            rect(d, (left + 6, top + 8, right - 6, top + 26), color, C["ink"], 2)
            centered_text(d, (left + 8, top + 9, right - 8, top + 25), label, sign_font, C["ink"])
            rect(d, (left + 12, top + 36, right - 12, bottom - 8), (198, 230, 245), C["ink"], 2)
            rect(d, (left + 18, bottom - 34, right - 18, bottom - 8), (97, 82, 108), C["ink"], 2)

        person(d, 128, 176, gender, f, scale=1, pose="wave")
        frames.append(img)
    save_gif(f"dream-{gender}.gif", frames)


def scene_goal(gender: str):
    bubble_font = load_font(18)
    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), (198, 238, 236))
        d = ImageDraw.Draw(img)
        for y in range(0, H, 8):
            rect(d, (0, y, W, y + 1), (178, 222, 226))
        rect(d, (0, 122, W, H), (244, 225, 178))
        for x in range(0, W, 30):
            rect(d, (x, 136 + (x // 30) % 2 * 12, x + 20, 139 + (x // 30) % 2 * 12), (219, 190, 112))
        person(d, 38, 176, gender, f, scale=2, pose="wave")
        rect(d, (126, 42, 300, 112), C["paper"], C["ink"], 3)
        rect(d, (112, 102, 138, 122), C["paper"], C["ink"], 3)
        rect(d, (118, 98, 142, 114), C["paper"])
        centered_text(d, (140, 56, 288, 78), "Цель и мечта", bubble_font, C["ink"])
        centered_text(d, (140, 78, 288, 100), "готовы!", bubble_font, C["ink"])
        frames.append(img)
    save_gif(f"goal-{gender}.gif", frames)


def scene_rules(gender: str):
    title_font = load_font(22)
    subtitle_font = load_font(20)
    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), (205, 238, 232))
        d = ImageDraw.Draw(img)
        for y in range(0, 116, 8):
            rect(d, (0, y, W, y + 1), (184, 224, 223))
        rect(d, (0, 116, W, H), (91, 72, 100))
        for x in range(0, W, 34):
            rect(d, (x, 116, x + 20, 119), (119, 92, 121))

        rect(d, (104, 34, 292, 138), C["yellow"], C["ink"], 4)
        rect(d, (112, 42, 284, 130), (255, 224, 101))
        for y in range(52, 128, 8):
            rect(d, (116, y, 280, y + 1), (221, 177, 66))
        rect(d, (96, 138, 300, 144), C["ink"])

        centered_text(d, (118, 58, 278, 84), "Правила", title_font, C["ink"])
        centered_text(d, (126, 88, 270, 114), "игры", subtitle_font, C["ink"])

        person(d, 28, 168, gender, f)
        tip_y = 78 + (1 if f % 4 in (1, 2) else 0)
        d.line((78, 132, 118, tip_y), fill=C["desk2"], width=3)
        d.line((78, 132, 118, tip_y), fill=C["ink"], width=1)
        rect(d, (116, tip_y - 2, 121, tip_y + 2), C["ink"])
        frames.append(img)
    save_gif(f"rules-{gender}.gif", frames)


def scene_reflection(gender: str):
    bubble_font = load_font(16)
    frames = []
    for f in range(FRAMES):
        img, d = beach_bg(f, dusk=False)
        bird_offset = (f * 4) % 48
        bird(d, 88 + bird_offset, 30, f)
        bird(d, 140 + bird_offset, 24, f + 1)
        bird(d, 204 + bird_offset, 36, f)
        person(d, 34, 170, gender, f, scale=2)

        rect(d, (140, 42, 304, 122), C["paper"], C["ink"], 3)
        rect(d, (124, 94, 146, 114), C["paper"], C["ink"], 2)
        rect(d, (124, 98, 140, 110), C["paper"])
        centered_text(d, (154, 58, 292, 78), "Что мне", bubble_font, C["ink"])
        centered_text(d, (148, 82, 298, 104), "сделать сейчас?", bubble_font, C["ink"])
        frames.append(img)
    save_gif(f"reflection-{gender}.gif", frames)
    save_gif(f"cocktails-{gender}.gif", frames)


def scene_resume(gender: str):
    bubble_font = load_font(15)
    frames = []
    for f in range(FRAMES):
        img = Image.new("RGB", (W, H), (181, 234, 238))
        d = ImageDraw.Draw(img)
        for y in range(0, H, 8):
            rect(d, (0, y, W, y + 1), (162, 220, 228))
        rect(d, (0, 120, W, H), (238, 222, 178))
        for x in range(0, W, 28):
            rect(d, (x, 134 + (x // 28) % 2 * 10, x + 18, 137 + (x // 28) % 2 * 10), (218, 188, 112))

        rect(d, (132, 26, 302, 118), C["paper"], C["ink"], 3)
        rect(d, (124, 94, 154, 116), C["paper"], C["ink"], 2)
        rect(d, (124, 98, 142, 110), C["paper"])
        centered_text(d, (144, 40, 290, 60), "Продолжаем", bubble_font, C["ink"])
        centered_text(d, (144, 64, 290, 84), "или сыграем", bubble_font, C["ink"])
        centered_text(d, (144, 88, 290, 108), "заново?", bubble_font, C["ink"])

        person(d, 48, 176, gender, f, scale=2, pose="wave")
        frames.append(img)
    save_gif(f"resume-{gender}.gif", frames)


def scene_prepare(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = room_bg(f, (190, 222, 233))
        laptop_close(d, f)
        rect(d, (204, 58, 240 + (f % 2) * 4, 68), C["red"])
        rect(d, (204, 76, 232, 86), C["yellow"])
        rect(d, (204, 94, 248, 104), C["green"])
        frames.append(img)
    save_gif(f"prepare-{gender}.gif", frames)
    save_gif(f"laptop-{gender}.gif", frames)


def scene_advice(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = room_bg(f, (216, 225, 252))
        rect(d, (26, 130, 294, 176), C["desk"], C["ink"], 3)
        rect(d, (54, 28, 266, 132), C["dark"], C["ink"], 4)
        rect(d, (64, 38, 256, 122), C["screen"])
        rect(d, (74, 48, 154, 100), C["cream"], C["ink"], 2)
        rect(d, (166, 48, 246, 100), (226, 234, 255), C["ink"], 2)
        rect(d, (78, 52, 150, 96), (188, 224, 238))
        rect(d, (170, 52, 242, 96), (246, 220, 228))
        video_call_bust(d, 84, 40, "male", f)
        video_call_bust(d, 176, 40, "female", f + 2)
        rect(d, (104, 104, 216, 108), C["violet"])
        frames.append(img)
    save_gif(f"advice-{gender}.gif", frames)


def scene_rest(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = beach_bg(f)
        rect(d, (90, 132, 196, 144), C["red"], C["ink"], 2)
        rect(d, (100, 116, 210, 128), C["cream"], C["ink"], 2)
        person(d, 126, 169, gender, f)
        rect(d, (232, 116, 252, 152), C["blue"], C["ink"], 2)
        rect(d, (228, 110, 256, 116), C["cream"])
        frames.append(img)
    save_gif(f"rest-{gender}.gif", frames)


def scene_action(gender: str):
    title_font = load_font(16)
    row_font = load_font(15)
    frames = []
    for f in range(FRAMES):
        img, d = room_bg(f, (198, 236, 240))
        person(d, 28, 168, gender, f, pose="wave")
        rect(d, (104, 32, 292, 156), C["paper"], C["ink"], 4)
        rect(d, (112, 40, 284, 148), (255, 253, 238))
        centered_text(d, (126, 48, 270, 68), "Чеклист запуска", title_font, C["ink"])

        rows = [("Реклама", 82), ("Прогрев", 106), ("Продажи", 130)]
        checked = min(3, f // 3 + 1)
        for index, (label, y) in enumerate(rows):
            rect(d, (122, y - 7, 136, y + 7), C["cream"], C["ink"], 2)
            d.text((148, y - 10), label, font=row_font, fill=C["ink"])
            if index < checked:
                d.line((124, y, 129, y + 5, 136, y - 6), fill=C["green2"], width=3)

        pencil_row = min(2, f // 3)
        pencil_y = rows[pencil_row][1] - 11 + (1 if f % 2 else 0)
        pencil_x = 240 + (f % 3) * 3
        rect(d, (pencil_x, pencil_y, pencil_x + 30, pencil_y + 6), C["yellow"], C["ink"], 1)
        rect(d, (pencil_x + 30, pencil_y + 1, pencil_x + 36, pencil_y + 5), C["skin2"], C["ink"], 1)
        rect(d, (pencil_x - 5, pencil_y, pencil_x, pencil_y + 6), C["red"], C["ink"], 1)
        frames.append(img)
    save_gif(f"action-{gender}.gif", frames)


def scene_active(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = room_bg(f, (187, 229, 238))
        rect(d, (18, 128, 302, 176), C["desk"], C["ink"], 3)
        rect(d, (46, 28, 274, 128), C["dark"], C["ink"], 4)
        rect(d, (56, 38, 264, 118), C["screen"])
        for i, color in enumerate((C["red"], C["yellow"], C["green"], C["blue"])):
            rect(d, (70 + i * 45, 50, 100 + i * 45, 80), color, C["ink"], 2)
        for i, h in enumerate((18, 34, 48, 28)):
            rect(d, (78 + i * 42, 106 - h - (f % 2) * 2, 96 + i * 42, 106), (C["green"], C["yellow"], C["red"], C["blue"])[i])
        rect(d, (236, 52, 252, 68), C["yellow"])
        rect(d, (232, 58, 256, 62), C["yellow"])
        frames.append(img)
    save_gif(f"active-{gender}.gif", frames)


def scene_summary(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = room_bg(f, (222, 237, 222))
        person(d, 22, 167, gender, f, pose="wave")
        rect(d, (92, 34, 284, 146), C["paper"], C["ink"], 3)
        rect(d, (112, 50, 260, 62), C["red"])
        rect(d, (112, 76, 202, 84), C["yellow"])
        rect(d, (112, 100, 238, 108), C["green"])
        rect(d, (218, 112, 260, 132), C["yellow"], C["ink"], 2)
        if f % 2 == 0:
            rect(d, (72, 42, 80, 50), C["green"])
            rect(d, (288, 66, 296, 74), C["yellow"])
        frames.append(img)
    save_gif(f"summary-{gender}.gif", frames)


def main():
    only = set(sys.argv[1:])
    for gender in ("female", "male"):
        if "start" in only:
            scene_start(gender)
            continue
        if "beach-talk" in only:
            scene_beach_talk(gender)
            continue
        if "rules" in only:
            scene_rules(gender)
            continue
        if "product" in only:
            scene_product(gender)
            continue
        if "notebook" in only:
            scene_notebook(gender)
            continue
        if "price" in only:
            scene_price(gender)
            continue
        if "dream" in only:
            scene_dream(gender)
            continue
        if "resume" in only:
            scene_resume(gender)
            continue
        if "reflection" in only:
            scene_reflection(gender)
            continue
        if "action" in only:
            scene_action(gender)
            continue
        if "advice" in only:
            scene_advice(gender)
            continue
        scene_avatar(gender)
        scene_start(gender)
        scene_beach_talk(gender)
        scene_product(gender)
        scene_notebook(gender)
        scene_price(gender)
        scene_dream(gender)
        scene_goal(gender)
        scene_rules(gender)
        scene_reflection(gender)
        scene_resume(gender)
        scene_prepare(gender)
        scene_advice(gender)
        scene_rest(gender)
        scene_action(gender)
        scene_active(gender)
        scene_summary(gender)


if __name__ == "__main__":
    main()
