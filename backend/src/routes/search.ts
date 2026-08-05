import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { MEDIA_TYPES, MediaType } from '../config';
import { searchExternal, sourceEnabled } from '../services/enrich';
import { SOURCE_FOR_TYPE } from '../config';

export const searchRouter = Router();
searchRouter.use(requireAuth);

// GET /api/search/:type?q=...  → external title search for add-flow autofill.
searchRouter.get('/:type', async (req, res) => {
  const type = String(req.params.type) as MediaType;
  const q = String(req.query.q ?? '').trim();

  if (!MEDIA_TYPES.includes(type)) return res.status(400).json({ error: 'invalid type' });
  if (!q) return res.json({ hits: [] });

  const source = SOURCE_FOR_TYPE[type];
  if (!sourceEnabled(source)) {
    return res.status(400).json({ error: `source "${source}" is not configured`, hits: [] });
  }

  try {
    const hits = await searchExternal(type, q);
    res.json({ hits });
  } catch (err: any) {
    res.status(502).json({ error: err?.message ?? 'search failed', hits: [] });
  }
});
