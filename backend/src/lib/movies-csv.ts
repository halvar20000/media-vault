import { parse } from 'csv-parse/sync';

export interface MovieRow {
  title: string;
  format: string | null; // Blu-Ray / DVD / 4K UHD ...
  year: number | null;
  catalog_no: string | null; // ASIN (the EAN is corrupted to sci-notation by Excel)
  notes: string | null; // e.g. FSK age rating
}

// Strip a trailing media-format tag like " [Blu-ray]" and collapse whitespace,
// so "I Am Legend [Blu-ray]" → "I Am Legend" for accurate title matching.
function cleanTitle(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, ' ') // remove any [ ... ] groups
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function toYear(v: string | undefined): number | null {
  if (!v) return null;
  const m = v.match(/\d{4}/);
  return m ? parseInt(m[0], 10) : null;
}

// Parse a FlickRack export: semicolon-separated, UTF-8 (BOM), German headers.
// We only rely on the leading columns (EAN;ASIN;Titel;…;Format;Release;…;FSK),
// which sit before the messy free-text description, so mildly malformed rows
// (unescaped separators inside descriptions) still yield correct core fields.
export function parseFlickrackCsv(text: string): MovieRow[] {
  const records: Record<string, string>[] = parse(text, {
    delimiter: ';',
    bom: true,
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  });

  const rows: MovieRow[] = [];
  for (const r of records) {
    const rawTitle = (r['titel'] ?? r['title'] ?? '').trim();
    const title = cleanTitle(rawTitle);
    if (!title) continue;

    const fsk = (r['fsk'] ?? '').trim();
    rows.push({
      title,
      format: (r['format'] ?? '').trim() || null,
      year: toYear(r['release']),
      catalog_no: (r['asin'] ?? '').trim() || null,
      notes: fsk && fsk.toLowerCase() !== 'nicht geprüft' ? `FSK: ${fsk}` : null,
    });
  }
  return rows;
}
