// TMDB (movies) provider. Auth is a v4 bearer "Read Access Token".
// Docs: https://developer.themoviedb.org/
import { getApiKeys } from '../lib/apikeys';
import type { ArtworkOption, EnrichmentResult, SearchHit } from '../types';

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

// Fetch a movie by its exact TMDB id — used when an import row carries a
// tmdb_id (e.g. an AI matched the disc), so we skip title-guessing entirely.
export async function tmdbGetById(id: string): Promise<EnrichmentResult | null> {
  const url = new URL(`https://api.themoviedb.org/3/movie/${encodeURIComponent(id)}`);
  url.searchParams.set('language', getApiKeys().tmdbLanguage);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getApiKeys().tmdbAccessToken}`,
      Accept: 'application/json',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TMDB get ${id} failed: ${res.status} ${await res.text()}`);
  const m = (await res.json()) as TmdbMovie;
  const hit = toHit(m);
  return {
    source: 'tmdb',
    sourceId: hit.sourceId,
    title: hit.title,
    coverUrl: hit.coverUrl,
    rating: hit.rating,
    description: hit.description,
    payload: hit,
  };
}

// ---- TV series ---------------------------------------------------------------
// TMDB keeps series in a separate namespace (/tv, /search/tv) with their own id
// space and differently-named fields (name / first_air_date instead of
// title / release_date). A movie id and a TV id are unrelated numbers, so a TV
// id must never be looked up via /movie — hence these dedicated functions.

interface TmdbTv {
  id: number;
  name: string;
  overview?: string;
  first_air_date?: string; // YYYY-MM-DD
  vote_average?: number;
  poster_path?: string | null;
}

function tvToHit(s: TmdbTv): SearchHit {
  const year = s.first_air_date ? parseInt(s.first_air_date.slice(0, 4), 10) || null : null;
  const rating = typeof s.vote_average === 'number' ? Math.round(s.vote_average * 100) / 10 : null;
  return {
    source: 'tmdb',
    sourceId: String(s.id),
    title: s.name,
    year,
    format: null,
    coverUrl: s.poster_path ? `${IMG_BASE}${s.poster_path}` : null,
    rating,
    description: s.overview ?? null,
  };
}

async function apiSearchTv(title: string): Promise<TmdbTv[]> {
  const url = new URL('https://api.themoviedb.org/3/search/tv');
  url.searchParams.set('query', title);
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('language', getApiKeys().tmdbLanguage);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getApiKeys().tmdbAccessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`TMDB tv search failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { results?: TmdbTv[] };
  return json.results ?? [];
}

export async function tmdbTvSearch(title: string, limit = 8): Promise<SearchHit[]> {
  const results = await apiSearchTv(title);
  return results.slice(0, limit).map(tvToHit);
}

export async function tmdbTvEnrich(title: string, hint?: TmdbHint): Promise<EnrichmentResult | null> {
  const q = title.replace(/\s*\((?:[a-z0-9][a-z0-9 \-]{0,6})\)\s*$/i, '').trim() || title;
  const results = await apiSearchTv(q);
  if (!results.length) return null;

  const nt = q.toLowerCase().trim();
  let best = results[0];
  let bestScore = -Infinity;
  results.slice(0, 10).forEach((s, i) => {
    let score = (10 - i) * 0.5;
    if (s.name?.toLowerCase().trim() === nt) score += 40;
    const y = s.first_air_date ? parseInt(s.first_air_date.slice(0, 4), 10) : null;
    if (hint?.year && y && Math.abs(y - hint.year) <= 1) score += 30;
    if (s.poster_path) score += 5;
    if (score > bestScore) { bestScore = score; best = s; }
  });

  const hit = tvToHit(best);
  return { source: 'tmdb', sourceId: hit.sourceId, title: hit.title, coverUrl: hit.coverUrl, rating: hit.rating, description: hit.description, payload: hit };
}

// Fetch a series by its exact TMDB TV id — the /tv counterpart of tmdbGetById.
export async function tmdbTvGetById(id: string): Promise<EnrichmentResult | null> {
  const url = new URL(`https://api.themoviedb.org/3/tv/${encodeURIComponent(id)}`);
  url.searchParams.set('language', getApiKeys().tmdbLanguage);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getApiKeys().tmdbAccessToken}`, Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TMDB tv get ${id} failed: ${res.status} ${await res.text()}`);
  const s = (await res.json()) as TmdbTv;
  const hit = tvToHit(s);
  return { source: 'tmdb', sourceId: hit.sourceId, title: hit.title, coverUrl: hit.coverUrl, rating: hit.rating, description: hit.description, payload: hit };
}

