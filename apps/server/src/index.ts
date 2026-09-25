import 'dotenv/config';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { Server } from 'socket.io';
import { databaseStatus } from './db.js';
import { BLOCKED, cleanMessage, cleanName, Direction, findPath, Player, ROOM_HEIGHT, ROOM_WIDTH, Tile } from './game.js';
import { createSession, destroySession, parseCookies, registerUser, revokeOtherSessions, SESSION_COOKIE, updateAccount, userById, userFromRequest, userFromToken, verifyLogin, verifyPassword } from './auth.js';
import { pool } from './db.js';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
const origin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
if (!/^https?:\/\/[^\s/]+(?::\d+)?$/.test(origin)) throw new Error('CLIENT_ORIGIN must be a single absolute http(s) origin.');
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: '16kb' }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const websocketOrigin = origin.replace(/^http/, 'ws');
  res.setHeader('Content-Security-Policy', `default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ${origin} ${websocketOrigin}; form-action 'self'`);
  if (origin.startsWith('https://')) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (_req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use((req, res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    const requestOrigin = req.get('origin');
    if (requestOrigin && requestOrigin !== origin) return res.status(403).json({ error: 'Request origin is not allowed.' });
    if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
    if (req.path.startsWith('/api/') && !(req.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return res.status(415).json({ error: 'JSON request body required.' });
  }
  next();
});
app.get('/health', async (_req, res) => {
  const database = await databaseStatus();
  res.status(database === 'connected' ? 200 : 503).json({ ok: database === 'connected', database });
});
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const apiReadLimit = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });
const writeLimit = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
const purchaseLimit = rateLimit({ windowMs: 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });
const publicUser = (user: Awaited<ReturnType<typeof userById>>) => user && ({
  publicId: user.publicId,
  username: user.username,
  email: user.email,
  motto: user.motto,
  joinedAt: user.joinedAt,
  avatarKey: user.avatarKey === 'avatar-lime' ? 'avatar-lime' : 'avatar-green',
  appearance: user.appearance,
});
const DEFAULT_ROOM_ID = '00000000-0000-4000-8000-000000000001';

app.get('/api/auth/session', apiReadLimit, async (req, res) => res.json({ user: publicUser(await userFromRequest(req)) }));
app.post('/api/auth/register', authLimit, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const requestedAvatar = String(req.body?.avatarKey ?? '');
  const avatarKey = (['avatar-green', 'avatar-lime'].includes(requestedAvatar) ? requestedAvatar : 'avatar-green') as NonNullable<Awaited<ReturnType<typeof userById>>>['avatarKey'];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-zA-Z0-9 _-]{3,16}$/.test(username) || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Use a valid email, a 3–16 character username and a password of at least 8 characters.' });
  try {
    const id = await registerUser(email, username, password, avatarKey);
    await createSession(id, req, res);
    res.status(201).json({ user: publicUser(await userById(id)) });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That username or email is already registered.' });
    console.error(error); res.status(500).json({ error: 'Registration failed.' });
  }
});
app.post('/api/auth/login', authLimit, async (req, res) => {
  const identity = String(req.body?.identity ?? '').trim();
  const password = String(req.body?.password ?? '');
  const id = await verifyLogin(identity, password);
  if (!id) return res.status(401).json({ error: 'Username/email or password is incorrect.' });
  await createSession(id, req, res);
  res.json({ user: publicUser(await userById(id)) });
});
app.post('/api/auth/logout', authLimit, async (req, res) => {
  await destroySession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: '/' }); res.status(204).end();
});
app.patch('/api/profile/avatar', writeLimit, async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in first.' });
  const avatarKey = req.body?.avatarKey;
  if (!['avatar-green', 'avatar-lime'].includes(avatarKey)) return res.status(400).json({ error: 'Unknown avatar.' });
  await pool.execute(`INSERT INTO avatar_appearances (user_id, avatar_key) VALUES (?, ?)
    ON DUPLICATE KEY UPDATE avatar_key = VALUES(avatar_key)`, [user.id, avatarKey]);
  res.json({ user: publicUser(await userById(user.id)) });
});

app.patch('/api/profile/settings', writeLimit, async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in first.' });
  const email = req.body?.email === undefined ? undefined : String(req.body.email).trim().toLowerCase();
  const rawMotto = req.body?.motto === undefined ? undefined : String(req.body.motto).trim();
  const motto = rawMotto === undefined ? undefined : rawMotto.slice(0, 120);
  const newPassword = req.body?.newPassword === undefined ? undefined : String(req.body.newPassword);
  const currentPassword = String(req.body?.currentPassword ?? '');
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (rawMotto !== undefined && rawMotto.length > 120) return res.status(400).json({ error: 'Your motto is too long.' });
  if (newPassword !== undefined && (newPassword.length < 8 || newPassword.length > 128)) return res.status(400).json({ error: 'New passwords must be 8–128 characters.' });
  const emailChanged = email !== undefined && email !== user.email;
  if (newPassword || emailChanged) {
    if (!currentPassword || !(await verifyPassword(user.id, currentPassword))) return res.status(403).json({ error: 'Current password is required for this change.' });
  }
  try {
    await updateAccount(user.id, { email, motto, password: newPassword });
    if (newPassword) await revokeOtherSessions(user.id, req.cookies?.[SESSION_COOKIE]);
    await pool.execute(`INSERT INTO security_audit_events (user_id, event_type, ip_address, details_json) VALUES (?, 'profile_settings_changed', ?, ?)`
      , [user.id, req.ip?.slice(0, 45) ?? null, JSON.stringify({ email: email !== undefined, motto: motto !== undefined, password: Boolean(newPassword) })]);
    res.json({ user: publicUser(await userById(user.id)) });
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That email is already registered.' });
    console.error(error); res.status(500).json({ error: 'Settings could not be saved.' });
  }
});

