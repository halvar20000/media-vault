import { Pool, types } from 'pg';
import { config } from '../config';

// Return DATE columns (OID 1082) as plain "YYYY-MM-DD" strings, not JS Dates —
// avoids a timezone shift that would move lending dates by a day.
types.setTypeParser(1082, (v) => v);

// A single shared connection pool for the whole process.
export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  max: 10,
});

pool.on('error', (err) => {
  // Don't crash the process on an idle-client error; log and continue.
  console.error('[db] unexpected idle client error', err);
});

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
