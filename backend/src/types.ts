import type { MediaType } from './config';

export interface Item {
  id: string;
  user_id: string;
  type: MediaType;
  title: string;
  format: string | null;
  year: number | null;
  catalog_no: string | null;
  barcode: string | null;
  location: string | null;
  condition: string | null;
  notes: string | null;
  cover_url: string | null;
  cover_source_url: string | null;
  rating: number | null;
  description: string | null;
  source: string | null;
  source_id: string | null;
  enriched_at: string | null;
  created_at: string;
  // physical-collector fields
  disc_count: number | null;
  is_series: boolean;
  season_count: number | null;
  episode_count: number | null;
  lent_to: string | null;
  lent_since: string | null;
  viewed_at: string | null;
  cabinet_id: string | null;
  cabinet_name?: string | null; // joined from cabinets for convenience
  // valuation
  value: number | null;
  value_currency: string | null;
  value_source: string | null;
  value_manual: boolean;
  valued_at: string | null;
}

export interface ValueResult {
  source: 'pricecharting' | 'discogs';
  value: number;
  currency: string;
  note?: string; // e.g. which condition price was used
}

export interface Cabinet {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  item_count?: number;
}

// What an enrichment provider returns for one item.
export interface EnrichmentResult {
  source: 'igdb' | 'tmdb' | 'discogs';
  sourceId: string | null;
  coverUrl: string | null;
  rating: number | null; // normalized 0..100
  description: string | null;
  payload?: unknown;
}

// A hit from an external title search (add-flow autofill).
export interface SearchHit {
  source: 'igdb' | 'tmdb' | 'discogs';
  sourceId: string;
  title: string;
  year: number | null;
  format: string | null;
  coverUrl: string | null;
  rating: number | null;
  description: string | null;
}
