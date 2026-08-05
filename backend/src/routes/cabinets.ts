import { Router } from 'express';
import { query } from '../db/pool';
import { requireAuth, userId } from '../middleware/auth';
import type { Cabinet } from '../types';

export const cabinetsRouter = Router();
cabinetsRouter.use(requireAuth);

// GET /api/cabinets → user's cabinets with item counts
cabinetsRouter.get('/', async (req, res) => {
  const uid = userId(req);
  const rows = await query<Cabinet>(
    `SELECT c.*, count(i.id)::int AS item_count
       FROM cabinets c
       LEFT JOIN items i ON i.cabinet_id = c.id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY lower(c.name) ASC`,
    [uid]
  );
  res.json({ cabinets: rows });
});

// POST /api/cabinets { name }
cabinetsRouter.post('/', async (req, res) => {
  const uid = userId(req);
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const rows = await query<Cabinet>(
      `INSERT INTO cabinets (user_id, name) VALUES ($1, $2) RETURNING *`,
      [uid, name]
    );
    res.status(201).json({ cabinet: rows[0] });
  } catch (err: any) {
    if (err?.code === '23505') return res.status(409).json({ error: 'a cabinet with that name already exists' });
    throw err;
  }
});

// PATCH /api/cabinets/:id { name }
cabinetsRouter.patch('/:id', async (req, res) => {
  const uid = userId(req);
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  const rows = await query<Cabinet>(
    `UPDATE cabinets SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [name, req.params.id, uid]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ cabinet: rows[0] });
});

// DELETE /api/cabinets/:id  (items keep their data; cabinet_id set null via FK)
cabinetsRouter.delete('/:id', async (req, res) => {
  const uid = userId(req);
  const rows = await query<{ id: string }>(
    `DELETE FROM cabinets WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, uid]
  );
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});
