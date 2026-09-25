# Bertoverse architecture

## Runtime topology

```text
Browser
  ├─ HTTPS API requests ─────┐
  └─ Socket.IO WebSocket ────┤
                             ▼
                      Nginx on 80/443
                             │ localhost only
                             ▼
                      Node.js on :3105
                             │
                             ▼
                         MariaDB
```

The browser is an untrusted renderer. It may request a destination, send chat text, select a look, or submit a purchase, but it cannot authoritatively set coordinates, balances, room membership, or moderation state.

## Server boundaries

- `apps/server/src/index.ts` owns process startup, HTTP middleware, Socket.IO wiring, and lifecycle cleanup.
- Repository modules isolate SQL and return typed domain data.
- Authentication middleware resolves a server-side session from a secure cookie.
- Room state is held in memory for active realtime presence and persisted room/user data stays in MariaDB.
- Movement validates the requested destination, builds a path, checks occupancy/reservations, then broadcasts authoritative steps.
- Chat is normalised, rate-limited, checked for mute state, persisted, and broadcast as a safe message payload.

## Client boundaries

- Phaser renders the room, tile hover, shadows, avatar atlases, and depth order.
- UI panels are ordinary TypeScript/DOM components layered over the canvas.
- `apps/client/src/lib/api.ts` handles JSON parsing, timeouts, and error normalisation.
- Socket reconnects remove stale listeners, request a fresh snapshot, and do not create a second local avatar.
- Production Vite output splits the initial client from the heavier Phaser chunk.

## Persistence and migrations

MariaDB is the durable source for accounts, sessions, rooms, tiles, appearances, inventory, wallet transactions, chat, mutes, audit records, and purchase idempotency. Migrations are append-only and numbered in `database/migrations`; see the root README for the complete table.

## Deployment boundary

Nginx terminates TLS and applies headers/body limits before forwarding to Node. `greenroom.service` runs as the `greenroom` user with a private temporary directory, restricted device/kernel access, and no public listener. The `/health` endpoint is intentionally small and reports database connectivity without exposing private data.

## State flow

```text
Input → validate session → validate intent → mutate authoritative state
      → persist when required → broadcast accepted result
      └→ JSON/socket error when rejected (no partial client truth)
```

This flow is the main invariant to preserve when adding features.
