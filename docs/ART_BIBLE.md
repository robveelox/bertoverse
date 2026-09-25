# Bertoverse art bible

This document is the runtime art contract for the 0.10.6 client. It keeps original Bertoverse artwork consistent across the room, wardrobe, profile card, and future avatar layers.

## Visual identity

Bertoverse is a cosy, slightly mischievous pixel-art social world: deep plum UI, warm timber floors, leafy greens, lime focus states, and soft amber lighting. The stoner identity is communicated with fictional botanical motifs and relaxed humour. Do not use real-world drug products or borrowed game assets as production art.

## Room projection

| Rule | Specification |
|---|---|
| Projection | 2:1 isometric diamond |
| Logical tile | 64 × 32 px at 1× |
| Elevation step | 16 px |
| Coordinates | Integer tile coordinates; never fractional for gameplay placement |
| Scaling | Nearest-neighbour for pixel art; no browser smoothing |
| Depth | Sort by tile depth, then stable entity id |
| Floor | Tile centre is the avatar foot anchor and shadow centre |

Walls and floor should form a readable room silhouette at every supported aspect ratio. Decorative detail must not obscure walkable tile edges or the hover/selection state.

## Avatar runtime contract

The current release ships two active looks: Forest Fit (male presentation) and Lime Fit (female presentation). They share the same modular body proportions, visible footprint, cell size, baseline, and renderer. Additional looks must be derived from this contract rather than introducing a new renderer.

| Rule | Specification |
|---|---|
| Atlas grid | 7 columns × 8 rows |
| Cell size | 220 × 240 px |
| Columns | 0 = planted idle; 1–6 = walk frames |
| Rows | `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw` |
| Playback | Idle holds column 0; walking loops columns 1–6 |
| Anchor | Feet together for idle; every frame shares one foot baseline |
| Shadow | One small tile-centred shadow below the feet, never inside the sprite |
| Texture filter | Nearest-neighbour; integer display scale where possible |

The server direction is derived from the requested tile vector. The client uses an explicit eight-vector lookup; it must never infer a row from sprite-sheet position or browser rotation. A frame must contain one avatar only, with no neighbouring head, feet, or shadow pixels crossing its cell boundary.

## Layer order

Future modular assets render in this order:

1. Back accessory and rear hair.
2. Base body and skin shading.
3. Trousers or skirt layer.
4. Top layer.
5. Face and front hair.
6. Shoes and front accessory.

All layers use the same 220 × 240 cell, foot anchor, and eight-row direction table. Clothing may change colour and silhouette, but not the shared body proportions without a new reviewed art contract.

## Palette

| Role | Hex |
|---|---|
| Night backdrop | `#17131f` |
| Aubergine panel | `#2b2036` |
| Deep leaf | `#244c38` |
| Bright leaf | `#66c46f` |
| Lime highlight | `#b9ef66` |
| Amber lamp | `#f6bd60` |
| Soft cream | `#fff1cf` |
| Brick shadow | `#6e4058` |

Use an original one-pixel outline and a restrained highlight ramp per material. Avoid copying colour ramps, facial features, furniture geometry, or UI iconography from other social worlds.

## Asset naming and review

Use `category_item_variant_direction_frame.png`, for example `avatar_hoodie_plum_sw_03.png`. Keep editable source files separate from exported atlases. Before committing an atlas, verify: all 56 cells exist, transparent pixels are intentional, feet share one baseline, idle feet are together, each direction visibly faces the travel vector, and the atlas renders identically in the room and wardrobe.
