// Enrichment router — the hero feature.
// Routes each item to the right provider by media type, using the shared
// metadata_cache so each title is fetched from the network at most once.
import { config, SOURCE_FOR_TYPE, MediaType } from '../config';
import { query } from '../db/pool';
import { cacheKey, getCached, putCached } from '../lib/cache';
import type { EnrichmentResult, Item, SearchHit } from '../types';
import { igdbEnrich, igdbSearch } from './igdb';
import { tmdbEnrich, tmdbSearch } from './tmdb';
import { discogsEnrich, discogsSearch } from './discogs';
import { cacheCover } from '../lib/covers';

export function sourceEnabled(source: 'igdb' | 'tmdb' | 'discogs'): boolean {
  if (source === 'igdb') return config.igdb.enabled;
  if (source === 'tmdb') return config.tmdb.enabled;
  return config.discogs.enabled;
}

// The cache key groups CDs separately from vinyl (different Discogs format filter),
// and includes the platform for games (title alone is often ambiguous).
function keyForItem(item: Pick<Item, 'type' | 'title' | 'format'>): string {
  if (item.type === 'game') return cacheKey(item.title, item.format);
  if (item.type === 'cd') return cacheKey(item.title, 'cd');
  if (item.type === 'lp' || item.type === 'single') return cacheKey(item.title, 'vinyl');
  return cacheKey(item.title);
}

async function fetchFromProvider(
  item: Pick<Item, 'type' | 'title' | 'format' | 'year'>
): Promise<EnrichmentResult | null> {
  switch (SOURCE_FOR_TYPE[item.type]) {
    case 'igdb':
      return igdbEnrich(item.title, { platform: item.format });
    case 'tmdb':
      return tmdbEnrich(item.title, { year: item.year });
    case 'discogs':
      return discogsEnrich(item.title, item.type);
  }
}

export interface EnrichOutcome {
  status: 'enriched' | 'cached' | 'no-match' | 'source-disabled' | 'error';
  message?: string;
}

// Enrich a single item: cache-first, then provider, then persist onto the item.
export async function enrichItem(item: Item): Promise<EnrichOutcome> {
  const source = SOURCE_FOR_TYPE[item.type];
  if (!sourceEnabled(source)) return { status: 'source-disabled' };

  const key = keyForItem(item);
  try {
    let result: EnrichmentResult | null = null;
    let fromCache = false;

    const cached = await getCached(source, key);
    if (cached) {
      fromCache = true;
      result = {
        source: source,
        sourceId: cached.source_id,
        coverUrl: cached.cover_url,
        rating: cached.rating,
        description: cached.description,
      };
    } else {
      result = await fetchFromProvider(item);
      if (result) {
        await putCached({
          source,
          source_key: key,
          source_id: result.sourceId,
          cover_url: result.coverUrl,
          rating: result.rating,
          description: result.description,
          payload: result.payload,
        });
      }
    }

    if (!result) return { status: 'no-match' };

    // Cache the cover locally; fall back to the remote URL if the download fails.
    const remoteCover = result.coverUrl;
    let localCover: string | null = null;
    if (remoteCover) localCover = await cacheCover(remoteCover);
    const coverToStore = localCover ?? remoteCover;

    await query(
      `UPDATE items SET
         cover_url = COALESCE($2, cover_url),
         cover_source_url = COALESCE($3, cover_source_url),
         rating = $4,
         description = COALESCE($5, description),
         source = $6,
         source_id = $7,
         enriched_at = now()
       WHERE id = $1`,
      [item.id, coverToStore, remoteCover, result.rating, result.description, source, result.sourceId]
    );

    return { status: fromCache ? 'cached' : 'enriched' };
  } catch (err: any) {
    console.error(`[enrich] item ${item.id} (${item.title}) failed:`, err?.message ?? err);
    return { status: 'error', message: err?.message ?? String(err) };
  }
}

export interface EnrichSummary {
  total: number;
  enriched: number;
  cached: number;
  noMatch: number;
  disabled: number;
  errors: number;
}

// Enrich every not-yet-enriched item for a user (or all, if force).
export async function enrichUserItems(
  userId: string,
  opts: { force?: boolean } = {}
): Promise<EnrichSummary> {
  const items = await query<Item>(
    `SELECT * FROM items
     WHERE user_id = $1 ${opts.force ? '' : 'AND enriched_at IS NULL'}
     ORDER BY created_at ASC`,
    [userId]
  );

  const summary: EnrichSummary = {
    total: items.length,
    enriched: 0,
    cached: 0,
    noMatch: 0,
    disabled: 0,
    errors: 0,
  };

  for (const item of items) {
    const outcome = await enrichItem(item);
    switch (outcome.status) {
      case 'enriched':
        summary.enriched++;
        // Gentle pacing on live network fetches to respect provider rate limits.
        await sleep(SOURCE_FOR_TYPE[item.type] === 'discogs' ? 1100 : 300);
        break;
      case 'cached':
        summary.cached++;
        break;
      case 'no-match':
        summary.noMatch++;
        break;
      case 'source-disabled':
        summary.disabled++;
        break;
      case 'error':
        summary.errors++;
        break;
    }
  }
  return summary;
}

// External title search for the add-flow autofill.
export async function searchExternal(type: MediaType, q: string): Promise<SearchHit[]> {
  const source = SOURCE_FOR_TYPE[type];
  if (!sourceEnabled(source)) return [];
  switch (source) {
    case 'igdb':
      return igdbSearch(q);
    case 'tmdb':
      return tmdbSearch(q);
    case 'discogs':
      return discogsSearch(q, type);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
