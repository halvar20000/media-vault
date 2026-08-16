// Runtime API keys. Effective value = a DB override (set in the ⚙ Settings panel)
// layered over the environment default. Services read getApiKeys() so a key added
// in the UI applies immediately — no restart, no editing container env vars.
import { config } from '../config';
import { query } from '../db/pool';

export interface ApiKeys {
  igdbClientId: string;
  igdbClientSecret: string;
  tmdbAccessToken: string;
  tmdbLanguage: string;
  discogsToken: string;
  discogsKey: string;
  discogsSecret: string;
  discogsUserAgent: string;
  pricechartingToken: string;
  ebayClientId: string;
  ebayClientSecret: string;
  ebayMarketplaceId: string;
  steamApiKey: string;
  valuationCurrency: string;
}

// Fields that are secrets — the UI only ever sees whether they're set, never the value.
export const SECRET_FIELDS: (keyof ApiKeys)[] = [
  'igdbClientId', 'igdbClientSecret', 'tmdbAccessToken',
  'discogsToken', 'discogsKey', 'discogsSecret',
  'pricechartingToken', 'ebayClientId', 'ebayClientSecret', 'steamApiKey',
];
// Plain fields — safe to show and edit in the clear.
export const PLAIN_FIELDS: (keyof ApiKeys)[] = [
  'tmdbLanguage', 'discogsUserAgent', 'ebayMarketplaceId', 'valuationCurrency',
];

function fromEnv(): ApiKeys {
  return {
    igdbClientId: config.igdb.clientId,
    igdbClientSecret: config.igdb.clientSecret,
    tmdbAccessToken: config.tmdb.accessToken,
    tmdbLanguage: config.tmdb.language,
    discogsToken: config.discogs.token,
    discogsKey: config.discogs.key,
    discogsSecret: config.discogs.secret,
    discogsUserAgent: config.discogs.userAgent,
    pricechartingToken: config.pricecharting.token,
    ebayClientId: config.ebay.clientId,
    ebayClientSecret: config.ebay.clientSecret,
    ebayMarketplaceId: config.ebay.marketplaceId,
    steamApiKey: config.steam.apiKey,
    valuationCurrency: config.valuationCurrency,
  };
}

// Start from env so getApiKeys() is always usable, even before the DB load.
let cache: ApiKeys = fromEnv();

export function getApiKeys(): ApiKeys {
  return cache;
}

// Reload the effective keys from the DB overlay (call at boot and after a save).
export async function reloadApiKeys(): Promise<void> {
  try {
    const rows = await query<{ value: Partial<ApiKeys> }>(`SELECT value FROM settings WHERE key = 'apikeys'`);
    const db = rows.length ? rows[0].value : {};
    const merged = fromEnv();
    for (const k of Object.keys(merged) as (keyof ApiKeys)[]) {
      const v = db?.[k];
      if (typeof v === 'string' && v.trim() !== '') merged[k] = v.trim();
    }
    cache = merged;
  } catch {
    cache = fromEnv();
  }
}

// Which enrichment / valuation sources are live given the effective keys.
export function sourcesEnabled() {
  const k = cache;
  return {
    igdb: Boolean(k.igdbClientId && k.igdbClientSecret),
    tmdb: Boolean(k.tmdbAccessToken),
    discogs: Boolean(k.discogsToken || (k.discogsKey && k.discogsSecret)),
    pricecharting: Boolean(k.pricechartingToken),
    ebay: Boolean(k.ebayClientId && k.ebayClientSecret),
    steam: Boolean(k.steamApiKey),
  };
}