// The poster for a single season of a series, via /tv/{id}/season/{n}. Lets each
// physical season box show its own cover instead of the shared series poster.
// Returns null (not an error) when the season or its poster doesn't exist.
export async function tmdbTvSeasonPoster(tvId: string, season: number): Promise<string | null> {
  const url = new URL(`https://api.themoviedb.org/3/tv/${encodeURIComponent(tvId)}/season/${season}`);
  url.searchParams.set('language', getApiKeys().tmdbLanguage);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getApiKeys().tmdbAccessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const s = (await res.json()) as { poster_path?: string | null };
  return s.poster_path ? `${IMG_BASE}${s.poster_path}` : null;
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
    title: hit.title,
    coverUrl: hit.coverUrl,
    rating: hit.rating,
    description: hit.description,
    payload: hit,
  };
}

// ---- artwork picker -----------------------------------------------------------
// Every poster TMDB has for a movie / series, in the configured language first,
// then English, then language-less (textless) art. For a series box tagged with a
// season, that season's own posters come first — that's usually the one wanted.
interface TmdbImage {
  file_path: string;
  iso_639_1?: string | null;
  width?: number;
  height?: number;
  vote_average?: number;
}

async function apiImages(path: string): Promise<TmdbImage[]> {
  const lang = getApiKeys().tmdbLanguage.split('-')[0].toLowerCase();
  const url = new URL(`https://api.themoviedb.org/3/${path}/images`);
  // Without this filter TMDB returns only the configured language's posters.
  url.searchParams.set('include_image_language', [lang, 'en', 'null'].filter((v, i, a) => a.indexOf(v) === i).join(','));
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getApiKeys().tmdbAccessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { posters?: TmdbImage[] };
  // TMDB orders by votes, which puts English first for everyone; the collector
  // most likely wants the poster matching their configured language on top.
  const rank = (img: TmdbImage) => (img.iso_639_1 === lang ? 0 : img.iso_639_1 === 'en' ? 1 : 2);
  return (json.posters ?? []).slice().sort((a, b) => rank(a) - rank(b));
}

function imageOption(img: TmdbImage, prefix: string): ArtworkOption {
  const lang = img.iso_639_1 ? img.iso_639_1.toUpperCase() : '—';
  const size = img.width && img.height ? `${img.width}×${img.height}` : null;
  return {
    url: `${IMG_BASE}${img.file_path}`,
    thumb: `https://image.tmdb.org/t/p/w185${img.file_path}`,
    label: [prefix, lang, size].filter(Boolean).join(' · '),
    source: 'tmdb',
  };
}

export async function tmdbArtwork(
  kind: 'movie' | 'tv',
  id: string,
  seasonNo?: number | null
): Promise<ArtworkOption[]> {
  const out: ArtworkOption[] = [];
  if (kind === 'tv' && seasonNo) {
    const season = await apiImages(`tv/${encodeURIComponent(id)}/season/${seasonNo}`);
    out.push(...season.map((img) => imageOption(img, `TMDB S${seasonNo}`)));
  }
  const main = await apiImages(`${kind}/${encodeURIComponent(id)}`);
  out.push(...main.map((img) => imageOption(img, 'TMDB')));
  return out.slice(0, 60);
}