app.post('/api/moderation/report', writeLimit, async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in to report something.' });
  const roomCandidate = String(req.body?.roomPublicId ?? '');
  const roomPublicId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomCandidate) ? roomCandidate : null;
  const eventType = String(req.body?.targetType ?? 'profile') === 'chat' ? 'user_report_chat' : 'user_report_profile';
  const details = { targetId: String(req.body?.targetId ?? '').slice(0, 80), reason: String(req.body?.reason ?? 'Inappropriate behaviour').trim().slice(0, 240) || 'Inappropriate behaviour' };
  await pool.execute(`INSERT INTO moderation_events (user_id, room_public_id, event_type, details_json) VALUES (?, ?, ?, ?)`, [user.id, roomPublicId, eventType, JSON.stringify(details)]);
  res.status(201).json({ reported: true });
});

async function addRoomPreviews(rooms: any[]) {
  if (!rooms.length) return [];
  const ids = [...new Set(rooms.map(room => String(room.publicId)).filter(id => /^[0-9a-f-]{36}$/i.test(id)))];
  if (!ids.length) return rooms.map(room => ({ ...room, width: Number(room.width ?? ROOM_WIDTH), height: Number(room.height ?? ROOM_HEIGHT), blocked: [] }));
  const placeholders = ids.map(() => '?').join(',');
  const [tiles] = await pool.query<any[]>(`SELECT r.public_id AS publicId, t.x, t.y FROM room_tiles t JOIN rooms r ON r.id = t.room_id WHERE r.public_id IN (${placeholders}) AND t.walkable = FALSE`, ids);
  const [items] = await pool.query<any[]>(`SELECT r.public_id AS publicId, i.x, i.y, i.rotation, c.footprint_width AS footprintWidth, c.footprint_height AS footprintHeight
    FROM furniture_items i JOIN rooms r ON r.id = i.room_id JOIN furniture_catalog c ON c.id = i.catalog_id
    WHERE r.public_id IN (${placeholders}) AND i.x IS NOT NULL AND i.y IS NOT NULL`, ids);
  const blockedByRoom = new Map<string, Set<string>>();
  ids.forEach(id => blockedByRoom.set(id, new Set()));
  tiles.forEach(tile => blockedByRoom.get(String(tile.publicId))?.add(`${Number(tile.x)},${Number(tile.y)}`));
  items.forEach(item => {
    const blocked = blockedByRoom.get(String(item.publicId));
    if (!blocked) return;
    const width = Number(item.rotation) % 2 ? Number(item.footprintHeight) : Number(item.footprintWidth);
    const height = Number(item.rotation) % 2 ? Number(item.footprintWidth) : Number(item.footprintHeight);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) blocked.add(`${Number(item.x) + x},${Number(item.y) + y}`);
  });
  return rooms.map(room => ({ ...room, width: Number(room.width ?? ROOM_WIDTH), height: Number(room.height ?? ROOM_HEIGHT), blocked: [...(blockedByRoom.get(String(room.publicId)) ?? new Set())] }));
}

app.get('/api/rooms', apiReadLimit, async (req, res) => {
  const user = await userFromRequest(req);
  const [publicRooms] = await pool.query<any[]>(`SELECT r.public_id AS publicId, r.name, r.description, r.layout_key AS layoutKey,
    r.max_visitors AS maxVisitors, r.width, r.height, r.created_at AS createdAt, u.username AS ownerName
    FROM rooms r LEFT JOIN users u ON u.id = r.owner_user_id
    WHERE r.access_mode = 'public' ORDER BY r.created_at ASC LIMIT 50`);
  let mine: any[] = [], recent: any[] = [];
  if (user) {
    [mine] = await pool.query<any[]>(`SELECT public_id AS publicId, name, description, layout_key AS layoutKey, max_visitors AS maxVisitors, width, height, created_at AS createdAt
      FROM rooms WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 30`, [user.id]);
    [recent] = await pool.query<any[]>(`SELECT r.public_id AS publicId, r.name, r.description, r.layout_key AS layoutKey, r.max_visitors AS maxVisitors, r.width, r.height, r.created_at AS createdAt
      FROM room_visits v JOIN rooms r ON r.id = v.room_id WHERE v.user_id = ? ORDER BY v.last_visited_at DESC LIMIT 12`, [user.id]);
  }
  const occupancy = new Map<string, number>();
  for (const player of players.values()) occupancy.set(player.roomId, (occupancy.get(player.roomId) ?? 0) + 1);
  const count = async (rooms: any[]) => addRoomPreviews(rooms.map(room => ({ ...room, occupancy: occupancy.get(room.publicId) ?? 0 })));
  res.json({ public: await count(publicRooms), mine: await count(mine), recent: await count(recent) });
});

