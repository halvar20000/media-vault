// eBay valuation (games) via the Browse API — a FREE alternative to PriceCharting.
// Auth is OAuth2 client-credentials (an application token). We estimate value from
// the cheapest active USED fixed-price listings on the configured marketplace
// (e.g. EBAY_DE → EUR). NOTE: these are *asking* prices of live listings, not
// completed/sold prices (eBay's sold-price API needs business approval), so treat
// the figure as a solid ballpark rather than an exact sold value.
// Docs: https://developer.ebay.com/api-docs/buy/browse/overview.html
import { getApiKeys } from '../lib/apikeys';
import type { ValueResult } from '../types';

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;

  const basic = Buffer.from(`${getApiKeys().ebayClientId}:${getApiKeys().ebayClientSecret}`).toString('base64');
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  if (!res.ok) throw new Error(`eBay token request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

interface ItemSummary {
  price?: { value?: string; currency?: string };
}

// Drop a trailing short disambiguator like "(360)" so the query is clean.
function cleanTitle(title: string): string {
  return title.replace(/\s*\([a-z0-9][a-z0-9 \-]{0,6}\)\s*$/i, '').trim() || title;
}

export async function ebayValue(
  title: string,
  platform: string | null
): Promise<ValueResult | null> {
  const token = await getToken();
  const q = [cleanTitle(title), platform].filter(Boolean).join(' ');

  const url = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
  url.searchParams.set('q', q);
  // Used, fixed-price only (auction "current price" is misleading), cheapest first.
  url.searchParams.set('filter', 'conditions:{USED},buyingOptions:{FIXED_PRICE}');
  url.searchParams.set('sort', 'price');
  url.searchParams.set('limit', '20');

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': getApiKeys().ebayMarketplaceId,
    },
  });
  if (!res.ok) throw new Error(`eBay search failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { itemSummaries?: ItemSummary[] };
  const summaries = data.itemSummaries ?? [];

  const priced = summaries
    .map((s) => ({ v: parseFloat(s.price?.value ?? ''), c: s.price?.currency }))
    .filter((p) => Number.isFinite(p.v) && p.v > 0);
  if (!priced.length) return null;

  priced.sort((a, b) => a.v - b.v);
  // Median of the cheapest few — robust against a single lowball/mispriced listing.
  const cheap = priced.slice(0, Math.min(5, priced.length));
  const median = cheap[Math.floor((cheap.length - 1) / 2)].v;
  const currency = cheap[0].c || 'EUR';

  return {
    source: 'ebay',
    value: Math.round(median * 100) / 100,
    currency,
    note: `used, ${priced.length} listing${priced.length === 1 ? '' : 's'}`,
  };
}
