import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { MEDIA_TYPES, MediaType, SOURCE_FOR_TYPE } from '../config';
import { searchExternal, sourceEnabled } from '../services/enrich';
import { discogsBarcodeSearch } from '../services/discogs';
import { upcLookup } from '../services/upc';

export const barcodeRouter = Router();
barcodeRouter.use(requireAuth);

// GET /api/barcode/:type/:code
// Music → Discogs barcode search. Games/Movies → resolve the barcode to a
// product title (UPCitemdb) then match against IGDB/TMDB.
barcodeRouter.get('/:type/:code', async (req, res) => {
  const type = String(req.params.type) as MediaType;
  const code = String(req.params.code).replace(/\D/g, ''); // digits only

  if (!MEDIA_TYPES.includes(type)) return res.status(400).json({ error: 'invalid type' });
  if (!code) return res.status(400).json({ error: 'invalid barcode' });

  const source = SOURCE_FOR_TYPE[type];
  if (!source || !sourceEnabled(source)) {
    return res.status(400).json({ error: `source "${source}" is not configured`, hits: [] });
  }

  try {
    if (source === 'discogs') {
      const hits = await discogsBarcodeSearch(code);
      return res.json({ resolvedTitle: null, hits });
    }
    // games / movies: barcode → title → metadata source
    const resolvedTitle = await upcLookup(code);
    const hits = resolvedTitle ? await searchExternal(type, resolvedTitle) : [];
    return res.json({ resolvedTitle, hits });
  } catch (err: any) {
    res.status(502).json({ error: err?.message ?? 'barcode lookup failed', hits: [] });
  }
});
