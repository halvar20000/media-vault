import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, userId } from '../middleware/auth';
import { sourcesEnabled } from '../lib/apikeys';
import { igdbBrowse } from '../services/igdb';
import { buildCandidate, bestMatch, type Candidate } from '../lib/match';

export const catalogueRouter = Router();
catalogueRouter.use(requireAuth);

// GET /api/catalogue?platform=8&region=1&q=&sort=popular&offset=0
// Browse a platform's game library with owned / wishlist overlay.
catalogueRouter.get('/', async (req, res) => {
  if (!sourcesEnabled().igdb) return res.status(400).json({ error: 'IGDB is not configured', games: [] });

  const platform = parseInt(String(req.query.platform ?? ''), 10);
  if (!platform) return res.status(400).json({ error: 'platform (IGDB id) required' });
  const q = String(req.query.q ?? '').trim() || undefined;
  const sort = String(req.query.sort ?? 'popular');
  const offset = Math.max(0, parseInt(String(req.query.offset ?? '0'), 10) || 0);
  // Restrict ownership to this platform's copies (e.g. "PS2") when provided.
  const fmtNorm = String(req.query.format ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const uid = userId(req);
  const rows = await query<{ title: string; format: string | null; source: string | null; source_id: string | null; wishlist: boolean }>(
    `SELECT title, format, source, source_id, wishlist FROM items WHERE user_id = $1 AND type = 'game'`,
    [uid]
  );
  const ownedIgdb = new Set<string>();
  const wishIgdb = new Set<string>();
  const ownedCand: Candidate[] = [];
  const wishCand: Candidate[] = [];
  for (const r of rows) {
    if (fmtNorm && (r.format ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') !== fmtNorm) continue;
    if (r.source === 'igdb' && r.source_id) (r.wishlist ? wishIgdb : ownedIgdb).add(r.source_id);
    (r.wishlist ? wishCand : ownedCand).push(buildCandidate(r.title, r.wishlist));
  }

  try {
    const hits = await igdbBrowse({ platformId: platform, q, sort, limit: 40, offset });
    const games = hits.map((h) => {
      let status: 'owned' | 'wishlist' | 'none' = 'none';
      if (ownedIgdb.has(h.sourceId)) status = 'owned';
      else if (wishIgdb.has(h.sourceId)) status = 'wishlist';
      else if (bestMatch(h.title, ownedCand)) status = 'owned';
      else if (bestMatch(h.title, wishCand)) status = 'wishlist';
      return { ...h, status };
    });
    res.json({ games, offset, hasMore: hits.length === 40 });
  } catch (err: any) {
    res.status(502).json({ error: err?.message ?? 'catalogue query failed', games: [] });
  }
});