app.post('/api/rooms', writeLimit, async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in to create a room.' });
  const rawName = String(req.body?.name ?? '').trim();
  const rawDescription = String(req.body?.description ?? '').trim();
  if (rawName.length > 60 || rawDescription.length > 240) return res.status(400).json({ error: 'The room name or description is too long.' });
  const name = rawName;
  const description = rawDescription;
  const layoutKey = ['square-8', 'square-10', 'wide-12'].includes(req.body?.layoutKey) ? req.body.layoutKey : 'square-10';
  if (name.length < 3) return res.status(400).json({ error: 'Room names need at least 3 characters.' });
  const [roomCountRows] = await pool.query<any[]>('SELECT COUNT(*) AS count FROM rooms WHERE owner_user_id = ?', [user.id]);
  if (Number(roomCountRows[0]?.count ?? 0) >= 50) return res.status(429).json({ error: 'You have reached the room limit.' });
  const dimensions: Record<string, [number, number]> = { 'square-8': [8, 8], 'square-10': [10, 10], 'wide-12': [12, 9] };
  const [width, height] = dimensions[layoutKey];
  const publicId = randomUUID();
  await pool.execute(`INSERT INTO rooms (public_id, owner_user_id, name, description, width, height, access_mode, layout_key, max_visitors)
    VALUES (?, ?, ?, ?, ?, ?, 'public', ?, 25)`, [publicId, user.id, name, description, width, height, layoutKey]);
  res.status(201).json({ room: { publicId, name, description, layoutKey, maxVisitors: 25, occupancy: 0, width, height, blocked: [] } });
});

app.get('/api/wallet', apiReadLimit, async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in to view your wallet.' });
  const [rows] = await pool.query<any[]>('SELECT coins, gems FROM wallets WHERE user_id = ? LIMIT 1', [user.id]);
  res.json({ wallet: rows[0] ?? { coins: 0, gems: 0 } });
});

app.get('/api/catalog', apiReadLimit, async (_req, res) => {
  const [items] = await pool.query<any[]>(`SELECT id, code, name, asset_key AS assetKey, footprint_width AS footprintWidth,
    footprint_height AS footprintHeight, price_coins AS priceCoins FROM furniture_catalog WHERE enabled = TRUE ORDER BY id`);
  res.json({ items });
});

app.get('/api/hq/updates', apiReadLimit, async (_req, res) => {
  const [updates] = await pool.query<any[]>(`SELECT id, slug, title, body, tone, pinned,
      published_at AS publishedAt FROM hq_updates
      ORDER BY pinned DESC, published_at DESC LIMIT 30`);
  res.json({ updates });
});

app.get('/api/inventory', apiReadLimit, async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in to view your bag.' });
  const [items] = await pool.query<any[]>(`SELECT c.id AS catalogId, c.code, c.name, c.asset_key AS assetKey, COUNT(*) AS quantity
    FROM furniture_items i JOIN furniture_catalog c ON c.id = i.catalog_id
    WHERE i.owner_user_id = ? AND i.room_id IS NULL GROUP BY c.id, c.code, c.name, c.asset_key ORDER BY c.name`, [user.id]);
  res.json({ items });
});

app.post('/api/catalog/:id/purchase', purchaseLimit, async (req, res) => {
  const user = await userFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Sign in to purchase furniture.' });
  const catalogId = Number(req.params.id);
  if (!Number.isInteger(catalogId) || catalogId < 1) return res.status(400).json({ error: 'Unknown catalog item.' });
  const idempotencyKey = (req.get('idempotency-key') ?? '').trim();
  if (idempotencyKey && !/^[A-Za-z0-9_-]{8,64}$/.test(idempotencyKey)) return res.status(400).json({ error: 'Invalid purchase request key.' });
  const purchaseKey = idempotencyKey || randomUUID();
  const hasClientIdempotencyKey = Boolean(idempotencyKey);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [previousRows] = await connection.query<any[]>(`SELECT amount, created_at AS createdAt
      FROM currency_transactions WHERE user_id = ? AND idempotency_key = ? AND reason_code = 'catalog_purchase' LIMIT 1`, [user.id, purchaseKey]);
    if (previousRows[0]) {
      const [walletRows] = await connection.query<any[]>('SELECT coins, gems FROM wallets WHERE user_id = ? LIMIT 1', [user.id]);
      await connection.commit();
      return res.status(200).json({ purchased: { id: catalogId, name: 'Furniture purchase' }, wallet: { coins: Number(walletRows[0]?.coins ?? 0), gems: Number(walletRows[0]?.gems ?? 0) }, idempotent: true });
    }
    const [catalogRows] = await connection.query<any[]>('SELECT id, name, price_coins AS priceCoins FROM furniture_catalog WHERE id = ? AND enabled = TRUE FOR UPDATE', [catalogId]);
    const item = catalogRows[0];
    const [walletRows] = await connection.query<any[]>('SELECT coins, gems FROM wallets WHERE user_id = ? FOR UPDATE', [user.id]);
    const wallet = walletRows[0];
    if (!item) { await connection.rollback(); return res.status(404).json({ error: 'That item is unavailable.' }); }
    if (!wallet || Number(wallet.coins) < Number(item.priceCoins)) { await connection.rollback(); return res.status(409).json({ error: 'You do not have enough coins.' }); }
    await connection.execute('UPDATE wallets SET coins = coins - ? WHERE user_id = ?', [item.priceCoins, user.id]);
    await connection.execute('INSERT INTO furniture_items (catalog_id, owner_user_id) VALUES (?, ?)', [item.id, user.id]);
    await connection.execute(`INSERT INTO currency_transactions (user_id, currency, amount, reason_code, reference_id, idempotency_key)
      VALUES (?, 'coins', ?, 'catalog_purchase', ?, ?)`, [user.id, -Number(item.priceCoins), randomUUID(), purchaseKey]);
    await connection.commit();
    res.status(201).json({ purchased: { id: item.id, name: item.name }, wallet: { coins: Number(wallet.coins) - Number(item.priceCoins), gems: Number(wallet.gems) } });
  } catch (error: any) {
    await connection.rollback();
    if (error?.code === 'ER_DUP_ENTRY' && hasClientIdempotencyKey) {
      const [walletRows] = await pool.query<any[]>('SELECT coins, gems FROM wallets WHERE user_id = ? LIMIT 1', [user.id]);
      return res.status(200).json({ purchased: { id: catalogId, name: 'Furniture purchase' }, wallet: { coins: Number(walletRows[0]?.coins ?? 0), gems: Number(walletRows[0]?.gems ?? 0) }, idempotent: true });
    }
    console.error(error); res.status(500).json({ error: 'Purchase failed.' });
  } finally { connection.release(); }
  });

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(error);
  console.error('Unhandled HTTP error', error);
  res.status(500).json({ error: 'Internal server error.' });
});

