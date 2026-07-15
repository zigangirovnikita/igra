from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SCENE_DIR = ROOT / "public" / "assets" / "pixel-scenes"
CHAR_DIR = ROOT / "public" / "assets" / "characters"
W, H = 320, 180
SCALE = 2
FRAMES = 8

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


def phone(d: ImageDraw.ImageDraw, x: int, y: int, frame: int, color=C["green"]):
    rect(d, (x, y, x + 44, y + 76), C["dark"], C["ink"], 3)
    rect(d, (x + 6, y + 10, x + 38, y + 62), C["violet"])
    for i in range(3):
        rect(d, (x + 11, y + 20 + i * 12, x + 32 + (frame + i) % 4, y + 25 + i * 12), color)
    rect(d, (x + 19, y + 66, x + 25, y + 70), C["cream"])


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
        rect(d, (92, 18, 228, 44), C["cream"], C["ink"], 2)
        for i, color in enumerate((C["red"], C["yellow"], C["green"], C["blue"], C["pink"])):
            rect(d, (104 + i * 20, 27, 118 + i * 20, 34), color)
        frames.append(img)
    save_gif(f"start-{gender}.gif", frames)


def scene_beach_talk(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = beach_bg(f, dusk=True)
        person(d, 94, 169, gender, f)
        person(d, 176, 169, "male" if gender == "female" else "female", f + 2)
        rect(d, (66, 28, 250, 56), C["paper"], C["ink"], 2)
        rect(d, (88, 39, 145, 43), C["purple"])
        rect(d, (158, 39, 223, 43), C["green"])
        frames.append(img)
    save_gif(f"beach-talk-{gender}.gif", frames)
    save_gif(f"beach-{gender}.gif", frames)


def scene_product(gender: str):
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
    save_gif(f"product-{gender}.gif", frames)
    save_gif(f"notebook-{gender}.gif", frames)


def scene_price(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = room_bg(f, (211, 232, 255))
        rect(d, (34, 132, 286, 176), C["desk"], C["ink"], 3)
        rect(d, (56, 50, 152, 132), C["paper"], C["ink"], 3)
        for i, w in enumerate((52, 72, 40, 62)):
            rect(d, (72, 66 + i * 13, 72 + w, 70 + i * 13), (C["purple"], C["green"], C["red"], C["blue"])[i])
        rect(d, (180, 54, 260, 130), C["dark"], C["ink"], 3)
        rect(d, (192, 66, 248, 84), C["green"])
        for r in range(3):
            for c in range(3):
                rect(d, (194 + c * 18, 94 + r * 10, 206 + c * 18, 100 + r * 10), C["cream"])
        rect(d, (136 + (f % 3) * 4, 139, 198 + (f % 3) * 4, 150), C["yellow"], C["ink"], 2)
        frames.append(img)
    save_gif(f"price-{gender}.gif", frames)


def scene_dream(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = beach_bg(f)
        rect(d, (44, 32, 276, 138), C["paper"], C["ink"], 3)
        rect(d, (58, 46, 122, 92), C["violet"], C["ink"], 2)
        rect(d, (145, 46, 211, 92), C["green"], C["ink"], 2)
        rect(d, (224, 52, 256, 84), C["yellow"], C["ink"], 2)
        rect(d, (78, 108, 242, 116), C["purple"])
        person(d, 136, 170, gender, f, pose="wave")
        frames.append(img)
    save_gif(f"dream-{gender}.gif", frames)


def scene_goal(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = room_bg(f, (215, 243, 224))
        person(d, 26, 167, gender, f)
        rect(d, (112, 34, 270, 138), C["paper"], C["ink"], 3)
        rect(d, (132, 52, 204, 124), C["yellow"], C["ink"], 3)
        rect(d, (149, 42, 187, 62), C["yellow"], C["ink"], 2)
        rect(d, (216, 58, 252, 66), C["green"])
        rect(d, (216, 78, 246, 86), C["red"])
        rect(d, (216, 98, 256, 106), C["blue"])
        if f % 2 == 0:
            rect(d, (92, 36, 100, 44), C["green"])
            rect(d, (278, 62, 286, 70), C["yellow"])
        frames.append(img)
    save_gif(f"goal-{gender}.gif", frames)


def scene_reflection(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = room_bg(f, (205, 238, 232))
        person(d, 34, 167, gender, f)
        rect(d, (100, 86, 286, 166), C["desk"], C["ink"], 3)
        rect(d, (124, 42, 264, 118), C["dark"], C["ink"], 3)
        rect(d, (135, 54, 253, 106), C["screen"])
        for i, h in enumerate((20, 35, 52)):
            rect(d, (148 + i * 30, 96 - h, 166 + i * 30, 96), (C["red"], C["yellow"], C["green"])[i])
        phone(d, 270, 74, f, C["red"])
        frames.append(img)
    save_gif(f"reflection-{gender}.gif", frames)
    save_gif(f"cocktails-{gender}.gif", frames)


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
        rect(d, (34, 130, 286, 176), C["desk"], C["ink"], 3)
        rect(d, (58, 30, 264, 132), C["dark"], C["ink"], 4)
        rect(d, (68, 40, 254, 122), C["screen"])
        rect(d, (80, 52, 142, 110), C["cream"], C["ink"], 2)
        person(d, 86, 112, "male" if gender == "female" else "female", f, scale=1)
        for i, color in enumerate((C["green"], C["yellow"], C["red"])):
            rect(d, (164, 62 + i * 18, 228 - i * 12, 70 + i * 18), color)
        rect(d, (230 + f % 2 * 3, 56, 238 + f % 2 * 3, 64), C["foam"])
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
    frames = []
    for f in range(FRAMES):
        img, d = room_bg(f, (198, 236, 240))
        rect(d, (34, 132, 286, 176), C["desk"], C["ink"], 3)
        person(d, 24, 167, gender, f)
        for i, color in enumerate((C["red"], C["yellow"], C["green"])):
            x = 104 + i * 58
            rect(d, (x, 48, x + 44, 106), C["paper"], C["ink"], 3)
            rect(d, (x + 7, 58, x + 37, 84), color)
            rect(d, (x + 10, 94, x + 34, 99), C["ink"])
        rect(d, (104, 118, 264, 128), C["violet"], C["ink"], 2)
        rect(d, (104, 118, 146 + f * 6, 128), C["green"])
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
    for gender in ("female", "male"):
        scene_avatar(gender)
        scene_start(gender)
        scene_beach_talk(gender)
        scene_product(gender)
        scene_price(gender)
        scene_dream(gender)
        scene_goal(gender)
        scene_reflection(gender)
        scene_prepare(gender)
        scene_advice(gender)
        scene_rest(gender)
        scene_action(gender)
        scene_active(gender)
        scene_summary(gender)


if __name__ == "__main__":
    main()
