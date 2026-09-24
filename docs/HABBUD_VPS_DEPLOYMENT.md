# Deploy to sandbox.habbud.com

This deployment is isolated from the live Habbud stack:

- Application: `/var/www/greenroom`
- Node listener: `127.0.0.1:3105`
- Database: `greenroom`
- Database user: `greenroom_app`
- Nginx vhost: `/etc/nginx/conf.d/sandbox.habbud.com.conf`
- Service: `greenroom.service`

It does not change `/var/www/atomcms/public`, `/var/www/Octane/dist`, Polaris on port `3002`, the imager on `3030`, or the existing `habbo` database.

## 1. DNS

Create this DNS record and wait for it to resolve to the VPS:

```text
Type: A
Host: sandbox
Value: YOUR_VPS_IPV4_ADDRESS
Proxy: DNS only while obtaining the certificate
```

```bash
getent ahostsv4 sandbox.habbud.com
```

## 2. Upload and extract

From the Mac:

```bash
scp greenroom-social-world-v0.1.zip root@YOUR_VPS_IP:/root/
```

On `habbudserver`:

```bash
sudo apt update
sudo apt install -y unzip
sudo useradd --system --home /var/www/greenroom --shell /usr/sbin/nologin greenroom 2>/dev/null || true
sudo mkdir -p /var/www/greenroom
sudo unzip -oq /root/greenroom-social-world-v0.1.zip -d /var/www/greenroom
sudo chown -R greenroom:www-data /var/www/greenroom
cd /var/www/greenroom
sudo -u greenroom npm ci
node --version
npm --version
```

Node must be version 24 or newer.

## 3. Create the isolated database

Generate and retain a database password:

```bash
openssl rand -base64 36
sudo mariadb
```

Replace `PASTE_LONG_RANDOM_PASSWORD` below. Do not reuse the `habbo` database credentials.

```sql
CREATE DATABASE IF NOT EXISTS greenroom CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'greenroom_app'@'127.0.0.1' IDENTIFIED BY 'PASTE_LONG_RANDOM_PASSWORD';
GRANT ALL PRIVILEGES ON greenroom.* TO 'greenroom_app'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

```bash
mariadb -u greenroom_app -p -h 127.0.0.1 greenroom < /var/www/greenroom/database/migrations/001_initial.sql
```

## 4. Configure and build

```bash
sudo cp /var/www/greenroom/.env.example /var/www/greenroom/.env
sudo nano /var/www/greenroom/.env
```

Use:

```dotenv
HOST=127.0.0.1
PORT=3105
CLIENT_ORIGIN=https://sandbox.habbud.com
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=greenroom
DB_USER=greenroom_app
DB_PASSWORD=PASTE_LONG_RANDOM_PASSWORD
```

```bash
sudo chown greenroom:www-data /var/www/greenroom/.env
sudo chmod 640 /var/www/greenroom/.env
cd /var/www/greenroom
sudo -u greenroom npm run build
```

## 5. Install the service

```bash
sudo cp /var/www/greenroom/deploy/greenroom.service /etc/systemd/system/greenroom.service
sudo systemctl daemon-reload
sudo systemctl enable --now greenroom
sudo systemctl status greenroom --no-pager
curl -sS http://127.0.0.1:3105/health
```

The health response should contain `"ok":true` and `"database":"connected"`.

## 6. Install Nginx and SSL

```bash
sudo cp /var/www/greenroom/deploy/sandbox.habbud.com.conf /etc/nginx/conf.d/sandbox.habbud.com.conf
sudo nginx -t
sudo systemctl reload nginx
curl -I http://sandbox.habbud.com
sudo certbot --nginx -d sandbox.habbud.com
sudo nginx -t
sudo systemctl reload nginx
```

Do not open port `3105` in UFW. It remains bound to localhost; only existing public ports `80` and `443` are used.

## 7. Verify

```bash
curl -sS https://sandbox.habbud.com/health
sudo systemctl status greenroom --no-pager
sudo journalctl -u greenroom -n 50 --no-pager
sudo tail -n 50 /var/log/nginx/habbud/sandbox-error.log
```

Open `https://sandbox.habbud.com` in two browser windows and test movement and chat.

