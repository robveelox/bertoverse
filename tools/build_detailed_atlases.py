"""Build the detailed 8-heading runtime avatar atlases.

The source art has four authored poses (front, three-quarter front, back and
three-quarter back). The game exposes eight isometric headings, so opposite
headings are made by mirroring the authored pose. Every atlas is written as a
fresh, non-interlaced PNG to avoid partially-written browser textures.
"""
from colorsys import rgb_to_hsv, hsv_to_rgb
from pathlib import Path
import sys
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / "apps/client/public/assets/avatars"
CELL_W, CELL_H = 220, 300
# Runtime order: n, ne, e, se, s, sw, w, nw.
# Source rows: front, three-quarter front, back, three-quarter back.
DIRECTION_SOURCES = [
    (2, False), (3, True), (1, True), (1, False),
    (0, False), (0, True), (1, False), (3, False),
]
# The source shoes already reach the lower edge of their cells. Keep that
# baseline (rather than shifting them upward and clipping hair at the top).
GROUND_MARGIN = 0

def tint_clothing(image, hue):
    image = image.convert("RGBA")
    px = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = px[x, y]
            if a and g > r * 1.05 and g > b * 1.05:
                h, s, v = rgb_to_hsv(r / 255, g / 255, b / 255)
                rr, gg, bb = hsv_to_rgb(hue, min(1, s * 1.05), v)
                px[x, y] = (round(rr * 255), round(gg * 255), round(bb * 255), a)
    return image

def repack(source, destination):
    source = source.convert("RGBA")
    atlas = Image.new("RGBA", (CELL_W * 7, CELL_H * 8), (0, 0, 0, 0))
    for target_row, (source_row, mirrored) in enumerate(DIRECTION_SOURCES):
        for target_col in range(7):
            source_col = 3 if target_col == 0 else target_col - 1
            frame = source.crop((source_col * CELL_W, source_row * CELL_H, (source_col + 1) * CELL_W, (source_row + 1) * CELL_H))
            if mirrored:
                frame = frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            # Every source frame was authored with a slightly different crop.
            # Re-anchor its visible pixels to the same horizontal centre and
            # shared lower-edge baseline so idle and walking frames do not
            # float, sink, or slide sideways on the tile.
            bbox = frame.getbbox()
            if bbox:
                aligned = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
                dx = (CELL_W - (bbox[2] - bbox[0])) // 2 - bbox[0]
                dy = (CELL_H - GROUND_MARGIN - bbox[3])
                aligned.alpha_composite(frame, (dx, dy))
                frame = aligned
            atlas.alpha_composite(frame, (target_col * CELL_W, target_row * CELL_H))
    # Keep the write simple and complete; optimized IDAT output can be left
    # with a bad checksum if a build is interrupted while replacing an asset.
    # Write beside the destination and replace only after the PNG is complete.
    # This prevents a watcher/build process from ever seeing a half-written
    # atlas and turning one avatar into a black rectangle.
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    atlas.save(temporary, format="PNG", optimize=False, compress_level=6)
    temporary.replace(destination)

if __name__ == "__main__":
    source_dir = Path(sys.argv[1])
    sources = {
        "avatar-green": source_dir / "green.png",
        "avatar-lime": source_dir / "lime.png",
        "avatar-purple": source_dir / "purple.png",
        "avatar-coral": source_dir / "coral.png",
    }
    for key, path in sources.items():
        source = Image.open(path)
        repack(source, OUT / f"{key}-walk.png")
    repack(tint_clothing(Image.open(source_dir / "green.png"), .62), OUT / "avatar-midnight-walk.png")
    repack(tint_clothing(Image.open(source_dir / "green.png"), .04), OUT / "avatar-sunset-walk.png")
    print("Repacked six detailed avatar atlases")
