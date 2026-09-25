# Bertoverse changelog

Release history for the original Bertoverse social world. For installation, architecture, operations, and development instructions, see [README.md](README.md).

> Historical note: entries before 0.10.6 describe earlier development milestones and may mention the former internal name, Project Greenroom.

## Version 0.10.6 — security, stability, and performance

- Added account-security and purchase-idempotency migrations.
- Added stricter origin, request, payload, and rate-limit boundaries across HTTP and Socket.IO.
- Hardened session rotation/revocation, duplicate presence, movement reservations, chat/mute handling, and reconnect cleanup.
- Added JSON-safe API error handling, private-response caching rules, client request timeouts, and split production bundles.
- Hardened the systemd and Nginx deployment templates and refreshed the VPS rollback runbook.

## Version 0.8.3 natural-ratio avatar atlas rebuild

- Removed artificial fixed-width stretching from avatar frames
- Preserved each pose's natural aspect ratio while sharing height and baseline
- Kept detached-component filtering so neighbouring heads cannot enter a frame

## Version 0.8.2 detached-component atlas repair

- Removed neighbouring-row head fragments from every avatar cell
- Normalised only the connected avatar component before scaling
- Keeps the male avatar’s size stable across idle and all walk frames

## Version 0.8.1 male direction/render lock

- Locked the male Forest Fit to the canonical eight-vector direction table
- Kept its walking and idle frames in one fixed display box
- Female remains present but is not part of this focused validation pass

## Version 0.8.0 two-avatar stability baseline

- Reduced the live avatar contract to one male Forest Fit and one female Lime Fit
- Removed the extra looks from runtime loading and wardrobe selection
- Normalized legacy account values to one of the two supported looks
- This is the stable base for adding further avatars after validation

## Version 0.7.7 final render-layer and direction lookup correction

- Replaced conditional direction selection with an explicit eight-vector map
- Reduced and centred the floor shadow inside the tile
- Moved the username label to a stable position above the avatar body

## Version 0.7.6 explicit frame sizing and first-load asset recovery

- Added cache-busted avatar asset URLs for deployed clients
- Applied explicit identical display dimensions to every avatar frame
- Added a first-load retry when a snapshot arrives during texture loading

## Version 0.7.5 corrected braided direction contract

- Corrected braided atlas mapping so east/west use the profile rows and diagonals use the appropriate front/back rows
- Kept the strict shared footprint, baseline, idle and six-frame walk contract

## Version 0.7.4 unified avatar footprint and movement render rebuild

- Repacked all six looks into the same visible 150×220 footprint inside every 220×240 frame
- Normalized every idle and walking frame to one baseline and centre
- Rebuilt female and male row selection as explicit runtime direction contracts
- Retained duplicate-account presence protection and all gameplay functionality

## Version 0.7.3 presence de-duplication and per-gender direction maps

- Prevented reconnects or multiple tabs for one account creating duplicate room avatars
- Added explicit source-row mapping for the female braided atlas
- Kept grounded frame baselines and all existing room functionality

## Version 0.7.2 grounded atlas baseline and direction correction

- Normalized every frame's visible foot baseline before packing the atlas
- Anchored avatar containers to the tile diamond centre so feet and shadow stay inside the floor tile
- Corrected travel-vector mapping to the authored back, profile, front and diagonal rows
- Kept the exact eight-row × seven-column atlas contract and all existing functionality

## Version 0.7.0 authored grounded avatar atlases

- Replaced the previous improvised direction mapping with authored reference poses
- Every atlas now has eight runtime rows, one planted idle plus six walk frames per row
- Idle frames keep feet flat and together; walking frames keep a shared floor baseline
- Added explicit male/female row mappings and preserved all existing movement/UI/gameplay functionality
- Runtime atlas cells are 220×240 and load consistently in Phaser

## Version 0.6.4 grounded directional avatar repair

