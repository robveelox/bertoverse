# Original art bible — v0.1

## Canvas and projection

| Rule | Specification |
|---|---|
| Projection | 2:1 isometric diamond |
| Logical tile | 64 × 32 px at 1× |
| Elevation step | 16 px |
| Internal rendering | Integer pixel coordinates; nearest-neighbour scaling |
| Base viewport | 960 × 540, responsive crop/scale |
| Supported directions | 8 visual directions; 4-direction movement in 0.1 |

## Avatar silhouette

- Native frame: 24 × 38 px.
- Large rounded head (14 × 13 px), narrow torso, short legs, oversized shoes.
- The silhouette must remain readable at 1× and must not reuse Habbo proportions.
- Layer order: back accessory → body → trousers → top → head → hair → face → front accessory.
- 0.1 uses a code-drawn placeholder: idle bob plus four-direction walk lean.
- Production animation target: idle 4 frames; walk 6 frames per direction; sit 2; wave 6; laugh 6.

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

Use a one-pixel dark outline and one highlight ramp per material. Avoid copying the colour ramps, outlines, facial features, or furniture geometry of existing social worlds.

## World language

- Rounded planters, beanbags, cassette players, lava lamps, tea trays, terrariums, and fictional glowing herbs.
- Plant motifs use invented leaf shapes and playful names.
- UI uses soft plum panels, lime focus states, large touch targets, and chunky original icons.
- Cannabis references should be age-appropriate for the intended audience and reviewed before public launch.

## Asset naming

`category_item_variant_direction_frame.png`

Example: `avatar_hoodie_plum_sw_03.png`. Keep editable source files separate from exported runtime spritesheets.

