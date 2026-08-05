import { parse } from 'csv-parse/sync';

export interface GameRow {
  title: string;
  format: string | null; // platform
  notes: string | null; // emulation status
}

// Parse the master_game_list.csv shape: Title,Platform,EmulationStatus
// Tolerant of extra columns and different header casing.
export function parseGamesCsv(text: string): GameRow[] {
  const records: Record<string, string>[] = parse(text, {
    columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });

  const rows: GameRow[] = [];
  for (const r of records) {
    const title = (r['title'] ?? '').trim();
    if (!title) continue;
    rows.push({
      title,
      format: (r['platform'] ?? '').trim() || null,
      notes: (r['emulationstatus'] ?? r['emulation status'] ?? '').trim() || null,
    });
  }
  return rows;
}
