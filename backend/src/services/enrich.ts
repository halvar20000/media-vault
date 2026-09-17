// Enrichment router — the hero feature.
// Routes each item to the right provider by media type, using the shared
// metadata_cache so each title is fetched from the network at most once.
import { SOURCE_FOR_TYPE, MediaType } from '../config';
import { query } from '../db/pool';
import { cacheKey, getCached, putCached } from '../lib/cache';
import { sourcesEnabled } from '../lib/apikeys';
import type { EnrichmentResult, Item, SearchHit, Source } from '../types';
import { igdbEnrich, igdbSearch } from './igdb';
import { tmdbEnrich, tmdbSearch, tmdbGetById, tmdbTvEnrich, tmdbTvSearch, tmdbTvGetById, tmdbTvSeasonPoster } from './tmdb';
import { discogsEnrich, discogsSearch } from './discogs';
import { mbEnrich, mbGetById, mbSearch } from './musicbrainz';
import { cacheCover } from '../lib/covers';

// MusicBrainz needs no credentials, so it is always "on".
export function sourceEnabled(source: Source): boolean {
  if (source === 'musicbrainz') return true;
  return sourcesEnabled()[source];
}

// The source that will actually serve a media type right now. Music prefers
// Discogs (richer: notes, marketplace values) and falls back to MusicBrainz when
// no Discogs credentials are configured. null = no auto-enrichment (consoles).
export function sourceForType(type: MediaType): Source | null {
  const preferred = SOURCE_FOR_TYPE[type];
  if (preferred === 'discogs' && !sourceEnabled('discogs')) return 'musicbrainz';
  return preferred;
}

// The cache key groups CDs separately from vinyl (different Discogs format filter),
// and includes the platform for games (title alone is often ambiguous).
function keyForItem(item: Pick<Item, 'type' | 'title' | 'format'>): string {
  if (item.type === 'game') return cacheKey(item.title, item.format);
  if (item.type === 'cd') return cacheKey(item.title, 'cd');
  if (item.type === 'lp' || item.type === 'single') return cacheKey(item.title, 'vinyl');
  // Series share the TMDB source with movies but a different namespace — key them
  // apart so a film and a same-named series don't collide in the cache.
  if (item.type === 'series') return cacheKey(item.title, 'tv');
  return cacheKey(item.title);
}

async function fetchFromProvider(
  item: Pick<Item, 'type' | 'title' | 'format' | 'year'>
): Promise<EnrichmentResult | null> {
  switch (sourceForType(item.type)) {
    case 'igdb':
      return igdbEnrich(item.title, { platform: item.format });
    case 'tmdb':
      return item.type === 'series'
        ? tmdbTvEnrich(item.title, { year: item.year })
        : tmdbEnrich(item.title, { year: item.year });
    case 'discogs':
      return discogsEnrich(item.title, item.type);
    case 'musicbrainz':
      return mbEnrich(item.title, item.type);
    default:
      return null; // no auto-enrichment (e.g. consoles)
  }
}

// Exact fetch by a provider id already stored on the item (e.g. a tmdb_id
// supplied in an import, or a MusicBrainz group id from an earlier match). Only
// TMDB and MusicBrainz are wired; other sources return null so the caller falls
// back to the title-based path.
async function fetchByIdFromProvider(
  item: Pick<Item, 'type' | 'source' | 'source_id'>
): Promise<EnrichmentResult | null> {
  if (!item.source_id) return null;
  const active = sourceForType(item.type);
  if (item.source === 'tmdb' && active === 'tmdb') {
    // A series id is a TMDB *TV* id — resolve it via /tv, never /movie.
    return item.type === 'series' ? tmdbTvGetById(item.source_id) : tmdbGetById(item.source_id);
  }
  if (item.source === 'musicbrainz' && active === 'musicbrainz') {
    return mbGetById(item.source_id);
  }
  return null;
}

// Which fields a persist may overwrite. "Enrich collection" uses the default
// (cover + text, never the title); "Re-fetch all" lets the user pick — including
// the title, so a language switch can also pull the localized title.
export interface EnrichFields {
  title: boolean;
  cover: boolean;
  text: boolean; // rating + description
}
export const DEFAULT_FIELDS: EnrichFields = { title: false, cover: true, text: true };

