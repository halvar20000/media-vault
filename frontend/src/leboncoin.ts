import type { Item, MediaType } from './types';

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

// Search leboncoin for bundles ("lots") of a media type / platform — often the
// best deals. `format` narrows to a specific console / disc format when set.
export function leboncoinBundleUrl(type: MediaType | 'all', format?: string): string {
  let q: string;
  switch (type) {
    case 'game':
      q = format ? `lot jeux ${format}` : 'lot jeux vidéo';
      break;
    case 'movie':
      q = format ? `lot ${format}` : 'lot dvd blu-ray';
      break;
    case 'lp':
      q = 'lot vinyles';
      break;
    case 'single':
      q = 'lot vinyles 45 tours';
      break;
    case 'cd':
      q = 'lot cd';
      break;
    default:
      q = 'lot jeux vidéo';
  }
  return `https://www.leboncoin.fr/recherche?text=${encodeURIComponent(q)}&sort=price&order=asc`;
}
