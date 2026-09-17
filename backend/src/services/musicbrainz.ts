// MusicBrainz (vinyl LP / single / CD) provider — the keyless fallback used when
// no Discogs credentials are configured. Identity is the *release group* (the
// album as a work), covers come from the Cover Art Archive (CAA).
// Docs: https://musicbrainz.org/doc/MusicBrainz_API · https://musicbrainz.org/doc/Cover_Art_Archive/API
//
// Etiquette MusicBrainz enforces: at most one request per second, and a
// descriptive User-Agent with a contact URL — anonymous / bursty clients get 503s.
import { type MediaType } from '../config';
import type { ArtworkOption, EnrichmentResult, SearchHit } from '../types';

const MB = 'https://musicbrainz.org/ws/2';
const CAA = 'https://coverartarchive.org';
const USER_AGENT = 'media-vault/1.14 ( https://github.com/halvar20000/media-vault )';

// ---- rate limiting -------------------------------------------------------------
// Serialize calls to musicbrainz.org and space them ≥1.1 s apart. CAA lives on
// archive.org and isn't rate-limited the same way, so it bypasses the queue.
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = lastAt + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  };
  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p;
}

// MusicBrainz answers 503 "server busy" when it sheds load, even to polite
// clients — that's a "try again in a moment", so back off and retry a few times.
async function mbJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${MB}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('fmt', 'json');
  for (let attempt = 0; ; attempt++) {
    const res = await throttled(() =>
      fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      })
    );
    if (res.ok) return (await res.json()) as T;
    const body = await res.text();
    if (res.status === 503 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt)); // 2 s, 4 s, 8 s
      continue;
    }
    throw new Error(`MusicBrainz ${path} failed: ${res.status} ${body}`);
  }
}

// ---- response shapes (only the fields we read) ---------------------------------
interface ArtistCredit {
  name: string;
  joinphrase?: string;
}
interface ReleaseGroup {
  id: string;
  title: string;
  'primary-type'?: string | null;
  'first-release-date'?: string;
  'artist-credit'?: ArtistCredit[];
  rating?: { value?: number | null; 'votes-count'?: number };
  releases?: Release[];
  score?: number;
}
interface Release {
  id: string;
  title: string;
  date?: string;
  country?: string;
  status?: string;
  barcode?: string;
  'artist-credit'?: ArtistCredit[];
  'release-group'?: { id: string; 'primary-type'?: string | null };
  media?: { format?: string }[];
}

// "Artist - Title", matching the shape Discogs hits use so the UI is consistent.
function creditedTitle(credit: ArtistCredit[] | undefined, title: string): string {
  const artist = (credit ?? []).map((c) => c.name + (c.joinphrase ?? '')).join('').trim();
  return artist ? `${artist} - ${title}` : title;
}

