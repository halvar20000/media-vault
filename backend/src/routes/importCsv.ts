import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/pool';
import { requireAuth, userId } from '../middleware/auth';
import { parseGamesCsv } from '../lib/games-csv';
import { parseFlickrackCsv } from '../lib/movies-csv';
import { getApiKeys } from '../lib/apikeys';
import { resolveSteamId, getOwnedGames, steamCoverUrl } from '../services/steam';

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

// POST /api/import/steam  { steamId: "<SteamID64 | vanity | profile URL>" }
// Imports the account's owned Steam games (format "Steam"), skipping any already
// imported. Requires a Steam Web API key and a public game-details profile.
importRouter.post('/steam', async (req, res) => {
  const uid = userId(req);
  if (!getApiKeys().steamApiKey) {
    return res.status(400).json({ error: 'Add a Steam Web API key in Settings first.' });
  }
  const input = String(req.body?.steamId ?? '').trim();
  if (!input) return res.status(400).json({ error: 'Enter your SteamID, vanity name or profile URL.' });

  let steamId: string | null;
  try {
    steamId = await resolveSteamId(input);
  } catch (err: any) {
    return res.status(502).json({ error: err?.message ?? 'could not resolve Steam ID' });
  }
  if (!steamId) return res.status(404).json({ error: 'Could not find that Steam profile.' });

  let games;
  try {
    games = await getOwnedGames(steamId);
  } catch (err: any) {
    return res.status(502).json({ error: err?.message ?? 'Steam request failed' });
  }
  if (!games.length) {
    return res.status(200).json({ imported: 0, total: 0, skipped: 0, hint: 'No games returned — set your Steam profile’s game details to Public and try again.' });
  }

  // Skip games already imported from Steam (by appid).
  const existing = await query<{ source_id: string }>(
    `SELECT source_id FROM items WHERE user_id = $1 AND source = 'steam' AND source_id IS NOT NULL`,
    [uid]
  );
  const have = new Set(existing.map((r) => r.source_id));

  let imported = 0;
  let skipped = 0;
  for (const g of games) {
    if (have.has(String(g.appid))) { skipped++; continue; }
    await query(
      `INSERT INTO items (user_id, type, title, format, source, source_id, cover_url, cover_source_url, enriched_at)
       VALUES ($1, 'game', $2, 'Steam', 'steam', $3, $4, $4, now())`,
      [uid, g.name, String(g.appid), steamCoverUrl(g.appid)]
    );
    imported++;
  }
  res.status(201).json({ imported, total: games.length, skipped });
});

// POST /api/import/movies  (multipart form field: "file")
// Bulk import a FlickRack movie export (EAN;ASIN;Titel;…;Format;Release;…).
importRouter.post('/movies', upload.single('file'), async (req, res) => {
  const uid = userId(req);
  if (!req.file) return res.status(400).json({ error: 'no file uploaded (field "file")' });

  let rows;
  try {
    rows = parseFlickrackCsv(req.file.buffer.toString('utf8'));
  } catch (err: any) {
    return res.status(400).json({ error: `could not parse CSV: ${err?.message ?? err}` });
  }
  if (!rows.length) return res.status(400).json({ error: 'no valid rows found' });

  let imported = 0;
  for (const m of rows) {
    await query(
      `INSERT INTO items (user_id, type, title, format, year, catalog_no, notes)
       VALUES ($1, 'movie', $2, $3, $4, $5, $6)`,
      [uid, m.title, m.format, m.year, m.catalog_no, m.notes]
    );
    imported++;
  }
  res.status(201).json({ imported, total: rows.length });
});
