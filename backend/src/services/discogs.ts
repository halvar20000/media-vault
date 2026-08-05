// Discogs (vinyl LP / single / CD) provider. Auth is a personal access token.
// Docs: https://www.discogs.com/developers
import { config, type MediaType } from '../config';
import type { EnrichmentResult, SearchHit, ValueResult } from '../types';

interface DiscogsSearchResult {
  id: number;
  title: string; // "Artist - Title"
  year?: string;
  cover_image?: string;
  thumb?: string;
  format?: string[];
}

interface DiscogsRelease {
  id: number;
  notes?: string;
  community?: { rating?: { average?: number; count?: number } };
}

function authHeader(): string {
  // Prefer a personal token; fall back to consumer key+secret (read-only).
  if (config.discogs.token) return `Discogs token=${config.discogs.token}`;
  return `Discogs key=${config.discogs.key}, secret=${config.discogs.secret}`;
}

function headers() {
  return {
    Authorization: authHeader(),
    'User-Agent': config.discogs.userAgent,
    Accept: 'application/json',
  };
}

// Map our music media types to a Discogs format filter.
function formatFilter(type?: MediaType): string | null {
  if (type === 'cd') return 'CD';
  if (type === 'lp' || type === 'single') return 'Vinyl';
  return null;
}

async function apiSearch(title: string, type?: MediaType): Promise<DiscogsSearchResult[]> {
  const url = new URL('https://api.discogs.com/database/search');
  url.searchParams.set('q', title);
  url.searchParams.set('type', 'release');
  const fmt = formatFilter(type);
  if (fmt) url.searchParams.set('format', fmt);
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Discogs search failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { results?: DiscogsSearchResult[] };
  return json.results ?? [];
}

async function apiRelease(id: number): Promise<DiscogsRelease | null> {
  const res = await fetch(`https://api.discogs.com/releases/${id}`, { headers: headers() });
  if (!res.ok) return null;
  return (await res.json()) as DiscogsRelease;
}

function toHit(r: DiscogsSearchResult): SearchHit {
  const year = r.year ? parseInt(r.year, 10) || null : null;
  const format = r.format?.length ? r.format.join(', ') : null;
  return {
    source: 'discogs',
    sourceId: String(r.id),
    title: r.title,
    year,
    format,
    coverUrl: r.cover_image || r.thumb || null,
    rating: null, // community rating needs a per-release fetch (done during enrich)
    description: null,
  };
}

export async function discogsSearch(
  title: string,
  type?: MediaType,
  limit = 8
): Promise<SearchHit[]> {
  const results = await apiSearch(title, type);
  return results.slice(0, limit).map(toHit);
}

export async function discogsEnrich(
  title: string,
  type?: MediaType
): Promise<EnrichmentResult | null> {
  const hits = await discogsSearch(title, type, 1);
  const hit = hits[0];
  if (!hit) return null;

  // Fetch the release for community rating + notes (the description).
  let rating: number | null = null;
  let description: string | null = null;
  const release = await apiRelease(parseInt(hit.sourceId, 10));
  if (release) {
    const avg = release.community?.rating?.average;
    if (typeof avg === 'number' && avg > 0) rating = Math.round(avg * 20 * 10) / 10; // 0..5 → 0..100
    description = release.notes ?? null;
  }

  return {
    source: 'discogs',
    sourceId: hit.sourceId,
    coverUrl: hit.coverUrl,
    rating,
    description,
    payload: { ...hit, rating, description },
  };
}

// Market value = lowest current marketplace listing for a release (uses the token).
export async function discogsMarketValue(releaseId: string): Promise<ValueResult | null> {
  const curr = config.valuationCurrency;
  const res = await fetch(
    `https://api.discogs.com/marketplace/stats/${encodeURIComponent(releaseId)}?curr_abbr=${curr}`,
    { headers: headers() }
  );
  if (!res.ok) return null;
  const stats = (await res.json()) as {
    lowest_price?: { value?: number; currency?: string } | null;
    num_for_sale?: number;
  };
  const lp = stats.lowest_price;
  if (!lp || typeof lp.value !== 'number' || lp.value <= 0) return null;
  return { source: 'discogs', value: lp.value, currency: lp.currency || curr, note: 'lowest listing' };
}
