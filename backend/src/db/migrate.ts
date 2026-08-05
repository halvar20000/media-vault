// Applies schema.sql. Idempotent — runs on every container boot.
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './pool';

async function main() {
  const schemaPath = join(__dirname, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');
  console.log('[migrate] applying schema...');
  await pool.query(sql);
  console.log('[migrate] done.');
  await pool.end();
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
