import type { Item } from './types';

// Build a leboncoin.fr search URL for an item, cheapest-first. We link out to
// leboncoin's own search (no scraping) — reliable and within their terms.
export function leboncoinSearchUrl(item: Pick<Item, 'title' | 'format' | 'type'>): string {
  // Drop the "(360)" style disambiguator from the display title.
  const cleanTitle = item.title.replace(/\s*\([a-z0-9][a-z0-9 \-]{0,6}\)\s*$/i, '').trim();
  const parts = [cleanTitle];
  // Add the platform / disc format to narrow games and movies.
  if ((item.type === 'game' || item.type === 'movie') && item.format) parts.push(item.format);
  const q = parts.join(' ').trim();
  return `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(q)}&sort=price&order=asc`;
}
