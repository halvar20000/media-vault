// IGDB (games) provider. Auth is a Twitch client-credentials token.
// Docs: https://api-docs.igdb.com/
import { getApiKeys } from '../lib/apikeys';
import type { EnrichmentResult, SearchHit } from '../types';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.value;
  }
  const url = new URL('https://id.twitch.tv/oauth2/token');
  url.searchParams.set('client_id', getApiKeys().igdbClientId);
  url.searchParams.set('client_secret', getApiKeys().igdbClientSecret);
  url.searchParams.set('grant_type', 'client_credentials');

  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`IGDB token request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

interface IgdbGame {
  id: number;
  name: string;
  summary?: string;
  first_release_date?: number; // unix seconds
  aggregated_rating?: number; // critic 0..100
  rating?: number; // user 0..100
  cover?: { image_id?: string };
  platforms?: { abbreviation?: string; name?: string }[];
}

function coverUrl(imageId?: string): string | null {
  if (!imageId) return null;
  return `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`;
}

async function apiGames(where: string): Promise<IgdbGame[]> {
  const token = await getToken();
  const body =
    `fields name, summary, first_release_date, aggregated_rating, rating, ` +
    `cover.image_id, platforms.abbreviation, platforms.name; ${where}`;
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': getApiKeys().igdbClientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB games query failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as IgdbGame[];
}

function toHit(g: IgdbGame): SearchHit {
  const year = g.first_release_date
    ? new Date(g.first_release_date * 1000).getUTCFullYear()
    : null;
  const rating = g.aggregated_rating ?? g.rating ?? null;
  const format = g.platforms?.[0]?.abbreviation || g.platforms?.[0]?.name || null;
  return {
    source: 'igdb',
    sourceId: String(g.id),
    title: g.name,
    year,
    format,
    coverUrl: coverUrl(g.cover?.image_id),
    rating: rating !== null ? Math.round(rating * 10) / 10 : null,
    description: g.summary ?? null,
  };
}

// Escape a value for IGDB's apicalypse string literals.
function esc(s: string): string {
  return s.replace(/["\\]/g, ' ').trim();
}

// Seed titles are disambiguated with short platform/number suffixes like
// "FIFA 06 (360)", "Assassin's Creed (PS3-2)", "Army of Two (2)". Strip a
// trailing short "(…)" group for the search query (keeps the display title).
function stripDisambiguator(title: string): string {
  const s = title.replace(/\s*\((?:[a-z0-9][a-z0-9 \-]{0,6})\)\s*$/i, '').trim();
  return s || title;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

// Loose platform-abbreviation synonyms so CSV platforms match IGDB ones.
const PLATFORM_SYNONYMS: Record<string, string[]> = {
  ps2: ['ps2', 'playstation2'],
  ps3: ['ps3', 'playstation3'],
  ps4: ['ps4', 'playstation4'],
  ps5: ['ps5', 'playstation5'],
  psp: ['psp'],
  psvita: ['psvita', 'vita'],
  xbox: ['xbox'],
  xbox360: ['xbox360', 'x360'],
  xboxone: ['xboxone', 'xone'],
  switch: ['switch', 'nintendoswitch'],
  wii: ['wii'],
  wiiu: ['wiiu'],
  nes: ['nes', 'famicom'],
  snes: ['snes', 'superfamicom'],
  n64: ['n64', 'nintendo64'],
  gamecube: ['gamecube', 'ngc', 'gc'],
  gba: ['gba', 'gameboyadvance'],
  ds: ['nintendods', 'nds', 'ds'],
  '3ds': ['3ds', 'nintendo3ds'],
  pc: ['pc', 'windows', 'win'],
};

function platformMatches(hintPlatform: string, gamePlatforms: string[]): boolean {
  const h = norm(hintPlatform);
  const syns = PLATFORM_SYNONYMS[h] ?? [h];
  return gamePlatforms.some((gp) => {
    const g = norm(gp);
    return syns.includes(g) || g === h;
  });
}

// Score a candidate against the title (+ optional platform) to pick the best match.
function scoreGame(g: IgdbGame, title: string, platform: string | null | undefined, idx: number): number {
  let score = (12 - idx) * 0.5; // preserve IGDB relevance order as a tiebreaker
  const nt = norm(title);
  const ng = norm(g.name);
  if (ng === nt) score += 100;
  else if (ng.startsWith(nt) || ng.includes(nt)) score += 25;

  if (platform) {
    const plats = (g.platforms ?? [])
      .flatMap((p) => [p.abbreviation, p.name].filter(Boolean) as string[]);
    if (platformMatches(platform, plats)) score += 45;
  }
  if (g.cover?.image_id) score += 5;
  if (g.aggregated_rating ?? g.rating) score += 3;
  return score;
}

export async function igdbSearch(title: string, limit = 8): Promise<SearchHit[]> {
  const games = await apiGames(`search "${esc(title)}"; limit ${limit};`);
  return games.map(toHit);
}

export interface IgdbHint {
  platform?: string | null;
}

export interface BrowseOpts {
  platformId: number;
  region?: number; // IGDB release_dates.region (1 = Europe)
  q?: string;
  sort?: string; // popular | rating | name | year
  limit?: number;
  offset?: number;
}

// Browse a platform's game library (optionally region-filtered) for the catalogue.
export async function igdbBrowse(o: BrowseOpts): Promise<SearchHit[]> {
  const conds = [`platforms = (${o.platformId})`];
  if (o.region) conds.push(`release_dates.region = ${o.region}`);
  if (o.q && o.q.trim()) conds.push(`name ~ *"${esc(o.q)}"*`);
  const sortMap: Record<string, string> = {
    popular: 'total_rating_count desc',
    rating: 'total_rating desc',
    name: 'name asc',
    year: 'first_release_date desc',
  };
  const sort = sortMap[o.sort ?? 'popular'] ?? sortMap.popular;
  if (o.sort === 'rating') conds.push('total_rating != null');
  else if (!o.sort || o.sort === 'popular') conds.push('total_rating_count != null');

  const where = `where ${conds.join(' & ')}; sort ${sort}; limit ${o.limit ?? 40}; offset ${o.offset ?? 0};`;
  const games = await apiGames(where);
  return games.map(toHit);
}

export async function igdbEnrich(title: string, hint?: IgdbHint): Promise<EnrichmentResult | null> {
  // Search with the disambiguator stripped ("FIFA 06 (360)" → "FIFA 06").
  const q = stripDisambiguator(title);
  const games = await apiGames(`search "${esc(q)}"; limit 12;`);
  if (!games.length) return null;

  let best = games[0];
  let bestScore = -Infinity;
  games.forEach((g, i) => {
    const s = scoreGame(g, q, hint?.platform, i);
    if (s > bestScore) {
      bestScore = s;
      best = g;
    }
  });

  const hit = toHit(best);
  return {
    source: 'igdb',
    sourceId: hit.sourceId,
    coverUrl: hit.coverUrl,
    rating: hit.rating,
    description: hit.description,
    payload: { ...hit, matchScore: bestScore },
  };
}
