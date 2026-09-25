# Bertoverse

**Current release: 0.10.6**

Bertoverse is an original browser-based isometric multiplayer social world. Players enter small furnished rooms, move tile by tile, chat, customise their look, browse rooms, and manage a lightweight social interface inspired by classic virtual worlds. The project uses original artwork, original code, and its own data model; it is not a Habbo, Nitro, or Polaris clone.

## What is playable

- Account registration, login, cookie sessions, and logout.
- An isometric lounge with server-authoritative eight-way movement.
- A* pathfinding with bounds and diagonal corner-cutting checks.
- Original Forest Fit and Lime Fit avatar atlases with idle and walk poses for eight directions.
- Room chat bubbles, persistent chat history, spam protection, temporary mutes, and moderation-ready records.
- Navigator room listings, room visits, room creation, room layouts, catalog, wallet, inventory, and avatar switching.
- MariaDB-backed rooms, users, appearances, wallets, furniture, chat, mutes, audit records, sessions, and idempotent purchases.

The stoner identity is expressed through colour, humour, fictional botanical motifs, and a relaxed social tone. It does not implement real-world drug sales or consumption mechanics.

## How it works

```text
Browser (Vite + Phaser)
        │ HTTPS / WebSocket
        ▼
Nginx reverse proxy (TLS, headers, compression)
        │ localhost:3105
        ▼
Node.js server (Express + Socket.IO)
        │ parameterised SQL
        ▼
MariaDB
```

The browser renders the room and sends intentions such as “walk to this tile” or “send this message.” The Node server validates paths, cleans chat, authenticates registered users, and broadcasts room state. MariaDB stores accounts, sessions, rooms, catalog data, wallets, and visits. Nginx terminates TLS and proxies both HTTP and WebSocket traffic. `systemd` keeps the server running on the VPS.

## Requirements

- Node.js 24 or newer and npm.
- MariaDB 10.6 or newer (MariaDB 12 is used in the current VPS environment).
- Nginx for production TLS and reverse proxying.
- A modern desktop or mobile browser with WebSocket support.

## Project structure

| Path | Purpose |
|---|---|
| `apps/client` | Vite, TypeScript, Phaser client and UI styles |
| `apps/server` | Express API, Socket.IO gateway, auth, movement, chat, repositories |
| `database/migrations` | Ordered MariaDB schema migrations (`001` through `009`) |
| `deploy` | systemd and Nginx templates |
| `docs` | Product, art, architecture, security, and deployment documentation |
| `refs`, `tools` | Original art references and atlas-generation helpers |

## Local development

Clone the repository, install dependencies, and create a local environment file:

```bash
git clone <repository-url> bertoverse
cd bertoverse
npm ci
cp .env.example .env
```

Set local values in `.env` (use a dedicated local database, never production credentials):

```dotenv
HOST=127.0.0.1
PORT=3105
CLIENT_ORIGIN=http://localhost:5173
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=greenroom
DB_USER=greenroom_app
DB_PASSWORD=use-a-long-local-password
NODE_ENV=development
```

Create the database and apply migrations in filename order:

```bash
mariadb -u root -p -e "CREATE DATABASE IF NOT EXISTS greenroom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
for migration in database/migrations/*.sql; do
  mariadb -u greenroom_app -p -h 127.0.0.1 greenroom < "$migration"
done
```

Run checks and the development servers:

```bash
npm run typecheck
npm test
npm run build
npm run dev
```

If npm blocks native install scripts in a fresh environment, review and approve only the scripts required by the lockfile (`argon2` and `esbuild`), then run `npm rebuild argon2`.

## Production deployment

The established Bertoverse VPS workflow is:

```bash
ssh habbud-server
sudo -i
```

The application lives at `/var/www/greenroom`, runs as the unprivileged `greenroom` user, listens on `127.0.0.1:3105`, and is exposed as `https://sandbox.habbud.com`. Follow [docs/V0.10.6_UPGRADE.md](docs/V0.10.6_UPGRADE.md) for the versioned upgrade procedure and [docs/HABBUD_VPS_DEPLOYMENT.md](docs/HABBUD_VPS_DEPLOYMENT.md) for a clean deployment. The short form is:

