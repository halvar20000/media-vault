export type MediaType = 'game' | 'movie' | 'lp' | 'single' | 'cd';

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

export interface User {
  id: string;
  email: string;
  displayName: string | null;
}

export interface Stats {
  total: number;
  enriched: number;
  byType: Partial<Record<MediaType, number>>;
}

export interface EnrichJob {
  running: boolean;
  startedAt: number;
  finishedAt: number | null;
  summary: {
    total: number;
    enriched: number;
    cached: number;
    noMatch: number;
    disabled: number;
    errors: number;
  } | null;
  error: string | null;
}

export interface EnrichStatus {
  job: EnrichJob | null;
  sources: { igdb: boolean; tmdb: boolean; discogs: boolean };
}

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

export interface TypeMeta {
  label: string;
  color: string;
}

export const TYPE_META: Record<MediaType, TypeMeta> = {
  game: { label: 'Game', color: '#4C9A5A' },
  movie: { label: 'Film', color: '#3E7CB1' },
  lp: { label: 'Vinyl LP', color: '#C8681E' },
  single: { label: 'Single', color: '#A24E8F' },
  cd: { label: 'CD', color: '#3FA9A0' },
};

export const TYPE_ORDER: MediaType[] = ['game', 'movie', 'lp', 'single', 'cd'];
