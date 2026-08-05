import type { MediaType } from './config';

export interface Item {
  id: string;
  user_id: string;
  type: MediaType;
  title: string;
  format: string | null;
  year: number | null;
  catalog_no: string | null;
  location: string | null;
  condition: string | null;
  notes: string | null;
  cover_url: string | null;
  rating: number | null;
  description: string | null;
  source: string | null;
  source_id: string | null;
  enriched_at: string | null;
  created_at: string;
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
