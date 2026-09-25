# Bertoverse implementation plan

This plan tracks the current 0.10.6 foundation and the next work that improves reliability without expanding the product blindly.

## Architecture status

| Area | Current implementation | Status |
|---|---|---|
| Client | Vite, TypeScript, Phaser, responsive UI windows, code-split production chunks | Complete for current release |
| API | Express health/auth/account/room/catalog/profile endpoints with JSON error boundaries | Hardened |
| Realtime | Socket.IO room presence, movement, chat, reconnect and cleanup | Hardened |
| Movement | Server-authoritative A*, eight directions, occupancy/reservations, corner blocking | Stable baseline |
| Persistence | MariaDB repositories and append-only migrations 001–009 | Stable baseline |
| Identity | Argon2id, cookie sessions, rotation, revocation, rate limits | Hardened |
| Operations | Nginx TLS proxy, systemd sandboxing, health endpoint, backup runbook | Production-ready baseline |

## Completed in 0.10.6

- Added account-security fields and purchase idempotency migration.
- Added strict origin/request metadata checks for state-changing HTTP and Socket.IO traffic.
- Added input bounds, malformed-cookie handling, JSON-only error responses, and no-store private API responses.
- Split rate limits by authentication, reads, writes, chat, purchases, and connection attempts.
- Added socket payload limits, idle cleanup, duplicate-presence prevention, movement reservations, and chat/mute enforcement.
- Improved reconnect cleanup, session watcher handling, client request timeouts, and production code splitting.
- Added a server Vitest configuration that isolates tests from workspace-level configuration.
- Removed known production dependency audit findings and re-ran typecheck, tests, build, and server syntax checks.

## Next priorities

### 1. Moderation and observability

Build an authenticated moderator surface over the existing chat, mute, and audit tables. Add structured server events for login failures, rate-limit hits, movement rejects, purchases, and moderation actions. Retain only the minimum data needed for safety and publish a retention policy.

### 2. Room permissions and furniture safety

Add explicit room-owner/member roles, server-side placement permissions, collision validation for furniture footprints, and an audit trail for room edits. Keep all placement and purchase decisions transactional.

### 3. Reconnect and client state quality

Add request identifiers and acknowledgement timeouts to movement, chat, and purchase actions. On reconnect, send a complete room snapshot plus a monotonic revision so stale client state cannot overwrite newer state.

### 4. Accessibility and responsive QA

Keyboard-focus states, reduced-motion support, readable chat contrast, touch targets, and a repeatable desktop/mobile browser matrix should be acceptance criteria before adding more social apps.

### 5. Operations and scale

Add automated migration checks in CI, scheduled encrypted database backups with restore drills, log rotation, and a small load-test scenario for two-client movement/chat. Consider Redis only when a second Node instance is genuinely required; it is not a substitute for correctness work.

## Delivery rule

Every release should ship with a migration note, rollback point, typecheck, tests, production build, dependency audit, health check, and a two-client smoke test. New artwork must pass the [art bible](ART_BIBLE.md), and new server behaviour must preserve the authoritative-state rule.
