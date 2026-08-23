import { parse } from 'csv-parse/sync';
import type { MediaType } from '../config';

// A row of the documented, AI-fillable "universal" import format. Named columns,
// order-independent, tolerant of extra columns and header casing. Only `title`
// is required; `type` is strongly recommended (defaults to movie — the disc-shelf
// use case). An optional provider id (tmdb_id / igdb_id / discogs_id) lets an AI
// match a title exactly, so enrichment pulls the right artwork with no guessing.
export interface UniversalRow {
  type: MediaType;
  title: string;
  format: string | null;
  year: number | null;
  catalog_no: string | null;
  notes: string | null;
  source: 'igdb' | 'tmdb' | 'discogs' | null;
  source_id: string | null;
}

// Map a free-text type/format word onto a media type. A disc format like
// "Blu-ray" or "4K UHD" also becomes the row's format, matching how people
// naturally label a movie ("Blu-ray, <title>").
function normalizeType(raw: string): { type: MediaType; formatHint: string | null } {
  const v = raw.toLowerCase().trim();
  if (!v) return { type: 'movie', formatHint: null };

  // A disc format may accompany any video type (movie or series box set).
  let formatHint: string | null = null;
  if (/\b4k\b|uhd/.test(v)) formatHint = '4K UHD';
  else if (/blu\s*-?\s*ray|bluray|\bbd\b/.test(v)) formatHint = 'Blu-ray';
  else if (/\bdvd\b/.test(v)) formatHint = 'DVD';

  // Series/TV takes precedence over the generic movie disc mapping, so
  // "Serie Blu-ray" is a series (format Blu-ray), not a movie.
  if (/series|serie|\btv\b|show|staffel/.test(v)) return { type: 'series', formatHint };
  if (formatHint) return { type: 'movie', formatHint };
  if (/movie|film/.test(v)) return { type: 'movie', formatHint: null };

  if (/console|konsole/.test(v)) return { type: 'console', formatHint: null };
  if (/single|7"/.test(v)) return { type: 'single', formatHint: null };
  if (/\bcd\b/.test(v)) return { type: 'cd', formatHint: null };
  if (/lp|vinyl|record|schallplatte/.test(v)) return { type: 'lp', formatHint: null };
  if (/game|spiel/.test(v)) return { type: 'game', formatHint: null };

  return { type: 'movie', formatHint: null };
}

function toYear(v: string | undefined): number | null {
  if (!v) return null;
  const m = v.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

function clean(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  return s || null;
}

function firstDigits(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  const m = s.match(/\d+/);
  return m ? m[0] : null;
}

// Parse the universal CSV. Comma-delimited by default; auto-detects semicolon
// (common when Excel saves in a German locale).
export function parseUniversalCsv(text: string): UniversalRow[] {
  const delimiter = detectDelimiter(text);
  const records: Record<string, string>[] = parse(text, {
    delimiter,
    bom: true,
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_')),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  });

  const rows: UniversalRow[] = [];
  for (const r of records) {
    const title = (r['title'] ?? r['titel'] ?? r['name'] ?? '').trim();
    if (!title) continue;

    const { type, formatHint } = normalizeType(r['type'] ?? r['typ'] ?? '');
    const format = clean(r['format']) ?? clean(r['platform']) ?? clean(r['plattform']) ?? formatHint;

    // Provider id: only honour the id that matches the row's media type, so a
    // stray column can't point a game at a movie record.
    let source: UniversalRow['source'] = null;
    let source_id: string | null = null;
    const tmdb = firstDigits(r['tmdb_id'] ?? r['tmdbid'] ?? r['tmdb']);
    const igdb = firstDigits(r['igdb_id'] ?? r['igdbid'] ?? r['igdb']);
    const discogs = firstDigits(r['discogs_id'] ?? r['discogsid'] ?? r['discogs']);
    // For a series, tmdb_id is a TMDB *TV* id (resolved via /tv on enrich).
    if ((type === 'movie' || type === 'series') && tmdb) { source = 'tmdb'; source_id = tmdb; }
    else if (type === 'game' && igdb) { source = 'igdb'; source_id = igdb; }
    else if ((type === 'lp' || type === 'single' || type === 'cd') && discogs) { source = 'discogs'; source_id = discogs; }

    rows.push({
      type,
      title,
      format,
      year: toYear(r['year'] ?? r['jahr'] ?? r['release']),
      catalog_no: clean(r['barcode']) ?? clean(r['ean']) ?? clean(r['catalog_no']) ?? clean(r['asin']),
      notes: clean(r['notes']) ?? clean(r['note']) ?? clean(r['notizen']),
      source,
      source_id,
    });
  }
  return rows;
}

// Pick ';' only if the header line clearly uses it more than ','.
function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}