1. Back up the application and database.
2. Upload the release ZIP to `/home/administrator/` and extract it into `/var/www/greenroom`.
3. Preserve the existing `/var/www/greenroom/.env`; do not copy it from an archive.
4. Apply any migrations that have not already run, in order.
5. `chown` the tree to `greenroom:www-data`, run `npm ci` and `npm run build` as `greenroom`.
6. Restart `greenroom.service`, validate `/health`, and inspect the journal.
7. Merge Nginx template changes into the active Certbot HTTPS vhost; do not overwrite the certificate-managed file.

## Database migrations

Migrations are append-only and must be applied in lexical order:

| Migration | Scope |
|---|---|
| `001_initial.sql` | Core users, rooms, tiles, furniture, wallets, appearances |
| `002_accounts_and_sessions.sql` | Password accounts and sessions |
| `003_avatar_lineup.sql` | Avatar appearance data |
| `004_rooms_catalog.sql` | Room and catalog foundations |
| `005_modular_appearance.sql` | Layered avatar appearance support |
| `006_chat_moderation.sql` | Chat history, moderation, and audit records |
| `007_phone_system.sql` | Phone/social app data |
| `008_account_security.sql` | Account settings and security fields |
| `009_v0106_purchase_idempotency.sql` | Idempotent purchase keys and duplicate-spend protection |

Never delete a migration or edit one that has already run in production. Add a new numbered migration for schema changes and take a database dump before applying it.

## Security and stability model

- Argon2id password hashing and server-side cookie sessions.
- Session rotation on login and password changes, with revocation of prior sessions.
- Origin and request-metadata checks for state-changing HTTP and Socket.IO traffic.
- JSON-only API errors, strict input validation, parameterised SQL, and no-store responses for private APIs.
- Separate auth, read, write, purchase, chat, and connection rate limits.
- Socket payload and connection-attempt caps, idle cleanup, and duplicate-presence protection.
- Server-authoritative movement, occupancy reservations, chat throttles, mutes, and purchase idempotency.
- Nginx security headers and a hardened systemd service with no public Node port.

See [docs/SECURITY.md](docs/SECURITY.md) for the threat model and the next security work.

## Operations and troubleshooting

Useful production checks:

```bash
systemctl status greenroom --no-pager
journalctl -u greenroom -n 100 --no-pager
curl -sS https://sandbox.habbud.com/health
nginx -t
systemctl reload nginx
```

If health reports a database error, check `.env` permissions and credentials, then test with `mariadb -u greenroom_app -p -h 127.0.0.1 greenroom`. If the page loads but live movement or chat does not, inspect the browser network panel for a failed WebSocket and confirm the active HTTPS Nginx vhost proxies `/socket.io/` with HTTP/1.1 and upgrade headers. If a release fails, stop the service, restore the application backup and SQL dump, then restart and re-check `/health`.

## Documentation index

- [Changelog](CHANGELOG.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Product specification](docs/PRODUCT_SPEC.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Art bible](docs/ART_BIBLE.md)
- [VPS deployment](docs/HABBUD_VPS_DEPLOYMENT.md)
- [0.10.6 upgrade runbook](docs/V0.10.6_UPGRADE.md)
- [Historical 0.10.5 upgrade note](docs/V0.10.5_UPGRADE.md)
- [Historical 0.8.3 upgrade](docs/V0.8.3_UPGRADE.md)
- [Historical 0.4 upgrade](docs/V0.4_UPGRADE.md)

## Originality and scope

Bertoverse deliberately uses an original name, codebase, art direction, avatar proportions, palette, interface language, room geometry, and database model. Generic ideas such as isometric rooms, tile movement, chat, and wardrobes are not copied expression. Review trademarks, age rating, privacy policy, moderation policy, and asset licences before public launch.