const server = createServer(app);
const io = new Server(server, { cors: { origin, credentials: true }, maxHttpBufferSize: 64 * 1024, pingTimeout: 20_000, pingInterval: 25_000, connectTimeout: 10_000 });
const players = new Map<string, Player>();
const roomSizes = new Map<string, { width: number; height: number }>();
const roomBlocked = new Map<string, Set<string>>();
const movers = new Map<string, NodeJS.Timeout>();
const pathReservations = new Map<string, { roomId: string; tiles: Set<string> }>();
const chatActivity = new Map<string, { timestamps: number[]; lastHash: string; lastAt: number; strikes: number }>();
const directMessageActivity = new Map<string, number[]>();
const socketSessionWatchers = new Map<string, NodeJS.Timeout>();
const socketAttempts = new Map<string, number[]>();
const socketActionActivity = new Map<string, Map<string, number[]>>();
const colors = ['#b9ef66', '#f6bd60', '#e984b6', '#77d9d1', '#a895ff'];
const MOVE_MS_CARDINAL = 260;
const MOVE_MS_DIAGONAL = 365;
const socketAttemptCleanup = setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [ip, attempts] of socketAttempts) {
    const recent = attempts.filter(timestamp => timestamp > cutoff);
    if (recent.length) socketAttempts.set(ip, recent); else socketAttempts.delete(ip);
  }
}, 300_000);
socketAttemptCleanup.unref();

function releasePathReservation(socketId: string) { pathReservations.delete(socketId); }
function allowSocketAction(socketId: string, action: string, limit: number, windowMs: number) {
  const actions = socketActionActivity.get(socketId) ?? new Map<string, number[]>();
  const now = Date.now();
  const timestamps = (actions.get(action) ?? []).filter(timestamp => now - timestamp < windowMs);
  if (timestamps.length >= limit) { actions.set(action, timestamps); socketActionActivity.set(socketId, actions); return false; }
  timestamps.push(now); actions.set(action, timestamps); socketActionActivity.set(socketId, actions); return true;
}

async function loadRoomCollision(publicId: string) {
  const blocked = new Set(BLOCKED);
  const [tileRows] = await pool.query<any[]>(`SELECT t.x, t.y FROM room_tiles t
    JOIN rooms r ON r.id = t.room_id WHERE r.public_id = ? AND t.walkable = FALSE`, [publicId]);
  tileRows.forEach(tile => blocked.add(`${Number(tile.x)},${Number(tile.y)}`));
  const [furnitureRows] = await pool.query<any[]>(`SELECT i.x, i.y, i.rotation, c.footprint_width AS footprintWidth,
    c.footprint_height AS footprintHeight FROM furniture_items i
    JOIN rooms r ON r.id = i.room_id JOIN furniture_catalog c ON c.id = i.catalog_id
    WHERE r.public_id = ? AND i.x IS NOT NULL AND i.y IS NOT NULL`, [publicId]);
  furnitureRows.forEach(item => {
    const width = Number(item.rotation) % 2 ? Number(item.footprintHeight) : Number(item.footprintWidth);
    const height = Number(item.rotation) % 2 ? Number(item.footprintWidth) : Number(item.footprintHeight);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) blocked.add(`${Number(item.x) + x},${Number(item.y) + y}`);
  });
  roomBlocked.set(publicId, blocked);
  return blocked;
}

function safeRoomId(value: unknown, fallback = DEFAULT_ROOM_ID) {
  const candidate = String(value ?? '').slice(0, 64);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate) ? candidate : fallback;
}

