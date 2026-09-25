# Bertoverse product specification

**Current baseline: 0.10.6**

## Product promise

Bertoverse is a cosy, slightly mischievous social hangout built around original pixel art, conversation, self-expression, and community-made rooms. Players should feel that the room is calm and readable, movement is deliberate, chat is alive but safe, and every interface action has a clear response.

The stoner identity comes from colour, humour, fictional plants, and ambient atmosphere. It is not a real-world drug marketplace or consumption simulator.

## Current player contract

1. A user can register or sign in through a JSON API backed by MariaDB.
2. A signed-in user enters a room and sees a consistent server snapshot.
3. Clicking a reachable tile requests a server-calculated eight-way path.
4. The server rejects out-of-bounds, blocked, or corner-cutting moves.
5. Other clients receive the same authoritative positions and direction states.
6. Chat appears as readable room bubbles, is persisted for moderation, and is protected by rate limits and mutes.
7. A user can open the phone, navigator, wardrobe, catalog, wallet, inventory, settings, help, and profile card without losing room state.
8. A reconnect removes stale presence and restores a fresh room snapshot; authenticated duplicate presence is prevented.

## Experience principles

- **Readable first:** the floor, hover tile, avatar feet, chat bubble, and selected window must remain visually distinct.
- **One source of truth:** client input expresses intent; the server owns identity, movement, chat, inventory, and currency.
- **Small, reversible actions:** purchases and room changes are transactional; idempotency is a future hardening requirement.
- **Social by default, safe by design:** moderation records exist from the start, with rate limits and mutes before a full moderator UI.
- **Original expression:** generic mechanics may be familiar, but names, art, copy, proportions, geometry, and code remain Bertoverse work.

## Acceptance checklist

- Two browser sessions can enter the same room, move around one another, and chat for ten minutes without duplicate presence or drift.
- All eight travel vectors select the expected avatar direction; idle poses share a grounded baseline.
- Clicking a user selects only the avatar hit area; nearby tiles remain walkable.
- A failed API request returns JSON and does not expose stack traces or HTML.
- A refresh, reconnect, password change, and logout invalidate or rotate sessions as expected.
- Repeating a purchase request with the same idempotency key cannot spend currency twice.
- Nginx serves HTTPS, proxies WebSockets, and the Node port remains private.
- A clean install and an upgrade from 0.10.5 both apply migrations deterministically.

## Explicit non-goals

The current release does not promise trading, real-money purchases, public user-generated scripts, arbitrary HTML in chat, cross-server federation, a mobile-native app, or production-scale horizontal scaling. Those require separate threat modelling, privacy review, and operational design.

## Originality boundaries

Do not copy Habbo/Nitro/Polaris code, packets, assets, catalogue data, terminology, or room layouts. Isometric projection, tile movement, chat bubbles, wardrobes, and room lists are generic interaction patterns; Bertoverse’s implementation and visual expression must remain original.
