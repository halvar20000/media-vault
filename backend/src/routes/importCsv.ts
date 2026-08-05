import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/pool';
import { requireAuth, userId } from '../middleware/auth';
import { parseGamesCsv } from '../lib/games-csv';

export const importRouter = Router();
importRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// POST /api/import/games  (multipart form field: "file")
// Bulk import a games CSV (Title,Platform,EmulationStatus).
importRouter.post('/games', upload.single('file'), async (req, res) => {
  const uid = userId(req);
  if (!req.file) return res.status(400).json({ error: 'no file uploaded (field "file")' });

  let rows;
  try {
    rows = parseGamesCsv(req.file.buffer.toString('utf8'));
  } catch (err: any) {
    return res.status(400).json({ error: `could not parse CSV: ${err?.message ?? err}` });
  }
  if (!rows.length) return res.status(400).json({ error: 'no valid rows found' });

  let imported = 0;
  for (const g of rows) {
    await query(
      `INSERT INTO items (user_id, type, title, format, notes)
       VALUES ($1, 'game', $2, $3, $4)`,
      [uid, g.title, g.format, g.notes]
    );
    imported++;
  }
  res.status(201).json({ imported, total: rows.length });
});