function chooseSpawn(room: { width: number; height: number }, blocked: ReadonlySet<string>, occupied: ReadonlySet<string>) {
  for (let y = 0; y < room.height; y++) for (let x = 0; x < room.width; x++) {
    const key = `${x},${y}`;
    if (!blocked.has(key) && !occupied.has(key)) return { x, y };
  }
  return { x: 0, y: 0 };
}

io.use(async (socket, next) => {
  try {
    const ip = socket.handshake.address || 'unknown';
    const now = Date.now();
    const attempts = (socketAttempts.get(ip) ?? []).filter(timestamp => now - timestamp < 60_000);
    if (attempts.length >= 30) return next(new Error('Too many connection attempts. Please try again shortly.'));
    attempts.push(now); socketAttempts.set(ip, attempts);
    const requestOrigin = socket.handshake.headers.origin;
    if (requestOrigin && requestOrigin !== origin) return next(new Error('Request origin is not allowed.'));
    const token = parseCookies(socket.handshake.headers.cookie)[SESSION_COOKIE];
    socket.data.authUser = await userFromToken(token);
    socket.data.sessionToken = token;
    next();
  } catch { socket.data.authUser = null; next(); }
});

function direction(from: Tile, to: Tile): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx > 0 && dy > 0) return 's';
  if (dx < 0 && dy < 0) return 'n';
  if (dx > 0 && dy < 0) return 'e';
  if (dx < 0 && dy > 0) return 'w';
  if (to.x > from.x) return 'se';
  if (to.x < from.x) return 'nw';
  if (to.y > from.y) return 'sw';
  return 'ne';
}

