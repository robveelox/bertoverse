# Deploy Bertoverse to `sandbox.habbud.com`

This runbook covers a clean installation on the existing Habbud VPS. It keeps Bertoverse isolated from the other sites and services already running there.

| Component | Value |
|---|---|
| Application | `/var/www/greenroom` |
| Runtime user | `greenroom` |
| Node listener | `127.0.0.1:3105` |
| Database | `greenroom` |
| Database user | `greenroom_app` |
| systemd unit | `greenroom.service` |
| Public URL | `https://sandbox.habbud.com` |

It does not change `/var/www/atomcms/public`, `/var/www/Octane/dist`, Polaris on port `3002`, the imager on `3030`, or the existing `habbo` database.

## 1. DNS and prerequisites

Create the Cloudflare DNS record for `sandbox` pointing at the VPS. Keep the record DNS-only while issuing a certificate if the ACME challenge requires direct access, then restore your preferred proxy mode.

```bash
getent ahostsv4 sandbox.habbud.com
ssh habbud-server
sudo -i
apt update
apt install -y unzip mariadb-client nginx
node --version
npm --version
```

Node must be version 24 or newer. Use the existing administrator SSH workflow; do not share root credentials in a release archive.

## 2. Back up before changing anything

```bash
tar --exclude=node_modules -czf /root/greenroom-pre-deploy.tgz -C /var/www greenroom
mariadb-dump --single-transaction greenroom > /root/greenroom-pre-deploy.sql
```

Confirm the backup files exist before continuing.

## 3. Upload and extract

From the development Mac, upload the release to the administrator home directory:

```bash
scp ~/Downloads/bertoverse-v0.10.6.zip habbud-server:/home/administrator/
```

On the VPS, extract over the application tree. The archive intentionally does not contain production secrets, so preserve the existing `.env`:

```bash
mkdir -p /var/www/greenroom
unzip -oq /home/administrator/bertoverse-v0.10.6.zip -d /var/www/greenroom
chown -R greenroom:www-data /var/www/greenroom
```

If `/var/www/greenroom/.env` does not exist, create it from `.env.example` and fill in the production values. Never replace a working `.env` with a blank example during an upgrade.

## 4. Database

For a clean install, create an isolated database and user. Do not reuse the `habbo` credentials:

```bash
openssl rand -base64 36
mariadb
```

```sql
CREATE DATABASE IF NOT EXISTS greenroom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'greenroom_app'@'127.0.0.1' IDENTIFIED BY 'PASTE_LONG_RANDOM_PASSWORD';
GRANT ALL PRIVILEGES ON greenroom.* TO 'greenroom_app'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

Apply every migration once, in filename order, on a clean database:

```bash
for migration in /var/www/greenroom/database/migrations/*.sql; do
  mariadb -u greenroom_app -p -h 127.0.0.1 greenroom < "$migration"
done
```

On an existing 0.10.5 installation, apply only migrations `008_account_security.sql` and `009_v0106_purchase_idempotency.sql` if they are not already recorded. Never edit or re-run an applied migration.

## 5. Environment, dependencies, and build

Use production values similar to:

```dotenv
HOST=127.0.0.1
PORT=3105
CLIENT_ORIGIN=https://sandbox.habbud.com
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=greenroom
DB_USER=greenroom_app
DB_PASSWORD=PASTE_LONG_RANDOM_PASSWORD
NODE_ENV=production
```

Lock down the file and install/build as the application user:

```bash
chown greenroom:www-data /var/www/greenroom/.env
chmod 640 /var/www/greenroom/.env
cd /var/www/greenroom
sudo -u greenroom npm ci
sudo -u greenroom npm run typecheck
sudo -u greenroom npm test
sudo -u greenroom npm run build
```

If npm reports that native install scripts are blocked, review the list and approve only the lockfile-required `argon2` and `esbuild` scripts, then run `sudo -u greenroom npm rebuild argon2` before the build.

## 6. systemd service

Install the service template and restart it:

```bash
cp /var/www/greenroom/deploy/greenroom.service /etc/systemd/system/greenroom.service
systemctl daemon-reload
systemctl enable greenroom
systemctl restart greenroom
systemctl status greenroom --no-pager
curl -sS http://127.0.0.1:3105/health
```

Health should contain `"ok":true` and `"database":"connected"`. Do not expose port `3105` through the firewall; it is intentionally bound to localhost.

## 7. Nginx and TLS

The repository template is `deploy/sandbox.habbud.com.conf`. It is a reference for security headers, body limits, and WebSocket proxy timeouts. If Certbot already manages the active HTTPS vhost, **do not overwrite that file**. Merge the relevant `location /`, `/api/`, and `/socket.io/` proxy settings into the existing HTTPS `server` block.

```bash
nginx -t
systemctl reload nginx
curl -I https://sandbox.habbud.com
curl -sS https://sandbox.habbud.com/health
```

If the Nginx plugin is installed and a certificate is not yet present:

```bash
apt install -y python3-certbot-nginx
certbot --nginx -d sandbox.habbud.com
nginx -t
systemctl reload nginx
```

The active HTTPS vhost must proxy WebSockets with HTTP/1.1 and `Upgrade`/`Connection` headers, and must pass `X-Forwarded-Proto` so secure cookies remain secure.

## 8. Post-deploy verification

```bash
systemctl status greenroom --no-pager
journalctl -u greenroom -n 100 --no-pager
tail -n 100 /var/log/nginx/habbud/sandbox-error.log
```

Open the site in two browsers and verify login, room entry, eight-way movement, tile hover/click, chat, profile cards, wardrobe, phone, catalog, and logout. Check that a second login does not create duplicate room presence.

## Rollback

Stop the service, restore the application archive and SQL dump made in step 2, restore the previous `.env` if needed, then rebuild and restart. Validate `/health` before reopening the site. Keep rollback files until the new release has passed a real two-client smoke test.
