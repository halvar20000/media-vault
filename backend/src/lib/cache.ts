import { query } from '../db/pool';

export interface CacheRow {
  source: string;
  source_key: string;
  source_id: string | null;
  cover_url: string | null;
  rating: number | null;
  description: string | null;
  payload: unknown;
}

// Normalize a lookup key so the same title isn't fetched twice.
export function cacheKey(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== '')
    .map((p) => String(p).toLowerCase().trim())
    .join('|');
}

export async function getCached(source: string, key: string): Promise<CacheRow | null> {
  const rows = await query<CacheRow>(
    `SELECT * FROM metadata_cache WHERE source = $1 AND source_key = $2`,
    [source, key]
  );
  return rows[0] ?? null;
}

export async function putCached(row: CacheRow): Promise<void> {
  await query(
    `INSERT INTO metadata_cache (source, source_key, source_id, cover_url, rating, description, payload, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (source, source_key) DO UPDATE SET
       source_id   = EXCLUDED.source_id,
       cover_url   = EXCLUDED.cover_url,
       rating      = EXCLUDED.rating,
       description = EXCLUDED.description,
       payload     = EXCLUDED.payload,
       fetched_at  = now()`,
    [
      row.source,
      row.source_key,
      row.source_id,
      row.cover_url,
      row.rating,
      row.description,
      JSON.stringify(row.payload ?? null),
    ]
  );
}
