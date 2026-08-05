import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, userId } from '../middleware/auth';
import type { Item } from '../types';
import {
  valueItem,
  valueUserItems,
  valueSourceFor,
  valueSourceEnabled,
  type ValueSummary,
} from '../services/valuation';
import { config } from '../config';

export const valueRouter = Router();
valueRouter.use(requireAuth);

interface Job {
  running: boolean;
  startedAt: number;
  finishedAt: number | null;
  summary: ValueSummary | null;
  error: string | null;
}
const jobs = new Map<string, Job>();

// POST /api/value → background valuation of all non-manual items.
valueRouter.post('/', async (req, res) => {
  const uid = userId(req);
  const current = jobs.get(uid);
  if (current?.running) return res.status(202).json({ status: 'already-running', job: current });

  const job: Job = { running: true, startedAt: Date.now(), finishedAt: null, summary: null, error: null };
  jobs.set(uid, job);
  valueUserItems(uid)
    .then((summary) => { job.summary = summary; })
    .catch((err) => { job.error = err?.message ?? String(err); })
    .finally(() => { job.running = false; job.finishedAt = Date.now(); });

  res.status(202).json({ status: 'started', job });
});

// GET /api/value/status → progress + which value sources are live.
valueRouter.get('/status', (req, res) => {
  res.json({
    job: jobs.get(userId(req)) ?? null,
    sources: {
      pricecharting: config.pricecharting.enabled,
      discogs: valueSourceEnabled('discogs'),
    },
  });
});

// POST /api/value/item/:id → value a single item now (overrides a manual value).
valueRouter.post('/item/:id', async (req, res) => {
  const uid = userId(req);
  const rows = await query<Item>('SELECT * FROM items WHERE id = $1 AND user_id = $2', [req.params.id, uid]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });

  const src = valueSourceFor(rows[0].type);
  if (!src) return res.status(400).json({ error: 'no automatic price source for this media type' });
  if (!valueSourceEnabled(src)) return res.status(400).json({ error: `${src} is not configured` });

  const outcome = await valueItem(rows[0], { allowManualOverride: true });
  const updated = await query<Item>('SELECT * FROM items WHERE id = $1', [req.params.id]);
  res.json({ outcome, item: updated[0] });
});
