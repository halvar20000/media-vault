// Seeds the default household user + the 513-game list on first boot.
// Idempotent: re-running does not duplicate the user or re-import games.
import { readFileSync, existsSync } from 'fs';
import bcrypt from 'bcryptjs';
import { pool, query } from './pool';
import { config } from '../config';
import { parseGamesCsv } from '../lib/games-csv';

async function ensureSeedUser(): Promise<string> {
  const existing = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [config.seedUser.email]
  );
  if (existing.length) return existing[0].id;

  const hash = await bcrypt.hash(config.seedUser.password, 10);
  const rows = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3) RETURNING id`,
    [config.seedUser.email, hash, config.seedUser.displayName]
  );
  console.log(`[seed] created default user ${config.seedUser.email}`);
  return rows[0].id;
}

async function main() {
  const userId = await ensureSeedUser();

  // Only import if this user has no games yet (keeps re-runs cheap + safe).
  const [{ count }] = await query<{ count: string }>(
    `SELECT count(*)::int AS count FROM items WHERE user_id = $1 AND type = 'game'`,
    [userId]
  );
  if (parseInt(count, 10) > 0) {
    console.log(`[seed] user already has ${count} games — skipping import.`);
    await pool.end();
    return;
  }

  const csvPath = config.seedCsv;
  if (!csvPath || !existsSync(csvPath)) {
    console.log(`[seed] no seed CSV at "${csvPath}" — skipping game import.`);
    await pool.end();
    return;
  }

  const rows = parseGamesCsv(readFileSync(csvPath, 'utf8'));
  console.log(`[seed] importing ${rows.length} games...`);

  for (const g of rows) {
    await query(
      `INSERT INTO items (user_id, type, title, format, notes)
       VALUES ($1, 'game', $2, $3, $4)`,
      [userId, g.title, g.format, g.notes]
    );
  }
  console.log(`[seed] imported ${rows.length} games for ${config.seedUser.email}.`);
  await pool.end();
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
