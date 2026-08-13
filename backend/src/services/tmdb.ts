// TMDB (movies) provider. Auth is a v4 bearer "Read Access Token".
// Docs: https://developer.themoviedb.org/
import { getApiKeys } from '../lib/apikeys';
import type { EnrichmentResult, SearchHit } from '../types';

const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

interface TmdbMovie {
  id: number;
  title: string;
  overview?: string;
  release_date?: string; // YYYY-MM-DD
  vote_average?: number; // 0..10
  poster_path?: string | null;
}

async function apiSearch(title: string): Promise<TmdbMovie[]> {
  const url = new URL('https://api.themoviedb.org/3/search/movie');
  url.searchParams.set('query', title);
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('language', getApiKeys().tmdbLanguage);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getApiKeys().tmdbAccessToken}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { results?: TmdbMovie[] };
  return json.results ?? [];
}

function toHit(m: TmdbMovie): SearchHit {
  const year = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) || null : null;
  // TMDB votes are 0..10 → normalize to 0..100.
  const rating = typeof m.vote_average === 'number' ? Math.round(m.vote_average * 100) / 10 : null;
  return {
    source: 'tmdb',
    sourceId: String(m.id),
    title: m.title,
    year,
    format: null,
    coverUrl: m.poster_path ? `${IMG_BASE}${m.poster_path}` : null,
    rating,
    description: m.overview ?? null,
  };
}

export async function tmdbSearch(title: string, limit = 8): Promise<SearchHit[]> {
  const results = await apiSearch(title);
  return results.slice(0, limit).map(toHit);
}

export interface TmdbHint {
  year?: number | null;
}

export async function tmdbEnrich(title: string, hint?: TmdbHint): Promise<EnrichmentResult | null> {
  // Strip a trailing short "(…)" disambiguator ("Taken 3 (2)" → "Taken 3").
  const q = title.replace(/\s*\((?:[a-z0-9][a-z0-9 \-]{0,6})\)\s*$/i, '').trim() || title;
  const results = await apiSearch(q);
  if (!results.length) return null;

  const nt = q.toLowerCase().trim();
  let best = results[0];
  let bestScore = -Infinity;
  results.slice(0, 10).forEach((m, i) => {
    let score = (10 - i) * 0.5; // TMDB relevance order as tiebreaker
    if (m.title?.toLowerCase().trim() === nt) score += 40;
    const y = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : null;
    if (hint?.year && y && Math.abs(y - hint.year) <= 1) score += 30;
    if (m.poster_path) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  });

  const hit = toHit(best);
  return {
    source: 'tmdb',
    sourceId: hit.sourceId,
    coverUrl: hit.coverUrl,
    rating: hit.rating,
    description: hit.description,
    payload: hit,
  };
}
