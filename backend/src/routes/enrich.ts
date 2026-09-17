import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, userId } from '../middleware/auth';
import type { Item } from '../types';
import {
  enrichItem,
  enrichUserItems,
  sourceEnabled,
  sourceForType,
  type EnrichSummary,
} from '../services/enrich';

export const enrichRouter = Router();
enrichRouter.use(requireAuth);

// Lightweight in-memory job tracker (fine for a single-instance self-host).
interface Job {
  running: boolean;
  startedAt: number;
  finishedAt: number | null;
  summary: EnrichSummary | null;
  error: string | null;
}
const jobs = new Map<string, Job>();

// POST /api/enrich  → start (or report) a background enrichment run.
enrichRouter.post('/', async (req, res) => {
  const uid = userId(req);
  const force = String(req.query.force ?? '') === 'true';

  // Optional field selection for a re-fetch, e.g. ?fields=title,cover,text.
  // Absent → the default (cover + text, never the title).
  const fieldsParam = String(req.query.fields ?? '').trim();
  const sel = new Set(fieldsParam.split(',').map((s) => s.trim()).filter(Boolean));
  const fields = fieldsParam
    ? { title: sel.has('title'), cover: sel.has('cover'), text: sel.has('text') }
    : undefined;

  const current = jobs.get(uid);
  if (current?.running) {
    return res.status(202).json({ status: 'already-running', job: current });
  }

  const job: Job = {
    running: true,
    startedAt: Date.now(),
    finishedAt: null,
    summary: null,
    error: null,
  };
  jobs.set(uid, job);

  // Fire and forget; progress is observable via GET /status and /api/items/stats.
  enrichUserItems(uid, { force, fields })
    .then((summary) => {
      job.summary = summary;
    })
    .catch((err) => {
      job.error = err?.message ?? String(err);
    })
    .finally(() => {
      job.running = false;
      job.finishedAt = Date.now();
    });

  res.status(202).json({ status: 'started', job });
});

// GET /api/enrich/status  → progress of the current/last run + which sources are live.
enrichRouter.get('/status', (req, res) => {
  const uid = userId(req);
  res.json({
    job: jobs.get(uid) ?? null,
    sources: {
      igdb: sourceEnabled('igdb'),
      tmdb: sourceEnabled('tmdb'),
      discogs: sourceEnabled('discogs'),
      musicbrainz: sourceEnabled('musicbrainz'), // keyless — always true
    },
  });
});

// POST /api/enrich/item/:id  → (re)enrich a single item synchronously.
enrichRouter.post('/item/:id', async (req, res) => {
  const uid = userId(req);
  const rows = await query<Item>('SELECT * FROM items WHERE id = $1 AND user_id = $2', [
    req.params.id,
    uid,
  ]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });

  const source = sourceForType(rows[0].type);
  if (!source || !sourceEnabled(source)) {
    return res.status(400).json({ error: `source "${source}" is not configured` });
  }
  const force = String(req.query.force ?? '') === 'true';
  const outcome = await enrichItem(rows[0], { force });
  const updated = await query<Item>('SELECT * FROM items WHERE id = $1', [req.params.id]);
  res.json({ outcome, item: updated[0] });
});
