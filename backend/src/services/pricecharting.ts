// PriceCharting (game valuation). NOTE: requires a PAID subscription token —
// there is no free game-price API. Prices are in US cents (USD).
// Docs: https://www.pricecharting.com/api-documentation
import { getApiKeys } from '../lib/apikeys';
import type { ValueResult } from '../types';

interface PcProduct {
  'product-name'?: string;
  'console-name'?: string;
  'loose-price'?: number; // cents
  'cib-price'?: number;
  'new-price'?: number;
  status?: string;
  error?: string;
}

// Map an item's free-text condition to a PriceCharting price tier.
function tierFor(condition: string | null): 'loose' | 'cib' | 'new' {
  const c = (condition || '').toLowerCase();
  if (/(seal|new|neu|mint|ovp\+|brand)/.test(c)) return 'new';
  if (/(cib|complete|ovp|boxed|box|vollständ)/.test(c)) return 'cib';
  return 'loose'; // safest default (lowest)
}

export async function priceChartingValue(
  title: string,
  platform: string | null,
  condition: string | null
): Promise<ValueResult | null> {
  const url = new URL('https://www.pricecharting.com/api/product');
  url.searchParams.set('t', getApiKeys().pricechartingToken);
  url.searchParams.set('q', [title, platform].filter(Boolean).join(' '));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`PriceCharting failed: ${res.status} ${await res.text()}`);
  const p = (await res.json()) as PcProduct;
  if (p.status === 'error' || p.error) return null;

  const tier = tierFor(condition);
  const cents =
    tier === 'new' ? p['new-price'] : tier === 'cib' ? p['cib-price'] : p['loose-price'];
  if (typeof cents !== 'number' || cents <= 0) {
    // fall back to loose if the chosen tier has no price
    const loose = p['loose-price'];
    if (typeof loose !== 'number' || loose <= 0) return null;
    return { source: 'pricecharting', value: Math.round(loose) / 100, currency: 'USD', note: 'loose' };
  }
  return { source: 'pricecharting', value: Math.round(cents) / 100, currency: 'USD', note: tier };
}