io.on('connection', (socket) => {
  const sessionToken = socket.data.sessionToken as string | undefined;
  if (sessionToken) {
    const watcher = setInterval(async () => {
      try {
        if (!await userFromToken(sessionToken)) { socket.emit('session:expired'); socket.disconnect(true); }
      } catch { /* Keep a transient database outage from mass-disconnecting users. */ }
    }, 60_000);
    socketSessionWatchers.set(socket.id, watcher);
  }
  const handleJoin = async (payload: { name?: unknown; roomId?: unknown } = {}) => {
    if (players.has(socket.id) || socket.data.joining) return;
    socket.data.joining = true;
    const index = players.size;
    const authUser = socket.data.authUser as Awaited<ReturnType<typeof userFromToken>>;
    // A reconnect or a second tab can otherwise leave two live render entries
    // for the same account. Keep one authoritative room presence per user.
    if (authUser) {
      for (const [otherId, other] of players) {
        const otherSocket = io.sockets.sockets.get(otherId);
        if (otherSocket?.data.authUser?.id === authUser.id) {
          players.delete(otherId);
          const timer = movers.get(otherId);
          if (timer) clearTimeout(timer);
          movers.delete(otherId);
          releasePathReservation(otherId);
          io.to(other.roomId).emit('player:left', otherId);
        }
      }
    }
    const requestedRoom = safeRoomId(payload.roomId);
    const [roomRows] = await pool.query<any[]>(`SELECT r.public_id AS publicId, r.name, r.width, r.height, r.max_visitors AS maxVisitors, r.created_at AS createdAt,
      u.username AS ownerName FROM rooms r LEFT JOIN users u ON u.id = r.owner_user_id
      WHERE r.public_id = ? LIMIT 1`, [requestedRoom]);
    const room = roomRows[0] ?? { publicId: DEFAULT_ROOM_ID, width: ROOM_WIDTH, height: ROOM_HEIGHT };
    const currentOccupancy = [...players.values()].filter(other => other.roomId === room.publicId).length;
    if (currentOccupancy >= Number(room.max_visitors ?? 40)) {
      socket.emit('room:unavailable', { reason: 'That room is currently full.' });
      socket.data.joining = false;
      return;
    }
    const dimensions = { width: Math.max(1, Math.min(64, Number(room.width ?? ROOM_WIDTH))), height: Math.max(1, Math.min(64, Number(room.height ?? ROOM_HEIGHT))) };
    roomSizes.set(room.publicId, dimensions);
    const blocked = await loadRoomCollision(room.publicId);
    const roomOccupants = new Set([...players.values()].filter(other => other.roomId === room.publicId).map(other => `${other.x},${other.y}`));
    const spawn = chooseSpawn(dimensions, blocked, roomOccupants);
    const player: Player = {
      id: socket.id,
      name: authUser?.username ?? cleanName(payload.name),
      motto: authUser?.motto ?? 'Just drifting through Bertoverse.',
      joinedAt: authUser?.joinedAt ?? null,
      x: spawn.x,
      y: spawn.y,
      direction: 'se',
      color: colors[index % colors.length],
      avatarKey: authUser?.avatarKey === 'avatar-lime' ? 'avatar-lime' : 'avatar-green',
      appearance: authUser?.appearance ?? { bodyTone: 'fern', hairStyle: 'sprout', hairColor: 'moss', topStyle: 'hoodie', topColor: 'plum', bottomStyle: 'trousers', bottomColor: 'charcoal', shoesStyle: 'trainers', shoesColor: 'cream', accessory: null },
      registered: Boolean(authUser),
      roomId: room.publicId,
    };
    players.set(socket.id, player);
    socket.join(player.roomId);
    if (authUser && roomRows[0]) {
      try {
        await pool.execute(`INSERT INTO room_visits (user_id, room_id)
          SELECT ?, id FROM rooms WHERE public_id = ? ON DUPLICATE KEY UPDATE last_visited_at = CURRENT_TIMESTAMP`, [authUser.id, player.roomId]);
      } catch (error) { console.error('Unable to record room visit', error); }
    }
    socket.emit('snapshot', {
      selfId: socket.id,
      players: [...players.values()].filter(other => other.roomId === player.roomId),
      room: { id: player.roomId, name: room.name ?? 'The Sunken Lounge', ownerName: room.ownerName ?? 'Bertoverse HQ', createdAt: room.createdAt ?? null, occupancy: [...players.values()].filter(other => other.roomId === player.roomId).length, width: dimensions.width, height: dimensions.height, blocked: [...blocked] },
    });
    socket.to(player.roomId).emit('player:joined', player);
    io.to(player.roomId).emit('system', `${player.name} drifted in.`);
    socket.data.joining = false;
  };
  socket.on('join', payload => {
    void handleJoin(payload).catch(error => {
      socket.data.joining = false;
      console.error('Unable to join room', error);
      socket.emit('room:unavailable', { reason: 'The room is temporarily unavailable.' });
    });
  });

  const handleRoomJoin = async (roomId: unknown) => {
    const player = players.get(socket.id);
    if (!player || socket.data.switching) return;
    socket.data.switching = true;
    const [rows] = await pool.query<any[]>(`SELECT r.id, r.public_id AS publicId, r.name, r.width, r.height, r.max_visitors AS maxVisitors, r.created_at AS createdAt,
      u.username AS ownerName FROM rooms r LEFT JOIN users u ON u.id = r.owner_user_id
      WHERE r.public_id = ? AND r.access_mode = 'public' LIMIT 1`, [safeRoomId(roomId, '')]);
    const room = rows[0];
    if (!room || room.publicId === player.roomId) { socket.data.switching = false; return; }
    const currentOccupancy = [...players.values()].filter(other => other.roomId === room.publicId).length;
    if (currentOccupancy >= Number(room.max_visitors ?? 25)) { socket.emit('room:unavailable', { reason: 'That room is currently full.' }); socket.data.switching = false; return; }
    const previousRoom = player.roomId;
    const dimensions = { width: Math.max(1, Math.min(64, Number(room.width))), height: Math.max(1, Math.min(64, Number(room.height))) };
    const blocked = await loadRoomCollision(room.publicId);
    const spawn = chooseSpawn(dimensions, blocked, new Set([...players.values()].filter(other => other.roomId === room.publicId && other.id !== player.id).map(other => `${other.x},${other.y}`)));
    const existingMover = movers.get(socket.id);
    if (existingMover) clearTimeout(existingMover);
    movers.delete(socket.id);
    releasePathReservation(socket.id);
    socket.leave(previousRoom);
    socket.to(previousRoom).emit('player:left', player.id);
    io.to(previousRoom).emit('system', `${player.name} wandered into another room.`);
    if (![...players.values()].some(other => other.id !== player.id && other.roomId === previousRoom)) { roomSizes.delete(previousRoom); roomBlocked.delete(previousRoom); }
    player.roomId = room.publicId; player.direction = 'se';
    roomSizes.set(room.publicId, dimensions);
    player.x = spawn.x; player.y = spawn.y;
    socket.join(player.roomId);
    const authUser = socket.data.authUser as Awaited<ReturnType<typeof userFromToken>>;
    if (authUser) {
      try {
        await pool.execute(`INSERT INTO room_visits (user_id, room_id) VALUES (?, ?)
          ON DUPLICATE KEY UPDATE last_visited_at = CURRENT_TIMESTAMP`, [authUser.id, room.id]);
      } catch (error) { console.error('Unable to record room visit', error); }
    }
    socket.emit('snapshot', {
      selfId: socket.id,
      players: [...players.values()].filter(other => other.roomId === player.roomId),
      room: { id: player.roomId, name: room.name, ownerName: room.ownerName ?? 'Bertoverse HQ', createdAt: room.createdAt, occupancy: [...players.values()].filter(other => other.roomId === player.roomId).length, width: dimensions.width, height: dimensions.height, blocked: [...blocked] },
    });
    socket.to(player.roomId).emit('player:joined', player);
    io.to(player.roomId).emit('system', `${player.name} drifted in.`);
    socket.data.switching = false;
  };
  socket.on('room:join', roomId => {
    void handleRoomJoin(roomId).catch(error => {
      socket.data.switching = false;
      console.error('Unable to switch room', error);
      socket.emit('room:unavailable', { reason: 'That room could not be opened.' });
    });
  });

  socket.on('move', (raw: Tile & { requestId?: string }) => {
    const player = players.get(socket.id);
    if (!player || !raw) return;
    if (!allowSocketAction(socket.id, 'move', 30, 1_000)) { socket.emit('move:blocked', { requestId: String(raw.requestId ?? ''), reason: 'Movement requests are arriving too quickly.' }); return; }
    const requestId = String(raw.requestId ?? randomUUID()).slice(0, 64);
    const target = raw;
    const goal = { x: Number(target.x), y: Number(target.y) };
    if (!Number.isSafeInteger(goal.x) || !Number.isSafeInteger(goal.y)) { socket.emit('move:blocked', { requestId, reason: 'That tile is not valid.' }); return; }
    const roomPlayers = [...players.values()].filter(other => other.roomId === player.roomId && other.id !== player.id);
    const occupied = new Set(roomPlayers.map(other => `${other.x},${other.y}`));
    const dimensions = roomSizes.get(player.roomId) ?? { width: ROOM_WIDTH, height: ROOM_HEIGHT };
    const path = findPath(player, goal, { ...dimensions, blocked: roomBlocked.get(player.roomId) ?? BLOCKED, occupied });
    const existing = movers.get(socket.id);
    if (existing) { clearInterval(existing); movers.delete(socket.id); }
    releasePathReservation(socket.id);
    if (!path.length) { socket.emit('move:blocked', { requestId, reason: 'That tile cannot be reached.' }); return; }
    const reserved = new Set<string>();
    for (const tile of path) {
      const key = `${tile.x},${tile.y}`;
      if ([...pathReservations.values()].some(item => item.roomId === player.roomId && item.tiles.has(key))) {
        socket.emit('move:blocked', { requestId, reason: 'Someone is already moving through that space.' });
        return;
      }
      reserved.add(key);
    }
    pathReservations.set(socket.id, { roomId: player.roomId, tiles: reserved });
    io.to(player.roomId).emit('player:path', { playerId: player.id, path, requestId });
    let step = 0;
    const advance = () => {
      const current = players.get(socket.id);
      const next = path[step++];
      if (!current || !next) {
        movers.delete(socket.id);
        releasePathReservation(socket.id);
        return;
      }
      const occupant = [...players.values()].find(other => other.roomId === current.roomId && other.id !== current.id && other.x === next.x && other.y === next.y);
      if (occupant) {
        movers.delete(socket.id);
        releasePathReservation(socket.id);
        io.to(current.roomId).emit('player:stopped', { playerId: current.id, tile: { x: current.x, y: current.y } });
        return;
      }
      const diagonal = current.x !== next.x && current.y !== next.y;
      current.direction = direction(current, next);
      current.x = next.x;
      current.y = next.y;
      if (step >= path.length) {
        io.to(current.roomId).emit('player:moved', current);
        movers.delete(socket.id);
        releasePathReservation(socket.id);
      } else {
        const timer = setTimeout(advance, diagonal ? MOVE_MS_DIAGONAL : MOVE_MS_CARDINAL);
        movers.set(socket.id, timer);
      }
    };
    const first = path[0];
    const timer = setTimeout(advance, first && player.x !== first.x && player.y !== first.y ? MOVE_MS_DIAGONAL : MOVE_MS_CARDINAL);
    movers.set(socket.id, timer);
  });

  socket.on('avatar:change', (avatarKey: Player['avatarKey']) => {
    const player = players.get(socket.id);
    if (!player || !['avatar-green', 'avatar-lime'].includes(avatarKey) || !allowSocketAction(socket.id, 'avatar', 5, 10_000)) return;
    player.avatarKey = avatarKey;
    io.to(player.roomId).emit('player:avatar', { playerId: player.id, avatarKey });
  });

  socket.on('dm:send', (raw: unknown) => {
    const player = players.get(socket.id);
    const targetId = String((raw as { playerId?: unknown })?.playerId ?? '').slice(0, 64);
    const message = cleanMessage((raw as { message?: unknown })?.message);
    const now = Date.now();
    const senderAuth = socket.data.authUser as Awaited<ReturnType<typeof userFromToken>>;
    const activityKey = senderAuth ? `u:${senderAuth.id}` : `s:${socket.id}`;
    const timestamps = (directMessageActivity.get(activityKey) ?? []).filter(timestamp => now - timestamp < 10_000);
    if (!player || !targetId || targetId === player.id || !message || timestamps.length >= 12 || (timestamps.length && now - timestamps.at(-1)! < 500)) {
      socket.emit('dm:blocked', { reason: 'Private messages are rate limited. Please slow down.' });
      return;
    }
    const target = players.get(targetId);
    if (!target || target.roomId !== player.roomId) return;
    directMessageActivity.set(activityKey, [...timestamps, now]);
    const targetSocket = io.sockets.sockets.get(target.id);
    const recipientAuth = targetSocket?.data.authUser as Awaited<ReturnType<typeof userFromToken>> | null | undefined;
    void (async () => {
      let id: number | null = null;
      if (senderAuth && recipientAuth) {
        try {
          const [result] = await pool.execute<any>(`INSERT INTO private_messages
            (sender_user_id, recipient_user_id, sender_name, recipient_name, message, room_public_id)
            VALUES (?, ?, ?, ?, ?, ?)`, [senderAuth.id, recipientAuth.id, player.name, target.name, message, player.roomId]);
          id = Number(result.insertId);
        } catch (error) {
          console.error('Unable to archive private message', error);
        }
      }
      const payload = { id, fromPlayerId: player.id, fromName: player.name, toPlayerId: target.id, message, sentAt: now };
      io.to(target.id).emit('dm:received', payload);
      socket.emit('dm:sent', payload);
    })();
  });

  socket.on('chat', (raw: unknown) => {
    const player = players.get(socket.id);
    const now = Date.now();
    const message = cleanMessage(raw);
    if (!player || !message) return;
    const authUser = socket.data.authUser as Awaited<ReturnType<typeof userFromToken>>;
    void (async () => {
      const activityKey = authUser ? `u:${authUser.id}` : `s:${socket.id}`;
      const activity = chatActivity.get(activityKey) ?? { timestamps: [], lastHash: '', lastAt: 0, strikes: 0 };
      const recent = activity.timestamps.filter(timestamp => now - timestamp < 10_000);
      const hash = createHash('sha256').update(message.toLowerCase()).digest('hex');
      const duplicate = activity.lastHash === hash && now - activity.lastAt < 8_000;
      const tooFast = recent.length >= 5 || now - activity.lastAt < 650;
      // Update the in-memory account bucket before awaiting the database so
      // multiple tabs cannot race through the same moderation decision.
      activity.timestamps = [...recent, now];
      activity.lastHash = hash;
      activity.lastAt = now;
      chatActivity.set(activityKey, activity);
      let activeMute: any = null;
      if (authUser) {
        try {
          activeMute = (await pool.query<any[]>(`SELECT reason, UNIX_TIMESTAMP(expires_at) * 1000 AS expiresAt FROM account_mutes WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP ORDER BY expires_at DESC LIMIT 1`, [authUser.id]))[0][0] ?? null;
        } catch (error) {
          console.error('Unable to check chat mute', error);
        }
      }
      if (activeMute || duplicate || tooFast) {
        activity.strikes = Math.min(8, activity.strikes + 1);
        chatActivity.set(activityKey, activity);
        const durationMs = activeMute ? Math.max(1_000, Number(activeMute.expiresAt) - now) : Math.min(120_000, 15_000 * (2 ** Math.min(activity.strikes - 1, 3)));
        const reason = activeMute?.reason ?? (duplicate ? 'Repeated messages are temporarily blocked.' : 'Slow down — room chat has a short rate limit.');
        if (authUser && !activeMute) {
          const expiresAt = new Date(now + durationMs);
          try {
            await pool.execute(`INSERT INTO account_mutes (user_id, room_public_id, reason, expires_at) VALUES (?, ?, ?, ?)`, [authUser.id, player.roomId, reason, expiresAt]);
          } catch (error) { console.error('Unable to archive automatic mute', error); }
        }
        if (authUser) {
          try {
            await pool.execute(`INSERT INTO moderation_events (user_id, room_public_id, event_type, message_hash, details_json) VALUES (?, ?, ?, ?, ?)`, [authUser.id, player.roomId, activeMute ? 'chat_blocked_while_muted' : 'automatic_chat_mute', hash, JSON.stringify({ duplicate, tooFast, strikes: activity.strikes })]);
          } catch (error) { console.error('Unable to archive moderation event', error); }
        }
        socket.emit('chat:blocked', { reason, until: now + durationMs });
        return;
      }
      chatActivity.set(activityKey, activity);
      let chatId: number | null = null;
      try {
        const [result] = await pool.execute<any>(`INSERT INTO chat_messages
          (room_public_id, sender_user_id, sender_name, message)
          VALUES (?, ?, ?, ?)`, [player.roomId, authUser?.id ?? null, player.name, message]);
        chatId = Number(result.insertId);
      } catch (error) {
        // A database hiccup must not swallow live room chat; the error remains
        // visible to the server operator while the room continues functioning.
        console.error('Unable to archive room chat message', error);
      }
      io.to(player.roomId).emit('chat', {
        id: chatId,
        playerId: player.id,
        name: player.name,
        message,
        sentAt: now,
      });
    })();
  });

  socket.on('disconnect', () => {
    const watcher = socketSessionWatchers.get(socket.id);
    if (watcher) clearInterval(watcher);
    socketSessionWatchers.delete(socket.id);
    const player = players.get(socket.id);
    const timer = movers.get(socket.id);
    if (timer) clearInterval(timer);
    movers.delete(socket.id);
    releasePathReservation(socket.id);
    chatActivity.delete(`s:${socket.id}`);
    const authUser = socket.data.authUser as Awaited<ReturnType<typeof userFromToken>>;
    if (authUser && ![...io.sockets.sockets.values()].some(other => other.id !== socket.id && other.data.authUser?.id === authUser.id)) chatActivity.delete(`u:${authUser.id}`);
    directMessageActivity.delete(`s:${socket.id}`);
    if (authUser && ![...io.sockets.sockets.values()].some(other => other.id !== socket.id && other.data.authUser?.id === authUser.id)) directMessageActivity.delete(`u:${authUser.id}`);
    socketActionActivity.delete(socket.id);
    players.delete(socket.id);
    if (player) {
      io.to(player.roomId).emit('player:left', socket.id);
      if (![...players.values()].some(other => other.roomId === player.roomId)) { roomSizes.delete(player.roomId); roomBlocked.delete(player.roomId); }
      io.to(player.roomId).emit('system', `${player.name} wandered off.`);
    }
  });
});

server.listen(port, host, () => console.log(`Bertoverse server listening on ${host}:${port}`));
