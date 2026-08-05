import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/pool';
import { requireAuth, userId } from '../middleware/auth';
import { MEDIA_TYPES, MediaType } from '../config';
import type { Item } from '../types';
import { cacheCover, saveUploadedCover } from '../lib/covers';

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

async function ownedItem(id: string, uid: string): Promise<Item | null> {
  const rows = await query<Item>('SELECT * FROM items WHERE id = $1 AND user_id = $2', [id, uid]);
  return rows[0] ?? null;
}

// GET /api/items?type=game&q=zelda
itemsRouter.get('/', async (req, res) => {
  const uid = userId(req);
  const type = String(req.query.type ?? '').trim();
  const q = String(req.query.q ?? '').trim();

  // Columns qualified with i. because we LEFT JOIN cabinets (shared user_id column).
  const where: string[] = ['i.user_id = $1'];
  const params: any[] = [uid];

  if (type && MEDIA_TYPES.includes(type as MediaType)) {
    params.push(type);
    where.push(`i.type = $${params.length}`);
  }
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    const p = params.length;
    where.push(`(lower(i.title) LIKE $${p} OR lower(coalesce(i.format,'')) LIKE $${p} OR lower(coalesce(i.catalog_no,'')) LIKE $${p})`);
  }

  const items = await query<Item>(
    `SELECT i.*, c.name AS cabinet_name
       FROM items i
       LEFT JOIN cabinets c ON c.id = i.cabinet_id
      WHERE ${where.join(' AND ')}
      ORDER BY i.title ASC`,
    params
  );
  res.json({ items });
});

// GET /api/items/stats  → counts per type + enrichment progress
itemsRouter.get('/stats', async (req, res) => {
  const uid = userId(req);
  const byType = await query<{ type: string; count: string }>(
    `SELECT type, count(*)::int AS count FROM items WHERE user_id = $1 GROUP BY type`,
    [uid]
  );
  const [{ total }] = await query<{ total: string }>(
    `SELECT count(*)::int AS total FROM items WHERE user_id = $1`,
    [uid]
  );
  const [{ enriched }] = await query<{ enriched: string }>(
    `SELECT count(*)::int AS enriched FROM items WHERE user_id = $1 AND enriched_at IS NOT NULL`,
    [uid]
  );
  // Collection value, grouped by currency (games are USD, music EUR, etc.).
  const valueRows = await query<{ currency: string | null; total: number; n: number }>(
    `SELECT value_currency AS currency, sum(value)::numeric AS total, count(*)::int AS n
       FROM items WHERE user_id = $1 AND value IS NOT NULL
      GROUP BY value_currency ORDER BY sum(value) DESC`,
    [uid]
  );
  res.json({
    total: Number(total),
    enriched: Number(enriched),
    byType: Object.fromEntries(byType.map((r) => [r.type, Number(r.count)])),
    valuedCount: valueRows.reduce((a, r) => a + Number(r.n), 0),
    totalValue: valueRows.map((r) => ({ currency: r.currency || '?', total: Number(r.total) })),
  });
});

const EDITABLE = [
  'type', 'title', 'format', 'year', 'catalog_no', 'location', 'condition', 'notes',
  'cover_url', 'rating', 'description', 'source', 'source_id',
  // physical-collector fields
  'disc_count', 'is_series', 'season_count', 'episode_count',
  'lent_to', 'lent_since', 'viewed_at', 'cabinet_id',
  // valuation (manual entry)
  'value', 'value_currency',
] as const;

