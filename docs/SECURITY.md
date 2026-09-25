# Bertoverse security guide

This is the operational security baseline for 0.10.6. It describes controls already present and the checks required before deployment.

## Threat model

Assume browsers, Socket.IO clients, room users, and uploaded requests are untrusted. Attackers may replay requests, forge movement, automate login, send oversized payloads, attempt SQL injection, open many sockets, or try to spend the same balance twice. The server and database are trusted only within their least-privilege configuration.

## Controls in the current release

- Argon2id password hashing; plaintext passwords are never stored.
- Server-side sessions in MariaDB, secure/httpOnly/same-site cookies, session rotation, and revocation after password changes.
- Strict origin and request-metadata checks for state-changing HTTP and WebSocket traffic.
- JSON-only API failures, bounded input, parameterised SQL, no-store private responses, and no stack traces in production.
- Dedicated rate limits for authentication, reads, writes, chat, purchases, and connection attempts.
- Socket payload limits, duplicate-presence protection, idle cleanup, and reconnect snapshot recovery.
- Server-authoritative pathfinding, occupancy/reservation checks, chat mute enforcement, and transactional/idempotent purchases.
- Nginx security headers, TLS termination, localhost-only Node binding, and hardened systemd sandboxing.

## Production checklist

- Use a unique long database password and a dedicated `greenroom_app` account.
- Keep `.env` owned by `greenroom:www-data` with mode `640`; never put it in a ZIP or git commit.
- Keep port `3105` private and expose only the existing HTTPS proxy.
- Keep `CLIENT_ORIGIN` equal to the canonical HTTPS origin with no trailing path.
- Merge Nginx changes into the Certbot-managed HTTPS vhost; test with `nginx -t` before reload.
- Apply migrations in order after a `mariadb-dump`; keep an application archive for rollback.
- Run `npm audit --omit=dev`, `npm run typecheck`, `npm test`, and `npm run build` before release.
- Review failed-login, rate-limit, mute, purchase, and service logs without recording passwords or session tokens.
- Schedule encrypted backups and practise restoring them to an isolated database.

## Incident response

If credentials or session material may be exposed: stop public traffic if necessary, rotate the database password, invalidate all sessions, inspect audit and service logs, restore only from a trusted backup, and document the incident. If a release is unstable, use the runbook rollback while preserving the SQL dump and logs for diagnosis.

## Future security work

Add a moderator UI with role checks, structured audit event retention, dependency scanning in CI, backup restore drills, privacy/retention documentation, and a responsible vulnerability-reporting route before public launch.
