// Central configuration, read once from the environment.
// No secrets are hardcoded — everything comes from .env / the container env.

function env(name: string, fallback = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const config = {
  nodeEnv: env('NODE_ENV', 'development'),
  isProd: env('NODE_ENV', 'development') === 'production',

  port: parseInt(env('BACKEND_PORT', '4000'), 10),
  appOrigin: env('APP_ORIGIN', 'http://localhost:8080'),
  sessionSecret: env('SESSION_SECRET', 'dev-insecure-secret-change-me'),

  // Open registration is OFF by default — a seed/admin user always exists, so a
  // network-exposed instance shouldn't let strangers create accounts.
  allowRegistration: env('ALLOW_REGISTRATION', 'false').toLowerCase() === 'true',

  // Where downloaded cover images are cached (persisted via a mounted volume).
  coversDir: env('COVERS_DIR', ''), // falls back to <cwd>/data/covers when blank

  // When set, the backend also serves the built SPA from this dir (single-image
  // deploy). Left blank in dev, where Vite serves the frontend on its own port.
  frontendDir: env('FRONTEND_DIR', ''),

  db: {
    host: env('POSTGRES_HOST', 'localhost'),
    port: parseInt(env('POSTGRES_PORT', '5432'), 10),
    user: env('POSTGRES_USER', 'mediavault'),
    password: env('POSTGRES_PASSWORD', 'mediavault'),
    database: env('POSTGRES_DB', 'mediavault'),
  },

  seedCsv: env('SEED_CSV', ''), // absolute path to master_game_list.csv when seeding
  seedUser: {
    // Default household user created on first boot so the seeded collection has an owner.
    email: env('SEED_USER_EMAIL', 'admin@media-vault.local'),
    password: env('SEED_USER_PASSWORD', 'changeme'),
    displayName: env('SEED_USER_NAME', 'Collector'),
  },

  igdb: {
    clientId: env('IGDB_CLIENT_ID'),
    clientSecret: env('IGDB_CLIENT_SECRET'),
    get enabled() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },
  tmdb: {
    accessToken: env('TMDB_ACCESS_TOKEN'),
    // Language for movie metadata (titles/overviews), e.g. en-US, de-DE.
    language: env('TMDB_LANGUAGE', 'en-US'),
    get enabled() {
      return Boolean(this.accessToken);
    },
  },
  discogs: {
    // Two supported auth modes: a personal access token, OR consumer key+secret.
    token: env('DISCOGS_TOKEN'),
    key: env('DISCOGS_KEY'),
    secret: env('DISCOGS_SECRET'),
    userAgent: env('DISCOGS_USER_AGENT', 'media-vault/0.1'),
    get enabled() {
      return Boolean(this.token || (this.key && this.secret));
    },
  },
  // Game valuation via PriceCharting. NOTE: their API requires a PAID subscription
  // token — there is no free game-price API. Leave blank to disable game valuation.
  pricecharting: {
    token: env('PRICECHARTING_TOKEN'),
    get enabled() {
      return Boolean(this.token);
    },
  },
  // Currency for Discogs marketplace prices (music valuation).
  valuationCurrency: env('VALUATION_CURRENCY', 'EUR'),

  // Which second-hand marketplace(s) the "find deals / bundles" links point at.
  // Comma-separated list — each becomes its own search button. Presets (see
  // frontend/src/marketplace.ts): leboncoin, kleinanzeigen, ebay-de, ebay-com,
  // ebay-uk, ebay-fr, marktplaats, wallapop, medimops, or "none" to hide the
  // feature. Defaults to leboncoin (France).
  marketplaces: env('MARKETPLACE', 'leboncoin')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};

export type MediaType = 'game' | 'movie' | 'lp' | 'single' | 'cd';
export const MEDIA_TYPES: MediaType[] = ['game', 'movie', 'lp', 'single', 'cd'];

// Which metadata source powers each media type.
export const SOURCE_FOR_TYPE: Record<MediaType, 'igdb' | 'tmdb' | 'discogs'> = {
  game: 'igdb',
  movie: 'tmdb',
  lp: 'discogs',
  single: 'discogs',
  cd: 'discogs',
};