- Re-anchored every idle and walking frame to one shared cell centre and foot baseline
- Corrected opposite-facing atlas rows for cardinal and diagonal movement
- Removed the renderer offset that caused visible feet to float above the floor
- Preserved rooms, catalog, inventory, chat, pathfinding, avatar switching and all existing UI

## Version 0.6.3 repaired directional avatar atlases

- Rebuilt all six detailed atlases with eight explicit isometric heading rows
- Added mirrored opposite-facing poses so every cardinal and diagonal direction is distinct
- Repaired the Sunset Fit PNG so it loads in-room as well as in the wardrobe
- Kept the existing room, catalog, inventory, movement and UI features intact

## Version 0.6.2 detailed Habbo-era avatar art

- Replaced the crude procedural block silhouettes with richer original detailed pixel art
- Preserved exact 8-direction, 7-column atlas geometry
- Preserved grounded idle poses, walking frames, pathfinding and movement timing
- Three feminine looks: Lime, Plum and Coral
- Three masculine looks: Forest, Midnight and Sunset
- Added deterministic atlas repacking tooling so future art cannot break frame alignment

## Version 0.6.1 deterministic six-avatar sprite system

- Replaced malformed generated atlases with deterministic original sprite sheets
- Added three feminine and three masculine avatar designs
- Every sheet is exactly 7 columns × 8 rows at 160 × 240 pixels per frame
- Column 0 is a planted standing pose with flat, together feet
- Columns 1–6 are grounded walking frames
- Added all eight facing directions with matching idle and walk animations
- Removed legacy atlas files from the client asset path

## Version 0.6.0 navigator, catalog and rooms foundation

- Added persistent public rooms, owned rooms and recently visited rooms
- Added room creation and room-isolated Socket.IO presence, movement and chat
- Added original Greenroom catalog entries and transactional coin purchases
- Added persistent furniture bag and wallet balances
- Added functional Rooms, Catalog and Bag navigation panels
- Added visual catalog cards, purchase notifications and room join controls
- Added a new Midnight avatar atlas with eight directional rows
- Normalized avatar atlases to dedicated idle plus six walking frames

## Version 0.5.6 wardrobe and eight-direction movement

- Added eight-direction server-authoritative pathfinding and facing
- Added safe diagonal movement that cannot cut through blocked corners
- Distance-adjusted diagonal timing keeps movement speed consistent
- Added directional standing poses that preserve the avatar's last facing
- Rebuilt the two new colourways without contrast-softening colour blending
- Moved saved avatar selection into a dedicated Looks panel with visual previews
- Avatar changes now update live for everyone without reconnecting the socket

## Version 0.5.5 grounded avatars and expanded looks

- Removed the perpetual vertical idle tween so avatars no longer float
- Anchored sprite feet and shadows directly to the tile centre
- Added original Plum Fit and Coral Fit animated avatar colourways
- Expanded registration and the in-room avatar studio from two saved looks to four
- Added migration `003_avatar_lineup.sql` for the expanded persistent avatar keys

## Version 0.5.4 deterministic room grid

- Removed the generated raster floor from the runtime completely
- Floor tiles, click conversion, selector diamonds and movement now share one exact projection
- Deterministic responsive 2:1 tile geometry prevents artwork drift at every screen size
- Rebuilt the empty room with code-native timber tiles, wallpaper, trim and skirting
- Avatar proportions are recalibrated to the exact logical tile size

## Version 0.5.3 selector and lime-direction fix

- Calibrated the room grid 11 source pixels lower to match the visible floor intersections
- Added independent verified direction-row maps for each avatar sheet
- Lime avatar now uses southwest row 0 and southeast row 1
- Green avatar retains southeast row 0 and southwest row 1
- Idle frames now resolve through the active sprite sheet's own direction map

## Version 0.5.2 room alignment fix

