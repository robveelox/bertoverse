import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? 'greenroom',
  user: process.env.DB_USER ?? 'greenroom',
  password: process.env.DB_PASSWORD ?? 'change-me-local',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 100,
  connectTimeout: 5000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export async function databaseStatus(): Promise<'connected' | 'unavailable'> {
  try {
    await pool.query('SELECT 1');
    return 'connected';
  } catch {
    return 'unavailable';
  }
}
