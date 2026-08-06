// Resolve an EAN/UPC barcode to a product title using the free UPCitemdb trial
// endpoint (no key; ~100 lookups/day, rate-limited). Best-effort — returns null
// when nothing is found. Used to bridge a games/movies barcode to a title we can
// then match against IGDB/TMDB.
export async function upcLookup(code: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: { title?: string }[] };
    const title = json.items?.[0]?.title?.trim();
    return title ? cleanProductTitle(title) : null;
  } catch {
    return null;
  }
}

// UPC product titles are noisy ("Nintendo Switch: <game> EU Version Region Free").
// Strip a leading platform prefix + trailing region/edition noise so the result
// matches IGDB/TMDB.
export function cleanProductTitle(raw: string): string {
  let s = raw;
  // Leading "Platform: " prefix (only if the pre-colon part names a platform).
  s = s.replace(
    /^[^:]*\b(nintendo switch|nintendo|switch|playstation\s*\d?|ps\d|psp|xbox[\s-]?(one|360|series\s*[sx])?|wii\s*u?|sony|microsoft|sega|steam|blu-?ray|dvd)\b[^:]*:\s*/i,
    ''
  );
  // Bracketed/parenthetical extras.
  s = s.replace(/[[(][^\])]*[\])]/g, ' ');
  // Trailing region / edition / platform noise (repeatedly).
  const noise =
    /\b(eu|us|usa|uk|pal|ntsc|jp|japan|region[\s-]?free|import|standard edition|collector'?s edition|deluxe edition|game of the year|goty|remastered|version|edition|nintendo switch|playstation\s*\d?|ps\d|xbox[\s-]?(one|360|series\s*[sx])?|wii\s*u?|blu-?ray|dvd)\b/gi;
  let prev;
  do {
    prev = s;
    s = s.replace(noise, ' ');
  } while (s !== prev);
  return s.replace(/\s{2,}/g, ' ').replace(/[\s:–-]+$/, '').trim();
}
