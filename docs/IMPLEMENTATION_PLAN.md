# Implementation plan

## Architecture

- `apps/client`: Vite + TypeScript + Phaser browser client.
- `apps/server`: Express health endpoint + Socket.IO authoritative room server.
- `database`: MariaDB migrations. Persistent repositories start in milestone 0.2.
- Shared protocol types are deliberately small in 0.1; extract a package once a second room or API consumer exists.

## Delivery sequence

| Stage | Deliverable | Exit check |
|---|---|---|
| 0.1A | Renderer and input | Room renders sharply and tile selection works on mouse/touch |
| 0.1B | Authoritative movement | Server finds paths and all clients receive identical positions |
| 0.1C | Presence and chat | Join/leave/chat work in two tabs with rate limits |
| 0.1D | Persistence seam | MariaDB boots from migrations and health reports connectivity |
| 0.2 | Accounts | Argon2id passwords, sessions, saved appearance, recovery flow |
| 0.3 | Rooms and furniture | Navigator, ownership, placement, inventory, collision |
| 0.4 | Community safety | Roles, mute, report, audit log, word filters and appeal trail |
| 0.5 | Economy | Transactional purchases, ledger, grants and admin controls |

## Server rules

- Clients request a destination tile; only the server calculates and advances the path.
- Movement is Manhattan/orthogonal in 0.1 and updates every 220 ms.
- Chat is trimmed, capped at 160 characters, escaped by Phaser text rendering, and rate-limited.
- Display names are temporary, 2–16 characters, and reduced to letters, numbers, spaces, `_` and `-`.
- Currency and owned items will always be changed inside MariaDB transactions.

## Production checklist (later milestone)

HTTPS/WSS, reverse-proxy trust, Redis adapter for horizontal scaling, session store, CSRF protection, Argon2id credentials, migrations runner, backups, metrics, structured logs, content moderation, privacy/retention policy, accessibility testing, load testing, and an age/audience decision.