// POST /api/items  → create one item
itemsRouter.post('/', async (req, res) => {
  const uid = userId(req);
  const body = req.body ?? {};
  const type = String(body.type ?? '').trim();
  const title = String(body.title ?? '').trim();
  if (!MEDIA_TYPES.includes(type as MediaType)) {
    return res.status(400).json({ error: 'invalid or missing type' });
  }
  if (!title) return res.status(400).json({ error: 'title is required' });

  const cols = ['user_id'];
  const vals: any[] = [uid];
  for (const f of EDITABLE) {
    if (body[f] !== undefined) {
      cols.push(f);
      vals.push(body[f] === '' ? null : body[f]);
    }
  }
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await query<Item>(
    `INSERT INTO items (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    vals
  );
  res.status(201).json({ item: rows[0] });
});

// PATCH /api/items/:id
itemsRouter.patch('/:id', async (req, res) => {
  const uid = userId(req);
  const body = req.body ?? {};
  const sets: string[] = [];
  const vals: any[] = [];
  for (const f of EDITABLE) {
    if (body[f] !== undefined) {
      vals.push(body[f] === '' ? null : body[f]);
      sets.push(`${f} = $${vals.length}`);
    }
  }
  // Setting a value by hand marks it manual (so bulk valuation won't overwrite it).
  if (body.value !== undefined) {
    const manual = body.value !== '' && body.value !== null;
    vals.push(manual);
    sets.push(`value_manual = $${vals.length}`);
    sets.push(`value_source = ${manual ? `'manual'` : 'NULL'}`);
    sets.push(`valued_at = ${manual ? 'now()' : 'NULL'}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'no editable fields provided' });

  vals.push(req.params.id, uid);
  const rows = await query<Item>(
    `UPDATE items SET ${sets.join(', ')}
     WHERE id = $${vals.length - 1} AND user_id = $${vals.length} RETURNING *`,
    vals
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ item: rows[0] });
});

// POST /api/items/:id/apply-match
// Apply a chosen external search hit's artwork/rating/description to an item.
itemsRouter.post('/:id/apply-match', async (req, res) => {
  const uid = userId(req);
  const item = await ownedItem(req.params.id, uid);
  if (!item) return res.status(404).json({ error: 'not found' });

  const b = req.body ?? {};
  const remoteCover: string | null = b.coverUrl ?? null;
  const local = remoteCover ? await cacheCover(remoteCover) : null;
  const coverToStore = local ?? remoteCover;

  const rows = await query<Item>(
    `UPDATE items SET
       cover_url = COALESCE($2, cover_url),
       cover_source_url = $3,
       rating = $4,
       description = COALESCE($5, description),
       source = COALESCE($6, source),
       source_id = COALESCE($7, source_id),
       enriched_at = now()
     WHERE id = $1 AND user_id = $8 RETURNING *`,
    [item.id, coverToStore, remoteCover, b.rating ?? null, b.description ?? null,
     b.source ?? null, b.sourceId ?? null, uid]
  );
  res.json({ item: rows[0] });
});

// POST /api/items/:id/cover  — manual cover: multipart "file", or JSON/form { url }
itemsRouter.post('/:id/cover', coverUpload.single('file'), async (req, res) => {
  const uid = userId(req);
  const item = await ownedItem(req.params.id, uid);
  if (!item) return res.status(404).json({ error: 'not found' });

  let localPath: string | null = null;
  let sourceUrl: string | null = null;
  if (req.file) {
    localPath = saveUploadedCover(req.file.buffer, req.file.mimetype);
    if (!localPath) return res.status(400).json({ error: 'unsupported image type' });
  } else if (req.body?.url) {
    sourceUrl = String(req.body.url);
    localPath = await cacheCover(sourceUrl);
    if (!localPath) return res.status(400).json({ error: 'could not fetch image from URL' });
  } else {
    return res.status(400).json({ error: 'provide an image file or a url' });
  }

  const rows = await query<Item>(
    `UPDATE items SET cover_url = $2, cover_source_url = $3 WHERE id = $1 AND user_id = $4 RETURNING *`,
    [item.id, localPath, sourceUrl, uid]
  );
  res.json({ item: rows[0] });
});

// DELETE /api/items/:id
itemsRouter.delete('/:id', async (req, res) => {
  const uid = userId(req);
  const rows = await query<{ id: string }>(
    'DELETE FROM items WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, uid]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});
