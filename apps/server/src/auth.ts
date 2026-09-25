import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { pool } from './db.js';

export const SESSION_COOKIE = 'greenroom_session';
const SESSION_DAYS = 30;

export type AvatarAppearance = {
  bodyTone: string;
  hairStyle: string;
  hairColor: string;
  topStyle: string;
  topColor: string;
  bottomStyle: string;
  bottomColor: string;
  shoesStyle: string;
  shoesColor: string;
  accessory: string | null;
};

export type AuthUser = {
  id: number;
  publicId: string;
  username: string;
  email: string;
  motto: string;
  joinedAt: string;
  avatarKey: 'avatar-green' | 'avatar-lime';
  appearance: AvatarAppearance;
};

const appearanceColumns = `
  COALESCE(a.body_tone, 'fern') AS bodyTone,
  COALESCE(a.hair_style, 'sprout') AS hairStyle,
  COALESCE(a.hair_color, 'moss') AS hairColor,
  COALESCE(a.top_style, 'hoodie') AS topStyle,
  COALESCE(a.top_color, 'plum') AS topColor,
  COALESCE(a.bottom_style, 'trousers') AS bottomStyle,
  COALESCE(a.bottom_color, 'charcoal') AS bottomColor,
  COALESCE(a.shoes_style, 'trainers') AS shoesStyle,
  COALESCE(a.shoes_color, 'cream') AS shoesColor,
  a.accessory AS accessory`;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function parseCookies(header = ''): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const item of header.split(';').map(value => value.trim()).filter(Boolean)) {
    const index = item.indexOf('=');
    if (index < 1) continue;
    try {
      cookies[decodeURIComponent(item.slice(0, index))] = decodeURIComponent(item.slice(index + 1));
    } catch { /* Ignore malformed attacker-controlled cookie segments. */ }
  }
  return cookies;
}

export async function userFromToken(token?: string): Promise<AuthUser | null> {
  if (!token) return null;
  const [rows] = await pool.query<any[]>(`
    SELECT u.id, u.public_id AS publicId, u.username, u.email, u.motto, u.created_at AS joinedAt,
      COALESCE(a.avatar_key, 'avatar-green') AS avatarKey, ${appearanceColumns}
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id AND u.status = 'active'
    LEFT JOIN avatar_appearances a ON a.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP
    LIMIT 1`, [hashToken(token)]);
  return rows[0] ?? null;
}

export async function userById(id: number): Promise<AuthUser | null> {
  const [rows] = await pool.query<any[]>(`SELECT u.id, u.public_id AS publicId, u.username, u.email, u.motto, u.created_at AS joinedAt,
    COALESCE(a.avatar_key, 'avatar-green') AS avatarKey, ${appearanceColumns} FROM users u
    LEFT JOIN avatar_appearances a ON a.user_id = u.id WHERE u.id = ? LIMIT 1`, [id]);
  return rows[0] ?? null;
}

export async function userFromRequest(req: Request): Promise<AuthUser | null> {
  return userFromToken(req.cookies?.[SESSION_COOKIE]);
}

export async function createSession(userId: number, req: Request, res: Response) {
  const token = randomBytes(32).toString('hex');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    // Rotate the account session on every login so an account cannot accumulate
    // stale parallel sessions after a shared-device login. Lock the user row so
    // two simultaneous logins cannot both leave an active token behind.
    await connection.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
    await connection.execute('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
    await connection.execute(`INSERT INTO user_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
      VALUES (?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? DAY), ?, ?)`,
      [userId, hashToken(token), SESSION_DAYS, req.ip?.slice(0, 45) ?? null, req.get('user-agent')?.slice(0, 255) ?? null]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: (process.env.CLIENT_ORIGIN ?? '').startsWith('https://'), sameSite: 'lax', maxAge: SESSION_DAYS * 86400000, path: '/' });
}

export async function registerUser(email: string, username: string, password: string, avatarKey: AuthUser['avatarKey']) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<any>('INSERT INTO users (public_id, email, username, password_hash) VALUES (?, ?, ?, ?)', [randomUUID(), email, username, passwordHash]);
    await connection.execute('INSERT INTO avatar_appearances (user_id, avatar_key) VALUES (?, ?)', [result.insertId, avatarKey]);
    await connection.execute('INSERT INTO wallets (user_id) VALUES (?)', [result.insertId]);
    await connection.commit();
    return Number(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function verifyLogin(identity: string, password: string): Promise<number | null> {
  const [rows] = await pool.query<any[]>('SELECT id, password_hash FROM users WHERE (username = ? OR email = ?) AND status = \'active\' LIMIT 1', [identity, identity]);
  const row = rows[0];
  return row && await argon2.verify(row.password_hash, password) ? Number(row.id) : null;
}

export async function verifyPassword(userId: number, password: string): Promise<boolean> {
  const [rows] = await pool.query<any[]>('SELECT password_hash FROM users WHERE id = ? AND status = \'active\' LIMIT 1', [userId]);
  return Boolean(rows[0] && await argon2.verify(rows[0].password_hash, password));
}

export async function updateAccount(userId: number, changes: { email?: string; motto?: string; password?: string }) {
  const fields: string[] = [];
  const values: any[] = [];
  if (changes.email !== undefined) { fields.push('email = ?'); values.push(changes.email); }
  if (changes.motto !== undefined) { fields.push('motto = ?'); values.push(changes.motto); }
  if (changes.password) { fields.push('password_hash = ?'); values.push(await argon2.hash(changes.password, { type: argon2.argon2id })); }
  if (!fields.length) return;
  values.push(userId);
  await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function destroySession(token?: string) {
  if (token) await pool.execute('DELETE FROM user_sessions WHERE token_hash = ?', [hashToken(token)]);
}

export async function revokeOtherSessions(userId: number, currentToken?: string) {
  if (!currentToken) return;
  await pool.execute('DELETE FROM user_sessions WHERE user_id = ? AND token_hash <> ?', [userId, hashToken(currentToken)]);
}
