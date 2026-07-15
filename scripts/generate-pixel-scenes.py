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
    "sky": (104, 211, 248),
    "sky2": (151, 235, 255),
    "sun": (255, 226, 77),
    "sea": (18, 128, 211),
    "sea2": (45, 181, 238),
    "foam": (164, 247, 255),
    "sand": (255, 218, 140),
    "sand2": (246, 194, 91),
    "skin": (198, 132, 80),
    "skin2": (158, 91, 55),
    "hair": (75, 41, 32),
    "hair2": (45, 28, 35),
    "pink": (226, 48, 118),
    "pink2": (177, 43, 104),
    "blue": (43, 129, 197),
    "blue2": (24, 86, 158),
    "cream": (255, 245, 207),
    "paper": (255, 252, 232),
    "green": (72, 211, 127),
    "red": (255, 83, 97),
    "purple": (87, 63, 147),
    "dark": (27, 24, 50),
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


def base(frame: int, dusk: bool = False) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (W, H), C["sky"])
    d = ImageDraw.Draw(img)
    if dusk:
        for y in range(0, 72):
            color = (120 + y // 3, 156 + y // 4, 240 - y // 5)
            rect(d, (0, y, W, y), color)
    else:
        rect(d, (0, 0, W, 74), C["sky2"])
        for y in range(0, 74, 6):
            rect(d, (0, y, W, y + 1), (125, 224, 250))

    sun_x = 248 + ((frame % 4) - 2)
    rect(d, (sun_x, 16, sun_x + 28, 44), C["sun"])
    rect(d, (sun_x - 8, 24, sun_x + 36, 36), C["sun"])
    rect(d, (sun_x + 6, 8, sun_x + 22, 52), C["sun"])

    for i, x in enumerate((24, 122, 220)):
        ox = (frame * (2 + i)) % 42
        y = 54 + i * 8
        rect(d, (x - ox, y, x + 42 - ox, y + 6), C["foam"])
        rect(d, (x + 18 - ox, y + 14, x + 72 - ox, y + 20), (207, 251, 255))

    rect(d, (0, 74, W, 126), C["sea"])
    for y in range(78, 126, 7):
        rect(d, (0, y, W, y + 2), C["sea2"])
    for i, x in enumerate((0, 70, 154, 246)):
        wx = x + ((frame + i) % 3) * 6
        rect(d, (wx, 90 + i % 2 * 18, wx + 52, 94 + i % 2 * 18), C["foam"])

    rect(d, (0, 126, W, H), C["sand"])
    for y in range(130, H, 7):
        rect(d, (0, y, W, y + 2), (255, 230, 169))
    for i, x in enumerate((18, 65, 118, 210, 268)):
        rect(d, (x, 156 + (i % 3) * 5, x + 28, 160 + (i % 3) * 5), C["sand2"])

    # Palm is grounded in the sand.
    rect(d, (26, 110, 38, 166), (110, 69, 43))
    rect(d, (24, 108, 41, 114), (130, 82, 48))
    sway = -2 if frame % 4 < 2 else 2
    rect(d, (15 + sway, 94, 56 + sway, 101), (12, 145, 88))
    rect(d, (29 + sway, 82, 38 + sway, 112), (18, 131, 88))
    rect(d, (5 + sway, 83, 31 + sway, 92), (21, 168, 98))
    rect(d, (40 + sway, 87, 64 + sway, 96), (22, 159, 91))
    return img, d


def person(d: ImageDraw.ImageDraw, x: int, ground: int, gender: str, frame: int, scale: int = 1, pose: str = "idle"):
    bob = frame % 4 in (1, 2)
    y = ground - 72 * scale + (1 if bob and pose == "idle" else 0)
    outfit = C["pink"] if gender == "female" else C["blue"]
    outfit2 = C["pink2"] if gender == "female" else C["blue2"]
    hair = C["hair"] if gender == "female" else C["hair2"]
    skin = C["skin"]
    s = scale

    # Feet and legs touch the ground.
    rect(d, (x + 8*s, ground - 6*s, x + 20*s, ground), C["ink"])
    rect(d, (x + 27*s, ground - 6*s, x + 39*s, ground), C["ink"])
    rect(d, (x + 12*s, y + 54*s, x + 20*s, ground - 5*s), C["skin2"])
    rect(d, (x + 28*s, y + 54*s, x + 36*s, ground - 5*s), C["skin2"])

    # Body.
    rect(d, (x + 8*s, y + 31*s, x + 40*s, y + 58*s), outfit, C["ink"], max(1, s))
    rect(d, (x + 8*s, y + 58*s, x + 40*s, y + 64*s), outfit2)
    rect(d, (x + 21*s, y + 31*s, x + 29*s, y + 44*s), skin)
    arm_y = y + (37 if pose != "wave" or frame % 4 < 2 else 33) * s
    rect(d, (x, arm_y, x + 10*s, arm_y + 7*s), skin, C["ink"], max(1, s))
    rect(d, (x + 39*s, y + 37*s, x + 49*s, y + 44*s), skin, C["ink"], max(1, s))

    # Head, hair and hat.
    rect(d, (x + 13*s, y + 12*s, x + 36*s, y + 35*s), skin, C["ink"], max(1, s))
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


def avatar(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = base(f)
        # Avatar cards need a readable full-body sprite, not a tiny distant figure.
        person(d, 108, 169, gender, f, scale=2, pose="wave")
        frames.append(img)
    save_gif(f"avatar-{gender}.gif", frames, CHAR_DIR)


def scene_start(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = base(f, dusk=True)
        person(d, 128, 169, gender, f, pose="wave")
        person(d, 178, 169, "male" if gender == "female" else "female", f + 2)
        rect(d, (104, 18, 216, 45), C["cream"], C["ink"], 2)
        for i, color in enumerate((C["red"], C["sun"], C["green"], C["blue"])):
            rect(d, (114 + i * 23, 26, 130 + i * 23, 34), color)
        rect(d, (114, 38, 202, 41), C["purple"])
        frames.append(img)
    save_gif(f"start-{gender}.gif", frames)


def scene_notebook(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = base(f)
        person(d, 58, 169, gender, f)
        rect(d, (136, 120, 248, 150), (132, 82, 48), C["ink"], 2)
        rect(d, (150, 92, 230, 135), C["paper"], C["ink"], 2)
        for i in range(5):
            rect(d, (160, 102 + i * 6, 215 - i * 5, 105 + i * 6), C["purple"])
        px = 214 - (f % 4) * 8
        rect(d, (px, 128, px + 22, 133), C["red"])
        frames.append(img)
    save_gif(f"notebook-{gender}.gif", frames)


def scene_laptop(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = base(f, dusk=True)
        person(d, 48, 169, gender, f)
        rect(d, (128, 96, 266, 152), C["dark"], C["ink"], 2)
        rect(d, (136, 104, 258, 140), (20, 35, 70))
        for i, w in enumerate((82, 52, 100, 68)):
            color = C["green"] if (f + i) % 2 else C["foam"]
            rect(d, (146, 111 + i * 7, 146 + w, 114 + i * 7), color)
        rect(d, (112, 152, 282, 162), (194, 194, 201), C["ink"], 2)
        frames.append(img)
    save_gif(f"laptop-{gender}.gif", frames)


def scene_active(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = base(f)
        person(d, 22, 169, gender, f, pose="wave")
        labels = [C["red"], C["blue"], C["green"], C["sun"]]
        for i, color in enumerate(labels):
            x = 96 + i * 50
            rect(d, (x, 60, x + 38, 112), C["cream"], C["ink"], 2)
            rect(d, (x + 5, 68, x + 33, 94), color)
            if (f + i) % 3 == 0:
                rect(d, (x + 10, 98, x + 28, 102), C["ink"])
        rect(d, (102, 124, 280, 154), C["paper"], C["ink"], 2)
        for i in range(4):
            rect(d, (112, 132 + i * 5, 156 + i * 24, 134 + i * 5), C["purple"])
        frames.append(img)
    save_gif(f"active-{gender}.gif", frames)


def scene_cocktails(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = base(f, dusk=True)
        person(d, 96, 169, gender, f)
        rect(d, (188, 126, 242, 132), C["cream"], C["ink"], 2)
        rect(d, (206, 132, 212, 168), C["ink"])
        rect(d, (228, 132, 234, 168), C["ink"])
        rect(d, (194, 102, 208, 126), C["blue"], C["ink"], 1)
        rect(d, (220, 98, 235, 126), C["red"], C["ink"], 1)
        rect(d, (192, 97, 210, 102), C["cream"])
        rect(d, (218, 93, 237, 98), C["cream"])
        frames.append(img)
    save_gif(f"cocktails-{gender}.gif", frames)


def scene_summary(gender: str):
    frames = []
    for f in range(FRAMES):
        img, d = base(f)
        person(d, 70, 169, gender, f, pose="wave")
        rect(d, (184, 68, 246, 130), C["sun"], C["ink"], 3)
        rect(d, (198, 54, 232, 74), C["sun"], C["ink"], 2)
        rect(d, (200, 132, 230, 146), C["sand2"], C["ink"], 2)
        for i in range(5):
            if (f + i) % 2 == 0:
                rect(d, (152 + i * 24, 36 + (i % 2) * 16, 160 + i * 24, 44 + (i % 2) * 16), C["green"])
        frames.append(img)
    save_gif(f"summary-{gender}.gif", frames)


def main():
    for gender in ("female", "male"):
        avatar(gender)
        scene_start(gender)
        scene_notebook(gender)
        scene_laptop(gender)
        scene_active(gender)
        scene_cocktails(gender)
        scene_summary(gender)
    # Beach talk uses the same grounded beach composition as start, but without title overlay in UI.
    for gender in ("female", "male"):
        src = SCENE_DIR / f"start-{gender}.gif"
        dst = SCENE_DIR / f"beach-talk-{gender}.gif"
        dst.write_bytes(src.read_bytes())
        legacy = SCENE_DIR / f"beach-{gender}.gif"
        legacy.write_bytes(src.read_bytes())


if __name__ == "__main__":
    main()