function yearOf(date?: string): number | null {
  const y = date ? parseInt(date.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? y : null;
}

// Escape Lucene specials so a title like "AC/DC: Back in Black (Remaster)" is a
// plain phrase, not a syntax error.
function lucene(s: string): string {
  return s.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim();
}

// LP / CD → albums (and EPs); single → singles. MusicBrainz's format (vinyl vs
// CD) lives on the release, not the group, so it's not filtered here.
function typeClause(type?: MediaType): string {
  if (type === 'single') return ' AND primarytype:single';
  if (type === 'lp' || type === 'cd') return ' AND (primarytype:album OR primarytype:ep)';
  return '';
}

export const caaGroupFront = (rgId: string, size: 250 | 500 | 1200 = 500) =>
  `${CAA}/release-group/${rgId}/front-${size}`;
export const caaReleaseFront = (relId: string, size: 250 | 500 | 1200 = 500) =>
  `${CAA}/release/${relId}/front-${size}`;

// CAA answers 404 for anything without art; a HEAD (following the redirect to
// archive.org) tells us whether the URL is worth storing. Never throws.
async function caaExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(6_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function withVerifiedCovers(hits: SearchHit[]): Promise<SearchHit[]> {
  return Promise.all(
    hits.map(async (h) =>
      h.coverUrl && !(await caaExists(h.coverUrl)) ? { ...h, coverUrl: null } : h
    )
  );
}

function groupToHit(rg: ReleaseGroup): SearchHit {
  return {
    source: 'musicbrainz',
    sourceId: rg.id,
    title: creditedTitle(rg['artist-credit'], rg.title),
    year: yearOf(rg['first-release-date']),
    format: rg['primary-type'] ?? null,
    coverUrl: caaGroupFront(rg.id),
    rating: null, // needs a per-group lookup (done during enrich)
    description: null,
  };
}

export async function mbSearch(title: string, type?: MediaType, limit = 8): Promise<SearchHit[]> {
  const q = lucene(title);
  if (!q) return [];
  const json = await mbJson<{ 'release-groups'?: ReleaseGroup[] }>('release-group', {
    query: `(${q})${typeClause(type)}`,
    limit: String(limit),
  });
  return withVerifiedCovers((json['release-groups'] ?? []).slice(0, limit).map(groupToHit));
}

// Barcode (EAN/UPC) → releases. Identity stays the release group (so re-fetch
// and the artwork picker work the same as a title match), but the cover comes
// from the exact release that carries this barcode when CAA has it.
export async function mbBarcodeSearch(code: string, limit = 8): Promise<SearchHit[]> {
  const json = await mbJson<{ releases?: Release[] }>('release', {
    query: `barcode:${code.replace(/\D/g, '')}`,
    limit: String(limit),
  });
  const hits: SearchHit[] = [];
  for (const r of (json.releases ?? []).slice(0, limit)) {
    const rgId = r['release-group']?.id;
    if (!rgId) continue;
    const format = [r.media?.[0]?.format, r.country].filter(Boolean).join(' · ') || null;
    hits.push({
      source: 'musicbrainz',
      sourceId: rgId,
      title: creditedTitle(r['artist-credit'], r.title),
      year: yearOf(r.date),
      format,
      coverUrl: caaReleaseFront(r.id),
      rating: null,
      description: null,
    });
  }
  // A release without its own art still usually has group art — try that next.
  return Promise.all(
    hits.map(async (h) => {
      if (h.coverUrl && (await caaExists(h.coverUrl))) return h;
      const group = caaGroupFront(h.sourceId);
      return { ...h, coverUrl: (await caaExists(group)) ? group : null };
    })
  );
}

async function groupLookup(rgId: string, inc: string): Promise<ReleaseGroup | null> {
  try {
    return await mbJson<ReleaseGroup>(`release-group/${encodeURIComponent(rgId)}`, { inc });
  } catch (err: any) {
    if (/ 404 /.test(String(err?.message))) return null;
    throw err;
  }
}

function ratingOf(rg: ReleaseGroup): number | null {
  const v = rg.rating?.value;
  return typeof v === 'number' && v > 0 ? Math.round(v * 20 * 10) / 10 : null; // 0..5 → 0..100
}

// Exact fetch by a stored release-group MBID (re-fetch of an already matched item).
export async function mbGetById(rgId: string): Promise<EnrichmentResult | null> {
  const rg = await groupLookup(rgId, 'artist-credits+ratings');
  if (!rg) return null;
  const hit = groupToHit(rg);
  const [verified] = await withVerifiedCovers([hit]);
  return {
    source: 'musicbrainz',
    sourceId: rg.id,
    title: verified.title,
    coverUrl: verified.coverUrl,
    rating: ratingOf(rg),
    description: null, // MusicBrainz carries no liner notes / blurb
    payload: verified,
  };
}

// Compare titles by their letters/digits only: "Pink Floyd - The Dark Side of
// the Moon" and a query of "pink floyd the dark side of the moon" are the same.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export async function mbEnrich(title: string, type?: MediaType): Promise<EnrichmentResult | null> {
  const hits = await mbSearch(title, type, 6);
  if (!hits.length) return null;

  // MusicBrainz's own order is by text relevance, which happily ranks a tribute
  // or karaoke album above the real one because its title repeats the query
  // words. Prefer hits whose full "Artist - Title" (or just the title) equals the
  // query, then containment, and only then MusicBrainz's order.
  const nq = norm(title);
  let best = hits[0];
  let bestScore = -Infinity;
  hits.forEach((h, i) => {
    const full = norm(h.title);
    const bare = norm(h.title.replace(/^.*? - /, ''));
    let score = (hits.length - i) * 0.5;
    if (full === nq || bare === nq) score += 40;
    else if (full.includes(nq) || nq.includes(full)) score += 15;
    if (/tribute|karaoke|cover version|in the style of/i.test(h.title)) score -= 20;
    if (h.coverUrl) score += 2;
    if (score > bestScore) { bestScore = score; best = h; }
  });

  const rg = await groupLookup(best.sourceId, 'ratings');
  return {
    source: 'musicbrainz',
    sourceId: best.sourceId,
    title: best.title,
    coverUrl: best.coverUrl,
    rating: rg ? ratingOf(rg) : null,
    description: null,
    payload: best,
  };
}

// Artwork picker: the front cover of every release in the group that has one
// (different pressings / countries often have different sleeves).
export async function mbArtwork(rgId: string): Promise<ArtworkOption[]> {
  const rg = await groupLookup(rgId, 'releases');
  if (!rg) return [];
  const releases = (rg.releases ?? []).slice(0, 15);
  const found = await Promise.all(
    releases.map(async (r): Promise<ArtworkOption | null> => {
      const url = caaReleaseFront(r.id);
      if (!(await caaExists(url))) return null;
      const label = ['MusicBrainz', r.country, r.date ? r.date.slice(0, 4) : null, r.status]
        .filter(Boolean)
        .join(' · ');
      return { url, thumb: caaReleaseFront(r.id, 250), label, source: 'musicbrainz' };
    })
  );
  return found.filter((o): o is ArtworkOption => o !== null);
}
