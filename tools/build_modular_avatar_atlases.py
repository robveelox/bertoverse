"""Build clean runtime atlases from the approved v0.9 avatar source sheets.

The source sheets are intentionally not assumed to be a regular pixel grid.
Each frame is discovered as one connected character component, sorted into
eight direction rows and seven animation columns, then grounded into the same
runtime cell. This prevents clipping, source backgrounds and neighbouring-row
fragments from reaching Phaser.
"""
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
REFS = ROOT / "refs"
OUT = ROOT / "apps/client/public/assets/avatars"
CELL_W, CELL_H, AVATAR_H = 220, 240, 220


def discover_frames(source: Image.Image, female: bool = False):
    rgba = np.array(source.convert("RGBA"), copy=True)
    red_cleanup = (
        (rgba[..., 0] > 120)
        & (rgba[..., 0] > rgba[..., 1] * 1.45)
        & (rgba[..., 0] > rgba[..., 2] * 1.45)
        & (rgba[..., 1] < 110)
    )
    if female:
        rgba[red_cleanup, 3] = 0

    # The generator sometimes leaves a low-opacity colour halo around a
    # character.  Discover poses from the opaque body, then keep only source
    # pixels that sit within a small feather of that body.  This is the
    # important distinction between the clean sprite and the raw reference.
    labels, count = ndimage.label(rgba[..., 3] > 100)
    frames = []
    for label in range(1, count + 1):
        ys, xs = np.where(labels == label)
        if len(xs) < 1000:
            continue
        frames.append((float(ys.mean()), float(xs.mean()), label))
    frames.sort()
    if len(frames) != 56:
        raise RuntimeError(f"expected 56 avatar components, found {len(frames)}")

    ordered = []
    for row in range(8):
        row_frames = sorted(frames[row * 7 : (row + 1) * 7], key=lambda item: item[1])
        for _, _, label in row_frames:
            ys, xs = np.where(labels == label)
            y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            frame = rgba[y0:y1, x0:x1].copy()
            component = labels[y0:y1, x0:x1] == label
            # Preserve anti-aliased edge pixels only when they are close to
            # an opaque body pixel.  This removes the rectangular/brown/yellow
            # generator residue without making the pixel art look jagged.
            keep = ndimage.binary_dilation(component, iterations=1)
            frame[..., 3] = np.where(keep, frame[..., 3], 0)
            ordered.append(Image.fromarray(frame, "RGBA"))
    return ordered


def pack(source: Image.Image, destination: Path, female: bool = False):
    frames = discover_frames(source, female)
    atlas = Image.new("RGBA", (CELL_W * 7, CELL_H * 8), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        # The female reference was rendered at a smoother source resolution
        # than the male reference.  A small nearest-neighbour pixel pass makes
        # its clusters and stair-step edges match the male's coarser style
        # without changing the pose layout or baseline.
        if female:
            original_size = frame.size
            coarse_w = max(1, round(frame.width * 0.84))
            coarse_h = max(1, round(frame.height * 0.84))
            frame = frame.resize((coarse_w, coarse_h), Image.Resampling.NEAREST)
            frame = frame.resize(original_size, Image.Resampling.NEAREST)
        width = max(1, round(frame.width * AVATAR_H / frame.height))
        frame = frame.resize((width, AVATAR_H), Image.Resampling.NEAREST)
        cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
        cell.alpha_composite(frame, ((CELL_W - width) // 2, CELL_H - AVATAR_H - 2))
        atlas.alpha_composite(cell, ((index % 7) * CELL_W, (index // 7) * CELL_H))
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    atlas.save(temporary, format="PNG", optimize=False, compress_level=6)
    temporary.replace(destination)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    pack(Image.open(REFS / "avatar-v09-male-source.png"), OUT / "avatar-green-walk.png")
    pack(Image.open(REFS / "avatar-v09-female-source.png"), OUT / "avatar-lime-walk.png", female=True)
    print("Built v0.9 modular male/female atlases")