// A series box tagged with a specific season: fetch the series' metadata (title,
// rating, description) but swap the cover for that season's own poster, so each
// season box set shows a distinct cover. Resolves the TMDB TV id from a stored
// tmdb_id, or by a title search when none is set. Returns null to fall back to
// the normal path.
async function fetchSeriesSeason(
  item: Pick<Item, 'type' | 'title' | 'year' | 'source' | 'source_id' | 'season_no'>
): Promise<EnrichmentResult | null> {
  if (item.type !== 'series' || !item.season_no) return null;

  let seriesRes: EnrichmentResult | null;
  let tvId: string | null;
  if (item.source === 'tmdb' && item.source_id) {
    tvId = item.source_id;
    seriesRes = await tmdbTvGetById(tvId);
  } else {
    seriesRes = await tmdbTvEnrich(item.title, { year: item.year });
    tvId = seriesRes?.sourceId ?? null;
  }
  if (!seriesRes) return null;

  if (tvId) {
    const poster = await tmdbTvSeasonPoster(tvId, item.season_no);
    if (poster) seriesRes = { ...seriesRes, coverUrl: poster };
  }
  return seriesRes;
}

// Cache the cover locally, then write the selected fields of the enrichment
// result onto the item. Unselected fields keep their existing values; source,
// source_id and enriched_at are always recorded so the link/timestamp is fresh.
async function persistResult(
  item: Pick<Item, 'id'>,
  result: EnrichmentResult,
  source: Source,
  fields: EnrichFields = DEFAULT_FIELDS
): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [item.id];
  const add = (frag: string, val: unknown) => {
    vals.push(val);
    sets.push(frag.replace('?', `$${vals.length}`));
  };

  if (fields.cover) {
    const remoteCover = result.coverUrl;
    let localCover: string | null = null;
    if (remoteCover) localCover = await cacheCover(remoteCover);
    const coverToStore = localCover ?? remoteCover;
    add('cover_url = COALESCE(?, cover_url)', coverToStore);
    add('cover_source_url = COALESCE(?, cover_source_url)', remoteCover);
  }
  if (fields.text) {
    add('rating = ?', result.rating);
    add('description = COALESCE(?, description)', result.description);
  }
  // Only overwrite the title when asked AND the provider actually returned one,
  // so an empty result never wipes a user's title.
  if (fields.title && result.title) {
    add('title = ?', result.title);
  }

  add('source = ?', source);
  add('source_id = ?', result.sourceId);
  sets.push('enriched_at = now()');

  await query(`UPDATE items SET ${sets.join(', ')} WHERE id = $1`, vals);
}

export interface EnrichOutcome {
  status: 'enriched' | 'cached' | 'no-match' | 'source-disabled' | 'error';
  message?: string;
}

// Enrich a single item: cache-first, then provider, then persist onto the item.
// With { force: true } the shared cache is bypassed (fetched fresh and the cache
// overwritten) — used by "Re-fetch all" so switching the TMDB language actually
// re-pulls metadata in the new language instead of re-serving the cached copy.
export async function enrichItem(
  item: Item,
  opts: { force?: boolean; fields?: EnrichFields } = {}
): Promise<EnrichOutcome> {
  const source = sourceForType(item.type);
  if (!source || !sourceEnabled(source)) return { status: 'source-disabled' };
  const fields = opts.fields ?? DEFAULT_FIELDS;

  try {
    // Series box with a specific season: series metadata + that season's poster.
    const seasonRes = await fetchSeriesSeason(item);
    if (seasonRes) {
      await persistResult(item, seasonRes, source, fields);
      return { status: 'enriched' };
    }

    // Exact match first: if the item already carries a provider id (e.g. a
    // tmdb_id from an import), fetch that record directly — no title-guessing.
    // This path is always live, so it already honours the current language.
    const byId = await fetchByIdFromProvider(item);
    if (byId) {
      await persistResult(item, byId, source, fields);
      return { status: 'enriched' };
    }

    const key = keyForItem(item);
    let result: EnrichmentResult | null = null;
    let fromCache = false;

    const cached = opts.force ? null : await getCached(source, key);
    if (cached) {
      fromCache = true;
      result = {
        source: source,
        sourceId: cached.source_id,
        title: null, // the cache doesn't store titles; force mode (which bypasses
                     // the cache) is what the "Title" re-fetch relies on
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

    await persistResult(item, result, source, fields);
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
  opts: { force?: boolean; fields?: EnrichFields } = {}
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
    const outcome = await enrichItem(item, { force: opts.force, fields: opts.fields });
    switch (outcome.status) {
      case 'enriched':
        summary.enriched++;
        // Gentle pacing on live network fetches to respect provider rate limits
        // (MusicBrainz additionally serializes its own calls at 1 req/s).
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
  const source = sourceForType(type);
  if (!source || !sourceEnabled(source)) return [];
  switch (source) {
    case 'igdb':
      return igdbSearch(q);
    case 'tmdb':
      return type === 'series' ? tmdbTvSearch(q) : tmdbSearch(q);
    case 'discogs':
      return discogsSearch(q, type);
    case 'musicbrainz':
      return mbSearch(q, type);
    default:
      return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
