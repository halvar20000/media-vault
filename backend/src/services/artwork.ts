// Artwork picker — gathers every alternate cover a provider knows for an
// already-matched item (posters in other languages, other pressings' sleeves,
// regional game boxes…) so the user can pick one instead of settling for the
// provider's default. The pick itself goes through the normal cover endpoint.
import type { ArtworkOption, Item, Source } from '../types';
import { sourceEnabled } from './enrich';
import { tmdbArtwork } from './tmdb';
import { igdbArtwork } from './igdb';
import { discogsArtwork } from './discogs';
import { mbArtwork } from './musicbrainz';

const SOURCES: Source[] = ['igdb', 'tmdb', 'discogs', 'musicbrainz'];

export interface ArtworkResult {
  options: ArtworkOption[];
  warnings: string[]; // i18n keys the UI resolves (artwork.*)
}

export async function artworkOptions(item: Item): Promise<ArtworkResult> {
  const options: ArtworkOption[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  const add = (o: ArtworkOption) => {
    if (!o.url || seen.has(o.url)) return;
    seen.add(o.url);
    options.push(o);
  };

  // What's on the item now, so the grid always has a "keep this" choice.
  if (item.cover_url) {
    add({ url: item.cover_url, thumb: item.cover_url, label: 'current', source: 'current' });
  }

  if (!item.source || !item.source_id) {
    warnings.push('artwork.noMatch');
    return { options, warnings };
  }
  const source = item.source as Source;
  if (!SOURCES.includes(source) || !sourceEnabled(source)) {
    warnings.push('artwork.sourceOff');
    return { options, warnings };
  }

  try {
    let fetched: ArtworkOption[] = [];
    switch (source) {
      case 'tmdb':
        fetched = await tmdbArtwork(item.type === 'series' ? 'tv' : 'movie', item.source_id, item.season_no);
        break;
      case 'igdb':
        fetched = await igdbArtwork(item.source_id);
        break;
      case 'discogs':
        fetched = await discogsArtwork(item.source_id);
        break;
      case 'musicbrainz':
        fetched = await mbArtwork(item.source_id);
        break;
    }
    fetched.forEach(add);
    if (!fetched.length) warnings.push('artwork.none');
  } catch (err: any) {
    console.error(`[artwork] item ${item.id} (${item.title}) failed:`, err?.message ?? err);
    warnings.push('artwork.failed');
  }

  return { options, warnings };
}