- Increased avatar render scale by 20 percent
- Anchored avatar feet and shadows to each scaled tile centre instead of a fixed pixel offset
- Corrected the room grid origin to the artwork's rear tile intersection
- Enabled smooth filtering for the high-resolution room while preserving nearest-neighbour avatar sprites
- Selection diamonds now use the same scaled projection values as click conversion and movement

## Version 0.5.1 room-model correction

- Replaced the furnished illustration with an empty 10×10 private-room shell
- Room artwork now contains only floor, walls, trim and skirting
- Calibrated the visible floor grid to the authoritative 10×10 server grid
- Rebalanced avatar scale against the actual 64×32-style tile proportions
- Removed invisible placeholder furniture collisions from the empty room
- Furniture will be stored, rendered and placed as separate objects in Phase 3

## Version 0.5 environment and HUD art pass

- Replaced geometric room primitives with a complete high-detail original isometric lounge
- Added timber flooring, rainy city windows, furniture, record player, plants, terrariums, cat areas and warm lighting
- Preserved an invisible server-authoritative movement/collision grid beneath the artwork
- Responsive room scaling and mobile crop keep avatars readable on small screens
- Rescaled avatars, nameplates, shadows and selection diamonds to match the environment
- Reworked the HUD into a tactile pixel-panel style matching the room and characters

## Version 0.4.1 login-screen fix

- Restored native hidden-state behaviour for inactive authentication forms
- Login, registration and guest tabs now show exactly one form at a time

## Version 0.4 accounts and persistent avatars

- Registration and login with Argon2id password hashing
- Rate-limited authentication endpoints
- Hashed 30-day database sessions in secure HTTP-only cookies
- Authenticated Socket.IO identities; clients cannot choose registered usernames
- Persistent starter-avatar selection
- Guest access remains available
- Account-aware sign-out and starter Avatar Studio controls

## Version 0.3.1 movement fix

- Corrected all four isometric sprite direction mappings
- Replaced per-tile network animation resets with a continuous validated path event
- Synchronized server authority and smooth client-side path playback at 150 ms per tile
- Prevented animation restarting and pausing between every tile

## Version 0.3 animated avatars

- Two original adult fashion-avatar designs
- Four isometric directions and six walking frames per direction
- Server direction changes drive the matching client animation
- Deterministic appearance selection keeps each connected player visually consistent

## Version 0.2 visual overhaul

- Full-screen in-game HUD with room, social, looks and inventory navigation
- Responsive touch/desktop chat dock and chat history
- Live room-members panel driven by multiplayer state
- Richer original layered avatars with improved silhouette and idle animation
- Cosy apartment presentation with timber floor, rug, sofa, table, plants, lamp, windows and warm lighting

Working-title prototype for an original, browser-based isometric social world. The code and placeholder artwork are original and intentionally avoid Habbo assets, names, protocols, and data formats.

## First milestone

- Responsive desktop/mobile canvas
- One 10 × 10 isometric room
- Original small-pixel avatar generated in code
- Click/tap movement with server-side path validation
- Multiple players synchronized over Socket.IO
- Room chat with validation and rate limiting
- MariaDB schema and Docker development database

## Run it

Requirements: Node.js 24+, npm 11+, and Docker (for MariaDB).

```bash
cp .env.example .env
docker compose up -d db
npm install
npm run dev
```

For local development, set `CLIENT_ORIGIN=http://localhost:5173` and `PORT=3001` in `.env`. For the Habbud VPS deployment, use the supplied production files under `deploy/`.

The prototype can still run if MariaDB is temporarily unavailable; guests are held in memory. Persistent registered accounts are intentionally deferred to milestone 2.

## Commands

```bash
npm run dev        # client + server
npm run build      # production builds
npm test           # server game-rule tests
npm run typecheck  # client + server checks
```

## Design documents

See [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), [docs/ART_BIBLE.md](docs/ART_BIBLE.md), and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

For `sandbox.habbud.com`, follow [docs/HABBUD_VPS_DEPLOYMENT.md](docs/HABBUD_VPS_DEPLOYMENT.md).
