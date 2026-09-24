"""Generate the deterministic Greenroom avatar atlases.

Every output is exactly 8 rows x 7 columns: N, NE, E, SE, S, SW, W, NW;
the first column is a planted idle pose and the remaining six are walk frames.
The art is intentionally simple, original, and pixel-crisp so frame geometry is
never dependent on an image model's atlas interpretation.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/client/public/assets/avatars"
W, H = 160, 240
S = 2
DIRECTIONS = ("n", "ne", "e", "se", "s", "sw", "w", "nw")

LOOKS = {
    "avatar-green": dict(name="Forest", gender="m", skin="#a9653d", hair="#211b1a", top="#315844", accent="#d7d0b5", bottom="#24282d", shoe="#dce1d2", hair_style="crop"),
    "avatar-lime": dict(name="Lime", gender="f", skin="#8f543b", hair="#2a1715", top="#b4d85c", accent="#efc86e", bottom="#24252c", shoe="#c9cbd0", hair_style="braids"),
    "avatar-purple": dict(name="Plum", gender="f", skin="#f0b18f", hair="#713629", top="#754267", accent="#efb2c7", bottom="#272b35", shoe="#e4d3c3", hair_style="bob"),
    "avatar-coral": dict(name="Coral", gender="f", skin="#c77d5f", hair="#1e1718", top="#d36c62", accent="#f4d18c", bottom="#35313a", shoe="#e6d9c8", hair_style="curly"),
    "avatar-midnight": dict(name="Midnight", gender="m", skin="#f0bd9a", hair="#d3a35e", top="#303b57", accent="#d9e4ff", bottom="#242936", shoe="#e7e8ed", hair_style="undercut"),
    "avatar-sunset": dict(name="Sunset", gender="m", skin="#b96c45", hair="#5a2f22", top="#b35b3d", accent="#f3c66e", bottom="#26343a", shoe="#e6d7c5", hair_style="curls"),
}

def px(draw, box, fill, outline="#17151b"):
    scaled = tuple(int(v * S) for v in box)
    draw.rectangle(scaled, fill=fill, outline=outline, width=max(1, 2 * S))

def draw_hair(draw, spec, x, y, facing):
    hair, style = spec["hair"], spec["hair_style"]
    if facing in ("n", "nw", "ne"):
        px(draw, (x - 22, y - 6, x + 22, y + 30), hair)
        px(draw, (x - 14, y - 2, x - 7, y + 4), spec["accent"], outline=None)
        if style in ("braids", "curls"):
            for offset in (-20, -11, 11, 20): px(draw, (x + offset, y + 18, x + offset + 7, y + 68), hair)
        return
    if style == "braids":
        px(draw, (x - 23, y - 7, x + 23, y + 29), hair)
        px(draw, (x - 15, y - 2, x - 7, y + 5), spec["accent"], outline=None)
        px(draw, (x - 27, y + 15, x - 19, y + 72), hair)
        px(draw, (x + 19, y + 15, x + 27, y + 72), hair)
    elif style == "bob":
        px(draw, (x - 24, y - 8, x + 24, y + 31), hair)
        px(draw, (x - 15, y - 2, x - 8, y + 4), spec["accent"], outline=None)
        px(draw, (x - 27, y + 16, x - 19, y + 51), hair)
        px(draw, (x + 19, y + 16, x + 27, y + 51), hair)
    elif style == "undercut":
        px(draw, (x - 23, y - 8, x + 24, y + 23), hair)
        px(draw, (x + 1, y - 5, x + 15, y + 1), spec["accent"], outline=None)
        px(draw, (x - 3, y - 14, x + 21, y + 2), hair)
    else:
        px(draw, (x - 23, y - 8, x + 23, y + 25), hair)
        px(draw, (x - 13, y - 2, x - 5, y + 4), spec["accent"], outline=None)

def draw_avatar(draw, spec, direction, phase):
    front = direction in ("s", "se", "sw")
    side = direction in ("e", "w")
    walking = phase >= 0
    idle = not walking
    cx, ground = 80, 220
    lean = 0 if idle else (2 if phase in (1, 2, 5) else -2)
    cx += lean
    # Legs are always terminated on the same floor line.
    if idle:
        left_x, right_x = cx - 15, cx + 3
        px(draw, (left_x, 158, left_x + 15, 211), spec["bottom"])
        px(draw, (right_x, 158, right_x + 15, 211), spec["bottom"])
        px(draw, (left_x - 2, 209, left_x + 15, 220), spec["shoe"])
        px(draw, (right_x, 209, right_x + 17, 220), spec["shoe"])
    else:
        stride = (-13, 10, 17, 6, -10, -17)[phase]
        left_x, right_x = cx - 13 + stride, cx + 2 - stride
        px(draw, (left_x, 158, left_x + 15, 211), spec["bottom"])
        px(draw, (right_x, 158, right_x + 15, 211), spec["bottom"])
        px(draw, (left_x - 3, 209, left_x + 15, 220), spec["shoe"])
        px(draw, (right_x, 209, right_x + 18, 220), spec["shoe"])
    # Torso and jacket silhouette.
    body_w = 47 if not side else 36
    px(draw, (cx - body_w // 2, 94, cx + body_w // 2, 165), spec["top"])
    px(draw, (cx - body_w // 2 + 8, 102, cx - body_w // 2 + 15, 150), spec["accent"])
    px(draw, (cx - body_w // 2 + 20, 105, cx - body_w // 2 + 24, 149), "#ffffff", outline=None)
    px(draw, (cx - body_w // 2 + 7, 137, cx - body_w // 2 + 18, 145), spec["bottom"], outline=None)
    if not side:
        px(draw, (cx + body_w // 2 - 15, 102, cx + body_w // 2 - 8, 150), spec["accent"])
        px(draw, (cx + 6, 131, cx + 16, 138), spec["bottom"], outline=None)
    # Arms swing only while walking; idle arms hang symmetrically.
    swing = 0 if idle else (-8 if phase in (0, 1, 5) else 8)
    px(draw, (cx - body_w // 2 - 10, 105 + swing, cx - body_w // 2 + 3, 157 + swing), spec["top"])
    px(draw, (cx + body_w // 2 - 3, 105 - swing, cx + body_w // 2 + 10, 157 - swing), spec["top"])
    # Neck and head. Side-facing heads are offset to make the angle readable.
    head_x = cx + (9 if direction in ("e", "se") else -9 if direction in ("w", "sw") else 0)
    px(draw, (head_x - 19, 45, head_x + 19, 98), spec["skin"])
    px(draw, (head_x - 17, 83, head_x + 17, 94), "#c17a59", outline=None)
    draw_hair(draw, spec, head_x, 39, direction)
    if front:
        px(draw, (head_x - 11, 69, head_x - 5, 75), "#19151a", outline=None)
        px(draw, (head_x + 5, 69, head_x + 11, 75), "#19151a", outline=None)
        px(draw, (head_x - 7, 86, head_x + 7, 90), spec["accent"], outline=None)
        px(draw, (head_x - 14, 62, head_x - 7, 66), "#ffffff", outline=None)
        px(draw, (head_x + 7, 62, head_x + 14, 66), "#ffffff", outline=None)
    elif side:
        px(draw, (head_x + (10 if direction == "e" else -14), 70, head_x + (16 if direction == "e" else -8), 76), "#19151a", outline=None)
    # A tiny accessory makes each look distinct without changing the baseline.
    if spec["gender"] == "f": px(draw, (head_x - 25, 75, head_x - 20, 84), spec["accent"], outline=None)

def generate(key, spec):
    atlas = Image.new("RGBA", (W * 7, H * 8), (0, 0, 0, 0))
    for row, direction in enumerate(DIRECTIONS):
        for col in range(7):
            frame = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
            draw_avatar(ImageDraw.Draw(frame), spec, direction, -1 if col == 0 else col - 1)
            frame = frame.resize((W, H), Image.Resampling.NEAREST)
            atlas.alpha_composite(frame, (col * W, row * H))
    atlas.save(OUT / f"{key}-walk.png", optimize=True)

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for key, spec in LOOKS.items(): generate(key, spec)
    print(f"Generated {len(LOOKS)} avatar atlases at {OUT}")
