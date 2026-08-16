import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, userId } from '../middleware/auth';
import { sourcesEnabled } from '../lib/apikeys';
import { igdbBrowse } from '../services/igdb';
import { buildCandidate, bestMatch, normalize, type Candidate } from '../lib/match';
import { XBOX360_BC } from '../data/xbox360bc';

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
  const ownedCand: Candidate[] = []; // owned on THIS platform
  const wishCand: Candidate[] = []; // wishlisted on THIS platform
  const otherCand: Candidate[] = []; // owned on ANOTHER platform (carries its format)
  for (const r of rows) {
    const rFmt = (r.format ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isThis = !fmtNorm || rFmt === fmtNorm;
    if (isThis) {
      if (r.source === 'igdb' && r.source_id) (r.wishlist ? wishIgdb : ownedIgdb).add(r.source_id);
      (r.wishlist ? wishCand : ownedCand).push(buildCandidate(r.title, r.wishlist));
    } else if (!r.wishlist) {
      // Owned on a different platform — remember which one for the label.
      otherCand.push(buildCandidate(r.title, false, r.format));
    }
  }

  // Xbox 360 (IGDB id 12): flag games playable on Xbox One / Series via back-compat.
  const isXbox360 = platform === 12;

  try {
    const hits = await igdbBrowse({ platformId: platform, q, sort, limit: 40, offset });
    const games = hits.map((h) => {
      let status: 'owned' | 'wishlist' | 'owned-other' | 'none' = 'none';
      let ownedOn: string | null = null;
      if (ownedIgdb.has(h.sourceId) || bestMatch(h.title, ownedCand)) status = 'owned';
      else if (wishIgdb.has(h.sourceId) || bestMatch(h.title, wishCand)) status = 'wishlist';
      else {
        const m = bestMatch(h.title, otherCand);
        if (m) {
          status = 'owned-other';
          ownedOn = m.match.format ?? null;
        }
      }
      const bc = isXbox360 && XBOX360_BC.has(normalize(h.title));
      return { ...h, status, ownedOn, bc };
    });
    res.json({ games, offset, hasMore: hits.length === 40 });
  } catch (err: any) {
    res.status(502).json({ error: err?.message ?? 'catalogue query failed', games: [] });
  }
});
